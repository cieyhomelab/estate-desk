---
date: 2026-06-11T19:41:44+02:00
researcher: Claude (Opus 4.8)
git_commit: f090375af788b1d9e8aa6272e27da8e98f904779
branch: feature/commission-set
repository: estate-desk
topic: "Refactor opportunities — which documented debts to fix, in what shape, in what order"
tags: [research, refactor, technical-debt, types, validation, auth, flash-messages, idor]
status: complete
last_updated: 2026-06-11
last_updated_by: Claude (Opus 4.8)
---

# Research: Refactor opportunities from the commission-set debt analysis

**Date**: 2026-06-11T19:41:44+02:00
**Researcher**: Claude (Opus 4.8)
**Git Commit**: `f090375af788b1d9e8aa6272e27da8e98f904779`
**Branch**: feature/commission-set
**Repository**: estate-desk

## Research Question

The prior analysis (`context/changes/commission-set-analysis/research.md`) documented the
technical debt and structural risks around `commission/set.ts` and the conventions it
shares with the rest of the repo. It deliberately left one question open: **WHICH of those
problems are worth fixing, in what target shape, and in what order.** This change answers
exactly that — explore every recorded problem in code and history, then rank them as
refactor opportunities. **No code changes, no refactor, no decision** happens here; the
ranking is a proposal for a separate planning session.

Method: treated the prior report and `context/map/repo-map.md` as collected evidence (not
re-derived). Classified every recorded problem as **CANDIDATE** (a problem whose fix would
change code *structure*) vs **non-candidate** (test gap, doc gap, localized bug, product
decision — kept as feasibility/cost input). Then investigated each candidate along three
read-only axes — current shape, history/intentionality, migration feasibility — and
synthesized a ranking.

---

## Problem inventory & classification (audit this first)

Every problem the prior report records, regardless of label:

| ID | Problem (source §) | Classification | Why |
|---|---|---|---|
| **C1** | No generated DB types; `Listing`/`TransactionSnapshot` hand-mirrored in two files; supabase client untyped (§2.4) | **CANDIDATE** | Fix introduces a generated type layer + typed client — structural |
| **C2** | Silent false-success on 0-row `UPDATE`; `.update().eq("id").eq("user_id")` with no rowcount check across 7 routes (§2.2) | **CANDIDATE** | Consistent fix introduces a shared owned-mutation seam — structural |
| **C3** | Flash slugs with no shared layer; 3+ render patterns; `blad-zapisu` emitted by 11 routes (§2.4) | **CANDIDATE** | Fix introduces a shared slug→message layer — structural |
| **C4** | Per-route `auth.getUser()` repeated in 19/22 routes; two-layer auth (§Arch Insights) | **CANDIDATE** | Fix introduces a shared API-auth wrapper — structural |
| **C5** | Validation rule duplicated across 4 layers; no CHECK on `transaction_snapshots` copy; client/server lower-bound mismatch (§2.5) | **CANDIDATE (split)** | Code part (shared validator) structural; snapshot-CHECK part is a pure migration |
| **C6** | `PROTECTED_ROUTES` manual list; new page public-by-default (repo-map risk #3) | **CANDIDATE (weak)** | An auto-protection scheme would be structural — but see verdict |
| P1 | Zero test coverage of the route; 4/22 routes directly tested (§2.1) | non-candidate | Test gap, not a structure change — but it is the **enabler** for C2 |
| P3 | Redirect interpolates `undefined` into URL on `!id` (§2.3) | non-candidate | Localized bug fix, not structural |
| P4c | Form-field name manually synced `pricing.astro` ↔ `set.ts` (§2.4) | non-candidate | Micro-seam; folds into C1/C3 if anything |
| P6 | No listing-status guard — commission editable after close (§2.6) | non-candidate → **business decision** | Per hard boundary: real fix is a product-concept decision, not code structure. Named and stopped below. |
| P7 | Git-history hygiene — misleading commit message `1eff78a` (§2.7) | non-candidate | Not code |

Candidate set carried into investigation: **C1, C2, C3, C4, C5, C6.**

---

## Per-candidate findings

Each candidate: **current shape** (evidence), **intentionality verdict** (why it looks like
this), **feasibility** (incremental path + first step). Claims tagged
[EVIDENCE]/[INFERENCE]/[UNKNOWN].

### C1 — No generated DB types; manual domain-type duplication

**Current shape.** No `database.types.ts` exists anywhere (`find`/`grep` both zero)
[EVIDENCE]. The client is constructed untyped — `createServerClient(SUPABASE_URL, SUPABASE_KEY, …)`
at `src/lib/supabase.ts:9`, **no `<Database>` generic**, so every query returns `any`-shaped
rows [EVIDENCE]. `commission_percent` alone is hand-typed in 4 places: `types/listings.ts:16`,
`types/transaction.ts:6`, an inline `.single<{…commission_percent: number|null}>()` at
`close.ts:35`, and the parsed value at `set.ts:21` [EVIDENCE]. Stringly-typed call sites:
`.select(` ×34, `.update(` ×8, `.insert(` ×7 (non-test) [EVIDENCE].

**Intentionality: ACCIDENTAL (never set up), high confidence.** `stack-assessment.md:41-62`
scores the "Typed" gate as **pass** on TypeScript strictness alone — it never mentions
`supabase gen types` or that the client is untyped [EVIDENCE]. Exhaustive search of
`archive/`/`foundation/`/`changes/` for `database.types|supabase gen|codegen` → zero hits
[EVIDENCE]. Generated typing was never weighed and rejected; it was simply never on the
table. [INFERENCE from documented silence]

**Feasibility.** supabase CLI **is** wired (`supabase` devDep, `config.toml` with
`project_id`, CI `migrate` job runs `supabase db push`) [EVIDENCE]. `astro check` (CI type
gate, `ci.yml:21`) is exactly the guard, and adoption is **additive**: emit the generated
file, then re-express `Listing`/`TransactionSnapshot` as aliases or leave both side-by-side;
the client `<Database>` swap and per-call-site swaps are independent later steps. Blast
radius = 11 type consumers (4 `[id]/*.astro` pages, `ListingCard.{tsx,astro}`,
`DashboardListings.tsx`, `lib/csv.ts`, `csv.test.ts`, `dashboard.astro`) [EVIDENCE].
Fully reversible (types erase at build). **First step:** add a `db:gen-types` script and
commit `database.types.ts` — generation only, no call-site swap.

### C2 — Silent false-success on 0-row UPDATE

**Current shape.** Pattern `.update(...).eq("id").eq("user_id")` checking only `error`; a
0-row match (wrong owner / missing id) returns `error===null` → route reports success.
Per-route status [EVIDENCE]:
- **Vulnerable as written (no prior owner select):** `commission/set.ts:27`,
  `documents/override.ts:25-29`, `documents/[docId]/toggle.ts:25-29`, `price/set.ts:39-43`.
- **Surface narrowed by a prior `.select().single()`** (errors → `nie-znaleziono` before the
  update): `close.ts:30-35→109-120`, `reopen.ts:22-27→53`.
- **The 7th cited route is the counter-example that already does it right:** `update.ts:38-49`
  appends `.select()` and checks `if (data.length === 0)` → `"Ogłoszenie nie zostało
  znalezione"`. This is the in-repo reference implementation of the correct pattern [EVIDENCE].
- No shared mutation helper exists; every route hand-rolls update + error check [EVIDENCE].

**Intentionality: SPLIT — ownership filter DELIBERATE; dropped rowcount check is ACCIDENTAL
DRIFT off a documented original. High confidence.** This is the headline historical finding.
The `.eq("user_id", …)` filter is a documented constraint (listing-crud `plan.md:52`,
plan-brief Phase-2 risk) [EVIDENCE]. The original UPDATE route had 0-row=error **by plan**
(listing-crud `plan.md:148`: "If the update affects 0 rows … redirect with error") and still
does (`update.ts`) [EVIDENCE]. The UPDATE-vs-DELETE asymmetry was **explicitly reviewed and
accepted as a rule**: impl-review F5
(`context/archive/2026-05-25-listing-crud/reviews/impl-review.md:84-101`) warns that the
sibling routes invite "a future 'cleanup' PR to align them **in the wrong direction**" and
records a lesson to document the asymmetry [EVIDENCE]. The 7 later routes silently dropped
the check; none of their plans/reviews justify the omission [EVIDENCE]. The
`context/foundation/lessons.md` that captured the guard **no longer exists on disk**
([EVIDENCE] — `Read` fails; last touched in git `4783d25`), which plausibly explains why the
drift went unchecked.

**Feasibility — target depends on an OPEN QUESTION; first step is a characterization test,
not a refactor.** Open Question #1 (prior report, lines 429-436) is unresolved [UNKNOWN]:
does a 0-row UPDATE under RLS return silent success or an RLS error? The correct target
diverges on the answer. The cookie-auth harness can pin it **today** — `idor.test.ts:71-116`
is a working template (seed user A's listing via service-role, sign in AS user B via
`getAuthCookieHeader`, POST, assert the redirect slug AND re-query the row to confirm no
write) [EVIDENCE]. The missing case is precisely a 0-row UPDATE with no prior select, which
`commission/set.ts:27` exemplifies. Guard: `test:integration:api` (`ci.yml:29`). Incremental:
route-by-route helper adoption after behavior is pinned; reversible by inlining the chain
back. **First step:** write one integration test POSTing `commission/set` as a non-owner,
asserting the slug + unchanged row — its observed slug answers Open Q1 and selects the target
shape for all routes.

### C3 — Flash slugs with no shared layer

**Current shape.** `blad-zapisu` emitted by exactly 11 routes as bare URL-param literals
[EVIDENCE]. No shared slug→message map anywhere [EVIDENCE]. ≥4 render patterns across 6 pages:
inline nested-ternary (`pricing.astro:94-110`, `documents.astro:91-99`,
`settings/commission.astro:51-57`); per-slug `&&` lists (`close.astro:115-122`); `includes`-list
fallback (`close.astro:124`); page-local object-map (`contacts.astro:59-67`); plus raw
pass-through of human text on `dashboard.astro:98` [EVIDENCE]. A shared `Banner.astro`
component already exists as the render wrapper [EVIDENCE].

**Intentionality: ACCIDENTAL. High confidence.** All patterns authored by **one person
(Maciej)** across three separate slices within ~2 days (pricing `bce5cc9`, contacts `3de04f8`,
close `151e2d2`) [EVIDENCE git -L]. No shared message layer was ever proposed (grep of
archive plans/reviews → none) [EVIDENCE]. The known artifact: `pricing.astro`'s ternary was
written for `price/set` so a commission error renders a **price**-worded message — accretion,
not design (prior report Open Q4) [EVIDENCE].

**Feasibility.** Natural home: `src/lib/messages.ts` (cross-cutting `lib/` is the established
pattern; `config-status.ts:11-19` shows the typed-map shape). **Page-by-page additive** — the
~11 emitter routes never change (slug strings are the wire contract); only the 5 render sites
migrate [EVIDENCE]. Weak guard: e2e asserts page **state** text but **not** flash-banner text,
so a wrong mapping wouldn't be caught unless the refactor adds an assertion [EVIDENCE]. Fully
reversible per page. **First step:** create `src/lib/messages.ts` mapping existing slugs to
their current Polish text, migrate one page (`pricing.astro:94-111`), leave the rest untouched.

### C4 — Per-route auth check repetition

**Current shape.** `await supabase.auth.getUser()` in **19 of 22** routes; the 3 exceptions
are the public `auth/signin|signout|signup` [EVIDENCE]. Each protected route repeats ~7-9
lines (client create + null guard + getUser + user guard), e.g. `commission/set.ts:6,12-17`
[EVIDENCE]. `middleware.ts:12-13` already calls `getUser()` once and stashes
`context.locals.user`, but **API routes do not reuse it** — they re-fetch independently
[EVIDENCE].

**Intentionality: DELIBERATE design; a shared wrapper was UNKNOWN/never weighed.** In-handler
auth is a codified convention (CLAUDE.md §2; canonical `create.ts:10-15`) [EVIDENCE]. The
two-layer split (middleware for pages, in-handler for API) is reasoned in the IDOR archive:
"Only approach that proves each Astro route independently calls `getUser()`" [EVIDENCE]. The
page-layer `middleware.ts` was inherited from the starter (`f5cfa67` initial commit) and
deliberately maintained. No record of a `withAuth` HOF ever being considered or rejected
[UNKNOWN].

**Feasibility.** Wrapper is net-new (no existing helper). The two-layer design is a real
**constraint**: you can't fold API auth into middleware cleanly (the 3 `auth/*` routes must
stay public; handlers need `user.id` in-scope for the `.eq("user_id", …)` filter). The clean
target is a per-route **higher-order `withAuth((ctx,user,supabase)=>…)`**, not a middleware
change [INFERENCE, grounded]. Guard: `auth-boundary.test.ts:7-61` covers only 4 routes — it
proves behavior-equivalence for those during incremental adoption; the other ~15 are unguarded
unless tests are added alongside [EVIDENCE]. **First step:** add `src/lib/api-auth.ts` with
`withAuth`, adopt it in one already-covered route (`create`/`close`) so the existing test
proves equivalence before spreading.

