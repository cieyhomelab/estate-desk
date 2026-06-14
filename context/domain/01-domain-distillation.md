---
title: "EstateDesk — Domain Distillation"
created: 2026-06-14
type: domain-distillation
source_documents:
  - context/foundation/archive/prd-2026-06-08.md
  - context/foundation/prd.md
  - context/foundation/shape-notes.md
  - context/archive/2026-05-29-pricing-and-commission/research.md
  - context/archive/2026-06-10-commission-set-analysis/research.md
  - context/archive/2026-05-30-contact-management/plan.md
  - src/types/ (all files)
  - src/lib/commission.ts
  - src/lib/owned-mutation.ts
  - src/pages/api/listings/[id]/close.ts
  - src/pages/api/listings/[id]/reopen.ts
  - src/pages/api/listings/[id]/commission/set.ts
  - src/pages/api/listings/[id]/documents/override.ts
  - supabase/migrations/ (all files)
---

## Krok 0 — Kontekst projektu

**Produkt:** EstateDesk — aplikacja webowa dla jednego polskiego agenta nieruchomości do zarządzania pełnym cyklem życia transakcji nieruchomości.

**Stack:** Astro 5, React 19, TypeScript 5, Tailwind CSS v4, Supabase (PostgreSQL + auth + storage), Cloudflare Workers.

**Struktura warstw logiki biznesowej:**

| Warstwa | Katalog | Co zawiera |
|---|---|---|
| API (transport) | `src/pages/api/` | 22 route'y POST; auth → walidacja → mutacja → redirect |
| Domena (pure) | `src/lib/commission.ts` | Jedyna czysta funkcja domenowa — `calculateCommissionSplit()` |
| Persystencja | `supabase/migrations/` | 8 migracji SQL definiujących schemat i niezmienniki DB |
| Typy | `src/types/` | Ręczne definicje TypeScript (bez generatora z DB) |
| UI | `src/pages/dashboard/` | Astro SSR + React islands dla formularzy |

**Dokumenty źródłowe:** PRD greenfield (2026-05-22) z pełną wizją produktu; PRD brownfield (2026-06-08) tylko dla filtrów/eksportu/pomocy; archiwa zmian z planem i research dla każdego slice'a.

---

## Krok 1 — Ubiquitous Language

### Pojęcia domenowe

