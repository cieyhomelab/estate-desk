# Raport MVP — EstateDesk

**Data analizy:** 2026-06-28
**Domena projektu:** Aplikacja webowa dla polskiego agenta nieruchomości — zarządzanie cyklem życia ofert sprzedaży i wynajmu okazjonalnego (dokumenty, kontakty, cena, prowizja, zamknięcie transakcji).
**Stack:** Astro 5 + React 19 + TypeScript + Tailwind CSS v4 + Supabase + Cloudflare Workers.

---

## Checklist

### 1. Operacje CRUD ✅

Wszystkie cztery operacje istnieją dla encji `listings` i działają na utrwalonych danych:

| Operacja | Dowód |
|---|---|
| **Create** | `src/pages/api/listings/create.ts` — `supabase.from("listings").insert({ type, address, owner_name, ... user_id: user.id })` |
| **Read** | `src/pages/dashboard.astro` — `supabase.from("listings").select("*").order(...).limit(100)` |
| **Update** | `src/pages/api/listings/[id]/update.ts` — `updateOwnedListing(supabase, id, user.id, { type, address, ... })` |
| **Delete** | `src/pages/api/listings/[id]/delete.ts` — `supabase.from("listings").delete().eq("id", id).eq("user_id", user.id)` |

CRUD istnieje również dla encji pomocniczych: `price_history`, `listing_documents`, `contacts`, `files`, `photos`.

---

### 2. Logika biznesowa ✅

Projekt zawiera co najmniej jedną funkcję implementującą rzeczywistą logikę poza prostym CRUD.

**Główny przykład:** `src/lib/commission.ts` — `calculateCommissionSplit()` implementuje wieloetapową arytmetykę prowizji agenta nieruchomości:

```
brutto = cena_ofertowa × prowizja%
udział_agencji = brutto × agencja%
dochód_brutto = brutto − udział_agencji
podatek = dochód_brutto × stawka_podatku%
wynagrodzenie_netto = dochód_brutto − podatek
```

Funkcja zawiera algebraiczny niezmiennik weryfikowany w runtime: jeśli `agencja + podatek + netto ≠ brutto`, rzuca błędem — chroni to przed cichymi błędami zaokrągleń (wymaganie PRD).

**Dodatkowe przykłady logiki:**
- `src/pages/api/listings/[id]/close.ts` — brama dokumentów: zamknięcie transakcji jest zablokowane, jeśli lista dokumentów nie jest w pełni odhaczona i nie ma aktywnego override'u.
- `src/pages/api/listings/[id]/price/set.ts` — walidacja ceny: musi być dodatnia i mieć maksymalnie 2 miejsca dziesiętne.

---

### 3. Testy pokrywające zdefiniowane ryzyko ✅

**Plan testów:** `context/foundation/archive/test-plan-2026-05-22-greenfield.md` — kompletny dokument z 7 scenariuszami ryzyka, mapowaniem na poziomy testów i fazami wdrożenia.

Mapowanie testów → ryzyka:

| Ryzyko z planu | Test | Plik |
|---|---|---|
| #2 — błędna arytmetyka prowizji | test jednostkowy `calculateCommissionSplit` | `src/lib/commission.test.ts` |
| #1 — dane ogłoszenia nie utrwalone | integracyjny: zapis → odczyt z DB | `src/integration/listing-persistence.test.ts` |
| #5 — historia cen w złej kolejności | integracyjny: N wpisów → assert kolejność | `src/integration/price-history-ordering.test.ts` |
| #4 — ogłoszenie ginie po close/reopen | integracyjny: cykl zamknięcia/ponownego otwarcia | `src/integration/listing-close-reopen.test.ts` |
| #3 — brama dokumentów nie blokuje | integracyjny API: POST close bez dokumentów → 4xx | `src/integration/api/gate-logic.test.ts` |
| #6 — dane bez sesji | integracyjny API: żądanie bez cookie → redirect | `src/integration/api/auth-boundary.test.ts` |
| #7 — IDOR (dostęp do danych innego użytkownika) | integracyjny API: user B próbuje uzyskać zasoby user A | `src/integration/api/idor.test.ts` |
| #1, #3, #4 — pełny przepływ transakcji | E2E Playwright: auth → nowe ogłoszenie → dokumenty → zamknięcie | `e2e/` (5 plików spec) |

Wszystkie 4 fazy z planu mają status `complete`.

---

### 4. Autentykacja powiązana z użytkownikiem ✅

- `src/middleware.ts` — trasy `/dashboard` i `/help` są chronione; brak sesji → przekierowanie na `/`.
- Każda trasa API wywołuje `supabase.auth.getUser()` i zwraca redirect do `/auth/signin` jeśli brak sesji.
- Każda operacja zapisu zawiera `user_id: user.id` w zapytaniu DB — zasoby są jawnie przypisane do właściciela.
- `src/pages/auth/signin.astro` i `signup.astro` — pełny flow rejestracji i logowania przez e-mail + hasło (Supabase Auth).
- Test IDOR (`idor.test.ts`) potwierdza, że użytkownik B nie może odczytać ani zmodyfikować zasobów użytkownika A nawet z aktywną sesją.

---

### 5. Dokumentacja ✅

- `README.md` — kompletny: opis projektu, stack, wymagania wstępne, instrukcja uruchomienia, lista skryptów, struktura projektu, sekcja Supabase.
- `context/foundation/prd.md` — szczegółowy PRD z opisem problemu, personą, kryteriami sukcesu, user stories (Given/When/Then), wymaganiami funkcjonalnymi i niefunkcjonalnymi, logiką biznesową.
- `context/foundation/shape-notes.md` — dokument odkrywczy.
- `context/foundation/roadmap.md` — mapa drogowa.
- `context/foundation/archive/test-plan-2026-05-22-greenfield.md` — plan testów (7 ryzyk, 4 fazy, wzorce cookbook).

---

## Wynik projektu

| Kryterium | Status |
|---|---|
| CRUD | ✅ |
| Logika biznesowa | ✅ |
| Testy pokrywające ryzyko | ✅ |
| Autentykacja | ✅ |
| Dokumentacja | ✅ |

**5/5 (100%)** — wszystkie minimalne wymagania techniczne spełnione.

---

## Uwagi wykraczające poza minimum

Projekt zdecydowanie przekracza próg minimalny:

- **7-ryzykowy plan testów** z pełnym mapowaniem na jednostkowe, integracyjne i E2E — rzadko spotykany poziom dyscypliny testowej w MVP.
- **Testy IDOR** — weryfikacja bezpieczeństwa cross-account na poziomie integracyjnym to standard bezpieczeństwa produkcyjnego, nie MVP.
- **Niezmiennik algebraiczny w runtime** w `commission.ts` — aktywna ochrona przed błędem zaokrąglenia, nie tylko walidacja inputu.
- **4 zakończone fazy testowe** (bootstrap → integracja → auth/IDOR → E2E + CI) świadczą o spójnym procesie, nie reaktywnym łataniu.

Projekt kwalifikuje się do rozważenia w kategorii wyróżnień / Demo Day.
