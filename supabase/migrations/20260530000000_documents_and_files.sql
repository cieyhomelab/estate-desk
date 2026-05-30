-- documents and files: S-05 (documents-and-files)
-- Adds checklist_override to listings, creates listing_documents, listing_files,
-- listing_photos tables with RLS, seeds default checklist via trigger, and
-- provisions two Supabase Storage buckets.
create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- listings: add checklist_override gate for S-06
-- ---------------------------------------------------------------------------
alter table public.listings add column if not exists checklist_override boolean not null default false;

-- ---------------------------------------------------------------------------
-- listing_documents: editable per-listing document checklist
-- ---------------------------------------------------------------------------
create table public.listing_documents (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (char_length(label) >= 1 and char_length(label) <= 500),
  is_checked boolean not null default false,
  is_default boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default pg_catalog.now()
);

alter table public.listing_documents enable row level security;

create policy "owners_own_listing_documents" on public.listing_documents
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- listing_files: uploaded document files (private bucket)
-- ---------------------------------------------------------------------------
create table public.listing_files (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  created_at timestamptz not null default pg_catalog.now()
);

alter table public.listing_files enable row level security;

create policy "owners_own_listing_files" on public.listing_files
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- listing_photos: uploaded listing photos (public bucket)
-- ---------------------------------------------------------------------------
create table public.listing_photos (
  id uuid primary key default extensions.gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  created_at timestamptz not null default pg_catalog.now()
);

alter table public.listing_photos enable row level security;

create policy "owners_own_listing_photos" on public.listing_photos
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- seed_listing_documents: fires AFTER INSERT on listings to populate default
-- checklist items based on listing type.
-- SET search_path = '' + fully-qualified names per lessons.md rules 1 & 6.
-- ---------------------------------------------------------------------------
create or replace function public.seed_listing_documents()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.type = 'sale' then
    insert into public.listing_documents (listing_id, user_id, label, is_checked, is_default, position)
    values
      (new.id, new.user_id, 'Akt własności / umowa nabycia',                        false, true, 1),
      (new.id, new.user_id, 'Odpis z Księgi Wieczystej',                             false, true, 2),
      (new.id, new.user_id, 'Zaświadczenie o niezaleganiu z opłatami',               false, true, 3),
      (new.id, new.user_id, 'Wypis z rejestru gruntów / kartoteki lokali',           false, true, 4),
      (new.id, new.user_id, 'Wyrys z mapy ewidencyjnej',                             false, true, 5),
      (new.id, new.user_id, 'Zaświadczenie o liczbie zameldowanych osób',            false, true, 6),
      (new.id, new.user_id, 'Zaświadczenie spółdzielni (jeśli dotyczy)',             false, true, 7),
      (new.id, new.user_id, 'Rzut / plan lokalu',                                    false, true, 8);
  elsif new.type = 'occasional-rental' then
    insert into public.listing_documents (listing_id, user_id, label, is_checked, is_default, position)
    values
      (new.id, new.user_id, 'Umowa najmu okazjonalnego',                                              false, true, 1),
      (new.id, new.user_id, 'Oświadczenie najemcy o poddaniu się egzekucji (akt notarialny)',         false, true, 2),
      (new.id, new.user_id, 'Oświadczenie najemcy o adresie zastępczym',                              false, true, 3),
      (new.id, new.user_id, 'Zgoda właściciela lokalu zastępczego',                                   false, true, 4),
      (new.id, new.user_id, 'Dowód tytułu prawnego wynajmującego (KW lub akt własności)',             false, true, 5);
  end if;
  return new;
end;
$$;

create trigger seed_listing_documents_on_insert
  after insert on public.listings
  for each row execute function public.seed_listing_documents();

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('listing-photos',    'listing-photos',    true,  10485760),
  ('listing-documents', 'listing-documents', false, 10485760)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Storage RLS: listing-photos (public bucket)
-- First path segment is user_id → split_part(name, '/', 1) = auth.uid()::text
-- ---------------------------------------------------------------------------
create policy "listing_photos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "listing_photos_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'listing-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "listing_photos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Storage RLS: listing-documents (private bucket)
-- ---------------------------------------------------------------------------
create policy "listing_documents_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'listing-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "listing_documents_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'listing-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );

create policy "listing_documents_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'listing-documents'
    and split_part(name, '/', 1) = auth.uid()::text
  );
