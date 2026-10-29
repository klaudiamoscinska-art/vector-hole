# DOCS-1 — audyt dokumentacji, skilli i instrukcji Claude Code (raport)

**Data:** 2026-10-29 · **Repo:** `klaudiamoscinska-art/vector-hole` · **Baza:** `origin/main` = `9f92a2df53492030a7c12c6127a08df0c25eff59` (sprawdzone `git fetch` przed pracą; żywe wydanie `v/9f92a2df5349/`, wdrożenie `success`)
**Gałąź:** `docs1-documentation-sync` · **Zakres:** tylko dokumentacja i instrukcje — bez zmian w `game.js`, `style.css`, `index.html`, `qa/`, `.github/scripts/`, workflow, pakietach skilli/promptów, zapisie v13 i ekonomii.

## Werdykt: **PR GOTOWY DO ODBIORU**

Dokumentacja zgadza się teraz z grą na `9f92a2d` w sprawdzonych punktach: 240 misji, 12 dzielnic, zapis v13, ES modules przez HTTP, publikacja wersjonowana. Kolejne kroki od gałęzi do produkcji opisano bez sprzeczności (z jedną decyzją dla właścicielki, §4). Wznowienie po utracie sesji ma teraz procedurę. Kontrole dokumentacji: **PASS** (§9). Testów rozgrywki nie uruchamiano, bo kod gry się nie zmienił (**NOT RUN**, świadomie — §9).

## 1. Zakres rzeczywiście sprawdzony

| Materiał | Jak |
|---|---|
| `CLAUDE.md`, `README.md`, `docs/claude/TOKEN_GUIDE.md`, `HANDOFF_TEMPLATE.md`, `DEPLOYMENT.md`, `SKILLS_PACK.md`, `.github/pull_request_template.md`, `VH_PREFLIGHT_REPORT.md` | przeczytane w całości |
| `docs/GAME_DESIGN.md` (§1–2, §4, §5, §6, §6a, §7), `docs/claude/ARCHITECTURE.md` (spis + „Runtime files”, „Deliberately not built”), `docs/E3_ROLLBACK_PLAN.md` (słownik, §0), `docs/CHANGELOG.md` (nagłówki + wybrane wpisy), raporty `BALANCE1_REPORT`, `MOBILE_PERF1_REPORT`, `CONTENT1_AUDIT` (nagłówki, werdykty, §merge) | sekcjami |
| `qa/README.md` (lista zestawów, Windows), `qa/instructions.mjs`, `qa/run-all.mjs`, `qa/screens.mjs` | przeczytane / porównane z plikami w `qa/` |
| Pakiet: `WORKFLOW.md`, `PREFLIGHT_GATES.md`, `CHANGE_SAFETY.md` — całe; `PROJECT_CHARTER.md`, `START_PROMPT.md`, `vertical-hole-prompts/README.md`, nagłówki 7 promptów P | czytane / częściowo |
| **22 skille** `vh-*` | wszystkie: frontmatter, wspólny blok wejścia (identyczny, 1376 B w każdym), skan konfliktów (`npm`/bundler/`VH_DEV_CONSOLE_ONLY`/`M00`/`perks`/merge/liczba skilli); `vh-release-manager` i `vh-director` przeczytane w całości |
| Wszystkie 94 śledzone pliki `.md` (bez folderu evidence) | automatyczna kontrola 1351 odwołań do ścieżek i linków |
| Nazwy funkcji i stałych z 6 dokumentów | porównane z `game.js`, `qa/*.mjs`, skryptem wydania — wszystkie istnieją (poza celowo opisanym `VH_DEV_CONSOLE_ONLY` z pakietu) |
| Kod (fragmenty) | `SAVE_SCHEMA_VERSION = 13`, `DISTRICTS`, `Monetization`/`PORTAL_SDKS`, ceny Warsztatu i wzmocnień, `CONFIG` monet/XP, `RETENTION`, ścieżki workflow, metadane `index.html` |
| GitHub (tylko odczyt) | deploymenty `github-pages` (statusy `aa4bc7d`, `9f92a2d`), żywy `index.html` |

