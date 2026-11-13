# GG-VFX-01 „Premium Swallow Effects” — raport etapu

**Baza:** `7d8a747f77ec1492fed3791196b54510461c8e2f` (`origin/main`, GG-HOLE-01, PR #98) · **Gałąź:** `claude/sharp-johnson-90kv15`
**Środowisko QA:** Linux, Node 22, Chromium headless (renderowanie programowe — bez GPU, bez Safari/iPhone). Baza i kandydat
mierzone na tej samej maszynie, jeden po drugim (baza w osobnym worktree), nigdy równolegle.

## 1. System efektów
Jedna rodzina efektów, stopniowana wagą tego, co wpada (`swallowWeight()`), w niezmienionym oknie czasu pochłonięcia.

| Waga | Co | Co widać |
|---|---|---|
| 0 — małe | T1/T2: fragment, kapsuła, drzewo, ławka, kiosk, latarnia, skrzynia, znacznik, złoty rdzeń | obiekt wślizguje się po spirali i lekko rozciąga, cienka smuga, światło na obręczy w miejscu wejścia, jeden krótki pierścień (łańcuch kęsów: najwyżej jeden puls na 90 ms) |
| 1 — średnie | T3/T4: samochód, węzeł, pylon, pawilon, billboard, magazyn, landmark Areny, portal | cała sylwetka wciągana i rozciągana ku środkowi, powidok, 3 odłamki, linie wiru, obręcz rozświetlona tam, gdzie obiekt ją przekracza; po połknięciu poświata w gardzieli, pierścień i akcent skórki |
| 2 — duże | T5/T6: autobus, tramwaj, ciężarówka, wieżowiec, maszt, kopuła; bossowie dzielnic | wir bierze wdech (rysowany promień −3,5%), bryła unosi się na krawędzi i zapada, 2 powidoki, 6 odłamków, zacieśniające się pierścienie przyciągania, biały żar na obręczy; po połknięciu mocna poświata gardzieli, podwójna fala z obręczy, akcent skórki w pełnej wersji, wir drga jeszcze ~0,4 s |
| 3 — rywal | inny wir (Arena, Kampania; także gdy to gracz zostaje zjedzony) | rywal wpada jako własny wir (jego wygląd i kolor), wyżymany, a jego obręcz rwie się na łuki; odpowiedź: podwójny pierścień (drugi biały) i 8 promieni w kolorze rywala |

- **Sylwetka zostaje.** Obiekt jest rysowany tym samym sprite'em co na planszy; część nad krawędzią (`WorldObject.draw()`,
  `CampaignEntity.draw()`) i część w wirze (`Game.drawSwallowed()`) mają jedną pozę (`swallowLook()`), więc sylwetka jest cała
  w poprzek obręczy. Nic nie jest zastępowane kulą światła. Grafiki T1–T6, tło A2.1, skórki — bez zmian.
- **Akcent każdej skórki** (`GULP_ACCENTS`, średnie i duże kęsy): Horyzont — ciemność wylewa się za krawędź, pierścień fotonowy
  się zaciska (i najsłabsza poświata gardzieli); Cyjan — segmentowe impulsy; Gorący Róż — falujący pierścień plazmy; Toksyczna
  Zieleń — bąble; Ultrafiolet — odrzucone ramiona; Neonowe Złoto — korona rozbłysków; Biała Plazma — wyładowania; Aurora —
  welony; Kryształ — sześciokąt i czteroramienne błyski; Pryzmat — pierścienie widma. Jeden wspólny system, parametry per wygląd.
- **Kosmetyki.** „Efekt pochłaniania” barwi teraz całą energię kęsa gracza (smugę, światło obręczy, pierścień, poświatę), nie
  tylko cząsteczki — jego znaczenie rośnie. Smuga i Finisz nietknięte.
- **Ograniczenia obciążenia.** Kęsy rywali: sam upadek (+ smuga i pierścień od średnich w górę). Ponad 6 rzeczy naraz w jednym
  wirze: małe rysują tylko upadek. Wir mniejszy niż 14 px na ekranie: tylko upadek i pierścień. Jakość 0: upadek, smuga,
  pierścień (dla dużych jeden powidok i poświata); bez odłamków, akcentów i poświat cząsteczek. Lista odpowiedzi wiru: 16 (8).

