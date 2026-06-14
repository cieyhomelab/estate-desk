---
title: "EstateDesk — Anti-Corruption Layer: izolacja kształtu persystencji od warstwy domeny"
created: 2026-06-14
type: acl-plan
---

## KROK 0 — Kontekst

**Produkt:** EstateDesk — SSR web app dla agenta nieruchomości. Stack: Astro 5, React 19, TypeScript 5, Supabase (PostgreSQL + RLS + Storage), Cloudflare Workers.

**Zależności zewnętrzne (manifest):**
- `@supabase/supabase-js ^2.99.1` — klient QueryBuilder/SDK
- `@supabase/ssr ^0.10.3` — `createServerClient` (server-side cookies)
- `supabase` (devDependency, ^2.23.4) — CLI do generowania `src/types/database.types.ts`

**Warstwy kodu (zidentyfikowane):**

| Warstwa | Katalog | Zawartość |
|---|---|---|
| Typy | `src/types/` | Ręczne interfejsy + `database.types.ts` (generowany przez CLI) |
| Lib | `src/lib/` | Pure functions, adaptery infrastruktury |
| Komponenty | `src/components/**/*.tsx/.astro` | React islands + Astro komponenty UI |
| UI Pages | `src/pages/dashboard/**/*.astro` | SSR pages z logiką odczytu |
| API Routes | `src/pages/api/**/*.ts` | Mutacje, auth, wywołania zewnętrzne |
| Persystencja | `supabase/migrations/` | Schemat SQL, RLS policies, triggery |

**Dokumenty domeny:** `context/domain/01-domain-distillation.md`, `context/domain/02-invariant-aggregate-refactor.md`. Ten drugi zawiera projekt `ListingRepository` (ścieżka zapisu) — niniejszy dokument adresuje **ścieżkę odczytu**, która jest ACL-em nieomawianym w poprzednim planie.

---

## KROK 1 — IDENTYFIKACJA przeciekających zależności

### Zależność A — `Database["public"]["Tables"]["listings"]["Row"]` jako typ domenowy `Listing`

**Sygnał centralny:**
```
src/types/listings.ts:1   import type { Database } from "./database.types";
src/types/listings.ts:6   export type Listing = Database["public"]["Tables"]["listings"]["Row"];
```

Typ `Listing` to dosłownie alias DB row z 18 kolumnami snake_case, z polami infrastrukturalnymi (`user_id`, `updated_at`, `checklist_override`) i niestypowanymi polami (np. `status: string` zamiast `"active" | "done"`, choć `ListingStatus` jest zdefiniowane w tym samym pliku, `src/types/listings.ts:4`).

**Wszystkie pliki, które "znają" kształt DB row przez ten typ:**

| Plik | Linia | Sposób użycia |
|---|---|---|
| `src/types/listings.ts` | 1, 6 | źródło przecieku — alias DB row |
| `src/types/transaction.ts` | 1, 3 | `TransactionSnapshot = Database["public"]["Tables"]["transaction_snapshots"]["Row"]` — to samo wzorzec |
| `src/lib/csv.ts` | 1, 22 | `listingsToCsv(listings: Listing[])` — lib z dostępem do `l.asking_price`, `l.owner_name`, `l.closed_at`, `l.status`, `l.created_at` |
| `src/components/dashboard/DashboardListings.tsx` | 2, 7, 52–54 | React island: `listings: Listing[]` w interfejsie props; dostęp do `listing.asking_price` |
| `src/components/listings/ListingCard.tsx` | 1, 33, 36–37 | React komponent: `listing.owner_name`, `listing.asking_price` |
| `src/components/listings/ListingCard.astro` | 2, 36, 40–41 | Astro komponent: te same kolumny DB |
| `src/pages/dashboard.astro` | 9, 13, 26 | `.overrideTypes<Listing[], { merge: false }>()` — wynik query typowany jako DB row |
| `src/pages/dashboard/listings/[id]/close.astro` | 9, 29, 46, 76 | `.single<Listing>()`, `.maybeSingle<TransactionSnapshot>()` |
| `src/pages/dashboard/listings/[id]/contacts.astro` | 8, 26, 34 | `.single<Listing>()` |
| `src/pages/dashboard/listings/[id]/documents.astro` | 8, 11 | `Pick<Listing, "id" \| "type" \| "address" \| "status">` — Pick z kolumn DB |
| `src/pages/dashboard/listings/[id]/edit.astro` | 7, 13, 26 | `.single<Listing>()` |
| `src/pages/dashboard/listings/[id]/pricing.astro` | 10, 21, 37, 69, 71–72, 102, 154–172 | `.single<Listing>()` + dostęp do `listing.asking_price`, `listing.commission_percent` |
| `src/pages/api/listings/[id]/close.ts` | 3, 37 | `Pick<Listing, "id" \| "status" \| "asking_price" \| "commission_percent">` w API route |

