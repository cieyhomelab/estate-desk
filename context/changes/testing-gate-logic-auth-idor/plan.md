# Gate Logic + Auth Boundary + IDOR — Integration Tests (Phase 3)

## Overview

Phase 3 of the test rollout adds API-level integration tests for Risks #3, #6, and #7: the
document gate that blocks listing close, the auth check on protected routes, and cross-account
ownership enforcement (IDOR). All three require making real HTTP requests to the running Astro
server — this is the first phase to do so. Phase 1 therefore builds the HTTP test infrastructure
(dev-server globalSetup + session-cookie helper) before any test assertions are written.

## Current State Analysis

- Phases 1 and 2 complete: Vitest installed, unit tests for commission arithmetic, integration tests
  for listing persistence, price-history ordering, and close/reopen lifecycle — all using the
  service-role client for direct DB access, zero HTTP calls.
- `src/integration/helpers/supabase.ts` — `createServiceRoleClient()` is the only helper today.
- `vitest.integration.config.ts` — runs `src/integration/**/*.test.ts` in a node environment,
  `fileParallelism: false`, 10 s timeout; no `globalSetup`.
- `package.json` — `"test:integration"` runs the existing config; no API-layer script yet.
- Close endpoint (`src/pages/api/listings/[id]/close.ts`): always returns HTTP 302. Blocked gate
  → `Location: /dashboard/listings/{id}/close?error=brakujace-dokumenty`; success →
  `Location: /dashboard/listings/{id}/close?success=zamknieto`. Only the inline
  `override_confirmed` form field is checked today — the `listings.checklist_override` DB column
  exists (from S-05) but is not read by the endpoint.
- All 17 API routes independently call `supabase.auth.getUser()` and redirect to `/auth/signin`
  when no authenticated session is found. No shared middleware injection for API routes.
- Ownership enforcement is handled two ways: explicit `.eq("user_id", user.id)` filter (most
  mutation routes) or RLS subquery policy (contacts/create.ts, relying on the DB to enforce
  that `listing_id` belongs to the current user).

## Desired End State

`npm run test:integration:api` starts the Astro dev server, runs three test files covering
Risks #3, #6, and #7, tears down the server, and exits with code 0. Tests assert:
- Gate correctly blocks/passes close based on checklist state and inline override.
- Every sampled API route independently returns 302→/auth/signin with no session.
- Cross-account requests return a redirect to an error URL, not to the requested resource.

`test-plan.md` §3 Phase 3 status is updated to `complete` and §6.4 contains the session-
parameterized test cookbook pattern.

### Key Discoveries:

- `src/pages/api/listings/[id]/close.ts:37-39` — ownership mismatch on `.single()` returns
  `PGRST116` which lands in `listingError`, redirecting to `/dashboard?error=nie-znaleziono`.
- `src/pages/api/listings/[id]/contacts/create.ts:46-47` — no explicit user_id filter; the DB
  insert is blocked by RLS subquery policy, mapping to `insertError` →
  `?error=blad-zapisu` redirect.
- `@supabase/ssr`'s `createServerClient` reads session from cookies via the `getAll()` callback;
  using its own `setSession()` to capture what it writes is the reliable way to build a test
  Cookie header without guessing the internal key format.
- `astro:env/server` declares both Supabase vars as optional strings — `astro dev` will start
  without them but the routes will return misconfigured redirects; the `.env` file must be present
  when the globalSetup spawns the dev server.
- The dev server port 4322 (not the default 4321) avoids conflicts with a running local dev
  session.

## What We're NOT Doing

- **Not testing `listings.checklist_override` DB column** — the column exists but `close.ts` does
  not read it. Testing only the inline `override_confirmed` form field (current behavior). The gap
  is documented here; a separate change should wire the column and add a test.
- **Not testing all 17 API routes for auth boundary** — a representative sample of 4 (create,
  close, contacts/create, documents/add) covers all ownership-check patterns at the cheapest cost.
- **Not adding explicit 403 responses** — current routes redirect (302 → error URL) rather than
  returning a 403. Tests assert "redirect to an error URL, not the resource" without requiring
  status code changes.
- **Not wiring Phase 3 tests into CI** — that is Phase 4's job (E2E + CI gate).
- **Not testing the Cloudflare Workers runtime** — `astro dev` uses a local Node.js emulation.
  Pre-prod smoke on the actual Workers runtime remains optional (§5 Quality Gates).

