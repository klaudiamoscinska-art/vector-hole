
// GG-PS-EXACT-6: Arena Port Syntez (map key o, canonical district id `port`, 12 blocks) lots are the textures PS-A..F.
// Compares THIS checkout (AFTER) with a base checkout (BEFORE, --base=DIR, a git worktree of origin/main):
//  - PS-1 only the 12 `o` Arena chunks change; the other 52 Arena blocks (12 PM plac + 9 TG dachy incl.) and every Campaign floor (plac/park/dachy/port themes) are identical
//  - PS-2 undecodable textures -> exactly the old vector lots (every chunk == the base with undecodable textures)
//  - PS-3 the 12 blocks draw the textures exactly as mapped (read from the live floor painter); 12 PM and 9 TG blocks still PM / TG
//  - PS-4 gfx 0 draws 512 px, gfx 1-2 768 px PS textures
//  - PS-5 the texture load drops only the chunk cache of its own district (park/galeria/rdzen/Campaign entries survive)
//  - PS-6 the 12 textures decode with transparent corners (alpha) and (with --pack=DIR) match the package manifest SHA-256
//  - PS-7 the lot draws the source rect inside the TG-style inset (9 % left/right, 11 % top/bottom), not the whole card
//  - PS-8 real screenshots, PC 1280x720 and phone 390x844, sector o in view, after the lazy decode -> qa/out/ps-exact6/ (+ no JS errors)
// Usage: node qa/psexact6.mjs --base=../vh-ps-base [--pack=DIR]
import { serve, openGame, veteranSave, report, QA_RANDOM, OUT, isMain } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const READY = () => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state;
const DEST = path.join(OUT, 'ps-exact6');
const FRAMES = { pc: { w: 1280, h: 720, mobile: false, dsf: 1 }, mobile: { w: 390, h: 844, mobile: true, dsf: 2 } };
// expected texture per Arena block, row = y, column = x ('.' = not an `o` block)
const MAP = ['........', '........', '........', 'AF......', 'BDC.....', 'EFA.....', 'DE......', 'CB......'];
const ROWS = ['pppkkkkk', 'ppppkkkk', 'ppppkkkd', 'oopRRkdd', 'oooRRddd', 'ooogggdd', 'oogggggd', 'oogggggg'];
const KEY_RE = new RegExp('^\\*\\|(\\d+)\\|(\\d+)$');
const isO = (k) => { const m = KEY_RE.exec(k); return !!m && ROWS[+m[2]][+m[1]] === 'o'; };
const INSET = [0.09, 0.11, 0.09, 0.11];

async function session(url, frame, { initScript = null } = {}) {
  const f = FRAMES[frame];
  const g = await openGame(url, { viewport: { width: f.w, height: f.h }, mobile: f.mobile, deviceScaleFactor: f.dsf, initScript: QA_RANDOM + (initScript || '') });
  const s = await veteranSave(g.page, { missions: 29, coins: 800, runsPlayed: 12 });
  await g.page.evaluate((v) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(v)), s);
  await g.page.reload();
  await g.page.waitForFunction(READY);
  return g;
}

/** Hash of every cached chunk canvas: the whole Arena + Campaign plac / park / dachy / port floors. */
const HASHES = `(async () => {
  const gm = window.game, out = {};
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const h = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let a = 2166136261; for (let i = 0; i < d.length; i += 3) a = Math.imul(a ^ d[i], 16777619); return (a >>> 0).toString(16); };
  gm.applyGfx(2);
  const fl = new gm.cityFloor.constructor();
  for (const theme of [null, 'plac', 'park', 'dachy', 'port']) {
    for (let k = 0; k < 2; k++) {
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { if (theme && (i > 2 || j > 2)) continue; fl.render(i, j, 1, theme, fl.cache.get((theme || '*') + '|' + i + '|' + j) || null); }
      if (k === 0) await sleep(1200);
    }
    for (const [key, e] of fl.cache) if (theme ? key.startsWith(theme + '|') : key[0] === '*') out[key] = h(e.canvas);
  }
  return out;
})()`;

