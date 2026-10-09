# Vector Hole — jak działa gra (stan v13)

Jedyny aktualny opis projektowy gry. Liczby pochodzą z `CONFIG` i tabel w
`game.js` — przy zmianie balansu poprawiaj **ten** plik razem z kodem.
Historia wersji: `docs/CHANGELOG.md`. Architektura kodu: `CLAUDE.md`.

## 1. Premisa i ton

> Glitch skaził Neonowe Miasto — latarnie, auta i wieżowce zamieniły się w
> zepsuty kod. Ty sterujesz żywym wirem, który pochłania skażone miasto,
> a NELA, sztuczna inteligencja miasta, przerabia tę energię i odbudowuje
> centrum (Core City).

- Pochłanianie = oczyszczanie; energia z rund Areny odbudowuje Core City,
  misje kampanii odzyskują dzielnice. Premisa pojawia się na ekranie
  powitalnym, w wyniku samouczka (NELA przedstawia się) i w M01.
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

## 4. Kampania (Dzielnice)

- 6 dzielnic × 10 misji + samouczek M00 (61 wpisów, numeracja na mapie
  M01–M60 według kolejności, wewnętrzne id zostają dla zapisów). Misje są
  zapisane jako listy celów (`MISSION_SPECS` → `compileMission()`), czasy
  skalibrowane automatycznym przejściem. Ostatnia misja dzielnicy (boss —
  budowla do pochłonięcia) otwiera kolejną; finał daje Wir „Aurora Finału”.
- Portal (M13), Mostek (M19), Pas przelotu (M18) mają własne mechaniki.
- Misje mają medale (opcjonalne) i rewanż z reklamą „+20 s” od 40% postępu.
- Strzałka na krawędzi ekranu (v13) wskazuje najbliższy obiekt celu, gdy
  żadnego nie widać.
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
- **Retencja:** 7-dniowy kalendarz logowania, darmowa skrzynia co 4 h,
  Misja dnia + Wyzwanie dnia (ta sama mapa dla wszystkich, seria dni),
  wyzwania znajomych (link z ziarnem i wynikiem, karta do udostępnienia).
- **Monetyzacja (`Monetization`):** tylko reklamy z nagrodą (×2 monety,
  +20 s misji, skrzynia, ×2 logowanie, pryzmaty, darmowe Turbo) i
  reklamy między rundami co 3. powtórka (nie w rundach nowicjusza, min.
  2,5 min odstępu). Sklep IAP pojawia się tylko z natywnym opakowaniem;
  w przeglądarce działa oznaczony dostawca demo.
- **Prywatność:** zapis tylko lokalny; statystyki wyłącznie po zgodzie.
  Pasek zgody pojawia się po samouczku (na ekranie powitalnym zasłaniał
  przycisk startu); do decyzji nic nie jest wysyłane.

## 5a. Dźwięk

Cały dźwięk jest syntezowany (WebAudio, `SoundEngine`): efekty zjadania
rosnące z combo i muzyka zmieniająca tempo z napięciem rundy. Na iPhonie gra
prosi o sesję audio „playback”, więc gra także przy włączonym przełączniku
„cicho” (i przy okazji wycisza muzykę z innych aplikacji); każde tapnięcie
wznawia dźwięk, jeśli iOS go przerwał. Muzykę i efekty wyłącza się osobno
w Profilu. Tam też jest „Test dźwięku” (krótka melodia + stan silnika i tryb
iOS). Gdy nie ma `navigator.audioSession` (Chrome na iOS, starsze iOS),
gra odtwarza w tle ciche, zapętlone `<audio>`, które przełącza stronę w tryb
odtwarzania mediów — inaczej przełącznik „cicho” wycisza Web Audio.

## 6. QA (boty)

`node qa/run-all.mjs` — przypadki brzegowe, funkcje v11, grafika v12,
**design v13** (`qa/design.mjs`: pierwsze sekundy, wyścig, sterowanie,
samouczek, ścieżka nowicjusza, mapa dnia, podpowiedź za dużego obiektu,
teksty, układ na telefonach 402×874 / 402×740 / 375×667), kariera 20 rund Areny i 22 misje. Bot „casual” (`ARENA_BOT`,
styl `casual`) widzi tylko ekran, reaguje co ~0,4 s i celuje w najbliższy
kąsek — to nim mierzymy decyzje projektowe.

Układ: aplikacja ma wysokość `100dvh` — na iPhonie w Safari `100vh` nie
uwzględnia paska narzędzi i chowało pod nim dolną nawigację oraz przycisk
resetu profilu. Chromium w testach nie odtwarza paska Safari, więc test
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