## Implementation Approach

Four phases in strict order: infrastructure first, then one test file per risk. Each phase's
tests must be green before the next phase starts. The `src/integration/api/` subdirectory holds
all Phase 3 test files; a new `vitest.integration.api.config.ts` targets only that subdirectory
and adds the globalSetup. The existing `vitest.integration.config.ts` is restricted to
`src/integration/*.test.ts` (no recursive wildcard into `api/`) to prevent Phase 3 tests from
running without the dev-server globalSetup.

## Critical Implementation Details

**Session cookie helper**: `@supabase/ssr`'s `createServerClient` determines cookie names and
formats internally. The safest way to produce a valid `Cookie` header for test requests is to
call `setSession()` on an SSR client backed by a mock cookie store that captures all `setAll()`
writes, then join those writes into `name=value; ...` format. Do NOT guess the cookie name by
hardcoding `sb-127-auth-token` — the format can differ between `@supabase/ssr` minor versions.

**Dev server startup**: The globalSetup must poll `http://localhost:4322/` with `fetch` until it
gets any non-connection-refused response (status 200 or redirect is both fine) before resolving.
Parsing stdout is fragile; polling is reliable. Timeout at 60 s.

**Close endpoint consumes the listing**: A successful POST to `/close` sets `status = 'done'`.
Create separate listings for the blocked test and the override-bypass test — using the same
listing for both relies on test ordering and will fail if the override test runs first.

---

## Phase 1: API Test Infrastructure

### Overview

Creates the three pieces of infrastructure that Phases 2–4 depend on: a vitest globalSetup file
that starts/stops the Astro dev server, an auth-cookie helper that builds a valid session
`Cookie` header using `@supabase/ssr`'s own machinery, and the new vitest config + npm script.
Also restricts the existing integration config to prevent API test files from running without
the dev server.

### Changes Required:

#### 1. Dev-server globalSetup

**File**: `src/integration/helpers/server.ts`

**Intent**: Export `setup()` and `teardown()` per vitest's globalSetup contract. `setup()`
spawns `astro dev` on port 4322, polls until the server responds, then resolves. `teardown()`
kills the process. Also exports `TEST_BASE_URL` as a compile-time constant so test files can
import it without environment-variable cross-process issues.

**Contract**:

```typescript
import { spawn } from "node:child_process";

export const TEST_BASE_URL = "http://localhost:4322";
const TEST_SERVER_PORT = 4322;

let serverProcess: ReturnType<typeof spawn> | undefined;

export async function setup(): Promise<void> {
  serverProcess = spawn("npm", ["run", "dev", "--", "--port", String(TEST_SERVER_PORT), "--no-open"], {
    stdio: "ignore",
    shell: true,
  });

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      await fetch(TEST_BASE_URL, { signal: AbortSignal.timeout(2_000) });
      return; // server is up
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Dev server did not respond on port ${TEST_SERVER_PORT} within 60 s`);
}

