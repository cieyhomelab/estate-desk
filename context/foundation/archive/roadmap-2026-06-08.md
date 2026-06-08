---
project: EstateDesk
version: 1
status: draft
created: 2026-05-24
updated: 2026-06-05
prd_version: 2
main_goal: speed
top_blocker: time
---

# Roadmap: EstateDesk

> Wyprowadzone z `context/foundation/prd.md` (v1) + automatycznie zbadany stan kodu.
> Edytuj w miejscu; archiwizuj gdy zastąpione.
> Poniższe elementy ułożone są w kolejności zależności. Tabela "Na pierwszy rzut oka" to indeks.

## Vision recap

Pojedynczy agent nieruchomości w Polsce zarządza pełnym cyklem życia ogłoszeń — od onboardingu właściciela przez zbieranie wymaganych dokumentów, po zamknięcie transakcji — bez narzędzia rozumiejącego polski workflow. Dokumenty giną, prowizje są liczone ręcznie, dane rozrzucone po arkuszach i mailach. Aplikacja narzuca listę kontrolną wymaganych dokumentów (różną dla sprzedaży i najmu okazjonalnego) oraz automatyczny podział prowizji — eliminując dwie najkosztowniejsze kategorie błędów.

## North star

**S-06: Zamknięcie transakcji** — agent może oznaczyć ogłoszenie jako ukończone przez bramkę listy kontrolnej dokumentów z zablokowaną i zapisaną prowizją.

> Gwiazda przewodnia — najmniejszy przepływ aplikacji od początku do końca, który jeśli działa, udowadnia centralną hipotezę produktu. Umieszczona tak wcześnie jak pozwalają zależności, bo wszystko inne ma sens tylko wtedy, gdy to działa.

## Na pierwszy rzut oka

| ID    | Change ID               | Rezultat (agent może…)                                                                       | Zależności           | Odniesienia PRD                       | Status   |
| ----- | ----------------------- | -------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------- | -------- |
| F-01  | database-schema         | (foundation) schemat bazy danych i migracje gotowe w Supabase                               | —                    | FR-003–FR-018                         | ready    |
| F-02  | cloudflare-first-deploy | (foundation) aplikacja dostępna pod workers.dev z działającymi sekretami Supabase            | —                    | NFR (czas ładowania ≤3s, trwałość)   | ready    |
| S-01  | auth-flow               | zarejestrować konto, zalogować się i wylogować z aplikacji                                   | —                    | FR-001, FR-002                        | ready    |
| S-02  | listing-crud            | dodawać, edytować i usuwać ogłoszenia, przeglądać dashboard, rejestrować dane właściciela    | S-01, F-01           | FR-003, FR-004, FR-006, FR-008, US-01 | done     |
| S-03  | pricing-and-commission  | ustawiać cenę, przeglądać historię cen i widzieć podział prowizji według swoich stawek       | S-02, F-01           | FR-009, FR-010, FR-011, FR-012, US-01 | done     |
| S-04  | contact-management      | dodawać i przeglądać kontakty zainteresowanych stron do ogłoszenia                           | S-02, F-01           | FR-013, FR-014                        | done     |
| S-05  | documents-and-files     | uploadować zdjęcia, zaznaczać dokumenty na liście kontrolnej i uploadować pliki dokumentów   | S-02, F-01           | FR-005, FR-015, FR-016, US-01         | done     |
| S-06  | transaction-close       | zamknąć transakcję przez bramkę dokumentową, nagrać dane notariusza i datę, ponownie otworzyć ogłoszenie | S-02, S-03, S-05, F-01 | FR-007, FR-017, FR-018, US-01  | done     |

## Strumienie

Pomocniczy widok — grupuje elementy według łańcucha zależności. Kanoniczne ułożenie to graf zależności poniżej; tabela pokazuje proponowaną kolejność pracy na równoległych ścieżkach.

