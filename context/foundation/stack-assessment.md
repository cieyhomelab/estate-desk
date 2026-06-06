---
project: EstateDesk
assessed_at: 2026-06-05
agent_readiness: ready
context_type: brownfield
stack_components:
  language: TypeScript 6
  framework: Astro 6 + React 19
  build_tool: Vite (via Astro)
  test_runner: Vitest (unit + integration), Playwright (E2E)
  package_manager: npm
  ci_provider: GitHub Actions
  deployment_target: Cloudflare Workers
gates_passed: 4
gates_failed: 0
---

## Stack Components

**Language — TypeScript 6** (`"typescript": "^6.0.3"`). Configured via `tsconfig.json` which extends `astro/tsconfigs/strict` — the strictest preset Astro ships, enabling `strict: true`, `noImplicitAny`, `strictNullChecks`, and related checks. ESLint is wired with `typescript-eslint` for type-aware lint rules. Pre-commit hooks (`lefthook` + `lint-staged`) run ESLint on every `.ts`, `.tsx`, and `.astro` file before commit.

**Framework — Astro 6 with React 19** (`"astro": "^6.3.1"`, `"react": "^19.2.6"`). Server-side rendering (`output: "server"`) with the Cloudflare Workers adapter. React islands are used for interactive components (e.g., client-rendered components get a `client:*` directive). File-based routing in `src/pages/`; API routes in `src/pages/api/`; layouts in `src/layouts/`; components in `src/components/`. Sentry integration for error tracking.

**Build tool — Vite** (embedded in Astro, `@tailwindcss/vite` for Tailwind CSS v4 processing). Tailwind CSS v4 — a significant API change from v3; config is CSS-based rather than `tailwind.config.js`.

**Test runners — Vitest + Playwright**. Vitest handles unit tests (`src/**/*.test.ts`, node environment) and two integration test suites (`vitest.integration.config.ts`, `vitest.integration.api.config.ts`). Playwright handles E2E tests (`playwright.config.ts`). All three suites run in CI before deployment.

**Package manager — npm** (`package-lock.json`). Node.js 22 in CI.

**CI/CD — GitHub Actions** (`.github/workflows/ci.yml`). Three jobs: `ci` (lint + type-check + unit + integration + E2E + build), `deploy` (build + wrangler deploy to Cloudflare Workers, only on `main` push), `migrate` (Supabase DB push, runs after deploy).

**Deployment — Cloudflare Workers** via `@astrojs/cloudflare` adapter and `cloudflare/wrangler-action@v4` in CI. Environment variables for Supabase credentials are stored as GitHub secrets.

## Quality Gate Assessment

| Component | Typed | Convention | Training Data | Documented | Verdict |
|---|---|---|---|---|---|
| Language (TypeScript 6) | ✓ | — | — | — | pass |
| Framework (Astro 6 + React 19) | — | ✓ | ✓ | ✓ | pass |
| Build tool (Vite/Astro) | — | ✓ | ✓ | ✓ | pass |
| Test runners (Vitest + Playwright) | — | — | ✓ | ✓ | pass |

**Legend**: ✓ = pass, — = not applicable to this gate

### Gate Details

**Typed — PASS**
Evidence: `tsconfig.json` extends `astro/tsconfigs/strict`; TypeScript 6.0.3 is in devDependencies; `typescript-eslint` is configured for type-aware linting; lint-staged runs ESLint on all `.ts`, `.tsx`, `.astro` files before every commit. The entire source is TypeScript — no plain `.js` source files in `src/`.

**Convention-based — PASS**
Evidence: Astro 6 uses file-based routing (`src/pages/**/*.astro` → route). The project follows Astro's standard layout: pages in `src/pages/`, reusable components in `src/components/`, layouts in `src/layouts/`, library/utility code in `src/lib/`, types in `src/types/`, API routes in `src/pages/api/`. The `[id]` dynamic segment pattern is used correctly for listing sub-pages. Routing, rendering model, and component placement are all predictable from Astro's conventions.

⚠️ **Note** (not a gate failure): The `CLAUDE.md` file is present but contains only the 10xDevs toolkit lesson scaffold — there are no EstateDesk-specific coding conventions documented. An agent working on this codebase has Astro's framework conventions to lean on, but no project-level guidance on patterns specific to EstateDesk (API route shape, Supabase auth check pattern, how to add a React island for client-side interactivity). See "Recommended Instruction File Additions" below.

**Popular in training data (within JS/TS ecosystem) — PASS**
Evidence: Astro is well-established in the JS/TS ecosystem (2021, strong adoption). React + TypeScript is one of the most heavily represented combinations in LLM training corpora. The API route pattern (`export const POST = async ({request}) => ...`) and Astro island pattern (`client:load`) are standard and widely documented. 

⚠️ **Caveat**: Astro 6 and Tailwind CSS v4 are very recent releases. Some of their latest-version APIs (e.g., Tailwind v4's CSS-variable-based configuration, Astro 6's env schema, React 19 Server Components patterns with Astro) may have limited training data coverage compared to their v3/v4 predecessors. Agents may occasionally default to v3-era patterns — the instruction file additions below help guard against this.

**Well-documented — PASS**
Evidence: Astro maintains versioned documentation at docs.astro.build with migration guides. React 19, TypeScript 6, Tailwind CSS v4, Cloudflare Workers, and Supabase all have current official documentation. The `@astrojs/cloudflare` adapter is documented at docs.astro.build/en/guides/deploy/cloudflare/.

