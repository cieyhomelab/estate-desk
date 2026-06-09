# EstateDesk — Repo Map

> Wygenerowano: 2026-06-09  
> Źródła: artifact-1-territory.md · artifact-2-structure.md · artifact-3-contributors.md  
> Zakres git: 193 commity (pełna historia)

---

## Kluczowe moduły i ich rola

### FOUNDATION — baza, na której stoi cała aplikacja

| Moduł | Rola |
|-------|------|
| `src/types/listings.ts` | Domain model. Definiuje kształt `Listing` — 0 własnych importów, ale 9+ konsumentów cross-layer. Zmiana dowolnego pola propaguje przez cały stack jednocześnie. |
| `src/lib/supabase.ts` | Klient Supabase — hub 29 konsumentów (każda trasa API + middleware + pages). Importuje `AstroCookies` i `astro:env/server`, co wiąże go z Astro runtime na zawsze. |
| `src/lib/commission.ts` | Jedyna wyekstrahowana logika biznesowa z testem jednostkowym. Oblicza podział prowizji; używana przez 4 konsumentów (2 w depcruise + 2 niewidoczne `.astro`). |

### APPLICATION — logika, auth, integracje

| Moduł | Rola |
|-------|------|
| `src/middleware.ts` | Brama auth dla wszystkich tras. `PROTECTED_ROUTES` jako hardkodowana tablica — dodanie nowej strony dashboard bez wpisu tutaj omija ochronę. 6 obszarów cross-area w historii git. |
| `src/pages/api/listings/` | 22 trasy CRUD (listings, prices, commissions, contacts, documents, files, photos). Formalnie warstwa UI (konwencja Astro), faktycznie APPLICATION: auth-check, walidacja, zapis do DB. |
| `src/pages/api/auth/` | signup / signin / signout. Znaczący cross-area hub: `signup.ts` współwystępował z 8 różnymi obszarami w commitach. |
| `src/integration/` | Dwa podmoduły: `helpers/` (test-only Supabase client z service role — izolacja celowa) oraz `api/` (integration testy uderzające w żywy dev server). |

### UI — strony i komponenty

| Moduł | Rola |
|-------|------|
| `src/pages/dashboard/listings/[id]/` | Rdzeń produktu: `edit.astro`, `pricing.astro`, `contacts.astro`, `close.astro`, `documents.astro`. Pięć stron, ale funkcjonalnie jedna całość. |
| `src/pages/dashboard.astro` | Integration point — łączy API, komponenty i typy. 9 obszarów cross-area; hub testów e2e. |
| `src/components/listings/` | `ListingCard.astro` (9 zmian, 8 obszarów cross-area) + `ListingTabs.astro` — prezentacja listingów. |
| `src/components/dashboard/DashboardListings.tsx` | React island z logiką filtrowania (5 warunków). Najnowszy kod (W24), zero testów. |
| `src/pages/api/format-address.ts` | Jedyna zewnętrzna zależność (OpenRouter/Gemini). 9 ścieżek błędów, zero pokrycia testowego. |

### INFRASTRUCTURE

| Moduł | Rola |
|-------|------|
| `supabase/migrations/` | 9 migracji SQL (RLS, triggery, schematy). Tylko Maciej. Brak drugiego oka na jakikolwiek z tych plików. |
| `.github/workflows/deploy.yaml` | CI/CD pipeline — historia podzielona między dwóch autorów. Brak smoke testu i procedury rollbacku. |

---

## Częstotliwość zmian

### Gorące strefy (12 miesięcy)

| Strefa | Zmiany | Charakter |
|--------|--------|-----------|
| `src/pages/dashboard/listings` | 41 | Najaktywniejszy folder — ciągła ewolucja core UI |
| `src/pages/api/listings` | 32 | Duży peak w W22, teraz stabilizuje się |
| `e2e/` | 20 | Wysoka aktywność — testy doganiają features |
| `src/components/listings` | 15 | Dostosowania UI po każdym feature |
| `src/integration/helpers` + `src/integration/api` | 18 | Rozbudowa harnessu testowego |
| `src/types` | 10 | Zmiany domain modelu — każda wysokokosztowa |

### Wzorzec cyklu

```
Tydzień budowania feature (duży peak API + UI)
  → Tydzień UI polish (komponenty, drobne poprawki)
    → Tydzień testów (integration + e2e)
      → kolejny feature
```

Projekt jest teraz w fazie W24: feature (live filtering) → kolejny gear shift.

### Pliki zmieniane najczęściej (top 5)

| Plik | Zmiany | Sygnał |
|------|--------|--------|
| `pricing.astro` | 10 | Tandem z `edit.astro` — de facto jedna funkcjonalność |
| `contacts.astro` | 10 | Stabilizacja po CRUD |
| `edit.astro` | 9 | Tandem z `pricing.astro` |
| `ListingCard.astro` | 9 | Punkt agregacji prezentacji |
| `dashboard.astro` | 8 | Integration point — każda zmiana produktu go dotyka |

---

## Obszary wrażliwe

### Architektoniczne

