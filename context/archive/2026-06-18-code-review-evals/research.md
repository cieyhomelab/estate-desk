---
date: 2026-06-18T00:00:00+02:00
researcher: claude-sonnet-4-6
git_commit: 4bb94e9b0bee00beb541e27cff3515857c99bcca
branch: feature/code-review-evals
repository: cieyhomelab/estate-desk
topic: "code-reviewer eval readiness — promptfoo integration analysis"
tags: [research, code-reviewer, evals, promptfoo, vercel-ai-sdk, typescript]
status: complete
last_updated: 2026-06-18
last_updated_by: claude-sonnet-4-6
---

# Research: code-reviewer Eval Readiness — promptfoo Integration Analysis

**Date**: 2026-06-18  
**Researcher**: claude-sonnet-4-6  
**Git Commit**: 4bb94e9b0bee00beb541e27cff3515857c99bcca  
**Branch**: feature/code-review-evals  
**Repository**: cieyhomelab/estate-desk

## Research Question

Analyze the current state of `packages/code-reviewer` in the context of introducing evals — specifically reusability of prompts, importability of the agent, and alignment with promptfoo as the eval toolkit. If the tech stack is misaligned, assess alternatives.

## Summary

The `packages/code-reviewer` package was explicitly designed as the promptfoo eval prerequisite (`context/archive/2026-06-16-tool-loop-agent/plan.md:29` — "Promptfoo evals will import directly from `agent.ts`"). The package is already eval-ready: `reviewCode()` is a clean importable function, `SYSTEM_PROMPT` is a plain exported string, and `reviewSchema` is a standalone Zod object. promptfoo supports all required capabilities — custom TypeScript providers, ESM, structured JSON assertions, LLM-as-judge, and OpenRouter natively. **The stack is well-aligned. One practical risk**: the ESM monorepo import path may require the package to be pre-built (`npm run build --prefix packages/code-reviewer`) before promptfoo can resolve the import, since promptfoo's TypeScript loader may not traverse workspace boundaries.

---

## Detailed Findings

### 1. Package Architecture — Already Eval-Ready

The `tool-loop-agent` refactor (archived `2026-06-16`) split what was originally a single-file script into a clean 4-module structure:

| File | Role | Eval relevance |
|------|------|----------------|
| `src/agent.ts` | `reviewCode()` function + `ReviewOutput` export | **Primary import target for promptfoo provider** |
| `src/prompt.ts` | `SYSTEM_PROMPT` as an exported string constant | Directly importable; can be used in multi-prompt comparison tests |
| `src/schema.ts` | `reviewSchema` (Zod) + `ReviewOutput` type | Usable in custom assertion functions (`reviewSchema.safeParse(output)`) |
| `src/index.ts` | CLI entrypoint (reads env vars, calls `reviewCode()`) | **Not used by evals** — evals import `agent.ts` directly |

The archived plan explicitly documented this separation:  
> `context/archive/2026-06-16-tool-loop-agent/plan.md:5` — "so the reviewer can be imported and called from promptfoo evals without coupling to the CLI runner."  
> `context/archive/2026-06-16-tool-loop-agent/plan.md:124` — "so promptfoo evals importing agent.ts directly don't need to pre-load dotenv."

**Implication**: `dotenv/config` is loaded only in `index.ts`, not in `agent.ts`. Promptfoo evals need to inject `OPENROUTER_API_KEY` via their own env mechanism.

### 2. promptfoo Capability Fit

All seven required capabilities confirmed:

#### Custom TypeScript Provider — Full Support

promptfoo's `file://` provider syntax accepts a `.ts` file that exports `callApi()`. The `reviewCode()` function maps directly:

```typescript
// promptfoo-provider.ts  (to be created in packages/code-reviewer/)
import { reviewCode } from './src/agent.js';
import type { ApiProvider, ProviderResponse } from 'promptfoo';

export default {
  id: () => 'code-reviewer',
  async callApi(_prompt: string, context?: { vars?: Record<string, string> }): Promise<ProviderResponse> {
    const vars = context?.vars ?? {};
    const result = await reviewCode({
      diff: vars.diff,
      prTitle: vars.prTitle,
      prBody: vars.prBody,
    });
    return { output: result };  // output can be a plain object
  },
} satisfies ApiProvider;
```

