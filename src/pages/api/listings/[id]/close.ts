import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const id = context.params.id;
  if (!id) {
    return context.redirect("/dashboard?error=blad-zapisu");
  }

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect("/dashboard?error=blad-zapisu");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const notary_name = ((form.get("notary_name") as string | null) ?? "").trim() || null;
  const notary_city = ((form.get("notary_city") as string | null) ?? "").trim() || null;
  const transaction_date = ((form.get("transaction_date") as string | null) ?? "").trim() || null;
  const transaction_notes = ((form.get("transaction_notes") as string | null) ?? "").trim() || null;
  const override_confirmed = form.get("override_confirmed") as string | null;

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, status, asking_price, commission_percent")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<{ id: string; status: string; asking_price: number | null; commission_percent: number | null }>();

  if (listingError) {
    return context.redirect("/dashboard?error=nie-znaleziono");
  }

  if (listing.status === "done") {
    return context.redirect(`/dashboard/listings/${id}/close?error=juz-zamknieta`);
  }

  // Gate: count unchecked docs; listing_documents may not exist yet (S-05) — default 0 on error
  let uncheckedCount = 0;
  const { count, error: countError } = await supabase
    .from("listing_documents")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", id)
    .eq("is_checked", false);
  if (!countError) {
    uncheckedCount = count ?? 0;
  }

  // checklist_override (S-05) not yet available; gate passes when 0 unchecked or override submitted
  if (uncheckedCount > 0 && override_confirmed !== "true") {
    return context.redirect(`/dashboard/listings/${id}/close?error=brakujace-dokumenty`);
  }

  const { data: settings } = await supabase
    .from("commission_settings")
    .select("tax_rate, agency_percent")
    .eq("user_id", user.id)
    .maybeSingle<{ tax_rate: number; agency_percent: number }>();

  let brutto: number | null = null;
  let agency_amount: number | null = null;
  let gross_income: number | null = null;
  let tax_amount: number | null = null;
  let agent_net: number | null = null;

  if (listing.asking_price !== null && listing.commission_percent !== null && settings !== null) {
    const brutto_c = Math.round(listing.asking_price * listing.commission_percent);
    const agency_c = Math.round((brutto_c * settings.agency_percent) / 100);
    const gross_c = brutto_c - agency_c;
    const tax_c = Math.round((gross_c * settings.tax_rate) / 100);
    const agent_c = gross_c - tax_c;
    brutto = brutto_c / 100;
    agency_amount = agency_c / 100;
    gross_income = gross_c / 100;
    tax_amount = tax_c / 100;
    agent_net = agent_c / 100;
  }

  const { error: insertError } = await supabase.from("transaction_snapshots").insert({
    listing_id: id,
    user_id: user.id,
    asking_price: listing.asking_price,
    commission_percent: listing.commission_percent,
    tax_rate: settings?.tax_rate ?? null,
    agency_percent: settings?.agency_percent ?? null,
    brutto,
    agency_amount,
    gross_income,
    tax_amount,
    agent_net,
    notary_name,
    notary_city,
    transaction_date,
  });

  if (insertError) {
    return context.redirect(`/dashboard/listings/${id}/close?error=blad-zapisu`);
  }

  const { error: updateError } = await supabase
    .from("listings")
    .update({
      status: "done",
      notary_name,
      notary_city,
      transaction_date,
      transaction_notes,
      closed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) {
    // Orphaned snapshot accepted MVP risk — per plan transaction-close "What We're NOT Doing"
    return context.redirect(`/dashboard/listings/${id}/close?error=blad-zapisu`);
  }

  return context.redirect(`/dashboard/listings/${id}/close?success=zamknieto`);
};
