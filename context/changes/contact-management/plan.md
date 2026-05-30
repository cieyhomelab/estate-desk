# Contact Management — Implementation Plan

## Overview

Add contact management to each listing: the agent adds interested-party contacts (name, phone, email, optional role: kupujący/najemca), views the full list on a per-listing contacts page, and can hard-delete individual contacts. One inline page — form at the top, list below — following the `pricing.astro` layout. The `contacts` table is a child of `listings` with subquery-based RLS ownership.

## Current State Analysis

- `listings` table fully implemented; `listing_id` FK target is ready
- `price_history` table establishes the subquery RLS ownership pattern for listing-child tables — copy it exactly
- API routes follow: auth first → parse form → inline validate → redirect with Polish error codes — never raw DB errors
- `handle_updated_at()` reusable trigger function exists; contacts are append-only so no `updated_at` column or trigger needed
- `lessons.md` rules in effect: declare extensions in every migration, push ordering and limit to DB, authenticate before validating, map DB errors to Polish strings, schema-qualify trigger references in `CREATE TRIGGER`
- No existing contacts code anywhere — clean greenfield

## Desired End State

A logged-in agent can:
- Open `/dashboard/listings/[id]/contacts` from the listing card on the dashboard (via a new 'Kontakty' link) alongside 'Edytuj' and 'Cena i prowizja'
- Add a contact by entering name (required), phone (optional), email (optional), and role (optional: kupujący / najemca)
- See all contacts for that listing in a table below the form, ordered oldest-first
- Delete any contact with a Polish confirmation prompt

### Key Discoveries

- `price_history` subquery RLS ownership pattern: `supabase/migrations/20260529120000_create_pricing_and_commission.sql`
- ListingCard action bar to extend: `src/components/listings/ListingCard.astro`
- Inline form + history layout to mirror: `src/pages/dashboard/listings/[id]/pricing.astro`
- API route pattern (auth → validate → redirect): `src/pages/api/listings/[id]/price/set.ts`
- Existing TypeScript types follow one-file-per-entity convention: `src/types/listings.ts`, `src/types/pricing.ts`

## What We're NOT Doing

- Not editing existing contacts — corrections happen via delete + re-add; PRD (FR-013, FR-014) only requires add and view
- Not enforcing role against listing type — agent picks freely; a sale listing may have a tenant-buyer
- Not validating phone/email format — non-empty string is enough; agent is sole user and responsible for their own data
- Not paginating the contact list — `LIMIT 100` is sufficient for MVP single-agent use
- Not adding a contact count badge to ListingCard — card already has enough information

## Implementation Approach

Same three-phase pattern as all prior slices: (1) database migration; (2) TypeScript types and API routes; (3) UI page and ListingCard link update. No client-side React islands needed — Astro SSR throughout.

## Critical Implementation Details

**Contacts are append-only — no `updated_at` column or trigger.** Do not apply `handle_updated_at` to this table. The reusable `public.handle_updated_at()` function is for tables that update rows; contacts are only inserted and deleted.

**RLS on contacts uses the subquery ownership pattern.** The `contacts` table has no `user_id` column. Ownership flows through `listing_id → listings.user_id`. Copy the `EXISTS` subquery from `price_history`'s migration verbatim.

---

## Phase 1: Contacts database migration

### Overview

Creates the `contacts` table as a child of `listings`: hard FK with `ON DELETE CASCADE`, nullable `role` with a CHECK constraint, subquery RLS ownership policy, and no `updated_at` trigger.

### Changes Required

#### 1. Contacts migration file

**File**: `supabase/migrations/<timestamp>_create_contacts.sql`

> Create via CLI to get the correct timestamp: `npx supabase migration new create_contacts`. Copy the schema below into the generated file.

**Intent**: Establish the `contacts` table as the child of `listings` for this slice. The schema must be final from the start — S-06 (transaction close) may query contacts when verifying interested parties before closing a deal.

**Contract**: Extension declaration at top: `create extension if not exists "pgcrypto" with schema extensions;`

Table `contacts` with columns:

