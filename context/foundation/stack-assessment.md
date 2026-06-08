---
project: EstateDesk
assessed_at: 2026-06-08T00:00:00Z
agent_readiness: ready
context_type: brownfield
stack_components:
  language: TypeScript 6.0.3
  framework: Astro 6.x + React 19 islands
  css: Tailwind CSS v4 (Vite plugin)
  build_tool: Vite (embedded in Astro)
  test_runner: Vitest (unit + integration), Playwright (E2E)
  package_manager: npm
  ci_provider: GitHub Actions
  deployment_target: Cloudflare Workers
gates_passed: 4
gates_failed: 0
---

## Stack Components

**Language — TypeScript 6.0.3.** `tsconfig.json` extends `astro/tsconfigs/strict`, enabling `strict: true`, `strictNullChecks`, `noImplicitAny`, and the full strict suite. All source files are `.ts`, `.tsx`, or `.astro` — no plain `.js` source files in `src/`. `typescript-eslint` provides type-aware lint rules. `lefthook` + `lint-staged` run ESLint on every `.ts`, `.tsx`, and `.astro` file before commit.

**Framework — Astro 6.x with React 19 islands.** SSR output (`output: "server"`) via `@astrojs/cloudflare`. File-based routing in `src/pages/`; API routes in `src/pages/api/`; layouts in `src/layouts/`; components in `src/components/`. React islands use `client:load` or `client:only="react"` directives per `CLAUDE.md §4`. Sentry is wired for error tracking (`sentry.client.config.ts`, `sentry.server.config.ts`).

**CSS — Tailwind CSS v4.** Loaded via `@tailwindcss/vite` — no `tailwind.config.js`. Theme tokens and custom utilities live in `src/styles/global.css` under `@theme inline {}`. Convention is documented in `CLAUDE.md §5`.

**Build tool — Vite** (embedded in Astro). CSS processing via `@tailwindcss/vite`; no standalone `vite.config.ts` — configuration flows through `astro.config.mjs`.

**Test runners — Vitest + Playwright.** Vitest handles unit tests (`src/**/*.test.ts`, node environment) and two integration suites (`vitest.integration.config.ts`, `vitest.integration.api.config.ts`). Playwright handles E2E specs in `e2e/` against Chromium. All three suites run in CI before deployment.

**Package manager — npm** (`package-lock.json`, Node.js 22 in CI).

**CI/CD — GitHub Actions** (`.github/workflows/ci.yml`). Three jobs in sequence: `ci` (audit → astro sync → astro check → lint → unit tests → integration tests → E2E → build), `deploy` (build + `wrangler-action` to Cloudflare Workers, `main` push only), `migrate` (Supabase `db push`, runs after deploy).

**Deployment — Cloudflare Workers.** `wrangler.jsonc` + `@astrojs/cloudflare` adapter + `cloudflare/wrangler-action@v4` in CI. Secrets are managed via `npx wrangler secret put` and must be declared in `env.schema` in `astro.config.mjs` or they are silently `undefined` at the Cloudflare edge (documented in `CLAUDE.md §6`).

**Instruction files — `CLAUDE.md` and `AGENTS.md`.** Both present and substantive. `CLAUDE.md` covers env schema, API route shape, LLM call routing, React hydration modes, Tailwind v4 conventions, and known failure modes. `AGENTS.md` covers hard rules, project structure, build/test commands, coding style, and commit guidelines.

## Quality Gate Assessment

| Component                          | Typed | Convention | Training Data | Documented | Verdict |
|------------------------------------|-------|------------|---------------|------------|---------|
| Language (TypeScript 6.0.3)        | ✓     | —          | —             | —          | pass    |
| Framework (Astro 6 + React 19)     | —     | ✓          | ✓             | ✓          | pass    |
| Build tool (Vite via Astro)        | —     | ✓          | ✓             | ✓          | pass    |
| Test runners (Vitest + Playwright) | —     | —          | ✓             | ✓          | pass    |

*Legend: ✓ = pass, — = not applicable to this gate*

