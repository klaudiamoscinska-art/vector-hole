# MOBILE-PERF-1 — wydajność, stabilność i ładowanie (raport)

Baza: produkcyjny `main` `aa4bc7dd0a743987eba04eb2c2f00734da63e626` (PR #83, BALANCE-1).
Gałąź: `mobile-perf1-optimization`. Zapis nadal `SAVE_SCHEMA_VERSION = 13`, bez migracji.
Narzędzie: `qa/perf1.mjs` (bramki w `run-all` + tryby raportu `--bench --pair`, `--compare`, `--equiv`, `--profile`, `--gpu`).

## Werdykt: **PR GOTOWY DO ODBIORU** (bez merge i deploymentu przed odbiorem GPT i decyzją właścicielki)

> **Aktualizacja statusu (DOCS-1, 2026-10-29):** po odbiorze GPT i jawnej zgodzie właścicielki PR #84 scalono 2026-10-29 (merge `9f92a2df53492030a7c12c6127a08df0c25eff59`); wdrożenie ma status `success` (GitHub API), żywy `index.html` ładuje `v/9f92a2df5349/`. Lista z §9 na fizycznych urządzeniach — nadal do wykonania (DEVICE-QA). Reszta raportu to stan z chwili otwarcia PR.

1. **Rzeczywiste problemy:** animacja blasku przycisków robiła layout całego ekranu co
   klatkę (menu i **arkusz pauzy**), pasek Miasta przemalowywał się co klatkę, Miasto
   liczyło co klatkę ~3000 sinusów i parsowało kolory, Arena liczyła `Math.hypot` dla
   każdej pary wir–obiekt; **błąd**: obrót/resize na pauzie zostawiał czarną planszę.
2. **Naprawiono:** animacje przez kompozytor (ta sama droga i czas), dane okien Miasta
   raz na rozmiar, pamięć kolorów, dokładny filtr przed `Math.hypot`, odrysowanie
   zamrożonej planszy po zmianie rozmiaru na pauzie.
3. **Poprawa (sparowane pomiary):** layouty w bezczynności −95…−100% (Miasto, Wyzwania,
   Profil, pauza, ukryta karta), skrypt Miasta −20…−35%, CPU na pauzie −30…−40%.
   **Rundy i misje: bez zmiany** (koszt = rasteryzacja tych samych pikseli; logika już
   była tania) — tu nie obiecuję zysku.
4. **Pogorszenia:** brak potwierdzonych. Rozmiar wydania +0,4% gzip (komentarze, nowe
   funkcje). CPU Miasta na prawdziwym GPU — bez rozstrzygającej zmiany (6 par, ±10 pp).
5. **Pełne QA:** `run-all` 1704/1709; 5 FAIL = 1 brak pliku raportu w chwili startu (po
   dodaniu 4/4 PASS) + 4 zastane, potwierdzone na bazie lub znane (§6); `perf1` 25/25;
   kluczowe zestawy powtórzone na końcowym HEAD — PASS (§6).
6. **SAVE i mechanika:** SAVE v13 bez zmian; Arena, Kampania (M01, M59, bossowie), menu —
   identyczne skróty stanu i pikseli; zapis po rundzie i misjach identyczny bit w bit.
7. **PR, HEAD, baza:** gałąź `mobile-perf1-optimization`, PR do `main` (numer i końcowy SHA
   w opisie PR i HANDOFF); baza `aa4bc7d`.
8. **Ryzyka i NOT RUN:** §8 (Safari/iPhone fizyczne, GPU-czas, 120 Hz — NOT RUN /
   NOT MEASURABLE).
9. **Lista kontrolna urządzeń:** §9.
10. **Następny krok:** §10.

## 1. Metoda i ograniczenia

- **Maszyna:** laptop Windows 11, Intel Iris Xe, Node 22.23.4, Playwright Chromium 156.
  Przez całą sesję laptop pracował **na baterii** (tryb oszczędzania energii): bezwzględne
  czasy z różnych godzin różnią się nawet kilkukrotnie (np. scena „wir maks.” 23 ms → 119 ms
  na klatkę między dwoma przebiegami tej samej bazy). Dlatego tabela PRZED/PO pochodzi
  wyłącznie z **przebiegu sparowanego** (`--bench --pair`): baza i kandydat mierzone na
  zmianę w każdym powtórzeniu, ten sam viewport, ziarno, scenariusz.
- **Dwa tryby rasteryzacji:** domyślny headless = SwiftShader (rasteryzacja programowa —
  najgorszy przypadek, urządzenie bez akceleracji płótna); `--gpu` = pełny Chromium w nowym
  trybie headless na prawdziwym GPU (Iris Xe, D3D11). Pomiar wirtualny (`update()`,
  `render()` + wymuszona rasteryzacja 1 px `getImageData`) oddziela koszt logiki od
  rysowania; pomiar w czasie rzeczywistym (własna pętla RAF gry, autopilot) daje odstępy
  RAF, długie klatki, liczniki Blinka (layout, styl, skrypt, zajętość CPU).
- **Słabsze urządzenie:** emulowane spowolnieniem CPU 4× (CDP). W trybie GPU taki pomiar jest
  bardzo zaszumiony (proces GPU nie jest spowalniany) — traktowany jako orientacyjny.
- **NOT MEASURABLE tutaj:** czas GPU na klatkę, pamięć GPU, zachowanie Safari/WebKit i
  fizycznych iPhone'ów (Chromium ≠ Safari; emulacja viewportu ≠ urządzenie), rzeczywista
  częstotliwość odświeżania 120 Hz (headless taktuje RAF stałym zegarem), opóźnienie
  wejścia na dotyku. Pamięć JS mierzona przez CDP po wymuszonym GC (wiarygodna);
  `performance.memory` nieużywane.

## 2. Co było rzeczywistym problemem (audyt A–D, dowody)

Profilowanie (CPU profiler CDP, próbkowanie alokacji, trace timeline Blinka, rozbicie
renderu na sekcje z rasteryzacją po każdej) na bazie `aa4bc7d`:

1. **Menu i pauza pracowały bez przerwy (największy realny problem).** Na Mieście w
   bezczynności wątek główny był zajęty ~20–40% czasu (GPU, 1× CPU). Rozbicie po
   animacjach (każda uruchomiona osobno): `v8-cta-breathe` (box-shadow) ~10,5%,
   `hub-bar-flow` (background-position) ~6,7%, `unlock-shimmer` ~5,3%, `v8-shine` (`left`)
   ~4,2% + **layout co klatkę**, `v8-chest-glow` ~3,3%; animacje na `transform` ~0%.
   `v8-shine` (blask każdego przycisku głównego) animował `left`, więc layout i repaint
   ekranu szły co klatkę na Mieście, Wyzwaniach, Profilu, wynikach i **na arkuszu pauzy**
   (~65 layoutów na 2,5 s przy zatrzymanej rundzie), a w każdej klatce płócien menu
   `prepCanvas()` czytał `clientWidth` po unieważnionym layoucie (wymuszony layout w JS:
   `prepCanvas` 103 ms własnego czasu na 4 s profilu Miasta).
2. **Miasto (Core City) liczyło w każdej klatce to, co się nie zmienia:** dalekie okna
   panoramy (~3000 sinusów/klatkę) oraz dla każdego okna budynku 3 sinusy i
   `shadeColor()` (parsowanie hex) — `drawCityBuilding` 101 ms + `hexToRgb`/`shadeColor`
   29 ms własnego czasu na 4 s.
3. **Arena: `handleObjectEating()`** liczyło `Math.hypot` dla ~300 obiektów × każdy wir
   × każda klatka; `Math.hypot` nie jest inline'owany przez V8 i pudełkuje liczby —
   największe źródło alokacji w rundzie (~66 KB/klatkę z ~577 KB/klatkę w scenie
   z maksymalnym wirem).
4. **Błąd (zastany w produkcji): obrót telefonu / zmiana rozmiaru okna na arkuszu pauzy**
   czyściły płótno (zmiana rozmiaru bitmapy), a pętla wstrzymanej rundy stoi — pod arkuszem
   zostawała czarna plansza do wznowienia (`lit: 0` w `qa/perf1.mjs`).

Co **nie** okazało się problemem (zmierzone, bez zmian w kodzie):
- logika gry jest tania: `update()` mediana 0,1–0,3 ms, p99 < 1 ms nawet przy
  maksymalnym wirze; boty decydują co kilkaset ms;
- HUD w rundzie: ~7 zapisów DOM/s (tabela wyników ~4/s) — `hudSet()` pisze tylko zmiany;
  layout+styl ≈ 4% czasu w rundzie;
- podłoga miasta ma budżet malowania kawałków i prefetch; malowanie kawałków ≈ 2 ms
  rzadko; ładowanie: 3 pliki, 0 żądań zewnętrznych, menu gotowe po ~0,2 s lokalnie;
- długa sesja (12 cykli: runda, misja, 9 zakładek, 6 zmian rozmiaru, przełączenie karty):
  sterta po GC wypłaszcza się ~5,4–5,5 MB, listenery stałe (174), 1 interwał, 1 pętla RAF,
  węzły DOM falują ±100 zależnie od misji — **bez wycieków, w bazie i kandydacie**;
- koszt rysowania w rundzie to głównie rasteryzacja (duże wiry z gradientami i
  `shadowBlur`, sprite'y obiektów, podłoga) — jej obniżenie wymagałoby zmiany wyglądu
  (poza zakresem bez zgody; patrz §8).

## 3. Co naprawiono

| Zmiana | Plik | Przyczyna źródłowa → poprawka |
|---|---|---|
| `v8-shine` przez `transform` | `style.css` | `left: -60% → 130%` → `translateX(0 → 475%) skewX(-20deg)` (475% szerokości smugi = 190% szerokości przycisku): ta sama droga i czas, kompozytor zamiast layoutu co klatkę. `prefers-reduced-motion` bez zmian. |
| `hub-bar-flow` przez `transform` | `style.css` | gradient na pseudo-elemencie 4× szerszym, przesuwanym `translateX(0 → 50%)` (jedna płytka 2× szerokości paska na 3 s) zamiast `background-position 0 → -200%`. |
| Okna Miasta raz na rozmiar | `game.js` `drawCityScene()`, `cityWindowGrid()` | lista dalekich okien i statyczne dane okien budynków (faza, sin, kolor, jasność) liczone raz na rozmiar obrazu; w klatce zostaje tylko migotanie zależne od czasu. |
| Pamięć `hexToRgb()`/`shadeColor()` | `game.js` | wyniki zapamiętane (ograniczone 512/64 wpisy), te same łańcuchy. |
| Filtr przed `Math.hypot` | `game.js` `handleObjectEating()` | gdy odstęp na jednej osi ≥ zasięgu (a dla gracza też ≥ zewnętrznej granicy `edgeReach()`), kęs jest niemożliwy (odległość ≥ każdy odstęp osiowy) — pomijamy `Math.hypot`; wynik testu identyczny. |
| Poprawka czarnej planszy | `game.js` `resize()` | wstrzymana runda po zmianie rozmiaru rysuje raz zamrożoną planszę (bez `update()`). |

Nie zmieniono: SAVE (v13, klucz, slot), ekonomii, cen, nagród, balansu, 240 misji, fizyki,
zasięgów, AI, czasu rund, efektów, liczby obiektów/botów, rozdzielczości, `GFX_LEVELS`,
systemu wydań, workflow, panelu TEST, zakupów. Bez nowych zależności.

## 4. Pomiary PRZED/PO (sparowane)

Pełne tabele: `qa/out/perf1/compare-base-vs-cand.md` (software, 3 powtórzenia),
`compare-base-gpu-vs-cand-gpu.md` (GPU, 2 powtórzenia), logi `paired-sw.log`,
`paired-gpu.log`, kontrole `rtmax-sw.log`, `idle-gpu.log`, `hubexp.log`.
Wartości = mediana powtórzeń (w nawiasie rozrzut tam, gdzie istotny).

### 4.1 Menu, pauza, ukryta karta — bezczynność (czas rzeczywisty, telefon 390×844)

| Ekran | Metryka | Baza | Kandydat | Różnica |
|---|---|---|---|---|
| Miasto (Core City LVL6) | layouty / 2,5 s (software · GPU) | 67 · 63–75 | 3 · 3 | **−95%** |
| Miasto | skrypt ms / 2,5 s (software · GPU) | 122 · 139–150 | 96 · 96–116 | **−20…−35%** |
| Miasto | CPU zajęty % (GPU, 6 par) | 13–32 | 12–36 | bez rozstrzygającej zmiany (3 pary lepiej, 3 gorzej; rozrzut ±10 pp, bateria) |
| Miasto | klatki RAF / 3 s (GPU, `hubexp`) | 157 (127–170) | 169 (155–172) | w granicach szumu |
| Wyzwania | layouty / 2,5 s | 62–67 | 3 | **−95%** |
| Profil | layouty / 2,5 s | 61–65 | 0 | **−100%** |
| Pauza | layouty / 2,5 s | 48–65 | 0 | **−100%** |
| Pauza | CPU zajęty % (software · GPU) | 4,2 · 2,7 | 2,5 · 1,9 | **−40% · −30%** |
| Ukryta karta (runda na pauzie) | layouty / 2,5 s | 52–55 | 0 | **−100%** |
| Dzielnice / Warsztat | layouty, CPU | 0 / bez zmian | 0 / bez zmian | 0 |

Na Mieście dalej działają animacje malujące co klatkę (`box-shadow` przycisku GRAJ i
skrzynki, gradient napisu) — świadomie nieruszone (§8), dlatego CPU Miasta na GPU nie
spadło rozstrzygająco, mimo że zniknął layout i ~¼ skryptu.

### 4.2 Sceny gry (czas wirtualny, update + render + rasteryzacja software, 3 powtórzenia)

| Scena | Urządzenie | klatka p50 baza → kand. (ms) | p95 | p99 | update() p50 | piksele+stan |
|---|---|---|---|---|---|---|
| Arena — 1. runda | iPhone 13 | 13,3 → 13,2 | 19,2 → 22,2 | 23,3 → 27,4 | 0,2 → 0,2 | identyczne |
| Arena — późna faza | iPhone 13 | 26,0 → 26,5 | 35,9 → 36,8 | 39,6 → 41,3 | 0,3 → 0,2 | identyczne |
| Arena — wir maks. | iPhone 13 | 26,7 → 27,3 | 33,4 → 32,7 | 39,5 → 36,7 | 0,2 → 0,2 | identyczne |
| Arena — wir maks. | laptop 1366×768 | 33,4 → 33,4 | 38,6 → 39,1 | 43,3 → 42,8 | 0,3 → 0,3 | identyczne |
| Arena — ramka Poki | 836×470 | 8,0 → 8,5 | 11,5 → 11,8 | 14,4 → 16,3 | 0,2 → 0,2 | identyczne |
| Arena — gfx0 | iPhone 13 | 8,8 → 9,0 | 11,8 → 11,8 | 14,4 → 14,6 | 0,2 → 0,2 | identyczne |
| M01 | iPhone 13 | 6,8 → 6,8 | 12,9 → 12,2 | 14,1 → 13,2 | 0,1 → 0,1 | identyczne |
| M59 (duży wir) | iPhone 13 | 14,0 → 14,4 | 21,0 → 21,0 | 25,2 → 24,1 | 0,1 → 0,1 | identyczne |
| misja najgęstsza | iPhone 13 | 8,7 → 8,6 | 11,3 → 12,9 | 15,2 → 15,4 | 0,1 → 0,1 | identyczne |
| boss Rdzenia | iPhone 13 | 7,0 → 7,0 | 9,2 → 9,2 | 10,2 → 10,3 | 0,1 → 0,1 | identyczne |
| boss finałowy | iPhone 13 | 17,5 → 17,6 | 22,3 → 23,0 | 26,3 → 27,4 | 0,1 → 0,1 | identyczne |
| późny rozdział | iPhone 13 | 11,8 → 12,0 | 14,3 → 14,6 | 17,6 → 17,1 | 0,1 → 0,1 | identyczne |
| Miasto LVL1 (płótno) | iPhone 13 | 9,9 → 9,8 | 23,2 → 12,2 | 24,6 → 13,3 | — | identyczne |
| Miasto LVL6 (płótno) | iPhone 13 | 18,3 → 18,4 | 24,6 → 23,2 | 28,3 → 27,3 | — | identyczne |
| Warsztat (11 płócien) | iPhone 13 | 13,4 → 13,5 | 15,7 → 22,4 | 17,9 → 24,1 | — | identyczne |

**Wniosek:** w rundach i misjach **brak zmiany** poza szumem (różnice ±1–6%, w obie
strony): koszt to rasteryzacja tych samych pikseli; `update()` był i jest < 0,3 ms.
Pojedyncze p95/p99 różnią się w obie strony między przebiegami (szum baterii).
Kontrola „wir maks.” w czasie rzeczywistym (4 pary naprzemiennie, `rtmax-sw.log`):
RAF p50 33,3 → 33,3 ms, p95 50 → 50, FPS 36,8 → 39,4, długie klatki 142 → 129,
praca/klatkę 2,1 → 2,0 ms — **bez regresji** (wcześniejszy pojedynczy gorszy wynik = szum).

### 4.3 Ładowanie, rozmiar, pamięć

| Metryka | Baza | Kandydat | Różnica |
|---|---|---|---|
| Menu gotowe / GRAJ do kliknięcia, iPhone 13, CPU 1× (5 prób) | 176 / 176 ms | 107 / 107 ms | szum (pliki praktycznie te same) |
| j.w., CPU 4× | 422 / 448 ms | 465 / 465 ms | szum |
| j.w., laptop | 252 / 257 ms | 259 / 265 ms | szum |
| żądania (zewnętrzne) | 3 (0) | 3 (0) | 0 |
| rozmiar wydania raw / gzip / brotli | 1 376 670 / 417 783 / 333 021 B | 1 381 395 / 419 540 / 334 312 B | +0,3% / +0,4% / +0,4% (komentarze i nowe funkcje) |
| sterta JS po GC, długa sesja 8 cykli | 4,59 → 5,44 MB | 4,48 → 5,32 MB | −0,1 MB, bez wzrostu |
| węzły DOM / listenery / interwały / pętle RAF | 2427→2414 / 174 / 1 / 1 | 2428→2415 / 174 / 1 / 1 | bez zmian, bez wycieków |

### 4.4 Najcięższe scenariusze — ocena dla gracza

Gra w rundzie była i jest ograniczona rasteryzacją dużych wirów (software ~27 ms/klatkę
przy płótnie 780×1688, na GPU praca wątku głównego ~2–3 ms/klatkę). Na słabym urządzeniu
(CPU 4×) w trybie GPU baza i kandydat mają tę samą medianę RAF (18 ms) i podobne ogony —
bez zmian. Odczuwalne zyski tego etapu: brak layoutu co klatkę w menu i na pauzie,
mniej pracy JS na Mieście i poprawka czarnej planszy po obrocie na pauzie.

## 5. Równoważność: grafika, rozgrywka, zapis (`--equiv`)

`node qa/perf1.mjs --equiv` (baza `aa4bc7d` z gita vs gałąź; ziarno, `Math.random`, zegar i
data zamrożone; log `qa/out/perf1/equiv.log`, `equiv-saves.log`):

| Obszar | Wynik |
|---|---|
| Arena: pierwsza runda, późna faza, wir maks., ramka Poki, gfx0 (600 klatek, skrót stanu + pikseli co 150) | **IDENTYCZNE** (5/5) |
| Kampania: M01, M59, boss Rdzenia, boss finałowy | **IDENTYCZNE** (4/4) |
| Płótna menu: Miasto LVL1 i LVL6, Dzielnice, Warsztat, Wyzwania (4 chwile) | **IDENTYCZNE** (5/5) |
| Zapis po pełnej rundzie Areny (14123 pkt), M01, M59 (stały `guestId`) | **IDENTYCZNE** bit w bit (3/3) |
| Animacje CSS zamrożone w tych samych chwilach (Miasto ×5, pauza ×3; iPhone 13 i Poki) | blask w spoczynku: ≤ 2/255 na ≤ 0,15% pikseli; w trakcie przejścia smugi 0,5–1,7% pikseli, maks. 21/255 — subpikselowe położenie skośnej smugi (transform nie jest zaokrąglany do jednostek layoutu); powiększenie: `qa/out/perf1/shine-compare.png` — wizualnie nierozróżnialne |

Wniosek: zmiany w `game.js` nie zmieniają ani jednego piksela ani wartości rozgrywki;
zmiany CSS dają ten sam obraz z dokładnością do subpiksela.

## 6. Pełne QA

`node qa/run-all.mjs` na gałęzi (HEAD `04e6bb5`, czyste drzewo; Node 22.23.4, Playwright 1.64.1,
Chromium 156; log `qa/out/perf1/run-all-cand.log`): **1704/1709 PASS, 5 FAIL**, 4 NOT RUN.
Każdy FAIL sprawdzony na bazie `aa4bc7d` na tej samej maszynie:

| FAIL na gałęzi | Na bazie | Ocena |
|---|---|---|
| `instructions`: ścieżka `docs/MOBILE_PERF1_REPORT.md` z `ARCHITECTURE.md` nie istniała | — | raport powstał po starcie przebiegu; po dodaniu: `node qa/instructions.mjs` **4/4 PASS** |
| `release`: statyczny checker Pages w `release.mjs` zwraca pusty wynik | znany | stary błąd tej maszyny (brak `python3` na Windows); bezpośrednio `python .claude/vertical-hole/tools/check_pages_workflow.py --repo .` → **PASS** |
| `v19`: „27 PAŹDZIERNIKA” bez tłumaczenia | znany | stary błąd lokalizacji EN (miesiąc w dacie) — nie ukryty, nie zmieniany |
| `v20` M11 first frame | **FAIL także na bazie** (`base-v20.log`, 11/12) | zastany/niestabilny |
| `BALANCE-1` rotacja misji dnia (5 zadań zamiast 4 dzisiaj) | **identyczny FAIL na bazie** (`base-balance1-quick.log`, 18/19) | zastany, zależny od daty (2026-10-27); MOBILE-PERF-1 nie dotyka misji dnia |

Zgłoszone w zadaniu zestawy (wszystkie w tym przebiegu): `devices`, `responsive` (+ wejście
na portalach), `content`, `balance1 --quick`, FTUE-1/3 (FTUE-2 = `responsive`), `visual1`,
PX01 (`save-safety`), PX02, R1 (`leave-run`), E2 (`bridge`), E3/L1 (`release`),
`release-recovery`, `trace`, `difficulty`, `arena-bots` (gfx0), `perf1` 25/25 — PASS poza
tabelą powyżej. NOT RUN (środowisko, jak na bazie): 2 negatywy symlinków (Windows bez
Developer Mode), ścieżka gita/realnego CI w `release.mjs`, żywe GitHub Pages.

**Kontrola na końcowym HEAD (2026-10-29).** Po `04e6bb5` zmieniły się wyłącznie dokumenty i
tryb raportu `--compare` w `qa/perf1.mjs` (`game.js`, `style.css`, `index.html` identyczne
bit w bit), więc pełnego `run-all` nie powtarzano. Powtórzone na końcowym kodzie (logi w
`qa/out/perf1/final/`): `instructions` **4/4 PASS** (FAIL z tabeli zamknięty), `perf1`
**25/25 PASS**, `balance1 --quick` **19/19 PASS** (FAIL rotacji misji dnia z 2026-10-27 dziś
nie występuje — potwierdza zależność od daty), `save-safety` **107/107 PASS**, `px02-isolation`
**95/95 PASS**, `check_pages_workflow.py` **PASS**, `node --check` `game.js`/`qa/perf1.mjs` OK.

## 7. Platformy: Poki i CrazyGames (zweryfikowane 2026-10-27)

- **Poki** (developers.poki.com/guide/requirements-quality, external-resources-policy):
  skalowanie do 16:9 (640×360, 836×470, 1031×580), na telefonie pełny ekran w pionie/poziomie,
  tablety ze sterowaniem mobilnym, przewijanie gry nie może przewijać strony rodzica,
  „gracze odchodzą, gdy ładowanie trwa > 10 s”, „Poki blokuje wszystkie zewnętrzne
  żądania” (czcionki, assety, biblioteki w buildzie), localStorage w try/catch, czysty build.
  Liczbowego limitu FPS ani rozmiaru Poki nie podaje.
- **CrazyGames** (docs.crazygames.com/requirements/technical): pierwsze pobranie ≤ 50 MB
  (≤ 20 MB dla strony głównej mobile), łącznie ≤ 250 MB i ≤ 1500 plików, ścieżki względne,
  czas do rozgrywki ≤ 20 s przy zasobach zewnętrznych, `user-select: none`, safe area w
  aplikacji, Chrome/Edge jako cel, ChromeOS: płynnie na 4 GB RAM.
- **Stan gry:** 3 pliki (≈ 1,35 MB surowo, ≈ 410 KB gzip, ≈ 326 KB brotli), 3 żądania,
  0 zewnętrznych, menu gotowe w ≈ 0,2–0,5 s lokalnie. Ramki Poki/CrazyGames, iframe,
  fokus i przewijanie hosta — `qa/responsive.mjs`, `qa/devices.mjs` (wyniki w §6).
  SDK, reklamy i analityka — poza zakresem (PORTAL-1).

## 8. Ryzyka i NOT RUN

- **Safari/WebKit i fizyczne iPhone'y: NOT RUN** (brak urządzeń; Chromium ≠ Safari). Zmiany
  są w standardowym CSS (`transform` w `@keyframes`, pseudo-element z `overflow: hidden`)
  i czystym JS — niskie ryzyko, ale wymagają listy z §9.
- **Animacje CSS:** smuga blasku i pasek budowy liczone są teraz przez kompozytor —
  położenie subpikselowe zamiast zaokrąglonego do jednostki layoutu (różnica ≤ 1 px w
  trakcie przejścia, §5). Pozostałe animacje malujące co klatkę (`v8-cta-breathe` i
  `v8-chest-glow` = `box-shadow`, `unlock-shimmer` = gradient w tekście) **zostawione
  celowo**: ich wierne odtworzenie przez `transform`/`opacity` zmieniłoby wygląd
  (przenikanie zamiast płynnej zmiany cienia). **Decyzja właścicielki:** jeśli
  dopuszczalna minimalna zmiana wyglądu, to kolejne ~10–15% CPU Miasta w bezczynności.
- **Rasteryzacja w rundzie** (duże wiry: gradienty, `shadowBlur`, sprite'y, podłoga) to
  główny koszt rysowania; bez zmiany wyglądu nie ma tu bezpiecznych oszczędności.
  Istniejący strażnik jakości (`GFX_LEVELS`, `monitorFrame()`) dalej obniża jakość na
  słabych urządzeniach — bez zmian.
- **Pomiary na baterii:** bezwzględne ms zależą od trybu zasilania; wnioski opieram na
  przebiegach sparowanych i na licznikach (layouty, styl, alokacje), nie na pojedynczych
  liczbach. Słabe urządzenie = emulacja CPU 4× (orientacyjnie).
- **Pamięć GPU, czas GPU na klatkę, 120 Hz, opóźnienie dotyku: NOT MEASURABLE** w tym
  środowisku.
- `run-all`: 4 NOT RUN środowiskowe (symlinki ×2, git/CI, żywe Pages) — jak na bazie.

## 9. Lista kontrolna na urządzeniach (ręcznie, przed merge)

**iPhone 13 (Chrome):** Miasto przez 30 s — telefon nie grzeje się bardziej niż na `main`,
blask GRAJ przesuwa się płynnie jak wcześniej; runda Areny do końca z dużym wirem; pauza →
obrót do poziomu → plansza widoczna pod arkuszem (nie czarna) → wznowienie; przejście do
innej aplikacji i powrót — gra stoi na pauzie.
**iPhone 16 Pro (aplikacja z ekranu początkowego):** te same kroki + Dynamic Island w poziomie
w trakcie rundy (wir i HUD poza wycięciem), M59 do końca, pasek budowy Miasta płynie.
**Laptop (Chrome):** małe i duże okno, zmiana rozmiaru w trakcie rundy i na pauzie, pełny
ekran, mysz poza oknem zatrzymuje wir, klawiatura; Warsztat i Wyzwania — animacje bez zmian.

## 10. Następny krok

Niezależny odbiór GPT tego PR → decyzja i merge właścicielki (standardowy merge commit) →
automatyczny deploy GitHub Pages z `main` → kontrola na żywo (lista z §9).
