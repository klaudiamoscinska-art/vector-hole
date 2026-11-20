// GG-OBJECTS-RASTER-02: the 21 approved Arena object sprites (T1-T6) as WebP bitmaps (objects-raster-2.js / objects-raster-3.js).
// Compares THIS checkout (AFTER) with a base checkout (BEFORE, --base=DIR, a git worktree of origin/main):
//  - OR-1 the two modules hold exactly the 21 kinds; every bitmap is a WebP that decodes at 2*ceil(1.5*r+6)*quality px (r = the real TIERS radius
//         read from the running game), transparent corners, content inside the envelope (2.1 r x 2.48 r) and centred; (--pack) the bytes the
//         package cut for the right radius equal its manifest SHA-256
//  - OR-2 the logical world is unchanged: every Arena object (all own fields: kind, tier, position, radius, value, seed...) and bot, the RNG
//         draw count, for 3 seeds + Daily; every one of the 240 campaign missions' entities
//  - OR-3 fallback = the base: broken images, gfx 0, and the first paint before any decode draw pixel-identical frames to the base
//  - OR-4 selective cache: a decode replaces no sprite-cache entry and no floor chunk; quality 0 drops both bitmap sets; a switch keeps one set
//  - OR-5 only the Arena's WorldObject asks for a bitmap: Campaign missions and the menu load none and draw frames identical to the base
//  - OR-6 the raster flag appears exactly where the Arena draws a WorldObject (static check of game.js)
// Usage: node qa/objraster2.mjs --base=../vh-objr-base [--pack=DIR]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { serve, report, ROOT, isMain } from './lib.mjs';
import { exportedRoot, session, stageScene } from './objraster2-shots.mjs';

const KINDS = ['fragment', 'kapsula', 'lawka', 'kiosk', 'skrzynia', 'latarnia', 'drzewo', 'znacznik', 'samochod', 'wezel', 'pylon', 'pawilon', 'billboard', 'magazyn', 'landmark', 'autobus', 'tramwaj', 'ciezarowka', 'wiezowiec', 'maszt', 'kopula'];
const ENV_W = 2.1, ENV_H = 2.48;

