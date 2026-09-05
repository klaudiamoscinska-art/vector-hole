# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Vector Hole: Eat the Neon City** — a top-down, hole.io-style browser game, now built out as the "Golden Shot V2" hybrid-casual product per `docs/VECTRE_V2_PLAN.md` (the full audit + phased roadmap + per-phase changelog — read it before making architectural changes). Vanilla HTML/CSS/JS with zero dependencies and no build step, deliberately kept to exactly three files:

- `index.html` — canvas element, in-game HUD overlays, and every screen (hub/menu, run setup, shop, profile, pause sheet, evolution cards, game-over, ad) all present in the DOM at once, toggled via the `.hidden` class.
- `style.css` — cyberpunk neon visual system, responsive layout (desktop + touch/mobile), CSS animations for pulsing neon glows.
- `game.js` — all game logic, in one (long) file, using ES6 classes: `Game`, `Hole`, `Bot extends Hole`, `WorldObject`, `Particle`, `Ripple`, `SeededRNG`, `Analytics`.

This project went through Golden Shot V2 Phases 1–9 in one pass (see `docs/VECTRE_V2_PLAN.md` §4–§9 for the exact scope and honest gaps of each). The file is now large; **do not split it into multiple files or introduce a build step without first flagging that decision to the user** — the "exactly three files, zero dependencies" constraint is a deliberate, repeated instruction, not an oversight.

## Commands

There is no package manager, build step, linter, or test suite. To run the game locally, serve the directory with any static file server and open `index.html`, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

