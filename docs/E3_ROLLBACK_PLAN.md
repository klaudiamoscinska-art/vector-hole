# E3_ROLLBACK_PLAN — rollback wersjonowanych wydań GitHub Pages

> **Dotyczy:** workflow `.github/workflows/deploy-pages.yml` (build → deploy → verify-live) i skryptu `.github/scripts/assemble-release.mjs` wprowadzonych przez PR #76 (E2 + E3 + L1-R1).
> **Źródło:** projekt z przeglądu K2F-R (2026-10-22), sprawdzony z kodem w K2F-1. Każde twierdzenie o zachowaniu skryptu wskazuje dowód z próby K2F-R (S0–S13, `qa/release.mjs`).
> **Zasada:** żadnej procedury z tego dokumentu nie uruchamia się bez zgody właścicielki. Workflow nigdy nie cofa niczego sam.

## Słownik

| Pojęcie | Znaczenie |
|---|---|
| **BASE** | `https://klaudiamoscinska-art.github.io/vector-hole/` (`base_url` z `configure-pages`; widoczny w step summary „Live site before deploy”). |
| **wydanie** `v/<id>/` | Niezmienny katalog: graf skryptów i CSS jednego commita z `main`; `id` = pierwsze 12 hex SHA. |
| **żywe wydanie (anchor)** | `v/<id>/`, z którego ładuje żywy `index.html`. Odczyt: `curl -fsS "${BASE}index.html?vh-check=$(date +%s)" \| grep -oE 'v/[0-9a-f]{12}/' \| head -1` |
| **BAD** / **GOOD** | Wadliwe żywe wydanie / ostatnie dobre, do którego wracamy. |
| **root klasyczny** | `game.js` + `style.css` w katalogu głównym. Zamrożone bajty z `63b50d0` (piny niżej) dla przeglądarek ze starym `index.html`. Nigdy się nie zmieniają. |
| **ledger** | Rekordy deploymentów środowiska `github-pages` (GitHub REST, tylko GET). Mówi, co i kiedy faktycznie opublikowano. Na jego podstawie działa retencja. |
| **piny** | `FROZEN` w skrypcie: `index.html` klasyczny `6683fc52d0c2dc188f9b9496570f89653c0ccbbae7a04223b4d2a073fabd48be`, `game.js` `5011c0e4047c20ff96b22ae1da84746229f0cf99a738287d1a79414134392664`, `style.css` `b5eb39fef65635eeb75c91de0c7b52c42dedd640e5b4b920bbbf95d4f3611b61`. |
| **kody wyjścia skryptu** | `0` OK · `1` treść wydania / niespójność (STOP) · `2` błąd wywołania (STOP) · `3` infrastruktura: sieć, HTTP 401/403/404/429/5xx, rekord w toku (STOP) · `4` `main` poszedł dalej, ten run nic nie publikuje (zielony, `deploy=false`). |

Gdzie szukać danych w czasie incydentu: **Actions → run → Summary** (sekcje „Live site before deploy” i „Release artifact”: żywe id przed deployem, tabela zachowanych wydań z przyczynami, ostatnia publikacja według ledgera, lista plików z SHA-256) oraz **Settings → Environments → github-pages** (historia deploymentów z SHA).

## 0. Zasady nadrzędne (twarde „nigdy”)

