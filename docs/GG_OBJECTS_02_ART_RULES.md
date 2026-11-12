# GLITCH GULP — wspólne reguły grafiki obiektów (GG-OBJECTS-02 / -03 / -04, „Premium Vector Objects”)

Obowiązują dla obiektów T1 i T2 (15 wyglądów, GG-OBJECTS-02), T3 i T4 (13 wyglądów, GG-OBJECTS-03, §8) oraz T5 i T6 z ich
landmarkami (16 wyglądów, GG-OBJECTS-04, §9) — to cała biblioteka obiektów gry (poza złotym bajtem). Kierunek zatwierdzony przez właścicielkę: **propozycja 3 — hybryda top-down + pełna sylwetka**.
Kod: `game.js`, blok `VA_*` (`vaKit()`, `VA_ART`, `vaIconSvg()`). Obrazy z gry: `design/objects2/` (T1/T2) i `design/objects3/`
(T3/T4: `sheet-hero-*`, `sheet-scale-*`, `sheet-family-*`, `sheet-icons-*`). Testy: `node qa/objects2.mjs`, `node qa/objects3.mjs`.

## 1. Jedna kamera

- Plansza jest widziana z góry (top-down) i to się nie zmienia. Obiekt jest małą figurą 2.5D oglądaną **z przodu i lekko z góry**.
- **Przód obiektu jest zwrócony ku dołowi ekranu.** Głębia ucieka zawsze w tę samą stronę: **w górę i w prawo**
  (`VA_DX = 0,36`, `VA_DY = −0,52` na jednostkę głębokości). Bryła pokazuje więc **górę, przód i prawą ścianę** — nigdy lewą,
  nigdy tył. Dotyczy każdego prostopadłościanu (`K.box()`), grubości tablic i ekranów, siedziska ławki, karty klucza.
- Żadnego losowego obracania. Sprite ma jedną orientację; bezczynny obiekt tylko lekko unosi się i „oddycha” (jak dotąd).
  Kołysanie fragmentu o ±20° zostało usunięte — jedyny wyjątek od stałej orientacji, jaki istniał.
- To nie jest izometria: przednie ściany są prostokątami w osi ekranu, bez zbiegu perspektywy.

## 2. Jedno światło

- Światło pada **z lewej góry**, jak na podłożu A2.1.
- Góra bryły jest najjaśniejsza, przód niesie kolor klasy, **prawa ściana schodzi w fiolet**.
- Cień kontaktowy leży pod podstawą, przesunięty odrobinę w prawo i w dół. Pod obiektem T2 jest jeszcze cienki pierścień
  „podstawki” w kolorze klasy; T1 (fragment, kapsuła) mają tylko cień i delikatną poświatę — są za małe na pierścień.
- Krawędź góra/przód dostaje cienką jasną kreskę, krawędź przód/bok — cienką ciemną.

## 3. Jedna paleta i materiały

| Rola | Kolor | Uwagi |
|---|---|---|
| Kolor klasy (`col`) | T1 `#50F0FA` cyjan, T2 `#FF54AD` róż | przychodzi z gry (`SIZE_TIER_COLORS`, `TIERS[*].color`) — to on mówi, co wir może już zjeść; zawsze dominuje |
| Akcent | przeciwny neon: róż na T1, cyjan na T2 | podłokietniki, zatrzaski, szewrony, ekrany, liście, opaska emitera, pięta fragmentu |
| Odcień cienia | `#6A4CF0` (fiolet), najciemniej `#2A1C7A` | ściany boczne i dolne partie; kolor klasy „zjeżdża” w fiolet, nie w czerń |
| Ciemny materiał | grafit-granat `#0E1830` → `#5A6CA6` (4 stopnie) | stopy, szyjki, kołnierze, podstawy |
| Ekran wyłączony | `#0A1432` (z `#14235A` od światła) | kiosk, znacznik, moduł, klucz |
| Kontur | `#071024` | jeden kontur wokół sylwetki bryły, cienkie kontury części |
| Światło | biel, tylko jako połysk i krawędź | nigdy jako wypełnienie dużej płaszczyzny |

- Zero nowych barw: tylko paleta gry (`--nc-*`) i jej odcienie. Stare nasycone neony (`#00f3ff`, `#ff007f`…) pozostają regresją.
- Poświaty oszczędnie: tylko wokół elementów, które świecą (klosz latarni, piksele ekranu, szewrony, opaska emitera, klucz, liście)
  i wokół kryształów. Liczone raz, przy malowaniu sprite’a — nigdy w klatce.
