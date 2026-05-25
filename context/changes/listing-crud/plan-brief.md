# Listing Dashboard CRUD — Plan Brief

> Full plan: `context/changes/listing-crud/plan.md`

## What & Why

S-02 builds the first real data slice: a CRUD-capable listing dashboard replacing the current placeholder page. The agent needs to create and manage property listings (sprzedaż / najem okazjonalny) with owner contact data — the `listings` table established here is the dependency every later slice (pricing, contacts, documents, transaction close) builds on.

## Starting Point

The app is deployed and auth is working (S-01 complete). Supabase is configured but has no application tables yet — `supabase/migrations/` is empty. The `/dashboard` route exists but shows only the agent's email and a logout button.

## Desired End State

The agent can log in, see a card grid of their listings on `/dashboard`, create new listings (address + type + optional owner data), edit them, and delete them with a Polish confirmation prompt. All UI is in Polish. The `listings` table exists in Supabase with RLS enforcing per-user isolation.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Schema scope | Listings-only migration inside S-02 | Slice-by-slice schema avoids a big-bang F-01 upfront; subsequent slices add their own tables | Plan |
| Owner data | Columns on listings table | Simpler; FR-008 treats owner as a listing attribute, not an independent entity | Plan |
| Listing identifier | `address` freetext field | Matches real-estate practice; property address is the natural primary label | Plan |
| Form flow | Dedicated `/dashboard/listings/new` page | Follows existing auth form pattern; no client-side complexity | Plan |
| Dashboard UI | Card grid | Visual, mobile-friendly; matches listing conventions | Plan |
| Delete | Hard delete with Polish confirmation | PRD doesn't require recoverability for deletion; MVP scope | Plan |
| API pattern | Astro API routes + form POST | Consistent with existing codebase; no new dependencies | Plan |

## Scope

**In scope:** `listings` table migration (with RLS + trigger), TypeScript `Listing` types, 3 API routes (create / update / delete), dashboard card grid, new listing page, edit listing page, `lang="pl"` fix in Layout.

**Out of scope:** pricing, commission, contacts, documents, photos, "done" status transition (S-06), Zod validation, soft delete.

## Architecture / Approach

Server-side Astro SSR throughout — no React islands or client-side state needed for this slice. Dashboard page fetches listings at request time via Supabase. Forms POST to API routes which redirect on success/failure. Delete is an inline `<form>` with a `confirm()` call — no modal component required. RLS on `listings` guarantees each agent only ever sees their own rows.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. DB migration | `listings` table, RLS policy, auto-`updated_at` trigger | Supabase CLI must be authenticated and linked to the remote project |
| 2. API routes | Create / update / delete endpoints + TypeScript types | Ownership check (`.eq('user_id', user.id)`) must be in every mutating query |
| 3. Dashboard + pages | Full CRUD UI in Polish | Every user-visible string must be in Polish — easy to miss in error messages |

**Prerequisites:** Supabase CLI authenticated (`npx supabase login`) and linked (`npx supabase link`)
**Estimated effort:** ~1–2 sessions across 3 phases

## Open Risks & Assumptions

- Migration assumes `npx supabase db push` pushes directly to the remote project (no local Docker Supabase in use)
- Active-first sorting is done in application code after fetching — fine for MVP (<100 listings per agent)
- `handle_updated_at()` function created in this migration is reused by later slices; don't redefine it in S-03+

## Success Criteria (Summary)

- Agent can create a listing, see it on the dashboard, edit it, and delete it — full cycle works end-to-end
- All UI text is in Polish (`lang="pl"` in HTML, no English strings)
- RLS enforced: agent A's listings are not visible or mutable by agent B
