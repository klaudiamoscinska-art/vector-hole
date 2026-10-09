## Podsumowanie

<!-- Co się zmieniło i dlaczego (2-3 zdania / punkty). -->

## Plan testów

<!-- Brak buildu. Boty QA: `node qa/run-all.mjs` (patrz qa/README.md), -->
<!-- plus ręcznie: `python3 -m http.server` + przeglądarka. -->

- [ ] `node qa/run-all.mjs` — wynik (ile testów przeszło)
- [ ] Sprawdzone ręcznie w przeglądarce (opisz co dokładnie było klikane/testowane)
- [ ] Jeśli zmiana dotyczy Areny: rundy Areny/Daily Challenge nadal działają bez regresji
- [ ] Jeśli zmiana dotyczy Kampanii: dotknięta(e) misja(e) nadal da się ukończyć od startu do końca
- [ ] Jeśli zmieniono `save`/schemat zapisu: `SAVE_SCHEMA_VERSION` podbity + dodana gałąź w `migrateSave()`, stary zapis nadal się wczytuje

## Uwagi

<!-- Świadome uproszczenia, znane ograniczenia, rzeczy odłożone na później. -->
<!-- Zmiana zasad gry lub balansu → zaktualizuj docs/GAME_DESIGN.md -->
<!-- i dopisz wpis w docs/CHANGELOG.md. -->
