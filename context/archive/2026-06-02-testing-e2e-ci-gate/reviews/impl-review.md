<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: E2E Tests — Full Transaction Flow and CI Gate

- **Plan**: context/changes/testing-e2e-ci-gate/plan.md
- **Scope**: All Phases (1–5)
- **Date**: 2026-06-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  5 warnings  3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — playwright.config.ts loads .env instead of .env.test

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: playwright.config.ts:3
- **Detail**: Plan specified dotenv targeting `.env.test`. Implementation uses `config({ path: ".env" })` with a comment "`.env` has the correct keys". Git status shows `.env.test` exists as an untracked file. In CI the dotenv file is irrelevant (env vars come from secrets), but locally if `.env` and `.env.test` diverge, Playwright silently uses the wrong database.
- **Fix A ⭐ Recommended**: Point dotenv at `.env.test` — replace `config({ path: ".env" })` with `config({ path: ".env.test" })`.
  - Strength: Matches the plan; makes the test-credential boundary explicit.
  - Tradeoff: Requires `.env.test` is populated locally (it already exists).
  - Confidence: HIGH — `.env.test` is the idiomatic separation for test vs. dev credentials.
  - Blind spot: If `.env.test` is missing keys that `.env` has, the switch would surface those gaps immediately.
- **Fix B**: Keep `.env` and add a comment explaining the choice.
  - Strength: No file changes needed; works today.
  - Tradeoff: Leaves the test/dev credential boundary implicit.
  - Confidence: MEDIUM — depends on the convention being maintained.
  - Blind spot: Have not verified that `.env` and `.env.test` have the same key values locally.
- **Decision**: FIXED via Fix A — switched dotenv to `.env.test`

### F2 — listing-persistence.spec.ts missing mode: 'serial'

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: e2e/listing-persistence.spec.ts:1
- **Detail**: Test 2 depends on `listingId` set by Test 1. Without `test.describe.configure({ mode: 'serial' })`, if Test 1 fails before setting `listingId`, Test 2 still runs and navigates to `/dashboard/listings/undefined/edit`. With `retries: 1` in CI, Test 2 could be retried without Test 1 re-running. `close-reopen-lifecycle.spec.ts` has the guard correctly (line 8); this file omits it.
- **Fix**: Add `test.describe.configure({ mode: 'serial' })` at the top of `listing-persistence.spec.ts` (line 1, before `beforeAll`).
- **Decision**: FIXED — added `test.describe.configure({ mode: "serial" })` at top of file

### F3 — checkAllListingDocs silent no-op on zero rows

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: e2e/helpers/db.ts:14–18
- **Detail**: `checkAllListingDocs` runs an UPDATE with no row-count check. If the DB trigger hasn't fired yet or the listing_id is wrong, the update affects 0 rows silently. document-gate Test 2 then expects 'Dokumenty gotowe' but the gate is still blocked — test fails with a confusing selector error.
- **Fix**: After the update, verify rows were affected with a count query and throw if count === 0.
- **Decision**: FIXED — added count check after UPDATE; throws if 0 rows checked

### F4 — close-reopen-lifecycle.spec.ts vacuous negative commission assertion

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: e2e/close-reopen-lifecycle.spec.ts:75–76
- **Detail**: `not.toBeVisible()` for "Brak danych prowizji" passes if the element is absent from the DOM — meaning if the whole commission section were removed by a regression, the assertion still passes. Intent was to confirm commission data was computed and rendered.
- **Fix**: Add a positive assertion: `await expect(page.getByText(/\d[\d\s]*zł/)).toBeVisible()` so a missing commission block causes a failure.
- **Decision**: FIXED — added `expect(page.getByText(/\d[\d\s]*zł/)).toBeVisible()` after the negative assertion

### F5 — ci.yml: --pass-with-no-tests silences the E2E gate

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: package.json `test:e2e` script (used by ci.yml:33)
- **Detail**: `test:e2e` is `playwright test --pass-with-no-tests`. If `testDir` is misconfigured or the `e2e/` directory is deleted, CI exits 0 and the gate appears green with zero coverage. The flag made sense during Phase 1 (no specs yet) but should not be the production CI script.
- **Fix A ⭐ Recommended**: Change `test:e2e` to `playwright test` and add `test:e2e:dev` with the flag for future pre-spec development.
  - Strength: CI fails loudly if specs disappear.
  - Tradeoff: Minor — specs now exist, so the dev-phase safety valve is no longer needed.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Fix B**: Keep flag, add a CI step that asserts test count > 0.
  - Strength: Preserves script as-is.
  - Tradeoff: More CI config complexity for a simple fix.
  - Confidence: LOW.
  - Blind spot: Doesn't help if the list command also has the flag.
- **Decision**: FIXED via Fix A — `test:e2e` is now `playwright test`; `test:e2e:dev` carries the `--pass-with-no-tests` flag

### F6 — playwright.config.ts workers hardcoded to 1

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: playwright.config.ts:11
- **Detail**: Plan specified `workers: process.env.CI ? 1 : undefined`. Implementation uses `workers: 1` unconditionally. Local runs are unnecessarily serialized.
- **Fix**: Replace `workers: 1` with `workers: process.env.CI ? 1 : undefined`.
- **Decision**: FIXED — changed to `process.env.CI ? 1 : undefined`

### F7 — listing-persistence.spec.ts dead null guard at line 45

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: e2e/listing-persistence.spec.ts:45
- **Detail**: `if (!href) throw new Error("Edit link href is null")` at line 45 is unreachable dead code — the throw at line 42 (`if (!match)`) fires first in any null-href case.
- **Fix**: Remove line 45.
- **Decision**: FIXED — removed dead guard; `page.goto(href!)` used directly after the `!match` throw

### F8 — document-gate.spec.ts: cascade-delete dependency undocumented

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: e2e/document-gate.spec.ts:21–25
- **Detail**: `afterAll` only calls `deleteTestUser`. Listings from the three `createSaleListing` calls are cleaned up only if `ON DELETE CASCADE` exists from users to listings. If the cascade were removed, stale listing rows would accumulate per CI run.
- **Fix**: Add a comment in `afterAll` noting the cascade dependency, or collect listing IDs and delete them explicitly.
- **Decision**: FIXED — added comment in `afterAll` documenting the cascade dependency
