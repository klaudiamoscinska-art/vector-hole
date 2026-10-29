# Skills pack „Vertical Hole” and the P00 gate — full reference

Moved verbatim from `CLAUDE.md` (OPT-2, 2026-10-24). `CLAUDE.md` keeps the
gate rules, the hard rules and the precedence list. Read this before
updating the packs or running P00. DOCS-1 (2026-10-29) added the conflicts
marked (DOCS-1), "Choosing skills", "P00 inside a stage" and the prompt-queue
status; the pack files themselves are unchanged.

## Skills pack „Vertical Hole” (`.claude/skills/vh-*`, skills v1.4.3 · prompts v1.4.4)

One installation, no older copies: 22 skills on demand (`/vh-director`, `/vh-arena-gameplay`, `/vh-test-console`, … — full table in `.claude/vertical-hole/PACK_README.md`, the v1.4.3 pack README), 16 shared references in `.claude/vertical-hole/` (`PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`, `ARENA_DISTRICT_CONTRACT.md`, `SAVE_MIGRATION_CONTRACT.md`, `CHANGE_SAFETY.md`, `EVIDENCE_FRESHNESS.md`, `RELEASE_DEBUG_GUARD.md`, `WORKFLOW.md`, `QUALITY_GATES.md`, `EVENT_TAXONOMY.md`, `PLATFORM_RULES.md`, `TECHNICAL_PATTERNS.md`, `TEST_MATRIX.md`, `EXPERIMENT_PLAYBOOK.md`, `REPORT_TEMPLATE.md`, `SKILL_EVALUATION.md`), audit helpers in `.claude/vertical-hole/tools/` (`check_evidence.py`, `check_pages_workflow.py`, `verify_release_artifact.py`), the starter prompt in `.claude/vertical-hole/START_PROMPT.md`. The prompt pack v1.4.4 (P00, 15 development prompts, repair queue PX01–PX05, generated `WSZYSTKIE_PROMPTY.md`, `check_prompts.py`) lives in `.claude/vertical-hole-prompts/` — paste a prompt file into a fresh Claude Code session; its first line invokes the main skill. The pack calls the game „Vertical Hole” — it is this game, Vector Hole. Update both packs only from their official ZIPs (skills: run the pack's `scripts/install.py <repo> --dry-run`, then `--force` from the extracted ZIP, never unzip onto the repo; prompts: replace the whole folder), and check with the pack's `python scripts/validate.py --repo <repo>` and `python .claude/vertical-hole-prompts/check_prompts.py` — both check structure only, not the game.

Before changing code, read `.claude/vertical-hole/PROJECT_CHARTER.md`; for bigger tasks also `WORKFLOW.md` and `QUALITY_GATES.md`; before changes and save migrations `.claude/vertical-hole/CHANGE_SAFETY.md`. Use the matching skill on request or when its description fits — don't run them all by routine. Skills are on-demand instructions, not agents running in the background.

**Gate before development (P00):** run `.claude/vertical-hole-prompts/P00.md` as a read-only audit before new features and write the result to `VH_PREFLIGHT_REPORT.md` (commands, git revision, `PASS / FAIL / NOT RUN`). Read `.claude/vertical-hole/PREFLIGHT_GATES.md` and `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` before new features. `GO_CORE` = no active energy, Arena fully isolated, working loop, safe save migration per `SAVE_MIGRATION_CONTRACT.md`; `GO_TOOLS` (separately) = working dev panel and none of its code in production — missing it doesn't block FTUE fixes; `GO_RELEASE` needs both plus platform sign-offs and `python .claude/vertical-hole/tools/check_pages_workflow.py --repo .`. Evidence must match the current worktree hash, not just git HEAD (`.claude/vertical-hole/EVIDENCE_FRESHNESS.md`); dev panel/build rules: `.claude/vertical-hole/RELEASE_DEBUG_GUARD.md`. No evidence = `NOT RUN`, never `PASS`. P00 only verifies (energy, isolation and the dev panel are already implemented — don't re-implement them); a confirmed FAIL goes to its own repair prompt PX01–PX05, one at a time, then P00 again. The pack's 2026-10-17 hypotheses about this repo (`DevPanel` in `game.js`, shared coins/XP and `SKINS` perks reaching Arena, `loadSave()` writing a migration on read) must be confirmed on the current revision and reported, not fixed automatically; the fourth (Pages publishing `claude/**` and `path: "."`) was fixed by PX04 — see Deployment; `loadSave()` writing on read was fixed by PX01; perks and `RUN_TOOLS` reaching Arena were removed by PX02 D+ (owner decision; the shared wallet stays, with the one accepted Arena → mission-booster exception).

