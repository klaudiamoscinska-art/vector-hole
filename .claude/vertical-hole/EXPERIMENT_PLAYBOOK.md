# Plan eksperymentów „Złoty Strzał” — bez obietnicy sukcesu

## Faza A — pierwsza wartość
**Hipoteza:** gracz chce wrócić do areny po pierwszym tier-upie. Obserwuj 5–10 krótkich sesji z nowymi graczami i mierz czas pierwszego pochłonięcia, rozumienie celu, przeszkody i spontaniczny restart. To *diagnostyka jakościowa*, nie reprezentatywny wskaźnik retencji.

## Faza B — Arena First vs bogaty hub
**Wariant kontrolny:** istniejący flow albo minimalnie zmieniony hub.
**Wariant testowy:** natychmiastowa arena + opcjonalny Core City.
**Primary metric:** `restart_rate` lub aktywny czas gry/sesję, ustal przed testem.
**Guardrails:** load→play, crash, FPS, frustracja graczy, wykonalność celu, reklamy i skip.
**Wymóg:** randomizacja tylko jeśli jest stabilne przypisanie i wystarczający ruch; przy braku danych najpierw mały test moderowany oraz instrumentacja. Nie traktuj wyników sztucznego bota jako wyników graczy.

## Faza C — game feel
Jeden element naraz: czytelniejszy sucking effect, większy pierwszy upgrade, krótszy ekran wyniku lub bardziej wyrazisty Złoty Rdzeń. Porównaj w zbliżonych warunkach, nie zmieniaj jednocześnie ekonomii, grafiki i reklam bez pomiaru efektu.

## Faza D — reklamy
**Warunek wejścia:** gra bez reklam jest satysfakcjonująca i stabilna. Sprawdź najpierw obecność poprawnie zintegrowanych naturalnych opportunities; potem wpływ rewarded opt-in na porzucenia i replays. Zdarzenie reklamowe ≠ przychód; bazuj na danych portalu.

## Faza E — dystrybucja
Stwórz porównywalne okładki/krótkie klipy oddające faktyczny gameplay. Zmierz click→ready→first input→repeat jeśli dane są dostępne. Nie optymalizuj CTR kosztem zaufania do produktu.

## Decyzja na koniec
Jednoznacznie: `SCALE`, `ITERATE`, `PAUSE`, `PIVOT` wraz z datami, próbą, kosztami i pozostałą niepewnością. Bez stałych, wymyślonych benchmarków dla każdego portalu i bez żądania gwarancji „hitu”.

## Kolejność inwestycji i metryki pierwszych 5 minut
1. P00 i usunięcie P0/P1 wpływających na grę → 2. minimalna legalna instrumentacja FTUE (`P14D`) → 3. mała, odwracalna iteracja pierwszych minut (`P04-05`) → 4. playtesty i korekta → 5. dopiero kosztowniejszy warsztat, nagrody i nowa ekonomia, jeśli nie blokują rundy.
W scenariuszach 0–300 s osobno raportuj `r5_entry_300s` oraz `active_play_300s`; pierwszy jest celem „gracz po 5 minutach od wejścia”, drugi nie może zastąpić pierwszego. Boty i testy seedowane weryfikują mechanikę, nie retencję.

## Protokół obserwacji FTUE i decyzji (v1.2)
Przed zmianą opisz jeden scenariusz 0–300 s, wersję builda, urządzenie, zadania i frustracje. Dla **5–10 nowych osób** (diagnostycznie, bez deklaracji reprezentatywności) obserwuj bez podpowiadania: rozumienie celu, pierwszy swallow, tier-up, porzucenie, zakończenie pierwszej rundy, wybór „Następna arena” i drugi start. Zapisuj czas/zdarzenie/komentarz oraz czy osoba otrzymała instrukcje; oddziel testerów znajomych od świeżych użytkowników. Po jednej niewielkiej zmianie powtórz porównywalny test; porównanie grup nie jest automatycznie randomizowanym A/B.

Przed pomiarem FTUE sprawdź `EVENT_TAXONOMY.md`: mianownik wszystkich wejść może być niedostępny, telemetry consent może istotnie zmieniać próbę. Z góry ustal **główną metrykę**, warunki porównania, guardrails (crash, softlock, load time, FPS, zrozumienie celu) i minimalne dane do decyzji. `ITERATE`: powtarzalne tarcie lub poprawa bez szkody guardrails; `TEST MORE`: zbyt małe `n`, niekompletna obserwacja lub sprzeczne wyniki; `PAUSE`: krytyczny błąd/migracja/zgody; `PIVOT`: po wielu iteracjach nie ma poprawy i jest udokumentowana przyczyna produktowa. Nie ustawiaj magicznego progu R5 ani nie ogłaszaj A/B success z 5 testerów. Raport: fakty/hipotezy, skala, mianowniki, unknown, before/after i decyzja.
