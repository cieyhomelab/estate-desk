# Listing Redesign — Implementation Plan

## Overview

Replace the 2-column card grid on the dashboard with a full-width table list view. The reference design is `estatedesk-v2.pen` (frame "Dashboard — Ogłoszenia"). The change touches two files: a new `ListingRow` component and the `DashboardListings` container.

## Current State Analysis

- `DashboardListings.tsx` renders filtered listings inside `<div className="grid gap-4 sm:grid-cols-2">`, mapping each to `<ListingCard>`.
- `ListingCard.tsx` is a self-contained box (rounded-xl, p-5) showing address, badges, price, and action icons vertically stacked.
- `ListingCard.astro` exists but has zero imports — it is dead code and is NOT touched by this plan.
- No data model, API, or routing changes are required.

## Desired End State

The dashboard listings section shows a full-width table: a sticky column-header row followed by one horizontal row per listing. Every row fits all fields inline (address + meta, type badge, price, status badge, action icons). The appearance matches the `estatedesk-v2.pen` design exactly.

To verify: open the dashboard with at least one active and one done listing; all columns align; the header labels are visible; done listings show the agent net line in green.

### Key Discoveries

- Design file: `/Users/maciejkulesza/Downloads/estatedesk-v2.pen`, node `bi8Au`
- Column widths from design: Type=110px, Price=130px, Status=90px, Actions=130px, Address=fill
- Meta line format in design: "CITY · OWNER_NAME" — city extracted by splitting `listing.address` on the last comma; fallback to full address if no comma present
- Status dot: 7px circle, `#22c55e` active / `#ffffff25` done
- Type badge: `fill: #1e3a5f / text: #93c5fd` (sale) — `fill: #163040 / text: #38bdf8` (rental)
- Status badge: `fill: #0f2a1a / stroke: #22c55e20 / text: #86efac` (active) — `fill: #1a1a2e / stroke: #ffffff10 / text: #ffffff50` (done)
- Agent net line: `fill: #4ade80`, prefix "Zysk: "
- Row separator: `border-b border-white/[0.05]`, padding `py-[18px]`
- Action buttons: 22×22px, `cornerRadius: 6`, gap 5px; delete uses `fill: #f8717110`

## What We're NOT Doing

- Not modifying `ListingCard.astro` (dead code)
- Not modifying `ListingCard.tsx` (replaced by new component; file left in place)
- Not changing filters, CSV export, empty states, or stats row
- Not adding hover-only action visibility (always-visible chosen)
- Not adding a separate city DB field — city is parsed from the address string

## Implementation Approach

Create `ListingRow.tsx` as a new horizontal-layout component matching the Pencil design exactly. Then update `DashboardListings.tsx` to add a column header row and swap the grid container + `ListingCard` import for `flex-col` + `ListingRow`.

## Critical Implementation Details

**City parsing from address**: The design shows "CITY · OWNER_NAME" in the meta line. Since `listing.address` is a single string (e.g. "ul. Marszałkowska 22/4, Warszawa"), extract city as the substring after the last comma and trim whitespace. If no comma is present, omit the city prefix and show only the owner name (or just the address on the main line).

---

## Phase 1: Create ListingRow Component

### Overview

New component implementing the 5-column horizontal row matching the Pencil design.

### Changes Required

#### 1. New component file

**File**: `src/components/listings/ListingRow.tsx`

**Intent**: Render one listing as a horizontal table row with the 5-column layout from the design. Accepts the same props as `ListingCard` (`listing: Listing`, `agentNet?: number | null`) so the swap in Phase 2 is a one-liner.

**Contract**: The component returns a `<div>` with `flex items-center border-b border-white/[0.05] py-[18px]` containing five child cells in this order:

1. **Addr cell** (`flex-1 flex items-center gap-[10px] pr-4`):
   - Status dot: `w-[7px] h-[7px] rounded-full shrink-0` — `bg-[#22c55e]` active, `bg-white/[0.15]` done
   - AddrInfo (`flex flex-col gap-[3px]`):
     - Address line: `text-[13px] font-semibold text-white` — value: parsed street (everything before last comma) or full `listing.address`
     - Meta line: `text-[12px] text-white/50` — value: `{city} · {listing.owner_name}` when both present; just owner name when no city; omit the `<p>` entirely when `owner_name` is null

