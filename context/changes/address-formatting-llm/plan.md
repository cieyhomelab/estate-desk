# LLM-Powered Polish Address Formatting — Implementation Plan

## Overview

Add an address formatting feature to the edit and new listing forms. The agent types a raw Polish address (e.g. "Sarmacka 5/6 Warszawa"), presses Enter or clicks an inline "Formatuj" button, and the field is replaced with the canonical Polish form ("ul. Sarmacka 5/6, 02-972 Warszawa (Wilanów)") via a server-side OpenRouter Gemini 2.5 Flash call. On failure the raw text is preserved with an inline Polish-language error; retrying is done by editing and re-triggering. The entire interaction is a React island (`client:load`) embedded inside the existing Astro HTML forms; form submission mechanics are unchanged.

## Current State Analysis

Both `edit.astro` (lines 68-80) and `new.astro` (lines 40-47) render a plain `<input type="text" name="address">` with no interactivity. Neither form contains any React islands today. The `OPENROUTER_API_KEY` exists in `.env` but is not declared in `astro.config.mjs` env schema, making it inaccessible via `astro:env/server`. No LLM integration exists anywhere in the codebase. The S-01 `ListingTabs` component is already in `edit.astro` — the baseline is clean.

## Desired End State

The address field on both the edit listing form and the new listing form is a React island (`AddressField.tsx`) that:
- Renders a styled text input (`name="address"`, `required`) that feeds into the parent Astro form's `formData()` on submit
- Triggers a POST to `/api/format-address` on Enter key or "Formatuj" button click
- Shows a spinner/loading state while the call is in flight
- On success: replaces the raw text with the formatted address (editable before saving)
- On error or 5s timeout: keeps the raw text and shows an inline Polish error below the field
- Shows a hint line: "Naciśnij Enter lub kliknij Formatuj, aby sformatować adres do formy kanonicznej."

Verification: open `/dashboard/listings/[id]/edit`, type "Sarmacka 5/6 Warszawa" into the address field, click "Formatuj" — the field updates to the canonical form. Submit the form — the formatted address saves to the database.

### Key Discoveries

- `edit.astro:50` — form POSTs to `/api/listings/${listing.id}/update`; `new.astro:20` — POSTs to `/api/listings/create`. Both use `formData()` server-side, so a React island rendering `<input name="address">` feeds in naturally.
- `astro.config.mjs:29-33` — env schema has `SUPABASE_URL`, `SUPABASE_KEY`, `PUBLIC_SENTRY_DSN`. `OPENROUTER_API_KEY` must be added here before it can be imported.
- `src/pages/api/` routes all use redirect-based responses (form-style). The new format-address route is fetch-style (JSON response) per CLAUDE.md §3 — this is intentional and consistent with the island-calling pattern documented there.
- No existing fetch-style (JSON) API routes exist yet — this is the first. The pattern is documented in CLAUDE.md §2.

## What We're NOT Doing

- Address validation against a Polish postal code database (PRD §Non-Goals)
- Offline formatting fallback (PRD §Non-Goals)
- Tab navigation on the new listing form (PRD §Non-Goals)
- Automatic formatting on save — the agent explicitly triggers formatting before submitting
- Streaming the LLM response — the full formatted address is returned at once

## Implementation Approach

Three sequential phases: (1) server-side infrastructure — env schema + API route; (2) client-side island — `AddressField.tsx`; (3) page integration — swap the plain inputs in both forms. Each phase is independently verifiable before proceeding. The API route is stateless and has no database writes — it is purely a proxy to OpenRouter.

## Critical Implementation Details

**Enter key must not submit the form.** The `AddressField` input must call `e.preventDefault()` in its `onKeyDown` handler when `e.key === "Enter"` — otherwise pressing Enter submits the parent `<form>`. The "Formatuj" button must have `type="button"` to prevent the same.

**React controlled input feeds `formData()` via the DOM.** The island renders `<input name="address" value={value} onChange={...}>` inside the Astro `<form>`. At submit time, the browser reads the live DOM value — React keeps this in sync — so no hidden input is needed.

