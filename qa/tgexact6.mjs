// GG-TG-EXACT-6: Arena Dachy Prądu (map key d, 9 blocks) lots are the Tech Grid textures TG-A..F.
// Compares THIS checkout (AFTER) with a base checkout (BEFORE, --base=DIR, a git worktree of origin/main):
//  - TG-1 only the 9 `d` Arena chunks change; the other 55 Arena blocks (12 PM plac incl.) and every Campaign floor are identical
//  - TG-2 undecodable textures -> exactly the old vector lots (every chunk == the base with undecodable textures, i.e. all vector)
//  - TG-3 the 9 blocks draw the textures exactly as mapped (read from the live floor painter)
//  - TG-4 gfx 0 draws 512 px, gfx 1-2 768 px TG textures
//  - TG-5 the texture load drops only the chunk cache of its own district (park/port/galeria/rdzen/Campaign entries survive)
//  - TG-6 real screenshots, PC 1280x720 and phone 390x844, sector d in view -> qa/out/tg-exact6/ (+ no JS errors)
// Usage: node qa/tgexact6.mjs --base=../vh-tg-base
import { serve, openGame, veteranSave, report, QA_RANDOM, OUT, isMain } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const READY = () => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state;
const DEST = path.join(OUT, 'tg-exact6');
const FRAMES = { pc: { w: 1280, h: 720, mobile: false, dsf: 1 }, mobile: { w: 390, h: 844, mobile: true, dsf: 2 } };
// expected texture per Arena block, row = y, column = x ('.' = not a `d` block)
const MAP = ['........', '........', '.......C', '......AE', '.....FBD', '......EA', '.......B', '........'];
const ROWS = ['pppkkkkk', 'ppppkkkk', 'ppppkkkd', 'oopRRkdd', 'oooRRddd', 'ooogggdd', 'oogggggd', 'oogggggg'];
const KEY_RE = new RegExp('^\\*\\|(\\d+)\\|(\\d+)$');
const isD = (k) => { const m = KEY_RE.exec(k); return !!m && ROWS[+m[2]][+m[1]] === 'd'; };

async function session(url, frame, { initScript = null } = {}) {
  const f = FRAMES[frame];
  const g = await openGame(url, { viewport: { width: f.w, height: f.h }, mobile: f.mobile, deviceScaleFactor: f.dsf, initScript: QA_RANDOM + (initScript || '') });
  const s = await veteranSave(g.page, { missions: 29, coins: 800, runsPlayed: 12 });
  await g.page.evaluate((v) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(v)), s);
  await g.page.reload();
  await g.page.waitForFunction(READY);
  return g;
}

