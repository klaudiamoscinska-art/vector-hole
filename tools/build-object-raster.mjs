// GG-OBJECTS-RASTER-02: builds objects-raster-2.js / objects-raster-3.js (the 21 Arena object sprites, WebP RGBA as data: URLs)
// from the GG_OBJECTS_21_FINAL_SPRITES_V1 package. Dev-only (needs the Playwright install the qa/ suites use); not shipped.
//   node tools/build-object-raster.mjs --pack=<unpacked package dir> [--out=<dir for the work files>] [--check]
// A kind whose package WebP already has the canvas the game needs (2*ceil(1.5*r+6)*quality, r = the real TIERS radius)
// is embedded byte for byte. A kind whose package canvas was cut for an inferred radius (T1, T2, wezel, pylon) is re-cut from
// its native PNG only: scaled to the same envelope rule the package used (content fits 2.1 r wide x 2.48 r tall, centred at
// 0.4595 of the canvas height), never repainted.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from '../qa/lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const PACK = path.resolve(arg('pack', ''));
const OUT = path.resolve(arg('out', path.join(ROOT, 'qa', 'out', 'objects-raster')));
const CHECK = process.argv.includes('--check');
if (!arg('pack', '')) { console.error('usage: node tools/build-object-raster.mjs --pack=DIR [--out=DIR] [--check]'); process.exit(2); }

// The real radii (game.js TIERS: minR == maxR for each, read back and compared by qa/objraster2.mjs).
const REAL_R = {
  fragment: 7, kapsula: 10,
  lawka: 20, kiosk: 20, skrzynia: 20, latarnia: 20, drzewo: 20, znacznik: 20,
  samochod: 34, wezel: 32, pylon: 32,
  pawilon: 54, billboard: 54, magazyn: 54, landmark: 52,
  autobus: 76, tramwaj: 76, ciezarowka: 76,
  wiezowiec: 100, maszt: 100, kopula: 100
};
const ENV_W = 2.1, ENV_H = 2.48, CY = 0.4595;
const canvasPx = (r, q) => 2 * Math.ceil(1.5 * r + 6) * q;

const manifest = JSON.parse(fs.readFileSync(path.join(PACK, 'manifest.json'), 'utf8'));
const recs = manifest.asset_records;
if (recs.length !== 21) throw new Error('expected 21 records');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');
async function recut(pngB64, D, w, h, x, y) {
  return page.evaluate(async ({ pngB64, D, w, h, x, y }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + pngB64; await img.decode();
    // halve until within 2x of the target (one big step aliases), then the final high-quality step
    let src = img, sw = img.naturalWidth, sh = img.naturalHeight;
    while (sw > w * 2 && sh > h * 2) {
      const c = document.createElement('canvas'); c.width = Math.ceil(sw / 2); c.height = Math.ceil(sh / 2);
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height);
      src = c; sw = c.width; sh = c.height;
    }
    const out = document.createElement('canvas'); out.width = out.height = D;
    const g = out.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, sw, sh, x, y, w, h);
    const blob = await new Promise((res) => out.toBlob(res, 'image/webp', 0.92));
    const buf = new Uint8Array(await blob.arrayBuffer());
    // tight alpha box of the result (what the log reports)
    const d = g.getImageData(0, 0, D, D).data; let x0 = D, y0 = D, x1 = -1, y1 = -1;
    for (let j = 0; j < D; j++) for (let i = 0; i < D; i++) if (d[(j * D + i) * 4 + 3] > 8) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { b64: btoa(s), box: [x0, y0, x1 - x0 + 1, y1 - y0 + 1] };
  }, { pngB64, D, w, h, x, y });
}

fs.mkdirSync(path.join(OUT, 'webp_2px'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'webp_3px'), { recursive: true });
const log = [];
const mod = { 2: {}, 3: {} };
for (const rec of recs) {
  const r = REAL_R[rec.kind];
  if (r == null) throw new Error('no real radius for ' + rec.kind);
  for (const q of [2, 3]) {
    const o = rec.outputs[q + 'px'];
    const D = canvasPx(r, q);
    const pkgFile = path.join(PACK, o.file);
    let bytes, how, box;
    if (o.dimensions === D) {
      bytes = fs.readFileSync(pkgFile); how = 'package'; box = o.content_box_px;
    } else {
      const [nw, nh] = rec.native_pixel_dimensions;
      const s = Math.min(ENV_W * r * q / nw, ENV_H * r * q / nh);
      const w = Math.round(nw * s), h = Math.round(nh * s);
      const x = Math.floor((D - w) / 2), y = Math.round(CY * D - h / 2);
      const png = fs.readFileSync(path.join(PACK, rec.native_png)).toString('base64');
      const res = await recut(png, D, w, h, x, y);
      bytes = Buffer.from(res.b64, 'base64'); how = 'recut'; box = res.box;
    }
    fs.writeFileSync(path.join(OUT, `webp_${q}px`, `${rec.kind}_${q}px.webp`), bytes);
    mod[q][rec.kind] = 'data:image/webp;base64,' + bytes.toString('base64');
    log.push({ kind: rec.kind, tier: rec.tier, r, quality: q, canvas: D, packageCanvas: o.dimensions, how, contentBox: box, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  }
}
// Reproducibility check of the recut path against a kind the package cut for the right radius: same canvas, same envelope.
if (CHECK) {
  const rec = recs.find((x) => x.kind === 'samochod'), q = 2, D = canvasPx(34, q), [nw, nh] = rec.native_pixel_dimensions;
  const s = Math.min(ENV_W * 34 * q / nw, ENV_H * 34 * q / nh), w = Math.round(nw * s), h = Math.round(nh * s);
  const res = await recut(fs.readFileSync(path.join(PACK, rec.native_png)).toString('base64'), D, w, h, Math.floor((D - w) / 2), Math.round(CY * D - h / 2));
  console.log('check samochod 2px: recut box', res.box.join(','), 'package box', rec.outputs['2px'].content_box_px.join(','));
}
await browser.close();

const head = (q) => `// GG-OBJECTS-RASTER-02: the 21 Arena object sprites (T1-T6) at ${q} px per world unit, WebP RGBA, as data: URLs (release graph = JS/CSS only).\n` +
  `// Canvas of each = 2*ceil(1.5*r+6)*${q} px, r = the real TIERS radius, centre = the object's centre; built by tools/build-object-raster.mjs from GG_OBJECTS_21_FINAL_SPRITES_V1.\n`;
for (const q of [2, 3]) {
  const body = Object.entries(mod[q]).map(([k, u]) => `  ${k}: '${u}'`).join(',\n');
  fs.writeFileSync(path.join(ROOT, `objects-raster-${q}.js`), head(q) + `export const OBJECT_RASTER_${q}PX = {\n${body}\n};\n`);
}
fs.writeFileSync(path.join(OUT, 'export-log.json'), JSON.stringify(log, null, 2));
for (const e of log) console.log(`${e.tier} ${e.kind.padEnd(11)} r=${String(e.r).padStart(3)} q${e.quality} canvas ${String(e.canvas).padStart(3)} (package ${String(e.packageCanvas).padStart(3)}) ${e.how.padEnd(7)} box ${e.contentBox.join(',')} ${e.bytes} B`);
