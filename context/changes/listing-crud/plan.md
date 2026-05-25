# Listing Dashboard CRUD — Implementation Plan

## Overview

Replace the placeholder `/dashboard` with full listing management: create, edit, delete, and view property listings (sprzedaż / najem okazjonalny) with owner contact data. This is the first real data slice — every later slice (pricing, contacts, documents, transaction close) depends on the `listings` table created here.

## Current State Analysis

- Auth layer complete (S-01): sessions, middleware, and `/dashboard*` protected routes all working
- `dashboard.astro`: placeholder showing only the user's email + logout button
- Supabase client configured (`src/lib/supabase.ts`) but no application tables exist yet — no migrations in `supabase/`
- Established API pattern: Astro API route (`src/pages/api/*`) + HTML form POST + redirect on success/failure
- No `src/types/` directory; no listing-related components or API routes exist
- shadcn/ui wired (`components.json`); only `button.tsx` present — new UI components follow the `src/components/ui/` convention
- `Layout.astro` has `lang="en"` — must be corrected to `lang="pl"` (PRD Polish-language guardrail)

## Desired End State

A logged-in agent can:
- See all their listings as a card grid on `/dashboard` (empty state when none)
- Create a new listing at `/dashboard/listings/new` — pick type, enter address, optionally record owner name/phone/email
- Edit any listing's type, address, and owner data
- Delete a listing after a Polish confirmation prompt
- All visible UI strings are in Polish

### Key Discoveries

- API routes follow the auth pattern: named export `POST: APIRoute`, reads `formData()`, redirects on success, redirects with `?error=…` on failure — see `src/pages/api/auth/signin.ts:4`
- `createClient(Astro.request.headers, Astro.cookies)` is correct in both API routes and Astro pages (same factory signature) — `src/lib/supabase.ts:4`
- Middleware protects all `/dashboard*` paths via `startsWith` — new sub-routes are automatically protected without touching `src/middleware.ts`
- Error display pattern: Astro pages read `Astro.url.searchParams.get('error')` — used in the auth pages already
- `supabase` devDependency is `^2.23.4` in `package.json` — CLI already available for migrations

## What We're NOT Doing

- Not creating contacts, price history, commission, document, or file tables — those are S-03 through S-05
- Not implementing the "done" status transition — that is S-06's transaction-close gate
- Not adding listing photos — S-05
- Not adding Zod validation — basic JS checks are sufficient here; Zod is introduced in S-03 for commission arithmetic
- Not soft-deleting listings — hard delete with confirmation; PRD doesn't require a recycle bin for this action

## Implementation Approach

Server-side Astro SSR throughout — no client-side state management or React islands needed for this slice. Three phases: (1) Supabase migration creating the `listings` table with RLS and auto-`updated_at`; (2) TypeScript types + three API routes (create/update/delete); (3) dashboard overhaul, listing card component, new listing page, and edit listing page.

## Critical Implementation Details

**RLS must be explicitly enabled.** `ALTER TABLE listings ENABLE ROW LEVEL SECURITY` is required; without it every row is readable by any authenticated user regardless of `user_id`. Verify in Supabase Studio: Authentication → Policies → listings shows the policy.

**Redirect-on-error pattern.** API routes redirect to the form page with `?error=<encoded message>` on failure (validation, DB error). The form pages read `Astro.url.searchParams.get('error')` and display the error inline — do not return a JSON error body or a non-redirect response.

**Ownership at the query level.** Delete and update queries should chain `.eq('user_id', user.id)` in addition to RLS, so a missing RLS policy never silently allows cross-user mutation.

---

## Phase 1: Listings database migration

### Overview

Creates the `listings` table with all columns S-02 needs: listing type and status with CHECK constraints, a freetext address field, three nullable owner columns, timestamps, and a `BEFORE UPDATE` trigger that keeps `updated_at` current. Row-Level Security is enabled and a single policy allows each user full access to only their own rows.

### Prerequisites

If the Supabase project has not yet been linked in this environment, run this first (link state is stored in `.supabase/`, which is gitignored, and persists across sessions):

```bash
npx supabase link --project-ref <ref>
```

Find `<ref>` in Supabase dashboard → Project Settings → General → Reference ID.

### Changes Required

#### 1. Listings migration file

**File**: `supabase/migrations/<timestamp>_create_listings.sql`

> Create via CLI — the timestamp is set automatically: `npx supabase migration new create_listings`. Copy the schema below into the generated file.

