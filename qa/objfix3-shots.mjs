// GG-OBJECTS-FIX-03 evidence, not a test: BEFORE (base checkout) / AFTER real Arena frames, PC 1280x720 (DPR 1) and phone 390x844 (DPR 2),
// on the lightest (k = Park Impulsów) and the darkest (g = Galeria Glitch) sector floor, at the round's start zoom (PC 1.47, phone 1.08).
//   node qa/objfix3-shots.mjs --root=DIR (the BEFORE checkout)  ->  qa/out/objfix3/shots/
// Scenes: staged-<sector> = seed 2024 with one object of each of the 21 kinds MOVED next to each other (qa/objraster2-shots.mjs stageScene);
//         natural-<sector> = the unmodified round (seed 2024), camera on the sector's centroid (the layout itself differs: no overlaps after).
// t1zoom-<frame>-<sector>.png = the staged T1 pair cropped from BEFORE and AFTER, x4 nearest neighbour, side by side.
//   --only=full,pulse,overlap (default full): pulse = t1-pulse-trough-peak.png (BEFORE / AFTER, trough and peak, light and dark floor);
//   overlap = overlap-<case>.png (REVIEW-01: objects the BASE spawned on each other, and the same seed and frame AFTER).
import fs from 'node:fs';
import path from 'node:path';
import { serve, OUT, ROOT, isMain } from './lib.mjs';
import { session, stageScene, paintAfterDecode, exportedRoot } from './objraster2-shots.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const DIR = path.join(OUT, 'objfix3', 'shots');
const ZOOM = { pc: 1.08 * Math.sqrt(1280 * 720 / 500000), mobile: 1.08 };

async function shoot(url, name, crops) {
  const files = {};
  for (const frame of ['pc', 'mobile']) {
    const g = await session(url, frame);
    try {
      for (const sector of ['k', 'g']) {
        for (const staged of [true, false]) {
          await stageScene(g.page, { sector, staged, zoom: ZOOM[frame] });
          // the staged block is taller than the view at the start zoom: the camera moves down so the T1 row sits ~120 px below the top
          if (staged) await g.page.evaluate(() => { const gm = window.game, f = gm.objects.find(o => o.subtype === 'fragment' && !o.eating); gm.camera.y = f.y + (gm.height / 2 - 120) / gm.zoom; });
          await paintAfterDecode(g.page, 1800);
          const scene = `${staged ? 'staged' : 'natural'}-${sector}`;
          const file = path.join(DIR, name, `${frame}-${scene}.png`);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          await g.page.screenshot({ path: file });
          files[`${frame}-${scene}`] = file;
          if (staged) {
            crops[`${frame}-${sector}`] = await g.page.evaluate(() => {
              const gm = window.game, near = (k) => gm.objects.find(o => o.subtype === k && !o.eating);   // the one stageScene() moved
              const f = near('fragment'), k = near('kapsula'), sx = (x) => gm.width / 2 + gm.zoom * (x - gm.camera.x), sy = (y) => gm.height / 2 + gm.zoom * (y - gm.camera.y);
              const x0 = Math.min(sx(f.x), sx(k.x)) - 26 * gm.zoom, x1 = Math.max(sx(f.x), sx(k.x)) + 26 * gm.zoom, y0 = Math.min(sy(f.y), sy(k.y)) - 26 * gm.zoom, y1 = Math.max(sy(f.y), sy(k.y)) + 22 * gm.zoom;
              return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0), dpr: gm.dpr };
            });
          }
        }
      }
    } finally { await g.browser.close(); }
  }
  return files;
}

