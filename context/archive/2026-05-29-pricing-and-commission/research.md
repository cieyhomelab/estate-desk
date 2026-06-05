---
date: 2026-05-29T00:00:00+02:00
researcher: claude-sonnet-4-6
git_commit: 88d00b5e831ccbfd3cd294d0464b4c6a8fa696db
branch: main
repository: estate-desk
topic: "S-03 pricing-and-commission: impl-review compatibility check + readiness assessment"
tags: [research, codebase, pricing, commission, s-03, listing-crud, impl-review]
status: complete
last_updated: 2026-05-29
last_updated_by: claude-sonnet-4-6
---

# Research: S-03 Pricing and Commission — Readiness Assessment

**Date**: 2026-05-29
**Researcher**: claude-sonnet-4-6
**Git Commit**: [88d00b5](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/)
**Branch**: main
**Repository**: cieyhomelab/estate-desk

## Research Question

> Review codebase and decide whether `context/changes/listing-crud/reviews/impl-review.md` is compatible with it. Want to implement S-03 from `context/foundation/roadmap.md`.

Two concrete questions:
1. Are all 8 fixes from the S-02 impl-review actually applied in the codebase?
2. Is the codebase ready to begin planning S-03 (pricing-and-commission)?

---

## Summary

**impl-review: 100% compatible.** All 8 findings (F1–F8) are present and correctly implemented. The listing-crud codebase matches the review document exactly.

**S-03: unblocked and ready to plan.** Both dependencies are met: S-02 (listing-crud) is complete and impl-reviewed; F-01 (database-schema) has the `listings` table in production-ready shape. The only tables S-03 needs (`price_history`, `commission_settings`) do not exist yet and require a new migration — which is expected and fully in scope.

One open question must be resolved at `/10x-plan` time: the exact commission calculation formula. The PRD §Business Logic describes it semantically; the roadmap explicitly flags it as needing stakeholder confirmation before implementation.

---

## Detailed Findings

### Part 1: impl-review Compatibility — All 8 Findings Verified

