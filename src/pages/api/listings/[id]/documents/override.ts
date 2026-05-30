import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const id = context.params.id;
  if (!id) {
    return context.redirect(`/dashboard?error=nie-znaleziono`);
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect("/auth/signin");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const override = form.get("override") === "true";

  const { error } = await supabase
    .from("listings")
    .update({ checklist_override: override })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return context.redirect(`/dashboard/listings/${id}/documents?error=blad-zapisu`);
  }

  return context.redirect(`/dashboard/listings/${id}/documents?success=zapisano`);
};
