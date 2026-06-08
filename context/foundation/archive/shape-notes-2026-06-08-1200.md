---
project: "EstateDesk"
context_type: greenfield
created: 2026-05-22
updated: 2026-05-22
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "pain category"
      decision: "workflow friction — tools don't talk to each other"
    - topic: "agent model"
      decision: "agency-affiliated — commission splits into gross income, tax, agency portion, agent portion"
    - topic: "AI scope"
      decision: "missing-step hints + commission validation are MVP-priority v2; doc generation and summaries are lower-priority v2. All AI features removed from MVP scope in Step 3 scope-down."
    - topic: "auth method"
      decision: "email + password login"
    - topic: "user count"
      decision: "single user only — flat model, no roles"
    - topic: "MVP scope decision"
      decision: "3 weeks after-hours — core transaction workflow only; all AI features deferred to v2"
    - topic: "primary success criterion"
      decision: "agent closes a transaction without losing track of any required document"
    - topic: "photo storage"
      decision: "real file upload in app — storage dependency accepted for MVP"
    - topic: "done reversibility"
      decision: "done is reversible — agent can reopen a closed listing"
    - topic: "commission split config"
      decision: "configurable in account settings — agent sets split % once, auto-applies to all listings"
    - topic: "document checklist shape"
      decision: "pre-populated per listing type (sale vs. occasional rental), agent-editable"
    - topic: "domain rule"
      decision: "transaction gate — app enforces required-document workflow per listing type"
    - topic: "product type"
      decision: "web-app"
    - topic: "target scale"
      decision: "small — just the one agent, or a handful"
    - topic: "non-goals"
      decision: "no client portal — buyers/tenants are contacts only, never log in"
  frs_drafted: 21
  quality_check_status: accepted
---

## Vision & Problem Statement

A single real estate agent in Poland manages the full lifecycle of property listings (sale and occasional rental / *najem okazjonalny*) — owner onboarding, required-document collection, buyer/tenant contact tracking, price negotiations, commission calculations, notary scheduling, and transaction close — without a tool that understands the Polish real estate workflow. The agent context-switches across spreadsheets, email threads, and phone contacts while juggling 5–20+ active listings simultaneously. The result: documents get missed, commissions are miscalculated on paper, and there is no single source of truth for where any deal stands.

The insight: Polish real estate transactions follow a predictable document checklist (different for sale vs. *najem okazjonalny*), and an agent-affiliated commission split has a fixed formula (gross income → tax provision → agency portion → agent net). Both are mechanical but currently done by hand. An app that enforces the checklist and computes the split correctly removes the two categories of mistake that cost an agent the most time and credibility.

## User & Persona

**Primary persona: the single real estate agent**

A real estate agent in Poland, affiliated with an agency. Manages property listings independently — the agency provides brand and infrastructure; the agent owns the client relationships and the deal lifecycle. Works from a laptop in the office and on a phone on-site. The moment they reach for this app: a client calls asking for a status update, and the agent needs to instantly know which documents are still missing and what the commission will net them.

## Access Control

Email and password login. Single user — the agent creates one account and is the only person who logs in. No role separation. No guest or read-only access. Personal data (owner names and contacts, buyer/tenant names and contacts) is not accessible without an authenticated session.

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

### Listings
- FR-003: Agent can create a listing (property type: sale or occasional rental / najem okazjonalny). Priority: must-have
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
- FR-014: Agent can view all contacts associated with a listing. Priority: must-have (renumbered from FR-013 in original; editorial note only)

### Documents
- FR-015: Agent can view a pre-populated document checklist (based on listing type: sale vs. occasional rental) and check off, add, or remove items. Priority: must-have
  > Socrates: Counter-argument considered: free-form checklist is more flexible but the agent re-types the same 12 items per listing. Resolution: pre-populated per listing type, agent-editable — standard Polish sale/najem okazjonalny document lists are stable.
- FR-016: Agent can upload document files to a listing. Priority: must-have

### Transaction
- FR-017: Agent can record notary office name and details on a listing. Priority: must-have
- FR-018: Agent can set transaction date and time on a listing. Priority: must-have

### AI — v2 nice-to-haves (deferred from MVP)
- FR-019: Agent can request AI missing-step hints for an active listing. Priority: nice-to-have
- FR-020: Agent can request AI commission-validation check. Priority: nice-to-have
- FR-021: Agent can generate AI-drafted transaction documents for a listing. Priority: nice-to-have
- FR-022: Agent can save AI-summarized conversation notes to a listing. Priority: nice-to-have

## Non-Functional Requirements

