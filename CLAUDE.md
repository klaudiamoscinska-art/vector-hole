# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Vector Hole: Eat the Neon City** — a top-down, hole.io-style browser game (Polish UI): steer a vortex through a neon city, eat everything smaller, grow through six size tiers, eat smaller rivals, win 2-minute Arena rounds, play a 60-mission Campaign. **How the game works today (rules, numbers, copy tone): `docs/GAME_DESIGN.md` — read it before changing gameplay, balance or text, and update it with the code.** Version history: `docs/CHANGELOG.md`.

Vanilla HTML/CSS/JS, zero dependencies, no build step, deliberately exactly three runtime files:

- `index.html` — canvas, in-round HUD, and every screen (Miasto hub, Dzielnice, Warsztat, Wyzwania, run setup, profile, pause, quick-equip, evolution cards, tutorial coach card, game over, ad, mission result) present in the DOM at once and toggled with `.hidden`, plus a persistent bottom nav.
- `style.css` — neon visual system, responsive layout (phone first, desktop too), self-hosted subsetted fonts as base64 `@font-face` (the default build makes **zero** third-party requests — keep it that way).
- `game.js` — all game logic in one long file (ES6 classes: `Game`, `Hole`, `Bot`, `WorldObject`, `CampaignEntity`, `CityFloor`, `SoundEngine`, `Monetization`, `Analytics`, `SeededRNG`, `Particle`, `FloatText`, `Ripple`).

**Do not split `game.js` or add a build step / dependency without flagging it to the user first** — the three-file, zero-dependency rule is a deliberate, repeated instruction.

`design/` holds the original authored mockups (non-runtime): `reference/asset_bible.svg` is the palette source of truth; `screens/*.svg`, `assets/` and `gameplay/` (with their `.md` specs) are the original layouts and the v6 object/landmark specs — the game has evolved past the screen layouts since.

## Commands

No package manager, build or linter. Serve the folder and open `index.html`:

```bash
python3 -m http.server 8000   # http://localhost:8000/index.html (file:// works too)
```

