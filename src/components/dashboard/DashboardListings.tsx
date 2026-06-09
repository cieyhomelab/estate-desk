import { useState } from "react";
import type { Listing } from "@/types/listings";
import ListingCard from "@/components/listings/ListingCard";

interface Props {
  listings: Listing[];
  snapshotMap: Record<string, number | null>;
  hasError?: boolean;
}

interface FilterState {
  status: "all" | "active" | "done";
  priceMin: string;
  priceMax: string;
  city: string;
}

const defaultFilters: FilterState = { status: "all", priceMin: "", priceMax: "", city: "" };

export default function DashboardListings({ listings, snapshotMap, hasError = false }: Props) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  function toggleFilter() {
    if (filterOpen) {
      setFilters(defaultFilters);
    }
    setFilterOpen((prev) => !prev);
  }

  const filteredListings = listings.filter((listing) => {
    if (filters.status !== "all" && listing.status !== filters.status) return false;
    const min = filters.priceMin !== "" ? Number(filters.priceMin) : null;
    const max = filters.priceMax !== "" ? Number(filters.priceMax) : null;
    if (min !== null || max !== null) {
      if (listing.asking_price === null) return false;
      if (min !== null && !isNaN(min) && listing.asking_price < min) return false;
      if (max !== null && !isNaN(max) && listing.asking_price > max) return false;
    }
    if (filters.city !== "" && !(listing.address ?? "").toLowerCase().includes(filters.city.toLowerCase()))
      return false;
    return true;
  });

  const activeFilterCount =
    (filters.status !== "all" ? 1 : 0) +
    (filters.priceMin !== "" ? 1 : 0) +
    (filters.priceMax !== "" ? 1 : 0) +
    (filters.city !== "" ? 1 : 0);

  const countLabel =
    activeFilterCount > 0
      ? `Twoje oferty (${filteredListings.length} z ${listings.length})`
      : `Twoje oferty (${listings.length})`;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-white/35">{countLabel}</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={toggleFilter}
            className="relative rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/[0.09] hover:text-white/80"
          >
            Filtry
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-sm text-white/60 transition-colors hover:bg-white/[0.09] hover:text-white/80"
          >
            Eksport
          </button>
        </div>
      </div>

      {filterOpen && (
        <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.04] p-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Status</label>
              <div className="relative">
                <select
                  value={filters.status}
                  onChange={(e) => {
                    setFilters({ ...filters, status: e.target.value as FilterState["status"] });
                  }}
                  className="appearance-none rounded-lg border border-white/20 bg-slate-800 px-3 py-1.5 pr-8 text-sm text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
                >
                  <option value="all" className="bg-slate-800 text-white">
                    Wszystkie
                  </option>
                  <option value="active" className="bg-slate-800 text-white">
                    Aktywne
                  </option>
                  <option value="done" className="bg-slate-800 text-white">
                    Ukończone
                  </option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                  <svg className="h-4 w-4 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Cena od</label>
              <input
                type="number"
                value={filters.priceMin}
                onChange={(e) => {
                  setFilters({ ...filters, priceMin: e.target.value });
                }}
                placeholder="np. 300 000"
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Cena do</label>
              <input
                type="number"
                value={filters.priceMax}
                onChange={(e) => {
                  setFilters({ ...filters, priceMax: e.target.value });
                }}
                placeholder="np. 800 000"
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50">Miasto</label>
              <input
                type="text"
                value={filters.city}
                onChange={(e) => {
                  setFilters({ ...filters, city: e.target.value });
                }}
                placeholder="np. Warszawa"
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {listings.length === 0 && !hasError ? (
        <a
          href="/dashboard/listings/new"
          className="block rounded-xl border border-white/[0.08] bg-white/[0.04] p-12 text-center transition-colors hover:bg-white/[0.07]"
        >
          <p className="text-white/45">Brak ogłoszeń. Dodaj pierwsze ogłoszenie.</p>
        </a>
      ) : filteredListings.length === 0 && listings.length > 0 ? (
        <p className="py-12 text-center text-sm text-white/45">Brak ogłoszeń pasujących do filtrów.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} agentNet={snapshotMap[listing.id] ?? null} />
          ))}
        </div>
      )}
    </>
  );
}