| Column | Type | Constraint |
|---|---|---|
| `id` | `uuid` | PK, default `extensions.gen_random_uuid()` |
| `listing_id` | `uuid NOT NULL` | FK → `listings(id)` ON DELETE CASCADE |
| `name` | `text NOT NULL` | — |
| `phone` | `text` | nullable |
| `email` | `text` | nullable |
| `role` | `text` | nullable, CHECK `role IN ('kupujący', 'najemca')` |
| `created_at` | `timestamptz NOT NULL` | default `now()` |

RLS: `ALTER TABLE contacts ENABLE ROW LEVEL SECURITY`. Policy named `owners_own_contacts`, `FOR ALL`, subquery:

```sql
exists (
  select 1 from listings
  where listings.id = contacts.listing_id
    and listings.user_id = auth.uid()
)
```

Same expression in both `USING` and `WITH CHECK` clauses. No trigger, no function definition.

### Success Criteria

#### Automated Verification

- Migration applies without errors: `npx supabase db push`
- Migration file tracked in git: `git status supabase/migrations/` shows the new file

#### Manual Verification

- `contacts` table visible in Supabase Studio → Table Editor with all 7 columns
- RLS enabled: Studio → Authentication → Policies → contacts shows one policy named `owners_own_contacts`
- `role` CHECK constraint: inserting `role = 'invalid'` from Studio returns a constraint violation

**Implementation Note**: Manually verify the RLS subquery before Phase 2 — insert a contact for user A's listing, then confirm user B cannot SELECT it.

---

## Phase 2: Server data layer

### Overview

TypeScript contact type, create API route, and delete API route — all following the established pattern from the pricing slice.

### Changes Required

#### 1. TypeScript types

**File**: `src/types/contacts.ts` *(new file)*

**Intent**: Single source of truth for the Contact shape — used by the API routes and the contacts page.

**Contract**: Export `ContactRole = 'kupujący' | 'najemca'` and interface `Contact` with all 7 columns matching the DB (`phone`, `email`, `role` as `string | null`).

#### 2. Create contact API route

**File**: `src/pages/api/listings/[id]/contacts/create.ts` *(new file)*

**Intent**: Accept a form POST from the contacts page; validate name is non-empty and role (if provided) is a known value; insert a contact row linked to the listing; redirect back.

**Contract**: `export const POST: APIRoute`. Reads `context.params.id` as `listing_id`. Creates the Supabase client via `createClient(context.request.headers, context.cookies)` — if null, redirect to `/dashboard?error=blad-konfiguracji` (matching the guard pattern in `price/set.ts`). Auth check via `supabase.auth.getUser()` — redirect to `/auth/signin` if absent. Parses form data:
- `name`: required, `.trim()`; if empty redirect to `/dashboard/listings/${id}/contacts?error=nazwa-wymagana`
- `phone`: optional, `.trim() || null`
- `email`: optional, `.trim() || null`
- `role`: optional — if non-empty, validate against `['kupujący', 'najemca']`; invalid → redirect with `?error=rola-nieprawidlowa`; empty string → `null`

Inserts into `contacts` with `listing_id`. RLS enforces ownership at the DB level. On DB error: redirect with `?error=blad-zapisu` (not raw `error.message`). On success: redirect to `/dashboard/listings/${id}/contacts`.

#### 3. Delete contact API route

**File**: `src/pages/api/listings/[id]/contacts/[contactId]/delete.ts` *(new file)*

**Intent**: Hard-delete a specific contact that belongs to a listing owned by the current user; redirect back to the contacts page.

**Contract**: `export const POST: APIRoute`. Reads `context.params.id` (listing_id) and `context.params.contactId`. Creates the Supabase client — if null, redirect to `/dashboard?error=blad-konfiguracji`. Auth check via `supabase.auth.getUser()` — redirect to `/auth/signin` if absent. Delete: `.from('contacts').delete().eq('id', contactId).eq('listing_id', id)`. RLS additionally enforces ownership. Idempotent — 0 rows deleted is not an error (mirrors listing delete). Leave an inline comment at the `.delete()` call: `// Intentionally no .select() — idempotent delete, 0-row result is not an error. (contact-management plan Phase 2.)` On DB error: redirect with `?error=blad-usuniecia`. On success or not-found: redirect to `/dashboard/listings/${id}/contacts`.

### Success Criteria

