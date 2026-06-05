---
project: EstateDesk
researched_at: 2026-05-22
recommended_platform: Cloudflare Workers
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript / JavaScript
  framework: Astro 6 (output:server, SSR)
  runtime: Cloudflare Workers (workerd) via @astrojs/cloudflare v13.5.0
  database: Supabase (PostgreSQL + auth + object storage — external)
---

## Recommendation

**Deploy on Cloudflare Workers.**

The project is already configured for Workers — `@astrojs/cloudflare` v13.5.0 with `output: 'server'`, `wrangler.jsonc` using the Workers-mode entrypoint (`@astrojs/cloudflare/entrypoints/server`) and a Workers-style ASSETS binding. The `tech-stack.md` frontmatter field `deployment_target: cloudflare-pages` is stale metadata; the bootstrapper wired Workers from the start. No Pages→Workers migration is required. Cloudflare Workers scores 5/5 on all agent-friendly criteria, is free at single-user MVP traffic (~3 M requests/month on the free tier), and carries the developer's existing Cloudflare familiarity as a tiebreaker. The runner-up is Netlify (4.5/5), not Vercel — Vercel's Hobby plan is explicitly non-commercial, which disqualifies it for a professional-use business tool without a $20/month Pro upgrade.

## Platform Comparison

| Platform | CLI-first | Managed / Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Score |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass | **5 / 5** |
| **Netlify** | Partial | Pass | Pass | Pass | Pass | **4.5 / 5** |
| **Vercel** | Pass | Pass | Partial | Pass | Pass | **4.5 / 5** |
| **Fly.io** | Pass | Partial | Partial | Pass | Partial | **3.5 / 5** |
| **Render** | Partial | Partial | Fail | Pass | Pass | **3 / 5** |
| **Railway** | Partial | Partial | Partial | Pass | Partial | **2.5 / 5** |

**Scoring notes per platform (all statuses checked 2026-05-22):**

**Cloudflare Workers** — `wrangler deploy`, `wrangler rollback`, `wrangler tail`, `wrangler versions list` cover every routine operation without needing the dashboard. Fully serverless (no VM/container management). `llms.txt` GA at `developers.cloudflare.com` (launched Feb 2026) with per-page markdown via `Accept: text/markdown` header. 14 GA MCP servers covering Workers deployments, observability, docs, and bindings. Free tier: 100k req/day (~3 M/month), unlimited bandwidth. Paid: $5/month for 10 M req/month included + 30-second CPU limit per request.

**Netlify** — CLI deploy and logs are solid; no `netlify rollback` command (rollback is UI-only via "Publish Deploy" on a prior snapshot) → Partial on CLI-first. `llms.txt` confirmed at `docs.netlify.com`. `@netlify/mcp` GA (Feb 2026): strongest MCP toolset of any platform tested. Free tier: 300 credits/month; production deploy = 15 credits each (≥20 prod deploys/month exhausts the free allowance). No non-commercial restriction.

**Vercel** — CLI excellent: `vercel --prod`, `vercel rollback`, `vercel logs --follow` all GA. No `llms.txt` (docs are web-served markdown, not GitHub-hosted) → Partial on agent-readable docs. GA MCP at `mcp.vercel.com`. **Structural mismatch**: Hobby plan is explicitly non-commercial / personal use only. EstateDesk is used professionally by a real estate agent → Pro = $20/month, directly contradicting the cost-minimize interview answer (Q2).

**Fly.io** — Containers require Docker knowledge and VM configuration (more ops than serverless) → Partial on Managed/Serverless. GitHub markdown docs but no `llms.txt` → Partial on agent-readable. `fly mcp server` explicitly marked **experimental** (2026-05-22) → Partial on MCP. Warsaw region deprecated (Sep 2025); EU nearest = Frankfurt (`fra`). Scale-to-zero works (~$0/month idle); credit card required even for free tier.

**Render** — No `llms.txt`, docs are HTML-rendered only → Fail on agent-readable. No CLI rollback command (REST API + dashboard only) → Partial on CLI-first. Container-based web services (not serverless) → Partial on Managed/Serverless. Free tier: 60-second cold starts after 15-minute idle (changed Sep 2025) — unusable for production. Starter paid = $7/month. GA MCP at `mcp.render.com` (Aug 2025, 20+ tools). Single EU region: Frankfurt.