2. **Type cell** (`w-[110px] shrink-0`):
   - Badge: `inline-flex items-center rounded-full px-[10px] py-[4px] text-[11px] font-medium`
   - Sale (`listing.type === "sale"`): label "Sprzedaż", `bg-[#1e3a5f] text-[#93c5fd] border border-[#3b82f6]/[0.19]`
   - Rental (else): label "Najem okazjonalny", `bg-[#163040] text-[#38bdf8] border border-[#38bdf8]/[0.19]`

3. **Price cell** (`w-[130px] shrink-0 flex flex-col gap-[2px]`):
   - Price: `text-[13px] font-bold text-white` — `formatPLN(listing.asking_price)` or `<span className="text-white/30 font-normal">Brak ceny</span>`
   - Agent net (done listings only): `text-[11px] text-[#4ade80]` — "Zysk: {formatPLN(agentNet)}" when `agentNet !== null`

4. **Status cell** (`w-[90px] shrink-0`):
   - Badge: `inline-flex items-center rounded-full px-[10px] py-[4px] text-[11px] font-medium`
   - Active: `bg-[#0f2a1a] text-[#86efac] border border-[#22c55e]/[0.13]`
   - Done: `bg-[#1a1a2e] text-white/[0.31] border border-white/[0.06]`

5. **Actions cell** (`w-[160px] shrink-0 flex items-center gap-[5px]`): same six icon links/buttons as current `ListingCard` (pencil-line, tag, file-text, users, circle-check/rotate-ccw, trash2), each `flex items-center justify-center size-[22px] rounded-[6px]`. Regular: `bg-white/[0.03] text-white/35 hover:bg-white/[0.08] hover:text-white/60`. Delete: `bg-[#f87171]/[0.06] text-[#f87171] hover:bg-[#f87171]/[0.12]`. (Width 160px: 6 buttons × 22px + 5 gaps × 5px = 157px natural width; 3px breathing room.)

### Success Criteria

#### Automated Verification

- TypeScript compiles with no errors: `npx tsc --noEmit`

#### Manual Verification

- `ListingRow` renders correctly in isolation by temporarily importing it in `DashboardListings.tsx` and checking the layout in the browser
- Address cell: street + meta line visible; meta omitted when `owner_name` is null
- City parses correctly: "ul. Marszałkowska 22/4, Warszawa" → street "ul. Marszałkowska 22/4", city "Warszawa"
- Type badges show correct colors for sale vs rental
- Status badges show correct colors for active vs done
- Done listings show green "Zysk:" line; active listings do not
- All 6 action buttons clickable

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Phase 2: Update DashboardListings

### Overview

Swap the grid container and `ListingCard` import for `ListingRow`, and add the column header row above the list.

### Changes Required

#### 1. Update imports

**File**: `src/components/dashboard/DashboardListings.tsx`

**Intent**: Replace the `ListingCard` import with `ListingRow`.

**Contract**: Remove `import ListingCard from "@/components/listings/ListingCard"` and add `import ListingRow from "@/components/listings/ListingRow"`.

#### 2. Add column header row and replace grid with flex-col list

**File**: `src/components/dashboard/DashboardListings.tsx`

**Intent**: Replace the grid div (and `ListingCard` usage) with a column-header row followed by a vertical flex list of `ListingRow` items.

**Contract**: The current `<div className="grid gap-4 sm:grid-cols-2">` block becomes:

