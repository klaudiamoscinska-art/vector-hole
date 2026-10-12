# QA bot-testers (dev-only)

Not part of the game runtime (still exactly `index.html` / `style.css` /
`game.js`). Plain Node ES modules driving the Playwright install already on
the machine — no `package.json`, no build step.

```bash
node qa/run-all.mjs        # everything below, exit 1 on any failure
node qa/edge-cases.mjs     # broken saves, private mode, monkey taps, pause/resize spam, XSS, clock rollback, hostile links
node qa/features.mjs       # audio, every ad placement (demo + mocked native IAP), revive, share card, challenge links, GDPR, save seal
node qa/visual.mjs         # v12: Neon City floor (Arena/Campaign/menus), swallow animation, crown, cached HUD, camera + radius cap, sticky result CTA, rasterized render budget
node qa/design.mjs         # v13: first seconds (first bite, bites/10 s), close race vs the pacer, drag steering, tutorial, newbie path, Daily preview = real map, locked-object hint, gender-neutral copy, phone layouts (iPhone 16 Pro / SE: nav labels + profile reset on screen)
node qa/flow.mjs          # v14: start screen = logo + GRAJ, Miasto without a floating GRAJ and without scrolling, Dzielnice starts the next mission without scrolling, briefing on every mission tap, result previews the next mission, NELA bubbles, Warsztat tap-to-wear / confirm-to-buy, review regressions (legacy saves, replays, step banners)
node qa/v17.mjs            # v17: first screen = live mini round (eats, tiers, rival, loop), Miasto's live Arena stage above GRAJ + record hook, no scrolling, labels layered over live canvases
node qa/audio.mjs          # v16: music bank integrity, offline renders (clipping, loudness spread, layers, voice budget), drop/rotation/Daily/boss logic, pause low-pass, NASTĘPNY, TERAZ GRA chip, Szafa grająca, scene stress, a bot round with audio on
node qa/v15.mjs            # v15: 240-mission content, tap-to-start, boosters, energy (spend/refund/regen/refill/free plays), stars + chests, fail reasons, pity Zegar, save v11 -> v12, briefing layout
node qa/difficulty.mjs 2 4 # v15: every mission by the expert + casual campaign bot under its real limit -> pass rate per difficulty (must rise), per district
node qa/calibrate.mjs 10 4 # v15: re-measure MISSION_BOT_TIME (expert bot, no limit) and print the table for game.js
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
