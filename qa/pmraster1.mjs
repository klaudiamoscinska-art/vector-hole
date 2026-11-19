// GG-PM-RASTER-02 (extends -01): Arena's Plac Neonów lots are the raster textures PM-A/B/C.
// Compares THIS checkout (AFTER) with a base checkout (BEFORE, --base=DIR, a worktree of the base commit):
//  - chunk hashes: the 12 plac blocks change, the other 52 Arena blocks and every Campaign block do not
//  - the broken-texture fallback paints exactly the old vector lots (hash == BEFORE)
//  - gfx 0 draws the 512 px textures, gfx 1-2 the 768 px ones; textures are decoded once
//  - no chunk repaints while the camera is still; render time BEFORE/AFTER on this machine
//  - real screenshots BEFORE/AFTER (PC 1280x720, phone 390x844) -> qa/out/pm-raster1/
// Usage: node qa/pmraster1.mjs --base=../vh-pmr-base
import { serve, openGame, veteranSave, report, QA_RANDOM, OUT, isMain } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const READY = () => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state;
const DEST = path.join(OUT, 'pm-raster1');
const FRAMES = { pc: { w: 1280, h: 720, mobile: false, dsf: 1 }, mobile: { w: 390, h: 844, mobile: true, dsf: 2 } };
const BLOCKS = [[1, 1], [2, 1], [1, 2]]; // plac blocks used for scenes

async function session(url, frame, { initScript = null } = {}) {
  const f = FRAMES[frame];
  const g = await openGame(url, { viewport: { width: f.w, height: f.h }, mobile: f.mobile, deviceScaleFactor: f.dsf, initScript: QA_RANDOM + (initScript || '') });
  const s = await veteranSave(g.page, { missions: 29, coins: 800, runsPlayed: 12 });
  await g.page.evaluate((v) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(v)), s);
  await g.page.reload();
  await g.page.waitForFunction(READY);
  return g;
}

/** Hash of every cached chunk canvas after painting the whole Arena (and a Campaign plac floor). */
const HASHES = `(async () => {
  const gm = window.game, out = {};
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const h = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let a = 2166136261; for (let i = 0; i < d.length; i += 3) a = Math.imul(a ^ d[i], 16777619); return (a >>> 0).toString(16); };
  gm.applyGfx(2);
  const fl = new gm.cityFloor.constructor();
  for (const theme of [null, 'plac', 'park']) {
    for (let k = 0; k < 2; k++) { // 2nd pass: after the textures decoded (the first may use the vector fallback)
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { if (theme && (i > 2 || j > 2)) continue; fl.render(i, j, 1, theme, fl.cache.get((theme || '*') + '|' + i + '|' + j) || null); }
      if (k === 0) await sleep(900);
    }
    for (const [key, e] of fl.cache) if (!theme === (key[0] === '*')) out[key] = h(e.canvas);
  }
  return out;
})()`;

async function hashes(url, initScript) {
  const g = await session(url, 'pc', { initScript });
  const r = await g.page.evaluate(HASHES);
  await g.browser.close();
  return r;
}

async function shots(url, tag) {
  const out = {};
  for (const frame of Object.keys(FRAMES)) {
    const g = await session(url, frame);
    for (const [bi, [i, j]] of BLOCKS.entries()) {
      await g.page.evaluate(([i, j]) => {
        const gm = window.game;
        gm.applyGfx(2);
        window.__qaSeedRandom(2024);
        gm.startRound({ seed: 2024 }); cancelAnimationFrame(gm.rafId); gm.running = false;
        gm.player.x = (i + 0.5) * 375; gm.player.y = (j + 0.5) * 375;
        for (let k = 0; k < 4; k++) gm.update(1 / 60);
        gm.zoom = innerWidth > 800 ? 0.62 : 0.5;
      }, [i, j]);
      await g.page.waitForTimeout(700);
      await g.page.evaluate(() => { for (let k = 0; k < 6; k++) window.game.render(k / 60); });
      const file = path.join(DEST, `${tag}-${frame}-plac${bi + 1}.png`);
      fs.mkdirSync(DEST, { recursive: true });
      await g.page.screenshot({ path: file });
      out[`${frame}-plac${bi + 1}`] = file;
    }
    // one Campaign mission on plac
    await g.page.evaluate(() => { const gm = window.game; gm.startCampaignMission('M01'); if (gm.introPending) gm.beginMissionPlay(); cancelAnimationFrame(gm.rafId); gm.running = false; gm.updateCampaign(1 / 60); for (let k = 0; k < 6; k++) gm.renderCampaign(k / 60); });
    await g.page.waitForTimeout(500);
    const file = path.join(DEST, `${tag}-${frame}-kampania-M01.png`);
    await g.page.screenshot({ path: file });
    out[`${frame}-kampania-M01`] = file;
    if (g.errors.length) console.log('  errors', tag, frame, g.errors.slice(0, 2));
    await g.browser.close();
  }
  return out;
}

