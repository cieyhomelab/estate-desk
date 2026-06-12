# Refactor C2: Close Silent 0-Row UPDATE False-Success — Implementation Plan

## Overview

Four API routes silently report success when a `listings` UPDATE matches 0 rows (wrong owner
or missing ID). The correct shape already exists in-repo: `update.ts` appends `.select()` and
checks `data.length === 0` — a deliberately designed, reviewed convention that later routes
silently dropped. This plan restores it.

The fix is gated by a characterization test (Phase 1) that resolves whether a 0-row UPDATE
under RLS returns silent success or an RLS error. The answer determines whether we need the
structural helper (Phase 2A) or only a response-mapping improvement (Phase 2B).

## Current State Analysis

The 0-row UPDATE problem exists on a spectrum of severity:

- **4 vulnerable routes** (no prior select, no rowcount check):
  - `src/pages/api/listings/[id]/commission/set.ts:27`
  - `src/pages/api/listings/[id]/documents/override.ts:25-29`
  - `src/pages/api/listings/[id]/documents/[docId]/toggle.ts:25-29`
  - `src/pages/api/listings/[id]/price/set.ts:39-43`
- **2 surface-narrowed routes** (a prior `.select().single()` filters missing listings first, but the `.update()` call itself is still unchecked):
  - `src/pages/api/listings/[id]/close.ts` (select at line 30-35, update at 109-120)
  - `src/pages/api/listings/[id]/reopen.ts` (select at line 22-27, update at 53)
- **The reference implementation** (already correct): `src/pages/api/listings/[id]/update.ts:38-49`

The `update.ts` pattern is the target shape: `.update(...).eq("id").eq("user_id").select()`, then check `if (data.length === 0)`.

**Historical context.** The 0-row=error rule was deliberate and documented (listing-crud
`plan.md:148`). An implementation review (F5, `context/archive/2026-05-25-listing-crud/reviews/impl-review.md:84-101`)
explicitly warned that sibling routes invited wrong-direction cleanup. The lesson that captured
this guard has since been deleted from disk (`context/foundation/lessons.md` absent as of
`4783d25`), which explains why the drift went unchecked in later routes.

**Open Q1** (unresolved): does a 0-row UPDATE under RLS return `error===null` (silent success)
or an RLS error? Phase 1 answers this and determines the Phase 2 branch.

## Desired End State

- No API route reports `?success=` when it writes 0 rows to `listings`.
- The behavior is verified by integration tests (cookie-auth harness, same pattern as `idor.test.ts`).
- All 4 vulnerable routes and both surface-narrowed routes are updated.
- Open Q1 is resolved and documented.

### Key Discoveries

- `src/pages/api/listings/[id]/update.ts:38-49` — the in-repo reference implementation of the correct pattern
- `src/integration/api/idor.test.ts:71-116` — cookie-auth harness template; the exact starting point for Phase 1
- `src/integration/helpers/auth.ts:4-33` — auth helper used by the harness
- CI guard: `test:integration:api` (`ci.yml:29`)

## What We're NOT Doing

- No changes to the `auth/*` public routes or `middleware.ts`.
- No shared `withAuth` higher-order wrapper (C4 — deliberate design, separate decision).
- No validation refactor (C5 — separate plan).
- No flash-message layer (C3 — separate plan).
- No fix to P3 (`undefined` interpolated into URL on `!id`) — one-liner, separate commit.
- We are NOT changing the `.eq("user_id", …)` ownership filter itself — that is a deliberate, documented security constraint.

## Implementation Approach

Phase 1 writes a characterization test; its result determines the Phase 2 branch. Phases 2A/2B
and Phase 3 proceed after the test runs and the branch is confirmed. Route adoption in Phase 3
is done one route at a time, each paired with its own cookie-auth integration test.

---

## Phase 1: Characterization Test

### Overview

Write a single integration test that POSTs to `commission/set` as a non-owner. Assert both the
redirect slug the route returns AND that the database row is unchanged. The observed slug
answers Open Q1 and determines the Phase 2 branch.

### Changes Required

#### 1. New integration test in `idor.test.ts` (or a dedicated `c2-characterization.test.ts`)

**File**: `src/integration/api/idor.test.ts` (append to existing file) or a new sibling file.