| # | Nigdy | Dlaczego (dowód) |
|---|---|---|
| N1 | **`git revert` PR #76** (merge, squash ani rebase) | Wraca klasyczny workflow i publikuje sam root, bez `v/`. Przeglądarka z wersjonowanym `index.html` w cache dostaje 404 na `v/<id>/game.js` i `style.css`, więc gra nie startuje (S8). Ponowne wprowadzenie E3 jest potem zablokowane: opublikowane `v/<id>/` leży poza łańcuchem ery i ledger daje STOP „off main's first-parent chain”, dopóki to wydanie nie wypadnie z okna 30 dni **i** z 5 ostatnich publikacji (S8). |
| N2 | **Cofnięcie samego workflow** (`c7a0eaa`) | Klasyczny workflow kopiuje root repo, a tam `game.js` jest już modułem. Nadpisuje zamrożony root, więc klasyczny `index.html` dostaje `SyntaxError: Unexpected token 'export'` (S9). Potem precheck odrzuca każdy build (żywy klasyczny `index.html` ≠ pin), aż do decyzji o pinach (S9). |
| N3 | **Re-run runu #185** (`fb297cb`) ani żadnego klasycznego runu | Re-run używa workflow z commita tego runu (klasycznego): publikuje sam root i usuwa wszystkie `v/`, z pominięciem precheck, ledgera i kontroli. Wersjonowany `index.html` z cache dostaje 404 (S11). Następny build E3 to odbudowuje (S11), ale okno 404 i ominięcie zabezpieczeń są nieakceptowalne. |
| N4 | **Przepisywanie historii `main`** (force-push, reset, usunięcie commita z łańcucha) | Opublikowane wydanie znika z łańcucha first-parent. Ledger daje STOP „cannot be rebuilt” i żaden build nie przechodzi (S10). |
| N5 | **Usuwanie lub edycja `v/<id>/`**, zmiana pinów `FROZEN`, root `game.js`/`style.css`, przenoszenie `index.html` | Strony w cache muszą dostać dokładnie swoje bajty. Zmiana bajtów pod istniejącym id daje STOP (immutability). |
| N6 | **Przełączenie Settings → Pages → Source** na „Deploy from branch” | Rekord innej aplikacji niż `github-actions` po `eraEpoch` daje STOP (H1) w każdym kolejnym buildzie. |
| N7 | **`--no-ledger` / `--allow-non-tip` w produkcji** i **ręczna publikacja** (upload artefaktu poza workflow, inny workflow, „Deploy from branch”) | `--no-ledger` jest odrzucane pod Actions. Publikacja poza workflow nie zostawia rekordu w ledgerze albo zostawia rekord innej aplikacji, więc następny build zrobi STOP (S7, H1). Ręczny upload może też nie zawierać wymaganych `v/<id>/`. |
| N8 | **Anulowanie joba `deploy` w trakcie** i „naprawianie” rekordów deploymentów zapisami do API | Rekord w `waiting/queued/pending/in_progress` młodszy niż 6 h blokuje każdy build, także rollback (S2). Workflow ma tylko `deployments: read`. |
| N9 | **Rollback do kodu z niższym `SAVE_SCHEMA_VERSION`** niż najwyższy opublikowany (dziś wszędzie `13`) | PX01: zapis „z przyszłości” jest wstrzymany (nie nadpisany), ale gracz gra z pamięci i postęp się nie zapisuje. |

Re-run samego joba `deploy` ze starszego runu E3 jest **bezpieczny, ale bezużyteczny**: guard odmawia, jeśli żywy `index.html` zmienił się od buildu (S12), a artefakt `release-files` i tak wygasa po 1 dniu.

## 1. Mechanizm standardowy: commit naprzód („forward commit”)

Jedyny standardowy rollback E3 to **nowy commit na `main`**, który przywraca treść runtime ostatniej dobrej wersji, przy zachowanym E3 (skrypt, workflow, piny). Zwykły push go publikuje: powstaje nowe `v/<C>/`, poprzednie `v/` (również wadliwe) zostają, a `index.html` wskazuje `v/<C>/`.

### 1.1 Warianty

| Wariant | Treść commita | Kiedy | Dowód |
|---|---|---|---|
| **F1** — powrót do ostatniego dobrego wydania wersjonowanego | `git checkout <GOOD_SHA> -- index.html game.js style.css` (oraz każdy inny plik z grafu modułów, jeśli E4 go doda — listę daje `manifest`/step summary GOOD) | Przed wadliwym B istnieje dobre wydanie wersjonowane | S4: PASS (bajty `v/<C1>/game.js` = `v/<M>/game.js`, start gry, ten sam zapis) |
| **F2** — klasyczny runtime sprzed E2 w ramach E3 | `git checkout 63b50d0f470272aed8734c7854dda24b4f61e712 -- index.html game.js` (`style.css` bez zmian) | (a) **pierwszy rollback po pierwszym deployu E3** (nie ma wcześniejszego wydania wersjonowanego); (b) problem z ładowaniem ES module (aplikacja z ikony, stary WebKit) | S13: PASS (pierwszy rollback: `v/<M>/` zostaje, nowe `v/<F2>/` klasyczne, start z `v/<F2>/game.js`, ten sam zapis); S4b: PASS; `qa/release.mjs` „rollback 5” |

