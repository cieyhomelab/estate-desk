---
project: "EstateDesk — Dashboard Filters, Export & Help"
context_type: brownfield
created: 2026-06-08
updated: 2026-06-08
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  frs_drafted: 8
  gray_areas_resolved:
    - filters-mode: client-side instant filtering (no server round-trip)
    - export-scope: all listings, full list (not filtered subset)
    - help-format: Markdown-driven content files, rendered by Astro page
    - status-values: Aktywne / Zamknięte (two-state; no third state in current model)
    - price-filter: min/max range inputs (Cena od / Cena do)
    - city-filter: free-text, case-insensitive string match against city field
    - must-preserve: dashboard listing render, listing sub-page routes, auth session, form saves
    - help-sections: Creating listings | Documents & checklist | Commission & pricing | Contacts & closing
    - filters-ui: inline bar expands below button row
    - help-navigation: navigates to /help route (same tab)
    - timeline: under 1 week after-hours
    - hard-deadline: none
  quality_check_status: accepted
---

## Current System

**EstateDesk** — in-development real estate agent management app for a single Polish agent. Stack: Astro 5, React, TypeScript, Tailwind CSS v4, Supabase (auth + database), Cloudflare Workers.

The Dashboard (`/dashboard`) displays all the agent's listings (active and closed). Three buttons are already rendered in the Dashboard UI — **Filtry**, **Eksport**, and **Pomoc** — but none has any behaviour wired up: clicking them does nothing. The rest of the system (listing sub-pages, forms, commission calc, document checklist, auth) is functional.

**Must preserve:** dashboard listing list rendering (no-filter state must be identical), all `/dashboard/listings/[id]/` sub-page routes, Supabase auth session handling, all existing form save behaviour.

## Vision & Problem Statement (Brownfield)

Three non-functional UI stubs on the Dashboard need to become working features:

1. **Filtry (Filters)** — the agent has no way to narrow the listing list by status, price range, or city without scrolling through everything.
2. **Eksport (Export)** — the agent has no programmatic way to get a data snapshot of all listings; there is no CSV export.
3. **Pomoc (Help)** — there is no in-app documentation; new users (or the agent returning after a break) have no reference for how the workflow fits together.

All three gaps share the same root: the UI placeholders were laid out before the behaviour was implemented. This change wires them up.

## Success Criteria (Brownfield)

### Primary
- Agent clicks **Filtry** on the Dashboard; a filter bar expands inline below the buttons. Agent sets Status (Aktywne/Zamknięte/Wszystkie), Cena od/do (numeric range), and/or Miasto (text). The listing list narrows instantly — no page reload, no server call.
- Agent clicks **Eksport** on the Dashboard; the browser downloads a `.csv` file containing all their listings regardless of current filter state.
- Agent clicks **Pomoc** on the Dashboard; they navigate to `/help`, a Markdown-rendered page covering four sections: Creating listings, Documents & checklist, Commission & pricing, Contacts & closing.

### Secondary
- The active filter state is visually indicated on the Dashboard (e.g. a badge or label showing "Status: Aktywne") so the agent knows filters are on.

### Guardrails
- No regression: listing list renders identically when no filters are active.
- No regression: all `/dashboard/listings/[id]/` sub-page routes and form saves continue working.
- Polish language throughout — no English strings in any new UI element.

## Business Logic (Brownfield)

**Infrastructure-only change — no domain logic is added or modified.**

- Filter logic: client-side predicate applied to the in-memory listing array; not a domain rule.
- Export logic: serialise the in-memory listing array to a CSV string; not a domain rule.
- Help page: static content rendering; not a domain rule.

The existing domain rules (document-checklist transaction gate, commission split computation) are untouched by this change.

## Constraints & Preserved Behavior

- Dashboard listing list must render identically when no filter inputs are set (all filters at default state).
- All `/dashboard/listings/[id]/` sub-page routes remain functional and their URLs are not changed.
- Existing form submit handlers and Supabase writes are not touched.
- Supabase auth session handling is not touched.
- Filter state is ephemeral — it lives in React state only and is not persisted to the URL, localStorage, or the database.
- Export reads the already-loaded listing data; it does not make an additional Supabase query.

## Non-Functional Requirements (Brownfield)

- The CSV filename includes the export date in ISO format: `estatedesk-YYYY-MM-DD.csv`.
- All new UI strings (filter labels, export button feedback, help page content) are in Polish — no English in the shipped product.
- No regression on existing form save behaviour or listing data persistence.

## Access Control

No changes planned — current model preserved. Email and password login, single user, flat model. Filters and Export are accessible only from an authenticated session (Dashboard is auth-gated). The Help page is also auth-gated — accessible to the logged-in agent only; no public access.

## User Stories (Brownfield)

### US-01: Agent filters the Dashboard listing list

