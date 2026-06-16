<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Code Reviewer ToolLoopAgent Refactor

- **Plan**: context/changes/tool-loop-agent/plan.md
- **Mode**: Deep
- **Date**: 2026-06-16
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: 0 critical, 2 warnings, 0 observations (all resolved)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

1/1 paths ✓, 3/3 symbols ✓ — `ToolLoopAgent` exported from `ai`, `instructions` field confirmed, `output: Output.object({schema})` on constructor confirmed, `generate()` returns `{output: InferCompleteOutput<OUTPUT>}` confirmed, `moduleResolution: bundler` confirmed.

## Findings

### F1 — Checkboxes inside Phase blocks violate progress format

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 & Phase 2 §Success Criteria sections
- **Detail**: Both Phase 1 and Phase 2 used `- [ ]` under their `#### Automated Verification` / `#### Manual Verification` headings. The progress format contract requires Phase blocks to contain plain `- ` bullets only; checkboxes must live exclusively in the `## Progress` section.
- **Fix**: Changed every `- [ ]` in Phase success criteria sections to plain `- ` bullets. Progress section (with 1.1, 1.2, 2.1–2.4 checkboxes) left unchanged.
- **Decision**: FIXED

### F2 — ReviewOutput exported from both schema.ts and agent.ts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §Schema module contract + Phase 2 §Agent module snippet
- **Detail**: Plan originally contracted both schema.ts and agent.ts to export `ReviewOutput`. Identical shape so no TS error, but ambiguous canonical import path for callers.
- **Fix**: Removed `ReviewOutput` from schema.ts contract; agent.ts is now the sole export point for the type.
- **Decision**: FIXED

### F3 — Module-level OpenRouter init breaks direct eval import without dotenv

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 §Agent module contract snippet
- **Detail**: Original snippet read `process.env.OPENROUTER_API_KEY` at module init. In ESM, this runs the moment agent.ts is imported — before any caller code runs. Promptfoo evals importing agent.ts directly would get undefined for the key if they rely on dotenv rather than pre-set env vars.
- **Fix A ⭐ Applied**: Moved `createOpenRouter` and `new ToolLoopAgent()` inside `reviewCode()`. Key is now read at call time, not import time. Any caller — runner or eval — has a chance to set env vars before the first `reviewCode()` call.
- **Decision**: FIXED via Fix A
