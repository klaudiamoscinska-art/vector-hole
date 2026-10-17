# Szablon raportu po wykonaniu zadania

## Cel i zakres
Co było wymagane, granice modyfikacji, niezmienniki z PROJECT_CHARTER.

## Stan zastany (dowód)
Znalezione pliki/funkcje, reprodukcja, baseline. Odróżnij „sprawdzone” od „na podstawie opisu”.

## Decyzja i wykonanie
Alternatywy, wybór, zmienione pliki, uzasadnienie pomiarowe, migracje i feature flagi.

## Weryfikacja
Wykonane dokładne komendy, testy automatyczne, urządzenia/przeglądarki, wartości before/after (jeżeli zmierzone), status PASS/FAIL/NOT RUN. Oddziel `STRUCTURE PASS` (skille) od wyników rzeczywistych testów gry; załącz artefakty/logi.

## Ryzyka, otwarte punkty i cofnięcie
Nieukryte błędy i rzeczy niezweryfikowane, jak wrócić do poprzedniego stanu.

## Wniosek
`SHIP / TEST MORE / FIX / STOP`; 1–3 następne działania według spodziewanego wpływu i kosztu.

## Kontrola przed zadaniem i po zadaniu (P00)
- Git revision i `git status --short` przed/po, data raportu P00, statusy `CORE-ENERGY`, `CORE-ISOLATION`, `CORE-LOOP`, `CORE-SAVE`, osobno `TOOLS-DEV`.
- Oddziel `GO_CORE` od `GO_TOOLS` i `GO_RELEASE`. CORE FAIL = STOP nowych niepowiązanych funkcji; TOOLS FAIL nie blokuje niezależnego FTUE, lecz testy wymagające panelu i wydanie. Jeśli `NOT RUN`, brak dowodu i jawne ryzyko; nie kopiuj statusu PASS ze starego revision.
- Zapis/migracje: fixture'y, zachowanie dawnych sald/odblokowań/inventory. Testy własności boostów: owner i granica kampania→arena.
- Dla FTUE zawsze dwie miary: R5-entry (300 s od wejścia) i A5-playtime (300 s sumarycznego gameplayu), z mianownikami i ograniczeniami zgód.

## Aneks v1.3 — integralność raportu
- Wpisz `source_snapshot_sha256`, licznik plików, datę i fizyczną rewizję gita (`EVIDENCE_FRESHNESS.md`). Zmiana nawet bez commitu może unieważnić wyniki.
- Użyj `.claude/vertical-hole/tools/check_evidence.py` do weryfikacji formalnej, ale nigdy nie pisz, że skrypt przetestował runtime.
- Dla GO_TOOLS załącz rzeczywisty `dev-build`, `release-build`, SHA256 obu katalogów, wynik `verify_release_artifact.py` i test, że produkcja nie udostępnia debug mutatorów. Wymagane ręczne sprawdzenie (`RELEASE_DEBUG_GUARD.md`).
- Dla każdej migracji zachowaj plan odwracalności i wyniki SAVE-01..07 na obecnym kodzie; dopisz nierozwiązane nieznane schematy.