**`OPENROUTER_API_KEY` optional in schema.** Per the existing pattern (`SUPABASE_URL`, `SUPABASE_KEY` are both `optional: true`), declare the key as `optional: true`. The API route should return a 503 with a Polish error message if the key is absent at runtime.

---

## Phase 1: Infrastructure — Env Schema and API Route

### Overview

Declare `OPENROUTER_API_KEY` in the Astro env schema so it is accessible server-side, then create the `format-address` API route that proxies the raw address to OpenRouter and returns a formatted result as JSON.

### Changes Required

#### 1. Env Schema Declaration

**File**: `astro.config.mjs`

**Intent**: Add `OPENROUTER_API_KEY` to the `env.schema` so `astro:env/server` exposes it in the Workers runtime. Without this, the key is undefined even when set in `.env` or Cloudflare secrets.

**Contract**: Add one entry to the `schema` object, consistent with the existing `SUPABASE_URL` pattern:
```
OPENROUTER_API_KEY: envField.string({ context: "server", access: "secret", optional: true })
```

#### 2. Address Formatting API Route

**File**: `src/pages/api/format-address.ts`

**Intent**: Accept `{ raw: string }` JSON body, call OpenRouter with `google/gemini-2.5-flash`, and return `{ formatted: string }` or `{ error: string }`. This is a fetch-style route (JSON response), not a redirect-style route — it is called by the React island, not by an HTML form POST.

**Contract**: 
- Export `POST: APIRoute`
- Auth check: read user via Supabase before calling OpenRouter (the agent must be logged in)
- Parse body: `const { raw } = await context.request.json()`
- Validate: if `raw` is empty or not a string, return `400 { error: "Brak adresu" }`
- If `OPENROUTER_API_KEY` is absent, return `503 { error: "Formatowanie niedostępne — brak klucza API" }`
- Call OpenRouter with 5s `AbortController` timeout: `POST https://openrouter.ai/api/v1/chat/completions`, model `google/gemini-2.5-flash`, system prompt instructing canonical Polish address formatting (ul. prefix, NN-NNN postal code, district in parentheses), single-turn user message containing `raw`
- On success: parse `choices[0].message.content`, return `200 { formatted: "<result>" }`
- On timeout or fetch error: return `504 { error: "Formatowanie trwa zbyt długo. Sprawdź połączenie i spróbuj ponownie." }`
- On OpenRouter non-2xx: return `502 { error: "Błąd zewnętrznego serwisu formatowania adresu." }`
- All responses use `Content-Type: application/json`

System prompt to embed verbatim in the route:
```
Jesteś asystentem formatowania adresów w Polsce. Przekształć podany adres do kanonicznej formy polskiej: prefiks "ul." przed nazwą ulicy (jeśli to ulica), kod pocztowy w formacie NN-NNN, nazwa dzielnicy w nawiasie okrągłym na końcu. Zwróć TYLKO sformatowany adres — żadnego dodatkowego tekstu, wyjaśnień ani cudzysłowów.
```

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run typecheck`
- Build succeeds: `npm run build`

#### Manual Verification

- `curl -X POST http://localhost:4321/api/format-address -H "Content-Type: application/json" -d '{"raw":"Sarmacka 5/6 Warszawa"}' -b "<valid-session-cookie>"` returns `{"formatted":"ul. Sarmacka 5/6, 02-972 Warszawa (Wilanów)"}` (or similar canonical form)
- Calling without auth redirects or returns an appropriate auth error
- Calling with an empty `raw` field returns `400`

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation that the API route returns a plausible formatted address before proceeding.

---

## Phase 2: React Island — AddressField Component

### Overview

Create the `AddressField.tsx` React component implementing the idle → loading → formatted/error state machine. The component manages its own value state and calls `/api/format-address` on trigger. It renders a standard `<input name="address">` so the parent HTML form picks up the value on submit.