### Zależność B — `SupabaseClient` w `src/lib/owned-mutation.ts` (wtórna)

```
src/lib/owned-mutation.ts:1   import type { SupabaseClient } from "@supabase/supabase-js";
src/lib/owned-mutation.ts:9   supabase: SupabaseClient,
```

Konsumenci: `commission/set.ts:31`, `documents/override.ts:26`, `price/set.ts:40`, `reopen.ts:52`, `update.ts:39`, `close.ts:111`.

Ta zależność jest **mniej groźna**: `owned-mutation.ts` pełni funkcję adaptera infrastruktury i przyjęcie `SupabaseClient` jako parametru jest poprawnym wzorcem dla warstwy adaptera. SDK nie wycieka do sygnatur domenowych ani do UI.

---

## KROK 2 — KLASYFIKACJA i wybór #1

| Oś oceny | Zależność A (`Listing = DB row`) | Zależność B (`SupabaseClient` w lib) |
|---|---|---|
| (a) Liczba warstw/plików | WSZYSTKIE — 12+ plików: types, lib, components React, components Astro, pages UI, pages API | 2 warstwy — lib (1) + pages/api (6), łącznie 7 plików |
| (b) Ryzyko wymiany | BARDZO WYSOKIE — rename kolumny DB → 12+ plików; zmiana ORM → refaktor całego projektu | NISKIE — `owned-mutation.ts` jest jedynym miejscem; zmiana SDK → 1 plik |
| (c) Rozjazd intencja-kod | **KRYTYCZNY** — `02-invariant-aggregate-refactor.md:205-315` definiuje `Listing` jako klasę domenową z metodami (`updateCommission()`, `close()`, `reopen()`); kod używa `Listing` jako aliasu DB row z `user_id`, `updated_at`, `status: string` | Brak deklaracji wymienialności; akceptowalny wzorzec adaptera |

**Wybrany przeciek #1: Zależność A — `Listing = Database["public"]["Tables"]["listings"]["Row"]`**

**Uzasadnienie:**

**(a) Zasięg** jest absolutny — Supabase DB row type dotarł do każdej warstwy aplikacji. Komponenty React (`DashboardListings.tsx:7`) operują na `listing.asking_price` (kolumna DB), lib `csv.ts:28-31` odwołuje się do `l.owner_name`, `l.closed_at` (kolumny DB), API route `close.ts:37` używa `Pick<Listing, "asking_price">` (kolumna DB). Aplikacja nie ma żadnego modelu domenowego — ma tylko projekcję schematu DB.

**(b) Ryzyko wymiany jest najwyższe** w całej codebase. Jeśli `asking_price` zmieni nazwę na `list_price` w DB, Supabase CLI wygeneruje nowy `database.types.ts`, a zmiana propaguuje się do 12+ plików we wszystkich warstwach — w tym do JSX w komponentach React, które renderują `listing.asking_price` bezpośrednio.

**(c) Rozjazd intencja-kod** jest bezpośrednio udokumentowany: `context/domain/02-invariant-aggregate-refactor.md:178` definiuje `export class Listing` z `private _status: ListingStatus` i metodą `updateCommission()` — ale `src/types/listings.ts:6` nadal eksportuje `type Listing = Database["public"]["Tables"]["listings"]["Row"]` z `status: string`. Oba byty są w tym samym projekcie. Dokument zakłada encję domenową; kod podaję aliasem persystencji. Brakuje warstwy tłumaczącej.

---

## KROK 3 — DIAGNOZA

### Cytaty przecieku przez granicę domena–persystencja

