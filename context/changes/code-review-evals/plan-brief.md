# Introduce promptfoo Evals — Plan Brief

> Full plan: `context/changes/code-review-evals/plan.md`
> Research: `context/changes/code-review-evals/research.md`

## What & Why

Wire up promptfoo as the eval harness for `packages/code-reviewer` so the code-review prompt can be tested against multiple models and the results compared objectively. The motivation is to establish a quality baseline before future prompt experiments and to verify that cheaper models (`z-ai/glm-5.1`, `deepseek/deepseek-v4-flash`) can produce reviewable output compared to the production model.

## Starting Point

`packages/code-reviewer` was designed for this: `reviewCode()` is a clean importable async function, `SYSTEM_PROMPT` is an exported string, and `reviewSchema` is a Zod object usable directly in assertions. The only gap is that `reviewCode()` hardcodes the model — a one-line extension is needed to support multi-model evals.

## Desired End State

Running `npm run eval` inside `packages/code-reviewer/` produces a comparison table for three models against one test case: a React 16→19 migration diff with three deliberate flaws. Each model's output is checked against structural (Zod schema), static (score ≤ 5, ≥3 criteria flagged), and LLM-as-judge assertions verifying the correct flaws were identified.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Third model for comparison | `anthropic/claude-sonnet-4-6` as baseline | Gives a quality anchor — the current production model against which the two cheaper models are measured | Plan |
| Multi-model threading | Add `model?` param to `reviewCode()` | Keeps `agent.ts` the single entry point; provider reads model from `context.config` | Plan |
| React diff flaws | `ReactDOM.render()` + string ref + missing list keys | Spans three distinct criteria (correctness, idiomaticity, complexity) for broad signal coverage | Plan |
| LLM judge model | `anthropic/claude-sonnet-4-6` | Already validated in CI; strong reasoning for rubric-based evaluation | Research |
| Static assertion | `overall_score ≤ 5` AND `issues[]` non-empty on ≥3 criteria | Verifies both the holistic judgment and that specific issues were surfaced, not just a low score | Plan |
| promptfoo install location | Local devDependency inside `packages/code-reviewer/` | Package has its own `node_modules`; no workspace root setup to share with | Research |

## Scope

**In scope:**
- `reviewCode()` optional `model` param (backward-compatible)
- `promptfoo-provider.ts` adapter
- React 16→19 fixture diff with 3 flaws
- `promptfooconfig.yaml` with 3 providers + 1 test case
- Static and LLM-as-judge assertions
- `eval` + `eval:view` npm scripts

**Out of scope:**
- CI gate or GitHub Actions integration
- A/B prompt comparison (same `SYSTEM_PROMPT` across all models)
- Second test case (clean diff / positive case)
- `promptfoo share` or SaaS

## Architecture / Approach

A thin `promptfoo-provider.ts` at the package root adapts `reviewCode()` to the promptfoo `ApiProvider` interface. The YAML config defines three providers — each pointing at the same provider file but passing a different model via `config.model`. The React fixture is loaded at eval time via promptfoo's `file:` var syntax. Assertions run in order: Zod schema check → score gate → issues count → LLM judge.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Extend `reviewCode()` | Optional `model` param; CLI path unchanged | Minimal — additive signature change |
| 2. Install promptfoo | `promptfoo` devDep + `eval`/`eval:view` scripts | Slow install in isolated `node_modules` |
| 3. Create provider | `promptfoo-provider.ts` adapter | ESM `.js` import extension must be used (tsx resolves correctly) |
| 4. Create fixture | React migration diff with 3 embedded flaws | Judge may not flag all 3 if diff is ambiguous |
| 5. Create config | Full `promptfooconfig.yaml` | `file:` var syntax for loading the diff must be tested against promptfoo version |

**Prerequisites:** `OPENROUTER_API_KEY` set in `packages/code-reviewer/.env` (already present per research)
**Estimated effort:** ~1 session across 5 phases; phases 3–5 are the bulk

## Open Risks & Assumptions

- The `file:` var syntax for loading fixture content is version-dependent — if the installed promptfoo version doesn't support it, the diff content can be inlined directly in the YAML
- `glm-5.1` and `deepseek-v4-flash` may return text-wrapped JSON rather than a pure JSON object — the Zod assertion will catch this and flag the model, but the eval run itself will not crash
- LLM judge using the same model as one of the providers (`claude-sonnet-4-6`) introduces slight evaluator bias — acceptable for a first baseline, worth revisiting if results seem inflated for that provider

## Success Criteria (Summary)

- `npm run eval` runs without errors and produces a 3-row comparison table
- `claude-sonnet-4-6` row passes all 4 assertions (establishes baseline)
- `glm-5.1` and `deepseek-v4-flash` rows produce results (pass or fail is informative data, not a blocker)
