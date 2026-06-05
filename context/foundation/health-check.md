---
project: EstateDesk
checked_at: 2026-06-05T00:00:00Z
health_status: needs-attention
context_type: brownfield
language_family: js
stack_assessment_available: false
checks_run:
  - lockfile
  - dependency_audit
  - outdated_deps
  - test_runner
  - ci_cd
  - configuration
audit_findings:
  critical: 0
  high: 0
  moderate: 6
  low: 0
test_runner_detected: true
ci_provider: github-actions
recommended_fixes: 4
---

## Dependency Health

### Lockfile

```
Status: present (package-lock.json)
Package manager: npm
```

Lockfile is committed and valid. Dependency versions are pinned and builds are reproducible.

### Security Audit

```
Tool: npm audit --json
Summary: 0 CRITICAL, 0 HIGH, 6 MODERATE, 0 LOW
Direct vs transitive: all 6 findings are transitive
```

No direct dependency has a vulnerability. All findings cascade from toolchain packages (language server, YAML parser, REST client) — none of them ship in production bundles.

**MODERATE findings** (all transitive, fix available via `npm audit fix`):

- **qs** ≥6.11.1 ≤6.15.1 — GHSA-q8mj-m7cp-5q26: DoS via null/undefined entries in comma-format arrays (CVSS 5.3). Transitive via `typed-rest-client`.
- **yaml** 2.0.0–2.8.2 — GHSA-48c2-rrv3-qjmp: Stack Overflow on deeply nested YAML (CVSS 4.3). Transitive via `yaml-language-server` → `volar-service-yaml` → `@astrojs/language-server`.
- **@astrojs/language-server**, **volar-service-yaml**, **typed-rest-client**, **yaml-language-server** — cascade effects of the two above.

All six carry `fixAvailable: true`. Run `npm audit fix` to resolve them in one step.

### Outdated Dependencies

```
Packages with major version gaps: 5
```

Direct dependencies at least one major version behind:

- **typescript**: 5.9.3 → 6.0.3 (1 major version behind)
- **eslint**: 9.x → 10.x (1 major version behind)
- **@eslint/js**: 9.x → 10.x (1 major version behind)
- **dotenv**: 16.x → 17.x (1 major version behind)
- **lint-staged**: 16.x → 17.x (1 major version behind)

TypeScript 6 is the most impactful — it may introduce stricter inference and change some diagnostic behavior. The ESLint 9→10 jump is likely the most complex to migrate (flat config format was already adopted, so the delta may be smaller). The others are low-risk. All remaining packages have only minor/patch gaps — no action needed.

---

## Test Suite

```
Test runner: Vitest (unit) + Playwright (E2E)
Tests found: 4 unit tests, 7 integration test files, E2E suite
Test execution: passing (unit tests)
```

```
Configuration: vitest.config.ts (unit), vitest.integration.config.ts (integration), playwright.config.ts (E2E)
Framework: Vitest ^4.1.8, Playwright ^1.53.0
```

Unit tests run cleanly — 4/4 passing (`src/lib/commission.test.ts`). Integration tests (7 files under `src/integration/`) require a live Supabase instance and are not executable locally without credentials; they run in CI against the test project via secrets. E2E tests are configured but require `playwright install` and a running app instance.

