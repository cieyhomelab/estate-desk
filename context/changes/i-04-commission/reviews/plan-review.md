<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Commission Immutability and Split Error Handling

- **Plan**: context/changes/i-04-commission/plan.md
- **Mode**: Deep
- **Date**: 2026-06-14
- **Verdict**: SOUND
- **Findings**: 0 critical  1 warning  2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | PASS |

## Grounding

5/5 paths ✓, 5/5 symbols ✓, brief↔plan ✓

Paths verified: `commission/set.ts`, `pricing.astro`, `close.ts`, `messages.ts`, `gate-logic.test.ts`. Symbols verified: `updateOwnedListing` at set.ts:31 (unconditional), `calculateCommissionSplit` at close.ts:76-86 (no try/catch), both slugs absent from messages.ts, status guard at close.ts:43, invariant throw at commission.ts:29-30.

## Findings

### F1 — Test case 3 close POST will be blocked by document gate

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Testing Strategy — test case 3 (reopen → commission change → close)
- **Detail**: close.ts:48-60 gates every close on `uncheckedCount > 0 && override_confirmed !== "true"`. When a listing is created, the DB trigger seeds documents with `is_checked: false`. Test case 3 seeds a done listing, reopens it, changes commission, then POSTs close — but trigger-seeded documents remain unchecked. The close POST lands on `?error=brakujace-dokumenty` instead of `?success=zamknieto`. The plan said "follow the gate-logic.test.ts pattern" but didn't name which clearing strategy to use.
- **Fix**: Added `override_confirmed=true` note to test case 3 in plan.md.
- **Decision**: FIXED

### F2 — Price form stays visible for done listings (UX asymmetry)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — pricing.astro scope; "What We're NOT Doing"
- **Detail**: pricing.astro:104-123 has a price/set form that remains visible for done listings after this change hides the commission form. close.ts:92 snapshots `asking_price` alongside `commission_percent`, so post-close price mutation is also a divergence path. Explicitly out of scope per plan ("No change to the price/set route").
- **Decision**: SKIPPED

### F3 — Redirect URL for null-listing SELECT not fully specified

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — commission/set.ts contract
- **Detail**: The Phase 1 contract originally said "redirect to `?error=nie-znaleziono`" without specifying the base path. close.ts uses `/dashboard?error=nie-znaleziono`; existing commission/set.ts (line 34) uses `/dashboard/listings/${id}/pricing?error=…`. The slug also isn't in messages.ts (pre-existing; fallback fires).
- **Fix**: Clarified redirect path in plan.md to `/dashboard/listings/${id}/pricing?error=nie-znaleziono`.
- **Decision**: FIXED
