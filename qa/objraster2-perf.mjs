// GG-OBJECTS-RASTER-02 measurement, not a test: base checkout vs this one, PC 1280x720 and phone emulation 390x844 (DPR 2), paired and alternated.
//   node qa/objraster2-perf.mjs --base=DIR [--reps=5]  ->  qa/out/objraster2/perf.json
// Per variant / frame / gfx level / zoom (0.58 = the game's smallest, 0.9 = early game):
//   * load: time to the game object (page ready) and the JS the release graph loads (raw / gzip, from the files)
//   * the staged Arena scene (T1..T6 rows) -- render() + a 1 px canvas flush per frame (the raster cost), 120 frames: median / p95 / max
//   * memory (CDP, after a forced GC): JS heap; the object art held as pixels: vector sprite canvases (w*h*4) vs decoded bitmaps (w*h*4)
// Headless software raster: absolute ms are pessimistic and machine specific -- only the paired difference means anything.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { serve, openGame, veteranSave, QA_RANDOM, OUT, ROOT, readRuntimeSources, isMain } from './lib.mjs';
import { exportedRoot, stageScene } from './objraster2-shots.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const FRAMES = { pc: { w: 1280, h: 720, mobile: false, dsf: 1 }, phone: { w: 390, h: 844, mobile: true, dsf: 2 } };
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

function jsBytes(root) {
  let raw = 0, gz = 0; const files = [];
  const graph = readRuntimeSources(root);
  for (const f of [graph.html, ...graph.files].filter(Boolean)) {
    const b = Buffer.from(f.text, 'utf8'); raw += b.length; gz += zlib.gzipSync(b).length; files.push(f.path);
  }
  return { raw, gzip: gz, files: files.length };
}

async function once(root, exp, frame, { gfx, zoom, staged }) {
  const srv = await serve({ root: exp });
  const f = FRAMES[frame];
  const t0 = Date.now();
  const g = await openGame(srv.url, { viewport: { width: f.w, height: f.h }, mobile: f.mobile, deviceScaleFactor: f.dsf, initScript: QA_RANDOM });
  const loadMs = Date.now() - t0;
  const s = await veteranSave(g.page, { missions: 29, coins: 800, runsPlayed: 12 });
  await g.page.evaluate((v) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(v)), s);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  const cdp = await g.context.newCDPSession(g.page);
  await cdp.send('Performance.enable');
  await stageScene(g.page, { sector: 'p', staged, zoom, gfx });
  // warm: first paints start the lazy decodes; wait until they are ready (candidate) / sprites cached (base)
  const warmStart = Date.now();
  await g.page.evaluate(() => { for (let k = 0; k < 6; k++) window.game.render(k / 60); });
  await g.page.waitForTimeout(2200);
  const frames = await g.page.evaluate(() => {
    const gm = window.game, real = window.__realNow, out = [];
    const flush = () => gm.ctx.getImageData(0, 0, 1, 1);
    for (let k = 0; k < 20; k++) { gm.render(k / 60); flush(); }
    for (let k = 0; k < 120; k++) { const t0 = real(); gm.render(k / 60); flush(); out.push(real() - t0); }
    return out;
  });
  await g.page.evaluate(() => { if (window.gc) window.gc(); });
  await cdp.send('HeapProfiler.collectGarbage');
  const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const art = await g.page.evaluate(async () => {
    const mod = await import(document.querySelector('script[type="module"][src]').src);
    let vec = 0, vecN = 0, bmp = 0, bmpN = 0;
    for (const [, s] of mod.__qaSpriteCache) { vec += s.canvas.width * s.canvas.height * 4; vecN++; }
    if (mod.__qaRaster) for (const q of [2, 3]) for (const im of Object.values(mod.__qaRaster.imgs[q])) if (im.complete && im.naturalWidth) { bmp += im.naturalWidth * im.naturalHeight * 4; bmpN++; }
    return { vecBytes: vec, vecSprites: vecN, bitmapBytes: bmp, bitmaps: bmpN };
  });
  const errors = g.errors.length;
  await g.browser.close(); srv.server.close();
  return { loadMs, median: med(frames), p95: frames.slice().sort((a, b) => a - b)[Math.floor(frames.length * 0.95)], max: Math.max(...frames), heapMB: m.JSHeapUsedSize / 1048576, ...art, errors };
}

export async function run({ base, reps = 5 }) {
  const roots = { base: path.resolve(base), after: ROOT };
  const exps = { base: exportedRoot(roots.base, 'pbase'), after: exportedRoot(roots.after, 'pafter') };
  const cases = [];
  for (const frame of ['pc', 'phone']) for (const [gfx, zoom, staged] of [[2, 0.58, true], [2, 0.9, true], [1, 0.58, true], [0, 0.58, true], [2, 0.58, false]]) cases.push({ frame, gfx, zoom, staged });
  const out = { js: { base: jsBytes(roots.base), after: jsBytes(roots.after) }, cases: [] };
  for (const c of cases) {
    const res = { base: [], after: [] };
    for (let i = 0; i < reps; i++) for (const v of (i % 2 ? ['after', 'base'] : ['base', 'after'])) res[v].push(await once(roots[v], exps[v], c.frame, c));
    const sum = (v) => ({ frameMedianMs: +med(res[v].map(r => r.median)).toFixed(2), frameP95Ms: +med(res[v].map(r => r.p95)).toFixed(2), frameMaxMs: +med(res[v].map(r => r.max)).toFixed(2), loadMs: med(res[v].map(r => r.loadMs)), heapMB: +med(res[v].map(r => r.heapMB)).toFixed(1), vectorSpriteMB: +(med(res[v].map(r => r.vecBytes)) / 1048576).toFixed(2), vectorSprites: res[v][0].vecSprites, bitmapMB: +(med(res[v].map(r => r.bitmapBytes)) / 1048576).toFixed(2), bitmaps: res[v][0].bitmaps, errors: res[v].reduce((a, r) => a + r.errors, 0) });
    const row = { ...c, base: sum('base'), after: sum('after') };
    out.cases.push(row);
    console.log(`${c.frame} gfx${c.gfx} zoom ${c.zoom} ${c.staged ? 'staged' : 'natural'}: frame median ${row.base.frameMedianMs} -> ${row.after.frameMedianMs} ms, p95 ${row.base.frameP95Ms} -> ${row.after.frameP95Ms}, heap ${row.base.heapMB} -> ${row.after.heapMB} MB, art px: vector ${row.base.vectorSpriteMB} MB -> vector ${row.after.vectorSpriteMB} + bitmaps ${row.after.bitmapMB} MB (${row.after.bitmaps}), load ${row.base.loadMs} -> ${row.after.loadMs} ms, errors ${row.base.errors}/${row.after.errors}`);
  }
  fs.mkdirSync(path.join(OUT, 'objraster2'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'objraster2', 'perf.json'), JSON.stringify(out, null, 1));
  console.log('JS (release graph):', JSON.stringify(out.js));
  return out;
}

if (isMain(import.meta.url)) run({ base: opt('base', null), reps: +opt('reps', 5) }).then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