**Intent**: Add a test that signs in as User B, POSTs the `commission/set` route against a
listing owned by User A, and asserts (a) the redirect slug and (b) that the DB row is
unchanged. The test exercises the exact non-owner path that maps to Open Q1.

**Contract**: Follow the existing `idor.test.ts:71-116` template:
1. Seed User A's listing via service-role client.
2. Sign in AS User B via `getAuthCookieHeader` (from `src/integration/helpers/auth.ts`).
3. POST to `/api/listings/{listingId}/commission/set` with a valid `commission_percent` value.
4. Assert the response redirect location (Location header slug).
5. Re-query the row via service-role client; assert `commission_percent` is unchanged.

Record the observed slug AND the raw `error.code` value in a comment:
`// Open Q1 result: [silent-success | rls-error | blad-zapisu] — error.code: [null | 42501 | <other>]`.
The `error.code` is needed by Phase 2B to write the correct error-code discrimination.

### Success Criteria

#### Automated Verification

- Integration test suite passes: `npm run test:integration:api`

#### Manual Verification

- Inspect the test output to read the observed redirect slug.
- Document Open Q1 result: if the route redirected with `?success=prowizja-zapisana`, it is **silent success (Case A)**. If it redirected with `?error=blad-zapisu` or `?error=nie-znaleziono`, it is **RLS error (Case B)**.

**Implementation Note**: After this phase passes, read the test output and determine the Phase 2 branch (2A or 2B) before proceeding. The Phase 2 branch is a conditional decision — both paths are described below.

---

## Phase 2A: Extract Owned-Mutation Helper (if Case A — silent success confirmed)

*Skip to Phase 2B if Phase 1 reveals the route already redirects with an error slug.*

### Overview

Extract the `update.ts` pattern into a shared helper. This makes the correct rowcount-check
behavior the default call site rather than a convention implementers must remember.

### Changes Required

#### 1. New helper: `src/lib/owned-mutation.ts`

**File**: `src/lib/owned-mutation.ts` (new file)

**Intent**: Provide a `updateOwnedListing(supabase, id, userId, patch)` function that
executes `.update(patch).eq("id", id).eq("user_id", userId).select()` and returns a typed
result distinguishing `{ ok: true, data }` from `{ ok: false, reason: "not-found" | "db-error", error? }`.
This encapsulates the rowcount check the routes currently omit.

**Contract**: The function signature must accept the Supabase client instance (not create its
own), accept an arbitrary partial `listings` update payload, and return a discriminated union
so callers cannot ignore the not-found case. No changes to any route file in this phase.

#### 2. Write a cookie-auth HTTP integration test for `update.ts` (before migrating it)

**File**: `src/integration/api/idor.test.ts` (append to existing file)

**Intent**: Add a test that signs in as User B, POSTs to `/api/listings/{listingId}/update`
with valid form data against User A's listing, and asserts (a) the redirect slug is not a
success slug, and (b) the DB row is unchanged. This establishes the expected HTTP behavior
before the helper refactor so the migration has automated HTTP-level backing.

**Contract**: Follow the `idor.test.ts:71-116` template. The test must pass before step 3
(helper migration) begins. No route changes in this step.

#### 3. Adopt in `update.ts` first (already has the correct inline pattern; this proves equivalence)

**File**: `src/pages/api/listings/[id]/update.ts`

**Intent**: Replace the inline `.update().select()` + `data.length === 0` block with a call
to `updateOwnedListing`. The step-2 HTTP test must still pass after this refactor — that is
the proof of equivalence.