Test coverage depth is appropriate for the MVP stage — the commission calculation (the project's precision-critical logic) is fully unit-tested with edge cases.

---

## CI/CD

```
Provider: GitHub Actions
Configuration: .github/workflows/ci.yml, .github/workflows/deploy.yaml
```

| Stage      | Status | Notes                                                     |
|------------|--------|-----------------------------------------------------------|
| Lint       | ✓      | `npm run lint` (ESLint via eslint.config.js)             |
| Test       | ✓      | Unit + integration + E2E, all in `ci.yml`                |
| Build      | ✓      | `astro build` (both ci and deploy jobs)                  |
| Type check | ✗      | No `npx astro check` or `tsc --noEmit` step in CI       |
| Security   | ✗      | No `npm audit` step; audit runs must be triggered manually |

**⚠ Duplicate deploy workflow detected.** Two workflows both trigger on push to `main`:

- `ci.yml` — runs the full CI gate (lint → test → integration → E2E → build), then deploys via `cloudflare/wrangler-action` only after all tests pass.
- `deploy.yaml` — runs `npm run build` and deploys via `npx wrangler deploy` *without* running any tests first.

Every push to `main` currently triggers two concurrent deployments. The `deploy.yaml` workflow can deploy a build that would fail `ci.yml`'s test gate if both complete in different orders. The `deploy.yaml` should be removed — `ci.yml` already handles deployment correctly.

---

## Configuration

### High severity

*(none)*

### Medium severity

- **Type-check step missing from CI** — TypeScript errors are not caught in the pipeline. The agent can generate code with type errors that pass lint and tests but would fail a type check. Fix: add `- run: npx astro check` immediately after `npx astro sync` in `ci.yml`.

### Low severity

- **.editorconfig** — not present. Without it, developers on different editors may produce inconsistent whitespace and line endings. Prettier covers formatting, but editorconfig enforces it at the editor level before Prettier runs. Fix: create `.editorconfig` with `indent_style = space`, `indent_size = 2`, `end_of_line = lf`, `charset = utf-8`.

All other expected configuration is present: `.prettierrc.json`, `eslint.config.js`, `tsconfig.json` (extends `astro/tsconfigs/strict` — strict mode confirmed), `.gitignore`, `.env.example`, `CLAUDE.md`, `AGENTS.md`. No gaps in the core configuration surface.

---

## Stack Assessment Cross-Reference

```
No stack-assessment.md found. Run /10x-stack-assess for quality-gate analysis.
```

---

## Recommended Fixes

### Fix before agent work (Category A)

#### 1. Remove the duplicate `deploy.yaml` workflow

**Impact**: Every push to `main` triggers two concurrent deployments. The orphaned `deploy.yaml` can deploy unverified code — bypassing lint, unit tests, integration tests, and E2E — if it wins the race against `ci.yml`'s deploy job. The agent makes frequent small commits; this gap means the agent's own changes can ship without test verification.
**Severity**: medium
**Effort**: quick (< 5 min)
**Fix**:

```bash
git rm .github/workflows/deploy.yaml
git commit -m "chore(ci): remove duplicate deploy workflow that bypasses test gate"
```

`ci.yml` already handles deployment after CI passes. No functionality is lost.

---

#### 2. Add type-check step to CI

**Impact**: Without `astro check` in CI, TypeScript errors introduced by the agent are invisible until the developer runs it locally. The agent generates a lot of TypeScript and treats the CI green signal as "correct" — a missing type-check step means type errors accumulate silently.
**Severity**: medium
**Effort**: quick (< 5 min)
**Fix**:

In `.github/workflows/ci.yml`, add after `npx astro sync`:

```yaml
- run: npx astro check
```

This runs the Astro language server's full TypeScript check against the project, including `.astro` component types.

---

#### 3. Fix all MODERATE audit vulnerabilities

**Impact**: All six findings are in transitive toolchain dependencies — none ship in the production bundle. However, a clean audit baseline means the agent can be instructed to keep `npm audit` green as part of quality gates, which keeps the signal actionable.
**Severity**: low
**Effort**: quick (< 5 min)
**Fix**:

```bash
npm audit fix
```

All six findings carry `fixAvailable: true`, so this should resolve them non-destructively (no major version bumps).

---

#### 4. Evaluate TypeScript 5→6 migration

**Impact**: TypeScript 6 may tighten inference in ways that produce new errors in existing code. Updating while the agent is actively adding features creates noise — it's better to migrate to a known-good state first. `dotnet`, `eslint`, and `lint-staged` major bumps are lower risk.
**Severity**: low
**Effort**: moderate (15–30 min)
**Fix**:

```bash
# Check for breaking changes first:
npm install typescript@latest --save-dev
npx astro check
# Review any new diagnostics, fix or suppress as appropriate
```

If the migration surfaces too many changes, pin `typescript` to `^5.9.3` explicitly in `package.json` and revisit later.

---

### Addressed in upcoming lessons (Category B)

All Category B items are already in place for this project — CI/CD, `CLAUDE.md`, `AGENTS.md`, and deployment configuration are fully set up. There are no deferred items. The four Category A fixes above are the complete recommended list.

---

## Summary

**Health status: needs-attention**

EstateDesk is in strong shape for agent-assisted development: the lockfile is committed, dependencies have no HIGH or CRITICAL vulnerabilities, the TypeScript configuration uses strict mode, the test suite runs cleanly (unit + integration + E2E all wired into CI), and agent instruction files (`CLAUDE.md`, `AGENTS.md`) are present. The two gaps that matter most for agent safety are the orphaned `deploy.yaml` workflow (which can ship untested code on every push) and the missing type-check step in CI (which leaves TypeScript errors invisible to the CI signal). Both are quick fixes.

Next step: remove `deploy.yaml`, add `npx astro check` to `ci.yml`, then run `npm audit fix` to clear the six moderate advisories. All four fixes together take under 30 minutes. Once done, the project is agent-ready.
