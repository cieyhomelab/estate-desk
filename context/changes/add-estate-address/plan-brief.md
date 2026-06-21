# Add Estate Address to Pricing, Documents, and Contacts Pages — Plan Brief

> Full plan: `context/changes/add-estate-address/plan.md`

## What & Why

Users navigating between listing tabs (pricing, documents, contacts) have no property address visible on the page body. Adding a muted address line below the tab bar gives immediate context on every sub-page — consistent with `close.astro`, which already does this.

## Starting Point

All three target pages already fetch `listing.address` from Supabase. `contacts.astro` already uses it in the `<Layout title>` (browser tab) but not in the body. `pricing.astro` and `documents.astro` don't use it at all. `close.astro:122–123` is the established pattern to follow.

## Desired End State

Every listing sub-page (pricing, documents, contacts) shows the estate address as a small muted paragraph between the tab bar and the first content card. Browser tab titles on pricing and documents also include the address, matching contacts.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| Address placement | Between `<ListingTabs>` and first card | Consistent with `close.astro`; always above the fold |
| Update `<Layout title>` on pricing & documents | Yes | Aligns all listing sub-pages with `contacts.astro` |
| New component? | No | Plain `<p>` inline — one-liner following existing pattern |

## Scope

**In scope:** Address paragraph on pricing, documents, contacts; `<Layout title>` update on pricing and documents.

**Out of scope:** `edit.astro`, `close.astro` (already correct); any styling changes beyond the established pattern; data model or API changes.

## Architecture / Approach

Pure template edits — no query changes, no new components. Three files, five insertions/replacements total, all following `close.astro:123` as the reference.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Add address display | Address visible on all three pages + title updates | None — purely additive template change |

**Prerequisites:** None  
**Estimated effort:** ~1 session, single phase

## Open Risks & Assumptions

- No risks — `listing.address` is non-nullable in the DB schema (`text not null`), so no null-guard is needed.

## Success Criteria (Summary)

- Address visible below the tab bar on pricing, documents, and contacts pages
- Browser tab titles on pricing and documents include the address
- `npm run build` and `npm run typecheck` pass with no new errors