**1. Definicja przecieku — typ domenowy = typ DB row:**
```
src/types/listings.ts:1    import type { Database } from "./database.types";
src/types/listings.ts:6    export type Listing = Database["public"]["Tables"]["listings"]["Row"];
```
`Database["public"]["Tables"]["listings"]["Row"]` zawiera (`database.types.ts:214-233`):
```typescript
address: string
asking_price: number | null       // snake_case, persystencja
checklist_override: boolean        // szczegół infrastruktury (nie pojęcie domeny)
closed_at: string | null           // snake_case, persystencja
commission_percent: number | null  // snake_case, persystencja
created_at: string                 // persystencja
id: string
notary_city: string | null
notary_name: string | null
owner_email: string | null
owner_name: string | null
owner_phone: string | null
status: string                     // niestypowane — zamiast 'active' | 'done'
transaction_date: string | null
transaction_notes: string | null
type: string                       // niestypowane — zamiast 'sale' | 'occasional-rental'
updated_at: string                 // persystencja
user_id: string                    // persystencja (relacja, nie własność domenowa)
```
Ten sam plik definiuje `ListingType = "sale" | "occasional-rental"` i `ListingStatus = "active" | "done"` (`src/types/listings.ts:3-4`), ale `Listing.status: string` i `Listing.type: string` — typy domenowe istnieją i **nie są używane w typie domenowym**.

**2. Przeciek DB do UI — React komponent:**
```
src/components/dashboard/DashboardListings.tsx:2   import type { Listing } from "@/types/listings";
src/components/dashboard/DashboardListings.tsx:7   listings: Listing[];
src/components/dashboard/DashboardListings.tsx:52  if (listing.asking_price === null) return false;
src/components/dashboard/DashboardListings.tsx:53  if (min !== null && listing.asking_price < min) return false;
```

**3. Przeciek DB do lib — CSV export:**
```
src/lib/csv.ts:1    import type { Listing } from "../types/listings";
src/lib/csv.ts:22   export function listingsToCsv(listings: Listing[]): string {
src/lib/csv.ts:28   l.asking_price !== null ? String(l.asking_price) : "",
src/lib/csv.ts:29   escapeField(l.owner_name ?? ""),
src/lib/csv.ts:30   formatDate(l.created_at),
src/lib/csv.ts:31   formatDate(l.closed_at),
```

**4. Przeciek DB do API route — typowanie wyników query kolumnami DB:**
```
src/pages/api/listings/[id]/close.ts:3    import type { Listing } from "@/types/listings";
src/pages/api/listings/[id]/close.ts:37   .single<Pick<Listing, "id" | "status" | "asking_price" | "commission_percent">>();
```

**5. Supabase SDK wołane w UI page, wynik typowany jako DB row:**
```
src/pages/dashboard.astro:26           .overrideTypes<Listing[], { merge: false }>();
src/pages/dashboard/listings/[id]/pricing.astro:37   .single<Listing>();
src/pages/dashboard/listings/[id]/close.astro:29     .single<Listing>();
src/pages/dashboard/listings/[id]/close.astro:76     .maybeSingle<TransactionSnapshot>();
```

**Szczególnie groźne:** UI pages (Astro) bezpośrednio wołają Supabase SDK i typują wyniki jako DB row type. Oznacza to, że warstwa prezentacji ma dwie wiązania z Supabase: (1) przez SDK (zapytania), (2) przez kształt odpowiedzi (DB column names). Zmiana któregokolwiek z tych wiązań propaguje się do szablonów HTML.

**6. Kontrast — co POWINNO być domenowe, a nie jest:**
`context/domain/02-invariant-aggregate-refactor.md:178–185` (plan, nie wdrożony):
```typescript
export type ListingStatus = "active" | "done";
export type ListingType = "sale" | "occasional-rental";
export class Listing {
  private _status: ListingStatus;
  private _commissionPercent: number | null;
```
Ten plan zakłada `Listing` jako klasę domenową z typowanymi polami camelCase. Kod ma `Listing` jako DB row alias z `status: string` i kolumnami snake_case. Dwa modele tego samego bytu — brak ACL między nimi.

---

## KROK 4 — PROJEKT ACL

### Domenowy Value Object: `ListingView`

`ListingView` jest JEDYNYM miejscem w kodzie, które definiuje kształt danych wystawionych przez warstwę odczytu. Jest to Read Model (CQRS-lite) — nie ma metod domenowych (to jest rola `Listing` z planu `02`), ma tylko dane do wyświetlenia.

