# CRAZYGAMES-PREFLIGHT-2: raport

**Werdykt: READY WITH BLOCKERS.** W kodzie nie ma znanego błędu blokującego Basic Launch. Do zgłoszenia brakuje czterech rzeczy: decyzji o PR (po odbiorze GPT), własnego testu w CrazyGames Preview, danych właścicielki i decyzji o ryzyku oryginalności wobec Hole.io.

Do CrazyGames nic nie wysłano. O przyjęciu gry decyduje CrazyGames.

## 1. Stan repozytorium

| | |
|---|---|
| Repozytorium | `klaudiamoscinska-art/vector-hole` |
| Baza | `origin/main` = `7bd1280294a4d1cf07f214c5aeb5b6db0c78a09a` (PR #89), sprawdzona ponownie przed końcem pracy |
| Gałąź | `crazygames-preflight2-fixes` |
| Kod gry | `89926df9e38e5e8e5b52bb0f50eecf1c7a7edd8c`; później tylko dokumentacja i poprawka testu, końcowy SHA w opisie PR |
| Środowisko | Windows 11, Node 22, Playwright Chromium 156, Chrome i Edge 156 |

Stara paczka z `crazygames-basic1-delivery/` była bajt w bajt równa eksportowi z bazy (ten sam SHA ZIP-a), więc poprzednie dowody dotyczyły właściwego kodu.

## 2. Wykorzystane skille

| Skill | Decyzja, która z niego wynikła |
|---|---|
| `vh-portal-integrations` | Bez SDK i reklam. Język bez SDK z przeglądarki. Ukrycie polskiego menu tylko w paczce, przez istniejący znak `data-distribution`. |
| `vh-qa-automation` (lista kontrolna) | Zamiast powtarzać całość: osobny skan wszystkich tekstów, regresja dotkniętych zestawów, każdy FAIL sprawdzony osobno na bazie i kandydacie. |
| `vh-legal-risk` (lista kontrolna) | Rozdzielenie faktów od niezweryfikowanego, bez oświadczeń prawnych w imieniu właścicielki. Sprawdzenie metadanych licencji fontów. |

## 3–4. Wymagania Basic Launch (dokumentacja odczytana 2026-11-05)

Formularz Developer Portalu jest za logowaniem: jego pól nie oglądano. „Automat” to test na prawdziwej paczce, nie akceptacja portalu.

### Obowiązkowe w Basic

| # | Wymaganie | Źródło | Wynik | Dowód / uwaga |
|---|---|---|---|---|
| 1 | Bez SDK: pliki ≤ 50 MB, ≤ 1500 plików | [technical](https://docs.crazygames.com/requirements/technical/) | **PASS** | 3 pliki, 1,32 MB, ZIP 0,41 MB |
| 2 | Tylko ścieżki względne | technical | **PASS** | eksport i zestaw paczki |
| 3 | Gra działa w Chrome i Edge, ładuje się szybko, bez błędów | technical, [gameplay](https://docs.crazygames.com/requirements/gameplay/) | **PASS** (symulacja) | zimny start §7; 0 błędów konsoli; 0 żądań zewnętrznych |
| 4 | Safari | technical (bez działania gra jest tam wyłączana) | **NOT RUN** w paczce | iPhone PASS tylko dla GitHub Pages, od właścicielki |
| 5 | Chromebook 4 GB (inaczej wyłączenie na Chromium OS) | technical | **NOT RUN** | sterta JS ok. 10 MB, to tylko wskazówka |
| 6 | Mysz, klawiatura, dotyk | technical | **PASS** (automat, dotyk emulowany); mysz **PASS** fizycznie 3/3 | §6 |
| 7 | Gra poziomo na komputerze | technical | **PASS** | ramki §7 |
| 8 | `user-select: none` | technical | **PASS** | zestaw paczki |
| 9 | Sitelock | technical | **NOT APPLICABLE** | brak |
| 10 | Informacja o prywatności, jeśli gra zbiera dane osobowe | technical | **PASS** | paczka ich nie wysyła; tekst w Profilu |
| 11 | Czytelność przy DPR 1 w 10 ramkach | gameplay | **PASS** (automat), **NOT VERIFIED** (ocena QA) | najmniejsza czcionka 9 px przy 800×450 i 821×462 |
| 12 | Fizyka niezależna od odświeżania | gameplay | **PASS** (emulacja), **NOT RUN** (monitor 144/165 Hz) | 60/120/144/165 Hz w zestawie paczki |
| 13 | Lokalizacja angielska | gameplay | **FAIL na bazie, PASS na kandydacie** | §5, główne ustalenie tego etapu |
| 14 | Język z `locale` SDK, inaczej angielski | gameplay | **PASS** wariantowo | bez SDK: język przeglądarki; brak informacji: teraz angielski |
| 15 | Intuicyjne sterowanie | gameplay | **PASS** (automat, osoba z zewnątrz), **NOT VERIFIED** (QA) | test osoby niezwiązanej z produkcją, od właścicielki |
| 16 | Oryginalność nazwy, grafiki, treści | gameplay, [FAQ](https://docs.crazygames.com/faq/) | **NOT VERIFIED** | główne ryzyko, §10 |
| 17 | Bez własnego pełnego ekranu | gameplay | **PASS** | brak `requestFullscreen` |
| 18 | Bez promocji innych gier i platform | gameplay | **PASS** | brak linków i udostępniania w paczce |
| 19 | PEGI 12, odbiorcy 13+, gra nie dla dzieci | gameplay, FAQ | **NOT VERIFIED** | przegląd bez zastrzeżeń; ocenia QA |
| 20 | Reklamy wyłączone, gra działa, brak martwych przycisków | [ads](https://docs.crazygames.com/requirements/ads/) | **PASS** | zestaw paczki |
| 21 | Brak zewnętrznego logowania | [account](https://docs.crazygames.com/requirements/account-integration/) | **PASS** | gra nie ma kont |
| 22 | Trzy okładki | [covers](https://docs.crazygames.com/requirements/game-covers/) | **PASS** | §8 |
| 23 | Filmy 15–20 s, ≤ 50 MB, 16:9 i 2:3, bez dźwięku | covers | **PASS** | §8 |
| 24 | Opis i sterowanie w zgłoszeniu | [intro](https://docs.crazygames.com/requirements/intro/) | **PASS** (przygotowane), **NOT VERIFIED** (formularz) | `docs/crazygames/` |
| 25 | Blokada myszy w grach z widokiem z góry | [mouse-control](https://docs.crazygames.com/resources/mouse-control/) (strona nie mówi, czy Basic, czy Full; traktujemy jak obowiązek) | **PASS** | fizycznie 3/3, w Preview **NOT RUN** |

### Dopiero Full Launch (nie wdrażać teraz)

SDK z `GameplayStart`, reklamy przez SDK i działanie z adblockiem, postęp na koncie CrazyGames, nazwa i awatar, start od razu w rozgrywce (najwyżej 1 kliknięcie: dziś spełnione), zapis w chmurze. **Wynik: NOT APPLICABLE teraz.**

### Zalecenia nieobowiązkowe

| Zalecenie | Wynik |
|---|---|
| [Quality](https://docs.crazygames.com/requirements/quality/): krótki onboarding w rozgrywce, jasne cele, unikalna nazwa, AZERTY | **PASS**; sama unikalność nazwy **NOT VERIFIED** |
| [Common fixes](https://docs.crazygames.com/resources/html5/common-fixes/): kółko, strzałki i Spacja nie przewijają strony | **PASS** (symulacja) |
| [App](https://docs.crazygames.com/resources/crazygames-app/): obszar bezpieczny | **PASS** w kodzie (`env(safe-area-inset-*)`), w aplikacji **NOT RUN** |
| ≤ 20 MB do mobilnej strony głównej | **PASS** |
| [Basic Launch](https://docs.crazygames.com/resources/basic-launch-metrics/): 10+ min grania, D1 10–15 %, konwersja 80 %+ | **NOT VERIFIED**: mierzy portal |

## 5. Znalezione błędy

Wszystkie istniały już w `main`. Żaden nie dotyczy zapisu ani ekonomii.

| # | Błąd | Skutek dla gracza | Stan |
|---|---|---|---|
| 1 | **28 brakujących tłumaczeń**, 16 osiągalnych w paczce, m.in. `NOWY ROZMIAR!`, `CEL ZALICZONY`, `PODIUM · 2. MIEJSCE`, `SKRZYNIA OTWARTA!`, `RYWAL` | Polskie napisy w angielskiej grze | Poprawione |
| 2 | **Polskie menu z `GRAJ` podczas ładowania** | Gracz en-US widział martwe polskie menu przez ok. 1 s przy Slow 4G, 2 s przy 3G, 5 s przy Slow 3G | Poprawione, tylko w paczce |
| 3 | Brak informacji o języku dawał polski | Niezgodne z wymogiem angielskiego zapasowego; sytuacja rzadka | Poprawione |
| 4 | `×1,6` i miejsce `1.` po angielsku | Polski zapis liczb na ekranie wyniku | Poprawione |
| 5 | Filtr `?i18n=log` przepuszcza tekst bez polskiego słowa z listy, a boty nie rysują klatek | Dlatego wcześniejsze PASS nie wykryły błędu 1 | Nowe testy; lista w `docs/claude/ARCHITECTURE.md` |

Nieblokujące, **bez zmian w kodzie**:

- Etykieta COMBO wchodzi kilka pikseli pod przycisk pauzy na ramkach od ok. 1536 px szerokości; widać to też w filmach.
- Przy 800×450 podpis `+30 coins for…` jest skrócony wielokropkiem.
- Przy 320×568, którego nie ma wśród ramek CrazyGames, część tekstów jest ucinana, a główny przycisk Dzielnic bywa pod nawigacją (zastane, także po polsku).
- W `game.js` paczki stoi nieużywany adres SDK Poki. Nie ładuje się i nie jest widoczny, ale wymaganie mówi o braku marki innego portalu; do usunięcia przy okazji SDK.

Język: 19/19 po poprawkach. `en-US`, `en-GB`, `de`, `fr`, `ja`, `pt-BR`, `es-419` dają angielski; `pl` polski; zapisany wybór wygrywa z przeglądarką; działa przy uszkodzonym zapisie i zablokowanej pamięci; przełączanie w Profilu przetrwa odświeżenie. Skan statyczny objął ok. 2000 tekstów, a przejście po wszystkich ekranach także 240 misji: pozostały tylko nazwy własne i słowa poprawne po angielsku.

Teksty nie wychodzą poza przyciski ani okna: 15 ramek na bazie (cztery sceny rundy tam nie ruszyły z powodu błędu narzędzia) i wybrane sceny w 12 przebiegach ramek na kandydacie, w tym te cztery w 4 ramkach. Jedyne ucięcia to przypadki przy 320×568 i `+30 coins` wyżej.

## 6. Poprawki

| Plik | Zmiana |
|---|---|
| `game.js` | 28 wpisów `I18N_EN`, angielski zapasowy, znak `i18n-ready`, separator dziesiętny i miejsce zależne od języka |
| `style.css` | Jedna reguła tylko dla paczki: `#app` niewidoczny, dopóki gra nie wybierze języka |
| `qa/crazygames-basic1.mjs` | 11 nowych kontroli `englishEdgeChecks` |
| `docs/` | Changelog, GDD, architektura, README QA, data odczytu, ten raport |

**Bez zmian:** polskie teksty, SAVE v13 i klucz zapisu, ekonomia, skiny i zakupy, adres i nazwa repozytorium, system wydań i workflow, panel TEST, Pointer Lock. GitHub Pages zmienia tylko tłumaczenia angielskie, nie malowanie strony.

Komunikat pierwszego commita podaje „27 strings”; poprawna liczba to 28.

## 7. Testy

| Zestaw | Wynik | Uwaga |
|---|---|---|
| `qa/crazygames-basic1.mjs --delivery` | **115/116 PASS, potem krok 11/11** | jedyny FAIL to błąd wzorca w nowym teście; po poprawce ten krok PASS, ZIP bez zmian. Całego zestawu nie powtórzono |
| Regresja, partia A: `instructions`, `boot`, `bridge`, `release`, `recovery`, `edge`, `features`, `visual`, `flow`, `v19`, `v22`, `save`, `px02`, `ftue1`, `ftue3` | **684/684 PASS** | |
| Regresja, partia B: `responsive`, `input`, `visual1`, `content`, `perf1`, `gameready1`, `deviceqa1` | **671/675 PASS** | 4 FAIL „layer not visible” pod obciążeniem |
| Powtórka tych ramek osobno | **10/10 PASS na bazie i 10/10 na kandydacie** | wniosek: FLAKY, nie regresja |
| Zestawy platformowe na samej paczce | **498/537 PASS** | te same 39 zamierzonych różnic co na `7bd1280`: 25 `hubConsent`, 11 `revive`, 3 `input` |
| Macierz języka | **19/19 PASS** (na bazie 16/19) | |
| Symulacja wejścia w ramce | **14/15 PASS** | jedyny FAIL to mój odczyt przed ustawieniem wskaźnika; pozostałe skalowania PASS |

**NOT RUN:** `arenabots`, `campaignbots`, `difficulty`, `balance1`, `v15`–`v18`, `v20`, `v21`, `audio`, `devices`, `workshop-buy` (bez zmiany rozgrywki i ekonomii); testy panelu TEST (decyzja właścicielki); CrazyGames Preview i QA Tool; fizyczne monitory 120/144/165 Hz; Android, aplikacja CrazyGames, Chromebook; Safari z paczką.

### Zimny start i wydajność (symulacja CDP, bez cache, gzip)

| CPU | Sieć | Gotowość |
|---|---|---|
| ×1 | lokalnie: Chromium, Chrome, Edge | 229, 267, 360 ms |
| ×1 | Fast 4G | 600 ms |
| ×4 | Fast 4G | 984 ms |
| ×4 | Slow 4G | 2,8 s |
| ×6 | Fast 3G | 4,5 s |
| ×4 | Slow 3G | 13 s |

Limit 20 s jest spełniony w każdym wariancie, 10 s poza Slow 3G. Paczka po gzip: 430 KB.

Runda Areny w Chrome: 56,6 kl./s bez ograniczeń, 45,8 przy CPU ×4, 25,3 przy CPU ×6. To emulacja na tej maszynie, **nie fizyczne słabe urządzenie**.

### Sterowanie

| Zakres | Wynik | Rodzaj |
|---|---|---|
| Pointer Lock: blokada, Esc i pauza, wznowienie | PASS 3/3 | **fizycznie**, właścicielka, lokalna paczka sprzed tych poprawek |
| GitHub Pages na komputerze | PASS 5/5 | **fizycznie**, właścicielka |
| iPhone jako aplikacja z ekranu głównego | PASS | **fizycznie**, właścicielka; to nie paczka CrazyGames |
| Skalowanie 125, 150 i 200 % | PASS | symulacja DSF, nie Windows |
| Fokus w ramce, klik na stronie portalu, klawisze, kółko, prawy przycisk | PASS | symulacja |
| Dotyk 800×450 | PASS | emulacja |
| CrazyGames Preview | **NOT RUN** | wymaga konta właścicielki |

## 8. Paczka, okładki, filmy

Nowa paczka jest w osobnym folderze `crazygames-preflight2-delivery/`, stary zostaje bez zmian.

| | Stara (`7bd1280`) | **Nowa, do wgrania po decyzji o PR** |
|---|---|---|
| ZIP SHA-256 | `38c918c8…` | `ebe571cbb8898dc76c9b208b38978a9410c0696935caee872629664a0c86e417` |
| Pliki | 3 | 3 (1,32 MB, ZIP 0,41 MB) |

**Okładki i filmy bez zmian** (SHA identyczne ze starym folderem, nie generowano ich ponownie): 1920×1080, 800×1200, 800×800; filmy 17,4 s, 14,2 i 13,1 MB, bez dźwięku. Na klatkach co 0,5 s z filmu poziomego widać prawdziwą rozgrywkę i tylko angielskie napisy.

## 9. Decyzje i dane właścicielki

1. Odbiór GPT i decyzja o scaleniu PR. Po scaleniu tłumaczenia trafią też na GitHub Pages.
2. Nazwa wydawcy, kontakt, ewentualny adres polityki prywatności. W grze jest dziś neutralne „GLITCH GULP publisher” bez kontaktu.
3. Przeczytanie i akceptacja [warunków dla deweloperów](https://files.crazygames.com/documents/developer_terms_20250818.pdf). Zawierają oświadczenia o prawach do gry; to czynność prawna właścicielki.
4. Zobowiązania wobec innych portali. CrazyGames nie wymaga wyłączności ([FAQ](https://docs.crazygames.com/faq/)); stanu umów, np. z Poki, nie znam.
5. Świadoma decyzja o ryzyku oryginalności (§10).
6. Mobile już w Basic, czy na początek tylko komputery. Rekomendacja: po testach Preview na telefonie.
7. Formalne badanie znaku, jeśli ma być podstawą decyzji o nazwie.

**Test w Preview przed zgłoszeniem:** nowa paczka; pierwszy start w angielskim profilu przeglądarki; Arena, Dzielnice; kliknięcie planszy, ruch, Esc, wznowienie, pełny ekran; ponowne wejście (zapis); brak ofert reklam.

## 10. Ryzyka

### Oryginalność: główne ryzyko przyjęcia

Potwierdzone:

- FAQ wymienia „clones or asset flips” wśród powodów odrzucenia, a warunki wymagają poziomu oryginalności, który odróżnia grę od istniejących.
- Na CrazyGames są już m.in. [Hole.io](https://www.crazygames.com/game/hole-io-uyt), [Holey.io Battle Royale](https://www.crazygames.com/game/holey-io-battle-royale), [Voxel hole](https://www.crazygames.com/game/voxel-hole-black-hole-game) i [Mega Hole Attack](https://www.crazygames.com/game/mega-hole-attack). Gatunek jest więc dopuszczalny, ale opis Hole.io też wspomina „glowing sci-fi metropolis”.
- Własne są kod, grafika, dźwięk i nazwa. Rdzeń jest ten sam: dziura w mieście i runda 2 minuty.

Ocena: **średnie do wysokiego**; rozstrzyga QA. Odrzuconą grę można zgłosić ponownie po istotnych zmianach.

### Nazwa

| Źródło | Wynik |
|---|---|
| USPTO, wyszukiwarka publiczna | **0** trafień `GLITCH GULP`, `GLITCHGULP` i obu słów razem; 36 żywych znaków ze słowem GULP, żaden z grami w klasach 9/41; wśród 35 żywych z GLITCH sześć ma w opisie gry, np. `OKLAHOMA CITY GLITCH`, nieanalizowane |
| Steam, itch.io, Google Play, CrazyGames | brak gry o tej nazwie; są podobne słowa: `Glitch`, `Glitch's Trip`, `The Ghastly Gulp`, stare `Gulp!` |
| EUIPO / TMview | **NOT VERIFIED**: serwis odrzucił zapytanie |
| Urząd Patentowy RP, WIPO, App Store, Poki | **NOT VERIFIED** |

To **nie jest** badanie dostępności znaku. Słowa są pospolite, a kontrola objęła tylko powyższe źródła.

### Prywatność i prawa

- Paczka nie wysyła danych, nie ma żądań zewnętrznych, kont ani reklam; statystyki wyłączone. Projekt polityki odpowiada temu stanowi.
- Fonty Russo One i Exo 2: SIL OFL 1.1, nota o prawach i licencji jest w metadanych osadzonych plików i w `style.css`. Russo ma zastrzeżoną nazwę fontu, a osadzony plik jest podzbiorem: ryzyko niskie, bez opinii prawnej.
- Pozostałe zasoby: własne SVG i Canvas, dźwięk syntetyzowany, zero zależności w paczce.
- Panel TEST zostaje: siedem szybkich kliknięć w Profilu otwiera pole kodu po polsku. Gracz raczej na to nie trafi; decyzja właścicielki, poza zakresem.

## 11. Marketing i pierwsza minuta

- **Rozumienie:** dobrze. Jeden przycisk PLAY, pokaz na żywo, osoba z zewnątrz bez podpowiedzi ukończyła rundę. To jedna osoba, nie pomiar.
- **Druga runda:** PLAY AGAIN to główna akcja wyniku; postęp miasta i nagrody widać od razu.
- **Wyróżniki:** Kampania jest w opisie, ale nowy gracz spotyka ją dopiero po trzeciej rundzie; okładka i pierwsze sekundy filmu mówią „dziura pochłania miasto”.
- **Materiały:** filmy i okładki pokazują prawdziwą grę, okładka jest grafiką z elementów gry.

Po premierze, według KPI: wcześniejsze pokazanie Kampanii w filmie i przebudowa okładki, jeśli CTR lub konwersja będą słabe; poprawka COMBO. Nie przebudowywać niczego przed danymi.

## 12. Werdykt: READY WITH BLOCKERS

Blokery nie są błędami kodu:

1. PR do odbioru GPT i decyzja właścicielki.
2. Test w CrazyGames Preview na nowej paczce.
3. Dane i akceptacje właścicielki (§9).
4. Decyzja o oryginalności i nazwie (§10).

Logi: `reports/logs/` w `crazygames-preflight2-delivery/`. Narzędzia audytu: `vh-pf2-tools/`, poza repozytorium.
