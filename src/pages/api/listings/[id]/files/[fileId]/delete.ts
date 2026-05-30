import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const { id, fileId } = context.params;
  if (!id || !fileId) {
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

  const { data: file } = await supabase
    .from("listing_files")
    .select("storage_path")
    .eq("id", fileId)
    .eq("user_id", user.id)
    .single<{ storage_path: string }>();

  if (!file) {
    return context.redirect(`/dashboard/listings/${id}/documents?error=nie-znaleziono`);
  }

  const { error: storageError } = await supabase.storage.from("listing-documents").remove([file.storage_path]);

  if (storageError) {
    return context.redirect(`/dashboard/listings/${id}/documents?error=blad-usuniecia`);
  }

  // Intentionally no .select() — idempotent delete, 0-row result is not an error. (documents-and-files plan Phase 3.)
  const { error: dbError } = await supabase.from("listing_files").delete().eq("id", fileId).eq("user_id", user.id);

  if (dbError) {
    return context.redirect(`/dashboard/listings/${id}/documents?error=blad-usuniecia`);
  }

  return context.redirect(`/dashboard/listings/${id}/documents?success=usunieto`);
};
