---
change_id: commission-set-analysis
title: "Analiza przepływu commission/set.ts (trace e2e, luki w testach, blast radius)"
status: archived
created: 2026-06-10
updated: 2026-06-12
archived_at: 2026-06-12T18:40:51Z
---

## Notes

Analysis-only change: deep audit of the commission-setting flow
(`src/pages/api/listings/[id]/commission/set.ts`) — risk zone #1 from
`context/map/repo-map.md`. No implementation intended under this change-id;
findings feed a future test-coverage / hardening change.