Hard rules (from the pack, consistent with v22): Arena First; Arena independent of the district campaign; no energy mechanic gating play on any platform (growth fragments/„ścieżki energii” are growth pickups, not an entry limit); speed and mobile first; honest monetization within each portal's rules. Discover the game's technical state in the current repo — don't assume paths or functions. Make small changes, run tests, report evidence (`PASS / FAIL / NOT RUN`). Don't publish, sign agreements, spend money or perform destructive operations without explicit consent. When tools or tests are missing, say clearly what wasn't verified.

**Precedence:** where the pack's generic patterns conflict with the sections above, this file wins unless the owner decides otherwise. Known conflicts:
- `TECHNICAL_PATTERNS.md`, `RELEASE_DEBUG_GUARD.md` and `vh-test-console` call for a separate dev build / release artifact (`VH_DEV_CONSOLE_ONLY`) and no debug code in production JS — here the rules are native ES modules without a bundler, a CI-only release assembly (no build step for development), and the v23 `DevPanel` (code-hash gate + sandboxed save slot) living in `game.js`. Changing that (PX03) is an owner decision; flag it, don't do it silently.
- The pack's (and older reports') mentions of the "three runtime files" rule (`RELEASE_DEBUG_GUARD.md` "skopiowano trzy pliki", `TECHNICAL_PATTERNS.md`, `VH_PREFLIGHT_REPORT.md`) are outdated: the owner lifted it on 2026-10-18; the release layout is the one in Deployment. The frozen root `game.js` contains `DevPanel` exactly like today's production — PX03 decides what replaces it.
- `vh-mission-content` mentions M00–M240 — `M00` was removed in v22; the campaign is M01–M240.
- Generic advice on tests (Playwright, unit runners) maps to the existing `qa/*.mjs` bots; extend those instead of adding a test framework or dependency. The pack's Python helpers are dev-only audit tools, not game runtime.
- Platform/monetization facts in `PLATFORM_RULES.md` are dated 2026-10-16 — re-verify against official docs before a release.
- (DOCS-1, 2026-10-29) `CHANGE_SAFETY.md` "nie rób automatycznego commitu ani push" — a stage prompt from the owner that orders commits and a push of the stage branch overrides it (never `main`; the flow is `docs/claude/DEPLOYMENT.md` "Stage flow").
- (DOCS-1) `vh-release-manager` "Twarde veto GitHub Pages (2026-10-17)" and `PREFLIGHT_GATES.md` veto 4 describe the pre-PX04 workflow (`claude/**`, `path: "."`); today the workflow deploys only from `main` and only `release/` — still run `check_pages_workflow.py`, but the described FAIL is history. `PREFLIGHT_GATES.md` vetoes 2–3 (`SKINS.perks`/`RUN_TOOLS` in Arena, `loadSave()` writing on read) and `vh-progression-economy`'s `SKINS.perks` note are fixed (PX02 D+, PX01) — confirm, don't re-fix.
- (DOCS-1) `vh-director` says "21" skills (there are 22) and proposes a `decision-log.md` under `docs/`, which does not exist — owner decisions live in `docs/GAME_DESIGN.md` §7, `docs/CHANGELOG.md` and the stage reports; don't create a parallel log.

## Choosing skills (DOCS-1)

Pick 1–3 per task; the slash command of the main one first, helpers only when
the task really reaches their area. Typical sets:

| Task | Main | Helpers (only if needed) |
|---|---|---|
| Arena rules, feel, rivals | `vh-arena-gameplay` | `vh-ux-gamefeel`, `vh-qa-automation` |
| Engine code, refactor (E4) | `vh-game-engineer` | `vh-qa-automation`, `vh-performance` |
| Missions, campaign content | `vh-mission-content` | `vh-narrative-localization` |
| Economy, prices, boosters | `vh-progression-economy` | `vh-save-security` (any save field) |
| Saves, migration, XSS | `vh-save-security` | `vh-qa-automation` |
| Phone layout, input, frames | `vh-mobile-accessibility` | `vh-ux-gamefeel` |
| Performance | `vh-performance` | `vh-qa-automation` |
| Portal SDK, ads (PORTAL-1) | `vh-portal-integrations` | `vh-monetization`, `vh-legal-risk` |
| Device QA (DEVICE-QA) | `vh-qa-automation` | `vh-mobile-accessibility` |
| Release, PR, deploy (RELEASE) | `vh-release-manager` | `vh-qa-automation` |
| Docs / instructions only | none needed | — |

Token rule: a skill's entry contract (`PROJECT_CHARTER.md`, `PREFLIGHT_GATES.md`,
`ARENA_DISTRICT_CONTRACT.md`, `WORKFLOW.md`, `CHANGE_SAFETY.md`,
`EVIDENCE_FRESHNESS.md` — together ~32 KB, measured 2026-10-29) is read once per
session, not again for every further skill, and only by tasks that change
code or saves. The invariants in `CLAUDE.md` always apply.

## P00 inside a stage (DOCS-1, codifies the CONTENT-1 practice)

A stage's P00-CORE / DEPLOY gate table is built from the stage's own runs on
the base and the candidate (same machine, paired seeds) — no extra full run:

| Gate | Evidence |
|---|---|
| CORE-ENERGY | `qa/v22.mjs` |
| CORE-ISOLATION | `qa/px02-isolation.mjs`, `qa/v22.mjs` |
| CORE-LOOP | `qa/flow.mjs`, `qa/ftue1.mjs`, `qa/ftue3.mjs`, `qa/leave-run.mjs`, `qa/campaign-bots.mjs` |
| CORE-SAVE | `qa/save-safety.mjs` (+ `SAVE_SCHEMA_VERSION` = 13, every new field in `defaultSave()`) |
| TOOLS-DEV | `qa/dev-panel.mjs` (the pack's FAIL stays until the owner decides PX03) |
| DEPLOY-PAGES | `python .claude/vertical-hole/tools/check_pages_workflow.py --repo .`, `qa/release.mjs`, `qa/release-recovery.mjs` |

The table goes into the stage report (as in CONTENT-1's `VH_PREFLIGHT_REPORT.md`;
BALANCE-1 and MOBILE-PERF-1 listed the same suites without the gate labels); a
standalone P00 run writes `VH_PREFLIGHT_REPORT.md`. A stage
that changes only documentation or instructions (no `game.js`, `style.css`,
`index.html`, `qa/`, `.github/scripts/`, workflow) needs no P00 and no game
QA: run `node qa/instructions.mjs`, `python .claude/vertical-hole-prompts/check_prompts.py`,
a link/path check and a diff review proving no runtime file changed.

## Status of the pack's prompt queue (2026-10-29)

The pack's prompts were written on 2026-10-17, before the owner's own stage
prompts. Their descriptions of the game may be stale; before running one,
read the `docs/CHANGELOG.md` entry of the stage that already touched its area:

| Pack prompt | Area already touched by (CHANGELOG / git history) |
|---|---|
| PX01 save · PX02 isolation · PX04 Pages | PX01, PX02 D+, PX04 (then E2 + E3) — done |
| PX03 dev panel | open — owner decision |
| PX05 live production | partly: the workflow's `verify-live` + live smoke tests after merges; a full PX05 belongs to RELEASE |
| P04-05 first 5 minutes · P08 result screen | FTUE-1, FTUE-3 |
| P14A portrait · P14B pause / focus | FTUE-2, FTUE-2 FIX |
| P06A M32 icon · P06B M59 · P09 goal icons · P10 names | CONTENT-1 |
| P11 boosters · P12 rewards / Warsztat · P13 difficulty | BALANCE-1 (and VISUAL-1 for Warsztat) |
| P14E prisms | v22 (prism uses: a booster for 4 ◆, prism looks) |
| P07 rival size vs ranking · P14C restore purchases · P14D first-session analytics | no stage yet — check the current code first |
