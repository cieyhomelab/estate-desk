<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Landing Page Fix — Login UI Redesign

- **Plan**: context/changes/landing-page-fix/plan.md
- **Scope**: All Phases (1–4 of 4)
- **Date**: 2026-06-20
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  3 warnings  7 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — useFormStatus never fires — spinner is dead code

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/auth/SubmitButton.tsx:11
- **Detail**: useFormStatus only tracks pending state for React Server Actions. Both forms use `method="POST" action="/api/auth/signin"` (a string URL → native HTML POST). `pending` stays false permanently — spinner, disabled state, and pendingText never activate. Pre-existing; plan preserved the broken pattern.
- **Fix A ⭐ Recommended**: Replace with local `useState` in SignInForm/SignUpForm; remove `useFormStatus` from SubmitButton.
  - Strength: Minimal change, no API restructure. Spinner and disabled actually work.
  - Tradeoff: Two-file edit; SubmitButton prop interface widens by one prop.
  - Confidence: HIGH — standard pattern for non-RSA forms.
  - Blind spot: None significant.
- **Fix B**: Wire React Server Action for form submission.
  - Strength: useFormStatus works as intended.
  - Tradeoff: Requires restructuring API layer — significant scope.
  - Confidence: LOW — high blast radius.
  - Blind spot: Cloudflare Workers adapter impact not verified.
- **Decision**: FIXED via Fix A

### F2 — FormField inputs missing aria-invalid and aria-describedby

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/auth/FormField.tsx:41–54
- **Detail**: When `error` is set the error `<p>` appears but has no programmatic link to the input. Screen readers won't announce the error on field focus and the field is not marked invalid.
- **Fix**: Add `aria-invalid={!!error}`, `aria-describedby={error ? \`${id}-error\` : undefined}` to `<input>`; add `id={\`${id}-error\`} role="alert"` to error `<p>`.
- **Decision**: FIXED

### F3 — /forgot-password is a silent 404 with no user indication

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/auth/SignInForm.tsx:81
- **Detail**: Plan documented this as a dead placeholder. The rendered link is visually identical to a working link — clicking it produces a 404 on a credential-recovery path.
- **Fix**: Added `aria-disabled="true"` and `title="Wkrótce dostępne"` to the anchor.
- **Decision**: FIXED

### F4 — confirm-email.astro panel uses h1; sibling pages use h2

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/auth/confirm-email.astro:80
- **Detail**: signin.astro and signup.astro correctly use `<h1>` in the hero and `<h2>` in the card. confirm-email.astro used `<h1>` for both (plan had an error vs. the sibling pattern).
- **Fix**: Changed `<h1 class="auth-login-title mb-3">` to `<h2 class="auth-login-title mb-3">`.
- **Decision**: FIXED

### F5 — serverError never reaches new auth pages (API routes redirect to /?error=)

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Pattern Consistency
- **Location**: src/pages/auth/signin.astro:5, src/pages/auth/signup.astro:5
- **Detail**: Both pages read `Astro.url.searchParams.get("error")` but API routes were redirecting to `/?error=…`, not `/auth/signin?error=…`. serverError was always null.
- **Fix**: Updated redirect targets in api/auth/signin.ts and api/auth/signup.ts to `/auth/signin?error=…` and `/auth/signup?error=…`.
- **Decision**: FIXED

### F6 — PasswordToggle aria-label in English; rest of UI is Polish

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/auth/PasswordToggle.tsx:14
- **Detail**: aria-label values were "Show password" / "Hide password" while all visible copy is Polish.
- **Fix**: Replaced with "Pokaż hasło" / "Ukryj hasło".
- **Decision**: FIXED

### F7 — SignUpForm password hint text is in English

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/auth/SignUpForm.tsx:60
- **Detail**: Character-count hint ("N more character(s) needed") was English while all other SignUpForm strings were translated to Polish in Phase 3.
- **Fix**: Translated to "Jeszcze N znak(i)".
- **Decision**: FIXED

### F8 — FormField has no autoComplete prop — password manager autofill unreliable

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/auth/FormField.tsx:7
- **Detail**: FormFieldProps had no autoComplete prop; the `<input>` omitted the autocomplete attribute. Browser autofill behaviour for type="password" without autocomplete is vendor-dependent.
- **Fix**: Added `autoComplete?: string` to FormFieldProps, spread onto `<input>`. Wired `"current-password"` on SignInForm password field; `"new-password"` on SignUpForm password and confirm-password fields.
- **Decision**: FIXED

### F9 — auth-button has no :disabled style

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/styles/global.css:319
- **Detail**: auth-button had no :disabled pseudo-class. With F1 fixed and spinner now functional, the disabled state gave no visual feedback.
- **Fix**: Added `&:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: 0 14px 36px rgba(37, 99, 235, 0.15); }` inside the auth-button @utility block.
- **Decision**: FIXED

### F10 — @utility class names used as plain selectors in @media blocks

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/styles/global.css:355
- **Detail**: Responsive overrides for auth-panel, auth-title, and login-card were in external @media blocks as plain selectors, while those names are defined via @utility. Works in Tailwind v4 today but mixes specificity layers.
- **Fix**: Moved responsive overrides inside each @utility block using nested @media. External @media (max-width: 1024px) block now contains only .auth-hero (a @layer components class).
- **Decision**: FIXED
