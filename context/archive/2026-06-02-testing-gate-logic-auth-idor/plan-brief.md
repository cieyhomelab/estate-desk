# Gate Logic + Auth Boundary + IDOR — Plan Brief

> Full plan: `context/changes/testing-gate-logic-auth-idor/plan.md`

## What & Why

Phase 3 of the test rollout adds API-level integration tests for three risks: the document gate
that must block a listing close when items are unchecked (Risk #3), auth enforcement that must
redirect unauthenticated requests before touching any data (Risk #6), and ownership checks that
must deny user B access to user A's resources even with a valid session (Risk #7). All three
require making real HTTP requests to the running Astro server — something no prior phase did.

## Starting Point

Phases 1 and 2 are complete: Vitest is installed, commission arithmetic is unit-tested, and
listing persistence/lifecycle is covered by integration tests that use the service-role client
for direct DB access with zero HTTP calls. The auth helpers, dev-server startup, and session
cookie machinery do not yet exist.

## Desired End State

`npm run test:integration:api` starts the local dev server, runs three test files (9 tests
total), and exits green. The document gate correctly blocks and passes based on checklist state.
Every sampled route returns 302→`/auth/signin` with no session. Cross-account requests return
an error redirect and leave the resource unchanged. `test-plan.md` §3 Phase 3 is marked
`complete` and §6.4 has the API test cookbook pattern for future contributors.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| HTTP request approach | `fetch()` to `astro dev` server via vitest `globalSetup` | Only approach that proves each Astro route independently calls `getUser()` — SDK-only tests would verify RLS but miss route-level auth. | Plan |
| Gate response assertion | `redirect: 'manual'` + `Location` header check | The close endpoint always returns 302 (never 4xx); `redirect:'manual'` exposes the raw Location so tests can distinguish error from success redirects. | Plan |
| Override scope | Inline `override_confirmed` only | The `listings.checklist_override` DB column exists but is not read by `close.ts`; testing only the implemented behavior avoids driving unintended feature work in this change. | Plan |
| IDOR expected response | Assert redirect to error URL, not resource | Current routes redirect on ownership mismatch (no 403 JSON); testing "resource not returned" is accurate to current behavior without requiring production code changes. | Plan |
| Auth scope | 4 representative routes (not all 17) | Sampling across the three ownership-enforcement patterns (explicit user_id filter, RLS subquery, ownership pre-check) gives real signal at minimum test count. | Plan |
| Session cookie helper | `@supabase/ssr` `setSession()` capture approach | Delegates cookie-name and value format entirely to the installed library rather than hardcoding a format that could differ between versions. | Plan |
| Test file layout | One file per risk | Three focused files match the three-risk structure; each can be run in isolation during development. | Plan |
| User isolation | 2 users per file, `beforeAll`/`afterAll` | Matches Phase 2 pattern; cascade delete on `deleteUser()` cleans up all owned data. | Plan |

## Scope

**In scope:**
- `src/integration/helpers/server.ts` — vitest globalSetup for dev server lifecycle
- `src/integration/helpers/auth.ts` — `getAuthCookieHeader()` session cookie helper
- `vitest.integration.api.config.ts` — new Vitest config with globalSetup
- `package.json` — `test:integration:api` script
- Restrict existing `vitest.integration.config.ts` to exclude `api/` subdirectory
- `src/integration/api/gate-logic.test.ts` — Risk #3 (3 tests)
- `src/integration/api/auth-boundary.test.ts` — Risk #6 (4 tests)
- `src/integration/api/idor.test.ts` — Risk #7 (2 tests)
- `context/foundation/test-plan.md` — Phase 3 status + §6.4 cookbook

**Out of scope:**
- `listings.checklist_override` DB flag (exists but not read by close.ts — separate change)
- All 17 routes for auth boundary (sample of 4 covers all patterns)
- Explicit 403 responses (routes currently redirect; no production code changes)
- CI wiring (Phase 4)

## Architecture / Approach

The new `vitest.integration.api.config.ts` adds a `globalSetup` that spawns `astro dev --port
4322`, polls until the server responds, and kills it in `teardown()`. Test files import
`TEST_BASE_URL` from the server helper and `getAuthCookieHeader()` from the auth helper. Data
setup (users, listings, documents) still uses the service-role client from Phase 2. All fetch
calls use `redirect: "manual"` to inspect the raw 302 + Location header. DB read-backs via
service-role client verify that resource state matches expectations after each HTTP call.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. API test infrastructure | Dev-server globalSetup, auth-cookie helper, new config + script | `astro dev` startup with Cloudflare adapter may behave unexpectedly; session cookie format must match `@supabase/ssr` internals |
| 2. Gate logic tests (Risk #3) | 3 tests: blocked / all-checked / override bypass | Close endpoint consumes listing on success — each scenario needs its own listing |
| 3. Auth boundary tests (Risk #6) | 4 tests: unauthenticated → /auth/signin per route | Simple; risk is that a route was changed to return 401 JSON instead of redirect |
| 4. IDOR tests + test-plan update (Risk #7) | 2 tests: cross-account close + contacts; test-plan.md updated | RLS-only enforcement (contacts/create) may differ in error slug from explicit-filter routes |

**Prerequisites:** Phase 2 tests (testing-persistence-data-lifecycle) complete; local Supabase
running; `.env` file present with `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

**Estimated effort:** ~2 sessions across 4 phases.

## Open Risks & Assumptions

- `astro dev --port 4322` works with the `@astrojs/cloudflare` adapter in local Node.js
  emulation mode. If the Cloudflare adapter requires `wrangler dev` for route handling, the
  globalSetup approach needs to switch to `wrangler dev --port 4322` and the startup detection
  logic may need adjustment.
- `getAuthCookieHeader()` relies on `@supabase/ssr`'s `setSession()` emitting cookies via the
  `setAll()` callback. If the installed version delays cookie writes or uses a different flow,
  the cookie header may be empty — debug by logging `captured` before returning.
- `contacts/create.ts` does not explicitly filter by `user_id`; it relies entirely on RLS. The
  IDOR test for this route will fail if the RLS policy has been dropped or disabled.

## Success Criteria (Summary)

- `npm run test:integration:api` exits 0 with 9 tests green (3 + 4 + 2).
- `npm run test:integration` exits 0 with Phase 2 tests unaffected.
- `test-plan.md` §3 Phase 3 row shows `complete`.
