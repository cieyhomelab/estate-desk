# Refactor C5: Snapshot CHECK Constraint — Implementation Plan

## Overview

`listings.commission_percent` has a `CHECK (commission_percent > 0 AND commission_percent <= 100)`
constraint (added in `20260530100000`). The snapshot copy in `transaction_snapshots.commission_percent`
has no such constraint — it accepts any `numeric(5,2)` value, including zero and negative numbers.
This is a pure forward migration: one `ALTER TABLE ADD CONSTRAINT`. Zero code changes.

## Current State Analysis

- `supabase/migrations/20260530100000_add_commission_percent_to_listings.sql:3-4` —
  source column has `check (commission_percent > 0 and commission_percent <= 100)`.
- `supabase/migrations/20260530120000_transaction_close.sql:17` —
  snapshot column is bare `commission_percent numeric(5,2)` with no CHECK.
- No application code validates the snapshot column; the route `commission/set.ts:23` validates
  before the `listings` UPDATE but snapshots are written by `close.ts` which copies the current
  `listings.commission_percent` value — already constrained at the source. However, if a
  snapshot is ever inserted directly (service-role, future route, or migration), the constraint
  is absent.
- **Data pre-flight required**: adding a CHECK on an existing table fails if any row already
  violates the constraint. A pre-flight query must confirm zero violations before the migration
  runs.

**Intentionality**: accidental omission — the team adds CHECKs consistently elsewhere (`tax_rate`,
`agency_percent`, `price_history.price`); no record of "snapshots are immutable, so constraints
omitted" in any plan or review. The immutable-snapshot story is plausible but undocumented.

## Desired End State

`transaction_snapshots.commission_percent` has `CHECK (commission_percent > 0 AND commission_percent <= 100)`,
identical to the source column. The DB schema is self-consistent: no path exists to insert a
snapshot with an out-of-range commission value.

### Key Discoveries

- Source constraint: `supabase/migrations/20260530100000_add_commission_percent_to_listings.sql:3-4`
- Target column: `supabase/migrations/20260530120000_transaction_close.sql:17`
- CI migration gate: `supabase db push` in `.github/workflows/ci.yml`
- Last migration timestamp: `20260605000002` → next safe timestamp: `20260611000000`

## What We're NOT Doing

- No code changes — not `commission/set.ts`, not `close.ts`, not any type file.
- No shared validation layer (the code-side C5 part) — deferred per the research ranking.
- No changes to other snapshot columns (`tax_rate`, `agency_percent` have their own constraints already).

---

## Phase 1: Pre-Flight + Migration

### Overview

Run a read-only data-safety query against the production DB to confirm zero existing violations,
then create the migration file and apply it.

### Changes Required

#### 1. Pre-flight data query (manual step before creating the migration)

**Intent**: Confirm that no existing `transaction_snapshots` row has a `commission_percent`
value that would violate the new constraint (i.e., is NULL, or is ≤ 0, or is > 100). If any
violation exists, the migration must not be applied until those rows are resolved.

**Contract**: Run via the Supabase dashboard or `supabase db execute` (service-role):

```sql
SELECT id, listing_id, commission_percent
FROM transaction_snapshots
WHERE commission_percent <= 0
   OR commission_percent > 100;
-- Note: NULLs excluded intentionally — Postgres CHECK passes when the expression
-- evaluates to NULL, so null commission_percent rows are not rejected by the constraint.
```

If the result is zero rows, proceed. If non-zero, stop and document the violating rows — this
plan does not prescribe the remediation (that is a product decision about the snapshot data).

#### 2. New migration file

**File**: `supabase/migrations/20260611000000_transaction_snapshots_commission_check.sql` (new)

**Intent**: Add the CHECK constraint to `transaction_snapshots.commission_percent`, matching
the source constraint on `listings.commission_percent`.

**Contract**:

```sql
-- Align transaction_snapshots.commission_percent constraint with listings.commission_percent
-- Source: supabase/migrations/20260530100000_add_commission_percent_to_listings.sql:4
alter table public.transaction_snapshots
  add constraint transaction_snapshots_commission_percent_check
  check (commission_percent > 0 and commission_percent <= 100);
```

The constraint name follows the Supabase/Postgres naming convention: `<table>_<column>_check`.

### Success Criteria

#### Automated Verification

- Migration applies cleanly to the local Supabase instance: `supabase db push` (or `supabase db reset`)
- CI migration gate passes: `supabase db push` in `ci.yml`

#### Manual Verification

- Pre-flight query returns zero rows (confirmed before creating the migration file).
- After migration: attempt to insert a `transaction_snapshots` row with `commission_percent = 0` via the Supabase dashboard; confirm it is rejected with a CHECK violation.
- After migration: attempt to insert with `commission_percent = 50`; confirm it succeeds.
- `npm run test:integration:api` passes with no regressions.

**Implementation Note**: The pre-flight query is the gate. Do not create the migration file
until the pre-flight returns zero rows. If the pre-flight finds violations, stop and document
them — the migration should not be modified to work around existing data without a product
decision.

---

## Testing Strategy

### Migration Test

- `supabase db push` on a fresh local instance.
- Constraint violation insert: `commission_percent = 0` → rejected.
- Valid insert: `commission_percent = 50` → accepted.

### Manual Testing Steps

1. Run the pre-flight query; confirm zero violations.
2. Apply the migration to the local instance.
3. Test valid and invalid inserts via Supabase dashboard SQL editor.
4. Run `npm run test:integration:api` to confirm no existing tests break.

## Migration Notes

Reversible via a drop-constraint migration:
```sql
alter table public.transaction_snapshots
  drop constraint transaction_snapshots_commission_percent_check;
```

## References

- Research: `context/changes/refactor-opportunities/research.md`
- Source constraint: `supabase/migrations/20260530100000_add_commission_percent_to_listings.sql:3-4`
- Target table definition: `supabase/migrations/20260530120000_transaction_close.sql:12-30`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Pre-Flight + Migration

#### Automated

- [ ] 1.1 Migration applies cleanly: `supabase db push`
- [ ] 1.2 CI migration gate passes

#### Manual

- [ ] 1.3 Pre-flight query returns zero rows (confirmed before migration file created)
- [ ] 1.4 commission_percent = 0 insert rejected by CHECK constraint
- [ ] 1.5 commission_percent = 50 insert accepted
- [ ] 1.6 npm run test:integration:api passes
