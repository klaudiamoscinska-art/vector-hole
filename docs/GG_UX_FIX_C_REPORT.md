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
- `design/ux-fix/c-warsztat.jpg` — karta podglądu: Smuga i Efekt (375×667, PL), Finisz z banerem i błyskawicami (390×844, EN).
- Odtworzenie: `node qa/uxfix-c.mjs --strips --root=<checkout bazy> --label=baza` i `--label=kandydat`.

## 3. Koszt klatki

Mikro-benchmark (`node qa/uxfix-c.mjs --cost [--root=<baza>]`): ta sama zamrożona scena (ziarno 77, wir r 46 po 50 klatkach jazdy łukiem), 6 × 50 renderów `Game.render()` na warunek, mediana; 3 przebiegi naprzemiennie baza (Etap B) / kandydat na nieobciążonej maszynie (1280×720, Chromium headless, CPU). Czas renderu w ms, mediana z 3 (min–max):

| Warunek | Baza | Kandydat |
|---|---|---|
| bez Smugi, jakość 2 | 3,84 (3,55–4,15) | 3,75 (3,54–4,43) |
| Żar, jakość 2 | 3,75 (3,69–4,19) | 3,63 (3,61–3,70) |
| Pryzmat, jakość 2 | 3,80 (3,73–4,20) | 4,10 (3,72–4,39) |
| duży kęs, Pikselowy Wybuch, jakość 2 | 6,98 (6,87–7,06) | 6,83 (6,80–7,04) |
| bez Smugi, jakość 0 | 3,71 (3,65–4,27) | 3,60 (3,54–3,66) |
| Żar, jakość 0 | 3,57 (3,47–3,59) | 3,65 (3,59–4,32) |
| Pryzmat, jakość 0 | 3,48 (3,44–3,61) | 3,63 (3,51–3,79) |
| duży kęs, Pikselowy Wybuch, jakość 0 | 3,82 (3,60–4,18) | 3,76 (3,55–5,96) |

Wniosek: różnice ≤ 0,3 ms mieszczą się w rozrzucie przebiegów — smuga (≤ 14 punktów, jedna–trzy ścieżki, bez `shadowBlur`) i kształty efektów nie zwiększają mierzalnie kosztu klatki. Pamięć: lista smugi ≤ 14 i cząstki ≤ limit przez 5000 klatek (test T3). `qa/perf1.mjs` (bramki MOBILE-PERF-1) — NOT RUN; prawdziwy telefon / GPU — NOT VERIFIED.

## 4. Wyniki testów (końcowy kod gałęzi)

Kod testowany: `7d269b3` (scalony B → C; późniejsze commity zmieniają tylko raport i materiały). Ta sama maszyna.

| Zestaw | Rodzaj | Wynik | Uwagi |
|---|---|---|---|
| `qa/uxfix-c.mjs` (nowy: T, E, F, W) | FN + DOM | **PASS 27/27** | smuga, kształty, E4: te same losowania co Klasyczny, finisz, Warsztat PL/EN, 3 rozdzielczości, ograniczenie ruchu |
| `qa/vfx1.mjs` | statyczne + DOM | **PASS 39/39** | V1 wycina jeden oznaczony blok `UX-FIX-C`; `spawnSuck` / `spawnParticles` bajtowo jak w bazie |
| `qa/ux3.mjs` | DOM + FN | **PASS 42/42** | V1: warstwy wiru bez linii smugi; O1: runda identyczna z bazą |
| `qa/visual.mjs` | DOM | **PASS** | 0 przerysowań podłogi, jakość 0 < 12 ms |
| `qa/workshop-buy.mjs` | DOM | **PASS 73/73** | kupno i podgląd w Warsztacie |
| `qa/ui2.mjs` | DOM | **PASS 109/109** | Warsztat, Miasto, wyniki, nawigacja |
| `qa/deviceqa1.mjs` | DOM | **PASS 50/50** | |
| `qa/uxfix-b.mjs` | FN + DOM | **PASS 18/18** | karty z Etapu B na kodzie C |
| `qa/v19.mjs` (EN), `qa/design.mjs` | DOM / statyczne | **PASS 16/16, 29/29** | paleta: `#ff00ea` usunięty |
| `qa/save-safety.mjs` | FN | **PASS 107/107** | zapis v13 |
| `qa/instructions.mjs` | statyczne | **PASS 4/4** | |
| `qa/responsive.mjs` | DOM | **NOT RUN na C** | PASS 552/552 na A i B; C nie zmienia układu ekranów (zmiany w canvasie Warsztatu sprawdza `uxfix-c` W na 375×667 / 390×844 / 1280×720) |
| `qa/perf1.mjs` | DOM | **NOT RUN** | zamiast niego mikro-benchmark §3 |
| `qa/run-all.mjs` | — | **NOT RUN** | zakres pokryty powyżej |

Naprawione w trakcie: kształty efektów pierwotnie losowały dodatkowe liczby (`Math.random`) — przy wybranym efekcie przesuwałoby to strumień losowań rundy (decyzje rywali). Teraz kształt nadaje `shapeEatFx()` istniejącym cząstkom (te same losowania), a wybuch kształtów nie losuje nic (test E4: 371 = 371 losowań dla każdego efektu).

