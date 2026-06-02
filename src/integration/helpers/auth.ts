import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function getAuthCookieHeader(
  email: string,
  password: string,
): Promise<string> {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_KEY!;

  const anonClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { session },
    error,
  } = await anonClient.auth.signInWithPassword({ email, password });
  if (error || !session)
    throw new Error(`getAuthCookieHeader sign-in failed: ${error?.message}`);

  const captured: Array<{ name: string; value: string }> = [];
  const ssrClient = createServerClient(url, key, {
    cookies: {
      getAll: () => captured,
      setAll: (cs) => cs.forEach((c) => captured.push({ name: c.name, value: c.value })),
    },
  });
  await ssrClient.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  return captured.map((c) => `${c.name}=${c.value}`).join("; ");
}
