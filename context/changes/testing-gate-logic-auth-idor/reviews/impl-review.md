<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Gate Logic + Auth Boundary + IDOR

- **Plan**: context/changes/testing-gate-logic-auth-idor/plan.md
- **Scope**: All 4 Phases
- **Date**: 2026-06-02
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  4 warnings  3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — shell: true makes SIGTERM unreliable for teardown

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/integration/helpers/server.ts:14
- **Detail**: spawn() is called with shell: true. teardown() sends SIGTERM to the shell wrapper PID, not to the npm/astro grandchild. On macOS/zsh this works in practice (/bin/sh propagates SIGTERM), but is not guaranteed on all platforms — grandchild can be left as an orphan holding port 4322, breaking the next test run silently. The plan's contract specified shell: true explicitly, so the implementation is correct per plan, but the plan's design choice creates reliability risk.
- **Fix A ⭐ Recommended**: Remove `shell: true` — use `spawn("npm", [...])` directly (PATH resolution works without shell on Node 18+)
  - Strength: SIGTERM goes directly to npm, which propagates to astro dev. Removes shell indirection entirely.
  - Tradeoff: May need `shell: process.platform === "win32"` if Windows support is ever needed.
  - Confidence: HIGH — Node 18+ resolves PATH entries directly on macOS/Linux.
  - Blind spot: Not tested on Windows (not a current target).
- **Fix B**: Keep shell: true, use process-group kill in teardown
  - Strength: Preserves shell: true portability intent while ensuring full process subtree is killed.
  - Tradeoff: serverProcess.pid can be undefined; needs a guard.
  - Confidence: MEDIUM — process group kill is well-understood but slightly more complex.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — removed `shell: true` from spawn() options

### F2 — Startup timeout leaves orphaned dev server on failure

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/integration/helpers/server.ts:26–29
- **Detail**: When the 60 s deadline is exceeded, setup() throws but serverProcess is already spawned and still running. vitest globalSetup does not call teardown() on setup() failure. The orphaned process holds port 4322 and the next invocation of `npm run test:integration:api` hangs for 60 s before also failing.
- **Fix**: Wrap the polling loop in try/finally — kill serverProcess before re-throwing: `try { /* polling loop */ } catch (e) { serverProcess?.kill("SIGTERM"); serverProcess = undefined; throw e; }`
- **Decision**: FIXED — kill serverProcess before rethrowing on timeout

### F3 — Vacuous pass risk in all-checked gate test

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/integration/api/gate-logic.test.ts:86–93
- **Detail**: The "all-checked" scenario relies on the seed_listing_documents_on_insert DB trigger having fired and populated rows before the .update(is_checked=true) call. If the trigger is absent (fresh local Supabase stack, partial migration), the update matches zero rows (no error), allCheckedListingId has zero docs, and the gate still passes — but vacuously. The test reports green in a broken environment with no signal that the trigger is missing.
- **Fix A ⭐ Recommended**: Assert at least one doc was seeded — add after the update: `const { count } = await supabase.from("listing_documents").select("id", { count: "exact", head: true }).eq("listing_id", allCheckedListingId); if (!count || count === 0) throw new Error("Trigger did not seed docs for allCheckedListingId — check migrations");`
  - Strength: Makes the test self-diagnosing when run against a mis-migrated environment.
  - Tradeoff: Adds a DB round-trip in beforeAll.
  - Confidence: HIGH — the pattern is used in other beforeAll setups in this project.
  - Blind spot: Does not protect against the trigger seeding docs with is_checked=true.
- **Fix B**: Replace trigger-reliance with explicit inserts + update
  - Strength: No dependency on trigger behavior; tests are hermetic.
  - Tradeoff: More setup code; duplicates trigger behavior which drifts if trigger changes.
  - Confidence: MEDIUM.
  - Blind spot: Would require knowing current trigger-seeded labels.
- **Decision**: FIXED via Fix A — added count assertion after the update in beforeAll

### F4 — auth.ts uses non-null assertion instead of explicit env guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/integration/helpers/auth.ts:9
- **Detail**: `process.env.SUPABASE_URL!` and `process.env.SUPABASE_KEY!` use non-null assertions. The sibling helper supabase.ts guards both vars explicitly and throws a descriptive error. Missing env vars surface as opaque Supabase SDK errors rather than an actionable message.
- **Fix**: Mirror supabase.ts's guard pattern: `const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_KEY; if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_KEY must be set");`
- **Decision**: FIXED — replaced non-null assertions with explicit guard matching supabase.ts pattern

### F5 — Stacked docs on blocked/override listings obscure setup intent

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/integration/api/gate-logic.test.ts:71–84
- **Detail**: blockedListingId and overrideListingId get 2 manually inserted docs at position 0/1. The trigger also seeded ~8 docs (type: "sale"). Each listing ends up with ~10 unchecked items, not 2 as a reader might assume. Functionally correct (count>0 blocks), but setup is misleading.
- **Fix**: Add a comment: `// 2 explicit + ~8 trigger-seeded unchecked docs; only count>0 matters`
- **Decision**: FIXED — added clarifying comments above both explicit doc inserts

### F6 — Sequential deleteUser in afterAll; first failure leaves orphan

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/integration/api/idor.test.ts:64–67
- **Detail**: afterAll deletes userAId then userBId sequentially. A transient error on the first delete skips the second, leaving userBId as an orphan. Same pattern in gate-logic.test.ts:96.
- **Fix**: Use `Promise.allSettled` for independent cleanup: `await Promise.allSettled([supabase.auth.admin.deleteUser(userAId), supabase.auth.admin.deleteUser(userBId)]);`
- **Decision**: FIXED — switched idor.test.ts afterAll to Promise.allSettled

### F7 — idor.test.ts second test has implicit dependency on beforeAll success

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/integration/api/idor.test.ts:110
- **Detail**: If beforeAll partially fails (user A created but listing insert fails), userAListingId is undefined. The second test hits /api/listings/undefined/contacts/create and may produce a misleading result.
- **Fix**: Add `expect(userAListingId).toBeDefined()` at the start of the it() block.
- **Decision**: FIXED — added expect(userAListingId).toBeDefined() at start of second it() block
