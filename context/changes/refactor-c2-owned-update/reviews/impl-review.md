<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Refactor C2 — Close Silent 0-row UPDATE False-Success

- **Plan**: context/changes/refactor-c2-owned-update/plan.md
- **Scope**: All Phases (1, 2A, 3)
- **Date**: 2026-06-12
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical · 1 warning · 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Unsafe cast of optional `result.error` in update.ts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/listings/[id]/update.ts:48
- **Detail**: `result.error` typed as `error?: unknown` — `not-found` and `db-error` arms shared one union variant. The cast `(result.error as Error).message` would throw on `undefined` if `error` were absent. In practice the helper always sets it on `db-error`, but the type didn't enforce this.
- **Fix**: Split `OwnedMutationResult` into three arms (`ok: true`, `ok: false; reason: "not-found"`, `ok: false; reason: "db-error"; error: unknown`). Removed unsafe cast in update.ts:48, replaced with `(result.error as { message: string }).message`.
- **Decision**: FIXED

### F2 — toggle.ts kept inline pattern instead of migrating to helper

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/api/listings/[id]/documents/[docId]/toggle.ts
- **Detail**: Phase 3 plan said "same migration" for all 4 vulnerable routes. toggle.ts updates `listing_documents`, not `listings` — so `updateOwnedListing` (listings-scoped) cannot be used. Implementation correctly keeps the equivalent inline `.select()` + `data.length === 0` pattern. Tested and documented in lessons.md L1.
- **Fix**: Added plan addendum to plan.md noting the deliberate deviation and its reason.
- **Decision**: FIXED

### F3 — OwnedMutationResult union arms not split

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/lib/owned-mutation.ts:3-5
- **Detail**: Root cause of F1. Already resolved by the F1 fix.
- **Decision**: SKIPPED (resolved as part of F1)

### F4 — price/set IDOR test missing price_history count assertion

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/integration/api/idor.test.ts (price/set test block)
- **Detail**: Test asserted asking_price stays null but not that price_history has 0 rows for the attacked listing. If RLS on price_history were misconfigured, a cross-account row could slip through silently.
- **Fix**: Added `price_history` row-count assertion (`.select("id", { count: "exact", head: true }).eq("listing_id", userAListingId); expect(count).toBe(0)`) after the existing DB check.
- **Decision**: FIXED

### F5 — `undefined` interpolated into redirect URL in commission/set.ts

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/listings/[id]/commission/set.ts:9-10
- **Detail**: Combined `!supabase || !id` guard redirected to `/dashboard/listings/${id}/pricing?error=blad-serwera` — when `!id` fired, produced `/dashboard/listings/undefined/pricing?error=blad-serwera`. Pre-existing issue, plan excluded from scope as P3.
- **Fix**: Split into two guards: `!id` → `/dashboard?error=blad-serwera`; `!supabase` → `/dashboard/listings/${id}/pricing?error=blad-serwera`.
- **Decision**: FIXED
