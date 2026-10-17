---
name: vh-arena-gameplay
description: "Projektowanie, implementacja i balans rozgrywki Arena First w Vertical Hole: pochłanianie, tier T1–T6, ruch, rywale, pętla około 120 s, spektakularny finał i replayability."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-arena-gameplay

## Misja
Zaprojektuj najlepsze 30 sekund i kompletny powód do kolejnej rundy; arena jest samodzielnym produktem. Każdy element ma dawać jasną informację zwrotną z dotyku, ruchu, dźwięku i wzrostu.

## Kontrola v1.3 — obowiązuje w każdej sesji
Przed zmianą kodu czytaj `.claude/vertical-hole/CHANGE_SAFETY.md`; przed zaakceptowaniem testów / użyciem wcześniejszego raportu P00 czytaj `.claude/vertical-hole/EVIDENCE_FRESHNESS.md`. Sam `git HEAD` nie dowodzi tożsamości roboczego kodu. Test PASS dotyczy wyłącznie bieżącego snapshotu; niekompletny lub starszy raport traktuj jako `NOT RUN`. Dla zadań dotykających panelu/builda czytaj także `.claude/vertical-hole/RELEASE_DEBUG_GUARD.md`.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md`, `.claude/vertical-hole/PREFLIGHT_GATES.md`, `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` i `.claude/vertical-hole/WORKFLOW.md`. Przed nowymi funkcjami sprawdź `GO_CORE` (energia, izolacja, pętla, migracja zapisu): przy FAIL/NOT RUN niezwiązanym z zadaniem nie rozwijaj feature’u, tylko zgłoś blokadę i potrzebną naprawę. `GO_TOOLS` (panel) jest bramką niezależną: jego brak nie blokuje napraw FTUE/gameplay, ale ogranicza testy wymagające panelu i wydanie. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Obecna mechanika, rozmiary collision bounds, siatka spawnów, zachowania rywali i ścieżka od startu do końca rundy, klipy z telefonu, błędy skalowania.

## Procedura operacyjna
1. Rozrysuj rundę: spawn → pierwszy pickup → szybkie tier-up → midgame dynamicznego wyboru celów/rywali → czytelny climax → wynik → instant replay.
2. Zmierz relację promienia hitboxu dziury do wizualnego rozmiaru obiektu i animacji pochłaniania; eliminuj wrażenie „za mała dziura wciąga wieżowiec”. Ustal progi oraz objętości z czytelnymi przykładami świata.
3. T1–T6 i Złoty Rdzeń traktuj jako projektowane parametry; modyfikuj je po playteście. Pamiętaj o obiektach większych tierów, które faktycznie pojawiają się na mapie, a nie tylko na pasku.
4. Stosuj kontrolowane spawny i ekspozycję celu, ogranicz martwe strefy/niestabilne kolizje; rywale nie mogą psuć pierwszego kontaktu z grą.
5. Izoluj stan areny od wyniku misji/dzielnic i innych blokad. Ustawienia i ewentualne kosmetyki mogą być współdzielone tylko jawnie.
6. Zrób porównanie przed/po: czas pierwszego pochłonięcia, rozkład tierów, ukończenie rundy, ponowny start; dołącz zestaw seedów reprodukcyjnych.

## Definition of Done / dowód ukończenia
Na telefonie i desktopie gracz rozumie cel, ruch i możliwość pochłonięcia; nie ma spawnu niemożliwego, znikających obiektów czy stanu softlock; końcówka rundy jest powtarzalna i czytelna. Test deterministyczny i playtest 3–5 osób to minimum jakościowe, nie walidacja rynku.

## Zakazy i alarmy
Nie wprowadzaj energii na wejście, długiego tutorialu, twardej zależności od kampanii, przewagi kupionej poza kanałem ani automatycznie nie wydłużaj rundy, gdy wynik słaby.

## Współpraca
Gdy niezbędne, użyj także: `vh-game-engineer`, `vh-ux-gamefeel`, `vh-progression-economy`, `vh-qa-automation`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.

## Materiały uzupełniające (czytaj tylko w razie potrzeby)
- `.claude/vertical-hole/TECHNICAL_PATTERNS.md` — szczegóły procedury i wzorce.
- `.claude/vertical-hole/EXPERIMENT_PLAYBOOK.md` — szczegóły procedury i wzorce.

## Kontrola flow pierwszego restartu
Po pierwszej rundzie główne CTA uruchamia następną arenę bez przejścia przez dzielnice i bez ukrytej zależności od waluty/boostów/kampanii. Zmiany w balansie pierwszych minut oceniaj oddzielnie od `R5-entry` i `A5-playtime`, z priorytetem małej iteracji oraz seedowanych testów jakości (nie nazywaj ich retencją).
