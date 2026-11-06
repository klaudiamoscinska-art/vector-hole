# CG-DATA-1 — zapis paczki CrazyGames przez Data Module (raport)

Data: 2026-11-06. Baza: `fd47b731ab2baaab3c0da9cbe6aaaf6cd1e162d3` (= `origin/main`, produkcja `v/fd47b731ab2b/`).
Gałąź: `cg-data1-module`. Kod etapu: commit `d228b2e16ec4be8c5e5e3e11b1cd3132e5edb235`.

## A. Werdykt

GOTOWE DO ODBIORU GPT — z zastrzeżeniem: test na prawdziwym CrazyGames (Preview / QA Tool, konto,
drugie urządzenie) jest **NOT RUN** (brak dostępu do konta dewelopera i Preview z tej maszyny).
Produkcyjnego PASS nie deklaruję.

## B. Dokumentacja CrazyGames (stan na 2026-11-06)

Źródła: `docs.crazygames.com/sdk/data`, `/sdk/intro`, `/sdk/user`, `/requirements/account-integration/`,
`/requirements/intro` oraz kod samego SDK (`https://sdk.crazygames.com/crazygames-sdk-v3.js`,
nagłówek `last-modified: 2026-10-26`, wersja w kodzie 3.8.0, SHA-256 pobranej kopii
`e248c56db1bab15d2971ae631fe55b9ee76e452df87e4cca14bdfdf9c31740fe`; kopia nie trafia do repozytorium).

| # | Pytanie | Ustalenie | Źródło |
|---|---|---|---|
| 1 | Inicjalizacja | skrypt w `<head>` przed kodem gry, `await window.CrazyGames.SDK.init()`; przed końcem `init()` SDK jest nieużywalne | `/sdk/intro`, `/sdk/data` |
| 2 | Odczyt / zapis / usuwanie | `SDK.data.getItem(k)` (string albo `null`), `setItem(k, v)`, `removeItem(k)`, `clear()` — jak `localStorage`; w kodzie SDK synchroniczne na kopii w pamięci | `/sdk/data` + kod SDK |
| 3 | Gość | dane w `localStorage` przeglądarki (w kodzie: jeden klucz `SDK_DATA_<gameId>`) | `/sdk/data` + kod SDK |
| 4 | Zalogowany | dane na koncie CrazyGames, synchronizowane między urządzeniami | `/sdk/data` |
| 5 | Logowanie gościa | konto z danymi → dane konta; konto bez danych → przejmuje dane gościa; „system automatycznie przeładowuje grę przy logowaniu” (gra z Data Module); wylogowanie odświeża stronę | `/sdk/data`, `/sdk/user`, `/requirements/account-integration/` |
| 6 | Synchronizacja urządzeń | zapis zalogowanego trafia na konto i jest na innych urządzeniach | `/sdk/data` |
| 7 | Limit | 1 MB (1 048 576 B) JSON danych; ostrzeżenie przy 90 %; ponad limit: błąd `dataLimitExcedeed`, dane nie są zapisane | `/sdk/data` + kod SDK |
| 8 | Opóźnienie zapisu | debounce 1 s, w niektórych przypadkach do 30 s | `/sdk/data` |
| 9 | Poza CrazyGames | `localhost`/`127.0.0.1`/`?useLocalSdk=true` → środowisko `local` (dane gościa w `SDK_DATA_local`); inne domeny → `disabled`, wywołania rzucają błąd (w kodzie po ~7 s sprawdzania) | `/sdk/intro` + kod SDK, test `[real SDK local]` |
| 10 | Test w Preview | przełącznik „Progress Save” w formularzu zgłoszenia jest wymagany, inaczej `dataModuleDisabled`; QA Tool służy do testów SDK | `/sdk/data`, `/requirements/intro` |
| 11 | Błędy | obiekt `{ code, message }`: `dataLimitExcedeed`, `dataModuleDisabled`, `other`; init może dać `initFailed` | `/sdk/data`, `/sdk/intro`, kod SDK |
| 12 | Mieszanie kont | „ten sam gracz na wielu urządzeniach, wiele kont na jednym urządzeniu” — wymóg dla własnych backendów; Data Module rozdziela dane per konto po stronie CrazyGames | `/requirements/account-integration/` |

