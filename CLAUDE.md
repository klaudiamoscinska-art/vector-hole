# CLAUDE.md

Guidance for Claude Code in this repository. This file is loaded into every session, so it holds only the rules that always apply and pointers; the full references are loaded on demand (table "Where to read" below). Moving a detail out of this file never makes it optional — read the referenced file before working in its area.

## Owner's standing rules (every session)

- **Polish** for every reply, report and HANDOFF to the owner (code, comments and commit messages keep the repo's English style).
- **Production is `klaudiamoscinska-art/vector-hole`, branch `main`** — a push to `main` publishes the game (GitHub Pages, see Deployment). Never commit or push to production `main`, never merge a PR, never run a production deployment or `workflow_dispatch`. Work on a branch; open a PR only when the owner asks. A production merge happens only after GPT's independent review and the owner's explicit approval — the owner merges. Staging (`vertical-hole-staging/vector-hole`, a published-artifact repo) also needs the owner's approval for every push.
- **Preflight before work:** repo, branch, HEAD, remotes, `git status`, current `origin/main` SHA; keep untracked QA evidence and backups. No destructive git (`reset --hard`, `clean`, `stash`, force-push, rewriting shared history), no `git add -A` without checking the file list. On a conflict or an unexpected state: stop and report, never overwrite earlier work.
- Don't publish, sign agreements, spend money, perform destructive operations, or change global Claude settings/permissions without explicit consent.
- **Evidence:** report `PASS / FAIL / NOT RUN`; a test that executed nothing is `NOT RUN`, never `PASS`; compare against the base commit on the same machine; never hide a new regression in a total. When tools or tests are missing, say what wasn't verified.
- **Reports:** lead with the verdict, results, differences and failures; keep full logs in files (`qa/out/`, an evidence folder) and quote only the relevant lines.
- **HANDOFF is mandatory** (not only on request): after every significant stage and whenever the work passes to a new session, write a short but complete HANDOFF — status, repo + branch + full SHA, tests `PASS / FAIL / NOT RUN`, changes made, open risks, the next step, how to continue safely (`docs/claude/HANDOFF_TEMPLATE.md`).
- **Token hygiene** (`docs/claude/TOKEN_GUIDE.md`): start Claude Code in the repo folder (this file loads only there), read only the sections a task needs, use a skill only when its description fits, prefer the cheapest model that can do a step (guide), don't re-read whole history docs to rediscover what a HANDOFF states.

## Project

**Vector Hole: Eat the Neon City** — a top-down, hole.io-style browser game (Polish UI, English translation layer): steer a vortex through a neon city, eat everything smaller, grow through six size tiers, eat smaller rivals, win 2-minute Arena rounds, play a 240-mission Campaign (12 districts, difficulty 1–5, three stars, boosters). Since v22 Arena and Dzielnice are **two independent modes**, both open from the first launch, with no play limit (no energy). **How the game works today (rules, numbers, copy tone): `docs/GAME_DESIGN.md` — read it before changing gameplay, balance or text, and update it with the code.** Version history: `docs/CHANGELOG.md`. The skills pack calls the game „Vertical Hole” — it is this game.

Vanilla HTML/CSS/JS, zero dependencies, no bundler, no build step for development. Runtime: `index.html` (canvas, HUD, every screen in the DOM toggled with `.hidden`), `style.css` (neon visual system, self-hosted base64 fonts — **zero** third-party requests), `game.js` (all game logic, a native ES module since E2; its `export { … }` lists only what `qa/` reads through the QA bridge — `qa/README.md` E2). **Splitting `game.js` into ES modules is an approved, staged refactor (E2 → E3 → E4): one step at a time, no gameplay change, static relative imports only (`./`, inside the release; no bare, absolute or dynamic imports). Adding a dependency, a bundler, or a build step that development depends on needs the owner's decision first.** `design/` = original non-runtime mockups (`design/reference/asset_bible.svg` is the palette source of truth).

## Invariants (never break without an owner decision)

- **Save:** `localStorage` key `vectorHoleSave_v1` never changes; `SAVE_SCHEMA_VERSION` stays **13** (a breaking change = a new `migrateSave()` branch + owner decision, `.claude/vertical-hole/SAVE_MIGRATION_CONTRACT.md`); a new field must be added to `defaultSave()` (every load runs `sanitizeSave()`); `saveGame()` is the only write path — never write `SAVE_SLOT` around it; the PX01 guard never overwrites a future/broken save (`.rescue`, `.bak`, `verifyMigration()`); the PX02 D+ one-time refund rules hold. Details: `docs/claude/ARCHITECTURE.md` (Config, state, RNG, saves). Checked by `qa/save-safety.mjs`, `qa/px02-isolation.mjs`.
- **Arena ↔ campaign independence:** nothing in Arena depends on campaign progress and nothing in a mission on Arena progress; every unlock gate reads only its own mode (`FEATURE_GATES`, `CONFIG.unlockGates`); an announced unlock never locks again. **Core City is filled only by `finalizeRun()`** (Arena/Daily); campaign never touches it. A round left early pays only partial coins and XP for its score (`payLeftRun()`, R1) and at score 0 nothing (`abandonRun()`); Core City, bonuses, prisms and the run count (`runsPlayed` = finished rounds) come only from a finished round.
- **No Arena advantage for sale (PX02 D+):** vortices are looks only; never reintroduce anything coins, prisms, ads, IAP or campaign progress buy that changes an Arena round. The one accepted flow: Arena-earned coins may buy a mission booster in the briefing.
- **No play limit:** never reintroduce energy, a timer or a cost in front of a round or mission (growth fragments are pickups, not an entry limit).
- **Economy:** prices, rewards, booster balance and the growth curve change only with the owner; booster balance → `node qa/v18.mjs`; mission changes → `node qa/calibrate.mjs 10 4`, paste `MISSION_BOT_TIME`, then `node qa/difficulty.mjs`.
- `SeededRNG` seeds only a round's initial layout; any new layout step must consume the stream identically for every player and `computeDailyLayout()` must replay it (`qa/design.mjs`). Ranking is always by score (`rankHoles()`). `escapeHtml()` for every player string reaching `innerHTML`. `Analytics` sends nothing without consent; no backend.
- **Text:** every new Polish UI string needs an `I18N_EN` entry (`node qa/v19.mjs`); Polish copy is gender-neutral (never "urosłaś/urosłeś", "gotowa/gotowy"; `qa/design.mjs`, GDD §1). Palette `--nc-*`/`--neon-*` from the asset bible; the old saturated neons (`#00f3ff`/`#ff007f`/`#39ff14`/`#ffd700`/`#b026ff`) are a regression. Use SVG/canvas glyphs, not emoji.
- **Layout:** `#app` is `100dvh` (never plain `vh`), bottom UI pads `env(safe-area-inset-bottom)`; one obvious action per screen, reachable without scrolling on 375×667 (`qa/flow.mjs`); 0 floor chunk repaints over still frames (`qa/visual.mjs`); never read DOM rects inside a zoomed layer. FTUE-2: the layout follows the frame's shape (`screenLayout()`: phone / wide / compact, UI scale never < 1), every Poki/CrazyGames/phone/tablet frame in `qa/responsive.mjs` must fit, the portal page never scrolls under the game; no in-game fullscreen button (the portal provides it).
- **Dev panel (v23):** only `DEV_CODE_HASH` is in the source — **never commit the dev code**; game hooks stay inert outside test mode; test mode uses its own save slot.
- `Monetization` is the only path to ads/IAP (no fake checkout); `SoundEngine` synthesizes all audio (no audio files).
- **Deliberately not built:** backend, bundled ad/IAP SDK, procedural districts, PWA/service worker, `og:image`, Core City prestige past LVL6 (GDD §7).

## Deployment (hard rules — full reference `docs/claude/DEPLOYMENT.md`)

`.github/workflows/deploy-pages.yml` deploys GitHub Pages **from `main` only**; `.github/scripts/assemble-release.mjs` publishes only the assembled `release/` folder (never the repo root): the release's `index.html`, immutable `v/<id>/` folders retained by the deployment ledger (L1), and the frozen classic root `game.js`/`style.css` (commit `63b50d0`, SHA-256 pinned). **A URL never changes meaning:** never edit or remove the root pair, never reuse a `v/` id for other bytes, never move or rename `index.html` (one origin = one save); the repo's `index.html` keeps `src="game.js"` (only CI rewrites it). **Rollback = a forward commit restoring the last good runtime content;** never revert PR #76 or the workflow alone, never re-run a classic run, never rewrite `main`, never remove `v/` while pages may reference it — procedures in `docs/E3_ROLLBACK_PLAN.md`. Break-glass (K2) `mode: recovery` is owner-only (§4 of the plan; `qa/release-recovery.mjs`). Changing the workflow or the release script needs `node qa/release.mjs`, `node qa/release-recovery.mjs` and `python .claude/vertical-hole/tools/check_pages_workflow.py --repo .`.

## Commands

No package manager, build or linter. Serve the folder (HTTP only — `file://` can't load the ES module):

```bash
python3 -m http.server 8000      # http://localhost:8000/index.html
node qa/run-all.mjs              # every suite (outputs in git-ignored qa/out/), exit 1 on any failure
node qa/save-safety.mjs          # PX01 save guard     node qa/px02-isolation.mjs  # PX02 D+ isolation
node qa/v22.mjs                  # two modes / no energy  node qa/ftue1.mjs     # FTUE-1
node qa/ftue3.mjs                # FTUE-3 first 5 minutes (--measure=N --root=DIR: a first session vs another checkout)
node qa/leave-run.mjs            # leaving a round      node qa/release.mjs     # E3 artifact (+ release-recovery.mjs)
node qa/content.mjs              # CONTENT-1: all 240 missions (goal copy, icons = board objects, progress, EN, bot clear, vortex size)
node qa/responsive.mjs           # FTUE-2: every platform frame, iframe host, resize/turn/fullscreen, input
```

Full suite list with what each checks, the bots (`ARENA_BOT` `casual` = the yardstick for design decisions), virtual time, seeds and Windows notes (false-PASS guard, CRLF, symlinks, `python3`): `qa/README.md`. Extend `qa/` when adding features; never add a test framework or dependency. Perf thresholds vary by machine — compare with the base on the same machine.

## Where to read (on demand)

| Task | Read first |
|---|---|
| Gameplay, balance, text, economy | `docs/GAME_DESIGN.md` (+ `docs/claude/ARCHITECTURE.md` for the code area) |
| Code structure: config/saves, world/rendering, input, Arena, Campaign, dev panel, meta screens, audio, languages, visuals | `docs/claude/ARCHITECTURE.md` |
| Saves / migrations | `docs/claude/ARCHITECTURE.md` saves + `.claude/vertical-hole/SAVE_MIGRATION_CONTRACT.md` + `CHANGE_SAFETY.md` |
| Publishing, workflow, release script, rollback | `docs/claude/DEPLOYMENT.md`, `docs/E3_ROLLBACK_PLAN.md` |
| QA suites, bots, Windows | `qa/README.md` |
| Skills / prompt packs, P00 details, pack conflicts | `docs/claude/SKILLS_PACK.md`, `.claude/vertical-hole/PACK_README.md` |
| HANDOFFs, model choice, token hygiene | `docs/claude/HANDOFF_TEMPLATE.md`, `docs/claude/TOKEN_GUIDE.md` |

## Skills pack and the P00 gate

22 skills `.claude/skills/vh-*` (v1.4.3) + shared references `.claude/vertical-hole/` + prompt pack `.claude/vertical-hole-prompts/` (v1.4.4) — on demand only: use the matching skill on request or when its description fits, never all by routine; skills are instructions, not background agents. Update the packs only from their official ZIPs (procedure in `docs/claude/SKILLS_PACK.md`) — don't hand-edit them.

- Before changing code read `.claude/vertical-hole/PROJECT_CHARTER.md`; for bigger tasks also `WORKFLOW.md` and `QUALITY_GATES.md`; before changes and save migrations `CHANGE_SAFETY.md` (all in `.claude/vertical-hole/`).
- **Gate before development (P00):** run `.claude/vertical-hole-prompts/P00.md` as a read-only audit before new features and write `VH_PREFLIGHT_REPORT.md` (commands, git revision, `PASS / FAIL / NOT RUN`); read `PREFLIGHT_GATES.md` and `ARENA_DISTRICT_CONTRACT.md` before new features. `GO_CORE` = no active energy, Arena fully isolated, working loop, safe save migration; `GO_TOOLS` (separate) = working dev panel and none of its code in production — missing it doesn't block FTUE fixes; `GO_RELEASE` needs both plus platform sign-offs and `check_pages_workflow.py`. Evidence must match the current worktree hash, not just HEAD (`EVIDENCE_FRESHNESS.md`); dev panel/build rules `RELEASE_DEBUG_GUARD.md`. A confirmed FAIL goes to its own repair prompt PX01–PX05, one at a time, then P00 again.
- Hard rules (pack, consistent with v22): Arena First; Arena independent of the campaign; no energy gating play; speed and mobile first; honest monetization within each portal's rules (`PLATFORM_RULES.md` is dated 2026-10-16 — re-verify before a release). Discover the technical state in the current repo — don't assume paths or functions; small changes, run tests, report evidence.
- **Precedence:** where the pack's generic patterns conflict with this file, this file wins unless the owner decides otherwise. Known conflicts: the pack's separate dev build / `VH_DEV_CONSOLE_ONLY` vs the v23 `DevPanel` in `game.js` (PX03 = owner decision — flag, don't change silently); the outdated "three runtime files" rule (lifted 2026-10-18); `M00` (removed in v22, campaign is M01–M240); generic test advice maps to the existing `qa/*.mjs` bots. Full list: `docs/claude/SKILLS_PACK.md`.