#### ESM Compatibility — Supported

promptfoo handles ESM natively (`.mjs` and `"type": "module"` packages). Official ESM provider example exists in the promptfoo GitHub repo. No bundler aliases are used in `code-reviewer`, so no friction expected on that front.

#### Structured JSON Assertions — Full Support

When `callApi()` returns `{ output: <object> }`, promptfoo passes the raw object to JavaScript assertions. Zod-powered assertions:

```yaml
assert:
  - type: javascript
    value: |
      const { reviewSchema } = await import('./src/schema.js');
      return reviewSchema.safeParse(output).success;
  - type: javascript
    value: output.overall_score >= 0 && output.overall_score <= 10
  - type: javascript
    value: output.criteria.length === 6
```

#### LLM-as-Judge — Fully Supported

```yaml
defaultTest:
  assert:
    - type: llm-rubric
      value: "The review identifies specific issues and the overall_score reflects the actual severity of problems in the diff."
      provider: openrouter:anthropic/claude-sonnet-4-6
```

OpenRouter is a first-class promptfoo provider (`openrouter:<model-id>`), using the same `OPENROUTER_API_KEY` env var as the agent itself.

#### Test Case Format — Concrete Config Sketch

```yaml
# packages/code-reviewer/promptfooconfig.yaml
description: "Code reviewer agent evals"

providers:
  - file://./promptfoo-provider.ts

prompts:
  - "{{diff}}"  # required field; provider ignores it, uses vars directly

defaultTest:
  assert:
    - type: javascript
      value: output.criteria.length === 6
    - type: javascript
      value: output.overall_score >= 0 && output.overall_score <= 10

tests:
  - description: "Clean, minimal diff should score >= 7"
    vars:
      prTitle: "Add null check before user.profile access"
      diff: |
        -  return user.profile.email;
        +  if (!user) return null;
        +  return user.profile.email;
    assert:
      - type: javascript
        value: output.overall_score >= 7

  - description: "SQL injection vulnerability should score < 5 on security"
    vars:
      prTitle: "Add search endpoint"
      diff: |
        +  const q = `SELECT * FROM users WHERE id = ${req.params.id}`;
    assert:
      - type: javascript
        value: output.overall_score < 5
      - type: llm-rubric
        value: "The review identifies a SQL injection vulnerability in the security_safety criterion issues"
```

### 3. Historical Context — Designed for This Moment

The `tool-loop-agent` refactor was scoped *specifically* to enable evals:
- `context/archive/2026-06-16-tool-loop-agent/plan-brief.md:7` — explicit out-of-scope note: "Out of scope: Tools, promptfoo eval config, new dependencies..."
- The plan review (`reviews/plan-review.md:52`) flagged the exact env var concern: "Promptfoo evals importing agent.ts directly would get undefined for the key if they rely on dotenv rather than pre-set env vars."

This is already resolved — `agent.ts` reads `process.env.OPENROUTER_API_KEY` directly, not via dotenv.

---

## Code References

- `packages/code-reviewer/src/agent.ts:8-29` — `reviewCode()` function — primary eval entry point
- `packages/code-reviewer/src/prompt.ts:1` — `SYSTEM_PROMPT` string export — importable for multi-prompt tests
- `packages/code-reviewer/src/schema.ts:17-23` — `reviewSchema` Zod object + `ReviewOutput` type
- `packages/code-reviewer/src/index.ts:1-35` — CLI entrypoint — NOT used by evals
- `packages/code-reviewer/package.json:3` — `"type": "module"` (ESM)
- `context/archive/2026-06-16-tool-loop-agent/plan.md:29` — explicit design intent for promptfoo
- `context/archive/2026-06-16-tool-loop-agent/plan.md:124` — dotenv isolation decision

