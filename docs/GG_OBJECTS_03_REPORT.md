# GG-OBJECTS-03 — produkcyjna wymiana grafik T3 i T4 („Premium Vector Objects”)

Baza: `main` @ `b049d28a1a5d72297331440d839d28d9b412b2db` (PR #95, grafiki T1/T2). Gałąź: `claude/optimistic-dirac-1yhiw0`.
Styl: kontynuacja systemu z GG-OBJECTS-02 (Premium Neon Vector — Style 3, hybryda top-down + pełna sylwetka). W grze nie ma
żadnej bitmapy — wszystko rysuje Canvas 2D z kształtów wektorowych. Reguły: `docs/GG_OBJECTS_02_ART_RULES.md` §8.
Obrazy z gry: `design/objects3/`. Tryb pracy: szybki model (implementacja → QA → commit → PR → merge → deploy → verify-live)
zatwierdzony przez właścicielkę w zleceniu; w trakcie właścicielka poleciła przyspieszyć i scalić od razu (patrz §5, NOT RUN).

## 1. Inwentarz obiektów T3 / T4 (źródło: aktualny kod, nie arkusz referencyjny)

Sprawdzone: `TIERS` + `minSizeTier`, `CAMPAIGN_ENTITY_STATS`, `LANDMARK_TIERS` / `LANDMARK_ART`, `CONFIG.campaign.entityRadius` /
`landmarkByTier`, `OBJECT_ART`, `CampaignEntity.artKind()`, `GOAL_ICONS` / `GOAL_ART_ICONS`, `CAMPAIGN_RANDOM_LOOKS`,
`spawnPortalRain()`, specyfikacje misji. Klasa, próg i promień należą do typu obiektu — nic nie zostało przeniesione między tierami.

| `artKind` | Typ / tier | Próg | Promień | Renderowanie | Gdzie występuje | Dotychczas | Teraz | Wynik |
|---|---|---|---|---|---|---|---|---|
| `samochod` | `vehicle`, T3 (złoto) | wir T3 | 34 | `VA_ART` → sprite 2× → `drawImage` | Arena (10), Wyzwanie dnia, wyzwania; cel w 15 misjach (M25, M28, M51, M64, M70…); tło wielu misji; ekran powitalny, karta ewolucji | coupé z boku, snop światła | samochód przodem do widza: maska, kabina (szyba przednia + 2 boczne), dach, reflektory, grill, zderzak, koła, różowa listwa | wdrożone |
| `samochod` + wariant `konwoj` | `vehicle`, T3 | wir T3 | 34 | jw., osobny sprite | misja M11 „Konwój” | ten sam wóz z hakiem | ten sam samochód z różowym kogutem i orurowaniem | wdrożone |
| `wezel` | `node`, T3 | wir T3 | 32 | `VA_ART` + nakładka (łuki ładunku) | Arena (4), Wyzwanie dnia, wyzwania; cel w M04, M23, M24, M27, M81 | płaski sześciokąt z jądrem | rdzeń w dwóch ramionach, obręcz z cyjanowymi światłami, kołnierz na cokole | wdrożone |
| `pylon` | `pylon`, T3 | wir T3 | 32 | `VA_ART` + nakładka (puls kuli) | Arena (4), Wyzwanie dnia, wyzwania; cel w M08, M36, M59, M77, M120, M133, M190, M210 | płaska kratownica z kulą | stopa, maszt z trzech nóg z zastrzałami, poprzeczka z izolatorami, głowica z kulą | wdrożone |
| `zasilacz` | `node` (glyph), T3 | wir T3 | 32 | `VA_ART` | cel w 11 misjach (M12, M42, M70, M88, M90, M128, M141, M150, M217, M233, M240) | płaski kwadrat z błyskawicą | obudowa (góra, przód, prawa ściana z żebrami), panel z błyskawicą, dwa zaciski | wdrożone |
| `lustro` | `pylon` (glyph), T3 | wir T3 | 32 | `VA_ART` | cel w M16, M46, M162, M163, M180, M208, M221 | obrócony o −14° panel na nóżce | łukowa tafla w złotej ramie z grubością, jarzmo z czopami, stopa — bez obrotu | wdrożone |
| `mostek` | `node` (glyph, mechanika zasilania), T3 | — (zasilany dotknięciem, nie pochłaniany) | 32 | `VA_ART`; niezasilony alfa 0,55 | M19, M191 | łuk z wieszakami z boku | pomost z góry, dwie łukowe balustrady, filary i łuk nośny | wdrożone |
| `pawilon` | `structure`, T4 (fiolet) | wir T4 | 54 | `VA_ART` | Arena (9 budowli łącznie), Wyzwanie dnia; cel nazwany w M29, M32, M33, M101, M189; losowa budowla w 12 misjach (M78, M88, M138…) | płaska elewacja z łukowym dachem | bryła z przeszkloną fasadą, filarami, drzwiami pod daszkiem, płytą dachu i świetlikiem | wdrożone |
| `billboard` | `structure`, T4 | wir T4 | 54 | `VA_ART` + nakładka (linia skanu) | Arena, Wyzwanie dnia; cel w M35, M43; losowa budowla | płaska tablica | tablica z grubością i ekranem, lampy, dwa słupy z zastrzałami, cokół | wdrożone |
| `magazyn` | `structure`, T4 | wir T4 | 54 | `VA_ART` | Arena, Wyzwanie dnia; cel w M37, M42, M71, M105, M130, M176; losowa budowla | płaska elewacja z dachem pilastym | hala z dwuspadowym dachem, brama rolowana, pas ostrzegawczy, boczne okna | wdrożone |
| `landmark` | `landmark` (ogólny, Arena), T4 | wir T4 | 52 | `VA_ART` + nakładka (pierścień przerywany, bez zmian) | Arena (2), Wyzwanie dnia, wyzwania | trzy płaskie wieże | obelisk ze świecącym czubkiem na dwustopniowym cokole z latarniami | wdrożone |
| `lm_kino` | `landmark` `kino`, T4 | wir T4 | 52 | `VA_ART` + `VA_DECALS` (napis) + pierścień | boss M04 (Plac) | płaska fasada z napisem | budynek z markizą i żarówkami, drzwi, gabloty, szyld (KINO / CINEMA) i szpula | wdrożone |
| `lm_fontanna` | `landmark` `fontanna`, T4 | wir T4 | 52 | `VA_ART` + pierścień + tabliczka | boss M08 (Park) | misa z dwoma łukami wody | misa z wodą, kolumna, górna czasza, strumienie i pióropusz (bez spirali) | wdrożone |
| `portal` | `portal` (Arena, „deszcz portali” finiszu), T4 | wir T4 | 14–20 | `VA_ART` + nakładka (wir w otworze) | tylko Arena, wariant finiszu `portal_rain` | ciemna tarcza z jasną obręczą i spiralą (mały „wir”) | stojący pierścień z grubością na stopie, jasne światło w otworze | wdrożone |

**Różnice między arkuszem referencyjnym a kodem (zachowana klasyfikacja z gry):**

- Arkusz pokazuje w T3 furgonetkę, autobus, antenę, drona i bramkę, w T4 „pomnik” — w grze nie ma takich typów T3 (autobus to T5
  `heavy`), więc nic nie dodano. T3 w grze to także zasilacz, lustro i mostek, których na arkuszu nie ma — zostały narysowane.
- Dźwig, galeria, brama iglicy, stacja, bazar (T5) oraz iglica, rdzeń, fabryka, latarnia, drzewo, serwer (T6) są landmarkami o
  wyższych progach — **nie ruszane** (źródło i piksele identyczne z bazą).
- **Portal ma w grze dwie postacie.** (1) Obiekt Areny `TIERS.portal` (T4, r 14–20, tylko w finiszu „deszcz portali”) — jest
  pochłaniany, należy do biblioteki, **wymieniony**. (2) Portal-pomocnik Kampanii (`gate` z glyphem `portal`, para teleportów,
  twist „O”) — znak na podłożu rysowany w `CampaignEntity.draw()`, nie jest obiektem ani celem — **bez zmian**, tak jak jego
  ikona `GOAL_ICONS.portal`.
- Ikona celu-landmarku (`GOAL_ICONS.landmark`, budowla z kolumnami) jest w grze jedna dla wszystkich landmarków T4–T6
  (`qa/content.mjs` wymaga jednej ikony na obiekt celu). Kino i fontanna zachowują ją do czasu wymiany landmarków T5/T6.

## 2. Co faktycznie zmieniono

- `game.js` — 13 funkcji `VA_ART` (stare płaskie wersje usunięte z `OBJECT_ART`); pomocnicze `vaP()`, `vaLerp()`, `vaInset()`,
  `vaGlass()`, stałe `VA_CYAN` / `VA_PINK`; w zestawie `vaKit()` trzy dodane metody (`ov`, `oval`, `drum`) — nic istniejącego nie
  zmienione; `VA_BIG` (sprite’y T3/T4 przy 2×, klucz cache bez zmian) i `VA_DECALS` (napis kina) w `getObjectSprite()`;
  `drawObjectLive()` — cztery nakładki przeniesione na nowe kształty (węzeł, pylon, billboard, portal).
- Ikony: `GOAL_ICONS.vehicle / node / pylon / structure` i 9 wpisów `GOAL_ART_ICONS` (samochód, węzeł, zasilacz, mostek, pylon,
  lustro, pawilon, billboard, magazyn) — leniwe gettery `vaIconSvg()`. `objectiveIconDef()`, logika celów i misji bez zmian.
- QA: `qa/objects3.mjs` (nowy, 19 kontroli), `qa/objects3-shots.mjs` (nowy, dowody), `qa/objects2.mjs` (lista „starych grafik bez
  zmian” nie obejmuje już T3/T4), `qa/run-all.mjs`, `qa/README.md`.
- Dokumenty: `docs/GG_OBJECTS_02_ART_RULES.md` (§8 T3/T4), ten raport, `docs/CHANGELOG.md`, `docs/GAME_DESIGN.md`,
  `docs/claude/ARCHITECTURE.md`. Obrazy: `design/objects3/`.
- **Bez zmian:** `index.html`, `style.css`, `.github/`, zapis (`SAVE_SCHEMA_VERSION` 13, klucz `vectorHoleSave_v1`), `TIERS`,
  `CAMPAIGN_ENTITY_STATS`, `LANDMARK_TIERS`, promienie, hitboxy, RNG, układy, boty, kamera, sterowanie, podłoże A2.1, Horyzont,
  efekty pochłaniania, T1/T2, T5/T6, integracje reklam i CrazyGames.

## 3. Zrzuty z działającej gry (`design/objects3/`, generuje `node qa/objects3-shots.mjs --root <baza> --publish`)

Wszystko rysuje renderer gry (`drawObjectArt()` / sprite cache / `objectiveIconDef()`); żaden obraz nie pochodzi z generatora.
PRZED = `main` @ `b049d28`, PO = ta gałąź; ta sama maszyna, te same seedy, kamera, pozycje i promienie.

| Wymaganie | Pliki |
|---|---|
| Arkusz A — T3/T4 PRZED / PO, duże (r = 78) | `sheet-hero-before.jpg`, `sheet-hero-after.jpg` |
| Arkusz B — rzeczywiste promienie z gry (1 jedn. = 1 px CSS, podłoże A2.1) | `sheet-scale-before.png`, `sheet-scale-after.png` |
| Arkusz C — T1/T2 obok T3/T4, jedno światło i jedna kamera (duże + skala planszy) | `sheet-family-after.jpg` (i `-before`) |
| Arkusz D — ikony celów 66 / 22 / 13 px (z wzorcem T2) | `sheet-icons-before.png`, `sheet-icons-after.png` |
| Arena (seed 20261111) | `arena-{phone,cg,desktop}-{before,after}.jpg`, jakość 0: `arena-gfx0-phone-*` |
| Arena oddalona: wir r = 150 (T6), zoom 0,58, deszcz portali | `arena-far-{phone,cg,desktop}-*` |
| Wyzwanie dnia 2026-11-11 (seed 1162589282) | `daily-{phone,cg,desktop}-*` |
| Kampania, 5 dzielnic | telefon: `m04-plac` (węzły, kino), `m25-plac` (samochody), `m29-plac` (pawilon), `m08-park` (pylony, fontanna), `m35-park` (billboardy), `m11-port` (konwój), `m42-port` (zasilacze, magazyny), `m46-galeria` (lustra), `m19-dachy` (mostki); CrazyGames i desktop: `m04-plac`, `m42-port` |

Kadry: telefon 390×844 (DPR 2), CrazyGames 800×450, desktop 1366×768. Liczby do kadrów: `design/objects3/facts.json`.

| Kadr | Hash układu PRZED / PO | `Math.random` PRZED / PO | Zoom | Klatka (mediana, ms) PRZED / PO |
|---|---|---|---|---|
| Arena, telefon | `991bcf7b` / `991bcf7b` | 23 / 23 | 1,08 | 7,8 / 9,5 |
| Arena oddalona, telefon | `d341fecb` / `d341fecb` | 1007 / 1007 | 0,58 | 12,7 / 12,1 |
| Arena, jakość 0, telefon | `991bcf7b` / `991bcf7b` | 12 / 12 | 1,08 | 2,1 / 2,2 |
| Wyzwanie dnia, telefon | `2bb93250` / `2bb93250` | 12 / 12 | 1,08 | 5,5 / 5,4 |
| M04 Plac | `e4f36cae` / `e4f36cae` | 94 / 94 | 1 | 4,2 / 3,6 |
| M25 Plac | `da512c2c` / `da512c2c` | 82 / 82 | 1 | 3,2 / 2,3 |
| M29 Plac | `54b60159` / `54b60159` | 98 / 98 | 1 | 3,2 / 2,6 |
| M08 Park | `f11534a5` / `f11534a5` | 97 / 97 | 1 | 3,4 / 3,1 |
| M35 Park | `cf9ae986` / `cf9ae986` | 100 / 100 | 1 | 4,4 / 3,8 |
| M11 Port | `fd68815b` / `fd68815b` | 88 / 88 | 1 | 3,4 / 3,3 |
| M42 Port | `fc23a122` / `fc23a122` | 113 / 113 | 1 | 3,9 / 2,5 |
| M46 Galeria | `2af868e3` / `2af868e3` | 63 / 63 | 1 | 1,8 / 2,1 |
| M19 Dachy | `efd7e822` / `efd7e822` | 135 / 135 | 1 | 5,6 / 7,6 |
| Arena, CrazyGames | `991bcf7b` / `991bcf7b` | 23 / 23 | 1,08 | 2,8 / 2,5 |
| Arena oddalona, CrazyGames | `d341fecb` / `d341fecb` | 1007 / 1007 | 0,58 | 4,9 / 4,4 |
| Arena, desktop | `991bcf7b` / `991bcf7b` | 23 / 23 | 1,564 | 6,3 / 5,9 |
| Arena oddalona, desktop | `d341fecb` / `d341fecb` | 1007 / 1007 | 0,841 | 10,0 / 13,4 |

Wszystkie 24 kadry: układ, liczba obiektów, kamera, zoom i liczba losowań identyczne; błędy strony i konsoli 0 / 0.
Czasy klatek w tej tabeli były mierzone przy równolegle działających kolejkach QA (40 klatek na kadr) — są orientacyjne;
porównanie wydajności jest w §7. Sprite’y T1/T2 (plansza i duże), Złoty Rdzeń, T5, T6, landmarki T5/T6 i bajt: 49 porównanych,
**0 różnic** (piksel w piksel).

**Skala (arkusz B, kadry `arena-far`):** samochód r 34 przy zoomie 0,58 ma ok. 39 px szerokości na telefonie i pozostaje
rozpoznawalny (dach, szyba, koła); budowle r 54 mają ok. 63 px. Rysunek mieści się w hitboxie: najszersza sylwetka 1,06 r
(pawilon), najwyższa 1,10 r (billboard) — pomiar w `qa/objects3.mjs` O3-4, limit 1,12 / 1,16 r jak dla T1/T2.

## 4. Bramki (P00 w etapie: baza `b049d28` vs kandydat, ta sama maszyna)

| Bramka | Dowód | Wynik |
|---|---|---|
| CORE-ENERGY | `v22` 49/49 | PASS |
| CORE-ISOLATION | `px02-isolation` 95/95, `v22` 49/49 | PASS |
| CORE-LOOP | `trace` 7/7, `flow` 35/35, `ftue1` 78/78, `ftue3` 26/26, `leave-run` 22/22, `arena-bots` 8/8, `campaign-bots` 2/2, `content` 11/11 (240 misji przejść botem) | PASS |
| CORE-SAVE | `save-safety` 107/107, schemat 13 i klucz bez zmian; `perf1 --equiv`: zapis po rundzie i misjach M01, M59 identyczny z bazą | PASS |
| TOOLS-DEV | `dev-panel` (v23) 66/66 | PASS |
| DEPLOY-PAGES | `check_pages_workflow.py` PASS, `release` 93/93, `release-recovery` 81/81, `.github/`, `index.html`, `style.css` bez zmian | PASS |

## 5. Testy

**Nowy zestaw `node qa/objects3.mjs` — 19/19 PASS:**
źródło 15 funkcji T1/T2, palety, stałych kamery i `vaIconSvg()` oraz 17 grafik T5/T6/landmarków/bajtu identyczne z bazą znak w znak;
49 sprite’ów (T1/T2 plansza i duże, Złoty Rdzeń, T5/T6, landmarki, bajt) piksel w piksel jak baza; 32 wiersze celów i 14 ikon klas /
twistów spoza T3/T4 — identyczny znacznik; `TIERS`, statystyki Kampanii, progi landmarków, promienie — identyczne z bazą, bramka
pochłaniania otwiera się na T3 / T4; 13 wyglądów z jednego zestawu (28 w `VA_ART`); sprite cały, na hitboxie; jedna geometria
(plansza ↔ duży podgląd najgorzej 0,967, ikona ↔ duży podgląd najgorzej 0,98); jedna kamera (góra, przód, prawa ściana); brak obrotu
w bezczynności (najgorzej 0,959); konwój = ten sam samochód; stany specjalne (zużyty węzeł / lustro 0,35, niezasilony mostek 0,55,
zablokowany landmark 0,45 + kłódka); malowanie nie rusza `Math.random`, `game.rng`, układu ani zapisu; cache: 14 sprite’ów 2×,
1,06 Mpx (baza 1,63 Mpx), komplet w ok. 19 ms, nic nie dochodzi na stojącej klatce, 2× przy DPR 1 / 2 / 3; Arena (z portalami),
Wyzwanie dnia, wyzwanie znajomego, M04/M08/M11/M19/M35/M37/M42/M46 i jakość 0; 0 błędów konsoli; szyld kina KINO / CINEMA mieści
się na tablicy.

**Regresja T1/T2:** `objects2` 15/15 PASS (klasy, sprite’y, sylwetki, ikony, cache T1/T2) + kontrole O3-1 powyżej.

**Zestawy uruchomione na kandydacie (każdy osobno, `node qa/<zestaw>.mjs`; `game.js` SHA-256 `5fd9936e…2cdf` = commit `2443fa0`):**

| Zestaw | Kandydat | Baza | Uwagi |
|---|---|---|---|
| `objects3` | 19/19 | — (nowy) | |
| `objects2` | 15/15 | 15/15 (PR #95) | |
| `content` (240 misji, ikony = obiekty, EN, przejścia botem) | 11/11 | — | 240 PASS, 0 ISSUE |
| `visual` / `visual2` / `visual1` | 20/20 / 19/19 / 31/31 | PASS | podłoże A2.1 piksel w piksel, 0 przemalowań |
| `design`, `trace`, `bridge`, `boot`, `instructions` | 29/29, 7/7, 20/20, 9/9, 4/4 | PASS | |
| `save-safety`, `px02-isolation`, `v22` | 107/107, 95/95, 49/49 | PASS | |
| `edge-cases`, `features`, `flow` | 13/13, 41/41, 35/35 | PASS | |
| `arena-bots`, `campaign-bots` | 8/8, 2/2 | PASS | |
| `v15`, `audio`, `v17`, `v18`, `v19` (EN), `v20`, `v21` | 32/32, 42/42, 12/12, 23/23, 16/16, 12/12, 62/62 | PASS | |
| `dev-panel`, `ftue1`, `leave-run`, `ftue3` | 66/66, 78/78, 22/22, 26/26 | PASS | |
| `release`, `release-recovery` | 93/93, 81/81 | PASS | |
| `cg-lang1`, `cg-data1`, `cg-preview-qa1`, `cg-preview-qa3` | 50/50, 70/70, 64/64, 72/72 | — | paczka CrazyGames, EN |
| `deviceqa1`, `devices` | 50/50, 75/75 | — | |
| `crazygames-basic1` | 87 PASS / 5 FAIL | 87 PASS / 5 FAIL | te same 5 na bazie (§6) |
| `gameready1` | 19/21, powtórka 21/21 | 21/21 | chwiejny pod obciążeniem (§6) |
| `workshop-buy` | 70/3 pod obciążeniem, powtórka 71 PASS / 2 FAIL | 71 PASS / 2 FAIL | te same 2 na bazie (§6) |

**`node qa/perf1.mjs --equiv=b049d28…` (baza vs kandydat):** skróty stanu gry identyczne we wszystkich 9 scenach (Arena: pierwsza
runda, późna, maks., ramka Poki, jakość 0; misje M01, M59, bossowie 6 i 12) — różnią się wyłącznie piksele (nowe grafiki; M01 piksel
w piksel); zapis po rundzie (wynik 14123), M01 (47) i M59 (2430) identyczny; menu: Miasto LVL1/LVL6, Dzielnice, Warsztat, Wyzwanie
dnia identyczne; ekran startowy/hub piksel w piksel, pauza 1,4–5 % pikseli (plansza pod arkuszem).

**NOT RUN w chwili merge** (właścicielka poleciła przyspieszyć i scalić): `responsive` (526 kontroli, w toku), `cg-preview-qa4`,
`cg-preview-qa5`, bramki `perf1` (uruchomione `--equiv` i krótki `--bench`), `balance1`, `difficulty` (240 misji, expert + casual),
`calibrate`, pełny `run-all` jednym przebiegiem (zestawy uruchamiane osobno). Zmiana nie dotyka czasu misji, ekonomii, układu ekranów
ani danych (stan gry identyczny z bazą w `--equiv`) — to uzasadnia kolejność, nie zastępuje wyniku.

**NOT VERIFIED:** prawdziwy iPhone i inne urządzenia (Safari, GPU, DPR 3) — odbiór właścicielki po publikacji; czytelność z
graczami; działająca paczka w portalu CrazyGames (testowana lokalnie z atrapą SDK); wygląd w każdej z 240 misji (zrzuty: 9 misji w
5 dzielnicach).

## 6. Problemy zastane i wyniki niejednoznaczne (sprawdzone na bazie)

| Problem | Baza `b049d28` | Kandydat | Ocena |
|---|---|---|---|
| `crazygames-basic1`: 4 kontrole blokady kursora (`lock:` ×2, `UI: the pause button…`, `step crashed (pointerLockChecks…)`) i „hole: all 22 other skins… draw the same pixels as the base” | 5 FAIL (87/5) | te same 5 FAIL (87/5) | zastane, nie ruszane |
| `responsive`: „320x568 campaign: main action not hit (under #btnNavWarsztat)” | FAIL (częściowy przebieg `run-all` na bazie) | NOT RUN do końca | zastane na bazie; ekran Dzielnic nie był zmieniany |
| `gameready1`: „English 360x640 / 836x470: … #btnPlayAgain "PLAY AGAIN"” | 21/21 | 1. przebieg (trzy kolejki QA równolegle) 19/21, powtórka 21/21 | chwiejny pod obciążeniem; ekran wyniku nie zawiera zmienionych grafik ani tekstów |
| `workshop-buy`: „Warsztat …: a tap on a card moves nothing” (karta przesuwa się o 2–23 px) | 2 FAIL: 2560×1440, 1536×864 (71/2) | 1. przebieg (trzy kolejki QA równolegle) 70/3 — dodatkowo 1920×1080 (2 px); powtórka 71/2: te same 2 FAIL co baza | zastane, nie ruszane; Warsztat piksel w piksel jak baza w `--equiv` (menu-warsztat IDENTICAL) |
| M59: wir 31 % zamiast 30 % pod obciążeniem | — | nie wystąpił (`content` 11/11) | — |

## 7. Wydajność

- **Koszt sprite’ów:** komplet 14 sprite’ów T3/T4 to 1,06 Mpx (baza 1,63 Mpx, −35 %): nowe wyglądy mają własne podłoże zamiast
  ogólnej poświaty i mniejsze płótno. Klatka to nadal jedno `drawImage` na obiekt; gradienty i poświaty liczone tylko przy
  malowaniu sprite’a (komplet ok. 19 ms, raz).
- **Rozmiar wydania:** `game.js` 1 152 354 → 1 165 640 B; razem z `index.html` i `style.css` 1 472 473 → 1 485 759 B (+0,9 %),
  gzip 458 084 → 463 074 B (limit bramki 520 KB).
- **Pomiar par (`node qa/perf1.mjs --bench --pair=<baza> --reps=2`, baza i kandydat na przemian, raster programowy):** patrz
  HANDOFF / opis PR — wynik dopisany po zakończeniu pomiaru.

## 8. Ryzyka i ograniczenia

- Odbiór wizualny na prawdziwym iPhonie nie był możliwy w tym środowisku (NOT VERIFIED) — do sprawdzenia przez właścicielkę:
  czytelność samochodu przy oddalonej kamerze, kontrast złota na jasnych działkach, ostrość przy DPR 3.
- Złoto klasy T3 (`#EFCB63`) po rozjaśnieniu górnych płaszczyzn jest kremowe; tier nadal niosą front, rama i minimapa. Jeśli na
  urządzeniu okaże się za blade, wystarczy przyciemnić `top` w `VA_ART.samochod` / `zasilacz`.
- Ikony celów T3/T4 są wielobarwne (jak T1/T2) i nie biorą `currentColor`; przy 13 px czytelne jako sylwetka, bez detalu.
- Ikona celu-landmarku pozostaje wspólna (kino i fontanna nie mają jeszcze ikon z własnej geometrii) — do domknięcia razem z T5/T6.
- Część zestawów nie zdążyła się wykonać przed merge (§5); `gameready1` i `workshop-buy` dały wyniki zależne od obciążenia (§6).
- Na `main` pozostają zastane FAIL-e z §6 (blokada kursora w paczce, stare porównanie wiru, układ Dzielnic 320×568).
- T5, T6 i ich landmarki mają dawne, płaskie grafiki — obok nowych T1–T4 widać różnicę stylu do czasu kolejnego etapu.