**Railway** — No CLI rollback command (dashboard only) → Partial on CLI-first. Nixpacks/Railpack auto-detect (easier than Fly.io but more ops than serverless) → Partial on Managed/Serverless. Docs at docs.railway.com as markdown but not GitHub-hosted → Partial on agent-readable. MCP server marked "work in progress" (not GA) → Partial on MCP. Critical: EU region (Amsterdam) is **Pro-only ($20/month)**; Hobby plan users land on US regions — adds 100–120ms latency from Poland. Hobby = $5/month mandatory subscription.

**Interview-weight adjustments applied:**
- Cost minimize (Q2): Cloudflare (free), Netlify (free), Render ($7/month paid viable), Fly.io (~$2/month idle + credit card), Railway ($5/month + EU = Pro), Vercel (non-commercial = Pro $20/month). Penalizes Railway and Vercel.
- Cloudflare familiarity (Q3): tiebreaker over Netlify.
- Single region Poland (Q4): Railway Hobby is US-only — material penalty. Other platforms all offer EU/Frankfurt.
- External providers fine (Q5): no co-location adjustment (Supabase already chosen for all data services).

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Already configured in the project — zero migration work. 5/5 agent-friendly criteria. Free tier covers single-user MVP traffic by a large margin. `wrangler` CLI is the most capable deployment CLI tested: deploy, rollback, version list, log tail, secret management, and dry-run mode all scriptable. Agent tooling (14 GA MCP servers, `llms.txt` with per-page markdown, dedicated Claude Code setup guide) is the most mature of any platform. Cloudflare familiarity removes onboarding friction. The workerd CJS constraint and the 10ms free-tier CPU cap are auditable, bounded risks, not unknowns.

#### 2. Netlify

Strong second: 4.5/5, no non-commercial restriction, free tier with predictable credit pacing (300/month), `llms.txt` confirmed, `@netlify/mcp` GA with the widest MCP toolset of any platform tested. The only meaningful gaps are UI-only rollback and the 20-prod-deploy ceiling on free credits. If Cloudflare Workers proves problematic (CJS chain, workerd edge cases), Netlify is the cleanest migration path — `@astrojs/netlify` adapter v7.0.10 is GA, and the deploy model (`netlify deploy --prod`) is safe-by-default.

#### 3. Fly.io

