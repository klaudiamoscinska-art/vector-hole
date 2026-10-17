---
name: vh-save-security
description: "Integralność zapisów i bezpieczeństwo gry Vertical Hole: localStorage/cloud save, wersjonowanie, migracje, walidacja, odporność na XSS, manipulację wynikami i środowisko testowe."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-save-security

## Misja
Zapewnij prawidłowy postęp po odświeżeniu, błędzie danych i awarii SDK. Rozpoznaj granicę bezpieczeństwa: bez autorytatywnego backendu nie da się zagwarantować niemożliwości cheatu po stronie klienta.

## Kontrola v1.3 — obowiązuje w każdej sesji
Przed zmianą kodu czytaj `.claude/vertical-hole/CHANGE_SAFETY.md`; przed zaakceptowaniem testów / użyciem wcześniejszego raportu P00 czytaj `.claude/vertical-hole/EVIDENCE_FRESHNESS.md`. Sam `git HEAD` nie dowodzi tożsamości roboczego kodu. Test PASS dotyczy wyłącznie bieżącego snapshotu; niekompletny lub starszy raport traktuj jako `NOT RUN`. Dla zadań dotykających panelu/builda czytaj także `.claude/vertical-hole/RELEASE_DEBUG_GUARD.md`.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md`, `.claude/vertical-hole/PREFLIGHT_GATES.md`, `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` i `.claude/vertical-hole/WORKFLOW.md`. Przed nowymi funkcjami sprawdź `GO_CORE` (energia, izolacja, pętla, migracja zapisu): przy FAIL/NOT RUN niezwiązanym z zadaniem nie rozwijaj feature’u, tylko zgłoś blokadę i potrzebną naprawę. `GO_TOOLS` (panel) jest bramką niezależną: jego brak nie blokuje napraw FTUE/gameplay, ale ogranicza testy wymagające panelu i wydanie. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Istniejące save keys, schema/format, adaptery do portali, scoreboard i kod odczytujący URL/query/markup.

## Procedura operacyjna
1. Spisz schematy `arena-stats`, `district-progress`, `settings`, `cosmetics` i wersje; zostaw niezależny postęp areny. Zapewnij migrację starych danych i test round-trip.
2. Waliduj odczyt: typy/liczby/zakresy/enumy, NaN/Infinity, JSON parse fail, brak key, quota, storage denied, wyścigi zapisów i multiple tabs.
3. Tam, gdzie są rekordy wyników, sanitizuj je i wykrywaj nierealne skoki jako sygnał, nie fałszywą gwarancję zabezpieczenia. Ranking publiczny wymaga zaufanego serwera/weryfikacji — zgłoś ograniczenie, jeśli to tylko localStorage.
4. Nie używaj `innerHTML` na danych niezweryfikowanych; unikaj eval, otwartych redirectów, niepewnych CDN i ujawniania tokenów w frontendzie.
5. Zadbaj, aby debug console nigdy nie znalazł się w produkcyjnym publicznym buildzie, a testowe postępy nie zostały przepisane na konto gracza.
6. Testuj save na wyłączonym storage, przy zmianie trybu, cache refresh, downgrade/upgrade wersji; zapewnij reset tylko na explicit action i backup lokalny gdy możliwy.

## Definition of Done / dowód ukończenia
Zachowany postęp, jawna strategia migracji, testy corrupt/legacy state, brak sekretów w bundlu i brak test panelu w publicznym buildzie. Znane nieusuwalne ryzyko client-side cheat opisane.

## Zakazy i alarmy
Nie obiecuj anti-cheat przez obfuskację JS; nie zbieraj danych osobowych do walki z cheaterami bez podstawy; nie nadpisuj bez pytania istniejących zapisów użytkownika.

## Współpraca
Gdy niezbędne, użyj także: `vh-game-engineer`, `vh-test-console`, `vh-legal-risk`, `vh-qa-automation`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.

## Testy izolacji zapisu
Zapis i migracje areny, kampanii i wspólnych kosmetyków mają być rozłączne zgodnie z `ARENA_DISTRICT_CONTRACT.md`. Testy: uszkodzenie/missing save jednego trybu, reset kampanii, stare saldo/przedmiot i reload nie mogą uszkodzić ani zmienić postępu/balansu areny. Dev panel zapisuje wyłącznie w przestrzeni testowej.

## Bezpieczna migracja v1.2 — warunek napraw energii/nagród/waluty
Przeczytaj `.claude/vertical-hole/SAVE_MIGRATION_CONTRACT.md` przed modyfikacją któregokolwiek klucza zapisu. Zabezpiecz dawny format/backup, utrzymaj parser legacy *tylko do odczytu*, usuń aktywną logikę energii, migruj atomowo i idempotentnie. Potwierdź syntetycznymi fixture'ami SAVE-01..07 zachowanie sald, zakupionych uprawnień, nagród, progresu dzielnic i statystyk areny. Nie ma zgody na automatyczny reset przy błędzie JSON albo konfliktach chmury.

## Nieodwracalność zapisów v1.3
Żadna automatyczna naprawa energii nie może skasować sald/claimów/inventory. Wymagaj przetestowanego planu rollback, wariantów legacy i konfliktów multi-tab/cloud, nie tylko słownego zapewnienia o idempotencji. Jeśli parser nie rozumie wersji, STOP destrukcyjnego zapisu. Test wynikiem PASS tylko dla bieżącego snapshotu (`CHANGE_SAFETY.md`, `EVIDENCE_FRESHNESS.md`).

## Obligatoryjne SAVE-08/09 (2026-10-17)
Nie deklaruj bezpiecznej migracji, gdy `loadSave()` od razu zapisuje wynik `migrateSave()` z możliwym `defaultSave()` przy niepoprawnym typie `coins/owned`. Test nieznanego przyszłego `schemaVersion`, błędnych pól/połowicznego JSON, dwóch kart oraz przerwanego zapisu musi dowieść braku nadpisania oryginału. Rezygnacja z gry bez utraty zapisów jest lepsza niż pozornie udany reset. P00 tylko audytuje i planuje poprawkę.
