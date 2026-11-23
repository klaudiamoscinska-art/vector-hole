// GG-OBJECTS-SCALE-FIX-01 (variant C, REVIEW-02): an Arena T2-T6 picture is as big as its hitbox, and a locked object near the vortex says
// which tier it needs. A stage test: base = a worktree of origin/main.
//   node qa/objscale1.mjs --base=DIR [--only=rule,draw,signal,layout,source] [--seeds=40]
//   node qa/objscale1.mjs --derive         (prints the OBJECT_VIEW_SCALE table the rule asks for, from this checkout's pictures; nothing is checked)
//
// Size on screen is measured, not assumed. P = the perceived radius of a picture: the geometric mean of its half extent (half the longer side of
// the box of pixels with alpha > 140) and its area-equivalent radius (sqrt(area / pi) of those pixels). A disc gives P = its radius; a long flat
// bus gets less than its half length, a thin lamp less than its half height. The vortex is a disc: its P is the area-equivalent radius of the
// player's own drawn vortex (the starting look) at that radius.
// Eating is a tier gate only (canEatWorldObjectTier(): T2 objects from radius 30, T3 46, T4 66, T5 90, T6 118 = growth.radiusAnchors), so a T2-T6
// object stays locked through the whole tier below it while that vortex grows 31-67 %: no static picture size can tell "locked" from
// "eatable" at the threshold (REVIEW-01). Variant C splits the two jobs:
//   size   : every T2-T6 kind is drawn so its P = its radius r (band 0.97-1.06, scale capped at x1.45): the picture matches the hitbox,
//            tiers stay in order, production's too-light pictures (P 0.70-0.94 r) grow, the x1.7-2.0 pictures of variant A are gone;
//   signal : a locked object near the vortex shows a small tier badge (Game.lockBadgeTargets() / drawLockBadges()) before the vortex's edge
//            reaches its picture; an eatable one shows none and keeps the can-eat ring. The state comes from Game.holeCanEat().
// T1 (fragment, kapsula: eatable from the first frame): no rule, untouched.
// Sections: rule (band, cap, order, ring), draw (the drawn pixels follow the table; Campaign/T1/gfx paths untouched), signal (badge on/off,
// timing, portal, frenzy, Campaign), layout (seeded spawn: same RNG stream, same objects, no object waiting, no picture over another),
// source (eat gates, tiers, growth, radii byte-identical to base; the Arena eat code = base + the approved V2g edits only: a T1 fragment is
// swallowed by the player's vortex within 1.0 R, rivals and every other object 0.85 R, Campaign never runs it -- probed in the page).
// Output: qa/out/objscale1/results.json (+ the console). Exit 1 on any FAIL.
import fs from 'node:fs';
import path from 'node:path';
import { serve, report, OUT, ROOT, isMain } from './lib.mjs';
import { session } from './objraster2-shots.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const DIR = path.join(OUT, 'objscale1');
export const BAND = [0.97, 1.06], CAP = 1.45, ALPHA = 140;
const LOCKED = 0.85;   // REVIEW-01's 'clearly smaller' mark, reported (not gated) for the record
export const KINDS = { lawka: 2, kiosk: 2, skrzynia: 2, latarnia: 2, drzewo: 2, znacznik: 2, samochod: 3, wezel: 3, pylon: 3, pawilon: 4, billboard: 4, magazyn: 4, landmark: 4, autobus: 5, tramwaj: 5, ciezarowka: 5, wiezowiec: 6, maszt: 6, kopula: 6 };

/** A served copy of a checkout whose game.js also exports what this test reads (QA only; the game's own export list is untouched). */
export function exportedRoot(root, name) {
  const dir = path.join(DIR, '.root-' + name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(root)) if (/\.(js|html|css)$/.test(f) && f !== 'game.js') fs.copyFileSync(path.join(root, f), path.join(dir, f));
  const src = fs.readFileSync(path.join(root, 'game.js'), 'utf8'), vs = src.includes('const OBJECT_VIEW_SCALE'), lb = src.includes('const LOCK_BADGE');
  fs.writeFileSync(path.join(dir, 'game.js'), src + `\nexport { drawObjectArt as __qaDraw, getObjectSprite as __qaSprite, OBJECT_RASTER as __qaRaster, spawnViewBox as __qaViewBox${vs ? ', OBJECT_VIEW_SCALE as __qaViewScale' : ''}${lb ? ', LOCK_BADGE as __qaBadge, objectPictureReach as __qaReach' : ''}${src.includes('function objectPictureBox') ? ', objectPictureBox as __qaBox' : ''} };\n`);
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
      for (let R = A0; R < A; R += 0.25) { n++; if (P / holeP(M, R) < LOCKED) small++; }
      rows[k][look] = { scale: s, P: +P.toFixed(2), Pr: +(P / e.r).toFixed(3), rho: +(P / holeP(M, A)).toFixed(3), clearlySmallerShare: +(small / n).toFixed(3),
        firstClearlySmallerAt: (() => { for (let R = A0; R < A; R += 0.25) if (P / holeP(M, R) < LOCKED) return R; return null; })() };
    }
  }
  return rows;
}

