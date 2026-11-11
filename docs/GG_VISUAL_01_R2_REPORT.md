# GG-VISUAL-01 R2 — kierunek A2 „Premium Vector City"

Stan: **prototyp A2 gotowy do odbioru artystycznego; praca zatrzymana.** Baza: gałąź
`claude/optimistic-gates-3z93aj` @ `41fb8d1` (R1), `main` @ `3f507d4`.
Pliki gry (`index.html`, `style.css`, `game.js`) **bez zmian** (diff względem `main` = 0 linii) — A2, jak A i B,
jest wstrzykiwane do `game.js` tylko w pamięci przez `qa/visual2-shots.mjs`.

Werdykt R1 (GPT): odbiór techniczny tak, artystyczny nie — B za blisko obecnej grafiki, A bez skoku jakości.
R2 odpowiada jednym kierunkiem: **A2**, zbudowanym na materiałach i głębi z A.

Pliki: `design/visual2/gg-visual2-a2.js` (prototyp), `design/visual2/shots/*-A2.jpg`,
`design/visual2/shots/districts36-A2.jpg`, `design/visual2/facts.json`.

## 1. Co zmienia A2 względem A

| Priorytet zlecenia | A (R1) | A2 |
|---|---|---|
| 1. Projekt nawierzchni | materiał = kolor + faktura (spoiny, plamki) | materiał = kolor + **jedna kompozycja z dużych warstw**; faktury i cienka kreska usunięte |
| 2. Miejsce i głębia | cień 5 j. pod blokiem | **trzy plany jasności**: jezdnia (najciemniejsza) → jasny kamienny krawężnik na **cokole** (ściana od płd. i wsch., podwójny cień na jezdni) → działka **stopień niżej** niż chodnik |
| 3. Skrzyżowania, chodniki, krawędzie | zebra i linia | ośmiokątna **płyta skrzyżowania** z mosiężnym pierścieniem, szerokie przejścia, linie zatrzymania; chodnik 20 j. z dużych płyt; kwartał o promieniu 22 j.; listwa świetlna dzielnicy wokół działki |
| 4. Plac / Park / Port | warianty jak dziś | Plac: rondo z ośmioramienną gwiazdą, pasaż z kanałami światła, tarasowa fontanna. Park: łąka ze ścieżką i parterami, staw z pomostem, boisko z bieżnią. Port: plac składowy z polami, basen z nabrzeżem i pirsami, plac manewrowy z bocznicą |
| 5. 12 dzielnic | 6 malarzy + 6 szkiców | **36 kompozycji: 3 własne na każdą z 12 dzielnic**, żadna nie jest przemalowaniem |
| 6. Czytelność kryształów | — | mierzona: kontrast kryształu do podłoża pod każdym małym obiektem (rozdz. 3.3) |
| 7. Mniej drobnej kreski | spoiny, kropki, falki | zostały: przerywana linia jezdni, pasy na boisku/lądowisku, szczeble torów |

Wspólny detal całego miasta: **mosiężna intarsja** (pierścienie skrzyżowań i Rdzenia, obwódki placów, kilimy).
Światło: jedno, z lewej góry; latarnie tylko w narożnikach kwartałów (4 zamiast 8), ciepłe.

### Motywy 12 dzielnic

| Dzielnica | Materiał | Trzy kompozycje |
|---|---|---|
| Plac Neonów | łupek | rondo z gwiazdą · pasaż · fontanna tarasowa |
| Park Impulsów | trawnik | łąka ze ścieżką · staw z pomostem · boisko z bieżnią |
| Port Syntez | beton | plac składowy · basen portowy · plac manewrowy |
| Galeria Glitch | ciemny kamień | szachownica z „przeskokiem" rzędów · mural z dużych figur · amfiteatr |
| Dachy Prądu | membrana | lądowisko · pola paneli · świetliki |
| Rdzeń Miasta | płyta główna | trzy układy magistral i układów scalonych |
| Tunele Metra | kafel | peron między torami · posadzka-schemat sieci · rozjazd |
| Nocny Bazar | ciepły kamień | kilimy i lampiony · mozaika gwiazd · rondel targowy |
| Fabryka Pikseli | posadzka | mozaika pikseli · taśmy · kadzie CMY |
| Zatoka Hologramów | woda | projekcja na wodzie · molo · plaża w pasach |
| Wiszące Ogrody | zieleń | tarasy · plaster donic · kanały wodne |
| Chmura Danych | stal | hala serwerów · chłodnia · obłok z rastra |

## 2. Granica zakresu (wykazana, nie maskowana)

A2 zmienia wyłącznie podłoże. Trzy rzeczy wpływają na odbiór, a leżą **poza** warstwą podłoża:

