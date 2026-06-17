# CI/CD AI Code Review — Plan Brief

> Full plan: `context/changes/ci-cd-code-review/plan.md`
> Research: `context/changes/ci-cd-code-review/research.md`

## What & Why

Add a GitHub Actions workflow that runs AI-powered code review on every PR to main. The existing `packages/code-reviewer` package has the LLM wiring but was built for a different input/output shape; it needs updating to support PR context and 6-criterion scored output before the workflow can use it.

## Starting Point

`packages/code-reviewer` today accepts a raw code string and returns `{ approved: boolean }` with a generic prompt. `ci.yml` has no review step, no `ai-cr:*` labels exist in the repo, and `OPENROUTER_API_KEY` is absent from repo secrets.

## Desired End State

Every PR to main receives an AI code review comment with 6 scored criteria, a summary, and an overall pass/fail label (`ai-cr:passed` / `ai-cr:failed`). Contributors can re-trigger the review by adding the `ai-cr:review` label. The main workflow file stays thin — all review logic lives in a composite action.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Pass/fail threshold | overall_score ≥ 7 | Deterministic, easy to audit and adjust without model variation | Plan |
| PR body inclusion | Always include | Low cost; helps model verify code matches PR claims | Plan |
| Diff size limit | Truncate at 4000 lines | Covers 99% of PRs; prevents silent API failures on large diffs | Plan |
| Model | Keep claude-sonnet-4-5 via OpenRouter | Already tested locally; no API key change needed | Plan |
| Label creation | Idempotent in composite action | Zero manual setup; survives accidental label deletion | Plan |
| `passed` computation | Set in index.ts post-parse, not by model | Deterministic — model doesn't set it, script computes `overall_score >= 7` | Plan |
| Comment generation | Python 3 in composite action | Avoids fragile bash string manipulation for markdown tables | Plan |
| Diff source | Computed inside composite action | Avoids env var size limits that would occur passing large diffs as inputs | Plan |

## Scope

**In scope:**
- Schema, prompt, agent signature, and entry point updates to `packages/code-reviewer`
- `.github/actions/ai-code-review/action.yml` (new composite action)
- `.github/workflows/code-review.yml` (new workflow)
- Committing `package-lock.json` for the package

**Out of scope:**
- Modifying existing `ci.yml`
- Adding tests to `packages/code-reviewer`
- Business alignment / architectural fit criteria (parked in requirements)
- Setting up `OPENROUTER_API_KEY` in repo secrets (manual prereq)
- Blocking PR merge on review result (informational only)

## Architecture / Approach

The main workflow is a thin orchestrator: checkout + fetch origin/main + call composite action. The composite action owns everything review-related — idempotent label creation, Node.js setup, `npm ci` + build, git diff computation with 4000-line truncation, LLM invocation via the Node script, Python 3 comment formatting, and result label management. The `passed` field is computed by `index.ts` post-parse (`overall_score >= 7`) rather than delegated to the model, keeping results deterministic.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Update packages/code-reviewer | Updated schema (6 criteria), prompt (6 rubrics), agent signature, CI-ready entry point, package-lock.json | Vercel AI SDK's `Output.object` may not enforce exact array length 6 — prompt engineering may be needed |
| 2. Composite action | `.github/actions/ai-code-review/action.yml` with full review pipeline | `gh label create --force` behavior; Python 3 comment formatting edge cases (pipe chars in rationale) |
| 3. Main workflow | `.github/workflows/code-review.yml` with correct trigger + guard logic | Guard condition for labeled events must be exact; wrong expression silently skips review |

**Prerequisites:** `OPENROUTER_API_KEY` added to repo Settings → Secrets → Actions before testing Phase 3  
**Estimated effort:** ~2–3 focused sessions across 3 phases

## Open Risks & Assumptions

- `Output.object` in Vercel AI SDK may not guarantee exactly 6 criteria objects; if the model emits fewer, the schema `.length(6)` validation will throw. Mitigation: prompt explicitly names all 6 and instructs the model to always include all.
- `git diff origin/main...HEAD` assumes the main workflow fetches `origin/main` before calling the composite action — this is explicit in the workflow but easy to miss if the action is reused elsewhere.
- `OPENROUTER_API_KEY` must be manually added to repo secrets; workflow fails until this is done.

## Success Criteria (Summary)

- Open a PR to main → review comment appears with 6 scored criteria + pass/fail label within 2 minutes
- Add `ai-cr:review` label to an existing PR → review re-runs and label is removed after completion
- Adding an unrelated label does NOT trigger a review run
