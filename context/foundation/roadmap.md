---
project: "EstateDesk — Menu, Navigation & Address Formatting"
version: 1
status: draft
created: 2026-06-05
updated: 2026-06-06
prd_version: 1
main_goal: low-complexity
top_blocker: decisions
---

# Roadmap: EstateDesk — Menu, Navigation & Address Formatting

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

EstateDesk to aplikacja do zarządzania transakcjami nieruchomości dla jednego polskiego agenta, zbudowana na Astro 6, React 19, TypeScript i Tailwind CSS v4, z backendem Supabase i deploymentem na Cloudflare Workers. Cztery luki UX generują dzienne tarcie: brak spójnej nawigacji zakładkowej między podstronami ogłoszeń, niespójna wsteczna nawigacja „Powrót", ręczne formatowanie polskich adresów oraz placeholder strony głównej. Zmiana usuwa te luki bez dotykania istniejących tras URL, zapisów formularzy ani modelu autoryzacji.

## North star

**S-01: Nawigacja zakładkowa** — gwiazda przewodnia (najmniejszy przepływ end-to-end, który, jeśli działa, potwierdza sens całej zmiany) to S-01, ponieważ likwiduje najczęściej odczuwane tarcie w codziennej pracy agenta i nie wymaga żadnych zewnętrznych zależności — może zostać zwalidowany natychmiast po ukończeniu F-01.

## At a glance

| ID   | Change ID              | Outcome (agent może …)                                                                         | Prerequisites | PRD refs              | Status   |
|------|------------------------|-----------------------------------------------------------------------------------------------|---------------|-----------------------|----------|
| F-01 | claude-md-conventions  | (foundation) konwencje kodowania EstateDesk dodane do CLAUDE.md                               | —             | §Non-Functional Req.  | done     |
| S-01 | listing-tab-navigation | przechodzić między 5 podstronami ogłoszenia przez pasek zakładek i zawsze wrócić do dashboardu | F-01          | US-01, FR-001, FR-002 | done     |
| S-02 | address-formatting-llm | sformatować adres do formy kanonicznej jednym klawiszem; widzieć błąd inline przy awarii LLM  | F-01, S-01    | US-02, FR-003, FR-004 | done     |
| S-03 | home-page-redesign     | zobaczyć polskojęzyczną stronę główną z brandingiem EstateDesk                                 | —             | FR-005                | blocked  |

## Streams

Pomoc nawigacyjna — grupuje pozycje według wspólnego łańcucha zależności. Kanoniczny porządek nadal jest w grafie zależności poniżej; ta tabela to proponowany plan czytania i realizacji.

| Stream | Temat                    | Łańcuch               | Uwaga                                                                           |
|--------|--------------------------|-----------------------|---------------------------------------------------------------------------------|
| A      | Nawigacja & formatowanie | `F-01` → `S-01` → `S-02` | Główna ścieżka; cel low-complexity — north star S-01 najwcześniej jak możliwe  |
| B      | Strona główna            | `S-03`                | Samodzielny; zablokowany do czasu podjęcia decyzji o designie                   |

## Baseline

Stan bazy kodu na dzień `2026-06-05` (zbadany automatycznie + potwierdzony przez użytkownika).
Foundations poniżej zakładają, że wymienione warstwy są obecne i ich NIE scaffoldują ponownie.

- **Frontend:** present — Astro 6.3.1 + React 19.2.6 + Tailwind CSS v4; layout w `src/layouts/Layout.astro`; wszystkie 5 podstron ogłoszeń istnieje (`src/pages/dashboard/listings/[id]/{edit,pricing,contacts,documents,close}.astro`); `src/pages/index.astro` renderuje placeholder Welcome
- **Backend / API:** present — 20+ tras API w `src/pages/api/`; auth, listings, contacts, documents, photos, files; ad-hoc linki nawigacyjne potwierdzone w `edit.astro:45-50`; brak trasy `format-address`
- **Data:** present — klient Supabase w `src/lib/supabase.ts`; migracje w `supabase/migrations/`; typy TypeScript w `src/types/`
- **Auth:** present — Supabase via `@supabase/ssr`; middleware w `src/middleware.ts:18-22`; strony logowania/rejestracji w `src/pages/auth/`
- **Deploy / infra:** present — GitHub Actions CI (`ci` → `deploy` → `migrate`); Cloudflare Workers via `wrangler.jsonc`; env schema w `astro.config.mjs:28-34` (brak `OPENROUTER_API_KEY`)
- **Observability:** partial — Sentry (error tracking) w `sentry.server.config.ts` i `sentry.client.config.ts`; brak logowania żądań; brak metryk

## Foundations

### F-01: Konwencje kodowania EstateDesk w CLAUDE.md

- **Outcome:** (foundation) Blok `## EstateDesk Coding Conventions` dodany do `CLAUDE.md`; dokumentuje: wzorzec React island (`client:load` vs `client:only`), kształt trasy API, wywołanie zewnętrznego LLM przez trasę serwerową (nigdy bezpośrednio z komponentu klienckiego), różnice Tailwind CSS v4 — gotowy do użycia przez agenta przy implementacji S-01, S-02 i S-03.
- **Change ID:** claude-md-conventions
- **PRD refs:** §Non-Functional Requirements (tab nav na ekranach mobilnych, brak regresji na zapisach formularzy)
- **Unlocks:** S-01 (wzorzec Tailwind v4 i React island dla tab bara), S-02 (wzorzec LLM-via-API-route i React island dla pola adresu), S-03 (wzorzec Tailwind v4 dla strony głównej)
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Bez udokumentowanych wzorców agent może wygenerować kod v3-era Tailwind lub wywołać OpenRouter bezpośrednio z kodu klienckiego — oba błędy wykraczają poza cel niskiej złożoności i drugi może ujawnić klucz API w przeglądarce.
- **Status:** done

