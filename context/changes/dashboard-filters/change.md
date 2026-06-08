---
change_id: dashboard-filters
title: "Filtry na dashboardzie"
status: implementing
created: 2026-06-08
updated: 2026-06-08
roadmap_id: S-01
prd_ref: US-01, FR-001, FR-002, FR-003, FR-004, FR-005
---

Wire up the Filtry button on the Dashboard to a live filter bar that narrows the listing list client-side by status, price range, and city (matched against `address`). The static Astro listing loop becomes a React island (`client:load`).
