# Vectre Hole / Golden Shot V2 — Audit & Roadmap

This document is the required Phase 0 deliverable: a repository audit, the
conflict points between the Golden Shot V2 master prompt and the existing
codebase, and a phased implementation roadmap. It is a living plan — update
it at the end of each phase with what actually shipped.

## 1. Repository audit (ground truth, not assumptions)

**Stack**: zero dependencies, zero build step, zero test runner. Three files:
`index.html`, `style.css`, `game.js`. No `package.json`, no bundler, no
linter, no CI beyond the Pages deploy workflow. Confirmed via full repo
listing — nothing else exists.

**Rendering**: single `<canvas id="gameCanvas">`, 2D context, manual
`ctx.translate` camera in `Game.render()`. No WebGL, no Phaser/PixiJS/Three,
no React/Vue. All UI chrome (menu, shop, game-over, ad) is plain DOM,
toggled with a `.hidden` class — no router, no virtual DOM.

**Entry point / loop**: `window.addEventListener('DOMContentLoaded', ...)`
constructs a single `Game` instance. `Game.loop()` drives one
`requestAnimationFrame` chain calling `update(dt)` then `render(time)`,
gated by `this.running`. `dt` is clamped to 50ms; no fixed-timestep
accumulator (variable timestep, acceptable for this game's simulation but
worth knowing before adding deterministic replay/ghost features later).

**Input**: single scheme today — pointer position (mouse `mousemove`,
single-touch `touchstart`/`touchmove`) converted to world coordinates in
`bindInput()`, and the player hole chases that point every frame in
`update()`. This is "direct drag": the hole must sit under/near the
finger. No joystick, no dead-zone, no thumb pad, no keyboard support, no
haptics, no left/right-handed option.

**State flow**: four DOM screens (`mainMenu`, `shopScreen`,
`gameOverScreen`, `adOverlay`) plus the in-game `hud`, shown/hidden via
`showScreen()` / `hideAllOverlays()`. There is no formal state machine, no
pause state, no way to leave a round except waiting for the timer or an
alert/refresh. `Game.running` is the only "are we playing" flag.

**Save / economy**: one `localStorage` key (`vectorHoleSave_v1`) holding
`{coins, owned, selected}` — a single soft currency and a flat list of 7
skins (`SKINS` array, prices 0–200). No schema version field, no
migration path, no premium currency, no boosters, no missions, no hub, no
profile. `loadSave()` silently discards a corrupted/malformed save and
falls back to defaults — there is no upgrade path for old shapes, because
none has ever existed yet.

**Bots**: `Bot extends Hole`, a `decide()` state machine re-evaluated every
0.35–0.65s (flee / hunt-hole / hunt-object / wander), straight-line
movement, no pathfinding. 5 bots, fixed pool, names drawn from
`BOT_NAME_POOL`.

**World / objects**: fixed 3000×3000 world, `WorldObject` pool of 3 tiers
(`small`/`medium`/`large`) with fixed counts (90/45/16), pure
`Math.random()` placement — no chunk/room authoring, no seed, no
reproducibility. Growth is area-conserving (`growFromArea`).

**Monetization**: fully simulated. `showInterstitialAd()` /
`watchRewardedAd()` are a 3-second fake progress bar with no ad SDK
underneath. Interstitial fires every 2nd "play again". Rewarded ad doubles
the run's coin reward, once per round.

**Analytics / config / feature flags / RNG seeding**: none exist. All
tunables (`BASE_RADIUS`, `EAT_OBJ_RATIO`, `GROW_K_OBJ`, etc.) are bare
top-level `const`s mixed into the file — changing balance means editing
`game.js` directly, and there is no way to gate a new system behind a flag.

**Deployment**: `.github/workflows/deploy-pages.yml` uploads the repo root
as-is to GitHub Pages on push to `main` or `claude/**`. Deploys to
*production* Pages only succeed from `main` (branch-protected environment);
a `claude/**` push runs the workflow but the deploy step is expected to be
rejected until merge. This audit makes no changes to that workflow.

**Language**: all in-game UI copy is Polish (`index.html` strings,
`game.js` template strings like `KONIEC RUNDY`). The GDD is also authored
in Polish. This plan keeps existing Polish copy as-is where unchanged, and
writes new UI copy to match it, rather than silently re-localizing to
English mid-project.

**Bug found and fixed in Phase 1**: the results screen printed
`${radius} pkt: ${score}` per leaderboard row — an unlabeled, ambiguous
pair of numbers, called out explicitly in the master prompt as an example
of what not to ship. Fixed to explicit `Rozmiar {r} • Wynik {s}` labels
(see Phase 1 changelog below).

## 2. Conflicts between the master prompt and repository reality

The master prompt (GDD §14.1) explicitly anticipates this and asks to
adapt rather than override:

