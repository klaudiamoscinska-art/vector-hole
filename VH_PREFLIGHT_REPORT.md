# VH_PREFLIGHT_REPORT — PX01-SAVE (VH-03), z drugą rundą przeglądu (R1–R4), + częściowa ponowna kontrola P00

**Data:** 2026-10-17 · **Repozytorium:** `klaudiamoscinska-art/vector-hole`
**Bazowy SHA:** `ed9c729c3ef865f0e01c761d86de18ff58e4b70b` (= `origin/main`)
**Gałąź robocza:** `px01-save-safety` (lokalna, z `ed9c729`; **bez commita i bez push**)
**Snapshot źródeł po pracy (check_evidence.py):** `5feabda798bc086a36c268792d8c8c508d915a104b1d62148ebfd83b8012e577` (174 pliki)
**Pliki runtime (SHA-256):**
- `index.html d9e33be8…d07d` i `style.css 69aee005…ca0a` — bez zmian.
- `game.js` **`dc94d8d981b5c328ae03979ac32b9495b5ae1e9a5a745a89ee55d6933a3e67aa`**. Baza: `46b3014e…ed9c`. Runda 1: `ff23d2ee…c291`.

**Środowisko:** kontener Linux, node v22.22.0, Playwright z headless Chromium. **Wszystkie testy to emulacja.** Nie było fizycznego telefonu, a SDK CrazyGames było zamockowane.
**Skille:** główny `vh-save-security`; checklisty `vh-game-engineer`, `vh-progression-economy` i `vh-qa-automation` stosowane ręcznie. Bez agentów w tle.

> Evidence z P00 nie istniało w tej sesji. Raport P00 traktuję jako kontekst historyczny, nie jako dowód. Wszystkie błędy odtworzyłem na nowo przed zmianą kodu: rundę 1 na `ed9c729`, rundę 2 na kodzie z rundy 1.

---

## 1. Werdykt

| Bramka | Wynik | Dowód |
|---|---|---|
| **CORE-SAVE** | **PASS** (emulacja) | `PX01-31-save-safety-final.log`: **107/107**. Ta sama suita na kodzie bazowym: 46/107 (`PX01-11`). R1–R4 na kodzie z rundy 1: 9 FAIL (`PX01-12`). |
| CORE-ENERGY | PASS, bez zmian | `PX01-60` |
| CORE-LOOP | PASS (emulacja) | `PX01-61` |
| CORE-ISOLATION | **FAIL — bez zmian**, PX01 go nie pogorszył | `PX01-62`, `PX01-64` |
| TOOLS-DEV | NOT RUN (poza zakresem; FAIL z P00 bez zmian) | — |
| Pełne QA `node qa/run-all.mjs` | **571/576** | `PX01-30` |

Pięć FAIL-i w pełnym QA to znana data EN plus cztery testy, które zachowują się tak samo na kodzie bazowym (sekcja 5) — **nie są to regresje PX01**.

- **GO_CORE = STOP**: CORE-ISOLATION czeka na decyzję A/B/C.
- **GO_TOOLS = NO GO**, **GO_RELEASE = STOP**.
- **Werdykt PX01: READY FOR REVIEW.** Bez commita, push, PR i deployu.

`check_evidence.py --repo . --manifest VH_PREFLIGHT_MANIFEST.json` → `EVIDENCE CURRENT/FORMALLY COMPLETE — game tests NOT executed or verified by this script`, `Worktree SHA256: 5feabda7…e577 files: 174`. To kontrola formalna, nie test gry.

Świeżość dowodów:
- Finalne QA i suita zapisu działały na zamrożonym kodzie. SHA-256 wszystkich 128 plików źródłowych przed i po testach jest identyczny (`PX01-21` == `PX01-22`).
- Snapshot obejmuje też logi z `evidence/`, które nie są wskazane w manifeście (narzędzie celowo je haszuje).

---

## 2. Przyczyny błędów

