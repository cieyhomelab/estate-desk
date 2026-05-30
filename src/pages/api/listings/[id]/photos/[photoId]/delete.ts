import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const { id, photoId } = context.params;
  if (!id || !photoId) {
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

  const { data: photo } = await supabase
    .from("listing_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("user_id", user.id)
    .single<{ storage_path: string }>();

  if (!photo) {
    return context.redirect(`/dashboard/listings/${id}/documents?error=nie-znaleziono`);
  }

  const { error: storageError } = await supabase.storage.from("listing-photos").remove([photo.storage_path]);

  if (storageError) {
    return context.redirect(`/dashboard/listings/${id}/documents?error=blad-usuniecia`);
  }

  // Intentionally no .select() — idempotent delete, 0-row result is not an error. (documents-and-files plan Phase 3.)
  const { error: dbError } = await supabase.from("listing_photos").delete().eq("id", photoId).eq("user_id", user.id);

  if (dbError) {
    return context.redirect(`/dashboard/listings/${id}/documents?error=blad-usuniecia`);
  }

  return context.redirect(`/dashboard/listings/${id}/documents?success=usunieto`);
};
