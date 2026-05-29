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
