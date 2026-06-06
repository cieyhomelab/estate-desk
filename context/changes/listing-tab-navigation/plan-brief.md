# Listing Tab Navigation — Plan Brief

> Full plan: `context/changes/listing-tab-navigation/plan.md`

## What & Why

The 5 listing detail pages (edit, pricing, documents, contacts, close) each use a different navigation pattern — arrow links, breadcrumbs, partial tab bars — making the UI feel inconsistent and leaving contacts and close hidden from the tab flow. We're replacing all of them with a single shared `ListingTabs.astro` component that renders a uniform tab bar.

## Starting Point

`documents.astro` already has the closest thing to a tab bar (edit | pricing | documents) with an established visual style (`text-blue-200/70` inactive, `text-white font-medium` active, `border-b border-white/10` separator). The other 4 pages have ad-hoc navigation that will be removed.

## Desired End State

Every listing detail page shows the same nav block:

```
← Powrót do panelu

Edytuj  Cena i prowizja  Dokumenty  Kontakty  Zamknij(red)
────────────────────────────────────────────────────────────
```

The active tab is an inert `<span>`; all pages link back to `/dashboard`. Zamknij always renders in red tones to signal its terminal nature.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| Tab set | All 5 tabs | Full discoverability; contacts and close were previously hidden |
| Zamknij styling | Red tones (inactive: `text-red-300/70`, active: `text-red-300`) | Matches delete-button red already used in the app; signals terminal action |
| Active tab detection | `activeTab` prop (string literal) | Explicit is better — no fragile URL coupling |
| Back link ownership | Inside the component | One change fixes all pages; all 5 currently point to `/dashboard` |

## Scope

**In scope:**
- New `src/components/listings/ListingTabs.astro` component
- Replace navigation in all 5 listing detail pages

**Out of scope:**
- Conditional Zamknij tab dimming based on `listing.status`
- Any API, database, or Layout changes
- JS interactivity (pure Astro SSR)

## Architecture / Approach

Pure Astro component with two props (`listingId`, `activeTab`). Tabs defined as a static array in the component. Each page imports and renders the component, removing its own navigation block. No shared state, no hydration.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Create ListingTabs component | Isolated, typesafe component with all 5 tabs | Tailwind class names must match the existing design tokens exactly |
| 2. Wire into all 5 pages | Old nav removed, component wired in | Missing or wrong `activeTab` value shows the wrong tab highlighted |

**Prerequisites:** None — no DB migrations, no env vars, no third-party setup  
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- If the tab bar wraps to 2 lines on narrow mobile viewports, it may need `flex-wrap` or a scroll container — validate in Phase 2 manual testing
- All 5 pages are assumed to always have a valid `listing.id` by the time the tab component renders (each page already guards and redirects otherwise)

## Success Criteria (Summary)

- All 5 listing detail pages show the identical tab bar with the correct tab active
- Back link goes to `/dashboard` on every page
- Zamknij tab is visually distinct in red tones across all pages
