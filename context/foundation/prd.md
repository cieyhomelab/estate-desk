---
project: "EstateDesk — Menu, Navigation & Address Formatting"
version: 1
status: draft
created: 2026-06-05
context_type: brownfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  delivery_weeks: 2
  hard_deadline: null
  after_hours_only: true
---

## Current System Overview

EstateDesk is a real estate transaction management web app for a single Polish agent, built on Astro 5, React, TypeScript, and Tailwind CSS, with Supabase handling authentication and database persistence, deployed to Cloudflare Workers.

The listing lifecycle spans five sub-pages under `/dashboard/listings/[id]/`: edit (listing details, address, owner contact), pricing (asking price history, commission split), contacts (interested parties), documents (checklist and file uploads), and close (transaction completion gate). Navigation between sub-pages is ad-hoc — each page carries a handful of manually placed inline links with no consistent structure. The home page (`/`) renders the Astro starter placeholder with English-language generic content unrelated to EstateDesk.

Current user base: one agent, single account, no roles.

## Problem Statement & Motivation

Four UX and feature gaps in the existing system drive this change:

1. **No per-listing navigation** — the agent navigating between listing sub-pages has no visual orientation; ad-hoc inline links are inconsistent across pages and force unnecessary round-trips through the dashboard.
2. **Inconsistent back link** — "Powrót" exists on some sub-pages but not all, and its destination is not always the dashboard.
3. **Manual address formatting** — the address field is free text; converting "Sarmacka 5/6 Warszawa" to the canonical Polish form "ul. Sarmacka 5/6, 02-972 Warszawa (Wilanów)" is done by hand for every listing.
4. **Placeholder home page** — the index route still displays Astro starter content; EstateDesk branding has not replaced it.

The trigger is daily friction: the agent navigates between listing sections mid-workflow without a visible map, re-enters the dashboard unnecessarily, and formats addresses manually for each new listing.

## User & Persona

**Primary persona: the single real estate agent**

A real estate agent in Poland, affiliated with an agency. Works from laptop in the office and on a phone on-site. The moments they reach for this change: switching between listing sections mid-workflow (needs a visible, consistent tab structure), and entering a property address on a new or edited listing (wants the canonical Polish format without typing it by hand).

## Success Criteria

### Primary
- Agent navigates between all five listing sub-pages (Edit, Pricing, Contacts, Documents, Close) via a horizontal tab/pill bar without losing context or needing to return to the dashboard first.
- Agent types a partial Polish address (e.g. "Sarmacka 5/6 Warszawa"), presses Enter, and the field is replaced with the LLM-formatted canonical form (e.g. "ul. Sarmacka 5/6, 02-972 Warszawa (Wilanów)").

### Secondary
- The home page displays EstateDesk branding in Polish with working Sign In / Sign Up links.

### Guardrails
- No regression on existing form save behaviour — data written via existing forms must continue saving correctly after this change.
- All existing listing sub-page routes remain functional — no URL changes.

## User Stories

### US-01: Agent navigates listing sections without returning to dashboard

- **Given** a logged-in agent on any listing sub-page
- **When** they view the tab/pill bar above the current section's content
- **Then** they see the other four sections as clickable tabs and can switch to any of them directly

#### Acceptance Criteria
- All five tabs (Edit, Pricing, Contacts, Documents, Close) are present on every listing sub-page
- The currently active tab is visually distinct from the others
- Clicking a tab navigates to that sub-page for the same listing without returning to the dashboard

### US-02: Agent formats a Polish address with one keypress

- **Given** a logged-in agent on the edit or new listing form with the address field focused
- **When** they type a partial address (e.g. "Sarmacka 5/6 Warszawa") and press Enter
- **Then** the field is replaced with the LLM-normalised Polish format (e.g. "ul. Sarmacka 5/6, 02-972 Warszawa (Wilanów)"); if the external LLM call fails, an inline error appears and the raw text remains editable

#### Acceptance Criteria
- Formatting is available on both the new listing form and the edit listing form
- The formatted address is editable before saving — the agent is not locked into the LLM output
- A loading indicator is shown while the LLM call is in flight
- On failure, the field reverts to the raw text with an inline error; a retry is possible without refreshing the page

## Scope of Change

### Navigation

