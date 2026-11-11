# GG-VISUAL-01 R3 — finalna korekta tła A2 → A2.1

Stan: **A2.1 gotowe do odbioru; praca zatrzymana.** Baza: gałąź `claude/optimistic-gates-3z93aj` @ `28fe962`
(R2), `main` @ `3f507d4`. Pliki gry (`index.html`, `style.css`, `game.js`) **bez zmian** (diff względem
`main` = 0 linii). Prototyp pozostaje poza kodem gry: `design/visual2/gg-visual2-a2.js` jest wstrzykiwany do
`game.js` tylko w pamięci przez `qa/visual2-shots.mjs` (`window.__GG_VISUAL = 'A2.1'`).

Zakres: **wyłącznie tło.** Obiekty, kryształy, kapsuły, pojazdy, cienie kontaktowe, wir, efekty pochłaniania,
mechanika, kolizje, RNG, zapis, balans, HUD i minimapa — nietknięte.

## 1. Co zmienia A2.1

Pomiar A2 według stref pokazał, gdzie małe obiekty tracą kontrast (Arena, mediana, kryształ `#50F0FA` do tła):
jezdnia 13,1 (jak dziś), **działki 7,8**, **chodnik 6,5**. Korekta idzie więc tam, gdzie jest problem:

| Element | A2 | A2.1 |
|---|---|---|
| Materiały działek (nieprzezroczyste) | — | przyciemnione zależnie od jasności: **15 %** dla ciemnych, liniowo do **34 %** dla najjaśniejszych (piasek ścieżek, górne tarasy, płytka woda, bieżnia) |
| Płyty chodnika | `#1f2c3d` / `#243347` | `#18222f` / `#1c2837` (ok. −20 %) — tu obiekty miały najniższy kontrast |
| Krawężnik (jasny kamień), cokół, cienie na jezdni | — | bez zmian |
| Jezdnia, płyty skrzyżowań, przejścia, linie | — | bez zmian |
| Latarnie i ich światło | — | bez zmian |
| Wewnątrz działek: mosiądz, farba, listwy świetlne, cienie reliefu, fale | — | bez zmian (są półprzezroczyste — korekta ich nie dotyka) |
| 36 kompozycji, układ świata, wybór wariantu działki | — | bez zmian |

Średnio materiały działek są ciemniejsze o kilkanaście procent; korekta nie jest jednakowa — jasne płaszczyzny
tracą więcej, ciemne mniej, akcenty nic. Dzięki temu krawężnik i akcenty odcinają się mocniej niż w A2.

Mechanizm (w prototypie): na czas malowania działki każdy nieprzezroczysty kolor `#rrggbb` ustawiany na
kontekście przechodzi przez `dimColor()`; parametry `DIM_BASE 0,15`, `DIM_SLOPE 0,7`, `DIM_MAX 0,34`.
Przy wdrożeniu do gry te wartości należy wypalić w paletach materiałów zamiast przechwytywać kontekst.

## 2. Wyniki (minimalne QA)

