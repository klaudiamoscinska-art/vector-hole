// MOBILE-PERF-1: performance, stability and loading (dev-only, not shipped).
//
//   node qa/perf1.mjs                      # the suite (gates below), exit 1 on any failure
//   node qa/perf1.mjs --bench --tag=T      # report only: the benchmark -> qa/out/perf1/T/bench.json
//   node qa/perf1.mjs --bench --root=DIR --tag=base   # the same benchmark on another checkout
//   node qa/perf1.mjs --bench --pair=DIR [--pairtag=base] --tag=cand  # DIR and this checkout measured alternately
//                                          # inside every repetition (the fair before/after on one machine)
//   node qa/perf1.mjs --compare=base,cand  # prints the before/after table of two bench.json files
//   node qa/perf1.mjs --profile[=scenario] # CPU + allocation profile (top functions) -> qa/out/perf1/<tag>/profile-*.json
//   node qa/perf1.mjs --equiv[=REV]        # report: REV (default: production main before MOBILE-PERF-1) vs this checkout
//                                          # draw and play the same -- state + pixel hashes, CSS animations frozen at the
//                                          # same moments, the save after a seeded round / mission -> qa/out/perf1/equiv.json
//   --reps=N (bench repetitions, default 3), --only=a,b (bench scenarios), --throttle=N (CPU slowdown for the real-time runs)
//
// What is measured (Chromium headless, software raster -- absolute numbers
// are pessimistic and machine-specific; compare a base and a candidate on the
// same machine, same viewport, same seed):
// * virtual-time scenarios (the bots' clock, seeded Math.random, fixed seed):
//   per frame update() ms, render() + raster ms (a 1 px getImageData flush --
//   canvas work is otherwise deferred), their sum; median / p95 / p99 / max,
//   frames over 8.3 / 16.7 ms; and a pixel + state hash at checkpoints --
//   a base and a candidate that draw and play the same give the same hashes.
// * real-time runs (the game's own RAF loop, a real clock, an autopilot):
//   RAF intervals, long frames, the game's work per frame, Blink's own
//   counters (layouts, style recalcs, script / task time) and the CPU busy
//   share in menus, on the pause sheet and in a hidden tab.
// * memory (CDP, after a forced GC), DOM nodes, JS listeners, live timers /
//   intervals / RAF callbacks over a long session; load (navigation timing,
//   time to the menu, requests) and the release's size (raw / gzip / brotli).
// GPU time and real Safari / iPhone behaviour are NOT measurable here.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import os from 'node:os';
import { chromium, serve, OUT, ROOT, isMain, installQaBridge, waitForQaBridge, QA_RANDOM, frozenDateScript, readRuntimeSources, revisionFile, report } from './lib.mjs';

const ARGS = process.argv.slice(2);
const arg = (k, d = null) => { const a = ARGS.find(x => x === '--' + k || x.startsWith('--' + k + '=')); if (!a) return d; const i = a.indexOf('='); return i < 0 ? true : a.slice(i + 1); };
const RUN_ROOT = arg('root') ? path.resolve(arg('root')) : ROOT;
const TAG = arg('tag', RUN_ROOT === ROOT ? 'candidate' : 'other');
const REPS = Number(arg('reps', 3));
const THROTTLE = Number(arg('throttle', 4));
// --gpu: the full Chromium in new headless mode rasterizes canvas on the
// machine's real GPU (here an Intel Iris Xe, D3D11); without it headless
// Chromium rasterizes in software (SwiftShader) -- a no-GPU worst case.
const GPU = !!arg('gpu');
const LAUNCH = (extra = []) => GPU ? { channel: 'chromium', args: extra } : { args: extra };
const OUT_DIR = path.join(OUT, 'perf1', TAG + (GPU ? '-gpu' : ''));

/* ---------------- page side ---------------- */
const PERF_PAGE = `
window.__perf = (function () {
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  const stats = (a) => {
    if (!a.length) return null;
    const s = a.slice().sort((x, y) => x - y);
    const q = (p) => s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))];
    const sum = a.reduce((x, y) => x + y, 0);
    const r = (v) => +v.toFixed(3);
    return { n: a.length, mean: r(sum / a.length), median: r(q(0.5)), p95: r(q(0.95)), p99: r(q(0.99)), max: r(s[s.length - 1]),
      over8: a.filter(v => v > 8.33).length, over16: a.filter(v => v > 16.67).length, over33: a.filter(v => v > 33.3).length };
  };
  const fnv = (h, n) => { h ^= n & 0xff; h = Math.imul(h, 16777619); h ^= (n >>> 8) & 0xff; h = Math.imul(h, 16777619); return h >>> 0; };
  const pixelHash = (cv) => {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let h = 2166136261;
    for (let i = 0; i < d.length; i += 4) h = fnv(h, d[i] | (d[i + 1] << 8) ^ (d[i + 2] << 3));
    return h.toString(16);
  };
  const stateHash = (g) => {
    let h = 2166136261;
    const add = (v) => { h = fnv(h, Math.round(v * 100) | 0); h = fnv(h, (Math.round(v * 100) / 65536) | 0); };
    const holes = [g.player, ...(g.bots || [])];
    holes.forEach(o => { add(o.x); add(o.y); add(o.radius); add(o.score || 0); });
    const list = g.mode === 'campaign' ? g.campaignEntities : g.objects;
    add(list.length); list.forEach(o => { add(o.x); add(o.y); add(o.radius); add(o.eating ? 1 : 0); });
    add(g.particles.length); add(g.floatTexts.length); add(g.zoom * 1000); add(g.camera.x); add(g.camera.y);
    return h.toString(16);
  };
  // Deterministic greedy player (no Math.random): flee a close bigger rival,
  // else the best value per distance it can eat -- the same every run.
  const steerArena = (g) => {
    const p = g.player;
    let fx = 0, fy = 0;
    for (const b of g.bots) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (b.radius > p.radius * 1.12 && d < 260 + b.radius) { fx -= (b.x - p.x) / (d + 1); fy -= (b.y - p.y) / (d + 1); } }
    if (fx || fy) { const m = Math.hypot(fx, fy); g.keyDir = { x: fx / m, y: fy / m }; return; }
    let best = null, bs = -1;
    for (const b of g.bots) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (p.radius > b.radius * 1.2 && !b.invulnerable && d < 500) { const s = 40 / (d + 30); if (s > bs) { bs = s; best = b; } } }
    for (const o of g.objects) { if (o.eating || !g.holeCanEat(p, o)) continue; const d = Math.hypot(o.x - p.x, o.y - p.y); const s = (o.value + 2) / (d + 40); if (s > bs) { bs = s; best = o; } }
    if (best) { const m = Math.hypot(best.x - p.x, best.y - p.y) || 1; g.keyDir = { x: (best.x - p.x) / m, y: (best.y - p.y) / m }; }
    else g.keyDir = { x: 1, y: 0 };
  };
  const steerCampaign = (g) => {
    const p = g.player;
    let fx = 0, fy = 0;
    for (const b of g.bots) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (b.radius > p.radius * 1.1 && d < 170 + b.radius) { fx -= (b.x - p.x) / (d + 1); fy -= (b.y - p.y) / (d + 1); } }
    if (fx || fy) { const m = Math.hypot(fx, fy); g.keyDir = { x: fx / m, y: fy / m }; return; }
    const tier = g.campaignTierIndex(g.campaignPlayerTier().id);
    let best = null, bs = -1;
    for (const e of g.campaignEntities) {
      if (e.consumed || e.eating || !e.live || e.type === 'gate') continue;
      if ((e.type === 'node' || e.type === 'pylon') && !e.active) continue;
      if (e.type === 'landmark' && !e.unlocked) continue;
      if (e.stats && tier < e.stats.minTier) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y); const s = ((e.stats && e.stats.growth) || 2) / (d + 60);
      if (s > bs) { bs = s; best = e; }
    }
    if (best) { const m = Math.hypot(best.x - p.x, best.y - p.y) || 1; g.keyDir = { x: (best.x - p.x) / m, y: (best.y - p.y) / m }; }
    else g.keyDir = { x: Math.cos(p.x), y: Math.sin(p.y) };
  };
  // Optional per-method timers (profile pass only): wraps instance methods.
  const wrapSections = (g, names, acc) => {
    const undo = [];
    names.forEach(n => {
      const target = n.includes('.') ? null : g;
      if (!target || typeof target[n] !== 'function') return;
      const orig = target[n];
      target[n] = function () { const a = realNow(); const r = orig.apply(this, arguments); acc[n] = (acc[n] || 0) + realNow() - a; return r; };
      undo.push(() => { delete target[n]; });
    });
    return () => undo.forEach(f => f());
  };
  function run(o) {
    const g = window.game;
    let vnow = 5e6;
    performance.now = () => vnow;
    if (window.__qaSeedRandom) window.__qaSeedRandom(o.rnd || 12345);
    try {
      if (o.gfx != null) g.applyGfx(o.gfx);
      const campaign = o.mode === 'campaign';
      let def = null, limit0 = null;
      if (campaign) {
        def = campaignMissionById(o.id); limit0 = def.timeLimit; def.timeLimit = 900;
        g.missionBoosters = [];
        g.startCampaignMission(o.id);
        if (g.introPending) g.beginMissionPlay();
      } else g.startRound({ seed: o.seed });
      if (g.rafId) cancelAnimationFrame(g.rafId);
      g.running = false;
      const dt = 1 / 60;
      const alive = () => campaign ? (g.mission && !g.mission.ended && !g.mission.finishing) : g.state === GameState.PLAYING;
      const step = (render) => {
        if (g.evolutionPending) g.skipEvolutionOffer();
        if (g.introPending) g.beginMissionPlay();
        if (g.revivePending) g.declineRevive();
        (campaign ? steerCampaign : steerArena)(g);
        vnow += dt * 1000;
        if (campaign) g.updateCampaign(dt); else g.update(dt);
        if (render && alive()) { if (campaign) g.renderCampaign(vnow / 1000); else g.render(vnow / 1000); }
      };
      for (let f = 0; f < (o.ff || 0) * 60 && alive(); f++) step(f % 6 === 0);
      if (o.bigR) { g.player.radius = Math.min(o.bigR, CONFIG.hole.maxRadius); if (campaign && g.syncCampaignRadius) g.syncCampaignRadius(); }
      if (o.botR) g.bots.forEach((b, i) => { b.radius = o.botR * (0.6 + 0.1 * (i % 5)); });
      for (let f = 0; f < (o.warm || 60) && alive(); f++) step(true);
      g.ctx.getImageData(0, 0, 1, 1);
      const up = [], rd = [], fr = [], sec = {}, hashes = [];
      const unwrap = o.sections ? wrapSections(g, o.sections, sec) : null;
      let f = 0;
      for (; f < o.frames && alive(); f++) {
        if (g.evolutionPending) g.skipEvolutionOffer();
        if (g.revivePending) g.declineRevive();
        (campaign ? steerCampaign : steerArena)(g);
        vnow += dt * 1000;
        const t0 = realNow();
        if (campaign) g.updateCampaign(dt); else g.update(dt);
        const t1 = realNow();
        if (alive()) { if (campaign) g.renderCampaign(vnow / 1000); else g.render(vnow / 1000); }
        g.ctx.getImageData(0, 0, 1, 1);
        const t2 = realNow();
        up.push(t1 - t0); rd.push(t2 - t1); fr.push(t2 - t0);
        if (o.hashEvery && f % o.hashEvery === o.hashEvery - 1) hashes.push(stateHash(g) + ':' + pixelHash(g.canvas));
      }
      if (unwrap) unwrap();
      const p = g.player;
      const out = { frames: f, update: stats(up), render: stats(rd), frame: stats(fr), hashes,
        end: { radius: Math.round(p.radius), score: p.score, zoom: +g.zoom.toFixed(3), objects: (campaign ? g.campaignEntities : g.objects).length, particles: g.particles.length, alive: alive(), gfx: g.gfxLevel, canvas: g.canvas.width + 'x' + g.canvas.height } };
      if (o.sections) { out.sections = {}; for (const k in sec) out.sections[k] = +(sec[k] / Math.max(1, f)).toFixed(3); }
      if (campaign) { def.timeLimit = limit0; }
      g.keyDir = { x: 0, y: 0 };
      return out;
    } finally {
      performance.now = realNow;
      if (window.__qaRestoreRandom) window.__qaRestoreRandom();
    }
  }
  // Menu canvases: the per-frame draw of each animated screen (+ raster).
  function menu(o) {
    const g = window.game;
    if (g.screenAnimRaf) { cancelAnimationFrame(g.screenAnimRaf); g.screenAnimRaf = null; }
    const fns = { hub: (t) => g.renderHubCity(t), districts: (t) => g.renderDistrictTiles(t), warsztat: (t) => g.renderWarsztatCanvases(t), daily: (t) => g.renderDailyMap(t) };
    const canv = { hub: '#hubCityCanvas', districts: '#districtMap canvas.district-tile-canvas', warsztat: '#shopScreen canvas', daily: '#dailyMapCanvas' };
    const cvs = Array.from(document.querySelectorAll(canv[o.kind])).filter(c => c.width && c.height);
    const flush = () => cvs.forEach(c => c.getContext('2d').getImageData(0, 0, 1, 1));
    for (let i = 0; i < 20; i++) fns[o.kind](10 + i / 60);
    flush();
    const ts = [];
    for (let i = 0; i < o.frames; i++) { const a = realNow(); fns[o.kind](11 + i / 60); flush(); ts.push(realNow() - a); }
    g.startScreenAnim();
    return { canvases: cvs.length, frame: stats(ts) };
  }
  // A whole seeded Arena round (to finalizeRun()) or mission (to
  // endCampaignMission()) in virtual time, for the save comparison.
  function playToEnd(o) {
    const g = window.game;
    run({ ...o, frames: 1, warm: 1, hashEvery: 0, ff: 0 });
    let vnow = 7e6;
    performance.now = () => vnow;
    if (window.__qaSeedRandom) window.__qaSeedRandom((o.rnd || 12345) + 1);
    try {
      const campaign = o.mode === 'campaign';
      const dt = 1 / 60;
      for (let f = 0; f < 60 * 200; f++) {
        if (campaign ? (!g.mission || g.mission.ended || g.mission.finishing) : g.state !== GameState.PLAYING) break;
        if (g.evolutionPending) g.skipEvolutionOffer();
        if (g.revivePending) g.declineRevive();
        (campaign ? steerCampaign : steerArena)(g);
        vnow += dt * 1000;
        if (campaign) g.updateCampaign(dt); else g.update(dt);
      }
      if (campaign && g.mission && !g.mission.ended) g.endCampaignMission(!!g.mission.finishing && !g.mission.failReason);
      return { state: g.state, score: g.player.score, radius: Math.round(g.player.radius) };
    } finally {
      performance.now = realNow;
      if (window.__qaRestoreRandom) window.__qaRestoreRandom();
    }
  }
  return { run, menu, stats, pixelHash, stateHash, playToEnd };
})();
`;

