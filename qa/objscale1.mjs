// GG-OBJECTS-SCALE-FIX-01: an Arena object must not look clearly smaller than a vortex that cannot eat it yet. A stage test: base = a worktree of origin/main.
//   node qa/objscale1.mjs --base=DIR [--only=rule,draw,layout,source] [--seeds=40]
//   node qa/objscale1.mjs --derive         (prints the OBJECT_VIEW_SCALE table the rule asks for, from this checkout's pictures; nothing is checked)
//
// Size on screen is measured, not assumed. P = the perceived radius of a picture: the geometric mean of its half extent (half the longer side of
// the box of pixels with alpha > 140) and its area-equivalent radius (sqrt(area / pi) of those pixels). A disc gives P = its radius; a long flat
// bus gets less than its half length, a thin lamp less than its half height. The vortex is a disc: its P is the area-equivalent radius of the
// player's own drawn vortex (the starting look) at that radius.
// Eating is a tier gate only (canEatWorldObjectTier(): T2 objects from radius 30, T3 46, T4 66, T5 90, T6 118 = growth.radiusAnchors), so a T2-T6
// object stays locked through the whole tier below it while that vortex grows 31-67 %. The rule, for every T2-T6 kind and both looks
// (bitmap gfx 1/2, vector gfx 0): rho = P(object as drawn) / P(vortex at the unlock radius) in [0.85, 1.0]:
//   >= 0.85  while it is locked the object never looks clearly smaller than the vortex (the vortex is below the unlock radius, so rho is higher);
//   <= 1.0   the moment it unlocks it fits in the vortex (it does not look bigger than a vortex that can eat it).
// T1 (fragment, kapsula) is eatable from the first frame: no rule, untouched.
// Sections: rule (the band + tiers readable in order + 'clearly smaller while locked' share before/after), draw (the drawn pixels follow the table;
// Campaign/T1/gfx paths untouched), layout (seeded spawn: same RNG stream, same objects, no object waiting, no picture over another), source
// (eat gates, tiers, growth, radii byte-identical to base).
// Output: qa/out/objscale1/results.json (+ the console). Exit 1 on any FAIL.
import fs from 'node:fs';
import path from 'node:path';
import { serve, report, OUT, ROOT, isMain } from './lib.mjs';
import { session } from './objraster2-shots.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const DIR = path.join(OUT, 'objscale1');
export const BAND = [0.85, 1.0], TARGET = 0.88, ALPHA = 140;
export const KINDS = { lawka: 2, kiosk: 2, skrzynia: 2, latarnia: 2, drzewo: 2, znacznik: 2, samochod: 3, wezel: 3, pylon: 3, pawilon: 4, billboard: 4, magazyn: 4, landmark: 4, autobus: 5, tramwaj: 5, ciezarowka: 5, wiezowiec: 6, maszt: 6, kopula: 6 };

/** A served copy of a checkout whose game.js also exports what this test reads (QA only; the game's own export list is untouched). */
export function exportedRoot(root, name) {
  const dir = path.join(DIR, '.root-' + name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(root)) if (/\.(js|html|css)$/.test(f) && f !== 'game.js') fs.copyFileSync(path.join(root, f), path.join(dir, f));
  const src = fs.readFileSync(path.join(root, 'game.js'), 'utf8'), vs = src.includes('const OBJECT_VIEW_SCALE');
  fs.writeFileSync(path.join(dir, 'game.js'), src + `\nexport { drawObjectArt as __qaDraw, getObjectSprite as __qaSprite, OBJECT_RASTER as __qaRaster, spawnViewBox as __qaViewBox${vs ? ', OBJECT_VIEW_SCALE as __qaViewScale' : ''} };\n`);
  return dir;
}

