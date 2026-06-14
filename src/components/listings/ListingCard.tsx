import type { Listing } from "@/types/listings";
import { formatPLN } from "@/lib/utils";
import { PenLine, Tag, FileText, Users, CircleCheck, RotateCcw, Trash2 } from "lucide-react";

interface Props {
  listing: Listing;
  agentNet?: number | null;
}

const iconBtn =
  "flex items-center justify-center size-[22px] rounded-md bg-white/[0.06] text-white/40 hover:bg-white/[0.10] hover:text-white/70 transition-colors";
const deleteBtn =
  "flex items-center justify-center size-[22px] rounded-md bg-red-500/[0.08] text-red-400/60 hover:bg-red-500/[0.14] hover:text-red-400 transition-colors";

export default function ListingCard({ listing, agentNet = null }: Props) {
  const isActive = listing.status === "active";

  function handleDelete(e: React.MouseEvent<HTMLButtonElement>) {
    if (!window.confirm("Czy na pewno chcesz usunąć to ogłoszenie? Tej operacji nie można cofnąć.")) {
      e.preventDefault();
    }
  }

  return (
    <div className="flex items-center border-b border-white/[0.05] py-[18px] transition-colors hover:bg-white/[0.03]">
      {/* Address / Owner */}
      <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-4">
        <span className={`size-[7px] flex-shrink-0 rounded-full ${isActive ? "bg-green-500" : "bg-white/20"}`} />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-white">{listing.address}</p>
          {listing.owner_name && <p className="truncate text-[12px] text-white/50">{listing.owner_name}</p>}
        </div>
      </div>

      {/* Type */}
      <div className="w-28">
        <span
          className={`inline-flex rounded-full px-2.5 py-[3px] text-[11px] font-medium ${
            listing.type === "sale" ? "bg-blue-500/[0.12] text-blue-300" : "bg-sky-500/[0.12] text-sky-300"
          }`}
        >
          {listing.type === "sale" ? "Sprzedaż" : "Najem"}
        </span>
      </div>

      {/* Price */}
      <div className="w-[130px]">
        {listing.asking_price ? (
          <p className="text-[13px] font-bold text-white">{formatPLN(listing.asking_price)}</p>
        ) : (
          <p className="text-[13px] text-white/30">Brak ceny</p>
        )}
        {!isActive && agentNet !== null && (
          <p className="mt-0.5 text-[11px] text-green-400">Zysk: {formatPLN(agentNet)}</p>
        )}
      </div>

      {/* Status */}
      <div className="w-[90px]">
        <span
          className={`inline-flex rounded-full px-2.5 py-[3px] text-[11px] font-medium ${
            isActive ? "bg-green-500/[0.12] text-green-300" : "bg-white/[0.07] text-white/40"
          }`}
        >
          {isActive ? "Aktywne" : "Ukończone"}
        </span>
      </div>

      {/* Actions */}
      <div className="flex w-[156px] items-center gap-1">
        <a href={`/dashboard/listings/${listing.id}/edit`} className={iconBtn} title="Edytuj">
          <PenLine size={12} />
        </a>
        <a href={`/dashboard/listings/${listing.id}/pricing`} className={iconBtn} title="Cena i prowizja">
          <Tag size={12} />
        </a>
        <a href={`/dashboard/listings/${listing.id}/documents`} className={iconBtn} title="Dokumenty">
          <FileText size={12} />
        </a>
        <a href={`/dashboard/listings/${listing.id}/contacts`} className={iconBtn} title="Kontakty">
          <Users size={12} />
        </a>
        {isActive ? (
          <a href={`/dashboard/listings/${listing.id}/close`} className={iconBtn} title="Zakończ transakcję">
            <CircleCheck size={12} />
          </a>
        ) : (
          <form method="POST" action={`/api/listings/${listing.id}/reopen`}>
            <button type="submit" className={iconBtn} title="Wznów transakcję">
              <RotateCcw size={12} />
            </button>
          </form>
        )}
        <form method="POST" action={`/api/listings/${listing.id}/delete`}>
          <button type="submit" onClick={handleDelete} className={deleteBtn} title="Usuń">
            <Trash2 size={12} />
          </button>
        </form>
      </div>
    </div>
  );
}