// Counts live timers / intervals / RAF callbacks and JS listeners added by
// the page (the long-session leak check). Installed before the game runs.
const LEAK_PROBE = `
(function () {
  const W = window;
  const live = { intervals: new Set(), timeouts: new Set(), rafs: new Set() };
  W.__leak = { live, added: 0, removed: 0 };
  const si = W.setInterval, ci = W.clearInterval, st = W.setTimeout, ct = W.clearTimeout, ra = W.requestAnimationFrame, ca = W.cancelAnimationFrame;
  W.setInterval = function (f, ms, ...a) { const id = si.call(W, f, ms, ...a); live.intervals.add(id); return id; };
  W.clearInterval = function (id) { live.intervals.delete(id); return ci.call(W, id); };
  W.setTimeout = function (f, ms, ...a) { let id; id = st.call(W, function () { live.timeouts.delete(id); return typeof f === 'function' ? f.apply(this, arguments) : undefined; }, ms, ...a); live.timeouts.add(id); return id; };
  W.clearTimeout = function (id) { live.timeouts.delete(id); return ct.call(W, id); };
  W.requestAnimationFrame = function (f) { let id; id = ra.call(W, function (t) { live.rafs.delete(id); return f(t); }); live.rafs.add(id); return id; };
  W.cancelAnimationFrame = function (id) { live.rafs.delete(id); return ca.call(W, id); };
  W.__leakSnapshot = () => ({ intervals: live.intervals.size, timeouts: live.timeouts.size, rafs: live.rafs.size });
})();
`;

/* ---------------- node side ---------------- */
const PHONE = { name: 'iPhone 13 390x844 @3', viewport: { width: 390, height: 844 }, dsf: 3, mobile: true };
const DESKTOP = { name: 'laptop 1366x768 @1', viewport: { width: 1366, height: 768 }, dsf: 1, mobile: false };
const POKI = { name: 'Poki 836x470 @1', viewport: { width: 836, height: 470 }, dsf: 1, mobile: false };

async function launch(url, dev, { save = null, leak = false, fonts = true } = {}) {
  const browser = await chromium.launch(LAUNCH(['--enable-precise-memory-info']));
  const context = await browser.newContext({ viewport: dev.viewport, isMobile: dev.mobile, hasTouch: dev.mobile, deviceScaleFactor: dev.dsf, locale: 'pl-PL' });
  await installQaBridge(context);
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await context.addInitScript(QA_RANDOM);
  await context.addInitScript(frozenDateScript('2026-10-20T12:00:00Z'));
  if (leak) await context.addInitScript(LEAK_PROBE);
  if (save) await context.addInitScript((s) => { if (!sessionStorage.getItem('__qaSeeded')) { localStorage.setItem('vectorHoleSave_v1', s); sessionStorage.setItem('__qaSeeded', '1'); } }, JSON.stringify(save));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.game && window.game.state !== undefined, null, { timeout: 20000 });
  await waitForQaBridge(page);
  if (fonts) await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.addScriptTag({ content: PERF_PAGE });
  const cdp = await context.newCDPSession(page);
  return { browser, context, page, cdp, errors };
}

/** A played-in save: both modes, Warsztat / Wyzwania open, `coreLevel`. */
async function makeSave(page, { coreLevel = 1, missions = 30, districts = 12 } = {}) {
  return page.evaluate(({ coreLevel, missions, districts }) => {
    const s = defaultSave();
    const ids = DISTRICTS.flatMap(d => d.missions).slice(0, missions);
    ids.forEach(id => { s.campaign.completed[id] = true; });
    s.campaign.unlockedDistricts = DISTRICTS.slice(0, districts).map(d => d.id);
    s.stats.runsPlayed = 12;
    s.unlocks.announced = Array.from(new Set([...unlockedFeatureIds(s), 'warsztat', 'wyzwania', 'kampania']));
    s.coach = { moved: true, ate: true, rival: true, danger: true };
    s.login.lastClaimDate = '2026-10-20';
    s.coins = 900;
    s.hub.coreLevel = coreLevel; s.hub.coreCharge = coreLevel >= 6 ? 30 : 40;
    s.privacy = { decided: true, analytics: false, ads: false, ts: 1 };
    s.guestId = 'guest_qa_perf1'; // a fresh profile draws a random id (and the save seal covers it)
    return JSON.stringify(s);
  }, { coreLevel, missions, districts });
}

async function heap(cdp) {
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  const h = await cdp.send('Runtime.getHeapUsage');
  const c = await cdp.send('Memory.getDOMCounters');
  return { usedMB: +(h.usedSize / 1048576).toFixed(2), nodes: c.nodes, listeners: c.jsEventListeners, documents: c.documents };
}
async function metrics(cdp) {
  const { metrics: m } = await cdp.send('Performance.getMetrics');
  const o = {}; m.forEach(x => { o[x.name] = x.value; }); return o;
}
const diffMetrics = (a, b, wallS) => ({
  layouts: b.LayoutCount - a.LayoutCount, styleRecalcs: b.RecalcStyleCount - a.RecalcStyleCount,
  layoutMs: +((b.LayoutDuration - a.LayoutDuration) * 1000).toFixed(1), styleMs: +((b.RecalcStyleDuration - a.RecalcStyleDuration) * 1000).toFixed(1),
  scriptMs: +((b.ScriptDuration - a.ScriptDuration) * 1000).toFixed(1), taskMs: +((b.TaskDuration - a.TaskDuration) * 1000).toFixed(1),
  busyPct: +(((b.TaskDuration - a.TaskDuration) / wallS) * 100).toFixed(1)
});

