<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Listing Dashboard CRUD

- **Plan**: `context/changes/listing-crud/plan.md`
- **Scope**: All 3 phases
- **Date**: 2026-05-27
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  4 warnings  3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Build & Lint

- `npm run build` — succeeded (Cloudflare adapter; pre-existing unrelated CSS minify warning)
- `npm run lint` — succeeded (parser warnings about `projectService` are pre-existing, not from this slice)

## Findings

### F1 — handle_updated_at() missing SET search_path

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — function is intentionally reused by later slices; fixing it later means a follow-up migration on every table that already has the trigger
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260525152607_create_listings.sql:26-34
- **Detail**: The function is declared `language plpgsql` with no fixed search_path. Supabase's DB linter raises a "Function Search Path Mutable" warning for every such function — a malicious schema earlier in resolution order could shadow built-ins (e.g., `now()`). Plan migration-notes explicitly say later slices will reuse this function as-is, so the warning will compound across S-03+ tables.
- **Fix**: Add `set search_path = ''` and fully-qualify `now()`:
  ```sql
  create or replace function handle_updated_at()
  returns trigger
  language plpgsql
  set search_path = ''
  as $$
  begin
    new.updated_at = pg_catalog.now();
    return new;
  end;
  $$;
  ```
  - Strength: Removes the linter warning now, before S-03 reuses the function on a new table.
  - Tradeoff: Requires `pg_catalog.now()` qualification — trivial.
  - Confidence: HIGH — standard Supabase guidance.
  - Blind spot: None significant.
- **Decision**: PENDING

### F2 — gen_random_uuid() used without explicit pgcrypto extension

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — one-line addition at the top of the migration
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260525152607_create_listings.sql:4
- **Detail**: Migration relies on `gen_random_uuid()` but never declares the pgcrypto dependency. Supabase's default project has pgcrypto pre-enabled, so this works today — but a fresh local Supabase project, a stripped Postgres, or a future project where the extension is disabled will fail to apply this migration. The next four slices add FKs into this table; making the dependency explicit documents intent.
- **Fix**: Add `create extension if not exists "pgcrypto" with schema extensions;` at the top of the migration.
- **Decision**: PENDING

### F3 — edit.astro silently redirects on DB error (data/error not distinguished)

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — narrow edit, one file
- **Dimension**: Safety & Quality (Reliability)
- **Location**: src/pages/dashboard/listings/[id]/edit.astro:18-26
- **Detail**: The fetch uses an `as { data: Listing | null }` cast that discards the `error` field of the supabase-js response. If `.single()` errors (network, RLS misconfig, malformed UUID), `result.data` is null and the page silently redirects to `/dashboard` with no error message — masking infrastructure problems. Sister mutation routes (update.ts) handle `error` and `data` separately; this page should too.
- **Fix**: Drop the cast; destructure `{ data, error }`; redirect to `/dashboard?error=...` on real error; redirect to `/dashboard` only on "not found":
  ```ts
  const { data, error } = await supabase
    .from("listings").select("*")
    .eq("id", id).eq("user_id", user.id).single();
  if (error && error.code !== "PGRST116") {
    return Astro.redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }
  listing = data;
  ```
  - Strength: Matches the error-handling pattern of update.ts / delete.ts; surfaces real failures.
  - Tradeoff: A few extra lines; need to know PGRST116 is the "no rows" code for `.single()`.
  - Confidence: HIGH — pattern used in sibling routes.
  - Blind spot: None significant.
- **Decision**: PENDING

