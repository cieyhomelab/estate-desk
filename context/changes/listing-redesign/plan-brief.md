# Listing Redesign — Plan Brief

> Full plan: `context/changes/listing-redesign/plan.md`

## What & Why

Replace the 2-column card grid on the dashboard with a full-width table list view. The card layout wastes horizontal space and makes scanning multiple listings slow; the new list view puts all key fields — address, type, price, status, actions — on a single scannable row per listing.

## Starting Point

`DashboardListings.tsx` renders filtered listings as `<ListingCard>` items inside `grid gap-4 sm:grid-cols-2`. Each card is a rounded box (~200px tall) with vertically stacked content. The reference design for the new layout is `estatedesk-v2.pen` (frame "Dashboard — Ogłoszenia").

## Desired End State

The dashboard shows a compact table: a column-header row (ADRES / WŁAŚCICIEL · TYP · CENA · STATUS · AKCJE) followed by one horizontal row per listing. Each row fits everything the card showed, in far less vertical space. Done listings show a green "Zysk:" agent-net line under the price. Filters and CSV export are unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Layout on mobile | Compact list on all screen sizes | Consistent layout; address truncates with ellipsis — no breakpoint-specific code | Plan |
| Action button visibility | Always visible at row end | Works on touch; matches current card behavior | Plan |
| Fields per row | All current fields, condensed | No information lost vs cards | Plan |
| City in meta line | Parse from last comma in address string | No separate city DB field exists; `formatAddress` API returns "street, city" format | Plan |
| ListingCard.tsx | Left in place, not modified | Dead code (`ListingCard.astro`) not touched; `ListingCard.tsx` replaced by new `ListingRow.tsx` | Plan |

## Scope

**In scope:**
- New `src/components/listings/ListingRow.tsx` — horizontal row component
- Updated `src/components/dashboard/DashboardListings.tsx` — column header + swap grid for list

**Out of scope:**
- `ListingCard.astro` (dead code, untouched)
- `ListingCard.tsx` (left in place, just no longer imported)
- Filters, CSV export, empty states, stats row
- Hover-only action visibility
- Any DB schema or API changes

## Architecture / Approach

`ListingRow` accepts the same props as `ListingCard` (`listing`, `agentNet`) so the swap in `DashboardListings` is surgical: change the import, add the header row, and replace `<div className="grid ...">` with `<div>` (flex-col implied by block children). All column widths in the header div mirror the cell widths in `ListingRow` so they align without a real HTML `<table>`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Create ListingRow | New horizontal row component matching the Pencil design | City-parsing edge cases (address without comma) |
| 2. Update DashboardListings | Column header + swap grid for list | Column widths misalign if header and row cells diverge |

**Prerequisites:** None — purely frontend, no migrations or env vars needed.  
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- City extraction assumes `listing.address` follows "street, city" format from the format-address API. Listings entered without the API (or with a different format) will show no city in the meta line — this is an acceptable fallback.
- The `ListingCard.astro` file is confirmed dead code (0 imports). If it turns out to be used somewhere not caught by grep, it will need a parallel update.

## Success Criteria (Summary)

- Dashboard list view renders with all fields visible and column headers aligned
- Filters, CSV export, and empty states behave identically to before
- Done listings show the green agent-net line; active listings do not