Środowisko: node v22.23.4 · playwright 1.63.0 · chromium 153 headless (render programowy), jedna maszyna,
trzy przebiegi („1 / 2 / 3").

### 2.1 Sceny, konsola, układ, RNG — PASS

| Sprawdzenie | PRZED | A2 | A2.1 | Wynik |
|---|---|---|---|---|
| Diff plików gry względem `main` | — | 0 | 0 | PASS |
| Sceny uruchamiają się i rysują (Arena, M05, Wyzwanie dnia; telefon + desktop) | tak | tak | tak | PASS |
| Jakość 0 (Arena, telefon) rysuje się | tak | tak | tak | PASS |
| Błędy strony / konsoli | 0 | 0 | 0 | PASS |
| Hash układu Areny (299 obiektów + 5 botów, seed 20261111) | `991bcf7b` | `991bcf7b` | `991bcf7b` | PASS |
| Hash układu M05 (22 obiekty) | `cd3ea182` | `cd3ea182` | `cd3ea182` | PASS |
| Hash układu Wyzwania dnia (seed 1162589282) | `2bb93250` | `2bb93250` | `2bb93250` | PASS |
| Wywołania `Math.random` do klatki (Arena / M05 / Daily / Arena jakość 0) | 23 / 43 / 12 / 12 | 23 / 43 / 12 / 12 | 23 / 43 / 12 / 12 | PASS |
| Przemalowania bloków na stojącej klatce | 0 | 0 | 0 | PASS |

Seedy, pozycje i kamery identyczne z R2: Arena — wir w (600, 640), Plac Neonów; M05 — start misji;
Wyzwanie dnia — data 2026-11-11, wir w (540, 1905), Port Syntez.

### 2.2 Kontrast małych obiektów

Współczynnik kontrastu cyjanowego kryształu (`#50F0FA`) do tła bezpośrednio pod każdym fragmentem i kapsułą
sceny (jak WCAG: 1 = niewidoczny, 21 = maksimum). Arena i Wyzwanie dnia: 210 obiektów; M05: 20.

| Scena / miara | PRZED | A2 | A2.1 | A2 → A2.1 |
|---|---|---|---|---|
| Arena — mediana | 13,25 | 9,39 | **10,14** | +8 % |
| Arena — 5. percentyl | 10,96 | 5,71 | **6,52** | +14 % |
| Arena — najniższy | 8,43 | 4,50 | **4,66** | +4 % |
| Arena — na działkach (67), mediana / min | 13,14 / 10,58 | 7,82 / 4,73 | **9,31 / 5,30** | +19 % / +12 % |
| Arena — na chodniku (21), mediana / min | 11,08 / 8,43 | 6,49 / 4,50 | **7,00 / 4,66** | +8 % / +4 % |
| Arena — na jezdni (122), mediana / min | 13,70 / 10,60 | 13,13 / 6,69 | 13,13 / 6,69 | bez zmian |
| Kampania M05 — mediana | 12,38 | 7,75 | **8,24** | +6 % |
| Kampania M05 — na działkach (11), mediana / min | 12,40 / 9,11 | 6,56 / 5,89 | **8,34 / 6,65** | +27 % / +13 % |
| Kampania M05 — najniższy | 7,52 | 5,49 | **5,61** | +2 % |
| Wyzwanie dnia — mediana | 13,25 | 9,66 | **10,23** | +6 % |
| Wyzwanie dnia — na działkach (70), mediana / min | 13,18 / 9,37 | 8,25 / 4,58 | **9,69 / 5,17** | +17 % / +13 % |
| Wyzwanie dnia — najniższy | 6,15 | 4,58 | **5,11** | +12 % |
| Arena, jakość 0 — mediana / najniższy | 13,25 / 8,43 | 9,89 / 4,55 | **10,36 / 4,71** | +5 % / +4 % |
| Średnia jasność tła (0–1) | 0,092 | 0,195 | **0,170** | −13 % |
| Jasność 95. percentyla (krawężnik) | 0,189 | 0,395 | 0,375 | −5 % |

Odczyt:

- **Działki: wyraźna poprawa** (mediana +17–27 %), czyli tam, gdzie celowała korekta.
- **Chodnik: poprawa mała** (+8 %). Próbka pod obiektem na chodniku obejmuje jasny krawężnik, listwę świetlną
  i światło latarni — te elementy zgodnie ze zleceniem zostały. Najniższy kontrast całej sceny (4,66) leży
  w strefie chodnika.
- **Jezdnia: bez zmian** i praktycznie jak dziś; minimum 6,69 (który element jezdni — nie badano).
- A2.1 nadal ma niższy kontrast niż obecna gra (10,1 wobec 13,3 w medianie) — to cena jaśniejszego,
  materiałowego tła. Każdy zmierzony obiekt ma co najmniej 4,66 : 1 (próg dla elementów graficznych: 3 : 1).
- Dalsza poprawa bez utraty jakości A2 wymagałaby ruszenia krawężnika lub latarni (poza zleceniem) albo
  obrysu / cienia obiektów (poza zakresem — pakiet obiektów).

### 2.3 Podstawowa wydajność (ms)

| Pomiar | PRZED | A2 | A2.1 |
|---|---|---|---|
| Malowanie bloku ×1 (jakość 0), mediana | 2,2 / 1,8 / 2,1 | 1,9 / 2,2 / 1,8 | 2,0 / 1,9 / 2,8 |
| Malowanie bloku ×2, mediana | 6,0 / 5,4 / 4,5 | 4,4 / 4,7 / 4,4 | 4,7 / 4,5 / 4,6 |
| Malowanie bloku ×2, maksimum | 8,5 / 14,8 / 8,6 | 10,6 / 6,9 / 8,7 | 9,4 / 12,3 / 9,8 |
| Klatka: Arena, telefon | 9,0 / 9,1 / 9,8 | 9,3 / 9,0 / 8,7 | 10,0 / 10,5 / 9,6 |
| Klatka: Arena, telefon, jakość 0 | 2,7 / 2,6 / 2,6 | 2,6 / 2,8 / 3,4 | 2,7 / 3,4 / 2,7 |
| Klatka: M05, telefon | 2,9 / 1,9 / 2,0 | 2,0 / 1,9 / 1,9 | 2,2 / 2,2 / 2,3 |
| Klatka: Wyzwanie dnia, telefon | 6,1 / 5,7 / 5,8 | 6,1 / 5,7 / 5,6 | 8,2 / 6,1 / 6,1 |
| Klatka: Arena, desktop | 7,8 / 7,9 / 11,3 | 7,9 / 7,8 / 8,0 | 7,9 / 7,6 / 9,9 |
| Klatka: M05, desktop | 4,8 / 5,2 / 5,1 | 5,8 / 5,1 / 5,5 | 7,7 / 4,8 / 5,3 |
| Klatka: Wyzwanie dnia, desktop | 4,7 / 7,0 / 5,1 | 6,4 / 5,0 / 5,3 | 5,0 / 5,4 / 5,4 |

Odczyt: malowanie bloku bez mierzalnej różnicy między wariantami. Klatka Areny na telefonie w A2.1 wyszła
o ok. 0,5–1 ms wyżej niż w PRZED i A2 we wszystkich trzech przebiegach; klatka tylko kopiuje gotowe bloki,
więc nie ma mechanizmu, który by to tłumaczył — traktuję to jako **niepotwierdzone, do sprawdzenia przy
wdrożeniu** (`qa/perf1.mjs --bench`), nie jako szum. Pozostałe sceny mieszczą się w rozrzucie.

### 2.4 PASS / FAIL / NOT RUN / NOT VERIFIED

- **PASS:** uruchomienie scen, konsola, hashe układu, RNG, jakość 0, brak przemalowań, diff plików gry = 0,
  `node qa/instructions.mjs` 4/4.
- **FAIL:** brak.
- **NOT RUN:** pełna regresja (`qa/run-all.mjs` i zestawy gry) — zgodnie ze zleceniem; pliki gry bez zmian.
- **Poza pakietem, istniejący na `main` (commit `e1715c4`), nienaprawiany:** `qa/crazygames-basic1.mjs:910`
  — `SyntaxError`, przez który `qa/run-all.mjs` nie startuje.
- **NOT VERIFIED:** prawdziwe urządzenia, GPU, DPR 3, pamięć bloków; czytelność z graczami; pozostałe 238
  misji i twisty (ciemność, strefy glitch); angielski napis dzielnicy; zmiana jakości w trakcie rundy;
  przyczyna wyższej klatki Areny na telefonie w A2.1.

## 3. Materiały

`design/visual2/shots/` (JPEG), nazwy `<scena>-<kadr>-<base|A2|A2.1>.jpg`:

- `arena-phone-*`, `arena-desktop-*` — Arena, Plac Neonów
- `campaign-phone-*`, `campaign-desktop-*` — Kampania, Park Impulsów M05
- `daily-phone-*`, `daily-desktop-*` — Wyzwanie dnia, Port Syntez
- `arena-phone-gfx0-*` — jakość 0
- `districts-*` — arkusz 12 dzielnic (te same 4 bloki)
- `districts36-A2.jpg`, `districts36-A2.1.jpg` — 12 dzielnic × 3 kompozycje

Liczby: `design/visual2/facts.json` (przebieg 1; PRZED, A2, A2.1). Pliki `*-A.jpg` i `*-B.jpg` to zapis R1/R2.

## 4. Odtworzenie

```bash
git fetch origin && git checkout claude/optimistic-gates-3z93aj
node qa/visual2-shots.mjs                       # PRZED + A2 + A2.1 -> qa/out/visual2/ (PNG + facts)
node qa/visual2-shots.mjs --publish             # dodatkowo JPEG + facts.json -> design/visual2/
node qa/visual2-shots.mjs --style=A2.1 --only=shots
node qa/visual2-shots.mjs --style=A,B           # warianty z R1
```

Wymaga Node i Playwrighta z Chromium (jak pozostałe skrypty `qa/`); nie zmienia żadnego pliku gry.

READY FOR GPT REVIEW — GG-VISUAL-01 R3
