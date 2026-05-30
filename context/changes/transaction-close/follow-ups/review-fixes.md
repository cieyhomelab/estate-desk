# Follow-ups from Implementation Review

## FU-1 — Migrate error handling in update.ts / delete.ts to slug pattern

**Source**: F4 from impl-review-code.md
**Location**: `src/pages/api/listings/[id]/update.ts`, `src/pages/api/listings/[id]/delete.ts`, `src/pages/dashboard.astro:72`

**What**: `dashboard.astro` renders `{urlError}` verbatim. Old routes (`update.ts`, `delete.ts`) pass raw Supabase error messages through `?error=`. New routes (`close.ts`, `reopen.ts`) use opaque Polish slugs correctly.

**Fix**: Migrate `update.ts` and `delete.ts` to use opaque slugs, then map all known slugs to display strings in `dashboard.astro` (replacing the verbatim render).

**Why now**: The new slug pattern is established — this is cleanup to make the old routes consistent.
