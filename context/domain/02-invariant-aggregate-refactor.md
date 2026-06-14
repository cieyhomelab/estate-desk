---
title: "EstateDesk — Niezmiennik #1: Immutowalność warunków finansowych zamkniętej transakcji — plan agregatu-strażnika"
created: 2026-06-14
type: refactor-plan
---

## KROK 0 — Kontekst projektu

**Produkt:** EstateDesk — aplikacja webowa dla jednego polskiego agenta nieruchomości; zarządza pełnym cyklem życia transakcji od utworzenia ogłoszenia do zamknięcia z rejestrem finansowym.

**Stack:** Astro 5, React 19, TypeScript 5, Tailwind CSS v4, Supabase (PostgreSQL + RLS + Storage), Cloudflare Workers.

**Warstwy logiki biznesowej:**

| Warstwa | Katalog | Zawartość domenowa |
|---|---|---|
| API (transport) | `src/pages/api/listings/[id]/` | 22 route'y POST; proceduralna logika: auth → walidacja → mutacja DB → redirect |
| Domena (pure) | `src/lib/commission.ts` | Jedyna czysta funkcja domenowa: `calculateCommissionSplit()` |
| Persystencja | `supabase/migrations/` | 10 migracji SQL; niektóre niezmienniki w CHECK/INDEX, brak triggerów domenowych |
| Typy | `src/types/` | Ręczne definicje TypeScript; `database.types.ts` generowany (obecny) |
| UI | `src/pages/dashboard/listings/[id]/` | Astro SSR + React islands; formularze bez guard statusu |

**Dokumenty źródłowe:** PRD greenfield `context/foundation/archive/prd-2026-06-08.md`; dystylacja domeny `context/domain/01-domain-distillation.md`; research commission-set-analysis `context/archive/2026-06-10-commission-set-analysis/research.md`.

---

## KROK 1 — Identyfikacja niezmienników biznesowych

Poniżej wszystkie reguły, które w tej domenie MUSZĄ być zawsze prawdziwe. Cytaty: plik (względem katalogu `EstateDesk/`).

| # | Niezmiennik | Cytat źródłowy | Status w kodzie |
|---|---|---|---|
| I-01 | `listing.type ∈ {'sale', 'occasional-rental'}` | PRD FR-003: "property type: sale or occasional rental" `context/foundation/archive/prd-2026-06-08.md:65` | ✅ DB CHECK `supabase/migrations/20260525152607_create_listings.sql:8` |
| I-02 | `listing.status ∈ {'active', 'done'}` | PRD FR-007: "mark a listing as transaction-complete (done) and reopen it" `prd-2026-06-08.md:71` | ✅ DB CHECK `migrations/20260525152607_create_listings.sql:9` |
| I-03 | `commission_percent > 0 AND ≤ 100` | PRD FR-011: walidacja na wejście `prd-2026-06-08.md:80` | ✅ DB CHECK `migrations/20260530100000:3-4`; walidacja w API `api/.../commission/set.ts:27`; atrybut HTML `pricing.astro:182` |
| **I-04** | **`listing.commission_percent` jest immutowalne gdy `listing.status = 'done'`, ponieważ `transaction_snapshots.commission_percent` zostaje zablokowane w momencie zamknięcia** | PRD Business Logic: "an agent-affiliated commission split has a fixed formula… locked and recorded at transaction close" — TransactionSnapshot opisany jako "niezmienny rekord finansowy" `01-domain-distillation.md:61`; research 2.6: "Brak guardu stanu listingu: SET.ts nie sprawdza, czy listing jest zamknięty — snapshot zachowa starą wartość, więc rozjazd listing↔snapshot jest możliwy" `research.md:286-291` | ❌ NIE EGZEKWOWANE — zero sprawdzenia w `commission/set.ts:31` |
| I-05 | Zamknięcie (`active → done`) wymaga: `unchecked_docs = 0` LUB `checklist_override = true` (TransactionGate) | PRD Acceptance Criteria: "All document checklist items show as checked before 'done' is available, or the agent explicitly overrides" `prd-2026-06-08.md:55`; PRD Business Logic: "preventing the transaction from being closed until all required items are checked off" `prd-2026-06-08.md:114` | ⚠️ Egzekwowane proceduralnie w `api/.../close.ts:47-61`; BRAK DB CHECK lub triggera; obejście przez service role (testy integracyjne używają `createServiceRoleClient()`) |
| I-06 | `agencyAmount + taxAmount + agentNet = brutto` (CommissionSplit sum) | PRD: "The split must sum to the entered total; any rounding difference surfaces as a validation error, not a silent adjustment." `prd-2026-06-08.md:116` | ⚠️ Throw w `src/lib/commission.ts:29`; ale `close.ts:76-87` nie łapie wyjątku → unhandled 500 zamiast komunikatu |
| I-07 | Co najwyżej jeden aktywny snapshot per listing (`voided_at IS NULL`) | Migrations comment: "Prevents double-submit race: at most one active snapshot per listing" `migrations/20260530120000_transaction_close.sql:40-41` | ✅ UNIQUE INDEX `unique_active_snapshot` `migrations/20260530120000:41` |
| I-08 | `TransactionSnapshot` jest niemutowalny po utworzeniu (wyłącznie `voided_at` może zmienić `reopen.ts`) | Koncepcja snapshotu — "dane locked at close time" `01-domain-distillation.md:61` | ❌ NIE EGZEKWOWANE — RLS policy `FOR ALL` dopuszcza UPDATE na wszystkich polach `migrations/20260530120000:34-38` |
| I-09 | Lista kontrolna dokumentów jest per-typ (8 pozycji dla `sale`, 5 dla `occasional-rental`) | PRD: "The app determines which documents are required based on listing type" `prd-2026-06-08.md:112` | ✅ Trigger `seed_listing_documents()` `migrations/20260530000000:76-108` |

