# E2E Tests: Full Transaction Flow and CI Gate — Plan Brief

> Full plan: `context/changes/testing-e2e-ci-gate/plan.md`

## What & Why

Install Playwright and write three E2E spec files covering the risks that integration tests cannot reach: UI-driven field persistence verification (Risk #1), the full close flow with gate blocking confirmed by actual navigation outcome (Risk #3), and the done-state dashboard card + close detail page rendering after close/reopen (Risk #4). Wire all test layers (unit + integration + E2E) into CI as a required gate on every PR, completing Phase 4 of the test-plan rollout.

## Starting Point

No Playwright exists today. The project has solid Vitest integration tests (Phases 1–3) covering persistence, close logic, and auth/IDOR at the API layer — but nothing drives the browser. CI runs only unit tests. Three new GitHub Actions secrets are required before the CI step can pass.

## Desired End State

Three spec files run `npm run test:e2e` via a `playwright.config.ts` that starts Astro on port 4321 (separate from the integration test server on 4322). Each spec creates a fresh Supabase user in `beforeAll` and deletes it in `afterAll`. CI runs integration tests + E2E on every PR push using test Supabase credentials. The §6.3 E2E cookbook pattern in `test-plan.md` can be filled in.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Auth strategy | Programmatic login (sign in via API, set SSR cookies on `BrowserContext`) | Reuses `getAuthCookieHeader` pattern, avoids ~2s UI overhead per file, auth boundary already covered by Phase 3 | Plan |
| Gate doc pre-condition | Service role `UPDATE is_checked=true` in `beforeAll` | Fast, deterministic; doc toggle UI is outside Phase 4's risk scope | Plan |
| Field assertion scope (Risk #1) | All 5 create/edit fields including nullable owner fields | Nullable fields (owner_name/phone/email) are the most likely to be silently dropped in an INSERT | Plan |
| Done-state assertion depth (Risk #4) | Dashboard card **and** close detail page | Dashboard card alone would miss notary_name, notary_city, transaction_date, commission split | Plan |
| CI trigger | Every PR push (headless Chromium) | Matches Phase 4 goal "wire all tests into CI on push"; ~2–3 min overhead | Plan |
| CI test scope | Integration (DB + API) **and** Playwright E2E | Phase 4 goal says "all tests" — integration tests already exist and just need ci.yml wiring | Plan |
| Phase 4 test ordering | `test.describe.configure({ mode: 'serial' })` | Tests 2 and 3 depend on Test 1 having closed the listing | Plan |

## Scope

**In scope:**
- `@playwright/test` install + `playwright.config.ts` + `e2e/helpers/` (db + auth)
- `e2e/listing-persistence.spec.ts` — Risk #1, 2 tests
- `e2e/document-gate.spec.ts` — Risk #3, 3 tests
- `e2e/close-reopen-lifecycle.spec.ts` — Risk #4, 3 tests
- `.github/workflows/ci.yml` update — integration + E2E steps

**Out of scope:**
- Sign-in/sign-up UI flow testing (covered by Phase 3 integration tests)
- Cross-browser (Firefox, Safari) — Chromium only
- Visual regression / screenshot snapshots
- Commission arithmetic precision assertions — unit tests own that

## Architecture / Approach

All spec files share the same pattern: `beforeAll` creates a unique Supabase user via admin API, signs in programmatically, sets SSR cookies on a `BrowserContext`, and instantiates a `Page`. `afterAll` closes the context and deletes the user (cascades to DB rows). Test data setup uses the service role client (direct DB writes); UI-driven steps are the assertions. Playwright's `webServer` config starts `npm run dev` on port 4321; `reuseExistingServer` is true locally and false in CI.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Playwright Foundation | Config, helpers, scripts, .gitignore — no specs yet | `dotenv` not available in Node context for playwright.config.ts |
| 2. Risk #1 Persistence | `listing-persistence.spec.ts`: create + edit → reload → all 5 fields | Locating the listing's edit link after create redirect (use unique address prefix) |
| 3. Risk #3 Gate | `document-gate.spec.ts`: blocked, all-checked, inline-override | Override checkbox JS enablement (close.astro:362–368) must fire before click |
| 4. Risk #4 Lifecycle | `close-reopen-lifecycle.spec.ts`: serial close → done card + detail → reopen | commission_settings row must exist for agent_net to be non-null |
| 5. CI Gate | `ci.yml`: integration + E2E steps on every PR | 3 GitHub secrets must be set before first CI run passes |

**Prerequisites:** `SUPABASE_URL_TEST`, `SUPABASE_ANON_KEY_TEST`, `SUPABASE_SERVICE_ROLE_KEY_TEST` secrets set in GitHub Actions before Phase 5 passes.  
**Estimated effort:** ~3–4 sessions across 5 phases.

## Open Risks & Assumptions

- The `commission_settings` table schema beyond `user_id / tax_rate / agency_percent` is not confirmed — implementer must check the migration for additional required columns before the Phase 4 INSERT
- Test cleanup: `deleteTestUser` cascades to `listings`. If `commission_settings` does not have an FK to `auth.users`, it may need a separate `DELETE` in `afterAll`
- Port 4321 may be occupied by a developer's running dev server locally if `reuseExistingServer: true` is not working as expected — the config sets `reuseExistingServer: !process.env.CI` which handles this correctly

## Success Criteria (Summary)

- `npm run test:e2e` passes all 8 E2E tests locally
- `npm run lint` + `npm run test` + `npm run test:integration` + `npm run test:integration:api` + `npm run test:e2e` all pass in CI on a PR push
- Introducing a deliberate regression (e.g., dropping a field from `api/listings/create.ts`) causes the persistence spec to fail in CI within the normal PR workflow
