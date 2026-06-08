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

CI gate on push/PR to `master`: `npm ci → npx astro sync → npm run lint → npm run build`.

## Coding Style & Naming Conventions

TypeScript strict (`@tsconfig.json` extends `astro/tsconfigs/strict`). Import alias `@/*` resolves to `src/*`. Pages/layouts: `PascalCase.astro`. React island components: `PascalCase.tsx`. Utilities: `camelCase.ts`. ESLint 9 with `eslint-plugin-astro`, `react-compiler`, `jsx-a11y`; Prettier with `prettier-plugin-astro` and `prettier-plugin-tailwindcss`. Husky runs lint-staged on commit: ESLint on `.ts/.tsx/.astro`, Prettier on `.json/.css/.md`.

## Testing Guidelines

Unit tests: Vitest (`npm run test`) — `src/**/*.test.ts`, node environment, excludes integration.
Integration tests: Vitest with real Supabase (`npm run test:integration`, `npm run test:integration:api`).
E2E tests: Playwright (`npm run test:e2e`) — specs in `e2e/`, Chromium, runs against local dev server (port 4321).
All three suites run in CI on every push/PR to `main`. Supabase secrets are required for integration and
E2E runs and are provided via GitHub Actions secrets (see `.github/workflows/ci.yml`).

## Commit & Pull Request Guidelines

No commit history yet — convention to be established. CI runs on `master` (`@.github/workflows/ci.yml`). Set `SUPABASE_URL` and `SUPABASE_KEY` in GitHub Actions secrets or the build job fails.

## Security & Configuration

Set Cloudflare account and project details in `wrangler.jsonc` before first deploy. Use `npx wrangler secret put` to push secrets to Cloudflare, not `wrangler.jsonc` directly.
