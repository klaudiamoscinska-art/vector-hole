# Vector Hole — historia wersji

Zwięzła historia. Aktualny opis gry: `docs/GAME_DESIGN.md`.
Starsze, szczegółowe plany wersji (v2–v12) zostały usunięte w v13 —
są w historii gita (`git log -- docs/`).

## FTUE-3 „Pierwsze 5 minut” (zapis nadal v13; ekonomia, ceny, nagrody, progi odblokowań i długość rund bez zmian)
- **Analiza** (bot „casual” na świeżym profilu, prawdziwe przyciski, te
  same ziarna przed i po): pierwszy kęs 0,5 s i ~19 kęsów w 10 s były
  dobre, ale (1) pierwsza runda zatrzymywała się **dwa razy w 6–32 s**
  na pełnoekranowy wybór z 3 kart Ewolucji, zanim gracz poznał
  sterowanie; (2) duży wir **nie sięgał rywala ani fragmentu w rogu /
  przy ścianie** (środek wiru stoi o promień od brzegu) — bot gonił taki
  cel do 46 s, bez jednego kęsa, i potrafił spaść z podium; (3) wynik
  nie mówił, po co grać dalej (Warsztat i Wyzwania pojawiały się bez
  zapowiedzi). Porównano 4 warianty (szlif bez zmiany struktury,
  krótsza 1. runda 90 s, samouczek scenariuszowy, rozgrzewka przed
  Areną); wybrany szlif — trzecia runda i tak startuje przed 5:00.
- **Pierwsza runda bez kart Ewolucji** (`CONFIG.ftue.evolutionFromRuns`):
  karty od 2. rundy, pierwsza oferta „NOWOŚĆ · EWOLUCJA”. Wyzwanie dnia,
  wyzwanie znajomego i dalsze rundy bez zmian.
- **Wir gracza sięga brzegu miasta** (`edgeReach()`): dociśnięty do
  ściany wciąga mniejszego rywala i obiekty z rogu i pasa przy ścianie.
  Boty bez zmian, zasady rozmiaru bez zmian.
- **Wynik mówi, co da następna runda** (`nextRoundHook()`): „NASTĘPNA
  RUNDA · Odblokujesz Warsztat”, potem Wyzwania, potem nagroda Core
  City, gdy jest ≤ 2 rundy dalej. Bez okna i dodatkowego dotknięcia;
  obietnica zawsze się spełnia. Zdarzenie analityczne `result_next`.
- **Zmierzone** (`node qa/ftue3.mjs --measure=12`, te same 12 ziaren,
  baza produkcyjna `a24cbcf` → FTUE-3): pauzy pełnoekranowe w 1. rundzie
  24 → 0; rundy z przerwą bez kęsa ≥ 20 s 4/36 → 1/36, najdłuższa
  46,3 → 20,2 s; mediana wyniku 1. rundy 6552 → 8982; dotknięcia do
  startu 3. rundy 8 → 6; model osi czasu: 3. runda startuje po 262 →
  256 s; pierwszy kęs 0,5 s bez zmian. To pomiar botem, nie danymi
  graczy — wpływ na retencję do sprawdzenia (GDD §7).
- **QA:** nowy `qa/ftue3.mjs` (w `run-all`).

## FTUE-2 FIX: poprawki po testach na prawdziwych urządzeniach (iPhone 13 Chrome, iPhone 16 Pro z ikonki, laptop z Windows; zapis nadal v13, rozgrywka, ekonomia i balans bez zmian)
- **iPhone z ikonki obrócony poziomo:** gra mierzyła ekran, zanim się
  ustalił (zdarzenie `resize` przychodziło za wcześnie i nie wracało) —
  zostawał układ pionowy w poziomej ramce i płótno dwa razy wyższe od
  ekranu, więc połowa wiru znikała pod dolną krawędzią. Teraz każda
  zmiana ramki (`ResizeObserver` na `#app`, obrót) mierzy ją ponownie.
- **Obszary bezpieczne:** mapka, strzałki do celów i duże komunikaty
  omijają notch / Dynamic Island / pasek gestów; przy krawędzi miasta
  kamera zatrzymuje jego brzeg na granicy obszaru bezpiecznego (wir nie
  chowa się pod wycięciem; widoczny kawałek miasta bez zmian).
- **HUD:** panel (ranking, cel misji, pasek czasu) lub mapka, pod którą
  jest wir, przygasa; turkusowa strzałka do celu misji (to wskaźnik, nie
  artefakt) stoi na brzegu pola gry, nie pod paskiem HUD; komunikaty
  „ZŁOTY RDZEŃ!”, „T4 · WIELKI!” itd. zawsze mieszczą się w szerokości.
- **Przebitki Areny w menu (laptop):** każdy ekran menu pojawia się
  z przezroczystości, a pod spodem płótno trzymało ostatnią klatkę rundy
  (wielki wir) — poza rundą plansza jest teraz czyszczona i ukryta.
- **Miasto / Core City:** budynki, dźwig i „NOWY BUDYNEK” nigdy nie
  wchodzą pod nagłówek (etykieta schodzi pod plac budowy, gdy nad nim nie
  ma miejsca) — także po zmniejszeniu okna; z paskiem zgody lub
  wyzwaniem znajomego w niskiej ramce znika dopisek pod nagłówkiem.
- **Odprawa i start misji:** cele przewijają się w swoim polu, GRAJ /
  START stoi pod nimi (nie na nich); w poziomie opowieść i cele obok
  siebie. **Dzielnice:** nazwy dzielnic mieszczą się w kafelku, GRAJ
  następnej misji widać bez przewijania. **Wynik misji / rundy:** lewa
  kolumna przewija się z wyraźnym wygaszeniem dołu; „Wróć do Miasta” jest
  w pasku akcji (zawsze widoczne), ZAGRAJ JESZCZE RAZ maks. w 2 liniach.
- **Odblokowania:** w niskiej ramce ikona po lewej, tekst i przyciski po
  prawej (ikona nie jest ucięta, PÓŹNIEJ na ekranie). **Pauza:** w
  poziomie dwie kolumny przycisków. **Profil:** POWRÓT to stopka pod
  przewijanymi ustawieniami, pasek przewijania przy krawędzi ekranu.
  **Okna:** cienkie paski przewijania w kolorach gry; codzienna nagroda
  nie przewija się już przez iskry animacji. **Wyzwania:** w niskiej
  ramce pionowej ZAGRAJ nie przykleja się nad mapą.
- **Panel TEST właścicielki:** nadal tylko z kodem twórcy; zakładka omija
  Dynamic Island i w rundzie jest bledsza.
- **QA:** nowy `qa/devices.mjs` (obrót ze spóźnionym `resize`, wir T1–T6
  przy każdej krawędzi, strzałki, komunikaty, klatki w połowie przejścia
  między zakładkami, Core City przy zmianie rozmiaru okna, stopka Profilu,
  paski przewijania, powrót z wyników, panel TEST); `qa/responsive.mjs`
  ma 4 ramki prawdziwych urządzeń z obszarami bezpiecznymi i sprawdza,
  czy główny przycisk nie leży na tekście.