const urlsOf = (file) => Object.fromEntries([...fs.readFileSync(path.join(ROOT, file), 'utf8').matchAll(/^\s+(\w+): '(data:image\/webp;base64,[^']+)'/gm)].map(m => [m[1], m[2]]));

/** Decode every bitmap in the page; real radii come from the running game's TIERS. */
async function decodeAll(page, sets) {
  return page.evaluate(async (sets) => {
    const radius = {};
    for (const t of Object.values(TIERS)) if (t.minR === t.maxR) for (const k of t.subtypes) radius[k] = t.minR;
    const out = {};
    for (const [q, list] of Object.entries(sets)) {
      for (const [k, u] of Object.entries(list)) {
        const im = new Image(); im.src = u; await im.decode();
        const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
        const c = cv.getContext('2d'); c.drawImage(im, 0, 0);
        const W = cv.width, H = cv.height, d = c.getImageData(0, 0, W, H).data;
        let x0 = W, y0 = H, x1 = -1, y1 = -1;
        for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (d[(j * W + i) * 4 + 3] > 8) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
        const a = (x, y) => d[(y * W + x) * 4 + 3];
        out[q + ':' + k] = { w: W, h: H, r: radius[k], box: [x0, y0, x1 - x0 + 1, y1 - y0 + 1], corners: [a(0, 0), a(W - 1, 0), a(0, H - 1), a(W - 1, H - 1)], edgeMax: Math.max(...Array.from({ length: W }, (_, i) => Math.max(a(i, 0), a(i, H - 1), a(0, i), a(W - 1, i)))) };
      }
    }
    return { out, radius };
  }, sets);
}

/** FNV hash of every own primitive field of every object / bot / campaign entity after the round / mission starts. */
const WORLD = `(async (arg) => {
  const g = window.game, res = {};
  const fnv = (s) => { let a = 0x811c9dc5; for (let i = 0; i < s.length; i++) a = Math.imul(a ^ s.charCodeAt(i), 16777619); return (a >>> 0).toString(16); };
  const dump = (o) => JSON.stringify(Object.keys(o).sort().filter(k => !/At$/.test(k) && ['number', 'string', 'boolean'].includes(typeof o[k])).map(k => [k, typeof o[k] === 'number' ? Math.round(o[k] * 1000) / 1000 : o[k]]));
  const stop = () => { if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; };
  for (const seed of arg.seeds) {
    window.__qaSeedRandom(seed);
    g.startRound({ seed }); stop();
    for (let k = 0; k < 30; k++) g.update(1 / 60);
    res['arena-' + seed] = { n: g.objects.length, hash: fnv(g.objects.map(dump).join('|') + '#' + g.bots.map(dump).join('|')), random: window.__qaRandomCalls };
  }
  window.__qaSeedRandom(5); g.startDailyChallenge(); stop();
  for (let k = 0; k < 30; k++) g.update(1 / 60);
  res.daily = { n: g.objects.length, hash: fnv(g.objects.map(dump).join('|')), random: window.__qaRandomCalls };
  let n = 0, all = '';
  for (const def of CAMPAIGN_MISSIONS) {
    window.__qaSeedRandom(11);
    g.missionBoosters = []; g.startCampaignMission(def.id); if (g.introPending) g.beginMissionPlay(); stop();
    const h = fnv(g.campaignEntities.map(dump).join('|'));
    all += def.id + ':' + g.campaignEntities.length + ':' + h + ';'; n++;
  }
  res.campaign = { missions: n, hash: fnv(all) };
  return res;
})`;

async function world(url) {
  const g = await session(url, 'pc');
  const r = await g.page.evaluate(`${WORLD}({ seeds: [2024, 7, 99001] })`);
  await g.browser.close();
  return r;
}

/** Hash of the whole game canvas after painting the scene. */
const HASH = `(() => { const c = window.game.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let a = 0x811c9dc5; for (let i = 0; i < d.length; i += 1) a = Math.imul(a ^ d[i], 16777619); return (a >>> 0).toString(16); })()`;
const PAINT = `(() => { for (let k = 0; k < 6; k++) window.game.render(window.performance.now() / 1000); })()`;
let BREAK = '';   // set in run(): breaks exactly the 42 object bitmaps (matched by the tail of their data URL), never a floor texture

async function frames(url, { init = null, gfx = 2, wait = 1800, immediate = false } = {}) {
  const out = { errors: 0 };
  // immediate = the very first paint of a fresh page (nothing decoded yet): one session per sector
  let g = null;
  for (const sector of ['p', 'R']) {
    if (!g || immediate) {
      if (g) await g.browser.close();
      g = await session(url, 'pc');
      if (init) { await g.page.addInitScript(init); await g.page.reload(); await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); }
    }
    await stageScene(g.page, { sector, staged: true, zoom: 0.62, gfx });
    if (immediate) out[sector] = await g.page.evaluate(`${PAINT}; ${HASH}`);
    else { await g.page.evaluate(PAINT); await g.page.waitForTimeout(wait); await g.page.evaluate(PAINT); out[sector] = await g.page.evaluate(HASH); }
    out.errors += g.errors.length;
  }
  await g.browser.close();
  return out;
}

