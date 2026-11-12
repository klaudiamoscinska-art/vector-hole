# GG-HOLE-01 „Premium Vortex” — raport etapu

**Baza:** `10e6d4f702d31da97cde9a19cece11662421a880` (`origin/main`, PR #97) · **Gałąź:** `claude/keen-ptolemy-yb8uub`
**Środowisko QA:** Linux, Node 22, Chromium headless (renderowanie programowe — bez GPU, bez Safari/iPhone).

## 1. Kierunek
Każdy wir to stos warstw rysowanych raz i stemplowanych z obrotem (`HOLE_LOOKS`, `holeSprite()`): dysk, serce, opad
materii, obręcz (z dołkiem grawitacyjnym) i korona. Warstwy kręcą się z różną prędkością, materia i cienkie pierścienie
zbiegają się do środka, obręcz błyska przy pochłonięciu. Skórki różnią się budową, nie tylko kolorem:

| Skórka (id) | Motyw |
|---|---|
| Horyzont (`rainbow`) | czarna dziura: największe czarne jądro, stalowe smugi, asymetryczny pierścień fotonowy, stalowa warga z cyjanem |
| Cyjan (`cyan`) | obwody: schodkowe ścieżki z węzłami, przeciwbieżna przesłona, podziałka, trzy klamry |
| Gorący Róż (`pink`) | plazma: trzy grube ramiona z rozżarzoną krawędzią, falująca obręcz, segmenty róż + cyjan |
| Toksyczna Zieleń (`green`) | kipiąca maź: ramiona z grudek, bąble w dysku, ściekająca obręcz, bąble wokół |
| Ultrafiolet (`purple`) | galaktyka: dwa wielkie ramiona, pył gwiezdny, jasne zgrubienie, orbita z planetami |
| Neonowe Złoto (`gold`) | słońce: języki ognia, gorąca korona, podwójna obręcz z rozbłyskami |
| Biała Plazma (`white`) | burza: ramiona-błyskawice, obręcz ze srebrnych płyt, żywe wyładowania |
| Aurora Finału (`aurora`) | zorza: szerokie wstęgi zieleń/cyjan/fiolet, trzy falujące pasma |
| Kryształ (`krysztal`) | szlif: przesłona z płaskich faset, druga przeciwbieżna, fasetowana oprawa, odłamki |
| Pryzmat (`pryzmat`) | rozszczepione światło: sześć ramion widma, białe serce, pierścień widma, szklane pryzmaty |

Rywale noszą wyglądy `tech / plasma / toxic / galaxy / crystal / sun` w swoich kolorach. Identyfikatory, ceny, własność,
nagrody, `SKIN_STYLES`, zapis v13 — bez zmian. Smuga, Efekt pochłaniania, Finisz — bez zmian.

## 2. Dowody (`design/hole1/`, z renderera gry: `node qa/hole1-shots.mjs --root <baza>`)
`catalog-*`, `sizes-*` (r = 12…100), `motion-*` (8 klatek co 1/15 s), `arena-1-start / 2-mid / 3-late / 4-late-horizon`,
`arena-5-late-q0` (jakość 0), `campaign-m12`, `daily`, `workshop` — każdy `-before` / `-after`, 390×844, 800×450, 1366×768.

## 3. Wydajność (ta sama maszyna, renderowanie programowe; mediana klatki baza → kandydat, ms)
| Scena | iPhone 390×844 | CrazyGames 800×450 | Desktop 1366×768 |
|---|---|---|---|
| Arena początek | 9,7 → 8,4 | 9,1 → 9,3 | 23,3 → 22,5 |
| Arena środek | 10,9 → 11,6 | 12,8 → 12,2 | 29,5 → 27,7 |
| Arena późna (6 dużych wirów) | 22,1 → 16,7 | 25,8 → 27,0 | 64,2 → 67,1 |
| Arena późna, Horyzont | 19,0 → 14,5 | 21,0 → 17,4 | 50,2 → 63,7 |
| Arena późna, jakość 0 | 4,3 → 5,3 | — | — |
| Misja M12 | 4,8 → 5,7 | 4,4 → 4,8 | 19,9 → 20,7 |
| Wyzwanie dnia | 10,8 → 11,5 | 11,3 → 10,4 | 27,5 → 27,6 |

Pomiar pojedynczy, rozrzut między przebiegami ±15–25%. `node qa/perf1.mjs`: 25/25 PASS. GPU i iPhone: NOT VERIFIED.

## 4. Bramki (P00-CORE etapu)
| Bramka | Wynik | Dowód |
|---|---|---|
| CORE-ENERGY | PASS | `qa/v22.mjs` 49/49 |
| CORE-ISOLATION | PASS | `qa/px02-isolation.mjs` 95/95; zmiana tylko w rysowaniu `Hole` |
| CORE-LOOP | PASS | `qa/design.mjs` 29/29, `qa/visual.mjs` 20/20 (m.in. animacja pochłaniania, korona lidera) |
| CORE-SAVE | PASS | `qa/save-safety.mjs` 107/107; brak nowych pól, schemat 13 |
| Układ / RNG | PASS | `qa/hole1-shots.mjs`: 19/19 scen — ten sam hash układu i liczba losowań co baza; 0 błędów konsoli |
| Wydajność | PASS | `qa/perf1.mjs` 25/25; tabela §3 |
| DEPLOY-PAGES | PASS (statycznie) | `qa/release.mjs` 93/93, `check_pages_workflow.py` PASS; `.github/` bez zmian |
| CrazyGames | PASS z 4 FAIL jak na bazie | `qa/crazygames-basic1.mjs`: 4 kontrole blokady wskaźnika FAIL identycznie na `10e6d4f` w tym środowisku; kontrola „piksele skórek jak w 727b8bd” zastąpiona (16 wyglądów: własny obraz + ruch) |
| Warsztat | PASS z 1 FAIL jak na bazie | `qa/workshop-buy.mjs` 72 PASS; 2560×1440 „tap przesuwa 2 px” FAIL identycznie na bazie |
| Instrukcje | PASS | `qa/instructions.mjs` 4/4 |
| `qa/run-all.mjs` (całość), `qa/release-recovery.mjs`, balans, kampania-boty | NOT RUN | zakres: krótkie testy (decyzja właścicielki); etap nie dotyka tych obszarów |
| TOOLS-DEV | bez zmian | panel dev nietknięty |

## 5. Ryzyka
- Płynność na prawdziwym iPhonie/Safari i na GPU nie jest mierzalna w tym środowisku (NOT VERIFIED) — wymaga testu właścicielki.
- Pamięć sprite’ów wirów: limit 150 pozycji / 12 Mpx (LRU); promień urządzenia ograniczony do 192 px (większe wiry są skalowane).
- Wiry rywali przy dużym rozmiarze na ekranie tracą płynnie warstwę opadu materii, a obręcz i korona są jednym stemplem.