- Kolor inny niż cyjan/róż (Złoty Rdzeń rysowany grafiką fragmentu, podglądy w kolorze skórki) dostaje akcent z własnej barwy,
  przesunięty w róż — sylwetka i światło zostają te same.

## 4. Pełna sylwetka

Obiekt pokazuje to, po czym się go rozpoznaje, w całości — nie rzut samego dachu:

| Obiekt | Co musi być widać |
|---|---|
| Fragment | pochylony kryształ: górne ścianki, dwie boczne, pięta w kolorze akcentu |
| Kapsuła | cała pastylka pod kątem, dwa materiały rozdzielone ciemną opaską, połysk |
| Latarnia | stopa, słup, kołnierz, klosz z jasnym spodem |
| Drzewo | cała korona (duża kula + dwa płaty), pień, pierścień korzeni |
| Ławka | oparcie z dwóch listew, siedzisko widziane z góry, podłokietniki, cztery nogi |
| Kiosk | bryła terminala z grubością, ekran z pikselami, szyjka, stopa |
| Skrzynia | wieko, przód z zatrzaskiem i wnęką, prawa ściana, okucia narożne |
| Moduł dachowy | niska bryła, ekran wentylacji na górze, kratka i dioda z przodu, stopki |
| Znacznik | tablica z grubością i trzema szewronami, słup, stopa, głowica |
| Kryształ | wysoki graniastosłup z czubkiem w kolorze akcentu i dwa odłamki u podstawy |
| Paleta | trzy pudła z taśmą i etykietą na deskach z klockami |
| Witryna | bryła z prawą ścianą, szyba z refleksami, markiza w pasy z falbaną |
| Klucz sektora | karta leżąca na ziemi (z grubością), klucz na ekranie, linie danych |
| Emiter | walec z jasną opaską, wieczko z soczewką, ciemny cokół |
| Znacznik ogrodu | donica (góra, przód, prawa ściana, ziemia) i pięć liści |

## 5. Jedna geometria w każdej skali

- Duży podgląd, sprite na planszy i ikona celu to **ta sama funkcja rysująca** (`VA_ART[kind](c, r, col)`), wywołana z innym
  promieniem. Rysuje w jednostkach `r` wokół środka hitboxa i nie używa transformacji Canvas ani `clip()`.
- Ikona celu (HUD, odprawa, karta misji, wynik) to ta funkcja odtworzona jako ścieżki SVG przez `vaIconSvg()`:
  gradient staje się płaskim kolorem, poświaty i podłoże są pomijane, sylwetka zostaje bez zmian.
  Ikona klasy „element uliczny” (cel bez nazwanego obiektu) składa się z latarni i ławki z tych samych funkcji.
- Uproszczenie przy małej skali wolno robić tylko przez pominięcie drobiazgu — nigdy przez zmianę sylwetki, perspektywy czy
  orientacji. Sprawdza to `qa/objects2.mjs` (pokrycie znormalizowanych sylwetek: plansza ↔ duży podgląd ≥ 0,90, ikona ↔ duży
  podgląd ≥ 0,86).
- Grafika mieści się w ok. 1,1 r od środka; promień i hitbox należą do gry i nie zależą od rysunku.

## 6. Wydajność i ostrość

- Sprite powstaje raz na (wygląd, kolor, promień, nadpróbkowanie) w `OBJECT_SPRITE_CACHE`; klatka to jedno `drawImage`.
- Nadpróbkowanie T1/T2 zależy od gęstości pikseli płótna gry: 2× (DPR 1), 3× (DPR do 2 — telefony; gra ogranicza DPR do 2),
  4× powyżej. T3–T6 zostają przy 2× (także nowe T3/T4 — zbiór `VA_BIG`). Piętnaście sprite’ów T1/T2 przy 3× to ok. 0,6 Mpx,
  czternaście sprite’ów T3/T4 przy 2× ok. 1,06 Mpx (przed GG-OBJECTS-03: 1,63 Mpx).
- Jakość 0 rysuje te same sprite’y bez ruchu bezczynności i bez nakładek „na żywo”.

## 7. Czego nie robić

- Nie wstawiać bitmap ani arkuszy z generatora obrazów — referencja jest wzorem stylu, nie plikiem produkcyjnym.
- Nie pokazywać lewej ściany, nie obracać obiektu „dla urozmaicenia”, nie mieszać rzutu z góry (same dachy) z widokiem z boku.
- Nie dokładać barw spoza palety; nie robić z fioletu koloru dominującego na obiekcie T2 (fiolet to klasa T4).
- Nie powiększać rysunku ponad hitbox, żeby „lepiej wyglądał”.
- Nie liczyć poświat ani gradientów w klatce.

