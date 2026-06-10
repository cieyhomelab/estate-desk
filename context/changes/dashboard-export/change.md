---
change_id: dashboard-export
title: "Eksport CSV z dashboardu"
status: implementing
created: 2026-06-10
updated: 2026-06-10

roadmap_id: S-02
prd_ref: US-02, FR-006
---

Wire the Eksport button on the Dashboard to a client-side CSV download of all listings. The button already lives in the `DashboardListings` React island (from S-01) with no handler; a pure serialization function turns the already-loaded listing array into a semicolon-delimited, BOM-prefixed CSV named `estatedesk-YYYY-MM-DD.csv`. Export always covers all listings regardless of active filters.