async function hashes(url, initScript) {
  const g = await session(url, 'pc', { initScript });
  const r = await g.page.evaluate(HASHES);
  await g.browser.close();
  return r;
}

const BREAK = `(() => { const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); Object.defineProperty(HTMLImageElement.prototype, 'src', { set(v) { d.set.call(this, 'data:image/webp;base64,AAAA'); }, get() { return d.get.call(this); } }); })();`;

/** drawImage hook: records the data URL, natural width and source rect of every texture painted per block. */
const HOOK = `(() => { const o = CanvasRenderingContext2D.prototype.drawImage; window.__cur = null; window.__seen = {}; window.__w = {}; window.__rect = {};
  CanvasRenderingContext2D.prototype.drawImage = function (im) { if (im instanceof HTMLImageElement && window.__cur) { window.__seen[window.__cur] = im.src; window.__w[im.naturalWidth] = 1; window.__rect[window.__cur] = arguments.length === 9 ? [arguments[1] / im.naturalWidth, arguments[2] / im.naturalHeight, 1 - (arguments[1] + arguments[3]) / im.naturalWidth, 1 - (arguments[2] + arguments[4]) / im.naturalHeight] : 'whole'; } return o.apply(this, arguments); }; })();`;

async function layoutAndSizes(url, gfx) {
  const g = await session(url, 'pc', { initScript: HOOK });
  const r = await g.page.evaluate(async ([gfx]) => {
    const gm = window.game, sleep = (ms) => new Promise(r => setTimeout(r, ms));
    gm.applyGfx(gfx);
    const fl = new gm.cityFloor.constructor();
    fl.rich = gfx > 0;
    for (let k = 0; k < 2; k++) {
      window.__seen = {}; window.__w = {}; window.__rect = {};
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { window.__cur = i + ',' + j; fl.render(i, j, 1, null, fl.cache.get('*|' + i + '|' + j) || null); }
      if (k === 0) await sleep(1200);
    }
    return { seen: window.__seen, widths: Object.keys(window.__w).map(Number), rect: window.__rect };
  }, [gfx]);
  await g.browser.close();
  return r;
}

/** A texture decode must drop only its own district: keep refs of every cached chunk across the decode. */
async function selective(url) {
  const g = await session(url, 'pc');
  const r = await g.page.evaluate(async () => {
    const gm = window.game, sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const ROWS = ['pppkkkkk', 'ppppkkkk', 'ppppkkkd', 'oopRRkdd', 'oooRRddd', 'ooogggdd', 'oogggggd', 'oogggggg'];
    const re = new RegExp('^\\*\\|(\\d+)\\|(\\d+)$');
    gm.applyGfx(2);
    const fl = new gm.cityFloor.constructor();
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) fl.render(i, j, 1, null, null);
    fl.render(0, 0, 1, 'park', null); fl.render(1, 1, 1, 'dachy', null); fl.render(1, 1, 1, 'port', null);
    const refs = new Map(fl.cache);
    await sleep(1800);
    const dist = (k) => { const m = re.exec(k); return m ? ROWS[+m[2]][+m[1]] : 'T'; };
    const dropped = {}; let keptOther = 0, theme = 0;
    for (const [k, e] of refs) {
      const d = dist(k);
      if (fl.cache.get(k) !== e) dropped[d] = (dropped[d] || 0) + 1;
      else if (d === 'T') theme++;
      else if (d !== 'p' && d !== 'd' && d !== 'o') keptOther++;
    }
    return { dropped, keptOther, theme };
  });
  await g.browser.close();
  return r;
}

/** Decode the 12 data URLs in the page: corner alpha must be 0 and the centre opaque. */
async function alphaCheck(url, all) {
  const g = await session(url, 'pc');
  const r = await g.page.evaluate(async (list) => {
    const res = [];
    for (const u of list) {
      const im = new Image(); im.src = u; await im.decode();
      const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
      const c = cv.getContext('2d'); c.drawImage(im, 0, 0);
      const W = cv.width - 1, a = (x, y) => c.getImageData(x, y, 1, 1).data[3];
      res.push({ w: im.naturalWidth, corners: [a(0, 0), a(W, 0), a(0, W), a(W, W)], centre: a(W >> 1, W >> 1) });
    }
    return res;
  }, all);
  await g.browser.close();
  return r;
}

