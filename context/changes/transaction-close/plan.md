# Transaction Close Implementation Plan

## Overview

Build S-06: the central business flow that lets a real estate agent mark a listing as "done" — after enforcing the document gate from S-05, collecting notary details, and locking the commission split — and reopen it if the deal collapses. This is the north-star slice that proves the core product hypothesis.

## Current State Analysis

- `listings.status` already has a DB check constraint: `('active', 'done')` — the state field is ready.
- S-05 (documents-and-files) adds `listing_documents.is_checked` and `listings.checklist_override` — these are the gate inputs S-06 reads. **S-06 depends on S-05 being fully implemented before end-to-end testing is possible.**
- Commission is display-only (pricing.astro): `listing.commission_percent` + `commission_settings` (tax_rate, agency_percent). No snapshot or lock exists.
- No notary fields, no `transaction_date`, no `closed_at`, no `transaction_snapshots` table.
- No `/close` page, no close or reopen API routes.
- Existing pattern: auth first → parse formData → validate → mutate → redirect `?success`/`?error`.

## Desired End State

A logged-in agent opens any active listing's close page, sees the document gate status (all checked, override active, or N items still missing with an inline override option), fills in notary name, city, and transaction date (all optional except the intent to close), and submits. The listing status becomes `'done'`, the commission split is snapshotted, and the dashboard card shows "Zysk agenta: X zł". If the deal collapses, the agent clicks "Wznów" — the listing returns to `'active'` with all data intact and the snapshot marked voided.

### Key Discoveries

- Commission rounding: `brutto_c = Math.round(asking_price * commission_percent)` in grosze; subsequent steps use `Math.round()` at each split. Store in PLN (divide by 100). Must match `pricing.astro` exactly to avoid confusing agents with different numbers at close vs. display.
- `commission_settings` is one row per user (unique constraint) — safe to `.single()`.
- Supabase-js has no multi-statement transaction support. Close = INSERT snapshot then UPDATE listing; if listing UPDATE fails after a successful snapshot INSERT, an orphaned snapshot exists. Accepted MVP risk — identifiable via `snapshot.voided_at IS NULL` + `listing.status = 'active'`.
- Listing card currently shows status badge + action buttons. Done cards need a different action set (Reopen instead of Zamknij) and the locked agent_net.
- Dashboard fetches all listings in one query. Snapshot data requires a second query keyed on done listing IDs — avoid a JOIN on the main listings query.

## What We're NOT Doing

- No database-level transaction (atomic close) — sequential INSERT + UPDATE with accepted orphan risk.
- No commission validation gate — if commission is not set, close is allowed; snapshot stores NULL financial fields.
- No email or notification on close.
- No history of multiple close/reopen cycles — only one active (non-voided) snapshot per listing is expected; voided ones accumulate silently.
- No "transaction summary" PDF export.
- No clearing of notary/date fields on reopen — data persists for the next close attempt.
- No time component on transaction_date — stored as `date` (day only), not `timestamptz`. PRD FR-018 says "date and time" (must-have), but Polish real estate closings are recorded by day; timezone complexity on Cloudflare Workers edge runtime is non-trivial. Accepted deliberate deviation from literal spec; upgrade to timestamptz is a v2 candidate if the agent needs exact time.
- transaction_notes is a convenience field with no PRD anchor (not in FR-007, FR-017, FR-018, or US-01). Kept as a low-cost catch-all for close-time context (reopen reasons, notary notes). Accepted scope addition; removable in v2 cleanup if traceability is required.

## Implementation Approach

Three phases: (1) DB migration + types (foundation only, no UI), (2) close flow — page, API, and entry points, (3) reopen flow + done listing display on the dashboard. Phases 2 and 3 require S-05 to be applied in the DB for gate logic; the close page renders even without S-05, but the gate check will always show "0 items missing" if `listing_documents` is empty.

## Critical Implementation Details

**Commission computation in the close API must match `pricing.astro` exactly.** The algorithm: `brutto_c = Math.round(asking_price * commission_percent)` (asking_price in PLN × commission_percent as a raw number gives the brutto in grosze). Then `agency_c = Math.round(brutto_c * agency_percent / 100)`, `gross_c = brutto_c - agency_c`, `tax_c = Math.round(gross_c * tax_rate / 100)`, `agent_c = gross_c - tax_c`. Store each as PLN: divide grosze value by 100 before inserting into `numeric(12,2)` columns.

