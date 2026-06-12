import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServiceRoleClient } from "../helpers/supabase";
import { getAuthCookieHeader } from "../helpers/auth";
import { TEST_BASE_URL } from "../helpers/server";

describe("IDOR — authenticated cross-account access is denied", () => {
  const supabase = createServiceRoleClient();
  let userAId: string;
  let userBId: string;
  let userAListingId: string;
  let userADoneListingId: string;
  let userADocId: string;
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

    const { data: doneListing, error: doneListingErr } = await supabase
      .from("listings")
      .insert({
        user_id: userAId,
        type: "sale",
        address: "ul. Ofiary IDOR 2, Warszawa",
        owner_name: "User A Owner",
        owner_phone: "+48 600 000 001",
        owner_email: "user-a@test.local",
        status: "done",
      })
      .select("id")
      .single();
    if (doneListingErr) throw new Error(`Failed to insert user A done listing: ${doneListingErr.message}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- supabase-js returns any without DB type definitions
    userADoneListingId = doneListing.id;

    // Insert 1 unchecked document so the close gate is relevant; capture id for toggle test
    const { data: doc, error: docErr } = await supabase
      .from("listing_documents")
      .insert({
        listing_id: userAListingId,
        user_id: userAId,
        label: "Akt własności",
        is_checked: false,
        position: 99,
      })
      .select("id")
      .single();
    if (docErr) throw new Error(`Failed to insert document: ${docErr.message}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- supabase-js returns any without DB type definitions
    userADocId = doc.id;
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

    const { data } = await supabase.from("listings").select("status").eq("id", userAListingId).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- supabase-js returns any
    expect((data as any).status).toBe("active");
  });

  it("user B cannot set commission on user A listing — updateOwnedListing guard", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/listings/${userAListingId}/commission/set`, {
      method: "POST",
      headers: {
        Cookie: userBCookie,
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: TEST_BASE_URL,
      },
      body: new URLSearchParams({ commission_percent: "5" }),
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";

    // Open Q1 result: silent-success — error.code: null
    // Case A confirmed: 0-row UPDATE under RLS returns error===null; updateOwnedListing now guards this.
    expect(location).toContain("nie-znaleziono");

    // DB row must be unchanged
    const { data } = await supabase.from("listings").select("commission_percent").eq("id", userAListingId).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- supabase-js returns any
    expect((data as any).commission_percent).toBeNull();
  });

  it("user B cannot update user A listing via update.ts (0-row UPDATE rowcount check)", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/listings/${userAListingId}/update`, {
      method: "POST",
      headers: {
        Cookie: userBCookie,
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: TEST_BASE_URL,
      },
      body: new URLSearchParams({
        type: "sale",
        address: "ul. Atakujacy 1, Warszawa",
        owner_name: "Attacker",
        owner_phone: "+48 600 000 999",
        owner_email: "attacker@test.local",
      }),
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    // update.ts currently redirects with encoded Polish error message (not a slug); assert any error redirect
    expect(location).toContain("error");

    const { data } = await supabase.from("listings").select("address").eq("id", userAListingId).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- supabase-js returns any
    expect((data as any).address).toBe("ul. Ofiary IDOR 1, Warszawa");
  });

  it("user B cannot create contact on user A listing (RLS subquery)", async () => {
    expect(userAListingId).toBeDefined();
    const res = await fetch(`${TEST_BASE_URL}/api/listings/${userAListingId}/contacts/create`, {
      method: "POST",
      headers: {
        Cookie: userBCookie,
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: TEST_BASE_URL,
      },
      body: new URLSearchParams({ name: "AttackerContact", role: "kupujący" }),
      redirect: "manual",
    });

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

  it("user B cannot override document checklist on user A listing (0-row UPDATE guard)", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/listings/${userAListingId}/documents/override`, {
      method: "POST",
      headers: {
        Cookie: userBCookie,
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: TEST_BASE_URL,
      },
      body: new URLSearchParams({ override: "true" }),
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("zapisano");
    expect(location).toContain("nie-znaleziono");

    const { data } = await supabase.from("listings").select("checklist_override").eq("id", userAListingId).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- supabase-js returns any
    expect((data as any).checklist_override).toBeFalsy();
  });

  it("user B cannot toggle user A document (0-row UPDATE guard)", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/listings/${userAListingId}/documents/${userADocId}/toggle`, {
      method: "POST",
      headers: {
        Cookie: userBCookie,
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: TEST_BASE_URL,
      },
      body: new URLSearchParams({ checked: "true" }),
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("nie-znaleziono");

    const { data } = await supabase.from("listing_documents").select("is_checked").eq("id", userADocId).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- supabase-js returns any
    expect((data as any).is_checked).toBe(false);
  });

  it("user B cannot set price on user A listing (0-row UPDATE guard)", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/listings/${userAListingId}/price/set`, {
      method: "POST",
      headers: {
        Cookie: userBCookie,
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: TEST_BASE_URL,
      },
      body: new URLSearchParams({ price: "500000" }),
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("cena-zapisana");
    // RLS blocks price_history INSERT before updateOwnedListing is reached → blad-zapisu slug
    expect(location).toContain("blad-zapisu");

    const { data } = await supabase.from("listings").select("asking_price").eq("id", userAListingId).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- supabase-js returns any
    expect((data as any).asking_price).toBeNull();
  });

  it("user B cannot reopen user A done listing (0-row UPDATE guard)", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/listings/${userADoneListingId}/reopen`, {
      method: "POST",
      headers: {
        Cookie: userBCookie,
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: TEST_BASE_URL,
      },
      body: new URLSearchParams({}),
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).not.toContain("wznowiono");
    expect(location).toContain("nie-znaleziono");

    const { data } = await supabase.from("listings").select("status").eq("id", userADoneListingId).single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- supabase-js returns any
    expect((data as any).status).toBe("done");
  });
});