/* --- the virtual-time scenarios (seeded, identical in a base and a candidate) --- */
const SCENARIOS = [
  { id: 'arena-first', dev: PHONE, fresh: true, o: { seed: 4242, gfx: 2, frames: 900, hashEvery: 300 }, what: 'pierwsza runda nowego gracza (0-15 s)' },
  { id: 'arena-late', dev: PHONE, o: { seed: 4242, gfx: 2, ff: 85, frames: 900, hashEvery: 300 }, what: 'późna faza Areny (85-100 s), boty przyspieszone' },
  { id: 'arena-max', dev: PHONE, o: { seed: 777, gfx: 2, ff: 20, bigR: 440, botR: 160, frames: 600, hashEvery: 300 }, what: 'wir prawie maks. (r 440) + duże boty, masowe pochłanianie' },
  { id: 'arena-max-desktop', dev: DESKTOP, o: { seed: 777, gfx: 2, ff: 20, bigR: 440, botR: 160, frames: 600, hashEvery: 300 }, what: 'jak wyżej, laptop 1366x768' },
  { id: 'arena-poki', dev: POKI, o: { seed: 4242, gfx: 2, ff: 40, frames: 600, hashEvery: 300 }, what: 'Arena 40-50 s w ramce Poki 836x470' },
  { id: 'arena-gfx0', dev: PHONE, o: { seed: 4242, gfx: 0, ff: 85, frames: 600, hashEvery: 300 }, what: 'późna Arena na niskim poziomie jakości (gfx0)' },
  { id: 'm01', dev: PHONE, o: { mode: 'campaign', id: 'M01', gfx: 2, frames: 600, hashEvery: 300 }, what: 'Kampania M01 (początek)' },
  { id: 'm59', dev: PHONE, o: { mode: 'campaign', id: 'M59', gfx: 2, ff: 30, frames: 600, hashEvery: 300 }, what: 'M59 „Rekord Rdzenia” 30-40 s, bardzo duży wir' },
  { id: 'm-dense', dev: PHONE, o: { mode: 'campaign', id: 'DENSE', gfx: 2, ff: 10, frames: 600, hashEvery: 300 }, what: 'misja z największą liczbą obiektów' },
  { id: 'm-boss', dev: PHONE, o: { mode: 'campaign', id: 'BOSS6', gfx: 2, ff: 10, frames: 600, hashEvery: 300 }, what: 'boss Rdzenia (dzielnica 6)' },
  { id: 'm-final', dev: PHONE, o: { mode: 'campaign', id: 'BOSS12', gfx: 2, ff: 10, frames: 600, hashEvery: 300 }, what: 'boss finałowy (dzielnica 12)' },
  { id: 'm-late', dev: PHONE, o: { mode: 'campaign', id: 'LATE', gfx: 2, ff: 10, frames: 600, hashEvery: 300 }, what: 'misja z późnego rozdziału (Chmura)' }
];
const MENUS = [
  { id: 'menu-hub-lvl1', screen: 'mainMenu', kind: 'hub', core: 1 },
  { id: 'menu-hub-lvl6', screen: 'mainMenu', kind: 'hub', core: 6 },
  { id: 'menu-districts', screen: 'campaignScreen', kind: 'districts', core: 3 },
  { id: 'menu-warsztat', screen: 'shopScreen', kind: 'warsztat', core: 3 },
  { id: 'menu-daily', screen: 'challengesScreen', kind: 'daily', core: 3 }
];

async function resolveMission(page, id) {
  return page.evaluate((id) => {
    if (id === 'BOSS6') return DISTRICTS[5].missions[DISTRICTS[5].missions.length - 1];
    if (id === 'BOSS12') return DISTRICTS[11].missions[DISTRICTS[11].missions.length - 1];
    if (id === 'LATE') return DISTRICTS[11].missions[8];
    if (id === 'DENSE') {
      // The mission whose board holds the most entities (setup counts).
      let best = null, bn = -1;
      for (const m of CAMPAIGN_MISSIONS) { const s = m.setup || {}; let n = 0; for (const k in s) if (typeof s[k] === 'number' && /count|food|fragments|capsules|n$/i.test(k)) n += s[k]; if (n > bn) { bn = n; best = m.id; } }
      return best || 'M120';
    }
    return id;
  }, id);
}

/** --bench: every target (one checkout, or with --pair=DIR a base and this
 *  checkout) is measured inside the same repetition, alternating, so a base
 *  and a candidate see the same machine state (power mode, heat, other load). */
async function bench(targets) {
  const only = arg('only') ? String(arg('only')).split(',') : null;
  const outs = targets.map(t => ({ tag: t.tag, root: t.root, reps: REPS, gpu: GPU, paired: targets.length > 1, when: new Date().toISOString(), scenarios: {}, menus: {}, realtime: {}, load: null, size: releaseSize(t.root) }));
  const save = () => targets.forEach((t, i) => { fs.mkdirSync(t.outDir, { recursive: true }); fs.writeFileSync(path.join(t.outDir, 'bench.json'), JSON.stringify(outs[i], null, 1)); });
  for (const sc of SCENARIOS) {
    if (only && !only.includes(sc.id)) continue;
    const reps = targets.map(() => []);
    for (let r = 0; r < REPS; r++) {
      for (let ti = 0; ti < targets.length; ti++) {
        const g = await launch(targets[ti].url, sc.dev);
        if (!sc.fresh) {
          const s = await makeSave(g.page, { coreLevel: 3, missions: 60, districts: 12 });
          await g.page.evaluate((s) => { localStorage.setItem('vectorHoleSave_v1', s); }, s);
          await g.page.reload();
          await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 20000 });
          await g.page.evaluate(() => document.fonts && document.fonts.ready);
          await g.page.addScriptTag({ content: PERF_PAGE });
        }
        const o = { ...sc.o };
        if (o.mode === 'campaign') o.id = await resolveMission(g.page, o.id);
        const res = await g.page.evaluate((o) => window.__perf.run(o), o);
        res.mission = o.id || null;
        res.errors = g.errors.slice(0, 3);
        reps[ti].push(res);
        await g.browser.close();
      }
    }
    targets.forEach((t, ti) => {
      const s = outs[ti].scenarios[sc.id] = { what: sc.what, device: sc.dev.name, reps: reps[ti], agg: aggregate(reps[ti]) };
      console.log(`  [${t.tag}] ${sc.id.padEnd(18)} ${sc.dev.name.padEnd(22)} frame p50 ${fmtAgg(s.agg, 'frame', 'median')} p95 ${fmtAgg(s.agg, 'frame', 'p95')} p99 ${fmtAgg(s.agg, 'frame', 'p99')} · upd p50 ${fmtAgg(s.agg, 'update', 'median')} · hashes ${s.agg.hashesStable ? 'stable' : 'VARY'}`);
    });
    save();
  }
  for (const m of MENUS) {
    if (only && !only.includes(m.id)) continue;
    const reps = targets.map(() => []);
    for (let r = 0; r < REPS; r++) {
      for (let ti = 0; ti < targets.length; ti++) {
        const g = await launch(targets[ti].url, PHONE);
        const s = await makeSave(g.page, { coreLevel: m.core, missions: 120, districts: 12 });
        await g.page.evaluate((s) => { localStorage.setItem('vectorHoleSave_v1', s); }, s);
        await g.page.reload();
        await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 20000 });
        await g.page.evaluate(() => document.fonts && document.fonts.ready);
        await g.page.addScriptTag({ content: PERF_PAGE });
        await g.page.evaluate((id) => window.game.showScreen(id), m.screen);
        await g.page.waitForTimeout(400);
        reps[ti].push(await g.page.evaluate((o) => window.__perf.menu(o), { kind: m.kind, frames: 180 }));
        await g.browser.close();
      }
    }
    targets.forEach((t, ti) => {
      const s = outs[ti].menus[m.id] = { reps: reps[ti], agg: { frame: aggStat(reps[ti].map(r => r.frame)) }, canvases: reps[ti][0].canvases };
      console.log(`  [${t.tag}] ${m.id.padEnd(18)} canvases ${s.canvases} · frame p50 ${s.agg.frame.median ? s.agg.frame.median.med : '—'} p95 ${s.agg.frame.p95 ? s.agg.frame.p95.med : '—'}`);
    });
    save();
  }
  if (!only || only.includes('realtime')) {
    const runs = realtimeRuns();
    for (const r of runs) {
      const reps = targets.map(() => []);
      for (let k = 0; k < Math.max(1, Math.min(REPS, 2)); k++) for (let ti = 0; ti < targets.length; ti++) reps[ti].push(await realtimeOnce(targets[ti].url, r));
      targets.forEach((t, ti) => {
        outs[ti].realtime[r.id] = { device: r.dev.name, throttle: r.throttle, reps: reps[ti] };
        const a = reps[ti][0];
        console.log(`  [${t.tag}] ${r.id.padEnd(24)} ${a.raf ? `raf p50 ${a.raf.median} p95 ${a.raf.p95} p99 ${a.raf.p99} long>33 ${a.raf.over33} · work p50 ${a.work ? a.work.median : '—'} p95 ${a.work ? a.work.p95 : '—'}` : ''} ${a.blink ? `· layouts ${a.blink.layouts} style ${a.blink.styleRecalcs} busy ${a.blink.busyPct}%` : ''} ${a.idle ? JSON.stringify(a.idle) : ''}`);
      });
      save();
    }
  }
  if (!only || only.includes('load')) {
    for (let ti = 0; ti < targets.length; ti++) outs[ti].load = [];
    for (const [dev, throttle] of [[PHONE, 1], [PHONE, THROTTLE], [DESKTOP, 1]]) {
      const runs = targets.map(() => []), errors = targets.map(() => []);
      for (let k = 0; k < 5; k++) for (let ti = 0; ti < targets.length; ti++) { try { runs[ti].push(await loadOnce(targets[ti].url, dev, throttle)); } catch (e) { errors[ti].push(String(e.message).split(String.fromCharCode(10))[0]); } }
      targets.forEach((t, ti) => {
        const rr = runs[ti];
        const med = (key) => { const v = rr.map(r => r[key]).filter(x => x != null).sort((a, b) => a - b); return v.length ? { med: v[Math.floor(v.length / 2)], min: v[0], max: v[v.length - 1] } : null; };
        const row = { device: dev.name, throttle, runs: rr.length, errors: errors[ti], dcl: med('dcl'), load: med('load'), fcp: med('fcp'), menu: med('menu'), input: med('input'), requests: rr[0] ? rr[0].requests : null, external: rr[0] ? rr[0].external : null };
        outs[ti].load.push(row);
        console.log(`  [${t.tag}] load ${dev.name} cpu ${throttle}x: ${rr.length}/5 · DCL ${row.dcl && row.dcl.med} · FCP ${row.fcp && row.fcp.med} · menu ${row.menu && row.menu.med} · GRAJ ${row.input && row.input.med} ms · requests ${row.requests} (external ${row.external})`);
      });
    }
    save();
  }
  if (!only || only.includes('session')) {
    for (let ti = 0; ti < targets.length; ti++) { try { outs[ti].session = await longSession(targets[ti].url, { cycles: 8 }); } catch (e) { outs[ti].session = { error: String(e.message) }; } }
    save();
  }
  targets.forEach(t => console.log(`bench -> ${path.relative(ROOT, path.join(t.outDir, 'bench.json'))}`));
  return outs;
}

