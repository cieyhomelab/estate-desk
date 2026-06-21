---
date: 2026-06-17T00:00:00+00:00
researcher: Claude Sonnet 4.6
git_commit: 2b3ff108c0f5bb6a30dc7b294388508c050b8b45
branch: feature/cicd-code-review
repository: cieyhomelab/estate-desk
topic: "CI/CD AI code review — GitHub Actions workflow and composite action"
tags: [research, codebase, ci-cd, github-actions, code-reviewer, ai-sdk]
status: complete
last_updated: 2026-06-17
last_updated_by: Claude Sonnet 4.6
---

# Research: CI/CD AI Code Review

**Date**: 2026-06-17  
**Researcher**: Claude Sonnet 4.6  
**Git Commit**: `2b3ff108c0f5bb6a30dc7b294388508c050b8b45`  
**Branch**: `feature/cicd-code-review`  
**Repository**: `cieyhomelab/estate-desk`

## Research Question

Research the codebase to understand what exists and what gaps must be closed to implement a GitHub Actions workflow + composite action that runs AI-powered code review on every PR to main, based on `context/changes/ci-cd-code-review/requirements.md`.

---

## Summary

The `packages/code-reviewer` package already implements the AI SDK agent loop (Vercel AI SDK + OpenRouter + Claude Sonnet 4-5) with a Zod-typed output schema and ToolLoopAgent. It is functional as a local CLI tool. However it was built for a different input shape (raw code string) and output shape (generic `approved: boolean`) than what the requirements call for (PR title + diff → 6 scored criteria → PR comment + GitHub labels).

The existing CI pipeline (`ci.yml`) has no review step. A new workflow file and a composite action need to be added. The package itself needs schema, prompt, and agent signature updates before the workflow can use it.

There is also a ready-made reference template for a different review pattern (`10x-impl-review-ci`) — that one is a **claude-code-action** agentic runner, not a Node.js package runner. The two are architecturally distinct; the requirements target the package-runner approach.

---

## Detailed Findings

### 1. Existing CI/CD Pipeline

**File**: `.github/workflows/ci.yml:1-83`

Three-job pipeline:

| Job | Trigger | Purpose |
|-----|---------|---------|
| `ci` | push/PR to main | type-check, lint, test (unit + integration + e2e), build |
| `deploy` | push to main only | Cloudflare Workers deploy via wrangler-action |
| `migrate` | push to main only | `supabase db push` |

Key observations:
- Uses `npm` (not pnpm) and Node 22
- Secrets already wired for Supabase and Cloudflare; **`OPENROUTER_API_KEY` is absent**
- No `labeled` event trigger; adding one is required for on-demand retry
- No existing composite action pattern to mirror

### 2. Code Reviewer Package — Current State

**Package root**: `packages/code-reviewer/`

| File | Purpose |
|------|---------|
| `src/schema.ts` | Zod schema for structured output |
| `src/prompt.ts` | System prompt string |
| `src/agent.ts` | `reviewCode(code: string)` — ToolLoopAgent call |
| `src/index.ts` | CLI entry point (local testing only) |
| `dist/` | Pre-compiled JS (built with `tsc`) |
| `.env.example` | `OPENROUTER_API_KEY=` |

**Current schema** (`src/schema.ts:3-13`):
```ts
z.object({
  summary: z.string(),
  issues: z.array(z.object({
    severity: z.enum(["error", "warning", "info"]),
    description: z.string(),
    suggestion: z.string().optional(),
  })),
  approved: z.boolean(),
})
```

**Current prompt** (`src/prompt.ts:1-2`):
> "You are a senior code reviewer. Report only genuine issues: correctness bugs, security problems, and clear maintainability concerns. Do not invent problems — an empty findings list is a valid result."

**Current agent signature** (`src/agent.ts:9`):
```ts
async function reviewCode(code: string): Promise<ReviewOutput>
```
Prompt fed to model: `"Review this code for bugs and issues:\n\n${code}"`

**Dist / source drift**: `dist/agent.js` says `"Review this JavaScript code for bugs and issues"` — the dist is one wording-iteration behind the source. Must rebuild before CI use.

