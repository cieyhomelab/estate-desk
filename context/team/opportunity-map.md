# Opportunity Map

## Context

- **Project / context**: EstateDesk — solo developer + AI agent workflow
- **Data constraint**: Mock / lokalne / tylko do odczytu / niewrażliwe
- **Date**: 2026-06-15

## Map

| Sygnał | Istniejąca / domyślna odpowiedź | Cienki helper | Pierwsza użyteczna wersja | Ryzyko danych | Kierunek jeśli wartościowy |
|---|---|---|---|---|---|
| A — Poranny status (GitHub CI + Sentry + Supabase Studio osobno) | GitHub Actions dashboard, Sentry alerty, Supabase Studio — każde rozwiązuje swój kawałek | Digest łączący GitHub API, Sentry API i git log migracji | Mock → lokalny skrypt z eksportów JSON/CSV zanim podłączone do żywych API | Lokalne + klucze API (niewidoczny próg) | Internal tool → Team agent |
| **B — PR body generowany z `context/changes/plan.md`** | **GitHub Copilot PR Summaries zna diff, ale nie zna kontekstu z `context/` (dlaczego, ryzyka, slices)** | **Skrypt czytający `change.md` + `plan.md` + `git log` → gotowy szablon PR body na stdout** | **`node scripts/pr-body.js <change-id>` — lokalnie, brak deploymentu** | **Tylko lokalne pliki — dane niewrażliwe** | **Internal tool → Review / CI gate** |
| C — Migracje Supabase bez powiązania z `context/changes/` | Supabase Studio (daty migracji); brak integracji z lokalnym `context/` | Skrypt mapujący daty plików migracji do `context/changes/<id>` | Statyczny `context/map/migration-index.md` generowany ręcznie | Lokalne / niewrażliwe | Konwencja nazewnicza, nie helper |
| D — Zbiorczy widok testów (Unit + Integration + E2E osobno) | GitHub Actions CI uruchamia wszystkie trzy w jednym jobie; lokalnie brakuje | — (nie potrzebuje helpera) | Jeden `package.json` script `test:all` — zmiana konfiguracji, nie narzędzie | Brak | Zmiana konfiguracji |
| E — Spójność `CLAUDE.md` ↔ `AGENTS.md` | Dokumentacja wewnętrzna, ręczna rewizja | `lefthook` hook flagujący gdy jedna strona jest starsza o >X dni | Git hook przy edycji któregokolwiek pliku | Lokalne / niewrażliwe | Internal tool → CI gate / lint rule |

## Recommended First Candidate

```
Kandydat:
pr-body-generator

Czyta:
context/changes/<change-id>/change.md (change_id, title, status)
context/changes/<change-id>/plan.md (goal, slices, risks)
git log --oneline origin/main..HEAD (lista commitów w branchu)

Zwraca:
Gotowy tekst opisu PR w formacie Markdown:
— ## Summary: cel zmiany (jeden akapit z plan.md)
— ## Changes: lista slices (z plan.md)
— ## Test plan: checklista (z sekcji testów w plan.md)
— ## Risks: ryzyka (z plan.md)
— Lista commitów (z git log)
Wynik na stdout — do skopiowania lub piped do `gh pr create --body "$(...)"`

Nie robi:
— Nie otwiera PR-a automatycznie
— Nie łączy się z GitHub API
— Nie weryfikuje gotowości brancha do merge
— Nie obsługuje braku katalogu context/changes/<id>/

Ryzyko danych:
Lokalne pliki projektu — dane niewrażliwe. Brak kluczy API, brak deploymentu.
```

## Why This Candidate

Sygnał B spełnia wszystkie sześć kryteriów rankingowych: pojawia się przy każdym PR (24 zarchiwizowane zmiany = 24 instancje ręcznego przepisywania), łączy dwa źródła (`context/changes/` i `git log`), ma jasny manualny koszt dziś, da się przetestować lokalnie w <1 dzień bez deploymentu, nie zastępuje GitHuba (tylko dopełnia), i ma czytelny kierunek dojrzewania jeśli okaże się wartościowy.

Sygnał A (poranny digest) jest mocnym następnym kandydatem, ale wymaga kluczy API do GitHub i Sentry — wyższy próg na start. Sygnał D nie potrzebuje helpera, tylko zmiany konfiguracji. Sygnał C może być lepiej rozwiązany konwencją nazewniczą niż osobnym narzędziem.

## Next Direction If Valuable

**Internal tool → Review / CI gate**

Jeśli skrypt lokalny faktycznie redukuje tarcie przy każdym PR, naturalny kolejny krok to GitHub Action generujący draft PR body automatycznie (lub pre-push hook). Na tym etapie warto rozważyć, czy nie użyć LLM do wypełnienia sekcji Summary na podstawie `plan.md` zamiast kopiowania verbatim.

## Chosen Next Step

**Walidacja → /10x-mom-test → /10x-shape**

Najtańszy krok przed kodem: rozmowa z pytaniami opartymi na faktach z przeszłości (nie opiniach o pomyśle). `/10x-mom-test` przygotuje pytania i ankietę. Jeśli kandydat przetrwa, wynik karmi `/10x-shape` → `/10x-prd`.