## FTUE-2 „Platformy”: gra na Poki, CrazyGames, telefonach, tabletach i w pełnym ekranie (schemat zapisu nadal v13, rozgrywka i ekonomia bez zmian)
- **Układ według kształtu ramki** (`screenLayout()`): poziomy (pasek po lewej,
  dwie kolumny) dla każdej ramki szerszej niż 1,25× wysokość i od 560 px —
  wcześniej od 960 px, więc telefon obrócony poziomo (844×390), Poki
  640×360 / 836×470 i CrazyGames 800×450 dostawały ucięty układ pionowy
  (kafel Kampanii pod dolną krawędzią, przyciski wyników i nagród poza
  ekranem). Nowy wariant **kompaktowy** dla ramek niższych niż 620 px.
  Skala UI nigdy poniżej 1× (etykiety miały 7–8 px przy 1031×580 i na
  tablecie 1024×768); małe etykiety ≥ 9 px.
- **Ekrany:** pierwszy ekran w poziomie = demo po lewej, logo i GRAJ po
  prawej (logo nie nachodzi na demo przy 640×360); Miasto, Dzielnice,
  Warsztat, Wyzwania, wyniki rundy i misji, Ewolucja (3 karty obok
  siebie), pauza, kalendarz, start misji, okna informacyjne — wszystko
  mieści się albo przewija w środku z głównym przyciskiem na ekranie.
  Pasek zgody rezerwuje miejsce (nie zasłania GRAJ ani kafli). POWRÓT w
  Profilu, START misji, DALEJ wyniku misji i ZAGRAJ Wyzwania dnia zostają
  przy dolnej krawędzi.
- **HUD w poziomie:** ranking = lider + gracz, mniejsza mapka, NELA i
  podpowiedzi przy krawędziach, mniejszy baner wyżej (nie zasłania wiru);
  nagłówek rankingu ma realne pole dotyku. Kamera, zasięg widzenia, skala
  świata i balans bez zmian.
- **Sterowanie w ramce portalu:** strzałki, spacja, PageUp/Down i kółko
  myszy nie przewijają strony portalu (panele gry przewijają się dalej);
  pauza Escape / P / Spacja; kursor poza ramką zatrzymuje dziurę; utrata
  fokusu zwalnia klawisze i pauzuje rundę; pisanie w polu tekstowym nie
  steruje; brak menu kontekstowego i zoomu gestem. Bez własnego przycisku
  pełnego ekranu (CrazyGames go zakazuje) — pełny ekran portalu działa
  (sprawdzone też prawdziwym Fullscreen API).
- **Testy:** nowy `qa/responsive.mjs` (21 rozmiarów × ekrany, iframe na
  stronie-hoście, obrót, pełny ekran, zmiana rozmiaru, mysz, klawiatura,
  dotyk, fokus), w `run-all`. `qa/v21.mjs`: 844×390 ma teraz układ
  kompaktowy (zamierzona zmiana kontraktu).
  `qa/bridge.mjs` (E2): 7 nowych listenerów sterowania jest zadeklarowanych
  w `ADDED_SINCE_BASE` — start modułu musi mieć dokładnie listenery bazy
  63b50d0 plus te, więc zdublowany lub zgubiony nadal oblewa test.

## R1: runda przerwana daje tylko częściowe monety i XP (decyzja właścicielki 24.10.2026; schemat zapisu nadal v13)
Zmiana kontraktu rozgrywki zatwierdzona przez właścicielkę: pełne nagrody
i postęp tylko za ukończoną Arenę.

- Runda opuszczona w pauzie przy wyniku > 0 (`payLeftRun()`): monety
  1,6·√wynik (×1,5 w pierwszych 5 ukończonych rundach) i XP za wynik
  (`xpSqrtK`·√wynik). Bez stałej części za rundę i bonusu miejsca, bez Core
  City, pryzmatów co 3. rundę, misji dnia, premii / rekordu / serii
  Wyzwania dnia, rekordu Areny i bez `runsPlayed` — od teraz liczy tylko
  ukończone rundy (trudność, rundy nowicjusza, bramki Warsztatu / Wyzwań /
  kafelka kampanii); licznik zapisany przez starsze wersje zostaje bez zmian
  (bez migracji, bez nowego pola).
- Runda ukończona (`endRound()` → `finalizeRun()`): bez zmian. Wynik 0 —
  jak w poprawce poniżej (`abandonRun()`).
- Okno „OPUŚCIĆ RUNDĘ?” mówi to wprost: „Monety i XP za dotychczasowy wynik
  zostaną zapisane. Budowa miasta i premie — tylko za ukończoną rundę.”
  (z tłumaczeniem EN).
- Testy: `qa/leave-run.mjs` rozszerzony o R1.

## Poprawka: runda opuszczona bez gry nie buduje Miasta (schemat zapisu nadal v13, ekonomia bez zmian)
Błąd zgłoszony przez właścicielkę (iPhone, staging FTUE-1): wejście do
Areny i wyjście do Miasta (pauza → OPUŚĆ RUNDĘ) bez rozegrania rundy
zwiększało Core City. `leaveRun()` zawsze uruchamiało pełne
`finalizeRun()`: przy wyniku 0 wszyscy remisują, więc gracz był „1.” i
dostawał też premię podium i zwycięstwa (nowy gracz: +24% Core City,
+60 monet, +85 XP i +1 do `runsPlayed` za każde wejście i wyjście; trzy
takie wejścia otwierały Wyzwania i dawały +2 pryzmaty). Błąd był też
w produkcji (810334f).

- Runda opuszczona przy wyniku 0 (nic nie zjedzone — zgodnie z GDD 5.2
  „monety za wynik osiągnięty do tej pory”) niczego nie daje i nie jest
  liczona: bez monet, XP, pryzmatów, Core City, premii i serii Wyzwania
  dnia, misji dnia i bez `runsPlayed` (od niego zależą trudność i bramki
  Warsztatu, Wyzwań i kafelka kampanii) — nowe `abandonRun()`.
- Runda naprawdę rozegrana (wynik > 0) i opuszczona: nagroda częściowa
  bez zmian (jak dotąd, łącznie z Core City). Runda dograna do końca czasu:
  bez zmian. Bez progu czasowego, bez zmian ekonomii i zapisu.
- Testy: nowy `qa/leave-run.mjs` (w `run-all`).

## FTUE-1 „Druga runda” — pierwsze pięć minut (schemat zapisu nadal v13, balans bez zmian)
Decyzja właścicielki: wariant D — Arena jako centrum + drabina trzech rund.

- 1A: wynik pierwszej Areny bez automatycznych kart (karta „DRUGI TRYB ·
  KAMPANIA” wjeżdżała po 650 ms, w trakcie liczenia wyniku). ZAGRAJ JESZCZE
  RAZ zostaje głównym przyciskiem i od razu startuje drugą rundę.
- 1B: kampania przedstawia się dopiero po 3. rundzie Areny, na kafelku
  kampanii w Mieście (plakietka NOWE, także na zakładce Dzielnice), bez
  okna; dotknięcie otwiera Dzielnice. Wizyta w Dzielnicach zapisuje
  „kampania” w `save.unlocks.announced` (ten sam identyfikator i format co
  dotąd); kto poznał kampanię wcześniej (ogłoszenie z poprzedniej wersji,
  wizyta, rozpoczęta lub ukończona misja), nie widzi wstępu. Dzielnice
  dostępne od pierwszej rundy jak dotąd.