Nie audytowano: 107 plików `.claude/vertical-hole/evidence/` (logi historyczne PX01/PX02), pełnej treści 16 promptów P i 5 PX, `WSZYSTKIE_PROMPTY.md` (generowany), plików SVG w `design/`. Pakietowych `scripts/validate.py` i `install.py` nie ma w repo (są w ZIP) — **NOT RUN**.

## 2. Błędy krytyczne i istotne

Krytycznych (mogących uszkodzić produkcję lub zapis) — **brak**. Istotne:

1. **Brak procedury wznowienia pracy po utracie sesji.** Sesje z VS Code i Remote Control startują w `.claude/worktrees/bridge-*` na gałęzi `worktree-bridge-…` (tak zaczęła się ta sesja; `git worktree list` pokazuje 19 drzew). Instrukcje nie mówiły, by tam szukać pracy — nowa sesja mogła zacząć etap od zera albo pracować w złym drzewie.
2. **HANDOFF istniał tylko w czacie** i nie miał pól: worktree, stan push, niedokończone zadania, punkt wznowienia, prompt kontynuacyjny.
3. **Szablon PR kazał „podbić `SAVE_SCHEMA_VERSION` + gałąź w `migrateSave()`”** przy zmianie zapisu — sprzeczne z niezmiennikiem „SAVE stays 13, zmiana schematu = decyzja właścicielki”.
4. **Merge: reguła a praktyka.** `CLAUDE.md`: „the owner merges”. W praktyce VISUAL-1, CONTENT-1, BALANCE-1 i MOBILE-PERF-1 scaliła sesja Claude na jawną zgodę w prompcie etapu. Żaden dokument nie opisywał, kiedy to wolno i co dzieje się po merge (auto-deploy, weryfikacja).
5. **`README.md` (opis do sklepu/portalu): „60 misji kampanii w 6 dzielnicach”** — gra ma 240 misji w 12 dzielnicach. To samo w `index.html` (→ kolejka GAME-READY, §6).
6. **`README.md`: „SDK portalu ładuje się automatycznie, reklamy … działają od razu”** — w kodzie adapter dociąga SDK tylko na hoście portalu; integracji nigdy nie sprawdzono w Poki Inspector ani w narzędziach CrazyGames.

## 3. Nieaktualne informacje

| Gdzie | Było | Stan faktyczny |
|---|---|---|
| `README.md` | 16 zrzutów `qa/screens.mjs` | ok. 35 (`01`–`35`) |
| `README.md` | „`CLAUDE.md` — architektura kodu” | architektura w `docs/claude/ARCHITECTURE.md` (od OPT-2) |
| `README.md` | wydania „z ostatnich 30 dni” | według historii publikacji: 30 dni + 5 ostatnich + żywe (`RETENTION`, L1) |
| `docs/GAME_DESIGN.md` | tytuł „stan v22”; „Architektura kodu: `CLAUDE.md`” | opisuje v23 + etapy do MOBILE-PERF-1; `docs/claude/ARCHITECTURE.md` |
| `docs/GAME_DESIGN.md` §6 | brak zestawów po FTUE-3 | dopisano odsyłacz: responsive/devices/visual1/content/balance1/perf1/instructions |
| `docs/claude/TOKEN_GUIDE.md` | `game.js` ~985 KB, `CLAUDE.md` ~16 KB | 1 069 704 B; 15 085 B (pomiar `wc -c`) |
| `design/assets/OBJECT_CATALOG_SPEC.md` | „Kampania ma dziś 60 misji” | 240 misji w 12 dzielnicach |
| `design/*/…_SPEC.md` | `vector_hole_asset_bible.svg`, `MISSION_BOARD_SPEC.md` bez katalogu | `design/reference/asset_bible.svg`, `design/gameplay/MISSION_BOARD_SPEC.md` |
| `docs/BALANCE1_REPORT.md` §11 | „merge zablokowany” | PR #83 scalony `aa4bc7d` (2026-10-26), deploy `success` — dopisana aktualizacja statusu |
| `docs/MOBILE_PERF1_REPORT.md` | werdykt „PR gotowy do odbioru” | PR #84 scalony `9f92a2d` (2026-10-29), deploy `success` — dopisana aktualizacja |
| `VH_PREFLIGHT_REPORT.md` | wygląda na bieżący P00 | raport CONTENT-1 na bazie `405994f` — oznaczony jako historyczny |
| Pakiet promptów (README, P04–P14) | kolejka zadań z 2026-10-17 | większość obszarów objęły już etapy właścicielki — mapa w `SKILLS_PACK.md` |

