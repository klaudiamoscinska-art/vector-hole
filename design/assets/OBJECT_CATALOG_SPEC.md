# Vector Hole — Pełny Katalog Obiektów Planszy Misji

Dokument towarzyszący plikowi `vector_hole_full_object_catalog.svg`.
Uzupełnia (nie zastępuje) `MISSION_BOARD_SPEC.md` (landmarki i sekwencja finału)
oraz `vector_hole_asset_bible.svg` (bazowe kształty ogólne).

Źródło: GDD 4.0, sekcja 6 (lista 24 misji) — każdy wiersz tabeli poniżej
odpowiada jednemu obiektowi wspomnianemu explicite w opisie celu misji.

---

## 1. Master tabela obiektów

**Uwaga:** kolumna "Zachowanie" ma tylko dwie wartości. **POCHŁANIANY**
oznacza zwykłe "dotknij i zjedz" (20 z 24 obiektów — zdecydowana większość,
zgodnie z rdzeniem gry "pożeranie geometrii", GDD sekcja 0). **STRUKTURALNY**
oznacza, że obiekt zostaje na planszy i się nie zjada — to wyjątek,
dotyczy tylko 4 obiektów opisanych w sekcji 2.

| Obiekt | Tier | Misje | Zachowanie | Warunek pochłonięcia |
|---|---|---|---|---|
| Fragment energii | T1 | M01, M22 | Pochłaniany | Zawsze jadalny |
| Kapsuła impulsu | T1 | M06 | Pochłaniany | Zawsze jadalny |
| Kryształ | T2 | M13 | Pochłaniany | Jadalny po przejściu przez portal |
| Moduł dachowy | T1 | M17 | Pochłaniany | Zawsze jadalny |
| Latarnia | T2 | ogólny | Pochłaniany | Zawsze jadalny |
| Ławka | T2 | ogólny | Pochłaniany | Zawsze jadalny |
| Drzewo | T2 | ogólny | Pochłaniany | Zawsze jadalny |
| Skrzynia | T2 | M09 | Pochłaniany | Zawsze jadalny |
| Kiosk | T3 | ogólny | Pochłaniany | Zawsze jadalny |
| Samochód | T3 | ogólny | Pochłaniany | Zawsze jadalny |
| Paleta | T2 | M10 | Pochłaniany | Zwykłe zjedzenie = "wyczyszczenie" |
| Pojazd konwoju | T3 | M11 | Pochłaniany (ruchomy) | Porusza się po torze, ale jadalny jak reszta |
| Zasilacz | T2 | M12 | Pochłaniany | Zawsze jadalny; wymagany do odblokowania Dźwigu |
| Emiter | T2 | M21 | Pochłaniany | Zwykłe zjedzenie = "odzyskanie" |
| Węzeł | T2 | M04, M23 | Pochłaniany | Zwykłe zjedzenie = "wyłączenie" |
| Pylon | T2 | M08 | Pochłaniany | Zwykłe zjedzenie = "naładowanie"; po 3 odblokowuje landmark |
| Znacznik ogrodu | T2 | M07 | Pochłaniany | Zwykłe zjedzenie = "odzyskanie" |
| Klucz sektora | T2 | M15 | Pochłaniany | Zawsze jadalny; odblokowuje kolejny sektor planszy |
| Lustro | T3 | M16 | Pochłaniany | Zwykłe zjedzenie = "aktywacja" |
| Witryna | T3 | M14 | Pochłaniany | Zwykłe zjedzenie = "wyczyszczenie" |
| Brama | T3 | M05 | **Strukturalny** | Nie znika — przejazd tylko gdy otwarta (patrz 2.1) |
| Mostek | T3 | M19 | **Strukturalny** | Nie znika — trzeba "zasilić", żeby stał się przejezdny (patrz 2.2) |
| Portal | T3 | M13 | **Strukturalny** | Nie znika — teleportuje gracza (patrz 2.3) |
| Pas przelotu | T3 | M18 | **Strukturalny (strefa)** | To nie obiekt, tylko trasa z limitem czasu (patrz 2.4) |
| Kino | T5 | M04 | Landmark | Patrz `MISSION_BOARD_SPEC.md` |
| Fontanna | T5 | M08 | Landmark | Patrz `MISSION_BOARD_SPEC.md` |
| Dźwig | T5 | M12 | Landmark | Patrz `MISSION_BOARD_SPEC.md` |
| Galeria | T5 | M16 | Landmark | Patrz `MISSION_BOARD_SPEC.md` |
| Iglica | T5 | M20 | Landmark | Patrz `MISSION_BOARD_SPEC.md` |
| Rdzeń Miasta | T5 | M24 | Landmark (finał) | Patrz `MISSION_BOARD_SPEC.md` |

**30 unikalnych typów obiektów łącznie** (24 powyżej + 6 landmarków w
osobnym pliku) pokrywa wszystkie 24 misje kampanii bez wyjątków.

---

## 2. Poprawka: większość obiektów jest PO PROSTU pochłaniana

**Wcześniejsza wersja tego dokumentu przekombinowała ten temat.** Gra to
"pożeranie geometrii" (GDD sekcja 0) — domyślny mechanizm dla niemal
każdego obiektu jest identyczny: dotknięcie rdzeniem → obiekt znika →
liczy się do celu. Czasowniki typu "naładuj", "wyłącz", "zbierz",
"odzyskaj", "aktywuj", "wyczyść" w opisach misji (GDD sekcja 6) to
**tematyczne nazwy tej samej akcji pochłonięcia**, nie dowód na osobną
mechanikę. Np. "wyłącz 2 węzły" (M04) najprościej realizuje się jako
"pochłoń 2 węzły" — węzeł znika, licznik rośnie, dokładnie jak fragment
energii.