| # | Termin | Definicja (ze źródła) | Cytat źródłowy | Lokalizacja w kodzie |
|---|---|---|---|---|
| 1 | **Listing** (Ogłoszenie) | Centralna jednostka reprezentująca nieruchomość w toku transakcji (sprzedaż lub najem okazjonalny). Żyje od utworzenia do zamknięcia transakcji. | PRD v2: "manages the full lifecycle of property listings" `prd-2026-06-08.md:20` | `src/types/listings.ts:6`; tabela `listings` — `migrations/20260525152607_create_listings.sql:5` |
| 2 | **ListingType** (Typ ogłoszenia) | Dwa możliwe typy: `sale` (sprzedaż) lub `occasional-rental` (najem okazjonalny). Determinuje listę dokumentów wymaganą do zamknięcia transakcji. | PRD: "FR-003: Agent can create a listing (property type: sale or occasional rental / *najem okazjonalny*)" `prd-2026-06-08.md:65` | `src/types/listings.ts:3`; CHECK w DB: `migrations/20260525152607:10` (`CHECK IN ('sale', 'occasional-rental')`) |
| 3 | **ListingStatus** (Status ogłoszenia) | Dwa stany: `active` (Aktywne) i `done` (Zamknięte). Przejście `active → done` to zamknięcie transakcji; `done → active` to wznowienie. | PRD: "FR-007: Agent can mark a listing as transaction-complete (done) and reopen it" `prd-2026-06-08.md:71` | `src/types/listings.ts:4`; CHECK w DB: `migrations/20260525152607:11` |
| 4 | **Owner** (Właściciel) | Właściciel nieruchomości, klient agenta po stronie sprzedającego/wynajmującego. | PRD: "FR-008: Agent can record owner name, phone, and email on a listing." `prd-2026-06-08.md:75`; PRD używa pojęcia "owner onboarding" | `listings.owner_name`, `listings.owner_phone`, `listings.owner_email` — BRAK encji Owner, dane płaskie na Listing |
| 5 | **Contact** (Kontakt) | Strona zainteresowana: kupujący (`kupujący`) lub najemca (`najemca`). Kontakty są dodawane przez agenta per-ogłoszenie. Append-only. | PRD: "FR-013: Agent can add interested-party contacts (name, phone, email) to a listing." `prd-2026-06-08.md:83` | `src/types/contacts.ts:3-11`; tabela `contacts` — `migrations/20260530110000:6` |
| 6 | **ContactRole** (Rola kontaktu) | Dwie wartości domenowe: `"kupujący"` (nabywca) lub `"najemca"` (najemca). | Kontekst polskiego prawa — sprzedaż vs najem okazjonalny; plan contact-management: "role (optional: kupujący / najemca)" | `src/types/contacts.ts:1` (`ContactRole`); CHECK w DB: `migrations/20260530110000:12` (`check (role in ('kupujący', 'najemca'))`) |
| 7 | **DocumentChecklist** (Lista kontrolna dokumentów) | Lista wymaganych dokumentów przedtransakcyjnych, pre-zapełniana przez trigger przy tworzeniu ogłoszenia. Różna dla `sale` (8 pozycji) vs `occasional-rental` (5 pozycji). Polskie prawo nieruchomości definiuje zestaw standardowych dokumentów. | PRD Business Logic: "The app determines which documents are required for a property transaction based on listing type (sale or occasional rental) and tracks completion" `prd-2026-06-08.md:112` | Trigger `seed_listing_documents()` — `migrations/20260530000000:76-108`; tabela `listing_documents` — `migrations/20260530000000:15` |
| 8 | **ListingDocument** (Pozycja listy kontrolnej) | Pojedynczy element listy dokumentów z etykietą, flagami `is_checked`, `is_default` i kolejnością `position`. Agent może zaznaczać, dodawać i usuwać pozycje. | PRD: "FR-015: Agent can view a pre-populated document checklist… and check off, add, or remove items." `prd-2026-06-08.md:89` | `src/types/documents.ts:1-10`; DB: `listing_documents` table |
| 9 | **ChecklistOverride** (Pominięcie listy) | Flaga boolean na ogłoszeniu, pozwalająca agentowi zamknąć transakcję pomimo niezaznaczonych dokumentów. Wymaga świadomego potwierdzenia. | PRD Acceptance Criteria: "All document checklist items show as checked before 'done' is available, or the agent explicitly overrides the incomplete checklist" `prd-2026-06-08.md:55` | `listings.checklist_override` — `migrations/20260530000000:10`; `api/listings/[id]/documents/override.ts:24` |
| 10 | **TransactionGate** (Brama transakcyjna) | Reguła blokująca zamknięcie transakcji dopóki dokumenty nie są kompletne lub override nie jest aktywny. Centralny niezmiennik produktu. | PRD Business Logic: "preventing the transaction from being closed until all required items are checked off or the agent explicitly overrides the gate" `prd-2026-06-08.md:114` | `api/listings/[id]/close.ts:47-61` — sprawdzenie uncheckedCount vs checklist_override |
| 11 | **PriceHistory** (Historia cen) | Append-only log zmian ceny wywoławczej per ogłoszenie. Odpowiedź na Success Criteria: "Price-change history is visible per listing". | PRD: "FR-010: Agent can view price-change history for a listing." `prd-2026-06-08.md:78` | `src/types/pricing.ts:10-15`; tabela `price_history` — `migrations/20260529120000` |
| 12 | **CommissionSettings** (Ustawienia prowizji) | Konfiguracja podziału prowizji per-użytkownik: `tax_rate` (% podatku od dochodu agenta) i `agency_percent` (% dla agencji). Jeden rekord per użytkownik (upsert). | PRD: "FR-012: Agent can configure commission split rates (tax rate, agency %, agent %) once in account settings" `prd-2026-06-08.md:82` | `src/types/pricing.ts:1-8`; tabela `commission_settings` — `migrations/20260529120000` |
| 13 | **CommissionSplit** (Podział prowizji) | Wyliczony podział: `brutto` = askingPrice × commissionPercent%; `agencyAmount` = brutto × agencyPercent%; `grossIncome` = brutto − agencyAmount; `taxAmount` = grossIncome × taxRate%; `agentNet` = grossIncome − taxAmount. Niezmiennik: agencyAmount + taxAmount + agentNet = brutto (dokładnie, bez zaokrągleń). | PRD Business Logic: "the split must sum to the entered total; any rounding difference surfaces as a validation error, not a silent adjustment." `prd-2026-06-08.md:116` | `src/lib/commission.ts:1-40`; wyraźny throw na naruszeniu inwarianta: `commission.ts:29` |
| 14 | **TransactionSnapshot** (Snapshot transakcji) | Niezmienny rekord finansowy tworzony w momencie zamknięcia transakcji. Zawiera kopię wszystkich wartości prowizji, cenę, dane notariusza i datę transakcji. Anulowany (`voided_at`) przy wznowieniu ogłoszenia. | Migrations: "Prevents double-submit race: at most one active (voided_at IS NULL) snapshot per listing." `migrations/20260530120000:40-41` | `src/types/transaction.ts:3`; tabela `transaction_snapshots` — `migrations/20260530120000:12` |
| 15 | **Transaction Close** (Zamknięcie transakcji) | Akcja zamieniająca status `active → done`, tworząca TransactionSnapshot i ustawiająca `closed_at`. Wymaga: brama dokumentów + (opcjonalnie) dane notariusza/daty. | PRD US-01: "they tick off the required documents, record the notary office and transaction date, and click 'Mark as done'" `prd-2026-06-08.md:47` | `api/listings/[id]/close.ts:7-126` |
| 16 | **Transaction Reopen** (Wznowienie transakcji) | Odwrócenie zamknięcia: status `done → active`, anulowanie snapshotu (`voided_at`). Preservuje dane notarialne. | PRD: "Agent can reopen a done listing; it returns to active with all data intact" `prd-2026-06-08.md:55` | `api/listings/[id]/reopen.ts:7-59`; komentarz: "Intentionally preserves notary_name, notary_city…" `reopen.ts:51` |
| 17 | **Najem okazjonalny** | Specyficzna forma prawna najmu mieszkaniowego w polskim prawie. Wymaga aktu notarialnego od najemcy i odrębnego zestawu 5 dokumentów przedtransakcyjnych. | PRD: "sale and occasional rental / *najem okazjonalny*" `prd-2026-06-08.md:20` | Przechowywane jako `"occasional-rental"` (po angielsku) w DB: `migrations/20260525152607:10`; domyślne dokumenty: `migrations/20260530000000:93-101` |
| 18 | **Notary** (Notariusz) | Kancelaria notarialna prowadząca transakcję: `notary_name`, `notary_city`. Dane opcjonalne, zapisywane na ogłoszeniu i kopiowane do snapshotu. | PRD: "FR-017: Agent can record notary office name and details on a listing." `prd-2026-06-08.md:93` | `listings.notary_name`, `listings.notary_city` — `migrations/20260530120000:6-7`; snapshot: `transaction_snapshots.notary_name` |

