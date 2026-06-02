import { describe, it, expect, afterEach } from "vitest";
import { createServiceRoleClient } from "./supabase";

describe("createServiceRoleClient", () => {
  const savedUrl = process.env.SUPABASE_URL;
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    if (savedUrl) {
      process.env.SUPABASE_URL = savedUrl;
    } else {
      delete process.env.SUPABASE_URL;
    }
    if (savedKey) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
    } else {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
  });

  it("throws when SUPABASE_URL is missing", () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "some-key";
    expect(() => createServiceRoleClient()).toThrow(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to run integration tests",
    );
  });

  it("throws when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    process.env.SUPABASE_URL = "http://localhost:54321";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => createServiceRoleClient()).toThrow(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to run integration tests",
    );
  });
});
