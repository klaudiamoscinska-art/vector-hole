# Vector Hole — jak działa gra (stan v22)

Jedyny aktualny opis projektowy gry. Liczby pochodzą z `CONFIG` i tabel w
`game.js` — przy zmianie balansu poprawiaj **ten** plik razem z kodem.
Historia wersji: `docs/CHANGELOG.md`. Architektura kodu: `CLAUDE.md`.

## 1. Premisa i ton

> Glitch skaził Neonowe Miasto — latarnie, auta i wieżowce zamieniły się w
> zepsuty kod. Ty sterujesz żywym wirem, który pochłania skażone miasto,
> a NELA, sztuczna inteligencja miasta, przerabia tę energię i odbudowuje
> centrum (Core City).

- Pochłanianie = oczyszczanie; energia z rund Areny odbudowuje Core City,
  misje kampanii odzyskują dzielnice. NELA przedstawia się w M01
  (v22: samouczka już nie ma).
- **NELA jest postacią (v14)**: awatar (soczewka SI w heksagonie,
  `NELA_AVATAR`), różowy dymek z podpisem „NELA” i krótki sygnał dźwiękowy
  (`SoundEngine.nela()`). Mówi: w odprawie misji, na starcie misji (dymek
  w grze), w wyniku misji i w historii każdej dzielnicy (`DISTRICT_STORY`,
  także w świętowaniu nowej dzielnicy). Szare kursywy z v13 nikt nie
  zauważał.
- **Gracz jest zawsze adresowany neutralnie płciowo**: czas teraźniejszy
  („rośniesz”), tryb rozkazujący, albo podmiotem jest wir/dziura („Twój wir
  urósł”). Żadnych form „urosłaś/urosłeś”, „gotowa/gotowy”
  (`qa/design.mjs` pilnuje listy zakazanych form).
- Polski interfejs bez angielskiego żargonu. Kategorie Warsztatu: **Wir**
  (wygląd dziury), **Smuga** (ślad), **Efekt pochłaniania**, **Finisz**
  (kolor wielkiego finału). Marki zostają: Vector Hole, Core City, COMBO,
  GRAJ 2:00, LVL (tylko dla Core City — poziom gracza to „POZIOM”).
- Miejsca w zdaniach: „2. miejsce”, nie „#2” (wyjątek: zwarte tabele HUD).

## 1a. Dwa niezależne tryby (v22 „Dwa tryby”)

Arena (GRAJ 2:00, Wyzwanie dnia, wyzwania znajomych) i Dzielnice
(kampania, 240 misji) to **dwa osobne tryby**, oba dostępne od pierwszego
uruchomienia, bez wzajemnych blokad i **bez limitu grania** (energii nie
ma od v22 — kolejne rundy i próby misji startują od razu).

| | Arena | Dzielnice |
|---|---|---|
| Progresja | Core City LVL 1–6 (+%) i nagrody kosmetyczne, rosnąca trudność rywali (od liczby rund), pacer | 12 dzielnic, gwiazdki, Skrzynie gwiazd, nowe dzielnice i ich utwory |
| Rozmiary T1–T6 | tylko z wielkości wiru w rundzie; cały bestiariusz od 1. rundy | tylko z jednostek wzrostu w misji |
| Odblokowania | **Wyzwania** po 3 rundach Areny | **wzmocnienia** po M04 (+ po jednym w prezencie) |
| Ulepszenia | **brak** (PX02 D+: nic, co zmienia rundę, nie jest na sprzedaż; wiry to sam wygląd) | wzmocnienia misji, pożyczka NELI |
| Nagrody | monety, XP, Core City, co 3. runda +2 pryzmaty, rekord dnia | monety za misję, XP, Skrzynie gwiazd (monety, pryzmaty, wzmocnienie) |

- Wspólne są tylko: **portfel** (monety, pryzmaty — oba tryby je
  zarabiają i wydają; żaden nie wymaga waluty zdobywanej tylko w drugim —
  sprawdza bot: 6 misji opłaca wzmocnienie, 3 rundy Areny pierwszy Wir),
  **wygląd wiru** (Warsztat), poziom konta (XP z obu trybów, nic nie
  blokuje) i ustawienia.
- **PX02 D+ (decyzja właścicielki, 2026-10-17): „W Arenie liczy się to, jak
  grasz. Monety kupują wygląd i wzmocnienia misji”.** Wiry nie dają
  żadnego bonusu (prędkość, combo, magnes, XP, monety, start, punkty,
  wzrost — wszystkie usunięte, także Kryształ i Pryzmat z Core City); przed
  rundą Areny nie ma ekranu dodatków (Tarcza / Magnes / Turbo start za
  monety), a po przegranej nie ma Turbo za monety ani za reklamę — także w
  Wyzwaniu dnia i wyzwaniach znajomych. GRAJ, ZAGRAJ JESZCZE RAZ i rewanż
  startują od razu. Jedyny przepływ między trybami to **świadomy zakup**:
  monety z Areny mogą opłacić wzmocnienie misji w odprawie (jawny,
  zaakceptowany wyjątek, `ARENA_DISTRICT_CONTRACT.md`); w drugą stronę nic
  nie płynie — postęp, nagrody i zakupy Dzielnic nie zmieniają Areny.
- **Jednorazowy zwrot (D+, `settleLooksOnly()`):** zapis sprzed D+, który
  ma płatne wiry z dawnym bonusem, dostaje raz ich cenę z cennika (Cyjan
  100, Gorący Róż 220, Toksyczna Zieleń 450, Ultrafiolet 800, Neonowe
  Złoto 1300, Biała Plazma 2000 — komplet 4870). Wiry zostają (posiadane i
  założone). Kryształ i Pryzmat (nagrody Core City) tracą bonus bez zwrotu;
  Tęcza i Aurora nigdy go nie miały. Zwrot i znacznik `economy.looksOnly`
  trafiają do zapisu w tym samym `saveGame()` (oryginał najpierw pod
  `.bak`); przy zablokowanym zapisie (`SAVE_GUARD`) zwrotu nie ma, a przy
  nieudanym zapisie jest cofany w pamięci (następne uruchomienie próbuje
  ponownie). Karta „Wiry są teraz tylko wyglądem” z kwotą pokazuje się raz,
  tylko po udanym zapisie — i dopiero gdy zapisze się też jej znacznik
  „widziane” (inaczej wraca przy następnym uruchomieniu). Nowy profil rodzi się rozliczony, więc wir
  kupiony po D+ nigdy nie dostaje zwrotu; wir kupiony w sesji, w której
  linia zapisu nie była jeszcze rozliczona (zapis zablokowany albo
  nieudany), trafia do `economy.boughtAfter` i też go nie dostaje.