- 1C: bez „×2 MONET · REKLAMA” na wyniku pierwszej Areny w historii zapisu
  (`stats.runsPlayed === 1`) — także na pierwszym *ukończonym* wyniku po
  rundzie opuszczonej w pauzie (`leaveRun()` też liczy się do `runsPlayed`;
  ukończone rundy rozpoznaje istniejące `stats.recentArenaScores`, tylko
  u nowego gracza — `runsPlayed` < `CONFIG.economy.newbieRuns` przed rundą —
  bez nowego pola zapisu; starszy zapis bez tej historii zachowuje
  reklamę); nagroda, mnożniki i pozostałe reklamy bez zmian.
- 1D: nowy gracz (sesja rozpoczęta od ekranu powitalnego) dostaje kalendarz
  logowania przy drugiej wizycie w Mieście albo po ponownym uruchomieniu —
  licznik wizyt tylko w pamięci, bez nowego pola w zapisie; nagrody,
  seria i blokada podwójnego odbioru bez zmian.
- 1E: karty „WARSZTAT” (po 2. rundzie) i „WYZWANIA” (po 3.) czekają na koniec
  animacji wyniku (`CONFIG.ftue.resultCelebrationDelayMs` 2400 ms) i nie
  pokazują się, gdy gracz już przeszedł dalej (bez serii kart przy kolejnym
  wyniku; zostaje NOWE). Progi odblokowań bez zmian.
- Testy: nowy `qa/ftue1.mjs` (w `run-all`), `qa/v22.mjs` „first launch”
  zaktualizowany do nowego przebiegu.

## E2 + E3 — natywne moduły ES i bezpieczna publikacja (bez zmian w rozgrywce, schemat zapisu nadal v13)
Decyzja właścicielki (18.10.2026): moduły ES, wiele plików JS dozwolone, bez
bundlera i bez nowych zależności, bez zmian rozgrywki podczas podziału.

- E2: `game.js` ładowany jako `<script type="module">`; lista eksportów
  tylko dla QA i `setSaveMirror()`; mostek QA (`qa/lib.mjs`, `qa/bridge.mjs`)
  na żywych powiązaniach modułu. `file://` nie działa — grę uruchamia się
  przez HTTP(S).
- E3: publikacja przez `.github/scripts/assemble-release.mjs` (tylko CI):
  pliki wydania w niezmiennym `v/<12 znaków commita>/`, `index.html` wskazuje
  tylko swój katalog, w katalogu głównym na stałe zamrożona ostatnia
  klasyczna para `game.js`/`style.css` (63b50d0) dla przeglądarek ze starą
  stroną w pamięci — stara strona + nowy moduł pod starym adresem nie może
  się już zdarzyć. Poprzednie wydania z ostatnich 30 dni zostają; kontrola
  strony live przed i po wdrożeniu; niezależna kontrola artefaktu; brak
  plików QA/dev w artefakcie. Workflow publikuje tylko szczyt `main`.
- E3 L1: retencja liczona z rzeczywistej historii publikacji — rekordów
  wdrożeń GitHub środowiska `github-pages` (uprawnienie `deployments: read`,
  tylko odczyt). Wydanie opublikowane (lub być może opublikowane, gdy
  GitHub usunął już stare statusy) nigdy nie jest pomijane: jeśli nie da
  się go odtworzyć, publikacja się zatrzymuje. Workflow w trzech zadaniach
  (budowanie / wdrożenie / kontrola live), tak by rekord wdrożenia znaczył
  dokładnie jedną publikację.
- E3 L1-R1 (korekta po odczycie prawdziwego API GitHub, K0): kolejne strony
  listy wdrożeń GitHub podaje jako `/repositories/<id>/…` — skrypt sprawdza
  nagłówek `Link`, ale następną stronę buduje z własnego adresu
  `/repos/{o}/{r}/…` (inny host, repozytorium, endpoint lub parametr = STOP);
  stan `waiting` (pierwszy status każdego rekordu) jest znany i liczony jak
  „w toku”; rekord środowiska `github-pages` od daty granicznej E3 musi
  pochodzić z aplikacji `github-actions` (inna, np. publikacja z gałęzi,
  albo brak = STOP i kontrola Settings → Pages → Source).
- Adres gry, `localStorage` i klucz zapisu bez zmian: ten sam zapis v13,
  ekonomia D+, wspólny portfel, izolacja Areny i Kampanii — bez zmian.
- QA: `qa/release.mjs` (artefakt, retencja, rollback, cache, stary/nowy HTML,
  wspólny zapis, ewidencja wdrożeń L1 na atrapie API GitHub); tryb bez gita
  `VH_QA_REVS`.

## PX02 D+ „W Arenie liczy się gra” — izolacja Areny (bez zmiany schematu, nadal v13)
Decyzja właścicielki (2026-10-17): „W Arenie liczy się to, jak grasz.
Monety kupują wygląd i wzmocnienia misji”.

- Wiry to sam wygląd: usunięte perki wszystkich wirów (prędkość, combo,
  magnes, XP, monety, start od T2, punkty, wzrost — również Kryształ i
  Pryzmat z Core City) wraz z `Game.perk()` / `activePerks`. Warsztat
  pokazuje opis wyglądu („WYGLĄD WIRU · BEZ BONUSU W RUNDZIE”).
- Arena bez płatnej przewagi: usunięty ekran „WYBIERZ WSPARCIE” i
  `RUN_TOOLS` (Tarcza 45, Magnes 25, Turbo start 70), karta „Rywale rosną w
  siłę” po przegranej i reklama `turbo_free` (Turbo za reklamę, także w
  rewanżu wyzwania znajomego). GRAJ, ZAGRAJ JESZCZE RAZ i rewanż startują od
  razu. Mutacje w rundzie, Złoty Rdzeń, SZAŁ, Core City i ×2 monet za
  reklamę po rundzie bez zmian.
- Dzielnice bez zmian: 240 misji, `MISSION_BOOSTERS` (ceny, zapas, reklama,
  pryzmaty), +20 s, gwiazdki, NELA. Monety z Areny mogą opłacić wzmocnienie
  misji tylko świadomym zakupem (jawny wyjątek w kontrakcie izolacji).
- Jednorazowy zwrot: zapis sprzed D+ z płatnymi wirami dostaje ich cenę z
  cennika (komplet 4870 monet), raz na linię zapisu (`economy.looksOnly`,
  `settleLooksOnly()`), w tym samym zapisie co znacznik, tylko przez
  `saveGame()` (oryginał pod `.bak`), nigdy przy `SAVE_GUARD`; nieudany
  zapis cofa zwrot w pamięci. Karta z kwotą raz, po udanym zapisie. Wir
  kupiony, zanim linia zapisu została rozliczona (`economy.boughtAfter`),
  nie dostaje zwrotu.
  Poprzednia wersja (5db3b02) zachowuje znacznik przy odczycie i zapisie.