F2 **nie** wyłącza E3. Root zostaje zamrożony, a klasyczny `game.js` trafia do `v/<F2>/game.js` jako skrypt klasyczny (`<script src="v/<F2>/game.js">`).

### 1.2 Kontrakt, który commit naprzód musi spełnić (sprawdzony na prawdziwym skrypcie: S4, S4b, S13)

1. C jest **tipem `main`** w chwili buildu. Jeśli nie, exit 4 i nic się nie publikuje (publikuje nowszy run).
2. C i każdy commit łańcucha first-parent od C wstecz do każdego wydania, które ledger każe zachować, zawierają `.github/scripts/assemble-release.mjs`. **Łańcuch ery urywa się na pierwszym commicie bez tego pliku**, dlatego revert PR (N1) zrywa go na zawsze.
3. `index.html`: dokładnie jeden `<script src="…">` (podwójne cudzysłowy, atrybuty tylko `src/type/defer/async`, `type` = `module`, `text/javascript` albo brak), dokładnie jeden `<link rel="stylesheet" href="…">` (podwójne cudzysłowy), brak `<base>`, brak kodu inline (dozwolone tylko bloki JSON/JSON-LD), żadnych innych atrybutów URL poza `data:` i `#…`.
4. Graf skryptów: tylko względne `.js`, bez `import()`, `import.meta`, specyfikatorów gołych i absolutnych, atrybutów importu, cykli, ścieżek ukrytych, `v/`, `qa/`, `docs/`, `design/`, `.github/`…, symlinków; każdy plik się parsuje (moduł albo skrypt klasyczny).
5. CSS: bez `@import`, `url()` tylko `data:`.
6. Żadnego mechanizmu QA (`__qa…`, `installQaBridge`, `qaBridgeInit`, `waitForQaBridge`, `addInitScript`) w grafie ani w `index.html`.
7. `FROZEN` (rev i piny) bez zmian. Root w artefakcie pochodzi z `63b50d0`, nie z drzewa C.
8. Retencja ≤ 60 wydań i ≤ 400 MB; id (12 hex) nie koliduje z innym commitem.
9. Precheck żywej strony przechodzi; ledger jest czytelny i zgodny z żywą stroną; każde wydanie wymagane przez ledger leży na łańcuchu i daje się odbudować.
10. Commit **zmienia plik ze ścieżek `on.push.paths`** (F1/F2 zmieniają `game.js`/`index.html`, więc tak). Commit tylko w `docs/`, `qa/` albo `CLAUDE.md` nic nie publikuje. Ponowne opublikowanie bez zmian treści wymaga `workflow_dispatch` na `main` (osobna zgoda).

### 1.3 Procedura wspólna F1/F2

| Krok | Działanie | Zgoda |
|---|---|---|
| 1 | Ustalić **BAD** (żywe id: komenda ze słownika albo step summary) i **GOOD**. F1: poprzednie wydanie z rekordem `success` (Settings → Environments → github-pages albo step summary „last publication” wcześniejszego runu), sprawdzone na urządzeniu. F2: `63b50d0f470272aed8734c7854dda24b4f61e712`. | — |
| 2 | Gałąź z aktualnego `main`: `git fetch origin main && git checkout -b rollback/<BAD_ID> origin/main` | — |
| 3 | F1: `git checkout <GOOD_SHA> -- index.html game.js style.css`. F2: `git checkout 63b50d0f470272aed8734c7854dda24b4f61e712 -- index.html game.js`. Nic więcej. | — |
| 4 | Lokalna kontrola bez publikacji: `mkdir -p /tmp/frozen && git show 63b50d0:game.js > /tmp/frozen/game.js && git show 63b50d0:style.css > /tmp/frozen/style.css`, potem `node --experimental-vm-modules .github/scripts/assemble-release.mjs assemble --source worktree --repo . --id rollbacktest --frozen-dir /tmp/frozen --no-live-anchor --out /tmp/rb` i `node --experimental-vm-modules .github/scripts/assemble-release.mjs verify --release /tmp/rb`; oba exit 0. `grep -n 'SAVE_SCHEMA_VERSION =' game.js` ≥ najwyższego opublikowanego (dziś `13`). | — |
| 5 | Commit, push gałęzi, PR do `main` (nie Draft; tytuł „rollback E3: BAD → GOOD”), bez innych zmian. | **właścicielka** (push, PR) |
| 6 | Merge PR = publikacja produkcyjna (zwykły push na `main`). | **właścicielka** (+ odbiór GPT, jeśli czas pozwala) |
| 7 | Monitoring runu: step summary pokazuje `Current release: v/<C>/`, a tabela „kept because” zawiera `BAD` (`live now`) i wcześniejsze opublikowane. | — |
| 8 | Weryfikacja: `verify-live` zielony; ręcznie `curl` + `sha256sum` dla `index.html` (wskazuje `v/<C>/`), root (= piny), `v/<C>/game.js` (= bajty GOOD); test na iPhonie (Chrome + aplikacja z ikony, PL/EN/ES) i desktopie; zapis: ten sam postęp, `schemaVersion 13`. | właścicielka (test urządzenia) |