export async function run(url, baseUrl, pack) {
  const results = [];
  const r2 = urlsOf('objects-raster-2.js'), r3 = urlsOf('objects-raster-3.js');
  const tails = [...Object.values(r2), ...Object.values(r3)].map(u => u.slice(-60));
  BREAK = `(() => { const T = new Set(${JSON.stringify(tails)}); const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); Object.defineProperty(HTMLImageElement.prototype, 'src', { set(v) { v = String(v); d.set.call(this, T.has(v.slice(-60)) ? 'data:image/webp;base64,AAAA' : v); }, get() { return d.get.call(this); } }); })();`;
  const g0 = await session(url, 'pc');
  const dec = await decodeAll(g0.page, { 2: r2, 3: r3 });
  await g0.browser.close();
  const keys2 = Object.keys(r2).sort().join(), keys3 = Object.keys(r3).sort().join(), want = [...KINDS].sort().join();
  const bad = [];
  for (const [id, e] of Object.entries(dec.out)) {
    const [q, k] = id.split(':'), Q = +q, r = e.r, D = 2 * Math.ceil(1.5 * r + 6) * Q;
    const okDim = e.w === D && e.h === D;
    const okCorner = e.corners.every(v => v === 0) && e.edgeMax === 0;
    const bw = e.box[2], bh = e.box[3];
    const okEnv = bw <= Math.ceil(ENV_W * r * Q) + 3 && bh <= Math.ceil(ENV_H * r * Q) + 3 && bw > 4 && bh > 4;
    const cx = e.box[0] + bw / 2, okCentre = Math.abs(cx - D / 2) <= Math.max(4, D * 0.03);
    if (!(okDim && okCorner && okEnv && okCentre)) bad.push(`${id} r=${r} ${e.w}x${e.h} want ${D} box ${e.box} corners ${e.corners}`);
  }
  const riff = [...Object.values(r2), ...Object.values(r3)].every(u => { const b = Buffer.from(u.split(',')[1], 'base64'); return b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'; });
  results.push(report('OR-1 21/21 kinds in both modules, WebP RGBA; every canvas = 2*ceil(1.5r+6)*quality with the real TIERS radius, transparent edges, content inside 2.1r x 2.48r and centred', keys2 === want && keys3 === want && riff && Object.keys(dec.out).length === 42 && bad.length === 0, `${Object.keys(dec.out).length} bitmaps; radii ${JSON.stringify(dec.radius)}; ${bad.length ? bad.join(' | ') : 'all within the envelope'}`));
  if (pack) {
    const sums = Object.fromEntries(fs.readFileSync(path.join(pack, 'SHA256SUMS.txt'), 'utf8').trim().split(/\r?\n/).map(l => { const m = /^([0-9a-f]{64})  (.+)$/.exec(l); return [m[2], m[1]]; }));
    const man = JSON.parse(fs.readFileSync(path.join(pack, 'manifest.json'), 'utf8'));
    let same = 0, recut = 0, wrong = [];
    for (const rec of man.asset_records) for (const [Q, list] of [[2, r2], [3, r3]]) {
      const pk = rec.outputs[Q + 'px'], sha = crypto.createHash('sha256').update(Buffer.from(list[rec.kind].split(',')[1], 'base64')).digest('hex');
      if (dec.out[`${Q}:${rec.kind}`].w === pk.dimensions) { if (sha === sums[pk.file]) same++; else wrong.push(rec.kind + Q); } else recut++;
    }
    results.push(report('OR-1b (--pack) bitmaps cut by the package for the right radius are byte-identical to it (SHA-256); the others (T1, T2, wezel, pylon: inferred radii) are re-cut from the native PNG only', wrong.length === 0 && same === 22 && recut === 20, `identical ${same}, re-cut ${recut}, mismatch ${wrong.join(',') || 'none'}`));
  } else results.push(report('OR-1b package SHA-256', true, 'NOT RUN: no --pack=DIR'));

  const wAfter = await world(url), wBase = await world(baseUrl);
  const diff = Object.keys(wBase).filter(k => JSON.stringify(wBase[k]) !== JSON.stringify(wAfter[k]));
  results.push(report('OR-2 logical world identical to the base: Arena seeds 2024 / 7 / 99001 + Daily (every object and bot field, RNG draws) and all 240 campaign missions', diff.length === 0 && wAfter.campaign.missions === 240, `${JSON.stringify(wAfter)} diff: ${diff.join(',') || 'none'}`));

  const baseFrames = await frames(baseUrl), baseFrames2 = await frames(baseUrl);
  const detA = JSON.stringify(baseFrames) === JSON.stringify(baseFrames2);
  const withR = await frames(url);
  const brokenAfter = await frames(url, { init: BREAK }), brokenBase = await frames(baseUrl, { init: BREAK });
  const g0Base = await frames(baseUrl, { gfx: 0, wait: 300 }), g0After = await frames(url, { gfx: 0, wait: 300 });
  const imBase = await frames(baseUrl, { immediate: true }), imAfter = await frames(url, { immediate: true });
  const g1Base = await frames(baseUrl, { gfx: 1, init: BREAK }), g1Broken = await frames(url, { gfx: 1, init: BREAK });
  results.push(report('OR-3a the base renders deterministic frames (two runs equal) -> the comparison is sound', detA && baseFrames.errors === 0, JSON.stringify(baseFrames)));
  results.push(report('OR-3b with the bitmaps decoded the staged Arena frames DIFFER from the base (the new look is drawn)', withR.p !== baseFrames.p && withR.R !== baseFrames.R && withR.errors === 0, `${withR.p}/${withR.R} vs ${baseFrames.p}/${baseFrames.R}`));
  results.push(report('OR-3c every bitmap undecodable -> frames pixel-identical to the base loaded with the same hook (gfx 2 and gfx 1)', brokenAfter.p === brokenBase.p && brokenAfter.R === brokenBase.R && g1Broken.p === g1Base.p && g1Broken.R === g1Base.R && brokenAfter.errors === 0, `${brokenAfter.p}/${brokenAfter.R} == ${brokenBase.p}/${brokenBase.R}; gfx1 ${g1Broken.p}/${g1Broken.R} == ${g1Base.p}/${g1Base.R}`));
  results.push(report('OR-3d gfx 0 draws exactly the base frames (vectors)', g0After.p === g0Base.p && g0After.R === g0Base.R, `${g0After.p}/${g0After.R} == ${g0Base.p}/${g0Base.R}`));
  results.push(report('OR-3e the first paint before any decode is the base frame (vector until the image is ready)', imAfter.p === imBase.p && imAfter.R === imBase.R, `${imAfter.p}/${imAfter.R} == ${imBase.p}/${imBase.R}`));

  // OR-4 / OR-5 on the exported copy
  const exp = await serve({ root: exportedRoot(ROOT, 'after') }), expBase = await serve({ root: exportedRoot(path.resolve(process.argv.find(a => a.startsWith('--base=')).slice(7)), 'base') });
  const g = await session(exp.url, 'pc');
  const sel = await g.page.evaluate(async () => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
    const gm = window.game, sleep = (ms) => new Promise(r => setTimeout(r, ms));
    gm.applyGfx(2);
    window.__qaSeedRandom(2024); gm.startRound({ seed: 2024 }); cancelAnimationFrame(gm.rafId); gm.running = false;
    for (let k = 0; k < 4; k++) gm.update(1 / 60);
    for (let k = 0; k < 6; k++) gm.render(k / 60);
    await sleep(2200);                                   // the district lot textures decode (they drop their own chunks: not under test)
    for (let k = 0; k < 6; k++) gm.render(k / 60);
    const R = m.__qaRaster, held = (q) => Object.keys(R.imgs[q]).length, ready = (q) => Object.values(R.imgs[q]).filter(i => R.ready(i)).length;
    R.setMax(0); R.setMax(3);                           // the bitmaps start again from nothing (gfx 2 on a 1x desktop screen: 2 px)
    for (let k = 0; k < 6; k++) gm.render(k / 60);
    const spr = new Map(m.__qaSpriteCache), chunks = new Map(gm.cityFloor.cache);
    const loadedBefore = held(2);
    await sleep(1800);
    const readyAfter = ready(2);
    for (let k = 0; k < 6; k++) gm.render(k / 60);
    let sprChanged = 0, chunkChanged = 0;
    for (const [k, v] of spr) if (m.__qaSpriteCache.get(k) !== v) sprChanged++;
    for (const [k, v] of chunks) if (gm.cityFloor.cache.get(k) !== v) chunkChanged++;
    const dense0 = { max: R.max, q: R.q, held2: held(2), held3: held(3), density: +(gm.zoom * gm.dpr).toFixed(2) };
    // a dense screen (>= 2.1 device px per world unit): 3 px, the 2 px image of a kind stays in use until its 3 px image is decoded
    gm.zoom = 2.5 / gm.dpr;                              // the frames below measure this density too (Game.render calls fit())
    R.fit(2.5);
    const fallback = ['samochod', 'fragment', 'kopula'].every((k) => !!R.get(k, { samochod: 34, fragment: 7, kopula: 100 }[k]));
    const dense1 = { q: R.q, held2: held(2), held3: held(3) };
    await sleep(2200);
    for (let k = 0; k < 6; k++) gm.render(k / 60);
    const dense2 = { q: R.q, held2: held(2), held3: held(3), ready3: ready(3) };
    R.fit(1.9); const band1 = R.q;
    gm.zoom = 0.9 / gm.dpr;                      // inside the band (1.8-2.1): no flicker
    R.fit(1.7); const band2 = R.q;
    for (let k = 0; k < 6; k++) gm.render(k / 60);      // the first paint of the 2 px set starts its decode
    await sleep(1800);
    for (let k = 0; k < 6; k++) gm.render(k / 60);
    const back = { q: R.q, held2: held(2), held3: held(3) };
    gm.applyGfx(1); R.fit(9); const g1 = { max: R.max, q: R.q };
    gm.applyGfx(0); const g0 = { max: R.max, q: R.q, held2: held(2), held3: held(3), got: R.get('fragment', 7) };
    gm.applyGfx(2);
    // a wrong radius or an unknown kind is never a bitmap
    const odd = [R.get('fragment', 13), R.get('zloty', 13), R.get('portal', 14), R.get('samochod', 12)];
    return { spr: spr.size, chunks: chunks.size, sprChanged, chunkChanged, loadedBefore, readyAfter, dense0, fallback, dense1, dense2, band1, band2, back, g1, g0, odd: odd.map(x => !!x), metaKinds: Object.keys(m.__qaMeta).length };
  });
  results.push(report('OR-4 lazy decode loads kinds on demand, 21 decode in the background; a decode replaces no sprite-cache entry and no floor chunk', sel.sprChanged === 0 && sel.chunkChanged === 0 && sel.chunks > 0 && sel.loadedBefore >= 1 && sel.loadedBefore < 21 && sel.readyAfter === 21 && sel.metaKinds === 21, JSON.stringify({ spr: sel.spr, chunks: sel.chunks, sprChanged: sel.sprChanged, chunkChanged: sel.chunkChanged, loadedBefore: sel.loadedBefore, readyAfter: sel.readyAfter })));
  results.push(report('OR-4b gfx 2 on a thin screen holds only the 2 px set; a dense screen (>= 2.1 px per unit) switches to 3 px, keeps showing the 2 px image until the 3 px one is decoded, then holds only the 3 px set; the 1.8-2.1 band does not flicker; back to 2 px; gfx 1 never 3 px; gfx 0 holds nothing and returns no bitmap; wrong radius / zloty / portal are never bitmaps',
    sel.dense0.max === 3 && sel.dense0.q === 2 && sel.dense0.held3 === 0 && sel.fallback && sel.dense1.q === 3 && sel.dense2.q === 3 && sel.dense2.ready3 === 21 && sel.dense2.held2 === 0 && sel.band1 === 3 && sel.band2 === 2 && sel.back.q === 2 && sel.back.held3 === 0 && sel.back.held2 === 21 && sel.g1.max === 2 && sel.g1.q === 2 && sel.g0.q === 0 && sel.g0.held2 === 0 && sel.g0.held3 === 0 && sel.g0.got === null && sel.odd.every(v => v === false), JSON.stringify([sel.dense0, sel.fallback, sel.dense1, sel.dense2, sel.band1, sel.band2, sel.back, sel.g1, sel.g0, sel.odd])));
  // OR-5: campaign + menu draw no bitmap and equal the base
  const camp = async (u) => {
    const s = await session(u, 'pc');
    const r = await s.page.evaluate(async () => {
      const m = await import(document.querySelector('script[type="module"][src]').src);
      const gm = window.game, out = {};
      const hash = () => { const c = gm.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let a = 0x811c9dc5; for (let i = 0; i < d.length; i++) a = Math.imul(a ^ d[i], 16777619); return (a >>> 0).toString(16); };
      const real = window.__realNow || (window.__realNow = performance.now.bind(performance));
      gm.applyGfx(2);
      for (const idx of [0, 11, 23, 55]) {
        const id = CAMPAIGN_MISSIONS[idx].id;
        window.__qaSeedRandom(3);
        gm.missionBoosters = []; gm.startCampaignMission(id); if (gm.introPending) gm.beginMissionPlay();
        cancelAnimationFrame(gm.rafId); gm.running = false; performance.now = () => 600000;
        for (let k = 0; k < 4; k++) gm.updateCampaign(1 / 60);
        const b = CONFIG.campaign.bounds; gm.followCamera(b.minX, b.minY, b.maxX, b.maxY);
        for (let k = 0; k < 6; k++) gm.renderCampaign(600);
        await new Promise(r => setTimeout(r, 500));
        for (let k = 0; k < 6; k++) gm.renderCampaign(600);
        out[idx] = hash(); performance.now = real;
      }
      out.requested = Object.keys(m.__qaRaster ? m.__qaRaster.imgs[3] : {}).length + Object.keys(m.__qaRaster ? m.__qaRaster.imgs[2] : {}).length;
      return out;
    });
    await s.browser.close();
    return r;
  };
  await g.browser.close();
  const cA = await camp(exp.url), cB = await camp(expBase.url);
  const sameC = [0, 11, 23, 55].every(k => cA[k] === cB[k] && cA[k]);
  results.push(report('OR-5 Campaign (missions 1, 12, 24, 56: frames) draws no bitmap, requests none, and is pixel-identical to the base', sameC && cA.requested === 0, `${JSON.stringify(cA)} vs ${JSON.stringify(cB)}`));

  // OR-7 (VISUAL-FIX-01): the ground base under a bitmap: contact shadow + class light + thin tier ring, from stamps
  const g7 = await session(exp.url, 'pc');
  const b7 = await g7.page.evaluate(async () => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
    const gm = window.game, sleep = (ms) => new Promise(r => setTimeout(r, ms));
    gm.applyGfx(2);
    window.__qaSeedRandom(2024); gm.startRound({ seed: 2024 }); cancelAnimationFrame(gm.rafId); gm.running = false;
    const kinds = ['fragment', 'kapsula', 'lawka', 'kiosk', 'skrzynia', 'latarnia', 'drzewo', 'znacznik', 'samochod', 'wezel', 'pylon', 'pawilon', 'billboard', 'magazyn', 'landmark', 'autobus', 'tramwaj', 'ciezarowka', 'wiezowiec', 'maszt', 'kopula'];
    const pick = {}; for (const o of gm.objects) if (!pick[o.subtype]) pick[o.subtype] = o;
    let k0 = 0; const cx = 700, cy = 700;
    for (const k of kinds) { const o = pick[k]; o.x = cx + (k0 % 7) * 180; o.y = cy + Math.floor(k0 / 7) * 260; k0++; }
    gm.player.x = 100; gm.player.y = 100; gm.update(1 / 60);
    gm.zoom = 0.9; gm.camera.x = cx + 540; gm.camera.y = cy + 260;
    for (let k = 0; k < 6; k++) gm.render(k / 60);
    await sleep(2200);
    const strokes = [], origEll = CanvasRenderingContext2D.prototype.ellipse, origCreate = document.createElement.bind(document);
    let blur = 0, canvases = 0;
    // the effects of the objects themselves (the mast beacon) set shadowBlur too: count a frame without the base, then with it
    const saved = { ...m.__qaBase }; for (const k of Object.keys(saved)) delete m.__qaBase[k];
    const d0 = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'shadowBlur', { configurable: true, get() { return d0.get.call(this); }, set(v) { if (v) blur++; d0.set.call(this, v); } });
    document.createElement = function (t) { if (String(t).toLowerCase() === 'canvas') canvases++; return origCreate(t); };
    for (let k = 0; k < 10; k++) gm.render(k / 60);
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'shadowBlur', d0);
    const blurWithout = blur; blur = 0; Object.assign(m.__qaBase, saved);
    for (let k = 0; k < 3; k++) gm.render(k / 60);
    const stampsBefore = [m.__qaStamps.shadow, ...m.__qaStamps.ring.values()];
    CanvasRenderingContext2D.prototype.ellipse = function (x, y, rx, ry) { strokes.push({ style: this.strokeStyle, lw: this.lineWidth }); return origEll.apply(this, arguments); };
    const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'shadowBlur', { configurable: true, get() { return d.get.call(this); }, set(v) { if (v) blur++; d.set.call(this, v); } });
    document.createElement = function (t) { if (String(t).toLowerCase() === 'canvas') canvases++; return origCreate(t); };
    for (let k = 0; k < 10; k++) gm.render(k / 60);
    CanvasRenderingContext2D.prototype.ellipse = origEll; document.createElement = origCreate;
    Object.defineProperty(CanvasRenderingContext2D.prototype, 'shadowBlur', d);
    const ringColors = [...new Set(strokes.filter(s => /^rgba\(\d+,\s*\d+,\s*\d+,\s*0\.42\)$/.test(String(s.style))).map(s => String(s.style).replace(/\s/g, '')))];
    const tierColors = Object.values(TIERS).filter(t => t.count > 0).map(t => t.color);
    const stampsAfter = [m.__qaStamps.shadow, ...m.__qaStamps.ring.values()];
    return { blurWithout, stampsStable: stampsBefore.length === stampsAfter.length && stampsBefore.every((x, i) => x === stampsAfter[i]), baseKeys: Object.keys(m.__qaBase).length, stamps: m.__qaStamps.ring.size + (m.__qaStamps.shadow ? 1 : 0), blur, canvases, ringColors, tierColors, strokes: strokes.length,
      maxExtent: +Math.max(...Object.entries(m.__qaBase).map(([k, b]) => Math.max(Math.abs(b[0]) + b[2] * 1.1, b[1] + 0.2 * b[2]))).toFixed(2),
      noRingT1: m.__qaBase.fragment[3] === 0 && m.__qaBase.kapsula[3] === 0 && Object.entries(m.__qaBase).every(([k, b]) => k === 'fragment' || k === 'kapsula' || b[3] !== 0) };
  });
  await g7.browser.close();
  const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const expect = [...new Set(b7.tierColors)].map(c => { const [r, g, b] = hex(c); return 'rgba(' + r + ',' + g + ',' + b + ',0.42)'; });
  const ringOk = b7.ringColors.length >= 4 && b7.ringColors.every(c => expect.includes(c));
  results.push(report('OR-7 every kind has its ground base; rings use only TIERS class colors (T1 none, as in the vector look); the stamps are built once (the same canvases every frame) and a frame sets no more shadowBlur than a frame without the base; at most 7 cached 64 px stamps; the base stays inside 1.3 r', b7.baseKeys === 21 && b7.noRingT1 && ringOk && b7.stampsStable && b7.blur === b7.blurWithout && b7.stamps <= 7 && b7.maxExtent <= 1.3, JSON.stringify(b7)));
  exp.server.close(); expBase.server.close();

  // OR-6 static: the flag only where the Arena draws a WorldObject
  const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8').split(/\r?\n/);
  const hits = src.map((l, i) => [i + 1, l]).filter(([, l]) => /raster:\s*true/.test(l));
  const ctxOf = (n) => { for (let i = n - 1; i > 0; i--) { const m = /^\s*(?:class (\w+)|(\w+)\(.*\) \{$)/.exec(src[i - 1]); if (m && (m[1] || /^(draw|render)/.test(m[2] || ''))) return m[1] || m[2]; } return '?'; };
  const where = hits.map(([n]) => `${n}:${ctxOf(n)}`);
  const classOfLine = (n) => { for (let i = n - 1; i >= 0; i--) { const m = /^class (\w+)/.exec(src[i]); if (m) return m[1]; } return '?'; };
  const nonWorld = hits.filter(([n]) => !(classOfLine(n) === 'WorldObject' || (classOfLine(n) === 'Game' && /instanceof WorldObject/.test(src.slice(Math.max(0, n - 3), n).join('\n')))));
  results.push(report('OR-6 the raster flag is passed exactly 3 times -- WorldObject.draw (2) and the swallow body of a WorldObject -- nowhere in Campaign / menu code', hits.length === 3 && nonWorld.length === 0, where.join(' ')));
  return results;
}

if (isMain(import.meta.url)) {
  const arg = process.argv.find(a => a.startsWith('--base='));
  const pk = process.argv.find(a => a.startsWith('--pack='));
  if (!arg) { console.log('NOT RUN: --base=DIR (a worktree of origin/main) is required'); process.exit(1); }
  const base = await serve({ root: path.resolve(arg.slice(7)) });
  const cur = await serve();
  const res = await run(cur.url, base.url, pk ? path.resolve(pk.slice(7)) : null);
  cur.server.close(); base.server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} GG-OBJECTS-RASTER-02 checks passed`);
  process.exit(failed.length ? 1 : 0);
}
