# Mom Test Validation Plan

## Input Idea

`pr-body-generator` — lokalny skrypt czytający `context/changes/<change-id>/change.md` + `plan.md` + `git log` i generujący gotowy opis PR na stdout. Kandydat wyłoniony z mapy okazji (`docs/design/opportunity-map.md`).

## Hypotheses

- **User/role**: Solowy developer z AI workflow opartym na formacie 10xWorkflow (`context/changes/<id>/`).
- **Friction**: Każdy PR wymaga ręcznego przepisania kontekstu, który już istnieje w `plan.md` — cel, slices, ryzyka, test plan.
- **Current workaround**: Ręczne kopiowanie lub skracanie `plan.md` do opisu PR przy `gh pr create`. Czasem GitHub Copilot PR Summaries jako punkt startowy.
- **Risky assumptions**:
  1. Że przepisywanie jest naprawdę bolesne — a nie trwa 2 minuty i nie wymaga myślenia.
  2. Że `plan.md` w momencie tworzenia PR wciąż odzwierciedla rzeczywistość zmiany.
  3. Że wygenerowany opis byłby używalny bez istotnych poprawek.
  4. Że operacja pojawia się wystarczająco często, żeby amortyzować koszt budowania skryptu.
  5. Że problem nie zniknie sam gdy workflow dojrzeje lub zmieni się konwencja.
- **Evidence already present**: 24 zarchiwizowane zmiany (fakty z plików) — ilościowe potwierdzenie częstotliwości. Brak pomiarów czasu, brak zewnętrznych danych.

## Critique

- **Rozwiązanie vs. problem**: Opisano rozwiązanie (`skrypt generujący opis`) zanim zmierzono realny koszt. "Ręczne przepisywanie" może oznaczać 90 sekund lub 20 minut — to zmienia decyzję.
- **Jakość outputu nieznana**: Założenie, że wygenerowany opis byłby używalny bez poprawek, można sprawdzić tylko empirycznie. Jeśli `plan.md` jest pisany *przed* implementacją i kod odchodzi od planu, opis PR będzie opisywał intencję, nie rzeczywistość.
- **Co dowodziłoby braku wartości**: Że przepisywanie zajmuje <3 minuty i nie wymaga wysiłku intelektualnego. Że `plan.md` regularnie rozchodzi się z kodem. Że opis PR tworzony jest po zakończeniu implementacji, kiedy `plan.md` jest przestarzały.
- **Istniejące alternatywy**: `.github/pull_request_template.md` (struktura) + GitHub Copilot PR Summaries (treść z diffu) mogą pokryć 80% wartości bez żadnego dodatkowego narzędzia.
- **Najszybszy dowód**: Ręczna próba — weź ostatnie 3 `plan.md` i wygeneruj z nich opisy PR manualnie w edytorze. Zmierz czas. Oceń jakość. 30 minut, zero kodu.

## Interview Guide

*(Solo workflow: rozmowa z samym sobą oparta na faktach z archiwum 24 zmian)*

**Rozgrzewka**
1. Jak wygląda typowy cykl zmiany — od `10x-new` do zamkniętego PR-a? Który krok zajmuje najwięcej czasu?
2. Jak często tworzysz PR-y — raz dziennie, kilka razy w tygodniu, raz na kilka dni?

**Ostatnia historia**
3. Weź ostatni PR. Co dokładnie zrobiłeś z opisem? (Napisałeś od zera? Skopiowałeś z pliku? Użyłeś Copilot? Wpisałeś minimum?)
4. Ile czasu zajął sam opis — od `gh pr create` do wysłania PR-a?

**Obecne obejście**
5. Otwórz `context/changes/<ostatnia-zmiana>/plan.md` i porównaj z opisem PR na GitHubie. Jak bardzo różnią się? Co jest w opisie, czego nie ma w `plan.md`? Co jest w `plan.md`, czego nie ma w opisie?
6. Czy `plan.md` jest pisany przed, w trakcie, czy po implementacji? Czy aktualizujesz go w trakcie?