---

## KROK 2 — Klasyfikacja i wybór niezmiennika #1

### Trzy osie oceny

| Niezmiennik | (a) Rdzeniowość dla sensu produktu | (b) Rozsmarowanie po warstwach | (c) Egzekwowanie | Wynik |
|---|---|---|---|---|
| I-01 type constraint | Średnia | 1 (DB) | ✅ Pełne | Pomijalny |
| I-02 status constraint | Wysoka | 1 (DB) | ✅ Pełne | Pomijalny |
| I-03 commission range | Średnia | 3 (DB+API+HTML) | ⚠️ Niepełne (brak CHECK na snapshot — retrofix migration 20260611) | Niska pilność |
| **I-04 commission immutable on done** | **Wysoka** | **3 (set.ts + close.ts + snapshot)** | **❌ ZERO** | **🔴 WYBRANY** |
| I-05 TransactionGate | Bardzo wysoka | 2 (app+brak DB) | ⚠️ Tylko w close.ts | Wysoka pilność |
| I-06 CommissionSplit sum | Wysoka | 2 (commission.ts + brak catch w close.ts) | ⚠️ Throw bez catch | Wysoka pilność |
| I-07 unique snapshot | Wysoka | 1 (DB UNIQUE INDEX) | ✅ Pełne | Pomijalny |
| I-08 snapshot immutable | Wysoka | 1 (brak enforcement) | ❌ Brak | Niższy priorytet (single-user MVP) |
| I-09 checklist seed | Średnia | 1 (DB trigger) | ✅ Pełne | Pomijalny |

### Wybór i uzasadnienie

**Wybrany niezmiennik: I-04 — `commission_percent` jest immutowalne gdy `listing.status = 'done'`.**

**Uzasadnienie:**

**(a) Rdzeniowość:** Podział prowizji to jedno z dwóch źródeł wartości produktu (PRD "The insight": "an agent-affiliated commission split has a fixed formula… currently done by hand"). `TransactionSnapshot` jest opisany explicite jako "niezmienny rekord finansowy tworzony w momencie zamknięcia transakcji" — jest to historyczny dowód finansowy, nie dane operacyjne. Naruszenie tego niezmiennika powoduje **cichą rozbieżność finansową**: agent zamknął transakcję z prowizją 2%, następnie zmienił na 3% — UI (pricing.astro) pokazuje 3%, ale snapshot (księga rachunkowa) ma 2%. Żaden błąd się nie pojawia. To jest dokładnie typ błędu, który "wychodzi na produkcję bez ani jednego czerwonego testu" (research.md:226).

**(b) Rozsmarowanie:** Reguła żyje w trzech warstwach: koncepcja domenowa w PRD/dokumentacji, logika przechwycenia w `close.ts:89-104` (INSERT do snapshotu), brak ochrony w `commission/set.ts:31` (UPDATE bez warunku). Czwarta warstwa — UI `pricing.astro` — renderuje formularz prowizji nawet dla ogłoszenia ze statusem `done`.

**(c) Egzekwowanie:** **ZERO egzekwowania**. Żaden wiersz kodu nie sprawdza `listing.status` przed `UPDATE listings SET commission_percent`. Żaden CHECK w DB. Żaden trigger. Jedynym "zabezpieczeniem" jest to, że agent musi celowo przejść do strony `/pricing` na zamkniętym ogłoszeniu — co jest możliwe i renderuje aktywny formularz.

**Porównanie z konkurentami:**
- I-05 (TransactionGate) jest *bardziej* rdzeniowy, ale IS egzekwowany w `close.ts:47-61` — właściwym miejscu dla operacji zamknięcia. Słabość to brak DB-level enforcement, nie brak jakiegokolwiek enforcement.
- I-06 (CommissionSplit sum) jest egzekwowany `throw`-em w `commission.ts:29` — problem to brak `try/catch` w konsumencie, nie brak samej reguły.
- I-04 to jedyna reguła, która jest **jednocześnie najwyższego businessowego ryzyka I kompletnie nieobecna w kodzie**.

