# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Postgres functions must pin search_path

**Context:** `supabase/migrations/*` — any `CREATE FUNCTION` body, especially trigger functions reused across migrations.

**Problem:** Functions declared `language plpgsql` (or `sql`) without a fixed `search_path` allow a malicious schema earlier in the resolution order to shadow built-ins like `now()`. Supabase's DB linter raises `function_search_path_mutable` for every such function. The risk compounds when a function (e.g. `handle_updated_at`) is deliberately reused as a trigger on later tables — each new table inherits the same warning.

**Rule:** Every `CREATE FUNCTION` in a migration must include `SET search_path = ''` (or an explicit allowlist) and fully qualify built-ins (e.g. `pg_catalog.now()`).

**Applies to:** All Supabase/Postgres migration files. Re-check at `/10x-plan` (when designing a migration) and `/10x-impl-review` (when reviewing one).

## Migrations must declare extensions they depend on

**Context:** `supabase/migrations/*` — any migration that uses functions from an optional Postgres extension (`gen_random_uuid` from pgcrypto, `vector` from pgvector, `crypt` from pgcrypto, `unaccent`, etc.).

**Problem:** Hosted Supabase ships several extensions pre-enabled, so `gen_random_uuid()` and friends "just work" in production. Migrations that rely on this implicit availability silently break on (a) fresh local Supabase stacks where the extension hasn't been turned on, (b) projects that have explicitly stripped extensions, and (c) any non-Supabase Postgres the schema gets ported to. The dependency is also invisible to humans reading the migration.

**Rule:** Every migration that uses a non-built-in function declares its extension at the top: `create extension if not exists "<name>" with schema extensions;`. Idempotent and documents intent.

**Applies to:** All Supabase/Postgres migrations. Re-check at `/10x-plan` (when designing a migration) and `/10x-impl-review` (when reviewing one).

## Never cast away the `error` field of a supabase-js response

**Context:** Any Astro page or API route that calls supabase-js methods like `.single()`, `.maybeSingle()`, `.select()`, `.insert()`, `.update()`, `.delete()`. Most commonly seen when a TypeScript cast is used to assert the shape of `data` without destructuring `error`.

**Problem:** supabase-js returns `{ data, error }`. Casting only `data` (e.g. `as { data: Listing | null }`) discards the error path: network failures, RLS misconfig, malformed UUIDs, and PostgREST validation errors all show up as `data === null`, which is indistinguishable from a legitimate "no rows". The page or route then silently redirects or returns an empty state, masking infrastructure problems and making bugs invisible in production.

**Rule:** Always destructure `const { data, error } = await supabase...`. Branch on `error` first (surface via `?error=` redirect or appropriate response). For `.single()`, treat error code `PGRST116` as "not found" and everything else as a real failure.

**Applies to:** All supabase-js call sites in `src/pages/**` and `src/lib/**`. Re-check at `/10x-impl-review`.

## Scope ESLint rule disables to the smallest possible surface

**Context:** `eslint.config.js` — config blocks that target a file glob like `**/*.astro`, `**/*.test.ts`, etc. Most commonly seen when a parser bug or framework quirk forces disabling a rule that fired in one file.

**Problem:** A rule disabled in a broad `files: ["**/*.astro"]` block silences that rule for every current and future file matching the glob. If only one file triggers the rule, the rest of the codebase silently loses the safety net — and the disable is invisible at the call sites where the rule would have caught a bug. The cost compounds as more files are added under the glob.

**Rule:** Disable an ESLint rule at the narrowest scope that fixes the trigger. Prefer (in order): (1) inline `/* eslint-disable-next-line <rule> -- <reason> */` at the offending line; (2) a per-file `files: ["<exact-path>"]` override; (3) a glob-scoped disable only when the trigger is genuinely repository-wide. Always include a `-- <reason>` comment explaining the cause so future cleanup can target the fix instead of the workaround.

**Applies to:** `eslint.config.js`, any `.eslintrc*` file, and any other linter/formatter config with rule-scope semantics (TypeScript, Stylelint, Biome, etc.). Re-check at `/10x-impl-review`.

## Document intentional asymmetry between sibling routes/handlers

**Context:** Two or more sibling handlers (e.g. `update.ts` and `delete.ts` under the same `[id]/` folder, or paired commands like `enable` / `disable`) that share most of their structure but diverge on one behavioral detail — typically error handling, idempotency, or "not found" semantics.

