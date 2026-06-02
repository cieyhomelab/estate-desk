# Phase 2 Test Rollout: Persistence + Data Lifecycle — Implementation Plan

## Overview

Phase 2 of `context/foundation/test-plan.md` §3. Adds integration tests (real Supabase DB) for
three risks: listing data not persisted after create/edit (R1), completed listing losing data
through the close/reopen cycle (R4), and price history entries out of chronological order or
incomplete (R5). Builds on Phase 1's Vitest bootstrap — same test runner, different
infrastructure layer.

## Current State Analysis

- **Vitest ^4.1.8** installed, node environment, `src/**/*.test.ts` include, `@/` alias, CI
  wired — Phase 1 complete.
- **No integration test infrastructure.** No separate Vitest config, no `test:integration`
  script, no Supabase test helper.
- **`src/lib/supabase.ts` is not usable in tests** — imports `astro:env/server`, a virtual
  module that doesn't exist in Vitest's Node runtime. Integration tests need their own client
  using `@supabase/supabase-js`'s `createClient` (already installed at `^2.99.1`).
- **Local Supabase is running** at `http://127.0.0.1:54321`. Both the anon JWT and service role
  JWT are available via `npx supabase status`.
- **`.env` has `SUPABASE_URL`** but `SUPABASE_KEY` is currently set to the S3 Protocol Access
  Key ID — not the API JWT. Integration tests need `SUPABASE_SERVICE_ROLE_KEY` (the JWT service
  role key) added to `.env`.
- **All tables have RLS** (`listings`, `price_history`, `transaction_snapshots`). Service role
  key bypasses RLS policy evaluation. FK constraint `listings.user_id → auth.users(id)` still
  applies — a real `auth.users` row is required for test inserts.
- **Cascade chain**: deleting a test user cascades to `listings`, which cascades to
  `price_history` and `transaction_snapshots`. One `auth.admin.deleteUser(id)` call in `afterAll`
  is a complete cleanup.
- **`price_history.set_at`** defaults to `pg_catalog.now()` — rapid inserts in a single test
  can produce identical timestamps. Tests must supply explicit `set_at` values for deterministic
  ordering.

## Desired End State

After this plan:
- `npm run test:integration` runs 5 integration tests across 3 files and exits 0.
- `npm run test` (unit suite) still runs 4 tests and exits 0 — integration tests excluded from
  the unit run.
- Each test file creates its own isolated test user in `beforeAll` and deletes it in `afterAll`;
  no manual DB cleanup needed.
- `context/foundation/test-plan.md §6.2` cookbook pattern is filled in.
- Phase 2 row in `test-plan.md §3` is updated to `complete`.

### Key Discoveries

- `@supabase/supabase-js:createClient(url, serviceRoleKey)` — the right client for tests; no
  cookie adapter needed.
- `supabase.auth.admin.createUser({ email_confirm: true })` — creates a user without a real
  email flow; returns `{ data: { user: { id } } }` for FK use. Same call at teardown:
  `supabase.auth.admin.deleteUser(userId)` cascades everything.
- Vitest v4 loads `.env` via Vite's env system in Node environment — `process.env.SUPABASE_URL`
  and `process.env.SUPABASE_SERVICE_ROLE_KEY` will be available in test files without a
  `setupFiles` loader, provided the `.env` file has both keys.
- `price_history` rows need explicit `set_at` timestamps (ISO strings) in the INSERT payload to
  guarantee deterministic ordering in the subsequent `.order('set_at', { ascending: true })`
  assertion.
- The existing `vitest.config.ts` include `src/**/*.test.ts` would pick up files in
  `src/integration/`. Adding `exclude: ['src/integration/**']` restricts it to unit tests only.

## What We're NOT Doing

- No HTTP-layer testing of Astro API routes — tests call the Supabase SDK directly, matching
  the "cheapest layer" guidance in test-plan.md §2 Risk Response.
- No RLS enforcement verification — that is Phase 3 (R6, R7). Service role key bypasses RLS
  intentionally here.
- No CI wiring for integration tests — that is Phase 4.
- No commission arithmetic re-verification — Phase 1 covers R2; Phase 3 test just checks that a
  snapshot row exists, not its commission field values.
- No `.env.test` file — the single `.env` carries the service role key alongside other local dev
  vars; it is never committed.

## Implementation Approach

Sequential phases, each leaving the test suite in a passing state. Phase 1 is pure
infrastructure. Phases 2–4 each add one integration test file. Phase 5 updates docs. All
Supabase operations use the service role client from the shared helper.

