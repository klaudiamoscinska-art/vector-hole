// GG-OBJECTS-RASTER-02 VISUAL-FIX-01 measurement, not a test: the visible silhouette of every one of the 21 kinds, vector look (BEFORE, the game's own
// getObjectSprite) vs bitmap (AFTER, the 2 px set), in units of the logical radius r, plus the size on screen at the game's smallest zoom (0.58).
// The silhouette is the box of pixels with alpha > 200: the vector look's contact shadow / class light (alpha <= 0.5) and the bitmaps' soft edges stay out.
//   node qa/objraster2-scale.mjs   ->  qa/out/objraster2-fix1/scale.json + a table on stdout
import fs from 'node:fs';
import path from 'node:path';
import { serve, ROOT, OUT, isMain } from './lib.mjs';
import { exportedRoot, session } from './objraster2-shots.mjs';

const BASES = /K\.base\(([^)]*)\)/;
export async function run() {
  const srv = await serve({ root: exportedRoot(ROOT, 'scale') });
  const g = await session(srv.url, 'pc');
  const res = await g.page.evaluate(async () => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
    const col = { 1: '#50F0FA', 2: '#FF54AD', 3: '#EFCB63', 4: '#9875FF', 5: '#CBD5E1', 6: '#46D99A' };
    const KR = { fragment: [7, 1], kapsula: [10, 1], lawka: [20, 2], kiosk: [20, 2], skrzynia: [20, 2], latarnia: [20, 2], drzewo: [20, 2], znacznik: [20, 2], samochod: [34, 3], wezel: [32, 3], pylon: [32, 3], pawilon: [54, 4], billboard: [54, 4], magazyn: [54, 4], landmark: [52, 4], autobus: [76, 5], tramwaj: [76, 5], ciezarowka: [76, 5], wiezowiec: [100, 6], maszt: [100, 6], kopula: [100, 6] };
    m.__qaRaster.setMax(2);
    for (const k in KR) m.__qaRaster.get(k, KR[k][0]);
    await new Promise(r => setTimeout(r, 1800));
    const bbox = (cv, S, half) => { const c = cv.getContext('2d'), W = cv.width, H = cv.height, d = c.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (d[(j * W + i) * 4 + 3] > 200) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; } return { l: x0 / S - half, r: (x1 + 1) / S - half, t: y0 / S - half, b: (y1 + 1) / S - half }; };
    const out = {};
    for (const [k, [r, t]] of Object.entries(KR)) {
      const sp = m.__qaSprite(k, col[t], r), S = sp.canvas.width / (sp.half * 2);
      const im = m.__qaRaster.imgs[2][k], cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight; cv.getContext('2d').drawImage(im, 0, 0);
      out[k] = { r, tier: t, vec: bbox(sp.canvas, S, sp.half), bmp: bbox(cv, im.naturalWidth / (sp.half * 2), sp.half) };
    }
    return out;
  });
  await g.browser.close(); srv.server.close();
  const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8').split(/\r?\n/);
  const bases = {};
  for (const k of Object.keys(res)) { const i = src.findIndex(l => l.startsWith('  ' + k + '(c, r, col')); for (let j = i; i >= 0 && j < i + 160; j++) { const m = BASES.exec(src[j]); if (m) { bases[k] = m[1]; break; } } }
  fs.mkdirSync(path.join(OUT, 'objraster2-fix1'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'objraster2-fix1', 'scale.json'), JSON.stringify({ res, bases }, null, 1));
  const f = (v, n = 2) => v.toFixed(n).padStart(5), w = (o) => o.r - o.l, h = (o) => o.b - o.t, Z = 0.58;
  console.log('kind          r | vector w x h (r)  bottom | bitmap w x h (r)  bottom | w/w   h/h  area | on screen at zoom 0.58, CSS px: vector -> bitmap | vector ground K.base(y, w)');
  for (const [k, e] of Object.entries(res)) {
    console.log(k.padEnd(11), String(e.r).padStart(3), '|', f(w(e.vec) / e.r), 'x', f(h(e.vec) / e.r), f(e.vec.b / e.r), '|', f(w(e.bmp) / e.r), 'x', f(h(e.bmp) / e.r), f(e.bmp.b / e.r), '|', f(w(e.bmp) / w(e.vec)), f(h(e.bmp) / h(e.vec)), f(w(e.bmp) * h(e.bmp) / (w(e.vec) * h(e.vec))), '|',
      `${(w(e.vec) * Z).toFixed(0)}x${(h(e.vec) * Z).toFixed(0)} -> ${(w(e.bmp) * Z).toFixed(0)}x${(h(e.bmp) * Z).toFixed(0)}`, '|', bases[k]);
  }
  return res;
}
if (isMain(import.meta.url)) run().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