### Runda 1 (odtworzone na `ed9c729`)
| Błąd | Przyczyna |
|---|---|
| SAVE-08 (przyszły schemat) | `loadSave()` po `migrateSave()` i `sanitizeSave()` **zawsze** wywoływał `saveGame()`. Wersja 99 była normalizowana i od razu zapisywana na oryginał. Nie było kontroli `schemaVersion > 13` ani kopii. |
| SAVE-09a/b (`coins:"500"`, `owned` nie-tablica) | `migrateSave()` przy złym `coins`/`owned` zwracał `defaultSave()`, a `loadSave()` zapisywał go na oryginał. |
| SAVE-09c (obcięty JSON) | Wyjątek parsowania był po cichu ignorowany i gra wracała do `defaultSave()`. Pierwszy autozapis nadpisywał oryginał bez kopii. |
| SAVE-09d (dwie karty) | `saveGame()` zapisywał ślepo, więc wygrywał ostatni zapis. |
| Dodatkowo | Przy błędzie `getItem` gra zapisywała pusty profil. Nieczytelna lub przyszła kopia w chmurze była nadpisywana. Częściowy zapis v13 tracił monety. |

### Runda 2 (niezależny przegląd; odtworzone na kodzie z rundy 1 `ff23d2ee`, `PX01-12`)
| # | Błąd | Przyczyna (runda 1) | Wynik na kodzie z rundy 1 |
|---|---|---|---|
| R1 | Reset profilu bez `.rescue` | `resetProfile()` najpierw czyścił chmurę (`clearCloudSave()`), potem ignorował wynik `releaseSaveGuard()` i i tak usuwał zapis oraz przeładowywał stronę. | Zapis z nowszej wersji usunięty, kopia konta skasowana, reload |
| R2 | Lustro chmury po nieudanym zapisie | Warunek `SAVE_MIRROR && sealed`: `sealed` istniał nawet wtedy, gdy `setItem` rzucił wyjątek. | Stan niezapisany lokalnie trafiał do chmury |
| R3 | Istniejący pusty zapis `""` | `if (!raw)` traktował `""` jak brak zapisu; `releaseSaveGuard()`/`backupPending` (`if (current && …)`) pomijały kopię pustego tekstu; w chmurze `if (raw)` traktował `""` jak brak kopii i instalował lustro. | Klucz `""` nadpisany lokalnie i w chmurze |
| R4 | Stan `unavailable` bez komunikatu | `showSaveGuardNotice()` od razu zwracał dla `unavailable`. | Zapis blokowany po cichu |

## 3. Poprawka

### Runda 1 (bez zmian w tej rundzie)
- `SAVE_GUARD` (`ok` / `future` / `corrupt` / `invalid` / `unavailable` / `stale`) blokuje każdy zapis w `saveGame()`. Przez tę funkcję przechodzą wszystkie 51 wywołań, łącznie z lustrem chmury.
- `readSave()` klasyfikuje zapis i nigdy go nie zapisuje.
- `sanitizeSave(save, issues)` zgłasza naprawione pola (wynik naprawy bez zmian).
- `verifyMigration()`: migracja trafia na dysk dopiero po sprawdzeniu wersji, idempotencji i tego, że nie zginęły salda, przedmioty, zakupy, misje ani boostery. Wcześniej oryginał trafia pod `vectorHoleSave_v1.bak`.
- Zwykły odczyt nic nie zapisuje.
- Dwie karty: zdarzenie `storage` + porównanie przed zapisem.
- Odblokowanie tylko jawną decyzją gracza, z oryginałem pod `vectorHoleSave_v1.rescue`.
- Kopii konta w chmurze, której ta wersja nie odczyta, gra nie nadpisuje.

### Runda 2 (`PX01-52-diff-review2-game.js.patch`, kilkanaście linii w `game.js` + 3 wpisy `I18N_EN`)
- **R1:** `resetProfile()` najpierw próbuje `releaseSaveGuard()`. Jeśli kopia `.rescue` się nie uda: komunikat „Brak miejsca na kopię” i `return`. Wtedy nie ma `clearCloudSave()`, `removeItem` ani `reload`. Analityka i czyszczenie chmury dopiero po udanej kopii.
- **R2:** lustro chmury tylko przy `stored === true`, czyli po udanym lokalnym `setItem`. Poprawna synchronizacja działa dalej, co potwierdza test.
- **R3:** `if (raw === null)` oznacza nowego gracza; `""` idzie do parsowania i kończy się stanem `corrupt` (tylko odczyt). `releaseSaveGuard()` i kopia `.bak` używają `current !== null`, więc pusty tekst też trafia do kopii. W chmurze `raw != null` sprawia, że pusta kopia konta jest „nieczytelna”, nienadpisywana, a lustro się nie instaluje.
- **R4:** nowy komunikat „Zapis nie działa”: przeglądarka nie pozwala odczytać danych, gra niczego nie usunie ani nie nadpisze, nowy postęp nie jest zapisywany. Przycisk ODŚWIEŻ, zamknięcie „GRAJ BEZ ZAPISU”. Teksty po polsku i angielsku.