Opening `index.html` directly via `file://` also works. There is no automated test suite; verification has been done via manual play-throughs and ad-hoc Playwright scripts against a local static server (see recent commit messages for what was checked each phase) — write similar throwaway scripts rather than assuming a `tests/` directory exists.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy-pages.yml`, which deploys the repo root as-is to GitHub Pages (no build step — it just uploads `index.html`/`style.css`/`game.js`). The workflow also runs on `claude/**` branches, but the `github-pages` environment's branch protection only allows deploys to actually go live from `main` — pushing the workflow file to a feature branch will run it, but the deploy step will fail with an environment-protection rejection until the branch is merged. `.nojekyll` is present at the repo root to stop GitHub Pages from running its default Jekyll processing on the static files.

## Architecture

### Config, flags, state machine, RNG, analytics (all in `game.js`, top of file)

- **`CONFIG`** is the single data-driven tuning object — world/round/hole/eating/economy/input/juice/evolution/overdrive values all live here, with old top-level `const` names (`WORLD_W`, `BASE_RADIUS`, etc.) kept as one-time aliases into it so the rest of the file didn't need touching when it was introduced. Tune gameplay by editing `CONFIG`, not by hunting for magic numbers in methods.
- **`CONFIG.flags`** gates every major system (`inputThumbPad`, `evolutionSystem`, `runModifiers`, `hub`, `shopV2`, `dailyChallenge`, `monetizationAdapters`, `analyticsConsoleLog`, `proceduralDistricts`). Most are now `true` (the systems are built); `proceduralDistricts` and `monetizationAdapters` stay `false` because a full authored chunk/district generator and real ad/IAP SDKs were explicitly **not** built (see plan doc — no backend, no secrets, no store credentials belong in this repo).
- **`GameState`** enum (`BOOT/MENU/MATCH_SETUP/PLAYING/PAUSED/RESULTS`) is tracked on `Game.state` and updated at the same call sites that already drove screen changes.
- **`SeededRNG`** (mulberry32) backs `Game.rng`, created fresh per round from `Game.runSeed`. It seeds the *initial* world layout only (see `seededRand()`'s doc comment) — mid-round randomness (bot wandering, object respawn after being eaten, particles) intentionally stays on `Math.random()`. The Daily Seed Challenge (`dailySeedForDate()`) derives a deterministic seed from the UTC calendar date.
- **`Analytics`** is a console-log stub (`Game.analytics.track(name, props)`) with an in-memory ring buffer. Wired at most of the GDD's minimum event list; a few events tied to systems that still don't exist (backend accounts, IAP) are documented as not-fired rather than faked.
- **Save schema** is versioned (`SAVE_SCHEMA_VERSION`, currently 5) with a `migrateSave()` chain — add a new `if (data.schemaVersion < N)` branch per future change rather than replacing the function. The `localStorage` key itself (`vectorHoleSave_v1`) never changes.

### World and coordinate spaces

The game world is a fixed 3000×3000px plane (`WORLD_W`/`WORLD_H`), independent of screen size. `Game` owns a `camera` (`{x, y}`) that follows the player, clamped to world bounds. `Game.render()` applies one `ctx.translate` for world-space drawing (grid, `WorldObject`s, `Particle`s/`Ripple`s, `Hole`s, the can-eat rim, danger halos, bounty/scanner markers); `drawMinimap()` and `drawDangerIndicators()` reset the transform to draw in screen space afterward. The minimap is visible by default on every viewport — an earlier pass auto-hid it below 700px width, which was effectively every phone, read as "the minimap is missing," and was reverted; only `settings.minimap === 'off'` hides it now.

### Input

Two control schemes, chosen by `save.settings.inputMode` and gated by the `CONFIG.flags.inputThumbPad` kill switch:
- **Floating Thumb Pad** (default): touch-down inside the bottom `CONFIG.input.zoneHeightFraction` of the screen anchors a translucent joystick wherever the thumb lands (dead zone, max radius, a curved response). Drives `Game.moveVector` → `Hole.moveDirection()`.
- **Legacy direct-drag**: the hole chases `pointerWorld` via `Hole.moveToward()` — unchanged since before Golden Shot V2, still the only mode on desktop mouse. WASD/arrow keys are an accessibility option, checked first in `Game.applyPlayerMovement()`.

### Entities

- `Hole` is the shared base for player and bots: position, `radius`, `score`, skin/aura, invulnerability window, `moveToward()`/`moveDirection()`/`growFromArea()`/`shrinkAndRespawn(bonusInvulnMs)`. `getSpeed()` multiplies by `this.tempSpeedMult` (set per-frame for the Slipstream mutation, set once at round start for the Rush Hour modifier). Growth is area-conserving.
- `Bot extends Hole` adds a `decide()` state machine (flee/hunt-hole/hunt-obj/wander), no pathfinding.
- `WorldObject` instances are pooled; `respawn(tierName, first, rng)` only uses `rng` when `first` is true (the run's initial deterministic layout).
- Eating rules: `Game.handleObjectEating()` / `handleHoleCollisions()`, gated by `EAT_OBJ_RATIO`/`EAT_HOLE_RATIO`. Both eat sites route through `Game.triggerEatFeedback()` (size-scaled particles/shake/ripple) and `Game.registerCombo()` (score multiplier + fading combo text).

### Game loop, pause, and screens

`Game.loop()` drives one `requestAnimationFrame` chain, gated by `this.running`; `dt` is scaled by `CONFIG.evolution.slowMotionFactor` while an evolution card is pending (the world slows, it doesn't fully stop). `pauseGame()`/`resumeGame()` cancel/restart the RAF loop rather than adding a "paused but still ticking" branch. Screens are plain DOM show/hide via `showScreen()`/`hideAllOverlays()` — still no router or framework, just more screens now (`runSetupScreen`, `profileScreen`, the pause sheet, evolution card overlay, overdrive banner).

### Evolution + Overdrive ("Golden Shot")

Two evolution offers per run trigger at `CONFIG.evolution.triggerRadii` (player radius crossings). `Game.offerEvolution()` shows up to 3 weighted-random cards from the `MUTATIONS` pool above the Thumb Pad zone; auto-picks the first option after `autoPickMs` so a round can never soft-lock. Picked mutations (`Game.activeMutations`, a `Set`) are run-only and reset every round — see each mutation's effect wired into `registerCombo()`, `checkSizeTier()`, `updateMutationEffects()`, and `handleHoleCollisions()`. In the final `CONFIG.overdrive.triggerSecondsRemaining` seconds, `checkOverdriveTrigger()` picks a seeded variant (`blackout` dims the world; `portal_rain` spawns a wave of bonus objects) and tags the result screen (`BLACKOUT FINISH` / `PORTAL STORM`).

### Meta: Hub, Shop v2, Profile, Daily Challenge

- The main menu doubles as a **Neon Core Hub skeleton**: a bordered `.hub-card` holds the City Core meter (`save.hub.coreCharge`, +12%/run, wraps at 100%, shown as both a bar and a `%` number) plus a mission-text line and runs-played count; Daily/Workshop/Profile are a 3-tile icon grid (`.hub-modules`) below the primary GRAJ button, not stacked plain buttons — that visual distinction is what makes it read as a hub rather than a menu.
- **City Core milestones and the daily mission both grant real rewards**, not just a congratulatory message. Filling the Core meter to 100% (`Game.finalizeRun()`) unlocks the next unowned skin, then the next unowned aura, then a flat Coins+Prisms bonus once everything is owned. One mission from `MISSIONS` is active per UTC day (`missionForDate()`, same date-hashing approach as the Daily Seed Challenge); `Game.checkMissionProgress()` tracks the run's best value toward it and `finalizeRun()` grants `rewardCoins` once per day. Both are called out explicitly on the results screen (`#hubMilestoneLine`/`#missionResultLine`).
- **Workshop** (`shopScreen`) has two tabs: ring skins (`SKINS`, Coins) and a second cosmetic category, auras (`AURAS`, Coins or Prisms) — Prisms trickle in slowly from progression (`stats.runsPlayed % 3 === 0`) since there's no IAP adapter to sell them.
- **Run Setup** (`runSetupScreen`) offers casual-only consumable tools (`RUN_TOOLS`: Shield, Magnet), Coins-only, consumed at round start (`Game.confirmRunSetup()`).
- **Profile**: an optional display name (never required before the first run), passed through a placeholder blocklist (`moderateName()` — explicitly **not** production moderation, just a non-empty safeguard) plus a stable guest ID.
- **Share**: `Game.shareResult()` uses `navigator.share` (feature-detected via `canShare`) with a clipboard-copy fallback — never assumes Web Share exists.
- **Daily Seed Challenge**: `startDailyChallenge()` seeds a round from the UTC date so every player gets the same layout/modifier/Overdrive that day; tracked locally in `save.daily` (no backend leaderboard exists — see plan doc for why that's a later, explicitly-deferred phase). It has an explicit goal and reward, not just a different seed: the Hub shows the score to beat (`dailyGoalText`), and `CONFIG.daily` grants a completion bonus plus a bigger bonus (Coins + Prisms) for a new record, both called out on the results screen.

### What's deliberately not built

No backend of any kind (daily/global leaderboards, cloud save, accounts are all local-only). No real ad/IAP SDK — `showInterstitialAd()`/`watchRewardedAd()` are still a timed fake progress bar. No full authored chunk/district generator (`CONFIG.flags.proceduralDistricts` stays `false`) — only a single seed-driven "Rush Hour" run modifier exists as a lightweight stand-in. No audio system. Check `docs/VECTRE_V2_PLAN.md` before assuming any of these exist or extending them further.
