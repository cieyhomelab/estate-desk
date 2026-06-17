<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: CI/CD AI Code Review

- **Plan**: context/changes/ci-cd-code-review/plan.md
- **Scope**: All Phases (1–3 of 3)
- **Date**: 2026-06-17
- **Verdict**: NEEDS ATTENTION (upgraded from REJECTED after triage fixes applied)
- **Findings**: 1 critical  4 warnings  4 observations

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

### F1 — Expression injection in label steps

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: .github/actions/ai-code-review/action.yml:150–155, 162
- **Detail**: The "Apply result label" and "Remove review trigger label" steps used `${{ inputs.pr-number }}` directly in the bash `run:` body. The runner substitutes this into shell text before bash evaluates it — textbook GitHub Actions expression injection. The "Post PR comment" step already had the correct pattern (`env: PR_NUMBER: ${{ inputs.pr-number }}`, then `"$PR_NUMBER"`).
- **Fix**: Added `PR_NUMBER: ${{ inputs.pr-number }}` to the `env:` block of both steps and replaced inline expressions with `"$PR_NUMBER"`.
- **Decision**: FIXED

### F2 — Score fields not constrained to integers

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence / Safety & Quality
- **Location**: packages/code-reviewer/src/schema.ts:13, 20
- **Detail**: Plan specified `z.number().int().min(1).max(10)` for `score` and `overall_score`. Implementation used `z.number()` only — non-integer or out-of-range scores would pass Zod validation and render directly into the PR comment.
- **Fix**: Replaced `z.number()` with `z.number().int().min(1).max(10)` on both fields.
- **Decision**: FIXED

### F3 — json.load not wrapped in exception handler

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/actions/ai-code-review/action.yml:94–95
- **Detail**: Python step called `json.load(f)` with no try/except. Partial or missing output from the Node process would produce an opaque Python traceback in CI instead of a readable error.
- **Fix**: Wrapped `json.load` in `try/except (json.JSONDecodeError, FileNotFoundError)` with a clear stderr message and `sys.exit(1)`.
- **Decision**: FIXED

### F4 — readFileSync throws opaque ENOENT on missing DIFF_FILE

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/src/index.ts:20
- **Detail**: `DIFF_FILE` env var was validated as set but not as pointing to an existing file. A misconfigured path produced a raw Node.js ENOENT stack trace with no context.
- **Fix**: Added `existsSync(diffFile)` check before `readFileSync` with a clear error message.
- **Decision**: FIXED

### F5 — PR title/body enable prompt injection into review output

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/src/agent.ts:23
- **Detail**: PR title and body flowed directly into the LLM user prompt without delimiters, allowing a PR author to craft a title that manipulates the review output and forces a pass label.
- **Fix A ⭐ Applied**: Wrapped title/body in XML-style delimiters (`<pr_title>`, `<pr_body>`) in the prompt template.
- **Decision**: FIXED (Fix A)

### F6 — tsconfig.json changed but not listed in plan

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: packages/code-reviewer/tsconfig.json
- **Detail**: File not enumerated in plan's Changes Required. Content is correct and required for the build. Plan omission only.
- **Decision**: SKIPPED

### F7 — setup-node@v4 used; plan and ci.yml both specify @v6

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence / Pattern Consistency
- **Location**: .github/actions/ai-code-review/action.yml:35
- **Detail**: Plan and existing `ci.yml` both use `actions/setup-node@v6`. Composite action used `@v4`, creating version skew.
- **Fix**: Changed `actions/setup-node@v4` to `actions/setup-node@v6`.
- **Decision**: FIXED

### F8 — stdout redirect to JSON is fragile if SDK emits to stdout

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: .github/actions/ai-code-review/action.yml:71
- **Detail**: Low probability risk that third-party SDK code emits to stdout and corrupts the captured JSON. The F3 fix provides adequate error handling if this fires.
- **Decision**: SKIPPED

### F9 — fetch-depth: 0 dependency is implicit in the composite action

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: .github/actions/ai-code-review/action.yml:51
- **Detail**: `git diff origin/main...HEAD` silently produces empty diff if caller omits `fetch-depth: 0`. No error surfaced.
- **Fix**: Added comment above the diff step noting the caller dependency.
- **Decision**: FIXED
