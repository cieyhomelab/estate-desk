import { describe, it, expect } from "vitest";
import { TEST_BASE_URL } from "../helpers/server";

describe("auth API error redirects", () => {
  it("POST /api/auth/signin with wrong credentials → redirects to /auth/signin with error", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: "nobody@example.com", password: "wrongpassword" }),
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toMatch(/^\/auth\/signin\?error=/);
  });

  it("POST /api/auth/signup with already-used email → redirects to /auth/signup with error", async () => {
    const res = await fetch(`${TEST_BASE_URL}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: "nobody@example.com", password: "somepassword" }),
      redirect: "manual",
    });
    expect(res.status).toBe(302);
    const location = res.headers.get("location") ?? "";
    expect(location).toMatch(/^\/auth\/signup\?error=/);
  });
});
