# CI/CD AI Code Review Implementation Plan

## Overview

Add a GitHub Actions workflow that runs AI-powered code review on every PR to main. The existing `packages/code-reviewer` package already has the ToolLoopAgent wiring; it needs its schema, prompt, and entry point updated to match the 6-criterion review shape. A composite action encapsulates the review steps; the main workflow stays thin.

## Current State Analysis

The `packages/code-reviewer` package is functional but built for a different shape: `reviewCode(code: string)` accepts raw code and returns `{ summary, issues[], approved: boolean }` with a generic one-sentence prompt. The existing `ci.yml` has no review step. `OPENROUTER_API_KEY` is absent from repo secrets. No `ai-cr:*` labels exist in the repo. No composite action pattern exists in `.github/`.

`packages/code-reviewer` has no `package-lock.json` (only `skills-lock.json`, which is not npm's lock file), so CI must use `npm install` until a lock file is committed.

### Key Discoveries

- `packages/code-reviewer/src/schema.ts:3-13` — current schema has `approved: boolean`; needs full replacement with 6-criterion structure
- `packages/code-reviewer/src/prompt.ts:1-2` — one-sentence prompt; needs full rewrite with per-criterion rubrics
- `packages/code-reviewer/src/agent.ts:9` — `reviewCode(code: string)` signature must change to accept `{ diff, prTitle, prBody? }`
- `packages/code-reviewer/src/index.ts:1-21` — hardcoded sample code; must read from env vars for CI invocation
- `packages/code-reviewer/package.json` — no lock file; composite action must `npm install` until one is committed
- `.github/workflows/ci.yml:1-83` — three existing jobs (ci, deploy, migrate); code-review workflow is separate, not a new job in ci.yml
- No `.github/actions/` directory exists yet

## Desired End State

Every PR to main receives an automated AI code review comment with scores for 6 criteria, a summary, and an overall pass/fail determination. The PR is labeled `ai-cr:passed` (overall_score ≥ 7) or `ai-cr:failed`. Adding `ai-cr:review` re-triggers the review for any PR.

**Verification**: Open a PR to main, observe the `code-review` workflow run, confirm a PR comment appears with a criteria table and the correct label is applied. Add `ai-cr:review` label to an existing PR and confirm re-run.

### Key Discoveries

- Pass/fail: `passed = overall_score >= 7` (computed deterministically in the Node script, not delegated to the model)
- PR body: always included in the prompt alongside title and diff
- Diff truncation: first 4000 lines; truncation notice added to PR comment if triggered
- Model: `anthropic/claude-sonnet-4-5` via OpenRouter (no change from current package)
- Labels: created idempotently in the composite action on each run

## What We're NOT Doing

- Not modifying the existing `ci.yml` (code review is a separate workflow)
- Not adding automated tests to `packages/code-reviewer` (out of scope)
- Not implementing business alignment or architectural fit criteria (parked in requirements)
- Not setting up `OPENROUTER_API_KEY` in repo secrets (manual prerequisite; documented below)
- Not changing the LLM provider (stays on OpenRouter)
- Not blocking PR merge on review result (informational only — labels + comment, no required status check)

## Implementation Approach

Two phases in dependency order: first update the package (Phase 1) so the composite action has something correct to invoke; then create the GitHub Actions infrastructure (Phase 2 + Phase 3).

The composite action is the unit of encapsulation: it handles everything review-related (Node setup, build, diff computation, truncation, LLM call, comment formatting, labeling). The main workflow handles only trigger/guard logic and checkout.

Diff is computed inside the composite action via `git diff origin/main...HEAD` after the main workflow fetches origin/main. PR comment is generated with Python 3 (available on ubuntu-latest) from the JSON output, avoiding fragile bash string manipulation.

## Critical Implementation Details

**No package-lock.json**: `packages/code-reviewer` has no lock file. Phase 1 must run `npm install` in that directory and commit the resulting `package-lock.json`. The composite action should then use `npm ci --prefix packages/code-reviewer` for reproducible installs.

**`passed` is computed by the script, not the model**: Do NOT add `passed` to the Zod schema fed to the model — it is a post-parse computed field added only in `index.ts` (`CIReviewOutput = ReviewOutput & { passed: boolean }`). Including it in `reviewSchema` would instruct the model to set it, undermining the deterministic threshold logic. The entry point computes `passed = output.overall_score >= 7` after `reviewCode` resolves, then augments the output before writing JSON to stdout. See Phase 1 schema and CLI entry point changes.

**Composite action inputs cannot pass large strings safely via GitHub expressions**: `${{ github.event.pull_request.body }}` is fine (body is small). The diff is computed inside the composite action — not passed as an input — to avoid env var size limits on large diffs.

---

## Phase 1: Update packages/code-reviewer

### Overview

Replace the schema, system prompt, agent signature, and CLI entry point so the package can be invoked by CI with PR context and emit structured 6-criterion output.

### Changes Required

#### 1. Schema

**File**: `packages/code-reviewer/src/schema.ts`

**Intent**: Replace the current `approved: boolean` schema with a 6-criterion structure. `passed` is not part of the model output schema — it is added by `index.ts` post-parse.

**Contract**:
```ts
// criterionSchema — one object per criterion
z.object({
  name: z.enum(["implementation_correctness", "idiomaticity", "complexity",
                "test_risk_coverage", "documentation", "security_safety"]),
  score: z.number().int().min(1).max(10),
  rationale: z.string(),
  issues: z.array(z.string()).optional(),
})

// reviewSchema — model output (no `passed` field)
z.object({
  summary: z.string(),
  criteria: z.array(criterionSchema).length(6),
  overall_score: z.number().int().min(1).max(10),
})

// CIReviewOutput — augmented with passed; used only by index.ts
type CIReviewOutput = ReviewOutput & { passed: boolean }
```

Export both `reviewSchema` and `ReviewOutput`.

#### 2. System prompt

**File**: `packages/code-reviewer/src/prompt.ts`

**Intent**: Replace the one-sentence generic prompt with a structured system prompt that names all 6 criteria, their 1-point anchors, and their 10-point anchors verbatim from the requirements, and instructs the model to score each on 1–10 then provide an overall_score.

**Contract**: Export `SYSTEM_PROMPT: string`. The prompt must include:
- Instruction to evaluate all 6 criteria in the `criteria` array
- Per-criterion rubric matching the requirements text exactly (1-anchor and 10-anchor for each)
- Instruction to set `overall_score` as a holistic 1–10 score across all criteria
- Instruction that `issues` inside each criterion is optional and only needed when score ≤ 6

#### 3. Agent signature

**File**: `packages/code-reviewer/src/agent.ts`

**Intent**: Change the function signature to accept PR context instead of a raw code string. The user prompt passed to the model must frame the input as a PR diff with title and optional body.

**Contract**:
```ts
export async function reviewCode(params: {
  diff: string;
  prTitle: string;
  prBody?: string;
}): Promise<ReviewOutput>
```

User prompt template (include in `agent.generate` call):
```
PR title: {prTitle}
{PR body: {prBody}\n\n (omit if prBody is empty)}
Review the following git diff:

{diff}
```

#### 4. CLI entry point

**File**: `packages/code-reviewer/src/index.ts`

**Intent**: Replace the hardcoded sample code with environment variable reading so the script can be invoked by CI. `passed` is computed here (not by the model).

**Contract**: Read `PR_TITLE` (required), `PR_BODY` (optional, default `""`), `DIFF_FILE` (required — path to a file containing the diff). Exit with code 1 and a message on stderr if required vars are missing. After `reviewCode` resolves, augment the output with `passed: output.overall_score >= 7` and write `JSON.stringify(augmented)` to stdout. Keep `import "dotenv/config"` for local dev support.

#### 5. Lock file

**File**: `packages/code-reviewer/package-lock.json`

**Intent**: Generate and commit the npm lock file so the composite action can use `npm ci` for reproducible installs.

**Contract**: Run `npm install` inside `packages/code-reviewer/` locally and commit the resulting `package-lock.json`. No code change — file generation only.

### Success Criteria

#### Automated Verification

- TypeScript compiles without errors: `npm run typecheck --prefix packages/code-reviewer`
- Build succeeds: `npm run build --prefix packages/code-reviewer`
- Smoke test (local, requires `OPENROUTER_API_KEY` in `.env`): `DIFF_FILE=<any .diff> PR_TITLE="test" npm start --prefix packages/code-reviewer` emits JSON with `criteria` array of length 6, `overall_score`, and `passed`

#### Manual Verification

- JSON output contains all 6 criterion names from the enum
- `passed` is `true` when `overall_score >= 7`, `false` otherwise (verify with a known-bad diff)
- `package-lock.json` is committed and `npm ci --prefix packages/code-reviewer` succeeds in a fresh checkout

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Composite Action

### Overview

Create `.github/actions/ai-code-review/action.yml`. This action encapsulates all review steps from label creation through result labeling. The main workflow calls it with PR metadata; it handles Node setup, diff computation, LLM invocation, comment posting, and label management.

### Changes Required

#### 1. Composite action definition

**File**: `.github/actions/ai-code-review/action.yml` (new file)

**Intent**: Self-contained composite action. The main workflow only needs to checkout the repo and call this action.

**Contract** — inputs:
```yaml
inputs:
  pr-number:    required: true
  pr-title:     required: true
  pr-body:      required: false, default: ''
  openrouter-api-key: required: true
  github-token: required: true
```

Steps in order (all `shell: bash` unless noted):

**Step: Ensure labels exist**
```bash
gh label create "ai-cr:review" --color "CCCCCC" --description "Trigger AI code review" --force
gh label create "ai-cr:passed" --color "0E8A16" --description "AI code review passed" --force
gh label create "ai-cr:failed" --color "D93F0B" --description "AI code review failed" --force
```
Set `GH_TOKEN: ${{ inputs.github-token }}`.

**Step: Setup Node.js** — `uses: actions/setup-node@v6` with `node-version: 22`.

**Step: Install dependencies**
```bash
npm ci --prefix packages/code-reviewer
```
(Requires `package-lock.json` from Phase 1. Change to `npm install` only if lock file is missing.)

**Step: Build code reviewer**
```bash
npm run build --prefix packages/code-reviewer
```

**Step: Compute and truncate diff** (id: `diff`)
```bash
git diff origin/main...HEAD > /tmp/pr-full.diff
LINE_COUNT=$(wc -l < /tmp/pr-full.diff)
if [ "$LINE_COUNT" -gt 4000 ]; then
  head -n 4000 /tmp/pr-full.diff > /tmp/pr.diff
  echo "truncated=true" >> "$GITHUB_OUTPUT"
else
  cp /tmp/pr-full.diff /tmp/pr.diff
  echo "truncated=false" >> "$GITHUB_OUTPUT"
fi
echo "line_count=$LINE_COUNT" >> "$GITHUB_OUTPUT"
```

**Step: Run code reviewer**
```bash
cd packages/code-reviewer
node dist/index.js > /tmp/review-output.json
```
Env vars: `OPENROUTER_API_KEY: ${{ inputs.openrouter-api-key }}`, `PR_TITLE: ${{ inputs.pr-title }}`, `PR_BODY: ${{ inputs.pr-body }}`, `DIFF_FILE: /tmp/pr.diff`.

Stderr from the node process surfaces automatically in the Actions log.

**Step: Post PR comment** — use Python 3 to build the comment from `/tmp/review-output.json`, then call `gh pr comment`. Set `GH_TOKEN: ${{ inputs.github-token }}`.

The Python script reads the JSON, maps criterion enum names to display names (e.g., `implementation_correctness` → `Implementation Correctness`), formats a markdown table, appends a truncation warning if `steps.diff.outputs.truncated == 'true'`, and writes the full comment to `/tmp/review-comment.md`. Then: `gh pr comment ${{ inputs.pr-number }} --body-file /tmp/review-comment.md`.

**Pipe-character escaping**: Before inserting any model-generated text (`rationale`, `issues` strings) into table cells, replace all `|` with `\|` to prevent GFM table breakage (e.g., `text.replace('|', r'\|')`).

Comment structure:
```
## AI Code Review — ✅ Passed (8/10)  [or ❌ Failed]

> Reviewed by `claude-sonnet-4-5` via OpenRouter

**Summary**: {summary}

### Criteria Scores

| Criterion               | Score  | Notes |
|-------------------------|--------|-------|
| Implementation Correctness | 9/10 | ... |
...

[⚠️ Diff truncated to 4000 lines (original: N lines). Review may be incomplete.]

---
*Re-trigger: add label `ai-cr:review`*
```

**Step: Apply result label** — Set `GH_TOKEN: ${{ inputs.github-token }}`.
```bash
PASSED=$(jq -r '.passed' /tmp/review-output.json)
if [ "$PASSED" = "true" ]; then
  gh pr edit ${{ inputs.pr-number }} --add-label "ai-cr:passed"
  gh pr edit ${{ inputs.pr-number }} --remove-label "ai-cr:failed" 2>/dev/null || true
else
  gh pr edit ${{ inputs.pr-number }} --add-label "ai-cr:failed"
  gh pr edit ${{ inputs.pr-number }} --remove-label "ai-cr:passed" 2>/dev/null || true
fi
```
The `|| true` on remove calls prevents failure when the opposite label is not currently applied.

**Step: Remove review trigger label** — Set `GH_TOKEN: ${{ inputs.github-token }}`.
```bash
gh pr edit ${{ inputs.pr-number }} --remove-label "ai-cr:review" 2>/dev/null || true
```

### Success Criteria

#### Automated Verification

- `action.yml` is valid YAML (lint locally: `yamllint .github/actions/ai-code-review/action.yml`)
- All steps reference `shell: bash` (composite actions require explicit shell declaration)

#### Manual Verification

- Action can be called from a test workflow and all steps execute without error
- Labels `ai-cr:review`, `ai-cr:passed`, `ai-cr:failed` appear in the repo after first run
- PR comment appears with all 6 criteria, correct pass/fail status, and no raw enum names (display names only)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Main Workflow

### Overview

Create `.github/workflows/code-review.yml`. A thin orchestrator: guard/trigger logic, checkout, fetch origin/main, call composite action.

### Changes Required

#### 1. Workflow file

**File**: `.github/workflows/code-review.yml` (new file)

**Intent**: Trigger on PRs to main (open/sync/reopen/label) and delegate all review work to the composite action. Skip runs when a non-`ai-cr:review` label is applied.

**Contract**:

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened, labeled]
    branches: [main]

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  code-review:
    runs-on: ubuntu-latest
    if: |
      github.event.action != 'labeled' ||
      github.event.label.name == 'ai-cr:review'
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0

      - name: Fetch main branch
        run: git fetch origin main

      - uses: ./.github/actions/ai-code-review
        with:
          pr-number: ${{ github.event.pull_request.number }}
          pr-title: ${{ github.event.pull_request.title }}
          pr-body: ${{ github.event.pull_request.body || '' }}
          openrouter-api-key: ${{ secrets.OPENROUTER_API_KEY }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

`fetch-depth: 0` is required so `git diff origin/main...HEAD` in the composite action has access to full history. `git fetch origin main` ensures the `origin/main` ref exists on the runner.

### Success Criteria

#### Automated Verification

- Workflow file is valid YAML (`yamllint .github/workflows/code-review.yml`)
- `act` dry-run (if available locally): `act pull_request -n` shows the `code-review` job

#### Manual Verification

- Open a PR to main → workflow triggers → PR receives comment + label within 2 minutes
- Merge nothing, add `ai-cr:review` label to existing PR → workflow re-triggers → new comment posted, `ai-cr:review` label removed after run
- Apply an unrelated label (e.g., `enhancement`) → workflow does NOT trigger a review run
- Verify `OPENROUTER_API_KEY` is set in repo Settings → Secrets → Actions before testing

---

## Testing Strategy

### Unit Tests

Not in scope for this change (no test suite in `packages/code-reviewer`).

### Integration Tests

- Phase 1 smoke test: invoke `node dist/index.js` locally with a real diff file and verify JSON output shape matches the new schema
- Phase 3 end-to-end: open a real PR to main; observe full workflow run

### Manual Testing Steps

1. Create a branch with a known issue (off-by-one, missing null check) and open a PR
2. Confirm `implementation_correctness` scores ≤ 6 and `passed: false`
3. Fix the issue and push — synchronize event should re-trigger review
4. Confirm score improves and `passed: true` (if overall ≥ 7)
5. Add `ai-cr:review` label manually — confirm re-run and label removal

## Migration Notes

**Manual prerequisite**: Add `OPENROUTER_API_KEY` to repo Settings → Secrets → Actions before merging this change. The workflow will fail silently (Node process exits 1) without it.

The three `ai-cr:*` labels are created idempotently on first workflow run. No manual repo setup required for labels.

## References

- Requirements: `context/changes/ci-cd-code-review/requirements.md`
- Research: `context/changes/ci-cd-code-review/research.md`
- Current package schema: `packages/code-reviewer/src/schema.ts:3-13`
- Current agent: `packages/code-reviewer/src/agent.ts:9-23`
- Existing CI: `.github/workflows/ci.yml`

---

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Update packages/code-reviewer

#### Automated

- [x] 1.1 TypeScript compiles without errors (`npm run typecheck --prefix packages/code-reviewer`)
- [x] 1.2 Build succeeds (`npm run build --prefix packages/code-reviewer`)
- [x] 1.3 Smoke test emits JSON with criteria array of length 6, overall_score, and passed

#### Manual

- [ ] 1.4 `passed` is `true` when `overall_score >= 7`, `false` otherwise
- [ ] 1.5 `package-lock.json` committed and `npm ci --prefix packages/code-reviewer` succeeds

### Phase 2: Composite Action

#### Automated

- [ ] 2.1 `action.yml` passes YAML lint
- [ ] 2.2 All steps include `shell: bash`

#### Manual

- [ ] 2.3 Action can be called from a test workflow and all steps execute without error
- [ ] 2.4 Labels `ai-cr:review`, `ai-cr:passed`, `ai-cr:failed` appear in repo after first run
- [ ] 2.5 PR comment appears with all 6 criteria using display names (no raw enum strings)

### Phase 3: Main Workflow

#### Automated

- [ ] 3.1 `code-review.yml` passes YAML lint

#### Manual

- [ ] 3.2 PR to main triggers review → comment + label within 2 minutes
- [ ] 3.3 Adding `ai-cr:review` label re-triggers review and removes the label after run
- [ ] 3.4 Adding an unrelated label does NOT trigger a review run
