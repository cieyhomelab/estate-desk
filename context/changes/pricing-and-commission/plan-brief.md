# Pricing and Commission (S-03) — Plan Brief

> Full plan: `context/changes/pricing-and-commission/plan.md`
> Research: `context/changes/pricing-and-commission/research.md`

## What & Why

Implement S-03: asking price tracking with history, per-user commission rate configuration, and a server-side commission split calculator. This is the feature that lets an agent see at a glance what a deal will net them after agency and tax — and eliminates the manual spreadsheet calculation that currently causes errors. S-06 (transaction close, the north star) depends on S-03 because the commission is locked at close.

## Starting Point

One migration exists (`20260525152607_create_listings.sql`) with the `listings` table. No price column, no commission tables. The `handle_updated_at()` trigger function is declared as `CREATE OR REPLACE` and ready to attach to new tables. All S-02 patterns (auth-first API routes, `.order().limit()` queries, redirect-based error surfacing) are in place and must be followed exactly.

## Desired End State

The agent can set and update a listing's asking price; the full price timeline is visible on the listing's pricing page, and the latest price appears on each dashboard card. The agent configures tax rate and agency percentage once in account settings. On any listing's pricing page, entering a commission total instantly renders the split (agency portion → gross income → tax provision → agent net), server-rendered and always arithmetically exact.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Commission formula | PRD prose: agency first, then tax on remainder | Matches PRD §Business Logic literally; more favorable to the agent (tax base is smaller) | Plan (user confirmed) |
| Price storage | Denormalized `asking_price` on `listings` + `price_history` as audit log | Dashboard query stays simple — no JOIN needed to show current price on every card | Plan (user confirmed) |
| Rounding policy | Float arithmetic rounded to 2 decimal places; integer grosz internally | Integer grosz avoids floating-point drift; sum is algebraically exact by construction | Plan (user confirmed) |
| Commission settings UI | Dedicated `/dashboard/settings/commission` page | PRD FR-012 says "account settings" — separate from listing-specific pages | Plan (user confirmed) |
| Commission rate defaults | `tax_rate=0`, `agency_percent=0`; CHECK constraint 0–100 | Agent must set rates explicitly; pre-filling with guesses risks wrong calculations | Plan (user confirmed) |
| Commission empty state | Inline notice + link to settings on pricing page | Pricing still works without commission config; agent is guided, not blocked | Plan (user confirmed) |
| Price history display | All entries DESC, LIMIT 100 | Matches dashboard pattern; realistic usage won't approach 100 entries per listing | Plan (user confirmed) |
| Commission total save | Not saved in S-03 | Locking commission happens in S-06 (transaction close) — S-03 is display only | Research / Roadmap |

## Scope

**In scope:**
- Migration: `commission_settings`, `price_history` tables + `asking_price` column on `listings`
- `src/types/pricing.ts` (CommissionSettings, PriceHistoryEntry)
- Update `src/types/listings.ts` (add `asking_price`)
- `/dashboard/settings/commission` page + POST API route
- `/dashboard/listings/[id]/pricing` page + `price/set` POST API route
- Dashboard card: show current asking price
- Dashboard nav: add settings link
- Edit page: add link to pricing page

**Out of scope:**
- Commission total persistence (S-06)
- Client-side JS (calculator is server-rendered via GET param)
- Pagination for price history
- Settings index page (commission is the only settings page in MVP)
- Unit test files (none in S-02 baseline)

## Architecture / Approach

Three phases in dependency order, all following S-02's established pattern: plain HTML forms, redirect-based error surfacing, auth-before-validation in every API route, `.order().limit()` on every list query. The commission calculator is a pure server-side computation in Astro page frontmatter using integer grosz arithmetic — no new JS libraries, no client state. The settings page uses `.maybeSingle()` (not `.single()`) since no row is the valid first-visit state.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Database migration + types | Two new tables, `asking_price` column, TypeScript types | Migration must follow all 8 lesson rules; `handle_updated_at()` must not be redeclared |
| 2. Commission settings | `/dashboard/settings/commission` page + API, nav link | Upsert must use `onConflict: 'user_id'` — no separate existence check |
| 3. Listing pricing page | Pricing page, price-set API, dashboard card price, edit page link | Two sequential writes (price_history + listings) are not atomic — acceptable for MVP |

**Prerequisites:** S-02 complete (confirmed via impl-review); Supabase local stack running for migration verification.
**Estimated effort:** ~2 sessions across 3 phases (Phase 1: ~30 min; Phase 2: ~45 min; Phase 3: ~60 min).

## Open Risks & Assumptions

- The two writes in `price/set.ts` (INSERT price_history, then UPDATE listings) are not wrapped in a transaction. If the UPDATE fails, `price_history` has a row that `listing.asking_price` doesn't reflect. Risk is low (the agent's own request, the listing exists, ownership is validated), and a retry syncs them.
- `handle_updated_at()` relies on the first migration having run. If the DB is ever reset without replaying all migrations in order, this will fail. Standard Supabase migration practice; not a new risk.

## Success Criteria (Summary)

- Agent can set a price, see the history update, and see the price on the dashboard card — round trip in one browser session
- Commission calculator produces exact splits for clean rates (50% + 20%) and odd rates (33.33% + 19%)
- Commission settings saved in one session are present on next login