- **"Exactly three files" vs. many named services** (`SaveService`,
  `AnalyticsService`, `AuthService`, `LeaderboardService`,
  `MonetizationService`, `RemoteConfig`, ...). `CLAUDE.md` mandates the
  three-file, zero-dependency, no-build architecture and says these
  instructions override default behavior. Resolution for now: implement
  every P0/P1 "service" as a plain ES6 class or object literal living
  inside `game.js`, keeping the single `<script src="game.js">` and the
  three-file shape intact. This is sufficient through Phase 1–3 (P0
  instrumentation, controls, evolution/overdrive, seeded districts). If a
  later phase (hub, shop v2, backend leaderboard) makes a single 3000+
  line file unworkable, that is a decision to flag explicitly to the user
  before splitting files or introducing a build step — not something to
  do unilaterally.
- **No backend vs. daily/league leaderboards and cloud save.** GDD §14.3
  agrees: backend is only needed starting at "Daily leaderboard" maturity.
  Phases through the Golden Slice (GDD §15.3) stay local-only
  (`localStorage`, deterministic seeds, a local analytics stub).
- **No ad/IAP SDK vs. MonetizationService.** Kept as a stub adapter
  (already the existing pattern for the fake interstitial/rewarded ad) —
  no real SDK, no ad unit IDs, no store credentials are added to the repo.

## 3. Product roadmap (phased, vertical slices — not a rewrite)

Priorities and effort per the GDD's own impact/effort table (§15.1),
mapped to concrete phases. Each phase should ship independently, stay
feature-flagged where it touches shared systems, and leave the previous
phase's acceptance criteria intact.

