# GG-VISUAL-01 — GLITCH GULP VISUAL 2.0: audyt, system, dwa prototypy

Stan: **prototypy gotowe, praca zatrzymana przed wyborem kierunku.** Baza: `main` @ `3f507d4`.
Pliki gry (`index.html`, `style.css`, `game.js`) **nie zostały zmienione** — prototypy są wstrzykiwane
do `game.js` w pamięci przez skrypt dowodowy (`qa/visual2-shots.mjs`), więc mechanika, RNG, zapis i układ
map są bajt w bajt takie jak na `main`.

Galeria porównawcza (przełącznik PRZED / A / B na tych samych klatkach): link w HANDOFF-ie.
Zrzuty w repo: `design/visual2/shots/` (JPEG), liczby: `design/visual2/facts.json`.

## 1. Audyt: gdzie gra pokazuje świat

### 1.1 Rozgrywka — jedna wspólna ścieżka

| Tryb | Funkcja | Podłoże | Różnice |
|---|---|---|---|
| Arena (6 typów obszarów) | `Game.render()` → `drawCityFloor()` | `CityFloor.draw(ctx, view, null)` — mapa `CITY_DISTRICT_MAP` 8×8: plac, park, port, galeria, dachy, rdzeń | zoom rośnie z wirem; obwódka świata 3000×3000; napis dzielnicy na jednym bloku (`citySignCells()`); pierścienie Rdzenia w środku |
| Wyzwanie dnia | `startDailyChallenge()` → `startRound({ seed, daily })` | **to samo co Arena** | różni się tylko seed rundy (obiekty, boty) |
| Wyzwanie znajomych | `startRound({ seed, challenge })` | **to samo co Arena** | jw. |
| Kampania (12 dzielnic, 240 misji) | `Game.renderCampaign()` → `drawCampaignGrid()` | `CityFloor.draw(ctx, view, theme)` — cała plansza w jednej dzielnicy (`campaignTheme()`) | plansza przycięta do `CONFIG.campaign.bounds` (reszta przyciemniona), różowa ramka; twisty rysowane nad podłożem (`drawDarkness()`, strefy glitch, bramki) |

Wniosek: **nie ma osobnego renderera podłoża dla Kampanii ani dla Wyzwań.** Wszystkie cztery tryby malują
bloki tą samą funkcją `paintCityChunk(c, i, j, theme)`; różni je tylko parametr `theme` i to, co jest rysowane
nad podłożem. Wymiana tła w jednym miejscu zmienia je wszędzie — korekta zakresu jest więc zgodna z kodem.

### 1.2 Współdzielone elementy

- **`CityFloor`** — pamięć podręczna bloków (klucz `theme|i|j`), stopnie rozdzielczości 0,75 / 1 / 1,5 / 2,
  budżet pikseli i LRU, prefetch pierścienia, `prewarm()` na starcie rundy/misji, `drawTraffic()` (światła aut),
  `minimap()` (tło minimapy). Jeden obiekt na grę (`game.cityFloor`) + `SCREEN_FLOOR` dla ekranów menu.
- **`paintCityChunk()`** — asfalt, płyta chodnika, działka (`CITY_LOT_BASE` + malarz z `CITY_LOT_PAINTERS`),
  krawężnik w kolorze dzielnicy (`cityTone()`), oznakowanie jezdni, przejścia, bariera krawędzi świata,
  pierścienie Rdzenia, latarnie (`cityLampSprite()`).
- **`CITY_LOT_PAINTERS`** — 6 malarzy (plac, park, port, galeria, dachy, rdzeń), każdy po 3 warianty działki.
- **Losowość podłoża** — własne ziarna `cityHash(i, j, k)`; **nie korzysta z RNG rundy** (`Game.rng`) ani z
  `Math.random`. Dlatego zmiana grafiki podłoża nie może przesunąć seeda ani układu Wyzwań.
- **Obiekty i wiry** — `OBJECT_ART` / `drawObjectArt()` i `Hole.draw()` identyczne w Arenie i Kampanii.

### 1.3 Stwierdzone różnice i braki

