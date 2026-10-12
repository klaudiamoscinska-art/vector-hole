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
export async function openGame(baseUrl, { save = null, viewport = { width: 420, height: 860 }, mobile = true, query = '', allowExternal = false, initScript = null, deviceScaleFactor = 2, locale = 'pl-PL' } = {}) {
  const browser = await chromium.launch();
  // v19: the game picks its language from the browser -- the suites assert
  // Polish copy, so they run as a Polish browser unless told otherwise.
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor, locale });
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
    // v14: completed in district (play) order, with every district whose
    // predecessor's boss is cleared unlocked -- a real save, not the
    // CAMPAIGN_MISSIONS array order (which left Plac done but Park locked).
    const ids = DISTRICTS.flatMap(d => d.missions).slice(0, o.missions || 6);
    ids.forEach(id => { s.campaign.completed[id] = true; });
    DISTRICTS.forEach((d, i) => { if (i > 0 && s.campaign.completed[DISTRICTS[i - 1].missions[DISTRICTS[i - 1].missions.length - 1]] && !s.campaign.unlockedDistricts.includes(d.id)) s.campaign.unlockedDistricts.push(d.id); });
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

/** v15 campaign bot (shared by campaign-bots, calibrate and difficulty).
 *  __qaPlayMission(id, opts): opts.style 'expert' (default; sees the whole
 *  board, re-aims every frame, flees bigger rivals early, steers around
 *  glitch zones) or 'casual' (sees only the screen -- or the light circle
 *  in a blackout --, re-aims every ~0.4 s, goes for the nearest goal-ish
 *  bite, follows the edge arrow when nothing is in view, notices a bigger
 *  rival / glitch zone only up close). opts.openLimit runs without a time
 *  limit (calibration); opts.boosters pre-picks mission boosters. */