**Ograniczenie, którego rollback nie usuwa:** strony z `index.html` wadliwego wydania w cache dalej ładują `v/<BAD>/`, bo jest niezmienne i zachowane. Ustępuje to po wygaśnięciu cache HTML (Pages: `max-age=600`). Aplikacja z ikony może trzymać stronę dłużej, więc trzeba ją zamknąć i otworzyć ponownie (S4: `v/<M>/` nadal serwowane).

## 2. Scenariusze

Każdy scenariusz: **Warunek → Zgody → Czynności → Kontrole → STOP → Sukces.**

### 2.1 FAIL w jobie `build` (przed publikacją)

- **Warunek:** job `build` czerwony (precheck / ledger / assemble / bash verify) albo exit 2. Joby `deploy` i `verify-live` są pominięte.
- **Skutek:** produkcja **bez zmian** (S1: błąd składni → exit 1, żywa strona dalej serwuje poprzednie wydanie). Rollback nie jest potrzebny.
- **Zgody:** diagnoza — żadna; poprawka = nowy PR (właścicielka); ponowne uruchomienie bez zmian kodu = `workflow_dispatch` (właścicielka).
- **Czynności:**
  1. Odczytać kod wyjścia i linię `RELEASE CHECK FAILED` / `INFRASTRUCTURE FAILURE` z logu kroku.
  2. **4**: nic do zrobienia (publikuje nowszy run). **3**: odczekać (sieć, limit API, rekord w toku; §2.6, §2.2), potem jeden `workflow_dispatch`. **1** z treścią gry (składnia, import, hook QA, CSS `url()`): naprawić commitem naprzód (§1), nigdy revertem. **2**: błąd workflow, STOP.
- **Kontrole:** żywy `index.html` ma hash ostatniej publikacji (rekord `success`); żadnego nowego rekordu `github-pages` z tego runu.
- **STOP (eskalacja do GPT i właścicielki, bez prób na ślepo):** komunikat zawiera `immutability`, `ledger disagrees`, `pins need review`, `off main's first-parent chain`, `cannot be rebuilt`, `over the limit of 60`, `not github-actions`, `long after its creation`, `the live release is incomplete`, `content-type`, albo exit 2. To przypadki z §2.5, §2.7, §2.8, §2.10.
- **Sukces:** kolejny build zielony; produkcja przez cały czas serwowała poprzednie wydanie.

### 2.2 FAIL w jobie `deploy`

- **Warunek:** job `deploy` czerwony.
- **Zgody:** `workflow_dispatch` albo nowy commit — właścicielka.
- **Czynności:**
  1. Rozpoznać krok:
     - „release/ changed between the build and the deploy job” / „symlink in release/”: nic nie opublikowano → jeden `workflow_dispatch`.
     - „the live index.html changed since the build”: nowszy run już opublikował → nic nie robić.
     - błąd `upload-pages-artifact` / `deploy-pages`: zwykle nic nie opublikowano; rekord kończy się `failure` (prawdziwy przebieg odrzuconego joba: `waiting → failure`, K2F-R `evidence/api-dep-7138162303-statuses.json`).
  2. Sprawdzić ostatni rekord i jego statusy (Settings → Environments → github-pages) oraz hash żywego `index.html`.
  3. Rekord `failure`/`error`/`inactive`, a żywa strona = poprzednie wydanie → ponowić (S2: następny build przechodzi).
  4. Rekord w `waiting/queued/pending/in_progress`, młodszy niż 6 h → **każdy build, także rollback, kończy się exit 3** (S2). Nie anulować (N8). Czekać na status końcowy albo na 6 h od utworzenia rekordu, potem ponowić.