1. **Dzielnice 7–12 nie mają własnej podłogi.** `DISTRICT_FLOOR` (`CHAPTER_II[].floor`) każe im użyć malarza
   dzielnicy-siostry w innym kolorze: Tunele Metra = Rdzeń, Nocny Bazar = Plac, Fabryka Pikseli = Port,
   Zatoka Hologramów = Galeria, Wiszące Ogrody = Park, Chmura Danych = Dachy. 120 z 240 misji gra się na
   przemalowanej podłodze z Rozdziału I.
2. **Trzy niezależne języki rysunku tej samej dzielnicy:**
   podłoga w grze (`CITY_LOT_PAINTERS`, rzut z góry, kreska), kafel dzielnicy w menu (`DISTRICT_PAINTERS` +
   `drawDistrictTile()`, widok z boku, sylwetki) i Miasto (`drawCityScene()`, widok z boku). Łączy je tylko
   `DISTRICT_COLORS`.
3. **Podglądy map to kwadraty, nie mapa.** `CityFloor.minimap()` rysuje 64 jednobarwne pola; używają go
   minimapa w rundzie i `drawDailyMapPreview()` (Wyzwania). Ekran powitalny (`drawWelcomeScene()`) używa
   prawdziwych bloków z `SCREEN_FLOOR` — jedyny ekran menu, który pokazuje faktyczne podłoże.
4. **Materiały nie istnieją jako pojęcie.** Kolory i alfy są wpisane ręcznie w każdym malarzu (ponad 70
   literałów); jezdnia, chodnik i działka mają prawie tę samą jasność, więc świat czyta się jako „siatka linii".
5. **Poziom jakości nie dociera do malarza.** `gfxLevel` obniża tylko rozdzielczość bloku; liczba detali jest
   stała.

## 2. System GLITCH GULP VISUAL 2.0

Jeden język dla 12 dzielnic, w trzech warstwach. Prototyp jest napisany dokładnie w tym układzie
(`design/visual2/gg-visual2-proto.js`).

### 2.1 Materiały (wspólne nawierzchnie)

Dziewięć powierzchni używanych w całym mieście: `asphalt`, `walk` (chodnik), `paving` (bruk/plac), `grass`,
`deck` (beton/nabrzeże), `gallery` (kamień polerowany), `roof` (dach), `board` (płyta obwodów), `water`.
Kolor działki = materiał zmieszany z tonem dzielnicy (`cityTone()`), więc dzielnica barwi materiał, a nie
definiuje własnej palety. Wszystkie barwy wychodzą z palety asset bible (`--nc-*`); pełne nasycenie zostaje
dla obiektów.

### 2.2 Prymitywy (styl grafiki 2D/2,5D)

Każdy motyw jest napisany raz, przy użyciu czterech prymitywów. Kierunek artystyczny to implementacja
prymitywów + paleta materiałów — nic więcej:

| Prymityw | Znaczenie | Kierunek A | Kierunek B |
|---|---|---|---|
| `slab` | element uniesiony | cień na płd.-wsch. + rozjaśniona krawędź płn.-zach. | ciemna tafla z obrysem w kolorze dzielnicy |
| `pit` | element zagłębiony (woda) | ściana płn.-zach. rzuca cień do środka | przerywany świecący obrys |
| `ink` | oznaczenia | biaława farba | światło dzielnicy |
| `line` | kreska | płaska | szeroka poświata + ostry rdzeń (wypalone, bez `shadowBlur`) |

### 2.3 Receptury dzielnic (warianty, nie osobne style)

Dzielnica = `{ ground: materiał, motifs: [3 motywy] }` + jej kolor. 12 receptur korzysta z 22 motywów (16 dla dzielnic 1–6, 6 nowych);
dzielnice 7–12 dzielą materiał z siostrą i mają po jednym własnym motywie (tory, stragany, rury, hologram,
tarasy, szafy serwerowe). Wariant działki nadal losuje `cityHash(i, j, 2)` — fontanna, staw i lądowisko
zostają tam, gdzie gracze je znają.

### 2.4 Zasady oświetlenia, cieni i detali

- Jedno źródło światła na cały świat. A: kierunkowe z lewej góry, stałe przesunięcie cienia 5 jednostek;
  B: emisyjne (świecą linie, cieni nie ma).
