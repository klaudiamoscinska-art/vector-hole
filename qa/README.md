# QA bot-testers (dev-only)

Not part of the game runtime (the files the game runs from are read from
`index.html` by `readRuntimeSources()` — today `index.html` / `style.css` /
`game.js`). Plain Node ES modules driving the Playwright install already on
the machine — no `package.json`, no build step.

```bash
node qa/run-all.mjs        # everything below, exit 1 on any failure (prints the environment, writes qa/out/environment.json)
node qa/release.mjs        # E3: the published artifact -- runs .github/scripts/assemble-release.mjs on snapshot histories (L1: + the deployment ledger read from a fake GitHub API): exact file list, frozen classic root pins, v/<id>/ = repo bytes, graph = readRuntimeSources(), QA-leak checks (the harmless QA_BRIDGE_NAMES comment passes, real hooks / qa/ files fail), 17 broken graphs, retention scenarios, live pre/post-checks on a local fake site, the workflow's own bash check; in Chromium: new HTML (/ and /vector-hole/), old cached HTML + frozen root, negative "E2 alone" (SyntaxError), mixed versions with the real HTTP cache (max-age=600), long-open page reloading, one save for old and new code, rollback
node qa/release-recovery.mjs # K2 break-glass (docs/E3_ROLLBACK_PLAN.md §4), no browser: the real release script + the workflow's bash steps on snapshot histories, a fake GitHub API and a fake Pages site -- authorization (owner-only first-attempt dispatch on main for main's sha; a standard run takes no recovery input; a record never serves another run), the standard run unchanged (404/MIME/disagreement/API/immutability still STOP), recovery rebuilds a 404/mistyped live file with its published bytes and accepts a live/ledger mismatch only when the ledger keeps the live release (same retention and artifact as a standard run), every other STOP kept (other bytes, 5xx/410, index 404, root/pins, moved main, off-chain release, save schema < 13), and the next standard run passes
node qa/bridge.mjs         # E2: game.js as an ES module -- one module script, loaded once, same boot as the classic base (listeners -- plus the ones a later stage declares in ADDED_SINCE_BASE --, writes), the QA bridge on live bindings (getters, the SAVE_MIRROR setter), exact export list, negative checks (no bridge, missing export, broken setter, failed import, second copy)
node qa/boot.mjs           # E1: the game starts (fresh phone pl-PL, fresh desktop en-US, saved profile), no page errors, loads exactly the runtime files from index.html (all 200), nothing external
node qa/trace.mjs          # E1: deterministic trace -- an Arena round + the FIRST clear of mission M01, each played twice from the same seed, must match exactly (--record FILE / --compare FILE, --seed=N, --mission=Mxx)
node qa/edge-cases.mjs     # broken saves, private mode, monkey taps, pause/resize spam, XSS, clock rollback, hostile links
node qa/features.mjs       # audio, every ad placement (demo + mocked native IAP), revive, share card, challenge links, GDPR, save seal
node qa/visual.mjs         # v12: Neon City floor (Arena/Campaign/menus), swallow animation, crown, cached HUD, camera + radius cap, sticky result CTA, rasterized render budget
node qa/design.mjs         # v13: first seconds (first bite, bites/10 s), close race vs the pacer, drag steering, tutorial, newbie path, Daily preview = real map, locked-object hint, gender-neutral copy, phone layouts (iPhone 16 Pro / SE: nav labels + profile reset on screen)
node qa/flow.mjs          # v14: start screen = logo + GRAJ, Miasto without a floating GRAJ and without scrolling, Dzielnice starts the next mission without scrolling, briefing on every mission tap, result previews the next mission, NELA bubbles, Warsztat tap-to-wear / confirm-to-buy, review regressions (legacy saves, replays, step banners)
node qa/dev-panel.mjs      # v23: dev panel -- access (hidden gesture, code, lockout, ?dev, simulated production host; VH_DEV_CODE=... also checks the real code), test-mode isolation (real save untouched, no analytics sink/cloud mirror/real ads/payments), every tab and what it unlocks really working in the game, phones portrait/landscape + desktop
node qa/dev-code.mjs "<code>"  # v23: prints DEV_CODE_HASH for a new dev code
node qa/save-safety.mjs    # PX01: a newer (schema > current), broken (truncated JSON) or partly broken (wrong field type) save is never written over -- not on load and not by any later autosave (login, chest, Arena round, mission, tab switch, reload); the player's explicit repair / start over / reset keeps the original under `.rescue`; migrations commit only after a verified result and a `.bak` of the original; two tabs (storage event + read-before-write); QuotaExceededError / refused backup / interrupted commit / unreadable storage; cloud copy from a newer version, broken or empty is never overwritten; review regressions R1–R4 (reset without a rescue copy deletes nothing, a failed local write is never mirrored, an existing empty key is a broken save, unreadable storage shows a notice). Fixtures -> qa/out/save-fixtures/
node qa/px02-isolation.mjs # PX02 D+ (owner decision): ISO-A..D -- Arena, Daily and friend challenges start with the same parameters for any campaign progress, coins, XP, level and any vortex (bought for real in Warsztat); GRAJ / replay / rematch start at once with nothing for sale; Arena rounds change nothing in the campaign; BOOST-01..03 -- mission boosters never touch the Arena, Magnes/Sprint/Turbo start/Zegar/Tarcza still act in missions, no Turbo for coins or ads in the Arena; LEGACY-01..08 -- the one-time vortex refund (4870 for the 6 paid vortices) is paid once per save line, with its marker in the same write, never while SAVE_GUARD holds a save, rolled back on a failed write, kept by the previous release (5db3b02, read from git), safe across reloads, two tabs, cloud copies and backup codes; review fixes (`--review` runs only these): LEGACY-09 the refund card waits for its "seen" write, LEGACY-10 a backup code / cloud copy whose write fails is never confirmed as loaded, UX-01 the Warsztat title fits next to the wallet at 375/360/320 px. Fixtures -> qa/out/px02-fixtures/
node qa/v22.mjs            # v22: no energy anywhere (source, DOM, store, ads) + 15 rounds / 6 Dailies / 15 mission attempts in a row at 0 coins; first launch = an Arena round with the whole bestiary; campaign progress changes nothing in Arena and vice versa; same unlocks in either order; each mode pays for what it sells (bots); first-round coach only for a hesitating player (EN too); v12 -> v13 migration + reload; prisms (booster for 4 ◆, prism looks)
node qa/ftue1.mjs          # FTUE-1 „Druga runda”: the first Arena result shows no card and no ×2 ad (reward unchanged; also a new player's first finished result after a round left early -- same session, relaunch, existing save -- while an older save without finished-round history keeps it, and only one ad-free result after a friend's challenge played first), ZAGRAJ JESZCZE RAZ starts round 2 at once (same 2:00), Warsztat / Wyzwania cards wait for the result animation and never pile up later, the campaign is presented on Miasto's tile after round 3 (not again once met), the login calendar waits for the 2nd Miasto visit or a relaunch (one claim per day), existing saves after 1 / 2 / 3+ rounds with or without the campaign announced lose or repeat nothing, EN tile copy; 390x844, 375x667, 844x390, 1280x720
node qa/instructions.mjs   # OPT-2 (no browser): CLAUDE.md still states every non-negotiable rule (main protection, owner/GPT approval, Polish, preflight, evidence, SAVE v13, Arena/campaign isolation, economy, deployment/rollback, P00) or points to its contract; HANDOFF mandatory after every significant stage (never "when asked") and the template has all 7 fields; every path CLAUDE.md and docs/claude/* name exists; CLAUDE.md <= 20 KB
node qa/responsive.mjs     # FTUE-2 platforms: 21 frames (the owner's 14 + CrazyGames' iframe sizes) x every main screen (+ the whole catalogue of 26 screens in 7 sizes): no page scroll, no control cut off / outside the viewport / covered (consent bar, nav, HUD) / overlapping, the main action in view without scrolling and hit where drawn, tap >= 24 px (main >= 36), text >= 9 px on screen, HUD coverage <= 34% with the vortex free; a portal-like host page (another origin, 3000 px tall) with the game in an iframe: menu keys, Space, wheel and Ctrl+wheel never scroll the host, the game's panels still scroll, P / Space / Escape pause, the cursor leaving the frame stops the vortex, focus loss releases held keys and pauses, no steering under a modal, typing never steers, the frame growing to fullscreen (CSS and the real Fullscreen API) and back mid-round; a phone turned mid-round / on the pause sheet / on Miasto; touch drag + cancel; live window resizes. Screenshots + report.json -> qa/out/responsive/<WxH>/ (--only=844x390,... --scenes=hub,... --layout-only / --input-only)
node qa/leave-run.mjs      # leaving an Arena round (R1): at score 0 nothing is granted or counted -- save unchanged, also 5x and after a relaunch; left after one bite / a bigger score: exactly the partial coins (coinsSqrtK*sqrt(score), newbie x) and XP (xpSqrtK*sqrt(score)), no Core City, run count, PB, prisms, daily mission or Daily bonus; finished rounds pay in full and open Warsztat/Wyzwania as before; existing save, Arena/campaign isolation
node qa/v21.mjs            # v21: big screens -- phones keep their framing; 1366×768/1440×900/1920×1080 see about a phone's worth of city with a bigger vortex, cursor steering through the zoom, bigger HUD/minimap; desktop layout (body.wide): nav rail + two columns on Miasto/Dzielnice/Warsztat/Wyzwania/results at 960×540…1920×1080 and 1180×820, all 12 districts in view, nothing sideways; portrait phones/tablets keep the phone layout; district strip mouse wheel + edge fades
node qa/v20.mjs            # v20: gates are helpers -- no mission asks to go through a gate/portal, impulse pad (+50% speed, recharge), two-way portal pair, M11 „Pierwszy impuls” shows a pad + food on its first frame, EN chips
node qa/v19.mjs            # v19: English (a full sweep in an en-US browser with ?i18n=log: nothing Polish reaches the screen), language switch, cloud save restore/mirror (mocked CrazyGames SDK), backup code
node qa/v18.mjs 3          # (E1: seeded, --seed=N replays, --calibrate=K [--paired] = diagnostic over K seeds) v18: Sprint booster, defeat -> suggested booster pre-picked in the briefing, booster for an ad when short on coins, store booster packs, booster balance (casual bot, hard missions, with/without each booster)
node qa/v17.mjs            # v17: first screen = live mini round (eats, tiers, rival, loop), Miasto (v17.1) = one Core City hero card with its hook in words above GRAJ, no empty band, no scrolling, labels layered over live canvases
node qa/audio.mjs          # v16: music bank integrity, offline renders (clipping, loudness spread, layers, voice budget), drop/rotation/Daily/boss logic, pause low-pass, NASTĘPNY, TERAZ GRA chip, Szafa grająca, scene stress, a bot round with audio on
node qa/v15.mjs            # v15: 240-mission content, tap-to-start, boosters, stars + chests, fail reasons, pity Zegar, save v11 -> v12, briefing layout
node qa/difficulty.mjs 2 4 # (E1: seeded, --seed=N replays) v15: every mission by the expert + casual campaign bot under its real limit -> pass rate per difficulty (must rise), per district
node qa/calibrate.mjs 10 4 # v15: re-measure MISSION_BOT_TIME (expert bot, no limit) and print the table for game.js (v20: a 3rd arg M05,M13 measures just those)
node qa/arena-bots.mjs 20  # a 20-round Arena career: greedy/random/afk players, difficulty curve, economy, frame budget
node qa/campaign-bots.mjs 30  # the expert campaign bot plays the first N missions (play order) under their real limits
node qa/screens.mjs        # phone-size screenshots of the v11 + v12 screens -> qa/out/screens/
```