```typescript
// src/domain/listing/ListingView.ts  (nowy plik)
// VO opisany w języku domeny — ZERO importów z @supabase/supabase-js

export type ListingStatus = "active" | "done";
export type ListingType = "sale" | "occasional-rental";

export interface ListingView {
  id: string;
  address: string;
  status: ListingStatus;        // typowane — nie string
  type: ListingType;            // typowane — nie string
  askingPrice: number | null;   // camelCase — nie asking_price
  commissionPercent: number | null;
  ownerName: string | null;     // camelCase — nie owner_name
  ownerPhone: string | null;
  ownerEmail: string | null;
  notaryName: string | null;
  notaryCity: string | null;
  transactionDate: string | null;
  transactionNotes: string | null;
  createdAt: string;
  closedAt: string | null;
}
```

Pola infrastrukturalne **celowo NIEOBECNE** w `ListingView`: `user_id` (własność nie pojęcie), `updated_at` (szczegół persystencji), `checklist_override` (szczegół stanu sesji — dostępny przez oddzielne zapytanie gdzie jest potrzebny).

---

### PORT: `IListingQuery`

Interfejs opisany wyłącznie w języku domeny — bez typów biblioteki, bez nazw kolumn.

```typescript
// src/domain/listing/IListingQuery.ts  (nowy plik)

import type { ListingView } from "./ListingView";

export interface IListingQuery {
  findAllForUser(userId: string): Promise<ListingView[]>;
  findById(id: string, userId: string): Promise<ListingView | null>;
}
```

Zapis pozostaje przez `ListingRepository` (zaprojektowany w `02-invariant-aggregate-refactor.md:319-429`). `IListingQuery` pokrywa wyłącznie odczyt.

---

### ADAPTER: `SupabaseListingQuery`

Adapter jest JEDYNYM plikiem, który zna:
- `Database["public"]["Tables"]["listings"]["Row"]`
- nazwy kolumn DB (snake_case)
- API `supabase.from("listings").select(...)`

```typescript
// src/infrastructure/listing/SupabaseListingQuery.ts  (nowy plik)

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { IListingQuery } from "@/domain/listing/IListingQuery";
import type { ListingView, ListingStatus, ListingType } from "@/domain/listing/ListingView";

type DbRow = Database["public"]["Tables"]["listings"]["Row"];

function toListingView(row: DbRow): ListingView {
  return {
    id: row.id,
    address: row.address,
    status: row.status as ListingStatus,
    type: row.type as ListingType,
    askingPrice: row.asking_price,
    commissionPercent: row.commission_percent,
    ownerName: row.owner_name,
    ownerPhone: row.owner_phone,
    ownerEmail: row.owner_email,
    notaryName: row.notary_name,
    notaryCity: row.notary_city,
    transactionDate: row.transaction_date,
    transactionNotes: row.transaction_notes,
    createdAt: row.created_at,
    closedAt: row.closed_at,
  };
}

export class SupabaseListingQuery implements IListingQuery {
  constructor(private supabase: SupabaseClient) {}

  async findAllForUser(userId: string): Promise<ListingView[]> {
    const { data, error } = await this.supabase
      .from("listings")
      .select("id, address, status, type, asking_price, commission_percent, owner_name, owner_phone, owner_email, notary_name, notary_city, transaction_date, transaction_notes, created_at, closed_at")
      .eq("user_id", userId)
      .order("status", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data) return [];
    return data.map(toListingView);
  }

  async findById(id: string, userId: string): Promise<ListingView | null> {
    const { data, error } = await this.supabase
      .from("listings")
      .select("id, address, status, type, asking_price, commission_percent, owner_name, owner_phone, owner_email, notary_name, notary_city, transaction_date, transaction_notes, created_at, closed_at")
      .eq("id", id)
      .eq("user_id", userId)
      .single<DbRow>();

    if (error || !data) return null;
    return toListingView(data);
  }
}
```

**Kluczowa właściwość adaptera:** `toListingView()` to jedyne miejsce mapowania snake_case → camelCase i `string → enum`. Rename kolumny `asking_price` → `list_price` wymaga zmiany **jednej linii** w `SupabaseListingQuery.ts`, a nie 12+ plików.

---

### Przepływ BEFORE / AFTER

#### BEFORE — Supabase SDK i DB row leakuje do UI page i React component

