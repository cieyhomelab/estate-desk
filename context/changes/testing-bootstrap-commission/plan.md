# Testing Bootstrap: Commission Arithmetic — Implementation Plan

## Overview

Phase 1 of the test rollout from `context/foundation/test-plan.md` §3: install Vitest and
ship the first unit test — coverage for Risk #2 (commission split arithmetic wrong or rounding
difference silent). Two sequential concerns: bootstrap the test framework, then extract the
commission formula into a testable pure function and write tests against it.

## Current State Analysis

- **No test framework.** `package.json` has no Vitest, Jest, or Mocha. No `*.test.ts` files
  anywhere in `src/`.
- **Formula is inlined in `close.ts:72–83`** — coupled to the Astro API route handler;
  untestable without an HTTP context. A near-identical formula runs client-side in
  `pricing.astro`'s `<script define:vars>` block (lines 242–252).
- **CI runs `npm ci → astro sync → lint → build`.** No test step.
- **Vite is overridden to `^7.3.2`** in `package.json`. Vitest peer dep must be resolved
  against that version at install time.

## Desired End State

After this plan:
- `npm run test` runs the Vitest suite and exits 0 with 4 tests passing.
- `src/lib/commission.ts` exports a pure, typed `calculateCommissionSplit` function with a
  defensive algebraic-invariant assertion.
- `close.ts` imports and calls the pure function; the inlined arithmetic block is removed.
- `pricing.astro` computes the commission split server-side in the frontmatter (SSR), replacing
  the `<script define:vars>` block; the commission breakdown table renders from static values.
- CI gates on tests: `npm run test` runs in the `ci` job after `lint` and before `build`.
- `context/foundation/test-plan.md` §6.1 is filled in.

### Key Discoveries

- `close.ts:72–77` — 11-line inline formula; replacing it with a single function call is the
  only change to that route.
- `pricing.astro:230–253` — Astro's `define:vars` forces a non-module plain `<script>` tag;
  ES module imports are unavailable inside such a block. Moving the computation to the
  frontmatter is required to share the TypeScript function and also removes client-side JS from
  the rendered page.
- The formula is algebraically self-consistent: `agency_c + tax_c + agent_c ≡ brutto_c` by
  construction. The invariant assertion cannot fail with the current formula — it is a
  regression tripwire against future edits.
- `test-plan.md §4` explicitly notes Vitest as not yet installed: "Add Vitest before writing
  unit tests."
- CI build step requires `SUPABASE_URL` and `SUPABASE_KEY` secrets; the test step needs
  neither.

## What We're NOT Doing

- No integration or E2E tests — those are Phases 2–4 of the test rollout.
- No HTTP-layer testing of `close.ts` as an API route — the formula function is the unit under
  test.
- No Playwright installation — that is Phase 4.
- No change to `commission.ts` (settings API) or `commission/set.ts` (per-listing %) — only
  the formula extraction and its consumers.
- No update to `lint-staged` or pre-commit hooks for test execution — a future Lesson 3
  concern.

## Implementation Approach

Sequential phases, each leaving the codebase in a passing state. Phase 1 is pure toolchain:
install Vitest, configure it, wire into package.json and CI. Phase 2 is pure logic: extract the
formula, update consumers, write tests. No DB changes, no migrations, no new routes.

## Critical Implementation Details

**`brutto_c` unit interpretation**: `Math.round(asking_price * commission_percent)` in `close.ts`
looks like PLN × decimal, but `commission_percent` is stored as a percentage (e.g., `2.5` for
2.5%) — so the result is `PLN × % = PLN ÷ 100 × 100 = grosze`. This is not a bug; it is why
`brutto / 100` gives PLN at the end. The pure function preserves this contract. Test oracle
values must account for it: asking_price `1_000_000` PLN with commission_percent `1` (1%) gives
`brutto_c = 1_000_000` grosze = `10_000` PLN.

