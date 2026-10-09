# Vector Hole v12 — „Złoty Strzał VISUAL” (visual / UX pass)

Single autonomous pass on top of v11 focused only on how the game looks,
reads and feels: the in-round world, the eat moment, the HUD and the menu
screens. Still exactly three runtime files, zero dependencies, no build
step, zero third-party requests. Every claim below is backed by a check in
`qa/` (`node qa/run-all.mjs`, 70/70 passing at the end of this pass) or a
screenshot from `node qa/screens.mjs`.

## 0. What the review found first (baseline on v11)

| Finding | Why it mattered | Fix |
|---|---|---|
| Every round was played on a black void with a faint grid | Nothing on screen said "you are eating a CITY"; the first 3 seconds sold nothing | Neon City floor (§1) |
| The eat itself was invisible: an eaten object was lerped 50 % per frame under the hole's black disk | The core dopamine moment of a hole.io game had no animation | Swallow animation (§2) |
| Bot careers end strong rounds at r 400–800 (once r 5 800 — bigger than the 3000×3000 world, 450 k points) while the camera stopped zooming at 0.58 | The late game was a screen filled by one vortex | Camera keeps pulling back + radius cap (§3) |
| The standings panel listed all 6 holes and was rebuilt with `innerHTML` every frame; the goal rows too | A third of the phone screen covered; DOM thrash 60×/s | Compact standings + HUD write cache (§4) |
| "Zagraj jeszcze raz" sat ~900 px below the fold on the results screen | The replay / ×2 coins / challenge buttons — the retention, revenue and viral levers — needed a scroll | Sticky action bar (§5) |
| The start hint pill covered the minimap; profile settings were a cramped stack of buttons | Visible polish gaps | §4, §5 |
| A greedy QA bot could get stuck all round chasing a small rival tucked into a corner (the hole's centre is clamped radius-from-the-wall) | Flaky "first 3 runs on podium" check | QA bot skips unreachable targets (§7); the mechanic itself is a known gap |

## 1. Neon City floor (`CityFloor`, `paintCityChunk`, `CITY_LOT_PAINTERS`)
- The 3000×3000 world is an 8×8 grid of blocks (`CITY_PITCH` 375) split by
  roads (`CITY_ROAD` 64): lane dashes in the district color, edge lines,
  crosswalks on every intersection arm, sidewalks with paver joints, a neon
  curb, street-lamp light pools, a pink hazard barrier on the world edge.
- **Districts** (`CITY_DISTRICT_MAP`): Arena uses a fixed map of the six
  campaign districts around Rdzeń Miasta at the world centre (energy rings
  around the core). Each lot is painted by its district's painter (3
  variants each): Plac Neonów plazas/emblems/fountain, Park Impulsów lawns,
  ponds, pitches, Port Syntez container yards/basins/parking, Galeria Glitch
  checker floors/murals/atrium, Dachy Prądu helipads/solar arrays/vents,
  Rdzeń circuit boards. One lot per district carries its name painted on the
  ground (`citySignCells()`); the minimap is tinted by district and labelled
  with the one you are in. Campaign paints the whole board in the mission's
  district (`Game.campaignTheme()`), dims the city outside
  `CONFIG.campaign.bounds` and keeps the pink edge.
- **Readability rule:** everything on the floor is flat, low-alpha line work
  in the district color with no sprite gradients — objects stay the only
  glowing, filled things on screen.
- **Cost:** each block is painted once into an offscreen chunk canvas and
  blitted (~15–40 `drawImage` per frame). Chunks are painted at a resolution
  step of zoom×DPR (0.75/1/1.5/2, capped per quality level), re-painted
  lazily (2 per frame) when the zoom crosses a step, prefetched one ring
  ahead of the camera and evicted LRU under a pixel budget (4/7/10 Mpx per
  quality level, never below what the frame needs). Lamp pools are a cached
  sprite. When the opaque floor covers the screen the full-screen clear is
  skipped (`floorCoversView()`).
- Night traffic: faint head/tail-light streaks glide along the roads in
  view (skipped on the lowest quality level).
- Menu art: the first-run welcome scene drifts over the same city
  (`SCREEN_FLOOR`) and the Wyzwania daily-map preview draws the district
  blocks under the real Daily layout.

## 2. The eat moment
- **Swallow animation** (`beginSwallow()`, `swallowPose()`): an eaten object
  tips over the rim and spirals into the vortex — shrinking, turning and
  sinking into the event-horizon darkness — drawn by the eater *inside* its
  clipped vortex (`Hole.draw(ctx, time, inner)` → `Game.drawSwallowed()`),
  while the part still outside the rim fades. Same for Campaign entities
  (their own x/y stay put — mission logic reads them) and for **swallowed
  rival holes**, which collapse as a ring in their color
  (`Game.swallowGhosts`, `addSwallowGhost()`). Timing is unchanged
  (`EAT_ANIM_TIME`), so scoring/growth are exactly as before.