```
dashboard.astro
  ├─ import createClient from "@/lib/supabase"         // Supabase SDK
  ├─ import type { Listing } from "@/types/listings"   // DB row alias
  ├─ supabase.from("listings").select("*")
  │      .overrideTypes<Listing[], { merge: false }>() // DB row w UI
  └─ <DashboardListings listings={listings} />
        DashboardListings.tsx:7   listings: Listing[]  // DB row w React props
        DashboardListings.tsx:52  listing.asking_price // kolumna DB w JSX
```

Punkty wiązania: `dashboard.astro` zna SDK + DB row. `DashboardListings.tsx` zna DB row.

#### AFTER — UI page woła port, React komponent dostaje ListingView

```
dashboard.astro
  ├─ import createClient from "@/lib/supabase"                         // ← tylko tu
  ├─ import { SupabaseListingQuery } from "@/infrastructure/..."
  ├─ const query = new SupabaseListingQuery(supabase)
  ├─ const listings = await query.findAllForUser(user.id)              // ListingView[]
  └─ <DashboardListings listings={listings} />
        DashboardListings.tsx:7   listings: ListingView[]              // domain type
        DashboardListings.tsx:52  listing.askingPrice                  // camelCase domain field
```

`DashboardListings.tsx` nie importuje niczego z Supabase. Zmiana SDK lub DB schema nie dotyka komponentu.

#### BEFORE — pricing.astro odpytuje Supabase bezpośrednio

```
pricing.astro
  ├─ import createClient from "@/lib/supabase"
  ├─ import type { Listing } from "@/types/listings"
  ├─ supabase.from("listings").select("*").eq("id", id).single<Listing>()
  └─ listing.asking_price, listing.commission_percent       // kolumny DB w template
```

#### AFTER — pricing.astro woła port

```
pricing.astro
  ├─ import createClient from "@/lib/supabase"
  ├─ import { SupabaseListingQuery } from "@/infrastructure/..."
  ├─ const query = new SupabaseListingQuery(supabase)
  ├─ const listing = await query.findById(id, user.id)                 // ListingView | null
  └─ listing.askingPrice, listing.commissionPercent                    // domain camelCase
```

#### BEFORE — csv.ts zna kształt DB

```
src/lib/csv.ts:1     import type { Listing } from "../types/listings"
src/lib/csv.ts:22    export function listingsToCsv(listings: Listing[]): string
src/lib/csv.ts:28    l.asking_price           // kolumna DB
src/lib/csv.ts:29    l.owner_name             // kolumna DB
src/lib/csv.ts:30-31 l.created_at, l.closed_at // kolumny DB
```

#### AFTER — csv.ts dostaje ListingView (camelCase)

```
src/lib/csv.ts:1     import type { ListingView } from "@/domain/listing/ListingView"
src/lib/csv.ts:22    export function listingsToCsv(listings: ListingView[]): string
src/lib/csv.ts:28    l.askingPrice            // domain field
src/lib/csv.ts:29    l.ownerName              // domain field
src/lib/csv.ts:30-31 l.createdAt, l.closedAt  // domain field
```

`csv.ts` i jego testy (`csv.test.ts:3`: `import type { Listing }`) przestają zależeć od kształtu DB.

#### Zależność ACL zatrzymana na serwerze — brak ryzyka wyciekniecia do bundla klienta

`SupabaseListingQuery` zawiera `import type { SupabaseClient }` i `import type { Database }` — oba są server-only. Astro SSR (Cloudflare Workers) nigdy nie wysyła tych importów do przeglądarki. React komponenty (`DashboardListings.tsx`) dostają tylko `ListingView[]` — czysty interfejs domenowy bez żadnych typów Supabase. **Granica klient/serwer jest utrzymana przez projekt, nie przez przypadek.**

---

## Tabela plików: status przed i po ACL