## 2. Co się zmieniło względem bazy
| | PRZED | PO |
|---|---|---|
| Obiekt w wirze | kurczy się liniowo do 12%, stały obrót | spirala z późniejszym zapadnięciem dla cięższych, uniesienie, rozciągnięcie ku środkowi, przyspieszający obrót |
| Część nad krawędzią | inna skala niż część w wirze, znika po 25% czasu | ta sama poza co w wirze, widoczna dopóki wystaje za obręcz |
| Ślad | brak (tylko cząsteczki po fakcie) | smuga po spirali, powidoki sylwetki, odłamki, linie wiru |
| Reakcja wiru w trakcie | brak | światło na obręczy podąża za obiektem; przy dużych wdech i zacieśnienie |
| Reakcja po połknięciu | biały błysk obręczy przy wzroście (ten sam dla kapsuły i wieżowca) | + pierścień, poświata gardzieli, akcent skórki, drganie — wg wagi |
| Rywal | czarny krążek z kolorową obwódką | własny wir rywala rozrywany na łuki + podwójny pierścień z promieniami |
| Cząsteczki | `shadowBlur` 15 na każdą kropkę w każdej klatce | stempel poświaty (`fxGlow()`), te same cząsteczki i losowania |

Bez zmian (sprawdzone testem V1 na źródle bazy): `swallowPose()` (ścieżka samego obiektu), `handleObjectEating()`,
`handleHoleCollisions()`, `spawnSuck()`, `spawnParticles()`, `hitStop()`, zawartość `triggerEatFeedback()` (dodane jedno
wywołanie), `eatAnimTime` 0,28 s, boss 0,8 s, rywal 0,45 s, `hitStopMs` 70, klucz i wersja zapisu.

## 3. Dowody (`design/vfx1/`, z renderera gry: `node qa/vfx1-shots.mjs --root <baza>` → `node qa/vfx1-publish.mjs`)
- **A/B/C + D:** `board-small-kapsula`, `board-small-drzewo`, `board-medium-samochod`, `board-medium-pawilon`,
  `board-large-autobus`, `board-large-wiezowiec`, `board-boss-landmark` (M20), `board-rival` — PRZED nad PO, 10–12 kolejnych
  klatek tego samego pochłonięcia (kontakt z krawędzią → zasysanie → zanikanie → reakcja wiru).
- **Skórki:** `board-skins` (autobus T5 × 10 skórek), `board-skins-rival` (rywal × 10 skórek). **Jakość 0:** `board-q0`.
- **E:** `shot-arena-large / -small / -rival`, `shot-campaign-boss` (M20), `shot-campaign-vehicle` (M12), `shot-daily-medium` —
  całe ekrany z HUD-em, `-before` / `-after`, 390×844, 800×450, 1366×768.
- **F:** `preview.html` (ta sama strona online: https://claude.ai/artifact/VFhXcezKyimUcLANQXT1nq — prywatna, do udostępnienia
  z menu „Share”) — jedna samodzielna strona: każde pochłonięcie klatka po klatce, PRZED obok PO, 1× / ½× / ¼× / ⅒×,
  pauza i krok (bez uruchamiania gry).
- `facts-before.json` / `facts-after.json`: klatki, punkty, promień i losowania każdego pochłonięcia.

## 4. Mechanika, RNG, zapis — identyczność z bazą
| Pochłonięcie (ta sama runda i ziarno) | Klatki | Punkty | Promień po | Losowania `Math.random` |
|---|---|---|---|---|
| kapsuła T1 | 17 → 17 | +15 → +15 | 33 → 33 | 81 → 81 |
| drzewo T2 | 17 → 17 | +15 → +15 | 54,1429 → 54,1429 | 143 → 143 |
| samochód T3 | 17 → 17 | +30 → +30 | 72,88 → 72,88 | 303 → 303 |
| pawilon T4 | 17 → 17 | +80 → +80 | 105,6 → 105,6 | 303 → 303 |
| autobus T5 | 17 → 17 | +120 → +120 | 143,4 → 143,4 | 303 → 303 |
| wieżowiec T6 | 17 → 17 | +200 → +200 | 184 → 184 | 303 → 303 |
| boss M20 | 48 → 48 | +320 → +320 | 154,4 → 154,4 | 918 → 918 |
| rywal | 27 → 27 | +96 → +96 | 96,7843 → 96,7843 | 306 → 306 |

„Uczta” (600 klatek nieprzerwanego pochłaniania, `qa/vfx1-bench.mjs`): 222 → 222 kęsy, 15 164 → 15 164 pkt,
49 770 → 49 770 losowań. `node qa/perf1.mjs --equiv=7d8a747` (baza kontra kandydat, to samo ziarno): **hash stanu gry
identyczny we wszystkich 34 punktach kontrolnych 9 scen** (Arena ×5, M01, M59, boss, finał); hash pikseli różni się tylko tam,
gdzie w klatce trwa pochłanianie (M01 i scena z bossem identyczne co do piksela); 5 ekranów menu identycznych; **zapis po
rundzie Areny (14 123 = 14 123 pkt), po M01 i po M59 — IDENTYCZNY**. Nowy kod nie zawiera `Math.random` / `rand()` (V1);
zapis nie dostał żadnego pola (`SAVE_SCHEMA_VERSION` 13, klucz `vectorHoleSave_v1`).

