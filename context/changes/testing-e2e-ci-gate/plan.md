# E2E Tests: Full Transaction Flow and CI Gate

## Overview

Install Playwright from scratch, write three spec files that cover Risks #1 (listing field persistence after create/edit), #3 (document gate blocks/passes correctly), and #4 (done-state lifecycle after close/reopen), and wire all tests (integration + E2E) into CI as a required gate on every PR push.

## Current State Analysis

No Playwright exists. The test stack has:
- Unit tests: Vitest, runs in CI via `npm run test`
- Integration tests (DB): `src/integration/listing-persistence.test.ts`, `listing-close-reopen.test.ts`, `price-history-ordering.test.ts` — run locally only
- Integration tests (API): `src/integration/api/auth-boundary.test.ts`, `gate-logic.test.ts`, `idor.test.ts` — run locally only, dev server on port 4322
- Auth helper: `src/integration/helpers/auth.ts:getAuthCookieHeader()` — adaptable for Playwright
- DB helper: `src/integration/helpers/supabase.ts:createServiceRoleClient()` — reusable directly
- CI: `.github/workflows/ci.yml` runs `npm ci → astro sync → lint → npm run test → npm run build`; no integration or E2E steps

## Desired End State

Three Playwright spec files cover Risks #1, #3, #4 with full UI-driven assertions. `playwright.config.ts` starts the Astro dev server on port 4321 (separate from the integration test server on 4322). `ci.yml` runs `test:integration`, `test:integration:api`, and `test:e2e` on every PR push using three new GitHub Actions secrets for the test Supabase project.

### Key Discoveries:

- Polish form labels confirmed: `"Typ ogłoszenia"`, `"Adres nieruchomości"`, `"Imię i nazwisko właściciela"`, `"Telefon właściciela"`, `"E-mail właściciela"` (new.astro:22–82, edit.astro:67–129)
- Close form labels: `"Imię i nazwisko notariusza"`, `"Miasto kancelarii notarialnej"`, `"Data transakcji"`, `"Notatki"`; override checkbox label: `"Pomiń weryfikację dokumentów"` (close.astro:208–253)
- Gate logic in close.astro:78: `gatePass = uncheckedCount === 0`; submit button `disabled={!gatePass}` (close.astro:260); JS enables button when override checkbox is checked (close.astro:362–368)
- Dashboard card: status badge `"Ukończone"` (done), `"Aktywne"` (active); done card shows `"Zysk agenta: X zł"` (ListingCard.astro:40–45); reopen button on done card is a form submit (not a link) (ListingCard.astro:82–89)
- Service role env var: `SUPABASE_SERVICE_ROLE_KEY` (`src/integration/helpers/supabase.ts:5`)
- Port separation: integration test dev server = 4322, Playwright dev server = 4321 — no conflict

## What We're NOT Doing

- Testing the signin/signup UI flow — auth boundary covered by Phase 3 integration tests
- Cross-browser testing (Firefox, Safari/WebKit) — Chromium headless only
- Visual regression / screenshot snapshots
- Commission arithmetic precision — unit tests cover that; E2E asserts the field renders (not null), not the exact PLN value
- Wiring the tests to a separate Supabase project from the one in `.env.test` — same test project used locally and in CI

## Implementation Approach

Each spec file creates its own test user in `beforeAll` via `supabase.auth.admin.createUser` and deletes it in `afterAll` (which cascades to all listing data). Auth is programmatic: sign in via the anon client, capture SSR cookies with `createServerClient`, set them on a Playwright `BrowserContext` via `context.addCookies()`. Tests share a single authenticated `context` and `page` within a file. Test data setup (creating listings, pre-checking docs, setting prices) uses the service role client — the E2E assertions are the page-level renders, not the write paths for setup data. The exception is Phase 2 where the write path (UI form submit) is itself under test.

## Critical Implementation Details

