# EstateDesk — Recurring Lessons

Lessons captured from implementation reviews. Each entry records a rule, its origin, and why it matters.

---

## L1 — 0-row UPDATE must be detected and treated as not-found

**Rule**: Every `listings` UPDATE that filters by `user_id` must append `.select()` and check `data.length === 0`. A 0-row UPDATE under Supabase RLS returns `error === null` (silent success) — the route has no indication that no row was mutated. Without the check, non-owner POSTs falsely redirect with a success slug.

**Use `updateOwnedListing`** from `src/lib/owned-mutation.ts`, which encapsulates this check and returns a discriminated union. Do not inline the `.update().eq().eq()` pattern without it.

**Origin**: Deliberately specified in listing-crud `plan.md:148` ("If the update affects 0 rows … redirect to `/dashboard?error=…`"). An implementation review (F5, `context/archive/2026-05-25-listing-crud/reviews/impl-review.md:84-101`) warned that sibling routes invited wrong-direction cleanup. This lesson was deleted and the drift went unchecked in later routes (`commission/set`, `documents/override`, `documents/[docId]/toggle`, `price/set`). Restored in refactor-c2-owned-update Phase 3.

**Exception**: `delete.ts` intentionally treats 0-row deletes as success (idempotent — double-delete is not an error, per plan). Tables other than `listings` must apply the equivalent inline `.select()` + length check (see `documents/[docId]/toggle.ts`).
