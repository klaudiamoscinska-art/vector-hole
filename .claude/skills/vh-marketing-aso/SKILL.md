---
name: vh-marketing-aso
description: "Marketing i dystrybucja Vertical Hole: ASO/SEO portali, screeny i okładki, krótkie klipy, nazwa, karty gry, kampanie organiczne, shareable score bez spamu."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-marketing-aso

## Misja
Sprzedawaj prawdziwe uczucie wzrostu i wyjątkowy finał, nie obiecuj mechanik nieobecnych w grze. Maksymalizuj jakość kliknięcia, pierwszą sesję i polecenia znajomym.

## Kontrola v1.3 — obowiązuje w każdej sesji
Przed zmianą kodu czytaj `.claude/vertical-hole/CHANGE_SAFETY.md`; przed zaakceptowaniem testów / użyciem wcześniejszego raportu P00 czytaj `.claude/vertical-hole/EVIDENCE_FRESHNESS.md`. Sam `git HEAD` nie dowodzi tożsamości roboczego kodu. Test PASS dotyczy wyłącznie bieżącego snapshotu; niekompletny lub starszy raport traktuj jako `NOT RUN`. Dla zadań dotykających panelu/builda czytaj także `.claude/vertical-hole/RELEASE_DEBUG_GUARD.md`.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md`, `.claude/vertical-hole/PREFLIGHT_GATES.md`, `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` i `.claude/vertical-hole/WORKFLOW.md`. Przed nowymi funkcjami sprawdź `GO_CORE` (energia, izolacja, pętla, migracja zapisu): przy FAIL/NOT RUN niezwiązanym z zadaniem nie rozwijaj feature’u, tylko zgłoś blokadę i potrzebną naprawę. `GO_TOOLS` (panel) jest bramką niezależną: jego brak nie blokuje napraw FTUE/gameplay, ale ogranicza testy wymagające panelu i wydanie. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Aktualny gameplay capture, nazwa/logo, 1 zdanie USP, dozwolone formaty portali, języki, polityka linków, oficjalne wymagania metadanych.

## Procedura operacyjna
1. Sformułuj 3 warianty hooka w formacie „połykaj → rośnij → zdominuj miasto”, ale oparte na faktycznych interakcjach; zachowaj oryginalny ton i zgodność z ratingiem wiekowym.
2. Przygotuj skrócony i długi opis EN, ewentualnie PL, frazy wyszukiwalności bez keyword stuffing, wymagany opis controls, tagi i krótką instrukcję.
3. Plan materiałów: okładka portrait, square, landscape; klip pierwszych 5–15 sekund pokazuje dotyk→pochłanianie→tier-up→finał. Wymiary i zasady skontroluj na oficjalnym portalu w dniu submission.
4. Porównuj click-to-play, ready-to-firstInput i restartRate per wariant materiałów, o ile portal daje te dane. Unikaj clickbaitu, który zwiększa wejścia, ale obniża zaangażowanie.
5. Shareable result: powiąż z zakończeniem rundy, nie rób automatycznego udostępniania, pokaż podgląd, kopiowanie/udostępnienie wymaga tap. Szanuj polityki wychodzących linków i umowę wyłączności.
6. Community: krótkie changelogi, klasyfikowanie opinii, nie kupuj bot traffic; odpowiadaj bez ujawniania danych użytkowników.

## Definition of Done / dowód ukończenia
Zestaw rzeczywistych materiałów/tekstów z jasnymi ścieżkami plików, zgodność formatów portalu, działający user-initiated share i metryki leja, o ile dostępne.

## Zakazy i alarmy
Nie publikuj obietnic o multiplayer, rozgrywce w mieście czy skinach, których nie ma. Nie wysyłaj wiadomości ani postów z konta bez zgody.

## Współpraca
Gdy niezbędne, użyj także: `vh-market-intelligence`, `vh-vector-art`, `vh-narrative-localization`, `vh-portal-integrations`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.
