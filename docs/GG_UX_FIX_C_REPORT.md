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
| `qa/responsive.mjs` | DOM | **PASS 552/552** | wszystkie ramki telefon / tablet / Poki / CrazyGames (lokalna ramka) / desktop |
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
| 5 | Kosmetyki poza wirem niejasne | Prawdziwe smugi, efekty kształtem, dekoracje finiszu, podgląd Warsztatu według kategorii, opisy PL/EN | #109 | `qa/uxfix-c.mjs` T/E/F/W, paski klatek baza/kandydat, koszt klatki | Zrobione (Etap C) |
| 6 | 1. miejsce, a przeciwnicy więksi | Ranking nadal po punktach; ostrzeżenie od zasięgu zjedzenia (r 420 przy 299 — ostrzeżony przed zasięgiem), znak przy konkretnym rywalu (plansza + PUNKTY), podpowiedź „Miejsce zależy od punktów, nie rozmiaru” | #107 | `qa/uxfix-a.mjs` W1–W7 (FN 375×667 i 1280×720, DOM), `a-ranking-zagrozenie.jpg` | Zrobione (Etap A) |

## 7. Poprawka po odbiorze GPT (2026-11-16)

**Stan odbioru:** #107 (A, `c3c222173303572c9373f3d1ba3eb8c3f4195e2b`) i #108 (B, `8f69380e0a4d39364af27105652bcbc8b8f77ed4`) zaakceptowane; #109 (C, `017dc01609c973cfe20952c5e52daeae0226aa9f`) — do poprawki.

**Problem (GPT):** `drawPreviewEatFx()` trzymała listę `warsztatFxParts` po zmianie efektu. Przy przełączeniu np. Pikselowy Wybuch → Pryzmat etykieta pokazywała nowy przedmiot, a cząstki do następnego kęsa (do 1,6 s; przy ograniczeniu ruchu — do następnej zmiany cyklu) nadal przedstawiały poprzedni efekt. Opóźnienie odświeżenia, nie trwała blokada.

**Przyczyna:** lista cząstek była przebudowywana tylko przy nowym kęsie w cyklu (`warsztatFxBite !== n`) albo gdy była pusta przy ograniczeniu ruchu — zmiana efektu nie była warunkiem.

**Naprawa (`d49f4f3`, minimalna):** lista należy do jednego efektu (`warsztatFxEffect`). Gdy efekt podglądu jest inny (wybór, podgląd nieposiadanego, NIE TERAZ, powrót na zakładkę po zmianie), stare cząstki są usuwane i od razu powstaje kęs nowego efektu — w tej samej klatce, bez czekania na cykl, przy zwykłych i ograniczonych animacjach. Otwarcie Warsztatu też zaczyna od razu (`warsztatFxEffect = null`). Bez zmian: efekty w rundzie, balans, zapis, inne kosmetyki, zakup i wyposażenie (podgląd nadal nic nie wydaje i niczego nie zakłada).

**Test regresyjny `qa/uxfix-c.mjs` S** (prawdziwe kliknięcia DOM, 390×844, zwykłe i ograniczone animacje; sprawdzenie zaraz po kęsie, więc przed kolejnym cyklem):
- S1: Pikselowy Wybuch → Pryzmat → Fioletowa Szczelina — od razu tylko kształt nowego efektu;
- S2: podgląd nieposiadanej Neonowej Róży (płatki od razu), NIE TERAZ → od razu wyposażona Szczelina; waluta, `owned` i `selected` (w pamięci i w zapisie) bez zmian;
- S3: inna zakładka i powrót na Efekt — wyposażony efekt.

| | Kod | Wynik S |
|---|---|---|
| przed poprawką | `57d315c` (C po synchronizacji, bez poprawki) | **FAIL 4/8** — S1 i S2 w obu trybach (np. etykieta „Pryzmat”, cząstki `pixel`; „Neonowa Róża”, cząstki `rift`); S3 PASS |
| po poprawce | `d49f4f3` | **PASS 8/8** |

