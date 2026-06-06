---
change_id: testing-persistence-data-lifecycle
title: Phase 2 test rollout — persistence and data lifecycle
status: archived
created: 2026-06-02
updated: 2026-06-06
archived_at: 2026-06-06T18:28:09Z
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Persistence + data lifecycle".
Risks covered: #1 (listing data not persisted after create/edit), #4 (completed listing disappears or loses data through close/reopen cycle), #5 (price history incomplete or out of order).
Test types planned: integration (real DB — Supabase).
Risk response intent:
- Risk #1: prove that after API write + reload, all entered fields are retrieved from DB and rendered correctly; challenge that a 200 response equals persisted state; avoid asserting 200 without verifying DB read-back.
- Risk #4: prove that closing a listing persists all fields and that reopen restores status and field parity; challenge that showing in the done view means all fields survived the close transition; avoid testing only the status field and missing commission lock or document state.
- Risk #5: prove that after N price updates, history contains exactly N entries in ascending chronological order with correct values; challenge that entries show in history does not mean they are ordered and nothing was dropped; avoid snapshot-without-meaning by verifying the ordering invariant explicitly.
