---
name: vh-market-intelligence
description: "Badanie rynku i konkurencji hole.io, gier arcade HTML5, trendów portali, odróżników Vertical Hole oraz hipotez produktu i ceny uwagi gracza bez halucynowania liczb."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-market-intelligence

## Misja
Zamień konkurencyjne otoczenie na konkretne decyzje o pierwszych 30 sekundach, odróżniku, prezentacji produktu oraz kanale wydania. Nie kopiuj IP ani pomysłów bez adaptacji.

## Kontrola v1.3 — obowiązuje w każdej sesji
Przed zmianą kodu czytaj `.claude/vertical-hole/CHANGE_SAFETY.md`; przed zaakceptowaniem testów / użyciem wcześniejszego raportu P00 czytaj `.claude/vertical-hole/EVIDENCE_FRESHNESS.md`. Sam `git HEAD` nie dowodzi tożsamości roboczego kodu. Test PASS dotyczy wyłącznie bieżącego snapshotu; niekompletny lub starszy raport traktuj jako `NOT RUN`. Dla zadań dotykających panelu/builda czytaj także `.claude/vertical-hole/RELEASE_DEBUG_GUARD.md`.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md`, `.claude/vertical-hole/PREFLIGHT_GATES.md`, `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` i `.claude/vertical-hole/WORKFLOW.md`. Przed nowymi funkcjami sprawdź `GO_CORE` (energia, izolacja, pętla, migracja zapisu): przy FAIL/NOT RUN niezwiązanym z zadaniem nie rozwijaj feature’u, tylko zgłoś blokadę i potrzebną naprawę. `GO_TOOLS` (panel) jest bramką niezależną: jego brak nie blokuje napraw FTUE/gameplay, ale ogranicza testy wymagające panelu i wydanie. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Obecny build lub gameplay video, grupa docelowa bez domysłów, oficjalne regulaminy kanałów, źródła i daty publikacji sprawdzane na bieżąco jeśli jest dostęp do internetu.

## Procedura operacyjna
1. Przygotuj listę 5–8 rzeczywiście zbliżonych gier/formatów i opisz pętlę pierwszej rundy, sterowanie, moment wzrostu, clear goal, długość wejścia, monetizację i unikalność; podaj URL+datę źródła.
2. Oddziel obserwację (samodzielny test/screen), ocenę i prognozę. Nie twierdź, że znasz retencję, eCPM, przychody lub algorytm rankingu konkurenta bez danych.
3. Sformułuj najwyżej 3 hipotezy wartości Vertical Hole względem alternatyw: skala miasta, spektakularny finał, czytelny porządek tierów, rywale itp. Wymagaj widocznego wyróżnika w pierwszym klipie.
4. Dopasuj hipotezy do kanału dystrybucji, preferowanego iframe/mobile, ograniczeń na assety i umowę o wyłączność. Zaproponuj 2 krótkie eksperymenty z mierzalnymi wynikami.
5. Oszacuj koszt alternatywny każdej nowej funkcji i rekomenduj co wyciąć przed testami.

## Definition of Done / dowód ukończenia
Tabela porównawcza z cytowanymi źródłami i datą, mapa wyróżników, ranking eksperymentów. Brak internetu: oznacz `UNVERIFIED / do sprawdzenia`, nie wymyślaj benchmarków.

## Zakazy i alarmy
Nie deklaruj „100 mln pobrań”, pewności przychodu, rankingów portalu, praw do cudzych grafik ani gwarantowanych progów algorytmu.

## Współpraca
Gdy niezbędne, użyj także: `vh-director`, `vh-marketing-aso`, `vh-analytics-experiments`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.
