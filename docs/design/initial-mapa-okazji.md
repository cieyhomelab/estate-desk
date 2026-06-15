---
title: "M5L1 — Mapa okazji: sygnały tarcia w projekcie EstateDesk"
created: 2026-06-15
lesson: "AI Internal Builders: wewnętrzne narzędzia, serwisy i automatyzacje"
---

## Krok 1: Sygnały tarcia

Poniższe sygnały wynikają z obserwacji realnego cyklu pracy z projektem EstateDesk (developer + agent AI).

### Sygnał A — Codzienne sprawdzanie stanu projektu wymaga otwarcia trzech narzędzi

GitHub Actions (CI status), Sentry (błędy produkcyjne) i Supabase Studio (status migracji) to trzy oddzielne miejsca. Żadne z nich nie wie o pozostałych. Żeby wiedzieć, czy system "działa", trzeba ręcznie skleić odpowiedź.

### Sygnał B — Opis PR-a tworzony ręcznie, mimo że kontekst jest już w `context/changes/`

Każda zmiana zaczyna się od pliku `context/changes/<id>/change.md` i `plan.md` z pełnym opisem celu, slices, zależności i ryzyk. Gdy przychodzi czas na PR, te informacje są przepisywane (lub skracane) ręcznie do opisu na GitHubie. 24 zarchiwizowane zmiany = 24 PR-y wymagające ręcznego przepisywania kontekstu.

### Sygnał C — Migracje Supabase bez powiązania z `context/changes/`

Katalog `supabase/migrations/` ma 11 plików SQL z timestampami. Nie ma jednak jasnego linku wskazującego, który plik migracji powstał jako część której zmiany w `context/changes/`. Gdy migracja wywołuje problem, diagnoza wymaga ręcznego porównywania dat i nazw.

### Sygnał D — Trzy poziomy testów uruchamiane oddzielnie, wyniki w trzech miejscach

Unit (Vitest), integration (Vitest + Supabase) i E2E (Playwright) to trzy oddzielne komendy i trzy osobne raporty. Brak widoku "co aktualnie przechodzi, a co nie" bez uruchomienia wszystkich trzech i ręcznego porównania.

### Sygnał E — CLAUDE.md i AGENTS.md mogą się rozchodzić w trakcie życia projektu

`health-check.md` udokumentował dwa nieaktualne zdania w `AGENTS.md`. Żadne narzędzie nie weryfikuje spójności między `CLAUDE.md` a `AGENTS.md` — desynchro jest wykrywana dopiero gdy agent AI zachowa się niepoprawnie.

---

## Krok 2: Mapa okazji

### Sygnał A — Poranny status projektu

| Pole                      | Odpowiedź |
| ------------------------- | --------- |
| Sygnał tarcia             | Żeby wiedzieć co się dzieje trzeba otworzyć GitHub CI, Sentry i Supabase Studio osobno. Brak jednego widoku "czy projekt działa". |
| SaaS / domyślna odpowiedź | GitHub Actions ma dashboard CI; Sentry ma własne alerty e-mail; Supabase ma status migrations w Studio. Każdy z nich rozwiązuje swój kawałek. |
| Cienki helper             | Skrypt czytający GitHub API (ostatni run CI), Sentry API (błędy z ostatnich 24h) i listę pliku migracji vs git log — generujący jeden plik Markdown z wynikiem. |
| Pierwsza użyteczna wersja | Statyczny raport Markdown generowany ręcznie komendą `node scripts/morning-digest.js > reports/digest.md`; wynik wrzucany do wewnętrznego kanału lub otwierany lokalnie przed pracą. |

---

### Sygnał B — Opis PR-a z pliku `context/changes/plan.md`

| Pole                      | Odpowiedź |
| ------------------------- | --------- |
| Sygnał tarcia             | Każda zmiana ma gotowy opis w `context/changes/<id>/plan.md` (cel, slices, ryzyka), ale PR na GitHubie jest przepisywany ręcznie. |
| SaaS / domyślna odpowiedź | GitHub Copilot PR Summaries generuje opisy na podstawie diff-a, ale nie zna kontekstu z `context/changes/` (dlaczego, jakie ryzyka, jakie user stories). |
| Cienki helper             | Skrypt czytający `context/changes/<id>/change.md` + `plan.md` i generujący gotowy szablon opisu PR do skopiowania lub wysłania via `gh pr create`. |
| Pierwsza użyteczna wersja | Lokalna komenda `node scripts/pr-body.js <change-id>` drukująca gotowy opis PR na stdout — bez deploymentu, bez bazy danych, bez interfejsu. |

---

### Sygnał C — Migracje Supabase bez kontekstu zmiany

