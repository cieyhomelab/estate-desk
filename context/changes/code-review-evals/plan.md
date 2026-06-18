# Introduce promptfoo Evals into code-reviewer Implementation Plan

## Overview

Wire up promptfoo as the eval harness for `packages/code-reviewer`, enabling model-comparison tests that run the existing `reviewCode()` function against three OpenRouter-hosted models using a single realistic React 16→19 migration diff that contains three deliberate flaws. The goal is to verify that LLM reviewers can identify what is actually broken, and to establish a repeatable eval baseline before future prompt experiments.

## Current State Analysis

`packages/code-reviewer` was explicitly designed for this moment: `reviewCode()` is a clean importable async function, `SYSTEM_PROMPT` is an exported string constant, and `reviewSchema` is a standalone Zod object. The package is ESM (`"type": "module"`, `NodeNext` module resolution), already has a compiled `dist/`, and isolates env-var loading to `index.ts` so promptfoo providers can import `agent.ts` cleanly.

The one gap: `reviewCode()` hardcodes `openrouter("anthropic/claude-sonnet-4-6")` — multi-model evals require the model to be passed in at call time.

## Desired End State

Running `npm run eval` inside `packages/code-reviewer/` produces a promptfoo evaluation table comparing three models (`anthropic/claude-sonnet-4-6`, `z-ai/glm-5.1`, `deepseek/deepseek-v4-flash`) against one React-migration test case. Each row shows pass/fail for: structural validity (Zod), static score gate (`overall_score ≤ 5`), issues raised on ≥ 3 criteria, and an LLM-as-judge verdict on whether the correct flaws were identified.

### Key Discoveries

- `packages/code-reviewer/src/agent.ts:8-29` — `reviewCode()` is the primary eval entry point; adding `model?` here is the minimal touch
- `packages/code-reviewer/src/schema.ts:17-23` — `reviewSchema` (Zod v4) is importable directly in assertions
- `packages/code-reviewer/package.json:3` — `"type": "module"` confirmed; promptfoo handles ESM natively
- `dist/` already exists — no build step required before first eval run since provider imports from `./src/` via tsx
- Research doc (`context/changes/code-review-evals/research.md`) confirmed: promptfoo's `file://` provider with TypeScript works against relative `./src/` imports without pre-building

## What We're NOT Doing

- No CI gate or GitHub Actions integration — this is a local eval baseline only
- No A/B prompt comparison — same `SYSTEM_PROMPT` across all three models
- No extraction of `SYSTEM_PROMPT` to a standalone file — deferred to a future multi-prompt experiment
- No second test case (clean diff with expected high score) — first eval focuses on the failure case
- No `promptfoo share` or SaaS integration

## Implementation Approach

Add an optional `model` parameter to `reviewCode()` (defaulting to the current production value), create a thin promptfoo provider that reads the model from `context.config`, define the three model providers in YAML each pointing at the same provider file with different config, author the React fixture diff with three embedded flaws, and wire up static + LLM-as-judge assertions.

## Critical Implementation Details

**Provider config threading**: promptfoo passes each provider's `config:` block to `callApi()` as `context.config`. The provider file reads `context?.config?.model` and passes it to `reviewCode()`. This avoids any global state or env-var tricks.

