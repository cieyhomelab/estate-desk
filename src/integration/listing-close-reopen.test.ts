import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServiceRoleClient } from "./helpers/supabase";

describe("listing close/reopen lifecycle", () => {
  const supabase = createServiceRoleClient();
  let testUserId: string;
  let testListingId: string;

  const originalFields = {
    type: "sale",
    address: "ul. Cykl 1, Gdańsk",
    owner_name: "Piotr Wiśniewski",
    owner_phone: "+48 700 000 002",
    owner_email: "piotr@test.local",
  };

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
      .insert({ user_id: testUserId, ...originalFields })
      .select("id")
      .single();
    if (listingError) throw new Error(`Failed to insert listing: ${listingError.message}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- supabase-js returns any without DB type definitions
    testListingId = listingData.id;
  });

  afterAll(async () => {
    if (testUserId) await supabase.auth.admin.deleteUser(testUserId);
  });

  it("close transition persists all listing fields and creates a snapshot", async () => {
    const { error: closeError } = await supabase
      .from("listings")
      .update({
        status: "done",
        closed_at: new Date().toISOString(),
        notary_name: "Adam Notariusz",
        notary_city: "Warszawa",
        transaction_date: "2026-06-01",
      })
      .eq("id", testListingId);
    if (closeError) throw new Error(`Failed to close listing: ${closeError.message}`);

    const { error: snapshotError } = await supabase.from("transaction_snapshots").insert({
      listing_id: testListingId,
      user_id: testUserId,
      asking_price: 500000,
      commission_percent: 2,
    });
    if (snapshotError) throw new Error(`Failed to insert snapshot: ${snapshotError.message}`);

    const { data: row, error: readError } = await supabase
      .from("listings")
      .select("status, closed_at, type, address, owner_name, owner_phone, owner_email")
      .eq("id", testListingId)
      .single();
    if (readError) throw new Error(`Failed to read listing: ${readError.message}`);

    expect(row.status).toBe("done");
    expect(row.closed_at).not.toBeNull();
    expect(row.type).toBe(originalFields.type);
    expect(row.address).toBe(originalFields.address);
    expect(row.owner_name).toBe(originalFields.owner_name);
    expect(row.owner_phone).toBe(originalFields.owner_phone);
    expect(row.owner_email).toBe(originalFields.owner_email);

    const { data: snapshot, error: snapReadError } = await supabase
      .from("transaction_snapshots")
      .select("id")
      .eq("listing_id", testListingId)
      .is("voided_at", null)
      .single();
    if (snapReadError) throw new Error(`Failed to read snapshot: ${snapReadError.message}`);
    expect(snapshot.id).not.toBeNull();
  });

  it("reopen transition restores active status and preserves all listing fields", async () => {
    const { error: voidError } = await supabase
      .from("transaction_snapshots")
      .update({ voided_at: new Date().toISOString() })
      .eq("listing_id", testListingId)
      .is("voided_at", null);
    if (voidError) throw new Error(`Failed to void snapshot: ${voidError.message}`);

    const { error: reopenError } = await supabase
      .from("listings")
      .update({ status: "active", closed_at: null })
      .eq("id", testListingId);
    if (reopenError) throw new Error(`Failed to reopen listing: ${reopenError.message}`);

    const { data: row, error: readError } = await supabase
      .from("listings")
      .select("status, closed_at, type, address, owner_name, owner_phone, owner_email")
      .eq("id", testListingId)
      .single();
    if (readError) throw new Error(`Failed to read listing: ${readError.message}`);

    expect(row.status).toBe("active");
    expect(row.closed_at).toBeNull();
    expect(row.type).toBe(originalFields.type);
    expect(row.address).toBe(originalFields.address);
    expect(row.owner_name).toBe(originalFields.owner_name);
    expect(row.owner_phone).toBe(originalFields.owner_phone);
    expect(row.owner_email).toBe(originalFields.owner_email);
  });
});