**Inline override on close page is independent of `listings.checklist_override`.** The close API accepts a submitted `override_confirmed` field. Gate passes if: all docs checked OR `listing.checklist_override = true` (from S-05) OR `override_confirmed = 'true'` submitted. The inline checkbox is a one-shot bypass; it does not mutate `listings.checklist_override`.

---

## Phase 1: Database Migration + Type Definitions

### Overview

Single migration adds five nullable columns to `listings` and creates the `transaction_snapshots` table with RLS. Type definitions follow.

### Changes Required

#### 1. Migration file

**File**: `supabase/migrations/20260530100000_transaction_close.sql`

**Intent**: Add all DB structures needed by S-06. Adjust timestamp to actual `supabase db diff` output.

**Contract**:

- Open with: `create extension if not exists "pgcrypto" with schema extensions;`
- Alter listings:
  ```
  ALTER TABLE public.listings
    ADD COLUMN IF NOT EXISTS notary_name text,
    ADD COLUMN IF NOT EXISTS notary_city text,
    ADD COLUMN IF NOT EXISTS transaction_date date,
    ADD COLUMN IF NOT EXISTS transaction_notes text,
    ADD COLUMN IF NOT EXISTS closed_at timestamptz;
  ```
- Create `transaction_snapshots`:
  - `id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid()`
  - `listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE`
  - `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `asking_price numeric(12,2)`, `commission_percent numeric(5,2)`, `tax_rate numeric(5,2)`, `agency_percent numeric(5,2)`
  - `brutto numeric(12,2)`, `agency_amount numeric(12,2)`, `gross_income numeric(12,2)`, `tax_amount numeric(12,2)`, `agent_net numeric(12,2)`
  - `notary_name text`, `notary_city text`, `transaction_date date`
  - `snapshot_at timestamptz NOT NULL DEFAULT pg_catalog.now()`
  - `voided_at timestamptz` (NULL = active snapshot, non-NULL = voided on reopen)
- Enable RLS on `transaction_snapshots`.
- RLS policy `owners_own_transaction_snapshots`: `FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`.
- Unique partial index to prevent double-submit race: `CREATE UNIQUE INDEX unique_active_snapshot ON public.transaction_snapshots(listing_id) WHERE voided_at IS NULL;`

#### 2. Type definitions

**File**: `src/types/transaction.ts`

**Intent**: Declare the TypeScript shape for the snapshot table so the close page and API share one canonical type.

**Contract**: Export `TransactionSnapshot { id: string; listing_id: string; user_id: string; asking_price: number | null; commission_percent: number | null; tax_rate: number | null; agency_percent: number | null; brutto: number | null; agency_amount: number | null; gross_income: number | null; tax_amount: number | null; agent_net: number | null; notary_name: string | null; notary_city: string | null; transaction_date: string | null; snapshot_at: string; voided_at: string | null; }`. Also extend the `Listing` type in `src/types/listings.ts` with the five new nullable columns: `notary_name: string | null; notary_city: string | null; transaction_date: string | null; transaction_notes: string | null; closed_at: string | null;`.

### Success Criteria

#### Automated Verification

- Migration applies cleanly: `npx supabase db reset` completes without error
- TypeScript compiles: `npm run typecheck` passes

#### Manual Verification

- `listings` table in Supabase Studio shows five new nullable columns
- `transaction_snapshots` table exists with all specified columns and RLS enabled

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Close Transaction Flow

### Overview

Create the `/close` page (dual-state: active = form, done = summary), the close API route, and entry points from `ListingCard` and the `documents.astro` navigation bar.

### Changes Required

#### 1. Close transaction page

**File**: `src/pages/dashboard/listings/[id]/close.astro`

**Intent**: The single UI for both closing a listing and viewing a closed listing's summary. When the listing is active, it shows the gate status, notary form, and commission preview. When done, it shows the locked data and a Reopen button.

**Contract**:

- Auth first: `createClient → getUser → redirect /auth/signin`. Supabase null-guard: `if (!supabase) return Astro.redirect('/auth/signin')`.
- Fetch listing and commission_settings in parallel: `const [listingResult, settingsResult] = await Promise.all([ .from('listings').select('id, address, type, status, asking_price, commission_percent, checklist_override, notary_name, notary_city, transaction_date, transaction_notes, closed_at').eq('id', id).eq('user_id', user.id).single(), .from('commission_settings').select('tax_rate, agency_percent').eq('user_id', user.id).maybeSingle() ])`. On listing error or null: redirect `/dashboard?error=nie-znaleziono`. No error if settings null — agent may not have configured rates.
- After listing status is known, fetch conditionally: if active → `.from('listing_documents').select('id', { count: 'exact', head: true }).eq('listing_id', id).eq('is_checked', false)` (count only, no rows). If done → `.from('transaction_snapshots').select('*').eq('listing_id', id).is('voided_at', null).maybeSingle()`.
- Read `?success` and `?error` query params; render `<Banner>` accordingly.
- Navigation tabs: Edit → Pricing → Dokumenty i zdjęcia → Zamknij (active tab). Same dark-card + blue-accent style as existing pages.

**Active state rendering:**

- Gate section at top:
  - If `checklist_override = true` OR `uncheckedCount = 0`: show ✅ "Dokumenty gotowe — transakcja może zostać zamknięta."
  - Else: show ⚠️ "Brakuje X dokumentów." + list of unchecked labels (fetch: `.from('listing_documents').select('label').eq('listing_id', id).eq('is_checked', false).order('position').limit(50)`). Show an "Pomiń weryfikację dokumentów" checkbox (`name="override_confirmed" value="true"`). If unchecked items exist and this checkbox is unchecked, the submit button is disabled (CSS `disabled` state + visual explanation).
- Commission preview section: if `asking_price` and `commission_percent` and `commission_settings` all non-null, show the computed split (same numbers as pricing.astro). If any are null: show "Brak danych prowizji — snapshot będzie pusty."
- Form: `method="POST" action="/api/listings/{id}/close"`. Fields: `notary_name` (text, optional), `notary_city` (text, optional), `transaction_date` (date input, optional), `transaction_notes` (textarea, optional), hidden `override_confirmed` (driven by the checkbox above). Submit: "Zamknij transakcję".

**Done state rendering:**

- Banner: "Transakcja zamknięta {closed_at date}."
- Show notary_name, notary_city, transaction_date, transaction_notes from listing.
- If active snapshot exists and agent_net is non-null: show "Zysk agenta: {formatPLN(agent_net)}" and the full split breakdown. Else: "Brak danych prowizji."
- Reopen form: `method="POST" action="/api/listings/{id}/reopen"`. Button: "Wznów transakcję".

#### 2. Close API route

**File**: `src/pages/api/listings/[id]/close.ts`

**Intent**: Validate the gate, compute the commission snapshot, and atomically update the listing to `'done'`.

**Contract**: Auth first. Supabase null-guard. Parse formData: `notary_name`, `notary_city`, `transaction_date`, `transaction_notes`, `override_confirmed`. Validate: if listing.status = 'done', redirect `?error=juz-zamknieta`.

Gate check: fetch `{ count }` of unchecked docs + `listing.checklist_override`. If `uncheckedCount > 0` AND `listing.checklist_override = false` AND `override_confirmed !== 'true'`: redirect `/dashboard/listings/{id}/close?error=brakujace-dokumenty`.

Fetch commission_settings: `.from('commission_settings').select('tax_rate, agency_percent').eq('user_id', user.id).maybeSingle()`. Store as `settings`; null result means rates not configured — handled by the NULL-check below.

Commission computation (execute only if asking_price, commission_percent, and settings are all non-null; otherwise all values remain null):
- `brutto_c = Math.round(listing.asking_price * listing.commission_percent)`
- `agency_c = Math.round(brutto_c * settings.agency_percent / 100)`
- `gross_c = brutto_c - agency_c`
- `tax_c = Math.round(gross_c * settings.tax_rate / 100)`
- `agent_c = gross_c - tax_c`
- Store as PLN: divide each by 100.

INSERT `transaction_snapshots`: all financial fields + `notary_name`, `notary_city`, `transaction_date` (copy from submitted form). On insert error: redirect `?error=blad-zapisu`.

UPDATE `listings`: `status = 'done'`, `notary_name`, `notary_city`, `transaction_date`, `transaction_notes`, `closed_at = new Date().toISOString()`. Filter: `.eq('id', params.id).eq('user_id', user.id)`. On update error: redirect `?error=blad-zapisu` (orphaned snapshot — accepted MVP risk per "What We're NOT Doing").

On success: redirect `/dashboard/listings/{id}/close?success=zamknieto`.

#### 3. ListingCard entry point

**File**: `src/components/listings/ListingCard.astro`

**Intent**: Add a "Zamknij transakcję" action button for active listings so the agent can reach the close page from the dashboard.

**Contract**: For listings where `listing.status === 'active'`, insert an `<a>` link to `/dashboard/listings/{listing.id}/close` with the same secondary button style as the existing action buttons (Edytuj, Cena i prowizja, Dokumenty i zdjęcia). Add it after "Dokumenty i zdjęcia" and before "Usuń".

#### 4. Navigation wiring — documents, edit, and pricing pages

**File**: `src/pages/dashboard/listings/[id]/documents.astro`

**Intent**: Extend the listing navigation chain with a forward link to the close page so Dokumenty i zdjęcia → Zamknij is reachable from within the listing.

**Contract**: Add a "Zamknij transakcję →" link to the bottom navigation bar (next to the existing forward links), pointing to `/dashboard/listings/{id}/close`.

**File**: `src/pages/dashboard/listings/[id]/edit.astro`

**Intent**: Add a forward navigation link to the close page so the full chain Edit → Pricing → Dokumenty → Zamknij is reachable from the first listing page.

**Contract**: Add a "Zamknij transakcję →" link to the bottom navigation bar (alongside the existing "Cena i prowizja →" and "Dokumenty i zdjęcia →" links), pointing to `/dashboard/listings/{id}/close`.

**File**: `src/pages/dashboard/listings/[id]/pricing.astro`

**Intent**: Add a forward navigation link to the close page.

**Contract**: Add a "Zamknij transakcję →" link to the bottom navigation bar, pointing to `/dashboard/listings/{id}/close`.

### Success Criteria

#### Automated Verification

- TypeScript compiles: `npm run typecheck` passes
- Lint passes: `npm run lint`

#### Manual Verification

- Active listing → ListingCard "Zamknij transakcję" button navigates to `/close`
- Active listing with all docs checked → gate shows ✅, submit enabled
- Active listing with unchecked docs → gate shows ⚠️ with missing items list; submit disabled until override checkbox is ticked
- Submit close form → listing status = 'done', `transaction_snapshots` row exists in Studio with correct financial values
- Close page for done listing shows locked commission split and notary details
- Error banner appears for `?error=` params
- Documents page has forward "Zamknij transakcję →" link

**Implementation Note**: Pause for manual confirmation after this phase before proceeding.

---

## Phase 3: Reopen + Done Listing Display

### Overview

Add the reopen API route, wire the Reopen button on done listings (card + close page), and update the dashboard to fetch and display locked `agent_net` on done listing cards.

### Changes Required

#### 1. Reopen API route

**File**: `src/pages/api/listings/[id]/reopen.ts`

**Intent**: Set the listing back to `'active'` and mark the active snapshot as voided, preserving all notary and financial data for audit.

**Contract**: Auth first. Supabase null-guard. Verify listing: `.from('listings').select('id, status').eq('id', params.id).eq('user_id', user.id).single()`. If `listing.status = 'active'`: redirect `?error=juz-aktywna`. UPDATE `listings`: `status = 'active'`, `closed_at = null`. // Intentionally preserves notary_name, notary_city, transaction_date, transaction_notes — reopen per plan transaction-close Phase 3. On update error: redirect `?error=blad-zapisu`. UPDATE `transaction_snapshots`: `voided_at = new Date().toISOString()` WHERE `listing_id = params.id AND voided_at IS NULL`. On error: redirect `?error=blad-zapisu`. On success: redirect `/dashboard?success=wznowiono`.

#### 2. Done listing card display

**File**: `src/components/listings/ListingCard.astro`

**Intent**: For done listings, replace the "Zamknij transakcję" button with a "Wznów" reopen form, and replace the commission badge with the locked agent-net from the snapshot.

**Contract**: The `ListingCard` component receives a new optional prop `agentNet: number | null` (passed from `dashboard.astro`). For `listing.status === 'done'`:
- Show "Zysk agenta: {formatPLN(agentNet)}" (or "—" if null) in place of the commission display.
- Render `<form method="POST" action="/api/listings/{listing.id}/reopen">` with a "Wznów transakcję" submit button instead of the "Zamknij transakcję" link. // Intentionally no `action` confirmation dialog — reopen is reversible per plan transaction-close Phase 3.
- Remove the "Zamknij transakcję" link (active-only).

#### 3. Dashboard snapshot fetch

**File**: `src/pages/dashboard.astro`

**Intent**: Fetch the active commission snapshot for all done listings in a single query so `ListingCard` can display locked `agent_net` without an N+1 pattern.

**Contract**:
- After fetching listings, collect IDs of done listings: `const doneIds = listings.filter(l => l.status === 'done').map(l => l.id)`.
- If `doneIds.length > 0`: fetch `.from('transaction_snapshots').select('listing_id, agent_net').in('listing_id', doneIds).is('voided_at', null).limit(100)`. Build a map: `const snapshotMap = new Map(snapshots.map(s => [s.listing_id, s.agent_net]))`.
- Pass `agentNet={snapshotMap.get(listing.id) ?? null}` to each `ListingCard`.

### Success Criteria

#### Automated Verification

- TypeScript compiles: `npm run typecheck` passes
- Lint passes: `npm run lint`

#### Manual Verification

- Done listing card shows "Zysk agenta: X zł" with the correct value from the snapshot
- Done listing card shows "Wznów transakcję" button; no "Zamknij transakcję" link
- Click "Wznów transakcję" → listing returns to active; snapshot has non-null `voided_at` in Studio; `listings.closed_at = null`
- Reopened listing can be closed again: new snapshot row created, old one remains voided

**Implementation Note**: Pause for manual confirmation after this phase.

---

## Testing Strategy

### Unit Tests

None planned — no pure business logic functions; all logic lives in routes and pages.

### Integration Tests

None in this slice.

### Manual Testing Steps

1. Ensure S-05 migration is applied and a listing exists with a checklist
2. Navigate ListingCard → "Zamknij transakcję" for an active listing
3. With unchecked docs: verify gate blocks, missing items listed, submit disabled
4. Check "Pomiń weryfikację" → submit enabled; close → verify DB state
5. With all docs checked: verify gate passes automatically, submit enabled
6. Fill notary name + city + date + notes; submit → verify `transaction_snapshots` in Studio
7. Close page done-state shows correct locked commission split
8. ListingCard for done listing shows "Zysk agenta" amount
9. Reopen → listing back to active; Studio: snapshot `voided_at` non-null, `listings.closed_at = null`
10. Close again → new snapshot row, old voided row still present
11. No-commission listing: close succeeds; snapshot agent_net = null; no error

## Performance Considerations

- Dashboard snapshot fetch is a second query (not a JOIN on the main listings query). Acceptable at MVP scale — single agent, typically <20 done listings. If the two-query pattern becomes slow, move to a single query with embedded select.
- Unchecked-doc count on the close page uses `{ count: 'exact', head: true }` — no rows transferred, just the count.

## Migration Notes

- All new columns on `listings` are nullable — safe for all pre-existing listings without data migration.
- `transaction_snapshots` starts empty — no backfill needed.

## References

- PRD: FR-007, FR-017, FR-018, US-01 — `context/foundation/prd.md`
- Roadmap S-06 entry — `context/foundation/roadmap.md`
- S-05 plan (gate inputs: checklist_override, listing_documents) — `context/changes/documents-and-files/plan.md`
- Commission rounding algorithm — `src/pages/dashboard/listings/[id]/pricing.astro`
- Lessons: auth-first, null guard, Polish error strings, .limit() on list queries, push ordering to DB — `context/foundation/lessons.md`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database Migration + Type Definitions

#### Automated

- [x] 1.1 `npx supabase db reset` completes without error
- [x] 1.2 `npm run typecheck` passes after adding `src/types/transaction.ts` and extending `Listing` type

#### Manual

- [x] 1.3 Five new nullable columns visible on `listings` table in Supabase Studio
- [x] 1.4 `transaction_snapshots` table exists with all columns and RLS enabled

### Phase 2: Close Transaction Flow

#### Automated

- [ ] 2.1 `npm run typecheck` passes
- [ ] 2.2 `npm run lint` passes

#### Manual

- [ ] 2.3 ListingCard "Zamknij transakcję" button navigates to `/close` for active listings
- [ ] 2.4 Close page with all docs checked: gate shows ✅, submit enabled
- [ ] 2.5 Close page with unchecked docs: gate shows ⚠️ with missing items; submit disabled until override ticked
- [ ] 2.6 Submit close form → `listings.status = 'done'`, `transaction_snapshots` row in Studio with correct values
- [ ] 2.7 Close page done-state shows locked commission + notary details
- [ ] 2.8 Error banners render for `?error=` params
- [ ] 2.9 Documents page "Zamknij transakcję →" link navigates to close page

### Phase 3: Reopen + Done Listing Display

#### Automated

- [ ] 3.1 `npm run typecheck` passes
- [ ] 3.2 `npm run lint` passes

#### Manual

- [ ] 3.3 Done listing card shows "Zysk agenta: X zł" with correct snapshot value
- [ ] 3.4 Done listing card shows "Wznów transakcję" button (no "Zamknij" link)
- [ ] 3.5 Reopen → listing active; `voided_at` non-null in Studio; `closed_at` null
- [ ] 3.6 Re-close after reopen → new snapshot row created; old voided row persists
- [ ] 3.7 No-commission listing closes without error; snapshot `agent_net = null`