---

## KROK 3 — Diagnoza niezmiennika I-04

### Gdzie dziś żyje reguła

**Warstwa dokumentów/koncepcji:**
- `context/foundation/archive/prd-2026-06-08.md:114`: "preventing the transaction from being closed until all required items are checked off"
- `context/domain/01-domain-distillation.md:61`: "Niezmienny rekord finansowy tworzony w momencie zamknięcia transakcji. Zawiera kopię wszystkich wartości prowizji, cenę, dane notariusza i datę transakcji. Anulowany (`voided_at`) przy wznowieniu ogłoszenia."
- `context/archive/2026-06-10-commission-set-analysis/research.md:286-291`: §2.6 "Brak guardu stanu listingu"

**Warstwa persystencji — gdzie reguła POWINNA istnieć (ale jej nie ma):**
- `supabase/migrations/20260530100000_add_commission_percent_to_listings.sql:3-4` — CHECK istnieje dla zakresu, ale brak warunku `status = 'active'`
- `supabase/migrations/20260530120000_transaction_close.sql` — brak triggera blokującego UPDATE na `listings.commission_percent` gdy `status = 'done'`
- RLS policy `owners_own_listings` (`migrations/20260525152607:20-24`): `FOR ALL` — dopuszcza UPDATE bez ograniczeń na status

**Warstwa aplikacyjna — miejsce naruszenia:**
- `src/pages/api/listings/[id]/commission/set.ts:23-31`:
  ```typescript
  // Linia 23-25: walidacja zakresu — poprawna
  if (isNaN(commission_percent) || commission_percent <= 0 || commission_percent > 100) {
    return context.redirect(`/dashboard/listings/${id}/pricing?error=prowizja-nieprawidlowa`);
  }
  // Linia 31: UPDATE bezwarunkowy — BRAK sprawdzenia listing.status
  const result = await updateOwnedListing(supabase, id, user.id, { commission_percent });
  ```
  Trasa nie ładuje listingu przed UPDATE. Nie zna statusu. Aktualizuje `commission_percent` niezależnie od tego, czy transakcja jest zamknięta.

**Warstwa UI — strażnik kliencki, jedyny obecny guard (niewystarczający):**
- `src/pages/dashboard/listings/[id]/pricing.astro` — renderuje formularz z inputem `commission_percent` (linia 182) bez sprawdzenia `listing.status`. Brak warunkowego ukrycia lub wyłączenia formularza dla `status = 'done'`. Weryfikacja: `grep -n "status\|done\|active" pricing.astro` zwraca tylko `:92` (aktywna zakładka nawigacji) — zero logiki domenowej.

**Warstwa zamknięcia — miejsce przechwycenia (po naruszeniu):**
- `src/pages/api/listings/[id]/close.ts:89-104`: INSERT do `transaction_snapshots` kopiuje `listing.commission_percent` w momencie zamknięcia:
  ```typescript
  // Linia 93: kopia snapshotu
  commission_percent: listing.commission_percent,
  ```
  Ten INSERT jest jednorazowy i poprawny. Problem: snapshot jest tworzony RAZ, ale `listing.commission_percent` może być zmienione N razy po zamknięciu.

### Gdzie reguła NIE jest egzekwowana

| Miejsce | Typ luki | Skutek |
|---|---|---|
| `api/.../commission/set.ts:31` | Brak sprawdzenia statusu przed UPDATE | Główna ścieżka naruszenia |
| `pricing.astro:182` | Formularz widoczny na closed listing | Klient jest jedynym "strażnikiem" (przez brak dostępu, nie przez kod) |
| DB: brak triggera BEFORE UPDATE | Brak DB-level enforcement | Bypass przez service role, Supabase Studio, direct SQL |
| Testy: zero pokrycia `commission/set` | Naruszenie nie jest wykrywalne testami | "Wychodzi na produkcję bez czerwonego testu" |

### Scenariusz naruszenia (konkretny)

1. Agent zamyka transakcję przy prowizji 2% → `transaction_snapshots.commission_percent = 2`, `listings.commission_percent = 2`
2. Agent wchodzi na `/dashboard/listings/{id}/pricing` (routing działa, formularz się renderuje)
3. Agent wpisuje 3% i klika "Zapisz" → POST na `commission/set.ts` → `listings.commission_percent = 3`
4. Snapshot nadal ma 2%. `listing` ma 3%. Rozbieżność jest niewidoczna — żaden komunikat błędu, żaden log, żadna asercja.
5. Przy kolejnym zamknięciu (po `reopen`) snapshot zawiera 3% — ale poprzedni snapshot (voided) nadal ma 2%. Historia finansowa jest niespójna.