- **Kontrole:** po ponowieniu jak w §1.3 krok 7–8.
- **STOP:** żywa strona serwuje nowe wydanie, a rekord mówi `failure` (`deploy-pages` mógł przekroczyć czas po faktycznej publikacji). Następny build da exit 1 „ledger disagrees with the live site” (S7) → §2.7.
- **Sukces:** rekord nowego runu `success`, `verify-live` zielony.

### 2.3 Deploy udany, FAIL w `verify-live`

- **Warunek:** `verify-live` czerwony; rekord deploymentu `success` (publikacja nastąpiła; `verify-live` nie zmienia rekordu i niczego nie cofa).
- **Zgody:** ponowienie joba `verify-live` (tylko odczyt) — właścicielka; rollback (§1) — właścicielka.
- **Czynności:**
  1. Exit 3 (sieć) albo różnice w pierwszych minutach: odczekać 10–15 min (CDN `max-age=600`), potem **Re-run failed jobs** — ponowi się tylko `verify-live`. Artefakt `release-files` żyje 1 dzień: ponowienie możliwe tylko w ciągu 24 h.
  2. Ręcznie: hash i `content-type` każdego pliku z listy w step summary: `curl -sS -D - -o /tmp/f "${BASE}<ścieżka>?vh-check=$(date +%s)"; sha256sum /tmp/f`.
  3. Różnice nadal po 30 min → test gry (iPhone + desktop):
     - gra działa: wydanie zostaje; eskalacja (prawdopodobnie CDN/MIME po stronie GitHub);
     - gra nie działa: §2.4. Przy niespójnej żywej stronie precheck commita naprzód prawdopodobnie odmówi (S5) → §2.8.
- **Kontrole:** hashe = lista z artefaktu; MIME `.js` = `text/javascript` albo `application/javascript`, `.css` = `text/css`.
- **STOP:** różnica bajtów pod `v/<id>/` po > 30 min (naruszenie niezmienności po stronie hostingu); błędny MIME `.js` po > 30 min.
- **Sukces:** zielony `verify-live` (ponowiony albo z rollbacku) i działająca gra na urządzeniu.

### 2.4 Deployment poprawny, gra nie działa

- **Warunek:** wszystkie 3 joby zielone, a test na urządzeniu pokazuje brak startu, czarny ekran, błąd JS albo utratę postępu. `verify-live` tego nie wykrywa: sprawdza bajty i MIME, nie start gry (S3: wydanie z `throw` na starcie przeszło CI i `verify-live`).
- **Zgody:** właścicielka (merge rollbacku = publikacja); GPT, jeśli czas pozwala.
- **Czynności:** §1.3. F1, jeśli istnieje wcześniejsze dobre wydanie wersjonowane; F2, jeśli to pierwsze wydanie E3 albo problem dotyczy ES module. Jeśli zniknął postęp: **najpierw** §2.11, nie czyścić danych przeglądarki.
- **Kontrole:** §1.3 krok 4 i 8; stara karta / aplikacja z ikony po zamknięciu i ponownym otwarciu ładuje `v/<C>/`.
- **STOP:** build commita naprzód odmawia z przyczyn innych niż błąd treści C → §2.7/§2.8; utrata zapisu nie ustępuje po rollbacku → §2.11.
- **Sukces:** gra startuje na iPhonie i desktopie z `v/<C>/`, postęp ten sam, `schemaVersion 13`.

### 2.5 Uszkodzone albo niekompletne `v/<id>/`

- **Warunek i skutek:**
  - (a) **w buildzie**: wymaganego `v/<id>/` nie da się odbudować z Gita (brak commita, przepisana historia, zmieniony graf) → assemble STOP „must be kept … cannot be rebuilt”, nic nie jest publikowane (S10, `qa/release.mjs` L1);
  - (b) **w artefakcie** brakuje pliku → `verify` / bash STOP przed uploadem (`qa/release.mjs`);
  - (c) **na żywej stronie, wydanie żywe** (anchor): 404, inne bajty albo zły MIME → precheck exit 1 (S5: 404, `text/plain`), więc **standardowy rollback jest zablokowany**;
  - (d) **na żywej stronie, inne zachowane wydanie** (nie anchor): precheck tego nie sprawdza; każdy udany build publikuje cały artefakt od nowa z Gita, więc odtwarza też te katalogi.
