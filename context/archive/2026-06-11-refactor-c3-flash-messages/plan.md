# Refactor C3: Shared Flash-Slug → Message Layer — Implementation Plan

## Overview

Five dashboard pages hand-roll their own slug→message mappings using at least four different
patterns (nested ternary, inline `&&`, `includes`-list fallback, local object-map). One known
bug: `pricing.astro` maps `blad-zapisu` to "Nie udało się zapisać **ceny**" — but
`commission/set.ts` also emits `blad-zapisu`, so a commission write error shows a price-worded
message. This plan introduces `src/lib/messages.ts` as the single slug→message source, migrates
all five render sites, and adds Playwright flash-text assertions to close the existing weak
guard.

## Current State Analysis

**Render sites with slug→message inline logic (5 total):**

1. `pricing.astro:94-111` — nested ternary for `error`; also handles `prowizja-nieprawidlowa`
   separately. `blad-zapisu` → "Nie udało się zapisać ceny." ← **known wrong-message bug**
   (commission errors also land here).
2. `documents.astro:91-100` — nested ternary for `error`; inline banners for success/photo/file slugs.
3. `contacts.astro:59-67` — **already uses a `Record<string, string>` map**; closest to target shape.
4. `close.astro:115-124` — per-slug `&&` + `includes`-list fallback for unknown slugs.
5. `settings/commission.astro:51-58` — nested ternary for `error`.

**Emitter routes (11 routes, unchanged):** slugs are the wire contract. No emitter route
changes in this plan.

**Existing guard (weak):** e2e tests assert page state (form fields, listing status) but not
flash-banner text. A wrong slug→message mapping would not be caught by any existing test.

**The `Banner.astro` component** already exists as the render wrapper — it is not changing.

**`contacts.astro`'s local map** is the proof-of-concept for `messages.ts`: it already works
as a typed `Record<string, string>` keyed by slug.

## Desired End State

- `src/lib/messages.ts` is the single source of truth for slug→message text.
- All 5 render sites import from `messages.ts` for their primary error block instead of
  inline strings.
- Each migrated page has at least one Playwright assertion that `?error=blad-zapisu` renders
  the correct banner text.
- The `blad-zapisu` message on `pricing.astro` no longer says "ceny" — the known bug is fixed.
- Emitter routes are unchanged.
- Exception: `documents.astro` retains 4 inline photo/file-upload error banners
  (`brak-plikow`, `nieprawidlowy-typ`, `blad-uploadu`, `brak-pliku`) — these are
  context-specific to document uploads and are out of scope (see below).

### Key Discoveries

- `src/pages/dashboard/listings/[id]/contacts.astro:59-67` — in-repo reference: already a `Record<string, string>` object-map pattern
- `src/lib/config-status.ts:11-19` — existing typed-map shape in `src/lib/` (the natural home for `messages.ts`)
- `e2e/listing-persistence.spec.ts` — Playwright test template; flash-text assertions navigate to URL with `?error=` param and check rendered text
- The known wrong-message: `pricing.astro:98-99` maps `blad-zapisu` → price-worded text, while `commission/set.ts:30` also emits `blad-zapisu`

## What We're NOT Doing

- No changes to any emitter route — slug strings are the wire contract.
- No new slugs — existing slugs are preserved verbatim.
- No changes to `Banner.astro` (render wrapper).
- No internationalization layer.
- No handling of the success slugs through `messages.ts` (success messages are few, context-specific, and low-risk — they stay inline per page).
- No migration of photo/file-upload context-specific error banners in `documents.astro`:
  `brak-plikow`, `nieprawidlowy-typ`, `blad-uploadu`, `brak-pliku` (lines 206-208, 263) are
  error slugs that are specific to the document-upload flow and have no equivalent on other
  pages — they stay inline.
- No fix to P3 (`undefined` interpolated into redirect URL) — separate one-liner.

## Implementation Approach

Phase 1 creates the library and migrates one page (`pricing.astro`) with a test — the minimum
viable proof that the pattern works and fixes the known bug. Phase 2 migrates the remaining
four render sites, each with its own flash-text assertion.

---

## Phase 1: Create `messages.ts` and Migrate `pricing.astro`

### Overview

Create the shared slug→message map in `src/lib/messages.ts` from the strings already in the
render sites. Migrate `pricing.astro` as the first page (fixes the known wrong-message bug).
Add a Playwright flash-text assertion for `pricing.astro`.

### Changes Required

#### 1. Create `src/lib/messages.ts`

**File**: `src/lib/messages.ts` (new file)

**Intent**: Export a typed `Record<string, string>` (or narrower literal-keyed type) mapping
every slug currently emitted by the 11 routes to its canonical Polish text. This is the
extracted version of `contacts.astro`'s existing local map, generalized to cover all pages.