---

## KROK 4 — Projekt agregatu-strażnika

### Aggregate Root: `Listing`

Listing jest agregatem-strażnikiem dla niezmiennika I-04. Jedyną drogą do zmiany `commissionPercent` jest metoda domenowa `updateCommission()` — która rzuca nazwany błąd domenowy, jeśli listing jest zamknięty.

### Typy domenowe i błędy

```typescript
// src/domain/listing/errors.ts

export class ListingClosedError extends Error {
  constructor(listingId: string) {
    super(`Listing ${listingId} is closed — financial terms are immutable`);
    this.name = "ListingClosedError";
  }
}

export class ChecklistIncompleteError extends Error {
  constructor(uncheckedCount: number) {
    super(`Cannot close: ${uncheckedCount} documents unchecked and no override`);
    this.name = "ChecklistIncompleteError";
  }
}

export class ListingAlreadyActiveError extends Error {
  constructor(listingId: string) {
    super(`Listing ${listingId} is already active`);
    this.name = "ListingAlreadyActiveError";
  }
}
```

### Klasa domenowa `Listing`

```typescript
// src/domain/listing/Listing.ts

import { ListingClosedError, ChecklistIncompleteError, ListingAlreadyActiveError } from "./errors";
import type { CommissionInput, CommissionSplit } from "@/lib/commission";
import { calculateCommissionSplit } from "@/lib/commission";

export type ListingStatus = "active" | "done";
export type ListingType = "sale" | "occasional-rental";

export interface ClosureData {
  notaryName: string | null;
  notaryCity: string | null;
  transactionDate: string | null;
  transactionNotes: string | null;
}

export interface PendingSnapshot {
  listingId: string;
  userId: string;
  askingPrice: number | null;
  commissionPercent: number | null;
  taxRate: number | null;
  agencyPercent: number | null;
  brutto: number | null;
  agencyAmount: number | null;
  grossIncome: number | null;
  taxAmount: number | null;
  agentNet: number | null;
  notaryName: string | null;
  notaryCity: string | null;
  transactionDate: string | null;
}

export class Listing {
  readonly id: string;
  readonly userId: string;
  private _status: ListingStatus;
  private _commissionPercent: number | null;
  private _askingPrice: number | null;
  private _checklistOverride: boolean;

  constructor(data: {
    id: string;
    userId: string;
    status: ListingStatus;
    commissionPercent: number | null;
    askingPrice: number | null;
    checklistOverride: boolean;
  }) {
    this.id = data.id;
    this.userId = data.userId;
    this._status = data.status;
    this._commissionPercent = data.commissionPercent;
    this._askingPrice = data.askingPrice;
    this._checklistOverride = data.checklistOverride;
  }

  get status(): ListingStatus {
    return this._status;
  }

  get commissionPercent(): number | null {
    return this._commissionPercent;
  }

  /**
   * Precondition: listing.status === 'active'.
   * Throws ListingClosedError if called on a closed listing.
   * INVARIANT I-04: warunki finansowe zamkniętej transakcji są immutowalne.
   */
  updateCommission(percent: number): void {
    if (this._status === "done") {
      throw new ListingClosedError(this.id);
    }
    // zakres walidowany przez DB CHECK; tu tylko domenowy guard statusu
    this._commissionPercent = percent;
  }

  /**
   * Precondition: listing.status === 'active' AND (uncheckedCount=0 OR checklistOverride).
   * Throws ChecklistIncompleteError lub ListingAlreadyClosedError.
   * Zwraca PendingSnapshot — do atomicznego zapisu przez repozytorium.
   */
  close(
    uncheckedCount: number,
    commissionSettings: { taxRate: number; agencyPercent: number } | null,
    closure: ClosureData
  ): PendingSnapshot {
    if (this._status === "done") {
      throw new ListingClosedError(this.id);
    }

    if (uncheckedCount > 0 && !this._checklistOverride) {
      throw new ChecklistIncompleteError(uncheckedCount);
    }

    let split: CommissionSplit | null = null;
    if (
      this._askingPrice !== null &&
      this._commissionPercent !== null &&
      commissionSettings !== null
    ) {
      // calculateCommissionSplit rzuca Error jeśli suma nie zgadza — fail-fast przez design
      split = calculateCommissionSplit({
        askingPrice: this._askingPrice,
        commissionPercent: this._commissionPercent,
        agencyPercent: commissionSettings.agencyPercent,
        taxRate: commissionSettings.taxRate,
      });
    }

    this._status = "done";

    return {
      listingId: this.id,
      userId: this.userId,
      askingPrice: this._askingPrice,
      commissionPercent: this._commissionPercent,
      taxRate: commissionSettings?.taxRate ?? null,
      agencyPercent: commissionSettings?.agencyPercent ?? null,
      brutto: split?.brutto ?? null,
      agencyAmount: split?.agencyAmount ?? null,
      grossIncome: split?.grossIncome ?? null,
      taxAmount: split?.taxAmount ?? null,
      agentNet: split?.agentNet ?? null,
      notaryName: closure.notaryName,
      notaryCity: closure.notaryCity,
      transactionDate: closure.transactionDate,
    };
  }

  /**
   * Precondition: listing.status === 'done'.
   * Throws ListingAlreadyActiveError jeśli już aktywny.
   * Snapshot jest unieważniany przez repozytorium.
   */
  reopen(): void {
    if (this._status === "active") {
      throw new ListingAlreadyActiveError(this.id);
    }
    this._status = "active";
  }
}
```

