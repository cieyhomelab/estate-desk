# PR Body Generator — Implementation Plan

## Overview

A Claude Code skill (`/pr-body-generator`) that reads a change's metadata and plan, runs `git log`, and assembles a ready-to-paste PR body in Markdown. Output goes to stdout and is copied to clipboard. No GitHub API calls, no PR creation.

## Current State Analysis

No `/pr-body-generator` skill exists yet. The skill directory `.claude/skills/pr-body-generator/` is the only output artifact required. The format follows the established `SKILL.md` pattern used by all other 10x skills (`10x-archive`, `10x-new`, etc.).

## Desired End State

A SKILL.md file at `.claude/skills/pr-body-generator/SKILL.md` that Claude executes when the user runs `/pr-body-generator <change-id>`. The skill emits a formatted PR body to stdout and copies it to clipboard.

To verify: invoke `/pr-body-generator i-04-commission` and confirm the output contains the commission plan's Overview as the Summary, the two phases as Changes bullets, the Testing Strategy content as Test plan, and the commits from `origin/main..HEAD`.

### Key Discoveries:

- Plan headers follow two patterns: `## Phase N: Name` and `## Phase N — Name` (the commission plan uses em-dash). The skill must handle both.
- `plan.md` does not have a Risks section — risks live in `plan-brief.md` under `## Open Risks & Assumptions`. The skill reads plan-brief.md as the fallback for the Risks section.
- The `## Testing Strategy` section in plan.md uses prose + sub-sections, not a simple bullet list. The skill should use the whole section verbatim.
- Allowed tools must include Read, Bash, and no Edit/Write (output only to stdout).

## What We're NOT Doing

- Not opening a PR automatically
- Not calling the GitHub API or `gh pr create`
- Not verifying branch readiness or CI status
- Not handling missing `context/changes/<id>/` directory (error and stop)
- Not configuring a custom base branch (always `origin/main`)

## Implementation Approach

Write a single `SKILL.md` file that instructs Claude to: parse the argument, read the two context files, run one git command, assemble five output sections, print to stdout, and copy to clipboard. The skill is pure instructions — no code files, no dependencies.

## Phase 1: Write the skill definition

### Overview

Create `.claude/skills/pr-body-generator/SKILL.md` with the full skill specification: argument parsing, file reading, section assembly, output format, and clipboard copy.

### Changes Required:

#### 1. Skill file

**File**: `.claude/skills/pr-body-generator/SKILL.md`

**Intent**: Define the complete behavior of the `/pr-body-generator` skill so Claude can execute it end-to-end from a single read.

**Contract**: The file must include:

- YAML frontmatter with `name`, `description`, `argument-hint`, and `allowed-tools: [Read, Bash]`.
- **Argument Parsing** — same normalization as other 10x skills: strip leading `@`, strip trailing `/`, take last path segment if the token contains `/`. The result is `<change-id>`. If no argument, print usage and STOP.
- **Validation** — check that `context/changes/<change-id>/` exists. If not, print an error and STOP.
- **File reading** — Read `context/changes/<change-id>/change.md` for `title` (frontmatter). Read `context/changes/<change-id>/plan.md` if it exists; if missing, set a `PLAN_MISSING=true` flag.
- **Section assembly** — output begins with a title line, followed by five sections:

  First line (before any `##` heading): `**Suggested PR title:** <title from change.md frontmatter>`

  | Output section | Source |
  |---|---|
  | `## Summary` | `## Overview` body from plan.md. If PLAN_MISSING: `> ⚠ plan.md not found — add summary here.` |
  | `## Changes` | One bullet per `## Phase` block: `- **<Phase heading>** — <first sentence of the ### Overview body>`. If PLAN_MISSING: `> ⚠ plan.md not found — list changes here.` |
  | `## Test plan` | Full `## Testing Strategy` section body from plan.md as-is. If section absent or PLAN_MISSING: `> ⚠ No Testing Strategy found — add test plan here.` |
  | `## Risks` | `## Open Risks & Assumptions` body from plan-brief.md (if present); else same section from plan.md (if present); else `> ⚠ No risks documented — add here.` |
  | `### Commits (origin/main..HEAD)` | Output of `git log --oneline origin/main..HEAD`, formatted as a fenced code block. |

- **Footer**: Append `🤖 Generated with [Claude Code](https://claude.com/claude-code)` at the end.
- **Clipboard copy** — copy the assembled body via `pbcopy 2>/dev/null || clip.exe 2>/dev/null || xclip -selection clipboard 2>/dev/null || true`. Then print `(✓ copied to clipboard)`.
- **What this skill does NOT do** section — matches the intent notes verbatim.

### Success Criteria:

#### Automated Verification:

- Skill file exists: `ls .claude/skills/pr-body-generator/SKILL.md`
- Frontmatter is valid YAML with all required fields: `name`, `description`, `argument-hint`, `allowed-tools`

#### Manual Verification:

- Run `/pr-body-generator i-04-commission` — output contains the commission plan Overview as Summary
- Changes section lists both phases with their Overview sentences
- Test plan section contains the Testing Strategy content from that plan
- Risks section pulls from `i-04-commission` plan-brief.md `## Open Risks & Assumptions`
- Commits block is populated (or shows empty if on main)
- Running with no argument prints usage and stops
- Running with a nonexistent change-id prints an error and stops

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Manual Testing Steps:

1. Run `/pr-body-generator i-04-commission` — verify all five sections appear correctly
2. Run `/pr-body-generator` with no argument — verify usage message is printed
3. Run `/pr-body-generator nonexistent-change` — verify error is printed
4. Pipe output to `gh pr create --body "$(...)"`-style use — confirm the body is clean Markdown

## References

- Skill pattern reference: `.claude/skills/10x-archive/SKILL.md`
- Test change: `context/changes/i-04-commission/` (plan.md + plan-brief.md both present)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Write the skill definition

#### Automated

- [x] 1.1 Skill file exists: `ls .claude/skills/pr-body-generator/SKILL.md`
- [x] 1.2 Frontmatter is valid YAML with required fields

#### Manual

- [x] 1.3 `/pr-body-generator i-04-commission` outputs correct Summary, Changes, Test plan, Risks, Commits
- [x] 1.4 No-argument invocation prints usage and stops
- [x] 1.5 Nonexistent change-id prints error and stops