export async function run(baseRoot) {
  const crops = {};
  const b = await serve({ root: path.resolve(baseRoot) }), a = await serve();
  let before, after;
  try { before = await shoot(b.url, 'before', crops); after = await shoot(a.url, 'after', crops); }
  finally { b.server.close(); }
  // side-by-side T1 close-ups (the staged pair sits at the same screen spot in both)
  const g = await session(a.url, 'pc');
  try {
    for (const key of Object.keys(crops)) {
      const [frame, sector] = key.split('-'), c = crops[key];
      const pair = [before[`${frame}-staged-${sector}`], after[`${frame}-staged-${sector}`]].map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
      const png = await g.page.evaluate(async ({ pair, c, label }) => {
        const load = (u) => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = u; });
        const [A, B] = await Promise.all(pair.map(load));
        const S = 4, w = c.w * c.dpr, h = c.h * c.dpr, gap = 16, top = 30;
        const cv = document.createElement('canvas'); cv.width = w * S * 2 + gap; cv.height = h * S + top;
        const x = cv.getContext('2d'); x.fillStyle = '#05070f'; x.fillRect(0, 0, cv.width, cv.height); x.imageSmoothingEnabled = false;
        x.drawImage(A, c.x * c.dpr, c.y * c.dpr, w, h, 0, top, w * S, h * S);
        x.drawImage(B, c.x * c.dpr, c.y * c.dpr, w, h, w * S + gap, top, w * S, h * S);
        x.fillStyle = '#f2f8ff'; x.font = '700 15px sans-serif';
        x.fillText('BEFORE ' + label, 8, 20); x.fillText('AFTER ' + label, w * S + gap + 8, 20);
        return cv.toDataURL('image/png').split(',')[1];
      }, { pair, c, label: `${frame} ${sector === 'k' ? 'Park Impulsow (lightest floor)' : 'Galeria Glitch (darkest floor)'} x4` });
      fs.writeFileSync(path.join(DIR, `t1zoom-${frame}-${sector}.png`), Buffer.from(png, 'base64'));
    }
  } finally { await g.browser.close(); a.server.close(); }
  fs.writeFileSync(path.join(DIR, 'crops.json'), JSON.stringify(crops, null, 1));
  console.log(`shots -> ${path.relative(ROOT, DIR)} (${Object.keys(before).length + Object.keys(after).length} frames, ${Object.keys(crops).length} close-ups)`);
}

/** Images in a grid (PNG files or base64 data, optional clip), x S nearest neighbour, labelled; drawn with the page's canvas. */
async function compose(page, cells, cols, S, file) {
  const data = cells.map(c => ({ src: 'data:image/png;base64,' + (c.png || fs.readFileSync(c.file).toString('base64')), label: c.label }));
  const png = await page.evaluate(async ({ data, cols, S }) => {
    const load = (u) => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = u; });
    const ims = await Promise.all(data.map(d => load(d.src)));
    const cw = Math.max(...ims.map(i => i.width)) * S, ch = Math.max(...ims.map(i => i.height)) * S, gap = 12, top = 26;
    const rows = Math.ceil(data.length / cols), cv = document.createElement('canvas');
    cv.width = cols * cw + (cols - 1) * gap; cv.height = rows * (ch + top) + (rows - 1) * gap;
    const x = cv.getContext('2d'); x.fillStyle = '#05070f'; x.fillRect(0, 0, cv.width, cv.height); x.imageSmoothingEnabled = false;
    data.forEach((d, i) => {
      const cx = (i % cols) * (cw + gap), cy = Math.floor(i / cols) * (ch + top + gap);
      x.drawImage(ims[i], 0, 0, ims[i].width, ims[i].height, cx, cy + top, ims[i].width * S, ims[i].height * S);
      x.fillStyle = '#f2f8ff'; x.font = '700 14px sans-serif'; x.fillText(d.label, cx + 6, cy + 18);
    });
    return cv.toDataURL('image/png').split(',')[1];
  }, { data, cols, S });
  fs.writeFileSync(file, Buffer.from(png, 'base64'));
}

/** T1 at the trough and the peak of its pulse (same bob), drawn by the game's drawObjectArt on the real floor of the lightest (k) and
 *  the darkest (g) sector, PC start zoom: BEFORE row (base) and AFTER row, x4. */
