# Pricing and Commission (S-03) Implementation Plan

## Overview

Implement FR-009–FR-012: asking price per listing (with append-only history), per-user commission rate settings, and a server-side commission split calculator. Builds directly on the S-02 listing-crud foundation — no new patterns are introduced, only new tables and pages following the exact conventions established in S-02.

## Current State Analysis

One migration exists (`20260525152607_create_listings.sql`). The `listings` table has no price column. `handle_updated_at()` is declared as `CREATE OR REPLACE` and reusable. Two new tables (`commission_settings`, `price_history`) and one new column (`listings.asking_price`) are required.

All 8 lessons from `context/foundation/lessons.md` apply. The middleware already protects `/dashboard/settings/*` and `/dashboard/listings/[id]/pricing` — no middleware changes needed.

## Desired End State

After this plan:
- The agent can set and update an asking price on any listing; the price is stored in `price_history` and mirrored to `listings.asking_price` (denormalized for dashboard performance).
- The agent can view the full price-change history per listing, newest first.
- The agent can configure tax rate and agency % once at `/dashboard/settings/commission`; rates persist per user via `commission_settings`.
- The agent can enter a total commission on the pricing page and see an instant server-rendered breakdown: agency portion, gross income, tax provision, agent net.
- The split is always algebraically exact — no rounding errors possible with the integer-cents formula.

### Key Discoveries

- `handle_updated_at()` already exists as `CREATE OR REPLACE` — new migration needs only a `CREATE TRIGGER` call, not a function redeclaration.
- Dashboard queries follow `.order(col).limit(100)` on every list; price history must match this pattern.
- All mutations use redirect-based error/success surfacing — no JSON responses.
- `commission_settings` is 1-per-user — the upsert uses `ON CONFLICT (user_id) DO UPDATE`, no existence check.
- The commission formula is algebraically guaranteed to sum to the entered total when computed in integer grosz — the tolerance check is a safety net, not the enforcement mechanism.

## What We're NOT Doing

- No commission total persistence in S-03 — the agent enters a total on the pricing page for display only; saving the locked commission happens in S-06 (transaction close).
- No pagination on price history — all entries up to limit 100.
- No client-side JS commission calculator — computation is server-rendered on every GET with a `?commission=` param.
- No settings "section" beyond commission — `/dashboard/settings/commission` is the first (and for MVP, only) settings page; no settings index page.
- No atomicity guarantee between the two writes in `price/set.ts` — sequential INSERT + UPDATE is acceptable for MVP (explained in Phase 3).

## Implementation Approach

Three phases in dependency order: schema first, commission settings second (can be tested independently), listing pricing page third (depends on commission settings for the calculator empty state). Each phase is independently deployable and testable.

Commission formula (confirmed: PRD prose version):
```
agency_portion = total × agency_percent / 100
gross_income   = total − agency_portion
tax_provision  = gross_income × tax_rate / 100
agent_net      = gross_income − tax_provision
```
All arithmetic in integer grosz (multiply inputs by 100, round, compute, divide back for display). Sum is algebraically exact; no rounding error possible.

## Critical Implementation Details

**Integer grosz arithmetic for commission**: Convert `total`, `agency_percent`, and `tax_rate` to integers in grosz before any multiplication. Specifically: `total_cents = Math.round(parseFloat(param) * 100)`. Compute `agency_cents = Math.round(total_cents * agency_percent / 100)`, then `gross_cents = total_cents - agency_cents`, then `tax_cents = Math.round(gross_cents * tax_rate / 100)`, then `agent_cents = gross_cents - tax_cents`. This is not floating point math — no epsilon tolerance needed, the sum is exact by construction. A final `Math.abs(agency_cents + tax_cents + agent_cents - total_cents) > 1` check acts as a guard for unexpected inputs.

**`handle_updated_at()` — attach, do not redeclare**: The function is in the database from the first migration. The new migration must not redefine it. Only `CREATE TRIGGER handle_commission_settings_updated_at BEFORE UPDATE ON commission_settings FOR EACH ROW EXECUTE FUNCTION handle_updated_at();` is needed.