| Finding | Description | Status | Location |
|---------|-------------|--------|----------|
| F1 | `handle_updated_at()` has `set search_path = ''` + `pg_catalog.now()` | ✅ VERIFIED | [migration:28-37](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/supabase/migrations/20260525152607_create_listings.sql#L28) |
| F2 | `create extension if not exists "pgcrypto"` at top of migration | ✅ VERIFIED | [migration:3](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/supabase/migrations/20260525152607_create_listings.sql#L3) |
| F3 | `edit.astro` destructures `{ data, error }`, handles PGRST116 separately | ✅ VERIFIED | [edit.astro:18-28](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/src/pages/dashboard/listings/%5Bid%5D/edit.astro#L18) |
| F4 | ESLint `no-misused-promises` disable narrowed to only `edit.astro` | ✅ VERIFIED | [eslint.config.js:76-81](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/eslint.config.js#L76) |
| F5 | `delete.ts` has inline comment documenting intentional idempotent delete | ✅ VERIFIED | [delete.ts:22-24](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/src/pages/api/listings/%5Bid%5D/delete.ts#L22) |
| F6 | Empty-state is single `<a>` wrapping verbatim plan copy | ✅ VERIFIED | [dashboard.astro:51-57](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/src/pages/dashboard.astro#L51) |
| F7 | Fetch uses `.order("status").order("created_at").limit(100)`, no JS sort | ✅ VERIFIED | [dashboard.astro:16-22](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/src/pages/dashboard.astro#L16) |
| F8 | Auth (createClient + getUser) comes before field validation in create.ts and update.ts | ✅ VERIFIED | [create.ts:4-15](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/src/pages/api/listings/create.ts#L4), [update.ts:4-20](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/src/pages/api/listings/%5Bid%5D/update.ts#L4) |

The codebase matches the impl-review in full. No fixes are missing or partially applied.

---

### Part 2: Current Database Schema

One migration file exists: `supabase/migrations/20260525152607_create_listings.sql`

**Table `listings`** — the only application table currently in the DB:

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` default |
| `user_id` | UUID NOT NULL | FK → `auth.users(id)` ON DELETE CASCADE |
| `type` | TEXT NOT NULL | CHECK IN ('sale', 'occasional-rental') |
| `status` | TEXT NOT NULL | default 'active', CHECK IN ('active', 'done') |
| `address` | TEXT NOT NULL | |
| `owner_name` | TEXT | nullable |
| `owner_phone` | TEXT | nullable |
| `owner_email` | TEXT | nullable |
| `created_at` | TIMESTAMPTZ NOT NULL | default `now()` |
| `updated_at` | TIMESTAMPTZ NOT NULL | auto-updated by trigger |

RLS enabled with single `owners_own_listings` policy: `FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`.

Trigger function `handle_updated_at()` is declared as `CREATE OR REPLACE` — **reusable by S-03 migrations without redeclaring**.

**Tables required by S-03 but not yet created:**

| Table | Purpose | Notes |
|-------|---------|-------|
| `price_history` | Append-only log of asking price changes per listing | listing_id FK, price, set_at |
| `commission_settings` | Per-user commission split rates | user_id FK, tax_rate, agency_percent |

A new migration is required. This is fully expected — the roadmap split database work across slices.

---

### Part 3: Commission Formula (PRD §Business Logic)

From `context/foundation/prd.md` (Business Logic section):

> "given a total commission amount entered by the agent and split percentages configured in account settings, the app computes gross income (commission minus agency portion), tax provision (percentage of gross income), and agent net (gross income minus tax provision). The split must sum to the entered total; any rounding difference surfaces as a validation error, not a silent adjustment."

Derived formula:

```
total          = entered by agent (e.g. 10 000 zł)
agency_portion = total × agency_percent       (e.g. 10 000 × 0.50 = 5 000 zł)
gross_income   = total − agency_portion        (e.g. 10 000 − 5 000 = 5 000 zł)
tax_provision  = gross_income × tax_rate       (e.g. 5 000 × 0.25 = 1 250 zł)
agent_net      = gross_income − tax_provision  (e.g. 5 000 − 1 250 = 3 750 zł)

Validation: agency_portion + tax_provision + agent_net === total  (must be exact)
```

**Open question (roadmap.md:126):** The roadmap explicitly flags the formula order as needing confirmation before implementation: *"Czy kolejność i podstawa wyliczeń... to: prowizja brutto → rezerwa podatkowa (% brutto) → część agencji (% brutto) → część agenta (brutto − podatek − agencja)?"*

The PRD Business Logic above implies a different basis: `tax_provision` is `% of gross_income` (i.e., what agent receives), not `% of total`. This must be confirmed at `/10x-plan` with the user before any implementation. The formula above is the most literal reading of the PRD prose — but the roadmap open-question suggests the agent may intend `% of total` for both `tax_provision` and `agency_portion`.

**Critical PRD guardrail:** No silent rounding. Any fractional grosz discrepancy must surface as a validation error. Plan should specify whether computation is in float (with epsilon check) or integer cents.

---

### Part 4: Established Code Patterns for S-03 to Follow

#### API routes (`src/pages/api/*/`)

Canonical pattern established by create.ts / update.ts / delete.ts:

```
1. createClient(context.request.headers, context.cookies)  → null check → redirect on null
2. supabase.auth.getUser()  → redirect to /auth/signin if !user
3. context.request.formData()  → extract fields
4. validate fields  → redirect with ?error= on failure
5. supabase mutation  → .eq('user_id', user.id) for ownership (defense-in-depth beyond RLS)
6. handle error  → redirect with ?error=
7. redirect to success destination
```

All mutations return `context.redirect(...)` — no JSON responses in the current codebase.

#### Astro pages (`src/pages/dashboard/*/`)

```
1. createClient(Astro.request.headers, Astro.cookies)
2. supabase.auth.getUser()  → middleware already guards /dashboard/* but pages re-check for data fetch
3. supabase.from("table").select("*").order(...).limit(100)  ← always both order and limit
4. destructure { data, error }  ← never cast away error
5. if PGRST116 → redirect("/dashboard")  ← not found
6. if other error → redirect("/dashboard?error=...")
7. Astro.url.searchParams.get("error")  → render Banner if present
```

#### Forms

Plain HTML `<form method="POST" action="/api/...">`. No client-side JS form libraries. Tailwind only for styling. All text in Polish.

#### TypeScript types

Centralized in `src/types/`. Mirror DB column names. Nullable columns typed as `string | null`. Timestamp columns typed as `string` (ISO string from Supabase).

#### Supabase client

`createClient(requestHeaders: Headers, cookies: AstroCookies)` — returns `null` if env vars missing. Same factory for both pages and API routes. Env vars: `SUPABASE_URL`, `SUPABASE_KEY` via `astro:env/server`.

#### Middleware

`/dashboard` and all sub-routes are protected automatically. New S-03 pages at `/dashboard/settings/commission` and `/dashboard/listings/[id]/pricing` are protected with no additional middleware changes needed.

#### Migration conventions (from lessons.md)

- Declare extensions at top: `create extension if not exists "pgcrypto" with schema extensions;`
- Every `CREATE FUNCTION` must include `set search_path = ''` and fully qualify built-ins (`pg_catalog.now()`)
- `handle_updated_at()` is already defined as `CREATE OR REPLACE` — attach it to new tables with a new trigger declaration (no need to redefine the function)
- Enable RLS on every table; write explicit ownership policies

---

### Part 5: S-03 Directory Structure (Proposed)

Based on the patterns above, S-03 should produce:

```
supabase/migrations/
  <timestamp>_create_pricing_and_commission.sql    ← commission_settings, price_history tables

src/types/
  pricing.ts                                        ← CommissionSettings, PriceHistoryEntry types

src/pages/
  dashboard/
    settings/
      commission.astro                              ← view + edit commission split rates
    listings/
      [id]/
        pricing.astro                               ← set price, view history, calculate commission split

  api/
    settings/
      commission.ts                                 ← POST: upsert commission_settings
    listings/
      [id]/
        price/
          set.ts                                    ← POST: insert into price_history (+ update listings.asking_price if denormalized)
```

**Design decision to resolve at `/10x-plan`:** whether `asking_price` lives as a denormalized column on `listings` (fastest for dashboard cards) or is always computed as the latest `price_history` entry (single source of truth). The current `listings` table has no price column.

---

## Code References

- [`supabase/migrations/20260525152607_create_listings.sql`](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/supabase/migrations/20260525152607_create_listings.sql) — Only migration; defines `listings` table + `handle_updated_at()` trigger
- [`src/types/listings.ts`](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/src/types/listings.ts) — `Listing`, `ListingType`, `ListingStatus` types
- [`src/lib/supabase.ts`](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/src/lib/supabase.ts) — `createClient()` factory
- [`src/middleware.ts`](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/src/middleware.ts) — `/dashboard/*` protection
- [`src/pages/api/listings/create.ts`](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/src/pages/api/listings/create.ts) — Canonical API route pattern
- [`src/pages/dashboard.astro`](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/src/pages/dashboard.astro) — Canonical list-page pattern
- [`src/pages/dashboard/listings/[id]/edit.astro`](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/src/pages/dashboard/listings/%5Bid%5D/edit.astro) — Canonical single-row-fetch + edit page pattern
- [`eslint.config.js`](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/eslint.config.js) — Narrowly scoped ESLint disable pattern (lines 76-81)
- [`context/foundation/prd.md`](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/context/foundation/prd.md) — FR-009 through FR-012, Business Logic §commission
- [`context/foundation/lessons.md`](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/context/foundation/lessons.md) — 8 active rules; all apply to S-03

---

## Architecture Insights

**S-02 established a clean, conservative pattern:** server-rendered pages, plain HTML forms, redirect-based error surfacing, no client-side state. S-03 must follow this pattern. The commission calculator is a pure function (no side effects) — it can be computed server-side in the page frontmatter and rendered as static HTML, no need for React/interactivity.

**Middleware covers S-03 automatically.** `/dashboard/settings/*` and `/dashboard/listings/[id]/pricing` are all protected by the existing `startsWith('/dashboard')` check.

**`handle_updated_at()` is reusable.** The function is `CREATE OR REPLACE` and lives in the first migration. New S-03 tables only need a `CREATE TRIGGER` statement — no re-declaration of the function.

**RLS pattern for `price_history`:** The table references `listing_id` (not `user_id` directly). The RLS policy will need a subquery: `USING (EXISTS (SELECT 1 FROM listings WHERE listings.id = price_history.listing_id AND listings.user_id = auth.uid()))`. This is slightly more complex than the flat `listings` RLS but is the standard Supabase pattern for child tables.

**Commission settings are 1-per-user (upsert pattern).** `commission_settings` should have a UNIQUE constraint on `user_id` so the API can use `INSERT ... ON CONFLICT (user_id) DO UPDATE` — clean upsert, no need to check for existence first.

---

## Historical Context (from prior changes)

- [`context/changes/listing-crud/plan.md`](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/context/changes/listing-crud/plan.md) — S-02 plan; confirms `handle_updated_at()` was designed to be reused in S-03+
- [`context/changes/listing-crud/reviews/impl-review.md`](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/context/changes/listing-crud/reviews/impl-review.md) — 8 findings, all FIXED; established 8 rules now in lessons.md
- [`context/foundation/lessons.md`](https://github.com/cieyhomelab/estate-desk/blob/88d00b5e831ccbfd3cd294d0464b4c6a8fa696db/context/foundation/lessons.md) — All 8 rules from S-02 review now documented; S-03 plan must apply all of them

---

## Open Questions

1. **Commission formula basis (blocker for plan):** Does `tax_provision` apply to `gross_income` (after agency) or to `total`? Does `agency_portion` apply to `total`? The PRD prose implies `tax_rate × gross_income`; the roadmap question implies the user may intend both rates against `total`. Must be confirmed during `/10x-plan`.

2. **Price storage strategy:** Should `listings.asking_price` be a denormalized column updated on each price set, with `price_history` as the audit log? Or should the listing card always query `MAX(set_at)` from `price_history`? The first option is faster; the second avoids a column on `listings`. This is a `/10x-plan` design decision.

3. **Rounding precision:** PLN prices are two decimal places. The commission formula may produce fractional grosz (e.g., `10 000 × 0.333 = 3 333.33... zł`). Should the system reject non-round inputs, or validate that the computed split sums to within 1 grosz? The PRD says "no silent rounding" but doesn't specify the tolerance.

4. **Commission settings UI placement:** Separate `/dashboard/settings/commission` page (implies a settings section that doesn't exist yet), or a modal/inline section on the listing pricing page? PRD (FR-012) says "account settings" — implies a dedicated settings area.