QA bots (dev-only, plain Node ES modules using the machine's global Playwright, outputs in git-ignored `qa/out/`):

```bash
node qa/run-all.mjs     # edge cases, features, visual, design, 20-round Arena career, 22 campaign missions
node qa/design.mjs      # v13 design checks (first seconds, race, input, tutorial, newbie path, copy, phone layouts)
node qa/screens.mjs     # phone screenshots -> qa/out/screens/
```

Bots tick `game.update()` in virtual time (RAF detached, `performance.now` advanced per frame). `ARENA_BOT` styles: `greedy` (expert), `casual` (sees only the screen, reacts every ~0.4 s — the yardstick for design decisions), `random`, `afk`. Extend `qa/` when adding features (`qa/README.md`). Perf thresholds measure headless software rendering and vary by machine — compare against the base commit on the same machine before blaming a change.

## Deployment

Pushing to `main` runs `.github/workflows/deploy-pages.yml`, which uploads the repo root as-is to GitHub Pages. The workflow also runs on `claude/**` branches, but the `github-pages` environment only accepts deploys from `main`. `.nojekyll` stops Jekyll processing.

## Architecture

### Config, state, RNG, saves (top of `game.js`)

- **`CONFIG`** is the single tuning object (world, round, hole, growth, eating, economy, difficulty, rival, arena layout, progression, login, chest, hub, evolution, golden, ads, overdrive, campaign, sizeTiers, flags). Old top-level aliases (`WORLD_W`, `BASE_RADIUS`, …) point into it. Tune by editing `CONFIG`, not magic numbers in methods.
- **`CONFIG.flags`** gates major systems; `proceduralDistricts` stays `false` (no authored chunk generator was built).
- **`GameState`** (`BOOT/MENU/MATCH_SETUP/PLAYING/PAUSED/RESULTS`) on `Game.state`.
- **`SeededRNG`** (mulberry32) seeds only a round's *initial* layout (objects, street trails, spawn feasts, spawns) so Daily and friend-challenge maps are identical for everyone; mid-round randomness stays on `Math.random()`. Any new layout step must consume the seeded stream the same way whatever the player has discovered, and `computeDailyLayout()` must replay it exactly (`qa/design.mjs` asserts preview == real round).
- **Save**: `localStorage` key `vectorHoleSave_v1` (never changes), `SAVE_SCHEMA_VERSION` 11 with a `migrateSave()` chain (add an `if (data.schemaVersion < N)` branch per breaking change). Every load runs `sanitizeSave()` against `defaultSave()`, so **a new save field must be added to `defaultSave()`** to survive. `saveGame()` seals the payload (`_sig`).
- **Ranking is always by score** (`rankHoles()`; radius/name are tiebreakers). Don't reintroduce a radius sort.
- `Analytics` keeps an in-memory buffer and forwards to a host sink only with consent (`save.privacy.analytics`). No backend; the game sends nothing itself.
- `escapeHtml()` for every player-controlled string that reaches `innerHTML`.

### World and rendering

- Fixed 3000×3000 world, `Game.camera` follows the player; Arena zooms out with growth (`Game.zoom` — any screen↔world math must divide/multiply by it; Campaign keeps zoom 1). `render()`/`renderCampaign()` apply one translate for world space; minimap, indicators, goal arrow and juice draw in screen space.
- **`CityFloor`**: 8×8 grid of blocks (`CITY_PITCH` 375, `CITY_ROAD` 64) painted per district into cached chunk canvases (`paintCityChunk()`, `CITY_LOT_PAINTERS`), blitted per frame with lazy repaints, a prefetch ring and an LRU pixel budget. Floor art stays flat, low-alpha, in the district's toned color (`cityTone()`), no shadow blur, no dark disc with a bright rim (that reads as a hole). `qa/visual.mjs` asserts 0 chunk repaints over 60 still frames — keep it that way.
- **Objects** share illustrated sprites (`OBJECT_ART`, cached in `OBJECT_SPRITE_CACHE`, `drawObjectArt()`), identical in Arena and Campaign; `OBJECT_ART_LITE` (gfx level 0) skips per-object sway and live extras. Only draw what `isInView()`.
- **Holes**: `Hole.drawVortex()` spiral arms over a black core, per-skin rims (`SKIN_STYLES`), eaten things drawn inside the vortex while swallowed (`drawSwallowed()`, `swallowGhosts`), leader crown (`isLeader`), labels counter-scaled at far zoom.
- `#app` is `height: 100dvh` (fallback `100vh`): iOS Safari's `100vh` ignores its toolbars and hid the bottom nav labels and the profile reset button. Never size the app with plain `vh`; pad bottom-anchored UI with `env(safe-area-inset-bottom)` (`viewport-fit=cover` is on).
- Adaptive quality: `GFX_LEVELS`, `Game.applyGfx()`, `monitorFrame()` steps down on slow devices.
- In-round HUD writes go through `Game.hudSet()` (DOM write only on change). Juice helpers: `FloatText`, `flashScreen()`, `showBanner(text, sub, color, duration, priority)` (one banner at a time), `addScorePop()`, `hitStop()`, `spawnSuck()`. Use SVG/canvas glyphs, not emoji.

### Input

`save.settings.inputMode` (default `'legacy'` = direct drag; `'thumbpad'` = floating joystick in the bottom 35 %, gated by `CONFIG.flags.inputThumbPad`). Direct drag keeps the finger/cursor **screen** position (`pointerScreen`) and re-projects it through the camera every frame in `applyPlayerMovement()`; `pointerScreen` is cleared at round/mission start and on touch end, so the hole never drives itself and a held finger keeps steering. WASD/arrows are checked first.

### Arena round

- `startRound()` → `createObjects()` (seeded `TIERS` pool + `layStreetTrails()`), `createEntities()` (`rollSpawns()`, bots tuned by `Game.botTuning` from `difficultyT`, then `layStarterFeasts()`), pacer setup, 2.5 s spawn shield. `update()` → movement, bots, eating (`handleObjectEating()`, `holeCanEat()` = size-tier gate only; `lockedBump()` explains a too-big object), hole collisions (`EAT_HOLE_RATIO` 1.15, area-conserving growth), `updatePacer()`, tiers, evolution, overdrive, combo, HUD.
- **`TIERS` mirrors Campaign's bestiary 1:1** (fragment/capsule/prop/marker/vehicle/node/pylon/landmark/structure/heavy/tower — same colors, sizes, tier gates as `CAMPAIGN_ENTITY_STATS`). Arena only spawns types the player has discovered in Campaign (`save.campaign.discoveredTypes`).
- Growth: every eat adds `growth` units on the shared piecewise-linear curve (`CONFIG.growth`, `growUnits()`/`radiusForUnits()`); radius only via `setRadius()`/`growUnits()` (enforces `CONFIG.hole.maxRadius`).
- **Pacer rival (`CONFIG.rival`)**: `Game.pacer` (bot 0) follows a par curve from `save.stats.recentArenaScores` (last 5 finished rounds) and tails a runaway player; `paceMult` scales its points/growth, `paceHungry` widens its food range. Lead-change and final-chase banners live in `updateHUD()`.
- Difficulty: `computeDifficultyT()` from runs played (Daily/challenge use fixed `dailyT`); no Rush Hour at t = 0.
- Evolution cards (`MUTATIONS`, `offerEvolution()`, `showPowerCards()`) fully pause the round; POMIŃ skips; `autoPickMs` is only an AFK safety net. Overdrive ("WIELKI FINISZ", `checkOverdriveTrigger()`), Złoty Rdzeń + SZAŁ (`CONFIG.golden`).
- `endRound()` → `finalizeRun()` (coins, XP, Core City, Daily, stats, recent scores) → results screen with a sticky action bar.

### Campaign

Separate simulation (`Game.mode` 'campaign', `updateCampaign()`/`renderCampaign()`, `CampaignEntity` list). Missions are authored as `MISSION_SPECS` objective lists compiled by `compileMission()` with `MISSION_TIMING` calibrated by an automated playthrough — **when adding a mission, add a spec, not a hand-built setup, and re-run a playthrough before trusting its time limit.** `M00` is the tutorial (`goal.type 'tutorialChecklist'`, `untimed`, `starterRing`, one step at a time via `tutorialCurrentStep()`, coach card `showTutorialIntro()`); it teaches fragment/prop/vehicle and rival-eating so Arena can unlock. `drawCampaignGoalArrow()`/`campaignGuideTargets()` point to off-screen goal objects. Portal/Mostek/Pas przelotu have real mechanics (`handlePortalTouch()`, `handleCampaignBridges()`, `handleCorridorZone()`). Mission end: `endCampaignMission()` → `missionResultScreen`; revive ad via `onCampaignTimeout()` (never for untimed missions). **Campaign never touches Core City** — only `finalizeRun()` (Arena/Daily) does.

### Meta screens

- **Miasto** hub: currency header, Core City skyline card (`drawCityScene()`), player level row ("POZIOM"; Core City uses "LVL"), docked GRAJ 2:00 / WYZWANIE DNIA row, free chest. First run collapses to the welcome card (`#hubWelcome`) and hides the nav.
- **Unlock order** (`FEATURE_GATES`): Arena after M00, Warsztat after M02, Wyzwania after M03/M04. Celebrations (`queueUnlockCelebrations()`, each once via `save.unlocks.announced`); the Arena one's button starts the first round. `startArenaRound()` skips the run-tool screen for the first 3 runs; the login calendar waits for the first finished round.
- **Warsztat**: categories Wir (`SKINS`, each with an Arena/Daily perk), Smuga (`AURAS`), Efekt pochłaniania (`EAT_EFFECTS`), Finisz (`OVERDRIVE_SKINS`); one render/equip path (`renderCosmeticGrid()`, `pendingLoadout`, `onEquipClick()`); reward-only items show their unlock source. Live preview uses the real `Hole.draw()`.
- **Wyzwania**: daily mission + Daily Seed Challenge (`dailySeedForDate()`), countdown, streak, map preview (`computeDailyLayout()`). Friend challenges: `encodeChallenge()`/`decodeChallenge()`, `buildShareCanvas()`.
- Every hub element that looks tappable explains itself (`openInfoSheet()`); nothing silently ignores a tap.
- `Monetization` is the only path to ads/IAP (`rewarded()`, `interstitial()`, `purchase()`); providers are detected at runtime, the web build runs a labelled demo and never shows a fake checkout. `SoundEngine` synthesizes all audio (never audio files). iOS rules (v13.2): `unlock()` runs on every pointerup/touchend/click (pointerdown is not a user activation in Safari), sets `navigator.audioSession.type = 'playback'` (else the silent switch mutes Web Audio), resumes from any non-running state (WebKit uses `interrupted`), on iOS also starts a silent looping in-memory WAV `<audio>` (`unmuteIOS()` — WKWebView/Chrome iOS and older iOS have no `audioSession`, and without media playback the ring/silent switch mutes Web Audio while the context still says `running`), rebuilds a context that won't resume, and respects `hold` (set by `suspend()` for ads / hidden page, cleared by `resume()`). `qa/features.mjs` simulates these states.

## Copy rules

Polish, gender-neutral (never "urosłaś/urosłeś", "gotowa/gotowy" — use present tense, imperatives, or the vortex as subject), Polish terms over English jargon, places as "2. miejsce". `qa/design.mjs` checks the forbidden forms. See `docs/GAME_DESIGN.md` §1.

## Visual system

Palette in `--nc-*`/`--neon-*` custom properties, lifted from `design/reference/asset_bible.svg`: cyan `#50F0FA`, gold `#EFCB63`, green `#46D99A`, pink `#FF54AD`, violet `#9875FF`, panel `#0A2032`/`#071725`, background `#04101D`→`#081C2B`. The old saturated neons (`#00f3ff`/`#ff007f`/`#39ff14`/`#ffd700`/`#b026ff`) are a regression if they reappear. Floor shades are dark `#05..#12` plus low-alpha accents; tier colors at full saturation are reserved for pickups. The in-round vignette is CSS (`#hud::before`).

## Deliberately not built

No backend (leaderboards, cloud save, accounts are local; challenges are seed+score links). No bundled ad/IAP SDK. No procedural district generator. No PWA/service worker or `og:image` (extra files — owner decision). No Core City prestige loop past LVL6. Details and open owner decisions: `docs/GAME_DESIGN.md` §7.