---

## Krok 2 — Klasyfikacja subdomen

| Subdomena | Kategoria | Pojęcia/obszary | Uzasadnienie |
|---|---|---|---|
| **Cykl życia ogłoszenia** | **Core** | Listing, ListingStatus, ListingType, Transaction Close, Transaction Reopen | PRD Primary Success Criteria: "Agent closes a real estate transaction from listing creation to 'done' without losing track of any required document" — to jest rdzeń produktu. Bez tego aplikacja nie istnieje. |
| **Brama dokumentów** | **Core** | DocumentChecklist, ListingDocument, ChecklistOverride, TransactionGate, Najem okazjonalny | PRD "The insight": "Polish real estate transactions follow a predictable document checklist" — to jest pierwsze z dwóch źródeł przewagi. Przedmiotowy wiedzy dziedzinowej zakodowanej w produkcie (8 dokumentów sprzedaży, 5 najmu). |
| **Prowizja** | **Core** | CommissionSettings, CommissionSplit, TransactionSnapshot, komisja brutto/netto | PRD "The insight" (cd.): "an agent-affiliated commission split has a fixed formula (gross income → tax provision → agency portion → agent net). Both are mechanical but currently done by hand." Drugie źródło przewagi. |
| **Historia cen** | **Supporting** | PriceHistory, asking_price (denormalizacja) | PRD Secondary Success Criteria: "Price-change history is visible per listing". Ważne, ale nie jest źródłem przewagi — inne CRM-y też to mają. |
| **Kontakty** | **Supporting** | Contact, ContactRole | FR-013–014; typowa funkcja CRM. Konieczna dla kompletności, ale nie jest "insight" produktu. |
| **Pliki i zdjęcia** | **Supporting** | ListingFile, ListingPhoto | FR-005, FR-016; standardowy file management. |
| **Uwierzytelnianie** | **Generic** | User, session, RLS | Email + hasło, jeden użytkownik — standard Supabase Auth. |
| **Formatowanie adresu** | **Generic** | Polish address normalization via LLM | PRD brownfield: utility feature; "The formatted string is a normalisation aid, not a confirmed address." Żadna reguła biznesowa. |
| **Eksport / Filtry** | **Generic** | CSV export, client-side filtering | PRD brownfield explicit: "No domain logic change. This is an infrastructure-only change." |

