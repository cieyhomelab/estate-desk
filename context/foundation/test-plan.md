# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-02 (Phase 2 complete)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "<the
   team is worried about X, and the failure would surface somewhere in
   <area>>" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/` (30 commits/30d; excludes node_modules, dist, build output).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                    | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------- | ------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Listing data not persisted after create/edit — fields missing or lost on reload                            | High   | High       | PRD guardrail "no data loss — a listing saved must be retrievable on the next login" + interview Q1 + hot-spot dir `src/pages/api` (35 changes/30d)  |
| 2   | Commission split arithmetic wrong or rounding difference silent rather than a validation error             | High   | Medium     | PRD guardrail "no silent rounding errors; split must sum to the entered total" + PRD §Business Logic + hot-spot dir `src/pages/api` (35 changes/30d) |
| 3   | Document gate allows transaction close with unchecked items and no override active                         | High   | Medium     | PRD §Business Logic ("blocked until all items checked or override active") + US-01 AC + roadmap S-06 risk note                                       |
| 4   | Completed listing disappears from dashboard or loses data through the close/reopen cycle                   | High   | Low        | PRD NFR "completed listings remain visible and readable indefinitely" + US-01 AC "reopen returns all data intact"                                    |
| 5   | Price history incomplete or entries out of chronological order                                             | Medium | Medium     | PRD FR-010 + hot-spot dir `src/pages/dashboard` (25 changes/30d; includes pricing view)                                                              |
| 6   | Personal data (owner, buyer/tenant contacts) accessible without a valid session                            | High   | Low        | PRD guardrail "personal data not accessible to any unauthenticated request" + PRD §Access Control + AGENTS.md: SUPABASE_KEY is server-side only      |
| 7   | Listing/contact API endpoints lack ownership checks — authenticated user B can access user A's data (IDOR) | High   | Low        | Abuse lens (IDOR/ownership check) + FR-001 allows multiple registrations + hot-spot dir `src/pages/api` (35 changes/30d)                             |

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                         | Must challenge                                                                                            | Context `/10x-research` must ground                                                                                                            | Likely cheapest layer                                                                         | Anti-pattern to avoid                                                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| #1   | After create/edit + reload, all entered fields are retrieved from DB and rendered correctly                                                         | "UI shows data" ≠ "data was written to DB"; 200 response ≠ persisted                                      | Which API endpoints handle create/update; whether UI re-reads from DB on load or relies on response state                                      | Integration: API write → DB read-back verifies all fields                                     | Implementation mirror: asserting 200 without verifying DB state                           |
| #2   | Given configured rates + total commission, split sums exactly to total; a rounding gap returns a 4xx validation error, not a silent adjustment      | Expected values must come from the PRD spec (independent oracle), not from reading the formula under test | Commission formula order (gross → tax provision → agency → agent net); rounding rule; validation error path in the API                         | Unit test on the formula function with PRD-specified inputs/expected values                   | Oracle problem: expected values copied from the implementation                            |
| #3   | POST close with incomplete checklist + no override → API error; POST close with all items checked OR override active → success and status persisted | "Close button is disabled" ≠ "API actually blocks" — UI gating is bypassable via direct API call          | Which endpoint handles close; gate validation logic; override flag semantics; required items list by listing type (sale vs. najem okazjonalny) | Integration: POST close incomplete no override → 4xx; POST close with override → 2xx          | Happy-path-only: testing only the success path, never the blocked path                    |
| #4   | Listing marked done: visible in dashboard done view with all field values intact; after reopen, returns to active with same data                    | "Shows in done view" ≠ "all fields persisted through the close transition"                                | What fields are locked at close; whether reopen fully restores status; how the dashboard queries for done listings                             | Integration: close listing → verify all fields in DB; reopen → verify status and field parity | Brittle: testing only the status field, missing commission lock or document state         |
| #5   | After N price updates, history contains exactly N entries in ascending chronological order with correct values                                      | "History shows entries" ≠ entries are ordered and nothing was dropped                                     | How price history is stored; whether ordering is explicit in the query or assumed                                                              | Integration: set price N times → read history → assert count, order, values                   | Snapshot-without-meaning: asserting the array without verifying the ordering invariant    |
| #6   | Unauthenticated GET to listing/contact detail API returns 401 or redirect; authenticated request returns data                                       | "Middleware exists" ≠ "every API route is covered by it"                                                  | Which routes are protected by middleware; whether API endpoints independently validate session                                                 | Integration: unauthenticated request to each data endpoint → expect 401/redirect              | Happy-path: testing only that logged-in user sees data, never that logged-out user cannot |
| #7   | Request to listing/contact API with valid session but mismatched owner returns 403 or 404, not the resource                                         | "You are logged in" ≠ "this resource belongs to you" — ownership check is separate from auth check        | Whether listing/contact API endpoints filter by user ownership in DB queries                                                                   | Integration: create listing as user A, request as user B → expect 403/404                     | Authorization conflation: asserting only authentication, not resource ownership           |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                          | Goal                                                                                                                                     | Risks covered | Test types                      | Status      | Change folder                                       |
| --- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------- | ----------- | --------------------------------------------------- |
| 1   | Bootstrap + commission arithmetic   | Install Vitest; unit-test commission formula — first signal at the cheapest layer                                                        | #2            | unit                            | complete    | context/changes/testing-bootstrap-commission/       |
| 2   | Persistence + data lifecycle        | Integration tests: listing save/reload (R1), price history ordering (R5), completed listing close/reopen cycle (R4)                      | #1, #4, #5    | integration (real DB)           | complete    | context/changes/testing-persistence-data-lifecycle/ |
| 3   | Gate logic + auth boundary + IDOR   | API integration: document gate blocks/passes correctly (R3), unauthenticated access returns 401 (R6), cross-account ownership check (R7) | #3, #6, #7    | integration (real DB + session) | not started | —                                                   |
| 4   | E2E full transaction flow + CI gate | End-to-end: auth → create listing → documents → close → dashboard done state; wire all tests into CI on push                             | #1, #3, #4    | e2e (Playwright), CI            | not started | —                                                   |