| Pole                      | Odpowiedź |
| ------------------------- | --------- |
| Sygnał tarcia             | `supabase/migrations/*.sql` mają timestampy ale brak linku do `context/changes/`. Diagnoza problemu z migracją wymaga ręcznego dopasowywania dat. |
| SaaS / domyślna odpowiedź | Supabase Studio pokazuje listę migracji z datami. Brak integracji z lokalnym `context/`. |
| Cienki helper             | Skrypt porównujący daty plików w `supabase/migrations/` z datami w `context/changes/<id>/change.md` i generujący mapę: migracja → change-id. |
| Pierwsza użyteczna wersja | Plik `context/map/migration-index.md` generowany raz ręcznie, aktualizowany przy każdej nowej migracji jako część konwencji. |

---

### Sygnał D — Zbiorczy widok testów

| Pole                      | Odpowiedź |
| ------------------------- | --------- |
| Sygnał tarcia             | Unit, integration i E2E wymagają 3 oddzielnych komend. Wyniki są w 3 miejscach. Brak jednego "czy testy przechodzą" na lokalnej maszynie. |
| SaaS / domyślna odpowiedź | GitHub Actions CI uruchamia wszystkie trzy — wynik widoczny w jednym jobie. Na lokalnej maszynie brakuje tego widoku. |
| Cienki helper             | Skrypt npm `test:all` uruchamiający wszystkie trzy sekwencyjnie i sumujący wyniki w jednej linii. |
| Pierwsza użyteczna wersja | Jeden `package.json` script: `"test:all": "npm test && npm run test:integration && npm run test:e2e"` — 5 minut konfiguracji, zero deploymentu. |

---

### Sygnał E — Spójność CLAUDE.md ↔ AGENTS.md

| Pole                      | Odpowiedź |
| ------------------------- | --------- |
| Sygnał tarcia             | `AGENTS.md` miał dwa nieaktualne zdania przez kilka tygodni — odkryte dopiero w `health-check.md`. Żadne narzędzie nie alarmuje o desynchro. |
| SaaS / domyślna odpowiedź | Dokumentacja wewnętrzna, wiki, ręczna rewizja. Żaden SaaS nie waliduje spójności między dwoma plikami reguł AI. |
| Cienki helper             | Skrypt odczytujący oba pliki i sprawdzający spójność kluczowych sekcji (Testing Guidelines, deployment platform, key conventions) — flagujący sprzeczności jako diff. |
| Pierwsza użyteczna wersja | Prosty skrypt lub `lefthook` hook uruchamiany lokalnie przy edycji `CLAUDE.md` lub `AGENTS.md`, drukujący ostrzeżenie jeśli druga strona jest starsza o więcej niż X dni. |

---

## Krok 3: Wybrany helper

**Sygnał B** — opis PR-a generowany z `context/changes/plan.md`.

### Opis pierwszej wersji

```text
Helper:
pr-body-generator

Czyta:
context/changes/<change-id>/change.md (change_id, title, status, roadmap_id, prd_ref)
context/changes/<change-id>/plan.md (goal, slices, risks, preserved)
git log --oneline origin/main..HEAD (lista commitów w branczu)

Zwraca:
Gotowy tekst opisu PR w formacie Markdown:
— tytuł brany z change.md (title)
— sekcja "## Summary" z celem zmiany (jeden akapit z plan.md)
— sekcja "## Slices" z listą slices (z plan.md)
— sekcja "## Test plan" z checklistą (na podstawie sekcji testów w plan.md)
— sekcja "## Ryzyka" (ryzyka z plan.md)
— lista commitów (z git log)
Wynik drukowany na stdout do skopiowania lub piped do `gh pr create --body`.

Nie robi:
— Nie otwiera PR-a automatycznie (użytkownik robi `gh pr create` ręcznie)
— Nie łączy się z GitHub API
— Nie weryfikuje, czy branch jest gotowy do merge
— Nie obsługuje przypadku gdy `context/changes/<id>/` nie istnieje

Ryzyko danych:
Czyta wyłącznie lokalne pliki projektu (context/, git log) — dane niewrażliwe,
brak danych klienckich, brak dostępu do zewnętrznych systemów.
Pierwsza wersja to skrypt lokalny bez żadnego deploymentu.
```

### Dlaczego ten, nie inny

Sygnał B spełnia wszystkie trzy kryteria wyboru:

1. **Pojawia się regularnie** — 24 zarchiwizowane zmiany = 24 PR-y z ręcznym przepisywaniem; każda nowa feature to kolejny.
2. **Łączy dwa źródła** — lokalny `context/changes/` (format 10xWorkflow) + git log (historia commitów).
3. **Pierwsza wersja bez pełnego produktu** — skrypt Node.js lub shell, jedno wywołanie, wynik na stdout; sprawdzenie wartości zajmie <1 dzień.

Sygnał D (`test:all`) jest prawdopodobnie szybszy do wykonania (5 minut), ale nie wymaga helpera AI — to zmiana konfiguracji, nie narzędzie. Sygnał A (poranny digest) wymaga kluczy API do GitHub i Sentry i jest bardziej ryzykowny w pierwszej wersji. Sygnał B oferuje realną wartość przy zerowym ryzyku danych i żadnym deploymencie.
