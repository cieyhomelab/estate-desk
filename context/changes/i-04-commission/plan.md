# Commission Immutability and Split Error Handling

## Overview

Fix two commission-related invariant violations identified in `context/domain/01-domain-distillation.md` (R-03, R-04) and fully diagnosed in `context/domain/02-invariant-aggregate-refactor.md` (I-04, I-06):

1. **I-04**: `commission/set.ts` performs an unconditional UPDATE with no `listing.status` check — an agent can silently diverge `listings.commission_percent` from the locked `transaction_snapshots.commission_percent`.
2. **R-03**: `close.ts` calls `calculateCommissionSplit()` without `try/catch` — the invariant throw produces an unhandled 500 instead of a readable redirect.

## Current State Analysis

- `src/pages/api/listings/[id]/commission/set.ts:31` — `updateOwnedListing(supabase, id, user.id, { commission_percent })` is unconditional. No status load, no guard. Verified.
- `src/pages/dashboard/listings/[id]/pricing.astro:160` — commission `<form>` renders regardless of `listing.status`. Verified.
- `src/pages/api/listings/[id]/close.ts:76-81` — `calculateCommissionSplit()` is called outside any `try/catch`. Verified.
- `src/lib/messages.ts` — slugs `transakcja-zamknieta` and `blad-prowizji` are absent. Verified.
- `src/pages/api/listings/[id]/close.ts:43` and `reopen.ts:34` — both already load the listing and check `status` before acting. This is the existing pattern to follow.
- `src/integration/api/gate-logic.test.ts` — establishes the integration test shape: seed via service role, POST via `fetch(..., { redirect: "manual" })`, assert on 302 location slug + DB state.

## Desired End State

- POSTing to `commission/set` with a `done` listing redirects to `?error=transakcja-zamknieta` and leaves `commission_percent` in the DB unchanged.
- The commission form in `pricing.astro` is hidden for `done` listings and replaced by a static locked-state message.
- `close.ts` catches any throw from `calculateCommissionSplit()` and redirects to `?error=blad-prowizji` instead of surfacing a 500.
- Both new slugs have human-readable Polish messages in `messages.ts`.

### Key Discoveries

- `close.ts:43` already guards `status === "done"` before the snapshot insert — the pattern to follow in `commission/set.ts` is identical: SELECT status, check, redirect if blocked.
- `commission/set.ts` does not load the listing at all before the UPDATE. The fix requires adding a `SELECT id, status` query that follows the ownership filter (`eq("user_id", user.id)`) already used by `close.ts`.
- `getFlashMessage()` in `messages.ts` returns a fallback for unknown slugs — adding new slugs is additive with no risk of breaking existing messages.
- `calculateCommissionSplit()` uses integer centgrosz arithmetic with `Math.round()`, so the throw at `commission.ts:29` is a defensive invariant assertion that cannot be triggered via normal HTTP input. The `try/catch` in `close.ts` is a safety net, not a hot path — no integration test for the throw path is warranted.

## What We're NOT Doing

- No `Listing` domain class, `ListingRepository`, or `IListingQuery` — those are Phase 2–4 from the domain plan and belong in a separate change.
- No changes to `reopen.ts` — it already correctly guards `status === "active"` (line 34).
- No DB-level trigger or RLS policy changes — those are I-08 scope.
- No change to the `price/set` route — price history doesn't feed into the snapshot in the same way.

## Implementation Approach

Follow the existing pattern in `close.ts`: load the listing with an ownership-filtered SELECT, check `status`, redirect with a domain-specific slug on violation, otherwise proceed. Same approach in `commission/set.ts`. No new abstractions.

---

## Phase 1 — I-04: Block commission change on closed listings

### Overview

Add a status guard to `commission/set.ts`, hide the commission form in `pricing.astro` for done listings, and add the new flash slug to `messages.ts`.

### Changes Required

#### 1. Commission API route — add status guard

**File**: `src/pages/api/listings/[id]/commission/set.ts`

**Intent**: Before the `updateOwnedListing` call, load the listing (SELECT id + status with user ownership filter). If `status === "done"`, redirect to `?error=transakcja-zamknieta` and return early. This mirrors exactly the pattern at `close.ts:32-45`.

**Contract**: The SELECT must use `.eq("user_id", user.id)` (ownership) and `.single()`. If the query returns an error or null, redirect to `/dashboard/listings/${id}/pricing?error=nie-znaleziono` (mirrors the existing commission/set.ts redirect pattern at line 34). The guard redirects to `pricing?error=transakcja-zamknieta`. The existing `updateOwnedListing` call at line 31 stays in place and only executes when `status === "active"`.

---

#### 2. Pricing page — hide form for done listings

**File**: `src/pages/dashboard/listings/[id]/pricing.astro`

**Intent**: The commission `<form>` at line 160 should only render when `listing.status === "active"`. For `done` listings, replace it with a one-line locked-state paragraph.

**Contract**: Wrap lines 160–183 (the form) in `{listing.status === "active" ? (<form>...</form>) : (<p class="text-sm text-white/45">Prowizja zablokowana — transakcja jest zamknięta.</p>)}`. The `listing` variable is already available from the SSR query at line 42. The current commission value display at line 153–159 (the `listing.commission_percent` paragraph) stays visible unconditionally.

---

#### 3. Flash messages — add transakcja-zamknieta slug

