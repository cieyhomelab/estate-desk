# Refactor C2: Close Silent 0-Row UPDATE False-Success — Plan Brief

> Full plan: `context/changes/refactor-c2-owned-update/plan.md`
> Research: `context/changes/refactor-opportunities/research.md`

## What & Why

Four API routes (`commission/set`, `documents/override`, `documents/toggle`, `price/set`)
report `?success=` when their `listings` UPDATE matches 0 rows — a wrong-owner or missing-ID
write silently appears to succeed. The correct shape (`.select()` + `data.length === 0` →
error) already exists in `update.ts`, was deliberately designed, and was protected by a
lesson that has since been deleted from disk. This plan restores a known-correct convention.

## Starting Point

`update.ts:38-49` is the in-repo reference implementation: it appends `.select()` and checks
`data.length === 0`. The 4 vulnerable routes and 2 surface-narrowed routes (`close`, `reopen`)
never adopted this pattern after it was established. The `context/foundation/lessons.md` that
captured the rule no longer exists on disk.

## Desired End State

No API route reports success on a 0-row UPDATE. All 6 affected routes are guarded and covered
by cookie-auth integration tests (non-owner POST → correct error slug + unchanged DB row). The
lesson is restored to `context/foundation/lessons.md` so future routes can't repeat the drift.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Phase ordering | Characterization test first | Open Q1 (RLS runtime behavior) must be answered before choosing the structural target | Plan |
| Phase 2 branching | Plan both Case A and Case B up front | Avoids mid-flight replanning; the plan is complete before implementation starts | Plan (session) |
| Helper vs inline | Case A: extract `updateOwnedListing` helper; Case B: error-code mapping | Helper makes the pattern the default call site; if RLS already guards, structural change is unnecessary | Plan |
| P3 bug fix | Not included | Separate one-liner; keeping plans structurally clean | Plan (session) |
| lessons.md restoration | Yes — Phase 3 | This is how the drift happened; restoring the lesson is part of closing the debt | Plan |

## Scope

**In scope:**
- Characterization test (Phase 1)
- `updateOwnedListing` helper OR error-code discrimination (Phase 2, conditional)
- Adopt across: `commission/set`, `documents/override`, `documents/toggle`, `price/set`, `close`, `reopen`
- One integration test per route
- Restore `context/foundation/lessons.md` rule

**Out of scope:**
- `auth/*` public routes, `middleware.ts`
- Shared `withAuth` HOF (C4)
- Validation layer (C5), flash messages (C3)
- P3 `undefined`-in-URL bug

## Architecture / Approach

Phase 1 is a characterization test only — it pins behavior without changing it. Phase 2A
(silent success confirmed) extracts the `update.ts` pattern into a shared helper adopted first
in `update.ts` itself to prove equivalence via existing tests. Phase 2B (RLS error confirmed)
adds error-code discrimination to distinguish "not found" from genuine DB errors. Phase 3
applies the chosen fix route-by-route, each guarded by a new integration test before moving to
the next route.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Characterization Test | Resolves Open Q1; determines Phase 2 branch | Test setup complexity (cookie-auth harness) |
| 2A. Extract Helper (Case A) | `updateOwnedListing` helper adopted in `update.ts`; equivalence proven | Discriminated-union return type complexity |
| 2B. Improve Error Response (Case B) | Error-code mapping for `nie-znaleziono`; UX improvement | RLS error code varies by Supabase version |
| 3. Route Adoption | All 6 routes guarded; lesson restored | Each route needs its own integration test |

**Prerequisites:** Cookie-auth harness (`idor.test.ts` + `helpers/auth.ts`) working — already confirmed in CI.
**Estimated effort:** ~2-3 sessions across 4 phases (3 logical: test → helper/mapping → spread).

## Open Risks & Assumptions

- Open Q1 is genuinely unknown — the plan handles both branches, but Phase 2 cannot start until Phase 1 runs.
- The RLS error code for 0-row UPDATE may differ from other error types; needs verification in Phase 2B.
- `close.ts` and `reopen.ts` have more complex control flow than the 4 pure-UPDATE routes; integration tests for them may require more setup.

## Success Criteria (Summary)

- No route reports `?success=` on a 0-row UPDATE (verified by 7 cookie-auth integration tests).
- All 6 routes still work correctly on the happy path (manual verification).
- `context/foundation/lessons.md` documents the 0-row=error rule with its origin.
