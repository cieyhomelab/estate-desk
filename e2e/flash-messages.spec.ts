import { test, expect } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { createE2ESupabaseClient } from "./helpers/db";
import { createTestUser, getSessionCookies, deleteTestUser } from "./helpers/auth";
import type { TestUser } from "./helpers/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

test.describe.configure({ mode: "serial" });

let supabase: SupabaseClient;
let testUser: TestUser;
let context: BrowserContext;
let page: Page;
let listingId: string;

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  supabase = createE2ESupabaseClient();
  testUser = await createTestUser(supabase);
  context = await browser.newContext();
  await context.addCookies(await getSessionCookies(testUser.email, testUser.password));
  page = await context.newPage();

  const { data: listingData, error: listingError } = await supabase
    .from("listings")
    .insert({
      type: "sale",
      address: "ul. Flash Test, Warszawa",
      owner_name: "Flash Testowy",
      user_id: testUser.userId,
      status: "active",
    })
    .select("id")
    .single<{ id: string }>();
  if (listingError) throw new Error(`beforeAll listing insert failed: ${listingError.message}`);
  listingId = listingData.id;
});

test.afterAll(async () => {
  await context.close();
  await deleteTestUser(supabase, testUser.userId);
});

test("pricing.astro?error=blad-zapisu shows generic write-error text", async () => {
  await page.goto(`/dashboard/listings/${listingId}/pricing?error=blad-zapisu`);
  await expect(page.getByRole("alert")).toContainText("Nie udało się zapisać. Spróbuj ponownie.");
});

test("pricing.astro?error=cena-nieprawidlowa shows price-specific message", async () => {
  await page.goto(`/dashboard/listings/${listingId}/pricing?error=cena-nieprawidlowa`);
  await expect(page.getByRole("alert")).toContainText(
    "Cena musi być liczbą większą od zera z co najwyżej dwoma miejscami po przecinku.",
  );
});

test("pricing.astro?error=prowizja-nieprawidlowa shows commission-specific message", async () => {
  await page.goto(`/dashboard/listings/${listingId}/pricing?error=prowizja-nieprawidlowa`);
  await expect(page.getByRole("alert")).toContainText(
    "Prowizja musi być liczbą większą od zera i nie większą niż 100%.",
  );
});
