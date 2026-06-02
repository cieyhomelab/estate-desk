import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServiceRoleClient } from "../helpers/supabase";
import { getAuthCookieHeader } from "../helpers/auth";
import { TEST_BASE_URL } from "../helpers/server";

async function postClose(
  listingId: string,
  fields: Record<string, string> = {},
  cookie: string,
) {
  const body = new URLSearchParams(fields);
  return fetch(`${TEST_BASE_URL}/api/listings/${listingId}/close`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: TEST_BASE_URL,
    },
    body,
    redirect: "manual",
  });
}

describe("gate logic — POST close", () => {
  const supabase = createServiceRoleClient();
  let testUserId: string;
  let authCookie: string;
  let blockedListingId: string;
  let overrideListingId: string;
  let allCheckedListingId: string;

  const listingBase = {
    type: "sale",
    address: "ul. Bramkowa 1, Warszawa",
    owner_name: "Test Owner",
    owner_phone: "+48 600 000 000",
    owner_email: "gate-test@test.local",
  };

  beforeAll(async () => {
    const email = `gate-test-${Date.now()}@test.local`;
    const password = "integration-test";

    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (userError) throw new Error(`Failed to create test user: ${userError.message}`);
    testUserId = userData.user.id;

    authCookie = await getAuthCookieHeader(email, password);

    // Insert three separate listings — one per test scenario
    const { data: listings, error: listingError } = await supabase
      .from("listings")
      .insert([
        { user_id: testUserId, ...listingBase },
        { user_id: testUserId, ...listingBase },
        { user_id: testUserId, ...listingBase },
      ])
      .select("id");
    if (listingError) throw new Error(`Failed to insert listings: ${listingError.message}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- supabase-js returns any without DB type definitions
    [blockedListingId, overrideListingId, allCheckedListingId] = listings.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js id field
      (l: any) => l.id as string,
    );

    // Add 2 unchecked documents to blockedListingId
    const { error: docsBlockedError } = await supabase.from("listing_documents").insert([
      { listing_id: blockedListingId, user_id: testUserId, label: "Akt notarialny", is_checked: false, position: 0 },
      { listing_id: blockedListingId, user_id: testUserId, label: "Zaświadczenie", is_checked: false, position: 1 },
    ]);
    if (docsBlockedError)
      throw new Error(`Failed to insert docs for blocked listing: ${docsBlockedError.message}`);

    // Add 2 unchecked documents to overrideListingId
    const { error: docsOverrideError } = await supabase.from("listing_documents").insert([
      { listing_id: overrideListingId, user_id: testUserId, label: "Akt notarialny", is_checked: false, position: 0 },
      { listing_id: overrideListingId, user_id: testUserId, label: "Zaświadczenie", is_checked: false, position: 1 },
    ]);
    if (docsOverrideError)
      throw new Error(`Failed to insert docs for override listing: ${docsOverrideError.message}`);

    // Mark all default documents for allCheckedListingId as checked — trigger seeded them unchecked
    const { error: checkError } = await supabase
      .from("listing_documents")
      .update({ is_checked: true })
      .eq("listing_id", allCheckedListingId)
      .eq("is_checked", false);
    if (checkError)
      throw new Error(`Failed to check documents for all-checked listing: ${checkError.message}`);
  });

  afterAll(async () => {
    if (testUserId) await supabase.auth.admin.deleteUser(testUserId);
  });

  it("blocks close when checklist is incomplete and no override_confirmed", async () => {
    const res = await postClose(blockedListingId, {}, authCookie);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("brakujace-dokumenty");

    const { data } = await supabase
      .from("listings")
      .select("status")
      .eq("id", blockedListingId)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- supabase-js returns any
    expect((data as any).status).toBe("active");
  });

  it("passes close when all checklist items are checked (no unchecked docs)", async () => {
    const res = await postClose(allCheckedListingId, {}, authCookie);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("zamknieto");

    const { data } = await supabase
      .from("listings")
      .select("status")
      .eq("id", allCheckedListingId)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- supabase-js returns any
    expect((data as any).status).toBe("done");
  });

  it("bypasses gate with override_confirmed=true even with unchecked items", async () => {
    const res = await postClose(overrideListingId, { override_confirmed: "true" }, authCookie);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("zamknieto");

    const { data } = await supabase
      .from("listings")
      .select("status")
      .eq("id", overrideListingId)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- supabase-js returns any
    expect((data as any).status).toBe("done");
  });
});