### C5 — Validation rule duplicated across layers

**Current shape (split candidate).** The `commission_percent` rule (>0, ≤100) lives in 4
copies: HTML attrs `pricing.astro:181-185` (`min="0.01" max="100"`), route bounds
`set.ts:21,23`, DB CHECK `20260530100000:3-4`, and a **missing** CHECK on
`transaction_snapshots.commission_percent` (`20260530120000:17` is bare `numeric(5,2)`)
[EVIDENCE]. `price/set.ts` has the same 3-layer duplication for price [EVIDENCE]. **No schema
lib** (zod/valibot/yup) is a dependency [EVIDENCE].

**Intentionality: ACCIDENTAL (oversight) for the missing snapshot CHECK. Medium-high
confidence.** The team adds CHECKs wherever it wants them (`tax_rate`, `agency_percent`,
`price_history.price` all have CHECKs; the source `listings.commission_percent` too)
[EVIDENCE]. The snapshot columns shipped as plain numerics, and **neither plan nor review
records "snapshots are immutable, so constraints omitted"** [EVIDENCE]. The "immutable
snapshot" story is plausible but undocumented, so it isn't credited. Shared validation (zod)
was listed "out of scope" in the first data slice and never revisited [EVIDENCE].

**Feasibility.** The two parts are independent PRs. **DB part** (snapshot CHECK) is a pure
forward, additive migration (`ALTER TABLE … ADD CONSTRAINT … CHECK`), reversible via a
drop-constraint migration — **data-contingent** (adding a CHECK fails if existing rows
violate it; needs a pre-flight service-role query) [EVIDENCE]. **Code part** (shared
validator) is heavier: either add a dep (gated by `npm audit`, `ci.yml:19`) or write a plain
numeric-range validator in `src/lib/` (lighter, no dep). **First step:** the DB CHECK on
`transaction_snapshots.commission_percent` — lowest-risk atom, closes the divergence the
route can't (snapshot accepting values the source rejects), zero code change. Defer the code
unification.

