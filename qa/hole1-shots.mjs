// GG-HOLE-01 evidence, not a test: the vortices BEFORE / AFTER, drawn by the
// game's own Hole.draw() (never a mock-up), into qa/out/hole1/:
//   catalog -- every skin and every bot style side by side, on the city floor color;
//   sizes   -- each skin at a small, a medium and a large radius;
//   motion  -- eight consecutive frames (1/15 s apart) of every skin;
//   shots   -- the same Arena frames (seed, camera) early, mid and late in a
//              round, a campaign mission and the Daily Challenge, on a phone
//              (390x844), the CrazyGames frame (800x450) and a desktop
//              (1366x768), plus quality 0; and the Warsztat with its previews.
// BEFORE = another checkout (--root DIR, e.g. a worktree of origin/main),
// AFTER = this one.   node qa/hole1-shots.mjs --root /path/to/base [--only=catalog,sizes,motion,shots]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, allDistrictsSave, frozenDateScript, QA_RANDOM, ROOT, OUT } from './lib.mjs';

const SKIN_IDS = ['rainbow', 'cyan', 'pink', 'green', 'purple', 'gold', 'white', 'aurora', 'krysztal', 'pryzmat'];

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); if (a) return a.slice(k.length + 3); const i = process.argv.indexOf(`--${k}`); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const DIR = path.join(OUT, 'hole1');
const ONLY = (opt('only', 'catalog,sizes,motion,shots')).split(',');
const BOT_STYLES = ['tech', 'plasma', 'toxic', 'galaxy', 'crystal', 'sun'];
const BOT_COLORS = ['#FF54AD', '#46D99A', '#EFCB63', '#9875FF', '#50F0FA', '#ff3860'];
export const FRAMES = { iphone: { width: 390, height: 844, mobile: true }, crazygames: { width: 800, height: 450, mobile: false }, desktop: { width: 1366, height: 768, mobile: false } };

/** A served copy of a checkout whose game.js also exports Hole. */
function sheetRoot(root, name) {
  const dir = path.join(DIR, '.sheet-' + name);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['index.html', 'style.css']) fs.copyFileSync(path.join(root, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'game.js'), fs.readFileSync(path.join(root, 'game.js'), 'utf8') + '\nexport { Hole as __qaHole };\n');
  return dir;
}

/** Draws `cells` ({skin|style+color, r, x, y, t, label}) with Hole.draw() and saves the canvas. */
async function sheet(page, file, W, H, cells, title) {
  const png = await page.evaluate(async ({ W, H, cells, title }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
    const dpr = 2;
    const cv = document.createElement('canvas');
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    c.fillStyle = '#0B1B2E'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(80,240,250,0.07)'; c.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    for (const cell of cells) {
      const h = new m.__qaHole('', cell.x, cell.y, !cell.style);
      if (cell.style) { h.skin = 'custom'; h.edgeColor = cell.color; h.styleOverride = cell.style; } else h.skin = cell.skin;
      h.radius = cell.r;
      h.draw(c, cell.t);
      if (cell.label) {
        c.font = '700 12px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = '#f2f8ff'; c.fillText(cell.label, cell.x, cell.ly);
      }
    }
    c.font = '700 14px sans-serif'; c.textAlign = 'left'; c.fillStyle = '#50F0FA'; c.fillText(title, 12, 16);
    return cv.toDataURL('image/png');
  }, { W, H, cells, title });
  fs.writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'));
}

