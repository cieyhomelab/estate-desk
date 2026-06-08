import type { Listing } from "@/types/listings";
import { formatPLN } from "@/lib/utils";

interface Props {
  listing: Listing;
  agentNet?: number | null;
}

export default function ListingCard({ listing, agentNet = null }: Props) {
  const typeLabel = listing.type === "sale" ? "Sprzedaż" : "Najem okazjonalny";
  const statusLabel = listing.status === "active" ? "Aktywne" : "Ukończone";
  const statusBadgeClass =
    listing.status === "active" ? "bg-green-500/15 text-green-300" : "bg-white/[0.08] text-white/50";

  function handleDelete(e: React.MouseEvent<HTMLButtonElement>) {
    if (!window.confirm("Czy na pewno chcesz usunąć to ogłoszenie? Tej operacji nie można cofnąć.")) {
      e.preventDefault();
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.06] p-5 backdrop-blur-sm transition-colors hover:bg-white/[0.08]">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-base leading-snug font-semibold text-white">{listing.address}</h2>
        <div className="flex shrink-0 gap-1.5">
          <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-300">
            {typeLabel}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass}`}>{statusLabel}</span>
        </div>
      </div>

      {listing.owner_name && <p className="mb-2 text-sm text-white/50">{listing.owner_name}</p>}

      <p className={`font-semibold text-white ${listing.status === "done" ? "mb-1 text-lg" : "mb-4 text-xl"}`}>
        {listing.asking_price ? (
          formatPLN(listing.asking_price)
        ) : (
          <span className="text-base font-normal text-white/30">Brak ceny</span>
        )}
      </p>

      {listing.status === "done" && (
        <p className="mb-4 text-sm text-white/50">
          Zysk agenta: <span className="font-medium text-white">{agentNet !== null ? formatPLN(agentNet) : "—"}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <a
          href={`/dashboard/listings/${listing.id}/edit`}
          className="rounded-lg border border-white/[0.14] bg-white/[0.07] px-3 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/[0.12]"
        >
          Edytuj
        </a>
        <a
          href={`/dashboard/listings/${listing.id}/pricing`}
          className="rounded-lg border border-white/[0.14] bg-white/[0.07] px-3 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/[0.12]"
        >
          Cena i prowizja
        </a>
        <a
          href={`/dashboard/listings/${listing.id}/documents`}
          className="rounded-lg border border-white/[0.14] bg-white/[0.07] px-3 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/[0.12]"
        >
          Dokumenty
        </a>
        <a
          href={`/dashboard/listings/${listing.id}/contacts`}
          className="rounded-lg border border-white/[0.14] bg-white/[0.07] px-3 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/[0.12]"
        >
          Kontakty
        </a>
        {listing.status === "active" ? (
          <a
            href={`/dashboard/listings/${listing.id}/close`}
            className="rounded-lg border border-white/[0.14] bg-white/[0.07] px-3 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/[0.12]"
          >
            Zakończ transakcję
          </a>
        ) : (
          <form method="POST" action={`/api/listings/${listing.id}/reopen`}>
            <button
              type="submit"
              className="rounded-lg border border-white/[0.14] bg-white/[0.07] px-3 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/[0.12]"
            >
              Wznów transakcję
            </button>
          </form>
        )}
        <form method="POST" action={`/api/listings/${listing.id}/delete`}>
          <button
            type="submit"
            onClick={handleDelete}
            className="rounded-lg border border-red-500/20 bg-red-500/[0.07] px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/[0.14]"
          >
            Usuń
          </button>
        </form>
      </div>
    </div>
  );
}