**`src/lib/supabase.ts` — sprzężenie z frameworkiem**  
Hub 29 konsumentów jest nietesowalny bez Astro runtime. `integration/helpers/supabase.ts` używa innego klienta (service role) — celowa izolacja, ale otwiera ryzyko rozejścia się konfiguracji cookie między produkcją a testami.

**`src/middleware.ts` — ręczna lista chronionych tras**  
`PROTECTED_ROUTES` wymaga ręcznej aktualizacji przy każdej nowej stronie dashboard. Brak testu kompletności tablicy względem `find src/pages/dashboard`. Dotykany przez 2 autorów bez jasnego ownership.

**`pricing.astro` + `edit.astro` — tandem bez testu**  
3 zapytania DB + inline commission calc w `pricing.astro`, brak testu renderowania poprawnych wartości. Oba pliki zmieniają się razem (top-3 aktywności, 11 obszarów cross-area), ale brak testu który to zabezpiecza.

### Logika biznesowa

**`src/pages/api/listings/[id]/commission/set.ts`**  
Edytowane przez dwóch autorów bez opisowego commitu. Poprawka cieyhomelab (`1eff78ad`) — brak opisu co konkretnie zostało naprawione. Najwyższe ryzyko cicho wprowadzonej regresji.

**`close.ts`**  
Najtrudniejsza trasa: 4 zapytania DB + komisja + null-guardy. Pokryta wyłącznie przez e2e — brak integration testu który weryfikuje ścieżkę `asking_price + settings → transaction_snapshots`.

**`20260605000001_registration_open_rpc.sql`**  
Migracja bez powiązanego PR ani commitu opisującego zamiar. Nieznane co robi i dlaczego weszła do repo.

### Testowe

| ID | Moduł | Ryzyko |
|----|-------|--------|
| R1 | `DashboardListings.tsx` | Filter logic (5 warunków), dodana W24, zero testów |
| R2 | `format-address.ts` | Zewnętrzny LLM, 9 ścieżek błędów, zero pokrycia |
| R3 | `close.ts` | Kombinacja DB+calc, tylko e2e |
| R4 | 16/22 tras API | Brak integration testów — auth-logic lub DB schema może się zmienić bez wykrycia |
| R5 | `lib/supabase.ts` | Nietesowalny bez runtime |
| R6 | `pricing.astro` | 3 zapytania DB, brak testu wartości |
| R7 | `middleware.ts` | `PROTECTED_ROUTES` bez testu kompletności |
| R8 | `files/upload`, `photos/upload` | Binary upload, Supabase Storage, zero pokrycia |

---

## Coupling i blast radius

### Huby — co pociąga za sobą co

```
src/types/listings.ts  ←→  WSZYSTKO
  (9+ konsumentów: api/, components/, pages/, typy pokrewne, migracje)
  Blast radius: zmiana pola Listing = zmiana w całym stacku

src/lib/supabase.ts  ←  29 konsumentów
  (każda trasa API + middleware + pages)
  Blast radius: każda zmiana interfejsu klienta = ręczna weryfikacja 29 miejsc

src/middleware.ts  ←→  6 obszarów cross-area
  (auth boundary dla całego dashboardu)
  Blast radius: błąd = wszystkie trasy bez ochrony lub niedostępne

src/pages/dashboard.astro  ←→  9 obszarów cross-area
  (integration point API + komponenty + typy + e2e)
  Blast radius: centralne miejsce regresji

pricing.astro ↔ edit.astro  (tandem)
  Blast radius: zmiana w jednym wymaga weryfikacji drugiego
```

### Warstwa API jako ukryta APPLICATION

`src/pages/api/` formalnie należy do warstwy UI (konwencja Astro), ale implementuje logikę APPLICATION. Brak jawnej granicy między "routingiem HTTP" a "logiką biznesową" — całość żyje w jednym pliku `.ts` per endpoint.

### Izolacja testów — celowa, ale ryzykowna

`src/integration/helpers/supabase.ts` NIE importuje z `src/lib/supabase.ts`. Testy omijają produkcyjny klient (service role vs cookie auth). Izolacja jest celowa i poprawna, ale rozejście konfiguracji cookie może nie być wykryte.

---

## Kontrybutorzy i ukryta wiedza

### Mapa ownership

| Obszar | Owner | Ryzyko |
|--------|-------|--------|
| DB / migracje | Maciej (wyłączny) | Bus factor 1 — zero review |
| Pricing / komisja | Maciej + cieyhomelab (bez opisu) | Regresja niezauważona |
| Auth / middleware | Maciej główny + cieyhomelab (1 fix) | 2 autorów, shared boundary |
| Testing | Maciej (wyłączny) | Bus factor 1 — wiedza o strategii testowania |
| CI/CD | cieyhomelab (stworzył) + Maciej (przerabiał) | Historia podzielona, brak smoke testu |
| Logika biznesowa | Claude Sonnet/Opus (faktyczny autor ~106 commitów) | Brak "ludzkiego" autora rozumiejącego logikę poza sesją |

### Commity z ukrytą wiedzą

