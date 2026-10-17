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

---

# PEŁNE TREŚCI — P00 + 15 PROMPTÓW + 5 NAPRAW KRYTYCZNYCH

---

## P00.md

/vh-director Wykonaj P00 v1.4.2 w AKTUALNYM repo Vertical Hole. WYŁĄCZNIE WERYFIKACJA: nie modyfikuj kodu gry ani nie implementuj ponownie energii, izolacji areny i panelu testowego; TOOLS oceń niezależnie. Nie myl kontroli ZIP z testem gry.

ZADANIE P00 — sprawdź rzeczywiste ukończenie trzech wdrożonych zadań, migracje i pętlę gry. Audyt kodu bez jego modyfikowania.

**Skill główny:** `vh-director`  
**Skille pomocnicze:** `vh-game-engineer`, `vh-arena-gameplay`, `vh-progression-economy`, `vh-test-console`, `vh-save-security`, `vh-qa-automation`, `vh-mobile-accessibility`

**Ważne od właścicielki:** trzy zadania zostały już wykonane: (1) usunięcie odnawialnej energii, (2) rozdzielenie areny od dzielnic, (3) mobilny panel testowy. **Nie wdrażaj ich drugi raz ani nie refaktoruj przy okazji.** Oceń funkcje w aktualnym repo, sprawdź możliwe regresje i przygotuj tylko raport PASS/FAIL/NOT RUN. Każda ewentualna naprawa wymaga osobnego promptu; w tym zadaniu NIE zmieniaj kodu źródłowego gry. Dozwolone: uruchamianie testów/buildów oraz zapis raportu i logów pod `.claude/vertical-hole/evidence/`.

1. **P00-AUDIT (bez zmiany gry):** sprawdź `CLAUDE.md`, `.claude/vertical-hole/{PREFLIGHT_GATES,ARENA_DISTRICT_CONTRACT,SAVE_MIGRATION_CONTRACT,CHANGE_SAFETY,EVIDENCE_FRESHNESS,RELEASE_DEBUG_GUARD,SKILL_EVALUATION,WORKFLOW}.md`, `git rev-parse HEAD`, `git status --short` i faktyczny kod/testy/build. Ustal źródła prawdy, legacy formaty, dostępne urządzenia i miejsca obcych zmian. Bez repo i gry -> CORE/TOOLS runtime `NOT RUN`, nigdy GO. Nie resetuj drzewa.
**TWARDY KONTEKST BIEŻĄCEGO REPO, DO PONOWNEGO SPRAWDZENIA NA SNAPSHOCIE (audyt 2026-10-17):** W `game.js` znaleziono `class DevPanel` i `window.game.devPanel` w głównym, publicznym JS; współdzielone `save.coins` / `grantXp` / zakup `RUN_TOOLS` i bonusowe `SKINS.perks`; migrację `loadSave()` zapisującą od razu do `localStorage`; workflow GitHub Pages z branchami `claude/**` i `path: "."`. Jeżeli nadal są obecne: **TOOLS-DEV=FAIL**, **CORE-ISOLATION=FAIL** (po potwierdzeniu wpływu ekonomii i premii), **CORE-SAVE=FAIL/NOT RUN** do testu SAVE-08/09, a **GO_RELEASE=STOP** niezależnie od CORE. Nie zmieniaj kodu ani workflow w P00; podaj odrębne zadania naprawcze, bez zrzucania wszystkiego do FTUE.

2. **P00-CORE — oceń cztery osobne testy:** `CORE-ENERGY`: **potwierdź brak** aktywnych regeneracji/cooldown/limitów wejść (legacy energy tylko odczyt w migratorze); `CORE-ISOLATION`: odblokowana arena, wejście/restart niezależny od misji/warsztatu/walut, po pierwszej rundzie główne CTA „Następna arena”; `CORE-LOOP`: start→sterowanie→pochłonięcie→wynik→druga arena z prawidłową pauzą i mobile; `CORE-SAVE`: zachowaj dotychczasowe salda, nagrody, inventory, odblokowania oraz progres w bezpiecznych, idempotentnych i odwracalnych migracjach.
3. **Nie naprawiaj w ramach P00:** sporządź tabelę `stwierdzony problem → ryzyko → istniejący test → sugerowany najmniejszy patch → test regresji → rollback`; w tym zadaniu patch pozostaje **tylko planem**. Uruchom dostępne istniejące testy SAVE-01..07 i BOOST-01..03 (jeśli nie istnieją, raportuj brak). Przy nieznanym legacy save nie podejmuj żadnej konwersji. Uruchom także SAVE-08 (przyszły schemaVersion) i SAVE-09 (niepoprawny kształt/JSON + próba zapisu); sprawdź, czy loadSave nie nadpisuje wejściowych bajtów podczas niepewnej migracji. Nie tworząc testów ani nowego kodu w repo, brak zakresu oznacz FAIL/NOT RUN, nie fikcyjny PASS.
4. **P00-TOOLS — oddzielny zakres:** sprawdź działanie panelu dev na telefonie/desktopie, izolację zapisów, brak mutatorów w produkcji. **Jeśli jeden publiczny `game.js` zawiera `DevPanel`, wynik `TOOLS-DEV=FAIL` także przy działającym kodzie dostępu i odrębnym sandbox save.** Panel musi być kompilowany wyłącznie do osobnego dev artifact i zawierać `VH_DEV_CONSOLE_ONLY`. Zbuduj dev/release i uruchom z paczki `python .claude/vertical-hole/tools/verify_release_artifact.py --dev-build ... --release-build ...`; dodatkowo ręcznie sprawdź lazy bundle, dev global API, QA debug URL i prod storage. Bez dwóch realnych artefaktów / fizycznego telefonu: `TOOLS-DEV=NOT RUN` lub `FAIL`, nie GO_TOOLS. Jeśli panelu brak albo nie działa, tylko opisz osobny proponowany patch (bez implementacji), ale nie uzależniaj `GO_CORE` od panelu.
5. **Dowody po OSTATNIEJ zmianie kodu:** zapisz prawdziwe polecenia/logi i sprzęt, zapisz manifest `VH_PREFLIGHT_MANIFEST.json` i logi pod `.claude/vertical-hole/evidence/`; zaktualizuj `source_snapshot_sha256` / `source_snapshot_file_count` oraz `snapshot_sha256` checków wg `.claude/vertical-hole/EVIDENCE_FRESHNESS.md` i narzędzia `python .claude/vertical-hole/tools/check_evidence.py --repo ... --manifest ... --snapshot`. Sam `git HEAD` nie wystarcza przy dirty worktree. Po każdej kolejnej edycji powtórz odpowiednie testy (nie dziedzicz PASS). Nie nazywaj walidacji manifestu testem gameplay.
5A. **DEPLOYMENT — weto release, nie CORE:** odczytaj `.github/workflows/deploy-pages.yml` i wykonaj `python .claude/vertical-hole/tools/check_pages_workflow.py --repo .`. Branch `claude/**`, `upload-pages-artifact path: "."` i brak kuratorowanego katalogu release to `GO_RELEASE=STOP`; podaj dowód zawartości **aktualnie serwowanego** `game.js`, a jeśli nie da się porównać hashy, oznacz live `NOT RUN`. **UWAGA o istniejącym `qa/dev-panel.mjs`:** sekcja "production host (simulated)" przechwytuje requesty do domeny Pages i zwraca PLIKI LOKALNE (`context.route(...).fulfill(fs.readFileSync(...))`), a przy `VH_DEV_CODE` uznaje za PASS otwarcie panelu na tym symulowanym hoście. **Ten test NIE dowodzi ani bezpieczeństwa rzeczywistego publicznego hosta, ani zgodności wdrożonych bajtów.** Wymagaj dodatkowego realnego testu sieciowego bez `context.route`/mocków i porównania hashy kodu z rzeczywistym artefaktem release; niedostępne = `LIVE-PRODUCTION=NOT RUN`, a nie GO_RELEASE. Nie wdrażaj zmian CI bez wyraźnej zgody.
6. **Decyzje:** `GO_CORE` tylko dla czterech CORE PASS na identycznym finalnym snapshotcie i przy realnie przejrzanych logach; `GO_TOOLS` osobno po build/device/security PASS; `GO_RELEASE` NIE jest objęty P00 i zawsze wymaga osobnego QA oraz zgody. CORE FAIL/NOT RUN blokuje **niepowiązane** nowe funkcje, nie diagnostykę i naprawy blockerów. Brak panelu NIE blokuje FTUE po GO_CORE.
7. Zapisz `VH_PREFLIGHT_REPORT.md`: revision, snapshot SHA, git status przed/po, propozycje osobnych patchy (bez ich wykonywania), lista testowanych obszarów, dowody każdego testu, `PASS/FAIL/NOT RUN`, oddzielne CORE/TOOLS oraz ryzyka i plan kolejnego minimalnego kroku. Realne testy telefonu bez urządzenia = NOT RUN; nie publikuj, nie resetuj danych ani nie wydawaj pieniędzy.

**Zakres:** wyłącznie diagnoza i weryfikacja trzech zgłoszonych ukończonych funkcji oraz SAVE/LOOP; bez poprawek kodu fundamentów/TOOLS. Nie podejmuj destrukcyjnych migracji i przebudów niemożliwych do odwrócenia bez mojej wyraźnej zgody.


**PRZEKAZANIE DO KOLEJKI NAPRAW (v1.4.2, nadal bez edycji gry w P00):** W raporcie dodaj tabelę `VH-03 → PX01-SAVE.md`, `VH-02 → PX02-ISOLATION.md`, `VH-01 → PX03-DEV-PANEL.md`, `VH-04 → PX04-PAGES.md`, `VH-05 → PX05-LIVE-PRODUCTION.md`, z kolumnami `potwierdzone / już naprawione / niezweryfikowane`, `dowód`, `GO`, `następny prompt`. Przy potwierdzonym FAIL wskaż konkretny plik PX i kolejność; nie zakładaj, że raport sam naprawia kod. Każdą PX uruchamiaj jako osobne zadanie i po patchu ponów adekwatną część P00. Jeżeli brak dowodu, `NOT RUN`, nigdy bezpodstawne PASS.

**Kontrola fałszywego PASS workflow (audyt walidatora v1.4.2):**
Starsze `check_pages_workflow.py` uznawało jako PASS także `path: ./`, `${{ github.workspace }}` i `feature/**`. Przyjmuj dowód tylko z aktualnej wersji narzędzia + negatywnych fixture'ów; przejrzyj wszystkie workflow, reguły branch protection i wymaganych reviewerów w GitHub Settings. Samo `environment: github-pages` lub zielony kontroler statyczny **nie dowodzi** kontrolowanej publikacji. Jeśli ustawienia i bytes live nie są dostępne: `GO_RELEASE=STOP`, stan testu `NOT RUN`. Wszystkie naprawy nadal poza P00.

---

## P14B.md

/vh-game-engineer Zrealizuj tylko zadanie opisane poniżej w aktualnym repo Vertical Hole; sprawdź bramkę P00 i wymagane skille pomocnicze.

ZADANIE P14B — Pauza, utrata fokusu i zablokowane wejście.

**Skill główny:** `vh-game-engineer`  
**Skille pomocnicze:** `vh-qa-automation`, `vh-portal-integrations`

Użyj jako głównej kompetencji `vh-game-engineer`; w razie potrzeby współpracuj z vh-qa-automation, vh-portal-integrations.

Po utracie fokusu gry runda się nie pauzuje, a wciśnięty klawisz potrafi pozostać „zablokowany”. Napraw obsługę cyklu życia strony i całego stanu sterowania.

Prześledź zdarzenia `visibilitychange`, `blur/focus`, `pagehide`, `pointercancel`, `keyup` i mobilne przerwania dotyku, uwzględnij overlay SDK/reklamy. Wprowadzaj centralną, idempotentną pauzę na zmianę aktywności: zamrożenie licznika czasu i symulacji, zatrzymanie lub wygaszenie trwających inputów oraz odtworzenie bez nieoczekiwanego skoku czasu. Wznowienie tylko gdy kontekst jest rzeczywiście grywalny; nie zakładaj, że `focus` oznacza zgodę użytkownika na wznowienie. Zgodność z istniejącym ręcznym przyciskiem pauzy jest obowiązkowa.

**Stan kontrolowany:** zastosuj rozłączne przyczyny pauzy (`manual`, `hidden`, `orientation`, `ad`, `menu/scene transition`), a `resume` wyłącznie po ponownej ocenie wszystkich. Nie wywołuj `gameplayStart()` przy samym focus. Rozróżnij wymagania Poki i CrazyGames dla focus oraz eventów; callback ze starej rundy nie może wznowić nowej. Dodaj sekwencje no-fill, `adError`, obrót podczas reklamy, manual pause w trakcie i powrót z tła. Jeśli w ramach zmiany dotykasz bramki reklamy/adaptera, build produkcyjny sprawdź oddzielnie od dev i wykonaj logi Inspector; nie deklaruj zgodności na podstawie mocka.

**Akceptacja:** testy przy przytrzymanym klawiszu/dotyku, Alt-Tab, minimalizacji, połączeniu i powrocie oraz przerwaniu reklamą; brak „wiecznie wciśniętego” przycisku, podwójnego resume i ujemnego licznika.

**Bezpieczeństwo wersji v1.3:** W aktualnym repo najpierw przeczytaj `.claude/vertical-hole/CHANGE_SAFETY.md` i `EVIDENCE_FRESHNESS.md`. Poprzedni `GO_CORE` oparty tylko o `git HEAD` jest niewystarczający przy niezatwierdzonych zmianach: wymagana zgodność `source_snapshot_sha256` z obecnym kodem i testami wykonanymi po ostatnim patchu. Brak aktualnego dowodu = `NOT RUN`, nigdy domyślny PASS. Wprowadzaj jedną odwracalną zmianę w tym zadaniu, nie ruszaj obcych lokalnych edycji. Nie usuwaj historycznych sald i uprawnień bez osobnej zgody; jeśli wymagałoby to destrukcyjnej migracji, wstrzymaj ją i raportuj blocker. Przy braku narzędzia/urządzenia test docelowy to `NOT RUN`, a nie sukces emulatora. Jeśli zakres dotyka dev panelu, release builda lub SDK, obowiązuje też `RELEASE_DEBUG_GUARD.md`; nie używaj builda dev jako dowodu o produkcji.

