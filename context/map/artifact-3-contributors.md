# Artifact 3 — Kontrybutorzy, wiedza i unknowns

_Wygenerowano: 2026-06-09 | Źródło: `git log --all` (193 commity)_

---

## Kontrybutorzy per obszar

| Obszar | Maciej Kulesza | cieyhomelab | Claude (AI co-author) |
|--------|---------------|-------------|----------------------|
| **Auth / middleware** | Główny — signup, signin, 3-user limit, RLS trigger | `fix: restructure auth check` (ESLint async bug) | ~95 commitów Sonnet, 11 Opus |
| **DB / migracje** | Wyłączny — wszystkie 9 migracji | — | — |
| **Pricing / komisja** | Wyłączny — `commission.ts`, schemat, formatPLN | `Fix commission update logic` + `Fix access to commissionSettings` (przy mergu) | — |
| **Dashboard / filtrowanie** | Implementacja (plan + fazy 1-3) | Merge PR #26 do main | — |
| **Testing (IDOR, gate, e2e)** | Wyłączny autor wszystkich plików testowych | Poprawki selektorów w `auth-boundary`, `close-reopen-lifecycle` | — |
| **CI / deploy** | Usunął duplikat, dodał Supabase migration step, audit gate | **Stworzył** pierwotny `deploy.yaml` | — |
| **UI (homepage, logo, glassmorphism)** | Implementacja lokalna | Merge PR #21, #23, #24, #25 | — |
| **LLM / address formatting** | Implementacja route + env schema | Merge PR #20 | — |

---

## PR-y z ukrytą wiedzą (edge case, auth, dane)

| PR / commit | Obszar | Dlaczego ważny |
|-------------|--------|----------------|
| `testing-gate-logic-auth-idor` (4 commity) | Auth + IDOR | Jedyna dokumentacja które trasy wymagają auth i testy cross-user ownership |
| `2f75d79` fix(auth): drop user-limit trigger | Auth edge | Zmiana arch. decyzji — trigger DB odrzucony na rzecz enforcement w API |
| `fix(pricing-and-commission): review fixes` `2a3766f` | Pricing edge | Poprawka kolejności auth vs biznes; surowy error wyciekał do klienta |
| `1eff78ad` Fix commission update logic | Pricing edge | cieyhomelab naprawił błąd logiczny przy merge — brak opisu co konkretnie |
| `9fc8d61` fix(ci): supabase link then db push | Infra edge | CLI Supabase nie obsługuje `--project-ref` — nieoczywisty błąd środowiska |
| `6ee4fe3` use client:only to avoid SSR crash | Hydration edge | SSR crash ukryty za normalnym Astro flow — wymaga `client:only` |

---

## Gdzie istnieje ukryta wiedza

### 1. cieyhomelab — commity bez kontekstu
- `Update set.ts` (`465a157`) — brak opisu, zmiana w krytycznym pliku komisji
- `Fix access to commissionSettings properties` (`304cdc6`) — naprawił coś przy mergu, nie wiadomo co się posypało

### 2. Claude jako faktyczny autor logiki
95 commitów co-authored by Claude Sonnet 4.6, 11 by Claude Opus 4.8 (1M). Logika biznesowa (komisje, testy IDOR, RLS) pochodzi de facto od AI — brak "ludzkiego" autora który rozumie ją niezależnie od kontekstu sesji.

### 3. Monopol Macieja na migracje DB
Nikt inny nigdy nie dotykał `supabase/migrations/`. Wiedza o schemacie (RLS policies, triggery, kolejność migracji) jest tylko w plikach `.sql` — brak przeglądu drugiej osoby.

### 4. Historia decyzji 3-user limit
Trigger dodany → usunięty (`drop_user_limit_trigger.sql`) → przeniesiony do API. Wiedza o tym dlaczego DB-level enforcement nie działał istnieje tylko w sekwencji 3 commitów, nie w żadnym dokumencie.

### 5. Brakująca migracja bez PR
`20260605000001_registration_open_rpc.sql` — jest w repozytorium, ale brak powiązanego PR ani commitu opisującego zamiar.

---

## Unknowns

| Unknown | Ryzyko |
|---------|--------|
| `cieyhomelab` — brak nazwiska, tylko `ciey.air.music@gmail.com` | Niejasna rola (współpracownik / zewnętrzny review / drugie konto?) |
| Deploy pipeline — stworzony przez cieyhomelab, przerabiany przez Macieja | Brak smoke testu i procedury rollbacku |
| Logika komisji w `set.ts` po poprawkach cieyhomelab | Wymaga weryfikacji czy poprawki przy mergu nie wprowadzają regresji |

---

## Pliki o najwyższym ryzyku utraty wiedzy

```
supabase/migrations/          — tylko Maciej, brak review
src/pages/api/listings/[id]/commission/set.ts  — edytowane przez obie osoby bez opisu
src/middleware.ts             — 2 autorów, kluczowy dla auth boundary
.github/workflows/deploy.yaml — historia rozdzielona między 2 autorów
```