### Gate Details

**Typed — pass**
Evidence: `tsconfig.json` extends `astro/tsconfigs/strict`. `typescript-eslint` in `eslint.config.js` enables type-aware linting. `lint-staged` enforces ESLint on all `.ts/.tsx/.astro` files pre-commit. No `.js` source files exist in `src/`. TypeScript 6.0.3 is in devDependencies.

**Convention-based — pass**
Evidence: Astro enforces file-based routing (`src/pages/**/*.astro` → URL path), a layout abstraction (`src/layouts/`), and first-class API route placement (`src/pages/api/`). The project extends these with documented conventions in `AGENTS.md §Project Structure` (folder roles) and `CLAUDE.md §2–§4` (API route shape, React hydration). Convention coverage is strong at both the framework and project layer.

**Popular in training data — pass**
Evidence (within JS/TS ecosystem): Astro is well-established (2021 launch, strong public adoption). React + TypeScript is one of the most heavily represented framework combinations in LLM training data. Vitest is the standard test runner for Vite-based projects. Playwright is a first-class E2E tool with broad documentation and examples in training corpora. Caveat: Astro 6 and Tailwind CSS v4 are recent releases; agents may occasionally default to v4/v3-era patterns for these specific versions — `CLAUDE.md §5` directly addresses the Tailwind v4 distinction.

**Well-documented — pass**
Evidence: Astro maintains versioned docs at docs.astro.build with dedicated guides for the Cloudflare adapter. React 19, TypeScript, Vitest, Playwright, Tailwind CSS v4, Supabase, and Cloudflare Workers all have current, actively maintained official documentation. No dependency in the stack relies on community wikis or out-of-sync third-party sources.

## Gaps & Compensation

All four quality gates pass. No mandatory compensation is required.

### Maintenance Note — `AGENTS.md` has two stale statements

`AGENTS.md` contains outdated content that would mislead an agent reading it cold:

1. **`## Testing Guidelines`** states *"No test framework configured. CI gate is lint + build only. Add Vitest before writing unit tests."* — Vitest and Playwright are both configured, the scripts exist in `package.json`, and all three test suites run in CI. This entry predates the test setup.

2. **Header paragraph** refers to *"Cloudflare Pages"* — the actual deployment target is Cloudflare Workers (`wrangler.jsonc`, `@astrojs/cloudflare` adapter, `wrangler-action` in CI).

**Recommended fix — replace `## Testing Guidelines` in `AGENTS.md` with:**

```markdown
## Testing Guidelines

Unit tests: Vitest (`npm run test`) — `src/**/*.test.ts`, node environment, excludes integration.
Integration tests: Vitest with real Supabase (`npm run test:integration`, `npm run test:integration:api`).
E2E tests: Playwright (`npm run test:e2e`) — specs in `e2e/`, Chromium, runs against local dev server (port 4321).
All three suites run in CI on every push/PR to `main`. Supabase secrets are required for integration and
E2E runs and are provided via GitHub Actions secrets (see `.github/workflows/ci.yml`).
```

Also update the header paragraph: replace `Cloudflare Pages` → `Cloudflare Workers`.

## Summary

**Overall agent-readiness: ready.** All four quality gates pass for every stack component. Strict TypeScript, Astro's file-based conventions, React + TypeScript training-data depth, and comprehensive official documentation for every dependency give an agent a strong, self-consistent foundation.

**Key strengths:**
- Strict TypeScript throughout — agents can reason about types without running the code
- Astro's file-based routing makes page and API route placement predictable
- Three-tier test suite (unit, integration, E2E) in CI provides a fast feedback loop
- `CLAUDE.md` and `AGENTS.md` are both substantive and in sync with the actual codebase
- Full CI/CD pipeline: lint → type-check → tests → build → deploy → migrate

**One action before implementation work:**
Update the two stale statements in `AGENTS.md` (testing guidelines and deployment platform label) so any agent reading it gets an accurate picture of the test setup.

**Recommended next step:** `/10x-health-check`