/** Hash of every cached chunk canvas: the whole Arena + Campaign plac / park / dachy floors. */
const HASHES = `(async () => {
  const gm = window.game, out = {};
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const h = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let a = 2166136261; for (let i = 0; i < d.length; i += 3) a = Math.imul(a ^ d[i], 16777619); return (a >>> 0).toString(16); };
  gm.applyGfx(2);
  const fl = new gm.cityFloor.constructor();
  for (const theme of [null, 'plac', 'park', 'dachy']) {
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

/** drawImage hook: records the data URL and natural width of every texture painted per block. */
const HOOK = `(() => { const o = CanvasRenderingContext2D.prototype.drawImage; window.__cur = null; window.__seen = {}; window.__w = {};
  CanvasRenderingContext2D.prototype.drawImage = function (im) { if (im instanceof HTMLImageElement && window.__cur) { window.__seen[window.__cur] = im.src; window.__w[im.naturalWidth] = 1; } return o.apply(this, arguments); }; })();`;

async function layoutAndSizes(url, gfx) {
  const g = await session(url, 'pc', { initScript: HOOK });
  const r = await g.page.evaluate(async ([gfx]) => {
    const gm = window.game, sleep = (ms) => new Promise(r => setTimeout(r, ms));
    gm.applyGfx(gfx);
    const fl = new gm.cityFloor.constructor();
    fl.rich = gfx > 0;
    for (let k = 0; k < 2; k++) {
      window.__seen = {}; window.__w = {};
      for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { window.__cur = i + ',' + j; fl.render(i, j, 1, null, fl.cache.get('*|' + i + '|' + j) || null); }
      if (k === 0) await sleep(1200);
    }
    return { seen: window.__seen, widths: Object.keys(window.__w).map(Number) };
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
    fl.render(0, 0, 1, 'park', null); fl.render(1, 1, 1, 'dachy', null);
    const refs = new Map(fl.cache);
    await sleep(1500);
    const dist = (k) => { const m = re.exec(k); return m ? ROWS[+m[2]][+m[1]] : 'T'; };
    const dropped = {}; let keptOther = 0, theme = 0;
    for (const [k, e] of refs) {
      const d = dist(k);
      if (fl.cache.get(k) !== e) dropped[d] = (dropped[d] || 0) + 1;
      else if (d === 'T') theme++;
      else if (d !== 'p' && d !== 'd') keptOther++;
    }
    return { dropped, keptOther, theme };
  });
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
      gm.player.x = 6.5 * 375; gm.player.y = 3.9 * 375;
      for (let k = 0; k < 4; k++) gm.update(1 / 60);
      gm.zoom = innerWidth > 800 ? 0.62 : 0.5;
    });
    await g.page.evaluate(() => { for (let k = 0; k < 6; k++) window.game.render(k / 60); }); // 1st paint starts the lazy decode (vector fallback)
    await g.page.waitForTimeout(1500);
    await g.page.evaluate(() => { for (let k = 0; k < 6; k++) window.game.render(k / 60); });
    const file = path.join(DEST, `tg-${frame}-dachy.png`);
    await g.page.screenshot({ path: file });
    out[frame] = { file, errors: g.errors.length };
    if (g.errors.length) console.log('  errors', frame, g.errors.slice(0, 3));
    await g.browser.close();
  }
  return out;
}

const urls = (f) => [...fs.readFileSync(f, 'utf8').matchAll(/'(data:image\/webp;base64,[^']+)'/g)].map(m => m[1]);

export async function runTg(url, baseUrl) {
  const results = [];
  const after = await hashes(url);
  const before = await hashes(baseUrl);
  const keys = Object.keys(after), arena = keys.filter(k => k[0] === '*'), theme = keys.filter(k => k[0] !== '*');
  const changed = keys.filter(k => after[k] !== before[k]);
  results.push(report('TG-1 only the 9 Arena `d` chunks change; 55 other Arena blocks (12 PM incl.) and all Campaign floors identical', arena.length === 64 && theme.length > 0 && changed.length === 9 && changed.every(isD) && arena.filter(isD).length === 9, `arena ${arena.length}, campaign ${theme.length}, changed ${changed.length}: ${changed.join(' ')}`));
  const broken = await hashes(url, BREAK), brokenBase = await hashes(baseUrl, BREAK);
  const differs = keys.filter(k => broken[k] !== brokenBase[k]);
  results.push(report('TG-2 undecodable textures -> the old vector lots (every chunk == BEFORE)', differs.length === 0, differs.length ? differs.join(' ') : 'identical'));
  const tex768 = urls('tg-tex-768.js'), tex512 = urls('tg-tex-512.js'), pm = urls('pm-tex-768.js');
  const L = 'ABCDEF';
  const lay = await layoutAndSizes(url, 2);
  const grid = {}; let pmBlocks = 0;
  for (const [k, s] of Object.entries(lay.seen)) { const [i, j] = k.split(',').map(Number); if (ROWS[j][i] === 'd') grid[k] = L[tex768.indexOf(s)] || '?'; else if (pm.includes(s)) pmBlocks++; }
  const wrong = []; let right = 0;
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if (ROWS[j][i] === 'd') { const w = MAP[j][i]; if (grid[i + ',' + j] === w) right++; else wrong.push(`${i},${j}=${grid[i + ',' + j]}!=${w}`); }
  results.push(report('TG-3 the 9 `d` blocks draw TG textures exactly as mapped (7,2)=C (6,3)=A (7,3)=E (5,4)=F (6,4)=B (7,4)=D (6,5)=E (7,5)=A (7,6)=B; 12 PM blocks still PM', right === 9 && !wrong.length && Object.keys(grid).length === 9 && pmBlocks === 12 && tex768.length === 6 && tex512.length === 6, `${right}/9 ${wrong.join(' ')} pm ${pmBlocks}`));
  for (const [gfx, want] of [[0, 512], [1, 768], [2, 768]]) {
    const s = await layoutAndSizes(url, gfx);
    const tg = Object.entries(s.seen).filter(([k]) => { const [i, j] = k.split(',').map(Number); return ROWS[j][i] === 'd'; });
    const set = want === 512 ? tex512 : tex768;
    results.push(report(`TG-4 gfx ${gfx} draws the ${want} px TG textures on all 9 blocks`, tg.length === 9 && tg.every(([, v]) => set.includes(v)) && s.widths.length > 0 && s.widths.every(w => w === want), JSON.stringify(s.widths)));
  }
  const sel = await selective(url);
  results.push(report('TG-5 a texture decode drops only plac/dachy chunks; park/port/galeria/rdzen and Campaign cache entries survive', sel.dropped.p === 12 && sel.dropped.d === 9 && Object.keys(sel.dropped).every(k => k === 'p' || k === 'd') && sel.keptOther > 0 && sel.theme === 2, JSON.stringify(sel)));
  const sh = await shots(url);
  results.push(report('TG-6 screenshots PC 1280x720 + phone 390x844 written, no JS errors', Object.keys(sh).length === 2 && Object.values(sh).every(v => v.errors === 0 && fs.statSync(v.file).size > 5000), JSON.stringify(sh)));
  return results;
}

if (isMain(import.meta.url)) {
  const arg = process.argv.find(a => a.startsWith('--base='));
  if (!arg) { console.log('NOT RUN: --base=DIR (a worktree of origin/main) is required'); process.exit(1); }
  const base = await serve({ root: path.resolve(arg.slice(7)) });
  const cur = await serve();
  const res = await runTg(cur.url, base.url);
  cur.server.close(); base.server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} GG-TG-EXACT-6 checks passed`);
  process.exit(failed.length ? 1 : 0);
}