## 8. T3 i T4 (GG-OBJECTS-03) — większe elementy tego samego świata

Reguły §1–§7 obowiązują bez zmian: ta sama kamera (`VA_DX`/`VA_DY`), to samo światło, ten sam kontur, to samo podłoże (`K.base()`),
ta sama zasada „jedna funkcja = plansza, duży podgląd i ikona”. Nic w T1/T2 nie zostało zmienione (źródło, piksele i ikony
porównuje `qa/objects3.mjs` z bazą).

### Paleta tierów

| Tier | Kolor klasy | Co niesie kolor klasy | Dodatki |
|---|---|---|---|
| T3 | złoto `#EFCB63` | karoseria, obudowy, ramy, nogi i głowice masztów, pomost | cyjan `#50F0FA` = szyby, lustra, światła, paski LED; róż `#FF54AD` = małe detale (izolatory, zacisk, kogut konwoju, czopy); grafit-granat = stopy, cokoły, opony, zderzak, przęsła; cień klasy schodzi w fiolet |
| T4 | fiolet `#9875FF` | ściany, dachy, płyty tablic, misy, obelisk, pierścień portalu | cyjan = przeszklenia, woda, ekran, światła; róż = neonowe krawędzie, daszek, pasy ostrzegawcze, opaska; grafit-granat = cokoły, ekrany wyłączone, bramy |

- Kolor klasy przychodzi z gry (`SIZE_TIER_COLORS`, `TIERS[*].color`) i musi dominować w sylwetce — mówi, co wir może już zjeść.
- Cyjan i róż są tu stałymi barwami materiałów (`VA_CYAN`, `VA_PINK`), nie „przeciwnym neonem” z T1/T2 — żaden obiekt T3/T4 nie
  może przez nie wyglądać na T1 albo T2: nie wypełniają korpusu.
- Nie malować całego obiektu jednym kolorem: każdy ma co najmniej kolor klasy, ciemny materiał i jeden akcent światła.

### Pełne sylwetki

| Obiekt | Klasa / próg | Co musi być widać |
|---|---|---|
| Samochód (`samochod`) | pojazd, T3 | cała karoseria przodem do widza: maska, kabina z przednią szybą i dwiema bocznymi, dach, reflektory, grill, zderzak, cztery koła, różowa listwa; jedna orientacja |
| Pojazd konwoju (`samochod` + wariant `konwoj`) | pojazd, T3 | ten sam samochód z różowym kogutem na dachu i orurowaniem przodu |
| Węzeł energii (`wezel`) | węzeł, T3 | świecący rdzeń, dwa ramiona nośne, obręcz z cyjanowymi światłami, złoty kołnierz na grafitowym cokole |
| Pylon (`pylon`) | pylon, T3 | stopa, kratownicowy maszt (trzy nogi, zastrzały), poprzeczka z różowymi izolatorami, głowica z kulą ładunku |
| Zasilacz (`zasilacz`) | węzeł, T3 | obudowa (góra, przód, prawa ściana z żebrami), ciemny panel z błyskawicą, dwa zaciski na pokrywie, stopki |
| Lustro (`lustro`) | pylon, T3 | łukowa tafla w złotej ramie z grubością, jarzmo z czopami, szyjka i stopa |
| Mostek (`mostek`) | węzeł, T3 | pomost z góry (deski, pasek światła), łukowe balustrady z obu stron, dwa filary i łuk nośny |
| Pawilon (`pawilon`) | budowla, T4 | cała bryła: przeszklona fasada między filarami, drzwi pod daszkiem, boczne okna, płyta dachu z neonową krawędzią i świetlikiem |
| Billboard (`billboard`) | budowla, T4 | tablica z grubością i ekranem (planeta, trzy wiersze), lampy, dwa słupy z zastrzałami, cokół |
| Magazyn (`magazyn`) | budowla, T4 | hala z dwuspadowym dachem (obie połacie, żebra), brama rolowana z pasem ostrzegawczym, lampa, boczne okna |
| Pomnik (`landmark`, Arena) | landmark, T4 | obelisk (przód i prawa ściana, opaska, świecący czubek) na dwustopniowym cokole z latarniami |
| Kino (`lm_kino`) | landmark, T4 | budynek z markizą i żarówkami, szklane drzwi, gabloty plakatów, szyld na dachu (napis KINO / CINEMA) i szpula |
| Fontanna (`lm_fontanna`) | landmark, T4 | szeroka misa z wodą, kolumna, górna czasza, strumienie i pióropusz — woda jest jasna i spływa łukami, bez spirali i ciemnej tarczy |
| Portal (`portal`, finisz Areny) | portal, T4 | stojący pierścień z grubością na stopie, światło w otworze (jasny środek — odwrotnie niż wir) |