- **Warsztat** otwiera się po 2 rundach Areny **albo** po misji M02 — co
  pierwsze; odblokowanie nigdy się nie cofa (`CONFIG.unlockGates`).
- Postęp kampanii nie zmienia Areny (mapa, rywale, trudność, obiekty —
  wcześniej Arena pokazywała tylko typy „odkryte” w misjach), a postęp
  Areny nie zmienia misji (limity, start, plansza). Wir „Aurora Finału”
  (nagroda za M24) jest trofeum — jak każdy wir, sam wygląd.
- **Pierwsze uruchomienie:** ekran powitalny z jednym GRAJ → od razu runda
  Areny (z linkiem wyzwania — ta runda). Po niej pojawia się nawigacja.
- **Drabina trzech rund (FTUE-1, wariant D, `CONFIG.ftue`):** wynik
  pierwszej Areny nie pokazuje żadnej karty ani reklamy „×2 MONET” (nagroda
  bez zmian, „WYZWIJ ZNAJOMEGO” wypełnia rząd; po rundzie opuszczonej
  w pauzie bez reklamy jest pierwszy *ukończony* wynik); główny przycisk to
  ZAGRAJ JESZCZE RAZ — od razu druga runda, bez Miasta i Dzielnic. Po 2.
  rundzie karta „WARSZTAT”, po 3. — „WYZWANIA”; każda czeka, aż skończy się
  animacja wyniku (2,4 s), i nie pojawia się, jeśli gracz zdążył już
  przejść dalej (zostaje plakietka NOWE na zakładce). Kampania nie ma już
  karty nad wynikiem: od 3. rundy Areny Miasto przedstawia ją na swoim
  kafelku kampanii („DRUGI TRYB · Kampania: 240 misji”, plakietka NOWE,
  także na zakładce Dzielnice) — bez okna, GRAJ zostaje nad nim. Dotknięcie
  kafelka otwiera Dzielnice. Kto już poznał kampanię (wizyta w Dzielnicach,
  rozpoczęta lub ukończona misja, wstęp z poprzedniej wersji w
  `save.unlocks.announced`), nie widzi wstępu. Dzielnice są dostępne od
  pierwszej rundy jak dotąd; progi odblokowań bez zmian.
- **Pierwsza runda uczy, nie samouczek (`CONFIG.coach`,
  `updateArenaCoach()`):** podpowiedź pojawia się tylko wtedy, gdy gracz
  się waha, i znika na zawsze, gdy pokaże umiejętność (`save.coach`):
  brak sterowania przez 1,6 s → „Przeciągnij palcem…” (mysz / kciuk —
  własny tekst; zostaje, dopóki wir nie ruszy); 4 s sterowania bez kęsa →
  „Najeżdżaj na świecące fragmenty…”; mniejszy rywal na ekranie przez 2 s
  (po 12 s rundy) → „Ten rywal jest mniejszy…”; pierwsze pochłonięcie
  przez większy wir → zasada o większych rywalach (raz). Kto gra od razu,
  nie widzi nic. Za duży obiekt objaśnia „ZA DUŻE · URÓŚNIJ DO Tn”.

## 2. Pętla rdzenia (Arena, GRAJ 2:00)

- Runda 120 s, gracz + 5 rywali na świecie 3000×3000 (siatka 8×8 kwartałów
  Neonowego Miasta, 6 dzielnic). Wygrywa **najwyższy wynik** (`rankHoles()`),
  rozmiar jest tylko dogrywką.
- **Pierwsze sekundy (v13):** 170 fragmentów + 40 kapsuł; 10 „ścieżek
  energii” po 8 fragmentów wzdłuż pasów ruchu (`layStreetTrails()`, combo ×8
  na start) i „uczta” wokół startu każdej dziury — 10 fragmentów na spirali
  + 2 kapsuły (`layStarterFeasts()`). Połowa zjedzonych fragmentów odradza
  się na jezdniach. Cel zmierzony botem „casual”: pierwszy kęs < 1 s,
  ≥ 12 kęsów w 10 s (było: 1,1 s i 7).
- **Wzrost:** wspólna krzywa jednostek wzrostu (`CONFIG.growth`): progi
  rozmiaru T2–T6 przy 6/22/50/100/180 jednostkach = promień 30/46/66/90/118.
  Fragment 1 jedn., kapsuła 3, element uliczny 3, pojazd 6, budowla T4 16,
  ciężki pojazd T5 24, wieża T6 40. Obiekt jest jadalny dopiero od swojego
  rozmiaru (bez warunku proporcji); najechanie na za duży obiekt pokazuje
  „ZA DUŻE · URÓŚNIJ DO Tn” (`lockedBump()`, z limitem częstotliwości).
  Maks. promień 480.
- **Punkty:** wartość obiektu × combo (okno 1,8 s, +0,15 za kęs, maks. ×3)
  × SZAŁ ×2. Zjedzenie rywala: 2× jego promień × combo. Bycie zjedzonym:
  powrót do rozmiaru startowego, wynik zostaje, 2 s ochrony.
- **Rywal-pacer (v13, `CONFIG.rival`):** pierwszy bot jedzie po krzywej
  „par” = mediana 5 ostatnich ukończonych rund gracza (2600, dopóki nie ma
  3 rund; w Wyzwaniu dnia i wyzwaniach znajomych zawsze 2600) ×
  0,72–1,05 wg trudności × (czas)^1,5, ale nigdy niżej niż 70–90% bieżącego
  wyniku gracza. Pod krzywą je z dalszego zasięgu, a jego kęsy liczą się
  do ×8 (wzrost do ×2); nad krzywą — od ×0,35. Efekt: zamiast wygranej
  o 20 000 pkt albo 5. miejsca jest wyścig. Banery: „X PROWADZI” (gdy
  tracisz prowadzenie), „PROWADZISZ!”, „AWANS NA N. MIEJSCE”, w ostatnich 15 s
  „BRAKUJE N PKT do 1. miejsca”.
- **Trudność kariery (`CONFIG.difficulty`):** t = 0 przez 3 pierwsze rundy,
  liniowo do 1 przy 24. rundzie (boty: start r 15→24, prędkość 0,78→1,12,
  polowanie na gracza z 0→560 px, pasywny wzrost). 2,5 s ochrony na starcie
  rundy, rywale startują ≥ 500 px od gracza. „Godzina szczytu” (szybsi rywale, 35% rund) nigdy przy t = 0.
  Ostatnie 40 s: rywale +10% prędkości.
- **Ewolucja:** przy promieniu 46 i 66 gra się zatrzymuje i oferuje 3 karty
  (`MUTATIONS`: Magnes, Turbo combo, Tarcza, Długie combo, Skaner, Fala,
  Łowca) albo POMIŃ. Działają do końca rundy.
