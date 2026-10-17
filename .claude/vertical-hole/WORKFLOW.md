# Standard pracy — od zadania do zweryfikowanego kodu

## Protokół każdej sesji
1. `Inspect`: przeczytaj `PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, stan git, strukturę repo, skrypty npm/runner i znane TODO. Przed nowymi funkcjami sprawdź raport P00 i zweryfikuj istotne testy ponownie. `GO_CORE` wymaga PASS energii, izolacji, pętli i migracji, a `GO_TOOLS` osobno sprawdza panel; przy FAIL CORE nie rozwijaj niepowiązanych feature’ów. Nie zakładaj, że opis w pakiecie odzwierciedla aktualny kod.
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

## Obowiązkowa bramka przed startem nowych promptów
1. Uruchom `P00.md`: najpierw `P00-CORE` (energia, izolacja, pętla, bezpieczny zapis), osobno `P00-TOOLS` (panel dev + separacja release).
2. CORE FAIL/NOT RUN blokuje nowe *niepowiązane* funkcje. TOOLS FAIL/NOT RUN blokuje testy wymagające panelu i release, **nie** naprawy FTUE po `GO_CORE`. Raport zawsze odnosi się do faktycznego revision i wyników wykonanych testów.
3. Po dowolnym zadaniu ponów zestaw testów contract/regression adekwatny do zakresu, nawet jeśli zadanie jest tylko wizualne (np. M59 i hud).
4. Jeśli zadanie jest uruchomione przez slash-komendę właściwego skilla, koordynację `vh-director` realizuj przez odczyt checklisty tylko gdy potrzebna; nie twórz fałszywych twierdzeń o uruchomieniu osobnych agentów.

## Gwarancje v1.2
Przed usuwaniem funkcji ekonomii, migracjami, zmianą nagród: wykonaj `SAVE_MIGRATION_CONTRACT.md` (legacy read-only, brak utraty sald/claimów). Każdy boost ma owner/activation_scope (zobacz `ARENA_DISTRICT_CONTRACT.md` i `TECHNICAL_PATTERNS.md` §4). Przed wnioskami o 5 minutach potwierdź mianownik i bias w `EVENT_TAXONOMY.md`.

`python scripts/validate.py` sprawdza **tylko strukturę** skilli; **nie** jest testem gry. W aktualnym repo przeprowadź EVAL-01..08 wg `SKILL_EVALUATION.md`, zapisując komendy/logi/testy urządzeń. Przed edycją zapisz `git status --short`, aby nie nadpisać cudzej pracy.

## Checkpoint v1.3 — weryfikowalny i odwracalny patch
Każda sesja rozpoczyna się od `CHANGE_SAFETY.md`. Raport poprzedniego P00 jest aktualny tylko przy zgodnym odcisku kodu (`EVIDENCE_FRESHNESS.md`), nie samym `git HEAD`. Zmienione po teście źródła wymagają powtórzenia testów dotkniętych zmianą; nigdy nie ustawiaj PASS przez samo skopiowanie manifestu. Przy migracji danych albo usunięciu funkcji najpierw zapis i fixture legacy, potem 1 mały diff, test, dopiero kolejny diff. Test iPhone bez fizycznego telefonu = `NOT RUN`.
