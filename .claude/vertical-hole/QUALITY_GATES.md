# Bramy jakości i decyzje produktowe

## Punktacja pomysłów (orientacyjny score, NIE pomiar)
Oceń 0–5: wpływ na fun/retencję (30%), pierwszą sesję i dystrybucję (20%), stabilność/wydajność (15%), przychód zgodny z platformą (15%), szybkość wdrożenia (10%), łatwość testu i odwracalność (10%). Każdy wynik uzasadnij dowodem lub oznacz `hipoteza`. Ryzyka prawne, utrata zapisu i reguły portalu są osobnym **twardym veto**. Nie używaj oceny punktowej jako substytutu playtestu.

## GATE P00 v1.2 — CORE, TOOLS, RELEASE
- `GO_CORE`: cztery PASS — brak aktywnej energii, niezależność Arena/Districts, poprawna pętla i bezpieczna migracja historycznych zapisów. FAIL/NOT RUN zatrzymuje *niepowiązane* nowe funkcje, ale nie naprawy fundamentów.
- `GO_TOOLS`: dev panel sprawdzony na docelowych urządzeniach, zapis izolowany, kod niewystępujący w release artifact. To osobna bramka; jej FAIL **nie blokuje** prac nad FTUE po `GO_CORE`, lecz blokuje testy wymagające panelu i gotowość wydania.
- `GO_RELEASE`: oddzielna akceptacja platform/performance/QA/legal/urządzeń i zgoda właścicielki. `NOT RUN` to brak dowodu, nigdy `PASS`. Źródło: `PREFLIGHT_GATES.md`, `SAVE_MIGRATION_CONTRACT.md`.

## Bramki produktu — tylko przykładowe cele wewnętrzne
- `G0 — Crash-free`: 0 reprodukowalnych crashy/blockerów w podstawowej pętli w przeprowadzonych testach; brak błędów krytycznych SDK i utraty zapisu. **Nie dowodzi to globalnego braku błędów.**
- `G1 — Time to fun`: pierwszy sterowalny ruch i możliwe pochłonięcie obiektu w kilku sekundach od gotowości; przetestować na throttled mobile. Nie wpisuj arbitralnego SLA jako warunku platformy.
- `G2 — Readability`: 100% sprawdzonych celów misji ma zgodne nazwy/ikony/obiekty; żaden HUD nie przesłania sterowania ani istotnych obiektów w macierzy testowej.
- `G3 — Feel`: w moderowanym teście gracz bez pomocy potrafi nazwać cel, rozpoznać co pochłania i chce powtórzyć rundę; obserwuj bez podpowiedzi, zapisuj porażki.
- `G4 — Instrumentation`: wydarzenia z `EVENT_TAXONOMY.md` przechodzą walidację, brak podwójnych startów/stóp, poszanowanie zgód.
- `G5 — Platform`: test realnego iframe/mobile + oficjalny inspektor/QA portalu, bez reklam poza SDK i bez IAP na Poki.
- `G6 — Business`: decyzja o rozszerzaniu kampanii lub monetyzacji wynika z segmentowanych pomiarów po wystarczającej próbie, nie z jednego tygodnia losowości.

## Wewnętrzna tablica metryk do założenia, NIE fakty rynkowe
`r5_entry_300s`, `active_play_300s`, `load_to_play_ms` p50/p90, `first_swallow_ms`, `tutorial_completion_rate`, `round_completion_rate`, `mean/median_session_seconds`, `runs_per_session`, `restart_rate`, `mobile_fps_p10`, `crash_rate`, `D1/D7 returning rate`, `ad_opportunities`, `rewarded_opt_in_rate`, `ad_errors`, `ARPDAU` jeśli przychody są dostępne.
Zapisuj denominatory, definicje „gracza”, źródło danych, strefę czasową, okres, rozróżnienie próby vs produkcja. Definicje w `EVENT_TAXONOMY.md`.

## Matryca pilności (P0..P3)
- P0: crash/utrata zapisu, niegrywalność, jawne naruszenie zasad portalu/prywatności → blokuje publikację.
- P1: istotna blokada sterowania lub błąd celu/progresji na powszechnym ekranie → napraw przed eksperymentem.
- P2: widoczny polish i efekty, jeśli istnieje dowód wpływu → realizuj po P0/P1.
- P3: dekoracje, długie poboczne dialogi, nowa waluta/mechanika → odraczaj.

## Twarda bramka dowodów v1.3
`PASS` po kolejnej edycji bez ponownych testów nie istnieje. Każdy GO wiąż z `(git HEAD, source_snapshot_sha256, test commands/logs, artifact hashes, environment)` zgodnie z `EVIDENCE_FRESHNESS.md`. Nie oceniaj release z builda dev; stosuj `RELEASE_DEBUG_GUARD.md` i `CHANGE_SAFETY.md`.

## Dodatkowe twarde weto wydania (2026-10-17)
Weryfikuj źródło publikacji GitHub Pages oraz produkcyjne assety niezależnie od P00. Publiczny `game.js` z klasą `DevPanel` / mutatorami `window.game.devPanel`, upload katalogu repo jako release albo push `claude/**` na publiczny serwis to `GO_RELEASE=STOP` do czasu oddzielnego patcha i walidacji. Sprawdź `check_pages_workflow.py` i `verify_release_artifact.py`; PASS statyczny nie zwalnia z testu produkcyjnego URL/telefonu. Brak wiarygodnego testu save przy nieznanym schemaVersion również blokuje release.

**QG-LIVE-01 (blokuje release):** lokalny test w `qa/dev-panel.mjs` nazwany „production host (simulated)” korzysta z interceptu `context.route` i local `fs.readFileSync`. Nie jest dowodem publicznego deployu; GO_RELEASE dopiero po niezależnym pobraniu na prawdziwym publicznym URL bez mocków i po porównaniu SHA256 serwowanych JS/HTML z zatwierdzonym katalogiem release. Brak realnego fetch = NOT RUN / STOP, nigdy PASS.

## QG-PAGES-02 — fail-closed deployment validation (v1.4.2)
Przed wydaniem walidator workflow musi odrzucać alternatywne postaci katalogu głównego (`./`, `${{ github.workspace }}`), niezatwierdzone gałęzie `feature/**`, niejednoznaczne eventy i wyrażenia w ścieżce. `check_pages_workflow.py` v1.4.1 mogło dla nich zwrócić fałszywy PASS — nie traktuj historycznego raportu jako dowodu. Uruchom nowe testy regresji oraz ręcznie potwierdź Branch Protection + wymagane zatwierdzanie środowiska `github-pages` w GitHub Settings; nazwa `environment: github-pages` w YAML **nie oznacza** włączenia reviewerów. Po naprawie PX03 uruchom oba artefakty, a po świadomym deploy PX05 z prawdziwą siecią.