**`commission_settings` fetch — use `.maybeSingle()`, not `.single()`**: No row = first visit = render form with zero defaults. This is the happy path. `.single()` would require PGRST116 handling where null data is the expected case; `.maybeSingle()` returns `{data: null, error: null}` cleanly.

---

## Phase 1: Database Migration and Type Updates

### Overview

Create the two new tables and add the denormalized price column to `listings`. Update the `Listing` TypeScript type and add new `pricing.ts` types so downstream phases compile cleanly.

### Changes Required

#### 1. New migration file

**File**: `supabase/migrations/20260529120000_create_pricing_and_commission.sql`

**Intent**: Create `commission_settings` and `price_history` tables with correct RLS, attach `handle_updated_at()` to `commission_settings` (append-only `price_history` needs no trigger), and add `asking_price` column to `listings`.

**Contract**: The migration must follow all 8 lesson rules. Specific constraints:
- Declare `create extension if not exists "pgcrypto" with schema extensions;` at top (idempotent; required by lesson even though it was declared in migration 1)
- `commission_settings`: `id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid()`, `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100)`, `agency_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (agency_percent >= 0 AND agency_percent <= 100)`, `created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()`, `CONSTRAINT commission_settings_user_id_unique UNIQUE (user_id)`
- RLS on `commission_settings`: `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` (flat ownership, same pattern as `listings`)
- `price_history`: `id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid()`, `listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE`, `price NUMERIC(12,2) NOT NULL CHECK (price > 0)`, `set_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()` — no `updated_at`, no trigger (append-only)
- RLS on `price_history`: ownership via subquery — `USING (EXISTS (SELECT 1 FROM listings WHERE listings.id = price_history.listing_id AND listings.user_id = auth.uid()))` with matching `WITH CHECK`
- `ALTER TABLE listings ADD COLUMN asking_price NUMERIC(12,2);` — nullable, no default (null means "price not yet set")

#### 2. Add `asking_price` to Listing type

**File**: `src/types/listings.ts`

**Intent**: The `Listing` type must include `asking_price` so the dashboard card can display the current price without a type error.

**Contract**: Add `asking_price: number | null` to the `Listing` interface, mirroring the nullable DB column.

#### 3. New pricing types

**File**: `src/types/pricing.ts`

**Intent**: Centralize the types for the two new entities so all downstream pages and API routes import from a single place.

**Contract**:
- `CommissionSettings`: `id: string`, `user_id: string`, `tax_rate: number`, `agency_percent: number`, `created_at: string`, `updated_at: string`
- `PriceHistoryEntry`: `id: string`, `listing_id: string`, `price: number`, `set_at: string`
- Timestamp columns typed as `string` (ISO string from Supabase), matching `Listing` convention.

### Success Criteria

#### Automated Verification

- Migration applies cleanly locally: `npx supabase db reset` completes without errors
- All three tables (`listings`, `commission_settings`, `price_history`) and the `asking_price` column exist after reset
- TypeScript compiles: `npm run typecheck` passes with no new errors
- Linting passes: `npm run lint` passes with no new errors

#### Manual Verification

- Supabase Studio shows `commission_settings` and `price_history` tables with correct columns and RLS enabled
- `listings` table shows `asking_price` column (nullable NUMERIC)
- Attempting to insert a `commission_settings` row with `tax_rate = -1` or `tax_rate = 101` fails with a constraint violation

**Implementation Note**: After completing this phase, pause for manual database verification before proceeding to Phase 2.

---

## Phase 2: Commission Settings Page and API

### Overview

Add a dedicated settings page at `/dashboard/settings/commission` where the agent configures tax rate and agency percentage. One POST API route handles the upsert. The dashboard nav gets a settings link so the page is reachable.

### Changes Required

#### 4. Commission settings page

**File**: `src/pages/dashboard/settings/commission.astro`

**Intent**: Display the agent's current commission rates (or zero defaults on first visit) and a form to update them. Follow the canonical single-row-fetch page pattern from `edit.astro`.