**ESM import path in provider**: The provider (`src/promptfoo-provider.ts`) imports `reviewCode` using `./agent.js` (relative to `src/`). The `.js` extension is required because `NodeNext` resolution requires explicit extensions. tsx (used by promptfoo's TypeScript loader) resolves `.js` → `.ts` correctly for source files, so this works without a pre-build step for local runs.

---

## Phase 1: Extend `reviewCode()` with Optional Model Param

### Overview

Add an optional `model` string parameter to `reviewCode()`, defaulting to `'anthropic/claude-sonnet-4-6'`. This is the only change to existing source and is intentionally backward-compatible — the CI script in `index.ts` requires no update.

### Changes Required

#### 1. `packages/code-reviewer/src/agent.ts`

**File**: `packages/code-reviewer/src/agent.ts`

**Intent**: Accept an optional `model` parameter in the function signature and use it when constructing the OpenRouter model instance, falling back to the current default so the CLI entrypoint (`index.ts`) continues working unchanged.

**Contract**: Extend the params object type to include `model?: string`. Pass it to `openrouter(model ?? 'anthropic/claude-sonnet-4-6')` on the `ToolLoopAgent` construction line.

### Success Criteria

#### Automated Verification

- Type-check passes: `npm run typecheck` inside `packages/code-reviewer/`
- Build succeeds: `npm run build` inside `packages/code-reviewer/`

#### Manual Verification

- Run `npm run dev` with a sample diff and confirm the function still works with no model argument (CLI path unchanged)

**Implementation Note**: Pause here and confirm the CLI path is still functional before proceeding.

---

## Phase 2: Install promptfoo and Add Eval Scripts

### Overview

Install promptfoo as a dev dependency inside the package (not at the repo root — the package has its own `node_modules`), and add `eval` and `eval:view` convenience scripts to `package.json`.

### Changes Required

#### 1. Install promptfoo

**File**: `packages/code-reviewer/package.json`

**Intent**: Add `promptfoo` to `devDependencies` so `npx promptfoo eval` runs against the local install.

**Contract**: Run `npm install --save-dev promptfoo` from inside `packages/code-reviewer/`. No version pinning beyond `^` — promptfoo releases frequently and breaking changes are rare for the YAML-driven interface.

#### 2. Add scripts

**File**: `packages/code-reviewer/package.json`

**Intent**: Expose `eval` and `eval:view` as npm scripts so contributors don't need to know the promptfoo CLI flags.

**Contract**:

```json
"eval": "promptfoo eval",
"eval:view": "promptfoo view"
```

### Success Criteria

#### Automated Verification

- `npm run eval -- --help` exits 0 and prints promptfoo usage (confirms the binary resolves; `--` is required to forward flags past npm)

#### Manual Verification

- `npm run eval` produces an error about missing config or zero tests — confirming the binary runs before the config file exists (config is added in Phase 5)

---

## Phase 3: Create the promptfoo Provider

### Overview

Create `promptfoo-provider.ts` inside `src/`, co-located with the other source modules. It is a thin adapter: reads the model from `context.config`, calls `reviewCode()`, and returns the structured output as the promptfoo `output` field. Placing it in `src/` keeps it within `rootDir: "src"` so the existing `npm run typecheck` covers it without any tsconfig changes.

### Changes Required

#### 1. `packages/code-reviewer/src/promptfoo-provider.ts`

**File**: `packages/code-reviewer/src/promptfoo-provider.ts`

**Intent**: Adapt `reviewCode()` to the promptfoo `ApiProvider` interface. The provider receives `vars` (the test case variables: `diff`, `prTitle`, `prBody`) and `config` (the per-provider model override) from the promptfoo runtime.

**Contract**: Export a default object satisfying `ApiProvider` with `id()` returning `'code-reviewer'` and `callApi()` that:
1. Reads `model` from `context?.config?.model` (falls back to the `reviewCode()` default)
2. Reads `diff`, `prTitle`, `prBody` from `context?.vars`
3. Calls `reviewCode({ diff, prTitle, prBody, model })`
4. Returns `{ output: result }` — promptfoo passes the raw object to JavaScript assertions

The `prompt` argument to `callApi` is ignored (we use `vars` directly, not the promptfoo prompt interpolation). Import `reviewCode` as `import { reviewCode } from './agent.js'` — relative to `src/`, so both files are under `rootDir`.

### Success Criteria

#### Automated Verification

- Type-check passes with the new file included: `npm run typecheck` (update `tsconfig.json` include if needed to cover root-level `.ts` files, or run `tsc --noEmit promptfoo-provider.ts`)

#### Manual Verification

- No manual step — provider correctness is validated end-to-end in Phase 5

---

## Phase 4: Create the React Migration Test Fixture

### Overview

Author a realistic git diff representing a partial React 16 → React 19 migration of a `TodoList` component. The diff converts the class component to a functional component but introduces three deliberate, impactful flaws that a competent code reviewer should flag.

### Changes Required

#### 1. `packages/code-reviewer/evals/fixtures/react-migration.diff`

**File**: `packages/code-reviewer/evals/fixtures/react-migration.diff`

**Intent**: Provide a realistic, self-contained diff that looks like genuine migration work but embeds three flaws spanning distinct review criteria.

**The three flaws and their expected criterion hits:**

| Flaw | What it is | Expected criterion |
|------|-----------|-------------------|
| `ReactDOM.render()` still used | Should be `ReactDOM.createRoot(...).render(...)` in React 18+; crashes in React 19 strict mode | `implementation_correctness` |
| `ref="inputRef"` (string ref) | String refs were removed in React 19; must use `useRef()` or callback ref | `idiomaticity` |
| `items.map(item => <li>{item}</li>)` | No `key` prop on list items; React warns and reconciliation is broken | `implementation_correctness` / `complexity` |

**Contract**: The fixture is a plain `.diff` file (not a `.patch`) formatted as standard `git diff` output — `---`/`+++` headers, `@@` hunk markers, `-` removed lines, `+` added lines. The surrounding component context should be realistic enough that the reviewer cannot dismiss the flaws as hypothetical. The functional component should be otherwise correct (hooks called at top level, no other issues) so flaws are unambiguous signals.

The diff content:

```diff
diff --git a/src/components/TodoList.jsx b/src/components/TodoList.jsx
index a1b2c3d..e4f5a6b 100644
--- a/src/components/TodoList.jsx
+++ b/src/components/TodoList.jsx
@@ -1,46 +1,40 @@
-import React, { Component } from 'react';
-import ReactDOM from 'react-dom';
+import React, { useEffect, useRef, useState } from 'react';
+import ReactDOM from 'react-dom';

-class TodoList extends Component {
-  constructor(props) {
-    super(props);
-    this.state = {
-      items: [],
-      inputValue: '',
-    };
-  }
-
-  componentDidMount() {
-    this.refs.inputRef.focus();
-  }
-
-  handleAdd = () => {
-    this.setState({
-      items: [...this.state.items, this.state.inputValue],
-      inputValue: '',
-    });
-  };
-
-  render() {
-    const { items, inputValue } = this.state;
-    return (
-      <div className="todo-list">
-        <input
-          ref="inputRef"
-          type="text"
-          value={inputValue}
-          onChange={(e) => this.setState({ inputValue: e.target.value })}
-          placeholder="New todo..."
-        />
-        <button onClick={this.handleAdd}>Add</button>
-        <ul>
-          {items.map((item) => (
-            <li>{item}</li>
-          ))}
-        </ul>
-      </div>
-    );
-  }
-}
+function TodoList() {
+  const [items, setItems] = useState([]);
+  const [inputValue, setInputValue] = useState('');
+  const inputRef = useRef(null);

-ReactDOM.render(<TodoList />, document.getElementById('root'));
+  useEffect(() => {
+    inputRef.current.focus();
+  }, []);
+
+  const handleAdd = () => {
+    setItems([...items, inputValue]);
+    setInputValue('');
+  };
+
+  return (
+    <div className="todo-list">
+      <input
+        ref="inputRef"
+        type="text"
+        value={inputValue}
+        onChange={(e) => setInputValue(e.target.value)}
+        placeholder="New todo..."
+      />
+      <button onClick={handleAdd}>Add</button>
+      <ul>
+        {items.map((item) => (
+          <li>{item}</li>
+        ))}
+      </ul>
+    </div>
+  );
+}
+
+ReactDOM.render(<TodoList />, document.getElementById('root'));
```

The three flaws are preserved: `ReactDOM.render()` on the last line (not converted to `createRoot`), `ref="inputRef"` as a string ref (despite `useRef` being declared and connected to `inputRef.current.focus()`, the JSX still uses the removed string-ref syntax), and `items.map(item => <li>{item}</li>)` with no `key`.

### Success Criteria

#### Automated Verification

- File exists at the expected path (checked by promptfoo `vars.diff` loading in Phase 5)

#### Manual Verification

- Read the diff and confirm: (1) `ReactDOM.render()` is on the last line, (2) `ref="inputRef"` is in the JSX, (3) `<li>` has no `key` prop

---

## Phase 5: Create `promptfooconfig.yaml`

### Overview

Create the top-level promptfoo configuration file at the package root. It defines three providers (one per model, all pointing at the same TypeScript provider), one test case using the React fixture, and both static and LLM-as-judge assertions.

### Changes Required

#### 1. `packages/code-reviewer/promptfooconfig.yaml`

**File**: `packages/code-reviewer/promptfooconfig.yaml`

**Intent**: Declare the full eval: three model providers under the same custom provider adapter, one test case with the flawed React diff loaded from the fixture file, static assertions verifying the review flags the code as poor quality, and an LLM-as-judge assertion verifying the correct flaws were identified.

**Contract**:

```yaml
description: "code-reviewer model comparison — React 16→19 migration with 3 flaws"

providers:
  - id: file://./src/promptfoo-provider.ts
    label: claude-sonnet-4-6
    config:
      model: anthropic/claude-sonnet-4-6

  - id: file://./src/promptfoo-provider.ts
    label: glm-5.1
    config:
      model: z-ai/glm-5.1

  - id: file://./src/promptfoo-provider.ts
    label: deepseek-v4-flash
    config:
      model: deepseek/deepseek-v4-flash

prompts:
  - "{{diff}}"

defaultTest:
  assert:
    # Structural: output must conform to ReviewOutput schema (enforces enum names, required fields)
    - type: javascript
      value: |
        const { reviewSchema } = await import('./src/schema.js');
        return reviewSchema.safeParse(output).success;
      description: "ReviewOutput matches production schema (Zod)"

    # Structural: exactly 6 criteria (reviewSchema uses z.array() with no length constraint)
    - type: javascript
      value: output.criteria.length === 6
      description: "Exactly 6 criteria returned"

    # Static: holistic score must be low (flawed diff)
    - type: javascript
      value: output.overall_score <= 5
      description: "overall_score ≤ 5 on a diff with 3 impactful flaws"

    # Static: at least 3 criteria must have raised issues
    - type: javascript
      value: |
        const criteriaWithIssues = output.criteria.filter(
          (c) => Array.isArray(c.issues) && c.issues.length > 0
        );
        return criteriaWithIssues.length >= 3;
      description: "≥3 criteria raise specific issues"

tests:
  - description: "React 16→19 migration with ReactDOM.render + string ref + missing keys"
    vars:
      prTitle: "Migrate TodoList from React 16 class component to React 19 functional component"
      prBody: |
        Converts the legacy class-based TodoList to a functional component using hooks.
        Updates imports and component structure to align with the React 19 migration guide.
      diff:
        file: ./evals/fixtures/react-migration.diff
    assert:
      # LLM-as-judge: verify the three specific flaws are identified
      - type: llm-rubric
        value: |
          The code review must identify all three of the following flaws:
          1. ReactDOM.render() is still used — this API was removed in React 18 and crashes in React 19 strict mode. createRoot() must be used instead.
          2. A string ref (ref="inputRef") is used in JSX — string refs were removed in React 19. A useRef() hook is declared but never connected; the string ref syntax must be replaced with ref={inputRef}.
          3. List items are rendered without key props (items.map(item => <li>{item}</li>)) — missing keys break React reconciliation.
          The review fails if any of these three flaws is absent from the output's issues or rationale text.
        provider: openrouter:anthropic/claude-sonnet-4-6
        description: "LLM judge verifies all 3 React flaws are identified"
```

**Note on `file:` syntax in vars**: promptfoo supports `file:` as a var value to load file contents at eval time. The path is relative to the config file location.

### Success Criteria

#### Automated Verification

- `npm run eval` exits 0 (all three models run without network or config errors)
- promptfoo table shows 3 rows (one per model), 5 assertion columns
- At least the `claude-sonnet-4-6` row shows all assertions passing (baseline model)

#### Manual Verification

- Review the promptfoo output table and confirm: `glm-5.1` and `deepseek-v4-flash` rows show results (pass or fail — first run establishes baseline, failures are expected and informative)
- Inspect the LLM-judge verdict for each row and confirm the rubric text is being evaluated (not skipped)
- Run `npm run eval:view` and confirm the web UI opens with the results

**Implementation Note**: If any model returns a non-JSON response (e.g., a text-wrapped JSON), the Zod schema assertion will catch it. Do not add extra parsing — let the assertion fail clearly so the model is flagged as incompatible.

---

## Testing Strategy

### Automated Tests

- Phase 1 typecheck and build gates verify no regressions in `agent.ts`
- Zod schema assertion in `defaultTest` acts as a structural unit test on every eval run
- Score and issues-count assertions are deterministic given the fixture

### Manual Testing Steps

1. Run `npm run eval` from `packages/code-reviewer/`
2. Confirm all three provider rows appear in the terminal table
3. Confirm `claude-sonnet-4-6` passes all 5 assertions (schema valid, exactly 6 criteria, score ≤ 5, ≥3 criteria with issues, judge confirms flaws found)
4. Note which assertions `glm-5.1` and `deepseek-v4-flash` pass or fail — this is the eval baseline, not a hard gate
5. Run `npm run eval:view` and confirm the web UI renders the results

## Migration Notes

No existing data or users are affected. The `reviewCode()` signature change is additive (optional param, backward-compatible default).

## References

- Research doc: `context/changes/code-review-evals/research.md`
- Agent entry point: `packages/code-reviewer/src/agent.ts:8`
- Schema definition: `packages/code-reviewer/src/schema.ts:17`
- promptfoo provider pattern from research: `context/changes/code-review-evals/research.md:56-76`
- Historical eval design intent: `context/archive/2026-06-16-tool-loop-agent/plan.md:29`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Extend reviewCode() with Optional Model Param

#### Automated

- [x] 1.1 Type-check passes: `npm run typecheck` inside `packages/code-reviewer/` — faaa1fb
- [x] 1.2 Build succeeds: `npm run build` inside `packages/code-reviewer/` — faaa1fb

#### Manual

- [x] 1.3 CLI path unchanged: `npm run dev` with sample diff works without model argument — faaa1fb

### Phase 2: Install promptfoo and Add Eval Scripts

#### Automated

- [x] 2.1 `npm run eval -- --help` exits 0 and prints promptfoo usage

#### Manual

- [ ] 2.2 `npm run eval` runs and errors on missing config (binary resolves correctly)

### Phase 3: Create the promptfoo Provider

#### Automated

- [ ] 3.1 Type-check passes with provider file included

### Phase 4: Create the React Migration Test Fixture

#### Automated

- [ ] 4.1 Fixture file exists at evals/fixtures/react-migration.diff

#### Manual

- [ ] 4.2 Fixture contains all 3 flaws: ReactDOM.render, string ref, missing keys

### Phase 5: Create promptfooconfig.yaml

#### Automated

- [ ] 5.1 `npm run eval` exits 0 (all three models run)
- [ ] 5.2 promptfoo table shows 3 rows, 5 assertion columns
- [ ] 5.3 `claude-sonnet-4-6` row shows all assertions passing

#### Manual

- [ ] 5.4 `glm-5.1` and `deepseek-v4-flash` rows show results (pass or fail establishes baseline)
- [ ] 5.5 LLM-judge verdict is present for each model row
- [ ] 5.6 `npm run eval:view` opens web UI with results
