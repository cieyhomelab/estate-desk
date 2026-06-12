import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";
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

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<{ id: string; status: string }>();

  if (listingError) {
    return context.redirect("/dashboard?error=nie-znaleziono");
  }

  if (listing.status === "active") {
    return context.redirect(`/dashboard/listings/${id}/close?error=juz-aktywna`);
  }

  // Void snapshot first: if listing update later fails, re-running reopen retries cleanly.
  // The void query is idempotent (WHERE voided_at IS NULL) — 0-row update on retry is not an error.
  const { error: voidError } = await supabase
    .from("transaction_snapshots")
    .update({ voided_at: new Date().toISOString() })
    .eq("listing_id", id)
    .eq("user_id", user.id)
    .is("voided_at", null);

  if (voidError) {
    return context.redirect("/dashboard?error=blad-zapisu");
  }

  // Intentionally preserves notary_name, notary_city, transaction_date, transaction_notes — reopen per plan transaction-close Phase 3
  const result = await updateOwnedListing(supabase, id, user.id, { status: "active", closed_at: null });

  if (!result.ok) {
    return context.redirect("/dashboard?error=blad-zapisu");
  }

  return context.redirect("/dashboard?success=wznowiono");
};