**Zasady pracy (obowiązkowe):** Pracuj na AKTUALNYM repozytorium, nie zgaduj nazw plików, klas, pól ani funkcji. Przeczytaj `CLAUDE.md`, `PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, `SAVE_MIGRATION_CONTRACT.md`, `WORKFLOW.md` i `QUALITY_GATES.md` z `.claude/vertical-hole/`. Przed zmianą sprawdź `VH_PREFLIGHT_REPORT.md` (revision i dowody) i adekwatne testy; `GO_CORE` wymaga PASS dla energii, izolacji, pętli i bezpiecznej migracji zapisów. Jeśli CORE=FAIL/NOT RUN, **STOP dla niepowiązanych nowych funkcji** (naprawy blockerów wolno wykonywać). Brak panelu `GO_TOOLS` nie blokuje niezależnych napraw FTUE/gameplay, lecz ogranicza testy wymagające panelu i wydanie. Nie uznawaj `NOT RUN` za PASS. Zastosuj skille wskazane powyżej (lub ich checklisty, jeśli Claude Code nie może ich automatycznie wywołać). Gdy zdiagnozowano rzeczywisty błąd i zmiana jest bezpieczna, wdrażaj kod, nie kończ na analizie; zachowaj istniejące zapisy i nie modyfikuj niepowiązanych systemów. Nie przywracaj energii ograniczającej grę ani zależności postępu, nagród, boostów i walut kampanii od parametrów areny. Zachowaj jej niezależny start i replay. Przy braku danych oznacz hipotezy; nie wymyślaj wyników pomiarów. Po zmianach uruchom testy konkretnego zadania i regresyjne P00/kontraktu dotknięte diffem; pokaż przyczynę, zmienione pliki, konkretne polecenia/testy/urządzenia, dowody działania, PASS/FAIL/NOT RUN, ryzyka i ograniczenia. Nie publikuj bez mojej zgody. **Zajmij się wyłącznie tym zadaniem.**

---

## P06B.md

/vh-mobile-accessibility Zrealizuj tylko zadanie opisane poniżej w aktualnym repo Vertical Hole; sprawdź bramkę P00 i wymagane skille pomocnicze.

ZADANIE P06B — M59 — za duża dziura na telefonie.

**Skill główny:** `vh-mobile-accessibility`  
**Skille pomocnicze:** `vh-arena-gameplay`, `vh-game-engineer`, `vh-qa-automation`

Użyj jako głównej kompetencji `vh-mobile-accessibility`; w razie potrzeby współpracuj z vh-arena-gameplay, vh-game-engineer, vh-qa-automation.

Odtwórz M59 w końcówce misji na małym ekranie telefonu. Dziura rośnie tak bardzo, że prawie nie mieści się w widocznym obszarze, przez co gracz traci orientację i kontrolę.

Sprawdź zależność wielkości dziury w świecie gry, skali renderowania, zoomu kamery, rozdzielczości, DPR, safe area i elementów HUD. Napraw responsywność **bez ukrytego zmniejszania faktycznej mocy czy promienia kolizji dziury**: dopasuj kamerę, skalę obrazu/obszar gry lub reguły kadrowania, zachowując spójność mechaniki. Upewnij się, że obiekty i cele pozostają widoczne, a po zmianie rozmiaru okna sterowanie nie „skacze”.

**Regresje kamery:** oprócz M59 sprawdź co najmniej mały/średni/maksymalny tier, pierwszą minutę areny, zmianę portrait→landscape→portrait, mały telefon 320–375 CSS px i szerszy telefon. Porównaj world units/kolizje przed i po — nie wolno naprawiać wizualnego clippingu kosztem ukrytego nerfu hitboxu.

**Akceptacja:** przejście M59 na małym i średnim telefonie w pionie, także w maksymalnym rozmiarze dziury; brak uciętego kluczowego gameplayu i nachodzenia HUD; porównanie screenshotów/parametrów przed i po, test regresji wcześniejszych tierów.

**Bezpieczeństwo wersji v1.3:** W aktualnym repo najpierw przeczytaj `.claude/vertical-hole/CHANGE_SAFETY.md` i `EVIDENCE_FRESHNESS.md`. Poprzedni `GO_CORE` oparty tylko o `git HEAD` jest niewystarczający przy niezatwierdzonych zmianach: wymagana zgodność `source_snapshot_sha256` z obecnym kodem i testami wykonanymi po ostatnim patchu. Brak aktualnego dowodu = `NOT RUN`, nigdy domyślny PASS. Wprowadzaj jedną odwracalną zmianę w tym zadaniu, nie ruszaj obcych lokalnych edycji. Nie usuwaj historycznych sald i uprawnień bez osobnej zgody; jeśli wymagałoby to destrukcyjnej migracji, wstrzymaj ją i raportuj blocker. Przy braku narzędzia/urządzenia test docelowy to `NOT RUN`, a nie sukces emulatora. Jeśli zakres dotyka dev panelu, release builda lub SDK, obowiązuje też `RELEASE_DEBUG_GUARD.md`; nie używaj builda dev jako dowodu o produkcji.

**Zasady pracy (obowiązkowe):** Pracuj na AKTUALNYM repozytorium, nie zgaduj nazw plików, klas, pól ani funkcji. Przeczytaj `CLAUDE.md`, `PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, `SAVE_MIGRATION_CONTRACT.md`, `WORKFLOW.md` i `QUALITY_GATES.md` z `.claude/vertical-hole/`. Przed zmianą sprawdź `VH_PREFLIGHT_REPORT.md` (revision i dowody) i adekwatne testy; `GO_CORE` wymaga PASS dla energii, izolacji, pętli i bezpiecznej migracji zapisów. Jeśli CORE=FAIL/NOT RUN, **STOP dla niepowiązanych nowych funkcji** (naprawy blockerów wolno wykonywać). Brak panelu `GO_TOOLS` nie blokuje niezależnych napraw FTUE/gameplay, lecz ogranicza testy wymagające panelu i wydanie. Nie uznawaj `NOT RUN` za PASS. Zastosuj skille wskazane powyżej (lub ich checklisty, jeśli Claude Code nie może ich automatycznie wywołać). Gdy zdiagnozowano rzeczywisty błąd i zmiana jest bezpieczna, wdrażaj kod, nie kończ na analizie; zachowaj istniejące zapisy i nie modyfikuj niepowiązanych systemów. Nie przywracaj energii ograniczającej grę ani zależności postępu, nagród, boostów i walut kampanii od parametrów areny. Zachowaj jej niezależny start i replay. Przy braku danych oznacz hipotezy; nie wymyślaj wyników pomiarów. Po zmianach uruchom testy konkretnego zadania i regresyjne P00/kontraktu dotknięte diffem; pokaż przyczynę, zmienione pliki, konkretne polecenia/testy/urządzenia, dowody działania, PASS/FAIL/NOT RUN, ryzyka i ograniczenia. Nie publikuj bez mojej zgody. **Zajmij się wyłącznie tym zadaniem.**

---

## P14A.md

/vh-mobile-accessibility Zrealizuj tylko zadanie opisane poniżej w aktualnym repo Vertical Hole; sprawdź bramkę P00 i wymagane skille pomocnicze.

ZADANIE P14A — Telefon — obsługa orientacji pionowej.

**Skill główny:** `vh-mobile-accessibility`  
**Skille pomocnicze:** `vh-game-engineer`, `vh-portal-integrations`, `vh-qa-automation`

Użyj jako głównej kompetencji `vh-mobile-accessibility`; w razie potrzeby współpracuj z vh-game-engineer, vh-portal-integrations, vh-qa-automation.

Gra ma działać na telefonie w pionie. Po obróceniu do poziomu nie powinna kontynuować niedostosowanej rozgrywki. Dodaj prawidłową obsługę orientacji.

Sprawdź, czy gra działa w przeglądarce, iframe portalu lub środowisku pełnoekranowym. Użyj systemowego zablokowania orientacji tylko w obsługiwanych kontekstach; nie obiecuj fizycznej blokady obrotu w każdej przeglądarce. Gdy wymuszenie nie działa w **samodzielnej wersji gry**, zatrzymaj rozgrywkę i pokaż lokalny overlay „Obróć telefon do pionu” tylko w razie konieczności, nie pozwalając upływać czasowi misji. Dla CrazyGames preferuj ustawienie obsługiwanej orientacji w submission i portalowy ekran obrotu (według dokumentacji portalu); nie wstawiaj drugiego overlayu bez dowodu, że portal go nie zapewnia. Zadbaj o bezpieczne wznowienie, przeliczenie viewportu, zwolnienie wejścia dotykowego, safe areas i brak konfliktu z reklamami/SDK. Desktop ma pozostać używalny.

**Kontrola portalu:** najpierw sprawdź, czy portal (zwłaszcza CrazyGames) potrafi sam pokazywać ekran orientacji. CrazyGames dokumentuje własną kontrolę orientacji dla submission — domyślnie nie implementuj tam własnego overlayu, testuj portalowy iframe. Lokalny fallback tylko gdy jest konieczny i akceptowany; desktop landscape nadal musi wyświetlać grywalny obszar bez mobilnej blokady. Obrót jest osobną przyczyną pauzy; powrót do pionu nie usuwa ręcznej pauzy, trwającej reklamy ani zamiaru wyjścia do menu. Testuj iframe/SDK i tokeny callbacków.

**Akceptacja:** test pion → poziom → pion przed, w trakcie i po rundzie; brak utraty czasu, nieoczekiwanych kliknięć i blokowania stanu; sprawdzenie co najmniej w symulowanych różnych viewportach oraz na urządzeniu, jeśli dostępne.

**Bezpieczeństwo wersji v1.3:** W aktualnym repo najpierw przeczytaj `.claude/vertical-hole/CHANGE_SAFETY.md` i `EVIDENCE_FRESHNESS.md`. Poprzedni `GO_CORE` oparty tylko o `git HEAD` jest niewystarczający przy niezatwierdzonych zmianach: wymagana zgodność `source_snapshot_sha256` z obecnym kodem i testami wykonanymi po ostatnim patchu. Brak aktualnego dowodu = `NOT RUN`, nigdy domyślny PASS. Wprowadzaj jedną odwracalną zmianę w tym zadaniu, nie ruszaj obcych lokalnych edycji. Nie usuwaj historycznych sald i uprawnień bez osobnej zgody; jeśli wymagałoby to destrukcyjnej migracji, wstrzymaj ją i raportuj blocker. Przy braku narzędzia/urządzenia test docelowy to `NOT RUN`, a nie sukces emulatora. Jeśli zakres dotyka dev panelu, release builda lub SDK, obowiązuje też `RELEASE_DEBUG_GUARD.md`; nie używaj builda dev jako dowodu o produkcji.