**`<script define:vars>` cannot import modules**: Astro's `define:vars` converts a `<script>`
to a plain (non-module) tag. `import` statements are unavailable. Refactoring pricing.astro
requires moving the formula to the frontmatter SSR section — it is not possible to add an
`import` statement inside the existing script block.

---

## Phase 1: Vitest Bootstrap

### Overview

Install Vitest, configure it, add test scripts to package.json, and add a test step to CI.
After this phase, `npm run test` exits 0 (empty suite) and CI runs the step on every push.

### Changes Required:

#### 1. Install Vitest

**File**: `package.json` devDependencies — via `npm install --save-dev vitest`

**Intent**: Add Vitest as a devDependency so the test script resolves. Vitest uses the
project's Vite instance internally; the `"overrides": { "vite": "^7.3.2" }` entry may require
a Vitest release that supports Vite 7 as a peer. Resolve any peer-dep warning before
committing.

**Contract**: After install, `package.json` devDependencies includes a `vitest` entry at a
resolved version. If npm warns about unresolved peer deps for Vite, pin Vitest to the minimum
version whose `peerDependencies` lists `vite >= 7`.

#### 2. Add test scripts

**File**: `package.json` → `"scripts"`

**Intent**: Expose two Vitest commands: `test` for CI (single pass, non-zero exit on failure)
and `test:watch` for local development (interactive re-run on save).

**Contract**:
```json
"test": "vitest run",
"test:watch": "vitest"
```
Add both alongside `"lint"` and `"lint:fix"` in the `scripts` block.

#### 3. Create vitest.config.ts

**File**: `vitest.config.ts` (project root — new file)

**Intent**: Configure Vitest for pure unit tests: Node environment (no DOM needed for
arithmetic functions), include only `*.test.ts` files under `src/`, resolve the `@/` alias to
match `tsconfig.json` so future tests can import `@/lib/…` without path errors.

**Contract**:
```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve('./src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

#### 4. Add test step to CI

**File**: `.github/workflows/ci.yml` → `jobs.ci.steps`

**Intent**: Run the test suite before the build step so test failures block the CI job. The
test step needs no secrets.

**Contract**: Insert `- run: npm run test` after the `- run: npm run lint` step and before
`- run: npm run build`.

### Success Criteria:

#### Automated Verification:

- `npm run test` exits 0 (Vitest reports 0 test suites with no failures on an empty suite)
- `npm run lint` passes with the new `vitest.config.ts` present
- `npm run build` still passes (devDep install did not promote anything to dependencies)

#### Manual Verification:

- CI run triggered by a push passes all steps including the new test step
- `npm run test:watch` launches Vitest in watch mode locally without errors

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation that CI ran successfully before proceeding to Phase 2. Phase
blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the
`## Progress` section at the bottom of the plan.

---

## Phase 2: Commission Formula Extraction + Unit Tests

### Overview

Extract the commission formula from `close.ts` into a pure TypeScript function in
`src/lib/commission.ts`. Update `close.ts` and `pricing.astro` to use it. Write
`src/lib/commission.test.ts` with 4 test cases covering the PRD oracle and key edge cases.

### Changes Required:

#### 1. Create commission formula module

**File**: `src/lib/commission.ts` (new file)

**Intent**: House the single canonical commission formula as an exported pure function. All
arithmetic stays in integer grosze; the function returns PLN values. A defensive invariant
assertion acts as a regression tripwire — it cannot fail with the current formula but will
surface any future edit that breaks `agency + tax + agent = brutto`.

**Contract**:

```typescript
export interface CommissionInput {
  askingPrice: number;       // PLN stored value (e.g. 1_000_000 for 1 mln PLN)
  commissionPercent: number; // percentage 0–100 (e.g. 2.5 for 2.5%)
  agencyPercent: number;     // percentage 0–100 (e.g. 50 for 50%)
  taxRate: number;           // percentage 0–100 (e.g. 23 for 23%)
}

export interface CommissionSplit {
  brutto: number;       // PLN — total commission
  agencyAmount: number; // PLN — agency portion
  grossIncome: number;  // PLN — agent pre-tax income
  taxAmount: number;    // PLN — tax provision
  agentNet: number;     // PLN — agent net payout
}

export function calculateCommissionSplit(input: CommissionInput): CommissionSplit
```

