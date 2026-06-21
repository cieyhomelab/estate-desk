# Repository Guidelines

EstateDesk — real estate transaction management for a single Polish agent. Astro 6 SSR + React 19 + TypeScript + Tailwind CSS 4 + Supabase (PostgreSQL + auth + storage) + Cloudflare Workers.

## Hard Rules

- `SUPABASE_URL` and `SUPABASE_KEY` are server-side secrets enforced via `astro:env/server`. Never reference them in React island components — they are absent from the browser bundle.
- Do not import `src/lib/supabase.ts` or `src/middleware.ts` into React island components; both are server-only and will fail at the Cloudflare edge runtime.
- Never commit `.env` or `.dev.vars`. Copy `.env.example` → `.env` and fill locally.
- `context/` holds 10xWorkflow docs (PRD, tech-stack, change history) — do not modify files there outside their owning workflow skills.

## Project Structure

`src/pages/` — route-mapped Astro pages. `src/components/` — Astro and React components; `auth/` for login/signup form islands, `ui/` for shared primitives. `src/layouts/` — Astro layouts. `src/lib/` — server utilities: `supabase.ts` (Supabase client factory), `utils.ts`, `config-status.ts`. `src/styles/` — global CSS. `supabase/` — local Supabase CLI config, migrations, seeds. CI: `@.github/workflows/ci.yml`.

## Build, Test, and Development Commands

- `npm run dev` — local dev server
- `npm run build` — production build (requires `SUPABASE_URL` and `SUPABASE_KEY` in env)
- `npm run lint` — ESLint; must pass in CI before merge
- `npm run lint:fix` — auto-fix ESLint issues
- `npm run format` — Prettier across all files

CI gate on push/PR to `main`: `npm ci → npm audit → astro sync → astro check → lint → unit tests → integration tests (×2) → E2E tests → build`.

## Coding Style & Naming Conventions

TypeScript strict (`@tsconfig.json` extends `astro/tsconfigs/strict`). Import alias `@/*` resolves to `src/*`. Pages/layouts: `PascalCase.astro`. React island components: `PascalCase.tsx`. Utilities: `camelCase.ts`. ESLint 9 with `eslint-plugin-astro`, `react-compiler`, `jsx-a11y`; Prettier with `prettier-plugin-astro` and `prettier-plugin-tailwindcss`. lefthook runs on commit (parallel jobs): ESLint with auto-fix on staged `.ts/.tsx/.astro` files, `astro check` type-check, and `npm run test` unit suite.

## Testing Guidelines

Unit tests: Vitest (`npm run test`) — `src/**/*.test.ts`, node environment, excludes integration.
Integration tests: Vitest with real Supabase (`npm run test:integration`, `npm run test:integration:api`).
E2E tests: Playwright (`npm run test:e2e`) — specs in `e2e/`, Chromium, runs against local dev server (port 4321).
All three suites run in CI on every push/PR to `main`. Supabase secrets are required for integration and
E2E runs and are provided via GitHub Actions secrets (see `.github/workflows/ci.yml`).

## Commit & Pull Request Guidelines

CI runs on `main` (`@.github/workflows/ci.yml`). Set `SUPABASE_URL`, `SUPABASE_KEY`, and the three `*_TEST` Supabase secrets in GitHub Actions secrets or integration and E2E jobs will fail.

## Security & Configuration

Set Cloudflare account and project details in `wrangler.jsonc` before first deploy. Use `npx wrangler secret put` to push secrets to Cloudflare, not `wrangler.jsonc` directly.
