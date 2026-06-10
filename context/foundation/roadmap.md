---
project: "EstateDesk — Dashboard Filters, Export & Help"
version: 1
status: draft
created: 2026-06-08
updated: 2026-06-10
prd_version: 1
main_goal: low-complexity
top_blocker: capacity
---

# Roadmap: EstateDesk — Dashboard Filters, Export & Help

> Wyprowadzone z `context/foundation/prd.md` (v1) + automatycznie zbadany stan kodu.
> Edytuj w miejscu; archiwizuj gdy zastąpione.
> Poniższe elementy ułożone są w kolejności zależności. Tabela "Na pierwszy rzut oka" to indeks.

## Vision recap

EstateDesk to aplikacja do zarządzania ogłoszeniami nieruchomości dla jednego polskiego agenta. Trzy przyciski na dashboardzie — Filtry, Eksport, Pomoc — są już wyrenderowane, ale kliknięcie ich nic nie robi. Ta zmiana podpina do nich działające funkcje: pasek filtrów zawęża listę ogłoszeń bez przeładowania strony, przycisk Eksport pobiera plik CSV wszystkich ogłoszeń, a Pomoc przenosi do nowej polskojęzycznej strony dokumentacji. Żadna logika domenowa nie jest dodawana ani zmieniana.

## North star

**S-01: Filtry** — agent może filtrować listę ogłoszeń na dashboardzie według statusu, zakresu ceny i miasta.

> Gwiazda przewodnia — to najmniejszy przepływ end-to-end, który jeśli działa, udowadnia centralną hipotezę zmiany; umieszczona tak wcześnie jak pozwalają zależności, bo wszystko inne ma sens tylko wtedy, gdy to działa. S-01 jest gwiazdą przewodnią, bo wymaga kluczowej decyzji architektonicznej (konwersja statycznej pętli Astro na wyspę React) — gdy to działa, eksport i pomoc są technicznie prostsze.

## Na pierwszy rzut oka

| ID   | Change ID          | Rezultat (agent może…)                                                   | Zależności | Odniesienia PRD              | Status |
| ---- | ------------------ | ------------------------------------------------------------------------ | ---------- | ---------------------------- | ------ |
| S-01 | dashboard-filters  | filtrować listę ogłoszeń po statusie, cenie i mieście; wyniki natychmiast | —          | US-01, FR-001, FR-002, FR-003, FR-004, FR-005 | done   |
| S-02 | dashboard-export   | pobrać wszystkie ogłoszenia jako plik .csv                               | —          | US-02, FR-006                | done   |
| S-03 | help-page          | nawigować do /help i czytać polskojęzyczną dokumentację aplikacji        | —          | US-03, FR-007, FR-008        | ready  |

## Baseline

Stan kodu na dzień `2026-06-08` (automatycznie zbadany + potwierdzony przez użytkownika).
Foundations poniżej zakładają, że poniższe warstwy są obecne i NIE są ponownie scaffoldowane.

- **Frontend:** present — Astro 5 + React + Tailwind CSS v4; lista ogłoszeń renderowana jako statyczna pętla Astro po stronie serwera (`dashboard.astro:127-130`); przyciski Filtry/Eksport obecne jako HTML bez onClick (`dashboard.astro:102, 108`); Pomoc jako `<span>` z disabled styling (`DashboardHeader.astro:28`)
- **Backend / API:** present — zapytanie Supabase ładuje ogłoszenia w `dashboard.astro:19-25`; 20+ tras API w `src/pages/api/`
- **Data:** present — tabela `listings` zawiera wszystkie kolumny wymagane przez PRD: `address`, `status` (wartości 'active'/'done'), `asking_price`, `owner_name`, `created_at`, `closed_at`; brak dedykowanego pola "miasto" — filtr będzie działał na polu `address`
- **Auth:** present — Supabase Auth + middleware (`src/middleware.ts`); `/dashboard` chroniony; sesje cookie przez `@supabase/ssr`
- **Deploy / infra:** present — GitHub Actions CI; Cloudflare Workers przez `wrangler.jsonc`
- **Observability:** partial — Sentry skonfigurowany (`sentry.server.config.ts`, `sentry.client.config.ts`); brak logowania żądań

## Foundations

Brak foundacji — wszystkie warstwy techniczne są już na miejscu (patrz §Baseline). Trzy slices mogą być implementowane bezpośrednio i niezależnie.

## Slices

### S-01: Filtry na dashboardzie

