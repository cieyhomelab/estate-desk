import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/dashboard?error=${encodeURIComponent("Błąd konfiguracji bazy danych")}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const id = context.params.id;
  if (!id) {
    return context.redirect(`/dashboard?error=${encodeURIComponent("Brak identyfikatora ogłoszenia")}`);
  }

  const form = await context.request.formData();
  const priceRaw = form.get("price") as string | null;

  const parsedPrice = parseFloat(priceRaw ?? "");

  if (!isFinite(parsedPrice) || parsedPrice <= 0 || Math.round(parsedPrice * 100) / 100 !== parsedPrice) {
    return context.redirect(`/dashboard/listings/${id}/pricing?error=cena-nieprawidlowa`);
  }

  const { error: insertError } = await supabase.from("price_history").insert({ listing_id: id, price: parsedPrice });

  if (insertError) {
    return context.redirect(`/dashboard/listings/${id}/pricing?error=blad-zapisu`);
  }

  // Second write — denormalized cache of price_history. Sequential (not atomic) by design; on failure here the
  // price_history row is already committed. User must resubmit the form to reconcile. See plan pricing-and-commission Phase 3.
  const { error: updateError } = await supabase
    .from("listings")
    .update({ asking_price: parsedPrice })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) {
    return context.redirect(`/dashboard/listings/${id}/pricing?error=blad-zapisu`);
  }

  return context.redirect(`/dashboard/listings/${id}/pricing?success=cena-zapisana`);
};
