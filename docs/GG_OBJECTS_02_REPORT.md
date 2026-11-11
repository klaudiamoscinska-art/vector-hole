# GG-OBJECTS-02 — produkcyjna wymiana grafik T1 i T2 („Premium Vector Objects”)

Baza: `main` @ `2f8ab87` (PR #94, podłoże A2.1). Gałąź: `claude/inspiring-clarke-1d537v`.
Kierunek artystyczny zatwierdzony przez właścicielkę: propozycja 3 — hybryda top-down + pełna sylwetka (arkusz referencyjny
był wzorem stylu; w grze nie ma żadnej bitmapy — wszystko rysuje Canvas 2D z kształtów wektorowych).
Reguły artystyczne: `docs/GG_OBJECTS_02_ART_RULES.md`. Obrazy z gry: `design/objects2/`.

## 1. Inwentarz obiektów T1 / T2 (źródło: aktualny kod, nie arkusz)

Sprawdzone: `TIERS` + `minSizeTier`, `CAMPAIGN_ENTITY_STATS`, `OBJECT_ART`, `drawObjectArt()`, `OBJECT_SPRITE_CACHE`,
`OBJECT_ART_LITE`, `CampaignEntity.artKind()`, `GOAL_ICONS` / `GOAL_ART_ICONS`, `PROP_STREET_GLYPHS`, `CAMPAIGN_RANDOM_LOOKS`,
specyfikacje misji (`glyph:`). Klasa, próg i promień należą do typu obiektu, wygląd do „glyphu” — nic nie zostało przeniesione
między tierami. Arkusz referencyjny pokazywał moduł dachowy w T1; w grze jest to wygląd klasy `prop` (T2) i taki pozostał.

| Identyfikator (`OBJECT_ART`) | Klasa / tier | Promień | Dotychczas | Teraz | Gdzie występuje | Status |
|---|---|---|---|---|---|---|
| `fragment` | `fragment`, T1 (cyjan) | 7 | płaski romb z czterech trójkątów, kołysał się ±20° | pochylony kryształ: 6 ścianek, różowa pięta, stała orientacja | Arena, Wyzwanie dnia, wyzwania znajomych; leży na planszy każdej misji, cel w M05 i M61; ekran startowy, podglądy Warsztatu, grafika wyniku; Złoty Rdzeń (ta sama sylwetka w złocie) | wdrożone |
| `kapsula` | `capsule`, T1 (cyjan) | 10 | jednobarwna pastylka z szybką | pastylka pod kątem: różowa łuska + cyjanowe szkło, ciemna opaska, połysk | Arena, Wyzwanie dnia, wyzwania; cel w 18 misjach (M01, M06, M18, M91, M93, M98…); grafika wyniku | wdrożone |
| `latarnia` | `prop`, T2 (róż) | 20 | słup z boku ze stożkiem światła | stopa, słup, kołnierz, klosz-kopuła z jasnym spodem | Arena, Wyzwanie dnia, wyzwania; cel nazwany w 5 misjach (M96, M102, M153, M186, M194); losowy element uliczny w 14 misjach (M02, M03, M31, M63…); grafika wyniku | wdrożone |
| `drzewo` | `prop`, T2 | 20 | trzy kule na pniu | korona (duża kula + dwa płaty), pień, pierścień korzeni | Arena, Wyzwanie dnia, wyzwania; cel nazwany w M181, M184, M197; losowy element uliczny w 14 misjach | wdrożone |
| `lawka` | `prop`, T2 | 20 | trzy listwy widziane z przodu | oparcie, siedzisko z góry, cyjanowe podłokietniki, cztery nogi | Arena, Wyzwanie dnia, wyzwania; losowy element uliczny w 14 misjach | wdrożone |
| `kiosk` | `prop`, T2 | 20 | budka z markizą (płaska) | terminal z grubością: ekran z pikselami, szyjka, stopa | Arena, Wyzwanie dnia, wyzwania; cel nazwany w M92, M94; losowy element uliczny w 14 misjach | wdrożone |
| `skrzynia` | `prop`, T2 | 20 | kwadrat z przekątną | skrzynia z wiekiem: góra, przód z zatrzaskiem, prawa ściana, okucia | Arena, Wyzwanie dnia, wyzwania; misje M09, M39, M122, M123 | wdrożone |
| `modul_dachowy` | `prop`, T2 | 20 | prostokąt z wentylatorem | niska bryła z ekranem wentylacji na górze, kratka, dioda, stopki | misja M17 (Dachy) | wdrożone |
| `znacznik` | `marker`, T2 | 20 | proporczyk na maszcie | drogowskaz: tablica z trzema szewronami, słup, stopa | Arena, Wyzwanie dnia, wyzwania; misje M112, M126, M218 | wdrożone |
| `krysztal` | `marker`, T2 | 20 | trzy płaskie odłamki | wysoki graniastosłup z cyjanowym czubkiem + dwa odłamki | misje M13, M151, M158, M169, M178 | wdrożone |
| `paleta` | `marker`, T2 | 20 | trzy prostokąty na dwóch deskach | trzy pudła z taśmą i etykietą na palecie z klockami | misja M10 (Port) | wdrożone |
| `witryna` | `marker`, T2 | 20 | ramka z manekinem | bryła z szybą i refleksami, markiza w pasy z falbaną | misja M14 (Galeria) | wdrożone |
| `klucz_sektora` | `marker`, T2 | 20 | karta na kółku | karta leżąca na ziemi, klucz na ekranie, linie danych | misja M15 (Galeria, ciemność) | wdrożone |
| `emiter` | `marker`, T2 | 20 | czasza na maszcie | walec z cyjanową opaską, wieczko z soczewką, cokół | misja M21 (Rdzeń) | wdrożone |
| `znacznik_ogrodu` | `marker`, T2 | 20 | liść-flaga na paliku | donica (góra, przód, prawa ściana) z pięcioma liśćmi | misja M07 (Park) | wdrożone |

Poza zakresem, bez zmian (źródło grafik identyczne z bazą, 31 funkcji porównanych znak w znak; 30 sprite’ów piksel w piksel):
T3 (`samochod`, `wezel`, `pylon`, `zasilacz`, `lustro`, `mostek`), T4–T6, landmarki, `portal`, złoty bajt (`bajt` — obiekt specjalny
klasy T1 z własną złotą grafiką, nie ma go na arkuszu). **Złoty Rdzeń** nie ma własnej grafiki — gra rysuje go funkcją `fragment`
w złocie, więc dostał nową sylwetkę kryształu (złoty, z różowawą piętą); promienie, poświata i mechanika bez zmian.

## 2. Co faktycznie zmieniono

- `game.js` — blok `VA_*`: paleta (`vaPalette()`), zestaw rysujący (`vaKit()`: bryła `box()`, podłoże `base()`, poświata `bloom()`),
  15 funkcji `VA_ART` (wstawione do `OBJECT_ART` zamiast 15 starych), `vaIconSvg()` (ta sama funkcja odtworzona jako SVG).
- `getObjectSprite()` — sprite T1/T2 w 2× / 3× / 4× zależnie od gęstości pikseli płótna (`OBJECT_SPRITE_DPR`, ustawiane w
  `Game.resize()`), własne podłoże zamiast ogólnej poświaty, mniejsze płótno; reszta wyglądów bez zmian (2×, poświata).
- `drawObjectArt()` — usunięte kołysanie fragmentu (stała orientacja); błysk fragmentu przesunięty na górną ściankę.
- `GOAL_ICONS.fragment / capsule / prop / marker` i 13 wpisów T2 w `GOAL_ART_ICONS` — leniwe gettery zwracające SVG z `vaIconSvg()`.
  `objectiveIconDef()`, `campaignGoalIcon()`, logika celów i misji bez zmian.
- QA: `qa/objects2.mjs` (nowy, 15 kontroli), `qa/objects2-shots.mjs` (nowy, dowody PRZED/PO), `qa/run-all.mjs`, `qa/README.md`;
  osobny commit: `qa/crazygames-basic1.mjs` (literówka składniowa, patrz §6).
- Dokumenty: `docs/GG_OBJECTS_02_ART_RULES.md`, ten raport, `docs/CHANGELOG.md`, `docs/GAME_DESIGN.md`, `docs/claude/ARCHITECTURE.md`.
- Bez zmian: `index.html`, `style.css`, `.github/`, zapis (`SAVE_SCHEMA_VERSION` 13, klucz `vectorHoleSave_v1`), `TIERS`,
  `CAMPAIGN_ENTITY_STATS`, RNG, układy, boty, kamera, sterowanie, podłoże A2.1, Horyzont, efekty pochłaniania.

## 3. Zrzuty z działającej gry (`design/objects2/`, generuje `node qa/objects2-shots.mjs --root <baza>`)

Wszystko rysuje renderer gry (`drawObjectArt()` / sprite cache / `objectiveIconDef()`); żaden obraz nie pochodzi z generatora.
PRZED = `main` @ `2f8ab87`, PO = ta gałąź; ta sama maszyna, te same seedy, kamera, pozycje i promienie.

| Wymaganie | Pliki |
|---|---|
| A. Arkusz PRZED / PO każdego assetu | `sheet-hero-before.jpg`, `sheet-hero-after.jpg` |
| B. Pełne sylwetki, jedna perspektywa | `sheet-hero-after.jpg` (15 wyglądów, r = 78) |
| C. Rzeczywista skala (promień z gry, 1 jedn. = 1 px CSS, podłoże A2.1) | `sheet-scale-before.png`, `sheet-scale-after.png` |
| Ikony celów (66 / 22 / 13 px) | `sheet-icons-before.png`, `sheet-icons-after.png` |
| D. Arena na A2.1 (seed 20261111, Plac Neonów) | `arena-{phone,cg,desktop}-{before,after}.jpg`, jakość 0: `arena-gfx0-phone-*` |
| E. Kampania, różne dzielnice | telefon: `m02-plac`, `m07-park`, `m09-port`, `m10-port`, `m13-galeria`, `m14-galeria`, `m15-galeria` (ciemność), `m17-dachy`, `m21-rdzen`; CrazyGames i desktop: `m09-port`, `m14-galeria` |
| F. Wyzwanie dnia 2026-11-11 (seed 1162589282, Port Syntez) | `daily-{phone,cg,desktop}-{before,after}.jpg` |

Kadry: telefon 390×844 (DPR 2), CrazyGames 800×450, desktop 1366×768. Liczby do kadrów: `design/objects2/facts.json`.

| Kadr | Hash układu PRZED / PO | `Math.random` PRZED / PO | Klatka (mediana, ms) PRZED / PO |
|---|---|---|---|
| Arena, telefon (299 obiektów + 5 botów) | `991bcf7b` / `991bcf7b` | 23 / 23 | 9,4 / 6,1 |
| Arena, telefon, jakość 0 | `991bcf7b` / `991bcf7b` | 12 / 12 | 2,5 / 2,3 |
| Arena, CrazyGames | `991bcf7b` / `991bcf7b` | 23 / 23 | 3,5 / 2,4 |
| Arena, desktop | `991bcf7b` / `991bcf7b` | 23 / 23 | 7,3 / 5,4 |
| Wyzwanie dnia, telefon | `2bb93250` / `2bb93250` | 12 / 12 | 5,3 / 5,0 |
| M02 Plac (losowe elementy uliczne) | `546f2f34` / `546f2f34` | 68 / 68 | 2,7 / 2,2 |
| M07 Park (znacznik ogrodu) | `f0eec95c` / `f0eec95c` | 37 / 37 | 1,5 / 1,3 |
| M09 Port (skrzynia) | `e3edf5ac` / `e3edf5ac` | 56 / 56 | 1,8 / 1,5 |
| M10 Port (paleta) | `6eb4db65` / `6eb4db65` | 35 / 35 | 1,5 / 1,3 |
| M13 Galeria (kryształ) | `a291c8c` / `a291c8c` | 45 / 45 | 2,9 / 1,9 |
| M14 Galeria (witryna) | `7ac46510` / `7ac46510` | 39 / 39 | 1,7 / 1,3 |
| M15 Galeria (klucz sektora) | `729aa31e` / `729aa31e` | 35 / 35 | 3,9 / 3,3 |
| M17 Dachy (moduł dachowy) | `e3edf5ac` / `e3edf5ac` | 56 / 56 | 2,1 / 1,6 |
| M21 Rdzeń (emiter) | `729aa31e` / `729aa31e` | 35 / 35 | 1,6 / 1,7 |

Wszystkie 20 kadrów: układ, liczba obiektów, kamera i liczba losowań identyczne; błędy strony i konsoli 0 / 0.
Sprite’y T3–T6, landmarków, portalu i bajtu: 30 porównanych, 0 różnic (piksel w piksel).
(M09 i M17 oraz M15 i M21 mają te same hashe, bo ich układ powstaje z tego samego szablonu i tego samego seeda testowego —
różnią się tylko wyglądem obiektów.)

<!-- QA-SECTIONS -->
