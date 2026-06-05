# EstateDesk Coding Conventions — Plan Brief

> Full plan: `context/changes/claude-md-conventions/plan.md`

## What & Why

Add an `## EstateDesk Coding Conventions` block to the top of `CLAUDE.md`. Without it, agents implementing S-01 (tab navigation), S-02 (LLM address formatting), and S-03 (home page) risk generating broken Tailwind v3 config files, calling OpenRouter directly from a React component (API key leak), or forgetting to declare `OPENROUTER_API_KEY` in the Astro env schema (undefined in Cloudflare Workers at runtime).

## Starting Point

`CLAUDE.md` currently contains only the injected 10xDevs toolkit lesson block. The file has no project-specific conventions. All five patterns to document are already in use in the codebase but not codified anywhere an agent reads at task start.

## Desired End State

`CLAUDE.md` opens with `## EstateDesk Coding Conventions` (above the existing toolkit lesson block) covering five numbered rules in English. Any agent that reads `CLAUDE.md` before starting S-01, S-02, or S-03 will have the correct patterns for React islands, API routes, LLM routing, Tailwind v4, and env vars — without needing to discover them by reading source files.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| Language | English | Framework docs (Astro, React, Tailwind) are English — agent reasons best when conventions and reference docs share a language. | Plan |
| Placement | Top of file (before `<!-- BEGIN -->`) | Agent reads top-to-bottom; project-specific rules must outprioritize generic toolkit instructions. | Plan |
| Env vars convention | Include as 5th convention | S-02 requires `OPENROUTER_API_KEY` in `astro.config.mjs`; without the rule the implementer will skip it and get a silent runtime failure in Cloudflare Workers. | Plan |

## Scope

**In scope:** Adding `## EstateDesk Coding Conventions` block to `CLAUDE.md` with five conventions: React island directives, API route shape, LLM via server route, Tailwind v4, Astro env schema.

**Out of scope:** Adding `OPENROUTER_API_KEY` to `astro.config.mjs` (that belongs to S-02), modifying any source files, creating new routes or components, modifying the toolkit lesson block.

## Architecture / Approach

Single documentation edit: prepend the conventions block as plain markdown to `CLAUDE.md`. No code, schema, or route changes. The conventions reference existing patterns already in the codebase — they describe reality, not aspirations.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Write conventions | `## EstateDesk Coding Conventions` block at top of `CLAUDE.md` with all five rules | Broken code fence (backtick nesting inside the plan template) — verify rendering manually |

**Prerequisites:** None — this change has no dependencies and is the first in the roadmap.
**Estimated effort:** ~1 session; single-file documentation edit.

## Open Risks & Assumptions

- The conventions describe patterns currently in use; if the codebase drifts (e.g., Tailwind v5 upgrade), the conventions will need updating.
- The toolkit lesson block is managed externally — the conventions block must stay above the `<!-- BEGIN -->` marker so it is not overwritten.

## Success Criteria (Summary)

- `CLAUDE.md` opens with `## EstateDesk Coding Conventions` above the `<!-- BEGIN @przeprogramowani/10x-cli -->` marker
- All five conventions are present, correctly numbered, and have working code fences
- `npx astro check` and `npm run build` pass (regression guard)
