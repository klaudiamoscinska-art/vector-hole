// GG-OBJECTS-FIX-03 evidence, not a test: BEFORE (base checkout) / AFTER real Arena frames, PC 1280x720 (DPR 1) and phone 390x844 (DPR 2),
// on the lightest (k = Park Impulsów) and the darkest (g = Galeria Glitch) sector floor, at the round's start zoom (PC 1.47, phone 1.08).
//   node qa/objfix3-shots.mjs --root=DIR (the BEFORE checkout)  ->  qa/out/objfix3/shots/
// Scenes: staged-<sector> = seed 2024 with one object of each of the 21 kinds MOVED next to each other (qa/objraster2-shots.mjs stageScene);
//         natural-<sector> = the unmodified round (seed 2024), camera on the sector's centroid (the layout itself differs: no overlaps after).
// t1zoom-<frame>-<sector>.png = the staged T1 pair cropped from BEFORE and AFTER, x4 nearest neighbour, side by side.
import fs from 'node:fs';
import path from 'node:path';
import { serve, OUT, ROOT, isMain } from './lib.mjs';
import { session, stageScene, paintAfterDecode } from './objraster2-shots.mjs';

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

if (isMain(import.meta.url)) {
  const root = opt('root', null);
  if (!root) { console.log('NOT RUN: --root=DIR (the BEFORE checkout) is required'); process.exit(1); }
  run(root).then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
}
