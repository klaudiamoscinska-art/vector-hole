# Vector Hole — historia wersji

Zwięzła historia. Aktualny opis gry: `docs/GAME_DESIGN.md`.
Starsze, szczegółowe plany wersji (v2–v12) zostały usunięte w v13 —
są w historii gita (`git log -- docs/`).

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
