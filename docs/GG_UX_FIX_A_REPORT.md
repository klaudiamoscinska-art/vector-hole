# GG_UX_FIX_A — Etap A: poprawki i komunikacja (zgłoszenia 1, 2, 3, 6 + opisy kart)

Implementacja po audycie `GG_UX_AUDIT_1` (gałąź audytu `claude/hopeful-brown-4ggvy9` @ `5d5b59ff`, raport `docs/GG_UX_AUDIT_1.md` — nie scalany; materiały „przed” są na tamtej gałęzi w `design/ux-audit-1/`).

- **Baza:** `origin/main` = `be583642233be678aff93953646c1e3625dd622f` (CITY-2, PR #106). Zapis v13, klucz zapisu, PX01, niezależność Areny i kampanii, nagrody i balans — bez zmian. Bez nowego pola w zapisie.
- **Gałąź:** `claude/determined-turing-9d9j3h` (PR do `main`). Etapy B i C są gałęziami zależnymi od tej (kolejność scalania: A → B → C).
- **Rodzaje dowodów:** DOM = prawdziwe kliknięcia / klawisze / mysz w Chromium (Playwright); FN = funkcje gry na ustawionej scenie (wirtualny zegar); SIM = rundy botem `casual`.

## 1. Co się zmieniło

| Zgł. | Problem (audyt) | Nowe działanie |
|---|---|---|
| 1 Dzielnice | Kafelek wyglądał jak „misja Areny”; po 3. rundzie różowe NOWE obok prawdziwych odblokowań → gracz czytał to jako odblokowanie | Kafelek od 1. rundy: **„KAMPANIA · PLAC NEONÓW”**, M01 i — dopóki gracz nie poznał kampanii — linia **„Drugi tryb: misje z celami · otwarty”**. Po 3. rundzie (próg bez zmian): **„DRUGI TRYB · OTWARTY · Kampania: 240 misji · 12 dzielnic · otwarte od początku”**, zielona plakietka **TRYB 2** na kafelku i zakładce (nie NOWE; nowa dzielnica dalej ma NOWE). Wynik Areny — gdy linia „NASTĘPNA RUNDA” byłaby pusta — **„DRUGI TRYB · OTWARTY · Dzielnice: 240 misji z celami · wejdź z Miasta”**. Wszystko znika po pierwszej wizycie w Dzielnicach (istniejący znacznik `kampania`). Bez okna, bez „ODBLOKOWANO”, wejście możliwe od 1. rundy. |
| 2 Sterowanie | Wybór schowany za STEROWANIE w pauzie i ~480 px w dół w Profilu; w Mysz klawisze sterowały, a wir wracał do kursora | **Decyzja: tryby rozłączne.** Mysz: ruch tylko myszą (WASD/strzałki nie sterują; Enter, P/Spacja/Esc, Tab działają). Klawiatura: tylko klawisze. Dotyk niezależnie. **„Sterowanie na Arenie”** od razu w pauzie Areny (nad ZACZNIJ OD NOWA) i jako **pierwszy wiersz Ustawień** w Profilu (koło zębate), z podpowiedzią trybu. Pauza misji → STEROWANIE: „W misjach sterujesz myszą albo klawiszami. Wybór Mysz / Klawiatura dotyczy Areny.” Telefon: bez wyboru. Laptop dotykowy: oba wiersze, palec steruje zawsze. |
| 3 „Załóż” | CTA otwierał ostatnią zakładkę (domyślnie WIR), nic nie zakładał | Pojedynczy przedmiot (Core City LVL 2–5, Wir „Aurora Finału”): **ZAŁÓŻ** = ta sama ścieżka co dotknięcie karty (`onCosmeticPick()` → `onEquipClick()`), właściwa zakładka, karta oznaczona **NAGRODA**, przewinięta do widoku (bez przewijania strony pod grą), potwierdzenie „Założono: Smuga „Impuls””. Zestaw LVL 6: **POKAŻ W WARSZTACIE** — 4 części oznaczone, zielone kropki na zakładkach, nic nie zakładane. Karta bez wyglądu (nowy utwór) — bez przycisku (wcześniej „ZAŁÓŻ W WARSZTACIE”). Drugie naciśnięcie nic nie robi. |
| 6 Ranking | Ostrzeżenie stałe 260 od środka — rywal r ≥ 347 zjadał bez ostrzeżenia; lider punktowy bywał mniejszy bez wyjaśnienia | Ostrzeżenie od **zasięgu zjedzenia** rywala: zaczyna się `140 + 0,4·r_rywala` jednostek świata przed `0,75·r_rywala` (`rivalThreat()`, `CONFIG.juice.danger`). Groźny rywal: **czerwona nazwa ze znakiem** na planszy i **trójkąt w panelu PUNKTY** przy jego wierszu. Jedno bicie serca na kilku rywali (najwyżej co 4 s), ponowne dopiero po oddaleniu na 1,25 × wyprzedzenia; brak dźwięku w ochronie po odrodzeniu; rywal czekający poza planszą nie jest zagrożeniem. Raz na sesję (pamięć, bez zapisu), gdy gracz prowadzi obok takiego rywala: „Miejsce zależy od punktów, nie rozmiaru. Wir z czerwonym znakiem jest większy — może Cię zjeść.” |
| 4 (opisy) | Magnes „CAŁĄ RUNDĘ”, Turbo „na 1,5 s”, Tarcza niejasna | **Tylko teksty, wartości bez zmian.** Magnes: tag „SŁABNIE, GDY ROŚNIESZ”, opis „…Duży wir zakrywa pole.” + jednorazowy napis „MAGNES: wir zakrył pole”. Turbo combo: „Od combo ×3 każdy kęs daje +60% prędkości na 1,5 s i odnawia ten czas.” (tag „OD COMBO ×3”). Tarcza: „Nie chroni przed zjedzeniem: po odrodzeniu masz 4 s ochrony zamiast 2 s.” (tag „PO ODRODZENIU”). Długie combo: opis zgodny z działaniem i z paskiem combo (bez zmian). |

**Magnes — znaczenie granicy 160 (KOD):** to promień pola liczony **od środka wiru**, nie zasięg poza brzegiem. Wir połyka obiekt, gdy jego środek jest bliżej niż `0,85·r + 0,3·r_obiektu`, więc pole wystaje poza „paszczę” o `160 − 0,85·r`: przy r 30 ok. 135, przy r 90 (T5) ok. 85, przy r 118 (T6) ok. 60, od r ≈ 160 karta nic nie robi (pierścień znika, teraz także napis). Zasięgu nie zmieniałam (wymaga osobnej decyzji).

## 2. Wyniki testów (końcowy kod gałęzi)

Kod testowany: `c56851b` (ostatni commit z kodem/testami; późniejsze commity tej gałęzi zmieniają tylko raport i materiały). Ta sama maszyna, Chromium z Playwright.

| Zestaw | Rodzaj | Wynik | Uwagi |
|---|---|---|---|
| `qa/uxfix-a.mjs` (nowy: D, K, R, W) | DOM + FN | **PASS 81/81** | Dzielnice, sterowanie, nagrody, ostrzeżenia |
| `qa/arena-fix1.mjs` | DOM | **PASS 62/62** | C4 zaktualizowane do decyzji (Mysz bez WASD) |
| `qa/responsive.mjs` | DOM | **PASS 552/552** | wszystkie ramki Poki / CrazyGames / telefon / tablet / desktop |
| `qa/ftue1.mjs` | DOM + FN | **PASS 78/78** | EN zaktualizowane (SECOND MODE · OPEN, MODE 2) |
| `qa/ftue3.mjs` | DOM + FN | **FAIL 25/26** | ten sam FAIL na bazie `be58364` (tekst LVL 7 po CITY-2) — niezwiązany |
| `qa/flow.mjs` | DOM | **PASS 35/35** | jedna akcja na ekranie 375×667 |
| `qa/v22.mjs` | DOM + FN | **PASS 49/49** | dwa tryby, bez energii |
| `qa/ui2.mjs` | DOM | **PASS 109/109** | Miasto, Dzielnice, Warsztat, wyniki, nawigacja |
| `qa/ui1.mjs` | DOM | **PASS 20/20** | HUD |
| `qa/workshop-buy.mjs` | DOM | **PASS 73/73** | Warsztat: kupno, podgląd |
| `qa/ux3.mjs` | DOM + FN | **PASS 42/42** | C7 i V1 zaktualizowane (Mysz / Klawiatura; warstwy wiru) |
| `qa/deviceqa1.mjs` | DOM | **PASS 50/50** | |
| `qa/city2.mjs`, `qa/v17.mjs`, `qa/features.mjs` | DOM + FN | **PASS** (city2 76/76, v17 12/12, features bez FAIL) | |
| `qa/crazygames-basic1.mjs` | DOM (lokalna ramka, nie Preview) | **FAIL** — 3 kontrole Pointer Lock + crash kroku | identycznie na bazie `be58364` (headless) |
| `qa/v19.mjs` (EN) | DOM | **PASS 16/16** | |
| `qa/design.mjs` (paleta, język neutralny płciowo) | statyczne + DOM | **PASS 29/29** | |
| `qa/save-safety.mjs` | FN | **PASS 107/107** | zapis v13, PX01 |
| `qa/px02-isolation.mjs` | FN | **PASS 95/95** | niezależność trybów, brak przewagi w Arenie |
| `qa/leave-run.mjs` | DOM + FN | **PASS 22/22** | |
| `qa/instructions.mjs` | statyczne | **PASS 4/4** | |
| `qa/balance1.mjs --quick` | SIM | **PASS 19/19** | ekonomia bez zmian |
| `qa/run-all.mjs` | — | **NOT RUN** | zakres pokryty wybranymi zestawami powyżej |

Uwaga o świeżości: `uxfix-a`, `responsive`, `arena-fix1`, `ftue1`, `ftue3`, `v19`, `design`, `instructions` — na `c56851b`; pozostałe na `dbdf379`/`50aaecc` (późniejsze zmiany: kontrole testowe, wiersz sterowania w układzie compact, krótsze opisy kart — pokryte przez `responsive` i `uxfix-a` na `c56851b`).

## 3. Różnice względem bazy i znane FAIL-e

- `qa/ftue3.mjs`: baza 25/26 i kandydat 25/26 — ten sam FAIL („past LVL 6 the coin + prism bonus”: po CITY-2 tekst LVL 7 to „Drugi brzeg LVL 8 …”) — istniał przed zmianami, niezwiązany.
- `qa/crazygames-basic1.mjs`: baza i kandydat — te same 3 FAIL-e Pointer Lock („follows the locked pointer”, „stops at the frame”, „pause clickable with the locked pointer”) i ten sam crash kroku `pointerLockChecks` w headless Chromium. Dwa FAIL-e, które pojawiły się tylko u kandydata (WASD w ramce, puszczenie klawisza po kliknięciu portalu), wynikały ze starego założenia „WASD w trybie Mysz” — kontrole ustawiają teraz Klawiaturę (to sprawdza ich cel). **Pointer Lock w prawdziwej przeglądarce: NOT VERIFIED** (headless nie blokuje kursora także na bazie).
- Zaktualizowane kontrole (zamierzona zmiana, nie ukrywanie regresji): `qa/arena-fix1.mjs` C4 (Mysz: klawisz nie steruje), `qa/ftue1.mjs` EN (SECOND MODE · OPEN, MODE 2), `qa/responsive.mjs` (strzałki w ramce: Mysz nic, Klawiatura steruje), `qa/ux3.mjs` C7 (to samo) i V1 (porównanie warstw wiru w `drawBody()` — zmieniła się tylko etykieta nazwy pod wirem).
- Dwie regresje znalezione w trakcie i naprawione: pauza 640×360 wypychała „WYJDŹ DO MIASTA” poza ekran (wiersz w jednej linii w układzie compact) oraz dłuższe opisy kart wypychały POMIŃ na 320×568 (opisy skrócone) — `responsive` 23/23 na tych ramkach (baza 22/22, kandydat ma 1 kontrolę więcej).

## 4. Materiały

- `design/ux-fix/a-dzielnice.jpg` — Miasto 375×667: po 1. rundzie, po 3. rundzie (TRYB 2), po wizycie w Dzielnicach.
- `design/ux-fix/a-sterowanie.jpg` — 1280×720: pauza Areny, Profil (bez przewijania), pauza misji.
- `design/ux-fix/a-nagroda-zaloz.jpg` — 375×667: ZAŁÓŻ (Smuga „Impuls” założona, karta NAGRODA w widoku), zestaw Pryzmat (POKAŻ W WARSZTACIE).
- `design/ux-fix/a-ranking-zagrozenie.jpg` — 1280×720: lider punktowy obok większego rywala (czerwona nazwa, trójkąt w PUNKTY, podpowiedź).
- „Przed”: `design/ux-audit-1/` na gałęzi audytu. Surowe logi: `qa/out/final-a/` (lokalnie, ignorowane przez git).

## 5. Ryzyka i ograniczenia

- Mysz nie przyjmuje już WASD (decyzja właścicielki) — gracz przyzwyczajony do mieszania musi wybrać Klawiaturę.
- Znak zagrożenia jest uczciwy, ale na starcie rundy przy wyższej trudności (boty startują z r do 24, gracz 18) kilku rywali bywa oznaczonych naraz.
- Wskazanie Dzielnic w linii wyniku pojawia się tylko, gdy linia byłaby pusta (pierwszeństwo mają odblokowania i bliska nagroda Core City) — kafelek w Mieście mówi o trybie zawsze.
- Karta zakupu Pakietu startowego (demo IAP, Smuga „Zorza Startu”) pozostaje bez przycisku — bez zmian.
- Etykieta „NAGRODA ZA M60” przy Aurorze Finału vs `unlockSource: M24` w danych — stan sprzed etapu, nie zmieniany.
- NOT VERIFIED: prawdziwy telefon, laptop dotykowy (emulacja: CDP touch + media query myszy), CrazyGames Preview (lokalna ramka nie jest Preview).

## 6. HANDOFF

```
STAN PRAC: GG_UX_FIX_A (Etap A) — gotowe do odbioru; zgłoszenia 1, 2, 3, 6 + opisy Magnes/Turbo/Tarcza. Zgłoszenia 4 i 5 domykają Etapy B i C.
REPO: klaudiamoscinska-art/vector-hole, gałąź claude/determined-turing-9d9j3h @ kod c56851b (HEAD = commit raportu), baza origin/main = be583642233be678aff93953646c1e3625dd622f, PR: https://github.com/klaudiamoscinska-art/vector-hole/pull/107
TESTY: patrz §2 — log: qa/out/final-a/
ZMIANY: game.js, index.html, style.css; qa/uxfix-a.mjs (nowy, w run-all); qa/arena-fix1, ftue1, responsive, ux3, crazygames-basic1 (decyzja Mysz/Klawiatura); docs GDD/CHANGELOG/qa README; design/ux-fix/a-*.jpg
NIEDOKOŃCZONE: brak w zakresie A
RYZYKA: §5
NASTĘPNY KROK: odbiór GPT + decyzja właścicielki o scaleniu PR A; potem PR B (baza = ta gałąź), potem PR C
PUNKT WZNOWIENIA: ten raport; testy: node qa/uxfix-a.mjs
BEZPIECZNA KONTYNUACJA: preflight; nie ruszać main, SAVE v13, workflow ani eksportera CrazyGames; bez merge i publikacji
```