- [new] Per-listing horizontal tab/pill bar displayed above each listing sub-page's content; tabs: Edit | Pricing | Contacts | Documents | Close (in that order); the active tab is visually highlighted.
  > Socratic: Counter-argument considered: none surfaced — tab nav is clearly needed; current ad-hoc links are a usability gap. Resolution: kept as written.

- [modified] "Powrót" back link present on every listing sub-page, always navigating to the dashboard. Previously: present only on the edit sub-page with inconsistent targets across sub-pages.
  > Socratic: Counter-argument considered: none surfaced — predictable back link is basic UX hygiene. Resolution: kept as written.

### Address Formatting

- [new] Address field behaviour on both the new listing form and the edit listing form: pressing Enter while the field is focused triggers a call to an external LLM API that normalises the raw input into canonical Polish address format (ul. prefix, postal code in NN-NNN format, district in parentheses). The formatted result replaces the raw input; the agent can edit it before saving.
  > Socratic: Counter-argument considered: none surfaced — manual Polish address formatting is error-prone; LLM normalisation saves time. Resolution: kept as written.

- [new] Address field error state: if the external LLM call fails or returns an error, the field retains the agent's raw input and displays an inline error message; the agent can retry or proceed with raw text.
  > Socratic: Counter-argument considered: none surfaced — graceful degradation is required for any external API dependency. Resolution: kept as written.

### Home Page

- [modified] The home page (index route, `/`) content is replaced with EstateDesk-branded content in Polish; the Astro starter placeholder is removed. The exact visual design is specified separately.
  > Socratic: Counter-argument considered: none surfaced — the starter placeholder carries the wrong product identity; replacing it is straightforward. Resolution: kept as written.

### Preserved

- [preserved] All five listing sub-page routes (`/dashboard/listings/[id]/edit`, `/pricing`, `/contacts`, `/documents`, `/close`) and their URL structure.
- [preserved] Existing form submit handlers and database writes — unchanged by this change.
- [preserved] Authentication and session handling — not touched.
- [preserved] `/listings/new` as a single-step creation form — tab navigation does not apply to it.

## Constraints & Compatibility

- All five existing listing sub-page routes must retain their current URL structure; no redirects or URL renames.
- Existing form submit behaviour and database writes must not be altered by the navigation or address formatting changes.
- Authentication session handling is not touched by this change.
- The `/listings/new` page remains a single-step creation form; per-listing tabs are not added to it.
- The external LLM API key for address formatting must not be hardcoded in source code or committed to version control.

## Business Logic Changes

**For navigation (tab bar, back link) and home page:** infrastructure-only changes — no domain logic is added or modified.

**For address formatting:** The app normalises Polish address strings via an external LLM API before they are committed to the form. The rule: a raw address string entered by the agent triggers a normalisation call that returns the canonical Polish format — "ul." prefix before the street name, comma-separated postal code in NN-NNN format, and the district name in parentheses. The normalised result replaces the raw input in the address field. The agent sees the formatted result and can edit it before saving. The app does not validate the output against a postal database — the LLM response is treated as canonical; accuracy depends on the LLM's knowledge.

## Access Control Changes

No access control changes — current model preserved. Email and password login, single user, flat model.

## Non-Goals

- **No address validation** — the LLM output is accepted as-is; the app does not verify the formatted address against a Polish postal code database. The formatted string is a normalisation aid, not a confirmed address.
- **No offline address formatting** — formatting requires an active connection to the external LLM API; if the agent is offline, the formatting feature is unavailable and raw input is accepted.
- **No tab navigation on the new listing form** — `/listings/new` is a single-step creation form, not a sub-page navigation target; tabs apply only to existing listing sub-pages.
- **No home page analytics or A/B testing** — the redesigned home page is purely presentational; no tracking or experimentation tooling is added.

## Open Questions

1. **Which external LLM service is used for address formatting?** — The user specified OpenRouter in shape notes. Owner: user. Resolution: forward to implementation planning; does not block PRD.
2. **What is the final visual design for the home page?** — FR-005 / `[modified] home page` is a placeholder; the exact design (layout, copy, visual identity) is specified separately. Owner: user. Block: no (existing routes and auth links are unblocked; only the visual content is TBD). Resolution: before home page implementation begins.
