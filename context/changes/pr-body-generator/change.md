---
change_id: pr-body-generator
title: PR body generator skill
status: implementing
created: 2026-06-15
updated: 2026-06-15
archived_at: null
---

## Notes

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
