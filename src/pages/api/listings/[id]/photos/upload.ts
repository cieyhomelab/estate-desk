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

  const { data: ownerCheck } = await supabase
    .from("listings")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!ownerCheck) {
    return context.redirect(`/dashboard/listings/${id}/documents?error=nie-znaleziono`);
  }

  const form = await context.request.formData();
  const rawFiles = form.getAll("photos");
  const files = rawFiles.filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return context.redirect(`/dashboard/listings/${id}/documents?error=brak-plikow`);
  }

  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) {
      return context.redirect(`/dashboard/listings/${id}/documents?error=plik-za-duzy`);
    }
    if (!file.type.startsWith("image/")) {
      return context.redirect(`/dashboard/listings/${id}/documents?error=nieprawidlowy-typ`);
    }

    const storagePath = `${user.id}/${id}/${crypto.randomUUID()}`;
    const { error: uploadError } = await supabase.storage
      .from("listing-photos")
      .upload(storagePath, file, { contentType: file.type || "application/octet-stream", upsert: false });

    if (uploadError) {
      return context.redirect(`/dashboard/listings/${id}/documents?error=blad-uploadu`);
    }

    const { error: dbError } = await supabase.from("listing_photos").insert({
      listing_id: id,
      user_id: user.id,
      file_name: file.name,
      storage_path: storagePath,
    });

    if (dbError) {
      await supabase.storage.from("listing-photos").remove([storagePath]);
      return context.redirect(`/dashboard/listings/${id}/documents?error=blad-zapisu`);
    }
  }

  return context.redirect(`/dashboard/listings/${id}/documents?success=dodano-zdjecia`);
};
