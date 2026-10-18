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
node qa/dev-panel.mjs      # v23: dev panel -- access (hidden gesture, code, lockout, ?dev, simulated production host; VH_DEV_CODE=... also checks the real code), test-mode isolation (real save untouched, no analytics sink/cloud mirror/real ads/payments), every tab and what it unlocks really working in the game, phones portrait/landscape + desktop
node qa/dev-code.mjs "<code>"  # v23: prints DEV_CODE_HASH for a new dev code
node qa/save-safety.mjs    # PX01: a newer (schema > current), broken (truncated JSON) or partly broken (wrong field type) save is never written over -- not on load and not by any later autosave (login, chest, Arena round, mission, tab switch, reload); the player's explicit repair / start over / reset keeps the original under `.rescue`; migrations commit only after a verified result and a `.bak` of the original; two tabs (storage event + read-before-write); QuotaExceededError / refused backup / interrupted commit / unreadable storage; cloud copy from a newer version, broken or empty is never overwritten; review regressions R1–R4 (reset without a rescue copy deletes nothing, a failed local write is never mirrored, an existing empty key is a broken save, unreadable storage shows a notice). Fixtures -> qa/out/save-fixtures/
node qa/px02-isolation.mjs # PX02 D+ (owner decision): ISO-A..D -- Arena, Daily and friend challenges start with the same parameters for any campaign progress, coins, XP, level and any vortex (bought for real in Warsztat); GRAJ / replay / rematch start at once with nothing for sale; Arena rounds change nothing in the campaign; BOOST-01..03 -- mission boosters never touch the Arena, Magnes/Sprint/Turbo start/Zegar/Tarcza still act in missions, no Turbo for coins or ads in the Arena; LEGACY-01..08 -- the one-time vortex refund (4870 for the 6 paid vortices) is paid once per save line, with its marker in the same write, never while SAVE_GUARD holds a save, rolled back on a failed write, kept by the previous release (5db3b02, read from git), safe across reloads, two tabs, cloud copies and backup codes; review fixes (`--review` runs only these): LEGACY-09 the refund card waits for its "seen" write, LEGACY-10 a backup code / cloud copy whose write fails is never confirmed as loaded, UX-01 the Warsztat title fits next to the wallet at 375/360/320 px. Fixtures -> qa/out/px02-fixtures/
node qa/v22.mjs            # v22: no energy anywhere (source, DOM, store, ads) + 15 rounds / 6 Dailies / 15 mission attempts in a row at 0 coins; first launch = an Arena round with the whole bestiary; campaign progress changes nothing in Arena and vice versa; same unlocks in either order; each mode pays for what it sells (bots); first-round coach only for a hesitating player (EN too); v12 -> v13 migration + reload; prisms (booster for 4 ◆, prism looks)
node qa/v21.mjs            # v21: big screens -- phones keep their framing; 1366×768/1440×900/1920×1080 see about a phone's worth of city with a bigger vortex, cursor steering through the zoom, bigger HUD/minimap; desktop layout (body.wide): nav rail + two columns on Miasto/Dzielnice/Warsztat/Wyzwania/results at 960×540…1920×1080 and 1180×820, all 12 districts in view, nothing sideways; portrait phones/tablets keep the phone layout; district strip mouse wheel + edge fades
node qa/v20.mjs            # v20: gates are helpers -- no mission asks to go through a gate/portal, impulse pad (+50% speed, recharge), two-way portal pair, M11 „Pierwszy impuls” shows a pad + food on its first frame, EN chips
node qa/v19.mjs            # v19: English (a full sweep in an en-US browser with ?i18n=log: nothing Polish reaches the screen), language switch, cloud save restore/mirror (mocked CrazyGames SDK), backup code
node qa/v18.mjs 3          # v18: Sprint booster, defeat -> suggested booster pre-picked in the briefing, booster for an ad when short on coins, store booster packs, booster balance (casual bot, hard missions, with/without each booster)
node qa/v17.mjs            # v17: first screen = live mini round (eats, tiers, rival, loop), Miasto (v17.1) = one Core City hero card with its hook in words above GRAJ, no empty band, no scrolling, labels layered over live canvases
node qa/audio.mjs          # v16: music bank integrity, offline renders (clipping, loudness spread, layers, voice budget), drop/rotation/Daily/boss logic, pause low-pass, NASTĘPNY, TERAZ GRA chip, Szafa grająca, scene stress, a bot round with audio on
node qa/v15.mjs            # v15: 240-mission content, tap-to-start, boosters, stars + chests, fail reasons, pity Zegar, save v11 -> v12, briefing layout
node qa/difficulty.mjs 2 4 # v15: every mission by the expert + casual campaign bot under its real limit -> pass rate per difficulty (must rise), per district
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
