# GG_UX_FIX_B — Etap B: karty Ewolucji (Skaner, Impuls ssący, Łowca) i karty w HUD

- **Baza tego PR:** gałąź Etapu A `claude/determined-turing-9d9j3h` (PR A). Ten PR pokazuje wyłącznie przyrost B; scalać po A.
- **Gałąź:** `claude/determined-turing-9d9j3h-b`. Zapis v13 bez zmian, bez nowego pola; Arena nadal niezależna od kampanii.
- Zmiany mechaniki Skanera, Fali i Łowcy są autoryzowane w zleceniu; Turbo combo, Magnes, Tarcza i Długie combo — bez zmian wartości (Turbo nie osłabione).

## 1. Co się zmieniło

| Karta | Przed (audyt) | Teraz |
|---|---|---|
| **Skaner** (`scanner`) | Co 4 s „najcenniejszy obiekt na mapie” = zwykle ta sama, odległa, niejadalna wieża T6; pierścień 2 s tylko na ekranie (16% sygnałów jadalnych i na ekranie) | Co 4 s (bez zmian) cel = obiekt, który gracz **może teraz zjeść**, w zasięgu `600 + 6·r` jednostek świata od środka wiru (r 46 → 876, r 118 → 1308 — ok. dwa ekrany telefonu), ocena `wartość / (1 + d/400)`; nigdy Złoty Rdzeń. Znacznik trwa, dopóki cel jest przydatny; poza ekranem — cyjanowa strzałka przy krawędzi (`edgeMarkerPos()`, jak strzałka Złotego Rdzenia). Zjedzony / zniknął / niejadalny / dalej niż 1,25 × zasięgu → nowy wybór od razu; brak celu → brak znacznika. Opis: „Wskazuje cenny obiekt w pobliżu, który już możesz zjeść. Poza ekranem — strzałka przy krawędzi.” |
| **Impuls ssący** (dawniej **Fala**, ID `shockwave`) | Przy awansie rozmiaru odpychał jedzenie (w zasięgu 4 → 0) | Ten sam wyzwalacz (nowy rozmiar). Obiekty **jadalne** do 140 jednostek od **brzegu** wiru są przyciągane o ≤ `70 × (1 − odległość od brzegu / 140)` przez 0,5 s, nigdy bliżej środka niż 0,5·r. Rywale, punkty, wzrost i reguły pochłaniania bez zmian; obiekty niejadalne stoją. Pierścień zamyka się do wiru, smugi pokazują kierunek. Nazwa nie myli się z Finiszem „Fala” (EN „Suction Pulse”). |
| **Łowca** (`bounty_core`) | Celownik na najbliższym rywalu przy wyborze (często większym), bez nowego celu po zjedzeniu; premia schowana w „ZJEDZONY! +N” | Cel tylko spośród rywali, których gracz **może teraz zjeść** (gracz > rywal × 1,15, rywal bez ochrony, na planszy), najbliższy. Urósł / czeka na odrodzenie / zjadł go inny rywal → traci celownik; brak celu → ponowna próba co 1 s. Premia **+40 dokładnie raz** za zjedzenie celu, osobny napis **„+40 ŁOWCA”**, potem nowy cel. |
| **Karty w HUD** | Brak informacji o wybranych kartach | Pod zegarem najwyżej 2 paski (ikona, nazwa, stan). Świecą tylko, gdy efekt działa: Magnes „PRZYCIĄGA” / „POLE ZAKRYTE”, Turbo „+60% PRĘDKOŚCI” / „CZEKA NA COMBO ×3” (dyskretna informacja o przyspieszeniu), Tarcza „OCHRONA n s” z rzeczywistego czasu ochrony / „PO ODRODZENIU”, Długie combo „DŁUŻSZE OKNO”, Skaner „CEL WSKAZANY” / „SZUKA CELU”, Impuls ssący „PRZYCIĄGA” / „CZEKA NA AWANS”, Łowca nazwa celu / „BRAK CELU”. Płytki COMBO / cel znajomego / SZAŁ rysują się pod nimi. PL/EN. |

## 2. Pomiary

