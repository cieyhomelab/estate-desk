---
project: "EstateDesk"
version: 2
status: draft
created: 2026-05-22
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

A single real estate agent in Poland manages the full lifecycle of property listings (sale and occasional rental / *najem okazjonalny*) — owner onboarding, required-document collection, buyer/tenant contact tracking, price negotiations, commission calculations, notary scheduling, and transaction close — without a tool that understands the Polish real estate workflow. The agent context-switches across spreadsheets, email threads, and phone contacts while juggling 5–20+ active listings simultaneously. The result: documents get missed, commissions are miscalculated on paper, and there is no single source of truth for where any deal stands.

The insight: Polish real estate transactions follow a predictable document checklist (different for sale vs. *najem okazjonalny*), and an agent-affiliated commission split has a fixed formula (gross income → tax provision → agency portion → agent net). Both are mechanical but currently done by hand. An app that enforces the checklist and computes the split correctly removes the two categories of mistake that cost an agent the most time and credibility.

## User & Persona

**Primary persona: the single real estate agent**

A real estate agent in Poland, affiliated with an agency. Manages property listings independently — the agency provides brand and infrastructure; the agent owns the client relationships and the deal lifecycle. Works from a laptop in the office and on a phone on-site. The moment they reach for this app: a client calls asking for a status update, and the agent needs to instantly know which documents are still missing and what the commission will net them.

## Success Criteria

### Primary
- Agent closes a real estate transaction from listing creation to "done" without losing track of any required document — every required item is either checked off or explicitly overridden before the transaction is marked complete.

### Secondary
- Price-change history is visible per listing — the agent can see the full pricing timeline without reconstructing it from emails.

### Guardrails
- No data loss — a listing saved must be retrievable on the next login.
- Commission numbers match exactly what the agent entered — no silent rounding errors; commission split must sum to the entered total.
- Personal data (owner, buyer/tenant contacts) is not accessible without a valid session.
- Polish language throughout — no English UI strings in the shipped application.

## User Stories

### US-01: Agent tracks a property transaction to completion

- **Given** a logged-in agent with an active listing (sale or occasional rental) and a pre-populated document checklist
- **When** they tick off the required documents, record the notary office and transaction date, and click "Mark as done"
- **Then** the listing moves to the completed view with a visible "done" status, and the commission split (gross / tax / agency / agent) is locked and recorded

#### Acceptance Criteria
- All document checklist items show as checked before "done" is available, or the agent explicitly overrides the incomplete checklist
- Commission split totals must equal the entered total commission (no rounding gap)
- Agent can reopen a done listing; it returns to active with all data intact

## Functional Requirements

### Authentication
- FR-001: Agent can register an account with email and password. Priority: must-have
- FR-002: Agent can log in and log out. Priority: must-have
- FR-023: Agent can permanently delete their account and all associated data. Priority: must-have

### Listings
- FR-003: Agent can create a listing (property type: sale or occasional rental / *najem okazjonalny*). Priority: must-have
- FR-004: Agent can edit and delete a listing. Priority: must-have
- FR-005: Agent can upload and attach photos to a listing. Priority: must-have
  > Socrates: Counter-argument considered: photo storage adds a CDN/storage dependency before the workflow is proven. Resolution: kept as must-have — a link field is not professionally acceptable; photos must be stored in the app.
- FR-006: Agent can view all listings in a dashboard (active and done). Priority: must-have
- FR-007: Agent can mark a listing as transaction-complete (done) and reopen it if the deal falls through. Priority: must-have
  > Socrates: Counter-argument considered: "done" as a one-way door means a collapsed deal requires a new listing. Resolution: done is reversible — real estate deals collapse; agent needs an undo.

### Owner
- FR-008: Agent can record owner name, phone, and email on a listing. Priority: must-have

### Pricing & Commission
- FR-009: Agent can set and update the asking price on a listing. Priority: must-have
- FR-010: Agent can view price-change history for a listing. Priority: must-have
- FR-011: Agent can enter the total commission for a listing and see it automatically split using their configured rates (gross income / tax provision / agency portion / agent portion). Priority: must-have
  > Socrates: Counter-argument considered: hard-coded split percentages break when the agency renegotiates rates. Resolution: split percentages are configurable in account settings (see FR-012).
- FR-012: Agent can configure commission split rates (tax rate, agency %, agent %) once in account settings; rates auto-apply to all listings. Priority: must-have

### Contacts (buyers / tenants)
- FR-013: Agent can add interested-party contacts (name, phone, email) to a listing. Priority: must-have
- FR-014: Agent can view all contacts associated with a listing. Priority: must-have

