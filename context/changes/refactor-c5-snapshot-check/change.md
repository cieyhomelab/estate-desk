---
change_id: refactor-c5-snapshot-check
title: Add CHECK constraint on transaction_snapshots.commission_percent
status: planned
created: 2026-06-11
updated: 2026-06-11
archived_at: null
---

## Notes

Candidate C5 (DB part) from the refactor-opportunities research. The source column
`listings.commission_percent` has a CHECK (> 0, <= 100); the snapshot copy does not.
Pure forward migration — zero code changes. Data-contingent: pre-flight query required.

Research: `context/changes/refactor-opportunities/research.md#c5`