- Żadnego `shadowBlur` w podłożu; wszystko wypalane raz do bloku.
- Latarnie to jedyne plamy światła. A: ciepłe (odróżniają się od koloru dzielnicy); B: w kolorze dzielnicy.
- Zakaz ciemnego dysku z jasną obwódką (czyta się jak wir) — woda jest jaśniejsza od otoczenia.
- Zakaz strzałek/szewronów na jezdni (należą do padów impulsu) i przekątnych „X" (skrzynie).

### 2.5 Czytelność podczas pochłaniania

- Podłoże pozostaje płaskie i przygaszone; jasność i gęstość detalu są mierzone (rozdz. 4.3) i powinny mieć
  próg w QA przy wdrożeniu.
- Elementy podłoża są duże i niskokontrastowe; nic nie ma rozmiaru ani sylwetki obiektu do zjedzenia.
- Kolory tierów (cyjan fragmentów, róż, złoto) nie pojawiają się w podłożu w pełnym nasyceniu.

### 2.6 Uproszczenia dla słabszych urządzeń

Poziom jakości widoku trafia do malarza: na poziomie 0 znikają faktury materiałów, spoiny, drobne znaczniki
i połowa latarni; blok ma rozdzielczość ×1. Koszt klatki nie zależy od stylu — to nadal ten sam `drawImage`
gotowych bloków.

### 2.7 Co obejmuje pełne wdrożenie (po wyborze kierunku, osobne etapy)

1. Podłoże: `paintCityChunk()` na materiałach, prymitywach i recepturach (zakres prototypu).
2. Własne motywy dzielnic 7–12 (w prototypie szkice).
3. Minimapa i podgląd Wyzwania dnia z prawdziwych bloków zamiast kwadratów.
4. Kafle dzielnic i Miasto: ta sama paleta materiałów i to samo światło (osobna decyzja — to widok z boku).
5. Opcjonalnie dla A: cień kontaktowy pod obiektami (zmiana `drawObjectArt()`, wymaga pomiaru).

## 3. Dwa prototypy

| | A · „Nocna makieta" | B · „Neonowy schemat" |
|---|---|---|
| Idea | miasto jako nocna makieta z materiałów | miasto jako świecący schemat |
| Stosunek do dziś | wyraźna zmiana | rozwinięcie obecnego stylu |
| Kolor dzielnicy | w materiale działki + cienka listwa | w liniach, klamrach narożnych i przewodzie jezdni |
| Głębia | relief: bloki nad jezdnią, woda niżej | brak; warstwy przez grubość kreski |
| Jasność podłoża | wyższa niż dziś | jak dziś |
| Mocna strona | świat czyta się jako miejsce; dzielnice różnią się od razu | obiekty najbardziej odstają od tła; spójne z HUD |
| Ryzyko | jaśniejsze tło pod cyjanowymi fragmentami; uniesione kontenery/stragany mogą wyglądać jak przeszkody | mniejszy efekt „nowej gry"; więcej drobnej kreski |

Sceny (identyczne kadry PRZED / A / B, telefon 390×844 @2x i desktop 1366×768):

1. Arena — Plac Neonów: runda z seeda 20261111, wir ustawiony w (600, 640).
2. Kampania — Park Impulsów: misja M05, pierwsza klatka po starcie.
3. Wyzwanie dnia — seed z daty 2026-11-11 (zegar zamrożony), pozycja startowa z seeda.

Dodatkowo: Arena na telefonie przy jakości 0 oraz arkusz podłóg 12 dzielnic (`districts-*.jpg`).

Pliki: `design/visual2/shots/<scena>-<kadr>-<base|A|B>.jpg`.

## 4. Wyniki

Środowisko: node v22.23.4 · playwright 1.63.0 · chromium 153 (headless, render programowy, bez GPU), jedna
maszyna, ta sama sesja. Trzy przebiegi pomiarowe; w tabelach „przebieg 1 / 2 / 3".

### 4.1 Nienaruszalność rozgrywki — PASS