## Gaps & Compensation

All four quality gates pass. No mandatory compensation is required. However, three practical gaps exist that will cause the agent to produce lower-quality first-pass code without guidance:

### Gap 1: CLAUDE.md has no EstateDesk-specific conventions

**Why it matters for agents**: The existing CLAUDE.md contains only the 10xDevs toolkit lesson scaffold — no coding conventions, no pattern guidance, no project-specific rules. An agent asked to add a new feature in this codebase will rely solely on Astro's general conventions, which are correct for structure but say nothing about EstateDesk-specific patterns (how auth is checked in pages, how API routes are shaped, which Supabase client to use and when).

**Impact on current PRD changes**: Three of the four changes in scope (tab navigation, LLM address formatting, home page) require patterns not yet documented anywhere — the React island pattern for client-side interactivity, the API route shape for a new endpoint, and the Tailwind v4 class approach.

### Gap 2: No documented pattern for client-side React islands

**Why it matters**: The address formatting feature (LLM call on Enter) requires a React component with `client:load` or `client:only` directive. The current codebase has no interactive React components that demonstrate this pattern. An agent will likely produce a correct component, but may get the hydration directive wrong or not know where to put the component.

### Gap 3: Tailwind CSS v4 API differences

**Why it matters**: Tailwind v4 replaced `tailwind.config.js` with CSS-based configuration and changed some utility names and patterns. Training data is predominantly v3-era. An agent may generate v3-style config entries or reference non-existent v4 class names.

### Recommended Instruction File Additions

The following sections should be added to `CLAUDE.md` (below the existing toolkit content, in a new `## EstateDesk Coding Conventions` block):

---

```markdown
## EstateDesk Coding Conventions

### Language & types
- All source files are TypeScript. Never write `.js` files in `src/`. All function parameters and return types must be annotated.
- Type definitions for domain entities live in `src/types/`. Import from there rather than defining inline types in pages.

### Astro page pattern
Every protected page follows this shape:
1. Import `createClient` from `@/lib/supabase`
2. Call `supabase.auth.getUser()` — redirect to `/auth/signin` if no user
3. Fetch data needed for the page
4. Redirect to `/dashboard` on fetch errors

Example from `src/pages/dashboard/listings/[id]/edit.astro`:
```astro
const supabase = createClient(Astro.request.headers, Astro.cookies);
const { data: { user } } = await supabase.auth.getUser();
if (!user) return Astro.redirect("/auth/signin");
```

### API route pattern
API routes live in `src/pages/api/`. They export named handlers (`GET`, `POST`, `PUT`, `DELETE`). Each handler:
- Calls `createClient` and `getUser()` — returns `401` if no session
- Parses the request body or params
- Performs the Supabase operation
- Returns a `Response` with appropriate status code and JSON body

### React island pattern (client-side interactivity)
Interactive React components live in `src/components/`. To add client-side interactivity to an Astro page, import the React component and add a `client:load` directive:
```astro
import MyComponent from "@/components/MyComponent";
<MyComponent client:load prop={value} />
```
Use `client:load` for components that must hydrate immediately (e.g., form inputs with interactive behavior). Use `client:only="react"` for components that should NOT render server-side.

### LLM / external API calls from client components
API calls to external services (e.g., LLM address formatting) must go through a server-side Astro API route in `src/pages/api/`, never directly from a client-side React component. The React component calls the internal API route; the API route holds the secret key and calls the external service.

Pattern:
- `src/pages/api/format-address.ts` — server-side handler, reads `OPENROUTER_API_KEY` from env
- Client-side React component calls `fetch("/api/format-address", { method: "POST", body: ... })`

### Environment variables
- Server-side secrets are accessed via `import.meta.env.VARIABLE_NAME`
- All env variables used by the app are declared in `astro.config.mjs` under `env.schema`
- Never access env vars directly in client-rendered React components (they'd be exposed to the browser)

### Tailwind CSS v4
This project uses Tailwind CSS v4. Key differences from v3:
- No `tailwind.config.js` — configuration lives in CSS (see `src/styles/global.css` or similar)
- Use `@theme` directive for custom tokens, not `theme.extend` in a config file
- The `bg-cosmic` class is a custom class defined in the project's CSS
- When adding new components, use existing classes from other pages as reference before inventing new ones
```

---

## Summary

**Overall agent-readiness: ready.** All four quality gates pass for every stack component. TypeScript strict mode, Astro's file-based conventions, React + TypeScript training-data depth, and comprehensive docs for every dependency give an agent a strong foundation.

**Key strengths:**
- Strict TypeScript throughout — agents can reason about types without running the code
- Astro's file-based routing makes page and API route placement predictable
- Three-tier test suite (unit, integration, E2E) in CI provides a fast feedback loop
- CI/CD pipeline is complete end-to-end: lint → type-check → tests → build → deploy → migrate

**Practical enhancements before implementing the PRD changes:**
1. Add the `## EstateDesk Coding Conventions` block to `CLAUDE.md` (see above) — especially the React island pattern and the LLM-call-via-API-route pattern, which are new in the current scope.
2. Note Tailwind v4 differences in CLAUDE.md to prevent v3-era pattern drift.

**Scope of current PRD:**
The four changes in scope (tab navigation, consistent back link, LLM address formatting, home page redesign) are all within Astro's normal feature surface. The tab/back link work is pure Astro template and routing — straightforward. The address formatting feature is the only novel pattern: it requires a new API route and a React island component calling it. The CLAUDE.md additions above directly address this.