### C6 — Manual `PROTECTED_ROUTES` list

**Current shape.** `PROTECTED_ROUTES = ["/dashboard", "/help"]` at `middleware.ts:4`, matched
by `pathname.startsWith(route)` `:18`. No auto-derivation; a new top-level page is public
until manually listed [EVIDENCE].

**Intentionality: DELIBERATE (manual list chosen on purpose); auto-protection UNKNOWN/never
weighed.** The help-page slice explicitly chose "add `/help` to `PROTECTED_ROUTES`" as a
reasoned decision and named the public-by-default failure mode [EVIDENCE]. The prefix-match
auto-covering sub-routes is a documented convenience (listing-crud `plan.md:30`) [EVIDENCE].
No default-deny / `PUBLIC_ROUTES` inverse was ever proposed [UNKNOWN].

**Feasibility: LOW-VALUE / HARD — recommend not refactoring.** Astro middleware receives only
`context.url.pathname` and has **no runtime route manifest** to auto-derive protection;
auto-protection would require build-time codegen or a `src/pages/(protected)/` route-group
move (every protected file relocates — low reversibility) [INFERENCE on Astro API +
EVIDENCE]. The list is 2 prefixes and changes only when a whole section is added. The real
procedural-coupling risk is the API self-guard (that's C4), not this page list. **First step
(if anything):** don't refactor — add one e2e guard asserting an unauthenticated GET to
`/dashboard` redirects to `/`, pinning the behavior at near-zero cost.

---

## Refactor opportunities (ranked proposal)

Ranked by **(debt cost) vs (change cost)**, grounded in the evidence above. This is a
proposal for a separate planning session — not a decision.

### #1 — C2: close the silent 0-row-UPDATE false-success

- **Current → target.** Today: 4 routes report `?success=` on writes that hit 0 rows; the
  correct pattern already exists in `update.ts` (`.select()` + `data.length===0` → error).
  Target: a **shared owned-mutation seam** (e.g. `updateOwnedRow(...)` returning rowcount, or
  a uniformly applied `.select()` + zero-row→error mapping) adopted across the 7 routes.
- **Why #1.** Highest debt severity — it touches **money** and produces a *silent* wrong
  success, the worst failure class (no error, no test, no signal). And the change cost is the
  lowest of the structural set: the target is **already implemented in-repo** (`update.ts`),
  the original behavior was **deliberate and documented**, and a **lost lesson** (F5) named
  this exact drift in advance. Fixing it restores a known-correct convention rather than
  inventing one.
- **Blast radius.** 4 vulnerable routes (`commission/set`, `documents/override`,
  `documents/[docId]/toggle`, `price/set`) + 2 narrowed-but-inconsistent (`close`, `reopen`);
  optionally re-home the `update.ts` pattern into the shared helper. No type/UI changes.
- **Incremental path.** (1) Characterization test pins runtime 0-row behavior [resolves Open
  Q1]. (2) If silent-success confirmed: extract the `update.ts` pattern into one helper. (3)
  Adopt route-by-route, each guarded by a cookie-auth test cloned from `idor.test.ts`.
- **First prerequisite step.** A single integration test (`idor.test.ts:71-116` template):
  POST `commission/set` as a non-owner; assert the redirect slug **and** that the row is
  unchanged. Its observed slug answers Open Q1 and selects the target for all routes. (This is
  also where non-candidate **P1 / test gap** becomes the enabler — the test must come first.)

### #2 — C1: generated DB types replacing manual duplication

- **Current → target.** Today: untyped client + `Listing`/`TransactionSnapshot` hand-mirrored
  in two files + 34/8/7 stringly-typed call sites. Target: a committed `database.types.ts` as
  the single source of truth, domain types aliased onto it, client typed `<Database>`.
- **Why #2.** It is the **blast-radius amplifier** behind several other debts — the prior
  report calls it out explicitly: every `.select()/.update()` is stringly-typed and the domain
  model lives in two hand-maintained copies, so any column change ripples manually. Removing it
  shrinks the cost of *future* changes. Lower urgency than C2 (no active wrong behavior), but
  high leverage and **very low risk**: additive, reversible, and fully guarded by the existing
  `astro check` gate.
- **Blast radius.** 11 type consumers; risk concentrates where hand-written types diverge from
  DB reality (nullability, the `ListingType`/`ListingStatus` literals).
- **Incremental path.** (1) Generate + commit the file (no swap). (2) Alias `Listing`/
  `TransactionSnapshot` onto generated `Tables<'…'>`, let `astro check` surface drift. (3)
  Type the client `<Database>` and migrate call sites opportunistically.
- **First prerequisite step.** Add a `db:gen-types` npm script and commit `database.types.ts`
  — generation only.

### #3 — C3: shared flash-slug → message layer

- **Current → target.** Today: ≥4 render patterns over 6 pages, 11 routes emitting raw slugs,
  one known wrong-message bug (commission error → price text). Target: a `src/lib/messages.ts`
  slug→message map consumed by the pages (emitter routes unchanged).
- **Why #3.** Purely **accidental complexity** with the cleanest incremental path of the set
  and no fight against any documented decision — but the debt is lower-severity (mostly
  consistency + one cosmetic bug), so it ranks below the correctness fix (C2) and the
  high-leverage type fix (C1). Earns its place over C4/C5 because it is unambiguously
  structural, single-author accidental, and page-by-page reversible.
- **Blast radius.** 5 render sites; ~11 emitters untouched (slugs are the wire contract).
- **Incremental path.** Introduce the map; migrate one page; expand page-by-page; optionally
  fix the `blad-zapisu` price/commission message bug as part of `pricing.astro`'s migration.
- **First prerequisite step.** Create `src/lib/messages.ts` from the existing slug strings,
  migrate `pricing.astro:94-111` only. (Weak guard — add a flash-text assertion if a guard is
  wanted.)

---

## Considered and rejected (or deferred)

- **C4 — shared API-auth wrapper.** *Viable but not now.* Unlike C1-C3, the current shape is a
  **deliberate, documented design** (CLAUDE.md §2 + IDOR archive), and the two-layer split is a
  genuine constraint that makes a wrapper awkward (public `auth/*`, `user.id` needed in-scope).
  Real value (kills ~19× boilerplate) but it should be a *deliberate architectural decision*,
  not "cleanup" — and only 4 routes are test-guarded today. Defer to a dedicated decision.
- **C5 — validation single-source-of-truth.** *Split it.* The high-value atom is the **missing
  CHECK on `transaction_snapshots`**, which is a **pure DB migration**, not a code refactor —
  recommend doing it standalone (data-contingent pre-flight). The code-side unification needs a
  new dependency or a new validator module and addresses lower-severity divergence; defer.
- **C6 — auto-derive `PROTECTED_ROUTES`.** *Reject as a refactor.* Astro has no runtime route
  manifest; auto-protection means build-time codegen or a heavy, low-reversibility route-group
  move, to replace a near-static 2-entry array. Add a behavioral e2e guard instead.

## Non-candidates (kept as feasibility / cost input, not refactors)

- **P1 — zero test coverage of the route.** A test gap, not a structure change — but it is the
  **enabler** for C2 (the characterization test is the first step) and lowers the cost of every
  candidate (the cookie-auth harness already exists, unused for these routes).
- **P3 — `undefined` interpolated into the redirect URL** on `!id`. Localized one-line bug fix.
- **P4c — form-field name manually synced** `pricing.astro` ↔ `set.ts`. Micro-seam; subsumed by
  C1/C3 if touched at all.
- **P7 — misleading commit message `1eff78a`.** History hygiene, not code.

## Hard-boundary stop: a business-concept question, not a refactor

- **P6 — commission editable after a listing is closed (§2.6).** The route does not guard on
  `status`, so commission can change post-close while the `transaction_snapshots` copy keeps the
  old value — a possible listing↔snapshot divergence. Whether this is a bug or intended
  flexibility is **[UNKNOWN]** and is a **product-concept decision, not a code-structure one**.
  Per the exploration's hard boundary, this is named and **stopped here** — it belongs to a
  separate product/domain analysis, not to this refactor ranking.

## Code References

- `src/lib/supabase.ts:9` — untyped client (C1 seam)
- `src/types/listings.ts:16`, `src/types/transaction.ts:6` — dual manual type copies (C1)
- `src/pages/api/listings/[id]/update.ts:38-49` — the in-repo **correct** 0-row pattern (C2 reference)
- `src/pages/api/listings/[id]/commission/set.ts:27`, `documents/override.ts:25-29`, `documents/[docId]/toggle.ts:25-29`, `price/set.ts:39-43` — vulnerable 0-row UPDATEs (C2)
- `src/integration/api/idor.test.ts:71-116` + `src/integration/helpers/auth.ts:4-33` — cookie-auth harness; C2 first-step template
- `src/lib/messages.ts` (to create), `src/components/Banner.astro`, `pricing.astro:94-111`, `contacts.astro:59-67`, `close.astro:115-124` — C3 home + render sites
- `src/middleware.ts:4,12-13,18` — two-layer auth, `PROTECTED_ROUTES` (C4/C6)
- `supabase/migrations/20260530120000_transaction_close.sql:17` — snapshot `commission_percent`, no CHECK (C5)
- `.github/workflows/ci.yml:18-41` — the gate order (every refactor's safety net)

## Architecture Insights

- **The strongest opportunity is a restoration, not an invention.** C2's correct shape already
  exists (`update.ts`), was deliberately designed, was reviewed, and was protected by a lesson
  that has since vanished from disk — the fix re-applies a known convention.
- **C1 is leverage, not urgency.** It is the amplifier under the stringly-typed seams; fixing
  it lowers the cost of every future column change rather than fixing an active fault.
- **"Deliberate" gates the ranking.** C4 and C6 are documented, intentional designs — they
  drop below the accidental-complexity items (C1/C3) and the documented-drift item (C2) because
  refactoring an intentional design is a decision, not a cleanup.
- **The CI suite makes these refactors cheap to verify** — `astro check` (C1), `test:integration:api`
  cookie-auth (C2/C4/C5), with the one weak spot being flash-text (C3, no e2e assertion).

## Historical Context (from prior changes)

- `context/changes/commission-set-analysis/research.md` — the source debt analysis (all § refs).
- `context/archive/2026-05-25-listing-crud/{plan.md:52,148, reviews/impl-review.md:84-101}` —
  origin of the IDOR filter **and** the 0-row=error rule + the F5 "wrong-direction cleanup" warning (C2).
- `context/archive/2026-06-02-testing-gate-logic-auth-idor/plan-brief.md` — rationale for in-handler API auth (C4).
- `context/archive/2026-05-30-transaction-close/` — snapshot table; no recorded reason for the missing CHECK (C5).
- `context/archive/2026-06-10-help-page/plan-brief.md:21` — deliberate `PROTECTED_ROUTES` extension (C6).
- `context/foundation/stack-assessment.md:41-62` — "Typed" gate passed on TS strictness, blind to untyped client (C1).
- `context/map/repo-map.md` — risk zones #1 (commission), #3 (PROTECTED_ROUTES), #6 (supabase hub).

## Open Questions

1. **[UNKNOWN — gates C2's target]** Runtime behavior of a 0-row UPDATE under RLS: silent
   success vs RLS error. Resolved by C2's first-step characterization test.
2. **[UNKNOWN — product, not code]** Is post-close commission editability (P6) intended?
3. **[UNKNOWN]** Does any existing `transaction_snapshots` row violate `>0 && ≤100`?
   (Pre-flight for C5's migration.)
4. **[UNKNOWN]** Is `blad-zapisu`→price-message on the pricing page (C3) a deliberate reuse or
   an oversight? Structure suggests oversight; fix-or-preserve is a C3 decision.
