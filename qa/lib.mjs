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
export async function openGame(baseUrl, { save = null, viewport = { width: 420, height: 860 }, mobile = true, query = '', allowExternal = false, initScript = null } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 });
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
  let wanderA = Math.random() * 6.28;
  const steer = () => {
    if (style === 'afk') { g.keyDir = { x: 0, y: 0 }; g.pointerWorld = { x: p.x, y: p.y }; return; }
    if (style === 'random') { wanderA += (Math.random() - 0.5) * 0.6; g.keyDir = { x: Math.cos(wanderA), y: Math.sin(wanderA) }; return; }
    let fx = 0, fy = 0;
    for (const b of g.bots) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (b.radius > p.radius * 1.12 && d < 260 + b.radius) { fx -= (b.x - p.x) / (d + 1) * 3; fy -= (b.y - p.y) / (d + 1) * 3; }
    }
    if (fx || fy) { const m = Math.hypot(fx, fy); g.keyDir = { x: fx / m, y: fy / m }; return; }
    let best = null, bestScore = -1;
    for (const b of g.bots) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (p.radius > b.radius * 1.2 && !b.invulnerable && d < 500) { const s = 40 / (d + 30); if (s > bestScore) { bestScore = s; best = b; } }
    }
    for (const o of g.objects) {
      if (o.consumed || o.removed || !g.holeCanEat(p, o)) continue;
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
    place: ranked.indexOf(g.player) + 1, score: g.player.score, radius: Math.round(g.player.radius),
    tier: CONFIG.sizeTiers[getSizeTierIndex(g.player.radius)].shortId,
    coins: g.save.coins, prisms: g.save.prisms, coinsEarned: g.adPendingCoins, frames, deaths,
    avgUpdateMs: +(totalUpdateMs / frames).toFixed(3), maxUpdateMs: +maxUpdateMs.toFixed(2),
    avgRenderMs: +(renderMs / Math.max(1, renders)).toFixed(2),
    difficulty: +g.difficultyT.toFixed(2), runs: g.save.stats.runsPlayed, state: g.state,
    level: g.save.player.level, coreLevel: g.save.hub.coreLevel
  };
};
`;