function aggStat(list) {
  const keys = ['mean', 'median', 'p95', 'p99', 'max', 'over8', 'over16', 'over33'];
  const o = {};
  for (const k of keys) {
    const v = list.filter(Boolean).map(s => s[k]).sort((a, b) => a - b);
    if (!v.length) continue;
    o[k] = { med: v[Math.floor(v.length / 2)], min: v[0], max: v[v.length - 1] };
  }
  return o;
}
function aggregate(reps) { return { update: aggStat(reps.map(r => r.update)), render: aggStat(reps.map(r => r.render)), frame: aggStat(reps.map(r => r.frame)), frames: reps[0].frames, end: reps[0].end, hashes: reps[0].hashes, hashesStable: reps.every(r => r.hashes.join() === reps[0].hashes.join()) }; }
const fmtAgg = (agg, part, k) => agg[part] && agg[part][k] ? agg[part][k].med.toFixed(2) : '—';

/* --- real time: the game's own RAF loop --- */
function realtimeRuns() {
  return [
    { id: 'rt-arena-phone', dev: PHONE, throttle: 1, kind: 'arena' },
    { id: 'rt-arena-phone-cpu' + THROTTLE + 'x', dev: PHONE, throttle: THROTTLE, kind: 'arena' },
    { id: 'rt-arena-max-phone', dev: PHONE, throttle: 1, kind: 'arena-max' },
    { id: 'rt-arena-max-phone-cpu' + THROTTLE + 'x', dev: PHONE, throttle: THROTTLE, kind: 'arena-max' },
    { id: 'rt-arena-desktop', dev: DESKTOP, throttle: 1, kind: 'arena' },
    { id: 'rt-arena-max-desktop', dev: DESKTOP, throttle: 1, kind: 'arena-max' },
    { id: 'rt-arena-poki-cpu' + THROTTLE + 'x', dev: POKI, throttle: THROTTLE, kind: 'arena' },
    { id: 'rt-m59-phone-cpu' + THROTTLE + 'x', dev: PHONE, throttle: THROTTLE, kind: 'm59' },
    { id: 'rt-idle-menus-phone', dev: PHONE, throttle: 1, kind: 'idle' }
  ];
}
async function realtime(url) {
  const res = {};
  for (const r of realtimeRuns()) {
    const reps = [];
    for (let k = 0; k < Math.max(1, Math.min(REPS, 2)); k++) reps.push(await realtimeOnce(url, r));
    res[r.id] = { device: r.dev.name, throttle: r.throttle, reps };
    const a = reps[0];
    console.log(`  ${r.id.padEnd(24)} ${a.raf ? `raf p50 ${a.raf.median} p95 ${a.raf.p95} p99 ${a.raf.p99} long>33 ${a.raf.over33} · work p50 ${a.work ? a.work.median : '—'} p95 ${a.work ? a.work.p95 : '—'}` : ''} ${a.blink ? `· layouts ${a.blink.layouts} style ${a.blink.styleRecalcs} busy ${a.blink.busyPct}%` : ''} ${a.idle ? JSON.stringify(a.idle) : ''}`);
  }
  return res;
}

async function realtimeOnce(url, r) {
  const g = await launch(url, r.dev);
  const save = await makeSave(g.page, { coreLevel: 6, missions: 60, districts: 12 });
  await g.page.evaluate((s) => { localStorage.setItem('vectorHoleSave_v1', s); }, save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 20000 });
  await g.page.evaluate(() => document.fonts && document.fonts.ready);
  await g.page.addScriptTag({ content: PERF_PAGE });
  await g.cdp.send('Performance.enable');
  if (r.throttle > 1) await g.cdp.send('Emulation.setCPUThrottlingRate', { rate: r.throttle });
  const out = {};
  try {
    if (r.kind === 'idle') {
      // CPU share of each still screen (nothing touched for 3 s).
      out.idle = {};
      for (const [name, act] of [['hub', "game.showScreen('mainMenu')"], ['districts', "game.showScreen('campaignScreen')"], ['warsztat', "game.showScreen('shopScreen')"], ['wyzwania', "game.showScreen('challengesScreen')"], ['profil', "game.showScreen('profileScreen')"],
        ['pause', "game.showScreen('mainMenu'); game.startRound({ seed: 5 }); game.pauseGame()"], ['hidden-tab', "Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'))"]]) {
        await g.page.evaluate(act);
        await g.page.waitForTimeout(500);
        const m0 = await metrics(g.cdp); const t0 = Date.now();
        const rafs = await g.page.evaluate(() => new Promise(res => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 2500) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); }));
        const m1 = await metrics(g.cdp);
        const d = diffMetrics(m0, m1, (Date.now() - t0) / 1000);
        out.idle[name] = { busyPct: d.busyPct, scriptMs: d.scriptMs, layouts: d.layouts, probeRafs: rafs };
      }
    } else {
      await g.page.evaluate((r) => {
        const g = window.game;
        g.frameWarmup = 1e9; // the quality watchdog stays out of the measurement (same in base and candidate)
        if (r.kind === 'm59') { g.missionBoosters = []; campaignMissionById('M59').timeLimit = 900; g.startCampaignMission('M59'); if (g.introPending) g.beginMissionPlay(); }
        else g.startRound({ seed: r.kind === 'arena-max' ? 777 : 4242 });
        if (r.kind === 'arena-max') { g.player.radius = 440; g.bots.forEach((b, i) => { b.radius = 160 * (0.6 + 0.1 * (i % 5)); }); g.botTuning.passive = 0; }
        g.frameWarmup = 1e9;
        const realNow = performance.now.bind(performance);
        window.__rt = { raf: [], work: [] };
        const orig = Object.getPrototypeOf(g).loop;
        g.loop = function (t) { const a = realNow(); orig.call(this, t); window.__rt.work.push(realNow() - a); };
        // autopilot: re-aims 10x a second like a player's thumb
        window.__rtPilot = setInterval(() => {
          const p = g.player; if (!p) return;
          if (g.evolutionPending) g.skipEvolutionOffer();
          if (g.introPending) g.beginMissionPlay();
          const list = g.mode === 'campaign' ? g.campaignEntities.filter(e => e.live && !e.consumed && !e.eating) : g.objects.filter(o => !o.eating && g.holeCanEat(p, o));
          let best = null, bd = Infinity; for (const o of list) { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } }
          if (best) { const m = bd || 1; g.keyDir = { x: (best.x - p.x) / m, y: (best.y - p.y) / m }; }
        }, 100);
        let last = 0;
        const probe = (t) => { if (last) window.__rt.raf.push(t - last); last = t; if (!window.__rtStop) requestAnimationFrame(probe); };
        requestAnimationFrame(probe);
      }, r);
      await g.page.waitForTimeout(1500); // warm-up
      await g.page.evaluate(() => { window.__rt.raf.length = 0; window.__rt.work.length = 0; });
      const m0 = await metrics(g.cdp); const t0 = Date.now();
      await g.page.waitForTimeout(8000);
      const m1 = await metrics(g.cdp);
      const wall = (Date.now() - t0) / 1000;
      const got = await g.page.evaluate(() => { window.__rtStop = true; clearInterval(window.__rtPilot); const g = window.game; return { raf: window.__perf.stats(window.__rt.raf), work: window.__perf.stats(window.__rt.work), radius: Math.round(g.player.radius), gfx: g.gfxLevel, state: g.state }; });
      Object.assign(out, got, { blink: diffMetrics(m0, m1, wall), fps: got.raf ? +(1000 / got.raf.mean).toFixed(1) : null });
    }
  } finally {
    out.errors = g.errors.slice(0, 3);
    await g.browser.close();
  }
  return out;
}

