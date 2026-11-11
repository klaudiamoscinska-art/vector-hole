# GG-OBJECTS-02 — produkcyjna wymiana grafik T1 i T2 („Premium Vector Objects”)

Baza: `main` @ `2f8ab87` (PR #94, podłoże A2.1). Gałąź: `claude/inspiring-clarke-1d537v`.
Kierunek artystyczny zatwierdzony przez właścicielkę: propozycja 3 — hybryda top-down + pełna sylwetka (arkusz referencyjny
był wzorem stylu; w grze nie ma żadnej bitmapy — wszystko rysuje Canvas 2D z kształtów wektorowych).
Reguły artystyczne: `docs/GG_OBJECTS_02_ART_RULES.md`. Obrazy z gry: `design/objects2/`.

## 1. Inwentarz obiektów T1 / T2 (źródło: aktualny kod, nie arkusz)

Sprawdzone: `TIERS` + `minSizeTier`, `CAMPAIGN_ENTITY_STATS`, `OBJECT_ART`, `drawObjectArt()`, `OBJECT_SPRITE_CACHE`,
`OBJECT_ART_LITE`, `CampaignEntity.artKind()`, `GOAL_ICONS` / `GOAL_ART_ICONS`, `PROP_STREET_GLYPHS`, `CAMPAIGN_RANDOM_LOOKS`,
specyfikacje misji (`glyph:`). Klasa, próg i promień należą do typu obiektu, wygląd do „glyphu” — nic nie zostało przeniesione
między tierami. Arkusz referencyjny pokazywał moduł dachowy w T1; w grze jest to wygląd klasy `prop` (T2) i taki pozostał.

| Identyfikator (`OBJECT_ART`) | Klasa / tier | Promień | Dotychczas | Teraz | Gdzie występuje | Status |
|---|---|---|---|---|---|---|
| `fragment` | `fragment`, T1 (cyjan) | 7 | płaski romb z czterech trójkątów, kołysał się ±20° | pochylony kryształ: 6 ścianek, różowa pięta, stała orientacja | Arena, Wyzwanie dnia, wyzwania znajomych; leży na planszy każdej misji, cel w M05 i M61; ekran startowy, podglądy Warsztatu, grafika wyniku; Złoty Rdzeń (ta sama sylwetka w złocie) | wdrożone |
| `kapsula` | `capsule`, T1 (cyjan) | 10 | jednobarwna pastylka z szybką | pastylka pod kątem: różowa łuska + cyjanowe szkło, ciemna opaska, połysk | Arena, Wyzwanie dnia, wyzwania; cel w 18 misjach (M01, M06, M18, M91, M93, M98…); grafika wyniku | wdrożone |
| `latarnia` | `prop`, T2 (róż) | 20 | słup z boku ze stożkiem światła | stopa, słup, kołnierz, klosz-kopuła z jasnym spodem | Arena, Wyzwanie dnia, wyzwania; cel nazwany w 5 misjach (M96, M102, M153, M186, M194); losowy element uliczny w 14 misjach (M02, M03, M31, M63…); grafika wyniku | wdrożone |
| `drzewo` | `prop`, T2 | 20 | trzy kule na pniu | korona (duża kula + dwa płaty), pień, pierścień korzeni | Arena, Wyzwanie dnia, wyzwania; cel nazwany w M181, M184, M197; losowy element uliczny w 14 misjach | wdrożone |
| `lawka` | `prop`, T2 | 20 | trzy listwy widziane z przodu | oparcie, siedzisko z góry, cyjanowe podłokietniki, cztery nogi | Arena, Wyzwanie dnia, wyzwania; losowy element uliczny w 14 misjach | wdrożone |
| `kiosk` | `prop`, T2 | 20 | budka z markizą (płaska) | terminal z grubością: ekran z pikselami, szyjka, stopa | Arena, Wyzwanie dnia, wyzwania; cel nazwany w M92, M94; losowy element uliczny w 14 misjach | wdrożone |
| `skrzynia` | `prop`, T2 | 20 | kwadrat z przekątną | skrzynia z wiekiem: góra, przód z zatrzaskiem, prawa ściana, okucia | Arena, Wyzwanie dnia, wyzwania; misje M09, M39, M122, M123 | wdrożone |
| `modul_dachowy` | `prop`, T2 | 20 | prostokąt z wentylatorem | niska bryła z ekranem wentylacji na górze, kratka, dioda, stopki | misja M17 (Dachy) | wdrożone |
| `znacznik` | `marker`, T2 | 20 | proporczyk na maszcie | drogowskaz: tablica z trzema szewronami, słup, stopa | Arena, Wyzwanie dnia, wyzwania; misje M112, M126, M218 | wdrożone |
| `krysztal` | `marker`, T2 | 20 | trzy płaskie odłamki | wysoki graniastosłup z cyjanowym czubkiem + dwa odłamki | misje M13, M151, M158, M169, M178 | wdrożone |
| `paleta` | `marker`, T2 | 20 | trzy prostokąty na dwóch deskach | trzy pudła z taśmą i etykietą na palecie z klockami | misja M10 (Port) | wdrożone |
| `witryna` | `marker`, T2 | 20 | ramka z manekinem | bryła z szybą i refleksami, markiza w pasy z falbaną | misja M14 (Galeria) | wdrożone |
| `klucz_sektora` | `marker`, T2 | 20 | karta na kółku | karta leżąca na ziemi, klucz na ekranie, linie danych | misja M15 (Galeria, ciemność) | wdrożone |
| `emiter` | `marker`, T2 | 20 | czasza na maszcie | walec z cyjanową opaską, wieczko z soczewką, cokół | misja M21 (Rdzeń) | wdrożone |
| `znacznik_ogrodu` | `marker`, T2 | 20 | liść-flaga na paliku | donica (góra, przód, prawa ściana) z pięcioma liśćmi | misja M07 (Park) | wdrożone |

Poza zakresem, bez zmian (źródło grafik identyczne z bazą, 31 funkcji porównanych znak w znak; 30 sprite’ów piksel w piksel):
T3 (`samochod`, `wezel`, `pylon`, `zasilacz`, `lustro`, `mostek`), T4–T6, landmarki, `portal`, złoty bajt (`bajt` — obiekt specjalny
klasy T1 z własną złotą grafiką, nie ma go na arkuszu). **Złoty Rdzeń** nie ma własnej grafiki — gra rysuje go funkcją `fragment`
w złocie, więc dostał nową sylwetkę kryształu (złoty, z różowawą piętą); promienie, poświata i mechanika bez zmian.

## 2. Co faktycznie zmieniono

- `game.js` — blok `VA_*`: paleta (`vaPalette()`), zestaw rysujący (`vaKit()`: bryła `box()`, podłoże `base()`, poświata `bloom()`),
  15 funkcji `VA_ART` (wstawione do `OBJECT_ART` zamiast 15 starych), `vaIconSvg()` (ta sama funkcja odtworzona jako SVG).
- `getObjectSprite()` — sprite T1/T2 w 2× / 3× / 4× zależnie od gęstości pikseli płótna (`OBJECT_SPRITE_DPR`, ustawiane w
  `Game.resize()`), własne podłoże zamiast ogólnej poświaty, mniejsze płótno; reszta wyglądów bez zmian (2×, poświata).
- `drawObjectArt()` — usunięte kołysanie fragmentu (stała orientacja); błysk fragmentu przesunięty na górną ściankę.
- `GOAL_ICONS.fragment / capsule / prop / marker` i 13 wpisów T2 w `GOAL_ART_ICONS` — leniwe gettery zwracające SVG z `vaIconSvg()`.
  `objectiveIconDef()`, `campaignGoalIcon()`, logika celów i misji bez zmian.
- QA: `qa/objects2.mjs` (nowy, 15 kontroli), `qa/objects2-shots.mjs` (nowy, dowody PRZED/PO), `qa/run-all.mjs`, `qa/README.md`;
  osobny commit: `qa/crazygames-basic1.mjs` (literówka składniowa, patrz §6).
- Dokumenty: `docs/GG_OBJECTS_02_ART_RULES.md`, ten raport, `docs/CHANGELOG.md`, `docs/GAME_DESIGN.md`, `docs/claude/ARCHITECTURE.md`.
- Bez zmian: `index.html`, `style.css`, `.github/`, zapis (`SAVE_SCHEMA_VERSION` 13, klucz `vectorHoleSave_v1`), `TIERS`,
  `CAMPAIGN_ENTITY_STATS`, RNG, układy, boty, kamera, sterowanie, podłoże A2.1, Horyzont, efekty pochłaniania.

## 3. Zrzuty z działającej gry (`design/objects2/`, generuje `node qa/objects2-shots.mjs --root <baza>`)

Wszystko rysuje renderer gry (`drawObjectArt()` / sprite cache / `objectiveIconDef()`); żaden obraz nie pochodzi z generatora.
PRZED = `main` @ `2f8ab87`, PO = ta gałąź; ta sama maszyna, te same seedy, kamera, pozycje i promienie.

| Wymaganie | Pliki |
|---|---|
| A. Arkusz PRZED / PO każdego assetu | `sheet-hero-before.jpg`, `sheet-hero-after.jpg` |
| B. Pełne sylwetki, jedna perspektywa | `sheet-hero-after.jpg` (15 wyglądów, r = 78) |
| C. Rzeczywista skala (promień z gry, 1 jedn. = 1 px CSS, podłoże A2.1) | `sheet-scale-before.png`, `sheet-scale-after.png` |
| Ikony celów (66 / 22 / 13 px) | `sheet-icons-before.png`, `sheet-icons-after.png` |
| D. Arena na A2.1 (seed 20261111, Plac Neonów) | `arena-{phone,cg,desktop}-{before,after}.jpg`, jakość 0: `arena-gfx0-phone-*` |
| E. Kampania, różne dzielnice | telefon: `m02-plac`, `m07-park`, `m09-port`, `m10-port`, `m13-galeria`, `m14-galeria`, `m15-galeria` (ciemność), `m17-dachy`, `m21-rdzen`; CrazyGames i desktop: `m09-port`, `m14-galeria` |
| F. Wyzwanie dnia 2026-11-11 (seed 1162589282, Port Syntez) | `daily-{phone,cg,desktop}-{before,after}.jpg` |

Kadry: telefon 390×844 (DPR 2), CrazyGames 800×450, desktop 1366×768. Liczby do kadrów: `design/objects2/facts.json`.

| Kadr | Hash układu PRZED / PO | `Math.random` PRZED / PO | Klatka (mediana, ms) PRZED / PO |
|---|---|---|---|
| Arena, telefon (299 obiektów + 5 botów) | `991bcf7b` / `991bcf7b` | 23 / 23 | 9,4 / 6,1 |
| Arena, telefon, jakość 0 | `991bcf7b` / `991bcf7b` | 12 / 12 | 2,5 / 2,3 |
| Arena, CrazyGames | `991bcf7b` / `991bcf7b` | 23 / 23 | 3,5 / 2,4 |
| Arena, desktop | `991bcf7b` / `991bcf7b` | 23 / 23 | 7,3 / 5,4 |
| Wyzwanie dnia, telefon | `2bb93250` / `2bb93250` | 12 / 12 | 5,3 / 5,0 |
| M02 Plac (losowe elementy uliczne) | `546f2f34` / `546f2f34` | 68 / 68 | 2,7 / 2,2 |
| M07 Park (znacznik ogrodu) | `f0eec95c` / `f0eec95c` | 37 / 37 | 1,5 / 1,3 |
| M09 Port (skrzynia) | `e3edf5ac` / `e3edf5ac` | 56 / 56 | 1,8 / 1,5 |
| M10 Port (paleta) | `6eb4db65` / `6eb4db65` | 35 / 35 | 1,5 / 1,3 |
| M13 Galeria (kryształ) | `a291c8c` / `a291c8c` | 45 / 45 | 2,9 / 1,9 |
| M14 Galeria (witryna) | `7ac46510` / `7ac46510` | 39 / 39 | 1,7 / 1,3 |
| M15 Galeria (klucz sektora) | `729aa31e` / `729aa31e` | 35 / 35 | 3,9 / 3,3 |
| M17 Dachy (moduł dachowy) | `e3edf5ac` / `e3edf5ac` | 56 / 56 | 2,1 / 1,6 |
| M21 Rdzeń (emiter) | `729aa31e` / `729aa31e` | 35 / 35 | 1,6 / 1,7 |

Wszystkie 20 kadrów: układ, liczba obiektów, kamera i liczba losowań identyczne; błędy strony i konsoli 0 / 0.
Sprite’y T3–T6, landmarków, portalu i bajtu: 30 porównanych, 0 różnic (piksel w piksel).
(M09 i M17 oraz M15 i M21 mają te same hashe, bo ich układ powstaje z tego samego szablonu i tego samego seeda testowego —
różnią się tylko wyglądem obiektów.)

## 4. Bramki (P00 w etapie: baza `2f8ab87` vs kandydat, ta sama maszyna)

| Bramka | Dowód | Wynik |
|---|---|---|
| CORE-ENERGY | `v22` 49/49 | PASS |
| CORE-ISOLATION | `px02-isolation` 95/95, `v22` 49/49 | PASS |
| CORE-LOOP | `trace` 7/7, `flow` 35/35, `ftue1` 78/78, `ftue3` 26/26, `leave-run` 22/22, `arena-bots` 8/8, `campaign-bots` 2/2 | PASS |
| CORE-SAVE | `save-safety` 107/107, schemat 13 i klucz bez zmian; `perf1 --equiv`: zapis po rundzie i misjach M01, M59 identyczny z bazą | PASS |
| TOOLS-DEV | `dev-panel` (v23) 66/66 | PASS |
| DEPLOY-PAGES | `check_pages_workflow.py` PASS, `release` 93/93, `release-recovery` 81/81, `.github/`, `index.html`, `style.css` bez zmian | PASS |

## 5. Testy

**Nowy zestaw `node qa/objects2.mjs` — 15/15 PASS:** klasy T1/T2 (tier, promień, wartość, wzrost, liczba, wyglądy) i bramka
pochłaniania bez zmian; źródło 31 pozostałych grafik identyczne z bazą; 15 wyglądów z jednego zestawu; sprite cały, na hitboxie;
jedna geometria (pokrycie sylwetek plansza ↔ duży podgląd najgorzej 0,912, ikona ↔ duży podgląd najgorzej 0,96); jedna kamera
(góra, przód, prawa ściana); brak obrotu w bezczynności (oś fragmentu 0,11°, wcześniej ±20°); malowanie nie rusza `Math.random`,
`game.rng`, układu ani zapisu; cache: 15 sprite’ów, 0,6 Mpx przy 3×, budowa zestawu ok. 10–15 ms, nic nie dochodzi na stojącej
klatce; Arena, Wyzwanie dnia, wyzwanie znajomego, M02/M09/M14/M21 i jakość 0 rysują te same sprite’y; 0 błędów konsoli.
Zestaw sprawdzony mutacjami na kopii: przywrócone kołysanie, odwrócona kamera, ikona z innego wyglądu i zmieniony próg klasy —
każda wywala swoją kontrolę.

**`node qa/run-all.mjs` na kandydacie** (pierwszy pełny start od naprawy składni, patrz §6) — w chwili merge ukończone 30 z 47
zestawów, **1613 PASS, 1 FAIL (zastany na `main`, §6)**: `instructions` 4/4, `boot` 9/9, `bridge` 20/20, `release` 93/93,
`release-recovery` 81/81, `trace` 7/7, `edge-cases` 13/13, `features` 41/41, `visual` 20/20, `design` 29/29, `flow` 35/35,
`arena-bots` 8/8, `campaign-bots` 2/2, `v15` 32/32, `audio` 42/42, `v17` 12/12, `v18` 23/23, `v19` (angielski, zapisy) 16/16,
`v20` 12/12, `v21` 62/62, `v22` 49/49, `dev-panel` 66/66, `save-safety` 107/107, `px02-isolation` 95/95, `ftue1` 78/78,
`leave-run` 22/22, `ftue3` 26/26, `responsive` 525/526, `devices` 75/75, `visual1` 9 PASS (w toku).

**Uruchomione osobno (równolegle, żeby nie czekać na kolejkę):** `content` 11/11 (240 misji: PASS 240, ISSUE 0 — cele, ikona =
obiekt z planszy, odprawa = HUD, EN, przejście botem), `cg-lang1` 50/50 (język w paczce CrazyGames), `crazygames-basic1`
87 PASS / 5 FAIL (te same 5 na bazie, §6; build paczki i jej kontrole treści PASS), `objects2` 15/15.

**`node qa/perf1.mjs --equiv=2f8ab87…` (baza vs kandydat):** skróty stanu gry identyczne we wszystkich 9 scenach (Arena: pierwsza
runda, późna, maks., ramka Poki, jakość 0; misje M01, M59, bossowie 6 i 12) — różnią się wyłącznie piksele (nowe grafiki);
zapis po rundzie (wynik 14123), M01 (47) i M59 (2430) identyczny; menu: Miasto LVL1/LVL6, Dzielnice, Wyzwanie dnia identyczne,
Warsztat inny (podgląd z fragmentem); ekran startowy/hub piksel w piksel, pauza 1,9 % pikseli (plansza pod arkuszem).

**NOT RUN w chwili merge** (kolejka `run-all` jeszcze trwała; właścicielka poleciła przyspieszyć i scalić): `visual1` (reszta),
`visual2` i `objects2` w ramach `run-all` (`objects2` uruchomiony osobno), `balance1`, bramki `perf1` (uruchomione tylko
`--equiv` i `--bench`), `gameready1`, `deviceqa1`, `workshop-buy`, `cg-data1`, `cg-preview-qa1/3/4/5`, `difficulty` (240 misji,
expert + casual), `calibrate`. Zmiana nie dotyka czasu misji, ekonomii ani danych — to uzasadnia kolejność, nie zastępuje wyniku.

**NOT VERIFIED:** prawdziwy iPhone i inne urządzenia (Safari, GPU, DPR 3), czytelność z graczami, działająca paczka w portalu
CrazyGames (testowana lokalnie z atrapą SDK), wygląd w każdej z 240 misji (zrzuty: 9 misji w 5 dzielnicach).

## 6. Problemy zastane na `main` (nie są regresją tej zmiany)

| Problem | Dowód, że zastany | Co zrobiono |
|---|---|---|
| `qa/crazygames-basic1.mjs:910` — `SyntaxError` (apostrof), przez który nie startował ani ten zestaw, ani `run-all` | `node --check` na bazie | naprawione osobnym commitem (`1854e0d`, tylko plik testu, żadna kontrola nie zmieniona) |
| `responsive`: „320x568 campaign: main action not hit (under #btnNavWarsztat)” | ten sam FAIL na bazie (`--only=320x568 --scenes=campaign,briefing`: 18/19 na bazie i na kandydacie) | opisane, nie ruszane (układ ekranu Dzielnic, poza zakresem) |
| `crazygames-basic1`: 4 kontrole blokady kursora (`lock:` ×2, `UI: pause button…`, `step crashed (pointerLockChecks…)`) | te same 4 FAIL na bazie (87 PASS / 5 FAIL po obu stronach) | opisane, nie ruszane |
| `crazygames-basic1`: „hole: all 22 other skins… draw the same pixels as the base” (porównanie z commitem `727b8bd`) | ten sam FAIL na bazie — różnica pochodzi z PERF-06 (wir ze sprite’a), nie z obiektów | opisane, nie ruszane |

## 7. Wydajność (`node qa/perf1.mjs --bench --pair=<baza> --reps=3`, baza i kandydat na przemian, raster programowy)

| Scenariusz (iPhone 13, 390×844 @3) | Klatka mediana ms, baza → kandydat | p95 ms | Klatki > 16,7 ms |
|---|---|---|---|
| Arena, pierwsza runda | 10,8 → 9,4 (−13 %) | 16,8 → 14,4 | 50 → 22 |
| Arena, późna faza | 23,1 → 19,8 (−14 %) | 30,8 → 29,8 | 899 → 809 |
| Arena, wir prawie maks. | 21,7 → 20,5 (−6 %) | 30,6 → 31,1 | 600 → 600 |
| Arena, jakość 0 | 6,3 → 5,9 (−6 %) | 9,1 → 8,4 | 0 → 1 |
| Misja M01 | 5,6 → 5,3 (−5 %) | 9,1 → 9,8 | 0 → 0 |
| Misja z największą liczbą obiektów | 6,7 → 6,5 (−3 %) | 9,9 → 10,1 | 1 → 0 |

`update()` bez zmian (0,1–0,3 ms). Żadnej regresji; zysk bierze się z mniejszych płócien sprite’ów T1/T2 (własne podłoże zamiast
dużej poświaty) i z usunięcia obrotu 170 fragmentów. Wahania p95 (±8 %) mieszczą się w rozrzucie powtórzeń.
Rozmiar wydania: 1 458 068 → 1 472 473 B (+1,0 %), gzip 451 326 → 458 207 B (limit bramki 520 KB).
Liczby bezwzględne zależą od maszyny (raster programowy jest pesymistyczny) — ważne jest porównanie par.

## 8. Ryzyka i ograniczenia

- Odbiór wizualny na prawdziwym iPhonie nie był możliwy w tym środowisku — do sprawdzenia przez właścicielkę (czytelność
  fragmentów r = 7 przy oddalonej kamerze, ostrość przy DPR 3; gra ogranicza DPR płótna do 2, więc sprite’y są malowane w 3×).
- Kapsuła jest w połowie różowa (jak na zatwierdzonym arkuszu), a róż to kolor klasy T2. Klasę T1 nadal niosą cyjanowa połowa,
  rozmiar i minimapa; jeśli w grze okaże się to mylące, wystarczy zmienić proporcję w `VA_ART.kapsula`.
- Złoty Rdzeń zmienił sylwetkę razem z fragmentem (rysuje go ta sama funkcja) — świadomie, ale nie było go na arkuszu.
- Ikony celów są teraz wielobarwne (nie biorą `currentColor`); przy 13 px (wiersz misji) są czytelne jako sylwetka, bez detalu.
- Część `run-all` nie zdążyła się wykonać przed merge (§5) — wyniki do uzupełnienia po zakończeniu kolejki.
- Na `main` pozostają zastane FAIL-e z §6 (układ Dzielnic 320×568, blokada kursora w paczce, stare porównanie wiru).

