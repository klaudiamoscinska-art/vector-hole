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
node qa/arena-bots.mjs 20  # a 20-round Arena career: greedy/random/afk players, difficulty curve, economy, frame budget
node qa/campaign-bots.mjs 22  # greedy bot plays the first N campaign missions in virtual time
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
