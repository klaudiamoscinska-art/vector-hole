---
name: vh-analytics-experiments
description: "Telemetria gry Vertical Hole, KPI retencji D1/D7, czasu sesji, restartów, lejków, segmentów, A/B testów Arena First i analizy wpływu zmian z dowodami."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-analytics-experiments

## Misja
Ustanów uczciwe i porównywalne metryki, dzięki którym studio podejmuje decyzje, zamiast zgadywać „co uzależnia graczy”.

## Kontrola v1.3 — obowiązuje w każdej sesji
Przed zmianą kodu czytaj `.claude/vertical-hole/CHANGE_SAFETY.md`; przed zaakceptowaniem testów / użyciem wcześniejszego raportu P00 czytaj `.claude/vertical-hole/EVIDENCE_FRESHNESS.md`. Sam `git HEAD` nie dowodzi tożsamości roboczego kodu. Test PASS dotyczy wyłącznie bieżącego snapshotu; niekompletny lub starszy raport traktuj jako `NOT RUN`. Dla zadań dotykających panelu/builda czytaj także `.claude/vertical-hole/RELEASE_DEBUG_GUARD.md`.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md`, `.claude/vertical-hole/PREFLIGHT_GATES.md`, `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` i `.claude/vertical-hole/WORKFLOW.md`. Przed nowymi funkcjami sprawdź `GO_CORE` (energia, izolacja, pętla, migracja zapisu): przy FAIL/NOT RUN niezwiązanym z zadaniem nie rozwijaj feature’u, tylko zgłoś blokadę i potrzebną naprawę. `GO_TOOLS` (panel) jest bramką niezależną: jego brak nie blokuje napraw FTUE/gameplay, ale ogranicza testy wymagające panelu i wydanie. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Obecne SDK analytics, model zgód i prawna podstawa przetwarzania, live funnel, dashboard portalu, flagi wariantów, statystyki z aktualnego przedziału.

## Procedura operacyjna
1. Sprawdź, które eventy repo już emituje, i zmapuj na `EVENT_TAXONOMY.md`. Zadbaj o typy, spójność session/run IDs, brak duplikatów i eventy z trybem areny.
2. Zdefiniuj flow: load→ready→first input→first swallow→tier up→end→restart; osobno ad opportunity→offer→opt-in→success. Używaj **dwóch oddzielnych 5-minutowych KPI**: `r5_entry_300s` od wejścia (wall clock + obecność) i `active_play_300s` (aktywny gameplay). Mierz P50/P90 i rozdziel mobile/desktop, wyraźnie raportując lukę zgód i brakujących eventów.
3. Wybierz jeden główny KPI na eksperyment (np. restart_rate, mean active playtime) i guardrails (crashes, performance, skargi, ad annoyance).
4. Randomizuj wariant raz na kwalifikowanego gracza/sesję zgodnie z przyjętą metodą, ogranicz SRM/contamination, zapisuj datę i wersję oraz mianowniki. Jeśli masz małą próbę, rób test jakościowy lub obserwacyjny zamiast fałszywego „istotnego A/B”.
5. Rozdziel D1/D7 (kalendaryczna kohorta) od czasu sesji i liczby uruchomień. W raporcie pokaż `n`, niepewność, daty, utratę zdarzeń, interpretację, kiedy zabrakło danych.
6. Nie implementuj dodatkowego fingerprintingu. Zgody/metryki portali sprawdź z `vh-legal-risk`; telemetry fail-open dla gameplay.

## Definition of Done / dowód ukończenia
Działające eventy przetestowane lokalnie i w SDK/inspectorze, jawne definicje KPI oraz raport `zmiana/konwersja, n, CI albo ograniczenia`. Błędy gromadzenia nie blokują rundy.

## Zakazy i alarmy
Nie podszywaj się pod dostęp do dashboardu; nie dopisuj wymyślonych danych, nie używaj prywatnych ID bez podstawy. Nie dopasowuj metryk po wyniku testu.

## Współpraca
Gdy niezbędne, użyj także: `vh-director`, `vh-monetization`, `vh-legal-risk`, `vh-qa-automation`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.

## Materiały uzupełniające (czytaj tylko w razie potrzeby)
- `.claude/vertical-hole/EXPERIMENT_PLAYBOOK.md` — szczegóły procedury i wzorce.

## Uczciwy R5 v1.2
Przed porównaniem FTUE zapisz `n_all_entry` (wyłącznie gdy istnieje zgodne z prawem wiarygodne źródło wszystkich wejść), `n_observed`, `n_at_300`, `n_known_dropout`, `n_unknown`, `n_no_consent_or_not_observed` i zakres kohorty. Nie wyliczaj „R5 całej populacji” z próbki osób, które zaakceptowały telemetrię po tutorialu. Jeśli mianownik pełny nie istnieje, oznacz wynik jako R5 w kohorcie obserwowalnej, z biasem, a nie uniwersalny wskaźnik gry. Patrz `EVENT_TAXONOMY.md` — obserwacja na t=300 ≠ ekstrapolacja z osiągnięcia pięciu minut aktywnej symulacji.

## Nieprecyzyjne timery R5
Przejścia OS/tab mogą opóźniać JS timery; `setTimeout` ≠ dowód aktywności dokładnie w 300. sekundzie. Raportuj UNKNOWN, jeśli nie istnieje wiarygodny sygnał na t=300, zamiast zaliczać późny callback. Rozdziel pełny mianownik i kohortę consent. `EVENT_TAXONOMY.md` v1.3.
