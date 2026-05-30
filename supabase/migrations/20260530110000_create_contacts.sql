-- contacts table: S-04 (contact-management)
-- Child of listings; subquery RLS ownership through listing_id -> listings.user_id.
-- Append-only: no updated_at column, no trigger.
create extension if not exists "pgcrypto" with schema extensions;

create table contacts (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  role text check (role in ('kupujący', 'najemca')),
  created_at timestamptz not null default pg_catalog.now()
);

alter table contacts enable row level security;

create policy "owners_own_contacts" on contacts
  for all
  using (
    exists (
      select 1 from listings
      where listings.id = contacts.listing_id
        and listings.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from listings
      where listings.id = contacts.listing_id
        and listings.user_id = auth.uid()
    )
  );
