# GG-VISUAL-02 — wdrożenie podłoża A2.1 „Premium Vector City”

Baza: `main` @ `3f507d4`. Gałąź: `claude/gg-visual-02-a21-floor`. Prototyp zatwierdzony w R3: gałąź
`claude/optimistic-gates-3z93aj` @ `a3cbe1a` (`design/visual2/gg-visual2-a2.js`, wariant A2.1).
Zakres QA zawężony poleceniem właścicielki w trakcie pracy („skip pełnego QA”, potem „skip wszystkie testy UI, merguj”):
uruchomiono wąski zestaw adekwatny do zmiany, resztę oznaczono NOT RUN.

## 1. Co wdrożono (tylko `game.js`)

- `paintCityChunk(c, i, j, theme, rich)` deleguje do `CITY_ART.paintChunk()` — jeden renderer podłoża dla Areny, Wyzwania dnia,
  wyzwań znajomych i Kampanii (wcześniej `CITY_LOT_PAINTERS`, usunięte razem z `CITY_LOT_BASE`).
- Trzy plany jasności: jezdnia ze skrzyżowaniami (ośmiokątna płyta, mosiężny pierścień), jasny kamienny krawężnik na cokole (ściana
  i cień od południa i wschodu), działka stopień niżej niż chodnik; jedno światło z lewej góry.
- 36 kompozycji działek (`LOTS`: 3 na każdą z 12 dzielnic, wybór `cityHash(i, j, 2)` jak dotąd, nigdy RNG rundy).
- A2.1: nieprzezroczyste materiały działek tonowane funkcją `toned()` (15 % dla ciemnych do 34 % dla jasnych), płyty chodnika
  na stałe przyciemnione (`#18222f`, `#1c2837`). Zamiast przechwytywania właściwości kontekstu Canvas z prototypu: jawna funkcja
  `toned()` w prymitywach malowania działki; poza działką `tone` jest tożsamością.
- Jakość i cache: `CityFloor.rich` (gfx > 0), wpis bloku pamięta `rich`; zmiana poziomu jakości przemalowuje bloki w kadrze leniwie
  w tym samym budżecie co zmiana zoomu (`draw()`, prefetch i `prewarm()` porównują `rich`). Poziom 0: bez faktur, wzoru płyt
  chodnika, ziarna jezdni, połowa latarni.
- Nietknięte: obiekty, kryształy, kapsuły, Horyzont, efekty pochłaniania, cienie, HUD, minimapa (`CityFloor.minimap()`), podgląd
  Wyzwania dnia, ekrany menu, mechanika, kolizje, sterowanie, RNG, seedy, balans, ekonomia, zapis (`SAVE_SCHEMA_VERSION` 13).

Zmienione pliki: `game.js`, `qa/visual2.mjs` (nowy), `qa/visual2-compare.mjs` (nowy), `qa/run-all.mjs`, `qa/README.md`,
`docs/CHANGELOG.md`, `docs/claude/ARCHITECTURE.md`, `docs/GG_VISUAL_02_REPORT.md`, `docs/GG_VISUAL_01*_REPORT.md` (raporty rund),
`design/visual2/gg-visual2-a2.js` (wzorzec dla `qa/visual2.mjs`), `design/visual2/impl/` (zrzuty i liczby). Pliki `index.html`,
`style.css`, `.github/` bez zmian.

## 2. Bramki (P00 w etapie, baza vs kandydat na tej samej maszynie)

| Bramka | Dowód | Wynik |
|---|---|---|
| CORE-ENERGY | `qa/v22.mjs` 49/49 | PASS |
| CORE-ISOLATION | `qa/px02-isolation.mjs` 95/95, `qa/v22.mjs` | PASS |
| CORE-LOOP | `qa/trace.mjs` 7/7 (ta sama runda i misja M01 dwa razy z tego samego seeda identyczne), `qa/visual.mjs` 20/20 | PASS (suity `flow`, `ftue1`, `ftue3`, `leave-run`, `campaign-bots` NOT RUN) |
| CORE-SAVE | `qa/save-safety.mjs` 107/107, schemat 13 bez zmian | PASS |
| TOOLS-DEV | `qa/dev-panel.mjs` | NOT RUN (panel nietknięty) |
| DEPLOY-PAGES | `check_pages_workflow.py` PASS (statycznie), `qa/release.mjs` 93/93, `git diff origin/main -- .github` puste | PASS; `qa/release-recovery.mjs` NOT RUN (workflow i skrypt wydania bez zmian) |