async function sheets(root, name) {
  const server = await serve({ root: sheetRoot(root, name) });
  const { browser, page, errors } = await openGame(server.url, { viewport: { width: 800, height: 600 }, mobile: false });
  const skins = await page.evaluate(() => SKINS.map(s => [s.id, s.name]));
  const T = 7.3;
  if (ONLY.includes('catalog')) {
    const cw = 190, ch = 210, cols = 5;
    const cells = skins.map(([skin, label], i) => ({ skin, label, r: 58, x: (i % cols) * cw + cw / 2, y: Math.floor(i / cols) * ch + ch / 2 + 6, ly: (Math.floor(i / cols) + 1) * ch - 8, t: T }));
    BOT_STYLES.forEach((style, i) => cells.push({ style, color: BOT_COLORS[i], label: 'rywal · ' + style, r: 46, x: i * 158 + 80, y: 2 * ch + 100, ly: 2 * ch + 188, t: T }));
    await sheet(page, path.join(DIR, `catalog-${name}.png`), cols * cw, 2 * ch + 200, cells, `GG-HOLE-01 · katalog wirów · ${name.toUpperCase()}`);
  }
  if (ONLY.includes('sizes')) {
    const cells = [];
    skins.forEach(([skin, label], i) => {
      const y = 70 + i * 215;
      [[12, 60], [18, 130], [34, 240], [62, 400], [100, 640]].forEach(([r, x], k) => cells.push({ skin, r, x, y: y + 40, t: T, label: k === 0 ? label : `r = ${r}`, ly: y + 150 }));
    });
    await sheet(page, path.join(DIR, `sizes-${name}.png`), 780, skins.length * 215 + 40, cells, `GG-HOLE-01 · rozmiary (mały / średni / duży) · ${name.toUpperCase()}`);
  }
  if (ONLY.includes('motion')) {
    const cells = [];
    skins.forEach(([skin, label], i) => {
      for (let k = 0; k < 8; k++) cells.push({ skin, r: 40, x: 60 + k * 112, y: 76 + i * 128, t: T + k / 15, label: k === 0 ? label : `+${(k / 15).toFixed(2)} s`, ly: 136 + i * 128 });
    });
    await sheet(page, path.join(DIR, `motion-${name}.png`), 910, skins.length * 128 + 30, cells, `GG-HOLE-01 · ruch: 8 kolejnych klatek co 1/15 s · ${name.toUpperCase()}`);
  }
  await browser.close(); server.server.close();
  return errors;
}

/** Real rounds: identical seed, camera, positions and clock for both variants.
 *  [id, kind, player skin, player radius, rivals' radius, quality] */
const SCENES = [
  ['arena-1-start', 'arena', 'rainbow', 18, 20, 2],
  ['arena-2-mid', 'arena', 'purple', 62, 44, 2],
  ['arena-3-late', 'arena', 'gold', 190, 120, 2],
  ['arena-4-late-horizon', 'arena', 'rainbow', 190, 120, 2],
  ['arena-5-late-q0', 'arena', 'white', 190, 120, 0],
  ['campaign-m12', 'campaign', 'krysztal', 46, 0, 2],
  ['daily', 'daily', 'pink', 40, 34, 2]
];
const FROZEN_T = 600000;

async function stage(page, [, kind, skin, pr, br, gfx]) {
  return page.evaluate(async ({ kind, skin, pr, br, gfx, FROZEN_T }) => {
    const g = window.game;
    const real = window.__realNow || (window.__realNow = performance.now.bind(performance));
    window.__qaSeedRandom(7);
    g.applyGfx(gfx);
    if (kind === 'arena') g.startRound({ seed: 4242 });
    else if (kind === 'daily') g.startDailyChallenge();
    else { g.missionBoosters = []; g.startCampaignMission('M12'); if (g.introPending) g.beginMissionPlay(); }
    if (g.rafId) cancelAnimationFrame(g.rafId);
    g.running = false;
    performance.now = () => FROZEN_T;
    const p = g.player, campaign = kind === 'campaign';
    p.skin = skin;
    const spot = campaign ? [p.x, p.y] : [WORLD_W / 2, WORLD_H / 2];
    const place = () => {
      p.radius = pr; p.x = spot[0]; p.y = spot[1]; p.vx = p.vy = 0; p.growPopAt = 0; p.invulnerableUntil = 0;
      if (!campaign) g.bots.forEach((b, i) => {
        const a = i / g.bots.length * Math.PI * 2 + 0.5, d = pr * 1.5 + br * 1.6 + 60 + (i % 2) * br;
        b.radius = br * (0.7 + i * 0.12); b.x = spot[0] + Math.cos(a) * d; b.y = spot[1] + Math.sin(a) * d * 0.8; b.vx = b.vy = 0; b.growPopAt = 0; b.invulnerableUntil = 0;
      });
    };
    for (let k = 0; k < 200; k++) { place(); if (campaign) g.updateCampaign(1 / 60); else g.update(1 / 60); }
    place();
    g.banner = null; g.bannerQueue = [];
    g.particles = []; g.ripples = []; g.floatTexts = []; g.shake = 0; g.flashAlpha = 0;
    if (campaign) { const b = CONFIG.campaign.bounds; g.followCamera(b.minX, b.minY, b.maxX, b.maxY); } else g.followCamera(0, 0, WORLD_W, WORLD_H);
    const draw = (t) => (campaign ? g.renderCampaign(t) : g.render(t));
    for (let k = 0; k < 40; k++) draw(FROZEN_T / 1000);
    const times = [];
    for (let k = 0; k < 60; k++) { const t0 = real(); draw(FROZEN_T / 1000 + k / 60); g.ctx.getImageData(0, 0, 1, 1); times.push(real() - t0); }
    times.sort((a, b) => a - b);
    let h = 0x811c9dc5;
    for (const o of (campaign ? g.campaignEntities : g.objects)) for (const v of [Math.round(o.x * 100), Math.round(o.y * 100), Math.round(o.radius * 100)]) { h ^= v; h = Math.imul(h, 0x01000193) >>> 0; }
    await new Promise(r => setTimeout(r, 120));
    draw(FROZEN_T / 1000);
    return { layoutHash: h.toString(16), randomCalls: window.__qaRandomCalls, zoom: +g.zoom.toFixed(3), frameMsMedian: +times[30].toFixed(2), frameMsP90: +times[54].toFixed(2) };
  }, { kind, skin, pr, br, gfx, FROZEN_T });
}

