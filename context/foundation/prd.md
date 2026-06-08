---
project: "EstateDesk — Dashboard Filters, Export & Help"
version: 1
status: draft
created: 2026-06-08
context_type: brownfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 1
  hard_deadline: null
  after_hours_only: true
---

## Current System Overview

EstateDesk is an in-development real estate agent management application for a single Polish agent. The system is built on Astro 5, React, TypeScript, Tailwind CSS v4, Supabase (authentication and database), and deployed on Cloudflare Workers.

The Dashboard (`/dashboard`) loads and displays all agent listings (active and closed). Three buttons are already rendered in the Dashboard UI — **Filtry**, **Eksport**, and **Pomoc** — but none has any behaviour wired up: clicking them does nothing.

Beyond the Dashboard, the system includes listing sub-pages at `/dashboard/listings/[id]/` with full form-save behaviour, a commission calculator, a document checklist with a transaction gate, and email-and-password authentication for a single user.

## Problem Statement & Motivation

Three non-functional UI stubs on the Dashboard need to become working features:

1. **Filtry (Filters)** — the agent has no way to narrow the listing list by status, price range, or city without scrolling through everything.
2. **Eksport (Export)** — the agent has no programmatic way to get a data snapshot of all listings; there is no CSV export.
3. **Pomoc (Help)** — there is no in-app documentation; the agent returning after a break has no in-app reference for how the workflow fits together.

All three gaps share the same root: the UI placeholders were laid out before the behaviour was implemented. This change wires them up.

## User & Persona

**Primary persona: the single real estate agent**

A Polish real estate agent managing 5–20+ active listings, working from a laptop and phone. Reaches for Filters when looking for all active listings in a specific city. Reaches for Export when preparing a report for the agency. Reaches for Help when onboarding after a period away from the app.

No secondary persona — this is a single-user application.

## Success Criteria

### Primary
- Agent clicks Filtry on the Dashboard; a filter bar expands inline below the buttons. Agent sets Status (Aktywne/Zamknięte/Wszystkie), Cena od/do (numeric range), and/or Miasto (text). The listing list narrows instantly — no page reload.
- Agent clicks Eksport on the Dashboard; the browser downloads a `.csv` file containing all their listings regardless of current filter state.
- Agent clicks Pomoc on the Dashboard; they are navigated to `/help`, a Polish-language page with four sections: Creating listings, Documents & checklist, Commission & pricing, Contacts & closing.

### Secondary
- The active filter state is visually indicated on the Dashboard (e.g. a badge or label showing "Status: Aktywne") so the agent knows filters are on.

### Guardrails
- No regression: listing list renders identically when no filters are active.
- No regression: all `/dashboard/listings/[id]/` sub-page routes and form saves continue working.
- Polish language throughout — no English strings in any new UI element.

## User Stories

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

## Scope of Change

### Filters

- [new] Agent can toggle a filter bar on the Dashboard by clicking Filtry — the bar expands below the button row; clicking Filtry again collapses it and resets all filter inputs to empty. Priority: must-have.
  > Socrates: Counter-argument considered: collapse resets filter state — agent loses their filter if they accidentally close the bar. Resolution: kept as written; reset-on-close is the simpler, predictable behaviour consistent with the collapse-as-dismiss pattern.

- [new] Agent can filter the listing list by Status using a dropdown with three options: Wszystkie (default), Aktywne, Zamknięte. Status values match the current two-state model: Aktywne and Zamknięte. Priority: must-have.
  > Socrates: Counter-argument considered: hardcoded statuses break if a third status is added. Resolution: kept; the two-state model is stable for v1.

- [new] Agent can filter the listing list by asking price range using two numeric inputs: Cena od and Cena do. Either input can be left empty (no lower/upper bound). Priority: must-have.
  > Socrates: Counter-argument considered: agent may not know their price range without hints. Resolution: kept as plain numeric inputs; the agent entered all prices themselves.