- **Złoty Rdzeń:** po 10 s, potem co 20 s; kto zje — SZAŁ na 7 s
  (punkty ×2, zasięg ×1,35, prędkość ×1,2, obiekty o rozmiar większe).
- **Wielki finisz:** ostatnie 12 s — losowo (z ziarna) Zaciemnienie albo
  Burza portali (10 bonusowych obiektów).
- **Kamera:** oddala się z rozmiarem (1,08 → 0,58), a dalej tak, by dziura
  zajmowała ≤ 24% krótszego boku ekranu. Przy krawędzi miasta zatrzymuje
  jego brzeg na granicy obszaru bezpiecznego telefonu (notch, Dynamic
  Island, pasek gestów), nie ekranu — wir nigdy nie chowa się pod
  wycięciem (FTUE-2 FIX; widoczny kawałek miasta bez zmian).

## 3. Sterowanie

- Domyślnie **bezpośrednie przeciąganie**: dziura jedzie w stronę palca /
  kursora. Od v13 pozycja palca na ekranie jest przeliczana co klatkę
  (trzymany palec prowadzi dalej), nic się nie rusza przed pierwszym
  dotykiem, puszczenie palca zatrzymuje dziurę.
- Opcjonalnie pływający joystick (Ustawienia) i WASD/strzałki.
- **Portale (FTUE-2):** pauza klawiszem **Escape, P lub Spacją** (Poki:
  „ESC albo spacja”; P, bo portal może używać Escape do wyjścia z pełnego
  ekranu). Kursor wychodzący poza okno gry zatrzymuje dziurę (bez jazdy
  „samej” do ostatniego punktu), a utrata fokusu (klik na stronie portalu,
  przełączenie okna) zwalnia trzymane klawisze i pauzuje rundę. Strzałki,
  spacja i kółko myszy nigdy nie przewijają strony portalu; pisanie w polu
  tekstowym nie steruje. Bez własnego przycisku pełnego ekranu — pełny
  ekran daje portal (CrazyGames go zakazuje w grze), gra tylko poprawnie
  się do niego dopasowuje.

## 4. Kampania (Dzielnice) — v15 „Wyzwanie”

- **12 dzielnic, 240 misji** (v22: bez samouczka M00). Rozdział I (6 × 10:
  Plac Neonów, Park Impulsów, Port Syntez, Galeria Glitch, Dachy Prądu,
  Rdzeń Miasta, M01–M60) i Rozdział II „Głęboki Glitch” (6 × 30: Tunele
  Metra, Nocny Bazar, Fabryka Pikseli, Zatoka Hologramów, Wiszące Ogrody,
  Chmura Danych, M61–M240). Numeracja na mapie według kolejności,
  wewnętrzne id zostają dla zapisów. Ostatnia misja dzielnicy (boss —
  budowla z neonową tabliczką z nazwą) otwiera kolejną; M24 otwiera
  Rozdział II, finał M240 „Serwer Główny”. Rozdział I to opisy
  w `MISSION_SPECS`, Rozdział II — zwięzłe wiersze `CHAPTER_II`
  (`[nazwa, cele, zwroty akcji, trudność]`, parser `chapterTwoSpecs()`),
  wszystko kompiluje `compileMission()`.
- Rozgrywka na miesiąc: 240 misji × 3 gwiazdki, misje bardzo trudne
  wymagające kilku podejść (bez limitu prób), Arena i Wyzwanie dnia obok.
- **Trudność 1–5** (`DIFFICULTY`): ŁATWA, ŚREDNIA, TRUDNA, BARDZO TRUDNA,
  EKSTREMALNA — chip z paskami na każdej karcie i wierszu misji. Limit
  czasu = mediana czasu bota-eksperta (`MISSION_BOT_TIME`, mierzona
  `qa/calibrate.mjs`, 10 przejść bez limitu) × 2,1 / 1,75 / 1,5 / 1,24 /
  1,12 (+20…3 s), ale nie mniej niż wolniejsze przejście eksperta (p90, do 1,6–1,2 × mediana); zapasowe obiekty też maleją (40% → 15%). Krzywa
  piłokształtna w dzielnicy, boss zwykle najtrudniejszy. Zmierzone
  (`qa/difficulty.mjs`, bot „casual”: widzi ekran, reaguje co 0,4 s,
  celuje z rozrzutem ±12°): **100% → 99% → 89% → 60% → 53%** przejść za
  pierwszym razem od ŁATWEJ do EKSTREMALNEJ; ekspert ~90% ogółem.
- **Zwroty akcji (twisty)** — chip + wskazówka w odprawie, NELA tłumaczy
  zwrot przy jego pierwszym pojawieniu się w dzielnicy:
  - **Łowcy** (`hunters`): więksi rywale gonią gracza seriami (3 s pościgu,
    2,4 s odpoczynku, 6 s po trafieniu); przerośnięci uciekają.
  - **Złodziej** (`racer`): złoty rywal zbiera te same cele; rusza, gdy
    gracz już może je jeść; jeśli zbierze tyle, ile cel misji — porażka
    „ZŁODZIEJ BYŁ SZYBSZY”. Można go pochłonąć (wraca na start).
  - **Ciemność** (`dark`): widać tylko krąg wokół wiru, minimapa pokazuje
    same dziury, strzałka prowadzi do celu (albo do jedzenia, gdy cel
    jest jeszcze za duży).
  - **Strefy glitcha** (`glitch`): różowe, dryfujące pola; dotknięcie
    zabiera 25% wzrostu i combo.
  - **Kruchy wir** (`fragile`): jedno zderzenie (rywal, strefa) =
    porażka „WIR ROZBITY”.
  - **Złote bajty** (cel `runner`): uciekają przed wirem (i Złodziejem)
    z ~78% jego prędkości; łapie się je przy ścianie.
- **Trzy gwiazdki** zamiast medalu: ★ ukończ, ★★ szybki czas, ★★★ czas
  eksperta albo specjalne wyzwanie misji (np. bez zderzenia). Każda
  gwiazdka liczy się z najlepszej próby; co 15 gwiazdek **Skrzynia
  gwiazd** (120 monet, 3 pryzmaty, wzmocnienie). Trzy gwiazdki = tytuł
  „PERFEKCYJNIE!”.
- **Wzmocnienia** (`MISSION_BOOSTERS`, po M04 + po jednym w prezencie):
  Zegar +15 s (60), Turbo start od T2 (70), **Sprint +15% prędkości**
  (70, v18), Magnes na całą misję (40), Tarcza na 2 zderzenia (70 monet;
  chroni też kruchy wir). Wybiera się je w odprawie (najpierw z zapasu,
  resztę za monety — koszt widać na GRAJ, nic nie znika jednym
  dotknięciem). Po 3 porażkach z rzędu NELA pożycza jeden Zegar (raz na
  misję).
