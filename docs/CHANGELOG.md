# Vector Hole — historia wersji

Zwięzła historia. Aktualny opis gry: `docs/GAME_DESIGN.md`.
Starsze, szczegółowe plany wersji (v2–v12) zostały usunięte w v13 —
są w historii gita (`git log -- docs/`).

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
