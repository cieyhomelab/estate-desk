import { test, expect } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });
import { createE2ESupabaseClient } from "./helpers/db";
import { createTestUser, getSessionCookies, deleteTestUser } from "./helpers/auth";
import type { TestUser } from "./helpers/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

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
});

test.afterAll(async () => {
  await context.close();
  await deleteTestUser(supabase, testUser.userId);
});

test("create listing → reload edit page → all 5 fields persist", async () => {
  await page.goto("/dashboard/listings/new");

  const address = `ul. Persist ${testUser.userId.slice(0, 8)}, Warszawa`;
  await page.getByLabel("Typ ogłoszenia").selectOption("occasional-rental");
  await page.getByLabel("Adres nieruchomości").fill(address);
  await page.getByLabel("Imię i nazwisko właściciela").fill("Anna Testowa");
  await page.getByLabel("Telefon właściciela").fill("+48 600 000 001");
  await page.getByLabel("E-mail właściciela").fill("anna@test.local");

  await page.getByRole("button", { name: "Dodaj ogłoszenie" }).click();
  await page.waitForURL("/dashboard");

  const href = await page.getByRole("link", { name: "Edytuj" }).first().getAttribute("href");
  const match = href?.match(/\/dashboard\/listings\/([^/]+)\/edit/);
  if (!match) throw new Error(`Could not extract listingId from href: ${href}`);
  listingId = match[1];

  await page.goto(href!);

  await expect(page.getByLabel("Typ ogłoszenia")).toHaveValue("occasional-rental");
  await expect(page.getByLabel("Adres nieruchomości")).toHaveValue(address);
  await expect(page.getByLabel("Imię i nazwisko właściciela")).toHaveValue("Anna Testowa");
  await expect(page.getByLabel("Telefon właściciela")).toHaveValue("+48 600 000 001");
  await expect(page.getByLabel("E-mail właściciela")).toHaveValue("anna@test.local");
});

test("edit listing → reload edit page → all 5 updated fields persist", async () => {
  await page.goto(`/dashboard/listings/${listingId}/edit`);

  await page.getByLabel("Typ ogłoszenia").selectOption("sale");
  await page.getByLabel("Adres nieruchomości").clear();
  await page.getByLabel("Adres nieruchomości").fill("ul. Zmieniona 99, Kraków");
  await page.getByLabel("Imię i nazwisko właściciela").clear();
  await page.getByLabel("Imię i nazwisko właściciela").fill("Piotr Zmieniony");
  await page.getByLabel("Telefon właściciela").clear();
  await page.getByLabel("Telefon właściciela").fill("+48 700 000 002");
  await page.getByLabel("E-mail właściciela").clear();
  await page.getByLabel("E-mail właściciela").fill("piotr@test.local");

  await page.getByRole("button", { name: "Zapisz zmiany" }).click();
  await page.waitForURL("/dashboard");

  await page.goto(`/dashboard/listings/${listingId}/edit`);

  await expect(page.getByLabel("Typ ogłoszenia")).toHaveValue("sale");
  await expect(page.getByLabel("Adres nieruchomości")).toHaveValue("ul. Zmieniona 99, Kraków");
  await expect(page.getByLabel("Imię i nazwisko właściciela")).toHaveValue("Piotr Zmieniony");
  await expect(page.getByLabel("Telefon właściciela")).toHaveValue("+48 700 000 002");
  await expect(page.getByLabel("E-mail właściciela")).toHaveValue("piotr@test.local");
});
