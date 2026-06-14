<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Commission Immutability and Split Error Handling

- **Plan**: context/changes/i-04-commission/plan.md
- **Scope**: All phases (Phase 1 + Phase 2 of 2)
- **Date**: 2026-06-14
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical | 2 warnings | 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Race window between status fetch and commission update

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/listings/[id]/commission/set.ts:32–47
- **Detail**: The route reads `listing.status` on line 32, evaluates the guard on line 43, then issues the UPDATE on line 47 — two separate DB round-trips with no lock. A concurrent `close.ts` request could flip status to "done" in the gap, letting the update succeed on a now-closed listing. Practically near-impossible at MVP (single owner, millisecond window), but the pattern is inherited from `close.ts` and `reopen.ts` throughout the codebase.
- **Fix A ⭐ Recommended**: Add comment documenting the race window above line 47.
  - Strength: Zero blast radius; makes the inherited systemic gap visible without fragmenting a fix across one route.
  - Tradeoff: Doesn't close the race; just documents it.
  - Confidence: HIGH — fixing only commission/set.ts would be inconsistent with close.ts and reopen.ts.
  - Blind spot: Supabase RLS may already block updates on done listings (would close the race at the DB layer).
- **Fix B**: Replace read-then-write with a single conditional UPDATE (WHERE status = 'active' AND user_id = user.id).
  - Strength: Closes the race entirely; also eliminates the extra SELECT round-trip.
  - Tradeoff: Cross-cutting refactor — should also touch close.ts and reopen.ts; belongs in a dedicated hardening change.
  - Confidence: MED — right long-term direction but out of scope here.
  - Blind spot: Supabase .select() + length pattern for UPDATE needs verification.
- **Decision**: FIXED via Fix A

### F2 — Missing status assertion before first postClose in lifecycle test

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/integration/api/commission-immutability.test.ts:150
- **Detail**: The lifecycle test called `postClose()` and immediately asserted on `headers.get("location")` without first checking `closeRes.status === 302`. Every other call in the file (reopenRes, closeRes2) asserts status first. A 500 response would produce a confusing null-reference failure rather than a clear assertion message.
- **Fix**: Added `expect(closeRes.status).toBe(302);` before the location assertion, matching the pattern used for `reopenRes` and `closeRes2`.
- **Decision**: FIXED

### F3 — Status guard implicitly assumes only two listing statuses

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/listings/[id]/commission/set.ts:43
- **Detail**: Guard checks `listing.status === "done"` → blocked (implicit: anything else is mutable). If a future status like "archived" or "pending_review" is added, commission edits would silently be allowed on those states. Same assumption exists in `reopen.ts` — systemic pattern.
- **Fix**: Added one-line comment above line 43: `// "done" is the only immutable status today; revisit if new statuses are added`
- **Decision**: FIXED

### F4 — supabase null guard in commission/set.ts redirects to pricing page (not dashboard)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/listings/[id]/commission/set.ts:14
- **Detail**: The supabase null guard redirects to `/dashboard/listings/${id}/pricing?error=blad-serwera`, keeping the user in context. Sibling routes `close.ts` and `reopen.ts` redirect to `/dashboard?error=blad-zapisu` (dropping context). The new route is strictly better UX; the divergence is a positive one, not a regression.
- **Decision**: SKIPPED

### F5 — Done-listing fixture seeded via service role, not the HTTP close route

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/integration/api/commission-immutability.test.ts:91–113
- **Detail**: Test 2 seeds a "done" listing by directly inserting a `transaction_snapshots` row + updating status via service role, bypassing the HTTP close route. Valid deliberate design choice (faster, avoids inter-test dependency). Test 3 (lifecycle) covers the full close path end-to-end.
- **Decision**: SKIPPED