**Problem:** Without a comment marking the divergence as deliberate, the next person reading both files sees the asymmetry as an oversight and "fixes" it — collapsing the intentional behavior. Plans frequently encode these decisions ("idempotent — double-delete is not an error"), but the plan is not loaded into the editor at refactor time. The signal lives only at the code site.

**Rule:** When a sibling handler deviates from its peer on purpose, leave an inline comment at the divergence point that (a) names the peer it disagrees with, (b) names the behavior, and (c) cites the source of truth (plan section, PRD requirement, lesson, etc.). Example: `// Intentionally no .select() — idempotent delete per plan listing-crud Phase 2.`

**Applies to:** Any pair/family of sibling API routes, command handlers, lifecycle methods, or migration functions. Re-check at `/10x-impl-review` and `/10x-plan-review`.

## UX-positive deviations from a verbatim plan string are OK — but record them

**Context:** Plans frequently include verbatim copy ("Brak ogłoszeń. Dodaj pierwsze ogłoszenie."), CTA labels, error messages, button text. During implementation it's common to discover the literal string reads better when split, restructured, or upgraded into an interactive element (link, button, banner).

**Problem:** A silent deviation from verbatim plan copy is hard to distinguish from sloppy implementation during review. The next reviewer can't tell whether the change was deliberate (intentional UX improvement) or a typo/regression. The plan also stays out of date as a reference for future changes that build on the same surface.

**Rule:** When implementation deviates from a plan's verbatim text on purpose, either (a) update the plan with a one-line addendum at close-out noting the deviation and why, or (b) leave a brief comment at the code site referencing the deviation. Don't ship silently — the asymmetry between plan and code becomes invisible technical debt. Verbatim plan copy is a *default*, not a contract; user-visible improvements are welcome as long as they're traceable.

**Applies to:** Any plan with `Contract:` blocks that quote verbatim strings (empty states, button labels, error copy, headings). Re-check at `/10x-impl-review`.

## Push ordering and bounds to the database, not the application

**Context:** Server-rendered Astro/Next pages and API routes that fetch lists from Supabase/Postgres for direct rendering. Most commonly seen as `.select().order(col).then(JS-side .sort())` and `.select()` with no `.limit()`.

**Problem:** Re-sorting fetched rows in JS leaks a database-shape concern (ordering policy) into the rendering layer and silently relies on `Array.prototype.sort`'s stability guarantee — a future change to the SQL order can break the JS-side ordering without any visible cause. Selecting with no `.limit()` means every row the user owns travels over the wire on every page load; this is invisible at 5 listings and a production incident at 50,000.

**Rule:** All ordering belongs in the SQL `.order()` chain (multiple calls compose, evaluated left-to-right). Every list-rendering query carries an explicit `.limit()` from day one — pick a number that matches the rendered page size (e.g. 100), even if pagination isn't built yet. The limit is a guardrail, not a feature.

**Applies to:** Any list-returning supabase-js query in `src/pages/**` and `src/lib/**`, plus any equivalent ORM/raw SQL pattern. Re-check at `/10x-impl-review`.

## Authenticate first, then validate — short-circuit unauthenticated requests at the door

**Context:** Server-handled mutation endpoints (Astro API routes, Next route handlers, REST/RPC controllers) that read `formData()` or a request body, validate fields, look up the authenticated user, and then perform a side effect.

**Problem:** Validating fields before checking auth means an unauthenticated caller can probe the route's validation logic by submitting bad input — the route's error responses reveal which fields are required, what enums are accepted, and what error messages exist. Even when middleware eventually redirects to sign-in, the leak happens before that. The order also disagrees with most plans, which list "get authenticated user" as step 1.

**Rule:** Every mutation route does auth first: build the supabase/db client, call `getUser()` (or equivalent), redirect/401 if unauthenticated. Only after that branch is cleared, parse and validate body fields. The pattern reads as: `client → user → (parse body) → validate → mutate`.

**Applies to:** All `src/pages/api/**` Astro API routes and any handler that performs a user-scoped mutation. Re-check at `/10x-impl-review`.

## Map internal DB errors to safe Polish strings before surfacing to the user

**Context:** `src/pages/api/**` Astro API routes and `.astro` pages that call supabase-js and surface errors to users via `?error=` query-param redirects.

