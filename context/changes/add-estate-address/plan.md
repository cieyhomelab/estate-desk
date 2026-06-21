# Add Estate Address to Pricing, Documents, and Contacts Pages — Implementation Plan

## Overview

Display the estate address on the pricing, documents, and contacts listing sub-pages, matching the pattern already used in `close.astro`. Users navigating between listing tabs currently have no address context visible on the page body.

## Current State Analysis

All three target pages already fetch `listing.address` from the database — no query changes required. The field is never rendered in the page body, only in `contacts.astro`'s `<Layout title>` (browser tab). `close.astro:123` is the canonical reference for how to render the address.

### Key Discoveries

- `pricing.astro:87` — static `<Layout title="Cena i prowizja — EstateDesk">`, no address on page
- `documents.astro:85` — static `<Layout title="Dokumenty i zdjęcia — EstateDesk">`, address fetched but never rendered
- `contacts.astro:67` — `<Layout title>` already uses `listing.address`; address not shown in page body
- `close.astro:122–123` — reference pattern: `<h1>` followed by `<p class="mb-5 text-sm text-white/50">{listing.address}</p>`
- All pages follow the same layout: `<ListingTabs>` → optional `<Banner>` elements → content cards

## Desired End State

Each of the three pages shows the estate address as a muted paragraph between the `<ListingTabs>` component and the first content card. The `<Layout title>` on pricing and documents includes the address, making all listing sub-pages consistent with `contacts.astro`.

**Verification:** Navigate to any listing's pricing, documents, or contacts tab — the address appears below the tab bar and above the first card on every page.

## What We're NOT Doing

- No changes to Supabase queries — all pages already fetch `address`
- No new components — plain inline `<p>` element following the `close.astro` pattern
- No changes to the `edit.astro` or `close.astro` pages — they already handle address correctly
- No styling changes beyond what's needed to match the established pattern

## Implementation Approach

Three identical template edits, one per file. Each edit:
1. Updates `<Layout title>` to include `listing.address` (pricing and documents only — contacts already has it)
2. Inserts one `<p>` element between the last `<Banner>` and the first content card

`mb-4` is used (not `mb-5` from close.astro's inline reference) because the address paragraph sits *outside* cards here — `mb-4` aligns it visually with the `mb-4` already on the first card beneath it.

## Phase 1: Add Address Display to All Three Pages

### Overview

Three small template edits, each following the `close.astro` reference pattern.

### Changes Required

#### 1. pricing.astro — Layout title

**File**: `src/pages/dashboard/listings/[id]/pricing.astro`

**Intent**: Include the listing address in the browser tab title to match contacts.astro.

**Contract**: Line 87 — change static string to template literal:
`` `Cena i prowizja — ${listing.address}` ``

---

#### 2. pricing.astro — Address paragraph

**File**: `src/pages/dashboard/listings/[id]/pricing.astro`

**Intent**: Render the address between the tab bar / banners and the first content card.

**Contract**: Insert after line 97 (last `{success === ...}` banner), before the `<div class="mb-4 rounded-xl ...">` at line 99:
```astro
{listing.address && <p class="mb-4 text-sm text-white/50">{listing.address}</p>}
```

---

#### 3. documents.astro — Layout title

**File**: `src/pages/dashboard/listings/[id]/documents.astro`

**Intent**: Include the listing address in the browser tab title to match contacts.astro.

**Contract**: Line 85 — change static string to template literal:
`` `Dokumenty i zdjęcia — ${listing.address}` ``

---

#### 4. documents.astro — Address paragraph

**File**: `src/pages/dashboard/listings/[id]/documents.astro`

**Intent**: Render the address between the tab bar / banners and the first content card.

**Contract**: Insert after line 95 (last `{success === ...}` banner), before the `<!-- Checklist section -->` comment at line 97:
```astro
{listing.address && <p class="mb-4 text-sm text-white/50">{listing.address}</p>}
```

---

#### 5. contacts.astro — Address paragraph

**File**: `src/pages/dashboard/listings/[id]/contacts.astro`

**Intent**: Render the address between the tab bar / banner and the first content card. The `<Layout title>` already includes the address — no change needed there.

**Contract**: Insert after line 74 (`{error && <Banner ...>}`), before the `<div class="mb-4 rounded-xl ...">` at line 76:
```astro
{listing.address && <p class="mb-4 text-sm text-white/50">{listing.address}</p>}
```

---

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run typecheck` (no new type errors)
- Build succeeds: `npm run build`

#### Manual Verification

- Navigate to a listing's `/pricing` tab — address appears below the tab bar, above the "Cena wywoławcza" card
- Navigate to a listing's `/documents` tab — address appears below the tab bar, above the "Lista dokumentów" card
- Navigate to a listing's `/contacts` tab — address appears below the tab bar, above the "Dodaj kontakt" card
- Browser tab title on pricing shows `Cena i prowizja — <address>`
- Browser tab title on documents shows `Dokumenty i zdjęcia — <address>`
- No regressions on `close.astro` or `edit.astro`

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before marking done.

---

## Testing Strategy

### Manual Testing Steps

1. Sign in and open a listing with a known address
2. Click through pricing → documents → contacts tabs and verify address is visible on each
3. Check browser tab titles on pricing and documents
4. Confirm close.astro still shows address correctly (no regression)

## References

- Reference pattern: `src/pages/dashboard/listings/[id]/close.astro:122–123`
- contacts.astro Layout title usage: `src/pages/dashboard/listings/[id]/contacts.astro:67`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands.

### Phase 1: Add Address Display to All Three Pages

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck`
- [x] 1.2 Build succeeds: `npm run build`

#### Manual

- [x] 1.3 Address visible on `/pricing` tab below tab bar
- [x] 1.4 Address visible on `/documents` tab below tab bar
- [x] 1.5 Address visible on `/contacts` tab below tab bar
- [x] 1.6 Browser tab titles on pricing and documents include address
- [x] 1.7 No regressions on `close.astro` or `edit.astro`
