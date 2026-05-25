import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const id = context.params.id;
  if (!id) {
    return context.redirect(`/dashboard?error=${encodeURIComponent("Brak identyfikatora ogłoszenia")}`);
  }

  const form = await context.request.formData();
  const type = (form.get("type") as string | null) ?? "";
  const address = ((form.get("address") as string | null) ?? "").trim();
  const owner_name = ((form.get("owner_name") as string | null) ?? "").trim() || null;
  const owner_phone = ((form.get("owner_phone") as string | null) ?? "").trim() || null;
  const owner_email = ((form.get("owner_email") as string | null) ?? "").trim() || null;

  if (!["sale", "occasional-rental"].includes(type)) {
    return context.redirect(
      `/dashboard/listings/${id}/edit?error=${encodeURIComponent("Nieprawidłowy typ ogłoszenia")}`,
    );
  }
  if (!address) {
    return context.redirect(`/dashboard/listings/${id}/edit?error=${encodeURIComponent("Adres jest wymagany")}`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/dashboard?error=${encodeURIComponent("Błąd konfiguracji bazy danych")}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const { data, error } = await supabase
    .from("listings")
    .update({ type, address, owner_name, owner_phone, owner_email })
    .eq("id", id)
    .eq("user_id", user.id)
    .select();

  if (error) {
    return context.redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  if (data.length === 0) {
    return context.redirect(`/dashboard?error=${encodeURIComponent("Ogłoszenie nie zostało znalezione")}`);
  }

  return context.redirect("/dashboard");
};