- **Po porażce (v18)**: główny przycisk proponuje wzmocnienie, które
  odpowiada na przyczynę — czas minął blisko celu → Zegar, daleko → Turbo
  start, Złodziej → Sprint, rozbity wir → Tarcza („SPRÓBUJ Z: ZEGAR · +15 s
  · 60 ◇” albo „masz ×1”); otwiera odprawę z wybranym wzmocnieniem, cena na
  GRAJ, POWTÓRZ = bez wzmocnienia. NELA dopowiada, co da wzmocnienie.
- **Brak monet w odprawie (v18)**: „▶ Zegar za reklamę” — jedno z wybranych
  wzmocnień za reklamę (3 dziennie), trafia do zapasu i zostaje wybrane.
  v22: obok „Zegar za 4 ◆” — to samo za pryzmaty (bez reklamy; drożej niż
  w Pakiecie wzmocnień, więc monety zostają codzienną drogą).
- **Balans wzmocnień (v18, `qa/v18.mjs 3`, bot „casual”, 24 misje TRUDNE
  i EKSTREMALNE × 3 próby)**: bez wzmocnień 59% przejść, Zegar 79% (+20),
  Sprint 76% (+17), Magnes 73% (+14), Turbo start 71% (+12). Sprint przy
  +25% za 50 monet był najmocniejszy i najtańszy (+29), więc ma +15% za
  70; Turbo start dawał najmniej przy najwyższej cenie, więc 80 → 70;
  Magnes 50 → 40. Żadne nie robi z EKSTREMALNEJ pewniaka (≤ 77%). Szum
  pomiaru przy ~50 próbach to ±7 pkt.
- **Start na dotknięcie (v15)**: po GRAJ misja otwiera się zamrożona
  z kartą startu (dzielnica, trudność, NELA, cele, zwroty akcji
  z wyjaśnieniem, wzmocnienia, czasy gwiazdek) — zegar rusza dopiero po
  dotknięciu; mały przycisk pod START oddaje wzmocnienia:
  „Zmień wzmocnienia” wraca do odprawy z dotychczasowym wyborem, a zanim
  wzmocnienia się odblokują (przed ukończeniem M04) — „Wróć do mapy”.
- Najwyżej 3–10 misji EKSTREMALNYCH na dzielnicę Rozdziału II
  (`EXTREME_CAP`; boss i ostatnie misje), reszta oznaczonych 5 staje się
  BARDZO TRUDNA. Tarcza jest wyłączona w misjach bez zagrożeń.
- **Odprawa**: każda misja startuje przez arkusz odprawy
  (`openMissionBriefing()`): z Dzielnic, z kafla na Mieście, z wyniku
  („GRAJ Mxx”, „SPRÓBUJ PONOWNIE”, „POWTÓRZ”) i z pauzy („zacznij od
  nowa” = nowa próba). Tam: cele, zwroty, czas, gwiazdki, nagroda,
  wzmocnienia (przy braku monet: jedno za reklamę albo za 4 pryzmaty).
- **Bramy impulsu i portale (v20) to pomocnicy, nigdy cel misji.**
  Świecąca brama na jezdni daje wirowi impuls (+50% prędkości na 2,5 s),
  potem się ładuje (5 s, łuk pokazuje ładowanie). Portale są połączone
  parą i działają w obie strony (skrót na drugą stronę mapy). Misje
  z nimi mają cele z jedzeniem; kto z nich korzysta, szybciej zdobywa
  gwiazdki. Mostek ma własną mechanikę; rewanż „+20 s” od 40% postępu za
  reklamę **albo 8 pryzmatów**.
- W misji: pole celu rozbłyska na starcie, „CEL ZALICZONY”, strzałka na
  krawędzi ekranu do najbliższego celu; skupiska combo nigdy tuż przy
  starcie; nic nie chowa się w rogu poza zasięgiem wiru.
- **Misje nigdy nie napełniają Core City** — tylko Arena i Wyzwanie dnia.

### Pierwsza misja (v22)
Samouczka M00 już nie ma (grę poznaje się w pierwszej rundzie Areny —
§1a). Kampania zaczyna się od M01 „Pierwszy apetyt”, w której NELA się
przedstawia; numeracja misji (M01…M240) i zapisy bez zmian.

## 5. Meta i ekonomia

- **Monety za ukończoną rundę:** 15 + 1,6·√wynik + bonus miejsca (25/15/8);
  pierwsze 5 ukończonych rund ×1,5; reklama ×2 (nie na wyniku pierwszej
  Areny w historii zapisu — FTUE-1). Co 3. ukończona runda +2 pryzmaty.
- **Runda przerwana przez gracza (pauza → OPUŚĆ RUNDĘ) — R1, decyzja
  właścicielki 24.10.2026:** tylko częściowe monety i XP za faktyczny wynik
  — 1,6·√wynik monet (pierwsze 5 ukończonych rund ×1,5) i część XP za wynik
  (XP_√·√wynik; awans poziomu z tego XP daje zwykłą nagrodę poziomu). Bez
  stałej części za rundę (15 monet, bazowe XP), bez bonusu miejsca, Core
  City, pryzmatów co 3. rundę, misji dnia, premii, rekordu i serii Wyzwania
  dnia, rekordu Areny i bez zaliczenia rundy (licznik rund = ukończone
  rundy: trudność, rundy nowicjusza, odblokowanie Warsztatu po 2 i Wyzwań
  oraz kafelka kampanii po 3 rundach; licznik ze starszych zapisów zostaje,
  jaki jest). Runda przerwana przy wyniku 0 (nic nie zjedzone) nie daje
  niczego. Pełne nagrody i postęp — tylko za rundę dograną do końca czasu.
- **Core City (LVL):** ukończona runda Areny +10% (+2% podium, +3% zwycięstwo, +2%
  rekord), Wyzwanie dnia +20% (+10% rekord); LVL 1–2 ×1,6. Nadwyżka
  przechodzi dalej. Nagrody LVL2–6: Smuga „Impuls”, Wir „Kryształ”, Efekt
  „Pikselowy Wybuch”, Finisz „Fala”, zestaw „Pryzmat”; potem 100 monet + 10
  pryzmatów.
- **Poziom gracza (XP):** każda runda/misja; nagroda w monetach,
  co 3. poziom pryzmaty — pokazywana na karcie XP wyniku (bez osobnej
  planszy pełnoekranowej; te zostają dla nowych funkcji i kosmetyków).