async function shots(url) {
  const out = {};
  fs.mkdirSync(DEST, { recursive: true });
  for (const frame of Object.keys(FRAMES)) {
    const g = await session(url, frame);
    await g.page.evaluate(() => {
      const gm = window.game;
      gm.applyGfx(2);
      window.__qaSeedRandom(2024);
      gm.startRound({ seed: 2024 }); cancelAnimationFrame(gm.rafId); gm.running = false;
      gm.player.x = 1.4 * 375; gm.player.y = 5.0 * 375;
      for (let k = 0; k < 4; k++) gm.update(1 / 60);
      gm.zoom = innerWidth > 800 ? 0.5 : 0.4;
    });
    await g.page.evaluate(() => { for (let k = 0; k < 6; k++) window.game.render(k / 60); }); // 1st paint starts the lazy decode (vector fallback)
    await g.page.waitForTimeout(1800);
    await g.page.evaluate(() => { for (let k = 0; k < 6; k++) window.game.render(k / 60); });
    const file = path.join(DEST, `ps-${frame}-port.png`);
    await g.page.screenshot({ path: file });
    out[frame] = { file, errors: g.errors.length };
    if (g.errors.length) console.log('  errors', frame, g.errors.slice(0, 3));
    await g.browser.close();
  }
  return out;
}

const urls = (f) => [...fs.readFileSync(f, 'utf8').matchAll(/'(data:image\/webp;base64,[^']+)'/g)].map(m => m[1]);