The bots tick `game.update()` in **virtual time** (RAF loop detached,
`performance.now` advanced per simulated frame), so a 2-minute round runs in
well under a second. Results and screenshots land in `qa/out/` (git-ignored).
Headless Chromium renders in software, so absolute render times are
pessimistic; the perf gate checks the low-end quality level the in-game
frame watchdog falls back to.

`QA_TICK` (in `lib.mjs`) advances a round part-way (`__qaTick(frames,
renderEvery)`) and stages a mid-swallow moment (`__qaSwallowScene()`) for
screenshots and visual checks. Render timings that matter use a forced
`getImageData` flush, since canvas work is otherwise deferred and a plain
`render()` call only measures command recording.

Player styles in `ARENA_BOT`: `greedy` (sees the whole map, best value per
distance — an expert), `casual` (v13: sees only the screen, re-aims every
~0.4 s, goes for the nearest bite — the yardstick for design decisions),
`random` and `afk`.

v15 campaign bot (`CAMPAIGN_BOT` in `lib.mjs`, `__qaPlayMission(id, opts)`):
`expert` (whole board, re-aims every frame, flees bigger rivals and glitch
zones early) or `casual` (screen-only view, or the light circle in a
blackout; re-aims every ~0.4 s with ±12° aim wobble; follows the edge
arrow when nothing is in view). `openLimit` plays without a time limit
(calibration), `boosters` pre-picks mission boosters.

