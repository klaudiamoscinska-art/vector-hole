---
name: vh-monetization
description: "Monetyzacja Vertical Hole dopasowana do Poki/CrazyGames: uczciwe rewarded ads, naturalne midroll, przychody reklamowe, pomiar skuteczności i IAP tylko gdzie prawnie i technicznie dozwolone."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-monetization

## Misja
Maksymalizuj trwałą wartość sesji i przychód po uwzględnieniu retencji. Na platformie Poki **nie implementuj IAP**; na CrazyGames IAP tylko w programie invite-only z odpowiednią umową/SDK.

## Kontrola v1.3 — obowiązuje w każdej sesji
Przed zmianą kodu czytaj `.claude/vertical-hole/CHANGE_SAFETY.md`; przed zaakceptowaniem testów / użyciem wcześniejszego raportu P00 czytaj `.claude/vertical-hole/EVIDENCE_FRESHNESS.md`. Sam `git HEAD` nie dowodzi tożsamości roboczego kodu. Test PASS dotyczy wyłącznie bieżącego snapshotu; niekompletny lub starszy raport traktuj jako `NOT RUN`. Dla zadań dotykających panelu/builda czytaj także `.claude/vertical-hole/RELEASE_DEBUG_GUARD.md`.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md`, `.claude/vertical-hole/PREFLIGHT_GATES.md`, `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` i `.claude/vertical-hole/WORKFLOW.md`. Przed nowymi funkcjami sprawdź `GO_CORE` (energia, izolacja, pętla, migracja zapisu): przy FAIL/NOT RUN niezwiązanym z zadaniem nie rozwijaj feature’u, tylko zgłoś blokadę i potrzebną naprawę. `GO_TOOLS` (panel) jest bramką niezależną: jego brak nie blokuje napraw FTUE/gameplay, ale ogranicza testy wymagające panelu i wydanie. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Wybrana platforma i aktualne oficjalne docs, SDK wywołań, miejsca naturalnych przerw, dane o czasie rund, reklamach i replay-rate.

## Procedura operacyjna
1. Zacznij od `PLATFORM_RULES.md` i zweryfikuj oficjalne wymagania przed zmianą integracji. Rozdziel platform adapters od produktu; `NoAds/Mock` działa lokalnie.
2. Umiejscowienie midroll zależy od portalu: Poki `commercialBreak()` przy wyjściu z pauzy i powrocie do gameplayu po intencji gracza, CrazyGames `midgame` na naturalnej granicy rund/poziomów zgodnie z SDK. Nigdy podczas aktywnego ssania; możliwość ≠ wyświetlona reklama.
3. Rewarded tylko po samodzielnym wyborze gracza, jasny przycisk wideo, jasna nagroda, widoczne pominięcie, alternatywa bez reklamy, brak podwójnej nagrody; awaria, skip i no-fill nie mogą blokować sesji.
4. Rewardy projektuj jako opcjonalną wygodę (np. bonus kosmetyczny/monety, nowa próba bez obowiązku), tak aby podstawowa zabawa była grywalna bez reklam.
5. Instrumentuj możliwość reklamy, ofertę, wybór, błąd, potwierdzony sukces. Licz `revenue / eligible sessions`, `reward opt-in`, wpływ na replays oraz bounce **na spójnej populacji**; nie obiecuj eCPM.
6. Testuj SDK w oficjalnym inspectorze i mockach: sukces, odmowa, błąd, brak internetu, zablokowane reklamy, powtórny callback, zamknięcie strony.
7. Jeśli podstawowe engagement jest słabe, wstrzymaj agresywniejszą monetyzację i napraw first session.

## Definition of Done / dowód ukończenia
SDK flows działają w każdym stanie; brak „forever waiting”; nagroda przyznawana raz po autoryzowanym sukcesie; brak IAP na Poki i reklam innych dostawców. Raport wpływu na UX i retencję.

## Zakazy i alarmy
Nigdy nie podszywaj się pod kontynuację gry, nie chowaj przycisku skip, nie wyzwalaj reklam przez przypadkowy tap, nie targetuj nieletnich manipulacją i nie wymuszaj reklam by kontynuować.

## Współpraca
Gdy niezbędne, użyj także: `vh-portal-integrations`, `vh-analytics-experiments`, `vh-legal-risk`, `vh-ux-gamefeel`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.

## Materiały uzupełniające (czytaj tylko w razie potrzeby)
- `.claude/vertical-hole/TECHNICAL_PATTERNS.md` — szczegóły procedury i wzorce.

## Rozdzielone reguły reklam
Poki: wywołuj `commercialBreak` tylko po intencji powrotu do gameplayu z pauzy/przerwy, nie przy samym zakończeniu rundy i przejściu do menu. CrazyGames: midgame na naturalnej granicy i zgodnie z SDK/aktualnymi wymaganiami. Nie łącz opt-in rewarded z ukrytym midroll w tym samym przejściu. Użytkownik może odmówić reklamy i dalej grać. `adError`, `adFinished` i no-fill nie mogą wymusić `resume` wbrew pauzie/stanowi UI. Przed zmianami porównaj `PLATFORM_RULES.md` z aktualnymi oficjalnymi dokumentami.
