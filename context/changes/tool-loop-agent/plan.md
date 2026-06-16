# Code Reviewer ToolLoopAgent Refactor — Implementation Plan

## Overview

Refactor `packages/code-reviewer/src/index.ts` from a single-file `generateText` script into a modular `ToolLoopAgent`-based package. The resulting structure separates the Zod schema, system prompt, and agent definition into distinct modules so the reviewer can be imported and called from promptfoo evals without coupling to the CLI runner.

## Current State Analysis

`src/index.ts` (~49 lines) combines four concerns in one file:
- Zod output schema (`reviewSchema`)
- System prompt string (inline in `generateText` call)
- OpenRouter provider + model setup
- `main()` runner with hardcoded sample code

The code uses `generateText` + `Output.object` directly. No `ToolLoopAgent` is used. There are no existing subfolders under `src/`.

## Desired End State

Four sibling files under `src/`:

```
src/
  schema.ts   — reviewSchema (Zod) + ReviewOutput type alias
  prompt.ts   — SYSTEM_PROMPT string constant
  agent.ts    — ToolLoopAgent instance, reviewCode() wrapper, type exports
  index.ts    — thin demo runner (unchanged entry-point for npm run dev)
```

`agent.ts` is the library surface. `index.ts` remains a runnable smoke-test that imports from `agent.ts`. Promptfoo evals will import directly from `agent.ts`.

### Key Discoveries

- `ToolLoopAgent` accepts `output: Output.object({ schema })` — identical structured-output path to the current `generateText` call. No behaviour change required.
- `ToolLoopAgent` uses `instructions` (not `system`) for the system prompt.
- `tsconfig.json` uses `moduleResolution: bundler` — relative imports work without `.js` extensions.
- `index.ts` currently uses top-level `void main().catch(...)` — this pattern should be preserved in the runner.

## What We're NOT Doing

- No tools added to the agent (pure structured output; tool loop is ready for future extension).
- No promptfoo eval configuration.
- No changes to `package.json`, `tsconfig.json`, or build scripts.
- No new dependencies.

## Implementation Approach

Decompose `index.ts` into modules bottom-up: schema → prompt → agent → runner. Each module has a single export responsibility. `agent.ts` owns provider setup so that any importer (eval, test, runner) gets a fully configured agent without needing to know about OpenRouter details.

## Phase 1: Extract Schema and Prompt

### Overview

Create `src/schema.ts` and `src/prompt.ts` with the extracted definitions from the current `index.ts`.

### Changes Required

#### 1. Schema module

**File**: `src/schema.ts`

**Intent**: Move the Zod `reviewSchema` object and the `ReviewOutput` type alias out of `index.ts` and into their own module so both the agent and future eval consumers can import them independently.

**Contract**: Export `reviewSchema` (the existing `z.object(...)` literal, unchanged). Do not export `ReviewOutput` here — `agent.ts` is the canonical export point for types consumed by callers.

#### 2. Prompt module

**File**: `src/prompt.ts`

**Intent**: Move the inline system prompt string into a named constant so it can be versioned, reviewed, and tested in isolation from agent wiring.

**Contract**: Export `SYSTEM_PROMPT` as a `const string`. Content is the existing system string from the `generateText` call: `"You are senior code reviewer. Report only genuine issues..."`.

### Success Criteria

#### Automated Verification

- `npm run typecheck` passes with no errors across all four files

#### Manual Verification

- `src/schema.ts` and `src/prompt.ts` exist and contain only their respective exports

---

## Phase 2: Create Agent Module and Update Runner

### Overview

Create `src/agent.ts` using `ToolLoopAgent`, export both the agent instance and a `reviewCode()` convenience wrapper, then update `src/index.ts` to use the new exports.

### Changes Required

#### 1. Agent module

**File**: `src/agent.ts`

**Intent**: Centralise OpenRouter provider setup, `ToolLoopAgent` construction, and the public callable API (`codeReviewAgent` instance + `reviewCode` function) in one importable module. This is the surface promptfoo evals will import.

**Contract**:

```ts
import { ToolLoopAgent, Output } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { reviewSchema } from "./schema";
import { SYSTEM_PROMPT } from "./prompt";

export type ReviewOutput = z.infer<typeof reviewSchema>;

export async function reviewCode(code: string): Promise<ReviewOutput> {
  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
  const agent = new ToolLoopAgent({
    model: openrouter("anthropic/claude-sonnet-4-5"),
    instructions: SYSTEM_PROMPT,
    output: Output.object({ schema: reviewSchema }),
  });
  const { output } = await agent.generate({
    prompt: `Review this JavaScript code for bugs and issues:\n\n${code}`,
  });
  return output;
}
```

The snippet is included because `output` on `ToolLoopAgent.generate()` is typed by the `Output.object` schema — the contract between agent.ts and callers depends on this inference chain being correct. Lazy init (creating openrouter and agent inside the function) ensures `process.env.OPENROUTER_API_KEY` is read at call time rather than at import time, so promptfoo evals importing `agent.ts` directly don't need to pre-load dotenv.

#### 2. Update runner

**File**: `src/index.ts`

**Intent**: Reduce to a thin smoke-test runner that delegates all logic to `agent.ts`. Preserve `import "dotenv/config"` and the `void main().catch(...)` pattern so `npm run dev` continues to work unchanged.

**Contract**: Replace the inline `generateText` call, schema, and prompt with imports from `./schema`, `./prompt`, and `./agent`. The `main()` body becomes a single `reviewCode(sampleCode)` call followed by `process.stdout.write(JSON.stringify(...))`.

### Success Criteria

#### Automated Verification

- `npm run typecheck` passes (no type errors across all four files)
- `npm run build` completes without errors

#### Manual Verification

- `npm run dev` prints a valid JSON object matching the `reviewSchema` shape (summary, issues array, approved boolean)
- The off-by-one bug in the sample (`i <= items.length`) appears in the issues array

---

## Testing Strategy

### Manual Testing Steps

1. Run `npm run dev` and verify JSON output is valid and contains at least one issue flagging the off-by-one error.
2. Confirm `approved: false` (the sample has a real bug).
3. Import `agent.ts` in a REPL or scratch file and call `reviewCode("const x = 1;")` — confirm it returns `{ summary: ..., issues: [], approved: true }` for trivially correct code.

## References

- AI SDK ToolLoopAgent docs: `node_modules/ai/docs/03-agents/02-building-agents.mdx`
- Structured output with agents: `node_modules/ai/docs/03-agents/02-building-agents.mdx` (§ Structured Output)
- Type-safe agents: `.agents/skills/ai-sdk/references/type-safe-agents.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Extract Schema and Prompt

#### Automated

- [x] 1.1 `npm run typecheck` passes with no errors across all four files — e318e8e

#### Manual

- [x] 1.2 `src/schema.ts` and `src/prompt.ts` exist and contain only their respective exports — e318e8e

### Phase 2: Create Agent Module and Update Runner

#### Automated

- [x] 2.1 `npm run typecheck` passes (no type errors across all four files) — 88e8172
- [x] 2.2 `npm run build` completes without errors — 88e8172

#### Manual

- [x] 2.3 `npm run dev` prints valid JSON matching reviewSchema shape
- [x] 2.4 Off-by-one bug appears in issues array; `approved: false`
