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
