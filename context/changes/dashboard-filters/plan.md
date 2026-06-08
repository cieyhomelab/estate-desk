# Dashboard Filters Implementation Plan

## Overview

Wire up the non-functional `Filtry` button on the Dashboard to an inline, collapsible filter bar that narrows the listing list client-side — no page reload, no extra Supabase queries. Filtering is a predicate over the already-loaded listing array. The key architectural move is converting the static Astro listing loop into a React island (`client:load`).

## Current State Analysis

The Dashboard (`src/pages/dashboard.astro`) loads all listings from Supabase once on navigation and renders them with a static `{listings.map(...)}` Astro loop (lines 126–130). The `Filtry` button (lines 98–103) is a plain HTML button with no `onClick`. `ListingCard` (`src/components/listings/ListingCard.astro`) is a pure Astro component and cannot be used inside a React island.

The `snapshotMap` is a server-side `Map<string, number | null>` (done-listing → agent net profit). To cross the Astro→React prop boundary it must be serialized to a plain object.

Existing status values in the database: `"active"` and `"done"`. Displayed in Polish as `"Aktywne"` and `"Ukończone"` in `ListingCard.astro`. There is no dedicated city field — the filter will match free text against the `address` field.

### Key Discoveries:

- `src/pages/dashboard.astro:95–132` — entire lower section (button row + listing grid) replaces with the React island
- `src/components/listings/ListingCard.astro:26-29` — status label logic to replicate in React twin
- `src/components/listings/ListingCard.astro:100–108` — delete confirmation uses `window.confirm()` (native browser dialog) — keep the same behavior
- `src/components/auth/SignInForm.tsx` and `src/components/listings/AddressField.tsx` — existing React island pattern: typed props interface, default export, Tailwind `className`

## Desired End State

After this plan is complete:

1. Clicking **Filtry** on the Dashboard expands an inline filter bar beneath the button row. The bar contains a Status dropdown (Wszystkie / Aktywne / Ukończone), two numeric inputs (Cena od / Cena do), and a text input (Miasto).
2. The listing grid narrows instantly as the agent adjusts any filter input.
3. The "Twoje oferty" label updates to "Twoje oferty (3 z 12)" format when filters reduce the result set.
4. A numeric badge on the Filtry button shows the count of active filter dimensions (>0) when filters are set.
5. Clicking Filtry again collapses the bar and resets all filter inputs to defaults.
6. The stats grid (Aktywne oferty / Łączna wartość / W transakcji / Wszystkich) is unaffected by filters — it still reflects all server-loaded listings.
7. When filters yield zero results, the grid shows "Brak ogłoszeń pasujących do filtrów." instead of the "add first listing" empty state.
8. The no-filter view is visually identical to the current dashboard (no regression).

## What We're NOT Doing

- URL-based filter persistence (`?status=aktywne`) — ephemeral React state only
- Server-side filtering (additional Supabase queries per filter change)
- Exporting filtered subset — CSV always includes all listings (S-02, separate change)
- Updating the stats grid to reflect filtered listings
- Any changes to the Help button or `/help` page (S-03)
- Any changes to auth, form saves, or listing sub-pages

## Implementation Approach

Replace lines 95–132 of `dashboard.astro` (button row + listing grid) with a single React island `<DashboardListings client:load ... />`. The island receives the full listing array and serialized `snapshotMap` as Astro props; all filter state lives inside the island. A new `ListingCard.tsx` React component mirrors the existing Astro card visually and functionally.

Three phases in dependency order: (1) the React card component, (2) the island with filter logic, (3) the Astro wiring.

## Phase 1: ListingCard React Component

### Overview

Create a React twin of `src/components/listings/ListingCard.astro`. The component must produce visually identical output and preserve all action behaviors (edit/pricing/documents/contacts links, reopen form, delete form with native confirm).

### Changes Required:

#### 1. New file: `src/components/listings/ListingCard.tsx`

**File**: `src/components/listings/ListingCard.tsx`

**Intent**: React port of the existing Astro card. Receives `listing: Listing` and `agentNet: number | null` props. Renders identical markup using `className` instead of `class`, and uses the same `formatPLN` utility from `@/lib/utils`.

**Contract**: Props interface:
```typescript
interface Props {
  listing: Listing;
  agentNet?: number | null;
}
```
The delete button's `onclick` confirmation becomes an `onClick` handler that calls `window.confirm(...)` and submits the form only if the user confirms — same dialog text as the existing Astro component. The reopen `<form method="POST">` works identically inside React. Status badge color: green for `"active"`, muted white for `"done"` (same CSS classes as `.astro` file line 27–29).

### Success Criteria:

#### Automated Verification:

- TypeScript compiles without errors: `npx astro check`
- No lint errors: `npm run lint` (if configured)

#### Manual Verification:

