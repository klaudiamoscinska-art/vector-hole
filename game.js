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
  version: '3.0.0-campaign',
  world: { width: 3000, height: 3000, gridSize: 100 },
  round: { duration: 120 },
  bots: { count: 5 },
  hole: { baseRadius: 22, minRadius: 14, baseSpeed: 150 },
  eating: {
    objRatio: 0.9,   // object must be smaller than hole.radius * this
    holeRatio: 1.15, // attacker must be bigger than defender.radius * this
    growObj: 0.4,
    growHole: 0.55,
    eatAnimTime: 0.28,
    invulnTime: 2.0
  },
  economy: {
    coinsPerScorePoint: 5, // score / this + coinsBase
    coinsBase: 10,
    adRewardMultiplier: 2
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
      arenaCompleteGain: 8,
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
    wyzwania: 'M04',  // Wyzwanie dnia tab + full bottom nav
    fullNav: 'M04'
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
    combo: { windowSeconds: 1.6, stepBonus: 0.15, maxMultiplier: 2.5, fadeSeconds: 0.6 },
    canEatHighlightBandLow: 0.85,  // rim-highlight objects whose (threshold / radius) falls in
    canEatHighlightBandHigh: 1.15, // this band around 1.0 -- "you're close to being able to eat this"
    dangerHaloRange: 260
  },
  // Phase 4: Evolution moments (run-only mutation picks) + Overdrive/City Shift.
  evolution: {
    triggerRadii: [33, 43],  // fires once each, aligned with the 'core'/'vortex' size tiers
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
  overdrive: {
    triggerSecondsRemaining: 12,
    variants: ['blackout', 'portal_rain'],
    bonusObjectCount: 10,
    bonusObjectValue: 15
  },
  // Vector Hole v3 (GDD 3.1) campaign mode. Kept separate from `eating`/
  // `juice` above so Arena's already-tuned balance is untouched.
  campaign: {
    baseRadius: 20,
    comboWindowSeconds: 1.5,   // GDD 07: "kolejne pożarcie w 1,5 s"
    comboMaxMultiplier: 2.0,   // GDD 07: "combo 1,0-2,0 mnoży punkty, nie wzrost"
    // Only used for the hitPenaltyFraction shrink below now -- per-entity
    // eat growth moved to Arena's radius-based GROW_K_OBJ formula (see
    // resolveCampaignEntity()'s doc comment) since growthUnits*scale grew
    // the hole far too little on a T2+ eat (prop/marker/vehicle/node/
    // pylon), independent of how big the eaten object actually was.
    growthAreaScale: 16,
    hitPenaltyFraction: 0.25,  // GDD 07: contact with a bigger bot costs 25% of current growth
    hitInvulnMs: 2000,
    // T2+ entities (prop/marker/vehicle/node/pylon/landmark) are sized
    // bigger than a hole that hasn't reached their unlock tier yet
    // (player feedback: "rozmiary ikonek... przed urośnięciem dziury
    // powinny być od niej większe" -- before growing, they should look too
    // big to eat, not smaller-and-inviting while still tier-locked). T1
    // fragment/capsule stay small since they're eatable from the very
    // first frame, no lock to visually signal.
    entityRadius: {
      fragment: 7, capsule: 10,
      prop: 26, marker: 25,
      vehicle: 38, node: 36, pylon: 36,
      landmark: 56,
      gate: 18
    },
    gate: { cycleSeconds: 3.5, openSeconds: 2.0, telegraphSeconds: 1.5 },
    nelaDisplaySeconds: 4.5,
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
  // CAMPAIGN_TIERS' T1-T5 exactly (same cyan/pink/green/violet/silver) so a
  // given tier number reads as the same color in both modes.
  // minRadius is derived from CAMPAIGN_TIERS' own minUnits (10/30/70/140),
  // converted into Arena's area-conserving radius space via fragment's
  // growth (fragment = 1 Campaign growth-unit = pi*7^2*GROW_K_OBJ = 19.6
  // radius^2 in Arena): r = sqrt(BASE_RADIUS^2 + minUnits*19.6). Player
  // feedback: the old thresholds (30/45/65/90, picked independently of
  // Campaign's economy) needed roughly 2x as many fragments to cross T1->T2
  // as Campaign's own pacing, so Arena felt far grindier than Campaign for
  // the exact same "T1" tier.
  sizeTiers: [
    { id: 'spark', minRadius: 0, label: 'T1 · MAŁY', shortId: 'T1', color: '#50F0FA' },
    { id: 'pulse', minRadius: 26, label: 'T2 · ŚREDNI', shortId: 'T2', color: '#FF54AD' },
    { id: 'core', minRadius: 33, label: 'T3 · DUŻY', shortId: 'T3', color: '#46D99A' },
    { id: 'vortex', minRadius: 43, label: 'T4 · WIELKI', shortId: 'T4', color: '#9875FF' },
    { id: 'singularity', minRadius: 57, label: 'T5 · KOLOSALNY', shortId: 'T5', color: '#CBD5E1' }
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
    monetizationAdapters: false, // real ad/IAP SDKs — deliberately not added (no secrets/store creds in-repo)
    analyticsConsoleLog: true,   // Phase 1: log analytics events to console
    campaignMode: true           // Vector Hole v3: mission-driven Campaign alongside Arena
  }
};

/* ----------------------- Constants (aliases into CONFIG) ----------------------- */

const WORLD_W = CONFIG.world.width;
const WORLD_H = CONFIG.world.height;
const ROUND_TIME = CONFIG.round.duration; // seconds
const GRID_SIZE = CONFIG.world.gridSize;
const NUM_BOTS = CONFIG.bots.count;

const BASE_RADIUS = CONFIG.hole.baseRadius;
const MIN_RADIUS = CONFIG.hole.minRadius;
const BASE_SPEED = CONFIG.hole.baseSpeed; // px/s

const EAT_OBJ_RATIO = CONFIG.eating.objRatio;
const EAT_HOLE_RATIO = CONFIG.eating.holeRatio;
const GROW_K_OBJ = CONFIG.eating.growObj;
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
function moderateName(name) {
  if (!name) return '';
  const lower = name.toLowerCase();
  if (NAME_BLOCKLIST.some(w => lower.includes(w))) return '';
  return name.slice(0, 16);
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
  }
  track(name, props) {
    const event = { name, props: props || {}, ts: Date.now() };
    this.queue.push(event);
    if (this.queue.length > this.maxQueue) this.queue.shift();
    if (CONFIG.flags.analyticsConsoleLog) {
      console.log('[analytics]', name, event.props);
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
// bestiary; 'portal' remains a separate, ungated entry -- it's not part
// of the shared bestiary, only ever spawned by spawnPortalRain() during
// Overdrive (see that method's own doc comment).
// `minSizeTier` indexes CONFIG.sizeTiers (T1..T5): a hole must have grown
// to at least that tier before objects of this type become eatable at
// all, regardless of the EAT_OBJ_RATIO size check -- see
// getSizeTierIndex()/canEatWorldObjectTier().
const TIERS = {
  fragment: { color: '#50F0FA', minR: 7, maxR: 7, value: 5, subtypes: ['fragment'], count: 60, minSizeTier: 0 },
  capsule: { color: '#50F0FA', minR: 10, maxR: 10, value: 15, subtypes: ['kapsula'], count: 30, minSizeTier: 0 },
  prop: { color: '#FF54AD', minR: 26, maxR: 26, value: 15, subtypes: ['latarnia', 'drzewo', 'lawka', 'kiosk', 'skrzynia'], count: 35, minSizeTier: 1 },
  marker: { color: '#FF54AD', minR: 25, maxR: 25, value: 50, subtypes: ['znacznik'], count: 10, minSizeTier: 1 },
  vehicle: { color: '#46D99A', minR: 38, maxR: 38, value: 30, subtypes: ['samochod'], count: 8, minSizeTier: 2 },
  node: { color: '#46D99A', minR: 36, maxR: 36, value: 50, subtypes: ['wezel'], count: 4, minSizeTier: 2 },
  pylon: { color: '#46D99A', minR: 36, maxR: 36, value: 50, subtypes: ['pylon'], count: 4, minSizeTier: 2 },
  landmark: { color: '#9875FF', minR: 56, maxR: 56, value: 160, subtypes: ['landmark'], count: 2, minSizeTier: 3 },
  portal: { color: '#9875FF', minR: 14, maxR: 20, value: 15, subtypes: ['portal'], count: 0, minSizeTier: 0 }
};

const BOT_NAME_POOL = [
  'NeonGhost', 'PixelWolf', 'ByteViper', 'CyberFox', 'GlitchKing', 'VoidRunner',
  'ChromaCat', 'LagMonster', 'NightHawk', 'ToxicSlime', 'RetroWave', 'GridRunner',
  'SynthWolf', 'ZeroPulse', 'HexShadow'
];

const BOT_COLORS = ['#FF54AD', '#46D99A', '#EFCB63', '#9875FF', '#50F0FA', '#ff3860'];

const SKINS = [
  { id: 'rainbow', name: 'Tęcza', price: 0, rainbow: true },
  { id: 'cyan', name: 'Cyber Cyan', price: 50, color: '#50F0FA' },
  { id: 'pink', name: 'Hot Pink', price: 50, color: '#FF54AD' },
  { id: 'green', name: 'Toxic Green', price: 75, color: '#46D99A' },
  { id: 'purple', name: 'Ultra Violet', price: 100, color: '#9875FF' },
  { id: 'gold', name: 'Neon Gold', price: 150, color: '#EFCB63' },
  { id: 'white', name: 'Plasma White', price: 200, color: '#ffffff' },
  // GDD 4.0 §6 M24 (kampanii finał) reward: a skin that's never for sale,
  // only granted on the campaign's last mission clear (see reward.unlockSkin
  // in CAMPAIGN_MISSIONS + endCampaignMission()).
  { id: 'aurora', name: 'Aurora Finału', price: null, color: '#7cffcb', unlockSource: { type: 'mission', id: 'M24' } },
  // GDD 4.0 §8.2 Core City reward ladder (never for sale, granted by
  // grantCoreCityLevelReward() — see CORE_CITY_LEVEL_REWARDS below).
  { id: 'krysztal', name: 'Kryształ', price: null, color: '#8ce8ff', unlockSource: { type: 'coreCity', level: 3 } },
  { id: 'pryzmat', name: 'Pryzmat', price: null, rainbow: true, unlockSource: { type: 'coreCity', level: 6 } }
];

// Phase 7 shop v2: a second cosmetic category beyond ring skins, purchasable
// with either currency to give Prisms an actual sink (GDD 10.1/10.2). GDD
// 4.0 §5.3 renames this Warsztat category "Trail" -- kept as `AURAS`
// internally since it's the same following-glow render path (Hole's aura).
const AURAS = [
  { id: 'none', name: 'Brak', priceCoins: 0, priceType: 'coins' },
  { id: 'spark', name: 'Spark Aura', priceCoins: 120, priceType: 'coins', color: '#50F0FA' },
  { id: 'ember', name: 'Ember Aura', pricePrisms: 15, priceType: 'prisms', color: '#FF54AD' },
  { id: 'vortex', name: 'Vortex Aura', pricePrisms: 30, priceType: 'prisms', color: '#9875FF' },
  { id: 'impuls', name: 'Impuls', priceCoins: null, color: '#46D99A', unlockSource: { type: 'coreCity', level: 2 } },
  { id: 'pryzmat', name: 'Pryzmat', priceCoins: null, color: '#ffffff', unlockSource: { type: 'coreCity', level: 6 } }
];

// GDD 4.0 §5.3 Warsztat category 3: "Efekt pochłaniania" -- the eat/absorb
// particle burst (see triggerEatFeedback()). 'classic' keeps today's
// per-object-type colors (color: null means "don't override").
const EAT_EFFECTS = [
  { id: 'classic', name: 'Klasyczny', priceCoins: 0, color: null },
  { id: 'pixel_burst', name: 'Pixel Burst', priceCoins: null, color: '#EFCB63', unlockSource: { type: 'coreCity', level: 4 } },
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
  2: { auraId: 'impuls', coins: 150, label: 'Trail „Impuls”' },
  3: { skinId: 'krysztal', coins: 200, label: 'Rdzeń „Kryształ”' },
  4: { effectId: 'pixel_burst', coins: 250, label: 'Efekt „Pixel Burst”' },
  5: { overdriveSkinId: 'fala', coins: 300, label: 'Overdrive „Fala”' },
  6: { skinId: 'pryzmat', auraId: 'pryzmat', effectId: 'pryzmat', overdriveSkinId: 'pryzmat', badge: 'pryzmat', coins: 400, label: 'Zestaw „Pryzmat” + odznaka' }
};

// Phase 7 casual run tools: consumable per-run boosters, Coins-only, casual
// mode only (no ranked/daily equivalent exists yet to keep them fair for).
const RUN_TOOLS = [
  { id: 'none', name: 'Bez dodatku', price: 0, desc: 'Zwykły start, bez żadnego efektu. Zawsze darmowe.' },
  { id: 'shield', name: 'Tarcza', price: 40, desc: 'Przetrwasz 1 starcie z większym rywalem bez utraty rozmiaru.' },
  { id: 'magnet', name: 'Magnes', price: 30, desc: 'Przez pierwsze 8 s rundy obiekty same lecą w Twoją stronę.' }
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
  gate: '<path d="M4 3v18M20 3v18M4 12h16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
};

// Fill color per CampaignEntity `type`, by size tier -- shared by
// campaignEntityColor() (board/particle/minimap color) and the goal-icon
// renderer below, so the HUD icon and the board object are always the same
// hue too. See campaignEntityColor() for the full "why size, not identity" rationale.
// Mirrors CAMPAIGN_TIERS' T1-T4 exactly (cyan/pink/green/violet) so an
// object's eat-gate color always matches the growth-tier badge that
// unlocks it (T4 moved to violet when T5/T6 were added -- see CAMPAIGN_TIERS).
const SIZE_TIER_COLORS = { 1: '#50F0FA', 2: '#FF54AD', 3: '#46D99A', 4: '#9875FF' };

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
const MUTATIONS = [
  { id: 'magnet_pulse', name: 'Magnet Pulse', desc: 'Przyciąga obiekty.', icon: 'magnet', weight: 3, color: '#50F0FA' },
  { id: 'slipstream', name: 'Slipstream', desc: 'Boost po combo.', icon: 'bolt', weight: 3, color: '#46D99A' },
  { id: 'phase_edge', name: 'Phase Edge', desc: 'Dłuższa ochrona.', icon: 'shield', weight: 2, color: '#9875FF' },
  { id: 'combo_reactor', name: 'Combo Reactor', desc: 'Dłuższe combo.', icon: 'clock', weight: 3, color: '#EFCB63' },
  { id: 'scanner', name: 'Scanner', desc: 'Wskazuje cel.', icon: 'radar', weight: 2, color: '#50F0FA' },
  { id: 'shockwave', name: 'Shockwave', desc: 'Odpycha obiekty.', icon: 'burst', weight: 2, color: '#FF54AD' },
  { id: 'bounty_core', name: 'Bounty Core', desc: 'Bonus za rywala.', icon: 'target', weight: 2, color: '#EFCB63' }
];

/* ----------------------- Campaign mode (GDD 3.1 / "Vector Hole v3") -----------------------
   A second, mission-driven game mode alongside the existing 120s Arena
   round. Per the GDD's own explicit scope call ("Najmniejszy zakres, który
   warto zbudować: jedna dzielnica, cztery misje... Pozostałe misje w tym
   dokumencie to plan rozszerzenia") the two districts actually authored
   with full mission text (Plac Neonów 01-04, Park Impulsów 05-08) are
   built; districts III-VI have no authored content in the GDD and stay a
   documented roadmap entry (see docs/VECTRE_V3_PLAN.md), matching how
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
// for object-size tiers); T4 takes the palette's violet; T6 takes gold
// (freed up from T4). T5 uses a metallic silver that isn't part of the
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
  { id: 'T2', name: 'Elementy uliczne', minUnits: 10, color: '#FF54AD' },
  { id: 'T3', name: 'Małe pojazdy', minUnits: 30, color: '#46D99A' },
  { id: 'T4', name: 'Kioski i cele misji', minUnits: 70, color: '#9875FF' },
  { id: 'T5', name: 'Duże pojazdy', minUnits: 140, color: '#CBD5E1' },
  { id: 'T6', name: 'Cele finałowe', minUnits: 250, color: '#EFCB63' }
];

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
  landmark: { growth: 32, score: 160, minTier: 4, label: 'landmark' }
};

// Per-mission visual glyph tables (mission-screen brief, Task 1): several
// CampaignEntity `type`s are reused across multiple missions with different
// GDD object names (e.g. 'marker' covers znacznik ogrodu/paleta/kryształ/
// witryna/klucz sektora/emiter). `glyph` started as a purely visual tag,
// but checkCampaignGoal() also reads it now (via computeCampaignGoalGlyph())
// so a mission naming one specific object only counts progress from that
// object, not any other same-`type` entity.
const MARKER_GLYPHS = { M07: 'znacznik_ogrodu', M10: 'paleta', M13: 'krysztal', M14: 'witryna', M15: 'klucz_sektora', M21: 'emiter' };
const PROP_GLYPHS = { M09: 'skrzynia', M17: 'modul_dachowy' };
const NODE_GLYPHS = { M04: 'wezel', M23: 'wezel', M12: 'zasilacz', M19: 'mostek' };
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
  { id: 'magnes', name: 'Magnes', desc: 'Przyciąga fragmenty.', icon: 'magnet', color: '#50F0FA' },
  { id: 'reaktor', name: 'Reaktor', desc: 'Dłuższe combo.', icon: 'clock', color: '#EFCB63' },
  { id: 'impuls', name: 'Impuls', desc: '+prędkość po tierze.', icon: 'bolt', color: '#46D99A' },
  { id: 'skaner', name: 'Skaner', desc: 'Wskazuje skupisko.', icon: 'radar', color: '#9875FF' }
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
  { id: 'plac', name: 'Plac Neonów', order: 1, missions: ['M00', 'M01', 'M02', 'M03', 'M04'] },
  { id: 'park', name: 'Park Impulsów', order: 2, missions: ['M05', 'M06', 'M07', 'M08'] },
  { id: 'port', name: 'Port Syntez', order: 3, missions: ['M09', 'M10', 'M11', 'M12'] },
  { id: 'galeria', name: 'Galeria Glitch', order: 4, missions: ['M13', 'M14', 'M15', 'M16'] },
  { id: 'dachy', name: 'Dachy Prądu', order: 5, missions: ['M17', 'M18', 'M19', 'M20'] },
  { id: 'rdzen', name: 'Rdzeń Miasta', order: 6, missions: ['M21', 'M22', 'M23', 'M24'] }
];

// Rozdział I (Plac Neonów) + Rozdział II (Park Impulsów) — the two chapters
// the GDD writes out in full (cel/medal/układ/NELA/nagroda per mission).
// `setup` drives buildCampaignMission()'s spawn layout; `goal`/`medal` drive
// checkCampaignGoal(); numeric balance is explicitly a "propozycja do
// sprawdzenia" per the GDD's own disclaimer, not a measured target.
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
    id: 'M00', district: 'plac', order: 0, name: 'Zanim zaczniesz', timeLimit: 90,
    // Step counts aren't arbitrary -- they match CAMPAIGN_TIERS' own growth
    // thresholds (T2 at 10 units, T3 at 30) so the goal the player sees is
    // never smaller than what canEatWorldObjectTier()-equivalent gating
    // (handleCampaignEating()'s `tier < e.stats.minTier`) actually requires
    // to unlock the next step's object (player feedback: needed "more blue
    // dots" than the old count of 3, which unlocked nothing yet). fragment
    // growth=1/unit -> 10 fragments reaches T2 (unlocks prop); prop
    // growth=3/unit -> 7 more (10+7*3=31) reaches T3 (unlocks vehicle).
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
          entityType: 'fragment', count: 10, label: 'Pochłoń 10 fragmentów energii',
          intro: 'Dotykaj fragmentów energii, żeby je pochłaniać. Potrzebujesz sporo, by urosnąć na tyle, żeby zjeść coś większego.'
        },
        {
          entityType: 'prop', count: 7, label: 'Pochłoń 7 elementów ulicznych',
          intro: 'Urosłaś! Teraz pochłoń elementy uliczne — latarnie, ławki, drzewa i inne drobiazgi na ulicach.'
        },
        {
          entityType: 'vehicle', count: 1, label: 'Pochłoń 1 pojazd',
          intro: 'Jeszcze większa! Znajdź i pochłoń pojazd.'
        },
        {
          type: 'eatRival', count: 1, label: 'Pochłoń mniejszego rywala',
          intro: 'Ostatni krok: znajdź rywala mniejszego od siebie i dotknij go, żeby go pochłonąć.'
        }
      ]
    },
    medal: { type: 'timeUnder', seconds: 70, label: 'Ukończ w 70 s' },
    // A couple more of each spawned than required (buffer, not everything
    // has to be reachable) since Campaign entities don't respawn mid-mission.
    setup: { fragments: 12, props: 9, vehicles: 3, bots: 1 },
    nela: {
      start: 'Zanim ruszysz na miasto: pochłoń fragmenty energii, aż urośniesz na tyle, by zjeść coś większego — najpierw element uliczny, potem pojazd. Na koniec dotknij mniejszego rywala, żeby go pochłonąć.',
      success: 'Gotowa. Miasto czeka.'
    },
    reward: { coins: 20 }
  },
  {
    id: 'M01', district: 'plac', order: 1, name: 'Pierwszy apetyt', timeLimit: 60,
    goal: { type: 'eatCount', entityType: 'fragment', count: 12, label: 'Pochłoń 12 fragmentów energii' },
    medal: { type: 'timeUnder', seconds: 35, label: 'Ukończ w 35 s' },
    setup: { fragments: 18, bots: 0 },
    nela: { start: 'Zacznij od drobiazgów. Każdy zasila Twój rdzeń.', success: 'Pierwsze światła wróciły!' },
    reward: { coins: 40 }
  },
  {
    id: 'M02', district: 'plac', order: 2, name: 'Dobra trasa', timeLimit: 90,
    goal: { type: 'eatCount', entityType: 'prop', count: 8, label: 'Pochłoń 8 elementów ulicznych' },
    medal: { type: 'visitBothClusters', label: 'Odwiedź oba skupiska' },
    setup: { fragments: 14, props: 12, clusters: 2, bots: 0 },
    nela: { start: 'Nie wszystko naraz. Wybierz swoją trasę.', success: 'Plac nabiera kształtu.' },
    reward: { coins: 40 }
  },
  {
    id: 'M03', district: 'plac', order: 3, name: 'Łańcuch reakcji', timeLimit: 90,
    goal: { type: 'comboChain', count: 12, label: 'Zbuduj serię 12 pożarć' },
    medal: { type: 'timeUnder', seconds: 25, label: 'Ukończ w 25 s' },
    setup: { fragments: 20, arcLayout: true, bots: 0 },
    nela: { start: 'Połącz kolejne kęsy. Nie zgub rytmu.', success: 'Właśnie uruchomiłaś reakcję łańcuchową.' },
    reward: { coins: 40 }
  },
  {
    id: 'M04', district: 'plac', order: 4, name: 'Pierwszy wielki kęs', timeLimit: 120,
    goal: { type: 'activateAndDevour', activator: 'node', count: 2, landmark: 'kino', minTier: 4, label: 'Wyłącz 2 węzły i pochłoń neonowe kino', activatorLabel: 'Wyłącz 2 węzły', landmarkLabel: 'Pochłoń neonowe kino' },
    medal: { type: 'noBotHit', label: 'Zakończ bez trafienia przez bota' },
    setup: { fragments: 12, props: 8, vehicles: 6, nodes: 2, landmark: 'kino', bots: 1 },
    evolutionOffer: { atSeconds: 30, count: 2 },
    nela: { start: 'Kino jest za duże? Jeszcze.', success: 'Kino odzyskane. Park otwarty!' },
    reward: { coins: 60, unlockDistrict: 'park' }
  },
  {
    id: 'M05', district: 'park', order: 1, name: 'Pierwszy impuls', timeLimit: 90,
    goal: { type: 'gatesPassed', count: 2, label: 'Przekrocz 2 różne bramy w ich bezpiecznym oknie' },
    medal: { type: 'comboUnbroken', label: 'Przejdź bez przerwania combo' },
    setup: { fragments: 14, props: 6, gates: 2, bots: 0 },
    nela: { start: 'Poczekaj na impuls. Wtedy ruszaj.', success: 'Park znów oddycha.' },
    reward: { coins: 50 }
  },
  {
    id: 'M06', district: 'park', order: 2, name: 'Zielona fala', timeLimit: 120,
    goal: { type: 'eatCount', entityType: 'capsule', count: 18, label: 'Pochłoń 18 kapsuł impulsu' },
    medal: { type: 'comboAtLeast', count: 6, label: 'Zbierz 6 w jednym combo' },
    // Waves 40s/80s apart used to leave the board completely empty for
    // ~15-20s at a time once a wave was cleared (player feedback: "the
    // board stays empty until time runs out") -- tightened so the next
    // wave lands well before the previous one is fully eaten.
    setup: { capsuleWaves: [0, 18, 34], capsulesPerWave: 8, bots: 0 },
    nela: { start: 'Podążaj za falą, nie za przypadkiem.', success: 'Energia płynie dalej.' },
    reward: { coins: 50 }
  },
  {
    id: 'M07', district: 'park', order: 3, name: 'Dwie drogi', timeLimit: 120,
    goal: { type: 'eatCount', entityType: 'marker', count: 3, label: 'Odzyskaj 3 znaczniki ogrodu' },
    medal: { type: 'bothRoutesUsed', label: 'Użyj obu tras' },
    setup: { fragments: 16, props: 6, markers: 4, bots: 0 },
    nela: { start: 'Skrót kusi. Obejście też prowadzi do celu.', success: 'Masz własny sposób na ten park.' },
    reward: { coins: 50 }
  },
  {
    id: 'M08', district: 'park', order: 4, name: 'Serce ogrodu', timeLimit: 120,
    goal: { type: 'activateAndDevour', activator: 'pylon', count: 3, landmark: 'fontanna', minTier: 4, label: 'Naładuj 3 pylony i pochłoń fontannę', activatorLabel: 'Naładuj 3 pylony', landmarkLabel: 'Pochłoń fontannę' },
    medal: { type: 'pylonsUnbroken', label: 'Aktywuj pylony w jednej serii' },
    setup: { fragments: 12, props: 8, vehicles: 6, pylons: 3, landmark: 'fontanna', bots: 1 },
    evolutionOffer: { atSeconds: 30, count: 2 },
    nela: { start: 'Jeszcze trzy impulsy. Obudź serce ogrodu.', success: 'Fontanna wróciła. Port czeka!' },
    reward: { coins: 70, unlockDistrict: 'port' }
  },

  // Rozdział III (Port Syntez) — GDD 4.0 §6 table rows M09-M12.
  {
    id: 'M09', district: 'port', order: 1, name: 'Dostawa energii', timeLimit: 90,
    goal: { type: 'eatCount', entityType: 'prop', count: 12, label: 'Pochłoń 12 skrzyń' },
    medal: { type: 'timeUnder', seconds: 55, label: 'Ukończ w 55 s' },
    setup: { fragments: 12, props: 18, bots: 0 },
    nela: { start: 'Port stoi bez prądu. Zacznij od skrzyń przy nabrzeżu.', success: 'Pierwsza dostawa dotarła.' },
    reward: { coins: 60 }
  },
  {
    id: 'M10', district: 'port', order: 2, name: 'Pełny załadunek', timeLimit: 100,
    goal: { type: 'eatCount', entityType: 'marker', count: 3, label: 'Wyczyść 3 oznaczone palety' },
    medal: { type: 'bothRoutesUsed', label: 'Użyj obu tras' },
    setup: { fragments: 12, props: 10, markers: 4, bots: 0 },
    nela: { start: 'Palety mają swój porządek. Znajdź oznaczone.', success: 'Załadunek kompletny.' },
    reward: { coins: 60 }
  },
  {
    id: 'M11', district: 'port', order: 3, name: 'Konwój', timeLimit: 110,
    goal: { type: 'eatCount', entityType: 'vehicle', count: 6, label: 'Pochłoń 6 pojazdów konwoju' },
    medal: { type: 'comboUnbroken', label: 'Przejdź bez przerwania combo' },
    setup: { fragments: 12, props: 8, vehicles: 10, bots: 1 },
    nela: { start: 'Konwój rusza. Nie zgub żadnego pojazdu.', success: 'Ruchome cele w końcu stanęły.' },
    reward: { coins: 60 }
  },
  {
    id: 'M12', district: 'port', order: 4, name: 'Upadek dźwigu', timeLimit: 120,
    goal: { type: 'activateAndDevour', activator: 'node', count: 3, landmark: 'dzwig', minTier: 4, label: 'Zbierz 3 zasilacze i pochłoń dźwig', activatorLabel: 'Zbierz 3 zasilacze', landmarkLabel: 'Pochłoń dźwig' },
    medal: { type: 'noBotHit', label: 'Zakończ bez trafienia przez bota' },
    setup: { fragments: 14, props: 8, vehicles: 6, nodes: 3, landmark: 'dzwig', bots: 1 },
    evolutionOffer: { atSeconds: 30, count: 2 },
    nela: { start: 'Trzy zasilacze, jeden wielki dźwig. Ruszaj.', success: 'Dźwig opadł. Galeria się otwiera!' },
    reward: { coins: 80, unlockDistrict: 'galeria' }
  },

  // Rozdział IV (Galeria Glitch) — GDD 4.0 §6 table rows M13-M16.
  {
    id: 'M13', district: 'galeria', order: 1, name: 'Druga strona', timeLimit: 90,
    goal: { type: 'eatCount', entityType: 'marker', count: 6, label: 'Użyj portalu i zbierz 6 kryształów' },
    medal: { type: 'timeUnder', seconds: 65, label: 'Ukończ w 65 s' },
    setup: { fragments: 12, markers: 8, gates: 1, bots: 0 },
    nela: { start: 'Portal migocze — przejdź, gdy jest otwarty.', success: 'Druga strona galerii odzyskana.' },
    reward: { coins: 70 }
  },
  {
    id: 'M14', district: 'galeria', order: 2, name: 'Witryny do odzyskania', timeLimit: 100,
    goal: { type: 'eatCount', entityType: 'marker', count: 3, label: 'Wyczyść 3 witryny' },
    medal: { type: 'comboAtLeast', count: 5, label: 'Zbierz 5 w jednym combo' },
    setup: { fragments: 14, markers: 5, bots: 0 },
    nela: { start: 'Witryny wciąż świecą starym światłem. Zgaś je.', success: 'Nowe reklamy migają nad placem.' },
    reward: { coins: 70 }
  },
  {
    id: 'M15', district: 'galeria', order: 3, name: 'Przed zamknięciem', timeLimit: 110,
    goal: { type: 'eatCount', entityType: 'marker', count: 4, label: 'Zbierz 4 klucze sektorów' },
    medal: { type: 'timeUnder', seconds: 75, label: 'Ukończ w 75 s' },
    setup: { fragments: 12, props: 6, markers: 6, bots: 1 },
    nela: { start: 'Sektory zamykają się jeden po drugim. Pospiesz się.', success: 'Wszystkie sektory otwarte na nowo.' },
    reward: { coins: 70 }
  },
  {
    id: 'M16', district: 'galeria', order: 4, name: 'Kaskada luster', timeLimit: 120,
    goal: { type: 'activateAndDevour', activator: 'pylon', count: 3, landmark: 'galeria_glowna', minTier: 4, label: 'Aktywuj 3 lustra i pochłoń galerię', activatorLabel: 'Aktywuj 3 lustra', landmarkLabel: 'Pochłoń galerię' },
    medal: { type: 'pylonsUnbroken', label: 'Aktywuj lustra w jednej serii' },
    setup: { fragments: 12, props: 8, vehicles: 4, pylons: 3, landmark: 'galeria_glowna', bots: 1 },
    evolutionOffer: { atSeconds: 30, count: 2 },
    nela: { start: 'Trzy lustra, jedna kaskada światła. Rozpal ją.', success: 'Galeria lśni jak nowa. Dachy czekają!' },
    reward: { coins: 90, unlockDistrict: 'dachy' }
  },

  // Rozdział V (Dachy Prądu) — GDD 4.0 §6 table rows M17-M20.
  {
    id: 'M17', district: 'dachy', order: 1, name: 'Nad miastem', timeLimit: 90,
    goal: { type: 'eatCount', entityType: 'prop', count: 14, label: 'Pochłoń 14 modułów dachowych' },
    medal: { type: 'timeUnder', seconds: 60, label: 'Ukończ w 60 s' },
    setup: { fragments: 10, props: 20, bots: 0 },
    nela: { start: 'Dachy Prądu widać z każdego okna. Zacznij od góry.', success: 'Pierwszy dach znów świeci.' },
    reward: { coins: 80 }
  },
  {
    id: 'M18', district: 'dachy', order: 2, name: 'Tor lotu', timeLimit: 110,
    goal: { type: 'gatesPassed', count: 3, label: 'Wyczyść 3 pasy przelotu' },
    medal: { type: 'comboUnbroken', label: 'Przejdź bez przerwania combo' },
    setup: { fragments: 12, props: 6, gates: 3, bots: 0 },
    nela: { start: 'Trzy pasy, trzy rytmy. Ucz się każdego z osobna.', success: 'Tor lotu czysty od krawędzi do krawędzi.' },
    reward: { coins: 80 }
  },
  {
    id: 'M19', district: 'dachy', order: 3, name: 'Cel w zasięgu', timeLimit: 110,
    goal: { type: 'activateAndDevour', activator: 'node', count: 2, landmark: 'iglica_wejscie', minTier: 4, label: 'Zasil 2 mostki i otwórz iglicę', activatorLabel: 'Zasil 2 mostki', landmarkLabel: 'Otwórz iglicę' },
    medal: { type: 'noBotHit', label: 'Zakończ bez trafienia przez bota' },
    setup: { fragments: 12, props: 8, vehicles: 4, nodes: 2, landmark: 'iglica_wejscie', bots: 1 },
    nela: { start: 'Dwa mostki dzielą Cię od iglicy. Zasil je.', success: 'Wejście otwarte. Iglica czeka.' },
    reward: { coins: 80 }
  },
  {
    id: 'M20', district: 'dachy', order: 4, name: 'Iglica', timeLimit: 120,
    goal: { type: 'eatCount', entityType: 'landmark', count: 1, label: 'Pochłoń centralną iglicę' },
    medal: { type: 'timeUnder', seconds: 90, label: 'Ukończ w 90 s' },
    setup: { fragments: 14, props: 10, vehicles: 6, landmark: 'iglica', bots: 1 },
    evolutionOffer: { atSeconds: 30, count: 2 },
    nela: { start: 'Najbardziej epicki landmark przed finałem. Idź po niego.', success: 'Iglica pochłonięta. Rdzeń Miasta się budzi!' },
    reward: { coins: 100, unlockDistrict: 'rdzen' }
  },

  // Rozdział VI (Rdzeń Miasta) — GDD 4.0 §6 table rows M21-M24, kampanii finał.
  {
    id: 'M21', district: 'rdzen', order: 1, name: 'Powrót sygnału', timeLimit: 90,
    goal: { type: 'eatCount', entityType: 'marker', count: 4, label: 'Odzyskaj 4 emitery' },
    medal: { type: 'timeUnder', seconds: 60, label: 'Ukończ w 60 s' },
    setup: { fragments: 12, markers: 6, bots: 0 },
    nela: { start: 'Sygnał milczy od dawna. Znajdź emitery.', success: 'Sygnał wraca do Rdzenia.' },
    reward: { coins: 90 }
  },
  {
    id: 'M22', district: 'rdzen', order: 2, name: 'Czytelny chaos', timeLimit: 110,
    goal: { type: 'eatCount', entityType: 'fragment', count: 20, label: 'Pochłoń 20 fragmentów energii w 3 sektorach' },
    medal: { type: 'comboAtLeast', count: 8, label: 'Zbierz 8 w jednym combo' },
    setup: { fragments: 30, props: 6, bots: 1 },
    nela: { start: 'Chaos ma swój rytm, jeśli wiesz gdzie patrzeć.', success: 'Kontrolowany chaos miasta ustał.' },
    reward: { coins: 90 }
  },
  {
    id: 'M23', district: 'rdzen', order: 3, name: 'Ostatni obwód', timeLimit: 120,
    goal: { type: 'eatCount', entityType: 'node', count: 4, label: 'Naładuj finalny obwód z 4 węzłów' },
    medal: { type: 'noBotHit', label: 'Zakończ bez trafienia przez bota' },
    setup: { fragments: 14, props: 8, nodes: 4, bots: 1 },
    nela: { start: 'Wysokie napięcie. Cztery węzły, jedna szansa.', success: 'Obwód zamknięty. Ostatni krok.' },
    reward: { coins: 90 }
  },
  {
    id: 'M24', district: 'rdzen', order: 4, name: 'Miasto na nowo', timeLimit: 120,
    goal: { type: 'eatCount', entityType: 'landmark', count: 1, label: 'Pochłoń główny rdzeń miasta' },
    medal: { type: 'timeUnder', seconds: 95, label: 'Ukończ w 95 s' },
    setup: { fragments: 16, props: 10, vehicles: 8, landmark: 'rdzen_miasta_glowny', bots: 1 },
    evolutionOffer: { atSeconds: 30, count: 2 },
    nela: { start: 'Wielki finał całej kampanii. Miasto patrzy.', success: 'Miasto odzyskane. Neonowa Warszawa znów żyje.' },
    reward: { coins: 120, unlockSkin: 'aurora' }
  }
];

function campaignMissionById(id) { return CAMPAIGN_MISSIONS.find(m => m.id === id); }
function campaignDistrictOf(missionId) {
  const m = campaignMissionById(missionId);
  return m ? DISTRICTS.find(d => d.id === m.district) : null;
}

const SAVE_KEY = 'vectorHoleSave_v1'; // storage key kept stable; schema is versioned inside the payload
const SAVE_SCHEMA_VERSION = 8;

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
 *  WorldObject's TIERS group requires (small/medium/large -> T1/T2/T3),
 *  independent of the EAT_OBJ_RATIO check against that specific object's
 *  instance radius. */
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
  { id: 'eat_5_rivals', name: 'Zjedz 5 rywali w jednej rundzie', target: 5, rewardCoins: 40 },
  { id: 'reach_size_60', name: 'Osiągnij rozmiar 60', target: 60, rewardCoins: 35 },
  { id: 'combo_x3', name: 'Zbuduj combo x3', target: 3, rewardCoins: 30 },
  { id: 'score_150', name: 'Zdobądź 150 punktów w jednej rundzie', target: 150, rewardCoins: 45 }
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
    settings: { inputMode: 'legacy', sensitivity: 1, haptics: true, minimap: 'auto' },
    stats: { runsPlayed: 0, bestArenaScore: 0 },
    // v7: coreLevel starts at 1 (LVL1, "stan startowy" per GDD 4.0 §8.2);
    // coreCharge is the 0-100 progress toward the *next* level.
    hub: { coreCharge: 0, coreLevel: 1 },
    daily: { lastSeedDate: null, lastSeedScore: 0, streak: 0, lastPlayedDate: null },
    mission: { dateKey: null, completed: false },
    // v6: campaign progress. unlockedDistricts always includes the first
    // district so a fresh save can play Mission 01 with no prior unlock.
    // v8: discoveredTypes/discoveredHoleEating track what Arena is allowed
    // to show (see createObjects()) -- empty until M00 teaches them.
    campaign: { unlockedDistricts: ['plac'], completed: {}, medals: {}, discoveredTypes: [], discoveredHoleEating: false },
    // v7: two more Warsztat cosmetic categories (GDD 4.0 §5.3) alongside
    // owned/selected (ring skins) and auras (trail).
    effects: { owned: ['classic'], selected: 'classic' },
    overdriveSkins: { owned: ['classic'], selected: 'classic' },
    badges: []
  };
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

  return data;
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const migrated = migrateSave(JSON.parse(raw));
      saveGame(migrated);
      return migrated;
    }
  } catch (e) { /* ignore corrupted save */ }
  return defaultSave();
}