| Sprawdzenie | PRZED | A | B | Wynik |
|---|---|---|---|---|
| Diff plików gry (`index.html`, `style.css`, `game.js`) względem `main` | — | 0 bajtów | 0 bajtów | PASS |
| Hash układu Areny (pozycje i rozmiary 299 obiektów + 5 botów, seed 20261111) | `991bcf7b` | `991bcf7b` | `991bcf7b` | PASS |
| Hash układu misji M05 (22 obiekty) | `cd3ea182` | `cd3ea182` | `cd3ea182` | PASS |
| Hash układu Wyzwania dnia (seed 1162589282) | `2bb93250` | `2bb93250` | `2bb93250` | PASS |
| Liczba wywołań `Math.random` do klatki (Arena / M05 / Daily) | 23 / 43 / 12 | 23 / 43 / 12 | 23 / 43 / 12 | PASS |
| Błędy strony i konsoli podczas scen | 0 | 0 | 0 | PASS |
| Przemalowania bloków na stojącej klatce (40 klatek, każda scena) | 0 | 0 | 0 | PASS |

### 4.2 Wydajność (ms; mniejsze = lepsze)

| Pomiar | PRZED | A | B |
|---|---|---|---|
| Malowanie jednego bloku ×1 (jakość 0), mediana | 1,7 / 1,6 / 2,4 | 2,7 / 2,9 / 2,6 | 2,0 / 2,9 / 1,9 |
| Malowanie jednego bloku ×2, mediana | 4,7 / 4,5 / 6,0 | 4,7 / 7,1 / 5,2 | 5,8 / 6,1 / 5,1 |
| Malowanie jednego bloku ×2, maksimum | 8,7 / 8,0 / 10,5 | 9,2 / 11,4 / 10,0 | 10,0 / 11,5 / 8,6 |
| Klatka: Arena, telefon, mediana | 9,1 / 9,6 / 9,2 | 9,6 / 9,3 / 12,0 | 8,8 / 9,9 / 11,0 |
| Klatka: Arena, telefon, jakość 0 | 2,7 / 3,0 / 3,8 | 2,5 / 2,7 / 2,8 | 2,9 / 2,7 / 4,1 |
| Klatka: M05, telefon | 2,1 / 2,2 / 2,1 | 2,0 / 2,0 / 2,1 | 2,1 / 2,9 / 2,1 |
| Klatka: Wyzwanie dnia, telefon | 7,7 / 7,7 / 9,1 | 7,7 / 9,8 / 8,1 | 8,8 / 7,6 / 8,1 |
| Klatka: Arena, desktop | 7,8 / 7,7 / 10,7 | 8,2 / 8,2 / 8,8 | 11,7 / 7,6 / 8,1 |
| Klatka: M05, desktop | 4,9 / 4,8 / 7,9 | 5,0 / 5,1 / 5,8 | 5,1 / 5,3 / 5,2 |
| Klatka: Wyzwanie dnia, desktop | 5,8 / 6,0 / 6,1 | 5,9 / 9,4 / 6,2 | 6,1 / 6,3 / 6,6 |

Odczyt:

- **Koszt klatki: bez mierzalnej różnicy** między PRZED, A i B — rozrzut między przebiegami (do ok. 3 ms)
  jest większy niż różnice między wariantami. Tak ma być: klatka tylko kopiuje gotowe bloki.
- **Koszt malowania bloku** (jednorazowy, przy wejściu bloku w kadr lub zmianie zoomu): ×1 rośnie o ok.
  0,5–1 ms (A wyraźniej niż B), ×2 mieści się w rozrzucie pomiaru. To jest jedyne miejsce, gdzie nowa oprawa
  kosztuje; limit 2 malowań na klatkę (PERF-04) pozostaje.
- Brak pomiaru na prawdziwym telefonie i z GPU — patrz 4.5.

### 4.3 Czytelność podłoża (blok ×1, średnia z 12 dzielnic)

| Miara | PRZED | A | B |
|---|---|---|---|
| Średnia jasność (0–1) | 0,092 | 0,149 | 0,087 |
| Jasność 95. percentyla | 0,189 | 0,252 | 0,187 |
| Gęstość detalu (średnia różnica sąsiednich pikseli) | 0,0149 | 0,0142 | 0,0178 |

- **A**: podłoże jaśniejsze o ok. 60 % (głównie ciepłe plamy latarni i materiały), za to spokojniejsze
  (mniej drobnej kreski). Obiekty mają jasność rzędu 0,5–0,9, więc zapas jest, ale cyjanowe fragmenty na
  turkusowym bruku Placu mają mniejszy kontrast barwny niż dziś — do oceny wzrokiem na zrzutach.
