---
name: vh-ux-gamefeel
description: "Projektowanie UX i game feel Vertical Hole: zrozumiałość w 3 sekundy, sterowanie jednym palcem/myszą, HUD, animacje feedbacku, onboarding bez zasłaniania planszy."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-ux-gamefeel

## Misja
Kształtuj wrażenie kontroli, czytelności i mocy; *fast to understand* zamiast tłumu tutoriali. Traktuj screenshoty i obserwacje gracza jako dowód, a nie tylko intuicję UX.

## Kontrola v1.3 — obowiązuje w każdej sesji
Przed zmianą kodu czytaj `.claude/vertical-hole/CHANGE_SAFETY.md`; przed zaakceptowaniem testów / użyciem wcześniejszego raportu P00 czytaj `.claude/vertical-hole/EVIDENCE_FRESHNESS.md`. Sam `git HEAD` nie dowodzi tożsamości roboczego kodu. Test PASS dotyczy wyłącznie bieżącego snapshotu; niekompletny lub starszy raport traktuj jako `NOT RUN`. Dla zadań dotykających panelu/builda czytaj także `.claude/vertical-hole/RELEASE_DEBUG_GUARD.md`.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md`, `.claude/vertical-hole/PREFLIGHT_GATES.md`, `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` i `.claude/vertical-hole/WORKFLOW.md`. Przed nowymi funkcjami sprawdź `GO_CORE` (energia, izolacja, pętla, migracja zapisu): przy FAIL/NOT RUN niezwiązanym z zadaniem nie rozwijaj feature’u, tylko zgłoś blokadę i potrzebną naprawę. `GO_TOOLS` (panel) jest bramką niezależną: jego brak nie blokuje napraw FTUE/gameplay, ale ogranicza testy wymagające panelu i wydanie. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Zrzuty ekranu z realnych proporcji, flow pierwszej rundy, mapa inputu, cele i znane błędy (np. brak zgodności ikon misji z obiektami).

## Procedura operacyjna
1. Sprawdź ekran przy 320–430 CSS px w pionie, 800x450 mobile landscape i desktopowym iframe; oznacz obszary najważniejszej akcji i wszystkie zasłonięcia HUD.
2. Hierarchia: główny cel / czas / progres wielkości / wynik; informacje drugorzędne chowaj lub upraszczaj. Unikaj nakładania kafli energii i poziomu, bo energia limitująca grę ma zniknąć.
3. Etykiety, ikony i obiekty muszą wynikać z jednej definicji danych; „maszt” nie może w jednym miejscu być „wieżowcem”, a witryna flagą.
4. Dotyk: duże pola klikalne, safe areas, brak scrolla/long press menu podczas rozgrywki, obsługa cancel/rotate/blur; desktop: mysz/klawiatura z tym samym wynikiem.
5. Zastosuj animację wejścia do dziury, skalę/ruch/pulsację, dźwięk nagrody i czytelne tier-up bez utraty informacji o aktualnym celu.
6. Test bez instrukcji: poproś graczy o wykonanie pierwszego pickup i ponowny start; zapisuj każde zawahanie, fałszywy klik i niezrozumiałe słowo.

## Definition of Done / dowód ukończenia
Pierwsza akcja czytelna bez instrukcji tekstowej; żadna oferta reklamy nie wygląda jak normalny przycisk. Każdy ekran ma widoczny stan, wyjście i jasny CTA. Załącz przed/po na porównywalnych viewportach.

## Zakazy i alarmy
Nie implementuj atrap kliknięć, ukrytych „Później”, przymusowych flow nagród, CTA nakładających się na gameplay ani wyskakujących okienek podczas pochłaniania.

## Współpraca
Gdy niezbędne, użyj także: `vh-mobile-accessibility`, `vh-vector-art`, `vh-arena-gameplay`, `vh-narrative-localization`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.
