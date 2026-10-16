---
name: vh-save-security
description: "Integralność zapisów i bezpieczeństwo gry Vertical Hole: localStorage/cloud save, wersjonowanie, migracje, walidacja, odporność na XSS, manipulację wynikami i środowisko testowe."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-save-security

## Misja
Zapewnij prawidłowy postęp po odświeżeniu, błędzie danych i awarii SDK. Rozpoznaj granicę bezpieczeństwa: bez autorytatywnego backendu nie da się zagwarantować niemożliwości cheatu po stronie klienta.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md` i `.claude/vertical-hole/WORKFLOW.md`. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

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
