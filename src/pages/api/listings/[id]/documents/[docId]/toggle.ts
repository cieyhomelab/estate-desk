import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const { id, docId } = context.params;
  if (!id || !docId) {
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
  const checked = form.get("checked") === "true";

  const { data, error } = await supabase
    .from("listing_documents")
    .update({ is_checked: checked })
    .eq("id", docId)
    .eq("user_id", user.id)
    .select();

  if (error) {
    return context.redirect(`/dashboard/listings/${id}/documents?error=blad-zapisu`);
  }

  if (data.length === 0) {
    return context.redirect(`/dashboard/listings/${id}/documents?error=nie-znaleziono`);
  }

  return context.redirect(`/dashboard/listings/${id}/documents`);
};