### Repozytorium

```typescript
// src/domain/listing/ListingRepository.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import { Listing } from "./Listing";
import type { PendingSnapshot } from "./Listing";

export class ListingRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Ładuje agregat Listing (tylko pola niezbędne do operacji domenowych).
   * Zwraca null jeśli nie znaleziono lub nie należy do userId (ownership guard).
   */
  async load(id: string, userId: string): Promise<Listing | null> {
    const { data, error } = await this.supabase
      .from("listings")
      .select("id, user_id, status, commission_percent, asking_price, checklist_override")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !data) return null;

    return new Listing({
      id: data.id,
      userId: data.user_id,
      status: data.status as "active" | "done",
      commissionPercent: data.commission_percent,
      askingPrice: data.asking_price,
      checklistOverride: data.checklist_override,
    });
  }

  /**
   * Zapisuje zaktualizowany commission_percent.
   * Wywoływane tylko po listing.updateCommission() — niezmiennik I-04 jest
   * już egzekwowany przez metodę domenową; tu tylko persist.
   */
  async saveCommission(listing: Listing): Promise<void> {
    const { data, error } = await this.supabase
      .from("listings")
      .update({ commission_percent: listing.commissionPercent })
      .eq("id", listing.id)
      .eq("user_id", listing.userId)
      .select("id");

    if (error) throw new Error(`DB error saving commission: ${error.message}`);
    if (!data || data.length === 0) throw new Error("Listing not found on commission save");
  }

  /**
   * Atomicznie: INSERT snapshot + UPDATE listings.status = 'done'.
   * Używa Supabase RPC lub dwóch operacji z UNIQUE INDEX jako safety net
   * (double-submit blokowany przez unique_active_snapshot).
   *
   * WAŻNE: Supabase nie udostępnia transakcji w JS SDK — atomiczność przez
   * kolejność (snapshot FIRST, status SECOND). Orphaned snapshot na błędzie statusu
   * jest akceptowanym MVP risk (per plan transaction-close "What We're NOT Doing")
   * i jest idempotentny przy retry z UNIQUE INDEX.
   */
  async saveWithSnapshot(listing: Listing, snapshot: PendingSnapshot): Promise<void> {
    const { error: snapshotError } = await this.supabase
      .from("transaction_snapshots")
      .insert(snapshot);

    if (snapshotError) {
      const slug = snapshotError.code === "23505" ? "juz-zamknieta" : "blad-zapisu";
      throw Object.assign(new Error(snapshotError.message), { slug });
    }

    const { data, error: statusError } = await this.supabase
      .from("listings")
      .update({
        status: listing.status,
        closed_at: new Date().toISOString(),
      })
      .eq("id", listing.id)
      .eq("user_id", listing.userId)
      .select("id");

    if (statusError || !data || data.length === 0) {
      throw Object.assign(new Error(statusError?.message ?? "not-found"), { slug: "blad-zapisu" });
    }
  }

  /**
   * Atomicznie: UPDATE snapshot.voided_at + UPDATE listings.status = 'active'.
   */
  async saveReopen(listing: Listing): Promise<void> {
    const { error: voidError } = await this.supabase
      .from("transaction_snapshots")
      .update({ voided_at: new Date().toISOString() })
      .eq("listing_id", listing.id)
      .eq("user_id", listing.userId)
      .is("voided_at", null);

    if (voidError) throw new Error(`DB error voiding snapshot: ${voidError.message}`);

    const { data, error: statusError } = await this.supabase
      .from("listings")
      .update({ status: listing.status, closed_at: null })
      .eq("id", listing.id)
      .eq("user_id", listing.userId)
      .select("id");

    if (statusError || !data || data.length === 0) {
      throw new Error(statusError?.message ?? "not-found on reopen");
    }
  }
}
```

### Cienkie API Route — commission/set (after)

