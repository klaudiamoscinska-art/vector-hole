'use strict';

/* =========================================================
   VECTOR HOLE: EAT THE NEON CITY
   Vanilla Canvas game — classes: Game, Hole, Bot, WorldObject, Particle
   ========================================================= */

/* ----------------------- Config layer (data-driven tuning + feature flags) -----------------------
   All gameplay/economy tunables live here so future phases (RemoteConfig,
   A/B tests, difficulty tuning) have one place to change values without
   touching gameplay code. Existing top-level consts below are kept as
   aliases into this object so the rest of the file is untouched. */

const CONFIG = {
  version: '13.0.0-design-pass',
  world: { width: 3000, height: 3000, gridSize: 100 },
  round: { duration: 120 },
  bots: { count: 5 },
  // v13 "first 3 seconds": Arena food layout. Fragments are laid in short
  // trails along the road lanes (a line of pickups is the most satisfying
  // eat in a hole game -- a guaranteed combo) and every hole spawns in the
  // middle of a small feast, so the first bite lands in well under a second.
  arena: {
    trails: 10, trailLength: 8,
    feastFragments: 10, feastCapsules: 2,
    roadRespawnChance: 0.5   // share of eaten fragments that respawn on a road lane
  },
  // maxRadius (v12): bot careers showed late-round holes snowballing past
  // r 1000 (once r 5800 -- bigger than the 3000x3000 world, sweeping every
  // respawn the frame it appeared and scoring 450k). Past this the hole would
  // swallow the whole phone screen even at the farthest camera zoom.
  hole: { baseRadius: 18, minRadius: 14, baseSpeed: 165, maxRadius: 480 },
  // One shared growth curve for Arena AND Campaign (player feedback: the
  // first growth stage was the dullest part -- each pickup barely changed
  // the hole's size, and pink/green objects were still bigger than the
  // hole once they became eatable). Every eat adds "growth units" (the
  // GDD 07 per-type `growth` value -- fragment 1, prop 3, vehicle 6, ...)
  // and the hole's radius is read straight off this piecewise-linear
  // curve, so (a) each early fragment is a clearly visible +2 px on an
  // 18 px hole, and (b) the radius at every tier threshold is known
  // exactly -- every TIERS/entityRadius object size below sits between
  // the previous anchor (looks too big before unlock) and its own unlock
  // anchor (visibly smaller than the hole the moment it becomes eatable).
  // unitAnchors double as CAMPAIGN_TIERS' minUnits and radiusAnchors as
  // CONFIG.sizeTiers' minRadius (both derived below), so Arena and
  // Campaign cross every tier after exactly the same pickups.
  growth: {
    unitAnchors: [0, 6, 22, 50, 100, 180],
    radiusAnchors: [18, 30, 46, 66, 90, 118]
  },
  eating: {
    // World-object eating has no size-ratio requirement, only the
    // TIERS/canEatWorldObjectTier() growth-tier gate (matching Campaign's
    // own tier-only gate) -- holeRatio below is hole-vs-hole only.
    holeRatio: 1.15, // attacker must be bigger than defender.radius * this
    growHole: 0.55,
    eatAnimTime: 0.28,
    invulnTime: 2.0
  },
  economy: {
    // Golden Shot v11 rebalance (bot-tested, see qa/arena-bots.mjs): coins
    // were score/4, so one strong round (10-20k pts) paid 3-6k coins and
    // emptied the whole Warsztat. Now sublinear: coinsBase +
    // coinsSqrtK * sqrt(score) + a place bonus -- a good round pays
    // ~150-250, a weak one still ~60, so every cosmetic is a few rounds of
    // goal instead of a single round's change.
    coinsSqrtK: 1.6,
    coinsPlaceBonus: [25, 15, 8],
    coinsBase: 15,
    adRewardMultiplier: 2,
    // Golden Shot v8: a new player's first rounds pay double ("efekt
    // sukcesu") -- the result screen shows a "BONUS NOWICJUSZA x2" tag.
    newbieRuns: 5,
    newbieCoinMult: 1.5,
    // Every 3rd Arena/Daily run used to drip exactly 1 prism; now 2.
    prismTrickleEvery: 3,
    prismTrickleAmount: 2
  },
  // Golden Shot v8: career-based difficulty curve ("ściana trudności").
  // `t` = 0 for a player's first rampStartRuns Arena runs (bots start
  // smaller than you, never hunt you, wander slowly -- a guaranteed
  // early-win streak), ramping linearly to 1 at rampFullRuns (bots start
  // bigger than you, hunt you from far away, decide faster, and keep
  // growing on their own). Each [easy, hard] pair is lerp'd by `t`. The
  // Daily Seed Challenge uses a fixed dailyT so its seeded layout plays the
  // same for everyone. The run-setup screen shows the current threat level
  // next to the run tools (RUN_TOOLS) that counter it.
  difficulty: {
    rampStartRuns: 3,
    rampFullRuns: 24,   // v13: 16 -> 24, the wall arrived as a cliff (runs 15-17: 6th, 3rd, 6th)
    dailyT: 0.5,
    botSpeedMult: [0.78, 1.12],
    botStartRadius: [15, 24],     // v13: 27 could eat an 18 px player on contact at spawn
    botAggroRange: [0, 560],      // 0 = bots never hunt the player at all
    botPreyRange: [300, 460],
    botObjectRange: [200, 480],   // easy bots are lazy eaters, so they grow slower than you
    botDecisionSeconds: [0.75, 0.3],
    botPassiveUnitsPerSec: [0, 0.22],
    // In-round escalation: bots speed up for the final stretch of every round.
    lateRoundSeconds: 40,
    lateRoundBotSpeedBonus: 0.1,
    labels: ['NISKIE', 'ŚREDNIE', 'WYSOKIE', 'EKSTREMALNE']
  },
  // v13 "the race": one rival per round (the pacer, Game.pacer) runs on a
  // par-score curve taken from the player's own recent form -- the median
  // of the last finished Arena rounds -- times a difficulty factor, so the
  // standings are a close race instead of a 10x blowout either way (QA
  // career: a greedy player won by 20 000 points; a casual one either won
  // by 4 000 or finished 5th). When it falls behind par it eats from
  // farther away and its bites count more (up to maxBoost); ahead of par
  // its bites count less. Beat your own usual score and you beat it.
  rival: {
    defaultPar: 2600,          // before the player has any finished round
    minPar: 1200, maxPar: 40000,
    parFactor: [0.72, 1.05],   // lerp'd by difficultyT
    history: 5,                // rounds in save.stats.recentArenaScores
    maxBoost: 8, minMult: 0.35, maxGrowthBoost: 2,
    hungryObjectRange: 650,
    finalChaseSeconds: 15,
    // ...and it tails a runaway leader at this share of the player's score
    // (lerp'd by difficultyT), so a snowballing round still feels like a
    // chase instead of a lap of honour. Below 1: you keep the win.
    chaseRatio: [0.7, 0.9]
  },
  // Golden Shot v8 retention loop: player XP level (every mode feeds it),
  // a 7-day login calendar, and a free chest on a 4 h cooldown.
  progression: {
    xpSqrtK: 2.5,                  // XP = base + K * sqrt(score) + place bonus (v11: was 0.5 * score)
    xpRunBase: 25,
    xpPlaceBonus: [60, 40, 25],    // place 1/2/3
    xpMissionSuccess: 90,
    xpMissionFail: 25,
    xpForLevel: (level) => 120 + (level - 1) * 70,
    levelCoins: (level) => 40 + level * 15,
    levelPrismsEvery: 3,           // +prisms on every 3rd level
    levelPrisms: 5
  },
  loginRewards: [
    { coins: 60 }, { coins: 90 }, { prisms: 3 }, { coins: 150 },
    { prisms: 6 }, { coins: 250 }, { coins: 500, prisms: 15, big: true }
  ],
  freeChest: {
    cooldownMs: 4 * 60 * 60 * 1000,
    coins: [40, 140],
    prismChance: 0.2,
    prisms: [2, 5],
    jackpotChance: 0.06,           // rare 3x coin jackpot
    jackpotMult: 3
  },
  // Phase 9 fix: the Daily Seed Challenge needs an explicit goal (beat
  // today's best) and a reward for playing it, not just a different seed.
  daily: {
    completionBonusCoins: 30,
    newRecordBonusCoins: 50,
    newRecordBonusPrisms: 3
  },
  // GDD 4.0 §7.3/§8: Core City is the long-term meta bar. It is filled
  // ONLY by Arena (GRAJ 2:00) and Daily runs -- Campaign missions never
  // touch it (§4.3 "Misje NIE napełniają Core City", enforced by
  // finalizeRun() being an Arena/Daily-only code path; endCampaignMission()
  // never calls it). Gains are additive per §7.3's table; overflow past
  // 100% carries into the next level rather than being discarded.
  hub: {
    coreCity: {
      arenaCompleteGain: 10,
      // Golden Shot v8: the first two Core City levels fill faster so the
      // first cosmetic reward lands within the first session.
      earlyLevelMax: 2,
      earlyLevelMult: 1.6,
      arenaTop3Gain: 2,     // place 1-3 (additive with completeGain)
      arenaFirstGain: 3,    // place 1 only (additive on top of the Top3 bonus)
      arenaNewPbGain: 2,    // new personal-best score this run, max once per round
      dailyFirstClearGain: 20, // first Daily completion of the UTC day
      dailyNewBestGain: 10     // "premium/gold" bonus: a new Daily best this run
    },
    // Fallback reward once level 6 (and every skin/aura/effect/overdrive
    // skin from the ladder) is already owned -- GDD §8.2's own disclaimer
    // that a "seasonal/prestige loop" beyond LVL6 is out of scope for now.
    milestoneFallbackCoins: 100,
    milestoneFallbackPrisms: 10
  },
  // GDD 4.0 §5.5 unlock order: Dzielnice (campaign) is always available;
  // everything else gates off campaign mission completion so a fresh save
  // is onboarded through the campaign first.
  unlockGates: {
    arena: 'M01',   // GRAJ 2:00 / Wyzwanie dnia's underlying round unlocks after M01
    warsztat: 'M02', // or first owned cosmetic beyond the free defaults, see isWarsztatUnlocked()
    wyzwania: 'M03',  // Wyzwanie dnia tab + full bottom nav
    fullNav: 'M03'
  },
  // Floating Thumb Pad tuning (Phase 2). Legacy direct-drag stays available
  // via settings.inputMode and is unaffected by these values.
  input: {
    zoneHeightFraction: 0.35, // bottom % of screen height that anchors the pad
    deadZonePx: 10,
    maxRadiusPx: 55,
    curveExponent: 1.6,       // >1 = more precision near center, speed at full deflection
    fadeDelayMs: 400,
    minimapAutoHideWidth: 700 // below this viewport width, minimap defaults off
  },
  // Phase 3 game-feel/juice tuning.
  juice: {
    eatTiers: { tinyMaxRadius: 10, mediumMaxRadius: 24 }, // above mediumMaxRadius = "giant" eat
    combo: { windowSeconds: 1.8, stepBonus: 0.15, maxMultiplier: 3, fadeSeconds: 0.6 },
    // Golden Shot v8 game feel (see FloatText, Game.flash/hitStop/zoom).
    praise: [[5, 'SUPER!'], [10, 'MEGA!'], [15, 'NIESAMOWITE!'], [22, 'LEGENDARNE!'], [30, 'BOSKIE!']],
    zoom: { min: 0.58, max: 1.08, startRadius: 18, endRadius: 150, lerp: 2.2,
      // v12: bots end strong rounds at r 400-800, which at a fixed 0.58 zoom
      // filled the whole phone screen with the hole. Past endRadius the
      // camera keeps pulling back so the hole spans at most this fraction of
      // the short screen side, down to `floor` -- and never so far out that
      // the view would show past the edge of the 3000x3000 world.
      holeScreenFrac: 0.24, floor: 0.25 },
    hitStopMs: 70,
    maxParticles: 450,
    dangerHaloRange: 260
  },
  // Phase 4: Evolution moments (run-only mutation picks) + Overdrive/City Shift.
  evolution: {
    triggerRadii: [46, 66],  // fires once each, aligned with the 'core'/'vortex' size tiers (growth.radiusAnchors[2..3])
    cardCount: 3,
    autoPickMs: 20000,       // safety net only (an explicit "skip" button covers the normal case) --
                             // long because the offer now fully pauses the round instead of just slowing it
    magnetRadius: 160,
    magnetPull: 90,
    slipstreamComboThreshold: 3,
    slipstreamSpeedMult: 1.6,
    slipstreamMs: 1500,
    phaseEdgeInvulnBonusMs: 2000,
    scannerIntervalSeconds: 4,
    shockwaveRadius: 140,
    shockwavePush: 70,
    bountyBonusScore: 40
  },
  // Golden Shot v9: the Złoty Rdzeń chase -- a rare golden core appears
  // somewhere on the Arena map (gold arrow points at it); whoever eats it
  // first, and if that's the player, SZAŁ (frenzy) kicks in: points x2,
  // a longer reach, a speed boost, a pull field, and objects ONE growth
  // tier above your own become eatable for a few seconds.
  golden: {
    firstDelay: 10,       // seconds into the round
    interval: 20,         // seconds between cores (after one is eaten/expires)
    lifetime: 14,         // seconds before an uneaten core fades out
    minDistance: 500,     // spawns at least this far from the player
    frenzySeconds: 7,
    scoreMult: 2,
    reachMult: 1.35,
    speedMult: 1.2,
    magnetRadius: 220
  },
  // Golden Shot v11: shown in the in-game privacy notice. Fill in the
  // publisher's legal name + contact before a commercial launch.
  legal: { publisher: 'Wydawca gry Vector Hole', contact: '' },
  // Golden Shot v11 ad pacing (see Monetization). Rewarded ads are always
  // opt-in; interstitials only between rounds, never in the newbie runs,
  // never more often than every interstitialMinGapMs, never with "Bez reklam".
  ads: {
    interstitialEveryNthReplay: 3,
    interstitialMinGapMs: 150000,
    demoSeconds: 3,
    reviveSeconds: 20,        // mission revive: extra time granted
    reviveMinProgress: 0.4,   // only offered when the goal is at least this done
    reviveOfferSeconds: 7,    // offer auto-declines after this long
    revivePrisms: 8,          // v15: the same +time bought with prisms instead of an ad
    freePrisms: 5
  },
  // v15 "Wyzwanie": the session limit (owner: "limitowany czas rozgrywki w
  // sesji z możliwością dokupienia przed odnowieniem"). Every Arena round and
  // every mission attempt costs 1 energy; a WON mission gives it back, so
  // only defeats (and Arena rounds) drain it. It refills one point per
  // regenMinutes up to `max`; rewards and purchases may push it above max.
  // Free: the tutorial, the first `freeArenaRuns` rounds, the first Daily
  // attempt of the day.
  energy: {
    max: 5,
    regenMinutes: 20,
    refillPrisms: 12,         // full refill before the timer does it
    adGain: 1,                // per rewarded ad (capped by AD_PLACEMENTS.energy_ad)
    freeArenaRuns: 3,
    cap: 30
  },
  // v15: one-shot mission boosters bought (or won) before a mission starts.
  boosters: {
    unlockMission: 'M04',     // after Plac Neonów's boss (+1 of each as a gift)
    timeBonus: 15,            // "Zegar": seconds added to the limit
    shieldHits: 2,            // "Tarcza": hits absorbed (rivals, glitch zones, a fragile vortex)
    pityFails: 3              // after this many defeats in a row NELA lends a free Zegar (once per mission)
  },
  // v15: three stars per mission. Star 1 = clear; star 2 = clear within
  // the "fast" time; star 3 = the expert time (or the mission's special
  // challenge). Every `chestEvery` stars opens a star chest.
  stars: {
    chestEvery: 15,
    chest: { coins: 120, prisms: 3, booster: 1 }
  },
  overdrive: {
    triggerSecondsRemaining: 12,
    variants: ['blackout', 'portal_rain'],
    bonusObjectCount: 10,
    bonusObjectValue: 15
  },
  // Vector Hole v3 (GDD 3.1) campaign mode. Kept separate from `eating`/
  // `juice` above so Arena's already-tuned balance is untouched.
  campaign: {
    baseRadius: 18, // = growth.radiusAnchors[0]
    comboWindowSeconds: 1.5,   // GDD 07: "kolejne pożarcie w 1,5 s"
    comboMaxMultiplier: 2.0,   // GDD 07: "combo 1,0-2,0 mnoży punkty, nie wzrost"
    hitPenaltyFraction: 0.25,
    // Campaign rivals don't grow, so their fixed size sets the difficulty
    // arc on CONFIG.growth's curve: a threat (bigger than player * holeRatio)
    // for the first ~5 fragments, harmless around T2 (30 px), and prey from
    // ~37 px (T2 plus a few props) -- well before M00's eatRival step at T3.
    rivalRadius: 32,  // GDD 07: contact with a bigger bot costs 25% of current growth
    hitInvulnMs: 2000,
    // T2+ entities (prop/marker/vehicle/node/pylon/landmark) are sized
    // between two growth.radiusAnchors: bigger than a hole that hasn't
    // reached their unlock tier yet (player feedback: "przed urośnięciem
    // dziury powinny być od niej większe"), but clearly smaller than the
    // hole the moment that tier unlocks (player feedback: "obręcze obiektów
    // są większe niż ja, kiedy mogę je już pochłaniać") -- e.g. prop 20 sits
    // between the 18 px start and T2's 30 px. Their highlight rings add only
    // a few px on top (see WorldObject/CampaignEntity.draw()), so the ring
    // stays inside the hole too. T1 fragment/capsule stay small since
    // they're eatable from the very first frame, no lock to visually signal.
    entityRadius: {
      fragment: 7, capsule: 10,
      prop: 20, marker: 20,
      vehicle: 34, node: 32, pylon: 32,
      landmark: 52,
      // v10: T4/T5/T6 classes, each sized between the previous tier's
      // radius anchor and its own (46..66 / 66..90 / 90..118 px).
      structure: 54, heavy: 76, tower: 100,
      gate: 18,
      // v15: a fleeing golden byte (T1, eatable from the start) and a
      // drifting glitch zone (a hazard, never eaten; radius set per zone).
      runner: 12, glitch: 90
    },
    // v10: campaign rivals are fixed-size (see rivalRadius); a mission can
    // field bigger ones with setup.botRadius.
    // Landmark size/value follows the tier it's gated at (LANDMARK_TIERS):
    landmarkByTier: {
      4: { radius: 52, growth: 32, score: 160 },
      5: { radius: 78, growth: 48, score: 240 },
      6: { radius: 104, growth: 64, score: 320 }
    },
    gate: { cycleSeconds: 3.5, openSeconds: 2.0, telegraphSeconds: 1.5 },
    nelaDisplaySeconds: 4.5,
    // v15 mission twists (setup flags compiled from MISSION_SPECS):
    // Łowcy -- bigger rivals chase the player (in bursts, then rest).
    hunter: { range: 300, chaseSeconds: 3.0, restSeconds: 2.4, afterHitRest: 6, speedMult: 1.0 },
    // Złodziej -- a rival racing the player for the goal objects.
    // It waits until the hole can eat the race objects, then runs at
    // speedBase + speedPerDiff * difficulty of its own speed.
    racer: { radius: 26, speedBase: 0.45, speedPerDiff: 0.05, decision: 0.4, headStart: 2 },
    // Złoty bajt -- flees once the hole is near.
    runner: { speed: 128, panicRange: 230, wanderSpeed: 40 },
    // Strefa glitcha -- a drifting zone that costs growth like a rival hit.
    glitch: { minRadius: 70, maxRadius: 105, speed: 34, hitInvulnMs: 1400 },
    // Awaria prądu -- you only see a circle around the hole.
    dark: { vision: 175, perRadius: 1.7 },
    // A 1400x1400 box centered in the shared 3000x3000 world (see
    // buildCampaignMission) — the mission's actual playable area: entities
    // spawn here, drawCampaignMinimap() frames it, and clampToCampaignBounds()
    // holds player/bot movement to it. Player feedback (round-tripped twice):
    // letting movement extend past this into the empty rest of the 3000x3000
    // shared world (matching Arena's own, much larger, fully-populated world)
    // let the player wander off "the map" into nothing, since Campaign's
    // objects -- unlike Arena's TIERS pool -- are curated to just this box.
    // Keep clamping movement here; only the boundary's on-screen look should
    // match Arena's style (see drawCampaignGrid()), not its actual extent.
    bounds: { minX: 800, maxX: 2200, minY: 800, maxY: 2200 }
  },
  // Size tiers used for analytics (`size_tier` events), the game-over result
  // badge, and (since Arena's in-round HUD was unified with Campaign's tier
  // strip) the live "T1"/"T2".../missionTierBadge. `shortId`/`color` mirror
  // CAMPAIGN_TIERS' T1-T5 exactly so a given tier number reads as the same
  // color in both modes. minRadius is filled in right after CONFIG from
  // growth.radiusAnchors (30/46/66/90) -- the same curve Campaign's
  // growthUnits run along, so both modes cross a tier after exactly the
  // same pickups (player feedback: Arena and Campaign must be the same
  // gameplay).
  sizeTiers: [
    { id: 'spark', minRadius: 0, label: 'T1 · MAŁY', shortId: 'T1', color: '#50F0FA' },
    { id: 'pulse', minRadius: 0, label: 'T2 · ŚREDNI', shortId: 'T2', color: '#FF54AD' },
    { id: 'core', minRadius: 0, label: 'T3 · DUŻY', shortId: 'T3', color: '#EFCB63' },
    { id: 'vortex', minRadius: 0, label: 'T4 · WIELKI', shortId: 'T4', color: '#9875FF' },
    { id: 'titan', minRadius: 0, label: 'T5 · OGROMNY', shortId: 'T5', color: '#CBD5E1' },
    { id: 'singularity', minRadius: 0, label: 'T6 · KOLOSALNY', shortId: 'T6', color: '#46D99A' }
  ],
  // Feature flags for systems introduced in later Golden Shot V2 phases.
  // Everything defaults to the current (pre-V2) behavior.
  flags: {
    inputThumbPad: true,   // Phase 2: Floating Thumb Pad control (global kill-switch; false forces legacy)
    evolutionSystem: true, // Phase 4: evolution cards + Overdrive
    runModifiers: true,    // Phase 5 (scoped): seed-driven Rush Hour modifier; full chunk/district system NOT built
    proceduralDistricts: false, // full authored chunk generator (GDD §14.2) — not implemented, see plan doc
    hub: true,              // Phase 6: Neon Core Hub skeleton
    shopV2: true,           // Phase 7: shop categories/loadout + Prisms
    dailyChallenge: true,   // Phase 9: daily seed challenge (local-only, no backend leaderboard)
    monetizationAdapters: true,  // v11: runtime-detected portal/native ad+IAP adapters (see Monetization) -- still no secrets in-repo
    analyticsConsoleLog: true,   // Phase 1: log analytics events to console
    campaignMode: true           // Vector Hole v3: mission-driven Campaign alongside Arena
  }
};

CONFIG.sizeTiers.forEach((t, i) => { t.minRadius = i === 0 ? 0 : CONFIG.growth.radiusAnchors[i]; });

/** Hole radius for a given number of growth units, read off
 *  CONFIG.growth's piecewise-linear curve (extrapolated past the last
 *  anchor with the last segment's slope). */
function radiusForUnits(units) {
  const U = CONFIG.growth.unitAnchors, R = CONFIG.growth.radiusAnchors;
  const u = Math.max(0, units);
  for (let i = 1; i < U.length; i++) {
    if (u <= U[i]) return R[i - 1] + (R[i] - R[i - 1]) * (u - U[i - 1]) / (U[i] - U[i - 1]);
  }
  const n = U.length - 1;
  return R[n] + (R[n] - R[n - 1]) * (u - U[n]) / (U[n] - U[n - 1]);
}

/** Inverse of radiusForUnits() -- how many growth units a hole of this
 *  radius "holds", so Arena holes (whose radius also changes via
 *  hole-vs-hole eats and respawn shrinks) can keep growing along the curve. */
function unitsForRadius(radius) {
  const U = CONFIG.growth.unitAnchors, R = CONFIG.growth.radiusAnchors;
  if (radius <= R[0]) return 0;
  for (let i = 1; i < R.length; i++) {
    if (radius <= R[i]) return U[i - 1] + (U[i] - U[i - 1]) * (radius - R[i - 1]) / (R[i] - R[i - 1]);
  }
  const n = R.length - 1;
  return U[n] + (U[n] - U[n - 1]) * (radius - R[n]) / (R[n] - R[n - 1]);
}

/* ----------------------- Constants (aliases into CONFIG) ----------------------- */

// Golden Shot v9 typography (loaded from Google Fonts in index.html, both
// with Polish latin-ext glyphs; system fonts are the offline fallback).
// FONT_DISPLAY = Russo One, single weight -- headings, banners, numbers.
// Golden Shot v11 adaptive quality: the game starts at level 2 and steps
// down if the real frame time stays above ~42 fps for a couple of seconds
// mid-round (Game.monitorFrame()); the detected level is remembered per
// device in save.settings.gfxLevel. Lower DPR is the big win (fill cost is
// quadratic in it); level 0 also drops canvas shadow blur, which profiling
// (qa/) showed dominating late-round frames with huge holes.
const GFX_LEVELS = [
  { maxDpr: 1, blur: false, particles: 160 },
  { maxDpr: 1.5, blur: true, particles: 300 },
  { maxDpr: 2, blur: true, particles: 450 }
];

const FONT_DISPLAY = "'Russo One', 'Exo 2', 'Segoe UI', sans-serif";
const FONT_UI = "'Exo 2', 'Segoe UI', system-ui, sans-serif";

const WORLD_W = CONFIG.world.width;
const WORLD_H = CONFIG.world.height;
const ROUND_TIME = CONFIG.round.duration; // seconds
const GRID_SIZE = CONFIG.world.gridSize;
const NUM_BOTS = CONFIG.bots.count;

const BASE_RADIUS = CONFIG.hole.baseRadius;
const MIN_RADIUS = CONFIG.hole.minRadius;
const BASE_SPEED = CONFIG.hole.baseSpeed; // px/s

const EAT_HOLE_RATIO = CONFIG.eating.holeRatio;
const GROW_K_HOLE = CONFIG.eating.growHole;
const EAT_ANIM_TIME = CONFIG.eating.eatAnimTime;
const INVULN_TIME = CONFIG.eating.invulnTime;

/* ----------------------- App state machine ----------------------- */

const GameState = {
  BOOT: 'BOOT',
  MENU: 'MENU',
  MATCH_SETUP: 'MATCH_SETUP',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED', // reserved for Phase 2 (pause/leave-run sheet)
  RESULTS: 'RESULTS'
};

/* ----------------------- Seeded RNG abstraction ----------------------- */

/** Deterministic PRNG (mulberry32). Not yet wired into gameplay spawning —
 *  that lands with the seeded chunk generator (Phase 5). For now this backs
 *  per-run seed/ID generation so runs can be identified and, eventually,
 *  reproduced (daily challenge, bug repro). */
class SeededRNG {
  constructor(seed) {
    this.seed = seed >>> 0;
  }
  next() {
    let t = (this.seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

function generateSeed() {
  return ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
}

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Phase 8: a tiny placeholder blocklist so public display names aren't
// completely unmoderated. This is NOT production profanity moderation
// (GDD P6 explicitly calls for real moderation before names are public) —
// it exists so the guest-to-named-profile flow isn't shipped with zero
// safeguard, not as a finished solution.
const NAME_BLOCKLIST = ['fuck', 'shit', 'kurwa', 'chuj', 'nazi'];
/** Golden Shot v11: every player-controlled string (display name,
 *  challenge-link names) goes through this before touching innerHTML. */
function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** FNV-1a 32-bit -- a cheap tamper seal for saves and challenge links.
 *  Client-side only, so it stops casual edits, not a determined cheater. */
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}
const SEAL_SALT = 'vh-neon-core-v11';
function moderateName(name) {
  if (!name) return '';
  const lower = name.toLowerCase();
  if (NAME_BLOCKLIST.some(w => lower.includes(w))) return '';
  return Array.from(name).slice(0, 16).join('');
}

/* ----------------------- Analytics (provider-agnostic stub) -----------------------
   Minimum event set per the Golden Shot V2 spec. Events that depend on
   systems not yet built (ftue_step, evolution_offer/pick, overdrive_start,
   iap_intent, share_click, profile_created, account_linked,
   daily_challenge_start/end) are intentionally NOT fired yet — they will be
   added alongside the features that produce them, in later phases. */
class Analytics {
  constructor() {
    this.queue = [];
    this.maxQueue = 200;
    this.consent = () => false; // set by Game once the save is loaded
  }
  track(name, props) {
    const event = { name, props: props || {}, ts: Date.now() };
    this.queue.push(event);
    if (this.queue.length > this.maxQueue) this.queue.shift();
    if (CONFIG.flags.analyticsConsoleLog) {
      console.log('[analytics]', name, event.props);
    }
    // Golden Shot v11: events leave the device ONLY with the player's
    // analytics consent (save.privacy.analytics), and only to a sink the
    // host page/app provides -- the game itself has no backend and sends
    // nothing. Supported sinks: Google Tag Manager's window.dataLayer and a
    // native wrapper's window.VectorHoleNative.track(name, props).
    if (!this.consent()) return;
    try {
      if (Array.isArray(window.dataLayer)) window.dataLayer.push({ event: 'vh_' + name, ...event.props });
      if (window.VectorHoleNative && typeof window.VectorHoleNative.track === 'function') window.VectorHoleNative.track(name, event.props);
    } catch (e) { /* a broken sink must never break the game */ }
  }
}

/* ----------------------- Audio (Golden Shot v11) -----------------------
   Everything is synthesized with WebAudio at runtime -- no audio files, no
   dependencies, ~0 KB of assets. Two buses (sfx, music) under one master,
   both toggleable in Ustawienia (save.settings.sfx / .music). Browsers only
   allow an AudioContext to start inside a user gesture, so nothing plays
   until the first tap/key (unlock()); the page never autoplays. */

/* ---- v16 „Brzmienie”: the music bank ----
   15 synthesized tracks instead of one 4-chord loop (owner: "więcej
   muzyczek, aby się zmieniały i nie było monotonnie"). Every track is a
   few lines of data -- key, scale, tempo, drum/bass strings, sections of
   chords + a lead melody, and a form -- so a new song costs ~1 KB and no
   audio file. Sections (A groove · B hook · C bridge · D drop) keep a
   single track from looping the same 8 seconds; the scheduler adds
   fills, crashes, a riser into the drop when a round enters its final
   stretch, and a different arp/bass on every other pass of the form.

   - MENU tracks (`menu: true`) rotate on Miasto and the other screens:
     a lo-fi beat that never competes with reading.
   - Each district has its own theme (`district`), heard in its missions;
     Arena rounds rotate through every unlocked gameplay track (a new one
     each round and after each full pass), the Daily/challenge seed picks
     one track for everybody. Rozdział I themes are free from the start,
     Rozdział II themes unlock with their district (Szafa grająca in
     Profil lists them, and lets the player pin a favourite).

   Lead notation: space-separated `Note+octave[:steps]` tokens (`r` =
   rest, default 2 steps = an eighth), bars separated by `|`, each bar
   exactly 16 steps (qa/audio.mjs checks). Chords: one per bar.
   Drums/bass: 16-char step strings. Bass: R root · O octave · F fifth ·
   T third · - hold · . rest. Drums: x hit · o ghost/soft · O open hat. */
const MUSIC_TRACKS = [
  // ----- Miasto / menus -----
  { id: 'swit', name: 'Neonowy Świt', menu: true, key: 'F', scale: 'majorPent', bpm: 84, swing: 0.14, kit: 'lofi',
    pad: 'saw', lead: 'bell', arp: 'tri', bass: 'sub',
    drums: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    bassLine: 'R-----R.R-------', arpLine: '0123',
    sections: {
      A: { chords: 'Fmaj7 Em7 Dm7 Cmaj7' },
      B: { chords: 'Fmaj7 Em7 Dm7 Cmaj7', lead: 'A5:4 C6:4 E6:8 | D6:4 B5:4 G5:8 | F5:4 A5:4 C6:8 | E6:6 D6:2 C6:8' },
      C: { chords: 'Bbmaj7 Am7 Gm7 C', lead: 'D6:8 F6:8 | E6:8 C6:8 | Bb5:8 D6:8 | G5:4 C6:4 E6:8' }
    }, form: 'ABAC' },
  { id: 'nocna', name: 'Nocna Linia', menu: true, key: 'A', scale: 'minorPent', bpm: 76, kit: 'lofi',
    pad: 'saw', lead: 'bell', arp: 'sine', bass: 'sub',
    drums: { kick: 'x...............', snare: '................', hat: 'o...o...o...o...' },
    bassLine: 'R---------------', arpLine: '0213',
    sections: {
      A: { chords: 'Am9 Fmaj7 Cmaj7 G', lead: 'E6:4 r:4 C6:4 r:4 | A5:8 r:8 | G5:4 r:4 E6:4 r:4 | D6:8 B5:8' },
      B: { chords: 'Dm9 Am9 Fmaj7 E', lead: 'F6:4 r:4 E6:4 r:4 | C6:8 r:8 | A5:4 C6:4 E6:8 | G#5:8 B5:8' }
    }, form: 'AABB' },
  { id: 'deszcz', name: 'Deszcz na Szybie', menu: true, key: 'D', scale: 'minor', bpm: 80, swing: 0.16, kit: 'lofi', crackle: true,
    pad: 'organ', lead: 'tri', arp: 'tri', bass: 'sub',
    drums: { kick: 'x......x..x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    bassLine: 'R.....R...R.....', arpLine: '012',
    sections: {
      A: { chords: 'Dm7 Gm7 C7 Fmaj7' },
      B: { chords: 'Bbmaj7 Gm7 A7 Dm7', lead: 'D6:2 F6:2 A6:4 F6:2 D6:2 r:4 | Bb5:2 D6:2 F6:4 D6:2 Bb5:2 r:4 | C#6:2 E6:2 G6:4 E6:2 C#6:2 r:4 | D6:4 A5:4 F5:8' }
    }, form: 'AABA' },

  // ----- Rozdział I: district themes (free from the start) -----
  { id: 'wir', name: 'Wir Neonów', district: 'plac', key: 'A', scale: 'minorPent', bpm: 112,
    pad: 'saw', lead: 'square', arp: 'square', bass: 'saw',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.' },
    bassLine: 'R.R.R.O.R.R.R.O.', bassAlt: 'R.RR.RO.R.RR.RO.', arpLine: '012',
    sections: {
      A: { chords: 'Am F C G' },
      B: { chords: 'Am F C G', lead: 'E5:2 A5:2 C6:2 B5:2 A5:4 E5:4 | F5:2 A5:2 C6:4 A5:2 G5:2 F5:4 | G5:2 C6:2 E6:4 D6:2 C6:2 G5:4 | D6:4 B5:2 G5:2 A5:8' },
      C: { chords: 'F G Em Am', lead: 'C6:6 A5:2 F5:8 | D6:6 B5:2 G5:8 | E6:4 D6:4 B5:4 G5:4 | A5:12 r:4' },
      D: { chords: 'Am F C G', lead: 'B', lift: true }
    }, form: 'AABCBD', drop: 'D' },
  { id: 'impuls', name: 'Zielony Impuls', district: 'park', key: 'C', scale: 'majorPent', bpm: 118, kit: 'clap',
    pad: 'organ', lead: 'pluck', arp: 'tri', bass: 'square',
    drums: { kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    bassLine: 'R..R..R.R..R.OR.', arpLine: '0120',
    sections: {
      A: { chords: 'C G Am F' },
      B: { chords: 'C G Am F', lead: 'E5:2 G5:2 C6:2 G5:2 E5:2 G5:2 A5:4 | G5:2 D5:2 G5:2 B5:2 D6:4 B5:4 | C6:2 A5:2 E5:2 A5:2 C6:2 D6:2 E6:4 | D6:2 C6:2 A5:4 C6:8' },
      C: { chords: 'Dm7 G Em7 Am', lead: 'A5:4 F5:4 D5:4 F5:4 | G5:4 B5:4 D6:8 | E6:4 D6:2 B5:2 G5:8 | A5:4 C6:4 E6:8' },
      D: { chords: 'C G Am F', lead: 'B', lift: true }
    }, form: 'ABACBD', drop: 'D' },
  { id: 'fala', name: 'Fala Syntez', district: 'port', key: 'G', scale: 'minor', bpm: 104,
    pad: 'saw', lead: 'saw', arp: 'pluck', bass: 'sub',
    drums: { kick: 'x.......x.x.....', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.' },
    bassLine: 'R-----R.R-----O.', arpLine: '0122',
    sections: {
      A: { chords: 'Gm Eb Bb F' },
      B: { chords: 'Gm Eb Bb F', lead: 'D5:3 G5:3 Bb5:2 A5:4 G5:4 | G5:3 Bb5:3 Eb6:2 D6:4 Bb5:4 | F5:3 Bb5:3 D6:2 C6:4 Bb5:4 | A5:3 C6:3 F6:2 D6:8' },
      C: { chords: 'Cm Gm Eb D', lead: 'Eb6:8 D6:4 C6:4 | Bb5:8 A5:4 G5:4 | G5:4 Bb5:4 Eb6:4 F6:4 | F#5:8 A5:8' },
      D: { chords: 'Gm Eb Bb F', lead: 'B', lift: true }
    }, form: 'AABCBD', drop: 'D' },
  { id: 'glitch', name: 'Glitch w Galerii', district: 'galeria', key: 'F#', scale: 'minorPent', bpm: 124, glitch: true,
    pad: 'square', lead: 'square', arp: 'square', bass: 'saw',
    drums: { kick: 'x..x...x..x.....', snare: '....x.......x..x', hat: 'x.xxx.x.x.xxx.x.' },
    bassLine: 'R..R..O.R..R.FO.', arpLine: '0212',
    sections: {
      A: { chords: 'F#m D A E' },
      B: { chords: 'F#m D A E', lead: 'C#6:1 C#6:1 r:2 A5:2 F#5:2 C#6:2 B5:2 A5:4 | A5:1 A5:1 r:2 F#5:2 D5:2 F#5:2 A5:2 B5:4 | E6:1 E6:1 r:2 C#6:2 A5:2 E5:2 A5:2 C#6:4 | B5:4 G#5:4 E5:8' },
      C: { chords: 'Bm D F#m E', lead: 'D6:4 B5:4 F#5:8 | F#6:4 E6:4 D6:8 | C#6:4 A5:4 F#5:8 | E5:2 G#5:2 B5:2 E6:2 B5:8' },
      D: { chords: 'F#m D A E', lead: 'B', lift: true }
    }, form: 'ABACBD', drop: 'D' },
  { id: 'napiecie', name: 'Wysokie Napięcie', district: 'dachy', key: 'E', scale: 'minor', bpm: 128, arpRate: 1,
    pad: 'saw', lead: 'saw', arp: 'square', bass: 'saw',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..O...O...O...O.' },
    bassLine: 'RRO.RRO.RRO.RROR', arpLine: '0122',
    sections: {
      A: { chords: 'Em C G D' },
      B: { chords: 'Em C G D', lead: 'B5:2 E6:2 G6:2 E6:2 B5:2 G5:2 E5:4 | C6:2 E6:2 G6:2 E6:2 C6:2 G5:2 E5:4 | D6:2 G6:2 B6:2 G6:2 D6:2 B5:2 G5:4 | F#6:4 E6:4 D6:4 A5:4' },
      C: { chords: 'Am Em C B', lead: 'A5:8 C6:8 | B5:8 G5:8 | E6:8 G6:8 | F#6:8 D#6:8' },
      D: { chords: 'Em C G D', lead: 'B', lift: true }
    }, form: 'AABCBD', drop: 'D' },
  { id: 'rdzen', name: 'Rdzeń Miasta', district: 'rdzen', key: 'C', scale: 'minor', bpm: 120,
    pad: 'saw', lead: 'saw', arp: 'square', bass: 'saw',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x.xx', hat: 'x.x.x.x.x.x.x.x.' },
    bassLine: 'R.RRR.RRR.RRR.OF', arpLine: '0120',
    sections: {
      A: { chords: 'Cm Ab Eb Bb' },
      B: { chords: 'Cm Ab Eb Bb', lead: 'G5:4 C6:4 Eb6:6 D6:2 | C6:4 Ab5:4 Eb5:4 C6:4 | Bb5:4 G5:4 Eb6:6 F6:2 | D6:8 Bb5:4 F5:4' },
      C: { chords: 'Fm Cm Ab G', lead: 'Ab5:6 G5:2 F5:8 | G5:6 F5:2 Eb5:8 | C6:4 Eb6:4 Ab6:8 | G6:4 F6:4 D6:4 B5:4' },
      D: { chords: 'Cm Ab Eb Bb', lead: 'B', lift: true }
    }, form: 'ABCBAD', drop: 'D' },

  // ----- Rozdział II: unlocked with their districts -----
  { id: 'tunele', name: 'Tunele Metra', district: 'metro', key: 'D', scale: 'minor', bpm: 126,
    pad: 'saw', lead: 'saw', arp: 'pluck', bass: 'saw',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.' },
    bassLine: 'RORORORORORORORO', arpLine: '012',
    sections: {
      A: { chords: 'Dm Bb C Am' },
      B: { chords: 'Dm Bb C Am', lead: 'A5:6 F5:2 D5:4 F5:4 | D6:6 Bb5:2 F5:4 Bb5:4 | E6:6 C6:2 G5:4 C6:4 | C6:4 A5:4 E5:4 A5:4' },
      C: { chords: 'Gm Dm Bb A', lead: 'Bb5:8 D6:8 | A5:8 F5:8 | D6:4 F6:4 D6:4 Bb5:4 | C#6:8 E6:8' },
      D: { chords: 'Dm Bb C Am', lead: 'B', lift: true }
    }, form: 'AABCBD', drop: 'D' },
  { id: 'bazar', name: 'Nocny Bazar', district: 'bazar', key: 'A', scale: 'hijaz', bpm: 104, swing: 0.1,
    pad: 'organ', lead: 'pluck', arp: 'tri', bass: 'sub',
    drums: { kick: 'x..x..x...x.....', snare: '....x..x....x...', hat: 'x.xx.xx.x.xx.xx.' },
    bassLine: 'R..R..R.R...F...', arpLine: '0102',
    sections: {
      A: { chords: 'A Bb Gm A' },
      B: { chords: 'A Bb Gm A', lead: 'E5:2 F5:2 E5:2 D5:2 C#5:4 A4:4 | D5:2 F5:2 Bb5:4 A5:2 G5:2 F5:4 | G5:2 Bb5:2 D6:4 Bb5:2 A5:2 G5:4 | F5:2 E5:2 C#5:2 Bb4:2 A4:8' },
      C: { chords: 'Dm C Bb A', lead: 'F5:4 A5:4 D6:8 | E5:4 G5:4 C6:8 | D6:4 Bb5:4 F5:8 | E5:2 F5:2 E5:2 C#5:2 A4:8' },
      D: { chords: 'A Bb Gm A', lead: 'B', lift: true }
    }, form: 'ABACBD', drop: 'D' },
  { id: 'piksele', name: 'Fabryka Pikseli', district: 'fabryka', key: 'B', scale: 'minor', bpm: 132, kit: 'chip', arpRate: 1,
    pad: 'square', lead: 'square', arp: 'square', bass: 'square',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    bassLine: 'R.O.R.O.R.O.F.O.', arpLine: '012',
    sections: {
      A: { chords: 'Bm G D A' },
      B: { chords: 'Bm G D A', lead: 'F#5:2 B5:2 D6:2 F#6:2 E6:2 D6:2 B5:4 | G5:2 B5:2 D6:2 G6:2 F#6:2 D6:2 B5:4 | A5:2 D6:2 F#6:2 A6:2 F#6:2 D6:2 A5:4 | C#6:2 E6:2 A6:4 E6:2 C#6:2 A5:4' },
      C: { chords: 'Em Bm G F#', lead: 'E6:4 G6:4 B6:8 | F#6:4 D6:4 B5:8 | B5:4 D6:4 G6:8 | A#5:4 C#6:4 F#6:8' },
      D: { chords: 'Bm G D A', lead: 'B', lift: true }
    }, form: 'AABCBD', drop: 'D' },
  { id: 'hologramy', name: 'Zatoka Hologramów', district: 'zatoka', key: 'Eb', scale: 'majorPent', bpm: 98, swing: 0.12,
    pad: 'saw', lead: 'bell', arp: 'tri', bass: 'sub',
    drums: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    bassLine: 'R...R.F.R...O...', arpLine: '0213',
    sections: {
      A: { chords: 'Ebmaj7 Cm7 Abmaj7 Bb' },
      B: { chords: 'Ebmaj7 Cm7 Abmaj7 Bb', lead: 'G5:4 Bb5:4 D6:4 Bb5:4 | C6:4 Eb6:4 G5:8 | C6:4 Eb6:4 G6:4 Eb6:4 | F6:8 D6:8' },
      C: { chords: 'Fm7 Gm7 Abmaj7 Bb', lead: 'Ab5:8 C6:8 | Bb5:8 D6:8 | Eb6:8 C6:8 | D6:4 F6:4 Bb6:8' },
      D: { chords: 'Ebmaj7 Cm7 Abmaj7 Bb', lead: 'B', lift: true }
    }, form: 'AABCBD', drop: 'D' },
  { id: 'ogrody', name: 'Wiszące Ogrody', district: 'ogrody', key: 'D', scale: 'dorian', bpm: 112,
    pad: 'organ', lead: 'saw', arp: 'pluck', bass: 'pluck',
    drums: { kick: 'x.....x...x.....', snare: '....x..o....x...', hat: 'x.xxx.xxx.xxx.xx' },
    bassLine: 'R..O.RR.R..O.FR.', arpLine: '0120',
    sections: {
      A: { chords: 'Dm7 G Dm7 G' },
      B: { chords: 'Dm7 G Dm7 G', lead: 'A5:2 C6:2 D6:2 r:2 F6:2 D6:2 C6:4 | B5:2 D6:2 G6:4 F6:2 D6:2 B5:4 | A5:2 C6:2 D6:2 r:2 E6:2 F6:2 A6:4 | G6:4 F6:2 E6:2 D6:8' },
      C: { chords: 'Fmaj7 C Bb A', lead: 'A5:4 C6:4 E6:8 | G5:4 C6:4 E6:8 | F6:4 D6:4 Bb5:8 | C#6:4 E6:4 A6:8' },
      D: { chords: 'Dm7 G Dm7 G', lead: 'B', lift: true }
    }, form: 'ABACBD', drop: 'D' },
  { id: 'chmura', name: 'Chmura Danych', district: 'chmura', key: 'Bb', scale: 'minor', bpm: 124, kit: 'clap', arpRate: 1,
    pad: 'saw', lead: 'saw', arp: 'pluck', bass: 'saw',
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..O...O...O...O.' },
    bassLine: '.RRR.RRR.RRR.RRR', arpLine: '0122',
    sections: {
      A: { chords: 'Bbm Gb Db Ab' },
      B: { chords: 'Bbm Gb Db Ab', lead: 'F5:4 Bb5:4 Db6:4 C6:4 | Bb5:4 Db6:4 Gb6:4 F6:4 | Ab5:4 Db6:4 F6:4 Eb6:4 | C6:8 Eb6:4 Ab5:4' },
      C: { chords: 'Ebm Bbm Gb F', lead: 'Gb6:8 F6:4 Eb6:4 | Db6:8 C6:4 Bb5:4 | Bb5:4 Db6:4 Gb6:8 | A5:4 C6:4 F6:8' },
      D: { chords: 'Bbm Gb Db Ab', lead: 'B', lift: true }
    }, form: 'AABCBD', drop: 'D' }
];
const MUSIC_TRACK_BY_ID = Object.fromEntries(MUSIC_TRACKS.map(t => [t.id, t]));
const MENU_TRACK_IDS = MUSIC_TRACKS.filter(t => t.menu).map(t => t.id);
const GAMEPLAY_TRACK_IDS = MUSIC_TRACKS.filter(t => !t.menu).map(t => t.id);
const DISTRICT_THEME = Object.fromEntries(MUSIC_TRACKS.filter(t => t.district).map(t => [t.district, t.id]));
/** Rozdział I themes are free; the rest unlock with their district. */
const FREE_TRACK_DISTRICTS = ['plac', 'park', 'port', 'galeria', 'dachy', 'rdzen'];

const NOTE_SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const notePc = name => (NOTE_SEMI[name[0]] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0) + 12) % 12;
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
const CHORD_SHAPES = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus2: [0, 2, 7], sus4: [0, 5, 7], m9: [0, 3, 7, 10, 14], dim: [0, 3, 6] };
const MUSIC_SCALES = { minorPent: [0, 3, 5, 7, 10], majorPent: [0, 2, 4, 7, 9], minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], hijaz: [0, 1, 4, 5, 7, 8, 10] };

/** "Am7" -> { pad: [midi…] around E3–E4, bass: root in E2–D#3 }. */
function parseChord(sym) {
  const m = /^([A-G][#b]?)(.*)$/.exec(sym);
  const shape = m && CHORD_SHAPES[m[2]];
  if (!shape) throw new Error(`music: unknown chord ${sym}`);
  const root = 52 + ((notePc(m[1]) - 4 + 12) % 12);
  return { sym, pad: shape.map(i => root + i), bass: root - 12 };
}

/** Lead string -> per-step array of { midi, steps } (null = nothing new). */
function parseLead(str) {
  const bars = str.split('|').map(b => b.trim());
  const out = [];
  for (const bar of bars) {
    let n = 0;
    for (const tok of bar.split(/\s+/)) {
      const m = /^(r|([A-G][#b]?)(\d))(?::(\d+))?$/.exec(tok);
      if (!m) throw new Error(`music: bad lead token ${tok}`);
      const steps = m[4] ? +m[4] : 2;
      out.push(m[1] === 'r' ? null : { midi: 12 * (+m[3] + 1) + notePc(m[2]), steps });
      for (let i = 1; i < steps; i++) out.push(null);
      n += steps;
    }
    if (n !== 16) throw new Error(`music: lead bar has ${n} steps (needs 16): ${bar}`);
  }
  return out;
}

const COMPILED_SONGS = {};
function compileSong(id) {
  if (COMPILED_SONGS[id]) return COMPILED_SONGS[id];
  const t = MUSIC_TRACK_BY_ID[id];
  if (!t) return null;
  const sections = {};
  for (const [k, s] of Object.entries(t.sections)) sections[k] = { id: k, lift: !!s.lift, chords: s.chords.split(/\s+/).map(parseChord) };
  for (const [k, s] of Object.entries(t.sections)) {
    const src = s.lead && s.lead.length === 1 ? t.sections[s.lead].lead : s.lead;
    sections[k].lead = src ? parseLead(src) : null;
    sections[k].bars = sections[k].chords.length;
  }
  const keyPc = notePc(t.key);
  let tonic = 57 + ((keyPc - 9 + 12) % 12);
  if (tonic > 62) tonic -= 12;
  const scale = MUSIC_SCALES[t.scale];
  const ladder = [];
  for (let i = 0; ladder.length < 14; i++) ladder.push(midiHz(tonic + scale[i % scale.length] + 12 * Math.floor(i / scale.length)));
  const song = COMPILED_SONGS[id] = {
    ...t, sections, form: t.form.split(''), ladder,
    // Stingers (fanfare, tier-up…) were written in A; shift them into the
    // track's key (-6…+5 semitones) so they never clash with the music.
    keyRatio: Math.pow(2, (((keyPc - 9 + 18) % 12) - 6) / 12),
    arpRate: t.arpRate || 2,
    hats16: t.drums.hat.replace(/\./g, 'o')
  };
  return song;
}

// Fallback ladder before any song is loaded (A minor pentatonic).
const EAT_SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];

class SoundEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.intensity = 0;       // 0 menu · 1 round · 2 final stretch · 3 SZAŁ/frenzy
    this.lastEatAt = 0;
    this.musicTimer = null;
    this.nextNoteTime = 0;
    this.ducked = false;
    this.noiseBuffer = null;
    // v16 music state: the loaded song, where we are in its form, and
    // the scene that picks the next one.
    this.song = null;
    this.formIdx = 0; this.barInSection = 0; this.stepInBar = 0; this.barCount = 0; this.loopCount = 0;
    this.queued = null;
    this.dropArmed = false; this.dropRiserBar = -1; this.crashNext = false;
    this.scene = 'menu'; this.sceneOpts = {};
    this.playOrder = {};      // per-playlist rotation cursor
    this.recent = [];         // last few gameplay tracks (no quick repeats)
    this.library = { isUnlocked: () => true };
    this.onTrackChange = null;
    this.trace = null;        // QA: an array to log scheduled notes into
    this.loadSong({ id: MENU_TRACK_IDS[0] });
  }

  get supported() { return !!(window.AudioContext || window.webkitAudioContext); }

  /** Call from any user gesture; idempotent. v13.2 (iPhone): also
   *  (1) asks iOS for the "playback" audio session, so the ring/silent
   *  switch no longer mutes the game (Web Audio defaults to "ambient");
   *  (2) resumes from ANY non-running state -- WebKit parks the context in
   *  "interrupted" after a notification, app switch or screen lock, and the
   *  old code only resumed "suspended", so sound died until a reload;
   *  (3) rebuilds the context when a resume inside a gesture didn't take;
   *  (4) plays a one-sample silent buffer inside the gesture, which is what
   *  actually starts output on WebKit. */
  unlock() {
    if (!this.supported || this.hold) return;
    try {
      try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) { /* older iOS */ }
      this.unmuteIOS();
      if (this.ctx && this.ctx.state !== 'running' && this.resumeFailedAt && performance.now() - this.resumeFailedAt > 1200) this.rebuild();
      if (!this.ctx) this.build();
      if (this.ctx.state !== 'running') {
        const ctx = this.ctx;
        const pr = ctx.resume();
        this.prime();
        const failed = () => { if (this.ctx === ctx && ctx.state !== 'running' && !this.resumeFailedAt) this.resumeFailedAt = performance.now(); };
        if (pr && pr.then) pr.then(() => { if (ctx.state === 'running') this.resumeFailedAt = 0; else failed(); }, failed);
        setTimeout(failed, 500);
      }
      if (this.settings.music !== false) this.startMusic();
    } catch (e) { this.ctx = null; }
  }

  /** v13.3: WebKit (Safari, home-screen apps AND Chrome/Firefox on iOS,
   *  which are WKWebView) plays Web Audio in the "ambient" category, which
   *  the ring/silent switch mutes -- the context reports "running" while
   *  nothing comes out. navigator.audioSession is missing in WKWebView and
   *  older iOS, so the proven fallback: a silent, looping <audio> element
   *  started inside a gesture moves the whole page to media playback, and
   *  Web Audio becomes audible. iOS only; paused while the page is hidden. */
  unmuteIOS() {
    if (!SoundEngine.isIOS()) return;
    if (!this.unmuteEl) {
      // 0.5 s of 8-bit 8 kHz silence as a WAV built in memory (no extra file).
      const n = 4000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
      const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
      str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true);
      v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true);
      v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
      for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
      const el = document.createElement('audio');
      el.setAttribute('x-webkit-airplay', 'deny');
      el.setAttribute('playsinline', '');
      el.preload = 'auto';
      el.loop = true;
      el.src = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
      this.unmuteEl = el;
    }
    if (this.unmuteEl.paused) { const pr = this.unmuteEl.play(); if (pr && pr.catch) pr.catch(() => {}); }
  }

  static isIOS() {
    const ua = navigator.userAgent || '';
    return /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  /** Profile diagnostics: one line a player can read back to us. */
  statusText() {
    if (!this.supported) return 'Ta przeglądarka nie obsługuje dźwięku.';
    if (!this.ctx) return 'Dźwięk czeka na pierwsze dotknięcie ekranu.';
    const st = { running: 'działa', suspended: 'wstrzymany', interrupted: 'przerwany przez system', closed: 'zamknięty' }[this.ctx.state] || this.ctx.state;
    const parts = [`Silnik: ${st}`, `${Math.round(this.ctx.sampleRate / 100) / 10} kHz`];
    if (SoundEngine.isIOS()) parts.push(`tryb iOS: ${navigator.audioSession ? navigator.audioSession.type : (this.unmuteEl && !this.unmuteEl.paused ? 'odtwarzanie' : 'otoczenie')}`);
    if (this.settings.sfx === false) parts.push('efekty wyłączone');
    if (this.settings.music === false) parts.push('muzyka wyłączona');
    else if (this.song) parts.push(`gra: ${this.song.name}`);
    return parts.join(' · ');
  }

  /** A short, clearly audible chime for the profile's sound test. */
  testChime() {
    if (!this.ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone({ type: 'triangle', freq: f, dur: 0.35, vol: 0.35, when: i * 0.11, bus: this.master }));
  }

  build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.buildGraph(new AC({ latencyHint: 'interactive' }));
    // Back to running (e.g. after an iOS interruption): restart the music clock.
    this.ctx.onstatechange = () => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      this.resumeFailedAt = 0;
      this.nextNoteTime = this.ctx.currentTime + 0.08;
      if (this.settings.music !== false) this.startMusic();
    };
  }

  /** The whole mixer on any context (a live AudioContext, or an
   *  OfflineAudioContext in qa/audio.mjs). v16 music chain:
   *  drums/bass → musicIn; pads → padBus (ducked by every kick, the
   *  "sidechain pump") and leads/arps → wetBus, both also feed fxSend →
   *  dotted-eighth echo + a short synthesized room → musicIn → musicFilter
   *  (closes to a muffled "underwater" mix on the pause sheet) → musicBus. */
  buildGraph(ctx) {
    this.ctx = ctx;
    this.resumeFailedAt = 0;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    // Gentle limiter so stacked eats never clip on phone speakers.
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 6;
    this.comp.attack.value = 0.003; this.comp.release.value = 0.2;
    this.master.connect(this.comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 18000; this.musicFilter.Q.value = 0.7;
    this.musicFilter.connect(this.musicBus);
    this.musicIn = ctx.createGain();
    this.musicIn.connect(this.musicFilter);
    this.padBus = ctx.createGain();
    this.wetBus = ctx.createGain();
    this.fxSend = ctx.createGain(); this.fxSend.gain.value = 0.32;
    this.padBus.connect(this.musicIn); this.padBus.connect(this.fxSend);
    this.wetBus.connect(this.musicIn); this.wetBus.connect(this.fxSend);
    const fxReturn = ctx.createGain(); fxReturn.gain.value = 0.55;
    fxReturn.connect(this.musicIn);
    this.delay = ctx.createDelay(1.5);
    const fb = ctx.createGain(); fb.gain.value = 0.3;
    const fbTone = ctx.createBiquadFilter(); fbTone.type = 'lowpass'; fbTone.frequency.value = 2600;
    this.fxSend.connect(this.delay); this.delay.connect(fbTone).connect(fb).connect(this.delay);
    fbTone.connect(fxReturn);
    // 1.1 s of decaying stereo noise = a small neon-alley room, built once.
    const sr = ctx.sampleRate, irLen = Math.floor(sr * 1.1);
    const ir = ctx.createBuffer(2, irLen, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.2);
    }
    const verb = ctx.createConvolver();
    verb.buffer = ir;
    this.fxSend.connect(verb).connect(fxReturn);
    this.applySettings();
    const len = sr;
    this.noiseBuffer = ctx.createBuffer(1, len, len);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.applySongFx();
  }

  /** Drops a context WebKit won't resume and starts a fresh one. */
  rebuild() {
    this.stopMusic();
    const old = this.ctx;
    this.ctx = null;
    try { old.onstatechange = null; old.close(); } catch (e) { /* already closed */ }
  }

  prime() {
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.ctx.createBuffer(1, 1, 22050);
      src.connect(this.ctx.destination);
      src.start(0);
    } catch (e) { /* not critical */ }
  }

  applySettings() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.settings.sfx === false ? 0 : 0.8, t, 0.02);
    this.musicBus.gain.setTargetAtTime(this.settings.music === false ? 0 : (this.ducked ? 0.2 : 0.34), t, 0.15);
    this.musicFilter.frequency.setTargetAtTime(this.ducked ? 650 : 18000, t, 0.12);
    if (this.settings.music === false) this.stopMusic(); else if (this.ctx.state === 'running') this.startMusic();
  }

  /** Pause sheet: the music drops "underwater" (low-passed and quieter)
   *  instead of just getting quieter -- the round is clearly on hold. */
  setDucked(on) { if (this.ducked === on) return; this.ducked = on; this.applySettings(); }
  /** `hold` = suspended on purpose (ad playing, page hidden) -- gestures
   *  must not wake the audio until resume() releases it. */
  suspend() {
    this.hold = true;
    if (this.unmuteEl && !this.unmuteEl.paused) this.unmuteEl.pause();
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }
  resume() {
    this.hold = false;
    if (this.unmuteEl && this.unmuteEl.paused) { const pe = this.unmuteEl.play(); if (pe && pe.catch) pe.catch(() => {}); }
    // Any non-running state ("suspended" or iOS "interrupted"). Outside a
    // gesture iOS may refuse -- the next tap retries via unlock().
    if (this.ctx && this.ctx.state !== 'running') { const pr = this.ctx.resume(); if (pr && pr.catch) pr.catch(() => {}); }
  }

  get live() { return this.ctx && this.ctx.state === 'running'; }
  sfxOn() { return this.live && this.settings.sfx !== false; }

  /* ---- primitives ---- */
  tone({ type = 'sine', freq = 440, freqEnd = null, dur = 0.15, vol = 0.3, attack = 0.005, when = 0, bus = null, filter = null, filterEnd = null, q = 4, detune = 0 }) {
    const c = this.ctx, t = Math.max(0, c.currentTime + when);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (filter) {
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(filter, t); f.Q.value = q;
      if (filterEnd) f.frequency.exponentialRampToValueAtTime(filterEnd, t + dur);
      o.connect(f); node = f;
    }
    node.connect(g).connect(bus || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
    if (this.trace) this.trace.push(freq);
  }

  noise({ dur = 0.2, vol = 0.2, freq = 2000, freqEnd = null, q = 1, type = 'bandpass', when = 0, bus = null, attack = 0 }) {
    const c = this.ctx, t = Math.max(0, c.currentTime + when);
    const s = c.createBufferSource(); s.buffer = this.noiseBuffer; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain();
    if (attack) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    else { g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    s.connect(f).connect(g).connect(bus || this.sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  /** Stingers are authored in A minor/C major; this shifts them into the
   *  current track's key so a fanfare never fights the music under it. */
  inKey(f) { return f * (this.song ? this.song.keyRatio : 1); }

  /* ---- game events ---- */
  /** size: eaten radius in px; combo: current chain length. Rate-limited so a
   *  magnet vacuuming 10 fragments reads as one rising flurry, not mush.
   *  v16: the combo climbs the current track's own scale, so eating plays
   *  along with the music instead of in a fixed A minor. */
  eat(size, combo) {
    if (!this.sfxOn()) return;
    const now = this.ctx.currentTime;
    if (now - this.lastEatAt < 0.045) return;
    this.lastEatAt = now;
    const ladder = this.song ? this.song.ladder : EAT_SCALE;
    const idx = Math.min(ladder.length - 1, Math.max(0, (combo || 1) - 1));
    const f = ladder[idx] * (size > 40 ? 0.5 : 1);
    this.tone({ type: 'triangle', freq: f * 1.5, freqEnd: f * 2, dur: 0.09, vol: 0.22 });
    this.tone({ type: 'sine', freq: f, dur: 0.12, vol: 0.18, when: 0.01 });
    if (size > 30) {
      // Big objects: a sub "gulp" under the blip.
      this.tone({ type: 'sine', freq: 140, freqEnd: 45, dur: 0.28, vol: 0.45 });
      this.noise({ dur: 0.22, vol: 0.12, freq: 900, freqEnd: 120, type: 'lowpass' });
    }
  }

  rivalEaten() {
    if (!this.sfxOn()) return;
    this.tone({ type: 'sine', freq: 180, freqEnd: 40, dur: 0.45, vol: 0.55 });
    [329.63, 440, 659.25].forEach((f, i) => this.tone({ type: 'sawtooth', freq: this.inKey(f), dur: 0.35, vol: 0.09, when: 0.02 * i, filter: 2400 }));
    this.noise({ dur: 0.35, vol: 0.18, freq: 3000, freqEnd: 200, type: 'lowpass' });
  }

  hurt() {
    if (!this.sfxOn()) return;
    this.tone({ type: 'sawtooth', freq: 300, freqEnd: 60, dur: 0.5, vol: 0.22, filter: 1400 });
    this.noise({ dur: 0.3, vol: 0.15, freq: 600, freqEnd: 100, type: 'lowpass' });
  }

  tierUp() {
    if (!this.sfxOn()) return;
    [440, 554.37, 659.25, 880].forEach((f, i) => this.tone({ type: 'square', freq: this.inKey(f), dur: 0.16, vol: 0.08, when: i * 0.06, filter: 3500 }));
    this.noise({ dur: 0.5, vol: 0.08, freq: 400, freqEnd: 6000, type: 'bandpass', q: 2 });
    this.tone({ type: 'sine', freq: 110, freqEnd: 55, dur: 0.35, vol: 0.3, when: 0.24 });
  }

  golden() {
    if (!this.sfxOn()) return;
    [1046.5, 1318.5, 1567.98, 2093].forEach((f, i) => this.tone({ type: 'sine', freq: this.inKey(f), dur: 0.4, vol: 0.09, when: i * 0.05 }));
  }

  frenzy() {
    if (!this.sfxOn()) return;
    this.noise({ dur: 0.7, vol: 0.16, freq: 300, freqEnd: 8000, type: 'bandpass', q: 3 });
    [220, 330, 440, 660, 880].forEach((f, i) => this.tone({ type: 'sawtooth', freq: this.inKey(f), dur: 0.25, vol: 0.07, when: i * 0.05, filter: 3000 }));
  }

  tick(urgent) {
    if (!this.sfxOn()) return;
    this.tone({ type: 'square', freq: urgent ? 1320 : 880, dur: 0.06, vol: 0.09, filter: 4000 });
  }

  whoosh() {
    if (!this.sfxOn()) return;
    this.noise({ dur: 0.35, vol: 0.12, freq: 500, freqEnd: 3500, type: 'bandpass', q: 1.5 });
  }

  ui() {
    if (!this.sfxOn()) return;
    this.tone({ type: 'triangle', freq: 1250, freqEnd: 900, dur: 0.05, vol: 0.07 });
  }

  /** v14: NELA's "incoming transmission" -- a soft rising digital chirp
   *  under her speech bubbles, so her lines get noticed. */
  nela() {
    if (!this.sfxOn()) return;
    this.tone({ type: 'sine', freq: 660, freqEnd: 990, dur: 0.09, vol: 0.06 });
    this.tone({ type: 'sine', freq: 1320, freqEnd: 1480, dur: 0.12, vol: 0.05, when: 0.09 });
    this.noise({ dur: 0.08, vol: 0.02, freq: 4000, type: 'highpass', when: 0.02 });
  }

  coin() {
    if (!this.sfxOn()) return;
    this.tone({ type: 'square', freq: 987.77, dur: 0.07, vol: 0.07, filter: 5000 });
    this.tone({ type: 'square', freq: 1318.5, dur: 0.2, vol: 0.07, when: 0.07, filter: 5000 });
  }

  fanfare(big) {
    if (!this.sfxOn()) return;
    const seq = big ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => {
      this.tone({ type: 'square', freq: this.inKey(f), dur: 0.22, vol: 0.07, when: i * 0.09, filter: 4200 });
      this.tone({ type: 'triangle', freq: this.inKey(f) / 2, dur: 0.25, vol: 0.08, when: i * 0.09 });
    });
    this.noise({ dur: 0.9, vol: 0.05, freq: 7000, type: 'highpass', when: seq.length * 0.09 });
    if (big) this.tone({ type: 'sine', freq: this.inKey(130.81), freqEnd: this.inKey(65.41), dur: 0.6, vol: 0.3, when: seq.length * 0.09 });
  }

  /** v15: one rising chime per star on the mission result. */
  star(i) {
    if (!this.sfxOn()) return;
    const f = this.inKey([1046.5, 1318.5, 1567.98][i] || 1046.5);
    this.tone({ type: 'triangle', freq: f, dur: 0.28, vol: 0.1 });
    this.tone({ type: 'sine', freq: f * 2, dur: 0.18, vol: 0.04, when: 0.04 });
    this.noise({ dur: 0.25, vol: 0.03, freq: 8000, type: 'highpass', when: 0.02 });
  }

  /** v15: the energy refill / mission start "power up". */
  energy() {
    if (!this.sfxOn()) return;
    this.tone({ type: 'sawtooth', freq: 220, freqEnd: 880, dur: 0.25, vol: 0.05, filter: 2400 });
    this.tone({ type: 'sine', freq: 880, freqEnd: 1320, dur: 0.18, vol: 0.06, when: 0.18 });
  }

  fail() {
    if (!this.sfxOn()) return;
    [392, 349.23, 311.13, 261.63].forEach((f, i) => this.tone({ type: 'triangle', freq: f, dur: 0.3, vol: 0.12, when: i * 0.14 }));
  }

  /* ---- v16 event sounds: every moment that changes the race gets its
     own short, readable cue (all in the track's key where pitched). ---- */
  /** Rolling into something still too big: a dull "bonk". */
  bump() {
    if (!this.sfxOn()) return;
    this.tone({ type: 'sine', freq: 170, freqEnd: 70, dur: 0.14, vol: 0.28 });
    this.tone({ type: 'square', freq: 95, dur: 0.07, vol: 0.05, filter: 500 });
  }

  /** Taking 1st place: a bright two-step up. */
  leadTaken() {
    if (!this.sfxOn()) return;
    [659.25, 987.77, 1318.5].forEach((f, i) => this.tone({ type: 'triangle', freq: this.inKey(f), dur: 0.22, vol: 0.11, when: i * 0.07 }));
    this.noise({ dur: 0.4, vol: 0.04, freq: 9000, type: 'highpass', when: 0.12 });
  }

  /** Losing 1st place: a short falling minor step. */
  leadLost() {
    if (!this.sfxOn()) return;
    this.tone({ type: 'triangle', freq: this.inKey(493.88), dur: 0.18, vol: 0.12 });
    this.tone({ type: 'triangle', freq: this.inKey(392), dur: 0.3, vol: 0.12, when: 0.13 });
    this.tone({ type: 'sawtooth', freq: this.inKey(98), dur: 0.35, vol: 0.06, when: 0.13, filter: 600 });
  }

  /** A shield soaking a hit: a metallic clang. */
  shield() {
    if (!this.sfxOn()) return;
    [1760, 2637, 3520].forEach((f, i) => this.tone({ type: 'sine', freq: f, dur: 0.35 - i * 0.08, vol: 0.07 }));
    this.noise({ dur: 0.18, vol: 0.08, freq: 5000, type: 'highpass' });
  }

  /** Portal warp: an up-down sweep. */
  portal() {
    if (!this.sfxOn()) return;
    this.tone({ type: 'sine', freq: 300, freqEnd: 1800, dur: 0.22, vol: 0.12 });
    this.tone({ type: 'sine', freq: 1800, freqEnd: 400, dur: 0.25, vol: 0.08, when: 0.2 });
    this.noise({ dur: 0.45, vol: 0.06, freq: 600, freqEnd: 6000, type: 'bandpass', q: 3 });
  }

  /** WIELKI FINISZ: a riser into a sub drop and a chord stab. */
  overdrive() {
    if (!this.sfxOn()) return;
    this.noise({ dur: 0.6, vol: 0.14, freq: 300, freqEnd: 7000, type: 'bandpass', q: 2.5, attack: 0.45 });
    this.tone({ type: 'sine', freq: 120, freqEnd: 38, dur: 0.7, vol: 0.5, when: 0.55 });
    [220, 261.63, 329.63, 440].forEach(f => this.tone({ type: 'sawtooth', freq: this.inKey(f), dur: 0.5, vol: 0.06, when: 0.55, filter: 2600 }));
  }

  /** Evolution cards dealt: a sparkle up the track's scale. */
  cards() {
    if (!this.sfxOn()) return;
    const l = this.song ? this.song.ladder : EAT_SCALE;
    [5, 7, 9, 11].forEach((n, i) => this.tone({ type: 'sine', freq: l[n] * 2, dur: 0.25, vol: 0.06, when: i * 0.05 }));
  }

  /** A picked card / confirmed choice. */
  pick() {
    if (!this.sfxOn()) return;
    this.tone({ type: 'square', freq: this.inKey(659.25), dur: 0.08, vol: 0.06, filter: 3000 });
    this.tone({ type: 'square', freq: this.inKey(987.77), dur: 0.22, vol: 0.06, when: 0.07, filter: 3000 });
    this.tone({ type: 'sine', freq: 110, freqEnd: 55, dur: 0.25, vol: 0.25, when: 0.07 });
  }

  /** A bigger rival entering the danger halo: a low double heartbeat. */
  danger() {
    if (!this.sfxOn()) return;
    this.tone({ type: 'sine', freq: 80, freqEnd: 50, dur: 0.14, vol: 0.4 });
    this.tone({ type: 'sine', freq: 75, freqEnd: 45, dur: 0.16, vol: 0.32, when: 0.17 });
  }

  /** Round / mission start: kick + a stab on the downbeat. */
  go() {
    if (!this.sfxOn()) return;
    this.tone({ type: 'sine', freq: 150, freqEnd: 40, dur: 0.3, vol: 0.5 });
    [440, 659.25, 880].forEach(f => this.tone({ type: 'square', freq: this.inKey(f), dur: 0.25, vol: 0.05, filter: 3200 }));
    this.noise({ dur: 0.5, vol: 0.06, freq: 8000, type: 'highpass' });
  }

  /* ---- v16 music: scenes pick a track, a sequencer plays its form ---- */
  /** Layer level: 0 menu/result outro · 1 round · 2 final stretch · 3 SZAŁ.
   *  Rising into 2+ arms the drop: one bar of riser + snare roll, then the
   *  track jumps to its `drop` section. */
  setIntensity(level) {
    if (level === this.intensity) return;
    const prev = this.intensity;
    this.intensity = level;
    if (level >= 2 && prev < 2) this.armDrop();
    if (level >= 3 && prev < 3) this.crashNext = true;
  }

  /** What is playing: 'menu' (rotates the lo-fi menu tracks), 'arena'
   *  ({ seed, daily }) or 'campaign' ({ district, boss }). Results keep
   *  the round's track (setIntensity(0) turns it into a calm outro). */
  setScene(kind, opts = {}) {
    this.scene = kind; this.sceneOpts = opts;
    const pick = this.settings.musicPick;
    const pinned = pick && pick !== 'auto' && MUSIC_TRACK_BY_ID[pick] && this.library.isUnlocked(pick) ? pick : null;
    if (kind === 'menu') {
      if (this.song && this.song.menu && !this.queued) return;
      this.playTrack(this.nextFrom('menu', MENU_TRACK_IDS));
    } else if (kind === 'arena') {
      if (pinned) this.playTrack(pinned, { restart: true });
      else if (opts.seed != null && (opts.daily || opts.challenge)) {
        // Same seed, same track for everybody (Rozdział I themes only).
        const free = GAMEPLAY_TRACK_IDS.filter(id => FREE_TRACK_DISTRICTS.includes(MUSIC_TRACK_BY_ID[id].district));
        this.playTrack(free[Math.abs(Math.floor(opts.seed)) % free.length], { restart: true });
      } else this.playTrack(this.nextGameplayTrack(), { restart: true });
    } else if (kind === 'campaign') {
      this.playTrack(pinned || DISTRICT_THEME[opts.district] || 'wir', { restart: true, drop: !!opts.boss });
    }
  }

  unlockedGameplayTracks() { return GAMEPLAY_TRACK_IDS.filter(id => this.library.isUnlocked(id)); }

  /** Arena rotation: shuffled once per session, never one of the last
   *  two tracks again (so 5 rounds = at least 3 different songs). */
  nextGameplayTrack() {
    const list = this.unlockedGameplayTracks();
    if (!this.shuffled || this.shuffled.length !== list.length || this.shuffled.some(id => !list.includes(id))) {
      this.shuffled = list.slice();
      for (let i = this.shuffled.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.shuffled[i], this.shuffled[j]] = [this.shuffled[j], this.shuffled[i]]; }
    }
    return this.nextFrom('gameplay', this.shuffled);
  }

  nextFrom(key, list) {
    if (!list.length) return MENU_TRACK_IDS[0];
    let i = this.playOrder[key] || 0;
    for (let tries = 0; tries < list.length; tries++) {
      const id = list[i % list.length];
      i++;
      const avoid = key === 'gameplay' ? this.recent.slice(-Math.min(2, list.length - 1)) : [this.song && this.song.id];
      if (!avoid.includes(id) || list.length === 1) { this.playOrder[key] = i; return id; }
    }
    this.playOrder[key] = i;
    return list[i % list.length];
  }

  /** Pause sheet "NASTĘPNY": the next unlocked track, right away. */
  skipTrack() {
    const list = this.song && this.song.menu ? MENU_TRACK_IDS : this.unlockedGameplayTracks();
    const id = this.song && this.song.menu ? this.nextFrom('menu', list) : this.nextGameplayTrack();
    this.playTrack(id, { restart: true });
    return id;
  }

  /** Switch tracks: a 0.3 s fade, then the new song starts on a downbeat
   *  with a crash. Before the audio is unlocked it just loads silently. */
  playTrack(id, opts = {}) {
    if (!MUSIC_TRACK_BY_ID[id]) id = MENU_TRACK_IDS[0];
    const current = this.queued ? this.queued.id : this.song && this.song.id;
    if (current === id && !opts.restart) return;
    if (current === id && opts.restart && !this.queued && this.formIdx === 0 && this.barInSection === 0 && this.barCount === 0) return;
    const q = { id, drop: !!opts.drop };
    if (!this.ctx || !this.musicTimer) { this.queued = null; this.loadSong(q); return; }
    const t = this.ctx.currentTime;
    this.musicIn.gain.cancelScheduledValues(t);
    this.musicIn.gain.setTargetAtTime(0.0001, t, 0.07);
    q.at = t + 0.3;
    this.queued = q;
  }

  loadSong(q) {
    let song = null;
    try { song = compileSong(q.id); } catch (e) { /* authoring error: qa/audio.mjs catches these */ }
    song = song || compileSong('wir');
    this.song = song;
    this.formIdx = q.drop && song.drop ? Math.max(0, song.form.indexOf(song.drop)) : 0;
    this.barInSection = 0; this.stepInBar = 0; this.barCount = 0; this.loopCount = 0;
    this.dropArmed = false; this.dropRiserBar = -1;
    if (!song.menu) { this.recent.push(song.id); if (this.recent.length > 4) this.recent.shift(); }
    // Already in the final stretch / SZAŁ: go straight for the drop.
    if (this.intensity >= 2) this.armDrop();
    this.applySongFx();
    if (this.onTrackChange) { try { this.onTrackChange(song); } catch (e) { /* UI only */ } }
  }

  applySongFx() {
    if (!this.ctx || !this.delay || !this.song) return;
    this.delay.delayTime.setValueAtTime(Math.min(1.4, 60 / this.song.bpm * 0.75), this.ctx.currentTime);
  }

  armDrop() {
    const s = this.song;
    if (!s || !s.drop || s.form[this.formIdx] === s.drop) return;
    this.dropArmed = true;
  }

  startMusic() {
    if (!this.ctx || this.musicTimer || this.settings.music === false) return;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.musicIn.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicIn.gain.setValueAtTime(1, this.ctx.currentTime);
    if (this.queued) { this.loadSong(this.queued); this.queued = null; }
    this.musicTimer = setInterval(() => this.scheduleMusic(), 30);
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.queued) { this.loadSong(this.queued); this.queued = null; }
  }

  /** Tempo: menus/outros a touch slower, the final stretch and SZAŁ push. */
  stepDur() {
    const mult = [this.song.menu ? 1 : 0.94, 1, 1.05, 1.1][this.intensity] || 1;
    return 60 / (this.song.bpm * mult) / 4;
  }

  scheduleMusic() {
    if (!this.live) return;
    // Clock jumped (context rebuilt or resumed after a long stop): resync
    // instead of going silent or firing a burst of stale notes.
    const now = this.ctx.currentTime;
    if (this.nextNoteTime < now - 0.25 || this.nextNoteTime > now + 1) this.nextNoteTime = now + 0.05;
    this.scheduleUntil(now + 0.12);
  }

  /** Plays every step that starts before `horizon` (seconds on the
   *  context clock). Shared by the live timer and offline QA renders. */
  scheduleUntil(horizon) {
    const c = this.ctx;
    while (this.nextNoteTime < horizon) {
      if (this.queued && this.queued.at != null && this.nextNoteTime >= this.queued.at) {
        this.loadSong(this.queued);
        this.queued = null;
        const t = Math.max(c.currentTime, this.nextNoteTime);
        this.musicIn.gain.cancelScheduledValues(t);
        this.musicIn.gain.setValueAtTime(0.0001, t);
        this.musicIn.gain.exponentialRampToValueAtTime(1, t + 0.06);
        this.crashNext = true;
      }
      const sd = this.stepDur();
      const swing = this.song.swing && this.stepInBar % 2 ? this.song.swing * sd : 0;
      this.playStep(this.nextNoteTime + swing - c.currentTime, sd);
      this.nextNoteTime += sd;
      this.advance();
    }
  }

  advance() {
    const s = this.song;
    if (++this.stepInBar < 16) return;
    this.stepInBar = 0;
    this.barCount++;
    const sec = s.sections[s.form[this.formIdx]];
    if (++this.barInSection >= sec.bars) {
      this.barInSection = 0;
      this.formIdx++;
      if (this.formIdx >= s.form.length) {
        this.formIdx = 0;
        this.loopCount++;
        // A full pass done: menus and Arena move on to the next track (a
        // DJ-style cut on the downbeat); missions loop their district theme.
        const pinned = this.settings.musicPick && this.settings.musicPick !== 'auto';
        if (!this.queued && (this.scene === 'menu' || (this.scene === 'arena' && !pinned && !this.sceneOpts.daily && !this.sceneOpts.challenge))) {
          const next = this.scene === 'menu' ? this.nextFrom('menu', MENU_TRACK_IDS) : this.nextGameplayTrack();
          if (next !== s.id) this.queued = { id: next, at: 0 };
        }
      }
    }
    if (s.form[this.formIdx] === s.drop) { this.dropArmed = false; this.dropRiserBar = -1; }
    if (this.dropArmed) {
      if (this.dropRiserBar < 0) this.dropRiserBar = this.barCount;
      else if (this.barCount > this.dropRiserBar) {
        this.formIdx = s.form.indexOf(s.drop);
        this.barInSection = 0;
        this.dropArmed = false; this.dropRiserBar = -1;
        this.crashNext = true;
      }
    }
  }

  /** One synth voice of a track's timbre. */
  voice(kind, midi, dur, vol, when, bus, bright = 1) {
    const f = midiHz(midi);
    switch (kind) {
      case 'saw': this.tone({ type: 'sawtooth', freq: f, dur, vol, when, bus, filter: 2000 * bright, q: 2 }); break;
      case 'tri': this.tone({ type: 'triangle', freq: f, dur, vol: vol * 1.5, when, bus }); break;
      case 'sine': this.tone({ type: 'sine', freq: f, dur, vol: vol * 1.5, when, bus }); break;
      case 'pluck': this.tone({ type: 'sawtooth', freq: f, dur: Math.min(dur, 0.4), vol: vol * 1.2, when, bus, filter: 3400 * bright, filterEnd: 260, q: 3 }); break;
      case 'bell':
        this.tone({ type: 'sine', freq: f, dur: dur + 0.35, vol: vol * 1.4, when, bus, attack: 0.003 });
        this.tone({ type: 'sine', freq: f * 2.76, dur: 0.22, vol: vol * 0.3, when, bus, attack: 0.002 });
        break;
      case 'organ':
        this.tone({ type: 'square', freq: f, dur, vol: vol * 0.7, when, bus, filter: 1300 * bright, q: 1 });
        this.tone({ type: 'sine', freq: f * 2, dur, vol: vol * 0.5, when, bus });
        break;
      default: this.tone({ type: 'square', freq: f, dur, vol, when, bus, filter: 2400 * bright, q: 2 });
    }
  }

  kick(when, vol) {
    const chip = this.song.kit === 'chip';
    this.tone({ type: chip ? 'square' : 'sine', freq: chip ? 160 : 125, freqEnd: 42, dur: chip ? 0.1 : 0.2, vol: chip ? vol * 0.6 : vol, when, bus: this.musicIn, filter: chip ? 900 : null });
    // Sidechain pump: pads breathe with the kick.
    const t = Math.max(0, this.ctx.currentTime + when), g = this.padBus.gain;
    g.setValueAtTime(1, t); g.linearRampToValueAtTime(0.4, t + 0.012); g.linearRampToValueAtTime(1, t + 0.2);
  }

  snare(when, vol) {
    const kit = this.song.kit;
    if (kit === 'clap') {
      [0, 0.012, 0.024].forEach(d => this.noise({ dur: 0.09, vol: vol * 0.8, freq: 1500, q: 1.2, when: when + d, bus: this.musicIn }));
      this.noise({ dur: 0.22, vol: vol * 0.5, freq: 1300, q: 0.8, when: when + 0.03, bus: this.wetBus });
      return;
    }
    const lofi = kit === 'lofi';
    this.noise({ dur: lofi ? 0.1 : 0.13, vol: lofi ? vol * 0.7 : vol, freq: lofi ? 1300 : 1900, q: lofi ? 0.8 : 1, when, bus: kit === 'chip' ? this.musicIn : this.wetBus });
    this.tone({ type: 'triangle', freq: 210, freqEnd: 150, dur: 0.08, vol: vol * 0.6, when, bus: this.musicIn });
  }

  hat(when, vol, open) {
    this.noise({ dur: open ? 0.16 : 0.035, vol, freq: this.song.kit === 'lofi' ? 7000 : 9000, type: 'highpass', when, bus: this.musicIn });
  }

  playStep(when, sd) {
    const S = this.song, L = this.intensity, bus = this.wetBus;
    const sec = S.sections[S.form[this.formIdx]];
    const bar = this.barInSection, s = this.stepInBar;
    const chord = sec.chords[bar % sec.chords.length];
    // Effective layers: the drop section counts one level hotter in a round.
    const lv = L >= 1 && sec.lift ? Math.min(3, L + 1) : L;
    const menu = !!S.menu;
    const full = lv >= 1 || menu;                 // drums + bass + lead
    const dv = menu && L === 0 ? 0.6 : 1;          // lo-fi menu beat sits back
    const odd = this.loopCount % 2 === 1;          // every other pass varies
    const barDur = sd * 16;
    const drop = S.drop && S.form[this.formIdx] === S.drop;

    if (s === 0) {
      const bright = menu ? 0.6 : (lv === 0 ? 0.45 : 0.7 + lv * 0.25);
      chord.pad.forEach((m, i) => {
        this.voice(S.pad, m, barDur + 0.15, menu ? 0.022 : 0.026, when, this.padBus, bright);
        if (i === 0 || lv >= 2) this.tone({ type: 'sawtooth', freq: midiHz(m), dur: barDur + 0.15, vol: 0.012, attack: menu ? 0.6 : 0.3, when, bus: this.padBus, filter: 900 * bright, detune: 9 });
      });
      if (this.crashNext || (bar === 0 && lv >= 2 && this.barCount > 0) || (bar === 0 && drop && full)) {
        this.crashNext = false;
        if (full) this.noise({ dur: 1.4, vol: 0.07 * dv, freq: 6500, type: 'highpass', when, bus: this.wetBus });
      }
      // The bar before a drop: a riser under a snare roll.
      if (this.barCount === this.dropRiserBar && L >= 1) this.noise({ dur: barDur, vol: 0.09, freq: 400, freqEnd: 7000, type: 'bandpass', q: 2.5, when, bus: this.wetBus, attack: barDur * 0.9 });
    }

    if (full) {
      const k = S.drums.kick[s], sn = S.drums.snare[s], h = (lv >= 2 ? S.hats16 : S.drums.hat)[s];
      const lastBar = bar === sec.bars - 1;
      const roll = (lastBar && s >= 12 && lv >= 1 && !menu) || (this.barCount === this.dropRiserBar && s >= 8 && L >= 1);
      if (k === 'x' || k === 'o') this.kick(when, (k === 'x' ? 0.5 : 0.3) * dv);
      if (roll) this.snare(when, 0.05 + (s % 16) * 0.006);
      else if (sn === 'x' || sn === 'o') this.snare(when, (sn === 'x' ? 0.12 : 0.05) * dv);
      if (h === 'x' || h === 'o' || h === 'O') this.hat(when, (h === 'o' ? 0.025 : 0.05) * dv, h === 'O');
      if (S.glitch && lv >= 1 && Math.random() < 0.06) [0, 1, 2].forEach(i => this.hat(when + i * sd / 3, 0.04, false));

      const bl = (odd && S.bassAlt) || S.bassLine;
      const b = bl[s];
      if (b !== '.' && b !== '-') {
        let hold = 1;
        while (s + hold < 16 && bl[s + hold] === '-') hold++;
        const m = chord.bass + (b === 'O' ? 12 : b === 'F' ? 7 : b === 'T' ? (chord.pad[1] - chord.pad[0]) : 0);
        const bv = S.bass === 'sub' ? 0.2 : 0.13;
        if (S.bass === 'sub') {
          this.tone({ type: 'sine', freq: midiHz(m), dur: sd * hold * 0.95, vol: bv * dv, when, bus: this.musicIn, attack: 0.01 });
          this.tone({ type: 'triangle', freq: midiHz(m + 12), dur: sd * hold * 0.8, vol: 0.05 * dv, when, bus: this.musicIn });
        } else this.voice(S.bass === 'pluck' ? 'pluck' : S.bass, m, sd * hold * 0.9, bv * dv, when, this.musicIn, 0.18 + lv * 0.1);
      }
    }

    // Arp: chord tones an octave up (reversed on odd passes), faster in
    // the final stretch.
    const rate = lv >= 2 ? 1 : S.arpRate;
    if (s % rate === 0) {
      const pat = S.arpLine;
      const idx = +pat[(odd ? pat.length - 1 - (s / rate) % pat.length : (s / rate) % pat.length)];
      const notes = chord.pad;
      const m = notes[idx % notes.length] + 12 + (lv >= 3 && s % 4 === 3 ? 12 : 0);
      this.voice(lv === 0 && !menu ? 'sine' : S.arp, m, sd * rate * 0.9, lv === 0 ? 0.022 : 0.02, when, bus, 0.9 + lv * 0.2);
    }

    // Lead (the hook): any round level, and the menu tracks' soft melody.
    if (sec.lead && full) {
      const ev = sec.lead[(bar * 16 + s) % sec.lead.length];
      if (ev) {
        const dur = sd * ev.steps * 0.92;
        const lvol = menu ? 0.03 : 0.036 + (lv >= 2 ? 0.008 : 0);
        this.voice(S.lead, ev.midi, dur, lvol, when, bus, 0.9 + lv * 0.25);
        if (lv >= 3) this.voice('sine', ev.midi + 12, dur, 0.016, when, bus);
      }
    }

    if (S.crackle && Math.random() < 0.3) this.noise({ dur: 0.012, vol: 0.012 + Math.random() * 0.012, freq: 3000, type: 'highpass', when: when + Math.random() * sd, bus: this.musicIn });
  }
}

/* ----------------------- Monetization (Golden Shot v11) -----------------------
   One provider-agnostic adapter; the game only ever calls
   `monetization.rewarded(placement)` / `.interstitial(placement)` /
   `.purchase(sku)` / `.gameplayStart()` / `.gameplayStop()`. The provider
   is detected at runtime -- nothing here holds keys or secrets:

   - 'crazygames' — CrazyGames HTML5 SDK v3 (window.CrazyGames.SDK)
   - 'poki'       — Poki SDK v2 (window.PokiSDK)
   - 'h5'         — Google H5 Games Ads / Ad Placement API (window.adBreak,
                    set up by the publisher's own AdSense tag)
   - 'native'     — a mobile wrapper (Capacitor/TWA/WebView) that injects
                    window.VectorHoleNative = { rewarded(placement) →
                    Promise<bool>, interstitial(placement) → Promise,
                    purchase(sku) → Promise<{ok}>, products() →
                    Promise<[{sku, price}]> } backed by AdMob / Play Billing /
                    StoreKit. This is the only provider with real IAP.
   - 'demo'       — no SDK present (GitHub Pages build): a clearly-labelled
                    3-second "DEMO REKLAMY" placeholder so every placement
                    can be tested end-to-end. IAP is unavailable in demo, so
                    the paid store stays hidden -- the game never fakes a
                    purchase.

   Portal SDK scripts are only fetched when the page is actually running on
   that portal (hostname/referrer match, or ?portal=… for local testing),
   so the default build makes no third-party requests. */
const PORTAL_SDKS = {
  crazygames: { match: /(^|\.)crazygames\.[a-z.]+$/, src: 'https://sdk.crazygames.com/crazygames-sdk-v3.js' },
  poki: { match: /(^|\.)poki(-gdn)?\.(com|net|io)$/, src: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js' }
};

// Rewarded placements -- each sits at an emotional peak and is always
// opt-in (the player taps a button; nothing auto-plays). `dailyCap` limits
// how often a placement can pay out per UTC day.
const AD_PLACEMENTS = {
  result_double_coins: { label: '×2 monet' },
  mission_revive: { label: '+20 s na misję' },
  chest_skip: { label: 'Skrzynia teraz', dailyCap: 3 },
  login_double: { label: '×2 nagroda dnia' },
  free_prisms: { label: '+5 pryzmatów', dailyCap: 3 },
  turbo_free: { label: 'Turbo start gratis', dailyCap: 2 },
  // v15: one energy point per ad, a few times a day.
  energy_ad: { label: '+1 energia', dailyCap: 5 }
};

// Store catalog for providers with IAP (see 'native' above). Prices are
// display fallbacks; a provider's products() overrides them with the
// store's localized price. No loot boxes: every pack lists exactly what it
// contains (EU/UK/BE/NL paid-random-reward rules).
const IAP_PRODUCTS = [
  { sku: 'starter_pack', name: 'Pakiet Startowy', price: '9,99 zł', oneTime: true, best: true, grant: { coins: 1500, prisms: 60, auraId: 'starter_glow', noAds: false }, desc: '1500 monet · 60 pryzmatów · ekskluzywna Smuga „Zorza Startu”' },
  { sku: 'prisms_s', name: 'Garść pryzmatów', price: '4,99 zł', grant: { prisms: 40 }, desc: '40 pryzmatów' },
  { sku: 'prisms_m', name: 'Skrzynia pryzmatów', price: '19,99 zł', grant: { prisms: 200 }, desc: '200 pryzmatów (+25% gratis)' },
  { sku: 'prisms_l', name: 'Skarbiec pryzmatów', price: '44,99 zł', grant: { prisms: 520 }, desc: '520 pryzmatów (+45% gratis)' },
  // v15: the session limit's paid skip -- no energy cost for an hour.
  { sku: 'energy_hour', name: 'Godzina bez limitu', price: '7,99 zł', grant: { infiniteEnergyMin: 60 }, desc: 'Przez 60 minut każda runda i misja za darmo (bez zużywania energii)' },
  { sku: 'no_ads', name: 'Bez reklam', price: '14,99 zł', oneTime: true, grant: { noAds: true }, desc: 'Wyłącza reklamy między rundami na zawsze (nagrody za reklamę zostają do wyboru)' }
];

class Monetization {
  constructor(game) {
    this.game = game;
    this.provider = 'demo';
    this.sdk = null;
    this.ready = Promise.resolve();
    this.inGameplay = false;
    this.lastInterstitialAt = 0;
    this.prices = {};
    this.busy = false;
    const portal = this.detectPortal();
    if (portal) this.ready = this.loadPortal(portal);
    else this.attachProvider();
  }

  detectPortal() {
    const forced = new URLSearchParams(location.search).get('portal');
    if (forced && PORTAL_SDKS[forced]) return forced;
    let ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) { /* no referrer */ }
    for (const [id, p] of Object.entries(PORTAL_SDKS)) {
      if (p.match.test(location.hostname) || (ref && p.match.test(ref))) return id;
    }
    return null;
  }

  loadPortal(id) {
    return new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = PORTAL_SDKS[id].src;
      s.async = true;
      s.onload = () => { this.attachProvider(true).then(resolve, resolve); };
      s.onerror = () => { this.attachProvider(true).then(resolve, resolve); };
      document.head.appendChild(s);
    });
  }

  /** A provider whose setup partly fails keeps its identity (its markers
   *  still matter) -- and if a portal was detected but its SDK can't be
   *  used at all, the provider is 'none' (rewarded ads resolve false), never
   *  'demo': the demo placeholder pays real rewards for a fake ad and must
   *  only ever run on the plain web build. */
  async attachProvider(portalExpected) {
    const soft = async (fn) => { try { await fn(); } catch (e) { /* partial SDK failure: keep the provider */ } };
    if (window.VectorHoleNative) {
      this.provider = 'native';
      this.sdk = window.VectorHoleNative;
      await soft(async () => {
        const list = this.sdk.products ? await this.sdk.products() : [];
        (list || []).forEach(p => { this.prices[p.sku] = p.price; });
      });
    } else if (window.CrazyGames && window.CrazyGames.SDK) {
      this.provider = 'crazygames';
      this.sdk = window.CrazyGames.SDK;
      await soft(async () => { if (this.sdk.init) await this.sdk.init(); });
      await soft(async () => { if (this.sdk.game && this.sdk.game.loadingStop) this.sdk.game.loadingStop(); });
    } else if (window.PokiSDK) {
      // PokiSDK.init() rejects by design under an adblocker; the game must
      // still report loading/gameplay and simply get no ads.
      this.provider = 'poki';
      this.sdk = window.PokiSDK;
      await soft(() => this.sdk.init());
      await soft(() => this.sdk.gameLoadingFinished());
    } else if (typeof window.adBreak === 'function') {
      this.provider = 'h5';
      this.sdk = window.adBreak;
      await soft(() => { if (typeof window.adConfig === 'function') window.adConfig({ preloadAdBreaks: 'on', sound: 'on' }); });
    } else if (portalExpected) {
      this.provider = 'none';
      this.sdk = null;
    }
    this.game.analytics.track('monetization_provider', { provider: this.provider });
  }

  get canPurchase() { return this.provider === 'native' && !!(this.sdk && this.sdk.purchase); }
  get isDemo() { return this.provider === 'demo'; }
  price(sku) { return this.prices[sku] || (IAP_PRODUCTS.find(p => p.sku === sku) || {}).price || ''; }

  /** Portals pause their own ads during gameplay and use these markers for
   *  their engagement metrics (CrazyGames/Poki both require them). */
  gameplayStart() {
    if (this.inGameplay) return;
    this.inGameplay = true;
    try {
      if (this.provider === 'crazygames') this.sdk.game.gameplayStart();
      else if (this.provider === 'poki') this.sdk.gameplayStart();
    } catch (e) { /* SDK hiccup -- never block the game */ }
  }

  gameplayStop() {
    if (!this.inGameplay) return;
    this.inGameplay = false;
    try {
      if (this.provider === 'crazygames') this.sdk.game.gameplayStop();
      else if (this.provider === 'poki') this.sdk.gameplayStop();
    } catch (e) { /* ignore */ }
  }

  /** Challenge link for sharing. On a portal the game runs inside the
   *  portal's iframe, so the link must point at the portal page (Poki
   *  shareableURL / CrazyGames inviteLink), not the raw game CDN URL. */
  async shareUrl(seed, score, name) {
    const p = challengeParams(seed, score, name);
    try {
      if (this.provider === 'poki' && this.sdk.shareableURL) return await this.sdk.shareableURL(p);
      if (this.provider === 'crazygames' && this.sdk.game && this.sdk.game.inviteLink) return await this.sdk.game.inviteLink(p);
    } catch (e) { /* fall through to our own URL */ }
    return encodeChallenge(seed, score, name);
  }

  /** Incoming challenge params: on a portal they live on the parent page
   *  and are read through the SDK; otherwise from our own query string. */
  incomingChallengeSearch() {
    try {
      if (this.provider === 'poki' && this.sdk.getURLParam) {
        const c = this.sdk.getURLParam('c');
        if (c) return `?c=${encodeURIComponent(c)}&n=${encodeURIComponent(this.sdk.getURLParam('n') || '')}`;
      }
      if (this.provider === 'crazygames' && this.sdk.game && this.sdk.game.getInviteParam) {
        const c = this.sdk.game.getInviteParam('c');
        if (c) return `?c=${encodeURIComponent(c)}&n=${encodeURIComponent(this.sdk.game.getInviteParam('n') || '')}`;
      }
    } catch (e) { /* no portal params */ }
    return null;
  }

  /** A celebratory moment (new PB, first win) -- CrazyGames' happytime. */
  happyTime() {
    try { if (this.provider === 'crazygames' && this.sdk.game.happytime) this.sdk.game.happytime(); } catch (e) { /* ignore */ }
  }

  placementLeft(placement) {
    const def = AD_PLACEMENTS[placement];
    if (!def || !def.dailyCap) return Infinity;
    const st = this.game.save.ads || {};
    const today = dailySeedForDate(new Date()).dateKey;
    const used = st.dateKey === today ? (st.used && st.used[placement]) || 0 : 0;
    return Math.max(0, def.dailyCap - used);
  }

  notePlacementUsed(placement) {
    const save = this.game.save;
    const today = dailySeedForDate(new Date()).dateKey;
    if (!save.ads || save.ads.dateKey !== today) save.ads = { dateKey: today, used: {}, watched: (save.ads && save.ads.watched) || 0 };
    save.ads.used[placement] = (save.ads.used[placement] || 0) + 1;
    save.ads.watched = (save.ads.watched || 0) + 1;
  }

  /** Resolves true only if the player watched to the end (reward granted). */
  async rewarded(placement) {
    if (this.busy || this.placementLeft(placement) <= 0) return false;
    this.busy = true;
    const wasPlaying = this.inGameplay;
    this.gameplayStop();
    this.game.sound.suspend();
    this.game.analytics.track('ad_started', { context: placement, type: 'rewarded', provider: this.provider });
    let ok = false;
    try {
      await this.ready;
      if (this.provider === 'native') ok = !!(await this.sdk.rewarded(placement));
      else if (this.provider === 'poki') ok = !!(await this.sdk.rewardedBreak());
      else if (this.provider === 'crazygames') ok = await new Promise((res) => this.sdk.ad.requestAd('rewarded', { adFinished: () => res(true), adError: () => res(false) }));
      else if (this.provider === 'none') ok = false;
      else if (this.provider === 'h5') ok = await new Promise((res) => {
        let viewed = false;
        this.sdk({ type: 'reward', name: placement, beforeReward: (show) => show(), adViewed: () => { viewed = true; }, adDismissed: () => {}, adBreakDone: () => res(viewed) });
      });
      else ok = await this.demoAd(true);
    } catch (e) { ok = false; }
    this.game.sound.resume();
    if (wasPlaying) this.gameplayStart();
    this.busy = false;
    if (ok) {
      this.notePlacementUsed(placement);
      saveGame(this.game.save);
      this.game.analytics.track('ad_reward_granted', { context: placement, provider: this.provider });
    } else {
      this.game.analytics.track('ad_reward_failed', { context: placement, provider: this.provider });
    }
    return ok;
  }

  /** Between-round break. Capped (CONFIG.ads) and skipped entirely with
   *  the "Bez reklam" entitlement or during the newbie runs. */
  async interstitial(placement) {
    const A = CONFIG.ads;
    const save = this.game.save;
    if (save.entitlements && save.entitlements.noAds) return;
    if ((save.stats.runsPlayed || 0) < CONFIG.economy.newbieRuns) return;
    if (Date.now() - this.lastInterstitialAt < A.interstitialMinGapMs) return;
    if (this.busy) return;
    this.busy = true;
    this.lastInterstitialAt = Date.now();
    this.game.sound.suspend();
    this.game.analytics.track('ad_started', { context: placement, type: 'interstitial', provider: this.provider });
    try {
      await this.ready;
      if (this.provider === 'native') await this.sdk.interstitial(placement);
      else if (this.provider === 'poki') await this.sdk.commercialBreak();
      else if (this.provider === 'crazygames') await new Promise((res) => this.sdk.ad.requestAd('midgame', { adFinished: res, adError: res }));
      else if (this.provider === 'h5') await new Promise((res) => this.sdk({ type: 'next', name: placement, adBreakDone: res }));
      else if (this.provider === 'demo') await this.demoAd(false);
    } catch (e) { /* an ad failing must never block the next round */ }
    this.game.sound.resume();
    this.busy = false;
  }

  /** The "demo" provider's stand-in ad: a labelled 3 s overlay drawn on
   *  top of whatever screen is open (so mid-mission/hub placements work). */
  demoAd(rewarded) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('adOverlay');
      const bar = document.getElementById('adProgressBar');
      const countdown = document.getElementById('adCountdown');
      document.getElementById('adKind').textContent = rewarded ? 'REKLAMA Z NAGRODĄ · DEMO' : 'PRZERWA REKLAMOWA · DEMO';
      overlay.classList.remove('hidden');
      bar.style.width = '0%';
      const duration = CONFIG.ads.demoSeconds;
      const start = Date.now();
      const tick = () => {
        const t = (Date.now() - start) / 1000;
        bar.style.width = clamp((t / duration) * 100, 0, 100) + '%';
        countdown.textContent = Math.max(0, Math.ceil(duration - t));
        if (t >= duration) { overlay.classList.add('hidden'); resolve(true); } else setTimeout(tick, 100);
      };
      tick();
    });
  }

  async purchase(sku) {
    const product = IAP_PRODUCTS.find(p => p.sku === sku);
    if (!product || !this.canPurchase) return false;
    this.game.analytics.track('iap_intent', { sku });
    try {
      const res = await this.sdk.purchase(sku);
      if (!res || !res.ok) { this.game.analytics.track('iap_cancel', { sku }); return false; }
      this.game.analytics.track('iap_success', { sku, price: this.price(sku) });
      return true;
    } catch (e) {
      this.game.analytics.track('iap_fail', { sku, error: String(e) });
      return false;
    }
  }
}

// Arena's object bestiary mirrors Campaign's CampaignEntity types 1:1
// (player feedback: the two modes should use "dokładnie takie same
// obiekty" -- exactly the same objects -- with Campaign as the reference
// for every property, not just color). Each TIERS key matches one
// CAMPAIGN_ENTITY_STATS type: color/radius/value/minSizeTier are taken
// directly from Campaign's own values (SIZE_TIER_COLORS, entityRadius,
// stats.score, stats.minTier), so an object is visually and mechanically
// the same object in both modes. `subtypes` still gives multi-glyph types
// (prop) visual variety, matching Campaign's own PROP_STREET_GLYPHS.
// Arena-only objects with no Campaign counterpart (the old 'fontanna'/
// 'skyscraper' pickups) were removed rather than kept as a divergent
// bestiary; 'portal' remains a separate entry outside the shared bestiary
// (Campaign has no equivalent pickup at all), only ever spawned by
// spawnPortalRain() during Overdrive (see that method's own doc comment),
// but it's still tier-gated like everything else here -- see minSizeTier
// below (player feedback: eating violet objects before growing to their
// size read as a bug; letting this one bonus-wave type skip the growth
// gate broke the "arena and campaign are exactly the same gameplay" rule
// just as much as a missing tier check would have).
// `minSizeTier` indexes CONFIG.sizeTiers (T1..T5): a hole must have grown
// to at least that tier before objects of this type become eatable at
// all -- see getSizeTierIndex()/canEatWorldObjectTier(). This is the only
// eat-eligibility gate for world objects (no physical size-ratio check),
// matching Campaign's own `tier < e.stats.minTier` gate in
// handleCampaignEating() exactly.
const TIERS = {
  // `growth` = CAMPAIGN_ENTITY_STATS' growth units (see CONFIG.growth).
  // v13: 95 -> 170 fragments / 35 -> 40 capsules. A casual player found ~4
  // objects on screen at the start and ate ~0.7 things per second; most of
  // the extra fragments are laid out as street trails and spawn feasts
  // (see Game.layStreetTrails()/layStarterFeasts(), CONFIG.arena).
  fragment: { color: '#50F0FA', minR: 7, maxR: 7, value: 5, growth: 1, subtypes: ['fragment'], count: 170, minSizeTier: 0 },
  capsule: { color: '#50F0FA', minR: 10, maxR: 10, value: 15, growth: 3, subtypes: ['kapsula'], count: 40, minSizeTier: 0 },
  prop: { color: '#FF54AD', minR: 20, maxR: 20, value: 15, growth: 3, subtypes: ['latarnia', 'drzewo', 'lawka', 'kiosk', 'skrzynia'], count: 40, minSizeTier: 1 },
  marker: { color: '#FF54AD', minR: 20, maxR: 20, value: 50, growth: 10, subtypes: ['znacznik'], count: 10, minSizeTier: 1 },
  vehicle: { color: '#EFCB63', minR: 34, maxR: 34, value: 30, growth: 6, subtypes: ['samochod'], count: 10, minSizeTier: 2 },
  node: { color: '#EFCB63', minR: 32, maxR: 32, value: 50, growth: 10, subtypes: ['wezel'], count: 4, minSizeTier: 2 },
  pylon: { color: '#EFCB63', minR: 32, maxR: 32, value: 50, growth: 10, subtypes: ['pylon'], count: 4, minSizeTier: 2 },
  landmark: { color: '#9875FF', minR: 52, maxR: 52, value: 160, growth: 32, subtypes: ['landmark'], count: 2, minSizeTier: 3 },
  // v10: the T4/T5/T6 classes (violet / silver / green), each taught by a
  // Campaign mission before Arena spawns it (see createObjects()).
  structure: { color: '#9875FF', minR: 54, maxR: 54, value: 80, growth: 16, subtypes: ['pawilon', 'billboard', 'magazyn'], count: 9, minSizeTier: 3 },
  heavy: { color: '#CBD5E1', minR: 76, maxR: 76, value: 120, growth: 24, subtypes: ['autobus', 'tramwaj', 'ciezarowka'], count: 6, minSizeTier: 4 },
  tower: { color: '#46D99A', minR: 100, maxR: 100, value: 200, growth: 40, subtypes: ['wiezowiec', 'maszt', 'kopula'], count: 4, minSizeTier: 5 },
  // Shares landmark's tier (3, T4) rather than its own ratio-derived floor --
  // both are the palette's violet/T4 accent color, so a player who has not
  // yet reached T4 shouldn't be able to eat either one.
  portal: { color: '#9875FF', minR: 14, maxR: 20, value: 15, growth: 6, subtypes: ['portal'], count: 0, minSizeTier: 3 },
  // Golden Shot v9 Złoty Rdzeń (see CONFIG.golden) -- never part of the
  // regular pool (count 0); spawned one at a time by Game.spawnGoldenCore().
  golden: { color: '#EFCB63', minR: 13, maxR: 13, value: 60, growth: 4, subtypes: ['zloty'], count: 0, minSizeTier: 0 }
};

const BOT_NAME_POOL = [
  'NeonGhost', 'PixelWolf', 'ByteViper', 'CyberFox', 'GlitchKing', 'VoidRunner',
  'ChromaCat', 'LagMonster', 'NightHawk', 'ToxicSlime', 'RetroWave', 'GridRunner',
  'SynthWolf', 'ZeroPulse', 'HexShadow'
];

const BOT_COLORS = ['#FF54AD', '#46D99A', '#EFCB63', '#9875FF', '#50F0FA', '#ff3860'];

const SKINS = [
  // v13 prices ~3.3x: a 20-round QA career ended with 8 139 coins unspent
  // and every coin item (then ~1 560 in total) bought after 5-10 rounds.
  // Golden Shot v9: every Rdzeń now has a gameplay bonus (`perks`, applied
  // in Arena/Daily rounds only -- see Game.perk()) on top of its signature
  // look (SKIN_STYLES), so buying one changes how you play, not just color.
  { id: 'rainbow', name: 'Tęcza', price: 0, rainbow: true, perks: [], perkLabel: 'Bez bonusu — wir startowy' },
  { id: 'cyan', name: 'Cyjan', price: 100, color: '#50F0FA', perks: [{ type: 'speed', value: 0.08 }], perkLabel: '+8% prędkości' },
  { id: 'pink', name: 'Gorący Róż', price: 220, color: '#FF54AD', perks: [{ type: 'comboWindow', value: 0.6 }], perkLabel: '+0,6 s na utrzymanie combo' },
  { id: 'green', name: 'Toksyczna Zieleń', price: 450, color: '#46D99A', perks: [{ type: 'magnet', value: 120 }], perkLabel: 'Stały mini-magnes 120 px' },
  { id: 'purple', name: 'Ultrafiolet', price: 800, color: '#9875FF', perks: [{ type: 'xp', value: 0.25 }], perkLabel: '+25% XP za rundę' },
  { id: 'gold', name: 'Neonowe Złoto', price: 1300, color: '#EFCB63', perks: [{ type: 'coins', value: 0.3 }], perkLabel: '+30% monet za rundę' },
  { id: 'white', name: 'Biała Plazma', price: 2000, color: '#ffffff', perks: [{ type: 'startUnits', value: 8 }, { type: 'score', value: 0.1 }], perkLabel: 'Start od T2 + 10% punktów' },
  // GDD 4.0 §6 M24 (kampanii finał) reward: a skin that's never for sale,
  // only granted on the campaign's last mission clear (see reward.unlockSkin
  // in CAMPAIGN_MISSIONS + endCampaignMission()).
  { id: 'aurora', name: 'Aurora Finału', price: null, color: '#7cffcb', unlockSource: { type: 'mission', id: 'M24' }, perks: [{ type: 'score', value: 0.2 }], perkLabel: '+20% punktów' },
  // GDD 4.0 §8.2 Core City reward ladder (never for sale, granted by
  // grantCoreCityLevelReward() — see CORE_CITY_LEVEL_REWARDS below).
  { id: 'krysztal', name: 'Kryształ', price: null, color: '#8ce8ff', unlockSource: { type: 'coreCity', level: 3 }, perks: [{ type: 'growth', value: 0.15 }], perkLabel: '+15% wzrostu z obiektów' },
  { id: 'pryzmat', name: 'Pryzmat', price: null, rainbow: true, unlockSource: { type: 'coreCity', level: 6 }, perks: [{ type: 'coins', value: 0.2 }, { type: 'xp', value: 0.2 }], perkLabel: '+20% monet i +20% XP' }
];

// Phase 7 shop v2: a second cosmetic category beyond ring skins, purchasable
// with either currency to give Prisms an actual sink (GDD 10.1/10.2). GDD
// 4.0 §5.3 renames this Warsztat category "Trail" -- kept as `AURAS`
// internally since it's the same following-glow render path (Hole's aura).
const AURAS = [
  { id: 'none', name: 'Brak', priceCoins: 0, priceType: 'coins' },
  { id: 'spark', name: 'Iskra', priceCoins: 500, priceType: 'coins', color: '#50F0FA' },
  { id: 'ember', name: 'Żar', pricePrisms: 15, priceType: 'prisms', color: '#FF54AD' },
  { id: 'vortex', name: 'Zawirowanie', pricePrisms: 30, priceType: 'prisms', color: '#9875FF' },
  { id: 'impuls', name: 'Impuls', priceCoins: null, color: '#46D99A', unlockSource: { type: 'coreCity', level: 2 } },
  { id: 'pryzmat', name: 'Pryzmat', priceCoins: null, color: '#ffffff', unlockSource: { type: 'coreCity', level: 6 } },
  // v11: Pakiet Startowy exclusive (IAP_PRODUCTS.starter_pack) -- hidden
  // from the grid unless owned or purchasable (renderCosmeticGrid()).
  { id: 'starter_glow', name: 'Zorza Startu', priceCoins: null, color: '#7cffcb', unlockSource: { type: 'iap', sku: 'starter_pack' } }
];

// GDD 4.0 §5.3 Warsztat category 3: "Efekt pochłaniania" -- the eat/absorb
// particle burst (see triggerEatFeedback()). 'classic' keeps today's
// per-object-type colors (color: null means "don't override").
const EAT_EFFECTS = [
  { id: 'classic', name: 'Klasyczny', priceCoins: 0, color: null },
  { id: 'pixel_burst', name: 'Pikselowy Wybuch', priceCoins: null, color: '#EFCB63', unlockSource: { type: 'coreCity', level: 4 } },
  { id: 'pryzmat', name: 'Pryzmat', priceCoins: null, color: '#ffffff', unlockSource: { type: 'coreCity', level: 6 } }
];

// GDD 4.0 §5.3 Warsztat category 4: "Overdrive" -- a cosmetic tint on
// Arena's existing seeded Overdrive finish (see checkOverdriveTrigger()).
// Doesn't change which variant (blackout/portal_rain) is picked -- only
// the banner/glow color.
const OVERDRIVE_SKINS = [
  { id: 'classic', name: 'Klasyczny', priceCoins: 0, color: null },
  { id: 'fala', name: 'Fala', priceCoins: null, color: '#50F0FA', unlockSource: { type: 'coreCity', level: 5 } },
  { id: 'pryzmat', name: 'Pryzmat', priceCoins: null, color: '#ff00ea', unlockSource: { type: 'coreCity', level: 6 } }
];

// GDD 4.0 §8.2 "Progi i nagrody" -- what completing each Core City level
// grants. Keyed by the level the player *arrives at* (LVL1 is the starting
// state and grants nothing). Level 7+ has no authored reward (§8.2's own
// "beyond LVL6 is a seasonal/prestige loop, out of scope" disclaimer) so
// grantCoreCityLevelReward() falls back to hub.milestoneFallbackCoins/Prisms.
const CORE_CITY_LEVEL_REWARDS = {
  2: { auraId: 'impuls', coins: 150, label: 'Smuga „Impuls”' },
  3: { skinId: 'krysztal', coins: 200, label: 'Wir „Kryształ”' },
  4: { effectId: 'pixel_burst', coins: 250, label: 'Efekt „Pikselowy Wybuch”' },
  5: { overdriveSkinId: 'fala', coins: 300, label: 'Finisz „Fala”' },
  6: { skinId: 'pryzmat', auraId: 'pryzmat', effectId: 'pryzmat', overdriveSkinId: 'pryzmat', badge: 'pryzmat', coins: 400, label: 'Zestaw „Pryzmat” + odznaka' }
};

// Phase 7 casual run tools: consumable per-run boosters, Coins-only, casual
// mode only (no ranked/daily equivalent exists yet to keep them fair for).
const RUN_TOOLS = [
  { id: 'none', name: 'Bez dodatku', price: 0, desc: 'Zwykły start, bez żadnego efektu. Zawsze darmowe.' },
  { id: 'shield', name: 'Tarcza', price: 45, desc: 'Przetrwasz 1 starcie z większym rywalem bez utraty rozmiaru.' },
  { id: 'magnet', name: 'Magnes', price: 25, desc: 'Przez pierwsze 12 s rundy obiekty same lecą w Twoją stronę.' },
  // Golden Shot v8: the direct counter to the difficulty ramp -- start
  // the round already at T2, bigger than a hard-mode rival's spawn size.
  { id: 'boost', name: 'Turbo start', price: 70, desc: 'Startujesz od razu z rozmiarem T2 — Twój wir od pierwszej sekundy przerasta rywali.', hot: true }
];

// v15 mission boosters (owner: "przed rozpoczęciem levelu powinno dać się
// dokupić toole"): picked in the briefing, one use each, bought with coins
// when none is in stock. Star chests, the login calendar and NELA's pity
// loan also hand them out.
const MISSION_BOOSTERS = [
  { id: 'time', name: 'Zegar', short: '+15 s', price: 60, color: '#50F0FA', icon: 'clock', desc: '+15 s do limitu czasu misji.' },
  { id: 'start', name: 'Turbo start', short: 'start od T2', price: 80, color: '#FF54AD', icon: 'bolt', desc: 'Wir startuje od razu z rozmiarem T2.' },
  { id: 'magnet', name: 'Magnes', short: 'cała misja', price: 50, color: '#46D99A', icon: 'magnet', desc: 'Przez całą misję obiekty, które możesz zjeść, same płyną do wiru.' },
  { id: 'shield', name: 'Tarcza', short: '2 zderzenia', price: 70, color: '#EFCB63', icon: 'shield', desc: 'Przyjmuje 2 zderzenia z większym rywalem albo strefą glitcha. Chroni też kruchy wir.' }
];

// Simple neon-line-art glyphs for the evolution/power cards (SVG, inline —
// no assets/build step). Keyed by `icon` on MUTATIONS/CAMPAIGN_POWERS below.
// Player feedback: the cards should show what a tool *does* instead of
// relying on the player to read a paragraph of text under time pressure.
const CARD_ICONS = {
  magnet: '<path d="M7 3v9a5 5 0 0010 0V3" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M7 3h4M13 3h4" stroke="currentColor" stroke-width="2.2"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor"/>',
  shield: '<path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  clock: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2.2" fill="none"/>',
  radar: '<circle cx="12" cy="12" r="1.8" fill="currentColor"/><path d="M8 12a4 4 0 018 0M5 12a7 7 0 0114 0" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  burst: '<circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  target: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>',
  star: '<path d="M12 2l2.6 6.9L22 9l-5.6 4.6L18.2 21 12 16.8 5.8 21l1.8-7.4L2 9l7.4-.1z" fill="currentColor"/>'
};

// Small per-entity-type glyphs for the campaign "CEL RUNDY" HUD (same
// <path>-into-viewBox convention as CARD_ICONS above), each echoing that
// type's own on-board CampaignEntity.draw() silhouette (fragment's diamond,
// node's ring+X, pylon's mast, etc.) so the HUD icon and the board object
// read as the same thing. Keyed by CampaignEntity `type`, plus 'gate' for
// gatesPassed goals and 'combo' for comboChain goals (reuses CARD_ICONS.burst).
const GOAL_ICONS = {
  fragment: '<path d="M12 3l8 9-8 9-8-9z" fill="currentColor"/>',
  capsule: '<rect x="7" y="2.5" width="10" height="19" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 12h10" stroke="currentColor" stroke-width="2"/>',
  prop: '<path d="M4 8l8-4.5L20 8v9l-8 4.5L4 17z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M4 8l8 4.5M20 8l-8 4.5v9" stroke="currentColor" stroke-width="2" fill="none"/>',
  vehicle: '<rect x="3" y="10" width="18" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 10a5 5 0 0110-0" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7.5" cy="17" r="1.7" fill="currentColor"/><circle cx="16.5" cy="17" r="1.7" fill="currentColor"/>',
  marker: '<path d="M6 21V3M6 3h12l-3.5 4.5L18 12H6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  node: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="currentColor" stroke-width="2"/>',
  pylon: '<path d="M12 8v13" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="2.2"/>',
  landmark: CARD_ICONS.star,
  gate: '<path d="M4 3v18M20 3v18M4 12h16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  // v10 classes + objective kinds.
  structure: '<path d="M3 10l9-6 9 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><rect x="5" y="10" width="14" height="10" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10" y="14" width="4" height="6" fill="currentColor"/>',
  heavy: '<rect x="2" y="6" width="20" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 11h20M7 6v5M12 6v5M17 6v5" stroke="currentColor" stroke-width="1.6"/><circle cx="7" cy="18.5" r="1.8" fill="currentColor"/><circle cx="17" cy="18.5" r="1.8" fill="currentColor"/>',
  tower: '<path d="M8 21V6l4-3 4 3v15M8 21h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10.5 9h3M10.5 13h3M10.5 17h3" stroke="currentColor" stroke-width="1.6"/>',
  tier: '<path d="M12 3l7 8h-4v9H9v-9H5z" fill="currentColor"/>',
  rival: '<circle cx="9" cy="12" r="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="12" r="3" fill="currentColor"/>',
  portal: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
  score: CARD_ICONS.star,
  combo: CARD_ICONS.burst,
  // v15
  runner: '<path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" fill="currentColor"/><path d="M11 8.5l2-1v9" stroke="#04101D" stroke-width="1.8" fill="none"/>',
  hunters: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 9.5l3 1.5M16 9.5l-3 1.5M8.5 16c2-1.8 5-1.8 7 0" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
  racer: '<path d="M4 18l5-12h6l5 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7 13h10" stroke="currentColor" stroke-width="2"/>',
  dark: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" fill="currentColor"/>',
  glitch: '<path d="M3 6h7v3H3zM12 6h9v3h-9zM6 11h12v3H6zM3 16h5v3H3zM10 16h11v3H10z" fill="currentColor"/>',
  fragile: '<path d="M12 2l3 7-4 3 5 4-3 6M12 2L9 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
};

// Fill color per CampaignEntity `type`, by size tier -- shared by
// campaignEntityColor() (board/particle/minimap color) and the goal-icon
// renderer below, so the HUD icon and the board object are always the same
// hue too. See campaignEntityColor() for the full "why size, not identity" rationale.
// Mirrors CAMPAIGN_TIERS' T1-T4 exactly (cyan/pink/gold/violet) so an
// object's eat-gate color always matches the growth-tier badge that
// unlocks it. T3 was green until player feedback that green and cyan
// fragments blurred together on the minimap -- gold is the palette hue
// farthest from both cyan and pink, so the four tiers are now spread
// roughly evenly around the color wheel.
const SIZE_TIER_COLORS = { 1: '#50F0FA', 2: '#FF54AD', 3: '#EFCB63', 4: '#9875FF', 5: '#CBD5E1', 6: '#46D99A' };

// Miasto's "Po 100% odblokujesz" reward chip (GDD 4.0 §5.1) needs an icon
// matching whichever Warsztat category CORE_CITY_LEVEL_REWARDS grants next
// -- full <svg> markup (not CARD_ICONS' bare <path>) since it's injected
// via innerHTML directly, not through the evolution-card template.
const REWARD_CATEGORY_ICONS = {
  skin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="7"/></svg>',
  aura: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/></svg>',
  effect: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  overdrive: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z"/></svg>',
  bundle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 9h18M12 9v12"/></svg>',
  bonus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

// Phase 4: Golden Shot evolution mutations — run-only, never sold or kept
// between rounds, so the ranked/daily leaderboard (once it exists) stays
// fair (GDD 4.1). desc kept to a few words per player feedback ("reduce
// the amount of text"); icon points into CARD_ICONS above.
// Player feedback ("nie rozumiem ewolucji... nie wiem co wybieram"):
// every card now has a plain-Polish name, a short tag saying WHEN it
// works, and a one-sentence `desc` with the real numbers from CONFIG --
// plus a looping demo (drawPowerDemo()) instead of a bare icon.
const MUTATIONS = [
  { id: 'magnet_pulse', name: 'Magnes', tag: 'CAŁĄ RUNDĘ', desc: 'Obiekty, które możesz zjeść, same lecą do Ciebie z bliskiej okolicy.', icon: 'magnet', weight: 3, color: '#50F0FA' },
  { id: 'slipstream', name: 'Turbo combo', tag: 'PO COMBO ×3', desc: 'Zjedz 3 rzeczy szybko po sobie, a dostaniesz +60% prędkości na 1,5 s.', icon: 'bolt', weight: 3, color: '#46D99A' },
  { id: 'phase_edge', name: 'Tarcza', tag: 'GDY CIĘ ZJEDZĄ', desc: 'Gdy rywal Cię pochłonie, po odrodzeniu masz 4 s ochrony zamiast 2 s.', icon: 'shield', weight: 2, color: '#9875FF' },
  { id: 'combo_reactor', name: 'Długie combo', tag: 'WIĘCEJ PUNKTÓW', desc: 'Między kolejnymi kęsami masz ok. 2,9 s zamiast 1,8 s, więc łatwiej trzymasz mnożnik punktów.', icon: 'clock', weight: 3, color: '#EFCB63' },
  { id: 'scanner', name: 'Skaner', tag: 'CO 4 S', desc: 'Co 4 s podświetla najcenniejszy obiekt na mapie — od razu widać, dokąd jechać.', icon: 'radar', weight: 2, color: '#50F0FA' },
  { id: 'shockwave', name: 'Fala', tag: 'NA NOWYM ROZMIARZE', desc: 'Gdy urośniesz o rozmiar, fala rozrzuca pobliskie obiekty na 140 px wokół Ciebie.', icon: 'burst', weight: 2, color: '#FF54AD' },
  { id: 'bounty_core', name: 'Łowca', tag: 'RYWALE', desc: 'Najbliższy rywal dostaje różowy celownik. Zjedz go, a zgarniesz +40 punktów ekstra.', icon: 'target', weight: 2, color: '#EFCB63' }
];

/* ----------------------- Campaign mode (GDD 3.1 / "Vector Hole v3") -----------------------
   A second, mission-driven game mode alongside the existing 120s Arena
   round. Per the GDD's own explicit scope call ("Najmniejszy zakres, który
   warto zbudować: jedna dzielnica, cztery misje... Pozostałe misje w tym
   dokumencie to plan rozszerzenia") the two districts actually authored
   with full mission text (Plac Neonów 01-04, Park Impulsów 05-08) are
   built; districts III-VI have no authored content in the GDD and stay a
   documented roadmap entry (see docs/GAME_DESIGN.md), matching how
   proceduralDistricts already stays a flag with no generator behind it.
   Campaign is intentionally a separate simulation from Arena (own entity
   list, own growth/tier model) so the already-tuned Arena/Daily/Ranked-
   adjacent economy in TIERS/CONFIG.eating is untouched. */

// GDD 07: growthUnits is a tier model independent of the old HUD's radius
// number. A tier threshold unlocks a *class* of eatable object; radius is
// still what drives rendering/eat-radius math (via Hole.growFromArea), but
// campaign missions gate eating and the landmark "big eat" off tier, not
// raw radius, so the numbers in the GDD table are reproduced here as-is.
// Tier badge colors: a full unique-per-tier set (player feedback: wanted
// one universal color per tier, not two tiers sharing a hue). T1-T3 reuse
// SIZE_TIER_COLORS' exact hexes (same cyan/pink/green used everywhere else
// for object-size tiers); T4 takes the palette's violet; T6 takes green
// (freed up when T3 moved to gold -- see SIZE_TIER_COLORS). T5 uses a metallic silver that isn't part of the
// core neon accent palette (asset_bible.svg's five hues are all spoken for
// by the other five tiers) -- a deliberate one-off addition for this
// six-way tier ladder, not a general-purpose palette color.
const CAMPAIGN_TIERS = [
  { id: 'T1', name: 'Fragmenty energii', minUnits: 0, color: '#50F0FA' },
  // "Ławki i pachołki" (old name) named an object -- pachołek -- that
  // doesn't actually exist in OBJECT_CATALOG_SPEC.md's 24-object catalog
  // (player feedback: eating a bench/lamp post/tree read as the HUD
  // claiming it was a "fragment", because this tier NAME is unrelated to
  // what was just eaten, it's just this growth checkpoint's flavor name --
  // renamed to the catalog's own "elementy uliczne" term for the T2 prop
  // tier, and updateCampaignHUD() now prefixes it with the tier id so it
  // reads as a tier badge, not an eaten-object label).
  { id: 'T2', name: 'Elementy uliczne', minUnits: 6, color: '#FF54AD' },
  // v10: every tier is named after the object class it unlocks.
  { id: 'T3', name: 'Pojazdy i węzły', minUnits: 22, color: '#EFCB63' },
  { id: 'T4', name: 'Pawilony i landmarki', minUnits: 50, color: '#9875FF' },
  { id: 'T5', name: 'Ciężkie pojazdy', minUnits: 100, color: '#CBD5E1' },
  { id: 'T6', name: 'Wieżowce', minUnits: 180, color: '#46D99A' }
];
// minUnits above are CONFIG.growth.unitAnchors (kept as literals for
// readability) -- fail loudly if the two ever drift apart.
CAMPAIGN_TIERS.forEach((t, i) => {
  if (t.minUnits !== CONFIG.growth.unitAnchors[i]) console.warn('CAMPAIGN_TIERS/CONFIG.growth mismatch at', t.id);
});

// growth/score/minimum-tier per campaign entity type (GDD 07: growth gain
// 1/3/6/10/18/32, base score 5/15/30/50/90/160 across the six tiers).
const CAMPAIGN_ENTITY_STATS = {
  fragment: { growth: 1, score: 5, minTier: 1, label: 'fragment' },
  prop: { growth: 3, score: 15, minTier: 2, label: 'element uliczny' },
  vehicle: { growth: 6, score: 30, minTier: 3, label: 'pojazd' },
  capsule: { growth: 3, score: 15, minTier: 1, label: 'kapsuła' },
  marker: { growth: 10, score: 50, minTier: 2, label: 'znacznik' },
  node: { growth: 10, score: 50, minTier: 3, label: 'węzeł' },
  pylon: { growth: 10, score: 50, minTier: 3, label: 'pylon' },
  landmark: { growth: 32, score: 160, minTier: 4, label: 'landmark' },
  structure: { growth: 16, score: 80, minTier: 4, label: 'pawilon' },
  heavy: { growth: 24, score: 120, minTier: 5, label: 'ciężki pojazd' },
  tower: { growth: 40, score: 200, minTier: 6, label: 'wieżowiec' },
  // v15: the fleeing golden byte -- tiny, but worth chasing.
  runner: { growth: 3, score: 60, minTier: 1, label: 'złoty bajt' }
};

// v10: each boss landmark is gated at its own tier (and sized/valued by
// CONFIG.campaign.landmarkByTier) -- an Iglica smaller than an ordinary
// T6 tower read as a contradiction.
const LANDMARK_TIERS = { kino: 4, fontanna: 4, dzwig: 5, galeria_glowna: 5, iglica_wejscie: 5, iglica: 6, rdzen_miasta_glowny: 6,
  stacja: 5, bazar_brama: 5, fabryka: 6, latarnia: 6, drzewo: 6, serwer: 6 };
const LANDMARK_ART = {
  kino: 'lm_kino', fontanna: 'lm_fontanna', dzwig: 'lm_dzwig', galeria_glowna: 'lm_galeria',
  iglica_wejscie: 'lm_iglica', iglica: 'lm_iglica', rdzen_miasta_glowny: 'lm_rdzen',
  stacja: 'lm_stacja', bazar_brama: 'lm_bazar', fabryka: 'lm_fabryka', latarnia: 'lm_latarnia', drzewo: 'lm_drzewo', serwer: 'lm_serwer'
};
// Accusative ("Pochłoń ...") names of each boss landmark.
const LANDMARK_NAMES = {
  kino: 'neonowe kino', fontanna: 'fontannę', dzwig: 'dźwig', galeria_glowna: 'galerię',
  iglica_wejscie: 'bramę iglicy', iglica: 'iglicę', rdzen_miasta_glowny: 'rdzeń miasta',
  stacja: 'Stację Centralną', bazar_brama: 'Bramę Bazaru', fabryka: 'Fabrykę Pikseli', latarnia: 'Latarnię Hologramów',
  drzewo: 'Drzewo Światła', serwer: 'Serwer Główny'
};
// v15: the name plate under every boss landmark (owner: the second
// district's tile had no name while Plac's Kino had a sign). Kino paints
// its own marquee, so it needs none.
const LANDMARK_SIGNS = {
  fontanna: 'FONTANNA', dzwig: 'DŹWIG', galeria_glowna: 'GALERIA', iglica_wejscie: 'BRAMA IGLICY', iglica: 'IGLICA',
  rdzen_miasta_glowny: 'RDZEŃ', stacja: 'STACJA', bazar_brama: 'BAZAR', fabryka: 'FABRYKA', latarnia: 'LATARNIA',
  drzewo: 'DRZEWO', serwer: 'SERWER'
};

// Per-mission visual glyph tables (mission-screen brief, Task 1): several
// CampaignEntity `type`s are reused across multiple missions with different
// GDD object names (e.g. 'marker' covers znacznik ogrodu/paleta/kryształ/
// witryna/klucz sektora/emiter). `glyph` started as a purely visual tag,
// but checkCampaignGoal() also reads it now (via computeCampaignGoalGlyph())
// so a mission naming one specific object only counts progress from that
// object, not any other same-`type` entity.
// The catalog's "ogólne" (not tied to one mission) T2/T3 street objects --
// latarnia/ławka/drzewo/kiosk, exactly the 4 rows OBJECT_CATALOG_SPEC.md's
// master table lists as "ogólny" (a 5th, "pachołek", was in here before but
// isn't an object the catalog actually defines -- player feedback: it read
// as an unlisted/made-up pickup). Every generic 'prop' spawn without a
// fixed PROP_GLYPHS entry (M09/M17) picks one of these at random per
// instance for street-scene variety.
const PROP_STREET_GLYPHS = ['latarnia', 'lawka', 'drzewo', 'kiosk'];
function randomStreetGlyph() { return PROP_STREET_GLYPHS[randInt(0, PROP_STREET_GLYPHS.length - 1)]; }

// The GDD's "four powers are enough for the first test" (§08): a small,
// campaign-only, run-only power pool distinct from Arena's 7-mutation
// MUTATIONS pool above (kept untouched so Arena's already-tuned balance
// doesn't shift). Exact numbers per GDD §08.
const CAMPAIGN_POWERS = [
  { id: 'magnes', name: 'Magnes', tag: 'CAŁĄ MISJĘ', desc: 'Obiekty, które możesz zjeść, same płyną do Ciebie, gdy są blisko.', icon: 'magnet', color: '#50F0FA' },
  { id: 'reaktor', name: 'Długie combo', tag: 'WIĘCEJ PUNKTÓW', desc: 'Między kęsami masz 2,1 s zamiast 1,5 s, więc łatwiej trzymasz mnożnik punktów.', icon: 'clock', color: '#EFCB63' },
  { id: 'impuls', name: 'Impuls', tag: 'NA NOWYM ROZMIARZE', desc: 'Za każdym razem, gdy urośniesz o rozmiar, dostajesz +20% prędkości na 2 s.', icon: 'bolt', color: '#46D99A' },
  { id: 'skaner', name: 'Skaner', tag: 'CO 8 S', desc: 'Co 8 s podświetla najbliższy obiekt — od razu widać, dokąd jechać.', icon: 'radar', color: '#9875FF' }
];

// Hub district map. GDD 4.0 §6 authors the full 24-mission campaign (all
// six districts); each district unlocks off the previous one's mission 4
// reward (see CAMPAIGN_MISSIONS' reward.unlockDistrict), so `locked` here
// only ever matters for a fresh save before Plac Neonów is cleared.
const DISTRICTS = [
  // M00 is a prologue tutorial (see CAMPAIGN_MISSIONS), not one of the
  // GDD's 24 authored missions -- Plac Neonów has 5 entries here instead
  // of the usual 4 per district so it can sit first without renumbering
  // M01-M24 or their district arrays.
  // v10: 10 missions per district (Plac Neonów also opens with M00); the
  // district boss (unlocking the next district) is always the last one.
  { id: 'plac', name: 'Plac Neonów', order: 1, missions: ['M00', 'M01', 'M02', 'M03', 'M25', 'M26', 'M27', 'M28', 'M29', 'M30', 'M04'] },
  { id: 'park', name: 'Park Impulsów', order: 2, missions: ['M05', 'M06', 'M07', 'M31', 'M32', 'M33', 'M34', 'M35', 'M36', 'M08'] },
  { id: 'port', name: 'Port Syntez', order: 3, missions: ['M09', 'M10', 'M11', 'M37', 'M38', 'M39', 'M40', 'M41', 'M42', 'M12'] },
  { id: 'galeria', name: 'Galeria Glitch', order: 4, missions: ['M13', 'M14', 'M15', 'M43', 'M44', 'M45', 'M46', 'M47', 'M48', 'M16'] },
  { id: 'dachy', name: 'Dachy Prądu', order: 5, missions: ['M17', 'M18', 'M19', 'M49', 'M50', 'M51', 'M52', 'M53', 'M54', 'M20'] },
  { id: 'rdzen', name: 'Rdzeń Miasta', order: 6, missions: ['M21', 'M22', 'M23', 'M55', 'M56', 'M57', 'M58', 'M59', 'M60', 'M24'] }
];

// v15 "Rozdział II: Głęboki Glitch" -- six more districts, 30 missions
// each, authored as compact rows the same compiler turns into missions:
//   [name, steps, twists, diff, nela?]
// steps: e:TYPE:N[:GLYPH] eat · b:N golden bytes · t:K tier · c:N combo ·
//   g:N gates · r:N rivals · a:node|pylon:N[:GLYPH] activate · L:ID boss ·
//   s:N score
// twists: H<n> hunters · R racer · D dark · Z<n> glitch zones · F fragile ·
//   P pas gates · O portal · W capsule waves · A arc layout · B<n> rival radius
// NELA speaks the district's flavor line, and explains a twist the first
// time it shows up in the district.
const CHAPTER_II = [
  {
    id: 'metro', name: 'Tunele Metra', color: '#2BCBDD', floor: 'rdzen', boss: 'stacja',
    won: 'Tunele Metra odzyskane! Nocny Bazar czeka.',
    story: 'Glitch uciekł pod ziemię. W tunelach metra gasną światła, a puste składy wożą skażony kod. Zejdź na dół i przywróć ruch.',
    flavor: ['Pod ziemią słychać tylko szum pustych składów.', 'Peron migocze — Glitch przestawił rozkład jazdy.', 'Tory iskrzą skażonym kodem.', 'Tu nikt nie czeka na pociąg. Tylko Ty i Glitch.',
      'Echo w tunelu niesie się daleko. Glitch też je słyszy.', 'Kolejna stacja do odzyskania.', 'W metrze liczy się każda sekunda.', 'Głębiej pod miastem, bliżej źródła Glitcha.'],
    success: ['Pociągi znów jadą.', 'Stacja odzyskana.', 'Tunel świeci jak nowy.', 'Rozkład jazdy wrócił do normy.', 'Słyszysz? To prawdziwy pociąg.', 'Kolejna linia czysta.'],
    rows: [
      ['Ostatni kurs', 'e:fragment:12 t:2', 'D', 2],
      ['Złote bajty', 'b:3', '', 2],
      ['Peron w mroku', 'e:prop:8 t:3', 'D', 3],
      ['Rozkład jazdy', 'e:vehicle:5', '', 2],
      ['Pościg w tunelu', 'b:5', 'D', 3],
      ['Kontrola biletów', 'r:2', 'H2', 3],
      ['Iskry na torach', 'c:10 e:prop:5', '', 2],
      ['Skład widmo', 'e:heavy:1:tramwaj', 'D', 3],
      ['Szczur danych', 'b:6 t:3', 'H1', 4],
      ['Zwrotnice', 'a:node:4:zasilacz e:vehicle:3', '', 3],
      ['Tunel serwisowy', 'e:structure:3:magazyn', 'D', 3],
      ['Nocny przejazd', 'g:3', 'P', 3],
      ['Wagon z bajtami', 'b:4 e:vehicle:4', 'D', 4],
      ['Konduktorzy', 'r:3', 'H3 B40', 3],
      ['Rozjazd', 'c:12 b:3', '', 4],
      ['Głębokie perony', 'e:heavy:2:tramwaj', 'D', 4],
      ['Iskrownik', 'a:pylon:4', 'Z2', 3],
      ['Ślepy tor', 'e:structure:2 b:4', 'D', 4],
      ['Godzina zero', 's:2200', '', 4],
      ['Pociąg towarowy', 'e:heavy:3:tramwaj', '', 3],
      ['Awaria sieci', 'a:node:5', 'D Z2', 4],
      ['Ucieczka z zajezdni', 'b:7', 'H2', 4],
      ['Ciemna linia', 't:5 e:heavy:1:tramwaj', 'D H2', 5],
      ['Bez świateł', 'e:prop:10 c:8', 'D', 4],
      ['Kontrolerzy w mroku', 'r:3', 'D H3 B45', 4],
      ['Wieżowiec nad tunelem', 'e:tower:1:wiezowiec', '', 4],
      ['Linia zero', 'c:16 e:heavy:1', 'F', 5],
      ['Zasilanie trakcji', 'a:node:4:zasilacz e:structure:2', 'D', 4],
      ['Ekspres bajtów', 'b:8 s:1500', 'Z2', 4],
      ['Stacja Centralna', 'a:node:3:zasilacz L:stacja', 'D H2', 5,
        'Stacja Centralna — serce metra. Po ciemku zbierz trzy zasilacze, uciekaj przed łowcami i pochłoń całą stację (T5).']
    ]
  },
  {
    id: 'bazar', name: 'Nocny Bazar', color: '#EFCB63', floor: 'plac', boss: 'bazar_brama',
    won: 'Nocny Bazar odzyskany! Fabryka Pikseli czeka.',
    story: 'Nocny Bazar nigdy nie śpi. Glitch handluje tu skradzioną energią, a jego Złodziej zgarnia wszystko, czego nie zgarniesz przed nim.',
    flavor: ['Między kramami pachnie ozonem i skażonym neonem.', 'Bazar tętni — a Glitch liczy zyski.', 'Kto pierwszy, ten lepszy. Tak działa ten bazar.', 'Lampiony mrugają w rytm skażonego kodu.',
      'Kolejna alejka do odzyskania.', 'Tu wszystko ma cenę. Glitch płaci skradzioną energią.', 'Tłum kramów, a w nim Twój cel.', 'Ceny szaleją, a energia ucieka.'],
    success: ['Kramy znów świecą uczciwym światłem.', 'Alejka odzyskana.', 'Bazar wraca do życia.', 'Kupcy znów się uśmiechają.', 'Najlepszy interes tej nocy.', 'Energia wróciła do miasta.'],
    rows: [
      ['Pierwszy targ', 'e:capsule:10', 'R', 2],
      ['Kramy', 'e:prop:8:kiosk', '', 2],
      ['Złodziej kapsuł', 'e:capsule:12', 'R', 3],
      ['Tłum w alejce', 'c:12 e:prop:6:kiosk', '', 2],
      ['Złoty interes', 'b:4', 'R', 3],
      ['Lampiony', 'e:prop:8:latarnia', '', 2],
      ['Targowanie', 's:1200', '', 3],
      ['Fala klientów', 'e:capsule:16 c:8', 'W', 3],
      ['Kieszonkowiec', 'e:prop:10', 'R H1', 4],
      ['Stragan z autami', 'e:vehicle:6', '', 3],
      ['Nocne pawilony', 'e:structure:3:pawilon', '', 3],
      ['Wyścig o lampiony', 'e:prop:8:latarnia', 'R', 4],
      ['Bazarowe combo', 'c:15 e:vehicle:4', '', 3],
      ['Ochroniarze', 'r:3', 'H3 B40', 4],
      ['Hurtownia', 'e:structure:4:magazyn', 'Z2', 4],
      ['Gorący towar', 'b:6', 'Z2', 4],
      ['Kontrabanda', 'e:heavy:2:ciezarowka', '', 3],
      ['Złodziej aut', 'e:vehicle:6', 'R', 4],
      ['Licytacja', 's:2500', '', 4],
      ['Labirynt kramów', 'e:prop:12 c:10', 'Z3', 4],
      ['Szybka sprzedaż', 'e:capsule:14', 'R', 4],
      ['Ciemna strona bazaru', 'e:marker:6', 'R Z1', 5],
      ['Złote godziny', 'b:6 s:1500', '', 4],
      ['Mistrzowie handlu', 'r:4', 'H3 B50', 5],
      ['Magazyn nocny', 'e:heavy:3', 'D', 4],
      ['Bez straty', 'e:prop:12', 'F Z1', 4],
      ['Wielka dostawa', 'e:tower:1:wiezowiec e:heavy:1', '', 4],
      ['Złodziej bajtów', 'b:6', 'R H1', 5],
      ['Bazar w ogniu', 'c:18 s:2000', 'Z2', 5],
      ['Brama Bazaru', 'a:pylon:4 L:bazar_brama', 'H2 Z2', 5,
        'Brama Bazaru trzyma cały handel Glitcha. Naładuj cztery pylony, omijaj strefy i łowców, a potem pochłoń bramę (T5).']
    ]
  },
  {
    id: 'fabryka', name: 'Fabryka Pikseli', color: '#FF54AD', floor: 'port', boss: 'fabryka',
    won: 'Fabryka Pikseli odzyskana! Zatoka Hologramów czeka.',
    story: 'W Fabryce Pikseli Glitch produkuje sam siebie. Hale pełne są stref skażenia, a nadzorcy pilnują taśm. Zatrzymaj produkcję.',
    flavor: ['Taśmy jadą, prasy biją, Glitch rośnie.', 'Hala huczy skażonym kodem.', 'Tu powstają nowe kawałki Glitcha.', 'Uważaj — podłoga iskrzy.',
      'Kolejna linia produkcyjna do zatrzymania.', 'Hala nie lubi gości.', 'Każdy piksel tutaj to skażenie.', 'Fabryka pracuje na trzy zmiany. Ty na jedną, ale lepiej.'],
    success: ['Taśma zatrzymana.', 'Hala ucichła.', 'Produkcja Glitcha spada.', 'Kolejna linia czysta.', 'Fabryka traci moc.', 'Maszyny cichną jedna po drugiej.'],
    rows: [
      ['Brama fabryki', 'e:prop:8 t:3', 'Z1', 3],
      ['Taśmociąg', 'c:12 e:prop:8:skrzynia', 'Z2', 3],
      ['Pikselowe skrzynie', 'e:prop:10:skrzynia', 'Z2', 3],
      ['Nadzorcy', 'r:2', 'H2', 3],
      ['Hala montażowa', 'e:vehicle:6', 'Z3', 3],
      ['Wadliwa partia', 'e:marker:6', 'Z2 H1', 4],
      ['Wózki widłowe', 'e:heavy:2:ciezarowka', '', 3],
      ['Prasa', 'a:node:4:zasilacz', 'Z3', 4],
      ['Iskry spawalnicze', 'c:14 e:prop:6', 'Z2', 4],
      ['Magazyn części', 'e:structure:4:magazyn', 'H2', 4],
      ['Kontrola jakości', 's:2500', 'Z2', 4],
      ['Linia produkcyjna', 'e:heavy:3', 'Z3', 4],
      ['Przegrzanie', 'a:pylon:4', 'Z4', 4],
      ['Brygadziści', 'r:3', 'H3 B50', 4],
      ['Złoty prototyp', 'b:5', 'Z3', 4],
      ['Komin', 'e:tower:1:maszt', 'H1', 4],
      ['Bez awarii', 'e:vehicle:8', 'F', 4],
      ['Nocna zmiana w hali', 'e:structure:3', 'D Z2', 5],
      ['Reaktor pikseli', 't:6', 'Z3', 4],
      ['Roboty', 'r:4', 'H4 B45', 5],
      ['Rozdzielnia', 'a:node:5:zasilacz e:heavy:1', 'Z2', 4],
      ['Hala zero', 'e:heavy:4', 'H2', 5],
      ['Złomowisko', 'e:structure:5', 'Z4', 5],
      ['Precyzja', 'c:16 e:vehicle:5', 'F Z2', 5],
      ['Wieże chłodnicze', 'e:tower:2:maszt', 'Z3', 5],
      ['Awaria w hali', 's:3000', 'D H2', 5],
      ['Wielki piec', 'e:heavy:3 e:tower:1', 'Z2', 4],
      ['Zmiana kierownika', 'r:4', 'H3 B60', 5],
      ['Ostatnia partia', 'e:tower:3', 'H2 Z2', 5],
      ['Serce fabryki', 'a:node:4:zasilacz L:fabryka', 'H2 Z3', 5,
        'Serce fabryki bije Glitchem. Zbierz cztery zasilacze między strefami, urośnij do T6 i pochłoń całą fabrykę.']
    ]
  },
  {
    id: 'zatoka', name: 'Zatoka Hologramów', color: '#9875FF', floor: 'galeria', boss: 'latarnia',
    won: 'Zatoka Hologramów odzyskana! Wiszące Ogrody czekają.',
    story: 'Zatoka Hologramów to morze światła i portali. Glitch ukrywa tu złote bajty w mgle i rozstawia na wodzie swoje latarnie.',
    flavor: ['Hologramowe fale biją o nabrzeże.', 'Mgła nad zatoką gęstnieje.', 'Na wodzie migoczą hologramy.', 'Portale otwierają się i gasną jak fale.',
      'Zatoka pamięta czasy przed Glitchem.', 'Kolejny brzeg do odzyskania.', 'Tu łatwo zgubić kierunek. Ufaj strzałce.', 'Przypływ niesie skażony kod.'],
    success: ['Zatoka się uspokaja.', 'Fale znów są czyste.', 'Mgła opadła.', 'Kolejny brzeg odzyskany.', 'Latarnie świecą dla Ciebie.', 'Hologramy wracają do normy.'],
    rows: [
      ['Hologramowe molo', 'g:1 e:marker:6:krysztal', 'O', 3],
      ['Fale', 'e:capsule:16', 'W', 3],
      ['Latarnie na wodzie', 'g:3', '', 2],
      ['Złote ryby', 'b:5', '', 3],
      ['Mgła', 'e:prop:10 t:3', 'D', 3],
      ['Port widm', 'e:heavy:2:ciezarowka', '', 3],
      ['Pasy przelotu', 'g:4', 'P', 3],
      ['Rafa danych', 'b:5 e:marker:6:krysztal', 'Z2', 4],
      ['Przypływ', 'c:14 e:capsule:10', 'W', 2],
      ['Hologramowi strażnicy', 'r:3', 'H3 B45', 4],
      ['Mgła nad zatoką', 'b:5', 'D', 4],
      ['Lustra na wodzie', 'a:pylon:4:lustro', '', 3],
      ['Odbicia', 'a:pylon:5:lustro e:structure:2', 'D', 4],
      ['Rejs nocny', 'g:5', 'P', 3],
      ['Skarb zatoki', 'b:6 e:structure:2', 'H1', 4],
      ['Statek widmo', 'e:heavy:3', 'D', 4],
      ['Prądy', 'c:16 b:4', 'Z2', 4],
      ['Latarnicy', 'r:4', 'H3 B50', 5],
      ['Drugi brzeg', 'g:1 e:marker:8:krysztal', 'O D', 5],
      ['Morze bajtów', 'b:8', '', 4],
      ['Sztorm', 's:3000', 'Z3', 5],
      ['Głębina', 'e:tower:2', 'D', 5],
      ['Fale glitcha', 'e:capsule:18', 'W Z3', 5],
      ['Rejs bez kolizji', 'g:4', 'P F Z1', 4],
      ['Piraci', 'r:4', 'H4 B55', 5],
      ['Zatopiony magazyn', 'e:structure:5:magazyn', 'D', 5],
      ['Hologramowy horyzont', 't:6', 'D', 4],
      ['Wyścig łodzi', 'e:marker:8:krysztal', 'R', 5],
      ['Ostatni sztorm', 'e:tower:2 s:2500', 'Z3', 5],
      ['Latarnia Hologramów', 'a:pylon:4:lustro L:latarnia', 'D H2', 5,
        'Latarnia Hologramów wyssała światło z całej zatoki. W ciemności aktywuj cztery lustra, unikaj łowców i pochłoń latarnię (T6).']
    ]
  },
  {
    id: 'ogrody', name: 'Wiszące Ogrody', color: '#46D99A', floor: 'park', boss: 'drzewo',
    won: 'Wiszące Ogrody odzyskane! Chmura Danych czeka.',
    story: 'Wiszące Ogrody unoszą się nad miastem na kruchych tarasach. Tu nie ma miejsca na błąd: jedno złe zderzenie i cały ogród spada.',
    flavor: ['Tarasy kołyszą się nad miastem.', 'Kwiaty świecą skażonym światłem.', 'W ogrodach liczy się precyzja.', 'Wiatr niesie pyłek Glitcha.',
      'Kolejny taras do odzyskania.', 'Każda ścieżka prowadzi wyżej.', 'Tarasy pamiętają każdy ruch.', 'Ostrożnie — pod tarasem jest tylko powietrze.'],
    success: ['Ogród rozkwita.', 'Taras odzyskany.', 'Kwiaty świecą czystym światłem.', 'Ani jednego złamanego płatka.', 'Ogrody znów oddychają.', 'Pyłek Glitcha opadł.'],
    rows: [
      ['Wejście do ogrodów', 'e:prop:10:drzewo', '', 3],
      ['Delikatne pąki', 'e:capsule:12', 'F Z1', 3],
      ['Furtki ogrodu', 'g:4', '', 3],
      ['Rytm kwiatów', 'c:16 e:prop:8:drzewo', '', 3],
      ['Ścieżka bez błędu', 'e:prop:10', 'F H1', 4],
      ['Zaczarowane latarnie', 'e:prop:8:latarnia c:10', '', 3],
      ['Złote nasiona', 'b:6', 'F Z1', 4],
      ['Ogrodnicy', 'r:3', 'H3 B50', 4],
      ['Altany', 'e:structure:4:pawilon', '', 4],
      ['Kwietne pylony', 'a:pylon:5', 'F', 4],
      ['Wiszące mosty', 'a:node:3:mostek e:structure:2', '', 4],
      ['Szklarnia', 'e:heavy:2', 'Z2', 4],
      ['Pnącza', 'c:18 e:structure:2', 'F', 5],
      ['Ogród nocą', 'e:prop:12:latarnia', 'D', 4],
      ['Kolibry', 'b:8', 'H1', 5],
      ['Taras', 't:5', 'F', 4],
      ['Bramy wiatru', 'g:5', 'F Z1', 3],
      ['Strażnicy ogrodów', 'r:4', 'H4 B50', 5],
      ['Kaskady', 'e:capsule:20 c:12', 'W', 4],
      ['Kwitnące wieże', 'e:tower:1:wiezowiec', 'F', 5],
      ['Pyłek glitcha', 'e:structure:4', 'Z4', 5],
      ['Złoty ogród', 'b:7 s:1800', 'F', 5],
      ['Mgła w ogrodzie', 'e:heavy:3', 'D H2', 5],
      ['Ogrodowy rekord', 's:3500', '', 5],
      ['Wiszące tarasy', 'e:tower:2', 'F Z2', 5],
      ['Bez jednego płatka', 'c:20 b:5', 'F Z1', 5],
      ['Ogrodnicy nocy', 'r:3 b:4', 'D H2 B45', 5],
      ['Lustrzana sadzawka', 'a:pylon:5:lustro e:tower:1', '', 5],
      ['Ostatni rozkwit', 't:6 e:heavy:2', 'F H2', 5],
      ['Drzewo Światła', 'a:pylon:4 L:drzewo', 'F H2', 5,
        'Drzewo Światła trzyma ogrody w powietrzu. Kruchy wir i łowca na ogonie: naładuj cztery pylony bez jednego zderzenia i pochłoń drzewo (T6).']
    ]
  },
  {
    id: 'chmura', name: 'Chmura Danych', color: '#C6D5E3', floor: 'dachy', boss: 'serwer',
    story: 'Ostatnia kryjówka Glitcha: Chmura Danych nad miastem. Tu zebrał wszystko, czego się nauczył. Ostatnia bitwa o Neonowe Miasto.',
    flavor: ['Chmura pulsuje skradzionymi danymi.', 'Glitch zna już wszystkie Twoje sztuczki.', 'Serwery szumią jak burza.', 'Każdy pakiet tutaj to kawałek miasta.',
      'Jeszcze jeden sektor bliżej Serwera Głównego.', 'Tu Glitch jest najsilniejszy.', 'Dane płyną szybciej, niż widać.', 'Ostatnie piętra chmury.'],
    success: ['Sektor odszyfrowany.', 'Dane wracają do miasta.', 'Chmura rzednie.', 'Glitch traci kolejny serwer.', 'Transfer zakończony.', 'Jeszcze bliżej rdzenia chmury.'],
    rows: [
      ['Logowanie', 'e:capsule:14 c:10', 'R', 4],
      ['Pakiety', 'b:7', 'Z2', 4],
      ['Zapora ogniowa', 'g:4', 'P Z2', 4],
      ['Kopia zapasowa', 'e:structure:4', 'D', 4],
      ['Antywirusy', 'r:3', 'H3 B55', 4],
      ['Bufor', 's:3000', 'H2', 5],
      ['Przeciążenie', 'a:node:5:zasilacz', 'Z4', 4],
      ['Wyciek danych', 'e:marker:6', 'R Z1', 5],
      ['Chmura burzowa', 'e:heavy:3', 'Z3 H1', 5],
      ['Szyfr', 'c:20 e:heavy:1', 'F', 5],
      ['Serwery lustrzane', 'a:pylon:6:lustro', 'D', 5],
      ['Złote klucze', 'b:8', 'H2', 5],
      ['Zapora', 'g:5 b:3', 'P F Z1', 4],
      ['Administratorzy', 'r:4', 'H4 B55', 5],
      ['Wielka migracja', 'e:tower:2', 'Z3', 5],
      ['Ciemny sektor', 'e:structure:5', 'D H2', 5],
      ['Pakiet zero', 'e:capsule:18', 'W Z2', 5],
      ['Bezbłędny transfer', 'e:vehicle:10', 'F Z2', 5],
      ['Rekord chmury', 's:4000', 'Z2', 5],
      ['Rdzeń danych', 't:6', 'D H2', 5],
      ['Szybki bajt', 'b:8', 'R', 5],
      ['Burza pakietów', 'c:20 e:heavy:2', 'Z3', 5],
      ['Główny router', 'a:node:5:zasilacz e:tower:1', 'D', 5],
      ['Strażnicy chmury', 'r:5', 'H4 B60', 5],
      ['Ciemna chmura', 'e:tower:3', 'D Z2', 5],
      ['Ostatni pakiet', 'b:8 e:structure:3', 'F', 5],
      ['Pełna synchronizacja', 'e:tower:2 s:3000', 'H1 Z2', 5],
      ['Kaskada serwerów', 'e:heavy:4 e:tower:2', 'H2', 5],
      ['Przed restartem', 'c:22 t:6', 'D', 5],
      ['Serwer Główny', 'a:node:4:zasilacz L:serwer', 'D H3 Z3', 5,
        'To tu Glitch się narodził. W ciemności, między strefami i łowcami, zbierz cztery zasilacze i pochłoń Serwer Główny. Neonowe Miasto czeka.']
    ]
  }
];

// v15 review: "some very hard", not most -- at most this many EKSTREMALNA
// missions per district (the boss and the latest rows keep it; the rest
// become BARDZO TRUDNA).
const EXTREME_CAP = { metro: 3, bazar: 4, fabryka: 5, zatoka: 5, ogrody: 6, chmura: 10 };

/** Parses CHAPTER_II rows into MISSION_SPECS entries (ids M61 onward). */
function chapterTwoSpecs() {
  const specs = [];
  let n = 61;
  CHAPTER_II.forEach((dist, di) => {
    let extremes = 0;
    const diffs = dist.rows.map(r => r[3]).reverse().map(d => (d === 5 && ++extremes > (EXTREME_CAP[dist.id] || 5)) ? 4 : d).reverse();
    dist.rows.forEach((row, i) => {
      const [name, stepStr, twistStr, , nelaText] = row;
      const diff = diffs[i];
      const steps = stepStr.split(' ').filter(Boolean).map(tok => {
        const p = tok.split(':');
        switch (p[0]) {
          case 'e': return p[3] ? { eat: p[1], n: +p[2], glyph: p[3] } : { eat: p[1], n: +p[2] };
          case 'b': return { eat: 'runner', n: +p[1] };
          case 't': return { tier: +p[1] };
          case 'c': return { combo: +p[1] };
          case 'g': return { gates: +p[1] };
          case 'r': return { rival: +p[1] };
          case 'a': return { activate: p[1], n: +p[2], glyph: p[3] };
          case 'L': return { landmark: p[1] };
          case 's': return { score: +p[1] };
        }
        throw new Error('Bad mission step ' + tok);
      });
      const setup = {};
      steps.forEach(st => {
        if (st.activate && st.glyph) setup[st.activate === 'node' ? 'nodeGlyph' : 'pylonGlyph'] = st.glyph;
        if (st.activate) delete st.glyph;
      });
      twistStr.split(' ').filter(Boolean).forEach(tok => {
        const k = tok[0], v = tok.slice(1);
        if (k === 'H') setup.hunters = +v || 1;
        else if (k === 'R') setup.racer = true;
        else if (k === 'D') setup.dark = true;
        else if (k === 'Z') setup.glitch = +v || 1;
        else if (k === 'F') setup.fragile = true;
        else if (k === 'P') setup.gateKind = 'pas';
        else if (k === 'O') setup.gateKind = 'portal';
        else if (k === 'A') setup.arcLayout = true;
        else if (k === 'B') setup.botRadius = +v;
        else if (k === 'W') {
          const cap = steps.find(st => st.eat === 'capsule');
          const waves = 3;
          setup.capsuleWaves = [0, 15, 30];
          setup.capsulesPerWave = Math.ceil(((cap ? cap.n : 16) * 1.35) / waves);
        }
      });
      if (!setup.gateKind && steps.some(st => st.gates)) setup.gateKind = 'brama';
      // NELA: the district's flavor line, plus the hint for a twist the
      // first time it appears in this district.
      const twists = ['hunters', 'racer', 'dark', 'glitch', 'fragile'].filter(t => setup[t]);
      if (steps.some(st => st.eat === 'runner')) twists.push('runner');
      // (the twist hints themselves are listed in the briefing and on the
      // start card -- repeating them here doubled the text)
      const start = nelaText || dist.flavor[i % dist.flavor.length];
      const isBoss = i === dist.rows.length - 1;
      const next = CHAPTER_II[di + 1];
      const spec = {
        id: `M${n++}`, d: dist.id, diff, name, steps, setup,
        nela: [start, isBoss ? (next ? dist.won : 'Serwer Główny pochłonięty. Glitch zniknął z Neonowego Miasta — na dobre.') : dist.success[i % dist.success.length]]
      };
      if (isBoss) {
        spec.medal = { type: 'noBotHit', label: 'Ukończ bez zderzenia z większym rywalem' };
        spec.reward = next ? { coins: 300 + di * 60, unlockDistrict: next.id } : { coins: 1200 };
      }
      specs.push(spec);
    });
  });
  return specs;
}

// Rozdział II districts join the strip after Rdzeń Miasta (ids M61+, in
// row order -- chapterTwoSpecs() hands out the same ids).
(() => {
  let n = 61;
  CHAPTER_II.forEach((d, i) => {
    DISTRICTS.push({ id: d.id, name: d.name, order: 7 + i, chapter: 2, missions: d.rows.map(() => `M${n++}`) });
  });
})();


// v14 story: each district's situation in NELA's words, shown as her speech
// bubble on top of the district's missions (player feedback: the story
// lines were grey italics nobody noticed).
const DISTRICT_STORY = {
  plac: 'Plac Neonów był sercem nocnego miasta. Glitch zgasił neony i zamienił wszystko w zepsuty kod. Pochłoń skażenie, a światła wrócą.',
  park: 'W Parku Impulsów bramy zgubiły rytm, a fontanna pompuje szum zamiast wody. Wyczuj puls parku i odzyskaj fontannę.',
  port: 'Port Syntez stoi w korku skażonych ciężarówek, a nad wszystkim góruje Dźwig. Urośnij tak, żeby zmieścić go w sobie.',
  galeria: 'Galeria Glitch to labirynt witryn i portali. Tu nic nie jest tym, czym się wydaje. Trzymaj się celu.',
  dachy: 'Nad miastem iskrzą Dachy Prądu. Iglica ładuje Glitch energią całej sieci. Przeleć pasami i ją wyłącz.',
  rdzen: 'Rdzeń Miasta. Stąd Glitch steruje wszystkim. Pochłoń Rdzeń, a Neonowe Miasto znów zaświeci.'
};
CHAPTER_II.forEach(d => { DISTRICT_STORY[d.id] = d.story; });

// v14: NELA's face -- a hexagonal city-AI lens (inline SVG, no image files),
// dropped into every .nela-avatar slot (district story, briefings, results,
// the in-mission toast).
const NELA_AVATAR = '<svg viewBox="0 0 48 48"><path d="M24 3 42.2 13.5v21L24 45 5.8 34.5v-21z" fill="#0A2032" stroke="#FF54AD" stroke-width="2.4" stroke-linejoin="round"/>' +
  '<path d="M24 8.5 37.4 16.2v15.6L24 39.5 10.6 31.8V16.2z" fill="none" stroke="#9875FF" stroke-width="1.2" opacity="0.7"/>' +
  '<g class="nela-eye"><circle cx="24" cy="24" r="8.6" fill="none" stroke="#50F0FA" stroke-width="2" opacity="0.55"/>' +
  '<circle cx="24" cy="24" r="5.4" fill="#50F0FA"/><circle cx="24" cy="24" r="2.2" fill="#04101D"/><circle cx="25.8" cy="22.2" r="1" fill="#fff"/></g>' +
  '<path d="M12.5 24h3.2M32.3 24h3.2" stroke="#FF54AD" stroke-width="2" stroke-linecap="round"/></svg>';

/* ----------------------- Mission compiler (v10) -----------------------
   Player feedback: missions didn't match the growth model (e.g. "eat 12
   fragments" while the hole outgrew fragments after 6), and there were too
   few of them. Every mission is now authored as a short list of OBJECTIVES
   (all required, any order) and compileMission() derives everything else
   from those steps and the shared growth curve:
   - the board layout: the goal objects (+ a ~30% buffer) PLUS a "growth
     ladder" of food for every tier the goals require (enough fragments to
     reach T2, street elements to reach T3, ... with a 60% buffer), so the
     player can always grow into what the mission asks for;
   - the time limit and the default time medal, from an estimate of how
     many eats/actions the steps need (checked by an automated playthrough
     of every mission -- see docs/GAME_DESIGN.md);
   - Polish step labels with correct plural forms.
   Step shapes: {eat, n, glyph?} {tier} {combo} {gates} {rival}
   {activate: 'node'|'pylon', n} {landmark} {score}. */

/** Polish noun forms [1, 2-4, 5+] (accusative after "Pochłoń"). */
const NOUNS = {
  fragment: ['fragment energii', 'fragmenty energii', 'fragmentów energii'],
  capsule: ['kapsułę', 'kapsuły', 'kapsuł'],
  prop: ['element uliczny', 'elementy uliczne', 'elementów ulicznych'],
  vehicle: ['samochód', 'samochody', 'samochodów'],
  marker: ['znacznik', 'znaczniki', 'znaczników'],
  node: ['węzeł', 'węzły', 'węzłów'],
  pylon: ['pylon', 'pylony', 'pylonów'],
  structure: ['budowlę', 'budowle', 'budowli'],
  heavy: ['ciężki pojazd', 'ciężkie pojazdy', 'ciężkich pojazdów'],
  tower: ['wieżę', 'wieże', 'wież'],
  skrzynia: ['skrzynię', 'skrzynie', 'skrzyń'],
  modul_dachowy: ['moduł dachowy', 'moduły dachowe', 'modułów dachowych'],
  znacznik_ogrodu: ['znacznik ogrodu', 'znaczniki ogrodu', 'znaczników ogrodu'],
  paleta: ['oznaczoną paletę', 'oznaczone palety', 'oznaczonych palet'],
  krysztal: ['kryształ', 'kryształy', 'kryształów'],
  witryna: ['witrynę', 'witryny', 'witryn'],
  klucz_sektora: ['klucz sektora', 'klucze sektorów', 'kluczy sektorów'],
  emiter: ['emiter', 'emitery', 'emiterów'],
  konwoj: ['pojazd konwoju', 'pojazdy konwoju', 'pojazdów konwoju'],
  pawilon: ['pawilon', 'pawilony', 'pawilonów'],
  billboard: ['billboard', 'billboardy', 'billboardów'],
  magazyn: ['magazyn', 'magazyny', 'magazynów'],
  autobus: ['autobus', 'autobusy', 'autobusów'],
  tramwaj: ['tramwaj', 'tramwaje', 'tramwajów'],
  ciezarowka: ['ciężarówkę', 'ciężarówki', 'ciężarówek'],
  wiezowiec: ['wieżowiec', 'wieżowce', 'wieżowców'],
  maszt: ['maszt', 'maszty', 'masztów'],
  kopula: ['kopułę', 'kopuły', 'kopuł'],
  wezel: ['węzeł', 'węzły', 'węzłów'],
  zasilacz: ['zasilacz', 'zasilacze', 'zasilaczy'],
  mostek: ['mostek', 'mostki', 'mostków'],
  lustro: ['lustro', 'lustra', 'luster'],
  brama: ['bramę', 'bramy', 'bram'],
  pas_przelotu: ['pas przelotu', 'pasy przelotu', 'pasów przelotu'],
  drzewo: ['drzewo', 'drzewa', 'drzew'],
  latarnia: ['latarnię', 'latarnie', 'latarni'],
  lawka: ['ławkę', 'ławki', 'ławek'],
  kiosk: ['kiosk', 'kioski', 'kiosków'],
  rival: ['rywala', 'rywali', 'rywali'],
  runner: ['złoty bajt', 'złote bajty', 'złotych bajtów'],
  misja: ['nowa misja', 'nowe misje', 'nowych misji']
};
function plural(n, forms) {
  if (n === 1) return forms[0];
  const d = n % 10, h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? forms[1] : forms[2];
}
function nounFor(key, n) { return `${n} ${plural(n, NOUNS[key] || [key, key, key])}`; }

const ACTIVATE_VERBS = { wezel: 'Wyłącz', zasilacz: 'Zbierz', mostek: 'Zasil', pylon: 'Naładuj', lustro: 'Aktywuj' };
const SETUP_KEY = { fragment: 'fragments', capsule: 'capsules', prop: 'props', vehicle: 'vehicles', marker: 'markers', node: 'nodes', pylon: 'pylons', structure: 'structures', heavy: 'heavies', tower: 'towers', runner: 'runners' };
const GLYPH_KEY = { prop: 'propGlyph', marker: 'markerGlyph', vehicle: 'vehicleGlyph', node: 'nodeGlyph', pylon: 'pylonGlyph', structure: 'structureGlyph', heavy: 'heavyGlyph', tower: 'towerGlyph' };
// The food that carries a hole from tier k to k+1 (the growth ladder).
const LADDER_FOOD = { 1: 'fragment', 2: 'prop', 3: 'vehicle', 4: 'structure', 5: 'heavy' };
// Rough seconds per eat at each object tier (travel + bite), calibrated by
// the automated mission playthrough.
const SEC_PER_EAT = { 1: 1.3, 2: 1.9, 3: 2.6, 4: 3.4, 5: 4.2, 6: 5 };
// v15 difficulty ladder (owner: "levele powinny mieć rosnący poziom
// trudności, a niektóre z nich powinny być bardzo trudne"). Each mission
// carries diff 1-5; the time limit is the expert bot's median clear time
// (MISSION_BOT_TIME, measured by qa/calibrate.mjs) x timeFactor + timePad,
// so "BARDZO TRUDNA" leaves a human about a quarter more time than a
// perfect, map-reading bot -- and spares shrink with the level too.
const DIFFICULTY = [
  null,
  { id: 1, label: 'ŁATWA', color: '#46D99A', timeFactor: 2.1, timePad: 20, spare: 0.4 },
  { id: 2, label: 'ŚREDNIA', color: '#50F0FA', timeFactor: 1.75, timePad: 14, spare: 0.3 },
  { id: 3, label: 'TRUDNA', color: '#EFCB63', timeFactor: 1.5, timePad: 9, spare: 0.25 },
  { id: 4, label: 'BARDZO TRUDNA', color: '#FF54AD', timeFactor: 1.24, timePad: 4, spare: 0.2 },
  { id: 5, label: 'EKSTREMALNA', color: '#9875FF', timeFactor: 1.12, timePad: 3, spare: 0.15 }
];
const tierUnits = k => CAMPAIGN_TIERS[k - 1].minUnits;
const round5 = v => Math.round(v / 5) * 5;

function stepLabel(step, setup) {
  if (step.label) return step.label;
  if (step.eat === 'runner') return `Złap ${nounFor('runner', step.n)}`;
  if (step.eat) return `Pochłoń ${nounFor(step.glyph || step.eat, step.n)}`;
  if (step.tier) return `Urośnij do rozmiaru T${step.tier}`;
  if (step.combo) return `Zbuduj combo ×${step.combo}`;
  if (step.gates) {
    if (setup.gateKind === 'portal') return 'Przejdź przez portal';
    return setup.gateKind === 'pas'
      ? `Przeleć przez ${nounFor('pas_przelotu', step.gates)}, gdy ${step.gates === 1 ? 'świeci' : 'świecą'}`
      : `Przejdź przez ${nounFor('brama', step.gates)}, gdy ${step.gates === 1 ? 'jest otwarta' : 'są otwarte'}`;
  }
  if (step.rival) return `Pochłoń ${nounFor('rival', step.rival)}`;
  if (step.activate) {
    const g = setup[GLYPH_KEY[step.activate]] || (step.activate === 'node' ? 'wezel' : 'pylon');
    return `${ACTIVATE_VERBS[g]} ${nounFor(g, step.n)}`;
  }
  if (step.landmark) return `Pochłoń ${LANDMARK_NAMES[step.landmark]}`;
  if (step.score) return `Zdobądź ${step.score} punktów`;
  return '';
}

/** Lowest growth tier at which a step can be completed. */
function stepTier(step) {
  if (step.eat) return CAMPAIGN_ENTITY_STATS[step.eat].minTier;
  if (step.tier) return step.tier;
  if (step.activate) return CAMPAIGN_ENTITY_STATS[step.activate].minTier;
  if (step.landmark) return LANDMARK_TIERS[step.landmark];
  if (step.rival) return 2;
  return 1;
}

// v15: the expert campaign bot's [median, p90] clear time per mission in
// seconds (qa/calibrate.mjs: several runs per mission under an open time
// limit). compileMission() derives the limit and the star times from these
// and the mission's difficulty -- re-run the calibration after changing a
// mission spec, the growth curve or the twists. Missing entries fall back
// to an estimate.
const MISSION_BOT_TIME = { M01: [8, 11], M02: [22, 25], M03: [16, 23], M04: [37, 43], M05: [5, 6], M06: [20, 23], M07: [20, 26], M08: [34, 50], M09: [21, 29], M10: [21, 24], M11: [38, 49], M12: [46, 95], M13: [23, 30], M14: [25, 32], M15: [29, 45], M16: [44, 73], M17: [23, 31], M18: [13, 14], M19: [42, 56], M20: [47, 74], M21: [22, 28], M22: [40, 131], M23: [41, 53], M24: [66, 128], M25: [35, 47], M26: [27, 40], M27: [37, 46], M28: [24, 31], M29: [37, 41], M30: [43, 60], M31: [33, 38], M32: [38, 45], M33: [17, 25], M34: [38, 47], M35: [41, 68], M36: [24, 34], M37: [36, 49], M38: [39, 52], M39: [25, 29], M40: [59, 128], M41: [44, 62], M42: [44, 49], M43: [45, 57], M44: [32, 37], M45: [45, 59], M46: [30, 36], M47: [81, 280], M48: [54, 63], M49: [46, 56], M50: [29, 49], M51: [11, 13], M52: [51, 61], M53: [121, 385], M54: [47, 69], M55: [50, 53], M56: [48, 132], M57: [47, 55], M58: [216, 305], M59: [44, 54], M60: [59, 61], M61: [27, 30], M62: [20, 24], M63: [39, 51], M64: [32, 39], M65: [45, 53], M66: [37, 47], M67: [20, 29], M68: [61, 79], M69: [45, 69], M70: [46, 53], M71: [55, 68], M72: [12, 14], M73: [58, 94], M74: [54, 108], M75: [30, 44], M76: [67, 93], M77: [33, 40], M78: [65, 79], M79: [47, 60], M80: [51, 64], M81: [81, 130], M82: [62, 120], M83: [86, 305], M84: [39, 52], M85: [91, 113], M86: [48, 52], M87: [27, 37], M88: [81, 101], M89: [101, 139], M90: [112, 243], M91: [18, 30], M92: [27, 36], M93: [18, 21], M94: [18, 29], M95: [26, 38], M96: [28, 33], M97: [49, 65], M98: [23, 29], M99: [29, 50], M100: [37, 46], M101: [39, 47], M102: [27, 42], M103: [24, 47], M104: [74, 88], M105: [45, 49], M106: [56, 68], M107: [47, 54], M108: [31, 48], M109: [52, 60], M110: [40, 72], M111: [20, 30], M112: [22, 29], M113: [72, 82], M114: [93, 140], M115: [62, 81], M116: [36, 47], M117: [50, 67], M118: [40, 53], M119: [41, 68], M120: [62, 88], M121: [29, 42], M122: [36, 55], M123: [31, 43], M124: [39, 71], M125: [46, 73], M126: [34, 88], M127: [44, 54], M128: [46, 84], M129: [25, 49], M130: [53, 123], M131: [76, 98], M132: [55, 81], M133: [37, 84], M134: [86, 181], M135: [50, 76], M136: [56, 66], M137: [46, 51], M138: [71, 87], M139: [48, 61], M140: [74, 213], M141: [67, 124], M142: [54, 66], M143: [75, 127], M144: [31, 53], M145: [60, 99], M146: [75, 115], M147: [58, 63], M148: [120, 174], M149: [63, 84], M150: [79, 140], M151: [27, 33], M152: [21, 26], M153: [8, 10], M154: [32, 37], M155: [45, 55], M156: [46, 59], M157: [12, 17], M158: [77, 118], M159: [13, 23], M160: [54, 135], M161: [45, 54], M162: [27, 32], M163: [52, 64], M164: [15, 18], M165: [58, 101], M166: [66, 87], M167: [55, 88], M168: [109, 155], M169: [28, 36], M170: [51, 61], M171: [69, 81], M172: [73, 86], M173: [22, 42], M174: [15, 28], M175: [123, 201], M176: [70, 96], M177: [49, 65], M178: [28, 32], M179: [85, 106], M180: [55, 86], M181: [29, 39], M182: [29, 37], M183: [11, 11], M184: [25, 32], M185: [32, 43], M186: [27, 36], M187: [47, 55], M188: [82, 185], M189: [47, 57], M190: [33, 37], M191: [45, 53], M192: [52, 60], M193: [23, 31], M194: [48, 58], M195: [56, 77], M196: [39, 52], M197: [12, 13], M198: [72, 316], M199: [22, 25], M200: [45, 72], M201: [74, 100], M202: [73, 102], M203: [80, 191], M204: [59, 79], M205: [61, 95], M206: [54, 94], M207: [153, 443], M208: [41, 52], M209: [48, 60], M210: [47, 57], M211: [24, 28], M212: [61, 72], M213: [15, 20], M214: [57, 67], M215: [76, 263], M216: [57, 82], M217: [57, 94], M218: [21, 37], M219: [59, 80], M220: [28, 30], M221: [36, 45], M222: [54, 78], M223: [42, 88], M224: [114, 163], M225: [67, 106], M226: [60, 174], M227: [21, 40], M228: [51, 88], M229: [62, 83], M230: [87, 397], M231: [51, 68], M232: [37, 44], M233: [61, 92], M234: [105, 223], M235: [89, 95], M236: [77, 84], M237: [67, 86], M238: [56, 183], M239: [36, 41], M240: [123, 201] };

/** v15 twist hints (shown in the briefing, start card and as chips). */
const TWIST_INFO = {
  hunters: { label: 'ŁOWCY', color: '#ff3860', hint: 'Łowcy polują na mniejsze wiry. Uciekaj, dopóki ich nie przerośniesz.' },
  racer: { label: 'ZŁODZIEJ', color: '#EFCB63', hint: 'Złodziej zbiera te same cele — rusza, gdy już możesz je zjadać. Na starcie jest większy: nie wpadaj na niego. Zbieraj szybciej niż on, a gdy urośniesz, pochłoń go — straci czas.' },
  dark: { label: 'CIEMNOŚĆ', color: '#9875FF', hint: 'Prąd padł: widać tylko to, co blisko wiru. Strzałka prowadzi do celu.' },
  glitch: { label: 'STREFY GLITCHA', color: '#FF54AD', hint: 'Różowe strefy glitcha zabierają masę i zrywają combo. Omijaj je.' },
  fragile: { label: 'KRUCHY WIR', color: '#50F0FA', hint: 'Kruchy wir: jedno zderzenie z większym rywalem albo strefą i misja przepada.' },
  runner: { label: 'ZŁOTE BAJTY', color: '#EFCB63', hint: 'Złote bajty uciekają, gdy się zbliżasz. Zapędź je w róg.' }
};

function compileMission(spec, order) {
  const s = Object.assign({}, spec.setup || {});
  const steps = spec.steps.map(st => Object.assign({}, st));
  const diff = clamp(spec.diff || 1, 1, 5);
  const D = DIFFICULTY[diff];
  let need = Math.max(1, ...steps.map(stepTier), s.minTier || 1);
  const goalCounts = {};
  let est = 0;
  steps.forEach(st => {
    if (st.eat) {
      goalCounts[st.eat] = (goalCounts[st.eat] || 0) + st.n;
      if (st.glyph) s[GLYPH_KEY[st.eat]] = st.glyph;
      est += st.n * (st.eat === 'runner' ? 3 : SEC_PER_EAT[CAMPAIGN_ENTITY_STATS[st.eat].minTier]);
    }
    if (st.activate) { s[SETUP_KEY[st.activate]] = Math.max(s[SETUP_KEY[st.activate]] || 0, st.n); est += st.n * 3.5; }
    if (st.landmark) { s.landmark = st.landmark; est += 6; }
    if (st.gates) { s.gates = Math.max(s.gates || 0, st.gates); est += st.gates * 7 + (s.gateKind === 'portal' ? 6 : 0); }
    if (st.rival) { s.bots = Math.max(s.bots || 0, Math.min(4, st.rival + 1)); est += st.rival * 8; }
    if (st.combo) {
      est += st.combo * 0.8 + 8;
      // A long chain needs dense pockets of small food -- and spare pockets,
      // so a broken chain can always be retried (fragments don't respawn).
      // v14: arc layouts get the spare pocket too -- a broken chain on the
      // arc used to leave too little food to retry (M33 failed ~1 in 6
      // automated runs on layout luck alone).
      if (!s.capsuleWaves) s.fragmentClusters = Math.max(s.fragmentClusters || 0, Math.ceil(st.combo / 7) + 1);
      s.clusterSize = Math.max(s.clusterSize || 0, st.combo + 3);
    }
    if (st.score) {
      // Score goals need a points-rich board: top up the climb food.
      est += st.score / 55;
      need = Math.max(need, st.score >= 3500 ? 6 : st.score >= 2500 ? 5 : st.score >= 1200 ? 4 : 3);
    }
  });
  // Bigger rivals (setup.botRadius) only become prey once the hole is
  // radius*1.15 -- push the growth ladder that far.
  if (steps.some(st => st.rival)) {
    const preyUnits = unitsForRadius((s.botRadius || CONFIG.campaign.rivalRadius) * EAT_HOLE_RATIO + 2);
    const tierForPrey = CAMPAIGN_TIERS.filter(t => t.minUnits <= preyUnits).length;
    need = Math.max(need, Math.min(6, tierForPrey + 1));
  }
  // v15: the racer chases the first eat goal; it gets twice the goal count
  // on the board, so the race always has a winner.
  const raceStep = s.racer ? steps.find(st => st.eat) : null;
  if (s.racer && !raceStep) s.racer = false;
  if (raceStep) { s.raceType = raceStep.eat; s.raceGlyph = raceStep.glyph || null; s.raceTarget = raceStep.n; }
  Object.keys(goalCounts).forEach(type => {
    const n = goalCounts[type];
    const key = SETUP_KEY[type];
    if (type === 'capsule' && s.capsuleWaves) return;
    const spare = raceStep && raceStep.eat === type ? n : Math.max(1, Math.ceil(n * D.spare));
    s[key] = Math.max(s[key] || 0, n + spare);
  });
  const comboStep = steps.find(st => st.combo);
  if (s.capsuleWaves && comboStep) s.capsulesPerWave = Math.max(s.capsulesPerWave || 8, comboStep.combo + 3);
  if (s.capsuleWaves && raceStep && raceStep.eat === 'capsule') s.capsulesPerWave = Math.max(s.capsulesPerWave || 8, Math.ceil(raceStep.n * 2 / s.capsuleWaves.length));
  // More than two hunters at once turned into a hit-lock; the extra
  // rivals of an "H3/H4" mission roam instead (bosses keep three).
  if (s.hunters) { s.hunters = Math.min(s.hunters, s.fragile ? 1 : diff >= 5 && s.landmark ? 3 : 2); s.bots = Math.max(s.bots || 0, s.hunters); }
  // Growth ladder up to the highest tier any step needs.
  for (let k = 1; k < need; k++) {
    const food = LADDER_FOOD[k];
    const units = tierUnits(k + 1) - tierUnits(k);
    const eats = Math.ceil(units / CAMPAIGN_ENTITY_STATS[food].growth);
    const key = SETUP_KEY[food];
    // Hits (hunters, glitch zones) cost growth: lay more climb food then.
    const hazard = (s.hunters ? 0.35 : 0) + (s.glitch ? 0.25 : 0);
    s[key] = Math.max(s[key] || 0, Math.ceil(eats * (1.35 + D.spare * 0.6 + hazard)) + 2);
    est += eats * SEC_PER_EAT[k];
  }
  s.fragments = Math.max(s.fragments || 0, 8);
  if (s.bots == null) s.bots = need >= 3 ? 1 : 0;
  // Score goals: make sure the board holds comfortably more points than
  // asked for (combo multiplies on top), topping up the top-tier food.
  const scoreStep = steps.find(st => st.score);
  if (scoreStep) {
    const top = need >= 6 ? 'tower' : LADDER_FOOD[Math.min(need, 5)];
    const avail = () => Object.keys(SETUP_KEY).reduce((sum, t) => sum + (s[SETUP_KEY[t]] || 0) * CAMPAIGN_ENTITY_STATS[t].score, 0);
    while (avail() < scoreStep.score * 1.3) s[SETUP_KEY[top]] = (s[SETUP_KEY[top]] || 0) + 1;
  }
  if (s.hunters) est *= 1.12;
  if (s.dark) est *= 1.25;
  if (s.glitch) est *= 1 + 0.05 * s.glitch;

  const activateStep = steps.find(st => st.activate);
  // v15 timing: the expert bot's measured clear time scaled by difficulty.
  const bt = MISSION_BOT_TIME[spec.id];
  const botMed = bt ? bt[0] : Math.max(20, est * 0.8);
  const botP90 = bt ? bt[1] : botMed * 1.3;
  // (p90 is capped: one stuck bot run must not stretch the limit.)
  // The floor keeps a slow-but-clean expert run inside the limit on the
  // friendly levels; the hard ones are held to the median pace.
  // v15 review: a high-variance expert run (p90) stays inside the limit
  // up to 1.6 x (ŁATWA) .. 1.2 x (EKSTREMALNA) the median.
  const floor = Math.min(botP90, botMed * (1.7 - 0.1 * diff)) + 3;
  const timeLimit = spec.time || Math.max(diff >= 4 ? 30 : 45, round5(botMed * D.timeFactor + D.timePad), round5(floor));
  // Stars: 1 = clear, 2 = a brisk clear, 3 = expert pace (or the mission's
  // own special challenge, kept from the v10 medals).
  // Stars stay humanly reachable: ★★ never under 1.3 x and ★★★ never
  // under ~1.1 x the expert bot's median.
  const t2 = Math.min(timeLimit - 5, Math.max(round5(botMed * 1.3), round5(botMed + (timeLimit - botMed) * 0.45)));
  const t3 = Math.min(t2 - 5, Math.max(10, round5(botMed * 1.1 + 3)));
  const timeStar = sec => ({ type: 'timeUnder', seconds: sec, label: `Ukończ w ${formatClock(sec)}` });
  const special = spec.medal && spec.medal.type !== 'timeUnder' ? spec.medal : null;
  const stars = [{ type: 'clear', label: 'Ukończ misję' }, timeStar(t2), special || timeStar(t3)];
  steps.forEach(st => { st.label = stepLabel(st, s); });
  const district = DISTRICTS.find(d => d.id === spec.d);
  const twists = ['hunters', 'racer', 'dark', 'glitch', 'fragile'].filter(k => s[k]);
  if (goalCounts.runner) twists.push('runner');
  return {
    id: spec.id, district: spec.d, order, name: spec.name, timeLimit, diff, twists,
    goal: {
      type: 'objectives', steps,
      label: steps.map(st => st.label).join(' · '),
      activator: activateStep ? activateStep.activate : null,
      count: activateStep ? activateStep.n : 0
    },
    stars,
    // Legacy alias (v14 single medal = today's third star).
    medal: stars[2],
    setup: s,
    needTier: need,
    estSeconds: Math.round(est),
    botSeconds: Math.round(botMed),
    evolutionOffer: timeLimit >= 110 && district && district.order >= 2 ? { atSeconds: 25, count: 2 } : (spec.evolution || null),
    nela: { start: spec.nela[0], success: spec.nela[1] },
    reward: spec.reward || { coins: 20 + 10 * ((district && district.order) || 1) + 10 * diff }
  };
}

// Rozdział I (Plac Neonów) + Rozdział II (Park Impulsów) — the two chapters
// the GDD writes out in full (cel/medal/układ/NELA/nagroda per mission).
// `setup` drives buildCampaignMission()'s spawn layout; `goal`/`medal` drive
// checkCampaignGoal(); numeric balance is explicitly a "propozycja do
// sprawdzenia" per the GDD's own disclaimer, not a measured target.
// v10 campaign: 60 authored missions + the M00 prologue, 10 per district.
// Each district introduces its own object class / mechanic and ends with a
// boss landmark one size class above the previous district's:
//   Plac Neonów  T1-T4  rivals, węzły, pawilony        -> Kino (T4)
//   Park Impulsów T1-T4 bramy, fale kapsuł, billboardy -> Fontanna (T4)
//   Port Syntez  T1-T5  skrzynie, palety, ciężarówki   -> Dźwig (T5)
//   Galeria Glitch T1-T5 portal, witryny, tramwaje      -> Galeria (T5)
//   Dachy Prądu  T1-T6  pasy przelotu, autobusy, maszty -> Iglica (T6)
//   Rdzeń Miasta T1-T6  wieżowce, kopuła, giganci       -> Rdzeń (T6)
// IDs M01-M24 keep their original slots (save compatibility); the new
// missions are M25-M60, slotted into their districts' order below.
const MISSION_SPECS = [
  // ---- Plac Neonów ----
  { id: 'M01', d: 'plac', diff: 1, name: 'Pierwszy apetyt', steps: [{ eat: 'capsule', n: 3 }, { tier: 2 }],
    nela: ['Kapsuły energii ładują Twój wir mocniej niż fragmenty — trzy wystarczą, żeby urosnąć.', 'Wir pulsuje mocniej!'] },
  { id: 'M02', d: 'plac', diff: 1, name: 'Dobra trasa', steps: [{ eat: 'prop', n: 6 }, { tier: 3 }], setup: { clusters: 2 },
    medal: { type: 'visitBothClusters', label: 'Pochłaniaj w obu skupiskach' },
    nela: ['Elementy uliczne stoją w dwóch skupiskach. Wybierz trasę i rośnij.', 'Plac nabiera kształtu.'] },
  { id: 'M03', d: 'plac', diff: 1, name: 'Łańcuch reakcji', steps: [{ combo: 10 }, { eat: 'prop', n: 4 }], setup: { arcLayout: true, fragments: 20 },
    nela: ['Fragmenty ułożyły się w łuk: połącz dziesięć kęsów bez przerwy, a potem pochłoń cztery elementy uliczne.', 'Reakcja łańcuchowa ruszyła!'] },
  { id: 'M25', d: 'plac', diff: 1, name: 'Godzina szczytu', steps: [{ eat: 'vehicle', n: 4 }],
    nela: ['Samochody utknęły w korku na placu. Urośnij do T3 i zgarnij je.', 'Korek rozładowany — w Twoim wirze.'] },
  { id: 'M26', d: 'plac', diff: 2, name: 'Obce dziury', steps: [{ rival: 2 }],
    nela: ['Po placu krążą obce dziury. Urośnij i pochłoń dwie z nich.', 'Rywale zniknęli w Twoim wirze.'] },
  { id: 'M27', d: 'plac', diff: 1, name: 'Wyłącznik', steps: [{ activate: 'node', n: 3 }],
    nela: ['Trzy węzły blokują zasilanie placu. Urośnij do T3 i pochłoń je.', 'Prąd znów płynie przez plac.'] },
  { id: 'M28', d: 'plac', diff: 2, name: 'Neonowa seria', steps: [{ combo: 8 }, { eat: 'vehicle', n: 3 }],
    nela: ['Seria kęsów podbija mnożnik punktów. Zbuduj combo ×8 i zgarnij trzy auta.', 'Mnożnik pod sufit!'] },
  { id: 'M29', d: 'plac', diff: 2, name: 'Pawilon na rogu', steps: [{ eat: 'structure', n: 2, glyph: 'pawilon' }],
    nela: ['Na rogu placu stoją szklane pawilony — obiekty T4. Urośnij, a zmieścisz je w sobie.', 'Pierwsze pawilony pochłonięte. Twój wir robi się naprawdę wielki.'] },
  { id: 'M30', d: 'plac', diff: 2, name: 'Rekord placu', steps: [{ score: 900 }],
    nela: ['Pokaż, ile potrafisz: 900 punktów. Combo mnoży każdy kęs.', 'Plac zapamięta ten wynik.'] },
  { id: 'M04', d: 'plac', diff: 2, name: 'Pierwszy wielki kęs', steps: [{ activate: 'node', n: 2 }, { landmark: 'kino' }],
    medal: { type: 'noBotHit', label: 'Ukończ bez zderzenia z większym rywalem' },
    nela: ['Kino to obiekt T4 i chronią je dwa węzły. Wyłącz je, urośnij i pochłoń kino.', 'Kino odzyskane. Park Impulsów otwarty!'],
    reward: { coins: 120, unlockDistrict: 'park' } },

  // ---- Park Impulsów ----
  { id: 'M05', d: 'park', diff: 1, name: 'Pierwszy impuls', steps: [{ gates: 2 }], setup: { gateKind: 'brama' },
    nela: ['Bramy otwierają się w rytmie impulsu. Poczekaj, aż zaświecą, i przejdź.', 'Park znów oddycha.'] },
  { id: 'M06', d: 'park', diff: 2, name: 'Zielona fala', steps: [{ eat: 'capsule', n: 12 }, { combo: 6 }],
    setup: { capsuleWaves: [0, 16, 32], capsulesPerWave: 8 },
    medal: { type: 'comboAtLeast', count: 8, label: 'Zbuduj combo ×8' },
    nela: ['Kapsuły napływają falami. Łap je seriami.', 'Energia płynie dalej.'] },
  { id: 'M07', d: 'park', diff: 1, name: 'Dwie drogi', steps: [{ eat: 'marker', n: 3, glyph: 'znacznik_ogrodu' }],
    medal: { type: 'bothRoutesUsed', label: 'Zbierz znaczniki z obu stron parku' },
    nela: ['Znaczniki ogrodu leżą po obu stronach alei. Skrót kusi, obejście też prowadzi do celu.', 'Masz własny sposób na ten park.'] },
  { id: 'M31', d: 'park', diff: 2, name: 'Ogrodowe bramy', steps: [{ gates: 3 }, { eat: 'prop', n: 6 }], setup: { gateKind: 'brama' },
    nela: ['Trzy bramy, jeden rytm. Po drodze posprzątaj alejki.', 'Alejki lśnią czystością.'] },
  { id: 'M32', d: 'park', diff: 2, name: 'Pawilony w parku', steps: [{ eat: 'structure', n: 3, glyph: 'pawilon' }],
    nela: ['Szklane pawilony zasłaniają widok na fontannę. Zrób miejsce.', 'Widok na fontannę odsłonięty.'] },
  { id: 'M33', d: 'park', diff: 3, name: 'Bieg wokół stawu', steps: [{ combo: 12 }, { eat: 'structure', n: 1, glyph: 'pawilon' }], setup: { arcLayout: true, fragments: 24 },
    nela: ['Fragmenty otaczają staw: dwanaście kęsów bez przerwy. Potem urośnij do T4 i pochłoń pawilon.', 'Taki rytm słychać w całym parku.'] },
  { id: 'M34', d: 'park', diff: 2, name: 'Strażnicy parku', steps: [{ rival: 3 }], setup: { hunters: 1 },
    nela: ['Po parku krąży czterech rywali, a jeden z nich poluje na Ciebie. Urośnij szybciej niż oni i pochłoń trzech.', 'Teraz to Ty pilnujesz parku.'] },
  { id: 'M35', d: 'park', diff: 2, name: 'Reklamy w zieleni', steps: [{ eat: 'structure', n: 3, glyph: 'billboard' }],
    nela: ['Ktoś postawił billboardy między drzewami. Usuń je.', 'Zieleń znów jest zielona.'] },
  { id: 'M36', d: 'park', diff: 3, name: 'Pylony ogrodu', steps: [{ activate: 'pylon', n: 3 }, { combo: 6 }],
    medal: { type: 'pylonsUnbroken', label: 'Naładuj pylony bez przerywania combo' },
    nela: ['Pylony zasilają fontannę. Naładuj wszystkie trzy.', 'Pylony buczą równym rytmem.'] },
  { id: 'M08', d: 'park', diff: 3, name: 'Serce ogrodu', steps: [{ activate: 'pylon', n: 3 }, { landmark: 'fontanna' }],
    medal: { type: 'pylonsUnbroken', label: 'Naładuj pylony bez przerywania combo' },
    nela: ['Jeszcze trzy impulsy. Naładuj pylony i obudź serce ogrodu.', 'Fontanna wróciła. Port Syntez czeka!'],
    reward: { coins: 150, unlockDistrict: 'port' } },

  // ---- Port Syntez ----
  { id: 'M09', d: 'port', diff: 2, name: 'Dostawa energii', steps: [{ eat: 'prop', n: 6, glyph: 'skrzynia' }, { tier: 3 }],
    nela: ['Port stoi bez prądu. Zacznij od skrzyń przy nabrzeżu.', 'Pierwsza dostawa dotarła.'] },
  { id: 'M10', d: 'port', diff: 2, name: 'Pełny załadunek', steps: [{ eat: 'marker', n: 3, glyph: 'paleta' }],
    medal: { type: 'bothRoutesUsed', label: 'Zbierz palety z obu stron doku' },
    nela: ['Oznaczone palety stoją po obu stronach doku. Znajdź je.', 'Załadunek kompletny.'] },
  { id: 'M11', d: 'port', diff: 2, name: 'Konwój', steps: [{ eat: 'vehicle', n: 6, glyph: 'konwoj' }],
    nela: ['Konwój wjeżdża do portu. Zatrzymaj sześć jego pojazdów.', 'Konwój zatrzymany.'] },
  { id: 'M37', d: 'port', diff: 2, name: 'Magazyny', steps: [{ eat: 'structure', n: 3, glyph: 'magazyn' }],
    nela: ['Magazyny portu pękają w szwach. Opróżnij trzy.', 'Magazyny puste, port lżejszy.'] },
  { id: 'M38', d: 'port', diff: 3, name: 'Ciężki towar', steps: [{ eat: 'heavy', n: 1, glyph: 'ciezarowka' }],
    nela: ['Do portu wjechała ciężarówka — obiekt T5. Urośnij przez magazyny i ją pochłoń.', 'Pierwszy ciężki pojazd! Teraz nic Cię nie zatrzyma.'] },
  { id: 'M39', d: 'port', diff: 3, name: 'Nocna zmiana', steps: [{ eat: 'prop', n: 6, glyph: 'skrzynia' }, { combo: 10 }],
    nela: ['Nocna zmiana. Skrzynie i jedna długa seria kęsów.', 'Załadunek w rekordowym tempie.'] },
  { id: 'M40', d: 'port', diff: 3, name: 'Dokerzy', steps: [{ rival: 3 }], setup: { hunters: 2, botRadius: 40 },
    nela: ['Dokerzy to więksi rywale. Zbliż się dopiero, gdy wyraźnie ich przerośniesz.', 'Port należy do Ciebie.'] },
  { id: 'M41', d: 'port', diff: 3, name: 'Flota ciężarówek', steps: [{ eat: 'heavy', n: 3, glyph: 'ciezarowka' }],
    nela: ['Cała flota czeka na rozładunek. Pochłoń trzy ciężarówki.', 'Flota zniknęła z nabrzeża.'] },
  { id: 'M42', d: 'port', diff: 3, name: 'Zasilacze portu', steps: [{ activate: 'node', n: 4 }, { eat: 'structure', n: 2, glyph: 'magazyn' }],
    setup: { nodeGlyph: 'zasilacz' },
    nela: ['Dźwig potrzebuje prądu. Zbierz cztery zasilacze i zrób miejsce przy magazynach.', 'Zasilanie gotowe. Dźwig drgnął.'] },
  { id: 'M12', d: 'port', diff: 4, name: 'Upadek dźwigu', steps: [{ activate: 'node', n: 3 }, { landmark: 'dzwig' }],
    setup: { hunters: 1, nodeGlyph: 'zasilacz' },
    medal: { type: 'noBotHit', label: 'Ukończ bez zderzenia z większym rywalem' },
    nela: ['Trzy zasilacze, jeden dźwig T5. Rośnij po drodze.', 'Dźwig opadł. Galeria Glitch się otwiera!'],
    reward: { coins: 180, unlockDistrict: 'galeria' } },

  // ---- Galeria Glitch ----
  { id: 'M13', d: 'galeria', diff: 2, name: 'Druga strona', steps: [{ gates: 1 }, { eat: 'marker', n: 6, glyph: 'krysztal' }],
    setup: { gateKind: 'portal' },
    nela: ['Portal migocze — wejdź, gdy świeci. Kryształy czekają po drugiej stronie.', 'Druga strona galerii odzyskana.'] },
  { id: 'M14', d: 'galeria', diff: 2, name: 'Witryny', steps: [{ eat: 'marker', n: 4, glyph: 'witryna' }],
    medal: { type: 'comboAtLeast', count: 5, label: 'Zbuduj combo ×5' },
    nela: ['Witryny wciąż świecą starym światłem. Zgaś je.', 'Witryny zgasły. Galeria czeka na nową wystawę.'] },
  { id: 'M15', d: 'galeria', diff: 3, name: 'Przed zamknięciem', steps: [{ eat: 'marker', n: 4, glyph: 'klucz_sektora' }], setup: { dark: true },
    nela: ['Światła w galerii już zgasły. Zbierz klucze sektorów po ciemku — strzałka pokaże drogę.', 'Wszystkie sektory otwarte na nowo.'] },
  { id: 'M43', d: 'galeria', diff: 3, name: 'Ekrany', steps: [{ eat: 'structure', n: 4, glyph: 'billboard' }],
    nela: ['Ekrany galerii nadają szum. Wyłącz je, pochłaniając.', 'Cisza. Wreszcie widać sztukę.'] },
  { id: 'M44', d: 'galeria', diff: 4, name: 'Rój glitcha', steps: [{ combo: 14 }, { eat: 'heavy', n: 1, glyph: 'tramwaj' }],
    nela: ['Glitch zbił fragmenty w gęste roje: czternaście kęsów bez przerwy. Potem urośnij do T5 i pochłoń tramwaj.', 'Glitch naprawiony rytmem.'] },
  { id: 'M45', d: 'galeria', diff: 3, name: 'Tramwaj sztuki', steps: [{ eat: 'heavy', n: 2, glyph: 'tramwaj' }],
    nela: ['Tramwaje wożą eksponaty między salami. Pochłoń dwa — razem z ładunkiem.', 'Eksponaty bezpieczne w Twoim rdzeniu.'] },
  { id: 'M46', d: 'galeria', diff: 3, name: 'Lustrzane odbicia', steps: [{ activate: 'pylon', n: 4 }], setup: { pylonGlyph: 'lustro' },
    medal: { type: 'pylonsUnbroken', label: 'Aktywuj lustra bez przerywania combo' },
    nela: ['Cztery lustra kierują światło do galerii. Aktywuj wszystkie.', 'Światło odbija się po całej galerii.'] },
  { id: 'M47', d: 'galeria', diff: 4, name: 'Kuratorzy', steps: [{ rival: 3 }], setup: { hunters: 2, botRadius: 50 },
    nela: ['Kuratorzy galerii to duzi rywale. Rośnij, aż wyraźnie ich przerośniesz, i pochłoń trzech.', 'Teraz to Ty decydujesz, co wisi w galerii.'] },
  { id: 'M48', d: 'galeria', diff: 3, name: 'Wielka wystawa', steps: [{ score: 2500 }],
    nela: ['Zdobądź 2500 punktów — tyle warta jest wielka wystawa.', 'Wystawa otwarta z hukiem.'] },
  { id: 'M16', d: 'galeria', diff: 4, name: 'Kaskada luster', steps: [{ activate: 'pylon', n: 3 }, { landmark: 'galeria_glowna' }],
    setup: { glitch: 2, pylonGlyph: 'lustro' },
    medal: { type: 'pylonsUnbroken', label: 'Aktywuj lustra bez przerywania combo' },
    nela: ['Trzy lustra otwierają galerię — obiekt T5. Aktywuj je i urośnij.', 'Galeria lśni jak nowa. Dachy Prądu czekają!'],
    reward: { coins: 220, unlockDistrict: 'dachy' } },

  // ---- Dachy Prądu ----
  { id: 'M17', d: 'dachy', diff: 2, name: 'Nad miastem', steps: [{ eat: 'prop', n: 6, glyph: 'modul_dachowy' }, { tier: 3 }],
    nela: ['Dachy Prądu widać z każdego okna. Zacznij od modułów na dachach.', 'Pierwszy dach znów świeci.'] },
  { id: 'M18', d: 'dachy', diff: 3, name: 'Tor lotu', steps: [{ gates: 3 }], setup: { gateKind: 'pas' },
    nela: ['Trzy pasy przelotu. Przeleć przez każdy w całości, póki świeci.', 'Tor lotu czysty od krawędzi do krawędzi.'] },
  { id: 'M19', d: 'dachy', diff: 3, name: 'Brama iglicy', steps: [{ activate: 'node', n: 2 }, { landmark: 'iglica_wejscie' }],
    setup: { nodeGlyph: 'mostek' },
    medal: { type: 'noBotHit', label: 'Ukończ bez zderzenia z większym rywalem' },
    nela: ['Dwa mostki prowadzą do bramy iglicy (T5). Zasil je i urośnij.', 'Brama otwarta. Iglica czeka.'] },
  { id: 'M49', d: 'dachy', diff: 3, name: 'Parking na dachu', steps: [{ eat: 'heavy', n: 3, glyph: 'autobus' }],
    nela: ['Ktoś zaparkował autobusy na dachu. Nie pytaj, jak — po prostu je pochłoń.', 'Dach odciążony.'] },
  { id: 'M50', d: 'dachy', diff: 4, name: 'Burza', steps: [{ combo: 15 }, { eat: 'heavy', n: 1, glyph: 'autobus' }], setup: { glitch: 2 },
    nela: ['Nadciąga burza: piętnaście kęsów bez przerwy, a potem pochłoń autobus, zanim uderzy piorun.', 'Burza przeszła bokiem.'] },
  { id: 'M51', d: 'dachy', diff: 3, name: 'Wyścig po dachach', steps: [{ gates: 4 }], setup: { gateKind: 'brama' },
    nela: ['Cztery bramy na krawędziach dachów. Wyczuj rytm każdej.', 'Nikt nie śmiga po dachach szybciej.'] },
  { id: 'M52', d: 'dachy', diff: 3, name: 'Pierwszy maszt', steps: [{ eat: 'tower', n: 1, glyph: 'maszt' }],
    nela: ['Maszt radiowy to obiekt T6 — największa klasa w mieście. Urośnij do granic.', 'Maszt runął. Jesteś kolosem.'] },
  { id: 'M53', d: 'dachy', diff: 4, name: 'Strażnicy dachów', steps: [{ rival: 4 }], setup: { hunters: 3, botRadius: 60 },
    nela: ['Strażnicy dachów są ogromni. Na początku omijaj ich, rośnij — potem pochłoń czterech.', 'Dachy są Twoje.'] },
  { id: 'M54', d: 'dachy', diff: 4, name: 'Las anten', steps: [{ eat: 'heavy', n: 2, glyph: 'autobus' }, { eat: 'tower', n: 2, glyph: 'maszt' }],
    nela: ['Las anten zagłusza sygnał. Urośnij na autobusach i powal dwa maszty.', 'Sygnał czysty jak nigdy.'] },
  { id: 'M20', d: 'dachy', diff: 4, name: 'Iglica', steps: [{ landmark: 'iglica' }], setup: { hunters: 2 },
    nela: ['Najwyższy punkt miasta. Iglica to T6 — urośnij do granic i ją pochłoń.', 'Iglica pochłonięta. Rdzeń Miasta się budzi!'],
    reward: { coins: 260, unlockDistrict: 'rdzen' } },

  // ---- Rdzeń Miasta ----
  { id: 'M21', d: 'rdzen', diff: 3, name: 'Powrót sygnału', steps: [{ eat: 'marker', n: 4, glyph: 'emiter' }],
    nela: ['Sygnał milczy od dawna. Znajdź cztery emitery.', 'Sygnał wraca do Rdzenia.'] },
  { id: 'M22', d: 'rdzen', diff: 4, name: 'Czytelny chaos', steps: [{ combo: 12 }, { score: 2000 }], setup: { glitch: 2 },
    nela: ['Chaos ma swój rytm: zbuduj combo ×12 i zdobądź 2000 punktów.', 'Chaos opanowany.'] },
  { id: 'M23', d: 'rdzen', diff: 3, name: 'Ostatni obwód', steps: [{ activate: 'node', n: 4 }, { tier: 5 }],
    nela: ['Wysokie napięcie. Wyłącz cztery węzły i urośnij do T5, żeby wytrzymać prąd.', 'Obwód zamknięty.'] },
  { id: 'M55', d: 'rdzen', diff: 3, name: 'Wieżowce', steps: [{ eat: 'tower', n: 2, glyph: 'wiezowiec' }],
    nela: ['Wieżowce Rdzenia rzucają cień na całe miasto. Pochłoń dwa.', 'Niebo nad Rdzeniem odsłonięte.'] },
  { id: 'M56', d: 'rdzen', diff: 4, name: 'Kopuła', steps: [{ eat: 'heavy', n: 3 }, { eat: 'tower', n: 1, glyph: 'kopula' }], setup: { hunters: 1 },
    nela: ['Pod kopułą bije serce miasta. Najpierw ciężkie pojazdy, potem sama kopuła.', 'Kopuła otwarta.'] },
  { id: 'M57', d: 'rdzen', diff: 4, name: 'Wszystkie rozmiary', steps: [{ tier: 6 }],
    nela: ['Od fragmentu do wieżowca: przejdź wszystkie sześć rozmiarów w jednej misji.', 'Sześć rozmiarów. Jedna dziura.'] },
  { id: 'M58', d: 'rdzen', diff: 5, name: 'Ostatni strażnicy', steps: [{ rival: 5 }], setup: { hunters: 2, botRadius: 70 },
    nela: ['Ostatni strażnicy Rdzenia to giganci. Unikaj ich, dopóki nie urośniesz — potem pochłoń pięciu.', 'Nikt już nie strzeże Rdzenia.'] },
  { id: 'M59', d: 'rdzen', diff: 4, name: 'Sygnał z wieży', steps: [{ activate: 'pylon', n: 3 }, { eat: 'tower', n: 2, glyph: 'maszt' }],
    nela: ['Trzy pylony nadają sygnał przez maszty. Naładuj pylony, potem pochłoń maszty.', 'Sygnał niesie się po całym mieście.'] },
  { id: 'M60', d: 'rdzen', diff: 4, name: 'Rekord Rdzenia', steps: [{ score: 5000 }],
    nela: ['Ostatni sprawdzian przed finałem: 5000 punktów.', 'Rekord, którego nikt nie pobije.'] },
  { id: 'M24', d: 'rdzen', diff: 5, name: 'Miasto na nowo', steps: [{ activate: 'node', n: 3 }, { landmark: 'rdzen_miasta_glowny' }], setup: { hunters: 2 },
    medal: { type: 'noBotHit', label: 'Ukończ bez zderzenia z większym rywalem' },
    nela: ['Wielki finał. Wyłącz trzy węzły i pochłoń rdzeń miasta — obiekt T6.', 'Rdzeń odzyskany! Ale Glitch uciekł pod ziemię — Tunele Metra czekają.'],
    reward: { coins: 400, unlockSkin: 'aurora', unlockDistrict: 'metro' } }
];
MISSION_SPECS.push(...chapterTwoSpecs());


const CAMPAIGN_MISSIONS = [
  // Prologue tutorial, not part of the GDD's 24-mission list. Player
  // feedback: Arena should only ever show objects/mechanics the player has
  // actually learned in Campaign -- unlocking Arena straight off M01 (which
  // only teaches 'fragment') would leave nothing else eatable to grow into
  // (T2+ objects stay locked until discovered), a softlock. M00 exists
  // purely to front-load one T1/T2/T3 object each plus the "you can eat a
  // smaller rival" mechanic (new to Campaign -- see handleCampaignCollisions())
  // before Arena unlocks on it (see isArenaUnlocked()).
  {
    id: 'M00', district: 'plac', order: 0, name: 'Zanim zaczniesz', timeLimit: 90, untimed: true,
    // Step counts aren't arbitrary -- they match CAMPAIGN_TIERS' own growth
    // thresholds (T2 at 6 units, T3 at 22) so the goal the player sees is
    // never smaller than what canEatWorldObjectTier()-equivalent gating
    // (handleCampaignEating()'s `tier < e.stats.minTier`) actually requires
    // to unlock the next step's object (player feedback: needed "more blue
    // dots" than the old count of 3, which unlocked nothing yet). fragment
    // growth=1/unit -> 6 fragments reaches T2 (unlocks prop); prop
    // growth=3/unit -> 6 more (6+6*3=24) reaches T3 (unlocks vehicle).
    // Each step carries its own `intro` -- shown full-screen and blocking
    // (see showTutorialStepIntro()/updateTutorialGuidance()), one step at a
    // time, instead of the opening overlay listing all four up front
    // (player feedback: the first instruction should only talk about the
    // first step, then the next window only about the next one, etc.).
    goal: {
      type: 'tutorialChecklist',
      label: 'Poznaj podstawy pochłaniania',
      steps: [
        {
          entityType: 'fragment', count: 6, label: 'Pochłoń 6 fragmentów energii', title: 'POCHŁANIAJ',
          intro: 'Przeciągnij palcem po ekranie — dziura jedzie za nim. Najedź na niebieskie fragmenty energii: każdy Cię powiększa.'
        },
        {
          entityType: 'prop', count: 6, label: 'Pochłoń 6 elementów ulicznych', title: 'ROŚNIJ',
          intro: 'Twój wir urósł! Różowe elementy uliczne — latarnie, ławki, drzewa — już się w nim mieszczą. Pochłoń sześć.'
        },
        {
          entityType: 'vehicle', count: 1, label: 'Pochłoń 1 pojazd', title: 'WIĘKSZY KĄSEK',
          intro: 'Jeszcze więcej mocy! Złote auta też już wchodzą. Strzałka na krawędzi ekranu pokaże, gdzie jechać.'
        },
        {
          type: 'eatRival', count: 1, label: 'Pochłoń mniejszego rywala', title: 'ZJEDZ RYWALA',
          intro: 'Rywal w zielonym pierścieniu jest mniejszy — najedź na niego i pochłoń! Czerwona poświata oznacza: uciekaj.'
        }
      ]
    },
    medal: { type: 'timeUnder', seconds: 70, label: 'Ukończ w 1:10' },
    // A couple more of each spawned than required (buffer, not everything
    // has to be reachable) since Campaign entities don't respawn mid-mission.
    // v13: starterRing puts the first fragments right around the start --
    // the old layout opened on an empty screen (nearest fragment ~330 px).
    setup: { fragments: 14, starterRing: 7, props: 10, vehicles: 3, bots: 1 },
    nela: {
      start: 'Zanim ruszysz na miasto: pochłoń fragmenty energii, aż urośniesz na tyle, by zjeść coś większego — najpierw element uliczny, potem pojazd. Na koniec dotknij mniejszego rywala, żeby go pochłonąć.',
      success: 'Tu NELA, SI tego miasta. Glitch skaził ulice — Ty je pochłaniasz, ja z tej energii odbudowuję miasto. Ruszamy!'
    },
    reward: { coins: 20 }
  },
  ...MISSION_SPECS.map(spec => compileMission(spec, DISTRICTS.find(d => d.id === spec.d).missions.indexOf(spec.id)))
];

function campaignMissionById(id) { return CAMPAIGN_MISSIONS.find(m => m.id === id); }

/** v10: missions are numbered by their position in the campaign (district
 *  by district), not by internal id or per-district order -- a district's
 *  third mission used to show up as "M03" in every district. */
function missionNumber(id) {
  let n = 0;
  for (const d of DISTRICTS) for (const mid of d.missions) { if (mid === id) return n; n++; }
  return 0;
}
function missionCode(def) { return def.id === 'M00' ? 'SAMOUCZEK' : `M${String(missionNumber(def.id)).padStart(2, '0')}`; }

/* ----------------------- Feature unlocks + celebrations -----------------------
   Pure save -> bool gates (shared by Game.isArenaUnlocked()/etc. and
   migrateSave()'s v9 branch, which can't call Game methods), plus the
   copy/icon/color for each "ODBLOKOWANO!" celebration
   (Game.queueUnlockCelebrations()). */
const FEATURE_GATES = {
  // GDD 4.0 §5.5 -- see Game.isArenaUnlocked()'s doc comment for M00 vs M01.
  arena: s => !!(s.campaign.completed['M00'] || s.campaign.completed['M01']),
  // M02, or already owning a cosmetic beyond the free defaults.
  warsztat: s => !!s.campaign.completed['M02']
    || (s.owned || []).length > 1 || ((s.auras || {}).owned || []).length > 1
    || ((s.effects || {}).owned || []).length > 1 || ((s.overdriveSkins || {}).owned || []).length > 1,
  // v10: M03 (M04 became Plac Neonów's boss, the district's last mission).
  wyzwania: s => !!(s.campaign.completed['M03'] || s.campaign.completed['M04']),
  // v15: mission boosters after Plac Neonów's boss.
  boosters: s => !!s.campaign.completed[CONFIG.boosters.unlockMission]
};

const UNLOCK_ICONS = {
  arena: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7V5z"/></svg>',
  warsztat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7.5a5.5 5.5 0 01-7.44 5.16L6 20l-2-2 7.34-7.66A5.5 5.5 0 1121 7.5z"/></svg>',
  wyzwania: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z"/><path d="M7 5H4a3 3 0 003 3M17 5h3a3 3 0 01-3 3"/></svg>',
  boosters: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
  district: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>'
};

/** Every announceable feature unlock, in the order they'd naturally be
 *  reached. District entries are generated from DISTRICTS (Plac Neonów is
 *  unlocked from the start, so it never gets one). */
const FEATURE_UNLOCKS = [
  {
    id: 'arena', eyebrow: 'NOWY TRYB', title: 'GRAJ 2:00', color: '#50F0FA', icon: UNLOCK_ICONS.arena,
    desc: 'Szybkie 2-minutowe rundy na Arenie z rywalami. Każda runda daje monety i ładuje Core City.',
    cta: 'ZAGRAJ TERAZ', isUnlocked: s => FEATURE_GATES.arena(s)
  },
  {
    id: 'warsztat', eyebrow: 'NOWA ZAKŁADKA', title: 'WARSZTAT', color: '#EFCB63', icon: UNLOCK_ICONS.warsztat,
    desc: 'Zmieniaj wygląd swojej dziury: Wir, Smuga, Efekt pochłaniania i Finisz. Wydaj tu zebrane monety!',
    cta: 'OTWÓRZ WARSZTAT', isUnlocked: s => FEATURE_GATES.warsztat(s)
  },
  {
    id: 'wyzwania', eyebrow: 'NOWA ZAKŁADKA', title: 'WYZWANIA', color: '#FF54AD', icon: UNLOCK_ICONS.wyzwania,
    desc: 'Codzienna misja i Wyzwanie dnia: ta sama mapa dla wszystkich, walka o rekord i serię dni z rzędu.',
    cta: 'OTWÓRZ WYZWANIA', isUnlocked: s => FEATURE_GATES.wyzwania(s)
  },
  {
    id: 'boosters', eyebrow: 'NOWOŚĆ W ODPRAWIE', title: 'WZMOCNIENIA', color: '#46D99A', icon: UNLOCK_ICONS.boosters,
    desc: 'Przed każdą misją możesz wziąć Zegar (+15 s), Turbo start, Magnes albo Tarczę. Na start dostajesz po jednym w prezencie!',
    cta: 'ŚWIETNIE', isUnlocked: s => FEATURE_GATES.boosters(s)
  },
  ...DISTRICTS.filter(d => d.id !== 'plac').map(d => ({
    id: 'district:' + d.id, districtId: d.id, eyebrow: 'NOWA DZIELNICA', title: d.name.toUpperCase(), color: '#9875FF',
    icon: UNLOCK_ICONS.district,
    // v14: the district's story (NELA's words) instead of a generic line.
    desc: `${DISTRICT_STORY[d.id]} Czeka ${nounFor('misja', d.missions.length)}.`,
    cta: 'DO DZIELNICY', isUnlocked: s => (s.campaign.unlockedDistricts || []).includes(d.id)
  }))
];

function unlockedFeatureIds(save) {
  return FEATURE_UNLOCKS.filter(f => f.isUnlocked(save)).map(f => f.id);
}
function campaignDistrictOf(missionId) {
  const m = campaignMissionById(missionId);
  return m ? DISTRICTS.find(d => d.id === m.district) : null;
}

const SAVE_KEY = 'vectorHoleSave_v1'; // storage key kept stable; schema is versioned inside the payload
const SAVE_SCHEMA_VERSION = 12;

/* ----------------------- Utilities ----------------------- */

/** Single, explicit win rule shared by the live HUD rank and the results
 *  screen (GDD P0-01): highest score wins; radius (then name) only breaks
 *  a tie. Before this fix, live rank and finalizeRun() both sorted by
 *  radius while the HUD/results labeled the number "Wynik" (score) —
 *  which could visibly disagree with score order, exactly the "#5 has
 *  219 pts, #6 has 277" inconsistency the GDD audit flagged. */
function rankHoles(holes) {
  return holes.slice().sort((a, b) => (b.score - a.score) || (b.radius - a.radius) || a.name.localeCompare(b.name));
}

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
/** Round/mission clock as m:ss (v12 HUD; was a bare "120 s"). */
/** 27355 -> "27 355" (thin no-break space), for scores on the results UI. */
function formatNum(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}

/** v15: long waits as "1 h 40 min" (formatClock() is for m:ss clocks). */
function formatDuration(sec) {
  if (sec < 3600) return formatClock(sec);
  const h = Math.floor(sec / 3600), m = Math.ceil((sec % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

function formatClock(sec) {
  const t = Math.max(0, Math.ceil(sec || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** Index into CONFIG.sizeTiers for a given hole radius -- Arena's own
 *  growth-tier ladder (T1-T5), used to gate which TIERS object group a
 *  hole has grown enough to eat (see canEatWorldObjectTier()), the same
 *  way Campaign gates CampaignEntity types by campaignPlayerTier(). */
function getSizeTierIndex(radius) {
  const tiers = CONFIG.sizeTiers;
  let idx = 0;
  for (let i = 0; i < tiers.length; i++) if (radius >= tiers[i].minRadius) idx = i;
  return idx;
}

/** Whether a hole of the given radius has grown into the size tier a
 *  WorldObject's TIERS group requires (small/medium/large -> T1/T2/T3) --
 *  the *only* eat-eligibility gate for world objects (no physical size-ratio
 *  check against that specific object's instance radius), matching
 *  Campaign's own `tier < e.stats.minTier` gate in handleCampaignEating()
 *  exactly (player feedback: arena and campaign must be exactly the same
 *  gameplay, missions being campaign's only addition). Object eating used
 *  to also require the object to be smaller than 0.9x the hole's radius,
 *  which Campaign never had; that physical floor is gone, not just relaxed
 *  -- hole-vs-hole eating still has its own ratio requirement, EAT_HOLE_RATIO,
 *  shared by both modes. */
function canEatWorldObjectTier(radius, obj) {
  return getSizeTierIndex(radius) >= TIERS[obj.tier].minSizeTier;
}
function pickUnique(arr, n, rng) {
  const pool = arr.slice();
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    const idx = rng ? Math.floor(rng.next() * pool.length) : randInt(0, pool.length - 1);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

/** Phase 5 (scoped): seeded equivalents of rand()/randInt() so a run's
 *  *initial* layout (object/bot starting positions) is reproducible from
 *  its seed — used for the Daily Seed Challenge. Ongoing mid-round
 *  randomness (bot wandering, object respawn after being eaten, particle
 *  drift) intentionally keeps using Math.random(): only the starting
 *  layout needs to match across devices/replays, per GDD 14.2. */
function seededRand(rng, min, max) { return rng.next() * (max - min) + min; }
function seededInt(rng, min, max) { return Math.floor(seededRand(rng, min, max + 1)); }

/** UTC-date-based seed so every player gets the same Daily Seed Challenge
 *  on the same calendar day, without a backend (GDD 14.2/14.3 — daily
 *  leaderboard infra is a later phase; the seed itself needs none). */
function dailySeedForDate(date) {
  const key = date.toISOString().slice(0, 10); // YYYY-MM-DD
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (Math.imul(31, hash) + key.charCodeAt(i)) | 0;
  }
  return { seed: hash >>> 0, dateKey: key };
}

/** The UTC calendar day before `dateKey` (YYYY-MM-DD), for the Daily
 *  streak counter (GDD 4.0 §5.4's "Wyzwania" tab wants to show a streak). */
/* ---- Golden Shot v11: friend challenge links ("Pobij mój wynik!") ----
   ?c=<seed36>.<score36>.<seal>&n=<name>. The seed replays the exact same
   Arena map; the seal stops casual URL edits of the score (client-side,
   so it's a deterrent, not real verification -- see docs/GAME_DESIGN.md). */
const CHALLENGE_MAX_SCORE = 500000;
function challengeSeal(seed, score, name) { return fnv1a(`${SEAL_SALT}|${seed}|${score}|${name}`); }
/** Cut by whole characters (code points), so an emoji is never split into
 *  a lone surrogate that URL encoding would turn into U+FFFD. */
function cutName(name) { return Array.from(String(name || '')).slice(0, 16).join(''); }
function challengeParams(seed, score, name) {
  const n = cutName(name);
  const out = { c: `${(seed >>> 0).toString(36)}.${Math.max(0, Math.round(score)).toString(36)}.${challengeSeal(seed >>> 0, Math.round(score), n)}` };
  if (n) out.n = n;
  return out;
}
const CANONICAL_URL = 'https://klaudiamoscinska-art.github.io/vector-hole/';
function encodeChallenge(seed, score, name) {
  const base = /^https?:$/.test(location.protocol) ? `${location.origin}${location.pathname}` : CANONICAL_URL;
  return `${base}?${new URLSearchParams(challengeParams(seed, score, name)).toString()}`;
}
function decodeChallenge(search) {
  try {
    const params = new URLSearchParams(search);
    const raw = params.get('c');
    if (!raw || raw.length > 40) return null;
    const [s36, sc36, seal] = raw.split('.');
    const seed = parseInt(s36, 36), score = parseInt(sc36, 36);
    const name = cutName(params.get('n') || '');
    if (!/^[0-9a-z]{1,7}$/.test(s36) || !/^[0-9a-z]{1,4}$/.test(sc36)) return null;
    if (!Number.isFinite(seed) || seed < 0 || seed > 0xffffffff) return null;
    if (!Number.isFinite(score) || score < 1 || score > CHALLENGE_MAX_SCORE) return null;
    if (seal !== challengeSeal(seed, score, name)) return null; // edited link: ignore it
    return { seed, score, from: name || 'Znajomy' };
  } catch (e) { return null; }
}

function previousDateKey(dateKey) {
  const d = new Date(dateKey + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// A small rotating mission pool: one is active per UTC calendar day (same
// hashing approach as the Daily Seed Challenge, so it needs no backend).
// Progress is tracked live during a round and checked at round end —
// this replaces the Hub's previous static, never-checked mission line.
const MISSIONS = [
  { id: 'eat_5_rivals', name: 'Zjedz 5 rywali w jednej rundzie', target: 5, rewardCoins: 80 },
  { id: 'reach_size_60', name: 'Urośnij do rozmiaru T4', target: 66, rewardCoins: 60 },
  { id: 'combo_x3', name: 'Zbuduj combo ×3', target: 3, rewardCoins: 50 },
  { id: 'score_150', name: 'Zdobądź 150 punktów w jednej rundzie', target: 150, rewardCoins: 70 }
];

function missionForDate(date) {
  const { seed, dateKey } = dailySeedForDate(date);
  return { mission: MISSIONS[seed % MISSIONS.length], dateKey };
}

function defaultSave() {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    coins: 0,
    prisms: 0,
    owned: ['rainbow'],
    selected: 'rainbow',
    auras: { owned: ['none'], selected: 'none' },
    displayName: null, // guest-first: never required before the first run (GDD P6)
    guestId: generateId('guest'),
    // Player feedback: default to legacy direct-drag (chase the pointer/
    // touch point) rather than the Floating Thumb Pad -- still switchable
    // in Ustawienia (syncControlsPanel()'s "Tryb sterowania" toggle).
    settings: { inputMode: 'legacy', sensitivity: 1, haptics: true, minimap: 'auto', sfx: true, music: true, gfxLevel: 2, musicPick: 'auto' },
    stats: { runsPlayed: 0, bestArenaScore: 0, recentArenaScores: [] },
    // v7: coreLevel starts at 1 (LVL1, "stan startowy" per GDD 4.0 §8.2);
    // coreCharge is the 0-100 progress toward the *next* level.
    hub: { coreCharge: 0, coreLevel: 1 },
    daily: { lastSeedDate: null, lastSeedScore: 0, streak: 0, lastPlayedDate: null },
    mission: { dateKey: null, completed: false },
    // v6: campaign progress. unlockedDistricts always includes the first
    // district so a fresh save can play Mission 01 with no prior unlock.
    // v8: discoveredTypes/discoveredHoleEating track what Arena is allowed
    // to show (see createObjects()) -- empty until M00 teaches them.
    campaign: { unlockedDistricts: ['plac'], completed: {}, medals: {}, discoveredTypes: [], discoveredHoleEating: false,
      // v15: stars = bitmask per mission (1 clear, 2 fast, 4 expert/special),
      // attempts/fails = tries and defeats in a row, pity = NELA's free
      // Zegar already lent, starChests = star chests opened.
      stars: {}, attempts: {}, fails: {}, pity: {}, starChests: 0 },
    // v15: session energy (CONFIG.energy) and one-shot mission boosters.
    energy: { value: 5, lastTick: 0, infiniteUntil: 0, freeDailyDate: null },
    boosters: { time: 0, start: 0, magnet: 0, shield: 0, gift: false },
    // v7: two more Warsztat cosmetic categories (GDD 4.0 §5.3) alongside
    // owned/selected (ring skins) and auras (trail).
    effects: { owned: ['classic'], selected: 'classic' },
    overdriveSkins: { owned: ['classic'], selected: 'classic' },
    badges: [],
    // v9: `announced` = FEATURE_UNLOCKS ids already celebrated (so each
    // "ODBLOKOWANO!" overlay plays exactly once); `fresh` = unlocked but not
    // visited yet, driving the "NOWE" badges in the nav/district strip.
    unlocks: { announced: [], fresh: [] },
    // v10 (Golden Shot v8): player XP level, 7-day login calendar
    // (`day` = index of the next reward to claim), free chest cooldown.
    player: { level: 1, xp: 0 },
    login: { lastClaimDate: null, day: 0, totalClaims: 0 },
    freeChest: { nextAt: 0, opened: 0 },
    // v11 (Golden Shot v11): purchases/entitlements, per-day ad placement
    // caps, GDPR consent, local retention metrics, pending friend challenge.
    entitlements: { noAds: false, purchased: [] },
    ads: { dateKey: null, used: {}, watched: 0 },
    privacy: { decided: false, analytics: false, ads: false, ts: 0 },
    retention: { installDate: null, activeDays: [], sessions: 0 },
    challenge: null,
    integrity: { tampered: false }
  };
}

/** Golden Shot v11: after migration, force every field back to the shape
 *  and type defaultSave() has -- a hand-edited or half-written save (a
 *  string where a number belongs, a missing sub-object, NaN coins) can
 *  no longer crash the game or turn `coins += 30` into string concat.
 *  Numbers are clamped to finite, non-negative, sane caps. */
const SAVE_CURRENCY_CAP = 1e7;
function sanitizeSave(save) {
  const def = defaultSave();
  const fix = (val, ref) => {
    if (Array.isArray(ref)) return Array.isArray(val) ? val.filter(v => v !== null && typeof v !== 'object') : ref;
    if (ref === null) return val === undefined ? null : val;
    if (typeof ref === 'object') {
      const out = (val && typeof val === 'object' && !Array.isArray(val)) ? { ...val } : {};
      for (const k of Object.keys(ref)) out[k] = fix(out[k], ref[k]);
      return out;
    }
    // Upper bound fits epoch-ms timestamps (freeChest.nextAt etc.).
    if (typeof ref === 'number') { const n = Number(val); return Number.isFinite(n) ? clamp(n, 0, 1e14) : ref; }
    if (typeof ref === 'boolean') return typeof val === 'boolean' ? val : ref;
    if (typeof ref === 'string') return typeof val === 'string' ? val : ref;
    return val === undefined ? ref : val;
  };
  const out = fix(save, def);
  // Free-form maps keep their own keys (fix() only knows defaultSave's keys).
  for (const k of ['completed', 'medals', 'stars', 'attempts', 'fails', 'pity']) out.campaign[k] = (save.campaign && typeof save.campaign[k] === 'object' && save.campaign[k]) || {};
  for (const k of ['stars', 'attempts', 'fails']) {
    for (const id of Object.keys(out.campaign[k])) { const v = Number(out.campaign[k][id]); out.campaign[k][id] = Number.isFinite(v) ? clamp(Math.floor(v), 0, k === 'stars' ? 7 : 1e6) : 0; }
  }
  out.energy.value = Math.min(out.energy.value, CONFIG.energy.cap);
  out.ads.used = (save.ads && typeof save.ads.used === 'object' && save.ads.used) || {};
  out.coins = Math.min(out.coins, SAVE_CURRENCY_CAP);
  out.prisms = Math.min(out.prisms, SAVE_CURRENCY_CAP);
  if (!out.owned.includes('rainbow')) out.owned.unshift('rainbow');
  if (!out.campaign.unlockedDistricts.includes('plac')) out.campaign.unlockedDistricts.unshift('plac');
  out.settings.sensitivity = out.settings.sensitivity || 1;
  // v16: a pinned track that no longer exists falls back to the mix.
  if (out.settings.musicPick !== 'auto' && !MUSIC_TRACK_BY_ID[out.settings.musicPick]) out.settings.musicPick = 'auto';
  out.player.level = Math.max(1, Math.floor(out.player.level));
  out.hub.coreLevel = Math.max(1, Math.floor(out.hub.coreLevel));
  return out;
}

/** Maps a CAMPAIGN_MISSIONS `setup` block to the TIERS/CAMPAIGN_ENTITY_STATS
 *  type(s) it actually spawns (see migrateSave()'s v8 branch). `gates` is
 *  intentionally omitted -- Brama has no eatable TIERS/Arena equivalent. */
function entityTypesFromMissionSetup(setup) {
  const types = [];
  if (setup.fragments) types.push('fragment');
  if (setup.props) types.push('prop');
  if (setup.vehicles) types.push('vehicle');
  if (setup.capsuleWaves || setup.capsulesPerWave) types.push('capsule');
  if (setup.markers) types.push('marker');
  if (setup.nodes) types.push('node');
  if (setup.pylons) types.push('pylon');
  if (setup.landmark) types.push('landmark');
  if (setup.structures) types.push('structure');
  if (setup.heavies) types.push('heavy');
  if (setup.towers) types.push('tower');
  return types;
}

/** Upgrades any older save shape to SAVE_SCHEMA_VERSION, preserving player
 *  progress. Add a new `if (data.schemaVersion < N)` branch per future
 *  schema change instead of replacing this function. */
function migrateSave(data) {
  if (!data || typeof data !== 'object') return defaultSave();
  if (!Array.isArray(data.owned) || typeof data.coins !== 'number') return defaultSave();

  if (!data.schemaVersion) {
    // v1 (no schemaVersion field) -> v2: add currencies/settings/profile stubs
    data = {
      schemaVersion: 2,
      coins: data.coins,
      prisms: 0,
      owned: data.owned,
      selected: data.selected || 'rainbow',
      guestId: generateId('guest'),
      settings: { inputMode: 'legacy', sensitivity: 1, haptics: true },
      stats: { runsPlayed: 0 }
    };
  }

  if (data.schemaVersion < 3) {
    // v2 -> v3: Floating Thumb Pad ships as the new default control.
    // No real players have explicitly chosen "legacy" yet (pre-launch
    // prototype), so it's safe to move the stored default forward too;
    // add settings.minimap for the new auto-hide-on-small-screens rule.
    data = {
      ...data,
      schemaVersion: 3,
      settings: {
        ...data.settings,
        inputMode: data.settings.inputMode === 'legacy' ? 'thumbpad' : data.settings.inputMode,
        minimap: data.settings.minimap || 'auto'
      }
    };
  }

  if (data.schemaVersion < 4) {
    // v3 -> v4: Neon Core Hub, profile display name, a second cosmetic
    // currency sink (auras), and a local Daily Seed Challenge record.
    data = {
      ...data,
      schemaVersion: 4,
      auras: data.auras || { owned: ['none'], selected: 'none' },
      displayName: data.displayName || null,
      hub: data.hub || { coreCharge: 0 },
      daily: data.daily || { lastSeedDate: null, lastSeedScore: 0 }
    };
  }

  if (data.schemaVersion < 5) {
    // v4 -> v5: the Hub's mission line was a static, non-functional
    // placeholder ("Zjedz 5 rywali w jednej rundzie" always shown, never
    // checked or rewarded). It's now a real rotating daily mission.
    data = {
      ...data,
      schemaVersion: 5,
      mission: data.mission || { dateKey: null, completed: false }
    };
  }

  if (data.schemaVersion < 6) {
    // v5 -> v6: campaign mode (Vector Hole v3 / GDD 3.1) — district/mission
    // progress and per-mission medals, local-only like everything else.
    data = {
      ...data,
      schemaVersion: 6,
      campaign: data.campaign || { unlockedDistricts: ['plac'], completed: {}, medals: {} }
    };
  }

  if (data.schemaVersion < 7) {
    // v6 -> v7: Vector Hole v4 (GDD 4.0) — Core City becomes a leveled bar
    // (coreLevel + the §8.2 reward ladder) instead of a flat repeating
    // "fill to 100%" milestone; two more Warsztat cosmetic categories
    // (Efekt pochłaniania / Overdrive); a Daily streak counter; campaign now
    // authors all 6 districts (DISTRICTS/CAMPAIGN_MISSIONS need no save
    // migration of their own -- unlockedDistricts/completed/medals are
    // already keyed by id and stay valid, new districts just start absent).
    data = {
      ...data,
      schemaVersion: 7,
      stats: { ...data.stats, bestArenaScore: data.stats.bestArenaScore || 0 },
      hub: { coreCharge: (data.hub && data.hub.coreCharge) || 0, coreLevel: (data.hub && data.hub.coreLevel) || 1 },
      daily: { ...data.daily, streak: data.daily.streak || 0, lastPlayedDate: data.daily.lastPlayedDate || null },
      effects: data.effects || { owned: ['classic'], selected: 'classic' },
      overdriveSkins: data.overdriveSkins || { owned: ['classic'], selected: 'classic' },
      badges: data.badges || []
    };
  }

  if (data.schemaVersion < 8) {
    // v7 -> v8: Arena's object spawns are now gated by what the player has
    // actually discovered in Campaign (player feedback: don't show
    // elements/mechanics not yet learned) -- see createObjects() and the
    // new M00 tutorial mission. A save that has played Arena before (back
    // when it spawned every TIERS type unconditionally) has genuinely
    // already seen the full bestiary there, so it gets full discovery. But
    // a save with *only* campaign progress used to also get the full
    // bestiary just for finishing any one completed mission -- that was a
    // bug (reported: T4/T5 objects like the landmark showing up in Arena
    // after growing large, despite never having touched a landmark/node/
    // pylon mission in Campaign): completing e.g. M01 (fragment-only)
    // instantly unlocked everything. Fixed by deriving discoveredTypes from
    // the `setup` of each mission the save has actually completed --
    // exactly the types that mission's own Arena-mirrored bestiary
    // (see WorldObject's doc comment) spawned for it.
    const playedArenaBefore = !!(data.stats && data.stats.runsPlayed > 0);
    const completedIds = Object.keys(data.campaign.completed || {});
    let derivedTypes = [];
    if (playedArenaBefore) {
      derivedTypes = Object.keys(CAMPAIGN_ENTITY_STATS);
    } else if (completedIds.length > 0) {
      const derived = new Set();
      completedIds.forEach(id => {
        const mission = CAMPAIGN_MISSIONS.find(m => m.id === id);
        if (mission && mission.setup) entityTypesFromMissionSetup(mission.setup).forEach(t => derived.add(t));
      });
      derivedTypes = Array.from(derived);
    }
    data = {
      ...data,
      schemaVersion: 8,
      campaign: {
        ...data.campaign,
        discoveredTypes: data.campaign.discoveredTypes || derivedTypes,
        // Hole-eating (devouring a smaller bot) is only actually taught by
        // M00's dedicated tutorial step -- other missions never exposed it
        // pre-v8 (bots were pure hazards, see CampaignEntity's doc comment).
        discoveredHoleEating: data.campaign.discoveredHoleEating || playedArenaBefore || completedIds.includes('M00')
      }
    };
  }

  if (data.schemaVersion < 9) {
    // v8 -> v9: unlock celebrations. Everything an existing save has
    // already unlocked counts as announced, so updating the game doesn't
    // replay a burst of old "ODBLOKOWANO!" overlays.
    data = { ...data, schemaVersion: 9, unlocks: { announced: unlockedFeatureIds(data), fresh: [] } };
  }

  if (data.schemaVersion < 10) {
    // v9 -> v10 (Golden Shot v8): XP level, login calendar, free chest.
    // Existing players start at LVL 1 with a chest ready to open.
    data = {
      ...data,
      schemaVersion: 10,
      player: data.player || { level: 1, xp: 0 },
      login: data.login || { lastClaimDate: null, day: 0, totalClaims: 0 },
      freeChest: data.freeChest || { nextAt: 0, opened: 0 }
    };
  }

  if (data.schemaVersion < 11) {
    // v10 -> v11 (Golden Shot v11): audio settings, entitlements, ad caps,
    // consent (existing players are asked once, like new ones), retention.
    data = {
      ...data,
      schemaVersion: 11,
      settings: { ...data.settings, sfx: true, music: true },
      entitlements: { noAds: false, purchased: [] },
      ads: { dateKey: null, used: {}, watched: 0 },
      privacy: { decided: false, analytics: false, ads: false, ts: 0 },
      retention: { installDate: null, activeDays: [], sessions: 0 },
      challenge: null,
      integrity: { tampered: false }
    };
  }

  if (data.schemaVersion < 12) {
    // v11 -> v12 (v15 "Wyzwanie"): three stars instead of one medal, energy,
    // mission boosters, Rozdział II. A cleared mission keeps star 1; its old
    // medal counts as star 2 (a time medal) or star 3 (a special challenge).
    // A save that already beat the finale (M24) gets Rozdział II opened.
    const c = { ...data.campaign };
    const stars = {};
    Object.keys(c.completed || {}).forEach(id => { if (c.completed[id]) stars[id] = 1; });
    Object.keys(c.medals || {}).forEach(id => {
      if (!c.medals[id]) return;
      const def = CAMPAIGN_MISSIONS.find(m => m.id === id);
      stars[id] = (stars[id] || 1) | (def && def.medal && def.medal.type !== 'timeUnder' ? 4 : 2);
    });
    const unlocked = (c.unlockedDistricts || ['plac']).slice();
    if (c.completed && c.completed.M24 && !unlocked.includes('metro')) unlocked.push('metro');
    data = {
      ...data,
      schemaVersion: 12,
      // Stars already held don't open a burst of chests at once.
      campaign: { ...c, unlockedDistricts: unlocked, stars, attempts: {}, fails: {}, pity: {},
        starChests: Math.floor(Object.values(stars).reduce((n, b) => n + (b & 1) + ((b >> 1) & 1) + ((b >> 2) & 1), 0) / CONFIG.stars.chestEvery) },
      energy: { value: CONFIG.energy.max, lastTick: 0, infiniteUntil: 0, freeDailyDate: null },
      boosters: { time: 0, start: 0, magnet: 0, shield: 0, gift: false }
    };
  }

  return data;
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // v11 tamper seal: a save edited by hand (devtools) no longer matches
      // its _sig. It still loads -- the player keeps their progress -- but
      // is flagged (integrity.tampered, reported once as save_tampered).
      let tampered = false;
      if (parsed && typeof parsed === 'object' && parsed._sig !== undefined) {
        const sig = parsed._sig;
        delete parsed._sig;
        tampered = sig !== fnv1a(SEAL_SALT + JSON.stringify(parsed));
      }
      const migrated = sanitizeSave(migrateSave(parsed));
      if (tampered) migrated.integrity.tampered = true;
      saveGame(migrated);
      return migrated;
    }
  } catch (e) { /* ignore corrupted save */ }
  return defaultSave();
}

function saveGame(save) {
  try {
    const body = JSON.stringify(save);
    localStorage.setItem(SAVE_KEY, body.slice(0, -1) + `,"_sig":"${fnv1a(SEAL_SALT + body)}"}`);
  } catch (e) { /* storage unavailable */ }
}

/* ----------------------- Particle ----------------------- */

class Particle {
  /** kind: 'dot' (soft glow, the original), 'spark' (a speed streak) or
   *  'pixel' (a spinning square) -- Golden Shot v8 mixes all three into
   *  every eat burst. speedMult scales the burst for bigger eats. */
  constructor(x, y, color, kind = 'dot', speedMult = 1) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(60, 240) * speedMult * (kind === 'spark' ? 1.5 : 1);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.color = color;
    this.kind = kind;
    this.radius = kind === 'pixel' ? rand(2.5, 5) : rand(1.5, 3.5);
    this.spin = rand(-12, 12);
    this.rot = rand(0, Math.PI * 2);
    this.maxLife = rand(0.4, 0.9) * (kind === 'spark' ? 0.7 : 1);
    this.life = this.maxLife;
    this.target = null; // set for 'suck' particles (see Game.spawnSuck())
  }

  update(dt) {
    this.life -= dt;
    if (this.target) {
      // Golden Shot v9: eaten matter spirals INTO the hole that ate it
      // (radial pull + tangential swirl), vanishing at the event horizon.
      const dx = this.target.x - this.x, dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < this.target.radius * 0.3) { this.life = 0; return; }
      const pull = 1500 * dt;
      this.vx = (this.vx + (dx / d) * pull - (dy / d) * pull * 0.6) * 0.9;
      this.vy = (this.vy + (dy / d) * pull + (dx / d) * pull * 0.6) * 0.9;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      return;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.94;
    this.vy *= 0.94;
    this.rot += this.spin * dt;
  }

  get dead() { return this.life <= 0; }

  draw(ctx) {
    const t = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = t;
    if (this.kind === 'suck') {
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.radius;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 0.035, this.y - this.vy * 0.035);
      ctx.stroke();
    } else if (this.kind === 'spark') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
      ctx.stroke();
    } else if (this.kind === 'pixel') {
      ctx.fillStyle = this.color;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      const r = this.radius * (0.5 + 0.5 * t);
      ctx.fillRect(-r / 2, -r / 2, r, r);
    } else {
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * t, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/* ----------------------- FloatText (Golden Shot v8 "+15" score pop-ups) -----------------------
   World-space text that pops in with an overshoot, rises and fades. Used for
   every eat's score gain, rival eats, combo praise and tier-ups. */

class FloatText {
  constructor(x, y, text, color, size = 16, life = 0.9, rise = 60, follow = null) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.size = size;
    this.maxLife = life;
    this.life = life;
    this.rise = rise;
    this.follow = follow; // a Hole to stay pinned above (the merged score pop)
    this.offset = 0;
  }

  update(dt) {
    this.life -= dt;
    if (this.follow) {
      this.offset += this.rise * 0.35 * dt;
      this.x = this.follow.x;
      // Stacked above the name (and the #1 crown), scaled like the labels.
      const ls = this.follow.labelScale || 1;
      this.y = this.follow.y - this.follow.radius - ((this.follow.isLeader ? 64 : 40) + this.offset) * ls;
    } else {
      this.y -= this.rise * dt;
    }
  }

  get dead() { return this.life <= 0; }

  /** k: extra scale (Arena's far zoom-out keeps pops readable, v12). */
  draw(ctx, k = 1) {
    const age = 1 - this.life / this.maxLife;
    const pop = age < 0.18 ? 0.4 + (age / 0.18) * 0.85 : (age < 0.3 ? 1.25 - (age - 0.18) / 0.12 * 0.25 : 1);
    ctx.save();
    ctx.globalAlpha = clamp(this.life / (this.maxLife * 0.45), 0, 1);
    ctx.translate(this.x, this.y);
    ctx.scale(pop * k, pop * k);
    ctx.font = `${this.size}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, this.size / 5);
    ctx.strokeStyle = 'rgba(4, 16, 29, 0.85)';
    ctx.strokeText(this.text, 0, 0);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
  }
}

/* ----------------------- Ripple (expanding ring, for "giant" eats and growth-tier pulses) ----------------------- */

class Ripple {
  constructor(x, y, color, startRadius, endRadius, duration) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.startRadius = startRadius;
    this.endRadius = endRadius;
    this.maxLife = duration;
    this.life = duration;
  }

  update(dt) {
    this.life -= dt;
  }

  get dead() { return this.life <= 0; }

  draw(ctx) {
    const t = 1 - clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = this.color;
    const rad = lerp(this.startRadius, this.endRadius, t);
    if (this.lineWidth) {
      // Screen-wide sweep (v12 tier-up): a soft halo stroke instead of a
      // shadow blur, which would cost a blur pass over the whole screen.
      ctx.lineWidth = this.lineWidth * 3 * (1 - t * 0.6);
      ctx.globalAlpha = (1 - t) * 0.22;
      ctx.beginPath(); ctx.arc(this.x, this.y, rad, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1 - t;
    } else {
      ctx.shadowBlur = 20;
      ctx.shadowColor = this.color;
    }
    ctx.lineWidth = (this.lineWidth || 3) * (1 - t * 0.6);
    ctx.beginPath();
    ctx.arc(this.x, this.y, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/* ----------------------- WorldObject ----------------------- */

/* ----------------------- Object art (sprite cache) -----------------------
   Player feedback: the eatable objects were thin one-color line icons. Each
   object kind is now a small illustrated sprite -- gradient-filled bodies in
   shades of its size-tier color, a specular highlight, a soft ground glow --
   painted ONCE per (kind, color, radius) into an offscreen canvas and then
   blitted with drawImage, so a world full of ~200 objects costs no more per
   frame than the old line art (shadowBlur only runs at cache time). Cheap
   per-frame "life" (bob, twinkle, spinning reactor arcs, portal swirl) is
   drawn live on top by drawObjectLive(). Shared by WorldObject (Arena) and
   CampaignEntity (Campaign) so an object looks identical in both modes. */

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Mix a #hex color toward white (t > 0) or black (t < 0). */
function shadeColor(hex, t) {
  const [r, g, b] = hexToRgb(hex);
  const target = t > 0 ? 255 : 0, k = Math.abs(t);
  return `rgb(${Math.round(r + (target - r) * k)}, ${Math.round(g + (target - g) * k)}, ${Math.round(b + (target - b) * k)})`;
}
function rgbaColor(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Top-to-bottom body gradient in shades of `col`. */
function bodyGradient(c, col, y0, y1, light = 0.45, dark = -0.45) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, shadeColor(col, light));
  g.addColorStop(0.5, col);
  g.addColorStop(1, shadeColor(col, dark));
  return g;
}

function roundRectPath(c, x, y, w, h, rad) {
  const r = Math.min(rad, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Fill the current path with a body gradient + glowing outline. */
function paintBody(c, col, y0, y1, opts = {}) {
  c.save();
  c.shadowBlur = opts.glow != null ? opts.glow : 10;
  c.shadowColor = col;
  c.fillStyle = bodyGradient(c, col, y0, y1, opts.light, opts.dark);
  c.fill();
  c.restore();
  c.lineWidth = opts.lineWidth || 1.4;
  c.strokeStyle = shadeColor(col, 0.6);
  c.stroke();
}

const OBJECT_ART = {
  // T1 -- faceted energy crystal (octahedron seen from above).
  fragment(c, r, col) {
    const w = r * 0.82;
    const facets = [
      [[0, -r], [-w, 0], [0, 0], 0.55],
      [[0, -r], [w, 0], [0, 0], 0.15],
      [[0, r], [-w, 0], [0, 0], -0.15],
      [[0, r], [w, 0], [0, 0], -0.5]
    ];
    c.save();
    c.shadowBlur = 10; c.shadowColor = col;
    c.beginPath(); c.moveTo(0, -r); c.lineTo(w, 0); c.lineTo(0, r); c.lineTo(-w, 0); c.closePath();
    c.fillStyle = col; c.fill();
    c.restore();
    facets.forEach(([a, b, m, t]) => {
      c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(m[0], m[1]); c.closePath();
      c.fillStyle = shadeColor(col, t); c.fill();
    });
    c.beginPath(); c.moveTo(0, -r); c.lineTo(w, 0); c.lineTo(0, r); c.lineTo(-w, 0); c.closePath();
    c.lineWidth = 1; c.strokeStyle = shadeColor(col, 0.75); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.beginPath(); c.arc(-w * 0.32, -r * 0.38, r * 0.13, 0, Math.PI * 2); c.fill();
  },

  // T1 -- glossy two-tone energy capsule.
  kapsula(c, r, col) {
    c.rotate(-Math.PI / 6);
    const L = r * 0.95, H = r * 0.58;
    roundRectPath(c, -L, -H, L * 2, H * 2, H);
    c.save(); c.shadowBlur = 12; c.shadowColor = col; c.fillStyle = rgbaColor(col, 0.25); c.fill(); c.restore();
    c.save();
    c.clip();
    c.fillStyle = bodyGradient(c, col, -H, H, 0.4, -0.35);
    c.fillRect(-L, -H, L, H * 2);
    const glass = c.createLinearGradient(0, -H, 0, H);
    glass.addColorStop(0, 'rgba(255,255,255,0.35)'); glass.addColorStop(1, rgbaColor(col, 0.15));
    c.fillStyle = glass; c.fillRect(0, -H, L, H * 2);
    c.fillStyle = shadeColor(col, 0.8);
    c.beginPath(); c.arc(L * 0.5, 0, H * 0.38, 0, Math.PI * 2); c.fill();
    c.restore();
    roundRectPath(c, -L, -H, L * 2, H * 2, H);
    c.lineWidth = 1.2; c.strokeStyle = shadeColor(col, 0.65); c.stroke();
    c.fillStyle = shadeColor(col, -0.3); c.fillRect(-r * 0.06, -H, r * 0.12, H * 2);
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 1.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-L * 0.65, -H * 0.5); c.lineTo(-L * 0.1, -H * 0.5); c.stroke();
  },

  // T2 -- street lamp with a lit head and a light cone.
  latarnia(c, r, col) {
    const cone = c.createLinearGradient(0, -r * 0.55, 0, r);
    cone.addColorStop(0, rgbaColor(col, 0.45)); cone.addColorStop(1, rgbaColor(col, 0));
    c.fillStyle = cone;
    c.beginPath(); c.moveTo(r * 0.12, -r * 0.55); c.lineTo(r * 0.75, r * 0.95); c.lineTo(-r * 0.15, r * 0.95); c.closePath(); c.fill();
    c.fillStyle = rgbaColor(col, 0.35);
    c.beginPath(); c.ellipse(r * 0.28, r * 0.95, r * 0.5, r * 0.1, 0, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 0.42, r * 0.75, r * 0.5, r * 0.22, r * 0.06);
    paintBody(c, col, r * 0.75, r, { glow: 4 });
    roundRectPath(c, -r * 0.24, -r * 0.82, r * 0.14, r * 1.6, r * 0.07);
    paintBody(c, col, -r, r, { glow: 6 });
    c.lineWidth = r * 0.1; c.lineCap = 'round'; c.strokeStyle = shadeColor(col, 0.2);
    c.beginPath(); c.moveTo(-r * 0.17, -r * 0.78); c.quadraticCurveTo(-r * 0.1, -r * 0.98, r * 0.18, -r * 0.92); c.stroke();
    c.beginPath(); c.moveTo(-r * 0.05, -r * 0.92); c.lineTo(r * 0.42, -r * 0.92); c.lineTo(r * 0.3, -r * 0.62); c.lineTo(r * 0.06, -r * 0.62); c.closePath();
    paintBody(c, col, -r * 0.95, -r * 0.6, { glow: 6 });
    c.save(); c.shadowBlur = 16; c.shadowColor = '#fff';
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(r * 0.18, -r * 0.6, r * 0.11, 0, Math.PI * 2); c.fill();
    c.restore();
  },

  // T2 -- round tree: layered canopy blobs over a trunk.
  drzewo(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.9, r * 0.55, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 0.1, r * 0.05, r * 0.2, r * 0.85, r * 0.06);
    paintBody(c, col, 0, r, { light: -0.15, dark: -0.6, glow: 3 });
    const blobs = [[-r * 0.38, -r * 0.05, r * 0.42], [r * 0.38, -r * 0.08, r * 0.42], [0, -r * 0.42, r * 0.5]];
    c.save(); c.shadowBlur = 12; c.shadowColor = col;
    blobs.forEach(([x, y, br]) => { c.beginPath(); c.arc(x, y, br, 0, Math.PI * 2); c.fillStyle = col; c.fill(); });
    c.restore();
    blobs.forEach(([x, y, br]) => {
      const g = c.createRadialGradient(x - br * 0.35, y - br * 0.4, br * 0.1, x, y, br);
      g.addColorStop(0, shadeColor(col, 0.55)); g.addColorStop(0.6, col); g.addColorStop(1, shadeColor(col, -0.4));
      c.fillStyle = g; c.beginPath(); c.arc(x, y, br, 0, Math.PI * 2); c.fill();
    });
    c.fillStyle = 'rgba(255,255,255,0.7)';
    [[-r * 0.1, -r * 0.62], [r * 0.3, -r * 0.2], [-r * 0.45, -r * 0.12]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, r * 0.06, 0, Math.PI * 2); c.fill(); });
  },

  // T2 -- park bench: two backrest slats, seat, legs, armrests.
  lawka(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.28);
    c.beginPath(); c.ellipse(0, r * 0.72, r * 0.95, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    c.lineCap = 'round'; c.lineWidth = r * 0.1; c.strokeStyle = shadeColor(col, -0.35);
    c.beginPath();
    c.moveTo(-r * 0.75, r * 0.1); c.lineTo(-r * 0.8, r * 0.68);
    c.moveTo(r * 0.75, r * 0.1); c.lineTo(r * 0.8, r * 0.68);
    c.moveTo(-r * 0.75, -r * 0.6); c.lineTo(-r * 0.75, r * 0.1);
    c.moveTo(r * 0.75, -r * 0.6); c.lineTo(r * 0.75, r * 0.1);
    c.stroke();
    [-r * 0.58, -r * 0.3].forEach(y => { roundRectPath(c, -r * 0.95, y, r * 1.9, r * 0.2, r * 0.08); paintBody(c, col, y, y + r * 0.2, { glow: 6 }); });
    roundRectPath(c, -r, -r * 0.02, r * 2, r * 0.26, r * 0.1);
    paintBody(c, col, -r * 0.02, r * 0.24, { glow: 8 });
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(-r * 0.85, r * 0.04); c.lineTo(r * 0.3, r * 0.04); c.stroke();
  },

  // T2 -- kiosk with a striped awning and a lit window.
  kiosk(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.28);
    c.beginPath(); c.ellipse(0, r * 0.92, r * 0.95, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 0.8, -r * 0.35, r * 1.6, r * 1.25, r * 0.08);
    paintBody(c, col, -r * 0.35, r * 0.9, { light: 0.15, dark: -0.55 });
    const win = c.createLinearGradient(0, -r * 0.15, 0, r * 0.35);
    win.addColorStop(0, '#ffffff'); win.addColorStop(1, shadeColor(col, 0.55));
    c.save(); c.shadowBlur = 12; c.shadowColor = '#fff';
    roundRectPath(c, -r * 0.55, -r * 0.15, r * 1.1, r * 0.5, r * 0.05); c.fillStyle = win; c.fill();
    c.restore();
    roundRectPath(c, -r * 0.65, r * 0.35, r * 1.3, r * 0.14, r * 0.04);
    c.fillStyle = shadeColor(col, 0.3); c.fill();
    // awning
    c.beginPath(); c.moveTo(-r, -r * 0.35); c.lineTo(-r * 0.75, -r * 0.8); c.lineTo(r * 0.75, -r * 0.8); c.lineTo(r, -r * 0.35); c.closePath();
    c.save(); c.clip();
    for (let i = 0; i < 6; i++) {
      c.fillStyle = i % 2 ? '#ffffff' : col;
      c.globalAlpha = i % 2 ? 0.85 : 1;
      c.fillRect(-r + i * (r * 2 / 6), -r, r * 2 / 6 + 0.5, r);
    }
    c.restore();
    c.beginPath(); c.moveTo(-r, -r * 0.35); c.lineTo(-r * 0.75, -r * 0.8); c.lineTo(r * 0.75, -r * 0.8); c.lineTo(r, -r * 0.35); c.closePath();
    c.save(); c.shadowBlur = 8; c.shadowColor = col; c.lineWidth = 1.4; c.strokeStyle = shadeColor(col, 0.6); c.stroke(); c.restore();
    c.fillStyle = shadeColor(col, 0.7);
    roundRectPath(c, -r * 0.3, -r * 1.0, r * 0.6, r * 0.18, r * 0.05); c.fill();
  },

  // T2 -- wooden-style crate with braces and rivets.
  skrzynia(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.28);
    c.beginPath(); c.ellipse(0, r * 0.82, r * 0.95, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 0.85, -r * 0.7, r * 1.7, r * 1.45, r * 0.1);
    paintBody(c, col, -r * 0.7, r * 0.75, { light: 0.25, dark: -0.5 });
    c.save();
    roundRectPath(c, -r * 0.85, -r * 0.7, r * 1.7, r * 1.45, r * 0.1); c.clip();
    c.strokeStyle = shadeColor(col, -0.45); c.lineWidth = r * 0.16;
    c.strokeRect(-r * 0.85, -r * 0.7, r * 1.7, r * 1.45);
    c.lineWidth = r * 0.12;
    c.beginPath(); c.moveTo(-r * 0.75, r * 0.65); c.lineTo(r * 0.75, -r * 0.6); c.stroke();
    c.restore();
    c.fillStyle = shadeColor(col, 0.75);
    [[-0.7, -0.55], [0.7, -0.55], [-0.7, 0.6], [0.7, 0.6]].forEach(([x, y]) => { c.beginPath(); c.arc(r * x, r * y, r * 0.06, 0, Math.PI * 2); c.fill(); });
  },

  // T2 -- pennant on a pole with a glowing finial.
  znacznik(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(-r * 0.5, r * 0.92, r * 0.35, r * 0.09, 0, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 0.58, -r * 0.8, r * 0.12, r * 1.75, r * 0.06);
    paintBody(c, col, -r, r, { light: 0.3, dark: -0.4, glow: 4 });
    c.beginPath();
    c.moveTo(-r * 0.46, -r * 0.78);
    c.bezierCurveTo(-r * 0.1, -r * 0.95, r * 0.25, -r * 0.55, r * 0.85, -r * 0.62);
    c.bezierCurveTo(r * 0.4, -r * 0.35, r * 0.05, -r * 0.05, -r * 0.46, -r * 0.12);
    c.closePath();
    paintBody(c, col, -r * 0.9, -r * 0.1, { light: 0.4, dark: -0.3, glow: 10 });
    c.save(); c.shadowBlur = 12; c.shadowColor = '#fff'; c.fillStyle = '#fff';
    c.beginPath(); c.arc(-r * 0.52, -r * 0.88, r * 0.11, 0, Math.PI * 2); c.fill(); c.restore();
  },

  // T3 -- neon coupe (side view) with lit windows and headlight beam.
  samochod(c, r, col, variant) {
    const beam = c.createLinearGradient(r * 0.9, 0, r * 1.5, 0);
    beam.addColorStop(0, 'rgba(255,255,255,0.45)'); beam.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = beam;
    c.beginPath(); c.moveTo(r * 0.92, -r * 0.05); c.lineTo(r * 1.5, -r * 0.28); c.lineTo(r * 1.5, r * 0.32); c.lineTo(r * 0.92, r * 0.12); c.closePath(); c.fill();
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.55, r * 1.0, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    // cabin
    c.beginPath();
    c.moveTo(-r * 0.62, -r * 0.18); c.lineTo(-r * 0.38, -r * 0.6); c.lineTo(r * 0.3, -r * 0.6); c.lineTo(r * 0.6, -r * 0.18); c.closePath();
    paintBody(c, col, -r * 0.6, -r * 0.18, { light: 0.35, dark: -0.2 });
    const glass = c.createLinearGradient(0, -r * 0.52, 0, -r * 0.22);
    glass.addColorStop(0, '#ffffff'); glass.addColorStop(1, shadeColor(col, 0.4));
    c.fillStyle = glass;
    c.beginPath(); c.moveTo(-r * 0.5, -r * 0.22); c.lineTo(-r * 0.33, -r * 0.52); c.lineTo(-r * 0.04, -r * 0.52); c.lineTo(-r * 0.04, -r * 0.22); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(r * 0.04, -r * 0.22); c.lineTo(r * 0.04, -r * 0.52); c.lineTo(r * 0.26, -r * 0.52); c.lineTo(r * 0.47, -r * 0.22); c.closePath(); c.fill();
    // body
    roundRectPath(c, -r, -r * 0.24, r * 1.95, r * 0.6, r * 0.2);
    paintBody(c, col, -r * 0.24, r * 0.36, { light: 0.45, dark: -0.45, glow: 12 });
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-r * 0.85, -r * 0.1); c.lineTo(r * 0.75, -r * 0.1); c.stroke();
    c.save(); c.shadowBlur = 10; c.shadowColor = '#fff'; c.fillStyle = '#fff';
    roundRectPath(c, r * 0.8, -r * 0.12, r * 0.14, r * 0.12, r * 0.04); c.fill(); c.restore();
    c.fillStyle = '#ff3860';
    roundRectPath(c, -r * 0.98, -r * 0.12, r * 0.1, r * 0.12, r * 0.03); c.fill();
    // wheels
    [-r * 0.55, r * 0.55].forEach(x => {
      c.beginPath(); c.arc(x, r * 0.38, r * 0.23, 0, Math.PI * 2);
      c.fillStyle = '#0a0f18'; c.fill();
      c.lineWidth = r * 0.06; c.strokeStyle = shadeColor(col, 0.3); c.stroke();
      c.beginPath(); c.arc(x, r * 0.38, r * 0.08, 0, Math.PI * 2); c.fillStyle = shadeColor(col, 0.6); c.fill();
    });
    if (variant === 'konwoj') {
      c.strokeStyle = shadeColor(col, 0.5); c.lineWidth = r * 0.07; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-r * 1.0, r * 0.15); c.lineTo(-r * 1.3, r * 0.15); c.stroke();
      c.beginPath(); c.arc(-r * 1.35, r * 0.15, r * 0.07, 0, Math.PI * 2); c.fillStyle = shadeColor(col, 0.6); c.fill();
    }
  },

  // T3 -- energy reactor node (hex housing + glowing core). Live: spinning arcs.
  wezel(c, r, col) {
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * Math.PI / 3;
      c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92);
    }
    c.closePath();
    c.save(); c.shadowBlur = 14; c.shadowColor = col;
    const plate = c.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    plate.addColorStop(0, shadeColor(col, -0.55)); plate.addColorStop(1, shadeColor(col, -0.2));
    c.fillStyle = plate; c.fill(); c.restore();
    c.lineWidth = 2; c.strokeStyle = shadeColor(col, 0.5); c.stroke();
    c.lineWidth = r * 0.08; c.strokeStyle = shadeColor(col, 0.1);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2;
      c.beginPath(); c.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3); c.lineTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62); c.stroke();
    }
    const core = c.createRadialGradient(0, 0, 0, 0, 0, r * 0.36);
    core.addColorStop(0, '#ffffff'); core.addColorStop(0.45, shadeColor(col, 0.5)); core.addColorStop(1, col);
    c.save(); c.shadowBlur = 20; c.shadowColor = col;
    c.fillStyle = core; c.beginPath(); c.arc(0, 0, r * 0.34, 0, Math.PI * 2); c.fill(); c.restore();
  },

  // T3 -- lattice energy pylon topped by a charge orb. Live: orb halo pulse.
  pylon(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.95, r * 0.6, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    c.lineCap = 'round';
    c.save(); c.shadowBlur = 8; c.shadowColor = col;
    c.strokeStyle = shadeColor(col, 0.15); c.lineWidth = r * 0.09;
    c.beginPath(); c.moveTo(-r * 0.5, r * 0.92); c.lineTo(-r * 0.12, -r * 0.35); c.moveTo(r * 0.5, r * 0.92); c.lineTo(r * 0.12, -r * 0.35); c.stroke();
    c.restore();
    c.strokeStyle = shadeColor(col, -0.15); c.lineWidth = r * 0.05;
    c.beginPath();
    c.moveTo(-r * 0.46, r * 0.8); c.lineTo(r * 0.36, r * 0.35);
    c.moveTo(r * 0.46, r * 0.8); c.lineTo(-r * 0.36, r * 0.35);
    c.moveTo(-r * 0.33, r * 0.35); c.lineTo(r * 0.23, -r * 0.05);
    c.moveTo(r * 0.33, r * 0.35); c.lineTo(-r * 0.23, -r * 0.05);
    c.moveTo(-r * 0.36, r * 0.35); c.lineTo(r * 0.36, r * 0.35);
    c.stroke();
    const orb = c.createRadialGradient(-r * 0.08, -r * 0.68, r * 0.03, 0, -r * 0.6, r * 0.3);
    orb.addColorStop(0, '#ffffff'); orb.addColorStop(0.5, shadeColor(col, 0.45)); orb.addColorStop(1, col);
    c.save(); c.shadowBlur = 22; c.shadowColor = col;
    c.fillStyle = orb; c.beginPath(); c.arc(0, -r * 0.6, r * 0.3, 0, Math.PI * 2); c.fill(); c.restore();
  },

  // T4 (Arena) -- glowing city monument: three towers + spire on a dais.
  landmark(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.78, r * 0.95, r * 0.2, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(0, r * 0.7, r * 0.85, r * 0.16, 0, 0, Math.PI * 2);
    paintBody(c, col, r * 0.55, r * 0.86, { light: 0.3, dark: -0.5 });
    const towers = [[-r * 0.55, r * 0.26, r * 0.95], [r * 0.29, r * 0.26, r * 1.05], [-r * 0.16, r * 0.32, r * 1.45]];
    towers.forEach(([x, w, h]) => {
      roundRectPath(c, x, r * 0.68 - h, w, h, r * 0.04);
      paintBody(c, col, r * 0.68 - h, r * 0.68, { light: 0.35, dark: -0.55, glow: 12 });
      c.fillStyle = 'rgba(255,255,255,0.75)';
      for (let y = r * 0.68 - h + r * 0.12; y < r * 0.55; y += r * 0.17) {
        c.fillRect(x + w * 0.22, y, w * 0.18, r * 0.06);
        c.fillRect(x + w * 0.6, y, w * 0.18, r * 0.06);
      }
    });
    c.strokeStyle = shadeColor(col, 0.5); c.lineWidth = r * 0.04;
    c.beginPath(); c.moveTo(0, r * 0.68 - r * 1.45); c.lineTo(0, -r * 1.0); c.stroke();
    c.save(); c.shadowBlur = 16; c.shadowColor = '#fff'; c.fillStyle = '#fff';
    c.beginPath(); c.arc(0, -r * 1.0, r * 0.06, 0, Math.PI * 2); c.fill(); c.restore();
  },

  /* ---------- v10: T4 (violet) structures ---------- */

  // T4 -- glass pavilion with an arched neon roof.
  pawilon(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.28);
    c.beginPath(); c.ellipse(0, r * 0.82, r * 1.0, r * 0.14, 0, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 0.85, -r * 0.2, r * 1.7, r * 1.0, r * 0.06);
    paintBody(c, col, -r * 0.2, r * 0.8, { light: 0.1, dark: -0.6 });
    const glass = c.createLinearGradient(0, -r * 0.1, 0, r * 0.7);
    glass.addColorStop(0, '#ffffff'); glass.addColorStop(1, rgbaColor(col, 0.5));
    c.save(); c.shadowBlur = 14; c.shadowColor = '#fff'; c.fillStyle = glass;
    for (let i = 0; i < 4; i++) { roundRectPath(c, -r * 0.72 + i * r * 0.37, -r * 0.08, r * 0.3, r * 0.62, r * 0.04); c.fill(); }
    c.restore();
    c.beginPath(); c.moveTo(-r, -r * 0.18); c.quadraticCurveTo(0, -r * 1.05, r, -r * 0.18); c.closePath();
    paintBody(c, col, -r * 0.75, -r * 0.18, { light: 0.4, dark: -0.3, glow: 16 });
    c.save(); c.shadowBlur = 10; c.shadowColor = '#fff'; c.fillStyle = '#fff';
    roundRectPath(c, -r * 0.32, -r * 0.5, r * 0.64, r * 0.14, r * 0.05); c.fill(); c.restore();
  },

  // T4 -- giant neon billboard on two legs.
  billboard(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.25);
    c.beginPath(); c.ellipse(0, r * 0.9, r * 0.8, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    c.lineCap = 'round'; c.lineWidth = r * 0.1; c.strokeStyle = shadeColor(col, -0.35);
    c.beginPath(); c.moveTo(-r * 0.5, r * 0.88); c.lineTo(-r * 0.5, r * 0.1); c.moveTo(r * 0.5, r * 0.88); c.lineTo(r * 0.5, r * 0.1); c.stroke();
    roundRectPath(c, -r * 1.0, -r * 0.85, r * 2.0, r * 1.0, r * 0.08);
    paintBody(c, col, -r * 0.85, r * 0.15, { light: 0.2, dark: -0.6, glow: 18 });
    const ad = c.createLinearGradient(-r * 0.85, 0, r * 0.85, 0);
    ad.addColorStop(0, shadeColor(col, 0.2)); ad.addColorStop(0.5, '#ffffff'); ad.addColorStop(1, shadeColor(col, 0.5));
    c.save(); c.globalAlpha = 0.85; c.fillStyle = ad;
    roundRectPath(c, -r * 0.86, -r * 0.72, r * 1.72, r * 0.74, r * 0.05); c.fill(); c.restore();
    c.fillStyle = shadeColor(col, -0.5);
    c.beginPath(); c.arc(-r * 0.4, -r * 0.35, r * 0.2, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 0.1, -r * 0.5, r * 0.8, r * 0.12, r * 0.05); c.fill();
    roundRectPath(c, -r * 0.1, -r * 0.28, r * 0.55, r * 0.1, r * 0.05); c.fill();
  },

  // T4 -- port warehouse with a saw-tooth roof and striped roller door.
  magazyn(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.28);
    c.beginPath(); c.ellipse(0, r * 0.82, r * 1.02, r * 0.14, 0, 0, Math.PI * 2); c.fill();
    c.beginPath();
    c.moveTo(-r, r * 0.8); c.lineTo(-r, -r * 0.3);
    for (let i = 0; i < 4; i++) { const x0 = -r + i * r * 0.5; c.lineTo(x0 + r * 0.5, -r * 0.75); c.lineTo(x0 + r * 0.5, -r * 0.3); }
    c.lineTo(r, r * 0.8); c.closePath();
    paintBody(c, col, -r * 0.75, r * 0.8, { light: 0.3, dark: -0.6 });
    roundRectPath(c, -r * 0.5, r * 0.05, r * 1.0, r * 0.75, r * 0.03);
    c.fillStyle = shadeColor(col, -0.55); c.fill();
    c.fillStyle = shadeColor(col, 0.35);
    for (let y = r * 0.12; y < r * 0.78; y += r * 0.13) c.fillRect(-r * 0.46, y, r * 0.92, r * 0.05);
    c.save(); c.shadowBlur = 10; c.shadowColor = '#fff'; c.fillStyle = '#fff';
    [-0.78, 0.66].forEach(x => c.fillRect(r * x, -r * 0.15, r * 0.12, r * 0.12)); c.restore();
  },

  /* ---------- v10: T5 (silver) heavy vehicles ---------- */

  // T5 -- city bus: long body, window band, destination sign.
  autobus(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.25);
    c.beginPath(); c.ellipse(0, r * 0.5, r * 1.1, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 1.05, -r * 0.55, r * 2.1, r * 0.95, r * 0.18);
    paintBody(c, col, -r * 0.55, r * 0.4, { light: 0.5, dark: -0.45, glow: 12 });
    const glass = c.createLinearGradient(0, -r * 0.45, 0, -r * 0.1);
    glass.addColorStop(0, '#ffffff'); glass.addColorStop(1, shadeColor(col, 0.55));
    c.fillStyle = glass;
    for (let i = 0; i < 6; i++) { roundRectPath(c, -r * 0.92 + i * r * 0.3, -r * 0.42, r * 0.24, r * 0.3, r * 0.04); c.fill(); }
    c.fillStyle = shadeColor(col, -0.45); c.fillRect(-r * 1.0, -r * 0.02, r * 2.0, r * 0.07);
    c.save(); c.shadowBlur = 10; c.shadowColor = '#fff'; c.fillStyle = '#fff';
    roundRectPath(c, r * 0.55, -r * 0.62, r * 0.4, r * 0.1, r * 0.03); c.fill(); c.restore();
    [-r * 0.62, r * 0.6].forEach(x => {
      c.beginPath(); c.arc(x, r * 0.4, r * 0.18, 0, Math.PI * 2); c.fillStyle = '#0a0f18'; c.fill();
      c.lineWidth = r * 0.05; c.strokeStyle = shadeColor(col, 0.2); c.stroke();
    });
  },

  // T5 -- two-car tram with a pantograph.
  tramwaj(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.25);
    c.beginPath(); c.ellipse(0, r * 0.52, r * 1.1, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = shadeColor(col, 0.3); c.lineWidth = r * 0.04;
    c.beginPath(); c.moveTo(-r * 0.2, -r * 0.5); c.lineTo(r * 0.1, -r * 0.85); c.lineTo(r * 0.35, -r * 0.5); c.moveTo(-r * 0.15, -r * 0.85); c.lineTo(r * 0.4, -r * 0.85); c.stroke();
    [[-r * 1.05, r * 1.0], [r * 0.05, r * 1.0]].forEach(([x, w]) => {
      roundRectPath(c, x, -r * 0.5, w, r * 0.9, r * 0.14);
      paintBody(c, col, -r * 0.5, r * 0.4, { light: 0.5, dark: -0.45, glow: 12 });
      const glass = c.createLinearGradient(0, -r * 0.4, 0, -r * 0.05);
      glass.addColorStop(0, '#ffffff'); glass.addColorStop(1, shadeColor(col, 0.55));
      c.fillStyle = glass;
      for (let i = 0; i < 3; i++) { roundRectPath(c, x + r * 0.1 + i * r * 0.3, -r * 0.38, r * 0.22, r * 0.32, r * 0.04); c.fill(); }
    });
    c.fillStyle = shadeColor(col, -0.45); c.fillRect(-r * 1.0, r * 0.08, r * 2.0, r * 0.05);
    [-r * 0.75, -r * 0.3, r * 0.35, r * 0.8].forEach(x => { c.beginPath(); c.arc(x, r * 0.42, r * 0.12, 0, Math.PI * 2); c.fillStyle = '#0a0f18'; c.fill(); });
  },

  // T5 -- heavy truck: cab + ribbed cargo box.
  ciezarowka(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.25);
    c.beginPath(); c.ellipse(0, r * 0.55, r * 1.1, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 1.05, -r * 0.65, r * 1.45, r * 1.0, r * 0.06);
    paintBody(c, col, -r * 0.65, r * 0.35, { light: 0.45, dark: -0.5 });
    c.strokeStyle = shadeColor(col, -0.3); c.lineWidth = r * 0.04;
    for (let x = -r * 0.85; x < r * 0.35; x += r * 0.2) { c.beginPath(); c.moveTo(x, -r * 0.6); c.lineTo(x, r * 0.3); c.stroke(); }
    c.beginPath(); c.moveTo(r * 0.45, r * 0.35); c.lineTo(r * 0.45, -r * 0.4); c.lineTo(r * 0.85, -r * 0.4); c.lineTo(r * 1.05, -r * 0.05); c.lineTo(r * 1.05, r * 0.35); c.closePath();
    paintBody(c, shadeColor(col, -0.25), -r * 0.4, r * 0.35, { light: 0.4, dark: -0.4 });
    c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(r * 0.55, -r * 0.05); c.lineTo(r * 0.55, -r * 0.3); c.lineTo(r * 0.8, -r * 0.3); c.lineTo(r * 0.95, -r * 0.05); c.closePath(); c.fill();
    [-r * 0.7, -r * 0.3, r * 0.75].forEach(x => {
      c.beginPath(); c.arc(x, r * 0.38, r * 0.17, 0, Math.PI * 2); c.fillStyle = '#0a0f18'; c.fill();
      c.lineWidth = r * 0.05; c.strokeStyle = shadeColor(col, 0.2); c.stroke();
    });
  },

  /* ---------- v10: T6 (green) towers ---------- */

  // T6 -- stepped skyscraper with a lit window grid and an antenna.
  wiezowiec(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.28);
    c.beginPath(); c.ellipse(0, r * 0.92, r * 0.75, r * 0.14, 0, 0, Math.PI * 2); c.fill();
    const blocks = [[-r * 0.55, r * 1.1, r * 1.65], [-r * 0.4, r * 0.8, r * 0.45], [-r * 0.22, r * 0.44, r * 0.3]];
    let top = r * 0.9;
    blocks.forEach(([x, w, h]) => {
      roundRectPath(c, x, top - h, w, h, r * 0.03);
      paintBody(c, col, top - h, top, { light: 0.4, dark: -0.6, glow: 14 });
      c.fillStyle = 'rgba(255,255,255,0.8)';
      for (let y = top - h + r * 0.08; y < top - r * 0.06; y += r * 0.14) {
        for (let xx = x + w * 0.12; xx < x + w - w * 0.12; xx += w / 5) c.fillRect(xx, y, w / 10, r * 0.05);
      }
      top -= h;
    });
    c.strokeStyle = shadeColor(col, 0.5); c.lineWidth = r * 0.04;
    c.beginPath(); c.moveTo(0, top); c.lineTo(0, top - r * 0.3); c.stroke();
  },

  // T6 -- lattice radio mast with dishes (live: blinking beacon).
  maszt(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.28);
    c.beginPath(); c.ellipse(0, r * 0.95, r * 0.6, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    c.save(); c.shadowBlur = 10; c.shadowColor = col;
    c.strokeStyle = shadeColor(col, 0.15); c.lineWidth = r * 0.07; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-r * 0.45, r * 0.92); c.lineTo(-r * 0.06, -r * 0.95); c.moveTo(r * 0.45, r * 0.92); c.lineTo(r * 0.06, -r * 0.95); c.stroke();
    c.restore();
    c.strokeStyle = shadeColor(col, -0.2); c.lineWidth = r * 0.035;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const y0 = r * 0.9 - i * r * 0.3, y1 = y0 - r * 0.3;
      const w0 = r * 0.45 * (1 - i / 6.5), w1 = r * 0.45 * (1 - (i + 1) / 6.5);
      c.moveTo(-w0, y0); c.lineTo(w1, y1); c.moveTo(w0, y0); c.lineTo(-w1, y1); c.moveTo(-w1, y1); c.lineTo(w1, y1);
    }
    c.stroke();
    [[-1, -r * 0.2], [1, -r * 0.5]].forEach(([dir, y]) => {
      c.beginPath(); c.ellipse(dir * r * 0.32, y, r * 0.16, r * 0.24, dir * 0.4, 0, Math.PI * 2);
      paintBody(c, col, y - r * 0.24, y + r * 0.24, { light: 0.5, dark: -0.3, glow: 8 });
    });
  },

  // T6 -- glass dome hall with ribs on a ringed base.
  kopula(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.28);
    c.beginPath(); c.ellipse(0, r * 0.82, r * 1.05, r * 0.16, 0, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 0.95, r * 0.35, r * 1.9, r * 0.45, r * 0.06);
    paintBody(c, col, r * 0.35, r * 0.8, { light: 0.2, dark: -0.6 });
    c.fillStyle = 'rgba(255,255,255,0.8)';
    for (let x = -r * 0.82; x < r * 0.82; x += r * 0.22) c.fillRect(x, r * 0.5, r * 0.1, r * 0.14);
    c.beginPath(); c.arc(0, r * 0.35, r * 0.85, Math.PI, 0); c.closePath();
    const dome = c.createRadialGradient(-r * 0.3, -r * 0.2, r * 0.05, 0, r * 0.35, r * 0.9);
    dome.addColorStop(0, '#ffffff'); dome.addColorStop(0.35, shadeColor(col, 0.4)); dome.addColorStop(1, shadeColor(col, -0.4));
    c.save(); c.shadowBlur = 18; c.shadowColor = col; c.fillStyle = dome; c.fill(); c.restore();
    c.strokeStyle = rgbaColor('#ffffff', 0.55); c.lineWidth = 1.2;
    for (let i = 1; i < 6; i++) { const a = Math.PI + (i / 6) * Math.PI; c.beginPath(); c.moveTo(0, -r * 0.5); c.quadraticCurveTo(Math.cos(a) * r * 0.6, r * 0.35 + Math.sin(a) * r * 0.6, Math.cos(a) * r * 0.85, r * 0.35); c.stroke(); }
    c.save(); c.shadowBlur = 12; c.shadowColor = '#fff'; c.fillStyle = '#fff'; c.beginPath(); c.arc(0, -r * 0.55, r * 0.07, 0, Math.PI * 2); c.fill(); c.restore();
  },

  /* ---------- v10: illustrated mission objects (were thin line icons) ---------- */

  // T2 -- rooftop AC unit with a fan grille.
  modul_dachowy(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.28);
    c.beginPath(); c.ellipse(0, r * 0.75, r * 0.95, r * 0.14, 0, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 0.9, -r * 0.6, r * 1.8, r * 1.3, r * 0.12);
    paintBody(c, col, -r * 0.6, r * 0.7, { light: 0.35, dark: -0.55 });
    c.beginPath(); c.arc(-r * 0.25, 0, r * 0.45, 0, Math.PI * 2); c.fillStyle = shadeColor(col, -0.6); c.fill();
    c.strokeStyle = shadeColor(col, 0.5); c.lineWidth = r * 0.06;
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; c.beginPath(); c.moveTo(-r * 0.25, 0); c.lineTo(-r * 0.25 + Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4); c.stroke(); }
    c.fillStyle = shadeColor(col, 0.6);
    for (let y = -r * 0.4; y < r * 0.45; y += r * 0.18) c.fillRect(r * 0.35, y, r * 0.4, r * 0.07);
  },

  // T2 -- marked shipping pallet stacked with boxes.
  paleta(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.28);
    c.beginPath(); c.ellipse(0, r * 0.85, r * 0.95, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = shadeColor(col, -0.45);
    c.fillRect(-r * 0.95, r * 0.55, r * 1.9, r * 0.12); c.fillRect(-r * 0.95, r * 0.72, r * 1.9, r * 0.1);
    [[-0.85, -0.05, 0.85, 0.6], [0.05, -0.05, 0.8, 0.6], [-0.45, -0.7, 0.9, 0.65]].forEach(([x, y, w, h]) => {
      roundRectPath(c, r * x, r * y, r * w, r * h, r * 0.05);
      paintBody(c, col, r * y, r * (y + h), { light: 0.35, dark: -0.45, glow: 6 });
    });
    c.save(); c.shadowBlur = 10; c.shadowColor = '#fff'; c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(-r * 0.1, -r * 0.55); c.lineTo(r * 0.15, -r * 0.4); c.lineTo(-r * 0.1, -r * 0.25); c.closePath(); c.fill(); c.restore();
  },

  // T2 -- glitch crystal cluster.
  krysztal(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.28);
    c.beginPath(); c.ellipse(0, r * 0.82, r * 0.8, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    [[-0.45, 0.8, 0.28, 1.2, -0.25], [0.4, 0.8, 0.26, 1.0, 0.3], [0, 0.85, 0.34, 1.75, 0]].forEach(([x, base, w, h, tilt]) => {
      c.save(); c.translate(r * x, r * base); c.rotate(tilt);
      c.beginPath(); c.moveTo(-r * w, 0); c.lineTo(-r * w, -r * h * 0.7); c.lineTo(0, -r * h); c.lineTo(r * w, -r * h * 0.7); c.lineTo(r * w, 0); c.closePath();
      paintBody(c, col, -r * h, 0, { light: 0.6, dark: -0.3, glow: 14 });
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.beginPath(); c.moveTo(-r * w * 0.6, -r * h * 0.1); c.lineTo(-r * w * 0.6, -r * h * 0.65); c.lineTo(0, -r * h * 0.9); c.lineTo(0, -r * h * 0.2); c.closePath(); c.fill();
      c.restore();
    });
  },

  // T2 -- shop display window with an awning and a lit mannequin.
  witryna(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.28);
    c.beginPath(); c.ellipse(0, r * 0.85, r * 0.95, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 0.9, -r * 0.55, r * 1.8, r * 1.35, r * 0.06);
    paintBody(c, col, -r * 0.55, r * 0.8, { light: 0.1, dark: -0.6 });
    const glass = c.createLinearGradient(0, -r * 0.4, 0, r * 0.65);
    glass.addColorStop(0, '#ffffff'); glass.addColorStop(1, rgbaColor(col, 0.6));
    c.save(); c.shadowBlur = 14; c.shadowColor = '#fff'; c.fillStyle = glass;
    roundRectPath(c, -r * 0.75, -r * 0.35, r * 1.5, r * 1.0, r * 0.04); c.fill(); c.restore();
    c.fillStyle = shadeColor(col, -0.4);
    c.beginPath(); c.arc(0, -r * 0.08, r * 0.12, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(-r * 0.2, r * 0.6); c.lineTo(-r * 0.12, r * 0.05); c.lineTo(r * 0.12, r * 0.05); c.lineTo(r * 0.2, r * 0.6); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-r, -r * 0.55); c.lineTo(-r * 0.85, -r * 0.85); c.lineTo(r * 0.85, -r * 0.85); c.lineTo(r, -r * 0.55); c.closePath();
    paintBody(c, col, -r * 0.85, -r * 0.55, { light: 0.5, dark: -0.1, glow: 10 });
  },

  // T2 -- sector key card on a lanyard ring.
  klucz_sektora(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.28);
    c.beginPath(); c.ellipse(0, r * 0.85, r * 0.8, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    c.save(); c.rotate(-0.2);
    roundRectPath(c, -r * 0.65, -r * 0.55, r * 1.3, r * 1.2, r * 0.14);
    paintBody(c, col, -r * 0.55, r * 0.65, { light: 0.45, dark: -0.45, glow: 12 });
    c.fillStyle = '#ffffff';
    roundRectPath(c, -r * 0.45, -r * 0.15, r * 0.35, r * 0.28, r * 0.05); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.fillRect(r * 0.0, -r * 0.12, r * 0.45, r * 0.07); c.fillRect(r * 0.0, r * 0.02, r * 0.32, r * 0.07);
    c.strokeStyle = shadeColor(col, 0.6); c.lineWidth = r * 0.07;
    c.beginPath(); c.arc(0, -r * 0.75, r * 0.2, 0, Math.PI * 2); c.stroke();
    c.restore();
  },

  // T2 -- signal emitter dish on a mast.
  emiter(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.28);
    c.beginPath(); c.ellipse(0, r * 0.88, r * 0.7, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 0.08, -r * 0.1, r * 0.16, r * 0.95, r * 0.05);
    paintBody(c, col, -r * 0.1, r * 0.85, { glow: 4 });
    roundRectPath(c, -r * 0.45, r * 0.7, r * 0.9, r * 0.2, r * 0.06);
    paintBody(c, col, r * 0.7, r * 0.9, { glow: 4 });
    c.beginPath(); c.ellipse(0, -r * 0.3, r * 0.75, r * 0.4, -0.35, Math.PI * 0.05, Math.PI * 1.05);
    c.closePath();
    paintBody(c, col, -r * 0.7, r * 0.1, { light: 0.55, dark: -0.3, glow: 14 });
    c.save(); c.shadowBlur = 14; c.shadowColor = '#fff'; c.fillStyle = '#fff';
    c.beginPath(); c.arc(r * 0.12, -r * 0.62, r * 0.09, 0, Math.PI * 2); c.fill(); c.restore();
  },

  // T2 -- garden marker: post with a leaf-shaped flag.
  znacznik_ogrodu(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.28);
    c.beginPath(); c.ellipse(0, r * 0.9, r * 0.6, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 0.4, -r * 0.85, r * 0.12, r * 1.75, r * 0.05);
    paintBody(c, col, -r * 0.85, r * 0.9, { glow: 4, light: 0.2, dark: -0.5 });
    c.beginPath(); c.moveTo(-r * 0.28, -r * 0.8); c.quadraticCurveTo(r * 0.75, -r * 0.95, r * 0.7, -r * 0.4); c.quadraticCurveTo(r * 0.2, -r * 0.05, -r * 0.28, -r * 0.15); c.closePath();
    paintBody(c, shadeColor(col, 0.25), -r * 0.9, -r * 0.05, { light: 0.4, dark: -0.3, glow: 12 });
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-r * 0.2, -r * 0.5); c.quadraticCurveTo(r * 0.25, -r * 0.55, r * 0.6, -r * 0.45); c.stroke();
    c.save(); c.shadowBlur = 10; c.shadowColor = col; c.fillStyle = col;
    c.beginPath(); c.arc(-r * 0.34, -r * 0.92, r * 0.12, 0, Math.PI * 2); c.fill(); c.restore();
  },

  // T3 -- power supply box with a lightning bolt.
  zasilacz(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.85, r * 0.85, r * 0.14, 0, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 0.75, -r * 0.7, r * 1.5, r * 1.5, r * 0.14);
    paintBody(c, col, -r * 0.7, r * 0.8, { light: 0.3, dark: -0.55, glow: 12 });
    roundRectPath(c, -r * 0.55, -r * 0.5, r * 1.1, r * 1.1, r * 0.1);
    c.fillStyle = shadeColor(col, -0.6); c.fill();
    c.save(); c.shadowBlur = 16; c.shadowColor = '#fff'; c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(r * 0.1, -r * 0.42); c.lineTo(-r * 0.25, r * 0.08); c.lineTo(-r * 0.02, r * 0.08); c.lineTo(-r * 0.12, r * 0.45); c.lineTo(r * 0.27, -r * 0.08); c.lineTo(r * 0.04, -r * 0.08); c.closePath(); c.fill();
    c.restore();
  },

  // T3 -- angled mirror panel on a stand.
  lustro(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.92, r * 0.6, r * 0.12, 0, 0, Math.PI * 2); c.fill();
    c.lineCap = 'round'; c.strokeStyle = shadeColor(col, -0.3); c.lineWidth = r * 0.08;
    c.beginPath(); c.moveTo(0, r * 0.3); c.lineTo(0, r * 0.88); c.moveTo(-r * 0.35, r * 0.9); c.lineTo(r * 0.35, r * 0.9); c.stroke();
    c.save(); c.rotate(-0.25);
    roundRectPath(c, -r * 0.5, -r * 0.95, r * 1.0, r * 1.3, r * 0.12);
    paintBody(c, col, -r * 0.95, r * 0.35, { light: 0.3, dark: -0.4, glow: 14 });
    const glass = c.createLinearGradient(-r * 0.4, -r * 0.85, r * 0.4, r * 0.25);
    glass.addColorStop(0, '#ffffff'); glass.addColorStop(0.5, shadeColor(col, 0.55)); glass.addColorStop(1, '#ffffff');
    c.fillStyle = glass;
    roundRectPath(c, -r * 0.38, -r * 0.83, r * 0.76, r * 1.06, r * 0.08); c.fill();
    c.restore();
  },

  // Structural bridge (Mostek) -- tinted by its powered state by the caller.
  mostek(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.28);
    c.beginPath(); c.ellipse(0, r * 0.7, r * 1.0, r * 0.14, 0, 0, Math.PI * 2); c.fill();
    c.lineCap = 'round';
    c.save(); c.shadowBlur = 12; c.shadowColor = col;
    c.strokeStyle = col; c.lineWidth = r * 0.12;
    c.beginPath(); c.moveTo(-r, r * 0.2); c.quadraticCurveTo(0, -r * 0.9, r, r * 0.2); c.stroke();
    c.restore();
    roundRectPath(c, -r, r * 0.15, r * 2, r * 0.2, r * 0.06);
    paintBody(c, col, r * 0.15, r * 0.35, { glow: 8 });
    c.strokeStyle = shadeColor(col, 0.4); c.lineWidth = r * 0.04;
    for (let i = -3; i <= 3; i++) { const x = i * r * 0.26; const y = -r * 0.55 * (1 - (x / r) ** 2) + r * 0.2 * (x / r) ** 2; c.beginPath(); c.moveTo(x, y + r * 0.05); c.lineTo(x, r * 0.15); c.stroke(); }
    [-r * 0.8, r * 0.8].forEach(x => { roundRectPath(c, x - r * 0.08, r * 0.3, r * 0.16, r * 0.4, r * 0.03); paintBody(c, col, r * 0.3, r * 0.7, { glow: 4 }); });
  },

  /* ---------- v10: boss landmarks as illustrated sprites ---------- */

  lm_kino(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.85, r * 1.0, r * 0.16, 0, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 0.85, -r * 0.3, r * 1.7, r * 1.12, r * 0.04);
    paintBody(c, col, -r * 0.3, r * 0.82, { light: 0.2, dark: -0.6 });
    c.beginPath(); c.moveTo(-r * 0.98, -r * 0.3); c.lineTo(-r * 0.85, -r * 0.62); c.lineTo(r * 0.85, -r * 0.62); c.lineTo(r * 0.98, -r * 0.3); c.closePath();
    paintBody(c, col, -r * 0.62, -r * 0.3, { light: 0.5, dark: -0.2, glow: 18 });
    c.save(); c.shadowBlur = 10; c.shadowColor = '#fff'; c.fillStyle = '#fff';
    c.font = `${Math.round(r * 0.24)}px 'Russo One', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('KINO', 0, -r * 0.46);
    for (let i = -6; i <= 6; i++) { c.beginPath(); c.arc(i * r * 0.13, -r * 0.24, r * 0.025, 0, Math.PI * 2); c.fill(); }
    c.restore();
    roundRectPath(c, -r * 0.6, r * 0.05, r * 1.2, r * 0.45, r * 0.04);
    const scr = c.createLinearGradient(-r * 0.6, 0, r * 0.6, 0);
    scr.addColorStop(0, '#ffffff'); scr.addColorStop(1, shadeColor(col, 0.45));
    c.fillStyle = scr; c.fill();
    roundRectPath(c, -r * 0.2, r * 0.55, r * 0.4, r * 0.27, r * 0.02); c.fillStyle = shadeColor(col, -0.65); c.fill();
  },

  lm_fontanna(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.75, r * 1.0, r * 0.22, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(0, r * 0.62, r * 0.92, r * 0.24, 0, 0, Math.PI * 2);
    paintBody(c, col, r * 0.38, r * 0.86, { light: 0.3, dark: -0.5 });
    c.beginPath(); c.ellipse(0, r * 0.56, r * 0.78, r * 0.16, 0, 0, Math.PI * 2); c.fillStyle = shadeColor(col, 0.6); c.fill();
    roundRectPath(c, -r * 0.1, -r * 0.25, r * 0.2, r * 0.82, r * 0.05);
    paintBody(c, col, -r * 0.25, r * 0.57, { glow: 6 });
    c.beginPath(); c.ellipse(0, -r * 0.2, r * 0.45, r * 0.11, 0, 0, Math.PI * 2);
    paintBody(c, col, -r * 0.31, -r * 0.09, { light: 0.5, glow: 10 });
    c.save(); c.shadowBlur = 14; c.shadowColor = col; c.strokeStyle = '#ffffff'; c.lineWidth = r * 0.05; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -r * 0.3); c.lineTo(0, -r * 0.95); c.stroke();
    [-1, 1].forEach(d => { c.beginPath(); c.moveTo(0, -r * 0.85); c.quadraticCurveTo(d * r * 0.55, -r * 0.95, d * r * 0.62, r * 0.45); c.stroke(); });
    c.restore();
  },

  lm_dzwig(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(-r * 0.3, r * 0.9, r * 0.6, r * 0.14, 0, 0, Math.PI * 2); c.fill();
    c.save(); c.shadowBlur = 12; c.shadowColor = col;
    c.strokeStyle = col; c.lineWidth = r * 0.07; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-r * 0.5, r * 0.88); c.lineTo(-r * 0.5, -r * 0.7); c.moveTo(-r * 0.25, r * 0.88); c.lineTo(-r * 0.25, -r * 0.7); c.stroke();
    c.beginPath(); c.moveTo(-r * 0.8, -r * 0.7); c.lineTo(r * 1.0, -r * 0.7); c.moveTo(-r * 0.8, -r * 0.55); c.lineTo(r * 1.0, -r * 0.55); c.stroke();
    c.restore();
    c.strokeStyle = shadeColor(col, -0.2); c.lineWidth = r * 0.03;
    c.beginPath();
    for (let y = r * 0.8; y > -r * 0.65; y -= r * 0.2) { c.moveTo(-r * 0.5, y); c.lineTo(-r * 0.25, y - r * 0.2); }
    for (let x = -r * 0.7; x < r * 0.95; x += r * 0.18) { c.moveTo(x, -r * 0.7); c.lineTo(x + r * 0.09, -r * 0.55); }
    c.stroke();
    c.beginPath(); c.moveTo(-r * 0.6, -r * 0.7); c.lineTo(-r * 0.375, -r * 1.05); c.lineTo(-r * 0.15, -r * 0.7); c.closePath();
    paintBody(c, col, -r * 1.05, -r * 0.7, { glow: 8 });
    roundRectPath(c, -r * 0.95, -r * 0.62, r * 0.3, r * 0.3, r * 0.03); paintBody(c, col, -r * 0.62, -r * 0.32, { light: 0.3, dark: -0.6 });
    c.strokeStyle = '#ffffff'; c.lineWidth = r * 0.02;
    c.beginPath(); c.moveTo(r * 0.75, -r * 0.55); c.lineTo(r * 0.75, r * 0.1); c.stroke();
    roundRectPath(c, r * 0.55, r * 0.1, r * 0.4, r * 0.3, r * 0.03); paintBody(c, shadeColor(col, 0.3), r * 0.1, r * 0.4, { glow: 10 });
  },

  lm_galeria(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.85, r * 1.0, r * 0.16, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(-r * 0.95, -r * 0.35); c.lineTo(0, -r * 0.85); c.lineTo(r * 0.95, -r * 0.35); c.closePath();
    paintBody(c, col, -r * 0.85, -r * 0.35, { light: 0.5, dark: -0.2, glow: 16 });
    roundRectPath(c, -r * 0.85, -r * 0.35, r * 1.7, r * 1.15, r * 0.03);
    paintBody(c, col, -r * 0.35, r * 0.8, { light: 0.2, dark: -0.6 });
    for (let i = 0; i < 4; i++) {
      const x = -r * 0.7 + i * r * 0.42;
      roundRectPath(c, x, -r * 0.2, r * 0.14, r * 0.95, r * 0.04);
      paintBody(c, col, -r * 0.2, r * 0.75, { light: 0.5, dark: -0.2, glow: 4 });
    }
    const art = ['#ffffff', shadeColor(col, 0.55), shadeColor(col, 0.3)];
    art.forEach((ac, i) => {
      c.save(); c.shadowBlur = 10; c.shadowColor = ac; c.fillStyle = ac;
      roundRectPath(c, -r * 0.5 + i * r * 0.42, r * 0.0, r * 0.2, r * 0.3, r * 0.03); c.fill(); c.restore();
    });
    c.save(); c.shadowBlur = 12; c.shadowColor = '#fff'; c.fillStyle = '#fff';
    c.beginPath(); c.arc(0, -r * 0.55, r * 0.09, 0, Math.PI * 2); c.fill(); c.restore();
  },

  lm_iglica(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.92, r * 0.7, r * 0.14, 0, 0, Math.PI * 2); c.fill();
    c.beginPath();
    c.moveTo(-r * 0.4, r * 0.9); c.lineTo(-r * 0.4, r * 0.25); c.lineTo(-r * 0.18, -r * 0.1); c.lineTo(-r * 0.18, -r * 0.5);
    c.lineTo(0, -r * 1.05); c.lineTo(r * 0.18, -r * 0.5); c.lineTo(r * 0.18, -r * 0.1); c.lineTo(r * 0.4, r * 0.25); c.lineTo(r * 0.4, r * 0.9); c.closePath();
    paintBody(c, col, -r * 1.05, r * 0.9, { light: 0.55, dark: -0.55, glow: 20 });
    c.fillStyle = 'rgba(255,255,255,0.8)';
    for (let y = r * 0.8; y > -r * 0.45; y -= r * 0.14) {
      const w = y > r * 0.2 ? r * 0.28 : r * 0.1;
      c.fillRect(-w, y, w * 2, r * 0.04);
    }
    c.save(); c.shadowBlur = 18; c.shadowColor = '#fff'; c.fillStyle = '#fff';
    c.beginPath(); c.arc(0, -r * 1.05, r * 0.06, 0, Math.PI * 2); c.fill(); c.restore();
  },

  lm_rdzen(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.88, r * 0.9, r * 0.16, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(0, -r * 0.95); c.lineTo(r * 0.75, -r * 0.05); c.lineTo(0, r * 0.85); c.lineTo(-r * 0.75, -r * 0.05); c.closePath();
    paintBody(c, col, -r * 0.95, r * 0.85, { light: 0.5, dark: -0.6, glow: 22 });
    c.beginPath(); c.moveTo(0, -r * 0.55); c.lineTo(r * 0.42, -r * 0.05); c.lineTo(0, r * 0.45); c.lineTo(-r * 0.42, -r * 0.05); c.closePath();
    const core = c.createRadialGradient(0, -r * 0.05, 0, 0, -r * 0.05, r * 0.5);
    core.addColorStop(0, '#ffffff'); core.addColorStop(0.5, shadeColor(col, 0.55)); core.addColorStop(1, shadeColor(col, -0.3));
    c.save(); c.shadowBlur = 20; c.shadowColor = col; c.fillStyle = core; c.fill(); c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(0, -r * 0.95); c.lineTo(0, r * 0.85); c.moveTo(-r * 0.75, -r * 0.05); c.lineTo(r * 0.75, -r * 0.05); c.stroke();
  },

  /* ---------- v15: Rozdział II boss landmarks + the golden byte ---------- */

  lm_stacja(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.86, r * 1.0, r * 0.15, 0, 0, Math.PI * 2); c.fill();
    roundRectPath(c, -r * 0.92, -r * 0.2, r * 1.84, r * 1.04, r * 0.05);
    paintBody(c, col, -r * 0.2, r * 0.84, { light: 0.2, dark: -0.62 });
    // the arched tunnel mouth
    c.beginPath(); c.moveTo(-r * 0.5, r * 0.84); c.lineTo(-r * 0.5, r * 0.25); c.arc(0, r * 0.25, r * 0.5, Math.PI, 0); c.lineTo(r * 0.5, r * 0.84); c.closePath();
    c.fillStyle = shadeColor(col, -0.82); c.fill();
    c.strokeStyle = shadeColor(col, 0.5); c.lineWidth = r * 0.05; c.stroke();
    c.strokeStyle = rgbaColor('#ffffff', 0.5); c.lineWidth = r * 0.025;
    c.beginPath(); c.moveTo(-r * 0.22, r * 0.84); c.lineTo(-r * 0.1, r * 0.4); c.moveTo(r * 0.22, r * 0.84); c.lineTo(r * 0.1, r * 0.4); c.stroke();
    // the "M" roundel on a mast
    c.strokeStyle = col; c.lineWidth = r * 0.05;
    c.beginPath(); c.moveTo(0, -r * 0.2); c.lineTo(0, -r * 0.5); c.stroke();
    c.beginPath(); c.arc(0, -r * 0.72, r * 0.26, 0, Math.PI * 2);
    paintBody(c, col, -r * 0.98, -r * 0.46, { light: 0.6, glow: 18 });
    c.save(); c.shadowBlur = 8; c.shadowColor = '#fff'; c.fillStyle = '#fff';
    c.font = `${Math.round(r * 0.3)}px 'Russo One', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('M', 0, -r * 0.7); c.restore();
  },

  lm_bazar(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.88, r * 1.0, r * 0.15, 0, 0, Math.PI * 2); c.fill();
    [-1, 1].forEach(d => { roundRectPath(c, d * r * 0.72 - r * 0.1, -r * 0.35, r * 0.2, r * 1.22, r * 0.04); paintBody(c, col, -r * 0.35, r * 0.87, { light: 0.3, dark: -0.55 }); });
    // curved double roof
    c.beginPath(); c.moveTo(-r * 1.05, -r * 0.32); c.quadraticCurveTo(0, -r * 0.62, r * 1.05, -r * 0.32); c.lineTo(r * 0.9, -r * 0.5); c.quadraticCurveTo(0, -r * 0.82, -r * 0.9, -r * 0.5); c.closePath();
    paintBody(c, col, -r * 0.82, -r * 0.32, { light: 0.5, glow: 16 });
    c.beginPath(); c.moveTo(-r * 0.7, -r * 0.62); c.quadraticCurveTo(0, -r * 0.95, r * 0.7, -r * 0.62); c.lineTo(r * 0.55, -r * 0.76); c.quadraticCurveTo(0, -r * 1.06, -r * 0.55, -r * 0.76); c.closePath();
    paintBody(c, col, -r * 1.06, -r * 0.62, { light: 0.6, glow: 12 });
    // hanging lanterns between the pillars
    for (let i = -2; i <= 2; i++) {
      const x = i * r * 0.26, y = -r * 0.1 + Math.abs(i) * r * 0.05;
      c.strokeStyle = rgbaColor('#ffffff', 0.4); c.lineWidth = 1; c.beginPath(); c.moveTo(x, -r * 0.36); c.lineTo(x, y - r * 0.08); c.stroke();
      c.save(); c.shadowBlur = 10; c.shadowColor = i % 2 ? '#FF54AD' : col; c.fillStyle = i % 2 ? '#FF54AD' : shadeColor(col, 0.5);
      c.beginPath(); c.ellipse(x, y, r * 0.08, r * 0.11, 0, 0, Math.PI * 2); c.fill(); c.restore();
    }
    roundRectPath(c, -r * 0.5, r * 0.35, r * 1.0, r * 0.5, r * 0.04); c.fillStyle = shadeColor(col, -0.7); c.fill();
  },

  lm_fabryka(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.88, r * 1.0, r * 0.15, 0, 0, Math.PI * 2); c.fill();
    // two chimneys behind
    [[-0.55, -1.0], [-0.2, -0.82]].forEach(([x, top]) => { roundRectPath(c, x * r, top * r, r * 0.18, r * 1.4, r * 0.03); paintBody(c, col, top * r, r * 0.4, { light: 0.35, dark: -0.5, glow: 6 }); });
    c.save(); c.strokeStyle = rgbaColor('#ffffff', 0.55); c.lineWidth = r * 0.03;
    [[-0.46, -1.1, 0.12], [-0.11, -0.93, 0.1]].forEach(([x, y, rr]) => { c.beginPath(); c.arc(x * r, y * r, rr * r, 0, Math.PI * 2); c.stroke(); });
    c.restore();
    // sawtooth hall
    c.beginPath(); c.moveTo(-r * 0.95, r * 0.86); c.lineTo(-r * 0.95, -r * 0.05);
    for (let i = 0; i < 4; i++) { const x0 = -r * 0.95 + i * r * 0.475; c.lineTo(x0 + r * 0.475, -r * 0.35); c.lineTo(x0 + r * 0.475, -r * 0.05); }
    c.lineTo(r * 0.95, r * 0.86); c.closePath();
    paintBody(c, col, -r * 0.35, r * 0.86, { light: 0.25, dark: -0.6 });
    // pixel windows
    for (let y = r * 0.1; y < r * 0.6; y += r * 0.18) for (let x = -r * 0.8; x < r * 0.8; x += r * 0.2) {
      c.fillStyle = (Math.round(x * 7 + y * 3) % 3) ? shadeColor(col, 0.55) : '#ffffff'; c.fillRect(x, y, r * 0.1, r * 0.1);
    }
    roundRectPath(c, -r * 0.18, r * 0.62, r * 0.36, r * 0.24, r * 0.02); c.fillStyle = shadeColor(col, -0.75); c.fill();
  },

  lm_latarnia(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.9, r * 0.8, r * 0.15, 0, 0, Math.PI * 2); c.fill();
    // light beams
    c.save(); c.globalAlpha = 0.35;
    [-1, 1].forEach(d => { c.beginPath(); c.moveTo(0, -r * 0.72); c.lineTo(d * r * 1.1, -r * 1.02); c.lineTo(d * r * 1.1, -r * 0.5); c.closePath(); c.fillStyle = shadeColor(col, 0.6); c.fill(); });
    c.restore();
    c.beginPath(); c.moveTo(-r * 0.36, r * 0.88); c.lineTo(-r * 0.2, -r * 0.55); c.lineTo(r * 0.2, -r * 0.55); c.lineTo(r * 0.36, r * 0.88); c.closePath();
    paintBody(c, col, -r * 0.55, r * 0.88, { light: 0.45, dark: -0.55, glow: 10 });
    // stripes
    c.save(); c.clip();
    c.fillStyle = rgbaColor('#ffffff', 0.55);
    for (let y = -r * 0.35; y < r * 0.85; y += r * 0.36) c.fillRect(-r * 0.4, y, r * 0.8, r * 0.14);
    c.restore();
    roundRectPath(c, -r * 0.28, -r * 0.62, r * 0.56, r * 0.1, r * 0.02); paintBody(c, col, -r * 0.62, -r * 0.52, { glow: 4 });
    roundRectPath(c, -r * 0.16, -r * 0.86, r * 0.32, r * 0.26, r * 0.04);
    c.save(); c.shadowBlur = 20; c.shadowColor = '#fff'; c.fillStyle = '#ffffff'; c.fill(); c.restore();
    c.beginPath(); c.moveTo(-r * 0.2, -r * 0.86); c.lineTo(0, -r * 1.04); c.lineTo(r * 0.2, -r * 0.86); c.closePath();
    paintBody(c, col, -r * 1.04, -r * 0.86, { glow: 8 });
  },

  lm_drzewo(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.9, r * 0.9, r * 0.15, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.moveTo(-r * 0.14, r * 0.88); c.lineTo(-r * 0.08, r * 0.05); c.lineTo(-r * 0.32, -r * 0.25); c.lineTo(-r * 0.22, -r * 0.3); c.lineTo(0, -r * 0.08);
    c.lineTo(r * 0.24, -r * 0.34); c.lineTo(r * 0.32, -r * 0.26); c.lineTo(r * 0.08, r * 0.05); c.lineTo(r * 0.14, r * 0.88); c.closePath();
    paintBody(c, col, -r * 0.34, r * 0.88, { light: 0.2, dark: -0.6, glow: 6 });
    // canopy: layered glowing blobs
    [[-0.5, -0.45, 0.36], [0.5, -0.45, 0.36], [0, -0.7, 0.42], [-0.25, -0.25, 0.3], [0.27, -0.22, 0.3]].forEach(([x, y, rr], i) => {
      c.beginPath(); c.arc(x * r, y * r, rr * r, 0, Math.PI * 2);
      paintBody(c, col, (y - rr) * r, (y + rr) * r, { light: 0.35 + i * 0.05, dark: -0.45, glow: 14 });
    });
    c.save(); c.shadowBlur = 8; c.shadowColor = '#fff'; c.fillStyle = '#ffffff';
    [[-0.5, -0.5], [0.42, -0.6], [0, -0.85], [0.15, -0.3], [-0.3, -0.2]].forEach(([x, y]) => { c.beginPath(); c.arc(x * r, y * r, r * 0.045, 0, Math.PI * 2); c.fill(); });
    c.restore();
  },

  lm_serwer(c, r, col) {
    c.fillStyle = rgbaColor(col, 0.3);
    c.beginPath(); c.ellipse(0, r * 0.9, r * 0.9, r * 0.15, 0, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 5; i++) {
      const y = r * 0.68 - i * r * 0.3;
      roundRectPath(c, -r * 0.55, y, r * 1.1, r * 0.24, r * 0.04);
      paintBody(c, col, y, y + r * 0.24, { light: 0.3, dark: -0.6, glow: i === 4 ? 14 : 4 });
      for (let k = 0; k < 4; k++) { c.fillStyle = (i + k) % 3 ? '#46D99A' : '#ffffff'; c.fillRect(-r * 0.42 + k * r * 0.1, y + r * 0.09, r * 0.05, r * 0.05); }
      c.fillStyle = rgbaColor('#ffffff', 0.35); c.fillRect(r * 0.05, y + r * 0.1, r * 0.4, r * 0.03);
    }
    // the cloud on top
    c.beginPath();
    c.arc(-r * 0.32, -r * 0.72, r * 0.2, Math.PI * 0.5, Math.PI * 1.5); c.arc(-r * 0.05, -r * 0.86, r * 0.26, Math.PI, 0); c.arc(r * 0.3, -r * 0.74, r * 0.2, Math.PI * 1.3, Math.PI * 0.5); c.closePath();
    paintBody(c, col, -r * 1.12, -r * 0.52, { light: 0.65, glow: 20 });
  },

  // v15 runner: a golden data byte -- a faceted gem with bit-ticks.
  bajt(c, r, col) {
    c.save(); c.shadowBlur = 14; c.shadowColor = col;
    c.beginPath();
    for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; const px = Math.cos(a) * r, py = Math.sin(a) * r; if (k) c.lineTo(px, py); else c.moveTo(px, py); }
    c.closePath(); c.fillStyle = col; c.fill(); c.restore();
    c.fillStyle = shadeColor(col, 0.55);
    c.beginPath(); c.moveTo(0, -r); c.lineTo(r * 0.87, -r * 0.5); c.lineTo(0, 0); c.lineTo(-r * 0.87, -r * 0.5); c.closePath(); c.fill();
    c.fillStyle = shadeColor(col, -0.35);
    c.beginPath(); c.moveTo(0, r); c.lineTo(r * 0.87, r * 0.5); c.lineTo(0, 0); c.lineTo(-r * 0.87, r * 0.5); c.closePath(); c.fill();
    c.fillStyle = '#04101D';
    c.font = `${Math.round(r * 0.9)}px 'Russo One', sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('1', 0, r * 0.05);
  },

  // Overdrive bonus portal: dark well + bright rim; live: swirl arms.
  portal(c, r, col) {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, '#05010f'); g.addColorStop(0.7, shadeColor(col, -0.6)); g.addColorStop(1, col);
    c.save(); c.shadowBlur = 16; c.shadowColor = col;
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.restore();
    c.lineWidth = 1.5; c.strokeStyle = shadeColor(col, 0.6); c.stroke();
  }
};

const OBJECT_SPRITE_CACHE = new Map();

/** Cached offscreen sprite for one object kind/color/radius (+ variant). */
function getObjectSprite(kind, color, r, variant) {
  const rr = Math.round(r);
  const key = `${kind}|${color}|${rr}|${variant || ''}`;
  let s = OBJECT_SPRITE_CACHE.get(key);
  if (s) return s;
  const S = 2; // supersample so sprites stay crisp on high-DPR phones
  const half = Math.ceil(rr * 1.7 + 14); // room for glow, beams, spires
  const cv = document.createElement('canvas');
  cv.width = cv.height = half * 2 * S;
  const c = cv.getContext('2d');
  c.scale(S, S);
  c.translate(half, half);
  // Soft ground glow under every object -- gives each one presence on the
  // dark grid and ties it to its tier color at a glance.
  const halo = c.createRadialGradient(0, 0, 0, 0, 0, rr * 1.35);
  halo.addColorStop(0, rgbaColor(color, 0.22)); halo.addColorStop(1, rgbaColor(color, 0));
  c.fillStyle = halo; c.beginPath(); c.arc(0, 0, rr * 1.35, 0, Math.PI * 2); c.fill();
  c.lineJoin = 'round';
  (OBJECT_ART[kind] || OBJECT_ART.fragment)(c, rr, color, variant);
  s = { canvas: cv, half };
  OBJECT_SPRITE_CACHE.set(key, s);
  return s;
}

/** Draws one object at the current origin: idle bob/breathe + cached
 *  sprite + its live overlay. `seed` de-syncs the idle motion between
 *  objects; `live` false skips the animated extras (used-up nodes etc.). */
/** v13: true on the lowest quality level -- objects skip the per-object
 *  sway/breathe transform and live extras (the v13 street trails roughly
 *  doubled how many pickups are on screen). Set by Game.applyGfx(). */
let OBJECT_ART_LITE = false;

function drawObjectArt(ctx, kind, color, r, t, seed, opts = {}) {
  if (OBJECT_ART_LITE && opts.live !== false) {
    const s = getObjectSprite(kind, color, r, opts.variant);
    ctx.drawImage(s.canvas, -s.half, -s.half, s.half * 2, s.half * 2);
    return;
  }
  const bob = Math.sin(t * 2.2 + seed) * Math.min(2, r * 0.08);
  const breathe = 1 + Math.sin(t * 3 + seed * 1.7) * 0.03;
  ctx.save();
  ctx.translate(0, bob);
  if (kind === 'fragment') ctx.rotate(Math.sin(t * 1.3 + seed) * 0.35);
  ctx.scale(breathe, breathe);
  const s = getObjectSprite(kind, color, r, opts.variant);
  ctx.drawImage(s.canvas, -s.half, -s.half, s.half * 2, s.half * 2);
  if (opts.live !== false) drawObjectLive(ctx, kind, color, r, t, seed);
  ctx.restore();
}

function drawObjectLive(ctx, kind, color, r, t, seed) {
  switch (kind) {
    case 'fragment': {
      // Occasional 4-point twinkle on the gem's corner.
      const tw = Math.max(0, Math.sin(t * 2.6 + seed * 3));
      if (tw < 0.75) return;
      const k = (tw - 0.75) / 0.25, s = r * 0.75 * k;
      ctx.save();
      ctx.translate(r * 0.35, -r * 0.55);
      ctx.fillStyle = `rgba(255,255,255,${0.9 * k})`;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.2, -s * 0.2); ctx.lineTo(s, 0); ctx.lineTo(s * 0.2, s * 0.2);
      ctx.lineTo(0, s); ctx.lineTo(-s * 0.2, s * 0.2); ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.2, -s * 0.2);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      break;
    }
    case 'wezel': {
      ctx.save();
      ctx.rotate(t * 1.6 + seed);
      ctx.strokeStyle = shadeColor(color, 0.55); ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, Math.PI * 0.55); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.75, Math.PI, Math.PI * 1.55); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'pylon': {
      const p = 0.5 + 0.5 * Math.sin(t * 4 + seed);
      ctx.strokeStyle = rgbaColor(color, 0.25 + 0.45 * p); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, -r * 0.6, r * (0.38 + 0.18 * p), 0, Math.PI * 2); ctx.stroke();
      break;
    }
    case 'landmark': {
      ctx.save();
      ctx.rotate(t * 0.6 + seed);
      ctx.strokeStyle = rgbaColor(color, 0.55); ctx.lineWidth = 1.5;
      ctx.setLineDash([r * 0.25, r * 0.18]);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      break;
    }
    case 'portal':
      drawSpiralArms(ctx, r * 0.95, [shadeColor(color, 0.5), color, shadeColor(color, 0.2)], t * 3 + seed, 3);
      break;
    case 'maszt': {
      // Blinking red aviation beacon on top.
      const on = Math.sin(t * 4 + seed) > 0.2;
      if (!on) break;
      ctx.save(); ctx.shadowBlur = 14; ctx.shadowColor = '#ff3860'; ctx.fillStyle = '#ff3860';
      ctx.beginPath(); ctx.arc(0, -r * 0.98, r * 0.07, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      break;
    }
    case 'billboard': {
      // Scanline sweeping across the ad panel.
      const x = ((t * 0.6 + seed) % 1) * r * 1.7 - r * 0.85;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x, -r * 0.72, r * 0.08, r * 0.74);
      break;
    }
    case 'lm_kino': case 'lm_fontanna': case 'lm_dzwig': case 'lm_galeria': case 'lm_iglica': case 'lm_rdzen':
    case 'lm_stacja': case 'lm_bazar': case 'lm_fabryka': case 'lm_latarnia': case 'lm_drzewo': case 'lm_serwer': {
      ctx.save();
      ctx.rotate(t * 0.5 + seed);
      ctx.strokeStyle = rgbaColor(color, 0.5); ctx.lineWidth = 1.5;
      ctx.setLineDash([r * 0.22, r * 0.16]);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.12, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      break;
    }
  }
}

/** Rotating spiral arms inside a circle of radius r (portal swirl and the
 *  hole vortex share this). colors cycle per arm. */
function drawSpiralArms(ctx, r, colors, angle, arms) {
  const turns = 1.15, steps = 22;
  ctx.save();
  const baseAlpha = ctx.globalAlpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let a = 0; a < arms; a++) {
    const base = angle + (a / arms) * Math.PI * 2;
    const col = colors[a % colors.length];
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const th = base + f * turns * Math.PI * 2;
        const rad = r * (0.12 + 0.88 * Math.pow(f, 1.25));
        const x = Math.cos(th) * rad, y = Math.sin(th) * rad;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = col;
      ctx.globalAlpha = baseAlpha * (pass === 0 ? 0.28 : 0.85);
      ctx.lineWidth = pass === 0 ? Math.max(2, r * 0.22) : Math.max(1, r * 0.07);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Cheap stable per-object phase so neighbours don't bob in sync. */
function artSeed(x, y) { return ((x * 0.013 + y * 0.029) % (Math.PI * 2)); }

/* ----------------------- Screen art (hub city, district tiles, daily map, power demos) -----------------------
   Player feedback: the meta screens were flat text panels ("mało
   efektowne"). These canvas renderers give each one a living picture:
   Miasto's Core City literally builds itself up as it charges, each
   Dzielnica is a little skyline that lights up as its missions clear, the
   Wyzwania tab shows today's real map, and every evolution card plays a
   tiny looping demo of what it does. */

/** Fits a canvas' backing store to its CSS box (x DPR) and returns
 *  {ctx, w, h} in CSS pixels, or null while it's not laid out. */
function prepCanvas(canvas) {
  if (!canvas) return null;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return null;
  const dpr = window.devicePixelRatio || 1;
  const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

/** Small padlock drawn on canvas (replaces the old emoji). */
function drawLockGlyph(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(242, 248, 255, 0.8)';
  ctx.fillStyle = 'rgba(242, 248, 255, 0.8)';
  ctx.lineWidth = s * 0.2;
  ctx.beginPath(); ctx.arc(0, -s * 0.15, s * 0.4, Math.PI, 0); ctx.stroke();
  ctx.fillRect(-s * 0.6, -s * 0.15, s * 1.2, s * 0.85);
  ctx.restore();
}

/* Golden Shot v9 first-run attract scene: a top-down slice of the neon
   city spiraling into a growing hole -- the actual game in miniature, so a
   brand-new player sees what they're about to play before tapping start. */
const WELCOME_KINDS = [
  ['fragment', '#50F0FA', 7], ['kapsula', '#50F0FA', 9], ['latarnia', '#FF54AD', 12],
  ['drzewo', '#FF54AD', 12], ['lawka', '#FF54AD', 12], ['kiosk', '#FF54AD', 13], ['samochod', '#EFCB63', 16]
];

function drawWelcomeScene(canvas, t) {
  const c = prepCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;
  const st = canvas._scene || (canvas._scene = { items: [], hole: new Hole('', 0, 0, true), grow: 0, last: t, pops: [], parts: [] });
  const dt = clamp(t - st.last, 0, 0.05);
  st.last = t;
  const cx = w / 2, cy = h * 0.58;
  const baseR = Math.min(w, h) * 0.12;

  // v12: the first thing a new player sees is the actual Neon City floor
  // the rounds are played on, drifting slowly under the hole (was a grid).
  const zoom = 0.62;
  const dpr = canvas.width / w;
  const camX = 1500 + Math.sin(t * 0.05) * 700, camY = 1500 + Math.cos(t * 0.04) * 700;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);
  SCREEN_FLOOR.draw(ctx, { cx: camX, cy: camY - (cy - h / 2) / zoom, hw: w / 2 / zoom + 40, hh: h / 2 / zoom + Math.abs(cy - h / 2) / zoom + 40, zoom, dpr, gfx: 1 }, null);
  ctx.restore();
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.8);
  bg.addColorStop(0, 'rgba(11, 35, 56, 0.25)'); bg.addColorStop(1, 'rgba(4, 16, 29, 0.85)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  while (st.items.length < 12) {
    const k = WELCOME_KINDS[Math.floor(Math.random() * WELCOME_KINDS.length)];
    st.items.push({ kind: k[0], color: k[1], r: k[2], ang: Math.random() * Math.PI * 2, d: Math.max(w, h) * (0.45 + Math.random() * 0.4), v: 0, seed: Math.random() * 6 });
  }
  const holeR = baseR * (1 + st.grow * 0.6);
  for (const it of st.items) {
    it.v = Math.min(it.v + dt * 40, 150);
    it.d -= it.v * dt * (0.4 + 60 / Math.max(it.d, 30));
    it.ang += dt * (0.4 + 70 / Math.max(it.d, 40));
    it.dead = it.d < holeR * 0.45;
    if (it.dead) {
      st.grow = Math.min(1, st.grow + 0.03);
      st.pops.push({ x: cx, y: cy - holeR - 16, life: 0.8, text: `+${it.r > 12 ? 30 : 5}`, color: it.color });
      for (let i = 0; i < 6; i++) st.parts.push({ a: it.ang + (Math.random() - 0.5), d: holeR * 1.3, life: 0.5, color: it.color });
    }
  }
  st.items = st.items.filter(it => !it.dead);
  if (st.grow >= 1) st.grow = 0; // loop the demo

  for (const p of st.parts) {
    p.life -= dt; p.d *= 0.92; p.a += dt * 6;
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(cx + Math.cos(p.a) * p.d - 1.5, cy + Math.sin(p.a) * p.d - 1.5, 3, 3);
  }
  st.parts = st.parts.filter(p => p.life > 0);
  ctx.globalAlpha = 1;

  for (const it of st.items) {
    const x = cx + Math.cos(it.ang) * it.d, y = cy + Math.sin(it.ang) * it.d * 0.75;
    const shrink = clamp((it.d - holeR * 0.45) / (holeR * 1.6), 0.15, 1);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(shrink, shrink);
    drawObjectArt(ctx, it.kind, it.color, it.r, t, it.seed);
    ctx.restore();
  }

  const hole = st.hole;
  hole.skin = 'rainbow';
  hole.x = cx; hole.y = cy; hole.radius = holeR;
  hole.draw(ctx, t);

  ctx.textAlign = 'center';
  ctx.font = `16px ${FONT_DISPLAY}`;
  for (const p of st.pops) {
    p.life -= dt; p.y -= 30 * dt;
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  st.pops = st.pops.filter(p => p.life > 0);
  ctx.globalAlpha = 1;
  const fade = ctx.createLinearGradient(0, h * 0.75, 0, h);
  fade.addColorStop(0, 'rgba(4, 16, 29, 0)'); fade.addColorStop(1, 'rgba(4, 16, 29, 1)');
  ctx.fillStyle = fade; ctx.fillRect(0, h * 0.75, w, h * 0.25);
  // Keep the logo (HTML on top) readable over the flying objects.
  const top = ctx.createLinearGradient(0, 0, 0, h * 0.42);
  top.addColorStop(0, 'rgba(4, 16, 29, 0.97)'); top.addColorStop(0.55, 'rgba(4, 16, 29, 0.8)'); top.addColorStop(1, 'rgba(4, 16, 29, 0)');
  ctx.fillStyle = top; ctx.fillRect(0, 0, w, h * 0.42);
}

const CITY_SLOT_COUNT = 18;
const CITY_STARTER_COUNT = 3;

/** Deterministic Core City layout: slot x/width/height plus the order the
 *  buildings get built in. Later builds are taller, so the skyline grows
 *  both denser and higher as Core City levels up. */
function cityLayout() {
  if (cityLayout.cache) return cityLayout.cache;
  const rng = new SeededRNG(0xC17);
  const order = [];
  for (let i = 0; i < CITY_SLOT_COUNT; i++) order.push(i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const slots = [];
  for (let i = 0; i < CITY_SLOT_COUNT; i++) {
    slots.push({ x: (i + 0.5) / CITY_SLOT_COUNT, w: 0.65 + rng.next() * 0.5, seed: rng.next() * 1000, antenna: rng.next() < 0.35 });
  }
  order.forEach((slotIdx, k) => { slots[slotIdx].buildRank = k; slots[slotIdx].h = 0.2 + 0.68 * (k / (CITY_SLOT_COUNT - 1)) * (0.8 + rng.next() * 0.25); });
  const stars = [];
  for (let i = 0; i < 40; i++) stars.push({ x: rng.next(), y: rng.next() * 0.55, s: 0.6 + rng.next() * 1.2, p: rng.next() * 6 });
  cityLayout.cache = { slots, stars };
  return cityLayout.cache;
}

const CITY_PALETTE = ['#50F0FA', '#9875FF', '#FF54AD', '#46D99A', '#EFCB63'];

/** Draws the Core City skyline. `progress` is 0..1 of the full city (one
 *  sixth of the way per Core City level, LVL6 = every building standing). */
function drawCityScene(canvas, progress, t) {
  const c = prepCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;
  const { slots, stars } = cityLayout();
  const ground = h - 18;

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#030b16'); sky.addColorStop(0.75, '#0a1d33'); sky.addColorStop(1, '#0d2a40');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  stars.forEach(s => {
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.5 + s.p);
    ctx.fillStyle = '#cfefff';
    ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
  });
  ctx.globalAlpha = 1;
  // City glow on the horizon grows with the city itself.
  const glow = ctx.createRadialGradient(w / 2, ground, 0, w / 2, ground, w * 0.7);
  glow.addColorStop(0, `rgba(80, 240, 250, ${0.12 + 0.25 * progress})`); glow.addColorStop(1, 'rgba(80, 240, 250, 0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

  // v12: a dark far skyline on the horizon -- the city waiting to be
  // rebuilt, so a LVL 1 Core City reads as a city at night, not an empty sky.
  const far = cityLayout.far || (cityLayout.far = (() => {
    const rng = new SeededRNG(0xFA2);
    const out = [];
    let x = -0.02;
    while (x < 1.02) { const bw = 0.025 + rng.next() * 0.045; out.push({ x, bw, bh: 0.12 + rng.next() * 0.3, seed: rng.next() * 100 }); x += bw * (0.75 + rng.next() * 0.4); }
    return out;
  })());
  far.forEach(b => {
    const bx = b.x * w, bw = b.bw * w, bh = b.bh * (ground - 14);
    ctx.fillStyle = '#0a1a2c';
    ctx.fillRect(bx, ground - bh, bw, bh);
    ctx.fillStyle = 'rgba(120, 190, 230, 0.16)';
    for (let wy = ground - bh + 5; wy < ground - 4; wy += 7) {
      for (let wx = bx + 2; wx < bx + bw - 2; wx += 5) {
        if (Math.sin(wx * 12.9 + wy * 7.3 + b.seed) > 0.55) ctx.fillRect(wx, wy, 2, 2);
      }
    }
  });
  const haze = ctx.createLinearGradient(0, ground - (ground - 14) * 0.45, 0, ground);
  haze.addColorStop(0, 'rgba(10, 29, 51, 0)'); haze.addColorStop(1, 'rgba(10, 29, 51, 0.55)');
  ctx.fillStyle = haze; ctx.fillRect(0, ground - (ground - 14) * 0.45, w, (ground - 14) * 0.45);

  // Three starter buildings always stand, so a brand-new city isn't empty;
  // Core City progress builds the remaining 15.
  const built = CITY_STARTER_COUNT + progress * (CITY_SLOT_COUNT - CITY_STARTER_COUNT);
  const slotW = w / CITY_SLOT_COUNT;
  // Draw back-to-front by height so tall towers don't hide behind houses.
  const sorted = slots.slice().sort((a, b) => b.h - a.h);
  sorted.forEach(s => {
    const bw = slotW * s.w * 1.25;
    const x = s.x * w - bw / 2;
    const fullH = s.h * (ground - 14);
    const col = CITY_PALETTE[s.buildRank % CITY_PALETTE.length];
    const state = s.buildRank < Math.floor(built) ? 'built' : (s.buildRank === Math.floor(built) ? 'building' : 'ghost');
    if (state === 'ghost') {
      if (s.buildRank > Math.floor(built) + 3) return; // only hint at the next few
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(160, 200, 230, 0.18)'; ctx.lineWidth = 1;
      ctx.strokeRect(x, ground - fullH, bw, fullH);
      ctx.setLineDash([]);
      return;
    }
    const frac = state === 'built' ? 1 : (built - Math.floor(built));
    const bh = Math.max(2, fullH * frac);
    const top = ground - bh;
    const body = ctx.createLinearGradient(0, top, 0, ground);
    body.addColorStop(0, shadeColor(col, -0.55)); body.addColorStop(1, shadeColor(col, -0.85));
    ctx.fillStyle = body; ctx.fillRect(x, top, bw, bh);
    ctx.save();
    ctx.shadowBlur = 8; ctx.shadowColor = col;
    ctx.strokeStyle = col; ctx.lineWidth = 1.2;
    ctx.strokeRect(x + 0.5, top + 0.5, bw - 1, bh - 1);
    ctx.restore();
    // Windows: a seeded grid, each window flickering on its own phase.
    const cols = Math.max(1, Math.floor(bw / 6)), rows = Math.floor(bh / 7);
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        const ph = (s.seed + r * 7.3 + k * 3.1);
        const on = Math.sin(ph) > -0.2 && Math.sin(t * 0.7 + ph * 1.3) > -0.85;
        if (!on) continue;
        ctx.fillStyle = Math.sin(ph * 2.1) > 0.6 ? '#ffffff' : shadeColor(col, 0.35);
        ctx.globalAlpha = 0.55 + 0.35 * Math.sin(ph * 0.9);
        ctx.fillRect(x + 2 + k * (bw - 3) / cols, top + 4 + r * 7, Math.max(1.5, (bw - 3) / cols - 2.5), 3);
      }
    }
    ctx.globalAlpha = 1;
    if (state === 'building') {
      // Scaffold outline of the final height + a crane with a blinking light.
      ctx.setLineDash([3, 2]);
      ctx.strokeStyle = 'rgba(239, 203, 99, 0.7)'; ctx.lineWidth = 1;
      ctx.strokeRect(x, ground - fullH, bw, fullH);
      ctx.setLineDash([]);
      ctx.strokeStyle = '#EFCB63'; ctx.lineWidth = 1.5;
      const cx = x + bw / 2, cTop = ground - fullH - 10;
      ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, cTop); ctx.lineTo(cx + bw * 1.1, cTop); ctx.moveTo(cx, cTop); ctx.lineTo(cx - bw * 0.4, cTop); ctx.stroke();
      const hookY = cTop + 6 + 4 * Math.sin(t * 2);
      ctx.beginPath(); ctx.moveTo(cx + bw, cTop); ctx.lineTo(cx + bw, hookY); ctx.stroke();
      if (Math.sin(t * 6) > 0) { ctx.fillStyle = '#ff3860'; ctx.beginPath(); ctx.arc(cx, cTop - 2, 2, 0, Math.PI * 2); ctx.fill(); }
    } else if (s.antenna && bh > 40) {
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + bw / 2, top); ctx.lineTo(x + bw / 2, top - 9); ctx.stroke();
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + s.seed);
      ctx.fillStyle = '#ff3860'; ctx.beginPath(); ctx.arc(x + bw / 2, top - 10, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  });

  // Ground + reflection strip.
  const g2 = ctx.createLinearGradient(0, ground, 0, h);
  g2.addColorStop(0, 'rgba(80, 240, 250, 0.35)'); g2.addColorStop(1, 'rgba(80, 240, 250, 0)');
  ctx.fillStyle = g2; ctx.fillRect(0, ground, w, h - ground);
  ctx.strokeStyle = 'rgba(80, 240, 250, 0.8)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, ground + 0.5); ctx.lineTo(w, ground + 0.5); ctx.stroke();
  // A slow scan line sweeping the skyline -- "the city is alive".
  const sx = ((t * 40) % (w + 80)) - 40;
  const scan = ctx.createLinearGradient(sx - 30, 0, sx + 30, 0);
  scan.addColorStop(0, 'rgba(80,240,250,0)'); scan.addColorStop(0.5, 'rgba(80,240,250,0.07)'); scan.addColorStop(1, 'rgba(80,240,250,0)');
  ctx.fillStyle = scan; ctx.fillRect(sx - 30, 0, 60, ground);
}

const DISTRICT_COLORS = { plac: '#50F0FA', park: '#46D99A', port: '#EFCB63', galeria: '#FF54AD', dachy: '#9875FF', rdzen: '#CBD5E1' };
CHAPTER_II.forEach(d => { DISTRICT_COLORS[d.id] = d.color; });

/** The boss landmark of a district (its missions' `setup.landmark`, last one wins). */
function districtLandmarkId(district) {
  let id = null;
  district.missions.forEach(mid => { const m = campaignMissionById(mid); if (m && m.setup && m.setup.landmark) id = m.setup.landmark; });
  return id;
}

/** One district tile: a small skyline that lights up building by building
 *  as missions clear, with the district's boss landmark in front (dim and
 *  padlocked until the district is fully rebuilt). */
function drawDistrictTile(canvas, district, done, total, unlocked, t) {
  const c = prepCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;
  const col = DISTRICT_COLORS[district.id] || '#50F0FA';
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, unlocked ? shadeColor(col, -0.86) : '#060d16');
  bg.addColorStop(1, unlocked ? shadeColor(col, -0.7) : '#09131f');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const rng = new SeededRNG(district.order * 977);
  const ground = h - 8;
  const n = 9;
  const frac = total ? done / total : 0;
  for (let i = 0; i < n; i++) {
    const bw = w / n * (0.7 + rng.next() * 0.25);
    const bx = (i + 0.5) * w / n - bw / 2;
    const bh = (0.25 + rng.next() * 0.45) * h;
    const lit = unlocked && (i + 0.5) / n <= frac + 0.001;
    ctx.fillStyle = lit ? shadeColor(col, -0.55) : 'rgba(30, 50, 70, 0.6)';
    ctx.fillRect(bx, ground - bh, bw, bh);
    if (lit) {
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.strokeRect(bx + 0.5, ground - bh + 0.5, bw - 1, bh - 1);
      for (let y = ground - bh + 4; y < ground - 3; y += 6) {
        for (let x = bx + 2; x < bx + bw - 3; x += 5) {
          if (Math.sin(x * 1.7 + y * 0.9 + t * 0.8) > -0.3) { ctx.fillStyle = shadeColor(col, 0.4); ctx.fillRect(x, y, 2, 2); }
        }
      }
    }
  }
  ctx.fillStyle = unlocked ? rgbaColor(col, 0.5) : 'rgba(120,140,160,0.2)';
  ctx.fillRect(0, ground, w, 1);
  const lm = districtLandmarkId(district);
  if (lm && unlocked) {
    // The district's boss landmark: dim until the district is rebuilt,
    // lit once it is (no padlock -- the district itself IS unlocked).
    const complete = done >= total;
    const e = new CampaignEntity('landmark', w * 0.5, h * 0.5, { landmarkId: lm });
    e.unlocked = true;
    e.radius = h * 0.36;
    ctx.save();
    if (!complete) ctx.globalAlpha = 0.45;
    e.draw(ctx, false);
    ctx.restore();
  }
  if (!unlocked) {
    ctx.fillStyle = 'rgba(4, 16, 29, 0.55)'; ctx.fillRect(0, 0, w, h);
  }
}

/** v15: a boss landmark's neon name plate, under its base. */
function drawLandmarkSign(ctx, text, r, col) {
  const fs = clamp(Math.round(r * 0.2), 8, 22);
  ctx.save();
  ctx.font = `${fs}px ${FONT_DISPLAY}`;
  const tw = ctx.measureText(text).width;
  const w = tw + fs * 1.1, h = fs * 1.5, y = r * 0.98;
  roundRectPath(ctx, -w / 2, y - h / 2, w, h, h * 0.3);
  ctx.fillStyle = 'rgba(4, 16, 29, 0.88)'; ctx.fill();
  ctx.lineWidth = Math.max(1, fs * 0.1); ctx.strokeStyle = col; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, y + fs * 0.05);
  ctx.restore();
}

/** Today's real Daily Seed Challenge layout as a mini-map: every object
 *  dot in its tier color, plus where you'll spawn. */
function drawDailyMapPreview(canvas, layout, t) {
  const c = prepCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;
  ctx.fillStyle = '#030b16'; ctx.fillRect(0, 0, w, h);
  // v12: the real city -- the same district map as the in-round minimap.
  const dpr = canvas.width / w;
  ctx.drawImage(SCREEN_FLOOR.minimap(Math.round(Math.max(w, h) * dpr), null, { minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H }), 0, 0, w, h);
  const sx = w / WORLD_W, sy = h / WORLD_H;
  layout.objects.forEach(o => {
    const big = o.tier === 'node' || o.tier === 'pylon' || o.tier === 'landmark';
    const s = big ? 3.5 : (o.tier === 'fragment' ? 1.6 : 2.4);
    ctx.fillStyle = TIERS[o.tier].color;
    ctx.fillRect(o.x * sx - s / 2, o.y * sy - s / 2, s, s);
  });
  const px = layout.spawn.x * sx, py = layout.spawn.y * sy;
  const pulse = (t % 1.6) / 1.6;
  ctx.strokeStyle = `rgba(255,255,255,${1 - pulse})`; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(px, py, 4 + pulse * 12, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
}

/* ---- Evolution / power card demos ----
   Each card plays a ~2.4 s loop showing its effect on a tiny board, so the
   player sees what they're picking instead of decoding an icon. */
const POWER_DEMO_FOR = {
  magnet_pulse: 'magnet', magnes: 'magnet',
  slipstream: 'speed', impuls: 'tierSpeed',
  phase_edge: 'shield',
  combo_reactor: 'combo', reaktor: 'combo',
  scanner: 'scanner', skaner: 'scanner',
  shockwave: 'shockwave',
  bounty_core: 'bounty'
};

function demoHole(cache, x, y, r, color) {
  const hole = cache.hole || (cache.hole = new Hole('', 0, 0, true));
  hole.skin = 'custom'; hole.edgeColor = color; hole.auraId = 'none';
  hole.x = x; hole.y = y; hole.radius = r;
  return hole;
}

function demoFragment(ctx, x, y, t, color, scale = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  drawObjectArt(ctx, 'fragment', color || TIERS.fragment.color, 6, t, x * 0.1, { live: false });
  ctx.restore();
}

function drawPowerDemo(canvas, powerId, color, t) {
  const c = prepCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;
  const cache = canvas._demo || (canvas._demo = {});
  const cx = w / 2, cy = h / 2;
  const L = 2.4, f = (t % L) / L;
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.7);
  bg.addColorStop(0, rgbaColor(color, 0.18)); bg.addColorStop(1, 'rgba(4,16,29,0)');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const R = Math.min(w, h) * 0.17;
  const kind = POWER_DEMO_FOR[powerId] || 'magnet';

  if (kind === 'magnet') {
    ctx.setLineDash([3, 4]); ctx.strokeStyle = rgbaColor(color, 0.5); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, w * 0.42, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2 + 0.4;
      const p = (f + i / 6) % 1;
      const d = lerp(w * 0.42, R * 0.3, p * p);
      ctx.strokeStyle = rgbaColor(color, 0.35 * p); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (d + 8), cy + Math.sin(a) * (d + 8)); ctx.lineTo(cx + Math.cos(a) * (d + 2), cy + Math.sin(a) * (d + 2)); ctx.stroke();
      demoFragment(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, t, null, 1 - p * 0.6);
    }
    demoHole(cache, cx, cy, R, color).draw(ctx, t);
  } else if (kind === 'speed' || kind === 'tierSpeed') {
    // Hole runs across eating a chain; after the 3rd bite it surges.
    const xs = [0.28, 0.42, 0.56];
    const boostAt = 0.6;
    const px = f < boostAt ? lerp(w * 0.12, w * 0.6, f / boostAt) : lerp(w * 0.6, w * 1.15, (f - boostAt) / (1 - boostAt));
    xs.forEach(x => { if (px < x * w + 4) demoFragment(ctx, x * w, cy, t); });
    if (f > boostAt) {
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = rgbaColor(color, 0.6 - i * 0.1); ctx.lineWidth = 2;
        const yy = cy - R * 0.7 + i * R * 0.35;
        ctx.beginPath(); ctx.moveTo(px - R - 6 - i * 3, yy); ctx.lineTo(px - R - 26 - i * 5, yy); ctx.stroke();
      }
    }
    if (kind === 'tierSpeed' && f > boostAt - 0.05 && f < boostAt + 0.2) {
      const k = (f - boostAt + 0.05) / 0.25;
      ctx.strokeStyle = rgbaColor(color, 1 - k); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, cy, R + k * R * 1.5, 0, Math.PI * 2); ctx.stroke();
    }
    demoHole(cache, px, cy, R * (f > boostAt ? 1.1 : 1), color).draw(ctx, t);
    ctx.fillStyle = color; ctx.font = `800 11px ${FONT_UI}`; ctx.textAlign = 'center';
    if (f > boostAt) ctx.fillText(kind === 'tierSpeed' ? '+20%' : '+60%', w * 0.5, h * 0.2);
  } else if (kind === 'shield') {
    const hit = f > 0.3 && f < 0.45;
    const rx = lerp(w * 1.1, w * 0.62, Math.min(1, f / 0.35));
    const enemy = cache.enemy || (cache.enemy = new Hole('', 0, 0, false));
    enemy.skin = 'custom'; enemy.edgeColor = '#ff3860'; enemy.x = f < 0.45 ? rx : lerp(w * 0.62, w * 1.2, (f - 0.45) / 0.55); enemy.y = cy; enemy.radius = R * 1.5;
    demoHole(cache, w * 0.36, cy, R, color).draw(ctx, t);
    enemy.draw(ctx, t);
    const sh = 0.5 + 0.5 * Math.sin(t * 8);
    ctx.strokeStyle = rgbaColor(color, f > 0.3 ? 0.5 + 0.4 * sh : 0.25); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(w * 0.36, cy, R + 7, 0, Math.PI * 2); ctx.stroke();
    if (f > 0.3) {
      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(w * 0.36, cy, R + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - (f - 0.3) / 0.7)); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `800 11px ${FONT_UI}`; ctx.textAlign = 'center';
      ctx.fillText('4 s', w * 0.36, cy - R - 18);
    }
    if (hit) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(w * 0.5, cy, 6, 0, Math.PI * 2); ctx.fill(); }
  } else if (kind === 'combo') {
    const bites = [0.12, 0.42, 0.72];
    const xs = [0.25, 0.5, 0.75];
    let combo = 0, lastBite = -1;
    bites.forEach((b, i) => { if (f >= b) { combo = i + 1; lastBite = b; } else demoFragment(ctx, xs[i] * w, cy - R * 0.2, t); });
    const px = lerp(w * 0.1, w * 0.85, f);
    demoHole(cache, px, cy - R * 0.2, R * 0.9, color).draw(ctx, t);
    // Combo window bar: long enough to bridge the gaps.
    const left = lastBite < 0 ? 0 : Math.max(0, 1 - (f - lastBite) / 0.45);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(w * 0.15, h * 0.82, w * 0.7, 5);
    ctx.fillStyle = color; ctx.fillRect(w * 0.15, h * 0.82, w * 0.7 * left, 5);
    if (combo > 0) {
      ctx.fillStyle = color; ctx.font = `800 12px ${FONT_UI}`; ctx.textAlign = 'center';
      ctx.fillText(`COMBO ×${combo}`, w / 2, h * 0.2);
    }
  } else if (kind === 'scanner') {
    demoHole(cache, w * 0.3, h * 0.62, R * 0.9, color).draw(ctx, t);
    const tx = w * 0.74, ty = h * 0.3;
    ctx.save(); ctx.translate(tx, ty);
    drawObjectArt(ctx, 'samochod', TIERS.vehicle.color, 12, t, 1, { live: false });
    ctx.restore();
    demoFragment(ctx, w * 0.2, h * 0.25, t); demoFragment(ctx, w * 0.62, h * 0.75, t);
    const ping = f % 0.5 / 0.5;
    ctx.strokeStyle = rgbaColor(color, 1 - ping); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(tx, ty, 14 + ping * 16, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([4, 4]); ctx.strokeStyle = rgbaColor(color, 0.7); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.62); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
  } else if (kind === 'shockwave') {
    const pop = f > 0.25 ? Math.min(1, (f - 0.25) / 0.5) : 0;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const d = R * 1.8 + pop * w * 0.25;
      demoFragment(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, t, i % 2 ? TIERS.prop.color : null, 0.9);
    }
    if (pop > 0 && pop < 1) {
      ctx.strokeStyle = rgbaColor(color, 1 - pop); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, R + pop * w * 0.4, 0, Math.PI * 2); ctx.stroke();
    }
    demoHole(cache, cx, cy, R * (f > 0.25 ? 1.2 : 1), color).draw(ctx, t);
    if (f > 0.2 && f < 0.5) { ctx.fillStyle = '#fff'; ctx.font = `800 11px ${FONT_UI}`; ctx.textAlign = 'center'; ctx.fillText('T2!', cx, cy - R - 10); }
  } else if (kind === 'bounty') {
    const ex = w * 0.66, ey = cy;
    const eaten = f > 0.62;
    const px = lerp(w * 0.18, ex, Math.min(1, f / 0.62));
    if (!eaten) {
      const enemy = cache.enemy || (cache.enemy = new Hole('', 0, 0, false));
      enemy.skin = 'custom'; enemy.edgeColor = '#FF54AD'; enemy.x = ex; enemy.y = ey; enemy.radius = R * 0.8;
      enemy.draw(ctx, t);
      // Target reticle (same mark as in the round, see drawBountyMarker()).
      ctx.strokeStyle = '#FF54AD'; ctx.lineWidth = 2;
      const rr = R * 0.8 + 6;
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + t;
        ctx.beginPath(); ctx.arc(ex, ey, rr, a + 0.3, a + Math.PI / 2 - 0.3); ctx.stroke();
      }
    }
    demoHole(cache, px, cy, R * 1.25, '#50F0FA').draw(ctx, t);
    if (eaten) {
      const k = (f - 0.62) / 0.38;
      ctx.globalAlpha = 1 - k; ctx.fillStyle = color; ctx.font = `800 14px ${FONT_UI}`; ctx.textAlign = 'center';
      ctx.fillText('+40', ex, ey - R - 6 - k * 14); ctx.globalAlpha = 1;
    }
  }
}

/* ----------------------- Neon City floor (Golden Shot v12 "VISUAL") -----------------------
   Every round used to be played on a black void with a faint grid -- nothing
   on screen said "you are eating a CITY". The floor is now a top-down night
   city: an 8x8 grid of blocks split by roads (lane dashes, crosswalks, neon
   curbs, street-lamp light pools) whose lots are painted per district --
   Plac Neonów plazas, Park Impulsów lawns and ponds, Port Syntez container
   yards and basins, Galeria Glitch murals, Dachy Prądu rooftops, Rdzeń
   Miasta circuit boards around a glowing core at the world center.
   Arena uses a fixed district map (the same city every run, so players learn
   it); Campaign paints the whole board in its mission's district.

   It is pure decoration: flat, dim and glow-free next to the objects, so it
   never competes with what can be eaten. Each block is painted ONCE into an
   offscreen chunk canvas (CityFloor.render) and blitted per frame, so the
   whole floor costs ~15 drawImage calls -- the same fill cost as the old
   full-screen clear. Chunks are re-painted lazily (2 per frame) when the
   zoom moves them to another resolution step, prefetched one block ahead
   of the camera, and evicted LRU under a pixel budget. */

const CITY_PITCH = 375;   // block grid: 8x8 blocks over the 3000x3000 world
const CITY_ROAD = 64;     // road width, centered on every grid line
const CITY_WALK = 12;     // sidewalk band along each block's edge
const CITY_BLEED = 2;     // chunk overlap (world units), so neighbours never show a seam
const CITY_CELLS = Math.round(WORLD_W / CITY_PITCH);

// Arena's district map, one letter per block (row = y). Rdzeń Miasta sits on
// the world center; the other five districts wrap around it.
const CITY_DISTRICT_MAP = [
  'pppkkkkk',
  'ppppkkkk',
  'ppppkkkd',
  'oopRRkdd',
  'oooRRddd',
  'ooogggdd',
  'oogggggd',
  'oogggggg'
];
const CITY_DISTRICT_KEYS = { p: 'plac', k: 'park', o: 'port', g: 'galeria', d: 'dachy', R: 'rdzen' };
const CITY_LOT_BASE = { plac: '#081620', park: '#061b19', port: '#0a131b', galeria: '#120c1d', dachy: '#0c0f22', rdzen: '#0a121b',
  metro: '#06141a', bazar: '#14110a', fabryka: '#140a14', zatoka: '#0e0c1f', ogrody: '#071a12', chmura: '#0d1218' };
// v15: Rozdział II districts reuse a Rozdział I lot painter in their own color.
const DISTRICT_FLOOR = {};
CHAPTER_II.forEach(d => { DISTRICT_FLOOR[d.id] = d.floor; });

/** Floor accent for a district: its color mixed toward the panel slate, so
 *  full-saturation tier colors stay reserved for the objects (a cyan curb
 *  around cyan T1 fragments made the smallest pickups the hardest to see). */
function cityTone(col) {
  const cache = cityTone.cache || (cityTone.cache = {});
  if (cache[col]) return cache[col];
  const a = hexToRgb(col), b = hexToRgb('#315A72');
  const m = a.map((v, k) => Math.round(v + (b[k] - v) * 0.4));
  return (cache[col] = '#' + m.map(v => v.toString(16).padStart(2, '0')).join(''));
}

function cityHash(i, j, k = 0) {
  let h = Math.imul(i + 101, 73856093) ^ Math.imul(j + 211, 19349663) ^ Math.imul(k + 7, 83492791);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  return (h ^ (h >>> 13)) >>> 0;
}

/** District id of block (i, j) -- `theme` (Campaign) overrides the map. */
function cityDistrict(i, j, theme) {
  if (theme) return theme;
  const row = CITY_DISTRICT_MAP[clamp(j, 0, CITY_CELLS - 1)];
  return CITY_DISTRICT_KEYS[row[clamp(i, 0, CITY_CELLS - 1)]] || 'plac';
}

/** District id under a world position (Arena's minimap label). */
function cityDistrictAt(x, y) {
  return cityDistrict(Math.floor(x / CITY_PITCH), Math.floor(y / CITY_PITCH));
}

/** The one block per Arena district (nearest its centroid) whose lot
 *  carries the district's name painted on the ground. */
function citySignCells() {
  if (citySignCells.cache) return citySignCells.cache;
  const acc = {};
  for (let j = 0; j < CITY_CELLS; j++) {
    for (let i = 0; i < CITY_CELLS; i++) {
      const d = cityDistrict(i, j);
      const a = acc[d] || (acc[d] = { sx: 0, sy: 0, n: 0, cells: [] });
      a.sx += i; a.sy += j; a.n++; a.cells.push([i, j]);
    }
  }
  const out = {};
  for (const d in acc) {
    const a = acc[d], cx = a.sx / a.n, cy = a.sy / a.n;
    let best = null, bd = Infinity;
    for (const [i, j] of a.cells) { const dd = (i - cx) ** 2 + (j - cy) ** 2; if (dd < bd) { bd = dd; best = `${i},${j}`; } }
    out[best] = d;
  }
  citySignCells.cache = out;
  return out;
}

/** A street-lamp light pool in one color, painted once (chunk paints blit it). */
function cityLampSprite(col) {
  const cache = cityLampSprite.cache || (cityLampSprite.cache = new Map());
  let cv = cache.get(col);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, rgbaColor(col, 0.16)); g.addColorStop(1, rgbaColor(col, 0));
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  cache.set(col, cv);
  return cv;
}

/* Lot painters: (c, x, y, s, col, rng, variant) paint inside the lot square
   (x, y, s) -- already clipped and filled with CITY_LOT_BASE. Everything is
   low-alpha line work in the district color: readable as "floor", never as
   a pickup. */
const CITY_LOT_PAINTERS = {
  plac(c, x, y, s, col, rng, v) {
    const cx = x + s / 2, cy = y + s / 2;
    if (v === 2) {
      c.strokeStyle = rgbaColor(col, 0.07); c.lineWidth = 1;
      for (let r = 18; r < s * 0.72; r += 18) { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }
      // Fountain basin: a light water tint with broken rings -- never a dark
      // disc with a bright rim, which is what a hole looks like.
      c.fillStyle = rgbaColor(col, 0.1);
      c.beginPath(); c.arc(cx, cy, s * 0.17, 0, Math.PI * 2); c.fill();
      c.setLineDash([10, 7]);
      c.strokeStyle = rgbaColor(col, 0.26); c.lineWidth = 2.5; c.stroke();
      c.setLineDash([4, 6]);
      c.strokeStyle = rgbaColor(col, 0.14); c.lineWidth = 1.2;
      for (let r = s * 0.05; r < s * 0.15; r += s * 0.035) { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }
      c.setLineDash([]);
      return;
    }
    c.strokeStyle = rgbaColor(col, 0.07); c.lineWidth = 1;
    c.beginPath();
    for (let k = 24; k < s; k += 24) { c.moveTo(x + k, y); c.lineTo(x + k, y + s); c.moveTo(x, y + k); c.lineTo(x + s, y + k); }
    c.stroke();
    if (v === 1) {
      // Two long light strips set into the paving.
      const horiz = rng.next() < 0.5;
      c.fillStyle = rgbaColor(col, 0.1);
      for (const f of [0.32, 0.68]) {
        if (horiz) c.fillRect(x + s * 0.1, y + s * f - 2, s * 0.8, 4); else c.fillRect(x + s * f - 2, y + s * 0.1, 4, s * 0.8);
      }
      return;
    }
    // Neon compass emblem in the middle of the square.
    const r = s * 0.26;
    c.strokeStyle = rgbaColor(col, 0.24); c.lineWidth = 3;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = rgbaColor(col, 0.12); c.lineWidth = 1.5;
    c.beginPath(); c.arc(cx, cy, r * 0.7, 0, Math.PI * 2); c.stroke();
    c.beginPath();
    for (let k = 0; k < 12; k++) {
      const a = k * Math.PI / 6;
      c.moveTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
      c.lineTo(cx + Math.cos(a) * r * (k % 3 ? 0.88 : 0.97), cy + Math.sin(a) * r * (k % 3 ? 0.88 : 0.97));
    }
    c.stroke();
  },
  park(c, x, y, s, col, rng, v) {
    for (let k = 0; k < 240; k++) {
      c.fillStyle = rgbaColor(col, 0.05 + rng.next() * 0.08);
      const d = 1.2 + rng.next() * 1.6;
      c.fillRect(x + rng.next() * s, y + rng.next() * s, d, d);
    }
    const cx = x + s / 2, cy = y + s / 2;
    if (v === 1) {
      c.strokeStyle = '#0d2b2a'; c.lineWidth = 12;
      c.beginPath(); c.ellipse(cx, cy, s * 0.36, s * 0.29, 0, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#041b2b';
      c.beginPath(); c.ellipse(cx, cy, s * 0.29, s * 0.22, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(80, 240, 250, 0.26)'; c.lineWidth = 2; c.stroke();
      c.strokeStyle = 'rgba(80, 240, 250, 0.1)'; c.lineWidth = 1.2;
      for (let k = 0; k < 4; k++) {
        const ox = (rng.next() - 0.5) * s * 0.3, oy = (rng.next() - 0.5) * s * 0.2;
        c.beginPath(); c.arc(cx + ox, cy + oy, 10 + rng.next() * 14, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      }
      return;
    }
    if (v === 2) {
      c.fillStyle = 'rgba(70, 217, 154, 0.035)';
      for (let k = 0; k < s; k += 36) c.fillRect(x + k, y + 22, 18, s - 44);
      c.strokeStyle = 'rgba(242, 248, 255, 0.13)'; c.lineWidth = 2;
      c.strokeRect(x + 22, y + 22, s - 44, s - 44);
      c.beginPath(); c.moveTo(x + 22, cy); c.lineTo(x + s - 22, cy); c.stroke();
      c.beginPath(); c.arc(cx, cy, 30, 0, Math.PI * 2); c.stroke();
      c.strokeRect(cx - 40, y + 22, 80, 34); c.strokeRect(cx - 40, y + s - 56, 80, 34);
      return;
    }
    // A winding footpath with flowerbeds beside it.
    const sx = x + rng.next() * s * 0.3, ex = x + s * 0.7 + rng.next() * s * 0.3;
    c.lineCap = 'round';
    for (const [w, st] of [[18, rgbaColor(col, 0.16)], [15, '#0d2b2a']]) {
      c.strokeStyle = st; c.lineWidth = w;
      c.beginPath(); c.moveTo(sx, y - 10); c.bezierCurveTo(x + s * 1.05, y + s * 0.3, x - s * 0.05, y + s * 0.7, ex, y + s + 10); c.stroke();
    }
    for (let k = 0; k < 3; k++) {
      const fx = x + 40 + rng.next() * (s - 80), fy = y + 40 + rng.next() * (s - 80);
      c.fillStyle = '#0a2422';
      c.beginPath(); c.ellipse(fx, fy, 22, 13, rng.next() * 3, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255, 84, 173, 0.22)'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = 'rgba(255, 84, 173, 0.2)';
      for (let n = 0; n < 6; n++) c.fillRect(fx + (rng.next() - 0.5) * 30, fy + (rng.next() - 0.5) * 14, 2, 2);
    }
  },
  port(c, x, y, s, col, rng, v) {
    if (v === 1) {
      c.fillStyle = '#03152a'; c.fillRect(x, y, s, s);
      c.strokeStyle = 'rgba(80, 240, 250, 0.11)'; c.lineWidth = 1.5;
      c.beginPath();
      for (let k = 0; k < 34; k++) {
        const wx = x + rng.next() * s, wy = y + 30 + rng.next() * (s - 30);
        c.moveTo(wx, wy); c.quadraticCurveTo(wx + 7, wy - 4, wx + 14, wy);
      }
      c.stroke();
      c.fillStyle = '#16140b'; c.fillRect(x, y, s, 22);
      c.strokeStyle = rgbaColor(col, 0.32); c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, y + 22); c.lineTo(x + s, y + 22); c.stroke();
      c.strokeStyle = rgbaColor(col, 0.1); c.lineWidth = 1;
      c.beginPath();
      for (let k = 12; k < s; k += 12) { c.moveTo(x + k, y); c.lineTo(x + k, y + 22); }
      c.stroke();
      c.fillStyle = rgbaColor(col, 0.4);
      for (let k = 30; k < s; k += 60) { c.beginPath(); c.arc(x + k, y + 17, 3, 0, Math.PI * 2); c.fill(); }
      return;
    }
    if (v === 2) {
      c.strokeStyle = 'rgba(242, 248, 255, 0.12)'; c.lineWidth = 2;
      c.beginPath();
      for (const row of [0.08, 0.58]) {
        const ry = y + s * row;
        c.moveTo(x + 14, ry + s * 0.34); c.lineTo(x + s - 14, ry + s * 0.34);
        for (let k = 14; k <= s - 14; k += 30) { c.moveTo(x + k, ry); c.lineTo(x + k, ry + s * 0.34); }
      }
      c.stroke();
      c.font = `120px ${FONT_DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = rgbaColor(col, 0.07); c.fillText('P', x + s / 2, y + s / 2 + 6);
      return;
    }
    // Neutral steel (not the tier colors), so a container never reads as a
    // pink crate or a gold car pickup.
    const colors = ['#8FA6B8', '#6E8798', '#A4B6C4'];
    for (let row = 0; row < 6; row++) {
      for (let k = 0; k < 4; k++) {
        if (rng.next() < 0.18) continue;
        const cc = colors[Math.floor(rng.next() * colors.length)];
        const bx = x + 14 + k * 67, by = y + 16 + row * 45;
        c.fillStyle = rgbaColor(cc, 0.06); c.fillRect(bx, by, 58, 30);
        c.strokeStyle = rgbaColor(cc, 0.16); c.lineWidth = 1.2; c.strokeRect(bx + 0.5, by + 0.5, 57, 29);
        c.strokeStyle = rgbaColor(cc, 0.07);
        c.beginPath();
        for (let n = 1; n < 6; n++) { c.moveTo(bx + n * 9.6, by + 3); c.lineTo(bx + n * 9.6, by + 27); }
        c.stroke();
      }
    }
  },
  galeria(c, x, y, s, col, rng, v) {
    const cx = x + s / 2, cy = y + s / 2;
    if (v === 1) {
      const cols = [col, '#50F0FA', '#9875FF'];
      for (let k = 0; k < 9; k++) {
        c.fillStyle = rgbaColor(cols[k % 3], 0.06 + rng.next() * 0.07);
        const px = x + rng.next() * s, py = y + rng.next() * s, r = 30 + rng.next() * 60;
        c.beginPath(); c.moveTo(px, py - r); c.lineTo(px + r * 0.9, py + r * 0.6); c.lineTo(px - r * 0.9, py + r * 0.6); c.closePath(); c.fill();
      }
      for (let k = 0; k < 7; k++) {
        c.fillStyle = rgbaColor(cols[k % 3], 0.12 + rng.next() * 0.1);
        c.fillRect(x + rng.next() * s * 0.5, y + rng.next() * s, s * (0.2 + rng.next() * 0.4), 2 + rng.next() * 7);
      }
      return;
    }
    if (v === 2) {
      const r = s * 0.38;
      c.fillStyle = 'rgba(152, 117, 255, 0.06)';
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = rgbaColor(col, 0.2); c.lineWidth = 2; c.stroke();
      c.strokeStyle = rgbaColor(col, 0.1); c.lineWidth = 1.2;
      c.beginPath();
      for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      c.stroke();
      for (const f of [0.35, 0.7]) { c.beginPath(); c.arc(cx, cy, r * f, 0, Math.PI * 2); c.stroke(); }
      return;
    }
    const t = 36;
    for (let a = 0; a * t < s; a++) {
      for (let b = 0; b * t < s; b++) {
        c.fillStyle = (a + b) % 2 ? rgbaColor(col, 0.055) : 'rgba(152, 117, 255, 0.04)';
        c.fillRect(x + a * t, y + b * t, t, t);
      }
    }
  },
  dachy(c, x, y, s, col, rng, v) {
    c.strokeStyle = rgbaColor(col, 0.22); c.lineWidth = 2;
    c.strokeRect(x + 7, y + 7, s - 14, s - 14);
    const cx = x + s / 2, cy = y + s / 2;
    if (v === 0) {
      c.strokeStyle = rgbaColor(col, 0.34); c.lineWidth = 4;
      c.beginPath(); c.arc(cx, cy, s * 0.27, 0, Math.PI * 2); c.stroke();
      c.lineWidth = 7; c.lineCap = 'butt';
      c.beginPath();
      c.moveTo(cx - 22, cy - 28); c.lineTo(cx - 22, cy + 28);
      c.moveTo(cx + 22, cy - 28); c.lineTo(cx + 22, cy + 28);
      c.moveTo(cx - 22, cy); c.lineTo(cx + 22, cy);
      c.stroke();
      c.fillStyle = 'rgba(239, 203, 99, 0.45)';
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; c.beginPath(); c.arc(cx + Math.cos(a) * s * 0.33, cy + Math.sin(a) * s * 0.33, 2.2, 0, Math.PI * 2); c.fill(); }
      return;
    }
    if (v === 1) {
      for (let row = 0; row < 7; row++) {
        for (let k = 0; k < 5; k++) {
          const bx = x + 20 + k * 50, by = y + 20 + row * 36;
          c.fillStyle = '#0d1838'; c.fillRect(bx, by, 44, 28);
          c.strokeStyle = 'rgba(152, 117, 255, 0.26)'; c.lineWidth = 1; c.strokeRect(bx + 0.5, by + 0.5, 43, 27);
          c.beginPath(); c.moveTo(bx + 22, by + 2); c.lineTo(bx + 22, by + 26); c.moveTo(bx + 2, by + 14); c.lineTo(bx + 42, by + 14); c.stroke();
        }
      }
      return;
    }
    c.strokeStyle = rgbaColor(col, 0.14); c.lineWidth = 3;
    c.beginPath();
    let px = x + 20, py = y + 20 + rng.next() * (s - 40);
    c.moveTo(px, py);
    for (let k = 0; k < 4; k++) { px += 40 + rng.next() * 40; c.lineTo(px, py); py = y + 20 + rng.next() * (s - 40); c.lineTo(px, py); }
    c.stroke();
    for (let k = 0; k < 5; k++) {
      const w = 24 + rng.next() * 22, bx = x + 16 + rng.next() * (s - w - 32), by = y + 16 + rng.next() * (s - w - 32);
      // Roof vents in neutral steel with grille slats (no diagonal "X" -- the
      // crate and roof-module pickups use diagonals).
      c.fillStyle = '#11152c'; c.fillRect(bx, by, w, w);
      c.strokeStyle = 'rgba(164, 182, 196, 0.2)'; c.lineWidth = 1.2; c.strokeRect(bx + 0.5, by + 0.5, w - 1, w - 1);
      c.strokeStyle = 'rgba(164, 182, 196, 0.1)';
      c.beginPath(); for (let g = 5; g < w - 3; g += 5) { c.moveTo(bx + 4, by + g); c.lineTo(bx + w - 4, by + g); } c.stroke();
    }
  },
  rdzen(c, x, y, s, col, rng, v) {
    const snap = (n) => Math.round(n / 12) * 12;
    c.lineWidth = 1.5;
    for (let k = 0; k < 16; k++) {
      c.strokeStyle = k % 4 ? rgbaColor(col, 0.16) : 'rgba(80, 240, 250, 0.2)';
      let px = x + snap(rng.next() * s), py = y + snap(rng.next() * s);
      c.beginPath(); c.moveTo(px, py);
      for (let n = 0; n < 3 + Math.floor(rng.next() * 3); n++) {
        const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1]];
        const [dx, dy] = dirs[Math.floor(rng.next() * dirs.length)];
        const len = 24 + snap(rng.next() * 48);
        px = clamp(px + dx * len, x + 8, x + s - 8); py = clamp(py + dy * len, y + 8, y + s - 8);
        c.lineTo(px, py);
      }
      c.stroke();
      c.fillStyle = CITY_LOT_BASE.rdzen;
      c.beginPath(); c.arc(px, py, 3.2, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    const chips = v + 1;
    for (let k = 0; k < chips; k++) {
      const w = 44 + rng.next() * 20, bx = x + 20 + rng.next() * (s - w - 40), by = y + 20 + rng.next() * (s - w - 40);
      c.fillStyle = '#0e1824'; c.fillRect(bx, by, w, w);
      c.strokeStyle = 'rgba(80, 240, 250, 0.26)'; c.lineWidth = 1.2; c.strokeRect(bx + 0.5, by + 0.5, w - 1, w - 1);
      c.strokeStyle = rgbaColor(col, 0.18);
      c.beginPath();
      for (let p = 8; p < w - 4; p += 8) { c.moveTo(bx + p, by); c.lineTo(bx + p, by - 6); c.moveTo(bx + p, by + w); c.lineTo(bx + p, by + w + 6); }
      c.stroke();
    }
  }
};

/** Paints the world rect of chunk (i, j) into `c` (already transformed to
 *  world coordinates). Every feature that can cross a chunk edge (roads,
 *  crosswalks, lamp pools, the core rings) is a deterministic world-space
 *  feature drawn by every chunk it touches, so neighbours line up exactly. */
function paintCityChunk(c, i, j, theme) {
  const P = CITY_PITCH, R = CITY_ROAD, W = CITY_WALK, B = CITY_BLEED;
  const x0 = i * P - B, y0 = j * P - B, size = P + 2 * B;
  c.fillStyle = '#050b14';
  c.fillRect(x0, y0, size, size);
  const rng = new SeededRNG(cityHash(i, j, 1));
  c.fillStyle = 'rgba(150, 190, 225, 0.05)';
  for (let k = 0; k < 160; k++) c.fillRect(i * P + rng.next() * P, j * P + rng.next() * P, 1.3, 1.3);

  // Block: sidewalk band, district lot, neon curb.
  const d = cityDistrict(i, j, theme);
  const col = cityTone(DISTRICT_COLORS[d] || '#50F0FA');
  const bx = i * P + R / 2, by = j * P + R / 2, bs = P - R;
  c.fillStyle = '#0c1826';
  roundRectPath(c, bx, by, bs, bs, 10); c.fill();
  c.strokeStyle = 'rgba(160, 200, 230, 0.06)'; c.lineWidth = 1;
  c.beginPath();
  for (let k = 18; k < bs - 4; k += 18) {
    c.moveTo(bx + k, by); c.lineTo(bx + k, by + W); c.moveTo(bx + k, by + bs - W); c.lineTo(bx + k, by + bs);
    c.moveTo(bx, by + k); c.lineTo(bx + W, by + k); c.moveTo(bx + bs - W, by + k); c.lineTo(bx + bs, by + k);
  }
  c.stroke();
  const lx = bx + W, ly = by + W, ls = bs - 2 * W;
  c.save();
  c.beginPath(); c.rect(lx, ly, ls, ls); c.clip();
  c.fillStyle = CITY_LOT_BASE[d] || '#081620';
  c.fillRect(lx, ly, ls, ls);
  const lotRng = new SeededRNG(cityHash(i, j, 2));
  const variant = Math.floor(lotRng.next() * 3);
  (CITY_LOT_PAINTERS[d] || CITY_LOT_PAINTERS[DISTRICT_FLOOR[d]] || CITY_LOT_PAINTERS.plac)(c, lx, ly, ls, col, lotRng, variant);
  const sign = !theme && citySignCells()[`${i},${j}`];
  if (sign) {
    // The district's name painted across its central lot (rdzen's lot sits
    // under the core rings, so it keeps just the circuitry).
    const dist = DISTRICTS.find(x => x.id === sign);
    if (dist && sign !== 'rdzen') {
      const words = dist.name.toUpperCase().split(' ');
      c.font = `40px ${FONT_DISPLAY}`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.strokeStyle = rgbaColor(col, 0.2); c.lineWidth = 1.5;
      words.forEach((w, k) => {
        const ty = ly + ls / 2 + (k - (words.length - 1) / 2) * 48;
        c.strokeText(w, lx + ls / 2, ty);
      });
    }
  }
  c.restore();
  c.strokeStyle = rgbaColor(col, 0.12); c.lineWidth = 1;
  c.strokeRect(lx + 0.5, ly + 0.5, ls - 1, ls - 1);
  // Neon curb: a soft wide band + a crisp line (no shadow blur -- the floor
  // must never glow like a pickup).
  c.strokeStyle = rgbaColor(col, 0.12); c.lineWidth = 6;
  roundRectPath(c, bx + 0.8, by + 0.8, bs - 1.6, bs - 1.6, 10); c.stroke();
  c.strokeStyle = rgbaColor(col, 0.42); c.lineWidth = 1.5;
  roundRectPath(c, bx + 0.8, by + 0.8, bs - 1.6, bs - 1.6, 10); c.stroke();

  // Road markings on the 4 grid lines around this block (both halves --
  // the neighbour chunk paints the same strokes, clipped to its side).
  const edge = (L) => !theme && (L <= 0 || L >= CITY_CELLS);
  for (const vertical of [true, false]) {
    for (const L of [vertical ? i : j, (vertical ? i : j) + 1]) {
      for (let seg = (vertical ? j : i) - 1; seg <= (vertical ? j : i) + 1; seg++) {
        if (seg < 0 || seg >= CITY_CELLS) continue;
        const pos = L * P, a = seg * P + R / 2, b = (seg + 1) * P - R / 2;
        const line = (off, from, to) => {
          if (vertical) { c.moveTo(pos + off, from); c.lineTo(pos + off, to); } else { c.moveTo(from, pos + off); c.lineTo(to, pos + off); }
        };
        if (edge(L)) {
          // The world's edge: a hazard-striped barrier instead of a road.
          c.save();
          c.beginPath();
          if (vertical) c.rect(pos - R / 2, a - R / 2, R, b - a + R); else c.rect(a - R / 2, pos - R / 2, b - a + R, R);
          c.clip();
          c.strokeStyle = 'rgba(255, 84, 173, 0.16)'; c.lineWidth = 9;
          c.beginPath();
          for (let k = a - R; k < b + R; k += 26) {
            if (vertical) { c.moveTo(pos - R, k); c.lineTo(pos + R, k + 2 * R); } else { c.moveTo(k, pos - R); c.lineTo(k + 2 * R, pos + R); }
          }
          c.stroke();
          c.restore();
          continue;
        }
        const roadCol = cityTone(DISTRICT_COLORS[vertical ? cityDistrict(Math.max(0, L - 1), seg, theme) : cityDistrict(seg, Math.max(0, L - 1), theme)] || '#50F0FA');
        c.strokeStyle = 'rgba(242, 248, 255, 0.09)'; c.lineWidth = 1.5; c.setLineDash([]);
        c.beginPath(); line(-R / 2 + 5, a, b); line(R / 2 - 5, a, b); c.stroke();
        c.strokeStyle = rgbaColor(roadCol, 0.34); c.lineWidth = 2.5; c.setLineDash([20, 16]);
        c.beginPath(); line(0, a + 30, b - 30); c.stroke();
        c.setLineDash([]);
      }
    }
  }
  // Crosswalks on every arm of the 4 corner intersections.
  c.fillStyle = 'rgba(242, 248, 255, 0.13)';
  for (const gi of [i, i + 1]) {
    for (const gj of [j, j + 1]) {
      const ix = gi * P, iy = gj * P;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const armL = dx ? gi + Math.min(dx, 0) : gj + Math.min(dy, 0);
        if (armL < 0 || armL >= CITY_CELLS) continue;
        if (!theme && (dx ? (gj <= 0 || gj >= CITY_CELLS) : (gi <= 0 || gi >= CITY_CELLS))) continue;
        const start = R / 2 + 5;
        for (let s = -R / 2 + 7; s < R / 2 - 7; s += 9) {
          if (dx) c.fillRect(ix + dx * start + (dx < 0 ? -18 : 0), iy + s, 18, 5);
          else c.fillRect(ix + s, iy + dy * start + (dy < 0 ? -18 : 0), 5, 18);
        }
      }
    }
  }
  // Rdzeń Miasta: the city core's energy rings around the world center.
  if (!theme || theme === 'rdzen') {
    const cx = WORLD_W / 2, cy = WORLD_H / 2;
    if (Math.abs(cx - (i + 0.5) * P) < P && Math.abs(cy - (j + 0.5) * P) < P) {
      c.save();
      c.strokeStyle = 'rgba(80, 240, 250, 0.16)'; c.lineWidth = 2;
      c.setLineDash([26, 14]);
      for (const r of [120, 180, 250]) { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }
      c.setLineDash([]);
      // The core itself: a silver hexagon emblem painted on the junction
      // (light, open line art -- not a dark disc, which reads as a hole).
      c.strokeStyle = 'rgba(203, 213, 225, 0.4)'; c.lineWidth = 2.5;
      c.beginPath();
      for (let k = 0; k <= 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; const px = cx + Math.cos(a) * 24, py = cy + Math.sin(a) * 24; if (k) c.lineTo(px, py); else c.moveTo(px, py); }
      c.stroke();
      c.beginPath();
      for (let k = 0; k < 3; k++) { const a = Math.PI / 6 + k * Math.PI / 3; c.moveTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 12); c.lineTo(cx - Math.cos(a) * 12, cy - Math.sin(a) * 12); }
      c.stroke();
      c.restore();
    }
  }
  // Street-lamp light pools (from this block and its neighbours, since a
  // pool reaches a few units across the chunk edge).
  c.save();
  c.globalCompositeOperation = 'lighter';
  const LAMP_R = 46;
  for (let ni = i - 1; ni <= i + 1; ni++) {
    for (let nj = j - 1; nj <= j + 1; nj++) {
      if (ni < 0 || nj < 0 || ni >= CITY_CELLS || nj >= CITY_CELLS) continue;
      const lc = cityTone(DISTRICT_COLORS[cityDistrict(ni, nj, theme)] || '#50F0FA');
      const o = R / 2 + W / 2, far = P - o;
      const pts = [[o, o], [far, o], [o, far], [far, far], [P / 2, o], [P / 2, far], [o, P / 2], [far, P / 2]];
      for (const [px0, py0] of pts) {
        const px = ni * P + px0, py = nj * P + py0;
        if (px < x0 - LAMP_R || px > x0 + size + LAMP_R || py < y0 - LAMP_R || py > y0 + size + LAMP_R) continue;
        c.drawImage(cityLampSprite(lc), px - LAMP_R, py - LAMP_R, LAMP_R * 2, LAMP_R * 2);
        c.fillStyle = 'rgba(230, 250, 255, 0.55)';
        c.beginPath(); c.arc(px, py, 2.2, 0, Math.PI * 2); c.fill();
      }
    }
  }
  c.restore();
}

class CityFloor {
  constructor() {
    this.cache = new Map(); // key -> { canvas, scale, px, frame }
    this.pixels = 0;
    this.frame = 0;
    this.renders = 0;       // chunk paints so far (QA reads this)
    this.minimaps = new Map();
  }

  /** Resolution steps for chunk canvases (device px per world unit). */
  static quantize(s) {
    const steps = [0.75, 1, 1.5, 2];
    for (const st of steps) if (s <= st + 0.08) return st;
    return 2;
  }

  render(i, j, scale, theme, old) {
    const P = CITY_PITCH, B = CITY_BLEED;
    const px = Math.ceil((P + 2 * B) * scale);
    const cv = old && old.canvas.width === px ? old.canvas : document.createElement('canvas');
    cv.width = cv.height = px;
    const c = cv.getContext('2d');
    c.setTransform(px / (P + 2 * B), 0, 0, px / (P + 2 * B), 0, 0);
    c.translate(B - i * P, B - j * P);
    paintCityChunk(c, i, j, theme);
    this.renders++;
    const key = `${theme || '*'}|${i}|${j}`;
    if (old) this.pixels -= old.px;
    const entry = { canvas: cv, scale, px: px * px, frame: this.frame };
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.pixels += entry.px;
    return entry;
  }

  /** Draws every block under the camera (world-space ctx). `view` =
   *  { cx, cy, hw, hh, zoom, dpr, gfx }. */
  draw(ctx, view, theme) {
    this.frame++;
    const P = CITY_PITCH, B = CITY_BLEED;
    const maxS = [1, 1.5, 2][view.gfx != null ? view.gfx : 2];
    const want = Math.min(maxS, CityFloor.quantize(view.zoom * view.dpr));
    const m = 24 / view.zoom;
    const i0 = Math.max(0, Math.floor((view.cx - view.hw - m) / P)), i1 = Math.min(CITY_CELLS - 1, Math.floor((view.cx + view.hw + m) / P));
    const j0 = Math.max(0, Math.floor((view.cy - view.hh - m) / P)), j1 = Math.min(CITY_CELLS - 1, Math.floor((view.cy + view.hh + m) / P));
    let budget = 2;
    let used = 0;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const key = `${theme || '*'}|${i}|${j}`;
        let e = this.cache.get(key);
        if (!e) e = this.render(i, j, want, theme, null);
        else if (e.scale !== want && budget > 0) { budget--; e = this.render(i, j, want, theme, e); }
        else { this.cache.delete(key); this.cache.set(key, e); }
        e.frame = this.frame;
        used += e.px;
        ctx.drawImage(e.canvas, i * P - B, j * P - B, P + 2 * B, P + 2 * B);
      }
    }
    // Pixel budget for this frame: never below what the view itself needs.
    const cap = Math.max(CityFloor.budget(view.gfx), used * 1.8);
    const chunkPx = Math.ceil((P + 2 * B) * want) ** 2;
    // Prefetch the ring of blocks just outside the view, one or two a frame.
    // Cached ring blocks are touched too, so eviction never throws out what
    // the prefetch would just paint again (a steady 2 paints/frame thrash
    // on DPR 2-3 phones, found in review); new ones only while under budget.
    for (let j = j0 - 1; j <= j1 + 1; j++) {
      for (let i = i0 - 1; i <= i1 + 1; i++) {
        if (i < 0 || j < 0 || i >= CITY_CELLS || j >= CITY_CELLS) continue;
        if (i >= i0 && i <= i1 && j >= j0 && j <= j1) continue;
        const e = this.cache.get(`${theme || '*'}|${i}|${j}`);
        if (e && e.scale === want) { e.frame = this.frame; continue; }
        if (budget <= 0 || this.pixels - (e ? e.px : 0) + chunkPx > cap) continue;
        budget--;
        this.render(i, j, want, theme, e).frame = this.frame;
      }
    }
    // LRU eviction of blocks that are neither in view nor in the ring.
    for (const [key, e] of this.cache) {
      if (this.pixels <= cap) break;
      if (e.frame === this.frame) continue;
      this.cache.delete(key);
      this.pixels -= e.px;
    }
  }

  /** Base pixel budget per quality level (gfx 0/1/2). */
  static budget(gfx) { return [4e6, 7e6, 10e6][gfx != null ? gfx : 2]; }

  /** Paints the blocks in view now (Game.prewarmFloor() at round/mission
   *  start), so the first frame doesn't stall on a burst of chunk paints. */
  prewarm(view, theme) {
    const P = CITY_PITCH;
    const maxS = [1, 1.5, 2][view.gfx != null ? view.gfx : 2];
    const want = Math.min(maxS, CityFloor.quantize(view.zoom * view.dpr));
    for (let j = Math.floor((view.cy - view.hh) / P); j <= Math.floor((view.cy + view.hh) / P); j++) {
      for (let i = Math.floor((view.cx - view.hw) / P); i <= Math.floor((view.cx + view.hw) / P); i++) {
        if (i < 0 || j < 0 || i >= CITY_CELLS || j >= CITY_CELLS) continue;
        const e = this.cache.get(`${theme || '*'}|${i}|${j}`);
        if (!e || e.scale !== want) this.render(i, j, want, theme, e);
      }
    }
  }

  /** Drops every cached block (menu art leaving the screen). */
  clearChunks() {
    this.cache.clear();
    this.pixels = 0;
  }

  /** Night traffic: faint head/tail-light streaks gliding along the roads
   *  in view -- the city is alive, but nothing that reads as a pickup. */
  drawTraffic(ctx, view, t, theme, bounds, avoid) {
    const P = CITY_PITCH, R = CITY_ROAD;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let L = 1; L < CITY_CELLS; L++) {
      const pos = L * P;
      for (const vertical of [true, false]) {
        if (Math.abs(pos - (vertical ? view.cx : view.cy)) > (vertical ? view.hw : view.hh) + R) continue;
        for (let k = 0; k < 6; k++) {
          const dir = k % 2 ? 1 : -1;
          const speed = 70 + ((L * 37 + k * 53 + (vertical ? 11 : 0)) % 70);
          let s = (cityHash(L, k, vertical ? 3 : 4) % WORLD_W) + t * speed * dir;
          s = ((s % WORLD_W) + WORLD_W) % WORLD_W;
          const x = vertical ? pos + dir * R * 0.22 : s, y = vertical ? s : pos + dir * R * 0.22;
          if (Math.abs(x - view.cx) > view.hw + 30 || Math.abs(y - view.cy) > view.hh + 30) continue;
          if (bounds && (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY)) continue;
          if (avoid && Math.hypot(x - avoid.x, y - avoid.y) < avoid.radius + 60) continue;
          // A car at night: a pair of lights (warm headlights one way, pink
          // tail-lights the other), side by side across the lane.
          ctx.fillStyle = dir > 0 ? 'rgba(242, 248, 255, 0.34)' : 'rgba(255, 84, 173, 0.3)';
          const ox = vertical ? 4 : 0, oy = vertical ? 0 : 4;
          ctx.fillRect(x - ox - 1.6, y - oy - 1.6, 3.2, 3.2);
          ctx.fillRect(x + ox - 1.6, y + oy - 1.6, 3.2, 3.2);
        }
      }
    }
    ctx.restore();
  }

  /** Cached minimap backdrop: the district blocks as tinted squares.
   *  `bounds` is the world rect the minimap frames. */
  minimap(sizePx, theme, bounds) {
    const key = `${theme || '*'}|${sizePx}|${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}`;
    let cv = this.minimaps.get(key);
    if (cv) return cv;
    cv = document.createElement('canvas');
    cv.width = cv.height = sizePx;
    const c = cv.getContext('2d');
    const sx = sizePx / (bounds.maxX - bounds.minX), sy = sizePx / (bounds.maxY - bounds.minY);
    c.fillStyle = 'rgba(2, 8, 16, 0.82)';
    c.fillRect(0, 0, sizePx, sizePx);
    const P = CITY_PITCH, R = CITY_ROAD;
    for (let j = 0; j < CITY_CELLS; j++) {
      for (let i = 0; i < CITY_CELLS; i++) {
        const col = DISTRICT_COLORS[cityDistrict(i, j, theme)] || '#50F0FA';
        c.fillStyle = rgbaColor(col, 0.15);
        c.fillRect((i * P + R / 2 - bounds.minX) * sx, (j * P + R / 2 - bounds.minY) * sy, (P - R) * sx, (P - R) * sy);
      }
    }
    this.minimaps.set(key, cv);
    return cv;
  }
}

/** Floor instance for menu-screen art (the first-run welcome scene). */
const SCREEN_FLOOR = new CityFloor();

/* ----------------------- Swallow animation (Golden Shot v12) -----------------------
   An eaten object used to shrink in place for 0.28 s while being snapped
   under the hole's black disk -- the actual eat was invisible. Now it tips
   over the rim and spirals down into the vortex: drawn by the eater INSIDE
   its clipped vortex (Hole.drawBody()'s `inner` pass), shrinking, turning
   and sinking into the event-horizon darkness. Shared by Arena WorldObjects,
   Campaign entities and swallowed rival holes (Game.swallowGhosts). */

/** Records where `obj` touched `hole` (relative offset + spin direction). */
function beginSwallow(obj, hole) {
  obj.swFromX = obj.x - hole.x;
  obj.swFromY = obj.y - hole.y;
  obj.swSeed = artSeed(obj.x, obj.y); // the idle-motion phase it had on the floor
  // Spin derived from the position (no Math.random()), so the purely visual
  // swallow never shifts the random stream gameplay draws from.
  const h = Math.sin(obj.x * 12.9898 + obj.y * 78.233) * 43758.5453;
  const f = h - Math.floor(h);
  obj.swSpin = (f < 0.5 ? -1 : 1) * (2.2 + f * 1.2);
}

/** World position + look of a swallowed thing at progress k (0..1). */
function swallowPose(obj, hole, k) {
  k = clamp(k, 0, 1);
  const fall = k * k;                       // slips over the edge, then plunges
  const ang = (obj.swSpin || 2.6) * k;
  const c = Math.cos(ang), s = Math.sin(ang);
  const fx = (obj.swFromX || 0) * (1 - fall), fy = (obj.swFromY || 0) * (1 - fall);
  return { x: hole.x + fx * c - fy * s, y: hole.y + fx * s + fy * c, rot: ang * 0.7, scale: Math.max(0.06, 1 - 0.88 * k), alpha: 1 - 0.55 * k };
}

/** v13: a random point on one of the city's road lanes (the grid lines
 *  between blocks, see CITY_PITCH/CITY_ROAD). `next` returns 0..1. */
function roadLanePoint(next) {
  const vertical = next() < 0.5;
  const line = (1 + Math.floor(next() * (CITY_CELLS - 1))) * CITY_PITCH;
  const lane = (next() < 0.5 ? -1 : 1) * CITY_ROAD * 0.22;
  const along = 40 + next() * (WORLD_W - 80);
  return vertical ? { x: line + lane, y: along } : { x: along, y: line + lane };
}

class WorldObject {
  constructor(tierName, rng) {
    this.respawn(tierName, true, rng);
  }

  /** rng, when given, only applies to the *initial* spawn (first=true) —
   *  see seededRand()'s doc comment for why later respawns stay unseeded. */
  respawn(tierName, first, rng) {
    const tier = TIERS[tierName];
    this.tier = tierName;
    this.color = tier.color;
    this.value = tier.value;
    if (first && rng) {
      this.subtype = tier.subtypes[seededInt(rng, 0, tier.subtypes.length - 1)];
      this.radius = seededRand(rng, tier.minR, tier.maxR);
      this.rotation = seededRand(rng, 0, Math.PI * 2);
      this.x = seededRand(rng, this.radius + 20, WORLD_W - this.radius - 20);
      this.y = seededRand(rng, this.radius + 20, WORLD_H - this.radius - 20);
    } else {
      this.subtype = tier.subtypes[randInt(0, tier.subtypes.length - 1)];
      this.radius = rand(tier.minR, tier.maxR);
      this.rotation = rand(0, Math.PI * 2);
      this.x = rand(this.radius + 20, WORLD_W - this.radius - 20);
      this.y = rand(this.radius + 20, WORLD_H - this.radius - 20);
      // v13: part of the eaten fragments come back on a road lane, so the
      // streets stay the city's "food lanes" all round long.
      if (tierName === 'fragment' && Math.random() < CONFIG.arena.roadRespawnChance) Object.assign(this, roadLanePoint(Math.random));
    }
    this.eating = false;
    this.eatT = 0;
    this.eater = null;
    if (!first) this.spawnFlash = 1;
  }

  startEating(hole) {
    if (this.eating) return;
    this.eating = true;
    this.eatT = 0;
    this.eater = hole;
    beginSwallow(this, hole);
  }

  update(dt) {
    // Respawn pop-in (spawnFlash 1 -> 0 over ~0.5 s, see draw()).
    if (this.spawnFlash > 0) this.spawnFlash = Math.max(0, this.spawnFlash - dt * 2);
    if (this.eating) {
      this.eatT += dt / EAT_ANIM_TIME;
      // v12 fall-in: spiral from the touch point into the vortex center,
      // following the eater (the old 50%-per-frame lerp snapped it under
      // the hole within a couple of frames, so the eat was never seen).
      if (this.eater) {
        const p = swallowPose(this, this.eater, this.eatT);
        this.x = p.x;
        this.y = p.y;
      }
    }
  }

  get consumed() { return this.eating && this.eatT >= 1; }

  /** highlight (0..1): "you're close to being able to eat this" breathing
   *  rim, drawn only for objects near the player's eat threshold so tiny
   *  trivially-eatable objects stay visually quiet (GDD 5.4). */
  draw(ctx, highlight) {
    // While swallowed, the eater draws this object inside its vortex
    // (drawSwallowed()); out here only the part over the rim fades away.
    const scale = this.eating ? 1 - this.eatT * 0.35 : 1;
    if (this.eating) {
      const a = 1 - this.eatT * 4;
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(this.x, this.y);
      ctx.scale(scale, scale);
      drawObjectArt(ctx, this.subtype, this.color, this.radius, performance.now() / 1000, this.swSeed || 0, { live: false });
      ctx.restore();
      return;
    }

    if (highlight > 0 && !this.eating) {
      const breathe = 0.5 + 0.5 * Math.sin(performance.now() / 260);
      ctx.save();
      ctx.globalAlpha = highlight * (0.35 + 0.35 * breathe);
      ctx.strokeStyle = this.color;
      ctx.shadowBlur = 18;
      ctx.shadowColor = this.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      // A few px outside the object, not 1.4x its radius -- the old ring
      // read bigger than the hole that could already eat it (player feedback).
      ctx.arc(this.x, this.y, this.radius + 3 + 2 * breathe, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Illustrated sprite shared with Campaign (see OBJECT_ART) -- drawn
    // upright rather than at this.rotation, since the new icons are little
    // pictures (a lamp or a car upside down read as a glitch).
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);
    if (this.spawnFlash > 0) {
      ctx.globalAlpha *= 1 - this.spawnFlash;
      ctx.scale(1 - this.spawnFlash * 0.6, 1 - this.spawnFlash * 0.6);
    }
    if (this.tier === 'golden') drawGoldenRays(ctx, this.radius, performance.now() / 1000);
    drawObjectArt(ctx, this.subtype, this.color, this.radius, performance.now() / 1000, artSeed(this.x, this.y));
    ctx.restore();
  }
}

/** Rotating light rays + pulsing halo behind the Złoty Rdzeń, so it reads
 *  as "special" from across the screen. Drawn at the object's origin. */
function drawGoldenRays(ctx, r, t) {
  ctx.save();
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 4);
  halo.addColorStop(0, `rgba(239, 203, 99, ${0.45 + 0.2 * pulse})`);
  halo.addColorStop(1, 'rgba(239, 203, 99, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(0, 0, r * 4, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(t * 0.8);
  ctx.fillStyle = 'rgba(255, 242, 194, 0.35)';
  for (let i = 0; i < 8; i++) {
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r * 3.6, -r * 0.35);
    ctx.lineTo(r * 3.6, r * 0.35);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/* ----------------------- CampaignEntity (Vector Hole v3 mission objects) -----------------------
   Deliberately separate from WorldObject: campaign missions are small,
   curated layouts (not the Arena's random-pool-of-3-tiers world), and each
   type (node/gate/capsule/marker/pylon/landmark) has its own activation
   rule instead of a uniform "smaller than my radius" eat check. */

class CampaignEntity {
  constructor(type, x, y, opts) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.radius = CONFIG.campaign.entityRadius[type];
    this.stats = CAMPAIGN_ENTITY_STATS[type];
    if (type === 'landmark' && opts && opts.landmarkId) {
      const tier = LANDMARK_TIERS[opts.landmarkId] || 4;
      const L = CONFIG.campaign.landmarkByTier[tier];
      this.stats = { ...this.stats, minTier: tier, growth: L.growth, score: L.score };
      this.radius = L.radius;
    }
    this.eating = false;
    this.eatT = 0;
    this.consumed = false;
    this.spawnAt = 0;   // seconds into the mission before this entity is live (capsule waves)
    this.cluster = null; // 'A' | 'B' — Mission 02 medal
    this.route = null;   // 'A' | 'B' — Mission 07 medal
    this.phase = 0;      // gate cycle position
    if (type === 'node' || type === 'pylon') this.active = true; // true = not yet disabled/charged
    // Mostek (M19): structural, per OBJECT_CATALOG_SPEC.md §2.2 -- unlike
    // every other 'node', it's never eaten/removed. `mostekPowered` tracks
    // its own on/off state instead of the shared `active` flag (which for
    // every other node/pylon means "not yet consumed").
    if (type === 'node' && opts && opts.glyph === 'mostek') this.mostekPowered = false;
    if (type === 'landmark') this.unlocked = false;
    if (type === 'gate') this.passCooldown = 0;
    Object.assign(this, opts || {});
  }

  get live() { return this.spawnAt <= 0 || this._elapsed >= this.spawnAt; }

  /** OBJECT_ART sprite kind for this entity, or null for a mission-specific
   *  glyph that keeps its own bespoke drawing in draw(). */
  artKind() {
    switch (this.type) {
      case 'fragment': return 'fragment';
      case 'capsule': return 'kapsula';
      case 'vehicle': return 'samochod';
      case 'prop': return OBJECT_ART[this.glyph] ? this.glyph : 'latarnia';
      case 'marker': return this.glyph && OBJECT_ART[this.glyph] ? this.glyph : 'znacznik';
      case 'node': return this.glyph === 'mostek' || this.glyph === 'zasilacz' ? this.glyph : 'wezel';
      case 'pylon': return this.glyph === 'lustro' ? 'lustro' : 'pylon';
      case 'structure': return OBJECT_ART[this.glyph] ? this.glyph : 'pawilon';
      case 'heavy': return OBJECT_ART[this.glyph] ? this.glyph : 'autobus';
      case 'tower': return OBJECT_ART[this.glyph] ? this.glyph : 'wiezowiec';
      case 'landmark': return LANDMARK_ART[this.landmarkId] || 'landmark';
      case 'runner': return 'bajt';
      default: return null;
    }
  }

  get isGateOpen() {
    const { cycleSeconds, openSeconds } = CONFIG.campaign.gate;
    return (this.phase % cycleSeconds) < openSeconds;
  }

  get isGateTelegraphing() {
    const { cycleSeconds, openSeconds, telegraphSeconds } = CONFIG.campaign.gate;
    const t = this.phase % cycleSeconds;
    return t >= openSeconds - telegraphSeconds && t < openSeconds;
  }

  update(dt, missionElapsed) {
    this._elapsed = missionElapsed;
    if (this.type === 'gate') {
      this.phase += dt;
      if (this.passCooldown > 0) this.passCooldown -= dt;
      return;
    }
    if (this.eating) {
      this.eatT += dt / (this.type === 'landmark' ? 0.8 : EAT_ANIM_TIME);
      if (this.eatT >= 1) this.consumed = true;
    }
  }

  startEating(hole) {
    if (this.eating) return;
    this.eating = true;
    this.eatT = 0;
    // v12: the eater draws it falling into its vortex (Game.drawSwallowed());
    // the entity's own x/y stay put -- mission logic reads them.
    if (hole) { this.eater = hole; beginSwallow(this, hole); }
  }

  draw(ctx, isGoal) {
    if (!this.live || this.consumed) return;
    if (this.eating && this.eater) {
      const a = 1 - this.eatT * 4;
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(this.x, this.y);
      const art = this.artKind();
      if (art) drawObjectArt(ctx, art, SIZE_TIER_COLORS[this.stats.minTier], this.radius, performance.now() / 1000, artSeed(this.x, this.y), { live: false, variant: this.glyph === 'konwoj' ? 'konwoj' : undefined });
      ctx.restore();
      return;
    }
    const scale = this.eating ? Math.max(0, 1 - this.eatT) : 1;
    if (scale <= 0) return;
    const r = this.radius;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);

    // Ties board objects to the mission goal text at a glance (player
    // feedback: objects should visually signal what the player should be
    // looking for) -- landmark/gate already communicate this through their
    // own always-visible state, so only the plain pickups need the ring.
    if (isGoal && this.type !== 'gate' && this.type !== 'landmark' && !this.eating) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 220);
      ctx.save();
      // White (not gold, now T3's object color) and only a few px
      // outside the object, so a ring never reads bigger than the hole that
      // can eat it (player feedback).
      ctx.strokeStyle = `rgba(242, 248, 255,${0.3 + 0.35 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 5 + 2 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // v10: every non-gate object -- generic pickups, mission-specific
    // glyphs and boss landmarks alike -- is an illustrated OBJECT_ART
    // sprite in its size-tier color (player feedback: the thin line icons
    // looked unfinished next to the illustrated ones).
    if (this.type !== 'gate') {
      const art = this.artKind();
      const inactive = (this.type === 'node' || this.type === 'pylon') && !this.active && this.glyph !== 'mostek';
      const locked = this.type === 'landmark' && !this.unlocked;
      // Mostek keeps its T3 size color; unpowered it's drawn dim and
      // without its live glow, powered it lights up fully.
      const color = this.type === 'runner' ? '#EFCB63' : SIZE_TIER_COLORS[this.stats.minTier];
      if (inactive) ctx.globalAlpha *= 0.35;
      if (this.glyph === 'mostek' && !this.mostekPowered) ctx.globalAlpha *= 0.55;
      if (locked) ctx.globalAlpha *= 0.45;
      drawObjectArt(ctx, art, color, r, performance.now() / 1000, artSeed(this.x, this.y),
        { live: !inactive && !locked, variant: this.glyph === 'konwoj' ? 'konwoj' : undefined });
      if (this.type === 'landmark' && LANDMARK_SIGNS[this.landmarkId]) drawLandmarkSign(ctx, LANDMARK_SIGNS[this.landmarkId], r, color);
      if (locked) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(242, 248, 255, 0.55)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.arc(0, 0, r * 1.08, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(4, 16, 29, 0.75)';
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
        drawLockGlyph(ctx, 0, 1, 14);
      }
      ctx.restore();
      return;
    }

    switch (this.type) {
      case 'gate': {
        if (this.glyph === 'portal') {
          // Portal (M13), per obj-portal (concentric rings) -- a fixed
          // teleporter instead of a brama pillar.
          const open = this.isGateOpen;
          const color = open ? '#68F5FC' : '#9875FF';
          ctx.strokeStyle = color; ctx.lineWidth = 1.6;
          ctx.shadowBlur = open ? 18 : 6; ctx.shadowColor = color;
          ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha *= 0.65;
          ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha *= (0.4 / 0.65);
          ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        if (this.glyph === 'pas_przelotu') {
          // Pas przelotu (M18), per obj-pas-przelotu -- a lit corridor
          // strip instead of a single brama pillar.
          const open = this.isGateOpen;
          const telegraph = this.isGateTelegraphing;
          const color = !open ? 'rgba(255,255,255,0.2)' : telegraph ? '#EFCB63' : '#50F0FA';
          const hw = this.zoneHalfWidth || r;
          ctx.strokeStyle = color; ctx.lineWidth = 2;
          ctx.shadowBlur = open ? 14 : 4; ctx.shadowColor = color;
          // The zone spans the whole mission box vertically (the crossing
          // check only looks at x), so draw it that tall.
          const b = CONFIG.campaign.bounds;
          const top = b.minY - this.y, bottom = b.maxY - this.y;
          if (open) { ctx.fillStyle = rgbaColor(telegraph ? '#EFCB63' : '#50F0FA', 0.08); ctx.fillRect(-hw, top, hw * 2, bottom - top); }
          ctx.setLineDash([10, 8]);
          ctx.beginPath(); ctx.moveTo(-hw, top); ctx.lineTo(-hw, bottom); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(hw, top); ctx.lineTo(hw, bottom); ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(-r * 0.4, -r * 0.4); ctx.lineTo(r * 0.4, 0); ctx.lineTo(-r * 0.4, r * 0.4);
          ctx.stroke();
          break;
        }
        const open = this.isGateOpen;
        const telegraph = this.isGateTelegraphing;
        const color = !open ? 'rgba(255,255,255,0.2)' : telegraph ? '#EFCB63' : '#50F0FA';
        ctx.strokeStyle = color; ctx.lineWidth = 5;
        ctx.shadowBlur = open ? 16 : 4; ctx.shadowColor = color;
        ctx.beginPath();
        ctx.moveTo(0, -r * 2.4); ctx.lineTo(0, r * 2.4);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -r * 2.4, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, r * 2.4, 6, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
}

/* ----------------------- Hole (player + bots share this base) ----------------------- */

class Hole {
  constructor(name, x, y, isPlayer) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.radius = BASE_RADIUS;
    this.score = 0;
    this.isPlayer = isPlayer;
    this.target = { x, y };
    this.invulnerableUntil = 0;
    this.edgeColor = BOT_COLORS[randInt(0, BOT_COLORS.length - 1)];
    this.skin = 'rainbow';
  }

  get invulnerable() { return performance.now() < this.invulnerableUntil; }

  getSpeed() {
    const s = BASE_SPEED * Math.pow(BASE_RADIUS / this.radius, 0.22);
    // tempSpeedMult: set per-frame by Game.updateMutationEffects() for the
    // Slipstream evolution mutation (Phase 4); 1 the rest of the time.
    return clamp(s, 45, BASE_SPEED) * (this.tempSpeedMult || 1) * (this.perkSpeedMult || 1);
  }

  moveToward(tx, ty, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 1) {
      const speed = this.getSpeed();
      this.x += (dx / d) * speed * dt;
      this.y += (dy / d) * speed * dt;
    }
    this.x = clamp(this.x, this.radius, WORLD_W - this.radius);
    this.y = clamp(this.y, this.radius, WORLD_H - this.radius);
  }

  /** Velocity-based movement for the Floating Thumb Pad and keyboard input:
   *  dirX/dirY is a unit vector, magnitude is 0..1 (post dead-zone/curve),
   *  sensitivity is a player-controlled multiplier. Unlike moveToward(),
   *  this never "chases" a screen point — the hole doesn't need to sit
   *  under the finger. */
  moveDirection(dirX, dirY, magnitude, sensitivity, dt) {
    if (magnitude <= 0) return;
    const speed = this.getSpeed() * magnitude * sensitivity;
    this.x += dirX * speed * dt;
    this.y += dirY * speed * dt;
    this.x = clamp(this.x, this.radius, WORLD_W - this.radius);
    this.y = clamp(this.y, this.radius, WORLD_H - this.radius);
  }

  growFromArea(gainArea) {
    const area = Math.PI * this.radius * this.radius;
    const newArea = area + gainArea;
    this.setRadius(Math.max(MIN_RADIUS, Math.sqrt(newArea / Math.PI)));
  }

  /** Grow along CONFIG.growth's curve by `units` growth units (an eaten
   *  object's GDD 07 `growth` value) -- see radiusForUnits(). */
  growUnits(units) {
    this.setRadius(radiusForUnits(unitsForRadius(this.radius) + units));
  }

  /** Every radius increase triggers a short "gulp" pop in draw() so even a
   *  small step reads as growth (player feedback: early growth was barely
   *  visible). */
  setRadius(r) {
    r = Math.min(r, CONFIG.hole.maxRadius);
    if (r > this.radius + 0.01) this.growPopAt = performance.now();
    this.radius = r;
  }

  shrinkAndRespawn(bonusInvulnMs) {
    this.radius = BASE_RADIUS;
    this.x = rand(this.radius + 20, WORLD_W - this.radius - 20);
    this.y = rand(this.radius + 20, WORLD_H - this.radius - 20);
    this.invulnerableUntil = performance.now() + INVULN_TIME * 1000 + (bonusInvulnMs || 0);
  }

  /** `inner` (optional): v12 callback drawing whatever this hole is
   *  swallowing, called inside its clipped vortex before the rim. */
  draw(ctx, time, inner) {
    const popT = this.growPopAt ? (performance.now() - this.growPopAt) / 260 : 1;
    const pop = popT < 1 ? Math.sin(popT * Math.PI) : 0;
    const realRadius = this.radius;
    this.radius = realRadius * (1 + 0.14 * pop);
    try {
      this.drawBody(ctx, time, inner);
    } finally {
      this.radius = realRadius;
    }
  }

  /** The ring color for a solid skin (null for the rainbow skin). */
  skinColor() {
    if (this.skin === 'rainbow' || this.skin === 'pryzmat') return null;
    return this.skin === 'custom' ? this.edgeColor : (SKIN_MAP[this.skin] || this.edgeColor);
  }

  /** Spinning vortex inside the hole (player feedback: the hole should
   *  have a swirl inside, in shades of its own color). A faint tinted
   *  depth gradient, four spiral arms in light/base/dark shades of the
   *  skin color (rainbow hues for the rainbow skins) turning inward, and a
   *  black event-horizon core. Drawn by every hole -- player, bots and
   *  the Warsztat previews -- so the shop shows exactly what the round does. */
  drawVortex(ctx, time) {
    const r = this.radius;
    const solid = this.skinColor();
    const base = solid || '#9875FF';
    const colors = solid
      ? [shadeColor(solid, 0.5), solid, shadeColor(solid, -0.2), shadeColor(solid, 0.25)]
      : [0, 1, 2, 3].map(i => `hsl(${(i * 90 + time * 60) % 360}, 100%, 65%)`);
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
    const depth = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    depth.addColorStop(0, 'rgba(0,0,0,1)');
    depth.addColorStop(0.6, rgbaColor(base, 0.12));
    depth.addColorStop(1, rgbaColor(base, 0.38));
    ctx.fillStyle = depth;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    // Bots spin a touch slower/offset so a crowd doesn't turn in lockstep.
    const spin = this.isPlayer ? 2.4 : 1.9;
    drawSpiralArms(ctx, r * 1.02, colors, -time * spin + (this.isPlayer ? 0 : r), 4);
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.55);
    core.addColorStop(0, 'rgba(0,0,0,1)');
    core.addColorStop(0.45, 'rgba(0,0,0,0.85)');
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /** Golden Shot v9: which signature look this hole wears -- every Rdzeń
   *  skin has its own (SKIN_STYLES), bots get one assigned at spawn. */
  holeStyle() {
    if (this.styleOverride) return this.styleOverride;
    return SKIN_STYLES[this.skin] || 'tech';
  }

  drawBody(ctx, time, inner) {
    if (this.auraId && this.auraId !== 'none') {
      const aura = AURAS.find(a => a.id === this.auraId);
      if (aura && aura.color) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 2.4);
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.15 * pulse;
        ctx.strokeStyle = aura.color;
        ctx.shadowBlur = 22;
        ctx.shadowColor = aura.color;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 8 + 3 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    const r = this.radius;
    const style = this.holeStyle();
    const solid = this.skinColor();
    const rimColor = solid || `hsl(${(time * 60) % 360}, 100%, 62%)`;
    ctx.save();
    if (this.invulnerable) ctx.globalAlpha = 0.55 + 0.35 * Math.sin(time * 12);

    // Gravity well, one gradient: the city floor sags dark right at the rim
    // (v12, now that there is a lit floor to darken), then a soft glow in
    // the skin color fades out -- the hole reads as a dent, not a disc.
    const well = ctx.createRadialGradient(this.x, this.y, r * 0.9, this.x, this.y, r * 1.7);
    well.addColorStop(0, 'rgba(0, 0, 0, 0.66)');
    well.addColorStop(0.42, rgbaColor(solid || '#9875FF', 0.2));
    well.addColorStop(1, rgbaColor(solid || '#9875FF', 0));
    ctx.fillStyle = well;
    ctx.beginPath(); ctx.arc(this.x, this.y, r * 1.7, 0, Math.PI * 2); ctx.fill();

    drawAccretionDisk(ctx, this.x, this.y, r, solid, time, this.isPlayer ? 14 : 7);

    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();
    this.drawVortex(ctx, time);
    if (inner) {
      ctx.save();
      ctx.beginPath(); ctx.arc(this.x, this.y, r * 0.97, 0, Math.PI * 2); ctx.clip();
      inner(ctx);
      // Whatever sinks past mid-depth disappears into the event horizon.
      const core = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 0.7);
      core.addColorStop(0, 'rgba(0,0,0,0.95)');
      core.addColorStop(0.55, 'rgba(0,0,0,0.6)');
      core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = core;
      ctx.fillRect(this.x - r, this.y - r, r * 2, r * 2);
      ctx.restore();
    }

    ctx.save();
    if (this.invulnerable) ctx.globalAlpha = 0.55 + 0.35 * Math.sin(time * 12);
    ctx.translate(this.x, this.y);
    drawHoleRim(ctx, style, solid, rimColor, r, time, this.isPlayer);
    // Photon ring: a thin bright line just inside the edge.
    ctx.globalAlpha *= 0.35;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.93, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    if (!this.name) return; // Warsztat previews draw a nameless hole
    // labelScale (v12): Arena's camera zooms far out late in a round, so
    // names/crowns are counter-scaled to stay readable (set by Game.render()).
    const ls = this.labelScale || 1;
    ctx.save();
    ctx.font = `800 ${13 * ls}px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3 * ls;
    ctx.strokeStyle = 'rgba(4, 16, 29, 0.85)';
    ctx.strokeText(this.name, this.x, this.y - r - 12 * ls);
    ctx.fillStyle = this.isPlayer ? '#50F0FA' : '#f2f8ff';
    ctx.fillText(this.name, this.x, this.y - r - 12 * ls);
    if (this.isLeader) {
      // v12: a gold crown over the current #1 (set by Game.updateHUD()) --
      // everyone on screen can see who to hunt.
      const cy = this.y - r - (34 + Math.sin(time * 3) * 2) * ls;
      ctx.translate(this.x, cy);
      ctx.scale(ls, ls);
      ctx.fillStyle = '#EFCB63';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#EFCB63';
      ctx.beginPath();
      ctx.moveTo(-11, 7); ctx.lineTo(-13, -5); ctx.lineTo(-5.5, 0); ctx.lineTo(0, -9);
      ctx.lineTo(5.5, 0); ctx.lineTo(13, -5); ctx.lineTo(11, 7); ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(4, 16, 29, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ----------------------- Hole signature looks (Golden Shot v9) -----------------------
   Player feedback: "dziura bez pomysłu" -- every skin was the same ring in a
   different color. Each Rdzeń skin now has its own rim design, drawn by
   drawHoleRim() around the shared vortex, plus an orbiting accretion disk. */

const SKIN_STYLES = {
  rainbow: 'prism', cyan: 'tech', pink: 'plasma', green: 'toxic', purple: 'galaxy',
  gold: 'sun', white: 'storm', aurora: 'aurora', krysztal: 'crystal', pryzmat: 'prism'
};
const BOT_STYLES = ['tech', 'plasma', 'toxic', 'galaxy', 'crystal', 'sun'];

/** Motes of matter orbiting just outside the rim and spiraling in. */
function drawAccretionDisk(ctx, x, y, r, color, t, count) {
  for (let i = 0; i < count; i++) {
    const phase = (t * 0.45 + i / count) % 1;            // 0 = far out, 1 = swallowed
    const ang = i * 2.399 + t * (1.6 + (i % 3) * 0.3) + phase * 3;
    const rad = r * (1.45 - phase * 0.5);
    const a = Math.sin(phase * Math.PI);
    ctx.globalAlpha = a * 0.85;
    ctx.fillStyle = color || `hsl(${(i * 47 + t * 80) % 360}, 100%, 65%)`;
    const size = Math.max(1.2, r * 0.05) * (1 - phase * 0.5);
    ctx.beginPath();
    ctx.arc(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Path of a circle whose radius is wobbled by `fn(theta)` (0 = round). */
function wobblePath(ctx, r, fn, steps = 48) {
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * Math.PI * 2;
    const rr = r * (1 + fn(th));
    if (i === 0) ctx.moveTo(Math.cos(th) * rr, Math.sin(th) * rr);
    else ctx.lineTo(Math.cos(th) * rr, Math.sin(th) * rr);
  }
  ctx.closePath();
}

/** Signature rim for each hole style, drawn centered at (0,0). `solid` is
 *  null for rainbow skins; `c` is then a cycling hue. */
function drawHoleRim(ctx, style, solid, c, r, t, detailed) {
  const lw = Math.max(2.5, r * 0.09);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const glowStroke = (color, width, blur) => {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.shadowBlur = blur; ctx.shadowColor = color;
    ctx.stroke(); ctx.shadowBlur = 0;
  };
  switch (style) {
    case 'tech': {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); glowStroke(c, lw, 16);
      // Three rotating bracket arcs + counter-rotating tick ring.
      for (let i = 0; i < 3; i++) {
        const a = t * 1.4 + (i / 3) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(0, 0, r + lw * 1.8, a, a + 0.7);
        glowStroke(shadeColor(c, 0.35), lw * 0.7, 8);
      }
      ctx.strokeStyle = rgbaColor(c, 0.7); ctx.lineWidth = Math.max(1, lw * 0.35);
      for (let i = 0; i < 16; i++) {
        const a = -t * 0.8 + (i / 16) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
        ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
        ctx.stroke();
      }
      break;
    }
    case 'plasma': {
      wobblePath(ctx, r, th => 0.07 * Math.sin(8 * th + t * 6) + 0.04 * Math.sin(13 * th - t * 9));
      glowStroke(c, lw, 20);
      wobblePath(ctx, r * 1.08, th => 0.06 * Math.sin(6 * th - t * 7));
      ctx.globalAlpha *= 0.5; glowStroke(shadeColor(c, 0.4), lw * 0.5, 10); ctx.globalAlpha *= 2;
      break;
    }
    case 'toxic': {
      wobblePath(ctx, r, th => 0.05 * Math.sin(5 * th + t * 3) + 0.03 * Math.sin(9 * th - t * 2));
      glowStroke(c, lw * 1.2, 16);
      // Bubbles boiling off the rim.
      for (let i = 0; i < (detailed ? 7 : 4); i++) {
        const ph = (t * 0.6 + i * 0.37) % 1;
        const a = i * 2.1 + Math.sin(t + i) * 0.3;
        const rad = r * (1.02 + ph * 0.35);
        ctx.globalAlpha = (1 - ph) * 0.9;
        ctx.beginPath(); ctx.arc(Math.cos(a) * rad, Math.sin(a) * rad, Math.max(1.5, r * 0.08 * (1 - ph * 0.5)), 0, Math.PI * 2);
        ctx.strokeStyle = shadeColor(c, 0.3); ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'galaxy': {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); glowStroke(c, lw, 18);
      ctx.save(); ctx.rotate(t * 0.5); ctx.scale(1, 0.38);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
      ctx.globalAlpha *= 0.55; glowStroke(shadeColor(c, 0.3), Math.max(1.5, lw * 0.6), 10);
      ctx.restore();
      for (let i = 0; i < (detailed ? 16 : 8); i++) {
        const a = i * 2.399 + t * (0.3 + (i % 4) * 0.12);
        const rad = r * (0.35 + ((i * 0.618) % 1) * 0.55);
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4 + i * 1.7);
        ctx.fillStyle = i % 3 ? '#ffffff' : shadeColor(c, 0.5);
        ctx.fillRect(Math.cos(a) * rad - 1, Math.sin(a) * rad - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'sun': {
      const spikes = 14;
      ctx.beginPath();
      for (let i = 0; i < spikes; i++) {
        const a = t * 0.4 + (i / spikes) * Math.PI * 2;
        const len = r * (0.22 + 0.1 * Math.sin(t * 5 + i * 1.3));
        const w = Math.PI / spikes * 0.55;
        ctx.moveTo(Math.cos(a - w) * r, Math.sin(a - w) * r);
        ctx.lineTo(Math.cos(a) * (r + len), Math.sin(a) * (r + len));
        ctx.lineTo(Math.cos(a + w) * r, Math.sin(a + w) * r);
      }
      ctx.fillStyle = rgbaColor(c, 0.75); ctx.shadowBlur = 18; ctx.shadowColor = c; ctx.fill(); ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); glowStroke(shadeColor(c, 0.3), lw * 1.1, 14);
      break;
    }
    case 'storm': {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); glowStroke(c, lw, 18);
      // Crackling arcs: re-rolled ~12x per second from a stable seed.
      const tick = Math.floor(t * 12);
      for (let b = 0; b < (detailed ? 3 : 2); b++) {
        let seed = (tick * 31 + b * 97) % 1000;
        const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        const a0 = rnd() * Math.PI * 2;
        ctx.beginPath();
        let rad = r;
        ctx.moveTo(Math.cos(a0) * rad, Math.sin(a0) * rad);
        for (let k = 1; k <= 4; k++) {
          rad = r * (1 + k * 0.1);
          const a = a0 + (rnd() - 0.5) * 0.5;
          ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        glowStroke(b % 2 ? '#50F0FA' : '#9875FF', 1.6, 12);
      }
      break;
    }
    case 'aurora': {
      const bands = ['#46D99A', '#50F0FA', '#9875FF'];
      bands.forEach((col, i) => {
        wobblePath(ctx, r * (1 + i * 0.07), th => 0.05 * Math.sin(4 * th + t * (2 + i) + i * 2));
        ctx.globalAlpha = 0.9 - i * 0.25;
        glowStroke(col, lw * (1 - i * 0.25), 14);
      });
      ctx.globalAlpha = 1;
      break;
    }
    case 'crystal': {
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); glowStroke(c, lw * 0.8, 14);
      const shards = 8;
      for (let i = 0; i < shards; i++) {
        const a = t * 0.6 + (i / shards) * Math.PI * 2;
        const d = r * (1.14 + 0.04 * Math.sin(t * 3 + i));
        const s = r * 0.14;
        ctx.save();
        ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(s * 1.4, 0); ctx.lineTo(0, s * 0.6); ctx.lineTo(-s * 0.8, 0); ctx.lineTo(0, -s * 0.6); ctx.closePath();
        ctx.fillStyle = rgbaColor(c, 0.85);
        ctx.shadowBlur = 10; ctx.shadowColor = c; ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'prism':
    default: {
      const segments = 24;
      const rot = t * 1.2;
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2 + rot;
        const col = `hsl(${((i / segments) * 360 + rot * 40) % 360}, 100%, 62%)`;
        ctx.beginPath(); ctx.arc(0, 0, r, a0, a0 + (Math.PI * 2) / segments + 0.02);
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.globalAlpha *= 0.4; glowStroke('#ffffff', 1, 14); ctx.globalAlpha /= 0.4;
      for (let i = 0; i < (detailed ? 6 : 3); i++) {
        const a = -t * 1.8 + (i / 6) * Math.PI * 2;
        const d = r + lw * 2;
        ctx.fillStyle = `hsl(${(i * 60 + t * 90) % 360}, 100%, 70%)`;
        ctx.save(); ctx.translate(Math.cos(a) * d, Math.sin(a) * d); ctx.rotate(t * 3);
        const s = Math.max(1.5, r * 0.06);
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.restore();
      }
      break;
    }
  }
}

const SKIN_MAP = SKINS.reduce((acc, s) => {
  if (!s.rainbow) acc[s.id] = s.color;
  return acc;
}, {});

/* ----------------------- Bot AI ----------------------- */

class Bot extends Hole {
  constructor(name, x, y) {
    super(name, x, y, false);
    this.skin = 'custom';
    this.decisionTimer = 0;
    this.state = 'wander';
  }

  decide(game) {
    const holes = [game.player, ...game.bots].filter(h => h !== this);
    let threat = null, threatDist = Infinity;
    let prey = null, preyDist = Infinity;

    // Golden Shot v8 difficulty curve (Game.botTuning, see CONFIG.difficulty):
    // how far a bot will chase the player vs. another bot. aggro 0 = early
    // runs where bots never hunt the player at all.
    const tuning = game.botTuning;
    for (const h of holes) {
      const d = dist(this.x, this.y, h.x, h.y);
      if (h.radius > this.radius * EAT_HOLE_RATIO && d < 320 && d < threatDist) {
        threat = h; threatDist = d;
      }
      const huntRange = h.isPlayer ? tuning.aggro : tuning.prey;
      if (this.radius > h.radius * EAT_HOLE_RATIO && !h.invulnerable && d < huntRange && d < preyDist) {
        prey = h; preyDist = d;
      }
    }

    if (threat) {
      this.state = 'flee';
      const dx = this.x - threat.x, dy = this.y - threat.y;
      const d = Math.hypot(dx, dy) || 1;
      this.target = {
        x: clamp(this.x + (dx / d) * 350, this.radius, WORLD_W - this.radius),
        y: clamp(this.y + (dy / d) * 350, this.radius, WORLD_H - this.radius)
      };
      return;
    }

    if (prey) {
      this.state = 'hunt-hole';
      this.target = { x: prey.x, y: prey.y };
      return;
    }

    let obj = null, objDist = Infinity;
    for (const o of game.objects) {
      if (o.eating || !canEatWorldObjectTier(this.radius, o)) continue;
      const d = dist(this.x, this.y, o.x, o.y);
      if (d < (this.paceHungry ? CONFIG.rival.hungryObjectRange : tuning.objects) && d < objDist) { obj = o; objDist = d; }
    }

    if (obj) {
      this.state = 'hunt-obj';
      this.target = { x: obj.x, y: obj.y };
      return;
    }

    this.state = 'wander';
    if (!this.wanderTarget || dist(this.x, this.y, this.wanderTarget.x, this.wanderTarget.y) < 40) {
      this.wanderTarget = { x: rand(100, WORLD_W - 100), y: rand(100, WORLD_H - 100) };
    }
    this.target = this.wanderTarget;
  }

  update(dt, game) {
    this.decisionTimer -= dt;
    if (this.decisionTimer <= 0) {
      this.decide(game);
      this.decisionTimer = game.botTuning.decision * rand(0.7, 1.3);
    }
    this.moveToward(this.target.x, this.target.y, dt);
  }

  /** Arena bots respawn at their difficulty-scaled spawn size (see
   *  Game.createEntities()), not the player's BASE_RADIUS. */
  shrinkAndRespawn(bonusInvulnMs) {
    super.shrinkAndRespawn(bonusInvulnMs);
    if (this.startRadius) this.radius = this.startRadius;
  }
}

/* ----------------------- Game ----------------------- */

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.save = loadSave();
    // v15: saves that already beat Plac Neonów get the boosters gift.
    if (this.save.campaign.completed[CONFIG.boosters.unlockMission] && !this.save.boosters.gift) {
      this.save.boosters.gift = true;
      MISSION_BOOSTERS.forEach(x => { this.save.boosters[x.id] = (this.save.boosters[x.id] || 0) + 1; });
      saveGame(this.save);
    }
    // GDD 4.0 §5.3 Warsztat select-then-equip flow: what's currently
    // previewed in each of the 4 cosmetic categories, reset to the saved
    // (actually equipped) loadout whenever openWarsztatScreen() runs.
    this.pendingLoadout = {
      skin: this.save.selected,
      aura: this.save.auras.selected,
      effect: this.save.effects.selected,
      overdriveSkin: this.save.overdriveSkins.selected
    };
    this.playCount = 0;
    this.particles = [];
    this.ripples = [];
    this.objects = [];
    this.bots = [];
    this.camera = { x: WORLD_W / 2, y: WORLD_H / 2 };
    this.cityFloor = new CityFloor(); // v12 Neon City floor (chunk cache)
    // Golden Shot v8 game feel: floating score text, full-screen flash,
    // center banner (tier-ups, combo praise), hit-stop and Arena's
    // growth-driven camera zoom-out (1 = Campaign's fixed framing).
    this.floatTexts = [];
    this.swallowGhosts = [];
    this.flashAlpha = 0;
    this.flashColor = '#ffffff';
    this.banner = null;
    this.hitStopUntil = 0;
    this.zoom = 1;
    this.difficultyT = 0;
    this.botTuning = { aggro: 320, prey: 420, objects: 480, decision: 0.5, passive: 0 };
    this.running = false;
    this.paused = false;
    this.lastTime = 0;
    this.shake = 0;
    this.adPendingCoins = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.comboTimer = 0;
    this.comboDisplayAlpha = 0;
    this.comboWindowOverride = null;
    this.dangerWarned = new Set();
    this.adUsedThisRound = false;

    // Phase 4: Evolution + Overdrive (run-only state, reset every round)
    this.activeMutations = new Set();
    this.evolutionOffersTriggered = new Set();
    this.evolutionPending = false;
    this.introPending = false;
    this.evolutionAutoPickTimer = null;
    this.magnetUntil = 0;
    this.speedBoostUntil = 0;
    this.scannerTimer = 0;
    this.scannerTarget = null;
    this.scannerTargetUntil = 0;
    this.bountyTarget = null;
    this.overdriveActive = false;
    this.overdriveVariant = null;
    this.overdriveTag = null;

    // Phase 5: seeded run modifier (lightweight — see docs for scope)
    this.modifier = 'none';

    // Phase 7: casual run tools (consumable, casual-only)
    this.selectedRunTool = 'none';
    this.shieldCharges = 0;
    this.toolMagnetUntil = 0;

    // Phase 9: Daily Seed Challenge
    this.isDailyRun = false;

    // Vector Hole v3: Campaign mode state (see the "Campaign mode" section
    // of the class below). 'arena' covers the existing quickplay + Daily
    // Seed Challenge; 'campaign' is the new mission-driven mode.
    this.mode = 'arena';
    this.campaignEntities = [];
    this.mission = null;
    this.selectedDistrictId = null;
    this.selectedMissionId = null;
    this.campaignSpawn = null;

    // Daily mission (real progress tracking, replaces the old static line)
    this.activeMission = null;
    this.missionProgressPeak = 0;
    this.rivalsEatenThisRun = 0;
    this.missionJustCompleted = false;
    this.hubMilestoneReward = null;
    this.hubMilestoneRewards = [];
    this.hubMilestoneReached = false;

    this.sessionId = generateId('session');
    this.analytics = new Analytics();
    this.analytics.consent = () => !!(this.save.privacy && this.save.privacy.analytics);
    this.sessionStartedAt = Date.now();
    // Golden Shot v11: synthesized SFX + adaptive music (see SoundEngine).
    this.sound = new SoundEngine(this.save.settings);
    // v16: the music bank asks the save which tracks are unlocked and
    // tells the HUD / pause sheet what is playing.
    this.sound.library = { isUnlocked: id => this.isTrackUnlocked(id) };
    this.sound.onTrackChange = song => this.onMusicTrackChange(song);
    this.monetization = new Monetization(this);
    const unlockAudio = () => this.sound.unlock();
    // pointerdown alone is not a user activation in Safari -- pointerup /
    // touchend / click are, so audio is (re)started on those too, on every
    // tap (cheap no-op while running): iOS can stop the context any time.
    ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'].forEach(ev => window.addEventListener(ev, unlockAudio, { passive: true, capture: true }));
    document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button')) this.sound.ui(); });
    this.state = GameState.BOOT;

    // Movement intent shared by the Floating Thumb Pad and keyboard input;
    // legacy drag keeps using this.pointerWorld + moveToward() directly.
    this.moveVector = { x: 0, y: 0, magnitude: 0 };
    this.keyDir = { x: 0, y: 0 };
    this.thumbpadTouchId = null;
    this.thumbpadFadeTimer = null;

    // Re-probe one level above the remembered one each session, so a
    // one-off slow session can't pin a device to low quality forever.
    this.applyGfx(clamp(Math.round(this.save.settings.gfxLevel != null ? this.save.settings.gfxLevel : 2) + 1, 0, 2));
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    this.bindUI();
    this.populateShop();
    this.updateCoinDisplays();
    this.updateChallengeCountdown();
    setInterval(() => { this.updateChallengeCountdown(); this.updateFreeChestRow(); }, 1000);

    this.captureChallengeLink();
    this.monetization.ready.then(() => {
      const portalSearch = this.monetization.incomingChallengeSearch();
      if (portalSearch) this.captureChallengeLink(portalSearch);
    });
    this.state = GameState.MENU;
    this.showScreen('mainMenu'); // also renders the bottom nav for the initial screen
    this.analytics.track('session_start', { sessionId: this.sessionId, configVersion: CONFIG.version });
    this.trackRetention();
    this.renderConsentBar();
    if (this.save.integrity.tampered && !this.save.integrity.reported) {
      this.analytics.track('save_tampered', {});
      this.save.integrity.reported = true;
      saveGame(this.save);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.analytics.track('session_end', { sessionId: this.sessionId, durationMs: Date.now() - this.sessionStartedAt });
        this.sound.suspend();
        // Backgrounding mid-round (phone call, app switch) pauses instead of
        // letting the clock run out unseen.
        if (this.running && !this.paused) this.pauseGame();
      } else {
        this.sound.resume();
      }
    });
  }

  /* ---------- setup ---------- */

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, GFX_LEVELS[this.gfxLevel != null ? this.gfxLevel : 2].maxDpr);
    // v13.4: measure the app box, not innerHeight -- on iOS home-screen apps
    // innerHeight can be the screen minus the status bar.
    const box = document.getElementById('app').getBoundingClientRect();
    this.width = Math.round(box.width) || window.innerWidth;
    this.height = Math.round(box.height) || window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.dpr = dpr;
    // Minimap defaults to visible on every viewport — an earlier pass
    // auto-hid it below 700px, which is effectively every phone in
    // portrait and read as the minimap being missing entirely. Only an
    // explicit "off" now hides it; "auto"/"on" both show it.
    const pref = this.save ? this.save.settings.minimap : 'auto';
    this.showMinimap = pref !== 'off';
  }

  applyGfx(level) {
    this.gfxLevel = level;
    document.body.dataset.gfx = level; // CSS-only effects (the in-round vignette) key off it
    const L = GFX_LEVELS[level];
    CONFIG.juice.maxParticles = L.particles;
    OBJECT_ART_LITE = level === 0;
    // Shadow blur off for the whole game canvas in one place (an own
    // property shadows the prototype accessor; delete restores it).
    if (!L.blur) Object.defineProperty(this.ctx, 'shadowBlur', { configurable: true, get: () => 0, set: () => {} });
    else delete this.ctx.shadowBlur;
    this.resize();
  }

  /** Frame-time watchdog (see GFX_LEVELS). Only judges frames of a live,
   *  visible round, so menus and pauses never trigger a downgrade. */
  monitorFrame(workMs) {
    // Judges the game's own work per frame (update + render), not the gap
    // between RAF callbacks -- a 30 Hz-capped phone (low-power mode) is not
    // overloaded and must not be downgraded.
    if (!(workMs >= 0 && workMs < 250) || this.gfxLevel === 0) return;
    if (this.frameWarmup > 0) { this.frameWarmup--; return; } // sprite cache warm-up
    this.frameEma = this.frameEma ? this.frameEma * 0.95 + workMs * 0.05 : workMs;
    if (this.frameEma <= 20) { this.slowFrames = 0; return; }
    this.slowFrames = (this.slowFrames || 0) + 1;
    if (this.slowFrames < 120) return;
    this.slowFrames = 0;
    this.frameEma = 0;
    this.applyGfx(this.gfxLevel - 1);
    this.save.settings.gfxLevel = this.gfxLevel;
    saveGame(this.save);
    this.analytics.track('gfx_downgrade', { level: this.gfxLevel });
  }

  /** True while the Floating Thumb Pad should handle touch (feature flag is
   *  the global kill switch; the player's own setting picks the mode). */
  get useThumbpad() {
    return CONFIG.flags.inputThumbPad && this.save.settings.inputMode === 'thumbpad';
  }

  bindInput() {
    this.isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    // Only touch devices get the cursor hidden (see #gameCanvas / body.touch-input
    // in style.css) -- desktop mouse play needs the native cursor visible since
    // it's the only feedback for where the direct-drag pointer target is.
    document.body.classList.toggle('touch-input', this.isTouchDevice);
    this.pointerWorld = { x: WORLD_W / 2, y: WORLD_H / 2 };
    // v13: the finger/cursor's SCREEN position drives direct-drag steering
    // and is re-projected every frame (applyPlayerMovement()). Steering off
    // the world point captured at the last move event made the hole drive
    // itself to the world centre at round start and stop dead under a
    // finger that was still held down once the camera had followed it.
    this.pointerScreen = null;
    const updateFromScreen = (sx, sy) => {
      this.pointerScreen = { x: sx, y: sy };
      this.pointerWorld = {
        x: this.camera.x + (sx - this.width / 2) / this.zoom,
        y: this.camera.y + (sy - this.height / 2) / this.zoom
      };
    };

    // ---- Mouse (desktop): unchanged direct-drag chase behavior. ----
    // v13: real mouse only -- a finger tap on a DOM button (coach card,
    // evolution card, resume) also fires an emulated mousemove, which would
    // otherwise leave a phantom steering point behind.
    window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') updateFromScreen(e.clientX, e.clientY); });

    // ---- Keyboard (desktop accessibility): WASD / arrow keys. ----
    const keyMap = {
      KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right'
    };
    const heldKeys = new Set();
    const recomputeKeyDir = () => {
      let x = 0, y = 0;
      if (heldKeys.has('left')) x -= 1;
      if (heldKeys.has('right')) x += 1;
      if (heldKeys.has('up')) y -= 1;
      if (heldKeys.has('down')) y += 1;
      const mag = Math.hypot(x, y);
      this.keyDir = mag > 0 ? { x: x / mag, y: y / mag } : { x: 0, y: 0 };
    };
    window.addEventListener('keydown', (e) => {
      const dir = keyMap[e.code];
      if (!dir) return;
      if (e.code === 'Escape') return;
      heldKeys.add(dir);
      recomputeKeyDir();
    });
    window.addEventListener('keyup', (e) => {
      const dir = keyMap[e.code];
      if (!dir) return;
      heldKeys.delete(dir);
      recomputeKeyDir();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.running) this.togglePause();
    });

    // ---- Touch: Floating Thumb Pad (default) or legacy full-screen drag. ----
    const thumbBase = document.getElementById('thumbpadBase');
    const thumbKnob = document.getElementById('thumbpadKnob');
    const zoneTop = () => this.height * (1 - CONFIG.input.zoneHeightFraction);

    const showThumbpad = (sx, sy) => {
      clearTimeout(this.thumbpadFadeTimer);
      thumbBase.style.left = sx + 'px';
      thumbBase.style.top = sy + 'px';
      thumbBase.classList.remove('hidden');
      requestAnimationFrame(() => thumbBase.classList.add('active'));
    };
    const hideThumbpad = () => {
      thumbBase.classList.remove('active');
      this.thumbpadFadeTimer = setTimeout(() => thumbBase.classList.add('hidden'), CONFIG.input.fadeDelayMs);
    };
    const updateThumbpad = (anchor, sx, sy) => {
      const dx = sx - anchor.x;
      const dy = sy - anchor.y;
      const dist = Math.hypot(dx, dy);
      const { deadZonePx, maxRadiusPx, curveExponent } = CONFIG.input;
      if (dist < deadZonePx) {
        this.moveVector = { x: 0, y: 0, magnitude: 0 };
        thumbKnob.style.transform = 'translate(0px, 0px)';
        return;
      }
      const clamped = Math.min(dist, maxRadiusPx);
      const linear = clamp((clamped - deadZonePx) / (maxRadiusPx - deadZonePx), 0, 1);
      // exponent > 1 suppresses small deflections (precision) and ramps up
      // sharply near full deflection (speed) — the curve the GDD asks for.
      const curved = Math.pow(linear, curveExponent);
      const nx = dx / dist, ny = dy / dist;
      this.moveVector = { x: nx, y: ny, magnitude: curved };
      // Knob visually follows the raw (linear) finger displacement so it
      // reads as "attached to your thumb"; only the resulting speed is curved.
      thumbKnob.style.transform = `translate(${nx * clamped * 0.7}px, ${ny * clamped * 0.7}px)`;
    };

    let anchor = null;

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      if (this.useThumbpad && this.running && !this.paused && t.clientY >= zoneTop()) {
        anchor = { x: t.clientX, y: t.clientY };
        this.thumbpadTouchId = t.identifier;
        showThumbpad(anchor.x, anchor.y);
        this.moveVector = { x: 0, y: 0, magnitude: 0 };
      } else {
        this.thumbpadTouchId = null;
        updateFromScreen(t.clientX, t.clientY);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touches = Array.from(e.touches);
      if (this.thumbpadTouchId !== null) {
        const t = touches.find(t => t.identifier === this.thumbpadTouchId);
        if (t && anchor) updateThumbpad(anchor, t.clientX, t.clientY);
      } else {
        const t = touches[0];
        if (t) updateFromScreen(t.clientX, t.clientY);
      }
    }, { passive: false });

    const endThumbTouch = (e) => {
      if (e.touches.length === 0) this.pointerScreen = null; // finger up = stop
      const stillDown = Array.from(e.touches).some(t => t.identifier === this.thumbpadTouchId);
      if (this.thumbpadTouchId !== null && !stillDown) {
        this.thumbpadTouchId = null;
        anchor = null;
        this.moveVector = { x: 0, y: 0, magnitude: 0 };
        hideThumbpad();
      }
    };
    this.canvas.addEventListener('touchend', endThumbTouch, { passive: true });
    this.canvas.addEventListener('touchcancel', endThumbTouch, { passive: true });
  }

  /** Short vibration if haptics are enabled and the browser supports it.
   *  Feature-detected — never assumed available (GDD 5.1). */
  vibrate(ms) {
    if (this.save.settings.haptics && navigator.vibrate) navigator.vibrate(ms);
  }

  bindUI() {
    document.getElementById('btnStart').addEventListener('click', () => this.startArenaRound());
    document.getElementById('btnStartTutorial').addEventListener('click', () => this.startCampaignMission('M00'));
    // Golden Shot v8 retention loop.
    document.getElementById('btnLoginClaim').addEventListener('click', () => this.claimLoginReward());
    document.getElementById('btnLoginDouble').addEventListener('click', () => this.doubleLoginReward());
    document.getElementById('btnLoginClose').addEventListener('click', () => this.closeLoginReward());
    document.getElementById('btnReviveAd').addEventListener('click', () => this.acceptRevive());
    document.getElementById('btnReviveNo').addEventListener('click', () => this.declineRevive());
    document.getElementById('btnFreePrisms').addEventListener('click', () => this.watchFreePrismsAd());
    document.getElementById('btnAcceptChallenge').addEventListener('click', () => this.acceptChallenge());
    document.getElementById('btnDismissChallenge').addEventListener('click', () => this.dismissChallenge());
    document.getElementById('btnConsentYes').addEventListener('click', () => this.setConsent(true));
    document.getElementById('btnConsentNo').addEventListener('click', () => this.setConsent(false));
    document.getElementById('btnConsentPolicy').addEventListener('click', () => this.openPrivacyPolicy());
    document.getElementById('btnPrivacyPolicy').addEventListener('click', () => this.openPrivacyPolicy());
    document.getElementById('btnExportData').addEventListener('click', () => this.exportMyData());
    document.querySelectorAll('[data-consent]').forEach(btn => btn.addEventListener('click', () => this.setConsent(btn.dataset.consent === '1')));
    document.getElementById('hubFreeChest').addEventListener('click', () => this.openFreeChest());
    document.getElementById('hubPlayerLevel').addEventListener('click', () => this.openPlayerLevelInfo());
    document.getElementById('btnUpsell').addEventListener('click', () => this.onUpsellClick());
    document.getElementById('runPerk').addEventListener('click', () => {
      if (this.isWarsztatUnlocked()) this.openWarsztatScreen(); else this.openLockedTabInfo('warsztat');
    });
    document.getElementById('btnTutorialIntroStart').addEventListener('click', () => this.dismissTutorialIntro());
    document.getElementById('btnConfirmStart').addEventListener('click', () => this.confirmRunSetup());
    document.getElementById('btnRunSetupBack').addEventListener('click', () => this.showScreen('mainMenu'));

    // GDD 4.0 §5.1: Miasto's secondary CTA opens the Wyzwania tab (goal
    // text/countdown/streak live there); the tab's own button actually
    // starts the round.
    document.getElementById('btnDaily').addEventListener('click', () => {
      if (this.isWyzwaniaUnlocked()) this.openChallengesScreen(); else this.openLockedTabInfo('wyzwania');
    });
    document.getElementById('btnPlayDaily').addEventListener('click', () => this.startDailyChallenge());

    // GDD 4.0 §5.1-§5.4 bottom nav (Miasto/Dzielnice/Warsztat/Wyzwania).
    document.getElementById('btnNavMiasto').addEventListener('click', () => this.showScreen('mainMenu'));
    document.getElementById('btnNavDzielnice').addEventListener('click', () => this.openCampaignScreen());
    document.getElementById('btnNavWarsztat').addEventListener('click', () => {
      if (this.isWarsztatUnlocked()) this.openWarsztatScreen(); else this.openLockedTabInfo('warsztat');
    });
    document.getElementById('btnNavWyzwania').addEventListener('click', () => {
      if (this.isWyzwaniaUnlocked()) this.openChallengesScreen(); else this.openLockedTabInfo('wyzwania');
    });

    // Player feedback: everything on the hub that looks tappable should
    // explain itself instead of silently ignoring the tap.
    document.getElementById('btnInfoSheetClose').addEventListener('click', () => this.closeInfoSheet());
    document.getElementById('btnUnlockGo').addEventListener('click', () => this.onUnlockGo());
    document.getElementById('btnUnlockLater').addEventListener('click', () => this.showNextUnlock());
    document.getElementById('btnInfoSheetAction').addEventListener('click', () => {
      const action = this.infoSheetAction;
      this.closeInfoSheet();
      if (action) action();
    });
    document.getElementById('infoSheet').addEventListener('click', (e) => {
      if (e.target.id === 'infoSheet') this.closeInfoSheet();
    });
    document.querySelectorAll('.coin-display').forEach(el => {
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      const isPrism = el.classList.contains('prism-display');
      el.setAttribute('aria-label', isPrism ? 'Pryzmaty — co to jest?' : 'Monety — co to jest?');
      el.addEventListener('click', () => this.openCurrencyInfo(isPrism));
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openCurrencyInfo(isPrism); } });
    });
    const heroStage = document.getElementById('hubHeroStage');
    heroStage.addEventListener('click', () => this.openCoreCityRoadmap());
    heroStage.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openCoreCityRoadmap(); } });

    // v14 campaign flow: the hub's campaign tile opens the next mission's
    // briefing; any mission card's GRAJ (briefing, Dzielnice's "next"
    // card) starts it via a delegated [data-mc-play] click.
    document.getElementById('hubCampaignTile').addEventListener('click', () => {
      const next = this.nextCampaignMissionId();
      if (next) this.openMissionBriefing(next); else this.openCampaignScreen();
    });
    document.getElementById('btnBriefingClose').addEventListener('click', () => this.closeMissionBriefing());
    document.getElementById('missionBriefing').addEventListener('click', (e) => {
      if (e.target.id === 'missionBriefing') this.closeMissionBriefing();
    });
    // v15: GRAJ in the briefing launches (boosters + energy); every other
    // mission GRAJ opens that briefing first.
    document.addEventListener('click', (e) => {
      if (!e.target.closest) return;
      const boost = e.target.closest('[data-booster]');
      if (boost) { this.toggleBriefingBooster(boost.dataset.booster); return; }
      const launch = e.target.closest('[data-mc-launch]');
      if (launch && !launch.disabled) { this.launchMission(launch.dataset.mcLaunch); return; }
      const btn = e.target.closest('[data-mc-play]');
      if (!btn || btn.disabled) return;
      this.openMissionBriefing(btn.dataset.mcPlay);
    });
    document.getElementById('missionStartOverlay').addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('#btnMissionBack')) { this.cancelMissionStart(); return; }
      this.beginMissionPlay();
    });
    document.querySelectorAll('.energy-chip').forEach(el => el.addEventListener('click', () => this.openEnergySheet()));
    document.getElementById('btnEnergyAd').addEventListener('click', () => this.energyFromAd());
    document.getElementById('btnEnergyRefill').addEventListener('click', () => this.energyRefillPrisms());
    document.getElementById('btnEnergyClose').addEventListener('click', () => this.closeEnergySheet());
    document.getElementById('energySheet').addEventListener('click', (e) => { if (e.target.id === 'energySheet') this.closeEnergySheet(); });
    document.getElementById('btnRevivePrisms').addEventListener('click', () => this.acceptRevivePrisms());
    clearInterval(this.energyInterval);
    this.energyInterval = setInterval(() => this.updateEnergyDisplays(), 1000);
    document.querySelectorAll('.nela-avatar').forEach(el => { el.innerHTML = NELA_AVATAR; });
    // A tap closes NELA's in-mission bubble (it must never sit on the board).
    document.getElementById('nelaToast').addEventListener('click', () => this.hideNelaToast());
    // Player feedback: every level needs a way back to the main menu --
    // the mission result screen previously only offered Next/Retry/Map.
    document.getElementById('btnMissionMenu').addEventListener('click', () => {
      this.updateCoinDisplays();
      this.state = GameState.MENU;
      this.showScreen('mainMenu');
    });

    document.getElementById('btnEvolutionSkip').addEventListener('click', () => this.skipEvolutionOffer());

    // GDD 4.0 §5: every hub screen's header repeats the same ⚙ gear button.
    document.querySelectorAll('.hub-gear-btn').forEach(btn => {
      btn.addEventListener('click', () => this.openProfileScreen());
    });
    document.getElementById('btnSaveProfile').addEventListener('click', () => this.saveProfile());
    document.getElementById('btnProfileBack').addEventListener('click', () => this.showScreen('mainMenu'));
    document.getElementById('btnResetProfile').addEventListener('click', () => {
      document.getElementById('resetProfileConfirm').classList.remove('hidden');
    });
    document.getElementById('btnResetProfileNo').addEventListener('click', () => {
      document.getElementById('resetProfileConfirm').classList.add('hidden');
    });
    document.getElementById('btnResetProfileYes').addEventListener('click', () => this.resetProfile());
    // GDD 4.0 §5.3: Warsztat has 4 equip categories (Rdzeń/Trail/Efekt
    // pochłaniania/Overdrive) instead of the old 2 (Ring/Aura tabs).
    const shopTabs = [
      { tab: 'tabSkins', grid: 'skinGrid' },
      { tab: 'tabAuras', grid: 'auraGrid' },
      { tab: 'tabEffects', grid: 'effectGrid' },
      { tab: 'tabOverdrive', grid: 'overdriveSkinGrid' }
    ];
    shopTabs.forEach(({ tab, grid }) => {
      document.getElementById(tab).addEventListener('click', () => {
        shopTabs.forEach(({ tab: t, grid: g }) => {
          document.getElementById(t).classList.toggle('active', t === tab);
          document.getElementById(g).classList.toggle('hidden', g !== grid);
        });
        this.updateCosmeticUnlockedCount();
      });
    });

    document.getElementById('btnPlayAgain').addEventListener('click', () => {
      this.analytics.track('result_action', { action: 'play_again' });
      this.requestPlayAgain();
    });
    document.getElementById('btnShare').addEventListener('click', () => this.shareResult());
    document.getElementById('btnMenu').addEventListener('click', () => {
      this.analytics.track('result_action', { action: 'menu' });
      this.updateCoinDisplays();
      this.state = GameState.MENU;
      this.showScreen('mainMenu');
    });
    document.getElementById('btnWatchAd').addEventListener('click', () => this.watchRewardedAd());

    // ---- Pause / Controls / Leave Run ----
    document.getElementById('btnPause').addEventListener('click', () => this.pauseGame());
    document.getElementById('btnSoundTest').addEventListener('click', () => this.playSoundTest());
    document.getElementById('btnJukebox').addEventListener('click', () => this.openJukebox());
    document.getElementById('infoSheetBody').addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('[data-track]');
      if (b) this.pickJukeboxTrack(b.dataset.track);
    });
    document.getElementById('btnNextTrack').addEventListener('click', () => {
      this.sound.unlock();
      const id = this.sound.skipTrack();
      this.analytics.track('music_skip', { track: id, mode: this.mode });
    });
    document.getElementById('btnResume').addEventListener('click', () => this.resumeGame());
    document.getElementById('btnRestart').addEventListener('click', () => this.restartFromPause());
    document.getElementById('btnControls').addEventListener('click', () => {
      document.getElementById('controlsPanel').classList.toggle('hidden');
    });
    document.getElementById('btnLeaveRun').addEventListener('click', () => {
      document.getElementById('pauseSheet').classList.add('hidden');
      document.getElementById('leaveConfirm').classList.remove('hidden');
    });
    document.getElementById('btnQuickEquip').addEventListener('click', () => this.openQuickEquip());
    document.getElementById('quickEquipAura').addEventListener('click', () => this.cycleQuickEquip('aura'));
    document.getElementById('quickEquipEffect').addEventListener('click', () => this.cycleQuickEquip('effect'));
    document.getElementById('quickEquipOverdrive').addEventListener('click', () => this.cycleQuickEquip('overdriveSkin'));
    document.getElementById('btnQuickEquipApply').addEventListener('click', () => this.closeQuickEquip(true));
    document.getElementById('btnQuickEquipClose').addEventListener('click', () => this.closeQuickEquip(false));
    document.getElementById('btnLeaveConfirmYes').addEventListener('click', () => this.leaveRun());
    document.getElementById('btnLeaveConfirmNo').addEventListener('click', () => {
      document.getElementById('leaveConfirm').classList.add('hidden');
      document.getElementById('pauseSheet').classList.remove('hidden');
    });

    document.getElementById('btnInputThumbpad').addEventListener('click', () => {
      this.save.settings.inputMode = 'thumbpad';
      saveGame(this.save);
      this.syncControlsPanel();
    });
    document.getElementById('btnInputLegacy').addEventListener('click', () => {
      this.save.settings.inputMode = 'legacy';
      saveGame(this.save);
      this.syncControlsPanel();
    });
    document.querySelectorAll('[data-sensitivity]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.save.settings.sensitivity = parseFloat(btn.dataset.sensitivity);
        saveGame(this.save);
        this.syncControlsPanel();
      });
    });
    document.getElementById('btnHapticsOn').addEventListener('click', () => {
      this.save.settings.haptics = true;
      saveGame(this.save);
      this.syncControlsPanel();
      this.vibrate(30);
    });
    document.getElementById('btnHapticsOff').addEventListener('click', () => {
      this.save.settings.haptics = false;
      saveGame(this.save);
      this.syncControlsPanel();
    });
    // Golden Shot v11: on/off toggles shared by the pause sheet and the
    // profile/settings screen (`data-setting` = save.settings key).
    document.querySelectorAll('[data-setting]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.save.settings[btn.dataset.setting] = btn.dataset.value === '1';
        saveGame(this.save);
        this.sound.unlock();
        this.sound.applySettings();
        this.syncControlsPanel();
      });
    });

    // ---- Standings header: tap to collapse to just the rank line.
    // Visible/expanded by default -- this is the "who's ahead of you"
    // panel and should never start hidden. ----
    document.getElementById('hud-rankBadge').addEventListener('click', () => {
      document.getElementById('hud-topright').classList.toggle('collapsed');
    });

    // Browser back / tab close mid-round shouldn't silently lose a run —
    // native "leave site?" prompt is the only customizable-by-copy option
    // browsers allow for this (GDD 5.2).
    window.addEventListener('beforeunload', (e) => {
      if (this.running && !this.paused) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  /** Generic renderer shared by all 4 Warsztat cosmetic categories (GDD 4.0
   *  §5.3: Rdzeń/Trail/Efekt pochłaniania/Overdrive). Reward-only items
   *  (unlockSource set — the Core City ladder / mission rewards) show their
   *  unlock source instead of a price and aren't buyable from here (GDD
   *  §5.3: "czytelne źródło blokady: Misja / Core City / Daily / Sklep"). */
  /** Cards show the *pending* loadout (this.pendingLoadout), not the saved
   *  one -- GDD 4.0 §5.3's two-step flow: tap an owned card to preview it
   *  (updates "PODGLĄD NA ŻYWO" immediately, for free), tap "ZAŁÓŻ" to
   *  actually commit the whole 4-category loadout at once. Buying an item
   *  still spends currency and unlocks it immediately either way. */
  renderCosmeticGrid(gridId, items, ownedList, pendingId, onPick) {
    const grid = document.getElementById(gridId);
    grid.innerHTML = '';
    items.forEach(item => {
      const owned = ownedList.includes(item.id);
      if (item.unlockSource && item.unlockSource.type === 'iap' && !owned && !this.monetization.canPurchase) return;
      const selected = pendingId === item.id;
      const card = document.createElement('div');
      card.className = 'skin-card' + (selected ? ' selected' : '') + (!owned ? ' locked' : '');

      // Rdzeń/Trail cards show the real in-round hole (Hole.draw() via
      // renderWarsztatCanvases()) instead of a CSS color dot, so what you
      // pick is exactly what you play with.
      const holeThumb = gridId === 'skinGrid' || gridId === 'auraGrid';
      const swatch = document.createElement(holeThumb ? 'canvas' : 'div');
      swatch.className = holeThumb ? 'hole-swatch' : 'skin-swatch';
      if (holeThumb) {
        if (gridId === 'skinGrid') { swatch.dataset.skin = item.id; swatch.dataset.aura = 'none'; }
        else swatch.dataset.aura = item.id;
      } else if (item.rainbow) {
        swatch.style.borderColor = '#fff';
        swatch.style.backgroundImage = 'conic-gradient(red, orange, yellow, lime, cyan, blue, violet, red)';
      } else if (item.color) {
        swatch.style.borderColor = item.color;
        swatch.style.boxShadow = `0 0 10px ${item.color}`;
      } else {
        swatch.style.borderColor = 'rgba(255,255,255,0.3)';
      }
      card.appendChild(swatch);

      const body = document.createElement('div');
      body.className = 'skin-card-body';
      const name = document.createElement('div');
      name.className = 'skin-name';
      name.textContent = item.name;
      body.appendChild(name);

      if (gridId === 'skinGrid' && item.perkLabel) {
        const perk = document.createElement('div');
        perk.className = 'skin-perk' + (item.perks && item.perks.length ? '' : ' none');
        perk.textContent = item.perkLabel;
        body.appendChild(perk);
      }

      const meta = document.createElement('div');
      meta.className = owned ? 'skin-owned-badge' : 'skin-price';
      meta.textContent = owned ? (selected ? 'ZAŁOŻONE' : 'ZAŁÓŻ') : this.cosmeticLockLabel(item);
      body.appendChild(meta);
      card.appendChild(body);

      if (selected) {
        const check = document.createElement('span');
        check.className = 'skin-card-check';
        check.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>';
        card.appendChild(check);
      }

      card.addEventListener('click', () => onPick(item));
      grid.appendChild(card);
    });
  }

  cosmeticLockLabel(item) {
    if (item.unlockSource && item.unlockSource.type === 'iap') return 'PAKIET STARTOWY';
    if (item.unlockSource) {
      return item.unlockSource.type === 'coreCity'
        ? `CORE CITY LVL ${item.unlockSource.level}`
        : `NAGRODA ZA ${campaignMissionById(item.unlockSource.id) ? missionCode(campaignMissionById(item.unlockSource.id)) : item.unlockSource.id}`;
    }
    if (item.priceType === 'prisms') return `◆ ${item.pricePrisms}`;
    return `◇ ${item.priceCoins != null ? item.priceCoins : item.price}`;
  }

  /** GDD 4.0 §5.3's "6 / 24 ODBLOKOWANE" counter, for whichever category
   *  tab is currently visible. */
  updateCosmeticUnlockedCount() {
    const categories = {
      skinGrid: [SKINS, this.save.owned],
      auraGrid: [AURAS, this.save.auras.owned],
      effectGrid: [EAT_EFFECTS, this.save.effects.owned],
      overdriveSkinGrid: [OVERDRIVE_SKINS, this.save.overdriveSkins.owned]
    };
    const activeId = Object.keys(categories).find(id => !document.getElementById(id).classList.contains('hidden'));
    if (!activeId) return;
    const [items, owned] = categories[activeId];
    document.getElementById('cosmeticUnlockedCount').textContent = `${owned.length} / ${items.length} ODBLOKOWANE`;
  }

  populateShop() {
    this.renderCosmeticGrid('skinGrid', SKINS, this.save.owned, this.pendingLoadout.skin, skin => this.onCosmeticPick('skin', skin));
    this.updateCosmeticUnlockedCount();
  }

  /** Phase 7 shop v2's second cosmetic category — gives Prisms an actual
   *  sink alongside Coins (GDD 10.1/10.2). Renamed "Trail" in the Warsztat
   *  UI per GDD 4.0 §5.3, same following-glow render path underneath. */
  populateAuras() {
    this.renderCosmeticGrid('auraGrid', AURAS, this.save.auras.owned, this.pendingLoadout.aura, aura => this.onCosmeticPick('aura', aura));
    this.updateCosmeticUnlockedCount();
  }

  /** GDD 4.0 §5.3 category 3: "Efekt pochłaniania" — see the color override
   *  in triggerEatFeedback(). 'classic' (free, color: null) is always owned. */
  populateEffects() {
    this.renderCosmeticGrid('effectGrid', EAT_EFFECTS, this.save.effects.owned, this.pendingLoadout.effect, effect => this.onCosmeticPick('effect', effect));
    this.updateCosmeticUnlockedCount();
  }

  /** GDD 4.0 §5.3 category 4: "Overdrive" — a cosmetic tint on Arena's
   *  existing seeded Overdrive finish, see checkOverdriveTrigger(). */
  populateOverdriveSkins() {
    this.renderCosmeticGrid('overdriveSkinGrid', OVERDRIVE_SKINS, this.save.overdriveSkins.owned, this.pendingLoadout.overdriveSkin, skin => this.onCosmeticPick('overdriveSkin', skin));
    this.updateCosmeticUnlockedCount();
  }

  /** v14 Warsztat: one handler for every category. An owned item is put on
   *  at once (the ZAŁÓŻ button sat below the whole grid); anything else is
   *  previewed on the live hole while a sheet says what it costs or where
   *  it comes from -- a purchase always needs that confirming tap (a single
   *  tap used to spend the coins). */
  onCosmeticPick(cat, item) {
    const C = {
      skin: { owned: this.save.owned, noun: 'Wir', key: 'skinId' },
      aura: { owned: this.save.auras.owned, noun: 'Smuga', key: 'auraId' },
      effect: { owned: this.save.effects.owned, noun: 'Efekt pochłaniania', key: 'effectId' },
      overdriveSkin: { owned: this.save.overdriveSkins.owned, noun: 'Finisz', key: 'overdriveSkinId' }
    }[cat];
    this.sound.ui();
    if (C.owned.includes(item.id)) {
      this.pendingLoadout[cat] = item.id;
      this.onEquipClick();
      this.updateWarsztatPreview();
      return;
    }
    const equipped = { skin: this.save.selected, aura: this.save.auras.selected, effect: this.save.effects.selected, overdriveSkin: this.save.overdriveSkins.selected }[cat];
    this.pendingLoadout[cat] = item.id;
    this.updateWarsztatPreview();
    const revert = () => { this.pendingLoadout[cat] = equipped; this.updateWarsztatPreview(); };
    const title = `${C.noun} „${item.name}”`;
    const perk = cat === 'skin' && item.perkLabel ? [`Bonus w rundzie: <strong>${item.perkLabel}</strong>`] : [];
    const icon = REWARD_CATEGORY_ICONS[cat === 'overdriveSkin' ? 'overdrive' : cat];
    if (item.unlockSource) {
      this.analytics.track('cosmetic_preview', { [C.key]: item.id, locked: true });
      const src = item.unlockSource.type === 'iap' ? 'w Pakiecie startowym' : `jako nagrodę: ${this.cosmeticLockLabel(item)}`;
      this.openInfoSheet({ icon, title, body: [...perk, `Tego nie kupisz za monety — zdobędziesz ${src}. Na podglądzie widać, jak wygląda.`], onClose: revert, bottom: true });
      return;
    }
    const prisms = item.priceType === 'prisms';
    const price = prisms ? item.pricePrisms : (item.priceCoins != null ? item.priceCoins : (item.price || 0));
    const have = prisms ? (this.save.prisms || 0) : this.save.coins;
    const sym = prisms ? '◆' : '◇';
    if (have < price) {
      this.analytics.track('cosmetic_preview', { [C.key]: item.id, price, affordable: false });
      this.openInfoSheet({
        icon, title,
        body: [...perk, `Cena: <strong>${price} ${sym}</strong> — brakuje jeszcze ${price - have} ${sym}.`,
          prisms ? 'Pryzmaty dostajesz za co 3. rundę, rekordy w Wyzwaniu dnia i reklamę „Darmowe pryzmaty”.' : 'Monety zdobywasz w każdej rundzie GRAJ 2:00 i w Wyzwaniu dnia.'],
        action: this.isArenaUnlocked() ? { label: 'ZAGRAJ RUNDĘ', onClick: () => this.startArenaRound() } : null,
        onClose: revert, closeLabel: 'NIE TERAZ', bottom: true
      });
      return;
    }
    this.openInfoSheet({
      icon, title,
      body: [...perk, `Cena: <strong>${price} ${sym}</strong> (masz ${have} ${sym}). Na podglądzie widać, jak wygląda.`],
      action: { label: `KUP I ZAŁÓŻ · ${price} ${sym}`, onClick: () => {
        if (prisms) this.save.prisms -= price; else this.save.coins -= price;
        C.owned.push(item.id);
        this.analytics.track('soft_purchase', { [C.key]: item.id, price, currency: prisms ? 'prisms' : 'coins' });
        this.pendingLoadout[cat] = item.id;
        this.onEquipClick();
        this.sound.coin();
        this.updateCoinDisplays();
        this.updateWarsztatPreview();
      } },
      onClose: revert, closeLabel: 'NIE TERAZ', bottom: true
    });
  }

  /** Commits the pending loadout to the save (Warsztat picks and the
   *  in-run quick-equip popup both go through here). */
  onEquipClick() {
    this.save.selected = this.pendingLoadout.skin;
    this.save.auras.selected = this.pendingLoadout.aura;
    this.save.effects.selected = this.pendingLoadout.effect;
    this.save.overdriveSkins.selected = this.pendingLoadout.overdriveSkin;
    saveGame(this.save);
    this.analytics.track('loadout_equip', { ...this.pendingLoadout });
    this.populateShop();
    this.populateAuras();
    this.populateEffects();
    this.populateOverdriveSkins();
    this.vibrate(30);
  }

  /** v5: design/screens/wybor_narzedzia.svg — a quick-swap popup opened
   *  from Pauza so the player can cycle to another OWNED cosmetic per
   *  category without leaving the run for the full Warsztat screen. Reuses
   *  the same `pendingLoadout` + onEquipClick() the Warsztat tabs already
   *  commit through, instead of a second equip code path. */
  openQuickEquip() {
    this.pendingLoadout.aura = this.save.auras.selected;
    this.pendingLoadout.effect = this.save.effects.selected;
    this.pendingLoadout.overdriveSkin = this.save.overdriveSkins.selected;
    this.renderQuickEquip();
    document.getElementById('pauseSheet').classList.add('hidden');
    document.getElementById('quickEquipScreen').classList.remove('hidden');
  }

  closeQuickEquip(apply) {
    if (apply) {
      this.onEquipClick();
    } else {
      this.pendingLoadout.aura = this.save.auras.selected;
      this.pendingLoadout.effect = this.save.effects.selected;
      this.pendingLoadout.overdriveSkin = this.save.overdriveSkins.selected;
    }
    document.getElementById('quickEquipScreen').classList.add('hidden');
    document.getElementById('pauseSheet').classList.remove('hidden');
  }

  cycleQuickEquip(category) {
    const table = {
      aura: { items: AURAS, ownedKey: 'auras' },
      effect: { items: EAT_EFFECTS, ownedKey: 'effects' },
      overdriveSkin: { items: OVERDRIVE_SKINS, ownedKey: 'overdriveSkins' }
    };
    const { items, ownedKey } = table[category];
    const owned = items.filter(it => this.save[ownedKey].owned.includes(it.id));
    if (owned.length < 2) return; // nothing else unlocked to cycle to
    const idx = owned.findIndex(it => it.id === this.pendingLoadout[category]);
    this.pendingLoadout[category] = owned[(idx + 1) % owned.length].id;
    this.renderQuickEquip();
  }

  renderQuickEquip() {
    const rows = [
      { category: 'aura', items: AURAS, defaultId: 'none', el: 'quickEquipAura' },
      { category: 'effect', items: EAT_EFFECTS, defaultId: 'classic', el: 'quickEquipEffect' },
      { category: 'overdriveSkin', items: OVERDRIVE_SKINS, defaultId: 'classic', el: 'quickEquipOverdrive' }
    ];
    rows.forEach(row => {
      const item = row.items.find(it => it.id === this.pendingLoadout[row.category]) || row.items[0];
      const card = document.getElementById(row.el);
      card.querySelector('.tool-card-name').textContent = item.name;
      card.classList.toggle('selected', item.id !== row.defaultId);
    });
  }

  /** GDD 4.0 §5.5: Warsztat unlocks after M02 clears OR the player already
   *  owns a cosmetic beyond the free defaults (whichever comes first — a
   *  player who somehow already has a cosmetic shouldn't be locked out). */
  isWarsztatUnlocked() { return FEATURE_GATES.warsztat(this.save); }

  openWarsztatScreen() {
    this.analytics.track('shop_view', {});
    // Reset the pending preview to whatever is actually equipped -- any
    // unconfirmed taps from a previous visit are discarded, matching the
    // ZAŁÓŻ button's "this is a preview until you confirm it" contract.
    this.pendingLoadout = {
      skin: this.save.selected,
      aura: this.save.auras.selected,
      effect: this.save.effects.selected,
      overdriveSkin: this.save.overdriveSkins.selected
    };
    this.populateShop();
    this.populateAuras();
    this.populateEffects();
    this.populateOverdriveSkins();
    this.updateWarsztatPreview();
    this.renderStore();
    this.showScreen('shopScreen');
    this.startWarsztatAnim();
  }

  /* ---- Golden Shot v11: Warsztat store (rewarded prisms + IAP) ---- */

  /** Free prisms for an ad are always offered (capped per day); the paid
   *  packs only render when the provider can actually take a payment
   *  (Monetization.canPurchase) -- never a fake checkout. */
  renderStore() {
    const left = this.monetization.placementLeft('free_prisms');
    const btn = document.getElementById('btnFreePrisms');
    btn.disabled = left <= 0;
    document.getElementById('freePrismsLeft').textContent = left > 0 ? `Zostało dziś: ${left}` : 'Wróć jutro po więcej';
    btn.textContent = left > 0 ? `+${CONFIG.ads.freePrisms} ◆ · REKLAMA` : 'JUTRO';
    const list = document.getElementById('storeProducts');
    list.innerHTML = '';
    const canBuy = this.monetization.canPurchase;
    document.getElementById('storePaid').classList.toggle('hidden', !canBuy);
    if (!canBuy) return;
    const ent = this.save.entitlements;
    IAP_PRODUCTS.forEach(prod => {
      const owned = prod.oneTime && ent.purchased.includes(prod.sku);
      const row = document.createElement('button');
      row.className = 'store-row' + (prod.best ? ' best' : '') + (owned ? ' owned' : '');
      row.disabled = owned;
      row.innerHTML = `<span class="store-row-body"><span class="store-row-name">${escapeHtml(prod.name)}${prod.best ? ' <em>NAJLEPSZA OFERTA</em>' : ''}</span>` +
        `<span class="store-row-desc">${escapeHtml(prod.desc)}</span></span>` +
        `<span class="store-row-price">${owned ? 'KUPIONO ✓' : escapeHtml(this.monetization.price(prod.sku))}</span>`;
      row.addEventListener('click', () => this.buyProduct(prod.sku));
      list.appendChild(row);
    });
  }

  async watchFreePrismsAd() {
    if (!(await this.monetization.rewarded('free_prisms'))) return;
    this.save.prisms = (this.save.prisms || 0) + CONFIG.ads.freePrisms;
    saveGame(this.save);
    this.sound.coin();
    this.updateCoinDisplays();
    this.renderStore();
  }

  async buyProduct(sku) {
    const prod = IAP_PRODUCTS.find(p => p.sku === sku);
    if (!prod) return;
    if (!(await this.monetization.purchase(sku))) return;
    this.grantProduct(prod);
  }

  /** Applies a confirmed purchase. Kept separate from buyProduct() so a
   *  native wrapper can also restore purchases (window.game.grantProduct). */
  grantProduct(prod) {
    const g = prod.grant, ent = this.save.entitlements;
    if (prod.oneTime && ent.purchased.includes(prod.sku)) return;
    if (g.coins) this.save.coins += g.coins;
    if (g.prisms) this.save.prisms = (this.save.prisms || 0) + g.prisms;
    if (g.auraId && !this.save.auras.owned.includes(g.auraId)) this.save.auras.owned.push(g.auraId);
    if (g.noAds) ent.noAds = true;
    if (g.infiniteEnergyMin) {
      const en = this.save.energy;
      en.infiniteUntil = Math.max(en.infiniteUntil || 0, Date.now()) + g.infiniteEnergyMin * 60000;
      en.value = Math.max(en.value, CONFIG.energy.max);
    }
    ent.purchased.push(prod.sku);
    saveGame(this.save);
    this.queueRewardCelebration({
      kicker: 'DZIĘKUJEMY!', eyebrow: 'ZAKUP UDANY', title: prod.name, color: '#EFCB63',
      icon: REWARD_CATEGORY_ICONS.bundle, noCta: true, desc: prod.desc
    });
    this.queueUnlockCelebrations();
    this.updateCoinDisplays();
    this.renderStore();
    this.populateAuras();
  }

  /** "PODGLĄD NA ŻYWO" panel (GDD 4.0 §5.3 mockup) — a pure CSS/SVG vector
   *  preview of the *pending* loadout (see renderCosmeticGrid's doc),
   *  falling back to the saved one before Warsztat has been opened yet
   *  (e.g. right after boot, before pendingLoadout exists). */
  updateWarsztatPreview() {
    const pending = this.pendingLoadout || {
      skin: this.save.selected, aura: this.save.auras.selected,
      effect: this.save.effects.selected, overdriveSkin: this.save.overdriveSkins.selected
    };
    const skin = SKINS.find(s => s.id === pending.skin) || SKINS[0];
    const aura = AURAS.find(a => a.id === pending.aura);
    const effect = EAT_EFFECTS.find(e => e.id === pending.effect);
    const overdrive = OVERDRIVE_SKINS.find(o => o.id === pending.overdriveSkin);

    // The preview canvas itself is redrawn every frame from pendingLoadout
    // by renderWarsztatCanvases(); this just refreshes the text labels.
    document.getElementById('warsztatPreviewName').textContent = skin.name;
    document.getElementById('warsztatPerkValue').textContent = skin.perkLabel || '—';
    document.getElementById('warsztatPerk').classList.toggle('none', !(skin.perks && skin.perks.length));
    document.getElementById('warsztatPreviewLoadout').textContent =
      `Smuga: ${(aura && aura.name) || 'Brak'} · Efekt: ${(effect && effect.name) || 'Klasyczny'} · Finisz: ${(overdrive && overdrive.name) || 'Klasyczny'}`;
  }

  /** Keeps the Warsztat hole canvases animated while the screen is open
   *  (stops itself once shopScreen is hidden). */
  startWarsztatAnim() { this.startScreenAnim(); }

  /** One RAF loop for every animated canvas outside the game board
   *  (Miasto's city, Dzielnice tiles, Warsztat previews, the daily map,
   *  evolution card demos); it stops by itself once none is visible. */
  startScreenAnim() {
    if (this.screenAnimRaf) return;
    const visible = id => !document.getElementById(id).classList.contains('hidden');
    const tick = (now) => {
      const t = now / 1000;
      let any = false;
      if (visible('mainMenu')) {
        if (this.isFirstRun()) drawWelcomeScene(document.getElementById('hubWelcomeScene'), t);
        else this.renderHubCity(t);
        any = true;
      }
      if (visible('campaignScreen')) { this.renderDistrictTiles(t); any = true; }
      if (visible('shopScreen')) { this.renderWarsztatCanvases(t); any = true; }
      if (visible('challengesScreen')) { this.renderDailyMap(t); any = true; }
      if (visible('evolutionOverlay')) { this.renderPowerDemos(t); any = true; }
      this.screenAnimRaf = any ? requestAnimationFrame(tick) : null;
    };
    this.screenAnimRaf = requestAnimationFrame(tick);
  }

  /** 0..1 share of the Core City skyline standing: one sixth per level
   *  (LVL6 = complete), the current level's charge building the next part. */
  hubCityTargetProgress() {
    const level = this.save.hub.coreLevel || 1;
    return clamp(((level - 1) + (this.save.hub.coreCharge || 0) / 100) / 5, 0, 1);
  }

  /** The city animates up to its real progress -- coming back to Miasto
   *  after a round, the new buildings rise in front of you. */
  renderHubCity(t) {
    const target = this.hubCityTargetProgress();
    if (this.hubCityShown == null || target < this.hubCityShown) this.hubCityShown = target;
    const dt = this.hubCityLastT ? Math.min(0.05, t - this.hubCityLastT) : 0;
    this.hubCityLastT = t;
    // Ease toward the target (~1.5 s for any jump), never overshooting.
    if (this.hubCityShown < target) this.hubCityShown = Math.min(target, this.hubCityShown + Math.max(dt * 0.03, (target - this.hubCityShown) * dt * 2.2));
    drawCityScene(document.getElementById('hubCityCanvas'), this.hubCityShown, t);
  }

  renderDistrictTiles(t) {
    document.querySelectorAll('#districtMap canvas.district-tile-canvas').forEach(cv => {
      const d = DISTRICTS.find(x => x.id === cv.dataset.district);
      const done = d.missions.filter(id => this.save.campaign.completed[id]).length;
      drawDistrictTile(cv, d, done, d.missions.length, this.save.campaign.unlockedDistricts.includes(d.id), t);
    });
  }

  renderDailyMap(t) {
    if (this.dailyLayout) drawDailyMapPreview(document.getElementById('dailyMapCanvas'), this.dailyLayout, t);
  }

  renderPowerDemos(t) {
    document.querySelectorAll('#evolutionCards canvas.evolution-demo').forEach(cv => drawPowerDemo(cv, cv.dataset.power, cv.dataset.color, t));
  }

  /** Replays the Daily Seed Challenge's seeded setup (modifier roll, then
   *  createObjects(), then the player's spawn -- the same rng order as
   *  startRound()/createEntities()) without starting a round, for the
   *  Wyzwania tab's map preview. */
  computeDailyLayout() {
    const { seed, dateKey } = dailySeedForDate(new Date());
    const saved = { rng: this.rng, objects: this.objects, modifier: this.modifier };
    this.rng = new SeededRNG(seed);
    const modifier = this.pickModifier();
    this.createObjects(this.rng);
    const spawns = this.rollSpawns(this.rng);
    this.layStarterFeasts(this.rng, [spawns.player, ...spawns.bots]);
    const spawn = spawns.player;
    const layout = { dateKey, modifier, spawn, objects: this.objects.map(o => ({ tier: o.tier, x: o.x, y: o.y })) };
    Object.assign(this, saved);
    return layout;
  }

  renderWarsztatCanvases(time) {
    const p = this.pendingLoadout || { skin: this.save.selected, aura: this.save.auras.selected, effect: this.save.effects.selected };
    const effect = EAT_EFFECTS.find(e => e.id === p.effect);
    const effectColor = (effect && effect.color) || TIERS.fragment.color;
    const skin = SKINS.find(sk => sk.id === p.skin);
    const glowColor = (skin && skin.color) || '#9875FF';
    this.drawHoleThumb(document.getElementById('warsztatPreviewCanvas'), p.skin, p.aura, time,
      (ctx, R) => this.drawPreviewEat(ctx, R, time, effectColor),
      (ctx, w, h) => this.drawWarsztatStage(ctx, w, h, glowColor, time), 0.62);
    document.querySelectorAll('#shopScreen canvas.hole-swatch').forEach(cv => {
      if (!cv.offsetParent) return; // inactive tab
      this.drawHoleThumb(cv, cv.dataset.skin || p.skin, cv.dataset.aura || 'none', time);
    });
  }

  /** Draws a nameless Hole into a small canvas with the exact in-round
   *  Hole.draw() at a standard radius, scaled to fit -- so ring thickness,
   *  vortex and trail proportions match the board 1:1. */
  drawHoleThumb(canvas, skinId, auraId, time, extras, background, zoom = 1) {
    const c = prepCanvas(canvas);
    if (!c) return;
    const { ctx, w, h } = c;
    if (background) background(ctx, w, h);
    const R = 30, extent = R + 15; // aura ring sits at R + 8..11 with a 6 px stroke
    const k = Math.min(w, h) / (2 * extent) * zoom;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(k, k);
    const hole = canvas._hole || (canvas._hole = new Hole('', 0, 0, true));
    hole.skin = skinId;
    hole.auraId = auraId;
    hole.radius = R;
    hole.draw(ctx, time);
    if (extras) extras(ctx, R, hole);
    ctx.restore();
  }

  /** Warsztat hero backdrop: a glowing showroom floor in the skin's color
   *  with a perspective grid and a slowly turning platform ring. */
  drawWarsztatStage(ctx, w, h, color, t) {
    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.6);
    glow.addColorStop(0, rgbaColor(color, 0.28)); glow.addColorStop(1, 'rgba(4,16,29,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    const horizon = h * 0.55;
    ctx.strokeStyle = rgbaColor(color, 0.16); ctx.lineWidth = 1;
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo(w / 2 + i * 8, horizon); ctx.lineTo(w / 2 + i * w * 0.18, h); ctx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const y = horizon + (h - horizon) * Math.pow((i + ((t * 0.4) % 1)) / 5, 1.8);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.save();
    ctx.translate(w / 2, h / 2 + Math.min(w, h) * 0.32);
    ctx.scale(1, 0.28);
    ctx.strokeStyle = rgbaColor(color, 0.55); ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 30;
    ctx.beginPath(); ctx.arc(0, 0, Math.min(w, h) * 0.42, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  /** Preview loop: a fragment drifts into the hole every 1.8 s and bursts
   *  in the selected Efekt pochłaniania color. */
  drawPreviewEat(ctx, R, time, color) {
    const t = (time % 1.8) / 1.8;
    if (t < 0.5) {
      const f = t / 0.5, ease = f * f;
      ctx.save();
      ctx.translate(lerp(R + 12, 0, ease), lerp(-R - 4, 0, ease));
      ctx.scale(1 - ease * 0.8, 1 - ease * 0.8);
      drawObjectArt(ctx, 'fragment', TIERS.fragment.color, 7, time, 0, { live: false });
      ctx.restore();
    } else if (t < 0.85) {
      const f = (t - 0.5) / 0.35;
      ctx.save();
      ctx.fillStyle = color;
      ctx.shadowBlur = 8; ctx.shadowColor = color;
      ctx.globalAlpha = 1 - f;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.3;
        const d = R * 0.2 + f * R * 0.85;
        ctx.fillRect(Math.cos(a) * d - 2, Math.sin(a) * d - 2, 4, 4);
      }
      ctx.restore();
    }
  }

  /** Phase 7 casual run tools — Coins-only, consumed at round start, no
   *  ranked/daily equivalent exists yet to keep those modes fair. */
  populateRunToolGrid() {
    const t = this.computeDifficultyT();
    const threat = document.getElementById('runThreat');
    const level = Math.min(3, Math.floor(t * 4));
    threat.dataset.level = level;
    threat.querySelectorAll('.threat-segments i').forEach((seg, i) => seg.classList.toggle('on', i <= level));
    document.getElementById('runThreatValue').textContent = this.difficultyLabel(t);
    const equippedSkin = SKINS.find(sk => sk.id === this.save.selected) || SKINS[0];
    document.getElementById('runPerkName').textContent = equippedSkin.name;
    document.getElementById('runPerkValue').textContent = equippedSkin.perkLabel || '—';
    const grid = document.getElementById('runToolGrid');
    grid.innerHTML = '';
    RUN_TOOLS.forEach(tool => {
      const afford = tool.price === 0 || this.save.coins >= tool.price;
      const btn = document.createElement('button');
      btn.className = 'run-tool-card' + (this.selectedRunTool === tool.id ? ' selected' : '');
      btn.style.opacity = afford ? '1' : '0.5';
      const hot = tool.hot && t >= 0.25 ? '<span class="run-tool-hot">POLECANE</span>' : '';
      btn.innerHTML = `<span><span class="run-tool-name">${tool.name}</span>${hot}<br><span class="run-tool-desc">${tool.desc}</span></span><span class="run-tool-price">${tool.price > 0 ? '◇ ' + tool.price : 'GRATIS'}</span>`;
      btn.addEventListener('click', () => {
        if (!afford) return;
        this.selectedRunTool = tool.id;
        this.populateRunToolGrid();
      });
      grid.appendChild(btn);
    });
  }

  confirmRunSetup() {
    this.requireEnergy('arena', () => {
      const tool = RUN_TOOLS.find(t => t.id === this.selectedRunTool);
      if (tool && tool.price > 0) {
        this.save.coins -= tool.price;
        saveGame(this.save);
        this.updateCoinDisplays();
      }
      this.startRound();
    });
  }

  openProfileScreen() {
    document.getElementById('displayNameInput').value = this.save.displayName || '';
    document.getElementById('guestIdLabel').textContent = this.save.guestId;
    this.syncControlsPanel();
    this.syncPrivacyPanel();
    this.updateSoundStatus();
    this.showScreen('profileScreen');
  }

  /** v13.3: sound diagnostics in the profile (status line + test chime). */
  updateSoundStatus(extra) {
    const el = document.getElementById('soundStatus');
    if (!el) return;
    el.textContent = this.sound.statusText() + (extra ? ' — ' + extra : '');
  }

  playSoundTest() {
    this.sound.unlock();
    setTimeout(() => {
      this.sound.testChime();
      this.updateSoundStatus(SoundEngine.isIOS() ? 'nic nie słychać? Podgłośnij telefon przyciskami z boku.' : '');
    }, 80);
  }

  saveProfile() {
    const raw = document.getElementById('displayNameInput').value.trim();
    this.save.displayName = moderateName(raw) || null;
    saveGame(this.save);
    this.analytics.track('profile_created', { guest: !this.save.displayName });
    this.showScreen('mainMenu');
  }

  /** Full local wipe (coins/prisms, cosmetics, campaign/hub/daily progress,
   *  stats) back to a brand-new guest profile -- confirmed via
   *  #resetProfileConfirm first, since this can't be undone. Reloads
   *  rather than resetting `this.save` in place, so every piece of runtime
   *  state (active screens, cached campaign progress, etc.) re-initializes
   *  from the fresh save exactly like a real first launch would. */
  resetProfile() {
    this.analytics.track('profile_reset', {});
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }

  startDailyChallenge() {
    const { seed, dateKey } = dailySeedForDate(new Date());
    this.requireEnergy('daily', () => {
      this.analytics.track('daily_challenge_start', { dateKey, seed });
      this.startRound({ seed, daily: true });
    });
  }

  /* ---- Golden Shot v11: retention metrics, consent, privacy ---- */

  /** Local D1/D7 bookkeeping: install day, distinct active days, session
   *  count. Fires `retention_day` once per active day with the day index
   *  since install (0 = install day, 1 = D1 return, 7 = D7 ...), which is
   *  exactly what a D1/D7 retention dashboard needs from the event stream. */
  trackRetention() {
    const R = this.save.retention;
    const today = dailySeedForDate(new Date()).dateKey;
    if (!R.installDate) R.installDate = today;
    R.sessions = (R.sessions || 0) + 1;
    const dayIndex = Math.max(0, Math.round((Date.parse(today) - Date.parse(R.installDate)) / 86400000));
    if (!R.activeDays.includes(today)) {
      R.activeDays.push(today);
      if (R.activeDays.length > 60) R.activeDays.splice(0, R.activeDays.length - 60);
      this.analytics.track('retention_day', { dayIndex, activeDays: R.activeDays.length, d1: dayIndex === 1, d7: dayIndex === 7 });
    }
    saveGame(this.save);
    this.retention = { dayIndex, activeDays: R.activeDays.length, sessions: R.sessions };
  }

  /** Non-blocking consent bar (never a wall in front of the first round):
   *  saving progress locally is strictly necessary and needs no consent;
   *  anonymous statistics are opt-in and stay off until accepted. */
  renderConsentBar() {
    const bar = document.getElementById('consentBar');
    // v13: not on the first-run welcome card (it covered ZACZNIJ GRĘ on 360 px
    // phones). Nothing is sent before a decision, so asking after the
    // tutorial changes nothing legally.
    // v14: only over the nav tabs -- on a result screen it covered the main
    // button ("GRAJ M01" right after the tutorial).
    const onNavScreen = !document.getElementById('bottomNav').classList.contains('hidden');
    if (bar) bar.classList.toggle('hidden', !!this.save.privacy.decided || this.running || this.isFirstRun() || !onNavScreen);
  }

  setConsent(analytics) {
    this.save.privacy = { decided: true, analytics: !!analytics, ads: !!analytics, ts: Date.now() };
    saveGame(this.save);
    this.renderConsentBar();
    this.syncPrivacyPanel();
    this.analytics.track('consent_set', { analytics: !!analytics });
  }

  syncPrivacyPanel() {
    const on = !!this.save.privacy.analytics;
    document.querySelectorAll('[data-consent]').forEach(btn => btn.classList.toggle('active', (btn.dataset.consent === '1') === on));
    const st = document.getElementById('profileStats');
    if (st && this.retention) {
      st.textContent = `Dni w grze: ${this.retention.activeDays} · sesje: ${this.retention.sessions} · rundy: ${this.save.stats.runsPlayed || 0} · misje: ${Object.keys(this.save.campaign.completed).length}`;
    }
  }

  openPrivacyPolicy() {
    const L = CONFIG.legal;
    this.openInfoSheet({
      title: 'Prywatność',
      body: [
        `<strong>Administrator:</strong> ${escapeHtml(L.publisher)}${L.contact ? ` · kontakt: ${escapeHtml(L.contact)}` : ''}.`,
        '<strong>Co zapisujemy:</strong> postęp gry, ustawienia i losowy identyfikator gościa — wyłącznie w pamięci Twojej przeglądarki (localStorage) na tym urządzeniu. Nie zakładasz konta, nie podajesz e-maila. Nazwa gracza jest opcjonalna.',
        '<strong>Co wysyłamy:</strong> sama gra nie ma serwera i niczego nie wysyła. Anonimowe statystyki rozgrywki są przekazywane do narzędzia analitycznego strony/aplikacji <em>tylko po Twojej zgodzie</em>; zgodę możesz w każdej chwili wycofać tutaj.',
        '<strong>Reklamy i zakupy:</strong> na portalach z grami i w aplikacji reklamy wyświetla partner (np. portal lub sklep z aplikacjami) na swoich zasadach i ze swoją zgodą na cookies. Reklamy z nagrodą oglądasz zawsze dobrowolnie. Gra nie sprzedaje losowych nagród za prawdziwe pieniądze.',
        '<strong>Czcionki:</strong> wbudowane w grę — bez pobierania z Google.',
        '<strong>Twoje prawa (RODO):</strong> dostęp i przeniesienie danych — przycisk „Pobierz moje dane”; usunięcie — „Resetuj profil” (kasuje wszystko z tego urządzenia). Masz też prawo skargi do Prezesa UODO.'
      ]
    });
  }

  /** GDPR art. 15/20: everything the game stores, as a JSON download. */
  exportMyData() {
    const blob = new Blob([JSON.stringify(this.save, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vector-hole-moje-dane.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    this.analytics.track('data_export', {});
  }

  /* ---- Golden Shot v11: viral loop (share card + friend challenges) ---- */

  /** Reads ?c=… on boot, stores a valid sealed challenge in the save and
   *  strips it from the address bar (so a reload doesn't re-import it). */
  captureChallengeLink(portalSearch) {
    const params = new URLSearchParams(location.search);
    if (!portalSearch && !params.has('c')) return;
    const ch = decodeChallenge(portalSearch || location.search);
    if (!portalSearch) {
      params.delete('c'); params.delete('n');
      try { history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash); } catch (e) { /* sandboxed iframe */ }
    }
    if (!ch) { this.analytics.track('challenge_invalid', {}); return; }
    this.save.challenge = { seed: ch.seed, score: ch.score, from: ch.from, receivedAt: Date.now() };
    saveGame(this.save);
    this.analytics.track('challenge_open', { score: ch.score });
    if (!this.running) this.renderHubChallenge();
  }

  /** Hub card for a pending friend challenge (or a note on the first-run
   *  welcome card: the tutorial comes first, then the challenge). */
  renderHubChallenge() {
    const ch = this.save.challenge;
    const card = document.getElementById('hubChallenge');
    const note = document.getElementById('welcomeChallengeNote');
    if (!card) return;
    const valid = ch && typeof ch.seed === 'number' && typeof ch.score === 'number';
    card.classList.toggle('hidden', !valid || this.isFirstRun());
    note.classList.toggle('hidden', !valid || !this.isFirstRun());
    if (!valid) return;
    document.getElementById('hubChallengeFrom').textContent = ch.from || 'Znajomy';
    document.getElementById('hubChallengeScore').textContent = formatNum(ch.score);
    note.textContent = `${ch.from || 'Znajomy'} rzuca Ci wyzwanie: ${ch.score} pkt! Ukończ krótki samouczek, a potem je przyjmij.`;
  }

  acceptChallenge() {
    const ch = this.save.challenge;
    if (!ch || !this.isArenaUnlocked()) return;
    this.requireEnergy('arena', () => {
      this.analytics.track('challenge_accept', { score: ch.score });
      this.startRound({ seed: ch.seed, challenge: { score: ch.score, from: ch.from || 'Znajomy' } });
    });
  }

  dismissChallenge() {
    this.save.challenge = null;
    saveGame(this.save);
    this.renderHubChallenge();
  }

  /** In-round: the friend's score as a live target under the combo box. */
  updateChallenge() {
    const ch = this.challenge;
    if (!ch || this.challengeBeaten || this.player.score <= ch.score) return;
    this.challengeBeaten = true;
    this.showBanner('WYZWANIE WYGRANE!', `Cel ${formatNum(ch.score)} pkt (${ch.from}) przebity!`, '#46D99A', 1.5, 4);
    this.flashScreen('#46D99A', 0.22);
    this.sound.fanfare(true);
    this.vibrate([40, 30, 80]);
  }

  drawChallengeTarget(ctx) {
    const ch = this.challenge;
    if (!ch) return;
    const x = 8, y = 128, w = 158, h = 40;
    const frac = clamp(this.player.score / ch.score, 0, 1);
    const color = this.challengeBeaten ? '#46D99A' : '#EFCB63';
    ctx.save();
    ctx.fillStyle = 'rgba(4, 16, 29, 0.62)';
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `800 10px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(242, 248, 255, 0.7)';
    ctx.fillText(`WYZWANIE · ${String(ch.from).toUpperCase().slice(0, 12)}`, x + 8, y + 14);
    ctx.font = `15px ${FONT_DISPLAY}`;
    ctx.fillStyle = color;
    ctx.fillText(this.challengeBeaten ? 'POBITE ✓' : `${this.player.score} / ${ch.score}`, x + 8, y + 30);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x + 8, y + 34, w - 16, 3);
    ctx.fillStyle = color;
    ctx.fillRect(x + 8, y + 34, (w - 16) * frac, 3);
    ctx.restore();
  }

  /** 1080x1350 PNG "score card" for social sharing, drawn with the same
   *  vector art as the game (the player's real hole via Hole.draw()). */
  buildShareCanvas(info) {
    const W = 1080, H = 1350;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#081C2B'); bg.addColorStop(1, '#04101D');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(80, 240, 250, 0.08)';
    for (let gx = 30; gx < W; gx += 60) for (let gy = 30; gy < H; gy += 60) c.fillRect(gx, gy, 3, 3);
    const glow = c.createRadialGradient(W / 2, 560, 40, W / 2, 560, 520);
    glow.addColorStop(0, 'rgba(152, 117, 255, 0.35)'); glow.addColorStop(1, 'rgba(152, 117, 255, 0)');
    c.fillStyle = glow; c.fillRect(0, 0, W, H);
    // Orbiting city objects being pulled into the hole.
    const kinds = ['fragment', 'kapsula', 'latarnia', 'samochod', 'pawilon', 'autobus'];
    const colors = ['#50F0FA', '#50F0FA', '#FF54AD', '#EFCB63', '#9875FF', '#CBD5E1'];
    kinds.forEach((k, i) => {
      const a = i / kinds.length * Math.PI * 2 + 0.4, rr = 330 + (i % 2) * 60;
      c.save(); c.translate(W / 2 + Math.cos(a) * rr, 560 + Math.sin(a) * rr * 0.75); c.rotate(a);
      try { drawObjectArt(c, k, colors[i], 26 + i * 6, 0, i); } catch (e) { /* art kind missing */ }
      c.restore();
    });
    const hole = new Hole('', 0, 0, true);
    hole.skin = this.save.selected; hole.auraId = this.save.auras.selected; hole.radius = 190;
    c.save(); c.translate(W / 2, 560); hole.draw(c, 1.3); c.restore();
    c.textAlign = 'center';
    c.fillStyle = '#50F0FA'; c.font = `44px ${FONT_DISPLAY}`;
    c.fillText('VECTOR HOLE', W / 2, 120);
    c.fillStyle = 'rgba(230, 250, 255, 0.6)'; c.font = `600 28px ${FONT_UI}`;
    c.fillText(info.headline, W / 2, 170);
    c.shadowColor = '#EFCB63'; c.shadowBlur = 40;
    c.fillStyle = '#EFCB63'; c.font = `150px ${FONT_DISPLAY}`;
    c.fillText(String(info.score), W / 2, 1000);
    c.shadowBlur = 0;
    c.fillStyle = '#e6faff'; c.font = `600 34px ${FONT_UI}`;
    c.fillText(info.sub, W / 2, 1060);
    c.fillStyle = '#FF54AD'; c.font = `52px ${FONT_DISPLAY}`;
    c.fillText('POBIJ MÓJ WYNIK!', W / 2, 1180);
    c.fillStyle = 'rgba(230, 250, 255, 0.55)'; c.font = `600 26px ${FONT_UI}`;
    c.fillText('Ta sama mapa · link w wiadomości', W / 2, 1230);
    return cv;
  }

  /** Share = a friend challenge: the link replays this exact map (seed)
   *  with this score as the target. Web Share with the PNG card where the
   *  platform supports files, then text+link, then clipboard, then a plain
   *  download of the card -- never assumes any one of them exists. */
  async shareResult() {
    const place = this.lastResultPlace || 1;
    const score = this.player ? this.player.score : 0;
    const tier = this.player ? CONFIG.sizeTiers[getSizeTierIndex(this.player.radius)].shortId : 'T1';
    const url = await this.monetization.shareUrl(this.runSeed, score, this.save.displayName || '');
    const text = `Vector Hole: ${formatNum(score)} pkt, ${place}. miejsce. Ta sama mapa czeka — dasz radę więcej?`;
    this.analytics.track('share_click', { score, place });
    const btn = document.getElementById('btnShare');
    const label = btn.innerHTML;
    const done = (msg) => { btn.textContent = msg; setTimeout(() => { btn.innerHTML = label; }, 2200); };
    let file = null;
    try {
      const cv = this.buildShareCanvas({ score, headline: place === 1 ? 'ZWYCIĘSTWO W NEONOWYM MIEŚCIE' : 'MÓJ WYNIK W NEONOWYM MIEŚCIE', sub: `${place}. miejsce · ${tier} · ${this.isDailyRun ? 'Wyzwanie dnia' : 'Runda 2:00'}` });
      const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', 0.9));
      if (blob) file = new File([blob], 'vector-hole-wynik.jpg', { type: 'image/jpeg' });
    } catch (e) { file = null; }
    try {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Vector Hole', text: `${text} ${url}` });
        this.analytics.track('share_success', { via: 'files' });
      } else if (navigator.share) {
        await navigator.share({ title: 'Vector Hole', text, url });
        this.analytics.track('share_success', { via: 'link' });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(`${text} ${url}`);
        this.analytics.track('share_success', { via: 'clipboard' });
        done('LINK SKOPIOWANY ✓');
      } else if (file) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file); a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        this.analytics.track('share_success', { via: 'download' });
        done('KARTA ZAPISANA ✓');
      }
    } catch (e) {
      if (e && e.name !== 'AbortError') this.analytics.track('share_fail', { error: String(e) });
    }
  }

  updateCoinDisplays() {
    // Golden Shot v8: currency pills "pop" whenever the balance grows.
    const total = this.save.coins + (this.save.prisms || 0) * 1000;
    if (this._lastWalletShown !== undefined && total > this._lastWalletShown) {
      document.querySelectorAll('.coin-display').forEach(el => {
        el.classList.remove('coin-pop');
        void el.offsetWidth;
        el.classList.add('coin-pop');
      });
    }
    this._lastWalletShown = total;
    this.updatePlayerLevelRow();
    this.updateFreeChestRow();
    document.getElementById('coinCountMenu').textContent = this.save.coins;
    document.getElementById('coinCountShop').textContent = this.save.coins;
    document.getElementById('coinCountDistricts').textContent = this.save.coins;
    document.getElementById('coinCountChallenges').textContent = this.save.coins;
    document.getElementById('prismCountMenu').textContent = this.save.prisms || 0;
    document.getElementById('prismCountShop').textContent = this.save.prisms || 0;
    document.getElementById('prismCountDistricts').textContent = this.save.prisms || 0;
    document.getElementById('prismCountChallenges').textContent = this.save.prisms || 0;

    // GDD 4.0 §8.3 Miasto/Core City copy: level + percent toward the next
    // reward over the living city canvas (renderHubCity()), plus a bar.
    const level = this.save.hub.coreLevel || 1;
    const pct = this.save.hub.coreCharge || 0;
    document.getElementById('hubChargeValue').textContent = Math.round(pct) + '%';
    document.getElementById('hubLevelLabel').textContent = `LVL ${level}`;
    document.getElementById('hubCityBar').style.width = pct + '%';
    const nextReward = CORE_CITY_LEVEL_REWARDS[level + 1];
    const nextRewardLabel = nextReward ? nextReward.label : 'Premia';
    const nextRewardCoins = nextReward ? nextReward.coins : CONFIG.hub.milestoneFallbackCoins;
    document.getElementById('hubRewardChip1').textContent = nextReward ? `${nextRewardLabel} + ${nextRewardCoins} monet` : `+${nextRewardCoins} monet`;
    document.getElementById('hubRewardChip1Icon').innerHTML = REWARD_CATEGORY_ICONS[this.coreCityRewardCategory(nextReward)];

    const arenaUnlocked = this.isArenaUnlocked();
    document.getElementById('btnStart').disabled = !arenaUnlocked;
    document.getElementById('btnStart').classList.toggle('is-new', arenaUnlocked && this.isUnlockFresh('arena'));
    this.updateHubQuickTiles();
    // First-run welcome: until M00 clears, Miasto shows only a short pitch
    // and the ZAGRAJ TUTORIAL button (#hubWelcome) -- the Core City card,
    // currencies, CTA row, info panel and bottom nav (renderBottomNav())
    // are all hidden via .first-run so a brand-new player has exactly one
    // obvious thing to tap (player feedback).
    document.getElementById('mainMenu').classList.toggle('first-run', this.isFirstRun());
    document.getElementById('hubWelcome').classList.toggle('hidden', !this.isFirstRun());

    const { dateKey } = dailySeedForDate(new Date());
    const { mission } = missionForDate(new Date());
    const missionDoneToday = this.save.mission.dateKey === dateKey && this.save.mission.completed;
    document.getElementById('hubMissionText').textContent = missionDoneToday
      ? `${mission.name} — ukończona! Wróć jutro po nową. (+${mission.rewardCoins} monet odebrane)`
      : `${mission.name} · nagroda +${mission.rewardCoins} monet`;
    const missionStatus = document.getElementById('hubMissionStatus');
    missionStatus.textContent = missionDoneToday ? '✓ UKOŃCZONA' : 'DO ZROBIENIA';
    missionStatus.classList.toggle('done', missionDoneToday);
    const streak = this.save.daily.streak || 0;
    const streakWrap = document.getElementById('streakDays');
    streakWrap.innerHTML = '';
    for (let i = 0; i < 7; i++) {
      const d = document.createElement('span');
      d.className = 'streak-day' + (i < Math.min(streak, 7) ? ' lit' : '') + (i === Math.min(streak, 7) ? ' next' : '');
      d.textContent = i < Math.min(streak, 7) ? '✓' : String(i + 1);
      streakWrap.appendChild(d);
    }
    document.getElementById('dailyDateLabel').textContent =
      new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', timeZone: 'UTC' }).toUpperCase();

    const goalText = document.getElementById('dailyGoalText');
    if (this.save.daily.lastSeedDate === dateKey) {
      goalText.textContent = `Twój rekord dziś: ${formatNum(this.save.daily.lastSeedScore)} pkt. Pobij go: +${CONFIG.daily.newRecordBonusCoins} monet i +${CONFIG.daily.newRecordBonusPrisms} ◆.`;
    } else {
      goalText.textContent = `Jedna mapa dla wszystkich graczy. Za ukończenie: +${CONFIG.daily.completionBonusCoins} monet.`;
    }
    document.getElementById('dailyStreakValue').textContent = this.save.daily.streak || 0;
    document.getElementById('dailyRewardFirst').textContent = `+${CONFIG.hub.coreCity.dailyFirstClearGain}% Core City`;
    document.getElementById('dailyRewardBest').textContent = `+${CONFIG.hub.coreCity.dailyNewBestGain}% Core City`;
  }

  /** Which REWARD_CATEGORY_ICONS entry matches a CORE_CITY_LEVEL_REWARDS
   *  row -- LVL6's "Zestaw" grants all four at once (bundle), LVL7+'s
   *  fallback has no def at all (bonus). */
  coreCityRewardCategory(rewardDef) {
    if (!rewardDef) return 'bonus';
    const categoryCount = ['skinId', 'auraId', 'effectId', 'overdriveSkinId'].filter(k => rewardDef[k]).length;
    if (categoryCount > 1) return 'bundle';
    if (rewardDef.skinId) return 'skin';
    if (rewardDef.auraId) return 'aura';
    if (rewardDef.effectId) return 'effect';
    if (rewardDef.overdriveSkinId) return 'overdrive';
    return 'bonus';
  }

  /** v14 hub shortcuts under GRAJ: the next campaign mission (one tap to
   *  its briefing) and the Daily challenge (today's state / streak). */
  updateHubQuickTiles() {
    const nextId = this.nextCampaignMissionId();
    const next = nextId && campaignMissionById(nextId);
    const district = next && DISTRICTS.find(d => d.id === next.district);
    // v15: the district's name heads the tile (owner: a district without a name).
    document.getElementById('hubCampaignEyebrow').textContent = next ? district.name.toUpperCase() : 'KAMPANIA';
    document.getElementById('hubCampaignTile').style.setProperty('--q', next ? (DISTRICT_COLORS[district.id] || '#46D99A') : '#46D99A');
    document.getElementById('hubCampaignTitle').textContent = next ? `${missionCode(next)} · ${next.name}` : 'Ukończona!';
    document.getElementById('hubCampaignSub').textContent = next ? this.missionStepRows(next)[0].label : `Zbieraj gwiazdki: ★ ${this.totalStars()}`;
    const daily = document.getElementById('btnDaily');
    const wyzwania = this.isWyzwaniaUnlocked();
    daily.classList.toggle('locked', !wyzwania);
    const { dateKey } = dailySeedForDate(new Date());
    const playedToday = this.save.daily.lastSeedDate === dateKey;
    const streak = this.save.daily.streak || 0;
    document.getElementById('hubDailyTitle').textContent = !wyzwania ? 'Wkrótce' : (playedToday ? `Rekord dnia: ${formatNum(this.save.daily.lastSeedScore || 0)}` : 'Nowa mapa dziś');
    document.getElementById('hubDailySub').textContent = !wyzwania
      ? 'Odblokujesz po misji M03'
      : (streak > 0 ? `Seria: ${streak} ${plural(streak, ['dzień', 'dni', 'dni'])} z rzędu` : `+${CONFIG.daily.completionBonusCoins} monet za ukończenie`);
  }

  /** The campaign mission to do next: the first uncleared mission (whose
   *  predecessor is cleared) in the earliest unlocked district, or null
   *  once every unlocked mission is done. */
  nextCampaignMissionId() {
    const c = this.save.campaign;
    for (const d of DISTRICTS) {
      if (!c.unlockedDistricts.includes(d.id)) continue;
      const id = d.missions.find((m, i) => !this.isMissionDone(m) && (i === 0 || this.isMissionDone(d.missions[i - 1])));
      if (id) return id;
    }
    return null;
  }

  /** Cleared -- M00 also counts as cleared on saves from before the
   *  tutorial existed (M01 done; FEATURE_GATES.arena accepts those too). */
  isMissionDone(id) {
    const c = this.save.campaign.completed;
    return !!(c[id] || (id === 'M00' && c.M01));
  }

  /** True when a mission can be started: its district is open and the
   *  mission before it (in that district) is cleared. */
  isMissionPlayable(id) {
    const def = campaignMissionById(id);
    const d = def && DISTRICTS.find(x => x.id === def.district);
    if (!d || !this.save.campaign.unlockedDistricts.includes(d.id)) return false;
    const i = d.missions.indexOf(id);
    return i === 0 || this.isMissionDone(d.missions[i - 1]);
  }

  /** True until the M00 tutorial clears -- Miasto then collapses to the
   *  single-CTA welcome card and the bottom nav stays hidden. */
  isFirstRun() { return !this.isArenaUnlocked(); }

  /* ---------- Unlock celebrations ---------- */

  /** `prefix` may be a full id ('warsztat') or a prefix ending in ':'
   *  ('district:' = any newly unlocked district). */
  isUnlockFresh(prefix) {
    const fresh = (this.save.unlocks && this.save.unlocks.fresh) || [];
    return prefix.endsWith(':') ? fresh.some(id => id.startsWith(prefix)) : fresh.includes(prefix);
  }

  markUnlockVisited(id) {
    const u = this.save.unlocks;
    if (!u || !u.fresh.includes(id)) return;
    u.fresh = u.fresh.filter(f => f !== id);
    saveGame(this.save);
  }

  /** Cosmetic rewards (Core City levels, M24's final skin) aren't
   *  persisted features -- they're queued at grant time and shown with the
   *  next queueUnlockCelebrations() call (right after the result screen). */
  queueRewardCelebration(item) {
    (this.pendingRewardCelebrations = this.pendingRewardCelebrations || []).push({ ...item, kind: 'reward' });
  }

  /** Diffs FEATURE_UNLOCKS against save.unlocks.announced, marks anything
   *  new as announced + fresh (nav "NOWE" badge), and plays the queued
   *  "ODBLOKOWANO!" overlays -- features first, then cosmetic rewards --
   *  shortly after the result screen appears, so the result reads first. */
  queueUnlockCelebrations() {
    const u = this.save.unlocks;
    const newFeatures = FEATURE_UNLOCKS.filter(f => f.isUnlocked(this.save) && !u.announced.includes(f.id));
    newFeatures.forEach(f => {
      u.announced.push(f.id);
      if (!u.fresh.includes(f.id)) u.fresh.push(f.id);
    });
    if (newFeatures.length) saveGame(this.save);
    const items = [...newFeatures.map(f => ({ ...f, kind: 'feature' })), ...(this.pendingRewardCelebrations || [])];
    this.pendingRewardCelebrations = [];
    if (!items.length) return;
    this.unlockQueue = (this.unlockQueue || []).concat(items);
    this.unlockQueueTotal = this.unlockQueue.length;
    clearTimeout(this.unlockShowTimer);
    this.unlockShowTimer = setTimeout(() => this.showNextUnlock(), 650);
  }

  showNextUnlock() {
    const overlay = document.getElementById('unlockOverlay');
    const item = this.unlockQueue && this.unlockQueue.shift();
    if (!item) { overlay.classList.add('hidden'); return; }
    this.currentUnlock = item;
    this.sound.fanfare(true);
    overlay.style.setProperty('--unlock-color', item.color);
    document.getElementById('unlockIcon').innerHTML = item.icon;
    document.getElementById('unlockEyebrow').textContent = item.eyebrow;
    document.getElementById('unlockTitle').textContent = item.title;
    document.getElementById('unlockDesc').textContent = item.desc;
    document.querySelector('#unlockOverlay .unlock-kicker').textContent = item.kicker || 'ODBLOKOWANO!';
    const shown = this.unlockQueueTotal - this.unlockQueue.length;
    const counter = document.getElementById('unlockCounter');
    counter.textContent = `${shown} / ${this.unlockQueueTotal}`;
    counter.classList.toggle('hidden', this.unlockQueueTotal < 2);

    const goBtn = document.getElementById('btnUnlockGo');
    const cta = item.noCta ? null : (item.kind === 'reward' ? (this.isWarsztatUnlocked() ? 'ZAŁÓŻ W WARSZTACIE' : null) : item.cta);
    goBtn.classList.toggle('hidden', !cta);
    if (cta) goBtn.textContent = cta;
    document.getElementById('btnUnlockLater').textContent = this.unlockQueue.length ? 'DALEJ' : 'PÓŹNIEJ';

    // Fresh burst particles each time, at random angles/distances.
    const burst = document.getElementById('unlockBurst');
    burst.innerHTML = '';
    for (let i = 0; i < 18; i++) {
      const sp = document.createElement('span');
      sp.style.setProperty('--a', `${(i / 18) * 360 + rand(-8, 8)}deg`);
      sp.style.setProperty('--d', `${rand(90, 150)}px`);
      sp.style.setProperty('--s', `${rand(4, 8)}px`);
      sp.style.setProperty('--delay', `${0.55 + rand(0, 0.12)}s`);
      burst.appendChild(sp);
    }
    // Restart the CSS animation sequence (lock shake -> crack -> icon pop).
    overlay.classList.remove('hidden', 'play');
    void overlay.offsetWidth;
    overlay.classList.add('play');
    setTimeout(() => this.vibrate([30, 50, 90]), 550);
    this.analytics.track('unlock_celebration', { id: item.id || item.title, kind: item.kind });
  }

  onUnlockGo() {
    const item = this.currentUnlock;
    document.getElementById('unlockOverlay').classList.add('hidden');
    if (item) {
      this.updateCoinDisplays();
      this.state = GameState.MENU;
      if (item.kind === 'reward' || item.id === 'warsztat') this.openWarsztatScreen();
      else if (item.id === 'wyzwania') this.openChallengesScreen();
      // v13: the first round is one tap away -- the button starts it (QA:
      // five screens/pop-ups stood between the tutorial and the first round).
      else if (item.id === 'arena') {
        if (this.unlockQueue && this.unlockQueue.length) this.showScreen('mainMenu');
        else { this.startArenaRound(); return; }
      }
      else if (item.districtId) { this.openCampaignScreen(); this.selectCampaignDistrict(item.districtId); }
    }
    if (this.unlockQueue && this.unlockQueue.length) setTimeout(() => this.showNextUnlock(), 350);
  }

  /** Generic "what is this?" popup (#infoSheet). `body` is a list of
   *  paragraphs/HTML snippets (authored strings only, never user input);
   *  `action` optionally adds a primary button ({label, onClick}). */
  openInfoSheet({ icon = '', title, body = [], action = null, onClose = null, closeLabel = 'ROZUMIEM', bottom = false }) {
    this.closeInfoSheet();
    this.infoSheetOnClose = onClose;
    document.getElementById('btnInfoSheetClose').textContent = closeLabel;
    // v14: a bottom sheet over a light scrim (Warsztat purchases keep the
    // live preview visible above it).
    document.getElementById('infoSheet').classList.toggle('info-sheet-bottom', bottom);
    document.getElementById('infoSheetIcon').innerHTML = icon;
    document.getElementById('infoSheetIcon').classList.toggle('hidden', !icon);
    document.getElementById('infoSheetTitle').textContent = title;
    document.getElementById('infoSheetBody').innerHTML = body.map(p => /^<(ul|ol)\b/.test(p) ? p : `<p>${p}</p>`).join('');
    const actionBtn = document.getElementById('btnInfoSheetAction');
    actionBtn.classList.toggle('hidden', !action);
    this.infoSheetAction = action ? action.onClick : null;
    if (action) actionBtn.textContent = action.label;
    document.getElementById('infoSheet').classList.remove('hidden');
    this.analytics.track('info_sheet_open', { title });
  }

  closeInfoSheet() {
    document.getElementById('infoSheet').classList.add('hidden');
    this.infoSheetAction = null;
    const onClose = this.infoSheetOnClose;
    this.infoSheetOnClose = null;
    if (onClose) onClose();
  }

  openCurrencyInfo(isPrism) {
    if (isPrism) {
      this.openInfoSheet({
        icon: '◆',
        title: 'Pryzmaty',
        body: [
          `Rzadsza waluta premium. Masz teraz: <strong>${this.save.prisms || 0} ◆</strong>.`,
          '<ul class="info-sheet-list"><li>+1 za co 3. rozegraną rundę GRAJ 2:00</li>' +
            `<li>+${CONFIG.daily.newRecordBonusPrisms} za nowy rekord w Wyzwaniu dnia</li>` +
            '<li>Nagrody Core City od poziomu 7</li></ul>',
          'Wydajesz je w <strong>Warsztacie</strong> na rzadsze Smugi, na pełną energię i na dodatkowe sekundy w misji.'
        ]
      });
      return;
    }
    this.openInfoSheet({
      icon: '◇',
      title: 'Monety',
      body: [
        `Podstawowa waluta. Masz teraz: <strong>${this.save.coins} ◇</strong>.`,
        '<ul class="info-sheet-list"><li>Za każdą rundę GRAJ 2:00 i Wyzwanie dnia</li>' +
          '<li>Za pierwsze ukończenie misji w Dzielnicach</li>' +
          '<li>Za każdy nowy poziom Core City</li></ul>',
        'Wydajesz je w <strong>Warsztacie</strong> (wygląd dziury), na dodatki przed rundą i na wzmocnienia przed misją (Zegar, Turbo start, Magnes, Tarcza).'
      ]
    });
  }

  /** Plain-language "what does this cosmetic actually do" per
   *  REWARD_CATEGORY_ICONS key -- the reward chip only shows a name like
   *  „Impuls”, which means nothing to a new player. */
  rewardCategoryExplanation(category) {
    return {
      skin: '<strong>Wir</strong> to wygląd Twojej dziury — jej pierścień i spirala.',
      aura: '<strong>Smuga</strong> to świetlny ślad, który ciągnie się za Twoją dziurą podczas ruchu.',
      effect: '<strong>Efekt pochłaniania</strong> to błysk cząsteczek, gdy coś połykasz.',
      overdrive: '<strong>Finisz</strong> zmienia kolor banera w ostatnich sekundach rundy.',
      bundle: 'Komplet: nowy Wir, Smuga, Efekt pochłaniania i Finisz naraz, plus odznaka.',
      bonus: 'Premia w monetach i pryzmatach za kolejny poziom.'
    }[category];
  }

  coreCityHowToFillHtml() {
    const c = CONFIG.hub.coreCity;
    return '<ul class="info-sheet-list">' +
      `<li>Runda GRAJ 2:00: +${c.arenaCompleteGain}% (top 3: +${c.arenaTop3Gain}%, 1. miejsce: +${c.arenaFirstGain}%, rekord: +${c.arenaNewPbGain}%)</li>` +
      `<li>Wyzwanie dnia: +${c.dailyFirstClearGain}% za pierwsze dziś, +${c.dailyNewBestGain}% za nowy rekord</li>` +
      '</ul>';
  }

  /** Every authored Core City level reward in one list, with the
   *  current/done state -- what a tap on Miasto's city card opens. */
  openCoreCityRoadmap() {
    const level = this.save.hub.coreLevel || 1;
    const pct = this.save.hub.coreCharge || 0;
    const rows = Object.keys(CORE_CITY_LEVEL_REWARDS).map(Number).sort((a, b) => a - b).map(n => {
      const def = CORE_CITY_LEVEL_REWARDS[n];
      const state = n <= level ? 'done' : (n === level + 1 ? 'next' : '');
      const mark = n <= level ? '✓' : (n === level + 1 ? `${pct}%` : '');
      return `<li class="info-roadmap-row ${state}">` +
        `<span class="info-roadmap-icon">${REWARD_CATEGORY_ICONS[this.coreCityRewardCategory(def)]}</span>` +
        `<span class="info-roadmap-main"><span class="info-roadmap-level">LVL ${n}</span>${def.label} · +${def.coins} ◇</span>` +
        `<span class="info-roadmap-mark">${mark}</span></li>`;
    }).join('');
    this.openInfoSheet({
      icon: REWARD_CATEGORY_ICONS.bundle,
      title: 'Nagrody Core City',
      body: [
        `Core City to pasek postępu całego miasta. Każde 100% to nowy poziom i nagroda. Teraz: <strong>LVL ${level} · ${pct}%</strong>.`,
        `<ul class="info-roadmap">${rows}</ul>`,
        'Jak ładować:',
        this.coreCityHowToFillHtml(),
        'Misje kampanii (Dzielnice) nie ładują Core City — dają własne nagrody.'
      ]
    });
  }

  /** "Zablokowane — co to i jak odblokować" for a locked bottom-nav tab,
   *  instead of a dimmed button that silently ignores taps. */
  openLockedTabInfo(tab) {
    const missionLine = (id) => {
      const def = campaignMissionById(id);
      const district = DISTRICTS.find(d => d.id === def.district);
      return `Odblokujesz po ukończeniu misji <strong>${missionCode(def)} „${def.name}”</strong> (${district.name}).`;
    };
    const plac = DISTRICTS.find(d => d.id === 'plac');
    const done = plac.missions.filter(id => this.save.campaign.completed[id]).length;
    const progress = `Postęp na Placu Neonów: ${done} z ${plac.missions.length} misji.`;
    const goToDistricts = { label: 'IDŹ DO DZIELNIC', onClick: () => this.openCampaignScreen() };
    const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>';
    if (tab === 'warsztat') {
      this.openInfoSheet({
        icon: LOCK,
        title: 'Warsztat — zablokowany',
        body: [
          'Tu zmienisz wygląd swojej dziury: <strong>Wir</strong>, <strong>Smugę</strong>, <strong>Efekt pochłaniania</strong> i <strong>Finisz</strong>. Kupujesz je za monety i pryzmaty, a nagrody z Core City trafiają tu same.',
          missionLine('M02'), progress
        ],
        action: goToDistricts
      });
    } else {
      this.openInfoSheet({
        icon: LOCK,
        title: 'Wyzwania — zablokowane',
        body: [
          'Codzienne zadania: <strong>Misja dnia</strong> z nagrodą w monetach i <strong>Wyzwanie dnia</strong> — ta sama mapa dla wszystkich, walka o rekord i serię dni z rzędu.',
          missionLine('M03'), progress
        ],
        action: goToDistricts
      });
    }
  }

  /** GDD 4.0 §5.4 Wyzwania tab: Daily rotating mission + Daily Seed
   *  Challenge, both with a UTC countdown to the next reset. */
  openChallengesScreen() {
    if (!this.isWyzwaniaUnlocked()) return;
    const { dateKey } = dailySeedForDate(new Date());
    if (!this.dailyLayout || this.dailyLayout.dateKey !== dateKey) this.dailyLayout = this.computeDailyLayout();
    document.getElementById('dailyModifierBadge').classList.toggle('hidden', this.dailyLayout.modifier !== 'rush_hour');
    this.updateCoinDisplays();
    this.updateChallengeCountdown();
    this.showScreen('challengesScreen');
  }

  updateChallengeCountdown() {
    const el = document.getElementById('challengeCountdown');
    if (!el) return;
    const now = new Date();
    const nextUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    const remainingMs = Math.max(0, nextUtcMidnight - now.getTime());
    const h = Math.floor(remainingMs / 3600000);
    const m = Math.floor((remainingMs % 3600000) / 60000);
    const s = Math.floor((remainingMs % 60000) / 1000);
    el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    const ring = document.getElementById('challengeCountdownRing');
    if (ring) ring.style.strokeDashoffset = 175.9 * (1 - remainingMs / 86400000); // 2*PI*28
  }

  /* ---------- Golden Shot v8: player level / XP ---------- */

  /** Adds XP and processes any level-ups (coins every level, prisms every
   *  CONFIG.progression.levelPrismsEvery levels, each with an "AWANS!"
   *  celebration queued for the next queueUnlockCelebrations()). The caller
   *  persists the save. Returns before/after for the result-screen XP bar. */
  grantXp(amount) {
    const P = CONFIG.progression;
    const p = this.save.player || (this.save.player = { level: 1, xp: 0 });
    const before = { level: p.level, xp: p.xp, need: P.xpForLevel(p.level) };
    const gained = Math.max(0, Math.round(amount));
    p.xp += gained;
    const levelsUp = [];
    while (p.xp >= P.xpForLevel(p.level)) {
      p.xp -= P.xpForLevel(p.level);
      p.level++;
      const coins = P.levelCoins(p.level);
      const prisms = p.level % P.levelPrismsEvery === 0 ? P.levelPrisms : 0;
      this.save.coins += coins;
      this.save.prisms = (this.save.prisms || 0) + prisms;
      levelsUp.push({ level: p.level, coins, prisms });
      // v13: shown inline on the result's XP card -- the full-screen overlay
      // covered the score and place 650 ms after almost every early round.
      this.analytics.track('player_level_up', { level: p.level, coins, prisms });
    }
    return { gained, before, after: { level: p.level, xp: p.xp, need: P.xpForLevel(p.level) }, levelsUp };
  }

  /** Fills a result screen's XP card (`prefix` = 'result' | 'mission') and
   *  animates its bar from the pre-run fill to the new one. */
  renderXpCard(prefix, res) {
    const card = document.getElementById(prefix + 'XpCard');
    if (!res) { card.classList.add('hidden'); return; }
    card.classList.remove('hidden');
    const leveled = res.levelsUp.length > 0;
    card.classList.toggle('leveled', leveled);
    document.getElementById(prefix + 'XpLevel').textContent = leveled ? `AWANS! POZIOM ${res.after.level}` : `POZIOM ${res.after.level}`;
    document.getElementById(prefix + 'XpGain').textContent = `+${res.gained} XP`;
    const lvlCoins = res.levelsUp.reduce((a, l) => a + l.coins, 0), lvlPrisms = res.levelsUp.reduce((a, l) => a + l.prisms, 0);
    document.getElementById(prefix + 'XpText').textContent = `${res.after.xp} / ${res.after.need} XP`
      + (leveled ? ` · nagroda +${lvlCoins} monet${lvlPrisms ? ` +${lvlPrisms} ◆` : ''}` : '');
    const bar = document.getElementById(prefix + 'XpBar');
    bar.style.transition = 'none';
    bar.style.width = (leveled ? 0 : (res.before.xp / res.before.need) * 100) + '%';
    void bar.offsetWidth;
    bar.style.transition = '';
    setTimeout(() => { bar.style.width = (res.after.xp / res.after.need) * 100 + '%'; }, 350);
  }

  updatePlayerLevelRow() {
    const P = CONFIG.progression;
    const p = this.save.player || { level: 1, xp: 0 };
    const need = P.xpForLevel(p.level);
    document.getElementById('hubPlayerLevelValue').textContent = p.level;
    document.getElementById('hubPlayerRing').style.setProperty('--xp', clamp(p.xp / need, 0, 1).toFixed(3));
    document.getElementById('hubPlayerName').textContent = this.playerDisplayName();
    document.getElementById('hubPlayerXpText').innerHTML = `POZIOM ${p.level}<span class="hub-player-xp"> · ${p.xp} / ${need} XP</span>`;
  }

  openPlayerLevelInfo() {
    const P = CONFIG.progression;
    this.openInfoSheet({
      icon: `<svg viewBox="0 0 24 24" style="color:#EFCB63">${CARD_ICONS.star}</svg>`,
      title: 'Poziom gracza',
      body: [
        'Każda runda <strong>GRAJ 2:00</strong>, <strong>Wyzwanie dnia</strong> i misja w Dzielnicach daje XP.',
        `Runda: ${P.xpRunBase} XP + punkty wyniku + premia za podium (do +${P.xpPlaceBonus[0]} XP za 1. miejsce). Misja: +${P.xpMissionSuccess} XP za ukończenie.`,
        `Każdy nowy poziom = monety, a co ${P.levelPrismsEvery}. poziom także <strong>+${P.levelPrisms} pryzmatów</strong>.`
      ]
    });
  }

  /* ---------- Golden Shot v8: 7-day login calendar ---------- */

  loginState() {
    const today = dailySeedForDate(new Date()).dateKey;
    const L = this.save.login || (this.save.login = { lastClaimDate: null, day: 0, totalClaims: 0 });
    // v11 clock guard: a last claim dated *after* today means the device
    // clock was rolled back after claiming -- no reward until it catches up
    // (stops forward/back clock cycling from farming the calendar).
    // A claim dated more than 2 days ahead is a once-wrong clock that has
    // since been corrected (not cycling), so it's reset instead of
    // locking the calendar until that date.
    if (L.lastClaimDate && Date.parse(L.lastClaimDate) - Date.parse(today) > 2 * 86400000) { L.lastClaimDate = null; L.day = 0; }
    const clockRolledBack = !!L.lastClaimDate && L.lastClaimDate > today;
    const claimedToday = L.lastClaimDate === today || clockRolledBack;
    const streakAlive = claimedToday || L.lastClaimDate === previousDateKey(today);
    return { today, claimedToday, clockRolledBack, day: streakAlive ? L.day : 0 };
  }

  maybeShowLoginReward() {
    // v13: not before the first finished Arena round -- the calendar used to
    // pop up between the tutorial and the first round.
    if (this.running || this.isFirstRun() || !(this.save.stats.runsPlayed > 0)) return;
    if (document.getElementById('mainMenu').classList.contains('hidden')) return;
    if (!document.getElementById('unlockOverlay').classList.contains('hidden')) return;
    if (!document.getElementById('missionBriefing').classList.contains('hidden') || !document.getElementById('infoSheet').classList.contains('hidden')) return;
    const st = this.loginState();
    if (st.claimedToday) return;
    this.renderLoginGrid(st.day, false);
    document.getElementById('loginRewardDay').textContent = st.day + 1;
    const btn = document.getElementById('btnLoginClaim');
    btn.disabled = false;
    btn.textContent = 'ODBIERZ';
    document.getElementById('btnLoginDouble').classList.add('hidden');
    document.getElementById('btnLoginDouble').textContent = '×2 ZA REKLAMĘ';
    document.getElementById('btnLoginClose').classList.add('hidden');
    document.getElementById('loginRewardScreen').classList.remove('hidden');
    this.analytics.track('login_reward_offer', { day: st.day + 1 });
  }

  renderLoginGrid(day, justClaimed) {
    const grid = document.getElementById('loginRewardGrid');
    grid.innerHTML = '';
    CONFIG.loginRewards.forEach((r, i) => {
      const tile = document.createElement('div');
      const state = i < day || (justClaimed && i === day) ? 'claimed' : (i === day ? 'current' : 'future');
      tile.className = `login-tile ${state}${r.big ? ' big' : ''}${justClaimed && i === day ? ' just-claimed' : ''}`;
      const parts = [];
      if (r.coins) parts.push(`<span class="login-tile-coins">◇ ${r.coins}</span>`);
      if (r.prisms) parts.push(`<span class="login-tile-prisms">◆ ${r.prisms}</span>`);
      tile.innerHTML = `<span class="login-tile-day">DZIEŃ ${i + 1}</span>${parts.join('')}${state === 'claimed' ? '<span class="login-tile-check">✓</span>' : ''}`;
      grid.appendChild(tile);
    });
  }

  claimLoginReward() {
    const st = this.loginState();
    if (st.claimedToday) return;
    const reward = CONFIG.loginRewards[st.day];
    this.save.coins += reward.coins || 0;
    this.save.prisms = (this.save.prisms || 0) + (reward.prisms || 0);
    const L = this.save.login;
    L.lastClaimDate = st.today;
    L.day = (st.day + 1) % CONFIG.loginRewards.length;
    L.totalClaims = (L.totalClaims || 0) + 1;
    saveGame(this.save);
    this.analytics.track('login_reward_claim', { day: st.day + 1, coins: reward.coins || 0, prisms: reward.prisms || 0 });

    this.renderLoginGrid(st.day, true);
    const btn = document.getElementById('btnLoginClaim');
    btn.disabled = true;
    btn.textContent = `+${reward.coins ? reward.coins + ' MONET' : ''}${reward.coins && reward.prisms ? ' · ' : ''}${reward.prisms ? reward.prisms + ' PRYZMATÓW' : ''}!`;
    this.burstDom(document.getElementById('loginBurst'), reward.big ? 40 : 22);
    this.sound.fanfare(!!reward.big);
    this.vibrate([30, 40, 80]);
    this.updateCoinDisplays();
    // Golden Shot v11: opt-in "double it" right at the moment of reward.
    this.lastLoginReward = reward;
    document.getElementById('btnLoginDouble').classList.remove('hidden');
    document.getElementById('btnLoginClose').classList.remove('hidden');
    document.getElementById('btnLoginDouble').disabled = false;
    this.analytics.track('ad_offer', { context: 'login_double' });
  }

  async doubleLoginReward() {
    const reward = this.lastLoginReward;
    const btn = document.getElementById('btnLoginDouble');
    if (!reward || btn.disabled) return;
    btn.disabled = true;
    if (!(await this.monetization.rewarded('login_double'))) { btn.disabled = false; return; }
    this.lastLoginReward = null;
    this.save.coins += reward.coins || 0;
    this.save.prisms = (this.save.prisms || 0) + (reward.prisms || 0);
    saveGame(this.save);
    btn.textContent = 'PODWOJONO ✓';
    this.burstDom(document.getElementById('loginBurst'), 30);
    this.sound.coin();
    this.updateCoinDisplays();
    setTimeout(() => this.closeLoginReward(), 900);
  }

  closeLoginReward() {
    document.getElementById('loginRewardScreen').classList.add('hidden');
    this.updateCoinDisplays();
  }

  /** Radial DOM particle burst (same look as the unlock overlay's). */
  burstDom(container, count) {
    container.innerHTML = '';
    const colors = ['#50F0FA', '#FF54AD', '#EFCB63', '#9875FF', '#46D99A'];
    for (let i = 0; i < count; i++) {
      const sp = document.createElement('span');
      sp.style.setProperty('--a', `${(i / count) * 360 + rand(-10, 10)}deg`);
      sp.style.setProperty('--d', `${rand(80, 170)}px`);
      sp.style.setProperty('--s', `${rand(4, 9)}px`);
      sp.style.setProperty('--c', colors[i % colors.length]);
      container.appendChild(sp);
    }
    container.classList.remove('play');
    void container.offsetWidth;
    container.classList.add('play');
  }

  /** Full-screen confetti rain on a result screen (wins, PBs, missions). */
  launchConfetti(layerId, count = 70) {
    const layer = document.getElementById(layerId);
    if (!layer) return;
    layer.innerHTML = '';
    const colors = ['#50F0FA', '#FF54AD', '#EFCB63', '#9875FF', '#46D99A', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const c = document.createElement('i');
      c.style.left = rand(0, 100) + '%';
      c.style.background = colors[i % colors.length];
      c.style.setProperty('--dx', `${rand(-80, 80)}px`);
      c.style.setProperty('--r', `${rand(-720, 720)}deg`);
      c.style.animationDelay = `${rand(0, 0.9)}s`;
      c.style.animationDuration = `${rand(1.8, 3.2)}s`;
      c.style.width = rand(6, 10) + 'px';
      c.style.height = rand(10, 16) + 'px';
      layer.appendChild(c);
    }
    clearTimeout(this.confettiTimer);
    this.confettiTimer = setTimeout(() => { layer.innerHTML = ''; }, 4500);
  }

  /** Counts a number up inside `el` (result screens). */
  animateNumber(el, to, ms = 900, prefix = '', fmt = String) {
    // Timed from the first animation frame (not performance.now() at call
    // time), so a stalled/hidden tab or a skewed clock can't leave it at 0.
    let start = null;
    const step = (now) => {
      if (start === null) start = now;
      const t = clamp((now - start) / ms, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = prefix + fmt(Math.round(to * eased));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- Golden Shot v8: free chest (4 h cooldown) ---------- */

  updateFreeChestRow() {
    const row = document.getElementById('hubFreeChest');
    if (!row) return;
    const fc = this.save.freeChest || (this.save.freeChest = { nextAt: 0, opened: 0 });
    const remaining = fc.nextAt - Date.now();
    const ready = remaining <= 0;
    row.classList.toggle('ready', ready);
    document.getElementById('hubChestCta').textContent = ready ? 'OTWÓRZ' : 'CZEKA';
    if (ready) {
      document.getElementById('hubChestSub').textContent = 'Gotowa do otwarcia!';
    } else {
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const sec = Math.floor((remaining % 60000) / 1000);
      document.getElementById('hubChestSub').textContent = `Następna za ${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    }
  }

  openFreeChest(opts = {}) {
    const fc = this.save.freeChest;
    const C = CONFIG.freeChest;
    if (fc.nextAt > Date.now() && !opts.skip) {
      const left = this.monetization.placementLeft('chest_skip');
      this.openInfoSheet({
        icon: REWARD_CATEGORY_ICONS.bundle,
        title: 'Darmowa skrzynia',
        body: ['Co 4 godziny czeka na Ciebie darmowa skrzynia z monetami — czasem z pryzmatami, a czasem z <strong>JACKPOTEM ×3</strong>.',
          left > 0 ? `Nie chcesz czekać? Otwórz ją od razu za krótką reklamę (zostało dziś: ${left}).` : 'Wróć, gdy licznik dojdzie do zera!'],
        action: left > 0 ? { label: 'OTWÓRZ TERAZ · REKLAMA', onClick: async () => {
          this.closeInfoSheet();
          if (await this.monetization.rewarded('chest_skip')) this.openFreeChest({ skip: true });
        } } : null
      });
      return;
    }
    let coins = randInt(C.coins[0], C.coins[1]);
    const jackpot = Math.random() < C.jackpotChance;
    if (jackpot) coins *= C.jackpotMult;
    const prisms = Math.random() < C.prismChance ? randInt(C.prisms[0], C.prisms[1]) : 0;
    this.save.coins += coins;
    this.save.prisms = (this.save.prisms || 0) + prisms;
    fc.nextAt = Date.now() + C.cooldownMs;
    fc.opened = (fc.opened || 0) + 1;
    saveGame(this.save);
    this.analytics.track('free_chest_open', { coins, prisms, jackpot });
    this.sound.coin();
    this.queueRewardCelebration({
      kicker: jackpot ? 'JACKPOT ×3!' : 'SKRZYNIA OTWARTA!', eyebrow: 'DARMOWA SKRZYNIA',
      title: `+${coins} monet${prisms ? ` · +${prisms} ◆` : ''}`, color: jackpot ? '#FF54AD' : '#EFCB63',
      icon: REWARD_CATEGORY_ICONS.bundle, noCta: true,
      desc: 'Kolejna skrzynia za 4 godziny. Wydaj monety w Warsztacie albo na wsparcie przed rundą!'
    });
    this.queueUnlockCelebrations();
    this.updateCoinDisplays();
  }

  /* ---------- Golden Shot v8: result-screen upgrade funnel ---------- */

  async onUpsellClick() {
    const boost = RUN_TOOLS.find(t => t.id === 'boost');
    if (this.save.coins >= boost.price) {
      this.selectedRunTool = 'boost';
      this.populateRunToolGrid();
      this.showScreen('runSetupScreen');
    } else if (!this.energyFreeFor('arena') && this.energyNow() < 1) {
      this.openEnergySheet({ empty: true, onRefill: () => this.onUpsellClick() });
    } else if (this.monetization.placementLeft('turbo_free') > 0) {
      // Golden Shot v11: can't afford it -> a free Turbo start for an ad,
      // straight into the rematch (startRound() never charges for tools).
      if (await this.monetization.rewarded('turbo_free')) {
        this.selectedRunTool = 'boost';
        this.requireEnergy('arena', () => {
          if (this.challenge && !this.challengeBeaten) this.startRound({ seed: this.runSeed, challenge: this.challenge });
          else this.startRound();
        });
      }
    } else {
      this.openFreeChest();
    }
    this.analytics.track('upsell_click', { affordable: this.save.coins >= boost.price });
  }

  showScreen(id) {
    ['mainMenu', 'shopScreen', 'gameOverScreen', 'profileScreen', 'runSetupScreen', 'campaignScreen', 'missionResultScreen', 'challengesScreen'].forEach(s => {
      document.getElementById(s).classList.toggle('hidden', s !== id);
    });
    document.getElementById('hud').classList.toggle('hidden', true);
    document.getElementById('pauseSheet').classList.add('hidden');
    document.getElementById('leaveConfirm').classList.add('hidden');
    document.getElementById('resetProfileConfirm').classList.add('hidden');
    document.getElementById('tutorialIntroOverlay').classList.add('hidden');
    document.getElementById('loginRewardScreen').classList.add('hidden');
    this.closeMissionBriefing();
    this.closeInfoSheet();
    this.introPending = false;
    if (id === 'mainMenu') {
      this.renderHubChallenge();
      clearTimeout(this.loginPopupTimer);
      this.loginPopupTimer = setTimeout(() => this.maybeShowLoginReward(), 600);
    }
    const visitedFeature = { shopScreen: 'warsztat', challengesScreen: 'wyzwania' }[id];
    if (visitedFeature) this.markUnlockVisited(visitedFeature);
    this.renderBottomNav(id);
    this.startScreenAnim();
    if (!this.running) {
      this.sound.setIntensity(0); this.sound.setDucked(false);
      // v16: results keep the round's track as a calm outro; every other
      // screen plays the lo-fi menu rotation.
      if (id !== 'gameOverScreen' && id !== 'missionResultScreen') this.sound.setScene('menu');
    }
    this.renderConsentBar();
  }

  hideAllOverlays() {
    ['mainMenu', 'shopScreen', 'gameOverScreen', 'adOverlay', 'pauseSheet', 'leaveConfirm', 'resetProfileConfirm', 'tutorialIntroOverlay', 'infoSheet', 'unlockOverlay', 'loginRewardScreen', 'reviveOverlay', 'consentBar', 'profileScreen', 'runSetupScreen', 'campaignScreen', 'missionResultScreen', 'challengesScreen', 'missionBriefing'].forEach(s => {
      document.getElementById(s).classList.add('hidden');
    });
    document.getElementById('bottomNav').classList.add('hidden');
    this.closeInfoSheet(); // runs (and clears) a pending onClose
  }

  /** GDD 4.0 §5.1-§5.4: one persistent bottom nav across the 4 hub screens.
   *  §5.5 unlock order: Dzielnice is always available; Warsztat/Wyzwania
   *  gate off campaign mission completion (Miasto itself has no gate --
   *  it's the landing screen a fresh save opens on). */
  renderBottomNav(activeScreenId) {
    const NAV_SCREENS = ['mainMenu', 'campaignScreen', 'shopScreen', 'challengesScreen'];
    const nav = document.getElementById('bottomNav');
    // First run (before the M00 tutorial clears): no nav at all -- Miasto's
    // welcome card is the only thing to do, and three locked/unknown tabs
    // were just noise (player feedback). Locked tabs reappear after M00,
    // dimmed with a lock badge, and tapping one explains how to unlock it.
    nav.classList.toggle('hidden', !NAV_SCREENS.includes(activeScreenId) || this.isFirstRun());

    const tabs = [
      { btn: 'btnNavMiasto', screen: 'mainMenu', unlocked: true },
      { btn: 'btnNavDzielnice', screen: 'campaignScreen', unlocked: true, fresh: 'district:' },
      { btn: 'btnNavWarsztat', screen: 'shopScreen', unlocked: this.isWarsztatUnlocked(), fresh: 'warsztat' },
      { btn: 'btnNavWyzwania', screen: 'challengesScreen', unlocked: this.isWyzwaniaUnlocked(), fresh: 'wyzwania' }
    ];
    tabs.forEach(t => {
      const btn = document.getElementById(t.btn);
      btn.classList.toggle('active', t.screen === activeScreenId);
      // GDD 4.0 mockup: a locked tab stays visible (dimmed) with a small
      // lock badge -- never simply hidden. Tapping it opens
      // openLockedTabInfo() instead of doing nothing.
      btn.classList.toggle('locked', !t.unlocked);
      const lockBadge = btn.querySelector('.nav-tab-lock');
      if (lockBadge) lockBadge.classList.toggle('hidden', t.unlocked);
      btn.classList.toggle('is-new', !!(t.unlocked && t.fresh && this.isUnlockFresh(t.fresh)));
    });
  }

  /** GDD 4.0 §5.5: Arena's round (GRAJ 2:00 / Wyzwanie dnia) unlocks after
   *  clearing M00 -- the campaign is the onboarding per §1's Player
   *  Journey. M00 (not M01) is the gate specifically because it's the
   *  mission that guarantees a T1/T2/T3 object plus rival-eating are all
   *  discovered (see save.campaign.discoveredTypes/discoveredHoleEating),
   *  which createObjects() needs to avoid spawning an empty Arena. M01 is
   *  also accepted so a save from before M00 existed (already migrated to
   *  full discovery -- see migrateSave()'s v8 branch) doesn't relock an
   *  Arena it already had. */
  isArenaUnlocked() { return FEATURE_GATES.arena(this.save); }

  /** GDD 4.0 §5.5: Wyzwanie dnia tab (and, per the same row, "full meta
   *  navigation") unlocks after clearing M04. */
  isWyzwaniaUnlocked() { return FEATURE_GATES.wyzwania(this.save); }

  /* ---------- world setup ---------- */

  playerDisplayName() {
    return this.save.displayName || 'Ty';
  }

  /** rng, when passed, makes this position part of the run's deterministic
   *  starting layout (Phase 5 — see seededRand()'s doc comment). */
  randomWorldPos(padding, rng) {
    return rng
      ? { x: seededRand(rng, padding, WORLD_W - padding), y: seededRand(rng, padding, WORLD_H - padding) }
      : { x: rand(padding, WORLD_W - padding), y: rand(padding, WORLD_H - padding) };
  }

  /** Arena only spawns object types the player has actually discovered in
   *  Campaign (player feedback: don't show elements/mechanics the player
   *  hasn't learned yet) -- see resolveCampaignEntity()'s discovery
   *  tracking and M00's tutorial goal, which is also what isArenaUnlocked()
   *  gates on. The `size === 0` fallback only matters for a corrupted/
   *  hand-edited save, since a real player can't reach Arena without M00
   *  (which guarantees fragment/prop/vehicle) already discovered. */
  createObjects(rng) {
    this.objects = [];
    const discovered = new Set(this.save.campaign.discoveredTypes || []);
    if (discovered.size === 0) Object.keys(CAMPAIGN_ENTITY_STATS).forEach(t => discovered.add(t));
    // v11: every group is built (so the seeded RNG is consumed the same
    // way for every player) and undiscovered ones are dropped afterwards --
    // a friend-challenge seed must lay out the same map whatever the
    // recipient has discovered so far.
    Object.keys(TIERS).forEach(tierName => {
      const keep = tierName === 'portal' || discovered.has(tierName);
      for (let i = 0; i < TIERS[tierName].count; i++) {
        const obj = new WorldObject(tierName, rng);
        if (keep) this.objects.push(obj);
      }
    });
    this.layStreetTrails(rng);
  }

  /** v13: lays CONFIG.arena.trails rows of fragments along road lanes, one
   *  block-length each (8 pickups ~ 30 px apart = an easy combo ×8). Seeded,
   *  after every group is built, so Daily/challenge maps stay identical. */
  layStreetTrails(rng) {
    const A = CONFIG.arena;
    const frags = this.objects.filter(o => o.tier === 'fragment');
    let k = 0;
    // Always the same number of draws, whatever was discovered/dropped.
    for (let t = 0; t < A.trails; t++) {
      const vertical = rng.next() < 0.5;
      const line = seededInt(rng, 1, CITY_CELLS - 1) * CITY_PITCH;
      const seg = seededInt(rng, 0, CITY_CELLS - 1);
      const lane = (rng.next() < 0.5 ? -1 : 1) * CITY_ROAD * 0.22;
      const start = seg * CITY_PITCH + CITY_ROAD / 2 + 26;
      const span = CITY_PITCH - CITY_ROAD - 52;
      for (let i = 0; i < A.trailLength; i++) {
        const o = frags[k++];
        if (!o) continue;
        const along = start + span * i / (A.trailLength - 1);
        o.x = vertical ? line + lane : along;
        o.y = vertical ? along : line + lane;
        o.trail = true;
      }
    }
  }

  /** v13: every hole starts inside a small feast -- fragments on a loose
   *  spiral plus a couple of capsules, taken from the scattered pool (so
   *  the totals don't change). The first bite is a few frames away. */
  layStarterFeasts(rng, spawns) {
    const A = CONFIG.arena;
    const pool = { fragment: this.objects.filter(o => o.tier === 'fragment' && !o.trail), capsule: this.objects.filter(o => o.tier === 'capsule') };
    const take = (tier) => pool[tier].pop();
    for (const sp of spawns) {
      const a0 = rng.next() * Math.PI * 2;
      for (let i = 0; i < A.feastFragments; i++) {
        const o = take('fragment');
        if (!o) break;
        const a = a0 + i * 2.4, r = 46 + i * 10;
        o.x = clamp(sp.x + Math.cos(a) * r, 30, WORLD_W - 30);
        o.y = clamp(sp.y + Math.sin(a) * r, 30, WORLD_H - 30);
      }
      for (let i = 0; i < A.feastCapsules; i++) {
        const o = take('capsule');
        if (!o) break;
        const a = a0 + Math.PI * (0.5 + i);
        o.x = clamp(sp.x + Math.cos(a) * 150, 30, WORLD_W - 30);
        o.y = clamp(sp.y + Math.sin(a) * 150, 30, WORLD_H - 30);
      }
    }
  }

  /** Spawn points for the player and every bot plus the bot names -- the
   *  exact seeded draws createEntities() makes (shared with
   *  computeDailyLayout(), so its preview is the real layout). */
  rollSpawns(rng) {
    const player = this.randomWorldPos(300, rng);
    const names = pickUnique(BOT_NAME_POOL, NUM_BOTS, rng);
    // v13: rivals start at least 500 px away (a bot spawned on top of the
    // player ate its starting feast). Fixed 6 tries -> same draws for all.
    const bots = names.map(() => {
      let best = null, bestD = -1;
      for (let k = 0; k < 6; k++) {
        const p = this.randomWorldPos(300, rng);
        const d = dist(p.x, p.y, player.x, player.y);
        if (bestD < 500 && d > bestD) { best = p; bestD = d; }
      }
      return best;
    });
    return { player, names, bots };
  }

  createEntities(rng) {
    const spawns = this.rollSpawns(rng);
    const spawn = spawns.player;
    this.player = new Hole(this.playerDisplayName(), spawn.x, spawn.y, true);
    this.player.skin = this.save.selected;
    this.player.auraId = this.save.auras.selected;

    // Golden Shot v8 difficulty curve: bot spawn size, speed, aggression
    // and passive growth all lerp from easy to hard by this.difficultyT.
    const D = CONFIG.difficulty, t = this.difficultyT;
    const pick = (pair) => lerp(pair[0], pair[1], t);
    this.botTuning = {
      aggro: pick(D.botAggroRange),
      prey: pick(D.botPreyRange),
      objects: pick(D.botObjectRange),
      decision: pick(D.botDecisionSeconds),
      passive: pick(D.botPassiveUnitsPerSec)
    };
    // Phase 5 (scoped): a single lightweight run modifier, seed-driven so
    // a Daily Seed Challenge gets the same one for every player that day.
    // Full authored districts/chunks (GDD §14.2) are NOT implemented —
    // see docs/GAME_DESIGN.md for the explicit scope call.
    const speedMult = pick(D.botSpeedMult) * (this.modifier === 'rush_hour' ? 1.3 : 1);

    this.bots = [];
    const names = spawns.names;
    for (let i = 0; i < NUM_BOTS; i++) {
      const p = spawns.bots[i];
      const bot = new Bot(names[i], p.x, p.y);
      // Small per-bot spread so the pack isn't uniform.
      bot.startRadius = pick(D.botStartRadius) * (0.9 + 0.2 * (i / Math.max(1, NUM_BOTS - 1)));
      bot.radius = bot.startRadius;
      bot.baseSpeedMult = speedMult;
      bot.tempSpeedMult = speedMult;
      bot.styleOverride = BOT_STYLES[i % BOT_STYLES.length];
      this.bots.push(bot);
    }
    this.layStarterFeasts(rng, [spawns.player, ...spawns.bots]);
  }

  /** GRAJ 2:00: the run-tool screen only once tools make sense -- a new
   *  player's first rounds start straight away (v13). */
  startArenaRound() {
    if (!this.isArenaUnlocked()) return;
    this.selectedRunTool = 'none';
    if ((this.save.stats.runsPlayed || 0) < CONFIG.difficulty.rampStartRuns) { this.requireEnergy('arena', () => this.startRound()); return; }
    // v15: no energy -> the energy sheet now, not after picking a tool.
    if (!this.energyFreeFor('arena') && this.energyNow() < 1) { this.openEnergySheet({ empty: true, onRefill: () => this.startArenaRound() }); return; }
    this.populateRunToolGrid();
    this.showScreen('runSetupScreen');
  }

  pickModifier() {
    if (!CONFIG.flags.runModifiers) return 'none';
    return this.rng.next() < 0.35 ? 'rush_hour' : 'none';
  }

  /* ---------- Campaign mode (Vector Hole v3 / GDD 3.1) ----------
     A second simulation from Arena: its own entity list (campaignEntities,
     CampaignEntity instances), its own growth/tier model (growthUnits ->
     CAMPAIGN_TIERS), driven by updateCampaign()/renderCampaign() instead
     of update()/render(). Arena, Daily and their save fields are untouched. */

  randomInCampaignBounds(padding) {
    const b = CONFIG.campaign.bounds;
    return { x: rand(b.minX + padding, b.maxX - padding), y: rand(b.minY + padding, b.maxY - padding) };
  }

  /** Hole.moveToward()/moveDirection() only clamp to the shared 3000x3000
   *  world, so without this a player (or bot) could wander straight out of
   *  the mission's much smaller CONFIG.campaign.bounds box into empty
   *  space with none of the mission's entities in it (player feedback,
   *  reported directly against the live game: "mogę wyjechać poza obszar
   *  namalowany na mapie" -- the player could leave the area the mission
   *  actually paints/populates. An earlier pass removed this clamp
   *  entirely to make the boundary feel more distant, like Arena's --
   *  wrong fix: Arena's world clamp matches its content's full extent
   *  (TIERS objects spawn across all of WORLD_W/WORLD_H), Campaign's
   *  doesn't, so widening the *clamp* without widening *where entities
   *  spawn* just let the player drive into a real void). */
  clampToCampaignBounds(hole) {
    const b = CONFIG.campaign.bounds;
    hole.x = clamp(hole.x, b.minX + hole.radius, b.maxX - hole.radius);
    hole.y = clamp(hole.y, b.minY + hole.radius, b.maxY - hole.radius);
  }

  campaignPlayerTier() {
    const units = this.mission ? this.mission.growthUnits : 0;
    let current = CAMPAIGN_TIERS[0];
    for (const t of CAMPAIGN_TIERS) if (units >= t.minUnits) current = t;
    return current;
  }

  campaignTierIndex(tierId) { return CAMPAIGN_TIERS.findIndex(t => t.id === tierId) + 1; }

  /** Which glyph (if any) an 'eatCount' goal is specifically about --
   *  player feedback: eating some OTHER object of the same type/size must
   *  not count toward a mission that names one particular object (e.g.
   *  M09 wants skrzynia, not any prop). Every spawned entity of the goal's
   *  type sharing one glyph (the normal case -- see MARKER_GLYPHS/
   *  PROP_GLYPHS/NODE_GLYPHS) means the goal is that specific object, so
   *  progress is scoped to it; a genuinely mixed spawn (M02's random
   *  street props for a "any street element" goal) has no single glyph,
   *  so progress keeps counting the whole type as before. */
  computeCampaignGoalGlyph() {
    const g = this.mission.def.goal;
    if (g.type !== 'eatCount') return null;
    const glyphs = new Set(this.campaignEntities.filter(e => e.type === g.entityType).map(e => e.glyph || null));
    return glyphs.size === 1 ? [...glyphs][0] : null;
  }

  /** Base display color for a campaign entity, coded by SIZE (player
   *  feedback: colors should tell you how big something is -- smallest
   *  cyan, bigger pink, bigger still green, biggest gold -- same
   *  small/medium/large convention as Arena's TIERS, not a rainbow of
   *  per-object identity colors). Reuses CAMPAIGN_ENTITY_STATS' `minTier`
   *  (how grown the player must be to eat it) as the size rung: T1
   *  fragment/kapsuła, T2 elementy uliczne/znaczniki, T3 pojazdy/węzły/
   *  pylony, T4 landmarki. Which *specific* object the mission wants is
   *  shown separately by draw()'s pulsing gold `isGoal` ring, so the fill
   *  color is free to encode size instead of identity. Gate glyphs
   *  (brama/portal/pas przelotu) and mostek stay state-colored -- they're
   *  structural, never eaten by growth, so a size color doesn't apply. */
  campaignEntityColor(e) {
    if (!e) return '#fff';
    if (e.type === 'gate') {
      if (e.glyph === 'portal') return e.isGateOpen ? '#68F5FC' : '#9875FF';
      return !e.isGateOpen ? 'rgba(255,255,255,0.2)' : (e.isGateTelegraphing ? '#EFCB63' : '#50F0FA');
    }

    if (e.type === 'runner') return '#EFCB63';
    const stats = CAMPAIGN_ENTITY_STATS[e.type];
    return stats ? SIZE_TIER_COLORS[stats.minTier] : '#fff';
  }

  /** {icon, color} for one "CEL RUNDY" HUD row -- `type` is a
   *  CampaignEntity type, or 'gate'/'combo' for the two goal shapes that
   *  aren't keyed by entity type (gatesPassed/comboChain). */
  campaignGoalIcon(type) {
    if (type === 'combo') return { icon: CARD_ICONS.burst, color: '#EFCB63' };
    if (type === 'gate') return { icon: GOAL_ICONS.gate, color: '#50F0FA' };
    if (type === 'rival') return { icon: GOAL_ICONS.rival, color: '#ff3860' };
    if (type === 'portal') return { icon: GOAL_ICONS.portal, color: '#9875FF' };
    if (type === 'score') return { icon: GOAL_ICONS.score, color: '#EFCB63' };
    if (type === 'runner') return { icon: GOAL_ICONS.runner, color: '#EFCB63' };
    // landmark's minTier (4) already resolves to SIZE_TIER_COLORS[4] below --
    // no separate override needed now that it's the same violet as the board object.
    const stats = CAMPAIGN_ENTITY_STATS[type];
    const color = stats ? SIZE_TIER_COLORS[stats.minTier] : '#fff';
    return { icon: GOAL_ICONS[type] || GOAL_ICONS.fragment, color };
  }

  /** Icon + color for one authored objective step (shared by the in-round
   *  goal box and the v14 mission briefing cards). */
  objectiveIconDef(st, setup) {
    if (st.landmark) return { icon: GOAL_ICONS.landmark, color: SIZE_TIER_COLORS[LANDMARK_TIERS[st.landmark]] };
    if (st.tier) return { icon: GOAL_ICONS.tier, color: CAMPAIGN_TIERS[st.tier - 1].color };
    const kind = st.eat || st.activate || (st.combo && 'combo') ||
      (st.gates && (setup.gateKind === 'portal' ? 'portal' : 'gate')) || (st.rival && 'rival') || (st.score && 'score');
    return this.campaignGoalIcon(kind);
  }

  /** A mission's goals as briefing rows ({icon, color, label}) -- without
   *  progress, for the cards shown before a mission starts. */
  missionStepRows(def) {
    const g = def.goal;
    if (g.type === 'objectives') return g.steps.map(st => ({ ...this.objectiveIconDef(st, def.setup), label: st.label }));
    if (g.type === 'tutorialChecklist') {
      return g.steps.map(step => ({ ...(step.type === 'eatRival' ? { icon: CARD_ICONS.target, color: '#ff3860' } : this.campaignGoalIcon(step.entityType)), label: step.label }));
    }
    return [{ ...this.campaignGoalIcon(g.entityType || 'fragment'), label: g.label }];
  }

  /** v14 mission card (briefing sheet, Dzielnice's next-mission card, the
   *  result screen's "next" preview): code + district, name, NELA's line,
   *  the goals as icon rows, time / medal / reward, and optionally GRAJ.
   *  opts: { eyebrow, nela, play, compact }. Strings are authored game
   *  data (no player input), so plain template HTML is safe here. */
  missionCardHtml(def, opts = {}) {
    const c = this.save.campaign;
    const district = DISTRICTS.find(d => d.id === def.district);
    const color = DISTRICT_COLORS[def.district] || '#50F0FA';
    const done = !!c.completed[def.id];
    const bits = c.stars[def.id] || 0;
    const playable = this.isMissionPlayable(def.id);
    const d = district.missions.indexOf(def.id);
    const prev = d > 0 ? campaignMissionById(district.missions[d - 1]) : null;
    const CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
    const status = done ? this.starsHtml(bits, 'mc-status-stars') : (playable ? '' : `<span class="mc-status locked">ZABLOKOWANA</span>`);
    const D = DIFFICULTY[def.diff || 1];
    const diff = def.id === 'M00' ? '' : `<span class="mc-diff" style="--diff-color:${D.color}">${this.diffBarsHtml(def.diff || 1)}${D.label}</span>`;
    const rows = this.missionStepRows(def).map((r, i) =>
      `<li class="mc-goal"><span class="mc-goal-num">${i + 1}</span><span class="mc-goal-icon" style="color:${r.color}"><svg viewBox="0 0 24 24">${r.icon}</svg></span><span class="mc-goal-text">${r.label}</span></li>`).join('');
    const reward = done
      ? '✓ nagroda odebrana'
      : `◇ +${def.reward.coins} monet${def.reward.unlockDistrict ? (FREE_TRACK_DISTRICTS.includes(def.reward.unlockDistrict) ? ' · nowa dzielnica' : ' · nowa dzielnica i jej utwór') : ''}${def.reward.unlockSkin ? ' · Wir finałowy' : ''}`;
    // v15: the three star conditions (earned ones lit).
    const starRows = (def.stars || []).map((st, i) => `<span class="mc-star${bits & (1 << i) ? ' earned' : ''}"><b>${'★'.repeat(i + 1)}</b>${i === 0 ? 'ukończ' : this.starShortLabel(st)}</span>`).join('');
    const meta = `<div class="mc-meta">` +
      `<span class="mc-meta-item">${CLOCK}${def.untimed ? 'bez limitu' : formatClock(def.timeLimit)}</span>` +
      `<span class="mc-meta-item mc-meta-reward">${reward}</span></div>` +
      (def.untimed ? '' : `<div class="mc-stars">${starRows}</div>`);
    const twists = (def.twists || []).length ? `<div class="mc-twists">${def.twists.map(t => `<span class="mc-twist" style="--t-color:${TWIST_INFO[t].color}"><svg viewBox="0 0 24 24">${GOAL_ICONS[t] || GOAL_ICONS.runner}</svg>${TWIST_INFO[t].label}</span>`).join('')}</div>` : '';
    const twistHints = opts.nela && (def.twists || []).length ? `<ul class="mc-twist-hints">${def.twists.map(t => `<li>${TWIST_INFO[t].hint}</li>`).join('')}</ul>` : '';
    const nela = opts.nela ? `<div class="nela-bubble mc-nela"><span class="nela-avatar" aria-hidden="true">${NELA_AVATAR}</span>` +
      `<span class="nela-bubble-body"><span class="nela-name">NELA</span><span class="nela-line">${def.nela.start}</span></span></div>` : '';
    const lock = !playable && prev ? `<p class="mc-lock">Najpierw ukończ ${missionCode(prev)} „${prev.name}”.</p>` : '';
    // A locked mission's button leads to what unlocks it (no dead end).
    const prevPlayable = !playable && prev && this.isMissionPlayable(prev.id);
    const PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7V5z"/></svg>';
    // v15: in the briefing GRAJ launches (boosters + energy); everywhere
    // else it opens the briefing first.
    const attr = opts.launch ? 'data-mc-launch' : 'data-mc-play';
    const play = !opts.play ? ''
      : playable ? `<button class="btn btn-primary btn-mega mc-play" ${attr}="${def.id}">${done ? 'ZAGRAJ PONOWNIE' : 'GRAJ'}${PLAY_SVG}</button>`
        : prevPlayable ? `<button class="btn btn-secondary mc-play mc-play-prev" data-mc-play="${prev.id}">NAJPIERW ${missionCode(prev)}${PLAY_SVG}</button>`
          : `<button class="btn btn-primary btn-mega mc-play" disabled>ZABLOKOWANA</button>`;
    const boosts = opts.launch && playable && def.id !== 'M00' && this.boostersUnlocked() ? this.boosterTilesHtml(def) : '';
    return `<div class="mc-head" style="--d-color:${color}">` +
      `<span class="mc-code">${missionCode(def)}</span><span class="mc-eyebrow">${opts.eyebrow || district.name.toUpperCase()}</span>${diff}${status}</div>` +
      `<h3 class="mc-name">${def.name}</h3>${nela}` +
      `<div class="mc-label">CEL MISJI</div><ol class="mc-goals">${rows}</ol>${twists}${twistHints}${meta}${lock}${boosts}${play}`;
  }

  openMissionBriefing(missionId) {
    const def = campaignMissionById(missionId);
    if (!def) return;
    this.selectedMissionId = missionId;
    this.briefingBoosters = new Set();
    const card = document.getElementById('briefingCard');
    card.innerHTML = this.missionCardHtml(def, { nela: true, play: true, launch: true });
    card.style.setProperty('--d-color', DISTRICT_COLORS[def.district] || '#50F0FA');
    const h = card.querySelector('.mc-name');
    if (h) h.id = 'briefingName';
    this.refreshBriefingBoosters();
    document.getElementById('missionBriefing').classList.remove('hidden');
    const sheet = document.querySelector('#missionBriefing .briefing-sheet');
    if (sheet) sheet.scrollTop = 0;
    this.sound.ui();
    this.analytics.track('mission_briefing', { missionId });
  }

  /* ---------- v15: energy (the session limit) ---------- */

  /** Regenerates energy up to CONFIG.energy.max from the stored tick and
   *  returns the current value. A clock set backwards never pays out. */
  energyNow() {
    const E = CONFIG.energy, en = this.save.energy, now = Date.now();
    const step = E.regenMinutes * 60000;
    if (!en.lastTick || en.lastTick > now) en.lastTick = now;
    if (en.value >= E.max) { en.lastTick = now; return en.value; }
    const gained = Math.floor((now - en.lastTick) / step);
    if (gained > 0) {
      en.value = Math.min(E.max, en.value + gained);
      en.lastTick = en.value >= E.max ? now : en.lastTick + gained * step;
    }
    return en.value;
  }

  energyInfinite() { return Date.now() < (this.save.energy.infiniteUntil || 0); }

  /** ms until the next point (0 when full). */
  energyNextInMs() {
    const E = CONFIG.energy, en = this.save.energy;
    if (this.energyNow() >= E.max) return 0;
    return Math.max(0, en.lastTick + E.regenMinutes * 60000 - Date.now());
  }

  grantEnergy(n, refund) {
    const E = CONFIG.energy, en = this.save.energy;
    this.energyNow();
    const wasFull = en.value >= E.max;
    en.value = Math.min(E.cap, en.value + n);
    if (en.value >= E.max && !wasFull) en.lastTick = Date.now();
    saveGame(this.save);
    this.updateEnergyDisplays();
    if (!refund) this.analytics.track('energy_gain', { n, value: en.value });
  }

  /** Is this play free of charge? (tutorial, newbie rounds, first Daily
   *  attempt of the day, an active "no limit" hour). */
  energyFreeFor(kind) {
    if (this.energyInfinite()) return true;
    if (kind === 'tutorial') return true;
    if (kind === 'arena') return (this.save.stats.runsPlayed || 0) < CONFIG.energy.freeArenaRuns;
    if (kind === 'daily') return this.save.energy.freeDailyDate !== dailySeedForDate(new Date()).dateKey;
    return false;
  }

  /** Charges one energy for a play of `kind` and runs onPlay(charged) -- or,
   *  when there's none left, opens the energy sheet (refill, ad, wait),
   *  which continues into the play after a refill. */
  requireEnergy(kind, onPlay) {
    if (this.energyFreeFor(kind)) {
      if (kind === 'daily' && !this.energyInfinite()) { this.save.energy.freeDailyDate = dailySeedForDate(new Date()).dateKey; saveGame(this.save); }
      onPlay(false);
      return true;
    }
    const E = CONFIG.energy, en = this.save.energy;
    if (this.energyNow() < 1) {
      this.analytics.track('energy_empty', { kind });
      this.openEnergySheet({ empty: true, onRefill: () => this.requireEnergy(kind, onPlay) });
      return false;
    }
    if (en.value >= E.max) en.lastTick = Date.now();
    en.value--;
    saveGame(this.save);
    this.updateEnergyDisplays();
    this.analytics.track('energy_spend', { kind, left: en.value });
    onPlay(true);
    return true;
  }

  updateEnergyDisplays() {
    if (this.running && document.getElementById('energySheet').classList.contains('hidden')) return;
    const E = CONFIG.energy;
    const v = this.energyNow();
    const inf = this.energyInfinite();
    const next = this.energyNextInMs();
    const timer = inf ? '∞' : next ? formatClock(Math.ceil(next / 1000)) : 'PEŁNA';
    const html = inf ? '∞' : `${v}<small>/${E.max}</small>`;
    document.querySelectorAll('.energy-count').forEach(el => { if (el.innerHTML !== html) el.innerHTML = html; });
    document.querySelectorAll('.energy-timer').forEach(el => { if (el.textContent !== timer) el.textContent = timer; });
    document.querySelectorAll('.energy-chip').forEach(el => el.classList.toggle('empty', !inf && v < 1));
    const sheet = document.getElementById('energySheet');
    if (sheet && !sheet.classList.contains('hidden')) this.renderEnergySheet();
  }

  openEnergySheet(opts = {}) {
    this.energySheetOpts = opts;
    this.renderEnergySheet();
    document.getElementById('energySheet').classList.remove('hidden');
    this.sound.ui();
    this.analytics.track('energy_sheet', { empty: !!opts.empty });
  }

  renderEnergySheet() {
    const E = CONFIG.energy, opts = this.energySheetOpts || {};
    const v = this.energyNow(), inf = this.energyInfinite();
    const next = this.energyNextInMs();
    document.getElementById('energySheetTitle').textContent = opts.empty && v < 1 && !inf ? 'BRAK ENERGII' : 'ENERGIA';
    document.getElementById('energySheetValue').textContent = inf ? '∞' : `${v}/${E.max}`;
    document.getElementById('energySheetTimer').textContent = inf
      ? `Bez limitu jeszcze ${formatClock(Math.ceil((this.save.energy.infiniteUntil - Date.now()) / 1000))}`
      : next ? `+1 za ${formatClock(Math.ceil(next / 1000))} · pełna za ${formatDuration(Math.ceil((next + (E.max - v - 1) * E.regenMinutes * 60000) / 1000))}` : 'Energia pełna';
    document.getElementById('energySheetPips').innerHTML = Array.from({ length: E.max }, (_, i) => `<i class="${inf || i < v ? 'on' : ''}"></i>`).join('');
    const adLeft = this.monetization.placementLeft('energy_ad');
    const btnAd = document.getElementById('btnEnergyAd');
    btnAd.classList.toggle('hidden', inf || v >= E.cap || adLeft <= 0);
    btnAd.textContent = `+${E.adGain} ENERGIA · REKLAMA (zostało ${adLeft})`;
    const btnBuy = document.getElementById('btnEnergyRefill');
    btnBuy.classList.toggle('hidden', inf || v >= E.max);
    btnBuy.textContent = `PEŁNA ENERGIA · ${E.refillPrisms} ◆`;
    btnBuy.classList.toggle('btn-disabled-look', (this.save.prisms || 0) < E.refillPrisms);
  }

  closeEnergySheet() {
    document.getElementById('energySheet').classList.add('hidden');
    this.energySheetOpts = null;
  }

  async energyFromAd() {
    if (this.energyAdBusy) return;
    this.energyAdBusy = true;
    let ok = false;
    try { ok = await this.monetization.rewarded('energy_ad'); } finally { this.energyAdBusy = false; }
    if (!ok) return;
    this.grantEnergy(CONFIG.energy.adGain);
    this.sound.energy();
    this.afterEnergyRefill();
  }

  energyRefillPrisms() {
    const E = CONFIG.energy;
    if ((this.save.prisms || 0) < E.refillPrisms) {
      this.closeEnergySheet();
      this.closeMissionBriefing();
      this.openCurrencyInfo(true);
      return;
    }
    this.save.prisms -= E.refillPrisms;
    this.energyNow();
    this.save.energy.value = Math.max(this.save.energy.value, E.max);
    this.save.energy.lastTick = Date.now();
    saveGame(this.save);
    this.updateEnergyDisplays();
    this.updateCoinDisplays();
    this.sound.energy();
    this.analytics.track('energy_refill', { prisms: E.refillPrisms });
    this.afterEnergyRefill();
  }

  /** After a refill bought from an empty-energy prompt, go straight on
   *  into the play the player asked for. */
  afterEnergyRefill() {
    const onRefill = this.energySheetOpts && this.energySheetOpts.onRefill;
    this.closeEnergySheet();
    if (onRefill) onRefill();
  }

  /* ---------- v15: mission boosters ---------- */

  boostersUnlocked() { return !!this.save.campaign.completed[CONFIG.boosters.unlockMission]; }

  /** The welcome gift when boosters unlock: one of each. */
  checkBoosterGift() {
    const b = this.save.boosters;
    if (b.gift || !this.boostersUnlocked()) return;
    b.gift = true;
    MISSION_BOOSTERS.forEach(x => { b[x.id] = (b[x.id] || 0) + 1; });
    saveGame(this.save);
  }

  toggleBriefingBooster(id) {
    const sel = this.briefingBoosters || (this.briefingBoosters = new Set());
    if (sel.has(id)) sel.delete(id); else sel.add(id);
    this.sound.ui();
    this.refreshBriefingBoosters();
  }

  /** Coins the current booster pick costs (only what's not in stock). */
  briefingBoosterCost() {
    let cost = 0;
    (this.briefingBoosters || new Set()).forEach(id => {
      const b = MISSION_BOOSTERS.find(x => x.id === id);
      if (b && !(this.save.boosters[id] > 0)) cost += b.price;
    });
    return cost;
  }

  refreshBriefingBoosters() {
    const card = document.getElementById('briefingCard');
    const sel = this.briefingBoosters || new Set();
    card.querySelectorAll('[data-booster]').forEach(el => {
      el.classList.toggle('selected', sel.has(el.dataset.booster));
      el.setAttribute('aria-pressed', sel.has(el.dataset.booster) ? 'true' : 'false');
    });
    const cost = this.briefingBoosterCost();
    const btn = card.querySelector('.mc-play[data-mc-launch]');
    if (btn) {
      const def = campaignMissionById(btn.dataset.mcLaunch);
      const energy = def && this.energyFreeFor(def.id === 'M00' ? 'tutorial' : 'mission') ? '' : '<span class="mc-play-cost"><svg class="inline-bolt" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>1</span>';
      btn.innerHTML = `GRAJ${cost ? ` <span class="mc-play-cost">−${cost} ◇</span>` : ''}${energy}<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7V5z"/></svg>`;
    }
    const note = card.querySelector('.mc-boost-note');
    if (note) {
      const short = cost > this.save.coins;
      const miss = cost - this.save.coins;
      note.textContent = short ? `Brakuje ${miss} ${plural(miss, ['monety', 'monet', 'monet'])} na wybrane wzmocnienia.` : (sel.size ? 'Wybrane wzmocnienia zużyjesz w tej próbie — także jeśli się nie uda.' : 'Wzmocnienia są opcjonalne — dotknij, aby wybrać.');
      note.classList.toggle('warn', short);
    }
  }

  /** Briefing GRAJ: pay for the picked boosters (stock first, then coins),
   *  charge one energy and start the mission. */
  launchMission(id) {
    const def = campaignMissionById(id);
    if (!def || !this.isMissionPlayable(id)) return;
    const sel = Array.from(this.briefingBoosters || []);
    const cost = this.briefingBoosterCost();
    if (cost > this.save.coins) {
      this.refreshBriefingBoosters();
      this.sound.hurt();
      return;
    }
    this.requireEnergy(id === 'M00' ? 'tutorial' : 'mission', charged => {
      sel.forEach(bid => {
        if (this.save.boosters[bid] > 0) this.save.boosters[bid]--;
        else this.save.coins -= MISSION_BOOSTERS.find(x => x.id === bid).price;
      });
      if (sel.length) this.analytics.track('booster_use', { missionId: id, boosters: sel.join(','), coins: cost });
      saveGame(this.save);
      this.missionBoosters = sel;
      this.briefingBoosters = new Set();
      this.closeMissionBriefing();
      this.startCampaignMission(id);
      if (this.mission) this.mission.energyCharged = charged;
    });
  }

  /** Can this booster help in this mission? (Tarcza needs a hazard.) */
  boosterUseful(id, def) {
    if (id !== 'shield' || !def) return true;
    const s = def.setup || {};
    return !!(s.bots || s.glitch || s.racer);
  }

  boosterTilesHtml(def) {
    const sel = this.briefingBoosters || new Set();
    const tiles = MISSION_BOOSTERS.map(b => {
      const have = this.save.boosters[b.id] || 0;
      if (!this.boosterUseful(b.id, def)) {
        return `<button type="button" class="mc-boost off" disabled style="--b-color:${b.color}" aria-label="${b.name}: brak zagrożeń w tej misji">` +
          `<span class="mc-boost-icon"><svg viewBox="0 0 24 24">${CARD_ICONS[b.icon]}</svg></span>` +
          `<span class="mc-boost-name">${b.name}</span><span class="mc-boost-short">brak zagrożeń</span>` +
          `<span class="mc-boost-badge${have ? ' owned' : ''}">${have ? `×${have}` : `${b.price} ◇`}</span></button>`;
      }
      return `<button type="button" class="mc-boost${sel.has(b.id) ? ' selected' : ''}" data-booster="${b.id}" style="--b-color:${b.color}" aria-pressed="${sel.has(b.id)}" aria-label="${b.name}: ${b.desc}">` +
        `<span class="mc-boost-icon"><svg viewBox="0 0 24 24">${CARD_ICONS[b.icon]}</svg></span>` +
        `<span class="mc-boost-name">${b.name}</span><span class="mc-boost-short">${b.short}</span>` +
        `<span class="mc-boost-badge${have ? ' owned' : ''}">${have ? `×${have}` : `${b.price} ◇`}</span></button>`;
    }).join('');
    return `<div class="mc-label">WZMOCNIENIA</div><div class="mc-boosts">${tiles}</div><p class="mc-boost-note"></p>`;
  }

  /* ---------- v15: the tap-to-start card ---------- */

  showMissionStartCard(def) {
    this.introPending = true;
    const district = DISTRICTS.find(d => d.id === def.district);
    const D = DIFFICULTY[def.diff || 1];
    const card = document.getElementById('missionStartCard');
    card.style.setProperty('--d-color', DISTRICT_COLORS[def.district] || '#50F0FA');
    const rows = this.missionStepRows(def).map((r, i) =>
      `<li class="mc-goal"><span class="mc-goal-num">${i + 1}</span><span class="mc-goal-icon" style="color:${r.color}"><svg viewBox="0 0 24 24">${r.icon}</svg></span><span class="mc-goal-text">${r.label}</span></li>`).join('');
    const twists = (def.twists || []).map(t => `<span class="mc-twist" style="--t-color:${TWIST_INFO[t].color}"><svg viewBox="0 0 24 24">${GOAL_ICONS[t] || GOAL_ICONS.runner}</svg>${TWIST_INFO[t].label}</span>`).join('');
    const boosts = (this.mission.boosters || []).map(id => { const b = MISSION_BOOSTERS.find(x => x.id === id); return `<span class="mc-twist boost" style="--t-color:${b.color}"><svg viewBox="0 0 24 24">${CARD_ICONS[b.icon]}</svg>${b.name.toUpperCase()}</span>`; }).join('');
    card.innerHTML = `<div class="mc-head"><span class="mc-code">${missionCode(def)}</span><span class="mc-eyebrow">${district.name.toUpperCase()}</span>` +
      `<span class="mc-diff" style="--diff-color:${D.color}">${this.diffBarsHtml(def.diff)}${D.label}</span></div>` +
      `<h3 class="mc-name">${def.name}</h3>` +
      `<div class="nela-bubble mc-nela"><span class="nela-avatar" aria-hidden="true">${NELA_AVATAR}</span><span class="nela-bubble-body"><span class="nela-name">NELA</span><span class="nela-line">${def.nela.start}</span></span></div>` +
      `<ol class="mc-goals">${rows}</ol>` +
      (twists || boosts ? `<div class="mc-twists">${twists}${boosts}</div>` : '') +
      ((def.twists || []).length ? `<ul class="mc-twist-hints">${def.twists.map(t => `<li>${TWIST_INFO[t].hint}</li>`).join('')}</ul>` : '') +
      `<div class="start-meta"><span><svg class="inline-bolt" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg> ${formatClock(def.timeLimit + (this.mission.bonusTime || 0))}</span><span class="start-stars">${(def.stars || []).slice(1).map((st, i) => `${'★'.repeat(i + 2)} ${this.starShortLabel(st)}`).join(' · ')}</span></div>` +
      `<button id="btnMissionGo" class="btn btn-primary btn-mega">START<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7V5z"/></svg></button>` +
      `<p class="start-tap">Zegar ruszy po dotknięciu</p>` +
      `<button type="button" class="btn btn-link start-back" id="btnMissionBack">Zmień wzmocnienia</button>`;
    document.getElementById('missionStartOverlay').classList.remove('hidden');
    this.sound.nela();
  }

  /** v15 review: back out of the start card before the clock runs -- the
   *  energy and the boosters come back (as stock) and the briefing opens. */
  cancelMissionStart() {
    const m = this.mission;
    if (!m || m.ended || !this.introPending) return;
    if (this.paused) { this.paused = false; this.sound.setDucked(false); }
    document.getElementById('pauseSheet').classList.add('hidden');
    m.boosters.forEach(id => { this.save.boosters[id] = (this.save.boosters[id] || 0) + 1; });
    if (m.energyCharged) this.grantEnergy(1, true);
    this.save.campaign.attempts[m.def.id] = Math.max(0, (this.save.campaign.attempts[m.def.id] || 1) - 1);
    m.ended = true;
    this.running = false;
    this.introPending = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.monetization.gameplayStop();
    document.getElementById('missionStartOverlay').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    saveGame(this.save);
    this.state = GameState.MENU;
    this.selectedDistrictId = m.def.district;
    this.openCampaignScreen();
    this.openMissionBriefing(m.def.id);
    this.analytics.track('mission_back', { missionId: m.def.id });
  }

  /** Tap on the start card: the clock starts now. */
  beginMissionPlay() {
    const el = document.getElementById('missionStartOverlay');
    if (el.classList.contains('hidden')) return;
    // Paused (Esc / tab hidden) while the card was up: resume properly.
    if (this.paused) this.resumeGame();
    el.classList.add('hidden');
    this.introPending = false;
    this.pointerScreen = null;
    this.lastTime = performance.now();
    this.showBanner('START!', this.mission ? this.mission.def.name : '', '#46D99A', 0.9, 3);
    this.sound.go();
    this.showNowPlaying();
    this.analytics.track('mission_go', { missionId: this.mission && this.mission.def.id });
  }

  /** Short label of a star condition ("1:05", "bez zderzeń", "combo ×8"). */
  starShortLabel(st) {
    switch (st.type) {
      case 'timeUnder': return formatClock(st.seconds);
      case 'noBotHit': return 'bez zderzeń';
      case 'comboAtLeast': return `combo ×${st.count}`;
      case 'pylonsUnbroken': return 'combo przy pylonach';
      case 'visitBothClusters': case 'bothRoutesUsed': return 'obie strony';
      default: return st.label.toLowerCase();
    }
  }

  diffBarsHtml(diff) {
    return `<span class="diff-bars" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= diff ? 'on' : ''}"></i>`).join('')}</span>`;
  }

  starsHtml(bits, cls = '') {
    return `<span class="star-row ${cls}" aria-label="${Game.starCount(bits)} z 3 gwiazdek">${[0, 1, 2].map(i => `<i class="${bits & (1 << i) ? 'on' : ''}">★</i>`).join('')}</span>`;
  }

  closeMissionBriefing() {
    document.getElementById('missionBriefing').classList.add('hidden');
  }

  /** Rows for the "CEL RUNDY" HUD section: one per goal shape, two for
   *  activateAndDevour (activator progress + the landmark bite itself),
   *  so each row shows its own icon/label/progress instead of one
   *  combined string+number that only ever describes half the goal. */
  campaignGoalItems() {
    const m = this.mission;
    const g = m.def.goal;
    // Computed straight from primitives (eatenByType/eatenByGlyph,
    // gatesPassed, bestCombo) rather than m.progress/m.progressTarget --
    // those mirror checkCampaignGoal()'s LAST run, which hasn't happened
    // yet the first time updateCampaignHUD() renders a fresh mission.
    switch (g.type) {
      case 'objectives':
        return g.steps.map(st => {
          const [progress, target] = this.objectiveProgress(st);
          const iconDef = this.objectiveIconDef(st, m.def.setup);
          const display = st.tier ? `T${Math.min(progress, target)}/T${target}`
            : st.score ? `${Math.min(progress, target)}/${target}` : null;
          return { ...iconDef, label: st.label, progress, target, display, done: progress >= target };
        });
      case 'eatCount': {
        const progress = m.goalGlyph ? (m.eatenByGlyph[m.goalGlyph] || 0) : (m.eatenByType[g.entityType] || 0);
        return [{ ...this.campaignGoalIcon(g.entityType), label: g.label, progress, target: g.count }];
      }
      case 'comboChain':
        return [{ ...this.campaignGoalIcon('combo'), label: g.label, progress: m.bestCombo, target: g.count }];
      case 'gatesPassed':
        return [{ ...this.campaignGoalIcon('gate'), label: g.label, progress: m.gatesPassed.size, target: g.count }];
      case 'activateAndDevour': {
        const activated = g.activator === 'node' ? m.nodesDisabled : m.pylonsCharged;
        return [
          { ...this.campaignGoalIcon(g.activator), label: g.activatorLabel || g.label, progress: Math.min(activated, g.count), target: g.count },
          { ...this.campaignGoalIcon('landmark'), label: g.landmarkLabel || 'Pochłoń cel', progress: (m.landmark && m.landmark.consumed) ? 1 : 0, target: 1 }
        ];
      }
      // M00's tutorial: one row per step (an entity-count step, or the
      // "eat a smaller rival" step, which has no CampaignEntity type so it
      // gets its own fixed icon/color instead of routing through
      // campaignGoalIcon()).
      // v13: only the steps already done plus the current one -- one step
      // at a time, like the step windows (the full list of four up front
      // read as homework).
      case 'tutorialChecklist':
        return g.steps.slice(0, this.tutorialCurrentStep() + 1).map(step => {
          const progress = step.type === 'eatRival' ? m.rivalsEaten : (m.eatenByType[step.entityType] || 0);
          const iconDef = step.type === 'eatRival' ? { icon: CARD_ICONS.target, color: '#ff3860' } : this.campaignGoalIcon(step.entityType);
          return { ...iconDef, label: step.label, progress: Math.min(progress, step.count), target: step.count };
        });
      default:
        return [];
    }
  }

  /** Which campaign entity type(s) the *current* mission goal is about --
   *  used to visually tie board objects to the goal text (player feedback:
   *  elements on the board should make it obvious what to look for). */
  campaignGoalEntityTypes() {
    const g = this.mission.def.goal;
    const types = new Set();
    if (g.type === 'eatCount') types.add(g.entityType);
    if (g.type === 'gatesPassed') types.add('gate');
    if (g.type === 'activateAndDevour') { types.add(g.activator); types.add('landmark'); }
    if (g.type === 'tutorialChecklist') { const st = g.steps[this.tutorialCurrentStep()]; if (st && st.entityType) types.add(st.entityType); }
    if (g.type === 'objectives') {
      for (const st of g.steps) {
        if (st.eat) types.add(st.eat);
        if (st.activate) types.add(st.activate);
        if (st.landmark) types.add('landmark');
        if (st.gates) types.add('gate');
      }
    }
    return types;
  }

  /* ---- Hub campaign map / mission select ---- */

  openCampaignScreen() {
    this.renderCampaignMap();
    this.showScreen('campaignScreen');
  }

  renderCampaignMap() {
    const wrap = document.getElementById('districtMap');
    wrap.innerHTML = '';
    DISTRICTS.forEach(d => {
      const unlocked = this.save.campaign.unlockedDistricts.includes(d.id);
      const node = document.createElement('button');
      // A little skyline per district (drawDistrictTile()) that lights up
      // as its missions clear, with its boss landmark in front -- player
      // feedback: the districts should be visualised to pull you in.
      node.className = 'district-node district-tile' + (unlocked ? '' : ' locked');
      node.style.setProperty('--district-color', DISTRICT_COLORS[d.id] || '#50F0FA');
      const doneCount = d.missions.filter(id => this.save.campaign.completed[id]).length;
      const isNew = unlocked && this.isUnlockFresh('district:' + d.id);
      node.classList.toggle('is-new', isNew);
      const pctDone = Math.round(doneCount / d.missions.length * 100);
      node.innerHTML = `<canvas class="district-tile-canvas" data-district="${d.id}"></canvas>` +
        `<span class="district-tile-info"><span class="district-node-name">${d.name}</span>` +
        `<span class="district-node-status">${isNew ? 'NOWA' : (unlocked ? (doneCount === d.missions.length ? '✓ ODBUDOWANA' : `${doneCount}/${d.missions.length} misji`) : 'ZABLOKOWANA')}</span>` +
        `<span class="district-tile-bar"><span style="width:${unlocked ? pctDone : 0}%"></span></span></span>`;
      node.addEventListener('click', () => unlocked ? this.selectCampaignDistrict(d.id) : this.openLockedDistrictInfo(d));
      wrap.appendChild(node);
    });
    const playableUnlocked = DISTRICTS.filter(d => this.save.campaign.unlockedDistricts.includes(d.id));
    const remembered = this.selectedDistrictId && playableUnlocked.find(d => d.id === this.selectedDistrictId);
    this.selectCampaignDistrict(remembered ? this.selectedDistrictId : playableUnlocked[0].id);
  }

  openLockedDistrictInfo(district) {
    const unlocker = CAMPAIGN_MISSIONS.find(m => m.reward && m.reward.unlockDistrict === district.id);
    const unlockerDistrict = unlocker && DISTRICTS.find(d => d.id === unlocker.district);
    this.openInfoSheet({
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>',
      title: 'Dzielnica zablokowana',
      body: [
        `${district.name}: ${nounFor('misja', district.missions.length)} i obiekty, których jeszcze nie znasz.`,
        unlocker
          ? `Odblokujesz ją, kończąc ostatnią misję poprzedniej dzielnicy: <strong>${missionCode(unlocker)} „${unlocker.name}”</strong> (${unlockerDistrict.name}).`
          : 'Odblokujesz ją, kończąc poprzednią dzielnicę.'
      ],
      action: unlocker ? { label: 'DO ODPRAWY: ' + missionCode(unlocker), onClick: () => this.openMissionBriefing(unlocker.id) } : null
    });
  }

  selectCampaignDistrict(districtId) {
    this.selectedDistrictId = districtId;
    if (this.isUnlockFresh('district:' + districtId)) {
      // Re-render the strip so its "NOWA" tag drops right away; the
      // recursive selectCampaignDistrict() call lands on the branch below.
      this.markUnlockVisited('district:' + districtId);
      this.renderBottomNav('campaignScreen');
      this.renderCampaignMap();
      return;
    }
    const nodes = document.querySelectorAll('#districtMap .district-node');
    const districtIdx = DISTRICTS.findIndex(d => d.id === districtId);
    nodes.forEach((el, i) => el.classList.toggle('active', i === districtIdx));

    const district = DISTRICTS.find(d => d.id === districtId);
    // GDD 4.0 §8.4 anti-confusion: this header shows the district's OWN
    // rebuild % (§6 "0/4, 1/4... nie używać wielkiego okręgu Core City"),
    // never the Miasto/Core City percentage.
    const c = this.save.campaign;
    const doneCount = district.missions.filter(id => c.completed[id]).length;
    const rebuildPct = Math.round((doneCount / district.missions.length) * 100);
    const color = DISTRICT_COLORS[district.id] || '#50F0FA';
    document.getElementById('campaignScreen').style.setProperty('--d-color', color);
    document.getElementById('districtTitle').textContent = district.name.toUpperCase();
    const dStars = district.missions.reduce((n, id) => n + Game.starCount(c.stars[id] || 0), 0);
    document.getElementById('districtRebuildLine').textContent = `${doneCount}/${district.missions.length} · ★ ${dStars}/${district.missions.length * 3}`;
    document.getElementById('districtRebuildBar').style.width = rebuildPct + '%';
    document.getElementById('districtStoryText').textContent = DISTRICT_STORY[district.id] || '';

    // v14: the mission to do next is briefed at the top with its own GRAJ
    // (player feedback: starting a level meant scrolling to the bottom).
    const nextId = district.missions.find((id, i) => !this.isMissionDone(id) && (i === 0 || this.isMissionDone(district.missions[i - 1])));
    const nextCard = document.getElementById('missionNextCard');
    if (nextId) {
      const def = campaignMissionById(nextId);
      nextCard.innerHTML = this.missionCardHtml(def, { eyebrow: 'NASTĘPNA MISJA', play: true });
    } else {
      const nextDistrict = DISTRICTS.find(d => d.order === district.order + 1);
      nextCard.innerHTML = `<div class="mc-head"><span class="mc-code">✓</span><span class="mc-eyebrow">DZIELNICA ODBUDOWANA</span></div>` +
        `<h3 class="mc-name">Dzielnica odbudowana!</h3>` +
        `<p class="mc-lock">${nextDistrict ? (c.unlockedDistricts.includes(nextDistrict.id) ? `Ruszaj dalej: ${nextDistrict.name} czeka.` : `Następna: ${nextDistrict.name}.`) : 'Całe Neonowe Miasto odzyskane. Wracaj po medale!'}</p>` +
        (nextDistrict && c.unlockedDistricts.includes(nextDistrict.id) ? `<button class="btn btn-primary mc-play" data-district-go="${nextDistrict.id}">DO DZIELNICY ${nextDistrict.name.toUpperCase()}</button>` : '');
      const go = nextCard.querySelector('[data-district-go]');
      if (go) go.addEventListener('click', () => this.selectCampaignDistrict(go.dataset.districtGo));
    }
    nextCard.style.setProperty('--d-color', color);

    const list = document.getElementById('missionList');
    list.innerHTML = '';
    let starCount = 0;
    // Each row: code, name, its first goal (with icon) and a state icon --
    // a tap opens the mission's briefing (openMissionBriefing()).
    const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>';
    const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7V5z"/></svg>';
    const LOCK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>';
    district.missions.forEach((id, i) => {
      const def = campaignMissionById(id);
      const done = !!c.completed[id];
      const prevDone = i === 0 || c.completed[district.missions[i - 1]];
      const bits = c.stars[id] || 0;
      starCount += Game.starCount(bits);
      const first = this.missionStepRows(def)[0];
      const D = DIFFICULTY[def.diff || 1];
      const row = document.createElement('button');
      row.className = 'mission-row' + (done ? ' done' : '') + (!prevDone ? ' locked' : '') + (id === nextId ? ' current' : '');
      const icon = done ? CHECK_ICON : (prevDone ? PLAY_ICON : LOCK_ICON);
      row.innerHTML = `<span class="mission-row-id">${def.id === 'M00' ? 'START' : missionCode(def)}</span>` +
        `<span class="mission-row-main"><span class="mission-row-name">${def.name}</span>` +
        `<span class="mission-row-goal"><span class="mission-row-goal-icon" style="color:${first.color}"><svg viewBox="0 0 24 24">${first.icon}</svg></span>${first.label}${def.goal.steps && def.goal.steps.length > 1 ? ` <em>+${def.goal.steps.length - 1} ${plural(def.goal.steps.length - 1, ['cel', 'cele', 'celów'])}</em>` : ''}</span></span>` +
        (def.id === 'M00' ? '<span class="mission-row-medal"></span>' : `<span class="mission-row-medal" title="${D.label}">${this.starsHtml(bits, 'mini')}<span class="mission-row-diff" style="--diff-color:${D.color}">${this.diffBarsHtml(def.diff || 1)}</span></span>`) +
        `<span class="mission-row-icon">${icon}</span>`;
      row.addEventListener('click', () => this.openMissionBriefing(id));
      list.appendChild(row);
    });
    document.getElementById('missionMedalsFootnote').textContent = `GWIAZDKI ${starCount}/${district.missions.length * 3}`;
    this.selectedMissionId = nextId || district.missions[0];
  }

  /* ---- Mission build/spawn ---- */

  buildCampaignMission(def) {
    this.campaignEntities = [];
    this.campaignSpawn = null;
    const s = def.setup;
    const b = CONFIG.campaign.bounds;
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;

    // v10: entities never spawn on top of the start point, the landmark
    // plinth or each other's centers -- a mission must not open with an
    // object already inside the hole or a big one hidden under another.
    const taken = [];
    const free = (x, y, r) => taken.every(t => dist(x, y, t.x, t.y) > (t.r + r) * 0.9);
    const place = (r, area) => {
      for (let tries = 0; tries < 30; tries++) {
        const p = area ? area() : this.randomInCampaignBounds(Math.max(40, r + 10));
        if (free(p.x, p.y, r)) { taken.push({ x: p.x, y: p.y, r }); return p; }
      }
      const p = area ? area() : this.randomInCampaignBounds(Math.max(40, r + 10));
      taken.push({ x: p.x, y: p.y, r });
      return p;
    };
    const addMany = (type, count, area, extra) => {
      const r = CONFIG.campaign.entityRadius[type];
      for (let i = 0; i < count; i++) {
        const p = place(r, area ? () => area(i) : null);
        const opts = typeof extra === 'function' ? extra(i) : extra;
        this.campaignEntities.push(new CampaignEntity(type, p.x, p.y, opts));
      }
    };
    const leftHalf = () => ({ x: rand(b.minX + 60, cx - 100), y: rand(b.minY + 60, b.maxY - 60) });
    const rightHalf = () => ({ x: rand(cx + 100, b.maxX - 60), y: rand(b.minY + 60, b.maxY - 60) });

    // Reserve the landmark plinth and the player's start first.
    if (s.landmark) taken.push({ x: cx, y: cy, r: CONFIG.campaign.landmarkByTier[LANDMARK_TIERS[s.landmark] || 4].radius + 40 });
    // (Portal missions start beside -- not on -- the portal, which used to
    // teleport the player on the very first frame.)
    if (s.gateKind === 'portal') this.campaignSpawn = { x: b.minX + 140, y: cy + 230 };
    else if (s.arcLayout) this.campaignSpawn = { x: cx - 290, y: cy };
    else if (s.landmark) this.campaignSpawn = { x: cx, y: b.maxY - 120 };
    const start = this.campaignSpawn || { x: cx, y: cy + 260 };
    this.campaignSpawn = start;
    taken.push({ x: start.x, y: start.y, r: 70 });

    if (s.arcLayout) {
      // Fragments laid along a loop so a fast, close-quarters combo chain
      // is reachable.
      const radius = 260;
      const count = s.fragments || 20;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 1.7 - Math.PI * 0.85;
        this.campaignEntities.push(new CampaignEntity('fragment', cx + Math.cos(a) * radius, cy + Math.sin(a) * radius));
      }
    } else if (s.fragments) {
      const ring = Math.min(s.starterRing || 0, s.fragments);
      for (let i = 0; i < ring; i++) {
        const a = i * 2.4 - 1.2, rr = 60 + i * 12;
        this.campaignEntities.push(new CampaignEntity('fragment', clamp(start.x + Math.cos(a) * rr, b.minX + 40, b.maxX - 40), clamp(start.y + Math.sin(a) * rr, b.minY + 40, b.maxY - 40)));
      }
      addMany('fragment', s.fragments - ring);
    }
    // Tight pockets of fragments for combo goals (see compileMission()).
    // v15: pockets sit away from the start (a pocket next to it made a
    // combo goal a 3-second formality).
    const awayFromStart = (pad) => () => {
      let q;
      for (let k = 0; k < 16; k++) { q = this.randomInCampaignBounds(pad); if (dist(q.x, q.y, start.x, start.y) > 380) break; }
      return q;
    };
    for (let c = 0; c < (s.fragmentClusters || 0); c++) {
      const center = place(110, awayFromStart(130));
      for (let i = 0; i < (s.clusterSize || 10); i++) {
        const a = i * 2.4, rr = 22 + 10 * Math.sqrt(i);
        this.campaignEntities.push(new CampaignEntity('fragment',
          clamp(center.x + Math.cos(a) * rr, b.minX + 40, b.maxX - 40), clamp(center.y + Math.sin(a) * rr, b.minY + 40, b.maxY - 40)));
      }
    }

    const glyphOr = (key, fallback) => () => ({ glyph: s[key] || fallback() });
    if (s.props && s.clusters) {
      const half = Math.ceil(s.props / 2);
      addMany('prop', half, leftHalf, () => ({ cluster: 'A', glyph: s.propGlyph || randomStreetGlyph() }));
      addMany('prop', s.props - half, rightHalf, () => ({ cluster: 'B', glyph: s.propGlyph || randomStreetGlyph() }));
    } else if (s.props) {
      addMany('prop', s.props, null, glyphOr('propGlyph', randomStreetGlyph));
    }
    if (s.vehicles) addMany('vehicle', s.vehicles, null, s.vehicleGlyph ? { glyph: s.vehicleGlyph } : null);
    if (s.capsules) addMany('capsule', s.capsules);
    if (s.capsuleWaves) {
      // Each wave lands as one tight group -- a "wave" to sweep up in a
      // single combo, not capsules scattered across the whole map.
      s.capsuleWaves.forEach(waveStart => {
        const center = place(120);
        const n = s.capsulesPerWave || 8;
        for (let i = 0; i < n; i++) {
          const a = i * 2.4, rr = 30 + 14 * Math.sqrt(i);
          this.campaignEntities.push(new CampaignEntity('capsule',
            clamp(center.x + Math.cos(a) * rr, b.minX + 40, b.maxX - 40), clamp(center.y + Math.sin(a) * rr, b.minY + 40, b.maxY - 40), { spawnAt: waveStart }));
        }
      });
    }
    const pickFrom = list => () => list[randInt(0, list.length - 1)];
    if (s.structures) addMany('structure', s.structures, null, glyphOr('structureGlyph', pickFrom(TIERS.structure.subtypes)));
    if (s.heavies) addMany('heavy', s.heavies, null, glyphOr('heavyGlyph', pickFrom(TIERS.heavy.subtypes)));
    if (s.towers) addMany('tower', s.towers, null, glyphOr('towerGlyph', pickFrom(TIERS.tower.subtypes)));
    // v15: golden bytes start away from the hole (they flee anyway).
    if (s.runners) addMany('runner', s.runners, () => {
      let p;
      for (let k = 0; k < 12; k++) { p = this.randomInCampaignBounds(60); if (dist(p.x, p.y, start.x, start.y) > 380) break; }
      return p;
    }, () => ({ glyph: 'bajt', wa: rand(0, Math.PI * 2) }));
    // v15: glitch zones drift across the board; none opens on the start.
    this.glitchZones = [];
    const G = CONFIG.campaign.glitch;
    for (let i = 0; i < (s.glitch || 0); i++) {
      const r = rand(G.minRadius, G.maxRadius);
      let p;
      for (let k = 0; k < 20; k++) { p = this.randomInCampaignBounds(r + 20); if (dist(p.x, p.y, start.x, start.y) > r + 240) break; }
      const a = rand(0, Math.PI * 2);
      this.glitchZones.push({ x: p.x, y: p.y, r, vx: Math.cos(a) * G.speed, vy: Math.sin(a) * G.speed, seed: rand(0, 100) });
    }

    if (s.markers) {
      const glyph = s.markerGlyph;
      if (s.gateKind === 'portal') {
        // Portal twist: the goal objects live only on the far side.
        addMany('marker', s.markers, () => ({ x: rand(cx + 140, b.maxX - 60), y: rand(b.minY + 60, b.maxY - 60) }), { glyph });
      } else {
        const half = Math.ceil(s.markers / 2);
        addMany('marker', half, leftHalf, { route: 'A', glyph });
        addMany('marker', s.markers - half, rightHalf, { route: 'B', glyph });
      }
    }

    if (s.gates) {
      if (s.gateKind === 'portal') {
        // One fixed, one-way, single-use teleporter near the start.
        const near = { x: b.minX + 140, y: cy };
        const far = { x: b.maxX - 140, y: cy };
        this.campaignEntities.push(new CampaignEntity('gate', near.x, near.y, {
          glyph: 'portal', phase: 0, portalAnchors: [near, far]
        }));
      } else {
        for (let i = 0; i < s.gates; i++) {
          const t = (i + 1) / (s.gates + 1);
          const gx = lerp(b.minX + 80, b.maxX - 80, t);
          const spacing = (b.maxX - b.minX - 160) / (s.gates + 1);
          const opts = s.gateKind === 'pas'
            ? { glyph: 'pas_przelotu', zoneHalfWidth: Math.min(90, Math.round(spacing * 0.3)), phase: rand(0, CONFIG.campaign.gate.cycleSeconds) }
            : { phase: rand(0, CONFIG.campaign.gate.cycleSeconds) };
          this.campaignEntities.push(new CampaignEntity('gate', gx, cy, opts));
        }
      }
    }

    if (s.nodes) addMany('node', s.nodes, null, { glyph: s.nodeGlyph || 'wezel' });
    if (s.pylons) {
      const glyph = s.pylonGlyph || 'pylon';
      for (let i = 0; i < s.pylons; i++) {
        const a = (i / s.pylons) * Math.PI * 2;
        const ring = s.landmark ? 230 : 180;
        this.campaignEntities.push(new CampaignEntity('pylon', cx + Math.cos(a) * ring, cy + Math.sin(a) * ring, { glyph }));
      }
    }
    if (s.landmark) {
      // A landmark with no activation step starts unlocked (a direct big eat).
      const landmark = new CampaignEntity('landmark', cx, cy, {
        landmarkId: s.landmark,
        unlocked: !def.goal.activator
      });
      this.campaignEntities.push(landmark);
      this.mission.landmark = landmark;
    }
  }

  startCampaignMission(missionId) {
    const def = campaignMissionById(missionId || this.selectedMissionId);
    if (!def) return;
    this.hideReviveOffer();
    this.mode = 'campaign';
    this.hideAllOverlays();
    clearTimeout(this.hintTimer);
    document.getElementById('mobile-hint').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('hud-topright').classList.add('hidden');
    document.getElementById('hud-goal').classList.remove('hidden');
    document.getElementById('hud-tier-strip').classList.remove('hidden');
    // Arena reserves extra right-side clearance in the tier strip for its
    // (wider) standings panel -- not needed here since CEL RUNDY's box is
    // narrower and it's what the strip's default spacing was tuned for.
    document.getElementById('hud-tier-strip').classList.remove('clears-standings');
    this.state = GameState.MATCH_SETUP;
    this.paused = false;

    this.runId = generateId('run');
    this.runSeed = generateSeed();
    this.rng = new SeededRNG(this.runSeed);

    this.player = new Hole(this.playerDisplayName(), 0, 0, true);
    this.player.skin = this.save.selected;
    this.player.auraId = this.save.auras.selected;
    this.player.radius = CONFIG.campaign.baseRadius;

    this.objects = [];
    this.particles = [];
    this.ripples = [];
    this.swallowGhosts = [];
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.comboTimer = 0;
    this.comboWindowOverride = CONFIG.campaign.comboWindowSeconds;
    this.comboDisplayAlpha = 0;

    this.activeMutations = new Set();
    this.evolutionPending = false;
    this.introPending = false;
    clearTimeout(this.evolutionAutoPickTimer);
    this.speedBoostUntil = 0;
    this.scannerTimer = 0;
    this.scannerTarget = null;
    this.shake = 0;

    this.mission = {
      def,
      elapsed: 0,
      timeRemaining: def.timeLimit,
      growthUnits: 0,
      tierId: 'T1',
      progress: 0,
      progressTarget: 1,
      nodesDisabled: 0,
      pylonsCharged: 0,
      rivalsEaten: 0,
      gatesPassed: new Set(),
      markersRoutes: new Set(),
      clustersVisited: new Set(),
      eatenByType: {},
      eatenByGlyph: {},
      bestCombo: 0,
      comboBroken: false,
      pylonPhaseStarted: false,
      pylonPhaseDone: false,
      pylonComboBroken: false,
      maxComboDuringCapsule: 0,
      botHitCount: 0,
      landmark: null,
      evolutionOffered: false,
      ended: false,
      // Set the instant the goal is met, before the success-pause timeout
      // actually calls endCampaignMission() -- see beginMissionSuccess().
      finishing: false,
      _wasComboActive: false,
      // M00's step-by-step guidance (see updateTutorialGuidance()) --
      // harmless no-ops for every other goal type.
      tutorialStepDone: def.goal.type === 'tutorialChecklist' ? def.goal.steps.map(() => false) : [],
      tutorialRivalHintShown: false,
      // v15: twists + boosters.
      failReason: null,
      racerCount: 0,
      glitchHits: 0,
      shields: 0,
      boosters: []
    };

    this.buildCampaignMission(def);
    this.mission.goalGlyph = this.computeCampaignGoalGlyph();
    this.save.campaign.attempts[def.id] = (this.save.campaign.attempts[def.id] || 0) + 1;

    if (this.campaignSpawn) {
      this.player.x = this.campaignSpawn.x;
      this.player.y = this.campaignSpawn.y;
    } else {
      const start = this.randomInCampaignBounds(60);
      this.player.x = start.x;
      this.player.y = start.y;
    }

    this.bots = [];
    // v15: rivals never spawn on top of the start (hunters would open the
    // mission with a hit).
    const farSpot = (pad, minD) => {
      let p;
      for (let k = 0; k < 20; k++) { p = this.randomInCampaignBounds(pad); if (dist(p.x, p.y, this.player.x, this.player.y) > minD) break; }
      return p;
    };
    for (let i = 0; i < (def.setup.bots || 0); i++) {
      const p = farSpot(150, def.setup.hunters ? 520 : 260);
      const bot = new Bot(BOT_NAME_POOL[i], p.x, p.y);
      bot.radius = def.setup.botRadius || CONFIG.campaign.rivalRadius;
      bot.styleOverride = BOT_STYLES[i % BOT_STYLES.length];
      // Only the first `hunters` rivals hunt; the rest roam as before.
      bot.hunter = i < (def.setup.hunters || 0);
      this.bots.push(bot);
    }
    if (def.setup.racer) {
      const p = farSpot(120, 420);
      const racer = new Bot('Złodziej', p.x, p.y);
      racer.radius = CONFIG.campaign.racer.radius;
      racer.styleOverride = 'sun';
      racer.edgeColor = '#EFCB63';
      racer.racer = true;
      this.bots.push(racer);
      this.racer = racer;
    } else {
      this.racer = null;
    }

    // v15 boosters picked in the briefing (consumed by launchMission()).
    const boosters = (this.missionBoosters || []).filter(id => MISSION_BOOSTERS.some(b => b.id === id));
    this.missionBoosters = [];
    this.mission.boosters = boosters;
    if (boosters.includes('time')) this.mission.bonusTime = CONFIG.boosters.timeBonus;
    if (boosters.includes('shield')) this.mission.shields = CONFIG.boosters.shieldHits;
    if (boosters.includes('magnet')) this.activeMutations.add('magnes');
    if (boosters.includes('start')) {
      this.mission.growthUnits = Math.max(this.mission.growthUnits, tierUnits(2));
      this.syncCampaignRadius();
      this.mission.tierId = this.campaignPlayerTier().id;
    }
    this.mission.timeRemaining = def.timeLimit + (this.mission.bonusTime || 0);

    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    // Campaign keeps its fixed 1:1 framing (camera is clamped to the
    // mission box); only Arena zooms out with growth. Skin perks are
    // Arena/Daily-only too -- missions are hand-balanced.
    this.zoom = 1;
    this.activePerks = [];
    this.floatTexts = [];
    this.banner = null;
    this.bannerQueue = [];
    this.lastCountdownSec = null;
    this.scorePop = null;
    this.flashAlpha = 0;
    this.hitStopUntil = 0;
    this.prewarmFloor();
    // v16: the district's own theme (a boss mission opens on its drop);
    // it stays calm under the start card until START brings the drums in.
    const musicDistrict = DISTRICTS.find(d => d.id === def.district);
    this.sound.setScene('campaign', { district: def.district, boss: !!musicDistrict && musicDistrict.missions[musicDistrict.missions.length - 1] === def.id && def.id !== 'M00' });

    this.pointerScreen = null; // no steering until the first touch/mouse move
    this.running = true;
    this.monetization.gameplayStart();
    this.state = GameState.PLAYING;
    // v15: every mission waits on a tap (owner: "rozpoczęcie levelu powinno
    // być na kliknięcie, aby gracz miał czas przeczytać komunikat") -- the
    // start card holds NELA's line and the goals until the player is ready.
    if (def.goal.type === 'tutorialChecklist') this.showTutorialStepIntro(0);
    else this.showMissionStartCard(def);
    // v14: the goal box flashes in once, so the first glance lands on it.
    const goalBox = document.getElementById('hud-goal');
    goalBox.classList.remove('goal-intro');
    void goalBox.offsetWidth;
    goalBox.classList.add('goal-intro');
    this.updateCampaignHUD();
    this.analytics.track('mission_start', { missionId: def.id, district: def.district });

    this.lastTime = performance.now();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  /* ---- Mission update loop ---- */

  updateCampaignBot(bot, dt) {
    if (bot.racer) { this.updateRacerBot(bot, dt); return; }
    bot.tempSpeedMult = 1;
    bot.hunting = false;
    if (bot.hunter) {
      // v15 Łowcy: a bigger rival chases the player in bursts (then rests,
      // so it can be outrun); once outgrown it runs away instead.
      const H = CONFIG.campaign.hunter, p = this.player;
      const d = dist(bot.x, bot.y, p.x, p.y);
      if (bot.restT > 0) bot.restT -= dt;
      else if (bot.radius > p.radius * EAT_HOLE_RATIO && d < H.range && !p.invulnerable) {
        bot.chaseT = (bot.chaseT || 0) + dt;
        if (bot.chaseT > H.chaseSeconds) { bot.chaseT = 0; bot.restT = H.restSeconds; }
        bot.hunting = true;
        bot.tempSpeedMult = H.speedMult;
        bot.moveToward(p.x, p.y, dt);
        return;
      } else if (p.radius > bot.radius * EAT_HOLE_RATIO && d < 240) {
        bot.tempSpeedMult = 0.8;
        bot.moveToward(bot.x + (bot.x - p.x) / (d || 1) * 200, bot.y + (bot.y - p.y) / (d || 1) * 200, dt);
        return;
      }
      bot.chaseT = Math.max(0, (bot.chaseT || 0) - dt);
    }
    if (!bot.wanderTarget || dist(bot.x, bot.y, bot.wanderTarget.x, bot.wanderTarget.y) < 40) {
      bot.wanderTarget = this.randomInCampaignBounds(80);
    }
    bot.moveToward(bot.wanderTarget.x, bot.wanderTarget.y, dt);
  }

  /** v15 Złodziej: races the player for the first eat goal's objects, and
   *  runs from the player once it can be eaten. */
  /** The player's own tally on the race goal (swallows in progress count). */
  raceMine() {
    const m = this.mission, s = m.def.setup;
    const step = m.def.goal.steps.find(st => st.eat === s.raceType && (st.glyph || null) === s.raceGlyph) || { eat: s.raceType, n: s.raceTarget };
    const inMouth = this.campaignEntities.filter(x => x.eating && !x.consumed && x.eater === this.player && x.type === s.raceType && (!s.raceGlyph || x.glyph === s.raceGlyph)).length;
    return this.objectiveProgress(step)[0] + inMouth;
  }

  isRaceTarget(e) {
    const s = this.mission.def.setup;
    return e.type === s.raceType && (!s.raceGlyph || e.glyph === s.raceGlyph) && e.live && !e.eating && !e.consumed;
  }

  updateRacerBot(bot, dt) {
    const R = CONFIG.campaign.racer, p = this.player, m = this.mission;
    bot.tempSpeedMult = R.speedBase + R.speedPerDiff * (m.def.diff || 1);
    const d = dist(bot.x, bot.y, p.x, p.y);
    // A fair race: the thief starts once the hole can eat what it steals.
    // Race already won by the player: the thief just roams.
    if (m.raceWon || (m.raceStarted && this.raceMine() >= m.def.setup.raceTarget)) {
      m.raceWon = true;
      bot.tempSpeedMult = 0.5;
      if (!bot.wanderTarget || dist(bot.x, bot.y, bot.wanderTarget.x, bot.wanderTarget.y) < 40) bot.wanderTarget = this.randomInCampaignBounds(80);
      bot.moveToward(bot.wanderTarget.x, bot.wanderTarget.y, dt);
      return;
    }
    if (!m.raceStarted) {
      const need = (CAMPAIGN_ENTITY_STATS[m.def.setup.raceType] || { minTier: 1 }).minTier;
      if (this.campaignTierIndex(this.campaignPlayerTier().id) >= need) {
        m.raceStartIn = m.raceStartIn == null ? R.headStart : m.raceStartIn - dt;
        if (m.raceStartIn <= 0) { m.raceStarted = true; this.showBanner('ZŁODZIEJ RUSZA!', 'Zbieraj szybciej niż on', '#EFCB63', 1.2, 3); }
      }
      bot.tempSpeedMult = 0.35;
      if (!bot.wanderTarget || dist(bot.x, bot.y, bot.wanderTarget.x, bot.wanderTarget.y) < 40) bot.wanderTarget = this.randomInCampaignBounds(80);
      bot.moveToward(bot.wanderTarget.x, bot.wanderTarget.y, dt);
      return;
    }
    if (p.radius > bot.radius * EAT_HOLE_RATIO && d < 220) {
      bot.moveToward(bot.x + (bot.x - p.x) / (d || 1) * 200, bot.y + (bot.y - p.y) / (d || 1) * 200, dt);
    } else {
      bot.decisionTimer -= dt;
      if (bot.decisionTimer <= 0 || !bot.raceTarget || !this.isRaceTarget(bot.raceTarget)) {
        bot.decisionTimer = R.decision;
        let best = null, bd = Infinity;
        for (const e of this.campaignEntities) {
          if (!this.isRaceTarget(e)) continue;
          const de = dist(bot.x, bot.y, e.x, e.y);
          if (de < bd) { bd = de; best = e; }
        }
        bot.raceTarget = best;
      }
      const t = bot.raceTarget;
      if (t) bot.moveToward(t.x, t.y, dt);
      else {
        if (!bot.wanderTarget || dist(bot.x, bot.y, bot.wanderTarget.x, bot.wanderTarget.y) < 40) bot.wanderTarget = this.randomInCampaignBounds(80);
        bot.moveToward(bot.wanderTarget.x, bot.wanderTarget.y, dt);
      }
    }
    // The thief takes what it touches (no size gate -- it steals).
    for (const e of this.campaignEntities) {
      if (!this.isRaceTarget(e)) continue;
      if (dist(bot.x, bot.y, e.x, e.y) < bot.radius * 0.9 + e.radius * 0.4) e.startEating(bot);
    }
  }

  /** A goal object the thief swallowed: its point, not the player's. */
  resolveRacerEat(e) {
    const m = this.mission;
    m.racerCount++;
    this.spawnParticles(e.x, e.y, '#EFCB63', 10);
    this.addFloatText(e.x, e.y - 20, 'ZŁODZIEJ +1', '#EFCB63', 14);
    const s = m.def.setup;
    const mine = this.raceMine();
    if (m.raceWon || mine >= s.raceTarget) return;
    const left = this.campaignEntities.filter(x => x.type === s.raceType && (!s.raceGlyph || x.glyph === s.raceGlyph) && !x.consumed && !x.eating).length;
    if (m.racerCount >= s.raceTarget || mine + left < s.raceTarget) this.failCampaignMission('racer');
    else if (m.racerCount === s.raceTarget - 1) this.showBanner('ZŁODZIEJ TUŻ, TUŻ!', 'Brakuje mu jeszcze jednego', '#EFCB63', 1.2, 3);
  }

  /** v15 golden bytes: drift until the hole comes close, then flee at a
   *  bit under the hole's own speed -- a wall or a corner is how you catch
   *  one. */
  updateRunners(dt) {
    const R = CONFIG.campaign.runner, b = CONFIG.campaign.bounds;
    for (const e of this.campaignEntities) {
      if (e.type !== 'runner' || e.consumed || e.eating || !e.live) continue;
      // Flees whichever hole is closer -- the thief too.
      let p = this.player, d = dist(e.x, e.y, p.x, p.y);
      if (this.racer && this.mission.raceStarted) { const dr = dist(e.x, e.y, this.racer.x, this.racer.y); if (dr < d) { p = this.racer; d = dr; } }
      let vx, vy, sp;
      if (d < R.panicRange + p.radius) {
        vx = (e.x - p.x) / (d || 1); vy = (e.y - p.y) / (d || 1);
        // Bias away from the walls so it doesn't hug one forever.
        const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
        vx += (cx - e.x) / 2600; vy += (cy - e.y) / 2600;
        const n = Math.hypot(vx, vy) || 1; vx /= n; vy /= n;
        sp = Math.min(R.speed, p.getSpeed() * 0.78);
      } else {
        e.wa = (e.wa || 0) + (Math.random() - 0.5) * dt * 2;
        vx = Math.cos(e.wa); vy = Math.sin(e.wa); sp = R.wanderSpeed;
      }
      // Never into a corner the (clamped) hole can't reach.
      const mg = Math.max(40, this.player.radius * 0.9);
      e.x = clamp(e.x + vx * sp * dt, b.minX + mg, b.maxX - mg);
      e.y = clamp(e.y + vy * sp * dt, b.minY + mg, b.maxY - mg);
      if (e.x <= b.minX + mg || e.x >= b.maxX - mg) e.wa = Math.PI - (e.wa || 0);
      if (e.y <= b.minY + mg || e.y >= b.maxY - mg) e.wa = -(e.wa || 0);
    }
  }

  /** v15 glitch zones: drift and bounce inside the board; touching one
   *  costs growth like a bigger rival's hit. */
  updateGlitchZones(dt) {
    const zones = this.glitchZones || [];
    if (!zones.length) return;
    const b = CONFIG.campaign.bounds, p = this.player;
    for (const z of zones) {
      z.x += z.vx * dt; z.y += z.vy * dt;
      if (z.x < b.minX + z.r || z.x > b.maxX - z.r) { z.vx = -z.vx; z.x = clamp(z.x, b.minX + z.r, b.maxX - z.r); }
      if (z.y < b.minY + z.r || z.y > b.maxY - z.r) { z.vy = -z.vy; z.y = clamp(z.y, b.minY + z.r, b.maxY - z.r); }
      if (!p.invulnerable && dist(z.x, z.y, p.x, p.y) < z.r + p.radius * 0.3) {
        this.mission.glitchHits++;
        this.campaignHit('glitch', z.x, z.y);
      }
    }
  }

  /** v15: one penalty for every hazard (a bigger rival, a glitch zone):
   *  Tarcza absorbs it, a fragile vortex fails the mission, otherwise it
   *  costs a share of growth and the combo. */
  campaignHit(source, fromX, fromY) {
    const m = this.mission;
    const p = this.player;
    // Counted even when a shield takes it ("bez zderzenia" means none),
    // and the hunter backs off / the hole is knocked out of the zone.
    if (source === 'bot') m.botHitCount++;
    for (const b of this.bots) if (b.hunter && b.hunting) { b.restT = CONFIG.campaign.hunter.afterHitRest; b.chaseT = 0; }
    if (fromX != null) {
      const d = dist(p.x, p.y, fromX, fromY) || 1;
      p.x += (p.x - fromX) / d * 40; p.y += (p.y - fromY) / d * 40;
      this.clampToCampaignBounds(p);
    }
    if (m.shields > 0) {
      m.shields--;
      p.invulnerableUntil = performance.now() + 2200;
      this.ripples.push(new Ripple(p.x, p.y, '#EFCB63', p.radius, p.radius * 2.6, 0.5));
      this.showBanner('TARCZA!', m.shields ? `Zostało osłon: ${m.shields}` : 'Ostatnia osłona zużyta', '#EFCB63', 1.1, 3);
      this.sound.shield();
      this.vibrate(30);
      return;
    }
    if (m.def.setup.fragile) { this.failCampaignMission('hit'); return; }
    const loss = m.growthUnits * CONFIG.campaign.hitPenaltyFraction;
    m.growthUnits = Math.max(0, m.growthUnits - loss);
    this.syncCampaignRadius();
    this.comboCount = 0; this.comboMultiplier = 1; this.comboTimer = 0;
    p.invulnerableUntil = performance.now() + (source === 'glitch' ? CONFIG.campaign.glitch.hitInvulnMs : CONFIG.campaign.hitInvulnMs);
    this.sound.hurt();
    this.triggerShake(8);
    this.spawnParticles(p.x, p.y, source === 'glitch' ? '#FF54AD' : '#ff3860', 20);
    this.vibrate([30, 40, 30]);
    this.analytics.track(source === 'glitch' ? 'mission_glitch_hit' : 'mission_bot_hit', { missionId: m.def.id });
  }

  /** v15: a mission lost before the clock ran out (the thief won, or a
   *  fragile vortex took a hit). */
  failCampaignMission(reason) {
    const m = this.mission;
    if (!m || m.ended || m.finishing) return;
    m.failReason = reason;
    this.flashScreen('#FF54AD', 0.3);
    this.triggerShake(12);
    this.endCampaignMission(false);
  }

  handleCampaignEating() {
    const tier = this.campaignTierIndex(this.campaignPlayerTier().id);
    for (const e of this.campaignEntities) {
      if (e.consumed || e.eating || !e.live) continue;
      if (e.type === 'gate') continue;
      // Mostek (M19) is structural -- it's powered in place by
      // handleCampaignBridges(), never eaten/consumed like a regular node.
      if (e.type === 'node' && e.glyph === 'mostek') continue;
      if ((e.type === 'node' || e.type === 'pylon') && !e.active) continue;
      if (e.type === 'landmark' && !e.unlocked) continue;
      if (tier < e.stats.minTier) { this.lockedBump(e, `T${e.stats.minTier}`, SIZE_TIER_COLORS[e.stats.minTier] || '#fff', this.player); continue; }
      const d = dist(this.player.x, this.player.y, e.x, e.y);
      if (d < this.player.radius * 0.85 + e.radius * 0.3) e.startEating(this.player);
    }
  }

  /** Campaign's hole radius is a pure function of growthUnits (see
   *  CONFIG.growth), so a hit penalty shrinks it and an eat grows it by
   *  exactly the curve's amount. */
  syncCampaignRadius() {
    this.player.setRadius(radiusForUnits(this.mission.growthUnits));
  }

  tryUnlockCampaignLandmark() {
    const m = this.mission;
    const goal = m.def.goal;
    if (!goal.activator || !m.landmark || m.landmark.unlocked) return;
    const activated = goal.activator === 'node' ? m.nodesDisabled : m.pylonsCharged;
    if (activated >= goal.count) {
      m.landmark.unlocked = true;
      this.showNelaToast('Droga otwarta — urośnij i pochłoń cel.');
    }
  }

  resolveCampaignEntity(e) {
    const m = this.mission;
    const stats = e.stats;
    const multiplier = this.registerCombo();
    // The hole's radius is read straight off CONFIG.growth's curve from
    // growthUnits (syncCampaignRadius()), the same curve Arena's eats grow
    // along -- so the radius at each CAMPAIGN_TIERS threshold is exact and
    // every newly unlocked object is visibly smaller than the hole.
    m.growthUnits += stats.growth;
    this.syncCampaignRadius();
    const pts = Math.round(stats.score * multiplier);
    this.player.score += pts;
    this.triggerEatFeedback(e.x, e.y, this.campaignEntityColor(e), e.radius, true, this.player);
    this.addScorePop(this.player, pts, multiplier > 1.01 ? '#EFCB63' : this.campaignEntityColor(e));
    this.vibrate(e.type === 'landmark' ? [60, 40, 60] : 30);

    // Arena's world only spawns object types the player has actually
    // discovered in Campaign (see createObjects()) -- record the first
    // time each type is eaten, regardless of whether the mission is ever
    // completed, since discovery is about exposure, not mission success.
    if (!this.save.campaign.discoveredTypes.includes(e.type)) {
      this.save.campaign.discoveredTypes.push(e.type);
      saveGame(this.save);
    }

    const newTier = this.campaignPlayerTier();
    if (newTier.id !== m.tierId) {
      m.tierId = newTier.id;
      this.ripples.push(new Ripple(this.player.x, this.player.y, newTier.color, this.player.radius, this.player.radius * 2.5, 0.5));
      const sweep = new Ripple(this.player.x, this.player.y, newTier.color, this.player.radius * 1.2, Math.hypot(this.width, this.height) * 0.6, 0.75);
      sweep.lineWidth = 6;
      this.ripples.push(sweep);
      this.spawnParticles(this.player.x, this.player.y, newTier.color, 22, 1.5);
      this.showBanner(`${newTier.id} · ${newTier.name.toUpperCase()}`, 'NOWY ROZMIAR!', newTier.color, 1.3, 2);
      this.sound.tierUp();
      this.flashScreen(newTier.color, 0.18);
      if (this.activeMutations.has('impuls')) this.speedBoostUntil = performance.now() + 2000;
    }

    if (e.type === 'node') { e.active = false; m.nodesDisabled++; this.tryUnlockCampaignLandmark(); }
    if (e.type === 'pylon') {
      e.active = false;
      if (!m.pylonPhaseStarted) { m.pylonPhaseStarted = true; m.pylonComboBroken = false; }
      m.pylonsCharged++;
      if (m.pylonsCharged >= m.def.goal.count) m.pylonPhaseDone = true;
      this.tryUnlockCampaignLandmark();
    }
    if (e.type === 'marker' && e.route) m.markersRoutes.add(e.route);
    if (e.type === 'prop' && e.cluster) m.clustersVisited.add(e.cluster);
    if (e.type === 'capsule') m.maxComboDuringCapsule = Math.max(m.maxComboDuringCapsule, this.comboCount);
    if (e.type === 'landmark') {
      this.triggerShake(16);
      // Collapse (MISSION_BOARD_SPEC.md §4 "Stan 3"): a second, cyan
      // fragment-colored burst layered under the existing violet one, so
      // the landmark visibly breaks into T1-fragment-like debris instead
      // of just fading out. Simplified per the brief -- no separate
      // 4-state animation, this single extra burst is the "collapse" moment.
      this.spawnParticles(e.x, e.y, '#9875FF', 40);
      this.spawnParticles(e.x, e.y, '#50F0FA', 24);
      this.ripples.push(new Ripple(e.x, e.y, '#9875FF', e.radius, e.radius * 3.5, 0.8));
      this.analytics.track('big_eat', { missionId: m.def.id, landmark: e.landmarkId });
    }

    m.eatenByType[e.type] = (m.eatenByType[e.type] || 0) + 1;
    if (e.glyph) m.eatenByGlyph[e.glyph] = (m.eatenByGlyph[e.glyph] || 0) + 1;
  }

  /** Mostek (M19, OBJECT_CATALOG_SPEC.md §2.2): the only real gameplay
   *  difference from a regular node is that it never gets eaten/removed --
   *  touching it "powers" it in place (same growth/score/combo reward as a
   *  normal node eat) and it stays on the board with an active look.
   *  Decision (open question in the spec): no separate "zasilacz" object --
   *  touching the mostek itself powers it, the simplest reading of "zasil
   *  mostek" that doesn't need a second entity type. */
  handleCampaignBridges() {
    const m = this.mission;
    const tier = this.campaignTierIndex(this.campaignPlayerTier().id);
    for (const e of this.campaignEntities) {
      if (e.type !== 'node' || e.glyph !== 'mostek' || e.mostekPowered) continue;
      if (tier < e.stats.minTier) continue;
      const d = dist(this.player.x, this.player.y, e.x, e.y);
      if (d >= this.player.radius * 0.85 + e.radius * 0.3) continue;
      e.mostekPowered = true;
      m.nodesDisabled++;
      m.eatenByType[e.type] = (m.eatenByType[e.type] || 0) + 1;
      const multiplier = this.registerCombo();
      const stats = e.stats;
      // Same growth curve as resolveCampaignEntity() -- see its doc comment.
      m.growthUnits += stats.growth;
      this.syncCampaignRadius();
      const bridgePts = Math.round(stats.score * multiplier);
      this.player.score += bridgePts;
      this.triggerEatFeedback(e.x, e.y, '#50F0FA', e.radius, true, this.player);
      this.addScorePop(this.player, bridgePts, '#50F0FA');
      this.vibrate(30);
      this.tryUnlockCampaignLandmark();
    }
  }

  /** Portal (M13, OBJECT_CATALOG_SPEC.md §2.3/§4): a fixed, one-way,
   *  single-use teleporter instead of a "pass through when open" brama.
   *  Decisions (open questions in the spec, resolved here): one-way, since
   *  there's exactly one physical portal entity and no natural anchor to
   *  teleport back from; single-use per run, since the mission goal is
   *  just reaching the far-side crystal cluster once, not repeat travel. */
  handlePortalTouch(e) {
    const d = dist(this.player.x, this.player.y, e.x, e.y);
    if (d >= this.player.radius + e.radius || e.passCooldown > 0) return;
    if (!e.isGateOpen) {
      this.spawnParticles(e.x, e.y, '#FF54AD', 6);
      return;
    }
    const dest = e.portalAnchors[1];
    this.player.x = dest.x;
    this.player.y = dest.y;
    this.player.invulnerableUntil = performance.now() + 800;
    e.passCooldown = 999; // effectively single-use for the rest of the mission
    // v10: using the portal counts as passing it (gates objective).
    this.mission.gatesPassed.add(e);
    this.spawnParticles(e.x, e.y, '#9875FF', 18);
    this.spawnParticles(dest.x, dest.y, '#9875FF', 18);
    this.ripples.push(new Ripple(dest.x, dest.y, '#9875FF', 10, e.radius * 3, 0.5));
    this.vibrate([30, 20, 30]);
    this.sound.portal();
    this.analytics.track('mission_portal_use', { missionId: this.mission.def.id });
  }

  /** Pas przelotu (M18, OBJECT_CATALOG_SPEC.md §2.4): a corridor zone with
   *  entry/exit tracking instead of a single point-touch gate -- "clearing"
   *  one means crossing all the way through it while lit, not just
   *  touching its center point. */
  handleCorridorZone(e) {
    const m = this.mission;
    const hw = e.zoneHalfWidth || e.radius;
    const inside = Math.abs(this.player.x - e.x) < hw;
    if (inside && !e._corridorInside) {
      e._corridorEnteredOpen = e.isGateOpen;
      e._corridorEnterSide = this.player.x < e.x ? -1 : 1;
    } else if (!inside && e._corridorInside) {
      const exitSide = this.player.x < e.x ? -1 : 1;
      const crossedThrough = exitSide !== e._corridorEnterSide;
      if (crossedThrough && e._corridorEnteredOpen && e.isGateOpen) {
        if (!m.gatesPassed.has(e)) {
          m.gatesPassed.add(e);
          this.spawnParticles(e.x, e.y, '#50F0FA', 16);
          this.vibrate(30);
        }
      } else if (crossedThrough) {
        this.spawnParticles(e.x, e.y, '#FF54AD', 8);
      }
    }
    e._corridorInside = inside;
  }

  handleCampaignGates() {
    const m = this.mission;
    for (const e of this.campaignEntities) {
      if (e.type !== 'gate') continue;
      if (e.glyph === 'portal') { this.handlePortalTouch(e); continue; }
      if (e.glyph === 'pas_przelotu') { this.handleCorridorZone(e); continue; }
      const d = dist(this.player.x, this.player.y, e.x, e.y);
      if (d < this.player.radius + 16 && e.passCooldown <= 0) {
        e.passCooldown = 0.6;
        if (e.isGateOpen) {
          if (!m.gatesPassed.has(e)) {
            m.gatesPassed.add(e);
            this.spawnParticles(e.x, e.y, '#50F0FA', 14);
            this.vibrate(30);
          }
        } else {
          // Closed: a soft bounce, not a hard block or a random penalty —
          // GDD 08 "poznaj rytm otwarcia zamiast losowej kary".
          const dx = this.player.x - e.x, dy = this.player.y - e.y;
          const dd = Math.hypot(dx, dy) || 1;
          this.player.x += (dx / dd) * 26;
          this.player.y += (dy / dd) * 26;
          this.spawnParticles(e.x, e.y, '#FF54AD', 6);
        }
      }
    }
  }

  handleCampaignCollisions() {
    const m = this.mission;
    for (const bot of this.bots) {
      if (this.player.invulnerable || bot.invulnerable) continue;
      const d = dist(this.player.x, this.player.y, bot.x, bot.y);
      const touchDist = Math.max(this.player.radius, bot.radius) * 0.75;
      if (d >= touchDist) continue;
      if (bot.radius > this.player.radius * EAT_HOLE_RATIO) {
        // GDD 07: contact with a bigger bot costs a fraction of current
        // growth and breaks combo, with brief safe invulnerability — not
        // Arena's shrink-to-base-radius (campaign's early missions must
        // not teach through sudden elimination). v15: campaignHit() (a
        // shield absorbs it; a fragile vortex fails).
        this.campaignHit('bot');
        if (m.ended) return;
      } else if (this.player.radius > bot.radius * EAT_HOLE_RATIO) {
        // Rivals are prey too, once the player has outgrown them -- Campaign
        // bots were pure threats before (a documented simplification), the
        // same "bigger absorbs smaller" rule Arena already has, taught
        // explicitly by M00's tutorial goal. No CampaignEntity stats exist
        // for a generic rival, so growth/score are a fixed mid-tier-sized
        // reward instead of a stats table lookup.
        const multiplier = this.registerCombo();
        m.growthUnits += 10;
        this.syncCampaignRadius();
        this.player.score += Math.round(bot.radius * 2 * multiplier);
        m.rivalsEaten++;
        this.rivalsEatenThisRun++;
        this.triggerEatFeedback(bot.x, bot.y, bot.edgeColor, bot.radius, true, this.player);
        this.sound.rivalEaten();
        this.vibrate(40);
        this.analytics.track('mission_rival_eaten', { missionId: m.def.id, rival: bot.name });
        if (!this.save.campaign.discoveredHoleEating) {
          this.save.campaign.discoveredHoleEating = true;
          saveGame(this.save);
        }
        this.addSwallowGhost(this.player, bot, bot.edgeColor);
        bot.radius = bot.racer ? CONFIG.campaign.racer.radius : (m.def.setup.botRadius || CONFIG.campaign.rivalRadius);
        bot.raceTarget = null;
        const p = this.randomInCampaignBounds(150);
        bot.x = p.x; bot.y = p.y;
        bot.invulnerableUntil = performance.now() + INVULN_TIME * 1000;
      }
    }
  }

  /** Campaign-only power effects (GDD §08): Magnes/Reaktor/Impuls/Skaner.
   *  Reaktor just widens comboWindowOverride at pick time; Impuls fires
   *  from resolveCampaignEntity() on a tier advance. This only handles the
   *  continuous ones (Magnes' pull, Skaner's ping). */
  updateMutationEffectsCampaign(dt) {
    if (this.activeMutations.has('magnes')) {
      const range = this.player.radius * 1.4;
      const tier = this.campaignTierIndex(this.campaignPlayerTier().id);
      for (const e of this.campaignEntities) {
        if (e.consumed || e.eating || !e.live) continue;
        if (e.type === 'gate' || e.type === 'landmark') continue;
        if ((e.type === 'node' || e.type === 'pylon') && !e.active) continue;
        if (tier < e.stats.minTier) continue;
        const d = dist(this.player.x, this.player.y, e.x, e.y);
        if (d > 0 && d < range) {
          const pull = 140 * (1 - d / range);
          e.x -= ((e.x - this.player.x) / d) * pull * dt;
          e.y -= ((e.y - this.player.y) / d) * pull * dt;
        }
      }
    }

    this.player.tempSpeedMult = performance.now() < this.speedBoostUntil ? 1.2 : 1; // Impuls: +20%

    if (this.activeMutations.has('skaner')) {
      this.scannerTimer -= dt;
      if (this.scannerTimer <= 0) {
        this.scannerTimer = 8; // GDD 08: "co 8 s"
        let best = null, bestD = Infinity;
        for (const e of this.campaignEntities) {
          if (e.consumed || e.eating || !e.live || e.type === 'gate') continue;
          const d = dist(this.player.x, this.player.y, e.x, e.y);
          if (d < bestD) { best = e; bestD = d; }
        }
        if (best) {
          this.scannerTarget = best;
          this.scannerTargetUntil = performance.now() + 2500;
          this.ripples.push(new Ripple(best.x, best.y, '#9875FF', best.radius, best.radius * 3, 0.6));
        }
      }
    }
  }

  checkCampaignEvolutionOffer() {
    const m = this.mission;
    const offer = m.def.evolutionOffer;
    if (!offer || m.evolutionOffered || this.evolutionPending) return;
    if (m.elapsed >= offer.atSeconds) {
      m.evolutionOffered = true;
      this.offerCampaignPowers(offer.count || 2);
    }
  }

  /** FTUE-respecting single power choice (GDD 08: "jedna moc z dwóch, po
   *  zatrzymaniu inputu"; GDD's FTUE table: no explicit choice before
   *  Mission 04). Reuses the existing evolution overlay/slow-motion so no
   *  new DOM/CSS pause pattern is needed. */
  offerCampaignPowers(count) {
    this.evolutionPending = true;
    const cards = pickUnique(CAMPAIGN_POWERS.filter(p => !this.activeMutations.has(p.id)), count);
    this.analytics.track('evolution_offer', { options: cards.map(c => c.id), mode: 'campaign' });
    this.showPowerCards(cards, id => this.pickCampaignPower(id), 'Działa do końca tej misji. Gra czeka, aż wybierzesz.');
    clearTimeout(this.evolutionAutoPickTimer);
    this.evolutionAutoPickTimer = setTimeout(() => {
      if (this.evolutionPending && cards[0]) this.pickCampaignPower(cards[0].id);
    }, CONFIG.evolution.autoPickMs);
  }

  /** Shared card list for Arena mutations and Campaign powers: a looping
   *  demo of the effect, a plain name, a WHEN tag and a one-line description
   *  with real numbers (player feedback: the old 3 tiny icon cards didn't
   *  say what you were picking). */
  showPowerCards(cards, onPick, subtitle) {
    const grid = document.getElementById('evolutionCards');
    grid.innerHTML = '';
    cards.forEach((card, i) => {
      const btn = document.createElement('button');
      btn.className = 'evolution-card';
      btn.style.setProperty('--card-color', card.color);
      btn.style.animationDelay = `${i * 0.08}s`;
      btn.innerHTML =
        `<canvas class="evolution-demo" data-power="${card.id}" data-color="${card.color}"></canvas>` +
        `<span class="evolution-card-body">` +
          `<span class="evolution-card-top"><span class="evolution-card-name">${card.name}</span>` +
          `<span class="evolution-card-tag">${card.tag || ''}</span></span>` +
          `<span class="evolution-card-desc">${card.desc}</span>` +
        `</span>`;
      btn.addEventListener('click', () => { this.sound.pick(); onPick(card.id); });
      grid.appendChild(btn);
    });
    document.getElementById('evolutionSub').textContent = subtitle;
    const bar = document.getElementById('evolutionTimerBar');
    bar.style.animation = 'none';
    void bar.offsetWidth;
    bar.style.animation = `evolution-timer ${CONFIG.evolution.autoPickMs}ms linear forwards`;
    document.getElementById('evolutionOverlay').classList.remove('hidden');
    this.sound.cards();
    this.vibrate(40);
    this.startScreenAnim();
  }

  pickCampaignPower(id) {
    this.pointerScreen = null;
    if (!this.evolutionPending) return;
    clearTimeout(this.evolutionAutoPickTimer);
    this.evolutionPending = false;
    this.activeMutations.add(id);
    document.getElementById('evolutionOverlay').classList.add('hidden');
    document.getElementById('evolutionCards').classList.remove('count-2');
    this.analytics.track('evolution_pick', { mutation: id, mode: 'campaign' });
    this.vibrate(50);
    if (id === 'reaktor') this.comboWindowOverride = 2.1;
  }

  /** v10 objectives: [progress, target] for one step. */
  objectiveProgress(step) {
    const m = this.mission;
    if (step.eat) return [step.glyph ? (m.eatenByGlyph[step.glyph] || 0) : (m.eatenByType[step.eat] || 0), step.n];
    if (step.tier) return [this.campaignTierIndex(this.campaignPlayerTier().id), step.tier];
    if (step.combo) return [m.bestCombo, step.combo];
    if (step.gates) return [m.gatesPassed.size, step.gates];
    if (step.rival) return [m.rivalsEaten, step.rival];
    if (step.activate) return [step.activate === 'node' ? m.nodesDisabled : m.pylonsCharged, step.n];
    if (step.landmark) return [(m.landmark && m.landmark.consumed) ? 1 : 0, 1];
    if (step.score) return [this.player.score, step.score];
    return [0, 1];
  }

  checkCampaignGoal() {
    const m = this.mission;
    if (m.ended || m.finishing) return;
    const g = m.def.goal;
    m.bestCombo = Math.max(m.bestCombo, this.comboCount);
    let progress = 0, target = 1, done = false;
    switch (g.type) {
      case 'objectives':
        target = g.steps.length;
        progress = g.steps.filter(st => { const [p, t] = this.objectiveProgress(st); return p >= t; }).length;
        done = progress >= target;
        break;
      case 'eatCount':
        // Task 3 fix: a mission with one specific target glyph (the normal
        // case) only counts eating THAT object; a genuinely mixed-glyph
        // spawn (e.g. M02's random street props) keeps counting the whole
        // type, since there's no single object it could mean.
        progress = m.goalGlyph ? (m.eatenByGlyph[m.goalGlyph] || 0) : (m.eatenByType[g.entityType] || 0);
        target = g.count;
        done = progress >= target;
        break;
      case 'comboChain':
        m.bestCombo = Math.max(m.bestCombo, this.comboCount);
        progress = m.bestCombo;
        target = g.count;
        done = progress >= target;
        break;
      case 'gatesPassed':
        progress = m.gatesPassed.size;
        target = g.count;
        done = progress >= target;
        break;
      case 'activateAndDevour': {
        const activated = g.activator === 'node' ? m.nodesDisabled : m.pylonsCharged;
        target = g.count + 1; // the activators, plus the landmark bite itself
        done = !!(m.landmark && m.landmark.consumed);
        progress = done ? target : Math.min(activated, g.count);
        break;
      }
      case 'tutorialChecklist': {
        target = g.steps.length;
        progress = g.steps.filter(step => {
          const stepProgress = step.type === 'eatRival' ? m.rivalsEaten : (m.eatenByType[step.entityType] || 0);
          return stepProgress >= step.count;
        }).length;
        done = progress >= target;
        break;
      }
    }
    m.progress = progress;
    m.progressTarget = target;
    if (done) this.beginMissionSuccess();
  }

  /** A beat of "absorption" juice between hitting the goal and the mission
   *  result screen cutting in (player feedback: "chwilę oddechu zanim
   *  wyskakuje okno że ukończyłeś") -- a particle/ripple burst on the
   *  player plus a short pause, instead of an instant cut. m.finishing
   *  (distinct from m.ended) blocks the goal/timeout checks from firing
   *  again during the pause while leaving updateCampaign() itself running,
   *  so the burst and the clock UI keep animating. Guards `this.mission
   *  === m` in the timeout in case the player leaves and starts a new
   *  mission before it fires. */
  beginMissionSuccess() {
    const m = this.mission;
    m.finishing = true;
    this.triggerShake(10);
    this.spawnParticles(this.player.x, this.player.y, '#46D99A', 40);
    this.ripples.push(new Ripple(this.player.x, this.player.y, '#46D99A', this.player.radius, this.player.radius * 3, 0.7));
    this.vibrate([40, 30, 40]);
    setTimeout(() => { if (this.mission === m) this.endCampaignMission(true); }, 900);
  }

  /** M00-only: the moment each step is individually completed, block on the
   *  same full-screen overlay the mission opened with -- showing ONLY the
   *  next step's own `intro` -- instead of a small toast (player feedback:
   *  "po każdym etapie zamiast małego komunikatu ma być takie okienko jak
   *  na początku"). Plus a one-time just-in-time nudge (a lightweight
   *  toast, not blocking, since it fires mid-play rather than at a step
   *  boundary) the instant the player first outgrows the rival bot. */
  updateTutorialGuidance() {
    const m = this.mission;
    const g = m.def.goal;
    if (g.type !== 'tutorialChecklist' || m.ended || m.finishing) return;

    let cardShown = false;
    g.steps.forEach((step, i) => {
      if (m.tutorialStepDone[i]) return;
      const stepProgress = step.type === 'eatRival' ? m.rivalsEaten : (m.eatenByType[step.entityType] || 0);
      if (stepProgress < step.count) return;
      const wasCurrent = i === this.tutorialCurrentStep();
      m.tutorialStepDone[i] = true;
      const nextIdx = this.tutorialCurrentStep();
      if (nextIdx >= g.steps.length) return;
      // v13 (QA): finishing a LATER step early (a car eaten before the 6th
      // street prop) used to re-open the current step's blocking window --
      // three freezes in 2 s. Only the current step's completion opens the
      // next window; an early one is a quick, non-blocking nod.
      if (wasCurrent) cardShown = true;
      else this.showNelaToast(`${step.label} — zaliczone! Teraz: ${g.steps[nextIdx].label.toLowerCase()}.`);
    });
    // One card per frame, for the step that is current now (two steps
    // finishing together used to stack two cards, hiding the first).
    if (cardShown && this.tutorialCurrentStep() < g.steps.length) this.showTutorialStepIntro(this.tutorialCurrentStep());

    if (!m.tutorialRivalHintShown) {
      const rivalIdx = g.steps.findIndex(s => s.type === 'eatRival');
      const bot = this.bots[0];
      if (rivalIdx !== -1 && this.tutorialCurrentStep() === rivalIdx && bot && this.player.radius > bot.radius * EAT_HOLE_RATIO) {
        m.tutorialRivalHintShown = true;
        this.showNelaToast('Rywal jest już mniejszy od Ciebie — najedź na niego i go pochłoń!');
      }
    }
  }

  /** M00: index of the first unfinished step (steps.length when done). */
  tutorialCurrentStep() {
    const m = this.mission;
    if (!m || m.def.goal.type !== 'tutorialChecklist') return 0;
    const i = m.tutorialStepDone.findIndex(d => !d);
    return i === -1 ? m.def.goal.steps.length : i;
  }

  showTutorialStepIntro(stepIndex) {
    const steps = this.mission.def.goal.steps;
    const st = steps[stepIndex];
    const icon = st.type === 'eatRival' ? { icon: CARD_ICONS.target, color: '#46D99A' } : this.campaignGoalIcon(st.entityType);
    this.showTutorialIntro(st.intro, { step: `KROK ${stepIndex + 1} Z ${steps.length}`, title: st.title, icon,
      button: stepIndex === 0 ? 'ZACZYNAM' : 'DALEJ' });
  }

  /** Hides NELA's toast at once -- it must never outlive its mission (QA:
   *  a campaign line was still showing over the next Arena round). */
  hideNelaToast() {
    clearTimeout(this.nelaTimer);
    const el = document.getElementById('nelaToast');
    el.classList.remove('visible');
    el.classList.add('hidden');
  }

  /** v14: NELA's line as a speech bubble with her avatar and a chirp
   *  (was a small italic text strip). Stays a little longer for long lines. */
  showNelaToast(text) {
    const el = document.getElementById('nelaToast');
    document.getElementById('nelaToastText').textContent = text;
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.add('visible'));
    this.sound.nela();
    clearTimeout(this.nelaTimer);
    const secs = CONFIG.campaign.nelaDisplaySeconds + Math.min(2.5, text.length / 40);
    this.nelaTimer = setTimeout(() => el.classList.remove('visible'), secs * 1000);
  }

  /** M00's opening instructions, unlike every other mission's auto-fading
   *  NELA toast: a blocking overlay that only closes on tap, freezing the
   *  round via introPending (loop()'s same skip-update()-entirely
   *  mechanism as the evolution offer) so the player reads at their own
   *  pace and the clock/entities don't start until they're ready
   *  (player feedback: "gracz decyduje kiedy zaczyna"). */
  showTutorialIntro(text, opts = {}) {
    this.introPending = true;
    document.getElementById('tutorialIntroText').textContent = text;
    document.getElementById('tutorialIntroStep').textContent = opts.step || '';
    document.getElementById('tutorialIntroTitle').textContent = opts.title || 'ZANIM ZACZNIESZ';
    const ic = document.getElementById('tutorialIntroIcon');
    ic.innerHTML = opts.icon ? `<svg viewBox="0 0 24 24">${opts.icon.icon}</svg>` : '';
    ic.style.color = opts.icon ? opts.icon.color : '';
    ic.classList.toggle('hidden', !opts.icon);
    document.getElementById('btnTutorialIntroStart').textContent = opts.button || 'ZACZYNAM';
    document.getElementById('tutorialIntroOverlay').classList.remove('hidden');
  }

  dismissTutorialIntro() {
    // (QA bots call this to clear any pre-start card -- v15's start card too.)
    if (!document.getElementById('missionStartOverlay').classList.contains('hidden')) { this.beginMissionPlay(); return; }
    this.introPending = false;
    this.pointerScreen = null; // the tap on the card must not become a steering point
    document.getElementById('tutorialIntroOverlay').classList.add('hidden');
  }

  updateCampaignHUD() {
    const m = this.mission;
    this.hudSet('missionTimerValue', 'text', m.def.untimed ? '∞' : formatClock(m.timeRemaining));
    document.getElementById('missionTimerValue').parentElement.parentElement.classList.toggle('hud-urgent', m.timeRemaining <= 10);

    // "CEL RUNDY" section: one icon+label+progress row per goal shape (two
    // for activateAndDevour, so activator progress and the landmark bite
    // each get their own line instead of one combined string+number).
    // v12: only re-parsed when a row actually changed (was every frame).
    const goalItems = this.campaignGoalItems();
    // v14: a finished step of a multi-step mission gets its own moment
    // ("CEL ZALICZONY" + what's left) instead of only a quiet strike-through.
    if (m.def.goal.type !== 'tutorialChecklist' && goalItems.length > 1) {
      const doneNow = goalItems.map(it => it.progress >= it.target);
      if (m.stepsDoneShown && !doneNow.every(Boolean)) {
        const i = doneNow.findIndex((d, k) => d && !m.stepsDoneShown[k]);
        if (i >= 0) {
          const nextGoal = goalItems.find((it, k) => !doneNow[k]);
          this.showBanner('CEL ZALICZONY', `Teraz: ${nextGoal.label}`, '#46D99A', 2.1, 2);
          this.sound.coin();
        }
      }
      // Remember every step ever announced: a tier step can drop (a bigger
      // rival's hit shrinks the hole) and must not re-announce.
      m.stepsDoneShown = doneNow.map((d, k) => d || !!(m.stepsDoneShown && m.stepsDoneShown[k]));
    }
    // v15: the thief's tally, a fragile vortex and the shields left ride
    // under the goals (red/gold rows -- a threat, not a goal).
    const s = m.def.setup || {};
    const extra = [];
    if (s.racer) extra.push({ icon: GOAL_ICONS.racer, color: '#EFCB63', label: 'Złodziej', count: m.raceStarted ? `${m.racerCount}/${s.raceTarget}` : 'czeka', cls: 'twist-danger' });
    if (s.fragile && !m.shields) extra.push({ icon: GOAL_ICONS.fragile, color: '#50F0FA', label: 'Kruchy wir', count: '', cls: 'twist-danger' });
    if (m.shields) extra.push({ icon: CARD_ICONS.shield, color: '#EFCB63', label: 'Tarcza', count: `×${m.shields}`, cls: 'twist-shield' });
    this.hudSet('missionGoalItems', 'html', goalItems.map(it => `
      <div class="mission-goal-item${it.progress >= it.target ? ' done' : ''}">
        <span class="mission-goal-icon" style="color:${it.color}"><svg viewBox="0 0 24 24">${it.icon}</svg></span>
        <span class="mission-goal-text">${it.label}</span>
        <span class="mission-goal-count">${it.display || `${Math.min(it.progress, it.target)}/${it.target}`}</span>
      </div>`).join('') + extra.map(it => `
      <div class="mission-goal-item ${it.cls}">
        <span class="mission-goal-icon" style="color:${it.color}"><svg viewBox="0 0 24 24">${it.icon}</svg></span>
        <span class="mission-goal-text">${it.label}</span>
        <span class="mission-goal-count">${it.count}</span>
      </div>`).join(''));

    // Growth-tier "pasek ładowania": a compact bar + badge (e.g. "T1"),
    // not a label for whatever was just eaten -- title attr carries the
    // full tier name + next-tier caption for a hover/long-press tooltip
    // instead of a permanently-visible text block.
    const tier = this.campaignPlayerTier();
    const idx = CAMPAIGN_TIERS.indexOf(tier);
    const next = CAMPAIGN_TIERS[idx + 1];
    const pct = next ? clamp((m.growthUnits - tier.minUnits) / (next.minUnits - tier.minUnits), 0, 1) * 100 : 100;
    this.setTierBadge(tier.id, tier.color, `${tier.name}${next ? ` · Postęp do ${next.id}` : ' · Poziom maksymalny'}`, pct);
    this.setHudScore(this.player.score);
  }

  /** v12 HUD writes go through a small cache: a DOM write only when the
   *  value really changed (the old HUD re-set every field, rebuilt the
   *  standings list and re-parsed the goal rows 60 times a second). */
  hudSet(id, prop, value) {
    const cache = this.hudCache || (this.hudCache = {});
    const k = id + '|' + prop;
    if (cache[k] === value) return false;
    cache[k] = value;
    const el = document.getElementById(id);
    if (!el) return false;
    if (prop === 'text') el.textContent = value;
    else if (prop === 'html') el.innerHTML = value;
    else if (prop === 'title') el.title = value;
    else el.style[prop] = value;
    return true;
  }

  setTierBadge(label, color, title, pct) {
    this.hudSet('missionTierBar', 'width', pct.toFixed(1) + '%');
    this.hudSet('missionTierBadge', 'text', label);
    this.hudSet('missionTierBadge', 'color', color);
    this.hudSet('missionTierBadge', 'textShadow', `0 0 6px ${color}`);
    this.hudSet('missionTierBadge', 'title', title);
    this.hudSet('missionTierBar', 'background', color);
    this.hudSet('missionTierBar', 'boxShadow', `0 0 8px ${color}`);
  }

  /** Score pill: write + a quick pop whenever the score goes up. */
  setHudScore(score) {
    const prev = this.hudCache && this.hudCache['missionScoreValue|text'];
    if (!this.hudSet('missionScoreValue', 'text', String(score))) return;
    if (prev == null || score <= Number(prev)) return;
    const now = performance.now();
    if (now - (this.lastScoreBump || 0) < 160) return;
    this.lastScoreBump = now;
    const pill = document.querySelector('.hud-pill-score');
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (pill && pill.animate) pill.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
  }

  updateCampaign(dt) {
    const m = this.mission;
    if (m.ended) return;
    m.elapsed += dt;
    // v13: the tutorial is untimed -- a new player could fail it (and was
    // then offered a revive ad) before knowing what the game is.
    m.timeRemaining = m.def.untimed ? m.def.timeLimit : Math.max(0, m.def.timeLimit + (m.bonusTime || 0) - m.elapsed);

    this.applyPlayerMovement(dt);
    this.clampToCampaignBounds(this.player);
    for (const bot of this.bots) { this.updateCampaignBot(bot, dt); this.clampToCampaignBounds(bot); }
    this.updateRunners(dt);
    for (const e of this.campaignEntities) e.update(dt, m.elapsed);

    this.handleCampaignEating();
    this.handleCampaignBridges();
    for (const e of this.campaignEntities) {
      if (e.consumed && !e._resolved) {
        e._resolved = true;
        if (e.eater && e.eater !== this.player) this.resolveRacerEat(e);
        else this.resolveCampaignEntity(e);
        if (m.ended) return;
      }
    }
    this.updateGlitchZones(dt);
    if (m.ended) return;
    this.handleCampaignGates();
    this.handleCampaignCollisions();
    if (m.ended) return;
    this.updateMutationEffectsCampaign(dt);
    this.updateCombo(dt);
    if (this.comboCount === 0 && m._wasComboActive) {
      m.comboBroken = true;
      if (m.pylonPhaseStarted && !m.pylonPhaseDone) m.pylonComboBroken = true;
    }
    m._wasComboActive = this.comboCount > 0;

    this.sound.setIntensity(m.timeRemaining <= 15 ? 2 : 1);
    this.checkCampaignEvolutionOffer();
    this.checkCampaignGoal();
    if (m.ended) return;
    this.updateTutorialGuidance();

    this.particles.forEach(p => p.update(dt));
    this.particles = this.particles.filter(p => !p.dead);
    this.ripples.forEach(r => r.update(dt));
    this.ripples = this.ripples.filter(r => !r.dead);
    this.updateJuice(dt);

    // Camera is framed to CONFIG.campaign.bounds, not the shared WORLD_W/H --
    // the player is already clamped to that smaller box (clampToCampaignBounds),
    // so following it against the full 3000x3000 world let the camera drift
    // past the box edge and reveal empty world beyond the pink boundary line
    // (Arena avoids this because its own player clamp and camera clamp both
    // use WORLD_W/H). This only changes how the camera frames the box --
    // movement extent is untouched.
    const cb = CONFIG.campaign.bounds;
    const cbW = cb.maxX - cb.minX, cbH = cb.maxY - cb.minY;
    this.camera.x = clamp(this.player.x, cb.minX + this.width / 2, cb.maxX - this.width / 2);
    this.camera.y = clamp(this.player.y, cb.minY + this.height / 2, cb.maxY - this.height / 2);
    if (cbW < this.width) this.camera.x = (cb.minX + cb.maxX) / 2;
    if (cbH < this.height) this.camera.y = (cb.minY + cb.maxY) / 2;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);

    this.updateCampaignHUD();

    if (m.timeRemaining <= 0 && !m.finishing && !m.def.untimed) this.onCampaignTimeout();
  }

  /* ---- Golden Shot v11: "PRAWIE!" mission revive (rewarded ad) ---- */

  /** 0..1, how much of the mission goal is done (mean over goal rows). */
  campaignGoalFraction() {
    const items = this.campaignGoalItems();
    if (!items.length) return 0;
    return items.reduce((a, it) => a + clamp(it.target ? it.progress / it.target : 0, 0, 1), 0) / items.length;
  }

  /** Out of time: if the player was close, freeze the round and offer +N s
   *  for a rewarded ad (once per attempt) -- the near-miss is the moment a
   *  player most wants "one more go". Otherwise fail as before. */
  onCampaignTimeout() {
    const m = this.mission;
    const A = CONFIG.ads;
    const frac = this.campaignGoalFraction();
    const adLeft = this.monetization.placementLeft('mission_revive') > 0;
    const prismsOk = (this.save.prisms || 0) >= A.revivePrisms;
    if (m.revived || m.reviveDeclined || frac < A.reviveMinProgress || (!adLeft && !prismsOk)) {
      this.endCampaignMission(false);
      return;
    }
    this.revivePending = true;
    this.hideNelaToast();
    m.reviveDeclined = true; // one offer per attempt, whatever the answer
    const missing = this.campaignGoalItems().filter(it => it.progress < it.target)
      .map(it => `${it.label} (${it.display || `${Math.min(it.progress, it.target)}/${it.target}`})`);
    document.getElementById('reviveMissing').textContent = missing.length ? `Zostało: ${missing.join(' · ')}` : '';
    document.getElementById('reviveProgressBar').style.width = Math.round(frac * 100) + '%';
    document.getElementById('reviveProgressPct').textContent = Math.round(frac * 100) + '%';
    document.getElementById('btnReviveAd').textContent = `+${A.reviveSeconds} S · OBEJRZYJ REKLAMĘ`;
    document.getElementById('btnReviveAd').classList.toggle('hidden', !adLeft);
    // v15: the same seconds for prisms (no ad needed).
    document.getElementById('btnRevivePrisms').textContent = `+${A.reviveSeconds} S · ${A.revivePrisms} ◆`;
    document.getElementById('btnRevivePrisms').classList.toggle('hidden', !prismsOk);
    document.getElementById('reviveOverlay').classList.remove('hidden');
    this.sound.whoosh();
    this.vibrate([30, 30, 30]);
    this.analytics.track('ad_offer', { context: 'mission_revive', missionId: m.def.id, progress: Math.round(frac * 100) });
    this.armReviveTimer();
  }

  /** (Re)starts the offer's auto-decline countdown; paused with the game. */
  armReviveTimer() {
    const ms = CONFIG.ads.reviveOfferSeconds * 1000;
    const ring = document.getElementById('reviveTimerBar');
    ring.style.animation = 'none';
    void ring.offsetWidth;
    ring.style.animation = `evolution-timer ${ms}ms linear forwards`;
    clearTimeout(this.reviveTimer);
    this.reviveTimer = setTimeout(() => this.declineRevive(), ms);
  }

  hideReviveOffer() {
    clearTimeout(this.reviveTimer);
    this.revivePending = false;
    const el = document.getElementById('reviveOverlay');
    if (el) el.classList.add('hidden');
  }

  async acceptRevive() {
    if (!this.revivePending || this.reviveAdInFlight) return; // double tap while the ad loads
    clearTimeout(this.reviveTimer);
    this.reviveAdInFlight = true;
    let ok = false;
    try { ok = await this.monetization.rewarded('mission_revive'); } finally { this.reviveAdInFlight = false; }
    const m = this.mission;
    if (!this.revivePending || !m || m.ended) return;
    if (!ok) { this.declineRevive(); return; }
    m.revived = true;
    m.bonusTime = (m.bonusTime || 0) + CONFIG.ads.reviveSeconds;
    m.timeRemaining = CONFIG.ads.reviveSeconds;
    this.hideReviveOffer();
    this.lastCountdownSec = null;
    this.player.invulnerableUntil = performance.now() + 2000;
    this.showBanner(`+${CONFIG.ads.reviveSeconds} S!`, 'Dokończ misję!', '#46D99A', 1.3, 4);
    this.sound.fanfare(false);
    this.lastTime = performance.now();
  }

  acceptRevivePrisms() {
    const m = this.mission, A = CONFIG.ads;
    if (!this.revivePending || this.reviveAdInFlight || !m || m.ended) return;
    if ((this.save.prisms || 0) < A.revivePrisms) return;
    this.save.prisms -= A.revivePrisms;
    saveGame(this.save);
    this.analytics.track('revive_prisms', { missionId: m.def.id });
    m.revived = true;
    m.bonusTime = (m.bonusTime || 0) + A.reviveSeconds;
    m.timeRemaining = A.reviveSeconds;
    this.hideReviveOffer();
    this.lastCountdownSec = null;
    this.player.invulnerableUntil = performance.now() + 2000;
    this.showBanner(`+${A.reviveSeconds} S!`, 'Dokończ misję!', '#46D99A', 1.3, 4);
    this.sound.fanfare(false);
    this.updateCoinDisplays();
    this.lastTime = performance.now();
  }

  declineRevive() {
    if (!this.revivePending || this.reviveAdInFlight) return;
    this.hideReviveOffer();
    this.analytics.track('ad_declined', { context: 'mission_revive' });
    if (this.mission && !this.mission.ended) this.endCampaignMission(false);
  }

  /* ---- Mission end / result screen ---- */

  endCampaignMission(success) {
    const m = this.mission;
    if (m.ended) return;
    m.ended = true;
    this.running = false;
    this.paused = false;
    this.monetization.gameplayStop();
    this.hideReviveOffer();
    this.hideNelaToast();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    document.getElementById('hud').classList.add('hidden');

    // v15: three stars (bit 1 clear, bit 2 the fast time, bit 4 expert
    // time / special challenge), each kept from the best attempt.
    const c = this.save.campaign;
    const id = m.def.id;
    if (!success && !m.failReason) m.failReason = 'time';
    const starBits = success ? this.missionStarBits(m) : 0;
    const prevBits = c.stars[id] || 0;
    const newStarBits = starBits & ~prevBits;
    if (starBits) c.stars[id] = prevBits | starBits;
    const medalEarned = !!(starBits & 4);
    // Energy: a won mission gives its point back; defeats in a row arm
    // NELA's pity Zegar (CONFIG.boosters.pityFails).
    if (success && m.energyCharged) this.grantEnergy(1, true);
    c.fails[id] = success ? 0 : (c.fails[id] || 0) + 1;

    let firstClear = false;
    if (success && !this.save.campaign.completed[m.def.id]) {
      firstClear = true;
      this.save.campaign.completed[m.def.id] = true;
      this.save.coins += m.def.reward.coins;
      if (m.def.reward.unlockDistrict && !this.save.campaign.unlockedDistricts.includes(m.def.reward.unlockDistrict)) {
        this.save.campaign.unlockedDistricts.push(m.def.reward.unlockDistrict);
      }
      if (m.def.reward.unlockSkin && !this.save.owned.includes(m.def.reward.unlockSkin)) {
        this.save.owned.push(m.def.reward.unlockSkin);
        const skin = SKINS.find(sk => sk.id === m.def.reward.unlockSkin);
        this.queueRewardCelebration({
          eyebrow: 'NAGRODA ZA KAMPANIĘ', title: `Wir „${skin ? skin.name : m.def.reward.unlockSkin}”`, color: '#EFCB63',
          icon: REWARD_CATEGORY_ICONS.skin,
          desc: 'Wyjątkowy wygląd dziury za ukończenie całej kampanii. Załóż go w Warsztacie.'
        });
      }
    }
    if (medalEarned) this.save.campaign.medals[m.def.id] = true;
    this.checkBoosterGift();
    this.lastXpResult = this.grantXp(success ? CONFIG.progression.xpMissionSuccess : CONFIG.progression.xpMissionFail);
    this.checkStarChests();
    saveGame(this.save);

    this.analytics.track('mission_end', {
      missionId: m.def.id, success, medalEarned, firstClear, diff: m.def.diff,
      stars: starBits, newStars: newStarBits, failReason: success ? null : m.failReason,
      attempt: c.attempts[id] || 1, boosters: m.boosters.join(',') || null,
      durationMs: Math.round(m.elapsed * 1000)
    });

    this.showMissionResultScreen(success, starBits, newStarBits, firstClear);
  }

  /** v15: is one star condition met by this (successful) attempt? */
  starConditionMet(cond, m) {
    switch (cond.type) {
      case 'clear': return true;
      case 'timeUnder': return m.elapsed <= cond.seconds;
      case 'visitBothClusters': return m.clustersVisited.has('A') && m.clustersVisited.has('B');
      case 'noBotHit': return m.botHitCount === 0;
      case 'comboUnbroken': return !m.comboBroken;
      case 'comboAtLeast': return Math.max(m.bestCombo, m.maxComboDuringCapsule) >= cond.count;
      case 'bothRoutesUsed': return m.markersRoutes.has('A') && m.markersRoutes.has('B');
      case 'pylonsUnbroken': return !m.pylonComboBroken;
    }
    return false;
  }

  missionStarBits(m) {
    const stars = m.def.stars || [{ type: 'clear' }];
    return stars.reduce((bits, cond, i) => bits | (this.starConditionMet(cond, m) ? 1 << i : 0), 0);
  }

  static starCount(bits) { return (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1); }

  totalStars() {
    const st = this.save.campaign.stars;
    return Object.keys(st).reduce((n, id) => n + Game.starCount(st[id] || 0), 0);
  }

  /** v15: every CONFIG.stars.chestEvery stars opens a star chest. */
  checkStarChests() {
    const c = this.save.campaign, S = CONFIG.stars;
    const due = Math.floor(this.totalStars() / S.chestEvery);
    while (c.starChests < due) {
      c.starChests++;
      const booster = MISSION_BOOSTERS[(c.starChests - 1) % MISSION_BOOSTERS.length];
      this.save.coins += S.chest.coins;
      this.save.prisms = (this.save.prisms || 0) + S.chest.prisms;
      this.save.boosters[booster.id] = (this.save.boosters[booster.id] || 0) + S.chest.booster;
      this.queueRewardCelebration({
        kicker: 'SKRZYNIA GWIAZD', eyebrow: `${c.starChests * S.chestEvery} GWIAZDEK`, title: 'Skrzynia gwiazd!', color: '#EFCB63',
        icon: REWARD_CATEGORY_ICONS.bundle, noCta: true,
        desc: `+${S.chest.coins} monet · +${S.chest.prisms} pryzmaty · wzmocnienie „${booster.name}”. Następna za ${S.chestEvery} gwiazdek.`
      });
      this.analytics.track('star_chest', { n: c.starChests });
    }
  }

  showMissionResultScreen(success, starBits, newStarBits, firstClear) {
    const medalEarned = !!(newStarBits & 6);
    const m = this.mission;
    const def = m.def;
    const c = this.save.campaign;
    const failTitle = { time: 'CZAS MINĄŁ', racer: 'ZŁODZIEJ BYŁ SZYBSZY', hit: 'WIR ROZBITY' }[m.failReason] || 'CZAS MINĄŁ';
    document.getElementById('missionResultTitle').textContent = success ? (Game.starCount(starBits) === 3 ? 'PERFEKCYJNIE!' : 'MISJA UKOŃCZONA') : failTitle;
    // v15 pity: after a few defeats in a row NELA lends one Zegar (+15 s).
    let pityLoan = false;
    if (!success && (c.fails[def.id] || 0) >= CONFIG.boosters.pityFails && !c.pity[def.id] && this.boostersUnlocked()) {
      c.pity[def.id] = true;
      this.save.boosters.time = (this.save.boosters.time || 0) + 1;
      pityLoan = true;
      saveGame(this.save);
      this.analytics.track('pity_booster', { missionId: def.id });
    }
    // v12 hero emblem: a ring + check drawn in the district's color (gold
    // with a medal), or a pink clock when time ran out.
    const hero = document.getElementById('missionHero');
    hero.classList.toggle('fail', !success);
    hero.style.setProperty('--mh-color', !success ? '#FF54AD' : (medalEarned ? '#EFCB63' : (DISTRICT_COLORS[def.district] || '#50F0FA')));
    this.sound.setIntensity(0);
    if (success) this.sound.fanfare(firstClear); else this.sound.fail();
    document.getElementById('missionResultEyebrow').textContent = `${missionCode(def)} · ${def.name}`;
    const failLine = pityLoan ? `Ta misja daje w kość. Masz ode mnie Zegar (+${CONFIG.boosters.timeBonus} s) — wybierz go w odprawie.`
      : m.failReason === 'racer' ? 'Następnym razem zbieraj najpierw cele obok Złodzieja — a gdy urośniesz, pochłoń go, żeby stracił czas.'
        : m.failReason === 'hit' ? 'Kruchy wir pękł. Tarcza z odprawy przyjmie dwa zderzenia za Ciebie.'
          : this.campaignGoalFraction() >= 0.5 ? 'Blisko! Teraz znasz już trasę — następna próba pójdzie szybciej.'
            : def.diff >= 4 ? 'Ta misja jest naprawdę trudna. Zegar albo Turbo start z odprawy mogą pomóc.'
              : 'Tym razem Glitch był szybszy. Zacznij od najbliższych celów, a reszta pójdzie sama.';
    document.getElementById('missionResultNela').textContent = success ? def.nela.success : failLine;
    this.animateNumber(document.getElementById('missionResultScore'), this.player.score, 1000);
    // Score only where a goal asks for it; on a timeout the clock equals
    // the limit, so the tile shows how far the goals got instead.
    const scoreGoal = !!(def.goal.steps && def.goal.steps.some(st => st.score));
    document.getElementById('missionResultScoreTile').classList.toggle('hidden', !scoreGoal && !this.player.score);
    document.getElementById('missionResultTimeLabel').textContent = success ? 'CZAS' : 'POSTĘP';
    document.getElementById('missionResultTime').textContent = success ? formatClock(m.elapsed) : `${Math.round(this.campaignGoalFraction() * 100)}%`;
    // v15: three stars -- this attempt's lit, older ones dimmer, new ones pop.
    const owned = c.stars[def.id] || 0;
    const starsEl = document.getElementById('missionResultStars');
    starsEl.innerHTML = [0, 1, 2].map(i => {
      const bit = 1 << i;
      const cls = (starBits & bit) ? ((newStarBits & bit) ? 'on new' : 'on') : ((owned & bit) ? 'old' : '');
      return `<span class="mr-star ${cls}" style="animation-delay:${0.35 + i * 0.28}s">★</span>`;
    }).join('');
    if (success) newStarBits && [0, 1, 2].forEach(i => { if (newStarBits & (1 << i)) setTimeout(() => this.sound.star(i), 350 + i * 280); });
    this.renderXpCard('mission', this.lastXpResult);
    if (success) setTimeout(() => this.launchConfetti('missionConfetti', Game.starCount(starBits) >= 3 ? 90 : 50), 250);
    const medalLine = document.getElementById('missionResultMedal');
    if (success) {
      medalLine.innerHTML = (def.stars || []).map((cond, i) => {
        const bit = 1 << i;
        const st = (starBits & bit) ? 'done' : (owned & bit) ? 'had' : '';
        return `<li class="mr-star-row ${st}"><span class="mr-star-mini">${'★'.repeat(i + 1)}</span>${cond.label}${st === 'had' ? ' <em>(wcześniej)</em>' : ''}</li>`;
      }).join('');
    } else {
      const missing = this.campaignGoalItems().filter(it => it.progress < it.target)
        .map(it => `${it.label} (${it.display || `${Math.min(it.progress, it.target)}/${it.target}`})`);
      medalLine.innerHTML = missing.length ? `<li class="mr-star-row missing">Zostało: ${missing.join(' · ')}</li>` : '';
    }
    medalLine.classList.toggle('earned', !!medalEarned);
    document.getElementById('missionResultReward').textContent = firstClear
      ? `+${def.reward.coins} monet${def.reward.unlockSkin ? ' · Wir finałowy!' : ''}`
      : '';
    document.getElementById('missionResultReward').classList.toggle('gained', firstClear);
    document.getElementById('missionResultReward').classList.toggle('hidden', !firstClear);

    // v14: what comes next, briefed above the button that leads there --
    // the next mission in this district, or after its boss the first
    // mission of the next one (player feedback: "DALEJ: M12" said nothing
    // about where it goes).
    const district = DISTRICTS.find(d => d.id === def.district);
    const idx = district.missions.indexOf(def.id);
    // After a replay the "next" is the frontier (the mission still to do),
    // not the already-cleared one after it.
    const following = district.missions[idx + 1];
    const followingOk = following && this.isMissionPlayable(following);
    const nextId = !success ? null
      : (followingOk && !this.save.campaign.completed[following]) ? following
        : (this.nextCampaignMissionId() || (followingOk ? following : null));
    const nextDef = nextId && campaignMissionById(nextId);
    const nextCard = document.getElementById('missionResultNextCard');
    const btnNext = document.getElementById('btnMissionNext');
    const btnRetry = document.getElementById('btnMissionRetry');
    const PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7V5z"/></svg>';
    nextCard.classList.toggle('hidden', !nextDef);
    btnRetry.classList.toggle('hidden', !success);
    document.getElementById('btnMissionMap').classList.remove('hidden');
    if (nextDef) {
      const newDistrict = firstClear && !!def.reward.unlockDistrict && nextDef.district === def.reward.unlockDistrict;
      nextCard.innerHTML = this.missionCardHtml(nextDef, { eyebrow: newDistrict ? `NOWA DZIELNICA · ${DISTRICTS.find(d => d.id === nextDef.district).name.toUpperCase()}` : 'NASTĘPNA MISJA' });
      nextCard.style.setProperty('--d-color', DISTRICT_COLORS[nextDef.district] || '#50F0FA');
      btnNext.innerHTML = `GRAJ ${missionCode(nextDef)}${PLAY}`;
      btnNext.onclick = () => this.openMissionBriefing(nextId);
    } else if (success && CAMPAIGN_MISSIONS.every(md => this.isMissionDone(md.id))) {
      btnNext.textContent = 'WRÓĆ DO MIASTA';
      btnNext.onclick = () => { this.updateCoinDisplays(); this.showScreen('mainMenu'); };
    } else if (success) {
      btnNext.innerHTML = `DZIELNICE${PLAY}`;
      btnNext.onclick = () => { this.updateCoinDisplays(); this.openCampaignScreen(); };
      document.getElementById('btnMissionMap').classList.add('hidden');
    } else {
      btnNext.innerHTML = `SPRÓBUJ PONOWNIE${PLAY}`;
      btnNext.onclick = () => this.openMissionBriefing(def.id);
    }
    // v15: every (re)start goes through the briefing -- boosters and the
    // energy cost are decided there.
    btnRetry.onclick = () => this.openMissionBriefing(def.id);
    document.getElementById('btnMissionMap').onclick = () => { this.updateCoinDisplays(); this.selectedDistrictId = nextDef ? nextDef.district : def.district; this.openCampaignScreen(); };

    this.updateCoinDisplays();
    this.showScreen('missionResultScreen');
    document.querySelector('#missionResultScreen > .screen-inner').scrollTop = 0;
    this.queueUnlockCelebrations();
  }

  /* ---- Campaign rendering ---- */

  renderCampaign(time) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!this.floorCoversView()) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.width, this.height);
    }

    let shakeX = 0, shakeY = 0;
    if (this.shake > 0) { shakeX = rand(-this.shake, this.shake); shakeY = rand(-this.shake, this.shake); }

    ctx.save();
    ctx.translate(this.width / 2 - this.camera.x + shakeX, this.height / 2 - this.camera.y + shakeY);
    this.drawCampaignGrid(ctx, time);
    this.drawGlitchZones(ctx, time);
    const goalTypes = this.campaignGoalEntityTypes();
    const playerTier = this.campaignTierIndex(this.campaignPlayerTier().id);
    const goalGlyph = this.mission ? this.mission.goalGlyph : null;
    for (const e of this.campaignEntities) {
      // Gates (pas przelotu) draw long corridor lines far past their radius.
      if (e.type !== 'gate' && !this.isInView(e.x, e.y, e.radius * 2)) continue;
      // The goal ring only marks goal objects the hole can eat right now --
      // a ring around a still-too-big object read as "eat this" (QA).
      const isGoal = goalTypes.has(e.type) && (!goalGlyph || e.glyph === goalGlyph) && playerTier >= e.stats?.minTier;
      e.draw(ctx, isGoal);
    }
    this.drawScannerTarget(ctx);
    this.drawDangerHalos(ctx);
    this.drawPreyRings(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const r of this.ripples) r.draw(ctx);

    const holes = [...this.bots, this.player];
    holes.sort((a, b) => a.radius - b.radius);
    const swallowed = this.collectSwallowed();
    for (const h of holes) if (this.isInView(h.x, h.y, h.radius + 40)) h.draw(ctx, time, this.swallowPass(h, swallowed));
    this.drawPlayerOverlapMarker(ctx, holes, 1);

    for (const f of this.floatTexts) f.draw(ctx);
    ctx.restore();

    this.drawDarkness(ctx);
    if (this.showMinimap) this.drawCampaignMinimap(ctx);
    this.drawCampaignGoalArrow(ctx, time);
    this.drawJuiceScreen(ctx, this.mission ? this.mission.timeRemaining : undefined);
  }

  /** v15 glitch zones: a pink hazard field with drifting scan bars and
   *  broken pixel blocks (light and open -- never a dark disc, which would
   *  read as a hole). */
  drawGlitchZones(ctx, time) {
    const zones = this.glitchZones;
    if (!zones || !zones.length) return;
    for (const z of zones) {
      if (!this.isInView(z.x, z.y, z.r + 10)) continue;
      const pulse = 0.5 + 0.5 * Math.sin(time * 4 + z.seed);
      ctx.save();
      ctx.translate(z.x, z.y);
      ctx.fillStyle = `rgba(255, 84, 173, ${0.1 + 0.06 * pulse})`;
      ctx.beginPath(); ctx.arc(0, 0, z.r, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(255, 84, 173, 0.22)';
      const off = (time * 40 + z.seed * 10) % 18;
      for (let y = -z.r - 18 + off; y < z.r; y += 18) ctx.fillRect(-z.r, y, z.r * 2, 4);
      for (let k = 0; k < 6; k++) {
        const ph = Math.floor(time * 6 + k * 13 + z.seed);
        const bx = Math.sin(ph * 12.9898) * z.r * 0.7, by = Math.cos(ph * 78.233) * z.r * 0.7;
        ctx.fillStyle = k % 2 ? 'rgba(80, 240, 250, 0.45)' : 'rgba(255, 84, 173, 0.6)';
        ctx.fillRect(bx, by, 10 + (ph % 3) * 6, 4);
      }
      ctx.restore();
      ctx.strokeStyle = `rgba(255, 84, 173, ${0.55 + 0.35 * pulse})`;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([12, 8]);
      ctx.lineDashOffset = -time * 30;
      ctx.beginPath(); ctx.arc(0, 0, z.r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  /** v15 "Awaria prądu": only a circle of light around the hole. */
  darkVision() {
    const D = CONFIG.campaign.dark;
    return D.vision + this.player.radius * D.perRadius;
  }

  drawDarkness(ctx) {
    if (!this.mission || !this.mission.def.setup.dark || !this.player) return;
    const px = this.player.x - this.camera.x + this.width / 2, py = this.player.y - this.camera.y + this.height / 2;
    const v = this.darkVision();
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const g = ctx.createRadialGradient(px, py, v * 0.55, px, py, v);
    g.addColorStop(0, 'rgba(2, 6, 12, 0)');
    g.addColorStop(1, 'rgba(2, 6, 12, 0.95)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  /** v13: what the player can act on for the goal right now -- the nearest
   *  of these gets an edge arrow when none is on screen (QA: missions
   *  opened with no goal object in view and nothing pointing to one). */
  campaignGuideTargets() {
    const m = this.mission;
    if (!m) return [];
    const g = m.def.goal;
    const tier = this.campaignTierIndex(this.campaignPlayerTier().id);
    if (g.type === 'tutorialChecklist') {
      const st = g.steps[this.tutorialCurrentStep()];
      if (!st) return [];
      if (st.type === 'eatRival') return this.bots.filter(b => this.player.radius > b.radius * EAT_HOLE_RATIO);
    }
    const types = this.campaignGoalEntityTypes();
    const glyph = m.goalGlyph;
    const goals = this.campaignEntities.filter(e => {
      if (e.consumed || e.eating || e.live === false || !types.has(e.type)) return false;
      if (e.type === 'gate') return !m.gatesPassed.has(e);
      if (glyph && e.glyph !== glyph && e.type !== 'landmark') return false;
      if (e.type === 'node' && e.glyph === 'mostek') return !e.mostekPowered;
      if ((e.type === 'node' || e.type === 'pylon') && e.active === false) return false;
      if (e.type === 'landmark' && !e.unlocked) return false;
      return !(e.stats && tier < e.stats.minTier);
    });
    if (goals.length || g.type === 'tutorialChecklist') return goals;
    // v15: nothing in the goal is within reach yet (too small) -- point at
    // food that grows the hole instead of leaving the arrow dark (in a
    // blackout there was no way to find it).
    return this.campaignEntities.filter(e => !e.consumed && !e.eating && e.live !== false && e.stats && e.type !== 'gate'
      && e.type !== 'landmark' && e.type !== 'node' && e.type !== 'pylon' && tier >= e.stats.minTier);
  }

  drawCampaignGoalArrow(ctx, time) {
    const p = this.player;
    if (!p || this.introPending) return;
    const targets = this.campaignGuideTargets();
    // "Seen" = well inside the screen; one half-cut by an edge or hidden
    // under the minimap still gets the arrow (QA, M07).
    const dark = this.mission && this.mission.def.setup.dark;
    const seen = e => { const sx = e.x - this.camera.x + this.width / 2, sy = e.y - this.camera.y + this.height / 2;
      if (dark) return dist(e.x, e.y, p.x, p.y) < this.darkVision() * 0.75;
      return sx > 40 && sx < this.width - 40 && sy > 40 && sy < this.height - 40; };
    if (!targets.length || targets.some(seen)) return;
    let best = null, bd = Infinity;
    for (const e of targets) { const d = dist(p.x, p.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
    const sx = best.x - this.camera.x + this.width / 2, sy = best.y - this.camera.y + this.height / 2;
    const cx = this.width / 2, cy = this.height / 2, margin = 46;
    const angle = Math.atan2(sy - cy, sx - cx);
    const k = Math.min(Math.abs((cx - margin) / (Math.cos(angle) || 1e-6)), Math.abs((cy - margin) / (Math.sin(angle) || 1e-6)));
    const ex = cx + Math.cos(angle) * k, ey = cy + Math.sin(angle) * k;
    const color = !(best instanceof CampaignEntity) ? '#46D99A' : best.type === 'gate' ? '#50F0FA' : this.campaignEntityColor(best);
    const bob = 4 * Math.sin(time * 6);
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(ex - Math.cos(angle) * bob, ey - Math.sin(angle) * bob);
    ctx.rotate(angle);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(4,16,29,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath();
    ctx.stroke(); ctx.fill();
    ctx.restore();
  }

  /** Campaign's floor: the same Neon City (CityFloor) painted in the
   *  mission's district. Movement is clamped to CONFIG.campaign.bounds (see
   *  clampToCampaignBounds()), so outside that box the city fades into the
   *  dark and the pink neon edge marks where the board ends. */
  drawCampaignGrid(ctx, time) {
    const b = CONFIG.campaign.bounds;
    const theme = this.campaignTheme();
    const view = this.floorView();
    this.cityFloor.draw(ctx, view, theme);
    if (this.gfxLevel > 0) this.cityFloor.drawTraffic(ctx, view, time, theme, b, this.player);
    const L = view.cx - view.hw - 40, T = view.cy - view.hh - 40, Rt = view.cx + view.hw + 40, Bt = view.cy + view.hh + 40;
    const midL = Math.max(L, b.minX), midR = Math.min(Rt, b.maxX);
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 12, 0.8)';
    if (L < b.minX) ctx.fillRect(L, T, b.minX - L, Bt - T);
    if (Rt > b.maxX) ctx.fillRect(b.maxX, T, Rt - b.maxX, Bt - T);
    if (T < b.minY && midR > midL) ctx.fillRect(midL, T, midR - midL, b.minY - T);
    if (Bt > b.maxY && midR > midL) ctx.fillRect(midL, b.maxY, midR - midL, Bt - b.maxY);
    ctx.strokeStyle = 'rgba(255, 84, 173, 0.65)';
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#FF54AD';
    ctx.lineWidth = 4;
    ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    ctx.restore();
  }

  /** Player + rival markers shared by both minimaps (player feedback: the
   *  player's cyan dot and bots' palette-colored dots blended into the
   *  object dots). Objects are small squares; holes are rings -- the player
   *  a bright white dot with a cyan halo, rivals hollow rings: red when
   *  bigger than the player (danger), white when smaller (prey). */
  drawMinimapHoles(ctx, toMini) {
    for (const bot of this.bots) {
      const p = toMini(bot.x, bot.y);
      const danger = bot.radius > this.player.radius * EAT_HOLE_RATIO;
      ctx.strokeStyle = danger ? '#ff3860' : 'rgba(242, 248, 255, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, danger ? 3.5 : 2.8, 0, Math.PI * 2); ctx.stroke();
    }
    const pp = toMini(this.player.x, this.player.y);
    ctx.fillStyle = 'rgba(80, 240, 250, 0.35)';
    ctx.beginPath(); ctx.arc(pp.x, pp.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(pp.x, pp.y, 3.2, 0, Math.PI * 2); ctx.fill();
  }

  drawCampaignMinimap(ctx) {
    const size = this.minimapSize(), margin = 16;
    const px = this.width - size - margin, py = this.height - size - margin;
    const b = CONFIG.campaign.bounds;
    const scaleX = size / (b.maxX - b.minX), scaleY = size / (b.maxY - b.minY);

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.cityFloor.minimap(Math.round(size * this.dpr), this.campaignTheme(), b), px, py, size, size);
    ctx.strokeStyle = 'rgba(80, 240, 250,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, size, size);
    this.drawMinimapLabel(ctx, px, py, size, this.campaignTheme());

    // Every live entity gets a dot, not just landmark/node/pylon -- the
    // minimap used to hide fragments/props/vehicles/capsules/markers/gates
    // entirely (player feedback: the map should represent everything).
    const toMini = (x, y) => ({ x: px + (x - b.minX) * scaleX, y: py + (y - b.minY) * scaleY });
    // v15: in a blackout the map shows only the board and the holes.
    const dark = this.mission && this.mission.def.setup.dark;
    for (const z of (this.glitchZones || [])) {
      const c = toMini(z.x, z.y);
      ctx.fillStyle = 'rgba(255, 84, 173, 0.35)';
      ctx.beginPath(); ctx.arc(c.x, c.y, z.r * scaleX, 0, Math.PI * 2); ctx.fill();
    }
    for (const e of this.campaignEntities) {
      if (e.consumed || !e.live || dark) continue;
      const big = e.type === 'landmark' || e.type === 'node' || e.type === 'pylon' || e.type === 'gate';
      const size = big ? 3.5 : 2.2;
      const p = toMini(e.x, e.y);
      ctx.fillStyle = this.campaignEntityColor(e);
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
    this.drawMinimapHoles(ctx, toMini);

    // Viewport-frame hint: a small square centered on the camera, not a
    // rectangle proportional to the actual (non-square) screen aspect --
    // the bounds box is only 1400x1400, so a true proportional viewport
    // rect reads as too big/rectangular on a 130px-square minimap (player
    // feedback). Kept minimal and square instead, same spirit as Arena's
    // frame (shows roughly where the camera is) without the screen-shape
    // baggage.
    const camMini = toMini(this.camera.x, this.camera.y);
    const frameSize = 16;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(camMini.x - frameSize / 2, camMini.y - frameSize / 2, frameSize, frameSize);
    ctx.restore();
  }

  /* ---------- round flow ---------- */

  /** options.seed forces a specific seed (Daily Seed Challenge);
   *  options.daily marks the run so endRound() records a daily best. */
  startRound(options) {
    options = options || {};
    this.markUnlockVisited('arena');
    this.mode = 'arena';
    this.hideNelaToast();
    this.hideAllOverlays();
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('hud-topright').classList.remove('hidden');
    document.getElementById('hud-goal').classList.add('hidden');
    // Arena now reuses Campaign's compact tier-strip (Czas/tier badge/Wynik)
    // instead of its own separate timer ring + size/score panel (player
    // feedback: the two modes' in-round HUD should look and behave the
    // same); only the standings panel on the right stays Arena-specific,
    // since Arena has no mission goal to show there.
    document.getElementById('hud-tier-strip').classList.remove('hidden');
    document.getElementById('hud-tier-strip').classList.add('clears-standings');
    this.state = GameState.MATCH_SETUP;
    this.paused = false;

    this.isDailyRun = !!options.daily;
    this.frameEma = 0; this.slowFrames = 0; this.frameWarmup = 30;
    this.challenge = options.challenge || null;
    this.challengeBeaten = false;
    this.hideReviveOffer();
    this.runId = generateId('run');
    this.runSeed = options.seed !== undefined ? options.seed : generateSeed();
    this.rng = new SeededRNG(this.runSeed);
    this.modifier = this.pickModifier();

    const { mission, dateKey } = missionForDate(new Date());
    if (this.save.mission.dateKey !== dateKey) {
      this.save.mission = { dateKey, completed: false };
      saveGame(this.save);
    }
    this.activeMission = mission;
    this.missionProgressPeak = 0;
    this.rivalsEatenThisRun = 0;
    this.missionJustCompleted = false;
    this.hubMilestoneReward = null;
    this.difficultyT = this.computeDifficultyT();
    // v13: no Rush Hour while the career is still in its easy ramp (it rolled
    // on a brand-new player's very first round). The seeded draw above is
    // kept, so Daily/challenge maps -- never at t = 0 -- are unchanged.
    if (this.difficultyT === 0) this.modifier = 'none';
    const equipped = SKINS.find(sk => sk.id === this.save.selected);
    this.activePerks = (equipped && equipped.perks) || [];

    this.createObjects(this.rng);
    this.createEntities(this.rng);
    this.pacer = this.bots[0];
    this.parScore = this.computeParScore();
    this.leadLostAt = 0;
    this.finalChaseShown = false;
    // v13: a short spawn shield -- on hard careers bots start bigger than
    // the player and could eat it in the first second.
    this.player.invulnerableUntil = performance.now() + 2500;
    this.player.perkSpeedMult = 1 + this.perk('speed');
    if (this.perk('startUnits')) this.player.radius = radiusForUnits(this.perk('startUnits'));
    this.particles = [];
    this.ripples = [];
    this.floatTexts = [];
    this.swallowGhosts = [];
    this.banner = null;
    this.flashAlpha = 0;
    this.hitStopUntil = 0;
    this.zoom = CONFIG.juice.zoom.max;
    this.lateRoundAnnounced = false;
    this.lastPlace = null;
    this.goldenObj = null;
    this.goldenTimer = CONFIG.golden.firstDelay;
    this.frenzyEndsAt = null;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.comboTimer = 0;
    this.comboWindowOverride = null;
    this.comboDisplayAlpha = 0;
    this.dangerWarned = new Set();
    this.timeRemaining = ROUND_TIME;
    this.adUsedThisRound = false;
    this.runStartedAt = performance.now();
    this.firstEatTracked = false;
    this.lastSizeTierId = CONFIG.sizeTiers[0].id;

    // Phase 4 run-only state
    this.activeMutations = new Set();
    this.evolutionOffersTriggered = new Set();
    this.evolutionPending = false;
    clearTimeout(this.evolutionAutoPickTimer);
    this.magnetUntil = 0;
    this.speedBoostUntil = 0;
    this.scannerTimer = 0;
    this.scannerTarget = null;
    this.bountyTarget = null;
    this.overdriveActive = false;
    this.overdriveVariant = null;
    this.overdriveTag = null;
    document.getElementById('evolutionOverlay').classList.add('hidden');
    document.getElementById('overdriveBanner').classList.add('hidden');

    // Phase 7 run tool, selected in the Run Setup screen (or 'none')
    this.shieldCharges = this.selectedRunTool === 'shield' ? 1 : 0;
    this.toolMagnetUntil = this.selectedRunTool === 'magnet' ? performance.now() + 12000 : 0;
    if (this.selectedRunTool === 'boost') {
      // Turbo start: spawn just past the T2 threshold (checkSizeTier()
      // celebrates the jump on the first frame).
      this.player.radius = radiusForUnits(Math.max(unitsForRadius(this.player.radius), CONFIG.growth.unitAnchors[1]) + 2);
    }
    const runTool = this.selectedRunTool;
    this.selectedRunTool = 'none'; // one-shot: "Play Again" won't silently re-apply a paid tool for free

    // v16: a new track every round (Daily / challenge: one per seed).
    this.sound.setScene('arena', { seed: this.runSeed, daily: this.isDailyRun, challenge: !!this.challenge });
    this.sound.go();

    this.pointerScreen = null; // no steering until the first touch/mouse move
    this.running = true;
    this.monetization.gameplayStart();
    this.state = GameState.PLAYING;

    const hint = document.getElementById('mobile-hint');
    hint.textContent = (this.useThumbpad
      ? 'Dotknij dolnej części ekranu, aby sterować kciukiem'
      : 'Dotknij i przeciągaj, aby sterować dziurą')
      + (this.modifier === 'rush_hour' ? ' • GODZINA SZCZYTU: rywale są szybsi w tej rundzie!' : '');
    hint.classList.remove('hidden');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => hint.classList.add('hidden'), 4000);
    this.lastTime = performance.now();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame((t) => this.loop(t));
    this.analytics.track('run_start', {
      runId: this.runId,
      seed: this.runSeed,
      skin: this.player.skin,
      playCount: this.playCount,
      modifier: this.modifier,
      runTool,
      daily: this.isDailyRun,
      difficulty: Math.round(this.difficultyT * 100) / 100
    });
    this.bannerQueue = [];
    this.lastCountdownSec = null;
    this.scorePop = null;
    this.prewarmFloor();
    this.showBanner(this.isDailyRun ? 'WYZWANIE DNIA!' : 'START!', this.modifier === 'rush_hour' ? 'GODZINA SZCZYTU — rywale są szybsi!' : 'Pochłaniaj · rośnij · wygraj', '#50F0FA', 1.2);
  }

  async requestPlayAgain() {
    if (this.replayPending) return; // double tap during the break
    this.replayPending = true;
    try { await this.playAgainFlow(); } finally { this.replayPending = false; }
  }

  async playAgainFlow() {
    this.playCount++;
    // Golden Shot v8/v11: no interstitials during the newbie runs, only every
    // Nth replay after that, time-capped and skipped with "Bez reklam"
    // (all enforced inside Monetization.interstitial()).
    // v15: no ad in front of an empty energy bar.
    const canPlay = this.energyFreeFor('arena') || this.energyNow() >= 1;
    if (canPlay && this.playCount % CONFIG.ads.interstitialEveryNthReplay === 0) await this.monetization.interstitial('replay');
    // A lost friend challenge replays the same map ("rewanż").
    this.requireEnergy('arena', () => {
      if (this.challenge && !this.challengeBeaten) this.startRound({ seed: this.runSeed, challenge: this.challenge });
      else this.startRound();
    });
  }

  async watchRewardedAd() {
    if (this.adUsedThisRound) return;
    this.analytics.track('ad_offer', { context: 'result_double_coins' });
    const btn = document.getElementById('btnWatchAd');
    btn.disabled = true;
    const ok = await this.monetization.rewarded('result_double_coins');
    if (!ok) { btn.disabled = false; return; }
    this.adUsedThisRound = true;
    const total = Math.round(this.adPendingCoins * CONFIG.economy.adRewardMultiplier);
    const bonus = total - this.adPendingCoins;
    this.save.coins += bonus;
    saveGame(this.save);
    document.getElementById('finalCoins').textContent = total;
    btn.textContent = 'ODEBRANO ×2 ✓';
    this.sound.coin();
    this.updateCoinDisplays();
  }

  /** Stops the round, grants coins for the score reached so far, and
   *  persists stats. Shared by a normal timeout end and an early Leave Run,
   *  which only differ in whether the results screen is shown. */
  finalizeRun() {
    this.running = false;
    this.paused = false;
    this.monetization.gameplayStop();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    document.getElementById('hud').classList.add('hidden');

    const ranked = rankHoles([this.player, ...this.bots]);
    const place = ranked.indexOf(this.player) + 1;
    const E = CONFIG.economy;
    let coinsEarned = E.coinsBase + Math.round(E.coinsSqrtK * Math.sqrt(Math.max(0, this.player.score))) + (E.coinsPlaceBonus[place - 1] || 0);
    // Golden Shot v8: a new player's first runs pay double.
    this.newbieBonusApplied = (this.save.stats.runsPlayed || 0) < CONFIG.economy.newbieRuns;
    if (this.newbieBonusApplied) coinsEarned = Math.round(coinsEarned * CONFIG.economy.newbieCoinMult);
    this.perkCoinsBonus = Math.round(coinsEarned * this.perk('coins'));
    coinsEarned += this.perkCoinsBonus;
    this.adPendingCoins = coinsEarned;
    this.save.coins += coinsEarned;
    this.save.stats.runsPlayed = (this.save.stats.runsPlayed || 0) + 1;

    // Phase 7: Prisms have no IAP adapter yet, so the only earn path is a
    // small trickle from progression (GDD 10.1's "slowly earned" clause).
    if (this.save.stats.runsPlayed % CONFIG.economy.prismTrickleEvery === 0) {
      this.save.prisms = (this.save.prisms || 0) + CONFIG.economy.prismTrickleAmount;
    }

    // Golden Shot v8: player XP (score + podium bonus).
    const P = CONFIG.progression;
    this.lastXpResult = this.grantXp((P.xpRunBase + P.xpSqrtK * Math.sqrt(Math.max(0, this.player.score)) + (P.xpPlaceBonus[place - 1] || 0)) * (1 + this.perk('xp')));

    // Daily mission: was a static, never-checked line before this pass.
    // Checked once per day (save.mission.completed guards re-granting the
    // reward on a later round the same day).
    this.missionJustCompleted = false;
    if (this.activeMission && !this.save.mission.completed && this.missionProgressPeak >= this.activeMission.target) {
      this.save.mission.completed = true;
      this.save.coins += this.activeMission.rewardCoins;
      this.missionJustCompleted = true;
      this.analytics.track('result_action', { action: 'mission_completed', mission: this.activeMission.id });
    }

    // Phase 9 fix: give the Daily Seed Challenge an explicit goal (beat
    // today's best) and its own reward, not just a different seed with no
    // point to it.
    this.dailyResult = null;
    if (this.isDailyRun) {
      const { dateKey } = dailySeedForDate(new Date());
      const previousBest = this.save.daily.lastSeedDate === dateKey ? this.save.daily.lastSeedScore : 0;
      const isNewBest = this.player.score > previousBest;
      let dailyBonusCoins = CONFIG.daily.completionBonusCoins;
      let dailyBonusPrisms = 0;
      if (isNewBest) {
        dailyBonusCoins += CONFIG.daily.newRecordBonusCoins;
        dailyBonusPrisms = CONFIG.daily.newRecordBonusPrisms;
      }
      this.save.coins += dailyBonusCoins;
      this.save.prisms = (this.save.prisms || 0) + dailyBonusPrisms;
      // GDD 4.0 §5.4: the Wyzwania tab shows a streak, so track consecutive
      // UTC days played -- independent of whether this run set a new best.
      const streak = this.save.daily.lastPlayedDate === dateKey ? (this.save.daily.streak || 0)
        : this.save.daily.lastPlayedDate === previousDateKey(dateKey) ? (this.save.daily.streak || 0) + 1
        : 1;
      this.save.daily = {
        lastSeedDate: isNewBest ? dateKey : this.save.daily.lastSeedDate,
        lastSeedScore: isNewBest ? this.player.score : this.save.daily.lastSeedScore,
        streak, lastPlayedDate: dateKey
      };
      this.dailyResult = { isNewBest, previousBest, dailyBonusCoins, dailyBonusPrisms, streak };
      this.analytics.track('daily_challenge_end', {
        dateKey, score: this.player.score, isNewBest, dailyBonusCoins, dailyBonusPrisms, streak
      });
    }

    // GDD 4.0 §7.2/§7.3: Core City is filled ONLY by Arena (GRAJ 2:00) and
    // Daily runs -- Campaign missions never call finalizeRun() at all (see
    // endCampaignMission() instead), so this is the one and only place
    // Core City progress is granted. Gains are additive; overflow past
    // 100% carries into the next level (§7.3's worked example: 92% + 20%
    // => 100% grants the LVL reward, and the new level starts at 12%).
    const cc = CONFIG.hub.coreCity;
    let coreGain;
    if (this.isDailyRun) {
      coreGain = cc.dailyFirstClearGain + (this.dailyResult.isNewBest ? cc.dailyNewBestGain : 0);
    } else {
      coreGain = cc.arenaCompleteGain + (place <= 3 ? cc.arenaTop3Gain : 0) + (place === 1 ? cc.arenaFirstGain : 0);
      if (this.player.score > (this.save.stats.bestArenaScore || 0)) {
        this.save.stats.bestArenaScore = this.player.score;
        coreGain += cc.arenaNewPbGain;
      }
      // v13: the pacer's par comes from finished rounds only (an early
      // "leave run" would drag it down).
      if (this.timeRemaining <= 0.5 && !this.challenge) {
        const recent = (this.save.stats.recentArenaScores || []).concat(this.player.score);
        this.save.stats.recentArenaScores = recent.slice(-CONFIG.rival.history);
      }
    }
    if ((this.save.hub.coreLevel || 1) <= cc.earlyLevelMax) coreGain = Math.round(coreGain * cc.earlyLevelMult);
    this.save.hub.coreCharge = (this.save.hub.coreCharge || 0) + coreGain;
    this.hubMilestoneReached = false;
    this.hubMilestoneRewards = [];
    while (this.save.hub.coreCharge >= 100) {
      this.save.hub.coreCharge -= 100;
      this.save.hub.coreLevel = (this.save.hub.coreLevel || 1) + 1;
      this.hubMilestoneReached = true;
      this.hubMilestoneRewards.push(this.grantCoreCityLevelReward(this.save.hub.coreLevel));
    }
    this.hubMilestoneReward = this.hubMilestoneRewards[0] || null; // back-compat: single-reward UI reads this
    if (this.hubMilestoneReached) {
      this.analytics.track('result_action', { action: 'hub_milestone', level: this.save.hub.coreLevel, rewards: this.hubMilestoneRewards });
    }

    saveGame(this.save);
    return { ranked, place, coinsEarned };
  }

  /** GDD 4.0 §8.2's reward ladder for reaching Core City `level`. Grants
   *  every cosmetic the level lists (already-owned ones are a no-op) plus
   *  its coin bonus; level 7+ has no authored reward so it falls back to
   *  the same "fallback" bonus the pre-v4 code granted once everything
   *  was owned. */
  grantCoreCityLevelReward(level) {
    const def = CORE_CITY_LEVEL_REWARDS[level];
    if (!def) {
      this.save.coins += CONFIG.hub.milestoneFallbackCoins;
      this.save.prisms = (this.save.prisms || 0) + CONFIG.hub.milestoneFallbackPrisms;
      return { level, label: `+${CONFIG.hub.milestoneFallbackCoins} monet + ${CONFIG.hub.milestoneFallbackPrisms} pryzmatów`, coins: CONFIG.hub.milestoneFallbackCoins };
    }
    if (def.skinId && !this.save.owned.includes(def.skinId)) this.save.owned.push(def.skinId);
    if (def.auraId && !this.save.auras.owned.includes(def.auraId)) this.save.auras.owned.push(def.auraId);
    if (def.effectId && !this.save.effects.owned.includes(def.effectId)) this.save.effects.owned.push(def.effectId);
    if (def.overdriveSkinId && !this.save.overdriveSkins.owned.includes(def.overdriveSkinId)) this.save.overdriveSkins.owned.push(def.overdriveSkinId);
    if (def.badge && !this.save.badges.includes(def.badge)) this.save.badges.push(def.badge);
    this.save.coins += def.coins;
    const category = this.coreCityRewardCategory(def);
    this.queueRewardCelebration({
      eyebrow: `NAGRODA CORE CITY · LVL ${level}`, title: def.label, color: '#46D99A',
      icon: REWARD_CATEGORY_ICONS[category],
      desc: `${this.rewardCategoryExplanation(category).replace(/<[^>]+>/g, '')} Czeka w Warsztacie. +${def.coins} monet.`
    });
    return { level, label: def.label, coins: def.coins };
  }

  endRound() {
    this.state = GameState.RESULTS;
    const corePctBefore = this.save.hub.coreCharge || 0;
    const bestArenaScoreBefore = this.save.stats.bestArenaScore || 0;
    const { ranked, place, coinsEarned } = this.finalizeRun();
    const corePctAfter = this.save.hub.coreCharge || 0;

    document.getElementById('finalPlace').textContent = `${place}.`;
    // Golden Shot v8 triumph screen: count-ups, place-based headline, confetti.
    this.animateNumber(document.getElementById('finalScore'), this.player.score, 1100, '', formatNum);
    this.animateNumber(document.getElementById('finalCoins'), coinsEarned, 1100);
    const eyebrow = document.getElementById('resultEyebrow');
    eyebrow.textContent = place === 1 ? 'ZWYCIĘSTWO!' : (place <= 3 ? `PODIUM · ${place}. MIEJSCE` : 'KONIEC RUNDY');
    eyebrow.classList.toggle('result-eyebrow-win', place <= 3);
    document.getElementById('resultNewbieTag').classList.toggle('hidden', !this.newbieBonusApplied);
    this.renderXpCard('result', this.lastXpResult);
    const upsell = document.getElementById('resultUpsell');
    const showUpsell = !this.isDailyRun && place > 2 && this.difficultyT >= 0.25; // from ŚREDNI up
    upsell.classList.toggle('hidden', !showUpsell);
    if (showUpsell) {
      const boost = RUN_TOOLS.find(t => t.id === 'boost');
      const affordable = this.save.coins >= boost.price;
      document.getElementById('resultUpsellLabel').textContent = `ZAGROŻENIE: ${this.difficultyLabel(this.difficultyT)}`;
      document.getElementById('resultUpsellText').textContent = affordable
        ? `Rywale rosną w siłę. Zacznij od T2 z Turbo startem (◇ ${boost.price}) i wskocz na podium!`
        : 'Rywale rosną w siłę. Zbierz monety ze skrzyni i nagród dziennych na Turbo start!';
      const adTurbo = !affordable && this.monetization.placementLeft('turbo_free') > 0;
      document.getElementById('btnUpsell').textContent = affordable ? `TURBO START ◇ ${boost.price}` : (adTurbo ? 'TURBO GRATIS · REKLAMA' : 'ZDOBĄDŹ MONETY');
      if (adTurbo) document.getElementById('resultUpsellText').textContent = 'Rywale rosną w siłę. Obejrzyj krótką reklamę i zacznij rewanż od T2 z Turbo startem!';
    }

    // v5 result hero (design/screens/wynik_rundy.svg): big glowing score,
    // a size-tier badge reusing CONFIG.sizeTiers (previously tracked only
    // for analytics — see checkSizeTier()'s doc comment), and a "new PB"
    // badge next to the score itself.
    let sizeTier = CONFIG.sizeTiers[0];
    for (const tier of CONFIG.sizeTiers) {
      if (this.player.radius >= tier.minRadius) sizeTier = tier;
    }
    document.getElementById('resultTierLabel').textContent = sizeTier.label;
    const isNewPb = this.isDailyRun ? !!(this.dailyResult && this.dailyResult.isNewBest) : this.player.score > bestArenaScoreBefore;
    document.getElementById('resultPbBadge').classList.toggle('hidden', !isNewPb);
    if (place <= 3 || isNewPb) setTimeout(() => this.launchConfetti('resultConfetti', place === 1 ? 90 : 55), 250);

    const tag = document.getElementById('resultTag');
    if (this.overdriveActive && this.overdriveTag) {
      tag.textContent = this.overdriveTag;
      tag.classList.remove('hidden');
    } else {
      tag.classList.add('hidden');
    }

    document.getElementById('resultCoreBefore').textContent = Math.round(corePctBefore) + '%';
    document.getElementById('resultCoreAfter').textContent = Math.round(corePctAfter) + '%';
    const leveledUp = corePctAfter < corePctBefore; // crossed 100% at least once
    const coreGainPct = Math.max(0, Math.round(corePctAfter - corePctBefore + (leveledUp ? 100 : 0)));
    document.getElementById('resultCoreGain').textContent = '+' + coreGainPct + '%';
    // Two-tone delta bar: a dim "before" segment plus a bright "gained"
    // segment stacked right after it, so the gain itself stays visible
    // instead of one bar simply overdrawing the other.
    const barBefore = document.getElementById('resultCoreBarBefore');
    const barAfter = document.getElementById('resultCoreBar');
    if (leveledUp) {
      barBefore.style.width = '100%';
      barAfter.style.left = '0%';
      barAfter.style.width = corePctAfter + '%';
    } else {
      barBefore.style.width = corePctBefore + '%';
      barAfter.style.left = corePctBefore + '%';
      barAfter.style.width = Math.min(coreGainPct, 100 - corePctBefore) + '%';
    }

    const dailyLine = document.getElementById('dailyResultLine');
    if (this.dailyResult) {
      const r = this.dailyResult;
      dailyLine.textContent = (r.isNewBest
        ? `WYZWANIE DNIA: NOWY REKORD! +${r.dailyBonusCoins} monet, +${r.dailyBonusPrisms} pryzmatów`
        : `WYZWANIE DNIA ukończone: +${r.dailyBonusCoins} monet (rekord dnia: ${r.previousBest})`) + ` · seria: ${r.streak} dni`;
      dailyLine.classList.remove('hidden');
    } else {
      dailyLine.classList.add('hidden');
    }

    // Golden Shot v11: friend challenge outcome + near-miss replay hook.
    this.lastResultPlace = place;
    const hookLine = document.getElementById('resultHookLine');
    let hook = '';
    if (this.challenge) {
      if (this.challengeBeaten) {
        hook = `WYZWANIE WYGRANE! ${formatNum(this.player.score)} vs ${formatNum(this.challenge.score)} (${this.challenge.from}). Odeślij swój wynik!`;
        this.save.challenge = null;
        saveGame(this.save);
        this.analytics.track('challenge_won', { score: this.player.score, target: this.challenge.score });
      } else {
        hook = `Wynik do pobicia: ${formatNum(this.challenge.score)} (${this.challenge.from}) — brakuje ${formatNum(this.challenge.score - this.player.score + 1)} pkt. Rewanż na tej samej mapie?`;
        this.analytics.track('challenge_lost', { score: this.player.score, target: this.challenge.score });
      }
    } else if (place > 1) {
      const above = ranked[place - 2];
      const gap = above.score - this.player.score + 1;
      if (gap > 0 && gap <= Math.max(60, this.player.score * 0.35)) hook = `Zabrakło tylko ${formatNum(gap)} pkt do ${place - 1}. miejsca${place - 1 <= 3 ? ' i podium' : ''}!`;
    }
    hookLine.textContent = hook;
    hookLine.classList.toggle('hidden', !hook);
    document.getElementById('btnPlayAgain').textContent = this.challenge && !this.challengeBeaten ? 'REWANŻ — TA SAMA MAPA' : 'ZAGRAJ JESZCZE RAZ';
    if (place === 1 || isNewPb) this.monetization.happyTime();

    const missionLine = document.getElementById('missionResultLine');
    if (this.missionJustCompleted) {
      missionLine.textContent = `MISJA DNIA UKOŃCZONA: „${this.activeMission.name}” — +${this.activeMission.rewardCoins} monet`;
      missionLine.classList.remove('hidden');
    } else {
      missionLine.classList.add('hidden');
    }

    const hubLine = document.getElementById('hubMilestoneLine');
    if (this.hubMilestoneReached) {
      const summary = this.hubMilestoneRewards.map(r => `LVL ${r.level}: ${r.label} (+${r.coins} monet)`).join(' · ');
      hubLine.textContent = `CORE CITY: ${summary}`;
      hubLine.classList.remove('hidden');
    } else {
      hubLine.classList.add('hidden');
    }

    const list = document.getElementById('finalLeaderboard');
    list.innerHTML = '';
    ranked.forEach((h, i) => {
      const li = document.createElement('li');
      if (h === this.player) li.classList.add('is-player');
      li.innerHTML = `<span class="fl-rank">#${i + 1}</span><span class="fl-name">${escapeHtml(h.name)}</span><span class="fl-score">${formatNum(h.score)} pkt</span><span class="fl-size">${CONFIG.sizeTiers[getSizeTierIndex(h.radius)].shortId}</span>`;
      list.appendChild(li);
    });

    document.getElementById('btnWatchAd').disabled = false;
    document.getElementById('btnWatchAd').textContent = '×2 MONET · REKLAMA';

    this.showScreen('gameOverScreen');
    this.sound.setIntensity(0);
    if (place <= 3 || isNewPb) this.sound.fanfare(place === 1); else this.sound.coin();
    this.updateCoinDisplays();
    this.queueUnlockCelebrations();

    this.analytics.track('run_end', {
      runId: this.runId,
      seed: this.runSeed,
      score: this.player.score,
      place,
      durationMs: Math.round(performance.now() - this.runStartedAt),
      coinsEarned,
      completed: true,
      overdriveTag: this.overdriveTag
    });
  }

  /* ---------- pause / leave run ---------- */

  togglePause() {
    if (this.paused) this.resumeGame(); else this.pauseGame();
  }

  pauseGame() {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.state = GameState.PAUSED;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    document.getElementById('controlsPanel').classList.add('hidden');
    this.hideNelaToast();
    document.getElementById('btnRestartLabel').textContent = this.mode === 'campaign' ? 'ZACZNIJ MISJĘ OD NOWA' : 'ZACZNIJ RUNDĘ OD NOWA';
    document.getElementById('pauseSheet').classList.remove('hidden');
    if (this.revivePending) clearTimeout(this.reviveTimer);
    this.sound.setDucked(true);
    this.monetization.gameplayStop();
    this.syncControlsPanel();
  }

  resumeGame() {
    this.pointerScreen = null;
    if (!this.paused) return;
    this.paused = false;
    this.state = GameState.PLAYING;
    document.getElementById('pauseSheet').classList.add('hidden');
    document.getElementById('leaveConfirm').classList.add('hidden');
    this.sound.setDucked(false);
    if (this.revivePending && !this.reviveAdInFlight) this.armReviveTimer();
    this.monetization.gameplayStart();
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  /** Restarts whatever is actually running. Used to unconditionally call
   *  startRound() (a new random Arena round), which meant restarting from
   *  the pause sheet mid-mission silently dropped the player into Arena
   *  instead of replaying the mission they paused (player feedback: the
   *  restart button should restart the current mission). */
  restartFromPause() {
    if (this.mode !== 'campaign' && !this.energyFreeFor('arena') && this.energyNow() < 1) {
      this.openEnergySheet({ empty: true });
      return;
    }
    document.getElementById('pauseSheet').classList.add('hidden');
    if (this.mode === 'campaign' && this.mission) {
      // v15: a restart is a new attempt -- the current one counts as lost
      // and the briefing (boosters, energy) opens for the next.
      const id = this.mission.def.id;
      this.leaveCampaignMission();
      this.selectedDistrictId = this.mission.def.district;
      this.openCampaignScreen();
      this.openMissionBriefing(id);
    } else {
      this.requireEnergy('arena', () => this.startRound());
    }
  }

  /** Casual mode has no forfeit penalty (that's reserved for future
   *  ranked/daily modes) — the player keeps coins earned for the score
   *  reached so far and returns straight to the menu, per GDD 5.2. */
  leaveRun() {
    document.getElementById('pauseSheet').classList.add('hidden');
    document.getElementById('leaveConfirm').classList.add('hidden');
    if (this.mode === 'campaign') {
      this.leaveCampaignMission();
      return;
    }
    const durationMs = Math.round(performance.now() - this.runStartedAt);
    const { place, coinsEarned } = this.finalizeRun();
    this.state = GameState.MENU;
    this.showScreen('mainMenu');
    this.updateCoinDisplays();
    this.analytics.track('run_end', {
      runId: this.runId,
      seed: this.runSeed,
      score: this.player.score,
      place,
      durationMs,
      coinsEarned,
      completed: false
    });
    this.analytics.track('result_action', { action: 'leave_run' });
  }

  /** Abandoning a mission is not an Arena run: it must not run
   *  finalizeRun()'s Arena-only side effects (City Core charge, daily
   *  mission check, ranked-style rankHoles()) which don't apply to
   *  Campaign, and it goes straight back to the main menu instead of a
   *  results screen -- this is what lets the pause sheet's "leave" button
   *  work correctly from inside a mission (player feedback: every level
   *  needs a way back to the main menu). */
  leaveCampaignMission() {
    this.running = false;
    this.paused = false;
    this.monetization.gameplayStop();
    this.hideReviveOffer();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    document.getElementById('hud').classList.add('hidden');
    if (this.mission && !this.mission.ended) {
      this.mission.ended = true;
      this.hideNelaToast();
      document.getElementById('missionStartOverlay').classList.add('hidden');
      this.introPending = false;
      const c = this.save.campaign;
      c.fails[this.mission.def.id] = (c.fails[this.mission.def.id] || 0) + 1;
      saveGame(this.save);
      this.analytics.track('mission_end', {
        missionId: this.mission.def.id, success: false, medalEarned: false, firstClear: false, abandoned: true
      });
    }
    this.state = GameState.MENU;
    this.showScreen('mainMenu');
  }

  syncControlsPanel() {
    const mode = this.save.settings.inputMode;
    document.getElementById('btnInputThumbpad').classList.toggle('active', mode === 'thumbpad');
    document.getElementById('btnInputLegacy').classList.toggle('active', mode === 'legacy');
    document.querySelectorAll('[data-sensitivity]').forEach(btn => {
      btn.classList.toggle('active', parseFloat(btn.dataset.sensitivity) === this.save.settings.sensitivity);
    });
    document.getElementById('btnHapticsOn').classList.toggle('active', this.save.settings.haptics);
    document.getElementById('btnHapticsOff').classList.toggle('active', !this.save.settings.haptics);
    document.querySelectorAll('[data-setting]').forEach(btn => {
      const on = this.save.settings[btn.dataset.setting] !== false;
      btn.classList.toggle('active', on === (btn.dataset.value === '1'));
    });
    this.syncMusicUi();
  }

  /* ---------- v16 music: unlocks, now playing, Szafa grająca ---------- */

  /** Menu and Rozdział I themes are free; Rozdział II themes unlock with
   *  their district. */
  isTrackUnlocked(id) {
    const t = MUSIC_TRACK_BY_ID[id];
    if (!t) return false;
    if (t.menu || !t.district || FREE_TRACK_DISTRICTS.includes(t.district)) return true;
    return (this.save.campaign.unlockedDistricts || []).includes(t.district);
  }

  trackSource(t) {
    if (t.menu) return 'Miasto i menu';
    const d = DISTRICTS.find(x => x.id === t.district);
    return d ? d.name : '';
  }

  onMusicTrackChange(song) {
    this.syncMusicUi();
    if (this.running && !this.introPending && !song.menu) this.showNowPlaying();
  }

  /** A small "TERAZ GRA" chip in the round's bottom-left corner for 3 s. */
  showNowPlaying() {
    const el = document.getElementById('nowPlaying');
    const song = this.sound.song;
    if (!el || !song || this.save.settings.music === false) return;
    document.getElementById('nowPlayingName').textContent = song.name;
    el.classList.remove('hidden');
    void el.offsetWidth;
    el.classList.add('visible');
    clearTimeout(this.nowPlayingTimer);
    this.nowPlayingTimer = setTimeout(() => el.classList.remove('visible'), 3200);
  }

  syncMusicUi() {
    const song = this.sound && this.sound.song;
    const name = document.getElementById('pauseTrackName');
    if (name) name.textContent = song ? song.name : '—';
    const row = document.getElementById('pauseTrack');
    if (row) row.classList.toggle('hidden', this.save.settings.music === false);
    const jb = document.getElementById('btnJukebox');
    if (jb) {
      const pick = MUSIC_TRACK_BY_ID[this.save.settings.musicPick];
      jb.textContent = pick ? pick.name.toUpperCase() : 'MIESZANKA';
    }
  }

  /** Profil → Szafa grająca: every track, where it comes from, and a pin.
   *  Tapping a track plays it at once and keeps it for rounds and
   *  missions; "Mieszanka" goes back to a new track every round. */
  openJukebox() {
    const note = '<svg class="np-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V6l11-2v12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.6" fill="currentColor"/><circle cx="17.5" cy="16" r="2.6" fill="currentColor"/></svg>';
    const pick = this.save.settings.musicPick || 'auto';
    const item = (id, name, sub, locked) => `<li><button class="jukebox-item${pick === id ? ' is-active' : ''}${locked ? ' is-locked' : ''}" data-track="${id}"${locked ? ' aria-disabled="true"' : ''}>${note}<span class="jb-text"><span class="jb-name">${escapeHtml(name)}</span><span class="jb-sub">${escapeHtml(sub)}</span></span></button></li>`;
    const unlocked = MUSIC_TRACKS.filter(t => this.isTrackUnlocked(t.id)).length;
    let html = '<ul class="jukebox-list">' + item('auto', 'Mieszanka', 'co rundę inny utwór · w misjach motyw dzielnicy', false);
    html += '<li class="jb-group">DZIELNICE</li>';
    for (const t of MUSIC_TRACKS.filter(x => !x.menu)) {
      const locked = !this.isTrackUnlocked(t.id);
      html += item(t.id, locked ? 'Utwór zablokowany' : t.name, locked ? `Odblokuj dzielnicę: ${this.trackSource(t)}` : `${this.trackSource(t)} · ${t.bpm} BPM`, locked);
    }
    html += '<li class="jb-group">MIASTO</li>';
    for (const t of MUSIC_TRACKS.filter(x => x.menu)) html += item(t.id, t.name, `spokojny bit · ${t.bpm} BPM`, false);
    html += '</ul>';
    this.openInfoSheet({
      icon: note,
      title: 'Szafa grająca',
      body: [`Utwory: <strong>${unlocked}/${MUSIC_TRACKS.length}</strong>. Dotknij, aby posłuchać i ustawić do rund i misji.`, html],
      closeLabel: 'GOTOWE'
    });
  }

  pickJukeboxTrack(id) {
    if (id !== 'auto' && !this.isTrackUnlocked(id)) {
      // Never a silent tap: the row nudges and says how to get it.
      const b = document.querySelector(`.jukebox-item[data-track="${id}"]`);
      if (b) {
        b.querySelector('.jb-sub').textContent = `Gra w dzielnicy ${this.trackSource(MUSIC_TRACK_BY_ID[id])} — dotrzyj tam w Kampanii`;
        b.classList.remove('jb-nudge'); void b.offsetWidth; b.classList.add('jb-nudge');
      }
      this.sound.bump();
      return;
    }
    this.save.settings.musicPick = id;
    if (this.save.settings.music === false) this.save.settings.music = true;
    saveGame(this.save);
    this.sound.unlock();
    this.sound.applySettings();
    // Preview: the pinned track (or the next of the mix) starts right away.
    this.sound.playTrack(id === 'auto' ? this.sound.nextGameplayTrack() : id, { restart: true });
    document.querySelectorAll('.jukebox-item').forEach(b => b.classList.toggle('is-active', b.dataset.track === id));
    this.syncControlsPanel();
    this.analytics.track('music_pick', { track: id });
  }

  /* ---------- gameplay ---------- */

  spawnParticles(x, y, color, count, speedMult = 1) {
    const cap = CONFIG.juice.maxParticles;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= cap) this.particles.shift();
      const kind = i % 4 === 0 ? 'spark' : (i % 3 === 0 ? 'pixel' : 'dot');
      this.particles.push(new Particle(x, y, color, kind, speedMult));
    }
  }

  /* ---------- Golden Shot v8 juice helpers ---------- */

  addFloatText(x, y, text, color, size = 16, life = 0.9) {
    if (this.floatTexts.length > 40) this.floatTexts.shift();
    this.floatTexts.push(new FloatText(x, y, text, color, size, life));
  }

  flashScreen(color, alpha = 0.35) {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  /** One center banner at a time (player feedback: animations piled on
   *  top of each other). A higher-`priority` banner replaces the current
   *  one; an equal/lower one waits in a short queue (max 2, newest kept). */
  showBanner(text, sub, color, duration = 1.1, priority = 1) {
    const b = { text, sub, color, life: duration, maxLife: duration, priority, scale: priority >= 5 ? 2.2 : 1 };
    if (!this.banner || priority > this.banner.priority) { this.banner = b; return; }
    this.bannerQueue = (this.bannerQueue || []).filter(q => q.priority >= priority).slice(-1);
    this.bannerQueue.push(b);
  }

  /** The player's score gains merge into one "+N" that rides above the
   *  hole and keeps counting up while eats keep coming, instead of a
   *  separate pop-up per object. */
  addScorePop(hole, pts, color) {
    const sp = this.scorePop;
    if (sp && !sp.dead && sp.follow === hole) {
      sp.value += pts;
      sp.text = `+${sp.value}`;
      sp.color = color;
      sp.size = Math.min(34, 17 + Math.sqrt(sp.value) * 0.9);
      sp.life = sp.maxLife;
      sp.offset = 0;
      sp.bumpAt = performance.now();
      return;
    }
    const f = new FloatText(hole.x, hole.y, `+${pts}`, color, 17, 1.1, 60, hole);
    f.value = pts;
    f.bumpAt = performance.now();
    this.scorePop = f;
    this.floatTexts.push(f);
  }

  /** Matter from an eaten object streaming into `hole`. */
  spawnSuck(x, y, color, count, hole, spread) {
    const cap = CONFIG.juice.maxParticles;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= cap) this.particles.shift();
      const a = rand(0, Math.PI * 2);
      const p = new Particle(x + Math.cos(a) * spread * rand(0.2, 1), y + Math.sin(a) * spread * rand(0.2, 1), color, 'suck');
      p.vx = Math.cos(a) * rand(40, 140);
      p.vy = Math.sin(a) * rand(40, 140);
      p.radius = rand(2, 3.5);
      p.maxLife = p.life = 1.4;
      p.target = hole;
      this.particles.push(p);
    }
  }

  hitStop(ms) {
    this.hitStopUntil = Math.max(this.hitStopUntil, performance.now() + ms);
  }

  /** Per-frame upkeep for the v8 juice layer, shared by Arena and Campaign. */
  updateJuice(dt) {
    for (const g of this.swallowGhosts) g.t += dt / 0.45;
    if (this.swallowGhosts.length) this.swallowGhosts = this.swallowGhosts.filter(g => g.t < 1);
    this.floatTexts.forEach(f => f.update(dt));
    this.floatTexts = this.floatTexts.filter(f => !f.dead);
    if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.4);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = (this.bannerQueue && this.bannerQueue.shift()) || null;
    }
    // Final 5 seconds: each second takes the banner slot (highest priority).
    const tr = this.mode === 'campaign' ? (this.mission && this.mission.timeRemaining) : this.timeRemaining;
    const sec = Math.ceil(tr || 0);
    if (tr > 0 && sec <= 5 && sec !== this.lastCountdownSec) {
      this.lastCountdownSec = sec;
      this.showBanner(String(sec), sec === 1 ? 'OSTATNIA SEKUNDA!' : null, sec <= 3 ? '#FF54AD' : '#EFCB63', 0.9, 5);
      this.sound.tick(sec <= 3);
    }
  }

  /** Screen-space juice: color flash, center banner and the final-seconds
   *  countdown. Drawn after the world transform is restored. */
  drawJuiceScreen(ctx, timeRemaining) {
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.flashAlpha > 0) {
      ctx.globalAlpha = this.flashAlpha;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalAlpha = 1;
    }
    this.drawFrenzyVignette(ctx);
    this.drawComboHud(ctx);
    if (this.mode === 'arena') this.drawChallengeTarget(ctx);
    const b = this.banner;
    if (b) {
      const age = 1 - b.life / b.maxLife;
      const pop = age < 0.12 ? 0.4 + (age / 0.12) * 0.8 : (age < 0.22 ? 1.2 - ((age - 0.12) / 0.1) * 0.2 : 1);
      const alpha = clamp(b.life / (b.maxLife * 0.3), 0, 1);
      const size = Math.min(58, this.width * 0.1) * (b.scale || 1);
      ctx.globalAlpha = alpha;
      ctx.translate(this.width / 2, this.height * 0.3);
      ctx.scale(pop, pop);
      ctx.rotate(-0.04);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${size}px ${FONT_DISPLAY}`;
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(4, 16, 29, 0.9)';
      ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color;
      ctx.shadowBlur = 26;
      ctx.shadowColor = b.color;
      ctx.fillText(b.text, 0, 0);
      if (b.sub) {
        ctx.shadowBlur = 0;
        ctx.font = `800 ${Math.max(12, size * 0.26)}px ${FONT_UI}`;
        ctx.lineWidth = 4;
        ctx.strokeText(b.sub, 0, size * 0.72);
        ctx.fillStyle = '#f2f8ff';
        ctx.fillText(b.sub, 0, size * 0.72);
      }
    }
    ctx.restore();
  }

  /** Golden Shot v9 SZAŁ (frenzy): active while the round clock is above
   *  frenzyEndsAt (round time, so pauses/evolution offers don't eat it). */
  get frenzyActive() {
    return this.mode === 'arena' && this.frenzyEndsAt != null && this.timeRemaining > this.frenzyEndsAt;
  }

  /** Object eat gate for a hole -- the player may eat one growth tier
   *  higher while SZAŁ is active. */
  holeCanEat(hole, obj) {
    const bonus = hole.isPlayer && this.frenzyActive ? 1 : 0;
    return getSizeTierIndex(hole.radius) + bonus >= TIERS[obj.tier].minSizeTier;
  }

  spawnGoldenCore() {
    const G = CONFIG.golden;
    const obj = new WorldObject('golden');
    let pos;
    for (let tries = 0; tries < 20; tries++) {
      pos = this.randomWorldPos(120);
      if (dist(pos.x, pos.y, this.player.x, this.player.y) >= G.minDistance) break;
    }
    obj.x = pos.x;
    obj.y = pos.y;
    obj.expiresAt = this.timeRemaining - G.lifetime;
    this.objects.push(obj);
    this.goldenObj = obj;
    this.showBanner('ZŁOTY RDZEŃ!', 'Złap go przed rywalami — złota strzałka wskazuje drogę', '#EFCB63', 1.3, 2);
    this.analytics.track('golden_core_spawn', {});
  }

  /** Spawns/expires the Złoty Rdzeń on CONFIG.golden's schedule. */
  updateGoldenCore(dt) {
    const G = CONFIG.golden;
    const g = this.goldenObj;
    if (g && !g.eating && this.timeRemaining < g.expiresAt) {
      this.objects = this.objects.filter(o => o !== g);
      this.goldenObj = null;
      this.goldenTimer = G.interval;
    }
    if (!this.goldenObj && this.timeRemaining > 6) {
      this.goldenTimer -= dt;
      if (this.goldenTimer <= 0) this.spawnGoldenCore();
    }
  }

  startFrenzy() {
    const G = CONFIG.golden;
    this.frenzyEndsAt = this.timeRemaining - G.frenzySeconds;
    this.showBanner('SZAŁ!', 'Punkty ×2 · jesz o rozmiar większe obiekty', '#EFCB63', 1.4, 4);
    this.sound.frenzy();
    this.flashScreen('#EFCB63', 0.25);
    this.triggerShake(8);
    this.ripples.push(new Ripple(this.player.x, this.player.y, '#EFCB63', this.player.radius, this.player.radius * 4, 0.7));
    this.vibrate([40, 30, 80]);
    this.analytics.track('frenzy_start', {});
  }

  /** Gold edge vignette + "SZAŁ" timer bar while frenzy runs. */
  drawFrenzyVignette(ctx) {
    if (!this.frenzyActive) return;
    const left = this.timeRemaining - this.frenzyEndsAt;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 120);
    const g = ctx.createRadialGradient(this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.35, this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.75);
    g.addColorStop(0, 'rgba(239, 203, 99, 0)');
    g.addColorStop(1, `rgba(239, 203, 99, ${0.22 + 0.12 * pulse})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);
    const w = 134, x = 16, y = 186;
    ctx.fillStyle = 'rgba(4, 16, 29, 0.75)';
    roundRectPath(ctx, x - 8, y - 26, w + 16, 40, 12);
    ctx.fill();
    ctx.font = `16px ${FONT_DISPLAY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#EFCB63';
    ctx.fillText(`SZAŁ ×2 · ${Math.ceil(left)} s`, x, y - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x, y + 2, w, 5);
    ctx.fillStyle = '#EFCB63';
    ctx.fillRect(x, y + 2, w * clamp(left / CONFIG.golden.frenzySeconds, 0, 1), 5);
  }

  /** Golden Shot v9: the equipped Rdzeń's bonus of `type` (0 if none).
   *  Only active in Arena/Daily rounds (this.activePerks is cleared for
   *  Campaign, whose missions are hand-balanced). */
  perk(type) {
    const p = (this.activePerks || []).find(x => x.type === type);
    return p ? p.value : 0;
  }

  /** Combo counter in a fixed screen spot (left, under the top HUD strip)
   *  instead of floating over the hole, where it collided with banners and
   *  score pops. Pops on every new link; the bar is the time left to chain. */
  drawComboHud(ctx) {
    if (this.comboCount < 2 || this.comboDisplayAlpha <= 0) return;
    const popT = this.comboPopAt ? (performance.now() - this.comboPopAt) / 200 : 1;
    const pop = popT < 1 ? 1 + 0.25 * Math.sin(popT * Math.PI) : 1;
    const m = this.comboMultiplier;
    const color = m >= 2.5 ? '#FF54AD' : (m >= 1.9 ? '#9875FF' : (m >= 1.4 ? '#EFCB63' : '#50F0FA'));
    const x = 16, y = 96;
    ctx.save();
    ctx.globalAlpha = this.comboDisplayAlpha;
    ctx.fillStyle = 'rgba(4, 16, 29, 0.62)';
    roundRectPath(ctx, x - 8, y - 38, 150, 62, 12);
    ctx.fill();
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `800 11px ${FONT_UI}`;
    ctx.fillStyle = 'rgba(242, 248, 255, 0.75)';
    ctx.fillText('COMBO', 0, -22);
    ctx.font = `30px ${FONT_DISPLAY}`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(4, 16, 29, 0.85)';
    const label = `×${this.comboCount}`;
    ctx.strokeText(label, 0, 6);
    ctx.fillStyle = color;
    ctx.shadowBlur = 14;
    ctx.shadowColor = color;
    ctx.fillText(label, 0, 6);
    const w = ctx.measureText(label).width;
    ctx.shadowBlur = 0;
    ctx.font = `800 13px ${FONT_UI}`;
    ctx.fillStyle = '#f2f8ff';
    ctx.fillText(`PKT x${m.toFixed(1)}`, w + 8, 4);
    const windowS = (this.comboWindowOverride || CONFIG.juice.combo.windowSeconds) + this.perk('comboWindow');
    const frac = clamp(this.comboTimer / windowS, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 14, 110, 4);
    ctx.fillStyle = color;
    ctx.fillRect(0, 14, 110 * frac, 4);
    ctx.restore();
  }

  /** 0 (first runs: guaranteed easy wins) .. 1 (full difficulty wall), from
   *  the player's Arena career -- see CONFIG.difficulty. */
  computeDifficultyT() {
    const D = CONFIG.difficulty;
    if (this.isDailyRun || this.challenge) return D.dailyT; // same rivals for everyone on a shared seed
    const runs = this.save.stats.runsPlayed || 0;
    return clamp((runs - D.rampStartRuns) / (D.rampFullRuns - D.rampStartRuns), 0, 1);
  }

  difficultyLabel(t) {
    const labels = CONFIG.difficulty.labels;
    return labels[Math.min(labels.length - 1, Math.floor(t * labels.length))];
  }

  /** Camera half-extent in world units (Arena zooms out as the hole grows). */
  get viewHalfW() { return this.width / 2 / this.zoom; }
  get viewHalfH() { return this.height / 2 / this.zoom; }

  triggerShake(amount) {
    this.shake = Math.max(this.shake, amount);
  }

  /** Eat feedback scaled by what got eaten: tiny = a subtle tick, medium =
   *  pulse + particles, giant = heavier shake + particles + a ring ripple
   *  (GDD 5.4 — "eat feedback zależny od wielkości"). */
  triggerEatFeedback(x, y, color, eatenRadius, isPlayerInvolved, eater) {
    const { tinyMaxRadius, mediumMaxRadius } = CONFIG.juice.eatTiers;
    const size = eatenRadius <= tinyMaxRadius ? 0 : (eatenRadius <= mediumMaxRadius ? 1 : 2);
    // GDD 4.0 §5.3 "Efekt pochłaniania" cosmetic: the player's selected
    // burst color overrides the eaten object's own color, but only for
    // eats the player caused ('classic' has color: null, i.e. no override).
    const effectId = this.save && this.save.effects && this.save.effects.selected;
    const effect = EAT_EFFECTS.find(e => e.id === effectId);
    const burstColor = (isPlayerInvolved && effect && effect.color) || color;
    // Golden Shot v9: the eaten matter is sucked into the hole that ate it
    // (it's a black hole -- nothing flies outward except on big eats).
    const suck = [6, 11, 18][size];
    if (eater) this.spawnSuck(x, y, burstColor, isPlayerInvolved ? suck : Math.ceil(suck / 3), eater, Math.max(6, eatenRadius));
    else this.spawnParticles(x, y, burstColor, suck);
    if (!isPlayerInvolved) return;
    if (eater && eater.isPlayer && this.sound) this.sound.eat(eatenRadius, this.comboCount);
    if (size === 2) {
      this.spawnParticles(x, y, burstColor, 12, 1.3);
      this.ripples.push(new Ripple(x, y, burstColor, eatenRadius * 0.6, eatenRadius * 2.6, 0.45));
      this.triggerShake(8);
      this.hitStop(CONFIG.juice.hitStopMs * 0.5);
    } else if (size === 1) {
      this.triggerShake(2.5);
    }
  }

  /** Bumps the player's combo (consecutive eats within the combo window)
   *  and returns the current score multiplier. Fades out smoothly rather
   *  than cutting abruptly when the window lapses (see update()). */
  registerCombo() {
    this.comboCount++;
    // Combo Reactor mutation (Phase 4) extends the window for this run only.
    this.comboTimer = (this.comboWindowOverride || CONFIG.juice.combo.windowSeconds) + this.perk('comboWindow');
    // Campaign uses its own multiplier cap (GDD 07: "combo 1,0-2,0 mnoży
    // punkty, nie wzrost"); Arena/Daily keep their existing tuned cap.
    const maxMultiplier = this.mode === 'campaign' ? CONFIG.campaign.comboMaxMultiplier : CONFIG.juice.combo.maxMultiplier;
    this.comboMultiplier = clamp(1 + (this.comboCount - 1) * CONFIG.juice.combo.stepBonus, 1, maxMultiplier);
    this.comboDisplayAlpha = 1;
    this.comboPopAt = performance.now();
    const praise = CONFIG.juice.praise.find(([n]) => n === this.comboCount);
    if (praise) {
      const PRAISE_COLORS = ['#50F0FA', '#FF54AD', '#EFCB63', '#9875FF', '#46D99A'];
      const color = PRAISE_COLORS[CONFIG.juice.praise.indexOf(praise) % PRAISE_COLORS.length];
      this.showBanner(praise[1], `COMBO ×${this.comboCount}`, color, 1.0, 1);
      this.sound.whoosh();
      this.vibrate([20, 30, 40]);
    }
    if (this.activeMutations.has('slipstream') && this.comboCount >= CONFIG.evolution.slipstreamComboThreshold) {
      this.speedBoostUntil = performance.now() + CONFIG.evolution.slipstreamMs;
    }
    return this.comboMultiplier;
  }

  handleObjectEating(hole) {
    const reach = hole.radius * 0.85 * (hole.isPlayer && this.frenzyActive ? CONFIG.golden.reachMult : 1);
    for (const obj of this.objects) {
      if (obj.eating) continue;
      if (!this.holeCanEat(hole, obj)) {
        if (hole.isPlayer && Math.abs(obj.x - hole.x) < hole.radius + obj.radius && Math.abs(obj.y - hole.y) < hole.radius + obj.radius) {
          const m = TIERS[obj.tier].minSizeTier;
          this.lockedBump(obj, CONFIG.sizeTiers[m].shortId, CONFIG.sizeTiers[m].color, hole);
        }
        continue;
      }
      const d = dist(hole.x, hole.y, obj.x, obj.y);
      if (d < reach) obj.startEating(hole);
    }
  }

  /** v13: rolling over something still too big used to do nothing at all
   *  (QA: "the hole slides over cars silently"). A small tag names the size
   *  it needs -- throttled per object and globally so it never spams. */
  lockedBump(obj, tierLabel, color, hole) {
    const now = performance.now();
    if (dist(hole.x, hole.y, obj.x, obj.y) > hole.radius * 0.85 + obj.radius * 0.3) return;
    if ((this.lockHintAt != null && now - this.lockHintAt < 2500) || (obj.lockHintAt != null && now - obj.lockHintAt < 7000)) return;
    this.lockHintAt = obj.lockHintAt = now;
    this.addFloatText(obj.x, obj.y - obj.radius - 8, `ZA DUŻE · URÓŚNIJ DO ${tierLabel}`, color, 13, 1.1);
    if (hole && hole.isPlayer) this.sound.bump();
  }

  handleHoleCollisions() {
    const holes = [this.player, ...this.bots];
    for (let i = 0; i < holes.length; i++) {
      for (let j = 0; j < holes.length; j++) {
        if (i === j) continue;
        const a = holes[i], b = holes[j];
        if (b.invulnerable) continue;
        if (a.radius <= b.radius * EAT_HOLE_RATIO) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < a.radius * 0.75) {
          // Phase 7 "Shield" run tool: fully negates one collision instead
          // of softening it (Phase Edge softens; Shield blocks outright).
          if (b.isPlayer && this.shieldCharges > 0) {
            this.shieldCharges--;
            this.spawnParticles(b.x, b.y, '#50F0FA', 20);
            this.sound.shield();
            this.vibrate(60);
            continue;
          }

          a.growFromArea(Math.PI * b.radius * b.radius * GROW_K_HOLE);
          const multiplier = a.isPlayer ? this.registerCombo() : (a.paceMult || 1);
          const isBounty = a.isPlayer && b === this.bountyTarget;
          const rivalPts = Math.round(b.radius * 2 * multiplier * (a.isPlayer ? (1 + this.perk('score')) * (this.frenzyActive ? CONFIG.golden.scoreMult : 1) : 1)) + (isBounty ? CONFIG.evolution.bountyBonusScore : 0);
          a.score += rivalPts;
          if (isBounty) this.bountyTarget = null;
          this.triggerEatFeedback(b.x, b.y, b.isPlayer ? '#50F0FA' : b.edgeColor, b.radius, a.isPlayer || b.isPlayer, a);
          if (a.isPlayer) {
            this.addFloatText(b.x, b.y - b.radius - 10, `ZJEDZONY! +${rivalPts}`, '#EFCB63', 22, 1.2, 40);
            this.sound.rivalEaten();
            this.hitStop(CONFIG.juice.hitStopMs);
            this.triggerShake(10);
          } else if (b.isPlayer) {
            this.flashScreen('#FF54AD', 0.3);
            this.showBanner('ZJEDZONO CIĘ!', 'Chwila ochrony — rośnij dalej', '#FF54AD', 1.4, 3);
            this.sound.hurt();
            this.triggerShake(12);
          }
          if (a.isPlayer) {
            this.rivalsEatenThisRun++;
            this.analytics.track('rival_eaten', { rival: b.name, rivalSize: Math.round(b.radius), bounty: isBounty });
            this.vibrate(40);
          } else if (b.isPlayer) {
            this.analytics.track('player_eaten', { by: a.name, playerSize: Math.round(b.radius) });
            this.vibrate([30, 40, 30]);
          }
          const phaseEdgeBonus = (b.isPlayer && this.activeMutations.has('phase_edge')) ? CONFIG.evolution.phaseEdgeInvulnBonusMs : 0;
          this.addSwallowGhost(a, b, b.isPlayer ? '#50F0FA' : b.edgeColor);
          b.shrinkAndRespawn(phaseEdgeBonus);
        }
      }
    }
  }

  /** Fires a `size_tier` analytics event the first time the player's radius
   *  crosses into a new tier this run. Tiers are analytics-only for now
   *  (Phase 4 will attach visuals/evolution offers to the same thresholds). */
  /** Tracks the best value reached this run for whichever metric today's
   *  mission cares about. Checked against the target at round end
   *  (finalizeRun) rather than mid-round, so a mission can't be granted
   *  twice and the reward always lines up with the results screen. */
  checkMissionProgress() {
    if (!this.activeMission) return;
    let current = 0;
    switch (this.activeMission.id) {
      case 'eat_5_rivals': current = this.rivalsEatenThisRun; break;
      case 'reach_size_60': current = this.player.radius; break;
      case 'combo_x3': current = this.comboCount; break;
      case 'score_150': current = this.player.score; break;
    }
    this.missionProgressPeak = Math.max(this.missionProgressPeak, current);
  }

  checkSizeTier() {
    const tiers = CONFIG.sizeTiers;
    let current = tiers[0];
    for (const tier of tiers) {
      if (this.player.radius >= tier.minRadius) current = tier;
    }
    if (current.id !== this.lastSizeTierId) {
      this.lastSizeTierId = current.id;
      this.analytics.track('size_tier', { tier: current.id, radius: Math.round(this.player.radius) });
      // Growth-tier transition pulse, in the new tier's own color (matches
      // the badge and the objects it just unlocked). Phase 4's evolution offers trigger from the same
      // radius crossings via CONFIG.evolution.triggerRadii, checked
      // separately in checkEvolutionTriggers() below.
      this.ripples.push(new Ripple(this.player.x, this.player.y, current.color, this.player.radius, this.player.radius * 2.5, 0.5));
      // v12: a shockwave that sweeps across the whole city floor on screen.
      const sweep = new Ripple(this.player.x, this.player.y, current.color, this.player.radius * 1.2, Math.hypot(this.viewHalfW, this.viewHalfH) * 1.1, 0.75);
      sweep.lineWidth = 6 / this.zoom;
      this.ripples.push(sweep);
      this.spawnParticles(this.player.x, this.player.y, current.color, 22, 1.5);
      this.showBanner(`${current.label}!`, 'NOWE OBIEKTY DO POCHŁONIĘCIA', current.color, 1.3, 2);
      this.sound.tierUp();
      this.flashScreen(current.color, 0.18);
      this.vibrate(60);

      if (this.activeMutations.has('shockwave')) {
        for (const obj of this.objects) {
          const d = dist(this.player.x, this.player.y, obj.x, obj.y);
          if (d > 0 && d < CONFIG.evolution.shockwaveRadius && !obj.eating) {
            const push = CONFIG.evolution.shockwavePush * (1 - d / CONFIG.evolution.shockwaveRadius);
            obj.x += ((obj.x - this.player.x) / d) * push;
            obj.y += ((obj.y - this.player.y) / d) * push;
          }
        }
        this.ripples.push(new Ripple(this.player.x, this.player.y, '#FF54AD', this.player.radius, CONFIG.evolution.shockwaveRadius, 0.4));
      }
    }
  }

  /** Weighted, seed-driven pick from a small pool of run-only mutations —
   *  never duplicates within one offer (GDD 4.1). */
  pickMutationCards() {
    const available = MUTATIONS.filter(m => !this.activeMutations.has(m.id));
    const pool = (available.length >= CONFIG.evolution.cardCount ? available : MUTATIONS).slice();
    const chosen = [];
    for (let i = 0; i < CONFIG.evolution.cardCount && pool.length; i++) {
      const totalWeight = pool.reduce((sum, m) => sum + m.weight, 0);
      let roll = this.rng.next() * totalWeight;
      let idx = pool.length - 1;
      for (let j = 0; j < pool.length; j++) {
        roll -= pool[j].weight;
        if (roll <= 0) { idx = j; break; }
      }
      chosen.push(pool.splice(idx, 1)[0]);
    }
    return chosen;
  }

  /** Fires an evolution moment: fully pauses the round (player feedback --
   *  it used to only slow down via slowMotionFactor) and shows up to
   *  CONFIG.evolution.cardCount cards above the Thumb Pad zone. The player
   *  can pick a card or hit "POMIŃ" to close the window without picking;
   *  autoPickMs is only a safety net against an AFK tab. */
  offerEvolution() {
    this.hideNelaToast();
    this.evolutionPending = true;
    const cards = this.pickMutationCards();
    this.analytics.track('evolution_offer', { options: cards.map(c => c.id) });
    this.showPowerCards(cards, id => this.pickMutation(id), 'Działa do końca tej rundy. Gra czeka, aż wybierzesz.');
    clearTimeout(this.evolutionAutoPickTimer);
    this.evolutionAutoPickTimer = setTimeout(() => {
      if (this.evolutionPending && cards[0]) this.pickMutation(cards[0].id);
    }, CONFIG.evolution.autoPickMs);
  }

  pickMutation(id) {
    this.pointerScreen = null;
    if (!this.evolutionPending) return;
    clearTimeout(this.evolutionAutoPickTimer);
    this.evolutionPending = false;
    this.activeMutations.add(id);
    document.getElementById('evolutionOverlay').classList.add('hidden');
    this.analytics.track('evolution_pick', { mutation: id });
    this.vibrate(50);

    if (id === 'magnet_pulse') this.magnetUntil = Infinity;
    if (id === 'combo_reactor') this.comboWindowOverride = CONFIG.juice.combo.windowSeconds * 1.6;
    if (id === 'bounty_core') this.assignBountyTarget();
  }

  /** "POMIŃ" — closes the evolution/power overlay without picking anything
   *  (player feedback: the player must be able to close the window, not
   *  just pick or wait out the auto-pick timer). Shared by both Arena
   *  mutations and Campaign powers since they reuse the same overlay. */
  skipEvolutionOffer() {
    this.pointerScreen = null;
    if (!this.evolutionPending) return;
    clearTimeout(this.evolutionAutoPickTimer);
    this.evolutionPending = false;
    document.getElementById('evolutionOverlay').classList.add('hidden');
    document.getElementById('evolutionCards').classList.remove('count-2');
    this.analytics.track('evolution_skip', { mode: this.mode === 'campaign' ? 'campaign' : 'arena' });
  }

  /** Marks the nearest eligible rival as a Bounty target (crown marker,
   *  one-time score bonus when the player eats it — GDD 4.1). */
  assignBountyTarget() {
    let target = null, targetDist = Infinity;
    for (const bot of this.bots) {
      const d = dist(this.player.x, this.player.y, bot.x, bot.y);
      if (d < targetDist) { target = bot; targetDist = d; }
    }
    this.bountyTarget = target;
  }

  checkEvolutionTriggers() {
    if (this.evolutionPending) return;
    for (const r of CONFIG.evolution.triggerRadii) {
      if (this.player.radius >= r && !this.evolutionOffersTriggered.has(r)) {
        this.evolutionOffersTriggered.add(r);
        this.offerEvolution();
        return;
      }
    }
  }

  /** Final-seconds City Shift (GDD 4.2). Seed-driven variant pick so a
   *  Daily Seed Challenge run gets the same Overdrive for everyone. */
  checkOverdriveTrigger() {
    if (this.overdriveActive || this.timeRemaining > CONFIG.overdrive.triggerSecondsRemaining) return;
    this.overdriveActive = true;
    const variants = CONFIG.overdrive.variants;
    this.overdriveVariant = variants[Math.floor(this.rng.next() * variants.length)];
    this.overdriveTag = this.overdriveVariant === 'blackout' ? 'ZACIEMNIENIE' : 'BURZA PORTALI';
    this.analytics.track('overdrive_start', { variant: this.overdriveVariant, runId: this.runId });
    this.vibrate([60, 40, 60]);
    this.flashScreen('#9875FF', 0.25);
    this.triggerShake(8);

    // GDD 4.0 §5.3 "Overdrive" cosmetic: a tint on the existing seeded
    // finish -- doesn't change which variant is picked, just its color.
    const skinId = this.save && this.save.overdriveSkins && this.save.overdriveSkins.selected;
    const skin = OVERDRIVE_SKINS.find(s => s.id === skinId);
    // Golden Shot v9: shown through the shared canvas banner slot (was a
    // separate DOM banner that overlapped the canvas banners).
    this.showBanner('WIELKI FINISZ!', this.overdriveTag, (skin && skin.color) || '#9875FF', 1.6, 3);
    this.sound.overdrive();

    if (this.overdriveVariant === 'portal_rain') this.spawnPortalRain();
  }

  /** One-time wave of high-value bonus objects — the comeback opportunity
   *  half of Overdrive (GDD 4.2). They fold back into the normal object
   *  pool once eaten, so no cleanup/tracking is needed after the round. */
  spawnPortalRain() {
    for (let i = 0; i < CONFIG.overdrive.bonusObjectCount; i++) {
      // TIERS.portal has minSizeTier 0 -- deliberately ungated, since this
      // bonus wave is a comeback opportunity for whoever's behind (GDD
      // 4.2), including a player who never grew past T1.
      const obj = new WorldObject('portal');
      const pos = this.randomWorldPos(obj.radius + 20);
      obj.x = pos.x;
      obj.y = pos.y;
      obj.value = CONFIG.overdrive.bonusObjectValue;
      this.objects.push(obj);
    }
  }

  /** Per-frame upkeep for whichever mutation the player picked this run —
   *  Magnet Pulse, Slipstream's speed window, and the Scanner ping. */
  updateMutationEffects(dt) {
    const now = performance.now();

    const fullMagnet = now < this.magnetUntil || now < this.toolMagnetUntil;
    const magnetRadius = Math.max(fullMagnet ? CONFIG.evolution.magnetRadius : this.perk('magnet'), this.frenzyActive ? CONFIG.golden.magnetRadius : 0);
    if (magnetRadius > 0) {
      for (const obj of this.objects) {
        if (obj.eating || !this.holeCanEat(this.player, obj)) continue;
        const d = dist(this.player.x, this.player.y, obj.x, obj.y);
        if (d > 0 && d < magnetRadius) {
          const pull = CONFIG.evolution.magnetPull * (1 - d / magnetRadius);
          obj.x -= ((obj.x - this.player.x) / d) * pull * dt;
          obj.y -= ((obj.y - this.player.y) / d) * pull * dt;
        }
      }
    }

    this.player.tempSpeedMult = (now < this.speedBoostUntil ? CONFIG.evolution.slipstreamSpeedMult : 1) * (this.frenzyActive ? CONFIG.golden.speedMult : 1);

    if (this.activeMutations.has('scanner')) {
      this.scannerTimer -= dt;
      if (this.scannerTimer <= 0) {
        this.scannerTimer = CONFIG.evolution.scannerIntervalSeconds;
        let best = null, bestValue = -Infinity;
        for (const obj of this.objects) {
          if (obj.eating) continue;
          if (obj.value > bestValue) { best = obj; bestValue = obj.value; }
        }
        if (best) {
          this.scannerTarget = best;
          this.scannerTargetUntil = now + 2000;
          this.ripples.push(new Ripple(best.x, best.y, '#50F0FA', best.radius, best.radius * 3, 0.6));
        }
      }
    }
  }

  /** Picks the active input source and moves the player accordingly.
   *  Priority: keyboard (explicit accessibility input) > active Thumb Pad
   *  touch > mouse/legacy-drag chase. On a touch device in Thumb Pad mode
   *  with no finger down, the player correctly stands still instead of
   *  drifting toward a stale pointer position. */
  applyPlayerMovement(dt) {
    const sensitivity = this.save.settings.sensitivity || 1;
    if (this.keyDir.x !== 0 || this.keyDir.y !== 0) {
      this.player.moveDirection(this.keyDir.x, this.keyDir.y, 1, sensitivity, dt);
      return;
    }
    if (this.thumbpadTouchId !== null) {
      this.player.moveDirection(this.moveVector.x, this.moveVector.y, this.moveVector.magnitude, sensitivity, dt);
      return;
    }
    if ((!this.useThumbpad || !this.isTouchDevice) && this.pointerScreen) {
      const p = this.pointerScreen;
      // Screen -> world through the current camera, so a held finger keeps
      // steering; a finger right over the hole parks it (no jitter).
      const tx = this.camera.x + (p.x - this.width / 2) / this.zoom;
      const ty = this.camera.y + (p.y - this.height / 2) / this.zoom;
      this.pointerWorld = { x: tx, y: ty };
      // Dead zone = the inner part of the hole on screen, so a cursor or
      // finger resting on the hole parks it (desktop has no "lift").
      const sd = Math.hypot(tx - this.player.x, ty - this.player.y) * this.zoom;
      if (sd > Math.max(8, this.player.radius * this.zoom * 0.6)) this.player.moveToward(tx, ty, dt);
    }
  }

  update(dt) {
    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.endRound();
      return;
    }

    this.applyPlayerMovement(dt);
    const D = CONFIG.difficulty;
    const late = this.timeRemaining <= D.lateRoundSeconds;
    if (late && !this.lateRoundAnnounced) {
      this.lateRoundAnnounced = true;
      this.showBanner('FINAŁOWE 40 S', 'Rywale przyspieszają!', '#FF54AD', 1.3, 2);
    }
    for (const bot of this.bots) {
      bot.tempSpeedMult = (bot.baseSpeedMult || 1) * (late ? 1 + D.lateRoundBotSpeedBonus : 1);
      if (this.botTuning.passive > 0) bot.radius = Math.min(CONFIG.hole.maxRadius, radiusForUnits(unitsForRadius(bot.radius) + this.botTuning.passive * dt));
      bot.update(dt, this);
    }

    for (const obj of this.objects) obj.update(dt);

    this.handleObjectEating(this.player);
    for (const bot of this.bots) this.handleObjectEating(bot);

    for (const obj of this.objects) {
      if (obj.consumed) {
        const hole = obj.eater;
        hole.growUnits(TIERS[obj.tier].growth * (hole.isPlayer ? 1 + this.perk('growth') : Math.min(hole.paceMult || 1, CONFIG.rival.maxGrowthBoost)));
        const multiplier = hole.isPlayer ? this.registerCombo() : (hole.paceMult || 1);
        const frenzyMult = hole.isPlayer && this.frenzyActive ? CONFIG.golden.scoreMult : 1;
        const pts = Math.round(obj.value * multiplier * frenzyMult * (hole.isPlayer ? 1 + this.perk('score') : 1));
        hole.score += pts;
        this.triggerEatFeedback(obj.x, obj.y, obj.color, obj.radius, hole.isPlayer, hole);
        if (hole.isPlayer) this.addScorePop(hole, pts, multiplier > 1.01 || frenzyMult > 1 ? '#EFCB63' : obj.color);
        if (obj.tier === 'golden') {
          obj.removed = true;
          this.goldenObj = null;
          this.goldenTimer = CONFIG.golden.interval;
          if (hole.isPlayer) this.startFrenzy();
          else this.showBanner(`${hole.name} ZGARNIA RDZEŃ`, 'Następny pojawi się niedługo', '#FF54AD', 1.1, 1);
          continue;
        }
        if (hole.isPlayer && !this.firstEatTracked) {
          this.firstEatTracked = true;
          this.analytics.track('first_eat', { objectTier: obj.tier });
        }
        obj.respawn(obj.tier, false);
      }
    }
    if (this.objects.some(o => o.removed)) this.objects = this.objects.filter(o => !o.removed);
    this.updateGoldenCore(dt);

    this.handleHoleCollisions();
    this.updatePacer();
    this.checkSizeTier();
    this.checkEvolutionTriggers();
    this.checkOverdriveTrigger();
    this.updateMutationEffects(dt);
    this.checkMissionProgress();

    this.particles.forEach(p => p.update(dt));
    this.particles = this.particles.filter(p => !p.dead);
    this.ripples.forEach(r => r.update(dt));
    this.ripples = this.ripples.filter(r => !r.dead);
    this.updateJuice(dt);

    this.updateCombo(dt);
    this.updateDangerWarnings();
    this.updateChallenge();
    this.sound.setIntensity(this.frenzyActive ? 3 : (late || this.overdriveActive ? 2 : 1));

    // Golden Shot v8: the camera zooms out as the hole grows (hole.io's
    // signature "the city keeps getting smaller" feel).
    const zc = CONFIG.juice.zoom;
    const growT = clamp((this.player.radius - zc.startRadius) / (zc.endRadius - zc.startRadius), 0, 1);
    let targetZoom = lerp(zc.max, zc.min, Math.sqrt(growT));
    targetZoom = Math.min(targetZoom, zc.holeScreenFrac * Math.min(this.width, this.height) / this.player.radius);
    targetZoom = Math.max(targetZoom, zc.floor, this.width / WORLD_W, this.height / WORLD_H);
    this.zoom += (targetZoom - this.zoom) * Math.min(1, dt * zc.lerp);
    const hw = this.viewHalfW, hh = this.viewHalfH;
    this.camera.x = clamp(this.player.x, hw, WORLD_W - hw);
    this.camera.y = clamp(this.player.y, hh, WORLD_H - hh);
    if (WORLD_W < hw * 2) this.camera.x = WORLD_W / 2;
    if (WORLD_H < hh * 2) this.camera.y = WORLD_H / 2;

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);

    this.updateHUD();
  }

  /** v13: steers the pacer rival along its par-score curve (CONFIG.rival).
   *  Score grows superlinearly with size, hence par * f^1.5. */
  updatePacer() {
    const b = this.pacer;
    if (!b || !this.parScore) return;
    const R = CONFIG.rival;
    const f = clamp(1 - this.timeRemaining / ROUND_TIME, 0, 1);
    const R2 = R.chaseRatio;
    const par = Math.max(this.parScore * Math.pow(f, 1.5), this.player.score * lerp(R2[0], R2[1], this.difficultyT));
    const diff = (par - b.score) / Math.max(150, this.parScore * 0.12);
    b.paceMult = diff > 0 ? 1 + Math.min(diff, R.maxBoost - 1) : Math.max(R.minMult, 1 + diff * 0.5);
    b.paceHungry = diff > 0.3;
  }

  /** Par for this round's pacer: the median of the player's last finished
   *  Arena rounds (CONFIG.rival.defaultPar before there are any) times a
   *  difficulty factor. Daily/challenge rounds use the fixed dailyT factor. */
  computeParScore() {
    const R = CONFIG.rival;
    // Shared seeds (Daily, friend challenges) get the same pacer for everyone.
    const shared = this.isDailyRun || this.challenge;
    const hist = shared ? [] : (this.save.stats.recentArenaScores || []).slice().sort((a, b) => a - b);
    // Until 3 finished rounds exist one lucky round would set the bar.
    const base = hist.length >= 3 ? hist[Math.floor(hist.length / 2)] : R.defaultPar;
    return Math.round(clamp(base, R.minPar, R.maxPar) * lerp(R.parFactor[0], R.parFactor[1], this.difficultyT));
  }

  /** Combo window countdown; fades the on-screen combo text smoothly over
   *  CONFIG.juice.combo.fadeSeconds once the window lapses, rather than
   *  cutting it abruptly (GDD 5.4). */
  updateCombo(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        this.comboCount = 0;
        this.comboMultiplier = 1;
      }
    }
    if (this.comboCount > 0) {
      this.comboDisplayAlpha = 1;
    } else if (this.comboDisplayAlpha > 0) {
      this.comboDisplayAlpha = Math.max(0, this.comboDisplayAlpha - dt / CONFIG.juice.combo.fadeSeconds);
    }
  }

  /** One-shot haptic warning the moment a threatening rival first enters
   *  danger range, re-armed once it leaves — avoids buzzing continuously
   *  while a threat lingers nearby (GDD 5.4: "haptic warning przy wejściu
   *  w strefę"). */
  updateDangerWarnings() {
    for (const bot of this.bots) {
      const isThreat = bot.radius > this.player.radius * EAT_HOLE_RATIO;
      const inRange = isThreat && dist(this.player.x, this.player.y, bot.x, bot.y) <= CONFIG.juice.dangerHaloRange;
      if (inRange && !this.dangerWarned.has(bot)) {
        this.dangerWarned.add(bot);
        this.vibrate(25);
        // v16: a heartbeat when a bigger rival closes in (at most every 4 s).
        const nowMs = performance.now();
        if (nowMs - (this.dangerSoundAt || 0) > 4000) { this.dangerSoundAt = nowMs; this.sound.danger(); }
      } else if (!inRange && this.dangerWarned.has(bot)) {
        this.dangerWarned.delete(bot);
      }
    }
  }

  /** Arena's in-round HUD reuses the same tier-strip markup as Campaign's
   *  updateCampaignHUD() (Czas/tier bar+badge/Wynik) -- only the standings
   *  panel on the right is Arena-specific, in place of Campaign's CEL RUNDY
   *  box, since Arena rounds have no mission goal to show there. */
  updateHUD() {
    this.hudSet('missionTimerValue', 'text', formatClock(this.timeRemaining));
    this.setHudScore(this.player.score);

    const tiers = CONFIG.sizeTiers;
    const tierIdx = tiers.findIndex(t => t.id === this.lastSizeTierId);
    const tier = tiers[tierIdx];
    const next = tiers[tierIdx + 1];
    // T1's minRadius is 0, but a round always starts at BASE_RADIUS (18), so
    // using tier.minRadius as the fill floor made the bar open ~73% full
    // with no visible room left to show progress toward T2 (player report:
    // "nie widać ile brakuje do kolejnego poziomu"). Floor at BASE_RADIUS
    // instead so the bar always fills from empty at round start.
    const floor = Math.max(tier.minRadius, BASE_RADIUS);
    const tierPct = next
      ? clamp((this.player.radius - floor) / (next.minRadius - floor), 0, 1) * 100
      : 100;
    this.setTierBadge(tier.shortId, tier.color, `${tier.label}${next ? ` · Postęp do ${next.shortId}` : ' · Poziom maksymalny'}`, tierPct);

    const ranked = rankHoles([this.player, ...this.bots]);
    ranked.forEach((h, i) => { h.isLeader = i === 0 && h.score > 0; });
    const place = ranked.indexOf(this.player) + 1;
    this.hudSet('rankValue', 'text', `#${place}/${ranked.length}`);
    const nowMs = performance.now();
    // Golden Shot v8: celebrate climbing into the podium mid-round (v13:
    // at most every 8 s -- a see-saw lead fired it 3x in 2 s).
    if (this.lastPlace !== null && place < this.lastPlace && place <= 3 && this.timeRemaining < ROUND_TIME - 2
      && nowMs - (this.climbBannerAt || 0) > 8000) {
      this.climbBannerAt = nowMs;
      this.showBanner(place === 1 ? 'PROWADZISZ!' : `AWANS NA ${place}. MIEJSCE`, null, '#EFCB63', 0.9, 1);
      if (place === 1) this.sound.leadTaken(); else this.sound.coin();
      this.vibrate(30);
    }
    // v13: losing the lead is the other half of the race -- name who did it.
    if (this.lastPlace === 1 && place > 1 && this.timeRemaining < ROUND_TIME - 5 && nowMs - (this.leadLostAt || 0) > 8000) {
      this.leadLostAt = nowMs;
      this.showBanner(`${ranked[0].name} PROWADZI`, 'Odbij pierwsze miejsce!', '#FF54AD', 1.0, 1);
      this.sound.leadLost();
    }
    if (!this.finalChaseShown && place > 1 && this.timeRemaining <= CONFIG.rival.finalChaseSeconds) {
      this.finalChaseShown = true;
      this.showBanner(`BRAKUJE ${formatNum(ranked[0].score - this.player.score + 1)} PKT`, `do 1. miejsca · zostało ${Math.ceil(this.timeRemaining)} s`, '#EFCB63', 1.4, 2);
    }
    this.lastPlace = place;
    document.getElementById('missionTimerValue').parentElement.parentElement.classList.toggle('hud-urgent', this.timeRemaining <= 10);

    // v12 compact standings: the podium plus your own row (with a gap
    // marker when you're below it) -- less of the play field covered.
    const row = (h, i) => `<li class="${h.isPlayer ? 'is-player' : ''}${i === 0 ? ' lb-first' : ''}"><span class="lb-rank">${i === 0 ? '<svg class="lb-crown" viewBox="0 0 24 24" aria-label="#1"><path d="M3 19h18l-1.6-11-5.2 4.2L12 4.5l-2.2 7.7L4.6 8z" fill="currentColor"/></svg>' : '#' + (i + 1)}</span><span class="lb-name">${escapeHtml(h.name)}</span><span class="lb-size">${h.score}</span></li>`;
    let html = ranked.slice(0, 3).map(row).join('');
    if (place > 3) html += (place > 4 ? '<li class="lb-gap" aria-hidden="true">···</li>' : '') + row(this.player, place - 1);
    this.hudSet('leaderboardList', 'html', html);
  }

  /* ---------- rendering ---------- */

  /** v12: the Neon City floor (see CityFloor) under every Arena round,
   *  the night traffic on its roads and the pink neon edge of the world. */
  drawCityFloor(ctx, time) {
    const view = this.floorView();
    this.cityFloor.draw(ctx, view, null);
    if (this.gfxLevel > 0) this.cityFloor.drawTraffic(ctx, view, time, null, null, this.player);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 84, 173, 0.65)';
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#FF54AD';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
    ctx.restore();
  }

  /** v12: paint the blocks around the player's start position before the
   *  first frame, and free the menu art's chunks (welcome scene). */
  prewarmFloor() {
    SCREEN_FLOOR.clearChunks();
    const p = this.player;
    if (!p) return;
    const hw = this.viewHalfW, hh = this.viewHalfH;
    let cx, cy;
    if (this.mode === 'campaign') {
      const b = CONFIG.campaign.bounds;
      cx = b.maxX - b.minX < this.width ? (b.minX + b.maxX) / 2 : clamp(p.x, b.minX + this.width / 2, b.maxX - this.width / 2);
      cy = b.maxY - b.minY < this.height ? (b.minY + b.maxY) / 2 : clamp(p.y, b.minY + this.height / 2, b.maxY - this.height / 2);
    } else {
      cx = WORLD_W < hw * 2 ? WORLD_W / 2 : clamp(p.x, hw, WORLD_W - hw);
      cy = WORLD_H < hh * 2 ? WORLD_H / 2 : clamp(p.y, hh, WORLD_H - hh);
    }
    this.cityFloor.prewarm({ cx, cy, hw, hh, zoom: this.zoom, dpr: this.dpr, gfx: this.gfxLevel }, this.mode === 'campaign' ? this.campaignTheme() : null);
  }

  /** The camera's world-space view for CityFloor (both modes). */
  floorView() {
    return { cx: this.camera.x, cy: this.camera.y, hw: this.viewHalfW, hh: this.viewHalfH, zoom: this.zoom, dpr: this.dpr, gfx: this.gfxLevel };
  }

  /** Campaign paints the whole board in its mission's district. */
  campaignTheme() {
    const d = this.mission && campaignDistrictOf(this.mission.def.id);
    return (d && d.id) || 'plac';
  }

  /** District name over the minimap, in the district's color. */
  drawMinimapLabel(ctx, px, py, size, districtId) {
    const d = DISTRICTS.find(x => x.id === districtId);
    if (!d) return;
    const label = d.name.toUpperCase();
    ctx.font = `800 10px ${FONT_UI}`;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(2, 8, 16, 0.78)';
    roundRectPath(ctx, px + size - tw - 10, py - 19, tw + 10, 16, 5);
    ctx.fill();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = DISTRICT_COLORS[districtId] || '#50F0FA';
    ctx.fillText(label, px + size - 5, py - 11);
  }

  /** v12: a smaller minimap on narrow phones (130 px was 36 % of a 360 px screen). */
  minimapSize() { return this.width < 400 ? 104 : 130; }

  drawMinimap(ctx) {
    const size = this.minimapSize();
    const margin = 16;
    const px = this.width - size - margin;
    const py = this.height - size - margin;
    const scale = size / WORLD_W;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.cityFloor.minimap(Math.round(size * this.dpr), null, { minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H }), px, py, size, size);
    ctx.strokeStyle = 'rgba(80, 240, 250,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, size, size);
    this.drawMinimapLabel(ctx, px, py, size, cityDistrictAt(this.player.x, this.player.y));

    // Every object type gets a dot, not just the biggest ones -- previously
    // the minimap only showed large (green) objects, which read as "the map
    // only tracks green things" (player feedback). Sizing matches
    // drawCampaignMinimap()'s own convention (node/pylon/landmark bigger
    // than the rest) now that Arena's TIERS keys are the same type names.
    for (const obj of this.objects) {
      const tierDef = TIERS[obj.tier];
      const big = obj.tier === 'node' || obj.tier === 'pylon' || obj.tier === 'landmark';
      const dotSize = obj.tier === 'golden' ? 6 : (big ? 3.5 : 2);
      ctx.fillStyle = tierDef.color;
      ctx.fillRect(px + obj.x * scale - dotSize / 2, py + obj.y * scale - dotSize / 2, dotSize, dotSize);
    }
    this.drawMinimapHoles(ctx, (x, y) => ({ x: px + x * scale, y: py + y * scale }));

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(
      px + (this.camera.x - this.viewHalfW) * scale,
      py + (this.camera.y - this.viewHalfH) * scale,
      this.viewHalfW * 2 * scale,
      this.viewHalfH * 2 * scale
    );
    ctx.restore();
  }

  /** Edge arrows pointing at nearby larger rivals that are currently
   *  off-screen — contextual danger readability (GDD 5.3/5.4), kept to
   *  the single nearest threat to avoid visual noise. */
  /** Gold edge arrow toward an off-screen Złoty Rdzeń. */
  drawGoldenIndicator(ctx) {
    const g = this.goldenObj;
    if (!g) return;
    const sx = (g.x - this.camera.x) * this.zoom + this.width / 2;
    const sy = (g.y - this.camera.y) * this.zoom + this.height / 2;
    if (sx >= 0 && sx <= this.width && sy >= 0 && sy <= this.height) return;
    const cx = this.width / 2, cy = this.height / 2, margin = 40;
    const angle = Math.atan2(sy - cy, sx - cx);
    const ex = clamp(cx + Math.cos(angle) * (cx - margin), margin, this.width - margin);
    const ey = clamp(cy + Math.sin(angle) * (cy - margin), margin, this.height - margin);
    const pulse = 1 + 0.15 * Math.sin(performance.now() / 150);
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(ex, ey);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#EFCB63';
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#EFCB63';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(10, -8); ctx.lineTo(10, 8); ctx.closePath(); ctx.fill();
    ctx.rotate(-angle);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#07131E';
    ctx.font = `11px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', 0, 1);
    ctx.restore();
  }

  drawDangerIndicators(ctx) {
    const detectionRange = 700;
    const margin = 34;
    let nearest = null, nearestDist = Infinity;

    for (const bot of this.bots) {
      if (bot.radius <= this.player.radius * EAT_HOLE_RATIO) continue;
      const d = dist(this.player.x, this.player.y, bot.x, bot.y);
      if (d > detectionRange || d >= nearestDist) continue;

      const screenX = (bot.x - this.camera.x) * this.zoom + this.width / 2;
      const screenY = (bot.y - this.camera.y) * this.zoom + this.height / 2;
      const onScreen = screenX >= 0 && screenX <= this.width && screenY >= 0 && screenY <= this.height;
      if (onScreen) continue;

      nearest = { screenX, screenY };
      nearestDist = d;
    }
    if (!nearest) return;

    const cx = this.width / 2, cy = this.height / 2;
    const angle = Math.atan2(nearest.screenY - cy, nearest.screenX - cx);
    const ex = clamp(cx + Math.cos(angle) * (cx - margin), margin, this.width - margin);
    const ey = clamp(cy + Math.sin(angle) * (cy - margin), margin, this.height - margin);

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(ex, ey);
    ctx.rotate(angle);
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 200);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#FF54AD';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#FF54AD';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -9);
    ctx.lineTo(-10, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** True when the opaque city floor fills the whole screen this frame
   *  (view + max shake inside the world), so the full-screen clear can be
   *  skipped -- one less full-screen fill per frame (v12). */
  floorCoversView() {
    const m = 14 / this.zoom;
    return this.camera.x - this.viewHalfW - m >= 0 && this.camera.x + this.viewHalfW + m <= WORLD_W
      && this.camera.y - this.viewHalfH - m >= 0 && this.camera.y + this.viewHalfH + m <= WORLD_H;
  }

  render(time) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!this.floorCoversView()) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.width, this.height);
    }

    let shakeX = 0, shakeY = 0;
    if (this.shake > 0) {
      shakeX = rand(-this.shake, this.shake);
      shakeY = rand(-this.shake, this.shake);
    }

    ctx.save();
    ctx.translate(this.width / 2 + shakeX, this.height / 2 + shakeY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    this.drawCityFloor(ctx, time);
    for (const obj of this.objects) {
      if (this.isInView(obj.x, obj.y, obj.radius * 2)) obj.draw(ctx, this.canEatHighlight(obj));
    }
    this.drawDangerHalos(ctx);
    this.drawPreyRings(ctx);
    this.drawScannerTarget(ctx);
    this.drawBountyMarker(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const r of this.ripples) r.draw(ctx);

    const holes = [...this.bots, this.player];
    holes.sort((a, b) => a.radius - b.radius);
    const swallowed = this.collectSwallowed();
    const labelScale = clamp(1 / this.zoom, 1, 2.6);
    for (const h of holes) {
      h.labelScale = labelScale;
      if (this.isInView(h.x, h.y, h.radius + 40)) h.draw(ctx, time, this.swallowPass(h, swallowed));
    }
    this.drawPlayerOverlapMarker(ctx, holes, labelScale);
    if (this.frenzyActive) {
      ctx.save();
      ctx.translate(this.player.x, this.player.y);
      ctx.rotate(time * 2.5);
      ctx.strokeStyle = '#EFCB63';
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#EFCB63';
      ctx.lineWidth = 4;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.arc(0, 0, this.player.radius * 0.85 * CONFIG.golden.reachMult + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const f of this.floatTexts) f.draw(ctx, labelScale);

    ctx.restore();

    if (this.showMinimap) this.drawMinimap(ctx);
    this.drawDangerIndicators(ctx);
    this.drawGoldenIndicator(ctx);
    this.drawJuiceScreen(ctx, this.timeRemaining);

    // Overdrive "blackout" City Shift: dims the world layer only (drawn
    // after ctx.restore(), so HUD/minimap on top stay fully readable).
    if (this.overdriveActive && this.overdriveVariant === 'blackout') {
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }
  }

  /** v12: when a bigger hole is drawn over the player (holes draw small to
   *  big), re-draw a thin cyan outline + "Ty" on top so you never lose
   *  yourself under a rival. */
  drawPlayerOverlapMarker(ctx, holes, ls) {
    const p = this.player;
    const covered = holes.some(h => h !== p && h.radius > p.radius && Math.hypot(h.x - p.x, h.y - p.y) < h.radius + p.radius * 0.5);
    if (!covered) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(80, 240, 250, 0.9)';
    ctx.lineWidth = 2 * ls;
    ctx.setLineDash([6 * ls, 5 * ls]);
    ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 3 * ls, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `800 ${13 * ls}px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3 * ls;
    ctx.strokeStyle = 'rgba(4, 16, 29, 0.85)';
    ctx.strokeText(p.name, p.x, p.y - p.radius - 12 * ls);
    ctx.fillStyle = '#50F0FA';
    ctx.fillText(p.name, p.x, p.y - p.radius - 12 * ls);
    ctx.restore();
  }

  /** v12: eater -> [things it is swallowing this frame] (objects or
   *  campaign entities mid-eat, plus swallowed rival "ghosts"). */
  collectSwallowed() {
    const map = new Map();
    const add = (h, it) => { const l = map.get(h); if (l) l.push(it); else map.set(h, [it]); };
    const list = this.mode === 'campaign' ? this.campaignEntities : this.objects;
    for (const o of list) if (o.eating && o.eater && o.consumed !== true) add(o.eater, o);
    for (const g of this.swallowGhosts) add(g.eater, g);
    return map;
  }

  swallowPass(h, swallowed) {
    const items = swallowed.get(h);
    return items ? (ctx) => this.drawSwallowed(ctx, h, items) : null;
  }

  /** Draws what `h` is swallowing, inside its clipped vortex (see
   *  swallowPose()): objects spin down and shrink; a swallowed rival hole
   *  is a collapsing ring in its color. */
  drawSwallowed(ctx, h, items) {
    const t = performance.now() / 1000;
    for (const o of items) {
      const k = o.ghost ? o.t : o.eatT;
      const p = swallowPose(o, h, k);
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(p.scale, p.scale);
      if (o.ghost) {
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(0, 0, o.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = o.color;
        ctx.lineWidth = Math.max(2, o.radius * 0.16);
        ctx.shadowBlur = 14;
        ctx.shadowColor = o.color;
        ctx.stroke();
      } else if (o instanceof WorldObject) {
        drawObjectArt(ctx, o.subtype, o.color, o.radius, t, o.swSeed || 0, { live: false });
      } else {
        const art = o.artKind();
        if (art) drawObjectArt(ctx, art, SIZE_TIER_COLORS[o.stats.minTier], o.radius, t, artSeed(o.x, o.y), { live: false, variant: o.glyph === 'konwoj' ? 'konwoj' : undefined });
      }
      ctx.restore();
    }
  }

  /** A rival hole `b` was just eaten by `a`: its ring collapses into a's
   *  vortex over ~0.45 s (b itself respawns immediately). */
  addSwallowGhost(a, b, color) {
    if (this.swallowGhosts.length >= 8) this.swallowGhosts.shift();
    const g = { ghost: true, eater: a, radius: b.radius, color, t: 0 };
    beginSwallow(g, a);
    g.swFromX = b.x - a.x;
    g.swFromY = b.y - a.y;
    this.swallowGhosts.push(g);
  }

  /** Bounty Core mutation's marked rival (GDD 4.1): a rotating pink
   *  target reticle around it (v12 -- it used to be a gold crown, which now
   *  means "#1 by score" and often sat on the same hole). */
  drawBountyMarker(ctx) {
    if (!this.bountyTarget) return;
    const b = this.bountyTarget;
    const r = b.radius + 14;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(performance.now() / 900);
    ctx.strokeStyle = '#FF54AD';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#FF54AD';
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      ctx.beginPath(); ctx.arc(0, 0, r, a + 0.25, a + Math.PI / 2 - 0.25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * (r - 8), Math.sin(a) * (r - 8)); ctx.lineTo(Math.cos(a) * (r + 8), Math.sin(a) * (r + 8)); ctx.stroke();
    }
    ctx.restore();
  }

  /** Scanner mutation ping: a fading cyan ring around the last-found
   *  high-value cluster (GDD 4.1). */
  drawScannerTarget(ctx) {
    if (!this.scannerTarget || performance.now() > this.scannerTargetUntil) return;
    const t = this.scannerTarget;
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#50F0FA';
    ctx.shadowBlur = 14;
    ctx.shadowColor = '#50F0FA';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.radius * 1.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** 0..1 can-eat breathing-rim strength; 0 for objects the player can't
   *  (yet) eat, or for trivially-eatable tiny ones (avoids visual noise on
   *  every fragment/capsule on screen). Object eat-eligibility is a tier
   *  gate with no physical size-ratio component (see
   *  canEatWorldObjectTier()'s doc comment), so unlike the old ratio-band
   *  version this is a flat 1 for anything currently eatable rather than a
   *  fading "getting close" value -- there's no partial state left to show. */
  /** Whether a world-space circle overlaps the camera view (+margin).
   *  The illustrated object sprites and hole vortices are far richer than
   *  the old line art, so off-screen ones are skipped instead of drawn. */
  isInView(x, y, r) {
    return Math.abs(x - this.camera.x) < this.viewHalfW + r + 30
      && Math.abs(y - this.camera.y) < this.viewHalfH + r + 30;
  }

  canEatHighlight(obj) {
    if (obj.radius <= CONFIG.juice.eatTiers.tinyMaxRadius) return 0;
    if (!this.holeCanEat(this.player, obj)) return 0;
    if (obj.radius >= this.player.radius && !this.frenzyActive) return 0;
    return 1;
  }

  /** v10: a green dashed "prey" ring around rivals the player can eat now
   *  (the red danger halo below marks the ones to avoid), in both modes. */
  drawPreyRings(ctx) {
    const t = performance.now() / 1000;
    for (const bot of this.bots) {
      if (bot.invulnerable || this.player.radius <= bot.radius * EAT_HOLE_RATIO) continue;
      if (!this.isInView(bot.x, bot.y, bot.radius + 20)) continue;
      ctx.save();
      ctx.translate(bot.x, bot.y);
      ctx.rotate(t * 1.5);
      ctx.strokeStyle = 'rgba(70, 217, 154, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 7]);
      ctx.beginPath(); ctx.arc(0, 0, bot.radius + 9, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  /** Soft warm halo behind rivals large enough to threaten the player and
   *  close enough to matter — danger readability (GDD 5.4). */
  drawDangerHalos(ctx) {
    for (const bot of this.bots) {
      if (bot.radius <= this.player.radius * EAT_HOLE_RATIO) continue;
      const d = dist(this.player.x, this.player.y, bot.x, bot.y);
      if (d > CONFIG.juice.dangerHaloRange) continue;
      const strength = 1 - d / CONFIG.juice.dangerHaloRange;
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
      ctx.save();
      ctx.globalAlpha = strength * 0.35 * pulse;
      const grad = ctx.createRadialGradient(bot.x, bot.y, bot.radius * 0.5, bot.x, bot.y, bot.radius * 2.2);
      grad.addColorStop(0, '#ff3860');
      grad.addColorStop(1, 'rgba(255, 56, 96, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bot.x, bot.y, bot.radius * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  loop(now) {
    const rawDt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (this.running) {
      // Evolution/power offers used to only slow the world (GDD 4.1's
      // slowMotionFactor), never fully stopping it, with a 5s auto-pick --
      // player feedback: gameplay should actually stop so there's real
      // time to read the cards and choose (or explicitly skip) instead of
      // racing a moving world and a countdown. update()/updateCampaign()
      // are skipped entirely (not just fed dt=0) so collision/eating
      // checks can't keep re-firing every frame against positions that are
      // frozen but still overlapping (e.g. a bot already touching the
      // player when the offer opens). introPending (M00's blocking intro,
      // see showTutorialIntro()) freezes the same way.
      const work0 = performance.now();
      if (this.evolutionPending || this.introPending || this.revivePending || now < this.hitStopUntil) {
        if (this.mode === 'campaign') this.renderCampaign(now / 1000); else this.render(now / 1000);
      } else if (this.mode === 'campaign') {
        this.updateCampaign(rawDt);
        this.renderCampaign(now / 1000);
      } else {
        this.update(rawDt);
        this.render(now / 1000);
      }
      if (this.running && !this.paused && document.visibilityState === 'visible') this.monitorFrame(performance.now() - work0);
      this.rafId = requestAnimationFrame((t) => this.loop(t));
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