- **Warsztat (ceny v13 ×~3,3, bo 20-rundowa kariera kończyła się z 8 000
  niewydanych monet):** Wiry Cyjan 100, Gorący Róż 220, Toksyczna Zieleń 450, Ultrafiolet 800,
  Neonowe Złoto 1300, Biała Plazma 2000 monet (PX02 D+: sam wygląd, bez
  bonusu w rundzie), Smuga „Iskra” 500 monet, „Żar” 15 i
  „Zawirowanie” 30 pryzmatów; v22: Efekty „Neonowa Róża” 20 i „Fioletowa
  Szczelina” 35, Finisze „Złoty Szczyt” 25 i „Zielona Burza” 40 pryzmatów
  (wcześniej w tych kategoriach nie było nic do kupienia). Dodatków na
  rundę Areny (Tarcza 45, Magnes 25, Turbo start 70) nie ma od PX02 D+.
- **Warsztat (v14):** dotknięcie posiadanego przedmiotu od razu go
  zakłada; przedmiot na sprzedaż pojawia się na podglądzie, a arkusz
  pyta „KUP I ZAŁÓŻ · cena” (zamknięcie = powrót do założonego, nic nie
  wydane); przedmiot z nagrody mówi, skąd go zdobyć (`onCosmeticPick()`).
- **Bez limitu grania (v22):** energia z v15 (5 punktów, +1 co 20 min,
  koszt rundy/próby) usunięta w całości — chip, arkusz „BRAK ENERGII”,
  odnawianie, reklama „+1 energia”, IAP „Godzina bez limitu”; zapisy
  tracą pole przy migracji v12 → v13. Gra nie każe czekać.
- **Pryzmaty po v22** (rzadka waluta, oba tryby): źródła — Arena (co 3.
  runda +2, rekord Wyzwania dnia +3), Dzielnice (Skrzynia gwiazd +3),
  awanse poziomu, kalendarz, skrzynia, reklama, sklep. Wydatki — rzadkie
  Smugi, Efekty i Finisze (20–40 ◆), wzmocnienie misji przy braku monet
  (4 ◆), +20 s w misji (8 ◆). Same kosmetyki i skróty, nigdy czas gry.
- **Kod kopii zapasowej:** „Postęp wczytany” tylko wtedy, gdy wczytany
  postęp trafił do zapisu; gdy przeglądarka go nie zapisze (brak miejsca,
  gra otwarta w innej karcie), gra mówi „Kopia wczytana bez zapisu”.
- **Retencja:** 7-dniowy kalendarz logowania (FTUE-1: nowy gracz nie widzi
  go przy pierwszej wizycie w Mieście po pierwszej rozgrywce, tylko przy
  drugiej albo po ponownym uruchomieniu; nagrody i seria bez zmian),
  darmowa skrzynia co 4 h,
  Misja dnia + Wyzwanie dnia (ta sama mapa dla wszystkich, seria dni),
  wyzwania znajomych (link z ziarnem i wynikiem, karta do udostępnienia).
- **Monetyzacja (`Monetization`):** tylko reklamy z nagrodą (×2 monety,
  +20 s misji, skrzynia, ×2 logowanie, pryzmaty, wzmocnienie misji przy
  braku monet; PX02 D+ usunęło darmowe Turbo do Areny) i
  reklamy między rundami co 3. powtórka (nie w rundach nowicjusza, min.
  2,5 min odstępu). Sklep IAP pojawia się tylko z natywnym opakowaniem;
  w przeglądarce działa oznaczony dostawca demo. Sklep: Pakiet Startowy
  (9,99 zł: 1500 monet, 60 pryzmatów, **3× każde wzmocnienie**, Smuga),
  **Pakiet wzmocnień** (7,99 zł: 5× każde z pięciu, v18), pryzmaty 4,99 /
  19,99 / 44,99 zł, Bez reklam 14,99 zł.
  Zasady: każdy pakiet mówi dokładnie, co zawiera (bez losowych nagród
  za pieniądze), nic nie kupuje się jednym dotknięciem.
- **Przegląd ekonomii v18 (wnioski):** monety szybko tracą wartość
  (bot-ekspert ma po 20 rundach ~9 700 niewydanych monet, cały Warsztat
  to ~5 400) — dlatego zużywalne wzmocnienia misji są głównym, stałym
  ujściem monet, a pryzmaty/sklep dostały drogę do wzmocnień (pakiety).
  Wzmocnienia płaci się monetami, nie pryzmatami, celowo: kampania ma
  pozostać do przejścia bez płacenia (sklep tylko przyspiesza).
- **Prywatność:** zapis tylko lokalny; statystyki wyłącznie po zgodzie.
  Pasek zgody pojawia się po pierwszej rundzie (na ekranie powitalnym zasłaniał
  przycisk startu); do decyzji nic nie jest wysyłane.

## 5a. Dźwięk

Cały dźwięk jest syntezowany (WebAudio, `SoundEngine`) — zero plików audio.

**Muzyka (v16 „Brzmienie”)** — 15 utworów zapisanych jako dane w
`MUSIC_TRACKS` (tonacja, skala, tempo, perkusja, bas, sekcje akordów
z melodią, forma):

- **Miasto i menu**: 3 spokojne, lo-fi utwory (Neonowy Świt, Nocna Linia,
  Deszcz na Szybie), zmieniają się co pełne przejście (~50 s).
- **Każda dzielnica ma swój motyw** (12): Wir Neonów (Plac), Zielony Impuls
  (Park), Fala Syntez (Port), Glitch w Galerii, Wysokie Napięcie (Dachy),
  Rdzeń Miasta, Ostatni Kurs (Tunele Metra), Targ o Północy (Nocny Bazar),
  Ośmiobitowa Taśma (Fabryka Pikseli), Mgła nad Zatoką (Zatoka
  Hologramów), Pnącza (Wiszące Ogrody), Przesył Danych (Chmura Danych).
  Każdy ma inną progresję akordów, tempo i brzmienie. Misja gra motyw
  swojej dzielnicy (pod kartą startu cicho, perkusja wchodzi na START);
  boss dzielnicy uderza dropem w chwili START.
- **Arena**: każda runda to inny utwór (tasowanie, bez powtórki dwóch
  ostatnich), a po pełnym przejściu (~45–60 s) gra przechodzi do
  następnego — runda 2:00 to 2–3 utwory. Wyzwanie dnia i wyzwanie od
  znajomego: jeden utwór na ziarno, ten sam dla wszystkich.