| Strumień | Temat          | Łańcuch                                                                              | Uwaga                                                                                         |
| -------- | -------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| A        | Dane i funkcje | `F-01` → `S-02` → `S-03` / `S-05` (równolegle) / `S-04` (równolegle) → `S-06`     | Główna ścieżka do gwiazdy przewodniej; cel `speed` — każdy krok odblokowywany natychmiast po poprzednim. |
| B        | Logowanie      | `S-01` → `S-07`                                                                      | S-07 wymaga też F-01 ze Strumienia A; terminal — nie blokuje S-06.                            |
| C        | Wdrożenie      | `F-02`                                                                               | Brak zależności; umożliwia weryfikację uploadów plików (S-05) na działającym Workers.          |

## Baseline

Stan kodu na dzień `2026-05-24` (automatycznie zbadany + potwierdzony przez użytkownika).
Foundations poniżej zakładają, że poniższe warstwy są obecne i NIE są ponownie scaffoldowane.

- **Frontend:** present — Astro 6.3.1 + React 19 + Tailwind CSS 4.2 (`astro.config.mjs`)
- **Backend / API:** present — Astro SSR `output: "server"` + adapter Cloudflare; trasy auth gotowe (`src/pages/api/auth/`)
- **Data:** partial — Supabase client skonfigurowany (`supabase/config.toml`, `src/lib/supabase.ts`); brak schematu aplikacji i migracji
- **Auth:** present — Supabase Auth + middleware (`src/middleware.ts`); trasy `/dashboard` chronione; cookie-based sessions przez `@supabase/ssr`
- **Deploy / infra:** partial — CI workflow istnieje (`.github/workflows/ci.yml`); wrangler zainstalowany jako dev dep; `wrangler.jsonc` istnieje z nazwą `"10x-astro-starter"` (wymaga zmiany); brak skryptu deploy w `package.json`
- **Observability:** absent — brak loggowania, error trackingu ani strukturowanego monitoringu

## Foundations

### F-01: Schemat bazy danych i migracje

- **Rezultat:** (foundation) schemat aplikacji i migracje Supabase gotowe — tabele ogłoszeń, właścicieli, kontaktów, historii cen, ustawień prowizji, listy dokumentów i przesłanych plików istnieją i są dostępne przez Supabase client.
- **Change ID:** `database-schema`
- **Odniesienia PRD:** FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-016, FR-017, FR-018
- **Odblokowuje:** S-02, S-03, S-04, S-05, S-06 — wszystkie pionowe slices wymagają schematu; bez tabel żadna operacja CRUD nie może działać.
- **Zależności:** —
- **Równolegle z:** F-02, S-01
- **Blokery:** —
- **Nieznane:** —
- **Ryzyko:** Schemat zaprojektowany przed implementacją slices eliminuje destrukcyjne migracje w trakcie; tabele muszą od razu obsługiwać logikę biznesową z §Business Logic PRD (bramka dokumentowa, podział prowizji bez cichego zaokrąglania).
- **Status:** ready

### F-02: Cloudflare Workers — pierwsze wdrożenie

- **Rezultat:** (foundation) aplikacja dostępna pod `estate-desk.workers.dev` z ustawionymi sekretami Supabase (`SUPABASE_URL`, `SUPABASE_KEY`); `npm run build && npx wrangler deploy` kończy się bez błędów; logi dostępne przez `npx wrangler tail`.
- **Change ID:** `cloudflare-first-deploy`
- **Odniesienia PRD:** NFR (czas ładowania strony ≤3s na polskim połączeniu mobilnym; historia ogłoszeń dostępna bezterminowo)
- **Odblokowuje:** weryfikację uploadów plików (S-05) na środowisku Workers (wymagana przez rejestr ryzyk w `context/foundation/infrastructure.md`); bez wdrożenia nie można dostarczyć aplikacji użytkownikowi.
- **Zależności:** —
- **Równolegle z:** F-01, S-01
- **Blokery:** Wymagane ręczne zalogowanie do wrangler (`npx wrangler login`) i ustawienie sekretów — nie może być w pełni zautomatyzowane bez dostępu do konta Cloudflare.
- **Nieznane:** —
- **Ryzyko:** Worker nazwany `"10x-astro-starter"` w `wrangler.jsonc` — należy zmienić na `"estate-desk"` przed pierwszym deploy (krok 1 z `infrastructure.md` Getting Started). Pominięcie powoduje kolizję namespace.
- **Status:** ready