**Contract**: The shape mirrors `contacts.astro:59-67`. Export a single named `messages`
constant. Every slug string that any of the 5 render sites currently handles must be present
as a key. The `blad-zapisu` value should be generic — "Nie udało się zapisać. Spróbuj
ponownie." — covering all write-error contexts (not price-specific).

Slugs to include (derived from the 5 render sites):
- `blad-zapisu` — "Nie udało się zapisać. Spróbuj ponownie."
- `blad-serwera` — "Błąd serwera. Spróbuj ponownie."
- `cena-nieprawidlowa` — "Cena musi być liczbą większą od zera z co najwyżej dwoma miejscami po przecinku."
- `prowizja-nieprawidlowa` — "Prowizja musi być liczbą większą od zera i nie większą niż 100%."
- `stawki-nieprawidlowe` — "Stawki muszą być liczbami z zakresu 0–100."
- `juz-zamknieta` — "Ogłoszenie jest już zamknięte."
- `brakujace-dokumenty` — "Przed zamknięciem uzupełnij wymagane dokumenty."
- `nieprawidlowa-nazwa` — "Nieprawidłowa nazwa dokumentu."
- `blad-usuniecia` — "Wystąpił błąd podczas usuwania. Spróbuj ponownie."
- `blad-konfiguracji` — "Błąd konfiguracji. Skontaktuj się z administratorem."
- `blad-ladowania` — "Błąd podczas ładowania danych."
- `nazwa-wymagana` — "Imię i nazwisko jest wymagane."
- `rola-nieprawidlowa` — "Wybrana rola jest nieprawidłowa."

Add a `getFlashMessage(slug: string): string` helper that returns `messages[slug]` or a
generic fallback ("Wystąpił nieoczekiwany błąd. Spróbuj ponownie.") for unknown slugs.

#### 2. Migrate `pricing.astro:94-111`

**File**: `src/pages/dashboard/listings/[id]/pricing.astro`

**Intent**: Replace the inline ternary error block and the standalone `prowizja-nieprawidlowa`
banner with calls to `getFlashMessage(error)`. This fixes the known bug: `blad-zapisu` now
resolves to the generic write-error text, not the price-specific text.

**Contract**: Import `getFlashMessage` from `@/lib/messages`. The `error &&` block renders
`<Banner variant="error">{getFlashMessage(error)}</Banner>`. The `prowizja-nieprawidlowa`
branch folds into the shared map (it's already a key in `messages.ts`). The `success`
banners (`cena-zapisana`, `prowizja-zapisana`) stay inline — success messages are
context-specific and low-risk.

#### 3. Add Playwright flash-text assertion for `pricing.astro`

**File**: `e2e/listing-persistence.spec.ts` (append) or a new `e2e/flash-messages.spec.ts`

**Intent**: After navigating to `/dashboard/listings/{id}/pricing?error=blad-zapisu`, assert
that the Banner renders "Nie udało się zapisać. Spróbuj ponownie." (the generic text, not the
price-specific text). This pins the fix and catches regressions.

**Contract**: Use the existing e2e test pattern — `page.goto(url)`, then
`expect(page.getByRole('alert'))` or a text selector targeting the Banner's text content.
The test needs a valid listing ID (seed one in `beforeAll`).

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- Playwright e2e test passes (flash-text assertion for `pricing.astro`): `npm run test:e2e`

#### Manual Verification

- Navigate to `pricing.astro?error=blad-zapisu` — banner shows "Nie udało się zapisać. Spróbuj ponownie." (not "ceny").
- Navigate to `pricing.astro?error=prowizja-nieprawidlowa` — banner shows the commission-specific message.
- Navigate to `pricing.astro?error=cena-nieprawidlowa` — banner shows the price-specific message.

**Implementation Note**: After Phase 1 passes, `messages.ts` is stable and the pattern is
proven. Phase 2 is mechanical page-by-page migration. Confirm the Playwright test passes
before proceeding.

---

## Phase 2: Migrate Remaining Render Sites

### Overview

Migrate `documents.astro`, `contacts.astro`, `close.astro`, and `settings/commission.astro`
to use `getFlashMessage` from `messages.ts`. Add a Playwright flash-text assertion per page.

### Changes Required

#### 1. Migrate `documents.astro:91-100`

**File**: `src/pages/dashboard/listings/[id]/documents.astro`

**Intent**: Replace the nested ternary for `error` with `getFlashMessage(error)`. The
success banners and the photo/file-upload error banners (lines 103-263) stay inline — success
messages are out of scope, and the photo/file error slugs (`brak-plikow`, `nieprawidlowy-typ`,
`blad-uploadu`, `brak-pliku`) are context-specific to document uploads and are explicitly
excluded (see "What We're NOT Doing").

**Contract**: Same import pattern as Phase 1. The `error &&` block uses `getFlashMessage`.
Add Playwright assertion: `?error=blad-zapisu` → "Nie udało się zapisać. Spróbuj ponownie."

#### 2. Migrate `contacts.astro:59-67`

**File**: `src/pages/dashboard/listings/[id]/contacts.astro`

**Intent**: Remove the local `errorMessages` `Record<string, string>` and `getFlashMessage`
local helper; replace with the shared import. This page already uses the right pattern —
the migration is a simplification (delete local map, import shared one).

**Contract**: Delete lines 59-67 (local map + `errorMessage` derivation). Replace with
`import { getFlashMessage } from '@/lib/messages'` and use `getFlashMessage(error)` at
line 82. Add Playwright assertion. Behavioral delta: the current local map has no fallback
(unknown slug → no banner rendered); after migration unknown slugs show the generic fallback
banner — acceptable since no unknown slugs should reach this page.

#### 3. Migrate `close.astro:115-124`

**File**: `src/pages/dashboard/listings/[id]/close.astro`

**Intent**: Replace the per-slug `&&` block and `includes`-list fallback with a single
`error && <Banner variant="error">{getFlashMessage(error)}</Banner>`.

**Contract**: The `includes`-list fallback at line 124 is the catch-all for unknown slugs —
`getFlashMessage`'s fallback text replaces it. All named slugs (`juz-zamknieta`,
`brakujace-dokumenty`, `blad-zapisu`) are present in `messages.ts`. Add Playwright assertion.