| Phase | Scope | Priority | Status |
|---|---|---|---|
| 1 | P0 instrumentation baseline: state machine, config/tuning layer, feature flags, seeded RNG abstraction + run/session IDs, versioned save + migration, analytics event stub, ambiguous-HUD-string fix | P0 | Shipped |
| 2 | Floating Thumb Pad input (with legacy drag toggle), pause/leave-run sheet, HUD v2 (explicit Size/Score/Rank, collapsible standings, contextual minimap) | P0/P1 | Shipped |
| 3 | Game-feel/juice pass: size-scaled eat feedback, growth-tier pulse, combo system + fading combo text, can-eat/danger readability | P0 | Shipped |
| 4 | Evolution moments (2/run, 3-card weighted offer, run-only mutations) + Overdrive/City Shift finale (2 variants) | P1 | Shipped |
| 5 | Seeded starting layout + a single seed-driven run modifier (Rush Hour) | P1 | **Shipped, scoped down** — see §7. Full `DistrictDefinition`/chunk-template/spawn-budget/validator system (GDD §14.2/§6) was **not** built |
| 6 | Neon Core Hub skeleton (City Core meter, mission stub, Play/Daily/Workshop/Profile) | P1 | Shipped as a skeleton — no separate animated hub screen or real unlocks yet, per GDD §7's own "can be 2D, not explorable 3D" allowance |
| 7 | Shop v2 (ring + aura categories, Coins/Prisms), casual run tools (Shield, Magnet) | P2 | Shipped, lean — 2 cosmetic categories not the full list in GDD §10.2; Prisms earn via progression trickle only (no IAP adapter) |
| 8 | Guest profile (optional name + placeholder moderation), share card (`navigator.share` + clipboard fallback) | P2 | Shipped |
| 9 | Daily Seed Challenge (local-only, UTC-date seed) | P2 | Shipped, local-only — no backend leaderboard, no league/ghost/bounty async competition beyond the in-round Bounty Core mutation |
| 10 | Collections, live-event tooling, additional districts/modifiers | P3 | **Not built** — no collections UI, only 1 modifier and the existing single implicit district |
| 11 | Backend leaderboard, cloud save/auth, real monetization adapters | P3+ | **Not built.** Explicitly out of scope: requires a backend, ad/IAP SDK integration, and store/OAuth credentials that must never live in this repo (see CLAUDE.md / this doc's own rules) |
| — | Real-time multiplayer, guilds, energy/stamina gates, gacha, 20 districts, heavy interstitials | Explicitly **not** building yet | Backlog per GDD §16.1 |

Sprint definition-of-done reference (GDD §15.2) is preserved per-phase in
each phase's own PR/commit description rather than duplicated here, to
avoid this doc drifting out of sync with what actually shipped.

## 4. Phase 1 — what shipped in this patch

**Inspected**: entire repo (see §1). No pre-existing tests/build/lint to run.

**Files changed**: `game.js` only (additive; `index.html`/`style.css`/the
deploy workflow untouched, per the "preserve GitHub Pages deployment"
and "do not rewrite the whole application" rules).

**What was added, all inside `game.js`, all backward-compatible**:

1. **`CONFIG` object** — every previously bare tunable constant
   (`WORLD_W`, `ROUND_TIME`, `BASE_RADIUS`, `EAT_OBJ_RATIO`,
   `GROW_K_OBJ`, coin formula, ad multiplier, etc.) now lives under
   `CONFIG.world` / `CONFIG.round` / `CONFIG.hole` / `CONFIG.eating` /
   `CONFIG.economy` / `CONFIG.sizeTiers` / `CONFIG.flags`. The old
   top-level `const` names are kept as aliases pointing into `CONFIG` so
   every existing reference in the file keeps working unchanged — this
   was a data layout change, not a gameplay change.
2. **`CONFIG.flags`** — a feature-flag map for every system the GDD asks
   to gate: `inputThumbPad`, `evolutionSystem`, `proceduralDistricts`,
   `hub`, `shopV2`, `dailyChallenge`, `monetizationAdapters`,
   `analyticsConsoleLog`. All default to the current behavior (i.e. new
   systems default **off**) except `analyticsConsoleLog`, which is on so
   the new event stream is visible in devtools during this phase.
3. **`GameState` enum + `Game.state`** — `BOOT → MENU → MATCH_SETUP →
   PLAYING → RESULTS` (PAUSED is defined now, wired up when pause lands
   in Phase 2). Transitions happen at the same call sites that already
   drove screen changes (`startRound`, `endRound`, menu/shop
   navigation) — no new control flow, just a labeled current-state field
   plus an analytics hook.
4. **`SeededRNG` (mulberry32) + `generateSeed()`/`generateId()`** — a
   deterministic PRNG abstraction. Each round now gets a `runSeed` and
   `runId`, recorded on `Game` and emitted in `run_start`/`run_end`
   analytics. Existing gameplay randomness (`Math.random()` via the
   `rand()` helper) is **not** rewired to the seeded RNG yet — that is
   Phase 5's job (seeded chunk generator) and is called out as a known
   gap, not silently done.
5. **`Analytics` class** — a provider-agnostic `track(name, props)` stub
   that logs to console (toggleable via `CONFIG.flags.analyticsConsoleLog`)
   and keeps an in-memory ring buffer (last 200 events) for future
   inspection/export. Wired at existing call sites for:
   `session_start`/`session_end` (page load / `visibilitychange`),
   `run_start`, `run_end`, `first_eat`, `size_tier`, `rival_eaten`,
   `player_eaten`, `ad_offer`/`ad_started`/`ad_reward_granted`,
   `shop_view`, `cosmetic_preview`, `soft_purchase`, `result_action`.
   Events the GDD lists that depend on not-yet-built systems
   (`ftue_step`, `evolution_offer/pick`, `overdrive_start`,
   `iap_intent`, `share_click`, `profile_created`, `account_linked`,
   `daily_challenge_start/end`) are documented in the code comment but
   intentionally not fired — firing them now would be fake telemetry.
6. **Versioned save schema + migration** — `SAVE_SCHEMA_VERSION = 2`.
   `migrateSave()` upgrades the old `{coins, owned, selected}` shape (no
   `schemaVersion` field) into the v2 shape, adding `prisms: 0`,
   `guestId` (generated once, stable), `settings: {inputMode: 'legacy',
   sensitivity: 1, haptics: true}`, and `stats: {runsPlayed}` —
   groundwork for Phase 2 (input mode toggle), Phase 7 (Prisms currency),
   and Phase 8 (guest profile). The `localStorage` key itself
   (`vectorHoleSave_v1`) is unchanged, so no existing save is lost; it is
   migrated in place on first load and re-saved.
7. **HUD string fix** — the game-over leaderboard row changed from the
   ambiguous `${radius} pkt: ${score}` to explicit `Rozmiar {r} • Wynik
   {s}` labels, matching the in-round HUD's existing `ROZMIAR`/`WYNIK`
   labels. This was flagged verbatim in the master prompt as a defect to
   fix.

**Explicitly not touched in Phase 1**: rendering, movement, AI, world
generation, shop UI/DOM, ad flow *behavior* (only its analytics hooks),
`index.html`, `style.css`. No visual or gameplay-feel change should be
observable to a player except the leaderboard label fix.

**Acceptance criteria for Phase 1**:
- Game loads and plays identically to before (menu → round → results →
  shop, mouse and touch drag) with no new visible controls or screens.
- Existing `localStorage` saves load without data loss; a save with no
  `schemaVersion` is migrated to v2 on first load.
- `console` shows `[analytics]` lines for the events listed above during
  a normal play session (verifiable manually in a browser).
- The results screen leaderboard shows separately labeled size and score.
- No new external dependencies, no build step, no secrets.

**Build/test/lint results**: no build/test/lint tooling exists in this
repo (confirmed in the audit). Verification was `node --check game.js`
(syntax) and a manual play-through via a local static server
(`python3 -m http.server`) covering: main menu → start round → eat
objects/bots/be-eaten → round timeout → results (own place, watch-ad
x2, play again, back to menu) → shop (buy + equip a skin) → resize to a
narrow mobile viewport.

**Manual mobile test checklist (for this phase)**:
- [ ] Load on a small viewport (~375×667) via devtools device emulation;
      confirm layout is unchanged from before this patch.
- [ ] Touch-drag still controls the hole (no thumb pad yet — that's
      Phase 2).
- [ ] Play a full round to completion on touch; results screen shows
      `Rozmiar` and `Wynik` as separate labeled values.
- [ ] Reload the page mid-save (existing coins/skin) and confirm coins
      and selected skin persist after the migration runs.
- [ ] Open devtools console and confirm `[analytics]` events fire for
      session start, run start, first eat, a rival being eaten, round
      end, and opening the shop.

**Remaining risks**:
- The `CONFIG` refactor touches every tunable constant; although aliases
  preserve every existing reference, a future contributor editing
  `CONFIG` directly must remember the aliases are still separate `const`
  bindings computed once at load — not live references. This is fine
  today (no runtime tuning UI exists yet) but will matter once
  `RemoteConfig`-style runtime tuning is added (Phase 7+); flagging now
  so that phase doesn't silently reintroduce two sources of truth.
- Gameplay RNG is still unseeded `Math.random()`. Anything relying on
  `runSeed` for actual reproducibility (daily challenge, bug repro) does
  not yet work end-to-end — only the ID/seed plumbing exists.
- Single-file `game.js` will keep growing every phase. Revisit the
  "exactly three files" constraint explicitly with the user once Phase 5
  (procedural districts) or Phase 6 (hub) makes the file unwieldy, rather
  than deciding unilaterally to split it.

**Next recommended phase (superseded — see §5)**: Phase 2 shipped next.

## 5. Phase 2 — what shipped in this patch

**Files changed**: `index.html`, `style.css`, `game.js`. Still zero
dependencies, zero build step, same three-file architecture (the pause
sheet and leave-run confirm reuse the existing `.screen`/`.screen-inner`
markup pattern instead of inventing a new one).

**Floating Thumb Pad (input v2)**:
- New default touch control for new saves: touch-down inside the bottom
  35% of the screen (`CONFIG.input.zoneHeightFraction`) anchors a
  translucent joystick wherever the thumb lands — the hole is never
  required to sit under the finger. Dead zone 10px, max radius 55px,
  a `magnitude^1.6` response curve (precision near center, speed near
  full deflection), knob visually tracks the raw finger offset while the
  resulting move speed uses the curved value. Fades out 400ms after
  release (`CONFIG.input.fadeDelayMs`).
- **Legacy direct-drag is preserved**, selectable from the pause sheet's
  Controls panel (`settings.inputMode`), and is what any pre-Phase-2 save
  keeps using until the player opts in (see migration note below).
- **`CONFIG.flags.inputThumbPad`** is a global kill switch: set it `false`
  and every save falls back to legacy drag regardless of its own setting
  — a safety net if the new control needs to be pulled without a code
  revert.
- Desktop is unaffected: mouse chase-drag behavior is byte-for-byte the
  same as before. Added WASD/arrow-key movement as an accessibility
  option (GDD 5.1); holding a key takes priority over the mouse for that
  frame.
- Sensitivity (Low/Normal/High → ×0.75/1/1.3) and a haptics toggle
  (`navigator.vibrate`, feature-detected, never assumed present) are
  exposed in the same panel and persisted in the save.
- **Save schema bumped to v3**: `settings.inputMode` defaults to
  `'thumbpad'` for new saves; a v2→v3 migration also flips any existing
  `'legacy'` default forward, since this is a pre-launch prototype with
  no real players who could have deliberately chosen legacy yet — a
  judgment call documented here rather than made silently. Also adds
  `settings.minimap: 'auto'`.

**Pause / Leave Run**:
- Compact pause button, top-left corner, safe-area aware
  (`env(safe-area-inset-*)`), reachable at any point in a round; `Escape`
  pauses on desktop too.
- Pause sheet: Resume, Restart, Controls (expands the input/sensitivity/
  haptics panel described above), Leave Run. No fake "close app" button
  was added, per the GDD's explicit instruction.
- Leaving a run has no forfeit penalty — casual mode only exists today
  (ranked/daily are Phase 9+); the player keeps the coins their score so
  far would have earned and returns straight to the main menu without a
  results screen, per GDD 5.2. `run_end` now carries a `completed: false`
  flag for this path (true for a normal timeout end) instead of inventing
  a new analytics event.
- `beforeunload` shows the browser's native "leave site?" prompt while a
  round is running and not paused — browsers do not allow a custom
  message here, so this is the correct/only available implementation
  of "don't accidentally lose your run to browser back/tab close."
- **Not implemented**: a Sound toggle. The GDD's pause sheet mock
  includes "Sound/Haptics," but this prototype has no audio system at
  all yet (confirmed in the Phase 1 audit) — adding a toggle with nothing
  behind it would be exactly the kind of fake feature GDD §16 warns
  against. Haptics shipped; Sound will land with the audio pass
  (GDD §9, not yet scheduled).

**HUD v2**:
- **Timer** moved to top-center as the strongest signal: a bigger number
  plus an SVG ring (`stroke-dashoffset`, depleting clockwise) that
  switches to the danger color in the final 15 seconds.
- **Size/tier** panel (top-left, below the pause button) now shows the
  size number plus a thin progress bar toward the next internal size
  tier (the same `CONFIG.sizeTiers` added in Phase 1 for analytics) —
  visual-only for now; Phase 4's evolution offers will hang off the same
  thresholds. Score is kept as a smaller secondary line in the same
  panel rather than removed, since the GDD's "never show ambiguous
  numbers" rule is about labeling, not about deleting score entirely.
- **Rank** collapses to a small `#place/total` badge (top-right); tapping
  it expands/collapses the existing full "NA ŻYWO" standings list below
  it. A separate "nearby standings" mini-list was considered and
  deliberately skipped as unnecessary complexity for what the collapsed
  badge already communicates — flagged here rather than silently
  dropped.
- **Minimap** now defaults to hidden below `CONFIG.input.minimapAutoHideWidth`
  (700px) and can be forced on/off via `settings.minimap`
  (`'auto'|'on'|'off'`) — verified hidden on a 375px viewport, shown on
  1280px.
- **Danger edge indicator**: a single pulsing arrow at the screen edge
  points toward the nearest off-screen rival that could eat the player,
  within 700px — capped to one indicator to avoid the visual noise the
  GDD explicitly warns about.
- Contextual, short-lived hint text at round start (control-mode-specific
  copy, auto-hides after 4s) replaces the old always-on static hint.

**Verified via Playwright** (both `hasTouch` mobile contexts and a plain
desktop context, plus manual screenshot review at 375×667 and 390×844):
default new-save settings; a real synthetic touch drag through the Thumb
Pad producing the expected direction/speed and DOM knob transform;
thumb-pad correctly disengaging (and fading) on release; desktop mouse
chase-drag unchanged; WASD movement; `Escape` pause; pause → Controls →
switch to legacy → Resume; pause → Leave Run → confirm → back to menu
with coins credited and `run_end{completed:false}` fired; rank badge
expand/collapse; minimap hidden at 375px / shown at 1280px; a full round
to the existing results screen (still showing the Phase 1 `Rozmiar {r} •
Wynik {s}` fix) with no console errors in any run.

**Acceptance criteria for Phase 2** (GDD §15.2 Sprint 1 DoD): works on an
iPhone-class viewport with zero HUD/control overlap (confirmed by
screenshot); legacy input reachable behind a setting, not deleted; pause
and leave-run both function without losing saved progress.

**Explicitly not touched**: evolution/Overdrive, procedural districts,
hub, shop, economy values beyond what Phase 1 already centralized,
world/bot/object logic, rendering of the world itself (only new
screen-space HUD/indicator drawing was added).

**Remaining risks / follow-ups**:
- Left/right-handed placement (GDD 5.1) was not implemented as a
  separate setting — a floating (not fixed-position) joystick anchors
  wherever the thumb lands, which already satisfies the practical intent
  for most single-thumb play; a true handedness bias would only matter
  for edge-clipping correction near screen borders and was judged not
  worth the added settings surface yet. Revisit if playtesting shows a
  need.
- The `curveExponent` (1.6) and `zoneHeightFraction` (0.35) are first-pass
  values, not yet A/B tested — they live in `CONFIG.input` specifically
  so they can be tuned without touching the input code.
- Danger indicator only tracks bots, not future hazards/districts —
  expected to extend naturally once Phase 5 adds world hazards.

**Next recommended phase (superseded — see §6)**: Phase 3 shipped next.

## 6. Phase 3 — what shipped in this patch

**Files changed**: `game.js` only. No new DOM elements were needed — all
new feedback is canvas-drawn (world-space) or reuses existing HUD/particle
plumbing, so `index.html`/`style.css` are untouched this phase.

**Size-scaled eat feedback** (GDD 5.4 "eat feedback zależny od
wielkości"): a new `Game.triggerEatFeedback(x, y, color, eatenRadius,
isPlayerInvolved)` replaces the old fixed `spawnParticles(...,14)` /
`spawnParticles(...,26)` calls at both eat sites (object eaten,
rival-hole eaten). Tiers are radius-based
(`CONFIG.juice.eatTiers.tinyMaxRadius/mediumMaxRadius`): tiny = a small
particle puff and no shake; medium = a bigger pulse of particles plus a
small camera shake; giant = a heavy particle burst, stronger shake, and a
new expanding-ring **`Ripple`** effect. Camera shake is dampened for
non-player eats (bots eating each other) so the screen doesn't jolt for
events the player didn't cause.

**Growth-tier transition pulse**: `checkSizeTier()` (added in Phase 1 for
analytics only) now also fires a green ripple + particle burst + a short
haptic tick around the player the moment their radius crosses one of the
existing `CONFIG.sizeTiers` thresholds. This is intentionally cosmetic
only — no stat or gameplay change — since the real evolution
system with player-facing choices is Phase 4's job; this just makes
growth *feel* like it's happening, today.

**Combo system**: consecutive player eats within
`CONFIG.juice.combo.windowSeconds` (1.6s) build a combo counter and a
score multiplier (`1 + step×(count-1)`, capped at
`CONFIG.juice.combo.maxMultiplier`), applied to both object value and
rival-eat score. A gold "×N.N COMBO (count)" text floats above the
player (canvas-drawn) and fades smoothly over
`CONFIG.juice.combo.fadeSeconds` (0.6s) once the window lapses, instead
of disappearing abruptly — verified with a frame-by-frame simulation
(`updateCombo(0.05)` × 50) showing full opacity through the window and a
linear fade after. This is a **baseline, non-perk combo** — Phase 4's
"Combo Reactor" mutation is expected to extend the same window rather
than replace this system.

**Can-eat readability**: `WorldObject.draw(ctx, highlight)` gained an
optional breathing rim, only drawn for objects within a narrow band
around the player's exact eat threshold
(`CONFIG.juice.canEatHighlightBandLow/High`, computed per-frame in
`Game.canEatHighlight()`). Objects far below or above the threshold get
`highlight = 0` and render exactly as before — this was explicitly
scoped to avoid the "visual noise on tiny objects" the GDD warns against.

**Danger readability**: `Game.drawDangerHalos()` draws a soft pulsing
red radial gradient behind any bot that both threatens the player
(bigger by `EAT_HOLE_RATIO`) and is within `CONFIG.juice.dangerHaloRange`
(260px), on top of the Phase 2 off-screen edge arrow. A new
`updateDangerWarnings()` fires a single short haptic buzz the moment a
given threat *enters* that range (tracked per-bot in a `Set`, cleared
when it leaves) instead of buzzing continuously while it lingers.

**Verified via Playwright**: tiny/medium/giant eat feedback tiers
(particle counts, shake, ripple-on-giant) with real gameplay objects;
score-with-multiplier arithmetic (a tracked eat sequence produced the
exact expected `score: 24` from a ×1 then ×1.15 combo); combo
count/multiplier/alpha across a controlled 50-frame simulation at a
realistic 0.05s step (matches the real loop's per-frame `dt` cap),
confirming the fade only starts once the window actually lapses; the
can-eat highlight returning `0` for a trivially-eatable object and `1`
for one sitting exactly on the threshold band; a growth-tier crossing
producing exactly one ripple; a danger-range entry producing exactly one
`dangerWarned` flag. A full-scene screenshot at 390×844 shows the combo
text, the danger halo, and the can-eat rim all rendering simultaneously
without visually competing (color hierarchy holds: gold = combo/reward,
warm red = danger, existing per-object neon = normal state) and without
covering the pause button, timer, size panel, or rank badge added in
Phase 2.

**Explicitly not touched**: no audio was added (still no audio system in
this prototype — GDD 5.4's "rośnie rytm audio" / pitch-ramp combo cue and
5.4's "bass hit" on giant eats are both audio-dependent and stay a gap
until the audio pass, GDD §9, same reasoning as skipping the Sound
toggle in Phase 2). Evolution cards, Overdrive, and any UI beyond the
existing HUD are still Phase 4+.

**Remaining risks / follow-ups**:
- The combo score multiplier is a real (if modest, capped at ×2.5)
  scoring change, not purely cosmetic — flagging this explicitly since
  "game-feel" work is expected to stay visual-only; it was judged in
  scope because the GDD's own P0 game-feel bullet list names "combo ...
  mnożnik" directly, but a future economy-tuning pass (Phase 7) should
  treat this as a formalized part of the scoring model rather than
  reopen it as an oversight.
- `CONFIG.juice.*` values (tier radii, combo window/step/cap, highlight
  band, danger range) are first-pass numbers, not yet playtested or
  A/B'd — they're centralized in `CONFIG` specifically so that can happen
  without touching this code.
- Danger halo/warning and the edge arrow (Phase 2) currently both key off
  the same `EAT_HOLE_RATIO` threat definition but are computed
  independently each frame; if a future hazard type is added (Phase 5
  districts) it should extend `updateDangerWarnings()` rather than grow
  a third parallel threat-detection pass.

**Next recommended phase (superseded — see §7)**: Phase 4 shipped next.

## 7. Phases 4–9 — what shipped together in this patch

The user explicitly asked to bring in "all phases" in one pass, then open
a PR and deploy. Phases 4–9 shipped as one combined patch (`game.js`,
`index.html`, `style.css`); Phases 10–11 were deliberately **not**
built — see §3's table for exactly why (no backend, no ad/IAP SDKs, no
secrets in this repo). This section documents what each phase actually
delivered, same honesty standard as Phases 1–3: every simplification
versus the GDD is named, not silently absorbed.

### Phase 4 — Evolution + Overdrive ("Golden Shot")

Two evolution offers per run trigger when the player's radius crosses
`CONFIG.evolution.triggerRadii` (45 / 65, the same thresholds Phase 1's
`size_tier` analytics already used). `Game.offerEvolution()` slows the
world to `slowMotionFactor` (25%) instead of pausing it, shows up to 3
weighted-random cards from a 7-mutation pool (`MUTATIONS`) positioned
above the Thumb Pad zone, and auto-picks the first option after 5s so an
idle player can never soft-lock a round. All 7 mutations from the GDD's
example list are implemented and run-only (reset every round, `Game.
activeMutations`):

- **Magnet Pulse** — pulls nearby edible objects each frame.
- **Slipstream** — a temporary speed multiplier once combo count hits a
  threshold.
- **Phase Edge** — extends post-hit invulnerability instead of blocking
  the hit outright (that's what the Shield run tool does — see Phase 7).
- **Combo Reactor** — extends the combo window for the rest of the run.
- **Scanner** — periodically pings the highest-value object on screen.
- **Shockwave** — pushes nearby small objects away on the next
  growth-tier crossing.
- **Bounty Core** — marks one rival (crown icon); eating it grants a
  score bonus.

The last `CONFIG.overdrive.triggerSecondsRemaining` (12s) trigger a
seed-driven Overdrive variant: **Blackout** (a dark overlay dims the
world layer only, HUD stays readable) or **Portal Rain** (a one-time
wave of high-value bonus objects that fold back into the normal pool
once eaten — no extra cleanup needed). The result screen gets a tag
(`BLACKOUT FINISH` / `PORTAL STORM`) carried into the share card.

Verified via Playwright: forcing the trigger radius shows exactly 3
cards; picking one adds it to `activeMutations` and hides the overlay;
forcing `timeRemaining` low triggers Overdrive with the expected
variant/tag; a Shield run tool correctly negates a would-be collision
before Phase Edge or scoring logic runs. One layout bug was caught and
fixed during testing: the Overdrive banner initially overlapped the
Phase 2 size/score HUD panel at narrow viewport widths — moved down in
`style.css` and re-verified by screenshot.

### Phase 5 — seeded generation (explicitly scoped down)

The GDD's own §14.2 (`DistrictDefinition`/`ChunkDefinition`/spawn
budgets/reachability validators, 6–9 macro-chunks per run) is a
multi-day content-and-tooling project on its own — building a shallow,
mislabeled version of it would be worse than being explicit about not
building it yet. What **did** ship:

- `SeededRNG` (added in Phase 1) now actually seeds something:
  `WorldObject.respawn(tierName, first, rng)` and `Game.createEntities()`
  use it for the *initial* object/player/bot positions and the bot name
  draw, so a given seed reproduces the same starting layout. Ongoing
  randomness (bot wandering targets, post-eat respawn position, particle
  drift) intentionally stays on `Math.random()` — only the start needs
  to match across devices for the Daily Seed Challenge to be fair.
- One lightweight, seed-driven run modifier: **Rush Hour** (35% chance
  per run when `CONFIG.flags.runModifiers` is on), which gives every bot
  a 1.3× speed multiplier for the round and shows a one-line toast at
  round start. This is the "1 modifier" the roadmap called for — it is
  not the `Blackout`/`Portal Storm`/`Bounty Hunt`/`Double Combo`/`Moving
  Grid` set from GDD §6.3 (note also that "Blackout" already exists as
  an *Overdrive* variant with different scope; naming overlap between
  the two systems is called out here to avoid confusion later).
- There is still exactly one implicit district (today's existing world);
  Neon Downtown/Circuit Garden/Synth Harbor/Glitch Mall/Skyline Core
  (GDD §6.2) do not exist as distinct visual/gameplay spaces.

Verified: `dailySeedForDate()` produces identical seeds for two
timestamps on the same UTC calendar day and a different seed for the
next day (checked directly via Playwright's page context).

### Phase 6 — Neon Core Hub (skeleton)

The main menu now doubles as the hub the GDD allows for a first pass
("can be 2D animated, not an explorable 3D world" — GDD §7): a City Core
meter (`save.hub.coreCharge`, +12%/run, wraps to 0 at 100% with a
milestone message), a one-line mission-text stub, and Play / Daily
Challenge / Workshop / Profile entry points all on one screen instead of
a bare menu + shop link. There is no separate Mission Board, Collection
Vault, League Terminal, or Event Portal screen — those are Phase 10+
territory and are not stubbed with fake content, per the project's
running rule against shipping fake features.

### Phase 7 — Shop v2 + economy (lean)

The Workshop screen gained a second tab: **Auras** (`AURAS`), a
purchasable glow effect layered on top of the existing ring skins,
buyable with either Coins or Prisms. This is what actually gives Prisms
a purpose — they weren't spendable on anything before this phase.
Prisms have no IAP adapter (deliberately — see Phase 11), so the only
earn path is a small trickle from progression (`+1 every 3rd run`),
matching the GDD's "slowly earned from progression" clause for the
premium currency rather than inventing a fake purchase flow.

A new pre-round **Run Setup** screen offers two casual-only consumable
tools (`RUN_TOOLS`): **Shield** (blocks the next collision with a bigger
rival outright — distinct from the Phase 4 Phase Edge mutation, which
only softens the aftermath) and **Magnet** (an 8-second pull at round
start). Both cost Coins, deducted on confirm, and are cleared after one
round so "Play Again" can't silently reuse a paid tool for free. Only 2
of the GDD's 5 example tools (Scanner/Burst/Combo Extender omitted) —
the mutation pool already covers similar effects (Scanner, Slipstream)
for evolution, and adding near-duplicate purchasable versions felt like
padding rather than value.

Verified: selecting Shield deducts the correct Coin price, and a forced
collision with a shield charge active leaves the player's radius
unchanged and decrements the charge instead of triggering the normal
eat/shrink logic.

### Phase 8 — Profile + Share

An optional display name (never required before the first run — the
Profile screen is reachable but never forced) replaces the previous
hardcoded "Ty" player name once set, stored alongside a stable guest ID
already generated in Phase 1's save schema. Name input passes through
`moderateName()`, a small hardcoded blocklist — this is explicitly **not**
production profanity moderation (the GDD calls for real moderation before
names go public; this project has no "public" name surface like a
server-side leaderboard yet for it to protect). It exists so the flow
isn't shipped with zero safeguard at all, not as a finished answer.

`Game.shareResult()` uses `navigator.share`, feature-detected via
`navigator.canShare` before calling it, with a clipboard-copy fallback
(button text flips to "SKOPIOWANO ✓" for 2s) for browsers without Web
Share — per the GDD's explicit instruction to never assume it exists.
The shared text includes rank, score, the Overdrive tag if the round hit
one, and the run's seed.

Verified: saving a clean name persists it and is reflected as the
in-round player label; saving a blocklisted name is rejected (stored as
`null`, falls back to the guest label); the share flow doesn't throw
with `navigator.share` stubbed out mid-test.

### Phase 9 — Daily Seed Challenge (local-only)

`startDailyChallenge()` forces the round's seed to the UTC-date-derived
value from Phase 5, so every player gets the same starting layout,
modifier, and (seed-driven) Overdrive variant on a given calendar day.
Progress is tracked entirely client-side in `save.daily`
(`lastSeedDate`/`lastSeedScore`) — **there is no backend, so there is no
actual leaderboard, league, ghost race, or cross-device comparison yet**;
this phase only delivers the deterministic-seed half of "Daily," which
is also the half that needed no infrastructure to build honestly. The
in-round Bounty Core mutation is the closest thing to the GDD's
Rival/Nemesis idea that exists today; it is not a persistent nemesis
system.

Verified: leaving a Daily run early (via the Phase 2 pause/leave flow)
still records a `save.daily` entry and fires `daily_challenge_end` with
`isNewBest` computed correctly against the same day's prior score.

### Cross-cutting: what got touched everywhere

- `SAVE_SCHEMA_VERSION` is now 4; v3→v4 migration adds `auras`,
  `displayName`, `hub`, and `daily` to any existing save without losing
  coins/skins/settings from earlier phases.
- `CONFIG.flags`: `evolutionSystem`, `runModifiers`, `hub`, `shopV2`,
  `dailyChallenge` are now `true` (their systems exist); `proceduralDistricts`
  and `monetizationAdapters` stay `false` on purpose — flip them only once
  their real scope (full chunk generator; real ad/IAP SDK) is actually
  built, not to "unlock" today's lightweight stand-ins.
- `index.html` grew several new screens/overlays (`runSetupScreen`,
  `profileScreen`, `evolutionOverlay`, `overdriveBanner`) but kept the
  existing pattern of one flat DOM with `.hidden`-toggled screens — no
  router was introduced.

### Golden Slice acceptance criteria — where this patch actually lands

Checking against the master prompt's own "Golden Shot acceptance
criteria" list:

- ✅ Starts without account friction (guest-first; Profile is optional).
- ✅ Thumb Pad control doesn't require covering the action with a finger.
- ✅ Can-eat/danger cues (Phase 3) make eatability legible quickly.
- ✅ Visible growth within ~10s (existing growth curve + Phase 3 pulse).
- ✅ At least one evolution/mutation choice per run (two, in fact).
- ✅ A distinct Overdrive event with two variants.
- ⚠️ "Clear post-run progression into hub/league/collection" — hub
  meter and mission stub exist; **league and collection do not** (Phase
  10/11, deferred).
- ✅ Immediate replay or share of a best result.
- ✅ Completes on a small iPhone-class viewport with no HUD/control
  overlap (verified by screenshot at 375×667/390×844 across phases,
  including the Overdrive banner fix this phase).

### Remaining risks / honest gaps after Phases 1–9

- **No backend, anywhere.** Daily Challenge, profile, and economy are
  all `localStorage`-only. Clearing site data resets everything; there
  is no cross-device sync. This is the single biggest gap versus the
  full GDD vision and is exactly what Phase 11 (explicitly deferred)
  exists to close, once retention data justifies the investment (GDD
  §13/§16 — "monetization/backend before retention" is called out as a
  risk to avoid, not a checklist to rush).
- **Only one district, one modifier.** Replayability from Phase 5 comes
  from the evolution/mutation variety and Overdrive, not from level
  variety yet.
- **`game.js` is now a large single file.** Still inside the three-file
  constraint by instruction, but if a future phase (real district
  content, a real hub scene) makes this unwieldy, that is a decision to
  put back to the user explicitly, per §2's conflict-resolution note —
  not something to resolve unilaterally by splitting files or adding a
  bundler.
- **`CONFIG.evolution`/`CONFIG.overdrive`/`CONFIG.juice`/economy values**
  are first-pass numbers across all of Phases 3–9, not validated by any
  real playtesting or A/B data — they're centralized in `CONFIG`
  specifically so that tuning pass doesn't require touching this code
  later.

**Next recommended phase**: Phase 10/11 only once real usage data
justifies backend investment (per the GDD's own KPI-gate guidance) —
until then, the highest-value next work is playtesting and tuning the
`CONFIG` values shipped across Phases 3–9, not adding more systems.
