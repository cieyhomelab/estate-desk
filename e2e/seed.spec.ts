import { test, expect } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { createE2ESupabaseClient } from "./helpers/db";
import { createTestUser, getSessionCookies, deleteTestUser } from "./helpers/auth";
import type { TestUser } from "./helpers/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

test.describe("RISK: brak dostępu użytkownika do zasobu chronionego", () => {
  let supabase: SupabaseClient;
  let testUser: TestUser;
  let context: BrowserContext;
  let authedPage: Page;

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    supabase = createE2ESupabaseClient();
    testUser = await createTestUser(supabase);
    context = await browser.newContext();
    await context.addCookies(await getSessionCookies(testUser.email, testUser.password));
    authedPage = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
    await deleteTestUser(supabase, testUser.userId);
  });

  // Uses Playwright's default `page` fixture — no cookies, fresh unauthenticated context per test
  test("niezalogowany użytkownik zostaje przekierowany na stronę logowania", async ({ page }) => {
    // ACT
    await page.goto("/dashboard");

    // ASSERT: czekanie na stan, nie na timeout
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test("zalogowany użytkownik ma dostęp do chronionej strony", async () => {
    // ACT
    await authedPage.goto("/dashboard");

    // ASSERT: czekanie na stan, nie na timeout
    await expect(authedPage).toHaveURL("/dashboard");
    await expect(authedPage.getByRole("main")).toBeVisible();
  });
});