function saveGame(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage unavailable */ }
}

/* ----------------------- Particle ----------------------- */

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(60, 220);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.color = color;
    this.radius = rand(1.5, 3.5);
    this.maxLife = rand(0.4, 0.9);
    this.life = this.maxLife;
  }

  update(dt) {
    this.life -= dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.94;
    this.vy *= 0.94;
  }

  get dead() { return this.life <= 0; }

  draw(ctx) {
    const t = clamp(this.life / this.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = t;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * t, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.x, this.y, lerp(this.startRadius, this.endRadius, t), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/* ----------------------- WorldObject ----------------------- */

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
  }

  update(dt) {
    if (this.eating) {
      this.eatT += dt / EAT_ANIM_TIME;
      if (this.eater) {
        const pull = clamp(this.eatT, 0, 1);
        this.x = lerp(this.x, this.eater.x, pull * 0.5);
        this.y = lerp(this.y, this.eater.y, pull * 0.5);
      }
    }
  }

  get consumed() { return this.eating && this.eatT >= 1; }

  /** highlight (0..1): "you're close to being able to eat this" breathing
   *  rim, drawn only for objects near the player's eat threshold so tiny
   *  trivially-eatable objects stay visually quiet (GDD 5.4). */
  draw(ctx, highlight) {
    const scale = this.eating ? Math.max(0, 1 - this.eatT) : 1;
    if (scale <= 0) return;

    if (highlight > 0 && !this.eating) {
      const breathe = 0.5 + 0.5 * Math.sin(performance.now() / 260);
      ctx.save();
      ctx.globalAlpha = highlight * (0.35 + 0.35 * breathe);
      ctx.strokeStyle = this.color;
      ctx.shadowBlur = 18;
      ctx.shadowColor = this.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * (1.35 + 0.1 * breathe), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.scale(scale, scale);
    ctx.strokeStyle = this.color;
    ctx.fillStyle = this.color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = this.color;
    const r = this.radius;

    switch (this.subtype) {
      // ---- T1: "FRAGMENT ENERGII" (diamond -- same as Campaign's fragment) ----
      case 'fragment':
        ctx.beginPath();
        ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0);
        ctx.closePath();
        ctx.fill();
        break;

      // ---- T1: "KAPSUŁA IMPULSU" (pill split down the middle -- same as
      // Campaign's capsule) ----
      case 'kapsula':
        ctx.save();
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r);
        ctx.lineTo(r * 0.5, -r);
        ctx.arc(r * 0.5, 0, r, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-r * 0.5, r);
        ctx.arc(-r * 0.5, 0, r, Math.PI / 2, -Math.PI / 2);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0); ctx.stroke();
        ctx.restore();
        break;

      // ---- T2: design/reference/asset_bible.svg "LATARNIA" ----
      case 'latarnia':
        ctx.beginPath();
        ctx.moveTo(0, r);
        ctx.lineTo(0, -r * 0.8);
        ctx.moveTo(-r * 0.5, r);
        ctx.lineTo(r * 0.5, r);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.35, -r * 0.8);
        ctx.lineTo(r * 0.35, -r * 0.8);
        ctx.lineTo(r * 0.22, -r * 0.45);
        ctx.lineTo(-r * 0.22, -r * 0.45);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -r * 0.95, r * 0.14, 0, Math.PI * 2);
        ctx.fill();
        break;

      // ---- T2: "DRZEWO" (trunk + hollow canopy, no more double-circle) ----
      case 'drzewo':
        ctx.beginPath();
        ctx.moveTo(0, r * 0.15);
        ctx.lineTo(0, r);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -r * 0.15, r * 0.75, 0, Math.PI * 2);
        ctx.stroke();
        break;

      // ---- T2: "ŁAWKA" (bench — seat rails + 4 legs) ----
      case 'lawka':
        ctx.beginPath();
        ctx.moveTo(-r, -r * 0.2);
        ctx.lineTo(r, -r * 0.2);
        ctx.moveTo(-r, r * 0.2);
        ctx.lineTo(r, r * 0.2);
        ctx.moveTo(-r * 0.85, r * 0.2);
        ctx.lineTo(-r * 0.85, r * 0.7);
        ctx.moveTo(r * 0.85, r * 0.2);
        ctx.lineTo(r * 0.85, r * 0.7);
        ctx.moveTo(-r, -r * 0.6);
        ctx.lineTo(-r, -r * 0.2);
        ctx.moveTo(r, -r * 0.6);
        ctx.lineTo(r, -r * 0.2);
        ctx.stroke();
        break;

      // ---- T2: "KIOSK" (triangular roof + body + window) ----
      case 'kiosk':
        ctx.beginPath();
        ctx.moveTo(-r, -r * 0.375);
        ctx.lineTo(0, -r);
        ctx.lineTo(r, -r * 0.375);
        ctx.closePath();
        ctx.stroke();
        ctx.strokeRect(-r * 0.875, -r * 0.375, r * 1.75, r * 1.25);
        ctx.strokeRect(-r * 0.375, 0, r * 0.75, r * 0.5);
        break;

      // ---- T2: "SKRZYNIA" (crate — box + lid seam) ----
      case 'skrzynia':
        ctx.strokeRect(-r, -r * 0.75, r * 2, r * 1.5);
        ctx.beginPath();
        ctx.moveTo(-r, -r * 0.15);
        ctx.lineTo(r, -r * 0.15);
        ctx.moveTo(0, -r * 0.75);
        ctx.lineTo(0, -r * 0.15);
        ctx.stroke();
        break;

      // ---- T2: "ZNACZNIK" (flag on a pole -- same as Campaign's default
      // marker glyph) ----
      case 'znacznik':
        ctx.beginPath(); ctx.moveTo(-r * 0.6, r); ctx.lineTo(-r * 0.6, -r); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, -r); ctx.lineTo(r * 0.8, -r * 0.55); ctx.lineTo(-r * 0.6, -r * 0.1);
        ctx.closePath();
        ctx.fill();
        break;

      // ---- T3: "SAMOCHÓD" (body + roof arc + wheels -- same silhouette
      // as Campaign's 'vehicle' glyph, so a car reads as the same object
      // in both modes). ----
      case 'samochod':
        ctx.strokeRect(-r, -r * 0.35, r * 2, r * 0.75);
        ctx.beginPath();
        ctx.arc(-r * 0.1, -r * 0.35, r * 0.5, Math.PI, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-r * 0.55, r * 0.45, r * 0.22, 0, Math.PI * 2);
        ctx.arc(r * 0.55, r * 0.45, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        break;

      // ---- T3: "WĘZEŁ" (ring + X -- same as Campaign's default node
      // glyph, always drawn "active" since Arena objects have no
      // activation state). ----
      case 'wezel':
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, -r * 0.4); ctx.lineTo(r * 0.4, r * 0.4);
        ctx.moveTo(r * 0.4, -r * 0.4); ctx.lineTo(-r * 0.4, r * 0.4);
        ctx.stroke();
        break;

      // ---- T3: "PYLON" (mast + charge ring -- same as Campaign's default
      // pylon glyph). ----
      case 'pylon':
        ctx.beginPath(); ctx.moveTo(0, -r * 0.3); ctx.lineTo(0, r); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -r * 0.65, r * 0.35, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha *= 0.5;
        ctx.beginPath(); ctx.arc(0, -r * 0.65, r * 0.6, 0, Math.PI * 2); ctx.stroke();
        break;

      // ---- T4: "LANDMARK" (generic double-ring -- Arena has no
      // per-mission silhouette identity, so this reuses Campaign's own
      // shared fallback shape, always drawn at full brightness since
      // Arena has no locked/unlocked state). ----
      case 'landmark':
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.stroke();
        break;

      // ---- Overdrive "portal_rain" bonus objects only (see
      // spawnPortalRain()) — the bible's violet functional-accent glyph. ----
      case 'portal':
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha *= 0.6;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.625, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha *= (0.4 / 0.6);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
        ctx.stroke();
        break;
    }
    ctx.restore();
  }
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

  startEating() {
    if (this.eating) return;
    this.eating = true;
    this.eatT = 0;
  }

  draw(ctx, isGoal) {
    if (!this.live || this.consumed) return;
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
      ctx.strokeStyle = `rgba(239, 203, 99,${0.3 + 0.35 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    switch (this.type) {
      case 'fragment': {
        ctx.strokeStyle = ctx.fillStyle = '#50F0FA';
        ctx.shadowBlur = 10; ctx.shadowColor = '#50F0FA';
        ctx.beginPath();
        ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'prop': {
        if (this.glyph === 'skrzynia') {
          // Skrzynia (M09) -- pink, T2 size tier (see campaignEntityColor()).
          const color = '#FF54AD';
          ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowBlur = 10; ctx.shadowColor = color;
          ctx.strokeRect(-r * 0.85, -r * 0.6, r * 1.7, r * 1.2);
          ctx.beginPath();
          ctx.moveTo(-r * 0.85, 0); ctx.lineTo(r * 0.85, 0);
          ctx.moveTo(0, -r * 0.6); ctx.lineTo(0, 0);
          ctx.stroke();
        } else if (this.glyph === 'modul_dachowy') {
          // Moduł dachowy (M17) -- pink, T2 size tier.
          const color = '#FF54AD';
          ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowBlur = 10; ctx.shadowColor = color;
          ctx.strokeRect(-r * 0.85, -r * 0.55, r * 1.7, r * 1.1);
          ctx.beginPath(); ctx.moveTo(-r * 0.85, 0); ctx.lineTo(r * 0.85, 0); ctx.stroke();
        } else {
          // Generic "ogólne" street props: latarnia/ławka/drzewo/kiosk --
          // one of PROP_STREET_GLYPHS picked per instance in
          // buildCampaignMission(), so a mission's
          // filler props read as a real street scene instead of one shape
          // repeated everywhere. Pink, T2 size tier -- cluster A/B (M02's
          // route medal) doesn't recolor the shape; the two clusters are
          // already spatially distinct (left/right half of the map).
          const color = '#FF54AD';
          ctx.strokeStyle = color; ctx.lineWidth = 1.6;
          ctx.shadowBlur = 10; ctx.shadowColor = color;
          switch (this.glyph) {
            case 'latarnia':
              ctx.beginPath();
              ctx.moveTo(0, r); ctx.lineTo(0, -r * 0.8);
              ctx.moveTo(-r * 0.5, r); ctx.lineTo(r * 0.5, r);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(-r * 0.35, -r * 0.8); ctx.lineTo(r * 0.35, -r * 0.8);
              ctx.lineTo(r * 0.22, -r * 0.45); ctx.lineTo(-r * 0.22, -r * 0.45);
              ctx.closePath(); ctx.stroke();
              ctx.beginPath(); ctx.arc(0, -r * 0.95, r * 0.14, 0, Math.PI * 2); ctx.fill();
              break;
            case 'lawka':
              ctx.beginPath();
              ctx.moveTo(-r, -r * 0.2); ctx.lineTo(r, -r * 0.2);
              ctx.moveTo(-r, r * 0.2); ctx.lineTo(r, r * 0.2);
              ctx.moveTo(-r * 0.85, r * 0.2); ctx.lineTo(-r * 0.85, r * 0.7);
              ctx.moveTo(r * 0.85, r * 0.2); ctx.lineTo(r * 0.85, r * 0.7);
              ctx.moveTo(-r, -r * 0.6); ctx.lineTo(-r, -r * 0.2);
              ctx.moveTo(r, -r * 0.6); ctx.lineTo(r, -r * 0.2);
              ctx.stroke();
              break;
            case 'drzewo':
              ctx.beginPath();
              ctx.moveTo(0, r * 0.15); ctx.lineTo(0, r);
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(0, -r * 0.15, r * 0.75, 0, Math.PI * 2);
              ctx.stroke();
              break;
            case 'kiosk':
              ctx.beginPath();
              ctx.moveTo(-r, -r * 0.375); ctx.lineTo(0, -r); ctx.lineTo(r, -r * 0.375);
              ctx.closePath(); ctx.stroke();
              ctx.strokeRect(-r * 0.875, -r * 0.375, r * 1.75, r * 1.25);
              ctx.strokeRect(-r * 0.375, 0, r * 0.75, r * 0.5);
              break;
            default: // safety fallback -- randomStreetGlyph() only ever picks the 4 cases above
              ctx.beginPath();
              ctx.moveTo(0, -r); ctx.lineTo(r * 0.75, r * 0.8); ctx.lineTo(-r * 0.75, r * 0.8);
              ctx.closePath(); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(-r * 0.4, r * 0.4); ctx.lineTo(r * 0.4, r * 0.4); ctx.stroke();
          }
        }
        break;
      }
      case 'vehicle': {
        // Simple car silhouette (body + roof bump + two wheels) instead of
        // a plain rectangle. Green, T3 size tier -- same hue for plain
        // filler and M11's convoy vehicles (glyph: 'konwoj', set in
        // buildCampaignMission()), which are the same size class; konwoj
        // keeps its own tow-hitch accent as a shape distinction instead.
        const isKonwoj = this.glyph === 'konwoj';
        const color = '#46D99A';
        ctx.strokeStyle = ctx.fillStyle = color; ctx.lineWidth = 2;
        ctx.shadowBlur = 12; ctx.shadowColor = color;
        ctx.strokeRect(-r, -r * 0.35, r * 2, r * 0.75);
        ctx.beginPath(); ctx.arc(-r * 0.1, -r * 0.35, r * 0.5, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(-r * 0.55, r * 0.45, r * 0.22, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.55, r * 0.45, r * 0.22, 0, Math.PI * 2); ctx.fill();
        if (isKonwoj) {
          ctx.beginPath();
          ctx.moveTo(r * 1.05, -r * 0.1); ctx.lineTo(r * 1.35, -r * 0.1);
          ctx.moveTo(r * 1.2, -r * 0.25); ctx.lineTo(r * 1.2, r * 0.05);
          ctx.stroke();
        }
        break;
      }
      case 'capsule': {
        // Pill/capsule shape split down the middle, instead of a hexagon.
        // Cyan, T1 size tier (smallest, alongside fragment).
        ctx.strokeStyle = '#50F0FA';
        ctx.shadowBlur = 14; ctx.shadowColor = '#50F0FA';
        ctx.save();
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r);
        ctx.lineTo(r * 0.5, -r);
        ctx.arc(r * 0.5, 0, r, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-r * 0.5, r);
        ctx.arc(-r * 0.5, 0, r, Math.PI / 2, -Math.PI / 2);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.lineTo(r * 0.5, 0); ctx.stroke();
        ctx.restore();
        break;
      }
      case 'marker': {
        switch (this.glyph) {
          case 'znacznik_ogrodu': {
            // M07 (leaf/drop shape) -- pink, T2 size tier.
            const color = '#FF54AD';
            ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.shadowBlur = 12; ctx.shadowColor = color;
            ctx.beginPath();
            ctx.moveTo(0, -r);
            ctx.bezierCurveTo(-r * 0.85, -r * 0.5, -r * 0.85, r * 0.5, 0, r);
            ctx.bezierCurveTo(r * 0.85, r * 0.5, r * 0.85, -r * 0.5, 0, -r);
            ctx.closePath();
            ctx.stroke();
            break;
          }
          case 'paleta': {
            // M10 (pallet: frame + 3 slats) -- pink, T2 size tier.
            const color = '#FF54AD';
            ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.shadowBlur = 12; ctx.shadowColor = color;
            ctx.strokeRect(-r * 0.9, -r * 0.35, r * 1.8, r * 0.7);
            ctx.beginPath();
            ctx.moveTo(-r * 0.55, -r * 0.35); ctx.lineTo(-r * 0.55, r * 0.35);
            ctx.moveTo(0, -r * 0.35); ctx.lineTo(0, r * 0.35);
            ctx.moveTo(r * 0.55, -r * 0.35); ctx.lineTo(r * 0.55, r * 0.35);
            ctx.stroke();
            break;
          }
          case 'krysztal': {
            // M13 (pentagon gem, the payoff of the Portal twist) -- pink, T2 size tier.
            const color = '#FF54AD';
            ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.shadowBlur = 14; ctx.shadowColor = color;
            ctx.beginPath();
            ctx.moveTo(0, -r); ctx.lineTo(r * 0.85, -r * 0.15); ctx.lineTo(r * 0.6, r * 0.85);
            ctx.lineTo(-r * 0.6, r * 0.85); ctx.lineTo(-r * 0.85, -r * 0.15);
            ctx.closePath(); ctx.stroke();
            ctx.globalAlpha *= 0.6;
            ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r * 0.85); ctx.stroke();
            break;
          }
          case 'witryna': {
            // M14 (storefront pane) -- pink, T2 size tier.
            const color = '#FF54AD';
            ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.shadowBlur = 10; ctx.shadowColor = color;
            ctx.strokeRect(-r * 0.9, -r * 0.75, r * 1.8, r * 1.5);
            ctx.beginPath(); ctx.moveTo(-r * 0.9, -r * 0.2); ctx.lineTo(r * 0.9, -r * 0.2); ctx.stroke();
            break;
          }
          case 'klucz_sektora': {
            // M15 (bow + shaft + teeth) -- pink, T2 size tier.
            const color = '#FF54AD';
            ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.shadowBlur = 12; ctx.shadowColor = color;
            ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.15, r * 0.4, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, r * 0.1); ctx.lineTo(r * 0.75, r * 0.85);
            ctx.moveTo(r * 0.35, r * 0.45); ctx.lineTo(r * 0.6, r * 0.2);
            ctx.moveTo(r * 0.55, r * 0.65); ctx.lineTo(r * 0.8, r * 0.4);
            ctx.stroke();
            break;
          }
          case 'emiter': {
            // M21 (concentric rings + core dot) -- pink, T2 size tier.
            const color = '#FF54AD';
            ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.shadowBlur = 12; ctx.shadowColor = color;
            ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha *= 0.5;
            ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha *= 2;
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2); ctx.fill();
            break;
          }
          default: {
            // Flag on a pole -- fallback for any marker without a
            // mission-specific glyph. Pink, T2 size tier -- route A/B
            // (M07/M10's medal) is already spatially distinct, so it
            // doesn't need its own color too.
            const color = '#FF54AD';
            ctx.strokeStyle = ctx.fillStyle = color;
            ctx.shadowBlur = 14; ctx.shadowColor = color;
            ctx.beginPath(); ctx.moveTo(-r * 0.6, r); ctx.lineTo(-r * 0.6, -r); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-r * 0.6, -r); ctx.lineTo(r * 0.8, -r * 0.55); ctx.lineTo(-r * 0.6, -r * 0.1);
            ctx.closePath(); ctx.fill();
          }
        }
        break;
      }
      case 'node': {
        if (this.glyph === 'mostek') {
          // Mostek (M19), structural per OBJECT_CATALOG_SPEC.md §2.2: stays
          // on the board and just switches look when powered, instead of
          // fading out like every other node.
          const powered = this.mostekPowered;
          const color = powered ? '#50F0FA' : '#9875FF';
          ctx.strokeStyle = color; ctx.lineWidth = 1.8;
          ctx.shadowBlur = powered ? 16 : 6; ctx.shadowColor = color;
          if (!powered) ctx.globalAlpha *= 0.75;
          ctx.beginPath();
          ctx.moveTo(-r * 1.1, r * 0.5); ctx.quadraticCurveTo(0, -r * 0.9, r * 1.1, r * 0.5);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-r * 1.1, r * 0.5); ctx.lineTo(-r * 1.1, r * 0.85);
          ctx.moveTo(r * 1.1, r * 0.5); ctx.lineTo(r * 1.1, r * 0.85);
          ctx.stroke();
          break;
        }
        // Green, T3 size tier for both węzeł and zasilacz. Active/inactive
        // is dimmer opacity on the same hue instead of swapping color, so
        // the object still reads as itself even once it's used up.
        const color = '#46D99A';
        ctx.strokeStyle = color; ctx.lineWidth = 3;
        ctx.shadowBlur = this.active ? 16 : 3; ctx.shadowColor = color;
        if (!this.active) ctx.globalAlpha *= 0.35;
        if (this.glyph === 'zasilacz') {
          // M12, per obj-zasilacz (charger body + bolt).
          ctx.strokeRect(-r * 0.55, -r * 0.75, r * 1.1, r * 1.5);
          if (this.active) {
            ctx.beginPath();
            ctx.moveTo(r * 0.2, -r * 0.4); ctx.lineTo(-r * 0.15, r * 0.05);
            ctx.lineTo(r * 0.05, r * 0.05); ctx.lineTo(-r * 0.2, r * 0.5);
            ctx.stroke();
          }
        } else {
          // wezel (M04/M23, default): ring + X, unchanged from the
          // original generic node look.
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
          if (this.active) {
            ctx.beginPath();
            ctx.moveTo(-r * 0.4, -r * 0.4); ctx.lineTo(r * 0.4, r * 0.4);
            ctx.moveTo(r * 0.4, -r * 0.4); ctx.lineTo(-r * 0.4, r * 0.4);
            ctx.stroke();
          }
        }
        break;
      }
      case 'pylon': {
        // Both pylon (M08) and lustro (M16) are green, T3 size tier.
        const color = '#46D99A';
        ctx.strokeStyle = color; ctx.lineWidth = 3;
        ctx.shadowBlur = this.active ? 16 : 3; ctx.shadowColor = color;
        if (!this.active) ctx.globalAlpha *= 0.35;
        if (this.glyph === 'lustro') {
          // M16, per obj-lustro (tilted mirror panel + stand).
          ctx.save();
          ctx.rotate(0.2);
          ctx.strokeRect(-r * 0.42, -r * 0.9, r * 0.84, r * 1.8);
          ctx.beginPath(); ctx.moveTo(0, r * 0.9); ctx.lineTo(0, r * 1.15); ctx.stroke();
          ctx.restore();
        } else {
          // pylon (M08, default): mast + charge ring -- real graphic per
          // vector_hole_full_object_catalog.svg's obj-pylon (was a
          // placeholder line+circle before).
          ctx.beginPath(); ctx.moveTo(0, -r * 0.3); ctx.lineTo(0, r); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, -r * 0.65, r * 0.35, 0, Math.PI * 2); ctx.stroke();
          if (this.active) {
            ctx.globalAlpha *= 0.5;
            ctx.beginPath(); ctx.arc(0, -r * 0.65, r * 0.6, 0, Math.PI * 2); ctx.stroke();
          }
        }
        break;
      }
      case 'landmark': {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
        // Violet, T4 size tier (SIZE_TIER_COLORS) -- the biggest object
        // class, same hue for every landmark (silhouette below is what
        // tells them apart).
        const color = this.unlocked ? '#9875FF' : 'rgba(152, 117, 255, 0.35)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.6;
        ctx.shadowBlur = this.unlocked ? 20 + 8 * pulse : 6;
        ctx.shadowColor = color;
        if (!this.unlocked) ctx.setLineDash([10, 8]);

        // Unique per-district silhouette (vector_hole_mission_board_finale.svg
        // "LANDMARKI DZIELNIC") instead of the old generic double-ring for
        // every landmark -- the locked padlock overlay below stays shared.
        switch (this.landmarkId) {
          case 'kino':
            ctx.strokeRect(-r * 0.83, -r * 0.3, r * 1.66, r * 1.1);
            ctx.beginPath();
            ctx.moveTo(-r * 0.83, -r * 0.3); ctx.lineTo(-r * 0.96, -r * 0.56);
            ctx.lineTo(r * 0.96, -r * 0.56); ctx.lineTo(r * 0.83, -r * 0.3);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-r * 0.65, -r * 0.56); ctx.lineTo(-r * 0.65, -r * 0.3);
            ctx.moveTo(-r * 0.22, -r * 0.56); ctx.lineTo(-r * 0.22, -r * 0.3);
            ctx.moveTo(r * 0.22, -r * 0.56); ctx.lineTo(r * 0.22, -r * 0.3);
            ctx.moveTo(r * 0.65, -r * 0.56); ctx.lineTo(r * 0.65, -r * 0.3);
            ctx.stroke();
            ctx.strokeRect(-r * 0.52, r * 0.1, r * 1.04, r * 0.43);
            if (this.unlocked) {
              ctx.fillStyle = color;
              [-0.3, 0, 0.3].forEach(dx => { ctx.beginPath(); ctx.arc(r * dx, r * 0.3, r * 0.05, 0, Math.PI * 2); ctx.fill(); });
            }
            break;
          case 'fontanna':
            ctx.beginPath();
            ctx.ellipse(0, r * 0.65, r * 0.9, r * 0.2, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(0, r * 0.22, r * 0.48, r * 0.13, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, r * 0.22); ctx.lineTo(0, -r * 0.65);
            ctx.moveTo(0, -r * 0.65); ctx.quadraticCurveTo(-r * 0.4, -r * 0.25, -r * 0.68, r * 0.22);
            ctx.moveTo(0, -r * 0.65); ctx.quadraticCurveTo(r * 0.4, -r * 0.25, r * 0.68, r * 0.22);
            ctx.stroke();
            break;
          case 'dzwig':
            ctx.beginPath();
            ctx.moveTo(-r * 0.43, r * 0.85); ctx.lineTo(-r * 0.43, -r * 0.65);
            ctx.lineTo(r * 0.65, -r * 0.65);
            ctx.moveTo(-r * 0.43, -r * 0.35); ctx.lineTo(r * 0.35, -r * 0.65);
            ctx.moveTo(r * 0.65, -r * 0.65); ctx.lineTo(r * 0.65, r * 0.13);
            ctx.moveTo(-r * 0.43, r * 0.85); ctx.lineTo(-r * 0.09, r * 0.85);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(r * 0.56, r * 0.13); ctx.lineTo(r * 0.74, r * 0.13); ctx.lineTo(r * 0.65, r * 0.3);
            ctx.closePath();
            ctx.fillStyle = color; ctx.fill();
            break;
          case 'galeria_glowna':
            ctx.strokeRect(-r * 0.7, -r * 0.65, r * 1.4, r * 1.3);
            ctx.beginPath();
            ctx.moveTo(-r * 0.35, -r * 0.65); ctx.lineTo(-r * 0.35, r * 0.65);
            ctx.moveTo(0, -r * 0.65); ctx.lineTo(0, r * 0.65);
            ctx.moveTo(r * 0.35, -r * 0.65); ctx.lineTo(r * 0.35, r * 0.65);
            ctx.stroke();
            ctx.globalAlpha *= 0.6;
            ctx.beginPath();
            ctx.moveTo(-r * 0.7, -r * 0.22); ctx.lineTo(r * 0.7, -r * 0.3);
            ctx.moveTo(-r * 0.7, r * 0.17); ctx.lineTo(r * 0.7, r * 0.09);
            ctx.stroke();
            break;
          case 'iglica':
          case 'iglica_wejscie': {
            // iglica_wejscie (M19's mid-mission gate landmark) reuses the
            // same spire silhouette as the M20 boss Iglica, just smaller --
            // MISSION_BOARD_SPEC.md only specs the 6 boss landmarks and
            // doesn't cover this entity, so this is the simplest reasonable
            // reuse rather than inventing a 7th silhouette from nothing.
            const s = this.landmarkId === 'iglica' ? 1 : 0.62;
            ctx.beginPath();
            ctx.moveTo(-r * 0.3 * s, r * 0.87 * s); ctx.lineTo(-r * 0.3 * s, r * 0.22 * s);
            ctx.lineTo(-r * 0.13 * s, -r * 0.09 * s); ctx.lineTo(-r * 0.13 * s, -r * 0.43 * s);
            ctx.lineTo(0, -r * 0.87 * s);
            ctx.lineTo(r * 0.13 * s, -r * 0.43 * s); ctx.lineTo(r * 0.13 * s, -r * 0.09 * s);
            ctx.lineTo(r * 0.3 * s, r * 0.22 * s); ctx.lineTo(r * 0.3 * s, r * 0.87 * s);
            ctx.closePath();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-r * 0.22 * s, 0); ctx.lineTo(-r * 0.22 * s, r * 0.78 * s);
            ctx.moveTo(r * 0.22 * s, 0); ctx.lineTo(r * 0.22 * s, r * 0.78 * s);
            ctx.stroke();
            break;
          }
          case 'rdzen_miasta_glowny':
            ctx.beginPath();
            ctx.moveTo(0, -r * 0.82); ctx.lineTo(r * 0.7, 0); ctx.lineTo(0, r * 0.82); ctx.lineTo(-r * 0.7, 0);
            ctx.closePath();
            ctx.stroke();
            ctx.strokeStyle = '#68F5FC';
            ctx.beginPath();
            ctx.moveTo(0, -r * 0.48); ctx.lineTo(r * 0.39, 0); ctx.lineTo(0, r * 0.48); ctx.lineTo(-r * 0.39, 0);
            ctx.closePath();
            ctx.stroke();
            if (this.unlocked) { ctx.fillStyle = '#F5FAFF'; ctx.beginPath(); ctx.arc(0, 0, r * 0.09, 0, Math.PI * 2); ctx.fill(); }
            break;
          default:
            // Fallback: original generic double-ring, for any landmarkId
            // not covered above.
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.setLineDash([]);
        if (!this.unlocked) {
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = 'bold 18px Segoe UI, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🔒', 0, 0);
        }
        break;
      }
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
          ctx.setLineDash([10, 8]);
          ctx.beginPath(); ctx.moveTo(-hw, -r * 8); ctx.lineTo(-hw, r * 8); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(hw, -r * 8); ctx.lineTo(hw, r * 8); ctx.stroke();
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
    return clamp(s, 45, BASE_SPEED) * (this.tempSpeedMult || 1);
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
    this.radius = Math.max(MIN_RADIUS, Math.sqrt(newArea / Math.PI));
  }

  shrinkAndRespawn(bonusInvulnMs) {
    this.radius = BASE_RADIUS;
    this.x = rand(this.radius + 20, WORLD_W - this.radius - 20);
    this.y = rand(this.radius + 20, WORLD_H - this.radius - 20);
    this.invulnerableUntil = performance.now() + INVULN_TIME * 1000 + (bonusInvulnMs || 0);
  }

  draw(ctx, time) {
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

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.restore();

    ctx.save();
    if (this.invulnerable) ctx.globalAlpha = 0.55 + 0.35 * Math.sin(time * 12);

    if (this.skin === 'rainbow') {
      const segments = 20;
      const rot = time * 1.2;
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2 + rot;
        const a1 = ((i + 1) / segments) * Math.PI * 2 + rot;
        const hue = (i / segments) * 360 + rot * 40;
        const c = `hsl(${hue % 360}, 100%, 60%)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, a0, a1);
        ctx.strokeStyle = c;
        ctx.shadowBlur = 15;
        ctx.shadowColor = c;
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    } else {
      const c = this.skin === 'custom' ? this.edgeColor : (SKIN_MAP[this.skin] || this.edgeColor);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.strokeStyle = c;
      ctx.shadowBlur = 18;
      ctx.shadowColor = c;
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.font = 'bold 13px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 6;
    ctx.shadowColor = this.isPlayer ? '#50F0FA' : '#FF54AD';
    ctx.fillText(this.name, this.x, this.y - this.radius - 10);
    ctx.restore();
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

    for (const h of holes) {
      const d = dist(this.x, this.y, h.x, h.y);
      if (h.radius > this.radius * EAT_HOLE_RATIO && d < 320 && d < threatDist) {
        threat = h; threatDist = d;
      }
      if (this.radius > h.radius * EAT_HOLE_RATIO && !h.invulnerable && d < 420 && d < preyDist) {
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
      if (o.eating || o.radius >= this.radius * EAT_OBJ_RATIO || !canEatWorldObjectTier(this.radius, o)) continue;
      const d = dist(this.x, this.y, o.x, o.y);
      if (d < 480 && d < objDist) { obj = o; objDist = d; }
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
      this.decisionTimer = rand(0.35, 0.65);
    }
    this.moveToward(this.target.x, this.target.y, dt);
  }
}

