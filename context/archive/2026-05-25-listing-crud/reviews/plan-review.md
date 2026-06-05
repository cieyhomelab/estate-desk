<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Listing Dashboard CRUD

- **Plan**: `context/changes/listing-crud/plan.md`
- **Mode**: Deep
- **Date**: 2026-05-25
- **Verdict**: SOUND (after fixes)
- **Findings**: 0 critical  2 warnings  2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

6/6 existing paths ✓, 3/3 symbols ✓, brief↔plan ✓
— dashboard.astro ✓, Layout.astro lang="en":14 ✓, supabase.ts ✓, Banner.astro (variant prop) ✓, middleware.ts startsWith ✓, Astro.url.searchParams.get("error") confirmed in signin.astro:5

## Findings

### F1 — npx supabase db push will fail without a prior link step

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — success criteria
- **Detail**: `.supabase/` directory is absent — project has never been linked. `npx supabase db push` requires `npx supabase link --project-ref <ref>` first. The brief mentions 'linked' as a prerequisite but Phase 1 itself had no link step.
- **Fix**: Added Prerequisites block to Phase 1 with the link command and where to find the ref.
- **Decision**: FIXED (prerequisites block added to Phase 1)

### F2 — "Client-side sort" misnomer undermines the plan's no-JS stance

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3, Change #3 — Dashboard page overhaul, Contract
- **Detail**: "Client-side sort before render" in an Astro SSR page; an implementer may introduce a React island or `<script>` tag, contradicting the plan's "no client-side state management" decision.
- **Fix**: Replaced with "Sort the fetched array in the Astro frontmatter (server-side) before rendering."
- **Decision**: FIXED

### F3 — Hardcoded migration filename contradicts the CLI instruction

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Change #1 — file heading
- **Detail**: Plan named `20260525000000_create_listings.sql` but CLI generates its own timestamp. Agent diff-checking could flag the mismatch.
- **Fix**: Replaced with `<timestamp>_create_listings.sql` placeholder.
- **Decision**: FIXED

### F4 — handle_updated_at() defined without CREATE OR REPLACE

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Change #1 contract + Migration Notes
- **Detail**: Without CREATE OR REPLACE FUNCTION, re-running the migration fails with "function already exists." Migration Notes encourage later slices to reuse the function.
- **Fix**: Added CREATE OR REPLACE to the migration contract.
- **Decision**: FIXED
