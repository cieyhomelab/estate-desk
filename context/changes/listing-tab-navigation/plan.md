# Listing Tab Navigation Implementation Plan

## Overview

Replace the inconsistent ad-hoc navigation on the 5 listing detail pages (`edit`, `pricing`, `documents`, `contacts`, `close`) with a single shared `ListingTabs.astro` component that renders a uniform tab bar and back link. No backend changes, no JS.

## Current State Analysis

Each listing detail page has its own hand-rolled navigation:
- `edit.astro:42-57` — inline flex div with back-to-dashboard + two arrow links (pricing, close)
- `pricing.astro:87-96` — "← Powrót do edycji" + "Zamknij →" (back goes to edit, not dashboard)
- `documents.astro:84-102` — closest to a tab bar (edit | pricing | **documents**), missing contacts and close
- `contacts.astro:75-89` — back-to-dashboard + "Dokumenty →" (no tab concept)
- `close.astro:109-123` — breadcrumb style (`← Powrót | Edytuj → Cena i prowizja → Zamknij`)

The `documents.astro` tab pattern (lines 88-102) establishes the visual language: inactive tabs use `text-sm text-blue-200/70`, active tab uses `text-sm font-medium text-white`, separator is `border-b border-white/10 pb-4 mb-6`.

## Desired End State

All 5 listing detail pages show the identical tab bar:

```
← Powrót do panelu

Edytuj  |  Cena i prowizja  |  Dokumenty  |  Kontakty  |  Zamknij
───────────────────────────────────────────────────────────────────
```

The active tab is rendered as a non-link `<span>` with `font-medium`; the Zamknij tab uses red tones (`text-red-300/70` inactive, `text-red-300 font-medium` active) to signal its terminal nature.

### Key Discoveries

- `src/components/listings/ListingCard.astro` — existing listing component in the same directory; `ListingTabs.astro` should live alongside it
- `documents.astro:88-102` — the tab bar pattern to replicate and extend
- Tab order decision: Edytuj → Cena i prowizja → Dokumenty → Kontakty → Zamknij
- `contacts.astro:21` and `:33` call `Astro.redirect()` **without `return`** — execution continues past the redirect and `listing` stays null. These two lines must be fixed to `return Astro.redirect(...)` (matching the pattern on all other 4 pages) before `<ListingTabs>` can be placed unconditionally. After that fix, all 5 pages correctly guard auth and redirect if no listing found.

## What We're NOT Doing

- No JS interactivity — pure Astro SSR component
- No URL-inference for active tab — explicit `activeTab` prop per page
- No conditional hiding/dimming of the Zamknij tab based on `listing.status` (deferred; kept simple for phase 1)
- No changes to API routes or database
- No changes to the `Layout.astro` wrapper

## Implementation Approach

Two phases. Phase 1 creates the isolated, testable component. Phase 2 surgically replaces the navigation block in each of the 5 pages. Changes are fully additive in phase 1 and purely subtractive+additive in phase 2 — no business logic is touched.

## Phase 1: Create `ListingTabs` Component

### Overview

New Astro component that owns the back link row and the tab row. No side effects, no data fetching.

### Changes Required

#### 1. New component file

**File**: `src/components/listings/ListingTabs.astro`

**Intent**: Render the back-to-dashboard link and the full 5-tab navigation bar. The active tab is rendered as a plain `<span>` (not a link); the Zamknij tab uses red tones in both active and inactive states.

**Contract**: Props interface —

```typescript
interface Props {
  listingId: string;
  activeTab: "edit" | "pricing" | "documents" | "contacts" | "close";
}
```

The tabs array is defined inline (static order: edit → pricing → documents → contacts → close). The component renders a wrapping `<div class="mb-6">` containing:
1. A block `<a href="/dashboard">` back link
2. A flex row `<div class="flex flex-wrap gap-4 gap-y-2 border-b border-white/10 pb-4">` with one element per tab — `<span>` for the active tab, `<a>` for all others

The Zamknij tab (key `"close"`) receives `text-red-300/70 hover:text-red-300` when inactive and `text-red-300 font-medium` when active. All other tabs use `text-blue-200/70 hover:text-blue-200` inactive and `text-white font-medium` active.

### Success Criteria

#### Automated Verification

- TypeScript compilation passes with no new errors: `npx tsc --noEmit`
- No import errors when the component is referenced

#### Manual Verification

- Component file exists at `src/components/listings/ListingTabs.astro`
- Props interface is exported and matches the union literal type exactly
- Zamknij tab link renders with red tone classes, other tabs with blue tone classes

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Wire into All 5 Pages

### Overview

Replace the ad-hoc navigation block in each listing detail page with `<ListingTabs>`. The `listing.id` and a string literal for the current tab are passed as props. Each page's old navigation block is removed.

### Changes Required

#### 1. `edit.astro`

**File**: `src/pages/dashboard/listings/[id]/edit.astro`

**Intent**: Replace the current flex navigation div (lines 42-57) with `<ListingTabs listingId={listing.id} activeTab="edit" />`. Import the component at the top of the frontmatter.

