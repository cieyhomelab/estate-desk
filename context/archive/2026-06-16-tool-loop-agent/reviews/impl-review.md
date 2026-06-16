<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Code Reviewer ToolLoopAgent Refactor

- **Plan**: context/changes/tool-loop-agent/plan.md
- **Scope**: Phase 1–2 of 2 (full plan)
- **Date**: 2026-06-16
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  2 warnings  3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Unplanned files in diff

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: package.json, tsconfig.json, .env.example, skills-lock.json
- **Detail**: Plan said no changes to package.json, tsconfig.json, or build scripts. Four files appeared in the diff but all predate the plan commits (from bootstrap commits fb97702, c4d4707). Safety agent confirmed package.json is identical pre/post-refactor. These are bootstrap artifacts, not changes introduced by the planned work.
- **Fix**: No code change needed — acknowledge as pre-plan bootstrap scope.
- **Decision**: FIXED — acknowledged as pre-plan bootstrap; no code change required.

### F2 — No guard for missing OPENROUTER_API_KEY

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/src/agent.ts:10
- **Detail**: process.env.OPENROUTER_API_KEY passed to createOpenRouter with no null-check. If unset, SDK receives { apiKey: undefined } and fails with opaque 401.
- **Fix**: Added early guard — read into const, throw if falsy, pass const to createOpenRouter.
- **Decision**: FIXED

### F3 — ToolLoopAgent used with no tools registered

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/src/agent.ts:11–15
- **Detail**: Switch from generateText to ToolLoopAgent was undocumented. For a zero-tool structured-output task, ToolLoopAgent is functionally equivalent but semantically the wrong abstraction. Future readers and eval consumers would not know if tool use is planned.
- **Fix**: Added inline comment `// ToolLoopAgent ready for future tool extension` above the constructor.
- **Decision**: FIXED

### F4 — System prompt hardcodes "JavaScript" for language-agnostic function

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/src/agent.ts:17
- **Detail**: generate() call passed "Review this JavaScript code..." but reviewCode() accepts any language. Copied verbatim from original.
- **Fix**: Changed to "Review this code for bugs and issues:".
- **Decision**: FIXED

### F5 — Typos in SYSTEM_PROMPT copied from original

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: packages/code-reviewer/src/prompt.ts:1–2
- **Detail**: "correctnes" (misspelling) and a run-on clause were copied verbatim from original index.ts.
- **Fix**: Corrected to "You are a senior code reviewer. Report only genuine issues: correctness bugs, security problems, and clear maintainability concerns. Do not invent problems — an empty findings list is a valid result."
- **Decision**: FIXED
