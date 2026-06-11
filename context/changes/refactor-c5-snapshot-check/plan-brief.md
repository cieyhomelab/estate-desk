# Refactor C5: Snapshot CHECK Constraint — Plan Brief

> Full plan: `context/changes/refactor-c5-snapshot-check/plan.md`
> Research: `context/changes/refactor-opportunities/research.md`

## What & Why

`listings.commission_percent` has a `CHECK (> 0 AND ≤ 100)` constraint. The snapshot copy in
`transaction_snapshots.commission_percent` has no such constraint — it accepts any numeric value
including zero and negatives. The team adds CHECKs consistently elsewhere; no plan or review
records a deliberate reason for the omission. This is an accidental oversight: one forward
migration closes it.

## Starting Point

Source constraint in `supabase/migrations/20260530100000:3-4`. Snapshot column in
`supabase/migrations/20260530120000:17` — bare `numeric(5,2)`, no CHECK. Zero code paths write
a violating value today (the source `listings.commission_percent` is already constrained before
close), but the constraint absence means future direct inserts could silently store bad data.

## Desired End State

`transaction_snapshots.commission_percent` has `CHECK (commission_percent > 0 AND
commission_percent <= 100)`, identical to the source column. Schema is self-consistent.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
|---|---|---|---|
| DB part only | Yes — no code unification | The code-side unification (shared validator) is heavier and lower-severity; the DB gap is the atom worth closing now | Research |
| Pre-flight first | Required before migration | Adding a CHECK fails if existing rows violate it; pre-flight is the safety gate | Plan |
| Reversibility | Drop-constraint migration | Standard Postgres; documented in the plan | Plan |

## Scope

**In scope:**
- Pre-flight service-role query (zero violations required)
- One migration: `ALTER TABLE transaction_snapshots ADD CONSTRAINT … CHECK`

**Out of scope:**
- Code-side shared validator (C5 deferred part)
- Any other `transaction_snapshots` columns

## Architecture / Approach

Single phase: pre-flight data query, then create and apply the migration. The constraint name
follows the `<table>_<column>_check` convention.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Pre-Flight + Migration | CHECK constraint on transaction_snapshots.commission_percent | Existing rows violate the constraint — pre-flight catches this; plan stops if found |

**Prerequisites:** Local Supabase running; service-role access for pre-flight query.
**Estimated effort:** < 1 session (30-60 min if pre-flight is clean).

## Open Risks & Assumptions

- **If any existing snapshot row has a null or out-of-range `commission_percent`, the migration cannot apply.** The pre-flight query is the gate; if it finds violations, this plan stops and a product decision is required.
- The `commission_percent` column on `transaction_snapshots` is nullable (`numeric(5,2)` without `NOT NULL`); the CHECK does not enforce non-null, so null values are allowed by the constraint (consistent with the source column).

## Success Criteria (Summary)

- Pre-flight query returns zero rows.
- `commission_percent = 0` insert rejected by the new CHECK constraint.
- `commission_percent = 50` insert accepted.
- CI migration gate passes.