NOT VERIFIED (dokumentacja tego nie mówi, kod SDK pokazuje inaczej albo nie da się sprawdzić lokalnie):
- kolejność „nasłuch logowania” vs „przełączenie danych na konto” — gra jest bezpieczna w obu (test D2);
- czy przeładowanie po logowaniu następuje zawsze i jak szybko;
- w kodzie SDK: gdy chmura nie odpowie w 10 s, SDK używa kopii `SDK_DATA_CLOUD_CACHE_<gameId>` i **nie synchronizuje tej sesji**; ta kopia jest jedna na przeglądarkę (nie na konto) — ryzyko po stronie SDK (§G);
- czy wysyłka ostatniego zapisu zalogowanego gracza przetrwa twarde odświeżenie w oknie debounce (1–30 s).

## C. Implementacja

- **Jedna ścieżka zapisu:** wszystkie klucze zapisu (`vectorHoleSave_v1`, `.bak`, `.rescue`) idą przez
  `saveStore()`. Na GitHub Pages to `localStorage` (te same wywołania co wcześniej). W paczce
  (`PORTAL_BASIC`) to `CG_DATA.store` — cienki adapter na `window.CrazyGames.SDK.data`. Strażnik PX01,
  migracje, `.bak`/`.rescue`, wykrywanie drugiej karty działają na nim bez zmian. SAVE v13 i klucz bez zmian.
