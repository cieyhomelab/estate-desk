# Help Page Implementation Plan

## Overview

Wire up the non-functional Pomoc button in DashboardHeader to navigate to `/help`,
and create the `/help` page — a static, auth-gated, Polish-language reference page
with four sections documenting the agent's core workflows.

## Current State Analysis

- `src/components/DashboardHeader.astro:28` — Pomoc is a `<span class="text-white/30 select-none">` with no href; not interactive.
- `src/middleware.ts:4` — `PROTECTED_ROUTES = ["/dashboard"]`; `/help` would be unprotected by default.
- `src/pages/help.astro` — does not exist.

## Desired End State

- DashboardHeader shows Pomoc as a clickable `<a href="/help">` with active styling when on `/help`.
- Unauthenticated visits to `/help` redirect to `/` (via middleware).
- `/help` renders four Polish-language sections with a "Powrót do dashboardu" link and correct dark-theme styling matching the rest of the app.

### Key Discoveries

- `DashboardHeader.astro` already has `activePage?: "settings"` prop pattern with conditional `class:list` — extending to `"help"` is a zero-friction addition.
- `commission.astro` is the canonical model for a protected, full-page Astro route: `Layout` + `DashboardHeader` + `bg-cosmic min-h-screen` wrapper + `background: #0d1b2a` global body style.
- Middleware is the right auth-guard for `/help` — adding it to `PROTECTED_ROUTES` is one array entry; no inline auth check in the page is needed or desired.

## What We're NOT Doing

- No Astro Content Collections or Markdown files — content lives inline in `help.astro`.
- No CMS, admin UI, or content management layer.
- No public access mode for the Help page.
- No URL-persistence or deep-linking to individual help sections.
- No inline `supabase.auth.getUser()` check in `help.astro` — middleware covers the route and the page requires no user data.

## Implementation Approach

Three-file change in two phases. Phase 1 wires the auth guard and updates the nav link.
Phase 2 creates the help page. Both follow existing patterns exactly — no new patterns introduced.

## Phase 1: Route Protection & DashboardHeader Update

### Overview

Add `/help` to the middleware's protected routes and convert the Pomoc `<span>` into an
active-state-aware nav link.

### Changes Required

#### 1. Middleware — add `/help` to protected routes

**File**: `src/middleware.ts`

**Intent**: Extend `PROTECTED_ROUTES` so unauthenticated visits to `/help` redirect to `/`, consistent with how `/dashboard` is protected.

**Contract**: Change line 4 from `["/dashboard"]` to `["/dashboard", "/help"]`.

---

#### 2. DashboardHeader — Pomoc span → active link

**File**: `src/components/DashboardHeader.astro`

**Intent**: Extend the `Props` interface to include `"help"` as a valid `activePage` value, and convert the static `<span>Pomoc</span>` (line 28) into an `<a href="/help">` that shows active styling when `activePage === "help"`, using the same `class:list` pattern already used by the Settings link.

