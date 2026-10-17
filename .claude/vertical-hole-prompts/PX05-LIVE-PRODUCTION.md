/vh-qa-automation W aktualnym repo Vertical Hole wykonaj WYŁĄCZNIE weryfikację VH-05 — test prawdziwej opublikowanej gry, NIE pozorowanego hosta. Nie wdrażaj gry.

# PX05 — Wiarygodny test prawdziwego URL (VH-05, P0 bramka release)
**Skille pomocnicze:** `vh-release-manager`, `vh-test-console`, `vh-game-engineer`.

1. Przeczytaj P00 oraz `.claude/vertical-hole/{RELEASE_DEBUG_GUARD,QUALITY_GATES,EVIDENCE_FRESHNESS,TEST_MATRIX}.md`; sprawdź `qa/dev-panel.mjs` i inne E2E. W szczególności wykryj czy sekcja `production host (simulated)` robi `context.route(...).fulfill` z lokalnych plików. **Taki test wolno zachować jako jednostkowy/symulowany, ale NIGDY jako dowód prawdziwego hosta.**
2. Stwórz/uruchom osobny test REAL-LIVE: faktyczne żądania do `https://klaudiamoscinska-art.github.io/vector-hole/`, BEZ `context.route`, HAR replay, mock server, local file replacement, service-worker substitution czy trybu offline. Udokumentuj HTTP statusy, skuteczne ścieżki assetów, Cache-Control, liczbę załadowanych plików i fingerprint SHA256 otrzymanych bajtów, porównując z **zatwierdzonym artefaktem RELEASE** o jednoznacznej rewizji. Wyczyść/omiń cache w sposób bezpieczny dla testów. Uwaga: porównanie z bieżącym HEAD bez potwierdzenia wdrożonej rewizji to niewiarygodny dowód.
3. Negatywne testy na prawdziwym hostcie: brak `DevPanel` i debug mutatorów (w tym ukrytych lazy JS/sourcemap); brak możliwości użycia kodu testowego; brak przypadkowo opublikowanych narzędzi `.claude`/testów/source. Potwierdź działanie podstawowej pętli Areny i save na izolowanym testowym profilu w przeglądarce; telefon fizyczny `NOT RUN`, jeśli go nie masz. Nie niszcz stanu prawdziwych użytkowników.
4. **Warunek historycznego deploymentu:** jeżeli nowy, poprawiony RELEASE nie został jeszcze opublikowany, nie oznaczaj tego testu jako PASS dla nowego builda. Możesz zbadać obecny host i raportować jego stan, ale `GO_RELEASE=STOP/NOT RUN` do czasu świadomie zatwierdzonej publikacji i ponownego testu. Nie rozpoczynaj deploymentu bez zgody.
5. Zapisz raport `LIVE-PRODUCTION=PASS/FAIL/NOT RUN`, porównanie hashów, revision/deployment, dowody sieciowe i ograniczenia; napraw tylko sam błędny test QA, nie samą aplikację ani deploy. Stare testy symulowane oznacz wyraźnie `SIMULATED`, nie `PRODUCTION`.

**Kryterium zamknięcia:** zweryfikowany, rzeczywiście opublikowany artefakt, osobny negatywny test publicznego hosta oraz poprawne oznaczenie braku dowodów. Nie publikuj, nie pushuj.

**Raport końcowy (obowiązkowy):** podaj dla każdego testu `PASS/FAIL/NOT RUN` z dowodem lub brakiem dowodu, zaktualizowane pliki, polecenia, ewentualny rollback oraz stan odpowiedniej bramki. Jeśli coś nadal jest `FAIL` albo `NOT RUN`, nie deklaruj ukończenia. **Nie publikuj ani nie pushuj bez zgody właścicielki.**

**Zakres weryfikacji (bez ukrytego wdrożenia):**
Możesz poprawić wyłącznie lokalne testy QA, aby odróżniały jawnie symulację od testów produkcyjnych; nie zmieniaj gameplay, live hosta ani workflow. Rozróżnij status obecnie dostępnego LIVE od statusu nowego RELEASE, którego jeszcze nie opublikowano. Nie oznaczaj testu nowego wydania PASS na podstawie starego live. Jeżeli środowisko nie pozwala pobrać rzeczywistych bajtów publicznego URL, raportuj `NOT RUN` i przedstaw powtarzalną procedurę do uruchomienia przez Claude w repo z dostępem do sieci.