- **Wewnątrz utworu**: sekcje A (groove) · B (refren z melodią) ·
  C (mostek, inne akordy) · D (drop), przejścia perkusji na końcu sekcji,
  talerz na wejściu, co drugie przejście inny arpeggiator i bas.
  Warstwy rosną z napięciem: 0 tło/wynik · 1 runda · 2 końcówka (szybciej,
  szesnastki hi-hatu, jaśniej; **jeden takt narastania i skok do dropu**,
  potem utwór zostaje i krąży refren → drop, bez zmiany do końca rundy;
  WIELKI FINISZ zrzuca drop od razu, bez drugiego narastania) ·
  3 SZAŁ (melodia w oktawach, jeszcze szybciej). Drop to refren z melodią
  zdublowaną oktawę niżej. Pady „oddychają” ze stopą,
  melodie i pady mają echo i pogłos.
- **Pauza** — muzyka schodzi „pod wodę” (filtr dolnoprzepustowy); arkusz
  pauzy pokazuje „TERAZ GRA” i przycisk **NASTĘPNY**. W rundzie nowy utwór
  przedstawia się małą plakietką „TERAZ GRA” pod paskiem czasu.
- **Szafa grająca** (Profil): lista utworów (tempo opisane słowami);
  dotknięcie odtwarza pełną aranżację od refrenu i ustawia ulubiony na
  stałe (Miasto, rundy, misje), „Mieszanka” wraca do zmian. Motywy Rozdziału I
  i utwory menu są od początku; motywy Rozdziału II odblokowuje dojście do
  ich dzielnicy (odprawa bossa mówi „nowa dzielnica i jej utwór”, po
  wygranej plansza „NOWY UTWÓR”, zablokowany wiersz podaje misję).
  Zapis: `save.settings.musicPick` (`'auto'` albo id utworu).

**Efekty**: zjadanie wspina się po skali **bieżącego utworu** (combo gra
razem z muzyką), fanfary, awans rozmiaru, gwiazdki itd. są transponowane
do tonacji utworu (durowe utwory mapują fanfary C-dur na swoją tonikę,
molowe — a-moll). Osobne sygnały: start rundy/misji, „za duże” (głuche
stuknięcie), objęcie i utrata prowadzenia, tarcza, portal, WIELKI FINISZ
(narastanie + uderzenie), karty ewolucji i wybór karty, większy rywal
w pobliżu (bicie serca, najwyżej co 4 s).

Na iPhonie gra prosi o sesję audio „playback”, więc gra także przy włączonym przełączniku
„cicho” (i przy okazji wycisza muzykę z innych aplikacji); każde tapnięcie
wznawia dźwięk, jeśli iOS go przerwał. Muzykę i efekty wyłącza się osobno
w Profilu. Tam też jest „Test dźwięku” (krótka melodia + stan silnika i tryb
iOS). Gdy nie ma `navigator.audioSession` (Chrome na iOS, starsze iOS),
gra odtwarza w tle ciche, zapętlone `<audio>`, które przełącza stronę w tryb
odtwarzania mediów — inaczej przełącznik „cicho” wycisza Web Audio.

## 5b. Ekrany i przepływ (v14 „Czytelność”)

Zasada: na każdym ekranie jedna oczywista akcja, widoczna bez przewijania
(sprawdza `qa/flow.mjs` na 402×874 i 375×667).

- **Start (pierwsze uruchomienie, v17):** logo, jeden przycisk GRAJ,
  „Pierwsza misja · ok. 1 min”, a pod logo **prawdziwa mini-runda**: wir
  sam jeździ po neonowym mieście, wciąga mniejsze obiekty (+punkty), rośnie
  T1 → T4 („ROŚNIESZ · T2”), mija za duże, aż do nich dorośnie, zjada
  mniejszego RYWALA (+250) i zaczyna od nowa co ~12 s. Licznik WYNIK i
  rozmiar jak w rundzie. Bez nawigacji.
- **Miasto (v17.1 — jeden bohater, jeden haczyk):** nagłówek (pierścień
  poziomu gracza z XP, nazwa, monety, pryzmaty, ustawienia) → **karta Core
  City** zajmująca wolną wysokość: LVL, w niebie hasło „Każda runda buduje
  Twoje miasto” i konkret „+16% za rundę · nagroda za 7 rund”, nad dźwigiem
  złoty znacznik „NOWY BUDYNEK”, kontury kolejnych budynków (miasto, które
  nadejdzie), w stopce następna nagroda, procent i pasek; dotknięcie =
  wszystkie nagrody → GRAJ w treści ekranu, nigdy przyklejony („runda 2:00
  · +16% budowy miasta”) → kafle **Kampania** (następna misja, pełna nazwa
  w dwóch liniach → odprawa) i **Wyzwanie dnia** → skrzynia. Bez pustych
  pasów i bez przewijania (375×667). Żywa scena Areny z v17 zeszła z Miasta
  (dwa duże, ruchome panele to był nieporządek i zabierały miastu rolę
  haczyka); mini-runda została na ekranie powitalnym.
- **Dzielnice:** poziomy pasek dzielnic → nazwa i postęp → karta
  „NASTĘPNA MISJA” z GRAJ → historia dzielnicy (NELA) → lista misji
  (kod, nazwa, pierwszy cel z ikoną, gwiazdka medalu). Dotknięcie misji =
  odprawa; zablokowana mówi, którą misję najpierw ukończyć.
- **Wynik misji:** wynik / czas / medal, NELA, nagroda, XP, karta następnej
  misji, „GRAJ Mxx”, POWTÓRZ / DZIELNICE, „Wróć do Miasta”.
- **Wynik Areny:** wynik, rozmiar i miejsce, haczyk (rekord / wyzwanie),
  jedna karta NAGRODY (monety, XP, Core City), tabela, pasek akcji.
- Usunięte jako szum: napisy „VECTOR HOLE” nad tytułami zakładek,
  przyciski POWRÓT/DO MIASTA tam, gdzie jest dolna nawigacja.

## 5b2. Duże ekrany (v21 „Komputer”)
- Gra powstała od telefonu; na komputerze nie jest już małym telefonem na
  środku monitora.
- **W rundzie** obraz skaluje się do ekranu: komputer widzi mniej więcej
  tyle miasta co telefon (skala √(pole ekranu / 500 000), od 1 do 2,2), więc
  wir i obiekty są duże, a gracz na monitorze nie widzi dalej niż na
  telefonie. Telefony bez zmian.
- **Układ poziomy** (FTUE-2: każdy ekran w poziomie, szerszy niż 1,25×
  wysokość i od 560 px — wcześniej tylko od 960 px, więc telefon obrócony
  poziomo i małe ramki portali dostawały ucięty układ pionowy):
  nawigacja jako pasek po lewej, każdy ekran w dwóch kolumnach —
  Miasto: Core City | GRAJ, kafle i skrzynia; Dzielnice: wszystkie 12
  dzielnic naraz | następna misja i lista; Warsztat: duży podgląd |
  wiry w 2 kolumnach; Wyzwania: mapa dnia | ZAGRAJ, seria, misja dnia;
  wyniki: wynik i nagrody | ranking i przyciski. Pierwszy ekran to szeroka
  scena z żywym demem. Samouczek na komputerze mówi o myszy, nie o palcu.