**AI stack**:
- `ai@^6.0.0` — Vercel AI SDK with `ToolLoopAgent` + `Output.object`
- `@openrouter/ai-sdk-provider@^2.9.1` — OpenRouter gateway
- Model: `anthropic/claude-sonnet-4-5` via OpenRouter
- `zod@^4.0.0` — schema validation

### 3. Gap Analysis: Requirements vs Current Package

| Requirement | Current state | Required change |
|-------------|---------------|-----------------|
| Input: PR title | Not accepted | Add to agent signature + prompt |
| Input: PR description (optional, cost concern) | Not accepted | Add as optional param |
| Input: git diff | `code: string` raw code | Rename param, update prompt framing |
| 6 scored criteria (1–10) | `approved: boolean` | Extend Zod schema; add `criteria` array |
| Per-criterion rubric in prompt | Generic prompt | Rewrite system prompt with all 6 rubrics |
| PR comment with summary | Absent (CLI stdout only) | CI step: `gh pr comment` |
| Label `ai-cr:passed` or `ai-cr:failed` | Absent | CI step: `gh pr edit --add-label` |
| On-demand retry via `ai-cr:review` label | Absent | Workflow: `pull_request: types: [labeled]` |
| OPENROUTER_API_KEY in CI | Absent from secrets | Add to repo secrets; reference in workflow |

### 4. Required Schema Extension

The 6 criteria from requirements map to this schema extension:

```ts
const criterionSchema = z.object({
  name: z.enum([
    "implementation_correctness",
    "idiomaticity",
    "complexity",
    "test_risk_coverage",
    "documentation",
    "security_safety",
  ]),
  score: z.number().int().min(1).max(10),
  rationale: z.string(),
  issues: z.array(z.string()).optional(),
});

export const reviewSchema = z.object({
  summary: z.string(),
  criteria: z.array(criterionSchema),
  overall_score: z.number().int().min(1).max(10),
  passed: z.boolean(),  // rename from approved for clarity
});
```

Pass/fail threshold: a natural choice is `passed = overall_score >= 7` (or all criteria >= 5). The exact threshold is a planning decision.

### 5. Composite Action vs Workflow Split

Requirements specify: "composite action for the review itself so that main workflow is easy to reason about."

Proposed layout:
```
.github/
  actions/
    ai-code-review/
      action.yml          ← composite action (inputs: pr-number, pr-title, pr-body, diff)
  workflows/
    code-review.yml       ← orchestrator (checkout, get diff, call action, set labels)
```

The composite action encapsulates:
1. Setup Node + install `packages/code-reviewer`
2. Build from source (`npm run build`)
3. Run reviewer with PR context piped as env vars / stdin
4. Parse JSON output
5. Post `gh pr comment`
6. Apply `ai-cr:passed` or `ai-cr:failed` label (remove the opposite)

The main workflow handles:
- Trigger conditions
- Checkout
- Getting the diff (`git diff origin/main...HEAD`)
- Calling the composite action
- Removing `ai-cr:review` label after retry

### 6. On-Demand Retry Logic

Requirements: "on-demand retry when label `ai-cr:review` (grey) is added"

Workflow trigger:
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
  pull_request:
    types: [labeled]
```
Note: GitHub does not allow two `pull_request` keys. The idiomatic form is:
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled]
```

Guard in workflow: only run full review if `github.event.action == 'labeled' && github.event.label.name == 'ai-cr:review'` OR `github.event.action` is one of `opened/synchronize/reopened`.

After review completes, remove `ai-cr:review` label so the user can re-trigger cleanly.

### 7. PR Body (Cost Tradeoff — requirements note "?? cost tradeoff")

The requirements flag PR description as optional. Sending the diff + PR title is mandatory; the body is extra context. Given Claude Sonnet 4-5's low cost per token via OpenRouter, including PR body is recommended — it helps the model assess whether the code does what the PR claims. This is a planning decision but the implementation should support it via a boolean workflow input.

### 8. Security Model

The workflow should use `pull_request` (not `pull_request_target`) for PR-triggered runs. This means:
- It runs in the context of the PR head branch
- Secrets are available (since we control the repo — no forks)
- No risk of malicious fork PRs accessing `OPENROUTER_API_KEY`

