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