**Contract**:
- Props interface: `activePage?: "settings" | "help"`
- Replace the `<span>` element with `<a href="/help" class:list={["rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors", activePage === "help" ? "border-white/25 bg-white/15 text-white" : "border-white/[0.15] bg-white/[0.07] text-white/70 hover:bg-white/[0.12] hover:text-white"]}>Pomoc</a>` — identical class logic to the Settings link.

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`

#### Manual Verification

- Pomoc appears as a clickable link in the DashboardHeader on the Dashboard.
- Visiting `/help` while logged out redirects to `/`.
- Visiting `/help` while logged in returns a 404 (no redirect to `/`) — confirms middleware allows the route through.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Create `/help` Page

### Overview

Create `src/pages/help.astro` — a static, auth-gated Polish-language help page with four sections and a back link.

### Changes Required

#### 1. Help page — new Astro page

**File**: `src/pages/help.astro` (new file)

**Intent**: Static page following the `commission.astro` structure — `Layout` + `DashboardHeader activePage="help"` + four Polish content sections + "Powrót do dashboardu" link. No inline auth check (middleware handles the gate). Matches the app's dark-theme visual style.

**Contract**: Page structure mirrors `commission.astro`:
- Frontmatter: no Supabase call needed (auth is middleware-only); just import `Layout` and `DashboardHeader`.
- Wrapper: `<div class="bg-cosmic min-h-screen">` + `<DashboardHeader activePage="help" />`.
- Content container: `<div class="mx-auto max-w-2xl px-6 py-8">`.
- Back link: `<a href="/dashboard" class="mb-5 inline-flex items-center gap-1 text-sm text-white/40 transition-colors hover:text-white/70"><span aria-hidden="true">←</span> Powrót do dashboardu</a>`.
- Page title: `<h1 class="mb-8 text-3xl font-bold tracking-tight text-white">Pomoc</h1>`.
- Global body style: `:global(body) { background: #0d1b2a; }` (same as commission.astro).
- Layout title prop: `"Pomoc — EstateDesk"`.

Four sections, each wrapped in `<section class="mb-8">` with an `<h2 class="mb-3 text-xl font-semibold text-white">` heading and `<div class="space-y-2 text-sm text-white/65 leading-relaxed">` for the body paragraphs:

**Sekcja 1 — Jak tworzyć ogłoszenia**
```
Kliknij przycisk „+ Nowe ogłoszenie" w prawym górnym rogu dashboardu. Uzupełnij
adres nieruchomości — system automatycznie sformatuje go przy użyciu AI. Wpisz
dane właściciela oraz cenę wywoławczą, a następnie zapisz formularz. Po zapisaniu
ogłoszenie pojawia się na liście ze statusem Aktywne. Kliknięcie dowolnego
wiersza na liście otwiera szczegóły ogłoszenia, gdzie znajdziesz zakładki:
Dokumenty, Kontakty, Wycena i Zamknięcie.
```

**Sekcja 2 — Dokumenty i lista kontrolna**
```
W zakładce Dokumenty każdego ogłoszenia znajduje się lista wymaganych dokumentów.
Zaznacz każdy dokument jako zebrany klikając checkbox obok jego nazwy. Możesz
dodawać dokumenty niestandardowe (np. dodatkowe pełnomocnictwa) oraz usuwać te,
które nie dotyczą danej transakcji. Zamknięcie ogłoszenia jest możliwe dopiero
po zebraniu wszystkich wymaganych dokumentów — system blokuje tę akcję, jeśli
lista nie jest w pełni ukończona.
```

**Sekcja 3 — Prowizja i ceny**
```
Przed pierwszą transakcją przejdź do Ustawienia i ustaw stawkę podatku oraz
procentowy udział agencji — te wartości są używane przy każdym obliczeniu
prowizji. W zakładce Wycena konkretnego ogłoszenia możesz śledzić historię cen
i wpisać aktualną cenę wywoławczą. Przy zamykaniu transakcji podajesz finalną
cenę sprzedaży, a system automatycznie wylicza należną prowizję netto na
podstawie Twoich ustawień.
```

**Sekcja 4 — Kontakty i zamknięcie transakcji**
```
W zakładce Kontakty dodajesz osoby powiązane z ogłoszeniem: kupującego,
sprzedającego, notariusza lub inne osoby. Gdy wszystkie wymagane dokumenty są
zebrane, przejdź do zakładki Zamknięcie i kliknij „Zamknij transakcję" — podaj
finalną cenę sprzedaży i potwierdź. Zamknięte ogłoszenie zmienia status na
Zamknięte i trafia do sekcji „W transakcji" na dashboardzie. Jeśli transakcja nie
doszła do skutku, możesz wznowić ogłoszenie klikając „Wznów ogłoszenie".
```

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification

- Clicking Pomoc on the Dashboard navigates to `/help`.
- All four sections render with Polish content in the correct dark-theme styling.
- The Pomoc nav link shows active (highlighted) styling when on `/help`.
- "Powrót do dashboardu" link navigates back to `/dashboard`.
- Dashboard listing list renders identically when returning from `/help` (no regression).
- Unauthenticated visit to `/help` redirects to `/`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation that all manual checks pass.

---

## Testing Strategy

### Unit Tests

No new unit tests required — the page is purely static content with no logic.

### Integration Tests

No new integration tests required — auth protection is covered by existing middleware integration tests (`src/integration/api/auth-boundary.test.ts`).

### Manual Testing Steps

1. Log in to the app and navigate to `/dashboard`.
2. Verify Pomoc appears as a clickable link in the top-right nav.
3. Click Pomoc — confirm navigation to `/help`.
4. Verify all four help sections render with Polish content.
5. Verify active styling on the Pomoc nav link while on `/help`.
6. Click "Powrót do dashboardu" — confirm return to `/dashboard`.
7. Sign out, then manually visit `/help` — confirm redirect to `/`.

## Migration Notes

No data migrations. No existing routes changed.

## References

- PRD: `context/foundation/prd.md` (US-03, FR-007, FR-008)
- Roadmap: `context/foundation/roadmap.md` (S-03)
- Canonical page pattern: `src/pages/dashboard/settings/commission.astro`
- Nav component: `src/components/DashboardHeader.astro`
- Auth middleware: `src/middleware.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Route Protection & DashboardHeader Update

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck`
- [x] 1.2 Linting passes: `npm run lint`

#### Manual

- [x] 1.3 Pomoc appears as a clickable link in DashboardHeader on the Dashboard
- [x] 1.4 Visiting `/help` while logged out redirects to `/`
- [x] 1.5 Visiting `/help` while logged in returns a 404 (no redirect to `/`)

### Phase 2: Create `/help` Page

#### Automated

- [ ] 2.1 Type checking passes: `npm run typecheck`
- [ ] 2.2 Linting passes: `npm run lint`
- [ ] 2.3 Build succeeds: `npm run build`

#### Manual

- [ ] 2.4 Clicking Pomoc on the Dashboard navigates to `/help`
- [ ] 2.5 All four sections render with Polish content in correct styling
- [ ] 2.6 Pomoc nav link shows active styling when on `/help`
- [ ] 2.7 "Powrót do dashboardu" link navigates back to `/dashboard`
- [ ] 2.8 Dashboard listing list renders identically after returning from `/help`
- [ ] 2.9 Unauthenticated visit to `/help` redirects to `/`
