<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Pricing and Commission (S-03)

- **Plan**: context/changes/pricing-and-commission/plan.md
- **Scope**: All phases (1–3)
- **Date**: 2026-05-29
- **Verdict**: NEEDS ATTENTION → all findings resolved during triage
- **Findings**: 0 critical · 1 warning · 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Raw DB error surfaced via commission settings fetch redirect

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence / Safety & Quality
- **Location**: src/pages/dashboard/settings/commission.astro:25–27
- **Detail**: fetchError.message passed raw into dashboard redirect URL; dashboard.astro renders it verbatim. Violated the "Map internal DB errors to safe Polish strings" lesson. pricing.astro correctly uses a hardcoded Polish string for the equivalent path.
- **Fix**: Replaced `fetchError.message` with hardcoded Polish string "Nie udało się pobrać ustawień prowizji. Spróbuj ponownie."
- **Decision**: FIXED

### F2 — handle_updated_at() not schema-qualified in trigger

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20260529120000_create_pricing_and_commission.sql:26
- **Detail**: EXECUTE FUNCTION handle_updated_at() resolves by search_path at creation time; not schema-qualified. Violates spirit of search_path pinning lesson.
- **Fix**: Changed to `EXECUTE FUNCTION public.handle_updated_at()`. Lesson recorded in context/foundation/lessons.md ("Schema-qualify function references in CREATE TRIGGER").
- **Decision**: FIXED + ACCEPTED-AS-RULE: Schema-qualify function references in CREATE TRIGGER

### F3 — id extracted before auth in price/set.ts

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/pages/api/listings/[id]/price/set.ts:5–11
- **Detail**: id extracted before createClient and auth. Violates "Authenticate first" lesson ordering. No security consequence.
- **Fix**: Moved id extraction to after auth block, matching update.ts pattern.
- **Decision**: FIXED

### F4 — "retry is safe" comment overstates guarantees

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/listings/[id]/price/set.ts:37
- **Detail**: Comment implied automatic retry; no retry exists. On UPDATE failure, price_history row is committed but listing.asking_price is not updated.
- **Fix**: Clarified comment to describe orphan-row scenario and manual retry requirement.
- **Decision**: FIXED

### F5 — formatPLN helper duplicated across two files

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/listings/ListingCard.astro, src/pages/dashboard/listings/[id]/pricing.astro
- **Detail**: Identical formatPLN function in both files.
- **Fix**: Extracted to src/lib/utils.ts; both files now import from there.
- **Decision**: FIXED

### F6 — 1-cent rounding delta in commission calculator not disclosed

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard/listings/[id]/pricing.astro:78
- **Detail**: Guard allows 1-cent discrepancy silently. In practice formula is algebraically exact by construction; guard is a safety net for malformed inputs only.
- **Fix**: Added inline comment explaining the guard's role and why the formula is exact.
- **Decision**: FIXED
