# Standard pracy — od zadania do zweryfikowanego kodu

## Protokół każdej sesji
1. `Inspect`: przeczytaj `PROJECT_CHARTER.md`, stan git, strukturę repo, skrypty npm/runner i znane TODO. Zapisz hipotezy i ryzyko. Nie zakładaj, że opis w tym pakiecie odzwierciedla aktualny kod.
2. `Baseline`: odtwórz problem/metrykę; ustal minimalne kryteria akceptacji, środowiska i plan cofnięcia. Jeśli nie można odtworzyć, odnotuj.
3. `Decide`: porównaj alternatywy przy użyciu `QUALITY_GATES.md`; wybieraj najmniejszą zmianę dającą mierzalną korzyść. Przy sprzecznościach najpierw zgodność/safety, potem grywalność/retencja, wydajność, przychód, zakres.
4. `Execute`: lokalnie i inkrementalnie, bez niszczenia cudzej pracy. Przed destrukcyjnymi operacjami sprawdź ich zakres.
5. `Verify`: testy automatyczne, testy manualne i urządzenia zgodnie z kategorią; podawaj dokładne polecenia i wyniki. Nie nazywaj czegoś przetestowanym bez wykonania testu.
6. `Report`: ścieżki i zakres zmian, dowody, testy/pass/fail, znane ograniczenia, ryzyka, najbliższy krok; użyj `REPORT_TEMPLATE.md`.

## Dozwolona autonomia i eskalacja
- Autonomicznie: analiza, refaktoryzacja w zatwierdzonym zakresie, lokalne testy, tworzenie nowych plików projektowych, naprawy i poprawki UI, pomiar buildów, generowanie assetów kodem.
- Wymagana zgoda: publikacja, deploy produkcyjny, zakupy/usługi płatne, włączenie płatnego SDK, wysłanie prywatnych danych do usług zewnętrznych, zmiana umowy/licencji, masowe usuwanie plików lub zapisów, przebudowa architektury o nieodwracalnych skutkach.
- **Nie deklaruj uruchomienia subagentów ani pracy „w tle”, dopóki narzędzia nie zostały rzeczywiście użyte.** Skills to instrukcje on-demand, a nie zawsze pracujące osobne procesy.
- Wykonuj dostępne kompetencje sekwencyjnie w ramach zadania; jeśli narzędzie agentów istnieje i jest potrzebne, można delegować niezależne audyty, ale integracja i weryfikacja pozostają odpowiedzialnością prowadzącego.

## Typy zadań i trasa
- Cel biznesowy/nieprecyzyjna przebudowa → `vh-director` → `vh-market-intelligence`, `vh-analytics-experiments`, `vh-release-manager`.
- Gameplay → `vh-arena-gameplay` + `vh-ux-gamefeel` + `vh-game-engineer` + `vh-qa-automation`.
- Grafika/audio/UI → odpowiednio `vh-vector-art`, `vh-audio`, `vh-mobile-accessibility`.
- Ekonomia/treść → `vh-progression-economy`, `vh-mission-content`, `vh-narrative-localization`.
- Reklamy/portale → `vh-monetization`, `vh-portal-integrations`, `vh-legal-risk`.
- Testowanie i release → `vh-test-console`, `vh-save-security`, `vh-performance`, `vh-qa-automation`, `vh-release-manager`.

## Współpraca ze specjalistami
Przekaż jedynie konkret: cel, stan bazowy, inwarianty, pliki/katalogi po odkryciu, dowód akceptacji, wynik. Jeśli brak narzędzia do delegacji, wykonaj checklisty z odpowiednich skilli kolejno. Nie rozliczaj „kto ma rację”; rozlicz dowody.
