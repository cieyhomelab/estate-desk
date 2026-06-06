# Home Page Redesign Implementation Plan

## Overview

Replace the Astro starter placeholder at `/` with a two-column EstateDesk-branded landing page in Polish. The left panel presents the logo, headline, and subtitle; the right panel has two frosted-glass action blocks linking to the existing Sign In and Sign Up routes.

## Current State Analysis

`src/pages/index.astro` renders `src/components/Welcome.astro` inside `<Layout>` with no `title` prop (defaults to "10x Astro Starter"). `Welcome.astro` renders a full-screen cosmic background with an embedded `<Topbar />`, a centered English-language hero ("10x Astro Starter"), and a 3-column feature cards grid describing the generic starter kit.

The design system is fully established: `bg-cosmic` utility, frosted glass cards (`bg-white/10 backdrop-blur-xl border-white/10 rounded-2xl`), purple primary buttons (`bg-purple-600 hover:bg-purple-500`), and `text-purple-300` links are used consistently across auth pages and dashboard. The `public/estatedesk.png` logo asset is present.

## Desired End State

The home page (`/`) displays a two-column full-screen page using the dark cosmic aesthetic:
- **Left**: Small EstateDesk logo → H1 "Twój panel nieruchomości." → subtitle "Kompletne narzędzie dla agenta nieruchomości - od początku do zamknięcia transakcji"
- **Right**: Two frosted-glass action blocks — Sign In ("Masz już konto? Zaloguj się i zarządzaj swoimi ogłoszeniami.") and Sign Up ("Nowy użytkownik? Utwórz konto i zacznij pracować.") with buttons linking to `/auth/signin` and `/auth/signup`
- No Topbar (standalone, like auth pages)
- Browser tab title: "EstateDesk"
- Mobile: stacks vertically (branding above, auth blocks below)

### Key Discoveries:

- `src/components/Welcome.astro:28` — `<Topbar />` is embedded inside Welcome; must be removed for the standalone design
- `src/pages/index.astro:6` — `<Layout>` has no `title` prop; defaults to "10x Astro Starter" via `src/layouts/Layout.astro:10`
- `public/estatedesk.png` — logo asset present; served at `/estatedesk.png`
- Auth routes confirmed: `/auth/signin` and `/auth/signup`
- Frosted glass pattern from auth pages: `rounded-2xl border border-white/10 bg-white/10 p-8 text-white backdrop-blur-xl`
- No existing E2E tests for the home page route

## What We're NOT Doing

- No Topbar on the home page
- No feature cards section
- No analytics or tracking
- No changes to auth pages, dashboard, or any other route
- No new API routes or backend logic

## Implementation Approach

Two file changes only. `index.astro` gets a `title` prop. `Welcome.astro` is rewritten in full — the old content (starter hero, feature cards, Topbar) shares no reusable elements with the new two-column design. No new files or components are needed.

## Phase 1: Two-Column EstateDesk Home Page

### Overview

Rewrite `Welcome.astro` with the branded two-column layout and remove the embedded Topbar. Update `index.astro` to pass the correct page title.

### Changes Required:

#### 1. Page title

**File**: `src/pages/index.astro`

**Intent**: Pass the app name as the page title so the browser tab no longer reads "10x Astro Starter".

**Contract**: Add `title="EstateDesk"` prop to the `<Layout>` element.

#### 2. Welcome component rewrite

**File**: `src/components/Welcome.astro`

**Intent**: Replace the starter placeholder content with the two-column EstateDesk landing page. Remove the embedded Topbar. Preserve the cosmic background scaffold (orbs + star field) and apply it to the new layout.

**Contract**: The rewritten component renders:
- No `<Topbar />` import or usage
- Full-screen `bg-cosmic` background with the existing cosmic orb and star-field decorations (`Welcome.astro:6-25` structure preserved)
- A two-column flex container (`relative z-10 flex flex-col md:flex-row items-center justify-center min-h-screen gap-12 px-8 py-16`) as the main content wrapper
- **Left column**: `<Image src="/estatedesk.png" alt="EstateDesk" width={64} height={64} class="h-16 w-auto mb-6" />` (Astro `<Image>` from `astro:assets` — auto-converts to WebP; requires `import { Image } from 'astro:assets'` in the frontmatter) → `<h1>` "Twój panel nieruchomości." (gradient text matching the app's white/blue-200 palette) → `<p>` subtitle (text-blue-100/70)
- **Right column**: two frosted-glass blocks stacked with `flex flex-col gap-4`; each block uses `rounded-2xl border border-white/10 bg-white/10 p-6 backdrop-blur-xl text-white`; Sign In block has a `bg-purple-600 hover:bg-purple-500` button linking to `/auth/signin`; Sign Up block has a `border border-white/20 hover:bg-white/10` button linking to `/auth/signup`

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Type checking passes: `npx astro check`

#### Manual Verification:

- Home page (`/`) renders a two-column layout: branding on left, auth blocks on right
- EstateDesk logo appears above the headline on the left
- Headline reads "Twój panel nieruchomości." and subtitle is visible below it
- Sign In block shows Polish copy and its button navigates to `/auth/signin`
- Sign Up block shows Polish copy and its button navigates to `/auth/signup`
- Browser tab reads "EstateDesk"
- At mobile width (< 768px) layout stacks vertically: branding above, auth blocks below
- No Topbar visible on home page
- No visual regression on `/auth/signin`, `/auth/signup`, or `/dashboard`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Manual Testing Steps:

1. Open `/` — verify two-column layout, logo visible, Polish headline and subtitle present
2. Click "Zaloguj się" button — verify navigation to `/auth/signin`
3. Click "Zarejestruj się" button — verify navigation to `/auth/signup`
4. Resize to mobile width — verify vertical stacking with branding above auth blocks
5. Check browser tab title reads "EstateDesk"
6. Open `/dashboard` and `/auth/signin` — verify no visual regression

## References

- PRD: `context/foundation/prd.md` (FR-005, §Secondary success criteria)
- Roadmap: `context/foundation/roadmap.md` (S-03)
- Auth page pattern to match: `src/pages/auth/signin.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Two-Column EstateDesk Home Page

#### Automated

- [x] 1.1 Lint passes: `npm run lint` — ba99fdd
- [x] 1.2 Type checking passes: `npx astro check` — ba99fdd

#### Manual

- [x] 1.3 Two-column layout renders with branding on left, auth blocks on right — ba99fdd
- [x] 1.4 EstateDesk logo appears above headline — ba99fdd
- [x] 1.5 Sign In navigates to /auth/signin; Sign Up to /auth/signup — ba99fdd
- [x] 1.6 Browser tab reads "EstateDesk" — ba99fdd
- [x] 1.7 Mobile layout stacks vertically — ba99fdd
- [x] 1.8 No Topbar visible on home page — ba99fdd
- [x] 1.9 No regression on /auth/signin, /auth/signup, /dashboard — ba99fdd