---

## Krok 3 — Kandydaci na agregaty i niezmienniki

### Listing (Aggregate Root)

**Niezmienniki:**

| Niezmiennik | Cytat źródłowy | Status w kodzie |
|---|---|---|
| `type ∈ {'sale', 'occasional-rental'}` | PRD FR-003 `prd-2026-06-08.md:65` | ✅ CHECK w DB `migrations/20260525152607:10`; TypeScript `ListingType` `types/listings.ts:3` |
| `status ∈ {'active', 'done'}` | PRD FR-007 `prd-2026-06-08.md:71` | ✅ CHECK w DB `migrations/20260525152607:11`; TypeScript `ListingStatus` `types/listings.ts:4` |
| `commission_percent > 0 AND <= 100` | PRD FR-011 — walidacja na input | ✅ CHECK w DB `migrations/20260530100000:4`; walidacja w API `commission/set.ts:27` |
| **Zamknięcie wymaga: unchecked_docs = 0 LUB checklist_override = true** | PRD Acceptance Criteria: "All document checklist items show as checked before 'done' is available, or the agent explicitly overrides" `prd-2026-06-08.md:55` | ✅ Egzekwowane proceduralnie w `close.ts:47-61`; **BRAK CHECK w DB** — logika only in application layer |
| **Listing 'done' ma dokładnie jeden aktywny TransactionSnapshot** | Migrations: "at most one active (voided_at IS NULL) snapshot per listing" `migrations/20260530120000:40-41` | ✅ UNIQUE INDEX `unique_active_snapshot(listing_id) WHERE voided_at IS NULL` `migrations/20260530120000:41` |

**Encje wewnętrzne:** ListingDocument, ListingPhoto, ListingFile, PriceHistory, Contact (child aggregates przez FK z cascade)

---

### CommissionSplit (Value Object / Pure Function)

**Niezmienniki:**

| Niezmiennik | Cytat źródłowy | Status w kodzie |
|---|---|---|
| `agencyAmount + taxAmount + agentNet = brutto` (dokładnie) | PRD: "The split must sum to the entered total; any rounding difference surfaces as a validation error, not a silent adjustment." `prd-2026-06-08.md:116` | ✅ Throw w `commission.ts:29`: `throw new Error('Commission invariant violated...')` — ale **BRAK try/catch w close.ts** (linia 76-87); naruszenie powoduje unhandled 500 |
| Obliczenia w centgroszach (integer arithmetic) | Komentarz `commission.ts:17`: "by unit cancellation; divide by 100 to recover PLN" | ✅ `Math.round()` na centgroszach eliminuje rounding float; logika `commission.ts:19-23` |

---

### TransactionSnapshot (Entity)

**Niezmienniki:**

| Niezmiennik | Cytat źródłowy | Status w kodzie |
|---|---|---|
| Niezmienny po utworzeniu (immutable) | Koncepcja snapshotu — dane locked at close time | ⚠️ BRAK enforcement — nie ma DB constraint ani aplikacyjnego guardu; UPDATE na `transaction_snapshots` jest technicznie możliwy przez RLS (polityka `for all`) |
| `commission_percent > 0 AND <= 100` | Parity z listings | ⚠️ Brak CHECK do migracji `20260530120000` — CHECK dodany dopiero migracja `20260611000000` (retro-fix). Wcześniejsze snapshoty mogły mieć wartości poza zakresem |

---

### CommissionSettings (Aggregate Root — per user)

**Niezmienniki:**

| Niezmiennik | Cytat źródłowy | Status w kodzie |
|---|---|---|
| Jeden rekord na użytkownika | PRD: "configured in account settings; rates auto-apply to all listings" `prd-2026-06-08.md:81` | ✅ UNIQUE na `user_id` (implied by upsert pattern); `settings/commission.ts` — INSERT ... ON CONFLICT |