export async function teardown(): Promise<void> {
  serverProcess?.kill("SIGTERM");
}
```

#### 2. Auth-cookie helper

**File**: `src/integration/helpers/auth.ts`

**Intent**: `getAuthCookieHeader(email, password)` signs in a user and returns a `Cookie` header
string that the Astro SSR routes accept. Delegates cookie-name and value serialization entirely
to `@supabase/ssr` to stay format-agnostic.

**Contract**:

```typescript
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function getAuthCookieHeader(email: string, password: string): Promise<string> {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_KEY!; // anon key

  // Sign in to obtain tokens
  const anonClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { session }, error } = await anonClient.auth.signInWithPassword({ email, password });
  if (error || !session) throw new Error(`getAuthCookieHeader sign-in failed: ${error?.message}`);

  // Let @supabase/ssr write cookies to a capture store, then serialize
  const captured: Array<{ name: string; value: string }> = [];
  const ssrClient = createServerClient(url, key, {
    cookies: {
      getAll: () => captured,
      setAll: (cs) => cs.forEach((c) => captured.push({ name: c.name, value: c.value })),
    },
  });
  await ssrClient.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  return captured.map((c) => `${c.name}=${c.value}`).join("; ");
}
```

#### 3. New vitest API config

**File**: `vitest.integration.api.config.ts`

**Intent**: Mirrors `vitest.integration.config.ts` but adds `globalSetup` pointing at
`server.ts`, targets only `src/integration/api/**/*.test.ts`, and raises the timeout to 30 s
to accommodate server startup latency.

**Contract**: Copy `vitest.integration.config.ts` verbatim, then apply three changes:
- `globalSetup: ["src/integration/helpers/server.ts"]`
- `include: ["src/integration/api/**/*.test.ts"]`
- `testTimeout: 30_000`

#### 4. Restrict existing integration config

**File**: `vitest.integration.config.ts`

**Intent**: Prevent `api/` test files from running under the existing config (which has no
globalSetup and no dev server).

**Contract**: Change `include` from `["src/integration/**/*.test.ts"]` to
`["src/integration/*.test.ts"]` — only files directly in `src/integration/`, not subdirectories.

#### 5. New npm script

**File**: `package.json`

**Intent**: Add `"test:integration:api"` so Phase 3 tests have a dedicated entry point.

**Contract**: Add to `scripts`:
`"test:integration:api": "vitest run --config vitest.integration.api.config.ts"`

### Success Criteria:

#### Automated Verification:

- `npm run test:integration` still passes (unchanged Phase 2 tests).
- `npm run test:integration:api` exits without "Dev server did not respond" error (server
  starts successfully, even with no test files yet in `src/integration/api/`).
- `npx tsc --noEmit` (or `npm run build` type-check) passes with the new files.

#### Manual Verification:

- Running `npm run test:integration:api` shows the dev server starting and the test run
  completing in the terminal output.
- Running `npm run test:integration` does NOT try to start a dev server.

**Implementation Note**: Pause here and verify both scripts behave as expected before writing
any test files. The infrastructure phase is the riskiest — a broken globalSetup blocks all
subsequent phases.

---

## Phase 2: Gate Logic Tests (Risk #3)

### Overview

Proves at the API level that the document gate in `close.ts` (a) blocks close with unchecked
documents and no inline override, (b) passes with all items checked, and (c) passes with the
inline `override_confirmed=true` bypass. Uses the service-role client for data setup and the
auth-cookie helper for session.

### Changes Required:

#### 1. Gate logic test file

**File**: `src/integration/api/gate-logic.test.ts`

**Intent**: Three integration tests against POST `/api/listings/{id}/close`. All use
`redirect: "manual"` so the raw 302 and `Location` header are visible. Separate listings for
the blocked test and the override test to avoid ordering dependencies.

**Contract**:

Structure:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServiceRoleClient } from "../helpers/supabase";
import { getAuthCookieHeader } from "../helpers/auth";
import { TEST_BASE_URL } from "../helpers/server";

describe("gate logic — POST close", () => {
  const supabase = createServiceRoleClient();
  let testUserId: string;
  let authCookie: string;
  // Three separate listings: each test scenario gets its own
  let blockedListingId: string;    // has unchecked docs; used for the blocked test
  let overrideListingId: string;   // has unchecked docs; used for the override test
  let allCheckedListingId: string; // no unchecked docs; used for the all-checked test
```

`beforeAll`:
1. `supabase.auth.admin.createUser({ email: test-${Date.now()}@test.local, password: "integration-test", email_confirm: true })` → store `testUserId`.
2. `getAuthCookieHeader(email, "integration-test")` → store `authCookie`.
3. Insert three listings for `testUserId` via service-role client → store their IDs.
4. Insert 2 `listing_documents` rows with `is_checked: false`, `user_id: testUserId`, `listing_id: blockedListingId`, arbitrary label + position.
5. Insert 2 `listing_documents` rows with `is_checked: false`, `user_id: testUserId`, `listing_id: overrideListingId`.
6. `allCheckedListingId` gets no documents (uncheckedCount = 0 → gate passes).

`afterAll`:
- `supabase.auth.admin.deleteUser(testUserId)` — cascades to listings, documents, snapshots.

Tests use a shared helper for the fetch call:
```typescript
async function postClose(listingId: string, fields: Record<string, string> = {}, cookie: string) {
  const body = new URLSearchParams(fields);
  return fetch(`${TEST_BASE_URL}/api/listings/${listingId}/close`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
    body,
    redirect: "manual",
  });
}
```