- **Wariant kompaktowy** (FTUE-2, ekran w poziomie niższy niż 620 px:
  telefon obrócony, Poki 640×360 / 836×470 / 1031×580, CrazyGames
  800×450): węższy pasek nawigacji, niższe nagłówki; pierwszy ekran = demo
  po lewej, logo i GRAJ po prawej; Ewolucja — trzy karty obok siebie; w
  rundzie ranking pokazuje lidera i gracza, mniejsza mapka, NELA i
  podpowiedzi przy krawędziach, baner wyżej i mniejszy (nie zasłania wiru).
  Okno, które mimo to się nie mieści, przewija się w środku, a jego główny
  przycisk zostaje na ekranie.
- Menu, arkusze i HUD rosną z ekranem (do 1,6×), **nigdy nie maleją
  poniżej 1×** (FTUE-2: przy skali 0,75–0,94 etykiety 9 px miały 7–8 px);
  mapka w rogu rośnie razem z nimi. Telefony i tablety w pionie mają
  dotychczasowy układ. Zasięg widzenia i skala świata w rundzie bez zmian.
- **Długie okna** (FTUE-2, FTUE-2 FIX): DALEJ wyniku misji, akcje wyniku
  rundy (z „Wróć do Miasta”) i ZAGRAJ Wyzwania dnia zostają przy dolnej
  krawędzi, gdy treść się przewija; POWRÓT w Profilu to stopka pod
  przewijanymi ustawieniami; w odprawie i na karcie startu misji cele
  przewijają się nad GRAJ / START (przycisk nigdy nie leży na tekście, w
  poziomie opowieść i cele obok siebie); tekst okien informacyjnych
  przewija się nad przyciskami. Panel HUD lub mapka, pod którą jest wir,
  przygasa. Pasek zgody rezerwuje swoje miejsce (nie zasłania GRAJ ani
  kafli).
- Pasek dzielnic (wąskie okna) przewija się kółkiem myszy, a ucięta
  krawędź się rozmywa.

## 5c. Języki, platformy i zapis (v19 „Premiera”)

- **Języki:** polski (źródłowy) i angielski. Gra wybiera język przeglądarki
  (polski dla `pl-*`, angielski dla pozostałych); Profil → Ustawienia →
  Język przełącza i zapamiętuje. Tłumaczenie to warstwa na wyjściu
  (`I18N_EN`), więc nowy polski tekst wymaga wpisu w słowniku (pilnuje
  `qa/v19.mjs`). Nazwy dzielnic, utworów i misji mają angielskie odpowiedniki
  (Plac Neonów → Neon Square, Wir Neonów → Neon Vortex…).
- ~~Energia per platforma~~ — v22: energii nie ma nigdzie (§5).
- **Zapis:** lokalnie w przeglądarce (jak dotąd) + na CrazyGames w module
  danych portalu (konto gracza, synchronizacja urządzeń; przy różnicy wygrywa
  zapis z większym postępem) + **kopia zapasowa** w Profilu: kod `VH1.…` do
  skopiowania i wczytania na innym urządzeniu. Gra prosi przeglądarkę
  o trwałe przechowywanie danych.
- **Ochrona zapisu (PX01):** gra nigdy po cichu nie nadpisuje zapisu, którego
  nie umie w pełni odczytać — ani przy wczytaniu, ani żadnym późniejszym
  autozapisem. Zapis z nowszej wersji gry („Zapis z nowszej wersji gry” →
  ODŚWIEŻ), uszkodzony („Zapis jest uszkodzony” → ZACZNIJ OD NOWA albo kod
  kopii) albo z częścią danych w złym formacie („Część zapisu jest
  uszkodzona” → NAPRAW ZAPIS) gra pokazuje z pamięci i nic nie zapisuje,
  dopóki gracz sam nie wybierze wyjścia; wtedy oryginał trafia pod klucz
  `vectorHoleSave_v1.rescue`. Migracja starszego zapisu zapisuje się dopiero
  po sprawdzeniu wyniku i po kopii oryginału pod `vectorHoleSave_v1.bak`.
  Gdy gra jest otwarta w dwóch kartach, karta ze starszym stanem przestaje
  zapisywać i prosi o odświeżenie („Gra jest otwarta w innej karcie”).
  Kopia w chmurze portalu, której ta wersja nie odczyta, zostaje nietknięta,
  a do chmury trafia tylko zapis, który udało się zapisać lokalnie. Gdy
  przeglądarka nie pozwala odczytać danych, gra mówi „Zapis nie działa” i nic
  nie zapisuje. Reset w Profilu zablokowanego zapisu wymaga udanej kopii
  `.rescue` — inaczej nic nie jest usuwane.

## 6. QA (boty)