#### Automated Verification

- `npm run build` completes without TypeScript errors
- `npm run lint` passes

#### Manual Verification

- POST to create route with `name=Jan Kowalski` inserts a row in Supabase Studio and redirects to the contacts page
- POST with empty `name` redirects with `?error=nazwa-wymagana`
- POST to delete route removes the row; row gone in Studio; cross-user delete leaves the row intact

**Implementation Note**: Test with a real authenticated browser session — API routes that call `getUser()` require a valid session cookie.

---

## Phase 3: Contacts page and ListingCard link

### Overview

Single Astro page at `/dashboard/listings/[id]/contacts` with the add-contact form at the top and the contact list below. ListingCard gets a 'Kontakty' link in the existing action bar.

### Changes Required

#### 1. Contacts page

**File**: `src/pages/dashboard/listings/[id]/contacts.astro` *(new file)*

**Intent**: One-stop page for adding and viewing contacts for a listing — mirrors the layout of `pricing.astro` (form + data on one page).

**Contract**: Reads `Astro.params.id`. Creates the Supabase client via `createClient(Astro.request.headers, Astro.cookies)`. Gate all data fetching behind `if (!id || !supabase)` — if either is missing/null, render a `<Banner variant="error">` and return early (matching `pricing.astro`). Fetches authenticated user — redirect to `/auth/signin` if absent. Fetches the listing via `.single<Listing>()` filtered by `id` and `user_id = user.id`: if `fetchError && fetchError.code !== 'PGRST116'` → render a DB error Banner; if `!listing` (PGRST116 = no rows, or wrong user) → redirect to `/dashboard`. Fetches contacts: `const { data: contacts, error: contactsError } = await supabase.from('contacts').select('*').eq('listing_id', id).order('created_at', { ascending: true }).limit(100)` — if `contactsError`, render a `<Banner variant="error">` (do not silently fall through to an empty list). Ordering and limit pushed to the DB query.

Displays `Astro.url.searchParams.get('error')` as a `<Banner variant="error">` if present.

Page layout:
- Page title (both `<title>` and `<h1>`): `Kontakty — {listing.address}`
- Back link to `/dashboard`
- **Add contact form**: `method="POST" action="/api/listings/{id}/contacts/create"`. Fields:
  - `name`: `<input type="text" required>`, label `'Imię i nazwisko'`
  - `phone`: `<input type="text">`, label `'Telefon'`
  - `email`: `<input type="text">`, label `'E-mail'`
  - `role`: `<select name="role">` with options: `value=""` → `'— (nie dotyczy)'`, `value="kupujący"` → `'Kupujący'`, `value="najemca"` → `'Najemca'`
  - Submit: `'Dodaj kontakt'`
- **Contact list**: if `contacts.length === 0`, show `'Brak kontaktów dla tego ogłoszenia.'`. Otherwise, a table with columns: Imię i nazwisko, Rola, Telefon, E-mail, (delete). Role cell: `'Kupujący'` / `'Najemca'` / `'—'` for null. Delete: `<form method="POST" action="/api/listings/{id}/contacts/{contact.id}/delete"><button onclick="return confirm('Czy na pewno chcesz usunąć ten kontakt? Tej operacji nie można cofnąć.')">Usuń</button></form>`.

All user-visible text in Polish. No `client:*` directives — static Astro component.

#### 2. ListingCard link update

**File**: `src/components/listings/ListingCard.astro`

**Intent**: Give agents one-click access to the contacts page from the main dashboard, consistent with the existing 'Edytuj' and 'Cena i prowizja' links.

**Contract**: Add `<a href="/dashboard/listings/{listing.id}/contacts">Kontakty</a>` to the action bar. Match the existing link styling used by 'Edytuj' and 'Cena i prowizja'.

### Success Criteria

#### Automated Verification

- `npm run build` succeeds with no TypeScript errors or missing imports
- `npm run lint` passes

#### Manual Verification

