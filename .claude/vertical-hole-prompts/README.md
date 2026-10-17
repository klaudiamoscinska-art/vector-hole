# Vertical Hole — 15 promptów rozwojowych + P00 + 5 promptów naprawczych (v1.4.4)

**Wymagana paczka skilli: v1.4.2 lub nowsza (zalecana: załączona v1.4.3). Nie używaj v1.4.1 ani starszych** — starszy kontroler publikacji Pages mógł błędnie uznawać niebezpieczną konfigurację za poprawną. Rozpakuj ZIP skilli do oddzielnego folderu, **nie bezpośrednio na repo gry**; uruchom z tego folderu `python scripts/install.py /sciezka/do/vertical-hole`, następnie `python scripts/validate.py --repo /sciezka/do/vertical-hole` oraz `python -m unittest discover -s scripts/tests -v`. Instalator zachowuje istniejący `CLAUDE.md`; jego wskazówki trzeba ręcznie scalić. Sprawdź, czy rzeczywiście zainstalowany w repo `check_pages_workflow.py` pochodzi z aktualnej paczki, a nie z pozostałości starej wersji.

**Sprawdzenie spójności paczki:** w folderze promptów uruchom `python check_prompts.py` — to tylko statyczny test instrukcji, nie gry.

**Zasada:** najpierw **P00.md** jako audyt **bez zmiany kodu gry**: trzy zgłoszone ukończone zadania tylko zweryfikuj; FAIL → osobny prompt naprawczy, nigdy automatyczna implementacja w P00. `GO_CORE` = energia, izolacja, grywalna pętla i bezpieczna migracja save (wszystkie PASS). `GO_TOOLS` osobno sprawdza panel debug; brak panelu NIE blokuje poprawy FTUE przy `GO_CORE`, lecz blokuje testy wymagające panelu i wydanie. `GO_RELEASE` wymaga dalszej kontroli. Bez dowodu = `NOT RUN`, nie `PASS`.

Każdy `P*.md` jest pojedynczym samodzielnym zadaniem. Otwórz Claude Code **w katalogu właściwego repo**, zacznij osobną sesję zadania i wklej pełną treść pliku. **Pierwszy wiersz wywołuje bezpośrednio główny skill (`/vh-...`)**, zamiast liczyć, że koordynator sam go wybierze. Jeśli klient nie rozpoznaje wywołania z wklejonego tekstu, wywołaj komendę `/vh-...` osobno i wklej resztę zadania. Skille pomocnicze są checklistami/kompetencjami do użycia tylko gdy potrzebne; nie są z definicji autonomicznymi agentami.

## Obowiązkowa kolejka błędów audytu — NOWOŚĆ v1.4.2

**Nie pomijaj tego etapu po P00.** P00 pozostaje tylko audytem i nie zmienia kodu. Na jego podstawie uruchamiaj osobno zadania **PX01–PX05**, wyłącznie dla błędów potwierdzonych na aktualnym snapshocie. Nie uruchamiaj pięciu dużych patchy naraz; po każdym wykonaj regresję i nowy snapshot dowodów. Każdy plik jest gotowym poleceniem do Claude Code (z wywołaniem głównego skilla w pierwszym wierszu).

| Kolejka po P00 | Błąd z audytu | Warunek | Wynik wymagany |
|---|---|---|---|
| [PX01-SAVE.md](PX01-SAVE.md) | VH-03 — nadpisywanie save przy niepewnej migracji | Jeżeli CORE-SAVE=FAIL lub brak testów SAVE-08/09 | Bezstratne bezpieczne odczyty/migracje, testy |
| [PX02-ISOLATION.md](PX02-ISOLATION.md) | VH-02 — przenikanie ekonomii i bonusów między trybami | Jeżeli CORE-ISOLATION=FAIL; po PX01 jeśli save zagrożony | Arena niezależna, zachowane stare uprawnienia |
| [PX03-DEV-PANEL.md](PX03-DEV-PANEL.md) | VH-01 — debug kod w release | Jeśli TOOLS-DEV=FAIL | Odrębne artefakty DEV/RELEASE |
| [PX04-PAGES.md](PX04-PAGES.md) | VH-04 — publikacja `claude/**` i katalogu `.` | Jeśli release workflow jest niebezpieczny; po PX03 | Kontrolowana publikacja z czystego release |
| [PX05-LIVE-PRODUCTION.md](PX05-LIVE-PRODUCTION.md) | VH-05 — fałszywy test hosta produkcyjnego | Zawsze przed wydaniem, po przygotowaniu release | Prawdziwy test live bez mocków, zgodność hashów |