- **Zgody:** (a)/(b) poprawka = nowy PR (właścicielka); (c) każde działanie poza czekaniem — właścicielka + GPT; (d) `workflow_dispatch` — właścicielka.
- **Czynności:** (a)/(b) naprawa źródła commitem naprzód, nigdy przez usunięcie wydania z retencji. (c) odczekać 15–30 min, ponowić raz (`workflow_dispatch`); jeśli stan trwa → §2.8. (d) jeden `workflow_dispatch` na `main`.
- **Kontrole:** precheck PASS; step summary zawiera wszystkie wymagane id; `verify-live` PASS (sprawdza każdy plik artefaktu, także starsze `v/<id>/`).
- **STOP:** (a) zawsze; (c) po drugiej nieudanej próbie albo przy **innych bajtach** pod istniejącym id (immutability — nigdy nie nadpisywać).
- **Sukces:** każdy plik każdego zachowanego `v/<id>/` serwowany z poprawnym hashem i MIME (`verify-live`).

### 2.6 GitHub API niedostępne

- **Warunek:** ledger exit 3 (401/403/404/429/5xx/timeout/zły JSON, S6) albo Actions / `deploy-pages` niedostępne.
- **Skutek:** nic nie jest publikowane; produkcja zostaje w obecnym stanie. Fallbacku nie ma i **nie wolno go improwizować** (N7): bez ledgera nie wiadomo, które wydania trzeba zachować.
- **Zgody:** obserwacja — żadna; ponowienie = `workflow_dispatch` — właścicielka.
- **Czynności:** githubstatus.com; przy limicie (403/429 z `x-ratelimit-reset` w komunikacie) czekać do resetu; potem jeden `workflow_dispatch`. Jeśli produkcja jest równocześnie zepsuta: komunikat dla graczy; rollback możliwy dopiero po powrocie API.
- **Kontrole:** log kroku ledger: `ledger: N github-pages deployment records (P page(s)) …`.
- **STOP:** każda propozycja publikacji z pominięciem workflow albo ledgera.
- **Sukces:** ledger czytelny, build przechodzi, dalej jak w §1.3.

### 2.7 Niespójność live ↔ ledger

- **Warunek:** assemble exit 1 z `ledger disagrees with the live site` (żywe id ≠ ostatnia udana publikacja w ledgerze; żywa strona wersjonowana, a ledger nie zna udanej publikacji wersjonowanej; żywa klasyczna, a ledger mówi o wersjonowanej) albo `the live release's deployment … is now …` (S7).
- **Typowe przyczyny:** opóźnienie API po świeżym deployu (przejściowe); `deploy-pages` zgłosił błąd po faktycznej publikacji (R9); CDN/Pages serwuje inne wydanie niż ostatnie udane.
- **Zgody:** właścicielka + GPT dla każdego kroku poza czekaniem.
- **Czynności:**
  1. Zapisać: żywe id (słownik), ostatni rekord `success` i jego SHA, czas.
  2. Przejściowe: odczekać 15–30 min, jeden `workflow_dispatch`.
  3. Trwałe: → §4.
- **Kontrole:** żywe id i ledger porównane ręcznie; żywe `v/<id>/` kompletne (curl).
- **STOP:** żywe id nie należy do łańcucha `main`; ledger nie zna żadnej publikacji żywego wydania; każdy pomysł na ręczną publikację, zmianę źródła Pages albo usunięcie `v/`.
- **Sukces:** build przechodzi bez komunikatu o niezgodności.

### 2.8 Rollback zablokowany przez precheck

