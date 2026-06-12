# Refactor C1: Generated DB Types — Implementation Plan

## Overview

The Supabase client is constructed without the `<Database>` generic, so every query returns
`any`-shaped rows. Domain types (`Listing`, `TransactionSnapshot`) are hand-mirrored in two
files. `commission_percent` alone is typed in 4 separate places. This plan generates
`database.types.ts` once and progressively aliases the domain types onto it, then types the
client and migrates call sites — in three additive, independently-verifiable phases.

## Current State Analysis

- `src/lib/supabase.ts:9` — `createServerClient(SUPABASE_URL, SUPABASE_KEY, …)` with no
  `<Database>` generic. Every query returns `any`.
- `src/types/listings.ts:16`, `src/types/transaction.ts:6` — hand-written domain types;
  `commission_percent` additionally typed as an inline `.single<{…}>()` at `close.ts:35` and
  parsed as `number` at `set.ts:21`.
- 34 `.select(` / 8 `.update(` / 7 `.insert(` calls (non-test) — all stringly-typed.
- No `database.types.ts` exists anywhere in the repo (confirmed by `find`/`grep`).
- The Supabase CLI is wired: `supabase` devDep, `config.toml` with `project_id`, CI
  `migrate` job runs `supabase db push`. `supabase gen types` is available but never scripted.
- `astro check` (CI type gate, `ci.yml:21`) is the primary guard — it will surface drift
  as type errors once the client and domain types are connected to the generated file.
- **11 type consumers**: `src/pages/dashboard/listings/[id]/*.astro` (5 pages: close,
  contacts, documents, edit, pricing — `close.astro` is also the sole `TransactionSnapshot`
  consumer), `src/components/listings/ListingCard.{tsx,astro}`,
  `src/components/dashboard/DashboardListings.tsx`, `src/lib/csv.ts`, `src/lib/csv.test.ts`,
  `src/pages/dashboard.astro`.

**Intentionality**: accidental omission — generated typing was never weighed and rejected; it
was simply never set up. `stack-assessment.md` scored the "Typed" gate as pass on TypeScript
strictness alone, never mentioning the untyped client.

## Desired End State

- `database.types.ts` exists in the repo and is kept fresh by a `db:gen-types` npm script.
- `Listing` and `TransactionSnapshot` in `src/types/` are aliases (or re-exports) of the
  generated `Tables<'listings'>` and `Tables<'transaction_snapshots'>` types.
- The Supabase client is typed `<Database>` and all 49 call sites (`select`/`update`/`insert`)
  receive inferred column types rather than `any`.
- `astro check` passes with no type errors introduced by the migration.

### Key Discoveries

- `src/lib/supabase.ts:9` — where `<Database>` is added
- `src/types/listings.ts`, `src/types/transaction.ts` — the two manual type files to alias
- `supabase/config.toml` — has `project_id`, confirms CLI is wired
- `ci.yml:21` — `astro check` is the gate for every phase

## What We're NOT Doing

- No validation layer (C5 — separate plan).
- No call-site refactor in Phase 1 — generation only.
- No removal of the hand-written types in Phase 2 — only aliasing; existing consumers continue to compile.
- No forced migration of all 49 call sites — Phase 3 is opportunistic; the plan does not require touching every call site.
- Not changing RLS policies, migrations, or the DB schema.

## Implementation Approach

Three additive phases: generate → alias → type-the-client. Each phase is independently
verifiable by `astro check`. A Phase 1-only commit (generation, no code change) is fully
reversible by removing the generated file.

---

## Phase 1: Generate and Commit `database.types.ts`

### Overview

Add a `db:gen-types` script to `package.json` and commit the generated `database.types.ts`.
No call-site changes, no type aliasing, no client change. The generated file is the single
source of truth going forward.

### Changes Required

#### 1. Add `db:gen-types` and `typecheck` scripts to `package.json`

**File**: `package.json`

**Intent**: Expose `supabase gen types typescript --local > src/types/database.types.ts` as
an npm script so generation is repeatable and discoverable. Add `typecheck` as a named
alias for `astro check` so each phase's success criteria are runnable without relying on
CI's bare `npx astro check` invocation.

