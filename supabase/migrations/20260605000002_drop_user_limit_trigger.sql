-- Remove the user-limit trigger from auth.users.
-- GoTrue uses the same DB role (supabase_auth_admin) for both public signup
-- and the admin API, so the trigger cannot distinguish between them and blocks
-- test helpers that use auth.admin.createUser with the service-role key.
-- Enforcement lives in src/pages/api/auth/signup.ts (is_registration_open RPC).

drop trigger if exists enforce_user_limit on auth.users;
drop function if exists public.check_user_limit();