## Slices

### S-01: Logowanie i rejestracja

- **Rezultat:** agent może zarejestrować konto e-mail + hasło, zalogować się i wylogować; próba wejścia na `/dashboard` bez sesji przekierowuje na stronę logowania.
- **Change ID:** `auth-flow`
- **Odniesienia PRD:** FR-001, FR-002
- **Zależności:** — (Supabase Auth niezależne od schematu aplikacji)
- **Równolegle z:** F-01, F-02
- **Blokery:** —
- **Nieznane:** —
- **Ryzyko:** Auth scaffoldowany od startera (`src/pages/api/auth/`, middleware); slice polega na weryfikacji i ewentualnym dopracowaniu istniejącego przepływu — ryzyko niskie.
- **Status:** ready

### S-02: Dashboard ogłoszeń i CRUD

- **Rezultat:** agent może dodać nowe ogłoszenie (typ: sprzedaż lub najem okazjonalny), edytować i usunąć ogłoszenie, przeglądać wszystkie ogłoszenia (aktywne i ukończone) na dashboardzie oraz zapisać dane właściciela (imię, telefon, e-mail) do ogłoszenia.
- **Change ID:** `listing-crud`
- **Odniesienia PRD:** FR-003, FR-004, FR-006, FR-008, US-01
- **Zależności:** S-01, F-01
- **Równolegle z:** —
- **Blokery:** —
- **Nieznane:** —
- **Ryzyko:** Pierwsza funkcja zależna od schematu bazy — błędnie zaprojektowane tabele propagują się do wszystkich późniejszych slices; warto zweryfikować schemat pod kątem US-01 przed rozpoczęciem UI.
- **Status:** done

### S-03: Cennik i podział prowizji

- **Rezultat:** agent może ustawić i zaktualizować cenę wywoławczą ogłoszenia, przeglądać historię zmian ceny, wprowadzić kwotę prowizji i zobaczyć automatyczny podział (brutto / rezerwa podatkowa / część agencji / część agenta) według stawek skonfigurowanych w ustawieniach konta; stawki można ustawić raz w ustawieniach i obowiązują dla wszystkich ogłoszeń.
- **Change ID:** `pricing-and-commission`
- **Odniesienia PRD:** FR-009, FR-010, FR-011, FR-012, US-01
- **Zależności:** S-02, F-01
- **Równolegle z:** S-04, S-05
- **Blokery:** —
- **Nieznane:**
  - Czy kolejność i podstawa wyliczeń podziału prowizji to: prowizja brutto → rezerwa podatkowa (% brutto) → część agencji (% brutto) → część agenta (brutto − podatek − agencja)? — Owner: user. Block: no (do potwierdzenia podczas planowania `/10x-plan pricing-and-commission`).
- **Ryzyko:** PRD guardrail: "rounding difference surfaces as a validation error" — logika zaokrąglania musi być przetestowana przed S-06, gdzie prowizja jest blokowana przy zamknięciu transakcji.
- **Status:** done

### S-04: Kontakty zainteresowanych stron

- **Rezultat:** agent może dodać kontakt zainteresowanej strony (kupujący / najemca) do ogłoszenia z imieniem, telefonem i e-mailem oraz przeglądać wszystkie kontakty powiązane z danym ogłoszeniem.
- **Change ID:** `contact-management`
- **Odniesienia PRD:** FR-013, FR-014
- **Zależności:** S-02, F-01
- **Równolegle z:** S-03, S-05
- **Blokery:** —
- **Nieznane:** —
- **Ryzyko:** Minimalny — prosty CRUD encji powiązanej z ogłoszeniem. Nie blokuje gwiazdy przewodniej (S-06); może być implementowany równolegle ze ścieżką do S-06.
- **Status:** done