/** The OBJECT_VIEW_SCALE table the rule asks for: [bitmap, vector] so that P = r, never below 1 (only too-light pictures grow), at most CAP. */
function derive(M) {
  const t = {};
  for (const [k, e] of Object.entries(M.kinds)) t[k] = ['bmp', 'vec'].map(look => Math.min(CAP, Math.max(1, Math.ceil(e.r / e[look].P * 100) / 100)));
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

/* ------------------------------------------------------------- signal ------------------------------------------------------------- */
/** In the page (candidate): Game.lockBadgeTargets() in staged cases. contact[k][dir] = the edge of kind k's measured picture that faces the
 *  vortex when the object sits in that direction from it (world units, at its scale) -- from the rule section's boxes (contactTable()). */
async function signal(page, contact) {
  return page.evaluate(async ({ KINDS, contact }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
    const g = window.game, T = m.TIERS, A = m.CONFIG.growth.radiusAnchors, kt = {};
    for (const [n, t] of Object.entries(T)) for (const k of t.subtypes) kt[k] = n;
    const stop = () => { if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; };
    const fresh = (kind, R, n = 1) => {
      window.__qaSeedRandom(2024); g.applyGfx(2); g.startRound({ seed: 2024 }); stop(); g.frenzyEndsAt = null;
      let objs;
      if (kind === 'portal') { g.spawnPortalRain(); objs = g.objects.filter(o => o.subtype === 'portal').slice(0, n); } else objs = g.objects.filter(o => o.subtype === kind && !o.eating).slice(0, n);
      g.objects = objs.slice();
      const p = g.player; p.x = 1500; p.y = 1500; p.radius = R; g.zoom = 1; g.lockHintAt = null; g.camera.x = p.x; g.camera.y = p.y;
      for (const o of objs) o.lockHintAt = null;
      return { p, objs };
    };
    const place = (o, p, d, a) => { o.x = p.x + Math.cos(a) * d; o.y = p.y + Math.sin(a) * d; };
    const near = (R) => Math.max(R * m.__qaBadge.nearFrac, m.__qaBadge.nearPx / g.zoom);
    const at = (kind, R, gapUnits, a = -Math.PI / 4) => {   // gap = between the badge's own rim (1.16 R) and the picture's farthest edge
      const { p, objs } = fresh(kind, R), o = objs[0];
      place(o, p, R * m.__qaBadge.holeDrawn + m.__qaReach(kind, o.radius) + gapUnits, a);
      const list = g.lockBadgeTargets();
      return { kind, R, canEat: g.holeCanEat(p, o), ring: g.canEatHighlight(o), badges: list.map(t => ({ kind: t.obj.subtype, tier: m.CONFIG.sizeTiers[t.tier].shortId, alpha: +t.alpha.toFixed(2) })), want: 'T' + (T[kt[kind]].minSizeTier + 1) };
    };
    const cases = { lockedNear: [], eatableNear: [], lockedFar: [], contact: [], frenzy: null, cap: null, hint: null, campaign: null, size: null, place: [], dense: [], hud: null };
    // FINAL-03: where the badge goes on screen (Game.lockBadgePlacements(), CSS px) -- off the vortex's drawn disc, the picture, the HUD, each other
    const scr = (o) => ({ x: (o.x - g.camera.x) * g.zoom + g.width / 2, y: (o.y - g.camera.y) * g.zoom + g.height / 2 });
    const rectHits = (a, b) => a.x < b.r && a.x + a.w > b.l && a.y < b.b && a.y + a.h > b.t;
    const onDisc = (q, p) => { const c = scr(p), r = p.radius * m.__qaBadge.holeDrawn * g.zoom, nx = Math.min(Math.max(c.x, q.x), q.x + q.w) - c.x, ny = Math.min(Math.max(c.y, q.y), q.y + q.h) - c.y; return nx * nx + ny * ny < r * r - 0.01; };
    const placed = () => g.lockBadgePlacements().map(q => ({ obj: q.t.obj, x: q.x, y: q.y, w: q.s.w, h: q.s.h }));
    const picRect = (o) => { const b = m.__qaBox(o.subtype, o.radius), c = scr(o); return { l: c.x + b[0] * g.zoom, r: c.x + b[1] * g.zoom, t: c.y + b[2] * g.zoom, b: c.y + b[3] * g.zoom }; };
    const overlaps = (L) => { let n = 0; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (rectHits(L[i], { l: L[j].x, r: L[j].x + L[j].w, t: L[j].y, b: L[j].y + L[j].h })) n++; return n; };
    cases.size = { h: m.__qaBadge.h, halo: m.__qaBadge.halo, max: m.__qaBadge.max };
    const zoomFor = (R) => { const zc = m.CONFIG.juice.zoom, gt = Math.min(1, Math.max(0, (R - zc.startRadius) / (zc.endRadius - zc.startRadius))); let z = (zc.max + (zc.min - zc.max) * Math.sqrt(gt)) * g.viewScale; z = Math.min(z, zc.holeScreenFrac * Math.min(g.width, g.height) / R); return Math.max(z, zc.floor, g.width / 3000, g.height / 3000); };   // = Game.update()'s target zoom
    for (const zf of [1, 0.8]) for (const [k, t] of Object.entries({ latarnia: 2, wezel: 3, pylon: 3, landmark: 4, autobus: 5, tramwaj: 5, wiezowiec: 6, maszt: 6, kopula: 6, portal: 4 }))
      for (const [dir, a] of Object.entries({ up: -Math.PI / 2, right: 0, down: Math.PI / 2, left: Math.PI, upleft: -Math.PI * 0.75 })) {
        const R = A[t - 1] - 2, { p, objs } = fresh(k, R), o = objs[0], zoom = +(zoomFor(R) * zf).toFixed(3); g.zoom = zoom;
        place(o, p, R * m.__qaBadge.holeDrawn + m.__qaReach(k, o.radius) + 0.3 * R, a);
        const L = placed(), q = L[0];
        cases.place.push({ kind: k, dir, zoom, R, shown: L.length, where: q ? (q.y + q.h <= picRect(o).t + 0.01 ? 'above' : q.y >= picRect(o).b - 0.01 ? 'below' : 'side') : null,
          onVortex: q ? onDisc(q, p) : null, onPicture: q ? rectHits(q, picRect(o)) : null, hPx: q ? q.h : null,
          aboveOff: q ? picRect(o).t - m.__qaBadge.gapPx - q.h < ((g.safe && g.safe.t) || 0) : null });
      }
    for (const [zf, R, kind, n] of [[1, 25, 'lawka', 8], [0.8, 25, 'lawka', 8], [1, 40, 'samochod', 8], [1, 60, 'pawilon', 8], [1, 85, 'autobus', 6], [1, 112, 'wiezowiec', 4]]) {
      const { p, objs } = fresh(kind, R, n), zoom = +(zoomFor(R) * zf).toFixed(3); g.zoom = zoom;
      objs.forEach((o, i) => place(o, p, R * 1.16 + m.__qaReach(kind, o.radius) + 1 + i * 2, (i / objs.length) * Math.PI * 2 + 0.3));
      const L = placed(), TG = g.lockBadgeTargets().map(t => t.obj);
      cases.dense.push({ kind, R, zoom, targets: TG.length, shown: L.length, overlaps: overlaps(L), onVortex: L.filter(q => onDisc(q, p)).length, onOther: L.filter(q => TG.some(o => o !== q.obj && rectHits(q, picRect(o)))).length });
    }
    { // the vortex pressed to the city's top edge, a locked object above it: the badge stays off every HUD panel (and the safe area)
      const { p, objs } = fresh('samochod', 40), o = objs[0]; g.zoom = 1;
      g.hudBoxes = null; g.fadeHudUnderHole();
      const hb = (g.hudBoxes || []).map(b => ({ l: b.l, r: b.r, t: b.t, b: b.b }));
      // put a HUD-sized box right where the badge would go, to force the fallback
      place(o, p, 40 * 1.16 + m.__qaReach('samochod', o.radius) + 10, -Math.PI / 2);
      const first = placed()[0], fake = first ? { el: { id: 'qa' }, l: first.x - 4, r: first.x + first.w + 4, t: first.y - 4, b: first.y + first.h + 4 } : null;
      g.hudBoxes = (g.hudBoxes || []).concat(fake ? [fake] : []);
      const L = placed(), q = L[0];
      cases.hud = { realBoxes: hb.length, before: first ? 'shown' : 'none', after: q ? 'shown' : 'none', onHud: q ? g.hudBoxes.some(b => rectHits(q, b)) : null, onVortex: q ? onDisc(q, p) : null };
      g.hudBoxes = null;
    }
    const KS = { lawka: 2, samochod: 3, pawilon: 4, autobus: 5, wiezowiec: 6, portal: 4 };
    for (const [k, t] of Object.entries(KS)) {
      cases.lockedNear.push(at(k, A[t - 1] - 6, 0.2 * (A[t - 1] - 6)));
      cases.eatableNear.push(at(k, A[t - 1] + 1, 0.2 * (A[t - 1] + 1)));
      cases.lockedFar.push(at(k, A[t - 1] - 6, near(A[t - 1] - 6) + 2));
    }
    // the moment of visual contact: the measured picture touching a 1.16 R disc (the vortex as drawn), every T2-T6 kind, 4 directions
    for (const k of Object.keys(KINDS)) for (const [dir, a] of Object.entries({ left: Math.PI, right: 0, up: -Math.PI / 2, down: Math.PI / 2 })) {
      const R = A[KINDS[k] - 1] - 1, { p, objs } = fresh(k, R);
      place(objs[0], p, R * 1.16 + contact[k][dir], a);
      const list = g.lockBadgeTargets();
      cases.contact.push({ kind: k, dir, R, alpha: list.length ? +list[0].alpha.toFixed(2) : 0 });
    }
    { // SZAŁ (frenzy): one tier more is eatable -> that tier's badge goes
      const { p, objs } = fresh('samochod', 40); place(objs[0], p, 40 * 1.16 + m.__qaReach('samochod', objs[0].radius) + 4, 0);
      const off = g.lockBadgeTargets().length;
      g.frenzyEndsAt = g.timeRemaining - 10; const active = g.frenzyActive, on = g.lockBadgeTargets().length; g.frenzyEndsAt = null;
      cases.frenzy = { active, off, on };
    }
    { // at most LOCK_BADGE.max, nearest first
      const { p, objs } = fresh('lawka', 25, 8);
      objs.forEach((o, i) => place(o, p, 25 * 1.16 + m.__qaReach('lawka', o.radius) + 1 + i, (i / objs.length) * Math.PI * 2));
      const list = g.lockBadgeTargets();
      cases.cap = { placed: objs.length, shown: list.length, max: m.__qaBadge.max, nearestFirst: list.every((t, i) => i === 0 || t.gap >= list[i - 1].gap) };
    }
    { // not while the object's own "ZA DUŻE" tag is up
      const { p, objs } = fresh('lawka', 25); place(objs[0], p, 25 * 1.16 + m.__qaReach('lawka', objs[0].radius) + 2, 0);
      objs[0].lockHintAt = performance.now(); const during = g.lockBadgeTargets().length; objs[0].lockHintAt = null;
      cases.hint = { during, after: g.lockBadgeTargets().length };
    }
    { // drawn by the Arena renderer only: render() calls drawLockBadges(), renderCampaign() never does
      const { p, objs } = fresh('lawka', 25); place(objs[0], p, 25 * 1.16 + m.__qaReach('lawka', objs[0].radius) + 2, 0);
      let calls = 0; const orig = g.drawLockBadges; g.drawLockBadges = function (ctx) { calls++; return orig.call(this, ctx); };
      g.render(1); const arena = calls; calls = 0;
      let campaign = null, err = null;
      try { g.startCampaignMission('M13'); stop(); g.renderCampaign(1); campaign = calls; } catch (e) { err = String(e && e.message || e); }
      g.drawLockBadges = orig;
      cases.campaign = { arena, campaign, err, sprites: m.__qaBadge.sprites.size };
    }
    return cases;
  }, { KINDS, contact });
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
  ['SPAWN_VIEW', /^const SPAWN_VIEW = \{/], ['campaign entityRadius', /^    entityRadius: \{/], ['CampaignEntity.draw', /^class CampaignEntity \{/],
  ['handleCampaignEating', /^  handleCampaignEating\(\) \{/], ['CONFIG.golden', /^  golden: \{/]
];
/** FINAL INTEGRATION (owner + GPT decision): the one approved change to the eat code -- V2g: a T1 fragment is swallowed by the PLAYER's
 *  vortex within 1.0 R (CONFIG.arena.fragmentReach = [1.0, 0, true]); rivals and every other object keep 0.85 R. handleObjectEating() must
 *  equal the base's text with exactly these edits applied -- any other change to it fails SF-SOURCE-v2g. */
export const V2G_FRAGMENT_REACH = '    fragmentReach: [1.0, 0, true],';
export const V2G_EDITS = [
  ['    const reach = hole.radius * 0.85 * (hole.isPlayer && this.frenzyActive ? CONFIG.golden.reachMult : 1);',
    '    const reach = hole.radius * 0.85 * (hole.isPlayer && this.frenzyActive ? CONFIG.golden.reachMult : 1);\n    const fr = CONFIG.arena.fragmentReach, fragReach = fr[2] && !hole.isPlayer ? reach : Math.max(reach, hole.radius * fr[0] + TIERS.fragment.maxR * fr[1]);'],
  ['      const gx = Math.abs(obj.x - hole.x), gy = Math.abs(obj.y - hole.y);\n      if (gx >= reach || gy >= reach) {',
    "      const lim = obj.tier === 'fragment' ? fragReach : reach;\n      const gx = Math.abs(obj.x - hole.x), gy = Math.abs(obj.y - hole.y);\n      if (gx >= lim || gy >= lim) {"],
  ['      if (d < reach || (hole.isPlayer', '      if (d < lim || (hole.isPlayer']
];

/* ------------------------------------------------------------- eat probe ------------------------------------------------------------- */
/** In the page: where swallowing starts (Game.handleObjectEating(), centre distance, bisection in 4 directions, the city's middle so the
 *  edge rule stays out) for the player's and a rival's vortex: the T1 fragment at R 18/24/29 (+ SZAŁ), the kapsula, the golden core, the
 *  T4 portal and one kind of every tier T2-T6 just past its unlock -- as multiples of R. And, in a Campaign mission, how often the Arena
 *  eat code runs (must be never: Campaign eats in handleCampaignEating()). */
async function eatProbe(page) {
  return page.evaluate(async () => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
    const g = window.game, A = m.CONFIG.growth.radiusAnchors;
    const stop = () => { if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; };
    const probe = (kind, R, who, frenzy = false) => {
      window.__qaSeedRandom(2024); g.startRound({ seed: 2024 }); stop(); g.frenzyEndsAt = frenzy ? g.timeRemaining - 10 : null;
      if (kind === 'portal') g.spawnPortalRain();
      if (kind === 'zloty') g.spawnGoldenCore();
      const obj = g.objects.find(o => o.subtype === kind && !o.eating);
      if (!obj) return { kind, R, who, frenzy, missing: true };
      g.objects = [obj];
      const h = who === 'gracz' ? g.player : g.bots[0];
      for (const b of g.bots) { b.x = 300; b.y = 300; }
      if (who === 'rywal') { g.player.x = 2700; g.player.y = 2700; }
      h.x = 1500; h.y = 1500; h.radius = R;
      const active = !!g.frenzyActive;
      const at = (d, a) => { obj.x = 1500 + Math.cos(a) * d; obj.y = 1500 + Math.sin(a) * d; obj.eating = false; obj.eater = null; obj.eatT = 0; g.handleObjectEating(h); const e = !!obj.eating; obj.eating = false; obj.eater = null; obj.eatT = 0; return e; };
      const start = [];
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        if (!at(0.01, a)) { start.push(null); continue; }
        let lo = 0.01, hi = R * 3; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (at(mid, a)) lo = mid; else hi = mid; }
        start.push(+(lo / R).toFixed(3));
      }
      g.frenzyEndsAt = null;
      return { kind, R, who, frenzy, active, startR: start };
    };
    const out = [];
    for (const R of [18, 24, 29]) for (const who of ['gracz', 'rywal']) out.push(probe('fragment', R, who));
    out.push(probe('fragment', 24, 'gracz', true));
    for (const who of ['gracz', 'rywal']) {
      out.push(probe('kapsula', 24, who)); out.push(probe('zloty', 24, who)); out.push(probe('portal', A[3] + 0.5, who));
      for (const [k, t] of [['lawka', 2], ['samochod', 3], ['pawilon', 4], ['landmark', 4], ['autobus', 5], ['wiezowiec', 6]]) out.push(probe(k, A[t - 1] + 0.5, who));
    }
    let arenaCalls = 0, campCalls = 0, err = null;
    const oa = g.handleObjectEating, oc = g.handleCampaignEating;
    g.handleObjectEating = function (h) { arenaCalls++; return oa.call(this, h); };
    g.handleCampaignEating = function () { campCalls++; return oc.call(this); };
    // what Game.loop() runs in a mission: mode 'campaign' -> updateCampaign() (Game.update() is the Arena step)
    let mode = null;
    try { g.startCampaignMission('M13'); stop(); mode = g.mode; g.introPending = false; for (let i = 0; i < 60; i++) { if (g.mode === 'campaign') g.updateCampaign(1 / 60); else g.update(1 / 60); } } catch (e) { err = String(e && e.message || e); }
    g.handleObjectEating = oa; g.handleCampaignEating = oc;
    return { probes: out, campaign: { mode, arenaCalls, campCalls, err } };
  });
}

/** Per kind and approach direction, the picture's edge facing the vortex (world units, at the table's bitmap scale), from the measured box:
 *  an object to the left of the vortex faces it with its right edge, one above it with its bottom edge, etc. */
function contactTable(M) {
  const out = {};
  for (const [k, e] of Object.entries(M.kinds)) {
    const s = M.table && M.table[k] ? M.table[k][0] : 1, [l, r, t, b] = e.bmp.box;
    out[k] = { left: r * s, right: -l * s, up: b * s, down: -t * s };
  }
  return out;
}

export async function run({ base, only = ['rule', 'draw', 'signal', 'layout', 'source'], seeds = 40 } = {}) {
  fs.mkdirSync(DIR, { recursive: true });
  const results = { stage: 'GG-OBJECTS-SCALE-FIX-01 C', band: BAND, cap: CAP, alpha: ALPHA };
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
      if (only.includes('source')) data[name].E = await eatProbe(g.page);
      if (only.includes('signal') && name === 'cand') data[name].S = await signal(g.page, contactTable(data[name].M || await measure(g.page)));
      data[name].errors = g.errors.slice();
    } finally { await g.browser.close(); srv.server.close(); }
  }

  if (only.includes('rule')) {
    const before = judge(data.base.M), after = judge(data.cand.M);
    results.rule = { before, after, hole: data.cand.M.hole, anchors: data.cand.M.anchors, table: data.cand.M.table };
    console.log('\nkind        T  r  unlock | look  BEFORE P/r  rho  clearly-smaller | AFTER scale  P/r  rho  clearly-smaller (reported, not gated: the badge says "locked")');
    for (const k of Object.keys(KINDS)) for (const look of ['bmp', 'vec']) {
      const b = before[k][look], a = after[k][look];
      console.log(`${k.padEnd(11)} ${KINDS[k]} ${String(after[k].r).padStart(3)} ${String(after[k].unlock).padStart(4)}   | ${look}  ${b.Pr.toFixed(2)} ${b.rho.toFixed(2)} ${(b.clearlySmallerShare * 100).toFixed(0).padStart(3)} % | ${a.scale.toFixed(2)} ${a.Pr.toFixed(2)} ${a.rho.toFixed(2)} ${(a.clearlySmallerShare * 100).toFixed(0).padStart(3)} %`);
    }
    for (const look of ['bmp', 'vec']) {
      const bad = Object.keys(KINDS).filter(k => { const a = after[k][look]; return !((a.Pr >= BAND[0] || a.scale === CAP) && (a.Pr <= BAND[1] || a.scale === 1)); });
      check(`SF-RULE-${look}: every T2-T6 ${look === 'bmp' ? 'bitmap' : 'vector'} look has P = r (${BAND[0]}-${BAND[1]} r; only a capped or unscaled kind may sit outside)`, bad.length === 0, { bad: bad.map(k => `${k} P/r ${after[k][look].Pr} x${after[k][look].scale}`) });
      const big = Object.keys(KINDS).filter(k => after[k][look].scale > CAP);
      check(`SF-CAP-${look}: no kind drawn more than x${CAP} (variant A went to x2.0)`, big.length === 0, { big });
      const worse = Object.keys(KINDS).filter(k => after[k][look].rho < before[k][look].rho - 0.005);
      check(`SF-GAIN-${look}: no kind looks smaller next to the vortex than in production (rho at unlock >= base)`, worse.length === 0, { worse, min: Math.min(...Object.keys(KINDS).map(k => after[k][look].rho)), baseMin: Math.min(...Object.keys(KINDS).map(k => before[k][look].rho)) });
      const byTier = {}; for (const k of Object.keys(KINDS)) (byTier[KINDS[k]] = byTier[KINDS[k]] || []).push(after[k][look].P);
      const order = [2, 3, 4, 5].map(t => ({ t, maxLo: Math.max(...byTier[t]), minHi: Math.min(...byTier[t + 1]) }));
      check(`SF-ORDER-${look}: each tier's smallest picture is bigger than the tier below's biggest`, order.every(o => o.minHi > o.maxLo), order);
    }
    // the can-eat ring (WorldObject.draw(): r + 3, +2 at its widest breath -- production's) hugs the picture (>= its P) and, at the unlock radius, stays inside the vortex
    const ring = [];
    for (const k of Object.keys(KINDS)) {
      const e = data.cand.M.kinds[k], rr = e.r + 3, hp = holeP(data.cand.M, data.cand.M.anchors[e.minSizeTier]);
      if (rr < after[k].bmp.P || rr + 2 > hp + 1) ring.push(`${k}: ring ${rr.toFixed(1)}-${(rr + 2).toFixed(1)}, picture P ${after[k].bmp.P}, vortex ${hp.toFixed(1)}`);
    }
    check('SF-RING: the can-eat ring (r + 3) hugs the picture and fits in the vortex at unlock', ring.length === 0, { ring });
    const unchanged = ['fragment', 'kapsula'].every(k => !data.cand.M.table || !data.cand.M.table[k]);
    check('SF-T1: fragment and kapsula keep their scale (no table entry)', unchanged, {});
  }

  if (only.includes('signal')) {
    const S = data.cand.S;
    const ln = S.lockedNear.filter(c => c.canEat || c.badges.length !== 1 || c.badges[0].tier !== c.want || c.badges[0].alpha < 1);
    check('SF-SIGNAL-locked: a locked object near the vortex (T2-T6 + the T4 portal) shows one badge naming its tier, fully visible', ln.length === 0, { bad: ln });
    const en = S.eatableNear.filter(c => !c.canEat || c.badges.length !== 0 || c.ring !== 1);
    check('SF-SIGNAL-eatable: an eatable object near the vortex shows no badge and keeps the can-eat ring', en.length === 0, { bad: en });
    const lf = S.lockedFar.filter(c => c.badges.length !== 0);
    check('SF-SIGNAL-far: a locked object beyond the badge distance shows none (not across the map)', lf.length === 0, { bad: lf });
    const late = S.contact.filter(c => c.alpha < 1);
    check('SF-SIGNAL-early: the badge is fully shown by the time the vortex (drawn disc 1.16 R) touches the picture, every T2-T6 kind, 4 directions', late.length === 0, { late: late.slice(0, 8), n: S.contact.length });
    check('SF-SIGNAL-frenzy: SZAŁ (one tier more eatable) removes that tier\'s badge -- the real eat gate', S.frenzy.active && S.frenzy.off === 1 && S.frenzy.on === 0, S.frenzy);
    check('SF-SIGNAL-cap: at most LOCK_BADGE.max badges, nearest first', S.cap.shown === S.cap.max && S.cap.nearestFirst, S.cap);
    check('SF-SIGNAL-hint: no badge while the object\'s own "ZA DUŻE" tag is up', S.hint.during === 0 && S.hint.after === 1, S.hint);
    check('SF-SIGNAL-campaign: drawn by the Arena renderer only (renderCampaign() never draws a badge)', S.campaign.arena === 1 && S.campaign.campaign === 0 && !S.campaign.err, S.campaign);
    check('SF-SIGNAL-cache: badge pictures cached (a handful of canvases, not one per frame)', S.campaign.sprites > 0 && S.campaign.sprites <= 12, { sprites: S.campaign.sprites });
    if (S.size) {
      check('SF-SIGNAL-size: the badge pill is 20-22 CSS px tall at any zoom (FINAL-03: 17 px was too small on a phone)', S.size.h >= 20 && S.size.h <= 22 && S.place.every(c => !c.shown || c.hPx === S.place[0].hPx), { size: S.size, hPx: S.place[0] && S.place[0].hPx });
      const bad = S.place.filter(c => c.shown !== 1 || c.onVortex || c.onPicture || (c.dir !== 'down' && c.where !== 'above' && !c.aboveOff));
      check('SF-SIGNAL-place: tall / wide / T4 portal, 5 directions, the game zoom and 0.8 of it: one badge, never on the drawn vortex disc nor the picture; above it unless the vortex or the screen edge is in the way', bad.length === 0, { bad: bad.slice(0, 8), n: S.place.length, where: S.place.reduce((a, c) => (a[c.where] = (a[c.where] || 0) + 1, a), {}) });
      const dn = S.dense.filter(c => c.shown < 1 || c.shown > 4 || c.overlaps || c.onVortex || c.onOther);
      check('SF-SIGNAL-dense: 6-8 locked objects around the vortex: 1-4 badges, none overlapping another badge, another badged picture or the vortex', dn.length === 0, { dense: S.dense });
      check('SF-SIGNAL-hud: a badge that would sit under a HUD panel moves (or hides) -- never on the HUD or the vortex', S.hud.before === 'shown' && (S.hud.after === 'none' || (!S.hud.onHud && !S.hud.onVortex)), S.hud);
    }
    results.signal = S;
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
    const diff = GUARDED.filter(([n]) => n !== 'handleObjectEating').filter(([, re]) => { const a = block(bs, re), b = block(cs, re); return !a || a !== b; }).map(([n]) => n);
    check('SF-SOURCE: eat gates, tiers, growth, radii, spawn search, Campaign eat code + entities, SZAŁ reach byte-identical to base', diff.length === 0, { diff });
    // the approved V2g exception, and nothing else, in the Arena eat code
    const re = GUARDED.find(([n]) => n === 'handleObjectEating')[1], bEat = block(bs, re), cEat = block(cs, re);
    let want = bEat; const missing = [];
    for (const [a, b] of V2G_EDITS) { if (!want || want.split(a).length !== 2) missing.push(a.trim().slice(0, 40)); else want = want.replace(a, () => b); }
    const cfg = cs.split(/\r?\n/).filter(l => /^\s*fragmentReach:/.test(l)), cfgBase = bs.split(/\r?\n/).filter(l => /^\s*fragmentReach:/.test(l));
    check('SF-SOURCE-v2g: handleObjectEating() = base + exactly the approved V2g edits; CONFIG.arena.fragmentReach = [1.0, 0, true] (base has none)',
      missing.length === 0 && want === cEat && cfg.length === 1 && cfg[0].startsWith(V2G_FRAGMENT_REACH) && cfgBase.length === 0, { missing, sameAsExpected: want === cEat, cfg, cfgBase });
    // behaviour: where swallowing starts, base vs candidate
    const E0 = data.base.E, E1 = data.cand.E, key = (p) => `${p.kind}|${p.R}|${p.who}|${p.frenzy}`;
    const pairs = E1.probes.map(p => [E0.probes.find(q => key(q) === key(p)), p]);
    const near = (a, b) => !!a && a.every((x) => x != null && Math.abs(x - b) < 0.006);
    const frag = pairs.filter(([, p]) => p.kind === 'fragment' && !p.frenzy);
    const fp = frag.filter(([b, c]) => c.who === 'gracz' && !(near(b.startR, 0.85) && near(c.startR, 1.0)));
    check('SF-EAT-v2g-player: the player vortex swallows a T1 fragment within 1.0 R (base 0.85 R), R 18 / 24 / 29, 4 directions', fp.length === 0 && frag.some(([, c]) => c.who === 'gracz'), { bad: fp, sample: frag.filter(([, c]) => c.who === 'gracz').map(([b, c]) => [c.R, b.startR[0], c.startR[0]]) });
    const fr = frag.filter(([b, c]) => c.who === 'rywal' && !(near(b.startR, 0.85) && near(c.startR, 0.85)));
    check('SF-EAT-v2g-rivals: a rival vortex still swallows a fragment within 0.85 R (unchanged), R 18 / 24 / 29', fr.length === 0 && frag.some(([, c]) => c.who === 'rywal'), { bad: fr });
    const fz = pairs.filter(([, p]) => p.frenzy).filter(([b, c]) => !c.active || JSON.stringify(b.startR) !== JSON.stringify(c.startR) || !near(c.startR, 0.85 * 1.35));
    check('SF-EAT-v2g-frenzy: during SZAŁ the longer reach (0.85 x 1.35 R) still wins for the fragment, as in base', fz.length === 0 && pairs.some(([, p]) => p.frenzy), { bad: fz, got: pairs.filter(([, p]) => p.frenzy).map(([b, c]) => [b.startR, c.startR]) });
    const others = pairs.filter(([, p]) => p.kind !== 'fragment').filter(([b, c]) => !b || b.missing || c.missing || JSON.stringify(b.startR) !== JSON.stringify(c.startR) || !near(c.startR, 0.85));
    check('SF-EAT-others: kapsula, golden core, T4 portal and T2-T6 kinds (player and rival) swallow exactly as in base (0.85 R)', others.length === 0, { bad: others.slice(0, 6), n: pairs.filter(([, p]) => p.kind !== 'fragment').length });
    const cp = E1.campaign;
    check('SF-EAT-campaign: a Campaign mission (the mission step Game.loop() runs) never runs the Arena eat code (handleObjectEating 0 calls, handleCampaignEating runs)', cp.mode === 'campaign' && cp.arenaCalls === 0 && cp.campCalls > 0 && !cp.err && E0.campaign.arenaCalls === 0, { cand: cp, base: E0.campaign });
    results.eat = { base: E0, cand: E1 };
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
