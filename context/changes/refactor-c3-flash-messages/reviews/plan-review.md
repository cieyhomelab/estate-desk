<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Refactor C3: Shared Flash-Slug → Message Layer

- **Plan**: context/changes/refactor-c3-flash-messages/plan.md
- **Mode**: Deep
- **Date**: 2026-06-11
- **Verdict**: REVISE → SOUND (after triage)
- **Findings**: 1 critical | 1 warning | 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | WARNING |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | FAIL |
| Plan Completeness | PASS |

## Grounding

8/8 paths ✓, commission/set.ts:30 confirmed (emits blad-zapisu → pricing.astro), contacts.astro:59-67 local map verified, getFlashMessage name: no existing collision, brief↔plan ✓, Progress↔Phase ✓

## Findings

### F1 — contacts.astro migration introduces a regression on 2 slugs

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — contacts.astro:59-67 migration
- **Detail**: contacts.astro's local map (lines 59-67) contains `nazwa-wymagana` → "Imię i nazwisko jest wymagane." and `rola-nieprawidlowa` → "Wybrana rola jest nieprawidłowa." — neither was in the plan's messages.ts inventory. Phase 2 deletes the local map, so after migration both slugs would fall back to the generic error text, losing their specific messages.
- **Fix ⭐**: Add both slugs to messages.ts inventory with the text already in contacts.astro:60-61.
- **Decision**: FIXED — added nazwa-wymagana and rola-nieprawidlowa to the slug inventory in plan.md.

### F2 — documents.astro has 4 inline error-slug banners misclassified as "success messages"

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 2 — documents.astro migration
- **Detail**: Lines 206-208 and 263 contain error banners for photo/file-upload slugs (`brak-plikow`, `nieprawidlowy-typ`, `blad-uploadu`, `brak-pliku`) — not success messages. The plan's phase note incorrectly grouped them with "success/photo/file banners." After migration, these 4 inline error mappings remain, so the stated end state "No render site contains inline slug→message string logic" would not hold.
- **Fix A ⭐**: Narrow the success criterion and "What We're NOT Doing" to explicitly exclude these 4 photo/file upload error banners. Migration unchanged.
- **Fix B**: Widen scope — add 4 slugs to messages.ts and migrate all error banners in documents.astro.
- **Decision**: FIXED via Fix A — Desired End State, What We're NOT Doing, and Phase 2 documents.astro note updated to explicitly exclude these banners.

### F3 — nie-znaleziono is a dead entry in the planned messages.ts

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 1 — messages.ts slug inventory
- **Detail**: nie-znaleziono triggers a redirect to /dashboard at the API level; no render site displays it as a banner. Including it in messages.ts is dead code.
- **Fix**: Remove from slug inventory.
- **Decision**: FIXED — removed from plan.md slug list.

### F4 — contacts.astro behavioral delta for unknown slugs not called out

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — contacts.astro migration
- **Detail**: Current local map has no fallback (unknown slug → no banner). After migration to getFlashMessage(), unknown slugs show the generic fallback banner. Benign in practice but unacknowledged.
- **Fix**: Add a one-sentence behavioral delta note to the contacts.astro migration section.
- **Decision**: FIXED — note added to contacts.astro Phase 2 contract.

### F5 — prowizja-nieprawidlowa listed twice in slug inventory

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — messages.ts slug list
- **Detail**: The slug list had prowizja-nieprawidlowa twice (second entry said "(see above)"). Plain duplicate, no functional impact.
- **Fix**: Remove duplicate bullet.
- **Decision**: FIXED — already resolved during F1 triage (slug list was rewritten without the duplicate).
