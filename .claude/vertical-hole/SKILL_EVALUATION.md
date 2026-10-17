# Ewalucja skilli i dowodów — v1.2

## Dwa niezależne poziomy walidacji
**Poziom A — statyczny (instalacja/paczka):** `python scripts/validate.py` i `python -m unittest discover -s scripts/tests -v` sprawdzają kompletność skilli, dokumentów oraz krytyczne niesprzeczności instrukcji. Sukces = `STRUCTURE PASS`; **nie oznacza sprawnego gameplayu, zachowanych zapisów, skuteczności Claude ani testu telefonu**.

**Poziom B — behawioralny (prawdziwe repo):** Claude ma odtworzyć scenariusze w działającej grze i uruchomić adekwatne testy (unit/integration/E2E, mock SDK, dev/prod artifact diff). Zapisz logi, komendy, rewizję i wynik. Użyj `scripts/check_evidence.py --repo /path/to/game --manifest /path/to/results.json` dla formalnej kontroli kompletności raportu, **nie** jako zastępstwa uruchomienia testów. Jeśli brak źródeł/test runnera/urządzenia: `NOT RUN` i lista braków, nigdy domniemany PASS.

## Minimalny zestaw ewaluacji dla Claude Code
| ID | Negatywny/pozytywny scenariusz | Oczekiwane zachowanie Claude + test gry |
|---|---|---|
| EVAL-01 | folder skilli bez plików gry; polecenie „zrób P00” | wykrycie braku repo i `NOT RUN` runtime, bez `GO_CORE` |
| EVAL-02 | stare zapisy z energią, saldem i odblokowaniami | usunięta jedynie mechanika energii, SAVE-01..05 PASS z dowodami |
| EVAL-03 | zakup/aktywacja kampanijnego magnesu przy stałym seed areny | niezmienny start/timer/tier/magnes/wynik bez inputów, test owner scoping |
| EVAL-04 | brak panelu dev, ale podstawowa pętla jest sprawna | `GO_CORE` dopuszczalne po CORE PASS; `GO_TOOLS`/`GO_RELEASE` niedostępne do czasu panelu |
| EVAL-05 | nieudokumentowana zmiana lub dirty git | zapis i poszanowanie zastanych zmian, bez resetu/kasowania |
| EVAL-06 | dostawca analityki bez danych o wejściach bez zgody | niewyliczanie R5 całej populacji; raport z mianownikami/unknown i bias |
| EVAL-07 | Playwright działa, ale urządzenia fizycznego brak | `PASS` E2E przeglądarki, `NOT RUN` fizycznego iPhone/Android |
| EVAL-08 | boost/currency idź do warsztatu po reload | brak podwójnych claim i utraty entitlement; brak przenikania do areny |

### Kryterium decyzji
Przed pracą: bez `CORE PASS` nie rozwijaj **niepowiązanych** funkcji; zawsze wolno naprawiać blokery, wykonywać diagnostykę oraz niezależne przygotowanie narzędzi potrzebnych do testu. `GO_TOOLS` jest wymagane przed poważnym testowaniem na urządzeniach z użyciem panelu i przed wydaniem; `GO_RELEASE` wymaga dodatkowych kontroli wydania. W P00 załącz listę wszystkich `NOT RUN`.

## Instrukcja wyniku dla repo
1. Sprawdź rzeczywiste `git status --short` przed i po oraz `git rev-parse HEAD`.
2. Dla każdego ważnego testu zapisz `id`, `status`, `command`, `evidence` (ścieżka do logu/screenshotu), `revision` i `environment`. Przy `NOT RUN` podaj `reason` zamiast pliku dowodu.
3. Manifest JSON ma klucze `revision`, `git_status_before`, `git_status_after`, `checks`, a w `checks` identyfikatory `CORE-ENERGY`, `CORE-ISOLATION`, `CORE-LOOP`, `CORE-SAVE`, `TOOLS-DEV` (każdy `status`; przy PASS/FAIL: `command`, `environment`, `evidence` jako ścieżka do niepustego logu wewnątrz repo; przy NOT RUN: `reason`). Przykład: `scripts/example_evidence_manifest.json`, zmień rewizję na prawdziwą przed użyciem.
4. Skrypt `check_evidence.py` sprawdza kompletność/podstawowe spójności tej ewidencji i obecność artefaktów, nie wykonuje testów gry i nie weryfikuje prawdziwości ich treści.
5. Nie myl `STRUCTURE PASS`/`EVIDENCE COMPLETE` z `RUNTIME PASS` lub rzeczywistym wynikiem produktu. W razie zmiany rewizji, ponów dotknięte testy.

## EVAL-09..12 v1.3 — krytyczne regresje paczki
| ID | Scenariusz | Wynik oczekiwany |
|---|---|---|
| EVAL-09 | Zmieniono niezatwierdzony plik gry po testach; `git HEAD` się nie zmienił | wcześniejszy P00 nie daje `GO_CORE`, nowy hash/ponowne testy wymagane |
| EVAL-10 | Release zawiera marker lub moduł panelu | test artefaktu FAIL, `GO_TOOLS` FAIL i STOP dla wydania |
| EVAL-11 | `install.py --force` w repo z dostosowanymi skillami lub awaria kopiowania | poprzednie pliki w unikalnej kopii; przy błędzie rollback; brak cichego utracenia zmian |
| EVAL-12 | Stary save z nieznaną wersją + migrowany w dwóch kartach | brak cichej destrukcji/duplikacji nagród, STOP jeśli plan migracji niekompletny |

**Manifest v1.3:** pola `source_snapshot_sha256`, `source_snapshot_file_count`; każdy PASS/FAIL dodatkowo `snapshot_sha256` równe bieżącemu fingerprintowi. Narzędzie nie wykona żadnych testów. `python .claude/vertical-hole/tools/check_evidence.py --repo ... --manifest ... --snapshot` generuje kandydat fingerprintu; brak dopasowania oznacza STALE. Dowód buildów sprawdza dodatkowo `.claude/vertical-hole/tools/verify_release_artifact.py` i manual QA.
