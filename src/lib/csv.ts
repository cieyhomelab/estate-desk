import type { Listing } from "../types/listings";

const HEADER = "Adres;Status;Cena wywoławcza;Właściciel;Data dodania;Data zamknięcia";

const STATUS_LABELS: Record<string, string> = {
  active: "Aktywne",
  done: "Ukończone",
};

function escapeField(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function listingsToCsv(listings: Listing[]): string {
  const rows = [HEADER];
  for (const l of listings) {
    const fields = [
      escapeField(l.address),
      escapeField(STATUS_LABELS[l.status] ?? l.status),
      l.asking_price !== null ? String(l.asking_price) : "",
      escapeField(l.owner_name ?? ""),
      formatDate(l.created_at),
      formatDate(l.closed_at),
    ];
    rows.push(fields.join(";"));
  }
  return rows.join("\r\n");
}