### Zestaw rysujący — co doszło

- `vaP(x, y, z)` — punkt wspólnej kamery (z = głębia w górę i w prawo); bryły niebędące prostopadłościanem (kabina samochodu,
  dach magazynu, obelisk) liczą wierzchołki tą funkcją, więc pokazują te same trzy ściany co `K.box()`.
- `K.ov()` / `K.oval()` / `K.drum()` — łuk elipsy z krzywych Béziera (w ikonie SVG ma dokładne obramowanie), elipsa, walec.
- `vaGlass()` — szkło jak w witrynie T2; `vaInset()` — szyba w ramie; `vaLerp()`.
- Napisy (szyld kina) maluje `VA_DECALS` po grafice: tekst przechodzi przez warstwę językową i nie jest częścią geometrii.
- Nakładki „na żywo” (`drawObjectLive()`): łuki ładunku krążą wokół rdzenia węzła, pierścień pulsuje wokół kuli pylonu, linia
  skanuje ekran billboardu, ramiona wiru obracają się w otworze portalu — efekty energii, sam obiekt się nie obraca.

### Czego dodatkowo nie robić

- Nie przenosić obiektów między tierami na podstawie arkusza referencyjnego: klasa, próg i promień należą do gry. Dźwig, galeria
  i pozostałe landmarki T5/T6 mają dawne grafiki do osobnego etapu; ikona celu „landmark” pozostaje wspólna dla wszystkich
  landmarków (kino i fontanna też), dopóki T5/T6 nie dostaną swoich.
- Nie rysować fontanny ani portalu jako ciemnej tarczy z jasną obręczą i spiralą — tak wygląda wir.
- Portal-pomocnik w Kampanii (para teleportów na drodze) jest znakiem na podłożu, nie obiektem — nie należy do tej biblioteki.

## 9. T5 i T6 (GG-OBJECTS-04) — największe obiekty i landmarki bossów

Reguły §1–§8 obowiązują bez zmian (kamera `VA_DX`/`VA_DY`, światło z lewej góry, kontur, `K.base()`, „jedna funkcja = plansza,
duży podgląd i ikona”). Nic w T1–T4 nie zostało zmienione (`qa/objects4.mjs` porównuje źródło, piksele i ikony z bazą).
Obrazy z gry: `design/objects4/` (`sheet-hero-*`, `sheet-scale-*`, `sheet-family-after.jpg` = cała biblioteka T1–T6, `sheet-icons-*`).

### Paleta tierów

| Tier | Kolor klasy | Materiał bazowy | Światło i szkło | Akcenty |
|---|---|---|---|---|
| T5 | srebro `#CBD5E1` | kolor klasy na chłodnej stali (`vaHull(col, 0.9)`), prawa ściana w stalowy fiolet | lodowy błękit `VA_ICE`, cyjan szyb | nieliczne różowe paski, lampy i kogut pantografu |
| T6 | zieleń `#46D99A` | zieleń na grafitowej stali (`vaHull(col, 0.55–0.85)`) | turkus `VA_TEAL`, zielone neonowe krawędzie | pojedyncze fioletowe detale (światło masztu wieżowca, owoc drzewa, znaczniki pierścienia rdzenia) |

- `vaHull(col, k)` kładzie kolor klasy na stali (`k` = udział koloru klasy); `vaFaces()` daje z tego wypełnienia `K.box()`.
  Kolor klasy identyfikuje tier, ale nie zastępuje materiałów: szkło, stal, kamień zostają sobą.
- T5 nie może wyglądać na złote T3 ani fioletowe T4: korpus jest srebrny, fiolet tylko w cieniu prawej ściany.
- T6 to najwyższy poziom technologii: więcej warstw (przeszklenia, kratownice, poświaty), ale bez drobnicy, która znika przy oddaleniu.

### Pełne sylwetki