## 3. Wyniki testów

PASS (uruchomione na kandydacie): `instructions` 4/4, `boot` 9/9, `bridge` 20/20, `trace` 7/7, `release` 93/93,
`save-safety` 107/107, `px02-isolation` 95/95, `v22` 49/49, `visual` 20/20, `visual1` 31/31, `visual2` 19/19, `perf1` 25/25.

Nowy `qa/visual2.mjs` (19 kontroli): każdy blok Areny i Kampanii z `game.js` jest piksel w piksel taki sam jak ten sam blok z
zatwierdzonego prototypu A2.1 (64 bloki Areny przy 1×, 2× i gfx 0; 12 dzielnic × 64 bloków przy 1×; 12 × 16 przy 2× i gfx 0);
12 dzielnic × 3 różne kompozycje (36 różnych obrazów); malowanie podłogi nie rusza `game.rng.seed`, `Math.random`, układu obiektów
ani zapisu; `gfx 2 → 0 → 2` i zoom 0,3–2,2 przemalowują leniwie i się uspokajają (0 przemalowań na stojącej klatce); Arena, Wyzwanie
dnia, wyzwanie znajomego i misja każdej z 12 dzielnic rysują nowe podłoże; brak błędów konsoli. Test sprawdzono mutacją: zmiana
`TONE_BASE` w kodzie gry wywala 6 kontroli porównania z prototypem.

NOT RUN (zgodnie z poleceniem właścicielki): pełny `qa/run-all.mjs` (uruchomiony do połowy, przerwany na polecenie; 50 kontroli
PASS do momentu przerwania, brak FAIL), `flow`, `ftue1`, `ftue3`, `leave-run`, `campaign-bots`, `content`, `balance1`, `difficulty`,
`responsive`, `devices`, `v15`–`v21`, `dev-panel`, `features`, `edge-cases`, `audio`, `release-recovery`, `cg-*`, paired
`perf1 --bench` (przerwany, wynik nie jest używany), `perf1 --equiv`.

Istniejący problem na `main`, poza tym pakietem, niczego nie naprawiano: `qa/crazygames-basic1.mjs:910` — `SyntaxError` (apostrof w
tekście), przez który `qa/run-all.mjs` nie startuje. Suita paczki CrazyGames (`qa/crazygames-basic1.mjs`) przez to **NOT RUN**.
Build paczki: `node tools/export-crazygames-basic.mjs` — PASS (3 pliki, 1,39 MB, zip 0,43 MB, limit 50 MB; paczka zawiera `CITY_ART`).

NOT VERIFIED: prawdziwy iPhone i inne urządzenia, GPU, DPR 3, pamięć bloków na telefonie, czytelność z graczami, pozostałe misje
(poza pierwszą misją każdej dzielnicy) i twisty (ciemność, strefy glitch), angielski napis dzielnicy na nowym podłożu.

## 4. PRZED / PO (identyczne seedy, pozycje, kamery; `qa/visual2-compare.mjs`)

Zrzuty: `design/visual2/impl/<scena>-<kadr>-<base|after>.jpg` — Arena (Plac Neonów), Kampania M05 (Park Impulsów), Wyzwanie dnia
2026-11-11 (Port Syntez), telefon 390×844 i desktop 1366×768, Arena na jakości 0, arkusz 12 dzielnic (`districts-*`),
36 kompozycji (`districts36-after`).

| Sprawdzenie | PRZED | PO |
|---|---|---|
| Hash układu Areny (299 obiektów + 5 botów, seed 20261111) | `991bcf7b` | `991bcf7b` |
| Hash układu M05 (22 obiekty) | `cd3ea182` | `cd3ea182` |
| Hash układu Wyzwania dnia (seed 1162589282) | `2bb93250` | `2bb93250` |
| Wywołania `Math.random` do klatki (Arena / M05 / Daily) | 23 / 43 / 12 | 23 / 43 / 12 |
| Błędy strony i konsoli | 0 | 0 |
| Przemalowania bloków na stojącej klatce | 0 | 0 |

