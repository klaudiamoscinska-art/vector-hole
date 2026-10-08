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
