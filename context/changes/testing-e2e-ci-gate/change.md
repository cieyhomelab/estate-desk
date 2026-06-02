---
change_id: testing-e2e-ci-gate
title: E2E tests for full transaction flow and CI gate
status: impl_reviewed
created: 2026-06-02
updated: 2026-06-02
archived_at: null
---

## Notes

Rollout Phase 4 of context/foundation/test-plan.md: "E2E full transaction flow + CI gate".
Risks covered: #1 (Listing data not persisted after create/edit — fields missing or lost on reload), #3 (Document gate allows transaction close with unchecked items and no override active), #4 (Completed listing disappears from dashboard or loses data through the close/reopen cycle). Test types planned: e2e (Playwright), CI.
Risk response intent:
- Risk #1: prove that after create/edit + reload, all entered fields are retrieved from the DB and rendered correctly in the browser; challenge that "UI shows data" ≠ "data was written to DB" — the E2E must verify rendered field values match what was saved, not just that a page loads; avoid implementation mirror (asserting navigation success without verifying DB state or rendered values).
- Risk #3: prove that the close flow is blocked in the UI when the checklist is incomplete and no override is active, and succeeds (navigates forward) when all items are checked or the override is active; challenge that a disabled close button ≠ the API actually blocks — the E2E must drive the full UI flow and confirm the outcome, not only that a button is disabled; avoid happy-path-only testing (never the blocked path).
- Risk #4: prove that a completed listing appears in the dashboard done-state view with all field values intact, and that reopen returns it to active with data unchanged; challenge that "shows in done view" ≠ "all fields persisted through the close transition"; avoid testing only the status field while missing commission lock or document state.
