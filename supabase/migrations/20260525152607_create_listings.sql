-- listings table: core entity for S-02 (listing-crud)
-- Downstream slices (S-03..S-06) add foreign keys to this table.
create table listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('sale', 'occasional-rental')),
  status text not null default 'active' check (status in ('active', 'done')),
  address text not null,
  owner_name text,
  owner_phone text,
  owner_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row-level security: each agent only sees and mutates their own listings
alter table listings enable row level security;

create policy "owners_own_listings" on listings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at on every row mutation.
-- CREATE OR REPLACE makes this idempotent; later migrations reuse the function.
create or replace function handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_updated_at
  before update on listings
  for each row execute function handle_updated_at();
