<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4

Lesson 4 is about **E2E tests** — catching the failures that hooks and unit tests can't see: data that doesn't survive a full user path, broken navigation, a regression that only exists in the rendered UI. An agent can generate a passing E2E test easily; the hard part is making it actually protect a risk and survive tomorrow's refactor. Two quality levers do that work: a **seed test** that shows the agent what a good E2E test looks like, and **rules** that constrain what the agent produces. The prompt only supplies what those two can't encode — the specific risk, flow, and boundaries.

```
context/foundation/test-plan.md  (top 2–3 risks that need browser-level coverage)
        │
        ▼
   seed.spec.ts  +  E2E rules  →  shape every generated test
        │                            (getByRole, isolation, wait-for-state, real vs mocked boundaries)
        ▼
   prompt-template / Planner→Generator  →  test for one risk  →  YOUR review (5 anti-patterns)  →  CI
```

Agents see the **accessibility tree** (roles, names, states in a YAML snapshot with element refs), not pixels — so they should naturally produce `getByRole`-based tests, not CSS selectors. Vision is a supplement for what the DOM can't express (layout, z-index, animation), not the default.

### Task Router — Where to start

| Tool / Prompt | Use it when |
| --- | --- |
| `m3l4-e2e-prompt` prompt | You picked a risk from `test-plan.md` and want one E2E test now. The template forces the E2E contract: risk, research anchor, business scenario (the assertion), real boundaries (don't mock — the risk hides there), mocked boundaries (network layer). Keep it short — the seed test and rules do the heavy lifting; the prompt adds only the risk, flow, and boundaries. |
| Playwright CLI (`@playwright/cli`) | The agent is also editing code and navigating files. CLI runs as shell commands and writes snapshots to disk (~27K tokens/scenario) instead of holding full a11y trees in context (~114K via MCP). Token-frugal default for a coding agent. |
| Playwright MCP (`@playwright/mcp`) | A dedicated browser-automation session (long exploration, scraping, monitoring) where the richer 30+ tool set and in-context session beat token frugality. Add `--caps=vision` only when a risk is visual. |
| Planner→Generator (`npx playwright init-agents`) | You want the agents to explore the app and turn the plan into TypeScript. Still needs a `seed.spec.ts` — the Planner uses it as the example for every generated test, so seed quality is test quality. |
| Healer | An E2E test failed because a **selector** changed (a refactor moved/renamed an element). Healer re-finds it. Route healer output through PR review, never auto-commit. |

### E2E Testing Rules (the key rules)

```
# E2E Testing Rules

- Use getByRole, getByLabel, getByText as primary locators.
  Fall back to getByTestId only when accessibility attributes are ambiguous.
- Never use CSS selectors, XPath, or DOM structure for locating elements.
- Each test must be independently runnable — no shared state between tests.
- Never use page.waitForTimeout(). Wait for specific conditions:
  toBeVisible(), waitForURL(), waitForResponse().
- Assert the business outcome, not implementation details.
- Use unique identifiers (e.g., timestamp suffix) for test data
  to avoid collisions in parallel runs. Clean up in afterEach.
- Use storageState for authentication — never log in through UI
  in individual tests.
```

Additional rules that govern E2E quality:

- **Don't generate E2E tests from scratch.** Start from `test-plan.md`: pick the 2–3 highest risks that need browser-level coverage and feed them as input. A risk needs E2E when it crosses several system boundaries (auth, routing, API, DB) or exists only in the rendered UI; if an isolated function can prove it, a unit test from Lesson 2 is enough.
- **E2E ≠ zero mocking.** Internal boundaries (auth, routing, DB) stay real — that's where integration risk hides. Mock expensive/non-deterministic external APIs (LLMs, payment gateways) at the network layer.
- **Name the test after the risk:** `test('flashcard data persists after page reload', ...)`, not `test('test 1', ...)`.
- **The assertion must fail if the risk materializes.** Control question for every assertion: would this fail if the `test-plan.md` risk came true? If not, it's decorative.

### Five agent E2E anti-patterns — review every generated test against these

1. **Hallucinated assertion** — syntactically valid, semantically empty (asserts the page title instead of that the data survived the reload). Fix: assert the actual business outcome.
2. **Brittle selector** — `page.locator('div.card-container > div:nth-child(3) > button')` instead of `getByRole('button', { name: 'Delete' })`. Breaks on any layout change.
3. **Shared state between tests** — test B assumes test A ran. Playwright runs in parallel, random order → flaky. Each test does its own setup, action, assertion, cleanup.
4. **`waitForTimeout` instead of waiting for state** — passes locally, flakes in CI. Replace with `waitForResponse('**/api/...')` or `expect(locator).toBeVisible()`.
5. **No cleanup** — second run hits a unique-constraint violation. Use unique identifiers (timestamp suffix) plus cleanup per test / `afterEach`.

Re-prompt discipline (same as Lesson 2, lifted to E2E): never say "fix this test". Name the specific anti-pattern, explain why it doesn't protect the risk (or why it produces false failures), and give the target pattern.

### Vision and the healer boundary

- **DOM (snapshot) is the default** for functional verification (does the element exist, did the data save). **Vision** (`--caps=vision`) is a supplement for visual risks only: layout regression, z-index, animation, canvas elements absent from the a11y tree. It costs money and time and can hallucinate — not a default. For pixel-level regression prefer deterministic tools (`toMatchSnapshot`, Argos, Lost Pixel).
- E2E runs in **CI**, not per-edit — a full pass takes minutes. (Hooks from Lesson 3 are the per-edit layer.)
- **Healer helps on selectors, harms on logic.** A changed selector → healer re-finds the element. A changed business behavior (backend returns a new/wrong response) → healer "fixes" the test to match the broken state, masking the bug. That harder case — failing test to root cause to fix — is Lesson 5.

### Lesson boundaries

- This lesson owns E2E: Playwright CLI/MCP, accessibility-tree interaction, seed test + E2E rules, the prompt-template/Planner→Generator flow, vision as a supplement, and test-data isolation.
- Do not configure hooks or local quality layers. That is Lesson 3.
- Do not run the bug-to-fix-to-regression-test debugging workflow. That is Lesson 5 (the healer-on-logic case lives there).
- Do not change the risk strategy or quality-gate definitions. That is Lesson 1 (`/10x-test-plan`).
- Do not write unit/integration test code as the primary deliverable. That is Lesson 2; E2E covers cross-boundary and UI-only risks unit tests can't reach.
- Do not author CI/CD pipelines from scratch. That is Module 1 Lesson 5 / Module 2 Lesson 5; this lesson only says E2E belongs in CI.

### Paths used by this lesson

- `seed.spec.ts` — the exemplar test the Planner copies into every generated test (`getByRole`, isolation, wait-for-state, unique ids + cleanup, risk-named test).
- `playwright.config.ts` — `storageState` for authenticated tests; setup/teardown projects.
- `playwright/.auth/user.json` — saved session state (add the directory to `.gitignore`).
- `context/foundation/test-plan.md` — the checklist of risks that need browser-level coverage; E2E tests trace back to its rows.
- `.claude/prompts/m3l4-e2e-prompt.md` — the E2E generation prompt-template.

<!-- END @przeprogramowani/10x-cli -->
