# GG-UX-03 — Final gameplay UX & vortex visual corrections

Baza: `origin/main` = `339ec77d0c9a91a868ed3c7215e172c24f22bff1` (PR #101, GG-UI-02), zweryfikowana przed pracą i przed merge.
Gałąź: `claude/serene-clarke-myqgcb` (wyznaczona dla tej sesji, utworzona od `origin/main`).
Zakres: `game.js`, `index.html`, `style.css` (cztery zatwierdzone zmiany), `qa/` (nowy `qa/ux3.mjs`, dopasowania `ui1`, `ui2`,
`bridge`), dokumentacja, dowody `design/ux3/`. Bez zmian: `.github/`, skrypt wydania, eksport CrazyGames, ekonomia, reguły gry,
`SAVE_SCHEMA_VERSION` (13), klucz `vectorHoleSave_v1`.

Autoryzacja merge: prompt właścicielki GG-UX-03 (§2, §13) — jednorazowa zgoda na PR, zwykły merge commit i wdrożenie po przejściu
krytycznych bramek, bez osobnego odbioru PR przez GPT przed merge (odbiór GPT po wdrożeniu), jak w GG-UI-02. Reguła w `CLAUDE.md`
bez zmian; zgoda dotyczy tylko tego PR.

## 1. Zmiany

| # | Zmiana | Implementacja |
|---|---|---|
| 1 | Dwa tryby dotyku | PRZECIĄGANIE (`legacy`, domyślne, kod bez zmian) i JOYSTICK (`thumbpad`): dynamiczna kotwica w miejscu dotknięcia dowolnej części planszy (usunięte `CONFIG.input.zoneHeightFraction`). Jeden joystick na palec (drugi palec nie przestawia kotwicy — wcześniej przestawiał), panel HUD i minimapa go nie uruchamiają, `Game.releaseThumbpad()` zeruje go przy podniesieniu palca, `touchcancel`, `blur`, pauzie, wznowieniu, zmianie rozmiaru ramki (obrót), starcie rundy / misji i wyborze karty. Etykiety: „Przeciąganie” / „Joystick” (EN „Drag to move” / „Joystick”), kolejność PRZECIĄGANIE | JOYSTICK; podpowiedź „Dotknij planszy i przesuń kciuk…”. |
| 2 | Minimapa po lewej | `minimapRect()` po stronie `settings.minimapSide` (nowe pole w `defaultSave()`, domyślnie `left`; `sanitizeSave()`: wszystko poza `right` → `left`). Profil → Ustawienia → „Położenie minimapy” LEWA \| PRAWA (EN „Minimap position” Left \| Right). Plakietka dzielnicy przy zewnętrznej krawędzi mapy; `body.minimap-left/-right` przenosi podpowiedź i „TERAZ GRA” na drugą stronę. Widoczność (`settings.minimap`) bez zmian. |
| 3 | Finisz bez zaciemnienia | Usunięta warstwa `rgba(0,0,0,0.55)` z `render()`; wariant `blackout` zostaje wewnętrznie (to samo losowanie z ziarna), bez napisu „ZACIEMNIENIE” (baner tylko „WIELKI FINISZ!”, brak plakietki na wyniku). `portal_rain` bez zmian. `drawDarkness()` Kampanii identyczne z bazą. |
| 4 | Lustrzane wiry | Jedna linia w `holeSprite()`: `c.scale(-1, 1)` przed `paintHoleLayer()` — odbijana jest geometria w pamięci podręcznej, potem ten sam obrót `look.spin` w `stampHoleLayer()`. `HOLE_LOOKS`, `drawBody()`, `stampHoleLayer()`, `paintHoleLayer()`, dysk akrecyjny, `look.live`, pochłanianie i cząstki bajt w bajt jak w bazie. Warsztat, rywale i połykane wiry idą tą samą ścieżką. W2 „spójny lej” nie wdrożony. |

Zapis: bez migracji. `legacy` → Przeciąganie, `thumbpad` → Joystick, brak / nieznane → Przeciąganie; `minimapSide` brak / zły →
`left`. Historyczna gałąź migracji v2→v3 (`legacy` → `thumbpad`, tylko zapisy sprzed v3) nietknięta — zmiana migracji wymagałaby
decyzji właścicielki.

## 2. Testy GG-UX-03 (`node qa/ux3.mjs`, 42/42 PASS, także w `run-all`)

**Sterowanie (C, 15):** nowy profil = Przeciąganie, dokładnie dwa przyciski w kolejności PRZECIĄGANIE | JOYSTICK (PL/EN), brak
trzeciego trybu i słów „dolna strefa”; joystick pod palcem (≤ 3 px) u góry, na środku, na dole i w lewym górnym rogu planszy,
dotknięcie = 0 px ruchu, pchnięcie w prawo → ruch w prawo (cos 1,000), w lewo-górę → lewo-góra (cos 1,000) niezależnie od miejsca
kotwicy, puszczenie = sygnał 0 i 0 px dryfu, zanikanie, `pointer-events: none` podstawy i gałki; multitouch (kotwica i wektor
pierwszego palca niezmienione, podniesienie pierwszego zatrzymuje mimo drugiego); `touchcancel`, `blur` (pauza jak dotąd);
dotyk na pasku czasu, rankingu i minimapie nie tworzy joysticka; przycisk pauzy działa, pauza zeruje, dotyk pod arkuszem pauzy nic
nie uruchamia, wznowienie bez ruchu (0 px / 15 klatek, także przy dalej poruszanym starym palcu); obrót 390×844 → 844×390 w trakcie
pchnięcia = brak kotwicy i ruchu; menu Profil przewija się (dotyk nieanulowany, `touch-action: auto`); Przeciąganie jedzie do
palca (cos 1,000), desktop: mysz i klawisze bez zmian, wiersz trybu ukryty; wybór przeżywa przeładowanie; zgodność zapisów.

**Minimapa (M, 10):** domyślnie lewy róg, PRAWA po zmianie (zapis, przeładowanie), LEWA z powrotem, PL/EN, kod kopii zapasowej
niesie stronę; Arena, Wyzwanie dnia, wyzwanie znajomego i Kampania rysują mapę po wybranej stronie; **8 ramek × 2 strony ×
Arena/Kampania**: mapa i plakietka w obszarze bezpiecznym, zero kolizji z pauzą, paskiem czasu, rankingiem, celem, NELA, stosem
płótna, podpowiedzią i „TERAZ GRA”, strzałki krawędzi nigdy na mapie; safe area (notch 47 px, pasek 21 px); misja ciemna (M15)
nadal nie pokazuje żadnego obiektu.

**Finisz (O, 11):** sparowane rundy z ziarnem (audio wyłączone, zamrożony zegar — jak `qa/trace.mjs`), baza vs kandydat:
`blackout` (seed 303) i `portal_rain` (seed 101) — **identyczne** wyniki gracza i rywali, liczba obiektów i portali, liczba
losowań `Math.random` w 20 / 12,5 / 11,5 / 5 / 1 s do końca, ta sama klatka końca (3601), wynik, miejsce, monety. Jasność planszy
w trakcie finiszu względem 12,5 s: kandydat 0,96 / 0,91 / 1,00 (baza 0,42 / 0,41 / 0,47) dla `blackout`, 0,99 / 0,97 / 1,02 dla
`portal_rain`. Baner `blackout`: „WIELKI FINISZ!” bez podtytułu (baza: ZACIEMNIENIE); `portal_rain`: „WIELKI FINISZ!” + BURZA
PORTALI. `CONFIG.overdrive` = 12 s, [blackout, portal_rain], 10 × 15. Ciemność M15 działa, `drawDarkness()` = baza.

**Wiry (V, 6):** statycznie `HOLE_LOOKS` (wszystkie `spin`), `paintHoleLayer`, `stampHoleLayer`, `drawBody`, dysk akrecyjny =
baza; `holeSprite()` różni się wyłącznie `c.scale(-1, 1)`; brak innej ścieżki rysowania. **Piksele:** wszystkie 58 warstw 10
wyglądów (under / inner / flow / rim / crown / ring) = lustrzane odbicie bazy (średnia |różnica| ≤ 2,5/255 wobec do 224 bez
odbicia), te same rozmiary płócien. **Obrót:** każde wywołanie `rotate()` z `Hole.drawBody()` dla 20 wirów (10 skórek jako gracz i
rywal, dwie klatki 1/30 s) identyczne z bazą — kierunki i prędkości bez zmian (warstwa `under`: Horyzont +2,865°/klatkę, Cyjan
+2,101, Gorący Róż +3,629, Toksyczna Zieleń +2,292, Ultrafiolet +1,719, Neonowe Złoto +2,865, Biała Plazma +3,247, Aurora +1,91,
Kryształ +1,528, Pryzmat +2,674; + = zgodnie z ruchem wskazówek zegara).

### Skrętność ramion (V3, `qa/out/ux3/handedness.json`)

Pomiar: kąt wzoru ramion na dwóch promieniach sprite'a × znak `spin`. „Wyprzedzające” = zewnętrzny koniec ramienia z przodu w
kierunku obrotu (wrażenie wyrzucania), „ciągnięte” = z tyłu, jak w odpływie czy galaktyce (wrażenie zasysania).

| | Przed | Po |
|---|---|---|
| Warstwy z mierzalną spiralą (18 z 20) | 15 wyprzedzających, 3 ciągnięte | **16 ciągniętych**, 2 wyprzedzające |

**Gdzie samo odbicie nie poprawia wrażenia zasysania** (zgodnie z §7 promptu — opisane, nic nie zmieniono samowolnie):
- **Cyjan** (`tech`), dysk `under` (spin +1,1): przed ciągnięty, po odbiciu wyprzedzający. Serce `inner` obraca się w przeciwną
  stronę (−1,9) i ma słabo mierzalną spiralę.
- **Neonowe Złoto** (`sun`), serce `inner` (spin +2,7): przed ciągnięte, po odbiciu wyprzedzające; dysk `under` po odbiciu
  ciągnięty.
- Pozostałe: Horyzont `inner` to pierścień fotonowy (bez spirali), Aurora `inner` — pomiar niejednoznaczny (wstęgi).
Poprawa tych dwóch warstw wymagałaby zmiany geometrii lub znaku `spin` jednej warstwy — decyzja właścicielki (np. GG-UX-04).

## 3. Dowody wizualne — `design/ux3/`

Galeria na iPhone: `design/ux3/gallery.html` oraz prywatny artefakt https://claude.ai/artifact/D943sTmWUBXkULDF5JqKSx
(do udostępnienia przez właścicielkę z menu Share). 22 zrzuty + 20 par wirów (10 skórek × gracz/rywal) z animacją 12 klatek
(0,8 s) PRZED / PO i paskiem klatek: joystick środek / góra / dół, panel sterowania PL / EN / PRZED, minimapa lewa / prawa /
320×568 / poziomo / PRZED, ustawienia PL / EN, finisz 11 s i 6 s PRZED / PO (ta sama runda, seed 303), Arena i Kampania na
telefonie, CrazyGames 800×450, Warsztat PO / PRZED. Wszystko z prawdziwego renderera (`tools/ux3-shots.mjs`,
`tools/ux3-gallery.mjs`); jedyny dodatek to biały okrąg palca na zrzutach joysticka.

## 4. Regresja (ta sama maszyna, 4 vCPU, headless Chromium) — `design/ux3/regression.txt`

| Przebieg | Wynik | FAIL |
|---|---|---|
| `run-all` baza `339ec77` | 2475/2477 | `crazygames-basic1` krok blokady kursora (crash), `difficulty` 56% (próg 55%) |
| `run-all` kandydat `cac4f03` | 2515/2519 (+42 ux3) | `bridge` nowe listenery, `ui2 scope`, `gameready1` „PLAY AGAIN” 844×390, `crazygames-basic1` krok blokady |

Wyjaśnienie różnic (każda z dowodem):
- `bridge` (listenery): dwa nowe przyciski LEWA/PRAWA nie były zadeklarowane w `ADDED_SINCE_BASE` → dopisane (`f1680ed`), 20/20.
- `ui2 scope`: statyczna kontrola zakresu GG-UI-02 liczyła każdą późniejszą zmianę `game.js` → przypięta do commitów etapu
  GG-UI-02 (`1395c18..da975e4`), jak `ui1` U11 po GG-UI-02 (`0f49f0e`), PASS.
- `gameready1` „PLAY AGAIN”: wahanie zastane — kandydat 20/21 i 21/21, **baza 21/21, 19/21 (ten sam przycisk), 21/21**.
- `crazygames-basic1` Pointer Lock: identyczne 3 FAIL + crash kroku na bazie i kandydacie, także osobno bez obciążenia —
  zastane w tym środowisku (headless Chromium w kontenerze), nie skutek GG-UX-03.
- `difficulty`: baza 56% (FAIL), kandydat 41% (PASS) — wariancja bota; Arena/Kampania mają identyczne stany (perf1 equiv).
Wszystkie pozostałe 46 zestawów: identyczne liczby PASS/FAIL na bazie i kandydacie (m.in. devices 75, deviceqa1 50, responsive
526, flow 35, ui1 20, ui2 108+1, vfx1 39, visual 20, design 29, cg-lang1 50, save-safety 107, px02 95, release 93, release-recovery
81, instructions 4, v22 49, dev panel 66, MOBILE-PERF-1 25).

### P00-CORE / DEPLOY (bramki etapu z przebiegów baza + kandydat)

| Bramka | Dowód | Baza | Kandydat |
|---|---|---|---|
| CORE-ENERGY | `qa/v22.mjs` | PASS 49/49 | PASS 49/49 |
| CORE-ISOLATION | `qa/px02-isolation.mjs`, `qa/v22.mjs` | PASS 95/95 | PASS 95/95 |
| CORE-LOOP | `flow` 35, `ftue1` 78, `ftue3` 26, `leave-run` 22, `campaign-bots` 2 | PASS | PASS |
| CORE-SAVE | `qa/save-safety.mjs` 107/107, schema 13, nowe pole w `defaultSave()` | PASS | PASS |
| TOOLS-DEV | `qa/dev-panel.mjs` 66/66 (FAIL pakietu do decyzji PX03 bez zmian) | PASS | PASS |
| DEPLOY-PAGES | `check_pages_workflow.py` PASS, `release` 93, `release-recovery` 81 | PASS | PASS |

## 5. Wydajność (raport, nie bramka) — `design/ux3/bench.json`, `qa/out/perf1/equiv.json`

Sparowany bench (`tools/ux3-bench.mjs --reps=5`, baza i kandydat naprzemiennie, mediana; headless, rasteryzacja programowa):

| Scena | render p50 | render p95 | wiry p95 | minimapa p95 |
|---|---|---|---|---|
| Arena iPhone 390×844 @3 | 5,8 → 5,7 ms | 7,9 → 7,3 | 0,7 → 0,7 | 0,2 → 0,2 |
| Arena 320×568 | 3,7 → 3,6 | 5,9 → 5,4 | 0,8 → 0,8 | 0,2 → 0,2 |
| CrazyGames 800×450 | 2,3 → 2,4 | 3,4 → 4,2 | 0,7 → 0,7 | 0,2 → 0,2 |
| Arena późna T6 | 20,6 → 21,6 | 32,5 → 32,4 | 3,0 → 3,0 | 0,2 → 0,2 |
| Intensywne pochłanianie | 24,3 → 23,8 | 36,0 → 32,8 | 1,7 → 1,7 | 0,2 → 0,2 |
| Kampania M05 | 4,8 → 4,7 | 6,3 → 6,3 | 0,2 → 0,2 | 0,2 → 0,1 |
| Jakość 0 / 1 | 2,0 → 2,0 / 3,8 → 3,9 | 3,0 → 2,8 / 5,9 → 5,2 | 0,7 → 0,7 / 0,7 → 0,8 | 0,2 |
| Warsztat (klatka podglądu) | 2,5 → 2,3 | 3,5 → 3,0 | — | — |

Klatki > 16,7 ms: identyczne liczby (T6 / pochłanianie: 300/300 na obu — programowy raster). Odbicie odbywa się raz, przy budowie
sprite'a: ta sama liczba i rozmiary płócien (V2), brak dodatkowej pamięci i pracy na klatkę. `perf1 --equiv=339ec77`: **stan gry
identyczny w 34 punktach kontrolnych 9 scenariuszy** (Arena ×5, misje ×4), piksele różne (odbite wiry, strona minimapy), menu
identyczne poza Warsztatem (odbity podgląd), zapis po rundzie różni się tylko `settings.minimapSide` i podpisem. GPU i fizyczny
iPhone: NOT VERIFIED.

## 6. NOT RUN / NOT VERIFIED

Fizyczny iPhone / Safari / PWA, prawdziwy portal CrazyGames, GPU — NOT VERIFIED (Chromium headless z emulacją dotyku).
Realny wielodotyk na ekranie (testy wysyłają zdarzenia `TouchEvent`), realny `orientationchange` iOS (test: zmiana rozmiaru okna).

## 7. Ryzyka

- Joystick zwalnia się przy każdej zmianie rozmiaru ramki; gdyby przeglądarka zmieniała wysokość w trakcie gry (pasek Safari),
  gracz musi dotknąć ponownie. Plansza ma `touch-action: none`, więc pasek nie powinien się zmieniać w trakcie gry.
- Dotyk zaczynający się na minimapie (lewy dolny róg) nie tworzy joysticka — zgodnie z wymaganiem „nieaktywny obszar HUD”.
- Cyjan i Neonowe Złoto: jedna warstwa po odbiciu wyprzedza obrót (§2) — subiektywna ocena właścicielki na iPhonie.