**Cookie domain for `context.addCookies`**: Supabase SSR cookies must be added with `domain: 'localhost'`, `path: '/'`, `httpOnly: true`, `secure: false`, `sameSite: 'Lax'`. Without the `httpOnly: true` flag the Astro `createClient` won't see the session.

**`test.describe.configure({ mode: 'serial' })` in Phase 4**: The close-reopen-lifecycle spec runs tests in dependency order (Test 1 closes the listing; Tests 2 and 3 depend on that state). Add `test.describe.configure({ mode: 'serial' })` at the top of that file to prevent Playwright from running tests in arbitrary order.

**`dotenv` in `playwright.config.ts`**: `playwright.config.ts` runs in Node outside Vite, so it cannot read `.env.test` automatically. Add `import 'dotenv/config'` with `{ path: '.env.test' }` at the top of the config, and add `dotenv` to devDependencies if not already present.

**Integration test dev server port 4322 vs Playwright port 4321**: The integration test `globalSetup` starts Astro on 4322. Playwright's `webServer` starts a separate dev process on 4321. These never run simultaneously in CI (sequential steps) so there is no conflict.

**`commission_settings` INSERT for Phase 4 setup**: Check the migration for the exact column list before inserting. The minimum required fields observed from usage are `user_id`, `tax_rate`, `agency_percent`. If there is a primary key column other than `user_id`, include it.

---

## Phase 1: Playwright Foundation

### Overview

Install `@playwright/test`, create `playwright.config.ts`, create `e2e/` helpers for auth and DB access, update `package.json` scripts and `.gitignore`. No test specs yet — phase ends with the config loading cleanly against the dev server.

### Changes Required:

#### 1. Install dependencies

**File**: `package.json`

**Intent**: Add `@playwright/test` and `dotenv` as devDependencies and expose three test scripts.

**Contract**:
- devDependencies to add: `"@playwright/test": "^1.53.0"`, `"dotenv": "^16.5.0"` (only if dotenv is not already present — check existing deps)
- Scripts to add:
  - `"test:e2e": "playwright test"`
  - `"test:e2e:headed": "playwright test --headed"`
  - `"test:e2e:ui": "playwright test --ui"`

#### 2. Playwright config

**File**: `playwright.config.ts` (project root, new)

**Intent**: Configure Playwright to load `.env.test`, start the Astro dev server on port 4321, and run Chromium headless with sensible CI defaults.

**Contract**:
```ts
import 'dotenv/config'; // must be first import so process.env is populated
// dotenv.config({ path: '.env.test' }) — use this form to target .env.test explicitly
```
Config shape:
- `testDir: './e2e'`
- `timeout: 30_000`
- `retries: process.env.CI ? 1 : 0`
- `workers: process.env.CI ? 1 : undefined`
- `reporter: process.env.CI ? 'github' : 'html'`
- `use.baseURL: 'http://localhost:4321'`
- `use.trace: 'on-first-retry'`
- `projects`: single entry `{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }`
- `webServer`:
  - `command: 'npm run dev'`
  - `url: 'http://localhost:4321'`
  - `reuseExistingServer: !process.env.CI`
  - `env: { SUPABASE_URL: process.env.SUPABASE_URL ?? '', SUPABASE_KEY: process.env.SUPABASE_KEY ?? '' }` — passes test credentials to the spawned dev server

#### 3. E2E DB helper

**File**: `e2e/helpers/db.ts` (new)

**Intent**: Service role Supabase client and a doc-checker helper for test data setup.

**Contract**:
- `createE2ESupabaseClient()`: mirrors `src/integration/helpers/supabase.ts:createServiceRoleClient()` — uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from `process.env`; throws if either is absent
- `checkAllListingDocs(listingId: string): Promise<void>`: `UPDATE listing_documents SET is_checked = true WHERE listing_id = listingId` via service role — used by Phase 3 and Phase 4 setup

#### 4. E2E auth helper

**File**: `e2e/helpers/auth.ts` (new)

