---
change_id: refactor-c3-flash-messages
title: Introduce shared flash-slug → message map and migrate all render sites
status: planned
created: 2026-06-11
updated: 2026-06-11
archived_at: null
---

## Notes

Candidate C3 from the refactor-opportunities research. 5 render sites hand-roll slug→message
mappings with 4 different patterns; one known wrong-message bug (commission error shows price
text on pricing.astro). Emitter routes (slugs as wire contract) are untouched.
Includes adding flash-text assertions to close the existing weak e2e guard.

Research: `context/changes/refactor-opportunities/research.md#c3`
