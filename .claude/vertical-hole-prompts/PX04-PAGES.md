/vh-release-manager W aktualnym repo Vertical Hole wykonaj WYŁĄCZNIE naprawę VH-04 — bezpieczny workflow GitHub Pages. Zmiana definicji CI jest dozwolona, ale BEZ push, uruchamiania deploymentu ani publikacji.

# PX04 — Zabezpieczenie publikacji GitHub Pages (VH-04, P0 release)
**Skille pomocnicze:** `vh-game-engineer`, `vh-qa-automation`, `vh-test-console`.

1. Sprawdź P00, `.github/workflows/`, istniejące buildy i `.claude/vertical-hole/{RELEASE_DEBUG_GUARD,QUALITY_GATES,CHANGE_SAFETY,EVIDENCE_FRESHNESS}.md`, stan repo oraz sposób zbudowania oddzielnego RELEASE z PX03. **Nie zakładaj nazwy workflow:** znajdź odpowiedzialny za Pages. Potwierdź czy `on.push.branches` zawiera `claude/**`, czy artefakt ma `path: "."` i jakie dokładnie pliki byłyby publikowane.
2. Najmniejszy bezpieczny patch YAML: źródłem produkcji ma być tylko jawnie zatwierdzona gałąź/tag/workflow z kontrolą recenzji, a artefaktem **wydzielony katalog RELEASE** z niezbędnymi assetami, bez repo, `.claude`, źródeł DEV, testów, prywatnych plików, sourcemap debug. Zadbaj o uprawnienia workflow i możliwość weryfikacji/procedurę manualnej akceptacji; upewnij się, że katalog wynika z REALNEGO builda i nic nie znika z działania gry. Nie zakładaj istnienia konkretnego katalogu `dist` bez sprawdzenia.
3. Sprawdź skryptem `python .claude/vertical-hole/tools/check_pages_workflow.py --repo .` oraz testem/suchą walidacją workflow (jeśli dostępne). Spisz manifest plików i hashe RELEASE; uruchom `verify_release_artifact.py` na DEV/RELEASE. Sprawdź, że brak automatycznej publikacji z gałęzi roboczych i `path: "."`.
4. Gdy ochronę środowiska/protected branches trzeba skonfigurować przez GitHub Settings, nie zgaduj: raportuj „wymagana ręczna konfiguracja”; do czasu potwierdzenia `GO_RELEASE=STOP`. Brak możliwego sprawdzenia samej strony także nie jest PASS.

**Kryterium zamknięcia:** bezpieczna, kontrolowana definicja publikacji + manifest czystego RELEASE + dowody testów. **Nie wykonuj `git push`, nie uruchamiaj workflow, nie publikuj gry, nie modyfikuj Settings bez zgody właścicielki.** Osobny test prawdziwego hosta to PX05.

**Raport końcowy (obowiązkowy):** podaj dla każdego testu `PASS/FAIL/NOT RUN` z dowodem lub brakiem dowodu, zaktualizowane pliki, polecenia, ewentualny rollback oraz stan odpowiedniej bramki. Jeśli coś nadal jest `FAIL` albo `NOT RUN`, nie deklaruj ukończenia. **Nie publikuj ani nie pushuj bez zgody właścicielki.**

**Krytyczny test kontrolera przed i po zmianie (v1.4.2):**
Poprzedni checker błędnie przepuszczał workflow z `path: ./`, `${{ github.workspace }}` i `feature/**`. Uruchom obecny `check_pages_workflow.py` także na negatywnych syntetycznych fixture'ach tych wariantów oraz `pull_request`, bez ograniczenia branches i `dist/dev`. Każdy ma zwrócić FAIL; poprawna ręcznie zatwierdzona konfiguracja z kuratorowanym katalogiem RELEASE ma przejść. Sprawdź WSZYSTKIE aktywne workflows i efektywne źródło Pages, wymagane reviews środowiska i ochronę `main` w GitHub Settings; jeśli brak dowodu ustawień: `GO_RELEASE=STOP` nawet przy PASS YAML. Nie wymuszaj publikacji, żeby przetestować checker.
