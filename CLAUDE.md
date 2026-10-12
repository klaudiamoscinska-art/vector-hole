# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Vector Hole: Eat the Neon City** — a top-down, hole.io-style browser game (Polish UI): steer a vortex through a neon city, eat everything smaller, grow through six size tiers, eat smaller rivals, win 2-minute Arena rounds, play a 240-mission Campaign (12 districts, difficulty 1–5, three stars, boosters, energy). **How the game works today (rules, numbers, copy tone): `docs/GAME_DESIGN.md` — read it before changing gameplay, balance or text, and update it with the code.** Version history: `docs/CHANGELOG.md`.

Vanilla HTML/CSS/JS, zero dependencies, no build step, deliberately exactly three runtime files:

- `index.html` — canvas, in-round HUD, and every screen (Miasto hub, Dzielnice, mission briefing sheet, Warsztat, Wyzwania, run setup, profile, pause, quick-equip, evolution cards, tutorial coach card, game over, ad, mission result) present in the DOM at once and toggled with `.hidden`, plus a persistent bottom nav.
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
node qa/run-all.mjs     # edge cases, features, visual, design, flow, 20-round Arena career, 30 campaign missions, v15 systems, v16 audio, v17 first impression, v18 economy, v19 launch, v20 gates, difficulty (all 240 missions)
node qa/v20.mjs         # v20 gates: no gate goals left, impulse pad burst + recharge, two-way portal pair, M11 first frame, EN
node qa/v19.mjs         # v19 launch: English everywhere (en-US sweep, ?i18n=log), language switch, energy off on portals, cloud save, backup code
node qa/v18.mjs         # v18 economy: Sprint, defeat → suggested booster, booster ad, store packs, booster balance (casual bot on hard missions)
node qa/v17.mjs         # v17 first impression: live welcome demo, Miasto = Core City hook card, layered canvas labels
node qa/audio.mjs       # v16 music: 15-track bank integrity + offline renders, scenes, drop, jukebox, pause mix
node qa/v15.mjs         # v15 systems: tap-to-start, boosters, energy, stars, fail reasons, pity, save v12, 240-mission content
node qa/difficulty.mjs  # every mission by the expert + casual bot under its real limit; asserts the rising curve
node qa/calibrate.mjs 10 4  # re-measure MISSION_BOT_TIME (paste the printed table into game.js) after changing missions/growth/twists
node qa/design.mjs      # v13 design checks (first seconds, race, input, tutorial, newbie path, copy, phone layouts)
node qa/flow.mjs        # v14 flow checks (one action per screen, no scrolling to GRAJ, briefings, next-mission preview, NELA, Warsztat confirm-to-buy)
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
- **Save**: `localStorage` key `vectorHoleSave_v1` (never changes), `SAVE_SCHEMA_VERSION` 12 with a `migrateSave()` chain (add an `if (data.schemaVersion < N)` branch per breaking change). Every load runs `sanitizeSave()` against `defaultSave()`, so **a new save field must be added to `defaultSave()`** to survive. `saveGame()` seals the payload (`_sig`).
- **Ranking is always by score** (`rankHoles()`; radius/name are tiebreakers). Don't reintroduce a radius sort.
- `Analytics` keeps an in-memory buffer and forwards to a host sink only with consent (`save.privacy.analytics`). No backend; the game sends nothing itself.
- `escapeHtml()` for every player-controlled string that reaches `innerHTML`.

### World and rendering

- Fixed 3000×3000 world, `Game.camera` follows the player; Arena zooms out with growth (`Game.zoom` — any screen↔world math must divide/multiply by it; Campaign keeps zoom 1). `render()`/`renderCampaign()` apply one translate for world space; minimap, indicators, goal arrow and juice draw in screen space.
- **`CityFloor`**: 8×8 grid of blocks (`CITY_PITCH` 375, `CITY_ROAD` 64) painted per district into cached chunk canvases (`paintCityChunk()`, `CITY_LOT_PAINTERS`), blitted per frame with lazy repaints, a prefetch ring and an LRU pixel budget. Floor art stays flat, low-alpha, in the district's toned color (`cityTone()`), no shadow blur, no dark disc with a bright rim (that reads as a hole). `qa/visual.mjs` asserts 0 chunk repaints over 60 still frames — keep it that way.
- **Objects** share illustrated sprites (`OBJECT_ART`, cached in `OBJECT_SPRITE_CACHE`, `drawObjectArt()`), identical in Arena and Campaign; `OBJECT_ART_LITE` (gfx level 0) skips per-object sway and live extras. Only draw what `isInView()`.
- **Holes**: `Hole.drawVortex()` spiral arms over a black core, per-skin rims (`SKIN_STYLES`), eaten things drawn inside the vortex while swallowed (`drawSwallowed()`, `swallowGhosts`), leader crown (`isLeader`), labels counter-scaled at far zoom.
- `#app` is `height: 100dvh` (fallback `100vh`): iOS Safari's `100vh` ignores its toolbars and hid the bottom nav labels and the profile reset button. Never size the app with plain `vh`; pad bottom-anchored UI with `env(safe-area-inset-bottom)` (`viewport-fit=cover` is on). Home-screen app: the status bar style is `black` on purpose — with `black-translucent` WebKit on notched iPhones reports the viewport minus the status bar while drawing from the screen top (black strip, clipped minimap); stretching `#app` past it doesn't work because html/body clip it. `resize()` measures `#app`, and every `.screen` pads `env(safe-area-inset-top)`.
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