## 4. Stack

The classic test base for this project. AI-native tools carry a `checked:` date so future readers can see which lines need re-verification.

| Layer                 | Tool                                 | Version           | Notes                                                                                                               |
| --------------------- | ------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| unit + integration    | Vitest                               | not yet installed | None yet — see §3 Phase 1. AGENTS.md: "Add Vitest before writing unit tests."                                       |
| API / request mocking | none yet                             | —                 | To be determined in §3 Phase 2; likely MSW or native fetch interception for the Cloudflare Workers environment      |
| e2e                   | Playwright                           | not yet installed | None yet — see §3 Phase 4. Playwright MCP available in current session.                                             |
| CI gate               | GitHub Actions                       | existing          | Currently: `npm ci → astro sync → lint → build`. Vitest + Playwright to be added in §3 Phase 4.                     |
| (optional) AI-native  | Playwright MCP — checked: 2026-06-01 | n/a               | Use only when the risk requires visual verification the DOM cannot express; do not substitute for integration tests |

**Stack grounding tools (current session):**

- Docs: none — no Context7 or framework docs MCP available in this session; checked: 2026-06-01
- Search: Exa.ai available — not used during this plan write; available for stack lookups during Phase 1 planning; checked: 2026-06-01
- Runtime/browser: Playwright MCP available — planned for §3 Phase 4 E2E layer; checked: 2026-06-01
- Provider/platform: Supabase MCP available — potential DB state verification support in integration phases; checked: 2026-06-01

## 5. Quality Gates

| Gate                  | Where      | Required?                 | Catches                                                 |
| --------------------- | ---------- | ------------------------- | ------------------------------------------------------- |
| lint + typecheck      | local + CI | required (existing)       | syntactic / type drift                                  |
| unit + integration    | local + CI | required after §3 Phase 1 | logic regressions and data lifecycle failures           |
| e2e on critical flows | CI on PR   | required after §3 Phase 4 | cross-boundary regressions in the full transaction path |
| pre-prod smoke        | manual     | optional                  | environment-specific failures on Cloudflare Workers     |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section fills in once the relevant rollout phase ships.

### 6.1 Adding a unit test

TBD — see §3 Phase 1. Target pattern: isolated function test with PRD-spec oracle values; no DB, no network.

### 6.2 Adding an integration test

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

### 6.3 Adding an e2e test

TBD — see §3 Phase 4. Target pattern: `getByRole`-based locators, isolated test state, no shared sessions between tests.

### 6.4 Adding a test for a new API endpoint

TBD — see §3 Phase 3. Target pattern: session-parameterized integration test asserting authenticated, unauthenticated, and cross-account cases.

### 6.5 Per-rollout-phase notes

(Filled in as each phase ships.)

## 7. What We Deliberately Don't Test

- **Marketing page UI snapshots** — snapshot tests on marketing/static pages break on minor layout changes and catch nothing meaningful. Re-evaluate if the marketing surface gains dynamic data. (Source: interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-01
- Stack versions last verified: 2026-06-01
- AI-native tool references last verified: 2026-06-01

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
