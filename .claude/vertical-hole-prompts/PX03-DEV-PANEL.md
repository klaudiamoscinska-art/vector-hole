/vh-test-console W aktualnym repo Vertical Hole wykonaj WYŁĄCZNIE naprawę VH-01 — oddzielny panel developerski bez debug kodu w produkcji; wyłącznie gdy aktualne P00 potwierdzi problem.

# PX03 — Panel testowy tylko w wydaniu DEV (VH-01, P0 release)
**Skille pomocnicze:** `vh-game-engineer`, `vh-save-security`, `vh-release-manager`, `vh-qa-automation`.

1. Przeczytaj P00, `.claude/vertical-hole/{RELEASE_DEBUG_GUARD,SAVE_MIGRATION_CONTRACT,CHANGE_SAFETY,EVIDENCE_FRESHNESS}.md` oraz stan repo. Sprawdź prawdziwe build entrypoints, `class DevPanel`, `window.game.devPanel`, debug mutatory, tokeny/kody, sourcemapy i dynamicznie ładowane skrypty. Samo ukrycie guzika/hasło/flag runtime NIE izoluje produkcji. Jeśli kod produkcyjny już nie zawiera implementacji, nie zmieniaj nic na zapas.
2. Zrób **dwa fizycznie rozłączne artefakty** z jednoznacznym procesem budowania: DEV z panelem i przełącznikiem trybów testowych, RELEASE bez kodu klasy panelu, globali, mutatorów i pośrednich importów. Oddziel zapis testowy od normalnych profili; dev musi pozostać prosty do uruchomienia i używania na telefonie, w tym instrukcja dla właścicielki. Nie wprowadzaj sekretów do JS publikowanego klientowi ani mechanizmów obchodzenia release.
3. Kontrola: `python .claude/vertical-hole/tools/verify_release_artifact.py --dev-build <katalog_dev> --release-build <katalog_release>` z prawdziwymi ścieżkami; ręczny skan JS/HTML/sourcemap, dev global API, ewentualnego lazy chunk, direct URL debug i storage. Test pozytywny DEV: bezpieczna aktywacja panelu na telefonie i operacje unlock/reset tylko na izolowanym teście. Test negatywny RELEASE: żadna droga do debug API/panelu/mutatorów, bez wycieku danych lub dostępu przez parametry URL. Gdy nie ma telefonu: mobile NOT RUN.
4. Nie naprawiaj konfliktu przez usunięcie panelu z DEV. Dokumentuj instrukcję „jak uruchomić na telefonie”, testy, fingerprint obu artefaktów i rollback. Jeśli instalacja projektu nie pozwala bezpiecznie wydzielić dwóch artefaktów, **STOP** i przedstaw minimalny plan przed zmianą architektury.

**Kryterium zamknięcia:** `TOOLS-DEV=PASS` dopiero przy działającym DEV i bezpiecznym RELEASE po testach na aktualnych buildach. Nie deployuj, nie pushuj bez zgody. Po zmianie powtórz release guard, SAVE i adekwatną część P00.

**Raport końcowy (obowiązkowy):** podaj dla każdego testu `PASS/FAIL/NOT RUN` z dowodem lub brakiem dowodu, zaktualizowane pliki, polecenia, ewentualny rollback oraz stan odpowiedniej bramki. Jeśli coś nadal jest `FAIL` albo `NOT RUN`, nie deklaruj ukończenia. **Nie publikuj ani nie pushuj bez zgody właścicielki.**

**Niezbędny smoke po wycięciu kodu panelu:**
Po fizycznym wydzieleniu DEV sprawdź, że release nie wywołuje osieroconych `DEV`, `devBoot`, `DevPanel` ani debug storage i nie rzuca `ReferenceError` w rzeczywistym uruchomieniu `index.html → start → runda → zapis → reload`. Skrypt markerów PASS nie wystarcza. Zachowaj mobilny dostęp do DEV na osobnym testowym adresie/artefakcie, bez ujawniania produkcyjnych danych i bez publikowania go jako release.