Bez nowego schematu (v13) i bez zmian w gameplayu, ekonomii, panelu DEV oraz workflow.

**Pliki zmienione:** `game.js`, `qa/run-all.mjs`, `qa/README.md`, `CLAUDE.md`, `docs/GAME_DESIGN.md`, `docs/CHANGELOG.md`.
**Pliki nowe:** `qa/save-safety.mjs` (536 linii, 107 testów), `VH_PREFLIGHT_MANIFEST.json`, ten raport, `.claude/vertical-hole/evidence/PX01-*`.
**Diffy:** pełny `PX01-50-diff.patch`, runda 2 `PX01-52-diff-review2-game.js.patch`.

## 4. Wyniki (finalny kod, `node qa/save-safety.mjs` — 107/107, emulacja; fixture'y syntetyczne w `evidence/PX01-fixtures/`)

| Test | Wynik | Co sprawdzono |
|---|---|---|
| SAVE-01 | PASS | v12 z energią → v13 bez energii, odblokowania zachowane, oryginał pod `.bak`; odczyt bez zapisu |
| SAVE-02 | PASS | Salda, przedmioty, zakupy, nagrody i boostery identyczne po 3 reloadach, bez podwójnych przyznań |
| SAVE-03 | PASS | Idempotencja dla v5, v10, v12 i bieżącego zapisu |
| Legacy / częściowy / brak zapisu | PASS | v1, v5, v10, bieżący i częściowy v13 bez fałszywej blokady; świeży profil zapisuje się normalnie |
| SAVE-04 | PASS | Quota przy każdym zapisie: oryginał nietknięty. Odmowa odczytu: 0 zapisów |
| SAVE-05 | PASS | Zepsuta kampania przy dobrej Arenie i odwrotnie: oryginał bez zmian, oba tryby grywalne |
| SAVE-06 | PASS (mock) | Kopia konta z nowszej wersji, nieczytelna albo **pusta**: nienadpisana. Uszkodzony zapis lokalny + dobra kopia konta: przywrócenie z `.rescue`. **Prawdziwe SDK: NOT RUN** |
| SAVE-07 | PASS (emulacja) | `qa/dev-panel.mjs`: prawdziwy zapis bajtowo identyczny w trybie testowym (`PX01-63`). **Wiele urządzeń: NOT RUN** |
| **SAVE-08** | **PASS** | Wersja 99: bajty identyczne po wczytaniu, po każdym autozapisie (logowanie, skrzynia, runda Areny, misja, ekran, `visibilitychange`, `saveGame`), po reloadzie i drugiej sesji; komunikat z ODŚWIEŻ |
| **SAVE-09a** | **PASS** | `coins:"500"`: oryginał nietknięty; w pamięci 500 monet, poziom 12, 3 misje; NAPRAW → `.rescue` |
| **SAVE-09b** | **PASS** | `owned` jako obiekt: to samo (listy skinów nie da się pewnie odtworzyć, oryginał zostaje w `.rescue`) |
| **SAVE-09c** | **PASS** | Obcięty JSON: oryginał nietknięty; ZACZNIJ OD NOWA lub reset → `.rescue` |
| **SAVE-09d** | **PASS** | Dwie karty: starsza karta nie nadpisuje +500, przechodzi w `stale` z komunikatem; zmiana bez zdarzenia `storage` też wykryta |
| SAVE-09e / 09f | PASS | Odmowa `.bak` = brak commitu migracji; przerwany commit powtarza się identycznie |
| **R1** reset przy odmowie `.rescue` | **PASS** | (a) zapis z nowszej wersji zostaje, brak reloadu, komunikat; (b) z podłączoną chmurą i kartą `stale`: zapis lokalny i kopia konta nietknięte, brak reloadu |
| **R2** błąd lokalnego `setItem` przy lustrze | **PASS** | Stan niezapisany nie trafia do chmury; następny udany zapis synchronizuje się jak wcześniej |
| **R3** istniejący klucz `""` | **PASS** | Stan `corrupt` + komunikat; brak nadpisania po wszystkich autozapisach; ZACZNIJ OD NOWA → `.rescue === ""`, potem zapis; pusta kopia konta nienadpisana |
| **R4** odmowa odczytu `localStorage` | **PASS** | Stan `unavailable`, 0 zapisów, widoczny komunikat „Zapis nie działa”; wersja EN przetłumaczona |
| Kod kopii, chmura vs `stale`, EN komunikatów | PASS | Bez zmian względem rundy 1 |

