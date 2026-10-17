# Świeżość dowodów P00 — obowiązkowa bramka v1.3

## Problem i reguła
`git rev-parse HEAD` nie zmienia się przy edycji niezatwierdzonych plików. Raport PASS z tego samego commitu może więc dotyczyć INNEGO kodu. **GO_CORE/GO_TOOLS obowiązują tylko dla dokładnego snapshotu źródeł i wyników testów wykonanych po ostatniej istotnej zmianie.** Sam hash, nawet poprawny, nie uruchamia testu ani nie certyfikuje działania gry.

## Ślad wykonania (aktualne repo)
1. Zanotuj `git rev-parse HEAD`, `git status --short`, docelową platformę, test runner, wariant builda i środowisko. Nie usuwaj niezatwierdzonych zmian.
2. Zakończ dany, ograniczony patch, uruchom odpowiednie testy **NA KOŃCOWEJ wersji kodu** i zapisz logi oraz artefakty; po kolejnej zmianie kodu testy dotkniętych obszarów tracą PASS do czasu powtórki.
3. Utwórz `VH_PREFLIGHT_MANIFEST.json` na bazie `scripts/example_evidence_manifest.json` (lub użyj `.claude/vertical-hole/tools/example_evidence_manifest.json` po instalacji). Dla PASS/FAIL podaj `command`, `environment`, `evidence` **wyłącznie w `.claude/vertical-hole/evidence/`** i `snapshot_sha256`. Zapisz tam logi/screenshoty. NOT RUN ma `reason`. Nie wolno wskazywać pliku źródłowego gry jako ścieżki dowodu.
4. Z katalogu repo gry uruchom `python .claude/vertical-hole/tools/check_evidence.py --repo . --manifest VH_PREFLIGHT_MANIFEST.json --snapshot`. Wypisany hash wstaw do `source_snapshot_sha256` **i do każdego PASS/FAIL check jako `snapshot_sha256`**; następnie uruchom bez `--snapshot` i zweryfikuj raport.
5. Po zmianie dowolnego pliku kodu/testu/konfiguracji builda odtwórz snapshot i wymagane testy. Kod poprawiony po wcześniejszym PASS ≠ automatycznie PASS. Skrypt wyświetla `CANDIDATE`, a o GO decydują rzeczywiste logi i zakres testów.

## Granice fingerprintu
Narzędzie hashuje byte-for-byte pliki śledzone i nieskryte nieśledzone w `git ls-files -co --exclude-standard`, oprócz raportu P00, zatwierdzonej lokalizacji manifestu (`VH_PREFLIGHT_MANIFEST.json` lub `.claude/vertical-hole/evidence/...`), dowodów **wyłącznie** z `.claude/vertical-hole/evidence/` i katalogu kopii instalacyjnych. Dowolna ścieżka dowodu z manifestu nie może już wyłączyć kodu z odcisku. Każda ścieżka poza repo lub symlink do innej lokalizacji to błąd. **Pliki ignorowane przez Git, w tym typowe `dist/`, nie są objęte snapshotem źródeł:** dla nich dowodem jest osobny hash artefaktu builda oraz `verify_release_artifact.py` i testy SDK. Repo z nietypowym `.gitignore` trzeba zweryfikować ręcznie.

## Szczególnie ryzykowne przypadki
- P00 po dużej edycji bez nowego testu → `NOT RUN`, nawet gdy HEAD pozostaje identyczny.
- Zapis legacy z nieznanym schematem / buildem w starszej wersji → STOP destrukcyjnego zapisu i plan odwracalności; nie zaznaczaj CORE-SAVE PASS dla nieprzetestowanych formatów.
- Nie ma fizycznego telefonu → E2E emulatora może PASS, ale osobny test fizyczny = NOT RUN; w bramce wymagającej urządzenia GO_TOOLS nie ma PASS.
- Brak repo / brak runtime → zawsze `NOT RUN` dla gry, nawet jeśli walidacja samego ZIP przechodzi.
