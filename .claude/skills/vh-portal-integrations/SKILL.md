---
name: vh-portal-integrations
description: "Integracje Vertical Hole z Poki i CrazyGames SDK: ładowanie, lifecycle gameplayStart/Stop, rewarded/midroll, dane, adblock, test Inspector i niezależne adaptery."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-portal-integrations

## Misja
Zadbaj o poprawną komunikację gry z portalem bez przecieków do mechaniki i bez blokowania rozgrywki. Każdy portal musi mieć własną konfigurację i własne testy.

## Kontrola v1.3 — obowiązuje w każdej sesji
Przed zmianą kodu czytaj `.claude/vertical-hole/CHANGE_SAFETY.md`; przed zaakceptowaniem testów / użyciem wcześniejszego raportu P00 czytaj `.claude/vertical-hole/EVIDENCE_FRESHNESS.md`. Sam `git HEAD` nie dowodzi tożsamości roboczego kodu. Test PASS dotyczy wyłącznie bieżącego snapshotu; niekompletny lub starszy raport traktuj jako `NOT RUN`. Dla zadań dotykających panelu/builda czytaj także `.claude/vertical-hole/RELEASE_DEBUG_GUARD.md`.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md`, `.claude/vertical-hole/PREFLIGHT_GATES.md`, `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` i `.claude/vertical-hole/WORKFLOW.md`. Przed nowymi funkcjami sprawdź `GO_CORE` (energia, izolacja, pętla, migracja zapisu): przy FAIL/NOT RUN niezwiązanym z zadaniem nie rozwijaj feature’u, tylko zgłoś blokadę i potrzebną naprawę. `GO_TOOLS` (panel) jest bramką niezależną: jego brak nie blokuje napraw FTUE/gameplay, ale ogranicza testy wymagające panelu i wydanie. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Aktualny kod integracji, wybrana platforma, oficjalna dokumentacja, pakiet SDK, lista stanów rozgrywki i symulowane wyniki reklamy.

## Procedura operacyjna
1. Sprawdź aktualny zestaw API i warunki z `PLATFORM_RULES.md` bez domysłów. Określ mode `local/mock`, `poki`, `crazygames` oraz jawne capability flags (ads, cloud save, IAP).
2. Abstrakcja portal adapter: `init`, `ready`, `gameplayStarted`, `gameplayStopped`, `requestMidroll`, `requestRewarded`, opcjonalnie `save/load`; rzeczywiste nazwy dostosuj do repo/SDK.
3. Zaimplementuj odporną state machine; nie pozwalaj na `start,start` ani `stop,stop`. `gameplayStart` dopiero przy faktycznej interakcji lub wznowieniu, nie automatycznie na load.
4. Przy reklamie zatrzymaj sim, input i audio; callback (w tym no-fill/błąd) usuwa tylko blokadę ad. Wznów dopiero po ponownym przeliczeniu intencji gracza, ręcznej pauzy, widoczności, trybu, orientacji i właściwego porządku eventów SDK. Nigdy nie używaj bezwarunkowego `finally` z resume.
5. Poki: żadnych IAP ani zewnętrznych reklam, adblock fail-open i tylko zatwierdzone platform actions. CrazyGames: w Basic brak generowania przychodu, w Full wymagane odpowiednie eventy i API.
6. Testuj inspektorem/in-app frame oraz bez SDK. Nie mieszaj buildów; nie aktywuj jednocześnie obu SDK w produkcyjnym kanale.
7. Zweryfikuj prawo do wieloplatformowej publikacji (wyłączność Poki może blokować równoległą obecność na innym portalu web).

## Definition of Done / dowód ukończenia
Jawny test matrix eventów i reklam; porównywalne zachowanie gameplay w mock/offline, brak zdublowanych eventów, raport linków do aktualnych oficjalnych wymagań z datą sprawdzenia.

## Zakazy i alarmy
Nie fałszuj statusu obejrzanej reklamy, nie wywołuj reklam w trakcie ruchu i nie zakładaj, że oba portale pozwolą na dystrybucję równoległą.

## Współpraca
Gdy niezbędne, użyj także: `vh-monetization`, `vh-save-security`, `vh-release-manager`, `vh-analytics-experiments`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.

## Materiały uzupełniające (czytaj tylko w razie potrzeby)
- `.claude/vertical-hole/TECHNICAL_PATTERNS.md` — szczegóły procedury i wzorce.

## Krytyczny kontrakt implementacyjny
Nie używaj generycznego `finally { gameplayStart(); resumeSimulation(); }`. Oddziel Poki od CrazyGames: Poki `commercialBreak` przy powrocie z naturalnej przerwy do gameplayu, CrazyGames `requestAd` na odpowiedniej naturalnej granicy. Zmiana focusu nie jest intencją kontynuacji; callback SDK może tylko zdjąć powód blokady reklamy. Przy wielu powodach pauzy zastosuj `canPlay` z `TECHNICAL_PATTERNS.md`, unieważniaj stare callbacki po zmianie trybu/rundy; testuj event order i no-fill w oficjalnych narzędziach.
