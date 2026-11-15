# GG_UX_FIX_C — Etap C: Warsztat (podglądy kategorii, prawdziwe smugi, efekty pochłaniania, finisz)

- **Baza tego PR:** gałąź Etapu B `claude/determined-turing-9d9j3h-b` (PR B). Ten PR pokazuje wyłącznie przyrost C; scalać po A i B.
- **Gałąź:** `claude/determined-turing-9d9j3h-c`. Zapis v13 bez zmian, bez nowego pola; ceny, nagrody, ID i posiadanie przedmiotów bez zmian; wiry (looki) bez zmian.

## 1. Co się zmieniło

| Kategoria | Przed (audyt) | Teraz |
|---|---|---|
| **Smuga** | Pulsujący pierścień wokół wiru (taki sam w ruchu i w miejscu), opis obiecywał ślad | **Prawdziwy ślad za wirem w ruchu** (`Hole.sampleTrail()`, `drawAuraTrail()`): punkt co 0,3 r drogi, najwyżej 14 (ok. 4 r), każdy znika po `0,9 + r/300` s — po zatrzymaniu ślad gaśnie w ok. sekundę. Skok (odrodzenie, teleport) zaczyna ślad od nowa — bez linii przez mapę. Tylko pamięć (stała, mała lista), nic w zapisie. Rysowany nad studnią grawitacyjną, pod wirem, szerokość ≤ 0,7 r, krycie ≤ 0,5. Warianty kształtem: Iskra — iskry, Żar — wstęga, Zawirowanie — dwie skręcone nitki, Impuls — strzałki-impulsy, Pryzmat — trzy linie w kolorach palety, Zorza Startu — miękka zorza. Pierścień usunięty. |
| **Efekt pochłaniania** | Tylko kolor cząstek; „Pikselowy Wybuch” bez pikseli; Pryzmat (biały) = Klasyczny; na fragmentach prawie niewidoczny | Kształt cząstek (`shape`, `drawEffectShape()`): Pikselowy Wybuch — kwadratowe piksele, Neonowa Róża — płatki, Fioletowa Szczelina — szczelina, Pryzmat — trójkąty w czterech kolorach palety. Mały kęs: tyle cząstek co Klasyczny (6), ale startują z brzegu wiru (koniec połykania jest przy środku, gdzie znikały od razu — stąd „niewidoczny”). Większy kęs: krótki wybuch 4–6 kształtów. Hitboxy, czas jedzenia, punkty, hit-stop bez zmian (test E3). Klasyczny bez zmian. |
| **Finisz** | Tylko kolor banera ok. 1,6 s; Pryzmat `#ff00ea` spoza palety | Dekoracja banera „WIELKI FINISZ!” (`drawFinishDeco()`): Fala — fala pod napisem, Złoty Szczyt — szczyty po bokach, Zielona Burza — migające błyskawice, Pryzmat — pasy i trójkąty w kolorach palety. Ten sam moment (12 s do końca), 1,6 s, priorytet 3, bez blokowania przycisków, bez zaciemnienia. Pryzmat → `#FF54AD`. |
| **Warsztat** | Duża karta zawsze opisywała wir; Efekt / Finisz w siatce jako kółka | Karta podglądu według otwartej zakładki: nazwa, „SMUGA / EFEKT POCHŁANIANIA / FINISZ · BEZ BONUSU W RUNDZIE”, jedno zdanie, co robi i kiedy widać (PL/EN). Podgląd tym samym kodem co runda: Smuga — wir jedzie ósemką z prawdziwym śladem; Efekt — obiekt wpada co 1,6 s, co trzeci kęs duży, cząstki z `Particle`; Finisz — baner z dekoracją w pętli. Miniatury: Smugi jeżdżą ze śladem, Efekty / Finisze mają ikony kształtu. Oglądanie nic nie zapisuje; zasady podglądu (NIE TERAZ, inna zakładka) bez zmian. Ograniczenie ruchu: podglądy i dekoracje stoją. Jakość 0: smuga bez drugiej warstwy, iskry rzadsze. |

## 2. Dowody wizualne (te same sceny, baza = Etap B, kandydat = Etap C, `Game.render()` z gry)

- `design/ux-fix/c-smuga-klatki.jpg` — Żar przy jakości 2 i 0, Zawirowanie: baza (pierścień) vs kandydat (ślad), 4 klatki co 0,2 s.
- `design/ux-fix/c-efekt-klatki.jpg` — Pikselowy Wybuch i Pryzmat przy kęsach: baza (sam kolor) vs kandydat (piksele / trójkąty).
- `design/ux-fix/c-finisz-klatki.jpg` — Zielona Burza: baza (zielony napis) vs kandydat (napis + błyskawice), ten sam moment.
- `design/ux-fix/c-warsztat.jpg` — karta podglądu dla zakładek Smuga / Efekt / Finisz (390×844).
- Odtworzenie: `node qa/uxfix-c.mjs --strips --root=<checkout bazy> --label=baza` i `--label=kandydat`.

## 3. Koszt klatki

COST_C