### S-05: Zdjęcia, lista kontrolna dokumentów i pliki

- **Rezultat:** agent może uploadować zdjęcia do ogłoszenia, przeglądać pre-wypełnioną listę kontrolną dokumentów (dostosowaną do typu ogłoszenia: sprzedaż vs najem okazjonalny), odfajkowywać, dodawać i usuwać pozycje z listy oraz uploadować pliki dokumentów (do 10 MB).
- **Change ID:** `documents-and-files`
- **Odniesienia PRD:** FR-005, FR-015, FR-016, US-01
- **Zależności:** S-02, F-01
- **Równolegle z:** S-03, S-04
- **Blokery:** —
- **Nieznane:**
  - Jakie dokładnie pozycje wchodzą w skład domyślnej listy dokumentów dla sprzedaży i dla najmu okazjonalnego? — Owner: user (agent zna listę). Block: no (potrzebne przed implementacją UI listy, nie blokuje schematu).
  - Czy upload plików przez Supabase Storage działa poprawnie w środowisku Cloudflare Workers workerd przy rozmiarach do 10 MB? (Rejestr ryzyk `infrastructure.md` wymaga testu na wdrożonym Workers.) — Owner: TBD. Block: no (F-02 umożliwia test; workaround możliwy).
- **Ryzyko:** S-06 (gwiazda przewodnia) zależy od listy kontrolnej z tego slice — bramka dokumentowa sprawdza stan listy przed zamknięciem transakcji. S-05 musi być ukończony przed S-06.
- **Status:** done

### S-06: Zamknięcie transakcji (gwiazda przewodnia)

- **Rezultat:** agent może oznaczyć ogłoszenie jako „ukończone" — po weryfikacji że wszystkie wymagane dokumenty są odfajkowane lub aktywowany jest override — z zablokowaną i zapisaną kwotą prowizji (brutto / podatek / agencja / agent), nagrać dane kancelarii notarialnej i datę transakcji oraz ponownie otworzyć zamkniętą transakcję jeśli umowa się nie domknęła.
- **Change ID:** `transaction-close`
- **Odniesienia PRD:** FR-007, FR-017, FR-018, US-01
- **Zależności:** S-02, S-03, S-05, F-01
- **Równolegle z:** S-04
- **Blokery:** —
- **Nieznane:** —
- **Ryzyko:** Centralny przepływ biznesowy PRD — bramka dokumentowa musi precyzyjnie implementować logikę z §Business Logic: „ready-to-close (all items checked or override active) or blocked". Błąd tutaj neguje główną wartość produktu.
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID               | Sugerowany tytuł zadania                                               | Gotowy na `/10x-plan` | Uwagi                                                             |
| ---------- | ----------------------- | ---------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------- |
| F-01       | database-schema         | Zaprojektuj i zaaplikuj schemat Supabase + migracje                    | yes                   | Uruchom `/10x-plan database-schema`                               |
| F-02       | cloudflare-first-deploy | Pierwsze wdrożenie na Cloudflare Workers (rename + sekrety + deploy)   | yes                   | Uruchom `/10x-plan cloudflare-first-deploy`                       |
| S-01       | auth-flow               | Zweryfikuj i dopracuj przepływ rejestracji i logowania                 | yes                   | Uruchom `/10x-plan auth-flow`                                     |
| S-02       | listing-crud            | Dashboard ogłoszeń: CRUD + dane właściciela                           | done                  | impl_reviewed 2026-05-27                                          |
| S-03       | pricing-and-commission  | Cennik i podział prowizji (historia cen + konfiguracja stawek)         | done                  | impl_reviewed 2026-05-29                                          |
| S-04       | contact-management      | Kontakty zainteresowanych stron do ogłoszenia                          | done                  | implemented 2026-05-30                                            |
| S-05       | documents-and-files     | Zdjęcia + lista kontrolna dokumentów + upload plików                   | done                  | implemented 2026-05-30                                            |
| S-06       | transaction-close       | Zamknięcie transakcji: bramka dokumentowa + prowizja + notariusz       | done                  | impl_reviewed 2026-05-30; gwiazda przewodnia osiągnięta           |