### Documents
- FR-015: Agent can view a pre-populated document checklist (based on listing type: sale vs. *najem okazjonalny*) and check off, add, or remove items. Priority: must-have
  > Socrates: Counter-argument considered: free-form checklist is more flexible but the agent re-types the same 12 items per listing. Resolution: pre-populated per listing type, agent-editable — standard Polish sale/*najem okazjonalny* document lists are stable.
- FR-016: Agent can upload document files to a listing. Priority: must-have

### Transaction
- FR-017: Agent can record notary office name and details on a listing. Priority: must-have
- FR-018: Agent can set transaction date and time on a listing. Priority: must-have

### AI — v2 nice-to-haves (not in MVP scope)
- FR-019: Agent can request AI missing-step hints for an active listing. Priority: nice-to-have
- FR-020: Agent can request AI commission-validation check. Priority: nice-to-have
- FR-021: Agent can generate AI-drafted transaction documents for a listing. Priority: nice-to-have
- FR-022: Agent can save AI-summarized conversation notes to a listing. Priority: nice-to-have

## Non-Functional Requirements

- Personal data (owner name, owner contact, buyer/tenant names and contacts) is not accessible to any unauthenticated request.
- Any page load completes within 3 seconds on a standard Polish mobile internet connection.
- Completed listings remain visible and readable indefinitely — the agent has a permanent historical record.
- Document file uploads are accepted up to at least 10 MB per file.
- The application UI is in Polish throughout — no English strings visible to the user in the shipped product.

## Business Logic

**The app determines which documents are required for a property transaction based on listing type (sale or occasional rental) and tracks completion, preventing the transaction from being closed until all required items are checked off or the agent explicitly overrides the gate.**

The rule consumes two user-facing inputs: the listing type (sale vs. *najem okazjonalny*) selected when the listing is created, and the agent's actions on the document checklist (checking items as obtained, adding custom items, or activating the override). The rule's output is a transaction-readiness signal: the listing is either ready-to-close (all items checked or override active) or blocked (items outstanding, no override). The agent encounters the rule at the moment they attempt to mark a transaction done — the app either allows the action or presents the list of outstanding items.

A secondary rule governs commission computation: given a total commission amount entered by the agent and split percentages configured in account settings, the app computes gross income (commission minus agency portion), tax provision (percentage of gross income), and agent net (gross income minus tax provision). The split must sum to the entered total; any rounding difference surfaces as a validation error, not a silent adjustment.

## Access Control

Email and password login. Single user — the agent creates one account and is the only person who logs in. No role separation. No guest or read-only access. Personal data (owner names and contacts, buyer/tenant names and contacts) is not accessible without an authenticated session.

## Non-Goals

- **No client portal** — buyers and tenants are contacts the agent manages; they have no app access in v1. Rationale: adding a client-facing view doubles the auth surface and creates a second UX to maintain before the core workflow is proven.
- **No external portal integration** — the app does not sync with or publish to Otodom, Gratka, or any other real estate listing platform. Rationale: integration scope dwarfs the core workflow; agent workflow is the MVP value, not listing distribution.
- **No full accounting** — commission split is informational; it is not a VAT invoice, an accounting export, or a substitute for an accountant. Rationale: financial document generation is v2 (FR-021); the split calc is a decision-support tool, not a compliance artifact.
- **No offline-first guarantee** — the web app requires an internet connection; no service-worker-based offline mode in v1.
- **No AI features in MVP** — all four AI capabilities (missing-step hints, commission validation, document generation, conversation summaries) are v2. The two utility AI features (FR-019: hints, FR-020: commission validation) are v2 priority #1.

## Open Questions

No open questions at PRD generation time — all cross-check items passed during `/10x-shape` session on 2026-05-22.

---

# PRD: EstateDesk — Menu, Navigation & Address Formatting

```
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
```

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

## User & Persona (Brownfield)

**Primary persona: the single real estate agent**

A real estate agent in Poland, affiliated with an agency. Works from laptop in the office and on a phone on-site. The moments they reach for this change: switching between listing sections mid-workflow (needs a visible, consistent tab structure), and entering a property address on a new or edited listing (wants the canonical Polish format without typing it by hand).

## Success Criteria (Brownfield)

### Primary
- Agent navigates between all five listing sub-pages (Edit, Pricing, Contacts, Documents, Close) via a horizontal tab/pill bar without losing context or needing to return to the dashboard first.
- Agent types a partial Polish address (e.g. "Sarmacka 5/6 Warszawa"), presses Enter, and the field is replaced with the LLM-formatted canonical form (e.g. "ul. Sarmacka 5/6, 02-972 Warszawa (Wilanów)").

### Secondary
- The home page displays EstateDesk branding in Polish with working Sign In / Sign Up links.

### Guardrails
- No regression on existing form save behaviour — data written via existing forms must continue saving correctly after this change.
- All existing listing sub-page routes remain functional — no URL changes.

## User Stories (Brownfield)

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

- [modified] "Powrót" back link present on every listing sub-page, always navigating to the dashboard. Previously: present only on the edit sub-page with inconsistent targets across sub-pages.

### Address Formatting

- [new] Address field behaviour on both the new listing form and the edit listing form: pressing Enter while the field is focused triggers a call to an external LLM API (OpenRouter) that normalises the raw input into canonical Polish address format (ul. prefix, postal code in NN-NNN format, district in parentheses). The formatted result replaces the raw input; the agent can edit it before saving.

- [new] Address field error state: if the external LLM call fails or returns an error, the field retains the agent's raw input and displays an inline error message; the agent can retry or proceed with raw text.

### Home Page

- [modified] The home page (index route, `/`) content is replaced with EstateDesk-branded content in Polish; the Astro starter placeholder is removed. The exact visual design is specified separately.

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

## Non-Goals (Brownfield)

- **No address validation** — the LLM output is accepted as-is; the app does not verify the formatted address against a Polish postal code database. The formatted string is a normalisation aid, not a confirmed address.
- **No offline address formatting** — formatting requires an active connection to the external LLM API; if the agent is offline, the formatting feature is unavailable and raw input is accepted.
- **No tab navigation on the new listing form** — `/listings/new` is a single-step creation form, not a sub-page navigation target; tabs apply only to existing listing sub-pages.
- **No home page analytics or A/B testing** — the redesigned home page is purely presentational; no tracking or experimentation tooling is added.

## Open Questions (Brownfield)

1. **Which external LLM service is used for address formatting?** — The user specified OpenRouter in shape notes. Owner: user. Resolution: forward to implementation planning; does not block PRD.
2. **What is the final visual design for the home page?** — The exact design (layout, copy, visual identity) is specified separately. Owner: user. Block: no (existing routes and auth links are unblocked; only the visual content is TBD). Resolution: before home page implementation begins.