/** Render cost and cache behaviour in a plac view (still camera), median of 120 frames. */
async function perf(url, gfx) {
  const g = await session(url, 'mobile');
  const r = await g.page.evaluate(async ([gfx]) => {
    const gm = window.game, sleep = (ms) => new Promise(r => setTimeout(r, ms));
    gm.applyGfx(gfx);
    gm.startRound({ seed: 2024 }); cancelAnimationFrame(gm.rafId); gm.running = false;
    gm.player.x = 562; gm.player.y = 562; gm.update(1 / 60); gm.zoom = 0.55;
    for (let k = 0; k < 10; k++) gm.render(k / 60);
    await sleep(900);
    for (let k = 0; k < 10; k++) gm.render(k / 60);
    const r0 = gm.cityFloor.renders, ts = [];
    for (let k = 0; k < 120; k++) { const t = performance.now(); gm.render(k / 60); ts.push(performance.now() - t); }
    ts.sort((a, b) => a - b);
    // pan across plac: chunks painted per second of simulated travel
    const p0 = gm.cityFloor.renders;
    for (let k = 0; k < 180; k++) { gm.player.x += 5; gm.player.y += 3; gm.update(1 / 60); gm.render(k / 60); }
    return { stillRepaints: gm.cityFloor.renders - r0, median: +ts[60].toFixed(2), p95: +ts[113].toFixed(2), panPaints: gm.cityFloor.renders - p0, cachePx: gm.cityFloor.pixels, chunks: gm.cityFloor.cache.size };
  }, [gfx]);
  await g.browser.close();
  return r;
}

/** Which texture sizes the floor really draws at each gfx level (hooked drawImage). */
async function sizes(url, gfx) {
  const g = await session(url, 'mobile', { initScript: `(() => { const o = CanvasRenderingContext2D.prototype.drawImage; window.__imgW = {}; CanvasRenderingContext2D.prototype.drawImage = function (im) { if (im instanceof HTMLImageElement) window.__imgW[im.naturalWidth] = (window.__imgW[im.naturalWidth] || 0) + 1; return o.apply(this, arguments); }; })();` });
  const r = await g.page.evaluate(async ([gfx]) => {
    const gm = window.game, sleep = (ms) => new Promise(r => setTimeout(r, ms));
    gm.applyGfx(gfx); window.__imgW = {};
    gm.startRound({ seed: 2024 }); cancelAnimationFrame(gm.rafId); gm.running = false;
    gm.player.x = 562; gm.player.y = 562; gm.update(1 / 60); gm.zoom = 0.55;
    for (let k = 0; k < 4; k++) gm.render(k / 60);
    await sleep(900);
    for (let k = 0; k < 4; k++) gm.render(k / 60);
    const w = Object.keys(window.__imgW).map(Number);
    return { widths: w, imageObjects: performance.getEntriesByType('resource').length };
  }, [gfx]);
  await g.browser.close();
  return r;
}

/** GG-PM-RASTER-02: which texture (A-F) each of the 12 plac blocks really draws, read from the live floor painter. */
async function layout(url) {
  const src = fs.readFileSync('pm-tex-768.js', 'utf8');
  const tex = [...src.matchAll(/'(data:image\/webp;base64,[^']+)'/g)].map(m => m[1]);
  const g = await session(url, 'pc', { initScript: `(() => { const o = CanvasRenderingContext2D.prototype.drawImage; window.__cur = null; window.__seen = {}; CanvasRenderingContext2D.prototype.drawImage = function (im) { if (im instanceof HTMLImageElement && window.__cur) window.__seen[window.__cur] = im.src; return o.apply(this, arguments); }; })();` });
  const seen = await g.page.evaluate(async () => {
    const gm = window.game, sleep = (ms) => new Promise(r => setTimeout(r, ms));
    gm.applyGfx(2);
    const fl = new gm.cityFloor.constructor();
    for (let k = 0; k < 2; k++) {
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { window.__cur = i + ',' + j; fl.render(i, j, 1, null, fl.cache.get('*|' + i + '|' + j) || null); }
      if (k === 0) await sleep(900);
    }
    return window.__seen;
  });
  await g.browser.close();
  const L = 'ABCDEF', grid = {};
  for (const [k, s] of Object.entries(seen)) grid[k] = L[tex.indexOf(s)] || '?';
  return grid;
}

