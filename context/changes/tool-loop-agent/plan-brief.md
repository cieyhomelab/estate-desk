# Code Reviewer ToolLoopAgent Refactor — Plan Brief

> Full plan: `context/changes/tool-loop-agent/plan.md`

## What & Why

Refactor the single-file code-reviewer script into a modular package structure using the AI SDK `ToolLoopAgent` class. The goal is to separate concerns (schema, prompt, agent, runner) so the reviewer can be imported as a library by promptfoo evals in a future change.

## Starting Point

`packages/code-reviewer/src/index.ts` is a ~49-line monolithic script that embeds a Zod schema, system prompt, OpenRouter setup, and a `main()` runner all in one file. It uses `generateText` + `Output.object` directly.

## Desired End State

Four sibling files under `src/` — `schema.ts`, `prompt.ts`, `agent.ts`, `index.ts` — where `agent.ts` is the importable library surface exporting `codeReviewAgent` (ToolLoopAgent instance) and `reviewCode(code: string)` (typed wrapper). `npm run dev` continues to work and `index.ts` remains a runnable demo.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Tools now? | No tools — pure structured output | Current review logic needs no tool loop; ToolLoopAgent + Output.object is sufficient and stays extensible | Plan |
| Exported API | Both agent instance + reviewCode() wrapper | Evals get the simple function; power users get the raw agent | Plan |
| File structure | Flat siblings under src/ | Four files is manageable flat; nested folders add depth without benefit at this scale | Plan |
| index.ts role | Keep as runnable demo/smoke-test | Preserves `npm run dev` workflow; agent.ts is the library surface | Plan |

## Scope

**In scope:** schema.ts, prompt.ts, agent.ts creation; index.ts update to thin runner; typecheck + build pass

**Out of scope:** Tools, promptfoo eval config, new dependencies, changes to package.json/tsconfig.json

## Architecture / Approach

Bottom-up extraction: schema → prompt → agent → runner. `agent.ts` owns all provider wiring (OpenRouter client, model selection) so importers need zero knowledge of provider details. `ToolLoopAgent` replaces the `generateText` call with an equivalent `agent.generate()` call using the same `Output.object` structured output.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Extract Schema and Prompt | schema.ts + prompt.ts with extracted definitions | None — pure extraction, no logic change |
| 2. Create Agent Module and Update Runner | agent.ts with ToolLoopAgent + reviewCode(); updated index.ts | ToolLoopAgent output type inference must match reviewSchema — covered by typecheck |

**Prerequisites:** Node modules installed (`ai`, `@openrouter/ai-sdk-provider`, `zod` already in package.json)
**Estimated effort:** ~1 session, 2 phases

## Open Risks & Assumptions

- `OPENROUTER_API_KEY` must be set in `.env` for `npm run dev` to work; `agent.ts` reads it from `process.env` without dotenv (dotenv stays in `index.ts` only)
- Promptfoo eval consumers will need to supply the API key via their own env setup

## Success Criteria (Summary)

- `npm run typecheck` and `npm run build` pass with no errors
- `npm run dev` prints a valid JSON review with the off-by-one bug detected in the sample code
- `agent.ts` exports `codeReviewAgent` and `reviewCode` importable without side effects