- `ListingCard.tsx` renders a card that is visually identical to the existing Astro card for both `active` and `done` listings
- Delete button shows the native browser confirm dialog; cancelling does not submit
- Reopen form submits correctly for `done` listings

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: DashboardListings React Island

### Overview

Create the React island that owns the button row (Filtry + badge, Eksport, listing count label), collapsible filter bar, and the listing grid. All filter state is internal to this component.

### Changes Required:

#### 1. New directory and file: `src/components/dashboard/DashboardListings.tsx`

**File**: `src/components/dashboard/DashboardListings.tsx`

**Intent**: The island's props are all listings (full, unfiltered) and the serialized snapshot map. Internally it manages `filterOpen: boolean` and a `FilterState` object. Clicking Filtry toggles `filterOpen`; closing resets `FilterState` to defaults. The filtered listing array is derived on each render from `listings` + current `FilterState`.

**Contract**: Props interface:
```typescript
interface Props {
  listings: Listing[];
  snapshotMap: Record<string, number | null>;
  hasError?: boolean;
}
```

Filter state shape:
```typescript
interface FilterState {
  status: "all" | "active" | "done";
  priceMin: string; // kept as string to allow empty input; parsed to number on comparison
  priceMax: string;
  city: string;
}
const defaultFilters: FilterState = { status: "all", priceMin: "", priceMax: "", city: "" };
```

Filter predicate (applied on render, not via `useMemo` — listing count is small):
- `status !== "all"` → `listing.status === filters.status`
- `priceMin` non-empty → `(listing.asking_price ?? 0) >= parseInt(priceMin)`
- `priceMax` non-empty → `(listing.asking_price ?? 0) <= parseInt(priceMax)`
- `city` non-empty → `listing.address.toLowerCase().includes(city.toLowerCase())`

Active filter count (for Filtry badge): sum of non-default dimensions — status counts as 1 if not `"all"`, priceMin counts as 1 if non-empty, priceMax counts as 1 if non-empty, city counts as 1 if non-empty. Badge renders only when count > 0.

Count label logic:
- No active filters: `"Twoje oferty ({listings.length})"`
- Active filters: `"Twoje oferty ({filteredListings.length} z {listings.length})"`

Empty state inside the grid:
- `listings.length === 0 && !hasError`: existing "Brak ogłoszeń. Dodaj pierwsze ogłoszenie." anchor (preserve current link to `/dashboard/listings/new`)
- `filteredListings.length === 0 && listings.length > 0`: `<p>Brak ogłoszeń pasujących do filtrów.</p>` with same muted styling

Filter bar layout: a collapsible `<div>` that appears between the button row and the grid when `filterOpen` is true. Contains four controls in a responsive flex/grid row:
- Status `<select>` with options: `Wszystkie` (value `"all"`), `Aktywne` (value `"active"`), `Ukończone` (value `"done"`)
- `<input type="number">` labeled `Cena od`
- `<input type="number">` labeled `Cena do`
- `<input type="text">` labeled `Miasto`

Visual style of filter bar and inputs follows the same dark-glass pattern as the rest of the dashboard (white/10 backgrounds, white/20 borders, white text).

#### 2. Eksport button within the island

**File**: `src/components/dashboard/DashboardListings.tsx` (same file)

**Intent**: The Eksport button lives in the island's button row. For now its `onClick` is a no-op placeholder (S-02 wires it up). It must be present and styled identically to the current Astro version so S-02 can simply add the handler without touching the layout.

**Contract**: `<button type="button" onClick={() => {}} ...>Eksport</button>` — same class string as the current `dashboard.astro:104–109`.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles without errors: `npx astro check`

#### Manual Verification:

- Filtry button toggles filter bar open/closed
- Closing the bar resets all inputs to blank / "Wszystkie"
- Status filter correctly shows only active or done listings
- Price range inputs narrow the list (both min, max, and both together)
- City text input narrows list case-insensitively against address field
- Badge count on Filtry button is correct (0 → no badge, 1 active filter → badge shows "1", etc.)
- "Twoje oferty" count updates correctly when filters reduce the result set
- Zero-results-from-filter message appears when no listings match
- Eksport button is visible, styled correctly, and does nothing when clicked (placeholder)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Dashboard Astro Wiring

### Overview

Replace the static listing section in `dashboard.astro` with the `DashboardListings` island. The stats grid and banner messages stay in Astro. The `snapshotMap` is serialized to a plain object before being passed as a prop.

### Changes Required:

#### 1. Modify `src/pages/dashboard.astro`

**File**: `src/pages/dashboard.astro`

**Intent**: Import `DashboardListings` and restructure lines 95–132 as follows: remove the button row (lines 95–111) and listing grid (lines 117–132); move the banner block (lines 113–115) to immediately above the island invocation; insert the island after the banners. The stats grid (lines 76–93) stays as-is in Astro.

