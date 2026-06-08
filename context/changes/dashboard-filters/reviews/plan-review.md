<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Dashboard Filters Implementation Plan

- **Plan**: `context/changes/dashboard-filters/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-08
- **Verdict**: SOUND (after triage)
- **Findings**: 2 critical | 2 warnings | 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | FAIL |

## Grounding

5/5 paths ✓ (dashboard.astro, ListingCard.astro, listings.ts, SignInForm.tsx, utils.ts) — 3/3 symbols ✓ (formatPLN in @/lib/utils, snapshotMap as Map<string, number|null>, delete confirm at ListingCard.astro:103) — brief↔plan ✓ — Note: src/components/dashboard/ does not exist yet (expected per "New directory and file")

## Findings

### F1 — fetchError guard not propagated to island

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — DashboardListings empty state logic; Phase 3 — island props contract
- **Detail**: Current dashboard.astro line 118 guards the "add first listing" empty state as `listings.length === 0 && !fetchError`. When Supabase fails, `listings = []` and `fetchError` is non-null — the guard prevents rendering the add-listing link alongside the error banner. The proposed island interface has only two props (listings, snapshotMap); `fetchError` stays in Astro scope but is never passed to the island. The island's Phase 2 empty-state spec checks only `listings.length === 0` — no fetchError guard. Result after Phase 3: error banner renders in Astro (correctly) + island also renders the "add first listing" link (incorrectly) when Supabase fails. Contradicts the "no regression" goal.
- **Fix ⭐ Recommended**: Add `hasError: boolean` to the DashboardListings Props interface. In Phase 3 Astro wiring, pass `hasError={!!fetchError}`. In Phase 2 empty-state spec, guard the add-listing link as `listings.length === 0 && !hasError`.
  - Strength: One boolean prop, one guard — minimal change, exact behavioral parity with current code.
  - Tradeoff: Adds a prop the normal (no-error) path never uses.
  - Confidence: HIGH — matches the existing guard at dashboard.astro:118 exactly.
  - Blind spot: None significant.
- **Decision**: FIXED — added `hasError?: boolean` to Props, guarded empty-state with `&& !hasError`, added `hasError={!!fetchError}` to island invocation in Phase 3.

---

### F2 — Phase 1 Progress section missing lint criterion

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 success criteria vs. Progress §Phase 1
- **Detail**: Phase 1 "Automated Verification" contains two bullets: (1) TypeScript compiles without errors, (2) No lint errors: `npm run lint (if configured)`. The Progress section has only item 1.1 for Phase 1 automated checks — the lint step has no matching checkbox. Per the progress format contract, every success criterion needs a matching checkbox or /10x-implement silently skips it.
- **Fix**: Either add `- [ ] 1.2 No lint errors: npm run lint (if configured)` and renumber 1.2–1.4 → 1.3–1.5, OR remove the lint bullet from the Phase 1 body (since it's conditional on whether lint is configured, it arguably shouldn't be a formal success criterion).
- **Decision**: FIXED — added `- [ ] 1.2 No lint errors: npm run lint (if configured)` and renumbered 1.2–1.4 → 1.3–1.5.

---

### F3 — Phase 3 line range subsumes banner lines

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Modify dashboard.astro
- **Detail**: The spec says "replace lines 95–132 (the mb-4 flex button row through the closing listing grid </div>) with a single island invocation". But lines 113–115 within that range are the three banner messages the plan simultaneously says to keep outside the island. An implementer reading "replace 95-132" literally removes the banners; they'd need to infer from a separate sentence that banners must be re-inserted above the island. Regression risk caught only at manual verification step.
- **Fix**: Replace the line-range instruction with intent-based wording: "Remove the button row (lines 95–111) and listing grid (lines 117–132). Move the banner block (lines 113–115) to immediately above the island invocation."
- **Decision**: FIXED — Phase 3 Intent rewritten with separate ranges for button row, banners, and grid.

---

### F4 — "Zamknięte" in filter vs "Ukończone" on card badge

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — filter bar spec; Phase 1 — statusLabel
- **Detail**: Phase 2 specifies the Status dropdown option: value "done" → label "Zamknięte". Phase 1 says to replicate the card badge from ListingCard.astro:13, which renders `statusLabel` as "Ukończone" for done listings. Same database value ("done"), two different Polish words. A user sets the filter to "Zamknięte" but sees cards badged "Ukończone".
- **Fix**: Pick one term and use it in both places. Since the existing Astro card already uses "Ukończone" (established UX), change the Phase 2 filter option label from "Zamknięte" to "Ukończone" to match. (If "Zamknięte" is intentional, note it explicitly so the implementer knows the divergence is deliberate.)
- **Decision**: FIXED — filter label changed to "Ukończone" in Phase 2 spec and Desired End State.

---

### F5 — Dead ListingCard.astro import not cleaned up in Phase 3

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — dashboard.astro frontmatter
- **Detail**: After Phase 3 replaces the listing loop with the island, `import ListingCard from "@/components/listings/ListingCard.astro"` at dashboard.astro:5 becomes dead code. Phase 3 mentions adding the DashboardListings import but says nothing about removing the ListingCard import. Blast-radius sweep confirms it is only imported in dashboard.astro — no other files affected.
- **Fix**: Add one bullet to Phase 3: "Remove the now-unused `import ListingCard` from dashboard.astro:5."
- **Decision**: FIXED — added removal of dead import to Phase 3 contract.
