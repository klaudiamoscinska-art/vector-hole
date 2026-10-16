---
name: vh-mobile-accessibility
description: "Responsywność, dostępność i sterowanie Vertical Hole na iPhone/Android/tablecie/desktop: viewport, safe areas, Canvas DPI, dotyk, kolory, tekst i reduced motion."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-mobile-accessibility

## Misja
Chroń rozgrywkę na realnym telefonie, bo najmocniejszy gameplay nie pomoże, gdy UI zakrywa mapę lub dotyk nie działa.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md` i `.claude/vertical-hole/WORKFLOW.md`. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Lista docelowych urządzeń, layout CSS + Canvas scaling, obsługa meta viewport, testy realnych przeglądarek i iframe.

## Procedura operacyjna
1. Zrób matrycę portrait/landscape, viewport CSS/device pixels, DPR=1/2/3, 60/120 Hz, notch/safe-area, iOS Safari, Android Chrome, desktop iframe.
2. Sprawdź mapowanie pointer/touch → współrzędne świata przy CSS transform, DPR, scroll offset i zmianie orientacji; unikaj „przesuniętej dziury” na telefonie.
3. Wykorzystuj `env(safe-area-inset-*)`, minimalną czytelność typografii, kontrast, focus/keyboard, odpowiednie rozmiary celów dotykowych; nie obiecuj formalnej zgodności WCAG bez audytu.
4. Ogranicz ruch na życzenie (`prefers-reduced-motion`) tam gdzie możliwe; zapewnij oddzielne ustawienia audio i czytelne alternatywy dla feedbacku wyłącznie kolorystycznego/dźwiękowego.
5. Testuj realny dotyk: otwieranie paneli, re-start, pause, brak accidental taps na reklamę, przewijania iframe i selekcji tekstu.
6. Napraw regresje w hierarchii HUD bez sztucznego skalowania wszystkiego identycznie; przed/po i pomiar pokrycia gry.

## Definition of Done / dowód ukończenia
Mapa kliknięć zgodna z rysunkiem; brak przesłonięć, clippingu, uciętych buttonów i problemów inputu. Raport z urządzeń i viewportów realnie przetestowanych; pozostałe `NOT RUN`.

## Zakazy i alarmy
Nie uznawaj desktopowego emulatora za pełny test iOS Safari. Nie używaj fullscreen locków sprzecznych z portalem. Nie wysyłaj telemetrii dotyków, która identyfikuje osobę.

## Współpraca
Gdy niezbędne, użyj także: `vh-ux-gamefeel`, `vh-performance`, `vh-portal-integrations`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.

## Materiały uzupełniające (czytaj tylko w razie potrzeby)
- `.claude/vertical-hole/TEST_MATRIX.md` — szczegóły procedury i wzorce.
