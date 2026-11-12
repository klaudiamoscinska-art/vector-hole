# GG-OBJECTS-04 — produkcyjna wymiana grafik T5 i T6 oraz ich landmarków („Premium Vector Objects”)

Baza: `main` @ `1fa266b01800222d2a6ae19269eec78c536e53e5` (PR #96, grafiki T3/T4). Gałąź: `claude/magical-noether-cdbh1h`.
Styl: kontynuacja systemu z GG-OBJECTS-02/-03 (Premium Neon Vector — Style 3). W grze nie ma żadnej bitmapy — wszystko rysuje
Canvas 2D z kształtów wektorowych. Reguły: `docs/GG_OBJECTS_02_ART_RULES.md` §9. Obrazy z gry: `design/objects4/`.
Tryb pracy (polecenie właścicielki): implementacja → krótkie, celowane testy → commit → PR → merge → deploy → verify-live.

## 1. Inwentarz obiektów T5 / T6 (źródło: aktualny kod)

Sprawdzone: `TIERS` (`heavy`, `tower`), `CAMPAIGN_ENTITY_STATS`, `LANDMARK_TIERS`, `LANDMARK_ART`, `CONFIG.campaign.entityRadius` /
`landmarkByTier`, `CampaignEntity.artKind()`, `GOAL_ICONS` / `GOAL_ART_ICONS`, `objectiveIconDef()`. Nic nie zostało przeniesione
między tierami ani dodane.

| `artKind` | Klasa / tier | Promień | Gdzie (przykłady) | Teraz |
|---|---|---|---|---|
| `autobus` | `heavy`, T5 | 76 | Arena, Wyzwanie dnia, wyzwania; misje (M20, M24, M54, M56…) | autobus przodem do widza: tablica kierunkowa, szyba, reflektory, pas okien, drzwi, listwy, koła, agregaty na dachu |
| `tramwaj` | `heavy`, T5 | 76 | Arena, Daily; M44 i misje Tuneli Metra | dwa człony z harmonijką, zaokrąglona szyba, pantograf z różowym ślizgiem, wózki |
| `ciezarowka` | `heavy`, T5 | 76 | Arena, Daily; M38 i inne | kabina, owiewka, żebrowana skrzynia z pasem i lampkami, trzy osie |
| `wiezowiec` | `tower`, T6 | 100 | Arena, Daily; M55 i inne | trzy cofające się bryły ze ścianą kurtynową, hol, maszt z fioletowym światłem |
| `maszt` | `tower`, T6 | 100 | Arena, Daily; M52, M54, M59 | kratownica, dwie platformy, dwie anteny talerzowe, pręt z lampą (nakładka mruga jak dotąd) |
| `kopula` | `tower`, T6 | 100 | M56 i inne (nazwana) | szklana kopuła z żebrami na bębnie z oknami, wejście, latarnia |
| `lm_dzwig` | landmark `dzwig`, T5 | 78 | boss M12 (Port Syntez) | dźwig wieżowy z wysięgnikiem, balastem, kabiną i kontenerem na haku |
| `lm_galeria` | landmark `galeria_glowna`, T5 | 78 | boss M16 (Galeria) | kolumnada na schodach, dzieła, tympanon, szklana piramida |
| `lm_iglica` | landmark `iglica_wejscie`, T5 | 78 | boss M19 (Brama iglicy) | iglica z pawilonem-bramą (srebrna) |
| `lm_iglica` | landmark `iglica`, T6 | 104 | boss M20 (Iglica) | ta sama funkcja w kolorze T6 (zielona) |
| `lm_stacja` | landmark `stacja`, T5 | 78 | boss M90 (Tunele Metra) | hala ze sklepieniem kolebkowym, portal z torami, rondel „M” |
| `lm_bazar` | landmark `bazar_brama`, T5 | 78 | boss M120 (Nocny Bazar) | brama z filarami, podwójny dach z okapami, lampiony |
| `lm_rdzen` | landmark `rdzen_miasta_glowny`, T6 | 104 | boss M24 (Rdzeń) | reaktor, cztery pylony, kryształ w pierścieniu-halo |
| `lm_fabryka` | landmark `fabryka`, T6 | 104 | boss M150 | hala szedowa, kominy z pikselowym dymem, okna-piksele |
| `lm_latarnia` | landmark `latarnia`, T6 | 104 | boss M180 | latarnia morska w pasy, laterna, hologramowe wiązki |
| `lm_drzewo` | landmark `drzewo`, T6 | 104 | boss M210 | wielkie drzewo w donicy, korona z dziesięciu kul, krople światła |
| `lm_serwer` | landmark `serwer`, T6 | 104 | boss M240 (finał) | wieża szaf z diodami, agregat z wentylatorami, chmura danych |

**Iglica:** `iglica_wejscie` (T5) i `iglica` (T6) nadal wskazują wspólne `lm_iglica` — zależność zachowana; różni je kolor tieru
z gry (srebro / zieleń) i promień (78 / 104). Logika, progi i nazwy bez zmian.

**Arkusz referencyjny vs gra:** reaktor, kopuła ochronna, wieża kontrolna, stacja nadawcza, kryształ główny, laboratorium, dworzec,
arena, centrum danych, fabryka T5 z arkusza nie są typami gry — nic nie dodano; ilustracja posłużyła jako wzór materiałów i detalu.

## 2. Co zmieniono

- `game.js`: 16 funkcji w `VA_ART` (stare płaskie wersje usunięte z `OBJECT_ART`; został tylko złoty bajt); pomocnicze `vaHull()`,
  `vaFaces()`, `vaLitGlass()`, `vaWheel()`, `vaSq()`, `vaTq()`, stałe `VA_ICE` / `VA_TEAL`; `VA_BIG` o 16 nazw (sprite 2×).
  `vaKit()`, `vaPalette()`, `vaIconSvg()`, `getObjectSprite()`, `drawObjectArt()`, `drawObjectLive()` — bez zmian.
- Ikony: `GOAL_ART_ICONS` autobus…kopuła i `GOAL_ICONS.heavy` / `.tower` to gettery `vaIconSvg()`; `objectiveIconDef()` daje celowi
  z nazwanym bossem ikonę jego landmarku (13 bossów, także kino i fontanna — uzasadniona obsługa wspólnej ikony landmarku).
  `GOAL_ICONS.landmark` zostaje ikoną klasy. Zaliczanie celów, identyfikatory misji i glyphy bez zmian.
- QA: `qa/objects4.mjs` (nowy, 15 kontroli), `qa/objects4-shots.mjs` (nowy, dowody); `qa/objects2.mjs`, `qa/objects3.mjs` (T5/T6
  nie są już „zamrożone”), `qa/content.mjs` (klucz obiektu bossa = jego identyfikator), `qa/run-all.mjs`, `qa/README.md`.
- Dokumenty: reguły §9, ten raport, `docs/CHANGELOG.md`, `docs/GAME_DESIGN.md`, `docs/claude/ARCHITECTURE.md`; obrazy `design/objects4/`.
- **Bez zmian:** `index.html`, `style.css`, `.github/`, zapis (schemat 13, klucz `vectorHoleSave_v1`), T1–T4, klasy, progi, promienie,
  hitboxy, RNG, układy, boty, kamera, sterowanie, A2.1, Horyzont, efekty pochłaniania, reklamy, CrazyGames.

## 3. Dowody z działającej gry (`design/objects4/`, `node qa/objects4-shots.mjs --root <baza> --publish`)

PRZED = `main` @ `1fa266b`, PO = ta gałąź; ta sama maszyna, seedy, kamera, pozycje i promienie.

| Wymaganie | Pliki |
|---|---|
| Arkusz A — T5/T6 PRZED / PO, duże | `sheet-hero-before.jpg`, `sheet-hero-after.jpg` |
| Arkusz B — rzeczywiste promienie (1 jedn. = 1 px CSS, podłoże A2.1) | `sheet-scale-before.jpg`, `sheet-scale-after.jpg` |
| Arkusz C — komplet T1–T6 (duże + skala planszy) | `sheet-family-after.jpg` (i `-before`) |
| Arkusz D — ikony 66 / 22 / 13 px pod sprite’em z planszy | `sheet-icons-before.png`, `sheet-icons-after.png` |
| Arena późna (wir T5) i oddalona (wir r 150, zoom 0,58, deszcz portali) | `arena-late-*`, `arena-far-*` (telefon, CG, desktop) |
| Wyzwanie dnia 2026-11-11, wyzwanie znajomego | `daily-*`, `challenge-phone-*` |
| Kampania, rozdział I | `m12-port` (dźwig), `m16-galeria`, `m19-dachy` (brama iglicy), `m20-dachy` (iglica), `m24-rdzen` (rdzeń), `m54-dachy` (autobusy + maszty), `m56-rdzen` (ciężkie + kopuła) |
| Kampania, rozdział II | `lm-stacja` (M90), `lm-bazar` (M120), `lm-fabryka` (M150), `lm-latarnia` (M180), `lm-drzewo` (M210), `lm-serwer` (M240), `h-tramwaj` (M44), `h-ciezarowka` (M38) |
| Jakość 0 | `arena-late-gfx0-phone-*`, `m16-galeria-gfx0-phone-*` |

Kadry: telefon 390×844 (DPR 2), CrazyGames 800×450, desktop 1366×768. Fakty: `design/objects4/facts.json`.
**Wszystkie 34 kadry: hash układu, liczba obiektów, liczba losowań `Math.random`, kamera i zoom identyczne PRZED / PO; błędy strony
i konsoli 0 / 0.** 60 sprite’ów T1–T4 (plansza i duże, wszystkie warianty), Złoty Rdzeń i bajt: **0 różnic** piksel w piksel.

**Skala (arkusz B, kadry `arena-far`):** autobus r 76 przy zoomie 0,58 ma na telefonie ok. 80 px wysokości, wieżowiec r 100 ok. 115 px
(pomiar sylwetki × promień × zoom) — bryły, okna i światła pozostają czytelne. Rysunek mieści się w hitboxie: najszerszy dźwig 1,07 r,
najwyższa ciężarówka 1,14 r (`qa/objects4.mjs` O4-4, limit 1,12 / 1,16 r jak dla T1–T4).

## 4. Bramki (P00-CORE w etapie: baza `1fa266b` vs kandydat, ta sama maszyna)

| Bramka | Dowód | Wynik |
|---|---|---|
| CORE-ENERGY | `v22` 49/49 | PASS |
| CORE-ISOLATION | `px02-isolation` 95/95, `v22` 49/49 | PASS |
| CORE-LOOP | `perf1 --equiv`: stan gry identyczny z bazą w 9 scenach (Arena: pierwsza runda, późna, maks., Poki, jakość 0; M01, M59, bossowie 6 i 12); `content --static` 9/9 (240 misji) | PASS |
| CORE-SAVE | `save-safety` 107/107; `perf1 --equiv`: zapis po rundzie (14123), M01 (47), M59 (2430) identyczny; schemat 13 i klucz bez zmian | PASS |
| DEPLOY-PAGES | `.github/`, `index.html`, `style.css` bez zmian; `release` 93/93 (artefakt E3, piny, zapis jednego originu) | PASS |

## 5. Testy (krótki, celowany zestaw — polecenie właścicielki)

`game.js` kandydata: 1 199 044 B (baza 1 165 640 B). Każdy zestaw uruchomiony osobno, logi: `qa/out/gg4/`.

| Zestaw | Wynik | Uwagi |
|---|---|---|
| `objects4` (nowy) | 15/15 PASS | T1–T4 źródło / piksele / ikony = baza; klasy, progi, promienie, landmarki; 16 wyglądów w kicie; sprite’y całe na hitboxie; plansza = podgląd (najgorzej 0,971) = ikona (najgorzej 0,954); ikona na każdy wygląd i każdego bossa; jedna kamera; bez RNG/zapisu; cache; Arena, Daily, wyzwanie, 13 misji obu rozdziałów, jakość 0; 0 błędów konsoli |
| `objects3` | 19/19 PASS | T3/T4 bez zmian (listy „zamrożone” bez T5/T6) |
| `objects2` | 15/15 PASS | T1/T2 bez zmian |
| `content --static` | 9/9 PASS | 240 misji: ikona = obiekt planszy, jedna ikona na obiekt i bossa, odprawa = HUD, EN, postęp +1/+0, 0 błędów |
| `save-safety`, `px02-isolation`, `v22` | 107/107, 95/95, 49/49 PASS | |
| `design`, `v19` (EN), `visual` (A2.1) | 29/29, 16/16, 20/20 PASS | paleta, neutralność płci, angielski, podłoże piksel w piksel |
| `instructions`, `boot`, `bridge` | 4/4, 9/9, 20/20 PASS | |
| `cg-lang1` | 50/50 PASS | paczka CrazyGames: język z SDK, ręczny wybór, EN |
| `release` | 93/93 PASS | złożony artefakt `release/`, `v/<id>/`, zamrożona para root, jeden zapis v13 |
| `perf1 --equiv` | stan identyczny, zapisy identyczne | różnią się tylko piksele scen z T5/T6 (M01 piksel w piksel; menu identyczne) |

**NOT RUN (świadomie, krótki zestaw):** pełny `run-all`, `content` z przejściami botem (240 misji; logika misji, układy i stan gry
identyczne z bazą — `perf1 --equiv`, hash układu we wszystkich kadrach), `balance1`, `difficulty`, `calibrate` (balans nietknięty),
`responsive`, `flow`, `ftue1/3`, `workshop-buy`, `gameready1`, `crazygames-basic1`, `cg-preview-qa*`, `deviceqa1`, `devices`,
`dev-panel`, `cg-data1`, `release-recovery` (`.github/` bez zmian), bramki `perf1` (uruchomione `--equiv` i krótki `--bench` par).
Zastane problemy z GG-OBJECTS-03 (`responsive` 320×568, `workshop-buy` 2 FAIL, 5 FAIL `crazygames-basic1`, chwiejny `gameready1`)
nie były sprawdzane ponownie — dotyczą ekranów i paczki, których ten etap nie zmienia.

**NOT VERIFIED:** prawdziwy iPhone (Safari, GPU, DPR 3) — odbiór właścicielki po publikacji; działająca paczka w portalu CrazyGames;
wygląd w każdej z 240 misji (zrzuty: 15 misji w 7 dzielnicach obu rozdziałów).

## 6. Wydajność

- **Cache:** komplet 17 sprite’ów T5/T6 (z iglicą w dwóch kolorach) to 5,59 Mpx (baza 7,85 Mpx, −29 %): własne podłoże zamiast
  ogólnej poświaty, ciaśniejsze płótno. Klatka to nadal jedno `drawImage` na obiekt; gradienty i poświaty tylko przy malowaniu sprite’a
  (cały komplet ok. 88 ms, raz; pojedynczy duży sprite kilka ms przy pierwszym pojawieniu się).
- **Rozmiar:** `game.js` 1 165 640 → 1 199 044 B; `index.html` + `style.css` + `game.js` gzip ok. 474 KB (limit bramki 520 KB).
- **Pomiar par** (`node qa/perf1.mjs --bench --pair=<baza>`, raster programowy, iPhone 13 390×844 @3, baza i kandydat na przemian):

| Scena | Powt. | p50 baza → kand. (ms) | p95 | p99 |
|---|---|---|---|---|
| Arena późna (85–100 s) | 4 | 27,5 → 27,7 | 38,6 → 40,0 | 44,2 → 49,5 |
| Arena późna (1. pomiar) | 2 | 27,8 → 29,4 | 39,8 → 44,2 | 45,4 → 57,0 |
| Arena maks. (wir r 440) | 2 | 28,2 → 27,7 | 38,1 → 37,3 | 44,7 → 44,2 |
| Boss Rdzenia (dzielnica 6) | 2 | 6,3 → 7,2 | 8,8 → 8,2 | 10,6 → 9,2 |
| Boss finałowy (dzielnica 12) | 2 | 15,2 → 14,2 | 23,5 → 21,0 | 36,2 → 25,0 |

  Mediana klatki bez istotnej zmiany; w późnej Arenie p95/p99 nieco wyżej (jednorazowe malowanie dużych sprite’ów T5/T6, gdy pierwszy raz
  wjeżdżają w kadr), w scenach bossów lepiej. Ocena: brak istotnej regresji; do obserwacji na iPhonie (pierwsze pojawienie się wieżowca).

## 7. Ochrona mechaniki i zapisów

`TIERS`, `CAMPAIGN_ENTITY_STATS`, `LANDMARK_TIERS`, `LANDMARK_ART`, promienie i `landmarkByTier` identyczne z bazą (O4-2); bramka
pochłaniania: T4 nie zje autobusu, T5 zje ciężkie pojazdy, nie wieże, T6 zje wieże. Malowanie nie wywołuje `Math.random`, nie rusza
`game.rng` ani zapisu (O4-7); ten sam seed daje ten sam układ. `perf1 --equiv`: stan gry i zapisy identyczne. Zapis v13, klucz
`vectorHoleSave_v1` bez zmian.

## 8. Ryzyka i ograniczenia

- Odbiór na prawdziwym iPhonie: czytelność T5/T6 przy oddaleniu, kontrast srebra T5 na jasnych działkach, ostrość przy DPR 3
  (sprite’y T3–T6 są 2×), płynność, gdy wieżowce i kopuły pierwszy raz wjeżdżają w kadr.
- Ikony 13 px dużych landmarków (dźwig, galeria) są czytelne jako sylwetka, bez detalu.
- Fontanna (T4, kod nietknięty) zaczyna jedną ścieżkę od `lineTo`; Canvas to toleruje, SVG nie — ikona bossa przywraca `M`
  (`objectiveIconDef()`), sama grafika T4 bez zmian.
- Złoty bajt pozostaje jedynym obiektem w dawnym stylu.
- Część zestawów NOT RUN (§5) zgodnie z poleceniem krótkiej weryfikacji.
