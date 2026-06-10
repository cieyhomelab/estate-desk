# Structure Map — Artifact 2: Dependency & Testability Analysis

> Generated: 2026-06-09 · Refreshed: 2026-06-10 (po merge PR #27 i #28)
> Tools: dependency-cruiser 17.4.3 (TS/TSX) + grep (.astro) + vitest/Playwright test audit
> Scope: src/ — grafy zależności, granice warstw, ryzyka testowalności

---

## Narzędziowe ograniczenie: .astro jest niewidoczne dla depcruise

dependency-cruiser nie parsuje plików `.astro` — wykrywa 0 modułów Astro.  
Wszystkie obserwacje dotyczące stron (`pages/`) i layoutów opierają się na `grep`.  
Oznacza to, że najaktywniejszy obszar projektu (10 plików w top-10 wg artifact-1) jest poza zasięgiem automatycznych reguł.

---

## Graf zależności — kluczowe obserwacje

### Brak cykli

dependency-cruiser nie wykrył żadnych circular dependencies w warstwie TS/TSX.  
Warstwa `.astro` zweryfikowana przez grep — brak cross-page importów.

### Huby według liczby dependentów (depcruise + grep)

| Moduł | Dependenci (depcruise) | Dependenci (grep, łącznie) | Uwaga |
|---|---|---|---|
| `src/lib/supabase.ts` | 23 | ~29 | Każda trasa API + middleware + pages |
| `src/integration/helpers/supabase.ts` | 6 | 6 | Tylko testy — izolacja utrzymana |
| `src/lib/utils.ts` | 3 | 3 | Drobne utility |
| `src/lib/commission.ts` | 2 | 4 | Krytyczna logika biznesowa; pages `.astro` niewidoczne dla depcruise |
| `src/lib/csv.ts` | 1 | 1 | Nowe (PR #27, 2026-06-10): eksport CSV wyekstrahowany z `DashboardListings.tsx`, pokryty testami unit |

`src/types/listings.ts` — 0 własnych importów, 9+ konsumentów cross-layer (wszystkie warstwy).  
Plik nie importuje niczego, ale zmiana pola `Listing` rippluje przez cały stack.

---

## Granice warstw

### Model warstw projektu

```
FOUNDATION:    src/types/  src/lib/
APPLICATION:   src/integration/  src/middleware.ts
UI:            src/components/  src/layouts/  src/pages/  src/styles/
```

### Wyniki audytu (5 reguł)

| Reguła | Wynik | Uwaga |
|---|---|---|
| UI → APPLICATION (zakaz) | ✅ CLEAN | grep `.astro` + depcruise: 0 naruszeń |
| APPLICATION → UI (zakaz) | ✅ CLEAN | 0 naruszeń |
| FOUNDATION types → cokolwiek (zakaz) | ✅ CLEAN | Czyste deklaracje typów, 0 importów |
| FOUNDATION lib → UI/APPLICATION (zakaz) | ✅ CLEAN (z zastrzeżeniem) | Brak importów z warstw projektu; COUPLING z Astro runtime (`astro:env/server`, `AstroCookies`) |
| Kierunek FOUNDATION → APPLICATION → UI | ✅ CLEAN | Jednokierunkowy przepływ we wszystkich plikach |

### Dwa nieoczywiste kompromisy architektoniczne

**1. `src/pages/api/` to UI-as-APPLICATION.**  
API routes żyją w warstwie UI (konwencja Astro), ale zawierają logikę APPLICATION-grade: auth, walidację, zapis do DB.  
Formalnie: reguły warstw spełnione. Praktycznie: model warstw nie ma nazwy dla tej strefy.

**2. FOUNDATION jest sprzężona z frameworkiem Astro.**  
`src/lib/supabase.ts` importuje `AstroCookies` i `astro:env/server`.  
Lib nie jest framework-agnostyczna — nie można jej użyć poza Astro runtime.

---

## Ryzyka testowalności

### Strategia testowania (świadoma, spójna)

Projekt celowo unika mocków na warstwę DB.  
Integration testy uderzają w prawdziwy Supabase przez `createServiceRoleClient()`.  
API integration testy (`src/integration/api/`) wysyłają HTTP do żywego dev servera (`server.ts`).

### Pokrycie testowe — mapa

| Typ testu | Co pokrywa |
|---|---|
| **Unit** (vitest) | `calculateCommissionSplit` — 4 przypadki, włącznie z zaokrągleniem; `listingsToCsv` — 7+ przypadków (mapowanie statusów, null-e, CRLF, separator `;`) |
| **Integration DB** (vitest + live Supabase) | listing persistence, close/reopen lifecycle, price history ordering |
| **Integration API** (vitest + live dev server) | auth-boundary (4 trasy), gate-logic close, IDOR close + contacts/create |
| **E2E** (Playwright) | auth-boundary, listing-persistence (create+edit), close-reopen-lifecycle, document-gate |

**Przetestowane trasy API (bezpośrednio):** 4 z 22 (`create`, `close`, `contacts/create`, `documents/add`)  
**Trasy bez żadnego testu:** `price/set`, `commission/set`, `settings/commission`, `update`, `delete`, `reopen`, `documents/toggle`, `documents/override`, `documents/*/delete`, `contacts/*/delete`, `files/upload`, `photos/upload`, `auth/signin`, `auth/signup`, `auth/signout`

### Ryzyka — lista

| ID | Moduł | Ryzyko | Zalecane podejście |
|---|---|---|---|
| R1 | `DashboardListings.tsx` | Filter logic (5 warunków) bez żadnego testu; eksport CSV już wyekstrahowany i pokryty (`lib/csv.ts`, PR #27), ale filtrowanie nadal nie | Unit: wyekstrahować `applyFilters()` analogicznie do `listingsToCsv` |
| R2 | `format-address.ts` | Zewnętrzny LLM (OpenRouter/Gemini), zero pokrycia, 9 ścieżek błędów | Unit z `vi.stubGlobal('fetch')` dla błędów + integration dla auth-gate |
| R3 | `close.ts` | Kombinacja 4 zapytań DB + komisja + null-guardy — przetestowana przez e2e, NIE przez integration | Integration: ścieżka commit z `asking_price + settings → transaction_snapshots` |
| R4 | 16 tras API | Brak integration testów — zmiana auth-logic lub DB schema może nie być wykryta | Integration per trasa (przynajmniej happy path + auth-gate) |
| R5 | `lib/supabase.ts` | Nietesowalny bez Astro runtime; testy integration używają innego klienta (service role) | Wyekstrahować cookie-adapter do osobnej funkcji |
| R6 | `pricing.astro` | 3 zapytania DB + inline commission calc — brak testu renderowania poprawnych wartości | E2E lub integration na stronę `/dashboard/listings/{id}/pricing` |
| R7 | `middleware.ts` | `PROTECTED_ROUTES` (`["/dashboard", "/help"]`) jako hardkodowana tablica — dodanie nowej strony może ominąć ochronę; PR #28 potwierdził, że wpis trzeba pamiętać ręcznie | Test completeness tablicy względem chronionych stron w `src/pages` |
| R8 | `files/upload`, `photos/upload` | Binary upload, Supabase Storage, zero pokrycia | Integration (happy path + size limit) |

### Najbardziej podejrzane moduły (zestawienie)

1. **`DashboardListings.tsx`** — logika filtrów (pure function) nadal bez testu; część eksportowa pokryta od PR #27
2. **`format-address.ts`** — jedyna zewnętrzna zależność, zero testów
3. **`close.ts`** — najtrudniejsza trasa, kombinacja DB+calc pokryta tylko e2e
4. **`lib/supabase.ts`** — hub 29 konsumentów, sam nietesowalny

---

## Sygnały dla kolejnych kroków

- Przed zmianą `Listing` interface w `src/types/listings.ts` — sprawdzić 9 konsumentów (grep + .astro)
- Przed zmianą `lib/supabase.ts` — brak testu ochroni; wymagana manualna weryfikacja 29 konsumentów
- Przy dodawaniu nowej chronionej strony — ręcznie dodać do `PROTECTED_ROUTES` w `middleware.ts` (potwierdzone w praktyce: PR #28 musiał dopisać `/help`)
- `pricing.astro` + `edit.astro` zmieniają się tandemem (territory map: oba w top-3) — traktować jako jedną funkcjonalność
- `integration/helpers/supabase.ts` NIE importuje z `src/lib/supabase.ts` — testy omijają produkcyjny klient; celowa izolacja, ale ryzyko rozejścia się konfiguracji cookie

---

## Pliki-źródła tej analizy

- `context/map/artifact-1-territory.md` — git activity (input)
- dependency-cruiser 17.4.3, `tsconfig.json` — TS/TSX graf
- grep na `src/**/*.astro` — warstwa Astro
- `src/integration/**/*.test.ts`, `src/lib/commission.test.ts` — mapa pokrycia
- `e2e/*.spec.ts` — mapa pokrycia e2e