- Panel DEV: usunięte przyciski dodatków Areny (nie ma już czego dawać).
- Poprawki po przeglądzie GPT: karta zwrotu pokazuje się dopiero, gdy jej
  znacznik „widziane” trafi do zapisu (inaczej czeka do następnego
  uruchomienia; zwrot nie jest płacony drugi raz); kod kopii, którego nie
  udało się zapisać (brak miejsca, druga karta), mówi „Kopia wczytana bez
  zapisu” zamiast „Postęp wczytany”; tytuł Warsztatu nie jest ucinany obok
  dużego salda na telefonach (375/360/320 px).
- QA: `qa/px02-isolation.mjs` (ISO-A…D, BOOST-01…03, LEGACY-01…08) w
  `run-all`; testy v22 / design / dev-panel dostosowane do braku ekranu
  dodatków i perków.

## PX01 „Bezpieczny zapis” — naprawa VH-03 (bez zmiany schematu, nadal v13)
Zapis gracza nie może już zniknąć przez zapis z nowszej wersji gry,
obcięty JSON, jedno pole w złym formacie ani drugą kartę.

- `loadSave()` niczego nie zapisuje przy zwykłym odczycie. Zapis, którego
  gra nie odczyta w całości, trzyma `SAVE_GUARD` (`future` / `corrupt` /
  `invalid` / `unavailable` / `stale`): gra działa z pamięci, `saveGame()`
  (jedyna droga zapisu, w tym lustro chmury) nic nie pisze, a gracz widzi
  komunikat z bezpiecznym wyjściem. Odblokowanie tylko jego decyzją
  (NAPRAW ZAPIS, ZACZNIJ OD NOWA, kod kopii, reset w Profilu) — oryginał
  najpierw pod `vectorHoleSave_v1.rescue`.
- Migracja: wynik sprawdzany (aktualna wersja, idempotencja, nic z sald,
  przedmiotów, zakupów, misji i boosterów nie ginie), oryginał najpierw pod
  `vectorHoleSave_v1.bak`; bez udanej kopii nie ma zapisu.
- Dwie karty: zdarzenie `storage` + porównanie przed zapisem — starsza karta
  nie nadpisze nowszego postępu.
- `migrateSave()` nie zamienia już zapisu ze złym `coins`/`owned` na
  `defaultSave()`; `sanitizeSave(save, issues)` zbiera naprawione pola.
- Chmura (CrazyGames): kopia konta, której ta wersja nie odczyta, nie jest
  nadpisywana; uszkodzony zapis lokalny może zostać zastąpiony czytelną
  kopią z konta.
- Poprawki po przeglądzie: reset w Profilu przy zablokowanym zapisie bez
  udanej kopii `.rescue` nic nie usuwa (ani lokalnie, ani w chmurze) i nie
  przeładowuje strony; lustro chmury dostaje tylko to, co naprawdę trafiło do
  `localStorage`; istniejący klucz z pustym tekstem (lokalnie i w chmurze) to
  uszkodzony zapis, nie „brak zapisu”; nieczytelny `localStorage` pokazuje
  komunikat „Zapis nie działa”.
- QA: `qa/save-safety.mjs` (SAVE-01…09, warianty i regresje R1–R4) w `qa/run-all.mjs`.

## v23 „Panel testowy” — narzędzie QA dla twórców
Panel do błyskawicznego testowania mechanik bez przechodzenia misji. Gracze
go nie widzą; balans i zasady gry bez zmian.

