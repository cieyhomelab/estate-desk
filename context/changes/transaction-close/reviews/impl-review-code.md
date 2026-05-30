<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Transaction Close

- **Plan**: context/changes/transaction-close/plan.md
- **Scope**: All phases (1–3 of 3) — post-implementation code review
- **Date**: 2026-05-30
- **Verdict**: APPROVED (post-triage)
- **Findings**: 1 critical, 2 warnings, 1 observation — all resolved

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Notes

**Dismissed agent finding**: The safety agent flagged the commission formula in `close.ts` as potentially off by 100×. This is a **false positive**. `Math.round(price * commission_percent)` is algebraically identical to `Math.round(((price * commission_percent) / 100) * 100)` — the ÷100×100 cancels. The plan explicitly documents this equivalence.

**Plan drift (benign, both acknowledged):**
- `close.astro`: `checklist_override` gate stub omitted (S-05 placeholder, documented in code comment)
- `reopen.ts`: extra `.eq("user_id", user.id)` on snapshot void — stricter than plan, not a regression

## Findings

### F1 — override_confirmed checkbox is outside the form

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/dashboard/listings/[id]/close.astro:173 / 218`
- **Detail**: The override checkbox (`name="override_confirmed" value="true"`) sits inside the gate warning `<div>` that renders when `!gatePass`, which is before the `<form>` element at line 218. A form input outside its form element does not submit its value. The client-side script correctly enables the submit button when the checkbox is checked, but the server always receives `override_confirmed=null`, so `close.ts` always redirects `?error=brakujace-dokumenty`. The override is silently non-functional. Not currently visible because S-05 is not yet implemented (`uncheckedCount` is always 0), but will break the moment `listing_documents` is added.
- **Fix A ⭐ Recommended**: Move the checkbox inside the `<form>` element — render it near the top of the form, before the notary fields. The `<form>` already spans lines 218–283; the checkbox just needs to be inside that range.
  - Strength: Correct HTML form semantics; no JS change needed. The script's `getElementById` already targets the right IDs.
  - Tradeoff: Small layout adjustment — the checkbox is currently visually grouped with the warning text. Moving it inside the form requires either duplicating the warning context or restructuring the conditional rendering slightly.
  - Confidence: HIGH — this is the standard HTML fix for an input outside its form.
  - Blind spot: None significant; the fix is mechanical.
- **Decision**: FIXED via Fix A — checkbox moved inside `<form>` as `{!gatePass && (...)}` block at top of form

### F2 — Reopen mutation order leaves listing unrecoverable if snapshot void fails

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/listings/[id]/reopen.ts:39–53`
- **Detail**: `reopen.ts` performs: (1) UPDATE listings → `status=active`, (2) UPDATE snapshots → `voided_at`. If step 1 succeeds and step 2 fails, the listing is now active but its snapshot still has `voided_at=null`. The next close attempt inserts a second snapshot and hits the `unique_active_snapshot` index, returning `blad-zapisu` — the listing can never be re-closed without manual DB intervention. Reversing the order makes the failure state recoverable: a done listing with a voided snapshot can be reopened again (the void query is idempotent since the snapshot is already voided; the 0-row update is not an error; the listing update then succeeds).
- **Fix A ⭐ Recommended**: Reverse the operation order — void snapshot first, then update listing.
  - Strength: Both failure states become recoverable. If void succeeds but listing update fails, re-running reopen retries the listing update cleanly. If void fails before listing update, nothing changed.
  - Tradeoff: Mild conceptual inversion — needs a comment explaining the intentional order.
  - Confidence: HIGH — idempotent void query (`WHERE voided_at IS NULL`) means retry is always safe.
  - Blind spot: Haven't verified whether Supabase returns an error for 0-row updates on the retry path.
- **Fix B**: Add a comment documenting the orphan risk (mirror what `close.ts` does for the snapshot insert/listing update pair).
  - Strength: Low-effort; makes the risk visible for a future fix.
  - Tradeoff: Does not eliminate the unrecoverable state.
  - Confidence: HIGH — cosmetic only.
  - Blind spot: None.
- **Decision**: FIXED via Fix A — void snapshot first, listing update second; idempotency comment added

### F3 — Unique constraint violation surfaces as blad-zapisu not juz-zamknieta

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/listings/[id]/close.ts:88–91`
- **Detail**: When two concurrent close requests race past the `status===done` check, the second INSERT hits the `unique_active_snapshot` partial index (Postgres error code `23505`). `close.ts` maps all `insertError` to `blad-zapisu` ("Nie udało się zapisać"), sending the agent a confusing save-failure message for what is actually a double-close attempt.
- **Fix**: Check `insertError.code === "23505"` and redirect to `?error=juz-zamknieta` in that branch: `const slug = insertError.code === "23505" ? "juz-zamknieta" : "blad-zapisu";`
- **Decision**: FIXED — added `insertError.code === "23505"` check mapping duplicate-close to `juz-zamknieta`

### F4 — dashboard.astro renders urlError verbatim (pre-existing)

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `src/pages/dashboard.astro:72`
- **Detail**: `urlError` is rendered verbatim: `{urlError}`. Old siblings (`update.ts`, `delete.ts`) pass raw Supabase error messages via `?error=`. New routes (`close.ts`, `reopen.ts`) correctly use opaque Polish slugs. XSS is not possible (Astro escapes interpolation), but internal DB strings appear in the UI when the old routes fire. Not introduced by this PR — a pre-existing gap that the new code's pattern makes more visible.
- **Fix**: File as follow-up: migrate `update.ts`/`delete.ts` to slug pattern and map known slugs to display strings in `dashboard.astro`.
- **Decision**: FILED as FU-1 in follow-ups/review-fixes.md — migrate update.ts/delete.ts to slug pattern