/** In the page: P of every T2-T6 picture (bitmap 3 px set, vector sprite) at scale 1, the table in use, and the vortex's P at each radius. */
async function measure(page) {
  return page.evaluate(async ({ KINDS, ALPHA }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
    const { OBJECT_RASTER_3PX } = await import('/objects-raster-3.js');
    const T = m.TIERS, R = m.CONFIG.growth.radiusAnchors;
    const kindTier = {}; for (const [name, t] of Object.entries(T)) for (const k of t.subtypes) kindTier[k] = name;
    const sil = (c, W, H, S, cx, cy) => {
      const d = c.getImageData(0, 0, W, H).data; let a = 0, x0 = W, x1 = -1, y0 = H, y1 = -1;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (d[(j * W + i) * 4 + 3] > ALPHA) { a++; if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
      const E = Math.max(x1 + 1 - x0, y1 + 1 - y0) / S / 2, V = Math.sqrt(a / (S * S) / Math.PI);
      return { E, V, P: Math.sqrt(E * V), box: [(x0 - cx) / S, (x1 + 1 - cx) / S, (y0 - cy) / S, (y1 + 1 - cy) / S] };
    };
    const out = { anchors: R, kinds: {}, hole: {}, table: m.__qaViewScale ? JSON.parse(JSON.stringify(m.__qaViewScale)) : null };
    for (const k of Object.keys(KINDS)) {
      const tier = T[kindTier[k]], r = tier.minR, col = tier.color;
      const im = new Image(); im.src = OBJECT_RASTER_3PX[k]; await im.decode();
      const W = im.naturalWidth, cv = document.createElement('canvas'); cv.width = cv.height = W; const c = cv.getContext('2d'); c.drawImage(im, 0, 0);
      const b = sil(c, W, W, W / (2 * Math.ceil(r * 1.5 + 6)), W / 2, W / 2);
      const sp = m.__qaSprite(k, col, r), S = sp.canvas.width / (sp.half * 2);
      const v = sil(sp.canvas.getContext('2d'), sp.canvas.width, sp.canvas.height, S, sp.canvas.width / 2, sp.canvas.height / 2);
      out.kinds[k] = { r, minSizeTier: tier.minSizeTier, bmp: b, vec: v };
    }
    const g = window.game;
    if (!g.player) { g.startRound({ seed: 2024 }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; }
    const p = g.player, look = p.skin;
    p.skin = 'rainbow';   // the starting look (Horyzont)
    const radii = [...new Set([...R, 18, 22, 26, 34, 40, 52, 58, 74, 82, 100, 108])].sort((a, b) => a - b);
    for (const rad of radii) {
      const S = 3, H = Math.ceil(rad * 3), cv = document.createElement('canvas'); cv.width = cv.height = H * 2 * S;
      const c = cv.getContext('2d'); c.setTransform(S, 0, 0, S, H * S, H * S);
      const ox = p.x, oy = p.y, orad = p.radius, inv = p.invulnerableUntil, pop = p.growPopAt, sq = p.fxSquash;
      p.x = 0; p.y = 0; p.radius = rad; p.invulnerableUntil = 0; p.growPopAt = 0; p.fxSquash = 0;
      try { p.draw(c, 10); } finally { p.x = ox; p.y = oy; p.radius = orad; p.invulnerableUntil = inv; p.growPopAt = pop; p.fxSquash = sq; }
      out.hole[rad] = sil(c, cv.width, cv.height, S, H * S, H * S).V;
    }
    p.skin = look;
    return out;
  }, { KINDS, ALPHA });
}

const holeP = (M, R) => {   // linear between measured radii
  const xs = Object.keys(M.hole).map(Number).sort((a, b) => a - b);
  if (M.hole[R] != null) return M.hole[R];
  let i = xs.findIndex(x => x > R); if (i <= 0) i = i < 0 ? xs.length - 1 : 1;
  const a = xs[i - 1], b = xs[i];
  return M.hole[a] + (M.hole[b] - M.hole[a]) * (R - a) / (b - a);
};
const scaleOf = (M, k, look) => M.table && M.table[k] ? M.table[k][look === 'bmp' ? 0 : 1] : 1;

/** Per kind and look: rho at unlock, and the share of the tier below (radius A[m-1]..A[m]) where the locked object looks clearly smaller (rho < 0.85). */
export function judge(M) {
  const rows = {};
  for (const [k, e] of Object.entries(M.kinds)) {
    const A = M.anchors[e.minSizeTier], A0 = M.anchors[e.minSizeTier - 1];
    rows[k] = { tier: KINDS[k], r: e.r, unlock: A };
    for (const look of ['bmp', 'vec']) {
      const s = scaleOf(M, k, look), P = e[look].P * s;
      let small = 0, n = 0;
      for (let R = A0; R < A; R += 0.25) { n++; if (P / holeP(M, R) < BAND[0]) small++; }
      rows[k][look] = { scale: s, P: +P.toFixed(2), Pr: +(P / e.r).toFixed(3), rho: +(P / holeP(M, A)).toFixed(3), clearlySmallerShare: +(small / n).toFixed(3),
        firstClearlySmallerAt: (() => { for (let R = A0; R < A; R += 0.25) if (P / holeP(M, R) < BAND[0]) return R; return null; })() };
    }
  }
  return rows;
}

/** The OBJECT_VIEW_SCALE table the rule asks for: rho = TARGET at unlock, never below 1 (only kinds that are too small grow). */
function derive(M) {
  const t = {};
  for (const [k, e] of Object.entries(M.kinds)) {
    const want = TARGET * holeP(M, M.anchors[e.minSizeTier]);
    t[k] = ['bmp', 'vec'].map(look => Math.max(1, Math.ceil(want / e[look].P * 100) / 100));
    t[k].push(Math.round(want / e.r * 100) / 100);   // the can-eat ring: the picture's perceived radius, in units of r
  }
  return t;
}

/* -------------------------------------------------------------- draw -------------------------------------------------------------- */
/** In the page: every T2-T6 kind and both T1 kinds drawn by the game's own drawObjectArt (t = 0, seed 0: no bob, no breathe) for an Arena object
 *  (raster: true) at gfx 2 (bitmap) and gfx 0 (vector, lite), and for Campaign (no raster): P of the drawn pixels and a hash of them. */
async function drawn(page) {
  return page.evaluate(async ({ KINDS, ALPHA }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
    const T = m.TIERS, kindTier = {}; for (const [name, t] of Object.entries(T)) for (const k of t.subtypes) kindTier[k] = name;
    const kinds = ['fragment', 'kapsula', ...Object.keys(KINDS)];
    const g = window.game;
    const fnv = (d) => { let a = 0x811c9dc5; for (let i = 0; i < d.length; i += 4) a = Math.imul(a ^ (d[i] | d[i + 1] << 8 | d[i + 2] << 16 | d[i + 3] << 24), 16777619); return (a >>> 0).toString(16); };
    const one = (k, opts) => {
      const t = T[kindTier[k]], r = t.minR, S = 2, H = Math.ceil(r * 2.6 + 10), cv = document.createElement('canvas'); cv.width = cv.height = H * 2 * S;
      const c = cv.getContext('2d'); c.setTransform(S, 0, 0, S, H * S, H * S);
      m.__qaDraw(c, k, t.color, r, 0, 0, opts);
      const d = c.getImageData(0, 0, cv.width, cv.height).data; let a = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
      for (let j = 0; j < cv.height; j++) for (let i = 0; i < cv.width; i++) if (d[(j * cv.width + i) * 4 + 3] > 170) { a++; if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
      const E = Math.max(x1 + 1 - x0, y1 + 1 - y0) / S / 2, V = Math.sqrt(a / (S * S) / Math.PI);
      return { P: Math.sqrt(E * V), reach: Math.max(Math.abs(x0 / S - H), Math.abs((x1 + 1) / S - H), Math.abs(y0 / S - H), Math.abs((y1 + 1) / S - H)) / r, hash: fnv(d) };
    };
    const out = { gfx2: {}, gfx0: {}, campaign: {} };
    g.applyGfx(2); m.__qaRaster.setMax(3); m.__qaRaster.switchTo(3);
    for (const k of kinds) m.__qaRaster.get(k, T[kindTier[k]].minR);
    await new Promise(r => setTimeout(r, 2500));
    for (const k of kinds) { out.gfx2[k] = one(k, { raster: true }); out.campaign[k] = one(k, {}); }
    out.bitmapReady = kinds.every(k => !!m.__qaRaster.get(k, T[kindTier[k]].minR));
    g.applyGfx(0);
    for (const k of kinds) out.gfx0[k] = one(k, { raster: true });
    g.applyGfx(2);
    return out;
  }, { KINDS, ALPHA });
}

/* ------------------------------------------------------------- layout ------------------------------------------------------------- */
async function layouts(page, seeds) {
  return page.evaluate(async ({ seeds }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
    const g = window.game, stop = () => { if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; };
    const fnv = (s) => { let a = 0x811c9dc5; for (let i = 0; i < s.length; i++) a = Math.imul(a ^ s.charCodeAt(i), 16777619); return (a >>> 0).toString(16); };
    const out = [];
    for (const seed of seeds) {
      window.__qaSeedRandom(seed);
      g.startRound({ seed });
      stop();
      const objs = g.objects.filter(o => !o.eating);
      const rest = fnv(objs.map(o => [o.tier, o.subtype, Math.round(o.radius * 1000), Math.round(o.rotation * 1000), o.value].join(',')).join(';'));
      const pos = objs.map(o => [Math.round(o.x * 100), Math.round(o.y * 100)]);
      // picture boxes (this checkout's spawnViewBox) of every pair that is close: none may touch (the game's own spawn rule, SPAWN_VIEW_GAP 3)
      const box = (o) => m.__qaViewBox(o.subtype, o.radius, o.x, o.y, { l: 0, r: 0, t: 0, b: 0 });
      let overlaps = 0, phys = 0;
      const B = objs.map(box);
      for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++) {
        const a = B[i], b = B[j];
        if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) overlaps++;
        const dx = objs[i].x - objs[j].x, dy = objs[i].y - objs[j].y, mm = objs[i].radius + objs[j].radius;
        if (dx * dx + dy * dy < mm * mm) phys++;
      }
      out.push({ seed, n: objs.length, waiting: (g.waitingObjects || []).length, rest, rng: g.rng ? g.rng.seed : null, pos, tiers: objs.map(o => o.tier), overlaps, phys });
    }
    return out;
  }, { seeds });
}

/* ------------------------------------------------------------- source ------------------------------------------------------------- */
/** Text of a top-level declaration / method in game.js (from its first line to the line where the braces close). */
function block(src, startRe) {
  const lines = src.split(/\r?\n/), i = lines.findIndex(l => startRe.test(l));
  if (i < 0) return null;
  let depth = 0, seen = false;
  for (let j = i; j < lines.length; j++) {
    for (const ch of lines[j]) { if (ch === '{' || ch === '[') { depth++; seen = true; } else if (ch === '}' || ch === ']') depth--; }
    if (seen && depth <= 0) return lines.slice(i, j + 1).join('\n');
  }
  return null;
}
const GUARDED = [
  ['TIERS', /^const TIERS = \{/], ['growth', /^  growth: \{/], ['sizeTiers', /^  sizeTiers: \[/], ['hole', /^  hole: \{/], ['eating', /^  eating: \{/],
  ['canEatWorldObjectTier', /^function canEatWorldObjectTier\(/], ['getSizeTierIndex', /^function getSizeTierIndex\(/], ['holeCanEat', /^  holeCanEat\(hole, obj\) \{/],
  ['handleObjectEating', /^  handleObjectEating\(hole\) \{/], ['lockedBump', /^  lockedBump\(/], ['canEatHighlight', /^  canEatHighlight\(obj\) \{/],
  ['WorldObject.respawn', /^  respawn\(tierName, first, rng\) \{/], ['settleSpawn', /^function settleSpawn\(/],
  ['SPAWN_VIEW', /^const SPAWN_VIEW = \{/], ['campaign entityRadius', /^    entityRadius: \{/], ['CampaignEntity.draw', /^class CampaignEntity \{/]
];

export async function run({ base, only = ['rule', 'draw', 'layout', 'source'], seeds = 40 } = {}) {
  fs.mkdirSync(DIR, { recursive: true });
  const results = { stage: 'GG-OBJECTS-SCALE-FIX-01', band: BAND, target: TARGET, alpha: ALPHA };
  let ok = true;
  const check = (name, pass, details) => { report(name, pass, JSON.stringify(details).slice(0, 400)); if (!pass) ok = false; (results.checks = results.checks || []).push({ name, pass, details }); };
  const roots = [['base', base], ['cand', ROOT]];
  const data = {};
  for (const [name, root] of roots) {
    const srv = await serve({ root: exportedRoot(root, name) });
    const g = await session(srv.url, 'pc');
    try {
      data[name] = {};
      if (only.includes('rule')) data[name].M = await measure(g.page);
      if (only.includes('draw')) data[name].D = await drawn(g.page);
      if (only.includes('layout')) data[name].L = await layouts(g.page, Array.from({ length: seeds }, (_, i) => 1000 + i * 7919));
      data[name].errors = g.errors.slice();
    } finally { await g.browser.close(); srv.server.close(); }
  }

  if (only.includes('rule')) {
    const before = judge(data.base.M), after = judge(data.cand.M);
    results.rule = { before, after, hole: data.cand.M.hole, anchors: data.cand.M.anchors, table: data.cand.M.table };
    console.log('\nkind        T  r  unlock | look  BEFORE P/r  rho  clearly-smaller | AFTER scale  P/r  rho  clearly-smaller');
    for (const k of Object.keys(KINDS)) for (const look of ['bmp', 'vec']) {
      const b = before[k][look], a = after[k][look];
      console.log(`${k.padEnd(11)} ${KINDS[k]} ${String(after[k].r).padStart(3)} ${String(after[k].unlock).padStart(4)}   | ${look}  ${b.Pr.toFixed(2)} ${b.rho.toFixed(2)} ${(b.clearlySmallerShare * 100).toFixed(0).padStart(3)} % | ${a.scale.toFixed(2)} ${a.Pr.toFixed(2)} ${a.rho.toFixed(2)} ${(a.clearlySmallerShare * 100).toFixed(0).padStart(3)} %`);
    }
    for (const look of ['bmp', 'vec']) {
      const bad = Object.keys(KINDS).filter(k => after[k][look].rho < BAND[0] || after[k][look].rho > BAND[1]);
      check(`SF-RULE-${look}: every T2-T6 ${look === 'bmp' ? 'bitmap' : 'vector'} look at unlock is ${BAND[0]}-${BAND[1]} of the vortex`, bad.length === 0, { bad: bad.map(k => `${k} ${after[k][look].rho}`) });
      const small = Object.keys(KINDS).filter(k => after[k][look].clearlySmallerShare > 0);
      check(`SF-LOCKED-${look}: no locked object looks clearly smaller (< ${BAND[0]}) than a vortex of the tier below`, small.length === 0, { small });
      // tiers readable in order: every kind of tier k+1 is bigger on screen than every kind of tier k
      const byTier = {}; for (const k of Object.keys(KINDS)) (byTier[KINDS[k]] = byTier[KINDS[k]] || []).push(after[k][look].P);
      const order = [2, 3, 4, 5].map(t => ({ t, maxLo: Math.max(...byTier[t]), minHi: Math.min(...byTier[t + 1]) }));
      check(`SF-ORDER-${look}: each tier's smallest picture is bigger than the tier below's biggest`, order.every(o => o.minHi > o.maxLo), order);
    }
    // the can-eat ring (WorldObject.draw(): r * ring + 1, +2 at its widest breath) hugs the picture (>= its P) and, at the unlock radius, stays inside the vortex's visible disc
    const T = data.cand.M.table || {}, ring = [];
    for (const k of Object.keys(KINDS)) {
      const e = data.cand.M.kinds[k], rr = T[k] ? e.r * T[k][2] + 1 : e.r + 3, hp = holeP(data.cand.M, data.cand.M.anchors[e.minSizeTier]);
      if (rr < after[k].bmp.P || rr + 2 > hp + 1) ring.push(`${k}: ring ${rr.toFixed(1)}-${(rr + 2).toFixed(1)}, picture P ${after[k].bmp.P}, vortex ${hp.toFixed(1)}`);
    }
    check('SF-RING: the can-eat ring hugs the picture and fits in the vortex at unlock', ring.length === 0, { ring });
    const unchanged = ['fragment', 'kapsula'].every(k => !data.cand.M.table || !data.cand.M.table[k]);
    check('SF-T1: fragment and kapsula keep their scale (no table entry)', unchanged, {});
  }

  if (only.includes('draw')) {
    const B = data.base.D, C = data.cand.D, T1 = ['fragment', 'kapsula'];
    check('SF-DRAW-ready: every bitmap decoded (else gfx 2 would measure the vector look)', B.bitmapReady && C.bitmapReady, { base: B.bitmapReady, cand: C.bitmapReady });
    const tab = data.cand.M ? data.cand.M.table : null;
    const devs = [];
    for (const [path_, look] of [['gfx2', 0], ['gfx0', 1]]) for (const k of Object.keys(KINDS)) {
      const want = tab ? tab[k][look] : 1, got = C[path_][k].P / B[path_][k].P;
      if (Math.abs(got / want - 1) > 0.04) devs.push(`${path_} ${k}: drawn x${got.toFixed(3)} vs table x${want}`);
    }
    check('SF-DRAW-scale: the drawn Arena picture (gfx 2 bitmap, gfx 0 vector) grows by its table factor (+-4 %)', devs.length === 0, { devs });
    const t1 = [];
    for (const p of ['gfx2', 'gfx0']) for (const k of T1) if (B[p][k].hash !== C[p][k].hash) t1.push(`${p} ${k}`);
    check('SF-DRAW-T1: T1 (fragment, kapsula) pixel-identical to base on both paths', t1.length === 0, { t1 });
    const camp = Object.keys(C.campaign).filter(k => C.campaign[k].hash !== B.campaign[k].hash);
    check('SF-DRAW-campaign: Campaign / menu looks (no raster flag) pixel-identical to base, all 21 kinds', camp.length === 0, { camp });
    const reach = [];
    for (const p of ['gfx2', 'gfx0']) for (const k of Object.keys(KINDS)) { const r = data.cand.M ? data.cand.M.kinds[k].r : 20; if (C[p][k].reach * r > 2 * r + 30) reach.push(`${p} ${k} ${C[p][k].reach.toFixed(2)} r`); }
    check('SF-DRAW-cull: every picture stays inside the view test margin (2 r + 30, isInView) -- no pop at the screen edge', reach.length === 0, { reach });
    results.draw = { base: B, cand: C };
  }

  if (only.includes('layout')) {
    const B = data.base.L, C = data.cand.L;
    const restSame = B.every((b, i) => b.rest === C[i].rest && b.n === C[i].n);
    check('SF-LAYOUT-objects: same objects in the same order (tier, kind, radius, rotation, value) on every seed', restSame, { diff: B.filter((b, i) => b.rest !== C[i].rest).map(b => b.seed) });
    const rngSame = B.every((b, i) => b.rng === C[i].rng);
    check('SF-LAYOUT-rng: the seeded stream ends in the same state after the layout (no extra draw)', rngSame && B[0].rng != null, { sample: [B[0].rng, C[0].rng] });
    const twice = await (async () => {   // determinism: same seed twice on the candidate = same positions (Daily replays a layout)
      const srv = await serve({ root: exportedRoot(ROOT, 'cand2') }), g = await session(srv.url, 'pc');
      try { return await layouts(g.page, C.slice(0, 5).map(c => c.seed)); } finally { await g.browser.close(); srv.server.close(); }
    })();
    check('SF-LAYOUT-replay: the same seed gives the same positions again (candidate, 5 seeds)', twice.every((t, i) => JSON.stringify(t.pos) === JSON.stringify(C[i].pos)), {});
    const waiting = C.filter(c => c.waiting > 0).map(c => `${c.seed}:${c.waiting}`);
    check('SF-LAYOUT-waiting: no object kept waiting off the board at round start (every object on the board)', waiting.length === 0, { waiting, base: B.filter(b => b.waiting > 0).length });
    const ov = C.filter(c => c.overlaps > 0 || c.phys > 0).map(c => `${c.seed}: ${c.overlaps} picture, ${c.phys} footprint`);
    check('SF-LAYOUT-overlap: no two pictures (at the new scale) or footprints overlap at spawn', ov.length === 0, { ov });
    let moved = 0, total = 0, maxMove = 0;
    const ds = [], byTier = {};
    B.forEach((b, i) => b.pos.forEach((p, j) => { total++; const q = C[i].pos[j], d = Math.hypot(p[0] - q[0], p[1] - q[1]) / 100; if (d > 0.01) { moved++; ds.push(d); maxMove = Math.max(maxMove, d); const t = C[i].tiers[j]; byTier[t] = (byTier[t] || 0) + 1; } }));
    ds.sort((a, b) => a - b);
    const pct = (q) => ds.length ? +ds[Math.min(ds.length - 1, Math.floor(q * ds.length))].toFixed(1) : 0;
    results.layoutShift = { median: pct(0.5), p90: pct(0.9), p99: pct(0.99), movedByTier: byTier };
    console.log(`  layout shift of the moved ones: median ${pct(0.5)}, p90 ${pct(0.9)}, p99 ${pct(0.99)} world units; by tier ${JSON.stringify(byTier)}`);
    results.layout = { seeds: B.length, objectsPerRound: B[0].n, moved, total, movedShare: +(moved / total).toFixed(4), maxMove: +maxMove.toFixed(1) };
    console.log(`  layout: ${moved} of ${total} spawn positions differ from base (${(100 * moved / total).toFixed(2)} %), max ${maxMove.toFixed(1)} world units -- the picture clearance at the new scale`);
  }

  if (only.includes('source')) {
    const bs = fs.readFileSync(path.join(base, 'game.js'), 'utf8'), cs = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
    const diff = GUARDED.filter(([, re]) => { const a = block(bs, re), b = block(cs, re); return !a || a !== b; }).map(([n]) => n);
    check('SF-SOURCE: eat gates, tiers, growth, radii, spawn search, Campaign entities byte-identical to base', diff.length === 0, { diff });
    const files = ['index.html', 'style.css', 'objects-raster-2.js', 'objects-raster-3.js'].filter(f => fs.readFileSync(path.join(base, f), 'utf8').replace(/\r\n/g, '\n') !== fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n'));
    check('SF-SOURCE-files: index.html, style.css and both bitmap sets unchanged', files.length === 0, { files });
  }

  const errs = [...(data.base.errors || []), ...(data.cand.errors || [])];
  check('SF-ERRORS: no page errors', errs.length === 0, { errs: errs.slice(0, 5) });
  fs.writeFileSync(path.join(DIR, 'results.json'), JSON.stringify(results, null, 1));
  return ok;
}

if (isMain(import.meta.url)) {
  if (process.argv.includes('--derive')) {
    (async () => {
      const srv = await serve({ root: exportedRoot(ROOT, 'derive') }), g = await session(srv.url, 'pc');
      try {
        const M = await measure(g.page), t = derive({ ...M, table: null });
        console.log('vortex P at the unlock radii:', M.anchors.map(a => `${a}: ${holeP(M, a).toFixed(2)}`).join(', '));
        console.log('const OBJECT_VIEW_SCALE = {');
        console.log(Object.entries(t).map(([k, v]) => `  ${k}: [${v.join(', ')}]`).join(',\n'));
        console.log('};');
      } finally { await g.browser.close(); srv.server.close(); }
    })().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
  } else {
    const base = opt('base', null);
    if (!base) { console.error('--base=DIR (a worktree of origin/main) is required'); process.exit(2); }
    const only = opt('only', null);
    run({ base: path.resolve(base), only: only ? only.split(',') : undefined, seeds: +opt('seeds', 40) }).then((ok) => process.exit(ok ? 0 : 1), (e) => { console.error(e); process.exit(1); });
  }
}
