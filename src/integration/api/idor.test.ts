import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServiceRoleClient } from "../helpers/supabase";
import { getAuthCookieHeader } from "../helpers/auth";
import { TEST_BASE_URL } from "../helpers/server";

describe("IDOR — authenticated cross-account access is denied", () => {
  const supabase = createServiceRoleClient();
  let userAId: string;
  let userBId: string;
  let userAListingId: string;
  let userBCookie: string;

  beforeAll(async () => {
    const ts = Date.now();
    const userAEmail = `idor-user-a-${ts}@test.local`;
    const userBEmail = `idor-user-b-${ts}@test.local`;
    const password = "integration-test";

    const { data: dataA, error: errA } = await supabase.auth.admin.createUser({
      email: userAEmail,
      password,
      email_confirm: true,
    });
    if (errA) throw new Error(`Failed to create user A: ${errA.message}`);
    userAId = dataA.user.id;

    const { data: dataB, error: errB } = await supabase.auth.admin.createUser({
      email: userBEmail,
      password,
      email_confirm: true,
    });
    if (errB) throw new Error(`Failed to create user B: ${errB.message}`);
    userBId = dataB.user.id;

    userBCookie = await getAuthCookieHeader(userBEmail, password);

    const { data: listing, error: listingErr } = await supabase
      .from("listings")
      .insert({
        user_id: userAId,
        type: "sale",
        address: "ul. Ofiary IDOR 1, Warszawa",
        owner_name: "User A Owner",
        owner_phone: "+48 600 000 001",
        owner_email: "user-a@test.local",
      })
      .select("id")
      .single();
    if (listingErr) throw new Error(`Failed to insert user A listing: ${listingErr.message}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- supabase-js returns any without DB type definitions
    userAListingId = listing.id;

    // Insert 1 unchecked document so the close gate is relevant
    const { error: docErr } = await supabase.from("listing_documents").insert({
      listing_id: userAListingId,
      user_id: userAId,
      label: "Akt własności",
      is_checked: false,
      position: 99,
    });
    if (docErr) throw new Error(`Failed to insert document: ${docErr.message}`);
  });

  afterAll(async () => {
    await Promise.allSettled([
      userAId ? supabase.auth.admin.deleteUser(userAId) : Promise.resolve(),
      userBId ? supabase.auth.admin.deleteUser(userBId) : Promise.resolve(),
    ]);
  });

  it("user B cannot close user A listing (explicit user_id filter)", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/listings/${userAListingId}/close`, {
      method: "POST",
      headers: {
        Cookie: userBCookie,
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: TEST_BASE_URL,
      },
      body: new URLSearchParams({ override_confirmed: "true" }),
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("zamknieto");
    expect(location).toContain("nie-znaleziono");

    const { data } = await supabase
      .from("listings")
      .select("status")
      .eq("id", userAListingId)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- supabase-js returns any
    expect((data as any).status).toBe("active");
  });

  it("user B cannot create contact on user A listing (RLS subquery)", async () => {
    expect(userAListingId).toBeDefined();
    const res = await fetch(
      `${TEST_BASE_URL}/api/listings/${userAListingId}/contacts/create`,
      {
        method: "POST",
        headers: {
          Cookie: userBCookie,
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: TEST_BASE_URL,
        },
        body: new URLSearchParams({ name: "AttackerContact", role: "kupujący" }),
        redirect: "manual",
      },
    );

    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("blad-zapisu");

    const { count } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", userAListingId)
      .eq("name", "AttackerContact");
    expect(count).toBe(0);
  });
});
