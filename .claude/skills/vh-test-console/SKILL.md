---
name: vh-test-console
description: "Bezpieczny panel deweloperski Vertical Hole na telefon i PC: odblokowanie wszystkich dzielnic, warsztatu, skinów/efektów, szybkie przechodzenie misji, reset, seed i kontrola stanów."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-test-console

## Misja
Zweryfikuj **istniejący już** panel testowy (zgłoszony jako ukończony): uruchamianie na telefonie, dostępność przycisków, dev-only build, izolację danych i odporność na wyciek do produkcji. Nie twórz nowej implementacji, jeżeli obecna działa; bez osobnego zlecenia jedynie raportuj usterki. Panel nie może wyciekać do graczy ani rankingów.

## Kontrola v1.3 — obowiązuje w każdej sesji
Przed zmianą kodu czytaj `.claude/vertical-hole/CHANGE_SAFETY.md`; przed zaakceptowaniem testów / użyciem wcześniejszego raportu P00 czytaj `.claude/vertical-hole/EVIDENCE_FRESHNESS.md`. Sam `git HEAD` nie dowodzi tożsamości roboczego kodu. Test PASS dotyczy wyłącznie bieżącego snapshotu; niekompletny lub starszy raport traktuj jako `NOT RUN`. Dla zadań dotykających panelu/builda czytaj także `.claude/vertical-hole/RELEASE_DEBUG_GUARD.md`.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md`, `.claude/vertical-hole/PREFLIGHT_GATES.md`, `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` i `.claude/vertical-hole/WORKFLOW.md`. Przed nowymi funkcjami sprawdź `GO_CORE` (energia, izolacja, pętla, migracja zapisu): przy FAIL/NOT RUN niezwiązanym z zadaniem nie rozwijaj feature’u, tylko zgłoś blokadę i potrzebną naprawę. `GO_TOOLS` (panel) jest bramką niezależną: jego brak nie blokuje napraw FTUE/gameplay, ale ogranicza testy wymagające panelu i wydanie. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Struktura projektu, system build/dev-mode, format zapisów/odblokowań, render UI, hosting preview i to, co użytkowniczka chce testować.

## Procedura operacyjna
1. Odkryj, czy repo ma `import.meta.env`, `NODE_ENV`, flagę URL, bundler czy pliki statyczne. Wybierz **build-time development-only** zamiast sekretnych kliknięć/hasła ukrytego w JS. Nie zakładaj dostępności backendu.
2. **Sprawdź istniejący interfejs** widoczny tylko w dev buildzie: przycisk safe-area, osobne okno, grupy i zamykanie dotykiem/myszą. Jeśli czegoś brak, zanotuj FAIL i możliwą minimalną naprawę; **nie dodawaj drugiego panelu** bez osobnego polecenia.
3. **Przetestuj istniejące przyciski**: odblokowanie dzielnic, warsztatu, efektów/skinów, tier T1–T6, testowej waluty (jeśli występuje), wybór Mxx, seed, start areny, reset tylko danych testowych. Brak funkcji → osobna propozycja poprawki, bez automatycznej rozbudowy.
4. Zweryfikuj, że testowe zapisy są odizolowane w osobnym namespace/storage/profile; menu powinno korzystać z kontrolowanych API/state actions, nie chaotycznych modyfikacji localStorage.
5. Reset destrukcyjny oznacz jako test-only i wymagający potwierdzenia. Nie używaj panelu do nadpisania produkcyjnego konta lub leaderboardu.
6. Testy: wszystkie przyciski w pionie i poziomie, szybkie tapy, reload, mobile Safari, ukryty panel w buildzie publicznym, brak handlerów/debug endpoints w publicznym bundle.
7. **Napisz dokładną instrukcję telefonu dostosowaną do wykrytego środowiska**: np. lokalne Wi‑Fi i adres hosta PC lub dedykowany preview URL, sposób uruchomienia i potwierdzenia, że to dev build. Nie wymyślaj adresu IP, portu ani komendy bez sprawdzenia repo.

## Definition of Done / dowód ukończenia
Działające przyciski po ponownym uruchomieniu, mobilny panel z kontrolą dostępu przez osobny build, izolacja save i dowód, że release artifact nie zawiera kodu/poleceń debug. Instrukcja użycia telefonu krok po kroku.

## Zakazy i alarmy
Nie polegaj na `?debug=true` jako zabezpieczeniu publicznej wersji. Nie wysyłaj narzędzi debug do produkcyjnego JS nawet „ukrytych”. Nie obiecuj, że lokalny serwer jest dostępny z telefonu bez sprawdzenia sieci/firewalla.

## Współpraca
Gdy niezbędne, użyj także: `vh-save-security`, `vh-mobile-accessibility`, `vh-qa-automation`, `vh-game-engineer`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.

## Materiały uzupełniające (czytaj tylko w razie potrzeby)
- `.claude/vertical-hole/TECHNICAL_PATTERNS.md` — szczegóły procedury i wzorce.
- `.claude/vertical-hole/TEST_MATRIX.md` — szczegóły procedury i wzorce.

## Kryterium P00 i wynik GO/STOP
Jeśli brak panelu, `P00-TOOLS` ma FAIL do czasu wdrożenia dev-only i weryfikacji na telefonie/desktopie. `P00-CORE` ocenia się niezależnie. Nie ukrywaj implementacji produkcyjnym CSS/flagą URL. Porównaj listę zasobów produkcyjnego builda z debug-only entrypoints, sprawdź brak event handlerów i payloadów test console oraz faktyczną izolację zapisów.

## Separacja bramek v1.2
Brak panelu dev nie zmienia `GO_CORE` gry: raportuj `GO_TOOLS=FAIL/NOT RUN` niezależnie, ewentualną naprawę zaplanuj jako odrębne, zatwierdzone zadanie. Przed wydaniem i testami wymagającymi panelu uzyskaj dowody, że implementacja debug nie trafiła do artefaktu produkcyjnego. Nie wymagaj działającego panelu do każdej poprawki błędu FTUE; jest przydatnym narzędziem, a nie warunkiem przywrócenia podstawowej pętli.

## Kryterium buildów v1.3
Test console wymaga sentinel `VH_DEV_CONSOLE_ONLY` tylko w dev entrypoint. Wykonaj fizycznie dwa osobne buildy i `.claude/vertical-hole/tools/verify_release_artifact.py --dev-build ... --release-build ...` z repo. Konieczna także manualna inspekcja builda, brak debug globali i test izolacji zapisu dev→prod; brak realnego builda = `NOT RUN`, więc `GO_TOOLS` niedostępne. Patrz `RELEASE_DEBUG_GUARD.md`.

## Bezwzględny detektor bazowego kodu (weryfikacja 2026-10-17)
Sprawdź w bieżącym `game.js`: `class DevPanel`, `DEV_ACCESS_KEY`, `window.game.devPanel`, `devBoot` oraz `index.html` → `game.js`. Samo hasło, 7 tapnięć i zapisy `*_devSandbox_*` nie izolują kodu produkcyjnego. Jeśli implementacja działa w publicznym monolicie, `GO_TOOLS=FAIL` mimo poprawnego działania panelu; potrzebny osobno zatwierdzony patch rozdzielenia dev/release. Weryfikator bada dodatkowo znane podpisy bez markera. Osobno `check_pages_workflow.py` i porównanie aktywnego URL z release bytes.