---

## Architecture Insights

**Prompt reusability**: `SYSTEM_PROMPT` is a pure string constant — no template variables, no runtime dependencies. It can be:
1. Imported directly in the custom provider (current usage)
2. Extracted to a `prompt.txt`/`prompt.md` file for promptfoo's native `file://` prompt loading
3. Used in multi-prompt A/B tests (e.g., compare current prompt vs. a revised prompt across the same test set)

**Schema reusability**: `reviewSchema` is a standalone Zod v4 object with no external dependencies. In promptfoo assertions it can be used for both structural validation (`safeParse`) and field extraction.

**Agent importability**: `reviewCode()` is a pure async function with no side effects at module load time. It's safe to import in a promptfoo provider without triggering dotenv loading or process.exit calls. The only runtime requirement is `OPENROUTER_API_KEY` in `process.env`.

**`ToolLoopAgent` opacity**: The Vercel AI SDK v6 `ToolLoopAgent` is a black box from promptfoo's perspective — promptfoo won't trace its internal LLM calls. This is fine for output quality evals (asserting on the final `ReviewOutput`), but means you can't inspect intermediate tool calls or token counts from within the eval framework.

---

## Known Risk — ESM Monorepo Import

The `#1 practical friction point`: promptfoo resolves provider files using its own TypeScript loader (tsx-based). If the provider file imports from `./src/agent.js` (relative path within the same package), it should resolve correctly. However, if you later move the provider outside `packages/code-reviewer/` (e.g., to the repo root), the workspace import `import { reviewCode } from 'code-reviewer'` may fail without a prior build step.

**Mitigation**: Keep `promptfoo-provider.ts` inside `packages/code-reviewer/`, co-located with the source. Add a `pretest` script or note in `promptfooconfig.yaml` comments that `npm run build --prefix packages/code-reviewer` is required in CI.

---

## Alternative Tools — Brief Assessment

| Tool | Alignment | Key differentiator |
|------|-----------|-------------------|
| **promptfoo** | ✅ Good fit | Full custom provider, OpenRouter native, YAML-driven CI integration |
| **Evalite** (v0.19.0) | ✅ Better TypeScript DX | Pure TypeScript `.eval.ts` files, Vitest-native, live UI — but slow maintenance (last release 7 months ago) and no CI/CD ecosystem |
| **Braintrust** | ⚠️ Overkill | Excellent multi-agent tracing and PR diff comments, but heavy SaaS overhead for a single-function eval |

**Recommendation**: Stay with promptfoo. The custom provider pattern is lightweight, OpenRouter support is native, and the CI/GitHub Actions integration is mature.

---

## Open Questions

1. **Test fixture sourcing**: Where do real `diff` + `prTitle` samples come from? Options: (a) replay from past CI runs on this repo, (b) synthetic diffs crafted per criterion, (c) curated golden set from production PRs. Decision needed before writing test cases.
2. **Pass threshold**: Is `overall_score >= 7` the right eval gate? The same threshold is used in CI today (`index.ts:28`) — aligning evals to this threshold makes CI/eval outputs comparable.
3. **Multi-prompt experiments**: Will evals be used to A/B test prompt variants (e.g., adding criterion weighting hints to `SYSTEM_PROMPT`)? If yes, extract the prompt to a standalone file now rather than in a later change.
4. **Eval frequency**: One-off local runs vs. CI gate vs. scheduled regression? Determines whether promptfoo config lives in `packages/code-reviewer/` or at the repo root.

---

## Related Research

- `context/archive/2026-06-16-tool-loop-agent/plan.md` — package modularization that enabled this eval work
- `context/archive/2026-06-16-tool-loop-agent/plan-brief.md` — brief with explicit eval foresight
- `context/archive/2026-06-16-tool-loop-agent/reviews/plan-review.md` — env var isolation concern (now resolved)
- `context/changes/ci-cd-code-review/research.md` — prior research on the CI integration using this package