/* --- load --- */
async function loadTimes(url) {
  const rows = [];
  for (const [dev, throttle] of [[PHONE, 1], [PHONE, THROTTLE], [DESKTOP, 1]]) {
    const runs = [], errors = [];
    for (let k = 0; k < 5; k++) { try { runs.push(await loadOnce(url, dev, throttle)); } catch (e) { errors.push(String(e.message).split(String.fromCharCode(10))[0]); } }
    const med = (key) => { const v = runs.map(r => r[key]).filter(x => x != null).sort((a, b) => a - b); return v.length ? { med: v[Math.floor(v.length / 2)], min: v[0], max: v[v.length - 1] } : null; };
    const row = { device: dev.name, throttle, runs: runs.length, errors, dcl: med('dcl'), load: med('load'), fcp: med('fcp'), menu: med('menu'), input: med('input'), requests: runs[0] ? runs[0].requests : null, external: runs[0] ? runs[0].external : null };
    rows.push(row);
    console.log(`  load ${dev.name} cpu ${throttle}x: ${runs.length}/5 runs · DCL ${row.dcl && row.dcl.med} ms · FCP ${row.fcp && row.fcp.med} · menu ${row.menu && row.menu.med} · first input ${row.input && row.input.med} · requests ${row.requests} (external ${row.external})${errors.length ? ' · errors ' + errors[0] : ''}`);
  }
  return rows;
}

function releaseSize(root) {
  const src = readRuntimeSources(root);
  const files = [src.html, ...src.files].map(f => {
    const buf = fs.readFileSync(path.join(root, f.path));
    return { path: f.path, raw: buf.length, gzip: zlib.gzipSync(buf, { level: 9 }).length, brotli: zlib.brotliCompressSync(buf).length };
  });
  const sum = (k) => files.reduce((a, f) => a + f[k], 0);
  return { files, raw: sum('raw'), gzip: sum('gzip'), brotli: sum('brotli'), external: src.skipped || [] };
}

/* --- long session: rounds, panels, resizes, tab switches --- */
async function longSession(url, { cycles = 8 } = {}) {
  const g = await launch(url, PHONE, { leak: true });
  const save = await makeSave(g.page, { coreLevel: 4, missions: 60, districts: 12 });
  await g.page.evaluate((s) => { localStorage.setItem('vectorHoleSave_v1', s); }, save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 20000 });
  await g.page.addScriptTag({ content: PERF_PAGE });
  const snaps = [];
  const sizes = [[390, 844], [844, 390], [390, 664], [775, 328], [836, 470], [390, 844]];
  for (let c = 0; c < cycles; c++) {
    // an Arena round to its end (virtual time), its result, back to Miasto
    await g.page.evaluate((c) => { const r = window.__perf.run({ seed: 100 + c, gfx: 2, ff: 125, frames: 1, warm: 1 }); return r.end; }, c);
    await g.page.waitForTimeout(300);
    // a mission (part of it) and leaving it
    await g.page.evaluate((c) => { window.__perf.run({ mode: 'campaign', id: ['M01', 'M12', 'M59', 'M30'][c % 4], gfx: 2, ff: 8, frames: 30, warm: 1 }); window.game.leaveCampaignMission && window.game.leaveCampaignMission(); }, c);
    // the tabs, each twice
    for (const id of ['mainMenu', 'campaignScreen', 'shopScreen', 'challengesScreen', 'profileScreen', 'mainMenu', 'shopScreen', 'campaignScreen', 'mainMenu']) {
      await g.page.evaluate((id) => window.game.showScreen(id), id); await g.page.waitForTimeout(60);
    }
    // a real round started and paused, resized / turned, hidden and back, left
    await g.page.evaluate(() => window.game.startRound({ seed: 9 }));
    await g.page.waitForTimeout(200);
    for (const [w, h] of sizes) { await g.page.setViewportSize({ width: w, height: h }); await g.page.waitForTimeout(80); }
    await g.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await g.page.waitForTimeout(100);
    await g.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await g.page.evaluate(() => { const gm = window.game; if (gm.paused) gm.resumeGame(); });
    await g.page.waitForTimeout(200);
    await g.page.evaluate(() => { const gm = window.game; gm.pauseGame(); gm.leaveRun ? gm.leaveRun() : gm.stopRun(); gm.showScreen('mainMenu'); });
    await g.page.waitForTimeout(800); // let one-shot timers (toasts, banners) run out
    const h = await heap(g.cdp);
    const lk = await g.page.evaluate(() => ({ ...window.__leakSnapshot(), particles: window.game.particles.length, floatTexts: window.game.floatTexts.length, ghosts: (window.game.swallowGhosts || []).length, state: window.game.state, running: !!window.game.running }));
    snaps.push({ cycle: c + 1, ...h, ...lk });
    console.log(`  session cycle ${c + 1}: heap ${h.usedMB} MB · nodes ${h.nodes} · listeners ${h.listeners} · intervals ${lk.intervals} · timeouts ${lk.timeouts} · rafs ${lk.rafs} · state ${lk.state}`);
  }
  const errors = g.errors.slice(0, 5);
  await g.browser.close();
  return { snaps, errors };
}

/* --- CPU / allocation profile of one scenario --- */
async function profile(url, which) {
  const sc = SCENARIOS.find(s => s.id === which) || SCENARIOS[2];
  const g = await launch(url, sc.dev);
  if (!sc.fresh) {
    const save = await makeSave(g.page, { coreLevel: 3, missions: 60, districts: 12 });
    await g.page.evaluate((s) => { localStorage.setItem('vectorHoleSave_v1', s); }, save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 20000 });
    await g.page.evaluate(() => document.fonts && document.fonts.ready);
    await g.page.addScriptTag({ content: PERF_PAGE });
  }
  const o = { ...sc.o, frames: Math.max(sc.o.frames, 600), hashEvery: 0 };
  if (o.mode === 'campaign') o.id = await resolveMission(g.page, o.id);
  await g.cdp.send('Profiler.enable');
  await g.cdp.send('Profiler.setSamplingInterval', { interval: 100 });
  await g.cdp.send('HeapProfiler.enable');
  await g.cdp.send('Profiler.start');
  await g.cdp.send('HeapProfiler.startSampling', { samplingInterval: 1024, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true }).catch(() => g.cdp.send('HeapProfiler.startSampling', { samplingInterval: 1024 }));
  const res = await g.page.evaluate((o) => window.__perf.run(o), o);
  const { profile: prof } = await g.cdp.send('Profiler.stop');
  const { profile: heapProf } = await g.cdp.send('HeapProfiler.stopSampling');
  await g.browser.close();
  // self time per function
  const byId = new Map(prof.nodes.map(n => [n.id, n]));
  const self = new Map();
  const dts = prof.timeDeltas; let total = 0;
  prof.samples.forEach((id, i) => {
    const n = byId.get(id); const cf = n.callFrame; const d = dts[i] || 0; total += d;
    const k = `${cf.functionName || '(anon)'} ${cf.url ? path.basename(cf.url) : ''}:${cf.lineNumber + 1}`;
    self.set(k, (self.get(k) || 0) + d);
  });
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => ({ fn: k, selfMs: +(v / 1000).toFixed(1), pct: +(v / total * 100).toFixed(1) }));
  // allocation per function
  const alloc = new Map(); let allocTotal = 0;
  const walk = (n) => { const cf = n.callFrame; const k = `${cf.functionName || '(anon)'} ${cf.url ? path.basename(cf.url) : ''}:${cf.lineNumber + 1}`; alloc.set(k, (alloc.get(k) || 0) + n.selfSize); allocTotal += n.selfSize; (n.children || []).forEach(walk); };
  walk(heapProf.head);
  const topAlloc = [...alloc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => ({ fn: k, kb: +(v / 1024).toFixed(0) }));
  const out = { scenario: sc.id, frames: res.frames, frame: res.frame, update: res.update, render: res.render, totalMs: +(total / 1000).toFixed(0), top, allocKBPerFrame: +(allocTotal / 1024 / res.frames).toFixed(1), topAlloc };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `profile-${sc.id}.json`), JSON.stringify(out, null, 1));
  console.log(`profile ${sc.id} (${sc.dev.name}): ${res.frames} frames, frame p50 ${res.frame.median} ms p95 ${res.frame.p95}; alloc ${out.allocKBPerFrame} KB/frame`);
  top.slice(0, 22).forEach(t => console.log(`   ${String(t.pct).padStart(5)}%  ${String(t.selfMs).padStart(7)} ms  ${t.fn}`));
  console.log('  allocations:'); topAlloc.slice(0, 12).forEach(t => console.log(`   ${String(t.kb).padStart(7)} KB  ${t.fn}`));
  return out;
}