/* ----------------------- Game ----------------------- */

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.save = loadSave();
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
    this.state = GameState.BOOT;

    // Movement intent shared by the Floating Thumb Pad and keyboard input;
    // legacy drag keeps using this.pointerWorld + moveToward() directly.
    this.moveVector = { x: 0, y: 0, magnitude: 0 };
    this.keyDir = { x: 0, y: 0 };
    this.thumbpadTouchId = null;
    this.thumbpadFadeTimer = null;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    this.bindUI();
    this.populateShop();
    this.updateCoinDisplays();
    this.updateChallengeCountdown();
    setInterval(() => this.updateChallengeCountdown(), 1000);

    this.state = GameState.MENU;
    this.showScreen('mainMenu'); // also renders the bottom nav for the initial screen
    this.analytics.track('session_start', { sessionId: this.sessionId, configVersion: CONFIG.version });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.analytics.track('session_end', { sessionId: this.sessionId });
      }
    });
  }

  /* ---------- setup ---------- */

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
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
    const updateFromScreen = (sx, sy) => {
      this.pointerWorld = {
        x: this.camera.x + (sx - this.width / 2),
        y: this.camera.y + (sy - this.height / 2)
      };
    };

    // ---- Mouse (desktop): unchanged direct-drag chase behavior. ----
    window.addEventListener('mousemove', (e) => updateFromScreen(e.clientX, e.clientY));

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
    document.getElementById('btnStart').addEventListener('click', () => {
      if (!this.isArenaUnlocked()) return;
      this.selectedRunTool = 'none';
      this.populateRunToolGrid();
      this.showScreen('runSetupScreen');
    });
    document.getElementById('btnStartTutorial').addEventListener('click', () => this.startCampaignMission('M00'));
    document.getElementById('btnTutorialIntroStart').addEventListener('click', () => this.dismissTutorialIntro());
    document.getElementById('btnConfirmStart').addEventListener('click', () => this.confirmRunSetup());
    document.getElementById('btnRunSetupBack').addEventListener('click', () => this.showScreen('mainMenu'));

    // GDD 4.0 §5.1: Miasto's secondary CTA opens the Wyzwania tab (goal
    // text/countdown/streak live there); the tab's own button actually
    // starts the round.
    document.getElementById('btnDaily').addEventListener('click', () => this.openChallengesScreen());
    document.getElementById('btnPlayDaily').addEventListener('click', () => this.startDailyChallenge());
    document.getElementById('btnChallengesBack').addEventListener('click', () => this.showScreen('mainMenu'));

    // GDD 4.0 §5.1-§5.4 bottom nav (Miasto/Dzielnice/Warsztat/Wyzwania).
    document.getElementById('btnNavMiasto').addEventListener('click', () => this.showScreen('mainMenu'));
    document.getElementById('btnNavDzielnice').addEventListener('click', () => this.openCampaignScreen());
    document.getElementById('btnNavWarsztat').addEventListener('click', () => { if (this.isWarsztatUnlocked()) this.openWarsztatScreen(); });
    document.getElementById('btnNavWyzwania').addEventListener('click', () => { if (this.isWyzwaniaUnlocked()) this.openChallengesScreen(); });

    document.getElementById('btnCampaignBack').addEventListener('click', () => this.showScreen('mainMenu'));
    document.getElementById('btnPlayMission').addEventListener('click', () => this.startCampaignMission(this.selectedMissionId));
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
    document.getElementById('btnShopBack').addEventListener('click', () => this.showScreen('mainMenu'));
    document.getElementById('btnEquip').addEventListener('click', () => this.onEquipClick());
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
      const selected = pendingId === item.id;
      const card = document.createElement('div');
      card.className = 'skin-card' + (selected ? ' selected' : '') + (!owned ? ' locked' : '');

      const swatch = document.createElement('div');
      swatch.className = 'skin-swatch';
      if (item.rainbow) {
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

      const meta = document.createElement('div');
      meta.className = owned ? 'skin-owned-badge' : 'skin-price';
      meta.textContent = owned ? (selected ? 'WYBRANY' : 'POSIADANE') : this.cosmeticLockLabel(item);
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
    if (item.unlockSource) {
      return item.unlockSource.type === 'coreCity'
        ? `🔒 CORE CITY LVL ${item.unlockSource.level}`
        : `🔒 MISJA ${item.unlockSource.id}`;
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
    this.renderCosmeticGrid('skinGrid', SKINS, this.save.owned, this.pendingLoadout.skin, skin => this.onSkinClick(skin));
    this.updateCosmeticUnlockedCount();
  }

  onSkinClick(skin) {
    const owned = this.save.owned.includes(skin.id);
    if (owned) {
      this.pendingLoadout.skin = skin.id;
    } else if (skin.unlockSource) {
      this.analytics.track('cosmetic_preview', { skinId: skin.id, locked: true });
      return;
    } else if (this.save.coins >= skin.price) {
      this.save.coins -= skin.price;
      this.save.owned.push(skin.id);
      this.pendingLoadout.skin = skin.id;
      this.analytics.track('soft_purchase', { skinId: skin.id, price: skin.price, currency: 'coins' });
      saveGame(this.save);
    } else {
      this.analytics.track('cosmetic_preview', { skinId: skin.id, price: skin.price, affordable: false });
      return;
    }
    this.populateShop();
    this.updateCoinDisplays();
    this.updateWarsztatPreview();
  }

  /** Phase 7 shop v2's second cosmetic category — gives Prisms an actual
   *  sink alongside Coins (GDD 10.1/10.2). Renamed "Trail" in the Warsztat
   *  UI per GDD 4.0 §5.3, same following-glow render path underneath. */
  populateAuras() {
    this.renderCosmeticGrid('auraGrid', AURAS, this.save.auras.owned, this.pendingLoadout.aura, aura => this.onAuraClick(aura));
    this.updateCosmeticUnlockedCount();
  }

  onAuraClick(aura) {
    const owned = this.save.auras.owned.includes(aura.id);
    if (owned) {
      this.pendingLoadout.aura = aura.id;
    } else if (aura.unlockSource) {
      this.analytics.track('cosmetic_preview', { auraId: aura.id, locked: true });
      return;
    } else if (aura.priceType === 'prisms') {
      if (this.save.prisms < aura.pricePrisms) {
        this.analytics.track('cosmetic_preview', { auraId: aura.id, affordable: false });
        return;
      }
      this.save.prisms -= aura.pricePrisms;
      this.save.auras.owned.push(aura.id);
      this.pendingLoadout.aura = aura.id;
      this.analytics.track('soft_purchase', { auraId: aura.id, price: aura.pricePrisms, currency: 'prisms' });
      saveGame(this.save);
    } else {
      if (this.save.coins < aura.priceCoins) {
        this.analytics.track('cosmetic_preview', { auraId: aura.id, affordable: false });
        return;
      }
      this.save.coins -= aura.priceCoins;
      this.save.auras.owned.push(aura.id);
      this.pendingLoadout.aura = aura.id;
      this.analytics.track('soft_purchase', { auraId: aura.id, price: aura.priceCoins, currency: 'coins' });
      saveGame(this.save);
    }
    this.populateAuras();
    this.updateCoinDisplays();
    this.updateWarsztatPreview();
  }

  /** GDD 4.0 §5.3 category 3: "Efekt pochłaniania" — see the color override
   *  in triggerEatFeedback(). 'classic' (free, color: null) is always owned. */
  populateEffects() {
    this.renderCosmeticGrid('effectGrid', EAT_EFFECTS, this.save.effects.owned, this.pendingLoadout.effect, effect => this.onEffectClick(effect));
    this.updateCosmeticUnlockedCount();
  }

  onEffectClick(effect) {
    const owned = this.save.effects.owned.includes(effect.id);
    if (owned) {
      this.pendingLoadout.effect = effect.id;
    } else if (effect.unlockSource) {
      this.analytics.track('cosmetic_preview', { effectId: effect.id, locked: true });
      return;
    } else if (this.save.coins >= (effect.priceCoins || 0)) {
      this.save.coins -= (effect.priceCoins || 0);
      this.save.effects.owned.push(effect.id);
      this.pendingLoadout.effect = effect.id;
      this.analytics.track('soft_purchase', { effectId: effect.id, price: effect.priceCoins || 0, currency: 'coins' });
      saveGame(this.save);
    } else {
      return;
    }
    this.populateEffects();
    this.updateCoinDisplays();
    this.updateWarsztatPreview();
  }

  /** GDD 4.0 §5.3 category 4: "Overdrive" — a cosmetic tint on Arena's
   *  existing seeded Overdrive finish, see checkOverdriveTrigger(). */
  populateOverdriveSkins() {
    this.renderCosmeticGrid('overdriveSkinGrid', OVERDRIVE_SKINS, this.save.overdriveSkins.owned, this.pendingLoadout.overdriveSkin, skin => this.onOverdriveSkinClick(skin));
    this.updateCosmeticUnlockedCount();
  }

  onOverdriveSkinClick(skin) {
    const owned = this.save.overdriveSkins.owned.includes(skin.id);
    if (owned) {
      this.pendingLoadout.overdriveSkin = skin.id;
    } else if (skin.unlockSource) {
      this.analytics.track('cosmetic_preview', { overdriveSkinId: skin.id, locked: true });
      return;
    } else if (this.save.coins >= (skin.priceCoins || 0)) {
      this.save.coins -= (skin.priceCoins || 0);
      this.save.overdriveSkins.owned.push(skin.id);
      this.pendingLoadout.overdriveSkin = skin.id;
      this.analytics.track('soft_purchase', { overdriveSkinId: skin.id, price: skin.priceCoins || 0, currency: 'coins' });
      saveGame(this.save);
    } else {
      return;
    }
    this.populateOverdriveSkins();
    this.updateCoinDisplays();
    this.updateWarsztatPreview();
  }

  /** GDD 4.0 §5.3 "ZAŁÓŻ" — commits the pending loadout (built up across
   *  all 4 tabs) to the actual save all at once. */
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
  isWarsztatUnlocked() {
    if (this.save.campaign.completed['M02']) return true;
    return this.save.owned.length > 1 || this.save.auras.owned.length > 1
      || this.save.effects.owned.length > 1 || this.save.overdriveSkins.owned.length > 1;
  }

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
    this.showScreen('shopScreen');
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

    const ring = document.getElementById('warsztatPreviewRing');
    if (skin.rainbow) {
      ring.style.borderColor = '#fff';
      ring.style.background = 'conic-gradient(red, orange, yellow, lime, cyan, blue, violet, red)';
      ring.style.boxShadow = 'none';
    } else {
      ring.style.borderColor = skin.color;
      ring.style.background = 'transparent';
      ring.style.boxShadow = `0 0 24px ${skin.color}`;
    }
    const trail = document.getElementById('warsztatPreviewTrail');
    trail.style.borderTopColor = (aura && aura.color) || 'var(--nc-cyan)';
    trail.style.borderRightColor = (aura && aura.color) || 'var(--nc-cyan)';
    trail.style.opacity = aura && aura.id !== 'none' ? '0.8' : '0.25';

    document.getElementById('warsztatActiveCore').textContent = skin.name;
    document.getElementById('warsztatActiveTrail').textContent = (aura && aura.name) || 'Brak';
    document.getElementById('warsztatActiveEffect').textContent = (effect && effect.name) || 'Klasyczny';
    document.getElementById('warsztatActiveOverdrive').textContent = (overdrive && overdrive.name) || 'Klasyczny';
  }

  /** Phase 7 casual run tools — Coins-only, consumed at round start, no
   *  ranked/daily equivalent exists yet to keep those modes fair. */
  populateRunToolGrid() {
    const grid = document.getElementById('runToolGrid');
    grid.innerHTML = '';
    RUN_TOOLS.forEach(tool => {
      const afford = tool.price === 0 || this.save.coins >= tool.price;
      const btn = document.createElement('button');
      btn.className = 'run-tool-card' + (this.selectedRunTool === tool.id ? ' selected' : '');
      btn.style.opacity = afford ? '1' : '0.5';
      btn.innerHTML = `<span><span class="run-tool-name">${tool.name}</span><br><span class="run-tool-desc">${tool.desc}</span></span><span>${tool.price > 0 ? '◈ ' + tool.price : ''}</span>`;
      btn.addEventListener('click', () => {
        if (!afford) return;
        this.selectedRunTool = tool.id;
        this.populateRunToolGrid();
      });
      grid.appendChild(btn);
    });
  }

  confirmRunSetup() {
    const tool = RUN_TOOLS.find(t => t.id === this.selectedRunTool);
    if (tool && tool.price > 0) {
      this.save.coins -= tool.price;
      saveGame(this.save);
      this.updateCoinDisplays();
    }
    this.startRound();
  }

  openProfileScreen() {
    document.getElementById('displayNameInput').value = this.save.displayName || '';
    document.getElementById('guestIdLabel').textContent = this.save.guestId;
    this.showScreen('profileScreen');
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
    this.analytics.track('daily_challenge_start', { dateKey, seed });
    this.startRound({ seed, daily: true });
  }

  /** navigator.share with a clipboard fallback — never assumes Web Share
   *  exists (GDD P6: feature-detect with canShare, always have a fallback). */
  async shareResult() {
    const place = document.getElementById('finalPlace').textContent;
    const score = document.getElementById('finalScore').textContent;
    const tagEl = document.getElementById('resultTag');
    const tag = !tagEl.classList.contains('hidden') ? ` [${tagEl.textContent}]` : '';
    const text = `Vector Hole — miejsce ${place}, wynik ${score}${tag}. Seed: ${this.runSeed}.`;
    const url = window.location.href;
    this.analytics.track('share_click', {});

    const btn = document.getElementById('btnShare');
    const originalText = btn.textContent;
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ text, url }))) {
        await navigator.share({ title: 'Vector Hole', text, url });
        this.analytics.track('share_success', {});
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        this.analytics.track('share_success', { fallback: 'clipboard' });
        btn.textContent = 'SKOPIOWANO ✓';
        setTimeout(() => { btn.textContent = originalText; }, 2000);
      }
    } catch (e) {
      this.analytics.track('share_fail', { error: String(e) });
    }
  }

  updateCoinDisplays() {
    document.getElementById('coinCountMenu').textContent = this.save.coins;
    document.getElementById('coinCountShop').textContent = this.save.coins;
    document.getElementById('coinCountDistricts').textContent = this.save.coins;
    document.getElementById('coinCountChallenges').textContent = this.save.coins;
    document.getElementById('prismCountMenu').textContent = this.save.prisms || 0;
    document.getElementById('prismCountShop').textContent = this.save.prisms || 0;
    document.getElementById('prismCountDistricts').textContent = this.save.prisms || 0;
    document.getElementById('prismCountChallenges').textContent = this.save.prisms || 0;

    // GDD 4.0 §8.3 Miasto/Core City copy: percent + "LVL X · do następnej
    // nagrody" + a preview of what 100% unlocks next, rendered as a real
    // circular progress ring (GDD 4.0 §5.1 mockup) instead of a linear bar.
    const level = this.save.hub.coreLevel || 1;
    const pct = this.save.hub.coreCharge || 0;
    const RING_CIRCUMFERENCE = 439.8; // 2 * PI * r(70), see .hub-ring-fill
    document.getElementById('hubRingFill').style.strokeDashoffset = RING_CIRCUMFERENCE * (1 - pct / 100);
    document.getElementById('hubChargeValue').textContent = pct + '%';
    document.getElementById('hubLevelLabel').textContent = `LVL ${level} · do następnej nagrody`;
    const nextReward = CORE_CITY_LEVEL_REWARDS[level + 1];
    const nextRewardLabel = nextReward ? nextReward.label : 'Premia';
    const nextRewardCoins = nextReward ? nextReward.coins : CONFIG.hub.milestoneFallbackCoins;
    document.getElementById('hubRewardChip1').textContent = nextRewardLabel;
    document.getElementById('hubRewardChip2').textContent = `+${nextRewardCoins} monet`;
    document.getElementById('hubRewardChip1Icon').innerHTML = REWARD_CATEGORY_ICONS[this.coreCityRewardCategory(nextReward)];
    document.getElementById('hubRewardPreview').textContent = nextRewardLabel;
    this.renderHubLevelDots(level);

    const arenaUnlocked = this.isArenaUnlocked();
    document.getElementById('btnStart').disabled = !arenaUnlocked;
    document.getElementById('btnDaily').disabled = !arenaUnlocked;
    // Locked: hide the (disabled) normal CTAs entirely and offer a direct
    // way into the M00 tutorial instead of just a hint pointing at
    // Dzielnice (player feedback -- a button beats a disabled button).
    document.getElementById('hubCtaRow').classList.toggle('hidden', !arenaUnlocked);
    document.getElementById('btnStartTutorial').classList.toggle('hidden', arenaUnlocked);
    const hint = document.getElementById('hubUnlockHint');
    hint.classList.toggle('hidden', arenaUnlocked);
    if (!arenaUnlocked) hint.textContent = 'Ukończ krótki tutorial powyżej, aby odblokować GRAJ 2:00.';

    const { dateKey } = dailySeedForDate(new Date());
    const { mission } = missionForDate(new Date());
    const missionDoneToday = this.save.mission.dateKey === dateKey && this.save.mission.completed;
    document.getElementById('hubMissionText').textContent = missionDoneToday
      ? `Misja dnia ukończona! Wróć jutro po nową. (+${mission.rewardCoins} monet odebrane)`
      : `Misja dnia: ${mission.name} (+${mission.rewardCoins} monet)`;

    const goalText = document.getElementById('dailyGoalText');
    if (this.save.daily.lastSeedDate === dateKey) {
      goalText.textContent = `Cel: pobij dzisiejszy rekord (${this.save.daily.lastSeedScore} pkt). Nagroda: +${CONFIG.daily.completionBonusCoins} monet, a za nowy rekord +${CONFIG.daily.newRecordBonusCoins} monet i +${CONFIG.daily.newRecordBonusPrisms} pryzmatów.`;
    } else {
      goalText.textContent = `Twoja pierwsza próba dziś — ten sam układ mapy co u wszystkich graczy. Nagroda za ukończenie: +${CONFIG.daily.completionBonusCoins} monet.`;
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

  /** Three circles connected by a track (poprzedni / aktualny / następny
   *  poziom) -- GDD 4.0 §5.1 mockup's "✓ LVL1 — ● LVL2 — ○ LVL3" progress
   *  row, generalized to any level: done levels get a checkmark, the
   *  current level a filled dot, future levels stay hollow. */
  renderHubLevelDots(level) {
    const wrap = document.getElementById('hubLevelDots');
    wrap.innerHTML = '';
    // LVL1 is the starting state with no prior level -- show it plus the
    // next two, rather than duplicating LVL1 via max(1, level-1).
    const shown = level === 1 ? [1, 2, 3] : [level - 1, level, level + 1];
    shown.forEach((n, i) => {
      if (i > 0) {
        const connector = document.createElement('div');
        connector.className = 'hub-level-connector' + (shown[i - 1] < level ? ' filled' : '');
        wrap.appendChild(connector);
      }
      const item = document.createElement('div');
      item.className = 'hub-level-item' + (n === level ? ' current' : '') + (n < level ? ' done' : '');
      const circle = document.createElement('div');
      circle.className = 'hub-level-circle';
      if (n < level) circle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>';
      else if (n === level) circle.innerHTML = '<div class="hub-level-circle-dot"></div>';
      item.appendChild(circle);
      const label = document.createElement('div');
      label.className = 'hub-level-label';
      label.textContent = `LVL ${n}`;
      item.appendChild(label);
      wrap.appendChild(item);
    });
  }

  /** GDD 4.0 §5.4 Wyzwania tab: Daily rotating mission + Daily Seed
   *  Challenge, both with a UTC countdown to the next reset. */
  openChallengesScreen() {
    if (!this.isWyzwaniaUnlocked()) return;
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
  }

  showScreen(id) {
    ['mainMenu', 'shopScreen', 'gameOverScreen', 'adOverlay', 'profileScreen', 'runSetupScreen', 'campaignScreen', 'missionResultScreen', 'challengesScreen'].forEach(s => {
      document.getElementById(s).classList.toggle('hidden', s !== id);
    });
    document.getElementById('hud').classList.toggle('hidden', true);
    document.getElementById('pauseSheet').classList.add('hidden');
    document.getElementById('leaveConfirm').classList.add('hidden');
    document.getElementById('resetProfileConfirm').classList.add('hidden');
    document.getElementById('tutorialIntroOverlay').classList.add('hidden');
    this.introPending = false;
    this.renderBottomNav(id);
  }

  hideAllOverlays() {
    ['mainMenu', 'shopScreen', 'gameOverScreen', 'adOverlay', 'pauseSheet', 'leaveConfirm', 'resetProfileConfirm', 'tutorialIntroOverlay', 'profileScreen', 'runSetupScreen', 'campaignScreen', 'missionResultScreen', 'challengesScreen'].forEach(s => {
      document.getElementById(s).classList.add('hidden');
    });
    document.getElementById('bottomNav').classList.add('hidden');
  }

  /** GDD 4.0 §5.1-§5.4: one persistent bottom nav across the 4 hub screens.
   *  §5.5 unlock order: Dzielnice is always available; Warsztat/Wyzwania
   *  gate off campaign mission completion (Miasto itself has no gate --
   *  it's the landing screen a fresh save opens on). */
  renderBottomNav(activeScreenId) {
    const NAV_SCREENS = ['mainMenu', 'campaignScreen', 'shopScreen', 'challengesScreen'];
    const nav = document.getElementById('bottomNav');
    nav.classList.toggle('hidden', !NAV_SCREENS.includes(activeScreenId));

    const tabs = [
      { btn: 'btnNavMiasto', screen: 'mainMenu', unlocked: true },
      { btn: 'btnNavDzielnice', screen: 'campaignScreen', unlocked: true },
      { btn: 'btnNavWarsztat', screen: 'shopScreen', unlocked: this.isWarsztatUnlocked() },
      { btn: 'btnNavWyzwania', screen: 'challengesScreen', unlocked: this.isWyzwaniaUnlocked() }
    ];
    tabs.forEach(t => {
      const btn = document.getElementById(t.btn);
      btn.classList.toggle('active', t.screen === activeScreenId);
      // GDD 4.0 mockup: a locked tab stays visible (dimmed, unclickable)
      // with a small lock badge -- never simply hidden.
      btn.classList.toggle('locked', !t.unlocked);
      const lockBadge = btn.querySelector('.nav-tab-lock');
      if (lockBadge) lockBadge.classList.toggle('hidden', t.unlocked);
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
  isArenaUnlocked() { return !!(this.save.campaign.completed['M00'] || this.save.campaign.completed['M01']); }

  /** GDD 4.0 §5.5: Wyzwanie dnia tab (and, per the same row, "full meta
   *  navigation") unlocks after clearing M04. */
  isWyzwaniaUnlocked() { return !!this.save.campaign.completed['M04']; }

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
    Object.keys(TIERS).forEach(tierName => {
      if (tierName !== 'portal' && !discovered.has(tierName)) return;
      for (let i = 0; i < TIERS[tierName].count; i++) {
        this.objects.push(new WorldObject(tierName, rng));
      }
    });
  }

  createEntities(rng) {
    const spawn = this.randomWorldPos(300, rng);
    this.player = new Hole(this.playerDisplayName(), spawn.x, spawn.y, true);
    this.player.skin = this.save.selected;
    this.player.auraId = this.save.auras.selected;

    this.bots = [];
    const names = pickUnique(BOT_NAME_POOL, NUM_BOTS, rng);
    for (let i = 0; i < NUM_BOTS; i++) {
      const p = this.randomWorldPos(300, rng);
      this.bots.push(new Bot(names[i], p.x, p.y));
    }

    // Phase 5 (scoped): a single lightweight run modifier, seed-driven so
    // a Daily Seed Challenge gets the same one for every player that day.
    // Full authored districts/chunks (GDD §14.2) are NOT implemented —
    // see docs/VECTRE_V2_PLAN.md for the explicit scope call.
    if (this.modifier === 'rush_hour') {
      for (const bot of this.bots) bot.tempSpeedMult = 1.3;
    }
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
    if (e.glyph === 'mostek') return e.mostekPowered ? '#50F0FA' : '#9875FF';
    const stats = CAMPAIGN_ENTITY_STATS[e.type];
    return stats ? SIZE_TIER_COLORS[stats.minTier] : '#fff';
  }

  /** {icon, color} for one "CEL RUNDY" HUD row -- `type` is a
   *  CampaignEntity type, or 'gate'/'combo' for the two goal shapes that
   *  aren't keyed by entity type (gatesPassed/comboChain). */
  campaignGoalIcon(type) {
    if (type === 'combo') return { icon: CARD_ICONS.burst, color: '#EFCB63' };
    if (type === 'gate') return { icon: GOAL_ICONS.gate, color: '#50F0FA' };
    // landmark's minTier (4) already resolves to SIZE_TIER_COLORS[4] below --
    // no separate override needed now that it's the same violet as the board object.
    const stats = CAMPAIGN_ENTITY_STATS[type];
    const color = stats ? SIZE_TIER_COLORS[stats.minTier] : '#fff';
    return { icon: GOAL_ICONS[type] || GOAL_ICONS.fragment, color };
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
      case 'tutorialChecklist':
        return g.steps.map(step => {
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
    if (g.type === 'tutorialChecklist') for (const step of g.steps) if (step.entityType) types.add(step.entityType);
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
      node.className = 'district-node' + (unlocked ? '' : ' locked');
      node.disabled = !unlocked;
      const doneCount = d.missions.filter(id => this.save.campaign.completed[id]).length;
      const status = unlocked ? `${doneCount}/${d.missions.length}` : '🔒';
      node.innerHTML = `<span class="district-node-name">${d.name}</span><span class="district-node-status">${status}</span>`;
      node.addEventListener('click', () => this.selectCampaignDistrict(d.id));
      wrap.appendChild(node);
    });
    const playableUnlocked = DISTRICTS.filter(d => this.save.campaign.unlockedDistricts.includes(d.id));
    const remembered = this.selectedDistrictId && playableUnlocked.find(d => d.id === this.selectedDistrictId);
    this.selectCampaignDistrict(remembered ? this.selectedDistrictId : playableUnlocked[0].id);
  }

  selectCampaignDistrict(districtId) {
    this.selectedDistrictId = districtId;
    const nodes = document.querySelectorAll('#districtMap .district-node');
    const districtIdx = DISTRICTS.findIndex(d => d.id === districtId);
    nodes.forEach((el, i) => el.classList.toggle('active', i === districtIdx));

    const district = DISTRICTS.find(d => d.id === districtId);
    // GDD 4.0 §8.4 anti-confusion: this header shows the district's OWN
    // rebuild % (§6 "0/4, 1/4... nie używać wielkiego okręgu Core City"),
    // never the Miasto/Core City percentage.
    const doneCount = district.missions.filter(id => this.save.campaign.completed[id]).length;
    const rebuildPct = Math.round((doneCount / district.missions.length) * 100);
    document.getElementById('districtTitle').textContent = district.name.toUpperCase();
    document.getElementById('districtRebuildLine').textContent = `ODBUDOWA: ${rebuildPct}% · ${doneCount} z ${district.missions.length} misji`;

    const list = document.getElementById('missionList');
    list.innerHTML = '';
    let firstPlayableId = null;
    let medalCount = 0;
    // GDD 4.0 §5.2 mockup: each row is "M0X / name / status caps line",
    // with a checkmark (done) or play icon (current) on the right --
    // never plain emoji, matching the mockup's clean line-icon language.
    const CHECK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>';
    const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7V5z"/></svg>';
    const LOCK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>';
    district.missions.forEach((id, i) => {
      const def = campaignMissionById(id);
      const done = !!this.save.campaign.completed[id];
      const prevDone = i === 0 || this.save.campaign.completed[district.missions[i - 1]];
      if (prevDone && !firstPlayableId) firstPlayableId = id;
      if (this.save.campaign.medals[id]) medalCount++;
      const row = document.createElement('button');
      row.className = 'mission-row' + (done ? ' done' : '') + (!prevDone ? ' locked' : '');
      row.disabled = !prevDone;
      const icon = done ? CHECK_ICON : (prevDone ? PLAY_ICON : LOCK_ICON);
      const status = done ? 'UKOŃCZONA · POWTÓRZ' : (prevDone ? 'DOSTĘPNA · GRAJ' : 'ZABLOKOWANA');
      row.innerHTML = `<span class="mission-row-main">` +
        `<span class="mission-row-id">M${String(def.order).padStart(2, '0')}</span>` +
        `<span class="mission-row-name">${def.name}</span>` +
        `<span class="mission-row-status">${status}</span>` +
        `</span><span class="mission-row-icon">${icon}</span>`;
      row.addEventListener('click', () => this.selectCampaignMission(id));
      list.appendChild(row);
    });
    document.getElementById('missionMedalsFootnote').innerHTML =
      `Medale: ${medalCount}/${district.missions.length} · opcjonalne.<br>Nie blokują kolejnych misji.`;
    this.selectCampaignMission(firstPlayableId || district.missions[0]);
  }

  selectCampaignMission(missionId) {
    const def = campaignMissionById(missionId);
    this.selectedMissionId = missionId;
    document.getElementById('missionDetailName').textContent = `${def.order}. ${def.name}`;
    document.getElementById('missionDetailGoal').textContent = 'Cel: ' + def.goal.label;
    document.getElementById('missionDetailMedal').textContent = 'Medal: ' + def.medal.label;
    document.getElementById('missionDetailNela').textContent = `NELA: „${def.nela.start}”`;
    document.getElementById('missionDetailReward').textContent = this.save.campaign.completed[missionId]
      ? 'Ukończona — możesz zagrać ponownie dla wprawy.'
      : `Pierwsze ukończenie: +${def.reward.coins} monet${def.reward.unlockDistrict ? ' + nowa dzielnica' : ''}.`;

    const district = DISTRICTS.find(d => d.id === def.district);
    const idxInDistrict = district.missions.indexOf(missionId);
    const prevDone = idxInDistrict === 0 || this.save.campaign.completed[district.missions[idxInDistrict - 1]];
    document.getElementById('btnPlayMission').disabled = !prevDone;
    document.querySelectorAll('#missionList .mission-row').forEach((el, i) => el.classList.toggle('selected', district.missions[i] === missionId));
  }

  /* ---- Mission build/spawn ---- */

  buildCampaignMission(def) {
    this.campaignEntities = [];
    this.campaignSpawn = null;
    const s = def.setup;
    const b = CONFIG.campaign.bounds;
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;

    const addMany = (type, count, posFn, extra) => {
      for (let i = 0; i < count; i++) {
        const p = posFn ? posFn(i) : this.randomInCampaignBounds(40);
        const opts = typeof extra === 'function' ? extra(i) : extra;
        this.campaignEntities.push(new CampaignEntity(type, p.x, p.y, opts));
      }
    };

    if (s.arcLayout) {
      // Mission 03: fragments laid along a loop so a fast, close-quarters
      // combo chain (goal: comboChain 12) is actually reachable in 90 s.
      const radius = 260;
      const count = s.fragments || 20;
      this.campaignSpawn = { x: cx - radius - 30, y: cy };
      addMany('fragment', count, (i) => {
        const a = (i / count) * Math.PI * 1.7 - Math.PI * 0.85;
        return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
      });
    } else {
      if (s.fragments) addMany('fragment', s.fragments);
      const propGlyph = PROP_GLYPHS[def.id];
      if (s.props && s.clusters) {
        const half = Math.ceil(s.props / 2);
        addMany('prop', half, () => ({ x: rand(b.minX + 40, cx - 60), y: rand(b.minY + 40, b.maxY - 40) }), () => ({ cluster: 'A', glyph: propGlyph || randomStreetGlyph() }));
        addMany('prop', s.props - half, () => ({ x: rand(cx + 60, b.maxX - 40), y: rand(b.minY + 40, b.maxY - 40) }), () => ({ cluster: 'B', glyph: propGlyph || randomStreetGlyph() }));
      } else if (s.props) {
        addMany('prop', s.props, null, () => ({ glyph: propGlyph || randomStreetGlyph() }));
      }
      // M11's vehicles ARE the goal ("Pojazd konwoju") -- grey per
      // obj-konwoj; every other mission's vehicles are plain filler
      // ("Samochód"), cyan per obj-samochod.
      if (s.vehicles) addMany('vehicle', s.vehicles, null, def.id === 'M11' ? { glyph: 'konwoj' } : null);
    }

    if (s.markers) {
      const glyph = MARKER_GLYPHS[def.id];
      if (def.id === 'M13') {
        // Portal twist (OBJECT_CATALOG_SPEC.md §2.3): the 6-8 crystals live
        // only on the far side of the portal (see the `s.gates` branch
        // below) instead of being split into the generic route A/B halves
        // -- M13's medal isn't route-based, so that split was flavor-only.
        addMany('marker', s.markers, () => ({ x: rand(cx + 140, b.maxX - 60), y: rand(b.minY + 60, b.maxY - 60) }), { glyph });
      } else {
        const half = Math.ceil(s.markers / 2);
        addMany('marker', half, () => ({ x: rand(b.minX + 60, cx - 100), y: rand(b.minY + 60, b.maxY - 60) }), { route: 'A', glyph });
        addMany('marker', s.markers - half, () => ({ x: rand(cx + 100, b.maxX - 60), y: rand(b.minY + 60, b.maxY - 60) }), { route: 'B', glyph });
      }
    }

    if (s.capsuleWaves) {
      s.capsuleWaves.forEach(waveStart => {
        addMany('capsule', s.capsulesPerWave || 8, null, { spawnAt: waveStart });
      });
    }

    if (s.gates) {
      if (def.id === 'M13') {
        // Portal (OBJECT_CATALOG_SPEC.md §2.3, §4): a single fixed,
        // one-way teleporter near the player's start, not a "pass through
        // when open" brama. Decision (open question in the spec): one-way
        // and single-use per run -- there's exactly one physical portal
        // entity on the board, so a "return trip" has no natural anchor to
        // teleport back from, and the mission goal never requires one.
        const near = { x: b.minX + 140, y: cy };
        const far = { x: b.maxX - 140, y: cy };
        this.campaignSpawn = near;
        this.campaignEntities.push(new CampaignEntity('gate', near.x, near.y, {
          glyph: 'portal', phase: 0, portalAnchors: [near, far]
        }));
      } else if (def.id === 'M18') {
        // Pas przelotu (OBJECT_CATALOG_SPEC.md §2.4): a corridor zone with
        // entry/exit tracking (handleCorridorZone()) instead of a single
        // point-touch gate -- "clearing" one means crossing all the way
        // through while lit, not just touching its center.
        for (let i = 0; i < s.gates; i++) {
          const t = (i + 1) / (s.gates + 1);
          const gx = lerp(b.minX + 80, b.maxX - 80, t);
          this.campaignEntities.push(new CampaignEntity('gate', gx, cy, {
            glyph: 'pas_przelotu', zoneHalfWidth: 90, phase: rand(0, CONFIG.campaign.gate.cycleSeconds)
          }));
        }
      } else {
        for (let i = 0; i < s.gates; i++) {
          const t = (i + 1) / (s.gates + 1);
          const gx = lerp(b.minX + 80, b.maxX - 80, t);
          this.campaignEntities.push(new CampaignEntity('gate', gx, cy, { phase: rand(0, CONFIG.campaign.gate.cycleSeconds) }));
        }
      }
    }

    if (s.nodes) {
      const glyph = NODE_GLYPHS[def.id] || 'wezel';
      for (let i = 0; i < s.nodes; i++) {
        const p = this.randomInCampaignBounds(80);
        this.campaignEntities.push(new CampaignEntity('node', p.x, p.y, { glyph }));
      }
    }
    if (s.pylons) {
      const glyph = def.id === 'M16' ? 'lustro' : 'pylon';
      for (let i = 0; i < s.pylons; i++) {
        const a = (i / s.pylons) * Math.PI * 2;
        this.campaignEntities.push(new CampaignEntity('pylon', cx + Math.cos(a) * 180, cy + Math.sin(a) * 180, { glyph }));
      }
    }
    // Fix: read the landmark id from `setup.landmark`, not `goal.landmark`.
    // M20 ("Iglica") and M24 ("Rdzeń Miasta") only set `setup.landmark` --
    // their `goal` object has no `landmark` field at all (unlike M04/M08/
    // M12/M16/M19, which duplicate the same id in both places) -- so the
    // original `if (def.goal.landmark)` check never fired for them and no
    // landmark entity was created, making those two missions (including the
    // campaign finale) impossible to complete. `s.landmark` is present for
    // every mission that needs one.
    if (s.landmark) {
      // Second fix, same root cause class: a plain eatCount landmark (M20,
      // M24) has no activator to ever set `unlocked = true` (that only
      // happens via tryUnlockCampaignLandmark(), which only runs for
      // activateAndDevour missions) -- without this, handleCampaignEating()'s
      // `if (e.type === 'landmark' && !e.unlocked) continue;` guard would
      // leave those two landmarks permanently uneatable even once they
      // exist. Both GDD labels ("Pochłoń centralną iglicę" / "Pochłoń
      // główny rdzeń miasta") describe a direct big-eat with no priming
      // step, so they simply start unlocked.
      const landmark = new CampaignEntity('landmark', cx, cy, {
        landmarkId: s.landmark,
        unlocked: def.goal.type !== 'activateAndDevour'
      });
      this.campaignEntities.push(landmark);
      this.mission.landmark = landmark;
    }
  }

  startCampaignMission(missionId) {
    const def = campaignMissionById(missionId || this.selectedMissionId);
    if (!def) return;
    this.mode = 'campaign';
    this.hideAllOverlays();
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
      tutorialRivalHintShown: false
    };

    this.buildCampaignMission(def);
    this.mission.goalGlyph = this.computeCampaignGoalGlyph();

    if (this.campaignSpawn) {
      this.player.x = this.campaignSpawn.x;
      this.player.y = this.campaignSpawn.y;
    } else {
      const start = this.randomInCampaignBounds(60);
      this.player.x = start.x;
      this.player.y = start.y;
    }

    this.bots = [];
    for (let i = 0; i < (def.setup.bots || 0); i++) {
      const p = this.randomInCampaignBounds(150);
      const bot = new Bot(BOT_NAME_POOL[i], p.x, p.y);
      bot.radius = CONFIG.hole.baseRadius * 1.1;
      this.bots.push(bot);
    }

    this.camera.x = this.player.x;
    this.camera.y = this.player.y;

    this.running = true;
    this.state = GameState.PLAYING;
    if (def.goal.type === 'tutorialChecklist') this.showTutorialStepIntro(0);
    else this.showNelaToast(def.nela.start);
    this.updateCampaignHUD();
    this.analytics.track('mission_start', { missionId: def.id, district: def.district });

    this.lastTime = performance.now();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  /* ---- Mission update loop ---- */

  updateCampaignBot(bot, dt) {
    if (!bot.wanderTarget || dist(bot.x, bot.y, bot.wanderTarget.x, bot.wanderTarget.y) < 40) {
      bot.wanderTarget = this.randomInCampaignBounds(80);
    }
    bot.moveToward(bot.wanderTarget.x, bot.wanderTarget.y, dt);
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
      if (tier < e.stats.minTier) continue;
      const d = dist(this.player.x, this.player.y, e.x, e.y);
      if (d < this.player.radius * 0.85 + e.radius * 0.3) e.startEating();
    }
  }

  tryUnlockCampaignLandmark() {
    const m = this.mission;
    const goal = m.def.goal;
    if (goal.type !== 'activateAndDevour' || !m.landmark || m.landmark.unlocked) return;
    const activated = goal.activator === 'node' ? m.nodesDisabled : m.pylonsCharged;
    if (activated >= goal.count) {
      m.landmark.unlocked = true;
      this.showNelaToast('Droga otwarta. Dosięgnij celu, gdy będziesz gotowa.');
    }
  }

  resolveCampaignEntity(e) {
    const m = this.mission;
    const stats = e.stats;
    const multiplier = this.registerCombo();
    // Physical growth now scales off the eaten entity's own radius, the
    // same GROW_K_OBJ formula Arena uses for WorldObject eats (player
    // feedback: T2+ eats -- prop/marker/vehicle/node/pylon -- barely moved
    // the hole's radius here, since the old flat growthUnits*scale formula
    // ignored how big the thing you just ate actually was). `growthUnits`
    // stays on its own flat-unit track below -- CAMPAIGN_TIERS thresholds,
    // mission goals, and the landmark unlock gate are unaffected.
    this.player.growFromArea(Math.PI * e.radius * e.radius * GROW_K_OBJ);
    m.growthUnits += stats.growth;
    this.player.score += Math.round(stats.score * multiplier);
    this.triggerEatFeedback(e.x, e.y, this.campaignEntityColor(e), e.radius, true);
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
      this.ripples.push(new Ripple(this.player.x, this.player.y, '#46D99A', this.player.radius, this.player.radius * 2.5, 0.5));
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
      // Same radius-based growth formula as resolveCampaignEntity() -- see
      // its doc comment.
      this.player.growFromArea(Math.PI * e.radius * e.radius * GROW_K_OBJ);
      m.growthUnits += stats.growth;
      this.player.score += Math.round(stats.score * multiplier);
      this.triggerEatFeedback(e.x, e.y, '#50F0FA', e.radius, true);
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
    this.spawnParticles(e.x, e.y, '#9875FF', 18);
    this.spawnParticles(dest.x, dest.y, '#9875FF', 18);
    this.ripples.push(new Ripple(dest.x, dest.y, '#9875FF', 10, e.radius * 3, 0.5));
    this.vibrate([30, 20, 30]);
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
        // not teach through sudden elimination).
        const loss = m.growthUnits * CONFIG.campaign.hitPenaltyFraction;
        m.growthUnits = Math.max(0, m.growthUnits - loss);
        this.player.growFromArea(-loss * CONFIG.campaign.growthAreaScale * Math.PI);
        this.comboCount = 0; this.comboMultiplier = 1; this.comboTimer = 0;
        this.player.invulnerableUntil = performance.now() + CONFIG.campaign.hitInvulnMs;
        m.botHitCount++;
        this.triggerShake(8);
        this.spawnParticles(this.player.x, this.player.y, '#ff3860', 20);
        this.vibrate([30, 40, 30]);
        this.analytics.track('mission_bot_hit', { missionId: m.def.id });
      } else if (this.player.radius > bot.radius * EAT_HOLE_RATIO) {
        // Rivals are prey too, once the player has outgrown them -- Campaign
        // bots were pure threats before (a documented simplification), the
        // same "bigger absorbs smaller" rule Arena already has, taught
        // explicitly by M00's tutorial goal. No CampaignEntity stats exist
        // for a generic rival, so growth/score are a fixed mid-tier-sized
        // reward instead of a stats table lookup.
        const multiplier = this.registerCombo();
        this.player.growFromArea(Math.PI * bot.radius * bot.radius * GROW_K_HOLE);
        m.growthUnits += 10;
        this.player.score += Math.round(bot.radius * 2 * multiplier);
        m.rivalsEaten++;
        this.rivalsEatenThisRun++;
        this.triggerEatFeedback(bot.x, bot.y, bot.edgeColor, bot.radius, true);
        this.vibrate(40);
        this.analytics.track('mission_rival_eaten', { missionId: m.def.id, rival: bot.name });
        if (!this.save.campaign.discoveredHoleEating) {
          this.save.campaign.discoveredHoleEating = true;
          saveGame(this.save);
        }
        bot.radius = CONFIG.hole.baseRadius * 1.1;
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
    const cards = pickUnique(CAMPAIGN_POWERS, count);
    this.analytics.track('evolution_offer', { options: cards.map(c => c.id), mode: 'campaign' });

    const grid = document.getElementById('evolutionCards');
    grid.innerHTML = '';
    grid.classList.toggle('count-2', cards.length === 2);
    cards.forEach(power => {
      const btn = document.createElement('button');
      btn.className = 'evolution-card';
      btn.style.borderColor = power.color;
      btn.innerHTML = `<span class="evolution-card-icon" style="color:${power.color}"><svg viewBox="0 0 24 24">${CARD_ICONS[power.icon] || ''}</svg></span>` +
        `<span class="evolution-card-name" style="color:${power.color}">${power.name}</span><span class="evolution-card-desc">${power.desc}</span>`;
      btn.addEventListener('click', () => this.pickCampaignPower(power.id));
      grid.appendChild(btn);
    });
    document.getElementById('evolutionOverlay').classList.remove('hidden');
    this.vibrate(40);

    clearTimeout(this.evolutionAutoPickTimer);
    this.evolutionAutoPickTimer = setTimeout(() => {
      if (this.evolutionPending && cards[0]) this.pickCampaignPower(cards[0].id);
    }, CONFIG.evolution.autoPickMs);
  }

  pickCampaignPower(id) {
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

  checkCampaignGoal() {
    const m = this.mission;
    if (m.ended || m.finishing) return;
    const g = m.def.goal;
    let progress = 0, target = 1, done = false;
    switch (g.type) {
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

    g.steps.forEach((step, i) => {
      if (m.tutorialStepDone[i]) return;
      const stepProgress = step.type === 'eatRival' ? m.rivalsEaten : (m.eatenByType[step.entityType] || 0);
      if (stepProgress < step.count) return;
      m.tutorialStepDone[i] = true;
      const nextIdx = g.steps.findIndex((s, j) => !m.tutorialStepDone[j]);
      if (nextIdx !== -1) this.showTutorialStepIntro(nextIdx);
    });

    if (!m.tutorialRivalHintShown) {
      const rivalIdx = g.steps.findIndex(s => s.type === 'eatRival');
      const bot = this.bots[0];
      if (rivalIdx !== -1 && !m.tutorialStepDone[rivalIdx] && bot && this.player.radius > bot.radius * EAT_HOLE_RATIO) {
        m.tutorialRivalHintShown = true;
        this.showNelaToast('Jesteś już większa od rywala — dotknij go, żeby go pochłonąć!');
      }
    }
  }

  showTutorialStepIntro(stepIndex) {
    this.showTutorialIntro(this.mission.def.goal.steps[stepIndex].intro);
  }

  showNelaToast(text) {
    const el = document.getElementById('nelaToast');
    el.textContent = 'NELA: „' + text + '”';
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.add('visible'));
    clearTimeout(this.nelaTimer);
    this.nelaTimer = setTimeout(() => el.classList.remove('visible'), CONFIG.campaign.nelaDisplaySeconds * 1000);
  }

  /** M00's opening instructions, unlike every other mission's auto-fading
   *  NELA toast: a blocking overlay that only closes on tap, freezing the
   *  round via introPending (loop()'s same skip-update()-entirely
   *  mechanism as the evolution offer) so the player reads at their own
   *  pace and the clock/entities don't start until they're ready
   *  (player feedback: "gracz decyduje kiedy zaczyna"). */
  showTutorialIntro(text) {
    this.introPending = true;
    document.getElementById('tutorialIntroText').textContent = text;
    document.getElementById('tutorialIntroOverlay').classList.remove('hidden');
  }

  dismissTutorialIntro() {
    this.introPending = false;
    document.getElementById('tutorialIntroOverlay').classList.add('hidden');
  }

  updateCampaignHUD() {
    const m = this.mission;
    document.getElementById('missionTimerValue').textContent = Math.ceil(m.timeRemaining);

    // "CEL RUNDY" section: one icon+label+progress row per goal shape (two
    // for activateAndDevour, so activator progress and the landmark bite
    // each get their own line instead of one combined string+number).
    document.getElementById('missionGoalItems').innerHTML = this.campaignGoalItems().map(it => `
      <div class="mission-goal-item">
        <span class="mission-goal-icon" style="color:${it.color}"><svg viewBox="0 0 24 24">${it.icon}</svg></span>
        <span class="mission-goal-text">${it.label}</span>
        <span class="mission-goal-count">${Math.min(it.progress, it.target)}/${it.target}</span>
      </div>`).join('');

    // Growth-tier "pasek ładowania": a compact bar + badge (e.g. "T1"),
    // not a label for whatever was just eaten -- title attr carries the
    // full tier name + next-tier caption for a hover/long-press tooltip
    // instead of a permanently-visible text block.
    const tier = this.campaignPlayerTier();
    const idx = CAMPAIGN_TIERS.indexOf(tier);
    const next = CAMPAIGN_TIERS[idx + 1];
    const pct = next ? clamp((m.growthUnits - tier.minUnits) / (next.minUnits - tier.minUnits), 0, 1) * 100 : 100;
    document.getElementById('missionTierBar').style.width = pct + '%';
    const badge = document.getElementById('missionTierBadge');
    badge.textContent = tier.id;
    badge.style.color = tier.color;
    badge.style.textShadow = `0 0 6px ${tier.color}`;
    badge.title = `${tier.name}${next ? ` · Postęp do ${next.id}` : ' · Poziom maksymalny'}`;

    document.getElementById('missionScoreValue').textContent = this.player.score;
  }

  updateCampaign(dt) {
    const m = this.mission;
    if (m.ended) return;
    m.elapsed += dt;
    m.timeRemaining = Math.max(0, m.def.timeLimit - m.elapsed);

    this.applyPlayerMovement(dt);
    this.clampToCampaignBounds(this.player);
    for (const bot of this.bots) { this.updateCampaignBot(bot, dt); this.clampToCampaignBounds(bot); }
    for (const e of this.campaignEntities) e.update(dt, m.elapsed);

    this.handleCampaignEating();
    this.handleCampaignBridges();
    for (const e of this.campaignEntities) {
      if (e.consumed && !e._resolved) {
        e._resolved = true;
        this.resolveCampaignEntity(e);
      }
    }
    this.handleCampaignGates();
    this.handleCampaignCollisions();
    this.updateMutationEffectsCampaign(dt);
    this.updateCombo(dt);
    if (this.comboCount === 0 && m._wasComboActive) {
      m.comboBroken = true;
      if (m.pylonPhaseStarted && !m.pylonPhaseDone) m.pylonComboBroken = true;
    }
    m._wasComboActive = this.comboCount > 0;

    this.checkCampaignEvolutionOffer();
    this.checkCampaignGoal();
    if (m.ended) return;
    this.updateTutorialGuidance();

    this.particles.forEach(p => p.update(dt));
    this.particles = this.particles.filter(p => !p.dead);
    this.ripples.forEach(r => r.update(dt));
    this.ripples = this.ripples.filter(r => !r.dead);

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

    if (m.timeRemaining <= 0 && !m.finishing) this.endCampaignMission(false);
  }

  /* ---- Mission end / result screen ---- */

  endCampaignMission(success) {
    const m = this.mission;
    if (m.ended) return;
    m.ended = true;
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    document.getElementById('hud').classList.add('hidden');

    let medalEarned = false;
    const medal = m.def.medal;
    if (success) {
      switch (medal.type) {
        case 'timeUnder': medalEarned = m.elapsed <= medal.seconds; break;
        case 'visitBothClusters': medalEarned = m.clustersVisited.has('A') && m.clustersVisited.has('B'); break;
        case 'noBotHit': medalEarned = m.botHitCount === 0; break;
        case 'comboUnbroken': medalEarned = !m.comboBroken; break;
        case 'comboAtLeast': medalEarned = m.maxComboDuringCapsule >= medal.count; break;
        case 'bothRoutesUsed': medalEarned = m.markersRoutes.has('A') && m.markersRoutes.has('B'); break;
        case 'pylonsUnbroken': medalEarned = !m.pylonComboBroken; break;
      }
    }

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
      }
    }
    if (medalEarned) this.save.campaign.medals[m.def.id] = true;
    saveGame(this.save);

    this.analytics.track('mission_end', {
      missionId: m.def.id, success, medalEarned, firstClear,
      durationMs: Math.round(m.elapsed * 1000)
    });

    this.showMissionResultScreen(success, medalEarned, firstClear);
  }

  showMissionResultScreen(success, medalEarned, firstClear) {
    const m = this.mission;
    const def = m.def;
    document.getElementById('missionResultTitle').textContent = success ? 'MISJA UKOŃCZONA' : 'CZAS MINĄŁ';
    document.getElementById('missionResultNela').textContent = success
      ? `NELA: „${def.nela.success}”`
      : 'Spróbuj jeszcze raz — teraz znasz już trasę.';
    document.getElementById('missionResultScore').textContent = this.player.score;
    document.getElementById('missionResultMedal').textContent = medalEarned
      ? `🏅 Medal: ${def.medal.label}`
      : `Medal nieukończony: ${def.medal.label}`;
    document.getElementById('missionResultMedal').classList.toggle('earned', medalEarned);
    document.getElementById('missionResultReward').textContent = firstClear
      ? `+${def.reward.coins} monet (pierwsze ukończenie)${def.reward.unlockDistrict ? ' + nowa dzielnica!' : ''}${def.reward.unlockSkin ? ' + kosmetyk finałowy!' : ''}`
      : (success ? 'Nagroda za pierwsze ukończenie już odebrana wcześniej.' : 'Brak nagrody — czas minął.');

    const district = DISTRICTS.find(d => d.id === def.district);
    const idx = district.missions.indexOf(def.id);
    const nextId = success ? district.missions[idx + 1] : null;
    const btnNext = document.getElementById('btnMissionNext');
    if (nextId) {
      btnNext.textContent = `DALEJ: MISJA ${campaignMissionById(nextId).order}`;
      btnNext.classList.remove('hidden');
      btnNext.onclick = () => this.startCampaignMission(nextId);
    } else if (success) {
      const isFinalMission = district.order === DISTRICTS.length;
      btnNext.textContent = isFinalMission ? 'KAMPANIA UKOŃCZONA — DO MIASTA' : 'DZIELNICA UKOŃCZONA — DO MAPY';
      btnNext.classList.remove('hidden');
      btnNext.onclick = isFinalMission
        ? () => { this.updateCoinDisplays(); this.showScreen('mainMenu'); }
        : () => { this.updateCoinDisplays(); this.openCampaignScreen(); };
    } else {
      btnNext.classList.add('hidden');
    }
    document.getElementById('btnMissionRetry').onclick = () => this.startCampaignMission(def.id);
    document.getElementById('btnMissionMap').onclick = () => { this.updateCoinDisplays(); this.openCampaignScreen(); };

    this.updateCoinDisplays();
    this.showScreen('missionResultScreen');
  }

  /* ---- Campaign rendering ---- */

  renderCampaign(time) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.width, this.height);

    let shakeX = 0, shakeY = 0;
    if (this.shake > 0) { shakeX = rand(-this.shake, this.shake); shakeY = rand(-this.shake, this.shake); }

    ctx.save();
    ctx.translate(this.width / 2 - this.camera.x + shakeX, this.height / 2 - this.camera.y + shakeY);
    this.drawCampaignGrid(ctx);
    const goalTypes = this.campaignGoalEntityTypes();
    const goalGlyph = this.mission ? this.mission.goalGlyph : null;
    for (const e of this.campaignEntities) {
      const isGoal = goalTypes.has(e.type) && (!goalGlyph || e.glyph === goalGlyph);
      e.draw(ctx, isGoal);
    }
    this.drawScannerTarget(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const r of this.ripples) r.draw(ctx);

    const holes = [...this.bots, this.player];
    holes.sort((a, b) => a.radius - b.radius);
    for (const h of holes) h.draw(ctx, time);

    this.drawComboText(ctx);
    ctx.restore();

    if (this.showMinimap) this.drawCampaignMinimap(ctx);
  }

  /** Arena's own drawGrid() draws the grid lines out to the full
   *  WORLD_W/WORLD_H and marks that true edge with a plain solid rect --
   *  reaching it just means you've reached where the rendered map ends,
   *  with nothing drawn beyond it. Reusing that directly for Campaign
   *  would draw a full-world grid the player could then wander into past
   *  CONFIG.campaign.bounds (see clampToCampaignBounds()'s doc comment for
   *  why that clamp is back) with nothing there -- so grid lines and the
   *  edge marker are instead clipped to CONFIG.campaign.bounds, same
   *  style as Arena's drawGrid(), so nothing renders past the actual
   *  clamp and the bounds box reads as the map, not a fence inside one. */
  drawCampaignGrid(ctx) {
    const b = CONFIG.campaign.bounds;
    const startX = Math.max(b.minX, Math.floor((this.camera.x - this.width / 2) / GRID_SIZE) * GRID_SIZE);
    const endX = Math.min(b.maxX, this.camera.x + this.width / 2);
    const startY = Math.max(b.minY, Math.floor((this.camera.y - this.height / 2) / GRID_SIZE) * GRID_SIZE);
    const endY = Math.min(b.maxY, this.camera.y + this.height / 2);

    ctx.save();
    ctx.strokeStyle = 'rgba(80, 240, 250, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += GRID_SIZE) {
      ctx.moveTo(x, Math.max(b.minY, this.camera.y - this.height / 2));
      ctx.lineTo(x, Math.min(b.maxY, this.camera.y + this.height / 2));
    }
    for (let y = startY; y <= endY; y += GRID_SIZE) {
      ctx.moveTo(Math.max(b.minX, this.camera.x - this.width / 2), y);
      ctx.lineTo(Math.min(b.maxX, this.camera.x + this.width / 2), y);
    }
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 84, 173, 0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    ctx.restore();
  }

  drawCampaignMinimap(ctx) {
    const size = 130, margin = 16;
    const px = this.width - size - margin, py = this.height - size - margin;
    const b = CONFIG.campaign.bounds;
    const scaleX = size / (b.maxX - b.minX), scaleY = size / (b.maxY - b.minY);

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeStyle = 'rgba(80, 240, 250,0.4)';
    ctx.lineWidth = 1;
    ctx.fillRect(px, py, size, size);
    ctx.strokeRect(px, py, size, size);

    // Every live entity gets a dot, not just landmark/node/pylon -- the
    // minimap used to hide fragments/props/vehicles/capsules/markers/gates
    // entirely (player feedback: the map should represent everything).
    const toMini = (x, y) => ({ x: px + (x - b.minX) * scaleX, y: py + (y - b.minY) * scaleY });
    for (const e of this.campaignEntities) {
      if (e.consumed || !e.live) continue;
      const big = e.type === 'landmark' || e.type === 'node' || e.type === 'pylon' || e.type === 'gate';
      const size = big ? 3 : 1.6;
      const p = toMini(e.x, e.y);
      ctx.fillStyle = this.campaignEntityColor(e);
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
    for (const bot of this.bots) {
      const p = toMini(bot.x, bot.y);
      ctx.fillStyle = bot.edgeColor;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    const pp = toMini(this.player.x, this.player.y);
    ctx.fillStyle = '#50F0FA';
    ctx.beginPath(); ctx.arc(pp.x, pp.y, 3.5, 0, Math.PI * 2); ctx.fill();

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
    this.mode = 'arena';
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

    this.createObjects(this.rng);
    this.createEntities(this.rng);
    this.particles = [];
    this.ripples = [];
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
    this.toolMagnetUntil = this.selectedRunTool === 'magnet' ? performance.now() + 8000 : 0;
    this.selectedRunTool = 'none'; // one-shot: "Play Again" won't silently re-apply a paid tool for free

    this.running = true;
    this.state = GameState.PLAYING;

    const hint = document.getElementById('mobile-hint');
    hint.textContent = (this.useThumbpad
      ? 'Dotknij dolną część ekranu, aby sterować kciukiem'
      : 'Dotknij i przeciągaj, aby sterować dziurą')
      + (this.modifier === 'rush_hour' ? ' • RUSH HOUR: rywale są szybsi w tej rundzie!' : '');
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
      runTool: this.selectedRunTool,
      daily: this.isDailyRun
    });
  }

  requestPlayAgain() {
    this.playCount++;
    if (this.playCount % 2 === 0) {
      this.showInterstitialAd('interstitial', () => this.startRound());
    } else {
      this.startRound();
    }
  }

  showInterstitialAd(context, onDone) {
    this.analytics.track('ad_started', { context });
    this.showScreen('adOverlay');
    const bar = document.getElementById('adProgressBar');
    const countdown = document.getElementById('adCountdown');
    bar.style.width = '0%';
    let t = 0;
    const duration = 3;
    const tick = () => {
      t += 0.1;
      const pct = clamp((t / duration) * 100, 0, 100);
      bar.style.width = pct + '%';
      countdown.textContent = Math.max(0, Math.ceil(duration - t));
      if (t >= duration) {
        onDone();
      } else {
        setTimeout(tick, 100);
      }
    };
    tick();
  }

  watchRewardedAd() {
    if (this.adUsedThisRound) return;
    this.adUsedThisRound = true;
    this.analytics.track('ad_offer', { context: 'result_double_coins' });
    const btn = document.getElementById('btnWatchAd');
    btn.disabled = true;
    this.showInterstitialAd('rewarded_double_coins', () => {
      const total = Math.round(this.adPendingCoins * CONFIG.economy.adRewardMultiplier);
      const bonus = total - this.adPendingCoins;
      this.save.coins += bonus;
      saveGame(this.save);
      document.getElementById('finalCoins').textContent = total;
      btn.textContent = 'ODEBRANO x2 ✓';
      this.hideAllOverlays();
      document.getElementById('gameOverScreen').classList.remove('hidden');
      this.updateCoinDisplays();
      this.analytics.track('ad_reward_granted', { context: 'result_double_coins', bonus });
    });
  }

  /** Stops the round, grants coins for the score reached so far, and
   *  persists stats. Shared by a normal timeout end and an early Leave Run,
   *  which only differ in whether the results screen is shown. */
  finalizeRun() {
    this.running = false;
    this.paused = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    document.getElementById('hud').classList.add('hidden');

    const ranked = rankHoles([this.player, ...this.bots]);
    const place = ranked.indexOf(this.player) + 1;
    const coinsEarned = Math.floor(this.player.score / CONFIG.economy.coinsPerScorePoint) + CONFIG.economy.coinsBase;
    this.adPendingCoins = coinsEarned;
    this.save.coins += coinsEarned;
    this.save.stats.runsPlayed = (this.save.stats.runsPlayed || 0) + 1;

    // Phase 7: Prisms have no IAP adapter yet, so the only earn path is a
    // small trickle from progression (GDD 10.1's "slowly earned" clause).
    if (this.save.stats.runsPlayed % 3 === 0) this.save.prisms = (this.save.prisms || 0) + 1;

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
    }
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
    return { level, label: def.label, coins: def.coins };
  }

  endRound() {
    this.state = GameState.RESULTS;
    const corePctBefore = this.save.hub.coreCharge || 0;
    const bestArenaScoreBefore = this.save.stats.bestArenaScore || 0;
    const { ranked, place, coinsEarned } = this.finalizeRun();
    const corePctAfter = this.save.hub.coreCharge || 0;

    document.getElementById('finalPlace').textContent = '#' + place;
    document.getElementById('finalScore').textContent = this.player.score;
    document.getElementById('finalCoins').textContent = coinsEarned;

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
        ? `🗓️ WYZWANIE DNIA: NOWY REKORD! +${r.dailyBonusCoins} monet, +${r.dailyBonusPrisms} pryzmatów`
        : `🗓️ WYZWANIE DNIA ukończone: +${r.dailyBonusCoins} monet (rekord dnia: ${r.previousBest})`) + ` · seria: ${r.streak} dni`;
      dailyLine.classList.remove('hidden');
    } else {
      dailyLine.classList.add('hidden');
    }

    const missionLine = document.getElementById('missionResultLine');
    if (this.missionJustCompleted) {
      missionLine.textContent = `🎯 MISJA UKOŃCZONA: „${this.activeMission.name}" — +${this.activeMission.rewardCoins} monet`;
      missionLine.classList.remove('hidden');
    } else {
      missionLine.classList.add('hidden');
    }

    const hubLine = document.getElementById('hubMilestoneLine');
    if (this.hubMilestoneReached) {
      const summary = this.hubMilestoneRewards.map(r => `LVL ${r.level}: ${r.label} (+${r.coins} monet)`).join(' · ');
      hubLine.textContent = `🌀 CORE CITY: ${summary}`;
      hubLine.classList.remove('hidden');
    } else {
      hubLine.classList.add('hidden');
    }

    const list = document.getElementById('finalLeaderboard');
    list.innerHTML = '';
    ranked.forEach((h, i) => {
      const li = document.createElement('li');
      if (h === this.player) li.classList.add('is-player');
      li.innerHTML = `<span class="fl-rank">#${i + 1}</span><span class="fl-name">${h.name}</span><span class="fl-score">${h.score} pkt</span><span class="fl-size">Ø ${Math.round(h.radius)}</span>`;
      list.appendChild(li);
    });

    document.getElementById('btnWatchAd').disabled = false;
    document.getElementById('btnWatchAd').textContent = 'OGLĄDAJ REKLAMĘ · X2 MONET';

    this.showScreen('gameOverScreen');
    this.updateCoinDisplays();

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
    document.getElementById('pauseSheet').classList.remove('hidden');
    this.syncControlsPanel();
  }

  resumeGame() {
    if (!this.paused) return;
    this.paused = false;
    this.state = GameState.PLAYING;
    document.getElementById('pauseSheet').classList.add('hidden');
    document.getElementById('leaveConfirm').classList.add('hidden');
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  /** Restarts whatever is actually running. Used to unconditionally call
   *  startRound() (a new random Arena round), which meant restarting from
   *  the pause sheet mid-mission silently dropped the player into Arena
   *  instead of replaying the mission they paused (player feedback: the
   *  restart button should restart the current mission). */
  restartFromPause() {
    document.getElementById('pauseSheet').classList.add('hidden');
    if (this.mode === 'campaign' && this.mission) {
      this.startCampaignMission(this.mission.def.id);
    } else {
      this.startRound();
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
    if (this.rafId) cancelAnimationFrame(this.rafId);
    document.getElementById('hud').classList.add('hidden');
    if (this.mission) {
      this.mission.ended = true;
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
  }

  /* ---------- gameplay ---------- */

  spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y, color));
  }

  triggerShake(amount) {
    this.shake = Math.max(this.shake, amount);
  }

  /** Eat feedback scaled by what got eaten: tiny = a subtle tick, medium =
   *  pulse + particles, giant = heavier shake + particles + a ring ripple
   *  (GDD 5.4 — "eat feedback zależny od wielkości"). */
  triggerEatFeedback(x, y, color, eatenRadius, isPlayerInvolved) {
    const { tinyMaxRadius, mediumMaxRadius } = CONFIG.juice.eatTiers;
    let particles, shakeAmt, giant;
    if (eatenRadius <= tinyMaxRadius) {
      particles = 8; shakeAmt = 0; giant = false;
    } else if (eatenRadius <= mediumMaxRadius) {
      particles = 16; shakeAmt = 3; giant = false;
    } else {
      particles = 30; shakeAmt = 10; giant = true;
    }
    // GDD 4.0 §5.3 "Efekt pochłaniania" cosmetic: the player's selected
    // burst color overrides the eaten object's own color, but only for
    // eats the player caused ('classic' has color: null, i.e. no override).
    const effectId = this.save && this.save.effects && this.save.effects.selected;
    const effect = EAT_EFFECTS.find(e => e.id === effectId);
    const burstColor = (isPlayerInvolved && effect && effect.color) || color;
    this.spawnParticles(x, y, burstColor, particles);
    if (shakeAmt > 0) this.triggerShake(isPlayerInvolved ? shakeAmt : shakeAmt * 0.4);
    if (giant) this.ripples.push(new Ripple(x, y, burstColor, eatenRadius * 0.6, eatenRadius * 3, 0.5));
  }

  /** Bumps the player's combo (consecutive eats within the combo window)
   *  and returns the current score multiplier. Fades out smoothly rather
   *  than cutting abruptly when the window lapses (see update()). */
  registerCombo() {
    this.comboCount++;
    // Combo Reactor mutation (Phase 4) extends the window for this run only.
    this.comboTimer = this.comboWindowOverride || CONFIG.juice.combo.windowSeconds;
    // Campaign uses its own multiplier cap (GDD 07: "combo 1,0-2,0 mnoży
    // punkty, nie wzrost"); Arena/Daily keep their existing tuned cap.
    const maxMultiplier = this.mode === 'campaign' ? CONFIG.campaign.comboMaxMultiplier : CONFIG.juice.combo.maxMultiplier;
    this.comboMultiplier = clamp(1 + (this.comboCount - 1) * CONFIG.juice.combo.stepBonus, 1, maxMultiplier);
    this.comboDisplayAlpha = 1;
    if (this.activeMutations.has('slipstream') && this.comboCount >= CONFIG.evolution.slipstreamComboThreshold) {
      this.speedBoostUntil = performance.now() + CONFIG.evolution.slipstreamMs;
    }
    return this.comboMultiplier;
  }

  handleObjectEating(hole) {
    for (const obj of this.objects) {
      if (obj.eating) continue;
      if (obj.radius >= hole.radius * EAT_OBJ_RATIO) continue;
      if (!canEatWorldObjectTier(hole.radius, obj)) continue;
      const d = dist(hole.x, hole.y, obj.x, obj.y);
      if (d < hole.radius * 0.85) obj.startEating(hole);
    }
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
            this.vibrate(60);
            continue;
          }

          a.growFromArea(Math.PI * b.radius * b.radius * GROW_K_HOLE);
          const multiplier = a.isPlayer ? this.registerCombo() : 1;
          const isBounty = a.isPlayer && b === this.bountyTarget;
          a.score += Math.round(b.radius * 2 * multiplier) + (isBounty ? CONFIG.evolution.bountyBonusScore : 0);
          if (isBounty) this.bountyTarget = null;
          this.triggerEatFeedback(b.x, b.y, b.isPlayer ? '#50F0FA' : b.edgeColor, b.radius, a.isPlayer || b.isPlayer);
          if (a.isPlayer) {
            this.rivalsEatenThisRun++;
            this.analytics.track('rival_eaten', { rival: b.name, rivalSize: Math.round(b.radius), bounty: isBounty });
            this.vibrate(40);
          } else if (b.isPlayer) {
            this.analytics.track('player_eaten', { by: a.name, playerSize: Math.round(b.radius) });
            this.vibrate([30, 40, 30]);
          }
          const phaseEdgeBonus = (b.isPlayer && this.activeMutations.has('phase_edge')) ? CONFIG.evolution.phaseEdgeInvulnBonusMs : 0;
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
      // Growth-tier transition pulse (green = positive per GDD 5.4's color
      // hierarchy). Phase 4's evolution offers trigger from the same
      // radius crossings via CONFIG.evolution.triggerRadii, checked
      // separately in checkEvolutionTriggers() below.
      this.ripples.push(new Ripple(this.player.x, this.player.y, '#46D99A', this.player.radius, this.player.radius * 2.5, 0.5));
      this.spawnParticles(this.player.x, this.player.y, '#46D99A', 20);
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
    this.evolutionPending = true;
    const cards = this.pickMutationCards();
    this.analytics.track('evolution_offer', { options: cards.map(c => c.id) });

    const grid = document.getElementById('evolutionCards');
    grid.innerHTML = '';
    cards.forEach(m => {
      const btn = document.createElement('button');
      btn.className = 'evolution-card';
      btn.style.borderColor = m.color;
      btn.innerHTML = `<span class="evolution-card-icon" style="color:${m.color}"><svg viewBox="0 0 24 24">${CARD_ICONS[m.icon] || ''}</svg></span>` +
        `<span class="evolution-card-name" style="color:${m.color}">${m.name}</span><span class="evolution-card-desc">${m.desc}</span>`;
      btn.addEventListener('click', () => this.pickMutation(m.id));
      grid.appendChild(btn);
    });
    document.getElementById('evolutionOverlay').classList.remove('hidden');
    this.vibrate(40);

    clearTimeout(this.evolutionAutoPickTimer);
    this.evolutionAutoPickTimer = setTimeout(() => {
      if (this.evolutionPending && cards[0]) this.pickMutation(cards[0].id);
    }, CONFIG.evolution.autoPickMs);
  }

  pickMutation(id) {
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
    this.overdriveTag = this.overdriveVariant === 'blackout' ? 'BLACKOUT FINISH' : 'PORTAL STORM';
    this.analytics.track('overdrive_start', { variant: this.overdriveVariant, runId: this.runId });
    this.vibrate([60, 40, 60]);

    // GDD 4.0 §5.3 "Overdrive" cosmetic: a tint on the existing seeded
    // finish -- doesn't change which variant is picked, just its color.
    const skinId = this.save && this.save.overdriveSkins && this.save.overdriveSkins.selected;
    const skin = OVERDRIVE_SKINS.find(s => s.id === skinId);
    const banner = document.getElementById('overdriveBanner');
    if (skin && skin.color) banner.style.setProperty('--overdrive-color', skin.color);
    else banner.style.removeProperty('--overdrive-color');
    banner.classList.remove('hidden');
    setTimeout(() => banner.classList.add('hidden'), 3000);

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

    if (now < this.magnetUntil || now < this.toolMagnetUntil) {
      for (const obj of this.objects) {
        if (obj.eating || obj.radius >= this.player.radius * EAT_OBJ_RATIO || !canEatWorldObjectTier(this.player.radius, obj)) continue;
        const d = dist(this.player.x, this.player.y, obj.x, obj.y);
        if (d > 0 && d < CONFIG.evolution.magnetRadius) {
          const pull = CONFIG.evolution.magnetPull * (1 - d / CONFIG.evolution.magnetRadius);
          obj.x -= ((obj.x - this.player.x) / d) * pull * dt;
          obj.y -= ((obj.y - this.player.y) / d) * pull * dt;
        }
      }
    }

    this.player.tempSpeedMult = now < this.speedBoostUntil ? CONFIG.evolution.slipstreamSpeedMult : 1;

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
    if (!this.useThumbpad || !this.isTouchDevice) {
      this.player.moveToward(this.pointerWorld.x, this.pointerWorld.y, dt);
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
    for (const bot of this.bots) bot.update(dt, this);

    for (const obj of this.objects) obj.update(dt);

    this.handleObjectEating(this.player);
    for (const bot of this.bots) this.handleObjectEating(bot);

    for (const obj of this.objects) {
      if (obj.consumed) {
        const hole = obj.eater;
        hole.growFromArea(Math.PI * obj.radius * obj.radius * GROW_K_OBJ);
        const multiplier = hole.isPlayer ? this.registerCombo() : 1;
        hole.score += Math.round(obj.value * multiplier);
        this.triggerEatFeedback(obj.x, obj.y, obj.color, obj.radius, hole.isPlayer);
        if (hole.isPlayer && !this.firstEatTracked) {
          this.firstEatTracked = true;
          this.analytics.track('first_eat', { objectTier: obj.tier });
        }
        obj.respawn(obj.tier, false);
      }
    }

    this.handleHoleCollisions();
    this.checkSizeTier();
    this.checkEvolutionTriggers();
    this.checkOverdriveTrigger();
    this.updateMutationEffects(dt);
    this.checkMissionProgress();

    this.particles.forEach(p => p.update(dt));
    this.particles = this.particles.filter(p => !p.dead);
    this.ripples.forEach(r => r.update(dt));
    this.ripples = this.ripples.filter(r => !r.dead);

    this.updateCombo(dt);
    this.updateDangerWarnings();

    this.camera.x = clamp(this.player.x, this.width / 2, WORLD_W - this.width / 2);
    this.camera.y = clamp(this.player.y, this.height / 2, WORLD_H - this.height / 2);
    if (WORLD_W < this.width) this.camera.x = WORLD_W / 2;
    if (WORLD_H < this.height) this.camera.y = WORLD_H / 2;

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);

    this.updateHUD();
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
    document.getElementById('missionTimerValue').textContent = Math.ceil(this.timeRemaining);
    document.getElementById('missionScoreValue').textContent = this.player.score;

    const tiers = CONFIG.sizeTiers;
    const tierIdx = tiers.findIndex(t => t.id === this.lastSizeTierId);
    const tier = tiers[tierIdx];
    const next = tiers[tierIdx + 1];
    // T1's minRadius is 0, but a round always starts at BASE_RADIUS (22), so
    // using tier.minRadius as the fill floor made the bar open ~73% full
    // with no visible room left to show progress toward T2 (player report:
    // "nie widać ile brakuje do kolejnego poziomu"). Floor at BASE_RADIUS
    // instead so the bar always fills from empty at round start.
    const floor = Math.max(tier.minRadius, BASE_RADIUS);
    const tierPct = next
      ? clamp((this.player.radius - floor) / (next.minRadius - floor), 0, 1) * 100
      : 100;
    document.getElementById('missionTierBar').style.width = tierPct + '%';
    const badge = document.getElementById('missionTierBadge');
    badge.textContent = tier.shortId;
    badge.style.color = tier.color;
    badge.style.textShadow = `0 0 6px ${tier.color}`;
    badge.title = `${tier.label}${next ? ` · Postęp do ${next.shortId}` : ' · Poziom maksymalny'}`;

    const ranked = rankHoles([this.player, ...this.bots]);
    const place = ranked.indexOf(this.player) + 1;
    document.getElementById('rankValue').textContent = `#${place}/${ranked.length}`;

    const list = document.getElementById('leaderboardList');
    list.innerHTML = '';
    ranked.forEach((h, i) => {
      const li = document.createElement('li');
      if (h.isPlayer) li.classList.add('is-player');
      li.innerHTML = `<span class="lb-rank">#${i + 1}</span><span class="lb-name">${h.name}</span><span class="lb-size">${h.score} pkt</span>`;
      list.appendChild(li);
    });
  }

  /* ---------- rendering ---------- */

  drawGrid(ctx) {
    const startX = Math.floor((this.camera.x - this.width / 2) / GRID_SIZE) * GRID_SIZE;
    const endX = this.camera.x + this.width / 2;
    const startY = Math.floor((this.camera.y - this.height / 2) / GRID_SIZE) * GRID_SIZE;
    const endY = this.camera.y + this.height / 2;

    ctx.save();
    ctx.strokeStyle = 'rgba(80, 240, 250, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += GRID_SIZE) {
      ctx.moveTo(x, Math.max(0, this.camera.y - this.height / 2));
      ctx.lineTo(x, Math.min(WORLD_H, this.camera.y + this.height / 2));
    }
    for (let y = startY; y <= endY; y += GRID_SIZE) {
      ctx.moveTo(Math.max(0, this.camera.x - this.width / 2), y);
      ctx.lineTo(Math.min(WORLD_W, this.camera.x + this.width / 2), y);
    }
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 84, 173, 0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
    ctx.restore();
  }

  drawMinimap(ctx) {
    const size = 130;
    const margin = 16;
    const px = this.width - size - margin;
    const py = this.height - size - margin;
    const scale = size / WORLD_W;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeStyle = 'rgba(80, 240, 250,0.4)';
    ctx.lineWidth = 1;
    ctx.fillRect(px, py, size, size);
    ctx.strokeRect(px, py, size, size);

    // Every object type gets a dot, not just the biggest ones -- previously
    // the minimap only showed large (green) objects, which read as "the map
    // only tracks green things" (player feedback). Sizing matches
    // drawCampaignMinimap()'s own convention (node/pylon/landmark bigger
    // than the rest) now that Arena's TIERS keys are the same type names.
    for (const obj of this.objects) {
      const tierDef = TIERS[obj.tier];
      const big = obj.tier === 'node' || obj.tier === 'pylon' || obj.tier === 'landmark';
      const dotSize = big ? 3 : 1.6;
      ctx.fillStyle = tierDef.color;
      ctx.fillRect(px + obj.x * scale - dotSize / 2, py + obj.y * scale - dotSize / 2, dotSize, dotSize);
    }
    for (const bot of this.bots) {
      ctx.fillStyle = bot.edgeColor;
      ctx.beginPath();
      ctx.arc(px + bot.x * scale, py + bot.y * scale, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#50F0FA';
    ctx.beginPath();
    ctx.arc(px + this.player.x * scale, py + this.player.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(
      px + (this.camera.x - this.width / 2) * scale,
      py + (this.camera.y - this.height / 2) * scale,
      this.width * scale,
      this.height * scale
    );
    ctx.restore();
  }

  /** Edge arrows pointing at nearby larger rivals that are currently
   *  off-screen — contextual danger readability (GDD 5.3/5.4), kept to
   *  the single nearest threat to avoid visual noise. */
  drawDangerIndicators(ctx) {
    const detectionRange = 700;
    const margin = 34;
    let nearest = null, nearestDist = Infinity;

    for (const bot of this.bots) {
      if (bot.radius <= this.player.radius * EAT_HOLE_RATIO) continue;
      const d = dist(this.player.x, this.player.y, bot.x, bot.y);
      if (d > detectionRange || d >= nearestDist) continue;

      const screenX = bot.x - this.camera.x + this.width / 2;
      const screenY = bot.y - this.camera.y + this.height / 2;
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

  render(time) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.width, this.height);

    let shakeX = 0, shakeY = 0;
    if (this.shake > 0) {
      shakeX = rand(-this.shake, this.shake);
      shakeY = rand(-this.shake, this.shake);
    }

    ctx.save();
    ctx.translate(this.width / 2 - this.camera.x + shakeX, this.height / 2 - this.camera.y + shakeY);

    this.drawGrid(ctx);
    for (const obj of this.objects) obj.draw(ctx, this.canEatHighlight(obj));
    this.drawDangerHalos(ctx);
    this.drawScannerTarget(ctx);
    this.drawBountyMarker(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const r of this.ripples) r.draw(ctx);

    const holes = [...this.bots, this.player];
    holes.sort((a, b) => a.radius - b.radius);
    for (const h of holes) h.draw(ctx, time);

    this.drawComboText(ctx);

    ctx.restore();

    if (this.showMinimap) this.drawMinimap(ctx);
    this.drawDangerIndicators(ctx);

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

  /** Crown marker over the Bounty Core mutation's marked rival (GDD 4.1). */
  drawBountyMarker(ctx) {
    if (!this.bountyTarget) return;
    const b = this.bountyTarget;
    ctx.save();
    ctx.translate(b.x, b.y - b.radius - 18);
    ctx.fillStyle = '#EFCB63';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#EFCB63';
    ctx.font = 'bold 16px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('👑', 0, 0);
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

  /** 0..1 "close to threshold" highlight strength for the can-eat breathing
   *  rim; 0 for objects far from the boundary (avoids visual noise on
   *  trivially-eatable tiny objects). */
  canEatHighlight(obj) {
    if (obj.radius >= this.player.radius) return 0;
    if (!canEatWorldObjectTier(this.player.radius, obj)) return 0;
    const ratio = (this.player.radius * EAT_OBJ_RATIO) / obj.radius;
    const { canEatHighlightBandLow: lo, canEatHighlightBandHigh: hi } = CONFIG.juice;
    if (ratio < lo || ratio > hi) return 0;
    const mid = (lo + hi) / 2;
    return 1 - clamp(Math.abs(ratio - mid) / (mid - lo), 0, 1);
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

  /** Floating "xN COMBO" text above the player, fading smoothly instead of
   *  cutting abruptly when the combo window lapses (GDD 5.4). */
  drawComboText(ctx) {
    if (this.comboCount < 2 || this.comboDisplayAlpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.comboDisplayAlpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#EFCB63';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#EFCB63';
    ctx.font = 'bold 18px Segoe UI, sans-serif';
    ctx.fillText(`x${this.comboMultiplier.toFixed(1)} COMBO (${this.comboCount})`, this.player.x, this.player.y - this.player.radius - 28);
    ctx.restore();
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
      if (this.evolutionPending || this.introPending) {
        if (this.mode === 'campaign') this.renderCampaign(now / 1000); else this.render(now / 1000);
      } else if (this.mode === 'campaign') {
        this.updateCampaign(rawDt);
        this.renderCampaign(now / 1000);
      } else {
        this.update(rawDt);
        this.render(now / 1000);
      }
      this.rafId = requestAnimationFrame((t) => this.loop(t));
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
