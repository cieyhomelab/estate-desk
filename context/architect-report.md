---
title: "Raport architektoniczny — Moduł 4 (10xArchitect)"
created: 2026-06-23
author: claude-sonnet-4-6
---

# Sumaryczny raport architektoniczny — Moduł 4

---

## 1. Opisane projekty

| Repo | Stack | Skala | Artefakty |
|---|---|---|---|
| **EstateDesk** (`D:/EstateDesk/estate-desk`, lokalnie; GitHub: main branch) | Astro 5, React 19, TypeScript 5, Tailwind v4, Supabase (PostgreSQL + RLS), Cloudflare Workers | ~172 commitów na main w 12 mies.; 22 trasy API; 2 ludzi + Claude (~106 commitów) | L2 (mapa), L4 (plan refaktoru), L5 (DDD) |
| **cieyhomelab/estate-desk** (`branch: feature/code-review-evals`, inny kontekst niż powyżej) | TypeScript, Node.js, Vercel AI SDK v6, OpenRouter, promptfoo; struktura monorepo z `packages/code-reviewer` | Pakiet `code-reviewer`: 4 moduły; brak informacji o skali całości repo | L3 (research eval-readiness) |

> L3 pochodzi z innego repozytorium niż L2/L4/L5. Pakiet `packages/code-reviewer` nie pojawia się w mapie repo z L2.

---

## 2. Mapa projektu (z L2 — `context/map/repo-map.md`)

**1. Jeden agregat skupia niemal cały ruch.** `src/pages/dashboard/listings/[id]/` i `src/pages/api/listings/` odpowiadają za majority aktywności z 12-miesięcznej historii (38+ i 32 zmiany odpowiednio). Reszta projektu to peryferie.

**2. Dwa huby spinają cały stack — i oba są problematyczne.** `src/types/listings.ts` (9+ konsumentów cross-layer) i `src/lib/supabase.ts` (29 konsumentów). Hub typów jest aliasem DB row (szczegół w sekcji 5); hub klienta DB jest nietesowalny bez Astro runtime — testy integracyjne chodzą innym klientem niż produkcja.

**3. Strefa ryzyka #1: `commission/set.ts` + `close.ts`.** Logika pieniędzy, dwóch autorów (w tym anonimowe poprawki bez opisu), pokrycie testami odpowiednio zero i tylko e2e. To jest dokładne centrum obszaru największego ryzyka.

**4. Niewidoczna warstwa najaktywniejsza.** Pliki `.astro` są poza grafem dependency-cruisera — największy obszar produktu (`pages/dashboard/**`) nie ma automatycznego grafu zależności. Obserwacje o tej warstwie oparte wyłącznie na grepie i historii gita.

**5. Bus factor = 1, z AI jako faktycznym autorem logiki.** ~106 commitów biznesowych co-authored przez Claude. Dla części kodu nie istnieje człowiek rozumiejący go niezależnie od sesji. Brak observability produkcyjnej (zero metryk failure rate, kosztów LLM itp.).

---

## 3. Analiza ficzera (z L3 — `context/archive/2026-06-18-code-review-evals/research.md`)

