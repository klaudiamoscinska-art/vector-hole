# GG-UI-02 / ETAP 1 — Premium Game Experience: projekt Miasta, Dzielnic, Warsztatu i nagród

**Werdykt: GG-UI-02 / ETAP 1 — READY FOR OWNER & GPT ART REVIEW**

Baza: `origin/main` = `1395c18814f4b775850d39b45859908e4c552704` (GG-UI-01, PR #100), zweryfikowana przed pracą.
Gałąź: `claude/funny-tesla-kjrbsc`. Zakres: wyłącznie projekt. `game.js`, `style.css`, `index.html` są
bajt w bajt równe bazie (QA Q1). Nic nie zostało scalone ani opublikowane, PR nie został otwarty.

Galeria: `design/ui2/gallery.html` (w repozytorium, obrazy obok) · prywatny artefakt Claude — link w HANDOFF.

## Jak powstały makiety

- Każdy kadr to prawdziwa gra z bazy, uruchomiona lokalnie na odizolowanym profilu (osobny kontekst
  przeglądarki, własny `localStorage`); żaden zapis gracza nie był dotykany.
- Scenę ustawiają funkcje samej gry (`openCampaignScreen()`, `openMissionBriefing()`, `finalizeRun()` przez
  rundę bota, `openFreeChest()`, `maybeShowLoginReward()`…), z zamrożoną datą i seedowanym `Math.random`.
- PRZED, A i B są zdejmowane **z tej samej strony, po kolei**: najpierw zrzut gry, potem do strony
  dodawany jest arkusz wariantu (`variants/a.css`, `variants/b.css`) i — tylko w B — przebieg DOM
  (`variants/b.js`), który dokłada elementy prezentacyjne z danych gry. Stan nie może się różnić z
  konstrukcji; dodatkowo sprawdza to QA Q2 (65/65 scen × kadr).
- Trzy profile testowe (`tools/ui2-scenes.mjs`, zbudowane z `defaultSave()`): **nowy** (pierwsze
  uruchomienie, potem jedna prawdziwa runda bota), **środek** (Core City LVL 3 · 46%, 1240 monet,
  18 pryzmatów, poziom 7, 29/240 misji, Plac i Park ukończone, Port przed bossem, nagrody LVL 2–3 w
  posiadaniu), **LVL 6** (5320 monet, 64 pryzmaty, poziom 19, 124/240 misji, komplet „Pryzmat”).
- Żadnych obrazów AI, żadnych nowych obiektów, walut, kosmetyków ani nagród.

## 1. Audyt obecnych ekranów

| Ekran | Co działa | Co odstaje od Areny / HUD GG-UI-01 |
|---|---|---|
| Miasto | Jedna oczywista akcja (GRAJ), miasto rośnie z postępem, wszystko mieści się na 390×844 | Miasto zamknięte w ramce jak obrazek; LVL to mała pigułka; postęp to cienki pasek bez obrazu całej drogi LVL 1–6; kafle Kampanii i Wyzwania dnia wyglądają jak zwykłe wiersze; panele mają stary, jednolity materiał |
| Dzielnice | Karta następnej misji z własnym GRAJ, opowieść NELA, lista misji z gwiazdkami | Widać 2,5 z 12 dzielnic (pasek przewijany); zablokowane dzielnice to prawie czarne kafle; brak licznika całej kampanii; bieżąca misja na liście nie wyróżnia się; cel bossa wygląda jak zwykły cel; **320×568: GRAJ pod nawigacją** |
| Odprawa | Cele z ikonami = obiektami planszy (zasilacz, dźwig — zgodne), wzmocnienia z saldem, GRAJ na dole | Ten sam materiał co lista; boss nieoznaczony |
| Warsztat | Podgląd rysowany tym samym `Hole.draw()` co w rundzie, cztery kategorie, ceny i źródła nagród | Karty to wiersze tekstu z małym wirem; status to sam napis „ZAŁÓŻ / ZAŁOŻONE”; posiadane, drogie i nagrodowe różnią się głównie przezroczystością; w grze **nie ma systemu rzadkości** (patrz §3) |
| Wynik Areny | Kolejność: wynik → rozmiar i miejsce → zapowiedź → nagrody → ranking → akcje; pasek akcji przyklejony | Wynik bez „sceny”; trzy nagrody jedna pod drugą w jednej karcie; ranking bez podium |
| Wynik misji | Gwiazdki, warunki gwiazdek, NELA, następna misja z GRAJ | Gwiazdki bez oprawy; kafle w starym materiale |
| Karty nagród (Core City, skrzynia, dzielnica, kosmetyk) | Animacja zamka i promieni, jasny tytuł | Treść wisi na pustym tle, bez ramy karty; wygląd identyczny dla każdego typu nagrody |
| Nagroda dzienna | Siatka 7 dni czytelna | Ptaszki odebranych dni nachodzą na kwoty (zastane) |
| Wyzwania | Mapa dnia, licznik, seria | Spójne z resztą po przejęciu wspólnych materiałów; własna kompozycja jest w porządku |
| Profil | Formularz i ustawienia | Ekran narzędziowy — wystarczą wspólne materiały |

Zastane drobiazgi zauważone przy okazji (nie poprawiane): na 320×568 podtytuł karty miasta nachodzi na
plakietkę „NOWY BUDYNEK”; kod misji w interfejsie (np. M30) różni się od wewnętrznego id (M12) — to
znane i celowe (kolejność dzielnic), odnotowane tylko dla GPT.

## 2. Kierunki A i B

**Wspólne (oba kierunki):** tokeny rodziny HUD (`--gh-plate`, `--gh-edge`, `--gh-quiet`, `--gh-hair` →
`--u2-*`): płyta z krawędzią cyjan → fiolet → róż dla paneli głównych, ciemne szkło z cienką linią dla
pomocniczych, złota krawędź dla nagród i zakupów; te same kroje (Russo One / Exo 2); kolor tylko tam,
gdzie coś znaczy (cyjan = Twoje / aktywne, złoto = nagroda / cena, zieleń = ukończone / źródło-nagroda,
róż = zagrożenie / boss). Bez `backdrop-filter` (jak w HUD).

### A — Premium Evolution (tylko CSS, układ bez zmian)

- Miasto: karta miasta z krawędzią HUD, pasek postępu w barwach wiru, GRAJ z mocniejszą obwódką, kafle
  trybów z kolorowym akcentem, skrzynia w złotej ramie.
- Dzielnice: wyraźne stany kafli (ukończona = zielony status, bieżąca = rama w kolorze dzielnicy,
  zablokowane = odbarwione), bieżąca misja na liście w złotej ramie, złote gwiazdki; na niskich
  ekranach GRAJ przypięty nad nawigacją (naprawa problemu 320×568).
- Warsztat: statusy jako pigułki (ZAŁÓŻ / ZAŁOŻONE / cena / źródło nagrody), złota krawędź dla skórki,
  na którą gracza stać, zakładki w materiale HUD.
- Wyniki: wynik z gradientem, karta nagród z krawędzią, gracz w rankingu w ramie HUD; karta nagrody w
  ramie koloru nagrody.

### B — Premium Experience (CSS + przebudowa kompozycji)

- **Miasto:** panorama Core City staje się tłem ekranu (bez ramki, od krawędzi do krawędzi); herb LVL;
  **szyna LVL 1–6** (osiągnięte węzły, bieżący poziom z realnym postępem — ta sama logika co drabinka
  T1–T6 w HUD); kapsuła „Następna nagroda” z ikoną kategorii i dużym procentem; GRAJ z emblematem wiru;
  kafle Kampanii i Wyzwania dnia jako karty z nagłówkiem-pasem; nawigacja jako pływający dok.
- **Dzielnice:** wszystkie **12 dzielnic naraz** w siatce 4×3 (numery 01–12, znacznik ukończenia /
  postępu „9/10” / kłódki, następna z przerywaną ramką), liczniki „Odbudowane dzielnice 2/12” i „Misje
  29/240”; nagłówek dzielnicy w jej kolorze; lista misji jako **trasa** z węzłami; **wiersz bossa** z
  plakietką BOSS i większą ikoną; GRAJ przypięty w karcie.
- **Warsztat:** scena podglądu z siatką, **plakietka statusu** przy nazwie (WYPOSAŻONE / POSIADANE / DO
  KUPIENIA / ZA MAŁO MONET / NAGRODA), zakładki jako jeden przełącznik, **karty kolekcjonerskie** 3 w
  rzędzie (duży wir, nazwa, pigułka statusu lub ceny) ze znakiem źródła w rogu.
- **Wyniki:** wynik na własnej scenie, rozmiar i miejsce jako pigułki, monety i XP jako dwa kafle obok
  siebie, Core City jako szeroka karta, ranking z podium (złoto / srebro / brąz); gwiazdki misji na
  płycie; **karta-trofeum** dla nagród (wstążka z tytułem zdarzenia w kolorze nagrody, plakietka źródła).

## 3. Zgodność z grą — co jest prawdziwe, a co wymaga decyzji

- Ceny, waluty, saldo, własność, kolejność misji i odblokowań, kolejność elementów wyniku, przyciski
  i reguły reklam: bez zmian (te same węzły DOM gry, tylko inaczej ułożone i pomalowane).
- **Pierwszy wynik Areny (FTUE):** makiety A i B zachowują komplet zasad — brak „×2 za reklamę”,
  „Menu główne” zamiast „Wróć do Miasta”, zapowiedź Warsztatu, plakietka „BONUS NOWICJUSZA ×1,5”.
- **Rzadkość kosmetyków:** w danych gry jej nie ma (`SKINS`, `AURAS`, `EAT_EFFECTS`,
  `OVERDRIVE_SKINS` mają tylko cenę, walutę i `unlockSource`). Makieta B pokazuje więc **źródło**
  (start / monety / pryzmaty / nagroda), a nie wymyślone stopnie rzadkości. Prawdziwa rzadkość to nowy
  system — decyzja właścicielki, poza GG-UI-02.
- **Nowe napisy w makiecie B** (wymagałyby wpisów `I18N_EN` przy wdrożeniu): „ODBUDOWANE DZIELNICE”,
  „MISJE” (liczniki), „BOSS”, „WYPOSAŻONE”, „POSIADANE”, „DO KUPIENIA”, „ZA MAŁO MONET”, „NAGRODA”.
  Wariant A nie dodaje żadnego napisu.
- Wygląd wirów, smug i efektów: bez zmian — podglądy rysuje gra.

## 4. Sceny (wszystkie w galerii, iPhone 390×844, PRZED / A / B)

| # z promptu | Scena | Plik (`shots/<id>-iphone-<wariant>.jpg`) |
|---|---|---|
| 1 | Miasto, nowy profil po pierwszej rundzie (+ ekran powitalny) | `m1-early`, `m0-welcome` |
| 2 | Core City LVL 3 · 46% | `m2-mid` |
| 3 | Core City LVL 6 | `m3-max` |
| 4 | Lista 12 dzielnic | `d1-list` |
| 5 | Wybór aktualnej misji | `d2-current` |
| 6 | Dzielnice ukończone i zablokowane (+ arkusz zablokowanej) | `d3-states`, `d5-locked` |
| 7 | Odprawa misji z bossem (Port Syntez: zasilacze + dźwig) | `d4-briefing-boss` |
| 8 | Lista skórek wirów | `w1-skins` |
| 9 | Wybrana i wyposażona skórka | `w2-equipped` |
| 10 | Skórka do kupienia / zablokowana (nagroda) | `w3-buy`, `w4-locked` |
| 11 | Inna kategoria: SMUGA | `w5-auras` |
| 12 | Wynik pierwszej Areny | `r1-first-arena` |
| 13 | Wynik późniejszej Areny | `r2-later-arena` |
| 14 | Wynik ukończonej misji | `r3-mission` |
| 15 | Nagroda Core City (wynik z awansem + karta nagrody) | `r4-core-level`, `r5-core-reward` |
| 16 | Skrzynia / odblokowanie (+ nagroda dzienna, odblokowanie dzielnicy) | `r6-chest`, `r7-login`, `r8-district-unlock` |
| dodatkowe | Droga nagród Core City, Wyzwania, Profil | `m4-roadmap`, `x1-wyzwania`, `x2-profil` |

Rozdzielczości: pięć scen kluczowych (Miasto LVL 3, lista Dzielnic, odprawa z bossem, Warsztat, wynik
Areny) × 320×568, 360×800, 800×450, 844×390, 1366×768, 2560×1440 × trzy warianty. EN: te
same sceny na 390×844 i 320×568. Razem 195 kadrów, wartości każdego w `shots/facts.json`.

## 5. Ocena i rekomendacja

Skala 1–5 (5 = najlepiej; przy koszcie i ryzyku 5 = najtaniej / najbezpieczniej).

| Kryterium | A | B | Uwagi |
|---|---|---|---|
| Jakość wizualna | 3,5 | 4,5 | B daje ekranom własną kompozycję; A to wyraźnie lepsze materiały |
| Poprawa względem obecnej wersji | 3 | 4,5 | A bywa subtelne (Miasto, wynik misji) |
| Atrakcyjność dla nowego gracza | 3 | 4,5 | Miasto-panorama i szyna LVL tłumaczą cel gry obrazem |
| Czytelność na telefonie | 4,5 | 4 | B: karty 3 w rzędzie i kafle dzielnic 83 px mają mniejsze napisy (min. 8,5–9,5 px) |
| Spójność z HUD | 4,5 | 4,5 | te same tokeny; szyna LVL = drabinka T1–T6 |
| Czytelność nagród i cen | 4 | 4,5 | pigułki cen w obu; B dodaje plakietkę statusu przy podglądzie |
| Ergonomia | 4,5 | 4 | B: GRAJ w Dzielnicach niżej (702 px zamiast 511 px na 844) — nadal nad nawigacją |
| CrazyGames 800×450 | 4,5 | 4 | B na poziomych układach korzysta z siatki gry; pływający dok tylko w pionie |
| Koszt wdrożenia | 4,5 | 2,5 | A: sam CSS; B: zmiany w `index.html` i w funkcjach renderujących `game.js` |
| Ryzyko regresji | 4,5 | 3 | B rusza `qa/flow`, `qa/responsive`, `qa/v19` (nowe napisy), kotwice FTUE |

**Rekomendacja: hybryda, per ekran.**

| Ekran | Wybór | Dlaczego |
|---|---|---|
| Miasto | **B** | Największy zysk całego etapu; panorama + szyna LVL 1–6 + kapsuła nagrody. Kafle trybów z B. |
| Dzielnice (telefon pionowo) | **B** | 12 dzielnic naraz i trasa misji to realna poprawa orientacji; liczniki 2/12 i 29/240. |
| Dzielnice (poziomo / desktop) | **A + elementy B** | Gra ma tam już siatkę 3×4; wystarczą znaczniki stanu, trasa misji i wiersz bossa. |
| Odprawa | **B** | Nagłówek w kolorze dzielnicy i wiersz BOSS; układ bez zmian. |
| Warsztat | **B, z jedną korektą** | Karty kolekcjonerskie i plakietka statusu. Korekta: opis wyglądu („Kryształowe ściany”) zostaje widoczny przy podglądzie — w siatce jest ukryty. |
| Wynik Areny | **A + kafle nagród z B** | Wynik to ekran „jeszcze jedna runda” — ma być szybki; scena z B jest ładna, ale pigułki rozmiaru / miejsca są mniej czytelne niż obecne kafle. Dwa kafle (monety, XP) + szeroka karta Core City z B skracają ekran. |
| Wynik misji | **B** | Gwiazdki na płycie; reszta jak A. |
| Karty nagród i odblokowań | **B** | Karta-trofeum ze wstążką; kolor = typ nagrody. |
| Nagroda dzienna, arkusze informacyjne | **A** | Wystarczą materiały; przy okazji poprawić ptaszki nachodzące na kwoty. |
| Nawigacja | **A** (dok z B do decyzji) | Pływający dok jest efektowny, ale zabiera 8 px wysokości i wymaga ponownego sprawdzenia safe-area; pasek z A jest pewny. |
| Wyzwania, Profil | wspólne materiały | bez własnego projektu w etapie 2 |

## 6. Responsive i dwa znane problemy

**Problem 1 — Dzielnice na 320×568: GRAJ pod nawigacją. Błąd interfejsu (potwierdzony).**
Pomiar (`responsive-audit.json`): karta następnej misji zaczyna się na 216 px, a jej przycisk GRAJ
zajmuje 541–600 px przy wysokości okna 568 px i nawigacji od 506 px — przycisk jest w całości zakryty.
Przyczyna: karta z dwoma celami, modyfikatorem, czasem, nagrodą i trzema warunkami gwiazdek ma ok. 384 px,
a nad nawigacją zostaje 290 px. Od 360×640 w górę przycisk jest widoczny (511–570 px).
Rozwiązanie pokazane w makietach A i B: na niskich ekranach GRAJ jest przypięty do dołu przewijanego
obszaru (`position: sticky`), 426–484 px, klikalny (QA Q8a). Przy wdrożeniu warto dodatkowo zwinąć
wiersz gwiazdek do jednej linii, żeby przycisk niczego nie zasłaniał.

**Problem 2 — 2560×1440 „layer not visible”: niestabilny test, nie błąd nakładania.**
- Bezpośredni pomiar (3 świeże uruchomienia × Miasto, Dzielnice, odprawa): za każdym razem widoczne są
  dokładnie właściwe warstwy (`mainMenu`; `campaignScreen`; `campaignScreen` + `missionBriefing` z
  `z-index` 130 nad 100), skala interfejsu 1,6, układ `wide` (QA Q8b).
- `qa/responsive.mjs` czeka stałe 400–600 ms i uznaje warstwę za niewidoczną, gdy jej `opacity` = 0.
  Animacja wejścia ekranu trwa nominalnie 340 ms, ale w headless Chromium z renderowaniem programowym
  klatka 2560×1440 zajmuje 100–190 ms: pełną widoczność warstwa osiąga po **652–1150 ms** (6–8 klatek),
  a po 543 ms bywa jeszcze na `opacity` 0 (`responsive-anim-timing.json`; dla porównania 390×844:
  374–435 ms, 1366×768: ok. 500 ms).
- Przebieg na bazie (`responsive-base-run.txt`): 512/526; 13 z 14 błędów to „layer not visible” /
  „main action missing” na 1280×720 – 2560×1440 i 768×1024, inne ekrany niż w raporcie GG-UI-01
  (część przebiegu szła równolegle z renderowaniem makiet, co wydłużało klatki) — czyli szum czasowy.
  Jedyny stały błąd to problem 1.
- Wniosek dla etapu 2: (a) w teście czekać na koniec animacji (`getAnimations()`), nie stały czas;
  (b) w interfejsie nie zaczynać ekranu od `opacity: 0` na całej warstwie — animować sam ruch albo
  startować od stanu widocznego; (c) tła nowych paneli bez `backdrop-filter` i dużych rozmyć.
- **NOT VERIFIED:** zachowanie na fizycznym monitorze 2560×1440 z GPU.

Pozostałe kadry: 320×568, 360×800, 800×450, 844×390, 1366×768, 2560×1440 — w galerii (filtr
„Rozdzielczości”). Zachowane: `uiScale`, `100dvh`, safe-area, układy `wide` / `compact`, przewijanie we
własnych obszarach. Na poziomych układach B celowo nie zmienia siatki gry.

## 7. Proponowany zakres ETAPU 2 (wdrożenie)

Kolejność według zysku i ryzyka; każdy krok osobno testowalny.

1. **Tokeny i materiały** (`--u2-*` obok `--gh-*`), portfel, przyciski, nawigacja — sam CSS.
2. **Miasto B**: panorama, herb LVL, szyna LVL 1–6 (nowy węzeł renderowany z `save.hub`), kapsuła
   nagrody, kafle trybów. `drawCityScene()` bez zmian.
3. **Dzielnice**: siatka 4×3 w pionie, znaczniki stanu, liczniki, trasa misji, wiersz bossa, naprawa
   320×568.
4. **Warsztat**: karty kolekcjonerskie, plakietka statusu, przełącznik kategorii.
5. **Wyniki i nagrody**: kafle nagród, gwiazdki, karta-trofeum, kalendarz.
6. **Test**: poprawka czekania w `qa/responsive.mjs`, nowa suita `qa/ui2.mjs` (stany kafli, statusy
   kosmetyków, kolejność wyniku, FTUE pierwszego wyniku, 320×568), `qa/v19.mjs` dla nowych napisów.

Poza zakresem etapu 2: system rzadkości, nowe nagrody, zmiana kolejności wyniku, Wyzwania i Profil
(tylko wspólne materiały), kierunek obrotu wiru (osobny etap — §9).

## 8. Ryzyka

- B zmienia strukturę ekranów, na których opierają się `qa/flow.mjs`, `qa/responsive.mjs`,
  `qa/ftue1.mjs`, `qa/ftue3.mjs`, `qa/workshop-buy.mjs` — trzeba je przejść na bazie i kandydacie.
- Karty Warsztatu 3 w rzędzie: napisy 8,5–9,5 px przy 320 px szerokości — do sprawdzenia na telefonie.
- Miasto B na 320×568 zostawia panoramie ok. 200 px; szyna LVL musi tam zostać czytelna (kadr
  `m2-mid-p320-b`).
- Nowe napisy wymagają `I18N_EN` i kontroli długości EN.
- Makiety nadpisują style z zewnątrz (`!important`, wysoka specyficzność). To technika podglądu, nie
  wzorzec wdrożenia — w etapie 2 reguły trzeba wpisać w miejsce starych, tak jak w GG-UI-01.
- Wydajność menu na dużych ekranach nie była mierzona (NOT RUN).

## 9. Kierunek obrotu wiru — audyt i podgląd

**Obecne rozwiązanie.** `Hole.draw()` składa wir z gotowych warstw (`stampHoleLayer()`), każda obracana
kątem `T × look.spin[k]`. Tablica `spin = [spód, wnętrze, obręcz, korona]` (rad/s, znak = kierunek) jest
zapisana osobno dla każdego z 10 wyglądów w `HOLE_LOOKS` — np. Horyzont `[1.5, 2.6, -1.5, 0]`, Cyjan
`[1.1, -1.9, 0.5, -0.9]`. Czyli **warstwy już dziś kręcą się częściowo przeciwbieżnie**, różnie w
każdej skórce. Poza warstwami ruch mają jeszcze:

| Element | Kod | Kierunek dziś |
|---|---|---|
| Pyłki dysku akrecyjnego | `drawAccretionDisk()` | zawsze zgodnie z zegarem |
| Warstwa „flow” (materia wpadająca) | `Hole.draw()` | jak spód wiru |
| Cząstki pochłaniania („suck”) | `Particle.update()` | zawsze przeciwnie do zegara |
| Połykany obiekt (spirala do środka) | `beginSwallow()` → `swSpin` | **losowo**: połowa obiektów w lewo, połowa w prawo (znak z pozycji obiektu) |

Wniosek: wir nie ma jednego kierunku — a materia wpada do niego w połowie przypadków „pod prąd”.

**Warianty (prawdziwe klatki gry, ta sama seedowana runda; `vortex/`).**

| Wariant | Zmiana | Ocena |
|---|---|---|
| W0 — obecny | — | punkt odniesienia |
| W1 — pełne odwrócenie | cały wir w odbiciu lustrzanym (ramiona nadal ciągną się za obrotem) + cząstki | To ten sam wir w lustrze: nie wygląda ani lepiej, ani gorzej, nie zmienia odczucia zasysania. Odwrócenie samych prędkości bez lustra byłoby gorsze — ramiona „rozwijałyby się”, jakby wir wypluwał. |
| **W2 — spójny lej** | wygląd wiru bez zmian; połykane obiekty i cząstki zawsze wirują zgodnie z ramionami | Wyraźnie mocniejsze zasysanie: obiekt i cząstki spływają jednym nurtem. Czytelność wiru bez zmian, nie gryzie się z efektami GG-VFX-01 (to ich kierunek się porządkuje). Pasuje do Premium Neon Vector. |
| W3 — tylko wir gracza | wir gracza w lustrze, rywale jak dziś | Różnica niemal niewidoczna w ruchu; nie pomaga odróżnić gracza (od tego jest kolor, nazwa i korona). |

Ocena według pytań: lepiej / gorzej — W1 i W3 bez różnicy, W2 lepiej; zasysanie — tylko W2 je poprawia;
czytelność — żaden wariant jej nie osłabia; zgodność z efektami pochłaniania — W2 ją poprawia, W1 bez
porządkowania kierunków tylko przenosi niespójność na drugą stronę; styl — wszystkie zgodne.

**Trudność techniczna.**

| Wariant | Trudność | Zakres |
|---|---|---|
| W1 | łatwa–średnia | lustro w `Hole.draw()` (2 miejsca) albo przepisanie znaków w 10 wpisach `spin` + odbicie sprite'ów; asymetryczne detale (jaśniejsza strona pierścienia fotonowego) też się odbiją |
| **W2** | **łatwa** | 2 linie w `Particle.update()` i 1 w `beginSwallow()`; `swSpin` jest liczony z pozycji, bez `Math.random()`, więc strumień losowań się nie zmienia |
| W3 | łatwa | jak W1 z warunkiem `isPlayer` |
| wariant zależny od skórki | średnia | już istnieje (tablice `spin`); zmiana = praca artystyczna nad 10 wyglądami |

Dowód neutralności dla rozgrywki: w czterech wariantach × czterech skórkach stan rundy jest identyczny —
wynik 880, promień 92, pozycja (774, 1493), 9153 losowania (QA Q10). Do sprawdzenia przy wdrożeniu:
`qa/vfx1.mjs`, `qa/perf1.mjs --equiv` (pozycja obiektu w trakcie animacji połykania zależy od `swSpin`).

**Rekomendacja:** zostawić kierunek wiru, **nie odwracać całości**; wdrożyć **W2 — wariant
mieszany / spójny** (uporządkowanie kierunku materii względem wiru).

**Osobny etap?** Tak, ale mały: „GG-VFX-02 / spójny lej” — ok. 3 linie kodu + testy VFX, niezależny od
GG-UI-02 (nie mieszać z wdrożeniem interfejsu). Pełne odwrócenie nie jest warte etapu.

Narzędzia: `tools/vortex-proto.mjs` (gra dostaje w pamięci przeglądarki zmodyfikowaną kopię `game.js`;
plik na dysku nietknięty; każda podmiana musi trafić dokładnie w oczekiwaną liczbę miejsc, inaczej
skrypt się zatrzymuje), `tools/vortex-compose.py`. Wyniki: `vortex/anim-<skórka>.webp` (cztery warianty
obok siebie), `vortex/anim-<skórka>-v0…v3.webp`, `vortex/strip-<skórka>.jpg` (6 klatek co 0,1 s),
`vortex/full-v0…v3.jpg` (pełny kadr z HUD). Klatki robocze (640 PNG) nie są w repozytorium.

## 10. QA etapu projektowego

`node design/ui2/tools/ui2-check.mjs` → `qa-stage1.json`.

| # | Kontrola | Wynik | Dowód |
|---|---|---|---|
| Q1 | Pliki gry bez zmian | **PASS** | SHA-256 `game.js`, `style.css`, `index.html` = baza `1395c18`; poza `design/ui2/` brak zmian |
| Q2 | Zgodność danych PRZED / A / B | **PASS** | 65/65 scen × kadr: identyczny zapis i wartości na ekranie |
| Q3 | Wartości profilu na ekranie = zapis | **PASS** | 36/36 kadrów Miasta: monety, pryzmaty, LVL, % |
| Q4 | Brak błędów konsoli | **PASS** | 195/195 kadrów |
| Q5 | Makiety: brak poziomego przewijania strony gry | **PASS** | 195/195 |
| Q6 | Ucięte napisy PL (A / B względem PRZED) | **PASS** | 55 scen × kadr, 0 nowych ucięć |
| Q7 | Dłuższe napisy EN | **PASS** | 10 scen × kadr (390×844, 320×568), 0 nowych ucięć |
| Q8a | Dzielnice 320×568: GRAJ dostępny | **PASS** (A, B) | PRZED: zakryty — zastany błąd |
| Q8b | 2560×1440: warstwy stabilne | **PASS** | 3 uruchomienia × 3 ekrany |
| Q9 | Galeria na iPhonie 390×844 | **PASS** | 70 kart, 223 obrazy, 0 px przewijania poziomego, przełączniki, filtr, „obok siebie”, powiększenie, 0 błędów |
| Q10 | Wir: identyczny stan rundy w wariantach | **PASS** | 16 nagrań |
| Q11 | Czytelność na fizycznym telefonie | **NOT VERIFIED** | tylko emulacja Chromium |
| Q12 | Pełna regresja (`qa/run-all.mjs`) | **NOT RUN** | celowo — gra nie jest zmieniana |
| — | `qa/responsive.mjs` na bazie (analiza problemów) | 512/526, **FAIL** 14 | 1 stały (problem 1), 13 niestabilnych (problem 2) — `responsive-base-run.txt` |
| — | `qa/content.mjs` (ikony celów = obiekty planszy) | **NOT RUN** | ikony w odprawie z bossem sprawdzone wzrokowo na kadrze `d4-briefing-boss` |
| — | Wydajność ekranów menu | **NOT RUN** | — |
| — | Kontrast / dostępność wariantów | **NOT VERIFIED** | — |

P00 nie był uruchamiany: etap nie zmienia kodu gry (etap projektowy / dokumentacyjny).

## 11. Pliki

```
design/ui2/
  GG-UI-02_STAGE1_REPORT.md      ten raport
  gallery.html                   galeria (otwierana z repozytorium)
  gallery-artifact.html          ta sama strona bez powłoki dokumentu (do publikacji)
  shots/                         195 kadrów + facts.json (zapis i wartości każdego kadru)
  variants/shared.css, a.css, b.css, b.js   nakładki makiet (nie są ładowane przez grę)
  vortex/                        animacje, sekwencje klatek, pełne kadry, facts.json
  qa-stage1.json                 wynik kontroli etapu
  responsive-audit.json          pomiary dwóch problemów responsive
  responsive-anim-timing.json    czas pojawiania się warstwy menu wg rozdzielczości
  responsive-base-run.txt        błędy qa/responsive.mjs na bazie
  tools/ui2-scenes.mjs           profile testowe i sceny
  tools/ui2-shots.mjs            zdejmowanie kadrów PRZED / A / B z jednej strony
  tools/ui2-gallery.mjs          generator galerii
  tools/ui2-check.mjs            kontrola QA etapu
  tools/ui2-responsive-audit.mjs, ui2-anim-timing.mjs
  tools/vortex-proto.mjs, vortex-compose.py
```

Odtworzenie: `node design/ui2/tools/ui2-shots.mjs` (+ `--responsive`, `--en`), `node
design/ui2/tools/ui2-responsive-audit.mjs`, `node design/ui2/tools/ui2-gallery.mjs`, `node
design/ui2/tools/ui2-check.mjs`.
