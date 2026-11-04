# CRAZYGAMES-BASIC-1 — raport

**Werdykt: @@VERDICT@@**

Zgłoszenia nie wysłano. Decyzję o przyjęciu podejmuje CrazyGames. Żaden test nie odbył się
w prawdziwym CrazyGames Preview, bo wymaga on konta właścicielki, ani na fizycznej myszy,
iPhonie czy w aplikacji CrazyGames.

## 1. Zweryfikowany stan repozytorium

| | |
|---|---|
| Repozytorium | `klaudiamoscinska-art/vector-hole` (jedyny remote) |
| Baza | `origin/main` = `727b8bdbf93a4033aea0b213d6572f22260384cd` (PR #88, WORKSHOP-BUY). Polecenie podawało starszy `f7778fe`; właścicielka potwierdziła bazę PR #88. |
| Gałąź | `crazygames-basic1-preparation` |
| Kandydat | @@HEAD@@ |
| Środowisko | Windows 11, Node 22.23.4, Playwright (Chromium 156), zainstalowane Chrome i Edge 156 |

## 2. Użyte skille

| Skill | Do czego | Konkretne decyzje |
|---|---|---|
| `vh-vector-art` | Nowa dziura, spójność stylu | Wspólne ramiona jako jedna tabela barw (`HORIZON_ARMS`) i własny styl obrzeża w istniejącym `drawHoleRim()`. Bez nowych filtrów i bitmap. Płynniejsza spirala tylko dla tej dziury (44 zamiast 22 kroków), bo na dużym promieniu widać było kanty. Grafika okładek powstaje z rysowania samej gry. |
| `vh-ux-gamefeel` | Czytelność na telefonie, napis o blokadzie | Sprawdzenie na 390×780 i 800×450: czerń sama znika na ciemnej planszy, więc rozpoznawalność niesie cyjanowy pierścień, a obrót pokazują jasne łuki, widoczne także przy małej dziurze. Propozycja blokady to mały napis u dołu, bez okna i bez przechwytywania kliknięć. |
| `vh-marketing-aso` | Okładki, filmy, opisy | Okładka pokazuje czynność: duże obiekty wpadają za krawędź i znikają w czerni. Tylko tytuł jako tekst, kontrola na miniaturach 320 px i 160 px. Film: mechanika od pierwszych sekund, wzrost, potem misja z celem. Opis zaczyna się od Kampanii, czyli od głównej różnicy. |
| `vh-portal-integrations` | Reklamy, brak SDK, błędy | Osobny znak dystrybucji zamiast wykrywania po adresie; brak ofert zamiast martwych przycisków. |
| `vh-release-manager` | Eksport, manifest, PR | Powtarzalny ZIP, sumy kontrolne, brak publikacji. |
| `vh-qa-automation` | Plan testów | Parowanie z bazą, `PASS / FAIL / NOT RUN`, fizyczne urządzenia nigdy jako PASS. |
| `vh-mobile-accessibility` | Ramki, dotyk, `user-select` | Przegląd wymagań + `qa/responsive.mjs` uruchomiony na paczce. |
| `vh-legal-risk` | Prywatność, prawa | Spis danych, ryzyka w §15. Nie zastępuje porady prawnej. |

`vh-director` nie był używany. Sprzeczności: pakiet nazywa grę „Vertical Hole”; `PLATFORM_RULES.md`
podaje „total size ≤ 250 MB” bez dopisku, że bez SDK limitem jest 50 MB. Zgodnie z `CLAUDE.md` pakietu
nie edytowano.

## 3–5. Wymagania: osiem podstron + sterowanie myszą (odczyt 2026-11-03)

Etap: **B** Basic Launch, **F** Full Launch, **W** wytyczna, **R** mocna rekomendacja. Dowód „suite” to
`qa/crazygames-basic1.mjs` na prawdziwej paczce. PASS oznacza test automatyczny lub odczyt kodu, nie
akceptację portalu.

### Intro (`requirements/intro/`)

| Wymaganie | Etap | Wynik | Dowód / uwaga |
|---|---|---|---|
| Pobranie początkowe ≤ 50 MB, razem ≤ 250 MB (50 MB bez SDK), ≤ 1500 plików | B | PASS | @@SIZE@@ |
| Podstawowa kontrola wizualna QA | B | NOT VERIFIED | decyduje QA CrazyGames |
| Zgodność z PEGI 12 | B | NOT VERIFIED | przegląd bez zastrzeżeń (rysunkowy świat, bez krwi); oceny nie wystawia ten raport |
| Monetyzacja wyłączona, brak zewnętrznych reklam | B | PASS | suite |
| Brak zewnętrznego logowania | B | PASS | gra nie ma logowania |
| Opis, sterowanie, okładki, filmy | B | PASS (przygotowane), NOT VERIFIED (formularz) | §12–14 |
| SDK + GameplayStart, reklamy przez SDK, konto | F | NOT APPLICABLE teraz | adapter CrazyGames pozostaje w kodzie; paczka go nie używa |
| IAP | F, na zaproszenie | NOT APPLICABLE | brak w paczce |

### Technical (`requirements/technical/`)

| Wymaganie | Etap | Wynik | Dowód / uwaga |
|---|---|---|---|
| Rozmiar i liczba plików; bez SDK liczy się całość | B | PASS | @@SIZE@@ |
| ≤ 20 MB do mobilnej strony głównej | warunek kwalifikacji | PASS | @@SIZE@@ |
| Pliki zewnętrzne: gra w ≤ 20 s | B | NOT APPLICABLE | 0 żądań poza paczką |
| Tylko ścieżki względne | B | PASS | suite |
| Chrome i Edge | B | @@BROWSERS@@ | suite, zainstalowane przeglądarki |
| Safari | B (gra może być tam wyłączona) | NOT RUN | brak urządzenia |
| Chromium OS 4 GB RAM | B | NOT RUN | brak urządzenia |
| Mobile: mysz, klawiatura i dotyk | B | PASS (emulacja), NOT RUN (telefony) | suite + `runPlatformInputChecks` na paczce |
| Gra poziomo na komputerze | B | PASS | 10 ramek |
| Orientacje ustawiane w formularzu, gra bez blokady | B | PASS | obrót ramki w trakcie rundy; ustawienie w formularzu: właścicielka |
| `user-select: none` we wszystkich formach | B | PASS | **naprawione**; pola tekstowe działają (Chromium), Safari NOT RUN |
| Aplikacja CrazyGames, safe area | B | NOT RUN | gra używa `env(safe-area-inset-*)` |
| Wznowienie dźwięku po przerwaniu na iOS w geście | B | NOT VERIFIED | kod robi `resume()` w geście; iPhone NOT RUN |
| GameplayStart, jeśli jest SDK | warunkowo | NOT APPLICABLE | paczka bez SDK |
| Reklamy wyłączone, gra działa | B | PASS | suite |
| Data / User module, Gameplay start/stop | F | NOT APPLICABLE teraz | |
| Sitelock | opcja | NOT APPLICABLE | brak |
| Notatka o prywatności przy danych osobowych | warunkowo | PASS | gra ich nie zbiera; tekst w Profilu; projekt polityki gotowy |

### Sterowanie myszą (`resources/mouse-control/`, spoza ośmiu podstron)

Tej strony nie było na liście z polecenia i pierwszy audyt jej pominął; wskazała ją weryfikacja GPT.
Dokument **nie mówi**, czy wymaganie dotyczy Basic czy Full, więc wdrożono je już teraz, tylko w paczce.

| Wymaganie (gra z widokiem z góry sterowana myszą) | Wynik | Dowód / uwaga |
|---|---|---|
| Zablokowanie myszy i ograniczenie do obszaru gry (Pointer Lock) | PASS automat, NOT RUN fizyczna mysz | suite: prawdziwy Pointer Lock Chromium w iframe, sygnały z Playwrighta |
| Własny wskaźnik | PASS | wirtualny wskaźnik, do krawędzi ramki |
| Skrót odblokowujący | PASS (P), NOT RUN (fizyczny Esc) | Esc obsługuje sama przeglądarka; automat nie może go wysłać, więc test zastępuje go utratą blokady z zewnątrz |
| Przyciski w rozgrywce klikalne lub ze skrótem | PASS | pauza działa wskaźnikiem wirtualnym; menu zwalniają kursor |
| WASD i strzałki | PASS | |

### Gameplay (`requirements/gameplay/`)

| Wymaganie | Etap | Wynik | Dowód / uwaga |
|---|---|---|---|
| Czytelność przy DPR 1 w 10 ramkach 16:9 | B | PASS (układ w ramce), NOT VERIFIED (ocena QA) | suite, zrzuty `--shots` |
| Fizyka niezależna od odświeżania | B | PASS (emulacja czasu klatek), NOT RUN (monitor 144/165 Hz) | @@HZ@@ |
| Angielski | B | PASS | brak polskich tekstów przy `?i18n=log` |
| Język z `locale` SDK, domyślnie angielski | B | PASS wariantowo | bez SDK gra czyta język przeglądarki; inny niż polski to angielski |
| Intuicyjne sterowanie | B | PASS (automat), NOT VERIFIED (odbiór ludzi) | FTUE-1…3 + suite |
| Płynność, brak błędów | B | PASS lokalnie | 0 błędów konsoli; MOBILE-PERF-1 |
| Oryginalność | B | **NOT VERIFIED, główne ryzyko** | §15 |
| Bez własnego pełnego ekranu | B | PASS | brak `requestFullscreen` |
| Bez promocji innych gier i platform | B | PASS | **naprawione**: bez linku wyzwania i bez metadanych z GitHub Pages |
| Dla odbiorców 13+, PEGI 12 | B | NOT VERIFIED | decyzja QA |
| Nowy gracz od razu w grze, najwyżej 1 kliknięcie | F | PASS (z wyprzedzeniem) | jedno kliknięcie GRAJ |

### Advertisement (`requirements/ads/`)

| Wymaganie | Etap | Wynik | Dowód / uwaga |
|---|---|---|---|
| W Basic reklamy wyłączone, gra działa bez zawieszeń | B | PASS | suite |
| Przyciski reklam nie mogą nic nie robić | B | PASS | **naprawione**: oferty znikają |
| Tylko reklamy przez SDK | B/F | PASS | 0 żądań zewnętrznych |
| Zasady midgame, rewarded, banerów, adblock | F | NOT APPLICABLE teraz | do weryfikacji przy Full Launch |

### Account Integration (`requirements/account-integration/`)

| Wymaganie | Etap | Wynik | Dowód / uwaga |
|---|---|---|---|
| Gra bez kont nie musi mieć modułu User | B | PASS | brak kont |
| Goście mogą grać, brak zewnętrznego logowania | B | PASS | |
| Postęp przez Data module / APS | opcja w B | NOT APPLICABLE | zapis lokalny |
| Postęp przy koncie CrazyGames, nazwa i awatar | F | NOT APPLICABLE teraz | |

### Multiplayer (`requirements/multiplayer/`)

| Wymaganie | Etap | Wynik | Dowód / uwaga |
|---|---|---|---|
| Online with Friends | tylko gry online | NOT APPLICABLE | brak trybu online |
| Boty o nazwach jak nicki | dokumentacja milczy | NOT VERIFIED | formularz mówi wprost o rywalach AI; rozstrzyga QA |

### Game covers (`requirements/game-covers/`)

| Wymaganie | Etap | Wynik | Dowód / uwaga |
|---|---|---|---|
| 1920×1080, 800×1200, 800×800 | B | PASS | §12 |
| Bez ramek, ikon i tekstu poza tytułem, bez cudzych materiałów, ostre | B | PASS | grafika gry, sam tytuł |
| Nie zrzut ekranu, prosto, nazwa, stylizowany font | W | PASS | kompozycja własna, Russo One (OFL 1.1) |
| Film 15–20 s, ≤ 50 MB, 16:9 i 2:3 w 1080p, bez dźwięku | B | @@MEDIA@@ | §13 |
| Bez przyspieszania; okładka jako pierwsza klatka | B | PASS | 1 klatka symulacji = 1 klatka filmu; test porównuje pierwszą klatkę z okładką |
| Bez czarnych pasów i przejść, kursora, „Play Now”, ikon | B | PASS | test próbek i klatki kontrolne |
| Formaty plików | brak zapisu | NOT VERIFIED | PNG, MP4/H.264; akceptację pokaże portal |

### Quality Guidelines (`requirements/quality/`)

Same wytyczne (W), nieobowiązkowe.

| Wytyczna | Wynik | Uwaga |
|---|---|---|
| Onboarding w rozgrywce, krótki tekst, pokazane sterowanie | PASS | FTUE-1, FTUE-3 |
| Jasne cele, czytelne etykiety | PASS | CONTENT-1 |
| Spójny styl grafiki, dźwięku | PASS | VISUAL-1, syntezowane audio |
| Unikalność nazwy | NOT VERIFIED | formalna weryfikacja GLITCH GULP otwarta |
| Klawisze: AZERTY | PASS | `e.code` to pozycja fizyczna |
| Escape wychodzi z pełnego ekranu | PASS | pauza też pod P i Spacją |
| Gra solo jest dostępna, brak obietnic online | PASS | |

## 6–7. Problemy wykryte i poprawki

| # | Problem w `727b8bd` | Skutek na CrazyGames | Poprawka |
|---|---|---|---|
| 1 | Na hoście `crazygames.*` gra sama ładowała SDK, a przyciski nagród zostawały aktywne przy reklamach wyłączonych | Odrzucenie („rewarded ad buttons that do nothing”) | Paczka nie ładuje SDK, dostawca `none`, oferty znikają |
| 2 | Bez portalu działała płatna nagrodą reklama demonstracyjna | Fałszywa reklama | W paczce nieosiągalna |
| 3 | WYZWIJ ZNAJOMEGO kierował na surowy adres pliku gry | Link poza portal | Wiersz ukryty w paczce |
| 4 | Pasek zgody na „statystyki”, których paczka nie zbiera | Zbędny komunikat | Ukryty w paczce, statystyki wyłączone |
| 5 | Metadane i tytuł z adresem GitHub Pages | Odniesienie do innego hostingu | Usuwane przez eksport |
| 6 | Brak `-webkit-/-moz-/-ms-user-select` na `body` | Lupa i menu na telefonie | Dodane; `input`, `textarea` zostają zaznaczalne |
| 7 | Przy nieudanym SDK portalu oferty zostawały bez działania (każda wersja) | Martwe przyciski | `adsAvailable` obejmuje też ten przypadek |
| 8 | Sterowanie bezwzględną pozycją kursora, bez Pointer Lock | Niezgodność z `resources/mouse-control/` | Pointer Lock z wirtualnym wskaźnikiem, tylko w paczce |

Zmiany na życzenie właścicielki: nazwa **GLITCH GULP** (logo, tytuł, metadane, karta wyniku, nazwy
pobieranych plików, teksty); **nowy wir startowy „Horyzont”**. Gra nie ma PWA ani service workera, więc
„PWA” oznacza tu tylko znaczniki tytułu aplikacji. Bez zmian: adresy, repozytorium, klucz zapisu, kod
kopii, SAVE v13, ekonomia, nagrody, misje, panel TEST, system wydań.

## Sterowanie myszą w paczce

- **Blokada:** dopiero kliknięcie planszy w trwającej rundzie. Kliknięcie GRAJ jej nie włącza. Wcześniej
  steruje zwykły kursor, a mały napis proponuje blokadę. Od tej zgody blokada wraca sama w tej sesji,
  także w kolejnych rundach.
- **Sterowanie:** wskaźnik wirtualny przechodzi przez tę samą funkcję co kursor, więc logika ruchu jest ta sama.
- **Esc:** odblokowuje (robi to przeglądarka) i pauzuje. Spóźnione Esc nie wznawia gry.
- **Zwolnienie:** pauza, karty ewolucji, karta startu misji, oferta +20 s, wynik, utrata fokusu.
- **Odzyskanie:** po zamknięciu menu blokada wraca. Chrome odmawia przez około sekundę po Esc; wtedy gra
  działa dalej, a napis prosi o kliknięcie.
- **Brak API lub odmowa ramki:** zwykły kursor, bez błędów; po trzech odmowach napis znika.
- **Bez zmian:** WASD, strzałki, dotyk. Na GitHub Pages tego kodu się nie uruchamia.
- **Do sprawdzenia fizycznie:** Esc, odczucie ruchu, Windows ze skalowaniem ekranu (`movementX` może być
  liczone inaczej), pełny ekran portalu.

## Uwagi koordynatorki: odpowiedzi

| Pytanie | Odpowiedź | Dowód |
|---|---|---|
| Czy `data-distribution` izoluje funkcje portalowe? | Tak: znak stoi tylko w stronie paczki. Parametr URL niczego nie włącza. Bez znaku działa zwykła ścieżka portalu | testy `trust`, `marker` |
| Czy ukrycie WYZWIJ ZNAJOMEGO działa tylko w paczce? | Tak | testy `GitHub Pages build`, `marker` |
| Czy ukrycie reklam szkodzi GitHub Pages? | Nie: demo płaci jak dotąd; oferty znikają wyłącznie gdy SDK portalu zawiedzie | `webChecks`, `features`, pełna regresja |
| Czy `user-select` psuje interakcje? | W Chromium nie: pisanie i zaznaczanie działa. Safari NOT RUN | test `user-select` w obu wersjach |
| Czy eksport narusza system wydań? | Nie: skrypt i workflow nie znają paczki ani `tools/` | test `release`, `release.mjs`, `release-recovery.mjs` |
| Czy testy sprawdzają faktyczną zawartość? | Tak: gra działa z folderu paczki na udawanym hoście; media sprawdzane z plików. Udawany host to nie Preview | §10, §13 |
| Czy dokumentacja nie obiecuje na wyrost i rozdziela Basic od Full? | Tak po przeglądzie: usunięto `.io`, wyzwania znajomych. `index.html` na GitHub Pages nadal ma w metadanych „gra .io”; paczka je usuwa | `docs/crazygames/` |

## Czym gra różni się od Hole.io

Różnice są realne, ale **rdzeń jest ten sam**: dziura w mieście i runda 2 minuty.

| Element | W grze | Widać w materiałach? |
|---|---|---|
| Kampania: 240 misji, 12 dzielnic, cele, gwiazdki, wzmocnienia | tak | film (koniec, cel „Swallow 1 truck”), opis krótki i długi |
| Karty ulepszeń w rundzie | tak | opis długi; w filmach nie |
| Core City rosnące po rundach Areny | tak | opis długi; w filmach nie |
| Wyzwanie dnia | tak | opis długi |
| Combo i ranking według punktów, nie rozmiaru | tak | film (combo, punkty) |
| Neonowy styl wektorowy, własna grafika, synteza dźwięku | tak | okładki, film; dźwięku film nie ma |
| Nazwa | GLITCH GULP | wszędzie |

Wniosek: materiały pokazują Kampanię i własny styl, ale okładka nadal opowiada „dziura pochłania miasto”.
To decyzja QA CrazyGames, a nie test.

## 8. Reklamy w Basic

| Oferta | GitHub Pages | Paczka Basic |
|---|---|---|
| ×2 MONET | reklama demo, płaci | brak przycisku |
| Darmowe pryzmaty w Warsztacie | jw. | brak przycisku; pusta karta też znika |
| Skrzynia od razu | jw. | sam tekst o czekaniu |
| ×2 nagroda dnia | jw. | zwykła nagroda, bez oferty |
| Wzmocnienie za reklamę | jw. | brak; opcja za pryzmaty zostaje |
| +20 s na misję | reklama lub pryzmaty | tylko pryzmaty; bez pryzmatów misja kończy się normalnie |
| Przerwa między rundami | demo co N rund | brak, bez czekania |
| Bezpośrednie wywołanie `rewarded()` | jw. | od razu `false`, bez nakładki i nagrody |

Normalne nagrody są równe w obu wersjach przy tych samych ziarnach (test parami).

## 9. Paczka

@@PACKAGE@@

Polecenie: `node tools/export-crazygames-basic.mjs --out=DIR`. Skrypt odmawia przy brakującym pliku,
ścieżce bezwzględnej, odwołaniu zewnętrznym lub przekroczeniu limitu; dwa przebiegi dają ten sam ZIP.

## 10. Testy paczki i iframe

@@IFRAME@@

## 11. SAVE i regresja

@@REGRESSION@@

## 12. Okładki

@@COVERS@@

Elementy: nowa dziura, duże obiekty wpadające za krawędź, logo GLITCH GULP. Generator:
`tools/crazygames-covers.mjs` (źródło edytowalne). Czytelność sprawdzona na miniaturach 320 px i 160 px.

## 13. Filmy

@@VIDEOS@@

Układ: okładka (0,4 s), Arena od 6. s (zjadanie, combo), 28. s (duża dziura), 87. s (bardzo duża dziura),
misja M38 z celem na ekranie. Rozgrywkę prowadzi bot sterujący klawiszami, według zasad gry; fragmenty łączą
zwykłe cięcia, bez przyspieszania. Wyniki w filmie pochodzą z tych rund.

## 14. Materiały do formularza

`docs/crazygames/CRAZYGAMES_SUBMISSION_TEXTS.md`, `docs/crazygames/PRIVACY_POLICY_DRAFT.md`.

## 15. Ryzyka: prywatność i prawa

| Ryzyko | Ocena | Co dalej |
|---|---|---|
| **Podobieństwo do Hole.io** (Voodoo) | **Główne ryzyko przyjęcia.** Grafika, kod, dźwięk i nazwa są własne, mechanika rdzenia ta sama | Ocena QA lub prawnika. Teksty nie wymieniają innej gry |
| Znak GLITCH GULP | Formalna weryfikacja otwarta | Właścicielka |
| Fizyczna mysz i Esc | Nieprzetestowane | Preview, §17 |
| Fonty Russo One, Exo 2 | Niskie: SIL OFL 1.1 | Nota w `style.css` |
| Warunki dla deweloperów | Do przeczytania przez właścicielkę | Wyłączność czasowa jest opcjonalna (pkt 5.5); akceptacja to czynność prawna właścicielki |
| Inne portale | Umowa z Poki nieznana | Właścicielka sprawdza przed zgłoszeniem |
| Tekst prywatności: wydawca bez danych, pusty kontakt | Niskie w Basic, gra nic nie zbiera | OWNER INPUT |
| Nazwy botów wyglądają jak nicki | Niskie, formularz mówi o AI | Tekst gotowy |
| Kod panelu TEST w paczce (bez kodu dostępu) | Poza zakresem z decyzji właścicielki | Nie analizowano |
| Nowa dziura zmienia też wygląd u obecnych graczy z wirem startowym | Zamierzone; postęp i zakupy bez zmian | Pryzmat zostaje tęczowy |
| Nazwa na GitHub Pages | Po scaleniu zmieni się też na produkcji (jeden kod) | Adres i zapis bez zmian |

## 16. Dane od właścicielki (OWNER INPUT REQUIRED)

1. Nazwa wydawcy, kontakt, adres polityki prywatności.
2. Akceptacja warunków i oświadczenie o prawach, status Poki.
3. Formalna weryfikacja znaku GLITCH GULP.
4. Czy włączać mobile już w Basic (brak testów na fizycznych telefonach).
5. Test fizyczną myszą w Preview.

## 17. NOT RUN i NOT VERIFIED

@@NOTRUN@@

## 18. Rekomendacja

@@RECOMMENDATION@@

## HANDOFF

@@HANDOFF@@