## Slices

### S-01: Nawigacja zakładkowa

- **Outcome:** Agent może przechodzić między wszystkimi 5 podstronami ogłoszenia (Edit, Pricing, Contacts, Documents, Close) przez poziomy pasek zakładek nad treścią sekcji; aktywna zakładka jest wizualnie wyróżniona; na każdej podstronie obecny jest spójny link „Powrót" kierujący do dashboardu.
- **Change ID:** listing-tab-navigation
- **PRD refs:** US-01, FR-001, FR-002
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Pięć podstron modyfikowanych jednocześnie; regresja na istniejących ad-hoc linkach inline jest możliwa, jeśli stare linki nie zostaną w pełni usunięte. Weryfikacja: test E2E przechodzący przez wszystkie 5 zakładek i link Powrót.
- **Status:** done

### S-02: Formatowanie adresu przez LLM

- **Outcome:** Agent może wpisać niepełny adres (np. „Sarmacka 5/6 Warszawa") w pole adresu na formularzu edycji lub nowego ogłoszenia, nacisnąć Enter i zobaczyć kanoniczny polski format (ul. prefix, kod pocztowy NN-NNN, dzielnica w nawiasie) zamiast surowego tekstu; przy awarii wywołania OpenRouter pole zachowuje surowy tekst i wyświetla błąd inline z możliwością ponowienia bez odświeżania strony.
- **Change ID:** address-formatting-llm
- **PRD refs:** US-02, FR-003, FR-004
- **Prerequisites:** F-01, S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - `OPENROUTER_API_KEY` musi być dodany do env schema w `astro.config.mjs` i udostępniony w środowisku Cloudflare Workers (GitHub Secrets + Wrangler env). — Owner: użytkownik. Block: no.
- **Risk:** `edit.astro` jest modyfikowany też przez S-01 (pasek zakładek); implementacja po S-01 daje czystszą bazę. Czas odpowiedzi LLM podlega NFR ≤3 s — trzeba obsłużyć timeout i stan ładowania.
- **Status:** done

### S-03: Strona główna EstateDesk

- **Outcome:** Agent i odwiedzający widzą polskojęzyczną stronę główną z brandingiem EstateDesk w miejscu placeholdera Astro Starter; strona zawiera działające linki Zaloguj się / Zarejestruj się.
- **Change ID:** home-page-redesign
- **PRD refs:** FR-005
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Wizualny design strony głównej (układ, treść, komponenty, identyfikacja wizualna EstateDesk) nie jest zdefiniowany. — Owner: użytkownik. Block: yes.
- **Risk:** Implementacja bez ustalonego designu oznacza konieczność przeróbki. Po ustaleniu designu zmiana jest technicznie prosta — nie warto zaczynać bez jasnej specyfikacji.
- **Status:** blocked

## Backlog Handoff

| Roadmap ID | Change ID              | Suggested issue title                                  | Ready for `/10x-plan` | Notes                                                  |
|------------|------------------------|--------------------------------------------------------|-----------------------|--------------------------------------------------------|
| F-01       | claude-md-conventions  | Add EstateDesk coding conventions to CLAUDE.md         | yes                   | Run `/10x-plan claude-md-conventions`                   |
| S-01       | listing-tab-navigation | Add tab navigation bar to all listing sub-pages        | done                  | Completed                                               |
| S-02       | address-formatting-llm | Add LLM-powered Polish address formatting to edit form | no                    | Requires F-01 + S-01; add OPENROUTER_API_KEY to env    |
| S-03       | home-page-redesign     | Replace Astro placeholder with EstateDesk home page    | no                    | Blocked: visual design decision pending (Open Q 1)      |

## Open Roadmap Questions

1. **Jaki jest finalny wizualny design strony głównej?** (układ, treść po polsku, identyfikacja wizualna EstateDesk) — Owner: użytkownik. Block: S-03.

## Parked

- **Walidacja adresu** — Why parked: PRD §Non-Goals — wyjście LLM akceptowane bez weryfikacji z polską bazą kodów pocztowych.
- **Formatowanie adresu offline** — Why parked: PRD §Non-Goals — formatowanie wymaga połączenia z OpenRouter; brak obsługi trybu offline.
- **Zakładki nawigacyjne na formularzu nowego ogłoszenia** — Why parked: PRD §Non-Goals — `/listings/new` to formularz jednoetapowy, nie cel nawigacji zakładkowej.
- **Analityka i testy A/B strony głównej** — Why parked: PRD §Non-Goals — strona główna jest czysto prezentacyjna; brak narzędzi śledzenia.

## Done

- **S-01** (`listing-tab-navigation`) — Tab navigation bar added to all 5 listing sub-pages; Back link standardized to dashboard. Done 2026-06-06.
- **F-01: (foundation) konwencje kodowania EstateDesk dodane do CLAUDE.md** — Archived 2026-06-06 → `context/archive/2026-06-05-claude-md-conventions/`. Lesson: —.
- **S-02: sformatować adres do formy kanonicznej jednym klawiszem; widzieć błąd inline przy awarii LLM** — Archived 2026-06-06 → `context/archive/2026-06-06-address-formatting-llm/`. Lesson: —.
