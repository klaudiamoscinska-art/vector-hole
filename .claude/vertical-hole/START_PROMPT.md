# Komenda startowa do Claude Code

Przed nowymi zmianami uruchom **P00.md** w trybie wyłącznie weryfikacyjnym: CORE (energia, izolacja, pętla, legacy save) i TOOLS (istniejący panel). **Te trzy zadania są już deklarowane jako wdrożone; nie koduj ich ponownie**. Jeżeli raport wykaże FAIL, utwórz osobne zadanie naprawcze. Po uzyskaniu rzeczywistego GO_CORE skopiuj poniższy prompt:

> Użyj `/vh-director` i wszystkich **faktycznie potrzebnych** skilli Vertical Hole, ale nie wywołuj ich wszystkich bez powodu. Działaj samodzielnie nad lokalnym kodem, zgodnie z `.claude/vertical-hole/PROJECT_CHARTER.md`. Najpierw sprawdź stan repo, potem wykonaj konkretną poprawkę o największej wartości dla strategii Arena First. Nie przywracaj energii limitującej grę, nie łącz postępu areny z dzielnicami i nie rozbudowuj bez potrzeby kampanii. Zachowaj kompatybilność HTML/CSS/JS/Canvas 2D. Przed każdą zmianą określ test, po zmianie wykonaj go i pokaż dowody. Stosuj pełną autonomię w ramach lokalnego kodu, ale bez publikacji, wydatków, podpisywania umów i operacji nieodwracalnych. Końcowy raport: co zrobiłaś, które pliki, PASS/FAIL/NOT RUN, co poprawiło się w pomiarze, co pozostało niepewne, priorytet następnego kroku. Nie przedstawiaj hipotez jako faktów.

**Tryb konkretnej rundy:** jeśli wyznaczę jeden punkt (np. „tylko punkt 3: okno testowe”), wykonaj wyłącznie jego zakres wraz z niezbędnymi testami i poprawkami zależności, ale nie dokładaj nowej funkcjonalności gry.

## Ważne v1.3
Na początku sprawdź `.claude/vertical-hole/CHANGE_SAFETY.md` i `.claude/vertical-hole/EVIDENCE_FRESHNESS.md`. Nie dziedzicz P00 PASS, jeżeli testy nie obejmują aktualnego roboczego snapshotu. Panel testowy sprawdzaj na dev/release oddzielnie według `RELEASE_DEBUG_GUARD.md`.