- **B**: jasność jak dziś, kreski o ok. 20 % więcej.
- To miary pomocnicze, nie test czytelności z graczami.

### 4.4 QA repozytorium (stan gałęzi = `main` + pliki prototypu, pliki gry bez zmian)

| Zestaw | Wynik |
|---|---|
| `node qa/instructions.mjs` | PASS 4/4 |
| `node qa/boot.mjs` | PASS 9/9 |
| `node qa/bridge.mjs` | PASS 20/20 |
| `node qa/trace.mjs` | PASS 7/7 |
| `node qa/visual.mjs` | PASS 20/20 |
| `node qa/visual1.mjs` | PASS 31/31 |
| `node qa/design.mjs` | PASS 29/29 |
| `node qa/save-safety.mjs` | PASS 107/107 |
| `node qa/px02-isolation.mjs` | PASS 95/95 |
| `node qa/v22.mjs` | PASS 49/49 |
| `node qa/perf1.mjs` | PASS 25/25 |
| `node qa/run-all.mjs` | **NOT RUN** — nie startuje: `SyntaxError` w `qa/crazygames-basic1.mjs:910` (apostrof w `'… (the SDK's en-US …'`). Błąd jest na `main` (commit `e1715c4`), nie pochodzi z tego etapu i nie został tu naprawiony. |

Te zestawy sprawdzają grę bez prototypu (pliki gry są niezmienione), czyli potwierdzają, że gałąź niczego nie
zepsuła. **Nie sprawdzają prototypów** — patrz niżej.

### 4.5 NOT RUN / NOT VERIFIED

- **NOT RUN:** `qa/run-all.mjs` (powód wyżej) i zestawy poza listą 4.4 (m.in. `content`, `responsive`,
  `balance1`, `difficulty`, `release`, zestawy CrazyGames) — pliki gry są bez zmian, więc nie były potrzebne
  do oceny prototypu.
- **NOT RUN:** zestawy QA gry uruchomione *z prototypem A/B* (np. `visual.mjs`, `perf1.mjs --equiv`) —
  prototyp nie jest kodem gry; te bramki należą do etapu wdrożenia.
- **NOT VERIFIED:** prawdziwe urządzenia (iPhone, Android, słaby laptop), GPU, DPR 3, zużycie pamięci bloków.
- **NOT VERIFIED:** czytelność z graczami (tylko miary jasności i ocena zrzutów).
- **NOT VERIFIED:** pozostałe 238 misji i pozostałe typy twistów (ciemność, strefy glitch) na nowym podłożu;
  sprawdzone sceny: Arena, M05, Wyzwanie dnia + arkusz 12 dzielnic.
- **NOT VERIFIED:** wersja angielska napisu dzielnicy na podłożu; ekran powitalny, minimapa, kafle dzielnic
  i Miasto — poza zakresem prototypu (minimapa i kafle nie zostały zmienione).
- **NOT VERIFIED:** zmiana poziomu jakości w trakcie rundy (klucz bloku w prototypie nie zawiera poziomu detalu).
- P00: nie uruchamiany — etap nie zmienia kodu gry (prototyp + dokumentacja).

## 5. Decyzja dla właścicielki i GPT

1. Kierunek: **A**, **B** albo hybryda (np. materiały i relief z A przy jasności i świetle dzielnicy z B).
2. Czy dzielnice 7–12 dostają własne motywy podłogi (dziś: przemalowane 1–6).
3. Czy etap wdrożenia obejmuje też minimapę / podgląd Wyzwania dnia, czy tylko podłoże w rundzie.

Rekomendacja wykonawcy: **B jako baza + relief z A tylko dla wody i krawędzi bloków.** B utrzymuje dzisiejszą
jasność tła (najmniejsze ryzyko dla czytelności fragmentów), a uniesione bloki z A dają najwięcej „miasta"
najmniejszym kosztem. Pełne A wymaga najpierw testu czytelności na telefonie.

## 6. Jak odtworzyć

```bash
node qa/visual2-shots.mjs              # PRZED + A + B -> qa/out/visual2/ (PNG + facts.json)
node qa/visual2-shots.mjs --publish    # dodatkowo JPEG + facts.json -> design/visual2/
node qa/visual2-shots.mjs --style=A --only=shots
```
