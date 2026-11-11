// GG-VISUAL-02 -- "Premium Vector City" (A2.1) floor. What this suite proves:
//  - V2-1 the shipped floor IS the approved prototype: every Arena block and
//    every Campaign district block painted by game.js is pixel-identical to
//    the same block painted by design/visual2/gg-visual2-a2.js (A2.1, the
//    owner-approved reference) spliced over the same game.js, at 1x and 2x,
//    rich and plain (gfx 0);
//  - V2-2 12 districts x 3 compositions: every district's three lot
//    compositions are different pictures, and so are all 36;
//  - V2-3 the floor never touches the round: the round's RNG (game.rng seed),
//    Math.random, the objects' layout and the save are the same before and
//    after thousands of block paints;
//  - V2-4 quality: gfx 2 -> 0 -> 2 repaints the blocks in view lazily (<= the
//    frame's budget), plain chunks are cheaper than rich ones, nothing throws;
//  - V2-5 zoom: every resolution step paints and blits, a still frame repaints
//    nothing, the cache stays inside its pixel budget;
//  - V2-6 all four modes draw it: Arena, Daily, a friend's challenge and a
//    Campaign mission of every district show the new floor (and the old
//    CITY_LOT_* tables are gone from the source).
// Usage: node qa/visual2.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { serve, openGame, allDistrictsSave, report, expectAll, is, truthy, holds, frozenDateScript, QA_RANDOM, ROOT, DISTRICT_IDS_ALL, isMain } from './lib.mjs';

const PROTO = path.join(ROOT, 'design', 'visual2', 'gg-visual2-a2.js');
const ARENA_SEED = 20261111;

/** A page running game.js with the A2.1 prototype spliced over it (the oracle). */
async function openOracle(url, viewport, extra = {}) {
  const g = await openGame(url, { viewport, mobile: false, deviceScaleFactor: 1, initScript: `${QA_RANDOM}\nwindow.__GG_VISUAL = 'A2.1';`, ...extra });
  return g;
}
async function spliceRoute(context) {
  const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
  const at = src.lastIndexOf('\nexport {');
  const body = src.slice(0, at) + '\n' + fs.readFileSync(PROTO, 'utf8') + '\n' + src.slice(at);
  await context.route('**/game.js', (route) => route.fulfill({ contentType: 'text/javascript', body }));
}
async function bootWithSave(g) {
  const save = await allDistrictsSave(g.page);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
}

/** In-page: hashes of chunks. keys = [[theme|null, i, j]], scale, rich. */
const CHUNK_HASHES = `(keys, scale, rich, crop) => {
  const floor = SCREEN_FLOOR;
  floor.rich = rich;
  if (window.__GV2 && window.__GV2.setDetail) window.__GV2.setDetail(rich ? 2 : 0);
  const out = [];
  for (const [theme, i, j] of keys) {
    const e = floor.render(i, j, scale, theme, null);
    const cv = e.canvas, ctx = cv.getContext('2d');
    const x = crop ? Math.round(crop[0] * scale) : 0, y = crop ? Math.round(crop[1] * scale) : 0;
    const w = crop ? Math.round(crop[2] * scale) : cv.width, h = crop ? Math.round(crop[3] * scale) : cv.height;
    const d = ctx.getImageData(x, y, w, h).data;
    let a = 0x811c9dc5, b = 0x01000193 ^ 0xdeadbeef;
    for (let k = 0; k < d.length; k += 4) { a = Math.imul(a ^ d[k], 16777619); b = Math.imul(b + d[k + 1] * 31 + d[k + 2] * 131 + d[k + 3], 2246822519) ^ (b >>> 13); }
    out.push((a >>> 0).toString(16) + (b >>> 0).toString(16));
  }
  floor.clearChunks();
  return out;
}`;

const ARENA_KEYS = []; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) ARENA_KEYS.push([null, i, j]);
const THEME_KEYS = (ids, cells) => ids.flatMap(id => cells.map(([i, j]) => [id, i, j]));
const ALL_CELLS = []; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) ALL_CELLS.push([i, j]);