**Zasady pracy (obowiązkowe):** Pracuj na AKTUALNYM repozytorium, nie zgaduj nazw plików, klas, pól ani funkcji. Przeczytaj `CLAUDE.md`, `PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, `SAVE_MIGRATION_CONTRACT.md`, `WORKFLOW.md` i `QUALITY_GATES.md` z `.claude/vertical-hole/`. Przed zmianą sprawdź `VH_PREFLIGHT_REPORT.md` (revision i dowody) i adekwatne testy; `GO_CORE` wymaga PASS dla energii, izolacji, pętli i bezpiecznej migracji zapisów. Jeśli CORE=FAIL/NOT RUN, **STOP dla niepowiązanych nowych funkcji** (naprawy blockerów wolno wykonywać). Brak panelu `GO_TOOLS` nie blokuje niezależnych napraw FTUE/gameplay, lecz ogranicza testy wymagające panelu i wydanie. Nie uznawaj `NOT RUN` za PASS. Zastosuj skille wskazane powyżej (lub ich checklisty, jeśli Claude Code nie może ich automatycznie wywołać). Gdy zdiagnozowano rzeczywisty błąd i zmiana jest bezpieczna, wdrażaj kod, nie kończ na analizie; zachowaj istniejące zapisy i nie modyfikuj niepowiązanych systemów. Nie przywracaj energii ograniczającej grę ani zależności postępu, nagród, boostów i walut kampanii od parametrów areny. Zachowaj jej niezależny start i replay. Przy braku danych oznacz hipotezy; nie wymyślaj wyników pomiarów. Po zmianach uruchom testy konkretnego zadania i regresyjne P00/kontraktu dotknięte diffem; pokaż przyczynę, zmienione pliki, konkretne polecenia/testy/urządzenia, dowody działania, PASS/FAIL/NOT RUN, ryzyka i ograniczenia. Nie publikuj bez mojej zgody. **Zajmij się wyłącznie tym zadaniem.**

---

## P14D.md

/vh-analytics-experiments Zrealizuj tylko zadanie opisane poniżej w aktualnym repo Vertical Hole; sprawdź bramkę P00 i wymagane skille pomocnicze.

ZADANIE P14D — Pomiar pierwszej sesji i samouczka.

**Skill główny:** `vh-analytics-experiments`  
**Skille pomocnicze:** `vh-legal-risk`, `vh-ux-gamefeel`, `vh-qa-automation`

Użyj jako głównej kompetencji `vh-analytics-experiments`; w razie potrzeby współpracuj z vh-legal-risk, vh-ux-gamefeel, vh-qa-automation.

Analityka pierwszej sesji i samouczka jest niekompletna, ponieważ obecny pasek zgody pojawia się po samouczku. Zaprojektuj i wdroż wiarygodny, zgodny z prawem pomiar FTUE bez pogarszania startu gry.

Zmapuj istniejące SDK, zgody, zdarzenia i faktyczne momenty tutorialu. Zdefiniuj eventy dla gotowości gry, pierwszego inputu, pierwszego pochłonięcia, kroków tutorialu, startu/końca pierwszej areny, przycisku następnej areny, drugiej rundy i aktywności po 300 s; uwzględnij stabilne definicje sesji i mianowniki. Przed zgodą na pomiar opcjonalny **nie zbieraj ani nie przesyłaj wymagających zgody eventów**; nie próbuj „odzyskiwać” historycznych zdarzeń bez właściwej podstawy. Jeśli z platformy można legalnie otrzymać metryki zagregowane, oznacz je odrębnie. Nie blokuj gry banerem ani nie zakładaj, że odmowa oznacza koniec sesji. Dodaj lokalny tryb QA do sprawdzenia eventów bez wysyłki danych.

**Kontrakt 300 sekund (odczytaj `EVENT_TAXONOMY.md` v1.2):** `R5-entry` potwierdza obecność/aktywność **dokładnie t=300 s od wejścia**, a `A5-playtime` 300 s aktywnej symulacji; nie wolno zastępować jednego drugim. Zdefiniuj osobno `N_all_eligible_entries` (tylko gdy legalne i dostępne), `N_observed_at_entry`, `N_success_at_300`, `N_known_exit_before_300`, `N_unknown`, `N_no_consent_or_unmeasured` (lub `UNAVAILABLE`). Event sukcesu w 300. sekundzie NIE jest mianownikiem. Nie uznawaj spóźnionego callbacka `setTimeout(300000)` za dowód aktywności dokładnie w t=300 — mobilna przeglądarka może zamrozić JS; potwierdzaj wiarygodnym monotonicznym czasem i historią visibility/focus, w przeciwnym wypadku `UNKNOWN`. Odróżnij ścisły R5 od przybliżonego proxy z udokumentowaną tolerancją; przeczytaj `EVENT_TAXONOMY.md` v1.3. Udokumentuj, czy dostawca portalu posiada niezależny wiarygodny licznik wejść; jeśli nie, raportuj wyłącznie `R5_observed` z biasem. Nie wykorzystuj fingerprintingu, zgody wymuszanej ani retroaktywnej wysyłki eventów z okresu przed zgodą.

**Akceptacja:** tabela event → podstawa prawna/zgoda → kiedy powstaje → mianownik → retencja danych i ograniczenia. Test pozytywny i negatywny: wejście/porzucenie w 20 s, zgoda dopiero po tutorialu, odmowa, brak zgody, background podczas t=300, uśpienie karty i callback po 330 s, zmiana zegara urządzenia, brak callbacku exit, reload, reklama. Przed eksperymentem wyślij raport pomiarowej gotowości `READY / PARTIAL / NOT READY` z definicją t=0, źródłem denominatora, proporcją unknown, biasem i ryzykiem. Jeśli brak rzetelnego pełnego mianownika, NIE deklaruj pełnego R5 ani wpływu zmiany na wszystkich graczy.

**Bezpieczeństwo wersji v1.3:** W aktualnym repo najpierw przeczytaj `.claude/vertical-hole/CHANGE_SAFETY.md` i `EVIDENCE_FRESHNESS.md`. Poprzedni `GO_CORE` oparty tylko o `git HEAD` jest niewystarczający przy niezatwierdzonych zmianach: wymagana zgodność `source_snapshot_sha256` z obecnym kodem i testami wykonanymi po ostatnim patchu. Brak aktualnego dowodu = `NOT RUN`, nigdy domyślny PASS. Wprowadzaj jedną odwracalną zmianę w tym zadaniu, nie ruszaj obcych lokalnych edycji. Nie usuwaj historycznych sald i uprawnień bez osobnej zgody; jeśli wymagałoby to destrukcyjnej migracji, wstrzymaj ją i raportuj blocker. Przy braku narzędzia/urządzenia test docelowy to `NOT RUN`, a nie sukces emulatora. Jeśli zakres dotyka dev panelu, release builda lub SDK, obowiązuje też `RELEASE_DEBUG_GUARD.md`; nie używaj builda dev jako dowodu o produkcji.

**Zasady pracy (obowiązkowe):** Pracuj na AKTUALNYM repozytorium, nie zgaduj nazw plików, klas, pól ani funkcji. Przeczytaj `CLAUDE.md`, `PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, `SAVE_MIGRATION_CONTRACT.md`, `WORKFLOW.md` i `QUALITY_GATES.md` z `.claude/vertical-hole/`. Przed zmianą sprawdź `VH_PREFLIGHT_REPORT.md` (revision i dowody) i adekwatne testy; `GO_CORE` wymaga PASS dla energii, izolacji, pętli i bezpiecznej migracji zapisów. Jeśli CORE=FAIL/NOT RUN, **STOP dla niepowiązanych nowych funkcji** (naprawy blockerów wolno wykonywać). Brak panelu `GO_TOOLS` nie blokuje niezależnych napraw FTUE/gameplay, lecz ogranicza testy wymagające panelu i wydanie. Nie uznawaj `NOT RUN` za PASS. Zastosuj skille wskazane powyżej (lub ich checklisty, jeśli Claude Code nie może ich automatycznie wywołać). Gdy zdiagnozowano rzeczywisty błąd i zmiana jest bezpieczna, wdrażaj kod, nie kończ na analizie; zachowaj istniejące zapisy i nie modyfikuj niepowiązanych systemów. Nie przywracaj energii ograniczającej grę ani zależności postępu, nagród, boostów i walut kampanii od parametrów areny. Zachowaj jej niezależny start i replay. Przy braku danych oznacz hipotezy; nie wymyślaj wyników pomiarów. Po zmianach uruchom testy konkretnego zadania i regresyjne P00/kontraktu dotknięte diffem; pokaż przyczynę, zmienione pliki, konkretne polecenia/testy/urządzenia, dowody działania, PASS/FAIL/NOT RUN, ryzyka i ograniczenia. Nie publikuj bez mojej zgody. **Zajmij się wyłącznie tym zadaniem.**

---

## P04-05.md

/vh-ux-gamefeel Zrealizuj tylko zadanie opisane poniżej w aktualnym repo Vertical Hole; sprawdź bramkę P00 i wymagane skille pomocnicze.

ZADANIE P04-05 — FTUE — pierwsze 5 minut.

**Skill główny:** `vh-ux-gamefeel`  
**Skille pomocnicze:** `vh-arena-gameplay`, `vh-progression-economy`, `vh-analytics-experiments`, `vh-game-engineer`, `vh-director`

Użyj jako głównej kompetencji `vh-ux-gamefeel`; w razie potrzeby współpracuj z vh-arena-gameplay, vh-progression-economy, vh-analytics-experiments, vh-game-engineer, vh-director.

Przeprojektuj doświadczenie nowego gracza Vertical Hole od otwarcia strony do końca pierwszych pięciu minut, tak aby było natychmiast zrozumiałe, bardzo satysfakcjonujące i zachęcało do pozostania w grze co najmniej 5 minut — bez wydłużania sztucznie pojedynczej rundy.

1. Zbadaj faktyczny przebieg wejścia: start, ekran początkowy, pierwsza interakcja i pochłonięcie, tutorial, czas pierwszej rundy, ekran wyniku/nagrody, kolejny krok. Wskaż tarcia, pusty czas, przeciążenie komunikatami i zbyt późne nagrody.
2. Zaprojektuj i **wdroż** możliwie mały, spójny nowy przebieg pierwszych minut: szybką frajdę z pochłaniania, czytelne sterowanie bez ściany tutorialu, wyraźne małe sukcesy, stopniowe odsłanianie obiektów i mechanik, dobry rytm wydarzeń i satysfakcjonujący finał. Uwzględnij mobile i desktop, dźwięk/efekty tylko gdy faktycznie pomagają.
3. Po pierwszej rundzie **główne CTA ma uruchamiać następną arenę**, a dzielnice pozostają opcjonalną, drugoplanową ścieżką. Nie uzależniaj kolejnej areny od kampanii.
4. Oceniaj osobno długość rund i długość doświadczenia. Nie zakładaj z góry, że każda kolejna arena musi być dłuższa; dobierz tempo i intensywność po analizie.
5. Mierz **dwa różne wskaźniki**: `R5-entry` — odsetek kwalifikujących się nowych sesji z wiarygodnym potwierdzeniem obecności/aktywności dokładnie po **300 sekundach czasu rzeczywistego od wejścia na stronę** (cel produktu), oraz `A5-playtime` — sesje osiągające łącznie 300 sekund aktywnej symulacji (diagnostyka). Nie zaliczaj powrotu z tła ani spóźnionego timera JS po 300 s jako obecności w 300. sekundzie; brak obserwacji = UNKNOWN, nie R5 sukces.  Podaj mianowniki, status nieznany/cenzurowany i luki zgód. Mierz także czas pierwszego pochłonięcia, ukończenie pierwszej rundy, kliknięcie „następna arena” i rozpoczęcie drugiej rundy; eventy zgodne z prawem. Zaproponuj test wariantów, jeśli brak danych graczy.

**Aktualna bramka (2026-10-17):** P00 musi zweryfikować zgłoszoną rozdzielność na poziomie ekonomii (`save.coins`, `RUN_TOOLS`, `SKINS.perks`) oraz czy produkcyjny DevPanel nie blokuje wydania; do czasu potwierdzenia nie nazywaj P00=PASS. Działania naprawcze blockerów wykonuj osobno, nie zakrywaj ich polerowaniem FTUE.

**Etapy zmian:** (A) udokumentuj baseline i scenariusz 0–300 s z pomiarowym `READY/PARTIAL/NOT READY` z P14D; (B) wykonaj **jedną małą, odwracalną** zmianę FTUE bez ruszania kampanii, ekonomii i reklamy; (C) uruchom testy mechaniki i obserwacje 5–10 **nowych** graczy, jeśli są dostępni (nie udawaj ich wykonania), wg `EXPERIMENT_PLAYBOOK.md`. Sprawdź bez podpowiadania zrozumienie celu, first swallow, pierwszy tier, koniec rundy, wybór „Następna arena” i drugi start. Raport przed/po: porównywalne warunki, liczba n, brakujące dane/zgody, guardrails (crash, softlock, FPS, czas startu), lista problemów. Decyzja: `ITERATE / TEST MORE / PAUSE / PIVOT` z uzasadnieniem. Boty i mini-sample nie dowodzą poprawy rzeczywistej retencji. Nie wpisuj wymyślonego R5 jako gwarancji.

**Akceptacja:** gracz może rozpocząć i powtórzyć arenę bez kampanii; brak obowiązkowych ekranów spowalniających pierwszą frajdę; czytelność na małym telefonie; eventy są testowalne i nie dublują się; pokaż scenariusz 0–300 s i realne porównanie przed/po. Bez legalnego mianownika wszystkich wejść wynik R5 dotyczy wyłącznie obserwowanej kohorty; bez rzeczywistych graczy i dostatecznego pomiaru zakaz deklarowania „poprawione R5”.

**Bezpieczeństwo wersji v1.3:** W aktualnym repo najpierw przeczytaj `.claude/vertical-hole/CHANGE_SAFETY.md` i `EVIDENCE_FRESHNESS.md`. Poprzedni `GO_CORE` oparty tylko o `git HEAD` jest niewystarczający przy niezatwierdzonych zmianach: wymagana zgodność `source_snapshot_sha256` z obecnym kodem i testami wykonanymi po ostatnim patchu. Brak aktualnego dowodu = `NOT RUN`, nigdy domyślny PASS. Wprowadzaj jedną odwracalną zmianę w tym zadaniu, nie ruszaj obcych lokalnych edycji. Nie usuwaj historycznych sald i uprawnień bez osobnej zgody; jeśli wymagałoby to destrukcyjnej migracji, wstrzymaj ją i raportuj blocker. Przy braku narzędzia/urządzenia test docelowy to `NOT RUN`, a nie sukces emulatora. Jeśli zakres dotyka dev panelu, release builda lub SDK, obowiązuje też `RELEASE_DEBUG_GUARD.md`; nie używaj builda dev jako dowodu o produkcji.

**Zasady pracy (obowiązkowe):** Pracuj na AKTUALNYM repozytorium, nie zgaduj nazw plików, klas, pól ani funkcji. Przeczytaj `CLAUDE.md`, `PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, `SAVE_MIGRATION_CONTRACT.md`, `WORKFLOW.md` i `QUALITY_GATES.md` z `.claude/vertical-hole/`. Przed zmianą sprawdź `VH_PREFLIGHT_REPORT.md` (revision i dowody) i adekwatne testy; `GO_CORE` wymaga PASS dla energii, izolacji, pętli i bezpiecznej migracji zapisów. Jeśli CORE=FAIL/NOT RUN, **STOP dla niepowiązanych nowych funkcji** (naprawy blockerów wolno wykonywać). Brak panelu `GO_TOOLS` nie blokuje niezależnych napraw FTUE/gameplay, lecz ogranicza testy wymagające panelu i wydanie. Nie uznawaj `NOT RUN` za PASS. Zastosuj skille wskazane powyżej (lub ich checklisty, jeśli Claude Code nie może ich automatycznie wywołać). Gdy zdiagnozowano rzeczywisty błąd i zmiana jest bezpieczna, wdrażaj kod, nie kończ na analizie; zachowaj istniejące zapisy i nie modyfikuj niepowiązanych systemów. Nie przywracaj energii ograniczającej grę ani zależności postępu, nagród, boostów i walut kampanii od parametrów areny. Zachowaj jej niezależny start i replay. Przy braku danych oznacz hipotezy; nie wymyślaj wyników pomiarów. Po zmianach uruchom testy konkretnego zadania i regresyjne P00/kontraktu dotknięte diffem; pokaż przyczynę, zmienione pliki, konkretne polecenia/testy/urządzenia, dowody działania, PASS/FAIL/NOT RUN, ryzyka i ograniczenia. Nie publikuj bez mojej zgody. **Zajmij się wyłącznie tym zadaniem.**

---

## P07.md

/vh-arena-gameplay Zrealizuj tylko zadanie opisane poniżej w aktualnym repo Vertical Hole; sprawdź bramkę P00 i wymagane skille pomocnicze.

ZADANIE P07 — Arena — wielkość rywali a ranking.

**Skill główny:** `vh-arena-gameplay`  
**Skille pomocnicze:** `vh-game-engineer`, `vh-qa-automation`, `vh-ux-gamefeel`

Użyj jako głównej kompetencji `vh-arena-gameplay`; w razie potrzeby współpracuj z vh-game-engineer, vh-qa-automation, vh-ux-gamefeel.

Na arenie widoczne są dziury większe od mojej, choć mam najwyższy wynik. Sprawdź, czy to błąd, czy nieczytelna zasada systemu punktacji.

Zidentyfikuj źródła danych dla promienia/tieru dziur, punktów, tempa rozwoju botów i kolejności w rankingu. Zbadaj, czy boty otrzymują rozmiar bez odpowiadających mu zdobyczy, czy score i rozmiar mają różne, legalne reguły, czy ranking się opóźnia. Napraw rzeczywistą niespójność, nie przyjmując automatycznie, że „największa dziura = najwyższy wynik”, jeśli aktualny design przewiduje inną zasadę. Jeśli mechaniki są niezależne, uczyń je zrozumiałymi w UI, bez dokładania zbędnych wskaźników.

**Akceptacja:** symulacje wielu botów, zmian tieru, wyprzedzania i końca rundy potwierdzają prawidłową kolejność; ranking i prezentacja rywali są spójne; opisz jednoznacznie regułę zwycięstwa.

**Bezpieczeństwo wersji v1.3:** W aktualnym repo najpierw przeczytaj `.claude/vertical-hole/CHANGE_SAFETY.md` i `EVIDENCE_FRESHNESS.md`. Poprzedni `GO_CORE` oparty tylko o `git HEAD` jest niewystarczający przy niezatwierdzonych zmianach: wymagana zgodność `source_snapshot_sha256` z obecnym kodem i testami wykonanymi po ostatnim patchu. Brak aktualnego dowodu = `NOT RUN`, nigdy domyślny PASS. Wprowadzaj jedną odwracalną zmianę w tym zadaniu, nie ruszaj obcych lokalnych edycji. Nie usuwaj historycznych sald i uprawnień bez osobnej zgody; jeśli wymagałoby to destrukcyjnej migracji, wstrzymaj ją i raportuj blocker. Przy braku narzędzia/urządzenia test docelowy to `NOT RUN`, a nie sukces emulatora. Jeśli zakres dotyka dev panelu, release builda lub SDK, obowiązuje też `RELEASE_DEBUG_GUARD.md`; nie używaj builda dev jako dowodu o produkcji.

**Zasady pracy (obowiązkowe):** Pracuj na AKTUALNYM repozytorium, nie zgaduj nazw plików, klas, pól ani funkcji. Przeczytaj `CLAUDE.md`, `PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, `SAVE_MIGRATION_CONTRACT.md`, `WORKFLOW.md` i `QUALITY_GATES.md` z `.claude/vertical-hole/`. Przed zmianą sprawdź `VH_PREFLIGHT_REPORT.md` (revision i dowody) i adekwatne testy; `GO_CORE` wymaga PASS dla energii, izolacji, pętli i bezpiecznej migracji zapisów. Jeśli CORE=FAIL/NOT RUN, **STOP dla niepowiązanych nowych funkcji** (naprawy blockerów wolno wykonywać). Brak panelu `GO_TOOLS` nie blokuje niezależnych napraw FTUE/gameplay, lecz ogranicza testy wymagające panelu i wydanie. Nie uznawaj `NOT RUN` za PASS. Zastosuj skille wskazane powyżej (lub ich checklisty, jeśli Claude Code nie może ich automatycznie wywołać). Gdy zdiagnozowano rzeczywisty błąd i zmiana jest bezpieczna, wdrażaj kod, nie kończ na analizie; zachowaj istniejące zapisy i nie modyfikuj niepowiązanych systemów. Nie przywracaj energii ograniczającej grę ani zależności postępu, nagród, boostów i walut kampanii od parametrów areny. Zachowaj jej niezależny start i replay. Przy braku danych oznacz hipotezy; nie wymyślaj wyników pomiarów. Po zmianach uruchom testy konkretnego zadania i regresyjne P00/kontraktu dotknięte diffem; pokaż przyczynę, zmienione pliki, konkretne polecenia/testy/urządzenia, dowody działania, PASS/FAIL/NOT RUN, ryzyka i ograniczenia. Nie publikuj bez mojej zgody. **Zajmij się wyłącznie tym zadaniem.**