Historia (CHANGELOG, wyniki pomiarów w raportach, logi evidence) — **świadomie bez zmian**; dopisano tylko krótkie notki statusu.

## 4. Sprzeczne instrukcje

| Konflikt | Rozstrzygnięcie |
|---|---|
| „The owner merges” vs. scalanie przez Claude na zgodę w prompcie | `CLAUDE.md`: wyjątek tylko przy **jawnej** autoryzacji tego jednego PR w bieżącym prompcie (nigdy domniemanej, nigdy przeniesionej na inny PR/etap); kroki w `DEPLOYMENT.md` „Stage flow”. Zabezpieczenia bez zmian: brak pushu na `main`, brak `workflow_dispatch`, przegląd GPT i zgoda właścicielki przed merge. **Decyzja dla właścicielki:** CONTENT-1 pominął przegląd GPT za jawną zgodą w prompcie — obecna reguła tego nie przewiduje. Nie dopisałam możliwości pominięcia; jeśli ma istnieć, musisz ją zatwierdzić. |
| `CHANGE_SAFETY.md` „nie rób automatycznego commitu ani push” vs. prompty etapów zlecające commit + push + PR | `SKILLS_PACK.md`: prompt etapu wygrywa dla gałęzi etapu; `main` nigdy |
| `vh-release-manager` „Twarde veto GitHub Pages”, `PREFLIGHT_GATES.md` weto 2–4 | opisują stan sprzed PX01/PX02/PX04; w `SKILLS_PACK.md` oznaczone jako historia: potwierdzić, nie naprawiać ponownie |
| `vh-director`: „21 skilli”, `docs/decision-log.md` | jest 22; pliku nie ma — decyzje są w GDD §7, CHANGELOG i raportach |
| `CLAUDE.md` „P00 przed nowymi funkcjami → `VH_PREFLIGHT_REPORT.md`” vs. praktyka etapów (tylko CONTENT-1 zapisał P00) | `SKILLS_PACK.md` „P00 inside a stage”: tabela bramek z własnych przebiegów etapu na bazie i kandydacie (mapa bramka → zestaw), bez drugiego pełnego `run-all`; etap tylko dokumentacyjny nie wymaga P00 |

Konflikty, które już były opisane (DevPanel/PX03, zasada trzech plików, `M00`, rady testowe pakietu, data `PLATFORM_RULES.md`), zostają bez zmian.

## 5. Wykonane poprawki (13 plików, 1 nowy)

| Plik | PRZED | PO |
|---|---|---|
| `CLAUDE.md` | merge tylko przez właścicielkę, bez wyjątku; preflight bez worktree; brak `qa/instructions.mjs` w komendach | wąski wyjątek na jawną zgodę dla jednego PR; preflight z `git worktree list` i wznowieniem; P00 w etapie; wybór 1–3 skilli; komenda `qa/instructions.mjs`; 14 085 → 15 085 B (limit 20 000) |
| `docs/claude/DEPLOYMENT.md` | tylko system wydań | + „Stage flow”: audyt → commit → push → PR → odbiór GPT → merge → automatyczny deploy → kontrola produkcji; merge poza ścieżkami wdrożenia nic nie publikuje |
| `docs/claude/HANDOFF_TEMPLATE.md` | 7 pól, tylko czat | + worktree, push, NIEDOKOŃCZONE, PUNKT WZNOWIENIA, PROMPT KONTYNUACYJNY; gdzie trzymać HANDOFF; procedura „Resuming” (worktree, gałąź, PR, niezacommitowane zmiany bez `reset`/`stash`) |
| `docs/claude/SKILLS_PACK.md` | 5 konfliktów | + 3 konflikty, tabela wyboru skilli (w tym DEVICE-QA, PORTAL-1, RELEASE), mapa P00 w etapie, status kolejki promptów pakietu |
| `docs/claude/TOKEN_GUIDE.md` | rozmiary z 2026-10-24 | rozmiary zmierzone 2026-10-29, kontrakt wejścia skilli raz na sesję, kontrole dopasowane do zmiany |
| `.github/pull_request_template.md` | „podbij `SAVE_SCHEMA_VERSION`” | SAVE nadal 13, zmiana tylko za decyzją; PASS/FAIL/NOT RUN względem bazy; sekcja „Odbiór i merge”; pole „tylko dokumentacja” |
| `README.md` | 60 misji / 6 dzielnic, SDK „działa od razu”, 16 zrzutów | 240 / 12, uczciwy stan SDK (PORTAL-1), ok. 35 zrzutów, lista dokumentów |
| `docs/GAME_DESIGN.md` | „stan v22”, architektura w `CLAUDE.md` | aktualny nagłówek, poprawny odsyłacz, późniejsze zestawy QA |
| 2 specyfikacje `design/` | 60 misji, błędne ścieżki | 240/12, pełne ścieżki |
| `BALANCE1_REPORT.md`, `MOBILE_PERF1_REPORT.md`, `VH_PREFLIGHT_REPORT.md` | statusy z chwili PR | dopisane notki statusu (merge, deploy, „raport historyczny”) |
| `docs/DOCS1_AUDIT_REPORT.md` | — | ten raport |

