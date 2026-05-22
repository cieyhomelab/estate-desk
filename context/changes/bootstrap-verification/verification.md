---
bootstrapped_at: 2026-05-22T20:01:25Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: estate-desk
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: estate-desk
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

**Why this stack**: A single real estate agent building a 3-week after-hours MVP with auth (email/password login), file storage (property photos and documents), and a Polish-language UI. The 10x-astro-starter recommended default for (web-app, js) hits every load-bearing requirement out of the box: Supabase covers PostgreSQL (listings, price history, contacts, commission config), auth (email+password sessions), and object storage (photo and document uploads) without assembling separate services; TypeScript and Zod enforce the commission-split arithmetic at compile time so rounding errors surface before they reach production data; Cloudflare Pages delivers edge deployment at the free tier, appropriate for a small-scale single-user app. The starter clears all four agent-friendly quality gates (typed, convention-based, popular in training data, well-documented). Bootstrapper confidence is first-class — the CLI is registered and expected to scaffold cleanly. AI feature flags (FR-019–022) are v2 nice-to-haves; has_ai is false reflecting the MVP scope decision in the PRD.

## Pre-scaffold verification

| Signal      | Value                                                        | Severity | Notes                                                              |
| ----------- | ------------------------------------------------------------ | -------- | ------------------------------------------------------------------ |
| npm package | not run                                                      | —        | git-clone strategy; no npm create-* package to check               |
| GitHub repo | not run                                                      | —        | gh CLI not authenticated; registry card shows last_updated 2026-05-01 (fresh) |

Registry card `last_updated: 2026-05-01` — 21 days before this run, within the "fresh" threshold. No blocking signal. Run `gh api repos/przeprogramowani/10x-astro-starter` after authenticating `gh` to verify live repo state.

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone (cloned starter repo into temp dir, deleted upstream `.git/`, moved files into cwd)
**Exit code**: 0
**Files moved**: 19 items (files and directories moved silently into cwd)
**Conflicts (.scaffold siblings)**: `CLAUDE.md` → `CLAUDE.md.scaffold` (cwd's project-chain `CLAUDE.md` preserved)
**.gitignore handling**: moved silently (was absent in cwd)
**.bootstrap-scaffold cleanup**: deleted

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/2/0 direct of total 0/1/9/0 (HIGH is transitive; direct MODERATE are `@astrojs/check` and `wrangler`)

#### CRITICAL findings

None.

#### HIGH findings

- **devalue** (transitive via Svelte ecosystem)
  - Advisory: GHSA-77vg-94rm-hx3p — "Svelte devalue: DoS via sparse array deserialization"
  - Not a direct dependency; brought in as a transitive dep of dev tooling. No runtime exposure on Cloudflare Pages (devalue is not in the production bundle path for an Astro+React app).
  - Fix available (non-breaking): run `npm audit fix` to resolve.

#### MODERATE findings

- **@astrojs/check** (direct dev dependency) — no specific advisory; fix available via major bump to 0.9.2 (semver major; review breaking changes before upgrading)
- **@astrojs/language-server** (transitive) — fixed by upgrading `@astrojs/check`
- **@cloudflare/vite-plugin** (transitive) — fix available
- **miniflare** (transitive) — fix available
- **volar-service-yaml** (transitive) — fixed by upgrading `@astrojs/check`
- **wrangler** (direct dev dependency) — fix available via `npm audit fix`
- **ws** (transitive) — GHSA-58qx-3vcg-4xpx "ws: Uninitialized memory disclosure"; fix available
- **yaml** (transitive) — GHSA-48c2-rrv3-qjmp "yaml vulnerable to Stack Overflow via deeply nested YAML collections"; fixed by upgrading `@astrojs/check`
- **yaml-language-server** (transitive) — fixed by upgrading `@astrojs/check`

All MODERATE findings are in dev/tooling dependencies (`wrangler`, `@astrojs/check`), not in runtime production code. Production bundle shipped to Cloudflare Pages does not include these packages.

## Hints recorded but not acted on

| Hint                    | Value                   |
| ----------------------- | ----------------------- |
| bootstrapper_confidence | first-class             |
| quality_override        | false                   |
| path_taken              | standard                |
| self_check_answers      | null                    |
| team_size               | solo                    |
| deployment_target       | cloudflare-pages        |
| ci_provider             | github-actions          |
| ci_default_flow         | auto-deploy-on-merge    |
| has_auth                | true                    |
| has_payments            | false                   |
| has_realtime            | false                   |
| has_ai                  | false                   |
| has_background_jobs     | false                   |

These hints are carried forward as metadata. A future skill will wire `deployment_target`, `ci_provider`, and `ci_default_flow` into actual CI/CD configuration. `has_auth: true` confirms Supabase auth setup is load-bearing for the EstateDesk MVP.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review `CLAUDE.md.scaffold` — this is the starter's default agent context; diff it against the existing `CLAUDE.md` to see if any starter-specific instructions are worth keeping.
- Run `npm audit fix` to resolve the `devalue` HIGH and `wrangler` MODERATE findings (non-breaking fixes).
- Address `@astrojs/check` major-version bump separately after reviewing its changelog.
- Configure Supabase: add your project URL and anon key to `.env` (see `.env.example`).
- Configure Cloudflare: update `wrangler.jsonc` with your account and project details.
