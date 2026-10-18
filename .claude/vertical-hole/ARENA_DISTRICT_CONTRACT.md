# Kontrakt izolacji — Arena i Dzielnice (obowiązkowy)

## Granice i właściciele danych
- **Arena:** start i ponowny start rundy, fizyka, czas, tier dziury, spawn, rywale, score, rankingi/rekordy areny, konfiguracja rundy. Własny stan ulotny i oddzielony zapis progresji areny, jeżeli istnieje.
- **Dzielnice:** wybór misji, odblokowania, cele, ukończenia, lokalne nagrody i progres kampanii. Własna przestrzeń zapisu i schemat migracji.
- **Wspólne neutralne:** ustawienia audio/sterowania/dostępności, język i skiny czysto kosmetyczne. Wspólna usługa zapisu dopuszczalna przy rozdzielonych kluczach i kontrakcie.
- **Warsztat/waluty:** przedmioty i waluty zachowują jawne właścicielstwo i zakres działania. Zakup, nagroda, booster czy zużycie w kampanii nie może automatycznie zwiększać rozmiaru, czasu, magnesu, liczby prób, wyników ani dostępności areny. Wyjątki **nie powstają przez implementację** — każda zmiana tej reguły wymaga osobnej jawnej decyzji produktowej użytkowniczki przed pracą.

## Zakazane zależności
1. `startArena` i `restartArena` nie mogą odczytywać `districtUnlocked`, `districtLevel`, `campaignEnergy`, stanu zakupów kampanii lub odblokowań warsztatu jako warunku wejścia ani ukrytego modyfikatora balansu.
2. Reset/wczytanie/migracja dzielnic nie może modyfikować wyniku lub progresji areny ani blokować CTA „Następna arena”.
3. UI nie może prezentować kampanijnych nagród jako modyfikatorów areny, jeżeli silnik ich nie obsługuje w zatwierdzonym kontrakcie.
4. Zapis musi migrować rozdzielone dane bez zerowania cudzych odblokowań. Testuj ścieżkę stary save → migracja → reload.

## Minimalna matryca testów kontraktowych
- Dzielnice: `new/locked`, `partly completed`, `finished`, `corrupted/missing`. Dla każdego start/restart areny = działa z tymi samymi ustawieniami i seedem (wynik może zależeć od działań gracza, nie od postępu kampanii).
- Zmiana stanu kampanii lub zakup kampanijnego boosta podczas/między rundami nie zmienia parametrów areny. Test różnic obiektu stanu przed/po.
- Ukończona arena nie odblokowuje misji ani parametrów kampanii; ewentualne wyłącznie kosmetyczne/informacyjne elementy wspólne muszą zostać jawnie zaakceptowane.
- Oddzielny zapis/reset/migracja oraz odporność na brak lub uszkodzony fragment każdego trybu.
- Test kliknięcia głównego CTA po pierwszej rundzie prowadzi do następnej areny bez wymagania wejścia do miasta.

## Praktyczna procedura
Najpierw odkryj rzeczywiste pola/ścieżki w repo; kontrakt jest semantyczny, nie wymusza dosłownych nazw. Sporządź tabelę `właściciel → odczyty/zapisy → wpływ na drugi tryb`, dodaj testy na granicy modułów i raportuj wyjątki jako FAIL, nie optymalizację.

## Kontrakt boostów v1.2
Dla KAŻDEJ oferty zapisz tabelę `product_id → owner (arena/districts/cosmetic-neutral) → źródło danych → aktywacja → czas wygaśnięcia → klucz zapisu`. `districts` oznacza efekt tylko w misjach kampanii; `arena` tylko w arenie, nie może importować stanu dzielnic. Neutralne kosmetyki nie mogą dawać przewagi. Nazwy funkcji w dokumentacji są przykładami, nie API do przepisania.

Test kontraktowy BOOST-01: dla deterministycznego seeda porównaj parametry i sekwencję wynikową areny przed/po nabyciu/aktywacji/zresetowaniu kampanijnego magnesu, pryzmatu i innego boosta; identyczny input musi dawać identyczny wynik, chyba że rzeczywisty RNG nie jest deterministyczny (wtedy porównaj bezpośrednie modyfikatory). BOOST-02: kampanijny magnes działa aż do końca *kampanijnej misji* (jeśli taka oferta istnieje) przez pauzę/reload zgodnie z opisem. BOOST-03: arena-only produkt (jeśli istnieje i jest jawnie zaakceptowany) nie zmienia dzielnic. **Nie traktuj wspólnego kodu efektu jako wspólnego prawa do jego aktywacji.**

Migracja i historyczne salda: patrz `SAVE_MIGRATION_CONTRACT.md`.

