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
| **2** | Floating Thumb Pad input (with legacy drag toggle), pause/leave-run sheet, HUD v2 (explicit Size/Score/Rank, collapsible standings, contextual minimap) | P0/P1 | **Shipped this patch** |
| 3 | Game-feel/juice pass: size-aware eat feedback, growth-tier ring transitions, combo readability, can-eat/danger cues | P0 | Not started |
| 4 | Evolution moments (2/run, 3-card weighted offer, run-only mutations) + Overdrive/City Shift finale (≥2 variants) | P1 | Not started |
| 5 | Seeded chunk generator: `DistrictDefinition`/chunk templates/spawn budgets/validators, ship Neon Downtown + 1 modifier | P1 | Not started |
| 6 | Neon Core Hub skeleton + City Core meter + first unlocks | P1 | Not started |
| 7 | Shop v2 (categories, loadout, preview/equip), economy tuning hooks, two-currency model (Coins/Prisms), casual run tools | P2 | Not started |
| 8 | Guest profile, cosmetics identity, share card (`navigator.share` + fallback) | P2 | Not started |
| 9 | Daily Seed Challenge (local-first) + league/ghost/bounty async competition | P2 | Not started |
| 10 | Collections, live-event tooling, additional districts/modifiers | P3 | Not started |
| 11 | Backend leaderboard, cloud save/auth, real monetization adapters | P3+ | Gated on retention KPIs (see GDD §13/§16) |
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

**Next recommended phase (superseded — see §5)**: Phase 2 shipped next;
Phase 3 (game-feel/juice pass) is next up.

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

**Next recommended phase**: Phase 3 (game-feel/juice pass — size-aware
eat feedback, growth-tier ring transitions, combo readability), since it
builds directly on the HUD/size-tier groundwork just shipped and is
still P0 priority per GDD §15.1.
