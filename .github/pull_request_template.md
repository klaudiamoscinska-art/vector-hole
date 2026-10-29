## Podsumowanie

<!-- Co się zmieniło i dlaczego (2-3 zdania / punkty). Baza: origin/main <SHA>. -->

## Plan testów

<!-- Brak buildu. Boty QA: `node qa/run-all.mjs` (patrz qa/README.md), -->
<!-- plus ręcznie: `python3 -m http.server` + przeglądarka. -->
<!-- Wyniki jako PASS / FAIL / NOT RUN, porównane z bazą na tej samej maszynie; -->
<!-- test, który niczego nie wykonał = NOT RUN. Pełne logi w plikach. -->

- [ ] `node qa/run-all.mjs` na bazie i kandydacie — wynik (N/M), różnice, nowe FAIL-e
- [ ] Sprawdzone ręcznie w przeglądarce (opisz co dokładnie było klikane/testowane) — albo NOT RUN
- [ ] Jeśli zmiana dotyczy Areny: rundy Areny/Daily Challenge nadal działają bez regresji
- [ ] Jeśli zmiana dotyczy Kampanii: dotknięta(e) misja(e) nadal da się ukończyć od startu do końca
- [ ] Zapis: `SAVE_SCHEMA_VERSION` nadal 13, nowe pole tylko przez `defaultSave()`; `node qa/save-safety.mjs`, `node qa/px02-isolation.mjs` (zmiana schematu wyłącznie za decyzją właścicielki — `.claude/vertical-hole/SAVE_MIGRATION_CONTRACT.md`)
- [ ] Tylko dokumentacja: brak zmian w `game.js` / `style.css` / `index.html` / `qa/` / `.github/scripts/` / workflow; `node qa/instructions.mjs`

## Odbiór i merge

- [ ] Niezależny odbiór GPT
- [ ] Wyraźna zgoda właścicielki na merge (domyślnie scala właścicielka; Claude tylko przy jawnej autoryzacji tego PR w prompcie — `docs/claude/DEPLOYMENT.md` „Stage flow”)
- [ ] Po merge: deploy zielony i produkcja sprawdzona (jeśli PR zmienia ścieżki wdrożenia) — albo „bez deploymentu”

## Uwagi

<!-- Świadome uproszczenia, znane ograniczenia, rzeczy odłożone na później. -->
<!-- Zmiana zasad gry lub balansu → zaktualizuj docs/GAME_DESIGN.md -->
<!-- i dopisz wpis w docs/CHANGELOG.md. HANDOFF: docs/claude/HANDOFF_TEMPLATE.md. -->