## 5. Pełne QA (`PX01-30-qa-run-all.log`) — 571/576

| FAIL | Ocena | Dowód (`PX01-42-review2-variance.log`) |
|---|---|---|
| v19 „17 PAŹDZIERNIKA” | Znany, poza PX01, nie naprawiany | — |
| arena-bots „perf: low-end … under 12 ms” (15,96 ms) | Nie regresja: zależy od maszyny. Naprzemiennie: baza FAIL 3/3 (12,1–14,5 ms), kod finalny FAIL 1/3 (11,3–12,6 ms). Kod zapisu nie działa w pętli klatki. | `PX01-42` |
| v18 „balance … each lift” / „Sprint not a must-buy” | Losowość bota (±7 pkt, opisana w teście). Baza: 4/5 przebiegów PASS, kod finalny: 3/5 PASS. W rundzie 1 run-all: PASS. | `PX01-42`, `PX01-40-round…` |
| difficulty „casual ≤ 55% at EKSTREMALNA” (56%) | Losowość, 1 pkt nad progiem. Osobno: baza 47%, kod finalny 43%, oba PASS. | `PX01-42` |

Historycznie niestabilny jest też test M11 „food” (pozycje z `Math.random`, baza FAIL 4/4 w rundzie 1, `PX01-41`). W tym przebiegu: PASS.

## 6. Częściowa ponowna kontrola P00

- **CORE-SAVE: PASS** (emulacja).
- **CORE-ENERGY: PASS**, bez zmian.
- **CORE-LOOP: PASS** (emulacja).
- **CORE-ISOLATION: FAIL bez zmian.** Testy v22 dają PASS, a żadna zmieniona linia nie dotyka perków, `RUN_TOOLS`, `confirmRunSetup` ani `grantXp` (`PX01-64`). Sondy ekonomicznej A/B z P00 w tej sesji nie powtarzałem.

## 7. Ryzyka, których nie usunięto

1. **Atomowość tylko na poziomie jednego `setItem`.** Kolejność „`.bak`/`.rescue` z odczytem kontrolnym, potem zapis” sprawia, że przerwanie zostawia oryginał albo jego kopię.
2. **Nieaktualna karta traci swój niezapisany postęp** od chwili zapisu w innej karcie. Gracz widzi komunikat.
3. **W stanach blokady postęp sesji jest tylko w pamięci**, do decyzji gracza.
4. **Ochrona przed cofnięciem gry działa od tej wersji wzwyż.** Wdrożona produkcja (bez PX01) nadal nadpisałaby zapis v14+.
5. **Brak przycisku odzysku z `.bak`/`.rescue`.** Odzysk ręczny: `VH1.` + base64 wartości klucza → Profil → Kopia zapasowa.
6. **Chmura tylko na mocku.** Dwa urządzenia jednocześnie online: dotychczasowe last-writer-wins na koncie. Nowe w rundzie 2: przy pełnym `localStorage` chmura przestaje dostawać aktualizacje (świadomie: tylko zapisany stan idzie do chmury).
7. **Możliwa fałszywa blokada `invalid`** dla wartości, których gra nie powinna zapisywać. Nie powoduje utraty danych, naprawa jednym przyciskiem.
8. **`.bak`/`.rescue` nie są sprzątane** (kilka KB).
9. **Reset w Profilu przy `unavailable` jest niemożliwy** (kopia `.rescue` się nie uda): gra pokazuje komunikat „Brak miejsca na kopię”, którego treść jest przybliżona. Danych nie traci.
10. Bez backendu nie ma ochrony przed cheatem.
11. **NOT RUN:** fizyczne telefony, prawdziwe SDK, wiele urządzeń, żywa strona.
12. **Pliki tymczasowe poza repo:** przez błąd w moim poleceniu powstały pliki `/v18-final.txt`, `/diff-base.txt` i `/diff-final.txt` (wyniki testów, zawartość skopiowana do `PX01-42`). Zabezpieczenie środowiska nie pozwoliło mi ich usunąć — można je skasować ręcznie. Nie wpływają na grę ani na snapshot.

