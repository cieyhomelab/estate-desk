<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Introduce promptfoo Evals into code-reviewer

- **Plan**: context/changes/code-review-evals/plan.md
- **Mode**: Deep
- **Date**: 2026-06-18
- **Verdict**: REVISE → SOUND (after fixes)
- **Findings**: 2 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

5/5 paths ✓ (agent.ts, schema.ts, package.json, tsconfig.json, dist/), 3/3 symbols ✓ (reviewCode, reviewSchema, ToolLoopAgent). contract-surfaces.md absent — surface check skipped. No plan-brief.md. tsconfig.json grounding escalated → F1.

## Findings

### F1 — tsconfig `rootDir: "src"` blocks type-checking of root-level promptfoo-provider.ts

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Success Criteria (Automated)
- **Detail**: tsconfig.json has `rootDir: "src"` and `include: ["src"]`. Adding a root-level provider file to include causes TypeScript to error on rootDir mismatch. `tsc --noEmit` without tsconfig bypasses NodeNext module resolution. Phase 3's "Type-check passes" criterion could not be satisfied as originally written.
- **Fix A ⭐ Recommended**: Move promptfoo-provider.ts into src/promptfoo-provider.ts; update YAML config to `file://./src/promptfoo-provider.ts`. Zero tsconfig changes; covered by existing `npm run typecheck`.
  - Strength: Removes rootDir conflict entirely; no new files to maintain.
  - Tradeoff: Provider lives in src/ alongside business logic.
  - Confidence: HIGH
  - Blind spot: None significant.
- **Fix B**: Add tsconfig.eval.json at root with rootDir: ".". Update Phase 3 criterion to `tsc -p tsconfig.eval.json --noEmit`.
  - Strength: Keeps provider at package root as originally planned.
  - Tradeoff: Two tsconfigs to maintain.
  - Confidence: HIGH
  - Blind spot: outDir must be set or emit disabled.
- **Decision**: FIXED via Fix A — provider moved to src/promptfoo-provider.ts, YAML updated to file://./src/promptfoo-provider.ts, import path updated to ./agent.js.

### F2 — Progress section missing automated item for Phase 4

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 4 Progress block
- **Detail**: Phase 4 body had an Automated Verification bullet ("File exists at the expected path") but the Progress section had only a Manual item (4.1). Progress format contract requires a matching `- [ ]` for every automated verification bullet.
- **Fix**: Add Automated subsection in Phase 4 Progress with `- [ ] 4.1 Fixture file exists at evals/fixtures/react-migration.diff`; renumber Manual item to 4.2.
- **Decision**: FIXED — automated item 4.1 added, manual item renumbered to 4.2.

### F3 — Inline Zod schema in YAML assertion used z.string() for `name`; real schema uses z.enum()

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 5 — promptfooconfig.yaml defaultTest assertions
- **Detail**: schema.ts enforces `name: z.enum(["implementation_correctness", ...])`. The original YAML assertion reconstructed a looser schema with `name: z.string()`, allowing hallucinated criterion names to pass. Also lost `.length(6)` coverage when switching to schema import (reviewSchema uses z.array() with no length constraint).
- **Fix A ⭐ Recommended**: Import `reviewSchema` from `./src/schema.js` directly. Add separate `output.criteria.length === 6` assertion to preserve count gate.
  - Strength: Single source of truth; no drift; sidesteps Zod v4 .length() question.
  - Tradeoff: Relies on dynamic import resolving from promptfoo assertion context (confirmed working in research.md).
  - Confidence: HIGH
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — schema imported from ./src/schema.js; separate criteria.length === 6 assertion added; assertion count updated to 5 throughout plan.

### F4 — Phase 2 criterion `npm run eval --help` intercepted by npm

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2 — Success Criteria (Automated)
- **Detail**: `npm run eval --help` has npm consume `--help` and print its own output. Double-dash separator is required to forward flags to the underlying command.
- **Fix**: Change to `npm run eval -- --help`.
- **Decision**: FIXED — criterion updated in plan body and Progress section.
