<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: EstateDesk Coding Conventions

- **Plan**: `context/changes/claude-md-conventions/plan.md`
- **Scope**: Phase 1 of 1
- **Date**: 2026-06-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS (automated ✅; manual ⏳ pending) |

## Findings

### F1 — envField example omits optional: true, diverging from project pattern

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality / Pattern Consistency
- **Location**: CLAUDE.md Section 5 (Astro Env Schema)
- **Detail**: The documented example shows `envField.string({ context: "server", access: "secret" })` without `optional: true`. Every existing variable in `astro.config.mjs` uses `optional: true`. Without it, the app throws a hard build/startup error if `OPENROUTER_API_KEY` is not set — breaking the dev server for any developer who hasn't configured the secret locally.
- **Fix A ⭐ Recommended**: Add `optional: true` to match the project convention — `OPENROUTER_API_KEY: envField.string({ context: "server", access: "secret", optional: true })`.
  - Strength: Matches all three existing variables; dev server still starts without the key set.
  - Tradeoff: Key is truly required for S-02; developers may get a silent runtime failure instead of a clear build error.
  - Confidence: HIGH — matches every other env var in this project.
  - Blind spot: None significant.
- **Fix B**: Add a clarifying sentence explaining the deliberate omission: "(Omit `optional: true` if the key is required in all environments — the build will fail fast if it is not set.)"
  - Strength: Makes the trade-off explicit; the original example is technically valid for a required key.
  - Tradeoff: More prose; harder to scan quickly.
  - Confidence: MEDIUM — depends on S-02's error-handling approach for missing key.
  - Blind spot: Haven't confirmed S-02's error handling for missing OPENROUTER_API_KEY.
- **Decision**: PENDING

### F2 — client:only example uses a fictional component name

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: CLAUDE.md Section 1 (React Island Hydration)
- **Detail**: `<BrowserOnlyWidget client:only="react" />` uses a fictional component name. No `client:only` usage exists in the codebase yet. The example is clearly illustrative. No correctness risk.
- **Fix**: Accept as-is — illustrative examples don't need to reference real components. The comment "Only when the component requires browser-only APIs" already signals this is hypothetical guidance.
- **Decision**: PENDING
