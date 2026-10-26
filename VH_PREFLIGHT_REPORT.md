# VH_PREFLIGHT_REPORT — CONTENT-1 „Audyt 240 misji” (P00-CORE + QA etapu)

**Data:** 2026-10-26 · **Repozytorium:** `klaudiamoscinska-art/vector-hole` (remote `origin`, jedyny)
**Baza:** `405994feb34d3865d5a1c1d1d59d7ca0114c1838` = `origin/main` (sprawdzone `git fetch origin main` przed pracą; drzewo czyste).
**Gałąź:** `content1-campaign-audit-fixes` (od `origin/main`). Commity: `5a25c02` audyt (`qa/content.mjs`, `qa/content-shots.mjs`) · `4679677` ikony = obiekty, wygląd wież, pylony, nazwy · `7917e06` kamera Kampanii (M59) · `6a5766d` `run-all` · dokumentacja + raport (ten commit).
**Środowisko:** Windows 11 Pro, Node v22.23.4, Playwright 1.64.1, Chromium 156.0.8078.4 (headless, renderowanie programowe), Python 3.13 (`python`; `python3` to atrapa Microsoft Store). Brak fizycznego telefonu i SDK portali. Baza i kandydat mierzone na tej samej maszynie, jedno po drugim (baza w osobnym worktree `vh-content1-base`).
**Merge:** właścicielka w prompcie CONTENT-1 udzieliła **jednorazowej** zgody na samodzielny merge (merge commit) i wdrożenie po przejściu bramek, bez osobnego przeglądu GPT przed merge — wyjątek tylko dla tego etapu; reguła w `CLAUDE.md` bez zmian.

## 1. Bramki

| Bramka | Wynik | Dowód |
|---|---|---|
| CORE-ENERGY | **PASS** | `qa/v22.mjs` w `run-all` (baza i kandydat) |
| CORE-ISOLATION | **PASS** | `qa/px02-isolation.mjs`, `qa/v22.mjs` PASS. Zmiany tylko w Kampanii (`objectiveIconDef()`, `buildCampaignMission()`, `updateCampaign()`, `campaignTargetZoom()`); kamera Areny i jej balans nietknięte |
| CORE-LOOP | **PASS** | `qa/content.mjs` (240/240 przejść bota-eksperta), `qa/flow.mjs`, `qa/campaign-bots.mjs`, `qa/ftue1.mjs`, `qa/ftue3.mjs`, `qa/leave-run.mjs` |
| CORE-SAVE | **PASS** | `qa/save-safety.mjs` PASS; brak nowych pól zapisu, `SAVE_SCHEMA_VERSION` 13, id misji bez zmian (zmienione tylko 2 wyświetlane nazwy) |
| TOOLS-DEV | **bez zmian (FAIL wg pakietu, decyzja PX03 właścicielki)** | `qa/dev-panel.mjs` PASS; CONTENT-1 nie dotyka panelu |
| DEPLOY-PAGES | **PASS (statycznie)** | `python .claude/vertical-hole/tools/check_pages_workflow.py --repo .` → PASS; `git diff 405994f HEAD -- .github` puste; `qa/release.mjs`, `qa/release-recovery.mjs` PASS w `run-all` |

**GO_CORE = GO.** GO_RELEASE: weryfikacja wdrożenia po merge (sekcja 6).

## 2. Audyt 240 misji (`node qa/content.mjs`, pełna tabela: `docs/CONTENT1_AUDIT.md`)

| | PRZED (`405994f`) | PO |
|---|---|---|
| PASS / ISSUE / NOT VERIFIED | 75 / 165 / 0 | **240 / 0 / 0** |
| misje ze złą ikoną celu | 157 (8 grup wspólnych ikon) | **0** |
| misje z wirem > 30% krótszego boku telefonu | 66 (maks. 77%, M59) | **0** (maks. 28%) |
| obiekt celu pod większym obiektem | losowo 1–3 misje na przebieg (pylony) | **0** |
| złe liczby / brak obiektów / postęp / EN | 0 | 0 |
| bot-ekspert w limicie / tylko bez limitu / nigdy | 220 / 20 / 0 | 220 / 20 / 0 |

Kontrola statyczna i rozgrywka są rozdzielone: PASS wymaga obu. Rozgrywka = bot w czasie wirtualnym, nie człowiek.

## 3. Pełna regresja (`node qa/run-all.mjs`, logi `qa/out/runall-{base,after}.log`)

| | Baza `405994f` | Kandydat `6a5766d` (+ dokumenty) |
|---|---|---|
| Wynik | 1651/1654 | **1661/1665** (+11 nowych CONTENT-1) |
| Czas | 53 min | 53 min |
| FAIL | workflow (`python3`), perf gfx0 14,3 ms, EN „26 PAŹDZIERNIKA” | workflow (`python3`), balans v18, EN „26 PAŹDZIERNIKA”, difficulty casual EKSTREMALNA 56% |

Różnice sprawdzone sparowanie (te same ziarna, baza i kandydat):
- *difficulty* — ziarno 1018968824: baza **57% FAIL**, kandydat 56% FAIL; ziarno 5332851: baza 53% PASS, kandydat 50% PASS. Zależne od ziarna, kandydat nie łatwiejszy.
- *balans v18* — ziarno 46286753: **baza też FAIL** (ta sama asercja). Znana zmienność.
- *perf gfx0* — FAIL w bazie, PASS w kandydacie (Arena; szum maszyny).
- *workflow* — test woła `python3` (atrapa); bezpośrednio `python …` = PASS. Środowisko.
- *EN data* — dzisiejsza data bez tłumaczenia; istniejący problem, poza zakresem.

**Brak nowych regresji.** Responsywność (`qa/responsive.mjs`, `qa/devices.mjs`), VISUAL-1, FTUE-1/2/2 FIX/3, SAVE/PX02/R1, E2/E3/L1, release + recovery — PASS w obu.

## 4. Wydajność i rozmiar
- `game.js` 1 030 253 → 1 044 750 B (+14,5 KB; gzip +3,3 KB). Zero nowych plików runtime i zależności.
- Render Kampanii (M59, telefon 390×844, programowy GPU, 2 serie): start r18 bez zmian (~12–19 ms obie); późna faza r299 **baza 50–59 ms → kandydat 17–30 ms** (mniejszy wir na ekranie).

## 5. NOT RUN
- Testy na fizycznych telefonach (iPhone 13 / 16 Pro) — tylko emulowane ramki (`qa/responsive.mjs`, `qa/devices.mjs`, zrzuty M59 w 10 ramkach).
- Ręczne przejście 240 misji przez człowieka — przejścia botem.
- Poki Inspector / CrazyGames SDK — brak w środowisku.
- `check_evidence.py` / manifest odcisku drzewa (dowody = HEAD `6a5766d` + zmiany tylko w dokumentach).

## 6. Wdrożenie
Uzupełniane w PR i w raporcie końcowym po merge (build → deploy → verify-live, SHA produkcji, smoke).