**Contract**:
1. `createClient(Astro.request.headers, Astro.cookies)` → null check → redirect
2. `supabase.auth.getUser()` → redirect to `/auth/signin` if no user
3. `supabase.from('commission_settings').select('*').eq('user_id', user.id).maybeSingle()` — null data = no settings saved yet (render form with `tax_rate=0`, `agency_percent=0`)
4. `Astro.url.searchParams.get('error')` → render Polish error banner if present
5. Form: `method="POST"` `action="/api/settings/commission"`, two `type="number"` inputs (`step="0.01"` `min="0"` `max="100"`) for `tax_rate` and `agency_percent`, one submit button. All labels in Polish.
6. Back link to `/dashboard`

#### 5. Commission settings API route

**File**: `src/pages/api/settings/commission.ts`

**Intent**: Validate and upsert the agent's commission rates. No-op if the values are unchanged (Supabase upsert is idempotent).

**Contract**: Follow the canonical `create.ts` / `update.ts` mutation pattern:
1. `createClient` → null check → redirect
2. `supabase.auth.getUser()` → redirect if no user
3. `context.request.formData()` → extract `tax_rate`, `agency_percent`
4. Validate: both `parseFloat`-able, both in range [0, 100] — redirect to `/dashboard/settings/commission?error=stawki-nieprawidlowe` on failure
5. `supabase.from('commission_settings').upsert({ user_id: user.id, tax_rate, agency_percent }, { onConflict: 'user_id' })` — do NOT add `.eq('user_id', user.id)` on an upsert; the `onConflict` column is the ownership key
6. Handle error → redirect with `?error=...`
7. `context.redirect('/dashboard/settings/commission')` on success

#### 6. Dashboard navigation link

**File**: `src/pages/dashboard.astro`

**Intent**: Add a "Ustawienia" (or "Ustawienia prowizji") navigation link so the settings page is reachable from the main dashboard without typing the URL.

**Contract**: Add a Polish-language nav link pointing to `/dashboard/settings/commission`. Position it alongside any existing nav links. No other changes to this file in this phase.

### Success Criteria

#### Automated Verification

- `npm run typecheck` passes
- `npm run lint` passes

#### Manual Verification

- Visit `/dashboard/settings/commission` → form shows with `0` in both fields on first visit
- Fill in `tax_rate=20`, `agency_percent=50`, submit → page reloads showing saved values
- Revisit `/dashboard/settings/commission` → values still show `20` and `50`
- Submit `tax_rate=101` → error banner appears in Polish
- Nav link on dashboard navigates to the settings page

**Implementation Note**: After manual verification of round-trip save/load, proceed to Phase 3.

---

## Phase 3: Listing Pricing Page and Price-Set API

### Overview

Add `/dashboard/listings/[id]/pricing` with three sections: current price + set-price form, price history table, and commission calculator. Add the price-set API route. Update the dashboard card to show the asking price and the edit page to link to the pricing page.

### Changes Required

#### 7. Listing pricing page

**File**: `src/pages/dashboard/listings/[id]/pricing.astro`

**Intent**: One page that covers FR-009 (set price), FR-010 (price history), and FR-011 (commission calculator). Server-rendered on every GET — no client-side state.

**Contract**:
1. Auth + client setup (same as `edit.astro`)
2. Fetch listing: `.from('listings').select('*').eq('id', id).eq('user_id', user.id).single()` — PGRST116 → redirect to `/dashboard`, other error → redirect with `?error=`
3. Fetch price history: `.from('price_history').select('*').eq('listing_id', id).order('set_at', { ascending: false }).limit(100)` — no PGRST116 handling (empty array is valid)
4. Fetch commission settings: `.from('commission_settings').select('*').eq('user_id', user.id).maybeSingle()` — null = not configured
5. Parse `Astro.url.searchParams.get('commission')` as float — null or NaN = no calculation shown
6. Commission computation (only when `?commission=` valid AND settings non-null): integer grosz arithmetic as specified in Critical Implementation Details; validate final sum within 1 grosz
7. Render three sections in order:
   - **Cena wywoławcza**: show `listing.asking_price` formatted as PLN (or "Nie ustalono"), followed by a `method="POST" action="/api/listings/{id}/price/set"` form with a price input (`type="number" step="0.01" min="0.01"`) and submit button
   - **Historia cen**: `<table>` of price history entries (price in PLN, formatted `set_at` as Polish date); empty-state text if no entries
   - **Kalkulator prowizji**: if no settings → inline Polish notice ("Aby obliczyć prowizję, skonfiguruj stawki w ustawieniach konta.") with `<a href="/dashboard/settings/commission">`; if settings exist → `method="GET"` form with `?commission=` input + (if `?commission=` valid) breakdown table (4 rows: Prowizja ogółem, Część agencji, Dochód brutto, Rezerwa podatkowa, Dochód netto agenta)