## 4. Wyniki testów (końcowy kod gałęzi)

FINAL_RESULTS_C

## 5. Ryzyka

- Wstęga Żaru jest najwyraźniejsza (krycie 0,45) — na jasnych obiektach w śladzie widać lekki róż; obiekty pozostają widoczne (krycie ≤ 0,5).
- Efekty kształtem przy dużym oddaleniu kamery (duży wir) są drobne — czytelność ograniczona skalą świata.
- Klasyczny Efekt na małych kęsach nadal prawie niewidoczny (zachowanie bazowe, nie zmieniane).
- NOT VERIFIED: prawdziwe telefony (GPU), CrazyGames Preview.

## 6. Tabela sześciu zgłoszeń właścicielki

| # | Zgłoszenie | Wykonana poprawka | PR | Dowód | Status |
|---|---|---|---|---|---|
| 1 | Gracz nie wie, że Dzielnice są dostępne | Kafelek „KAMPANIA · dzielnica” + „Drugi tryb: misje z celami · otwarty”; po 3. rundzie „DRUGI TRYB · OTWARTY” i TRYB 2 (nie NOWE); linia wyniku do pierwszej wizyty | PR_A | `qa/uxfix-a.mjs` D1–D6 (DOM), `a-dzielnice.jpg` | Zrobione (Etap A) |
| 2 | Sterowanie: gdzie ustawić, czy klawiatura działa przy Myszy | Mysz / Klawiatura rozłączne; „Sterowanie na Arenie” od razu w pauzie i pierwsze w Ustawieniach; podpowiedź trybu; informacja w misjach | PR_A | `qa/uxfix-a.mjs` K1–K8, `qa/arena-fix1.mjs` C/L, `a-sterowanie.jpg` | Zrobione (Etap A); Pointer Lock w prawdziwej przeglądarce NOT VERIFIED |
| 3 | „Załóż” otwiera złą zakładkę | ZAŁÓŻ zakłada pojedynczy przedmiot (zakładka, oznaczenie, przewinięcie, potwierdzenie); zestaw — POKAŻ W WARSZTACIE | PR_A | `qa/uxfix-a.mjs` R1–R4 (Core City LVL 2–6, Aurora z wygranej misji), `a-nagroda-zaloz.jpg` | Zrobione (Etap A) |
| 4 | Karty Ewolucji: działają tylko 3 z 7 | A: opisy Magnesu (granica 160 wyjaśniona), Turbo combo, Tarczy; B: Skaner (jadalny cel + strzałka), Impuls ssący (zamiast Fali), Łowca (jadalny rywal, +40 raz, „+40 ŁOWCA”), paski kart w HUD z rzeczywistym stanem | PR_A + PR_B | `qa/uxfix-b.mjs` M1–M6 (FN), H1 (DOM), SIM 10 ziaren baza vs kandydat, `b-karty-hud.jpg` | Zrobione (A + B); balans Turbo combo i zasięg Magnesu — osobne decyzje |
| 5 | Kosmetyki poza wirem niejasne | Prawdziwe smugi, efekty kształtem, dekoracje finiszu, podgląd Warsztatu według kategorii, opisy PL/EN | PR_C | `qa/uxfix-c.mjs` T/E/F/W, paski klatek baza/kandydat, koszt klatki | Zrobione (Etap C) |
| 6 | 1. miejsce, a przeciwnicy więksi | Ranking nadal po punktach; ostrzeżenie od zasięgu zjedzenia (r 420 przy 299 — ostrzeżony przed zasięgiem), znak przy konkretnym rywalu (plansza + PUNKTY), podpowiedź „Miejsce zależy od punktów, nie rozmiaru” | PR_A | `qa/uxfix-a.mjs` W1–W7 (FN 375×667 i 1280×720, DOM), `a-ranking-zagrozenie.jpg` | Zrobione (Etap A) |

## 7. HANDOFF

```
STAN PRAC: GG_UX_FIX_C (Etap C) — gotowe do odbioru; zależne od PR A i PR B. Wszystkie 6 zgłoszeń mają poprawki (A, B, C).
REPO: klaudiamoscinska-art/vector-hole, gałąź claude/determined-turing-9d9j3h-c @ FINAL_SHA_C, baza PR = claude/determined-turing-9d9j3h-b, PR: PR_C
TESTY: §4 — log: qa/out/final/
ZMIANY: game.js (smugi, kształty efektów, dekoracje finiszu, podgląd Warsztatu), style.css; qa/uxfix-c.mjs (T, E, F, W w run-all; --strips, --cost); qa/ux3.mjs V1; docs; design/ux-fix/c-*.jpg
NIEDOKOŃCZONE: brak w zakresie C
RYZYKA: §5
NASTĘPNY KROK: odbiór GPT; kolejność scalania A → B → C (każdy po osobnej zgodzie właścicielki)
PUNKT WZNOWIENIA: ten raport; node qa/uxfix-c.mjs
BEZPIECZNA KONTYNUACJA: preflight; bez merge, publikacji i paczki CrazyGames; nie ruszać main, SAVE v13, workflow, eksportera CG
```
