# Help Page — Plan Brief

> Full plan: `context/changes/help-page/plan.md`

## What & Why

Wire up the Pomoc button on the Dashboard — currently a non-interactive `<span>` — to navigate to a new `/help` page. The help page provides the sole agent with in-app Polish-language documentation for the four core workflows, so they have a reference when returning after a break.

## Starting Point

DashboardHeader renders Pomoc as a disabled-looking `<span class="text-white/30 select-none">` with no href. The middleware only protects `/dashboard`; a `/help` route would be publicly accessible by default. No `src/pages/help.astro` exists.

## Desired End State

The Pomoc nav link navigates to `/help`, shows an active state when on that page, and the page displays four Polish content sections (creating listings, documents & checklist, commission & pricing, contacts & closing) with a "Powrót do dashboardu" link. Unauthenticated visits redirect to `/`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Route protection | Add `/help` to middleware `PROTECTED_ROUTES` | Centralised; consistent with how `/dashboard` is protected; no inline auth check needed in the page. |
| Nav active state | Extend `activePage` prop to `"settings" \| "help"` | Zero-cost addition — the prop and `class:list` pattern already exist on the Settings link. |
| Content storage | Inline in `help.astro` | PRD §Non-Goals explicitly rules out CMS; inline is the simplest approach for a sole-user app. |
| Help content | Real Polish content now | Page should be immediately usable; user can edit a single .astro file when workflows change. |

## Scope

**In scope:**
- `middleware.ts` — add `"/help"` to `PROTECTED_ROUTES`
- `DashboardHeader.astro` — Pomoc `<span>` → `<a href="/help">` with active styling
- `src/pages/help.astro` — new static page, four Polish sections, back link

**Out of scope:**
- Content Collections / Markdown files for help content
- Public access to `/help`
- URL-based deep-linking to individual sections
- Any changes to `/dashboard` routes, listing forms, or API routes

## Architecture / Approach

Pure Astro, no React islands. The page follows the `commission.astro` pattern exactly: `Layout` wrapper + `DashboardHeader activePage="help"` + static HTML content + global body background style. Middleware handles the auth gate; the page itself has no Supabase call.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Route protection & DashboardHeader | Auth guard active; Pomoc is a working nav link with active state | DashboardHeader prop change must not break Settings active state |
| 2. Create `/help` page | Full page with 4 Polish sections, back link, correct styling | None — purely additive, no existing code touched |

**Prerequisites:** None — no other change depends on or blocks this.  
**Estimated effort:** ~1 session across 2 phases (< 1 hour of implementation).

## Open Risks & Assumptions

- The Polish content for the 4 sections is drafted by the implementer from knowledge of the app; the agent should review and update wording as the app evolves.
- `DashboardHeader.astro` has no unit tests — the activePage prop change is verified manually only.

## Success Criteria (Summary)

- Clicking Pomoc on the Dashboard navigates to `/help` and the link shows active styling.
- All four help sections render with real Polish content; "Powrót do dashboardu" link works.
- Unauthenticated visit to `/help` redirects to `/`; no regressions on any existing page.
