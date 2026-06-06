<!-- PLAN-REVIEW-REPORT -->
# Plan Review: LLM-Powered Polish Address Formatting

- **Plan**: context/changes/address-formatting-llm/plan.md
- **Mode**: Deep
- **Date**: 2026-06-06
- **Verdict**: REVISE
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | WARNING |
| Plan Completeness | WARNING |

## Grounding

5/5 paths ✓ (edit.astro at [id]/edit.astro verified lines 72-79, new.astro verified lines 40-47, astro.config.mjs env schema ✓, api/listings/ ✓, components/listings/ ✓), 3/3 symbols ✓ (envField pattern ✓, form action lines ✓, redirect-style update.ts ✓), brief↔plan ✓

## Findings

### F1 — No client-side fetch timeout — loading state can lock indefinitely

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2 — AddressField Component contract
- **Detail**: The API route has a 5s AbortController deadline on the OpenRouter call, but AddressField.tsx's `fetch("/api/format-address", ...)` has no timeout. The 5s gate only fires after the browser-to-CF-Worker TCP connection is established. If the edge routing hangs before the route code runs (cold start, CF incident, network partition), the component's loading state locks with no recovery: the button stays disabled and the user cannot cancel or retry without a hard refresh.
- **Fix**: Add a client-side AbortController with ~10s deadline to the fetch call in AddressField's formatting trigger. Clean it up in a useEffect return so concurrent triggers abort the previous one.
  - Strength: Guarantees recovery within 10s regardless of server-side behavior; also prevents race conditions on double-trigger.
  - Tradeoff: Tiny extra code (~5 lines); negligible.
  - Confidence: HIGH — standard pattern for fetch-with-timeout in React islands.
  - Blind spot: None significant.
- **Decision**: FIXED

### F2 — No AbortController cleanup on component unmount

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 — AddressField Component contract
- **Detail**: The plan's component contract shows a bare `fetch(...)` call in the formatting trigger with no mention of cleanup when the component unmounts mid-request. If the user navigates away (e.g., clicks a ListingTabs link) while a request is in flight, the in-flight fetch completes and attempts to call setState on an unmounted component. React 18 silently discards the setState, but the request wastes a full Gemini call.
- **Fix**: The recommended fix in F1 (AbortController via useEffect cleanup) covers this too — if F1 is fixed, F2 is resolved as a side effect.
- **Decision**: FIXED

### F3 — Phase 3 label/id association decision left unresolved

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 — Edit Form Integration contract
- **Detail**: Both forms today have `<label for="address">` linked to `<input id="address">`. Phase 3 removes the input and inserts `<AddressField ... />`, but the contract says: "The island renders `<input id` is not needed (the label links by context, not id — or optionally pass `id="address"` as a prop if desired for label association)." This is contradictory. Without `id="address"` on the island's rendered input, clicking the label no longer focuses the field — an accessibility and UX regression.
- **Fix**: Resolve the decision in the Phase 3 contract: add `id?: string` to AddressField's props interface and pass `id="address"` at both call sites.
- **Decision**: FIXED

### F4 — `config-status.ts` cited as 503-pattern precedent but contains no HTTP logic

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Critical Implementation Details — 3rd bullet
- **Detail**: The plan says the API route should return 503 "matching the graceful-degradation pattern of `src/lib/config-status.ts`." That file exports a `configStatuses` array and `missingConfigs` filter — pure data, zero HTTP response logic. The 503 behavior is net-new with no existing template to copy from. The 503 contract itself is fully specified in the API Route section; this is a bad pointer, not a missing spec.
- **Fix**: Remove the `config-status.ts` reference from that bullet. The 503 contract in the API Route section is self-contained and sufficient.
- **Decision**: FIXED