**Liczba poprawionych problemów: 22** (6 istotnych z §2, 12 nieaktualnych z §3, 4 rozstrzygnięte konflikty z §4; jeden konflikt — pomijanie przeglądu GPT — zostaje decyzją dla właścicielki).

## 6. Świadomie pozostawione

- **Pakiety skilli i promptów — bez ręcznych zmian** (reguła: tylko z oficjalnych ZIP). Nieścisłości pakietu (21 vs 22, `decision-log.md`, stare weta, `SKINS.perks`) opisano w `SKILLS_PACK.md`. Każdy skill każe przeczytać na wejściu sześć wspólnych plików (~32 KB). Dodałam regułę „raz na sesję, tylko przy pracy z kodem lub zapisem”. Skrócenie samych skilli wymaga nowej wersji pakietu.
- **Kolejka GAME-READY (`index.html` — nie zmieniany w tym PR):**
  1. `meta name="description"` i JSON-LD `description`: „60 misji kampanii” → 240 misji, 12 dzielnic.
  2. JSON-LD `gamePlatform`: „Android”, „iOS” — nie ma aplikacji natywnych (gra w przeglądarce, także mobilnej); do decyzji.
  3. `viewport` z `maximum-scale=1.0, user-scalable=no` — do oceny dostępności na portalach (`vh-mobile-accessibility`), nie jest błędem faktów.
- `qa/README.md` „Running on Windows”: `check_pages_workflow.py` wołany jako `python3`. Zgodne z kodem testu, a znany FAIL środowiska jest już opisany. Zmiana testu jest poza zakresem DOCS-1.
- `docs/claude/ARCHITECTURE.md` i `docs/E3_ROLLBACK_PLAN.md` — sprawdzone wyrywkowo: nazwy funkcji istnieją, odwołania działają, rozbieżności nie znalazłam. Bez pełnej rewizji zdanie po zdaniu.
- `CHANGELOG` — DOCS-1 nie zmienia gry, więc bez wpisu (jak OPT-2).

## 7. Skille i tokeny

- Zawsze ładowane: `CLAUDE.md` 15 085 B (+1 000 B wobec bazy — wyjątek merge, preflight worktree, P00 w etapie; reszta trafiła do plików na żądanie), opisy 22 skilli 6 688 B (bez zmian).
- Na żądanie: kontrakt wejścia skilli ~32 KB. Teraz czytany raz na sesję i nie przy zadaniach bez kodu. Wcześniej czytany przy każdym kolejnym skillu.
- Zbędne powtórki: P00 jako tabela z przebiegów etapu zamiast drugiego pełnego `run-all`. Etap dokumentacyjny bez QA rozgrywki. Kolejka promptów pakietu z mapą „już zrobione przez etap X”, żeby nie powtarzać P06B/P09/P11 itd.
- Oszczędności **nie podaję w procentach** — nie mierzyłam zużycia tokenów sesji. Powyższe to rozmiary plików (`wc -c`).

## 8. Bezpieczeństwo Git i SAVE

