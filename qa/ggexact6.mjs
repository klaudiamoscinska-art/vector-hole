
// GG-GALERIA-GLITCH-EXACT-6: Arena Galeria Glitch (map key g, canonical district id `galeria`, 14 blocks) lots are the textures GG-A..F.
// Compares THIS checkout (AFTER) with a base checkout (BEFORE, --base=DIR, a git worktree of origin/main):
//  - GG-1 only the 14 `g` Arena chunks change; the other 50 Arena blocks (12 PM plac + 9 TG dachy + 12 PS port + 13 PI park + 4 core) and every Campaign floor (plac/park/dachy/port/galeria themes) are identical
//  - GG-2 undecodable textures -> exactly the old vector lots (every chunk == the base with undecodable textures)
//  - GG-3 the 14 blocks draw the textures exactly as mapped (read from the live floor painter); 12 PM, 9 TG, 12 PS and 13 PI blocks still PM / TG / PS / PI
//  - GG-4 gfx 0 draws 512 px, gfx 1-2 768 px GG textures
//  - GG-5 a texture load drops only the chunk cache of a textured district (plac/dachy/port/park/galeria; rdzen/Campaign entries survive)
//  - GG-6 the 12 textures decode with transparent corners (alpha) and (with --pack=DIR) match the package manifest SHA-256
//  - GG-7 the lot draws the source rect inside the TG-style inset (9 % left/right, 11 % top/bottom), not the whole card
//  - GG-8 real screenshots, PC 1280x720 and phone 390x844, sector g with its sign, Port and Dachy in view, after the lazy decode -> qa/out/gg-exact6/ (+ no JS errors)
// Usage: node qa/ggexact6.mjs --base=../vh-gg-base [--pack=DIR]
import { serve, openGame, veteranSave, report, QA_RANDOM, OUT, isMain } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const READY = () => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state;
const DEST = path.join(OUT, 'gg-exact6');
const FRAMES = { pc: { w: 1280, h: 720, mobile: false, dsf: 1 }, mobile: { w: 390, h: 844, mobile: true, dsf: 2 } };
// expected texture per Arena block, row = y, column = x ('.' = not a `k` block)
const MAP = ['........', '........', '........', '........', '........', '...CEF..', '..DAFBE.', '..BCEDAF'];
const ROWS = ['pppkkkkk', 'ppppkkkk', 'ppppkkkd', 'oopRRkdd', 'oooRRddd', 'ooogggdd', 'oogggggd', 'oogggggg'];
const KEY_RE = new RegExp('^\\*\\|(\\d+)\\|(\\d+)$');
const isG = (k) => { const m = KEY_RE.exec(k); return !!m && ROWS[+m[2]][+m[1]] === 'g'; };
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