8. `?error=` and `?success=` banner handling
9. Back link to `/dashboard/listings/{id}/edit`

#### 8. Price-set API route

**File**: `src/pages/api/listings/[id]/price/set.ts`

**Intent**: Record the new asking price as an entry in `price_history` and mirror it to `listings.asking_price`. Two sequential writes — not transactional, intentionally (see note below).

**Contract**: Canonical mutation pattern:
1. Auth → redirect if no user
2. Extract listing `id` from `context.params`
3. `formData()` → `price`
4. Validate: `parseFloat(price)` is finite and > 0; at most 2 decimal places (`Math.round(value * 100) / 100 === value`); redirect with `?error=cena-nieprawidlowa` on failure
5. `supabase.from('price_history').insert({ listing_id: id, price: parsedPrice })` — handle error → redirect with `?error=`
6. `supabase.from('listings').update({ asking_price: parsedPrice }).eq('id', id).eq('user_id', user.id)` — add inline comment: `// Second write — denormalized cache of price_history. Sequential (not atomic) by design; retry is safe. See plan pricing-and-commission Phase 3.` — handle error → redirect with `?error=`
7. `context.redirect(`/dashboard/listings/${id}/pricing`)`

#### 9. Dashboard card price display

**File**: `src/pages/dashboard.astro`

**Intent**: Show the current asking price on each listing card so the agent can see prices at a glance without opening each listing.

**Contract**: In the listing card template, display `listing.asking_price` formatted as a PLN amount (e.g., `10 000,00 zł`) when non-null, and a Polish dash or "Brak ceny" when null. Keep the existing `.order()` and `.limit(100)` query — no changes to the fetch itself (the type update from Phase 1 makes `asking_price` available).

#### 10. Edit page link to pricing page

**File**: `src/pages/dashboard/listings/[id]/edit.astro`

**Intent**: Allow the agent to navigate from the edit page to the pricing page without returning to the dashboard.

**Contract**: Add a Polish-language link (e.g., "Cena i prowizja →") pointing to `/dashboard/listings/{id}/pricing`. Position it near the existing action links on the edit page (alongside the back-to-dashboard link or below the form). Styling follows the existing link style on the page.

### Success Criteria

#### Automated Verification

- `npm run typecheck` passes
- `npm run lint` passes

#### Manual Verification

- Set a price on a listing → price appears in the history table (newest first), price shown on edit page link area and on dashboard card
- Set price a second time → history shows two entries; dashboard card shows the latest price
- Navigate to `/dashboard/listings/{id}/pricing` for a listing owned by a different user → redirect to `/dashboard` (ownership check)
- Commission calculator with no settings → inline notice with settings link
- Commission calculator with settings (e.g., tax=20, agency=50) and total=10000 → agency=5000, gross=5000, tax=1000, agent net=4000 (all displayed in PLN)
- Enter commission total with more than 2 decimal places (e.g., 10000.001) → validation error or browser input step enforcement
- Price input with 0 or negative → error banner shown in Polish

**Implementation Note**: Verify the commission formula output manually with at least two test cases (clean split and an odd rate like tax=19, agency=33.33) before marking this phase complete.

---

## Testing Strategy

### Unit Tests

There are no unit tests in the S-02 baseline. The commission formula is a pure function — if a unit test file is added, it should cover:
- Clean split: 10 000 zł, 50% agency, 20% tax → agency 5 000, gross 5 000, tax 1 000, net 4 000
- Odd rates: 10 001 zł, 33.33% agency, 19% tax → verify sum equals 10 001 exactly
- Edge: 0% agency and 0% tax → agency 0, gross = total, tax 0, net = total
- Edge: 100% agency → gross 0, tax 0, net 0

