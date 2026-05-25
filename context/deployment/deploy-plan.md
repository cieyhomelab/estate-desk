---
project: EstateDesk
deployed_at: 2026-05-22
platform: Cloudflare Workers
worker_name: estate-desk
live_url: https://estate-desk.maciej-kulesza.workers.dev
version_id: a7f2ef59-7d1d-4df3-9ade-a5e2790f9204
wrangler_version: "4.94.0"
adapter: "@astrojs/cloudflare@13.5.0"
status: deployed-and-verified
---

## What was deployed

EstateDesk MVP — first production deployment to Cloudflare Workers. The project was already configured for Workers by the bootstrapper (`@astrojs/cloudflare` v13.5.0, Workers-mode entrypoint). No adapter migration was required.

**Live URL:** https://estate-desk.maciej-kulesza.workers.dev

## Config corrections applied before deploy

Three stale values were fixed as part of this deploy session:

| File | Change |
|---|---|
| `wrangler.jsonc` | `name` renamed from `10x-astro-starter` → `estate-desk` |
| `context/foundation/tech-stack.md` | `deployment_target` updated from `cloudflare-pages` → `cloudflare-workers` |
| `.github/workflows/ci.yml` | Branch triggers fixed `master` → `main`; `deploy` job added |

## Worker bindings

| Binding | Type | Source |
|---|---|---|
| `env.ASSETS` | Assets | `wrangler.jsonc` — serves `./dist` static files |
| `env.SESSION` | KV Namespace | Auto-inherited from account (adapter-managed) |
| `env.IMAGES` | Images | Auto-wired by adapter (unused in MVP source code) |

## Secrets wired

Set via `wrangler secret put` — encrypted at rest in Cloudflare Workers Secrets:

| Secret | Status |
|---|---|
| `SUPABASE_URL` | Confirmed via `wrangler secret list` |
| `SUPABASE_KEY` | Confirmed via `wrangler secret list` |

Secrets are read in `src/lib/supabase.ts` via `astro:env/server` (not `process.env`).

## Smoke test results (2026-05-22)

All six steps passed:

- Home page `/` — loads without errors
- Sign-in form `/auth/signin` — renders
- Register with email/password — succeeds
- Email confirmation — passes
- Login → `/dashboard` redirect — works
- Logout → `/auth/signin` redirect — works

No 500 or 1015 (CPU exceeded) errors observed in `wrangler tail` during smoke test.

## Post-deploy dashboard hardening

Completed in the Cloudflare dashboard (Speed → Optimization → Content Optimization):

- Auto Minify (HTML/CSS/JS) — **OFF** _(prevents Astro hydration marker breakage)_
- Rocket Loader — **OFF** _(prevents React island initialization interference)_
- Zaraz — **OFF** if applicable

## CI/CD wiring

GitHub Actions workflow at `.github/workflows/ci.yml` now has two jobs:

- `ci` — runs on push and PRs to `main`: `npm ci → astro sync → lint → build`
- `deploy` — runs on push to `main` only (after `ci` passes): `build → wrangler deploy` via `cloudflare/wrangler-action@v3`

**GitHub Actions secrets required for `deploy` job to function:**

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Scoped "Edit Cloudflare Workers" token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |
| `SUPABASE_URL` | Used during build step |
| `SUPABASE_KEY` | Used during build step |

Add at: GitHub repo → Settings → Secrets and variables → Actions.

## Rollback procedure

```bash
# List available versions
npx wrangler versions list

# Rollback to previous version (or specify a version-id)
npx wrangler rollback
npx wrangler rollback <version-id>
```

Time to revert: ~10–30 seconds. DB migrations do not roll back automatically.

## Known risks inherited (see infrastructure.md risk register)

| Risk | Status |
|---|---|
| 10 ms CPU free-tier cap | Monitor — upgrade to Workers Paid ($5/mo) if 1015 errors appear |
| CJS dependency silent failure | Mitigate — audit any new npm library before adding |
| Preview URLs are public | Mitigate — configure Cloudflare Zero Trust before sharing previews with real data |
| Supabase large-file upload compatibility | To verify — test 10 MB document upload against live Workers before first real transaction |

## What is not yet deployed

- Custom domain (app running on `workers.dev` subdomain)
- Supabase production schema / Row Level Security
- Cloudflare Zero Trust for preview URL protection