export async function runVisual2Checks() {
  const results = [];
  const { server, url } = await serve();
  const VP = { width: 1366, height: 768 };
  try {
    // ---- V2-1: the shipped floor equals the approved prototype ------------
    const cand = await openGame(url, { viewport: VP, mobile: false, deviceScaleFactor: 1, initScript: QA_RANDOM });
    const orac = await openOracle(url, VP);
    await spliceRoute(orac.context);
    await orac.page.reload();
    await orac.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
    const oracleOn = await orac.page.evaluate(() => !!window.__GV2 && window.__GV2.style === 'A2.1');
    results.push(report('V2-1 the oracle page really runs the A2.1 prototype over game.js', oracleOn, String(oracleOn)));
    const sets = [
      ['Arena, all 64 blocks, 1x rich', ARENA_KEYS, 1, true],
      ['Arena, all 64 blocks, 2x rich', ARENA_KEYS, 2, true],
      ['Arena, all 64 blocks, 1x plain (gfx 0)', ARENA_KEYS, 1, false],
      ['12 districts x 64 blocks, 1x rich', THEME_KEYS(DISTRICT_IDS_ALL, ALL_CELLS), 1, true],
      ['12 districts x 16 blocks, 2x rich', THEME_KEYS(DISTRICT_IDS_ALL, ALL_CELLS.filter((_, k) => k % 4 === 1)), 2, true],
      ['12 districts x 16 blocks, 1x plain (gfx 0)', THEME_KEYS(DISTRICT_IDS_ALL, ALL_CELLS.filter((_, k) => k % 4 === 2)), 1, false]
    ];
    for (const [label, keys, scale, rich] of sets) {
      const call = `(${CHUNK_HASHES})(${JSON.stringify(keys)}, ${scale}, ${rich}, null)`;
      const a = await cand.page.evaluate(call);
      const b = await orac.page.evaluate(call);
      const bad = a.map((h, k) => h === b[k] ? -1 : k).filter(k => k >= 0);
      results.push(expectAll(`V2-1 ${label}: pixel-identical to the approved A2.1 prototype`, {
        same: is(bad.length, 0), count: truthy(a.length === keys.length)
      }, `${keys.length} blocks` + (bad.length ? ` first different: ${JSON.stringify(keys[bad[0]])}` : '')));
    }

    // ---- V2-2: 12 districts x 3 compositions ------------------------------
    // The lot's composition (0-2) is rolled from cityHash(i, j, 2) -- repeated
    // here to pick one block per composition. The lot interior (the part no
    // lamp, road or sign reaches) is cropped and hashed.
    const picks = await cand.page.evaluate((ids) => {
      const hash = (i, j, k) => { let h = Math.imul(i + 101, 73856093) ^ Math.imul(j + 211, 19349663) ^ Math.imul(k + 7, 83492791); h = Math.imul(h ^ (h >>> 15), 2246822519); return (h ^ (h >>> 13)) >>> 0; };
      const roll = (i, j) => Math.floor(new SeededRNG(hash(i, j, 2)).next() * 3);
      const byVariant = [[], [], []];
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) byVariant[roll(i, j)].push([i, j]);
      return { counts: byVariant.map(v => v.length), first: byVariant.map(v => v[0]) };
    }, DISTRICT_IDS_ALL);
    results.push(expectAll('V2-2 the 8x8 grid rolls all three compositions (a block of each exists)', {
      v0: truthy(picks.counts[0] > 0), v1: truthy(picks.counts[1] > 0), v2: truthy(picks.counts[2] > 0)
    }, JSON.stringify(picks.counts)));
    // Crop in chunk space: the lot starts B + R/2 + WALK = 2 + 32 + 20 = 54 in, 271 wide; stay 14 inside.
    const CROP = [70, 70, 240, 240];
    const sig = {};
    for (const id of DISTRICT_IDS_ALL) {
      const keys = picks.first.map(([i, j]) => [id, i, j]);
      sig[id] = await cand.page.evaluate(`(${CHUNK_HASHES})(${JSON.stringify(keys)}, 1, true, ${JSON.stringify(CROP)})`);
    }
    const perDistrict = Object.fromEntries(DISTRICT_IDS_ALL.map(id => [id, new Set(sig[id]).size]));
    results.push(expectAll('V2-2 every district has 3 different lot compositions', Object.fromEntries(DISTRICT_IDS_ALL.map(id => [id, is(perDistrict[id], 3)])), JSON.stringify(perDistrict)));
    const all = new Set(Object.values(sig).flat());
    results.push(report('V2-2 all 36 compositions (12 districts x 3) are different pictures', all.size === 36, `${all.size} distinct`));

    // ---- V2-3: the floor never touches the round --------------------------
    const rngProbe = await cand.page.evaluate(async (seed) => {
      window.__qaSeedRandom(3);
      const g = window.game;
      g.startRound({ seed });
      if (g.rafId) cancelAnimationFrame(g.rafId);
      g.running = false;
      const state = () => ({ rngSeed: g.rng.seed, calls: window.__qaRandomCalls, objects: g.objects.length, save: localStorage.getItem('vectorHoleSave_v1') });
      const layout = () => { let h = 0x811c9dc5; for (const o of g.objects) for (const v of [Math.round(o.x * 100), Math.round(o.y * 100), Math.round(o.radius * 100)]) { h ^= v; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
      const before = state(), lay0 = layout();
      const keys = []; for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) keys.push(i + ',' + j);
      let paints = 0;
      for (let rep = 0; rep < 12; rep++) for (const k of keys) { const [i, j] = k.split(',').map(Number); SCREEN_FLOOR.render(i, j, [1, 1.5, 2][rep % 3], rep % 2 ? null : DISTRICTS[rep % 6].id, null); paints++; }
      SCREEN_FLOOR.clearChunks();
      for (let f = 0; f < 90; f++) g.render(performance.now() / 1000 + f / 60);
      const after = state(), lay1 = layout();
      return { before, after, lay0, lay1, paints };
    }, ARENA_SEED);
    results.push(expectAll('V2-3 painting the floor leaves the round\'s RNG, Math.random, layout and save untouched', {
      rngSeed: is(rngProbe.after.rngSeed, rngProbe.before.rngSeed),
      mathRandom: is(rngProbe.after.calls, rngProbe.before.calls),
      objects: is(rngProbe.after.objects, rngProbe.before.objects),
      layout: is(rngProbe.lay1, rngProbe.lay0),
      save: is(rngProbe.after.save, rngProbe.before.save)
    }, `${rngProbe.paints} block paints + 90 frames; layout ${rngProbe.lay0}`));

    // ---- V2-4: quality levels ---------------------------------------------
    const q = await cand.page.evaluate(async (seed) => {
      const g = window.game;
      g.startRound({ seed });
      if (g.rafId) cancelAnimationFrame(g.rafId);
      g.running = false;
      const p = g.player; p.x = 600; p.y = 640;
      g.followCamera(0, 0, WORLD_W, WORLD_H);
      const real = window.__realNow || (window.__realNow = performance.now.bind(performance));
      const frame = () => g.render(1000);
      const inView = () => { const f = g.cityFloor; return [...f.cache.values()].filter(e => e.frame === f.frame); };
      const run = (n) => { let max = 0; for (let k = 0; k < n; k++) { const r0 = g.cityFloor.renders; frame(); max = Math.max(max, g.cityFloor.renders - r0); } return max; };
      g.applyGfx(2); run(30);
      const rich2 = inView().every(e => e.rich === true), n2 = inView().length;
      const costRich = (() => { const t = []; for (let k = 0; k < 12; k++) { const t0 = real(); g.cityFloor.render(1, 1, 1, null, null); g.ctx.getImageData(0, 0, 1, 1); t.push(real() - t0); } t.sort((a, b) => a - b); return t[6]; })();
      const before = g.cityFloor.renders;
      g.applyGfx(0);
      const maxPaintsDown = run(1);
      run(30);
      const plain0 = inView().every(e => e.rich === false);
      const repaintsDown = g.cityFloor.renders - before;
      const still0 = run(20);
      const costPlain = (() => { const t = []; for (let k = 0; k < 12; k++) { const t0 = real(); g.cityFloor.render(1, 1, 1, null, null); g.ctx.getImageData(0, 0, 1, 1); t.push(real() - t0); } t.sort((a, b) => a - b); return t[6]; })();
      const mid = g.cityFloor.renders;
      g.applyGfx(2); run(40);
      const rich3 = inView().every(e => e.rich === true);
      const still2 = run(20);
      return { rich2, n2, plain0, rich3, maxPaintsDown, repaintsDown, still0, still2, costRich: +costRich.toFixed(2), costPlain: +costPlain.toFixed(2), upRepaints: g.cityFloor.renders - mid, budgetOk: g.cityFloor.pixels <= Math.max(10e6, 1) };
    }, ARENA_SEED);
    results.push(expectAll('V2-4 quality: gfx 2 -> 0 -> 2 repaints the blocks in view (plain, then rich again), then goes still', {
      richAtStart: is(q.rich2, true), plainAfterDown: is(q.plain0, true), richAfterUp: is(q.rich3, true),
      downBounded: truthy(q.maxPaintsDown <= Math.max(2, q.n2)), stillAtGfx0: is(q.still0, 0), stillAtGfx2: is(q.still2, 0), cache: is(q.budgetOk, true)
    }, JSON.stringify(q)));
    results.push(report('V2-4 a plain (gfx 0) block paints faster than a rich one', q.costPlain <= q.costRich * 1.1, `${q.costPlain} ms vs ${q.costRich} ms (1x)`));

    // ---- V2-5: zoom steps -------------------------------------------------
    const z = await cand.page.evaluate(async (seed) => {
      const g = window.game;
      g.applyGfx(2);
      g.startRound({ seed });
      if (g.rafId) cancelAnimationFrame(g.rafId);
      g.running = false;
      const rows = [];
      for (const zoom of [0.3, 0.5, 0.75, 1, 1.5, 2.2]) {
        g.zoom = zoom;
        g.followCamera(0, 0, WORLD_W, WORLD_H);
        for (let k = 0; k < 40; k++) g.render(1000);
        const r0 = g.cityFloor.renders;
        for (let k = 0; k < 20; k++) g.render(1000);
        const f = g.cityFloor;
        rows.push({ zoom, still: f.renders - r0, chunks: f.cache.size, mpx: +(f.pixels / 1e6).toFixed(2) });
      }
      return rows;
    }, ARENA_SEED);
    results.push(expectAll('V2-5 zoom 0.3-2.2: every step paints, a still frame repaints nothing, the cache stays in its budget', {
      still: truthy(z.every(r => r.still === 0)), chunks: truthy(z.every(r => r.chunks > 0)), budget: truthy(z.every(r => r.mpx <= 12))
    }, JSON.stringify(z)));
    results.push(report('V2-4/5 no page or console errors across all of the above', cand.errors.length === 0 && orac.errors.length === 0, [...cand.errors, ...orac.errors].join(' | ').slice(0, 300)));
    await cand.browser.close();
    await orac.browser.close();

    // ---- V2-6: all four modes draw it -------------------------------------
    const modes = await openGame(url, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, initScript: `${frozenDateScript('2026-11-11T10:00:00Z')}\n${QA_RANDOM}` });
    await bootWithSave(modes);
    const probe = await modes.page.evaluate(async () => {
      const g = window.game;
      const calls = [];
      const orig = g.cityFloor.render.bind(g.cityFloor);
      g.cityFloor.render = function (i, j, scale, theme, old) { calls.push(theme || '*'); return orig(i, j, scale, theme, old); };
      const sample = () => { const f = g.cityFloor; const e = [...f.cache.values()].pop(); const d = e.canvas.getContext('2d').getImageData(Math.round(e.canvas.width * 0.5), Math.round(e.canvas.height * 0.5), 1, 1).data; return [...d.slice(0, 3)]; };
      const out = {};
      const settle = async (fn) => { fn(); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; for (let k = 0; k < 30; k++) (g.mode === 'campaign' ? g.renderCampaign(1000) : g.render(1000)); };
      for (const [name, fn] of [
        ['arena', () => g.startRound({ seed: 11 })],
        ['daily', () => g.startDailyChallenge()],
        ['challenge', () => g.startRound({ seed: 12, challenge: { score: 100, from: 'QA' } })]
      ]) { calls.length = 0; g.cityFloor.clearChunks(); await settle(fn); out[name] = { themes: [...new Set(calls)], painted: calls.length > 0 }; }
      return out;
    });
    results.push(expectAll('V2-6 Arena, Daily and a friend\'s challenge paint the district map; no mode keeps the old floor', {
      arena: truthy(probe.arena.painted && probe.arena.themes.join() === '*'),
      daily: truthy(probe.daily.painted && probe.daily.themes.join() === '*'),
      challenge: truthy(probe.challenge.painted && probe.challenge.themes.join() === '*')
    }, JSON.stringify(probe)));
    const camp = await modes.page.evaluate(async () => {
      const g = window.game;
      const out = {};
      for (const d of DISTRICTS) {
        const first = d.missions[0];
        g.missionBoosters = [];
        g.cityFloor.clearChunks();
        const calls = [];
        const orig = g.cityFloor.render.bind(g.cityFloor);
        g.cityFloor.render = function (i, j, scale, theme, old) { calls.push(theme); return orig(i, j, scale, theme, old); };
        g.startCampaignMission(first); if (g.introPending) g.beginMissionPlay();
        if (g.rafId) cancelAnimationFrame(g.rafId);
        g.running = false;
        for (let k = 0; k < 20; k++) g.renderCampaign(1000);
        out[d.id] = { theme: [...new Set(calls)].join(), mission: first };
        g.cityFloor.render = orig;
      }
      return out;
    });
    results.push(expectAll('V2-6 a Campaign mission of each of the districts paints its own district\'s floor', Object.fromEntries(Object.entries(camp).map(([id, r]) => [id, is(r.theme, id)])), JSON.stringify(camp)));
    results.push(report('V2-6 no page or console errors in the four modes', modes.errors.length === 0, modes.errors.join(' | ').slice(0, 300)));
    await modes.browser.close();

    const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
    results.push(expectAll('V2-6 source: the old lot painters are gone and the floor has one painter (CITY_ART)', {
      noOldTable: is(/CITY_LOT_PAINTERS|CITY_LOT_BASE/.test(src), false),
      oneArt: is((src.match(/const CITY_ART = /g) || []).length, 1),
      noCanvasHook: is(/Object\.defineProperty\(c, k,/.test(src), false),
      noProtoGate: is(/__GG_VISUAL/.test(src), false)
    }, 'game.js'));
  } finally { server.close(); }
  return results;
}

if (isMain(import.meta.url)) {
  const r = await runVisual2Checks();
  const bad = r.filter(x => !x.ok);
  console.log(`\n${r.length - bad.length}/${r.length} GG-VISUAL-02 checks passed`);
  process.exit(bad.length ? 1 : 0);
}
