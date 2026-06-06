# Home Page Redesign — Plan Brief

> Full plan: `context/changes/home-page-redesign/plan.md`

## What & Why

Replace the "10x Astro Starter" placeholder at `/` with a branded EstateDesk landing page in Polish. The roadmap flagged this slice (S-03) as blocked pending a visual design decision; planning has now resolved that decision and the implementation is unblocked.

## Starting Point

`src/pages/index.astro` renders `src/components/Welcome.astro`, which displays an English-language centered hero for a generic starter kit — wrong branding, wrong language, includes a Topbar. The dark cosmic visual style (`bg-cosmic`, frosted glass cards, purple CTAs) established by the auth pages and dashboard is already the right foundation to build on.

## Desired End State

The home page shows a two-column full-screen layout: left panel has the EstateDesk logo, the Polish headline "Twój panel nieruchomości.", and the subtitle; right panel has two frosted-glass action blocks — Sign In and Sign Up — each with contextual Polish copy and a button linking to the respective auth route. No Topbar. Browser tab reads "EstateDesk". Stacks vertically on mobile.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| Layout structure | Two-column side-by-side | User-specified: branding on left, auth on right |
| Feature cards | Removed | Replaced by auth panel; a single-agent app has no audience to "sell" |
| Topbar | Removed | Standalone page like auth pages — CTAs are explicit in the panel |
| Logo | Small image above headline (left panel) | User-specified; `public/estatedesk.png` already present |
| Auth panel style | Two stacked frosted-glass action blocks | Matches frosted glass pattern used across auth pages |
| Polish copy | Contextual one-liners per block | "Masz już konto?" / "Nowy użytkownik?" framing |
| Page title | "EstateDesk" | Replaces the "10x Astro Starter" default in Layout.astro |

## Scope

**In scope:**
- `src/components/Welcome.astro` — full rewrite with two-column layout
- `src/pages/index.astro` — add `title="EstateDesk"` prop to `<Layout>`

**Out of scope:**
- Auth pages, dashboard, any other route
- New API routes or backend logic
- Analytics, tracking, A/B testing
- Address validation or offline support

## Architecture / Approach

Two file changes only. The cosmic background scaffold (orbs + star field) from the existing `Welcome.astro` is preserved and re-used in the rewrite. The new layout replaces the centered hero + feature cards with a flex two-column container. No new components or routes needed.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Two-Column EstateDesk Home Page | Branded Polish landing page with Sign In / Sign Up actions | Logo (`estatedesk.png`) may need size tweaking at runtime; verify during manual testing |

**Prerequisites:** None (S-01 and S-02 are done; this slice is independent)
**Estimated effort:** ~1 session; 2 files, no new infrastructure

## Open Risks & Assumptions

- `public/estatedesk.png` is 891KB — it should be served fine by Cloudflare Workers but should be visually verified at the intended display size (h-16)
- No existing E2E test covers `/`; manual verification is the only gate

## Success Criteria (Summary)

- Home page at `/` shows two-column EstateDesk layout in Polish with no starter content
- Sign In and Sign Up buttons navigate to the correct auth routes
- No regression on any other page
