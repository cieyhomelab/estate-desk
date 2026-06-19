import { test, expect } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { createE2ESupabaseClient, checkAllListingDocs } from "./helpers/db";
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
      address: "ul. Lifecycle Test, Gdańsk",
      owner_name: "Zofia Testowa",
      user_id: testUser.userId,
      status: "active",
      asking_price: 500000,
      commission_percent: 2,
    })
    .select("id")
    .single<{ id: string }>();
  if (listingError) throw new Error(`beforeAll listing insert failed: ${listingError.message}`);
  listingId = listingData.id;

  const { error: settingsError } = await supabase
    .from("commission_settings")
    .insert({ user_id: testUser.userId, tax_rate: 23, agency_percent: 50 });
  if (settingsError) throw new Error(`beforeAll commission_settings insert failed: ${settingsError.message}`);

  await checkAllListingDocs(listingId);
});

test.afterAll(async () => {
  await context.close();
  await deleteTestUser(supabase, testUser.userId);
});

test("close listing → done-state card on dashboard", async () => {
  await page.goto(`/dashboard/listings/${listingId}/close`);
  await page.getByLabel("Imię i nazwisko notariusza").fill("Piotr Notariusz");
  await page.getByLabel("Miasto kancelarii notarialnej").fill("Gdańsk");
  await page.getByLabel("Data transakcji").fill("2026-06-02");
  await page.getByRole("button", { name: "Zamknij transakcję" }).click();
  await page.waitForURL(/close\?success=zamknieto/);

  await page.goto("/dashboard");

  await expect(page.getByText("Ukończone")).toBeVisible();
  await expect(page.getByText("ul. Lifecycle Test", { exact: true })).toBeVisible();
  await expect(page.getByText("Gdańsk · Zofia Testowa", { exact: true })).toBeVisible();
  await expect(page.getByText(/Zysk:/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Wznów transakcję" })).toBeVisible();
});

test("close detail page shows done-state with commission", async () => {
  await page.goto(`/dashboard/listings/${listingId}/close`);

  await expect(page.getByRole("heading", { name: "Transakcja zamknięta" })).toBeVisible();
  await expect(page.getByText("Piotr Notariusz")).toBeVisible();
  await expect(page.getByText("Gdańsk")).toBeVisible();
  await expect(page.getByText("Zysk agenta").last()).toBeVisible();
  await expect(page.getByText("Brak danych prowizji")).not.toBeVisible();
  await expect(page.getByRole("cell", { name: "3 850,00 zł" })).toBeVisible();
});

test("reopen → active state with data intact", async () => {
  await page.goto(`/dashboard/listings/${listingId}/close`);
  await page.getByRole("button", { name: "Wznów transakcję" }).click();
  await page.waitForURL(/dashboard\?success=wznowiono/);

  await page.goto("/dashboard");

  await expect(page.getByText("Aktywne", { exact: true })).toBeVisible();
  await expect(page.getByText("ul. Lifecycle Test", { exact: true })).toBeVisible();
  await expect(page.getByText("Gdańsk · Zofia Testowa", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Zakończ transakcję" })).toBeVisible();
  await expect(page.getByText(/Zysk agenta/)).not.toBeVisible();
});