async function shots(root, name) {
  const server = await serve({ root });
  const errors = [], facts = {};
  for (const [frame, vp] of Object.entries(FRAMES)) {
    const g = await openGame(server.url, { viewport: { width: vp.width, height: vp.height }, mobile: vp.mobile, initScript: `${frozenDateScript('2026-11-10')}\n${QA_RANDOM}` });
    const save = await allDistrictsSave(g.page);
    save.owned = SKIN_IDS; save.selected = 'purple';
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
    // Warsztat first (the live menu), then the frozen rounds.
    await g.page.evaluate(() => document.getElementById('btnNavWarsztat').click());
    await g.page.waitForTimeout(900);
    await g.page.screenshot({ path: path.join(DIR, `workshop-${frame}-${name}.png`) });
    for (const scene of SCENES) {
      if (scene[5] === 0 && frame !== 'iphone') continue;
      facts[`${scene[0]}@${frame}`] = await stage(g.page, scene);
      await g.page.screenshot({ path: path.join(DIR, `${scene[0]}-${frame}-${name}.png`) });
    }
    errors.push(...g.errors.map(e => `${frame}: ${e}`));
    await g.browser.close();
  }
  server.server.close();
  fs.writeFileSync(path.join(DIR, `facts-${name}.json`), JSON.stringify(facts, null, 1));
  return errors;
}

fs.mkdirSync(DIR, { recursive: true });
const base = opt('root', null);
const variants = [['after', ROOT]].concat(base ? [['before', path.resolve(base)]] : []);
let failed = false;
for (const [name, root] of variants) {
  const errors = [];
  if (ONLY.some(o => ['catalog', 'sizes', 'motion'].includes(o))) errors.push(...await sheets(root, name));
  if (ONLY.includes('shots')) errors.push(...await shots(root, name));
  console.log(`${name}: ${errors.length ? 'console errors:\n  ' + errors.join('\n  ') : 'no console errors'}`);
  if (errors.length) failed = true;
}
if (ONLY.includes('shots') && fs.existsSync(path.join(DIR, 'facts-before.json'))) {
  // The stage must not move a thing: same layout, same Math.random draws; and the frame cost side by side.
  const [a, b] = ['after', 'before'].map(n => JSON.parse(fs.readFileSync(path.join(DIR, `facts-${n}.json`), 'utf8')));
  for (const k of Object.keys(a)) {
    const same = a[k].layoutHash === b[k].layoutHash && a[k].randomCalls === b[k].randomCalls;
    if (!same) failed = true;
    console.log(`${same ? 'PASS' : 'FAIL'} ${k}: layout+RNG ${same ? 'identical' : 'DIFFER'} · frame median ${b[k].frameMsMedian} -> ${a[k].frameMsMedian} ms · p90 ${b[k].frameMsP90} -> ${a[k].frameMsP90} ms`);
  }
}
console.log('written to ' + DIR);
process.exit(failed ? 1 : 0);