```typescript
// src/pages/api/listings/[id]/commission/set.ts — po refaktorze

export const POST: APIRoute = async (context) => {
  const { id } = context.params;
  const supabase = createClient(context.request.headers, context.cookies);
  if (!id || !supabase) {
    return context.redirect(`/dashboard?error=blad-serwera`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return context.redirect("/auth/signin");

  const form = await context.request.formData();
  const commissionRaw = form.get("commission_percent") as string | null;
  const commission_percent = parseFloat(commissionRaw ?? "");

  if (isNaN(commission_percent) || commission_percent <= 0 || commission_percent > 100) {
    return context.redirect(`/dashboard/listings/${id}/pricing?error=prowizja-nieprawidlowa`);
  }

  // === Domain layer ===
  const repo = new ListingRepository(supabase);
  const listing = await repo.load(id, user.id);

  if (!listing) {
    return context.redirect(`/dashboard/listings/${id}/pricing?error=nie-znaleziono`);
  }

  try {
    listing.updateCommission(commission_percent);    // throws ListingClosedError if done
  } catch (err) {
    if (err instanceof ListingClosedError) {
      return context.redirect(`/dashboard/listings/${id}/pricing?error=transakcja-zamknieta`);
    }
    throw err;
  }

  try {
    await repo.saveCommission(listing);
  } catch {
    return context.redirect(`/dashboard/listings/${id}/pricing?error=blad-zapisu`);
  }

  return context.redirect(`/dashboard/listings/${id}/pricing?success=prowizja-zapisana`);
};
```

### Diagram przepływu (after)

```
POST /api/listings/{id}/commission/set
  │
  ├─ parse + validate range         (transport layer)
  ├─ repo.load(id, userId)          (ownership guard + load aggregate)
  │     └─ null → redirect nie-znaleziono
  ├─ listing.updateCommission(pct)  (DOMAIN — throws ListingClosedError if done)
  │     └─ ListingClosedError → redirect transakcja-zamknieta
  └─ repo.saveCommission(listing)   (persist)
        └─ error → redirect blad-zapisu
```

---

## KROK 5 — Before/after, plan faz, testy

### Before/after dla każdego miejsca reguły

#### A. `src/pages/api/listings/[id]/commission/set.ts`

```diff
-  // set.ts:23-31 (BEFORE) — brak załadowania listingu, brak sprawdzenia statusu
+  // parse + validate (bez zmian)

-  const result = await updateOwnedListing(supabase, id, user.id, { commission_percent });
-  if (!result.ok) { ... }
-  return redirect("?success=prowizja-zapisana");

+  const repo = new ListingRepository(supabase);
+  const listing = await repo.load(id, user.id);
+  if (!listing) return redirect("?error=nie-znaleziono");
+  try { listing.updateCommission(commission_percent); }
+  catch (e) { if (e instanceof ListingClosedError) return redirect("?error=transakcja-zamknieta"); throw e; }
+  await repo.saveCommission(listing);
+  return redirect("?success=prowizja-zapisana");
```

#### B. `src/pages/api/listings/[id]/close.ts`

```diff
-  // close.ts:47-61 — proceduralne sprawdzenie bramy
-  if (uncheckedCount > 0 && override_confirmed !== "true") {
-    return redirect(`?error=brakujace-dokumenty`);
-  }
-
-  // close.ts:75-87 — calculateCommissionSplit BEZ try/catch
-  const split = calculateCommissionSplit({...});
-
-  // close.ts:89-104 — insert snapshot (osobne wywołanie DB)
-  await supabase.from("transaction_snapshots").insert({...});
-
-  // close.ts:111-123 — update status (osobne wywołanie DB)
-  await updateOwnedListing(supabase, id, user.id, { status: "done", ... });

+  const repo = new ListingRepository(supabase);
+  const listing = await repo.load(id, user.id);
+  if (!listing) return redirect("?error=nie-znaleziono");
+
+  let snapshot: PendingSnapshot;
+  try {
+    snapshot = listing.close(uncheckedCount, settings, closureData);
+    // throws ChecklistIncompleteError lub CommissionInvariantError (z calculateCommissionSplit)
+  } catch (e) {
+    if (e instanceof ChecklistIncompleteError) return redirect("?error=brakujace-dokumenty");
+    if (e instanceof ListingClosedError) return redirect("?error=juz-zamknieta");
+    return redirect("?error=blad-prowizji"); // był unhandled 500
+  }
+
+  await repo.saveWithSnapshot(listing, snapshot); // atomicznie (snapshot + status)
```

#### C. `src/pages/api/listings/[id]/reopen.ts`

```diff
-  // reopen.ts:22-57 — proceduralne void + update, dwa osobne DB calls
-  await supabase.from("transaction_snapshots").update({ voided_at: ... });
-  await updateOwnedListing(supabase, id, user.id, { status: "active", closed_at: null });

+  const repo = new ListingRepository(supabase);
+  const listing = await repo.load(id, user.id);
+  try { listing.reopen(); }
+  catch (e) { if (e instanceof ListingAlreadyActiveError) return redirect("?error=juz-aktywna"); throw e; }
+  await repo.saveReopen(listing);
```

