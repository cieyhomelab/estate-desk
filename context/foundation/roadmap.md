---
project: EstateDesk
version: 1
status: draft
created: 2026-05-24
updated: 2026-05-30
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
| S-02  | listing-crud            | dodawać, edytować i usuwać ogłoszenia, przeglądać dashboard, rejestrować dane właściciela    | S-01, F-01           | FR-003, FR-004, FR-006, FR-008, US-01 | proposed |
| S-03  | pricing-and-commission  | ustawiać cenę, przeglądać historię cen i widzieć podział prowizji według swoich stawek       | S-02, F-01           | FR-009, FR-010, FR-011, FR-012, US-01 | proposed |
| S-04  | contact-management      | dodawać i przeglądać kontakty zainteresowanych stron do ogłoszenia                           | S-02, F-01           | FR-013, FR-014                        | proposed |
| S-05  | documents-and-files     | uploadować zdjęcia, zaznaczać dokumenty na liście kontrolnej i uploadować pliki dokumentów   | S-02, F-01           | FR-005, FR-015, FR-016, US-01         | proposed |
| S-06  | transaction-close       | zamknąć transakcję przez bramkę dokumentową, nagrać dane notariusza i datę, ponownie otworzyć ogłoszenie | S-02, S-03, S-05, F-01 | FR-007, FR-017, FR-018, US-01  | proposed |

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
- **Status:** proposed

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
- **Status:** proposed

### S-04: Kontakty zainteresowanych stron

- **Rezultat:** agent może dodać kontakt zainteresowanej strony (kupujący / najemca) do ogłoszenia z imieniem, telefonem i e-mailem oraz przeglądać wszystkie kontakty powiązane z danym ogłoszeniem.
- **Change ID:** `contact-management`
- **Odniesienia PRD:** FR-013, FR-014
- **Zależności:** S-02, F-01
- **Równolegle z:** S-03, S-05
- **Blokery:** —
- **Nieznane:** —
- **Ryzyko:** Minimalny — prosty CRUD encji powiązanej z ogłoszeniem. Nie blokuje gwiazdy przewodniej (S-06); może być implementowany równolegle ze ścieżką do S-06.
- **Status:** proposed

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
- **Status:** proposed

### S-06: Zamknięcie transakcji (gwiazda przewodnia)

- **Rezultat:** agent może oznaczyć ogłoszenie jako „ukończone" — po weryfikacji że wszystkie wymagane dokumenty są odfajkowane lub aktywowany jest override — z zablokowaną i zapisaną kwotą prowizji (brutto / podatek / agencja / agent), nagrać dane kancelarii notarialnej i datę transakcji oraz ponownie otworzyć zamkniętą transakcję jeśli umowa się nie domknęła.
- **Change ID:** `transaction-close`
- **Odniesienia PRD:** FR-007, FR-017, FR-018, US-01
- **Zależności:** S-02, S-03, S-05, F-01
- **Równolegle z:** S-04
- **Blokery:** —
- **Nieznane:** —
- **Ryzyko:** Centralny przepływ biznesowy PRD — bramka dokumentowa musi precyzyjnie implementować logikę z §Business Logic: „ready-to-close (all items checked or override active) or blocked". Błąd tutaj neguje główną wartość produktu.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID               | Sugerowany tytuł zadania                                               | Gotowy na `/10x-plan` | Uwagi                                                             |
| ---------- | ----------------------- | ---------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------- |
| F-01       | database-schema         | Zaprojektuj i zaaplikuj schemat Supabase + migracje                    | yes                   | Uruchom `/10x-plan database-schema`                               |
| F-02       | cloudflare-first-deploy | Pierwsze wdrożenie na Cloudflare Workers (rename + sekrety + deploy)   | yes                   | Uruchom `/10x-plan cloudflare-first-deploy`                       |
| S-01       | auth-flow               | Zweryfikuj i dopracuj przepływ rejestracji i logowania                 | yes                   | Uruchom `/10x-plan auth-flow`                                     |
| S-02       | listing-crud            | Dashboard ogłoszeń: CRUD + dane właściciela                           | no                    | Wymaga F-01 + S-01                                               |
| S-03       | pricing-and-commission  | Cennik i podział prowizji (historia cen + konfiguracja stawek)         | no                    | Wymaga S-02 + F-01; potwierdź formułę prowizji podczas planowania |
| S-04       | contact-management      | Kontakty zainteresowanych stron do ogłoszenia                          | no                    | Wymaga S-02 + F-01                                               |
| S-05       | documents-and-files     | Zdjęcia + lista kontrolna dokumentów + upload plików                   | no                    | Wymaga S-02 + F-01; wyjaśnij listę dokumentów z agentem przed planowaniem |
| S-06       | transaction-close       | Zamknięcie transakcji: bramka dokumentowa + prowizja + notariusz       | no                    | Wymaga S-02 + S-03 + S-05 + F-01; gwiazda przewodnia             |

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

*(puste przy pierwszej generacji — `/10x-archive` dodaje wpisy tutaj po zamknięciu zmiany)*