**Contract**: Remove the `<div class="mb-6 flex flex-wrap items-center justify-between gap-2">` block including the back link and the pricing/close links. Insert `<ListingTabs listingId={listing.id} activeTab="edit" />` immediately after `<Layout>` opens and before the main content card.

#### 2. `pricing.astro`

**File**: `src/pages/dashboard/listings/[id]/pricing.astro`

**Intent**: Replace the flex nav div (lines 87-96) — which currently points back to edit rather than dashboard — with `<ListingTabs listingId={listing.id} activeTab="pricing" />`.

**Contract**: Remove the `<div class="mb-6 flex flex-wrap items-center justify-between gap-2">` block containing "← Powrót do edycji" and "Zamknij transakcję →". Insert `<ListingTabs>` in the same position.

#### 3. `documents.astro`

**File**: `src/pages/dashboard/listings/[id]/documents.astro`

**Intent**: Replace the existing partial tab bar (lines 84-102) — which shows only 3 tabs and has a separate back link (lines 84-86) — with `<ListingTabs listingId={listing.id} activeTab="documents" />`.

**Contract**: Remove both the `<div class="mb-6 flex items-center justify-between">` back-link block (lines 84-86) and the `<div class="mb-6 flex gap-4 border-b border-white/10 pb-4">` tab block (lines 88-102). Insert `<ListingTabs>` in their place.

#### 4. `contacts.astro`

**File**: `src/pages/dashboard/listings/[id]/contacts.astro`

**Intent**: (1) Fix the missing `return` on the two redirect calls so `listing` cannot be null past those guards, then (2) replace the back link + "Dokumenty →" navigation div (lines 75-89) with `<ListingTabs listingId={listing.id} activeTab="contacts" />`.

**Contract**:
1. On `contacts.astro:21` change `Astro.redirect(...)` → `return Astro.redirect(...)`.
2. On `contacts.astro:33` change `Astro.redirect(...)` → `return Astro.redirect(...)`.
3. Remove the outer `<div class="mb-6 flex flex-wrap items-center justify-between gap-2">` block containing the dashboard back link and the conditional documents link.
4. Insert `<ListingTabs listingId={listing.id} activeTab="contacts" />` before the error banners.

#### 5. `close.astro`

**File**: `src/pages/dashboard/listings/[id]/close.astro`

**Intent**: Replace the breadcrumb nav block (lines 109-123) with `<ListingTabs listingId={listing.id} activeTab="close" />`.

**Contract**: Remove the `<div class="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">` breadcrumb block. Insert `<ListingTabs>` in its place.

### Success Criteria

#### Automated Verification

- TypeScript compilation passes: `npx tsc --noEmit`
- Dev server starts without errors: `npm run dev`

#### Manual Verification

- Navigating to any of the 5 listing detail pages shows the same tab bar with the correct tab highlighted
- Back link on all pages navigates to `/dashboard`
- Clicking each tab navigates to the correct page with that tab highlighted
- Zamknij tab renders in red tones on all pages
- No old navigation artifacts remain (no orphaned back links or arrow links)
- Mobile viewport: tab bar wraps gracefully without overlapping content

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to any future phases.

---

## Testing Strategy

### Manual Testing Steps

1. Open a listing detail page; verify the tab bar appears with all 5 tabs
2. Click each tab in sequence; confirm the clicked tab becomes the active (non-link) tab
3. Confirm the "← Powrót do panelu" link appears above the tab bar on every page and navigates to `/dashboard`
4. On any page, confirm "Zamknij" tab is visually distinct (red tone vs blue tone for others)
5. On `/close`, confirm "Zamknij" is the active tab and renders `text-red-300 font-medium`
6. Resize browser to mobile width; confirm tab bar wraps without UI breakage

## References

- Documents tab bar pattern (to replicate): `src/pages/dashboard/listings/[id]/documents.astro:88-102`
- Existing listing component neighbor: `src/components/listings/ListingCard.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Create ListingTabs Component

#### Automated

- [x] 1.1 TypeScript compilation passes with no new errors: `npx tsc --noEmit` — 08eeefa
- [x] 1.2 No import errors when the component is referenced — 08eeefa

#### Manual

- [x] 1.3 Component file exists at `src/components/listings/ListingTabs.astro` — 74af929
- [x] 1.4 Props interface matches the union literal type exactly — 74af929
- [x] 1.5 Zamknij tab renders with red tone classes, other tabs with blue tone classes — 74af929

### Phase 2: Wire into All 5 Pages

#### Automated

- [x] 2.1 TypeScript compilation passes: `npx tsc --noEmit` — 74af929
- [x] 2.2 Dev server starts without errors: `npm run dev` — 74af929

#### Manual

- [x] 2.3 All 5 pages show the same tab bar with correct active tab highlighted — 74af929
- [x] 2.4 Back link navigates to `/dashboard` on all pages — 74af929
- [x] 2.5 Each tab navigates to the correct page — 74af929
- [x] 2.6 Zamknij tab renders in red tones on all pages — 74af929
- [x] 2.7 No old navigation artifacts remain — 74af929
- [x] 2.8 Mobile viewport: tab bar wraps gracefully — 74af929