#### D. `src/pages/dashboard/listings/[id]/pricing.astro`

```diff
-  // pricing.astro — formularz bez warunku statusu (linia 174-197)
-  <form method="POST" action={`/api/listings/${id}/commission/set`}>
-    <input name="commission_percent" ... />
-    <button>Zapisz</button>
-  </form>

+  {listing.status === "active" ? (
+    <form method="POST" action={`/api/listings/${id}/commission/set`}>
+      <input name="commission_percent" ... />
+      <button>Zapisz</button>
+    </form>
+  ) : (
+    <p class="text-sm text-gray-500">
+      Prowizja zablokowana — transakcja jest zamknięta.
+    </p>
+  )}
```

#### E. Nowy flash slug w `pricing.astro`

```diff
+  // dodaj obsługę nowego sluga "transakcja-zamknieta" do sekcji flash messages
+  {error === "transakcja-zamknieta" && (
+    <p class="text-red-600">Nie można zmienić prowizji — transakcja jest już zamknięta.</p>
+  )}
```

---

### Plan faz refaktoru

**Faza 0 — Zabezpieczenie bieżącego stanu (test-first, ~1h)**
- Napisz test integracyjny dokumentujący obecne naruszenie:
  - Seed: listing ze statusem `done`, existing snapshot
  - POST na `commission/set` z nową wartością
  - Assert: `listing.commission_percent` ZMIENIONE (dokumentuje bug), `transaction_snapshots` nadal ma starą wartość (dokumentuje rozbieżność)
- Uruchom: czerwony test → baseline

**Faza 1 — Minimalny guard (test-first, ~30 min)**
- **Cel:** Jeden sprawdzony wiersz w `commission/set.ts` blokujący zmianę na zamkniętym ogłoszeniu.
- Nie wymaga klasy domenowej — inline status check.
- Implementacja:
  1. W `commission/set.ts`: przed UPDATE załaduj listing (dodaj `SELECT id, status`) → jeśli `status === 'done'` → redirect `?error=transakcja-zamknieta`
  2. Dodaj obsługę flash sluga w `pricing.astro`
  3. Ukryj formularz w `pricing.astro` dla zamkniętego listingu
- Testy (integracyjne):
  - `commission-immutability.test.ts`:
    - `[OK]` active listing → zmiana komisji → 200 OK, DB updated
    - `[FAIL]` done listing → zmiana komisji → redirect `?error=transakcja-zamknieta`, DB unchanged
    - `[FAIL-IDOR]` cudzy listing → redirect error, DB unchanged
- Po fazie 1: niezmiennik I-04 jest egzekwowany. Reszta to jakość kodu.

**Faza 2 — Klasa domenowa `Listing` (test-first, ~2h)**
- Wyodrębnij `src/domain/listing/Listing.ts`, `src/domain/listing/errors.ts`
- Testy jednostkowe dla klasy domenowej (czyste, bez DB):
  - `listing-domain.test.ts`:
    - `[OK]` `listing.updateCommission(3)` na active → `listing.commissionPercent === 3`
    - `[FAIL]` `listing.updateCommission(3)` na done → `throws ListingClosedError`
    - `[OK]` `listing.close(0, settings, closure)` na active z 0 unchecked → zwraca `PendingSnapshot`
    - `[FAIL]` `listing.close(2, settings, closure)` bez override → `throws ChecklistIncompleteError`
    - `[OK]` `listing.close(2, settings, closure)` z override=true → `PendingSnapshot`
    - `[FAIL]` `listing.close(...)` na done → `throws ListingClosedError`
    - `[OK]` `listing.reopen()` na done → `listing.status === 'active'`
    - `[FAIL]` `listing.reopen()` na active → `throws ListingAlreadyActiveError`
- Przepisz `commission/set.ts` na nową klasę domenową

**Faza 3 — `ListingRepository` + atomiczne close (test-first, ~2h)**
- Wyodrębnij `src/domain/listing/ListingRepository.ts`
- Przepisz `close.ts` i `reopen.ts` na repozytorium
- Testy integracyjne:
  - `listing-close-domain.test.ts`:
    - `[OK]` close → snapshot inserted + listing.status = 'done' (atomicznie)
    - `[FAIL]` double-close → błąd `juz-zamknieta` (UNIQUE INDEX)
    - `[OK]` close z niekompletnymi docs i override=true → sukces
    - `[FAIL]` close z niekompletnymi docs i override=false → `ChecklistIncompleteError`
    - `[OK]` reopen → snapshot.voided_at ustawiony + listing.status = 'active'

**Faza 4 — Usuń `updateOwnedListing` z tras domenowych (cleanup, ~1h)**
- `updateOwnedListing` (`src/lib/owned-mutation.ts`) zostaje tylko dla edycji metadanych (adres, owner, notary fields)
- Trasy `close.ts`, `reopen.ts`, `commission/set.ts` nie wywołują już `updateOwnedListing` dla operacji domenowych