## 5. Wydajność (ta sama maszyna, renderowanie programowe, DPR 2; baza → kandydat)
**Realne sceny** (`node qa/perf1.mjs`, 25/25 PASS na bazie i na kandydacie), czas klatki w ms:

| Scena | p50 | p95 | p99 | max |
|---|---|---|---|---|
| Arena, wir bliski maksimum + duzi rywale | 24,9 → 24,2 | 30,9 → 31,4 | 36,7 → 33,6 | 38,8 → 38,9 |
| Późna Arena (85–90 s) | 28,5 → 29,0 | 38,5 → 34,2 | 42,0 → 40,2 | 57,3 → 41,9 |
| Misja M59, późna faza | 10,3 → 10,8 | 19,2 → 21,0 | 22,4 → 23,8 | 28,8 → 27,4 |

**Najgorszy przypadek** — „uczta” (`node qa/vfx1-bench.mjs --root <baza>`: wir r = 150 pochłania bez przerwy — 2 małe co
3 klatki, średni co 20, duży co 45, rywal co 90; baza i kandydat na zmianę, mediana z powtórzeń), render + raster w ms:

| Ekran / jakość | mediana | p95 | p99 |
|---|---|---|---|
| iPhone 390×844, jakość 2, uczta | 21,4 → 25,2 | 27,6 → 31,3 | 32,7 → 36,8 |
| iPhone 390×844, jakość 2, bez pochłaniania | 14,7 → 15,5 | 19,4 → 20,2 | 22,5 → 24,1 |
| iPhone 390×844, jakość 0, uczta | 5,0 → 6,2 | 7,3 → 8,7 | 8,7 → 10,5 |
| iPhone 390×844, jakość 0, bez pochłaniania | 3,6 → 3,7 | 5,1 → 5,2 | 6,6 → 6,0 |
| Desktop 1366×768, jakość 2, uczta | 48,4 → 55,0 | 58,8 → 65,1 | 70,1 → 76,9 |
| Desktop 1366×768, jakość 2, bez pochłaniania | 40,3 → 39,8 | 50,5 → 48,3 | 57,3 → 58,0 |
| Desktop 1366×768, jakość 0, uczta | 11,0 → 12,5 | 15,1 → 15,5 | 18,6 → 17,5 |

Wniosek: poza pochłanianiem koszt klatki bez zmian (różnice w granicy szumu); w zwykłej rozgrywce brak mierzalnej różnicy;
w sztucznie nieprzerwanej uczcie +3,8 ms (jakość 2) i +1,2 ms (jakość 0) na klatkę w renderowaniu programowym. Rozmiar:
`game.js` 1 223 931 → 1 250 700 B (+26,8 KB; gzip +7,9 KB), zero nowych plików runtime. GPU, Safari i iPhone: **NOT VERIFIED**.

## 6. Bramki (P00-CORE etapu; baza i kandydat, te same zestawy)
| Bramka | Wynik | Dowód (baza → kandydat) |
|---|---|---|
| CORE-ENERGY | PASS | `qa/v22.mjs` 49/49 → 49/49 |
| CORE-ISOLATION | PASS | `qa/px02-isolation.mjs` 95/95 → 95/95 w 3 z 4 przebiegów (w tym na ostatecznym kodzie); 1 przebieg 94/95 — patrz „Niestabilne” |
| CORE-LOOP | PASS | `qa/visual.mjs` 20/20 → 20/20; `qa/flow.mjs` 35/35; `qa/leave-run.mjs` 22/22 → 22/22; `qa/design.mjs` 28/29 → 29/29 |
| CORE-SAVE | PASS | `qa/save-safety.mjs` 107/107 → 107/107; brak nowych pól, schemat 13 |
| GG-VFX-01 | PASS | `qa/vfx1.mjs` 39/39 (nowy zestaw) |
| Mechanika / RNG | PASS | §4: 8/8 pochłonięć i uczta identyczne z bazą; `qa/perf1.mjs --equiv`: stan 34/34, zapisy 3/3 identyczne |
| Obiekty / tło / wiry | PASS | `qa/objects2.mjs` 15/15, `qa/objects3.mjs` 19/19, `qa/objects4.mjs` 15/15, `qa/visual2.mjs` 19/19 — bez zmian |
| Wydajność | PASS | `qa/perf1.mjs` 25/25 → 25/25; §5 |
| CrazyGames (paczka) | PASS z FAIL jak na bazie | `qa/crazygames-basic1.mjs`: 4 kontrole blokady wskaźnika FAIL identycznie na bazie (5) w tym środowisku |
| DEPLOY-PAGES | PASS (statycznie) | `qa/release.mjs` 93/93, `qa/release-recovery.mjs` 81/81, `check_pages_workflow.py` PASS; `.github/` bez zmian |
| Instrukcje / most QA / start | PASS | `qa/instructions.mjs` 4/4, `qa/bridge.mjs` 20/20 (lista eksportów bez zmian), `qa/boot.mjs` 9/9 |
| TOOLS-DEV | bez zmian | panel dev nietknięty |

