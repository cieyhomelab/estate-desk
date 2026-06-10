# Dashboard CSV Export — Plan Brief

> Full plan: `context/changes/dashboard-export/plan.md`

## What & Why

The **Eksport** button on the Dashboard is a stub — clicking it does nothing. The agent has no way to get a data snapshot of all listings for agency reports. This plan wires the button to a client-side CSV download of all listings (roadmap S-02, PRD US-02/FR-006).

## Starting Point

The dashboard-filters change (S-01) already migrated the button row into the `DashboardListings` React island, which holds the full unfiltered listing array as a prop. The Eksport button is styled and rendered (`DashboardListings.tsx:73-78`) but has no `onClick`. Every field the export needs already exists on the `Listing` type.

## Desired End State

The agent clicks Eksport and the browser downloads `estatedesk-YYYY-MM-DD.csv` — one row per listing, six columns with Polish headers, all listings regardless of active filters. The file opens correctly by double-click in Polish-locale Excel: columns split, diacritics intact.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Generation approach | Client-side from the already-loaded prop | PRD mandates no additional data request; the island already has the full array. | PRD |
| Filter independence | Export always covers all listings | Export is a data tool, filter is a view tool (PRD §Non-Goals). | PRD |
| City column | Omitted | No city field exists in the database; parsing it out of `address` is fragile and a wrong city in a report is worse than no column. | Plan |
| Status label for `done` | "Ukończone" | Matches the shipped UI (cards, filter dropdown); the export should name states the way the screen does. | Plan |
| File format | Semicolon delimiter + UTF-8 BOM | Polish-locale Excel splits on `;` and needs the BOM for diacritics — the agency-report use case is Excel-first. | Plan |
| Zero listings | Header-only file downloads | No extra UI state; an empty report is still a valid report. | Plan |
| Date format in cells | ISO `YYYY-MM-DD` | Unambiguous in Excel and consistent with the mandated filename convention. | Plan |
| CSV library | None — hand-rolled | Six known columns need ~15 lines of escaping logic; a dependency is overkill. | Plan |

## Scope

**In scope:**
- `src/lib/csv.ts` — pure `listingsToCsv()` serialization function
- `src/lib/csv.test.ts` — unit tests (commission.test.ts pattern)
- `src/components/dashboard/DashboardListings.tsx` — `onClick` on the existing Eksport button (Blob + anchor download, dated filename)

**Out of scope:**
- Export of the filtered subset (PRD §Non-Goals)
- API route / server-side generation
- City column or address parsing
- Help page (S-03 — separate change); any changes to filters, stats, auth, or sub-pages

## Architecture / Approach

All formatting decisions live in one pure function: `listingsToCsv(listings) → string` (headers, status mapping, date truncation, escaping, `\r\n` joins). The button handler is pure browser glue: BOM + Blob + temporary anchor with `download="estatedesk-YYYY-MM-DD.csv"`. The handler reads the `listings` prop — never `filteredListings`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. CSV Serialization Utility | `listingsToCsv()` + unit tests locking the format contract | Escaping edge cases (semicolons/quotes in addresses) |
| 2. Eksport Button Wiring | Working download from the dashboard | Accidentally exporting `filteredListings` instead of the full set |

**Prerequisites:** None — dashboard-filters (S-01) is already implemented and reviewed.
**Estimated effort:** ~1 session across 2 phases.

## Open Risks & Assumptions

- Assumes the agent opens the file primarily in Polish-locale Excel; tools expecting comma-delimited CSV will need an import step (accepted tradeoff).
- The PRD's "city" column and "Zamknięte" wording are deliberately deviated from (decisions above); if the PRD is ever treated as the verification oracle, these two deltas are intentional.

## Success Criteria (Summary)

- Clicking Eksport downloads `estatedesk-<today>.csv` containing every listing, even while filters are active
- The file opens correctly by double-click in Polish Excel — columns split, Polish characters intact
- Closed listings carry their close date; active listings have an empty Data zamknięcia cell
