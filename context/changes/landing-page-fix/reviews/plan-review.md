<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Landing Page Fix — Login UI Redesign

- **Plan**: context/changes/landing-page-fix/plan.md
- **Mode**: Deep
- **Date**: 2026-06-20
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

8/8 paths ✓, 3/3 symbols ✓ (inputBase @ FormField.tsx:5, Button import @ SubmitButton.tsx:3, bg-cosmic @ global.css:113)

## Findings

### F1 — Nested <main> from Layout.astro not addressed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §5, Phase 3 §1, Phase 4 §1
- **Detail**: All three page contracts specified `<main>` as the outer element, but `Layout.astro:34` already wraps the slot in `<main>`. Nested mains are invalid HTML; screen readers see two main landmarks.
- **Fix Applied**: Changed all three page contracts from `<main>` to `<div>`.
- **Decision**: FIXED via Fix A

### F2 — auth-input-wrap targets the wrong div in FormField.tsx

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2 §2 — FormField.tsx contract
- **Detail**: Plan said "Outer `<div>` (currently bare `<div>`)" for `auth-input-wrap`, but that bare div is the field root (line 36, wraps label + input area + error). The design spec shows `auth-input-wrap` should be the direct parent of the icon span and input — the inner `<div className="relative">` at line 40. If the implementer removed the inner div, `auth-input-icon` would be positioned relative to the field root height (including the label), pushing the icon out of place.
- **Fix Applied**: Corrected the contract to target `<div className="relative">` (line 40) explicitly; field root at line 36 noted as unchanged.
- **Decision**: FIXED

### F3 — SignUpForm.tsx keeps English copy after Phase 3

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 3
- **Detail**: Phase 2 translated SignInForm.tsx to Polish. Phase 3 gave signup.astro the premium layout with Polish headings but left SignUpForm.tsx in English (labels, errors, button text). Creating UX inconsistency since the headings are Polish but form fields are English.
- **Fix Applied**: Added `#### 2. SignUpForm.tsx — Polish copy` task to Phase 3 with full translation contract and a matching progress checkbox (3.4).
- **Decision**: FIXED