Technically capable, EU Frankfurt region available, scale-to-zero economics work at near-zero traffic. Not a natural fit for a solo after-hours developer: requires Docker, more ops surface than serverless, experimental MCP, and credit card required. Included because it's the cleanest fallback if workerd's ESM constraints prove irresolvable for a specific dependency the project must use.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **10 ms CPU free-tier cap is likely binding for SSR pages with non-trivial logic.** Every synchronous computation counts — Zod commission-split validation, auth token checks, template rendering. Supabase I/O is exempt (network await time doesn't count against CPU), but any request combining multiple synchronous operations will hit this wall. The $5/month paid plan (30 s CPU/request, 30 M ms/month included) is the realistic floor for a production SSR app, not the free tier.

2. **CJS dependencies silently fail in `workerd` at runtime.** Any npm package using `require()` / `module.exports` throws at runtime in the Workers edge runtime. Astro's ecosystem has known CJS remnants (Image component internals, some UI library build artifacts). Failures surface in deployed Workers, not in `astro dev`, because local and remote compatibility flag resolution differ. A CJS chain buried in `node_modules` is the highest-probability silent failure mode for this stack.

3. **No automatic PR preview URLs without Cloudflare Zero Trust setup.** Vercel and Netlify generate preview URLs on every push automatically and protect them with native auth. Cloudflare Workers requires manual `wrangler versions upload` plus a Cloudflare Access (Zero Trust) policy to password-protect preview URLs. An unprotected preview URL rendering real EstateDesk data (owner contacts, commission figures) is a GDPR exposure.

4. **`wrangler.jsonc` is sensitive to adapter version boundaries.** The v13 adapter introduced breaking config changes. Future adapter upgrades may silently break the config. A `npm update @astrojs/cloudflare` requires explicit verification of the `main` entrypoint path and `assets.binding` format against the new adapter release notes — unlike `npm update @astrojs/netlify`.

5. **`wrangler secret put` prompts interactively by default and is agent-unfriendly.** Setting multiple secrets one at a time blocks stdin-expecting automation. `wrangler secret bulk` (JSON file) exists but is less discoverable than `netlify env:import` or `vercel env pull`.

### Pre-Mortem — How This Could Fail

The EstateDesk MVP deployed cleanly to Cloudflare Workers on day one — the project was already configured, `wrangler deploy` succeeded, smoke tests passed. By week two, the commission calculation page started throwing sporadic 1015 (CPU exceeded) errors: the Zod schema validation and arithmetic ran synchronously in the same 10 ms budget as the Supabase JWT verification. Upgrading to the $5/month paid plan resolved the 1015 errors. But the deeper problem emerged silently: an indirect dependency of the transaction-summary export feature used a CJS `require()` call three levels deep in its dependency chain. In `workerd`, the module initialization failed during import rather than at call time, causing the export function to return `undefined` instead of throwing. The Supabase document upload recorded an empty buffer with an HTTP 200 — no error in the logs, just silent data loss. Three completed transaction records accumulated empty attachments over two weeks before the agent noticed. Diagnosing the root cause required tracing the CJS chain through the full `node_modules` tree and reproducing it against a staged Workers deploy — a task that consumed six hours across three after-hours sessions. The lesson: "builds without errors" and "passes in `astro dev`" are insufficient evidence of workerd compatibility for a dependency that uses CJS module initialization.

### Unknown Unknowns

1. **`astro dev` workerd mode and deployed Workers are not identical.** The v13 dev server uses the `workerd` runtime for closer production parity, but compatibility flag resolution, `wrangler.jsonc` binding wiring, and local vs. remote module loading paths differ in edge cases. Passing tests in `astro dev` is weaker evidence than a staged Workers deploy.

2. **Supabase `storage-js` large-file uploads have had Workers compatibility gaps.** The EstateDesk NFR requires document uploads up to 10 MB. Supabase's storage client uses `FormData`/`Blob` Web APIs for multipart uploads. Workers' `nodejs_compat` flag covers standard Web APIs, but large multipart uploads near the 128 MB isolate memory limit are an untested code path for this specific stack. Test this explicitly against a deployed Workers instance before MVP go-live.

3. **Preview deployment URLs are public by default.** EstateDesk stores owner names, buyer/tenant contacts, and commission data. Any preview URL without Cloudflare Access protection is a public GDPR exposure. Configure Cloudflare Access (Zero Trust, free for ≤50 users) for `*.estate-desk.workers.dev` subdomains before any client-facing demo.

4. **`wrangler secret put` blocks stdin — use `--stdin` flag or `wrangler secret bulk` for automation.** Interactive `wrangler secret put SUPABASE_URL` waits for keyboard input. Agent-safe form: `echo "value" | npx wrangler secret put SUPABASE_URL --stdin`, or create a `secrets.json` and run `wrangler secret bulk secrets.json` (never commit `secrets.json`).

5. **Free-tier 100k req/day limit resets at UTC midnight, not on a rolling window.** Warsaw time is UTC+2; late-evening development sessions that span local midnight can see the budget reset mid-session. Automated smoke tests or integration test suites that fire many SSR requests can exhaust the daily budget before real usage that day.

## Operational Story

- **Preview deploys**: Manual — `npx wrangler versions upload` creates a versioned preview URL (format: `https://<version-hash>.estate-desk.workers.dev`). No automatic PR-preview generation. Protect preview URLs with Cloudflare Access (Zero Trust, free ≤50 users) before sharing if they render real data; use only synthetic test data on unprotected previews.
- **Secrets**: Stored as Cloudflare Workers Secrets (encrypted at rest, not visible after upload). Set via `echo "value" | npx wrangler secret put KEY --stdin`. Two secrets required per `astro.config.mjs`: `SUPABASE_URL` and `SUPABASE_KEY`. Readable at runtime via `import.meta.env.SUPABASE_URL`. Rotation: `wrangler secret put` overwrites immediately; change takes effect on next deploy.
- **Rollback**: `npx wrangler rollback` — reverts to the previous deployment immediately, no rebuild needed. Target a specific version: `npx wrangler rollback <version-id>` (list with `npx wrangler versions list`). Time to revert: 10–30 seconds. Caveat: Supabase DB migrations applied with the rolled-back version are not reversed automatically — handle schema rollback separately via Supabase migration tooling.
- **Approval**: Agent may run unattended: `wrangler deploy`, `wrangler rollback`, `wrangler versions upload`, `wrangler tail`, `wrangler secret put`, `wrangler secret list`. Human-only: deleting the Workers project, rotating the Cloudflare API token, modifying DNS/nameserver delegation, disabling Cloudflare Auto Minify/Zaraz/Rocket Loader (dashboard-only zone settings), dropping Supabase tables.
- **Logs**: `npx wrangler tail` — streams live request and error logs. Filter: `npx wrangler tail --status error`. JSON output: `npx wrangler tail --format json`. Structured log queries: Cloudflare Observability MCP server (tool: `worker_logs`). Connect via `claude mcp add` using the Cloudflare MCP catalog at `developers.cloudflare.com/agent-setup/claude-code/`. Log retention: 7 days on Workers Paid; best-effort on free tier.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 10 ms CPU free-tier cap causes 1015 errors on SSR pages with non-trivial computation | Devil's advocate | M | M | Upgrade to Workers Paid ($5/month) at first deploy; treat free tier as development-only. Profile with `wrangler dev --remote` before go-live. |
| CJS transitive dependency fails silently in `workerd`, causing data corruption rather than an error | Pre-mortem | M | H | Before adding any library: run `node --input-type=module -e "await import('pkg')"` to verify ESM compatibility. Add a staging Workers deploy step to CI. |
| Preview deployment URLs expose personal data (GDPR) without Cloudflare Access protection | Unknown unknowns | M | H | Configure Cloudflare Zero Trust Access for `*.estate-desk.workers.dev` before any client demo. |
| Supabase storage large-file upload (≤10 MB) incompatible with Workers `workerd` runtime | Unknown unknowns | L | M | Test the full upload flow against a staged Workers deployment (not `astro dev`) before MVP go-live. |
| `wrangler secret put` interactive stdin blocks agent automation | Unknown unknowns | M | L | Always use `echo "value" \| npx wrangler secret put KEY --stdin` or `wrangler secret bulk secrets.json` for automated secret setup. |
| `@astrojs/cloudflare` adapter upgrade silently breaks `wrangler.jsonc` config format | Devil's advocate | L | M | Pin adapter version in `package.json`. Read adapter release notes before upgrading; verify `main` entrypoint and `assets.binding` field names. |
| Free-tier 100k req/day budget exhausted by test automation, starving real usage | Unknown unknowns | L | L | Run integration/smoke tests against local `wrangler dev`, not the live Worker. |
| `tech-stack.md` `deployment_target: cloudflare-pages` is stale and will confuse downstream skills | Research finding | — | L | Update `tech-stack.md` frontmatter `deployment_target` to `cloudflare-workers` before running `/10x-implement`. |
| Cloudflare Auto Minify or Rocket Loader interferes with Astro client-side hydration | Pre-mortem | M | M | Disable Auto Minify, Zaraz, and Rocket Loader in the Cloudflare dashboard (Speed → Optimization → Content Optimization) immediately after first deploy. |

## Getting Started

The project is fully configured for Workers — no adapter changes or `wrangler.jsonc` rewrite needed. Five steps to first live deploy:

1. **Rename the Worker** — `wrangler.jsonc` currently has `"name": "10x-astro-starter"`. Change it to `"name": "estate-desk"` to avoid Cloudflare namespace collisions and get a clean `estate-desk.workers.dev` URL.

2. **Authenticate wrangler** (credentials cached in `~/.wrangler/config`):
   ```bash
   npx wrangler login
   ```

3. **Set Supabase secrets** (two secrets defined in `astro.config.mjs`):
   ```bash
   echo "https://your-project.supabase.co" | npx wrangler secret put SUPABASE_URL --stdin
   echo "your-anon-key" | npx wrangler secret put SUPABASE_KEY --stdin
   ```

4. **Build and deploy**:
   ```bash
   npm run build && npx wrangler deploy
   ```

5. **Verify** — visit the `estate-desk.workers.dev` URL printed by wrangler. Tail live logs in a second terminal: `npx wrangler tail`. Then disable Auto Minify and Rocket Loader in the Cloudflare dashboard before real usage.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (GitHub Actions wiring for automated deploy on merge)
- Production-scale architecture (multi-region, HA, DR)
- Supabase Row-Level Security configuration (auth surface, separate from infrastructure)
- Cloudflare D1 / KV as database alternatives (Supabase is the chosen data layer)
