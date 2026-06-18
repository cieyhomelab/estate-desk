<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Introduce promptfoo Evals

- **Plan**: context/changes/code-review-evals/plan.md
- **Scope**: All Phases (1–5 of 5)
- **Date**: 2026-06-18
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical · 3 warnings · 5 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — callApi throws instead of returning { error }

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/promptfoo-provider.ts:17
- **Detail**: promptfoo's contract for custom providers is that callApi() should return { error: string } on failure rather than throwing. Without try/catch, any error aborts the entire eval run instead of marking one row as failed.
- **Fix**: Wrap callApi body in try/catch and return { error: err instanceof Error ? err.message : String(err) } on failure.
- **Decision**: FIXED — try/catch added; also widened config type (F8) in same edit.

### F2 — No timeout on agent.generate; eval run can hang indefinitely

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/agent.ts:29
- **Detail**: agent.generate has no timeout or AbortSignal. A hung connection never rejects, so the eval run hangs indefinitely.
- **Fix**: Wrap with Promise.race and AbortSignal.timeout(60_000).
- **Decision**: FIXED — AbortSignal.timeout(60_000) applied via Promise.race.

### F3 — overall_score ≤ 5 hard gate may produce misleading failures

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: promptfooconfig.yaml:43
- **Detail**: A model that correctly identifies all three flaws but holistically scores the diff as 6 fails the static gate while passing the llm-rubric. Intent is flaw detection, not score calibration.
- **Fix A ⭐ Recommended**: Raise threshold to overall_score <= 6.
- **Fix B**: Remove score gate entirely.
- **Decision**: FIXED via Fix A — threshold raised to <= 6.

### F4 — dotenv/config not loaded in provider entry point

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/promptfoo-provider.ts (top of file)
- **Detail**: index.ts loads dotenv/config; promptfoo bypasses index.ts when running the provider directly. If OPENROUTER_API_KEY is only in .env, the eval fails with an auth error.
- **Fix**: Add import 'dotenv/config' at the top of promptfoo-provider.ts.
- **Decision**: FIXED — import added.

### F5 — Provider implemented as class, plan specified a plain object

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/promptfoo-provider.ts
- **Detail**: Plan specified a default object; implementation uses a class because promptfoo instantiates with `new`. Benign and documented inline.
- **Fix**: No code change. Update plan with technical note.
- **Decision**: SKIPPED — documented inline, no action needed.

### F6 — Zod assertion inlined; LLM judge moved from defaultTest to per-test

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: promptfooconfig.yaml
- **Detail**: Plan specified await import() for Zod validation and llm-rubric in defaultTest. Both drifted due to promptfoo's sync new Function() context. Benign and documented in comments.
- **Fix**: No code change.
- **Decision**: SKIPPED — documented in comments, no action needed.

### F7 — react-dom import in fixture is a potential undeclared fourth flaw surface

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: evals/fixtures/react-migration.diff:9
- **Detail**: Fixture imports from 'react-dom'; a diligent LLM may flag the import path separately from the ReactDOM.render flaw. Not a test integrity issue since the rubric only requires the three declared flaws.
- **Fix**: Add comment in promptfooconfig.yaml near the fixture load noting the import is part of flaw 1.
- **Decision**: FIXED — comment added to promptfooconfig.yaml.

### F8 — context.config typed as Record<string, string>, too narrow

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/promptfoo-provider.ts:13
- **Detail**: config typed as Record<string, string>; should be Record<string, unknown> with cast at use-site.
- **Fix**: Widen to Record<string, unknown>.
- **Decision**: FIXED via F1 — widened in the same edit.
