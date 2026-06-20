# Landing Page Fix — Login UI Redesign Implementation Plan

## Overview

Redesign all three auth pages (signin, signup, confirm-email) from a centered single-column card to a premium two-column dark SaaS layout: hero section on the left with branding + benefits, glassmorphism login card on the right. No logic changes — UI/styling only.

## Current State Analysis

- `src/pages/auth/signin.astro`: centered single-column, English copy ("Sign in", "Don't have an account?"), small `max-w-sm` card over `bg-cosmic` background.
- `src/pages/auth/signup.astro`: identical structure to signin, English copy ("Sign up").
- `src/pages/auth/confirm-email.astro`: same structure, displays confirmation message.
- `src/styles/global.css`: `bg-cosmic` utility already has the correct background (grid + glow + deep navy) — **no changes needed**.
- `src/components/auth/SubmitButton.tsx`: wraps shadcn `<Button>` with classes `w-full rounded-lg bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-500`. The shadcn wrapper will conflict with a new CSS utility; must be replaced with a native `<button>`.
- `src/components/auth/FormField.tsx`: `inputBase` constant has `bg-white/10 border ... focus:ring-purple-400`; label uses `mb-1 block text-sm text-blue-100/80`.
- `src/components/auth/PasswordToggle.tsx`: `absolute top-1/2 right-3 -translate-y-1/2 text-white/40`.
- `src/components/auth/SignInForm.tsx`: English labels ("Email", "Password"), English placeholders, English button text.

## Desired End State

All three auth pages show a full-screen two-column dark layout: left hero with branding, badge, large Polish headline, description, and benefits list (hidden on mobile); right panel with a glassmorphism card hosting the form. Button is blue/indigo gradient. Inputs are dark, 58 px tall, with leading icons. On mobile (< 1024 px), layout collapses to single column — hero shows logo + headline only, benefits hidden, card full-width with reduced padding.

### Key Discoveries

- `bg-cosmic` utility (`global.css:113–129`) already matches the design spec's bg-cosmic exactly — not a blocker.
- `SubmitButton.tsx:15` wraps `<Button>` from `@/components/ui/button` (shadcn). The shadcn component applies its own Tailwind base classes via cva, which would override a new CSS utility unless the wrapper is replaced with a plain `<button>`.
- `FormField.tsx:40` wraps the input in a plain `<div class="relative">` and `<span class="absolute top-1/2 left-3 ...">` for the icon. These must be replaced with `auth-input-wrap` and `auth-input-icon`.
- No `/forgot-password` route exists; the link will be a dead placeholder.

## What We're NOT Doing

- No changes to auth API routes (`/api/auth/signin`, `/api/auth/signup`).
- No changes to form validation logic in `SignInForm.tsx` or `SignUpForm.tsx`.
- No changes to `bg-cosmic` (already correct).
- No new `tailwind.config.js` (Tailwind v4 — forbidden).
- No changes to `Layout.astro` or any page outside the auth folder.
- No `/forgot-password` route implementation.

## Implementation Approach

Add auth-specific CSS utilities to `global.css`, then restructure the three auth Astro pages to the two-column layout. Auth React sub-components (`FormField`, `SubmitButton`, `PasswordToggle`) get restyled classes; `SignInForm.tsx` gains Polish copy and a forgot-password link.

## Critical Implementation Details

**`@utility` cannot express pseudo-elements on the element itself**: Tailwind v4's `@utility` directive creates single-class utilities. `.auth-hero` requires `::before` and `::after` pseudo-elements for the glow blur and grid overlay. These must go in `@layer components` (a regular CSS block), not `@utility`. All other auth classes (no pseudo-elements) use `@utility`.

**Replace `inputBase` entirely, do not add classes alongside it**: `FormField.tsx:51` applies `inputBase` plus conditional border/ring overrides via `cn()`. If `auth-input` is added alongside the old `inputBase` classes, both sit in the same Tailwind utilities layer at equal specificity — last-defined wins, creating fragile ordering dependence. The fix: replace `inputBase` with `"auth-input"` and handle error state with a separate `auth-input-error` utility applied conditionally.

**Replace shadcn `<Button>` with a plain `<button>` in `SubmitButton.tsx`**: The shadcn `<Button>` merges its own cva-generated Tailwind classes with the passed `className` via `cn()`. Those base classes (background, padding, font-size) sit in the same layer as `auth-button` and will conflict unpredictably. Using a native `<button>` removes this conflict entirely.