- Dashboard card shows a 'Kontakty' link for each listing alongside the existing action links
- Clicking 'Kontakty' opens `/dashboard/listings/[id]/contacts` with the listing address in the heading
- Contacts page shows add form and Polish empty state when no contacts exist
- Adding a contact with name only → appears in list with '—' for role, phone, email
- Adding a contact with all fields → appears correctly with role in Polish ('Kupujący' or 'Najemca')
- Adding with empty name → Banner error shown; no contact created
- 'Usuń' shows Polish confirmation; cancelling leaves contact; confirming removes it
- Contact list is ordered chronologically (oldest first — add two, verify order)
- All page text is in Polish; page auto-protected by middleware (no manual route guarding needed)

**Implementation Note**: Add at least two contacts and verify chronological ordering before marking this phase done.

---

## Testing Strategy

### Manual Testing Steps

1. `npx supabase db push` — no errors; verify `contacts` table in Supabase Studio with 7 columns
2. `npm run dev`
3. Dashboard → click 'Kontakty' on a listing card → contacts page loads with Polish heading and empty state
4. Add contact: 'Jan Kowalski', phone '123 456 789', email 'jan@example.com', role 'Kupujący' → contact appears in list
5. Add contact: 'Anna Nowak', name only → appears with '—' for role/phone/email
6. Attempt to add with empty name → Banner error `nazwa-wymagana` shown, no new row in Studio
7. Delete 'Jan Kowalski': Polish confirmation → cancel → contact stays; confirm → contact gone
8. Verify contacts appear in chronological order (Jan Kowalski first, Anna Nowak second)
9. `npm run build` — no TypeScript errors

### Unit Tests

No unit tests — consistent with prior slices; manual verification is the acceptance gate.

## Performance Considerations

`.limit(100)` on the contacts query prevents unbounded fetches. For a single-agent MVP with one or a few active listings, this ceiling will never be approached.

## References

- Roadmap: `context/foundation/roadmap.md` — S-04 (contact-management), FR-013, FR-014
- RLS subquery pattern: `supabase/migrations/20260529120000_create_pricing_and_commission.sql`
- API route pattern: `src/pages/api/listings/[id]/price/set.ts`
- Page layout pattern: `src/pages/dashboard/listings/[id]/pricing.astro`
- Card action bar: `src/components/listings/ListingCard.astro`
- Supabase client: `src/lib/supabase.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Contacts database migration

#### Automated

- [ ] 1.1 Migration applies without errors: `npx supabase db push`
- [x] 1.2 Migration file tracked in git: `git status supabase/migrations/` shows the new file — 21f3b61

#### Manual

- [ ] 1.3 contacts table visible in Supabase Studio with all 7 columns
- [ ] 1.4 RLS enabled and policy `owners_own_contacts` visible in Authentication → Policies → contacts
- [ ] 1.5 role CHECK constraint rejects invalid values

### Phase 2: Server data layer

#### Automated

- [x] 2.1 `npm run build` completes without TypeScript errors — 1ee3230
- [x] 2.2 `npm run lint` passes — 7f87435  <!-- Scope = contact-management files: contacts.astro + both API routes + types lint clean (no crash). Repo-wide `npm run lint` still red on pre-existing S-03 errors (pricing.astro:44 prettier parse error + non-null-assertions; commission/set.ts prettier) — out of scope, tracked separately. -->

#### Manual

- [ ] 2.3 POST to create route with valid name inserts a row and redirects to contacts page
- [ ] 2.4 POST with empty name redirects with `?error=nazwa-wymagana`
- [ ] 2.5 POST to delete route removes the row; cross-user delete has no effect

### Phase 3: Contacts page and ListingCard link

#### Automated

- [x] 3.1 `npm run build` succeeds with no TypeScript errors or missing imports — 3de04f8
- [x] 3.2 `npm run lint` passes — 7f87435  <!-- See 2.2 note: contact-management files lint clean; pre-existing S-03 pricing/commission errors are out of scope. -->

#### Manual

- [ ] 3.3 Dashboard card shows 'Kontakty' link alongside existing action links
- [ ] 3.4 Contacts page loads with Polish heading and empty state message
- [ ] 3.5 Adding contact with all fields shows correctly in list (Polish role labels)
- [ ] 3.6 Adding contact with empty name shows Banner error; no contact created
- [ ] 3.7 Delete shows Polish confirmation; confirming removes the contact
- [ ] 3.8 Contact list displays in chronological order (oldest first)
