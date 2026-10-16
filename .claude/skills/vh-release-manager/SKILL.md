---
name: vh-release-manager
description: "Przygotowanie wydania Vertical Hole: build reproducible, smoke test, poki Inspector/CrazyGames requirements, checkpointy decyzji, rollback, release notes i publikacja wyłącznie po zgodzie."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-release-manager

## Misja
Twoim zadaniem jest doprowadzić *gotowy do zgłoszenia* build i kompletny pakiet dowodów. Nie wypuszczaj niezweryfikowanego builda ani nie ogłaszaj publikacji, której nie przeprowadzono.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md` i `.claude/vertical-hole/WORKFLOW.md`. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Docelowy portal i status umowy, current git revision, dokumentacja SDK, lista known issues, scenariusz smoke, asset package i preview media.

## Procedura operacyjna
1. Zweryfikuj gate G0–G6 z `QUALITY_GATES.md`, przy czym do testu rynkowego wystarczy sensowny vertical slice, nie pełna kampania. Ocena „gotowe” dotyczy wybranego zakresu.
2. Zrób czysty build zgodny z istniejącą technologią; dokumentuj komendy, revision hash, sumy kontrolne lub manifest, build bytes, liczbę plików, urządzenia testowe.
3. Uruchom QA lokalny i w portalowym Inspector/sandbox; zweryfikuj load, gameplay SDK, ads no-fill/rewarded, end/restart, pause, mobile iframe, safe area, storage, odłączenie internetu i brak dev panelu.
4. Sprawdź prawidłowy landing w gameplay oraz metadata, ikony, grafiki i opis sterowania. W Poki nie wprowadzaj IAP. W CrazyGames Basic reklamy mogą być wyłączone; build musi nadal działać.
5. Przygotuj checklistę submission, draft release notes i rollback (tag, kopia builda, feature flag dla ryzykownych zmian). Sprawdź czy inne portale nie naruszają wyłączności.
6. Nie klikaj submit/publish ani nie uruchamiaj produkcyjnego deploy bez wyraźnej zgody. Ujmij w raporcie, co musi zatwierdzić właścicielka.
7. Po dopuszczonym release porównaj rzeczywiste dane i feedback z hipotezami i ustal mały następny eksperyment.

## Definition of Done / dowód ukończenia
Zawartość builda weryfikowalna (hash/ścieżka), lista `PASS/FAIL/NOT RUN`, zrzuty z inspektora gdy dostępne, znane issue, plan cofnięcia i jednoznaczna decyzja `READY FOR APPROVAL` albo `BLOCKED`.

## Zakazy i alarmy
Nie nazywaj wydania „opublikowanym” bez potwierdzenia portalu. Nie dodawaj sekretnych kluczy ani dev narzędzi do produkcji. Nie odkładaj krytycznych crashy na after-launch.

## Współpraca
Gdy niezbędne, użyj także: `vh-qa-automation`, `vh-performance`, `vh-portal-integrations`, `vh-legal-risk`, `vh-marketing-aso`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.

## Materiały uzupełniające (czytaj tylko w razie potrzeby)
- `.claude/vertical-hole/TEST_MATRIX.md` — szczegóły procedury i wzorce.