**Problem:** `error.message` from supabase-js calls (PostgREST constraint violations, RLS failures, network errors) is placed raw into the redirect URL and rendered verbatim in the UI banner. The strings are internal English messages like "new row for relation X violates check constraint Y" — not suitable for user-facing Polish UI.

**Rule:** Map known DB/API errors to a safe, Polish-language error code before redirecting (e.g., `?error=blad-zapisu`). For unexpected errors, use a generic Polish fallback ("Wystąpił nieoczekiwany błąd. Spróbuj ponownie.") rather than passing `error.message` through. The `.astro` page maps the code to a human-readable string in Polish.

**Applies to:** All `src/pages/api/**` routes that redirect with `?error=encodeURIComponent(error.message)` and any `.astro` page that renders the `?error=` param in a banner. Re-check at `/10x-impl-review`.

## Schema-qualify function references in CREATE TRIGGER

**Context:** `supabase/migrations/*.sql` — any `CREATE TRIGGER ... EXECUTE FUNCTION` call that references a trigger function by name.

**Problem:** `EXECUTE FUNCTION handle_updated_at()` resolves the function using the session's `search_path` at trigger-creation time. If a migration runs in a strict-search_path environment (e.g. `search_path = ''`), the unqualified name fails to resolve and the migration aborts. The lesson already requires `SET search_path = ''` on every `CREATE FUNCTION`; the same discipline should apply to the function reference in the trigger.

**Rule:** Always schema-qualify the function name in `EXECUTE FUNCTION` — use `public.handle_updated_at()` (or whichever schema the function lives in), not just `handle_updated_at()`. Idempotent and portable.

**Applies to:** All `supabase/migrations/*.sql` files that create a trigger. Re-check at `/10x-plan` (when designing a migration) and `/10x-impl-review` (when reviewing one).

## Plan contracts must include the supabase null guard

**Context:** `src/pages/api/**/*.ts` and `src/pages/dashboard/**/*.astro` — any Astro API route or page that calls `createClient()` and proceeds to call methods on the result.

**Problem:** `createClient()` (in `src/lib/supabase.ts`) returns `null` when `SUPABASE_URL` or `SUPABASE_KEY` env vars are absent. Routes and pages that skip the null guard proceed to call `.auth.getUser()` or `.from()` on `null`, throwing an uncaught `TypeError` instead of a clean redirect or error banner. The guard pattern exists in every implemented file (pricing.astro, edit.astro, price/set.ts), but plan contracts have omitted it as an "implementation detail" — so it only gets caught at code review, not during planning.

**Rule:** Every API route contract must specify `if (!supabase) { return context.redirect(...) }` immediately after `createClient()`. Every `.astro` page contract must specify an `if (!id || !supabase)` (or equivalent) null-check before any DB call. This guard is load-bearing for misconfigured environments and must appear in the plan contract explicitly — not be assumed from existing code.

**Applies to:** All plan contracts for `src/pages/api/**` routes and `src/pages/dashboard/**` pages. Re-check at `/10x-plan` (when writing contracts) and `/10x-impl-review` (when reviewing them).

## Delete route contracts must instruct the inline idempotency comment

**Context:** Plan contracts for delete API routes (`src/pages/api/**/delete.ts`) that intentionally behave differently from sibling create/update routes — specifically, omitting `.select()` so that 0 rows deleted is not an error.

**Problem:** A plan may correctly document the idempotency asymmetry in prose (e.g., "0 rows deleted is not an error"), but lessons.md rule 7 says the signal must live at the code site — not only in the plan document. If the plan contract does not explicitly instruct the implementer to leave an inline comment at the `.delete()` call, the comment is likely to be omitted. A future reader who sees no `.select()` may then "fix" the perceived missing check, breaking idempotency.

**Rule:** Any delete route contract that uses an intentional asymmetry vs. sibling routes must include an explicit instruction: "Leave an inline comment at the `.delete()` call: `// Intentionally no .select() — idempotent delete, 0-row result is not an error. (<change-id> plan Phase N.)`"

**Applies to:** All plan contracts for delete routes under `src/pages/api/**`. Re-check at `/10x-plan` (when writing delete route contracts) and `/10x-impl-review` (when reviewing them).

## Plan contracts must specify .limit() on every list-rendering query

**Context:** `context/changes/**/plan.md` — any Change Required contract that describes a list fetch in a page or API route (e.g. `.from('table').select('*').eq(...).order(...)`).