## Otwarte pytania roadmapy

*(brak — PRD nie zawiera otwartych pytań; nieznane per-slice opisane w treści poszczególnych slices)*

## Odłożone

- **FR-019: Podpowiedzi AI dla aktywnych ogłoszeń** — Dlaczego odłożone: PRD §Non-Goals; wszystkie funkcje AI to v2.
- **FR-020: Walidacja prowizji przez AI** — Dlaczego odłożone: PRD §Non-Goals; v2 priority #1 po MVP.
- **FR-021: AI-drafting dokumentów transakcyjnych** — Dlaczego odłożone: PRD §Non-Goals; v2.
- **FR-022: Notatki z rozmów przez AI** — Dlaczego odłożone: PRD §Non-Goals; v2.
- **Portal klientów (kupujący/najemcy)** — Dlaczego odłożone: PRD §Non-Goals; podwaja powierzchnię auth i tworzy drugi UX do utrzymania przed sprawdzeniem głównego workflow.
- **Integracja z portalami ogłoszeniowymi (Otodom, Gratka)** — Dlaczego odłożone: PRD §Non-Goals; zakres integracji przekracza MVP.
- **Pełna księgowość / faktury VAT** — Dlaczego odłożone: PRD §Non-Goals; podział prowizji to narzędzie decyzyjne, nie dokument finansowy.
- **Tryb offline** — Dlaczego odłożone: PRD §Non-Goals; aplikacja wymaga połączenia z internetem.
- **Observability (logowanie, error tracking)** — Dlaczego odłożone: brak w baseline + cel `speed`; `wrangler tail` wystarczy do debugowania na wczesnym etapie MVP.

## Ukończone

| ID   | Change ID              | Ukończono  | Status zmiany  |
| ---- | ---------------------- | ---------- | -------------- |
| S-02 | listing-crud           | 2026-05-27 | impl_reviewed  |
| S-03 | pricing-and-commission | 2026-05-29 | impl_reviewed  |
| S-04 | contact-management     | 2026-05-30 | implemented    |
| S-05 | documents-and-files    | 2026-05-30 | implemented    |
| S-06 | transaction-close      | 2026-05-30 | impl_reviewed  |

## Done

- **S-02: agent może dodawać, edytować i usuwać ogłoszenia, przeglądać dashboard, rejestrować dane właściciela** — Archived 2026-06-05 → `context/archive/2026-05-25-listing-crud/`. Lesson: —.
- **S-03: agent może ustawiać cenę, przeglądać historię cen i widzieć podział prowizji według swoich stawek** — Archived 2026-06-05 → `context/archive/2026-05-29-pricing-and-commission/`. Lesson: —.
- **S-04: agent może dodawać i przeglądać kontakty zainteresowanych stron do ogłoszenia** — Archived 2026-06-05 → `context/archive/2026-05-30-contact-management/`. Lesson: —.
- **S-05: agent może uploadować zdjęcia, zaznaczać dokumenty na liście kontrolnej i uploadować pliki dokumentów** — Archived 2026-06-05 → `context/archive/2026-05-30-documents-and-files/`. Lesson: —.
- **S-06: agent może zamknąć transakcję przez bramkę dokumentową, nagrać dane notariusza i datę, ponownie otworzyć ogłoszenie** — Archived 2026-06-05 → `context/archive/2026-05-30-transaction-close/`. Lesson: —.