**Contract**: The script `db:gen-types` targets `--local` (uses the local Supabase instance)
and writes to `src/types/database.types.ts`. The script `typecheck` runs `astro check`.

#### 2. Run the script and commit the generated file

**File**: `src/types/database.types.ts` (new, generated)

**Intent**: Commit the generated types file so it enters the type-check pipeline and starts
surfacing any hand-written type drift in subsequent phases.

**Contract**: The file is the standard Supabase CLI output. It exports a `Database` interface
with `public.Tables`, `public.Views`, `public.Functions`, and `public.Enums` namespaces.
Do not hand-edit this file.

### Success Criteria

#### Automated Verification

- `npm run db:gen-types` runs without error
- Type checking passes (generated file itself has no type errors): `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification

- `src/types/database.types.ts` exists and contains the `Database` interface with `listings` and `transaction_snapshots` table entries.
- `listings.commission_percent` is typed as `number | null` in the generated file, matching the DB column.

**Implementation Note**: Requires local Supabase running (`supabase start`) before executing
the script — `--local` connects to the local Docker instance. After this phase, `astro check`
should still pass with no new errors (the generated file is imported by nobody yet). Confirm
before proceeding.

---

## Phase 2: Alias Domain Types onto Generated Types

### Overview

Re-express `Listing` in `src/types/listings.ts` and `TransactionSnapshot` in
`src/types/transaction.ts` as aliases of the generated `Tables<>` type. Let `astro check`
surface any drift between the hand-written types and the actual DB schema.

### Changes Required

#### 1. Re-express `Listing` as a generated-type alias

**File**: `src/types/listings.ts`

**Intent**: Change the hand-written `Listing` interface (or type) to be an alias of
`Database['public']['Tables']['listings']['Row']`. Preserve the `Listing` export name
so the 11 consumers do not need to change.

**Contract**: `import type { Database } from './database.types'` at the top; then
`export type Listing = Database['public']['Tables']['listings']['Row']`. If the hand-written
type has optional fields that the generated type marks as nullable (e.g., `owner_email`),
let `astro check` surface these and resolve them — do not silence with `as any`.

#### 2. Re-express `TransactionSnapshot` as a generated-type alias

**File**: `src/types/transaction.ts`

**Intent**: Same pattern — alias `TransactionSnapshot` onto
`Database['public']['Tables']['transaction_snapshots']['Row']`.

**Contract**: Same import pattern. The `transaction.ts` file may also contain other types
(e.g., `TransactionResult`); only alias the table-row type.

#### 3. Remove the inline `.single<{commission_percent: number|null}>()` cast in `close.ts`

**File**: `src/pages/api/listings/[id]/close.ts:35`

**Intent**: This inline type annotation was compensating for the untyped client. Once
`TransactionSnapshot` is aliased onto the generated type, the query can rely on inferred
types instead. Remove the inline generic.

**Contract**: The query at line 35 currently carries the explicit type argument
`.single<{ id: string; status: string; asking_price: number | null; commission_percent: number | null }>()`.
Remove it so the call becomes plain `.single()` and the inferred type flows from the typed client.
`astro check` confirms the inferred type is correct.

### Success Criteria

#### Automated Verification

- Type checking passes with no new errors (drift surfaces as errors, must be resolved): `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification

- `Listing.commission_percent` is typed as `number | null` (matching DB reality) in IDE type hints.
- No runtime behavior change — the alias is a type-level operation only.

**Implementation Note**: If `astro check` surfaces type errors in Phase 2, they represent
real drift between hand-written types and the DB schema. Resolve them (adjust the alias or
update call sites) — do not suppress. This is the value of the phase.

---

## Phase 3: Type the Supabase Client and Migrate Call Sites

### Overview

Add `<Database>` to the client factory in `src/lib/supabase.ts`. With the client typed, all
`.from('listings')` calls receive inferred column types — the 34 `.select()` calls no longer
return `any`. Migrate call sites opportunistically: start with the highest-value ones (places
where `any` was masking real errors) and leave the rest for future PRs.