- **Dostęp:** 7 szybkich stuknięć w linię „ID gościa” w Profilu albo `?dev`
  w adresie → pole kodu dewelopera. W kodzie gry jest tylko solony,
  iterowany SHA-256 kodu (`DEV_CODE_HASH`, zmiana: `node qa/dev-code.mjs
  "<nowy kod>"`); 5 błędnych prób blokuje pole na 30 s. Na localhost /
  127.0.0.1 / file:// działa też kod `dev` (QA), nigdy na wdrożonej grze.
  Po wpisaniu kodu na urządzeniu pojawia się boczny przycisk DEV/TEST
  (też F2 albo ` na komputerze).
- **Tryb testowy:** wszystkie akcje panelu działają wyłącznie na osobnym
  zapisie (`vectorHoleSave_devSandbox_v1`, kopia postępu albo czysty
  start). Prawdziwy zapis nie jest wtedy czytany ani nadpisywany, a po
  „ZAKOŃCZ TESTY” wraca nietknięty. W trybie testowym: brak lustra
  w chmurze portalu, brak ujścia analityki (zdarzenia oznaczone
  `sandbox`), tylko reklama demo, żadnych płatności i sygnałów
  rozgrywki do portalu.
- **Zakładki:** Dane (tryb, zapisane stany testowe, reset misji/postępu
  z potwierdzeniem, eksport kodu), Postęp (dzielnice, misje po ID,
  „wszystkie misje grywalne”, postęp do misji, poziom gracza, XP,
  Core City, rundy Areny, funkcje), Warsztat (każdy kosmetyk: odblokuj /
  załóż / zabierz, zapas wzmocnień, dodatki Areny, odznaka), Ekonomia
  (monety, pryzmaty, symulacja zakupów przez `grantProduct()`, nagrody),
  Rozgrywka (start dowolnej misji z darmowymi wzmocnieniami, sukces ★/★★★,
  porażki, czas, rozmiar T1–T6/promień, wzmocnienia i moce na żywo,
  mutacje, Złoty Rdzeń, SZAŁ, Wielki finisz, wymuszona wygrana/przegrana),
  Ekrany (wyniki, odprawa, karta startu, oferta +20 s, pauza, celebracje,
  kalendarz, skrzynia, reklama, karty, zgoda, ekran powitalny).
- Listy generowane z danych gry; zmiany idą przez funkcje gry
  (`grantXp()`, `grantCoreCityLevelReward()`, `grantProduct()`,
  `onEquipClick()`, `openFreeChest()`, koniec misji/rundy przez ich
  własną ścieżkę).
- Zmiany w rdzeniu tylko jako haki nieaktywne bez trybu testowego
  (`SAVE_SLOT`, strażniki `DEV.sandbox`, `isMissionPlayable`); bramka
  wzmocnień czyta też `unlocks.announced` (ogłoszone odblokowanie się nie
  cofa) — tylko w trybie testowym; dla graczy bez zmian.
- Testy: nowy `qa/dev-panel.mjs` (dostęp, symulowany host produkcyjny,
  izolacja, każda kategoria i jej realny skutek w grze, telefony
  w pionie/poziomie, komputer).

## v22 „Dwa tryby” — bez energii, Arena i Dzielnice niezależne
Runda 1 przygotowań komercyjnych: uprościć start, nie ograniczać grania,
rozdzielić tryby.

| Było | Jest |
|---|---|
| Energia: 5 punktów, +1 co 20 min, każda runda i próba misji kosztuje 1; arkusz „BRAK ENERGII”, chip w nagłówkach, reklama „+1 energia”, IAP „Godzina bez limitu”, przełącznik per platforma | **Bez limitu**: wszystko usunięte (logika, UI, CSS, sklep, reklama, teksty EN); kolejne rundy i próby startują od razu |
| Pierwsze uruchomienie: samouczek M00 (4 kroki z kartą trenera), Arena dopiero po nim | **GRAJ → od razu runda Areny**; podpowiedzi tylko dla wahającego się gracza (brak sterowania 1,6 s, brak kęsa 4 s, mniejszy rywal, pierwsze pochłonięcie) i nigdy dla tego, kto po prostu gra; nauczona umiejętność nie wraca (`save.coach`) |
| Arena pokazywała tylko obiekty „odkryte” w misjach | Cały bestiariusz Areny od 1. rundy; rozmiary T1–T6 tylko z wielkości wiru |
| Warsztat po M02, Wyzwania po M03 (kampania blokowała Arenę) | Wyzwania po **3 rundach Areny**, Warsztat po **2 rundach albo M02**; wzmocnienia nadal po M04; odblokowanie nigdy się nie cofa |
| Wir „Aurora Finału” (nagroda kampanii) dawał +20% punktów w Arenie | Trofeum bez bonusu — kampania nie zmienia balansu Areny |
| Pryzmaty szły głównie na energię | Wzmocnienie misji za **4 ◆** przy braku monet, nowe Efekty i Finisze za 20–40 ◆ (wcześniej nic do kupienia w tych kategoriach), lista źródeł z obu trybów |

- Po pierwszej rundzie kampania przedstawia się raz („DRUGI TRYB ·
  KAMPANIA”); Core City opisane jako postęp Areny („Każda runda Areny
  buduje Twoje miasto”, GRAJ „Arena · runda 2:00”). NELA przedstawia się
  w M01. Zablokowane zakładki mówią, ile rund Areny zostało.
- Zapis: schemat 13 (`migrateSave()`): usuwa energię, odkryte typy
  i M00, zachowuje misje, gwiazdki, waluty, Core City i otwarte zakładki;
  gracz z postępem nie dostaje podpowiedzi ani prezentacji kampanii.
- Testy: nowy `qa/v22.mjs`; zaktualizowane `edge-cases`, `features`,
  `design`, `flow`, `v15`, `v17`, `v19`, `audio`, `screens`.

## v21 „Komputer” — gra na dużym ekranie
Zgłoszenie: „na kompie w przeglądarce cały interface wygląda jak na
telefon ucięty taki mały” (a portale to głównie komputery).

| Było | Jest |
|---|---|
| Runda w stałej skali: monitor widział kilka razy więcej mapy niż telefon, wir i obiekty malutkie | Obraz dopasowany do ekranu: tyle miasta co na telefonie, duży wir; gracz na monitorze nie widzi dalej |
| Menu jako wąski pasek telefonu na środku monitora | **Układ poziomy**: nawigacja po lewej, każdy ekran w dwóch kolumnach (Miasto, Dzielnice z 12 dzielnicami naraz, Warsztat, Wyzwania, wyniki), szeroki ekran startowy; wszystko bez przewijania, także 960×540 |
| Pasek dzielnic ucięty w pół kafelka, bez przewijania myszą | Na komputerze siatka wszystkich dzielnic; w wąskim oknie kółko myszy przewija pasek, ucięta krawędź się rozmywa |
| Samouczek: „Przeciągnij palcem” także przy myszy | Na komputerze: „Prowadź kursorem myszy (albo strzałki / WASD)” |

- Telefony i tablety w pionie bez zmian. Mapka w rogu i podglądy na
  kanwach rosną i są ostre. Testy: `qa/v21.mjs` (telefony bez zmian;
  1366×768, 1440×900, 1920×1080, 960×540, 1180×820).

## v20 „Bramy impulsu” — bramy i portale jako pomocnicy, nie cel
Zgłoszenie: „portale w misjach bez sensu” — np. M11 „Pierwszy impuls”:
dotknij dwóch migających słupków na pustej mapie, nic do zjedzenia.

| Było | Jest |
|---|---|
| 16 misji z celem „przejdź przez bramę / pas przelotu / portal, gdy świeci” — wir niczego nie je, czeka na mignięcie | Cele z jedzeniem (motyw dzielnicy zostaje); bramy i portale tylko pomagają |
| Brama: mały słupek na środku mapy, rytm otwarcia | **Brama impulsu** na jezdni (koło ze strzałkami): przejazd daje **+50% prędkości na 2,5 s**, potem ładuje się 5 s (łuk ładowania); pierwsza zawsze na ekranie od startu |
| Pas przelotu: pas przez całą mapę, trzeba przelecieć w całości, póki świeci | Ta sama brama impulsu |
| Portal: jednorazowy, w jedną stronę, na mapie, po której i tak można przejechać | **Para portali** w obie strony — skrót do kryształów i z powrotem |

- Odprawa i karta startu mają plakietkę „BRAMY IMPULSU” / „PORTALE”
  z jednym zdaniem, co robią. Nowe kwestie NELI, opis Parku Impulsów.
- Czasy 16 misji skalibrowane botem od nowa (`qa/calibrate.mjs` przyjmuje
  teraz listę misji); bot nie korzysta z bram, więc z nimi gracz łatwiej
  zdobywa gwiazdki.
- Testy: `qa/v20.mjs`.

## v19.1 — „Zmień wzmocnienia” na karcie startu
- Zgłoszenie: na karcie startu M04 „Zmień wzmocnienia” był wielkim
  rozstrzelonym napisem i otwierał odprawę bez żadnych wzmocnień
  (odblokowują się dopiero po ukończeniu M04).
- Teraz to mała pigułka pod START. Przed odblokowaniem nazywa się
  „Wróć do mapy” i wraca do Dzielnic; po odblokowaniu „Zmień wzmocnienia”
  otwiera odprawę z wybranymi wcześniej wzmocnieniami (wracają do zapasu).
- Testy: `qa/v18.mjs` sprawdza wygląd i oba przypadki.

## v19 „Premiera” — angielski, energia per platforma, bezpieczny zapis
Przygotowanie do wydania na portalach (Poki / CrazyGames) i w sklepach:

| Potrzeba | Zmiana |
|---|---|
| Gra tylko po polsku (portale są globalne) | **Wersja angielska**: cała gra — interfejs, 240 misji, NELA, opisy, banery w rundzie — ~1800 tekstów i wzorców. Język z przeglądarki (polski dla `pl-*`, angielski dla reszty), przełącznik w Profilu |
| Energia ucina czas gry na portalach | **Przełącznik energii per platforma**: na portalach wyłączona, w wersji z GitHuba i w aplikacji włączona; `?energy=0/1` do testów — można włączyć w każdej chwili |
| Ryzyko utraty postępu | **Zapis w chmurze CrazyGames** (konto gracza, synchronizacja urządzeń; wygrywa zapis z większym postępem), **kopia zapasowa** w Profilu (kod do skopiowania i wczytania na innym urządzeniu), prośba o trwałe przechowywanie |

- **Jak działa tłumaczenie:** warstwa na wyjściu — wszystko, co trafia na
  ekran (napisy i tekst rysowany w grze), przechodzi przez słownik `I18N_EN`;
  teksty składane z kawałków mają wzorce.
- **Testy:** `qa/v19.mjs` — bot przechodzi po angielsku wszystkie ekrany,
  241 odpraw, rundy i wyniki i sprawdza, że nic po polsku nie dotarło na
  ekran; energia na portalu (udawane SDK CrazyGames); zapis w chmurze w obie
  strony; kopia zapasowa. Pozostałe testy działają jak polska przeglądarka.

## v18 „Złoty strzał: ekonomia” — wzmocnienia jako lejek monetyzacji
| Uwaga | Zmiana |
|---|---|
| Przegląd monetyzacji i balansu | Monety tracą wartość (ekspert: ~9 700 niewydanych po 20 rundach) → wzmocnienia misji jako stałe ujście monet; sklep i reklamy dostały drogę do wzmocnień; ceny wzmocnień zbalansowane botem (Sprint +15% za 70, Turbo start 80 → 70, Magnes 50 → 40) |
| Kupowanie tooli przed misją (szybkość, start od T2…) | Było od v15 (po M04): Zegar, Turbo start (T2), Magnes, Tarcza. Nowe: **Sprint** (+15% prędkości). Po porażce przycisk **„SPRÓBUJ Z: …”** z wzmocnieniem dobranym do przyczyny; brak monet → **wzmocnienie za reklamę** (3/dzień); **Pakiet wzmocnień** (7,99 zł, 5× każde) i 3× każde w Pakiecie Startowym |

- **Balans (bot „casual”, 24 misje TRUDNE i EKSTREMALNE × 3):** bez
  wzmocnień 59%, Zegar 79%, Sprint 76%, Magnes 73%, Turbo start 71%; żadne
  nie robi z EKSTREMALNEJ pewniaka. Pierwsza wersja Sprintu (+25% za 50)
  dawała +29 pkt — przycięta.
- **Testy**: `qa/v18.mjs` (Sprint, prezent dla obecnych graczy, propozycja
  po porażce dla każdej przyczyny, odprawa z wybranym wzmocnieniem bez
  wydawania, reklama za wzmocnienie z limitem, pakiety sklepu, pomiar
  balansu) w `run-all`.

## v17.1 „Miasto jako haczyk”
| Uwaga | Zmiana |
|---|---|
| Na ekranie głównym nieporządek; wcześniej budowa miasta była haczykiem, teraz nie czuć, czemu to fajne | Jeden bohater: duża karta Core City nad GRAJ (scena Areny zeszła z Miasta). W niebie karty: „Każda runda buduje Twoje miasto · +16% za rundę · nagroda za 7 rund”, nad dźwigiem znacznik „NOWY BUDYNEK”, kontury kolejnych budynków; GRAJ: „runda 2:00 · +16% budowy miasta”. Bez pustych pasów i przewijania |

## v17 „Pierwsze wrażenie” — ekran startowy, który zaprasza do gry
Uwagi właścicielki i co zmieniono:

| Uwaga | Zmiana |
|---|---|
| Pusty kafelek dzielnicy (iPhone) | WebKit rysował animowaną kanwę kafelka nad jego napisem; napisy nad żywymi kanwami (kafle dzielnic, Core City, mapa dnia) mają teraz własną warstwę |
| Ekran startowy nie zachęca do gry | **Start**: demo to prawdziwa mini-runda (wir je, rośnie T1→T4, zjada rywala, punkty) zamiast wiru stojącego w pustym mieście. **Miasto**: na górze żywa scena Areny tuż nad GRAJ (dotknięcie = gra), GRAJ z rekordem do pobicia, zwarta karta Core City, pełna nazwa następnej misji, bez pustych pasów |

- **Testy**: `qa/v17.mjs` (demo gra całą pętlę, kolejność i brak
  przewijania na 375×667 i 402×874, haczyk z rekordem, dotknięcie sceny,
  warstwy napisów nad kanwami) w `run-all`.

## v16 „Brzmienie” — 15 utworów, muzyka, która się zmienia
Uwaga właścicielki i co zmieniono:

| Uwaga | Zmiana |
|---|---|
| Więcej muzyczek, aby się zmieniały i nie było monotonnie | Zamiast jednej 4-akordowej pętli — **15 syntezowanych utworów** (0 KB plików audio): 3 spokojne do Miasta i menu, **motyw każdej z 12 dzielnic**. Arena: inny utwór w każdej rundzie i kolejny po ~50 s (runda = 2–3 utwory); misja gra motyw swojej dzielnicy; menu rotują |
| (w środku utworu) | Sekcje zwrotka / refren z melodią / mostek / drop, przejścia perkusji, talerze, co drugie przejście inny arpeggiator i bas; w końcówce rundy takt narastania i **skok do dropu**, w SZALE melodia w oktawach; boss dzielnicy zaczyna od dropu |

Poza uwagą:
- **Szafa grająca** w Profilu: lista utworów, dotknij = posłuchaj i ustaw
  ulubiony na stałe, „Mieszanka” wraca do zmian. Motywy Rozdziału II
  odblokowuje dotarcie do ich dzielnicy (odprawa bossa: „nowa dzielnica
  i jej utwór”) — kolejny powód, by iść dalej w Kampanii.
- **„TERAZ GRA”**: plakietka z nazwą nowego utworu w rundzie; w pauzie
  nazwa utworu i przycisk **NASTĘPNY**; pauza ścisza muzykę „pod wodę”.
- **Miks**: pady „oddychają” ze stopą, echo i pogłos na melodiach,
  osobne brzmienia (lo-fi, chiptune, klaśnięcia, dzwonki, organy).
- **Efekty grają z muzyką**: combo wspina się po skali bieżącego utworu,
  fanfary i awanse w jego tonacji. Nowe sygnały: start rundy/misji,
  „za duże”, objęcie/utrata prowadzenia, tarcza, portal, WIELKI FINISZ,
  karty ewolucji, większy rywal w pobliżu.
- **Runda recenzji (audio/design + kod, dwóch niezależnych recenzentów)**:
  końcówka rundy bez „składanki” (utwór zostaje i krąży refren → drop),
  różne progresje akordów w każdym utworze, nowe nazwy utworów Rozdziału II
  (nie dublują nazw dzielnic), plansza „NOWY UTWÓR”, podgląd w szafie
  z perkusją i melodią, tempo słowami zamiast „BPM”, fanfary we właściwej
  tonacji w utworach durowych, stopa i bas słyszalne w głośniku telefonu,
  mniej basu w efektach (nie ściskają muzyki), bicie serca słyszalne na
  telefonie, boss uderza dropem na START, NASTĘPNY w trakcie przejścia,
  zapis odporny na nazwy z prototypu, echo/pogłos wyłączone bez muzyki.
- **Testy**: `qa/audio.mjs` (render offline każdego utworu, logika scen,
  drop, szafa grająca, stres, runda bota z dźwiękiem) w `run-all`.

## v15 „Wyzwanie” — 240 misji, rosnąca trudność, 3 gwiazdki, energia
Uwagi właścicielki i co zmieniono:

| Uwaga | Zmiana |
|---|---|
| Druga dzielnica nie ma nazwy | Każdy boss dzielnicy ma neonową tabliczkę z nazwą (jak „KINO” na Placu): FONTANNA, DŹWIG, GALERIA…; kafel Kampanii na Mieście nosi nazwę dzielnicy |
| Start levelu na kliknięcie, żeby przeczytać komunikat | Misja otwiera się zamrożona z kartą startu (NELA, cele, zwroty akcji, wzmocnienia, czasy gwiazdek); zegar rusza dopiero po dotknięciu |
| Przed levelem dokupić toole | Odprawa przed każdą misją: Zegar +15 s, Turbo start (T2), Magnes, Tarcza (2 zderzenia); z zapasu albo za monety, koszt widoczny na GRAJ; po M04 po jednym w prezencie |
| Rosnąca trudność, niektóre levele bardzo trudne | 5 poziomów trudności (ŁATWA → EKSTREMALNA), limity liczone z czasu bota-eksperta; zmierzone przejścia za 1. razem (bot „casual”): 100% → 99% → 89% → 60% → 53% |
| Trzy medale | Trzy gwiazdki na misję (ukończ / szybki czas / czas eksperta lub wyzwanie), skrzynia gwiazd co 15 gwiazdek, tytuł „PERFEKCYJNIE!” |
| Więcej dzielnic i ciekawszych misji, na miesiąc gry | Rozdział II „Głęboki Glitch”: 6 nowych dzielnic × 30 misji (razem 240), 6 nowych bossów, 6 zwrotów akcji: Łowcy, Złodziej, Ciemność, Strefy glitcha, Kruchy wir, Złote bajty |
| Limitowany czas gry w sesji z dokupieniem | Energia: 5 punktów, +1 co 20 min; runda/próba = 1, wygrana misja zwraca; przy 0 arkusz „BRAK ENERGII”: pełna za 12 pryzmatów, +1 za reklamę, „Godzina bez limitu” w sklepie |

Poza uwagami:
- **Porażki z sensem**: trzy przyczyny („CZAS MINĄŁ”, „ZŁODZIEJ BYŁ
  SZYBSZY”, „WIR ROZBITY”) z podpowiedzią NELA; po 3 porażkach z rzędu
  NELA pożycza Zegar; rewanż „+20 s” także za 8 pryzmatów.
- **Każdy start przez odprawę** (Dzielnice, Miasto, wynik, powtórka,
  restart z pauzy) — wzmocnienia i koszt energii zawsze przed grą.
- **Uczciwość planszy**: skupiska combo nigdy tuż przy starcie (combo
  w 3 s), nic w rogu poza zasięgiem wiru, strzałka prowadzi do jedzenia,
  gdy cel jest jeszcze za duży (w ciemności nie było jak go znaleźć).
- **Runda recenzji (design + kod, dwóch niezależnych recenzentów)**:
  formy neutralne płciowo w nowych tekstach, „Nocny Bazar odzyskany”,
  progi ★★/★★★ nie szybsze niż 1,3×/1,1× ekspert, najwyżej 3–10 misji
  EKSTREMALNYCH na dzielnicę (reszta BARDZO TRUDNA), „Kruchy wir” zawsze
  z zagrożeniem, Tarcza wyłączona tam, gdzie nic nie uderza, i liczy
  zderzenie do wyzwania „bez zderzeń”, „Zmień wzmocnienia” na karcie
  startu (zwraca energię i wzmocnienia), Złodziej nie wygrywa po
  wygranym już wyścigu, GRAJ z pustą energią nie pobiera podwójnie,
  reklama nigdy przed pustą energią, karta startu nie zasłania pauzy,
  duplikaty i nazwy misji poprawione.
- **Dźwięk**: dzwonek każdej gwiazdki, „power-up” startu i energii.
- **Telemetria**: `mission_end` z trudnością, gwiazdkami, przyczyną
  porażki, numerem próby i wzmocnieniami; `energy_spend/empty/refill/gain`,
  `booster_use`, `pity_booster`, `star_chest`, `mission_go`.
- **Zapis v12** z migracją: stary medal → 2. albo 3. gwiazdka, gracz po
  finale dostaje Rozdział II, pełną energię i wzmocnienia w prezencie.
- **QA**: `qa/v15.mjs` (41 testów systemów), `qa/difficulty.mjs` (każda
  z 240 misji grana przez eksperta i „casuala”), `qa/calibrate.mjs`
  (kalibracja czasów), wspólny bot kampanii w `qa/lib.mjs`; test cofania
  zegara nie zależy już od godziny uruchomienia.

## v14 „Czytelność” — jedna jasna akcja na ekran, misje z odprawą
Uwagi właścicielki i co zmieniono:

| Uwaga | Zmiana |
|---|---|
| Ekran startowy ma dużo niepotrzebnych elementów | Logo + żywe demo gry + jeden przycisk GRAJ (bez 3 kart cech i akapitu premisy) |
| GRAJ „lewituje” z ekranem | Miasto bez przyklejonej płyty: nagłówek z poziomem gracza, karta Core City (poziom, następna nagroda, pasek w środku karty), duży GRAJ w treści ekranu, kafle Kampania/Wyzwanie dnia, skrzynia — wszystko mieści się bez przewijania (także 375×667) |
| Po misji „DALEJ: M12”, ale nie wiadomo, dokąd się idzie | Wynik misji: kafle wynik/czas/medal, NELA w dymku, a nad przyciskiem „GRAJ M12” karta następnej misji (cele z ikonami, czas, medal, nagroda); po porażce „SPRÓBUJ PONOWNIE” i lista brakujących celów |
| W Dzielnicach trzeba zjechać na sam dół, żeby uruchomić misję | Dzielnice: poziomy pasek dzielnic, karta „NASTĘPNA MISJA” z własnym GRAJ na górze, każda misja z listy otwiera odprawę (arkusz od dołu) z przyciskiem GRAJ |
| Opisy misji mało czytelne | Cele jako numerowane wiersze z ikoną i dużą czcionką (odprawa, karta następnej misji, wynik); większe pole celu w misji z rozbłyskiem na starcie; baner „CEL ZALICZONY” po każdym zaliczonym celu |
| Teksty fabularne niezauważalne | NELA jako postać: awatar (soczewka SI w heksagonie), różowe dymki, sygnał dźwiękowy; historia każdej dzielnicy w Dzielnicach i w świętowaniu nowej dzielnicy |
| Dużo elementów zaburzających czytelność | Usunięte: napisy „VECTOR HOLE” nad tytułami, przyciski POWRÓT/DO MIASTA dublujące nawigację, osobne karty monet/XP/Core City w wyniku Areny (teraz jedna karta NAGRODY), podpis „Liczą się punkty…”, kafelki „jak grać”, droga poziomów i dwa czipy nagród w Mieście, „AKTYWNE ELEMENTY” w Warsztacie |

Poza uwagami:
- **Warsztat**: dotknięcie posiadanego przedmiotu od razu go zakłada
  (przycisk ZAŁÓŻ był pod całą siatką); przedmiot na sprzedaż pokazuje się
  na podglądzie i wymaga potwierdzenia „KUP I ZAŁÓŻ” (wcześniej jedno
  dotknięcie wydawało monety); przedmioty z nagród mówią, skąd je zdobyć.
- **Pauza**: „ZACZNIJ RUNDĘ/MISJĘ OD NOWA” zamiast „RESTART MISJI / RUNDY”.
- **Balans misji combo**: misje z łukiem fragmentów (M03, M33) dostają
  zapasowe skupisko — zerwane combo nie przekreśla już misji.
- **Runda recenzji (UX + kod)**: dymek NELA nisko nad minimapą, zamykany
  dotknięciem i chowany pod pauzą/rewanżem/ewolucją; „rozmiar T2” zamiast
  „poziom T2” (poziom = tylko gracz); medal jako „Medal: Ukończ w 0:35”;
  wynik misji bez kafla WYNIK, gdy cel nie dotyczy punktów, „POSTĘP” po
  porażce, trzy równe wyjścia POWTÓRZ / DZIELNICE / MIASTO; zakup
  w Warsztacie jako arkusz od dołu z „NIE TERAZ”; zablokowana misja
  prowadzi do tej, która ją odblokowuje; stare zapisy (M01 bez M00) nie
  wracają do samouczka; powtórka pamięta wcześniejszy medal; „CEL
  ZALICZONY” raz na cel; przyciski ≥ 40 px.
- **QA**: nowy zestaw `qa/flow.mjs` (36 testów przepływu i regresji), bot kampanii
  goni małe kąski, gdy cel combo jest otwarty (jak człowiek), nowe zrzuty
  17–25 w `qa/screens.mjs`. Arkusz stylów odchudzony o ~100 martwych reguł.

## v13.5 — iPhone 13 Pro: plansza ucięta na dole
v13.4 rozciągało aplikację, ale `html`/`body` zostawały krótsze i obcinały
dół planszy z minimapą. Przyczyna u źródła: pasek statusu
`black-translucent`. Teraz pasek jest `black` — widok zaczyna się pod nim
i ma dokładną wysokość; rozciąganie (`fitStandalone()`) usunięte.

## v13.4 — iPhone 13 Pro: aplikacja z ekranu głównego
Na iPhonie z notchem w trybie z ekranu głównego był czarny pas na dole
(WebKit liczy `100dvh`/`innerHeight` bez paska statusu, ~47 px), a tytuł
wchodził pod pasek statusu. Teraz w tym trybie aplikacja ma pełną wysokość
ekranu (`max(100vh, 100dvh)` + `fitStandalone()`), płótno mierzy się z
rozmiaru aplikacji, a każdy ekran ma odstęp `safe-area-inset-top`.

## v13.3 — dźwięk na iPhonie, cd.
v13.2 nie wystarczyło w aplikacji z ekranu głównego ani w Chrome na iOS
(WKWebView bez `navigator.audioSession`): przełącznik „cicho” dalej wyciszał
Web Audio, choć silnik raportował „działa”. Teraz na iOS w geście startuje
ciche, zapętlone `<audio>` (WAV zbudowany w pamięci), które przełącza
stronę w tryb odtwarzania mediów. W Profilu doszedł „Test dźwięku” z
linijką diagnostyczną (stan silnika, tryb iOS).

## v13.2 — dźwięk na iPhonie
Na iPhonie dźwięk w przeglądarce nie grał albo znikał (np. po samouczku):
iOS wycisza Web Audio przełącznikiem „cicho”, przełącza kontekst w stan
`interrupted` (powiadomienie, zmiana aplikacji, blokada), którego stary kod
nie wznawiał, a odblokowanie startowało na `pointerdown`, który w Safari nie
jest gestem. Teraz: sesja audio „playback”, wznawianie z każdego stanu przy
każdym tapnięciu, odbudowa „zablokowanego” kontekstu, ciche „pobudzenie”
wyjścia w geście, ponowna synchronizacja zegara muzyki. Nowe testy w
`qa/features.mjs` symulują stany iOS (stary kod oblewa 5 z nich).

## v13.1 — iPhone (dolna nawigacja i reset profilu)
Na iPhonie 16 Pro w Safari podpisy dolnych zakładek i przycisk „RESETUJ
PROFIL” chowały się pod paskiem przeglądarki: `#app` miał `100vh`, które
w iOS ignoruje paski Safari. Teraz `100dvh` (widoczna wysokość) oraz
margines na pasek domowy i wyspę na ekranie profilu. Testy układu na
402×874, 402×740 i 375×667 w `qa/design.mjs`.

## v13 — pas designu i rozgrywki
Diagnoza z audytu (2 niezależnych recenzentów + boty) i co zmieniono:

| Problem | Zmiana |
|---|---|
| Na starcie rundy ~4 obiekty na ekranie, pierwszy kęs po 1,1 s, 7 kęsów w 10 s | Ścieżki energii wzdłuż ulic + uczta wokół startu: 0,5 s i ~17 kęsów |
| Wynik Areny to nokaut w jedną stronę (wygrana o 20 000 albo 5. miejsce) | Rywal-pacer dopasowany do formy gracza, banery zmiany lidera i „BRAKUJE N PKT” |
| Dziura sama jechała do środka mapy przed pierwszym dotykiem i stawała pod trzymanym palcem | Palec przeliczany co klatkę, start w miejscu, puszczenie = stop |
| Samouczek: pusty ekran, limit 90 s (można przegrać i dostać ofertę reklamy), lista 4 zadań naraz, okna blokujące zła kolejność | Bez limitu, jedzenie wokół startu, jeden krok w karcie trenera, strzałka do celu |
| 5 ekranów między samouczkiem a 1. rundą | „ZAGRAJ TERAZ” startuje rundę; nowicjusz bez ekranu wsparcia i kalendarza |
| Za duży obiekt — cisza | „ZA DUŻE · URÓŚNIJ DO Tn” |
| Teksty: gracz jako kobieta, angielski żargon, „Rdzeń” w 5 znaczeniach, brak premisy | Forma neutralna, polskie nazwy (Wir/Smuga/Finisz, Wielki finisz, Godzina szczytu), premisa z NELA |
| Sklep pusty po 5–10 rundach | Ceny ×~3,3 |
| Godzina szczytu w 1. rundzie, ściana trudności jak klif | Brak modyfikatora przy t = 0, rampa do 24 rund, 2,5 s ochrony na starcie |

Plus: lżejsze rysowanie obiektów na najniższej jakości grafiki, przyklejony
pasek GRAJ 2:00 z tłem, nowy zestaw `qa/design.mjs`, porządek w dokumentacji.

## Wcześniej
- **v12 „Złoty Strzał VISUAL”** — Neonowe Miasto jako podłoga (dzielnice,
  ulice, cache kafli), widoczne wpadanie obiektów do wiru, korona lidera,
  oddalanie kamery i limit promienia, kompaktowy HUD, przyklejone akcje wyniku.
- **v11 „Złoty Strzał ULTRA”** — dźwięk syntezowany w WebAudio, adapter
  monetyzacji (portal/natywny, demo w przeglądarce), wyzwania znajomych i karta
  do udostępnienia, zgoda RODO, pieczęć i sanityzacja zapisu, adaptacyjna
  jakość, boty QA w repo.
- **v10** — klasy obiektów T4–T6, 61 misji zapisanych jako cele, kalibracja
  czasów automatycznym przejściem.
- **v9** — spójny wygląd, Wiry z bonusami, Złoty Rdzeń i SZAŁ, fonty.
- **v8** — poziom gracza (XP), kalendarz logowania, darmowa skrzynia, krzywa
  trudności kariery, zoom kamery, efekty (teksty, banery, konfetti).
- **v6** — unikalne obiekty misji, sylwetki landmarków, mechaniki Portalu,
  Mostku i Pasu przelotu.
- **v5** — zgodność UI z makietami w `design/screens/`, paleta z asset bible.
- **v4** — ekonomia Core City, pełna kampania, nawigacja dolna, Warsztat.
- **v3** — tryb Kampanii.
- **v2 „Golden Shot”** — joystick, ewolucje, Overdrive, hub, sklep, wyzwanie
  dnia, analityka.
