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
