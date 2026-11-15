# Paczka CrazyGames (Basic) — 2026-11-15 16:45 (Europe/Warsaw)

**Status: zarchiwizowana w repo, NIE wysłana do CrazyGames Developer Portal.**
Przed przesłaniem przeczytaj „Otwarte ryzyka” niżej.

## Źródło

| Pole | Wartość |
|---|---|
| Data utworzenia | 2026-11-15 16:45:16 CET (Europe/Warsaw, UTC+01:00) = 2026-11-15T15:45:16Z |
| Commit źródłowy | `71d8e64ae6a80ae3d13360532048ad5b4b1af816` (merge PR #104 MISSION-ENTER-1 do `main`) |
| PR | #104 „MISSION-ENTER-1: Enter na karcie misji = GRAJ” (head `3e56423eb362a6959cbb1e1ce76a352ea1f822d6`, zaakceptowany przez GPT) |
| Wydanie na produkcji | GitHub Pages `v/71d8e64ae6a8/`, run „Deploy to GitHub Pages” #214 (build, deploy, verify-live: success) |
| Eksporter | `node tools/export-crazygames-basic.mjs --out=<katalog tymczasowy>` z czystej kopii (`git status` pusty, `sourceDirty: false`) |

## Plik do przesłania: `game.zip`

| Pole | Wartość |
|---|---|
| Rozmiar | 510 069 B (0,49 MB) |
| SHA-256 | `b98410253efbc321ad99c2ccfda348bcf45ddf4c0db9d169d9e6d388c127e6a2` |
| Zawartość | 3 pliki w katalogu głównym archiwum, razem 1 659 870 B (1,58 MB) |
| Limity | 3 z 1500 plików; 1,58 MB z 50 MB; mieści się w 20 MB (mobilna strona główna) |

| Plik w ZIP | Bajty | SHA-256 |
|---|---|---|
| `index.html` | 62 939 | `d0008e34b558a4978385fd2b539a5dd0a1f256891c94174872ac803f198410c4` |
| `game.js` | 1 291 623 | `a83ab8695c8981ef3939e99f0327e3bd75dca646c1144d4568beb248f8ddf8ec` |
| `style.css` | 305 308 | `a245a71a2230c9eb443e354661a406a43d204b6e0c71fadc965e96e0934e59a6` |

`BUILD_INFO.json` w tym folderze to plik wygenerowany przez eksporter (te same sumy).

## Kontrole (na źródle `71d8e64`)

| Kontrola | Wynik |
|---|---|
| ZIP poprawny (`zipfile.testzip`, `unzip -l`), `index.html` w katalogu głównym | PASS |
| Suma i rozmiar ZIP-a = `BUILD_INFO.json`; suma każdego pliku = `BUILD_INFO.json` | PASS |
| Powtarzalność: drugi eksport z tego samego commitu daje ten sam SHA-256 ZIP-a | PASS |
| `game.js` i `style.css` w ZIP bajt w bajt = pliki z commitu `71d8e64` | PASS |
| Oznaczenie paczki: `<html … data-distribution="crazygames-basic">`, SDK `https://sdk.crazygames.com/crazygames-sdk-v3.js` dokładnie raz, brak `github.io`, poza SDK tylko odwołania względne (`game.js`, `style.css`, favicon `data:`) | PASS |
| ARENA-FIX-1 w `game.js` (`arenaStartButton`, `deskControls`, `respawnArenaBot`) | PASS |
| MISSION-ENTER-1 w `game.js` (`missionStartButton`, `missionGoButton`, `enterLaunched`, `startCovered`, nakładka Enter `PLAY_KEY_HTML`) | PASS |
| `node qa/arena-fix1.mjs --only=L` (paczka w lokalnej ramce: start Enterem + Pointer Lock, przełączenie Mysz/Klawiatura, Esc) | PASS 8/8 |
| `node qa/crazygames-basic1.mjs` | **FAIL** — 88 PASS, 4 FAIL (niżej) |
| Krótki test produkcji (GitHub Pages, ta sama wersja kodu): karta misji → Enter → karta START → puszczenie i nowy Enter → zegar biegnie, 1 start, 1 START | PASS |
| CrazyGames Preview / QA Tool | NOT RUN (wymaga konta właścicielki) |
| Pełny `node qa/run-all.mjs` | NOT RUN dla archiwizacji |

### 4 FAIL-e w `qa/crazygames-basic1.mjs`

- `lock: the hole follows the locked pointer in all four directions`
- `lock: the virtual pointer stops at the frame on every edge`
- `UI: the pause button is clickable with the locked pointer, and the menu frees the cursor`
- `crazygames-basic1: step crashed (pointerLockChecks …) — not visible: #pauseSheet button`

Te same 4 FAIL-e (i te same 88 PASS) daje baza `a00a3a2` (przed PR #104, po ARENA-FIX-1) na tej
samej maszynie, więc nie wprowadził ich PR #104. **Przyczyna nie jest wyjaśniona** (nie jest
potwierdzonym błędem gry ani testu). Nowsze kontrole Pointer Lock z ARENA-FIX-1
(`arena-fix1 --only=L`) przechodzą. Lokalna ramka to nie jest CrazyGames Preview.

## Otwarte ryzyka

1. Wyjaśnić 4 FAIL-e Pointer Lock w `qa/crazygames-basic1.mjs` przed przesłaniem
   (stary test vs zachowanie po ARENA-FIX-1 albo realny problem w paczce).
2. Fizyczna mysz w CrazyGames Preview (klik planszy, ruch, Esc, wznowienie, pełny ekran) —
   niezweryfikowane (`docs/CRAZYGAMES_BASIC1_REPORT.md` §18).
3. Nazwy pól formularza portalu i formaty materiałów — niezweryfikowane.

## Jak przesłać `game.zip` (robi właścicielka)

1. Sprawdź sumę pobranego pliku: `sha256sum game.zip` (Windows: `certutil -hashfile game.zip SHA256`)
   musi dać `b98410253efbc321ad99c2ccfda348bcf45ddf4c0db9d169d9e6d388c127e6a2`.
2. Zaloguj się do CrazyGames Developer Portal i otwórz grę GLITCH GULP (albo dodaj nową grę HTML5).
3. W sekcji wgrywania builda wybierz HTML5 / ZIP i prześlij **ten** `game.zip` bez rozpakowywania
   i bez zmian (`index.html` jest w katalogu głównym archiwum).
4. Otwórz Preview i przejdź test fizyczną myszą (punkt 2 ryzyk), w tym Enter na Mieście
   i na karcie misji → START.
5. Dopiero po udanym Preview zgłoś wersję do recenzji.

Nie rozpakowuj ani nie edytuj plików z ZIP-a — każda zmiana zmienia SHA-256 i zrywa powiązanie
z commitem `71d8e64`. Nowa paczka = nowy folder `crazy-games/YYYY-MM-DD_HH-mm/`.