- Personal data (owner name, owner contact, buyer/tenant names and contacts) leaves no trace accessible to any unauthenticated request.
- Any page load completes within 3 seconds on a standard Polish mobile internet connection.
- Completed listings remain visible and readable indefinitely — the agent has a permanent historical record.
- Document file uploads are accepted up to at least 10 MB per file.
- The application UI is in Polish throughout — no English strings visible to the user in the shipped product.

## Business Logic

**The app determines which documents are required for a property transaction based on listing type (sale or occasional rental) and tracks completion, preventing the transaction from being closed until all required items are checked off or the agent explicitly overrides the gate.**

The rule consumes two user-facing inputs: the listing type (sale vs. *najem okazjonalny*) selected when the listing is created, and the agent's actions on the document checklist (checking items as obtained, adding custom items, or activating the override). The rule's output is a transaction-readiness signal: the listing is either ready-to-close (all items checked or override active) or blocked (items outstanding, no override). The agent encounters the rule at the moment they attempt to mark a transaction done — the app either allows the action or presents the list of outstanding items.

A secondary rule governs commission computation: given a total commission amount entered by the agent and split percentages configured in account settings, the app computes gross income (commission minus agency portion), tax provision (percentage of gross income), and agent net (gross income minus tax provision). The split must sum to the entered total; any rounding difference surfaces as a validation error, not a silent adjustment.

## Access Control

Email and password login. Single user — flat model, no roles. Personal data not accessible without a valid session.

## Non-Goals

- **No client portal** — buyers and tenants are contacts the agent manages; they have no app access in v1. Rationale: adding a client-facing view doubles the auth surface and creates a second UX to maintain before the core workflow is proven.
- **No external portal integration** — the app does not sync with or publish to Otodom, Gratka, or any other real estate listing platform. Rationale: integration scope dwarfs the core workflow; agent workflow is the MVP value, not listing distribution.
- **No full accounting** — commission split is informational; it is not a VAT invoice, an accounting export, or a substitute for an accountant. Rationale: financial document generation is v2 (FR-021); the split calc is a decision-support tool, not a compliance artifact.
- **No offline-first guarantee** — the web app requires an internet connection; no service-worker-based offline mode in v1.
- **No AI features in MVP** — all four AI capabilities (missing-step hints, commission validation, document generation, conversation summaries) are v2. The two utility AI features (hints + validation) are v2 priority #1.

## Open Questions

*(none — all cross-check items passed)*

## Quality cross-check

Status: **accepted** — all five greenfield checks passed:
- Access Control: present
- Business Logic (one-sentence rule): present
- Project artifacts: present
- Timeline-cost acknowledgment: present (3 weeks ≤ 3-week threshold)
- Non-Goals: present

## Forward: tech-stack

*(no technology preferences stated by user — stack selection runs via /10x-tech-stack-selector)*

---

# EstateDesk — Menu, Navigation & Address Formatting

```
context_type: brownfield
created: 2026-06-05
updated: 2026-06-05
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - menu shape: horizontal tabs/pill bar — Edit | Pricing | Contacts | Documents | Close
    - LLM fallback: inline error, raw text stays editable; agent can retry or proceed
    - home page: EstateDesk branded landing page in Polish; design specified separately
    - auth change: no change — email + password, single user, flat model preserved
    - LLM scope: address formatting runs on both new and edit listing forms
    - tab items and order: Edit | Pricing | Contacts | Documents | Close
    - home page design readiness: design TBD — FR-005 is a placeholder; actual visual specified separately
    - domain rule: LLM normalises Polish address strings — light new rule; nav/home changes are infrastructure-only
    - non-goals: no address validation, no offline formatting, no tabs on new form, no home page analytics
  frs_drafted: 5
  quality_check_status: accepted
```

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

## Vision & Problem Statement (Brownfield)

Four targeted UX and feature gaps in the existing system drive this change:

1. **No per-listing navigation** — agents navigating between listing sub-pages have no visual orientation; the current ad-hoc links are inconsistent across pages.
2. **Inconsistent back link** — "Powrót" exists on some pages but not all, and its target varies.
3. **Manual address formatting** — the address field accepts free text; converting "Sarmacka 5/6 Warszawa" to "ul. Sarmacka 5/6, 02-972 Warszawa (Wilanów)" is done by hand.
4. **Placeholder home page** — the index route still shows Astro Starter content; EstateDesk branding has not replaced it.

## Success Criteria (Brownfield)

### Primary
- Agent navigates between all five listing sub-pages (Edit, Pricing, Contacts, Documents, Close) via a horizontal tab/pill bar without losing context or needing to return to the dashboard first.
- Agent types a partial Polish address (e.g. "Sarmacka 5/6 Warszawa"), presses Enter, and the field is replaced with the LLM-formatted canonical form (e.g. "ul. Sarmacka 5/6, 02-972 Warszawa (Wilanów)").

