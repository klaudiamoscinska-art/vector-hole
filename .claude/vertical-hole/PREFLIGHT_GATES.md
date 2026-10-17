# P00 v1.4 — weryfikacja istniejących zmian, bez ponownego wdrażania

**Źródło prawdy:** AKTUALNE repo, nie sama paczka skilli. Właścicielka zgłosiła jako **już wdrożone**: (1) usunięcie odnawialnej energii, (2) pełne rozdzielenie areny i dzielnic, (3) panel testowy na telefon. **P00 jest audytem weryfikacyjnym: nie implementuje ani nie przepisuje tych trzech funkcji i nie zmienia kodu gry.** Nie traktuj deklaracji ukończenia jako dowodu PASS: zweryfikuj repo, testy i artefakty. FAIL/NOT RUN → raport + propozycja osobnego zadania naprawczego do akceptacji, nie automatyczna przebudowa. Przed pracą sprawdź `git status --short`, nie usuwaj obcych zmian.

## P00-CORE — krytyczne dla gry (warunek `GO_CORE`)
- **CORE-ENERGY:** brak odnawialnej energii/limitów wejść w aktywnym runtime, UI, zasadach reklam i buildach portali. Historyczne pola energii są dozwolone WYŁĄCZNIE w czytniku starych zapisów, bez działania w gameplayu. Fragmenty potrzebne do wzrostu dziury pozostają mechaniką gry.
- **CORE-ISOLATION:** arena może ruszyć/restartować przy pustej, zablokowanej, ukończonej i uszkodzonej kampanii; zakup/reset kampanijnego boosta/waluty nie zmienia ustawień, tierów, score i zasad areny. Obejmij BOOST-01..03 z `ARENA_DISTRICT_CONTRACT.md`.
- **CORE-LOOP:** wejście → ruch → pierwsze pochłonięcie → wynik → „Następna arena” → kolejna runda, bez softlocku na mobile/desktop; poprawna pauza, reset i stabilny zapis.
- **CORE-SAVE:** syntetyczne fixture'y starych zapisów, migrowane wg `SAVE_MIGRATION_CONTRACT.md` (SAVE-01..07 w zakresie istniejącego storage), bez utraty sald, nagród, odblokowań i progresu.

Każda pozycja `PASS | FAIL | NOT RUN` z komendą i ścieżką dowodu. `GO_CORE` tylko gdy **wszystkie** cztery mają prawdziwe PASS na aktualnej rewizji. `FAIL/NOT RUN` = STOP dla *niepowiązanych nowych funkcji*. Naprawy są możliwe w **oddzielnym zadaniu**, nie w weryfikacyjnym P00.

## P00-TOOLS — osobna bramka panelu (`GO_TOOLS`)
- **TOOLS-DEV:** panel dostępny dotykiem tylko w testowym buildzie, działa i ma izolowany zapis. Dowód: bezpośrednie sprawdzenie urządzenia lub `NOT RUN` dla urządzenia, lista assetów obu buildów, brak implementacji panelu w artefakcie produkcyjnym (nie samo ukrycie CSS), brak produkcyjnego debug API.
- Jeśli brak panelu lub istniejąca implementacja jest wadliwa, zaznacz `FAIL` i opisz **osobne zadanie naprawcze** (nie twórz drugiego panelu w P00). Brak panelu NIE anuluje `GO_CORE` i NIE blokuje napraw FTUE niezależnych od panelu.
- `GO_TOOLS` jest obowiązkowe przed testami wymagającymi szybkiego ustawiania postępu i przed wydaniem. Dla ręcznych testów niewymagających panelu oznacz zakres odpowiednio.

## Decyzje i dalsze bramki
- `GO_CORE=PASS` pozwala realizować prompty gameplay/FTUE z adekwatnymi testami; `GO_TOOLS` może jeszcze być `FAIL`.
- `GO_TOOLS=PASS` nie jest automatycznym pozwoleniem na produkcję. `GO_RELEASE` wymaga także wymogów `QUALITY_GATES.md`, platform, dostępności, zgodności prawnej i zgody właścicielki.
- Dla każdego FAIL/NOT RUN zapisz `blocked work`, ryzyko i dokładny następny test/naprawę. Nie przedstawiaj `NOT RUN` jako `PASS`.
- Raport `VH_PREFLIGHT_REPORT.md`: data, revision, czystość/stan git przed/po, wynik osobno CORE/TOOLS, komendy, logi, urządzenia, otwarte problemy i decyzja GO/STOP. Jeśli masz manifest dowodów, użyj schematu z `SKILL_EVALUATION.md` i `.claude/vertical-hole/tools/check_evidence.py` (to kontrola raportu, nie test runtime).

