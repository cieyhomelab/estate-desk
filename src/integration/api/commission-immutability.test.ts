import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServiceRoleClient } from "../helpers/supabase";
import { getAuthCookieHeader } from "../helpers/auth";
import { TEST_BASE_URL } from "../helpers/server";

async function postCommission(listingId: string, commissionPercent: number, cookie: string) {
  const body = new URLSearchParams({ commission_percent: String(commissionPercent) });
  return fetch(`${TEST_BASE_URL}/api/listings/${listingId}/commission/set`, {
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

async function postClose(listingId: string, fields: Record<string, string>, cookie: string) {
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

async function postReopen(listingId: string, cookie: string) {
  return fetch(`${TEST_BASE_URL}/api/listings/${listingId}/reopen`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: TEST_BASE_URL,
    },
    body: new URLSearchParams(),
    redirect: "manual",
  });
}

describe("commission immutability — POST commission/set", () => {
  const supabase = createServiceRoleClient();
  let testUserId: string;
  let authCookie: string;
  let activeListingId: string;
  let doneListingId: string;
  let lifecycleListingId: string;

  const listingBase = {
    type: "sale",
    address: "ul. Testowa 1, Warszawa",
    owner_name: "Test Owner",
    owner_phone: "+48 600 000 000",
    owner_email: "commission-test@test.local",
  };

  beforeAll(async () => {
    const email = `commission-test-${Date.now()}@test.local`;
    const password = "integration-test";

    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (userError) throw new Error(`Failed to create test user: ${userError.message}`);
    testUserId = userData.user.id;

    authCookie = await getAuthCookieHeader(email, password);

    const { data: listings, error: listingError } = await supabase
      .from("listings")
      .insert([
        { user_id: testUserId, ...listingBase },
        { user_id: testUserId, ...listingBase, commission_percent: 2 },
        { user_id: testUserId, ...listingBase },
      ])
      .select("id");
    if (listingError) throw new Error(`Failed to insert listings: ${listingError.message}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- supabase-js id field
    [activeListingId, doneListingId, lifecycleListingId] = listings.map((l: any) => l.id as string);

    // Seed doneListingId into done state directly via service role
    const { error: snapshotError } = await supabase.from("transaction_snapshots").insert({
      listing_id: doneListingId,
      user_id: testUserId,
      asking_price: null,
      commission_percent: 2,
      tax_rate: null,
      agency_percent: null,
      brutto: null,
      agency_amount: null,
      gross_income: null,
      tax_amount: null,
      agent_net: null,
      notary_name: null,
      notary_city: null,
      transaction_date: null,
    });
    if (snapshotError) throw new Error(`Failed to insert snapshot: ${snapshotError.message}`);

    const { error: updateError } = await supabase
      .from("listings")
      .update({ status: "done", closed_at: new Date().toISOString() })
      .eq("id", doneListingId);
    if (updateError) throw new Error(`Failed to mark listing as done: ${updateError.message}`);
  });

  afterAll(async () => {
    if (testUserId) await supabase.auth.admin.deleteUser(testUserId);
  });

  it("active listing — commission change succeeds", async () => {
    const res = await postCommission(activeListingId, 3, authCookie);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("prowizja-zapisana");

    const { data } = await supabase.from("listings").select("commission_percent").eq("id", activeListingId).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- supabase-js returns any
    expect((data as any).commission_percent).toBe(3);
  });

  it("done listing — commission change blocked, DB unchanged", async () => {
    const res = await postCommission(doneListingId, 5, authCookie);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("transakcja-zamknieta");

    const { data } = await supabase.from("listings").select("commission_percent").eq("id", doneListingId).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- supabase-js returns any
    expect((data as any).commission_percent).toBe(2);
  });

  it("reopen → commission change → close — snapshot has updated commission", async () => {
    // Mark all docs checked so close gate passes
    const { error: checkError } = await supabase
      .from("listing_documents")
      .update({ is_checked: true })
      .eq("listing_id", lifecycleListingId)
      .eq("is_checked", false);
    if (checkError) throw new Error(`Failed to check documents: ${checkError.message}`);

    // Close the listing first to get it into done state
    const closeRes = await postClose(lifecycleListingId, {}, authCookie);
    expect(closeRes.status).toBe(302);
    expect(closeRes.headers.get("location")).toContain("zamknieto");

    // Reopen
    const reopenRes = await postReopen(lifecycleListingId, authCookie);
    expect(reopenRes.status).toBe(302);
    expect(reopenRes.headers.get("location")).toContain("wznowiono");

    // Update commission
    const commissionRes = await postCommission(lifecycleListingId, 3, authCookie);
    expect(commissionRes.headers.get("location")).toContain("prowizja-zapisana");

    // Close again with override
    const closeRes2 = await postClose(lifecycleListingId, { override_confirmed: "true" }, authCookie);
    expect(closeRes2.status).toBe(302);
    expect(closeRes2.headers.get("location")).toContain("zamknieto");

    // Fetch the most recent (non-voided) snapshot and verify commission_percent = 3
    const { data: snapshots } = await supabase
      .from("transaction_snapshots")
      .select("commission_percent, snapshot_at")
      .eq("listing_id", lifecycleListingId)
      .is("voided_at", null)
      .order("snapshot_at", { ascending: false })
      .limit(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- supabase-js returns any
    expect((snapshots as any)[0].commission_percent).toBe(3);
  });
});
