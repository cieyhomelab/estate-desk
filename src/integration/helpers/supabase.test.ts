import { describe, it, expect, afterEach } from "vitest";

describe("createServiceRoleClient", () => {
  const savedUrl = process.env.SUPABASE_URL;
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    process.env.SUPABASE_URL = savedUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  });

  it("throws when SUPABASE_URL is missing", async () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "some-key";
    const { createServiceRoleClient } = await import("./supabase");
    expect(() => createServiceRoleClient()).toThrow(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to run integration tests",
    );
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    process.env.SUPABASE_URL = "http://localhost:54321";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { createServiceRoleClient } = await import("./supabase");
    expect(() => createServiceRoleClient()).toThrow(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to run integration tests",
    );
  });
});
