---
project: "EstateDesk — Menu, Navigation & Address Formatting"
context_type: brownfield
created: 2026-06-05
updated: 2026-06-05
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "menu shape"
      decision: "horizontal tabs/pill bar — Edit | Pricing | Contacts | Documents | Close"
    - topic: "LLM fallback"
      decision: "inline error, raw text stays editable; agent can retry or proceed"
    - topic: "home page"
      decision: "EstateDesk branded landing page in Polish; design specified separately"
    - topic: "auth change"
      decision: "no change — email + password, single user, flat model preserved"
    - topic: "LLM scope"
      decision: "address formatting runs on both new and edit listing forms"
    - topic: "tab items and order"
      decision: "Edit | Pricing | Contacts | Documents | Close"
    - topic: "home page design readiness"
      decision: "design TBD — FR-005 is a placeholder; actual visual specified separately"
    - topic: "domain rule"
      decision: "LLM normalises Polish address strings — light new rule; nav/home changes are infrastructure-only"
    - topic: "non-goals"
      decision: "no address validation, no offline formatting, no tabs on new form, no home page analytics"
  frs_drafted: 5
  quality_check_status: accepted
---

## Current System

**EstateDesk** — an in-development real estate agent management app for a single Polish agent. Built on Astro 5, React, TypeScript, Tailwind CSS, Supabase (auth + database). Deployed to Cloudflare Workers.

The listing lifecycle is split across five sub-pages under `/dashboard/listings/[id]/`:
- `edit` — listing details, address, owner contact
- `pricing` — asking price history, commission split
- `contacts` — buyers/tenants interested in the listing
- `documents` — document checklist and file uploads
- `close` — transaction completion gate

Navigation between sub-pages is currently ad-hoc: each page has a few manual inline links (e.g. edit has "← Powrót" to dashboard and "Cena i prowizja →" to pricing). There is no consistent menu or tab structure. The home page (`/`) still renders the Astro starter placeholder (`Welcome.astro`) with English text and generic content.

**Must preserve:** existing sub-page routes, form save and data persistence behaviour, Supabase auth session handling.

## Vision & Problem Statement

Four targeted UX and feature gaps in the existing system drive this change:

1. **No per-listing navigation** — agents navigating between listing sub-pages have no visual orientation; the current ad-hoc links are inconsistent across pages.
2. **Inconsistent back link** — "Powrót" exists on some pages but not all, and its target varies.
3. **Manual address formatting** — the address field accepts free text; converting "Sarmacka 5/6 Warszawa" to "ul. Sarmacka 5/6, 02-972 Warszawa (Wilanów)" is done by hand.
4. **Placeholder home page** — the index route still shows 10x Astro Starter content; EstateDesk branding has not replaced it.

## User & Persona

**Primary persona: the single real estate agent**

Same as the existing product PRD (see archived greenfield shape-notes). Works from laptop and phone. The moment they reach for this change: navigating between listing sections mid-workflow or entering a new property address and wanting the Polish-format standard without typing it manually.

## Access Control

No changes. Email and password login. Single user — flat model, no roles. Current Supabase auth model preserved.

No changes planned — current model preserved.

## Success Criteria

### Primary
- Agent navigates between all five listing sub-pages (Edit, Pricing, Contacts, Documents, Close) via a horizontal tab/pill bar without losing context or needing to return to the dashboard first.
- Agent types a partial Polish address (e.g. "Sarmacka 5/6 Warszawa"), presses Enter, and the field is replaced with the LLM-formatted canonical form (e.g. "ul. Sarmacka 5/6, 02-972 Warszawa (Wilanów)").

### Secondary
- The home page displays EstateDesk branding in Polish with working Sign In / Sign Up links.

### Guardrails
- No regression on existing form save behaviour — data written via existing forms must continue saving correctly.
- All existing sub-page routes remain functional — no URL changes.

## User Stories

### US-01: Agent navigates listing sections without returning to dashboard

- **Given** a logged-in agent on any listing sub-page
- **When** they view the tab/pill bar above the content
- **Then** they see the other four sections as clickable tabs and can switch to any of them directly

### US-02: Agent formats a Polish address with one keypress

- **Given** a logged-in agent on the edit or new listing form
- **When** they type a partial address into the address field and press Enter
- **Then** the field is replaced with the LLM-normalised Polish format (ul. prefix, postal code, district); if the LLM call fails, an inline error appears and the raw text remains editable

