# CRAZYGAMES-BASIC-1 — raport

**Werdykt: @@VERDICT@@**

Zgłoszenia nie wysłano. Decyzję o przyjęciu podejmuje CrazyGames. Żaden test nie odbył się
w prawdziwym CrazyGames Preview, bo wymaga on konta właścicielki.

## 1. Zweryfikowany stan repozytorium

| | |
|---|---|
| Repozytorium | `klaudiamoscinska-art/vector-hole` (jedyny remote) |
| Baza | `origin/main` = `727b8bdbf93a4033aea0b213d6572f22260384cd` (PR #88, WORKSHOP-BUY); polecenie podawało starszy `f7778fe`, właścicielka potwierdziła bazę PR #88 |
| Gałąź | `crazygames-basic1-preparation` |
| Kandydat | @@HEAD@@ |
| Środowisko | Windows 11, Node 22.23.4, Playwright (Chromium 156), Chrome i Edge 156 zainstalowane lokalnie |

## 2. Użyte skille

| Skill | Do czego | Sposób |
|---|---|---|
| `vh-portal-integrations` | Adapter reklam, brak SDK, zachowanie przy błędzie | instrukcja przeczytana i zastosowana |
| `vh-release-manager` | Eksport, manifest, PR, brak publikacji | jw. |
| `vh-qa-automation` | Plan testu, parowanie z bazą, `PASS / FAIL / NOT RUN` | jw. |
| `vh-mobile-accessibility` | Ramki iframe, dotyk, `user-select`, safe area | przegląd wymagań + istniejący `qa/responsive.mjs` na paczce |
| `vh-director` | Nie uruchomiono jako osobnej roli; zakres i decyzje prowadzono wg `CLAUDE.md` | **nie użyto** |
| `vh-ux-gamefeel` | Nie był potrzebny: bez zmian rozgrywki | **nie użyto** |

Spoza tabeli polecenia: zasady `vh-legal-risk` (prywatność, prawa) i `vh-marketing-aso` (okładki)
nie były ładowane; ustalenia wynikają z dokumentacji CrazyGames. Sprzeczności: pakiet nazywa grę
„Vertical Hole”, a gra i repo „Vector Hole” (patrz §16); `PLATFORM_RULES.md` podaje „total size ≤ 250 MB”
bez dopisku, że bez SDK limitem jest 50 MB. Zgodnie z `CLAUDE.md` pakietu nie edytowano.

## 3–5. Wymagania: osiem podstron (odczyt 2026-11-03)

Kolumna **Etap**: B = Basic Launch, F = Full Launch, W = wytyczna (nieobowiązkowa), R = rekomendacja mocna.
Dowód „suite” = `qa/crazygames-basic1.mjs` na prawdziwej paczce.

### Intro (`requirements/intro/`)

| Wymaganie | Etap | Wynik | Dowód / uwaga |
|---|---|---|---|
| Pobranie początkowe ≤ 50 MB, razem ≤ 250 MB (50 MB bez SDK), ≤ 1500 plików | B | PASS | @@SIZE@@ |
| Podstawowa kontrola wizualna QA | B | NOT VERIFIED | decyduje QA CrazyGames |
| Zgodność z PEGI 12 | B | NOT VERIFIED | brak treści budzących wątpliwości w przeglądzie; oceny PEGI nie wystawia ten raport |
| Monetyzacja wyłączona, brak zewnętrznych reklam | B | PASS | suite |
| Brak zewnętrznego logowania | B | PASS | gra nie ma logowania |
| Opis, sterowanie, okładki, filmy | B | PASS (przygotowane), NOT VERIFIED (formularz) | §12–14 |
| SDK + GameplayStart, reklamy przez SDK, konto, wejście od razu do gry | F | NOT APPLICABLE teraz | adapter CrazyGames pozostaje w kodzie na później |
| IAP | F, na zaproszenie | NOT APPLICABLE | brak w paczce |

### Technical (`requirements/technical/`)

| Wymaganie | Etap | Wynik | Dowód / uwaga |
|---|---|---|---|
| Rozmiar i liczba plików jak wyżej; bez SDK liczy się całość | B | PASS | @@SIZE@@ |
| ≤ 20 MB do mobilnej strony głównej | warunek kwalifikacji | PASS | @@SIZE@@ |
| Pliki zewnętrzne: gra w ≤ 20 s | B | NOT APPLICABLE | paczka nic nie pobiera z zewnątrz (0 żądań) |
| Tylko ścieżki względne | B | PASS | suite |
| Chrome i Edge | B | @@BROWSERS@@ | suite, prawdziwe przeglądarki |
| Safari | B (gra może być wyłączona na Safari) | NOT RUN | brak urządzenia |
| Chromium OS 4 GB RAM | B | NOT RUN | brak urządzenia |
| Mobile: mysz, klawiatura i dotyk | B | PASS (emulacja) | suite + `runPlatformInputChecks` na paczce; fizyczne telefony NOT RUN |
| Gra poziomo na komputerze | B | PASS | 10 ramek |
| Orientacje ustawiane w formularzu, gra bez blokady | B | PASS | obrót ramki w trakcie rundy; ustawienie w formularzu: właścicielka |
| `user-select: none` we wszystkich formach | B | PASS | **naprawione** w tym etapie |
| Aplikacja CrazyGames, safe area | B | NOT RUN | gra używa `env(safe-area-inset-*)`, brak dostępu do aplikacji |
| Wznowienie dźwięku po przerwaniu na iOS w geście | B | NOT VERIFIED | kod robi `resume()` w geście (`SoundEngine.unlock()`), fizyczny iPhone NOT RUN |
| SDK: GameplayStart, jeśli zintegrowane | B warunkowo | NOT APPLICABLE | paczka bez SDK |
| Reklamy wyłączone, gra działa | B | PASS | suite |
| Data / User module, Gameplay start/stop | F | NOT APPLICABLE teraz | |
| Sitelock | opcja | NOT APPLICABLE | brak |
| Notatka o prywatności przy danych osobowych | warunkowo | PASS | gra nie zbiera danych; tekst w Profilu; projekt polityki gotowy |
| Informacje o urządzeniu z SDK | R | NOT APPLICABLE | bez SDK |

### Gameplay (`requirements/gameplay/`)

| Wymaganie | Etap | Wynik | Dowód / uwaga |
|---|---|---|---|
| Czytelność przy DPR 1 w 10 ramkach 16:9 | B | PASS (układ i zawartość w ramce), NOT VERIFIED (ocena wzrokowa wszystkich ramek przez QA) | suite, zrzuty `--shots` |
| Fizyka niezależna od odświeżania | B | PASS (emulacja) | @@HZ@@ |
| Angielski | B | PASS | brak polskich tekstów przy `?i18n=log` |
| Język z `locale` SDK, domyślnie angielski | B | PASS wariantowo | bez SDK gra czyta język przeglądarki; inny niż polski = angielski |
| Intuicyjne sterowanie | B | PASS (automat), NOT VERIFIED (odbiór ludzi) | FTUE-1…3 + suite |
| Płynność, brak błędów | B | PASS lokalnie | 0 błędów konsoli; MOBILE-PERF-1 |
| Oryginalność | B | **NOT VERIFIED, ryzyko** | §15: mechanika podobna do Hole.io |
| Bez własnego pełnego ekranu | B | PASS | suite (brak `requestFullscreen`) |
| Bez promocji innych gier i platform | B | PASS | **naprawione**: bez linku wyzwania, bez meta z GitHub Pages |
| Dla odbiorców 13+, PEGI 12 | B | NOT VERIFIED | decyzja QA |
| Nowy gracz od razu w grze, najwyżej 1 kliknięcie | F | PASS (uprzedzająco) | jedno kliknięcie GRAJ, suite |

### Advertisement (`requirements/ads/`)

| Wymaganie | Etap | Wynik | Dowód / uwaga |
|---|---|---|---|
| W Basic reklamy wyłączone, gra działa bez zawieszeń | B | PASS | suite |
| Przyciski reklam nie mogą nic nie robić | B | PASS | **naprawione**: oferty znikają |
| Tylko reklamy przez SDK | B/F | PASS | brak zewnętrznych sieci; 0 żądań |
| Zasady midgame, rewarded, banerów, adblock | F | NOT APPLICABLE teraz | do weryfikacji przy Full Launch |

### Account Integration (`requirements/account-integration/`)

| Wymaganie | Etap | Wynik | Dowód / uwaga |
|---|---|---|---|
| Gra bez kont nie musi mieć modułu User | B | PASS | brak kont |
| Goście mogą grać, brak zewnętrznego logowania | B | PASS | |
| Postęp przez Data module / APS: opcjonalnie | B | NOT APPLICABLE | zapis lokalny |
| Postęp przy koncie CrazyGames, nazwa i awatar | F | NOT APPLICABLE teraz | wymagane dopiero na Full |

### Multiplayer (`requirements/multiplayer/`)

| Wymaganie | Etap | Wynik | Dowód / uwaga |
|---|---|---|---|
| Online with Friends | tylko gry online | NOT APPLICABLE | brak trybu online; boty |
| Boty przedstawione jako gracze | brak zapisu w dokumentacji | NOT VERIFIED | formularz mówi wprost o rywalach AI; rozstrzyga QA |

### Game covers (`requirements/game-covers/`)

| Wymaganie | Etap | Wynik | Dowód / uwaga |
|---|---|---|---|
| 1920×1080, 800×1200, 800×800 | B | PASS | §12 |
| Bez ramek, ikon i tekstu poza tytułem, bez cudzych materiałów, ostre | B | PASS | grafika gry, tytuł jako jedyny tekst |
| Nie zrzut ekranu, prosto, nazwa, stylizowany font | W | PASS | kompozycja własna, font Russo One (OFL 1.1) |
| Film 15–20 s, ≤ 50 MB, 16:9 i 2:3 w 1080p, bez dźwięku | B | PASS | §13 |
| Bez przyspieszania; okładka jako pierwsza klatka | B | PASS | 1 klatka symulacji = 1 klatka filmu |
| Bez czarnych pasów i przejść, kursora, „Play Now”, ikon | B | PASS | klatki kontrolne |
| Formaty plików | brak zapisu | NOT VERIFIED | PNG i MP4/H.264; akceptację pokaże portal |

### Quality Guidelines (`requirements/quality/`)

Wszystko to wytyczne (W), nieobowiązkowe.

| Wytyczna | Wynik | Uwaga |
|---|---|---|
| Onboarding w rozgrywce, krótki tekst, pokazane sterowanie | PASS | FTUE-1, FTUE-3 |
| Jasne cele, czytelne etykiety | PASS | CONTENT-1 |
| Spójny styl grafiki, dźwięku | PASS | VISUAL-1, syntezowane audio |
| Unikalność nazwy | NOT VERIFIED | wyszukiwanie nie znalazło innej gry „Vector Hole” ani „Vertical Hole”; to nie jest badanie znaków towarowych |
| Klawisze: AZERTY | PASS | `e.code` = pozycja fizyczna |
| Escape wychodzi z pełnego ekranu | PASS | pauza też pod P i Spacją |
| Gra solo jest dostępna, a brak gry ze znajomymi nie myli | PASS | gra nie obiecuje trybu online |

## 6–7. Problemy wykryte i poprawki

| # | Problem w `727b8bd` | Skutek na CrazyGames | Poprawka |
|---|---|---|---|
| 1 | Na hoście `crazygames.*` gra sama ładowała SDK, a przyciski nagród zostawały aktywne przy reklamach wyłączonych | Odrzucenie („rewarded ad buttons that do nothing”) | Paczka nie ładuje SDK, dostawca `none`, oferty znikają |
| 2 | Bez portalu działała płatna nagrodą reklama demonstracyjna | Fałszywa reklama | W paczce nieosiągalna |
| 3 | WYZWIJ ZNAJOMEGO kierował na surowy adres pliku gry | Link poza portal | Wiersz ukryty w paczce |
| 4 | Pasek zgody na „statystyki”, których paczka nie zbiera | Pusty komunikat na starcie | Ukryty w paczce, statystyki wyłączone |
| 5 | Meta `og:`, JSON-LD i tytuł z adresem GitHub Pages | Odniesienie do innego hostingu | Usuwane przez eksport |
| 6 | Brak `-webkit-/-moz-/-ms-user-select` na `body` | Lupa i menu na telefonie | Dodane; `input`, `textarea` zostają zaznaczalne |
| 7 | Przy nieudanym SDK portalu oferty zostawały bez działania (każda wersja) | Martwe przyciski | `adsAvailable` obejmuje też ten przypadek |

Nie zmieniano: ekonomii, nagród, misji, wyglądu, panelu TEST, systemu wydań, `index.html` w repo.

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

Tryb wynika ze znaku w pliku strony paczki, nie z adresu URL: `?portal=crazygames` niczego nie włącza
(test). Normalne nagrody są równe w obu wersjach przy tych samych ziarnach (test parami).

Gry nie da się jednak „przełączyć” przez przypadek na Full Launch: SDK wymaga osobnego eksportu
i osobnej decyzji.

## 9. Paczka

@@PACKAGE@@

Polecenie: `node tools/export-crazygames-basic.mjs --out=DIR`. Skrypt odmawia przy brakującym pliku,
ścieżce bezwzględnej, odwołaniu zewnętrznym lub przekroczeniu limitu; dwa przebiegi dają ten sam ZIP.

## 10. Testy w iframe

@@IFRAME@@

## 11. SAVE i regresja

@@REGRESSION@@

## 12. Okładki

@@COVERS@@

## 13. Filmy

@@VIDEOS@@

Rozgrywkę prowadzi bot (sterowanie klawiszami, zasady gry bez zmian); fragmenty rundy łączą zwykłe cięcia.
Wyniki w filmie (`×200`, duże liczby) pochodzą z tej rundy. Grafika odpowiada wersji z komputera (Full HD) i widoku pionowego.

## 14. Materiały do formularza

`docs/crazygames/CRAZYGAMES_SUBMISSION_TEXTS.md`, `docs/crazygames/PRIVACY_POLICY_DRAFT.md`.

## 15. Ryzyka: prywatność i prawa

| Ryzyko | Ocena | Co dalej |
|---|---|---|
| **Podobieństwo do Hole.io** (Voodoo): wir w mieście, rundy 2 minuty | **Główne ryzyko przyjęcia.** Wymaganie mówi o oryginalności nazw, grafik i treści. Grafika, kod, dźwięk i nazwa są własne, a gra ma 240 misji, Miasto i dzienne wyzwania, ale mechanika rdzenia jest ta sama | Ocena QA CrazyGames lub prawnika. Teksty nie wymieniają innej gry |
| Fonty Russo One, Exo 2 | Niskie: SIL OFL 1.1 (nota w `style.css`) | Licencja dopuszcza osadzenie; font w grafice bez ograniczeń |
| Warunki dla deweloperów | Do przeczytania przez właścicielkę | Akceptacja to jej czynność prawna |
| Publikacja na innych portalach | Warunki CrazyGames nie wymagają wyłączności; umowa z Poki nieznana | Właścicielka sprawdza przed zgłoszeniem |
| Tekst prywatności: wydawca bez danych, pusty kontakt | Niskie w Basic, gra nic nie zbiera | OWNER INPUT |
| Nazwy botów wyglądają jak nicki | Niskie, ale formularz musi mówić o AI | Tekst gotowy |
| Paczka zawiera kod panelu TEST (bez kodu dostępu) | Poza zakresem z decyzji właścicielki | Nie analizowano |
| Kod SDK Poki i CrazyGames w `game.js` | Bezczynny w paczce: 0 żądań | Test |
| Plik binarny ffmpeg | Tylko narzędzie lokalne spoza repo | Nie jest zależnością gry |

## 16. Dane od właścicielki (OWNER INPUT REQUIRED)

1. **Nazwa w formularzu:** Vector Hole (rekomendacja) czy Vertical Hole.
2. Nazwa wydawcy, kontakt, adres polityki prywatności.
3. Akceptacja warunków i oświadczenie o prawach, status Poki.
4. Czy włączać mobile już w Basic (brak testów na fizycznych telefonach).

## 17. NOT RUN

@@NOTRUN@@

## 18. Rekomendacja

@@RECOMMENDATION@@

## HANDOFF

@@HANDOFF@@
