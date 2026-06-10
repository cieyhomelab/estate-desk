# Dashboard CSV Export Implementation Plan

## Overview

Wire the **Eksport** button on the Dashboard to download a CSV file of all listings. The serialization happens client-side from the listing array already loaded into the `DashboardListings` React island — no new network request, no API route. This implements roadmap slice S-02 (PRD US-02, FR-006).

## Current State Analysis

- The Eksport button is rendered inside the React island at `src/components/dashboard/DashboardListings.tsx:73-78` with `type="button"` and no `onClick`. It was migrated into the island by the dashboard-filters change (S-01) and styled but left inert.
- The island receives the full unfiltered `listings: Listing[]` prop from `dashboard.astro` — the PRD constraint "export reads the already-loaded listing data; it does not make an additional data request" is satisfiable without touching the data layer.
- The `Listing` type (`src/types/listings.ts`) carries every field the export needs: `address`, `status` (`"active" | "done"`), `asking_price`, `owner_name`, `created_at`, `closed_at`. All except `status`/`created_at` are nullable.
- `created_at` / `closed_at` are ISO timestamp strings from Supabase.
- The shipped UI maps `done` → **"Ukończone"** (`src/components/listings/ListingCard.tsx:11`, filter dropdown at `DashboardListings.tsx:101-103`), diverging from the PRD's "Zamknięte" wording.
- Unit test infrastructure exists: vitest via `npm run test`, with `src/lib/commission.test.ts` as the colocated-test pattern for pure functions in `src/lib/`.
- No CSV/export utility exists anywhere in `src/`.

## Desired End State

The agent clicks Eksport on the Dashboard and the browser immediately downloads `estatedesk-YYYY-MM-DD.csv` (current date). The file opens correctly by double-click in Polish Excel: six columns split on semicolons, Polish diacritics intact (UTF-8 BOM), one row per listing — all listings, regardless of any active filters. Closed listings show their close date; active listings show an empty cell. With zero listings, the file contains only the header row.

### Key Discoveries:

- Eksport button wiring point: `src/components/dashboard/DashboardListings.tsx:73-78`
- Pure-function + colocated-test pattern to follow: `src/lib/commission.ts` / `src/lib/commission.test.ts`
- Status label must match the shipped UI ("Ukończone"), not the PRD text ("Zamknięte") — decided during planning
- No city column: the roadmap (S-02) already dropped the PRD's city column because no city field exists; city is embedded in `address` — confirmed during planning
- Polish-locale Excel splits columns on `;` (locale list separator) and needs a `﻿` BOM to detect UTF-8 — decided during planning

## What We're NOT Doing

- No export of the filtered subset — CSV always contains all listings (PRD §Non-Goals)
- No API route or server-side generation — serialization is client-side from the existing prop
- No city column and no address-parsing heuristics
- No extra columns beyond the six in the roadmap spec (no `type`, `owner_phone`, `commission_percent`, etc.)
- No disabled state, toast, or other new UI for the zero-listings case — the header-only file downloads
- No changes to filters, stats grid, auth, or listing sub-pages
- No third-party CSV library — six known columns need ~15 lines of escaping logic

## Implementation Approach

A pure function `listingsToCsv(listings: Listing[]): string` in a new `src/lib/csv.ts` owns all serialization decisions (column order, Polish headers, status mapping, date truncation, RFC-4180-style escaping with `;` as delimiter). It is fully unit-testable with no DOM involvement. The Eksport button's `onClick` in `DashboardListings.tsx` then does only browser glue: prepend the BOM, wrap in a `Blob`, create an object URL, click a temporary anchor with the dated `download` filename, and revoke the URL. The handler always serializes the `listings` prop, never `filteredListings`.

## Phase 1: CSV Serialization Utility

### Overview

Create the pure serialization function and its unit tests. No UI changes in this phase.

### Changes Required:

#### 1. CSV utility

**File**: `src/lib/csv.ts` (new)

**Intent**: Convert a `Listing[]` into a semicolon-delimited CSV string with Polish headers, so the download handler in Phase 2 has zero formatting logic of its own.

**Contract**: Export `listingsToCsv(listings: Listing[]): string`. Behaviour the rest of the plan depends on:

- Header row (exactly): `Adres;Status;Cena wywoławcza;Właściciel;Data dodania;Data zamknięcia`
- One row per listing, in the array order given (no re-sorting)
- Status mapping: `active` → `Aktywne`, `done` → `Ukończone`
- Dates: ISO date part only (`YYYY-MM-DD`, i.e. the first 10 characters of the timestamp); `closed_at` empty when null
- Nullable fields (`address`, `asking_price`, `owner_name`) render as empty cells when null
- `asking_price` rendered as a plain number (no thousands separators, no currency suffix) so Excel parses it numerically
- Escaping: a field containing `;`, `"`, or a newline is wrapped in double quotes with inner quotes doubled (RFC 4180 rules, semicolon delimiter)
- Rows joined with `\r\n`; no BOM in the return value (the BOM is download glue, added in Phase 2)
- Zero listings → header row only

