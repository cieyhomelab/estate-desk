<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Testing Bootstrap: Commission Arithmetic

- **Plan**: context/changes/testing-bootstrap-commission/plan.md
- **Scope**: Phase 1 + Phase 2 (Full Plan)
- **Date**: 2026-06-01
- **Verdict**: NEEDS ATTENTION → all findings resolved during triage
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — close.astro still contains inline commission formula

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard/listings/[id]/close.astro:90–97
- **Detail**: The formula was extracted into commission.ts and two of three consumers were updated (close.ts API + pricing.astro). close.astro was not in the plan's Changes Required, so the implementation followed the plan faithfully — but a third independent copy of the formula remained. Future formula changes in commission.ts would silently diverge from the preview shown on the close screen.
- **Fix A ⭐ Recommended**: Refactor close.astro frontmatter to call `calculateCommissionSplit` — same pattern as pricing.astro:65–73.
  - Strength: Zero new decisions; pattern already established in pricing.astro.
  - Tradeoff: Slightly expands footprint post-plan.
  - Confidence: HIGH
  - Blind spot: close.astro null-guard shape verified before removing inline block.
- **Decision**: FIXED via Fix A — added `calculateCommissionSplit` import and replaced lines 79–102 with ternary call matching pricing.astro pattern.

### F2 — Float sum assertion uses toBe (fragile for non-integer PLN values)

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/commission.test.ts:61
- **Detail**: `expect(agencyAmount + taxAmount + agentNet).toBe(brutto)` — all values are integers ÷ 100 (repeating decimals in IEEE 754). For current inputs the sum holds, but future oracle changes could produce floating-point carry mismatches. The invariant is already proven in integer space by the throw guard inside commission.ts.
- **Fix**: Replace `.toBe` with `.toBeCloseTo(result.brutto, 2)`.
- **Decision**: FIXED — replaced `.toBe` with `.toBeCloseTo(result.brutto, 2)` on line 61.

### F3 — Misleading unit-identity comment in commission.ts

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/commission.ts:17–18
- **Detail**: Comment said "PLN × % = PLN/100 × 100 = grosze (coincidental unit identity)" — the algebra is incorrect. A developer verifying units would follow the comment and conclude the math is wrong.
- **Fix**: Replace with correct explanation: "askingPrice (PLN) × commissionPercent (%) = price × p/100 × 100 grosze by unit cancellation; divide by 100 to recover PLN."
- **Decision**: FIXED — comment replaced with correct unit explanation.

### F4 — passWithNoTests: true in vitest.config.ts (no longer needed)

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: vitest.config.ts:11
- **Detail**: Added as a bootstrapping pragmatism to prevent CI failure before any test files existed. Phase 2 now ships 4 tests, making the option no longer load-bearing. Leaving it in means accidentally deleting all test files would pass CI silently.
- **Fix**: Remove `passWithNoTests: true`.
- **Decision**: FIXED — option removed from vitest.config.ts.
