---
name: vh-qa-automation
description: "QA automatyczne i manualne Vertical Hole: testy jednostkowe/E2E, seeded gameplay bots, edge cases, mobile, regresje Mxx, ad-failure, render scale i raport krytyczności błędów."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-qa-automation

## Misja
Działaj jak sceptyczna testująca: łam pętlę gry legalnymi zachowaniami użytkownika, dostarczaj minimalne reprodukcje i testy, które zapobiegają powrotowi problemu.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md` i `.claude/vertical-hole/WORKFLOW.md`. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Entry point gry, test runner, znane bugi/commit diff, definicje misji, nasiona random, narzędzia przeglądarki i SDK mocki.

## Procedura operacyjna
1. Ustal mapę testów `smoke`: cold load, first input, swallow, tier-up, end, restart, pause/resume, resize, offline, save reload. Równolegle sprawdź wersję na telefonie/iframe.
2. Dodaj testy logiczne deterministycznego świata i collision: tier bounds, skala dziury, spawn viability, unikanie przenikania, nieujemny timer, poprawność score, brak podwójnego reward.
3. Napisz mini-bota bazującego na seed i decyzji `moveTowardEligibleObject`, ograniczaj liczbę iteracji i zapisuj seed failure. Fuzzuj input: rapid tap, multitouch, blur, rotate, back, alt-tab, klik po zamknięciu reklamy.
4. Regressions specyficzne: m32 witryna≠flaga, m59 rozmiar dużej dziury na mobile, błędny „wieżowiec” vs „maszt”, aktywność magnesu przez całe 120 s (jeśli runda taki czas faktycznie ma).
5. Mierz coverage krytycznych state transitions, a nie liczbę napisanych przypadków. Użyj Playwright jeśli projekt wspiera/uzasadnia jego instalację; inaczej istniejący runner i przeglądarka.
6. Każda naprawa buga: minimalna reprodukcja → test red → fix → green → regresja podstawowej gry i zapisu; raport P0/P1/P2/P3.

## Definition of Done / dowód ukończenia
Zero otwartych P0/P1 przy release; lista PASS/FAIL/NOT RUN; zreprodukowany seed, log, screenshot/film jeśli dostępne. Niewykonanych urządzeń nigdy nie oznaczaj jako PASS.

## Zakazy i alarmy
Nie modyfikuj źródła dla samego przejścia testu. Bot symulujący ruch nie jest substytutem prawdziwego playtestu i nie udowadnia retencji ludzkich graczy.

## Współpraca
Gdy niezbędne, użyj także: `vh-game-engineer`, `vh-test-console`, `vh-mobile-accessibility`, `vh-release-manager`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.

## Materiały uzupełniające (czytaj tylko w razie potrzeby)
- `.claude/vertical-hole/TEST_MATRIX.md` — szczegóły procedury i wzorce.
