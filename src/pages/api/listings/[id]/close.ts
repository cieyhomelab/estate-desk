import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
import type { Listing } from "@/types/listings";
import { calculateCommissionSplit } from "@/lib/commission";
import { updateOwnedListing } from "@/lib/owned-mutation";

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
    .single<Pick<Listing, "id" | "status" | "asking_price" | "commission_percent">>();

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
    const split = calculateCommissionSplit({
      askingPrice: listing.asking_price,
      commissionPercent: listing.commission_percent,
      agencyPercent: settings.agency_percent,
      taxRate: settings.tax_rate,
    });
    brutto = split.brutto;
    agency_amount = split.agencyAmount;
    gross_income = split.grossIncome;
    tax_amount = split.taxAmount;
    agent_net = split.agentNet;
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
    const slug = insertError.code === "23505" ? "juz-zamknieta" : "blad-zapisu";
    return context.redirect(`/dashboard/listings/${id}/close?error=${slug}`);
  }

  const result = await updateOwnedListing(supabase, id, user.id, {
    status: "done",
    notary_name,
    notary_city,
    transaction_date,
    transaction_notes,
    closed_at: new Date().toISOString(),
  });

  if (!result.ok) {
    // Orphaned snapshot accepted MVP risk — per plan transaction-close "What We're NOT Doing"
    return context.redirect(`/dashboard/listings/${id}/close?error=blad-zapisu`);
  }

  return context.redirect(`/dashboard/listings/${id}/close?success=zamknieto`);
};