Test 1 — blocked:
```
it("blocks close when checklist is incomplete and no override_confirmed", async () => {
  const res = await postClose(blockedListingId, {}, authCookie);
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toContain("brakujace-dokumenty");

  // Verify listing was NOT closed
  const { data } = await supabase.from("listings").select("status").eq("id", blockedListingId).single();
  expect(data?.status).toBe("active");
});
```

Test 2 — all checked passes:
```
it("passes close when all checklist items are checked", async () => {
  const res = await postClose(allCheckedListingId, {}, authCookie);
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toContain("zamknieto");

  const { data } = await supabase.from("listings").select("status").eq("id", allCheckedListingId).single();
  expect(data?.status).toBe("done");
});
```

Test 3 — override bypass:
```
it("bypasses gate with override_confirmed=true even with unchecked items", async () => {
  const res = await postClose(overrideListingId, { override_confirmed: "true" }, authCookie);
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toContain("zamknieto");

  const { data } = await supabase.from("listings").select("status").eq("id", overrideListingId).single();
  expect(data?.status).toBe("done");
});
```

### Success Criteria:

#### Automated Verification:

- `npm run test:integration:api` runs `gate-logic.test.ts` and all three tests pass green.
- The blocked test's DB read-back confirms `status` is still `"active"` — not just that the Location was correct.
- The two success tests' DB read-backs confirm `status` is `"done"`.

#### Manual Verification:

- Check that the test output names the three scenarios clearly in the terminal (not just "test 1/2/3").
- Verify in the Supabase local dashboard (or via service-role query) that afterAll cleanup deleted the test user and cascaded to its listings.

**Implementation Note**: If the `postClose` helper returns a 302 with a `Location` pointing to `/auth/signin`, the `authCookie` was not accepted by the route — debug the cookie helper before writing the IDOR tests.

---

## Phase 3: Auth Boundary Tests (Risk #6)

### Overview

Proves that each sampled API route independently validates the session by returning a redirect to
`/auth/signin` when no `Cookie` header is present. No DB setup needed — the auth check fires
before any DB query, so a fake (but UUID-formatted) listing ID is sufficient.

### Changes Required:

#### 1. Auth boundary test file

**File**: `src/integration/api/auth-boundary.test.ts`

**Intent**: Four tests, one per representative route, each making a POST with no Cookie header
and asserting the `Location` is `/auth/signin`.

**Contract**:

The four routes to test, covering all three ownership-enforcement patterns in the codebase:

| Route | Method | Represents |
|---|---|---|
| `/api/listings/create` | POST | Top-level listing mutation (no `[id]` param) |
| `/api/listings/{fakeId}/close` | POST | Explicit `.eq("user_id")` filter pattern |
| `/api/listings/{fakeId}/contacts/create` | POST | RLS-enforced ownership pattern |
| `/api/listings/{fakeId}/documents/add` | POST | Explicit ownership pre-check pattern |

`fakeId = "00000000-0000-0000-0000-000000000001"` — valid UUID format, no real row needed.

For each route: `fetch(url, { method: "POST", body: new URLSearchParams(minimalBody), redirect: "manual" })` — no Cookie header.

Minimal bodies to avoid early-exit on validation before auth:
- `create`: `{ type: "sale", address: "Test" }`
- `close`: empty (`{}`)
- `contacts/create`: `{ name: "X", role: "kupujący" }`
- `documents/add`: `{ label: "X" }`

Each test:
```typescript
expect(res.status).toBe(302);
expect(res.headers.get("location")).toBe("/auth/signin");
```

Structure the file as a single `describe("unauthenticated access returns redirect to signin", ...)` with one `it(...)` per route. No `beforeAll`/`afterAll` — no DB state needed.

### Success Criteria:

#### Automated Verification:

- All four tests pass: status 302 + Location `/auth/signin` for every sampled route.
- `npm run test:integration:api` runs all three test files together cleanly.

#### Manual Verification:

- The `Location` header is exactly `/auth/signin` (not `/auth/signin?redirect=...`), confirming
  the routes use the correct redirect target and haven't changed their behavior.

---

## Phase 4: IDOR Tests + Test-Plan Update (Risk #7)

### Overview

Proves that a valid authenticated session belonging to user B cannot access user A's resources.
Uses two users: user A (the legitimate owner) and user B (the attacker). Tests the two ownership-
enforcement patterns — explicit user_id filter (close.ts) and RLS subquery policy
(contacts/create.ts) — to confirm both mechanisms deny cross-account access.
Closes the phase by updating `test-plan.md`.

