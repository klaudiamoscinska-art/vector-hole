// GG-SIZE-CONSISTENCY-01 diagnosis, not a test: what the player SEES of the vortex and of a T2-T6 object, in the game's own renderer.
//   node qa/sizecons1-measure.mjs [--root=DIR] [--tag=NAME]
// Vortex (the player's starting look, gfx 2, time frozen, no growth pop): drawn alone on a transparent canvas and on a typical dark floor;
// per ring rho = d / R (step 0.01): the share of opaque pixels (alpha > 140) and the share of DARK pixels on the floor (luminance < 0.06 --
// the hole's black throat). Reported edges, in units of R:
//   throat  = the last ring whose pixels are >= 50 % dark (the part that reads as "a hole you fall into")
//   body    = the last ring >= 50 % opaque (the disc with its rim: what reads as the vortex's size)
//   glow    = the last ring with any pixel alpha > 24 (the faint halo, pull rings included)
// Objects (every T2-T6 kind as an Arena object draws it: bitmap + OBJECT_VIEW_SCALE + ground base, t = 0, alpha > 140), relative to the
// object's centre (the centre of its hitbox, where the eat rule measures): halfW, halfH (bbox half extents from the centre), maxR (farthest
// opaque pixel from the centre = the smallest circle round its centre that holds it), minHalf = min(halfW, halfH) (its narrow side).
// No area or geometric means: "does it fit in the hole" is a question of extents.
// Output: qa/out/sizecons1/measure-<tag>.json
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, QA_RANDOM, OUT, ROOT, isMain } from './lib.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
export const DIR = path.join(OUT, 'sizecons1');
export const KIND_TIER = { lawka: 2, kiosk: 2, skrzynia: 2, latarnia: 2, drzewo: 2, znacznik: 2, samochod: 3, wezel: 3, pylon: 3, pawilon: 4, billboard: 4, magazyn: 4, landmark: 4, autobus: 5, tramwaj: 5, ciezarowka: 5, wiezowiec: 6, maszt: 6, kopula: 6 };

/** A served copy of a checkout whose game.js also exports the renderer pieces this script reads (QA only). */
export function exportedRoot(root, name) {
  const dir = path.join(DIR, '.root-' + name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(root)) if (/\.(js|html|css)$/.test(f) && f !== 'game.js') fs.copyFileSync(path.join(root, f), path.join(dir, f));
  const src = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
  fs.writeFileSync(path.join(dir, 'game.js'), src + `\nexport { drawObjectArt as __qaDraw, OBJECT_RASTER as __qaRaster, radiusForUnits as __qaRfu, unitsForRadius as __qaUfr, arenaRadiusForUnits as __qaArfu, arenaUnitsForRadius as __qaAufr, applySizeProto as __qaSize, SIZE_PROTO_SETS as __qaSizeSets, OBJECT_VIEW_SCALE as __qaViewScale };\n`);
  return dir;
}

