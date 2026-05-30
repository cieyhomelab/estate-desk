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

  // Intentionally no .select() — idempotent delete, 0-row result is not an error. (documents-and-files plan Phase 2.)
  const { error } = await supabase.from("listing_documents").delete().eq("id", docId).eq("user_id", user.id);

  if (error) {
    return context.redirect(`/dashboard/listings/${id}/documents?error=blad-usuniecia`);
  }

  return context.redirect(`/dashboard/listings/${id}/documents?success=usunieto`);
};