**Intent**: Establish the `listings` table as the single source of truth for all listing data in S-02. The schema must be correct from the start — downstream slices add foreign keys to this table.

**Contract**: Table `listings` with columns:

| Column | Type | Constraint |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid NOT NULL` | FK → `auth.users(id)` ON DELETE CASCADE |
| `type` | `text NOT NULL` | CHECK `IN ('sale', 'occasional-rental')` |
| `status` | `text NOT NULL` | CHECK `IN ('active', 'done')`, default `'active'` |
| `address` | `text NOT NULL` | — |
| `owner_name` | `text` | nullable |
| `owner_phone` | `text` | nullable |
| `owner_email` | `text` | nullable |
| `created_at` | `timestamptz NOT NULL` | default `now()` |
| `updated_at` | `timestamptz NOT NULL` | default `now()` |

RLS: `ALTER TABLE listings ENABLE ROW LEVEL SECURITY`. Policy: `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`.

Trigger: `BEFORE UPDATE FOR EACH ROW` sets `NEW.updated_at = now()`. Define the function as `CREATE OR REPLACE FUNCTION handle_updated_at()` so it is idempotent on re-runs and fresh environments. Name it `handle_updated_at` — later migrations that need the same trigger reuse this function without redefining it.

### Success Criteria

#### Automated Verification

- Migration applies without errors: `npx supabase db push`
- Migration file is tracked in git: `git status supabase/migrations/` shows the new file

#### Manual Verification

- `listings` table visible in Supabase Studio → Table Editor with all 10 columns
- RLS enabled: Studio → Authentication → Policies → listings shows one policy
- `type` CHECK constraint: inserting `type = 'invalid'` from Studio returns a constraint violation

**Implementation Note**: Verify RLS manually before moving to Phase 2 — a missing policy silently exposes data.

---

## Phase 2: Server data layer

### Overview

TypeScript type definitions for listing data, plus three Astro API routes — create, update, and delete — following the existing form-POST-and-redirect pattern established in the auth routes.

### Changes Required

#### 1. TypeScript types

**File**: `src/types/listings.ts` *(new file)*

**Intent**: Single source of truth for the Listing shape — used by API routes, Astro pages, and the card component.

**Contract**: Export `ListingType = 'sale' | 'occasional-rental'`, `ListingStatus = 'active' | 'done'`, and interface `Listing` matching the DB columns (all fields, `owner_*` as `string | null`).

#### 2. Create API route

**File**: `src/pages/api/listings/create.ts` *(new file)*

**Intent**: Accept a form POST from the new-listing page; validate required fields; insert a row for the authenticated user; redirect to `/dashboard` on success.

**Contract**: `export const POST: APIRoute`. Reads `context.request.formData()`. Gets the authenticated user via `supabase.auth.getUser()` — redirect to `/auth/signin` if no user. Required fields: `type` (must be `'sale'` or `'occasional-rental'`), `address` (non-empty). On validation failure: redirect to `/dashboard/listings/new?error=<encoded message>`. Inserts row with `user_id = user.id`. On DB error: redirect to `/dashboard/listings/new?error=<encoded message>`. On success: redirect to `/dashboard`.

#### 3. Update API route

**File**: `src/pages/api/listings/[id]/update.ts` *(new file)*

**Intent**: Accept a form POST from the edit page; update the matching listing if it belongs to the current user; redirect to `/dashboard`.

**Contract**: `export const POST: APIRoute`. Reads `context.params.id`. Same field validation as create. Supabase `UPDATE … WHERE id = params.id AND user_id = user.id`. If the update affects 0 rows (listing not found or not owned), redirect to `/dashboard?error=<encoded message>`. On success: redirect to `/dashboard`.

#### 4. Delete API route

**File**: `src/pages/api/listings/[id]/delete.ts` *(new file)*

**Intent**: Accept a form POST from the card's delete form; hard-delete the row; redirect to `/dashboard`. No body parameters needed.

**Contract**: `export const POST: APIRoute`. Reads `context.params.id`. Supabase `DELETE … WHERE id = params.id AND user_id = user.id`. On success or 0 rows affected: redirect to `/dashboard` (idempotent — double-delete is not an error). On DB error: redirect to `/dashboard?error=<encoded message>`.

### Success Criteria

#### Automated Verification

- `npm run build` completes without TypeScript errors
- `npm run lint` passes with no new violations

#### Manual Verification

- POST to `/api/listings/create` with `type=sale&address=ul.+Testowa+1%2C+Warszawa` inserts a row in Supabase Studio and redirects to `/dashboard`
- POST to `/api/listings/[id]/update` with a valid id updates the row
- POST to `/api/listings/[id]/delete` removes the row; the row is gone in Studio

**Implementation Note**: Test with a real authenticated session (use the browser with a logged-in cookie) — API routes that call `getUser()` require a valid session cookie.

---

## Phase 3: Dashboard and listing pages

### Overview

Replaces the placeholder dashboard with a listing card grid. Adds create and edit form pages. Fixes the HTML `lang` attribute. All user-visible text is in Polish.

### Changes Required

#### 1. Layout lang fix

**File**: `src/layouts/Layout.astro`

**Intent**: Satisfy the PRD Polish-language guardrail — the page must declare `lang="pl"`.

**Contract**: Change `<html lang="en">` to `<html lang="pl">` on line 14.

#### 2. Listing card component

**File**: `src/components/listings/ListingCard.astro` *(new file)*

**Intent**: Render a single listing as a card. Shows address as the heading, type badge, status badge, owner name (if set), and two action controls: Edit link and Delete form.

**Contract**: Props: `listing: import('@/types/listings').Listing`. Type badge labels: `'sale'` → `'Sprzedaż'`, `'occasional-rental'` → `'Najem okazjonalny'`. Status badge labels: `'active'` → `'Aktywne'`, `'done'` → `'Ukończone'`. Edit: `<a href="/dashboard/listings/{listing.id}/edit">`. Delete: `<form method="POST" action="/api/listings/{listing.id}/delete"><button onclick="return confirm('Czy na pewno chcesz usunąć to ogłoszenie? Tej operacji nie można cofnąć.')">Usuń</button></form>`. No client-side hydration (`client:*` directive) — this is a static Astro component.

#### 3. Dashboard page overhaul

**File**: `src/pages/dashboard.astro`

**Intent**: Replace placeholder content with a functioning listing dashboard: page heading, "Nowe ogłoszenie" button, card grid of existing listings, empty state message.

**Contract**: Fetch `listings` from Supabase ordered by `created_at DESC`. Sort the fetched array in the Astro frontmatter (server-side) before rendering: active listings first, then done. If `supabase` is null, show an error banner (reuse the existing `<Banner>` component). If `listings.length === 0`, show empty state: `'Brak ogłoszeń. Dodaj pierwsze ogłoszenie.'` with a link to `/dashboard/listings/new`. Grid renders one `<ListingCard>` per listing. "Nowe ogłoszenie" button: `<a href="/dashboard/listings/new">`. Display any `?error=` query param as an error message above the grid.

#### 4. New listing page

**File**: `src/pages/dashboard/listings/new.astro` *(new file)*

**Intent**: Full-page form for creating a listing. POSTs to `/api/listings/create` on submit.

**Contract**: Form with `method="POST" action="/api/listings/create"`. Fields:
- `type`: radio inputs or `<select>` — options `value="sale"` label `'Sprzedaż'` and `value="occasional-rental"` label `'Najem okazjonalny'`; required
- `address`: `<input type="text" name="address">` — required; label `'Adres nieruchomości'`
- `owner_name`: optional; label `'Imię i nazwisko właściciela'`
- `owner_phone`: optional; label `'Telefon właściciela'`
- `owner_email`: optional; `type="email"`; label `'E-mail właściciela'`

Shows `Astro.url.searchParams.get('error')` as an inline error message if present. "Powrót" back link to `/dashboard`. Page title: `'Nowe ogłoszenie'`.

#### 5. Edit listing page

**File**: `src/pages/dashboard/listings/[id]/edit.astro` *(new file)*

**Intent**: Same form as the new listing page, pre-populated with the existing listing's data. POSTs to `/api/listings/{id}/update`.

**Contract**: Reads `Astro.params.id`. Fetches the listing: `SELECT * FROM listings WHERE id = params.id AND user_id = user.id`. If not found (listing doesn't exist or belongs to another user): `return Astro.redirect('/dashboard')`. Form `action="/api/listings/{Astro.params.id}/update"`. All fields pre-filled with the listing's current values (`value={listing.address}`, etc.). Shows `?error=` if present. Page title: `'Edytuj ogłoszenie'`.

### Success Criteria

#### Automated Verification

- `npm run build` succeeds with no TypeScript errors and no missing Astro component imports
- `npm run lint` passes

#### Manual Verification

- Dashboard loads with "Nowe ogłoszenie" button and Polish empty state (no listings yet)
- Create form: fill type + address + owner → submit → redirected to dashboard with new card
- Card displays: address as heading, type label in Polish, "Aktywne" status badge, owner name
- Edit link opens pre-filled form; changing address → save → dashboard shows updated address
- Delete: clicking "Usuń" shows Polish confirm dialog; cancel → listing stays; confirm → listing gone from dashboard
- All page text is in Polish; no English strings visible
- `lang="pl"` in the `<html>` tag of every page

**Implementation Note**: Test the delete flow both with the confirm dialog confirmed and cancelled before marking this phase done.

---

## Testing Strategy

### Manual Testing Steps

1. Run `npx supabase db push` — confirm no errors; verify table in Supabase Studio
2. Start dev server: `npm run dev`
3. Log in → navigate to `/dashboard` — "Brak ogłoszeń" empty state shown, "Nowe ogłoszenie" button visible
4. Create listing: type `'Sprzedaż'`, address `'ul. Testowa 1, Warszawa'`, owner `'Jan Kowalski'` → submit → card appears on dashboard
5. Card shows: `'ul. Testowa 1, Warszawa'`, `'Sprzedaż'` badge, `'Aktywne'` badge, `'Jan Kowalski'`
6. Click Edit → form pre-filled → change address to `'ul. Nowa 5, Kraków'` → save → dashboard shows updated address
7. Create a second listing of type `'Najem okazjonalny'` → both cards visible; active listings shown before any done listings
8. Click Delete on first listing → Polish confirm dialog → cancel → listing stays
9. Click Delete → confirm → listing disappears
10. View page source → `<html lang="pl">` confirmed
11. `npm run build` — no errors

### Unit Tests

No unit tests in this slice — the pattern is not established in the codebase yet and the PRD doesn't require a test suite for MVP. Manual verification is the acceptance gate.

## Migration Notes

The `handle_updated_at()` function defined in this migration is reusable. Later slices that need `updated_at` auto-update (e.g., when a `commission_settings` table is added in S-03) should `CREATE TRIGGER … EXECUTE FUNCTION handle_updated_at()` without redefining the function.

## References

- Roadmap: `context/foundation/roadmap.md` — S-02 (listing-crud), FR-003, FR-004, FR-006, FR-008
- Auth API pattern to follow: `src/pages/api/auth/signin.ts`
- Supabase client factory: `src/lib/supabase.ts`
- Middleware (protected routes): `src/middleware.ts`
- Layout component: `src/layouts/Layout.astro`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Listings database migration

#### Automated

- [x] 1.1 Migration applies without errors: `npx supabase db push` — d3dd114
- [x] 1.2 Migration file tracked in git: `git status supabase/migrations/` — d3dd114

#### Manual

- [x] 1.3 listings table visible in Supabase Studio with all 10 columns — d3dd114
- [x] 1.4 RLS enabled and policy visible in Authentication → Policies → listings — d3dd114
- [x] 1.5 type CHECK constraint rejects invalid values — d3dd114

### Phase 2: Server data layer

#### Automated

- [x] 2.1 `npm run build` completes without TypeScript errors — b3b58fe
- [x] 2.2 `npm run lint` passes with no new violations — b3b58fe

#### Manual

- [x] 2.3 POST to `/api/listings/create` inserts a row and redirects to `/dashboard` — b3b58fe
- [x] 2.4 POST to `/api/listings/[id]/update` updates the correct row — b3b58fe
- [x] 2.5 POST to `/api/listings/[id]/delete` removes the row; cross-user delete has no effect — b3b58fe

### Phase 3: Dashboard and listing pages

#### Automated

- [x] 3.1 `npm run build` succeeds with no TypeScript errors or missing imports — 4e56763
- [x] 3.2 `npm run lint` passes — 4e56763

#### Manual

- [x] 3.3 Dashboard shows "Nowe ogłoszenie" button and Polish empty state — 4e56763
- [x] 3.4 Creating a listing saves it and shows a card with correct data in Polish — 4e56763
- [x] 3.5 Editing pre-fills the form and saves changes correctly — 4e56763
- [x] 3.6 Delete shows Polish confirmation; confirming removes the listing from the dashboard — 4e56763
- [x] 3.7 All UI text is in Polish; `lang="pl"` in page HTML source — 4e56763