**Contract**: No behavior change — only structural. The route still redirects to `/dashboard`
on success and `/dashboard?error=…` on error.

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run typecheck` (or `astro check`)
- Integration test suite passes (including Phase 1 characterization test and the new `update.ts` HTTP test from step 2): `npm run test:integration:api`

#### Manual Verification

- Update a listing title via the UI to confirm `update.ts` still works correctly.

**Implementation Note**: Phase 2A only introduces the helper and adopts it in `update.ts`. The 4 vulnerable routes are migrated in Phase 3. Confirm all tests still pass before continuing.

---

## Phase 2B: Improve Error Response (Case B only)

*Skip to Phase 3 if Phase 1 reveals Case A (silent success). Only execute Phase 2B if the
characterization test shows the route already returns an error slug (RLS is the guard).*

### Overview

If RLS errors on a 0-row UPDATE (Case B), the 4 vulnerable routes already redirect to an error
slug — the security invariant holds. The remaining problem is UX: the user gets a generic
`blad-zapisu` (storage error) rather than a meaningful "listing not found" or "not your listing"
message. Phase 2B upgrades the error mapping and documents Q1's answer.

### Changes Required

#### 1. Add a `nie-znaleziono` slug handling to the 4 vulnerable routes

**File**: Each of the 4 vulnerable routes (`commission/set.ts`, `documents/override.ts`,
`documents/[docId]/toggle.ts`, `price/set.ts`)

**Intent**: Change the `if (error)` branch to distinguish between "RLS / not found" errors
(map to `nie-znaleziono` slug) and genuine DB errors (keep `blad-zapisu`). This is a minimal
improvement to the error UX without restructuring the routes.

**Contract**: Use the `error.code` recorded in the Phase 1 test comment. The correct code
for Postgres/PostgREST RLS permission-denied is `42501` — NOT `PGRST116`, which means
"zero or multiple rows returned" and is used elsewhere in the codebase as a not-found
suppressor (a different semantic). Check `error.code === "42501"` in the existing error
branch and route to `nie-znaleziono`; all other error codes keep the `blad-zapisu` path.

#### 2. Update the characterization test assertion

**File**: The Phase 1 test file

**Intent**: Now that we know the correct slug, update the test assertion from the observed
behavior to the improved target behavior (`nie-znaleziono`).

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run typecheck`
- Integration test suite passes (characterization test now asserting `nie-znaleziono`): `npm run test:integration:api`

#### Manual Verification

- POSTing commission/set as a non-owner via the browser (or curl) now shows a "not found"-class error, not a generic storage error.

**Implementation Note**: Phase 2B is a UX improvement only. If Case B is confirmed, the
security invariant already holds and Phase 3 is simplified (no structural helper needed,
only test coverage per route).

---

## Phase 3: Adopt Across All Vulnerable Routes

### Overview

Apply the Phase 2 fix (either helper adoption or error-code mapping) to all 4 vulnerable
routes. Add a cookie-auth integration test per route, cloned from the Phase 1 template.
Then add explicit guards to the 2 surface-narrowed routes (`close`, `reopen`).

### Changes Required

#### 1. Migrate the 3 remaining vulnerable routes (beyond `update.ts` + `commission/set`)

**Files**:
- `src/pages/api/listings/[id]/documents/override.ts`
- `src/pages/api/listings/[id]/documents/[docId]/toggle.ts`
- `src/pages/api/listings/[id]/price/set.ts`

**Intent** (Case A path): Replace the bare `.update().eq().eq()` call with `updateOwnedListing` from `src/lib/owned-mutation.ts`. Each route gets its own cookie-auth integration test (non-owner POST → assert slug + unchanged row).

**Intent** (Case B path): Add the `error.code` discrimination from Phase 2B to each route. Each route gets its own cookie-auth integration test asserting the correct error slug.

**Contract**: One route + one test per commit. The test must pass before the next route is touched.

#### 2. Add explicit zero-row guards to `close.ts` and `reopen.ts`

**Files**:
- `src/pages/api/listings/[id]/close.ts` (update call at ~line 109-120)
- `src/pages/api/listings/[id]/reopen.ts` (update call at ~line 53)

**Intent**: These routes already narrow the surface via a prior `.select().single()`, but the
subsequent `.update()` call itself has no rowcount check. Add `.select()` + zero-row check
(or `updateOwnedListing` adoption) to the UPDATE call.

**close.ts integration test**: `idor.test.ts:71-91` already covers the non-owner scenario
for close and passes today (asserts `nie-znaleziono`, DB row unchanged). No new test needed
for close.ts — the existing test is sufficient to confirm the Phase 3 guard doesn't regress.

**reopen.ts integration test**: No HTTP-level test exists. Add one cookie-auth test for
reopen following the `idor.test.ts` template.

**Contract**: The change must not alter the `close` / `reopen` success behavior for the happy path — confirmed by the existing integration tests for those routes.

#### 3. Restore the deleted lesson to `context/foundation/lessons.md`

