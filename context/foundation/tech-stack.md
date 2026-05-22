---
starter_id: 10x-astro-starter
package_manager: npm
project_name: estate-desk
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-workers
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
---

## Why this stack

A single real estate agent building a 3-week after-hours MVP with auth (email/password login), file storage (property photos and documents), and a Polish-language UI. The 10x-astro-starter recommended default for (web-app, js) hits every load-bearing requirement out of the box: Supabase covers PostgreSQL (listings, price history, contacts, commission config), auth (email+password sessions), and object storage (photo and document uploads) without assembling separate services; TypeScript and Zod enforce the commission-split arithmetic at compile time so rounding errors surface before they reach production data; Cloudflare Workers delivers edge deployment at the free tier, appropriate for a small-scale single-user app. The starter clears all four agent-friendly quality gates (typed, convention-based, popular in training data, well-documented). Bootstrapper confidence is first-class — the CLI is registered and expected to scaffold cleanly. AI feature flags (FR-019–022) are v2 nice-to-haves; has_ai is false reflecting the MVP scope decision in the PRD.