**20 z 24 obiektów w tym katalogu to zwykłe pochłanianie**, tylko z inną
nazwą fabularną. Jedyny wyjątek to 4 obiekty, których GDD **nie** każe
pochłonąć, tylko przez nie przejść / ich użyć / przelecieć strefę —
i to jest realna różnica mechaniczna, nie tylko fabularna:

| Obiekt | Czasownik z GDD | Dlaczego to nie pochłanianie |
|---|---|---|
| Brama (M05) | "Przejdź przez" | Gracz przejeżdża przez nią, obiekt zostaje na planszy |
| Mostek (M19) | "Zasil... i otwórz" | Po zasileniu staje się przejezdny, nie znika |
| Portal (M13) | "Użyj portalu" | Teleportuje, nie jest konsumowany |
| Pas przelotu (M18) | "Wyczyść pasy przelotu" | To strefa/trasa z limitem czasu, nie pojedynczy obiekt |

Poniższa sekcja (2.1–2.4) dotyczy **tylko tych 4 wyjątków** — to jedyne
miejsca, gdzie faktycznie potrzebna jest osobna logika poza prostym
"dotknij i zjedz". GDD nadal nie precyzuje szczegółów technicznych tych
4 mechanik, więc poniższe to **propozycje do zatwierdzenia**.

### 2.1 Brama (M05 — "Przejdź przez 2 bramy, gdy są otwarte")
- Brama cyklicznie zmienia stan otwarta/zamknięta (sugerowany rytm: 2–3s
  otwarta / 2–3s zamknięta, do zbalansowania).
- Gdy zamknięta: blokuje przejście (kolizja jak ściana). **Nigdy nie jest
  pochłaniana** — to obiekt na stałe obecny na planszy przez całą misję.
- Gdy otwarta: gracz przejeżdża rdzeniem przez nią, obiekt zostaje na
  swoim miejscu i wraca do cyklu.
- Wizualnie: stan otwarty = jasny cyan glow; zamknięty = przygaszony
  odcień (do ustalenia — czerwony ostrzegawczy nie jest w obecnej
  palecie produktu).

### 2.2 Mostek (M19 — "Zasil 2 mostki i otwórz iglicę")
- Gracz pochłania **osobne obiekty "zasilacz mostka"** w pobliżu (lub
  dotyka samego mostka — do ustalenia), co **nie usuwa mostku z planszy**,
  tylko zmienia jego stan z "nieaktywny" na "przejezdny".
- Po zasileniu obu mostków odblokowuje się dostęp do iglicy (M20).
- Różnica względem bramy: mostek ma tylko dwa stałe stany (nieaktywny →
  aktywny), nie cykl otwarte/zamknięte.

### 2.3 Portal (M13 — "Użyj portalu i zbierz 6 kryształów")
- Portal jest **stałym punktem teleportacji**, nie znika po użyciu.
- Gracz wjeżdża w portal → zostaje przeniesiony na "drugą stronę" planszy,
  gdzie czeka 6 kryształów (te są pochłaniane normalnie).
- Do potwierdzenia: czy portal działa w obie strony, czy tylko raz.

### 2.4 Pas przelotu (M18 — "Wyczyść 3 pasy przelotu")
- To nie pojedynczy obiekt, tylko **strefa/korytarz na planszy** z presją
  czasową (GDD: "Trasa z presją czasu"). "Wyczyszczenie" pasa prawdopodobnie
  oznacza pomyślne przelecenie przez niego w limicie czasu, a nie
  pochłonięcie czegokolwiek wewnątrz.
- Wymaga osobnej logiki strefowej (trigger na wejście/wyjście ze strefy),
  nie kolizji punktowej jak reszta obiektów.

---

## 3. Zasady wspólne dla wszystkich obiektów (z GDD sekcji 10.4 i 11)

- Każdy obiekt na planszy, który jest **celem misji**, musi mieć wizualne
  oznaczenie zgodne z systemem z `vector_hole_asset_bible.svg`: ramka
  narożna, pulsujący obrys, znacznik sektora, licznik czasu lub numeracja
  łańcucha celów.
- Instrukcja tekstowa w brief barze (np. "Naładuj 3 pylony") musi używać
  tej samej ikony/koloru co obiekt na planszy (visual binding, GDD 10.4).
- Obiekty "aktywowane" (pylon, węzeł, lustro, mostek, emiter, brama)
  **nie powinny wyglądać identycznie jak obiekty statyczne** — stąd w
  katalogu SVG mają żółtą (`#EFCB63`) lub różową (`#FF54AD`) plakietkę
  zamiast niebieskiej, żeby gracz od razu widział różnicę w zachowaniu.

---

## 4. Otwarte pytania dla zespołu (przed implementacją)

1. Czy mostek wymaga osobnego obiektu "zasilacza" w pobliżu, czy dotyka
   się bezpośrednio mostku dwukrotnie/przez czas?
2. Czy brama ma stały rytm otwierania, czy zależny od poziomu trudności /
   dzielnicy?
3. Czy "Pas przelotu" to oddzielny typ danych w generatorze (strefa) czy
   ciąg obiektów-checkpointów?
4. Czy portal działa w obie strony (powrót) czy tylko w jedną?

Jeśli Claude Code zacznie implementować logikę gameplayu dla któregoś z
punktów 2.1–2.4 lub pytań w sekcji 4 — powinien zapytać o doprecyzowanie
zamiast zakładać zachowanie, bo GDD 4.0 opisuje te mechaniki tylko na
poziomie fabularnym ("naładuj", "wyłącz", "zasil"), nie technicznym.