| Obiekt | Klasa / próg | Co musi być widać |
|---|---|---|
| Autobus (`autobus`) | ciężki pojazd, T5 | długie nadwozie przodem do widza (tablica kierunkowa, szyba, reflektory, kratka, zderzak), po prawej pas okien, drzwi, listwa lodowa i różowa, dwa koła; dwa agregaty na dachu |
| Tramwaj (`tramwaj`) | ciężki pojazd, T5 | dwa człony z harmonijką, zaokrąglona szyba z linią kierunkową, okrągłe reflektory, okna w trzech grupach, wózki z małymi kołami, pantograf z różowym ślizgiem |
| Ciężarówka (`ciezarowka`) | ciężki pojazd, T5 | kabina przodem do widza (szyba, belka świateł, wysoka kratka, lusterko), owiewka do wysokiej żebrowanej skrzyni z różowym pasem i lampkami, trzy osie |
| Wieżowiec (`wiezowiec`) | wieża, T6 | trzy cofające się bryły ze ścianą kurtynową (szprosy, piętra, część okien zapalona), zielone krawędzie, przeszklony hol z daszkiem, rama na koronie, maszt z fioletowym światłem |
| Maszt (`maszt`) | wieża, T6 | kratownica na cokole (trzy nogi, zastrzały), dwie platformy, dwie anteny talerzowe, anteny panelowe, pręt z lampą (miga nakładka „na żywo”) |
| Kopuła (`kopula`) | wieża, T6 | szklana kopuła z południkami i równoleżnikami, pierścień neonu, bęben z pasem okien, wejście, latarnia z iglicą |
| Dźwig (`lm_dzwig`) | landmark, T5 | kratownicowa wieża na podstawie z szynami, kabina operatora, długi wysięgnik i przeciwwysięgnik z balastem, kozioł z cięgnami, wózek, lina, kontener na haku |
| Galeria (`lm_galeria`) | landmark, T5 | schody, kolumnada, podświetlone dzieła między kolumnami, szklane drzwi, belkowanie z lodową linią, tympanon, szklana piramida na dachu |
| Iglica (`lm_iglica`) | landmark, T5 (brama iglicy) i T6 (iglica) | cokół, pawilon z łukową bramą, zwężająca się wieża z pierścieniami, taras widokowy, świecąca igła — jeden wygląd, kolor tieru z gry |
| Stacja Centralna (`lm_stacja`) | landmark, T5 | hala z przeszklonym sklepieniem kolebkowym i lunetą-wachlarzem, wielki portal z torami w głąb, łukowe okna, rondel metra „M” |
| Brama Bazaru (`lm_bazar`) | landmark, T5 | dwa filary z różowymi neonami, nadproże z szyldem, dwa dachy z wywiniętymi okapami, wiszące lampiony, girlanda świateł, zwieńczenie |
| Rdzeń Miasta (`lm_rdzen`) | landmark, T6 | stopniowa podstawa reaktora, cztery pylony, unoszący się fasetowany kryształ w pierścieniu-halo, promień energii |
| Fabryka Pikseli (`lm_fabryka`) | landmark, T6 | hala z dachem szedowym (połacie + przeszklenia w prawo), dwa kominy „dymiące” pikselami, okna-piksele, brama, emblemat 3×3 |
| Latarnia Hologramów (`lm_latarnia`) | landmark, T6 | wieża w pasy na kamiennym cokole, domek latarnika, galeria z balustradą, szklana laterna z białym światłem, hologramowe wiązki i pierścień (wiązki to światło: bez nich w ikonie) |
| Drzewo Światła (`lm_drzewo`) | landmark, T6 | okrągła donica, korzenie, pień z trzema konarami i świecącymi żyłkami, korona z dziesięciu kul, światełka, krople światła — to nie drzewo T2 |
| Serwer Główny (`lm_serwer`) | landmark, T6 | wieża szaf za szklanymi drzwiami (dziewięć kaset z diodami), żebra chłodzenia, agregat z wentylatorami, chmura danych połączona pakietami |

### Ikony celów

- Wyglądy T5/T6 i ikony klas „ciężkie pojazdy” (ciężarówka za autobusem) i „wieże” (maszt obok wieżowca) to `vaIconSvg()`.
- Cel nazywający bossa pokazuje ikonę jego landmarku w kolorze tieru (także kino i fontanna). `GOAL_ICONS.landmark` (budowla
  z kolumnami) zostaje ikoną klasy. Ikona to ta sama geometria; ścieżka zaczęta od `lineTo` (Canvas traktuje ją jak `moveTo`)
  dostaje w SVG `M` — tak jest w fontannie, której kodu nie zmieniano.

### Czego dodatkowo nie robić

- Nie dodawać obiektów z arkusza referencyjnego (furgonetka, dron, antena T3, pomnik T4, reaktor, kopuła ochronna…), których gra nie ma.
- Nie zmieniać przypisania `LANDMARK_ART` / `LANDMARK_TIERS` dla wyglądu: brama iglicy i iglica dzielą jedną funkcję.
- Nie rysować latarni ani drzewa bossów jak małej latarni / drzewa T2.
- Nie przekraczać 1,12 r szerokości i 1,16 r wysokości bryły (`qa/objects4.mjs` O4-4): największe obiekty są duże przez promień z gry,
  nie przez rysunek wychodzący poza hitbox.