export const CAMPAIGN_BOT = `
window.__qaPlayMission = function (id, opts) {
  opts = opts || {};
  const style = opts.style || 'expert';
  const g = window.game;
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  let vnow = realNow();
  performance.now = () => vnow;
  const def = campaignMissionById(id);
  const limit0 = def.timeLimit;
  if (opts.openLimit) def.timeLimit = 900;
  g.missionBoosters = opts.boosters || [];
  g.startCampaignMission(id);
  if (g.introPending) g.dismissTutorialIntro();
  if (g.rafId) cancelAnimationFrame(g.rafId);
  g.running = false;
  const dt = 1 / 30;
  const m = g.mission;
  let frames = 0, wander = Math.random() * 6.28;
  window.__qaLastPos = null; window.__qaRoam = 0;
  const B = CONFIG.campaign.bounds;
  const vw = (opts.viewW || 390) / 2, vh = (opts.viewH || 844) / 2;
  while (!m.ended && !m.finishing && frames < 30 * (opts.openLimit ? 900 : 420)) {
    if (g.evolutionPending) { const c = document.querySelector('#evolutionCards .evolution-card'); if (c) c.click(); else g.skipEvolutionOffer(); continue; }
    if (g.introPending) g.dismissTutorialIntro();
    if (g.revivePending) { g.declineRevive(); break; }
    const p = g.player;
    const casual = style === 'casual';
    if (!casual || frames % 12 === 0) {
      const tier = g.campaignTierIndex(g.campaignPlayerTier().id);
      const goalTypes = g.campaignGoalEntityTypes();
      if (frames % 15 === 0) g.__qaComboPending = g.campaignGoalItems().some(it => /combo/i.test(it.label) && it.progress < it.target);
      const comboPending = g.__qaComboPending;
      const dark = m.def.setup.dark;
      const vis = dark ? g.darkVision() * 0.9 : 0;
      const sees = (x, y) => dark ? Math.hypot(x - p.x, y - p.y) < vis
        : (!casual || (Math.abs(x - g.camera.x) < vw && Math.abs(y - g.camera.y) < vh));
      let fx = 0, fy = 0;
      for (const b of g.bots) {
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        const danger = (casual ? 70 : 170) + b.radius + (m.def.setup.fragile ? 60 : 0);
        if (b.radius > p.radius * 1.1 && d < danger && (!casual || Math.random() < 0.75)) { fx -= (b.x - p.x) / (d + 1); fy -= (b.y - p.y) / (d + 1); }
      }
      for (const z of (g.glitchZones || [])) {
        const d = Math.hypot(z.x - p.x, z.y - p.y);
        const margin = casual ? 25 : 70 + (m.def.setup.fragile ? 40 : 0);
        if (d < z.r + p.radius + margin) { const k = 1.5; fx -= (z.x - p.x) / (d + 1) * k; fy -= (z.y - p.y) / (d + 1) * k; }
      }
      let target = null, best = -1;
      const reachable = (x, y, reach) => Math.hypot(x - clamp(x, B.minX + p.radius, B.maxX - p.radius), y - clamp(y, B.minY + p.radius, B.maxY - p.radius)) < reach;
      if (!(fx || fy)) {
        for (const e of g.campaignEntities) {
          if (e.consumed || e.eating || !e.live) continue;
          if (!sees(e.x, e.y)) continue;
          // v20: impulse pads / portals are helpers, never goals -- the bot
          // doesn't aim for them (mission times are measured without them).
          if (e.type === 'gate') continue;
          const touch = e.type === 'node' && e.glyph === 'mostek' && !e.mostekPowered && tier >= e.stats.minTier;
          if (e.type === 'node' && e.glyph === 'mostek' && !touch) continue;
          if (!touch) {
            if ((e.type === 'node' || e.type === 'pylon') && !e.active) continue;
            if (e.type === 'landmark' && !e.unlocked) continue;
            if (tier < e.stats.minTier) continue;
          }
          // Skip food sitting inside a glitch zone.
          if ((g.glitchZones || []).some(z => Math.hypot(z.x - e.x, z.y - e.y) < z.r + p.radius * 0.5)) continue;
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          const small = comboPending && (e.type === 'fragment' || e.type === 'capsule');
          const s = casual
            ? (small ? 3 : goalTypes.has(e.type) ? 2 : 1) / (d + 60)
            : (small ? 40 : (goalTypes.has(e.type) ? 4 : 1) * ((e.stats && e.stats.growth) || 2)) / (d + 60);
          if (s > best) { best = s; target = e; }
        }
        for (const b of g.bots) {
          const d = Math.hypot(b.x - p.x, b.y - p.y);
          if (!sees(b.x, b.y)) continue;
          if (!reachable(b.x, b.y, Math.max(p.radius, b.radius) * 0.7)) continue;
          if (p.radius > b.radius * 1.2 && d < 700) { const s = (b.racer ? 10 : 6) / (d + 60); if (s > best) { best = s; target = b; } }
        }
        // Nothing worth it in view: follow the edge arrow (what a human sees).
        if (!target || (casual && !(target instanceof CampaignEntity && goalTypes.has(target.type)) && Math.random() < 0.3)) {
          const guides = g.campaignGuideTargets();
          let gd = Infinity;
          for (const e of guides) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < gd && (!target || d > 0)) { gd = d; if (!target || casual) target = e; } }
        }
      }
      if (fx || fy) { const n = Math.hypot(fx, fy); g.keyDir = { x: fx / n, y: fy / n }; }
      else if (target) {
        // A finger is not a vector: the casual player's aim wobbles ±12°.
        let ang = Math.atan2(target.y - p.y, target.x - p.x);
        if (casual) ang += (Math.random() - 0.5) * 0.42;
        g.keyDir = { x: Math.cos(ang), y: Math.sin(ang) };
      }
      else { wander += casual ? (Math.random() - 0.5) * 1.2 : 0.04; g.keyDir = { x: Math.cos(wander), y: Math.sin(wander) }; }
    }
    // Unstick like a human would: no real progress for 3 s -> roam a bit.
    if (frames % 90 === 0) { if (window.__qaLastPos && Math.hypot(p.x - window.__qaLastPos.x, p.y - window.__qaLastPos.y) < 40) window.__qaRoam = 30; window.__qaLastPos = { x: p.x, y: p.y }; }
    if (window.__qaRoam > 0) { window.__qaRoam--; wander += 0.08; g.keyDir = { x: Math.cos(wander), y: Math.sin(wander) }; }
    vnow += dt * 1000;
    g.updateCampaign(dt);
    if (opts.render && frames % 30 === 0 && !m.ended) g.renderCampaign(frames * dt);
    frames++;
  }
  // Success has a short celebration delay (beginMissionSuccess uses a
  // real setTimeout) -- commit it directly instead of waiting on it.
  const success = !!m.finishing && !m.ended && !m.failReason;
  if (success) g.endCampaignMission(true);
  else if (!m.ended) g.endCampaignMission(false);
  g.keyDir = { x: 0, y: 0 };
  performance.now = realNow;
  def.timeLimit = limit0;
  return { id, success: success && !!g.save.campaign.completed[id], elapsed: +m.elapsed.toFixed(1), limit: limit0, fail: success ? null : (m.failReason || 'time'), diff: def.diff, stars: success ? g.missionStarBits(m) : 0 };
};
`;

/** A save with every district open (campaign bots). */
export async function allDistrictsSave(page) {
  const save = await veteranSave(page, { missions: 0 });
  save.campaign.unlockedDistricts = DISTRICT_IDS_ALL;
  save.energy = { value: 5, lastTick: 0, infiniteUntil: 4e12, freeDailyDate: null };
  return save;
}
export const DISTRICT_IDS_ALL = ['plac', 'park', 'port', 'galeria', 'dachy', 'rdzen', 'metro', 'bazar', 'fabryka', 'zatoka', 'ogrody', 'chmura'];
