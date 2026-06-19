<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Listing Redesign — Implementation Plan

- **Plan**: context/changes/listing-redesign/plan.md
- **Mode**: Deep
- **Date**: 2026-06-19
- **Verdict**: SOUND (after fixes)
- **Findings**: 0 critical | 2 warnings | 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

4/4 existing paths ✓ (ListingRow.tsx new — expected), 3/3 symbols ✓ (snapshotMap, formatPLN, filteredListings)

## Findings

### F1 — Actions cell has no explicit width; misaligns with 130px header

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1 Actions cell spec / Phase 2 column header
- **Detail**: 6 buttons × 22px + 5 gaps × 5px = 157px natural width, but the header column was w-[130px]. The flex-1 address cell would absorb the surplus by shrinking — every column visually misaligns. Criterion 2.4 would fail.
- **Fix A ⭐ Applied**: Added `w-[160px]` to the Actions cell class in ListingRow spec and updated the column header to `w-[160px]`.
- **Decision**: FIXED via Fix A

### F2 — Mobile layout unspecified; fixed columns exceed any phone viewport

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 success criterion 2.9
- **Detail**: Fixed columns alone (110 + 130 + 90 + 160) total ~490px — wider than any common mobile viewport (320–390px). Criterion 2.9 said "compact and readable" with no implementation strategy.
- **Fix A ⭐ Applied**: Added `overflow-x-auto` wrapper and `min-w-[640px]` inner div to the Phase 2 container spec. Updated criterion 2.9 and progress item 2.9 to reflect horizontal scroll strategy.
- **Decision**: FIXED via Fix A

### F3 — Type badge text label absent from ListingRow spec

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Type cell spec (item 2)
- **Detail**: Colors and borders were specified precisely but badge text labels were absent. ListingCard uses `listing.type === "sale" ? "Sprzedaż" : "Najem okazjonalny"`.
- **Fix Applied**: Added label text ("Sprzedaż" / "Najem okazjonalny") with condition to the Type cell spec.
- **Decision**: FIXED
