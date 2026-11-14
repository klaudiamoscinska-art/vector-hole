# GG-UI-02 / ETAP 2 — Premium Game Experience: wdrożenie produkcyjne

Baza: `origin/main` = `1395c18814f4b775850d39b45859908e4c552704` (GG-UI-01, PR #100), zweryfikowana przed pracą.
Gałąź: `claude/awesome-pasteur-0s3i1j` (wyznaczona dla tej sesji; utworzona od `origin/main`).
Projekt: `design/ui2/` (etap 1, gałąź `claude/funny-tesla-kjrbsc` @ `7b06a5d`) — materiały przeniesione plikami, gałąź nie
została scalona. Zakres: `style.css` (jeden blok „GG-UI-02” na końcu + kilka zastąpionych reguł), `game.js` (funkcje
wyświetlające menu, `I18N_EN`), `index.html` (5 nowych węzłów), `qa/`, dokumentacja. Bez zmian: `.github/`, release script,
eksport CrazyGames, reguły gry.

Autoryzacja merge: prompt właścicielki GG-UI-02 / ETAP 2 (§2, §20) — jednorazowa zgoda na PR, zwykły merge commit i wdrożenie
po przejściu krytycznych bramek, bez osobnego odbioru PR przez GPT przed merge (odbiór GPT po wdrożeniu). Reguła w `CLAUDE.md`
bez zmian; zgoda dotyczy tylko tego PR.

## 1. Zatwierdzona hybryda — co wdrożono per ekran

| Ekran | Kierunek | Wdrożenie |
|---|---|---|
| Miasto | B | Panorama Core City jako tło (telefon: od krawędzi do krawędzi), herb LVL, kapsuła następnej nagrody z procentem i **szyną LVL 1–6** (`renderCoreRail()` z `save.hub`), GRAJ z wirem gracza w założonym wyglądzie (`Hole.draw()`), kafle trybów z pasem nagłówka, skrzynia w złotej krawędzi, wspólny materiał portfela. `drawCityScene()` bez zmian (jedyna zmiana: opcja niewyświetlania plakietki dźwigu na bardzo niskiej panoramie). |
| Dzielnice — telefon | B + adaptacja | Liczniki x/12 i x/240, kafle 01–12 ze znacznikiem stanu, siatka 4×3 (wysokość > 700 px) albo rząd całych kafli (niższe), nagłówek dzielnicy w jej kolorze, lista misji jako trasa, znak BOSS. |
| Dzielnice — poziomo / desktop | A + elementy B | Siatka gry; desktop: numer i znacznik na kaflu; niskie ramki (CrazyGames 800×450, telefony poziomo): numer przed nazwą, stan w linii statusu z plakietką TERAZ / NASTĘPNA; trasa i boss jak na telefonie. |
| Odprawa | B | Nagłówek w kolorze dzielnicy, cel bossa na własnej płytce z większą ikoną i plakietką BOSS; mechanizm odprawy bez zmian. |
| Warsztat | B + korekta | Scena podglądu z plakietką stanu i **opisem wyglądu zachowanym w każdym układzie**, przełącznik kategorii, karty kolekcjonerskie ze znakiem źródła. Kolumny: 2 (320 px), 3 (od 360 px), więcej na szerokich; niskie ramki poziome — karty-wiersze. |
| Wynik Areny | A + kafle nagród B | Kompozycja i kafle rozmiaru / miejsca jak dotąd; monety i XP jako dwa kafle, Core City jako szeroka karta. Bez pigułek z pełnego B. |
| Wynik misji | B | Gwiazdki na złotej płycie, karta XP i następnej misji w materiałach rodziny (boss oznaczony). |
| Nagrody Core City, skrzynia, odblokowania | B | Karta-trofeum w kolorze nagrody, tytuł zdarzenia na wstążce, źródło w pigułce. |
| Nagroda dzienna, arkusze | A | Płyta z krawędzią; poprawiony kalendarz. |
| Nawigacja | A | Zwykły pasek przy krawędzi, bez doku; zakładki 44 px. |
| Wyzwania, Profil | wspólne materiały | Portfel, ikona ustawień, nawigacja; bez przebudowy. |

Świadome odstępstwa od makiet (czytelność przed makietą, §4 promptu): (1) emblemat na GRAJ to prawdziwy wir gracza, nie
gradient CSS; (2) na telefonie kafle dzielnic nie mają plakietek TERAZ / NASTĘPNA (rama i znacznik mówią to samo), w układach
poziomych plakietki zostały; (3) plakietka „POSIADANE” nie występuje — podgląd pokazuje tylko to, co założone albo oglądane, a
posiadana karta mówi „ZAŁÓŻ”; (4) „ZA MAŁO PRYZMATÓW” dla przedmiotów za pryzmaty (makieta miała tylko „ZA MAŁO MONET”);
(5) EN „DISTRICTS REBUILT” zamiast przykładowego „RESTORED DISTRICTS” — gra mówi już „District rebuilt!” / „✓ REBUILT”.

## 2. Cztery poprawki krytyczne i kalendarz

| # | Poprawka | Rozwiązanie | Dowód (`qa/ui2.mjs`) |
|---|---|---|---|
| 1 | Dzielnice 320 px | Tytuł 17 px przy 5-cyfrowym portfelu (pełne „DZIELNICE” / „DISTRICTS”); rząd po 3 całe kafle z przyciąganiem (żaden nie jest ucięty po zatrzymaniu), numer i znacznik na każdym, dotyk ≥ 44 px, brak poziomego przewijania strony. | „CRITICAL FIX 1” PL i EN |
| 2 | GRAJ nie zasłania danych misji | `#missionNextCard .mc-play` przypięty (`position: sticky`) w każdym układzie; cele, czas, nagroda, warunki gwiazdek i modyfikatory przewijają się nad nim; na końcu karty przycisk stoi na swoim miejscu. Znalezione przy okazji: 360×800 (siatka 4×3 spychała GRAJ 2 px pod pasek) i ramki poziome (warunki gwiazdek były ukryte — wróciły). | „CRITICAL FIX 2” na 320×568 (PL/EN), 360×800, 390×844, 640×360, 800×450, 844×390 + odprawa + powrót z misji |
| 3 | Karty Warsztatu | `repeat(auto-fill, minmax(104px, 1fr))`: 2 kolumny na 320 px (z opisem wyglądu także na karcie), 3 od 360 px; teksty ≥ 9 px; opis wyglądu przy podglądzie zawsze widoczny. | „CRITICAL FIX 3” na 9 kadrach × 4 kategorie |
| 4 | Nawigacja A | Pasek zadokowany, bez zaokrągleń i `backdrop-filter`, `padding-bottom` z safe-area; ostatnia misja i ostatnia karta Warsztatu kończą się nad paskiem; obrót telefonu zachowuje zakładkę. | „CRITICAL FIX 4” (4 kadry, safe-area 20 / 34 px) |
| + | Kalendarz | Znacznik odebranego dnia = mała plakietka na rogu kafla; kwoty przygaszone, nie zakryte. Liczba dni, kwoty i moment zapisu bez zmian. | „CALENDAR FIX”: 7 stanów tygodnia × 320 / 360 / 390 / 800 px × PL / EN |
| + | 2560×1440 „layer not visible” | Przyczyna: cała warstwa `.screen` startowała od `opacity: 0` (`fade-in`), a jej kolumna od 0 (`v12-rise`). Teraz ekran wchodzi od 0,45 / 0,4. Test czeka na stan interfejsu i koniec animacji wejścia (`settled()`), asercje bez zmian. | „Entrance (2560x1440)”; `qa/responsive.mjs` |

## 3. Zgodność z grą

- `SAVE_SCHEMA_VERSION` 13, klucz `vectorHoleSave_v1`, **żadnego nowego pola zapisu**; lista eksportów modułu bez zmian.
- Zmienione funkcje `game.js` (test „ui2 scope”): `renderCoreRail` (nowa), `renderHubCity`, `startScreenAnim`,
  `updateCoinDisplays`, `renderCampaignMap`, `missionStepRows`, `missionCardHtml`, `showMissionStartCard`, `renderCosmeticGrid`,
  `renderWarsztatAction`, `drawCityScene` (opcja `noSiteTag`), stałe `U2_*`, `I18N_EN`. Zero nowych losowań, zero zapisów.
- Ceny, waluty, własność, potwierdzenie zakupu, wyposażanie, reguły odblokowań, reklamy, nagrody i ich kolejność: te same
  węzły i te same funkcje co przed zmianą. Rzadkości kosmetyków nie dodano.
- GG-VFX-02 (W2 „spójny lej”) **nie jest częścią tego pakietu** — kod wirów, zasysania i GG-HOLE-01 / GG-VFX-01 nietknięty.

## 4. Dowody wizualne

`design/ui2/shots/<scena>-<kadr>[-en]-prod.jpg` — te same sceny, profile i narzędzie co etap 1 (`ui2-shots.mjs --as=prod`),
obok kadrów `-before` (baza) i `-a` / `-b` (makiety). Galeria na telefon: `design/ui2/gallery-prod.html`
(`node design/ui2/tools/ui2-gallery2.mjs`). Wynik rundy bota na ekranach wyniku różni się między przebiegami także na bazie
(losowość rundy zależy od czasu rzeczywistego) — to nie zmiana reguł.

## 5. QA

### Wyniki

**Pełna regresja `node qa/run-all.mjs`** na kandydacie `cfb6f71` (pliki gry i `qa/` identyczne z końcowym HEAD poza jedną
poprawką CSS opisaną niżej): **2472/2477 PASS**, 5 FAIL. Przebieg bazy `1395c18` na tej samej maszynie przerwał restart
kontenera po 43 z 57 suit (log w scratchpadzie sesji); do porównania każdy FAIL kandydata powtórzono parami na bazie i kandydacie.

| FAIL kandydata | Baza (ta sama maszyna) | Ocena |
|---|---|---|
| `v18` balans wzmocnień (ziarno 1940668982) | **ten sam FAIL, identyczne liczby** | zastany, zależny od ziarna |
| `workshop-buy` 640×360: 4 z 5 kart Finiszu w widoku | PASS | **regresja GG-UI-02 — naprawiona** (`639cc58`: karty poziome 132 px, wir 40 px); po poprawce `workshop-buy` **73/73**, `ui2 --only=warsztat` **27/27** |
| `perf1` late Arena — jeden skok klatki 147 ms przy obciążonej maszynie | PASS | szum: osobno na cichej maszynie kandydat **25/25** (baza 25/25), p50 klatki 36,0 vs 34,8 ms; render rundy nie był zmieniany |
| `crazygames-basic1` pointer lock (4 asercje: ruch z odwróconym znakiem) | **te same 4 FAIL-e**, 88 PASS w obu | zastany, środowiskowy (Chromium w tym kontenerze) |
| `difficulty` casual EKSTREMALNA 59% (ziarno 1924802216) | **ten sam FAIL, identyczne liczby** (59%; ekspert: 94%, nieukończone M112 M180 w obu) | zastany, zależny od ziarna; Kampania nie była zmieniana |

FAIL-e bazy, których kandydat nie ma: PX02 ISO-B (pryzmat), `responsive` 320×568 campaign (zastany błąd GRAJ pod nawigacją —
naprawiony), `workshop-buy` ×3 (dotknięcie karty przesuwało układ na szerokich ekranach — naprawione).

**Celowane (na kodzie końcowym albo bez zmian od ich przebiegu):** `qa/ui2.mjs` 109/109 (Miasto 20, Dzielnice 24, Warsztat 27,
wyniki + nawigacja 37, scope 1); `workshop-buy` 73/73 (baza 70/73); `responsive` 526/526 w run-all (baza 512/526 w etapie 1);
`devices` 75/75; `v21` 62/62; `flow`, `ftue1`, `ftue3`, `v19`, `v22`, `design`, `gameready1`, `cg-preview-qa5` 24/24, `ui1`,
`deviceqa1`, `visual1`, `v17`, `save-safety`, `px02-isolation`, `release`, `release-recovery`, `instructions` — PASS w run-all.

**Wydajność** (`perf1` osobno, ta sama maszyna, headless Chromium z renderowaniem programowym): Core City LVL 6 mediana klatki
19,5 ms (baza 19,3), p99 27,6 (baza 23,4); żadna animacja menu nie rusza właściwości układu (Miasto, Dzielnice, Warsztat,
Wyzwania, Profil); late Arena p50 36,0 / 34,8 ms. Nowe podglądy wirów: jeden płótno na GRAJ (tylko gdy Miasto widoczne, w
istniejącej pętli `startScreenAnim()`), karty Warsztatu rysowane jak dotąd tylko dla widocznej kategorii. Parowy pomiar
otwierania / przełączania ekranów (`ui2-bench.mjs`): **NOT RUN** (narzędzie gotowe; pominięte, żeby skrócić czas wydania).
Fizyczny iPhone: **NOT VERIFIED**.

## 6. Ryzyka i czego nie zweryfikowano

- **NOT VERIFIED:** fizyczny iPhone / Safari, aplikacja z ekranu początkowego, portal CrazyGames, monitor 2560×1440 z GPU —
  wszystko sprawdzono w emulacji Chromium (renderowanie programowe).
- Czytelność najmniejszych napisów (9–9,5 px na kartach i znacznikach) wymaga oceny na telefonie.
- Na 320×568 panorama Miasta to wąski pas (zgodnie z ustaleniem: szyna, nagroda i GRAJ mają pierwszeństwo).
- Paczka CrazyGames nie została przebudowana ani wysłana w tym etapie (eksport bez zmian; testy paczki w regresji).
- Wydajność: pomiary porównawcze w headless Chromium, nie na telefonie.

## 7. Następny pakiet (zatwierdzony, nierozpoczęty)

**GG-VFX-02 — COHERENT VORTEX FLOW (W2 „spójny lej”)**, prototyp `design/ui2/vortex/`: spójność ruchu wiru, połykanych
obiektów i cząstek, wszystkie 10 skórek, gracz i rywale, bezpieczeństwo RNG i mechaniki, wydajność, własne QA i wdrożenie.
Osobny PR.