### F4 — DELETE and UPDATE disagree on "not found" handling

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff (idempotent UX vs. consistency between sibling routes)
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/listings/[id]/delete.ts:22, src/pages/api/listings/[id]/update.ts:38-51
- **Detail**: update.ts chains `.select()` and reports "Ogłoszenie nie zostało znalezione" when 0 rows match (lines 49-51). delete.ts has no `.select()` and treats 0-row deletes as success (line 22-28) — explicitly per plan ("idempotent — double-delete is not an error"). Both behaviors are defensible; the issue is they're inconsistent without a comment to signal intent, inviting a future "cleanup" PR to align them in the wrong direction.
- **Fix A ⭐ Recommended**: Keep both behaviors; add an inline comment to delete.ts explaining the asymmetry
  - Strength: Honors plan's "idempotent delete is intentional" decision while guarding against future regression. Trivial edit.
  - Tradeoff: Asymmetry remains — purely a documentation fix.
  - Confidence: HIGH — plan explicitly endorses idempotent delete.
  - Blind spot: None significant.
- **Fix B**: Add `.select()` to delete.ts and surface "Ogłoszenie nie zostało znalezione" on 0 rows
  - Strength: Sibling routes behave identically; less cognitive load when reading the API.
  - Tradeoff: Changes user-observable behavior (re-deleting a stale tab now shows an error); contradicts the plan's explicit decision.
  - Confidence: MEDIUM — depends whether stale double-delete is a real UX path worth surfacing.
  - Blind spot: Haven't traced UI flows that might POST delete twice from a slow network.
- **Decision**: PENDING

### F5 — Unplanned eslint.config.js change (rule disable for *.astro)

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — already shipped; question is whether to document on the plan
- **Dimension**: Scope Discipline
- **Location**: eslint.config.js:68-69 (commit 6a5dea5)
- **Detail**: Two lines added to `astroConfig.rules`:
  ```js
  // astro-eslint-parser crashes on return Astro.redirect() in frontmatter
  "@typescript-eslint/no-misused-promises": "off",
  ```
  Narrowly scoped to Astro files (preserves the rule for TS/TSX), comment documents the rationale, justified by the lint gate in Phase 2 success criteria. Not in any phase's "Changes Required" — appears to have been a discovery while implementing Phase 3 (`return Astro.redirect()` in edit.astro frontmatter).
- **Fix**: Document on the plan as an addendum under Phase 3's "Changes Required" so it stops being a silent surprise on the next plan↔diff comparison.
- **Decision**: PENDING

### F6 — Dashboard empty-state copy split across two elements

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Adherence
- **Location**: src/pages/dashboard.astro:50-56
- **Detail**: Plan specified one string: `"Brak ogłoszeń. Dodaj pierwsze ogłoszenie."` Code splits it into a `<p>Brak ogłoszeń.</p>` followed by a CTA `<a>Dodaj pierwsze ogłoszenie</a>`. Same text content; arguably better UX (the second half becomes a button instead of body copy). Worth noting only because it is a low-stakes deviation from a verbatim contract.
- **Fix**: None required — accept as a UX-positive deviation.
- **Decision**: PENDING

### F7 — In-memory active-first sort is redundant with DB ordering

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Performance
- **Location**: src/pages/dashboard.astro:16, 21-25
- **Detail**: Query orders by `created_at desc`, then JS re-sorts active-first. `Array.prototype.sort` is stable in modern engines, so the combined ordering is correct. A single DB-side ordering would be clearer.
- **Fix**: Optional cleanup — replace the `.sort()` with a second `.order()` call on the supabase query:
  ```ts
  .order("status", { ascending: true })   // 'active' < 'done'
  .order("created_at", { ascending: false });
  ```
- **Decision**: PENDING

## Notes on what was checked but not flagged

- RLS + per-route `.eq("user_id", user.id)` — defense in depth is correctly applied across update/delete/edit
- Astro auto-escaping covers all interpolated listing data (`{listing.address}`, etc.); no `set:html` directive used
- `confirm()` in ListingCard.astro uses a static Polish string with no interpolation surface
- `encodeURIComponent` used consistently on every `?error=` redirect across all three API routes
- Auth gating (`supabase.auth.getUser()` + redirect on null) present in every API route
- `formData.get(...) as string | null` cast is more defensive than the auth-route pattern — an improvement
- Phase 1 migration is a verbatim match to the plan contract (10 columns, RLS policy, trigger)
- Layout.astro `lang="pl"` fix landed correctly (line 14)