/* --- before / after table --- */
function compare(baseTag, candTag) {
  const read = (t) => JSON.parse(fs.readFileSync(path.join(OUT, 'perf1', t, 'bench.json'), 'utf8'));
  const A = read(baseTag), B = read(candTag);
  const pct = (a, b) => (a ? ((b - a) / a * 100) : 0).toFixed(1) + '%';
  const lines = [];
  lines.push(`| Scenariusz | Metryka | Baza (${baseTag}) | Kandydat (${candTag}) | Różnica |`, '|---|---|---|---|---|');
  for (const id of Object.keys(A.scenarios)) {
    const a = A.scenarios[id], b = B.scenarios[id]; if (!b) continue;
    for (const [part, k, label] of [['frame', 'median', 'klatka mediana ms'], ['frame', 'p95', 'klatka p95 ms'], ['frame', 'p99', 'klatka p99 ms'], ['frame', 'over16', 'klatki >16,7 ms'], ['update', 'median', 'update() mediana ms'], ['render', 'median', 'render+raster mediana ms']]) {
      const x = a.agg[part][k], y = b.agg[part][k]; if (!x || !y) continue;
      lines.push(`| ${id} | ${label} | ${x.med} (${x.min}–${x.max}) | ${y.med} (${y.min}–${y.max}) | ${pct(x.med, y.med)} |`);
    }
    lines.push(`| ${id} | skróty stanu+pikseli | ${a.agg.hashes.join(' ')} | ${b.agg.hashes.join(' ')} | ${a.agg.hashes.join() === b.agg.hashes.join() ? 'IDENTYCZNE' : 'RÓŻNE'} |`);
  }
  for (const id of Object.keys(A.menus || {})) {
    const a = A.menus[id], b = (B.menus || {})[id]; if (!b) continue;
    for (const k of ['median', 'p95']) lines.push(`| ${id} | klatka ${k} ms | ${a.agg.frame[k].med} | ${b.agg.frame[k].med} | ${pct(a.agg.frame[k].med, b.agg.frame[k].med)} |`);
  }
  for (const id of Object.keys(A.realtime || {})) {
    const a = A.realtime[id].reps, b = ((B.realtime || {})[id] || {}).reps; if (!b) continue;
    const m = (reps, f) => { const v = reps.map(f).filter(x => x != null).sort((p, q) => p - q); return v.length ? v[Math.floor(v.length / 2)] : null; };
    if (a[0].idle) {
      for (const s of Object.keys(a[0].idle)) {
        lines.push(`| ${id} | CPU zajęty % — ${s} | ${m(a, r => r.idle[s].busyPct)} | ${m(b, r => r.idle[s].busyPct)} | ${pct(m(a, r => r.idle[s].busyPct), m(b, r => r.idle[s].busyPct))} |`);
        lines.push(`| ${id} | layouty / 2,5 s — ${s} | ${m(a, r => r.idle[s].layouts)} | ${m(b, r => r.idle[s].layouts)} | ${pct(m(a, r => r.idle[s].layouts), m(b, r => r.idle[s].layouts))} |`);
        lines.push(`| ${id} | skrypt ms / 2,5 s — ${s} | ${m(a, r => r.idle[s].scriptMs)} | ${m(b, r => r.idle[s].scriptMs)} | ${pct(m(a, r => r.idle[s].scriptMs), m(b, r => r.idle[s].scriptMs))} |`);
        lines.push(`| ${id} | klatki RAF / 2,5 s — ${s} | ${m(a, r => r.idle[s].probeRafs)} | ${m(b, r => r.idle[s].probeRafs)} | ${pct(m(a, r => r.idle[s].probeRafs), m(b, r => r.idle[s].probeRafs))} |`);
      }
      continue;
    }
    for (const [label, f] of [['RAF p50 ms', r => r.raf && r.raf.median], ['RAF p95 ms', r => r.raf && r.raf.p95], ['RAF p99 ms', r => r.raf && r.raf.p99], ['RAF >33 ms', r => r.raf && r.raf.over33], ['FPS', r => r.fps], ['praca/klatkę p50 ms', r => r.work && r.work.median], ['praca/klatkę p95 ms', r => r.work && r.work.p95], ['layouty/8 s', r => r.blink.layouts], ['przeliczenia stylu/8 s', r => r.blink.styleRecalcs], ['layout ms/8 s', r => r.blink.layoutMs], ['styl ms/8 s', r => r.blink.styleMs], ['CPU zajęty %', r => r.blink.busyPct]]) {
      lines.push(`| ${id} | ${label} | ${m(a, f)} | ${m(b, f)} | ${pct(m(a, f), m(b, f))} |`);
    }
  }
  if (A.load && B.load) A.load.forEach((a, i) => { const b = B.load[i]; for (const k of ['dcl', 'fcp', 'menu', 'input']) if (a[k] && b[k]) lines.push(`| ładowanie ${a.device} CPU ${a.throttle}x | ${k} ms | ${a[k].med} | ${b[k].med} | ${pct(a[k].med, b[k].med)} |`); lines.push(`| ładowanie ${a.device} CPU ${a.throttle}x | żądania (zewn.) | ${a.requests} (${a.external}) | ${b.requests} (${b.external}) | — |`); });
  for (const k of ['raw', 'gzip', 'brotli']) lines.push(`| wydanie | rozmiar ${k} B | ${A.size[k]} | ${B.size[k]} | ${pct(A.size[k], B.size[k])} |`);
  if (A.session && B.session) {
    const la = A.session.snaps[A.session.snaps.length - 1], lb = B.session.snaps[B.session.snaps.length - 1], fa = A.session.snaps[0], fb = B.session.snaps[0];
    for (const k of ['usedMB', 'nodes', 'listeners', 'intervals', 'timeouts', 'rafs']) lines.push(`| długa sesja (cykl 1 → ${A.session.snaps.length}) | ${k} | ${fa[k]} → ${la[k]} | ${fb[k]} → ${lb[k]} | — |`);
  }
  const text = lines.join('\n');
  fs.mkdirSync(path.join(OUT, 'perf1'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'perf1', `compare-${baseTag}-vs-${candTag}.md`), text + '\n');
  console.log(text);
}


/* ---------------- the suite (gates) ---------------- */
const LAYOUT_PROPS = /^(left|right|top|bottom|width|height|inset|margin|padding|fontSize|lineHeight|borderWidth|minWidth|minHeight|maxWidth|maxHeight)/;
const PERF1_BASE_REV = 'aa4bc7dd0a743987eba04eb2c2f00734da63e626'; // production main before MOBILE-PERF-1

async function bootWith(url, dev, saveOpts, launchOpts = {}) {
  const g = await launch(url, dev, launchOpts);
  if (saveOpts) {
    const save = await makeSave(g.page, saveOpts);
    await g.page.evaluate((s) => { localStorage.setItem('vectorHoleSave_v1', s); }, save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 20000 });
    await g.page.evaluate(() => document.fonts && document.fonts.ready);
    await g.page.addScriptTag({ content: PERF_PAGE });
  }
  return g;
}

async function loadOnce(url, dev, throttle = 1) {
  const browser = await chromium.launch(LAUNCH());
  try {
    const context = await browser.newContext({ viewport: dev.viewport, isMobile: dev.mobile, hasTouch: dev.mobile, deviceScaleFactor: dev.dsf, locale: 'pl-PL' });
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    await context.addInitScript(() => {
      const mark = () => {
        const g = window.game;
        if (g && g.state === 'MENU' && !window.__menuAt) window.__menuAt = performance.now();
        const b = [document.getElementById('btnWelcomePlay'), document.getElementById('btnStart')].find(x => x && x.offsetParent && !x.disabled);
        if (b && g && g.state === 'MENU' && !window.__inputAt) window.__inputAt = performance.now(); // the GRAJ button a player can tap
        if (!window.__inputAt || !window.__menuAt) requestAnimationFrame(mark);
      };
      requestAnimationFrame(mark);
    });
    const page = await context.newPage();
    const reqs = [];
    page.on('request', (q) => reqs.push(q.url()));
    const cdp = await context.newCDPSession(page);
    if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await page.goto(url);
    for (let w = 0; ; w++) {
      if (await page.evaluate(() => !!(window.__inputAt && window.__menuAt)).catch(() => false)) break;
      if (w > 600) throw new Error('load: the menu never became ready (60 s)');
      await new Promise(r => setTimeout(r, 100));
    }
    for (let w = 0; w < 30 && !(await page.evaluate(() => performance.getEntriesByType('paint').some(p => p.name === 'first-contentful-paint'))); w++) await new Promise(r => setTimeout(r, 100));
    const t = await page.evaluate(() => {
      const n = performance.getEntriesByType('navigation')[0];
      const fcp = performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint');
      return { dcl: +n.domContentLoadedEventEnd.toFixed(1), load: +n.loadEventEnd.toFixed(1), fcp: fcp ? +fcp.startTime.toFixed(1) : null, menu: +window.__menuAt.toFixed(1), input: +window.__inputAt.toFixed(1) };
    });
    t.requests = reqs.length;
    t.external = reqs.filter(u => !u.startsWith('http://127.0.0.1')).length;
    return t;
  } finally { await browser.close(); }
}

