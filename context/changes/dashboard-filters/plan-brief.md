# Dashboard Filters — Plan Brief

> Full plan: `context/changes/dashboard-filters/plan.md`
> PRD: `context/foundation/prd.md` — US-01, FR-001–005
> Roadmap: `context/foundation/roadmap.md` — S-01

## What & Why

The `Filtry` button on the Dashboard is a stub — clicking it does nothing. The agent has no way to narrow the listing list by status, price, or city without scrolling through everything. This plan wires the button to a live filter bar that narrows the listing list client-side, with no page reload and no additional database queries.

## Starting Point

`dashboard.astro` already loads all listings from Supabase once and renders them as a static Astro loop. The `Filtry` and `Eksport` buttons exist in HTML with no handlers; `ListingCard` is a pure Astro component. There is no dedicated city field — the city filter will match against the `address` field.

## Desired End State

The agent clicks Filtry, an inline filter bar expands below the button row, and the listing grid narrows instantly as they set Status (Wszystkie / Aktywne / Zamknięte), Cena od/do (numeric range), or Miasto (free-text substring on `address`). The "Twoje oferty (N)" count updates to "X z N" format while filters are active. A count badge on the Filtry button shows how many filter dimensions are active. Closing the bar resets all inputs. The stats grid always reflects all listings regardless of filter state.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Interactive rendering approach | React island (`client:load`) | Filter state must live client-side; React island is the established pattern for interactive islands in this Astro project. | Roadmap / Plan |
| Island boundary | Button row + filter bar + listing grid | Filter state and the Filtry button must co-exist — no cross-Astro/React event wiring needed. | Plan |
| Stats grid | Stays in Astro, always shows totals | Server-computed totals are the overview — filtering is a view tool, not a stats tool. | Plan |
| Count label when filtering | "X z N" format | Agent immediately sees match count vs total without counting cards. | Plan |
| Active filter badge | Yes — count badge on Filtry button | Low cost, high signal: tells the agent filters are on even when the bar is closed. | Plan |
| Collapse behavior | Collapse resets all inputs | Simpler and predictable — collapse-as-dismiss pattern; PRD settled this. | PRD |
| City filter | Substring match on `address` field | No dedicated city field exists; agent entered these addresses themselves. | PRD / Roadmap |
| Stats grid behavior on filter | Unaffected (server-static) | Stats are an all-listings overview; re-computing them client-side adds complexity with minimal benefit. | Plan |

## Scope

**In scope:**
- `ListingCard.tsx` — React twin of the existing Astro card
- `DashboardListings.tsx` — React island owning the filter bar and listing grid
- `dashboard.astro` — wire the island in; keep stats + banners in Astro
- Filter by status, price range, city
- Active filter count badge on Filtry button
- "X z N" count label when filters are active

**Out of scope:**
- Eksport (S-02 — separate change), Help page (S-03 — separate change)
- URL-based filter state persistence
- Server-side filtering (additional Supabase queries)
- Exporting the filtered subset
- Any changes to auth, form saves, or listing sub-pages

## Architecture / Approach

`dashboard.astro` keeps the stats grid (server-rendered with full listing data) and banner messages. Everything from the button row downward is replaced with a `<DashboardListings client:load listings={listings} snapshotMap={snapshotRecord} />` island. The island holds all filter state internally. The `snapshotMap` is converted from `Map` to a plain object before being passed as a prop (Maps don't serialize across the Astro→React boundary). A new `ListingCard.tsx` mirrors the existing Astro card so the island can render listing cards.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. ListingCard React Component | `ListingCard.tsx` — visual and functional twin of the Astro card | Delete confirmation behavior must exactly match the existing native `window.confirm()` flow |
| 2. DashboardListings React Island | Full filter UI with state management, badge, and count label | Filter predicate correctness across all combinations of the four inputs |
| 3. Dashboard Astro Wiring | Replace static Astro section with the island; verify no-filter parity | The no-filter render must be visually identical to the current dashboard — regression risk |

**Prerequisites:** None — the Supabase data layer, auth, and Astro/React setup are all in place.  
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- The `address` field always contains city information in a form the agent recognizes to type back — this is a safe assumption per the roadmap, since the agent entered those addresses themselves via the LLM formatter.
- `ListingCard.astro` and `ListingCard.tsx` will diverge over time if the Astro version is changed. The Astro version can be deleted after Phase 3 is verified, or kept and marked as legacy — the plan does not prescribe this; it's a post-implementation cleanup decision.

## Success Criteria (Summary)

- Dashboard loads identically to today when no filters are active (zero regression)
- Agent can filter listings by status, price range, and city with instant results and visible feedback (count badge, "X z N" label)
- All listing sub-page links, form saves, delete, and reopen actions continue to work after the Astro→React migration