### Changes Required:

#### 1. IDOR test file

**File**: `src/integration/api/idor.test.ts`

**Intent**: Two users (A and B) created in `beforeAll`. User A owns a listing. All fetch calls
use user B's session cookie. Both tests assert that user B receives an error redirect, not
the resource, and that no resource was modified.

**Contract**:

```typescript
describe("IDOR — authenticated cross-account access is denied", () => {
  const supabase = createServiceRoleClient();
  let userAId: string;
  let userBId: string;
  let userAListingId: string;
  let userBCookie: string;
```

`beforeAll`:
1. Create user A via `supabase.auth.admin.createUser(...)` → store `userAId`.
2. Create user B via `supabase.auth.admin.createUser(...)` → store `userBId`.
3. `getAuthCookieHeader(userBEmail, password)` → store `userBCookie`.
4. Insert a listing for user A via service-role (explicitly `user_id: userAId`) → store `userAListingId`.
5. Insert 1 unchecked document for user A's listing (so the close gate is relevant).

`afterAll`:
- `supabase.auth.admin.deleteUser(userAId)` — cascades to listing, documents.
- `supabase.auth.admin.deleteUser(userBId)`.

Test 1 — close with explicit user_id filter:
```typescript
it("user B cannot close user A listing (explicit user_id filter)", async () => {
  const res = await fetch(`${TEST_BASE_URL}/api/listings/${userAListingId}/close`, {
    method: "POST",
    headers: { Cookie: userBCookie, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ override_confirmed: "true" }),
    redirect: "manual",
  });

  expect(res.status).toBe(302);
  const location = res.headers.get("location") ?? "";
  // Must not redirect to the success URL; must redirect to an error URL
  expect(location).not.toContain("zamknieto");
  expect(location).toContain("nie-znaleziono");

  // Verify resource was not modified
  const { data } = await supabase.from("listings").select("status").eq("id", userAListingId).single();
  expect(data?.status).toBe("active");
});
```

Test 2 — contacts/create with RLS:
```typescript
it("user B cannot create contact on user A listing (RLS subquery)", async () => {
  const res = await fetch(`${TEST_BASE_URL}/api/listings/${userAListingId}/contacts/create`, {
    method: "POST",
    headers: { Cookie: userBCookie, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ name: "AttackerContact", role: "kupujący" }),
    redirect: "manual",
  });

  expect(res.status).toBe(302);
  const location = res.headers.get("location") ?? "";
  expect(location).toContain("blad-zapisu");

  // Verify no contact was inserted for user A's listing
  const { count } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", userAListingId)
    .eq("name", "AttackerContact");
  expect(count).toBe(0);
});
```

#### 2. Update test-plan.md

**File**: `context/foundation/test-plan.md`

**Intent**: Mark Phase 3 complete and fill in the §6.4 API test cookbook pattern.

**Contract**:

In §3 Phased Rollout table, change Phase 3 row:
- `Status`: `"change opened"` → `"complete"`
- `Change folder`: already correct (`context/changes/testing-gate-logic-auth-idor/`)

In §6.4 "TBD — see §3 Phase 3", replace with:

```markdown
### 6.4 Adding a test for an API endpoint (session-parameterized)

Pattern: HTTP fetch to dev server started by `src/integration/helpers/server.ts` globalSetup.
Use `vitest.integration.api.config.ts` and `npm run test:integration:api`.

Structure:

- Import `{ TEST_BASE_URL }` from `../helpers/server` for the base URL.
- Import `{ getAuthCookieHeader }` from `../helpers/auth` to build a Cookie header.
- `beforeAll`: `supabase.auth.admin.createUser(...)` + `getAuthCookieHeader(email, pass)` for
  each session role needed (owner, attacker, unauthenticated = no cookie).
- `afterAll`: `supabase.auth.admin.deleteUser(userId)` for each created user.
- Fetch: `fetch(url, { redirect: "manual" })` to see the raw 302 + Location header.
- Three assertion classes per endpoint:
  - No Cookie header → `Location === '/auth/signin'` (auth boundary)
  - Owner's Cookie → `Location` contains success slug (happy path)
  - Attacker's Cookie → `Location` contains error slug, resource unchanged in DB (IDOR)
- Verify DB state (service-role read-back) for any test where the resource should have been
  modified or protected from modification.
```

