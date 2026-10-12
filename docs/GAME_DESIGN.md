# Vector Hole — jak działa gra (stan v15)

Jedyny aktualny opis projektowy gry. Liczby pochodzą z `CONFIG` i tabel w
`game.js` — przy zmianie balansu poprawiaj **ten** plik razem z kodem.
Historia wersji: `docs/CHANGELOG.md`. Architektura kodu: `CLAUDE.md`.

## 1. Premisa i ton

> Glitch skaził Neonowe Miasto — latarnie, auta i wieżowce zamieniły się w
> zepsuty kod. Ty sterujesz żywym wirem, który pochłania skażone miasto,
> a NELA, sztuczna inteligencja miasta, przerabia tę energię i odbudowuje
> centrum (Core City).

- Pochłanianie = oczyszczanie; energia z rund Areny odbudowuje Core City,
  misje kampanii odzyskują dzielnice. NELA przedstawia się w wyniku
  samouczka i w M01.
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
  zajmowała ≤ 24% krótszego boku ekranu.

## 3. Sterowanie

- Domyślnie **bezpośrednie przeciąganie**: dziura jedzie w stronę palca /
  kursora. Od v13 pozycja palca na ekranie jest przeliczana co klatkę
  (trzymany palec prowadzi dalej), nic się nie rusza przed pierwszym
  dotykiem, puszczenie palca zatrzymuje dziurę.
- Opcjonalnie pływający joystick (Ustawienia) i WASD/strzałki.

## 4. Kampania (Dzielnice) — v15 „Wyzwanie”