## Critical Implementation Details

**`auth.admin.createUser` requires service role** — the service role client is the only one that
can call the Admin Auth API. The helper's `createClient(url, serviceRoleKey, { auth: {
persistSession: false } })` correctly produces this client.

**FK constraint survives service role bypass** — even with service role, inserting a
`listings` row with a `user_id` that doesn't exist in `auth.users` will fail with a FK
violation. The `beforeAll` user-creation step must complete before any table insert.

**`set_at` as an explicit ISO string** — `@supabase/supabase-js` accepts ISO strings for
`timestamptz` columns. Offsets of whole seconds (`+0ms`, `+1000ms`, `+2000ms` from a base
`Date`) produce values guaranteed to differ and sort correctly.

---

## Phase 1: Integration Test Infrastructure

### Overview

Wire up the parallel integration test layer: a new Vitest config, a `test:integration` script,
a `SUPABASE_SERVICE_ROLE_KEY` env placeholder, and the `createServiceRoleClient` helper. After
this phase, `npm run test:integration` exits 0 on an empty suite and the unit test run is
unaffected.

### Changes Required:

#### 1. Exclude integration directory from unit test config

**File**: `vitest.config.ts`

**Intent**: Prevent the existing `src/**/*.test.ts` glob from picking up future files under
`src/integration/` — keeping the unit suite fast and CI-safe.

**Contract**: Add `exclude: ['src/integration/**']` inside the `test` block.

#### 2. Create integration Vitest config

**File**: `vitest.integration.config.ts` (project root — new file)

**Intent**: A dedicated Vitest config for integration tests. Same `@/` alias as the unit config;
10 s timeout per test to accommodate real DB round-trips; includes only `src/integration/**/*.test.ts`.

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
    include: ['src/integration/**/*.test.ts'],
    testTimeout: 10_000,
  },
});
```

#### 3. Add test:integration script

**File**: `package.json` → `"scripts"`

**Intent**: Expose a single command to run the integration suite locally. The existing `test`
script (unit-only) is unchanged.

**Contract**:
```json
"test:integration": "vitest run --config vitest.integration.config.ts"
```
Add alongside `"test"` and `"test:watch"`.

#### 4. Document SUPABASE_SERVICE_ROLE_KEY in .env.example

**File**: `.env.example`

**Intent**: Record that integration tests require the service role JWT, without committing the
actual value.

**Contract**: Add `SUPABASE_SERVICE_ROLE_KEY=` (empty value, no comment block needed — the name
is self-documenting). Also add the actual service role JWT to local `.env` (obtain from
`npx supabase status`).

#### 5. Create Supabase test helper

**File**: `src/integration/helpers/supabase.ts` (new file — creates `src/integration/helpers/`
directory)

**Intent**: Single place to build the service role Supabase client; throws a clear error if env
vars are absent so misconfigurations surface immediately rather than as cryptic DB errors.