**z-index layering inside the hero**: The `::before` (glow) and `::after` (grid overlay) pseudo-elements use `position: absolute; inset: 0`, covering the entire hero section. Any direct content without `z-index: 1` will be hidden beneath them. Every hero content container must carry the `auth-hero-content` class (`position: relative; z-index: 1`).

---

## Phase 1: CSS Foundation

### Overview

Add all auth-specific CSS to `global.css` before touching any page or component.

### Changes Required:

#### 1. Auth hero component styles

**File**: `src/styles/global.css`

**Intent**: Add a `@layer components` block for `.auth-hero` and its pseudo-elements (glow blur + grid overlay). Add `.auth-hero-content` as a `@utility` for the z-index wrapper.

**Contract**: Append after the existing `@layer base` block (after line 138). The `.auth-hero::before` creates a 560×560 px radial glow at top-left offset with `filter: blur(8px)`. The `.auth-hero::after` creates the grid overlay with `mask-image` fading right. All values are taken verbatim from `docs/design/estatedesk-login-ui-poprawki.md` § "Lewa sekcja hero".

```css
@layer components {
  .auth-hero {
    position: relative;
    overflow: hidden;
  }
  .auth-hero::before {
    content: "";
    position: absolute;
    width: 560px;
    height: 560px;
    left: -160px;
    top: 18%;
    background: radial-gradient(circle, rgba(37, 99, 235, 0.22), transparent 68%);
    filter: blur(8px);
    pointer-events: none;
  }
  .auth-hero::after {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 36px 36px;
    mask-image: linear-gradient(to right, black, transparent 72%);
    pointer-events: none;
  }
}
```

#### 2. Auth utility classes

**File**: `src/styles/global.css`

**Intent**: Add `@utility` blocks for all remaining auth classes: panel, card, badge, typography, input parts, link, button, and the `prefers-reduced-motion` media query. Follow the same pattern as `bg-cosmic`.

**Contract**: Add after the `@layer components` block just added. Include the following utilities in order: `auth-hero-content`, `auth-panel`, `login-card`, `auth-badge`, `auth-title`, `auth-description`, `auth-benefits`, `auth-benefit`, `auth-benefit-icon`, `auth-label`, `auth-input-wrap`, `auth-input-icon`, `auth-input-action`, `auth-input` (with nested `::placeholder` and `:focus` states), `auth-input-error` (override for red error border/ring), `auth-link` (with `:hover`), `auth-button` (with `:hover` and `:active`), `auth-login-title`, `auth-login-subtitle`. CSS values verbatim from the design spec. Notable: `auth-input-error` is a modifier class applied alongside `auth-input` for validation failures:

```css
@utility auth-input-error {
  border-color: rgba(248, 113, 113, 0.6) !important;
  &:focus {
    box-shadow: 0 0 0 4px rgba(248, 113, 113, 0.16);
    border-color: rgba(248, 113, 113, 0.6);
  }
}
```