### Changes Required

#### 1. Type the Supabase client factory

**File**: `src/lib/supabase.ts`

**Intent**: Add `<Database>` as the type argument to `createServerClient`. This is a
one-line change that propagates type information to every call site that uses the client.

**Contract**: `import type { Database } from '@/types/database.types'` at the top; then
`createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, …)`. No other changes to the file.

#### 2. Migrate call sites that `astro check` flags as errors

**Files**: whichever call sites `astro check` reports type errors on after the client is typed.

**Intent**: Fix each type error surfaced by the newly-typed client. Common patterns: a
`.select('column1, column2')` whose return type is now `Pick<Listing, 'column1'|'column2'>[]`
instead of `any[]`; an explicit `as SomeType` cast that `astro check` flags as unsafe.

**Contract**: Resolve errors by removing unsafe casts and trusting the inferred types. If a
call site needs a narrower type than the full row, use `Pick<>` or a local type alias.

### Success Criteria

#### Automated Verification

- Type checking passes with no new errors: `npm run typecheck`
- Linting passes: `npm run lint`
- Unit/integration tests pass: `npm run test`

#### Manual Verification

- In an IDE, hovering over a `.from('listings').select()` result shows a typed row, not `any`.
- The application loads and functions normally in the browser (no runtime regressions from type-only changes).

**Implementation Note**: Phase 3 may surface type errors that require non-trivial call-site
fixes. Work through them one file at a time. If a call site is complex (e.g., dynamic
`.select()` string), it's acceptable to leave it with a narrowly-scoped `// eslint-disable`
and a comment, and defer it to a follow-up PR. The goal is no `any` leakage through the
types that were hand-written in Phase 2.

---

## Testing Strategy

### Type-Level Tests (automated)

- `astro check` / `npm run typecheck` after every phase — this is the primary guard.

### Unit Tests

- `src/lib/csv.test.ts` uses `Listing` — it must pass after Phase 2 aliases the type.
- `src/integration/*` — none directly test types, but they exercise the typed client.

### Manual Testing Steps

1. After Phase 3, start the dev server.
2. Load the dashboard — confirm listing cards render correctly.
3. Create, update, and close a listing — confirm no runtime errors.
4. Download CSV — confirm the export still works (uses `Listing` type via `csv.ts`).

## References

- Research: `context/changes/refactor-opportunities/research.md`
- Supabase CLI docs: `supabase gen types typescript --help`
- Untyped client: `src/lib/supabase.ts:9`
- Hand-written types: `src/types/listings.ts:16`, `src/types/transaction.ts:6`
- Type consumers: `src/components/listings/ListingCard.{tsx,astro}`, `src/components/dashboard/DashboardListings.tsx`, `src/lib/csv.ts`
- CI type gate: `.github/workflows/ci.yml:21`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Generate and Commit database.types.ts

#### Automated

- [x] 1.1 `npm run db:gen-types` runs without error — 2747624
- [x] 1.2 Type checking passes: `npm run typecheck` — 2747624
- [x] 1.3 Linting passes: `npm run lint` — 2747624

#### Manual

- [x] 1.4 database.types.ts contains listings and transaction_snapshots table entries — 2747624
- [x] 1.5 listings.commission_percent typed as number | null in generated file — 2747624

### Phase 2: Alias Domain Types onto Generated Types

#### Automated

- [x] 2.1 Type checking passes with all drift resolved: `npm run typecheck`
- [x] 2.2 Linting passes: `npm run lint`

#### Manual

- [x] 2.3 Listing.commission_percent typed as number | null in IDE type hints
- [x] 2.4 No runtime behavior change confirmed

### Phase 3: Type the Supabase Client and Migrate Call Sites

#### Automated

- [ ] 3.1 Type checking passes: `npm run typecheck`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Tests pass: `npm run test`

#### Manual

- [ ] 3.4 Hovering over .from('listings').select() result shows typed row, not any
- [ ] 3.5 Application loads and functions normally (dashboard, create, update, close, CSV)
