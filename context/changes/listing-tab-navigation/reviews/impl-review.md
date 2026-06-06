<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Listing Tab Navigation

- **Plan**: context/changes/listing-tab-navigation/plan.md
- **Scope**: Phase 1 + Phase 2 (all phases)
- **Date**: 2026-06-06
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical | 1 warning | 2 observations

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

### F1 — contacts.astro loadError path has no redirect

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard/listings/[id]/contacts.astro:36
- **Detail**: The plan explicitly fixed missing `return` on two redirect calls (lines 21 and 33), but missed a third case: when the DB fetch returns a non-404 error (the `loadError = true` branch at line 36), `listing` stays null and execution falls through to the template. The template defensively gates on `{listing && ...}`, so the page doesn't crash — but the result is a blank content area with an error banner rather than a redirect. The `<title>` evaluates `listing?.address ?? ""` producing an empty string. Other pages (e.g. documents.astro) redirect on fetch errors; this page silently degrades instead.
- **Fix A ⭐ Recommended**: Add `if (loadError) return Astro.redirect("/dashboard?error=...");` after setting `loadError = true`, matching the other listing pages.
  - Strength: Matches documents.astro, edit.astro, and the 3 other pages — consistent error-handling pattern across the whole listing section.
  - Tradeoff: Loses the "show an inline error banner" UX that contacts.astro currently provides. If intentional, it's lost.
  - Confidence: MED — the intent of the banner vs. redirect difference is unclear; could be deliberate.
  - Blind spot: Haven't verified whether anything currently triggers the loadError path in practice.
- **Fix B**: Add a comment on the loadError branch explaining the banner behavior is deliberate for contacts.astro.
  - Strength: Preserves the current UX; makes the deviation legible to future readers.
  - Tradeoff: Leaves the blank-content-area behaviour in place.
  - Confidence: MED — only valid if the banner approach was a conscious choice.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — redirects on both loadError branches; removed loadError variable and banner from template.

### F2 — Unplanned eslint.config.js changes

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: eslint.config.js:79–106
- **Detail**: Two new narrow ESLint overrides were added that aren't mentioned in the plan: (1) `astroRedirectFrontmatterConfig` (lines 79–91) disables `@typescript-eslint/no-misused-promises` for the 5 listing pages + `settings/commission.astro` — needed because astro-eslint-parser crashes on `return Astro.redirect()` in frontmatter. (2) `pricingAstroPrettierBypass` (lines 101–106) disables `prettier/prettier` for pricing.astro to avoid a Prettier/ESLint parser crash on nested `T[]` generics. Both are commented with justifications and are narrowly scoped. They are a necessary side-effect of the plan's redirect fixes, not arbitrary scope creep.
- **Fix**: Acknowledge as a discovered side-effect — no code change needed.
- **Decision**: ACCEPTED — necessary side-effect of redirect fixes; narrowly scoped and justified in code comments.

### F3 — export interface Props vs. interface Props in ListingTabs.astro

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/listings/ListingTabs.astro:2
- **Detail**: ListingTabs.astro declares `export interface Props { ... }` while the sibling component ListingCard.astro uses `interface Props { ... }` (no export). Both are valid TypeScript; Astro recognises the Props interface by name regardless of the export keyword. Minor divergence from project convention.
- **Fix**: Remove the `export` keyword: change to `interface Props { ... }`.
- **Decision**: FIXED — removed `export` keyword from Props interface.