---

# Roadmap: EstateDesk — Menu, Navigation & Address Formatting

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

```
version: 1
status: draft
created: 2026-06-05
updated: 2026-06-06
prd_version: 1
main_goal: low-complexity
top_blocker: decisions
```

## Vision recap (Brownfield)

EstateDesk to aplikacja do zarządzania transakcjami nieruchomości dla jednego polskiego agenta, zbudowana na Astro 6, React 19, TypeScript i Tailwind CSS v4, z backendem Supabase i deploymentem na Cloudflare Workers. Cztery luki UX generują dzienne tarcie: brak spójnej nawigacji zakładkowej między podstronami ogłoszeń, niespójna wsteczna nawigacja „Powrót", ręczne formatowanie polskich adresów oraz placeholder strony głównej. Zmiana usuwa te luki bez dotykania istniejących tras URL, zapisów formularzy ani modelu autoryzacji.

## North star (Brownfield)

**S-01: Nawigacja zakładkowa** — gwiazda przewodnia (najmniejszy przepływ end-to-end, który, jeśli działa, potwierdza sens całej zmiany) to S-01, ponieważ likwiduje najczęściej odczuwane tarcie w codziennej pracy agenta i nie wymaga żadnych zewnętrznych zależności — może zostać zwalidowany natychmiast po ukończeniu F-01.

## Na pierwszy rzut oka (Brownfield)

| ID   | Change ID              | Rezultat (agent może…)                                                                         | Zależności    | Odniesienia PRD       | Status |
|------|------------------------|-----------------------------------------------------------------------------------------------|---------------|-----------------------|--------|
| F-01 | claude-md-conventions  | (foundation) konwencje kodowania EstateDesk dodane do CLAUDE.md                               | —             | §Non-Functional Req.  | done   |
| S-01 | listing-tab-navigation | przechodzić między 5 podstronami ogłoszenia przez pasek zakładek i zawsze wrócić do dashboardu | F-01          | US-01, FR-001, FR-002 | done   |
| S-02 | address-formatting-llm | sformatować adres do formy kanonicznej jednym klawiszem; widzieć błąd inline przy awarii LLM  | F-01, S-01    | US-02, FR-003, FR-004 | done   |
| S-03 | home-page-redesign     | zobaczyć polskojęzyczną stronę główną z brandingiem EstateDesk                                 | —             | FR-005                | done   |

## Strumienie (Brownfield)

| Strumień | Temat                    | Łańcuch                   | Uwaga                                                                           |
|----------|--------------------------|---------------------------|---------------------------------------------------------------------------------|
| A        | Nawigacja & formatowanie | `F-01` → `S-01` → `S-02` | Główna ścieżka; cel low-complexity — north star S-01 najwcześniej jak możliwe  |
| B        | Strona główna            | `S-03`                    | Samodzielny; zablokowany do czasu podjęcia decyzji o designie                   |

## Baseline (Brownfield)

Stan bazy kodu na dzień `2026-06-05` (zbadany automatycznie + potwierdzony przez użytkownika).

- **Frontend:** present — Astro 6.3.1 + React 19.2.6 + Tailwind CSS v4; layout w `src/layouts/Layout.astro`; wszystkie 5 podstron ogłoszeń istnieje (`src/pages/dashboard/listings/[id]/{edit,pricing,contacts,documents,close}.astro`); `src/pages/index.astro` renderuje placeholder Welcome
- **Backend / API:** present — 20+ tras API w `src/pages/api/`; auth, listings, contacts, documents, photos, files; ad-hoc linki nawigacyjne potwierdzone w `edit.astro:45-50`; brak trasy `format-address`
- **Data:** present — klient Supabase w `src/lib/supabase.ts`; migracje w `supabase/migrations/`; typy TypeScript w `src/types/`
- **Auth:** present — Supabase via `@supabase/ssr`; middleware w `src/middleware.ts:18-22`; strony logowania/rejestracji w `src/pages/auth/`
- **Deploy / infra:** present — GitHub Actions CI (`ci` → `deploy` → `migrate`); Cloudflare Workers via `wrangler.jsonc`; env schema w `astro.config.mjs:28-34` (brak `OPENROUTER_API_KEY`)
- **Observability:** partial — Sentry (error tracking) w `sentry.server.config.ts` i `sentry.client.config.ts`; brak logowania żądań; brak metryk

