# Territory Map — Artifact 1: Git Activity Analysis

> Generated: 2026-06-09  
> Scope: last 12 months (166 commits); monthly drill-down: last 4 weeks

---

## Top 10 — najczęściej modyfikowane foldery (12 mies.)

| # | Ścieżka | Zmiany |
|---|---------|--------|
| 1 | `src/pages/dashboard/listings` | 41 |
| 2 | `src/pages/api/listings` | 32 |
| 3 | `src/components/listings` | 15 |
| 4 | `src/integration/helpers` | 10 |
| 5 | `src/types` | 10 |
| 6 | `src/pages/api/auth` | 8 |
| 7 | `src/integration/api` | 8 |
| 8 | `src/components/dashboard` | 4 |
| 9 | `src/pages/dashboard/settings` | 3 |
| 10 | `e2e/` | 20 (7 plików) |

---

## Top 10 — najczęściej modyfikowane pliki (12 mies.)

| # | Plik | Zmiany |
|---|------|--------|
| 1 | `src/pages/dashboard/listings/[id]/pricing.astro` | 10 |
| 2 | `src/pages/dashboard/listings/[id]/contacts.astro` | 10 |
| 3 | `src/pages/dashboard/listings/[id]/edit.astro` | 9 |
| 4 | `src/components/listings/ListingCard.astro` | 9 |
| 5 | `src/pages/dashboard.astro` | 8 |
| 6 | `src/pages/dashboard/listings/[id]/close.astro` | 5 |
| 7 | `src/pages/api/listings/[id]/commission/set.ts` | 5 |
| 8 | `src/types/listings.ts` | 5 |
| 9 | `src/pages/dashboard/listings/[id]/documents.astro` | 4 |
| 10 | `src/components/listings/ListingTabs.astro` | 4 |

---

## Nacisk pracy tygodniami — ostatni miesiąc

| Tydzień | Daty | Commity | Dominujący obszar | Charakter |
|---------|------|---------|-------------------|-----------|
| W21 | 22–24.05 | 2 | `src/components/auth`, `src/pages/auth` | Bootstrapping auth od zera |
| W22 | 25–31.05 | 60 | `src/pages/api/listings` (31), `src/pages/dashboard/listings` (24) | Peak funkcjonalny — pełny CRUD listings, kontakty, ceny, prowizje |
| W23 | 01–07.06 | 94 | `src/pages/dashboard/listings` (16), `src/integration` (18+), `e2e/` | Gear shift: testy + UI polish równolegle |
| W24 | 08–09.06 | 10 | `src/components/dashboard` (4) | Skupiony feature: live client-side filtering |

**Wzorzec cyklu:** buduj feature → polishuj UI → pokryj testami → kolejny feature.

---

## Pliki-huby — współzmiany cross-area (12 mies.)

Metryka: liczba odrębnych obszarów kodu, z którymi plik współwystępował w tym samym commicie.

| # | Plik | Obszarów cross-area | Uwaga |
|---|------|---------------------|-------|
| 1 | `src/types/listings.ts` | **11** | Główny hub — dotyka API, komponentów, stron, typów pokrewnych i migracji Supabase jednocześnie |
| 2 | `src/pages/dashboard/listings/[id]/pricing.astro` | 11 | Tandem z `edit.astro` |
| 3 | `src/pages/dashboard/listings/[id]/edit.astro` | 9 | Tandem z `pricing.astro` |
| 4 | `src/pages/dashboard.astro` | 9 | Integration point: API + komponenty + typy + e2e |
| 5 | `src/pages/api/auth/signup.ts` | 8 | |
| 6 | `src/components/listings/ListingCard.astro` | 8 | |
| 7 | `src/pages/dashboard/settings/commission.astro` | 7 | |
| 8 | `src/pages/dashboard/listings/[id]/close.astro` | 7 | |
| 9 | `src/middleware.ts` | 6 | Cichy kandydat do obserwacji — dotykany przez niezwiązane feature'y |
| 10 | `src/components/AuthForm.tsx` | 6 | |

### Sygnały do obserwacji

- **`src/types/listings.ts`** — każda zmiana domain modelu rippluje przez cały stack. Gdy zmiany zaczną dominować, rozważyć osobny contract layer.
- **`pricing.astro` + `edit.astro` jako tandem** — de facto jedna funkcjonalność rozbita na dwie strony.
- **`middleware.ts`** — dotykany przez wiele niezwiązanych feature'ów; warto śledzić.

### Weryfikacja istnienia

Wszystkie pliki ze zbioru hubów zweryfikowane na dzień 2026-06-09: **wszystkie obecne w repo**.