## 8. Rollback

- Przed commitem: `git checkout ed9c729 -- game.js qa/run-all.mjs qa/README.md CLAUDE.md docs/GAME_DESIGN.md docs/CHANGELOG.md` i usunięcie `qa/save-safety.mjs` (bez `reset --hard`).
- Po commicie: `git revert <commit>`.
- Zapisy graczy pozostają zgodne: schemat v13 bez zmian, a klucze `.bak`/`.rescue` są ignorowane przez stary kod.
- Cofnięcie przywraca jednak błędy SAVE-08/09 oraz R1–R4.

## 9. Trwałe zachowanie evidence (do decyzji)

**A (rekomendowane):** jeden commit na `px01-save-safety` (kod, test, dokumentacja, raport, manifest, `evidence/PX01-*`), potem push gałęzi i PR do przeglądu.
- Snapshot jest liczony z zawartości plików, więc commit go nie zmienia.
- Po commicie trzeba podmienić `revision` w manifeście (osobny mały commit) i ponownie uruchomić `check_evidence.py`.
- Evidence nie trafia na stronę: workflow publikuje tylko 3 pliki runtime.

**B:** ZIP z raportem, manifestem, testem i `evidence/`. Kontener jest ulotny.

---

## HANDOFF — NEXT CLAUDE SESSION

1. **Stan projektu.** PX01 jest zakończone lokalnie, łącznie z rundą 2 przeglądu (R1–R4), i czeka na przegląd właścicielki.
   - GO_CORE = STOP (CORE-ISOLATION FAIL, decyzja A/B/C);
   - GO_TOOLS = NO GO;
   - GO_RELEASE = STOP.
