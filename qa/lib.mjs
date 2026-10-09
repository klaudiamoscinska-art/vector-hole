// Shared helpers for the Vector Hole QA bots (dev-only, not shipped by the
// game -- the runtime is still exactly index.html/style.css/game.js).
// Uses the Playwright install already on the machine (no package.json):
//   node qa/run-all.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
function loadPlaywright() {
  const tries = ['playwright', '/opt/node22/lib/node_modules/playwright'];
  for (const t of tries) { try { return require(t); } catch (e) { /* next */ } }
  throw new Error('Playwright not found: install it globally (npm i -g playwright).');
}
export const { chromium } = loadPlaywright();

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(ROOT, 'qa', 'out');
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

/** Static server over the repo root on a random port. */
export function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(ROOT, url === '/' ? 'index.html' : url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/index.html` }));
  });
}

/** Launch Chromium + a page that records console errors and page errors.
 *  External requests (Google Fonts etc.) are blocked so runs are offline
 *  and deterministic; `allowExternal` lets the network test opt back in. */
export async function openGame(baseUrl, { save = null, viewport = { width: 420, height: 860 }, mobile = true, query = '', allowExternal = false, initScript = null, deviceScaleFactor = 2 } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor });
  const errors = [];
  const external = [];
  if (!allowExternal) {
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => { external.push(route.request().url()); route.abort(); });
  }
  if (save) {
    await context.addInitScript((s) => {
      if (!sessionStorage.getItem('__qaSeeded')) {
        localStorage.setItem('vectorHoleSave_v1', typeof s === 'string' ? s : JSON.stringify(s));
        sessionStorage.setItem('__qaSeeded', '1');
      }
    }, save);
  }
  if (initScript) await context.addInitScript(initScript);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(baseUrl + query);
  await page.waitForFunction(() => window.game && window.game.state !== undefined, null, { timeout: 15000 });
  return { browser, context, page, errors, external };
}

/** A save that has finished the tutorial and the first districts' worth of
 *  missions, so every hub feature (Arena, Warsztat, Wyzwania) is unlocked. */
export async function veteranSave(page, overrides = {}) {
  return page.evaluate((o) => {
    const s = defaultSave();
    const ids = CAMPAIGN_MISSIONS.slice(0, o.missions || 6).map(m => m.id);
    ids.forEach(id => { s.campaign.completed[id] = true; });
    s.campaign.discoveredTypes = Object.keys(TIERS).filter(k => k !== 'portal' && k !== 'golden');
    s.campaign.discoveredHoleEating = true;
    s.unlocks.announced = unlockedFeatureIds(s);
    s.login.lastClaimDate = new Date().toISOString().slice(0, 10);
    s.stats.runsPlayed = o.runsPlayed || 0;
    s.coins = o.coins || 0;
    // QA saves are pre-consented so the consent sheet doesn't block flows.
    s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
    return s;
  }, overrides);
}

export function report(name, ok, details) {
  const line = `${ok ? 'PASS' : 'FAIL'}  ${name}${details ? '  — ' + details : ''}`;
  console.log(line);
  return { name, ok, details };
}

/** In-page greedy bot for Arena: flees bigger rivals, hunts smaller ones,
 *  otherwise heads for the best-value eatable object. Drives game.update()
 *  in virtual time (the RAF loop is stopped) so a 2-minute round runs in
 *  well under a second of wall time. Returns the round summary. */
export const ARENA_BOT = `
window.__qaPlayArena = function (opts) {
  opts = opts || {};
  const g = window.game;
  const dt = opts.dt || 1 / 30;
  const style = opts.style || 'greedy';
  // Virtual clock: wall-time timers (invulnerability, run tools, hit-stop)
  // advance with the simulated frames, not with real time.
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  let vnow = realNow();
  performance.now = () => vnow;
  if (opts.gfx != null) g.applyGfx(opts.gfx);
  g.startRound(opts.round || {});
  if (g.rafId) cancelAnimationFrame(g.rafId);
  g.running = false; // detach the RAF loop; we tick manually
  const p = g.player;
  let frames = 0, maxUpdateMs = 0, totalUpdateMs = 0, renderMs = 0, renders = 0, deaths = 0, lastR = p.radius;
  // v13 first-seconds metrics: when the first pickup lands and how many
  // land in the first 10 s (score increments ~ eats).
  let firstEatSec = null, eats10 = 0, lastScore = 0;
  let wanderA = Math.random() * 6.28;
  const steer = () => {
    if (style === 'afk') { g.keyDir = { x: 0, y: 0 }; g.pointerWorld = { x: p.x, y: p.y }; return; }
    if (style === 'random') { wanderA += (Math.random() - 0.5) * 0.6; g.keyDir = { x: Math.cos(wanderA), y: Math.sin(wanderA) }; return; }
    if (style === 'casual') {
      // v13 "casual human": only sees what is on screen, re-aims every
      // ~0.4 s (reaction time), goes for the NEAREST thing it can eat (not
      // the best value), notices a bigger rival only when it's close.
      if (frames % 12 !== 0) return;
      const vw = g.width / g.zoom / 2, vh = g.height / g.zoom / 2;
      const onScreen = (x, y) => Math.abs(x - p.x) < vw && Math.abs(y - p.y) < vh
        && Math.hypot(x - clamp(x, p.radius, WORLD_W - p.radius), y - clamp(y, p.radius, WORLD_H - p.radius)) < p.radius * 0.8;
      for (const b of g.bots) {
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (b.radius > p.radius * 1.15 && d < 150 + b.radius && Math.random() < 0.7) { g.keyDir = { x: (p.x - b.x) / (d + 1), y: (p.y - b.y) / (d + 1) }; return; }
      }
      let best = null, bd = Infinity;
      for (const b of g.bots) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (onScreen(b.x, b.y) && p.radius > b.radius * 1.3 && !b.invulnerable && d < bd) { bd = d; best = b; } }
      if (!best) for (const o of g.objects) {
        if (o.eating || !g.holeCanEat(p, o) || !onScreen(o.x, o.y)) continue;
        const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; }
      }
      if (best) { const m = Math.hypot(best.x - p.x, best.y - p.y) || 1; g.keyDir = { x: (best.x - p.x) / m, y: (best.y - p.y) / m }; }
      else { wanderA += (Math.random() - 0.5) * 1.2; g.keyDir = { x: Math.cos(wanderA), y: Math.sin(wanderA) }; }
      return;
    }
    let fx = 0, fy = 0;
    for (const b of g.bots) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (b.radius > p.radius * 1.12 && d < 260 + b.radius) { fx -= (b.x - p.x) / (d + 1) * 3; fy -= (b.y - p.y) / (d + 1) * 3; }
    }
    if (fx || fy) { const m = Math.hypot(fx, fy); g.keyDir = { x: fx / m, y: fy / m }; return; }
    let best = null, bestScore = -1;
    // Like a human, skip targets the hole can't physically reach: its center
    // is clamped radius-from-the-wall, so a small rival (or a shockwave-
    // pushed object) tucked into a wall/corner may sit outside its eat reach.
    const reachable = (x, y, reach) => Math.hypot(x - clamp(x, p.radius, WORLD_W - p.radius), y - clamp(y, p.radius, WORLD_H - p.radius)) < reach;
    for (const b of g.bots) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (!reachable(b.x, b.y, p.radius * 0.7)) continue;
      if (p.radius > b.radius * 1.2 && !b.invulnerable && d < 500) { const s = 40 / (d + 30); if (s > bestScore) { bestScore = s; best = b; } }
    }
    for (const o of g.objects) {
      if (o.consumed || o.removed || o.eating || !g.holeCanEat(p, o)) continue;
      if (!reachable(o.x, o.y, p.radius * 0.8)) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      const s = (o.value + 2) / (d + 40);
      if (s > bestScore) { bestScore = s; best = o; }
    }
    if (best) { const m = Math.hypot(best.x - p.x, best.y - p.y) || 1; g.keyDir = { x: (best.x - p.x) / m, y: (best.y - p.y) / m }; }
    else { wanderA += 0.05; g.keyDir = { x: Math.cos(wanderA), y: Math.sin(wanderA) }; }
  };
  while (g.state === GameState.PLAYING && frames < 60 * 60 * 10) {
    if (g.evolutionPending) {
      const card = document.querySelector('#evolutionCards .evolution-card, #evolutionCards button');
      if (card && opts.pickCards !== false) card.click(); else g.skipEvolutionOffer();
      continue;
    }
    steer();
    vnow += dt * 1000;
    const t0 = realNow();
    g.update(dt);
    const t1 = realNow();
    totalUpdateMs += t1 - t0; maxUpdateMs = Math.max(maxUpdateMs, t1 - t0);
    if (p.radius < lastR - 4) deaths++;
    if (p.score > lastScore) { if (firstEatSec === null) firstEatSec = +(frames * dt).toFixed(2); if (frames * dt <= 10) eats10++; lastScore = p.score; }
    lastR = p.radius;
    if (frames % 15 === 0 && g.state === GameState.PLAYING) {
      const r0 = realNow(); g.render(frames * dt); renderMs += realNow() - r0; renders++;
    }
    frames++;
  }
  g.keyDir = { x: 0, y: 0 };
  performance.now = realNow;
  if (opts.gfx != null) g.applyGfx(2);
  const ranked = rankHoles([g.player, ...g.bots]);
  return {
    place: ranked.indexOf(g.player) + 1, score: g.player.score, firstEatSec, eats10,
    gapToSecond: ranked[0] === g.player ? g.player.score - ranked[1].score : ranked[0].score - g.player.score, radius: Math.round(g.player.radius),
    tier: CONFIG.sizeTiers[getSizeTierIndex(g.player.radius)].shortId,
    coins: g.save.coins, prisms: g.save.prisms, coinsEarned: g.adPendingCoins, frames, deaths,
    avgUpdateMs: +(totalUpdateMs / frames).toFixed(3), maxUpdateMs: +maxUpdateMs.toFixed(2),
    avgRenderMs: +(renderMs / Math.max(1, renders)).toFixed(2),
    difficulty: +g.difficultyT.toFixed(2), runs: g.save.stats.runsPlayed, state: g.state,
    level: g.save.player.level, coreLevel: g.save.hub.coreLevel
  };
};
`;

/** Partial-round driver for screenshots/visual checks (v12): advances the
 *  current Arena round `frames` frames in virtual time with a simple greedy
 *  steer, then renders one frame. __qaSwallowScene() stages a mid-swallow
 *  moment (objects + a smaller rival tipping into the player's vortex). */
export const QA_TICK = `
window.__qaTick = function (frames, renderEvery) {
  const g = window.game, p = g.player, dt = 1 / 30;
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  window.__vnow = Math.max(window.__vnow || 0, realNow());
  performance.now = () => window.__vnow;
  for (let f = 0; f < frames && g.state === GameState.PLAYING; f++) {
    if (g.evolutionPending) { g.skipEvolutionOffer(); continue; }
    let best = null, bs = -1;
    for (const o of g.objects) { if (o.eating || !g.holeCanEat(p, o)) continue; const d = Math.hypot(o.x - p.x, o.y - p.y); const s = (o.value + 2) / (d + 40); if (s > bs) { bs = s; best = o; } }
    if (best) { const m = Math.hypot(best.x - p.x, best.y - p.y) || 1; g.keyDir = { x: (best.x - p.x) / m, y: (best.y - p.y) / m }; }
    window.__vnow += dt * 1000;
    g.update(dt);
    // renderEvery: also draw every Nth frame, so render caches (city-floor
    // chunks, sprites) stay as warm as in real play.
    if (renderEvery && f % renderEvery === 0 && g.state === GameState.PLAYING) g.render(window.__vnow / 1000);
  }
  g.keyDir = { x: 0, y: 0 };
  g.render(window.__vnow / 1000);
  performance.now = realNow;
  return { radius: Math.round(p.radius), zoom: +g.zoom.toFixed(2), state: g.state };
};
window.__qaSwallowScene = function () {
  const g = window.game, dt = 1 / 60;
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  window.__vnow = Math.max(window.__vnow || 0, realNow());
  performance.now = () => window.__vnow;
  g.checkEvolutionTriggers = () => {};
  g.startRound({ seed: 99 }); cancelAnimationFrame(g.rafId); g.running = false;
  const p = g.player;
  g.banner = null; g.bannerQueue = [];
  p.radius = 70; g.zoom = 1;
  for (let k = 0; k < 4; k++) { window.__vnow += dt * 1000; g.update(dt); }
  g.banner = null; g.bannerQueue = [];
  g.objects.filter(o => !o.eating && g.holeCanEat(p, o)).slice(0, 5).forEach((o, i) => { const a = i * 1.25; o.x = p.x + Math.cos(a) * p.radius * 0.8; o.y = p.y + Math.sin(a) * p.radius * 0.8; });
  const b = g.bots[0]; b.radius = 30; b.invulnerableUntil = 0; b.x = p.x + 40; b.y = p.y - 10;
  for (let f = 0; f < 8; f++) { window.__vnow += dt * 1000; g.update(dt); }
  g.banner = null;
  g.render(window.__vnow / 1000);
  performance.now = realNow;
  delete g.checkEvolutionTriggers;
  return { eating: g.objects.filter(o => o.eating && o.eater === p).length, ghosts: g.swallowGhosts.length };
};
`;
