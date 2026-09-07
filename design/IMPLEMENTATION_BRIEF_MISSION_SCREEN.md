# Vector Hole — Brief wdrożeniowy: rozbudowa ekranu misji

> **To jest zadanie budowy nowej funkcjonalności, nie opis tego, co już
> działa.** `GAME_MECHANICS_AUDIT.md` pokazuje, że dziś (po PR #12) wszystkie
> 24 misje kampanii są uproszczone do 4 uniwersalnych szablonów celu
> (`eatCount`/`comboChain`/`gatesPassed`/`activateAndDevour`) na tych samych
> 8 sprite'ach + wieżowcu, a landmarki renderują się identycznie (pulsujące
> kółko + kłódka). Pliki w tym pakiecie (`assets/`, `gameplay/`) opisują
> **stan docelowy** — to, co ma powstać, żeby każda misja miała unikalny,
> zamierzony w GDD wygląd i mechanikę.

---

## 1. Zakres pracy — czego to dotyczy

Rozbudowa **wyłącznie ekranu rozgrywki misji kampanii** (`updateCampaign()`/
`renderCampaign()` w `game.js`). Nie dotyczy Areny/GRAJ 2:00 — tam bestiariusz
8+1 sprite'ów zostaje bez zmian, tak jak jest.

## 2. Krok 0 — weryfikacja w kodzie PRZED implementacją (obowiązkowe)

Ten brief i pliki SVG powstały na podstawie `GAME_MECHANICS_AUDIT.md`, którego
kodu ja sama nie widziałam — audytował go ktoś inny, ja tylko czytam wnioski.
Mogę się mylić w szczegółach tak jak myliłam się już wcześniej w tej samej
robocie (błędne kolory, brakujący obiekt, niespójna tabela — patrz historia
poprawek w `assets/OBJECT_CATALOG_SPEC.md`). Zanim Claude Code napisze
jakikolwiek kod, powinien sam potwierdzić w repo poniższe fakty i **zatrzymać
się i zapytać, jeśli coś się nie zgadza** z tym briefem:

1. **Dokładna lista `WorldObject` subtypes i ich przypisanie do tieru
   kolorów** (`grep -n "subtype" game.js`, znaleźć definicję tierów
   mały/średni/duży). Audyt wymienia dla tieru małego: latarnia, drzewo,
   ławka; dla średniego: samochód, kiosk, skrzynia, fontanna — **portal nie
   jest wymieniony w tym zdaniu audytu**, mimo że wcześniej audyt mówi o
   "8 sprite'ach" w bestiariuszu. To rozbieżność w samym audycie, nie tylko
   w moim briefie — sprawdź w kodzie, do którego tieru faktycznie należy
   `portal`, zanim przypiszesz tiery nowym obiektom.
2. **Dokładna sygnatura i miejsce generycznych placeholderów**: gdzie w
   kodzie `activateAndDevour` tworzy encję `pylon` i gdzie `eatCount`
   tworzy encję `marker` — to tam trzeba podmienić na nowe subtype'y,
   nie zgaduj lokalizacji.
