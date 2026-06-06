import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/?error=${encodeURIComponent("Supabase is not configured")}&mode=signup`);
  }
  const origin = context.url.origin;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm-email` },
  });

  if (error) {
    const message = error.message.toLowerCase().includes("database error")
      ? "Registration is closed. This application is limited to 3 users."
      : error.message;
    return context.redirect(`/?error=${encodeURIComponent(message)}&mode=signup`);
  }

  return context.redirect("/auth/confirm-email");
};
