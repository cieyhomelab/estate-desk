import { describe, it, expect } from "vitest";
import { TEST_BASE_URL } from "../helpers/server";

const fakeId = "00000000-0000-0000-0000-000000000001";

describe("unauthenticated access returns redirect to signin", () => {
  it("POST /api/listings/create — no cookie → redirect to /auth/signin", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/listings/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: TEST_BASE_URL,
      },
      body: new URLSearchParams({ type: "sale", address: "Test" }),
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/auth/signin");
  });

  it("POST /api/listings/{id}/close — no cookie → redirect to /auth/signin", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/listings/${fakeId}/close`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: TEST_BASE_URL,
      },
      body: new URLSearchParams({}),
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/auth/signin");
  });

  it("POST /api/listings/{id}/contacts/create — no cookie → redirect to /auth/signin", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/listings/${fakeId}/contacts/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: TEST_BASE_URL,
      },
      body: new URLSearchParams({ name: "X", role: "kupujący" }),
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/auth/signin");
  });

  it("POST /api/listings/{id}/documents/add — no cookie → redirect to /auth/signin", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/listings/${fakeId}/documents/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: TEST_BASE_URL,
      },
      body: new URLSearchParams({ label: "X" }),
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/auth/signin");
  });
});
