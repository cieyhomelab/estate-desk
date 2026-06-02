import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServiceRoleClient } from "./helpers/supabase";

describe("listing persistence", () => {
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
      .insert({
        user_id: testUserId,
        type: "sale",
        address: "ul. Testowa 1, Warszawa",
        owner_name: "Jan Kowalski",
        owner_phone: "+48 600 000 001",
        owner_email: "jan@test.local",
      })
      .select("id")
      .single();
    if (listingError) throw new Error(`Failed to insert listing: ${listingError.message}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- supabase-js returns any without DB type definitions
    testListingId = listingData.id;
  });

  afterAll(async () => {
    if (testUserId) await supabase.auth.admin.deleteUser(testUserId);
  });

  it("creates a listing and all fields are retrievable from DB", async () => {
    const { data: row, error: readError } = await supabase
      .from("listings")
      .select("type, address, owner_name, owner_phone, owner_email")
      .eq("id", testListingId)
      .single();
    if (readError) throw new Error(`Failed to read listing: ${readError.message}`);

    expect(row.type).toBe("sale");
    expect(row.address).toBe("ul. Testowa 1, Warszawa");
    expect(row.owner_name).toBe("Jan Kowalski");
    expect(row.owner_phone).toBe("+48 600 000 001");
    expect(row.owner_email).toBe("jan@test.local");
  });

  it("updates a listing and all changed fields are retrievable from DB", async () => {
    const { error: updateError } = await supabase
      .from("listings")
      .update({
        type: "occasional-rental",
        address: "al. Zmieniona 2, Kraków",
        owner_name: "Anna Nowak",
        owner_phone: null,
        owner_email: null,
      })
      .eq("id", testListingId);
    if (updateError) throw new Error(`Failed to update listing: ${updateError.message}`);

    const { data: row, error: readError } = await supabase
      .from("listings")
      .select("type, address, owner_name, owner_phone, owner_email")
      .eq("id", testListingId)
      .single();
    if (readError) throw new Error(`Failed to read listing: ${readError.message}`);

    expect(row.type).toBe("occasional-rental");
    expect(row.address).toBe("al. Zmieniona 2, Kraków");
    expect(row.owner_name).toBe("Anna Nowak");
    expect(row.owner_phone).toBeNull();
    expect(row.owner_email).toBeNull();
  });
});