v19: the suites run as a Polish browser (`openGame(..., { locale: 'pl-PL' })`
by default) because the game picks its language from the browser; pass
`locale: 'en-US'` for English. `?i18n=log` collects untranslated Polish that
reached the screen in `I18N.misses`; `?i18n=all` logs every string the
translation layer passed through unchanged (for a manual review).

## E1: modularization safety net

Added before `game.js` is split into ES modules (owner decision 18.10.2026),
so a refactor that must not change the game can prove it doesn't.

- **`expectAll(name, checks, context)`** (`lib.mjs`): one report line like
  `report()`, but each condition is named — `is(a, b)` (strict `===`),
  `truthy(v)`, `falsy(v)`, `matches(re, s)`, `notMatches(re, s)`,
  `holds(ok, actual, want)` — and a FAIL lists every one that didn't hold
  with what it got: `3/9 failed [coins: got 700, want 777; ...] | {json}`.
  PASS is still "all hold"; use it for chains of `&&` where the summary
  JSON alone doesn't say which term broke. Piloted in `v22.mjs` (save
  v12 → v13, reload) and `v21.mjs` (desktop Miasto / Dzielnice).
- **Seeds** (`QA_RANDOM`, `seedFor()`, `baseSeed()`): `__qaSeedRandom(seed)`
  in the page turns `Math.random` into a mulberry32 stream (and counts its
  draws), `__qaRestoreRandom()` puts the browser's back. Opt-in: only
  `v18.mjs` (balance), `difficulty.mjs` and `trace.mjs` use it. Each attempt
  reseeds inside its own `page.evaluate` (menu animations draw between
  calls) from `seedFor(base, ...)`; `base` is new every run (fresh layouts,
  as before), printed and stored in `qa/out/v18-balance.json` /
  `qa/out/difficulty.json`; `--seed=N` or `VH_QA_SEED=N` replays it.
  `node qa/v18.mjs --calibrate=K [runs] [--paired]` is a diagnostic over K
  base seeds (how often each balance check passes; `--paired` = the same
  layouts for every booster); it is not a gate and the thresholds are not
  touched.
