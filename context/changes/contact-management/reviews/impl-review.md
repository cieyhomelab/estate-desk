<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Contact Management (pre-implementation plan quality)

- **Plan**: `context/changes/contact-management/plan.md`
- **Scope**: Pre-implementation — plan vs. roadmap S-04 and lessons.md (0 of 13 progress items complete)
- **Date**: 2026-05-30
- **Verdict**: NEEDS ATTENTION → APPROVED after triage
- **Findings**: 0 critical · 4 warnings · 0 observations

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING → FIXED |
| Architecture | PASS |
| Pattern Consistency | WARNING → FIXED |
| Success Criteria | PASS |

## Findings

### F1 — supabase null guard missing from contacts.astro and both API route contracts

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality / Pattern Consistency
- **Location**: plan.md — Phase 2 (create.ts, delete.ts contracts) + Phase 3 (contacts.astro contract)
- **Detail**: createClient() returns null when env vars are absent. All existing pages and API routes guard against this (pricing.astro: `if (id && supabase)`, price/set.ts: `if (!supabase) { return redirect() }`). The plan contracts skipped this guard entirely.
- **Decision**: FIXED + ACCEPTED-AS-RULE: "Plan contracts must include the supabase null guard"

### F2 — contacts.astro listing fetch method unspecified (.single + PGRST116 pattern)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: plan.md — Phase 3, contacts.astro Contract block
- **Detail**: Plan used pseudo-SQL for listing fetch without specifying `.single<Listing>()` or the PGRST116 error-branch pattern. Both edit.astro and pricing.astro use `.single()` with the PGRST116 check.
- **Decision**: FIXED (covered by F1 patch — contract now specifies `.single<Listing>()` and PGRST116 branching)

### F3 — contacts list query error path unspecified in contacts.astro contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: plan.md — Phase 3, contacts.astro Contract block
- **Detail**: Contacts list fetch had no `{ data, error }` destructuring instruction — error could be silently swallowed and render as an empty list.
- **Decision**: FIXED (covered by F1 patch — contract now specifies `const { data: contacts, error: contactsError }` with explicit error Banner branch)

### F4 — delete route contract missing instruction to leave inline idempotency comment

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: plan.md — Phase 2, delete route Contract block
- **Detail**: Plan documented idempotency in prose ("0 rows deleted is not an error") but lessons.md rule 7 says the signal must live at the code site. Contract had no instruction to leave an inline comment.
- **Decision**: FIXED + ACCEPTED-AS-RULE: "Delete route contracts must instruct the inline idempotency comment"