## Test regresyjny ekonomii i skinów — krytyczne doprecyzowanie 2026-10-17
W sprawdzonym `game.js` wspólny `save.coins` finansuje `RUN_TOOLS` Areny oraz przedmioty kampanii; `grantXp` jest wywoływane z obu trybów, a wyposażone `SKINS` mają właściwość `perks` (prędkość/magnes/rozmiar startowy/punkty). To **nie są same kosmetyki**. Nie przyznawaj PASS tylko po udanym starcie Areny bez dzielnic.
- Test A: identyczny seed/ustawienia/stats i ekwipunek bez wpływu kampanii → pierwszy start Areny; potem przyznaj kampanijną nagrodę monet/XP i powtórz. Udokumentuj źródło waluty i jej możliwość zakupu `RUN_TOOLS` (pośrednia przewaga to także naruszenie).
- Test B: przełącz kolejno skin o premii do `speed`, `magnet`, `startUnits`, `score` kupowany z monet pozyskanych w kampanii; odczytaj bieżące parametry w Arenie. Wyjątek dla czysto kosmetycznego trofeum `aurora` nie legalizuje pozostałych bonusów.
- Test C: gdy potrzebna naprawa, nie wymazuj stanów graczy: wydziel `arena`/`campaign`/`cosmetics`, zaplanuj saldo historyczne i kompensację uprawnień, uzgodnij decyzję produktową przed migracją; test SAVE-01..09.

## Decyzja właścicielki PX02 D+ (2026-10-17) — stan repo po wdrożeniu
Reguła dla gracza: **„W Arenie liczy się to, jak grasz. Monety kupują wygląd i wzmocnienia misji”.** Decyzja zapadła przed implementacją (DEC-1…DEC-7); poniższy wyjątek jest **jawny i zaakceptowany**, nie powstał przez implementację.

| Zasób / oferta | Właściciel | Źródło | Aktywacja | Wygaśnięcie | Klucz zapisu |
|---|---|---|---|---|---|
| Wiry `SKINS` (10, w tym Kryształ, Pryzmat, Aurora) | cosmetic-neutral | Warsztat (monety), Core City, M24 | założenie w Warsztacie | — | `owned`, `selected` |
| Smugi / Efekty / Finisze | cosmetic-neutral | Warsztat (monety, pryzmaty), Core City, IAP | założenie | — | `auras`, `effects`, `overdriveSkins` |
| `MISSION_BOOSTERS` (Zegar, Turbo start, Sprint, Magnes, Tarcza) | districts | zapas, monety, pryzmaty, reklama `booster_ad`, IAP, Skrzynie gwiazd, NELA | odprawa misji | koniec misji | `boosters` |
| +20 s misji | districts | reklama `mission_revive`, 8 ◆ | koniec czasu misji | koniec misji | — |
| Mutacje / Złoty Rdzeń / SZAŁ | arena (w rundzie) | sama rozgrywka | w rundzie | koniec rundy | — |
| ×2 monet po rundzie | arena (nagroda) | reklama `result_double_coins` | ekran wyniku | — | `coins` |
| Monety, pryzmaty | wspólny portfel | oba tryby | — | — | `coins`, `prisms` |
| XP / poziom konta | wspólne, bez wpływu na rundę | oba tryby | — | — | `player` |

- **Usunięte (D+):** perki wirów (`SKINS[].perks`, `Game.perk()`), `RUN_TOOLS` (Tarcza / Magnes / Turbo start przed rundą), ekran „WYBIERZ WSPARCIE”, karta Turbo po przegranej i reklama `turbo_free`. Arena, Wyzwanie dnia i wyzwania znajomych startują z tymi samymi parametrami dla każdego profilu.
- **Jawny, zaakceptowany wyjątek (DEC-5):** wspólny portfel. Monety zdobyte w Arenie mogą opłacić wzmocnienie misji Dzielnic, **wyłącznie świadomym zakupem w odprawie** (Arena → Dzielnice). W drugą stronę nic nie płynie: postęp, nagrody, monety i zakupy Dzielnic nie zmieniają parametrów, startu, wyniku, czasu ani dostępności rundy Areny. Wspólna waluta sama w sobie nie jest naruszeniem, bo w Arenie nie ma na co jej wydać, co zmieniałoby rundę.
- **Kompensata (DEC-3/DEC-4):** jednorazowy zwrot ceny z cennika za posiadane płatne wiry (100+220+450+800+1300+2000 = 4870 za komplet), raz na linię zapisu (`economy.looksOnly`); Kryształ i Pryzmat bez zwrotu. Szczegóły i ograniczenia (wiele niezależnych linii zapisu bez backendu): `docs/GAME_DESIGN.md` §1a.
- **Test kontraktowy:** `node qa/px02-isolation.mjs` (ISO-A…D, BOOST-01…03, LEGACY-01…08). Każda nowa oferta, która zmienia rundę Areny i jest dostępna za monety, pryzmaty, reklamę, IAP lub postęp Dzielnic, łamie ten kontrakt i wymaga nowej decyzji właścicielki przed pracą.