- **Bots**: `__qaPlayArena` / `__qaPlayMission` take `clock0` (where the
  virtual clock starts) and `onFrame(frames, game)` (an observer, called
  after each simulated frame). Without them they run exactly as before.
- **`trace.mjs`**: plays an Arena round (layout seed + greedy bot) and the
  first clear of M01 (expert bot; the campaign profile has a fresh
  `defaultSave()` campaign block, so M01 is not completed before -- note
  that `veteranSave()` reads `missions: 0` as 6, `o.missions || 6`) on
  synthetic profiles in fresh browser profiles, with a
  seeded `Math.random`, a frozen wall clock (`frozenDateScript()`) and a
  pinned virtual clock, sampling player x/y/radius/score, objects
  swallowed, every hole, time left / elapsed, goal progress and the number
  of `Math.random` draws; the end state adds the bot's result, the
  progression (coins, prisms, XP, stats, Core City, campaign) and the
  stored save (bytes + SHA-256). The campaign scenario also asserts the
  first clear itself: not completed / no attempts / no stars before, cleared
  by the bot, completed after, and coins, prisms, XP (with level-ups), star
  bits, star chests, districts and the stored save exactly as the
  first-clear rules give them. A baseline of another `TRACE_VERSION` is
  reported as not comparable (v2: the campaign scenario became a first
  clear). Left out of the comparison: the bot's
  frame timings (machine speed). Held fixed in its profile: music and SFX
  off (the music sequencer schedules on the real-time AudioContext clock
  and draws `Math.random` per note, so with audio on the draws depend on
  how fast the machine is). Workflow for a refactor: on the base commit
  `node qa/trace.mjs --record /some/where/base-trace.json`, on the change
  `node qa/trace.mjs --compare /some/where/base-trace.json` — it prints the
  first difference (sample, frame, field, both values). `run-all` runs the
  self-check (two runs identical).
