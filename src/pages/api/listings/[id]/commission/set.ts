import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const { id } = context.params;
  const supabase = createClient(context.request.headers, context.cookies);

  if (!supabase || !id) {
    return context.redirect(`/dashboard/listings/${id}/pricing?error=blad-serwera`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const commissionRaw = form.get("commission_percent") as string | null;
  const commission_percent = parseFloat(commissionRaw ?? "");

  if (isNaN(commission_percent) || commission_percent <= 0 || commission_percent > 100) {
    return context.redirect(`/dashboard/listings/${id}/pricing?error=prowizja-nieprawidlowa`);
  }

  const { error } = await supabase.from("listings").update({ commission_percent }).eq("id", id).eq("user_id", user.id);

  if (error) {
    return context.redirect(`/dashboard/listings/${id}/pricing?error=blad-zapisu`);
  }

  return context.redirect(`/dashboard/listings/${id}/pricing?success=prowizja-zapisana`);
};