## 5. Ryzyka

- Wstęga Żaru jest najwyraźniejsza (krycie 0,45) — na jasnych obiektach w śladzie widać lekki róż; obiekty pozostają widoczne (krycie ≤ 0,5).
- Efekty kształtem przy dużym oddaleniu kamery (duży wir) są drobne — czytelność ograniczona skalą świata.
- Klasyczny Efekt na małych kęsach nadal prawie niewidoczny (zachowanie bazowe, nie zmieniane).
- NOT VERIFIED: prawdziwe telefony (GPU), CrazyGames Preview.

## 6. Tabela sześciu zgłoszeń właścicielki

| # | Zgłoszenie | Wykonana poprawka | PR | Dowód | Status |
|---|---|---|---|---|---|
| 1 | Gracz nie wie, że Dzielnice są dostępne | Kafelek „KAMPANIA · dzielnica” + „Drugi tryb: misje z celami · otwarty”; po 3. rundzie „DRUGI TRYB · OTWARTY” i TRYB 2 (nie NOWE); linia wyniku do pierwszej wizyty | #107 | `qa/uxfix-a.mjs` D1–D6 (DOM), `a-dzielnice.jpg` | Zrobione (Etap A) |
| 2 | Sterowanie: gdzie ustawić, czy klawiatura działa przy Myszy | Mysz / Klawiatura rozłączne; „Sterowanie na Arenie” od razu w pauzie i pierwsze w Ustawieniach; podpowiedź trybu; informacja w misjach | #107 | `qa/uxfix-a.mjs` K1–K8, `qa/arena-fix1.mjs` C/L, `a-sterowanie.jpg` | Zrobione (Etap A); Pointer Lock w prawdziwej przeglądarce NOT VERIFIED |
| 3 | „Załóż” otwiera złą zakładkę | ZAŁÓŻ zakłada pojedynczy przedmiot (zakładka, oznaczenie, przewinięcie, potwierdzenie); zestaw — POKAŻ W WARSZTACIE | #107 | `qa/uxfix-a.mjs` R1–R4 (Core City LVL 2–6, Aurora z wygranej misji), `a-nagroda-zaloz.jpg` | Zrobione (Etap A) |
| 4 | Karty Ewolucji: działają tylko 3 z 7 | A: opisy Magnesu (granica 160 wyjaśniona), Turbo combo, Tarczy; B: Skaner (jadalny cel + strzałka), Impuls ssący (zamiast Fali), Łowca (jadalny rywal, +40 raz, „+40 ŁOWCA”), paski kart w HUD z rzeczywistym stanem | #107 + #108 | `qa/uxfix-b.mjs` M1–M6 (FN), H1 (DOM), SIM 10 ziaren baza vs kandydat, `b-karty-hud.jpg` | Zrobione (A + B); balans Turbo combo i zasięg Magnesu — osobne decyzje |
| 5 | Kosmetyki poza wirem niejasne | Prawdziwe smugi, efekty kształtem, dekoracje finiszu, podgląd Warsztatu według kategorii, opisy PL/EN | PR_C | `qa/uxfix-c.mjs` T/E/F/W, paski klatek baza/kandydat, koszt klatki | Zrobione (Etap C) |
| 6 | 1. miejsce, a przeciwnicy więksi | Ranking nadal po punktach; ostrzeżenie od zasięgu zjedzenia (r 420 przy 299 — ostrzeżony przed zasięgiem), znak przy konkretnym rywalu (plansza + PUNKTY), podpowiedź „Miejsce zależy od punktów, nie rozmiaru” | #107 | `qa/uxfix-a.mjs` W1–W7 (FN 375×667 i 1280×720, DOM), `a-ranking-zagrozenie.jpg` | Zrobione (Etap A) |

## 7. HANDOFF

```
STAN PRAC: GG_UX_FIX_C (Etap C) — gotowe do odbioru; zależne od PR A i PR B. Wszystkie 6 zgłoszeń mają poprawki (A, B, C).
REPO: klaudiamoscinska-art/vector-hole, gałąź claude/determined-turing-9d9j3h-c @ kod 7d269b3 (HEAD = commit raportu), baza PR = claude/determined-turing-9d9j3h-b, PR: PR_C
TESTY: §4 — log: qa/out/final/
ZMIANY: game.js (smugi, kształty efektów, dekoracje finiszu, podgląd Warsztatu), style.css; qa/uxfix-c.mjs (T, E, F, W w run-all; --strips, --cost); qa/ux3.mjs V1; docs; design/ux-fix/c-*.jpg
NIEDOKOŃCZONE: brak w zakresie C
RYZYKA: §5
NASTĘPNY KROK: odbiór GPT; kolejność scalania A → B → C (każdy po osobnej zgodzie właścicielki)
PUNKT WZNOWIENIA: ten raport; node qa/uxfix-c.mjs
BEZPIECZNA KONTYNUACJA: preflight; bez merge, publikacji i paczki CrazyGames; nie ruszać main, SAVE v13, workflow, eksportera CG
```