## Weryfikacja świeżości i bezpieczeństwo etapów v1.3
- `git HEAD` BEZ `source_snapshot_sha256` **nie wystarcza** do przeniesienia PASS. Użyj `EVIDENCE_FRESHNESS.md` i `python .claude/vertical-hole/tools/check_evidence.py --repo . --manifest VH_PREFLIGHT_MANIFEST.json --snapshot`; dowody po kolejnej zmianie kodu wymagają ponowienia testów. Skrypt sprawdza formalne ślady, nie uruchamia gry.
- Wykonuj P00 sekwencyjnie w małych zakresach (`CHANGE_SAFETY.md`); destrukcyjny legacy save / nieznana wersja → nie zapisuj w ciemno, wymagaj planu odwracalności i decyzji właścicielki.
- `GO_TOOLS` wymaga dwóch **rzeczywiście zbudowanych** osobnych artefaktów, testu `.claude/vertical-hole/tools/verify_release_artifact.py` oraz ręcznej inspekcji i testu device/storage wg `RELEASE_DEBUG_GUARD.md`. Sam brak przycisku w UI lub test statyczny ZIP nie wystarczy.
- `GO_RELEASE` zawsze wymaga osobnego artefaktu release z bieżącego snapshotu, weryfikacji adapterów platform i świadomej zgody; P00 nigdy samo nie upoważnia do publikacji.

**Dowody:** logi umieszczaj pod `.claude/vertical-hole/evidence/`; manifest pod `VH_PREFLIGHT_MANIFEST.json` albo w tym samym katalogu evidence. Nie używaj plików źródłowych gry jako „dowodów”.

## Weto P00 z przeglądu kodu — specyficzne ryzyka repo (2026-10-17)
1. Istniejący klientowy `DevPanel` w głównym publicznym `game.js` oznacza `TOOLS-DEV=FAIL` względem kontraktu dev-only **nawet jeśli użytkownik bez kodu nie widzi przycisku**. Nie twórz drugiego panelu. Raportuj osobny patch dev/release.
2. Wzajemna niezależność wejścia do gry nie dowodzi izolacji **ekonomicznej**: w źródle współdzielone są `save.coins` i poziom XP, `confirmRunSetup` kupuje `RUN_TOOLS` z tej samej waluty, którą można uzyskać w kampanii; skórki mają `perks` w Arenie. Porównaj stan przed/po nagrodach kampanii, zakupach, wyposażeniu skina i migracji. Jeśli kampania zmienia przewagę w Arenie, `CORE-ISOLATION=FAIL`. Nie usuwaj historycznych bonusów/zakupów bez osobnej decyzji i migracji.
3. `loadSave()` w analizowanym kodzie podczas odczytu wywołuje `saveGame(migrated)`; `migrateSave()` potrafi przejść do `defaultSave()` przy niezgodnym kształcie. Przetestuj nieznany przyszły `schemaVersion`, uszkodzony zapis, przerwany zapis i równoległe karty; bez kopii i testów `CORE-SAVE=FAIL/NOT RUN`, nigdy domyślny PASS.
4. `GO_RELEASE` ma osobne WETO dla deployment workflow: branch `claude/**`, upload repo `path: "."`, niepotwierdzony właściwy artefakt albo brak kontroli produkcyjnego URL. Wykonaj `check_pages_workflow.py` gdy GitHub Pages jest używane. `GO_CORE` i `GO_TOOLS` nie certyfikują publikacji.

## Jednoznaczny zakres P00 i nieufny gate workflow (v1.4.2)
`P00` pozostaje wyłącznie weryfikacją, nawet jeżeli `CHANGE_SAFETY` opisuje proces napraw; implementacja należy do osobnych `PX01–PX05`. `GO_RELEASE=STOP`, gdy nie ma ręcznie potwierdzonego artefaktu, ochrony gałęzi/środowiska, realnego testu sieciowego po wdrożeniu lub bezpiecznej ścieżki rollback. `check_pages_workflow.py` v1.4.2 odrzuca nieznane składnie oraz znane obejścia kontroli `path: '.'`; zachowaj testy regresyjne i nie przyjmuj historycznego PASS ze starszego walidatora.