- **`readRuntimeSources()`**: `index.html` plus the local `<script src>` /
  stylesheet files it loads and, for JS, the relative imports they reach
  (static and dynamic) — never `qa/`, `docs/`, `design/`, `.claude/`. The
  source scans in `design.mjs` (gender-neutral copy, jargon) and `v22.mjs`
  (no energy, no M00 tutorial) read it, and `v22.mjs` fails if its cut
  markers (`migrateSave()`..`loadSave()`, `I18N_EN`) aren't each found once
  or the scanned code no longer contains both modes, the save, audio, ads
  and the dev panel — so a split can't make the scan pass on less code.
- **`environmentInfo()`**: Node, Playwright, Chromium, git HEAD, changed
  paths, SHA-256 of every runtime file; printed by `run-all`, `boot`,
  `trace`, `v18`, stored in `qa/out/environment.json` and the trace file.
- **No-git mode (E3)**: `VH_QA_REVS=DIR` -- QA runs no git command at all:
  earlier revisions (`bridge.mjs`: the classic base 63b50d0; `release.mjs`:
  its index.html and frozen pair; `px02-isolation.mjs` LEGACY-06: 5db3b02)
  are read from `DIR/<full sha>/<file>` (`revisionFile()` in `lib.mjs`)
  instead of `git show`, and `environmentInfo()` reports
  `NOT VERIFIED (VH_QA_REVS offline mode, no git)` instead of HEAD. The
  snapshot is the runner's responsibility: check its hashes (the frozen pair
  is also checked against the release script's pins).

## E2: game.js is an ES module -- the QA bridge

`index.html` loads `<script type="module" src="game.js">` (E3: the
published page is the release script's rewrite of it, `v/<id>/game.js`;
`bridge.mjs` checks that result with a dry run instead of the old workflow's
grep guards). The bridge imports the page's own module URL, so it works the
same for `v/<id>/game.js`. A module keeps its top-level names to itself, so the bare names the suites use
inside the page (`CONFIG`, `defaultSave()`, `SAVE_GUARD`, `SAVE_MIRROR = fn`
...) come from the bridge in `lib.mjs`:

- `QA_BRIDGE_NAMES` -- the names the suites really read in the page (57,
  found by scanning `qa/` for game.js's top-level names and dropping
  comments, source-text scans and Node-side names); game.js's one
  `export { ... }` lists exactly these plus `setSaveMirror` (checked).