## Foundations (Brownfield)

### F-01: Konwencje kodowania EstateDesk w CLAUDE.md

- **Rezultat:** (foundation) Blok `## EstateDesk Coding Conventions` dodany do `CLAUDE.md`; dokumentuje: wzorzec React island (`client:load` vs `client:only`), kształt trasy API, wywołanie zewnętrznego LLM przez trasę serwerową (nigdy bezpośrednio z komponentu klienckiego), różnice Tailwind CSS v4 — gotowy do użycia przez agenta przy implementacji S-01, S-02 i S-03.
- **Change ID:** claude-md-conventions
- **Odniesienia PRD:** §Non-Functional Requirements (tab nav na ekranach mobilnych, brak regresji na zapisach formularzy)
- **Odblokowuje:** S-01 (wzorzec Tailwind v4 i React island dla tab bara), S-02 (wzorzec LLM-via-API-route i React island dla pola adresu), S-03 (wzorzec Tailwind v4 dla strony głównej)
- **Zależności:** —
- **Równolegle z:** —
- **Blokery:** —
- **Nieznane:** —
- **Ryzyko:** Bez udokumentowanych wzorców agent może wygenerować kod v3-era Tailwind lub wywołać OpenRouter bezpośrednio z kodu klienckiego — oba błędy wykraczają poza cel niskiej złożoności i drugi może ujawnić klucz API w przeglądarce.
- **Status:** done

## Slices (Brownfield)

### S-01: Nawigacja zakładkowa

- **Rezultat:** Agent może przechodzić między wszystkimi 5 podstronami ogłoszenia (Edit, Pricing, Contacts, Documents, Close) przez poziomy pasek zakładek nad treścią sekcji; aktywna zakładka jest wizualnie wyróżniona; na każdej podstronie obecny jest spójny link „Powrót" kierujący do dashboardu.
- **Change ID:** listing-tab-navigation
- **Odniesienia PRD:** US-01, FR-001, FR-002
- **Zależności:** F-01
- **Równolegle z:** —
- **Blokery:** —
- **Nieznane:** —
- **Ryzyko:** Pięć podstron modyfikowanych jednocześnie; regresja na istniejących ad-hoc linkach inline jest możliwa, jeśli stare linki nie zostaną w pełni usunięte. Weryfikacja: test E2E przechodzący przez wszystkie 5 zakładek i link Powrót.
- **Status:** done

### S-02: Formatowanie adresu przez LLM

