# GG-UI-01 / ETAP 2 — Premium Game HUD (hybryda B + A): raport wdrożenia

Baza: `origin/main` = `b337835ea9d28070744e4b49058c86772b1990a8` (GG-VFX-01, PR #99) — bez zmian od
zatwierdzenia projektu. Gałąź: `claude/admiring-thompson-hj1srj`. Wzorzec: GG-UI-01 / ETAP 1
(`claude/glitch-gulp-hud-ui-design-p53yzw` @ `1d9a5d2`), przeniesiony do `design/ui1/stage1/`
(raport, style wariantów, makiety A i B) — gałąź projektowa nie została scalona, `variant.js` nie
trafił do gry.

Zakres: tylko interfejs aktywnej rozgrywki (Arena, Wyzwanie dnia, wyzwanie znajomego, Kampania).
Menu, Dzielnice, Warsztat, sklep, ekrany nagród — nietknięte (GG-UI-02).

## 1. Co się zmieniło względem dotychczasowego HUD

| Element | Było | Jest |
|---|---|---|
| Pauza | koło 36×36, znak tekstowy „❚❚” | 44×44, ikona z dwóch kresek, spokojny materiał |
| Czas · tier · wynik | pasek z etykietami „Czas / Wynik”, pasek tieru 3–5 px, znaczek „T3” 8–9,5 px; na 800×450 rozciągnięty na 550 px | kapsuła: duży zegar i wynik, plakietka tieru w jego kolorze, **drabinka T1–T6** (ukończone pełne, bieżący = rzeczywisty postęp, T6 cała świeci); w poziomie stała szerokość 336 px |
| Ranking | „PUNKTY #3/6” tekstem, wiersze bez hierarchii, cały panel przechwytywał dotyk | plakietka miejsca, wiersz gracza w ramce, korona lidera, paski = udział w wyniku lidera; dotyk bierze tylko nagłówek |
| Wyzwanie dnia | wyglądało jak Arena | własna linia „WYZWANIE DNIA” nad nagłówkiem |
| Cel misji | ikona, opis, licznik | + kod misji, segmenty / pasek postępu, wyróżniony wiersz bossa, zawijanie długich opisów |
| NELA w misji | dymek 176 px nad dolną krawędzią, na środku — potrafił leżeć na wirze | dymek pod zegarem, obok celu; pod wirem przygasa |
| Combo, cel wyzwania, SZAŁ | canvas, stałe piksele ekranu (x 8–16, y 58–200), `shadowBlur`; nie skalowały się z interfejsem | jedna kolumna pod zegarem, skalowana z `uiScale`, w safe-area, nigdy jedno na drugim, bez `shadowBlur` |
| „TERAZ GRA” | pod pauzą — w miejscu combo | lewy dolny róg |
| Baner na środku | omijał tylko panele po prawej | omija też kolumnę pod zegarem albo ją przygasza; długi podtytuł łamie się na dwie linie |
| Mapka | przyciemnione kwadraty, każdy obiekt kwadratem 2 px w pełnym kolorze, ramka 1 px | ulice i kwartały w barwach dzielnic (tło z bufora), hierarchia znaczników, rama w kolorach wiru, plakietka dzielnicy |
| Materiał | `backdrop-filter: blur(4px)` na panelach | bez `backdrop-filter`; gradient + jedna poświata |

Stare reguły HUD zostały usunięte z `style.css` (−463 linie), nowy system to jeden blok na końcu
arkusza (tokeny `--gh-*`). Identyfikatory paneli bez zmian (`#btnPause`, `#hud-tier-strip`,
`#hud-topright`, `#hud-goal`, `#nelaToast`, `#nowPlaying`) — istniejące testy i `fadeHudUnderHole()`
działają na nich jak dotąd.

## 2. Jak połączono B i A

- **Z B (Premium Neon) — panele główne:** płyta z krawędzią cyjan → fiolet → róż i jedną poświatą dla
  kapsuły czasu, rankingu, celu misji i dymka NELA; drabinka T1–T6; plakietka tieru; plakietka
  miejsca; paski wyników; segmenty celów; minimapa (rama, pasy ulic, narożniki kadru kamery, plakietka
  dzielnicy w jej kolorze).
- **Z A (Premium Minimal) — panele drugiego planu:** pauza, combo, cel wyzwania znajomego, licznik
  SZAŁ i „TERAZ GRA” w ciemnym szkle z cienką linią, bez poświaty; kolor tylko tam, gdzie coś znaczy
  (mnożnik combo, złoto celu, zieleń „pobite”).
- **Jeden system:** wspólne tokeny (`--gh-plate`, `--gh-edge`, `--gh-quiet`, `--gh-hair`), wspólna
  siatka stref i odstępów (12 px od krawędzi + safe-area, 6 px między panelami), te same kroje i
  wielkości pisma. Panele główne i pomocnicze różnią się wyłącznie materiałem.
- **Odstępstwa od makiety (świadome):**
  - nagłówek rankingu w Arenie zostaje **„PUNKTY”**, nie „RANKING” — to ustalenie z playtestu 022
    (GDD §2: miejsce = punkty, nie rozmiar) pilnowane przez `qa/deviceqa1.mjs`; tryb nazywa się sam
    tylko w Wyzwaniu dnia;
  - na minimapie nie ma `shadowBlur` na znacznikach (gracz i groźny rywal mają pełną aureolę / kolor
    zamiast rozmycia) — tańsze na klatkę;
  - combo, cel wyzwania i SZAŁ zostały na canvasie (pasek czasu combo zmienia się co klatkę; w DOM
    oznaczałoby to zapis co klatkę).

## 3. Cztery poprawki krytyczne

| # | Poprawka | Rozwiązanie | Test | Wynik |
|---|---|---|---|---|
| 1 | „WYZWANIE DNIA” / „DAILY CHALLENGE” wypychało plakietkę miejsca | tytuł trybu w osobnej linii nad nagłówkiem „PUNKTY #3/6”; panel 142 px (126 px poniżej 350 px szerokości); tekst ≥ 9 px, nic nie jest skracane | `ui1` U5: 84 stany = 7 kadrów (320, 360, 375, 390, 402 px, 800×450, 1366×768) × PL/EN × #1/6, #3/6, #6/6 × krótkie/długie nazwy | **PASS** |
| 2 | „AWANS NA 3. MIEJSCE” na combo (800×450) | baner raz, przy pojawieniu, wybiera: wolny pas obok kolumny pod zegarem (jeśli zostaje ≥ 22 px i ≥ 60% wielkości) albo zostaje na miejscu, a widżety przygasają do 20%; nie przesuwa się w trakcie; czas trwania i logika bez zmian | `ui1` U6: 160 banerów = 10 tekstów (awans, prowadzenie, wzrost tieru, odliczanie, SZAŁ, WIELKI FINISZ, wyzwanie wygrane, złoty rdzeń, strata prowadzenia) × combo ×3 / ×128 z celem znajomego i licznikiem SZAŁ, na 800×450, 640×360, 844×390, 1366×768, 390×844, 320×568 (PL; EN na 800×450 i 640×360) + pauza/wznowienie; osobno zgłoszony kadr (seed 4242, 1:09) | **PASS** |
| 3 | NELA zasłaniała wir (M24) | dymek zadokowany pod zegarem, obok celu; stała pozycja; gdy wir pod niego wjedzie — przygasa jak inne panele; combo schodzi pod dymek; dotknięcie zamyka; teksty, czas, kolejność bez zmian | `ui1` U7: 24 stany = telefony 320–390 px, iPhone 16 Pro z Dynamic Island (pion i poziom), 640×360, 800×450, 844×390, 1366×768, PL/EN, wir mały (r 22) i wielkości T6 (r 150) na środku; 60 klatek bez zmiany pozycji; przygaszanie; dotknięcie | **PASS** |
| 4 | Minimapa i misje z ciemnością | te same dane i ta sama reguła `setup.dark` co w bazie; tło malowane raz do bufora (`CityFloor.hudMinimap()`) | `ui1` U8: M15 (ciemność) na telefonie, 800×450 i desktopie — 0 znaczników obiektów, piksele mapki z wszystkimi obiektami = piksele bez żadnego; przy świetle (tylko test) dokładnie 1 znacznik na żywy obiekt. Arena 320 / 390 / 800×450 / 1366×768: 1 znacznik na obiekt we współrzędnych świata, gracz największy, większy rywal czerwony, 120 klatek bez nowego wpisu w buforze. Kampania: strefa glitcha w miejscu i skali, boss jako znacznik bossa, plakietka dzielnicy | **PASS** |

## 4. Przed / po z prawdziwej gry

Galeria (telefon): `design/ui1/gallery.html` · obrazy `design/ui1/prod/` · wzorce `design/ui1/stage1/shots/`.
Osiem kadrów etapu 1 ustawionych identycznie (seed, wirtualny zegar, ten sam bot) na bazie i
kandydacie — `node qa/ui1-shots.mjs --compare`:

| Scena | Kadr | Czas | Wynik | Tier | Miejsce | Losowania | Świat, kamera, kadr bez HUD |
|---|---|---|---|---|---|---|---|
| s1 Arena, wczesna | 390×844 | 1:47 | 315 | T3 | #1/6 | 4407 | identyczne |
| s2 Arena, późna | 390×844 | 0:17 | 5354 | T6 | #1/6 | 34796 | identyczne |
| s3 Kampania M24 (kod w grze: M60) | 390×844 | 0:29 | 2336 | T6 | — | 8584 | identyczne |
| s4 Wyzwanie dnia | 390×844 | 1:15 | 739 | T5 | #3/6 | 14290 | identyczne |
| s5 CrazyGames Arena | 800×450 | 1:09 | 505 | T4 | #3/6 | 10907 | identyczne |
| s5b CrazyGames Kampania | 800×450 | 0:29 | 2336 | T6 | — | 8584 | identyczne |
| s6 Desktop | 1366×768 | 0:51 | 1463 | T6 | #1/6 | 16490 | identyczne |
| s8 Wyzwanie znajomego | 390×844 | 1:31 | 463 | T4 | #2/6 | 10596 | identyczne |

Liczby są te same co w raporcie etapu 1. „Kadr bez HUD” = zrzut z ukrytym DOM HUD i wyłączonymi
warstwami ekranu (minimapa, kolumna pod zegarem, baner, strzałki krawędziowe — te omijają panele HUD,
więc ich pozycja zależy od układu paneli); SHA-256 równe na bazie i kandydacie we wszystkich 8 scenach.

Dodatkowo (`--extra`): poprawka 1 (EN 320 / 390 / 800×450, PL 320), poprawka 2 (800×450, 640×360,
1366×768), poprawka 3 (wir T6: telefon, 800×450, 320×568), poprawka 4 (M15, mapka 1:1, z porównaniem
przy świetle), telefony 320×568 i 360×800 (Arena, Kampania).

Nagranie dynamicznych stanów HUD: **NOT RUN** (headless z renderowaniem programowym nie daje płynnego
wideo; dynamikę pokrywa `ui1` U6/U7/U9 klatka po klatce).

## 5. Rozdzielczości

`ui1` U4 — 80 stanów kadr × tryb × język, w każdym: combo ×12, SZAŁ, cel znajomego / NELA, „TERAZ GRA”
naraz. Kadry: 320×568, 360×800, 375×667, 390×844, 402×874, 640×360, 800×450, 844×390, 1366×768,
1920×1080, iPhone 16 Pro 402×874 (góra 59, dół 34) i 874×402 (boki 62, dół 21). W każdym stanie: każdy
panel w bezpiecznym obszarze, żadne dwa się nie nakładają (pauza, kapsuła, ranking / cel, NELA, kolumna
pod zegarem, „TERAZ GRA”, podpowiedź, mapka, plakietka dzielnicy), żaden tekst nie jest ucięty, pauza
≥ 44×44, pismo ≥ 9 px. **PASS**.

`ui1` U9 — w trakcie rundy: obrót telefonu tam i z powrotem, zmiana okna przez 360×640, 1024×768,
800×450, jakość 0 / 1 / 2. **PASS**.
`ui1` U10 — dotyk: na siatce 9 px na całym ekranie dotyk biorą tylko pauza, nagłówek rankingu i dymek
NELA; dotknięcie wierszy rankingu trafia w planszę. **PASS**.

Znany problem bazy „responsive: Kampania 320×568” (`main action not hit (under #btnNavWarsztat)`) dotyczy
ekranu **listy Dzielnic** (menu, GG-UI-02), nie HUD — identyczny FAIL na bazie i kandydacie. HUD Kampanii
na 320×568 przechodzi U4 / U7.

## 6. PL / EN

Nowych polskich napisów nie ma (wszystkie istniały: „WYZWANIE DNIA”, „PUNKTY”, „CEL MISJI”, „COMBO”,
„PKT x…”, „WYZWANIE · …”, „POBITE ✓”, „SZAŁ ×2 · … s”, „TERAZ GRA”) — warstwa `I18N_EN` tłumaczy je jak
dotąd. `qa/v19.mjs` 16/16, `qa/cg-lang1.mjs` (język paczki CrazyGames) — sekcja 9. Układ po angielsku:
U4 (EN na każdym kadrze dla Wyzwania dnia i Kampanii, na 320 / 800×450 / 1366×768 dla pozostałych), U5,
U6, U7.

## 7. Minimapa i ciemność

Bez zmian: prostokąt (`minimapRect()`), wielkość (`minimapSize()`: 104 / 92 / 130 px × skala),
współrzędne świata, zakres danych, reguła „większy rywal = czerwony” (`EAT_HOLE_RATIO`), stały kadr
kamery 16 px w Kampanii, blednięcie pod wirem (`hudFade()`), reguła ciemności. Podświetlenie dzielnicy
gracza w Arenie to ta sama informacja co plakietka nad mapką. Wyniki: sekcja 3, poprawka 4.

## 8. Wydajność (baza → kandydat)

`node qa/ui1-bench.mjs --base=<baza>` — każda scena ustawiona identycznie, ta sama zamrożona klatka
rysowana 240 razy przez `render()` gry, baza i kandydat na zmianę w każdym z 3 powtórzeń (mediana z
powtórzeń). Chromium headless, renderowanie programowe: liczby bezwzględne są pesymistyczne, liczy się
para. Zegar strony ma rozdzielczość 0,1 ms.

| Scena | Klatka p50 (ms) | Klatka p95 (ms) | Znaczniki mapki p50 / p95 | Tło mapki: malowanie | DOM HUD p50 / p95 |
|---|---|---|---|---|---|
| Arena wczesna, mały wir (390×844) | 12,4 → 10,7 | 16,6 → 15,1 | 0,3 → 0,3 / 0,5 → 0,6 | 0,3 → 1,1 | 0,8 → 0,9 / 1,1 → 1,2 |
| Arena późna, duży wir, wiele botów | 25,5 → 27,2 | 33,7 → 33,6 | 0,3 → 0,3 / 0,4 → 0,6 | 0,3 → 1,1 | 0,7 → 0,7 / 1,0 → 1,0 |
| Kampania M24 (kilka celów) | 23,3 → 22,2 | 28,5 → 27,1 | 0,1 → 0,1 / 0,2 → 0,2 | 0,3 → 0,7 | 0,4 → 0,4 / 0,7 → 0,7 |
| Wyzwanie dnia | 16,6 → 17,3 | 20,7 → 21,3 | 0,2 → 0,3 / 0,3 → 0,4 | 0,3 → 1,1 | 0,6 → 0,9 / 0,8 → 1,2 |
| CrazyGames 800×450 Arena | 14,9 → 14,6 | 18,4 → 19,0 | 0,2 → 0,3 / 0,3 → 0,4 | 0,2 → 1,1 | 0,5 → 0,8 / 0,8 → 1,0 |
| CrazyGames 800×450 Kampania | 25,1 → 24,9 | 30,5 → 31,4 | 0,1 → 0,1 / 0,2 → 0,3 | 0,2 → 0,9 | 0,2 → 0,5 / 0,4 → 0,8 |
| Desktop 1366×768 | 59,5 → 59,6 | 76,0 → 75,1 | 0,6 → 0,8 / 0,7 → 0,9 | 0,4 → 1,5 | 0,6 → 0,7 / 0,8 → 0,9 |
| Wyzwanie znajomego | 13,8 → 13,6 | 16,5 → 17,2 | 0,2 → 0,3 / 0,4 → 0,5 | 0,2 → 1,1 | 0,7 → 0,8 / 1,0 → 1,1 |
| Arena późna, jakość 0 | 5,3 → 5,7 | 7,8 → 7,4 | 0,2 → 0,3 / 0,3 → 0,6 | 0,2 → 1,1 | 0,7 → 0,7 / 0,9 → 1,1 |
| CrazyGames, jakość 0 | 3,2 → 3,5 | 4,0 → 4,7 | 0,2 → 0,3 / 0,3 → 0,4 | 0,1 → 0,7 | 0,6 → 0,7 / 1,0 → 1,0 |
| Wyzwanie dnia, jakość 0 | 3,6 → 3,8 | 4,3 → 4,4 | 0,2 → 0,3 / 0,3 → 0,5 | 0,2 → 0,6 | 0,7 → 0,8 / 1,1 → 1,3 |

- **Klatka:** na jakości 2 różnice w obie strony (−1,7 … +1,7 ms) — szum pomiaru; na jakości 0
  +0,2 … +0,4 ms. Bez istotnego spowolnienia.
- **Mapka:** znaczniki +0,0 … +0,2 ms na klatkę. Tło maluje się 0,6–1,5 ms **raz** (start rundy, potem
  przy wejściu do innej dzielnicy Areny), z bufora wraca w czasie poniżej rozdzielczości zegara.
- **DOM HUD** (pomiar w najgorszym przypadku: wynik i wzrost zmieniają się w każdej klatce, z wymuszonym
  przeliczeniem układu): +0,0 … +0,3 ms. W zwykłej grze zapis następuje tylko przy zmianie wartości
  (drabinka: całe procenty) — `ui1` U2: 30 kolejnych `updateHUD()` bez zmiany stanu = 0 zapisów do DOM.
- `backdrop-filter` zniknął z paneli HUD; combo nie używa już `shadowBlur`.
- `qa/perf1.mjs`: 25/25 na bazie i kandydacie (sekcja 9).

Safari / iPhone / GPU: **NOT VERIFIED** (nie da się zmierzyć w Chromium headless).

## 9. PASS / FAIL / NOT RUN / NOT VERIFIED

Baza i kandydat na tej samej maszynie (Linux, Chromium headless, renderowanie programowe), pełne logi:
`qa/out/ui1-base/`, `qa/out/ui1-cand-run-all.log`, `qa/out/ui1-rerun/`, `qa/out/ui1-final/`.

### Pełna regresja `node qa/run-all.mjs`

Baza `b337835`: **2339 / 2348**. Kandydat (przed ostatnią drobną optymalizacją mapki): **2357 / 2368**
(+20 testów `ui1`).

| Pozycja | Baza | Kandydat | Ocena |
|---|---|---|---|
| `arena-bots` „low-end quality level renders under 12 ms” | FAIL 12,86 ms | FAIL 13,46 ms | zastany próg maszyny; `visual.mjs` (ten sam pomiar na medianie) PASS na obu: 5,87 → 6,67 ms |
| `responsive` 320×568 campaign (lista Dzielnic) | FAIL | FAIL | zastany, menu (GG-UI-02) |
| `responsive` 2560×1440 hub / hubConsent / challenges | 3 FAIL | 1 FAIL | zastany, menu; niestabilny |
| `workshop-buy` Warsztat na dużym desktopie | 3 FAIL (powtórka: 4) | 4 FAIL (powtórka: 3) | zastany, menu; niestabilny w obie strony |
| `crazygames-basic1` Pointer Lock w headless | FAIL (88/92) | FAIL (88/92) | zastany, identyczny |
| `v18` balans boosterów | PASS (seed 1883911496) | FAIL (seed 1802179680) | losowy seed: baza na seedzie 1802179680 daje **identyczną tabelę** i ten sam FAIL — to nie różnica kodu |
| `visual2` V2-4 (czas malowania kwartału) | PASS | FAIL 1 ms vs 0,8 ms | pomiar czasu zakłócony równoległym zadaniem; powtórka w spokoju: 19/19 PASS |
| `perf1` późna Arena „no hitch” | PASS | FAIL (max 157 ms) | jak wyżej; powtórka w spokoju: 25/25 PASS na obu (max 137 → 136 ms) |

Nowych FAIL-i w obszarze HUD: **0**.

### P00-CORE / DEPLOY (z przebiegów etapu, `docs/claude/SKILLS_PACK.md`)

| Bramka | Dowód | Baza | Kandydat |
|---|---|---|---|
| CORE-ENERGY | `qa/v22.mjs` | 49/49 | 49/49 PASS |
| CORE-ISOLATION | `qa/px02-isolation.mjs`, `qa/v22.mjs` | 95/95 | 95/95 PASS |
| CORE-LOOP | `qa/flow.mjs`, `qa/ftue1.mjs`, `qa/ftue3.mjs`, `qa/leave-run.mjs`, `qa/campaign-bots.mjs` | 35 · 78 · 26 · 22 · 2 | 35/35 · 78/78 · 26/26 · 22/22 · 2/2 PASS |
| CORE-SAVE | `qa/save-safety.mjs`, `SAVE_SCHEMA_VERSION` = 13, brak nowych pól | 107/107 | 107/107 PASS |
| TOOLS-DEV | `qa/dev-panel.mjs` | 66/66 | 66/66 (FAIL pakietu wg PX03 pozostaje decyzją właścicielki) |
| DEPLOY-PAGES | `check_pages_workflow.py`, `qa/release.mjs`, `qa/release-recovery.mjs` | 93/93 · 81/81 | PASS · 93/93 · 81/81 |

GO_CORE: **tak**.

### Zestawy celowane na ostatecznym kodzie

FINAL_TABLE

### NOT RUN / NOT VERIFIED

- Fizyczny iPhone (Safari, PWA z ikony, Dynamic Island, wskaźnik gestów, OLED przy DPR 3): **NOT VERIFIED**
  (safe-area emulowane w Chromium: `ui1` U4 / U7, `qa/devices.mjs`).
- Prawdziwy portal CrazyGames (iframe portalu, Pointer Lock z prawdziwą myszą): **NOT VERIFIED**
  (paczka i makieta SDK: `qa/crazygames-basic1.mjs`, `qa/cg-lang1.mjs`).
- Wydajność Safari / iPhone / GPU: **NOT VERIFIED**.
- Nagranie wideo HUD: **NOT RUN**.
- Ręczne sprawdzenie w przeglądarce przez człowieka: **NOT RUN** (kadry z renderera obejrzane w galerii).

## 10. Gameplay, RNG, SAVE v13

- `ui1` U11: seedowana runda Areny (40 s, 10 573 losowania) i misja M24 kończą się w tym samym stanie
  (każdy wir i obiekt, wynik, kamera, zoom) po tej samej liczbie losowań z HUD rysowanym i wyłączonym.
- `ui1` U11 (zakres): każda zmieniona linia `game.js` względem `b337835` leży w funkcji HUD / mapki /
  układu baneru; 0 nowych wywołań `Math.random`; `SAVE_SCHEMA_VERSION` = 13.
- 8 scen etapu 1: stan, kamera, zoom, wynik, czas, tier, liczba losowań i kadr bez HUD identyczne z bazą.
- `v18` na tym samym seedzie: identyczne wyniki setek prób misji na bazie i kandydacie.
- `qa/save-safety.mjs` 107/107, `qa/px02-isolation.mjs` 95/95, `qa/balance1.mjs` 19/19, `qa/content.mjs`
  11/11 (240 misji), `qa/vfx1.mjs` 39/39, `qa/objects2-4`, `qa/visual2.mjs` — bez zmian względem bazy.
- Nie zmieniono: punktacji, rankingu i sortowania (`rankHoles()`), czasu rundy, progów T1–T6,
  pochłaniania, promieni, sterowania, botów, celów misji, ekonomii, reklam, integracji CrazyGames,
  `.github/`.
- `campaignGoalItems()` dostało pole `boss` (tylko do wyświetlania); `hudSet()` umie przełączać klasę i
  ustawiać własność CSS.

## 11. Pliki

- Gra: `game.js`, `style.css`, `index.html`.
- QA: `qa/ui1.mjs` (nowy), `qa/ui1-shots.mjs`, `qa/ui1-gallery.mjs`, `qa/ui1-bench.mjs`, `qa/run-all.mjs`,
  `qa/README.md`.
- Dokumentacja: `docs/GAME_DESIGN.md` (§5b3 i trzy zdania), `docs/CHANGELOG.md`,
  `docs/claude/ARCHITECTURE.md`, ten raport.
- Dowody: `design/ui1/` (galeria, `prod/`, `stage1/`).

## 12. Otwarte ryzyka

- **iPhone:** krawędzie 1,5 px, gradientowa rama i poświaty na OLED przy DPR 3; realna szerokość kapsuły
  czasu na 375–402 px; dymek NELA pod Dynamic Island — do oceny właścicielki na urządzeniu.
- **Baner „przygaszony”:** na niskich kadrach (640×360) baner zostaje na miejscu, a combo przygasa do
  20% — czytelne, ale to kompromis; alternatywą byłby mniejszy baner.
- **Nagłówek „PUNKTY” zamiast „RANKING”** w Arenie — odstępstwo od makiety opisane w sekcji 2; zmiana to
  jedno słowo, ale wymaga decyzji (playtest 022) i zmiany `qa/deviceqa1.mjs`.
- **Dymek NELA** na telefonie ma ok. 190 px szerokości (3–5 linii) — węższy niż dawny na środku.
- Kod misji w HUD to kod z odprawy (`missionCode()`): misja o id `M24` ma kod `M60`.
- Rollback: commit naprzód przywracający `game.js`, `style.css`, `index.html` z `b337835`
  (`docs/E3_ROLLBACK_PLAN.md`).