export async function runPs(url, baseUrl, pack) {
  const results = [];
  const after = await hashes(url);
  const before = await hashes(baseUrl);
  const keys = Object.keys(after), arena = keys.filter(k => k[0] === '*'), theme = keys.filter(k => k[0] !== '*');
  const changed = keys.filter(k => after[k] !== before[k]);
  results.push(report('PS-1 only the 12 Arena `o` chunks change; 52 other Arena blocks (12 PM + 9 TG incl.) and all Campaign floors identical', arena.length === 64 && theme.length > 0 && changed.length === 12 && changed.every(isO) && arena.filter(isO).length === 12, `arena ${arena.length}, campaign ${theme.length}, changed ${changed.length}: ${changed.join(' ')}`));
  const broken = await hashes(url, BREAK), brokenBase = await hashes(baseUrl, BREAK);
  const differs = keys.filter(k => broken[k] !== brokenBase[k]);
  results.push(report('PS-2 undecodable textures -> the old vector lots (every chunk == BEFORE)', differs.length === 0, differs.length ? differs.join(' ') : 'identical'));
  const tex768 = urls('ps-tex-768.js'), tex512 = urls('ps-tex-512.js'), pm = urls('pm-tex-768.js'), tg = urls('tg-tex-768.js');
  const L = 'ABCDEF';
  const lay = await layoutAndSizes(url, 2);
  const grid = {}; let pmBlocks = 0, tgBlocks = 0;
  for (const [k, s] of Object.entries(lay.seen)) { const [i, j] = k.split(',').map(Number); if (ROWS[j][i] === 'o') grid[k] = L[tex768.indexOf(s)] || '?'; else if (pm.includes(s)) pmBlocks++; else if (tg.includes(s)) tgBlocks++; }
  const wrong = []; let right = 0;
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if (ROWS[j][i] === 'o') { const w = MAP[j][i]; if (grid[i + ',' + j] === w) right++; else wrong.push(`${i},${j}=${grid[i + ',' + j]}!=${w}`); }
  const counts = {}; Object.values(grid).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  results.push(report('PS-3 the 12 `o` blocks draw PS textures exactly as mapped ((0,3)=A (1,3)=F (0,4)=B (1,4)=D (2,4)=C (0,5)=E (1,5)=F (2,5)=A (0,6)=D (1,6)=E (0,7)=C (1,7)=B), A-F twice each; 12 PM and 9 TG blocks unchanged', right === 12 && !wrong.length && Object.keys(grid).length === 12 && L.split('').every(v => counts[v] === 2) && pmBlocks === 12 && tgBlocks === 9 && tex768.length === 6 && tex512.length === 6, `${right}/12 ${wrong.join(' ')} counts ${JSON.stringify(counts)} pm ${pmBlocks} tg ${tgBlocks}`));
  for (const [gfx, want] of [[0, 512], [1, 768], [2, 768]]) {
    const s = await layoutAndSizes(url, gfx);
    const ps = Object.entries(s.seen).filter(([k]) => { const [i, j] = k.split(',').map(Number); return ROWS[j][i] === 'o'; });
    const set = want === 512 ? tex512 : tex768;
    results.push(report(`PS-4 gfx ${gfx} draws the ${want} px PS textures on all 12 blocks`, ps.length === 12 && ps.every(([, v]) => set.includes(v)) && s.widths.length > 0 && s.widths.every(w => w === want), JSON.stringify(s.widths)));
  }
  const sel = await selective(url);
  results.push(report('PS-5 a texture decode drops only plac/dachy/port chunks; park/galeria/rdzen and Campaign cache entries survive', sel.dropped.p === 12 && sel.dropped.d === 9 && sel.dropped.o === 12 && Object.keys(sel.dropped).every(k => k === 'p' || k === 'd' || k === 'o') && sel.keptOther > 0 && sel.theme === 3, JSON.stringify(sel)));
  const al = await alphaCheck(url, [...tex512, ...tex768]);
  const alphaOk = al.length === 12 && al.every(a => a.corners.every(v => v === 0) && a.centre === 255);
  let shaOk = null, shaNote = 'NOT RUN: no --pack=DIR';
  if (pack) {
    const m = JSON.parse(fs.readFileSync(path.join(pack, 'manifest.json'), 'utf8'));
    let n = 0;
    for (const [size, list] of [[512, tex512], [768, tex768]]) list.forEach((u, i) => { const sha = crypto.createHash('sha256').update(Buffer.from(u.replace('data:image/webp;base64,', ''), 'base64')).digest('hex'); const t = m.tiles.find(x => x.resolution === size && x.variant === L[i]); if (t && t.sha256 === sha) n++; });
    shaOk = n === 12; shaNote = `${n}/12 SHA-256 match the manifest`;
  }
  results.push(report('PS-6 12 textures decode with transparent corners and opaque centre; module bytes == package manifest SHA-256', alphaOk && (shaOk === null || shaOk), `${JSON.stringify(al.map(a => a.w + ':' + a.corners.join('')))} ${shaNote}`));
  const rects = Object.entries(lay.rect).filter(([k]) => { const [i, j] = k.split(',').map(Number); return ROWS[j][i] === 'o'; });
  const insetOk = rects.length === 12 && rects.every(([, r]) => Array.isArray(r) && r.every((v, n) => Math.abs(v - INSET[n]) < 0.002));
  results.push(report('PS-7 every PS lot draws the source rect inside the 9 % / 11 % inset (drawImage 9-arg form), not the whole card', insetOk, JSON.stringify(rects.slice(0, 2))));
  const sh = await shots(url);
  results.push(report('PS-8 screenshots PC 1280x720 + phone 390x844 written after the decode, no JS errors', Object.keys(sh).length === 2 && Object.values(sh).every(v => v.errors === 0 && fs.statSync(v.file).size > 5000), JSON.stringify(sh)));
  return results;
}

if (isMain(import.meta.url)) {
  const arg = process.argv.find(a => a.startsWith('--base='));
  const pk = process.argv.find(a => a.startsWith('--pack='));
  if (!arg) { console.log('NOT RUN: --base=DIR (a worktree of origin/main) is required'); process.exit(1); }
  const base = await serve({ root: path.resolve(arg.slice(7)) });
  const cur = await serve();
  const res = await runPs(cur.url, base.url, pk ? path.resolve(pk.slice(7)) : null);
  cur.server.close(); base.server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} GG-PS-EXACT-6 checks passed`);
  process.exit(failed.length ? 1 : 0);
}