**Problem:** The "Push ordering and bounds to the database" lesson correctly establishes that every list query needs an explicit `.limit()`, but plan contracts can omit it without triggering any automated check. During the `documents-and-files` plan review, three list queries were contracted without `.limit()` — the lesson existed but wasn't applied at plan time. The implementer would have no signal to add it.

**Rule:** Every plan contract that specifies a list query (`select('*')` with `.order()`, no `.single()` or `.maybeSingle()`) must include the `.limit(N)` in the contract text, with a concrete number appropriate to the rendered page size (e.g. `.limit(50)` for checklist items, `.limit(100)` for photo/file lists). If the number is a design question, resolve it during planning — do not leave it implicit.

**Why:** The code lesson alone is not enough because it is only read at implementation time (`/10x-implement`), not during planning. Encoding the limit in the contract makes it a planning output rather than a runtime guess.

**Applies to:** All `context/changes/**/plan.md` files with list-rendering contracts. Re-check at `/10x-plan` (when writing contracts) and `/10x-impl-review` (when reviewing them).

## Upload route contracts must verify entity ownership before Storage writes

**Context:** `src/pages/api/listings/[id]/**/upload.ts` — any API route that writes to Supabase Storage using a path derived from URL params (e.g. `{user_id}/{listing_id}/{uuid}`).

**Problem:** Table-level RLS on `listing_photos` / `listing_files` checks `user_id = auth.uid()` but not that `listing_id` (from `params.id`) belongs to that user. An upload route that skips an explicit ownership pre-check can write a Storage object under an arbitrary `listing_id` path before the DB insert fails via RLS — leaving an orphaned Storage object. The sibling mutation routes (e.g. `add.ts`) correctly verify listing ownership with a dedicated DB query before mutating. Not matching this pattern creates an undocumented asymmetry that violates the intentional-asymmetry lesson.

**Rule:** Every upload route contract must include, as a step immediately before the Storage upload: verify listing ownership via `.from('listings').select('id').eq('id', params.id).eq('user_id', user.id).single()` — redirect with `?error=nie-znaleziono` if not found. This closes the orphaned-Storage-object risk and keeps all mutation routes consistent.

**Applies to:** All `src/pages/api/listings/[id]/**/upload.ts` routes and any future route that writes to Storage using a URL param as a path segment. Re-check at `/10x-plan` (when writing upload contracts) and `/10x-impl-review` (when reviewing them).

## Upload route contracts must specify server-side file size and type validation

**Context:** `src/pages/api/listings/[id]/**/upload.ts` — any API route that accepts file input (`form.get('file')` or `form.getAll('files')`).

**Problem:** HTML `accept` and `multiple` attributes are browser-only — any HTTP client can send arbitrary file types or sizes regardless. Bucket-level size limits produce a generic Storage error that maps to a generic Polish error banner with no indication of the cause. During the `documents-and-files` plan review, `photos/upload.ts` was contracted without explicit size or type checks even though the sibling `files/upload.ts` had both — creating an inconsistency and leaving the public photos bucket open to non-image uploads.

**Rule:** Every upload route contract must explicitly specify, inside the per-file validation step before the Storage call: (1) `file.size <= N * 1024 * 1024` — redirect `?error=plik-za-duzy` if exceeded. (2) For type-restricted uploads (e.g. images), `file.type.startsWith('image/')` — redirect `?error=nieprawidlowy-typ` if the check fails. Both checks must appear in the plan contract, not be left as implementation assumptions relying on bucket-level enforcement.

**Applies to:** All `src/pages/api/listings/[id]/**/upload.ts` contracts. Re-check at `/10x-plan` (when writing contracts) and `/10x-impl-review` (when reviewing them).

## Migration plan contracts must state the full UUID PK DEFAULT expression

**Context:** `context/changes/**/plan.md` — any Change Required contract for a migration that creates a table with a UUID primary key.

**Problem:** The lessons.md rule "Migrations must declare extensions they depend on" correctly requires `create extension if not exists "pgcrypto" with schema extensions;` in migration files. But plan contracts typically shorthand the PK as `id uuid PK`, omitting both the extension declaration and the schema-qualified DEFAULT. An implementer following the contract literally writes `id uuid PRIMARY KEY` without a DEFAULT, or uses bare `gen_random_uuid()` instead of `extensions.gen_random_uuid()`, breaking on local stacks where pgcrypto is not pre-enabled. Discovered during `documents-and-files` plan review when three new tables were contracted with `id uuid PK` and no extension declaration.