---

### Contact (Appendable Entity)

**Niezmienniki:**

| Niezmiennik | Cytat źródłowy | Status w kodzie |
|---|---|---|
| `role ∈ {'kupujący', 'najemca'} OR NULL` | Polska terminologia prawna — kupujący (buyer) vs najemca (tenant) | ✅ CHECK w DB `migrations/20260530110000:12`; ⚠️ TypeScript `Contact.role: string \| null` (nie używa `ContactRole`) |

---

## Krok 4 — Rozjazdy MODEL vs KOD

| # | Dokument mówi… | Kod robi… | Dowód (plik:linia) |
|---|---|---|---|
| **R-01** | "Owner onboarding" — właściciel jako odrębna koncepcja z własnym procesem | Owner to TRZY płaskie kolumny na tabeli `listings`: `owner_name`, `owner_phone`, `owner_email`. Brak encji Owner, brak osobnej tabeli, brak własnego cyklu życia. | PRD: "owner onboarding" `prd-2026-06-08.md:22`; Kod: `database.types.ts:224-226` (`owner_name`, `owner_phone`, `owner_email` na `listings.Row`) |
| **R-02** | ContactRole = `"kupujący"` \| `"najemca"` (typ domenowy) | `Contact.role` jest `string \| null` w TypeScript, mimo że typ `ContactRole` jest zdefiniowany w tym samym pliku. DB ma CHECK (poprawnie), TS nie egzekwuje. | `src/types/contacts.ts:1` (definicja `ContactRole`); `src/types/contacts.ts:9` (`role: string \| null` zamiast `ContactRole \| null`); `src/types/database.types.ts:73` (generowany typ też `string \| null`) |
| **R-03** | Zamknięcie transakcji ma CommissionSplit jako niezmiennik; "any rounding difference surfaces as a validation error" | `close.ts` wywołuje `calculateCommissionSplit()` bez try/catch. Naruszenie inwarianta (throw w `commission.ts:29`) przekłada się na unhandled 500, nie na czytelny komunikat agentowi. | `src/pages/api/listings/[id]/close.ts:76-87`; `src/lib/commission.ts:29` (`throw new Error`) |
| **R-04** | Prowizja jest częścią zamkniętej transakcji (snapshot = locked record) | `commission/set.ts` nie sprawdza `listing.status` — agent może zmienić `commission_percent` na ogłoszeniu ze statusem `done`, powodując rozjazd między `listings.commission_percent` a `transaction_snapshots.commission_percent`. | `src/pages/api/listings/[id]/commission/set.ts:1-39`; brak `listing.status === 'done'` check; `research.md` (commission-set-analysis) §2.6: "Brak guardu stanu listingu" |
| **R-05** | Historia cen jako jedyne źródło prawdy | `listing.asking_price` (denormalizacja) i tabela `price_history` istnieją równolegle. Mogą się rozjechać jeśli `asking_price` na listings zostanie zaktualizowane poza trasą `price/set.ts`. | `database.types.ts:217` (`asking_price: number \| null` na listings); `database.types.ts:276-303` (tabela `price_history`); `research.md` (pricing-commission) §5: "Design decision: whether `asking_price` lives as denormalized column… or is always computed as the latest `price_history` entry" |
| **R-06** | Najem okazjonalny — polska nazwa prawna dla specyficznej formy najmu | W DB przechowywane jako angielski slug `"occasional-rental"`. Brak polskiej nazwy w domenie kodu. Polska nazwa pojawia się tylko w UI (labels). | `src/types/listings.ts:3` (`"occasional-rental"`); `migrations/20260525152607:10`; `migrations/20260530000000:93` (`elsif new.type = 'occasional-rental'`) — vs PRD używający `"najem okazjonalny"` konsekwentnie |
| **R-07** | TransactionSnapshot jest niemutowalny ("locked and recorded") | RLS policy na `transaction_snapshots` to `FOR ALL` — dopuszcza UPDATE przez authenticated user. Nie ma żadnego CHECK ani TRIGGER blokującego modyfikację istniejącego snapshotu. | `migrations/20260530120000:33-38` (policy `for all`); `api/listings/[id]/reopen.ts:43-47` — jedyna legalna mutacja to `voided_at` przez `reopen.ts` |
| **R-08** | Brama dokumentów egzekwowana przez aplikację | `checklist_override` i licznik unchecked_docs sprawdzane tylko w `close.ts`. Supabase RLS i CHECK constraints nie zawierają tej reguły. Bezpośredni zapis do DB przez service role pomija bramę. | `src/pages/api/listings/[id]/close.ts:47-61`; brak CHECK lub trigger na tabeli `listings`; testy integracyjne używają `createServiceRoleClient()` — omijają RLS i tym samym bramę |