- **Hole depth:** the gravity-well gradient now starts with a dark sag right
  at the rim (the floor dips into the hole) before the skin-color glow.
- **Leader crown:** a gold crown floats over the current #1 by score
  (`Hole.isLeader`, set in `updateHUD()`), so everyone sees who to hunt.
- **Tier-up sweep:** crossing a size tier sends a shockwave across the
  whole visible city in the tier color (halo stroke, no full-screen blur).

## 3. Late-round camera and radius cap
- Past `zoom.endRadius` the Arena camera keeps pulling back so the hole
  spans at most `zoom.holeScreenFrac` (24 %) of the short screen side, down
  to `zoom.floor`, and never so far that the view would leave the world
  (which also fixes desktop screens seeing past the world edge at 0.58).
- `CONFIG.hole.maxRadius` (480) caps every hole (`Hole.setRadius()` and the
  bots' passive growth). A capped hole still eats everything and scores;
  it just can't become bigger than the screen.
- Hole names, the crown and score pops are counter-scaled by 1/zoom
  (`labelScale`, `FloatText.draw(ctx, k)`), so they stay readable far out.

## 4. HUD
- Standings: podium + your own row (with a `···` gap row when you're lower),
  a crown icon on #1, smaller rows; the panel ends ~100 px higher.
- Clock as `m:ss` (`formatClock()`), the tier bar takes the tier's color,
  the score pill pops when it grows (`setHudScore()`, WAAPI, throttled).
- Every HUD write goes through `Game.hudSet()` — a DOM write only when the
  value changed (standings, goal rows, clock, score, tier badge).
- Glassier HUD panels; the start hint sits left of the minimap; a CSS-only
  vignette (`#hud::before`, off on quality level 0 via `body[data-gfx]`).

## 5. Menus
- Results: `ZAGRAJ JESZCZE RAZ` + `×2 MONET` + `RZUĆ WYZWANIE` in a sticky
  bar at the bottom of the results column — always on screen.
- Mission result: a hero emblem drawn on (ring + check in the district
  color, gold with a medal, pink clock on a timeout) and a big score.
- Profile: settings and privacy as label/pill-switch rows.
- Every full screen's content rises in (backwards-fill only, so no
  transform lingers on `.screen-inner`); reduced motion disables it.
- Core City skyline: a dark far skyline on the horizon, so a LVL 1 city
  reads as a city at night instead of an empty sky.
- Count-ups time from their first animation frame (a skewed/stalled clock
  could leave a result at 0).

## 6. Performance
Rasterized frame cost in headless software rendering (forced flush,
`qa/visual.mjs`, late round, caches warm): gfx 0 median ≈ 5–7 ms (v11:
≈ 4–4.5 ms), gfx 2 ≈ 17–19 ms (v11: ≈ 12 ms). The extra cost is the floor
blit and more holes in view when the camera pulls back; GPU-backed canvases
on real devices pay far less for `drawImage`, and the v11 adaptive-quality
watchdog still steps down on slow devices. Weight: ~243 KB gzipped total
(game.js 164 KB, style.css 65 KB, index.html 14 KB), still zero
third-party requests.

## 7. QA (`qa/`)
- `qa/visual.mjs` (new, part of `run-all`): lit floor in Arena and in all six
  Campaign themes, chunk-cache budget, crown on the true #1, compact
  standings + m:ss clock, zero DOM writes for unchanged standings, capped
  hole never covering more than 75 % of the short screen side, swallowed
  objects and rival drawn inside the vortex, results CTA bar on screen
  without scrolling, count-up not stuck at 0, mission hero, welcome-scene
  city, settings rows, a rasterized render budget, no runtime errors.
- `qa/screens.mjs` captures 16 phone screenshots (adds Arena mid/late, a
  swallow close-up, pause, evolution cards, Campaign in Park, mission
  result, Dzielnice, Wyzwania).
- `QA_TICK` (`lib.mjs`) advances a round part-way and stages a mid-swallow
  moment; the greedy Arena bot now skips targets its clamped hole can't
  physically reach (like a human would).

## Known gaps / decisions for the owner
- **Corner refuge:** a hole's centre is clamped radius-from-the-wall, so a
  much smaller rival tucked into a wall or corner can sit outside a big
  hole's eat reach. Pre-existing gameplay behaviour, left as is (a fix
  changes balance); the QA bot now behaves like a human and moves on.
- `maxRadius` 480 is a readability cap chosen from the bot careers; it also
  lowers the ceiling of runaway late-round scores (coins are √score, so the
  economy impact is small).
- The city layout is fixed (not seeded per run) on purpose — players learn
  it; Daily/friend-challenge maps are unchanged (same objects, same seeds).
- Real-device GPU profiling (low-end Android) still recommended before a
  big launch; the watchdog covers the worst case.
