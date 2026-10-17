# Vertical Hole — audyt niezależny gry i paczek Claude Code

**Data:** 17.10.2026 · **zakres:** wskazany publiczny adres gry, dostępne publicznie źródła `klaudiamoscinska-art/vector-hole/main`, paczka skilli 22 × v1.4.1 i paczka promptów P00+15+PX01..05 v1.4.2.

## Metoda i ważna granica wiarygodności

- Odczytano stronę publiczną (`https://klaudiamoscinska-art.github.io/vector-hole/`) i selektywne sekcje publicznych plików `game.js`, `.github/workflows/deploy-pages.yml`, `qa/dev-panel.mjs`, `CLAUDE.md` przez zewnętrzne źródło internetowe w dniu audytu.
- Rozpakowano **obie przesłane paczki**, przejrzano 22 skille, 16 dokumentów kontraktowych, 21 osobnych promptów i implementacje walidatorów. Uruchomiono pełne 18 dotychczasowych testów (18 PASS) oraz kontrolę promptów. Wykonano odrębne eksperymenty z niebezpiecznymi plikami workflow (fałszywe PASS), potem poprawiono walidator i uruchomiono rozszerzony pakiet 21 testów (21 PASS), `validate.py` i `check_prompts.py` (PASS).
- **Nie uruchomiono** publicznej rozgrywki z interaktywnymi gestami ani dwuminutowego gameplayu, fizycznego telefonu, portali reklamowych, testów retencji ludzi, rzeczywistych reklam/płatności, lokalnego repo gry i pełnego `qa/run-all.mjs`. Nie pobrano live `game.js` bajt-po-bajcie ani nie porównano jego hash z `main`: host strony i źródła `main` to powiązane, ale **nie dowodowo identyczne** artefakty. W tych obszarach status **NOT RUN**, nie PASS. Kontener nie mógł wykonać `git clone` z powodu braku dostępu sieciowego; źródła kodu przeczytano przez przeglądarkową warstwę dostępu do internetu.
- Żaden z ZIPów nie edytuje gry, nie wykonano publikacji ani push. Poniższe ustalenia dotyczą **publicznego kodu repo** odczytanego w tym dniu, nie gwarantują aktualnych bajtów aktywnego serwera.

## A. Krytyczne problemy gry (naprawić przed wydaniem; część przed nowym rozwojem)

| ID | Waga | Obserwacja / poziom dowodu | Naprawa / weryfikacja | Prompt |
|---|---|---|---|---|
| **VH-01** | **P0 przed release** | W publicznym `game.js` są `class DevPanel`, `window.game.devPanel = new DevPanel(...)`, dostęp przez kod/gest i mutatory zapisów. **POTWIERDZONE W ŹRÓDLE**. Kod w tym samym JS co gra; hasło/ukrycie DOM to nie izolacja artefaktu. | Dwa rzeczywiście osobne artefakty DEV i RELEASE; debug tylko w DEV; wszystkie wejścia do release sprawdzone manualnie, smoke start→runda→save, sprawdzenie na telefonie. | PX03 |
| **VH-02** | **P1 GO_CORE** | `RUN_TOOLS` Areny są kupowane z `this.save.coins`; Warsztat kupuje z tych samych `coins/prisms`, skiny mają premii typu `perk`, XP z areny. **POTWIERDZONY wspólny przepływ waluty; jego dokładny wpływ gameplayowy do przetestowania na tym samym seedzie**. Przy ścisłym wymaganiu oddzielności Arena↔Dzielnice to naruszenie kontraktu. | Jawne ownership zasobów i uprawnień, brak kampanijnej przewagi w Arenie, zabezpieczone zakupy historyczne i migracje, testy różnicowe. Nie należy bez decyzji właścicielki kasować sald. | PX02 po PX01 |
| **VH-03** | **P1 GO_CORE / P0 gdy ujawni się utrata zapisu** | `migrateSave(data)` zwraca `defaultSave()` dla niezgodnych `owned`/`coins`; `loadSave()` wywołuje `sanitizeSave(migrateSave(...))` i **zapisuje wynik do `localStorage` podczas samego odczytu**. Future schema nie ma odrębnej ścieżki fail-closed. **RYZYKOWNA ŚCIEŻKA POTWIERDZONA w kodzie; skala realnych utrat NOT RUN**. | Kopia oryginalnych bajtów, walidacja wersji i kształtu PRZED zapisem, blokada autozapisu dla nieobsługiwanych danych, testy starych/nieznanych/uszkodzonych save, konfliktu wielu kart, cloud, odzyskania i rollback. | PX01 jako pierwszy |
| **VH-04** | **P0 przed release** | `.github/workflows/deploy-pages.yml` ma `push` na `main` i `claude/**`, z `actions/upload-pages-artifact path: "."`. **POTWIERDZONE w pliku workflow.** Grozi publikacją roboczej wersji i plików nieprzeznaczonych do dystrybucji. | Zaufane źródło publikacji, kuratorowany katalog RELEASE, sprawdzenie review/protected environment w ustawieniach GitHub, negatywne testy CI i kontrola serwowanych hashy. **Zapisanie YAML nie jest zgodą na deploy.** | PX04 po PX03 |
| **VH-05** | **P0 bramka release** | `qa/dev-panel.mjs` ma `production host (simulated)` z `context.route(PROD + '**')` i `r.fulfill(...fs.readFileSync(file))`. **POTWIERDZONE** — test używa lokalnych plików, nie sieci. | Osobny test rzeczywistego publicznego URL BEZ interceptu, zgodność plików i SHA z zatwierdzonym artefaktem, negatywna weryfikacja DevPanel na hostcie, z rozróżnieniem starego live i nowego deployu. | PX05 po zaakceptowanym release |

