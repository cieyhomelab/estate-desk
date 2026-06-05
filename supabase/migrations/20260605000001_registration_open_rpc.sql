-- Public RPC: returns true when registration is still open (< 3 users).
-- Called by the signup API route to return a friendly error before the DB trigger fires.

create or replace function public.is_registration_open()
returns boolean
language sql
security definer
set search_path = public
as $$
  select count(*) < 3 from auth.users;
$$;

grant execute on function public.is_registration_open() to anon, authenticated;
