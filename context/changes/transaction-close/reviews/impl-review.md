<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Transaction Close (S-06)

- **Plan**: `context/changes/transaction-close/plan.md`
- **Scope**: Pre-implementation plan audit vs. roadmap/PRD (no code exists yet — all Progress items `[ ]`)
- **Date**: 2026-05-30
- **Verdict**: APPROVED (all findings resolved during triage)
- **Findings**: 0 critical  4 warnings  2 observations — all fixed

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — FR-018 says "date and time" but plan chose date-only

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: plan.md — Phase 1 migration contract / planning Q4
- **Detail**: PRD FR-018 is marked must-have: "Agent can set transaction date and time on a listing." The planning session explicitly chose date-only (no time), reasoning that Polish real estate closings are day-dated. This deviates from the literal PRD spec.
- **Fix A ⭐ Recommended**: Accept deviation — document it explicitly in the plan's "What We're NOT Doing" section.
  - Strength: The rationale is sound; date-only is standard practice in Polish real estate record-keeping at this scale. Adding the note makes the deviation visible for v2.
  - Tradeoff: PRD says must-have for "time" — if spec is audited, this needs justification on record.
  - Confidence: HIGH — timezone complexity on Cloudflare Workers is real; date-only reduces risk.
  - Blind spot: Haven't confirmed with the actual agent whether they ever need to record a specific hour.
- **Fix B**: Change transaction_date to timestamptz
  - Strength: Stays literal to FR-018; future-proof.
  - Tradeoff: Timezone handling in Cloudflare Workers edge runtime adds complexity; `<input type="datetime-local">` has poor mobile UX.
  - Confidence: MEDIUM — complexity may outweigh benefit at MVP scale.
  - Blind spot: Supabase SSR timezone behavior on Workers not tested.
- **Decision**: FIXED via Fix A — "What We're NOT Doing" note added to plan.md

### F2 — close.ts contract missing commission_settings fetch step

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: plan.md — Phase 2 "Close API route" contract
- **Detail**: The close.ts commission computation references settings.agency_percent and settings.tax_rate, but the API contract never specifies fetching commission_settings from the DB. An implementer following the plan literally will encounter an undefined variable at runtime.
- **Fix**: Add an explicit fetch step to the close.ts contract immediately after the gate check: `.from('commission_settings').select('tax_rate, agency_percent').eq('user_id', user.id).maybeSingle()`. Note that null result (unconfigured rates) is handled by the existing NULL-check before computing.
  - Strength: Closes the gap with zero ambiguity; matches the commission_settings fetch already specified in the close.astro page contract.
  - Tradeoff: Adds one more DB round-trip in the API route — already acceptable.
  - Confidence: HIGH — the computation won't work without this data.
  - Blind spot: None significant.
- **Decision**: FIXED + ACCEPTED-AS-RULE: "Close API contracts must specify all DB fetches needed for computation" — commission_settings fetch step added to close.ts contract in plan.md

### F3 — Double-submit race: two active snapshots possible

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: plan.md — Phase 1 migration contract (missing index) / Phase 2 close.ts contract (INSERT ordering)
- **Detail**: Two concurrent close requests can both pass the status=active check, both INSERT a snapshot row, then both UPDATE listing to 'done'. Result: two snapshot rows with voided_at = null. The close.astro done-state fetch uses .maybeSingle() on voided_at IS NULL — which fails when multiple rows match. Dashboard snapshot batch query also breaks.
- **Fix A ⭐ Recommended**: Add a unique partial index to the migration.
  - Strength: Eliminates the race at the DB level. Index: `CREATE UNIQUE INDEX unique_active_snapshot ON public.transaction_snapshots(listing_id) WHERE voided_at IS NULL;` The second INSERT fails → API redirects ?error=blad-zapisu. INSERT-then-UPDATE ordering unchanged.
  - Tradeoff: Double-submit shows a generic error rather than "already closed" — acceptable for MVP.
  - Confidence: HIGH — unique partial indexes are standard Postgres for this pattern.
  - Blind spot: Haven't confirmed whether supabase-js surfaces the constraint violation cleanly.
- **Fix B**: Reverse to UPDATE-then-INSERT ordering
  - Strength: UPDATE is idempotent; only one request proceeds to INSERT.
  - Tradeoff: Reverses the deliberate "better orphan direction" decision in the plan.
  - Confidence: MEDIUM — still requires the unique index to be safe.
  - Blind spot: Plan's orphan-risk argument may favor keeping INSERT-first.
- **Decision**: FIXED + ACCEPTED-AS-RULE: "Singleton-per-entity DB rows need a unique partial index" — UNIQUE INDEX added to migration contract in plan.md

### F4 — close.astro contract missing Promise.all for parallel DB fetches

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: plan.md — Phase 2 "Close transaction page" contract
- **Detail**: Lessons.md rule requires contracts with multiple independent async calls at render time to explicitly state Promise.all. The close.astro contract specifies four DB fetches without mentioning parallelism. Listing and commission_settings are always independent and can be fetched in parallel.
- **Fix**: Amend the close.astro contract to specify: `const [listingResult, settingsResult] = await Promise.all([listing fetch, commission_settings fetch])`. Then branch on listing.status for the conditional fetches.
  - Strength: Satisfies the lessons.md contract rule; reduces page latency by one DB round-trip on every load.
  - Tradeoff: Two-line contract amendment — no risk.
  - Confidence: HIGH — same pattern as documents.astro signed-URL parallelism in the S-05 plan.
  - Blind spot: None significant.
- **Decision**: FIXED + ACCEPTED-AS-RULE: existing Promise.all lesson amended to cover independent top-level fetches; Promise.all spec added to close.astro contract in plan.md

### F5 — transaction_notes field not in PRD or roadmap scope

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: plan.md — Phase 1 migration contract, Phase 2 close.astro
- **Detail**: transaction_notes is not covered by FR-007, FR-017, FR-018, or US-01. Approved during planning but has no PRD anchor.
- **Fix**: Either (a) document in "What We're NOT Doing" as "transaction_notes kept as a convenience field beyond PRD scope" — field stays but deviation is visible; or (b) remove if strict PRD traceability is required.
- **Decision**: FIXED — "What We're NOT Doing" note added to plan.md

### F6 — edit.astro and pricing.astro don't get "Zamknij →" nav link

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: plan.md — Phase 2 "Navigation wiring"
- **Detail**: S-06 adds a Close step to the listing chain. The plan wires a card button and a forward link from documents.astro, but edit.astro and pricing.astro don't get "Zamknij →" links. Agent must navigate through Documents to reach Close from those pages.
- **Fix**: Add "Zamknij transakcję →" to the bottom nav bars of edit.astro and pricing.astro, mirroring the pattern used for "Dokumenty i zdjęcia →".
- **Decision**: FIXED — wiring entries for edit.astro and pricing.astro added to Phase 2 navigation wiring section in plan.md
