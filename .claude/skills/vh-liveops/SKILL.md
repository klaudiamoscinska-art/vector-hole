---
name: vh-liveops
description: "Planowanie LiveOps i retencji Vertical Hole: lekkie wydarzenia, warianty areny, codzienne wyzwania bez przymusu, utrzymanie stabilności, analiza opinii i aktualizacje."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-liveops

## Misja
Wydłużaj życie sprawdzonej gry tanimi, odwracalnymi wariantami. Zanim zbudujesz live-service, upewnij się, że podstawowa gra powtarza się sama z siebie.

## Kontrola v1.3 — obowiązuje w każdej sesji
Przed zmianą kodu czytaj `.claude/vertical-hole/CHANGE_SAFETY.md`; przed zaakceptowaniem testów / użyciem wcześniejszego raportu P00 czytaj `.claude/vertical-hole/EVIDENCE_FRESHNESS.md`. Sam `git HEAD` nie dowodzi tożsamości roboczego kodu. Test PASS dotyczy wyłącznie bieżącego snapshotu; niekompletny lub starszy raport traktuj jako `NOT RUN`. Dla zadań dotykających panelu/builda czytaj także `.claude/vertical-hole/RELEASE_DEBUG_GUARD.md`.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md`, `.claude/vertical-hole/PREFLIGHT_GATES.md`, `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` i `.claude/vertical-hole/WORKFLOW.md`. Przed nowymi funkcjami sprawdź `GO_CORE` (energia, izolacja, pętla, migracja zapisu): przy FAIL/NOT RUN niezwiązanym z zadaniem nie rozwijaj feature’u, tylko zgłoś blokadę i potrzebną naprawę. `GO_TOOLS` (panel) jest bramką niezależną: jego brak nie blokuje napraw FTUE/gameplay, ale ogranicza testy wymagające panelu i wydanie. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Rzeczywisty D1/D7/return cohorts, lista istniejących trybów, rozbudowy i wydarzenia w repo, propozycje społeczności, czas obsługi małego zespołu.

## Procedura operacyjna
1. Rozdziel retencję pierwotną (powrót z chęci powtórzenia areny) od retencji sztucznej (logowanie po bonus). Jeśli pierwsza niska, napraw arenę.
2. Zaproponuj 1–2 niskokosztowe modyfikatory: seeded daily challenge, dzienny leaderboard lokalny/zgodny z platformą, zmienny zestaw miasta lub skin. Nie konstruuj wielkiej bazy eventów.
3. Projektuj challenge jako opcję, dostęp bez energii, bez streak penalty, bez niszczenia progresu i bez płatnej przewagi.
4. Ustal asset/feature flag + kill switch; wydarzenia muszą działać offline lub fail gracefully, bez synchronizacji wymagającej konta.
5. Rób powtórki testów i porównuj kohorty przy nienaruszonym baseline, odnotuj efekty negatywne; monitoruj spadki FPS i zgłoszenia problemów po każdej aktualizacji.
6. Przygotuj kalendarz operacyjny dopiero kiedy przychody i retencja uzasadniają stałą obsługę; każdy event ma koszt aktualizacji i zamknięcia.

## Definition of Done / dowód ukończenia
Prototyp w granicach istniejącej architektury, realne metryki, plan cofnięcia, brak obowiązkowego kalendarza; co najmniej jeden eksperyment sprawdzający wpływ na restart/return rate.

## Zakazy i alarmy
Nie spamuj powiadomieniami, nie przymuszaj do codziennej obecności, nie blokuj gry za eventem i nie przedstawiaj automatycznego generowania contentu jako wartości bez playtestu.

## Współpraca
Gdy niezbędne, użyj także: `vh-director`, `vh-analytics-experiments`, `vh-progression-economy`, `vh-release-manager`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.

## Materiały uzupełniające (czytaj tylko w razie potrzeby)
- `.claude/vertical-hole/EXPERIMENT_PLAYBOOK.md` — szczegóły procedury i wzorce.
