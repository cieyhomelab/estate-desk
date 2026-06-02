import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export interface TestUser {
  userId: string;
  email: string;
  password: string;
}

export async function createTestUser(supabase: SupabaseClient): Promise<TestUser> {
  const email = `e2e+${Date.now()}@test.local`;
  const password = "TestPassword1!";
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createTestUser failed: ${error.message}`);
  return { userId: data.user.id, email, password };
}

export async function getSessionCookies(
  email: string,
  password: string,
): Promise<
  {
    name: string;
    value: string;
    domain: string;
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Lax";
  }[]
> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_KEY must be set to run E2E tests");

  const anonClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { session },
    error,
  } = await anonClient.auth.signInWithPassword({ email, password });
  if (error || !session) throw new Error(`getSessionCookies sign-in failed: ${error?.message}`);

  const captured: { name: string; value: string }[] = [];
  const ssrClient = createServerClient(url, key, {
    cookies: {
      getAll: () => captured,
      setAll: (cs) => {
        cs.forEach((c) => captured.push({ name: c.name, value: c.value }));
      },
    },
  });
  await ssrClient.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  return captured.map((c) => ({
    name: c.name,
    value: c.value,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax" as const,
  }));
}

export async function deleteTestUser(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw new Error(`deleteTestUser failed: ${error.message}`);
}
