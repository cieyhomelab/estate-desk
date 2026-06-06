<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Home Page Redesign Implementation Plan

- **Plan**: context/changes/home-page-redesign/plan.md
- **Mode**: Deep
- **Date**: 2026-06-06
- **Verdict**: SOUND
- **Findings**: 0 critical  1 warning  1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | WARNING |

## Grounding

6/6 paths ✓, 3/3 symbols ✓ (Topbar at Welcome.astro:28, title default at Layout.astro:10, bg-cosmic in global.css:113), brief↔plan ✓

## Findings

### F1 — Content wrapper contract missing `relative z-10`

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 — Welcome component rewrite, Contract section
- **Detail**: The plan's contract for the main content wrapper specifies `flex flex-col md:flex-row items-center justify-center min-h-screen gap-12 px-8 py-16` but omits `relative z-10`. The existing code at Welcome.astro:27 uses `relative z-10 p-4 sm:p-8` on the content div because the cosmic orbs and star field (lines 5–25) are all `position: absolute`. In CSS stacking order, absolutely-positioned siblings paint on top of in-flow elements in the same stacking context. Without `relative z-10`, the star field div (`absolute inset-0`, lines 22–25) would paint over the two-column content, covering it with the white-dot pattern.
- **Fix**: Prepend `relative z-10` to the content wrapper class list in the contract: `relative z-10 flex flex-col md:flex-row items-center justify-center min-h-screen gap-12 px-8 py-16`
- **Decision**: FIXED — prepended `relative z-10` to content wrapper class list in contract

### F2 — Raw `<img>` for an 891 KB above-the-fold logo

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Left column spec
- **Detail**: Plan specifies `<img src="/estatedesk.png" alt="EstateDesk" class="h-16 w-auto mb-6">` — a raw HTML img tag pointing at an 891 KB PNG in /public. `h-16` constrains height so layout shift is minimal, but the file is unoptimized. Astro's `<Image>` component (from `astro:assets`) would auto-convert to WebP and reduce the payload significantly. Not blocking for the redesign goal, but the home page is the one page every visitor hits first.
- **Fix**: Replace with Astro's Image component: `<Image src="/estatedesk.png" alt="EstateDesk" width={64} height={64} class="h-16 w-auto mb-6" />` — or at minimum add explicit `width`/`height` attributes on the raw img tag so the browser can reserve space before load.
- **Decision**: FIXED — updated contract to use Astro `<Image>` component with explicit width/height for WebP conversion