export async function measurePage(page, radii, variant = null) {
  return page.evaluate(async ({ KIND_TIER, radii, variant }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
    const T = m.TIERS, g = window.game;
    const kindTier = {}; for (const [name, t] of Object.entries(T)) for (const k of t.subtypes) kindTier[k] = name;
    g.applyGfx(2);
    const SP = m.__qaSize(variant);
    g.startRound({ seed: 2024 }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
    const out = { variant, viewScale: JSON.parse(JSON.stringify(m.__qaViewScale)), proto: JSON.parse(JSON.stringify(SP)), anchors: m.CONFIG.growth.radiusAnchors.slice(), unitAnchors: m.CONFIG.growth.unitAnchors.slice(), hole: {}, kinds: {} };
    // ---- vortex
    const p = g.player, keep = { x: p.x, y: p.y, r: p.radius, inv: p.invulnerableUntil, pop: p.growPopAt, sq: p.fxSquash, skin: p.skin, name: p.name };
    p.skin = 'rainbow'; p.name = '';
    const S = 3;
    for (const R of radii) {
      const H = Math.ceil(R * 1.7), W = H * 2 * S;
      const draw = (floor) => {
        const cv = document.createElement('canvas'); cv.width = cv.height = W;
        const c = cv.getContext('2d');
        if (floor) { c.fillStyle = floor; c.fillRect(0, 0, W, W); }
        c.setTransform(S, 0, 0, S, H * S, H * S);
        p.x = 0; p.y = 0; p.radius = R; p.invulnerableUntil = 0; p.growPopAt = 0; p.fxSquash = 0;
        p.draw(c, 10);
        return c.getImageData(0, 0, W, W).data;
      };
      let A, D;
      try { A = draw(null); D = draw('#1d2a48'); } finally { Object.assign(p, { x: keep.x, y: keep.y, radius: keep.r, invulnerableUntil: keep.inv, growPopAt: keep.pop, fxSquash: keep.sq }); }
      const N = 170, op = new Float64Array(N), dk = new Float64Array(N), cnt = new Float64Array(N), any = new Float64Array(N);
      for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
        const dx = (i + 0.5) / S - H, dy = (j + 0.5) / S - H, rho = Math.hypot(dx, dy) / R, b = Math.floor(rho * 100);
        if (b >= N) continue;
        const o = (j * W + i) * 4;
        cnt[b]++;
        if (A[o + 3] > 140) op[b]++;
        if (A[o + 3] > 24) any[b]++;
        const L = (0.2126 * D[o] + 0.7152 * D[o + 1] + 0.0722 * D[o + 2]) / 255;
        if (L < 0.06) dk[b]++;
      }
      // throat / body: scanning out from the centre, the first ring below 50 % (a stray opaque speck of the accretion disk further
      // out does not move the edge); glow: the last ring with any visible pixel
      let throat = 0, body = 0, glow = 0;
      for (let b = 0; b < N && cnt[b] && dk[b] / cnt[b] >= 0.5; b++) throat = (b + 1) / 100;
      for (let b = 50; b < N && cnt[b] && op[b] / cnt[b] >= 0.5; b++) body = (b + 1) / 100;
      for (let b = 0; b < N; b++) if (cnt[b] && any[b] > 0) glow = (b + 1) / 100;
      const prof = []; for (let b = 0; b < N; b += 5) prof.push([b / 100, +(op[b] / cnt[b]).toFixed(2), +(dk[b] / cnt[b]).toFixed(2)]);
      out.hole[R] = { throat, body, glow, profile: prof };
    }
    p.skin = keep.skin; p.name = keep.name;
    // ---- objects
    for (const k of Object.keys(KIND_TIER)) m.__qaRaster.get(k, SP.radius[k] || T[kindTier[k]].minR);
    await new Promise(r => setTimeout(r, 1500));
    for (const k of Object.keys(KIND_TIER)) {
      const tier = T[kindTier[k]], r = SP.radius[k] || tier.minR, H = Math.ceil(r * 2.2), W = H * 2 * S;
      const cv = document.createElement('canvas'); cv.width = cv.height = W;
      const c = cv.getContext('2d'); c.setTransform(S, 0, 0, S, H * S, H * S);
      m.__qaDraw(c, k, tier.color, r, 0, 0, { raster: true, live: false });
      const d = c.getImageData(0, 0, W, W).data;
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, mr = 0;
      for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) if (d[(j * W + i) * 4 + 3] > 140) {
        const dx = (i + 0.5) / S - H, dy = (j + 0.5) / S - H;
        if (dx < x0) x0 = dx; if (dx > x1) x1 = dx; if (dy < y0) y0 = dy; if (dy > y1) y1 = dy;
        const q = Math.hypot(dx, dy); if (q > mr) mr = q;
      }
      const halfW = Math.max(-x0, x1), halfH = Math.max(-y0, y1);
      out.kinds[k] = { tier: KIND_TIER[k], r, minSizeTier: tier.minSizeTier, halfW: +halfW.toFixed(1), halfH: +halfH.toFixed(1), maxR: +mr.toFixed(1),
        minHalf: +Math.min(halfW, halfH).toFixed(1), box: [x0, x1, y0, y1].map(v => +v.toFixed(1)), bitmap: !!m.__qaRaster.get(k, r) };
    }
    // the Arena growth curve in use (units -> R), sampled
    out.curve = []; for (let u = 0; u <= 200; u += 0.5) out.curve.push([u, +m.__qaArfu(u).toFixed(3)]);
    m.__qaSize(null);
    return out;
  }, { KIND_TIER, radii, variant });
}

export async function measure(root, tag, radii, variants = [null]) {
  const srv = await serve({ root: exportedRoot(root, tag) });
  try {
    const g = await openGame(srv.url, { viewport: { width: 1280, height: 720 }, mobile: false, deviceScaleFactor: 1, initScript: QA_RANDOM });
    try {
      const all = {};
      for (const v of variants) all[v || 'BEFORE'] = await measurePage(g.page, radii, v);
      all.errors = g.errors;
      return all;
    } finally { await g.browser.close(); }
  } finally { srv.server.close(); }
}

if (isMain(import.meta.url)) {
  const root = path.resolve(opt('root', ROOT)), tag = opt('tag', 'base');
  fs.mkdirSync(DIR, { recursive: true });
  const radii = [18, 20, 24, 29, 30, 32, 40, 45, 46, 52, 60, 65, 66, 76, 85, 89, 90, 100, 110, 117, 118];
  measure(root, tag, radii, ['A', 'B'].includes(opt('variants', '')) || opt('variants', '') ? opt('variants', '').split(',').map(v => v === 'BEFORE' ? null : v) : [null]).then((all) => {
    fs.writeFileSync(path.join(DIR, `measure-${tag}.json`), JSON.stringify(all, null, 1));
    for (const [v, M] of Object.entries(all)) {
      if (v === 'errors') continue;
      console.log('==', v);
      for (const R of [18, 30, 46, 66, 90, 118]) { const h = M.hole[R]; if (h) console.log(`hole R=${R}: throat ${h.throat} body ${h.body} glow ${h.glow}`); }
      for (const [k, o] of Object.entries(M.kinds)) console.log(`T${o.tier} ${k.padEnd(10)} r=${o.r} halfW ${o.halfW} halfH ${o.halfH} maxR ${o.maxR} minHalf ${o.minHalf} bmp ${o.bitmap}`);
    }
    console.log('errors', all.errors.length, all.errors.slice(0, 3));
    process.exit(0);
  }, (e) => { console.error(e); process.exit(1); });
}