async function runSuite(url) {
  const results = [];
  const push = (name, ok, details) => results.push(report(name, ok, details));
  const kb = (b) => (b / 1024).toFixed(1) + ' KB';

  // 1. the release: small, self-contained, loads only its own files
  const size = releaseSize(RUN_ROOT);
  push('PERF-1 release: the game references nothing outside its own files', size.external.length === 0, JSON.stringify(size.external));
  push('PERF-1 release: the first download stays small (runtime files <= 520 KB gzip)', size.gzip <= 520 * 1024, `${kb(size.gzip)} gzip · ${kb(size.brotli)} brotli · ${kb(size.raw)} raw (${size.files.map(f => f.path + ' ' + kb(f.gzip)).join(', ')})`);
  const load = await loadOnce(url, PHONE);
  push('PERF-1 load: index.html + its own files only, nothing external, the menu answers', load.external === 0 && load.requests <= 4 && load.input > 0, JSON.stringify(load));
  push('PERF-1 load: menu ready under 4 s on the test machine (phone viewport, no throttling)', load.input < 4000, `first input ${load.input} ms, DCL ${load.dcl} ms`);

  // 2. heavy scenes: the biggest vortex, M59, a late Arena -- complete, no
  // hitches, repeatable. Absolute ms depend on the machine and its power
  // mode (a laptop on battery runs several times slower), so the gates are
  // the game's own JS (update() p99) and hitches relative to the scene's
  // median frame; the before/after numbers come from --bench (paired runs).
  {
    const scene = async (o) => { const g = await bootWith(url, PHONE, { coreLevel: 3, missions: 60, districts: 12 }); try { const r = await g.page.evaluate((o) => window.__perf.run(o), o); r.errors = g.errors.slice(0, 2); return r; } finally { await g.browser.close(); } };
    const smooth = (r) => r.frame.max < r.frame.median * 3 + 40;
    const line = (r) => `update p50 ${r.update.median} p99 ${r.update.p99} · frame p50 ${r.frame.median} p95 ${r.frame.p95} p99 ${r.frame.p99} max ${r.frame.max} ms · r ${r.end.radius}`;
    const maxO = { seed: 777, gfx: 2, ff: 20, bigR: 440, botR: 160, frames: 300, hashEvery: 100 };
    const a = await scene(maxO), b = await scene(maxO);
    push('PERF-1 Arena, the vortex near its maximum + big rivals: 300 frames, update() p99 < 10 ms, no hitch (max < 3x median + 40 ms)', a.frames === 300 && a.update.p99 < 10 && smooth(a), line(a));
    push('PERF-1 rendering is repeatable: the same seed in a fresh page draws and plays the same (state + pixel hashes)', a.hashes.length === 3 && a.hashes.join() === b.hashes.join(), a.hashes.join(' ') + ' vs ' + b.hashes.join(' '));
    const late = await scene({ seed: 4242, gfx: 2, ff: 85, frames: 300 });
    push('PERF-1 late Arena (85-90 s, faster rivals): update() p99 < 10 ms, no hitch', late.frames === 300 && late.update.p99 < 10 && smooth(late), line(late));
    const m59O = { mode: 'campaign', id: 'M59', gfx: 2, ff: 30, frames: 300, hashEvery: 100 };
    const m59 = await scene(m59O), m59b = await scene(m59O);
    push('PERF-1 M59: 300 frames late in the mission, update() p99 < 10 ms, no hitch, repeatable', m59.frames === 300 && m59.update.p99 < 10 && smooth(m59) && m59.hashes.join() === m59b.hashes.join(), line(m59));
    const errs = [a, b, late, m59, m59b].flatMap(r => r.errors);
    push('PERF-1 heavy scenes: no runtime errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  }

  // 3. Core City LVL 6 and the menus: no layout-driving animation, little idle work
  {
    const g = await bootWith(url, PHONE, { coreLevel: 6, missions: 60, districts: 12 });
    await g.cdp.send('Performance.enable');
    const hub = await g.page.evaluate(() => { window.game.showScreen('mainMenu'); return window.__perf.menu({ kind: 'hub', frames: 60 }); });
    push('PERF-1 Core City LVL 6: the city draws every frame without hitches (max < 3x median + 20 ms; ms are reported, see --bench)', hub.canvases === 1 && hub.frame.n === 60 && hub.frame.max < hub.frame.median * 3 + 20, JSON.stringify(hub.frame));
    const scan = async () => g.page.evaluate((re) => {
      const R = new RegExp(re);
      return document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getKeyframes).map(a => {
        const props = new Set(); a.effect.getKeyframes().forEach(k => Object.keys(k).forEach(p => props.add(p)));
        const t = a.effect.target; const bad = [...props].filter(p => R.test(p));
        return bad.length ? `${a.animationName || 'anim'} ${t && (t.id || t.className)}${a.effect.pseudoElement || ''}: ${bad.join(',')}` : null;
      }).filter(Boolean);
    }, LAYOUT_PROPS.source);
    const idle = async () => { await g.page.waitForTimeout(400); const m0 = await metrics(g.cdp); const t0 = Date.now(); await g.page.waitForTimeout(2000); const m1 = await metrics(g.cdp); return diffMetrics(m0, m1, (Date.now() - t0) / 1000); };
    const screens = {};
    for (const id of ['mainMenu', 'campaignScreen', 'shopScreen', 'challengesScreen', 'profileScreen']) {
      await g.page.evaluate((id) => window.game.showScreen(id), id);
      await g.page.waitForTimeout(300);
      screens[id] = await scan();
    }
    push('PERF-1 menus: no running animation moves a layout property (left/top/width/...) on Miasto, Dzielnice, Warsztat, Wyzwania, Profil', Object.values(screens).every(l => l.length === 0), JSON.stringify(screens));
    await g.page.evaluate(() => window.game.showScreen('mainMenu'));
    const hubIdle = await idle();
    push('PERF-1 Miasto idle: no layout every frame (<= 6 layouts in 2 s)', hubIdle.layouts <= 6, JSON.stringify(hubIdle));
    // the pause sheet: the loop is stopped, nothing lays out
    await g.page.evaluate(() => { window.game.startRound({ seed: 5 }); });
    await g.page.waitForTimeout(500);
    await g.page.evaluate(() => window.game.pauseGame());
    const pauseAnims = await scan();
    const pauseIdle = await idle();
    push('PERF-1 pause sheet: no layout-driving animation, <= 6 layouts in 2 s, CPU busy < 10 %', pauseAnims.length === 0 && pauseIdle.layouts <= 6 && pauseIdle.busyPct < 10, JSON.stringify({ pauseAnims, ...pauseIdle }));
    push('PERF-1 menus + pause: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | '));
    await g.browser.close();
  }

  // 4. pause, focus and tab switches: the loop really stops and never restarts by itself
  {
    const g = await bootWith(url, PHONE, { coreLevel: 3, missions: 12, districts: 3 });
    await g.page.evaluate(() => { const gm = window.game; window.__loops = 0; const orig = Object.getPrototypeOf(gm).loop; gm.loop = function (t) { window.__loops++; return orig.call(this, t); }; gm.startRound({ seed: 11 }); });
    await g.page.waitForTimeout(600);
    const s0 = await g.page.evaluate(() => ({ loops: window.__loops, time: window.game.timeRemaining }));
    await g.page.evaluate(() => window.game.pauseGame());
    const s1 = await g.page.evaluate(() => ({ loops: window.__loops, time: window.game.timeRemaining }));
    await g.page.waitForTimeout(700);
    const s2 = await g.page.evaluate(() => ({ loops: window.__loops, time: window.game.timeRemaining, paused: window.game.paused }));
    push('PERF-1 pause: the game loop stops (no frames, the clock stands still)', s0.loops > 5 && s2.loops - s1.loops <= 1 && s2.time === s1.time && s2.paused, JSON.stringify({ s0, s1, s2 }));
    // a tab switch / app switch and back, a window blur and back: still paused
    await g.page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('blur'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    await g.page.waitForTimeout(600);
    const s3 = await g.page.evaluate(() => ({ loops: window.__loops, time: window.game.timeRemaining, paused: window.game.paused }));
    push('PERF-1 coming back from another tab / app / window: no resume by itself', s3.paused && s3.loops - s2.loops <= 1 && s3.time === s2.time, JSON.stringify(s3));
    // 5. a turn / resize on the pause sheet keeps the board drawn (resize clears a canvas)
    const lit = () => g.page.evaluate(() => { const c = window.game.canvas; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, all = 0; for (let i = 0; i < d.length; i += 4 * 97) { all++; if (d[i] + d[i + 1] + d[i + 2] > 60) n++; } return { w: c.width, h: c.height, cssW: window.game.width, cssH: window.game.height, lit: +(n / all).toFixed(3) }; });
    const before = await lit();
    await g.page.setViewportSize({ width: 844, height: 390 });
    await g.page.waitForTimeout(500);
    const turned = await lit();
    await g.page.setViewportSize({ width: 390, height: 844 });
    await g.page.waitForTimeout(500);
    const back = await lit();
    push('PERF-1 a phone turned on the pause sheet: the canvas follows the frame and the board stays drawn under the sheet', turned.cssW === 844 && turned.cssH === 390 && turned.lit > 0.2 && back.cssW === 390 && back.lit > 0.2, JSON.stringify({ before, turned, back }));
    // hidden mid-round pauses; resume runs the round again
    await g.page.evaluate(() => window.game.resumeGame());
    await g.page.waitForTimeout(500);
    const s4 = await g.page.evaluate(() => ({ loops: window.__loops, time: window.game.timeRemaining, paused: window.game.paused }));
    await g.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    const s5 = await g.page.evaluate(() => ({ paused: window.game.paused }));
    await g.page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    push('PERF-1 resume runs the round again; hiding the tab mid-round pauses it', s4.loops - s3.loops > 5 && s4.time < s3.time && !s4.paused && s5.paused, JSON.stringify({ s4, s5 }));
    await g.page.evaluate(() => window.game.resumeGame());
    await g.page.setViewportSize({ width: 844, height: 390 });
    await g.page.waitForTimeout(500);
    const mid = await g.page.evaluate(() => { const gm = window.game; const c = gm.playerScreenCircle(); return { w: gm.width, h: gm.height, x: Math.round(c.x), y: Math.round(c.y), r: Math.round(c.r), running: gm.running && !gm.paused }; });
    push('PERF-1 a phone turned mid-round: the round keeps running in the new frame with the vortex in view', mid.running && mid.w === 844 && mid.x - mid.r >= 0 && mid.x + mid.r <= 844 && mid.y >= 0 && mid.y <= 390, JSON.stringify(mid));
    push('PERF-1 pause / focus / turn: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | '));
    await g.browser.close();
  }

  // 6. a long session: rounds, missions, tabs, turns, tab switches -- nothing piles up
  {
    const sess = await longSession(url, { cycles: 6 });
    const sn = sess.snaps, first = sn[1], last = sn[sn.length - 1];
    push('PERF-1 long session (6 cycles: round + mission + 9 tabs + 6 resizes + tab switch): JS heap after GC grows < 3 MB from cycle 2', last.usedMB - first.usedMB < 3, sn.map(x => x.usedMB).join(' -> ') + ' MB');
    const half = Math.floor(sn.length / 2), maxN = (l) => Math.max(...l.map(x => x.nodes));
    // (node counts swing ~100 with the mission just played -- the busiest
    // cycle of the second half vs the first half, not cycle-to-cycle)
    push('PERF-1 long session: DOM nodes and JS listeners do not pile up', maxN(sn.slice(half)) - maxN(sn.slice(0, half)) <= 60 && last.listeners - first.listeners <= 4, `nodes ${sn.map(x => x.nodes).join(' -> ')} · listeners ${sn.map(x => x.listeners).join(' -> ')}`);
    push('PERF-1 long session: no extra intervals, RAF loops or pending timers', sn.every(x => x.intervals === sn[0].intervals) && last.rafs <= 2 && last.timeouts <= sn[0].timeouts + 3, `intervals ${sn.map(x => x.intervals).join(',')} · rafs ${sn.map(x => x.rafs).join(',')} · timeouts ${sn.map(x => x.timeouts).join(',')}`);
    push('PERF-1 long session: no runtime errors', sess.errors.length === 0, sess.errors.slice(0, 2).join(' | '));
  }

  // 7. the save invariants this stage must not touch
  {
    const src = fs.readFileSync(path.join(RUN_ROOT, 'game.js'), 'utf8');
    push('PERF-1 SAVE: schema version 13 and the save key unchanged', /const SAVE_SCHEMA_VERSION = 13;/.test(src) && /'vectorHoleSave_v1'/.test(src), '');
  }
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PERF-1 checks passed`);
  return results;
}
/** run-all.mjs entry point. */
export const runPerf1Checks = (url) => runSuite(url);

/* ---------------- equivalence: a base revision vs this checkout ---------------- */
function revisionRoot(rev) {
  const dir = path.join(os.tmpdir(), 'vh-perf1-rev-' + rev.slice(0, 12));
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['index.html', 'style.css', 'game.js']) fs.writeFileSync(path.join(dir, f), revisionFile(rev, f));
  return dir;
}

async function frozenShots(url, dev) {
  // Freezes every CSS animation at the same moments in both builds and
  // takes the screen; the canvases are drawn at a fixed time first.
  const g = await bootWith(url, dev, { coreLevel: 4, missions: 60, districts: 12 });
  const shots = {};
  try {
    await g.page.evaluate(() => { window.game.showScreen('mainMenu'); });
    await g.page.waitForTimeout(1500);
    const freeze = (ms) => g.page.evaluate((ms) => {
      const gm = window.game;
      if (gm.screenAnimRaf) { cancelAnimationFrame(gm.screenAnimRaf); gm.screenAnimRaf = null; }
      document.getAnimations().forEach(a => { a.pause(); a.currentTime = ms; });
      if (!document.getElementById('mainMenu').classList.contains('hidden')) gm.renderHubCity(12.5);
    }, ms);
    for (const ms of [500, 1950, 2300, 2700, 3100]) {
      await freeze(ms);
      await g.page.waitForTimeout(80);
      shots['hub@' + ms] = (await g.page.screenshot()).toString('base64');
    }
    await g.page.evaluate(() => { window.__perf.run({ seed: 21, gfx: 2, frames: 30, warm: 30 }); const gm = window.game; gm.running = true; gm.state = GameState.PLAYING; gm.pauseGame(); });
    await g.page.waitForTimeout(500);
    for (const ms of [500, 2300, 2900]) {
      await freeze(ms);
      await g.page.waitForTimeout(80);
      shots['pause@' + ms] = (await g.page.screenshot()).toString('base64');
    }
  } finally { await g.browser.close(); }
  return shots;
}

async function pngDiff(a, b) {
  // Decodes both PNGs in a blank page and counts differing pixels.
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    return await page.evaluate(async ([a, b]) => {
      const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { sameSize: false };
      const px = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
      const da = px(ia), db = px(ib);
      let diff = 0, maxd = 0;
      for (let i = 0; i < da.length; i += 4) { const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])); if (d > 0) diff++; if (d > maxd) maxd = d; }
      return { sameSize: true, pixels: da.length / 4, diff, diffPct: +(diff / (da.length / 4) * 100).toFixed(4), maxChannelDiff: maxd };
    }, [a, b]);
  } finally { await browser.close(); }
}

async function equiv(urlBase, urlCand, rev) {
  const out = { base: rev, candidate: 'working tree', canvas: {}, menus: {}, css: {}, saves: {} };
  const parts = arg('only') ? String(arg('only')).split(',') : ['canvas', 'menus', 'css', 'saves'];
  const pick = !parts.includes('canvas') ? [] : ['arena-first', 'arena-late', 'arena-max', 'arena-poki', 'arena-gfx0', 'm01', 'm59', 'm-boss', 'm-final'];
  for (const id of pick) {
    const sc = SCENARIOS.find(x => x.id === id);
    const res = [];
    for (const url of [urlBase, urlCand]) {
      const g = await bootWith(url, sc.dev, sc.fresh ? null : { coreLevel: 3, missions: 60, districts: 12 });
      const o = { ...sc.o, frames: 600, hashEvery: 150 };
      if (o.mode === 'campaign') o.id = await resolveMission(g.page, o.id);
      res.push(await g.page.evaluate((o) => window.__perf.run(o), o));
      await g.browser.close();
    }
    out.canvas[id] = { same: res[0].hashes.join() === res[1].hashes.join(), base: res[0].hashes, cand: res[1].hashes };
    console.log(`  equiv ${id.padEnd(14)} ${out.canvas[id].same ? 'IDENTICAL' : 'DIFFERENT'}  ${res[1].hashes.join(' ')}`);
  }
  for (const m of parts.includes('menus') ? MENUS : []) {
    const res = [];
    for (const url of [urlBase, urlCand]) {
      const g = await bootWith(url, PHONE, { coreLevel: m.core, missions: 120, districts: 12 });
      await g.page.evaluate((id) => window.game.showScreen(id), m.screen);
      await g.page.waitForTimeout(400);
      res.push(await g.page.evaluate((kind) => {
        const gm = window.game; if (gm.screenAnimRaf) { cancelAnimationFrame(gm.screenAnimRaf); gm.screenAnimRaf = null; }
        const fns = { hub: (t) => gm.renderHubCity(t), districts: (t) => gm.renderDistrictTiles(t), warsztat: (t) => gm.renderWarsztatCanvases(t), daily: (t) => gm.renderDailyMap(t) };
        const sel = { hub: '#hubCityCanvas', districts: '#districtMap canvas.district-tile-canvas', warsztat: '#shopScreen canvas', daily: '#dailyMapCanvas' }[kind];
        const hashes = [];
        for (const t of [3, 7.25, 12.5, 19.9]) { fns[kind](t); hashes.push(Array.from(document.querySelectorAll(sel)).filter(c => c.width).map(c => window.__perf.pixelHash(c)).join('.')); }
        return hashes;
      }, m.kind));
      await g.browser.close();
    }
    out.menus[m.id] = { same: res[0].join() === res[1].join(), base: res[0], cand: res[1] };
    console.log(`  equiv ${m.id.padEnd(14)} ${out.menus[m.id].same ? 'IDENTICAL' : 'DIFFERENT'}`);
  }
  for (const dev of parts.includes('css') ? [PHONE, POKI] : []) {
    const a = await frozenShots(urlBase, dev), b = await frozenShots(urlCand, dev);
    for (const k of Object.keys(a)) {
      const d = await pngDiff(a[k], b[k]);
      out.css[dev.name + ' ' + k] = d;
      console.log(`  equiv css ${dev.name} ${k}: ${JSON.stringify(d)}`);
    }
  }
  // the save after a seeded round and a seeded mission
  for (const [id, o] of !parts.includes('saves') ? [] : [['arena-round', { seed: 4242, gfx: 2 }], ['mission-M01', { mode: 'campaign', id: 'M01', gfx: 2 }], ['mission-M59', { mode: 'campaign', id: 'M59', gfx: 2 }]]) {
    const res = [];
    for (const url of [urlBase, urlCand]) {
      const g = await bootWith(url, PHONE, { coreLevel: 3, missions: 60, districts: 12 });
      const r = await g.page.evaluate((o) => window.__perf.playToEnd(o), o);
      await g.page.waitForTimeout(300);
      r.save = await g.page.evaluate(() => localStorage.getItem('vectorHoleSave_v1'));
      res.push(r);
      await g.browser.close();
    }
    const flat = (j) => { const o = {}; const walk = (v, p) => { if (v && typeof v === 'object') { for (const k of Object.keys(v)) walk(v[k], p ? p + '.' + k : k); } else o[p] = v; }; walk(JSON.parse(j), ''); return o; };
    const fa = flat(res[0].save), fb = flat(res[1].save);
    const diffs = [...new Set([...Object.keys(fa), ...Object.keys(fb)])].filter(k => JSON.stringify(fa[k]) !== JSON.stringify(fb[k]));
    out.saves[id] = { same: diffs.length === 0, result: { base: { score: res[0].score, state: res[0].state }, cand: { score: res[1].score, state: res[1].state } }, diffs: diffs.slice(0, 20).map(k => `${k}: ${JSON.stringify(fa[k])} vs ${JSON.stringify(fb[k])}`) };
    console.log(`  equiv save ${id}: ${diffs.length === 0 ? 'IDENTICAL' : 'DIFFERENT ' + diffs.slice(0, 6).join(', ')} (score ${res[0].score} vs ${res[1].score})`);
  }
  fs.mkdirSync(path.join(OUT, 'perf1'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'perf1', 'equiv.json'), JSON.stringify(out, null, 1));
  console.log('equiv -> qa/out/perf1/equiv.json');
  return out;
}

export { loadOnce, runSuite, equiv, PERF1_BASE_REV, PERF_PAGE, LEAK_PROBE, launch, makeSave, heap, metrics, diffMetrics, bench, profile, compare, releaseSize, longSession, realtimeOnce, SCENARIOS, PHONE, DESKTOP, POKI };

if (isMain(import.meta.url)) {
  (async () => {
    if (arg('compare')) { const [a, b] = String(arg('compare')).split(','); compare(a, b); return; }
    const srv = await serve({ root: RUN_ROOT });
    try {
      if (arg('profile')) { await profile(srv.url, arg('profile') === true ? 'arena-max' : arg('profile')); return; }
      if (arg('bench')) {
        const targets = [];
        let pairSrv = null;
        if (arg('pair')) {
          // --pair=DIR: DIR (the base) and this checkout, alternating inside every repetition
          const pr = path.resolve(String(arg('pair')));
          pairSrv = await serve({ root: pr });
          targets.push({ tag: String(arg('pairtag', 'base')) + (GPU ? '-gpu' : ''), url: pairSrv.url, root: pr, outDir: path.join(OUT, 'perf1', String(arg('pairtag', 'base')) + (GPU ? '-gpu' : '')) });
        }
        targets.push({ tag: TAG + (GPU ? '-gpu' : ''), url: srv.url, root: RUN_ROOT, outDir: OUT_DIR });
        try { await bench(targets); } finally { if (pairSrv) pairSrv.server.close(); }
        return;
      }
      if (arg('equiv')) {
        const rev = arg('equiv') === true ? PERF1_BASE_REV : String(arg('equiv'));
        const baseSrv = await serve({ root: revisionRoot(rev) });
        try { await equiv(baseSrv.url, srv.url, rev); } finally { baseSrv.server.close(); }
        return;
      }
      const res = await runSuite(srv.url);
      process.exitCode = res.every(r => r.ok) ? 0 : 1;
    } finally { srv.server.close(); }
  })().catch((e) => { console.error(e); process.exit(1); });
}