- **12 dzielnic, 240 misji + samouczek M00.** Rozdział I (6 × 10:
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
  wymagające kilku podejść, energia ograniczająca porażki w sesji,
  Arena i Wyzwanie dnia obok.
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
  Zegar +15 s (60), Turbo start od T2 (80), Magnes na całą misję (50),
  Tarcza na 2 zderzenia (70 monet; chroni też kruchy wir). Wybiera się
  je w odprawie (najpierw z zapasu, resztę za monety — koszt widać na
  GRAJ, nic nie znika jednym dotknięciem). Po 3 porażkach z rzędu NELA
  pożycza jeden Zegar (raz na misję).
- **Start na dotknięcie (v15)**: po GRAJ misja otwiera się zamrożona
  z kartą startu (dzielnica, trudność, NELA, cele, zwroty akcji
  z wyjaśnieniem, wzmocnienia, czasy gwiazdek) — zegar rusza dopiero po
  dotknięciu; „Zmień wzmocnienia” wraca do odprawy i oddaje energię oraz
  wzmocnienia.
- Najwyżej 3–10 misji EKSTREMALNYCH na dzielnicę Rozdziału II
  (`EXTREME_CAP`; boss i ostatnie misje), reszta oznaczonych 5 staje się
  BARDZO TRUDNA. Tarcza jest wyłączona w misjach bez zagrożeń.
- **Odprawa**: każda misja startuje przez arkusz odprawy
  (`openMissionBriefing()`): z Dzielnic, z kafla na Mieście, z wyniku
  („GRAJ Mxx”, „SPRÓBUJ PONOWNIE”, „POWTÓRZ”) i z pauzy („zacznij od
  nowa” = nowa próba). Tam: cele, zwroty, czas, gwiazdki, nagroda,
  wzmocnienia, koszt energii.
- Portal, Mostek, Pas przelotu mają własne mechaniki; rewanż „+20 s” od
  40% postępu za reklamę **albo 8 pryzmatów**.
- W misji: pole celu rozbłyska na starcie, „CEL ZALICZONY”, strzałka na
  krawędzi ekranu do najbliższego celu; skupiska combo nigdy tuż przy
  starcie; nic nie chowa się w rogu poza zasięgiem wiru.
- **Misje nigdy nie napełniają Core City** — tylko Arena i Wyzwanie dnia.

### Samouczek M00 (v13)
Bez limitu czasu (zegar „∞”, brak porażki i brak reklamy), 7 fragmentów
wokół startu, 4 kroki (fragmenty → elementy uliczne → pojazd → mniejszy
rywal) pokazywane **po jednym** w karcie trenera na dole ekranu
(„KROK n Z 4”, ikona celu, tekst o sterowaniu w kroku 1). Zaliczenie
późniejszego kroku przed bieżącym daje tylko krótki komunikat. Po M00
przycisk „ZAGRAJ TERAZ” w świętowaniu odblokowania od razu startuje
pierwszą rundę Areny; nowicjusz (< 3 rundy) nie widzi ekranu wsparcia ani
kalendarza logowania przed pierwszą ukończoną rundą.

## 5. Meta i ekonomia

- **Monety za rundę:** 15 + 1,6·√wynik + bonus miejsca (25/15/8);
  pierwsze 5 rund ×1,5; reklama ×2. Co 3. runda +2 pryzmaty.
- **Core City (LVL):** runda Areny +10% (+2% podium, +3% zwycięstwo, +2%
  rekord), Wyzwanie dnia +20% (+10% rekord); LVL 1–2 ×1,6. Nadwyżka
  przechodzi dalej. Nagrody LVL2–6: Smuga „Impuls”, Wir „Kryształ”, Efekt
  „Pikselowy Wybuch”, Finisz „Fala”, zestaw „Pryzmat”; potem 100 monet + 10
  pryzmatów.
- **Poziom gracza (XP):** każda runda/misja; nagroda w monetach,
  co 3. poziom pryzmaty — pokazywana na karcie XP wyniku (bez osobnej
  planszy pełnoekranowej; te zostają dla nowych funkcji i kosmetyków).
- **Warsztat (ceny v13 ×~3,3, bo 20-rundowa kariera kończyła się z 8 000
  niewydanych monet):** Wiry Cyjan 100, Gorący Róż 220, Toksyczna Zieleń 450, Ultrafiolet 800,
  Neonowe Złoto 1300, Biała Plazma 2000 monet (każdy z bonusem
  rozgrywki, tylko Arena/Dzienne), Smuga „Iskra” 500 monet, „Żar” 15 i
  „Zawirowanie” 30 pryzmatów. Dodatki na rundę: Tarcza 45, Magnes 25,
  Turbo start 70 monet.
- **Warsztat (v14):** dotknięcie posiadanego przedmiotu od razu go
  zakłada; przedmiot na sprzedaż pojawia się na podglądzie, a arkusz
  pyta „KUP I ZAŁÓŻ · cena” (zamknięcie = powrót do założonego, nic nie
  wydane); przedmiot z nagrody mówi, skąd go zdobyć (`onCosmeticPick()`).
- **Energia (v15, limit sesji):** 5 punktów, +1 co 20 min. Każda runda
  Areny i każda próba misji kosztuje 1; **wygrana misja zwraca punkt**,
  więc energię zjadają porażki i rundy. Za darmo: samouczek, 3 pierwsze
  rundy, pierwsza próba Wyzwania dnia danego dnia. Przy 0 — arkusz „BRAK
  ENERGII” z licznikiem i dokupieniem przed odnowieniem: pełna energia za
  12 pryzmatów, +1 za reklamę (5 dziennie), w sklepie natywnym „Godzina
  bez limitu”; po dokupieniu gra od razu startuje to, co było wybrane.
  Chip energii (błyskawica, n/5 i licznik) w nagłówku Miasta i Dzielnic.
- **Retencja:** 7-dniowy kalendarz logowania, darmowa skrzynia co 4 h,
  Misja dnia + Wyzwanie dnia (ta sama mapa dla wszystkich, seria dni),
  wyzwania znajomych (link z ziarnem i wynikiem, karta do udostępnienia).
- **Monetyzacja (`Monetization`):** tylko reklamy z nagrodą (×2 monety,
  +20 s misji, skrzynia, ×2 logowanie, pryzmaty, darmowe Turbo, +1
  energia) i
  reklamy między rundami co 3. powtórka (nie w rundach nowicjusza, min.
  2,5 min odstępu). Sklep IAP pojawia się tylko z natywnym opakowaniem;
  w przeglądarce działa oznaczony dostawca demo.
- **Prywatność:** zapis tylko lokalny; statystyki wyłącznie po zgodzie.
  Pasek zgody pojawia się po samouczku (na ekranie powitalnym zasłaniał
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

## 6. QA (boty)

`node qa/run-all.mjs` — przypadki brzegowe, funkcje v11, grafika v12,
**design v13** (`qa/design.mjs`: pierwsze sekundy, wyścig, sterowanie,
samouczek, ścieżka nowicjusza, mapa dnia, podpowiedź za dużego obiektu,
teksty, układ na telefonach 402×874 / 402×740 / 375×667 i aplikacja
z ekranu głównego iPhone'a 13 Pro), **przepływ v14** (`qa/flow.mjs`: ekran
startu, Miasto bez przewijania i bez przyklejonych elementów, GRAJ następnej
misji w Dzielnicach bez przewijania, odprawa, podgląd następnej misji
w wyniku, dymki NELA, Warsztat: dotknij = załóż, zakup wymaga
potwierdzenia), kariera 20 rund Areny, 30 pierwszych misji,
**systemy v15** (`qa/v15.mjs`: 240 misji kompletnych i skalibrowanych,
start na dotknięcie, wzmocnienia, energia — wydanie, zwrot, odnowienie,
cofnięty zegar, dokupienie, darmowe gry —, gwiazdki, skrzynie gwiazd,
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
utworami, stres 60 zmian scen, runda bota z włączonym dźwiękiem).
Wspólny bot kampanii (`CAMPAIGN_BOT` w `qa/lib.mjs`) omija strefy
glitcha, w ciemności widzi tylko krąg światła i idzie za strzałką,
przekracza pasy przelotu w całości, odkleja się, gdy utknie. Czasy misji
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

## 7. Świadomie niezbudowane / decyzje dla właściciela

- Brak backendu: rankingi, zapis w chmurze i konta są lokalne.
- Brak PWA/service workera i `og:image` (wymagają dodatkowych plików —
  decyzja właściciela wobec zasady trzech plików).
- Pacer to ukryte dopasowanie trudności (standard w grach casual); ekspert
  grający jak bot „greedy” nadal wygrywa wysoko — to celowe.
- Kamera zatrzymuje się na krawędzi świata, więc przy brzegu dziura może
  wjechać pod panel wyników lub minimapę (znane, do rozważenia).
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
- **v15 — do decyzji właścicielki:** parametry energii (5 punktów, 20 min,
  12 pryzmatów za pełną, Arena kosztuje 1) to propozycja — warto je
  dostroić po pierwszych danych D1/D7 (`energy_empty`, `energy_refill`).
  Rozdział II używa malarzy podłóg z Rozdziału I w nowych kolorach
  (`DISTRICT_FLOOR`), nie osobnej grafiki dzielnic. Bot „casual” jest
  przybliżeniem człowieka — prawdziwe testy z graczami mogą przesunąć
  krzywą (wystarczy zmienić `DIFFICULTY.timeFactor`).