**Mikro-sceny FN (ten sam układ z kartą i bez, wirtualny zegar) — `qa/uxfix-b.mjs` część M:**
- Skaner przy r 46: wybrał jadalny obiekt w zasięgu (nie wieżę T6 obok, nie obiekt 1909 dalej); po zjedzeniu celu nowy cel od razu (zegar 4 s nie musiał minąć); bez jadalnego w zasięgu — brak celu; Złoty Rdzeń nigdy.
- Impuls ssący przy awansie T4 → T5, 8 fragmentów przy brzegu: zjedzone w 1 s **0 bez karty → 3 z kartą** (stara Fala: 4 → 0); maks. przesunięcie 44,5 ≤ 70, nikt bliżej niż 0,5 r; wieża i rywal nieruszone.
- Łowca: pominął bliższego, większego rywala; rywal, który urósł, stracił celownik na rzecz jadalnego; zjedzenie celu = punkty za rywala + **40 dokładnie raz** (50 + 40 = 90) z „+40 ŁOWCA”, potem nowy cel; cel zjedzony przez innego rywala — wyczyszczony; brak celu → nowy po ≤ 1 s.
- Turbo combo: +60% (mnożnik 1,6), 1500 ms, próg ×3 — bez zmian; razem ze Skanerem oba paski.
- Tarcza: ochrona po zjedzeniu 4000 ms; pasek „OCHRONA 4 s” → „2 s” → bezczynny.

**Pełne rundy SIM (bot `casual`, 10 ziaren 8100–8109, karta przy 1. ofercie, 2. pominięta, `runsPlayed` 3):** wyniki są powtarzalne co do punktu przy tym samym ziarnie `Math.random` (dwa przebiegi kandydata identyczne), więc różnica baza ↔ kandydat to efekt zmiany, nie szum; mimo to 10 rund to mała próba — to nie dowód balansu.

| Warunek | Baza (Etap A) mediana (min–max) | Kandydat mediana (min–max) | Wskaźnik karty |
|---|---|---|---|
| bez karty | 6608 (1941–8505) | 6608 (1941–8505) | — |
| Skaner | 6608 (3383–8505) | 6608 (3383–8505) | cel jadalny i na ekranie: **21,6 s → 82,9 s** na rundę (bot nie korzysta ze wskazań, więc wynik bez zmian — to oczekiwane) |
| Fala → Impuls ssący | 6025 (3181–8713) | **7481** (2504–10871) | 3,5 impulsu na rundę |
| Łowca | 6132 (3383–8505) | 6367 (3383–8505) | premie: 0,6 na rundę; czas z celem 82,9 s → 107,3 s |
| Turbo combo | 17 297 (7382–24 500) | 17 297 (7382–24 500) | bez zmian (nie osłabiane) |

Ocena: Impuls ssący z karty szkodliwej stał się użyteczną (+24% mediany w tej próbie), Łowca nieco silniejszy, Skaner pomaga tylko graczowi, który patrzy na znacznik. Turbo combo pozostaje zdecydowanie najsilniejsze — świadomie bez zmian.

## 3. Wyniki testów (końcowy kod gałęzi)

FINAL_RESULTS_B

## 4. Materiały

- `design/ux-fix/b-karty-hud.jpg` — paski kart w HUD (375×667, 390×844 EN, 1280×720) i strzałka Skanera przy krawędzi.
- Surowe logi i JSON SIM: `qa/out/final/`, `qa/out/uxfix-b/sim-*.json` (lokalnie).

## 5. Ryzyka

- Skaner nie zmienia wyniku bota (bot go ignoruje) — wartość dla gracza do potwierdzenia w playteście.
- Łowca: przy rzadkich jadalnych rywalach celownik często „BRAK CELU” (uczciwie).
- Impuls ssący zwiększa mediany SIM o ok. 24% w 10 rundach — mała próba; balans do obserwacji.
- NOT VERIFIED: prawdziwe urządzenia, CrazyGames Preview.

## 6. HANDOFF

```
STAN PRAC: GG_UX_FIX_B (Etap B) — gotowe do odbioru; zależne od PR A.
REPO: klaudiamoscinska-art/vector-hole, gałąź claude/determined-turing-9d9j3h-b @ FINAL_SHA_B, baza PR = claude/determined-turing-9d9j3h, PR: PR_B
TESTY: §3 — log: qa/out/final/
ZMIANY: game.js (Skaner, Impuls ssący, Łowca, karty w HUD), index.html (#hud-cards), style.css; qa/uxfix-b.mjs (M, H w run-all; --sim); docs GDD/CHANGELOG/qa README
NIEDOKOŃCZONE: brak w zakresie B
RYZYKA: §5
NASTĘPNY KROK: odbiór; scalenie dopiero po PR A
PUNKT WZNOWIENIA: ten raport; node qa/uxfix-b.mjs; node qa/uxfix-b.mjs --sim=10 [--root=DIR]
BEZPIECZNA KONTYNUACJA: preflight; bez merge i publikacji; nie ruszać main, SAVE v13, workflow, eksportera CG
```