**Trzy wcześniejsze zadania, bez ponownej implementacji:** (1) usunięcie regenerującej się energii — `save.energy` nie znaleziono w udostępnionym źródle, migrator usuwa legacy `energy`; statycznie wygląda poprawnie, **pełny runtime NOT RUN**. (2) izolacja Areny — **niepełna ekonomicznie**, powyżej. (3) panel testowy — **istnieje** i ma test sandbox, lecz **jest w publicznym JS**; funkcjonalność na iPhone **NOT RUN**. 

**Pierwsze pięć minut i jakościowy audyt gry:** Ze strony rozpoznano szybkie CTA Areny, rundę `2:00`, dodatkowe ekrany: wybór wsparcia, nagrody, warsztat, dzielnice, zadania, skórki i wyzwania. Brak danych o faktycznej liczbie tapnięć, łatwości pierwszego pochłonięcia, FPS, blokadach dialogów czy retencji. **Nie wolno wnioskować z samego HTML, że FTUE jest już angażujące albo że działa 5 minut.** Wysoki priorytet PLAYTEST po GO_CORE: świeży zapis → pierwsza sekunda → pierwsze pochłonięcie → pierwsze 2:00 → kolejna Arena, z mierzeniem R5 od wejścia i A5 aktywnego czasu oddzielnie. P04-05 i P14D już to opisują; brak powodu do zmiany niekrytycznych części tych promptów.

## B. Krytyczne usterki paczek instrukcji (naprawione)

| ID | Krytyczna luka | Skutek przed poprawką | Poprawka w wydanych ZIPach |
|---|---|---|---|
| **PK-01** | `scripts/check_pages_workflow.py` akceptował `path: ./`, `path: ${{ github.workspace }}`, branch `feature/**`, inne nieprzejrzane triggery. Dowód: sztuczne workflow zwracały kod `0` i `STATIC CHECK PASS`. | **Fałszywy GO_RELEASE**, mimo niebezpiecznego deployu — najważniejsza nowa luka. | Walidator **fail-closed**; pozytywna lista znanych branchy/zdarzeń i katalogów artefaktów, odmowa dla aliasów root/dynamic paths i niewspieranych wzorców. Kopia dla narzędzia instalowanego w repo. Trzy nowe testy regresyjne (łącznie **21/21 PASS**). |
| **PK-02** | `.claude/vertical-hole/CHANGE_SAFETY.md` i README opisywały implementowanie napraw jako „fazy P00”, chociaż P00 i kolejka v1.4.2 stanowczo wymagają P00 **read-only**. | Claude mógł zmieniać fundamenty podczas samego audytu i ominąć granice PX / akceptację. | Ujednolicono zakres: **P00 tylko diagnozuje**, potwierdzone poprawki wyłącznie osobnymi PX01–PX05. |
| **PK-03** | PX03/04/01 nie zawierały wyraźnego testu regresji po fizycznym wydzieleniu DEV i po migracji, obejmującego **osierocone referencje debug, autosave i inne kolejne zapisy**, ani testu obejść walidatora CI. | Można usunąć panel ze skryptu i wywołać `ReferenceError`; załatać `loadSave`, ale późniejszy autosave nadpisze niezrozumiały zapis; ogłosić bezpieczny release po wadliwym checku. | Dopisano tylko krytyczne scenariusze w PX01, PX03, PX04 i P00; PX05 rozróżnia faktyczny live i nieopublikowany build. |

