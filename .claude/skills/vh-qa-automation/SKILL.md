---
name: vh-qa-automation
description: "QA automatyczne i manualne Vertical Hole: testy jednostkowe/E2E, seeded gameplay bots, edge cases, mobile, regresje Mxx, ad-failure, render scale i raport krytyczności błędów."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-qa-automation

## Misja
Działaj jak sceptyczna testująca: łam pętlę gry legalnymi zachowaniami użytkownika, dostarczaj minimalne reprodukcje i testy, które zapobiegają powrotowi problemu.

## Kontrola v1.3 — obowiązuje w każdej sesji
Przed zmianą kodu czytaj `.claude/vertical-hole/CHANGE_SAFETY.md`; przed zaakceptowaniem testów / użyciem wcześniejszego raportu P00 czytaj `.claude/vertical-hole/EVIDENCE_FRESHNESS.md`. Sam `git HEAD` nie dowodzi tożsamości roboczego kodu. Test PASS dotyczy wyłącznie bieżącego snapshotu; niekompletny lub starszy raport traktuj jako `NOT RUN`. Dla zadań dotykających panelu/builda czytaj także `.claude/vertical-hole/RELEASE_DEBUG_GUARD.md`.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md`, `.claude/vertical-hole/PREFLIGHT_GATES.md`, `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` i `.claude/vertical-hole/WORKFLOW.md`. Przed nowymi funkcjami sprawdź `GO_CORE` (energia, izolacja, pętla, migracja zapisu): przy FAIL/NOT RUN niezwiązanym z zadaniem nie rozwijaj feature’u, tylko zgłoś blokadę i potrzebną naprawę. `GO_TOOLS` (panel) jest bramką niezależną: jego brak nie blokuje napraw FTUE/gameplay, ale ogranicza testy wymagające panelu i wydanie. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Entry point gry, test runner, znane bugi/commit diff, definicje misji, nasiona random, narzędzia przeglądarki i SDK mocki.

## Procedura operacyjna
1. Ustal mapę testów `smoke`: cold load, first input, swallow, tier-up, end, restart, pause/resume, resize, offline, save reload. Równolegle sprawdź wersję na telefonie/iframe.
2. Dodaj testy logiczne deterministycznego świata i collision: tier bounds, skala dziury, spawn viability, unikanie przenikania, nieujemny timer, poprawność score, brak podwójnego reward.
3. Napisz mini-bota bazującego na seed i decyzji `moveTowardEligibleObject`, ograniczaj liczbę iteracji i zapisuj seed failure. Fuzzuj input: rapid tap, multitouch, blur, rotate, back, alt-tab, klik po zamknięciu reklamy.
4. Regressions specyficzne: m32 witryna≠flaga, m59 rozmiar dużej dziury na mobile, błędny „wieżowiec” vs „maszt”, aktywność magnesu przez pełny deklarowany czas MISJI kampanii (jeżeli oferta `owner=districts`); nigdy nie używaj czasu areny 120 s jako domyślnej długości misji.
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

## Testy cross-mode / P00 (nie pomijaj)
Testuj kontrakt areny z czterema stanami kampanii (`new/locked`, partial, complete, corrupted/missing), zakupem/zużyciem kampanijnego boosta, resetem tylko dzielnic, migracją save i niezmiennością balansu areny. Ponadto testuj no-fill, callback reklamy ze starej rundy, ręczną pauzę w trakcie reklamy, obrót telefonu i próbę ponownego otwarcia areny bez energii. Sprawdź realny brak kodu dev panelu w publicznym artefakcie, nie tylko ukryty UI. Raportuj `NOT RUN`, jeśli brak urządzenia/portalu.

## Ewaluacja skilli i testy, których nie wolno pominąć (v1.2)
Poza sprawdzeniem struktury uruchom w aktualnym repo scenariusze EVAL-01..08 z `.claude/vertical-hole/SKILL_EVALUATION.md`, SAVE-01..07 i BOOST-01..03 odpowiednie dla diffu. Zachowaj rezultaty w logach/raporcie i nie zamieniaj `NOT RUN` w `PASS`. Skrypt `scripts/validate.py` paczki ocenia strukturę, **nie gameplay**. Nie zgaduj funkcji, runnera ani identyfikatorów produktu.

## Negatywne testy obligatoryjne (2026-10-17)
`ISOLATION-ECON`: nagroda dzielnic→wspólna moneta→RUN_TOOLS oraz `SKINS.perks` z historycznym skinem. `SAVE-08/09`: przyszły schemat/corrupt input bez utraty danych. `RELEASE-DEBUG`: prawdziwy publiczny JS bez DevPanel, a nie jedynie ukryty przycisk. `DEPLOY-PAGES`: brak `claude/**` i `path: "."`; wykonaj `check_pages_workflow.py`. Brak testu = NOT RUN, nie PASS.

**Pułapka `qa/dev-panel.mjs` — 2026-10-17:** jego „production host (simulated)” zastępuje wszystkie odpowiedzi z domeny publicznej bajtami z lokalnego `ROOT` poprzez `context.route(...).fulfill(...)`. Test tego hosta NIE JEST testem rzeczywistego serwera i nie może przejść bramki release. Osobno udokumentuj realny fetch z live Pages bez mocków i hash serwowanego `game.js`; jeśli brak dostępu — `LIVE-PRODUCTION=NOT RUN`, nigdy PASS.
