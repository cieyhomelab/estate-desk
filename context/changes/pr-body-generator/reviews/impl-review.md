<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: PR Body Generator — Write the skill definition

- **Plan**: context/changes/pr-body-generator/plan.md
- **Scope**: Phase 1 of 1 (full plan)
- **Date**: 2026-06-15
- **Verdict**: APPROVED (all findings fixed during triage)
- **Findings**: 1 critical, 2 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Shell injection risk in clipboard command

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: SKILL.md — Output and Clipboard section
- **Detail**: The clipboard instruction used `printf '%s' "<assembled body>"` as a template. Naive string interpolation of a PR body containing `$(...)`, backticks, or `"` would be interpreted by bash.
- **Fix Applied**: Rewrote clipboard section to use `cat <<'PREOF' | pbcopy ...` heredoc pattern with an explicit "never inline the body" note.
- **Decision**: FIXED via Fix A

### F2 — Single-segment path-traversal argument not rejected

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: SKILL.md — Argument Parsing section
- **Detail**: A bare `..` argument (no slash) passed normalisation unchanged, allowing `context/changes/../` to resolve to `context/` which exists, bypassing the "not found" guard.
- **Fix Applied**: Added post-normalisation guard: reject change-id values that are `.`, `..`, empty, or still contain `/` or `..`.
- **Decision**: FIXED

### F3 — Duplicate bullet in "What This Skill Does NOT Do"

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: SKILL.md — What This Skill Does NOT Do section
- **Detail**: The "Does not handle missing directory" bullet appeared twice. The second slot was intended to document the missing `change.md` case.
- **Fix Applied**: Added a distinct bullet: "Does not handle a missing `context/changes/<id>/change.md` — if the file is absent, title extraction will fail without a clear error."
- **Decision**: FIXED

### F4 — No existence check for change.md before reading

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: SKILL.md — File Reading, step 1
- **Detail**: `change.md` was read unconditionally after the directory check, without a `test -f` guard — inconsistent with the `plan.md` handling pattern.
- **Fix Applied**: Added `test -f` existence check with a clear error + STOP on failure, matching the `plan.md` step 2 pattern.
- **Decision**: FIXED

### F5 — `### Commits` heading one level deeper than peer sections

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: SKILL.md — Section mapping table, Commits row
- **Detail**: All other output sections used `##` headings; the Commits section was `###`, making it render nested under Risks.
- **Fix Applied**: Changed to `## Commits (origin/main..HEAD)` to match peer heading level.
- **Decision**: FIXED
