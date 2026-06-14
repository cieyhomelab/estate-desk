# Commission Immutability and Split Error Handling — Plan Brief

> Full plan: `context/changes/i-04-commission/plan.md`
> Domain docs: `context/domain/02-invariant-aggregate-refactor.md`

## What & Why

An agent can change `commission_percent` on a closed listing with zero resistance — `commission/set.ts` does an unconditional UPDATE with no status check. This silently diverges `listings.commission_percent` from the locked value in `transaction_snapshots`, corrupting the financial record. A second bug (`close.ts`) calls `calculateCommissionSplit()` without `try/catch`, turning a domain invariant violation into an unhandled 500.

## Starting Point

`commission/set.ts:31` calls `updateOwnedListing()` directly after range validation, never loading the listing or checking its status. `pricing.astro:160` renders the commission form unconditionally. `close.ts:76-81` calls `calculateCommissionSplit()` outside any error boundary. The pattern to follow already exists: `close.ts:32-45` and `reopen.ts:34` both load the listing and check status before acting.

## Desired End State

POSTing to `commission/set` on a `done` listing redirects to `?error=transakcja-zamknieta` and leaves the DB unchanged. The commission form in `pricing.astro` is hidden for closed listings and replaced by a locked-state note. `close.ts` catches any commission split throw and redirects to `?error=blad-prowizji` instead of a 500.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Scope of this branch | I-04 + R-03 | Both are commission bugs, adjacent code, coherent single PR | Plan |
| Implementation approach | Inline status guard (no domain class) | Follows existing pattern in close.ts/reopen.ts; domain class is a separate future change | Domain doc / Plan |
| New integration test | Yes, 3 cases in new file | Mirrors gate-logic.test.ts pattern; catches regression on the exact financial divergence path | Plan |
| R-03 integration test | No (code review only) | calculateCommissionSplit throw is unreachable via HTTP under normal arithmetic; unit test already covers invariant | Plan |

## Scope

**In scope:**
- `commission/set.ts` — status guard before UPDATE
- `pricing.astro` — conditional commission form rendering
- `messages.ts` — two new slugs (`transakcja-zamknieta`, `blad-prowizji`)
- `close.ts` — try/catch around `calculateCommissionSplit()`
- New integration test file `commission-immutability.test.ts`

**Out of scope:**
- `Listing` domain class, `ListingRepository`, `IListingQuery` (separate future change)
- DB-level trigger or RLS policy changes
- `price/set` route, `reopen.ts`

## Architecture / Approach

No new abstractions. Both fixes follow the "load listing → check status → redirect on violation" pattern already established in `close.ts` and `reopen.ts`. The commission form guards at the UI layer as a secondary UX signal (not as the security boundary — the API guard is the enforcer).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. I-04 guard | Commission locked on closed listings, form hidden, new slug | Forgetting to update messages.ts (fallback message would still work, but is generic) |
| 2. R-03 catch | Commission split failure redirects instead of 500 | None — purely defensive; throw is unreachable in practice |

**Prerequisites:** Branch `feature/i-04_commission_fix` (already created)
**Estimated effort:** ~1 session — Phase 1 ~45 min (including test), Phase 2 ~15 min

## Open Risks & Assumptions

- The `try/catch` for R-03 is untestable via HTTP without mocking integer arithmetic — accepted risk; code review is the verification.
- Phase 1 test case 3 (reopen → change → close) exercises `reopen.ts` and `close.ts` in sequence; any regression there would surface.

## Success Criteria (Summary)

- POST `commission/set` on a `done` listing → 302 `?error=transakcja-zamknieta`, `commission_percent` in DB unchanged
- `pricing.astro` on a `done` listing → no commission form rendered
- All existing integration tests remain green
