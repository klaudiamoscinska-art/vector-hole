---
name: vh-test-console
description: "Bezpieczny panel deweloperski Vertical Hole na telefon i PC: odblokowanie wszystkich dzielnic, warsztatu, skinów/efektów, szybkie przechodzenie misji, reset, seed i kontrola stanów."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-test-console

## Misja
Dostarcz narzędzie testowe łatwe do uruchomienia na własnym telefonie bez ryzyka przypadkowego ujawnienia graczom, wycieku zapisów i oszukiwania w rankingach.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md` i `.claude/vertical-hole/WORKFLOW.md`. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Struktura projektu, system build/dev-mode, format zapisów/odblokowań, render UI, hosting preview i to, co użytkowniczka chce testować.

## Procedura operacyjna
1. Odkryj, czy repo ma `import.meta.env`, `NODE_ENV`, flagę URL, bundler czy pliki statyczne. Wybierz **build-time development-only** zamiast sekretnych kliknięć/hasła ukrytego w JS. Nie zakładaj dostępności backendu.
2. Dodaj lokalny interfejs widoczny tylko w dev buildzie: mały pływający przycisk safe-area, osobne okno, czytelne grupy i przycisk zamknięcia; działa dotykiem i myszą.
3. Funkcje testowe: odblokuj wszystkie dzielnice, wszystkie narzędzia warsztatu, efekty/skiny, ustaw tier T1–T6, dodaj walutę testową jeżeli istnieje, przewiń misję/wybierz Mxx, ustaw losowy seed, uruchom arenę, wyczyść tylko dane testowe.
4. Wstrzymaj testowe zapisy w odrębnym namespace/storage/profile; zmiany menu muszą działać przez publiczne API gry/state actions, nie chaotyczne przepisywanie JSON localStorage.
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