Also update the last-updated date at the top of the file.

### Success Criteria:

#### Automated Verification:

- `npm run test:integration:api` runs all three test files: gate-logic, auth-boundary, idor —
  all pass.
- IDOR test 1 DB read-back confirms `status` is still `"active"` after user B's close attempt.
- IDOR test 2 count query confirms `AttackerContact` was NOT inserted.

#### Manual Verification:

- `test-plan.md` Phase 3 status shows `complete` in the §3 table.
- `test-plan.md` §6.4 contains the full API test cookbook pattern (not "TBD").
- `change.md` status updated to `complete` and `updated` date set to today.

---

## Testing Strategy

### Unit Tests:

- None added in this change — the infrastructure helpers (`server.ts`, `auth.ts`) are tested
  implicitly by the integration tests using them.

### Integration Tests:

- `src/integration/api/gate-logic.test.ts` — 3 tests (blocked, all-checked, override bypass)
- `src/integration/api/auth-boundary.test.ts` — 4 tests (one per sampled route)
- `src/integration/api/idor.test.ts` — 2 tests (close with explicit filter, contacts with RLS)

### Manual Testing Steps:

1. After Phase 1: run `npm run test:integration:api` and confirm the dev server starts, tests
   are collected, and the run completes without hanging.
2. After Phase 2: observe that the blocked-test output includes the `brakujace-dokumenty`
   location and the DB read-back confirms `status: active`.
3. After Phase 4: run `npm run test:integration` separately and confirm Phase 2 tests still pass
   (no regression from restricting the config include pattern).

## Migration Notes

No schema migrations. The `listing_documents` rows inserted in test setup are cleaned up by
`supabase.auth.admin.deleteUser()` cascade — no manual cleanup needed.

## References

- Risk map and response guidance: `context/foundation/test-plan.md` §2
- Phase 2 test pattern: `src/integration/listing-close-reopen.test.ts`
- Service-role helper: `src/integration/helpers/supabase.ts`
- Close endpoint: `src/pages/api/listings/[id]/close.ts`
- Contacts create: `src/pages/api/listings/[id]/contacts/create.ts`
- Transaction-close plan (gate design): `context/changes/transaction-close/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: API Test Infrastructure

#### Automated

- [x] 1.1 `npm run test:integration` still passes (Phase 2 tests unaffected by config change) — b90ebe9
- [x] 1.2 `npm run test:integration:api` exits without "Dev server did not respond" error — b90ebe9
- [x] 1.3 `npx tsc --noEmit` passes with new helper files — b90ebe9

#### Manual

- [ ] 1.4 `npm run test:integration:api` shows dev server starting in terminal output
- [ ] 1.5 `npm run test:integration` does NOT attempt to start a dev server

### Phase 2: Gate Logic Tests (Risk #3)

#### Automated

- [x] 2.1 All three gate-logic tests pass (`npm run test:integration:api`) — cb0ba4e
- [x] 2.2 Blocked test DB read-back confirms listing status is still `active` — cb0ba4e
- [x] 2.3 Both success tests DB read-backs confirm listing status is `done` — cb0ba4e

#### Manual

- [ ] 2.4 Terminal output names all three scenarios clearly
- [ ] 2.5 afterAll cleanup confirmed: test user and cascaded listings deleted

### Phase 3: Auth Boundary Tests (Risk #6)

#### Automated

- [x] 3.1 All four auth-boundary tests pass
- [x] 3.2 Location header is exactly `/auth/signin` for all four routes

#### Manual

- [ ] 3.3 No regression in Phase 2 gate tests when all files run together

### Phase 4: IDOR Tests + Test-Plan Update (Risk #7)

#### Automated

- [ ] 4.1 Both IDOR tests pass (`npm run test:integration:api`)
- [ ] 4.2 IDOR test 1 DB read-back confirms listing status still `active`
- [ ] 4.3 IDOR test 2 count query confirms `AttackerContact` not inserted

#### Manual

- [ ] 4.4 `test-plan.md` §3 Phase 3 status shows `complete`
- [ ] 4.5 `test-plan.md` §6.4 contains the full API test cookbook pattern
- [ ] 4.6 `change.md` status updated to `complete`