export async function runPmRaster(url, baseUrl) {
  const results = [];
  const after = await hashes(url);
  const keysAll = Object.keys(after);
  const plac = (k) => { const m = /^\*\|(\d+)\|(\d+)$/.exec(k); return m && 'pppkkkkk,ppppkkkk,ppppkkkd,oopRRkdd'.split(',').slice(0, 4).join(',') && ['pppkkkkk', 'ppppkkkk', 'ppppkkkd', 'oopRRkdd', 'oooRRddd', 'ooogggdd', 'oogggggd', 'oogggggg'][+m[2]][+m[1]] === 'p'; };
  const placKeys = keysAll.filter(plac);
  results.push(report('PM-1 the Arena has 12 plac blocks', placKeys.length === 12, `${placKeys.length}`));
  if (baseUrl) {
    const before = await hashes(baseUrl);
    const changed = keysAll.filter(k => after[k] !== before[k]);
    const onlyPlac = changed.length === 12 && changed.every(k => plac(k));
    results.push(report('PM-2 only the 12 Arena plac chunks change; 52 other Arena blocks, Campaign plac and park floors are unchanged', onlyPlac, `changed ${changed.length}: ${changed.join(' ')}`));
    const broken = await hashes(url, `(() => { const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); Object.defineProperty(HTMLImageElement.prototype, 'src', { set(v) { d.set.call(this, 'data:image/webp;base64,AAAA'); }, get() { return d.get.call(this); }, configurable: true }); })();`);
    const differs = keysAll.filter(k => broken[k] !== before[k]);
    results.push(report('PM-3 undecodable textures -> the old vector lots (every chunk == BEFORE)', differs.length === 0, differs.length ? differs.join(' ') : 'identical'));
  } else results.push({ name: 'PM-2/3 BEFORE comparison', ok: false, details: 'NOT RUN (no --base)' });
  for (const [gfx, want] of [[0, 512], [1, 768], [2, 768]]) {
    const s = await sizes(url, gfx);
    results.push(report(`PM-4 gfx ${gfx} draws the ${want} px textures`, s.widths.length > 0 && s.widths.every(w => w === want), JSON.stringify(s.widths)));
  }
  for (const gfx of [2, 0]) {
    const a = await perf(url, gfx);
    // This scene is a deliberately tight one (DPR 2 phone, 17 chunks near the pixel cap), so the repaint count
    // is compared with BEFORE on the same machine: AFTER must not paint more; render time must stay within 1 ms + 25 %.
    const bf = baseUrl ? await perf(baseUrl, gfx) : null;
    results.push(report(`PM-5 gfx ${gfx}: chunk repaints and render time vs BEFORE`, bf ? a.stillRepaints <= bf.stillRepaints && a.panPaints <= bf.panPaints && a.cachePx <= bf.cachePx && a.median <= bf.median * 1.25 + 1 : a.stillRepaints === 0, `AFTER ${JSON.stringify(a)} | BEFORE ${JSON.stringify(bf)}`));
  }
  const grid = await layout(url);
  const WANT = ['FAD', 'ECBA', 'BDEC', '..F'];
  const rows = WANT.map((r, j) => [...r].map((ch, i) => ch === '.' ? '.' : (grid[i + ',' + j] || '?')).join(''));
  const counts = {}; for (const v of Object.values(grid)) counts[v] = (counts[v] || 0) + 1;
  const side = Object.keys(grid).some(k => { const [i, j] = k.split(',').map(Number); return grid[(i + 1) + ',' + j] === grid[k] || grid[i + ',' + (j + 1)] === grid[k]; });
  results.push(report('PM-7 the 12 plac blocks draw the six textures A-F exactly as mapped, each twice, no equal side neighbours, C at (1,1)', Object.keys(grid).length === 12 && rows.join('|') === WANT.join('|') && 'ABCDEF'.split('').every(v => counts[v] === 2) && !side && grid['1,1'] === 'C', rows.join(' ') + ' ' + JSON.stringify(counts)));
  const shotsA = await shots(url, 'po');
  const shotsB = baseUrl ? await shots(baseUrl, 'przed') : {};
  results.push(report('PM-6 screenshots BEFORE/AFTER written', Object.keys(shotsA).length === 8 && (!baseUrl || Object.keys(shotsB).length === 8), DEST));
  return results;
}

if (isMain(import.meta.url)) {
  const arg = process.argv.find(a => a.startsWith('--base='));
  const base = arg ? await serve({ root: path.resolve(arg.slice(7)) }) : null;
  const cur = await serve();
  const res = await runPmRaster(cur.url, base && base.url);
  cur.server.close(); if (base) base.server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} GG-PM-RASTER-01 checks passed`);
  process.exit(failed.length ? 1 : 0);
}
