import { createClient } from "@supabase/supabase-js";

export function createE2ESupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to run E2E tests");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function checkAllListingDocs(listingId: string): Promise<void> {
  const supabase = createE2ESupabaseClient();
  const { error } = await supabase.from("listing_documents").update({ is_checked: true }).eq("listing_id", listingId);
  if (error) throw new Error(`checkAllListingDocs failed: ${error.message}`);
}
