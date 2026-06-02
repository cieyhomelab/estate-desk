<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Phase 2 Test Rollout — Persistence + Data Lifecycle

- **Plan**: context/changes/testing-persistence-data-lifecycle/plan.md
- **Scope**: All Phases (1–5)
- **Date**: 2026-06-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical | 3 warnings | 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — listing-persistence.test.ts: testListingId set in test body, read in sibling test

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/integration/listing-persistence.test.ts:38 (set), :57 (read)
- **Detail**: `testListingId` is declared at describe-scope but assigned inside test 1's body (line 38). Test 2 reads it on line 57. Plan explicitly called for this pattern, so it is plan-adherent. However if test 1 fails, testListingId stays `undefined`, test 2 calls `.update(...).eq("id", undefined)` (Supabase no-op), then `.single()` returns an error — test 2 throws with a confusing DB error rather than a clear "depends on prior test" message.
- **Fix A ⭐ Recommended**: Move listing insert into `beforeAll` alongside user creation — eliminates hidden dependency, failing beforeAll skips all tests with a clear message, matches the close/reopen and price-history patterns in this same change.
  - Strength: Established convention across all other test files in this suite.
  - Tradeoff: Minor plan deviation — plan said "insert in test 1 body".
  - Confidence: HIGH — other two test files use beforeAll for all setup.
  - Blind spot: None significant.
- **Fix B**: Add `if (!testListingId) return;` guard at top of test 2 — one-line fix, makes dependency explicit, but masks rather than fixes it.
  - Strength: Zero structural change.
  - Tradeoff: Still has ordering dependency; still doesn't document it clearly.
  - Confidence: MEDIUM.
  - Blind spot: None.
- **Decision**: FIXED via Fix A (listing insert moved to beforeAll)

### F2 — listing-close-reopen.test.ts: reopen test passes silently if close test failed

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/integration/listing-close-reopen.test.ts:85
- **Detail**: Test 2 ("reopen transition") assumes listing is in `status: 'done'` with an active snapshot — state left by test 1. If test 1 fails mid-way, test 2's snapshot void updates 0 rows (silent), the reopen update succeeds vacuously, and the read-back asserts `status = 'active'` which was already true — silent false positive without ever exercising the reopen-after-close path.
- **Fix A ⭐ Recommended**: Merge into a single `it("close then reopen")` block that asserts intermediate state (status='done') before proceeding to reopen assertions.
  - Strength: Lifecycle order is explicit; no silent-pass risk; simpler to reason about.
  - Tradeoff: Can't isolate close failure from reopen failure by test name alone.
  - Confidence: HIGH — single it for multi-step lifecycle is idiomatic when steps are not independently meaningful.
  - Blind spot: None significant.
- **Fix B**: Add a guard at test 2's start: `expect(testListingId).toBeDefined()` and verify listing is actually in 'done' status before proceeding.
  - Strength: Keeps two named tests; catches the false-positive.
  - Tradeoff: Still has ordering dependency; more brittle than Fix A.
  - Confidence: MEDIUM.
  - Blind spot: None.
- **Decision**: FIXED via Fix A (merged into single it block; snapshot assertion upgraded to field-value checks)

### F3 — helpers/supabase.test.ts: unnecessary dynamic import; static import is simpler

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/integration/helpers/supabase.test.ts:15, 24
- **Detail**: Both tests use `await import("./supabase")` inside the test body, written assuming module re-evaluation was needed to pick up mutated `process.env`. It isn't — `createServiceRoleClient` reads `process.env` at call time, so the module cache has no effect. Dynamic imports are currently harmless but add unnecessary complexity and don't match the static import style of `commission.test.ts`. A reader might conclude the dynamic import is load-bearing.
- **Fix**: Replace with a static import at the top of the file and call `createServiceRoleClient()` directly in each test body.
  - Strength: Matches commission.test.ts pattern; removes ambiguity about why import is dynamic.
  - Tradeoff: None — functionally identical.
  - Confidence: HIGH — tests pass with either approach since function reads env vars at call time.
  - Blind spot: None significant.
- **Decision**: FIXED (replaced dynamic imports with static import; removed async from tests)

### F4 — helpers/supabase.test.ts: afterEach may restore undefined as string "undefined"

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/integration/helpers/supabase.test.ts:7–10
- **Detail**: `savedUrl`/`savedKey` captured at describe scope. If either env var is unset when the suite loads, save captures `undefined`. `afterEach` then does `process.env.SUPABASE_URL = undefined` which JS coerces to the string `"undefined"` — leaving env dirtier than it started. Not a current bug but a latent trap.
- **Fix**: In afterEach, use `savedUrl ? (process.env.SUPABASE_URL = savedUrl) : delete process.env.SUPABASE_URL` (same for key).
- **Decision**: FIXED (afterEach now uses if/else to safely delete unset vars)

### F5 — listing-close-reopen.test.ts: snapshot id assertion is tautological

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/integration/listing-close-reopen.test.ts:83
- **Detail**: `expect(snapshot.id).not.toBeNull()` is tautological — `.single()` already errors if 0 or >1 rows match. Reaching this line guarantees a UUID. The test asserts row existence but not business field values (asking_price, commission_percent).
- **Fix**: Replace with `expect(snapshot.asking_price).toBe(500000)` and `expect(snapshot.commission_percent).toBe(2)`.
- **Decision**: FIXED (resolved as part of F2 fix — merged it block now asserts asking_price and commission_percent)

### F6 — vitest.integration.config.ts: empty loadEnv prefix injects all .env vars

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: vitest.integration.config.ts:6
- **Detail**: `loadEnv("test", process.cwd(), "")` with empty prefix injects every key in .env into process.env for the entire integration run. Not a current problem (.env is gitignored, local-only) but worth noting as secrets accumulate.
- **Fix**: No change needed now. Revisit if a prefix convention emerges.
- **Decision**: SKIPPED (accepted as-is)

### F7 — scope: supabase.test.ts is an unplanned TDD artifact in the integration suite

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/integration/helpers/supabase.test.ts
- **Detail**: Not in the plan. Added during TDD to drive the helper's guard-clause implementation. Adds 2 tests to the integration suite (plan expected 5; actual is 7). No DB contact, no side effects. Benign and adds real guard coverage.
- **Fix**: No action needed. Worth noting in plan addendum if deviation matters for future reviewers.
- **Decision**: SKIPPED (accepted as-is)
