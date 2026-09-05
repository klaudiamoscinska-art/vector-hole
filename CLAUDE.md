# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Vector Hole: Eat the Neon City** — a top-down, hole.io-style browser game. Vanilla HTML/CSS/JS with zero dependencies and no build step, deliberately split into exactly three files:

- `index.html` — canvas element, in-game HUD overlays, and the menu/shop/game-over/ad screens (all present in the DOM at once, toggled via the `.hidden` class).
- `style.css` — cyberpunk neon visual system, responsive layout (desktop + touch/mobile), CSS animations for pulsing neon glows.
- `game.js` — all game logic, in one file, using ES6 classes: `Game`, `Hole`, `Bot extends Hole`, `WorldObject`, `Particle`.

## Commands

There is no package manager, build step, linter, or test suite. To run the game locally, serve the directory with any static file server and open `index.html`, e.g.:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

Opening `index.html` directly via `file://` also works.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy-pages.yml`, which deploys the repo root as-is to GitHub Pages (no build step — it just uploads `index.html`/`style.css`/`game.js`). The workflow also runs on `claude/**` branches, but the `github-pages` environment's branch protection only allows deploys to actually go live from `main` — pushing the workflow file to a feature branch will run it, but the deploy step will fail with an environment-protection rejection until the branch is merged. `.nojekyll` is present at the repo root to stop GitHub Pages from running its default Jekyll processing on the static files.

## Architecture

### World and coordinate spaces

The game world is a fixed 3000×3000px plane (`WORLD_W`/`WORLD_H` constants in `game.js`), independent of screen size. The `Game` class owns a `camera` (`{x, y}`, the world point centered on screen) that follows `player.x/y`, clamped so the viewport never shows outside the world bounds. `Game.render()` applies a single `ctx.translate` for the camera and draws everything (grid, `WorldObject`s, `Particle`s, `Hole`s) in world space; `Game.drawMinimap()` resets the transform afterward to draw the corner minimap in screen space. Mouse/touch input is converted from screen coordinates to world coordinates (`pointerWorld`) in `bindInput()` using the current camera position, since the camera moves every frame.

### Entities

- `Hole` is the shared base for both the player and bots: position, `radius`, `score`, edge color/skin, invulnerability window (`invulnerableUntil`), and `moveToward()`/`growFromArea()`/`shrinkAndRespawn()`. Growth is area-conserving (`growFromArea` adds to `πr²` before taking the new radius), not linear, so growth naturally slows as a hole gets bigger.
- `Bot extends Hole` adds a `decide()` state machine re-evaluated every 0.35–0.65s: flee the nearest larger hole within range, else hunt the nearest smaller hole, else hunt the nearest edible `WorldObject`, else wander to a random point. There is no pathfinding — bots move in a straight line toward their current `target`.
- `WorldObject` instances are pooled, not spawned/destroyed: eating one plays a shrink-toward-hole-center animation (`startEating`/`eatT`) and then calls `respawn()` on the same instance at a new random position instead of removing it from the array. This keeps the object count constant and avoids GC churn.
- Eating rules live in `Game.handleObjectEating()` (hole vs. object) and `Game.handleHoleCollisions()` (hole vs. hole): an object/hole is only eatable if it's smaller by the `EAT_OBJ_RATIO`/`EAT_HOLE_RATIO` margin, not simply smaller.

### Game loop and screens

`Game` drives a single `requestAnimationFrame` loop (`update()` + `render()`) that only runs while `this.running` is true. Screen transitions (`mainMenu`, `shopScreen`, `gameOverScreen`, `adOverlay`, in-game `hud`) are plain DOM show/hide via `showScreen()`/`hideAllOverlays()` — there is no client-side router or framework.

Monetization is simulated, not wired to a real ad SDK: `showInterstitialAd()` and `watchRewardedAd()` just run a timed progress-bar overlay before resolving. Coins and the owned/selected skin are persisted to `localStorage` under `vectorHoleSave_v1` (see `loadSave()`/`saveGame()` and the `SKINS` array).
