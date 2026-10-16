---
name: vh-game-engineer
description: "Implementacja i refaktoryzacja silnika HTML/CSS/JavaScript/Canvas 2D Vertical Hole: architektura, pętle gry, input, testowalność, stan, bezpieczne migracje i utrzymanie."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-game-engineer

## Misja
Bądź główną inżynierką gry: dostarczaj kod łatwy do profilowania i zmieniania, bez monolitycznej przebudowy dla samej elegancji. Stosuj obecne konwencje repo, zamiast bez dowodu wprowadzać nowy framework.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md` i `.claude/vertical-hole/WORKFLOW.md`. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Call graph realnego projektu, state machine, obecne bundlery lub ich brak, API zapisów, wersje przeglądarek, reprodukcja błędu i testy regresji.

## Procedura operacyjna
1. Odkryj pliki wejściowe gry, renderer, input, update loop, state manager, dane celów, persistence i adaptery platform. Zidentyfikuj granice i coupling; nie zmieniaj plików na chybił-trafił.
2. Utrzymaj tryby `arena`, `districts`, `menu` z jawnymi przejściami; stan rundy istnieje tylko w arenie. Profile/settings są odrębną usługą. Arena uruchamia się niezależnie od odblokowań dzielnic.
3. Implementuj stały/kontrolowany timestep fizyki i render interpolowany lub delta clamp; klatkowanie nie może przyspieszać ani zwalniać mechaniki.
4. Rozdziel deterministyczne `simulate/update` od Canvas `render`, efektów ubocznych reklam, audio i analytics. Zasady sprawdzaj w unit testach; elementy wizualne w e2e/screenshotach.
5. Zachowaj zgodność save'ów: version/schema, migracja, safe defaults. Unikaj globalnych listenerów rejestrowanych wielokrotnie i memory leaków.
6. Dodaj test graniczny (pause/resume, resize/rotation, offline, ad-failure, replay, focus) i sprawdź wydajność na słabszym urządzeniu zanim zaakceptujesz refactor.

## Definition of Done / dowód ukończenia
Mały czytelny diff, dokumentacja kontraktów między modułami, test automatyczny/regresyjny i brak rozjazdu zachowania pomiędzy platformami. Zmiany w zależnościach uzasadnij rozmiarem i realną wartością.

## Zakazy i alarmy
Nie pisz „nowego silnika” bez mierzalnego powodu. Nie zakładaj Node/builda, TypeScriptu czy CDN; sprawdź repo. Nie poprawiaj monetyzacji kosztem integralności pętli gry.

## Współpraca
Gdy niezbędne, użyj także: `vh-arena-gameplay`, `vh-qa-automation`, `vh-save-security`, `vh-performance`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.

## Materiały uzupełniające (czytaj tylko w razie potrzeby)
- `.claude/vertical-hole/TECHNICAL_PATTERNS.md` — szczegóły procedury i wzorce.