- **Rezultat:** Agent może wpisać niepełny adres (np. „Sarmacka 5/6 Warszawa") w pole adresu na formularzu edycji lub nowego ogłoszenia, nacisnąć Enter i zobaczyć kanoniczny polski format (ul. prefix, kod pocztowy NN-NNN, dzielnica w nawiasie) zamiast surowego tekstu; przy awarii wywołania OpenRouter pole zachowuje surowy tekst i wyświetla błąd inline z możliwością ponowienia bez odświeżania strony.
- **Change ID:** address-formatting-llm
- **Odniesienia PRD:** US-02, FR-003, FR-004
- **Zależności:** F-01, S-01
- **Równolegle z:** —
- **Blokery:** —
- **Nieznane:**
  - `OPENROUTER_API_KEY` musi być dodany do env schema w `astro.config.mjs` i udostępniony w środowisku Cloudflare Workers (GitHub Secrets + Wrangler env). — Owner: użytkownik. Block: no.
- **Ryzyko:** `edit.astro` jest modyfikowany też przez S-01 (pasek zakładek); implementacja po S-01 daje czystszą bazę. Czas odpowiedzi LLM podlega NFR ≤3 s — trzeba obsłużyć timeout i stan ładowania.
- **Status:** done

### S-03: Strona główna EstateDesk

- **Rezultat:** Agent i odwiedzający widzą polskojęzyczną stronę główną z brandingiem EstateDesk w miejscu placeholdera Astro Starter; strona zawiera działające linki Zaloguj się / Zarejestruj się.
- **Change ID:** home-page-redesign
- **Odniesienia PRD:** FR-005
- **Zależności:** —
- **Równolegle z:** —
- **Blokery:** —
- **Nieznane:**
  - Wizualny design strony głównej (układ, treść, komponenty, identyfikacja wizualna EstateDesk) nie jest zdefiniowany. — Owner: użytkownik. Block: yes.
- **Ryzyko:** Implementacja bez ustalonego designu oznacza konieczność przeróbki. Po ustaleniu designu zmiana jest technicznie prosta — nie warto zaczynać bez jasnej specyfikacji.
- **Status:** done

## Backlog Handoff (Brownfield)

| Roadmap ID | Change ID              | Sugerowany tytuł zadania                               | Gotowy na `/10x-plan` | Uwagi                                                  |
|------------|------------------------|--------------------------------------------------------|-----------------------|--------------------------------------------------------|
| F-01       | claude-md-conventions  | Dodaj konwencje kodowania EstateDesk do CLAUDE.md      | yes                   | Uruchom `/10x-plan claude-md-conventions`              |
| S-01       | listing-tab-navigation | Dodaj pasek nawigacji zakładkowej do wszystkich podstron ogłoszenia | done       | Ukończone                                              |
| S-02       | address-formatting-llm | Dodaj formatowanie adresu przez LLM do formularza edycji | done                | Ukończone                                              |
| S-03       | home-page-redesign     | Zastąp placeholder Astro stroną główną EstateDesk      | done                  | Ukończone                                              |

## Odłożone (Brownfield)

- **Walidacja adresu** — Dlaczego odłożone: PRD §Non-Goals — wyjście LLM akceptowane bez weryfikacji z polską bazą kodów pocztowych.
- **Formatowanie adresu offline** — Dlaczego odłożone: PRD §Non-Goals — formatowanie wymaga połączenia z OpenRouter; brak obsługi trybu offline.
- **Zakładki nawigacyjne na formularzu nowego ogłoszenia** — Dlaczego odłożone: PRD §Non-Goals — `/listings/new` to formularz jednoetapowy, nie cel nawigacji zakładkowej.
- **Analityka i testy A/B strony głównej** — Dlaczego odłożone: PRD §Non-Goals — strona główna jest czysto prezentacyjna; brak narzędzi śledzenia.

## Done (Brownfield)

- **S-01** (`listing-tab-navigation`) — Pasek nawigacji zakładkowej dodany do wszystkich 5 podstron ogłoszenia; link Powrót ustandaryzowany do dashboardu. Ukończone 2026-06-06.
- **F-01: (foundation) konwencje kodowania EstateDesk dodane do CLAUDE.md** — Archived 2026-06-06 → `context/archive/2026-06-05-claude-md-conventions/`. Lesson: —.
- **S-02: sformatować adres do formy kanonicznej jednym klawiszem; widzieć błąd inline przy awarii LLM** — Archived 2026-06-06 → `context/archive/2026-06-06-address-formatting-llm/`. Lesson: —.
- **S-03: Agent i odwiedzający widzą polskojęzyczną stronę główną z brandingiem EstateDesk w miejscu placeholdera Astro Starter; strona zawiera działające linki Zaloguj się / Zarejestruj się.** — Archived 2026-06-06 → `context/archive/2026-06-06-home-page-redesign/`. Lesson: —.