#### 2. Unit tests

**File**: `src/lib/csv.test.ts` (new)

**Intent**: Lock the serialization contract above, following the `commission.test.ts` colocated-vitest pattern.

**Contract**: Cover at minimum: header exactness; status label mapping for both states; null `closed_at` / `address` / `asking_price` / `owner_name` as empty cells; non-null `asking_price` renders as a plain integer string (e.g. `500000` → `"500000"`, no locale-formatting such as `"500 000"`); date truncation to `YYYY-MM-DD`; escaping of a field containing a semicolon and one containing a double quote; empty-array → header-only output.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test`
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`

#### Manual Verification:

- (none — pure function, fully covered by unit tests)

**Implementation Note**: This phase has no manual gate; proceed to Phase 2 once automated verification passes.

---

## Phase 2: Eksport Button Wiring

### Overview

Wire the Eksport button to build the file from the full listing set and trigger the browser download.

### Changes Required:

#### 1. Export click handler

**File**: `src/components/dashboard/DashboardListings.tsx`

**Intent**: Give the Eksport button (lines 73–78) an `onClick` that downloads the CSV. This is the only UI change; the button's markup and styling stay as they are.

**Contract**: The handler must:

- Serialize the **`listings` prop** (full unfiltered set), never `filteredListings` — PRD: "export always includes all listings regardless of current filter state"
- Prepend `﻿` and create a `Blob` with type `text/csv;charset=utf-8`
- Download via a temporary anchor with `download` set to `estatedesk-YYYY-MM-DD.csv`, where the date is the current local date; revoke the object URL afterwards
- Work with zero listings (header-only file downloads; button is never disabled)

### Success Criteria:

#### Automated Verification:

- Unit tests still pass: `npm run test`
- Linting passes: `npm run lint`
- Type checking passes: `npx astro check`
- Production build succeeds: `npm run build`

#### Manual Verification:

- Clicking Eksport downloads `estatedesk-<today>.csv` with one row per listing
- With filters active (e.g. Status = Aktywne), the export still contains ALL listings
- File opens by double-click in Polish-locale Excel: columns split correctly, Polish diacritics (ą/ę/ł/ó/ś) render intact
- A closed listing shows its close date; an active listing shows an empty Data zamknięcia cell
- No regression: filters, count badge, listing card links, and delete still work

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit Tests:

- All serialization behaviour lives in `listingsToCsv` and is tested there (see Phase 1 contract list)
- Key edge cases: null fields, both status values, semicolon/quote in `address` or `owner_name`, empty array

### Integration Tests:

- None — no API route or database interaction is added

### Manual Testing Steps:

1. Log in, open `/dashboard` with a mix of active and closed listings; click Eksport; confirm the filename is `estatedesk-<today>.csv`
2. Open the file in Excel (Polish locale) by double-click; verify six columns, Polish headers, diacritics, numeric prices
3. Set a filter that narrows the list, click Eksport again, confirm the file still contains all listings
4. (Optional) On an account with zero listings, click Eksport and confirm a header-only file downloads

## Performance Considerations

None. 5–20 listings serialize in microseconds; the Blob is kilobytes. No memoization or async handling needed.

## Migration Notes

Not applicable — no data or schema changes.

## References

- Roadmap slice: `context/foundation/roadmap.md` §S-02
- PRD: `context/foundation/prd.md` — US-02, §Export, §Constraints & Compatibility
- Prior change (island migration): `context/changes/dashboard-filters/plan.md`
- Wiring point: `src/components/dashboard/DashboardListings.tsx:73-78`
- Pure-function test pattern: `src/lib/commission.test.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: CSV Serialization Utility

#### Automated Verification:

- [x] 1.1 Unit tests pass: `npm run test` — c4cd93b
- [x] 1.2 Linting passes: `npm run lint` — c4cd93b
- [x] 1.3 Type checking passes: `npx astro check` — c4cd93b

### Phase 2: Eksport Button Wiring

#### Automated Verification:

- [x] 2.1 Unit tests still pass: `npm run test`
- [x] 2.2 Linting passes: `npm run lint`
- [x] 2.3 Type checking passes: `npx astro check`
- [x] 2.4 Production build succeeds: `npm run build`

#### Manual Verification:

- [x] 2.5 Clicking Eksport downloads `estatedesk-<today>.csv` with one row per listing
- [x] 2.6 With filters active, the export still contains ALL listings
- [x] 2.7 File opens correctly in Polish-locale Excel (columns split, diacritics intact)
- [x] 2.8 Closed listing shows close date; active listing shows empty cell
- [x] 2.9 No regression: filters, badge, card links, delete still work