/** Hash of every cached chunk canvas: the whole Arena + Campaign plac / park / dachy / port / galeria floors. */
const HASHES = `(async () => {
  const gm = window.game, out = {};
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const h = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let a = 2166136261; for (let i = 0; i < d.length; i += 3) a = Math.imul(a ^ d[i], 16777619); return (a >>> 0).toString(16); };
  gm.applyGfx(2);
  const fl = new gm.cityFloor.constructor();
  for (const theme of [null, 'plac', 'park', 'dachy', 'port', 'galeria']) {
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
    fl.render(0, 0, 1, 'park', null); fl.render(1, 1, 1, 'dachy', null); fl.render(1, 1, 1, 'port', null); fl.render(1, 1, 1, 'galeria', null);
    const refs = new Map(fl.cache);
    await sleep(1800);
    const dist = (k) => { const m = re.exec(k); return m ? ROWS[+m[2]][+m[1]] : 'T'; };
    const dropped = {}; let keptOther = 0, theme = 0;
    for (const [k, e] of refs) {
      const d = dist(k);
      if (fl.cache.get(k) !== e) dropped[d] = (dropped[d] || 0) + 1;
      else if (d === 'T') theme++;
      else if (d !== 'p' && d !== 'd' && d !== 'o' && d !== 'k' && d !== 'g') keptOther++;
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
      gm.player.x = 3.9 * 375; gm.player.y = 5.2 * 375;
      for (let k = 0; k < 4; k++) gm.update(1 / 60);
      gm.zoom = innerWidth > 800 ? 0.5 : 0.3;
    });
    await g.page.evaluate(() => { for (let k = 0; k < 6; k++) window.game.render(k / 60); }); // 1st paint starts the lazy decode (vector fallback)
    await g.page.waitForTimeout(1800);
    await g.page.evaluate(() => { for (let k = 0; k < 6; k++) window.game.render(k / 60); });
    const file = path.join(DEST, `gg-${frame}-galeria.png`);
    await g.page.screenshot({ path: file });
    out[frame] = { file, errors: g.errors.length };
    if (g.errors.length) console.log('  errors', frame, g.errors.slice(0, 3));
    await g.browser.close();
  }
  return out;
}

const urls = (f) => [...fs.readFileSync(f, 'utf8').matchAll(/'(data:image\/webp;base64,[^']+)'/g)].map(m => m[1]);

export async function runPi(url, baseUrl, pack) {
  const results = [];
  const after = await hashes(url);
  const before = await hashes(baseUrl);
  const keys = Object.keys(after), arena = keys.filter(k => k[0] === '*'), theme = keys.filter(k => k[0] !== '*');
  const changed = keys.filter(k => after[k] !== before[k]);
  results.push(report('GG-1 only the 14 Arena `g` chunks change; 50 other Arena blocks (12 PM + 9 TG + 12 PS + 13 PI + 4 core) and all Campaign floors identical', arena.length === 64 && theme.length > 0 && changed.length === 14 && changed.every(isG) && arena.filter(isG).length === 14, `arena ${arena.length}, campaign ${theme.length}, changed ${changed.length}: ${changed.join(' ')}`));
  const broken = await hashes(url, BREAK), brokenBase = await hashes(baseUrl, BREAK);
  const differs = keys.filter(k => broken[k] !== brokenBase[k]);
  results.push(report('GG-2 undecodable textures -> the old vector lots (every chunk == BEFORE)', differs.length === 0, differs.length ? differs.join(' ') : 'identical'));
  const tex768 = urls('gg-tex-768.js'), tex512 = urls('gg-tex-512.js'), pm = urls('pm-tex-768.js'), tg = urls('tg-tex-768.js'), ps = urls('ps-tex-768.js'), pi = urls('pi-tex-768.js');
  const L = 'ABCDEF';
  const lay = await layoutAndSizes(url, 2);
  const grid = {}; let pmBlocks = 0, tgBlocks = 0, psBlocks = 0, piBlocks = 0;
  for (const [k, s] of Object.entries(lay.seen)) { const [i, j] = k.split(',').map(Number); if (ROWS[j][i] === 'g') grid[k] = L[tex768.indexOf(s)] || '?'; else if (pm.includes(s)) pmBlocks++; else if (tg.includes(s)) tgBlocks++; else if (ps.includes(s)) psBlocks++; else if (pi.includes(s)) piBlocks++; }
  const wrong = []; let right = 0;
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if (ROWS[j][i] === 'g') { const w = MAP[j][i]; if (grid[i + ',' + j] === w) right++; else wrong.push(`${i},${j}=${grid[i + ',' + j]}!=${w}`); }
  const counts = {}; Object.values(grid).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  const WANT = { A: 2, B: 2, C: 2, D: 2, E: 3, F: 3 };
  let sideEq = 0; // no two side-neighbouring Galeria blocks share a texture
  for (const k of Object.keys(grid)) { const [i, j] = k.split(',').map(Number); for (const n of [`${i + 1},${j}`, `${i},${j + 1}`]) if (grid[n] === grid[k]) sideEq++; }
  results.push(report('GG-3 the 14 `g` blocks draw GG textures exactly as mapped ((3,5)=C (4,5)=E (5,5)=F (2,6)=D (3,6)=A (4,6)=F (5,6)=B (6,6)=E (2,7)=B (3,7)=C (4,7)=E (5,7)=D (6,7)=A (7,7)=F; A2 B2 C2 D2 E3 F3, no equal side neighbours); 12 PM, 9 TG, 12 PS and 13 PI blocks unchanged', right === 14 && !wrong.length && Object.keys(grid).length === 14 && L.split('').every(v => counts[v] === WANT[v]) && sideEq === 0 && pmBlocks === 12 && tgBlocks === 9 && psBlocks === 12 && piBlocks === 13 && tex768.length === 6 && tex512.length === 6, `${right}/14 ${wrong.join(' ')} counts ${JSON.stringify(counts)} sideEq ${sideEq} pm ${pmBlocks} tg ${tgBlocks} ps ${psBlocks} pi ${piBlocks}`));
  for (const [gfx, want] of [[0, 512], [1, 768], [2, 768]]) {
    const s = await layoutAndSizes(url, gfx);
    const gg = Object.entries(s.seen).filter(([k]) => { const [i, j] = k.split(',').map(Number); return ROWS[j][i] === 'g'; });
    const set = want === 512 ? tex512 : tex768;
    results.push(report(`GG-4 gfx ${gfx} draws the ${want} px GG textures on all 14 blocks`, gg.length === 14 && gg.every(([, v]) => set.includes(v)) && s.widths.length > 0 && s.widths.every(w => w === want), JSON.stringify(s.widths)));
  }
  const sel = await selective(url);
  results.push(report('GG-5 a texture decode drops only plac/dachy/port/park/galeria chunks; rdzen and Campaign cache entries survive', sel.dropped.p === 12 && sel.dropped.d === 9 && sel.dropped.o === 12 && sel.dropped.k === 13 && sel.dropped.g === 14 && Object.keys(sel.dropped).every(k => 'pdokg'.includes(k)) && sel.keptOther > 0 && sel.theme === 4, JSON.stringify(sel)));
  const al = await alphaCheck(url, [...tex512, ...tex768]);
  const alphaOk = al.length === 12 && al.every(a => a.corners.every(v => v === 0) && a.centre === 255);
  let shaOk = null, shaNote = 'NOT RUN: no --pack=DIR';
  if (pack) {
    const m = JSON.parse(fs.readFileSync(path.join(pack, 'manifest.json'), 'utf8'));
    let n = 0;
    for (const [size, list] of [[512, tex512], [768, tex768]]) list.forEach((u, i) => { const sha = crypto.createHash('sha256').update(Buffer.from(u.replace('data:image/webp;base64,', ''), 'base64')).digest('hex'); const t = m.tiles.find(x => x.resolution === size && x.variant === L[i]); if (t && t.sha256 === sha) n++; });
    shaOk = n === 12; shaNote = `${n}/12 SHA-256 match the manifest`;
  }
  results.push(report('GG-6 12 textures decode with transparent corners and opaque centre; module bytes == package manifest SHA-256', alphaOk && (shaOk === null || shaOk), `${JSON.stringify(al.map(a => a.w + ':' + a.corners.join('') + '/' + a.centre))} ${shaNote}`));
  const rects = Object.entries(lay.rect).filter(([k]) => { const [i, j] = k.split(',').map(Number); return ROWS[j][i] === 'g'; });
  const insetOk = rects.length === 14 && rects.every(([, r]) => Array.isArray(r) && r.every((v, n) => Math.abs(v - INSET[n]) < 0.002));
  results.push(report('GG-7 every GG lot draws the source rect inside the 9 % / 11 % inset (drawImage 9-arg form), not the whole card', insetOk, JSON.stringify(rects.slice(0, 2))));
  const sh = await shots(url);
  results.push(report('GG-8 screenshots PC 1280x720 + phone 390x844 written after the decode, no JS errors', Object.keys(sh).length === 2 && Object.values(sh).every(v => v.errors === 0 && fs.statSync(v.file).size > 5000), JSON.stringify(sh)));
  return results;
}

if (isMain(import.meta.url)) {
  const arg = process.argv.find(a => a.startsWith('--base='));
  const pk = process.argv.find(a => a.startsWith('--pack='));
  if (!arg) { console.log('NOT RUN: --base=DIR (a worktree of origin/main) is required'); process.exit(1); }
  const base = await serve({ root: path.resolve(arg.slice(7)) });
  const cur = await serve();
  const res = await runPi(cur.url, base.url, pk ? path.resolve(pk.slice(7)) : null);
  cur.server.close(); base.server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} GG-GALERIA-GLITCH-EXACT-6 checks passed`);
  process.exit(failed.length ? 1 : 0);
}
