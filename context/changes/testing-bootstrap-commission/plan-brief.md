# Testing Bootstrap: Commission Arithmetic — Plan Brief

> Full plan: `context/changes/testing-bootstrap-commission/plan.md`

## What & Why

Install Vitest and ship the first unit test for the project — coverage for Risk #2 from the
test-plan: commission split arithmetic wrong, or a rounding difference surfacing silently
instead of as a validation error. Phase 1 of a four-phase test rollout.

## Starting Point

No test framework exists. The commission formula is inlined in `close.ts:72–83` (API route
handler — untestable in isolation) and duplicated client-side in `pricing.astro`'s
`<script define:vars>` block. CI runs lint + build only.

## Desired End State

`npm run test` passes 4 unit tests verifying the commission formula against PRD oracle values.
`src/lib/commission.ts` is the single canonical formula location; `close.ts` and
`pricing.astro` both import it. CI gates on tests after lint, before build. The commission
display in `pricing.astro` renders from SSR (server-computed values) rather than client JS.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Test framework | Vitest | test-plan.md §4 specifies it; Vite-native, TypeScript-first | test-plan.md |
| Extraction scope | Both close.ts + pricing.astro | S-03 plan explicitly noted both must produce identical numbers; shared function prevents drift | Plan |
| pricing.astro approach | SSR refactor (remove `<script define:vars>`) | Astro's `define:vars` forces a non-module script — TypeScript imports are unavailable inside it | Plan |
| CI wiring | This phase | test-plan.md §5 requires unit tests in CI after Phase 1 | test-plan.md |
| Invariant assertion | Yes — throw on violation | Acts as a regression tripwire if a future formula edit breaks the algebraic identity | Plan |
| Test cases | PRD oracle + 3 edges | Covers the risk (correct arithmetic + no silent rounding gap) without over-engineering | Plan |

## Scope

**In scope:** Vitest install + config, `vitest.config.ts`, test scripts in package.json, CI
test step, `src/lib/commission.ts` pure function, updating `close.ts`, refactoring
`pricing.astro` to SSR, `src/lib/commission.test.ts` (4 tests).

**Out of scope:** Integration tests (Phase 2), E2E (Phase 4), API route HTTP-layer tests,
pre-commit hook changes, any DB or migration changes.

## Architecture / Approach

A new pure function `calculateCommissionSplit(input: CommissionInput): CommissionSplit` in
`src/lib/commission.ts` owns all commission arithmetic. Both call sites (`close.ts` and
`pricing.astro` frontmatter) pass their locally computed inputs and receive typed PLN outputs.
The function uses integer-grosz arithmetic internally and throws if the algebraic invariant
`agency + tax + agent = brutto` is ever violated. The Vitest config (`vitest.config.ts`) is
standalone from the Astro config — `environment: 'node'`, includes only `src/**/*.test.ts`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Vitest Bootstrap | `npm run test` works; CI includes test step | Vite 7 / Vitest peer-dep compatibility — resolve at install |
| 2. Formula extraction + tests | Pure function, 4 passing tests, SSR pricing display | pricing.astro SSR refactor must preserve identical user-visible commission values |

**Prerequisites:** None — this is the first test change in the project.  
**Estimated effort:** ~1 session across 2 phases (both are small, sequential changes).

## Open Risks & Assumptions

- Vitest peer dep compatibility with `"overrides": { "vite": "^7.3.2" }` — verify at `npm install` and resolve any warning before committing.
- The `pricing.astro` commission display is currently empty-until-JS-runs (client-side); after SSR refactor it renders on first load. This is a behaviour improvement, not a regression, but warrants a visual check.

## Success Criteria (Summary)

- `npm run test` exits 0 with 4 tests named after PRD risk scenarios
- Commission breakdown on `/dashboard/listings/[id]/pricing` renders correctly after SSR refactor
- CI green: lint + test + build all pass on push