## Functional Requirements

### Navigation

- FR-001: Agent can navigate between listing sub-pages (Edit, Pricing, Contacts, Documents, Close) via a horizontal tab/pill bar displayed above the current section's content, with the active tab visually highlighted. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: none surfaced — tab nav is clearly needed; current ad-hoc links are a usability gap. Resolution: kept as written.

- FR-002: Agent can always navigate back to the dashboard from any listing sub-page via a consistent "Powrót" link present on every sub-page. Priority: must-have. Change: modified (currently exists only on edit page; needs to be consistent across all sub-pages)
  > Socrates: Counter-argument considered: none surfaced — predictable back link is basic UX hygiene. Resolution: kept as written.

### Address Formatting

- FR-003: Agent can trigger LLM-powered Polish address formatting on the address field by pressing Enter; raw input (e.g. "Sarmacka 5/6 Warszawa") is replaced with a formatted address (e.g. "ul. Sarmacka 5/6, 02-972 Warszawa (Wilanów)"). Applies to both the new listing form and the edit listing form. Uses OpenRouter LLM API. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: none surfaced — manual Polish address formatting is error-prone; LLM normalisation saves time. Resolution: kept as written.

- FR-004: If the OpenRouter LLM call fails or returns an error, the address field retains the agent's raw input and displays an inline error message; the agent can retry the formatting or proceed with raw text. Priority: must-have. Change: new
  > Socrates: Counter-argument considered: none surfaced — graceful degradation is required for any external API dependency. Resolution: kept as written.

### Home Page

- FR-005: The home page (index route, `/`) displays EstateDesk-branded content in Polish, replacing the Astro starter placeholder. The exact visual design is specified separately. Priority: must-have. Change: modified
  > Socrates: Counter-argument considered: none surfaced — the starter placeholder is the wrong product identity; replacing it is straightforward. Resolution: kept as written.

## Business Logic

**For navigation (FR-001, FR-002) and home page (FR-005):** infrastructure-only changes — no domain logic is added or modified.

**For address formatting (FR-003, FR-004):** The app normalises Polish address strings via LLM before they are committed to the form. The rule: a raw address string entered by the agent is passed to the OpenRouter LLM with an instruction to return the canonical Polish format (ul. prefix, comma-separated postal code in format NN-NNN, and district name in parentheses). The LLM's output replaces the raw input in the form field. The agent sees the formatted result and can edit it before saving. The app does not validate the LLM output against a postal database — the LLM response is treated as the canonical input; accuracy depends on LLM knowledge.

## Constraints & Preserved Behavior

- All five existing listing sub-page routes (`/dashboard/listings/[id]/edit`, `/pricing`, `/contacts`, `/documents`, `/close`) must remain functional with their current URL structure.
- Existing form submit handlers and Supabase writes must continue to work unchanged.
- Supabase auth session handling is not touched.
- The `/listings/new` page is a single-step entry form, not a sub-page navigation target — tab navigation does not apply to it.
- OpenRouter API key must be stored in environment variables, not hardcoded.

## Non-Functional Requirements

- Address LLM formatting completes within 3 seconds; the agent perceives the field update as fast.
- The home page is entirely in Polish — no English strings in the shipped product.
- No regression on existing form save behaviour — existing data persistence is preserved by this change.
- Tab navigation renders correctly on narrow screens (Polish mobile widths); tab labels must not overflow or break layout.

## Non-Goals

- **No address validation** — the LLM output is accepted as-is; the app does not verify the address against a Polish postal code database. The formatted string is a normalisation aid, not a confirmed address.
- **No offline address formatting** — formatting requires an active OpenRouter API connection; if the agent is offline, the LLM call is unavailable and raw input is accepted.
- **No tab navigation on the new listing form** — `/listings/new` is a single-step creation form, not a sub-page navigation target; tabs apply only to existing listing sub-pages.
- **No home page analytics or A/B testing** — the redesigned home page is purely presentational; no tracking or experimentation tooling is added.

## Quality cross-check

Status: **accepted** — all six brownfield checks passed:
- Access Control: present (no change — current model preserved)
- Business Logic: present (LLM normalises Polish address strings; nav/home are infrastructure-only)
- Project artifacts: present
- Timeline-cost acknowledgment: present (1–2 weeks ≤ 3-week threshold)
- Non-Goals: present (4 explicit non-goals)
- Preserved behavior: present (existing routes, form saves, auth session preserved)
