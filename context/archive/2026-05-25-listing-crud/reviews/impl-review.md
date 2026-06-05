<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Listing Dashboard CRUD

- **Plan**: `context/changes/listing-crud/plan.md`
- **Scope**: All 3 phases
- **Date**: 2026-05-27
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  5 warnings  3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Build & Lint

- `npm run build` — succeeded (pre-existing unrelated CSS minify warning)
- `npm run lint` — succeeded (`projectService` parser warnings are pre-existing, not from this slice)

## Findings

### F1 — handle_updated_at() missing SET search_path [FIXED + ACCEPTED-AS-RULE: Postgres functions must pin search_path]

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — function is reused on later-slice tables; fixing later means a follow-up migration per table
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260525152607_create_listings.sql:26-34
- **Detail**: Function declared `language plpgsql` with no fixed search_path. Supabase's DB linter flags this as `function_search_path_mutable` — a malicious schema earlier in resolution order could shadow built-ins like `now()`. Plan migration-notes commit this function to be reused verbatim in S-03+, so the warning will compound.
- **Fix**: Add `set search_path = ''` after `language plpgsql` and qualify `now()` as `pg_catalog.now()`.
  - Strength: Removes Supabase linter warning before downstream slices propagate the trigger to new tables.
  - Tradeoff: Two-line edit, trivial.
  - Confidence: HIGH — standard Supabase guidance.
  - Blind spot: None significant.
- **Decision**: FIXED + ACCEPTED-AS-RULE (lesson: "Postgres functions must pin search_path")

### F2 — gen_random_uuid() used without declaring pgcrypto [FIXED + ACCEPTED-AS-RULE: Migrations must declare extensions they depend on]

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — one-line addition at top of migration
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260525152607_create_listings.sql:4
- **Detail**: Migration calls `gen_random_uuid()` without `create extension if not exists pgcrypto`. Hosted Supabase ships pgcrypto pre-enabled, but fresh local stacks or projects where the extension is disabled will fail to apply this migration. Making the dependency explicit documents intent before downstream slices add FKs.
- **Fix**: Prepend `create extension if not exists "pgcrypto" with schema extensions;`.
- **Decision**: FIXED + ACCEPTED-AS-RULE (lesson: "Migrations must declare extensions they depend on")

### F3 — edit.astro casts .single() result and swallows DB errors [FIXED + ACCEPTED-AS-RULE: Never cast away the `error` field of a supabase-js response]

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — narrow edit, one file
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/pages/dashboard/listings/[id]/edit.astro:18-26
- **Detail**: The fetch uses `as { data: Listing | null }` which discards the `error` field. Any real failure (network, RLS misconfig, malformed UUID id) produces `data === null` and the page silently redirects to `/dashboard` indistinguishably from a legitimate "not found". Sibling routes (update.ts, delete.ts) handle `error` and `data` separately.
- **Fix**: Drop the cast, destructure `{ data, error }`, redirect with `?error=` on real error, redirect to /dashboard only on the PGRST116 ("no rows from .single()") case.
  - Strength: Matches error-handling pattern of sibling routes; surfaces real failures.
  - Tradeoff: Need to special-case PGRST116; few extra lines.
  - Confidence: HIGH — pattern used in same module.
  - Blind spot: None significant.
- **Decision**: FIXED + ACCEPTED-AS-RULE (lesson: "Never cast away the `error` field of a supabase-js response")

### F4 — ESLint rule disabled for ALL .astro files (unplanned + overly broad) [FIXED via Fix A + ACCEPTED-AS-RULE: Scope ESLint rule disables to the smallest possible surface]

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — silences a load-bearing rule across the entire Astro surface
- **Dimension**: Safety & Quality + Scope Discipline
- **Location**: eslint.config.js:68-69
- **Detail**: A two-line `astroConfig.rules` change disables `@typescript-eslint/no-misused-promises` for every `.astro` file with a comment about a parser crash. The only file that actually triggers the crash is `edit.astro:26`. The disable is unplanned AND its scope is the entire UI surface — every future `.astro` page silently loses a misused-promise safety net.
- **Fix A ⭐ Recommended**: Narrow the disable to a per-file `files: [...]` override pinned to the offending pattern.
  - Strength: Restores the rule for the rest of the Astro codebase; documents the parser bug at the trigger site.
  - Tradeoff: Slightly more eslint config noise.
  - Confidence: HIGH — the parser bug is reproducible only with early-return Astro.redirect, used only by edit.astro.
  - Blind spot: Haven't verified other promise-returning frontmatter patterns won't crash the parser.
