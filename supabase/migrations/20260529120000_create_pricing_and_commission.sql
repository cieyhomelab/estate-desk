-- pricing and commission tables: S-03 (pricing-and-commission)
-- Adds commission_settings, price_history, and asking_price column to listings.
create extension if not exists "pgcrypto" with schema extensions;

-- commission_settings: one row per user, upsert-managed
create table commission_settings (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tax_rate numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  agency_percent numeric(5,2) not null default 0 check (agency_percent >= 0 and agency_percent <= 100),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint commission_settings_user_id_unique unique (user_id)
);

alter table commission_settings enable row level security;

create policy "owners_own_commission_settings" on commission_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Reuse handle_updated_at() declared in the first migration (CREATE OR REPLACE).
create trigger handle_commission_settings_updated_at
  before update on commission_settings
  for each row execute function public.handle_updated_at();

-- price_history: append-only; no updated_at, no trigger needed
create table price_history (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  price numeric(12,2) not null check (price > 0),
  set_at timestamptz not null default pg_catalog.now()
);

alter table price_history enable row level security;

create policy "owners_own_price_history" on price_history
  for all
  using (
    exists (
      select 1 from listings
      where listings.id = price_history.listing_id
        and listings.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from listings
      where listings.id = price_history.listing_id
        and listings.user_id = auth.uid()
    )
  );

-- Denormalized current price on listings; null = no price set yet
alter table listings add column asking_price numeric(12,2);