---

## P08.md

/vh-ux-gamefeel Zrealizuj tylko zadanie opisane poniżej w aktualnym repo Vertical Hole; sprawdź bramkę P00 i wymagane skille pomocnicze.

ZADANIE P08 — Ekran nagrody — jasna decyzja.

**Skill główny:** `vh-ux-gamefeel`  
**Skille pomocnicze:** `vh-narrative-localization`, `vh-game-engineer`, `vh-monetization`

Użyj jako głównej kompetencji `vh-ux-gamefeel`; w razie potrzeby współpracuj z vh-narrative-localization, vh-game-engineer, vh-monetization.

Zbadaj istniejący ekran nagrody i przycisk „Później”. Teraz nie wiadomo, co przyznano graczowi, czy nagroda została odebrana, co odkłada „Później” oraz gdzie wraca gracz.

Odtwórz wszystkie ścieżki: nagroda automatyczna, odbiór ręczny, reklama za dodatkową nagrodę (jeśli istnieje), przerwanie, brak sieci/SDK, ponowne wejście. Zaprojektuj prosty ekran z jednoznaczną nazwą i korzyścią nagrody, stanem „zdobyte/odebrane”, jednym głównym CTA (np. „Następna arena”, zależnie od kontekstu) i czytelnym, uczciwym działaniem przycisku pobocznego albo usuń „Później”, jeśli jest niepotrzebne. Nie uzależniaj zwykłej nagrody od reklamy. Nie zmieniaj systemu przyznawania nagród poza koniecznymi poprawkami spójności.

**Reklamy i przejścia:** podstawowa nagroda jest niepowiązana z reklamą. Na CrazyGames nie łącz jednocześnie rewarded za kontynuację i midgame pomiędzy tymi samymi dwiema rundami; na Poki `commercialBreak` dopiero przy świadomym powrocie do rozgrywki. Ustal intencję kliknięcia „Następna arena” i zabezpiecz ją przed opóźnionym callbackiem reklamy. Sprawdź `PLATFORM_RULES.md` i aktualne SDK przed implementacją.

**Akceptacja:** wszystkie przyciski mają jawny skutek, gracz nie traci nagród i nie odbiera ich dwa razy, ekran mieści się na telefonie, ścieżka do następnej areny jest wyraźna. Przetestuj warianty z reklamą i bez.

**Bezpieczeństwo wersji v1.3:** W aktualnym repo najpierw przeczytaj `.claude/vertical-hole/CHANGE_SAFETY.md` i `EVIDENCE_FRESHNESS.md`. Poprzedni `GO_CORE` oparty tylko o `git HEAD` jest niewystarczający przy niezatwierdzonych zmianach: wymagana zgodność `source_snapshot_sha256` z obecnym kodem i testami wykonanymi po ostatnim patchu. Brak aktualnego dowodu = `NOT RUN`, nigdy domyślny PASS. Wprowadzaj jedną odwracalną zmianę w tym zadaniu, nie ruszaj obcych lokalnych edycji. Nie usuwaj historycznych sald i uprawnień bez osobnej zgody; jeśli wymagałoby to destrukcyjnej migracji, wstrzymaj ją i raportuj blocker. Przy braku narzędzia/urządzenia test docelowy to `NOT RUN`, a nie sukces emulatora. Jeśli zakres dotyka dev panelu, release builda lub SDK, obowiązuje też `RELEASE_DEBUG_GUARD.md`; nie używaj builda dev jako dowodu o produkcji.

**Zasady pracy (obowiązkowe):** Pracuj na AKTUALNYM repozytorium, nie zgaduj nazw plików, klas, pól ani funkcji. Przeczytaj `CLAUDE.md`, `PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, `SAVE_MIGRATION_CONTRACT.md`, `WORKFLOW.md` i `QUALITY_GATES.md` z `.claude/vertical-hole/`. Przed zmianą sprawdź `VH_PREFLIGHT_REPORT.md` (revision i dowody) i adekwatne testy; `GO_CORE` wymaga PASS dla energii, izolacji, pętli i bezpiecznej migracji zapisów. Jeśli CORE=FAIL/NOT RUN, **STOP dla niepowiązanych nowych funkcji** (naprawy blockerów wolno wykonywać). Brak panelu `GO_TOOLS` nie blokuje niezależnych napraw FTUE/gameplay, lecz ogranicza testy wymagające panelu i wydanie. Nie uznawaj `NOT RUN` za PASS. Zastosuj skille wskazane powyżej (lub ich checklisty, jeśli Claude Code nie może ich automatycznie wywołać). Gdy zdiagnozowano rzeczywisty błąd i zmiana jest bezpieczna, wdrażaj kod, nie kończ na analizie; zachowaj istniejące zapisy i nie modyfikuj niepowiązanych systemów. Nie przywracaj energii ograniczającej grę ani zależności postępu, nagród, boostów i walut kampanii od parametrów areny. Zachowaj jej niezależny start i replay. Przy braku danych oznacz hipotezy; nie wymyślaj wyników pomiarów. Po zmianach uruchom testy konkretnego zadania i regresyjne P00/kontraktu dotknięte diffem; pokaż przyczynę, zmienione pliki, konkretne polecenia/testy/urządzenia, dowody działania, PASS/FAIL/NOT RUN, ryzyka i ograniczenia. Nie publikuj bez mojej zgody. **Zajmij się wyłącznie tym zadaniem.**

---

## P06A.md

/vh-mission-content Zrealizuj tylko zadanie opisane poniżej w aktualnym repo Vertical Hole; sprawdź bramkę P00 i wymagane skille pomocnicze.

ZADANIE P06A — M32 — ikona witryny.

**Skill główny:** `vh-mission-content`  
**Skille pomocnicze:** `vh-vector-art`, `vh-qa-automation`

Użyj jako głównej kompetencji `vh-mission-content`; w razie potrzeby współpracuj z vh-vector-art, vh-qa-automation.

Znajdź misję M32 i konkretny cel „pochłoń 4 witryny”. W interfejsie obok celu pojawia się ikona flagi zamiast witryny.

Zdiagnozuj przepływ: identyfikator obiektu → definicja celu → mapa ikony → renderer. Ustal przyczynę źródłową (np. złe mapowanie, fallback, pomylenie identyfikatorów) zamiast ręcznie podmieniać ikonkę tylko w jednym ekranie. Napraw ją z zachowaniem prawidłowych SVG i zgodności innych użyć flagi. Dodaj test automatyczny, który sprawdza M32 oraz wykrywa brakujące lub błędne ikony dla podobnych celów, o ile dane na to pozwalają.

**Akceptacja:** M32 wyświetla ikonę witryny odpowiadającą pochłanianemu obiektowi, flaga zachowuje prawidłowe zastosowania, a regresja nie pokazuje nowych błędów.

**Bezpieczeństwo wersji v1.3:** W aktualnym repo najpierw przeczytaj `.claude/vertical-hole/CHANGE_SAFETY.md` i `EVIDENCE_FRESHNESS.md`. Poprzedni `GO_CORE` oparty tylko o `git HEAD` jest niewystarczający przy niezatwierdzonych zmianach: wymagana zgodność `source_snapshot_sha256` z obecnym kodem i testami wykonanymi po ostatnim patchu. Brak aktualnego dowodu = `NOT RUN`, nigdy domyślny PASS. Wprowadzaj jedną odwracalną zmianę w tym zadaniu, nie ruszaj obcych lokalnych edycji. Nie usuwaj historycznych sald i uprawnień bez osobnej zgody; jeśli wymagałoby to destrukcyjnej migracji, wstrzymaj ją i raportuj blocker. Przy braku narzędzia/urządzenia test docelowy to `NOT RUN`, a nie sukces emulatora. Jeśli zakres dotyka dev panelu, release builda lub SDK, obowiązuje też `RELEASE_DEBUG_GUARD.md`; nie używaj builda dev jako dowodu o produkcji.

**Zasady pracy (obowiązkowe):** Pracuj na AKTUALNYM repozytorium, nie zgaduj nazw plików, klas, pól ani funkcji. Przeczytaj `CLAUDE.md`, `PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, `SAVE_MIGRATION_CONTRACT.md`, `WORKFLOW.md` i `QUALITY_GATES.md` z `.claude/vertical-hole/`. Przed zmianą sprawdź `VH_PREFLIGHT_REPORT.md` (revision i dowody) i adekwatne testy; `GO_CORE` wymaga PASS dla energii, izolacji, pętli i bezpiecznej migracji zapisów. Jeśli CORE=FAIL/NOT RUN, **STOP dla niepowiązanych nowych funkcji** (naprawy blockerów wolno wykonywać). Brak panelu `GO_TOOLS` nie blokuje niezależnych napraw FTUE/gameplay, lecz ogranicza testy wymagające panelu i wydanie. Nie uznawaj `NOT RUN` za PASS. Zastosuj skille wskazane powyżej (lub ich checklisty, jeśli Claude Code nie może ich automatycznie wywołać). Gdy zdiagnozowano rzeczywisty błąd i zmiana jest bezpieczna, wdrażaj kod, nie kończ na analizie; zachowaj istniejące zapisy i nie modyfikuj niepowiązanych systemów. Nie przywracaj energii ograniczającej grę ani zależności postępu, nagród, boostów i walut kampanii od parametrów areny. Zachowaj jej niezależny start i replay. Przy braku danych oznacz hipotezy; nie wymyślaj wyników pomiarów. Po zmianach uruchom testy konkretnego zadania i regresyjne P00/kontraktu dotknięte diffem; pokaż przyczynę, zmienione pliki, konkretne polecenia/testy/urządzenia, dowody działania, PASS/FAIL/NOT RUN, ryzyka i ograniczenia. Nie publikuj bez mojej zgody. **Zajmij się wyłącznie tym zadaniem.**

---

## P09.md

/vh-mission-content Zrealizuj tylko zadanie opisane poniżej w aktualnym repo Vertical Hole; sprawdź bramkę P00 i wymagane skille pomocnicze.

ZADANIE P09 — Ikony w oknie celów misji.

**Skill główny:** `vh-mission-content`  
**Skille pomocnicze:** `vh-vector-art`, `vh-qa-automation`

Użyj jako głównej kompetencji `vh-mission-content`; w razie potrzeby współpracuj z vh-vector-art, vh-qa-automation.

Przeprowadź systemowy audyt ikon w okienku celów rozgrywki: ikony często nie odpowiadają obiektom, które gracz rzeczywiście pochłania.

Zidentyfikuj dane celu, faktyczne typy obiektów spawnujących się w misji, mapowanie identyfikatorów na assety i element UI. Ustanów pojedyncze, jawne źródło mapowania typ obiektu → ikona celu, obsługując tylko uzasadnione warianty wyglądu. Sprawdź misje i typy generowane dynamicznie. Nie maskuj pomyłek ogólną flagą lub ikonką domyślną; walidator ma raportować brak mapowania i lokalizację błędu.

**Akceptacja:** zestawienie misja → obiekt → oczekiwana ikona → użyta ikona; poprawione błędy; automatyczny test kompletności mapowań i próba UI w kilku różnych misjach, w tym M32.

**Bezpieczeństwo wersji v1.3:** W aktualnym repo najpierw przeczytaj `.claude/vertical-hole/CHANGE_SAFETY.md` i `EVIDENCE_FRESHNESS.md`. Poprzedni `GO_CORE` oparty tylko o `git HEAD` jest niewystarczający przy niezatwierdzonych zmianach: wymagana zgodność `source_snapshot_sha256` z obecnym kodem i testami wykonanymi po ostatnim patchu. Brak aktualnego dowodu = `NOT RUN`, nigdy domyślny PASS. Wprowadzaj jedną odwracalną zmianę w tym zadaniu, nie ruszaj obcych lokalnych edycji. Nie usuwaj historycznych sald i uprawnień bez osobnej zgody; jeśli wymagałoby to destrukcyjnej migracji, wstrzymaj ją i raportuj blocker. Przy braku narzędzia/urządzenia test docelowy to `NOT RUN`, a nie sukces emulatora. Jeśli zakres dotyka dev panelu, release builda lub SDK, obowiązuje też `RELEASE_DEBUG_GUARD.md`; nie używaj builda dev jako dowodu o produkcji.

