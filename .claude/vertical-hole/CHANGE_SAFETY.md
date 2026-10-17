# Bezpieczna zmiana i migracje — v1.3

## Granica jednego zadania
Nie zmieniaj jednocześnie mechaniki energii, izolacji trybów, struktury zapisu i całego panelu. **P00 to wyłącznie audyt read-only** i mapa ryzyka, bez patchowania kodu czy workflow gry. Każdy potwierdzony blocker naprawiaj w **oddzielnej sesji PX01–PX05** z paczki promptów, z testem po ostatniej zmianie i ponowieniem P00 po zamknięciu kolejki. Nigdy nie wykonuj etapów implementacyjnych jako dalszych faz P00. Przy awarii zatrzymaj zakres zamiast maskować problem przypadkowymi nowymi funkcjami. Nie twórz sztucznych PASS, aby odblokować następny prompt.

## Przed każdym patchem
- `git status --short` i lista plików z lokalnymi zmianami. Nie `git reset --hard`, `git clean -fd`, nie nadpisuj niezidentyfikowanych zmian, nie rób automatycznego commitu ani push.
- Ustal bazowe testy, backup testowy i ścieżkę rollback. Dla destrukcyjnych migracji, zmian płatnych nagród, usuwania wartości konta lub publicznego deployu → **oddzielna akceptacja właścicielki**; kod może jedynie przygotować niedestrukcyjną ścieżkę.
- Jeśli zmiana dotyka zapisu, spisz `legacy_version → parser → migrated_version`, klucze źródłowe, właściciela areny/dzielnic, zachowane uprawnienia, scenariusze przerwania i wielu kart / synchronizacji SDK. Najpierw fixture i test migracji; dopiero potem modyfikacja.

## Wymagane testy bezpieczeństwa zapisu
1. Zatrzymanie między etapami zapisu i powtórzenie operacji (idempotencja), błąd quota/storage, uszkodzenie tylko jednego namespace.
2. Jednoczesne otwarcie dwóch kart, conflict/stale write, o ile wspierany multi-tab/storage; przy cloud: opóźnienie/sprzeczna wersja i offline→online.
3. Uprawnienia i saldo nie znikają, reward claim nie jest duplikowany; `arena` nie importuje boostów kampanijnych. Podwójna migracja da równoważny stan.
4. Cofnięcie binariów po migracji: jeżeli starszy klient nie rozumie nowego schematu, wymagany plan kompatybilności/rollback, a nie bezmyślny zapis starego formatu.
5. Historyczny `energy` to **tylko odczyt legacy**, a nie źródło live cooldownu/limitów wejść.

## Wynik
Zapisz dla każdej fazy `scope`, dane wejściowe, dotknięte pliki, komendy i rzeczywiste logi, źródła niepewności, `PASS / FAIL / NOT RUN`, oraz czy kolejny etap może zacząć się bez naruszenia niezmienników. Dowody muszą dotyczyć końcowego snapshotu — patrz `EVIDENCE_FRESHNESS.md`. Brak środowiska do testów oznacza pracę częściową, nie zieloną bramkę.

**STOP operacji destrukcyjnej:** jeśli nie potrafisz wykazać zachowania istniejących sald, kupionych przedmiotów i nagród przy migracji na rzeczywistym schemacie, w tej sesji pozostaw oryginalne dane bez zmian; opisz ryzyko i poproś o osobną decyzję.