### 9. Reference Template — What NOT to Mirror

`.claude/skills/10x-impl-review-ci/references/workflow-template.yml` is a claude-code-action@v1 pattern where the model itself is the CI runner. It uses `anthropics/claude-code-action@v1` to execute a skill as an interactive agent inside CI.

Our use case is a **deterministic Node.js runner** — the model is called once, produces structured JSON, and the workflow shell script handles GitHub API calls. The impl-review-ci template is not a model to copy structurally.

However, two patterns from that template are reusable:
- Guard step skipping re-runs on bot-authored commits / label-only events when nothing changed
- Posting commit status (not strictly needed here since we use labels, but useful for PR checks UI)

---

## Code References

- `packages/code-reviewer/src/schema.ts:1-13` — current Zod schema (needs extension)
- `packages/code-reviewer/src/prompt.ts:1-2` — current system prompt (needs rewrite)
- `packages/code-reviewer/src/agent.ts:9-23` — ToolLoopAgent invocation pattern
- `packages/code-reviewer/src/index.ts:1-21` — CLI entry, shows stdout JSON pattern
- `packages/code-reviewer/package.json:1-22` — build/run scripts (`npm run build`, `node dist/index.js`)
- `.github/workflows/ci.yml:1-83` — existing CI pipeline (no review step)
- `.claude/skills/10x-impl-review-ci/references/workflow-template.yml:1-301` — reference for label-based guard and status posting patterns

---

## Architecture Insights

1. **Two-phase build**: The package must be compiled before CI can run it. `npm ci && npm run build` in `packages/code-reviewer` produces `dist/index.js`. The composite action should build from source to avoid stale dist artifacts.

2. **Environment variable pattern**: `OPENROUTER_API_KEY` is read from `process.env` in `agent.ts`. In CI this becomes `env: OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}` in the composite action.

3. **Output piping**: The current `index.ts` writes `JSON.stringify(output)` to stdout. The CI step can capture this with `OUTPUT=$(node dist/index.js)` and parse it with `jq` for label/comment decisions.

4. **Agent input redesign**: `reviewCode(code: string)` needs to become `reviewCode(params: { diff: string; prTitle: string; prBody?: string })`. This means the `index.ts` entry point must also change (or the CI calls a separate script).

5. **Label management**: GitHub labels must be pre-created in the repo before the workflow can apply them. The three required labels are: `ai-cr:review` (grey), `ai-cr:passed` (green), `ai-cr:failed` (red). The composite action should apply the correct result label and remove the other.

---

## Historical Context

- `context/archive/2026-06-02-testing-e2e-ci-gate/` — prior CI gate work; established the pattern of using GitHub Actions secrets for Supabase. Confirms this team is comfortable adding secrets.
- `context/archive/2026-05-22-bootstrap-verification/` — initial project bootstrap; `ci.yml` was established here.
- Recent commits (`20f3f13`, `ab4d125`) — the code-reviewer package itself was built in the last sprint cycle as a standalone package. The `tool-loop-agent` change (`20f3f13`) was the latest iteration.

---

## Open Questions

1. **Pass/fail threshold**: What score constitutes `ai-cr:passed`? Overall ≥ 7? All criteria ≥ 5? Or just `passed: boolean` delegated to the model?
2. **PR body inclusion**: Include PR description in the prompt? Low cost but worth confirming intent given the "?? cost tradeoff" note.
3. **Diff size limit**: Very large diffs will hit token limits. Should there be a truncation strategy (e.g., `git diff --stat` summary if diff > N lines)?
4. **Model selection**: Stay with `anthropic/claude-sonnet-4-5` via OpenRouter, or switch to direct Anthropic API (`claude-sonnet-4-6`) for latest capabilities?
5. **GitHub label pre-creation**: Should label creation be part of the workflow (idempotent `gh label create --force`) or documented as a one-time repo setup step?
6. **Composite action inputs**: Should `pr-body` be an explicit input with a boolean `include-pr-body` toggle, or always passed and left to the model to use contextually?