### Integration Tests

None in the S-02 baseline. For S-03, manual end-to-end testing (listed in Phase 3 Manual Verification) substitutes.

### Manual Testing Steps

1. Create a new listing; verify its card on the dashboard shows "Brak ceny" (or dash)
2. Open the listing's pricing page; set a price of `250 000`; confirm the history table shows one entry and the dashboard card updates
3. Set a second price of `245 000`; confirm history shows two entries, newest first; dashboard card shows `245 000`
4. Navigate to settings; set tax rate to `20`, agency to `50`; save; revisit and confirm values are retained
5. Open the pricing page; enter `10000` in the commission calculator; confirm: agency 5 000,00 zł, gross 5 000,00 zł, tax 1 000,00 zł, net 4 000,00 zł
6. Clear commission settings (set to 0/0); open pricing page; confirm the notice and settings link appear
7. Try to open another user's listing pricing page by URL; confirm redirect to dashboard

## Performance Considerations

The denormalized `asking_price` column on `listings` eliminates any JOIN for the dashboard query. Price history for a listing is bounded by LIMIT 100. Commission computation is a handful of integer operations in the page frontmatter — negligible.

## Migration Notes

The `ALTER TABLE listings ADD COLUMN asking_price NUMERIC(12,2)` is safe on an empty or small table. In production with many rows, the column addition is instant (no table rewrite in Postgres 11+ for nullable columns). Existing listing rows will have `asking_price = NULL` until a price is set.

## References

- Related research: `context/changes/pricing-and-commission/research.md`
- PRD §Pricing & Commission: FR-009–FR-012, §Business Logic
- Lessons: `context/foundation/lessons.md` — all 8 rules apply
- Canonical API route pattern: `src/pages/api/listings/create.ts`
- Canonical single-row-fetch page: `src/pages/dashboard/listings/[id]/edit.astro`
- First migration (handle_updated_at source): `supabase/migrations/20260525152607_create_listings.sql`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Database Migration and Type Updates

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` completes without errors — 49c8a2b
- [x] 1.2 TypeScript compiles: `npm run typecheck` passes — 49c8a2b
- [x] 1.3 Linting passes: `npm run lint` passes — 49c8a2b

#### Manual

- [x] 1.4 Supabase Studio shows `commission_settings` and `price_history` tables with RLS enabled — 49c8a2b
- [x] 1.5 `listings` table shows nullable `asking_price` column — 49c8a2b
- [x] 1.6 Constraint violation on `tax_rate` outside 0–100 confirmed — 49c8a2b

### Phase 2: Commission Settings Page and API

#### Automated

- [x] 2.1 TypeScript compiles: `npm run typecheck` passes — 1e3befc
- [x] 2.2 Linting passes: `npm run lint` passes — 1e3befc

#### Manual

- [x] 2.3 First visit to `/dashboard/settings/commission` shows form with zero defaults — 1e3befc
- [x] 2.4 Save → revisit shows saved values — 1e3befc
- [x] 2.5 Invalid rate (e.g., 101) → Polish error banner shown — 1e3befc
- [x] 2.6 Nav link on dashboard navigates to settings page — 1e3befc

### Phase 3: Listing Pricing Page and Price-Set API

#### Automated

- [x] 3.1 TypeScript compiles: `npm run typecheck` passes — 11ed58b
- [x] 3.2 Linting passes: `npm run lint` passes — 11ed58b

#### Manual

- [x] 3.3 Set price → history table updated, dashboard card updated — 11ed58b
- [x] 3.4 Second price set → history shows two entries newest-first — 11ed58b
- [x] 3.5 Another user's listing pricing page → redirect to dashboard — 11ed58b
- [x] 3.6 No commission settings → inline notice with settings link — 11ed58b
- [x] 3.7 Commission calculator with tax=20 agency=50 total=10000 → correct breakdown — 11ed58b
- [x] 3.8 Invalid price (0 or negative) → Polish error banner — 11ed58b