```tsx
<div className="overflow-x-auto">
  <div className="min-w-[640px]">
    {/* Column header row */}
    <div className="flex items-center pb-[10px] border-b border-white/[0.05]">
      <div className="flex-1 text-[10px] font-semibold text-white/[0.19] tracking-[0.7px] uppercase">
        Adres / Właściciel
      </div>
      <div className="w-[110px] shrink-0 text-[10px] font-semibold text-white/[0.19] tracking-[0.7px] uppercase">
        Typ
      </div>
      <div className="w-[130px] shrink-0 text-[10px] font-semibold text-white/[0.19] tracking-[0.7px] uppercase">
        Cena
      </div>
      <div className="w-[90px] shrink-0 text-[10px] font-semibold text-white/[0.19] tracking-[0.7px] uppercase">
        Status
      </div>
      <div className="w-[160px] shrink-0 text-[10px] font-semibold text-white/[0.19] tracking-[0.7px] uppercase">
        Akcje
      </div>
    </div>
    {/* Listing rows */}
    {filteredListings.map((listing) => (
      <ListingRow key={listing.id} listing={listing} agentNet={snapshotMap[listing.id] ?? null} />
    ))}
  </div>
</div>
```

The column header widths mirror the cell widths in `ListingRow` exactly so columns align.

### Success Criteria

#### Automated Verification

- TypeScript compiles with no errors: `npx tsc --noEmit`
- Dev server starts without errors: `npm run dev`

#### Manual Verification

- Dashboard loads with the list view replacing the card grid
- Column headers ("ADRES / WŁAŚCICIEL", "TYP", "CENA", "STATUS", "AKCJE") align with their respective data cells
- Filters still work — applying status/price/city filter updates the list rows
- CSV export still works
- Empty state (no listings) still shows the "Brak ogłoszeń" call-to-action
- No-filter-match state still shows the "Brak ogłoszeń pasujących do filtrów" message
- Layout on mobile: the container scrolls horizontally (`overflow-x-auto`) and the inner wrapper enforces `min-w-[640px]`; all columns remain fully visible on scroll
- No regressions on listing detail pages (edit, pricing, documents, contacts, close)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase. Phase blocks use plain bullets — the corresponding `- [ ]` checkboxes for these items live in the `## Progress` section at the bottom of the plan.

---

## Testing Strategy

### Manual Testing Steps

1. Open dashboard — confirm list view renders
2. Create or have one active + one done listing visible
3. Verify active listing: green dot, correct type badge, price without agent net, green "Aktywne" badge
4. Verify done listing: dim dot, price with green "Zysk:" line, dim "Ukończone" badge
5. Toggle filter panel — confirm it still opens/closes and filters work
6. Export CSV — confirm download still works
7. Click each of the 6 action icons on a row — confirm they navigate correctly
8. Delete a listing (with confirmation dialog) — confirm it still works
9. Resize browser to mobile width — confirm rows remain readable

## References

- Reference design: `/Users/maciejkulesza/Downloads/estatedesk-v2.pen` — frame `bi8Au`
- Container: `src/pages/dashboard.astro:102` — `<DashboardListings client:load />`
- Current grid: `src/components/dashboard/DashboardListings.tsx:181`
- Current card: `src/components/listings/ListingCard.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Create ListingRow Component

#### Automated

- [x] 1.1 TypeScript compiles with no errors: `npx tsc --noEmit`

#### Manual

- [x] 1.2 ListingRow renders correctly in isolation in the browser
- [x] 1.3 Address cell: street + meta line visible; meta omitted when owner_name is null
- [x] 1.4 City parses correctly from comma-separated address string
- [x] 1.5 Type badges show correct colors for sale vs rental
- [x] 1.6 Status badges show correct colors for active vs done
- [x] 1.7 Done listings show green "Zysk:" line; active listings do not
- [x] 1.8 All 6 action buttons clickable

### Phase 2: Update DashboardListings

#### Automated

- [ ] 2.1 TypeScript compiles with no errors: `npx tsc --noEmit`
- [ ] 2.2 Dev server starts without errors: `npm run dev`

#### Manual

- [ ] 2.3 Dashboard loads with the list view replacing the card grid
- [ ] 2.4 Column headers align with their respective data cells
- [ ] 2.5 Filters still work (status, price, city)
- [ ] 2.6 CSV export still works
- [ ] 2.7 Empty state renders correctly
- [ ] 2.8 No-filter-match state renders correctly
- [ ] 2.9 Mobile: container scrolls horizontally; all columns visible on scroll
- [ ] 2.10 No regressions on listing detail pages