**Rule:** Every migration contract that creates a UUID-keyed table must specify the full PK form: `id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid()`. If the migration uses pgcrypto, the contract must also include: "Open the migration with: `create extension if not exists \"pgcrypto\" with schema extensions;`". Do not leave the DEFAULT as an implementation assumption.

**Applies to:** All migration plan contracts in `context/changes/**/plan.md`. Re-check at `/10x-plan` (when writing migration contracts) and `/10x-impl-review` (when reviewing them).

## Upload contracts must address the Storage-orphan risk on DB insert failure

**Context:** `src/pages/api/listings/[id]/**/upload.ts` — any upload route that writes to Supabase Storage before inserting a DB metadata row.

**Problem:** Plans that address the delete order (Storage first, then DB) often omit the symmetric upload risk: Storage upload succeeds → DB insert fails → orphaned Storage object with no DB record. The agent can't see or delete this object via the UI. During `documents-and-files` plan review, both upload contracts handled Storage failures but had no handler for DB insert failure — the orphan scenario was unacknowledged.

**Rule:** Every upload route contract must include one of: (a) a best-effort Storage cleanup step on DB insert failure — "if DB insert fails, call `supabase.storage.from(bucket).remove([storagePath])`, then redirect `?error=blad-zapisu`; note this as accepted MVP risk if cleanup also fails"; or (b) an explicit "Accepted MVP risk: Storage orphan on DB insert failure — no cleanup attempted." Either form signals that the risk was considered.

**Applies to:** All `src/pages/api/listings/[id]/**/upload.ts` contracts. Re-check at `/10x-plan` (when writing upload contracts) and `/10x-impl-review` (when reviewing them).

## Document Storage cleanup gaps in "What We're NOT Doing" when tables use CASCADE

**Context:** `context/changes/**/plan.md` — any plan that creates a table with `ON DELETE CASCADE` on a FK to `listings` (or any parent entity) AND stores associated Supabase Storage objects whose path is derived from the parent entity's ID.

**Problem:** `ON DELETE CASCADE` removes DB rows but leaves Storage objects untouched. If the plan doesn't explicitly acknowledge this, the implementer has no signal that deletion of a listing (or other parent entity) leaves orphaned Storage files — which may be publicly accessible indefinitely if the bucket is public. During `documents-and-files`, `listing_photos` and `listing_files` both use CASCADE but the "What We're NOT Doing" section didn't mention the Storage cleanup gap.

**Rule:** Any plan that introduces a table with `ON DELETE CASCADE` AND associated Storage objects must add to "What We're NOT Doing": "No Storage cleanup when a [parent entity] is deleted — orphaned Storage objects remain. Accepted MVP gap; [responsible slice] should address full cleanup." This makes the gap visible and defers it explicitly rather than losing it.

**Applies to:** All `context/changes/**/plan.md` files that combine `ON DELETE CASCADE` FKs with Supabase Storage writes. Re-check at `/10x-plan` (when writing the "Not Doing" section) and `/10x-impl-review` (when reviewing).

## Astro SSR page contracts must specify Promise.all for parallel async calls

**Context:** `src/pages/dashboard/**/*.astro` — any Astro page that makes multiple independent async calls in the server frontmatter (e.g. generating N signed URLs, fetching N related records from separate tables).

**Problem:** Plan contracts that say "for each item, generate X" imply a sequential loop even when the iterations are independent. In Astro SSR, a sequential `for` loop over N Storage `createSignedUrl()` calls adds N×latency to every page load. The contract-reader (implementer or agent) will default to a `for` loop unless `Promise.all` is explicitly specified. Discovered during `documents-and-files`: the files section contract implied sequential signed URL generation without stating the parallel alternative.

**Rule:** Any contract that requires multiple independent async calls at page render time (signed URLs, sub-fetches, external API calls) must explicitly state `Promise.all(items.map(...))` rather than "for each item, call X". This makes the performance intent part of the contract rather than an implementation guess.

**Applies to:** All `src/pages/dashboard/**/*.astro` contracts in plan files that involve per-item async calls. Re-check at `/10x-plan` (when writing page contracts) and `/10x-impl-review` (when reviewing them).
