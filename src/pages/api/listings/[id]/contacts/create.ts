import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

const VALID_ROLES = ["kupujący", "najemca"];

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect("/dashboard?error=blad-konfiguracji");
  }

  const { id } = context.params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return context.redirect("/auth/signin");
  }

  const formData = await context.request.formData();

  const nameRaw = formData.get("name");
  const name = typeof nameRaw === "string" ? nameRaw.trim() : "";
  if (name === "") {
    return context.redirect(`/dashboard/listings/${id}/contacts?error=nazwa-wymagana`);
  }

  const phoneRaw = formData.get("phone");
  const phone = typeof phoneRaw === "string" && phoneRaw.trim() !== "" ? phoneRaw.trim() : null;

  const emailRaw = formData.get("email");
  const email = typeof emailRaw === "string" && emailRaw.trim() !== "" ? emailRaw.trim() : null;

  const roleRaw = formData.get("role");
  const roleTrimmed = typeof roleRaw === "string" ? roleRaw.trim() : "";
  let role: string | null = null;
  if (roleTrimmed !== "") {
    if (!VALID_ROLES.includes(roleTrimmed)) {
      return context.redirect(`/dashboard/listings/${id}/contacts?error=rola-nieprawidlowa`);
    }
    role = roleTrimmed;
  }

  // RLS enforces ownership at the DB level via the listing_id subquery policy.
  const { error: insertError } = await supabase.from("contacts").insert({ listing_id: id, name, phone, email, role });

  if (insertError) {
    return context.redirect(`/dashboard/listings/${id}/contacts?error=blad-zapisu`);
  }

  return context.redirect(`/dashboard/listings/${id}/contacts`);
};
