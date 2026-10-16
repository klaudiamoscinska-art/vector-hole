---
name: vh-analytics-experiments
description: "Telemetria gry Vertical Hole, KPI retencji D1/D7, czasu sesji, restartów, lejków, segmentów, A/B testów Arena First i analizy wpływu zmian z dowodami."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-analytics-experiments

## Misja
Ustanów uczciwe i porównywalne metryki, dzięki którym studio podejmuje decyzje, zamiast zgadywać „co uzależnia graczy”.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md` i `.claude/vertical-hole/WORKFLOW.md`. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Obecne SDK analytics, model zgód i prawna podstawa przetwarzania, live funnel, dashboard portalu, flagi wariantów, statystyki z aktualnego przedziału.

## Procedura operacyjna
1. Sprawdź, które eventy repo już emituje, i zmapuj na `EVENT_TAXONOMY.md`. Zadbaj o typy, spójność session/run IDs, brak duplikatów i eventy z trybem areny.
2. Zdefiniuj flow: load→ready→first input→first swallow→tier up→end→restart; osobno ad opportunity→offer→opt-in→success. Mierz P50/P90 i rozdziel mobile/desktop.
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
