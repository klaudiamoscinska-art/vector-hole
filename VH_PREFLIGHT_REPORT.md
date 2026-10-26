# VH_PREFLIGHT_REPORT — FTUE-3 „Pierwsze 5 minut” (P00-CORE + QA etapu)

**Data:** 2026-10-25/26 · **Repozytorium:** `klaudiamoscinska-art/vector-hole` (remote `origin`, jedyny)
**Baza:** `a24cbcfe318c87db2bb5bc2b4f5100505ca5d58b` = `origin/main` (sprawdzone `git fetch origin main` przed pracą).
**Gałąź:** `ftue3-first-five-minutes` (od `origin/main`), wypchnięta na `origin`. Commity:
`9d65640` krawędź miasta · `6062528` 1. runda bez kart · `ea4da91` linia następnej rundy · `6a071a5` testy · `30e63e3` dokumentacja (+ ten raport).
**Środowisko:** Windows 11 Pro, Node v22.23.4, Playwright 1.64.1, Chromium 156.0.8078.4 (headless, renderowanie programowe), Python 3.13 (`python`; `python3` to atrapa Microsoft Store). Brak fizycznego telefonu i SDK portali. Baza i kandydat mierzone na tej samej maszynie, jedno po drugim (baza w osobnym worktree `ftue3-base`).

## 1. Bramki

| Bramka | Wynik | Dowód |
|---|---|---|
| CORE-ENERGY | **PASS** | `qa/v22.mjs` w `run-all` (baza i kandydat): zero śladów energii, 15 rund / 6 Wyzwań / 15 misji pod rząd przy 0 monet |
| CORE-ISOLATION | **PASS** | `qa/px02-isolation.mjs` + `qa/v22.mjs` (PASS na kandydacie). FTUE-3 zmienia tylko Arenę: `edgeReach()` nie działa w kampanii (osobna symulacja), linia następnej rundy czyta bramki Areny (`FEATURE_GATES`) |
| CORE-LOOP | **PASS** | `qa/ftue3.mjs` (welcome → 3 rundy → wyniki prawdziwymi przyciskami, 4 + 3 sesje), `qa/ftue1.mjs`, `qa/flow.mjs`, `qa/leave-run.mjs` |
| CORE-SAVE | **PASS** | `qa/save-safety.mjs` PASS; FTUE-3 nie dodaje pól zapisu (test „existing player”: te same klucze, `schemaVersion` 13); `nextRoundHook()` tylko czyta zapis (test) |
| TOOLS-DEV | **bez zmian (FAIL wg pakietu, decyzja PX03 właścicielki)** | `qa/dev-panel.mjs` PASS; FTUE-3 nie dotyka panelu |
| DEPLOY-PAGES | **PASS (statycznie)** | `python .claude/vertical-hole/tools/check_pages_workflow.py --repo .` → PASS; `git diff a24cbcf HEAD -- .github` puste; `qa/release.mjs` i `qa/release-recovery.mjs` PASS w `run-all` |

**GO_CORE = GO** (cztery CORE PASS na `30e63e3`). GO_RELEASE wymaga merge'a i weryfikacji wdrożenia (poza tym raportem).

## 2. Pełna regresja (`node qa/run-all.mjs`, logi `qa/out/run-all-*.log`)

| | Baza `a24cbcf` | Kandydat `30e63e3` |
|---|---|---|
| Wynik | 1593/1597 | **1620/1623** (+26 nowych FTUE-3) |
| Czas | 42 m 48 s | 42 m 48 s |
| FAIL | workflow (python3), balans v18, EN „25 PAŹDZIERNIKA”, M11 pierwsza klatka | workflow (python3), balans v18, EN „25 PAŹDZIERNIKA” |

Wszystkie FAIL kandydata występują w bazie — **brak nowych regresji**:
- *workflow* — test woła `python3` (atrapa Sklepu) → wynik pusty; ręcznie `python …check_pages_workflow.py` = PASS. Środowisko, nie kod.
- *balans v18* — losowe ziarno, misje kampanii (FTUE-3 ich nie dotyka); w bazie też FAIL. Znana zmienność (±7 pkt).
- *EN „25 PAŹDZIERNIKA”* — brak tłumaczenia daty z bieżącego dnia; istniejący problem, poza zakresem.
- *M11* — w bazie FAIL, w kandydacie PASS (niestabilny test).

Kariera Areny (`arena-bots`, 20 rund): podium 3/3, ściana trudności, perf update 0,147 → 0,168 ms (próg 4 ms), render gfx0 7,39 → 7,92 ms (próg 12), monety po 3 rundach 1473 → 1564.

## 3. Pomiar pierwszej sesji (`node qa/ftue3.mjs --measure=12`, te same 12 ziaren)

| | Baza | FTUE-3 |
|---|---|---|
| Pauzy pełnoekranowe w 1. rundzie | 24 (2/runda) | **0** |
| Rundy z przerwą bez kęsa ≥ 20 s | 4/36 | **1/36** |
| Najdłuższa przerwa bez kęsa | 46,3 s | **20,2 s** |
| Mediana wyniku 1. rundy | 6552 | 8982 |
| Dotknięcia do startu 3. rundy | 8 | **6** |
| Start 3. rundy (model osi czasu) | 262 s | 256 s |
| Pierwszy kęs / kęsy w 10 s (mediana, 1. runda) | 0,5 s / 19 | 0,5 s / 17 |
| Błędy konsoli | 0 | 0 |

Bot „casual” to przybliżenie gracza; wpływu na retencję nie deklarujemy (hipotezy: GDD §7).

## 4. NOT RUN
- Testy na fizycznych telefonach (odłożone decyzją właścicielki).
- `check_evidence.py` / manifest odcisku drzewa (dowody = HEAD `30e63e3`, 0 zmienionych ścieżek w `run-all`).
- Live (Pages) — dopiero po merge'u.
