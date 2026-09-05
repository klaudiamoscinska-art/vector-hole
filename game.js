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
  version: '2.0.0-p0',
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
  // Size tiers used for analytics (`size_tier` events) and future evolution
  // visuals (GDD P2). Not yet shown in the HUD or tied to any visual change.
  sizeTiers: [
    { id: 'spark', minRadius: 0 },
    { id: 'pulse', minRadius: 30 },
    { id: 'core', minRadius: 45 },
    { id: 'vortex', minRadius: 65 },
    { id: 'singularity', minRadius: 90 }
  ],
  // Feature flags for systems introduced in later Golden Shot V2 phases.
  // Everything defaults to the current (pre-V2) behavior.
  flags: {
    inputThumbPad: true,        // Phase 2: Floating Thumb Pad control (global kill-switch; false forces legacy)
    evolutionSystem: false,     // Phase 4: evolution cards + Overdrive
    proceduralDistricts: false, // Phase 5: seeded chunk generator
    hub: false,                 // Phase 6: Neon Core Hub
    shopV2: false,              // Phase 7: shop categories/loadout
    dailyChallenge: false,      // Phase 9: daily seed challenge
    monetizationAdapters: false,// Phase 11: real ad/IAP SDK adapters
    analyticsConsoleLog: true   // Phase 1: log analytics events to console
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

const TIERS = {
  small: { color: '#00f3ff', minR: 6, maxR: 9, value: 1, subtypes: ['tree', 'lamp'], count: 90 },
  medium: { color: '#ff007f', minR: 14, maxR: 20, value: 5, subtypes: ['car', 'house'], count: 45 },
  large: { color: '#39ff14', minR: 28, maxR: 42, value: 20, subtypes: ['skyscraper'], count: 16 }
};

const BOT_NAME_POOL = [
  'NeonGhost', 'PixelWolf', 'ByteViper', 'CyberFox', 'GlitchKing', 'VoidRunner',
  'ChromaCat', 'LagMonster', 'NightHawk', 'ToxicSlime', 'RetroWave', 'GridRunner',
  'SynthWolf', 'ZeroPulse', 'HexShadow'
];

const BOT_COLORS = ['#ff007f', '#39ff14', '#ffae00', '#b026ff', '#00f3ff', '#ff3860'];

const SKINS = [
  { id: 'rainbow', name: 'Tęcza', price: 0, rainbow: true },
  { id: 'cyan', name: 'Cyber Cyan', price: 50, color: '#00f3ff' },
  { id: 'pink', name: 'Hot Pink', price: 50, color: '#ff007f' },
  { id: 'green', name: 'Toxic Green', price: 75, color: '#39ff14' },
  { id: 'purple', name: 'Ultra Violet', price: 100, color: '#b026ff' },
  { id: 'gold', name: 'Neon Gold', price: 150, color: '#ffd700' },
  { id: 'white', name: 'Plasma White', price: 200, color: '#ffffff' }
];

const SAVE_KEY = 'vectorHoleSave_v1'; // storage key kept stable; schema is versioned inside the payload
const SAVE_SCHEMA_VERSION = 3;

/* ----------------------- Utilities ----------------------- */

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function pickUnique(arr, n) {
  const pool = arr.slice();
  const out = [];
  for (let i = 0; i < n && pool.length; i++) {
    out.push(pool.splice(randInt(0, pool.length - 1), 1)[0]);
  }
  return out;
}

function defaultSave() {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    coins: 0,
    prisms: 0,
    owned: ['rainbow'],
    selected: 'rainbow',
    guestId: generateId('guest'),
    settings: { inputMode: 'thumbpad', sensitivity: 1, haptics: true, minimap: 'auto' },
    stats: { runsPlayed: 0 }
  };
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
  constructor(tierName) {
    this.respawn(tierName, true);
  }

  respawn(tierName, first) {
    const tier = TIERS[tierName];
    this.tier = tierName;
    this.color = tier.color;
    this.value = tier.value;
    this.subtype = tier.subtypes[randInt(0, tier.subtypes.length - 1)];
    this.radius = rand(tier.minR, tier.maxR);
    this.rotation = rand(0, Math.PI * 2);
    this.x = rand(this.radius + 20, WORLD_W - this.radius - 20);
    this.y = rand(this.radius + 20, WORLD_H - this.radius - 20);
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
      case 'tree':
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
        ctx.stroke();
        break;

      case 'lamp':
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          ctx.stroke();
        }
        break;

      case 'car':
        ctx.strokeRect(-r, -r * 0.55, r * 2, r * 1.1);
        ctx.beginPath();
        ctx.moveTo(-r * 0.3, -r * 0.55);
        ctx.lineTo(-r * 0.3, r * 0.55);
        ctx.moveTo(r * 0.3, -r * 0.55);
        ctx.lineTo(r * 0.3, r * 0.55);
        ctx.stroke();
        break;

      case 'house':
        ctx.strokeRect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
        ctx.beginPath();
        ctx.moveTo(-r * 0.75, -r * 0.75);
        ctx.lineTo(r * 0.75, r * 0.75);
        ctx.stroke();
        break;

      case 'skyscraper': {
        ctx.strokeRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
        ctx.strokeRect(-r * 0.5, -r * 0.5, r, r);
        const grid = 3;
        for (let i = 1; i < grid; i++) {
          const off = -r * 0.8 + (i / grid) * r * 1.6;
          ctx.beginPath();
          ctx.moveTo(off, -r * 0.8);
          ctx.lineTo(off, r * 0.8);
          ctx.moveTo(-r * 0.8, off);
          ctx.lineTo(r * 0.8, off);
          ctx.stroke();
        }
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
    return clamp(s, 45, BASE_SPEED);
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

  shrinkAndRespawn() {
    this.radius = BASE_RADIUS;
    this.x = rand(this.radius + 20, WORLD_W - this.radius - 20);
    this.y = rand(this.radius + 20, WORLD_H - this.radius - 20);
    this.invulnerableUntil = performance.now() + INVULN_TIME * 1000;
  }

  draw(ctx, time) {
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
    ctx.shadowColor = this.isPlayer ? '#00f3ff' : '#ff007f';
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
      if (o.eating || o.radius >= this.radius * EAT_OBJ_RATIO) continue;
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
    this.dangerWarned = new Set();
    this.adUsedThisRound = false;

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

    this.state = GameState.MENU;
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
    // Minimap is only genuinely useful on wider viewports; on small phones
    // it's too cramped to read (GDD 5.3), so hide it by default there unless
    // the player explicitly turned it on/off in settings.
    const pref = this.save ? this.save.settings.minimap : 'auto';
    this.showMinimap = pref === 'on' || (pref === 'auto' && this.width >= CONFIG.input.minimapAutoHideWidth);
  }

  /** True while the Floating Thumb Pad should handle touch (feature flag is
   *  the global kill switch; the player's own setting picks the mode). */
  get useThumbpad() {
    return CONFIG.flags.inputThumbPad && this.save.settings.inputMode === 'thumbpad';
  }

  bindInput() {
    this.isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
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
    document.getElementById('btnStart').addEventListener('click', () => this.startRound());
    document.getElementById('btnShop').addEventListener('click', () => {
      this.analytics.track('shop_view', {});
      this.showScreen('shopScreen');
    });
    document.getElementById('btnShopBack').addEventListener('click', () => this.showScreen('mainMenu'));
    document.getElementById('btnPlayAgain').addEventListener('click', () => {
      this.analytics.track('result_action', { action: 'play_again' });
      this.requestPlayAgain();
    });
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

    // ---- Rank badge: tap to expand/collapse full standings ----
    document.getElementById('hud-rankBadge').addEventListener('click', () => {
      document.getElementById('hud-topright').classList.toggle('hidden');
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

  populateShop() {
    const grid = document.getElementById('skinGrid');
    grid.innerHTML = '';
    SKINS.forEach(skin => {
      const owned = this.save.owned.includes(skin.id);
      const selected = this.save.selected === skin.id;
      const card = document.createElement('div');
      card.className = 'skin-card' + (selected ? ' selected' : '') + (!owned ? ' locked' : '');

      const swatch = document.createElement('div');
      swatch.className = 'skin-swatch';
      if (skin.rainbow) {
        swatch.style.borderColor = '#fff';
        swatch.style.backgroundImage = 'conic-gradient(red, orange, yellow, lime, cyan, blue, violet, red)';
      } else {
        swatch.style.borderColor = skin.color;
        swatch.style.boxShadow = `0 0 10px ${skin.color}`;
      }
      card.appendChild(swatch);

      const name = document.createElement('div');
      name.className = 'skin-name';
      name.textContent = skin.name;
      card.appendChild(name);

      const meta = document.createElement('div');
      meta.className = owned ? 'skin-owned-badge' : 'skin-price';
      meta.textContent = owned ? (selected ? 'WYBRANY' : 'POSIADANE') : `◈ ${skin.price}`;
      card.appendChild(meta);

      card.addEventListener('click', () => this.onSkinClick(skin));
      grid.appendChild(card);
    });
  }

  onSkinClick(skin) {
    const owned = this.save.owned.includes(skin.id);
    if (owned) {
      this.save.selected = skin.id;
    } else if (this.save.coins >= skin.price) {
      this.save.coins -= skin.price;
      this.save.owned.push(skin.id);
      this.save.selected = skin.id;
      this.analytics.track('soft_purchase', { skinId: skin.id, price: skin.price, currency: 'coins' });
    } else {
      this.analytics.track('cosmetic_preview', { skinId: skin.id, price: skin.price, affordable: false });
      return;
    }
    saveGame(this.save);
    this.populateShop();
    this.updateCoinDisplays();
  }

  updateCoinDisplays() {
    document.getElementById('coinCountMenu').textContent = this.save.coins;
    document.getElementById('coinCountShop').textContent = this.save.coins;
  }

  showScreen(id) {
    ['mainMenu', 'shopScreen', 'gameOverScreen', 'adOverlay'].forEach(s => {
      document.getElementById(s).classList.toggle('hidden', s !== id);
    });
    document.getElementById('hud').classList.toggle('hidden', true);
    document.getElementById('pauseSheet').classList.add('hidden');
    document.getElementById('leaveConfirm').classList.add('hidden');
  }

  hideAllOverlays() {
    ['mainMenu', 'shopScreen', 'gameOverScreen', 'adOverlay', 'pauseSheet', 'leaveConfirm'].forEach(s => {
      document.getElementById(s).classList.add('hidden');
    });
  }

  /* ---------- world setup ---------- */

  randomWorldPos(padding) {
    return { x: rand(padding, WORLD_W - padding), y: rand(padding, WORLD_H - padding) };
  }

  createObjects() {
    this.objects = [];
    Object.keys(TIERS).forEach(tierName => {
      for (let i = 0; i < TIERS[tierName].count; i++) {
        this.objects.push(new WorldObject(tierName));
      }
    });
  }

  createEntities() {
    const spawn = this.randomWorldPos(300);
    this.player = new Hole('Ty', spawn.x, spawn.y, true);
    this.player.skin = this.save.selected;

    this.bots = [];
    const names = pickUnique(BOT_NAME_POOL, NUM_BOTS);
    for (let i = 0; i < NUM_BOTS; i++) {
      const p = this.randomWorldPos(300);
      this.bots.push(new Bot(names[i], p.x, p.y));
    }
  }

  /* ---------- round flow ---------- */

  startRound() {
    this.hideAllOverlays();
    document.getElementById('hud').classList.remove('hidden');
    this.state = GameState.MATCH_SETUP;
    this.paused = false;
    this.createObjects();
    this.createEntities();
    this.particles = [];
    this.ripples = [];
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.comboTimer = 0;
    this.comboDisplayAlpha = 0;
    this.dangerWarned = new Set();
    this.timeRemaining = ROUND_TIME;
    this.adUsedThisRound = false;
    this.runId = generateId('run');
    this.runSeed = generateSeed();
    this.rng = new SeededRNG(this.runSeed);
    this.runStartedAt = performance.now();
    this.firstEatTracked = false;
    this.lastSizeTierId = CONFIG.sizeTiers[0].id;
    this.running = true;
    this.state = GameState.PLAYING;

    const hint = document.getElementById('mobile-hint');
    hint.textContent = this.useThumbpad
      ? 'Dotknij dolną część ekranu, aby sterować kciukiem'
      : 'Dotknij i przeciągaj, aby sterować dziurą';
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
      playCount: this.playCount
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

    const ranked = [this.player, ...this.bots].slice().sort((a, b) => b.radius - a.radius);
    const place = ranked.indexOf(this.player) + 1;
    const coinsEarned = Math.floor(this.player.score / CONFIG.economy.coinsPerScorePoint) + CONFIG.economy.coinsBase;
    this.adPendingCoins = coinsEarned;
    this.save.coins += coinsEarned;
    this.save.stats.runsPlayed = (this.save.stats.runsPlayed || 0) + 1;
    saveGame(this.save);

    return { ranked, place, coinsEarned };
  }

  endRound() {
    this.state = GameState.RESULTS;
    const { ranked, place, coinsEarned } = this.finalizeRun();

    document.getElementById('finalPlace').textContent = '#' + place;
    document.getElementById('finalScore').textContent = this.player.score;
    document.getElementById('finalCoins').textContent = coinsEarned;

    const list = document.getElementById('finalLeaderboard');
    list.innerHTML = '';
    ranked.forEach((h, i) => {
      const li = document.createElement('li');
      if (h === this.player) li.classList.add('is-player');
      li.innerHTML = `<span>#${i + 1} ${h.name}</span><span>Rozmiar ${Math.round(h.radius)} • Wynik ${h.score}</span>`;
      list.appendChild(li);
    });

    document.getElementById('btnWatchAd').disabled = false;
    document.getElementById('btnWatchAd').textContent = '📺 OBEJRZYJ REKLAMĘ = x2 MONET';

    this.showScreen('gameOverScreen');
    this.updateCoinDisplays();

    this.analytics.track('run_end', {
      runId: this.runId,
      seed: this.runSeed,
      score: this.player.score,
      place,
      durationMs: Math.round(performance.now() - this.runStartedAt),
      coinsEarned,
      completed: true
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

  restartFromPause() {
    document.getElementById('pauseSheet').classList.add('hidden');
    this.startRound();
  }

  /** Casual mode has no forfeit penalty (that's reserved for future
   *  ranked/daily modes) — the player keeps coins earned for the score
   *  reached so far and returns straight to the menu, per GDD 5.2. */
  leaveRun() {
    document.getElementById('pauseSheet').classList.add('hidden');
    document.getElementById('leaveConfirm').classList.add('hidden');
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
    this.spawnParticles(x, y, color, particles);
    if (shakeAmt > 0) this.triggerShake(isPlayerInvolved ? shakeAmt : shakeAmt * 0.4);
    if (giant) this.ripples.push(new Ripple(x, y, color, eatenRadius * 0.6, eatenRadius * 3, 0.5));
  }

  /** Bumps the player's combo (consecutive eats within the combo window)
   *  and returns the current score multiplier. Fades out smoothly rather
   *  than cutting abruptly when the window lapses (see update()). */
  registerCombo() {
    this.comboCount++;
    this.comboTimer = CONFIG.juice.combo.windowSeconds;
    this.comboMultiplier = clamp(1 + (this.comboCount - 1) * CONFIG.juice.combo.stepBonus, 1, CONFIG.juice.combo.maxMultiplier);
    this.comboDisplayAlpha = 1;
    return this.comboMultiplier;
  }

  handleObjectEating(hole) {
    for (const obj of this.objects) {
      if (obj.eating) continue;
      if (obj.radius >= hole.radius * EAT_OBJ_RATIO) continue;
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
          a.growFromArea(Math.PI * b.radius * b.radius * GROW_K_HOLE);
          const multiplier = a.isPlayer ? this.registerCombo() : 1;
          a.score += Math.round(b.radius * 2 * multiplier);
          this.triggerEatFeedback(b.x, b.y, b.isPlayer ? '#00f3ff' : b.edgeColor, b.radius, a.isPlayer || b.isPlayer);
          if (a.isPlayer) {
            this.analytics.track('rival_eaten', { rival: b.name, rivalSize: Math.round(b.radius) });
            this.vibrate(40);
          } else if (b.isPlayer) {
            this.analytics.track('player_eaten', { by: a.name, playerSize: Math.round(b.radius) });
            this.vibrate([30, 40, 30]);
          }
          b.shrinkAndRespawn();
        }
      }
    }
  }

  /** Fires a `size_tier` analytics event the first time the player's radius
   *  crosses into a new tier this run. Tiers are analytics-only for now
   *  (Phase 4 will attach visuals/evolution offers to the same thresholds). */
  checkSizeTier() {
    const tiers = CONFIG.sizeTiers;
    let current = tiers[0];
    for (const tier of tiers) {
      if (this.player.radius >= tier.minRadius) current = tier;
    }
    if (current.id !== this.lastSizeTierId) {
      this.lastSizeTierId = current.id;
      this.analytics.track('size_tier', { tier: current.id, radius: Math.round(this.player.radius) });
      // Growth-tier transition pulse: purely cosmetic today (green = positive
      // per the GDD 5.4 color hierarchy); Phase 4 attaches real evolution
      // offers to these same thresholds.
      this.ripples.push(new Ripple(this.player.x, this.player.y, '#39ff14', this.player.radius, this.player.radius * 2.5, 0.5));
      this.spawnParticles(this.player.x, this.player.y, '#39ff14', 20);
      this.vibrate(60);
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

  updateHUD() {
    document.getElementById('timerValue').textContent = Math.ceil(this.timeRemaining);
    const timerWarning = this.timeRemaining <= 15;
    document.getElementById('timerValue').classList.toggle('warning', this.timeRemaining <= 10);
    document.getElementById('timerRing').classList.toggle('warning', timerWarning);
    const ringCircumference = 169.6; // 2 * PI * r(27), matches the SVG circle in index.html
    const timeFraction = clamp(this.timeRemaining / ROUND_TIME, 0, 1);
    document.getElementById('timerRing').style.strokeDashoffset = String(ringCircumference * (1 - timeFraction));

    document.getElementById('sizeValue').textContent = Math.round(this.player.radius);
    document.getElementById('scoreValue').textContent = this.player.score;

    const tiers = CONFIG.sizeTiers;
    const tierIdx = tiers.findIndex(t => t.id === this.lastSizeTierId);
    const current = tiers[tierIdx];
    const next = tiers[tierIdx + 1];
    const tierPct = next
      ? clamp((this.player.radius - current.minRadius) / (next.minRadius - current.minRadius), 0, 1) * 100
      : 100;
    document.getElementById('tierProgressBar').style.width = tierPct + '%';

    const ranked = [this.player, ...this.bots].slice().sort((a, b) => b.radius - a.radius);
    const place = ranked.indexOf(this.player) + 1;
    document.getElementById('rankValue').textContent = `#${place}/${ranked.length}`;

    const list = document.getElementById('leaderboardList');
    list.innerHTML = '';
    ranked.forEach((h, i) => {
      const li = document.createElement('li');
      if (h.isPlayer) li.classList.add('is-player');
      li.innerHTML = `<span class="lb-rank">#${i + 1}</span><span class="lb-name">${h.name}</span><span class="lb-size">${Math.round(h.radius)}</span>`;
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
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.08)';
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
    ctx.strokeStyle = 'rgba(255, 0, 127, 0.5)';
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
    ctx.strokeStyle = 'rgba(0,243,255,0.4)';
    ctx.lineWidth = 1;
    ctx.fillRect(px, py, size, size);
    ctx.strokeRect(px, py, size, size);

    for (const obj of this.objects) {
      if (obj.tier !== 'large') continue;
      ctx.fillStyle = 'rgba(57,255,20,0.7)';
      ctx.fillRect(px + obj.x * scale, py + obj.y * scale, 2, 2);
    }
    for (const bot of this.bots) {
      ctx.fillStyle = bot.edgeColor;
      ctx.beginPath();
      ctx.arc(px + bot.x * scale, py + bot.y * scale, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#00f3ff';
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
    ctx.fillStyle = '#ff007f';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff007f';
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
    for (const p of this.particles) p.draw(ctx);
    for (const r of this.ripples) r.draw(ctx);

    const holes = [...this.bots, this.player];
    holes.sort((a, b) => a.radius - b.radius);
    for (const h of holes) h.draw(ctx, time);

    this.drawComboText(ctx);

    ctx.restore();

    if (this.showMinimap) this.drawMinimap(ctx);
    this.drawDangerIndicators(ctx);
  }

  /** 0..1 "close to threshold" highlight strength for the can-eat breathing
   *  rim; 0 for objects far from the boundary (avoids visual noise on
   *  trivially-eatable tiny objects). */
  canEatHighlight(obj) {
    if (obj.radius >= this.player.radius) return 0;
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
    ctx.fillStyle = '#ffd700';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ffd700';
    ctx.font = 'bold 18px Segoe UI, sans-serif';
    ctx.fillText(`x${this.comboMultiplier.toFixed(1)} COMBO (${this.comboCount})`, this.player.x, this.player.y - this.player.radius - 28);
    ctx.restore();
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    if (this.running) {
      this.update(dt);
      this.render(now / 1000);
      this.rafId = requestAnimationFrame((t) => this.loop(t));
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