**Zasady pracy (obowiązkowe):** Pracuj na AKTUALNYM repozytorium, nie zgaduj nazw plików, klas, pól ani funkcji. Przeczytaj `CLAUDE.md`, `PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, `SAVE_MIGRATION_CONTRACT.md`, `WORKFLOW.md` i `QUALITY_GATES.md` z `.claude/vertical-hole/`. Przed zmianą sprawdź `VH_PREFLIGHT_REPORT.md` (revision i dowody) i adekwatne testy; `GO_CORE` wymaga PASS dla energii, izolacji, pętli i bezpiecznej migracji zapisów. Jeśli CORE=FAIL/NOT RUN, **STOP dla niepowiązanych nowych funkcji** (naprawy blockerów wolno wykonywać). Brak panelu `GO_TOOLS` nie blokuje niezależnych napraw FTUE/gameplay, lecz ogranicza testy wymagające panelu i wydanie. Nie uznawaj `NOT RUN` za PASS. Zastosuj skille wskazane powyżej (lub ich checklisty, jeśli Claude Code nie może ich automatycznie wywołać). Gdy zdiagnozowano rzeczywisty błąd i zmiana jest bezpieczna, wdrażaj kod, nie kończ na analizie; zachowaj istniejące zapisy i nie modyfikuj niepowiązanych systemów. Nie przywracaj energii ograniczającej grę ani zależności postępu, nagród, boostów i walut kampanii od parametrów areny. Zachowaj jej niezależny start i replay. Przy braku danych oznacz hipotezy; nie wymyślaj wyników pomiarów. Po zmianach uruchom testy konkretnego zadania i regresyjne P00/kontraktu dotknięte diffem; pokaż przyczynę, zmienione pliki, konkretne polecenia/testy/urządzenia, dowody działania, PASS/FAIL/NOT RUN, ryzyka i ograniczenia. Nie publikuj bez mojej zgody. **Zajmij się wyłącznie tym zadaniem.**

---

## P10.md

/vh-mission-content Zrealizuj tylko zadanie opisane poniżej w aktualnym repo Vertical Hole; sprawdź bramkę P00 i wymagane skille pomocnicze.

ZADANIE P10 — Jednolite nazwy obiektów i misji.

**Skill główny:** `vh-mission-content`  
**Skille pomocnicze:** `vh-narrative-localization`, `vh-qa-automation`

Użyj jako głównej kompetencji `vh-mission-content`; w razie potrzeby współpracuj z vh-narrative-localization, vh-qa-automation.

Zlikwiduj niespójności pomiędzy tekstami celów, nazwami obiektów w świecie gry, nagrodami, opisami misji i pozostałymi oknami (np. „pochłoń wieżowce”, gdy w misji są maszty).

Nie poprawiaj wyłącznie widocznego przykładu. Wyprowadź kanoniczne nazwy z faktycznych typów obiektów i przygotuj źródło prawdy dla nazwy, odmiany/liczby mnogiej oraz lokalizacji (jeśli istnieją). Sprawdź teksty statyczne i generowane, nazwę w podsumowaniu, HUD i kartach misji. Zachowaj rozróżnienie różnych obiektów: nie przemianowuj masztu na wieżowiec tylko dla zgodności UI. Użyj automatycznego skanera spójności dla całego dostępnego katalogu misji.

**Akceptacja:** cel i spawnowane obiekty nazywają tę samą rzecz; polskie teksty są naturalne; nie ma obcych fallbacków; testy wychwytują brak nazwy, pomyloną kategorię i niespójność liczby.

**Bezpieczeństwo wersji v1.3:** W aktualnym repo najpierw przeczytaj `.claude/vertical-hole/CHANGE_SAFETY.md` i `EVIDENCE_FRESHNESS.md`. Poprzedni `GO_CORE` oparty tylko o `git HEAD` jest niewystarczający przy niezatwierdzonych zmianach: wymagana zgodność `source_snapshot_sha256` z obecnym kodem i testami wykonanymi po ostatnim patchu. Brak aktualnego dowodu = `NOT RUN`, nigdy domyślny PASS. Wprowadzaj jedną odwracalną zmianę w tym zadaniu, nie ruszaj obcych lokalnych edycji. Nie usuwaj historycznych sald i uprawnień bez osobnej zgody; jeśli wymagałoby to destrukcyjnej migracji, wstrzymaj ją i raportuj blocker. Przy braku narzędzia/urządzenia test docelowy to `NOT RUN`, a nie sukces emulatora. Jeśli zakres dotyka dev panelu, release builda lub SDK, obowiązuje też `RELEASE_DEBUG_GUARD.md`; nie używaj builda dev jako dowodu o produkcji.

**Zasady pracy (obowiązkowe):** Pracuj na AKTUALNYM repozytorium, nie zgaduj nazw plików, klas, pól ani funkcji. Przeczytaj `CLAUDE.md`, `PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, `SAVE_MIGRATION_CONTRACT.md`, `WORKFLOW.md` i `QUALITY_GATES.md` z `.claude/vertical-hole/`. Przed zmianą sprawdź `VH_PREFLIGHT_REPORT.md` (revision i dowody) i adekwatne testy; `GO_CORE` wymaga PASS dla energii, izolacji, pętli i bezpiecznej migracji zapisów. Jeśli CORE=FAIL/NOT RUN, **STOP dla niepowiązanych nowych funkcji** (naprawy blockerów wolno wykonywać). Brak panelu `GO_TOOLS` nie blokuje niezależnych napraw FTUE/gameplay, lecz ogranicza testy wymagające panelu i wydanie. Nie uznawaj `NOT RUN` za PASS. Zastosuj skille wskazane powyżej (lub ich checklisty, jeśli Claude Code nie może ich automatycznie wywołać). Gdy zdiagnozowano rzeczywisty błąd i zmiana jest bezpieczna, wdrażaj kod, nie kończ na analizie; zachowaj istniejące zapisy i nie modyfikuj niepowiązanych systemów. Nie przywracaj energii ograniczającej grę ani zależności postępu, nagród, boostów i walut kampanii od parametrów areny. Zachowaj jej niezależny start i replay. Przy braku danych oznacz hipotezy; nie wymyślaj wyników pomiarów. Po zmianach uruchom testy konkretnego zadania i regresyjne P00/kontraktu dotknięte diffem; pokaż przyczynę, zmienione pliki, konkretne polecenia/testy/urządzenia, dowody działania, PASS/FAIL/NOT RUN, ryzyka i ograniczenia. Nie publikuj bez mojej zgody. **Zajmij się wyłącznie tym zadaniem.**

---

## P11.md

/vh-progression-economy Zrealizuj tylko zadanie opisane poniżej w aktualnym repo Vertical Hole; sprawdź bramkę P00 i wymagane skille pomocnicze.

ZADANIE P11 — Audyt wszystkich kupowanych wzmocnień.

**Skill główny:** `vh-progression-economy`  
**Skille pomocnicze:** `vh-game-engineer`, `vh-qa-automation`

Użyj jako głównej kompetencji `vh-progression-economy`; w razie potrzeby współpracuj z vh-game-engineer, vh-qa-automation.

Wzmocnienie „magnes na całą misję” nie działa. Przeprowadź audyt KAŻDEGO wzmocnienia, które można kupić w obecnej wersji gry.

Utwórz z kodu listę ofert i dla każdej zweryfikuj: opis i cenę, warunki zakupu, potrącenie waluty, aktywację, faktyczny efekt w gameplayu, zakres czasu/trwania, stackowanie, ponowne użycie, koniec misji, restart i zapis. Szczególnie sprawdź magnes przez całą misję: efektywny zasięg, typy pochłanianych obiektów, utratę fokusu/pauzę oraz zakończenie działania dopiero z końcem misji. Napraw źródłową przyczynę, zamiast sztucznie ustawiać status „aktywny”. Jeśli oferta nie ma implementacji, wdrażaj brakujący efekt zgodny z opisem lub usuń niedostępną ofertę z uczciwym uzasadnieniem; nie dodawaj pozornych produktów.

**Izolacja efektów (twarda akceptacja):** dla każdej oferty sporządź `product_id | owner=arena/districts/cosmetic-neutral | activation_scope | expiry_condition | storage_key | test`. Magnes „na całą misję” testuj w *misji dzielnic*, jeśli jest `owner=districts`; nie używaj przykładu `createArenaRun(upgrades=['magnet_full_run'])`. Właściciel nie wynika z nazwy ani wspólnej waluty: mapuj z kodu, przy konflikcie oznacz decyzję i nie rozszerzaj zakresu. BOOST-01: identyczny seed i input areny, parametry/wynik przed i po zakupie/aktywacji kampanijnego magnesu bez zmian. BOOST-02: magnes działa do końca rzeczywistej misji, również przy pauzie/reload wg jej kontraktu, nie „na sztywno 120 s”. BOOST-03: oddzielny zakup arena-only, jeśli faktycznie istnieje, nie wpływa na dzielnice. Zgodność z `TECHNICAL_PATTERNS.md` §4 i `ARENA_DISTRICT_CONTRACT.md`.

**Migracje v1.3:** po ostatnim patchu powtórz testy SAVE/BOOST na finalnym snapshotcie. Dla nieznanego save, naruszenia salda/entitlement, konfliktu wielu kart lub niemożliwego rollback starszego klienta przerwij destrukcyjną operację i podaj plan poprawy; `GO_CORE` nie może opierać się na poprzednim git HEAD.

**Akceptacja:** macierz oferta → zakupy → aktywacja → dowód efektu → koniec efektu, testy automatyczne każdego produktu i brak utraty waluty przy nieudanym zakupie.

**Bloker potwierdzony w audycie źródła 2026-10-17, sprawdź aktualny snapshot:** Monety zdobywane w misjach kampanii mogą zasilić `RUN_TOOLS` Areny przez wspólne `save.coins`; `SKINS.perks` dają premię w Arenie, mimo że są w Warsztacie, a `grantXp` obsługuje oba tryby. Nie uznawaj ich za „neutralną wspólną walutę/kosmetyki” bez testów A/B tego samego seeda i mapowania własności nagród. Przy potwierdzeniu: `CORE-ISOLATION=FAIL`; nie wykonuj nieplanowanej destrukcyjnej separacji w tym zadaniu, przedstaw minimalną zgodną z legacy mapę do akceptacji. SAVE-08/09 przed zmianą schematu.

**Bezpieczeństwo wersji v1.3:** W aktualnym repo najpierw przeczytaj `.claude/vertical-hole/CHANGE_SAFETY.md` i `EVIDENCE_FRESHNESS.md`. Poprzedni `GO_CORE` oparty tylko o `git HEAD` jest niewystarczający przy niezatwierdzonych zmianach: wymagana zgodność `source_snapshot_sha256` z obecnym kodem i testami wykonanymi po ostatnim patchu. Brak aktualnego dowodu = `NOT RUN`, nigdy domyślny PASS. Wprowadzaj jedną odwracalną zmianę w tym zadaniu, nie ruszaj obcych lokalnych edycji. Nie usuwaj historycznych sald i uprawnień bez osobnej zgody; jeśli wymagałoby to destrukcyjnej migracji, wstrzymaj ją i raportuj blocker. Przy braku narzędzia/urządzenia test docelowy to `NOT RUN`, a nie sukces emulatora. Jeśli zakres dotyka dev panelu, release builda lub SDK, obowiązuje też `RELEASE_DEBUG_GUARD.md`; nie używaj builda dev jako dowodu o produkcji.

