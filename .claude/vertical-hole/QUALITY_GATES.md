# Bramy jakości i decyzje produktowe

## Punktacja pomysłów (orientacyjny score, NIE pomiar)
Oceń 0–5: wpływ na fun/retencję (30%), pierwszą sesję i dystrybucję (20%), stabilność/wydajność (15%), przychód zgodny z platformą (15%), szybkość wdrożenia (10%), łatwość testu i odwracalność (10%). Każdy wynik uzasadnij dowodem lub oznacz `hipoteza`. Ryzyka prawne, utrata zapisu i reguły portalu są osobnym **twardym veto**. Nie używaj oceny punktowej jako substytutu playtestu.

## Bramki produktu — tylko przykładowe cele wewnętrzne
- `G0 — Crash-free`: 0 reprodukowalnych crashy/blockerów w podstawowej pętli w przeprowadzonych testach; brak błędów krytycznych SDK i utraty zapisu. **Nie dowodzi to globalnego braku błędów.**
- `G1 — Time to fun`: pierwszy sterowalny ruch i możliwe pochłonięcie obiektu w kilku sekundach od gotowości; przetestować na throttled mobile. Nie wpisuj arbitralnego SLA jako warunku platformy.
- `G2 — Readability`: 100% sprawdzonych celów misji ma zgodne nazwy/ikony/obiekty; żaden HUD nie przesłania sterowania ani istotnych obiektów w macierzy testowej.
- `G3 — Feel`: w moderowanym teście gracz bez pomocy potrafi nazwać cel, rozpoznać co pochłania i chce powtórzyć rundę; obserwuj bez podpowiedzi, zapisuj porażki.
- `G4 — Instrumentation`: wydarzenia z `EVENT_TAXONOMY.md` przechodzą walidację, brak podwójnych startów/stóp, poszanowanie zgód.
- `G5 — Platform`: test realnego iframe/mobile + oficjalny inspektor/QA portalu, bez reklam poza SDK i bez IAP na Poki.
- `G6 — Business`: decyzja o rozszerzaniu kampanii lub monetyzacji wynika z segmentowanych pomiarów po wystarczającej próbie, nie z jednego tygodnia losowości.

## Wewnętrzna tablica metryk do założenia, NIE fakty rynkowe
`load_to_play_ms` p50/p90, `first_swallow_ms`, `tutorial_completion_rate`, `round_completion_rate`, `mean/median_session_seconds`, `runs_per_session`, `restart_rate`, `mobile_fps_p10`, `crash_rate`, `D1/D7 returning rate`, `ad_opportunities`, `rewarded_opt_in_rate`, `ad_errors`, `ARPDAU` jeśli przychody są dostępne.
Zapisuj denominatory, definicje „gracza”, źródło danych, strefę czasową, okres, rozróżnienie próby vs produkcja. Definicje w `EVENT_TAXONOMY.md`.

## Matryca pilności (P0..P3)
- P0: crash/utrata zapisu, niegrywalność, jawne naruszenie zasad portalu/prywatności → blokuje publikację.
- P1: istotna blokada sterowania lub błąd celu/progresji na powszechnym ekranie → napraw przed eksperymentem.
- P2: widoczny polish i efekty, jeśli istnieje dowód wpływu → realizuj po P0/P1.
- P3: dekoracje, długie poboczne dialogi, nowa waluta/mechanika → odraczaj.