- **Fix B**: Document on the plan as an addendum and leave the broad disable in place.
  - Strength: Zero code change; preserves discovered workaround for future Astro files.
  - Tradeoff: Keeps the safety rule disabled across all .astro files indefinitely.
  - Confidence: MED — accepting a broad disable is a real tradeoff.
  - Blind spot: We haven't quantified how often misused-promises bugs appear in Astro frontmatter here.
- **Decision**: FIXED via Fix A + ACCEPTED-AS-RULE (lesson: "Scope ESLint rule disables to the smallest possible surface"). Implementation note: minimatch treats `[id]` as a character class — escaped as `[[]id[]]`.

### F5 — UPDATE vs DELETE disagree on "not found" handling [FIXED via Fix A + ACCEPTED-AS-RULE: Document intentional asymmetry between sibling routes/handlers]

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — idempotent UX vs sibling-route consistency
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/listings/[id]/delete.ts:22, src/pages/api/listings/[id]/update.ts:38-51
- **Detail**: update.ts uses `.select()` and reports "Ogłoszenie nie zostało znalezione" on 0 rows. delete.ts has no `.select()` and treats 0-row deletes as success — explicitly per plan ("idempotent — double-delete is not an error"). Both behaviors are defensible; the issue is they're inconsistent without a comment to signal intent, inviting a future "cleanup" PR to align them in the wrong direction.
- **Fix A ⭐ Recommended**: Keep both behaviors; add an inline comment to delete.ts explaining the asymmetry.
  - Strength: Honors plan's explicit "idempotent delete" decision; guards against future regression.
  - Tradeoff: Asymmetry remains — documentation-only.
  - Confidence: HIGH — plan explicitly endorses idempotent delete.
  - Blind spot: None significant.
- **Fix B**: Add `.select()` to delete.ts and surface "not found" on 0 rows.
  - Strength: Sibling routes behave identically.
  - Tradeoff: Contradicts plan's explicit "idempotent" decision; changes user-observable behavior.
  - Confidence: MED — depends whether stale double-delete is a real UX path.
  - Blind spot: Haven't traced whether the UI ever POSTs delete twice.
- **Decision**: FIXED via Fix A + ACCEPTED-AS-RULE (lesson: "Document intentional asymmetry between sibling routes/handlers")

### F6 — Empty-state copy split across two elements [FIXED + ACCEPTED-AS-RULE: UX-positive deviations from a verbatim plan string are OK — but record them]

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: src/pages/dashboard.astro:50-56
- **Detail**: Plan specified one string: `"Brak ogłoszeń. Dodaj pierwsze ogłoszenie."` Code splits it: `<p>Brak ogłoszeń.</p>` + a CTA `<a>` labeled "Dodaj pierwsze ogłoszenie". Same content; arguably better UX (second half becomes actionable). Worth noting only as a low-stakes deviation from a verbatim contract.
- **Fix**: None required — accept as a UX-positive deviation.
- **Decision**: FIXED + ACCEPTED-AS-RULE (lesson: "UX-positive deviations from a verbatim plan string are OK — but record them"). User opted to revert to verbatim copy; whole card wraps a single link to `/dashboard/listings/new` carrying the plan's exact string.

### F7 — Dashboard fetch unbounded + redundant in-memory sort [FIXED + ACCEPTED-AS-RULE: Push ordering and bounds to the database, not the application]

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Performance
- **Location**: src/pages/dashboard.astro:16,21-25
- **Detail**: `select("*").order("created_at", ...)` has no `.limit()` — fine at MVP scale, will need pagination eventually. The JS `.sort()` re-sorts active-first; folding that into the SQL order would be clearer and removes a stability dependency.
- **Fix**: Add `.order("status", { ascending: true })` then `.order("created_at", { ascending: false })`, drop the JS sort, and add `.limit(100)` as a guardrail.
- **Decision**: FIXED + ACCEPTED-AS-RULE (lesson: "Push ordering and bounds to the database, not the application"). Used `.overrideTypes<Listing[], { merge: false }>()` rather than the deprecated `.returns()`.

### F8 — Auth check happens after field validation (inverts plan order) [FIXED + ACCEPTED-AS-RULE: Authenticate first, then validate — short-circuit unauthenticated requests at the door]

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: src/pages/api/listings/create.ts:12-29, src/pages/api/listings/[id]/update.ts (same pattern)
- **Detail**: Plan contract orders steps as: getUser → validate. Implementation does validate → getUser, so an unauthenticated POST with bad input is redirected to the protected form page rather than directly to /auth/signin (middleware then re-redirects). No real security or UX harm, but it leaks "what fields the route validates" to unauthenticated callers.
- **Fix**: Move `createClient` + `getUser` above the field-validation block.
- **Decision**: FIXED + ACCEPTED-AS-RULE (lesson: "Authenticate first, then validate — short-circuit unauthenticated requests at the door"). Applied to both create.ts and update.ts.
