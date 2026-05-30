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
  const raw = form.get("label");
  const label = typeof raw === "string" ? raw.trim() : "";

  if (!label || label.length > 500) {
    return context.redirect(`/dashboard/listings/${id}/documents?error=nieprawidlowa-nazwa`);
  }

  const { data: ownerCheck } = await supabase
    .from("listings")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!ownerCheck) {
    return context.redirect(`/dashboard?error=nie-znaleziono`);
  }

  const { data: lastPos } = await supabase
    .from("listing_documents")
    .select("position")
    .eq("listing_id", id)
    .order("position", { ascending: false })
    .limit(1)
    .overrideTypes<{ position: number }[], { merge: false }>();

  const nextPosition = (lastPos?.[0]?.position ?? 0) + 1;

  const { error } = await supabase.from("listing_documents").insert({
    listing_id: id,
    user_id: user.id,
    label,
    is_checked: false,
    is_default: false,
    position: nextPosition,
  });

  if (error) {
    return context.redirect(`/dashboard/listings/${id}/documents?error=blad-zapisu`);
  }

  return context.redirect(`/dashboard/listings/${id}/documents?success=dodano`);
};
