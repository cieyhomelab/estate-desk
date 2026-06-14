import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import { updateOwnedListing } from "@/lib/owned-mutation";
import type { Listing } from "@/types/listings";

export const POST: APIRoute = async (context) => {
  const { id } = context.params;
  const supabase = createClient(context.request.headers, context.cookies);

  if (!id) {
    return context.redirect(`/dashboard?error=blad-serwera`);
  }
  if (!supabase) {
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

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<Pick<Listing, "id" | "status">>();

  if (listingError) {
    return context.redirect(`/dashboard/listings/${id}/pricing?error=nie-znaleziono`);
  }

  if (listing.status === "done") {
    return context.redirect(`/dashboard/listings/${id}/pricing?error=transakcja-zamknieta`);
  }

  const result = await updateOwnedListing(supabase, id, user.id, { commission_percent });

  if (!result.ok) {
    const slug = result.reason === "not-found" ? "nie-znaleziono" : "blad-zapisu";
    return context.redirect(`/dashboard/listings/${id}/pricing?error=${slug}`);
  }

  return context.redirect(`/dashboard/listings/${id}/pricing?success=prowizja-zapisana`);
};
