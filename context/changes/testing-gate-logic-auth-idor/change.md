---
change_id: testing-gate-logic-auth-idor
title: Phase 3 test rollout — gate logic, auth boundary, and IDOR
status: implemented
created: 2026-06-02
updated: 2026-06-02
archived_at: null
---

## Notes

Open a change folder for rollout Phase 3 of context/foundation/test-plan.md: "Gate logic + auth boundary + IDOR".
Risks covered: #3 (document gate blocks close with incomplete checklist + no override), #6 (personal data accessible without valid session), #7 (IDOR — authenticated user B can access user A's listing/contact data).
Test types planned: integration (real DB + session).
Risk response intent:
- Risk #3: prove the document gate rejects a POST close with incomplete checklist and no active override; prove it accepts with all items checked OR override active; API-level enforcement only (not UI gating).
- Risk #6: prove unauthenticated GET to listing/contact detail API returns 401 or redirect; every protected route independently validates session.
- Risk #7: prove a request to listing/contact API with a valid session but mismatched owner returns 403 or 404, not the resource (ownership check separate from auth check).