`node qa/run-all.mjs` — przypadki brzegowe, funkcje v11, grafika v12,
**design v13** (`qa/design.mjs`: pierwsze sekundy, wyścig, sterowanie,
ścieżka nowicjusza, mapa dnia, podpowiedź za dużego obiektu,
teksty, układ na telefonach 402×874 / 402×740 / 375×667 i aplikacja
z ekranu głównego iPhone'a 13 Pro), **przepływ v14** (`qa/flow.mjs`: ekran
startu, Miasto bez przewijania i bez przyklejonych elementów, GRAJ następnej
misji w Dzielnicach bez przewijania, odprawa, podgląd następnej misji
w wyniku, dymki NELA, Warsztat: dotknij = załóż, zakup wymaga
potwierdzenia), kariera 20 rund Areny, 30 pierwszych misji,
**systemy v15** (`qa/v15.mjs`: 240 misji kompletnych i skalibrowanych,
start na dotknięcie, wzmocnienia, gwiazdki, skrzynie gwiazd,
przyczyny porażki, pożyczka NELA, migracja zapisu v11→v12, odprawa na
375×667) i **trudność v15** (`qa/difficulty.mjs`: każda z 240 misji
grana przez bota-eksperta i bota „casual” w prawdziwym limicie; krzywa
musi rosnąć, EKSTREMALNE ≤ 55% dla „casual”, każda misja wykonalna),
**dźwięk v16** (`qa/audio.mjs`: każdy z 15 utworów się kompiluje, każdy
takt melodii ma 16 kroków, każda dzielnica ma motyw; render offline przez
prawdziwy mikser — bez przesterów i ciszy, utwory rundy w paśmie 8 dB,
menu cichsze, warstwy rosną z napięciem, limit głosów; drop w końcówce,
rotacja Areny, Daily = jeden utwór na ziarno, boss od dropu, pauza „pod
wodą”, NASTĘPNY, plakietka TERAZ GRA, Szafa grająca z zablokowanymi
utworami, stres 60 zmian scen, runda bota z włączonym dźwiękiem),
**dwa tryby v22** (`qa/v22.mjs`: zero śladów energii w kodzie i DOM,
15 rund Areny / 6 Wyzwań dnia / 15 prób misji pod rząd przy 0 monet,
pierwsze uruchomienie = runda Areny z całym bestiariuszem, postęp kampanii
nie zmienia rundy Areny i odwrotnie, ta sama kolejność odblokowań przy obu
kolejnościach gry, każdy tryb sam opłaca swoje zakupy (boty), podpowiedzi
pierwszej rundy tylko przy wahaniu i po angielsku, migracja v12 → v13
i ponowne wczytanie, pryzmaty: wzmocnienie za 4 ◆, kosmetyki),
**druga runda FTUE-1** (`qa/ftue1.mjs`: wynik pierwszej Areny bez karty i
reklamy, powtórka prosto do 2. rundy, Warsztat/Wyzwania po animacji wyniku,
kafelek kampanii po 3. rundzie, kalendarz przy 2. wizycie w Mieście i po
ponownym uruchomieniu, zapisy po 1, 2, 3+ rundach, z ogłoszoną i
nieogłoszoną kampanią, po angielsku; na 390×844, 375×667, 844×390, 1280×720),
**opuszczona runda** (`qa/leave-run.mjs`: wejście i natychmiastowe wyjście
nie zmienia zapisu — także 5× pod rząd i po ponownym uruchomieniu;
runda przerwana po zjedzeniu jednego obiektu i po większym wyniku płaci
tylko częściowe monety i XP według formuł, bez Core City, premii, misji dnia
i zaliczenia rundy (R1); ukończona runda płaci pełne nagrody; istniejący
zapis, izolacja od kampanii, bramki po ukończonych rundach, Wyzwanie
dnia).
Wspólny bot kampanii (`CAMPAIGN_BOT` w `qa/lib.mjs`) omija strefy
glitcha, w ciemności widzi tylko krąg światła i idzie za strzałką,
odkleja się, gdy utknie (bram impulsu i portali nie używa celowo —
czasy są liczone bez nich). Czasy misji
kalibruje `node qa/calibrate.mjs 10 4` (wynik wklejany do
`MISSION_BOT_TIME`) — po każdej zmianie misji, krzywej wzrostu lub
zwrotów akcji. Bot „casual” (`ARENA_BOT`,
styl `casual`) widzi tylko ekran, reaguje co ~0,4 s i celuje w najbliższy
kąsek — to nim mierzymy decyzje projektowe.

Układ: aplikacja ma wysokość `100dvh` — na iPhonie w Safari `100vh` nie
uwzględnia paska narzędzi i chowało pod nim dolną nawigację oraz przycisk
resetu profilu. W aplikacji z ekranu głównego pasek statusu jest czarny
(`black`), bo przy przezroczystym WebKit na iPhone'ach z notchem zaniżał
wysokość widoku (czarny pas, ucięta minimapa). Chromium w testach nie odtwarza paska Safari, więc test
sprawdza też, że reguła `100dvh` jest w arkuszu.

Progi wydajności w `qa/` mierzą renderowanie programowe (SwiftShader);
czas klatki zależy od maszyny — porównuj z bazą na tej samej maszynie.

## 6a. Panel testowy (v23, tylko dla twórców)
Nie jest częścią gry dla gracza: bez kodu dewelopera nie ma go w DOM.
Otwieranie: Profil → 7 szybkich stuknięć w „ID gościa” (albo `?dev`
w adresie) → kod → boczny przycisk DEV. Każda akcja działa tylko
w **trybie testowym** — osobny zapis; prawdziwy postęp nie jest ruszany
i wraca po „ZAKOŃCZ TESTY”. Panel nie zmienia balansu ani zasad: używa
funkcji gry, a jedyne haki w rdzeniu są nieaktywne poza trybem testowym.
Szczegóły i zakres: `docs/CHANGELOG.md` (v23), testy `qa/dev-panel.mjs`.

## 7. Świadomie niezbudowane / decyzje dla właściciela

- Brak backendu: rankingi, zapis w chmurze i konta są lokalne.
- Brak PWA/service workera i `og:image` (decyzja właścicielki; zasada trzech
  plików uchylona 18.10.2026 — przeszkodą nie są już pliki, tylko własny
  mechanizm aktualizacji service workera).
- Pacer to ukryte dopasowanie trudności (standard w grach casual); ekspert
  grający jak bot „greedy” nadal wygrywa wysoko — to celowe.
- Kamera zatrzymuje się na krawędzi świata, więc przy brzegu dziura może
  wjechać pod panel wyników lub minimapę — od FTUE-2 FIX ten panel /
  mapka przygasa, dopóki wir jest pod nim.
- „Narożny azyl”: środek dziury jest trzymany o promień od krawędzi, więc
  mały rywal w rogu bywa poza zasięgiem dużej dziury.
- Linki wyzwań wysłane z v12 otwierają w v13 inną mapę (ścieżki energii i
  uczty zużywają dodatkowe losowania z ziarna). Wyzwania i Wyzwanie dnia
  używają stałego „par” pacera (bez historii gracza), więc są porównywalne.
- `CONFIG.legal` (wydawca, kontakt) do uzupełnienia przed komercyjną
  premierą.
- Pliki w `design/` to oryginalne makiety (paleta, układ ekranów, katalog
  obiektów, plansze finałowe). Paleta z `design/reference/asset_bible.svg`
  obowiązuje; układy ekranów od tamtej pory ewoluowały (v12/v13).
- **v22 — do obserwacji po premierze:** progi odblokowań (Warsztat po
  2 rundach / M02, Wyzwania po 3 rundach) i czasy podpowiedzi pierwszej
  rundy (`CONFIG.unlockGates`, `CONFIG.coach`) to propozycja — warto je
  dostroić po danych D1/D7 (`coach_hint`, `coach_learned`, `booster_prisms`).
  Rozdział II używa malarzy podłóg z Rozdziału I w nowych kolorach
  (`DISTRICT_FLOOR`), nie osobnej grafiki dzielnic. Bot „casual” jest
  przybliżeniem człowieka — prawdziwe testy z graczami mogą przesunąć
  krzywą (wystarczy zmienić `DIFFICULTY.timeFactor`).