### Secondary
- The home page displays EstateDesk branding in Polish with working Sign In / Sign Up links.

### Guardrails
- No regression on existing form save behaviour — data written via existing forms must continue saving correctly.
- All existing sub-page routes remain functional — no URL changes.

## User Stories (Brownfield)

### US-01: Agent navigates listing sections without returning to dashboard

- **Given** a logged-in agent on any listing sub-page
- **When** they view the tab/pill bar above the content
- **Then** they see the other four sections as clickable tabs and can switch to any of them directly

### US-02: Agent formats a Polish address with one keypress

- **Given** a logged-in agent on the edit or new listing form
- **When** they type a partial address into the address field and press Enter
- **Then** the field is replaced with the LLM-normalised Polish format (ul. prefix, postal code, district); if the LLM call fails, an inline error appears and the raw text remains editable

## Functional Requirements (Brownfield)

### Navigation

- FR-001: Agent can navigate between listing sub-pages (Edit, Pricing, Contacts, Documents, Close) via a horizontal tab/pill bar displayed above the current section's content, with the active tab visually highlighted. Priority: must-have. Change: new

- FR-002: Agent can always navigate back to the dashboard from any listing sub-page via a consistent "Powrót" link present on every sub-page. Priority: must-have. Change: modified (currently exists only on edit page; needs to be consistent across all sub-pages)

### Address Formatting

- FR-003: Agent can trigger LLM-powered Polish address formatting on the address field by pressing Enter; raw input (e.g. "Sarmacka 5/6 Warszawa") is replaced with a formatted address (e.g. "ul. Sarmacka 5/6, 02-972 Warszawa (Wilanów)"). Applies to both the new listing form and the edit listing form. Uses OpenRouter LLM API. Priority: must-have. Change: new

- FR-004: If the OpenRouter LLM call fails or returns an error, the address field retains the agent's raw input and displays an inline error message; the agent can retry the formatting or proceed with raw text. Priority: must-have. Change: new

### Home Page

- FR-005: The home page (index route, `/`) displays EstateDesk-branded content in Polish, replacing the Astro starter placeholder. The exact visual design is specified separately. Priority: must-have. Change: modified

## Business Logic (Brownfield)

**For navigation (FR-001, FR-002) and home page (FR-005):** infrastructure-only changes — no domain logic is added or modified.

**For address formatting (FR-003, FR-004):** The app normalises Polish address strings via LLM before they are committed to the form. The rule: a raw address string entered by the agent is passed to the OpenRouter LLM with an instruction to return the canonical Polish format (ul. prefix, comma-separated postal code in format NN-NNN, and district name in parentheses). The LLM's output replaces the raw input in the form field. The agent sees the formatted result and can edit it before saving. The app does not validate the LLM output against a postal database — the LLM response is treated as the canonical input; accuracy depends on LLM knowledge.

## Constraints & Preserved Behavior

- All five existing listing sub-page routes (`/dashboard/listings/[id]/edit`, `/pricing`, `/contacts`, `/documents`, `/close`) must remain functional with their current URL structure.
- Existing form submit handlers and Supabase writes must continue to work unchanged.
- Supabase auth session handling is not touched.
- The `/listings/new` page is a single-step entry form, not a sub-page navigation target — tab navigation does not apply to it.
- OpenRouter API key must be stored in environment variables, not hardcoded.

## Non-Functional Requirements (Brownfield)

- Address LLM formatting completes within 3 seconds; the agent perceives the field update as fast.
- The home page is entirely in Polish — no English strings in the shipped product.
- No regression on existing form save behaviour — existing data persistence is preserved by this change.
- Tab navigation renders correctly on narrow screens (Polish mobile widths); tab labels must not overflow or break layout.

## Non-Goals (Brownfield)

- **No address validation** — the LLM output is accepted as-is; the app does not verify the address against a Polish postal code database.
- **No offline address formatting** — formatting requires an active OpenRouter API connection.
- **No tab navigation on the new listing form** — `/listings/new` is a single-step creation form; tabs apply only to existing listing sub-pages.
- **No home page analytics or A/B testing** — the redesigned home page is purely presentational.

## Quality cross-check (Brownfield)

Status: **accepted** — all six brownfield checks passed:
- Access Control: present (no change — current model preserved)
- Business Logic: present (LLM normalises Polish address strings; nav/home are infrastructure-only)
- Project artifacts: present
- Timeline-cost acknowledgment: present (1–2 weeks ≤ 3-week threshold)
- Non-Goals: present (4 explicit non-goals)
- Preserved behavior: present (existing routes, form saves, auth session preserved)