**Zasady pracy (obowiązkowe):** Pracuj na AKTUALNYM repozytorium, nie zgaduj nazw plików, klas, pól ani funkcji. Przeczytaj `CLAUDE.md`, `PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, `SAVE_MIGRATION_CONTRACT.md`, `WORKFLOW.md` i `QUALITY_GATES.md` z `.claude/vertical-hole/`. Przed zmianą sprawdź `VH_PREFLIGHT_REPORT.md` (revision i dowody) i adekwatne testy; `GO_CORE` wymaga PASS dla energii, izolacji, pętli i bezpiecznej migracji zapisów. Jeśli CORE=FAIL/NOT RUN, **STOP dla niepowiązanych nowych funkcji** (naprawy blockerów wolno wykonywać). Brak panelu `GO_TOOLS` nie blokuje niezależnych napraw FTUE/gameplay, lecz ogranicza testy wymagające panelu i wydanie. Nie uznawaj `NOT RUN` za PASS. Zastosuj skille wskazane powyżej (lub ich checklisty, jeśli Claude Code nie może ich automatycznie wywołać). Gdy zdiagnozowano rzeczywisty błąd i zmiana jest bezpieczna, wdrażaj kod, nie kończ na analizie; zachowaj istniejące zapisy i nie modyfikuj niepowiązanych systemów. Nie przywracaj energii ograniczającej grę ani zależności postępu, nagród, boostów i walut kampanii od parametrów areny. Zachowaj jej niezależny start i replay. Przy braku danych oznacz hipotezy; nie wymyślaj wyników pomiarów. Po zmianach uruchom testy konkretnego zadania i regresyjne P00/kontraktu dotknięte diffem; pokaż przyczynę, zmienione pliki, konkretne polecenia/testy/urządzenia, dowody działania, PASS/FAIL/NOT RUN, ryzyka i ograniczenia. Nie publikuj bez mojej zgody. **Zajmij się wyłącznie tym zadaniem.**

---

## P12.md

/vh-progression-economy Zrealizuj tylko zadanie opisane poniżej w aktualnym repo Vertical Hole; sprawdź bramkę P00 i wymagane skille pomocnicze.

ZADANIE P12 — Nagrody i warsztat — pełny obieg.

**Skill główny:** `vh-progression-economy`  
**Skille pomocnicze:** `vh-game-engineer`, `vh-save-security`, `vh-ux-gamefeel`, `vh-qa-automation`

Użyj jako głównej kompetencji `vh-progression-economy`; w razie potrzeby współpracuj z vh-game-engineer, vh-save-security, vh-ux-gamefeel, vh-qa-automation.

Gracz otrzymuje nagrodę, której później nie ma w warsztacie albo nie da się jej użyć. Napraw cały obieg nagrody i przedmiotu.

Zmapuj wszystkie możliwe źródła nagród (misje, arena, osiągnięcia, skrzynki itp., jeśli występują), definicje przedmiotów, inventory/save, odblokowania, UI warsztatu, equip/upgrade i wpływ na grę. Dla każdego obiecanego przedmiotu potwierdź, że istnieje, jest osiągalny, widoczny w odpowiednim miejscu i działa zgodnie z opisem. Brakujące legalnie obiecane przedmioty zaimplementuj lub skoryguj błędne obietnice, nie ukrywaj utraconych nagród. Wprowadź bezpośrednie przejście z otrzymanej nagrody do jej karty w warsztacie z podświetleniem oraz bezpieczną nawigację wstecz. Zadbaj o migrację starych zapisów i idempotentność odbioru. **Najpierw** odczytaj `SAVE_MIGRATION_CONTRACT.md`, określ historyczne schematy i zbuduj syntetyczne fixture'y z już posiadanym wyposażeniem, dawnym saldem, odebraną i nieodebraną nagrodą. Nie „naprawiaj” braku nagrody przez globalny reset inventory. Testuj także przypadek: przerwanie procesu między claim a save, wielokrotny tap, zapis/odczyt po migracji, ponowne wydanie tej samej nagrody, downgrade/upgrade jeśli realnie wspierany.

**Granice trybów i UX:** najpierw mapa `źródło nagrody → właściciel → zapis → zakres efektu`. Dzielnicowe nagrody i wyposażenie nie zmieniają parametrów areny. CTA „Następna arena” po rundzie musi pozostać głównym działaniem; przejście do warsztatu tylko opcjonalne, nie blokujące replay. Test: otrzymanie/przyznanie/użycie nagrody kampanii + reset/migracja kampanii nie modyfikuje zapisu i balansu areny.

**Migracje v1.3:** po ostatnim patchu powtórz testy SAVE/BOOST na finalnym snapshotcie. Dla nieznanego save, naruszenia salda/entitlement, konfliktu wielu kart lub niemożliwego rollback starszego klienta przerwij destrukcyjną operację i podaj plan poprawy; `GO_CORE` nie może opierać się na poprzednim git HEAD.

**Akceptacja:** automatyczny audyt pełnego katalogu nagród, test całej ścieżki earn → claim → save → workshop → use/equip po restarcie, brak duplikacji i brak utraty starszych zapisów. Uruchom SAVE-01..07 adekwatne do typu zapisu, przedstaw tabelę przed/po: `reward_id`, własność, claim status, inventory, entitlement, saldo, idempotency key, migration version; PASS tylko przy zachowaniu istniejących uprawnień.

**Bloker potwierdzony w audycie źródła 2026-10-17, sprawdź aktualny snapshot:** Monety zdobywane w misjach kampanii mogą zasilić `RUN_TOOLS` Areny przez wspólne `save.coins`; `SKINS.perks` dają premię w Arenie, mimo że są w Warsztacie, a `grantXp` obsługuje oba tryby. Nie uznawaj ich za „neutralną wspólną walutę/kosmetyki” bez testów A/B tego samego seeda i mapowania własności nagród. Przy potwierdzeniu: `CORE-ISOLATION=FAIL`; nie wykonuj nieplanowanej destrukcyjnej separacji w tym zadaniu, przedstaw minimalną zgodną z legacy mapę do akceptacji. SAVE-08/09 przed zmianą schematu.

**Bezpieczeństwo wersji v1.3:** W aktualnym repo najpierw przeczytaj `.claude/vertical-hole/CHANGE_SAFETY.md` i `EVIDENCE_FRESHNESS.md`. Poprzedni `GO_CORE` oparty tylko o `git HEAD` jest niewystarczający przy niezatwierdzonych zmianach: wymagana zgodność `source_snapshot_sha256` z obecnym kodem i testami wykonanymi po ostatnim patchu. Brak aktualnego dowodu = `NOT RUN`, nigdy domyślny PASS. Wprowadzaj jedną odwracalną zmianę w tym zadaniu, nie ruszaj obcych lokalnych edycji. Nie usuwaj historycznych sald i uprawnień bez osobnej zgody; jeśli wymagałoby to destrukcyjnej migracji, wstrzymaj ją i raportuj blocker. Przy braku narzędzia/urządzenia test docelowy to `NOT RUN`, a nie sukces emulatora. Jeśli zakres dotyka dev panelu, release builda lub SDK, obowiązuje też `RELEASE_DEBUG_GUARD.md`; nie używaj builda dev jako dowodu o produkcji.

**Zasady pracy (obowiązkowe):** Pracuj na AKTUALNYM repozytorium, nie zgaduj nazw plików, klas, pól ani funkcji. Przeczytaj `CLAUDE.md`, `PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, `SAVE_MIGRATION_CONTRACT.md`, `WORKFLOW.md` i `QUALITY_GATES.md` z `.claude/vertical-hole/`. Przed zmianą sprawdź `VH_PREFLIGHT_REPORT.md` (revision i dowody) i adekwatne testy; `GO_CORE` wymaga PASS dla energii, izolacji, pętli i bezpiecznej migracji zapisów. Jeśli CORE=FAIL/NOT RUN, **STOP dla niepowiązanych nowych funkcji** (naprawy blockerów wolno wykonywać). Brak panelu `GO_TOOLS` nie blokuje niezależnych napraw FTUE/gameplay, lecz ogranicza testy wymagające panelu i wydanie. Nie uznawaj `NOT RUN` za PASS. Zastosuj skille wskazane powyżej (lub ich checklisty, jeśli Claude Code nie może ich automatycznie wywołać). Gdy zdiagnozowano rzeczywisty błąd i zmiana jest bezpieczna, wdrażaj kod, nie kończ na analizie; zachowaj istniejące zapisy i nie modyfikuj niepowiązanych systemów. Nie przywracaj energii ograniczającej grę ani zależności postępu, nagród, boostów i walut kampanii od parametrów areny. Zachowaj jej niezależny start i replay. Przy braku danych oznacz hipotezy; nie wymyślaj wyników pomiarów. Po zmianach uruchom testy konkretnego zadania i regresyjne P00/kontraktu dotknięte diffem; pokaż przyczynę, zmienione pliki, konkretne polecenia/testy/urządzenia, dowody działania, PASS/FAIL/NOT RUN, ryzyka i ograniczenia. Nie publikuj bez mojej zgody. **Zajmij się wyłącznie tym zadaniem.**

---

## P13.md

/vh-progression-economy Zrealizuj tylko zadanie opisane poniżej w aktualnym repo Vertical Hole; sprawdź bramkę P00 i wymagane skille pomocnicze.

ZADANIE P13 — Zróżnicowanie trudności i misji.

**Skill główny:** `vh-progression-economy`  
**Skille pomocnicze:** `vh-mission-content`, `vh-arena-gameplay`, `vh-qa-automation`, `vh-analytics-experiments`

Użyj jako głównej kompetencji `vh-progression-economy`; w razie potrzeby współpracuj z vh-mission-content, vh-arena-gameplay, vh-qa-automation, vh-analytics-experiments.

Misje w kolejnych dzielnicach są zbyt podobne, część zbyt łatwa, a wzmocnienia mają zbyt mały wpływ na wynik. Raport botów: M11 ma zbyt mało obiektów na pierwszej klatce, a misje EKSTREMALNE przechodzi 61% prób bota „casual” przy zapisanym progu 55%.

Najpierw sprawdź w testach, co dokładnie oznacza próg 55% (minimum czy maksimum), jaka jest liczba prób i definicja sukcesu; nie ogłaszaj błędu przed sprawdzeniem. Zmierz realną trudność, czynniki porażki, rozkład obiektów, czasy, odsetek przejść z i bez boostów oraz stopień podobieństwa kolejnych misji. Napraw start M11 tak, by gracz miał od razu sensowne cele. Zaprojektuj zróżnicowane archetypy wyzwań oraz okresowe trudniejsze misje, ale pozostaw wszystkie poziomy wykonalne bez przymusowego zakupu boostów. Wzmocnienia powinny pomagać w mierzalnym, czytelnym stopniu, nie gwarantować zwycięstwa.

**Akceptacja:** tabela misji/typów z diagnozą i konkretnymi zmianami, porównanie wyników botów przed/po, test seedów i braku softlocków; zaznacz, że wyniki botów nie są dowodem zachowania ludzi.

**Bezpieczeństwo wersji v1.3:** W aktualnym repo najpierw przeczytaj `.claude/vertical-hole/CHANGE_SAFETY.md` i `EVIDENCE_FRESHNESS.md`. Poprzedni `GO_CORE` oparty tylko o `git HEAD` jest niewystarczający przy niezatwierdzonych zmianach: wymagana zgodność `source_snapshot_sha256` z obecnym kodem i testami wykonanymi po ostatnim patchu. Brak aktualnego dowodu = `NOT RUN`, nigdy domyślny PASS. Wprowadzaj jedną odwracalną zmianę w tym zadaniu, nie ruszaj obcych lokalnych edycji. Nie usuwaj historycznych sald i uprawnień bez osobnej zgody; jeśli wymagałoby to destrukcyjnej migracji, wstrzymaj ją i raportuj blocker. Przy braku narzędzia/urządzenia test docelowy to `NOT RUN`, a nie sukces emulatora. Jeśli zakres dotyka dev panelu, release builda lub SDK, obowiązuje też `RELEASE_DEBUG_GUARD.md`; nie używaj builda dev jako dowodu o produkcji.

**Zasady pracy (obowiązkowe):** Pracuj na AKTUALNYM repozytorium, nie zgaduj nazw plików, klas, pól ani funkcji. Przeczytaj `CLAUDE.md`, `PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, `SAVE_MIGRATION_CONTRACT.md`, `WORKFLOW.md` i `QUALITY_GATES.md` z `.claude/vertical-hole/`. Przed zmianą sprawdź `VH_PREFLIGHT_REPORT.md` (revision i dowody) i adekwatne testy; `GO_CORE` wymaga PASS dla energii, izolacji, pętli i bezpiecznej migracji zapisów. Jeśli CORE=FAIL/NOT RUN, **STOP dla niepowiązanych nowych funkcji** (naprawy blockerów wolno wykonywać). Brak panelu `GO_TOOLS` nie blokuje niezależnych napraw FTUE/gameplay, lecz ogranicza testy wymagające panelu i wydanie. Nie uznawaj `NOT RUN` za PASS. Zastosuj skille wskazane powyżej (lub ich checklisty, jeśli Claude Code nie może ich automatycznie wywołać). Gdy zdiagnozowano rzeczywisty błąd i zmiana jest bezpieczna, wdrażaj kod, nie kończ na analizie; zachowaj istniejące zapisy i nie modyfikuj niepowiązanych systemów. Nie przywracaj energii ograniczającej grę ani zależności postępu, nagród, boostów i walut kampanii od parametrów areny. Zachowaj jej niezależny start i replay. Przy braku danych oznacz hipotezy; nie wymyślaj wyników pomiarów. Po zmianach uruchom testy konkretnego zadania i regresyjne P00/kontraktu dotknięte diffem; pokaż przyczynę, zmienione pliki, konkretne polecenia/testy/urządzenia, dowody działania, PASS/FAIL/NOT RUN, ryzyka i ograniczenia. Nie publikuj bez mojej zgody. **Zajmij się wyłącznie tym zadaniem.**

---

## P14E.md

/vh-progression-economy Zrealizuj tylko zadanie opisane poniżej w aktualnym repo Vertical Hole; sprawdź bramkę P00 i wymagane skille pomocnicze.

ZADANIE P14E — Pryzmaty po usunięciu energii.

**Skill główny:** `vh-progression-economy`  
**Skille pomocnicze:** `vh-director`, `vh-monetization`, `vh-ux-gamefeel`

Użyj jako głównej kompetencji `vh-progression-economy`; w razie potrzeby współpracuj z vh-director, vh-monetization, vh-ux-gamefeel.

Po całkowitym usunięciu systemu energii pryzmaty tracą część zastosowań. Uporządkuj ekonomię tej waluty bez tworzenia sztucznego przymusu wydawania.

Zidentyfikuj wszystkie źródła, wydatki, stany, opisy i zapisy pryzmatów; ustal, co po usunięciu energii jest martwe albo niezrozumiałe. Oblicz orientacyjnie aktualne tempo zarabiania i realne możliwości wydania na podstawie danych w repo. Zaproponuj maksymalnie 2–3 sensowne funkcje waluty, priorytetowo kosmetyki, czytelne elementy warsztatu lub dobrowolne ulepszenia bez paywallu. Porównaj z wariantem uproszczenia/usunięcia waluty, wybierz najtańszy sensowny wariant i wdroż go tam, gdzie aktualny projekt pozwala na bezpieczną zmianę. Zachowaj istniejące salda i kompatybilność zapisów. **Nie usuwaj historycznych pryzmatów, sald ani kupionych przedmiotów nawet wtedy, gdy waluta straciła funkcję.** Jeśli wybierzesz wycofanie waluty, przygotuj (przed kodowaniem) scenariusz zachowania prawa do dotychczasowych korzyści, mapę migracji i uczciwą ścieżkę dalszego wykorzystania lub uzgodnionej kompensacji; decyzję wymagającą odebrania wartości przedstaw właścicielce do odrębnej akceptacji. Czytnik starych save może rozpoznawać dawną energię, ale nie uruchamia jej mechaniki. Nie przywracaj odnawialnej energii, wymaganego grindu, presji reklam ani odblokowywania aren przez dzielnice.

**Twarda izolacja:** pryzmaty z kampanii, zakupy warsztatu i ich zmiany nie mogą wpływać na czas rundy, magnes, tier, score, wejście, spawn czy ranking areny. Wspólna waluta jest dozwolona wyłącznie jako jawny neutralny mechanizm kosmetyczny z testem braku przewagi; rozdziel właścicieli transakcji i zapisów. Jeśli istnieje niezgodność, napraw ją zamiast traktować jako „zamierzony balance”.

**Migracje v1.3:** po ostatnim patchu powtórz testy SAVE/BOOST na finalnym snapshotcie. Dla nieznanego save, naruszenia salda/entitlement, konfliktu wielu kart lub niemożliwego rollback starszego klienta przerwij destrukcyjną operację i podaj plan poprawy; `GO_CORE` nie może opierać się na poprzednim git HEAD.

**Akceptacja:** mapa przepływu waluty przed/po, brak osieroconych etykiet i bezużytecznych nagród, testy zdobycia/wydania/zapisu i jasna wartość pryzmatów dla gracza. Zapisz invariants: `old_balance == migrated_balance` przed legalnymi transakcjami; `old_purchases ⊆ migrated_entitlements`; dwukrotna migracja nic nie zmienia. Testy SAVE-01..07, no-storage i restore/reload; tabelaryczny dowód stary i nowy schemat. Nie wybieraj usunięcia waluty przez skasowanie pól bez zatwierdzonej decyzji.

**Bloker potwierdzony w audycie źródła 2026-10-17, sprawdź aktualny snapshot:** Monety zdobywane w misjach kampanii mogą zasilić `RUN_TOOLS` Areny przez wspólne `save.coins`; `SKINS.perks` dają premię w Arenie, mimo że są w Warsztacie, a `grantXp` obsługuje oba tryby. Nie uznawaj ich za „neutralną wspólną walutę/kosmetyki” bez testów A/B tego samego seeda i mapowania własności nagród. Przy potwierdzeniu: `CORE-ISOLATION=FAIL`; nie wykonuj nieplanowanej destrukcyjnej separacji w tym zadaniu, przedstaw minimalną zgodną z legacy mapę do akceptacji. SAVE-08/09 przed zmianą schematu.

**Bezpieczeństwo wersji v1.3:** W aktualnym repo najpierw przeczytaj `.claude/vertical-hole/CHANGE_SAFETY.md` i `EVIDENCE_FRESHNESS.md`. Poprzedni `GO_CORE` oparty tylko o `git HEAD` jest niewystarczający przy niezatwierdzonych zmianach: wymagana zgodność `source_snapshot_sha256` z obecnym kodem i testami wykonanymi po ostatnim patchu. Brak aktualnego dowodu = `NOT RUN`, nigdy domyślny PASS. Wprowadzaj jedną odwracalną zmianę w tym zadaniu, nie ruszaj obcych lokalnych edycji. Nie usuwaj historycznych sald i uprawnień bez osobnej zgody; jeśli wymagałoby to destrukcyjnej migracji, wstrzymaj ją i raportuj blocker. Przy braku narzędzia/urządzenia test docelowy to `NOT RUN`, a nie sukces emulatora. Jeśli zakres dotyka dev panelu, release builda lub SDK, obowiązuje też `RELEASE_DEBUG_GUARD.md`; nie używaj builda dev jako dowodu o produkcji.

**Zasady pracy (obowiązkowe):** Pracuj na AKTUALNYM repozytorium, nie zgaduj nazw plików, klas, pól ani funkcji. Przeczytaj `CLAUDE.md`, `PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, `SAVE_MIGRATION_CONTRACT.md`, `WORKFLOW.md` i `QUALITY_GATES.md` z `.claude/vertical-hole/`. Przed zmianą sprawdź `VH_PREFLIGHT_REPORT.md` (revision i dowody) i adekwatne testy; `GO_CORE` wymaga PASS dla energii, izolacji, pętli i bezpiecznej migracji zapisów. Jeśli CORE=FAIL/NOT RUN, **STOP dla niepowiązanych nowych funkcji** (naprawy blockerów wolno wykonywać). Brak panelu `GO_TOOLS` nie blokuje niezależnych napraw FTUE/gameplay, lecz ogranicza testy wymagające panelu i wydanie. Nie uznawaj `NOT RUN` za PASS. Zastosuj skille wskazane powyżej (lub ich checklisty, jeśli Claude Code nie może ich automatycznie wywołać). Gdy zdiagnozowano rzeczywisty błąd i zmiana jest bezpieczna, wdrażaj kod, nie kończ na analizie; zachowaj istniejące zapisy i nie modyfikuj niepowiązanych systemów. Nie przywracaj energii ograniczającej grę ani zależności postępu, nagród, boostów i walut kampanii od parametrów areny. Zachowaj jej niezależny start i replay. Przy braku danych oznacz hipotezy; nie wymyślaj wyników pomiarów. Po zmianach uruchom testy konkretnego zadania i regresyjne P00/kontraktu dotknięte diffem; pokaż przyczynę, zmienione pliki, konkretne polecenia/testy/urządzenia, dowody działania, PASS/FAIL/NOT RUN, ryzyka i ograniczenia. Nie publikuj bez mojej zgody. **Zajmij się wyłącznie tym zadaniem.**