- **Warunek:** build commita naprzód (§1) kończy się w `Check the live site before deploying` exit 1: żywe `v/<id>/` niekompletne albo zły MIME (S5, §2.5c); żywy klasyczny `index.html` ≠ pin (S9); root ≠ piny („the root pair was overwritten”); żywy `index.html` 404 (Pages wyłączone; `qa/release.mjs`). Albo assemble: żywe wydanie spoza łańcucha `main` (S10), §2.7.
- **Fakt:** każdy build, także commit naprzód, zaczyna od precheck i porównania ledgera z żywą stroną. W tych stanach **żadna standardowa procedura nie opublikuje gry.**
- **Zgody:** właścicielka + GPT dla każdego kroku poza czekaniem.
- **Czynności:**
  1. Sklasyfikować przyczynę z komunikatu `RELEASE CHECK FAILED`.
  2. Przejściowe (propagacja CDN, opóźnienie API): czekać 15–30 min, ponowić raz.
  3. Trwałe: → §4.
  4. Root ≠ piny albo klasyczny `index.html` ≠ pin (publikacja spoza E3, N2/N3): **STOP**. Decyzja właścicielki co do pinów i root wymaga osobnej analizy tego, co gracze mają w cache. Nie zmieniać pinów ani root w ramach rollbacku.
- **Kontrole:** precheck PASS w następnym przebiegu.
- **STOP:** root/pin (pkt 4); `index.html` 404; wydanie spoza łańcucha; każda ręczna publikacja.
- **Sukces:** standardowy build commita naprzód przechodzi, dalej §1.3 krok 7–8.

### 2.9 Zachowanie klasycznych root `game.js` i `style.css`

- **Gwarancje w kodzie:** `readFrozen()` (assemble i `verify`) porównuje z pinami; bash (e) `sha256sum -c`; precheck wymaga, żeby żywy root = piny w obu erach. Root w artefakcie pochodzi zawsze z `63b50d0`, nie z drzewa commita.
- **Co je łamie:** tylko publikacja spoza E3: revert (N1), cofnięcie samego workflow (N2, S9: root nadpisany modułem), re-run klasycznego runu (N3: publikuje te same bajty root, ale usuwa `v/`).
- **Kontrole po każdym rollbacku:** `curl -s "${BASE}game.js?vh-check=$(date +%s)" | sha256sum` = `5011c0e4…2664`; `style.css` = `b5eb39fe…1b61`. S4, S4b, S13: root niezmieniony (PASS).
- **STOP:** inny hash root na żywej stronie (§2.8 pkt 4).
- **Sukces:** oba hashe = piny.

### 2.10 Zachowanie wymaganej historii wydań

- **Gwarancje:** retencja z ledgera (każde wydanie żywe w ostatnich 30 dniach, ostatnie 5 publikacji, rekordy „maybe published”, żywe i bieżące); STOP zamiast pominięcia; precheck kotwiczy żywe id; `verify-live` sprawdza każdy plik artefaktu.
- **Warunek konieczny:** `main` liniowy, każde opublikowane wydanie na łańcuchu first-parent, marker E3 w każdym commicie po drodze (N1, N4).
- **Kontrole:** tabela „kept because” w step summary zawiera `live now`, opublikowane w 30 dniach i ostatnie 5 (S4: `v/<B>/` live i `v/<M>/` zachowane obok `v/<C1>/`; S13: `v/<M>/` zachowane i dalej serwowane).
- **STOP:** `over the limit of 60` (decyzja właścicielki: podnieść limit albo świadomie zdecydować, co może zniknąć); `cannot be rebuilt` (§2.5a).
- **Sukces:** wszystkie id z tabeli obecne na żywej stronie (`verify-live`).

### 2.11 Ochrona zapisów v13

- **Stan:** `SAVE_SCHEMA_VERSION = 13` w `main` i w PR (`game.js:3439`); klucz `vectorHoleSave_v1`; `.bak`/`.rescue` nie są dotykane przez E2/E3. Origin bez zmian (`klaudiamoscinska-art.github.io`), więc ten sam `localStorage` przed i po rollbacku.
- **Dowód:** jeden profil przeglądarki przez wszystkie kroki próby K2F-R; zapis `guestId | coins=4242 | v13` przetrwał: klasyczny → moduł M → wadliwe B → F1 → F2 → revert → re-run #185 → F2 po pierwszym wydaniu (S0, S4, S4b, S8, S11, S13). `qa/release.mjs` „rollback 5”: guard `ok`, schema 13, marker D+ zachowany.
- **Zasady:** cel rollbacku ma `SAVE_SCHEMA_VERSION` ≥ najwyższego opublikowanego (N9). Rollback nigdy nie czyści `localStorage` i nie zmienia `SAVE_SLOT`. Graczom nie radzić czyszczenia danych witryny.
- **Kontrole po rollbacku:** Profil — ten sam postęp; `schemaVersion 13`.
- **STOP:** guard zapisu inny niż `ok` po rollbacku (`future`/`corrupt`/`stale`) — nie „naprawiać” zapisu, eskalacja (PX01).
- **Sukces:** ten sam postęp przed i po. Ograniczenie: dowód lokalny (Chromium); na fizycznym iPhonie przy rollbacku **NOT VERIFIED**.

