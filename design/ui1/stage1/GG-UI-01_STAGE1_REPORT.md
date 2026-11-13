# GG-UI-01 / ETAP 1 — Premium Game HUD: audyt, dwa kierunki, podglądy

Etap wyłącznie projektowy. `game.js`, `style.css`, `index.html` nie zostały zmienione.
Baza: `main` = `b337835ea9d28070744e4b49058c86772b1990a8` (GG-VFX-01, PR #99).

- Galeria (prywatna, artefakt Claude): https://claude.ai/artifact/SMrKZHVjKTSsS8ZL195zuy
- Galeria w repo: `design/ui1/gallery.html` (otwórz w przeglądarce z tej gałęzi)
- Zrzuty: `design/ui1/shots/` · fakty kadrów: `design/ui1/facts.json`
- Warstwa wariantów (tylko strona testowa): `design/ui1/variants/`
- Narzędzia: `design/ui1/tools/ui1-shots.mjs`, `design/ui1/tools/ui1-gallery.mjs`

## 1. Jak powstały kadry

Każda scena jest ustawiana raz: seedowany `Math.random`, wirtualny zegar, własne
`startRound()` / `startCampaignMission()` / `startDailyChallenge()` gry, prosty bot przez N sekund,
potem pętla staje i ten sam zamrożony kadr jest rysowany przez `render()` / `renderCampaign()` gry
pod trzema warstwami UI. Miasto, obiekty, wiry, kamera, komunikaty na planszy, strzałki i podpisy
wirów są rysowane przez grę i nie są ruszane.

Warstwa A/B:
- czyta wartości, które zapisał HUD gry (czas, wynik, tier, pasek, ranking, cele, NELA) i pokazuje
  je w nowym układzie; oryginalne panele są ukryte stylem CSS;
- podmienia na instancji gry (nie w plikach) cztery widżety rysowane na canvasie: minimapę Areny,
  minimapę Kampanii, licznik combo i cel wyzwania znajomego.

Dane demonstracyjne: brak. Jedyny tekst, którego nie ma dziś w HUD, to nazwa trybu w nagłówku
rankingu (`RANKING` / `WYZWANIE DNIA`), kod misji (`M24`) przy „CEL MISJI” oraz podpis następnego
tieru (`T4`, `MAX`) w wariancie A. Wszystkie wynikają z rzeczywistego stanu kadru.

## 2. Audyt obecnego HUD

| Element | Gdzie i jak dziś | Uwagi |
|---|---|---|
| Pauza | DOM `#btnPause`, koło 36×36, znak tekstowy „❚❚” | poniżej 44 px zalecanych dla dotyku; glif tekstowy zamiast ikony |
| Czas, wynik, tier | DOM `#hud-tier-strip` (wspólny dla Areny i Kampanii), zapisy przez `Game.hudSet()` | na telefonie pasek tieru ma 3 px i znaczek „T3” 8 px; na 800×450 pasek rozciąga się na 550 px szerokości |
| Ranking | DOM `#hud-topright`: podium + wiersz gracza; w `compact` lider i gracz | nagłówek „PUNKTY” nie nazywa trybu; Wyzwanie dnia wygląda identycznie jak Arena |
| Cele misji | DOM `#hud-goal`, wiersze z ikoną, etykietą i licznikiem | brak paska postępu przy celach wieloetapowych; boss odróżnia się tylko ikoną |
| NELA | DOM `#nelaToast`: telefon nad dolną krawędzią, `compact` pod górnym paskiem | na telefonie potrafi leżeć na wirze (scena 3) |
| Minimapa | canvas: `drawMinimap()` / `drawCampaignMinimap()`, tło z `CityFloor.minimap()` | tło to same przyciemnione kwadraty; każdy obiekt jest kwadratem 2 px w pełnym kolorze, więc mapa wygląda jak szum; ostra ramka 1 px |
| Combo, SZAŁ, cel wyzwania | canvas, stałe współrzędne ekranu (x 8–16, y 58–200) | nie skalują się z `--ui-scale`: na desktopie (×1,24) górny pasek kończy się na 64 px, a płytka combo zaczyna na 58 px |
| „Teraz gra” | DOM `.now-playing`, top 58 px, lewa strona | to samo miejsce co płytka combo (poza wąskim telefonem w Kampanii) |
| Komunikaty (awans, wzrost, odliczanie) | canvas `drawJuiceScreen()`, omijają panele po prawej | bez zmian w obu wariantach |
| Znaczniki gracza i rywali, strzałki zagrożenia | canvas, warstwa świata | bez zmian w obu wariantach |
| Ewolucja, WIELKI FINISZ, podpowiedzi | DOM, nakładki | poza zakresem etapu; bez zmian |

Mechanika, którą warianty zachowują: `minimapSize()` (104 / 92 / 130 px × `uiScale`),
`minimapRect()` z marginesem i safe-area, `hudFade()` i `fadeHudUnderHole()` (panel pod wirem
blednie do 0,3), `screenLayout()` (phone / wide / compact), `uiScale` ≥ 1, `env(safe-area-inset-*)`.
Tryby różnią się prawym górnym rogiem (ranking w Arenie, cele w Kampanii) i układem `compact`.

## 3. Wariant A — PREMIUM MINIMAL

- Jeden materiał: prawie czarne szkło (krycie 0,86), linia 1 px, bez poświaty i bez `backdrop-filter`.
- Kapsuła czasu: duże cyfry czasu i wyniku, pod nimi pasek tieru 4 px ze znaczkiem bieżącego i
  następnego tieru.
- Ranking: bez ramek wierszy, „Ty” z cyjanową kreską i jasnym tłem, lider ze złotą koroną.
- Cele: wiersz z cienkim paskiem postępu; kod misji w nagłówku.
- Minimapa: ciemna płyta z zaokrąglonym rogiem, kwartały w barwach dzielnic, bieżąca dzielnica
  jaśniejsza, drobne obiekty jako ciche kropki, ważne jako romby.
- Kolor tylko znaczący: barwa tieru, złoto wyniku i lidera, cyjan gracza, róż końca czasu.

## 4. Wariant B — PREMIUM NEON

- Płyta z górnym światłem i krawędzią cyjan → fiolet → róż (kolory wiru), jedna miękka poświata.
- Tier jako drabinka sześciu stopni T1–T6: ukończone pełne, bieżący się wypełnia; znaczek tieru
  jako pełna plakietka w kolorze tieru.
- Ranking: plakietka miejsca, paski wyniku w tle wierszy (odległość do lidera widać bez czytania
  liczb), wiersz gracza z cyjanową obwódką.
- Cele: segmenty zamiast paska (3 węzły = 3 segmenty), złoty nagłówek.
- Minimapa: rama w kolorach wiru, pasy ruchu na ulicach, ramka kamery jako narożniki, gracz z
  pierścieniem, groźny rywal z czerwoną poświatą, nazwa dzielnicy na plakietce w jej kolorze.
- Akcenty ruchome planowane w grze (nie widać ich na zrzucie): połysk na wypełnianym stopniu tieru
  i puls zegara w ostatnich 10 s; oba wyłączone przy `prefers-reduced-motion`.

Wspólne dla A i B: te same strefy co dziś, pauza 44×44, kapsuła czasu o stałej szerokości na
kadrach poziomych, „teraz gra” w lewym dolnym rogu (koniec kolizji z combo), combo i wyzwanie
znajomego w tym samym materiale co reszta.

## 5. Minimapa

Bez zmian: prostokąt, wielkość, współrzędne, zakres danych (każdy obiekt, każdy rywal, gracz,
ramka kamery, strefy glitch, nazwa dzielnicy), reguła „większy rywal = czerwony”, ukrywanie
obiektów w misji z zaciemnieniem, blednięcie pod wirem.
Nowe: prawdziwa siatka ulic (`CITY_PITCH` 375, `CITY_ROAD` 64) i mapa dzielnic
(`CITY_DISTRICT_MAP`), podświetlenie dzielnicy, w której jest gracz (ta sama informacja co podpis),
hierarchia znaczników, zaokrąglona rama. Boss misji ma romb z otworem; pozycja była widoczna i dziś.

## 6. Sceny i kontrola identyczności

Kontrola: po każdej warstwie wszystkie warstwy UI są wyłączane i zrzut samego kadru jest
haszowany (SHA-256). Trzy hasze muszą być równe, a licznik losowań, zegar i wynik nie mogą się
zmienić między warstwami.

| Scena | Kadr | Seed / misja | Czas | Wynik | Tier | Miejsce | Panele HUD % ekranu (przed / A / B) | Kadr | SHA-256 kadru | Hasz stanu | Losowania |
|---|---|---|---|---|---|---|---|---|---|---|---|
| s1 Arena, wczesna | 390×844 | 4242 | 1:47 | 315 | T3 60,7% | #1/6 | 9,22 / 8,62 / 8,84 | PASS | cbc1764c282f | bcab44eb | 4407 |
| s2 Arena, późna | 390×844 | 4242 | 0:17 | 5354 | T6 100% | #1/6 | 9,44 / 8,65 / 8,87 | PASS | 8259b31aa283 | 6e0a8aa | 34796 |
| s3 Kampania M24 | 390×844 | M24 | 0:29 | 2336 | T6 100% | — | 14,05 / 15,10 / 15,15 | PASS | 4806e3209945 | d69be74e | 8584 |
| s4 Wyzwanie dnia | 390×844 | 1162589281 | 1:15 | 739 | T5 47,5% | #3/6 | 6,33 / 6,93 / 7,15 | PASS | d99b72d33f62 | 1cfdf5b5 | 14290 |
| s5 CrazyGames Arena | 800×450 | 4242 | 1:09 | 505 | T4 82% | #3/6 | 12,74 / 9,64 / 9,88 | PASS | bf0261223805 | a67650d2 | 10907 |
| s5b CrazyGames Kampania | 800×450 | M24 | 0:29 | 2336 | T6 100% | — | 10,48 / 9,70 / 9,76 | PASS | 789e4c41d686 | d69be74e | 8584 |
| s6 Desktop | 1366×768 | 4242 | 0:51 | 1463 | T6 100% | #1/6 | 6,02 / 4,92 / 5,05 | PASS | 405bfd23a265 | d7ee311b | 16490 |
| s8 Wyzwanie znajomego | 390×844 | 777 | 1:31 | 463 | T4 54% | #2/6 | 11,23 / 11,20 / 11,41 | PASS | dacd5e5d7539 | e33f669 | 10596 |

Scena 7 (minimapa w powiększeniu i 1:1) to wycinki scen s1, s2, s3, s5:
`shots/<scena>-minimap-{before,a,b}.png`.
Pełne hasze i pozycje paneli: `facts.json`. Minimapa nie wchodzi do procentu paneli, bo jej
prostokąt jest identyczny we wszystkich warstwach.

Uwagi do liczb: na telefonie w Kampanii i w Wyzwaniu dnia A/B zajmują o ok. 1 punkt procentowy
więcej niż dziś (pauza 44 zamiast 36 px, kapsuła 44 zamiast 35 px, pasek postępu celu). Na
CrazyGames i desktopie zajmują mniej.

## 7. Ocena

| Kryterium | A Minimal | B Neon |
|---|---|---|
| Jakość wizualna | czysta, dojrzała; mniej „gry” | wyraźnie premium, pasuje do wirów i VFX |
| Czytelność | bardzo dobra; pasek tieru prosty | bardzo dobra; drabinka lepiej pokazuje, ile zostało do T6 |
| Miejsce | jak B (różnica do 0,3 p.p.) | jak A |
| Spójność z GLITCH GULP | dobra, ale chłodniejsza od planszy | najlepsza: paleta i krawędź z asset bible |
| Różnica względem dziś | umiarkowana | duża |
| Wdrożenie | najprostsze: CSS + drobne zmiany znaczników | średnie: dodatkowo drabinka, paski rankingu, segmenty celów |
| Ryzyko na telefonie | niskie | niskie do średniego: cienkie gradientowe krawędzie i poświaty trzeba sprawdzić na prawdziwym iPhonie |
| Koszt wydajności | pomijalny | niski: statyczne cienie CSS, bez `backdrop-filter`; minimapa wymaga cache tła |

## 8. Rekomendacja

Hybryda na bazie B.
- Z B: materiał paneli, drabinka tieru, ranking z paskami wyniku, segmenty celów, minimapa.
- Z A: spokojne panele drugiego planu (combo, wyzwanie znajomego, „teraz gra”) i zasada jednej
  poświaty na panel, żeby neon nie konkurował z planszą.
- Jeśli priorytetem jest najmniejsze ryzyko i najkrótszy etap 2: sam A.

## 9. Proponowane zmiany techniczne (do etapu 2, po decyzji)

1. `style.css`: nowe reguły paneli HUD w tokenach `--nc-*`; usunięcie `backdrop-filter` z `.hud-panel`.
2. `index.html`: pauza jako ikona (bez glifu tekstowego), znaczniki drabinki tieru, nagłówek rankingu.
3. `game.js` `setTierBadge()`: zapis stopni drabinki przez `hudSet()` (tylko przy zmianie wartości).
4. `game.js` `updateHUD()`: `--p` wiersza rankingu, nazwa trybu w nagłówku; nowe teksty z wpisami `I18N_EN`.
5. `game.js` `updateCampaignHUD()`: pasek / segmenty celu, kod misji.
6. `CityFloor.minimap()`: tło z ulicami i dzielnicami rysowane raz do cache (jak dziś);
   `drawMinimap()` / `drawCampaignMinimap()` / `drawMinimapHoles()` / `drawMinimapLabel()`: nowe znaczniki i rama.
   `minimapSize()`, `minimapRect()`, `hudFade()` bez zmian.
7. Combo, cel wyzwania, pasek SZAŁ: nowy materiał i mnożenie współrzędnych przez `uiScale`
   (naprawa nachodzenia na desktopie).
8. `.now-playing`: lewy dolny róg.
9. `fadeHudUnderHole()` i `drawJuiceScreen()` czytają pudełka paneli po identyfikatorach — przy
   zachowaniu identyfikatorów działają bez zmian.
10. QA: `qa/responsive.mjs`, `qa/flow.mjs`, `qa/visual.mjs`, `qa/design.mjs`, `qa/v19.mjs`, `qa/perf1.mjs`;
    nowy zestaw dla HUD (pudełka paneli na każdym kadrze, brak nachodzenia, 44 px pauzy).

Bez zmian: mechanika, balans, RNG, zapis, zakres danych minimapy.

## 10. Ryzyka

- iPhone: krawędzie 1–1,5 px i poświaty wyglądają inaczej na ekranie OLED przy DPR 3; zrzuty są z
  Chromium przy DPR 2. Dynamic Island i pasek domowy obsługuje istniejące safe-area, ale wymaga
  potwierdzenia na urządzeniu. Na telefonie 360 px kapsuła czasu ma ok. 138 px — nie sprawdzono.
- CrazyGames 800×450: kapsuła ma 336 px zamiast 550 px; komunikaty na środku nadal mogą nachodzić
  na płytkę combo (tak jest i dziś, scena s5).
- Desktop: przy `uiScale` do 1,6 widżety canvas muszą dostać tę samą skalę co DOM.
- Wydajność: minimapa rysuje więcej kształtów na klatkę (łuki zamiast kwadratów); potrzebny
  pomiar `qa/perf1.mjs` względem bazy na tej samej maszynie.
- Tekst: dłuższe nazwy w wersji angielskiej (np. „DAILY CHALLENGE”) w nagłówku rankingu 142 px.

## 11. Co sprawdzono, a czego nie

| Kontrola | Wynik |
|---|---|
| Identyczność kadru PRZED / A / B, 8 scen | PASS 8/8 |
| Błędy konsoli podczas zrzutów | PASS (0) |
| `node qa/instructions.mjs` | PASS 4/4 |
| Pliki gry bez zmian (`git status`: tylko `design/ui1/`) | PASS |
| Galeria na 390 px: brak poziomego przewijania, przełącznik działa | PASS |
| `node qa/run-all.mjs` | NOT RUN (pliki gry bez zmian) |
| Prawdziwy iPhone / Safari | NOT VERIFIED |
| Wydajność wariantów | NOT RUN (makieta, nie implementacja) |
| Wersja angielska, tryb ciemnej misji, SZAŁ, ostatnie 10 s, telefon 360 px | NOT VERIFIED |
| P00 | nie dotyczy (etap bez zmian w grze) |

## 12. Odtworzenie

```bash
node design/ui1/tools/ui1-shots.mjs      # zrzuty + facts.json, exit 1 gdy kadry się różnią
node design/ui1/tools/ui1-gallery.mjs    # gallery.html
```

GG-UI-01 ETAP 1 — READY FOR OWNER & GPT ART REVIEW