**File**: `src/lib/messages.ts`

**Intent**: Add the new slug so `getFlashMessage("transakcja-zamknieta")` returns a Polish message instead of the generic fallback.

**Contract**: Add to the `messages` record: `"transakcja-zamknieta": "Nie można zmienić prowizji — transakcja jest już zamknięta."`.

---

### Success Criteria

#### Automated Verification

- Type check passes: `npx tsc --noEmit`
- Integration test for I-04 passes (new file — see Testing Strategy): `npx vitest run src/integration/api/commission-immutability.test.ts`
- Full integration suite green: `npx vitest run src/integration/`

#### Manual Verification

- Navigate to a `done` listing's pricing tab — commission form is absent, locked-state text is visible
- Attempt to POST `commission/set` on a done listing via devtools or curl — receives 302 to `?error=transakcja-zamknieta`; DB value is unchanged
- Navigate to an `active` listing's pricing tab — commission form renders and saves normally

---

## Phase 2 — R-03: Catch commission split invariant failure in close

### Overview

Wrap `calculateCommissionSplit()` in `close.ts` with `try/catch` and add the `blad-prowizji` slug to `messages.ts`.

### Changes Required

#### 1. Close route — wrap commission split in try/catch

**File**: `src/pages/api/listings/[id]/close.ts`

**Intent**: The block at lines 75–87 calls `calculateCommissionSplit()` which throws `Error("Commission invariant violated…")` on rounding mismatch. Wrap that block so any throw redirects to `?error=blad-prowizji` instead of surfacing as an unhandled 500.

**Contract**: Wrap the existing `if (listing.asking_price !== null && ...) { const split = calculateCommissionSplit(...); ... }` block in a `try/catch (e)`. On catch, return `context.redirect(`/dashboard/listings/${id}/close?error=blad-prowizji`)`. The variables `brutto`, `agency_amount`, etc. are declared with `let` above the block (lines 69–73), so they remain in scope for the snapshot INSERT at line 89.

---

#### 2. Flash messages — add blad-prowizji slug

**File**: `src/lib/messages.ts`

**Intent**: Add the new slug so `getFlashMessage("blad-prowizji")` returns a readable message if the catch path is ever reached.

**Contract**: Add to the `messages` record: `"blad-prowizji": "Błąd wyliczenia prowizji. Sprawdź stawki w ustawieniach i spróbuj ponownie."`.

---

### Success Criteria

#### Automated Verification

- Type check passes: `npx tsc --noEmit`
- Full integration suite still green: `npx vitest run src/integration/`

#### Manual Verification

- Close a listing with commission settings configured — success flow unchanged
- Verify the new `catch` branch is present in the compiled route (code review is sufficient; the throw path cannot be triggered via HTTP under normal arithmetic)

---

## Testing Strategy

### New Integration Test

**File**: `src/integration/api/commission-immutability.test.ts`

Follow the pattern established in `gate-logic.test.ts` (service role seed, `fetch` with `redirect: "manual"`, assert 302 location + DB state).

Three cases:

1. **Active listing → commission change succeeds**: Seed listing with `status = "active"`, POST `commission_percent=3`. Assert redirect contains `success=prowizja-zapisana` and `listings.commission_percent === 3` in DB.
2. **Done listing → commission change blocked**: Seed listing with `status = "done"` and a closed snapshot. POST `commission_percent=5`. Assert redirect contains `error=transakcja-zamknieta` and `listings.commission_percent` is unchanged in DB.
3. **Reopen → commission change → close sequence**: Seed done listing, POST reopen, POST `commission_percent=3`, POST close (with `override_confirmed=true` in the body — bypasses the document gate so unchecked trigger-seeded docs don't block the close). Assert new snapshot has `commission_percent = 3`. Validates the full lifecycle without divergence.

### Unit Tests

No new unit tests required — `commission.test.ts` already covers the `calculateCommissionSplit()` invariant throw. The `try/catch` addition is a transport-layer wrapper, not new business logic.

## References

- Domain distillation: `context/domain/01-domain-distillation.md` (R-03, R-04)
- Invariant refactor plan: `context/domain/02-invariant-aggregate-refactor.md` (I-04, I-06)
- Pattern reference: `src/pages/api/listings/[id]/close.ts:32-45` (existing status guard)
- Test pattern reference: `src/integration/api/gate-logic.test.ts`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: I-04 — Block commission change on closed listings

#### Automated

- [x] 1.1 Type check passes: `npx tsc --noEmit` — ffa0688
- [x] 1.2 New integration test passes: `npx vitest run src/integration/api/commission-immutability.test.ts` — ffa0688
- [x] 1.3 Full integration suite green: `npx vitest run src/integration/` — ffa0688

#### Manual

- [x] 1.4 Done listing pricing tab shows locked-state text, no form — ffa0688
- [x] 1.5 POST to commission/set on done listing → 302 `?error=transakcja-zamknieta`, DB unchanged — ffa0688
- [x] 1.6 Active listing commission form saves normally — ffa0688

### Phase 2: R-03 — Catch commission split invariant failure in close

#### Automated

- [x] 2.1 Type check passes: `npx tsc --noEmit`
- [x] 2.2 Full integration suite green: `npx vitest run src/integration/`

#### Manual

- [ ] 2.3 Close a listing with commission settings — success flow unchanged
- [ ] 2.4 try/catch block is present in close.ts (code review)