- **Given** a logged-in agent on the Dashboard with at least one listing loaded
- **When** they click Filtry, set Status to "Aktywne", enter Cena od/do range, and/or type a city in Miasto
- **Then** the listing list narrows instantly to show only matching rows; no page reload occurs

### US-02: Agent exports all listings to CSV

- **Given** a logged-in agent on the Dashboard
- **When** they click Eksport
- **Then** the browser downloads a `.csv` file with columns: title/address, status, asking price, city, owner name, created date, closed date (where applicable)

### US-03: Agent reads the Help page

- **Given** a logged-in agent on the Dashboard
- **When** they click Pomoc
- **Then** they are navigated to `/help`, a Polish-language page with four sections: creating listings, documents & checklist, commission & pricing, contacts & closing

## Functional Requirements (Brownfield)

### Filters

- FR-001: Agent can toggle a filter bar on the Dashboard by clicking Filtry — the bar expands below the button row; clicking Filtry again collapses it and resets all filter inputs to empty. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: collapse resets filter state — agent loses their filter if they accidentally close the bar. Resolution: kept as written; reset-on-close is the simpler, predictable behaviour consistent with the collapse-as-dismiss pattern.

- FR-002: Agent can filter the listing list by Status using a dropdown with three options: Wszystkie (default), Aktywne, Zamknięte. Status values are hardcoded to the current two-state model. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: hardcoded statuses break if a third status is added. Resolution: kept; the two-state model is stable for v1.

- FR-003: Agent can filter the listing list by asking price range using two numeric inputs: Cena od and Cena do. Either input can be left empty (no lower/upper bound). Priority: must-have. Change: new
  > Socrates: Counter-argument considered: agent may not know their price range without hints. Resolution: kept as plain numeric inputs; the agent entered all prices themselves.

- FR-004: Agent can filter the listing list by city using a free-text, case-insensitive input that matches against the city field of each listing. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: free-text misses abbreviation mismatches. Resolution: kept; the agent entered city values themselves and knows what to type.

- FR-005: When at least one filter is active and the filter bar is open, a visual indicator (e.g. count badge or "x filters active" label) shows on or near the Filtry button. Priority: nice-to-have. Change: new
  > Socrates: Counter-argument considered: badge duplicates the visible inputs when bar is open. Resolution: kept as nice-to-have — useful if collapse-with-indicator is ever added; low cost to include.

### Export

- FR-006: Agent can download all listings as a `.csv` file by clicking Eksport on the Dashboard. The file includes one row per listing with columns: title/address, status, asking price, city, owner name, created date, closed date (empty if listing is still active). Export always includes all listings regardless of current filter state. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: exporting all ignores filter — agent may want only filtered results. Resolution: kept; export is a data tool, filter is a view tool; keeping them independent avoids surprising output.

### Help

- FR-007: Agent can navigate to `/help` by clicking Pomoc on the Dashboard. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: navigation loses filter state. Resolution: kept; reset-on-collapse makes this consistent; URL-based filter persistence is v2.

- FR-008: The `/help` page renders Markdown-sourced content in Polish across four sections: (1) jak tworzyć ogłoszenia, (2) dokumenty i lista kontrolna, (3) prowizja i ceny, (4) kontakty i transakcja. The page has a "Powrót do dashboardu" back link. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: stale content is worse than no content. Resolution: accepted; the agent is the sole user and can update Markdown files directly when the app changes.

## Non-Goals (Brownfield)

- **No URL-based filter state** — filter inputs are ephemeral React state; `?status=aktywne` URL params are not implemented in this change. Rationale: adds routing complexity without meaningful benefit for a single-user app.
- **No server-side filtering** — the full listing list is loaded once from Supabase; filtering is client-side only. Rationale: the listing count for a single agent is small enough that a full load is practical.
- **No export of filtered subset** — CSV always contains all listings. Rationale: export is a data tool, filter is a view tool; keeping them independent avoids surprising output.
- **No CMS for Help content** — Help content lives in Markdown files edited directly; no admin UI is built. Rationale: the agent is the sole maintainer; a CMS is over-engineering for one user.

## User & Persona

**Primary persona: the single real estate agent**

Same as the core EstateDesk persona: a Polish real estate agent managing 5–20+ active listings, working from a laptop and phone. Reaches for Filters when looking for all active listings in a specific city. Reaches for Export when preparing a report for the agency. Reaches for Help when onboarding after a period away from the app.

## Open Questions

*(none — all cross-check items passed)*

## Quality cross-check (Brownfield)

Status: **accepted** — all six brownfield checks passed:
- Access Control: present (no change — current model preserved)
- Business Logic: present (infrastructure-only change — explicit statement)
- Project artifacts: present
- Timeline-cost acknowledgment: present (under 1 week ≤ 3-week threshold)
- Non-Goals: present (4 explicit non-goals)
- Preserved behavior: present (dashboard listing render, listing sub-page routes, auth session, form saves)

