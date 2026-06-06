<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Listing Tab Navigation

- **Plan**: `context/changes/listing-tab-navigation/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-06
- **Verdict**: SOUND
- **Findings**: 0 critical | 1 warning | 1 observation

## Verdicts

| Dimension | Verdict |
|---|---|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

5/5 existing paths ✓ (ListingTabs.astro correctly absent — new file), 3/3 styling tokens ✓ (text-blue-200/70, border-b border-white/10 pb-4, flex gap-4 all confirmed in documents.astro:88-101), brief↔plan ✓

## Findings

### F1 — contacts.astro null-listing gap invalidates plan's safety claim

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2, Change 4 — contacts.astro
- **Detail**: Plan states: "contacts.astro already guards for null listing via redirect." Confirmed false. contacts.astro:21 and :33 call `Astro.redirect()` WITHOUT `return` — execution continues and `listing` stays null. The other 4 pages all use `return Astro.redirect()` (grep-confirmed across edit, pricing, documents, close). The plan places `<ListingTabs listingId={listing.id} activeTab="contacts" />` unconditionally. TypeScript will reject this (Object is possibly null) and the build will fail.
- **Fix A**: Wrap `<ListingTabs>` in `{listing && (...)}` — minimal edit, implementer can apply in 30 seconds. Tradeoff: contacts.astro remains inconsistent with the other 4 pages.
- **Fix B ⭐ Recommended**: Fix contacts.astro to use `return Astro.redirect()` on lines 21 and 33, then place `<ListingTabs>` unconditionally — closes an existing bug, makes all 5 pages consistent in their guard pattern.
  - Confidence: HIGH — this is exactly what the other 4 pages do.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix B — added `return` to contacts.astro:21 and :33 in Key Discoveries note and contacts.astro contract steps.

### F2 — Mobile overflow strategy unspecified in component contract

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Change 1 — ListingTabs.astro contract
- **Detail**: Plan flags mobile wrapping as a risk in "Open Risks & Assumptions" but the component Contract says nothing about how to handle it. Five Polish tab labels with gap-4 spacing will overflow a 375px viewport. documents.astro uses plain `flex gap-4` for only 3 tabs; adding 2 more makes overflow near-certain at phone widths.
- **Fix**: Add `flex-wrap gap-y-2` to the tab row in the Contract section of Phase 1.
- **Decision**: FIXED — added `flex-wrap gap-y-2` to the tab row class in Phase 1 component contract.
