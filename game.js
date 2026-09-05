'use strict';

/* =========================================================
   VECTOR HOLE: EAT THE NEON CITY
   Vanilla Canvas game — classes: Game, Hole, Bot, WorldObject, Particle
   ========================================================= */

/* ----------------------- Constants ----------------------- */

const WORLD_W = 3000;
const WORLD_H = 3000;
const ROUND_TIME = 120; // seconds
const GRID_SIZE = 100;
const NUM_BOTS = 5;

const BASE_RADIUS = 22;
const MIN_RADIUS = 14;
const BASE_SPEED = 150; // px/s

const EAT_OBJ_RATIO = 0.9;   // object must be smaller than hole.radius * this
const EAT_HOLE_RATIO = 1.15; // attacker must be bigger than defender.radius * this
const GROW_K_OBJ = 0.4;
const GROW_K_HOLE = 0.55;
const EAT_ANIM_TIME = 0.28;
const INVULN_TIME = 2.0;

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

const SAVE_KEY = 'vectorHoleSave_v1';

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

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.owned) && typeof data.coins === 'number') return data;
    }
  } catch (e) { /* ignore corrupted save */ }
  return { coins: 0, owned: ['rainbow'], selected: 'rainbow' };
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

  draw(ctx) {
    const scale = this.eating ? Math.max(0, 1 - this.eatT) : 1;
    if (scale <= 0) return;
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
    this.objects = [];
    this.bots = [];
    this.camera = { x: WORLD_W / 2, y: WORLD_H / 2 };
    this.running = false;
    this.lastTime = 0;
    this.shake = 0;
    this.adPendingCoins = 0;
    this.adUsedThisRound = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    this.bindUI();
    this.populateShop();
    this.updateCoinDisplays();
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
  }

  bindInput() {
    this.pointerWorld = { x: WORLD_W / 2, y: WORLD_H / 2 };
    const updateFromScreen = (sx, sy) => {
      this.pointerWorld = {
        x: this.camera.x + (sx - this.width / 2),
        y: this.camera.y + (sy - this.height / 2)
      };
    };
    window.addEventListener('mousemove', (e) => updateFromScreen(e.clientX, e.clientY));
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) updateFromScreen(t.clientX, t.clientY);
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) updateFromScreen(t.clientX, t.clientY);
    }, { passive: false });
  }

  bindUI() {
    document.getElementById('btnStart').addEventListener('click', () => this.startRound());
    document.getElementById('btnShop').addEventListener('click', () => this.showScreen('shopScreen'));
    document.getElementById('btnShopBack').addEventListener('click', () => this.showScreen('mainMenu'));
    document.getElementById('btnPlayAgain').addEventListener('click', () => this.requestPlayAgain());
    document.getElementById('btnMenu').addEventListener('click', () => {
      this.updateCoinDisplays();
      this.showScreen('mainMenu');
    });
    document.getElementById('btnWatchAd').addEventListener('click', () => this.watchRewardedAd());
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
    } else {
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
  }

  hideAllOverlays() {
    ['mainMenu', 'shopScreen', 'gameOverScreen', 'adOverlay'].forEach(s => {
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
    this.createObjects();
    this.createEntities();
    this.particles = [];
    this.timeRemaining = ROUND_TIME;
    this.adUsedThisRound = false;
    this.running = true;
    this.lastTime = performance.now();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  requestPlayAgain() {
    this.playCount++;
    if (this.playCount % 2 === 0) {
      this.showInterstitialAd(() => this.startRound());
    } else {
      this.startRound();
    }
  }

  showInterstitialAd(onDone) {
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
    const btn = document.getElementById('btnWatchAd');
    btn.disabled = true;
    this.showInterstitialAd(() => {
      this.save.coins += this.adPendingCoins;
      saveGame(this.save);
      document.getElementById('finalCoins').textContent = this.adPendingCoins * 2;
      btn.textContent = 'ODEBRANO x2 ✓';
      this.hideAllOverlays();
      document.getElementById('gameOverScreen').classList.remove('hidden');
      this.updateCoinDisplays();
    });
  }

  endRound() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    document.getElementById('hud').classList.add('hidden');

    const ranked = [this.player, ...this.bots].slice().sort((a, b) => b.radius - a.radius);
    const place = ranked.indexOf(this.player) + 1;
    const coinsEarned = Math.floor(this.player.score / 5) + 10;
    this.adPendingCoins = coinsEarned;
    this.save.coins += coinsEarned;
    saveGame(this.save);

    document.getElementById('finalPlace').textContent = '#' + place;
    document.getElementById('finalScore').textContent = this.player.score;
    document.getElementById('finalCoins').textContent = coinsEarned;

    const list = document.getElementById('finalLeaderboard');
    list.innerHTML = '';
    ranked.forEach((h, i) => {
      const li = document.createElement('li');
      if (h === this.player) li.classList.add('is-player');
      li.innerHTML = `<span>#${i + 1} ${h.name}</span><span>${Math.round(h.radius)} pkt: ${h.score}</span>`;
      list.appendChild(li);
    });

    document.getElementById('btnWatchAd').disabled = false;
    document.getElementById('btnWatchAd').textContent = '📺 OBEJRZYJ REKLAMĘ = x2 MONET';

    this.showScreen('gameOverScreen');
    this.updateCoinDisplays();
  }

  /* ---------- gameplay ---------- */

  spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y, color));
  }

  triggerShake(amount) {
    this.shake = Math.max(this.shake, amount);
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
          a.score += Math.round(b.radius * 2);
          this.spawnParticles(b.x, b.y, b.isPlayer ? '#00f3ff' : b.edgeColor, 26);
          this.triggerShake(b === this.player || a === this.player ? 10 : 4);
          b.shrinkAndRespawn();
        }
      }
    }
  }

  update(dt) {
    this.timeRemaining -= dt;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.endRound();
      return;
    }

    this.player.moveToward(this.pointerWorld.x, this.pointerWorld.y, dt);
    for (const bot of this.bots) bot.update(dt, this);

    for (const obj of this.objects) obj.update(dt);

    this.handleObjectEating(this.player);
    for (const bot of this.bots) this.handleObjectEating(bot);

    for (const obj of this.objects) {
      if (obj.consumed) {
        const hole = obj.eater;
        hole.growFromArea(Math.PI * obj.radius * obj.radius * GROW_K_OBJ);
        hole.score += obj.value;
        this.spawnParticles(obj.x, obj.y, obj.color, 14);
        obj.respawn(obj.tier, false);
      }
    }

    this.handleHoleCollisions();

    this.particles.forEach(p => p.update(dt));
    this.particles = this.particles.filter(p => !p.dead);

    this.camera.x = clamp(this.player.x, this.width / 2, WORLD_W - this.width / 2);
    this.camera.y = clamp(this.player.y, this.height / 2, WORLD_H - this.height / 2);
    if (WORLD_W < this.width) this.camera.x = WORLD_W / 2;
    if (WORLD_H < this.height) this.camera.y = WORLD_H / 2;

    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);

    this.updateHUD();
  }

  updateHUD() {
    document.getElementById('timerValue').textContent = Math.ceil(this.timeRemaining);
    document.getElementById('timerValue').classList.toggle('warning', this.timeRemaining <= 10);
    document.getElementById('sizeValue').textContent = Math.round(this.player.radius);
    document.getElementById('scoreValue').textContent = this.player.score;

    const ranked = [this.player, ...this.bots].slice().sort((a, b) => b.radius - a.radius);
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
    for (const obj of this.objects) obj.draw(ctx);
    for (const p of this.particles) p.draw(ctx);

    const holes = [...this.bots, this.player];
    holes.sort((a, b) => a.radius - b.radius);
    for (const h of holes) h.draw(ctx, time);

    ctx.restore();

    this.drawMinimap(ctx);
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
