# GAME-READY-1 — przygotowanie do pierwszych testów zewnętrznych (raport)

Baza: produkcyjny `main` `c4f70a09dc73a905d83eb0cea1922c27dfaa7654` (PR #85, DOCS-1; wydanie na produkcji `v/9f92a2df5349/`).
Gałąź: `game-ready1-pre-release-fixes`. Zapis nadal `SAVE_SCHEMA_VERSION = 13`, bez migracji, bez nowych pól.
Maszyna: laptop Windows 11, Node 22.23.4, Playwright Chromium; baza i kandydat mierzone na tej samej maszynie
(bazowy checkout: osobny worktree `c4f70a0`).

Panel TEST — poza zakresem GAME-READY-1 na decyzję właścicielki; bez zmian i bez testów.

Dowody lokalne (git-ignorowane, tylko na maszynie właścicielki): `qa/out/gr1/` — `m118.mjs` + `m118.json` (§5), `fresh.mjs` + `fresh.log` (§7), `dcamp.mjs` / `dname.mjs` (§11), `m11-dist.mjs` (§2 P4); pełne logi regresji w `vh-gr1-tools/` obok repo. W repo zostają testy, które te wyniki pilnują na stałe: `qa/gameready1.mjs`, `qa/v20.mjs`, `qa/release.mjs`.

## Werdykt: **PR GOTOWY DO ODBIORU** (bez merge i deploymentu przed odbiorem GPT i decyzją właścicielki)

## 1. Stan projektu przed zmianami (preflight)

| Element | Stan |
|---|---|
| Repo / remote | `klaudiamoscinska-art/vector-hole`, `origin` = GitHub |
| `origin/main` | `c4f70a0` = HEAD startu, `git status` czysty |
| Gałąź etapu | `game-ready1-pre-release-fixes` od `c4f70a0` (sesja startowała w worktree `worktree-bridge-cse_012gkU4JuztDpKvwgEb8k8sq`) |
| Wcześniejsza praca GAME-READY | brak (żadnej gałęzi, PR ani HANDOFF tego etapu) |
| Python na Windows | `python3` = alias Sklepu Microsoft (kod 49, brak wyjścia); `python` i `py -3` = Python 3.13 |

## 2. Potwierdzone problemy

| # | Problem | Dowód | Rodzaj |
|---|---|---|---|
| P1 | Wersja EN pokazuje polską datę Wyzwania dnia („27 PAŹDZIERNIKA”) | `game.js`: `toLocaleDateString('pl-PL', …)`; słownik znał tylko „12 PAŹDZIERNIKA”; nowy test na bazie: 13/13 dat po polsku w EN | błąd gry (PL/EN) |
| P2 | `index.html`: „60 misji kampanii” (jest 240 w 12 dzielnicach) w meta description i JSON-LD | `<head>`; nowy test na bazie FAIL | nieaktualne metadane |
| P3 | JSON-LD `gamePlatform: ["Web browser","Android","iOS"]` — aplikacji natywnych nie ma; `inLanguage: "pl"` — gra ma EN | `<head>`; README/GDD (aplikacja tylko jako przyszłe opakowanie Capacitor/TWA) | nieprawdziwa deklaracja |
| P4 | `qa/v20.mjs` „M11 first frame” niestabilny | rozkład na 400 losowych układach (402×874): fragmentów na 1. ekranie 0–9, **35%** układów < 3, średnio 3,31; test brał 1 losową próbkę i żądał ≥ 3 | błąd testu (nie gry) |
| P5 | Checker Pages w `qa/release.mjs` FAIL z pustym wynikiem na Windows | log bazy: `{"pass":"","neg":""}`; `spawnSync('python3')` trafia w alias Sklepu (status 49, bez `error`) | błąd środowiska testu |

Nie potwierdzone jako błąd (bez zmian): viewport (§6), M118 (§5), 320×568 (§11).

## 3. Wykonane poprawki

| Commit | Zmiana |
|---|---|
| `36b0961` fix(i18n) | `formatDayMonth()` — data Wyzwania dnia w języku gry z własnych nazw miesięcy (dzień UTC, jak ziarno wyzwania); niezależna od ICU/locale przeglądarki i od dnia miesiąca. Usunięty martwy wpis słownika „12 PAŹDZIERNIKA”. |
| `f6b2740` fix(meta) | meta description i JSON-LD: „240 misji kampanii w 12 dzielnicach”; `gamePlatform: ["Web browser"]`; `inLanguage: ["pl","en"]`; description: „w przeglądarce na telefonie i komputerze”. |
| `9d4982a` fix(qa) | v20 M11: brama w kadrze w **każdym** z 200 układów o stałych ziarnach + średnio ≥ 3 fragmenty (wynik 3,31 — tyle samo, co pomiar losowy; próg 3 bez zmian). release: checker uruchamiany pierwszym prawdziwym Pythonem 3 (`$VH_PYTHON`, `python3`, `python`, `py -3`, każdy pytany o wersję); brak → `NOT RUN`, nigdy PASS. |
| `6e630b8` test(qa) | nowy `qa/gameready1.mjs` (w `run-all`): data PL/EN (13 dni), ekrany FTUE-2 po angielsku, metadane `<head>`; README. |
| `18bfd76` docs | CHANGELOG, GDD §5c, ARCHITECTURE (języki). |

Nie zmieniono: mechaniki, misji, ekonomii, grafiki, CSS, zapisu, workflow, skryptu wydania, panelu TEST.

## 4. PL/EN

- **Data:** PL „1 STYCZNIA … 31 GRUDNIA”, EN „JANUARY 1 … DECEMBER 31” dla 13 dni (1., 9., 28.–31., 29 lutego 2028, 23:59:59 UTC) — baza EN 0/13, kandydat 13/13.
- **Pełny przegląd EN** (`qa/v19.mjs`: wszystkie ekrany, 241 odpraw, rundy, wyniki, `?i18n=log`): baza 1 miss („29 PAŹDZIERNIKA”), kandydat **0 missów** (16/16).
- **Ekrany EN vs PL** (`qa/gameready1.mjs`, 16 ekranów: powitanie, Miasto, Dzielnice, odprawa, Warsztat, Wyzwania, Profil, Arena, pauza, Ewolucja, wynik rundy, misja, wynik misji, karta startu, odblokowanie, nagroda dzienna) na 375×667, 360×640, 844×390 i Poki 836×470: audyt FTUE-2 (nic uciętego, zasłoniętego, poza zasięgiem; główna akcja w kadrze) + „żaden tekst nie jest ucięty po angielsku, gdy po polsku mieści się w całości” — PASS na wszystkich czterech ramkach.
- **Nazwy obiektów i cele:** bez zmian — pokrywa je CONTENT-1 (`qa/content.mjs`: 240 celów, ikony = obiekty planszy, EN).
- **Komunikaty błędów** (zły kod kopii, zapis bez miejsca) — w przeglądzie v19 i PX01.

## 5. M118 „Złodziej bajtów” (Nocny Bazar, trudność 5)

Warunki (odczyt z gry): „Złap 6 złotych bajtów”, limit 50 s, na planszy **12 bajtów** (2× zapas), **Złodziej** (wyścig o te same 6 bajtów, rusza 2 s po starcie), 1 łowca, 1 rywal. `MISSION_BOT_TIME` [40, 53]. Logika sprawdzona w kodzie: bajt ucieka przed bliższą dziurą (także Złodziejem) z 78% jej prędkości i nigdy nie wchodzi w róg poza zasięgiem dziury (margines `max(40, 0,9·r)`); porażka „racer”, gdy Złodziej zbierze 6 albo zostanie za mało bajtów.

Symulacje deterministyczne (każda próba z własnym ziarnem `seedFor(20261029, 'gr1-m118', id, scenariusz, k)`, cała dzielnica, 10 prób; „przeciętny” = profil BALANCE-1: bot casual + sugerowane po porażce wzmocnienie):

| Misja | Ekspert | Casual | Casual + Sprint | Casual + Zegar | Casual bez limitu |
|---|---|---|---|---|---|
| M108 Złodziej aut (wyścig) | 9/10 | 3/10 | 4/10 | 5/10 | 2/5 |
| M111 Szybka sprzedaż (wyścig) | 10/10 | 1/10 | 5/10 | 7/10 | 4/5 |
| M112 Ciemna strona bazaru (wyścig) | 5/10 | 2/10 | 6/10 | 5/10 | 3/5 |
| M116 Bez straty | 10/10 | 7/10 | 10/10 | 9/10 | 4/5 |
| M117 Wielka dostawa | 10/10 | 7/10 | 9/10 | 7/10 | 5/5 |
| **M118 Złodziej bajtów** | **7/10** (mediana 36,8 s) | **0/10** | **0/10** | **1/10** | **0/5** |
| M119 Bazar w ogniu | 9/10 | 10/10 | 7/10 | 10/10 | 5/5 |
| M120 Brama Bazaru (boss) | 9/10 | 4/10 | 3/10 | 5/10 | 5/5 |

Wnioski:
- Misja jest **uczciwie ukończalna**: ekspert 7/10 z zapasem czasu (36,8 s z 50 s); porażki eksperta wyłącznie z Złodziejem (3/10), nigdy z czasu.
- Bot casual przegrywa **wyścig**, nie czas: bez limitu też 0/5 (Złodziej zbiera 6 pierwszy). Bot celuje w najbliższy bajt co ~0,4 s z drżeniem ±12° i nie zapędza bajtów w róg — to znane ograniczenie bota (BALANCE-1 §misje), nie dowód ściany dla ludzi.
- Misje wyścigowe są najtrudniejsze dla casual w całej dzielnicy (M108/M111/M112: 1–3/10); M118 to ich szczyt przy trudności 5 — spójne z etykietą EKSTREMALNA.
- **Nie znaleziono błędu** uniemożliwiającego ukończenie → **M118 bez zmian** (bez rebalance).

Lista kontrolna M118 z prawdziwym graczem (DEVICE-QA / playtest):
1. Czy gracz po odprawie rozumie, że to wyścig (plakietka ZŁODZIEJ, baner „ZŁODZIEJ RUSZA!”)?
2. Ile prób do pierwszego zwycięstwa; czas i przyczyna każdej porażki (Złodziej / czas / łowca).
3. Czy gracz zapędza bajty w róg (podpowiedź „Zapędź je w róg”), czy goni je po otwartym polu?
4. Czy gracz próbuje pochłonąć Złodzieja po urośnięciu (podpowiedź) i czy to pomaga?
5. Czy oferta „SPRÓBUJ Z: SPRINT” po porażce z Złodziejem jest zrozumiała i czy pomaga.
6. Telefon w pionie i komputer — czy krawędź planszy i strzałki krawędzi są czytelne przy pościgu.
7. Decyzja właścicielki dopiero po ≥ 5 osobach: zostaje / łagodniejszy Złodziej / dłuższy start.

## 6. Metadane i dostępność

**Metadane PRZED → PO**

| Pole | PRZED | PO |
|---|---|---|
| `<title>` | „Vector Hole – pochłoń neonowe miasto \| darmowa gra .io online” | bez zmian (prawdziwe; EN tłumaczony przez `I18N_EN`) |
| meta description | „…Rundy 2:00, **60 misji kampanii**, wyzwanie dnia i pojedynki ze znajomymi na tej samej mapie. Za darmo, bez instalacji — na telefonie i komputerze.” | „…Rundy 2:00, **240 misji kampanii w 12 dzielnicach**, wyzwanie dnia i pojedynki ze znajomymi na tej samej mapie. Za darmo, bez instalacji — **w przeglądarce** na telefonie i komputerze.” |
| JSON-LD `description` | „…60 misji kampanii…” | „…240 misji kampanii w 12 dzielnicach…” |
| JSON-LD `gamePlatform` | `["Web browser","Android","iOS"]` | `["Web browser"]` |
| JSON-LD `inLanguage` | `"pl"` | `["pl","en"]` |
| `og:*`, `twitter:*` | prawdziwe (rośnij, rywale, wynik znajomego na tej samej mapie, darmowa w przeglądarce) | bez zmian |
| deklaracje reklam / SDK / sklepów | brak w `<head>` | brak (pilnuje test) |

„Pojedynki ze znajomymi” są prawdziwe (link `?c=` z ziarnem i wynikiem, GDD §5). Nie dodano `og:image` (świadomie niezbudowane, CLAUDE.md).

**Viewport** `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover` — **bez zmian**, po sprawdzeniu realnego wpływu:
- canvas ma `touch-action: none`, a gra celowo blokuje pinch: iOS ignoruje `user-scalable=no`, więc `game.js` łapie `gesturestart`; Ctrl+kółko nie przybliża strony portalu (FTUE-2). Zdjęcie blokady dałoby powiększanie tylko na Androidzie i tylko w menu — HUD i dolna nawigacja o stałych pozycjach wyjeżdżają wtedy poza ekran, a CLAUDE.md zakazuje czytania prostokątów DOM w powiększonej warstwie.
- `maximum-scale=1` ma realną funkcję: pole nazwy gracza ma 15 px — bez tego iOS przybliża stronę przy fokusie i zostawia ją przybliżoną.
- W iframe portalu (Poki/CrazyGames) viewport ramki i tak ustala strona portalu.
- `viewport-fit=cover` jest potrzebne dla safe areas (FTUE-2 FIX).
- Dostępność, która działa dziś: skala UI rośnie z ramką (nigdy < 1), tekst ≥ 9 px pilnowany przez `qa/responsive.mjs`, systemowe powiększenie/rozmiar ekranu (iOS Display Zoom, Android rozmiar wyświetlacza), klawiatura (strzałki/WASD, P/Spacja/Esc), `prefers-reduced-motion` w animacjach menu.
- Wniosek: brak bezpiecznej zmiany viewportu, która poprawia dostępność bez pogorszenia sterowania — ryzyko i propozycja na później w §12.

## 7. Pierwsze pięć minut (FTUE)

Bez zmian w FTUE (nie było dowodu problemu). Kontrola:

| Punkt | Dowód | Wynik |
|---|---|---|
| Pierwsze uruchomienie → karta powitania → GRAJ → runda 2:00 | `ftue3` „first session”, `flow` | PASS (baza i kandydat) |
| Brak nieoczekiwanych zakupów | scenariusz `qa/out/gr1/fresh.mjs` (PL i EN, 3 rundy Areny przez kod gry): 0 wywołań zakupu/reklamy/IAP, wyposażenie bez zmian, monety tylko rosną (PL 0→548→1046→1437) | PASS |
| Runda 1 bez kart Ewolucji, Ewolucja od 2. rundy | `ftue3` FTUE3-3A; `fresh.mjs`: oferta w rundach 1/2/3 = nie/tak/tak (PL i EN) | PASS |
| Komunikat „NASTĘPNA RUNDA · Odblokujesz Warsztat” → Wyzwania → nagroda Core City | `ftue3` FTUE3-3C (obietnica się spełnia) | PASS (baza i kandydat) |
| Warsztat i Wyzwania — odblokowanie | `ftue1` (karty po wyniku), `v22` | PASS (baza i kandydat) |
| Progres Core City | `fresh.mjs`: 0 → 27 → 54 → 78% po 3 rundach | PASS |
| Ekrany wyników i nagród | `ftue1` (bez karty i reklamy ×2 na 1. wyniku), `responsive`, `gameready1` (EN) | PASS (baza i kandydat) |
| Ponowne uruchomienie i zachowanie postępu | `ftue3` „reload”; `fresh.mjs`: po reloadzie Miasto, te same monety / rundy / Core City / poziom, `isFirstRun() = false` | PASS |
| Wyjście z rundy (R1) | `leave-run` | PASS (baza i kandydat) |

To są symulacje botów i testy przepływu — **nie dowód retencji ani odczuć prawdziwych graczy**.

Lista kontrolna dla osoby, która pierwszy raz uruchamia Vertical Hole:
1. Otwórz grę w nowej karcie prywatnej (bez zapisu). Czy w 3 s wiadomo, co nacisnąć (GRAJ)?
2. Pierwsza runda: czy sterowanie (palec / mysz / strzałki) jest jasne bez czytania? Pierwszy kęs w ciągu ~1 s?
3. Czy w 1. rundzie nic nie zatrzymuje gry (bez kart Ewolucji, bez reklam)?
4. Wynik 1. rundy: czy widać, co da następna runda (Warsztat)? Czy ZAGRAJ JESZCZE RAZ jest oczywiste?
5. Runda 2: karta „NOWOŚĆ · EWOLUCJA” — czy wybór jest zrozumiały?
6. Po 2–3 rundach: Warsztat, Wyzwania, kafelek kampanii — czy wiadomo, gdzie iść dalej?
7. Czy cokolwiek zostało kupione lub wydane bez Twojej decyzji? (oczekiwane: nie)
8. Zamknij i otwórz kartę: czy postęp (monety, poziom, Core City) jest zachowany?
9. Przełącz język (Profil → Ustawienia) — czy nic nie zostaje po polsku/angielsku nie na miejscu? Data w Wyzwaniach?
10. Zanotuj: czas do pierwszego „aha”, miejsca zawahania, co było niezrozumiałe.

## 8. Rozliczenie znanych FAIL-i QA

| Znany FAIL | Przyczyna | Rozstrzygnięcie |
|---|---|---|
| `v19` miesiąc w dacie bez tłumaczenia | błąd gry (P1) | **naprawione** (§3) |
| `v20` M11 first frame (niestabilny) | błąd testu: 1 losowa próbka układu, 35% układów < 3 fragmenty | **naprawione w teście** (200 stałych ziaren, próg 3 bez zmian); gra bez zmian |
| checker Pages w `release.mjs` (pusty wynik) | środowisko: `python3` = alias Sklepu | **naprawione** (wybór interpretera) |
| `difficulty` casual EKSTREMALNA ≤ 55% (zależny od ziarna) | losowość próbki 2 prób/misję | bez zmian (poza zakresem); ziarno 1326986504: baza 61% = kandydat 61% |
| `v18` balans wzmocnień (zależny od ziarna) | losowość | bez zmian; ziarno 62584627: baza = kandydat 21/23, identyczne liczby |
| perf `arena-bots` gfx0, `visual` gfx0, `responsive` pod obciążeniem | obciążenie maszyny | `arena-bots` solo 2× parami: PASS na obu; `visual`, `responsive` PASS w pełnym przebiegu |
| BALANCE-1 „daily tasks” zależny od daty | data | PASS (baza i kandydat) |

## 9. Wyniki regresji

Pełna regresja = wszystkie zestawy `run-all.mjs` **bez `qa/dev-panel.mjs`** (panel TEST poza zakresem), uruchomione
osobnym skryptem pomocniczym poza repo (`vh-gr1-tools/suites.mjs` — te same funkcje i argumenty co `run-all`; runnera
nie zmieniano w tym celu). Cztery checki panelu TEST wbudowane w zestawy mieszane (2× `bridge`, 1× `px02` LEGACY-07,
1× `devices`) wykonały się mimochodem (zestawy są niepodzielne), ich wyniki **odfiltrowano z bilansu i nie analizowano**.
Logi: `vh-gr1-tools/base-full.log`, `cand-full.log` (poza repo), podsumowania `qa/out/gr1/summary-{base,cand}.json`.
Baza i kandydat szły częściowo równolegle (2 procesy) — zestawy wrażliwe na obciążenie powtórzono solo, parami.

| Zestaw | Baza `c4f70a0` | Kandydat | Uwagi |
|---|---|---|---|
| instructions, boot, bridge, recovery, trace, edge, features, visual, design, flow, campaign-bots, v15, audio, v17, v20, v21, v22 | PASS | PASS | bez różnic (v20: test M11 przebudowany — §3) |
| release (E3) | 92/93 | **93/93** | FAIL→PASS: checker Pages (`"python":"python"`, PASS + negatyw FAIL) |
| save-safety (PX01) | 107/107 | 107/107 | SAVE v13 |
| px02-isolation (PX02 D+) | 94/94 | 94/94 | (+1 check panelu odfiltrowany) |
| leave-run (R1) | 22/22 | 22/22 | |
| ftue1 / ftue3 | 78/78 · 26/26 | 78/78 · 26/26 | FTUE-1/3 |
| responsive + input (FTUE-2) | 521/521 · 16/16 | 521/521 · 16/16 | |
| devices (FTUE-2 FIX) | 74/74 | 74/74 | (+1 check panelu odfiltrowany) |
| visual1 / content / balance1 / perf1 | 31/31 · 11/11 · 19/19 · 25/25 | 31/31 · 11/11 · 19/19 · 25/25 | VISUAL-1, CONTENT-1, BALANCE-1, MOBILE-PERF-1 |
| v19 (EN) | 15/16 | **16/16** | FAIL→PASS: jedyny miss „29 PAŹDZIERNIKA” |
| v18 | 21/23 (ziarno 62584627) | 23/23 (ziarno 987851008) | ziarno 62584627 na kandydacie: **te same 21/23, identyczne liczby** → FAIL bazowy |
| arena-bots | 8/8 | 7/8 (pod obciążeniem) | gfx0 13,22 ms przy 2 równoległych przebiegach; **solo: PASS na obu**, gfx0 baza 6,73 / 9,10 ms, kandydat 7,50 / 7,62 ms → FLAKY (obciążenie) |
| difficulty | 7/7 (losowe ziarno) | 6/7 (ziarno 1326986504) | ziarno 1326986504: **baza 61% = kandydat 61%** → FLAKY (ziarno), znany |
| **gameready1 (nowy)** | — (date+head: 5/9) | **21/21** | baza FAIL 4 celowane checki (data EN ×2, metadane ×2) |
| **Razem** | **1635/1639** | **1658/1660** | |

Rozdzielenie:
- **PASS:** wszystko poza poniższym.
- **FAIL — regresja:** **brak**.
- **FAIL — błąd bazowy, naprawiony:** checker Pages (release), v19 data.
- **FLAKY (identyczne na bazie przy tym samym ziarnie / znikają solo):** v18 balans wzmocnień (ziarno), difficulty casual EKSTREMALNA (ziarno), arena-bots perf gfx0 (obciążenie).
- **NOT RUN:** `qa/dev-panel.mjs` i 4 checki panelu (poza zakresem); w `release`: 2 negatywy z symlinkami (Windows bez Developer Mode), ścieżka gita/CI i żywe GitHub Pages (bez deploymentu) — tak samo na bazie.

Celowane powtórki: `v20` 3× na kandydacie (deterministycznie, średnio 3,31 fragmentu; wcześniej na bazie 4× PASS solo — niestabilność ujawnia się w ~1/3 przebiegów); `python .claude/vertical-hole/tools/check_pages_workflow.py --repo .` — PASS; `qa/instructions.mjs` 4/4.

## 10. Bezpieczeństwo SAVE v13

- `SAVE_SCHEMA_VERSION` = 13, klucz `vectorHoleSave_v1` — bez zmian; diff nie dotyka `defaultSave()`, `sanitizeSave()`, `migrateSave()`, `saveGame()`, `SAVE_SLOT` ani zakupów.
- Zmiana w `game.js` to wyłącznie formatowanie tekstu etykiety daty (`formatDayMonth`) i usunięcie jednego wpisu słownika.
- `save-safety` (PX01) 107/107, `px02-isolation` (D+) 94/94, `leave-run` (R1) 22/22, `ftue1`/`ftue3` (schema 13, brak nowych pól) 78/78 · 26/26 — na bazie i kandydacie.
- Konteksty zapisu (przeglądarka vs aplikacja z ekranu głównego iPhone) — bez zmian: ten sam `index.html`, ten sam origin i ścieżka; `apple-mobile-web-app-capable` zostaje.

## 11. Do DEVICE-QA (wymaga fizycznych urządzeń)

1. **320×568 (iPhone SE 1. gen. / małe Androidy):** na ekranie Dzielnic przycisk GRAJ karty misji chowa się pod dolną nawigacją w 8/12 dzielnic **po polsku i po angielsku jednakowo** (także przy jednoliniowych nazwach — decyduje treść karty misji); ekran się przewija, więc przycisk jest osiągalny. Na 360×640 i 375×667 wszystkie 12 dzielnic PL/EN mieszczą się (`qa/out/gr1/dcamp.mjs`). `qa/responsive.mjs` sprawdza 320×568 tylko dla Galerii (PL — mieści się). Do decyzji: VISUAL-2 / DEVICE-QA.
2. Pinch / zoom i pole nazwy na prawdziwym iPhonie (Safari i aplikacja z ekranu głównego) — §6.
3. Data Wyzwania dnia po angielsku na iPhonie i Androidzie (lista nazw miesięcy jest w grze, więc nie zależy od ICU urządzenia — potwierdzić wzrokowo).
4. M118 z ludźmi — lista w §5.
5. Pierwsze 5 minut z nową osobą — lista w §7.

## 12. NOT RUN i otwarte ryzyka

**NOT RUN:** panel TEST (decyzja właścicielki); fizyczne urządzenia (iPhone Safari / aplikacja z ekranu głównego, Android, tablet) — §11; prawdziwi gracze (M118, pierwsze 5 minut); symlinki i żywe Pages w `release` (jak na bazie); GPU-czas (perf liczony na SwiftShader).

**Ryzyka / decyzje właścicielki:**
1. **320×568, ekran Dzielnic:** GRAJ pod dolną nawigacją w 8/12 dzielnic (PL = EN), osiągalny przewinięciem — zastane; propozycja: VISUAL-2 / DEVICE-QA (nie przebudowywano układu).
2. **Viewport:** blokada powiększania zostaje (uzasadnienie §6). Gdyby właścicielka chciała dopuścić powiększanie w menu, to osobny etap: pole nazwy ≥ 16 px, wyłączenie blokady tylko poza rundą, test HUD po powiększeniu.
3. **M118:** ściana dla bota casual (0/10, także bez limitu czasu), ekspert 7/10 — bez dowodu z ludźmi nic nie zmieniono; lista §5.
4. **M11 pierwszy ekran:** w ~4% układów (402×874) i ~7% (375×667) na pierwszym ekranie nie ma żadnego fragmentu (jest brama i strzałki). Gra nigdy tego nie gwarantowała (CHANGELOG v20 obiecuje bramę); ewentualne dosypanie fragmentów przy starcie = zmiana planszy → kalibracja (`qa/calibrate.mjs`), decyzja właścicielki.
5. Test `v20` M11 sprawdza teraz średnią z 200 stałych układów zamiast 1 losowego — mniej wrażliwy na pojedynczy pechowy układ, ale deterministyczny; zmiana sposobu rozsiewania jedzenia przesunie średnią i test to wykaże.
6. Znane niestabilne (bez zmian w GAME-READY-1): v18 i difficulty zależne od ziarna, perf gfx0 pod obciążeniem — przy odbiorze porównywać z bazą na tym samym ziarnie.
