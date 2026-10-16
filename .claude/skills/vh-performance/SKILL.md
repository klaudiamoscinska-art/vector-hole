---
name: vh-performance
description: "Optymalizacja Vertical Hole na przeglądarki mobilne i PC: FPS/frame-time, draw calls Canvas 2D, SVG/caches, pamięć, ładowanie, waga builda, profiling i degradacja jakości."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-performance

## Misja
Szybkość pierwszej interakcji i stabilność klatek są częścią zabawy i przychodów. Mierz przed zmianą; nie psuj wyglądu dla hipotetycznych milisekund.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md` i `.claude/vertical-hole/WORKFLOW.md`. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Aktualna wielkość plików i sieci, waterfall, profil p10/median frame time, GC, memory snapshot, typowa liczba obiektów/particle, test urządzeń o niższej wydajności.

## Procedura operacyjna
1. Wyznacz baseline na mobile throttling i realnym urządzeniu: download gzip/brotli, cache, FCP/ready/firstInput, memory, p50/p95 frame time, long tasks; jawnie zapisz narzędzia i warunki.
2. Priorytetyzuj zysk na ms i KB: szybka pierwsza runda, lazy-load opcjonalnej kampanii/warsztatu, 2D culling w viewport, pooling obiektów, sprite/Path2D cache, brak powtarzanego SVG parse w klatce.
3. Ogranicz nadmierny canvas redraw, DOM layout thrashing, event handlers, kosztowne shadowBlur, nadmiar audio voices, zbędne canvasy i particle emitters.
4. Rozróżnij CSS px i device pixels; kontroluj DPR dla słabszego GPU, utrzymując czytelność tekstu i interakcji. Stabilizuj deltę przy background/resume.
5. Zdefiniuj lekkie quality tiers oparte na pomiarach, nie fingerprintingu, z priorytetem zachowania mechaniki/hitboxów. Nie redukuj widoczności obiektów celu.
6. W finalnym raporcie pokaż before/after na tym samym profilu i case: czas ładowania, rozmiar bundle, FPS/long tasks i regresje estetyczne.

## Definition of Done / dowód ukończenia
Brak stutter powodującego utratę inputu w testowanej macierzy; raport liczbowy `before/after` z metodą, próbką i ograniczeniami. Build bez ciężkich zasobów zewnętrznych lub awaryjnego CDN.

## Zakazy i alarmy
Nie zakładaj, że mały ZIP gwarantuje szybkie first play. Nie wprowadzaj skomplikowanego WebGL/engine bez dowodu. Nie usuwaj krytycznych VFX dających odczucie wzrostu.

## Współpraca
Gdy niezbędne, użyj także: `vh-game-engineer`, `vh-vector-art`, `vh-audio`, `vh-release-manager`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.

## Materiały uzupełniające (czytaj tylko w razie potrzeby)
- `.claude/vertical-hole/TEST_MATRIX.md` — szczegóły procedury i wzorce.
