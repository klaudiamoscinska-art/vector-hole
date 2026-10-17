---
name: vh-narrative-localization
description: "Pisanie tekstów UI, naming, mikro-fabuła i lokalizacja Vertical Hole: spójne słownictwo, komunikaty celów, krótkie copy PL/EN oraz opcjonalne budowanie świata bez nadmiaru dialogów."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-narrative-localization

## Misja
Nadaj grze spójny charakter i jasne, krótkie komunikaty. Fabuła ma wzmacniać tożsamość, a nie opóźniać start pierwszej rundy.

## Kontrola v1.3 — obowiązuje w każdej sesji
Przed zmianą kodu czytaj `.claude/vertical-hole/CHANGE_SAFETY.md`; przed zaakceptowaniem testów / użyciem wcześniejszego raportu P00 czytaj `.claude/vertical-hole/EVIDENCE_FRESHNESS.md`. Sam `git HEAD` nie dowodzi tożsamości roboczego kodu. Test PASS dotyczy wyłącznie bieżącego snapshotu; niekompletny lub starszy raport traktuj jako `NOT RUN`. Dla zadań dotykających panelu/builda czytaj także `.claude/vertical-hole/RELEASE_DEBUG_GUARD.md`.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md`, `.claude/vertical-hole/PREFLIGHT_GATES.md`, `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` i `.claude/vertical-hole/WORKFLOW.md`. Przed nowymi funkcjami sprawdź `GO_CORE` (energia, izolacja, pętla, migracja zapisu): przy FAIL/NOT RUN niezwiązanym z zadaniem nie rozwijaj feature’u, tylko zgłoś blokadę i potrzebną naprawę. `GO_TOOLS` (panel) jest bramką niezależną: jego brak nie blokuje napraw FTUE/gameplay, ale ogranicza testy wymagające panelu i wydanie. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Katalog obiektów, UI key, obecne frazy PL/EN, kontekst fabularny NELA/Glitch jeśli aktualny, ograniczenia miejsca na telefonie i zasady portalu.

## Procedura operacyjna
1. Zbuduj glosariusz pojęć EN/PL: dziura, fragment wzrostu, tier, pylon, maszt, witryna, fontanna, bonus, runda, restart, efekt magnesu.
2. Na ekranie misji i w HUD odwołuj się do wspólnych `type_id`, nie ręcznie powielanych opisów. Sprawdź liczbę, odmianę, płeć w PL i naturalność EN.
3. Wprowadź voice of game: konkretne czasowniki, krótkie etykiety, jeden CTA na pierwszy ekran, komunikaty błędów z działaniem naprawczym.
4. Utrzymaj NELA/Glitch wyłącznie jako lekki flavor (jeżeli istnieją); nigdy jako przymusową ekspozycję w pierwszej minucie.
5. Przetestuj wszystkie stany: start, win, lose, nagroda, ad opt-in, brak połączenia, brak dostępnej reklamy, save conflict, powrót do areny.
6. Dodaj screenshot preview lub test snapshot długości tłumaczeń na minimum 320 CSS px; polityki portalu mogą wymagać EN nawet gdy PL jest domyślne.

## Definition of Done / dowód ukończenia
Brak błędnego object naming, brak wieloznacznego „Później”, każdy tekst mieści się i sugeruje skutki przycisku. Możliwość zmiany języka bez błędów stanu gry.

## Zakazy i alarmy
Nie stosuj fake scarcity, FOMO, sztucznych tickerów, oszukańczych tekstów reklam i hiperboli o wygranej prawdziwych pieniędzy. Nie dodawaj ścian tekstu.

## Współpraca
Gdy niezbędne, użyj także: `vh-mission-content`, `vh-ux-gamefeel`, `vh-marketing-aso`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.