---

## P14C.md

/vh-monetization Zrealizuj tylko zadanie opisane poniżej w aktualnym repo Vertical Hole; sprawdź bramkę P00 i wymagane skille pomocnicze.

ZADANIE P14C — Przywracanie zakupów.

**Skill główny:** `vh-monetization`  
**Skille pomocnicze:** `vh-portal-integrations`, `vh-save-security`, `vh-legal-risk`

Użyj jako głównej kompetencji `vh-monetization`; w razie potrzeby współpracuj z vh-portal-integrations, vh-save-security, vh-legal-risk.

Zbadaj zgłoszony brak przycisku „Przywróć zakupy”, ale najpierw ustal, czy obecna wersja Vertical Hole ma jakiekolwiek prawdziwe zakupy za pieniądze, których uprawnienia wymagają odtworzenia, i na jakich platformach.

Sprawdź rzeczywistą integrację zakupową i aktualny kontrakt SDK, nie myl zakupu za walutę w grze z IAP. Na Poki nie projektuj IAP; na innych portalach sprawdź dostępne uprawnienia. Jeśli przywracanie ma zastosowanie, wdroż widoczny, zrozumiały przycisk w właściwych ustawieniach/sklepie, idempotentne pobranie i walidację uprawnień, stan ładowania/sukcesu/błędu, oraz ochronę przed podwójnym przyznaniem. Jeśli IAP nie istnieją, nie dodawaj martwego przycisku; udokumentuj „nie dotyczy” i wskaż właściwą strategię odzyskania postępu, jeśli jest potrzebna.

**Kontrakt portalu:** Poki bez IAP; CrazyGames IAP wyłącznie po potwierdzeniu rzeczywistych uprawnień/SDK, nie domniemuj. Brak IAP → oznacz NOT APPLICABLE, nie implementuj pustego „Przywróć zakupy”; kontroluj idempotentność i przepływ prawdziwych uprawnień.

**Akceptacja:** macierz platforma → typ transakcji → czy restore wymagane → wynik; testy mock SDK i błędów sieci dla rzeczywiście obsługiwanych zakupów, bez fałszywego sukcesu.

**Bezpieczeństwo wersji v1.3:** W aktualnym repo najpierw przeczytaj `.claude/vertical-hole/CHANGE_SAFETY.md` i `EVIDENCE_FRESHNESS.md`. Poprzedni `GO_CORE` oparty tylko o `git HEAD` jest niewystarczający przy niezatwierdzonych zmianach: wymagana zgodność `source_snapshot_sha256` z obecnym kodem i testami wykonanymi po ostatnim patchu. Brak aktualnego dowodu = `NOT RUN`, nigdy domyślny PASS. Wprowadzaj jedną odwracalną zmianę w tym zadaniu, nie ruszaj obcych lokalnych edycji. Nie usuwaj historycznych sald i uprawnień bez osobnej zgody; jeśli wymagałoby to destrukcyjnej migracji, wstrzymaj ją i raportuj blocker. Przy braku narzędzia/urządzenia test docelowy to `NOT RUN`, a nie sukces emulatora. Jeśli zakres dotyka dev panelu, release builda lub SDK, obowiązuje też `RELEASE_DEBUG_GUARD.md`; nie używaj builda dev jako dowodu o produkcji.

