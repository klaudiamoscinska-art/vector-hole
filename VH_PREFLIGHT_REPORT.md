# VH_PREFLIGHT_REPORT — PX02 D+ (VH-02, izolacja Areny): runda 2 — poprawki po przeglądzie GPT

**Data:** 2026-10-18 · **Repozytorium:** `klaudiamoscinska-art/vector-hole`
**Baza:** `5db3b02094592b541a18fc11ca52e248ff0c14a4` (= `origin/main`, sprawdzone `git fetch` 2026-10-18; PR #73 PX01)
**Gałąź robocza:** `px02-economy-dplus` (lokalna, z `5db3b02`). **Bez commita, push, PR, merge i deployu.**
> Raport opisuje drzewo robocze zatwierdzone w przeglądzie GPT (fingerprint `8da6271a…1d8a`), zanim powstał commit. SHA commita i numer PR są w opisie PR; `VH_PREFLIGHT_MANIFEST.json` dla końcowego HEAD jest celowo poza commitem (bez cyklu SHA, jak w PX01).
**Poprzedni snapshot (runda 1, przegląd GPT):** `9a953d3100923c1004d6360f849491764379f00d0f5bb48c8fcff40b509316e4`
**Aktualny snapshot (check_evidence.py):** `8da6271a720fde9f010d47eaed3772ab6fa1590491b1aa129df6d04225d11d8a` (233 pliki)
**Pliki runtime (SHA-256):**
- `game.js` `5011c0e4047c20ff96b22ae1da84746229f0cf99a738287d1a79414134392664` (runda 1 `113db9e4…7d88`, baza `dc94d8d9…67aa`)
- `index.html` `6683fc52d0c2dc188f9b9496570f89653c0ccbbae7a04223b4d2a073fabd48be` (bez zmian od rundy 1)
- `style.css` `b5eb39fef65635eeb75c91de0c7b52c42dedd640e5b4b920bbbf95d4f3611b61` (runda 1 `25e2a33a…3bf5`)

**Środowisko:** kontener Linux (4 CPU), node v22, Playwright + headless Chromium, `pl-PL` (UX-01 i zrzuty także `en-US`). **Wyłącznie emulacja** — nie ma fizycznego telefonu, SDK CrazyGames/Poki jako mock.
**Skille:** `vh-save-security` (wywołany); checklisty `vh-progression-economy`, `vh-qa-automation`, `vh-ux-gamefeel` stosowane ręcznie.

---

## R2-1. Werdykt

**GOTOWE DO NIEZALEŻNEGO PRZEGLĄDU GPT (runda 2) — kandydat do PR** po zgodzie właścicielki. Ograniczenia bez zmian: emulacja, zwrot jednorazowy na linię zapisu (nie globalnie).

| Bramka | Wynik | Dowód |
|---|---|---|
| **CORE-ISOLATION** | **PASS** (emulacja) | `PX02R2-31-px02-isolation.log` **95/95** |
| **CORE-SAVE** | **PASS** (emulacja) | `PX02R2-32-save-safety.log` **107/107** + LEGACY-01…10 w `PX02R2-31` |
| CORE-ENERGY | PASS | `PX02R2-30` v22 49/49 |
| CORE-LOOP | PASS (emulacja) | `PX02R2-30` flow 35/35, v22, ISO-C |
| TOOLS-DEV | NOT RUN (poza zakresem; FAIL z P00 bez zmian) | — |
| Pełne QA `node qa/run-all.mjs` | **669/671** | `PX02R2-30` (runda 1: 657/660; baza: 573/576) |

**GO_CORE = CANDIDATE** · **GO_TOOLS = NO GO** · **GO_RELEASE = STOP**.

## R2-2. Zgłoszenia z przeglądu i co zrobiono

| # | Zgłoszenie GPT | Odtworzone przed zmianą? | Poprawka (minimalna) | Test |
|---|---|---|---|---|
| 1 | `showLooksOnlyNotice()` ustawia `economy.notice = false` przed `saveGame()` i nie sprawdza wyniku | **Tak**: przy nieudanym zapisie znacznika karta i zdarzenie `looks_only_refund` pojawiały się, a w pamięci `notice` było już `false` (`PX02R2-10`, LEGACY-09 FAIL) | Gdy zapis znacznika się nie powiedzie: `notice` wraca na `true`, karta się **nie** pokazuje, zdarzenie się **nie** rejestruje; karta wraca przy następnym uruchomieniu. Zwrot był już zapisany wcześniej (atomowo z saldem) i nie jest wypłacany ponownie. | LEGACY-09 (2 testy): błąd zapisu „widziane” → brak karty i zdarzenia, `notice` czeka w pamięci i na dysku; reload z działającym zapisem → karta raz, saldo nadal 4907; kolejny reload → brak karty |
| 2 | `adoptSave()` / import kopii mógł potwierdzić trwałe przywrócenie mimo niezapisania | **Tak**: kod kopii przy quota i przy zapisie z innej karty (stale) pokazywał „Postęp wczytany — cały postęp z kodu jest na tym urządzeniu”, choć dysk się nie zmienił (`PX02R2-10`, 2× LEGACY-10 FAIL). Chmura: **bez fałszywego potwierdzenia** (brak komunikatu, brak zwrotu w pamięci, brak lustra) — PASS już przed zmianą. | `adoptSave()` zwraca `true` (zapisane) / `false` (tylko w pamięci) / `null` (nic nie przyjęto). `importBackup()` mówi „Postęp wczytany” tylko dla `true`; dla `false` — „Kopia wczytana bez zapisu” (wyjaśnienie, że po odświeżeniu może wrócić poprzedni postęp); dla `null` (np. nieudana kopia `.rescue`) zostaje komunikat blokady. Zdarzenia `backup_load` / `save_adopted` mają pole `stored`. SAVE_GUARD, `.rescue`, `.bak`, lustro chmury bez zmian. | LEGACY-10 (4 testy): quota i stale → „Kopia wczytana bez zapisu”, dysk nietknięty, brak karty zwrotu; po zwolnieniu quota ten sam kod → „Postęp wczytany”, zapis z jednym zwrotem (4907); chmura przy nieudanym zapisie → brak zwrotu w pamięci, brak karty, chmura i dysk nietknięte |
| 3 | Tytuł Warsztatu ucięty („WARSZT…”) na 375×667 przy ≥ 2587 monet | **Tak**: ucięty przy 375 px (każde z sald 2587/4870/10000/99999) i 320 px; 360 px mieścił się (`PX02R2-11-header-measure-before-fix.log`) | `#shopScreen` dołączony do istniejącej kompaktowej reguły ≤ 440 px (jak Dzielnice i Miasto: tytuł 21 px, ciaśniejsze „pigułki” walut) + reguła ≤ 340 px (tytuł 17 px). Waluty i przycisk ustawień widoczne. `README.md`: „Wiry z bonusami” → „Wiry do kolekcji (sam wygląd — w Arenie liczy się gra)”. | UX-01: 375/360/320 px × 2587/4870/10000 monet → tytuł cały, portfel i zębatka na ekranie, brak przewijania w bok; zrzuty `PX02R2-screens/` (także EN „WORKSHOP”) |

**Zmienione pliki w rundzie 2** (diff przyrostowy względem snapshotu `9a953d31`: `PX02R2-50-diff-vs-previous-snapshot.patch`, sprawdzony `git apply` na odtworzonym drzewie rundy 1):
- `game.js` (+26/−10): `adoptSave()` (wynik zapisu), `importBackup()` (komunikat), `showLooksOnlyNotice()` (wynik zapisu znacznika), 3 wpisy `I18N_EN`;
- `style.css`: reguły nagłówka Warsztatu;
- `qa/px02-isolation.mjs`: blok `runPx02ReviewChecks()` (11 testów, `--review` uruchamia tylko go), wywoływany też z pełnej suity;
- `README.md`, `qa/README.md`, `docs/CHANGELOG.md`, `docs/GAME_DESIGN.md`, `CLAUDE.md`: opis rzeczywistego kodu.

Bez zmian: model D+, ceny, waluty, gameplay, Dzielnice, `index.html`, schemat zapisu (13), panel DEV, workflow.

## R2-3. Testy rundy 2 (kod zamrożony: hashe 129 plików przed i po identyczne, `PX02R2-21` == `PX02R2-22`)

| Test | Wynik | Komenda | Dowód |
|---|---|---|---|
| Blok przeglądowy przed poprawką `game.js` | **8/11** (FAIL: LEGACY-09 ×1, LEGACY-10 ×2 — odtworzenie zgłoszeń 1 i 2) | `node qa/px02-isolation.mjs --review` | `PX02R2-10` |
| PX02 pełny (ISO-A…D, BOOST-01…03, LEGACY-01…10, UX-01) | **95/95 PASS** | `node qa/px02-isolation.mjs` | `PX02R2-31` |
| SAVE-01…09, R1–R4 (PX01) | **107/107 PASS** | `node qa/save-safety.mjs` | `PX02R2-32` |
| Pełne QA | **669/671** | `node qa/run-all.mjs` | `PX02R2-30` |
| v18 balans — powtórki na finalnym kodzie | FAIL 2/2 testu „lift”; seria naprzemienna kod rundy 1 vs finalny: 1/3 vs 1/3 PASS (`PX02R2-43`) | `node qa/v18.mjs 2` ×2 | `PX02R2-42` |
| Kontrola mobilna Warsztatu (375×667, 320×667; PL i EN) | PASS (emulacja) | `ws-shots.mjs` | `PX02R2-screens/` |
| Rekompensata tylko raz; stare zakupy i zapisy bezpieczne | PASS (LEGACY-01…10; SAVE-01…09) | j.w. | `PX02R2-31`, `PX02R2-32` |
| Fizyczny telefon, prawdziwe SDK, wiele urządzeń | **NOT RUN** | — | — |

### Porównanie FAIL w pełnym QA (ta sama maszyna)

| Test | Runda 2 (finalny kod) | Runda 1 (`9a953d31`) | Baza `5db3b02` | Ocena |
|---|---|---|---|---|
| v19 data EN („18 PAŹDZIERNIKA”) | FAIL | FAIL („17 PAŹDZIERNIKA”) | FAIL | znany błąd poza PX02 (data zależy od dnia) |
| v18 „Zegar, Turbo start i Sprint each lift…” | FAIL (Turbo start +0 w tej próbce) | FAIL | PASS w tym przebiegu | losowość bota (±7 pkt wg testu); w rundzie 1: 3/3 PASS nowy, 3/3 PASS baza (`PX02-42`); powtórki rundy 2: 2/2 FAIL; seria naprzemienna runda 1 vs finalny: „lift” 1/3 vs 1/3 PASS, „Sprint not a must-buy” 3/3 vs 1/3 PASS (`PX02R2-42`, `PX02R2-43`); kod misji niezmieniony od rundy 1 |
| arena-bots perf „low-end … 12 ms” | **PASS** | FAIL | FAIL | maszynowe |
| visual perf „rasterized … 12 ms” | PASS | PASS | FAIL | maszynowe |

**Pełne QA nie jest 100% PASS** (2 FAIL). Żaden nie jest regresją rundy 2: data EN jest znanym błędem, a balans v18 to losowość bota.

## R2-4. Nierozwiązane ryzyka (po rundzie 2)

1. Jednorazowość zwrotu tylko na linię zapisu (bez backendu): dwa niezsynchronizowane urządzenia lub stary kod kopii = osobne zwroty.
2. Okno rollbacku: wir kupiony na starym wydaniu po cofnięciu wdrożenia nie dostanie zwrotu.
3. Karta zwrotu przy trwale nieudanym zapisie znacznika nie pokaże się (zwrot jest jednak zapisany); wróci, gdy zapis zadziała.
4. „Kopia wczytana bez zapisu”: postęp z kodu działa w sesji, kolejne autozapisy mogą go zapisać, gdy przestrzeń się zwolni; przy `stale` nic nie zapisze się do odświeżenia.
5. Nagłówek Warsztatu przy 320 px i ekstremalnym portfelu (99999 monet + 999 pryzmatów) nadal ucina tytuł; zakładki Warsztatu zawijają się przy 320 px (stan sprzed PX02).
6. Pozostałe z rundy 1 (ceny v13, gracze płacący za przewagę, plik kontraktu vs ZIP paczki, analityka) — bez zmian; patrz R1-11.
7. **NOT RUN:** fizyczne telefony, prawdziwe SDK, wiele urządzeń, żywa strona.

## R2-5. Dowody, snapshot i manifest

- Dowody rundy 1 (`PX02-*`) pozostają nietknięte. Runda 2: `PX02R2-10/11/20/21/22/30/31/32/42/50` + `PX02R2-screens/`.
- `VH_PREFLIGHT_MANIFEST.json`: `revision` = rzeczywisty HEAD `5db3b02` (zmiany niezatwierdzone; brak cyklu SHA), dowody PASS wskazują logi `PX02R2-*`, snapshot = aktualny.
- `check_evidence.py --repo . --manifest VH_PREFLIGHT_MANIFEST.json` → `EVIDENCE CURRENT/FORMALLY COMPLETE — game tests NOT executed or verified by this script`, `Worktree SHA256: 8da6271a720fde9f010d47eaed3772ab6fa1590491b1aa129df6d04225d11d8a files: 233`, `GO_CORE: CANDIDATE — manual test evidence review`, `GO_TOOLS: BLOCKED/NOT RUN`.

## R2-6. Git

Nie wykonano: commit, push, PR, merge, rebase, deploy. Hook sesji wielokrotnie żądał commit/push — odmówiono zgodnie z zakazem właścicielki. Wyłącznie syntetyczne fixture'y w izolowanych przeglądarkach.

---

# Runda 1 — wdrożenie D+ (historia; snapshot `9a953d31…16e4`, przegląd GPT zakończony)

Liczby w tej części dotyczą rundy 1 (84/84 PX02, 657/660 QA). Aktualne wyniki: część R2 powyżej.

## R1-2. Stan bazowy PX02 (odtworzony przed zmianą)

Ten sam nowy test uruchomiony na kodzie `5db3b02` (rozpakowanym przez `git archive`): **28 PASS / 25 FAIL**, a potem crash na teście, który na bazie nie ma pola `economy` (`PX02-10-repro-base-px02-isolation.log`). Potwierdzone:
- **ISO-A:** GRAJ po 3. rundzie otwierał „WYBIERZ WSPARCIE” z 4 dodatkami (`RUN_TOOLS`, Turbo 70 monet z tego samego portfela, który zasila kampania).
- **ISO-B:** bonusy wirów działały w Arenie, Daily i wyzwaniach. Na seedzie 4242: Cyjan prędkość 165 → 178,2; Gorący Róż okno combo 1,77 → 2,37; Toksyczna Zieleń przyciąga obiekt; Ultrafiolet XP 146 → 183; Neonowe Złoto monety 79 → 103; Biała Plazma promień startowy **18 → 32** (zgodnie z ISO-A z analizy).
- **BOOST-03:** po przegranej (ŚREDNIE) karta „TURBO GRATIS · REKLAMA” → `rewarded('turbo_free')` → rewanż od T2.
- Zdarzenia zapisu bez zmian względem PX01.

## R1-3. Co zaimplementowano (D+, bez wariantów własnych)

- **DEC-1/DEC-6:** wszystkie `SKINS` mają tylko `look` (opis wyglądu). Usunięte `perks`, `perkLabel`, `Game.perk()`, `activePerks` i wszystkie odczyty (prędkość, combo, magnes, XP, monety, start, punkty, wzrost). Wygląd (`SKIN_STYLES`), własność, ceny i zakładanie bez zmian.
- **DEC-2:** usunięte `RUN_TOOLS`, ekran `#runSetupScreen`, `populateRunToolGrid()`, `confirmRunSetup()`, `selectedRunTool`, `shieldCharges`, `toolMagnetUntil`, karta wyniku `#resultUpsell` + `onUpsellClick()`, placement `turbo_free`. `startArenaRound()` = `startRound()`. Martwe po tym: `difficultyLabel()`, `CONFIG.difficulty.labels`, 39 wpisów `I18N_EN`, CSS ekranu dodatków. Zostają mutacje w rundzie, Złoty Rdzeń, SZAŁ, Core City, ×2 monet za reklamę po rundzie, `Hole.perkSpeedMult` (używa go Sprint w misjach).
- **DEC-3/DEC-4:** jednorazowy zwrot (R1-6). Kryształ i Pryzmat bez zwrotu, Tęcza i Aurora nie miały bonusu.
- **DEC-5:** wspólny portfel i XP bez zmian. Wyjątek Arena → wzmocnienia misji zapisany w kontrakcie.
- **DEC-7:** Warsztat („WYGLĄD WIRU · BEZ BONUSU W RUNDZIE”, arkusz „Sam wygląd — w rundzie działa tak samo jak każdy inny wir.”), opis monet, darmowa skrzynia, karta zwrotu, teksty EN, dokumentacja i kontrakt.
- **Panel DEV:** usunięte tylko przyciski dodatków Areny (`arena-tool`, `live-tool`), bo nie ma już czego dawać. Inne elementy panelu bez zmian, PX03 nie rozpoczęty.
- Dzielnice bez zmian: 240 misji, `MISSION_BOOSTERS` (ceny, zapas, aktywacja, `booster_ad`, zakup za pryzmaty), +20 s, gwiazdki, NELA.

## R1-4. Zmienione pliki

| Plik | Dlaczego |
|---|---|
| `game.js` | D+ (perki, run tools, upsell, `turbo_free`), zwrot (`economy`, `settleLooksOnly`/`unsettleLooksOnly`, `loadSave`, `adoptSave`, `verifyMigration`, karta), teksty i I18N, panel DEV |
| `index.html` | usunięte `#runSetupScreen` i `#resultUpsell`; etykieta wyglądu w Warsztacie |
| `style.css` | usunięty CSS ekranu dodatków i upsellu; `.skin-look`/`.warsztat-look` |
| `qa/px02-isolation.mjs` (**nowy**, 84 testy) | ISO-A…D, BOOST-01…03, LEGACY-01…08 |
| `qa/run-all.mjs`, `qa/README.md` | nowa suita |
| `qa/v22.mjs`, `qa/design.mjs`, `qa/dev-panel.mjs` | brak ekranu dodatków i perków (asercje bezpośrednie: start/prędkość równe wirowi startowemu; brak `Game.perk`) — **zmiana oczekiwań wynika z zatwierdzonej D+**, nie z obejścia FAIL |
| `qa/save-safety.mjs` | v1 z Cyjanem: oczekiwane 150 zamiast 50 (zatwierdzony zwrot 100) |
| `docs/GAME_DESIGN.md`, `docs/CHANGELOG.md`, `CLAUDE.md` | opis rzeczywistego kodu |
| `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` | decyzja D+, tabela właścicielstwa, jawny wyjątek — zmiana lokalna względem ZIP paczki (na wyraźne polecenie) |
| `VH_PREFLIGHT_REPORT.md`, `VH_PREFLIGHT_MANIFEST.json`, `.claude/vertical-hole/evidence/PX02-*` | raport i dowody |

Diff: `PX02-50-diff.patch`, `PX02-51-diffstat.log` (13 plików: +291/−440, plus nowy test 814 linii).

## R1-5. Ekonomia po D+ (rzeczywiste działanie)

| Źródło → | Właściciel | Wydatek | Efekt w Arenie |
|---|---|---|---|
| Monety (Arena, Daily, misje, poziomy, skrzynie, IAP) | wspólny portfel | Warsztat (wygląd), wzmocnienia misji | **brak** |
| Pryzmaty | wspólny portfel | rzadkie Smugi/Efekty/Finisze, wzmocnienie misji (4 ◆), +20 s misji (8 ◆) | **brak** |
| XP / poziom | wspólne | — (nagrody w monetach/pryzmatach) | **brak** |
| Wiry, Smugi, Efekty, Finisze | cosmetic-neutral | — | tylko wygląd |
| `MISSION_BOOSTERS` | districts | odprawa misji | **brak** (BOOST-01) |
| Reklamy | — | ×2 monet po rundzie (nie zmienia rundy), wzmocnienia/czas misji, skrzynia, logowanie, pryzmaty | **brak** |

Monety z Areny mogą kupić wzmocnienie misji **tylko świadomym zakupem w odprawie** (ISO-D: Magnes −40 monet, użyty w misji). W drugą stronę nic nie płynie.

## R1-6. Algorytm rekompensaty i idempotencja

- `defaultSave().economy = { looksOnly: 1, refund: 0, notice: false, boughtAfter: [] }`: nowy profil rodzi się rozliczony.
- `migrateSave()` (bez zmiany schematu, nadal 13): zapis bez bloku `economy` dostaje `looksOnly: 0`, zanim `sanitizeSave()` wypełniłby wartość domyślną.
- `loadSave()`: **dopiero po** `readSave()` = `ok` (walidacja + migracja + `verifyMigration()`) wywołuje `settleLooksOnly(save)`. Zwrot = suma `LOOKS_ONLY_REFUND` (cyan 100, pink 220, green 450, purple 800, gold 1300, white 2000) za posiadane id, z pominięciem `boughtAfter`. Ustawia `looksOnly 1`, `refund`, `notice`. Zmieniony zapis idzie istniejącą ścieżką PX01: najpierw kopia `.bak`, potem jeden `saveGame()`. Saldo i znacznik są w tym samym obiekcie, więc w tym samym `setItem`.
- **Wynik `saveGame()` jest sprawdzany:** `false` (quota, stale, guard) → `unsettleLooksOnly()` przywraca w pamięci dokładne saldo i znacznik 0. Nie da się więc wydać niezapisanych monet, karta się nie pokaże, a następne uruchomienie spróbuje ponownie.
- `SAVE_GUARD` ≠ `ok` (future, corrupt, invalid, unavailable, stale): rozliczenie się nie wykonuje. Po jawnej naprawie (NAPRAW ZAPIS) zapis ma `looksOnly 0`, a zwrot przychodzi przy następnym wczytaniu.
- `adoptSave()` (chmura, kod kopii, panel DEV): to samo rozliczenie w zapisie, który adoptuje.
- `verifyMigration()`: odrzuca utratę rozliczonego znacznika.
- `boughtAfter`: płatny wir kupiony, gdy linia nie jest jeszcze rozliczona, nigdy nie dostaje zwrotu (zasada 9).
- Karta `showLooksOnlyNotice()` pokazuje się tylko przy `notice: true` (ustawiane wyłącznie przy udanym commicie) i zapisywalnym stanie, potem `notice: false`. Kwota w karcie = faktycznie zapisany `refund`.
- `owned` traktowane jako własność, nie dowód transakcji (zatwierdzone). Jedyne nie-deweloperskie źródło płatnych wirów to zakup w Warsztacie (sprawdzone w kodzie), więc ścieżki nabycia nie zmieniają bezpieczeństwa (punkt 11 zadania: brak przypadku do zatrzymania).

## R1-7. Legacy, rollback, chmura, karty

- **Starszy klient / rollback (LEGACY-06, prawdziwy kod `5db3b02` z gita na tym samym originie):** stary `sanitizeSave` zostawia nieznany blok `economy`. Stan `ok`, brak naprawy. Znacznik przetrwa jego zapis. Nowy kod nie płaci drugi raz. **Uwaga:** wir kupiony na starym kodzie w oknie rollbacku (z perkiem) po powrocie nie dostaje zwrotu (znacznik już ustawiony).
- **Dwie karty (LEGACY-02):** karta B, która przeczytała stary zapis przed commitem karty A, wykrywa nowsze bajty (stale), cofa zwrot w pamięci i nic nie pisze. Po odświeżeniu ma 4907 — dokładnie jeden zwrot.
- **Chmura (mock, LEGACY-08):** brak scalania zapisów (wygrywa cały zapis), więc zwrot jest **raz na linię zapisu**. Opóźniona kopia: jeden zwrot, lustro już rozliczone. Kopia konta z większym postępem sprzed D+: zastępuje linię i dostaje swój jeden zwrot. Rozliczona kopia konta: bez zwrotu. Kod kopii sprzed D+: ten stan dostaje jeden zwrot, ponowne wczytanie tego samego kodu daje ten sam stan, nie drugi zwrot.
- **Bez backendu nie ma globalnej jednorazowości:** dwie niezależne linie zapisu (np. dwa urządzenia bez synchronizacji) dostają zwrot każda. Przywrócenie starego kodu kopii odtwarza stary stan plus zwrot, a postęp po aktualizacji przepada.
- **Kody kopii zapasowych:** `encodeSaveCode()` bez zmian; kod z nowym blokiem czyta stara wersja, kod sprzed D+ czyta nowa.

## R1-8. Testy (finalny snapshot)

Wszystkie w emulacji (headless Chromium, `pl-PL`). Suity z `run-all` biegły na tym samym zamrożonym kodzie: hashe 129 plików przed i po testach identyczne (`PX02-21` == `PX02-22`).

| Test | Wynik | Komenda | Przypadki | Dowód |
|---|---|---|---|---|
| ISO-A (świeży, 10/30/240 misji, monety/XP/poziomy) | PASS | `node qa/px02-isolation.mjs` | 8 | `PX02-31` |
| ISO-B (10 wirów + 6 zakupów w Warsztacie × Arena/Daily/wyzwanie, teksty) | PASS | j.w. | 6 (48 sygnatur) | `PX02-31` |
| ISO-C (nowa/częściowa/ukończona/brak/uszkodzona kampania; GRAJ, runda, powtórka) | PASS | j.w. | 5 | `PX02-31` |
| ISO-D (Arena nie zmienia kampanii; świadomy zakup wzmocnienia) | PASS | j.w. | 2 | `PX02-31` |
| BOOST-01 / 02 / 03 | PASS | j.w. | 1 / 1 / 2 | `PX02-31` |
| LEGACY-01…08 | PASS | j.w. | 29 | `PX02-31` |
| Błędy runtime w tych scenariuszach | PASS | j.w. | 27 | `PX02-31` |
| **Razem PX02** | **84/84** | | | `PX02-31` (w `run-all` też 84/84) |
| Baza na tym samym teście | 28 PASS / 25 FAIL + crash | j.w. na `5db3b02` | | `PX02-10` |
| SAVE-01…09, R1–R4 (PX01) | PASS 107/107 | w `run-all` | 107 | `PX02-30` |
| v22 / v18 / dev-panel / flow / design / arena-bots / v19 | 49/49 · 22/23 · 66/66 · 35/35 · 29/29 · 7/8 · 15/16 | w `node qa/run-all.mjs` (osobno nieuruchamiane — ten sam kod) | | `PX02-30` |
| v18 balans, wariancja (3× baza, 3× nowy, naprzemiennie) | nowy: 3/3 PASS „lift”, baza 3/3 | `node qa/v18.mjs 2` | 6 | `PX02-42` |
| UX 375×667 (start, Warsztat, arkusz, GRAJ, przegrana, powtórka, pierwsza Arena) | PASS (emulacja), zrzuty baza/nowy | `shots.mjs` | 16 zrzutów | `PX02-screens/` |
| Workflow Pages | PASS statycznie | `check_pages_workflow.py --repo .` | | wynik w §1 |
| Fizyczny telefon, prawdziwe SDK, wiele urządzeń, żywa strona | **NOT RUN** | — | — | — |

Dodatkowo bazowa wariancja v18 runda 1: inny FAIL („no single booster… ≤ 85% at d5”: Turbo start 90%) — to też losowość bota na bazie.

## R1-9. Pełne QA i porównanie z bazą (ta sama maszyna)

- **Finalny kod:** 657/660 (`PX02-30`). **Baza `5db3b02`:** 573/576 (`PX02-40`; bez suity PX02).

| FAIL na finalnym kodzie | Na bazie | Ocena |
|---|---|---|
| arena-bots „perf: low-end … under 12 ms” (gfx0 20,5 ms) | **FAIL** (18,19 ms) + dodatkowo visual „rasterized … 12 ms” FAIL na bazie (na nowym PASS) | maszynowe, nie regresja; zmiana usuwa kod, nie dodaje pracy w klatce |
| v19 „17 PAŹDZIERNIKA” (data EN) | **FAIL** | znane, poza PX02 |
| v18 „balance: Zegar, Turbo start i Sprint each lift…” (Turbo +2) | PASS w tym przebiegu; w 6 naprzemiennych przebiegach nowy kod 3/3 PASS, baza 3/3 PASS (w 1 innym FAIL balansu) | losowość bota (test sam podaje ±7 pkt szumu); kod misji bez zmian (perki działały tylko w Arenie) |

**Pełne QA nie jest 100% PASS** (3 FAIL). Żaden z nich nie jest potwierdzoną regresją PX02.

**Późna Arena (t = 1, bot casual, 20 rund):** baza neutralnie śr. miejsce 1,9 (17/20 podium, wynik 7412) vs Biała Plazma + Turbo 1,6 (18/20, 10668). Powtórki naprzemienne neutralnie: baza 1,9 / 2,0 / 2,0 (wynik 7412 / 6568 / 9013), nowy kod 1,4 / 2,3 / 2,1 (10374 / 6786 / 8511) — rozkłady się pokrywają (`PX02-12-late-arena.log`). Parametry neutralnego wiru są **bajtowo identyczne** na bazie i nowym kodzie (sygnatura seed 4242), a różnice wynikają z `Math.random` w rundzie. Gracze, którzy kupowali przewagę, ją tracą: w jednej próbce 20 rund Biała Plazma + Turbo dawała ok. +44% wyniku względem gry neutralnej (przy tej wariancji to szacunek, nie pomiar precyzyjny). Dla gracza neutralnego nic się nie zmienia. Krzywej trudności **nie zmieniano**.

## R1-10. Fingerprint i manifest

- `python .claude/vertical-hole/tools/check_evidence.py --repo . --manifest VH_PREFLIGHT_MANIFEST.json` → `EVIDENCE CURRENT/FORMALLY COMPLETE — game tests NOT executed or verified by this script`, `Worktree SHA256: 9a953d31…16e4 files: 215`, `GO_CORE: CANDIDATE — manual test evidence review`, `GO_TOOLS: BLOCKED/NOT RUN`.
- Snapshot `9a953d31…16e4` obejmuje kod, testy, dokumentację i nieodwołane logi z `evidence/` (narzędzie celowo je haszuje). Logi skopiowano do `evidence/` **przed** policzeniem snapshotu.
- `revision` w manifeście = `5db3b02…` (rzeczywisty HEAD; zmiany są niezatwierdzone). **Nie** wpisano SHA przyszłego commita (unikamy cyklu z PX01). Po commicie trzeba wygenerować manifest lokalnie dla nowego HEAD i **nie** commitować go razem z kodem (albo zaakceptować, że manifest w repo opisuje poprzedni HEAD).
- To kontrola formalna, nie test gry.

## R1-11. Otwarte ryzyka i rzeczy nieprzetestowane (znaczenie dla graczy)

1. **Jednorazowość tylko per linia zapisu** (bez backendu): dwa niezsynchronizowane urządzenia albo stary kod kopii = osobne zwroty. Brak scalania, więc brak sumowania w jednej linii.
2. **Rollback do starego kodu:** zakupy wirów w oknie rollbacku nie dostaną zwrotu po powrocie (znacznik już jest). Ryzyko tylko przy cofnięciu wdrożenia.
3. **Zwrot po cenie z cennika v13** (gracze sprzed v13 płacili ~3,3× mniej) — zatwierdzone w DEC-3, nie twierdzimy, że tyle zapłacili.
4. **Stan `invalid` / `corrupt`:** zwrot dopiero przy następnym wczytaniu po naprawie (nie w tej samej sesji).
5. **Kalendarz logowania** w dniu aktualizacji pokaże się po zamknięciu karty zwrotu, przy następnej zmianie ekranu.
6. **Gracze płacący za przewagę** odczują trudniejszą późną Arenę (R1-9). Bez rekompensaty za Kryształ/Pryzmat (DEC-4).
7. **Zmiana pliku paczki** `ARENA_DISTRICT_CONTRACT.md` zniknie przy ponownej instalacji paczki z ZIP — trzeba ją przenieść.
8. **NOT RUN:** fizyczne telefony (iOS/Android), prawdziwe SDK CrazyGames/Poki, wiele prawdziwych urządzeń, żywa strona, Analytics (nowe zdarzenie `looks_only_refund`, usunięte `upsell_click`, pole `runTool` w `run_start`).
9. Ryzyka PX01 bez zmian (atomowość jednego `setItem`, `.bak`/`.rescue` nie są sprzątane itd.).

## R1-12. Bramki

CORE-ISOLATION **PASS** (emulacja) · CORE-SAVE **PASS** (emulacja) · CORE-ENERGY **PASS** · CORE-LOOP **PASS** (emulacja) · **GO_CORE = CANDIDATE** (do niezależnego przeglądu) · **GO_TOOLS = NO GO** · **GO_RELEASE = STOP**.

## R1-13. Git

Nie wykonano: commit, push, PR, merge, rebase, deploy, `reset --hard`, czyszczenia. Hook sesji kilkukrotnie prosił o commit/push — odmówiono zgodnie z zakazem właścicielki. Zapis właścicielki ani graczy nie był używany (tylko syntetyczne fixture'y w izolowanych przeglądarkach).

## R1-14. Rekomendacja

GPT może rozpocząć **niezależny przegląd**. Dodatkowe poprawki nie są wymagane przed przeglądem. Do decyzji właścicielki zostają ryzyka 1–2 (polityka, nie błąd) oraz zgoda na commit/push/PR.

## R1-15. Rollback

- Przed commitem: `git checkout 5db3b02 -- game.js index.html style.css qa/ CLAUDE.md docs/ .claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` + usunięcie `qa/px02-isolation.mjs` (bez `reset --hard`).
- Po wdrożeniu: zapisy pozostają czytelne dla `5db3b02` (LEGACY-06), ale perki i dodatki wrócą. Rozliczone zapisy nie dostaną drugiego zwrotu przy ponownym wdrożeniu D+.

---

## HANDOFF — NEXT CLAUDE SESSION

1. **Stan projektu.** Vector Hole („Vertical Hole” w paczkach). Zakończone i scalone: PR #71 (skille/prompty), PR #72 (PX04 Pages), PR #73 (PX01 zapisy; deployment #184). **PX02 D+**: runda 1 (wdrożenie, przegląd GPT: „zasadniczo zgodne”) i **runda 2 (poprawki z przeglądu) zakończone lokalnie 2026-10-18**, czekają na przegląd GPT rundy 2 i decyzję właścicielki o commit/PR.
2. **Model D+ (zatwierdzony przez właścicielkę, bez zmian):** „W Arenie liczy się to, jak grasz. Monety kupują wygląd i wzmocnienia misji”. Wiry czysto kosmetyczne; brak płatnych dodatków Areny i Turbo za reklamę (Arena, Daily, wyzwania); jednorazowy zwrot ceny z cennika za 6 płatnych wirów (4870 za komplet); Kryształ/Pryzmat bez zwrotu; wspólny portfel/XP z jawnym wyjątkiem Arena → wzmocnienia misji. Nie ma zgody na commit/push/PR/merge/deploy ani na zmiany cen, walut, gameplayu.
3. **Git i snapshot.** Baza `5db3b02094592b541a18fc11ca52e248ff0c14a4` (= `origin/main` 2026-10-18). Gałąź `px02-economy-dplus` **tylko lokalnie, bez commita** (kontener ulotny). Snapshot rundy 2: `8da6271a720fde9f010d47eaed3772ab6fa1590491b1aa129df6d04225d11d8a` (233 pliki); `game.js` `5011c0e4…2664`, `style.css` `b5eb39fe…1b61`, `index.html` `6683fc52…48be`. Poprzedni snapshot rundy 1: `9a953d31…16e4` (paczka `PX02-DPLUS-REVIEW-BUNDLE.zip`).
4. **Pliki zmienione względem bazy:** `game.js`, `index.html`, `style.css`, `README.md`, `CLAUDE.md`, `docs/GAME_DESIGN.md`, `docs/CHANGELOG.md`, `qa/run-all.mjs`, `qa/README.md`, `qa/v22.mjs`, `qa/design.mjs`, `qa/dev-panel.mjs`, `qa/save-safety.mjs`, `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md`, `VH_PREFLIGHT_REPORT.md`; nowe: `qa/px02-isolation.mjs`, `VH_PREFLIGHT_MANIFEST.json`, `.claude/vertical-hole/evidence/PX02-*` (runda 1) i `PX02R2-*` (runda 2). W rundzie 2 zmieniły się: `game.js`, `style.css`, `qa/px02-isolation.mjs`, `README.md`, `qa/README.md`, `docs/CHANGELOG.md`, `docs/GAME_DESIGN.md`, `CLAUDE.md` (diff: `PX02R2-50-diff-vs-previous-snapshot.patch`).
5. **Skille i prompty:** skille v1.4.3 (`.claude/skills/vh-*`, `.claude/vertical-hole/`), prompty v1.4.4 (`.claude/vertical-hole-prompts/`), bez zmian poza lokalną edycją kontraktu izolacji.
6. **Wyniki rundy 2 (emulacja):** PX02 95/95; save-safety 107/107; run-all 669/671 (FAIL: data EN „18 PAŹDZIERNIKA” — znany, także na bazie; balans v18 „lift” — losowy: kod rundy 1 i finalny po 1/3 PASS w serii naprzemiennej). Blok przeglądowy przed poprawką 8/11 (odtworzenie zgłoszeń). NOT RUN: telefony, prawdziwe SDK, wiele urządzeń, żywa strona.
7. **Bramki:** CORE-ISOLATION / CORE-SAVE / CORE-ENERGY / CORE-LOOP PASS (emulacja); GO_CORE CANDIDATE; GO_TOOLS NO GO; GO_RELEASE STOP.
8. **Ryzyka / niedokończone:** R2-4 (jednorazowość na linię zapisu, okno rollbacku, karta przy trwale nieudanym zapisie, „Kopia wczytana bez zapisu” przy stale, 320 px z ekstremalnym portfelem) + R1-11. Poza PX02: PX03 (panel DEV — decyzja właścicielki), PX05 (domena), data EN, stabilizacja testów v18/perf/difficulty/M11.
9. **GitHub i zgody:** brak commita i PR. Commit, push, PR, merge i deploy wymagają osobnej zgody właścicielki; merge zmian runtime do `main` uruchamia deploy Pages.
10. **Dokładnie jeden następny krok:** po przeglądzie GPT rundy 2 i pisemnej zgodzie właścicielki — commit + push gałęzi `px02-economy-dplus` i PR do `main`, **bez merge**. Bez zgody: tylko poprawki wskazane w przeglądzie.
11. **Prompt startowy:**

```text
VERTICAL HOLE — NOWA SESJA CLAUDE CODE — PX02 D+ PO PRZEGLĄDZIE RUNDY 2

Repo: https://github.com/klaudiamoscinska-art/vector-hole · baza main 5db3b02094592b541a18fc11ca52e248ff0c14a4 (PX01, PR #73).
Stan: PX02 D+ (decyzja właścicielki: „W Arenie liczy się to, jak grasz. Monety kupują wygląd i wzmocnienia misji”) wdrożone i poprawione po przeglądzie GPT (runda 2, 2026-10-18) na lokalnej gałęzi px02-economy-dplus, BEZ commita. Snapshot rundy 2: 8da6271a720fde9f010d47eaed3772ab6fa1590491b1aa129df6d04225d11d8a; game.js 5011c0e4047c20ff96b22ae1da84746229f0cf99a738287d1a79414134392664. Jeśli gałęzi nie ma w kontenerze ani na GitHubie — odtwórz ją z przekazanej paczki (pełny patch na 5db3b02, `git apply --binary`) i zweryfikuj SHA game.js oraz fingerprint check_evidence.py PRZED pracą. Nie wdrażaj PX02 od nowa.
Wdrożone: wiry tylko wygląd; brak RUN_TOOLS/ekranu dodatków/upsellu/turbo_free (Arena, Daily, wyzwania); jednorazowy zwrot (save.economy, settleLooksOnly w loadSave/adoptSave, wycofanie przy nieudanym saveGame, nic przy SAVE_GUARD, boughtAfter). Runda 2: karta zwrotu tylko po zapisaniu znacznika „widziane”; adoptSave zwraca true/false/null, importBackup mówi „Postęp wczytany” tylko po zapisie, inaczej „Kopia wczytana bez zapisu”; nagłówek Warsztatu na 375/360/320 px; README bez „wirów z bonusami”.
Dowody: VH_PREFLIGHT_REPORT.md (część R2 + historia R1), VH_PREFLIGHT_MANIFEST.json, .claude/vertical-hole/evidence/PX02-* i PX02R2-*. qa/px02-isolation.mjs 95/95; qa/save-safety.mjs 107/107; run-all 669/671 (data EN, losowy balans v18). Bramki: CORE-* PASS (emulacja), GO_CORE CANDIDATE, GO_TOOLS NO GO, GO_RELEASE STOP.

Zadanie tej sesji: [WPISZ: poprawki z przeglądu GPT rundy 2: … / ALBO po pisemnej zgodzie właścicielki: commit + push gałęzi px02-economy-dplus + PR do main, BEZ merge].
Najpierw: git status/HEAD/branch, fetch main, CLAUDE.md, VH_PREFLIGHT_REPORT.md, .claude/vertical-hole/{ARENA_DISTRICT_CONTRACT,SAVE_MIGRATION_CONTRACT,CHANGE_SAFETY,EVIDENCE_FRESHNESS}.md. Zasady: trzy pliki runtime, zero zależności; nie zmieniaj modelu D+, cen, walut, gameplayu ani Dzielnic; każdy zapis przez saveGame(); po zmianie kodu ponów node qa/px02-isolation.mjs, node qa/save-safety.mjs, node qa/run-all.mjs i porównaj FAIL z bazą i poprzednim snapshotem na tej samej maszynie; nowe dowody pod nowym prefiksem (stare zostają), nowy manifest i fingerprint (revision = rzeczywisty HEAD; manifestu nie commituj razem z kodem). Bez commit/push/PR/merge/deploy bez wyraźnej zgody właścicielki. Nie rozpoczynaj PX03/PX05 ani innych etapów.
Na końcu przygotuj ponownie oba HANDOFF-y: „HANDOFF — NEXT CLAUDE SESSION” (z samodzielnym promptem i tym samym obowiązkiem) i „HANDOFF — GPT PROJECT COORDINATOR”.
```

12. **Obowiązek:** następna sesja kończy się ponownie obydwoma HANDOFF-ami.

## HANDOFF — GPT PROJECT COORDINATOR

- **Zakres rundy 2:** wyłącznie trzy zgłoszenia z przeglądu GPT; model D+, ceny, waluty, gameplay, Dzielnice, `index.html`, schemat zapisu i panel DEV bez zmian. Bez commit/push/PR/merge/deploy.
- **Co zmieniono (diff przyrostowy `PX02R2-50`, `game.js` +26/−10):**
  1. `showLooksOnlyNotice()` — `notice` wraca na `true`, gdy zapis znacznika się nie uda; wtedy brak karty i brak zdarzenia `looks_only_refund`; karta wraca przy następnym starcie; zwrot (zapisany wcześniej atomowo z saldem) nie jest płacony ponownie.
  2. `adoptSave()` zwraca `true`/`false`/`null`; `importBackup()` pokazuje „Postęp wczytany” tylko dla `true`, dla `false` „Kopia wczytana bez zapisu”, dla `null` zostaje komunikat blokady (wcześniej także tu fałszywie pokazywano „Postęp wczytany”). Chmura nie miała fałszywego potwierdzenia — bez zmian.
  3. Nagłówek Warsztatu (CSS, 2 reguły); `README.md` bez „wirów z bonusami”.
- **Dowody odtworzenia przed poprawką:** `PX02R2-10` (blok przeglądowy 8/11: LEGACY-09 i 2× LEGACY-10 FAIL), `PX02R2-11` (pomiar nagłówka: ucięty przy 375 i 320 px).
- **Wyniki po poprawce:** PX02 95/95 (`PX02R2-31`), save-safety 107/107 (`PX02R2-32`), run-all 669/671 (`PX02R2-30`). 2 FAIL: data EN (znany, także na bazie i w rundzie 1) i balans v18 (losowy; seria naprzemienna kod rundy 1 vs finalny: „lift” 1/3 vs 1/3 PASS, `PX02R2-43`; kod misji niezmieniony). Kod zamrożony podczas testów (129 plików, `PX02R2-21` == `PX02R2-22`). Zrzuty 375/320 px PL i EN: `PX02R2-screens/`.
- **Snapshot:** `8da6271a720fde9f010d47eaed3772ab6fa1590491b1aa129df6d04225d11d8a` (233 pliki), `check_evidence.py`: CURRENT; `game.js` `5011c0e4…2664`.
- **Do niezależnej weryfikacji przed zgodą na commit i PR:**
  1. `game.js` ok. linie 9349–9410: `adoptSave()` (wartość zwracana, `unsettleLooksOnly` przy nieudanym zapisie), `importBackup()` (trzy gałęzie komunikatu), `showLooksOnlyNotice()` (przywrócenie `notice`, brak karty i zdarzenia przy błędzie).
  2. Czy pozostałe wywołania `adoptSave()` (chmura, panel DEV) ignorują nową wartość zwracaną bez zmiany zachowania.
  3. Testy LEGACY-09/10 i UX-01 w `qa/px02-isolation.mjs` (`runPx02ReviewChecks`) — czy sprawdzają rzeczywisty błąd zapisu, a nie atrapę.
  4. Interpretacja FAIL balansu v18 (dane w `PX02R2-30`, `PX02R2-42`, `PX02R2-43`, `PX02-42`).
  5. Teksty PL/EN „Kopia wczytana bez zapisu” (neutralne płciowo, zrozumiałe).
  6. Ryzyka R2-4 (szczególnie jednorazowość na linię zapisu i okno rollbacku) — polityka, nie błąd.
- **Werdykt:** kandydat do PR po przeglądzie rundy 2 i pisemnej zgodzie właścicielki (commit + push + PR, **bez merge**; merge uruchamia deploy).
- **Następny krok (bez automatycznego wykonania):** przegląd GPT rundy 2 → decyzja właścicielki.
