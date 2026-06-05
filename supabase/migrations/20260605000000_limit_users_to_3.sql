-- Limit total number of auth users to 3.
-- Function lives in public schema (auth schema write-protected on hosted Supabase).
-- Trigger on auth.users fires before each INSERT and aborts when the cap is reached.

create or replace function public.check_user_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from auth.users) >= 3 then
    raise exception 'User limit reached. This application is limited to 3 users.';
  end if;
  return new;
end;
$$;

create trigger enforce_user_limit
  before insert on auth.users
  for each row
  execute function public.check_user_limit();