**Badany przepływ i motywacja.** Research dotyczył pakietu `packages/code-reviewer` (repo: `cieyhomelab/estate-desk`) pod kątem gotowości do integracji z promptfoo. Powiązanie z mapą (L2): w EstateDesk istnieje trasa `api/format-address.ts` (zewnętrzna integracja LLM, strefa ryzyka #5 z L2 — zero testów, 9 ścieżek błędów). Research z L3 adresuje analogiczny problem w siostrzanym repo: jak testować kod oparty na LLM.

**Feature overview.** `reviewCode()` (`packages/code-reviewer/src/agent.ts`) przyjmuje diff + metadane PR, wywołuje LLM przez OpenRouter przez `ToolLoopAgent` (Vercel AI SDK v6) i zwraca ustrukturyzowany `ReviewOutput` walidowany Zod schema. `SYSTEM_PROMPT` jest eksportowalnym stringiem; `reviewSchema` jest standalone Zod object. `index.ts` to CLI — evals importują `agent.ts` bezpośrednio, nie przez CLI.

**Technical debt — 3 ryzyka:**

1. **ESM monorepo import (potwierdzony jako #1 ryzyko praktyczne).** promptfoo's TypeScript loader może nie przejść granicy workspace bez uprzedniego `npm run build --prefix packages/code-reviewer`. Mitygacja: trzymać `promptfoo-provider.ts` w tym samym pakiecie co source.

2. **ToolLoopAgent jako czarna skrzynka.** Vercel AI SDK v6 `ToolLoopAgent` jest nieprzezroczysty dla promptfoo — eval nie widzi pośrednich wywołań LLM, liczby tokenów ani wywołań narzędzi. Można asertować tylko na finalnym outputcie (`ReviewOutput`).

3. **Brak zdecydowania co do źródła fixtures testowych.** Research identyfikuje trzy opcje (replay z CI, syntetyczne diffy, golden set z PR), ale nie rozstrzyga — decyzja wymagana przed napisaniem test cases. Bez tego brak punktu odniesienia dla progu `overall_score >= 7`.

---

## 4. Plan refaktoryzacji (z L4 — `context/domain/02-invariant-aggregate-refactor.md`)

**Co refaktoryzowane.** Niezmiennik I-04: `commission_percent` jest immutowalne gdy `listing.status = 'done'`. Wybrany agregatem-strażnikiem jest klasa domenowa `Listing` z metodą `updateCommission()` rzucającą `ListingClosedError`. `ListingRepository` obsługuje persist (load + saveCommission + saveWithSnapshot atomicznie).

**Czego świadomie NIE robimy.** Brak DB-level triggera blokującego UPDATE (MVP risk zaakceptowany). Brak egzekwowania niezmiennika I-08 (snapshot immutable) — RLS `FOR ALL` na `transaction_snapshots` pozostaje. Brak zmian RLS policies. Orfan snapshot przy błędzie statusu w `saveWithSnapshot` jest akceptowanym ryzykiem MVP, idempotentny przy retry dzięki UNIQUE INDEX.

**Fazy planu:**

| Faza | Co | Weryfikacja |
|---|---|---|
| 0 ~1h | Test integracyjny dokumentujący obecny bug (czerwony) | Auto — integration test |
| 1 ~30min | Minimalny inline guard w `commission/set.ts` + ukrycie formularza w `pricing.astro` | Auto — `commission-immutability.test.ts` (3 przypadki) |
| 2 ~2h | Klasa domenowa `Listing` + `ListingClosedError`; przepisanie `commission/set.ts` | Auto — `listing-domain.test.ts` (8 unit testów, bez DB) |
| 3 ~2h | `ListingRepository` + atomyczne close/reopen; przepisanie `close.ts`, `reopen.ts` | Auto — `listing-close-domain.test.ts` (5 integration testów) |
| 4 ~1h | Usunięcie `updateOwnedListing` z tras domenowych | Ręcznie — grep + code review |

---

## 5. Domena wg DDD (z L5 — `01-domain-distillation.md` + `03-anti-corruption-layer.md`)

**Ubiquitous language — 5 kluczowych pojęć:**

| Pojęcie | Definicja (jedna linia) | Rozjazd model-vs-kod |
|---|---|---|
| **TransactionSnapshot** | Niezmienny rekord finansowy tworzony przy zamknięciu transakcji (`active → done`) | ❌ RLS `FOR ALL` dopuszcza UPDATE — niemutowalność tylko w koncepcji, nie w kodzie (`migrations/20260530120000:33-38`) |
| **TransactionGate** | Reguła blokująca zamknięcie gdy dokumenty niekompletne bez override | ⚠️ Tylko w `close.ts:47-61`; service role (używany w testach) pomija bramę |
| **CommissionSplit** | Wyliczony podział brutto→agencja→podatek→net; suma musi być dokładna | ⚠️ Throw w `commission.ts:29` bez try/catch w `close.ts:76-87` → unhandled 500 (rozjazd R-03) |
| **ContactRole** | Wartość domenowa: `kupujący` lub `najemca` | ❌ `Contact.role: string \| null` w TS zamiast `ContactRole \| null` (`contacts.ts:9`) — DB CHECK poprawny, TS nie egzekwuje |
| **ListingStatus** | Dwa stany: `active` / `done`; definiuje cykl życia ogłoszenia | ⚠️ Zdefiniowane jako `ListingStatus = "active" \| "done"` w `listings.ts:4`, ale `Listing.status: string` (alias DB row) nie używa tego typu |

**Niezmiennik #1 i agregat.** I-04: `commission_percent` jest immutowalne gdy `listing.status = 'done'`. Należy do agregatu `Listing` (Aggregate Root). Aktualnie: **ZERO egzekwowania** — `commission/set.ts:31` robi bezwarunkowy UPDATE bez sprawdzenia statusu. Skutek: cicha rozbieżność finansowa `listings.commission_percent` vs `transaction_snapshots.commission_percent`.

**Anti-Corruption Layer — przeciek przez wszystkie warstwy.** Zależność A (`src/types/listings.ts:6`): `Listing = Database["public"]["Tables"]["listings"]["Row"]` — jeden alias zamienia DB row w oficjalny typ domenowy. Efekt: 18 kolumn persystencji (snake_case, `status: string`, `user_id`) przecieka do 12+ plików we wszystkich warstwach: React islands (`DashboardListings.tsx:52` — `listing.asking_price`), lib (`csv.ts:28` — `l.asking_price`), Astro pages (`pricing.astro:37` — `.single<Listing>()`), API routes (`close.ts:37` — `Pick<Listing, "asking_price">`). Zaprojektowane ACL: `ListingView` (VO, camelCase, bez pól infra) + `IListingQuery` (port odczytu) + `SupabaseListingQuery` (jedyny adapter znający nazwy kolumn DB). Po wdrożeniu: rename `asking_price → list_price` wymaga zmiany **1 linii** zamiast 12+.

---

## 6. Decyzje, które należą do mnie

**I-04 vs I-05.** AI zidentyfikowało I-05 (TransactionGate) jako "Bardzo wysoka" rdzeniowość, ale rozstrzygnąłem, że I-04 jest priorytetem #1, bo jest jedynym niezmiennikeim który ma jednocześnie zero egzekwowania i najwyższe ryzyko finansowe. I-05 ma przynajmniej egzekwowanie w `close.ts`.

**Promptfoo vs Evalite.** Research z L3 rekomendował promptfoo (native OpenRouter, CI integration, full custom provider). Evalite miał lepszy TypeScript DX, ale maintenance risk (ostatni release 7 miesięcy przed badaniem). Wybrałem promptfoo — priorytet stabilności CI nad ergonomią lokalną.

**MVP risk na atomiczności close.** `ListingRepository.saveWithSnapshot` nie jest atomiczne (Supabase JS SDK nie daje transakcji). Plan akceptuje orfan snapshot jako "akceptowalny MVP risk" z UNIQUE INDEX jako safety net. To moja decyzja — AI wskazało ryzyko, nie rozstrzygnęło czy akceptowalny.

**Owner jako embedded (R-01 odłożony).** AI oceniło ekstrakcję Owner do osobnej tabeli jako "premature abstraction" przy obecnym use case. Potwierdziłem: brak use case reużycia właściciela bez listingu, odkładam do v2.

**Fixtures dla eval (otwarte).** Research z L3 nie rozstrzygnął źródła fixtures testowych dla code-reviewer. To jedyna decyzja z modułu 4, która nie ma jeszcze rozstrzygnięcia i wymaga działania przed napisaniem test cases.
