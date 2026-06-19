import { PencilLine, Tag, FileText, Users, CircleCheck, RotateCcw, Trash2 } from "lucide-react";
import type { Listing } from "@/types/listings";
import { formatPLN } from "@/lib/utils";

interface Props {
  listing: Listing;
  agentNet?: number | null;
}

export default function ListingRow({ listing, agentNet = null }: Props) {
  const lastComma = listing.address.lastIndexOf(",");
  const street = lastComma !== -1 ? listing.address.slice(0, lastComma).trim() : listing.address;
  const city = lastComma !== -1 ? listing.address.slice(lastComma + 1).trim() : null;

  function handleDelete(e: React.MouseEvent<HTMLButtonElement>) {
    if (!window.confirm("Czy na pewno chcesz usunąć to ogłoszenie? Tej operacji nie można cofnąć.")) {
      e.preventDefault();
    }
  }

  return (
    <div className="flex items-center border-b border-white/[0.05] py-[18px]">
      {/* Addr cell */}
      <div className="flex flex-1 items-center gap-[10px] pr-4">
        <div
          className={`h-[7px] w-[7px] shrink-0 rounded-full ${
            listing.status === "active" ? "bg-[#22c55e]" : "bg-white/[0.15]"
          }`}
        />
        <div className="flex flex-col gap-[3px]">
          <p className="text-[13px] font-semibold text-white">{street}</p>
          {listing.owner_name && (
            <p className="text-[12px] text-white/50">{city ? `${city} · ${listing.owner_name}` : listing.owner_name}</p>
          )}
        </div>
      </div>

      {/* Type cell */}
      <div className="w-[110px] shrink-0">
        {listing.type === "sale" ? (
          <span className="inline-flex items-center rounded-full border border-[#3b82f6]/[0.19] bg-[#1e3a5f] px-[10px] py-[4px] text-[11px] font-medium text-[#93c5fd]">
            Sprzedaż
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-[#38bdf8]/[0.19] bg-[#163040] px-[10px] py-[4px] text-[11px] font-medium text-[#38bdf8]">
            Najem okazjonalny
          </span>
        )}
      </div>

      {/* Price cell */}
      <div className="flex w-[130px] shrink-0 flex-col gap-[2px]">
        <p className="text-[13px] font-bold text-white">
          {listing.asking_price ? (
            formatPLN(listing.asking_price)
          ) : (
            <span className="font-normal text-white/30">Brak ceny</span>
          )}
        </p>
        {listing.status === "done" && agentNet !== null && (
          <p className="text-[11px] text-[#4ade80]">Zysk: {formatPLN(agentNet)}</p>
        )}
      </div>

      {/* Status cell */}
      <div className="w-[90px] shrink-0">
        {listing.status === "active" ? (
          <span className="inline-flex items-center rounded-full border border-[#22c55e]/[0.13] bg-[#0f2a1a] px-[10px] py-[4px] text-[11px] font-medium text-[#86efac]">
            Aktywne
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-white/[0.06] bg-[#1a1a2e] px-[10px] py-[4px] text-[11px] font-medium text-white/[0.31]">
            Ukończone
          </span>
        )}
      </div>

      {/* Actions cell */}
      <div className="flex w-[160px] shrink-0 items-center gap-[5px]">
        <a
          href={`/dashboard/listings/${listing.id}/edit`}
          title="Edytuj"
          className="flex size-[22px] items-center justify-center rounded-[6px] bg-white/[0.03] text-white/35 transition-colors hover:bg-white/[0.08] hover:text-white/60"
        >
          <PencilLine className="h-3 w-3" />
        </a>
        <a
          href={`/dashboard/listings/${listing.id}/pricing`}
          title="Cena i prowizja"
          className="flex size-[22px] items-center justify-center rounded-[6px] bg-white/[0.03] text-white/35 transition-colors hover:bg-white/[0.08] hover:text-white/60"
        >
          <Tag className="h-3 w-3" />
        </a>
        <a
          href={`/dashboard/listings/${listing.id}/documents`}
          title="Dokumenty"
          className="flex size-[22px] items-center justify-center rounded-[6px] bg-white/[0.03] text-white/35 transition-colors hover:bg-white/[0.08] hover:text-white/60"
        >
          <FileText className="h-3 w-3" />
        </a>
        <a
          href={`/dashboard/listings/${listing.id}/contacts`}
          title="Kontakty"
          className="flex size-[22px] items-center justify-center rounded-[6px] bg-white/[0.03] text-white/35 transition-colors hover:bg-white/[0.08] hover:text-white/60"
        >
          <Users className="h-3 w-3" />
        </a>
        {listing.status === "active" ? (
          <a
            href={`/dashboard/listings/${listing.id}/close`}
            title="Zakończ transakcję"
            className="flex size-[22px] items-center justify-center rounded-[6px] bg-white/[0.03] text-white/35 transition-colors hover:bg-white/[0.08] hover:text-white/60"
          >
            <CircleCheck className="h-3 w-3" />
          </a>
        ) : (
          <form method="POST" action={`/api/listings/${listing.id}/reopen`}>
            <button
              type="submit"
              title="Wznów transakcję"
              className="flex size-[22px] cursor-pointer items-center justify-center rounded-[6px] bg-white/[0.03] text-white/35 transition-colors hover:bg-white/[0.08] hover:text-white/60"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </form>
        )}
        <form method="POST" action={`/api/listings/${listing.id}/delete`}>
          <button
            type="submit"
            onClick={handleDelete}
            title="Usuń"
            className="flex size-[22px] cursor-pointer items-center justify-center rounded-[6px] bg-[#f87171]/[0.06] text-[#f87171] transition-colors hover:bg-[#f87171]/[0.12]"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </form>
      </div>
    </div>
  );
}