**Contract**: Update the frontmatter imports:
- Remove the now-unused `import ListingCard from "@/components/listings/ListingCard.astro"` (dashboard.astro:5)
- Add:
```typescript
import DashboardListings from "@/components/dashboard/DashboardListings";
```

Before the island, convert `snapshotMap`:
```typescript
const snapshotRecord: Record<string, number | null> = Object.fromEntries(snapshotMap);
```

Replace the removed section with:
```astro
<DashboardListings
  listings={listings}
  snapshotMap={snapshotRecord}
  hasError={!!fetchError}
  client:load
/>
```

Keep the banner messages (`{urlSuccess === "wznowiono" && ...}`, `{urlError && ...}`, `{fetchError && ...}`) outside the island, immediately above the island invocation — they are server-rendered, not interactive.

The existing `activeListings`, `doneListings`, and `totalActiveValue` server-side computations (lines 51–53) remain unchanged; they feed only the stats grid.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles without errors: `npx astro check`
- Dev server starts without errors: `npm run dev`

#### Manual Verification:

- Dashboard loads with no visible change when no filters are active (no-filter parity with original)
- Stats grid (Aktywne oferty / Łączna wartość / W transakcji / Wszystkich) shows correct server-computed totals and does not change when filters are applied
- Banner messages (Wznowiono, error) still render correctly above the listing section
- All listing sub-page links (`/dashboard/listings/[id]/edit`, `/pricing`, `/documents`, `/contacts`, `/close`) still work
- Delete and reopen actions still function correctly
- No TypeScript errors in IDE

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Manual Testing Steps:

1. Load Dashboard with 0 listings → "Brak ogłoszeń. Dodaj pierwsze ogłoszenie." link renders (not filter-empty message)
2. Load Dashboard with mixed active/done listings → no-filter view is visually identical to the original
3. Click Filtry → filter bar expands below button row
4. Set Status = Aktywne → only active listings appear; count label updates to "X z N" format; badge shows "1"
5. Add Cena od = 500000 → list further narrows; badge shows "2"
6. Add Miasto = "Warszawa" → list further narrows; badge shows "3"
7. Click Filtry again → bar collapses, all inputs reset, full list restores, badge disappears
8. Filter to 0 results → "Brak ogłoszeń pasujących do filtrów." appears (not the add-listing link)
9. Reload page → filter state is gone (ephemeral, not persisted)
10. Click Edytuj on any listing → sub-page loads correctly
11. Delete a listing → native confirm appears; cancel keeps listing, confirm removes it

## Performance Considerations

Filtering is a client-side `.filter()` pass over an in-memory array. At the expected scale (5–20 listings, max 100 from the query limit) this is instantaneous with no optimization needed.

## References

- PRD: `context/foundation/prd.md` — US-01, FR-001–005
- Roadmap: `context/foundation/roadmap.md` — S-01
- Existing Astro card: `src/components/listings/ListingCard.astro`
- Existing React island pattern: `src/components/listings/AddressField.tsx`
- Listing type: `src/types/listings.ts`
- Dashboard: `src/pages/dashboard.astro`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: ListingCard React Component

#### Automated

- [x] 1.1 TypeScript compiles without errors: `npx astro check`
- [x] 1.2 No lint errors: `npm run lint` (if configured)

#### Manual

- [x] 1.3 `ListingCard.tsx` renders visually identical to the Astro card for active and done listings
- [x] 1.4 Delete button shows native browser confirm dialog; cancelling does not submit
- [x] 1.5 Reopen form submits correctly for done listings

### Phase 2: DashboardListings React Island

#### Automated

- [x] 2.1 TypeScript compiles without errors: `npx astro check`

#### Manual

- [x] 2.2 Filtry button toggles filter bar open/closed
- [x] 2.3 Closing the bar resets all inputs to blank / "Wszystkie"
- [x] 2.4 Status filter correctly shows only active or done listings
- [x] 2.5 Price range inputs narrow the list correctly
- [x] 2.6 City text input narrows list case-insensitively against address field
- [x] 2.7 Badge count on Filtry button is correct
- [x] 2.8 "Twoje oferty" count updates correctly when filters reduce result set
- [x] 2.9 Zero-results-from-filter message appears when no listings match
- [x] 2.10 Eksport button is visible, styled correctly, and does nothing when clicked

### Phase 3: Dashboard Astro Wiring

#### Automated

- [x] 3.1 TypeScript compiles without errors: `npx astro check`
- [x] 3.2 Dev server starts without errors: `npm run dev`

#### Manual

- [x] 3.3 Dashboard loads with no visible change when no filters are active
- [x] 3.4 Stats grid shows correct server-computed totals, unaffected by filters
- [x] 3.5 Banner messages still render correctly above the listing section
- [x] 3.6 All listing sub-page links still work
- [x] 3.7 Delete and reopen actions still function correctly