**Intent**: Create unique test users and generate Playwright-compatible session cookies.

**Contract**:
- `createTestUser(supabase)`: calls `supabase.auth.admin.createUser({ email: `e2e+${Date.now()}@test.local`, password: 'TestPassword1!', email_confirm: true })`; returns `{ userId, email, password }`
- `getSessionCookies(email, password)`: adapts `src/integration/helpers/auth.ts:getAuthCookieHeader()` — sign in via anon client + `createServerClient` SSR, capture cookie name/value pairs, return as `Array<{ name, value, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }>` for use with `context.addCookies()`
- `deleteTestUser(supabase, userId)`: calls `supabase.auth.admin.deleteUser(userId)` — cascades to listings rows

#### 5. .gitignore update

**File**: `.gitignore`

**Intent**: Exclude Playwright output directories from version control.

**Contract**: Append these lines:
```
/playwright-report/
/test-results/
/playwright/.auth/
```

### Success Criteria:

#### Automated Verification:

- `npx playwright install chromium --with-deps` exits 0
- `npm run test:e2e -- --list` exits 0 with empty test list (no specs yet)
- `npx tsc --noEmit` passes with new config and helper files

#### Manual Verification:

- With dev server already running, `npm run test:e2e` exits cleanly (no specs = immediate pass)
- `playwright.config.ts` lints without ESLint errors (`npm run lint`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Risk #1 — Listing Persistence Spec

### Overview

Prove that all five fields entered in the create form and the edit form are stored in the DB and rendered back correctly after a page reload.

### Changes Required:

#### 1. Listing persistence spec

**File**: `e2e/listing-persistence.spec.ts` (new)

**Intent**: Two tests — one creates a listing via the full UI form and asserts all five fields pre-fill on the edit page after redirect; the second edits all five fields via the form and asserts the updated values persist after another reload.

**Contract**:

`beforeAll`:
1. `supabase = createE2ESupabaseClient()`
2. `testUser = await createTestUser(supabase)`
3. `context = await browser.newContext()`
4. `await context.addCookies(await getSessionCookies(testUser.email, testUser.password))`
5. `page = await context.newPage()`
- Declare `let listingId: string` at file scope — populated in Test 1, consumed in Test 2

`afterAll`:
1. `await context.close()`
2. `await deleteTestUser(supabase, testUser.userId)` — cascades to listing rows

**Test 1 — create → reload → assert all 5 fields**:
1. `await page.goto('/dashboard/listings/new')`
2. Fill five fields using unique identifiable values (use `testUser.userId.slice(0,8)` prefix in the address so the listing is uniquely findable):
   - `page.getByLabel('Typ ogłoszenia').selectOption('occasional-rental')`
   - `page.getByLabel('Adres nieruchomości').fill(`ul. Persist ${testUser.userId.slice(0,8)}, Warszawa`)`
   - `page.getByLabel('Imię i nazwisko właściciela').fill('Anna Testowa')`
   - `page.getByLabel('Telefon właściciela').fill('+48 600 000 001')`
   - `page.getByLabel('E-mail właściciela').fill('anna@test.local')`
3. `await page.getByRole('button', { name: 'Dodaj ogłoszenie' }).click()`
4. `await page.waitForURL('/dashboard')`
5. Since this user has exactly one listing, locate its edit link: `const href = await page.getByRole('link', { name: 'Edytuj' }).first().getAttribute('href')` — extract `listingId` from `/dashboard/listings/{id}/edit` and store in file-scope variable
6. `await page.goto(href!)`
7. Assert each field:
   - `await expect(page.getByLabel('Typ ogłoszenia')).toHaveValue('occasional-rental')`
   - `await expect(page.getByLabel('Adres nieruchomości')).toHaveValue(...)` — the exact string from step 2
   - `await expect(page.getByLabel('Imię i nazwisko właściciela')).toHaveValue('Anna Testowa')`
   - `await expect(page.getByLabel('Telefon właściciela')).toHaveValue('+48 600 000 001')`
   - `await expect(page.getByLabel('E-mail właściciela')).toHaveValue('anna@test.local')`

**Test 2 — edit → reload → assert updated values**:
1. `await page.goto(`/dashboard/listings/${listingId}/edit`)`
2. Update all five fields to new values:
   - `page.getByLabel('Typ ogłoszenia').selectOption('sale')`
   - `page.getByLabel('Adres nieruchomości').clear()` then `.fill('ul. Zmieniona 99, Kraków')`
   - `page.getByLabel('Imię i nazwisko właściciela').clear()` then `.fill('Piotr Zmieniony')`
   - `page.getByLabel('Telefon właściciela').clear()` then `.fill('+48 700 000 002')`
   - `page.getByLabel('E-mail właściciela').clear()` then `.fill('piotr@test.local')`
3. `await page.getByRole('button', { name: 'Zapisz zmiany' }).click()`
4. `await page.waitForURL('/dashboard')`
5. `await page.goto(`/dashboard/listings/${listingId}/edit`)`
6. Assert all five updated values using `toHaveValue()` as in Test 1

### Success Criteria:

#### Automated Verification:

- `npm run test:e2e -- listing-persistence` passes (both tests green)
- `npx tsc --noEmit` passes

#### Manual Verification:

- `npm run test:e2e:headed -- listing-persistence` — observe form fill, redirect, edit page field assertion
- Deliberately break persistence: comment out one field write in `src/pages/api/listings/create.ts` — confirm the test fails on that field

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Risk #3 — Document Gate Spec

### Overview

Prove that the close flow is blocked in the UI when the checklist is incomplete (submit disabled), succeeds when all items are pre-checked, and succeeds when the inline override checkbox is used.

### Changes Required:

#### 1. Document gate spec

**File**: `e2e/document-gate.spec.ts` (new)

**Intent**: Three independent tests — each creates its own `sale` listing (auto-seeds 8 unchecked docs via DB trigger), navigates to the close page, and asserts the outcome for a specific scenario.

**Contract**:

`beforeAll`:
1. `supabase = createE2ESupabaseClient()`
2. `testUser = await createTestUser(supabase)`
3. `context = await browser.newContext()`
4. `await context.addCookies(await getSessionCookies(testUser.email, testUser.password))`
5. `page = await context.newPage()`

`afterAll`:
1. `await context.close()`
2. `await deleteTestUser(supabase, testUser.userId)` — cascades to all three listings and their documents

Helper (define at file scope): `createSaleListing(userId)` — service role INSERT into `listings` with `{ type: 'sale', address: 'ul. Gate Test, Warszawa', user_id: userId, status: 'active' }`; returns `listingId`. The `seed_listing_documents_on_insert` DB trigger fires and creates 8 unchecked rows.

**Test 1 — blocked path (incomplete checklist)**:
1. `const listingId = await createSaleListing(testUser.userId)`
2. `await page.goto(`/dashboard/listings/${listingId}/close`)`
3. `await expect(page.getByText(/Brakuje/)).toBeVisible()` — gate warning present
4. `await expect(page.getByRole('button', { name: 'Zamknij transakcję' })).toBeDisabled()` — submit cannot be clicked
5. `await expect(page.getByLabel('Pomiń weryfikację dokumentów')).toBeVisible()` — override checkbox offered

**Test 2 — happy path via all docs pre-checked**:
1. `const listingId = await createSaleListing(testUser.userId)`
2. `await checkAllListingDocs(listingId)` — service role UPDATE sets all 8 docs `is_checked = true`
3. `await page.goto(`/dashboard/listings/${listingId}/close`)`
4. `await expect(page.getByText('Dokumenty gotowe')).toBeVisible()` — gate passes
5. `await expect(page.getByRole('button', { name: 'Zamknij transakcję' })).not.toBeDisabled()`
6. `await page.getByLabel('Imię i nazwisko notariusza').fill('Jan Notariusz')` — fill at least one notary field
7. `await page.getByRole('button', { name: 'Zamknij transakcję' }).click()`
8. `await page.waitForURL(/close\?success=zamknieto/)` — full flow outcome: navigated to done state (not just button enabled)
9. `await expect(page.getByRole('heading', { name: 'Transakcja zamknięta' })).toBeVisible()`

**Test 3 — happy path via inline override**:
1. `const listingId = await createSaleListing(testUser.userId)`
2. `await page.goto(`/dashboard/listings/${listingId}/close`)`
3. Confirm gate is blocking (same checks as Test 1)
4. `await page.getByLabel('Pomiń weryfikację dokumentów').check()` — click override checkbox
5. `await expect(page.getByRole('button', { name: 'Zamknij transakcję' })).not.toBeDisabled()` — JS enables button (close.astro:362–368)
6. `await page.getByRole('button', { name: 'Zamknij transakcję' }).click()`
7. `await page.waitForURL(/close\?success=zamknieto/)`
8. `await expect(page.getByRole('heading', { name: 'Transakcja zamknięta' })).toBeVisible()`

### Success Criteria:

#### Automated Verification:

- `npm run test:e2e -- document-gate` passes (all 3 tests green)

#### Manual Verification:

- `npm run test:e2e:headed -- document-gate` — observe: Test 1 shows warning + disabled button; Test 2 pre-checks docs via API then close succeeds with redirect; Test 3 uses override checkbox then close succeeds

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Risk #4 — Done State Lifecycle Spec

### Overview

Prove that a completed listing appears in the dashboard done-state view with all field values intact, the close detail page renders notary and commission fields, and reopen returns the listing to active state with data unchanged. Tests run in serial dependency order.

### Changes Required:

#### 1. Done state lifecycle spec

**File**: `e2e/close-reopen-lifecycle.spec.ts` (new)

**Intent**: One listing is created and closed with notary details and commission data. Three serial tests assert: dashboard done-state card; close detail page content; and reopen to active state. Use `test.describe.configure({ mode: 'serial' })` at the file top — Test 1 closes the listing, Tests 2 and 3 depend on that state.

**Contract**:

`beforeAll`:
1. `supabase = createE2ESupabaseClient()`
2. `testUser = await createTestUser(supabase)`
3. `context = await browser.newContext()`
4. `await context.addCookies(await getSessionCookies(testUser.email, testUser.password))`
5. `page = await context.newPage()`
6. Create listing via service role INSERT into `listings`: `{ type: 'sale', address: 'ul. Lifecycle Test, Gdańsk', owner_name: 'Zofia Testowa', user_id: testUser.userId, status: 'active', asking_price: 500000, commission_percent: 2 }` — store returned `listingId`
7. Create commission settings via service role INSERT into `commission_settings`: `{ user_id: testUser.userId, tax_rate: 23, agency_percent: 50 }` — check migration for any required columns beyond these three
8. `await checkAllListingDocs(listingId)` — gate passes

`afterAll`:
1. `await context.close()`
2. `await deleteTestUser(supabase, testUser.userId)` — cascades to listing, documents, snapshot, commission_settings if FK constraint; otherwise delete commission_settings separately first

**Test 1 — close listing → assert dashboard done-state card**:
1. `await page.goto(`/dashboard/listings/${listingId}/close`)`
2. `await page.getByLabel('Imię i nazwisko notariusza').fill('Piotr Notariusz')`
3. `await page.getByLabel('Miasto kancelarii notarialnej').fill('Gdańsk')`
4. `await page.getByLabel('Data transakcji').fill('2026-06-02')`
5. `await page.getByRole('button', { name: 'Zamknij transakcję' }).click()`
6. `await page.waitForURL(/close\?success=zamknieto/)`
7. `await page.goto('/dashboard')`
8. Assert done-state card (this user has one listing so no card-scoping needed):
   - `await expect(page.getByText('Ukończone')).toBeVisible()` — status badge
   - `await expect(page.getByText('ul. Lifecycle Test, Gdańsk')).toBeVisible()` — address
   - `await expect(page.getByText('Zofia Testowa')).toBeVisible()` — owner_name persisted
   - `await expect(page.getByText(/Zysk agenta/)).toBeVisible()` — agent_net row present (not null)
   - `await expect(page.getByRole('button', { name: 'Wznów transakcję' })).toBeVisible()` — reopen control (done state)

**Test 2 — close detail page done-state**:
1. `await page.goto(`/dashboard/listings/${listingId}/close`)`
2. `await expect(page.getByRole('heading', { name: 'Transakcja zamknięta' })).toBeVisible()`
3. `await expect(page.getByText('Piotr Notariusz')).toBeVisible()` — notary_name rendered
4. `await expect(page.getByText('Gdańsk')).toBeVisible()` — notary_city rendered (note: "Gdańsk" also appears in the address; use `.nth(1)` if needed or scope to the card)
5. `await expect(page.getByText('Zysk agenta').last()).toBeVisible()` — commission table row present
6. `await expect(page.getByText('Brak danych prowizji')).not.toBeVisible()` — commission was computed (not null)

**Test 3 — reopen → active state with data intact**:
1. `await page.goto(`/dashboard/listings/${listingId}/close`)` — done state page
2. `await page.getByRole('button', { name: 'Wznów transakcję' }).click()`
3. `await page.waitForURL(/dashboard\?success=wznowiono/)`
4. `await page.goto('/dashboard')`
5. `await expect(page.getByText('Aktywne')).toBeVisible()` — status back to active
6. `await expect(page.getByText('ul. Lifecycle Test, Gdańsk')).toBeVisible()` — address still present
7. `await expect(page.getByText('Zofia Testowa')).toBeVisible()` — owner_name survived reopen
8. `await expect(page.getByRole('link', { name: 'Zamknij transakcję' })).toBeVisible()` — close link restored (not reopen button)
9. `await expect(page.getByText(/Zysk agenta/)).not.toBeVisible()` — active listing doesn't show commission

### Success Criteria:

#### Automated Verification:

- `npm run test:e2e -- close-reopen-lifecycle` passes (all 3 tests green)

#### Manual Verification:

- `npm run test:e2e:headed -- close-reopen-lifecycle` — observe: Test 1 closes the listing and asserts the dashboard card; Test 2 navigates to the close detail page; Test 3 reopens and verifies active state

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: CI Gate

### Overview

Wire all test layers into `ci.yml` as required steps on every PR push.

### Changes Required:

#### 1. CI workflow update

**File**: `.github/workflows/ci.yml`

**Intent**: Add `test:integration`, `test:integration:api`, Playwright browser install, and `test:e2e` steps after the existing unit test step. Integration and E2E tests use test Supabase credentials from new secrets.

**Contract**: Insert the following steps in the `ci` job after the existing `- run: npm run test` step and before `- run: npm run build`:

```yaml
- run: npm run test:integration
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL_TEST }}
    SUPABASE_KEY: ${{ secrets.SUPABASE_ANON_KEY_TEST }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_TEST }}
- run: npm run test:integration:api
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL_TEST }}
    SUPABASE_KEY: ${{ secrets.SUPABASE_ANON_KEY_TEST }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_TEST }}
- run: npx playwright install --with-deps chromium
- run: npm run test:e2e
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL_TEST }}
    SUPABASE_KEY: ${{ secrets.SUPABASE_ANON_KEY_TEST }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY_TEST }}
    CI: "true"
```

The existing `build` step (which uses production `SUPABASE_URL` + `SUPABASE_KEY` secrets) is unchanged.

**Prerequisites for Phase 5 to pass**: Three secrets must be set in GitHub repository settings → Secrets and variables → Actions: `SUPABASE_URL_TEST`, `SUPABASE_ANON_KEY_TEST`, `SUPABASE_SERVICE_ROLE_KEY_TEST`. These point to the same Supabase project as `.env.test` locally.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes on the updated `ci.yml` (YAML lint — confirm ESLint config ignores or passes YAML)
- Step ordering in `ci.yml` is correct: unit tests → integration DB → integration API → playwright install → e2e → build

#### Manual Verification:

- Push to a feature branch and open a PR — CI run completes with all five test steps green (requires the 3 secrets to be set)
- Introduce a deliberate regression in a test PR (e.g., remove a field from `api/listings/create.ts`) and confirm the persistence E2E test fails in CI

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### E2E Isolation:

Each spec file: one fresh user in `beforeAll`, deleted in `afterAll`. Tests within a file share one authenticated `BrowserContext` and `Page`. Phase 4 file uses `test.describe.configure({ mode: 'serial' })` to enforce test ordering.

### Manual Testing Steps:

1. After Phase 1: `npm run test:e2e -- --list` exits clean
2. After Phase 2: `npm run test:e2e:headed -- listing-persistence` — watch field fill and assertion
3. After Phase 3: `npm run test:e2e:headed -- document-gate` — watch 3 gate scenarios
4. After Phase 4: `npm run test:e2e:headed -- close-reopen` — watch close/reopen lifecycle
5. After Phase 5: Push PR → CI passes with all test steps

## References

- Test plan: `context/foundation/test-plan.md` §6.3 (E2E cookbook pattern — fill in when this phase ships)
- Prior integration changes: `context/changes/testing-gate-logic-auth-idor/`, `testing-persistence-data-lifecycle/`
- close.astro gate logic: `src/pages/dashboard/listings/[id]/close.astro:45–78`
- ListingCard done-state display: `src/components/listings/ListingCard.astro:36–45`
- Auth helper to adapt: `src/integration/helpers/auth.ts`
- DB helper to reuse: `src/integration/helpers/supabase.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Playwright Foundation

#### Automated

- [x] 1.1 `npx playwright install chromium --with-deps` exits 0 — d1b00ae
- [x] 1.2 `npm run test:e2e -- --list` exits 0 with empty test list — d1b00ae
- [x] 1.3 `npx tsc --noEmit` passes with new config and helpers — d1b00ae

#### Manual

- [ ] 1.4 `npm run test:e2e` (no specs) exits cleanly with dev server started
- [ ] 1.5 `playwright.config.ts` lints without ESLint errors

### Phase 2: Risk #1 — Listing Persistence Spec

#### Automated

- [x] 2.1 `npm run test:e2e -- listing-persistence` passes (both tests green) — f6d10ba
- [x] 2.2 `npx tsc --noEmit` passes — f6d10ba

#### Manual

- [ ] 2.3 `--headed` run shows create form fill → dashboard redirect → edit page field assertions
- [ ] 2.4 Deliberate regression (remove a field from create API) causes test failure

### Phase 3: Risk #3 — Document Gate Spec

#### Automated

- [x] 3.1 `npm run test:e2e -- document-gate` passes (all 3 tests green) — 392d69a

#### Manual

- [x] 3.2 `--headed` shows blocked state, all-checked path succeeds, override path succeeds — 392d69a

### Phase 4: Risk #4 — Done State Lifecycle Spec

#### Automated

- [x] 4.1 `npm run test:e2e -- close-reopen-lifecycle` passes (all 3 tests green)

#### Manual

- [x] 4.2 `--headed` shows dashboard done-card assertions, close detail page, reopen to active state

### Phase 5: CI Gate

#### Automated

- [ ] 5.1 Updated `ci.yml` step order is correct (unit → integration → integration:api → playwright install → e2e → build)

#### Manual

- [ ] 5.2 CI passes on a PR push with all 3 test Supabase secrets set
- [ ] 5.3 Deliberate regression in a test PR causes E2E test failure in CI