| Plik | Status PRZED | Status PO |
|---|---|---|
| `src/types/database.types.ts` | Wyciek źródłowy | Bez zmian — tylko `SupabaseListingQuery` go importuje |
| `src/types/listings.ts` | `Listing = DB row` (przeciek) | Usuń alias; zachowaj `ListingType`, `ListingStatus` lub przenieś do `ListingView.ts` |
| `src/types/transaction.ts` | `TransactionSnapshot = DB row` | Osobny `TransactionSnapshotView` (analogicznie) lub usunięcie |
| `src/domain/listing/ListingView.ts` | Nie istnieje | NOWY — domenowy read model |
| `src/domain/listing/IListingQuery.ts` | Nie istnieje | NOWY — port odczytu |
| `src/infrastructure/listing/SupabaseListingQuery.ts` | Nie istnieje | NOWY — jedyne miejsce mapowania DB → domain |
| `src/lib/csv.ts` | `Listing` (DB row) w sygnaturze | `ListingView` — aktualizacja sygnatury i pól |
| `src/components/dashboard/DashboardListings.tsx` | `Listing[]` (DB row) | `ListingView[]` — update interfejsu propsów i pól |
| `src/components/listings/ListingCard.tsx` | `Listing` (DB row) | `ListingView` |
| `src/components/listings/ListingCard.astro` | `Listing` (DB row) | `ListingView` |
| `src/pages/dashboard.astro` | Supabase query + `Listing` DB row | `SupabaseListingQuery.findAllForUser()` → `ListingView[]` |
| `src/pages/dashboard/listings/[id]/pricing.astro` | Supabase query + `Listing` DB row | `SupabaseListingQuery.findById()` → `ListingView` |
| `src/pages/dashboard/listings/[id]/close.astro` | Supabase query + `Listing` + `TransactionSnapshot` | Port + `ListingView` |
| `src/pages/dashboard/listings/[id]/contacts.astro` | Supabase query + `Listing` | Port + `ListingView` |
| `src/pages/dashboard/listings/[id]/documents.astro` | `Pick<Listing, ...>` z kolumn DB | `ListingView` (subset) |
| `src/pages/dashboard/listings/[id]/edit.astro` | Supabase query + `Listing` | Port + `ListingView` |
| `src/pages/api/listings/[id]/close.ts` | `Pick<Listing, "asking_price" \| ...>` | Własne zapytanie przez `ListingRepository.load()` (z planu `02`) — nie potrzebuje `Listing` z `types/` |

---

## Powiązanie z planem `02-invariant-aggregate-refactor.md`

Plan `02` zaprojektował `ListingRepository` dla **ścieżki zapisu** (`updateCommission`, `saveWithSnapshot`, `saveReopen`). Ten dokument projektuje `SupabaseListingQuery` dla **ścieżki odczytu** (`findById`, `findAllForUser`).

Razem tworzą pełny ACL dla Supabase:

```
Zapis (CUD):  API Route → ListingRepository (port) → Supabase SDK
Odczyt (R):   UI Page   → IListingQuery (port)     → SupabaseListingQuery → Supabase SDK
```

`Listing` jako klasa domenowa (plan `02`) operuje wyłącznie na ścieżce zapisu. `ListingView` jako read model (ten plan) operuje wyłącznie na ścieżce odczytu. Żaden z nich nie jest aliasem DB row.

---

## Podsumowanie

Najbardziej przenikający przeciek w EstateDesk to `src/types/listings.ts:6` — jedno przypisanie `Listing = Database["public"]["Tables"]["listings"]["Row"]`, które zamienia generowany schemat DB w "oficjalny" typ domenowy i propaguje 18 kolumn persystencji (snake_case, `status: string`, `user_id`) do wszystkich 12+ plików we wszystkich warstwach — od React islands przez Astro pages po lib csv i API routes. Przeciek jest szczególnie groźny, bo projekt `02-invariant-aggregate-refactor.md` zakłada już `Listing` jako klasę domenową z typowanymi polami i metodami, a kod nadal używa DB row — dwa modele tego samego bytu koegzystują bez żadnej warstwy tłumaczącej. Zaprojektowany ACL składa się z trzech elementów: `ListingView` (VO z camelCase, typowanymi enumami, bez pól infrastruktury), `IListingQuery` (port odczytu w języku domeny) i `SupabaseListingQuery` (adapter — jedyne miejsce mapowania `toListingView()` znające nazwy kolumn DB). Po refaktorze rename kolumny `asking_price` → `list_price` wymaga zmiany jednej linii zamiast 12+, a React komponenty przestają wiedzieć cokolwiek o Supabase SDK lub schemacie DB. ACL zatrzymuje zależność na serwerze (Astro/Cloudflare Workers), co eliminuje ryzyko przypadkowego włączenia typów persystencji do bundla klienta.
