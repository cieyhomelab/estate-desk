/**
 * Risk #6 — personal data not accessible without a valid session
 * Seed: seed.spec.ts
 *
 * Proves: browser navigation to any /dashboard route without a Supabase
 * session cookie redirects to /auth/signin; an authenticated session renders
 * the protected page with the owner's real listing data.
 */
import { test, expect } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { createE2ESupabaseClient } from "./helpers/db";
import { createTestUser, getSessionCookies, deleteTestUser } from "./helpers/auth";
import type { TestUser } from "./helpers/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient;
let testUser: TestUser;
let listingAddress: string;
let listingId: string;
let authedContext: BrowserContext;
let authedPage: Page;

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  supabase = createE2ESupabaseClient();
  testUser = await createTestUser(supabase);

  listingAddress = `ul. Prywatna ${testUser.userId.slice(0, 8)}, Warszawa`;

  const { data, error } = await supabase
    .from("listings")
    .insert({
      type: "sale",
      address: listingAddress,
      owner_name: "Jan Właściciel",
      user_id: testUser.userId,
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(`createListing failed: ${error.message}`);
  listingId = data.id;

  authedContext = await browser.newContext();
  await authedContext.addCookies(await getSessionCookies(testUser.email, testUser.password));
  authedPage = await authedContext.newPage();
});

test.afterAll(async () => {
  await authedContext.close();
  await deleteTestUser(supabase, testUser.userId);
});

// Uses Playwright's default `page` fixture — no cookies, fresh unauthenticated context per test
test("unauthenticated access to dashboard redirects to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/signin/);
});

test("unauthenticated access to listing edit page redirects to sign-in", async ({ page }) => {
  await page.goto(`/dashboard/listings/${listingId}/edit`);
  await expect(page).toHaveURL(/\/auth\/signin/);
});

test("authenticated user sees their listing data on the dashboard", async () => {
  await authedPage.goto("/dashboard");
  await expect(authedPage).toHaveURL("/dashboard");
  await expect(authedPage.getByText(listingAddress)).toBeVisible();
  await expect(authedPage.getByText("Jan Właściciel")).toBeVisible();
});