Formula (integer-grosz arithmetic, identical to `close.ts:72–77`):
- `brutto_c  = Math.round(input.askingPrice * input.commissionPercent)` — grosze
- `agency_c  = Math.round((brutto_c * input.agencyPercent) / 100)`
- `gross_c   = brutto_c - agency_c`
- `tax_c     = Math.round((gross_c * input.taxRate) / 100)`
- `agent_c   = gross_c - tax_c`
- Invariant assertion: `if (agency_c + tax_c + agent_c !== brutto_c) throw new Error(...)`
- Return each `_c / 100` as the corresponding PLN field.

#### 2. Update close.ts

**File**: `src/pages/api/listings/[id]/close.ts` — lines 72–83

**Intent**: Remove the inlined arithmetic block and delegate to `calculateCommissionSplit`. The
null-guard structure stays unchanged.

**Contract**: Add `import { calculateCommissionSplit } from '@/lib/commission';` at the top.
Replace lines 72–83 with:
```typescript
if (listing.asking_price !== null && listing.commission_percent !== null && settings !== null) {
  const split = calculateCommissionSplit({
    askingPrice: listing.asking_price,
    commissionPercent: listing.commission_percent,
    agencyPercent: settings.agency_percent,
    taxRate: settings.tax_rate,
  });
  brutto = split.brutto;
  agency_amount = split.agencyAmount;
  gross_income = split.grossIncome;
  tax_amount = split.taxAmount;
  agent_net = split.agentNet;
}
```
The variable declarations (lines 66–70) and snapshot insert (line 85+) are unchanged.

#### 3. Refactor pricing.astro commission display to SSR

**File**: `src/pages/dashboard/listings/[id]/pricing.astro`

**Intent**: Replace the `<script define:vars>` commission breakdown (lines 230–253) with a
server-side computed split in the frontmatter. The user-visible output is identical; the page
no longer ships the formula as client-side JS.

**Contract**:
- Add `import { calculateCommissionSplit, type CommissionSplit } from '@/lib/commission';` to
  the frontmatter imports.
- After the `commissionSettings` fetch (line ~54), add:
  ```typescript
  const commissionSplit: CommissionSplit | null =
    listing.asking_price && listing.commission_percent && commissionSettings
      ? calculateCommissionSplit({
          askingPrice: listing.asking_price,
          commissionPercent: listing.commission_percent,
          agencyPercent: commissionSettings.agency_percent,
          taxRate: commissionSettings.tax_rate,
        })
      : null;
  ```
- In the template, replace the `listing.asking_price && listing.commission_percent ? <div>…<script>…</script></div>` branch with `commissionSplit ? <div>…static table…</div>`. Each `td` renders `{formatPLN(commissionSplit.brutto)}` etc. directly. Remove the `<script define:vars>` block and the `id="b-*"` attributes from the `td` elements (they were only needed by the script).

#### 4. Write unit tests

**File**: `src/lib/commission.test.ts` (new file)

**Intent**: Verify the formula against PRD-specified oracle values and edge cases. Each test is
named after its risk scenario. Expected values are derived from the PRD specification and
research doc independently of the implementation (no oracle-problem anti-pattern). The
invariant assertion in `calculateCommissionSplit` is exercised implicitly by every test.

**Contract**: `describe('calculateCommissionSplit', ...)` containing 4 `it` blocks:

| Test name | Inputs | Key assertions |
|---|---|---|
| `commission split matches PRD oracle` | asking=1_000_000, commission=1, agency=50, tax=25 | brutto=10_000, agency=5_000, gross=5_000, tax=1_250, net=3_750 |
| `zero rates: full pass-through to agent` | asking=1_000_000, commission=1, agency=0, tax=0 | agencyAmount=0, taxAmount=0, agentNet===brutto |
| `100% agency: agent receives nothing` | asking=500_000, commission=2, agency=100, tax=23 | agencyAmount===brutto, grossIncome=0, agentNet=0 |
| `rounding boundary: half-grosze split sums to total` | asking=333_333, commission=1, agency=50, tax=25 | brutto=3_333.33, agency=1_666.67, gross=1_666.66, tax=416.67, net=1_249.99; agencyAmount+taxAmount+agentNet===brutto |

Oracle derivation for rounding boundary: `brutto_c = 333_333`; `agency_c = Math.round(333_333 × 50 ÷ 100) = Math.round(166_666.5) = 166_667`; `gross_c = 166_666`; `tax_c = Math.round(166_666 × 25 ÷ 100) = Math.round(41_666.5) = 41_667`; `agent_c = 124_999`. Sum `= 333_333` ✓.

### Success Criteria:

#### Automated Verification:

- `npm run test` exits 0 with 4 tests passing
- `npx astro check` (typecheck) passes — no new type errors from commission module or consumers
- `npm run lint` passes on all changed files
- `npm run build` passes after pricing.astro SSR refactor

#### Manual Verification:

- `/dashboard/listings/[id]/pricing` renders commission breakdown correctly when asking price,
  commission %, and settings are all configured (values match the PRD oracle: 10,000 zł total
  for 1 mln / 1% / 50% agency / 25% tax)
- Transaction close (`/dashboard/listings/[id]/close`) still shows correct commission amounts
  in the done-state snapshot

**Implementation Note**: After Phase 2 automated verification passes, manually verify the
pricing page and close flow before marking this plan complete.

---

## Testing Strategy

### Unit Tests:

- Pure arithmetic — no DB, no network, no mocks needed
- 4 test cases with PRD-spec oracle values (not copied from implementation)
- Invariant tripwire exercised implicitly by every test

### Manual Testing Steps:

1. Configure commission settings at `/dashboard/settings/commission` (agency 50%, tax 25%)
2. Set asking price to 1,000,000 PLN and commission % to 1 on any listing
3. Open `/dashboard/listings/[id]/pricing` — verify breakdown: total 10,000 zł, agency 5,000,
   gross 5,000, tax 1,250, net 3,750
4. Close the listing via the transaction-close flow; verify the done-state snapshot shows the
   same values locked

## References

- Risk being protected: `context/foundation/test-plan.md` §2 Risk #2
- Test rollout phase: `context/foundation/test-plan.md` §3 Phase 1
- Commission formula pre-extraction: `src/pages/api/listings/[id]/close.ts:72–83`
- Client-side script being replaced: `src/pages/dashboard/listings/[id]/pricing.astro:230–253`
- PRD oracle values: `context/changes/pricing-and-commission/research.md` (formula examples)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Vitest Bootstrap

#### Automated

- [x] 1.1 `npm run test` exits 0 — 4cd7fa3
- [x] 1.2 `npm run lint` passes with vitest.config.ts — 4cd7fa3
- [x] 1.3 `npm run build` still passes — 4cd7fa3

#### Manual

- [x] 1.4 CI run passes including the new test step — 4cd7fa3
- [x] 1.5 `npm run test:watch` launches locally without errors — 4cd7fa3

### Phase 2: Commission Formula Extraction + Unit Tests

#### Automated

- [x] 2.1 `npm run test` exits 0 with 4 tests passing — fa0ad58
- [x] 2.2 `npx astro check` passes (no new type errors) — fa0ad58
- [x] 2.3 `npm run lint` passes on changed files — fa0ad58
- [x] 2.4 `npm run build` passes after pricing.astro SSR refactor — fa0ad58

#### Manual

- [x] 2.5 Pricing page commission breakdown renders correctly — fa0ad58
- [x] 2.6 Transaction close commission snapshot is correct — fa0ad58