**Bramki:** PX01 i PX02 to blokery `GO_CORE`. PX03–PX05 to blokery `GO_TOOLS` / `GO_RELEASE` i nie są pretekstem do odkładania niezależnych poprawek gameplay po `GO_CORE`. `PX05` może zwrócić `NOT RUN`, dopóki właścicielka świadomie nie zatwierdzi nowego deploymentu. Poprawka definicji workflow **nie jest zgodą na push ani publikację**. Jeśli P00 potwierdzi brak problemu, zachowaj `NO CHANGE` zamiast refaktoru. Po naprawach powtórz **P00** w trybie read-only; dopiero potem realizuj zwykłe prompty.

## Zalecana kolejność — zależności i wpływ na pierwszą sesję

1. [P00.md](P00.md) — Weryfikacja wdrożonych fundamentów (bez zmian kodu, obowiązkowy) (główny: `vh-director`). Następnie wykonaj warunkowo kolejkę PX01–PX05 powyżej i ponów P00.
2. [P14B.md](P14B.md) — Pauza, utrata fokusu i zablokowane wejście (główny: `vh-game-engineer`).
3. [P06B.md](P06B.md) — M59 — skala dziury na telefonie (główny: `vh-mobile-accessibility`).
4. [P14A.md](P14A.md) — Telefon — obsługa orientacji pionowej (główny: `vh-mobile-accessibility`).
5. [P14D.md](P14D.md) — Minimalny legalny pomiar pierwszej sesji (główny: `vh-analytics-experiments`).
6. [P04-05.md](P04-05.md) — FTUE — pierwsze 5 minut od wejścia (główny: `vh-ux-gamefeel`).
7. [P07.md](P07.md) — Arena — wielkość rywali a ranking (główny: `vh-arena-gameplay`).
8. [P08.md](P08.md) — Ekran nagrody i następna arena (główny: `vh-ux-gamefeel`).
9. [P06A.md](P06A.md) — M32 — ikona witryny (główny: `vh-mission-content`).
10. [P09.md](P09.md) — Ikony w oknie celów misji (główny: `vh-mission-content`).
11. [P10.md](P10.md) — Jednolite nazwy obiektów i misji (główny: `vh-mission-content`).
12. [P11.md](P11.md) — Audyt kupowanych wzmocnień (główny: `vh-progression-economy`).
13. [P12.md](P12.md) — Nagrody i warsztat — pełny obieg (główny: `vh-progression-economy`).
14. [P13.md](P13.md) — Zróżnicowanie trudności i misji (główny: `vh-progression-economy`).
15. [P14E.md](P14E.md) — Pryzmaty po usunięciu energii (główny: `vh-progression-economy`).
16. [P14C.md](P14C.md) — Przywracanie zakupów (tylko jeśli istnieje IAP) (główny: `vh-monetization`).

**Uwaga:** P00-CORE i pilne P0/P1 najpierw; P00-TOOLS osobno przed testami wymagającymi panelu i wydaniem; FTUE oraz zgodna z prawem minimalna instrumentacja przed rozszerzaniem warsztatu i ekonomii. Jeśli M59/P11 blokuje rzeczywistą rundę, napraw w priorytecie P1 wcześniej. Kolejność reszty jest propozycją, nie ślepym harmonogramem.

## Kryteria pomiaru
- `R5-entry`: gracz nadal obecny/aktywny w chwili t=300 s **od wejścia na stronę**, wg jawnej kwalifikacji, zgód i brakujących danych (cel pięciominutowego zatrzymania).
- `A5-playtime`: gracz uzbierał 300 s aktywnego gameplay (bez pauz/reklam) — *osobny wskaźnik*, nie zastępuje R5.
- Testy botów potwierdzają mechanikę, a nie retencję realnych graczy. Wszystkie raporty: `PASS / FAIL / NOT RUN`, polecenia, urządzenia, wersja i ograniczenia.

## Ważne różnice między portalami
Poki `commercialBreak` przy świadomym powrocie do rozgrywki z pauzy/przerwy; CrazyGames `midgame` według własnych wymagań na naturalnych granicach. Reklamy/rewarded nie mogą wznawiać gry pomimo ręcznej pauzy albo zmiany trybu. Obowiązuje `.claude/vertical-hole/PLATFORM_RULES.md` i aktualna oficjalna dokumentacja portalu.

