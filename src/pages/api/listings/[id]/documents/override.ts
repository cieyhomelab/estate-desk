import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { updateOwnedListing } from "@/lib/owned-mutation";

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

  const result = await updateOwnedListing(supabase, id, user.id, { checklist_override: override });

  if (!result.ok) {
    const slug = result.reason === "not-found" ? "nie-znaleziono" : "blad-zapisu";
    return context.redirect(`/dashboard/listings/${id}/documents?error=${slug}`);
  }

  return context.redirect(`/dashboard/listings/${id}/documents?success=zapisano`);
};