Kontrast cyjanowego kryształu do tła pod każdym małym obiektem (1 = niewidoczny, 21 = maksimum):

| Miara | PRZED | PO |
|---|---|---|
| Arena, mediana / najniższy | 13,25 / 8,43 | 10,14 / 4,66 |
| Arena, na działkach, mediana | 13,14 | 9,31 |
| Arena, na chodniku, mediana | 11,08 | 7,00 |
| Kampania M05, mediana / najniższy | 12,38 / 7,52 | 8,24 / 5,61 |
| Wyzwanie dnia, mediana / najniższy | 13,25 / 6,15 | 10,23 / 5,11 |
| Średnia jasność tła (0–1) | 0,092 | 0,170 |

Wartości zgodne co do setnych z prototypem A2.1 z R3 (10,14 / 8,24 / 10,23). Najniższy kontrast po wdrożeniu 4,66 : 1 jest nad
progiem 3 : 1 dla elementów graficznych, ale poniżej dzisiejszego.

## 5. Wydajność (Chromium bez GPU, jedna maszyna, jeden przebieg `visual2-compare`; ms)

| Pomiar | PRZED | PO |
|---|---|---|
| Malowanie bloku ×1 / ×2, mediana | 1,6 / 4,2 | 2,5 / 5,8 |
| Malowanie bloku ×2, maksimum | 8,6 | 11,5 |
| Klatka: Arena telefon / desktop | 10,1 / 8,5 | 9,4 / 7,7 |
| Klatka: Arena telefon, jakość 0 | 2,6 | 2,6 |
| Klatka: M05 telefon / desktop | 2,2 / 4,8 | 1,9 / 5,2 |
| Klatka: Wyzwanie dnia telefon / desktop | 5,9 / 6,1 | 6,4 / 6,1 |

Odczyt: koszt klatki bez mierzalnej różnicy (klatka kopiuje gotowe bloki); jednorazowe malowanie bloku wyższe o ok. 1 ms (×1),
bez zmiany limitu 2 malowań na klatkę. W R3 pomiary prototypu (3 przebiegi) dawały ten sam obraz. `qa/perf1.mjs` (bramki) 25/25 PASS.
Pomiar parami `perf1 --bench` przerwano — NOT RUN. Brak pomiaru na urządzeniu.

## 6. Dane graczy

Zapis bez zmian: `vectorHoleSave_v1`, `SAVE_SCHEMA_VERSION` 13, brak nowych pól, `qa/save-safety.mjs` 107/107, `qa/px02-isolation.mjs`
95/95, a `qa/visual2.mjs` sprawdza, że zapis w `localStorage` jest bajt w bajt taki sam przed i po malowaniu podłogi.

## 7. Ryzyka

- Jaśniejsze tło (0,17 wobec 0,09) obniża kontrast małych obiektów (mediana 10,1 wobec 13,3); najgorszy obiekt 4,66 : 1.
- Pierwsze malowanie bloku o ok. 1 ms droższe; na słabym telefonie przy pierwszym wejściu w kadr może być widoczne.
- Zmiana jakości w trakcie rundy przemalowuje bloki w kadrze leniwie (2 na klatkę) — nie sprawdzono na prawdziwym słabym urządzeniu.
- Obiekty nadal bez cienia kontaktowego (osobny pakiet „Obiekty”, nierozpoczęty).

## 8. Test na iPhonie (właścicielka, po deployu)

1. Otwórz grę z ekranu głównego lub z przeglądarki i wymuś odświeżenie (zamknij i otwórz kartę). Zapis zostaje.
2. Zagraj rundę Areny na Placu Neonów: czy małe kryształy i kapsuły wyraźnie odcinają się od podłoża, także na chodniku przy krawężniku?
3. Wejdź w Dzielnice, zagraj po jednej misji w Parku Impulsów i w Porcie Syntez; sprawdź też misję w dzielnicy z Rozdziału II.
4. Wyzwanie dnia: czy układ obiektów wygląda jak zwykle (zmieniło się tylko tło)?
5. Przy dłuższej grze zwróć uwagę na płynność przy wejściu w nowe kwartały miasta i po zmianie jakości (gra obniża ją sama).
6. Zgłoś zrzut ekranu każdego miejsca, gdzie obiekt zlewa się z tłem.
