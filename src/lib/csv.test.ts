import { describe, expect, it } from "vitest";
import { listingsToCsv } from "./csv";
import type { Listing } from "../types/listings";

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "1",
    user_id: "u1",
    type: "sale",
    status: "active",
    address: "ul. Testowa 1, Warszawa",
    checklist_override: false,
    owner_name: "Jan Kowalski",
    owner_phone: null,
    owner_email: null,
    created_at: "2024-03-15T10:00:00Z",
    updated_at: "2024-03-15T10:00:00Z",
    asking_price: 500000,
    commission_percent: null,
    notary_name: null,
    notary_city: null,
    transaction_date: null,
    transaction_notes: null,
    closed_at: null,
    ...overrides,
  };
}

describe("listingsToCsv", () => {
  it("returns header row only for empty array", () => {
    const csv = listingsToCsv([]);
    expect(csv).toBe("Adres;Status;Cena wywoławcza;Właściciel;Data dodania;Data zamknięcia");
  });

  it("maps active status to Aktywne", () => {
    const csv = listingsToCsv([makeListing({ status: "active" })]);
    const [, row] = csv.split("\r\n");
    const cols = row.split(";");
    expect(cols[1]).toBe("Aktywne");
  });

  it("maps done status to Ukończone", () => {
    const csv = listingsToCsv([makeListing({ status: "done" })]);
    const [, row] = csv.split("\r\n");
    const cols = row.split(";");
    expect(cols[1]).toBe("Ukończone");
  });

  it("empty address renders as empty cell", () => {
    const csv = listingsToCsv([makeListing({ address: "" })]);
    const [, row] = csv.split("\r\n");
    const cols = row.split(";");
    expect(cols[0]).toBe("");
  });

  it("null asking_price renders as empty cell", () => {
    const csv = listingsToCsv([makeListing({ asking_price: null })]);
    const [, row] = csv.split("\r\n");
    const cols = row.split(";");
    expect(cols[2]).toBe("");
  });

  it("null owner_name renders as empty cell", () => {
    const csv = listingsToCsv([makeListing({ owner_name: null })]);
    const [, row] = csv.split("\r\n");
    const cols = row.split(";");
    expect(cols[3]).toBe("");
  });

  it("null closed_at renders as empty cell", () => {
    const csv = listingsToCsv([makeListing({ closed_at: null })]);
    const [, row] = csv.split("\r\n");
    const cols = row.split(";");
    expect(cols[5]).toBe("");
  });

  it("asking_price renders as plain integer string without locale formatting", () => {
    const csv = listingsToCsv([makeListing({ asking_price: 500000 })]);
    const [, row] = csv.split("\r\n");
    const cols = row.split(";");
    expect(cols[2]).toBe("500000");
  });

  it("dates are truncated to YYYY-MM-DD", () => {
    const csv = listingsToCsv([makeListing({ created_at: "2024-03-15T10:00:00Z", closed_at: "2024-07-20T14:30:00Z" })]);
    const [, row] = csv.split("\r\n");
    const cols = row.split(";");
    expect(cols[4]).toBe("2024-03-15");
    expect(cols[5]).toBe("2024-07-20");
  });

  // RFC 4180 §2.6: fields containing the delimiter must be enclosed in DQUOTE
  it("field containing semicolon is wrapped in double quotes", () => {
    const csv = listingsToCsv([makeListing({ address: "ul. A; B" })]);
    const [, row] = csv.split("\r\n");
    expect(row.startsWith('"ul. A; B"')).toBe(true);
  });

  // RFC 4180 §2.7: DQUOTE inside a quoted field is escaped by doubling it
  it("field containing double quote is escaped by doubling", () => {
    const csv = listingsToCsv([makeListing({ address: 'ul. "Testowa"' })]);
    const [, row] = csv.split("\r\n");
    expect(row.startsWith('"ul. ""Testowa"""')).toBe(true);
  });

  it("rows are joined with CRLF", () => {
    const csv = listingsToCsv([makeListing(), makeListing({ id: "2" })]);
    const parts = csv.split("\r\n");
    expect(parts).toHaveLength(3); // header + 2 rows
  });

  it("preserves array order", () => {
    const a = makeListing({ id: "1", address: "AAA" });
    const b = makeListing({ id: "2", address: "BBB" });
    const csv = listingsToCsv([a, b]);
    const [, row1, row2] = csv.split("\r\n");
    expect(row1.startsWith("AAA")).toBe(true);
    expect(row2.startsWith("BBB")).toBe(true);
  });
});
