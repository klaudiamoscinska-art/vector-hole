# VH_PREFLIGHT_REPORT — FTUE-1 „Druga runda” (P00 + implementacja wariantu D)

**Data:** 2026-10-23 · **Repozytorium:** `klaudiamoscinska-art/vector-hole` (remote `origin`, fetch = push = `https://github.com/klaudiamoscinska-art/vector-hole.git`; innych remotes brak)
**Baza:** `810334f0bf3c38436cf1f1f1be3084f4071270c6` = `origin/main` (sprawdzone `git fetch origin main` 2026-10-23; PR #76). Lokalny `main` stał na `63b50d0` — nieużywany.
**Gałąź robocza:** `ftue1-second-round` (lokalna, utworzona od zweryfikowanego `origin/main`, upstream odpięty, żeby żaden push nie trafił w `main`). Nazwa nie istniała ani lokalnie, ani na `origin`.
**Stan git przed:** czyste drzewo na `main` (63b50d0). **Po:** HEAD `810334f`, zmiany niezatwierdzone (8 plików zmienionych + `qa/ftue1.mjs` nowy). **Bez commita, push, PR, merge, deployu, zmian na staging.**

**Odcisk drzewa (własna metoda — `check_evidence.py` NIE uruchomiony, brak Pythona):** `63f122ba14b2138fbbf5cab0f660bb27ccd8f2ae921933b47a9d300014acdd7e` = SHA-256 listy `sha256(treść LF)  ścieżka` dla 244 plików z `git ls-files -co --exclude-standard` (bez tego raportu); lista: `SNAPSHOT_FILES.txt` w paczce odbioru.
**Pliki runtime (SHA-256 treści LF, jak zapisze git; drzewo robocze ma CRLF przez `core.autocrlf=true`):**
- `game.js` `dfed72ea1299000e58f25f57aaf282551cfe8018386e7695a5c715a9ee370f39` (baza `3f837b5a…f386ca`)
- `style.css` `374be9e77bfad25f9b3218f61fc03113ba2b6b21034d132ce436205c8836bb29` (baza `b5eb39fe…611b61`)
- `index.html` `eb5170a426bfea149fd6eb6d0e3ec158013845abef4865f892767fe81921b871` (bez zmian)

**Środowisko:** Windows 11 Pro, PowerShell 5.1 + Git Bash. **Brak Node.js, Pythona (tylko alias Microsoft Store) i Playwrighta** — nic nie instalowano. Dostępny systemowy **Microsoft Edge 155.0.4283.62** (headless) — użyty jako *zastępcze* środowisko testowe (harness poza repo, opis niżej). Brak fizycznego telefonu, brak SDK Poki/CrazyGames.

---

## 1. Werdykt bramek

| Bramka | Wynik | Dowód / powód |
|---|---|---|
| CORE-ENERGY | **PASS (statycznie)** | `grep energy game.js`: tylko czytnik migracji v12→v13 (`const { energy, ...rest } = data`), opisy grafiki i fabuły; brak timera/kosztu/chipu. Runtime: zastępczy harness — 3 rundy Areny pod rząd z przycisków bez czekania. |
| CORE-ISOLATION | **NOT RUN (oficjalnie)** · statycznie bez zmian | `qa/px02-isolation.mjs` nieuruchomiony (brak Node). Statycznie: brak `perks`, `RUN_TOOLS`, `turbo_free`, `confirmRunSetup` w `game.js`; FTUE-1 nie dotyka startu rundy, nagród ani Dzielnic (diff). |
| CORE-LOOP | **PASS (zastępczo, Edge headless)** · oficjalnie NOT RUN | Harness: welcome GRAJ → runda → wynik → ZAGRAJ JESZCZE RAZ → runda 2 → … na 390×844, 375×667, 844×390, 1280×720 (`ftue1r2-summary.log`). `qa/flow.mjs` / `qa/v22.mjs` nieuruchomione. |
| CORE-SAVE | **NOT RUN (oficjalnie)** · zastępczo bez regresji | `qa/save-safety.mjs` nieuruchomiony. Zastępczo: 7 zapisów istniejących + 2 ponowne uruchomienia; start zmienia tylko sesję retencji L1 (`retention/meta/_sig`) identycznie jak baza; brak utraty/duplikatów w `unlocks.announced`; `schemaVersion` 13. |
| TOOLS-DEV | **FAIL wg pakietu (bez zmian od P00)** | `class DevPanel` w publicznym `game.js` (decyzja projektu v23, PX03 = decyzja właścicielki). Nie blokuje FTUE. FTUE-1 dodał w panelu tylko 2 linie (patrz §3). |
| DEPLOY-PAGES | **NOT RUN (`check_pages_workflow.py`)** · workflow nietknięty | `git diff origin/main -- .github` puste. Trigger: tylko `push` na `main` + `workflow_dispatch`, upload `path: release`. |

**GO_CORE = NOT RUN** (brak oficjalnych CORE-ISOLATION i CORE-SAVE na tym snapshotcie) · **GO_TOOLS = NO GO** · **GO_RELEASE = STOP**.
Zgodnie z PREFLIGHT_GATES naprawy FTUE nie są blokowane przez TOOLS; brak GO_CORE na tym snapshotcie oznacza, że **przed push/merge trzeba uruchomić `node qa/run-all.mjs`** na maszynie z Node + Playwright.

## 2. Zakres FTUE-1 (zatwierdzony) i realizacja

| Punkt | Zmiana | Gdzie |
|---|---|---|
| 1A | Karta „DRUGI TRYB · KAMPANIA” nie pokazuje się nad wynikiem (pozycja `kampania` z `hubIntro: true` pomijana w `queueUnlockCelebrations()`). ZAGRAJ JESZCZE RAZ bez zmian. | `game.js` FEATURE_UNLOCKS, `queueUnlockCelebrations()` |
| 1B | Od 3. rundy Areny kafelek kampanii w Mieście w stanie „intro” (`DRUGI TRYB` / `Kampania: 240 misji` / `12 dzielnic · zagraj, kiedy chcesz`, plakietka NOWE; NOWE także na zakładce Dzielnice), tap → Dzielnice. Warunek wyliczany z zapisu: `campaignIntroDue()` = nie `knowsCampaign()` i ≥ `CONFIG.ftue.campaignIntroRuns` rund. Wizyta w Dzielnicach dopisuje `'kampania'` do `save.unlocks.announced` (ten sam identyfikator i format). Kafle odświeżają się przy każdym wejściu do Miasta. | `knowsCampaign()`, `campaignIntroDue()`, `updateHubQuickTiles()`, klik kafla, `showScreen()`, `renderBottomNav()`, CSS `.hub-quick-campaign.is-intro` |
| 1C | `#btnWatchAd` ukryty, gdy `stats.runsPlayed === 1` po finalizacji (pierwsza Arena w historii zapisu); `watchRewardedAd()` ignoruje ukryty przycisk. Nagroda bez zmian. | `endRound()`, `watchRewardedAd()` |
| 1D | `bootFirstRun` (sesja zaczęta od ekranu powitalnego) + `hubVisits` (licznik wejść do Miasta po pierwszej rozgrywce, **tylko w pamięci**): kalendarz od 2. wizyty; nowe uruchomienie = normalnie. Bez nowego pola w zapisie. | konstruktor `Game`, `adoptSave()`, `showScreen()`, `maybeShowLoginReward()` |
| 1E | Karty na wyniku Areny po `CONFIG.ftue.resultCelebrationDelayMs` = 2400 ms (licznik 1100 ms, pasek XP 350 + 1100 ms) i tylko gdy wynik nadal widoczny; inaczej karty funkcji są porzucane (zostaje NOWE), karty nagród czekają. Progi bez zmian. | `queueUnlockCelebrations({ delay, screen })`, `endRound()` |
| 1F | `docs/GAME_DESIGN.md`, `docs/CHANGELOG.md`, `CLAUDE.md`, `qa/README.md`. Liczba misji sprawdzona w kodzie: 6×10 + 6×30 = **240** w 12 dzielnicach — opisy w docs były poprawne; nie znaleziono bezspornie nieaktualnych liczb (pakiet skilli `vh-mission-content` mówi „M00–M240” — znany konflikt opisany w CLAUDE.md, pakiet aktualizuje się tylko z ZIP). | docs |

Teksty nowe: 2 wzorce w `I18N_EN` (`Kampania: {#0} misji`, `{#0} dzielnic · zagraj, kiedy chcesz`), plakietka EN `NEW` w CSS. Neutralne płciowo (tryb rozkazujący).

## 3. Czego NIE zmieniono
`SAVE_SCHEMA_VERSION` 13, `migrateSave()`, `sanitizeSave()`, `defaultSave()`; ekonomia (formuła monet, mnożniki, ceny, kalendarz `CONFIG.loginRewards`); długość rundy (`CONFIG.round.duration` 120), boty, trudność, rozmiary dziury; progi `CONFIG.unlockGates`; `Monetization`, SDK, interstitial; workflow E3, retencja L1, recovery; architektura modułów (jeden `game.js`); `index.html`. Panel DEV: `announce()` pomija `hubIntro` (tak jak gra) i akcja „reward-login” ustawia `hubVisits ≥ 2` (tylko w trybie testowym). M32/M59, grafika, input, 16:9 — nie ruszane.

## 4. Testy na końcowym snapshotcie

Pliki runtime ostatnio zmienione 14:30:43; seria r2 rozpoczęta 14:36:45 → dowody r2 dotyczą końcowego kodu. Seria r1 (14:2x) była przed ostatnią poprawką harnessu i jest tylko historią.

| Test | Wynik | Komenda | Dowód |
|---|---|---|---|
| `node qa/run-all.mjs` i każdy `qa/*.mjs` | **NOT RUN** | — | brak Node/Playwright |
| `qa/ftue1.mjs` (nowy), `qa/v22.mjs` (zmieniony) — składnia + linkowanie modułu | PASS (to nie jest wykonanie testów) | Edge, import map z atrapami `./lib.mjs`, `node:*` | `syntax-qa.json` |
| Zastępczy harness FTUE-1 — bieżący kod | **299/301 PASS** (2 FAIL: 844×390 kafel poniżej krawędzi — identycznie w bazie) | `tools/suite.ps1 -Port 8765 -Label ftue1r2 -Full` | `ftue1r2-summary.log` + JSON |
| Zastępczy harness — baza 810334f, te same scenariusze | 224 PASS / 77 FAIL (FAIL = stare zachowania, które FTUE-1 zmienia + te same 2 przypadki 844×390) | `tools/suite.ps1 -Port 8766 -Label baser2 -Full` | `baser2-summary.log` |
| Zrzuty 390×844, 375×667, 844×390, 1280×720 (+ EN) | wykonane, przegląd ręczny | `-Shot` | `07_ZRZUTY/` |
| `check_evidence.py`, `check_pages_workflow.py`, `validate.py`, `check_prompts.py` | **NOT RUN** | — | brak Pythona |
| Fizyczny telefon, iframe Poki/CrazyGames, prawdziwe SDK | **NOT RUN** | — | — |

Ograniczenia harnessu: wirtualny czas headless nie napędza `requestAnimationFrame` (liczniki wyniku i animacje CSS stoją na zrzutach) — koniec animacji sprawdzany przez czas opóźnienia, a nie obraz; brak emulacji dotyku; rundy skrócone do 10–20 s gry + koniec czasu.

## 5. Otwarte ryzyka (szczegóły w paczce, `08_PROBLEMY_NIEROZWIAZANE.md`)
1. Oficjalne QA nieuruchomione — możliwe regresje w zestawach, których harness nie pokrywa (flow, design, px02, save-safety, dev-panel, v19 i18n sweep).
2. FTUE-2 (istniejące wcześniej): pasek zgody na statystyki od pierwszej wizyty w Mieście zasłania dolne kafle (375/390) i GRAJ (844×390); Miasto w poziomie 844×390 wymaga przewinięcia do kafli.
3. Gracz, który zamknie grę po 1. wizycie w Mieście, zobaczy kalendarz przy następnym uruchomieniu (to „druga wizyta”) — zgodne z zadaniem, opisane.
4. Karty Warsztatu/Wyzwań porzucane, gdy gracz w 2,4 s kliknie ZAGRAJ JESZCZE RAZ — informuje wtedy tylko plakietka NOWE.

## 6. Następny krok
Uruchomić `node qa/run-all.mjs` (+ `node qa/ftue1.mjs`) na maszynie z Node + Playwright na tym drzewie (patch z paczki na `810334f`), porównać z bazą `810334f` na tej samej maszynie; dopiero potem decyzja o commit/push/PR.
