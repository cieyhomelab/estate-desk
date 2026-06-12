---
change_id: refactor-c1-db-types
title: Generate database.types.ts and replace hand-maintained domain type copies
status: implementing
created: 2026-06-11
updated: 2026-06-12
archived_at: null
---

## Notes

Candidate C1 from the refactor-opportunities research. The Supabase client is untyped
and domain types are hand-mirrored in two files. Additive, fully guarded by `astro check`.
High-leverage: lowers the cost of every future column change.

Research: `context/changes/refactor-opportunities/research.md#c1`