- `QA_BRIDGE` (init script, added by `openGame()`, px02's `sharedContext()`
  and the dev panel's production-host context via `installQaBridge()`): at
  DOMContentLoaded (game.js has run) an inline module script imports the
  page's own module URL -- the same instance, no second evaluation -- and
  defines each name on `window` as an accessor: get = the live binding,
  set = only `SAVE_MIRROR` (through `setSaveMirror()`, then re-read: a
  setter that doesn't reach the game throws), any other assignment throws.
  It holds the load event, so it's ready before `goto()` / `reload()`
  return; `openGame()` also waits on it (`waitForQaBridge()`), and every
  suite's "game is up" wait reads `window.game && window.__qaBridge &&
  window.__qaBridge.ready && ...` -- a reload the game starts itself (dev
  panel test mode, language switch) is polled while the page loads, and
  `window.game` exists a moment before the bridge does.
- Fails loudly: a missing export, a failed import, a second copy of game.js
  or "not ready at load" set `__qaBridge.error` and log a console error
  (the suites' no-runtime-errors checks), `openGame()` throws. A page with no
  module script (px02's previous release) keeps its classic globals.
- Nothing of this ships: the bridge lives in `qa/`; the game only gained the
  export list and `setSaveMirror()` (reachable by `import()` of game.js --
  strictly less than the 266 globals a classic script exposed).

Run the game over HTTP(S) (`python3 -m http.server`); `file://` can't load
a module script.

## E3: the release layout (`qa/release.mjs`)

Production is not the repo folder: the workflow runs
`.github/scripts/assemble-release.mjs`, which builds `release/` --
`index.html` (script/stylesheet rewritten to `v/<id>/`), the frozen last
classic `game.js`/`style.css` at the root (commit 63b50d0, SHA-pinned) for
browsers still holding a pre-E3 `index.html`, and the immutable `v/<id>/`
of this release and of the retained earlier ones (id = first 12 hex of the
commit). `release.mjs` runs that script as a child process (the same code CI
runs) with `--source fixture`: snapshot histories in `qa/out/release/`
(trees + `history.json`) stand in for git, so the retention rules are tested
on controlled histories, not on the real one. The worktree suites stay
separate: a PASS of `release.mjs` is about the assembled artifact, not the
repo folder, and never about the live site (the workflow's live checks and
the owner's iPhone test on a separate origin are).

- Negative checks must fail for the right reason: the "E2 alone" layout
  (old HTML + the module under the old address) must show the SyntaxError,
  the cache test has a control without retention that must 404.
- Playwright switches the HTTP cache off when a context intercepts requests
  (`context.route()`), so the cache checks run without interception.
- L1 (the deployment ledger): `release.mjs` starts a fake GitHub REST API
  (GET only, `/repos/{o}/{r}/deployments` + `/deployments/{id}/statuses`,
  pagination with `Link`, GitHub's 90-day deletion of older statuses
  simulated) and runs the script's `ledger` command against it, then the
  assembly with `--ledger`. Covered: first versioned deploy with only
  classic records, the API not showing the newest deploy yet, success later
  inactive, failure / queued / in_progress / stale records, a failure
  between two successes, the same sha twice, an older sha again, forward
  rollback, the 30-day window vs the last 5, > 20 and > 60 releases, a
  never-published broken commit (left out) vs a published / maybe published
  / live broken one (STOP -- the gap GPT found), ledger vs live, bad shas,
  other repo/environment, bad or contradictory times and ids, duplicates,
  incomplete pagination, a next link to another server (refused, 0 requests
  there), HTTP 401/403/404/429/5xx, rate limit, timeout, broken JSON, no
  token, a superseded re-run, a stale or tampered ledger file, no silent
  `--no-ledger`, lazy status reads, GET-only + no token in any output.
  L1-R1 (shape of the real API, read in K0): the fake API's `Link` names the
  repository by id (`/repositories/<id>/...`) like GitHub, every record
  starts with `waiting`, records carry `performed_via_github_app`. Checks:
  264 records over 3 pages in both link forms (the script requests only its
  own `/repos/` URLs), 19 bad next links (host, user info, repository name
  or id incl. `$GITHUB_REPOSITORY_ID`, endpoint, `../`, environment,
  per_page, extra/duplicate parameter, missing/same/skipped/malformed page,
  two next, unreadable) = STOP before a second request; waiting -> ... ->
  success / failure / inactive, fresh (exit 3) and stale (maybe published)
  `waiting`, an unknown state; the first and second E3 deploy; since the era
  epoch only the `github-actions` app (also in the ledger file).
  These are fixture/mock results: the real API is first read by CI. The
  replay of the real K0 responses is a review-package harness, not a repo test.
- Not run here: the git source of the script (`gitHistory()`/`gitTree()`,
  `classify()`), the real GitHub API and the live site -- first executed by
  CI; WebKit (not installed).

Not covered yet (gates before E4): the Daily / friend challenge / twist
missions in the trace, Arena <-> Campaign import-edge rules for the module
graph (the release script already rejects bare/absolute/dynamic imports and,
for the release being published, cycles), the QA bridge for more than one
entry module, `px02-isolation.mjs` LEGACY-06 rebuilding the previous release
from a multi-file tree, `dev-code.mjs` finding `DEV_CODE_SALT` outside
`game.js`.

## Running on Windows

- A direct `node qa/<suite>.mjs` used to run nothing and exit 0 on Windows
  (`import.meta.url === \`file://${process.argv[1]}\`` never matches
  `file:///C:/...`) -- a silent false PASS. Every suite now uses
  `isMain(import.meta.url)` from `lib.mjs`; a run that prints no
  `N/M ... checks passed` line did not run.
- `release.mjs` / `release-recovery.mjs` import the release script by file
  URL (a bare `C:\...` path is not an ESM URL) and read the workflow with
  CRLF normalized (`core.autocrlf=true` checkouts).
- Symlinks need Developer Mode or admin rights: without them the two symlink
  negatives of `release.mjs` print `NOT RUN` (not counted as PASS) instead
  of crashing the suite; run them on Linux/CI or with Developer Mode.
- `check_pages_workflow.py` is called as `python3`; the Windows Store alias
  is not Python -- put a real `python3.exe` (e.g. a venv's `python.exe`
  copied as `python3.exe`) first on `PATH`.