- [new] Agent can filter the listing list by city using a free-text, case-insensitive input that matches against the city field of each listing. Priority: must-have.
  > Socrates: Counter-argument considered: free-text misses abbreviation mismatches. Resolution: kept; the agent entered city values themselves and knows what to type.

- [new] When at least one filter is active and the filter bar is open, a visual indicator (e.g. count badge or "x filters active" label) shows on or near the Filtry button. Priority: nice-to-have.
  > Socrates: Counter-argument considered: badge duplicates the visible inputs when bar is open. Resolution: kept as nice-to-have — useful if collapse-with-indicator is ever added; low cost to include.

### Export

- [new] Agent can download all listings as a `.csv` file by clicking Eksport on the Dashboard. The file includes one row per listing with columns: title/address, status, asking price, city, owner name, created date, closed date (empty if listing is still active). Export always includes all listings regardless of current filter state. Priority: must-have.
  > Socrates: Counter-argument considered: exporting all ignores filter — agent may want only filtered results. Resolution: kept; export is a data tool, filter is a view tool; keeping them independent avoids surprising output.

### Help

- [new] Agent can navigate to `/help` by clicking Pomoc on the Dashboard. Priority: must-have.
  > Socrates: Counter-argument considered: navigation loses filter state. Resolution: kept; reset-on-collapse makes this consistent; URL-based filter persistence is v2.

- [new] The `/help` page displays Polish-language content across four sections: (1) jak tworzyć ogłoszenia, (2) dokumenty i lista kontrolna, (3) prowizja i ceny, (4) kontakty i transakcja. The page has a "Powrót do dashboardu" back link. Priority: must-have.
  > Socrates: Counter-argument considered: stale content is worse than no content. Resolution: accepted; the agent is the sole user and can update content files directly when the app changes.

### Preserved

- [preserved] Dashboard listing list renders identically when no filters are active — the no-filter state is identical to the current state.
- [preserved] All `/dashboard/listings/[id]/` sub-page routes remain functional and their URLs are unchanged.
- [preserved] Existing form submit handlers and data writes are not touched.
- [preserved] Authentication session handling is not touched.

## Constraints & Compatibility

- Dashboard listing list must render identically when no filter inputs are set (all filters at default state).
- All `/dashboard/listings/[id]/` sub-page routes remain functional and their URLs are not changed.
- Existing form submit handlers and data writes are not touched.
- Authentication session handling is not touched.
- Filter state is ephemeral — it is not persisted beyond the current browser session; it does not survive page navigation or reload.
- Export reads the already-loaded listing data; it does not make an additional data request.
- The CSV filename includes the export date in ISO format: `estatedesk-YYYY-MM-DD.csv`.
- All new UI strings are in Polish — no English in the shipped product.

## Business Logic Changes

No domain logic change. This is an infrastructure-only change that wires existing UI stubs to new behaviour. The existing domain rules (document-checklist transaction gate, commission split computation) are untouched.

Filter logic: a predicate applied to the already-loaded listing array — not a domain rule.
Export logic: serialisation of the already-loaded listing array to a CSV string — not a domain rule.
Help page: static content rendering — not a domain rule.

## Access Control Changes

No access control changes — current model preserved. Email-and-password login, single user, flat model. Filters and Export are accessible only from an authenticated session (Dashboard is auth-gated). The Help page is also auth-gated — accessible to the logged-in agent only; no public access.

## Non-Goals

- **No URL-based filter state** — filter inputs are ephemeral; URL parameters encoding filter state are not implemented in this change. Rationale: adds routing complexity without meaningful benefit for a single-user app.
- **No additional network requests for filtering** — the full listing list is loaded once on navigation; filtering narrows the view without contacting the server. Rationale: the listing count for a single agent is small enough that a full load is practical.
- **No export of filtered subset** — CSV always contains all listings. Rationale: export is a data tool, filter is a view tool; keeping them independent avoids surprising output.
- **No CMS for Help content** — Help content lives in content files edited directly; no admin UI is built. Rationale: the agent is the sole maintainer; a CMS is over-engineering for one user.

## Open Questions

*(none — all cross-check items passed)*