**Contract**:
```typescript
import { createClient } from '@supabase/supabase-js';

export function createServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to run integration tests'
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

### Success Criteria:

#### Automated Verification:

- `npm run test` exits 0 with 4 unit tests passing (integration directory excluded)
- `npm run test:integration` exits 0 with 0 test suites (empty suite, no error)
- `npm run lint` passes on `vitest.integration.config.ts` and `src/integration/helpers/supabase.ts`
- `npm run build` still passes

#### Manual Verification:

- `npm run test:integration` prints Vitest output showing the integration config was loaded
  (no "cannot find module" errors)

**Implementation Note**: After completing this phase and all automated verification passes, pause
here for manual confirmation before proceeding.

---

## Phase 2: Risk #1 — Listing Create/Edit Persistence

### Overview

Prove that all user-editable listing fields survive a write → DB read-back cycle. Two test
cases: create (new fields land in DB) and update (changed fields overwrite correctly). Challenges
the anti-pattern "asserting write succeeded without verifying DB state".

### Changes Required:

#### 1. Create listing persistence integration test

**File**: `src/integration/listing-persistence.test.ts` (new file)

**Intent**: Two `it` blocks sharing a single test user and a single listing row. The test reads
back from DB independently after each write — never asserts based on the SDK response payload
alone.

**Contract**: `describe('listing persistence', ...)` with:

**Setup/teardown**:
- `beforeAll`: call `createServiceRoleClient()`, then
  `supabase.auth.admin.createUser({ email: \`test-${Date.now()}@test.local\`, password: 'integration-test', email_confirm: true })`
  — store `testUserId`.
- `afterAll`: `supabase.auth.admin.deleteUser(testUserId)` — cascades listing deletion.

**Test 1 — `creates a listing and all fields are retrievable from DB`**:
- Insert into `listings`:
  `{ user_id: testUserId, type: 'sale', address: 'ul. Testowa 1, Warszawa', owner_name: 'Jan Kowalski', owner_phone: '+48 600 000 001', owner_email: 'jan@test.local' }`
- Store the returned `data[0].id` as `testListingId`.
- Read back: `.from('listings').select('type, address, owner_name, owner_phone, owner_email').eq('id', testListingId).single()`
- Assert each field matches the inserted value.

**Test 2 — `updates a listing and all changed fields are retrievable from DB`**:
- Requires `testListingId` from Test 1 — run sequentially within the same describe block.
- Update: `.from('listings').update({ type: 'occasional-rental', address: 'al. Zmieniona 2, Kraków', owner_name: 'Anna Nowak', owner_phone: null, owner_email: null }).eq('id', testListingId)`
- Read back: same select as Test 1.
- Assert `type = 'occasional-rental'`, `address = 'al. Zmieniona 2, Kraków'`, `owner_name = 'Anna Nowak'`, `owner_phone = null`, `owner_email = null`.

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` exits 0 with 2 tests passing in `listing-persistence.test.ts`
- `npm run test` exits 0 with 4 unit tests still passing (no interference)
- `npm run lint` passes on `src/integration/listing-persistence.test.ts`

#### Manual Verification:

- Run `npm run test:integration` with local Supabase stopped — test fails with the missing-env
  helper error (not a silent pass)

**Implementation Note**: Pause after this phase for manual verification before proceeding.

---

## Phase 3: Risk #4 — Listing Close / Reopen Data Lifecycle

### Overview

Prove that all listing fields survive the close transition (status → done, closed_at set,
snapshot created) and are fully restored after reopen (status → active, closed_at null, all
fields match original). Tests the DB state directly — not the API route. Challenges the
anti-pattern "testing only the status field, missing commission lock or document state".

### Changes Required:

#### 1. Create close/reopen integration test

**File**: `src/integration/listing-close-reopen.test.ts` (new file)

**Intent**: Two `it` blocks — close then reopen — sharing one listing created in `beforeAll`.
Assertions verify field parity, not just status, catching silent data corruption in the
transition writes.

**Contract**: `describe('listing close/reopen lifecycle', ...)` with:

**Setup/teardown**:
- `beforeAll`: create test user (same pattern as Phase 2), then insert a listing with known
  field values:
  `{ user_id: testUserId, type: 'sale', address: 'ul. Cykl 1, Gdańsk', owner_name: 'Piotr Wiśniewski', owner_phone: '+48 700 000 002', owner_email: 'piotr@test.local' }`
  Store `testListingId` and the original field values for parity assertions.
- `afterAll`: `supabase.auth.admin.deleteUser(testUserId)` — cascades listing + snapshot.

**Test 1 — `close transition persists all listing fields and creates a snapshot`**:
- Update `listings`:
  `{ status: 'done', closed_at: new Date().toISOString(), notary_name: 'Adam Notariusz', notary_city: 'Warszawa', transaction_date: '2026-06-01' }`
  `.eq('id', testListingId)`
- Insert `transaction_snapshots`:
  `{ listing_id: testListingId, user_id: testUserId, asking_price: 500000, commission_percent: 2 }`
- Read back listing: `.select('status, closed_at, type, address, owner_name, owner_phone, owner_email').eq('id', testListingId).single()`
- Assert: `status = 'done'`, `closed_at` is not null, `type/address/owner_name/owner_phone/owner_email` each match their original inserted values.
- Read back snapshot: `.from('transaction_snapshots').select('id').eq('listing_id', testListingId).is('voided_at', null).single()`
- Assert: snapshot row exists (no error, `data.id` is not null).

**Test 2 — `reopen transition restores active status and preserves all listing fields`**:
- Void snapshot: `.from('transaction_snapshots').update({ voided_at: new Date().toISOString() }).eq('listing_id', testListingId).is('voided_at', null)`
- Update listing: `.from('listings').update({ status: 'active', closed_at: null }).eq('id', testListingId)`
- Read back listing: same select as Test 1.
- Assert: `status = 'active'`, `closed_at = null`, `type/address/owner_name/owner_phone/owner_email` each match the original values.

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` exits 0 with 4 tests passing (2 from Phase 2 + 2 new)
- `npm run test` exits 0 with 4 unit tests
- `npm run lint` passes

#### Manual Verification:

- Inspect local Supabase Table Editor (or `psql`) after a failed run — confirm no orphaned
  listings from a partial test run (afterAll cascade worked)

**Implementation Note**: Pause after this phase for manual verification.

---

## Phase 4: Risk #5 — Price History Ordering

### Overview

Prove that after N price updates, the history contains exactly N entries in ascending
chronological order with correct values. Explicit `set_at` timestamps guarantee ordering is
deterministic regardless of DB clock resolution. Challenges the anti-pattern
"snapshot-without-meaning: asserting the array without verifying the ordering invariant".

### Changes Required:

#### 1. Create price history ordering integration test

**File**: `src/integration/price-history-ordering.test.ts` (new file)

**Intent**: Single `it` block. Inserts 3 price_history rows with known prices and explicit
`set_at` values. Queries with `.order('set_at', { ascending: true }).limit(100)`. Asserts count,
price values in order, AND that each `set_at` is strictly less than the next — verifying the
ordering invariant, not just "entries are present".

**Contract**: `describe('price history ordering', ...)` with:

**Setup/teardown**:
- `beforeAll`: create test user + listing (same pattern as Phase 2).
- `afterAll`: `supabase.auth.admin.deleteUser(testUserId)` — cascades listing + price_history.

**Test 1 — `price history contains exactly N entries in ascending chronological order`**:
- Define base timestamp: `const base = new Date()`
- Insert 3 rows into `price_history` (one at a time, sequentially — order matters for clarity):
  - `{ listing_id: testListingId, price: 450000, set_at: base.toISOString() }`
  - `{ listing_id: testListingId, price: 480000, set_at: new Date(base.getTime() + 1000).toISOString() }`
  - `{ listing_id: testListingId, price: 510000, set_at: new Date(base.getTime() + 2000).toISOString() }`
- Query: `.from('price_history').select('price, set_at').eq('listing_id', testListingId).order('set_at', { ascending: true }).limit(100)`
- Assert count: `data.length === 3`
- Assert values: `data[0].price === 450000`, `data[1].price === 480000`, `data[2].price === 510000`
- Assert ordering invariant:
  ```typescript
  expect(new Date(data[0].set_at).getTime()).toBeLessThan(new Date(data[1].set_at).getTime());
  expect(new Date(data[1].set_at).getTime()).toBeLessThan(new Date(data[2].set_at).getTime());
  ```

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` exits 0 with 5 tests passing (2 + 2 + 1)
- `npm run test` exits 0 with 4 unit tests
- `npm run lint` passes

#### Manual Verification:

- Intentionally break the ordering assertion (swap two prices) — confirm it fails with a clear
  expected/received diff, not a silent pass

**Implementation Note**: Pause after this phase for manual verification.

---

## Phase 5: Cookbook and Test Plan Update

### Overview

Fill in the integration test cookbook pattern in `test-plan.md §6.2` and advance the Phase 2
rollout row status to `complete`. This is the canonical reference future phases build on.

### Changes Required:

#### 1. Fill in §6.2 cookbook pattern

**File**: `context/foundation/test-plan.md` → `§6.2 Adding an integration test`

**Intent**: Replace the `TBD` placeholder with the settled pattern — createServiceRoleClient,
beforeAll user + listing, explicit timestamps, afterAll cascade cleanup, DB read-back assertion.

**Contract**: Replace the `TBD — see §3 Phase 2.` line with:
```markdown
Pattern: `createServiceRoleClient()` from `src/integration/helpers/supabase.ts` — returns a
`@supabase/supabase-js` client with service role access (RLS bypassed, FK constraints active).

Structure:
- `beforeAll`: `supabase.auth.admin.createUser({ email_confirm: true })` → store `testUserId`;
  insert any prerequisite rows with `user_id: testUserId`.
- `afterAll`: `supabase.auth.admin.deleteUser(testUserId)` — cascades to `listings` →
  `price_history`, `transaction_snapshots`.
- **Never assert only on the SDK write response.** Always read back from DB and compare field
  values explicitly.
- **Timestamp columns**: supply explicit ISO string values in INSERT payloads when tests depend
  on ordering (e.g. `price_history.set_at`). `DEFAULT pg_catalog.now()` is non-deterministic at
  sub-millisecond resolution.
- Run via: `npm run test:integration` (separate from `npm run test` unit gate).
```

#### 2. Update Phase 2 rollout row

**File**: `context/foundation/test-plan.md` → `§3 Phased Rollout` table

**Intent**: Advance Phase 2 status from `change opened` to `complete` and record the change
folder link.

**Contract**: In the Phase 2 row, update `Status` → `complete` and confirm
`context/changes/testing-persistence-data-lifecycle/` is in the `Change folder` column.

Also update the `Last updated:` line in the file header to today's date.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes on `context/foundation/test-plan.md` (Prettier-clean)

#### Manual Verification:

- Read `test-plan.md §6.2` — the cookbook reads as a complete, actionable pattern for the next
  developer adding an integration test

---

## Testing Strategy

### Integration Tests:

- 3 test files, 5 tests total: `listing-persistence.test.ts` (2), `listing-close-reopen.test.ts`
  (2), `price-history-ordering.test.ts` (1)
- Each file is fully isolated — own test user, own listings, own cleanup
- Service role client bypasses RLS; FK constraints remain active

### Unit Tests (unchanged):

- `src/lib/commission.test.ts` — 4 tests, `npm run test`

### Manual Testing:

1. Start local Supabase (`npx supabase start`)
2. Confirm `SUPABASE_SERVICE_ROLE_KEY` is set in `.env` (`npx supabase status` → SERVICE_ROLE_KEY)
3. Run `npm run test:integration` — all 5 tests pass
4. Run `npm run test` — 4 unit tests pass (no integration tests pulled in)
5. Stop Supabase, run `npm run test:integration` — error message from helper (not silent pass)

## References

- Test plan phase: `context/foundation/test-plan.md` §3 Phase 2
- Risk response guidance: `context/foundation/test-plan.md` §2 R1, R4, R5
- Phase 1 plan (Vitest bootstrap): `context/changes/testing-bootstrap-commission/plan.md`
- Listings schema: `supabase/migrations/20260525152607_create_listings.sql`
- Price history schema: `supabase/migrations/20260529120000_create_pricing_and_commission.sql`
- Close/reopen schema: `supabase/migrations/20260530120000_transaction_close.sql`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Integration Test Infrastructure

#### Automated

- [x] 1.1 `npm run test` exits 0 with 4 unit tests passing (integration directory excluded) — 3a5f3dd
- [x] 1.2 `npm run test:integration` exits 0 with 0 suites (empty suite, no error) — 3a5f3dd
- [x] 1.3 `npm run lint` passes on vitest.integration.config.ts and src/integration/helpers/supabase.ts — 3a5f3dd
- [x] 1.4 `npm run build` still passes — 3a5f3dd

#### Manual

- [ ] 1.5 `npm run test:integration` prints Vitest output showing integration config loaded (no module errors)

### Phase 2: Risk #1 — Listing Create/Edit Persistence

#### Automated

- [x] 2.1 `npm run test:integration` exits 0 with 2 tests passing in listing-persistence.test.ts — ed3aa5a
- [x] 2.2 `npm run test` exits 0 with 4 unit tests (no interference) — ed3aa5a
- [x] 2.3 `npm run lint` passes on src/integration/listing-persistence.test.ts — ed3aa5a

#### Manual

- [ ] 2.4 Running `npm run test:integration` with Supabase stopped fails with helper's missing-env error

### Phase 3: Risk #4 — Listing Close / Reopen Data Lifecycle

#### Automated

- [x] 3.1 `npm run test:integration` exits 0 with 4 tests passing (2 + 2) — 87ee2b3
- [x] 3.2 `npm run test` exits 0 with 4 unit tests — 87ee2b3
- [x] 3.3 `npm run lint` passes on src/integration/listing-close-reopen.test.ts — 87ee2b3

#### Manual

- [ ] 3.4 Inspect Supabase Table Editor after a failed run — no orphaned rows from partial test execution

### Phase 4: Risk #5 — Price History Ordering

#### Automated

- [x] 4.1 `npm run test:integration` exits 0 with 5 tests passing (2 + 2 + 1)
- [x] 4.2 `npm run test` exits 0 with 4 unit tests
- [x] 4.3 `npm run lint` passes on src/integration/price-history-ordering.test.ts

#### Manual

- [ ] 4.4 Intentionally swapping two price values in the ordering assertions causes the test to fail with a clear diff

### Phase 5: Cookbook and Test Plan Update

#### Automated

- [ ] 5.1 `npm run lint` passes on context/foundation/test-plan.md

#### Manual

- [ ] 5.2 §6.2 reads as a complete, actionable integration test cookbook pattern
