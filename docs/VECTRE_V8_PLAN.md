# Vector Hole v8 — „Golden Shot” retention / balance / juice pass

Single-pass upgrade on top of v7 aimed at D1–D7 retention, an easy-start →
difficulty-wall balance curve, and stronger moment-to-moment game feel.
Still exactly three runtime files, zero dependencies, no backend, no real
ads/IAP (the existing fake rewarded-ad flow is untouched).

## 1. Retention loop
- **Player level / XP** (`CONFIG.progression`, `save.player`, `Game.grantXp()`):
  every Arena/Daily run (`finalizeRun()`: base + score + podium bonus) and
  every Campaign mission (`endCampaignMission()`) grants XP. Level-ups pay
  coins (every level) and prisms (every 3rd level) and queue an „AWANS!”
  celebration through the existing unlock overlay. Hub shows a level row;
  both result screens show an animated XP bar (`renderXpCard()`).
- **7-day login calendar** (`CONFIG.loginRewards`, `save.login`,
  `#loginRewardScreen`): shown once per UTC day on Miasto
  (`maybeShowLoginReward()`); missing a day restarts at day 1; day 7 is the
  big pack (500 coins + 15 prisms).
- **Free chest** (`CONFIG.freeChest`, `save.freeChest`, `#hubFreeChest`):
  4 h cooldown with a live countdown, random 40–140 coins, 20 % prisms,
  6 % ×3 jackpot.
- Save schema **v10** (`migrateSave()` branch adds `player`/`login`/`freeChest`).

## 2. Balance / difficulty curve
- **Career difficulty** `CONFIG.difficulty` → `Game.difficultyT` (0 for the
  first 3 Arena runs, ramping to 1 at run 16; Daily uses a fixed 0.5).
  Lerp'd per round into bot spawn size, speed, player-hunt range (0 = bots
  never hunt you), object-hunt range, decision speed and passive growth
  (`Game.botTuning`, read by `Bot.decide()`/`Bot.update()`).
- In-round escalation: bots +10 % speed in the last 40 s.
- Run setup shows a **threat meter**; new run tool **Turbo start** (◇70,
  start at T2) is badged „POLECANE” once the curve bites; the result
  screen shows an upgrade card after a non-podium finish.
- Economy: newbie ×2 coins for the first 5 runs, coins = score/4 + 15,
  prism trickle 2 per 3 runs, daily-mission rewards up ~70 %, first two
  Core City levels fill 1.6× faster, cheap first cosmetic (30) and steeper
  top end (450), interstitials only every 3rd replay and never in newbie runs.

## 3. Juice
- Arena camera zooms out as the hole grows (`CONFIG.juice.zoom`; Campaign
  keeps zoom 1). Every screen↔world conversion (`pointerWorld`,
  `isInView()`, grid, minimap view rect, danger arrows) goes through
  `Game.zoom`/`viewHalfW`/`viewHalfH`.
- `FloatText` "+N" pop-ups, mixed dot/spark/pixel particles (capped at
  `maxParticles`), screen flash, hit-stop on rival eats, center banners for
  tier-ups / combo praise (`CONFIG.juice.praise`) / round start / final
  stretch, a big final-10-s countdown and urgent timer pill, poppier combo
  text with a combo-window bar, reactive grid dots.
- Result screens: count-up numbers, „ZWYCIĘSTWO!”/„PODIUM” headline,
  confetti on podium/PB/mission success, staggered card entrance.
- CSS: drifting backdrop glow + scanlines, shine sweep and breathing CTA,
  press squash, currency pop. All motion respects `prefers-reduced-motion`.

## Known gaps
- Balance numbers are first-pass and unverified with real players.
- Login/chest timers trust the device clock (local-only, no backend).

---

# v9 follow-up — „spójność, game feel, rdzenie z bonusami”

Player feedback on v8: the first-run screen was plain and inconsistent,
gameplay barely changed, holes/icons had no identity, bought skins only
changed color, fonts were weak, particles were random and animations piled
on top of each other.

- **Typography**: Russo One (display: titles, numbers, banners, CTAs) +
  Exo 2 (UI), both with Polish latin-ext glyphs, loaded from Google Fonts
  in `index.html` with system-font fallback (`--font-display`/`--font-ui`,
  `FONT_DISPLAY`/`FONT_UI` for canvas). This is the one external request
  the page makes; offline it falls back to system fonts.
- **First-run attract screen** (`#hubWelcome`, `drawWelcomeScene()`): a live
  miniature of the game (city objects spiraling into a growing hole) under
  a VECTOR HOLE logo, three feature tiles and a single ZACZNIJ GRĘ CTA.
- **Hole identity**: `SKIN_STYLES` + `drawHoleRim()` give each Rdzeń its own
  rim (tech brackets, plasma flame, toxic bubbles, galaxy stars, sun
  corona, storm lightning, aurora bands, crystal shards, prism); every hole
  has an accretion disk (`drawAccretionDisk()`) and a gravity-well glow.
  Bots get varied styles (`BOT_STYLES`).
- **Rdzeń perks** (`SKINS[].perks`, `Game.perk()`, Arena/Daily only):
  speed, combo window, mini magnet, XP, coins, start size + score, score,
  growth. Shown on Warsztat cards, the preview panel and the run setup.
- **Złoty Rdzeń + SZAŁ** (`CONFIG.golden`): a golden core spawns every
  ~20 s (gold edge arrow + minimap marker); the player eating it triggers
  SZAŁ for 7 s — points ×2, longer reach, speed, pull field, and objects
  one growth tier above become eatable (`Game.holeCanEat()`). Timed on the
  round clock so pauses don't consume it.
- **Effects cleanup**: eaten matter spirals into the eater (`Particle`
  `'suck'` kind, `spawnSuck()`); score pops merge into one counter above
  the hole (`addScorePop()`); one banner at a time with priorities and a
  queue (`showBanner(…, priority)`), countdown 5-4-3-2-1 and Overdrive go
  through it; combo moved to a fixed HUD spot (`drawComboHud()`); fewer
  flashes/rings.
- Emoji replaced by inline SVG / canvas glyphs across HUD, hub and results.