3. **Dokładna nazwa pola `landmarkId`** dla M24 (audyt pisze: "prawdopodobnie
   `'rdzen_miasta'`, zweryfikować") — sprawdź wprost w `CAMPAIGN_MISSIONS`.
4. **Czy `skrzynia` (M09) już istnieje jako realny subtype**, czy też jest
   dziś renderowana jako generyczny `marker` — audyt tego nie precyzuje
   wprost, moja tabela w Zadaniu 1 zakłada, że może już istnieć.

**Jeśli którykolwiek z powyższych faktów różni się od założeń w tym
briefie — zatrzymaj się i zapytaj, zamiast kontynuować na moich
założeniach.** Ten brief opisuje *zamiar*, nie zweryfikowany stan kodu.

## 3. Trzy niezależne zadania, w kolejności rosnącej złożoności

### Zadanie 1 — Nowe typy obiektów (najprostsze, największy zasięg)

**Dziś:** `activateAndDevour` używa jednego generycznego sprite'a `pylon`
jako aktywatora we wszystkich misjach tego typu (M04 węzły, M07 znaczniki
ogrodu, M08 pylony, M15 klucze, M16 lustra, M19 mostki, M21 emitery, M23
węzły finałowe — wszystko wygląda jak `pylon`).

**Do zrobienia:** dodać osobne `WorldObject` subtypes odpowiadające
faktycznej nazwie z GDD, każdy z własną grafiką z
`assets/vector_hole_full_object_catalog.svg`:

| Nowy subtype | Zastępuje generyczny `pylon` w misjach |
|---|---|
| `wezel` | M04, M23 |
| `znacznik_ogrodu` | M07 |
| `pylon` (zostaje, dostaje właściwą grafikę zamiast placeholdera) | M08 |
| `klucz_sektora` | M15 |
| `lustro` | M16 |
| `mostek` | M19 |
| `emiter` | M21 |

Analogicznie `eatCount` używa dziś generycznej encji `marker` dla obiektów
typu kryształ (M13), skrzynia (M09 — a to akurat już istnieje jako `skrzynia`
per bestiariusz, do zweryfikowania w kodzie), paleta (M10), pojazd konwoju
(M11), moduł dachowy (M17), kapsuła impulsu (M06). Każdy z nich dostaje
własny subtype + grafikę z tego samego pliku.

**Uwaga o tierach:** nowe obiekty nie muszą łamać istniejącego 3-tierowego
systemu kolorów gry (mały=cyan, średni=pink, duży=green). Przypisz każdy
nowy obiekt do najbliższego pasującego tieru wizualnego z tej trójki —
**ignoruj** system T1–T5 z `assets/vector_hole_asset_bible.svg`, to była
moja pomyłka względem realnej implementacji (patrz `GAME_MECHANICS_AUDIT.md`
§1.4). Jedyny wyjątek: landmarki (patrz Zadanie 2) to osobna, większa klasa
wizualna ponad "duży" tier Areny.

### Zadanie 2 — Unikalne landmarki (średnia złożoność)

**Dziś:** `CampaignEntity.draw()` case `'landmark'` ignoruje `landmarkId` —
każdy landmark to ten sam pulsujący podwójny okrąg + kłódka.

**Do zrobienia:** rozgałęzić `draw()` po `landmarkId` (`'kino'`, `'fontanna'`,
`'dzwig'`, `'galeria_glowna'`, `'iglica_wejscie'`, prawdopodobnie `'rdzen_miasta'`
dla M24 — zweryfikować dokładną nazwę w `CAMPAIGN_MISSIONS`) i narysować
unikalną sylwetkę z `gameplay/vector_hole_mission_board_finale.svg` dla
każdego. Stan zablokowany (kłódka) zostaje bez zmian jako wspólny overlay
na wierzchu unikalnej sylwetki.

**Opcjonalnie, jeśli jest budżet czasowy:** 4-stanowa sekwencja finału
(cel aktywny → ładowanie → collapse → wchłonięty) opisana w
`assets/MISSION_BOARD_SPEC.md` sekcja 4. To rozszerza obecny model (landmark
po prostu znika po `activateAndDevour`) o animację przejścia. Jeśli to za
dużo na pierwszą iterację — samo unikalne rysowanie sylwetki (bez animacji
collapse) już realizuje najważniejszą część GDD §10.6.

### Zadanie 3 — Faktyczne mechaniki zamiast etykiet (największa złożoność, opcjonalne)

To dotyczy tylko 4 obiektów, które w GDD mają czasownik inny niż "pochłoń"
(pełne uzasadnienie w `assets/OBJECT_CATALOG_SPEC.md` sekcja 2):

- **Portal (M13)** — dziś to zwykłe `eatCount` na `marker`. Docelowo:
  dotknięcie portalu teleportuje gracza w inne miejsce planszy, gdzie
  czeka 6 kryształów.
- **Mostek (M19)** — dziś prawdopodobnie `activateAndDevour` na generyczny
  `pylon`. Docelowo: mostek to stały element planszy, który po "zasileniu"
  zmienia stan z nieprzejezdnego na przejezdny (nie znika).
- **Pas przelotu (M18)** — dziś prawdopodobnie `eatCount` na serię markerów
  w rzędzie. Docelowo: strefa/korytarz z wykrywaniem wejścia/wyjścia i
  limitem czasu, nie pojedyncze obiekty.
- **Brama (M05)** — **to już działa poprawnie** (`gatesPassed`), nic nie
  trzeba zmieniać.

**Rekomendacja:** Zadanie 3 zostawić na koniec albo w ogóle pominąć w
pierwszej iteracji — to jedyna część, która wymaga nowej logiki gameplayu
(nie tylko nowych sprite'ów), a GDD i tak nie precyzuje szczegółów
technicznych (dokładny timing teleportu, czy portal działa w obie strony,
itd. — pytania spisane w `OBJECT_CATALOG_SPEC.md` sekcja 4).

## 4. Co NIE wchodzi w zakres tego briefu

- System Evolution/Overdrive w Arenie (GAME_MECHANICS_AUDIT.md §3.1) — to
  osobny, duży temat, niezwiązany z ekranem misji.
- Druga waluta Prisms, popup "ZMIEŃ WYGLĄD", dwa systemy w zakładce
  Wyzwania — to poprawki ekranów meta, osobny brief, jeśli będzie potrzebny.
- Zmiana minimapy w Arenie (pozycja, danger indicators) — dotyczy trybu
  GRAJ 2:00, nie misji.

## 5. Sugerowana kolejność wdrożenia

1. Zadanie 1 (nowe sprite'y) — najmniejsze ryzyko, największy widoczny efekt,
   nie zmienia żadnej logiki gameplayu, tylko podmienia grafikę.
2. Zadanie 2 (unikalne landmarki, bez animacji collapse) — też głównie
   grafika + jeden `switch` po `landmarkId`.
3. Zadanie 2b (animacja collapse) — jeśli zostanie czas/budżet.
4. Zadanie 3 (Portal/Mostek/Pas przelotu jako realne mechaniki) — osobna
   decyzja projektowa, wymaga odpowiedzi na pytania z sekcji 4
   `OBJECT_CATALOG_SPEC.md` zanim się zacznie kodować.

## 6. Pliki źródłowe do tego briefu

- `assets/vector_hole_full_object_catalog.svg` — wygląd 24 obiektów (Zadanie 1)
- `assets/OBJECT_CATALOG_SPEC.md` — która misja używa którego obiektu, tiery,
  zasady 4 wyjątków strukturalnych (Zadanie 3)
- `gameplay/vector_hole_mission_board_finale.svg` — 6 unikalnych landmarków +
  sekwencja collapse (Zadanie 2)
- `assets/MISSION_BOARD_SPEC.md` — logika sekwencji collapse (Zadanie 2b)
- `GAME_MECHANICS_AUDIT.md` (dostarczony przez zespół) — dokładny opis
  obecnego stanu kodu, punkt odniesienia "przed"