1. **Obiekty nie mają cienia ani „stopy".** Podłoże ma teraz kierunkowe światło, a obiekty (`OBJECT_ART`) nadal
   świecą własnym blaskiem i nie rzucają cienia — na zrzutach widać, że stoją „na" grafice, a nie „w" świecie.
   Naprawa = cień kontaktowy w `drawObjectArt()` (grafika obiektów, nie podłoża). Propozycja: osobny mały
   etap po wyborze kierunku, z pomiarem kosztu.
2. **Minimapa i podgląd Wyzwania dnia** to nadal kolorowe kwadraty (`CityFloor.minimap()`).
3. **Obwódka świata i plansza misji** (różowa ramka z `shadowBlur`) pochodzą z `drawCityFloor()` /
   `drawCampaignGrid()`, nie z bloku.

Czego świadomie **nie** dodano, bo udawałoby mechanikę: budynków, drzew z koronami, stojących kontenerów,
straganów, szaf serwerowych. Kontenery, kilimy, panele i szafy są płaskimi polami (uniesienie 0–2 j.).
Po przeglądzie usunięto też z A2: sześciokątne donice na Placu (obiekt „węzeł" jest sześciokątem),
uniesione różowe klomby w Parku (róż to kolor tieru) i okrągłe kadzie z jasnym pierścieniem.

Pozostałe ryzyka do oceny wzrokiem: wiatraki chłodni (Chmura) i plaster donic (Ogrody) to duże, regularne
kształty — czytają się jako posadzka, ale są najbliżej „obiektu".

## 3. Wyniki (minimalne QA)

Środowisko: node v22.23.4 · playwright 1.63.0 · chromium 153 headless (render programowy), jedna maszyna.
Trzy przebiegi; w tabelach „1 / 2 / 3".

### 3.1 Uruchomienie, konsola, układ map — PASS

| Sprawdzenie | PRZED | A | A2 | Wynik |
|---|---|---|---|---|
| Diff plików gry względem `main` | — | 0 | 0 | PASS |
| Gra startuje, sceny się rysują (Arena, M05, Daily; telefon + desktop + jakość 0) | tak | tak | tak | PASS |
| Błędy strony / konsoli | 0 | 0 | 0 | PASS |
| Hash układu Areny (299 obiektów + 5 botów, seed 20261111) | `991bcf7b` | `991bcf7b` | `991bcf7b` | PASS |
| Hash układu M05 (22 obiekty) | `cd3ea182` | `cd3ea182` | `cd3ea182` | PASS |
| Hash układu Wyzwania dnia (seed 1162589282) | `2bb93250` | `2bb93250` | `2bb93250` | PASS |
| Wywołania `Math.random` do klatki (Arena / M05 / Daily) | 23 / 43 / 12 | 23 / 43 / 12 | 23 / 43 / 12 | PASS |
| Przemalowania bloków na stojącej klatce | 0 | 0 | 0 | PASS |

Kamera: Arena — wir w (600, 640), Plac Neonów; Wyzwanie dnia — wir w (540, 1905), Port Syntez (w R1 stał na
pozycji startowej z seeda; kadr zmieniono dla wszystkich wariantów jednakowo, dlatego liczby Daily w raporcie R1
dotyczą innego kadru); M05 — pozycja startowa misji.

### 3.2 Koszt renderowania (ms)

| Pomiar | PRZED | A | A2 |
|---|---|---|---|
| Malowanie bloku ×1, mediana | 1,6 / 1,6 / 1,6 | 1,7 / 1,8 / 1,8 | 2,7 / 1,8 / 2,4 |
| Malowanie bloku ×2, mediana | 4,2 / 4,0 / 4,5 | 5,2 / 5,5 / 5,3 | 5,6 / 5,0 / 4,7 |
| Malowanie bloku ×2, maksimum | 7,5 / 8,7 / 6,9 | 11,9 / 13,0 / 9,4 | 14,9 / 9,0 / 7,0 |
| Klatka: Arena, telefon | 9,5 / 9,1 / 8,6 | 9,0 / 9,2 / 8,9 | 10,5 / 8,8 / 8,6 |
| Klatka: Arena, telefon, jakość 0 | 2,5 / 2,6 / 2,5 | 2,8 / 2,6 / 2,9 | 3,2 / 2,7 / 2,6 |
| Klatka: M05, telefon | 2,0 / 2,0 / 2,1 | 2,1 / 2,1 / 1,9 | 2,1 / 1,9 / 2,1 |
| Klatka: Wyzwanie dnia, telefon | 5,6 / 5,8 / 7,5 | 6,0 / 5,5 / 5,9 | 6,1 / 5,8 / 5,6 |
| Klatka: Arena, desktop | 7,8 / 7,6 / 7,4 | 7,5 / 8,4 / 7,9 | 7,9 / 7,0 / 8,0 |

Odczyt: koszt klatki bez mierzalnej różnicy (klatka kopiuje gotowe bloki). Jednorazowe malowanie bloku w A2:
ok. +0,5–1 ms na blok względem dziś, jedno maksimum 14,9 ms w pierwszym przebiegu (nie powtórzyło się; przyczyny
nie badano). Limit 2 malowań na klatkę pozostaje.

### 3.3 Czytelność

Kontrast cyjanowego kryształu (`#50F0FA`) do podłoża bezpośrednio pod każdym z 210 małych obiektów rundy
(fragmenty i kapsuły), liczony jak współczynnik WCAG (1 = niewidoczny, 21 = maksimum):

| Miara | PRZED | A | A2 |
|---|---|---|---|
| Arena — mediana | 13,25 | 11,52 | 9,39 |
| Arena — 5. percentyl | 10,96 | 7,83 | 5,71 |
| Arena — najgorszy obiekt | 8,43 | 6,19 | 4,50 |
| Wyzwanie dnia — mediana | 13,25 | 11,38 | 9,66 |
| Wyzwanie dnia — najgorszy obiekt | 6,15 | 5,44 | 4,58 |
| Średnia jasność podłoża (0–1) | 0,092 | 0,149 | 0,195 |
| Jasność 95. percentyla | 0,189 | 0,252 | 0,395 |
| Gęstość krawędzi | 0,0149 | 0,0142 | 0,0216 |

Odczyt uczciwy: **A2 kosztuje kontrast.** Podłoże jest ok. dwa razy jaśniejsze niż dziś i mediana kontrastu
kryształu spada z 13 do 9,4; najgorszy przypadek to 4,5 : 1 (kryształ na najjaśniejszych miejscach podłoża; których dokładnie — nie badano).
To nadal powyżej progu 3 : 1 stosowanego dla elementów graficznych, ale zapas jest mniejszy niż dziś.
Gęstość krawędzi rośnie, bo duże płaszczyzny mają ostre granice (drobnej kreski jest mniej).
Jeśli po ocenie zrzutów kryształy wydadzą się za słabe, pierwszym pokrętłem jest przyciemnienie materiałów
działek o 10–15 % (krawężnik i kompozycje bez zmian).

### 3.4 NOT RUN / NOT VERIFIED

- **NOT RUN:** pełna regresja (`qa/run-all.mjs` i zestawy gry) — zgodnie ze zleceniem R2; pliki gry bez zmian.
- **Istniejący problem, niezwiązany z R2, nienaprawiany:** `qa/crazygames-basic1.mjs:910` — `SyntaxError`
  (apostrof w tekście), przez który `qa/run-all.mjs` nie startuje. Jest na `main` (commit `e1715c4`).
- **NOT VERIFIED:** prawdziwe urządzenia, GPU, DPR 3, pamięć bloków.
- **NOT VERIFIED:** czytelność z graczami; ocena opiera się na kontraście i zrzutach.
- **NOT VERIFIED:** pozostałe 238 misji i twisty (ciemność, strefy glitch) na A2; wersja angielska napisu
  dzielnicy; ekran powitalny; zmiana jakości w trakcie rundy.
- Poza zakresem R2 (bez zmian): minimapa, podgląd Wyzwania dnia, kafle dzielnic, Miasto, obiekty.

## 4. Materiały do odbioru

`design/visual2/shots/` (JPEG), nazwy `<scena>-<kadr>-<base|A|A2>.jpg`:

- `arena-phone-*`, `arena-desktop-*` — Arena, Plac Neonów
- `campaign-phone-*`, `campaign-desktop-*` — Kampania, Park Impulsów (M05)
- `daily-phone-*`, `daily-desktop-*` — Wyzwanie dnia, Port Syntez
- `arena-phone-gfx0-*` — najniższa jakość
- `districts-*` — arkusz 12 dzielnic (te same 4 bloki w każdym wariancie)
- `districts36-A2.jpg` — 12 dzielnic × 3 kompozycje

Odtworzenie: `node qa/visual2-shots.mjs` (PRZED + A + A2), `--style=B` nadal renderuje wariant z R1,
`--publish` odświeża `design/visual2/`.

## 5. Pytania do odbioru artystycznego

1. Czy A2 daje oczekiwany skok i jest „światem GLITCH GULP"?
2. Jasność podłoża: zostaje, czy przyciemnić działki o 10–15 %?
3. Które kompozycje dzielnic zostają, które do poprawy lub odrzucenia?
4. Czy po wyborze kierunku zlecić osobno cień kontaktowy obiektów (granica zakresu, rozdz. 2)?

READY FOR GPT ART REVIEW — GG-VISUAL-01 R2