**Koszt tarcia**
7. Czy żałowałeś kiedyś, że opis PR był za krótki — na przykład przeglądając historię lub wracając do kontekstu? Co wtedy zrobiłeś?
8. Co by się stało, gdybyś przez miesiąc każdy PR opisywał tylko tytułem i listą commitów?

**Istniejące alternatywy**
9. Czy próbowałeś GitHub PR template (`.github/pull_request_template.md`)? Co działało, co nie?
10. Czy Copilot PR Summaries kiedykolwiek dał ci opis, którego użyłeś bez poprawek?

**Sygnał decyzyjny**
11. Co musiałoby być prawdą, żebyś z chęcią użył skryptu zamiast pisać opis ręcznie? Co sprawiłoby, że go odrzucisz?

**Zamknięcie**
12. Przejrzyj 3 ostatnie opisy PR-ów i odpowiednie `plan.md`. Oszacuj: jaki procent treści opisu PR mógłbyś wygenerować bezpośrednio z `plan.md` bez ręcznej edycji?

## Survey

*(Wypełnij na podstawie archiwum 24 zmian — fakty, nie preferencje)*

**Q1 (screener):** Czy regularnie tworzysz PR-y dla zmian zainicjowanych przez `/10x-new`?
- [ ] Tak, niemal każda zmiana kończy się PR-em
- [ ] Tak, ale nie zawsze
- [ ] Nie

**Q2:** Jak opisujesz PR-y dziś?
- [ ] Piszę od zera
- [ ] Kopiuję z `plan.md` i adaptuję
- [ ] Używam Copilot PR Summaries jako punktu startowego
- [ ] Wpisuję minimum (tytuł, kilka zdań)
- [ ] Inne: ___

**Q3:** Ile czasu zajmuje opis PR-a?
- [ ] < 2 minut
- [ ] 2–5 minut
- [ ] 5–15 minut
- [ ] > 15 minut

**Q4:** Jak bardzo `plan.md` jest aktualny w momencie tworzenia PR?
- [ ] Prawie zawsze aktualny
- [ ] Zazwyczaj aktualny, kilka detalii się zmienia
- [ ] Często odbiega — plan to punkt startowy
- [ ] Rzadko aktualny

**Q5:** Ile procent treści opisu PR pochodzi z `plan.md`?
- [ ] > 80%
- [ ] 50–80%
- [ ] 20–50%
- [ ] < 20%

**Q6:** Czy wracasz do opisów starych PR-ów po kontekstem?
- [ ] Tak, regularnie
- [ ] Tak, sporadycznie
- [ ] Prawie nigdy

**Q7 (otwarte):** Opisz ostatni PR, przy którym opis zajął ci więcej czasu niż zwykle. Co sprawiło, że to trwało dłużej?

**Q8 (otwarte):** Co najbardziej irytuje cię w obecnym procesie tworzenia opisów PR — jeśli cokolwiek?

## Decision Criteria

- **Proceed**: Przepisywanie zajmuje regularnie >5 minut LUB wymaga wysiłku intelektualnego (nie kopiowania). `plan.md` aktualny w ≥70% przypadków. Ręczna próba: opis z `plan.md` wymaga <2 minut edycji. Wracasz do opisów PR-ów regularnie jako do dokumentacji.
- **Narrow scope**: Opis zajmuje 2–5 minut, ale `plan.md` regularnie odbiega od kodu — skrypt ma sens tylko dla "Summary" i "Risks", nie dla "Changes". Lub: wartość leży w strukturze, nie treści → rozwiązanie to `.github/pull_request_template.md`.
- **Do not build yet**: Przepisywanie zajmuje <3 minut i nie wymaga myślenia. `plan.md` odbiega od kodu w >50% przypadków. Opis PR tworzony głównie dla formalizmu, nie jako dokumentacja.
- **Try existing tool/process first**: Copilot PR Summaries + `.github/pull_request_template.md` pokrywają 80% wartości. Problem to brak struktury, nie brak zawartości.