| Commit | Obszar | Co jest w środku |
|--------|--------|-----------------|
| `testing-gate-logic-auth-idor` | Auth + IDOR | Jedyna dokumentacja które trasy wymagają auth i co testuje cross-user ownership |
| `2f75d79` | Auth edge | Decyzja: trigger DB → enforcement w API (dlaczego trigger nie działał — tylko w sekwencji 3 commitów) |
| `2a3766f` | Pricing edge | Kolejność auth vs biznes; surowy error wyciekał do klienta |
| `1eff78ad` | Pricing edge | cieyhomelab naprawił błąd logiczny — brak opisu co konkretnie |
| `9fc8d61` | Infra edge | CLI Supabase nie obsługuje `--project-ref` — nieoczywisty błąd środowiska |
| `6ee4fe3` | Hydration edge | SSR crash ukryty za normalnym Astro flow — wymaga `client:only` |
| `465a157` | Commission edge | `Update set.ts` — brak opisu, zmiana w krytycznym pliku |

### Historia decyzji 3-user limit

Trigger dodany → usunięty (`drop_user_limit_trigger.sql`) → przeniesiony do API. Wiedza o tym dlaczego DB-level enforcement nie działał istnieje **wyłącznie** w sekwencji 3 commitów, nie w żadnym dokumencie.

---

## Unknowns

| Unknown | Ryzyko |
|---------|--------|
| Kto to `cieyhomelab`? Brak nazwiska, tylko `ciey.air.music@gmail.com` | Niejasna rola: współpracownik / zewnętrzny reviewer / drugie konto Macieja? |
| `20260605000001_registration_open_rpc.sql` — brak PR i opisu | Nieznane co robi ta migracja i czy jest aktywna |
| Poprawki `commission/set.ts` przez cieyhomelab (`1eff78ad`, `304cdc6`) | Nieznane czy poprawki przy mergu nie wprowadziły regresji w logice komisji |
| Deploy pipeline — brak smoke testu i rollbacku | Nieznane zachowanie przy deployu z błędem migracji |
| `format-address.ts` — nieznane koszty i limity OpenRouter/Gemini | Zero obserwacji produkcyjnej, nieznane failure rate |
| `src/lib/supabase.ts` — konfiguracja cookie vs service role w testach | Możliwa rozbieżność, nieznana od kiedy i gdzie |
| Boundary między "open registration" a "invite-only" | Migracja RPC istnieje, ale semantyka przepływu nieudokumentowana |

---

## Rekomendowane obszary do Deep Focus

### 1. `DashboardListings.tsx` — filter logic (priorytet: WYSOKI, teraz)

Najnowszy kod (W24), czysty przypadek pure function bez ani jednego testu. Ryzyko rośnie wraz z każdą kolejną zmianą filtrów. **Akcja:** wyekstrahować `applyFilters()`, napisać unit testy dla 5 warunków + edge cases (null, brak wyników, kombinacje).

### 2. `commission/set.ts` + `close.ts` — business logic audit (priorytet: WYSOKI)

Dwa pliki z ukrytą historią poprawek bez opisu. `close.ts` to najtrudniejsza trasa (4 zapytania DB + komisja + null-guardy) pokryta wyłącznie przez e2e. **Akcja:** code review `set.ts` pod kątem poprawek cieyhomelab + integration test dla `close.ts` na ścieżce `asking_price + settings → transaction_snapshots`.

### 3. `middleware.ts` — PROTECTED_ROUTES test completeness (priorytet: ŚREDNI)

Hardkodowana lista tras bez testu kompletności to cicha pułapka przy każdym nowym widoku. **Akcja:** napisać test który porównuje zawartość `PROTECTED_ROUTES` z `find src/pages/dashboard -name "*.astro"`.

### 4. `format-address.ts` — LLM route coverage (priorytet: ŚREDNI)

Jedyna zewnętrzna zależność, 9 ścieżek błędów, zero pokrycia. **Akcja:** unit z `vi.stubGlobal('fetch')` dla ścieżek błędów + integration dla auth-gate.

### 5. `supabase/migrations/` — dokumentacja schematu (priorytet: ŚREDNI)

Bus factor 1 na krytyczną infrastrukturę. Historia decyzji (trigger → API) i semantyka `registration_open_rpc.sql` istnieje tylko w commitach. **Akcja:** napisać `supabase/SCHEMA.md` z opisem każdej migracji, motywacją i aktualnym stanem.

### 6. `pricing.astro` + `edit.astro` — E2E/integration dla wartości (priorytet: NISKI → ROŚNIE)

3 zapytania DB + inline commission calc bez testu renderowania poprawnych wartości. Para plików zmienia się tandemem — brak testu sprawi, że każdy refaktor jest ślepy. **Akcja:** E2E lub integration test weryfikujący że wartości z DB trafiają poprawnie do UI.

### 7. `lib/supabase.ts` — wyekstrahować cookie-adapter (priorytet: NISKI)

Rozbieżność między produkcyjnym klientem a testowym (service role) może ukryć bug auth. **Akcja:** wyekstrahować cookie-adapter do osobnej funkcji, co umożliwi testowanie bez pełnego Astro runtime.

---

_Następny krok: wskaż obszar do Deep Focus lub zacznij od R1 (`DashboardListings.tsx` unit tests)._