Also add the responsive overrides as a regular `@media` block (not inside `@utility`) for `.auth-hero`, `.auth-panel`, `.auth-title`, `.login-card` at `max-width: 1024px` and `max-width: 768px`, plus the `prefers-reduced-motion` block:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}
```

### Success Criteria:

#### Automated Verification:

- `npm run build` completes without errors

#### Manual Verification:

- Generated CSS includes `.auth-hero`, `.auth-hero::before`, `.auth-hero::after`, `.auth-input`, `.auth-button` (confirm via browser DevTools on any page or by inspecting the build output)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Restructure signin.astro + Restyle Auth Components

### Overview

Rebuild `signin.astro` to the two-column layout and restyle the shared React auth sub-components. This is the main visual change.

### Changes Required:

#### 1. SignInForm.tsx — Polish copy + forgot-password link

**File**: `src/components/auth/SignInForm.tsx`

**Intent**: Update labels and placeholders to Polish. Add the "Zapomniałeś hasła?" link between the password field and the submit button. Update validation error messages to Polish. Update button text to Polish.

**Contract**:
- Email FormField: `label="Email"`, `placeholder="ty@example.com"`, validation errors → `"Email jest wymagany"` / `"Podaj poprawny adres email"`
- Password FormField: `label="Hasło"`, `placeholder="Twoje hasło"`, validation error → `"Hasło jest wymagane"`
- After the password `<FormField>` and before `<ServerError>`, add:
  ```tsx
  <div className="mt-4 text-right">
    <a className="auth-link" href="/forgot-password">Zapomniałeś hasła?</a>
  </div>
  ```
- SubmitButton: `pendingText="Logowanie..."`, children `"Zaloguj się"`

#### 2. FormField.tsx — restyle inputs and labels

**File**: `src/components/auth/FormField.tsx`

**Intent**: Replace the `inputBase` constant and its conditional border classes with `auth-input` + optional `auth-input-error`. Replace label, icon wrapper, and input container classes with auth-* utilities.

**Contract**:
- `inputBase` constant replaced with `"auth-input"`
- `className` on `<input>`: `cn("auth-input", error && "auth-input-error")`
- Input wrapper `<div className="relative">` (line 40, direct parent of the icon span and input): replace its class with `"auth-input-wrap"`. The outer bare `<div>` at line 36 (field root, also wraps label and error) is unchanged.
- Icon `<span>` (currently `absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40`): replace with `"auth-input-icon"`
- Label `<label>` (currently `mb-1 block text-sm text-blue-100/80`): replace with `"auth-label"`
- Error `<p>` and hint rendering below the input — keep as-is (styling is fine)
- The `endContent` slot `{endContent}` stays inside `auth-input-wrap` after the `<input>` — no change to JSX position

#### 3. SubmitButton.tsx — replace shadcn Button with native button

**File**: `src/components/auth/SubmitButton.tsx`

**Intent**: Replace the shadcn `<Button>` wrapper with a native `<button>` element styled with `auth-button`. Remove the shadcn import. Keep `useFormStatus` pending state logic unchanged.

**Contract**:
- Remove `import { Button } from "@/components/ui/button"`
- Change `<Button type="submit" disabled={pending} className="...">` to `<button type="submit" disabled={pending} className="auth-button">`
- The pending state check and children rendering (spinner span vs content span) remain identical

#### 4. PasswordToggle.tsx — restyle toggle button

**File**: `src/components/auth/PasswordToggle.tsx`

**Intent**: Replace absolute-position classes with `auth-input-action`.

**Contract**: Button className changes from `"absolute top-1/2 right-3 -translate-y-1/2 text-white/40 transition-colors hover:text-white/70"` to `"auth-input-action"`. The `auth-input-action` CSS positions the element identically (right: 16px, top: 50%, translateY -50%).

#### 5. signin.astro — two-column layout

**File**: `src/pages/auth/signin.astro`

**Intent**: Replace the centered single-column wrapper with a full two-column `<main>` element. Add the hero section on the left with logo, badge, headline, description, and benefits list. Add the right panel with the login card, Polish headings, the existing `<SignInForm>`, and the footer signup link.

**Contract**:
- Outer element: `<div class="bg-cosmic lg:grid lg:grid-cols-[1.35fr_0.85fr] min-h-screen">`
- Left section: `<section class="auth-hero flex min-h-screen flex-col justify-between px-10 py-10 lg:px-16">`
  - Top: `<div class="auth-hero-content flex items-center gap-3">` with home icon + "EstateDesk" bold text
  - Middle: `<div class="auth-hero-content max-w-3xl">` with badge, `<h1 class="auth-title">Twój panel nieruchomości.</h1>`, description `<p class="auth-description mt-8">`
  - Bottom: `<div class="auth-hero-content auth-benefits hidden lg:grid">` (hidden on mobile) with three benefit items using `auth-benefit` + `auth-benefit-icon` classes
- Right section: `<section class="auth-panel flex min-h-screen items-center justify-center px-8 py-10">`
  - Card: `<div class="login-card">`
    - `<h2 class="auth-login-title">Zaloguj się</h2>`
    - `<p class="auth-login-subtitle">Wprowadź dane, aby kontynuować</p>`
    - `<SignInForm serverError={error} client:load />`
    - `<p class="mt-7 text-center text-sm text-slate-400">Nie masz konta? <a class="auth-link" href="/auth/signup">Zarejestruj się</a></p>`
- Badge content: building icon (use `Home` from lucide or an SVG) + "Kompletny system dla agentów nieruchomości"
- Benefits: "Zarządzanie ofertami i cyklem życia", "Kolekcja dokumentów z checklistą", "Kalkulator prowizji agenta" — each as `<div class="auth-benefit"><span class="auth-benefit-icon">✓</span><span>...</span></div>`
- The frontmatter (server-side error extraction) remains unchanged
- Remove the old centered wrapper entirely

### Success Criteria:

#### Automated Verification:

- `npm run build` completes without errors
- `npx tsc --noEmit` passes (no TypeScript errors)

#### Manual Verification:

- `/auth/signin` shows two-column layout: dark hero left, card right
- Hero shows EstateDesk branding, badge, large "Twój panel nieruchomości." headline, description, three benefits
- Card shows "Zaloguj się" heading, dark tall inputs with leading icons (mail, lock), blue/indigo gradient button ("Zaloguj się")
- "Zapomniałeś hasła?" link visible right-aligned between password field and submit button
- "Nie masz konta? Zarejestruj się" footer visible below card form
- Password show/hide toggle functional (eye icon in input right-side)
- Submit button is blue/indigo gradient — not purple
- Server error (if passed via URL) renders correctly in the form
- Benefits list hidden on mobile viewport (< 1024 px)
- Mobile: single column, hero compact above form, card has reduced padding

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 3.

---

## Phase 3: Apply Layout to signup.astro

### Overview

Apply the same two-column hero + panel structure to the signup page.

### Changes Required:

#### 1. signup.astro — two-column layout

**File**: `src/pages/auth/signup.astro`

**Intent**: Identical structural change as signin.astro. The hero section reuses the same branding, headline, and benefits (they describe EstateDesk generally). The right panel card hosts `<SignUpForm>` with appropriate signup headings and footer.

**Contract**: Same outer `<div>` grid and `<section class="auth-hero ...">` as signin.astro. Right panel differences:
- Card heading: `<h2 class="auth-login-title">Utwórz konto</h2>`
- Card subtitle: `<p class="auth-login-subtitle">Wprowadź dane, aby się zarejestrować</p>`
- Component: `<SignUpForm serverError={error} client:load />`
- Footer: `<p class="mt-7 text-center text-sm text-slate-400">Masz już konto? <a class="auth-link" href="/auth/signin">Zaloguj się</a></p>`
- No forgot-password link in the signup card

#### 2. SignUpForm.tsx — Polish copy

**File**: `src/components/auth/SignUpForm.tsx`

**Intent**: Translate all user-visible strings to Polish to match the SignInForm.tsx treatment in Phase 2.

**Contract**:
- Email FormField: `label="Email"`, `placeholder="ty@example.com"`, validation error → `"Email jest wymagany"`
- Password FormField: `label="Hasło"`, `placeholder="Min. 6 znaków"`, validation errors → `"Hasło jest wymagane"` / `"Hasło musi mieć co najmniej ${MIN_PASSWORD_LENGTH} znaków"`
- Confirm password FormField: `label="Potwierdź hasło"`, `placeholder="Powtórz hasło"`, validation errors → `"Potwierdź swoje hasło"` / `"Hasła się nie zgadzają"`
- SubmitButton: `pendingText="Tworzenie konta..."`, children `"Utwórz konto"` (keep existing `icon={<UserPlus className="size-4" />}`)

### Success Criteria:

#### Automated Verification:

- `npm run build` completes without errors

#### Manual Verification:

- `/auth/signup` shows the same two-column dark layout as `/auth/signin`
- Card heading "Utwórz konto", three form fields (email, password, confirm-password) styled with `auth-input`
- Form labels, placeholders, and validation errors display in Polish
- Footer links to signin
- Form labels, placeholders, and validation errors display in Polish
- Mobile layout collapses correctly

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 4.

---

## Phase 4: Apply Layout to confirm-email.astro

### Overview

Apply the two-column layout to the confirm-email page. The right panel hosts the existing confirmation content inside the `login-card`.

### Changes Required:

#### 1. confirm-email.astro — two-column layout

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: Same outer grid and hero section as signin.astro. The right panel card wraps the existing conditional content (emoji, heading, description, back-to-signin link) instead of a form.

**Contract**: Same `<div>` grid + `<section class="auth-hero ...">` as the other pages. Right panel:
- `<section class="auth-panel flex min-h-screen items-center justify-center px-8 py-10">`
  - `<div class="login-card text-center">`
    - `<div class="mb-4 text-5xl">{content.emoji}</div>`
    - `<h1 class="auth-login-title mb-3">{content.heading}</h1>`
    - `<p class="auth-login-subtitle mb-6">{content.description}</p>`
    - `<a href="/auth/signin" class="auth-link text-sm">{content.linkText}</a>`
- Frontmatter (`isAutoConfirmed`, `content` object) remains unchanged

### Success Criteria:

#### Automated Verification:

- `npm run build` completes without errors

#### Manual Verification:

- `/auth/confirm-email` (navigate to it or trigger signup flow in dev) shows consistent two-column dark layout
- Confirmation card: emoji, heading, description, signin link — all readable on dark glassmorphism card
- No regressions on signin or signup pages

---

## Testing Strategy

### Manual Testing Steps:

1. Visit `/auth/signin` — two-column layout, hero + card visible
2. Focus email input → blue ring appears (`auth-input:focus`)
3. Submit empty form → field errors appear with red border (`auth-input-error`)
4. Enter valid email + invalid password → only password error
5. Toggle password visibility → eye icon switches, input type changes
6. Resize to mobile (< 1024 px) → single column, benefits hidden, card compact
7. Visit `/auth/signup` — same visual style, three fields
8. Visit `/auth/confirm-email` — same dark two-column layout
9. Open browser DevTools → set `prefers-reduced-motion: reduce` → verify all transitions disabled

## References

- Design spec: `docs/design/estatedesk-login-ui-poprawki.md`
- Target design screenshot: `docs/design/landing_page.png`
- Auth pages: `src/pages/auth/signin.astro`, `src/pages/auth/signup.astro`, `src/pages/auth/confirm-email.astro`
- Auth components: `src/components/auth/FormField.tsx`, `src/components/auth/SubmitButton.tsx`, `src/components/auth/PasswordToggle.tsx`, `src/components/auth/SignInForm.tsx`
- Global CSS: `src/styles/global.css` (bg-cosmic at line 113)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: CSS Foundation

#### Automated

- [x] 1.1 `npm run build` completes without errors

#### Manual

- [x] 1.2 Generated CSS includes `.auth-hero`, `.auth-hero::before`, `.auth-hero::after`, `.auth-input`, `.auth-button` (verified via DevTools or build output)

### Phase 2: Restructure signin.astro + Restyle Auth Components

#### Automated

- [ ] 2.1 `npm run build` completes without errors
- [ ] 2.2 `npx tsc --noEmit` passes

#### Manual

- [ ] 2.3 `/auth/signin` shows two-column layout: dark hero left, card right
- [ ] 2.4 Hero shows EstateDesk branding, badge, large headline, description, three benefits
- [ ] 2.5 Card shows "Zaloguj się" heading, dark tall inputs with leading icons, blue/indigo gradient button
- [ ] 2.6 "Zapomniałeś hasła?" link visible right-aligned between password field and submit button
- [ ] 2.7 "Nie masz konta? Zarejestruj się" footer visible
- [ ] 2.8 Password show/hide toggle functional
- [ ] 2.9 Submit button is blue/indigo gradient — not purple
- [ ] 2.10 Benefits list hidden on mobile, visible on desktop
- [ ] 2.11 Mobile: single column, hero compact, card full-width with reduced padding

### Phase 3: Apply Layout to signup.astro

#### Automated

- [ ] 3.1 `npm run build` completes without errors

#### Manual

- [ ] 3.2 `/auth/signup` shows same two-column dark layout as `/auth/signin`
- [ ] 3.3 Card heading "Utwórz konto", three fields styled with auth-input
- [ ] 3.4 Form labels, placeholders, and validation errors display in Polish
- [ ] 3.5 Mobile layout collapses correctly

### Phase 4: Apply Layout to confirm-email.astro

#### Automated

- [ ] 4.1 `npm run build` completes without errors

#### Manual

- [ ] 4.2 `/auth/confirm-email` shows consistent two-column dark layout
- [ ] 4.3 Confirmation card readable; signin link styled with auth-link
- [ ] 4.4 No regressions on signin or signup pages