Separate simulation (`Game.mode` 'campaign', `updateCampaign()`/`renderCampaign()`, `CampaignEntity` list). Missions are authored as `MISSION_SPECS` objective lists (Rozdział I) and compact `CHAPTER_II` rows (`[name, 'e:TYPE:N b:N t:K c:N g:N r:N a:node:N L:id s:N', 'H2 R D Z2 F P O W B50', diff]`, parsed by `chapterTwoSpecs()`, ids M61+), all compiled by `compileMission()`. Each mission has `diff` 1–5 (`DIFFICULTY`): time limit = `MISSION_BOT_TIME[id]` median × timeFactor + pad, spares shrink with diff, `stars` = [clear, fast time, expert time or the spec's special `medal`] — **when adding or changing a mission, add a spec/row, re-run `node qa/calibrate.mjs 10 4`, paste `MISSION_BOT_TIME`, then `node qa/difficulty.mjs`.** v15 twists (setup flags): `hunters` (first N bots chase in bursts, `updateCampaignBot()`), `racer` (`this.racer`, `updateRacerBot()`/`resolveRacerEat()`, starts once the hole can eat the race type), `dark` (`drawDarkness()`, `darkVision()`), `glitch` (`this.glitchZones`, `updateGlitchZones()`), `fragile`, runner goals (`updateRunners()`). Every hazard goes through `campaignHit()` (shield → fragile fail → growth loss); early losses through `failCampaignMission(reason)` (`m.failReason` 'time'/'racer'/'hit'). Every mission starts via the briefing (`launchMission()`: boosters from stock then coins, `requireEnergy()`), then waits on the tap-to-start card (`showMissionStartCard()`/`beginMissionPlay()`, `introPending`; `dismissTutorialIntro()` also clears it for QA bots). `M00` is the tutorial (`goal.type 'tutorialChecklist'`, `untimed`, `starterRing`, one step at a time via `tutorialCurrentStep()`, coach card `showTutorialIntro()`); it teaches fragment/prop/vehicle and rival-eating so Arena can unlock. `drawCampaignGoalArrow()`/`campaignGuideTargets()` point to off-screen goal objects. **Gates are helpers, never goals (v20):** `setup.gates` (row token `g:N`) lays impulse pads on the roads (`layImpulsePads()`, `useImpulsePad()`: +50% speed for 2.5 s via `Hole.impulseMult`, then a 5 s recharge), `gateKind: 'portal'` (row twist `O`) a linked two-way pair (`usePortal()`); both get a briefing chip (`TWIST_INFO.impulse/portal`). Mostek has its own mechanic (`handleCampaignBridges()`). Mission end: `endCampaignMission()` → stars (`missionStarBits()`, `save.campaign.stars` bitmask, `checkStarChests()`), energy refund on a win, fail streak / NELA's pity Zegar → `missionResultScreen` (stars, fail title, NELA bubble, and the next mission's card above „GRAJ Mxx”, which opens its briefing); revive ad via `onCampaignTimeout()` (never for untimed missions). **Every mission is briefed before it starts** with one shared card, `missionCardHtml()` (goals from `missionStepRows()`/`objectiveIconDef()`, time, medal, reward, optional `[data-mc-play]` GRAJ handled by one delegated click listener): the briefing sheet (`openMissionBriefing()`, on any mission tap and the hub's campaign tile), Dzielnice's "NASTĘPNA MISJA" card and the result preview. `nextCampaignMissionId()` = first uncleared playable mission across unlocked districts. NELA is a character: `NELA_AVATAR` SVG in every `.nela-avatar`, `.nela-bubble` speech bubbles, `showNelaToast()` + `SoundEngine.nela()`, district stories in `DISTRICT_STORY`. **Campaign never touches Core City** — only `finalizeRun()` (Arena/Daily) does.

### Meta screens

- **Screen rule (v14):** one obvious action per screen, reachable without scrolling on 375×667 (`qa/flow.mjs`); nothing sticky/floating on Miasto (the owner disliked the floating GRAJ plate); no back buttons where the bottom nav exists.
- **Miasto** hub (v17.1, one hero / one hook): header with the player-level ring chip ("POZIOM"; Core City uses "LVL") + wallet + gear, the Core City card taking the free height (`drawCityScene(…, { siteLabel })`: a gold "NOWY BUDYNEK" tag over the crane, outlines of the next 6 buildings; `.hub-city-pitch` in its sky: "Każda runda buduje Twoje miasto" + `+X% za rundę · nagroda za N rund` from `coreGainPerRound()`; next reward/progress in its footer), in-flow GRAJ (`#hubPlaySub`: `runda 2:00 · +X% budowy miasta`), quick tiles Kampania (next mission, full name → briefing) / Wyzwanie dnia (`updateHubQuickTiles()`), free chest — no empty bands, no scrolling on 375×667, no second live panel (the owner found the v17 Arena stage messy). First run collapses to the welcome card (`#hubWelcome`: logo, one GRAJ, and `drawWelcomeScene()` — a real mini round: the vortex steers to the best bite, swallows objects, grows T1→T4 with eased growth, eats a smaller rival, loops every ~12 s) and hides the nav. Text over an animated canvas needs `z-index` + `will-change: transform` (WebKit draws live canvases over later siblings — an iPhone district tile lost its name).
- **Unlock order** (`FEATURE_GATES`): Arena after M00, Warsztat after M02, Wyzwania after M03/M04. Celebrations (`queueUnlockCelebrations()`, each once via `save.unlocks.announced`); the Arena one's button starts the first round. `startArenaRound()` skips the run-tool screen for the first 3 runs; the login calendar waits for the first finished round.
- **Warsztat**: categories Wir (`SKINS`, each with an Arena/Daily perk), Smuga (`AURAS`), Efekt pochłaniania (`EAT_EFFECTS`), Finisz (`OVERDRIVE_SKINS`); one render/pick path (`renderCosmeticGrid()` → `onCosmeticPick(cat, item)`: owned = worn at once via `pendingLoadout` + `onEquipClick()`; for sale = previewed + an info sheet "KUP I ZAŁÓŻ" whose `onClose` reverts the preview; never spend on a single tap); reward-only items say where they come from. Live preview uses the real `Hole.draw()`. `openInfoSheet({..., onClose})` runs `onClose` from `closeInfoSheet()`.
- **Wyzwania**: daily mission + Daily Seed Challenge (`dailySeedForDate()`), countdown, streak, map preview (`computeDailyLayout()`). Friend challenges: `encodeChallenge()`/`decodeChallenge()`, `buildShareCanvas()`.
- Every hub element that looks tappable explains itself (`openInfoSheet()`); nothing silently ignores a tap.
- **Energy (v15 session limit, `CONFIG.energy`)** — v19: on only where `CONFIG.energy.platforms[monetization.platform]` says so (`portal: false`: portals pay for play time; `web`/`native`: on; `?energy=0|1` overrides; `energyEnabled()`, `body.no-energy` hides the chip): `save.energy` (value, lastTick, infiniteUntil, freeDailyDate); `energyNow()` regenerates (never on a clock set back), `requireEnergy(kind, onPlay)` gates every Arena/Daily/challenge start and every mission launch (free: tutorial, first `freeArenaRuns`, first Daily of the day, the `energy_hour` IAP), and at 0 opens `#energySheet` (prism refill / `energy_ad`) which continues into the play. QA bots call `startRound()`/`startCampaignMission()` directly and are never charged. **Boosters** (`MISSION_BOOSTERS`: Zegar, Turbo start, Sprint (v18), Magnes, Tarcza; `save.boosters`, unlocked by `CONFIG.boosters.unlockMission`) are the main recurring coin sink and the core monetization funnel (v18): a defeat's primary button proposes the booster that answers it (`suggestedBooster(def, reason, progress)` → `openMissionBriefing(id, { preselect })`, price shown on GRAJ, POWTÓRZ = without); short on coins, the briefing offers one picked booster for a `booster_ad` (3/day, `watchBoosterAd()`); IAP `booster_pack` and the starter pack grant `boosters: n` of each. Booster prices are bot-balanced — re-run `node qa/v18.mjs` after changing a booster, the growth curve or mission limits.
- **Saves (v19)**: `saveGame()` stamps `meta.savedAt` (not on a plain load) and mirrors to `SAVE_MIRROR` — set by `Monetization.attachCloudSave()` on CrazyGames (its data module syncs logged-in players across devices); on attach the save with the higher `saveProgressScore()` wins (never a fresh device over a long campaign), and `Game.adoptSave()` swaps it in (deferred until no round runs). Profil → Kopia zapasowa: `encodeSaveCode()`/`decodeSaveCode()` (`VH1.` + base64 of the sealed save). `navigator.storage.persist()` is requested at boot (not on Firefox, which would prompt).
- `Monetization` is the only path to ads/IAP (`rewarded()`, `interstitial()`, `purchase()`); providers are detected at runtime, the web build runs a labelled demo and never shows a fake checkout. `SoundEngine` synthesizes all audio (never audio files). **Music (v16)**: `MUSIC_TRACKS` is a data bank of 15 tracks (3 `menu`, one theme per district; lead = note tokens, bars of exactly 16 steps — `qa/audio.mjs` checks), compiled lazily by `compileSong()`; the sequencer (`scheduleUntil()`/`advance()`/`playStep()`) walks each track's `form` of sections, layers by `intensity` (0 outro/menu · 1 round · 2 final stretch → riser + jump to the `drop` section · 3 SZAŁ; in the final stretch a wrap loops hook → drop instead of rotating). The game only calls `setScene('menu' | 'arena' {seed, daily, challenge} | 'campaign' {district, boss})` — results screens keep the round's track — plus `setIntensity()`; `playTrack()` fades and switches on a downbeat, Arena/menus rotate after each full pass, missions loop their district theme, `missionStart()` drops a boss theme on START. UI reads `currentSong` (the queued track during a fade). Track maps are prototype-free (`Object.create(null)`). Rozdział II themes unlock with their district (`isTrackUnlocked()`); `save.settings.musicPick` pins a favourite (Szafa grająca in Profil, `openJukebox()`); the pause sheet's NASTĘPNY calls `skipTrack()`; `onTrackChange` drives the „TERAZ GRA” chip. Pitched SFX follow the track's key (`song.ladder`, `inKey()`). Add a track = one `MUSIC_TRACKS` entry, then `node qa/audio.mjs`. iOS rules (v13.2): `unlock()` runs on every pointerup/touchend/click (pointerdown is not a user activation in Safari), sets `navigator.audioSession.type = 'playback'` (else the silent switch mutes Web Audio), resumes from any non-running state (WebKit uses `interrupted`), on iOS also starts a silent looping in-memory WAV `<audio>` (`unmuteIOS()` — WKWebView/Chrome iOS and older iOS have no `audioSession`, and without media playback the ring/silent switch mutes Web Audio while the context still says `running`), rebuilds a context that won't resume, and respects `hold` (set by `suspend()` for ads / hidden page, cleared by `resume()`). `qa/features.mjs` simulates these states.

## Languages (v19)

Polish is the source language; English is a translation layer at the output (`I18N`, `T()`, `i18nStart()` near the top of `game.js`, dictionary `I18N_EN` at the bottom): a `MutationObserver` translates DOM text and `aria-label`/`placeholder`/`title`, and `fillText`/`strokeText`/`measureText` are wrapped for canvas text. Keys are the Polish strings; composed text uses patterns — `{0}` any text (translated recursively), `{#0}` a number only (use it for "number + noun" so names aren't hijacked). UPPERCASE variants are automatic. `save.settings.lang` ('auto' = the browser: Polish for `pl-*`, else English; Profil switches and reloads). **Every new Polish UI string needs an `I18N_EN` entry** — run `node qa/v19.mjs` (it fails on any Polish reaching the screen in English) and, for a manual pass, open the game with `?i18n=all`. Text inside `[translate="no"]` is left alone (backup code, language buttons). QA suites run as `pl-PL` by default (`openGame(..., { locale })`).

## Copy rules

Polish, gender-neutral (never "urosłaś/urosłeś", "gotowa/gotowy" — use present tense, imperatives, or the vortex as subject), Polish terms over English jargon, places as "2. miejsce". `qa/design.mjs` checks the forbidden forms. See `docs/GAME_DESIGN.md` §1.

## Visual system

Palette in `--nc-*`/`--neon-*` custom properties, lifted from `design/reference/asset_bible.svg`: cyan `#50F0FA`, gold `#EFCB63`, green `#46D99A`, pink `#FF54AD`, violet `#9875FF`, panel `#0A2032`/`#071725`, background `#04101D`→`#081C2B`. The old saturated neons (`#00f3ff`/`#ff007f`/`#39ff14`/`#ffd700`/`#b026ff`) are a regression if they reappear. Floor shades are dark `#05..#12` plus low-alpha accents; tier colors at full saturation are reserved for pickups. The in-round vignette is CSS (`#hud::before`).

## Deliberately not built

No backend (leaderboards, cloud save, accounts are local; challenges are seed+score links). No bundled ad/IAP SDK. No procedural district generator. No PWA/service worker or `og:image` (extra files — owner decision). No Core City prestige loop past LVL6. Details and open owner decisions: `docs/GAME_DESIGN.md` §7.