- Ta sesja: gałąź `docs1-documentation-sync` z `origin/main`. Bez pushu na `main`, bez merge, bez `workflow_dispatch`, bez force-push, `reset`, `stash` ani `clean`. Pliki dodawane do commitów po sprawdzeniu listy.
- Merge tego PR **niczego nie wdroży**: zmienione pliki leżą poza ścieżkami workflow (`index.html`, `style.css`, `game.js`, `**.js`, `**.css`, `.github/scripts/**`, workflow). W repo jedyne `.js`/`.css` to `game.js` i `style.css`.
- SAVE: zero zmian w kodzie. Dokumenty nadal mówią: klucz `vectorHoleSave_v1`, schemat 13, `saveGame()` jedyną ścieżką zapisu, PX01/PX02 bez zmian. Szablon PR nie każe już podbijać schematu.
- Nowe zasady wzmacniają ochronę: wznowienie bez `reset`/`checkout --`/`stash`, zgoda na merge tylko dla jednego PR, po merge kontrola produkcji.

## 9. Walidacja

| Kontrola | Baza `9f92a2d` | Po zmianach | Log |
|---|---|---|---|
| `node qa/instructions.mjs` (36 reguł, limit, ścieżki, pola HANDOFF) | 4/4 PASS (85 odwołań) | **4/4 PASS** (107 odwołań) | `qa/out/docs1/instructions-*.log` |
| `python .claude/vertical-hole-prompts/check_prompts.py` | PASS | **PASS** (pakiet bez zmian) | `qa/out/docs1/check_prompts.log` |
| `python .claude/vertical-hole/tools/check_pages_workflow.py --repo .` | PASS | **PASS** (workflow bez zmian) | `qa/out/docs1/check_pages_*.log` |
| Kontrola ścieżek/linków we wszystkich `.md` (skrypt jednorazowy; ścieżki w backtickach + linki markdown) | 1276 odwołań, 23 nierozwiązane wpisy | **1353 odwołania, 20 wpisów**: 16 to `qa/out/*` (git-ignored, z założenia), 4 świadome — `SKILL.md` jako nazwa ogólna (pakiet, `TOKEN_GUIDE.md`), `docs/decision-log.md` w `vh-director` (pakiet, opisane), `MISSION_BOARD_SPEC.md` w tabeli specyfikacji pod pełną ścieżką. Błędne nazwy `.svg` poprawiono ręcznie — skrypt ich nie łapał | `qa/out/docs1/linkcheck-after.log` |
| Nazwy funkcji/stałych z dokumentów vs kod | — | **PASS** | — |
| `git diff --name-only origin/main` — tylko `.md` + szablon PR | — | **PASS** (zero plików runtime, `qa/`, `.github/scripts/`, workflow) | — |
| QA rozgrywki (`run-all`) | — | **NOT RUN** — kod gry, testy i ich progi bez zmian | — |

## 10. Rekomendacje przed PORTAL-1

1. **GAME-READY:** poprawić metadane `index.html` (§6), uzupełnić `CONFIG.legal` (wydawca, kontakt), sprawdzić politykę prywatności.
2. **DEVICE-QA:** lista z `MOBILE_PERF1_REPORT.md` §9 na fizycznych iPhone/Android (dotąd **NOT RUN**). Skille: `vh-qa-automation` + `vh-mobile-accessibility`.
3. **PORTAL-1:** pierwsze prawdziwe testy adaptera `Monetization` w Poki Inspector i narzędziach CrazyGames. Przedtem ponownie sprawdzić `PLATFORM_RULES.md` (z 2026-10-16) w oficjalnych dokumentach. Skill: `vh-portal-integrations` (+ `vh-monetization`, `vh-legal-risk`).
4. **Decyzje właścicielki:** (a) czy prompt etapu może pominąć przegląd GPT (§4); (b) PX03 — panel deweloperski w produkcyjnym `game.js`; (c) aktualizacja pakietu skilli do wersji z krótszym kontraktem wejścia, jeśli pojawi się oficjalna.
5. **RELEASE:** pełny PX05 (test na żywo bez mocków) i `vh-release-manager`; w raporcie wydania tabela P00 według mapy z `SKILLS_PACK.md`.

## HANDOFF

Zob. opis PR (HANDOFF_CLAUDE i HANDOFF_GPT).