async function pulse(baseRoot) {
  const out = {};
  for (const [name, root] of [['before', path.resolve(baseRoot)], ['after', ROOT]]) {
    const srv = await serve({ root: exportedRoot(root, 'fix3-' + name) });
    const g = await session(srv.url, 'pc');
    try {
      for (const sector of ['k', 'g']) {
        await stageScene(g.page, { sector, staged: true, zoom: ZOOM.pc });
        await g.page.evaluate(() => { const gm = window.game, f = gm.objects.find(o => o.subtype === 'fragment' && !o.eating); gm.camera.y = f.y + (gm.height / 2 - 120) / gm.zoom; });
        await paintAfterDecode(g.page, 1800);
        out[name + '-' + sector] = await g.page.evaluate(async () => {
          const m = await import(document.querySelector('script[type="module"][src]').src);
          const gm = window.game, c = gm.canvas, D = gm.zoom * gm.dpr, pair = ['fragment', 'kapsula'].map(k => gm.objects.find(o => o.subtype === k && !o.eating));
          const saved = pair.map(o => [o.x, o.y]); pair.forEach(o => { o.x += 100000; });
          for (let k = 0; k < 3; k++) gm.render(600);
          pair.forEach((o, i) => { o.x = saved[i][0]; o.y = saved[i][1]; });
          const sx = (x) => Math.round(gm.dpr * (gm.width / 2 + gm.zoom * (x - gm.camera.x))), sy = (y) => Math.round(gm.dpr * (gm.height / 2 + gm.zoom * (y - gm.camera.y)));
          const x0 = Math.min(sx(pair[0].x), sx(pair[1].x)) - 26, y0 = Math.min(sy(pair[0].y), sy(pair[1].y)) - 28, w = Math.abs(sx(pair[0].x) - sx(pair[1].x)) + 52, h = 56;
          const floor = c.getContext('2d').getImageData(x0, y0, w, h), T = Math.PI / 2 / 0.74, res = {};
          for (const [ph, t, seed] of [['trough', T, -2.2 * T], ['peak', -T, 2.2 * T]]) {
            const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
            const x = cv.getContext('2d'); x.putImageData(floor, 0, 0);
            for (const o of pair) { x.setTransform(D, 0, 0, D, sx(o.x) - x0, sy(o.y) - y0); m.__qaDraw(x, o.subtype, o.color, o.radius, t, seed, { raster: true, live: false }); }
            res[ph] = cv.toDataURL('image/png').split(',')[1];
          }
          return res;
        });
      }
    } finally { await g.browser.close(); srv.server.close(); }
  }
  const srv = await serve(), g = await session(srv.url, 'pc');   // a page to compose in
  try {
    const cells = [];
    for (const name of ['before', 'after']) for (const sector of ['k', 'g']) for (const ph of ['trough', 'peak'])
      cells.push({ png: out[name + '-' + sector][ph], label: `${name.toUpperCase()} ${sector === 'k' ? 'Park (jasna)' : 'Galeria (ciemna)'} ${ph === 'trough' ? 'dolina' : 'szczyt'}` });
    await compose(g.page, cells, 4, 4, path.join(DIR, 't1-pulse-trough-peak.png'));
  } finally { await g.browser.close(); srv.server.close(); }
}

/** Unacceptable overlaps found in the BASE at round start (qa/objfix3.mjs overlap-examples.json) and the same spot AFTER, PC start zoom. */
const OVERLAP_CASES = [
  { id: 'seed2024-fragment-on-wiezowiec', seed: 2024, x: 2560, y: 2650 },
  { id: 'seed7-fragment-kapsula-ciezarowka', seed: 7, x: 1100, y: 1610 },
  { id: 'seed1-fragment-in-latarnia', seed: 1, x: 766, y: 440 }
];
async function overlap(baseRoot) {
  const shots = {};
  for (const [name, root] of [['before', path.resolve(baseRoot)], ['after', ROOT]]) {
    const srv = await serve({ root });
    const g = await session(srv.url, 'pc');
    try {
      for (const c of OVERLAP_CASES) {
        await g.page.evaluate(({ seed, x, y, zoom }) => {
          const gm = window.game;
          window.__realNow = window.__realNow || performance.now.bind(performance);
          performance.now = window.__realNow;
          window.__qaSeedRandom(seed); gm.applyGfx(2); gm.startRound({ seed });
          if (gm.rafId) cancelAnimationFrame(gm.rafId); gm.running = false; performance.now = () => 600000;
          gm.player.x = x; gm.player.y = y > 1500 ? y - 900 : y + 900;
          for (const b of gm.bots) { b.x = 150; b.y = 150; }
          gm.zoom = zoom; gm.camera.x = x; gm.camera.y = y;
          gm.banner = null; gm.bannerQueue = []; gm.particles = []; gm.floatTexts = []; gm.shake = 0; gm.flashAlpha = 0;
        }, { seed: c.seed, x: c.x, y: c.y, zoom: ZOOM.pc });
        await paintAfterDecode(g.page, 1500);
        const file = path.join(DIR, name, `overlap-${c.id}.png`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        await g.page.screenshot({ path: file, clip: { x: 640 - 170, y: 360 - 120, width: 340, height: 240 } });
        shots[name + c.id] = file;
      }
    } finally { await g.browser.close(); srv.server.close(); }
  }
  const srv = await serve(), g = await session(srv.url, 'pc');
  try {
    for (const c of OVERLAP_CASES) await compose(g.page, [{ file: shots['before' + c.id], label: `BEFORE ${c.id}` }, { file: shots['after' + c.id], label: 'AFTER (ten sam seed i kadr)' }], 2, 2, path.join(DIR, `overlap-${c.id}.png`));
  } finally { await g.browser.close(); srv.server.close(); }
}

if (isMain(import.meta.url)) {
  const root = opt('root', null), only = opt('only', 'full').split(',');
  if (!root) { console.log('NOT RUN: --root=DIR (the BEFORE checkout) is required'); process.exit(1); }
  (async () => {
    fs.mkdirSync(DIR, { recursive: true });
    if (only.includes('full')) await run(root);
    if (only.includes('pulse')) await pulse(root);
    if (only.includes('overlap')) await overlap(root);
  })().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
}