## 3. Znane niebezpieczne operacje i co zamiast nich

| Operacja | Skutek | Zamiast |
|---|---|---|
| Revert całego PR #76 | 404 dla wersjonowanego `index.html` w cache; ponowne E3 zablokowane (N1, S8) | F1/F2 (§1) |
| Revert samego workflow | root nadpisany modułem → `SyntaxError` u starych stron; precheck blokuje na stałe (N2, S9) | F1/F2 (§1) |
| Re-run runu #185 (lub innego klasycznego) | usuwa wszystkie `v/`, omija kontrole (N3, S11) | F2 (§1) |
| Force-push / reset `main` | opublikowane wydanie poza łańcuchem → STOP każdego buildu (N4, S10) | commit naprzód |
| Ręczna publikacja (upload, „Deploy from branch”, inny workflow) | brak wymaganych `v/<id>/`, ledger niespójny albo H1 → STOP (N6, N7) | §1, a przy blokadzie §4 |

## 4. Gdy standardowa ścieżka jest trwale zablokowana

**Stan w tej wersji repozytorium: trybu awaryjnego nie ma.** Skrypt nie ma flagi obejścia precheck ani zgodności live ↔ ledger (K2F-R: K2).

- **Warunek:** §2.7 albo §2.8, przyczyna trwała (dwie próby w odstępie ≥ 15 min).
- **Zgody:** właścicielka + GPT.
- **Czynności:** nie publikować. Zebrać dowody (logi runów, żywe id, hashe, ostatnie rekordy ledgera). Eskalacja: przygotowanie osobno przeglądniętej zmiany „break-glass” w `assemble-release.mjs`/workflow (osobne zadanie, osobny PR, osobna zgoda). Komunikat dla graczy, jeśli gra nie działa.
- **Kontrole:** brak nowych rekordów `github-pages`, żywa strona bez zmian.
- **STOP:** każda publikacja poza workflow, zmiana źródła Pages, usunięcie `v/`, zmiana pinów.
- **Sukces / powrót do standardu:** po wdrożeniu przeglądniętej poprawki pierwszy zwykły build przechodzi precheck i ledger bez wyjątków; od tej chwili obowiązuje wyłącznie §1–§2.

## 5. Szybka ścieżka decyzji

```
Coś nie tak po merge?
├─ build czerwony ─────────────────────► 2.1 (produkcja bez zmian)
├─ deploy czerwony ────────────────────► 2.2 (sprawdź rekord + żywy index)
├─ verify-live czerwony ───────────────► 2.3 (czekaj 10–15 min, re-run verify-live ≤ 24 h)
├─ wszystko zielone, gra nie działa ───► 2.4 → F1 / F2 (pierwsze wydanie: F2)
├─ build rollbacku odmawia (precheck) ─► 2.8 → przejściowe: czekaj; trwałe: §4
├─ ledger ≠ live ──────────────────────► 2.7 → przejściowe: czekaj; trwałe: §4
└─ API GitHub nie działa ──────────────► 2.6 → czekaj, nic nie publikuj
Zawsze: N1–N9. Zapisy: 2.11 przed czymkolwiek, co dotyka danych przeglądarki.
```

## 6. Granice dowodu

| Element | Status |
|---|---|
| Logika workflow i skryptu na prawdziwej historii Git i prawdziwym ledgerze (264 rekordy), F1/F2, STOP-y | PASS lokalnie (K2F-R: 50/50 na Node 20 i 22; `qa/release.mjs` 93/93) |
| Prawdziwy przebieg w GitHub Actions; ustawienia Pages i środowiska `github-pages`; żywe bajty produkcji | NOT VERIFIED |
| Zachowanie GitHub przy anulowanym/timeout `deploy-pages`; CDN przy rollbacku | NOT VERIFIED |
| iPhone / WebKit / aplikacja z ikony przy rollbacku; ES w aplikacji z ikony | NOT VERIFIED |