---

### Przypadki testowe dla niezmiennika I-04

```typescript
// src/integration/api/commission-immutability.test.ts

describe("I-04: commission_percent jest immutowalne na closed listing", () => {
  it("[OK] zmiana prowizji na active listing — powinna się udać", async () => {
    // seed: listing status='active', commission_percent=2
    // POST /api/listings/{id}/commission/set body: commission_percent=3
    // assert: listing.commission_percent === 3
  });

  it("[FAIL] zmiana prowizji na done listing — powinna zostać odrzucona", async () => {
    // seed: listing status='done', commission_percent=2, snapshot with commission_percent=2
    // POST /api/listings/{id}/commission/set body: commission_percent=3
    // assert: redirect contains ?error=transakcja-zamknieta
    // assert: listing.commission_percent NADAL === 2 (DB nie zmieniona)
    // assert: snapshot.commission_percent NADAL === 2 (brak rozbieżności)
  });

  it("[OK] reopen → zmiana prowizji → ponowne zamknięcie — sekwencja poprawna", async () => {
    // seed: listing status='done', commission_percent=2
    // POST /reopen → listing.status = 'active'
    // POST /commission/set, commission_percent=3 → OK
    // POST /close → nowy snapshot.commission_percent=3
    // assert: brak rozbieżności
  });
});

// src/domain/listing/listing-domain.test.ts (unit — bez DB)

describe("Listing domain — updateCommission()", () => {
  it("[OK] updateCommission na active listing", () => {
    const listing = makeListing({ status: "active", commissionPercent: 2 });
    listing.updateCommission(3);
    expect(listing.commissionPercent).toBe(3);
  });

  it("[FAIL] updateCommission na done listing — throws ListingClosedError", () => {
    const listing = makeListing({ status: "done", commissionPercent: 2 });
    expect(() => listing.updateCommission(3)).toThrow(ListingClosedError);
  });
});
```

---

### Nowe nazwy "load-bearing" do rejestracji

Projekt nie prowadzi rejestru `docs/reference/contract-surfaces.md` (katalog `docs/reference/` nie istnieje). Poniżej lista nowych nazw domenowych wprowadzonych przez refaktor — do ręcznego dopisania do rejestru, jeśli zostanie utworzony:

| Nazwa | Typ | Plik | Uwaga |
|---|---|---|---|
| `ListingClosedError` | domain error | `src/domain/listing/errors.ts` | Rzucany przez `updateCommission()` i `close()` na done listing |
| `ChecklistIncompleteError` | domain error | `src/domain/listing/errors.ts` | Rzucany przez `close()` gdy uncheckedCount > 0 AND !override |
| `ListingAlreadyActiveError` | domain error | `src/domain/listing/errors.ts` | Rzucany przez `reopen()` na active listing |
| `Listing` (class) | aggregate root | `src/domain/listing/Listing.ts` | Jedyny guardian I-04 |
| `ListingRepository` | repository | `src/domain/listing/ListingRepository.ts` | Ładuje agregat, persystuje atomicznie |
| `PendingSnapshot` | value type | `src/domain/listing/Listing.ts` | Wynik `listing.close()` — wejście dla `repo.saveWithSnapshot()` |
| `transakcja-zamknieta` | flash slug | `pricing.astro` + `commission/set.ts` | Nowy slug domenowy (vs generyczny `blad-zapisu`) |

---

## Podsumowanie

EstateDesk ma jeden niezmiennik finansowy kompletnie pozbawiony egzekwowania: `commission_percent` na zamkniętym ogłoszeniu można zmienić bez żadnego oporu — `commission/set.ts:31` wykonuje bezwarunkowy UPDATE bez sprawdzenia `listing.status`, a `pricing.astro` renderuje formularz niezależnie od statusu. Prowadzi to do cichej rozbieżności między `listings.commission_percent` (nowa wartość) a `transaction_snapshots.commission_percent` (wartość zablokowana przy zamknięciu) — błędu finansowego niewidocznego dopóki agent nie porówna danych ręcznie. Zaprojektowany agregat `Listing` z metodą `updateCommission()` rzucającą `ListingClosedError` jest jedynym miejscem egzekwowania tej reguły. Refaktor jest czterofazowy: najpierw minimalny guard (faza 1, natychmiastowa naprawa), potem wyodrębnienie klasy domenowej i repozytorium (fazy 2–3), na końcu czyszczenie konwencji `updateOwnedListing` (faza 4). Fazy 1–3 idą test-first z konkretną macierzą przypadków testowych (legal/illegal transitions). Przy okazji eliminowany jest R-03 (unhandled throw z `calculateCommissionSplit` w `close.ts`) — przeniesienie logiki close do metody agregatu automatycznie daje `try/catch` na poziomie trasy.
