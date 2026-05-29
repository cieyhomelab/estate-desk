import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(
      "/dashboard/settings/commission?error=" + encodeURIComponent("Błąd konfiguracji bazy danych"),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return context.redirect("/auth/signin");
  }

  const form = await context.request.formData();
  const taxRateRaw = form.get("tax_rate") as string | null;
  const agencyPercentRaw = form.get("agency_percent") as string | null;

  const tax_rate = parseFloat(taxRateRaw ?? "");
  const agency_percent = parseFloat(agencyPercentRaw ?? "");

  if (
    isNaN(tax_rate) ||
    isNaN(agency_percent) ||
    tax_rate < 0 ||
    tax_rate > 100 ||
    agency_percent < 0 ||
    agency_percent > 100
  ) {
    return context.redirect("/dashboard/settings/commission?error=stawki-nieprawidlowe");
  }

  const { error } = await supabase
    .from("commission_settings")
    .upsert({ user_id: user.id, tax_rate, agency_percent }, { onConflict: "user_id" });

  if (error) {
    return context.redirect("/dashboard/settings/commission?error=blad-zapisu");
  }

  return context.redirect("/dashboard/settings/commission");
};
