import type { APIRoute } from "astro";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const id = context.params.id;
  if (!id) {
    return context.redirect(`/dashboard?error=${encodeURIComponent("Brak identyfikatora ogłoszenia")}`);
  }

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

  // Intentionally no .select() — idempotent delete per plan listing-crud Phase 2
  // ("idempotent — double-delete is not an error"). Diverges from update.ts on
  // purpose; see context/foundation/lessons.md "Document intentional asymmetry".
  const { error } = await supabase.from("listings").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    return context.redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  }

  return context.redirect("/dashboard");
};