**Niekrytyczne sugestie — niezmienione jako zadania:** ergonomia M59, ikona M32, spójność misji i celów, pętla nagrody, pausing/mobile orientation, balans boostów, atrakcyjność pierwszej sesji, wydajność i dostępność w różnych telefonach, porządkowanie historycznych dokumentów `v1.2`/`v1.3`, ewentualny podział monolitu `game.js`. Wygląd i działanie tych elementów **niezbadane end-to-end**; nie należy ich oznaczać ani PASS, ani FAIL bez testu. Po naprawie GO_CORE prace według istniejących 15 promptów.

## C. Kolejność Claude Code i bramki

1. **P00.md** — audyt WYŁĄCZNIE read-only w prawdziwym repo, dowody `PASS / FAIL / NOT RUN`. Odczyt publicznych źródeł nie zastąpi sprawdzenia bieżącego worktree.
2. **PX01-SAVE.md** — gdy P00 potwierdzi VH-03, bezstratna ochrona zapisów; najpierw fixture i mechanizm rollback.
3. **PX02-ISOLATION.md** — jeżeli P00 potwierdzi przepływ kampanii do Areny, po ochronie save; nie resetuj zakupów.
4. **PX03-DEV-PANEL.md** — DEV/RELEASE, uruchamialność obu, panel dostępny na telefonie w DEV.
5. **PX04-PAGES.md** — workflow i katalog RELEASE, brak nieuprawnionego pusha/deployu; ręczna kontrola GitHub Settings.
6. **PX05-LIVE-PRODUCTION.md** — QA obecnego hosta można wykonać wcześniej, lecz PASS *nowego* release dopiero po wyraźnie zatwierdzonym wdrożeniu.
7. Powtórz P00 na **tym samym końcowym snapshocie**, uzupełnij logi. Potem P14B → P06B → P14A → P14D → P04-05 i reszta oryginalnej kolejki, z uwzględnieniem faktycznych blokad.

**GO_CORE:** energia + brak transferów ekonomii + grywalna pętla + bezpieczne save wszystkie PASS. **GO_TOOLS:** oddzielny DEV, działający panel, release bez debug, telefon. **GO_RELEASE:** jeszcze dodatkowo bramka workflow, realny host, platforma, prywatność, bezpieczeństwo SDK/monetyzacji oraz **świadoma zgoda właścicielki**. Statyczny PASS, test symulacji czy kontrola ZIP nigdy nie są jedynym dowodem GO.

## D. Testy zakończone i ograniczenia

- ZIP skilli: **22/22 SKILL.md**, **16/16 dokumentów**: walidacja struktury PASS.
- `python -m unittest discover -s scripts/tests -v`: **21/21 PASS** (18 historycznych + 3 nowe, z wariantami poprzednio fałszywie akceptowanymi).
- ZIP promptów: **16 oryginalnych + 5 naprawczych**; `python check_prompts.py`: PASS, plik `WSZYSTKIE_PROMPTY.md` zgodny z osobnymi plikami.
- Aktualna gra (JavaScript na rzeczywistym telefonie, 120 sekund Areny, save E2E): **NOT RUN**.
- CDN/publiczne `game.js` SHA porównane z repo/release: **NOT RUN**.
- SDK Poki/CrazyGames, reklamy, IAP i privacy compliance: **NOT RUN**. Przed komercyjnym wydaniem dodatkowa bramka kontraktowo-prawna, bez twierdzenia, że stwierdzono już naruszenie.

## Pliki źródłowe audytu

- Publiczna gra: https://klaudiamoscinska-art.github.io/vector-hole/
- Repo: https://github.com/klaudiamoscinska-art/vector-hole
- Źródłowy `game.js`: https://raw.githubusercontent.com/klaudiamoscinska-art/vector-hole/main/game.js (w szczególności linie 3264–3288, 3552–3591, 3757–3795, 8327–8363, 14024–14076, 16900–16908).
- Workflow: https://raw.githubusercontent.com/klaudiamoscinska-art/vector-hole/main/.github/workflows/deploy-pages.yml (linie 2–7, 25–36).
- Symulowany host QA: https://raw.githubusercontent.com/klaudiamoscinska-art/vector-hole/main/qa/dev-panel.mjs (linie 138–189).

**Werdykt:** paczki v1.4.2 (skille) / v1.4.3 (prompty) **nadają się do warunkowego rozpoczęcia audytu P00 w Claude Code**. Gra **nie ma potwierdzonego GO_CORE ani GO_RELEASE**; najpierw należy wykonać i testami potwierdzić opisane naprawy. ZIPy nie modyfikują produkcyjnej gry.
