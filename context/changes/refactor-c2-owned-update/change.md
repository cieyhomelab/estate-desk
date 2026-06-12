---
change_id: refactor-c2-owned-update
title: Close silent 0-row UPDATE false-success across vulnerable API routes
status: implementing
created: 2026-06-11
updated: 2026-06-12
reviewed: 2026-06-11
archived_at: null
---

## Notes

Candidate C2 from the refactor-opportunities research. The correct pattern already exists
in `update.ts` (`.select()` + `data.length === 0` → error); 4 routes silently dropped it.
The fix restores a known-correct, deliberately designed convention rather than inventing one.
Gated by a characterization test that resolves Open Q1 (runtime RLS behavior on 0-row UPDATE).

Research: `context/changes/refactor-opportunities/research.md#c2`
