# CITY-2 „Drugi brzeg” — Core City LVL 7–12

Baza: `origin/main` = `0e67e2fd0d2a609000a2bca93c2166619933f524` (PR #105), zweryfikowana przed pracą.
Gałąź: `claude/youthful-heisenberg-og19pj` (wyznaczona dla sesji, od aktualnego `main`, bez scalonych gałęzi poprzednich etapów).
Zakres: `game.js` (rysowanie miasta, karta Miasta, mapa nagród, wynik rundy, `I18N_EN`), `index.html` (przełącznik, id prefiksu),
`style.css` (przełącznik, szyna 7–12), `qa/`, `design/city2/`, dokumentacja. Bez zmian: zapis (klucz, wersja 13, pola), przyrost
Core City, nagrody LVL 2–6, premia LVL 7+, Arena, kampania, ekonomia, `.github/`, release, paczka CrazyGames.

## 1. Jak działało Core City (prześledzone przed zmianą)

- Zapis: `save.hub.coreLevel` (start 1) i `save.hub.coreCharge` (%), w `defaultSave()`; `sanitizeSave()` robi z poziomu liczbę
  całkowitą ≥ 1 (bez górnej granicy), ładunek liczbą skończoną 0–1e14. `verifyMigration()` uznaje **spadek** `coreLevel` za utratę
  danych (zapis „invalid”, kopia ratunkowa).
- Przyrost: wyłącznie `finalizeRun()` (Arena / Wyzwanie dnia); kampania (`endCampaignMission()`) i runda przerwana (`leaveRun()`)
  go nie wywołują. Nadwyżka ponad 100% przechodzi dalej; każde 100% = `coreLevel + 1` i `grantCoreCityLevelReward()`.
- **Limitu 6 nie było:** LVL 2–6 dawały nagrody z `CORE_CITY_LEVEL_REWARDS`, a od LVL 7 każde 100% dawało premię
  +100 monet + 10 pryzmatów (`milestoneFallbackCoins/Prisms`) i licznik rósł dalej. Miasto od LVL 6 rysowało się bez zmian
  („Miasto zbudowane w całości”), szyna pokazywała LVL 1–6.
- Zapis CrazyGames (`CG_DATA`) przenosi ten sam obiekt zapisu — rozszerzenie nie dodaje pola, więc nie wymaga zmian.

## 2. Co zrobiono

- **Progresja na tym samym polu.** Centrum = LVL 1–6 (bez zmian), Drugi brzeg = LVL 7–12, dostępny od LVL 6 (ładowanie
  LVL 6 → 7 już go buduje). `coreCityOverall()` zamienia (poziom, ładunek) na postęp 0–11; Centrum rysuje się z tej samej
  liczby co wcześniej (`cityCenterProgress()`), Drugi brzeg z `cityShoreProgress()`. `finalizeRun()` i nagrody bez zmian.
- **Wygląd** (`drawShoreScene()`): panorama z boku, istniejące `drawCityBuilding()`, dźwig, ulica, niebo, dalsza panorama,
  reflektory, odsłona etapu; nowe tylko most podwieszany, przyczółek, nabrzeże, plac z drzewkami, fontanna i pas ciemnej wody z
  kilkoma odbiciami. Fragmenty wspólne wydzielono z `drawCityScene()` bez zmiany działania — **Centrum jest identyczne piksel w
  piksel z bazą** (15 klatek × 3 rozdzielczości, `qa/city2.mjs`). Etapy: LVL 6 plac budowy (ciemny most, przerywane zarysy,
  dźwig nad pierwszą działką), 7 przyczółek, pierwsza ulica, światła, 3 budynki; 8 kwartał niskiej zabudowy (+4);
  9 dwa budynki usługowe z neonami i plac; 10 dwa budynki i fontanna; 11 trzy wysokie budynki z dominantą; 12 Wieża Brzegu,
  reflektory, pełne oświetlenie, bez dźwigu i zarysów.
- **Miasto:** jeden przycisk-przełącznik „Centrum | Drugi brzeg” nad kapsułą nagrody (widok tylko w sesji, nigdy w zapisie);
  bez ręcznego wyboru w sesji pokazuje sektor, który buduje ładowanie: Centrum poniżej LVL 6, **Drugi brzeg od LVL 6** (także
  po wczytaniu zapisu LVL 6 i po przejściu 5 → 6 — odsłona „Wieża Rdzenia” gra wtedy nad Drugim brzegiem, gdzie po lewej
  zapala się wieża Centrum); ręczny wybór nie zmienia się sam po awansie; ukończone Centrum jest zawsze jednym dotknięciem.
  Przed LVL 6 Drugi brzeg z kłódką („Drugi brzeg: odblokuj na poziomie 6”). Szyna: Centrum 1–6,
  Drugi brzeg 7–12 (krótki pasek przed 7 = ładowanie LVL 6). Procent i „Następny etap · Drugi brzeg: LVL n „…” + 100 monet +
  10 pryzmatów” zawsze mówią, co buduje bieżące ładowanie — także przy oglądaniu ukończonego Centrum („Centrum ukończone ·
  Teraz budujesz Drugi brzeg”). W widoku Drugiego brzegu pas rzeki leży pod przełącznikiem, więc nie zasłania zabudowy.
- Mapa nagród: LVL 2–6 i osobno „Drugi brzeg (od LVL 6)” LVL 7–12 z miniaturami; wynik rundy: „Nowy etap miasta: …” dla 7–12,
  bez „LVL 13”.
- **Po ukończeniu (LVL 12+) nic nie zapowiada dalszej budowy:** mapa nagród — „Core City jest ukończone: Centrum i Drugi brzeg
  stoją w całości. Każde dalsze 100% daje premię: +100 monet i +10 pryzmatów” (poniżej 12 bez zmian: „Każde 100% to nowy
  poziom, nagroda i nowy wygląd miasta”); podpis GRAJ — „+10–17% do premii Core City” (poniżej 12: „budowy miasta”); linia
  następnej rundy w wyniku — „Premia Core City: +100 monet + 10 pryzmatów” (LVL 6–11: „Drugi brzeg LVL n „…”: +100 monet +
  10 pryzmatów”). Premia i ekonomia bez zmian. Wszystkie nowe teksty PL/EN (EN: Downtown / The Far Shore).

## 3. Zapisy — dokładne zachowanie

| Zapis | Po wczytaniu |
|---|---|
| LVL 1–5 | Ten sam poziom i ładunek, monety, pryzmaty, kosmetyki. Widok: Centrum (wygląd jak dotąd). Drugi brzeg zablokowany. |
| **LVL 6** | Ten sam poziom i ładunek; nic nie przyznano, nic nie zabrano (zestaw „Pryzmat” zostaje, bez ponownego wydania). Widok: Drugi brzeg (plac budowy; bieżący % buduje LVL 7), ukończone Centrum pod przełącznikiem. Następne 100% = LVL 7 + ta sama premia co przed zmianą (+100 monet + 10 pryzmatów). |
| LVL 7–12 (z dawnej pętli premii) | Licznik zachowany — gracz widzi Drugi brzeg na swoim poziomie (to postęp zapisany w polu, nie przeliczony z historii rund). |
| LVL 13+ | Licznik zachowany (obcięcie byłoby „utratą” dla `verifyMigration()`); karta pokazuje LVL 12, „Drugi brzeg ukończony”, premia za każde 100% jak dotąd. |

Klucz `vectorHoleSave_v1`, `SAVE_SCHEMA_VERSION` 13, `defaultSave()`, sanitacja i zabezpieczenia PX01 bez zmian; oglądanie i
przełączanie nie zapisuje niczego (porównanie bajtów zapisu).

## 4. Decyzje do potwierdzenia przez właścicielkę

1. **Premia LVL 7+ (+100 monet + 10 pryzmatów)** istniała przed CITY-2, więc została bez zmian (usunięcie byłoby zmianą
   ekonomii). Brief mówi, że nagrodą za 7–12 ma być rozbudowa wizualna i żeby nie dodawać nowych monet/pryzmatów — premia nie
   jest nowa, ale jeśli ma zniknąć dla LVL 7–12, to osobna decyzja ekonomiczna (`qa/balance1.mjs`).
2. Po LVL 12 premia nadal płynie co 100% (jak dotąd) — bez fikcyjnego LVL 13 na ekranie.
3. Domyślny widok od LVL 6 = Drugi brzeg (poprawka po odbiorze GPT na `7b1ca0f`); ukończone Centrum jednym dotknięciem.
4. Przełącznik to jeden przycisk z dwoma segmentami (test `qa/flow.mjs` trzyma Miasto przy ≤ 10 elementach do dotknięcia).

## 5. Testy i materiały

Ta sama maszyna (kontener sesji); logi w `qa/out/city2-runs/` (git-ignored).

Runda 2 (poprawki po odbiorze GPT, kandydat = końcowy SHA PR):

| Suite | Wynik |
|---|---|
| `qa/city2.mjs` | PASS 76/76 (nowe: wczytanie LVL 6 → Drugi brzeg, 5 → 6 → Drugi brzeg + odsłona LVL 6, ręczny wybór zachowany przy 6 → 7 i 7 → 8, teksty LVL 12 i 15 / 6 i 9: mapa nagród, GRAJ, linia następnej rundy; EN z podpisem GRAJ) |
| `qa/responsive.mjs --scenes=hub,hubShore,infoSheet` | PASS 102/102 (wszystkie ramki Poki / CrazyGames / telefony / tablety, pion i poziom; nowa scena `hubShore`) |
| `qa/devices.mjs --only=screens,turn` | PASS 48/48 (Miasto LVL 1 / 3 / 9 / 12 na każdym urządzeniu, obrót telefonu) |
| `qa/flow.mjs` | PASS 35/35 (375×667, ≤ 10 elementów do dotknięcia) |
| `qa/ui2.mjs --only=miasto,nav` | PASS 29/29 (test szyny 1–6 wybiera widok Centrum jawnie) |
| `qa/visual1.mjs` | PASS 31/31 (test etapów Centrum wybiera widok Centrum jawnie; LVL 6: 0,90 ms/klatkę) |
| `qa/deviceqa1.mjs --only=checks` | PASS 18/18 (LVL 6: domyślnie Drugi brzeg, Centrum „ukończone” po przełączeniu) |
| `qa/v19.mjs` | PASS 16/16 |

Runda 1 (na `7b1ca0f`, kod zapisu i trybów od tamtej pory bez zmian): `save-safety` PASS 107/107, `px02-isolation` PASS 95/95
(baza 0e67e2f: 95/95), `v22` PASS 49/49, `design` PASS 29/29, `leave-run` PASS 22/22, `instructions` PASS 4/4.

NOT RUN (celowo): pełny `qa/run-all.mjs`, `perf1`, `balance1`, `release*` — zmiana nie dotyka rozgrywki, ekonomii, workflow ani
release. Koszt klatki Miasta (telefon 390×844): Drugi brzeg LVL 12 0,54 ms, Centrum LVL 6 0,53 ms (baza 0,43 ms).

Zrzuty z działającej gry: `design/city2/shots/` (telefon 390×844 @2x, komputer 1280×720, wąski telefon 375×667 @2x, PL/EN,
Centrum przed/po, mapa nagród LVL 9 i 12, wynik rundy 11 → 12 i po LVL 12), plansza `design/city2/CITY2_BOARD.png`
(złożona wyłącznie ze zrzutów; `node qa/city2-shots.mjs`).