Logi: `qa/out/fix/przed-poprawka.log`, `qa/out/fix/po-poprawce.log` (lokalnie).

**Synchronizacja A → B → C:** zwykłe merge — A → B (`f2ba7ff`), B → C (`57d315c`); bez force-push, rebase i cherry-pick. `git merge-base --is-ancestor`: A jest przodkiem B — TAK; B jest przodkiem C — TAK. Bazy PR bez zmian: #107 → `main`, #108 → A, #109 → B.

**Zakres zmian względem odebranych wersji:**
- A (`c3c2221`): bez zmian.
- B: `8f69380` → `f2ba7ff` — tylko merge A (raport A i 4 obrazy `design/ux-fix/a-*.jpg`); kod gry i testy bez zmian.
- C: `017dc01` → HEAD — synchronizacja (raporty A/B, obrazy A) + poprawka: `game.js` (10 linii w `drawPreviewEatFx()` i `openWarsztatScreen()`), `qa/uxfix-c.mjs` (część S), `qa/README.md`, `docs/GAME_DESIGN.md`, `docs/CHANGELOG.md`, ten raport.

**Weryfikacja na końcowym kodzie C (`d49f4f3`):**

| Zestaw | Rodzaj | Wynik |
|---|---|---|
| `qa/uxfix-c.mjs` (T, E, F, W, S) | FN + DOM | **PASS 35/35** |
| `qa/workshop-buy.mjs` | DOM | **PASS 73/73** |
| `qa/deviceqa1.mjs` (cały, w tym Warsztat) | DOM | **PASS 50/50** |
| `qa/instructions.mjs` | statyczne | **PASS 4/4** |
| `run-all`, symulacje balansu, pozostałe zestawy | — | **NOT RUN** — poprawka dotyczy tylko podglądu w Warsztacie; wyniki z §4 dotyczą kodu `7d269b3`, który różni się wyłącznie tą funkcją |
| urządzenia, CrazyGames Preview | — | **NOT VERIFIED** |

**Końcowe SHA:** A = `c3c222173303572c9373f3d1ba3eb8c3f4195e2b`; B = `f2ba7ff96c2432637f208cba4599a26a923cb4cb`; C = HEAD gałęzi `claude/determined-turing-9d9j3h-c` (kod `d49f4f3`, następny commit dodaje tylko ten raport).

## 8. HANDOFF

```
STAN PRAC: GG_UX_FIX — poprawka po odbiorze GPT w C gotowa; A i B zaakceptowane, zsynchronizowane A→B→C. Gotowe do ponownego odbioru GPT.
REPO: klaudiamoscinska-art/vector-hole; A = claude/determined-turing-9d9j3h @ c3c2221 (PR #107 → main); B = -b @ f2ba7ff (PR #108 → A); C = -c @ HEAD (kod d49f4f3, PR #109 → B); origin/main = be583642
TESTY: uxfix-c 35/35 (S: przed 4/8 FAIL, po 8/8 PASS), workshop-buy 73/73, deviceqa1 50/50, instructions 4/4; run-all NOT RUN; urządzenia NOT VERIFIED
ZMIANY: game.js (drawPreviewEatFx: lista cząstek przypisana do efektu; reset przy otwarciu Warsztatu), qa/uxfix-c.mjs S, docs
NIEDOKOŃCZONE: brak
RYZYKA: jak w §5; poprawka bez wpływu na rundę i zapis
NASTĘPNY KROK: ponowny odbiór GPT PR #109; scalanie A → B → C tylko za zgodą właścicielki
PUNKT WZNOWIENIA: ten raport §7; node qa/uxfix-c.mjs --only=S
BEZPIECZNA KONTYNUACJA: preflight; bez merge, publikacji i paczki CrazyGames; nie ruszać main, SAVE v13, workflow, eksportera CG
```
