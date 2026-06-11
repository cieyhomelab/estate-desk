# Refactor C3: Shared Flash-Slug → Message Layer — Plan Brief

> Full plan: `context/changes/refactor-c3-flash-messages/plan.md`
> Research: `context/changes/refactor-opportunities/research.md`

## What & Why

Five dashboard pages each hand-roll their own slug→message mapping using at least four
different patterns (nested ternary, inline `&&`, `includes`-fallback, local object-map). This
is accidental complexity — one author, three slices, two days, no shared layer ever proposed.
One active bug: `pricing.astro` maps `blad-zapisu` to "Nie udało się zapisać **ceny**" while
`commission/set.ts` also uses `blad-zapisu` — commission write errors show a price-worded message.

## Starting Point

`contacts.astro:59-67` already uses the right pattern: a local `Record<string, string>` map
keyed by slug. `src/lib/config-status.ts:11-19` shows the typed-map shape used in `src/lib/`.
The natural fix is to extract the map to `src/lib/messages.ts` and migrate the other four
pages to use it. Emitter routes are untouched — slugs are the wire contract.

## Desired End State

`src/lib/messages.ts` is the single slug→message source of truth. All 5 render sites import
`getFlashMessage(slug)` from it. Each page has a Playwright assertion pinning its flash-text
output. The `blad-zapisu` bug on `pricing.astro` is fixed.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Target pattern | `Record<string, string>` + `getFlashMessage` helper | Mirrors the in-repo proof-of-concept in contacts.astro; no new dependencies | Plan |
| blad-zapisu canonical text | Generic "Nie udało się zapisać. Spróbuj ponownie." | One text that's correct in all write-error contexts; fixes the pricing.astro bug | Plan |
| Success messages | Stay inline per page | Few, context-specific, low-risk; not worth centralizing | Plan |
| Testing bar | Add Playwright flash-text assertions (1 per page) | Closes the weak guard gap; test navigates to page with ?error= param | Plan (session) |
| Emitter routes | Not touched | Slugs are the wire contract | Research |

## Scope

**In scope:**
- `src/lib/messages.ts` (new, all slugs from all 5 pages)
- Migrate: `pricing.astro`, `documents.astro`, `contacts.astro`, `close.astro`, `settings/commission.astro`
- 5 Playwright flash-text assertions (one per page)
- Fix the `blad-zapisu` → price-text bug

**Out of scope:**
- Emitter routes (11 routes unchanged)
- Success messages (stay inline)
- `Banner.astro` component changes
- P3 `undefined`-in-URL bug (separate one-liner)
- Internationalization

## Architecture / Approach

Phase 1 is the proof: create `messages.ts` and migrate `pricing.astro` with a test. The
`contacts.astro` local map is essentially the source for `messages.ts` — same shape, extracted.
Phase 2 is mechanical: migrate remaining 4 pages, one at a time, each with a Playwright assertion.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Create messages.ts + pricing.astro | Library established; known bug fixed; pattern proven | slug inventory may miss some slugs from less-read pages |
| 2. Migrate remaining 4 pages | All render sites unified; 5 Playwright assertions in place | close.astro has a complex includes-fallback pattern; must not break juz-zamknieta/brakujace-dokumenty |

**Prerequisites:** Dev server running for Playwright tests.
**Estimated effort:** ~1 session (both phases; Phase 2 is mechanical page-by-page).

## Open Risks & Assumptions

- Slug inventory (in `messages.ts`) derived from reading 5 render sites; if a page emits a slug not in the map, `getFlashMessage` returns the generic fallback — acceptable behavior.
- Playwright flash-text test requires a valid listing ID; if test setup is complex, it may add Phase 1 scope.
- `close.astro` has a more complex pattern (3 named slugs + fallback list) — migration straightforward but requires more care.

## Success Criteria (Summary)

- `pricing.astro?error=blad-zapisu` shows "Nie udało się zapisać. Spróbuj ponownie." (not "ceny").
- All 5 Playwright flash-text assertions pass.
- No render site contains inline slug→message string logic.
