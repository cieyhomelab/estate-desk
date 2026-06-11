<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Refactor C2: Close Silent 0-Row UPDATE False-Success

- **Plan**: context/changes/refactor-c2-owned-update/plan.md
- **Mode**: Deep
- **Date**: 2026-06-11
- **Verdict**: REVISE → SOUND (all findings fixed during triage)
- **Findings**: 2 critical | 2 warnings | 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | FAIL |

## Grounding

9/9 paths ✓, symbols ✓ (commission/set.ts:27 silent success confirmed, update.ts:38-49 pattern confirmed, idor.test.ts:71-116 harness confirmed), brief↔plan ✓

## Findings

### F1 — Phase 2B title mismatch between body and Progress

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 2B heading vs. Progress ### heading
- **Detail**: Body said "## Phase 2B: Document and Improve Error Response (if Case B — RLS error confirmed)"; Progress said "### Phase 2B: Improve Error Response (Case B only)". /10x-implement requires exact title match.
- **Fix**: Renamed body heading to match Progress heading.
- **Decision**: FIXED — renamed body Phase 2B heading.

### F2 — Phase 1 automated criteria count mismatch (2 body bullets, 1 checkbox)

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Success Criteria / Automated Verification vs. Progress
- **Detail**: Phase 1 had 2 automated bullets; Progress had 1 checkbox. Second bullet was redundant (implied by first).
- **Fix**: Removed the redundant second bullet from Phase 1 Automated Verification.
- **Decision**: FIXED — removed redundant bullet.

### F3 — Phase 2A references non-existent HTTP integration tests for update.ts

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 2A — Success Criteria / Automated Verification
- **Detail**: No HTTP-level integration test for update.ts exists. listing-persistence.test.ts calls the Supabase SDK directly via service-role, bypassing the route handler. A broken helper refactor could pass type checking and the full suite silently.
- **Fix A ⭐ Applied**: Added writing a cookie-auth HTTP test for update.ts as a sub-step (step 2) of Phase 2A, before the helper migration step (step 3). Updated Progress checkboxes: 2A.1 (typecheck), 2A.2 (new HTTP test passes), 2A.3 (full suite passes after migration), 2A.4 (manual).
- **Decision**: FIXED via Fix A.

### F4 — Phase 2B error code description conflates PGRST116 with RLS violation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2B — Changes Required (Contract note)
- **Detail**: Plan said "typically `42501` / `PGRST116`". PGRST116 is a "zero rows returned" code used as a not-found suppressor in 3 codebase locations — not an RLS violation. 42501 is the correct RLS permission-denied code. Also: Phase 1 comment only recorded the redirect slug, not error.code — which Phase 2B needs.
- **Fix**: Updated Phase 2B Contract to specify `42501` only and explain why PGRST116 is wrong. Updated Phase 1 comment instruction to record both the redirect slug AND the raw `error.code`.
- **Decision**: FIXED.

### F5 — close.ts already has a passing HTTP integration test for the non-owner scenario

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — item 2 (close.ts / reopen.ts)
- **Detail**: idor.test.ts:71-91 already covers the non-owner POST to close, asserts nie-znaleziono, checks DB row unchanged — and passes today. Phase 3 adding another close test would duplicate it.
- **Fix**: Added a note in Phase 3 item 2 clarifying close.ts is already covered; only reopen.ts needs a new integration test. Updated Testing Strategy count to "6 new tests, 7 total including pre-existing close.ts test."
- **Decision**: FIXED.
