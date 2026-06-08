<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Dashboard Filters

- **Plan**: context/changes/dashboard-filters/plan.md
- **Scope**: All Phases (1–3 of 3)
- **Date**: 2026-06-08
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical  2 warnings  3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — parseInt silently returns NaN on non-numeric price input

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/DashboardListings.tsx:33–34
- **Detail**: Price filter predicates use `parseInt(filters.priceMin)` and `parseInt(filters.priceMax)`. When given a non-numeric string (clipboard paste: "1,000,000", "500k", etc.), parseInt returns NaN. All comparisons with NaN return false, so the filter silently passes all listings — no filtering happens, no error shown. The inputs are type="number" but browsers allow non-numeric clipboard paste in some environments.
- **Fix**: Guard with isNaN before comparing:
  ```ts
  const min = filters.priceMin !== "" ? Number(filters.priceMin) : null;
  const max = filters.priceMax !== "" ? Number(filters.priceMax) : null;
  if (min !== null && !isNaN(min) && (listing.asking_price ?? 0) < min) return false;
  if (max !== null && !isNaN(max) && (listing.asking_price ?? 0) > max) return false;
  ```
  - Strength: Eliminates the silent-pass bug; `Number()` + isNaN is the idiomatic approach for filter inputs.
  - Tradeoff: Two extra variables; trivially scoped.
  - Confidence: HIGH — NaN behavior is deterministic.
  - Blind spot: None significant.
- **Decision**: FIXED

### F2 — listing.address null crash in city filter

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/DashboardListings.tsx:35
- **Detail**: `listing.address.toLowerCase()` throws TypeError if any row has address: null at runtime. The Listing type declares address as string (non-nullable) but this is an overrideTypes cast over a raw Supabase query — the DB column may not enforce NOT NULL uniformly (legacy rows, migration gaps). One null row would crash the entire filter, wiping the listing grid silently.
- **Fix**: Apply a null-guard:
  ```ts
  if (
    filters.city !== "" &&
    !(listing.address ?? "").toLowerCase().includes(filters.city.toLowerCase())
  ) return false;
  ```
  Also updated `src/types/listings.ts` to `address: string | null` to reflect DB reality.
  - Strength: One-character diff; eliminates the crash class entirely. Pattern matches the `?? 0` guard already used in the price predicates on the same lines.
  - Tradeoff: None.
  - Confidence: HIGH.
  - Blind spot: None significant.
- **Decision**: FIXED (type corrected to `string | null` in listings.ts; null-guard applied in filter)

### F3 — Plan drift: Eksport button missing explicit onClick={() => {}}

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/dashboard/DashboardListings.tsx:67–73
- **Detail**: The plan specified `<button type="button" onClick={() => {}} ...>` as a named placeholder contract so S-02 would know exactly where to add the handler. The implementation has `<button type="button" ...>` with the prop omitted. Functionally identical (a button without a handler is a no-op), but the explicit prop was the load-bearing signal for the S-02 handoff comment.
- **Fix**: Add `onClick={() => {}}` to the Eksport button element.
- **Decision**: SKIPPED — `@typescript-eslint/no-empty-function` lint rule prevents empty arrow functions; button without onClick is functionally identical.

### F4 — null asking_price coerced to 0 skews Cena do results

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/components/dashboard/DashboardListings.tsx:33–34
- **Detail**: Price filters use `(listing.asking_price ?? 0)`. A listing with no asking_price is treated as if priced at 0 PLN. With Cena od filter: correctly excluded (0 < min). With Cena do filter: incorrectly included (0 ≤ max). A "priced under 800,000" filter will show null-priced listings — these are not "cheap", they are simply unpriced.
- **Fix A ⭐ Recommended**: Exclude null-priced listings when any price filter is active:
  ```ts
  if (min !== null || max !== null) {
    if (listing.asking_price === null) return false;
    if (min !== null && !isNaN(min) && listing.asking_price < min) return false;
    if (max !== null && !isNaN(max) && listing.asking_price > max) return false;
  }
  ```
  - Strength: Prevents conceptually wrong inclusions. Most consistent with how a user would reason about a price filter.
  - Tradeoff: Null-priced listings disappear from filtered view — potentially surprising if the user has listings with no price set yet.
  - Confidence: MED — depends on how common null-priced listings are in production.
  - Blind spot: How many current listings have null asking_price?
- **Fix B**: Keep coerce-to-0 but document the behavior.
  - Strength: Zero code change; null-priced listings stay visible.
  - Tradeoff: Counter-intuitive — "under 100k" includes unpriced listings.
  - Confidence: LOW — likely to confuse users who set price filters.
  - Blind spot: None.
- **Decision**: FIXED via Fix A

### F5 — Snapshot limit(100) is independent of listing limit

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/dashboard.astro:39
- **Detail**: Pre-existing: the snapshot query uses `.limit(100)` as a separate hard-coded constant from the listing query's `.limit(100)`. Not introduced by this change, but now that snapshotMap is passed into a React island, any drift between these two limits would cause ListingCard components to silently show "—" for agent net on done listings beyond the snapshot window.
- **Fix**: Extract a shared constant (e.g. `const LISTING_LIMIT = 100`) used in both queries, or use `.limit(doneIds.length)` for the snapshot query since doneIds is already bounded.
- **Decision**: FIXED — snapshot query now uses `.limit(doneIds.length)`
