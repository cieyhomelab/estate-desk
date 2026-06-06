# LLM-Powered Polish Address Formatting — Plan Brief

> Full plan: `context/changes/address-formatting-llm/plan.md`

## What & Why

Add one-keypress Polish address formatting to the listing edit and new listing forms. The agent types a raw address (e.g. "Sarmacka 5/6 Warszawa"), presses Enter or clicks "Formatuj", and the field is replaced with the canonical form ("ul. Sarmacka 5/6, 02-972 Warszawa (Wilanów)") via OpenRouter Gemini 2.5 Flash. This eliminates the daily manual formatting friction identified in the PRD — every new listing requires a correctly formatted canonical address, which the agent currently types by hand.

## Starting Point

Both `edit.astro` (line 72) and `new.astro` (line 40) use a plain `<input type="text" name="address">` with no interactivity; neither form has any React islands today. `OPENROUTER_API_KEY` exists in `.env` but is not declared in `astro.config.mjs`, making it inaccessible at runtime. No LLM integration exists anywhere in the codebase.

## Desired End State

The address field on both forms is a React island (`AddressField.tsx`) showing a text input and a "Formatuj" button. The agent enters a raw address, triggers formatting, and sees the canonical result in the field — still editable before saving. On failure (network error, timeout, OpenRouter error) the raw text is preserved and a Polish-language inline error guides the agent to retry by re-triggering. The form's save behavior is unchanged — the island renders `<input name="address">` so `formData()` picks it up naturally.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| LLM model | `google/gemini-2.5-flash` | User-specified; fast, accurate for Polish structured output | Plan |
| Trigger mechanism | Enter key + inline "Formatuj" button | Enter covers desktop power users; button covers mobile where Enter may not fire reliably | Plan |
| Timeout | 5s AbortController | Slight buffer over the ≤3s PRD NFR to avoid false timeouts on Gemini cold starts | Plan |
| Error retry | Edit field and re-trigger | No separate retry button — the trigger itself is the retry; most errors benefit from correcting the input first | Plan |
| Hint text | Show below field in Polish | Discoverability — agent needs to know the feature exists on first use | Plan |
| Form integration | React controlled `<input name="address">` | Feeds parent `formData()` without hidden inputs; no changes to API routes needed | Plan |
| API route response style | JSON (fetch-style) | Island calls it via `fetch()`, not HTML form POST; per CLAUDE.md §2 convention | Plan |

## Scope

**In scope:**
- `astro.config.mjs` — add `OPENROUTER_API_KEY` to env schema
- `src/pages/api/format-address.ts` — new POST route, JSON response, 5s timeout, auth-gated
- `src/components/listings/AddressField.tsx` — new React island
- `edit.astro` — replace plain `<input>` with island
- `new.astro` — replace plain `<input>` with island

**Out of scope:**
- Address validation against postal code database
- Offline/fallback formatting
- Formatting on the new listing form tab bar (tabs not added there per PRD)
- Streaming LLM response

## Architecture / Approach

The API route is a thin proxy: it auth-checks via Supabase, reads `raw` from the JSON body, calls OpenRouter with a Polish-formatting system prompt, and returns `{ formatted }` or `{ error }`. The React island manages state locally (idle → loading → formatted/error) and calls the local route via `fetch()`. The island is embedded inside the existing Astro HTML forms; the parent form submit is unaffected because the island renders a native `<input name="address">` in the DOM.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Infrastructure | `OPENROUTER_API_KEY` in env schema; `/api/format-address` POST route | OpenRouter model ID may differ from expected — verify with a live call |
| 2. React Island | `AddressField.tsx` with full state machine | Enter-key / form-submit interaction must be carefully tested |
| 3. Page Integration | Both forms use the island; end-to-end save verified | Hydration issue or `name="address"` not picked up by formData |

**Prerequisites:** S-01 `listing-tab-navigation` is done (confirmed). `OPENROUTER_API_KEY` must be added to Cloudflare Workers secrets and GitHub Actions env for production (user's responsibility — not a code change).

**Estimated effort:** ~1 session across 3 short phases.

## Open Risks & Assumptions

- `google/gemini-2.5-flash` model ID on OpenRouter must be confirmed — the API returns a 404 if the ID is wrong. Verify in Phase 1 manual testing.
- `OPENROUTER_API_KEY` must be set as a Cloudflare Workers secret (`wrangler secret put OPENROUTER_API_KEY`) and in GitHub Actions secrets for production use. This is an ops step outside the code change.
- React hydration on `client:load` adds a brief flash before the island is interactive on edit page load — acceptable per PRD (SSR-first).

## Success Criteria (Summary)

- Agent types a raw Polish address, clicks "Formatuj", and sees the canonical form without leaving the page
- On OpenRouter failure, the raw text is preserved and a Polish error message appears inline
- Formatted address is saved to the database on form submit — existing save behavior unchanged
