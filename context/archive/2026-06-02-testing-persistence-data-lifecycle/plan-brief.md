# Phase 2 Test Rollout: Persistence + Data Lifecycle — Plan Brief

> Full plan: `context/changes/testing-persistence-data-lifecycle/plan.md`

## What & Why

Phase 2 of the phased test rollout adds integration tests (real Supabase DB, no HTTP layer)
for three failure scenarios: listing fields lost after create/edit, data corruption through the
close/reopen lifecycle, and price history entries missing or out of chronological order. These
are the highest-signal risks not yet covered by the Phase 1 unit tests, and the test-plan.md
risk table names direct DB read-back as the cheapest layer that gives a real signal for all
three.

## Starting Point

Vitest is installed and the commission formula has a passing unit suite (Phase 1 complete). There
is no integration test infrastructure — no separate Vitest config, no service role client helper,
no `test:integration` script. All Supabase tables have RLS and a real `auth.users` FK, which
means tests can't just INSERT without a valid user row.

## Desired End State

`npm run test:integration` runs 5 tests across 3 files and exits 0. The existing `npm run test`
(unit-only CI gate) still runs exactly 4 tests. Each integration test creates and destroys its
own isolated test user, making reruns and parallel runs safe. `test-plan.md §6.2` has a filled-in
cookbook pattern for the next developer adding an integration test.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Auth in tests | Service role key throughout | RLS enforcement is Phase 3's job; Phase 2 tests data lifecycle, not access control | Plan |
| Test script | Separate `test:integration` | CI wiring of integration tests is Phase 4; keeping them out of `npm run test` prevents CI breakage until Supabase runs in the pipeline | Plan |
| Test user per suite | `auth.admin.createUser` in `beforeAll` | FK constraint on `listings.user_id` requires a real `auth.users` row; admin delete in `afterAll` cascades all test data | Plan |
| File location | `src/integration/*.test.ts` | Clear separation from unit tests (`src/lib/`) and production code (`src/pages/`) | Plan |
| Timestamp strategy | Explicit `set_at` in INSERT | `DEFAULT pg_catalog.now()` is non-deterministic at sub-ms resolution; explicit offsets (+0s, +1s, +2s) guarantee ordering assertions | Plan |
| Close test scope | All listing fields + snapshot existence | Avoids the named anti-pattern "testing only the status field"; commission arithmetic is already covered by Phase 1 | Plan |
| Supabase client | `@supabase/supabase-js` createClient directly | `src/lib/supabase.ts` imports `astro:env/server` (Astro virtual module) — not resolvable in Vitest Node runtime | Plan |

## Scope

**In scope:**
- Integration test infrastructure (separate Vitest config, helper, npm script)
- Risk #1: listing create and update → DB read-back of all editable fields
- Risk #4: close (status, closed_at, all fields, snapshot existence) and reopen (field parity)
- Risk #5: 3 price inserts with explicit timestamps → count + ordering invariant
- §6.2 cookbook pattern + Phase 2 status update in test-plan.md

**Out of scope:**
- RLS policy enforcement (Phase 3)
- Commission arithmetic in the close snapshot (Phase 1 already covers R2)
- CI wiring of integration tests (Phase 4)
- HTTP-level API route testing (heavier than needed for these risks)

## Architecture / Approach

Tests call `@supabase/supabase-js`'s `createClient` directly with the service role JWT (bypasses
RLS, FK constraints still apply). Each test file owns a `beforeAll` that creates a test user via
`auth.admin.createUser` and an `afterAll` that calls `auth.admin.deleteUser`, which cascades
deletions through `listings → price_history, transaction_snapshots`. Tests read back from the DB
after every write rather than asserting on the SDK response payload.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Infrastructure | Separate Vitest config, helper, script, env placeholder | If Vitest v4 doesn't auto-load `.env` into `process.env`, test files will see undefined env vars |
| 2. Listing persistence | 2 tests: create + update read-back | Test user FK setup; clean cascade on `afterAll` |
| 3. Close/reopen lifecycle | 2 tests: close field parity + reopen field parity | Snapshot voiding must succeed before listing status update |
| 4. Price history ordering | 1 test: N inserts + ordering invariant | Explicit `set_at` must survive round-trip through `timestamptz` column |
| 5. Cookbook + docs | §6.2 filled in, Phase 2 status = complete | None |

**Prerequisites:** Local Supabase running (`npx supabase start`); `SUPABASE_SERVICE_ROLE_KEY`
added to `.env` (value from `npx supabase status`).
**Estimated effort:** ~1 focused session across 5 phases.

## Open Risks & Assumptions

- Vitest v4 is assumed to populate `process.env` from `.env` via its Vite env-loading mechanism.
  If it doesn't, a `setupFiles` entry calling `dotenv.config()` will need to be added — check
  that `process.env.SUPABASE_URL` is defined in the first test run.
- `supabase.auth.admin.createUser` is available on the service role client in `@supabase/supabase-js`
  v2.99.1 — verified by checking installed package version.
- The current `.env` `SUPABASE_KEY` value (`625729a08b95bf1b7ff351a663f3a23c`) is the S3
  Protocol Access Key ID, not an API JWT. Integration tests use `SUPABASE_SERVICE_ROLE_KEY`
  (a separate key) so this doesn't block the plan, but the production `SUPABASE_KEY` value
  should be verified separately.

## Success Criteria (Summary)

- `npm run test:integration` exits 0 with 5 passing tests
- `npm run test` still exits 0 with 4 passing unit tests (no regression)
- Each test run is idempotent — reruns don't leave orphaned rows in the local DB
