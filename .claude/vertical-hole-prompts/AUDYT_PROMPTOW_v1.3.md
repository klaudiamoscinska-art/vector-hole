# Zmiany krytyczne w promptach — v1.3

Wszystkie prompty są zgodne z paczką 22 skilli v1.3. Nie wklejaj starych plików v1.2 po instalacji nowych skilli bez sprawdzenia ich wymagań `source_snapshot_sha256`.

1. **`P00`** — kolejność: audyt read-only, jedna spójna naprawa, testy; nie obejmować równocześnie destructive legacy migration i przebudowy panelu. GO_CORE i GO_TOOLS oddzielnie; testy na końcowym snapshotcie, nie tylko `git HEAD`.
2. **`P11`, `P12`, `P14E`** — żaden zakup/entitlement/saldo nie może zginąć w zmianie ekonomii. Stop przy nieznanym formacie save, testy po patchu.
3. **`P04-05`, `P14D`** — przeglądarka może wstrzymać 300-sekundowy timer; nie zaliczać opóźnionego callbacka jako retencji. Brak niezależnego mianownika = tylko kohorta obserwowana.
4. **`P14A`, `P14B`** — osobny kontrakt Poki/CrazyGames, orientation w submission CrazyGames; nie duplikować rotate overlay na portalu.
5. **Pozostałe 8 promptów** — weryfikacja świeżego P00 po niezatwierdzonych zmianach, minimalny zakres i rzeczywiste testy.

**Uwaga:** Żaden prompt nie udowadnia działającej gry samą obecnością w ZIP. Raport Claude Code ma podawać faktyczne polecenia, logi, zmienione pliki i `PASS/FAIL/NOT RUN`.
