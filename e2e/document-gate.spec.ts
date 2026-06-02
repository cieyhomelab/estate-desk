import { test, expect } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { createE2ESupabaseClient, checkAllListingDocs } from "./helpers/db";
import { createTestUser, getSessionCookies, deleteTestUser } from "./helpers/auth";
import type { TestUser } from "./helpers/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient;
let testUser: TestUser;
let context: BrowserContext;
let page: Page;

async function createSaleListing(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("listings")
    .insert({ type: "sale", address: "ul. Gate Test, Warszawa", user_id: userId, status: "active" })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(`createSaleListing failed: ${error.message}`);
  return data.id;
}

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  supabase = createE2ESupabaseClient();
  testUser = await createTestUser(supabase);
  context = await browser.newContext();
  await context.addCookies(await getSessionCookies(testUser.email, testUser.password));
  page = await context.newPage();
});

test.afterAll(async () => {
  await context.close();
  await deleteTestUser(supabase, testUser.userId);
});

test("blocked path — incomplete checklist disables submit", async () => {
  const listingId = await createSaleListing(testUser.userId);
  await page.goto(`/dashboard/listings/${listingId}/close`);

  await expect(page.getByText(/Brakuje/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Zamknij transakcję" })).toBeDisabled();
  await expect(page.getByLabel("Pomiń weryfikację dokumentów")).toBeVisible();
});

test("happy path — all docs pre-checked allows close", async () => {
  const listingId = await createSaleListing(testUser.userId);
  await checkAllListingDocs(listingId);
  await page.goto(`/dashboard/listings/${listingId}/close`);

  await expect(page.getByText("Dokumenty gotowe")).toBeVisible();
  await expect(page.getByRole("button", { name: "Zamknij transakcję" })).not.toBeDisabled();

  await page.getByLabel("Imię i nazwisko notariusza").fill("Jan Notariusz");
  await page.getByRole("button", { name: "Zamknij transakcję" }).click();
  await page.waitForURL(/close\?success=zamknieto/);
  await expect(page.getByRole("heading", { name: "Transakcja zamknięta" })).toBeVisible();
});

test("override path — inline checkbox unlocks disabled submit", async () => {
  const listingId = await createSaleListing(testUser.userId);
  await page.goto(`/dashboard/listings/${listingId}/close`);

  await expect(page.getByText(/Brakuje/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Zamknij transakcję" })).toBeDisabled();
  await expect(page.getByLabel("Pomiń weryfikację dokumentów")).toBeVisible();

  await page.getByLabel("Pomiń weryfikację dokumentów").check();
  await expect(page.getByRole("button", { name: "Zamknij transakcję" })).not.toBeDisabled();

  await page.getByRole("button", { name: "Zamknij transakcję" }).click();
  await page.waitForURL(/close\?success=zamknieto/);
  await expect(page.getByRole("heading", { name: "Transakcja zamknięta" })).toBeVisible();
});