**File**: `context/foundation/lessons.md` (create if absent)

**Intent**: Re-document the "0-row UPDATE must be detected and treated as not-found" rule, referencing its origin (listing-crud plan Phase 2, impl-review F5) so future routes have the lesson available. This is how the drift happened — the lesson was deleted.

**Contract**: A new `lessons.md` entry. See `context/archive/2026-05-25-listing-crud/reviews/impl-review.md:84-101` for the original F5 text.

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run typecheck`
- All integration tests pass (cookie-auth tests for each of the 6 routes): `npm run test:integration:api`
- Linting passes: `npm run lint`

#### Manual Verification

- POSTing commission/set, documents/override, documents/toggle, price/set as non-owner → correct error slug, row unchanged.
- POSTing close/reopen as non-owner → correct error slug, row unchanged.
- Happy path for all 6 routes still works correctly as the authenticated owner.
- `context/foundation/lessons.md` documents the rule for future implementers.

**Implementation Note**: After all automated tests pass, pause for manual confirmation of the happy paths before marking this change complete.

---

## Testing Strategy

### Integration Tests

- All tests follow the `idor.test.ts:71-116` template (seed via service-role, sign in as different user, POST, assert slug + DB state).
- New tests written: 1 (Phase 1 characterization for commission/set) + 1 (Phase 2A update.ts HTTP test) + 3 (Phase 3: override, toggle, price/set) + 1 (Phase 3: reopen) = **6 new tests**. close.ts already has HTTP coverage in `idor.test.ts:71-91`; total suite count becomes **7** including the pre-existing test.

### Manual Testing Steps

1. Start the dev server.
2. Sign in as User A, create a listing.
3. Sign out, sign in as User B.
4. Attempt to POST each affected route against User A's listing ID.
5. Confirm: correct error slug in URL, row unchanged in DB.
6. Sign back in as User A, confirm each route still works correctly as the owner.

## Migration Notes

No DB migrations. No type changes. Route changes are independent and fully reversible by
inlining the original one-liner chain.

## References

- Research: `context/changes/refactor-opportunities/research.md`
- Reference implementation: `src/pages/api/listings/[id]/update.ts:38-49`
- Cookie-auth harness template: `src/integration/api/idor.test.ts:71-116`
- Auth helper: `src/integration/helpers/auth.ts:4-33`
- Original rule origin: `context/archive/2026-05-25-listing-crud/plan.md:148`
- F5 warning: `context/archive/2026-05-25-listing-crud/reviews/impl-review.md:84-101`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Characterization Test

#### Automated

- [x] 1.1 Integration test suite passes with characterization test: `npm run test:integration:api` — 15e0149

#### Manual

- [x] 1.2 Inspect test output; document Open Q1 result (Case A or Case B) in a comment before proceeding — 15e0149

### Phase 2A: Extract Owned-Mutation Helper (Case A only)

#### Automated

- [x] 2A.1 Type checking passes: `npm run typecheck`
- [x] 2A.2 Cookie-auth HTTP test for update.ts passes (non-owner POST → not-found slug, row unchanged): `npm run test:integration:api`
- [x] 2A.3 Integration tests pass after helper migration (Phase 1 characterization + update.ts HTTP test): `npm run test:integration:api`

#### Manual

- [x] 2A.4 Update a listing via UI to confirm update.ts still works correctly

### Phase 2B: Improve Error Response (Case B only)

#### Automated

- [ ] 2B.1 Type checking passes: `npm run typecheck`
- [ ] 2B.2 Integration test passes with updated nie-znaleziono assertion: `npm run test:integration:api`

#### Manual

- [ ] 2B.3 Non-owner POST shows nie-znaleziono error (not generic blad-zapisu)

### Phase 3: Adopt Across All Vulnerable Routes

#### Automated

- [ ] 3.1 Type checking passes: `npm run typecheck`
- [ ] 3.2 All 7 cookie-auth integration tests pass: `npm run test:integration:api`
- [ ] 3.3 Linting passes: `npm run lint`

#### Manual

- [ ] 3.4 Non-owner POST to each of 6 routes → correct error slug, row unchanged
- [ ] 3.5 Happy path for all 6 routes works correctly as authenticated owner
- [ ] 3.6 context/foundation/lessons.md documents the 0-row=error rule
