import type { SupabaseClient } from "@supabase/supabase-js";

type OwnedMutationResult<T> =
  | { ok: true; data: T[] }
  | { ok: false; reason: "not-found" | "db-error"; error?: unknown };

export async function updateOwnedListing<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  id: string,
  userId: string,
  patch: Record<string, unknown>,
): Promise<OwnedMutationResult<T>> {
  const { data, error } = await supabase.from("listings").update(patch).eq("id", id).eq("user_id", userId).select();

  if (error) {
    return { ok: false, reason: "db-error", error };
  }

  if (data.length === 0) {
    return { ok: false, reason: "not-found" };
  }

  return { ok: true, data: data as T[] };
}
