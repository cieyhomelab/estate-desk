-- Align transaction_snapshots.commission_percent constraint with listings.commission_percent
-- Mirrors constraint added in 20260530100000_add_commission_percent_to_listings.sql
alter table public.transaction_snapshots
  add constraint transaction_snapshots_commission_percent_check
  check (commission_percent > 0 and commission_percent <= 100);
