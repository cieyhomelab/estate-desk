<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Pricing and Commission (S-03)

- **Plan**: context/changes/pricing-and-commission/plan.md
- **Scope**: Phase 2 of 3
- **Date**: 2026-05-29
- **Verdict**: NEEDS ATTENTION (resolved via triage)
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Raw Supabase error messages reflected to UI

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/settings/commission.ts:42, src/pages/dashboard/settings/commission.astro:45
- **Detail**: `error.message` from supabase-js placed raw into redirect URL and rendered verbatim in Banner. No XSS (Astro escapes), but internal DB strings shown in Polish UI. Matches existing pattern in create.ts/edit.astro.
- **Fix**: Map DB errors to safe Polish error codes; add generic fallback. Lesson recorded.
- **Decision**: FIXED + ACCEPTED-AS-RULE: "Map internal DB errors to safe Polish strings before surfacing to the user"

### F2 — Upsert without .select() — intentional per plan

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/settings/commission.ts:37
- **Detail**: Upsert returns only `{ error }`, no data. Plan-confirmed intentional — page re-fetches on next GET.
- **Fix**: No change required. Chain `.select('id')` if explicit write-verification desired in future.
- **Decision**: SKIPPED

### F3 — ESLint override list will grow with each new redirect-using page

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: eslint.config.js:77
- **Detail**: Per-file override approach is correct but requires manual upkeep as more pages are added.
- **Fix**: Add maintenance comment noting every new `.astro` page using `return Astro.redirect()` must be added explicitly.
- **Decision**: FIXED