- **Start:** eksporter dodaje oficjalny skrypt SDK do `<head>` paczki. `DOMContentLoaded` czeka na
  `cgDataBoot()`: `SDK.init()` z limitem 20 s, środowisko `crazygames` albo `local`, próbny odczyt (wykrywa
  wyłączony Data Module). Dopiero potem język, `devBoot()` i `new Game()`. `#app` jest ukryty do tego czasu
  (mechanizm z PR #91), więc nie ma mignięcia polskiego ani pustego profilu.
- **Gość:** zapis przez SDK do przeglądarki (zapis synchroniczny w `localStorage` SDK).
- **Zalogowany:** zapis przez SDK na konto; logowanie nie jest wymagane, gra nie ma ekranu logowania.
- **Błędy:** brak skryptu, błąd lub brak odpowiedzi `init()`, środowisko `disabled`, `dataModuleDisabled`,
  błąd odczytu → stan `unavailable`: gra działa z pamięci, **nic nie zapisuje ani nie usuwa**, pokazuje
  „Nie udało się połączyć z zapisem CrazyGames…” / „Couldn't connect to CrazyGames saving…”. Błąd odczytu
  nigdy nie jest traktowany jako „brak zapisu”. Błąd zapisu → `saveGame()` zwraca `false`, poprzedni zapis
  zostaje. Ponad limit 1 MB SDK zmienia wartość w pamięci przed rzuceniem błędu — adapter ją przywraca.
- **Konta:** po zalogowaniu w trakcie gry (nasłuch `addAuthListener`) strona przestaje zapisywać i mówi
  „Zalogowano na konto CrazyGames… odśwież” (CrazyGames przeładowuje grę). Niezależnie od nasłuchu: gdy
  `SDK.data` przełączy się na dane konta, odczyt przed zapisem różni się od `SAVE_GUARD.seen` → reguła PX01
  „stale” blokuje zapis. Postęp gościa nie nadpisze konta, które ma swój.
- **Druga karta:** zapis z innej karty widać jako zdarzenie `storage` na kluczu SDK `SDK_DATA_*` z naszym
  zapisem w środku → karta ze starszym stanem przestaje zapisywać (jak na web).
- **Panel TEST:** zapis testowy zostaje w `localStorage`, nigdy na koncie gracza.
- **Stare zapisy z niewydanych paczek testowych** (`vectorHoleSave_v1` w `localStorage` domeny CrazyGames)
  nie są czytane ani usuwane (decyzja właścicielki: zgoda na utratę zgodności testowych paczek).
- **Teksty:** prywatność w Profilu (paczka), komunikaty `unavailable` i „Zalogowano…”, 7 wpisów `I18N_EN`.

Zmienione pliki: `game.js`, `tools/export-crazygames-basic.mjs`, `qa/cg-data1.mjs` (nowy),
`qa/cg-sdk-mock.js` (nowy), `qa/crazygames-basic1.mjs`, `qa/lib.mjs`, `qa/run-all.mjs`, `qa/README.md`,
`docs/GAME_DESIGN.md`, `docs/CHANGELOG.md`, `docs/claude/ARCHITECTURE.md`,
`docs/crazygames/CRAZYGAMES_SUBMISSION_TEXTS.md`, `docs/crazygames/PRIVACY_POLICY_DRAFT.md`, ten raport.

## D. Testy

Ta sama maszyna (Windows 11, Chromium Playwright + zainstalowane Chrome/Edge), baza = worktree
`fd47b73`, kandydat = `d228b2e`. Logi: `qa/out/cgdata/` (poza repo, w git-ignore), kopia w `reports/logs/` dostawy.

**Nowy zestaw `qa/cg-data1.mjs` (kandydat): 47/47 PASS, 0 FAIL, 0 NOT RUN.**

| Rodzaj | Zakres | Wynik |
|---|---|---|
| Przeglądarkowe na mocku `[mock]` | A nowy gracz (5), B gość (6), C konto (5), D konta i konflikty (10), E odporność (17) | 43/43 PASS |
| Przeglądarkowe na **prawdziwym SDK 3.8.0** w trybie `local` `[real SDK local]` | nowy gracz EN, runda w `SDK_DATA_local`, przywrócenie po odświeżeniu, brak błędów; SDK poza CrazyGames samo się wyłącza → `unavailable`, nic nie zapisane | 3/3 PASS |
| Regresja web `[web]` | GitHub Pages bez SDK, istniejący SAVE v13 z `localStorage` wczytany i dalej zapisywany tam | 1/1 PASS |
| Prawdziwe CrazyGames (Preview, QA Tool, konto, chmura, 2. urządzenie) | — | **NOT RUN** |

Macierz z zadania → testy: A (brak zapisu, ekran powitalny, EN od pierwszej klatki przy polskiej przeglądarce
i SDK spóźnionym o 1,5 s, brak polskiego mignięcia, nic nie odblokowane) — PASS; B (Arena, M01, zapis,
odświeżenie, nowa karta, brak własnego klucza w `localStorage`) — PASS; C (zapis na konto, odczyt po
odświeżeniu, drugie urządzenie symulowane, postęp z drugiego urządzenia widoczny na pierwszym) — PASS na
mocku, NOT RUN na portalu; D (gość → nowe konto: SDK przenosi postęp, strona przestaje zapisywać, komunikat
EN; gość → konto z danymi przy obu kolejnościach zdarzeń: brak zapisu na konto, dane gościa zostają;
wylogowanie; drugie konto na tym samym urządzeniu) — PASS na mocku; E (SDK wolne 4 s, zablokowane, błąd init,
brak odpowiedzi 20 s, Data Module wyłączony, błąd odczytu, środowisko `disabled` — za każdym razem
`unavailable`, dane urządzenia i stary klucz bajt w bajt, komunikat EN; po błędzie odczytu następna sesja ma
cały zapis; błąd zapisu i powrót; limit 1 MB; 300 zapisów; odświeżenie zaraz po rundzie; dwie karty; zapis
uszkodzony i z nowszej wersji; migracja z `.bak` w Data Module; pełny profil 6,7 kB, ×3 kopie ≈ 20 kB
≪ 1 MB) — PASS na mocku. Synchronizacja i opóźnienia prawdziwej chmury: NOT VERIFIED.

**Regresja (baza → kandydat, te same zestawy, ta sama maszyna):**

| Zestaw | Baza `fd47b73` | Kandydat `d228b2e` |
|---|---|---|
| `save-safety` (PX01) | 107/107 | 107/107 |
| `px02-isolation` | 95/95 | 95/95 |
| `v19` (EN, kopia w chmurze w wersji web) | 16/16 | 16/16 |
| `v22` (dwa tryby, brak energii) | 49/49 | 49/49 |
| `boot` | 9/9 | 9/9 |
| `bridge` | 20/20 | 20/20 |
| `leave-run` | 22/22 | 22/22 |
| `ftue1` | 78/78 | 78/78 |
| `edge-cases` | 13 PASS / 0 FAIL | 13 PASS / 0 FAIL |
| `design` (teksty neutralne płciowo, paleta) | 29/29 | 29/29 |
| `workshop-buy` | 72/73 (FAIL 2560×1440 „tap moves nothing”) | 73/73 |
| `ftue3` | 26/26 | 26/26 |
| `release` (E3) | 93/93 | 93/93 |
| `instructions` | — | 4/4 |
| `crazygames-basic1` (paczka; bez `--delivery`) | 105/105, NOT RUN 1 | 105/105, NOT RUN 1 (solo) |
| `crazygames-basic1 --delivery` (nowa dostawa) | — | 117/117 |

Problemy i klasyfikacja:
- `crazygames-basic1` w pierwszym przebiegu kandydata (równolegle z innym zestawem): 104/105 — „Chrome: zegar
  liczy prawdziwe sekundy” (2,28 s zamiast 3 s). Solo 3× Chrome + 3× Edge: baza 6/6, kandydat 6/6; pełny przebieg
  solo 105/105. **FLAKY pod obciążeniem**, nie regresja.
- `workshop-buy` 2560×1440 na bazie: zastana niestabilność dużej ramki (kandydat PASS). Nie regresja.
- Pełne `qa/run-all.mjs`: **NOT RUN** (wielogodzinne; zmiana ścieżki web to wyłącznie `saveStore()` →
  `localStorage`, pokryta zestawami zapisu powyżej). Nie uruchamiano: `responsive`, `devices`, `perf1`,
  `balance1`, `difficulty`, `content`, `dev-panel` (panel TEST wyłączony z testów przez właścicielkę).
- Panel TEST w paczce (zapis testowy w `localStorage`, nie na koncie): NOT RUN.

## E. Paczka

- ZIP: `C:\Users\Piotrus\Desktop\Repo\crazygames-data1-delivery\game.zip`
- SHA-256: `9d3d547bba87d34ac11fac9b6f2622d00ab6df61d7e2c454d0de5c417cb571db` (430 906 B; powtarzalny eksport)
- Zawartość: `index.html` (w katalogu głównym, `<html lang="en" data-distribution="crazygames-basic">`,
  skrypt SDK raz, w `<head>`, przed `game.js`), `game.js`, `style.css`; 3 pliki, 1,33 MB; źródło `d228b2e`.
- Brak prywatnych zapisów i danych testowych (w `game.js` jest tylko publiczna stała `CANONICAL_URL`
  z adresem GitHub Pages, jak w poprzedniej paczce; panel TEST wyłącznie z hashem kodu).
- Okładki i filmy bajt w bajt jak w `crazygames-en-default-delivery`; poprzednia paczka (`658da614…`) nietknięta.
- Uruchamianie przez HTTP: zestawy QA serwują paczkę z jej folderu (`127.0.0.1`) i z udawanego hosta
  `https://…crazygames.com`; `file://` nie działa (moduły ES), jak wcześniej.

## F. CrazyGames — zgłoszenie i test ręczny

**Czy można zaznaczyć „Yes, using the Data Module from the CrazyGames SDK”?** Tak — paczka używa
wyłącznie Data Module do zapisu postępu. Warunek: w formularzu musi być włączony przełącznik
„Progress Save” (Data Module), inaczej SDK zwraca `dataModuleDisabled` i gra nic nie zapisze
(pokaże komunikat). Potwierdzenie na portalu: NOT RUN.

Procedura dla właścicielki (Preview / QA Tool, Chrome; najlepiej okno incognito dla gościa):
1. Developer Portal → gra → wgraj `game.zip`, zaznacz Progress Save → Data Module → zapisz → Preview.
2. **Gość:** nie loguj się. Zagraj rundę Areny do końca i misję M01. Odśwież stronę (F5) → monety, liczba
   rund i gwiazdka M01 zostają, nie ma ekranu powitalnego. Zamknij kartę, otwórz Preview ponownie → to samo.
   W konsoli (F12) nie może być ostrzeżenia „CrazyGames Data Module unavailable”.
3. **Konto (nowe, bez danych):** jako gość z postępem z kroku 2 zaloguj się na nowe konto CrazyGames.
   Oczekiwane: CrazyGames przeładowuje grę; postęp gościa jest na koncie. (Jeśli pojawi się komunikat
   „Signed in to CrazyGames… reload”, kliknij RELOAD — to znaczy, że portal nie przeładował sam.)
4. **Konto z danymi:** zagraj na koncie 2 rundy, zapamiętaj monety. Wyloguj się → gra startuje jako gość
   z postępem gościa (nie konta). Zagraj jako gość, zaloguj się na to samo konto → widać monety konta,
   nie gościa.
5. **Drugie urządzenie:** na telefonie lub innej przeglądarce zaloguj się na to samo konto i otwórz Preview
   → postęp konta. Zagraj rundę, odczekaj ~30 s, odśwież na pierwszym urządzeniu → nowa runda widoczna.
6. **Dwa konta na jednym urządzeniu:** wyloguj, zaloguj inne konto → jego własny postęp (albo przejęty
   postęp gościa, jeśli konto nie miało danych — tak działa CrazyGames).
7. Zapisz wyniki jako PASS / FAIL z godziną; przy FAIL zrzut ekranu i konsola.

## G. Ryzyka i ograniczenia

- Testy z mockiem to nie CrazyGames. Prawdziwe SDK sprawdzone tylko w trybie `local` (127.0.0.1) i jako
  „wyłączone” poza CrazyGames. Logowanie, konto, chmura, drugie urządzenie: NOT RUN na portalu.
- SDK (nie gra): przy braku odpowiedzi chmury w 10 s sesja nie jest synchronizowana, a kopia
  `SDK_DATA_CLOUD_CACHE_<gameId>` jest wspólna dla przeglądarki — w skrajnym przypadku inne konto na tym samym
  urządzeniu może w takiej sesji zobaczyć cudzy postęp lokalnie (bez zapisu na swoje konto). Gra tego nie
  wykryje (brak API). Zgłosić CrazyGames, jeśli wystąpi.
- Zalogowany gracz: ostatnie 1–30 s postępu mogą przepaść przy twardym odświeżeniu (debounce SDK) — NOT VERIFIED.
- Gdy SDK nie działa (np. bloker), gracz gra bez zapisu w tej sesji — świadomie (nie ryzykujemy nadpisania).
- Start paczki czeka na SDK: zwykle ułamek sekundy; w najgorszym razie do 20 s z pustym ekranem.
- „Resetuj profil” usuwa główny zapis (także z konta); `.bak`/`.rescue` — jeśli kiedyś powstały — zostają,
  tak samo jak na GitHub Pages.
- Fizyczny iPhone / Android / Safari: NOT RUN.
