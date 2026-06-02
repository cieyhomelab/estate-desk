import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServiceRoleClient } from "./helpers/supabase";

describe("price history ordering", () => {
  const supabase = createServiceRoleClient();
  let testUserId: string;
  let testListingId: string;

  beforeAll(async () => {
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email: `test-${Date.now()}@test.local`,
      password: "integration-test",
      email_confirm: true,
    });
    if (userError) throw new Error(`Failed to create test user: ${userError.message}`);
    testUserId = userData.user.id;

    const { data: listingData, error: listingError } = await supabase
      .from("listings")
      .insert({ user_id: testUserId, type: "sale", address: "ul. Cena 1, Poznań" })
      .select("id")
      .single();
    if (listingError) throw new Error(`Failed to insert listing: ${listingError.message}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- supabase-js returns any without DB type definitions
    testListingId = listingData.id;
  });

  afterAll(async () => {
    if (testUserId) await supabase.auth.admin.deleteUser(testUserId);
  });

  it("price history contains exactly N entries in ascending chronological order", async () => {
    const base = new Date();

    const { error: insertError } = await supabase.from("price_history").insert([
      { listing_id: testListingId, price: 450000, set_at: base.toISOString() },
      {
        listing_id: testListingId,
        price: 480000,
        set_at: new Date(base.getTime() + 1000).toISOString(),
      },
      {
        listing_id: testListingId,
        price: 510000,
        set_at: new Date(base.getTime() + 2000).toISOString(),
      },
    ]);
    if (insertError) throw new Error(`Failed to insert price history: ${insertError.message}`);

    const { data, error: readError } = await supabase
      .from("price_history")
      .select("price, set_at")
      .eq("listing_id", testListingId)
      .order("set_at", { ascending: true })
      .limit(100);
    if (readError) throw new Error(`Failed to read price history: ${readError.message}`);

    expect(data).toHaveLength(3);
    expect(data[0].price).toBe(450000);
    expect(data[1].price).toBe(480000);
    expect(data[2].price).toBe(510000);

    expect(new Date(data[0].set_at as string).getTime()).toBeLessThan(new Date(data[1].set_at as string).getTime());
    expect(new Date(data[1].set_at as string).getTime()).toBeLessThan(new Date(data[2].set_at as string).getTime());
  });
});
