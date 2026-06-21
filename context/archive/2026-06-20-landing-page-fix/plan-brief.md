# Landing Page Fix — Plan Brief

> Full plan: `context/changes/landing-page-fix/plan.md`

## What & Why

Redesign EstateDesk's three auth pages (signin, signup, confirm-email) from a minimal centered card to a premium two-column dark SaaS layout. The current screen is too plain, has excess white space, and looks like a placeholder — the goal is to match the dark dashboard aesthetic: deep navy background, subtle blue/indigo glow, glassmorphism card, and polished typography.

## Starting Point

All three auth pages share the same structure: a single `bg-cosmic` full-screen div with a centered `max-w-sm` card. The `bg-cosmic` utility already has the correct background (grid + radial glows + deep navy) so no changes are needed there. The submit button is purple and the inputs are `bg-white/10` glass at standard height — both need restyling.

## Desired End State

Login, signup, and confirm-email all show a full-screen two-column layout: left hero with EstateDesk branding, badge, large Polish headline, description, and benefits list; right panel with a glassmorphism card hosting the form. Button is a blue/indigo gradient. Inputs are dark, 58 px tall, with leading icons. On mobile the layout stacks vertically with an abbreviated hero (logo + headline only, benefits hidden).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| Pages in scope | All three auth pages | Consistent auth experience — no jarring style shift between sign-in and sign-up |
| CSS location | Extend global.css with @utility + @layer components | Consistent with existing bg-cosmic pattern; no new files |
| Forgot password link | Placeholder href="/forgot-password" | Route doesn't exist yet; link is UI-complete without blocking this task |
| Mobile hero | Abbreviated hero above form (logo + headline, benefits hidden) | Brand presence preserved without overwhelming the form |
| SubmitButton wrapper | Replace shadcn `<Button>` with native `<button>` | Shadcn's cva-generated base classes conflict with the new auth-button CSS utility |

## Scope

**In scope:**
- `src/styles/global.css` — new @layer components + @utility blocks for all auth classes
- `src/pages/auth/signin.astro`, `signup.astro`, `confirm-email.astro` — two-column layout
- `src/components/auth/FormField.tsx` — restyle inputs/labels
- `src/components/auth/SubmitButton.tsx` — replace shadcn Button with native button + auth-button class
- `src/components/auth/PasswordToggle.tsx` — restyle toggle
- `src/components/auth/SignInForm.tsx` — Polish copy, forgot-password link

**Out of scope:**
- Auth API routes — no logic changes
- `/forgot-password` route implementation
- Any page outside the auth folder
- `bg-cosmic` utility (already correct)

## Architecture / Approach

CSS-first: define all auth utilities and the auth-hero pseudo-element block in `global.css`, then update the Astro pages to use the two-column structure and the React components to use the new class names. The page structure (hero + panel) lives in `.astro` files; form logic stays in React components.

Key CSS split: `.auth-hero` (with `::before`/`::after` pseudo-elements) goes in `@layer components`; all other auth classes use `@utility`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. CSS Foundation | All auth utilities in global.css; prefers-reduced-motion | Auth-hero pseudo-elements must use @layer components, not @utility |
| 2. signin.astro + auth components | Full two-column login page; restyled inputs, button, toggle | SubmitButton shadcn conflict — solved by native button replacement |
| 3. signup.astro | Signup page visually consistent with signin | SignUpForm fields also pick up auth-input from FormField changes in Phase 2 |
| 4. confirm-email.astro | Confirm-email page on same two-column layout | Content-only card (no form) — minor structural adaptation |

**Prerequisites:** Phase 1 CSS must land before Phases 2–4 (classes must exist before they're used).  
**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- `SignUpForm.tsx` is assumed to share `FormField` and `SubmitButton` — it will pick up the restyled components automatically in Phase 3. If it has its own inline input/button styles, those will need adjustment.
- The `auth-input-error` modifier uses `!important` on border-color to override the default `auth-input` border within the same CSS layer. If the project later removes Tailwind's `important` plugin, revisit.

## Success Criteria (Summary)

- All three auth pages show the two-column dark SaaS layout matching `docs/design/landing_page.png`
- Blue/indigo gradient submit button (no purple), dark 58 px inputs with icons, glassmorphism card
- Layout responds correctly at mobile widths: single column, abbreviated hero, full-width card
