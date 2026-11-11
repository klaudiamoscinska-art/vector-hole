# GLITCH GULP — wspólne reguły grafiki obiektów (GG-OBJECTS-02, „Premium Vector Objects”)

Obowiązują dla obiektów T1 i T2 (15 wyglądów) i są wzorcem dla kolejnych tierów. Kierunek zatwierdzony przez właścicielkę:
**propozycja 3 — hybryda top-down + pełna sylwetka**. Kod: `game.js`, blok `VA_*` (`vaKit()`, `VA_ART`, `vaIconSvg()`).
Obrazy z gry: `design/objects2/` (arkusze `sheet-hero-*`, `sheet-scale-*`, `sheet-icons-*`). Test: `node qa/objects2.mjs`.

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
  4× powyżej. T3–T6 zostają przy 2×. Piętnaście sprite’ów przy 3× to ok. 0,6 Mpx.
- Jakość 0 rysuje te same sprite’y bez ruchu bezczynności i bez nakładek „na żywo”.

## 7. Czego nie robić

- Nie wstawiać bitmap ani arkuszy z generatora obrazów — referencja jest wzorem stylu, nie plikiem produkcyjnym.
- Nie pokazywać lewej ściany, nie obracać obiektu „dla urozmaicenia”, nie mieszać rzutu z góry (same dachy) z widokiem z boku.
- Nie dokładać barw spoza palety; nie robić z fioletu koloru dominującego na obiekcie T2 (fiolet to klasa T4).
- Nie powiększać rysunku ponad hitbox, żeby „lepiej wyglądał”.
- Nie liczyć poświat ani gradientów w klatce.