## Zmiany v1.3 względem v1.2
- P00-CORE (energia, niezależność areny, pętla, migracje) i P00-TOOLS (panel testowy) są **weryfikacją już wykonanej pracy**, nie poleceniem ponownej implementacji. Brak panelu nie blokuje FTUE po GO_CORE.
- P11: zakres kampanijnego magnesu zamiast arenowego przykładu. P12/P14E: testy historycznych sald, ekwipunku, uprawnień i idempotencji migracji. P14D/P04-05: legalny mianownik, braki i protokół nowych graczy.
- We wszystkich promptach bramka `GO_CORE`/`GO_TOOLS` jest spójna z paczką skilli v1.2. `WSZYSTKIE_PROMPTY.md` generowane z 16 pojedynczych plików; nie edytuj go osobno.

## Bezpieczne użycie v1.3
- **Nie opieraj się tylko na `git HEAD`:** po edycjach bez commitu HEAD pozostaje stary. Zapisuj fingerprint finalnego kodu poleceniem z `EVIDENCE_FRESHNESS.md`, wykonuj testy po ostatnim patchu i ponów je po kolejnej zmianie.
- P00 nie jest poleceniem do wielkiego jednorazowego refaktoru: odkryj schematy legacy, naprawiaj małymi krokami, nie niszcz sald i uprawnień.
- Panel debug w wersji dev **nie** dowodzi bezpieczeństwa release: weryfikuj dwa osobne artefakty narzędziem `verify_release_artifact.py` i ręcznymi testami.
- **CrazyGames orientacja:** konfiguracja w submission + kontrola w iframe; nie dubluj portalu overlayem bez konieczności.
- Metryka R5 od wejścia to punkt t=300 z jawnym `UNKNOWN` dla mrożonych timerów, zgód i utraty obserwacji; pozorna liczba „5 min” bez wiarygodnego mianownika nie jest retencją.
- Użyj pojedynczych plików `P*.md`, a `WSZYSTKIE_PROMPTY.md` traktuj jako kopię wygenerowaną.

**Weryfikatory w repo po instalacji v1.4:** `python .claude/vertical-hole/tools/check_evidence.py --repo . --manifest VH_PREFLIGHT_MANIFEST.json --snapshot` oraz `python .claude/vertical-hole/tools/verify_release_artifact.py --dev-build ... --release-build ...`. Nie wskazuj kodu gry jako dowodu; logi tylko w `.claude/vertical-hole/evidence/`.

## Krytyczne odkrycia aktualnego publicznego źródła — 2026-10-17
P00 musi porównać je z AKTUALNYM repo, bez modyfikacji kodu gry: wspólna moneta i XP oraz bonusy `SKINS.perks` wpływające na Arenę; `class DevPanel` / `window.game.devPanel` w głównym JS (pomimo hasła); migracja `loadSave()` zapisująca dane przy odczycie; workflow Pages deployujący z `claude/**` i `path: "."`. Potwierdzony wpływ → odpowiednie `CORE-ISOLATION=FAIL`, `TOOLS-DEV=FAIL`, `CORE-SAVE=FAIL/NOT RUN`, `GO_RELEASE=STOP`. Nie myl walidacji paczek z testami gry. Nowy pomocnik: `python .claude/vertical-hole/tools/check_pages_workflow.py --repo .`. P00 wyłącznie raportuje i proponuje osobne małe patche do świadomej decyzji właścicielki.


**Doprecyzowanie testu produkcji (v1.4.1):** `qa/dev-panel.mjs` podstawia lokalne pliki przez `context.route` pod adres Pages, więc jego test „production host” jest pozorowany. `GO_RELEASE` wymaga osobnego sprawdzenia realnego publicznego URL bez routingu/moków, spisu plików i hashów zatwierdzonego artefaktu; przy braku wiarygodnego dostępu `NOT RUN`.

## Audyt niezależny v1.4.3 — ważne przed uruchomieniem kolejki
W skryptach skilli v1.4.1 znaleziono krytyczny błąd: `check_pages_workflow.py` zwracał `PASS` dla `path: ./`, `path: ${{ github.workspace }}` i publikacji z `feature/**`. Paczka skilli **v1.4.2** ma fail-closed i regresje. Skille poprawiają także sprzeczność `CHANGE_SAFETY.md`: P00 tylko diagnozuje, PX01–PX05 naprawiają, jeden po drugim. W PX01, PX03, PX04 i PX05 dodano obowiązkowe testy wynikające z tych ryzyk. Nie uznawaj wcześniejszego `GO_RELEASE` z v1.4.1. Żadne narzędzie nie wykonuje deploymentu ani nie zastępuje prawdziwego testu na telefonie.
