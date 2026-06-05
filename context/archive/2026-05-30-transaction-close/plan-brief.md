# Transaction Close — Plan Brief

> Full plan: `context/changes/transaction-close/plan.md`

## What & Why

S-06 is the north-star slice: the minimum viable flow that proves EstateDesk's core hypothesis. It lets an agent mark a listing as "done" after the document gate clears, locks the commission split into a permanent snapshot, records notary details and transaction date, and lets the agent reopen if the deal collapses. Without this, every upstream slice (listing CRUD, pricing, documents) is unproven infrastructure.

## Starting Point

The `listings` table already has a `status` column constrained to `('active', 'done')`. S-05 (documents-and-files) adds `listing_documents.is_checked` and `listings.checklist_override` — the two gate inputs S-06 reads. Commission is display-only in pricing.astro; no snapshot or lock exists. No close page, no close API route, no `transaction_snapshots` table.

## Desired End State

From the dashboard, the agent clicks "Zamknij transakcję" on a listing card, reaches the close page, sees a gate status (all docs ready, or N items missing with an override option), fills in notary name, city, and transaction date, and submits. The listing flips to `'done'`, the commission split is frozen in `transaction_snapshots`, and the dashboard card shows "Zysk agenta: X zł". If the deal falls through, "Wznów transakcję" restores active status and voids the snapshot — all data preserved.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Close flow location | Dedicated `/close` page in listing chain | Consistent with existing Edit → Pricing → Documents chain; gives the gate, form, and commission preview room to breathe | Plan |
| Commission locking | New `transaction_snapshots` table | Permanent audit trail — rates can change later; snapshot preserves what was locked at close | Plan |
| Notary fields | `notary_name` + `notary_city` (2 fields) | Covers FR-017 "name and details" without overkill; no notary contact data used elsewhere in the app | Plan |
| Transaction date | `date` only (no time) | Polish real estate closings are day-dated; avoiding timezone complexity on Cloudflare Workers | Plan |
| Gate UX | Inline on close page: blocked state + override checkbox | Agent sees what's missing and can act or bypass without leaving the close page | Plan |
| Override mechanism | One-shot `override_confirmed` form field (independent of `checklist_override`) | Close page is self-contained; doesn't mutate S-05's persistent override flag | Plan |
| Reopen data | Preserve all; mark snapshot `voided_at = now()` | Full audit trail; notary data pre-fills next close attempt if deal revives | Plan |
| No-commission close | Allow; snapshot stores NULL financial fields | Blocking would be too rigid — some deals are pro bono or structured differently | Plan |
| Done card display | Replace commission badge with "Zysk agenta: X zł" from snapshot | Immediate visible payoff of the close flow; clean active vs. done distinction | Plan |
| Transaction notes | Optional `transaction_notes` text field | Low schema cost; agents need a catch-all for close-time context; voided snapshots benefit from reopen reason | Plan |

## Scope

**In scope:**
- DB migration: 5 new columns on `listings`, `transaction_snapshots` table with RLS
- `close.astro` page (active state: gate + form; done state: locked summary + reopen)
- `/api/listings/[id]/close.ts` and `/api/listings/[id]/reopen.ts`
- ListingCard: "Zamknij transakcję" for active, "Wznów" for done, locked agent_net display
- Dashboard snapshot fetch for done listings

**Out of scope:**
- Atomic DB transaction (sequential INSERT + UPDATE; orphan risk accepted)
- Commission gate (no-commission close allowed with warning)
- Multiple close/reopen history (voided snapshots accumulate silently)
- PDF or export of transaction summary
- Clearing notary/date on reopen

## Architecture / Approach

S-06 is purely additive — no existing tables are modified beyond new nullable columns. The close API reads from S-05's tables (`listing_documents`, `listings.checklist_override`) without touching them. Commission computation replicates the `pricing.astro` algorithm server-side to produce a frozen snapshot. The dashboard requires one extra query for done listing snapshots (N done IDs → one batch query → Map for O(1) card lookup).

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. DB Migration + Types | Schema foundation; all tables and types ready | Migration timestamp collision with S-05 — adjust to `supabase db diff` output |
| 2. Close Flow | Agent can close a listing from the card; snapshot written; done-state visible | Commission rounding must match pricing.astro exactly |
| 3. Reopen + Display | Agent can reopen; dashboard shows locked earnings | Two-query pattern for snapshot fetch must respect `.limit()` |

**Prerequisites:** S-05 fully applied in the DB (for gate logic); `commission_settings` configured (for meaningful snapshot values)
**Estimated effort:** ~3 sessions across 3 phases

## Open Risks & Assumptions

- S-05 must be complete before Phase 2 can be tested end-to-end. If S-05 runs in parallel, Phase 1 of S-06 can proceed independently.
- Sequential INSERT + UPDATE in the close API creates an accepted orphan risk: if the listing UPDATE fails after the snapshot INSERT succeeds, the listing stays active but an orphaned snapshot exists. Identifiable via `voided_at IS NULL` + `listing.status = 'active'`.
- `commission_settings` may not exist for the user at close time (agent never configured rates). The snapshot stores NULL financials — handled gracefully in display.

## Success Criteria (Summary)

- Agent completes the full close flow end-to-end: document gate → notary form → submit → listing shows "done" with locked commission on the card
- Commission values in the snapshot match what pricing.astro displayed before close (no rounding discrepancy)
- Reopen restores the listing to active with all data intact and snapshot marked voided