**Zasady pracy (obowiązkowe):** Pracuj na AKTUALNYM repozytorium, nie zgaduj nazw plików, klas, pól ani funkcji. Przeczytaj `CLAUDE.md`, `PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, `SAVE_MIGRATION_CONTRACT.md`, `WORKFLOW.md` i `QUALITY_GATES.md` z `.claude/vertical-hole/`. Przed zmianą sprawdź `VH_PREFLIGHT_REPORT.md` (revision i dowody) i adekwatne testy; `GO_CORE` wymaga PASS dla energii, izolacji, pętli i bezpiecznej migracji zapisów. Jeśli CORE=FAIL/NOT RUN, **STOP dla niepowiązanych nowych funkcji** (naprawy blockerów wolno wykonywać). Brak panelu `GO_TOOLS` nie blokuje niezależnych napraw FTUE/gameplay, lecz ogranicza testy wymagające panelu i wydanie. Nie uznawaj `NOT RUN` za PASS. Zastosuj skille wskazane powyżej (lub ich checklisty, jeśli Claude Code nie może ich automatycznie wywołać). Gdy zdiagnozowano rzeczywisty błąd i zmiana jest bezpieczna, wdrażaj kod, nie kończ na analizie; zachowaj istniejące zapisy i nie modyfikuj niepowiązanych systemów. Nie przywracaj energii ograniczającej grę ani zależności postępu, nagród, boostów i walut kampanii od parametrów areny. Zachowaj jej niezależny start i replay. Przy braku danych oznacz hipotezy; nie wymyślaj wyników pomiarów. Po zmianach uruchom testy konkretnego zadania i regresyjne P00/kontraktu dotknięte diffem; pokaż przyczynę, zmienione pliki, konkretne polecenia/testy/urządzenia, dowody działania, PASS/FAIL/NOT RUN, ryzyka i ograniczenia. Nie publikuj bez mojej zgody. **Zajmij się wyłącznie tym zadaniem.**

---

## PX01-SAVE.md

/vh-save-security W aktualnym repo Vertical Hole wykonaj WYŁĄCZNIE naprawę VH-03 — bezpieczne odczyty i migracje zapisów, pod warunkiem potwierdzenia przez P00. Nie wykonuj kolejnych promptów w tej sesji.

# PX01 — Ochrona zapisów przed przypadkowym nadpisaniem (VH-03, P1 CORE)
**Skille pomocnicze:** `vh-game-engineer`, `vh-progression-economy`, `vh-qa-automation`.

1. Przeczytaj aktualny `VH_PREFLIGHT_REPORT.md` z P00, `CLAUDE.md`, `.claude/vertical-hole/{SAVE_MIGRATION_CONTRACT,CHANGE_SAFETY,EVIDENCE_FRESHNESS,PREFLIGHT_GATES}.md`; sprawdź `git status --short`, snapshot, `loadSave()`, `saveGame()`, localStorage, obecne wersje schematów. **Najpierw zweryfikuj VH-03 na aktualnym kodzie; jeśli nie ma błędu → PASS/NO CHANGE, nie refaktoruj na zapas.** Jeśli dowodu nie ma → `NOT RUN` i diagnostyka, nie pozorny PASS.
2. Zanim zmienisz kod, przygotuj odseparowane fixture'y zapisów: prawidłowy bieżący; dawne wspierane; brak danych; uszkodzony JSON; błędny kształt; wersja przyszła/nieobsługiwana; częściowo zmigrowany; zapis z historycznymi monetami, XP, nagrodami, unlockami, zakupami i pryzmatami. Testy na kopii, **bez czyszczenia realnych zapisów użytkowników**, bez używania prywatnych danych.
3. Jeśli zidentyfikowano zagrożenie: zrób najmniejszą odwracalną zmianę w odczycie/migracji. Dla nieznanego/future/malformed schematu: nie zapisuj defaultów na oryginalnym kluczu ani nie usuwaj wejścia. Oddziel walidację od commit; utrzymuj oryginalne bajty do bezpiecznej migracji, plan przywrócenia i atomowość na tyle, na ile pozwala storage. Nowy zapis może być wykonany dopiero po potwierdzonym, prawidłowym upgrade; operacja ma być idempotentna i chronić uprawnienia oraz salda. Dla nieobsługiwanego zapisu czytelny stan błędu, nie automatyczny reset.
4. Weryfikacja SAVE-01..09, szczególnie SAVE-08 (future schema nie ulega nadpisaniu) i SAVE-09 (malformed/schema mismatch nie ulega nadpisaniu), ponowny odczyt po migracji, kilkukrotny reload oraz scenariusz błędu/zamknięcia między odczytem a zapisem. Sprawdź zachowanie istniejących własności Areny/Dzielnic; nie wprowadzaj nowej ekonomii ani energii.
5. Zapisz dokładny diff, wyniki `PASS/FAIL/NOT RUN`, fixture'y i logi w `.claude/vertical-hole/evidence/`, fingerprint finalnych źródeł zgodnie z EVIDENCE_FRESHNESS. Jeśli poprawka wymaga destrukcyjnego resetu/downgrade → **STOP i propozycja decyzji właścicielki**, nie realizuj go.

**Kryterium zamknięcia:** `CORE-SAVE=PASS` tylko na finalnym snapshotcie przy udokumentowanych testach zapisu i braku utraty danych. **Nie publikuj, nie pushuj, nie przerabiaj niezwiązanych systemów.** Po zmianie ponów adekwatną część P00.

**Raport końcowy (obowiązkowy):** podaj dla każdego testu `PASS/FAIL/NOT RUN` z dowodem lub brakiem dowodu, zaktualizowane pliki, polecenia, ewentualny rollback oraz stan odpowiedniej bramki. Jeśli coś nadal jest `FAIL` albo `NOT RUN`, nie deklaruj ukończenia. **Nie publikuj ani nie pushuj bez zgody właścicielki.**

**Bezpieczny fail-closed w całej ścieżce startowej:**
Testuj nie tylko `loadSave`, ale wszystkie późniejsze automatyczne `saveGame`, onboarding, reward, profile, autosave i reinitializację po błędzie. Przy nieznanej wersji albo zniekształconym zapisie żaden z tych kroków nie może cicho nadpisać surowych bajtów na oryginalnym kluczu. Sprawdź dwa równoległe okna, konflikty local/cloud (jeśli występują) i rollback starego klienta. `CORE-SAVE=PASS` tylko po takich testach, bez przyjmowania samej poprawki `loadSave()` za rozwiązanie.

---

## PX02-ISOLATION.md

/vh-progression-economy W aktualnym repo Vertical Hole wykonaj WYŁĄCZNIE naprawę VH-02 — oddzielenie Areny od Dzielnic, tylko jeśli P00 potwierdził wpływ. Nie uruchamiaj innych promptów w tej sesji.

# PX02 — Pełna izolacja Areny i Dzielnic (VH-02, P1 CORE)
**Skille pomocnicze:** `vh-arena-gameplay`, `vh-save-security`, `vh-game-engineer`, `vh-qa-automation`.

1. Przeczytaj `VH_PREFLIGHT_REPORT.md`, `.claude/vertical-hole/{ARENA_DISTRICT_CONTRACT,SAVE_MIGRATION_CONTRACT,CHANGE_SAFETY,EVIDENCE_FRESHNESS}.md`, stan repo oraz wyniki PX01. Potwierdź w aktualnym kodzie cały łańcuch `nagroda misji dzielnic → save.coins / grantXp → RUN_TOOLS / SKINS.perks → parametry Areny`. **Nie zakładaj, że sam wspólny wyświetlany licznik jest błędem; potwierdź realny, niedozwolony wpływ stanu kampanii na zasady Areny.** Jeśli brak → PASS/NO CHANGE.
2. Zmapuj ownership: dla każdego zasobu, zakupu, odblokowania i efektu wskaż `arena`, `districts`, `cosmetic-neutral` oraz gdzie jest zapisany; oznacz niejednoznaczności do decyzji właścicielki. Niedozwolone są kanały kampanijnych bonusów, walut, XP, nagród i progresu wpływające na statystyki, start, wynik, długość czy dostępność rundy Areny. Nie usuwaj legalnych istniejących praw graczy ani kupionych benefitów bez zatwierdzonej migracji.
3. Jeżeli potrzeba nowego podziału zapisu lub ekwiwalentu historycznych zakupów, zaproponuj minimalny wariant i bezstratny plan migracji, z fixture'ami starych sald/inventory. **Przy konfliktach praw do już kupionych przedmiotów STOP i poproś o decyzję, bez destrukcyjnego patcha.** W pozostałych przypadkach wdrażaj tylko najmniejszą poprawkę i testy. Nie przywracaj energii.
4. Testuj tym samym seedem i wejściami: Arena przed i po misjach/zakupach/XP/skin perks/resetach Dzielnic ma identyczny start, parametry, fizykę, limity i scoring; replay oraz CTA „Następna arena” niezależne od stanu kampanii. Osobno potwierdź, że działania Areny nie zmieniają progresu kampanii. Sprawdź ochronę zakupów, zachowanie legacy save, SAVE-08/09, BOOST-01..03.
5. Udokumentuj dowody po ostatnim patchu (fingerprint, testy, diff, rollback); `CORE-ISOLATION=PASS` tylko przy rzeczywistym dowodzie braku transferów. Bez kontroli urządzenia: mobile `NOT RUN`.

**Kryterium zamknięcia:** niezależna Arena i Dzielnice + brak utraconych zapisów/uprawnień. **Nie publikuj, nie pushuj i nie naprawiaj FTUE ani warsztatu poza wymaganą granicą trybów.** Po zmianie ponów adekwatną część P00.

**Raport końcowy (obowiązkowy):** podaj dla każdego testu `PASS/FAIL/NOT RUN` z dowodem lub brakiem dowodu, zaktualizowane pliki, polecenia, ewentualny rollback oraz stan odpowiedniej bramki. Jeśli coś nadal jest `FAIL` albo `NOT RUN`, nie deklaruj ukończenia. **Nie publikuj ani nie pushuj bez zgody właścicielki.**

---

## PX03-DEV-PANEL.md

/vh-test-console W aktualnym repo Vertical Hole wykonaj WYŁĄCZNIE naprawę VH-01 — oddzielny panel developerski bez debug kodu w produkcji; wyłącznie gdy aktualne P00 potwierdzi problem.

# PX03 — Panel testowy tylko w wydaniu DEV (VH-01, P0 release)
**Skille pomocnicze:** `vh-game-engineer`, `vh-save-security`, `vh-release-manager`, `vh-qa-automation`.

1. Przeczytaj P00, `.claude/vertical-hole/{RELEASE_DEBUG_GUARD,SAVE_MIGRATION_CONTRACT,CHANGE_SAFETY,EVIDENCE_FRESHNESS}.md` oraz stan repo. Sprawdź prawdziwe build entrypoints, `class DevPanel`, `window.game.devPanel`, debug mutatory, tokeny/kody, sourcemapy i dynamicznie ładowane skrypty. Samo ukrycie guzika/hasło/flag runtime NIE izoluje produkcji. Jeśli kod produkcyjny już nie zawiera implementacji, nie zmieniaj nic na zapas.
2. Zrób **dwa fizycznie rozłączne artefakty** z jednoznacznym procesem budowania: DEV z panelem i przełącznikiem trybów testowych, RELEASE bez kodu klasy panelu, globali, mutatorów i pośrednich importów. Oddziel zapis testowy od normalnych profili; dev musi pozostać prosty do uruchomienia i używania na telefonie, w tym instrukcja dla właścicielki. Nie wprowadzaj sekretów do JS publikowanego klientowi ani mechanizmów obchodzenia release.
3. Kontrola: `python .claude/vertical-hole/tools/verify_release_artifact.py --dev-build <katalog_dev> --release-build <katalog_release>` z prawdziwymi ścieżkami; ręczny skan JS/HTML/sourcemap, dev global API, ewentualnego lazy chunk, direct URL debug i storage. Test pozytywny DEV: bezpieczna aktywacja panelu na telefonie i operacje unlock/reset tylko na izolowanym teście. Test negatywny RELEASE: żadna droga do debug API/panelu/mutatorów, bez wycieku danych lub dostępu przez parametry URL. Gdy nie ma telefonu: mobile NOT RUN.
4. Nie naprawiaj konfliktu przez usunięcie panelu z DEV. Dokumentuj instrukcję „jak uruchomić na telefonie”, testy, fingerprint obu artefaktów i rollback. Jeśli instalacja projektu nie pozwala bezpiecznie wydzielić dwóch artefaktów, **STOP** i przedstaw minimalny plan przed zmianą architektury.

**Kryterium zamknięcia:** `TOOLS-DEV=PASS` dopiero przy działającym DEV i bezpiecznym RELEASE po testach na aktualnych buildach. Nie deployuj, nie pushuj bez zgody. Po zmianie powtórz release guard, SAVE i adekwatną część P00.

**Raport końcowy (obowiązkowy):** podaj dla każdego testu `PASS/FAIL/NOT RUN` z dowodem lub brakiem dowodu, zaktualizowane pliki, polecenia, ewentualny rollback oraz stan odpowiedniej bramki. Jeśli coś nadal jest `FAIL` albo `NOT RUN`, nie deklaruj ukończenia. **Nie publikuj ani nie pushuj bez zgody właścicielki.**

**Niezbędny smoke po wycięciu kodu panelu:**
Po fizycznym wydzieleniu DEV sprawdź, że release nie wywołuje osieroconych `DEV`, `devBoot`, `DevPanel` ani debug storage i nie rzuca `ReferenceError` w rzeczywistym uruchomieniu `index.html → start → runda → zapis → reload`. Skrypt markerów PASS nie wystarcza. Zachowaj mobilny dostęp do DEV na osobnym testowym adresie/artefakcie, bez ujawniania produkcyjnych danych i bez publikowania go jako release.

---

## PX04-PAGES.md

/vh-release-manager W aktualnym repo Vertical Hole wykonaj WYŁĄCZNIE naprawę VH-04 — bezpieczny workflow GitHub Pages. Zmiana definicji CI jest dozwolona, ale BEZ push, uruchamiania deploymentu ani publikacji.

# PX04 — Zabezpieczenie publikacji GitHub Pages (VH-04, P0 release)
**Skille pomocnicze:** `vh-game-engineer`, `vh-qa-automation`, `vh-test-console`.

1. Sprawdź P00, `.github/workflows/`, istniejące buildy i `.claude/vertical-hole/{RELEASE_DEBUG_GUARD,QUALITY_GATES,CHANGE_SAFETY,EVIDENCE_FRESHNESS}.md`, stan repo oraz sposób zbudowania oddzielnego RELEASE z PX03. **Nie zakładaj nazwy workflow:** znajdź odpowiedzialny za Pages. Potwierdź czy `on.push.branches` zawiera `claude/**`, czy artefakt ma `path: "."` i jakie dokładnie pliki byłyby publikowane.
2. Najmniejszy bezpieczny patch YAML: źródłem produkcji ma być tylko jawnie zatwierdzona gałąź/tag/workflow z kontrolą recenzji, a artefaktem **wydzielony katalog RELEASE** z niezbędnymi assetami, bez repo, `.claude`, źródeł DEV, testów, prywatnych plików, sourcemap debug. Zadbaj o uprawnienia workflow i możliwość weryfikacji/procedurę manualnej akceptacji; upewnij się, że katalog wynika z REALNEGO builda i nic nie znika z działania gry. Nie zakładaj istnienia konkretnego katalogu `dist` bez sprawdzenia.
3. Sprawdź skryptem `python .claude/vertical-hole/tools/check_pages_workflow.py --repo .` oraz testem/suchą walidacją workflow (jeśli dostępne). Spisz manifest plików i hashe RELEASE; uruchom `verify_release_artifact.py` na DEV/RELEASE. Sprawdź, że brak automatycznej publikacji z gałęzi roboczych i `path: "."`.
4. Gdy ochronę środowiska/protected branches trzeba skonfigurować przez GitHub Settings, nie zgaduj: raportuj „wymagana ręczna konfiguracja”; do czasu potwierdzenia `GO_RELEASE=STOP`. Brak możliwego sprawdzenia samej strony także nie jest PASS.

**Kryterium zamknięcia:** bezpieczna, kontrolowana definicja publikacji + manifest czystego RELEASE + dowody testów. **Nie wykonuj `git push`, nie uruchamiaj workflow, nie publikuj gry, nie modyfikuj Settings bez zgody właścicielki.** Osobny test prawdziwego hosta to PX05.

**Raport końcowy (obowiązkowy):** podaj dla każdego testu `PASS/FAIL/NOT RUN` z dowodem lub brakiem dowodu, zaktualizowane pliki, polecenia, ewentualny rollback oraz stan odpowiedniej bramki. Jeśli coś nadal jest `FAIL` albo `NOT RUN`, nie deklaruj ukończenia. **Nie publikuj ani nie pushuj bez zgody właścicielki.**

**Krytyczny test kontrolera przed i po zmianie (v1.4.2):**
Poprzedni checker błędnie przepuszczał workflow z `path: ./`, `${{ github.workspace }}` i `feature/**`. Uruchom obecny `check_pages_workflow.py` także na negatywnych syntetycznych fixture'ach tych wariantów oraz `pull_request`, bez ograniczenia branches i `dist/dev`. Każdy ma zwrócić FAIL; poprawna ręcznie zatwierdzona konfiguracja z kuratorowanym katalogiem RELEASE ma przejść. Sprawdź WSZYSTKIE aktywne workflows i efektywne źródło Pages, wymagane reviews środowiska i ochronę `main` w GitHub Settings; jeśli brak dowodu ustawień: `GO_RELEASE=STOP` nawet przy PASS YAML. Nie wymuszaj publikacji, żeby przetestować checker.

---

## PX05-LIVE-PRODUCTION.md

/vh-qa-automation W aktualnym repo Vertical Hole wykonaj WYŁĄCZNIE weryfikację VH-05 — test prawdziwej opublikowanej gry, NIE pozorowanego hosta. Nie wdrażaj gry.

# PX05 — Wiarygodny test prawdziwego URL (VH-05, P0 bramka release)
**Skille pomocnicze:** `vh-release-manager`, `vh-test-console`, `vh-game-engineer`.

1. Przeczytaj P00 oraz `.claude/vertical-hole/{RELEASE_DEBUG_GUARD,QUALITY_GATES,EVIDENCE_FRESHNESS,TEST_MATRIX}.md`; sprawdź `qa/dev-panel.mjs` i inne E2E. W szczególności wykryj czy sekcja `production host (simulated)` robi `context.route(...).fulfill` z lokalnych plików. **Taki test wolno zachować jako jednostkowy/symulowany, ale NIGDY jako dowód prawdziwego hosta.**
2. Stwórz/uruchom osobny test REAL-LIVE: faktyczne żądania do `https://klaudiamoscinska-art.github.io/vector-hole/`, BEZ `context.route`, HAR replay, mock server, local file replacement, service-worker substitution czy trybu offline. Udokumentuj HTTP statusy, skuteczne ścieżki assetów, Cache-Control, liczbę załadowanych plików i fingerprint SHA256 otrzymanych bajtów, porównując z **zatwierdzonym artefaktem RELEASE** o jednoznacznej rewizji. Wyczyść/omiń cache w sposób bezpieczny dla testów. Uwaga: porównanie z bieżącym HEAD bez potwierdzenia wdrożonej rewizji to niewiarygodny dowód.
3. Negatywne testy na prawdziwym hostcie: brak `DevPanel` i debug mutatorów (w tym ukrytych lazy JS/sourcemap); brak możliwości użycia kodu testowego; brak przypadkowo opublikowanych narzędzi `.claude`/testów/source. Potwierdź działanie podstawowej pętli Areny i save na izolowanym testowym profilu w przeglądarce; telefon fizyczny `NOT RUN`, jeśli go nie masz. Nie niszcz stanu prawdziwych użytkowników.
4. **Warunek historycznego deploymentu:** jeżeli nowy, poprawiony RELEASE nie został jeszcze opublikowany, nie oznaczaj tego testu jako PASS dla nowego builda. Możesz zbadać obecny host i raportować jego stan, ale `GO_RELEASE=STOP/NOT RUN` do czasu świadomie zatwierdzonej publikacji i ponownego testu. Nie rozpoczynaj deploymentu bez zgody.
5. Zapisz raport `LIVE-PRODUCTION=PASS/FAIL/NOT RUN`, porównanie hashów, revision/deployment, dowody sieciowe i ograniczenia; napraw tylko sam błędny test QA, nie samą aplikację ani deploy. Stare testy symulowane oznacz wyraźnie `SIMULATED`, nie `PRODUCTION`.

**Kryterium zamknięcia:** zweryfikowany, rzeczywiście opublikowany artefakt, osobny negatywny test publicznego hosta oraz poprawne oznaczenie braku dowodów. Nie publikuj, nie pushuj.

**Raport końcowy (obowiązkowy):** podaj dla każdego testu `PASS/FAIL/NOT RUN` z dowodem lub brakiem dowodu, zaktualizowane pliki, polecenia, ewentualny rollback oraz stan odpowiedniej bramki. Jeśli coś nadal jest `FAIL` albo `NOT RUN`, nie deklaruj ukończenia. **Nie publikuj ani nie pushuj bez zgody właścicielki.**

**Zakres weryfikacji (bez ukrytego wdrożenia):**
Możesz poprawić wyłącznie lokalne testy QA, aby odróżniały jawnie symulację od testów produkcyjnych; nie zmieniaj gameplay, live hosta ani workflow. Rozróżnij status obecnie dostępnego LIVE od statusu nowego RELEASE, którego jeszcze nie opublikowano. Nie oznaczaj testu nowego wydania PASS na podstawie starego live. Jeżeli środowisko nie pozwala pobrać rzeczywistych bajtów publicznego URL, raportuj `NOT RUN` i przedstaw powtarzalną procedurę do uruchomienia przez Claude w repo z dostępem do sieci.