2. **Zakończone zadania.**
   - PX04 (PR #72), skille i prompty (PR #71), P00 (2026-10-17);
   - **PX01:** blokada zapisu (`SAVE_GUARD`, `readSave`, `verifyMigration`, `.bak`/`.rescue`, dwie karty, chmura);
   - runda 2: reset bez kopii przerywany, lustro tylko po udanym zapisie, `""` = uszkodzony zapis, komunikat `unavailable`.
3. **Git.**
   - Baza `ed9c729c3ef865f0e01c761d86de18ff58e4b70b`, gałąź `px01-save-safety` lokalnie w kontenerze, **bez commita**.
   - Brak PR.
   - Końcowy `game.js` `dc94d8d9…67aa`, snapshot `5feabda7…e577`.
   - Jeśli właścicielka zgodziła się na commit/push — sprawdź gałąź na GitHubie. Jeśli nie — materiał jest w ZIP lub patchu.
4. **Pliki.**
   - Zmienione: `game.js`, `qa/run-all.mjs`, `qa/README.md`, `CLAUDE.md`, `docs/GAME_DESIGN.md`, `docs/CHANGELOG.md`.
   - Nowe: `qa/save-safety.mjs` (107 testów), `VH_PREFLIGHT_REPORT.md`, `VH_PREFLIGHT_MANIFEST.json`, `.claude/vertical-hole/evidence/PX01-*` (runda 2 pod numerami bazowymi, runda 1 jako `*-round1`).
5. **Wyniki.**
   - CORE-SAVE PASS (emulacja), CORE-ENERGY PASS, CORE-LOOP PASS (emulacja);
   - CORE-ISOLATION FAIL (bez zmian), TOOLS-DEV NOT RUN (FAIL z P00);
   - QA 571/576: data EN + 4 losowe lub maszynowe, każdy z nich zachowuje się tak samo na bazie;
   - NOT RUN: urządzenia fizyczne, prawdziwe SDK, wiele urządzeń, żywa strona.
6. **Problemy i ryzyka.**
   - VH-02 (decyzja A/B/C), VH-01 (decyzja w sprawie panelu), VH-05 (domena zablokowana), P2 data EN;
   - niestabilne testy QA: perf arena-bots, balans v18, difficulty, M11 food — kandydaci do osobnego zadania stabilizacji (nie w PX01);
   - ryzyka 1–12 z sekcji 7.
7. **Kolejność dalszych prac:**
   - (0) przegląd PX01 i zgoda na commit/push/PR;
   - (1) decyzja A/B/C, potem PX02;
   - (2) decyzja w sprawie panelu, potem PX03;
   - (3) PX05 po odblokowaniu domeny;
   - po każdym zadaniu częściowe P00.
8. **Następne pojedyncze zadanie:** `PX02-ISOLATION.md`. Warunki startu:
   - pisemna decyzja właścicielki A/B/C;
   - PX01 zaakceptowany i dostępny w repo.
   - Bez decyzji — tylko weryfikacja i STOP.
9. **Prompt dla następnej sesji:**

```text
VERTICAL HOLE — NOWA SESJA CLAUDE CODE — PX02-ISOLATION

Repozytorium: https://github.com/klaudiamoscinska-art/vector-hole · gra: https://klaudiamoscinska-art.github.io/vector-hole/
Stan: P00 (2026-10-17, ed9c729) → PX01-SAVE wykonane 2026-10-17 wraz z drugą rundą przeglądu R1–R4 (SAVE_GUARD, verifyMigration, .bak/.rescue, dwie karty, chmura; reset bez kopii przerywany, lustro chmury tylko po udanym zapisie, pusty klucz = uszkodzony zapis, komunikat „Zapis nie działa”). qa/save-safety.mjs 107/107; QA 571/576 (data EN + niestabilne perf arena-bots / v18 balance / difficulty — tak samo na kodzie bazowym, PX01-42). PX01: [WPISZ: scalony w PR #__ / na gałęzi __ / tylko patch]. Raport: VH_PREFLIGHT_REPORT.md + VH_PREFLIGHT_MANIFEST.json + .claude/vertical-hole/evidence/PX01-* — jeśli ich nie ma w repo, traktuj przekazany raport jako kontekst, nie dowód.
Bramki: CORE-SAVE PASS (emulacja), CORE-ENERGY PASS, CORE-LOOP PASS (emulacja), CORE-ISOLATION FAIL (wspólny portfel: monety z kampanii kupują perki SKINS[].perks i RUN_TOOLS w Arenie), TOOLS-DEV FAIL. GO_CORE=STOP, GO_TOOLS=NO GO, GO_RELEASE=STOP.

DECYZJA WŁAŚCICIELKI (wymagana): [WPISZ A / B / C]. Bez niej: tylko ponowna weryfikacja CORE-ISOLATION (sonda A/B: 20 misji → monety → perk skina / Turbo start w Arenie) i STOP.

Zadanie: wyłącznie `.claude/vertical-hole-prompts/PX02-ISOLATION.md` dla wybranej opcji. Najpierw: git status/HEAD, CLAUDE.md, PX02-ISOLATION.md, .claude/vertical-hole/{ARENA_DISTRICT_CONTRACT,SAVE_MIGRATION_CONTRACT,CHANGE_SAFETY,EVIDENCE_FRESHNESS,PREFLIGHT_GATES}.md; odtwórz FAIL na aktualnym kodzie przed zmianą.
Zasady: najmniejsza odwracalna zmiana, trzy pliki runtime, zero zależności i build; nie odbieraj kupionych przedmiotów ani sald (migracja przez migrateSave + defaultSave; każdy zapis przez saveGame(), nie omijaj SAVE_GUARD; qa/save-safety.mjs musi dalej dać 107/107); bez energii; nie ruszaj DevPanel ani workflow. Destrukcyjna migracja → STOP i pytanie. Testy: ISO-A/B, BOOST-01..03, node qa/save-safety.mjs, node qa/v18.mjs, node qa/v22.mjs, node qa/run-all.mjs; niestabilne testy porównuj z kodem bazowym na tej samej maszynie (wzór: PX01-42). Logi pisz poza evidence i kopiuj po teście (snapshot haszuje niewskazane logi); manifest wg EVIDENCE_FRESHNESS; PASS/FAIL/NOT RUN; emulacja ≠ urządzenie. Bez commit/push/PR/merge/deploy bez zgody właścicielki. Nie wykonuj PX03–PX05.

Na końcu częściowa kontrola P00 (CORE-ISOLATION, CORE-SAVE, szybko CORE-LOOP/ENERGY) i:
HANDOFF — NEXT CLAUDE SESSION (1. stan projektu, 2. zakończone zadania i zakres, 3. bazowy/końcowy SHA, gałąź, commity, PR-y, 4. zmienione pliki, nowe testy, raporty, 5. PASS/FAIL/NOT RUN z ograniczeniami, 6. potwierdzone problemy i ryzyka, 7. kolejność dalszych prac, 8. następne pojedyncze zadanie i warunki startu, 9. gotowy samodzielny prompt dla kolejnej sesji — z tym samym obowiązkiem przekazania) oraz HANDOFF — GPT PROJECT COORDINATOR. Nie usuwaj informacji o niezakończonych zadaniach. Wskaż materiały do przekazania osobno.
```

**Materiały do przekazania osobno**, jeśli nie zostaną scommitowane:
- `VH_PREFLIGHT_REPORT.md`, `VH_PREFLIGHT_MANIFEST.json`;
- `.claude/vertical-hole/evidence/` (cały katalog);
- `qa/save-safety.mjs`;
- `PX01-50-diff.patch` (wszystkie zmiany).

## HANDOFF — GPT PROJECT COORDINATOR

**Zakres.** PX01-SAVE (VH-03) na `ed9c729`, lokalnie i bez commita. Po niezależnym przeglądzie dodano drugą rundę, która usunęła cztery luki R1–R4.

**Problem.**
- Runda 1: zapis gracza mógł zostać po cichu zastąpiony — przez zapis z nowszej wersji, złe pole, obcięty JSON albo drugą kartę.
- Runda 2:
  - R1: reset profilu kasował zapis i kopię w chmurze nawet bez udanej kopii ratunkowej;
  - R2: chmura dostawała stan, który nie zapisał się lokalnie;
  - R3: pusty istniejący zapis traktowano jak brak zapisu i nadpisywano;
  - R4: przy niedostępnym storage gracz nie dostawał komunikatu.

**Naprawa.**
- Jedna ścieżka zapisu z blokadą i jawną decyzją gracza (kopia `.rescue`).
- Migracja zapisywana dopiero po weryfikacji i kopii `.bak`.
- Ochrona przed starszą kartą i przed nadpisaniem nieczytelnej kopii w chmurze.
- Runda 2 to kilkanaście linii: przerwanie resetu bez kopii, lustro tylko po udanym zapisie, `null` ≠ `""`, nowy komunikat.
- Bez zmiany schematu, gameplayu i ekonomii.

**Dowody.**
- `qa/save-safety.mjs`: kod bazowy 46/107; R1–R4 na kodzie z rundy 1 dają 9 FAIL; kod finalny 107/107.
- Pełne QA 571/576. Pięć FAIL-i: znana data EN oraz cztery testy niestabilne lub zależne od maszyny (perf, balans v18, difficulty). Każdy z nich sprawdziłem naprzemiennie na kodzie bazowym — zachowują się tak samo, więc to nie regresja.
- Kod niezmieniony podczas testów. Snapshot `5feabda7…e577` formalnie aktualny.
- Emulacja headless; urządzenia fizyczne i prawdziwe SDK: NOT RUN.

**Ryzyko.**
- Niskie dla danych: tylko dodatkowe klucze, rollback bezpieczny dla zapisów.
- UX: rzadki fałszywy komunikat „część zapisu uszkodzona”; starsza karta traci swój niezapisany postęp.
- Przy pełnym storage chmura przestaje się aktualizować (świadomie).
- Produkcja jest chroniona dopiero po wdrożeniu.

**Gotowość:** READY FOR REVIEW. CORE-SAVE = PASS (emulacja). GO_CORE = STOP (CORE-ISOLATION, decyzja A/B/C).

**Decyzje dla właścicielki:**
1. Commit, push i PR dla PX01 razem z evidence (rekomendacja A).
2. A/B/C dla VH-02.
3. VH-01, panel DEV.
4. Ewentualny UI odzysku `.rescue`.
5. Ewentualne osobne zadanie stabilizacji niestabilnych testów QA.

**Następny krok:** PX02-ISOLATION po decyzji. Kolejka: PX01 (przegląd) → PX02 → PX03 → PX05, po każdym częściowe P00.