#### 4. Migrate `settings/commission.astro:51-58`

**File**: `src/pages/dashboard/settings/commission.astro`

**Intent**: Replace the nested ternary with `getFlashMessage(error)`.

**Contract**: Same pattern. Add Playwright assertion: `?error=blad-zapisu` → "Nie udało się
zapisać. Spróbuj ponownie."

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run typecheck`
- Linting passes: `npm run lint`
- All Playwright flash-text assertions pass (5 tests total, one per page): `npm run test:e2e`

#### Manual Verification

- Navigate to each of the 5 migrated pages with `?error=blad-zapisu` — correct generic banner text is shown.
- Navigate to each page with a page-specific error slug (e.g., `pricing.astro?error=cena-nieprawidlowa`) — correct specific text is shown.
- Navigate to each page with an unknown slug — generic fallback text appears (not empty).
- No regressions on the success banners (still inline, unchanged).

**Implementation Note**: After all Playwright tests pass, pause for manual confirmation that
all 5 pages render the correct messages before marking complete.

---

## Testing Strategy

### Playwright E2E Tests

One test per render site — 5 tests total. Each navigates to the page with `?error=blad-zapisu`
and asserts the Banner text. Optionally also asserts a page-specific slug per page (e.g.,
`cena-nieprawidlowa` on `pricing.astro`).

### Manual Testing Steps

1. Start the dev server.
2. For each migrated page, append `?error=blad-zapisu` to the URL and confirm the banner text.
3. For each page, test a page-specific error slug and confirm the correct message.
4. For each page, test `?error=unknown-slug` and confirm the fallback text appears.
5. Confirm success banners are unaffected on each page.

## References

- Research: `context/changes/refactor-opportunities/research.md`
- Existing map pattern: `src/pages/dashboard/listings/[id]/contacts.astro:59-67`
- Existing lib map shape: `src/lib/config-status.ts:11-19`
- Playwright test pattern: `e2e/listing-persistence.spec.ts`
- Banner component: `src/components/Banner.astro`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Create messages.ts and Migrate pricing.astro

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck` — bd99186
- [x] 1.2 Linting passes: `npm run lint` — bd99186
- [x] 1.3 Playwright flash-text assertion for pricing.astro passes: `npm run test:e2e` — bd99186

#### Manual

- [x] 1.4 pricing.astro?error=blad-zapisu shows generic text (not "ceny")
- [x] 1.5 pricing.astro?error=prowizja-nieprawidlowa shows commission message
- [x] 1.6 pricing.astro?error=cena-nieprawidlowa shows price message

### Phase 2: Migrate Remaining Render Sites

#### Automated

- [x] 2.1 Type checking passes: `npm run typecheck` — 2777c3c
- [x] 2.2 Linting passes: `npm run lint` — 2777c3c
- [x] 2.3 All 5 Playwright flash-text assertions pass: `npm run test:e2e` — 2777c3c

#### Manual

- [x] 2.4 All 5 pages show correct generic text for blad-zapisu
- [x] 2.5 All 5 pages show correct specific text for page-specific slugs
- [x] 2.6 All 5 pages show fallback text for unknown slugs
- [x] 2.7 Success banners unaffected on all pages