**Zastane FAIL (potwierdzone na bazie, niezwiązane):** `qa/crazygames-basic1.mjs` — blokada wskaźnika (pointer lock) nie działa
w headless Chromium tego środowiska (baza 5 FAIL, kandydat 4 FAIL, te same kontrole); `qa/design.mjs` „close race” — FAIL na
bazie, PASS na kandydacie (zależne od ziarna).
**Niestabilne (nie regresja):** `qa/px02-isolation.mjs` ISO-B „bought:gold” — 1 FAIL w 4 przebiegach kandydata (`bitePoints` 11
zamiast 5). Test zostawia na planszy jeden fragment i nie ustawia ziarna `Math.random`; po zjedzeniu fragment odradza się w losowym
miejscu i z małym prawdopodobieństwem trafia ponownie w zasięg wiru (drugi kęs z combo: 5 + 6). Etap nie dotyka odradzania ani
zasięgu (V1), a ścieżka pochłaniania zużywa tyle samo losowań co baza (§4).
**NOT RUN:** `qa/run-all.mjs` (całość), `qa/balance1.mjs`, `qa/content.mjs`, `qa/calibrate.mjs`, `qa/difficulty.mjs`,
`qa/arena-bots.mjs`, `qa/campaign-bots.mjs`, `qa/responsive.mjs`, `qa/devices.mjs`, `qa/ftue1.mjs`, `qa/ftue3.mjs`, `qa/v15`–`v21`,
`qa/audio.mjs`, `qa/dev-panel.mjs`, `qa/workshop-buy.mjs`, `qa/cg-*.mjs`, `qa/gameready1.mjs`, `qa/deviceqa1.mjs`, `qa/visual1.mjs`,
`qa/trace.mjs`, `qa/edge-cases.mjs`, `qa/features.mjs` — zakres: krótkie, celowane QA (decyzja właścicielki); etap zmienia tylko
rysowanie pochłaniania.
**NOT VERIFIED:** fizyczny iPhone / Safari, GPU, portal CrazyGames (podgląd w portalu).

## 7. Ryzyka
- Płynność na prawdziwym iPhonie przy intensywnym pochłanianiu nie jest tu mierzalna. Zabezpieczenia: automatyczne obniżanie
  jakości (`monitorFrame()`), jakość 0 z okrojonymi efektami, limity listy i tłumu.
- Odczucie „ciężaru” jest oceną estetyczną — wymaga oceny właścicielki na urządzeniu (rozmiar efektu rośnie z wirem).
- Efekty używają mieszania addytywnego (`lighter`): na bardzo jasnych kaflach tła mogą być słabiej widoczne niż na ciemnych.

## 8. Test na fizycznym iPhonie
1. Otwórz grę w Safari (i z ikony na ekranie głównym), odśwież stronę. Arena, 2–3 pełne rundy.
2. Początek rundy: jedz ciąg fragmentów i kapsuł — ma być lekko i czytelnie, bez migotania i bez zasłaniania planszy.
3. Środek: samochód / pawilon — widać całą sylwetkę wciąganą do środka, obręcz świeci w miejscu wejścia, po połknięciu pierścień.
4. Końcówka: autobus / wieżowiec — wir „bierze wdech”, bryła się zapada, podwójna fala, wir chwilę drga. Czy czuć różnicę wagi?
5. Zjedz rywala i daj się zjeść — rywal wpada jako własny wir, odpowiedź w jego kolorze.
6. Kampania: misja z bossem (np. M20) i misja z ciemnością / glitchami; Wyzwanie dnia.
7. Warsztat: zmień skórkę (min. Horyzont, Kryształ, Gorący Róż, Cyjan) i „Efekt pochłaniania” — akcent i kolor energii się zmieniają.
8. Zwróć uwagę na: przycięcia w tłoku późnej Areny, nagrzewanie, czy gra sama obniża jakość, „duchy” obiektów po zjedzeniu.