---

## Krok 5 — Ranking refaktoru

| Priorytet | Kandydat | Wartość domenowa | Ryzyko (słabość egzekucji) | Uzasadnienie |
|---|---|---|---|---|
| **#1** | **R-04: Brak guardu statusu w commission/set** | Wysoka — narusza niezmiennik "snapshot = locked financial record" | Wysokie — zmiana prowizji na zamkniętym ogłoszeniu powoduje cichą rozbieżność snapshot ↔ listing | Jest to **jedyny rozjazd, który powoduje błąd finansowy**: agent zamknął transakcję z prowizją 2%, potem zmienił na 3% — UI pokazuje 3%, ale zapis historyczny (snapshot) ma 2%. Brama transakcyjna wymaga też blokady na pola finansowe. Fix: jedno sprawdzenie `listing.status === 'done'` w `commission/set.ts:27` przed UPDATE. |
| **#2** | **R-03: Unhandled 500 na naruszeniu inwarianta prowizji** | Wysoka — inwarian PRD ("no silent rounding") jest egzekwowany przez throw | Średnie — throw bez catch = 500 zamiast czytelnego komunikatu agentowi | `calculateCommissionSplit()` throw w `commission.ts:29` jest poprawny jako asercja niezmiennika; ale `close.ts` nie łapie go, więc agent widzi bład serwera bez informacji. Fix: try/catch w `close.ts:76` z redirect na stronę close z `?error=blad-prowizji`. |
| **#3** | **R-02: ContactRole typowany jako `string` zamiast `ContactRole`** | Niska-średnia — wartości domenowe istnieją tylko w DB CHECK, nie w TS | Niskie — DB egzekwuje poprawnie; TS-typing to kosmetyka | Jednolinijkowa zmiana: `role: ContactRole \| null` w `contacts.ts:9`. Zamknięcie luki między zdefiniowanym typem a jego użyciem. Priorytet 3 bo ryzyko jest niskie — DB CHECK wystarczy. |
| **#4** | **R-07: TransactionSnapshot podatny na mutację** | Wysoka — niemutowalność snapshotu to koncepcja fundamentalna | Niskie — tylko `reopen.ts` modyfikuje snapshot (void); ryzyko czysto teoretyczne w single-user app | Długoterminowo: TRIGGER blokujący UPDATE na `transaction_snapshots` (poza `voided_at`). Dziś: akceptowalny MVP risk. |
| **#5** | **R-01: Owner jako embedded zamiast encji** | Średnia — "owner onboarding" sugeruje własny cykl życia | Niskie — owner dane są tylko widokiem kontaktowym; nie ma use case dla Owner bez Listing | Ekstrakcja Owner do osobnej tabeli ma sens gdy agent bedzie obsługiwał wielu właścicieli tej samej nieruchomości lub będzie reużywał danych właściciela. Dziś: premature abstraction. Odłożyć do v2. |

---

## Najważniejszy wniosek

**Jądro domeny** EstateDesk to dwa mechaniczne ale wysokiej wartości niezmienniki, które agent dotąd robił ręcznie: (1) **brama dokumentów** (lista kontrolna per typ transakcji, blokująca zamknięcie) i (2) **podział prowizji** (formuła brutto → agencja → podatek → net, z weryfikacją sumy). Oba są zakodowane — pierwszy proceduralnie w `close.ts`, drugi jako czysta funkcja w `commission.ts`. Kod modeluje je poprawnie co do intencji, ale bez pełnej ochrony: brama dokumentów żyje tylko w warstwie aplikacyjnej (pomijalna przez service role), a podział prowizji ma unhandled throw zamiast czytelnego błędu dla agenta. Najbardziej pilny do naprawienia rozjazd to **R-04** — możliwość zmiany `commission_percent` na zamkniętym ogłoszeniu, która cicho rozkłada spójność między Listing a jego TransactionSnapshot.
