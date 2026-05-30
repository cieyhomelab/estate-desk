-- transaction close: S-06 (transaction-close)
-- Adds notary/transaction columns to listings and creates transaction_snapshots table.
create extension if not exists "pgcrypto" with schema extensions;

alter table public.listings
  add column if not exists notary_name text,
  add column if not exists notary_city text,
  add column if not exists transaction_date date,
  add column if not exists transaction_notes text,
  add column if not exists closed_at timestamptz;

create table public.transaction_snapshots (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asking_price numeric(12,2),
  commission_percent numeric(5,2),
  tax_rate numeric(5,2),
  agency_percent numeric(5,2),
  brutto numeric(12,2),
  agency_amount numeric(12,2),
  gross_income numeric(12,2),
  tax_amount numeric(12,2),
  agent_net numeric(12,2),
  notary_name text,
  notary_city text,
  transaction_date date,
  snapshot_at timestamptz not null default pg_catalog.now(),
  voided_at timestamptz
);

alter table public.transaction_snapshots enable row level security;

create policy "owners_own_transaction_snapshots" on public.transaction_snapshots
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Prevents double-submit race: at most one active (voided_at IS NULL) snapshot per listing.
create unique index unique_active_snapshot on public.transaction_snapshots(listing_id) where voided_at is null;
