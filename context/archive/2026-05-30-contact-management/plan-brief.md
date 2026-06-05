# Contact Management — Plan Brief

> Full plan: `context/changes/contact-management/plan.md`

## What & Why

Add the ability to record and view interested-party contacts (buyers/tenants) per listing — FR-013 (add) and FR-014 (view). Agents need to track who has expressed interest in a property; without this, deal pipeline data stays in emails and spreadsheets instead of EstateDesk.

## Starting Point

The `listings` table is complete and serves as the FK parent. The `price_history` table has already established the subquery RLS ownership pattern for listing-child tables. API route and Astro page patterns are well-established across S-02 and S-03. No contacts code exists anywhere — clean greenfield.

## Desired End State

A logged-in agent clicks 'Kontakty' on a listing card, lands on `/dashboard/listings/[id]/contacts`, fills in name (required) plus optional phone, email, and role (kupujący/najemca), and sees all contacts for that listing in a chronological list. Individual contacts can be hard-deleted with a Polish confirmation prompt.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Role field | Nullable, free choice (kupujący/najemca) | Roadmap explicitly calls out buyer/tenant distinction; free choice avoids blocking agents with non-standard situations | Plan |
| Delete support | Yes, hard delete | PRD only says add+view, but without delete agents are stuck with entry mistakes | Plan |
| Add form location | Inline on contacts page (form + list) | Matches `pricing.astro` pattern; fewer navigation steps; agent sees existing contacts while adding | Plan |
| Phone/email validation | Non-empty string only | Agents enter Polish numbers in varied formats; rigid regex would reject valid inputs; consistent with owner fields in listings | Plan |
| Dashboard card link | Add 'Kontakty' link to ListingCard | One-click access from dashboard; consistent with how 'Cena i prowizja' was added | Plan |

## Scope

**In scope:**
- `contacts` table (Supabase migration) with `name`, `phone`, `email`, `role`, FK to `listings`, subquery RLS
- `src/types/contacts.ts` — Contact interface
- Create and delete API routes under `/api/listings/[id]/contacts/`
- `/dashboard/listings/[id]/contacts.astro` — inline form + contact list
- 'Kontakty' link added to `ListingCard.astro`

**Out of scope:**
- Editing existing contacts (delete + re-add for corrections)
- Role validation against listing type
- Phone/email format validation
- Contact list pagination (LIMIT 100 ceiling)
- Contact count badge on ListingCard

## Architecture / Approach

Same three-phase pattern as all prior slices. `contacts` is a child table of `listings` — ownership is established via the `listing_id → listings.user_id` subquery RLS (identical to `price_history`). No `updated_at` trigger (append-only). API routes POST form data and redirect with Polish error codes; no JSON responses. Astro SSR throughout — no React islands.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Contacts database migration | `contacts` table, subquery RLS, role CHECK constraint | RLS subquery must be verified manually — a missing policy silently exposes data |
| 2. Server data layer | Contact type, create + delete API routes | Cross-user delete must be blocked by RLS — verify with two-user test |
| 3. Contacts page + card link | `/dashboard/listings/[id]/contacts`, 'Kontakty' on ListingCard | Chronological ordering must be pushed to DB query, not sorted client-side |

**Prerequisites:** S-02 (listing-crud) complete — `listings` table must exist as the FK parent  
**Estimated effort:** ~1 session across 3 phases

## Open Risks & Assumptions

- RLS subquery ownership is the primary security guard; the application layer does not independently verify listing ownership in the create API route (RLS handles it). If RLS is misconfigured, direct API calls could insert contacts into other users' listings.
- No server-side email/phone validation — invalid formats will be stored as-is.

## Success Criteria (Summary)

- Agent can add a contact with name+role+phone+email to a listing and see it appear in the list
- Agent can delete a contact with a Polish confirmation
- 'Kontakty' link visible on every listing card on the dashboard