### Changes Required

#### 1. AddressField Component

**File**: `src/components/listings/AddressField.tsx`

**Intent**: Encapsulate the address input with LLM formatting trigger. Accepts an optional `initialValue` prop (for edit form) and an optional `placeholder`. Renders the input, "Formatuj" button, hint text, and error/loading feedback — all styled to match the existing dark-glass input pattern in the form.

**Contract**: 
- Props interface: `{ initialValue?: string; placeholder?: string; id?: string }`
- Internal state: `value: string` (controlled), `status: "idle" | "loading" | "error"`, `errorMessage: string`
- Input element: `<input type="text" id={id} name="address" required value={value} onChange={...} onKeyDown={...} className="...">`  — same Tailwind classes as the current plain input; `id` prop forwarded so the existing `<label for="address">` association is preserved
- `onKeyDown`: if `e.key === "Enter"`, call `e.preventDefault()` then trigger formatting
- "Formatuj" button: `type="button"` (prevents form submission), disabled when `status === "loading"`, shows "Formatuje…" label during loading
- Formatting trigger: wrapped in a `useEffect`-managed `AbortController` with a ~10s client-side deadline — `const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10000);`. Pass `{ signal: controller.signal }` to `fetch("/api/format-address", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw: value }) })`. Clear the timeout and abort the previous controller in the `useEffect` cleanup so concurrent triggers abort the prior request and component unmount during a request does not cause a dangling state update. Parse JSON; on `formatted` update `value`; on `error` or abort set `status: "error"` and `errorMessage`.
- Hint text: small muted text below the input, always visible: "Naciśnij Enter lub kliknij Formatuj, aby sformatować adres do formy kanonicznej."
- Error text: renders below hint when `status === "error"`, Polish message from API response
- Loading state: input and button both show `opacity-50 cursor-not-allowed` or equivalent disabled visual; a text "Formatuje…" label replaces button text
- On new trigger while `status === "error"`: reset error, proceed with formatting

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run typecheck`

#### Manual Verification

- Render the component in isolation (or within edit form): type "Krakowska 1 Kraków", click "Formatuj" — field updates to canonical form
- With network devtools blocking `/api/format-address`: error message appears in Polish, raw text preserved
- After error, edit the text and click "Formatuj" again: previous error clears, loading state appears, new result replaces field
- Pressing Enter in the field triggers formatting (does NOT submit the form)
- "Formatuj" button is visually disabled during loading

**Implementation Note**: Pause for manual confirmation of the component's state machine behavior before proceeding to page integration.

---

## Phase 3: Page Integration — Embed Island in Both Forms

### Overview

Replace the plain `<input>` address fields in `edit.astro` and `new.astro` with `<AddressField client:load />`. The surrounding `<div>` and `<label>` remain unchanged; only the input element is swapped.

### Changes Required

#### 1. Edit Form Integration

**File**: `src/pages/dashboard/listings/[id]/edit.astro`

**Intent**: Replace the static address input (lines 72-79) with the React island so the agent gets LLM formatting when editing an existing listing.

**Contract**: 
- Add import at the top of the frontmatter: `import AddressField from "@/components/listings/AddressField";`
- Remove the `<input id="address" ... />` element (lines 72-79)
- Insert `<AddressField initialValue={listing.address} id="address" client:load />` in its place, inside the existing `<div>` (line 68)
- The `<label for="address">` stays and continues to work — the island forwards `id="address"` to its rendered `<input>`

#### 2. New Listing Form Integration

**File**: `src/pages/dashboard/listings/new.astro`

**Intent**: Replace the static address input (lines 40-47) with the React island so new listing creation also benefits from formatting.

**Contract**:
- Add import at the top of the frontmatter: `import AddressField from "@/components/listings/AddressField";`
- Remove the `<input id="address" ... />` element (lines 40-47)
- Insert `<AddressField placeholder="ul. Przykładowa 1, Warszawa" id="address" client:load />` in its place

### Success Criteria

#### Automated Verification

- Type checking passes: `npm run typecheck`
- Build succeeds: `npm run build`

#### Manual Verification

- Open `/dashboard/listings/[id]/edit`: address field shows current listing address as initial value; "Formatuj" button visible; hint text visible
- Type a partial address, click "Formatuj": field updates to formatted address
- Click "Zapisz zmiany": form submits, database record shows the formatted address
- Open `/dashboard/listings/new`: address field is empty with placeholder; formatting works before submit
- On both forms: pressing Enter in the address field triggers formatting, does NOT submit the form
- Tab navigation (ListingTabs) is unaffected; other form fields save correctly — no regression

**Implementation Note**: Pause for manual E2E confirmation across both forms, including a full save cycle, before marking complete.

---

## Testing Strategy

### Manual Testing Steps

1. Open the edit form for an existing listing. Confirm the address field displays the current value.
2. Clear the field, type "Sarmacka 5/6 Warszawa", click "Formatuj". Confirm the formatted address appears.
3. Click "Zapisz zmiany". Confirm the formatted address is persisted (re-open the edit form to verify).
4. Open the new listing form. Enter a raw address, press Enter. Confirm formatting triggers without form submission.
5. Simulate network failure (devtools → block `/api/format-address`). Confirm inline Polish error, raw text preserved.
6. Re-enable network, edit the raw address, click "Formatuj" again. Confirm error clears and formatting succeeds.
7. Confirm all other form fields (type, owner name, phone, email) still save correctly after the island change.

### Regression Checks

- All five listing tab links (Edit, Pricing, Contacts, Documents, Close) remain functional after `edit.astro` change
- New listing creation form submit flow unchanged (address value passed through formData)
- No console errors from React hydration on page load

## Performance Considerations

OpenRouter Gemini 2.5 Flash typically responds in 1–3s. The 5s AbortController timeout provides a buffer. The loading state disables the input and button to prevent double-calls. No caching of results — each trigger is a live call.

## References

- PRD: `context/foundation/prd.md` (US-02, FR-003, FR-004)
- Roadmap: `context/foundation/roadmap.md` (S-02)
- CLAUDE.md §3 — External LLM calls must go via a server-side API route
- CLAUDE.md §5 — Astro Env Schema for new secret variables
- Existing API route pattern: `src/pages/api/listings/[id]/update.ts`
- ListingTabs (completed S-01): `src/components/listings/ListingTabs.astro`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Infrastructure — Env Schema and API Route

#### Automated

- [x] 1.1 Type checking passes: `npm run typecheck` — 8873f17
- [x] 1.2 Build succeeds: `npm run build` — 8873f17

#### Manual

- [x] 1.3 API route returns canonical formatted address for a test raw address with valid session — 8873f17
- [x] 1.4 API route returns 400 for empty `raw` field — 8873f17
- [x] 1.5 API route returns auth error when called without session — 8873f17

### Phase 2: React Island — AddressField Component

#### Automated

- [x] 2.1 Type checking passes: `npm run typecheck`

#### Manual

- [ ] 2.2 Formatting triggers on "Formatuj" button click and updates field value
- [ ] 2.3 Error state shown on network failure; raw text preserved
- [ ] 2.4 Error clears and formatting retries on re-trigger after error
- [ ] 2.5 Enter key triggers formatting without submitting the parent form
- [ ] 2.6 Button visually disabled during loading state

### Phase 3: Page Integration — Embed Island in Both Forms

#### Automated

- [ ] 3.1 Type checking passes: `npm run typecheck`
- [ ] 3.2 Build succeeds: `npm run build`

#### Manual

- [ ] 3.3 Edit form: initial address value displayed, formatting works, save persists formatted address
- [ ] 3.4 New listing form: formatting works before first submit, address saves correctly
- [ ] 3.5 Enter key does not submit either form
- [ ] 3.6 All other form fields unaffected (no regression)
- [ ] 3.7 ListingTabs navigation unaffected on edit page
