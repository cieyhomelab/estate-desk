---
id: claude-md-conventions
title: "Add EstateDesk Coding Conventions to CLAUDE.md"
status: plan_reviewed
created: 2026-06-05
updated: 2026-06-05
roadmap_ref: F-01
prd_refs: "§Non-Functional Requirements"
prerequisites: []
unlocks:
  - listing-tab-navigation
  - address-formatting-llm
  - home-page-redesign
---

## Summary

Add an `## EstateDesk Coding Conventions` block to the top of `CLAUDE.md`, documenting five patterns the agent must follow when implementing S-01 (tab navigation), S-02 (LLM address formatting), and S-03 (home page redesign):

1. React island hydration directives (`client:load` vs `client:only`)
2. API route shape (auth check, form parsing, redirect pattern)
3. External LLM calls must go via a server-side API route (never from client)
4. Tailwind CSS v4 conventions (no config file, `@theme inline`, `@utility`)
5. Astro env schema for declaring new secret environment variables

## Risk

Without these documented conventions the agent may: generate v3-era Tailwind config, call OpenRouter directly from a React component (exposes the API key in the browser), or skip the `envField` declaration (variable is undefined in Cloudflare Workers at runtime).