- **Rezultat:** agent może filtrować listę ogłoszeń na dashboardzie według statusu (Wszystkie/Aktywne/Zamknięte), zakresu ceny (Cena od / Cena do) i miasta (free-text, dopasowanie w `address`); lista zawęża się natychmiast bez przeładowania strony ani zapytań do Supabase; zamknięcie paska filtrów resetuje wszystkie filtry do stanu domyślnego; gdy filtr jest aktywny, przy przycisku Filtry widoczny jest wizualny wskaźnik (nice-to-have, FR-005).
- **Change ID:** dashboard-filters
- **Odniesienia PRD:** US-01, FR-001, FR-002, FR-003, FR-004, FR-005
- **Zależności:** —
- **Równolegle z:** S-02, S-03
- **Blokery:** —
- **Nieznane:**
  - Tabela `listings` nie ma dedykowanego pola "miasto" — filtr będzie dopasowywał tekst do pola `address` (które zawiera nazwę miasta po formatowaniu LLM). Czy to zgodne z intencją PRD? — Owner: user. Block: no (prawdopodobne na podstawie shape-notes: „city-filter: free-text string match against city field").
- **Ryzyko:** Lista ogłoszeń jest aktualnie statyczną pętlą Astro (`dashboard.astro:127-130`) — przekształcenie na wyspę React z `client:load` jest kluczowym krokiem architektonicznym; stan bez-filtrów musi być identyczny z obecnym widokiem (PRD §Preserved). Status 'active'/'done' z bazy musi być mapowany na Aktywne/Zamknięte w logice filtrowania i wyświetlania.
- **Status:** done

### S-02: Eksport CSV

- **Rezultat:** agent może pobrać wszystkie ogłoszenia jako plik `.csv` klikając Eksport na dashboardzie; plik zawiera jedną kolumnę na ogłoszenie: adres, status, cena wywoławcza, właściciel, data dodania, data zamknięcia (puste jeśli ogłoszenie aktywne); nazwa pliku ma format `estatedesk-YYYY-MM-DD.csv`; eksport zawiera zawsze pełną listę ogłoszeń niezależnie od aktywnych filtrów.
- **Change ID:** dashboard-export
- **Odniesienia PRD:** US-02, FR-006
- **Zależności:** —
- **Równolegle z:** S-01, S-03
- **Blokery:** —
- **Nieznane:** —
- **Ryzyko:** Jeśli eksport zostanie zaimplementowany jako część tej samej wyspy React co filtry (S-01), musi odczytywać pełny nieufiltrowany zestaw danych, nie przefiltrowany widok — PRD §Export: „export always includes all listings regardless of current filter state". Status 'active'/'done' z bazy musi być mapowany na polskie etykiety (Aktywne/Zamknięte) w pliku CSV.
- **Status:** done

### S-03: Strona pomocy

- **Rezultat:** agent może nawigować do `/help` klikając Pomoc na dashboardzie; strona `/help` wyświetla polskojęzyczną dokumentację podzieloną na 4 sekcje: (1) jak tworzyć ogłoszenia, (2) dokumenty i lista kontrolna, (3) prowizja i ceny, (4) kontakty i transakcja; strona zawiera link „Powrót do dashboardu"; strona jest chroniona autoryzacją.
- **Change ID:** help-page
- **Odniesienia PRD:** US-03, FR-007, FR-008
- **Zależności:** —
- **Równolegle z:** S-01, S-02
- **Blokery:** —
- **Nieznane:** —
- **Ryzyko:** Przycisk Pomoc jest aktualnie renderowany jako `<span>` z disabled styling (`DashboardHeader.astro:28`) — zmiana na link z nawigacją modyfikuje komponent DashboardHeader; minimalna zmiana, ale wymaga weryfikacji, że nie wpłynie na inne części headera. Strona `/help` musi być auth-gated (PRD §Access Control).
- **Status:** ready

## Backlog Handoff

| Roadmap ID | Change ID          | Sugerowany tytuł zadania                             | Gotowy na `/10x-plan` | Uwagi                                     |
| ---------- | ------------------ | ---------------------------------------------------- | --------------------- | ----------------------------------------- |
| S-01       | dashboard-filters  | Dodaj filtry do listy ogłoszeń na dashboardzie       | yes                   | Uruchom `/10x-plan dashboard-filters`     |
| S-02       | dashboard-export   | Dodaj eksport CSV wszystkich ogłoszeń z dashboardu   | yes                   | Uruchom `/10x-plan dashboard-export`      |
| S-03       | help-page          | Utwórz stronę /help z dokumentacją po polsku         | yes                   | Uruchom `/10x-plan help-page`             |

## Otwarte pytania roadmapy

*(brak — PRD nie zawiera otwartych pytań; nieznane per-slice opisane w treściach slices)*

## Odłożone

- **Filtr oparty na URL (`?status=aktywne`)** — Dlaczego odłożone: PRD §Non-Goals; filtr efemeryczny w React state; routing complexity bez wartości dla single-user app; URL params → v2.
- **Filtrowanie po stronie serwera (Supabase query per filter)** — Dlaczego odłożone: PRD §Non-Goals; pełna lista ładowana raz; klient filtruje lokalnie; wystarczające dla 5–20 ogłoszeń.
- **Eksport przefiltrowanego podzbioru** — Dlaczego odłożone: PRD §Non-Goals; eksport to narzędzie danych, filtr to narzędzie widoku; niezależność zapobiega nieoczekiwanym wynikiem.
- **CMS dla treści pomocy** — Dlaczego odłożone: PRD §Non-Goals; treść w plikach Markdown edytowanych bezpośrednio; agent jest jedynym maintainerem.

## Done

*(Puste przy pierwszej generacji. `/10x-archive` doda wpis tutaj i zmieni Status na `done` gdy zmiana o pasującym Change ID zostanie zarchiwizowana.)*

- **S-01: filtrować listę ogłoszeń po statusie, cenie i mieście; wyniki natychmiast** — Archived 2026-06-10 → `context/archive/2026-06-08-dashboard-filters/`. Lesson: —.
- **S-02: pobrać wszystkie ogłoszenia jako plik .csv** — Archived 2026-06-10 → `context/archive/2026-06-10-dashboard-export/`. Lesson: —.
