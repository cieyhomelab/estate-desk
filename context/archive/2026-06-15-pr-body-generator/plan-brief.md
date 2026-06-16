# PR Body Generator — Plan Brief

> Full plan: `context/changes/pr-body-generator/plan.md`

## What & Why

A `/pr-body-generator <change-id>` skill that reads a change's plan files and assembles a formatted PR body in Markdown, ready to paste or pipe to `gh pr create`. Eliminates the manual work of copying sections from plan.md into a PR description every time a branch is ready to merge.

## Starting Point

No such skill exists. The 10x skill directory at `.claude/skills/` has patterns for argument parsing and output copy (see `10x-new`, `10x-archive`) that this skill follows. Risks currently live in `plan-brief.md`, not `plan.md`.

## Desired End State

Invoking `/pr-body-generator i-04-commission` (or any change-id) produces a clean PR body with five sections — Summary, Changes, Test plan, Risks, Commits — copied to clipboard and printed to the conversation.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
|---|---|---|
| Missing plan.md | Partial output + warning | Never blocks the user; useful even mid-planning |
| Output destination | Stdout + clipboard copy | Matches other 10x skills; pipeable to gh pr create |
| Base branch | Always `origin/main` | Matches intent notes; EstateDesk is a single-repo project |
| Changes section | One bullet per Phase + Overview sentence | Maps cleanly to plan structure; not too verbose |
| Risks source | plan-brief.md first, then plan.md | Risks live in plan-brief.md in this project's convention |

## Scope

**In scope:** SKILL.md file only; reads change.md (title), plan.md (5 sections), plan-brief.md (risks), git log.

**Out of scope:** Auto-opening PRs, GitHub API, branch readiness checks, missing context/changes/ dir handling, configurable base branch.

## Architecture / Approach

A single `SKILL.md` instruction file. Claude reads it and executes: parse arg → validate change dir exists → read files → assemble five output sections → print → copy to clipboard. No code files, no dependencies.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Write skill definition | Complete SKILL.md at `.claude/skills/pr-body-generator/` | Plan.md section headers vary (colon vs em-dash); parsing must be flexible |

**Prerequisites:** None — directory `.claude/skills/pr-body-generator/` has been created.
**Estimated effort:** ~1 session, 1 phase.

## Open Risks & Assumptions

- Phase headers in plan.md are not uniformly formatted (`## Phase 1: Name` vs `## Phase 1 — Name`). The skill must handle both patterns.
- Risks section does not exist in plan.md by default — the skill falls back to plan-brief.md. If neither file has a risks section, output shows a placeholder.

## Success Criteria (Summary)

- `/pr-body-generator <change-id>` emits a complete, copyable PR body in under 5 seconds
- Missing plan.md produces partial output with clear warnings, not a crash
- No-argument and nonexistent-change-id invocations fail gracefully with a helpful message
