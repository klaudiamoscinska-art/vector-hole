// GG-OBJECTS-04 -- "Premium Vector Objects", the T5/T6 looks and their boss
// landmarks. What this suite proves:
//  - O4-1 nothing else changed: the T1-T4 looks, the kit, the palette, the
//    camera and the icon replay are the base revision's source, their
//    sprites its pixels, their goal icons (and the twists') its markup;
//  - O4-2 only the picture changed: every class keeps tier, radius, value,
//    growth, count and looks; the landmarks keep their tiers and looks
//    (the spire's gate T5 and the spire T6 still share lm_iglica); the eat
//    gate still opens at T5 / T6;
//  - O4-3 the sixteen T5/T6 looks are the shared kit's art (2x sprites), and
//    every Arena subtype / campaign entity / boss of those tiers resolves to one;
//  - O4-4 a sprite is whole and sits on its hitbox without outgrowing it;
//  - O4-5 one geometry at every scale: board sprite = big preview = goal
//    icon; every look and every named boss has its own icon in its tier color;
//  - O4-6 one camera, one orientation (top, front, RIGHT side; no idle turn);
//  - O4-7 painting draws no Math.random, leaves game.rng, the layout and the
//    save alone;
//  - O4-8 the cache: 2x sprites, none added on a still frame, fewer pixels
//    than the base's sprites for the same looks, a quick build;
//  - O4-9 Arena, Daily, a friend's challenge, the T5/T6 missions of both
//    chapters and quality 0 draw them, with no page or console error.
// The pages run served copies of game.js (this checkout's and the base
// revision's) with one added export line -- the renderer is not part of the
// QA bridge.
// Usage: node qa/objects4.mjs
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, allDistrictsSave, report, expectAll, is, holds, revisionFile, QA_RANDOM, ROOT, isMain } from './lib.mjs';
import { LOOKS as LOOKS12 } from './objects2-shots.mjs';
import { LOOKS3, TIER_COLOR } from './objects3-shots.mjs';
import { LOOKS4, FROZEN_SPRITES4, sheetRoot, spriteHashes } from './objects4-shots.mjs';

/** The production main this stage was cut from (PR #96, the T3/T4 looks). */
export const OBJECTS4_BASE_REV = '1fa266b01800222d2a6ae19269eec78c536e53e5';
const T1234 = [...new Set(LOOKS12.map(l => l[0]).concat(LOOKS3.map(l => l[0])))];
const T56 = [...new Set(LOOKS4.map(l => l[0]))];
const LANDMARKS = ['kino', 'fontanna', 'dzwig', 'galeria_glowna', 'iglica_wejscie', 'iglica', 'rdzen_miasta_glowny', 'stacja', 'bazar_brama', 'fabryka', 'latarnia', 'drzewo', 'serwer'];

/** Goal steps whose icons this stage must not change (T1-T4 looks and classes, twists). */
const FROZEN_ICON_STEPS = [
  { eat: 'fragment', n: 1 }, { eat: 'capsule', n: 1 }, { eat: 'prop', n: 1 }, { eat: 'marker', n: 1 }, { eat: 'structure', n: 1 },
  ...LOOKS12.filter(l => l[2] === 'prop' || l[2] === 'marker').map(l => ({ eat: l[2], glyph: l[0], n: 1 })),
  ...LOOKS3.filter(l => l[5]).map(l => l[5]),
  { eat: 'runner', n: 1 }, { tier: 4 }, { tier: 6 }, { combo: 8 }, { score: 100 }
];

/** name -> source of every `name(c, r, col...) {` entry of an object literal in a game.js text. */
function entries(src, head) {
  const a = src.indexOf('\n' + head), b = src.indexOf('\n};', a);
  if (a < 0 || b < 0) return {};
  const body = src.slice(a, b), out = {}, starts = [];
  const re = /\n {2}([a-z_0-9]+)\(c, r, col[^)]*\) \{\n/g;
  let m;
  while ((m = re.exec(body))) starts.push([m[1], m.index]);
  starts.forEach(([name, at], i) => { out[name] = body.slice(at, i + 1 < starts.length ? starts[i + 1][1] : body.length).replace(/\n\n {2}(\/\/|\/\*)[\s\S]*$/, '').trim().replace(/,$/, ''); });
  return out;
}
const between = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + a.length); return i < 0 || j < 0 ? null : src.slice(i, j); };

async function open(url, dsf) {
  const g = await openGame(url, { viewport: { width: 420, height: 800 }, mobile: dsf > 1, deviceScaleFactor: dsf, initScript: QA_RANDOM });
  const save = await allDistrictsSave(g.page);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  await g.page.evaluate(async () => { window.__m = await import(document.querySelector('script[type="module"][src]').src); });
  return g;
}
const EXPORTS = '\nexport { OBJECT_ART as __qaObjectArt, VA_ART as __qaVaArt, VA_BIG as __qaVaBig, GOAL_ART_ICONS as __qaGoalArtIcons, GOAL_ICONS as __qaGoalIcons, CAMPAIGN_ENTITY_STATS as __qaEntityStats, LANDMARK_TIERS as __qaLandmarkTiers, LANDMARK_ART as __qaLandmarkArt };\n';
const inventory = (page, steps) => page.evaluate((steps) => ({
  tiers: JSON.stringify(TIERS), stats: JSON.stringify(window.__m.__qaEntityStats), landmarkTiers: JSON.stringify(window.__m.__qaLandmarkTiers), landmarkArt: JSON.stringify(window.__m.__qaLandmarkArt),
  radius: JSON.stringify(CONFIG.campaign.entityRadius), byTier: JSON.stringify(CONFIG.campaign.landmarkByTier), sizeTiers: JSON.stringify(CONFIG.sizeTiers),
  icons: steps.map(st => { const d = window.game.objectiveIconDef(st, null); return d.color + d.icon; }),
  twists: ['gate', 'portal', 'impulse', 'rival', 'landmark', 'tier', 'runner', 'hunters', 'racer', 'dark', 'glitch', 'fragile', 'structure', 'vehicle', 'node', 'pylon', 'prop', 'marker'].map(k => window.__m.__qaGoalIcons[k])
}), steps);

export async function runObjects4Checks() {
  const results = [];
  const nowSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
  let baseSrc = null, why = '';
  try { baseSrc = String(revisionFile(OBJECTS4_BASE_REV, 'game.js')); } catch (e) { why = String(e.message || e).slice(0, 160); }
  if (!baseSrc) {
    results.push(report('O4-1 the base revision is readable (the T1-T4 comparison needs it)', false, why));
    return results;
  }

  /* ---- O4-1 (static) ---- */
  {
    const vaNow = entries(nowSrc, 'const VA_ART = {'), vaBase = entries(baseSrc, 'const VA_ART = {');
    const oaNow = entries(nowSrc, 'const OBJECT_ART = {');
    const fn = (name) => [between(baseSrc, `\nfunction ${name}(`, '\n}\n'), between(nowSrc, `\nfunction ${name}(`, '\n}\n')];
    const line = (re) => [(baseSrc.match(re) || [''])[0], (nowSrc.match(re) || ['-'])[0]];
    const same = ([a, b]) => !!a && a === b;
    const live = (src) => between(src, '\nfunction drawObjectLive(', '\n}\n');
    results.push(expectAll('O4-1 the T1-T4 looks, the kit, the palette, the camera, the icon replay and the live overlays are the base revision\'s source', {
      compared: is(T1234.filter(k => vaBase[k]).length, T1234.length),
      changed: is(T1234.filter(k => vaBase[k] !== vaNow[k]).join(), ''),
      kit: is(same(fn('vaKit')), true), palette: is(same(fn('vaPalette')), true), iconReplay: is(same(fn('vaIconSvg')), true),
      camera: is(same(line(/const VA_DX = [^\n]+/)), true), materials: is(same(line(/const VA_INK = [\s\S]*?const VA_NIGHT = [^\n]+/)), true),
      sprite: is(same(fn('getObjectSprite')), true), draw: is(same(fn('drawObjectArt')), true), live: is(live(baseSrc) === live(nowSrc), true),
      byteKept: is(!!oaNow.bajt && between(baseSrc, '\n  bajt(c, r, col) {', '\n  },') === between(nowSrc, '\n  bajt(c, r, col) {', '\n  },'), true),
      oldT56Removed: is(T56.filter(k => oaNow[k]).join(), '')
    }, `${T1234.length} looks compared with ${OBJECTS4_BASE_REV.slice(0, 7)}`));
  }

  const baseSrv = await serve({ root: sheetRoot(ROOT, 'suite-base', baseSrc + EXPORTS) });
  const { server, url } = await serve({ root: sheetRoot(ROOT, 'suite', nowSrc + EXPORTS) });
  try {
    const b = await open(baseSrv.url, 2);
    const baseFacts = { sprites: await spriteHashes(b.page, FROZEN_SPRITES4), inv: await inventory(b.page, FROZEN_ICON_STEPS) };
    baseFacts.t56Pixels = await b.page.evaluate((looks) => {
      const c = document.createElement('canvas').getContext('2d'); window.__m.__qaSpriteCache.clear();
      for (const [k, , , r, tier] of looks) window.__m.__qaDrawObjectArt(c, k, { 5: '#CBD5E1', 6: '#46D99A' }[tier], r, 0, 0, { live: false });
      let px = 0; for (const [, s] of window.__m.__qaSpriteCache) px += s.canvas.width * s.canvas.height;
      return px;
    }, LOOKS4);
    const baseErrors = b.errors.length;
    await b.browser.close();

    const g = await open(url, 2);
    const page = g.page;
    const nowSprites = await spriteHashes(page, FROZEN_SPRITES4), inv = await inventory(page, FROZEN_ICON_STEPS);
    const keys = Object.keys(baseFacts.sprites);
    results.push(expectAll('O4-1 the T1-T4 sprites (board size and big, every variant), the golden core and the byte are the base revision\'s pixels', {
      compared: holds(keys.length >= 58, keys.length, '>= 58 sprites'),
      sameKeys: is(Object.keys(nowSprites).join(), keys.join()),
      different: is(keys.filter(k => baseFacts.sprites[k] !== nowSprites[k]).join(), '')
    }, `${keys.length} sprites on a 2x page`));
    results.push(expectAll('O4-1 the goal icons of T1-T4 (looks and classes) and the twists are the base revision\'s markup', {
      icons: is(FROZEN_ICON_STEPS.filter((st, i) => baseFacts.inv.icons[i] !== inv.icons[i]).map(st => JSON.stringify(st)).join(), ''),
      twists: is(JSON.stringify(inv.twists), JSON.stringify(baseFacts.inv.twists))
    }, `${FROZEN_ICON_STEPS.length} goal rows + ${inv.twists.length} class / twist icons`));

    /* ---- O4-2: numbers ---- */
    const gate = await page.evaluate((LANDMARKS) => {
      const at = (t) => { let r = 18; while (getSizeTierIndex(r) < t && r < 900) r += 0.5; return r; };
      const eats = (t, tier) => canEatWorldObjectTier(at(t), { tier });
      const ent = {};
      for (const k of ['heavy', 'tower']) { const e = new CampaignEntity(k, 0, 0); ent[k] = [e.radius, e.stats.growth, e.stats.score, e.stats.minTier]; }
      for (const id of LANDMARKS) { const e = new CampaignEntity('landmark', 0, 0, { landmarkId: id }); ent[id] = [e.radius, e.stats.growth, e.stats.score, e.stats.minTier]; }
      return { ent, t4Heavy: eats(3, 'heavy'), t5Heavy: eats(4, 'heavy'), t5Tower: eats(4, 'tower'), t6Tower: eats(5, 'tower') };
    }, LANDMARKS);
    const L = (r, gr, sc, t) => [r, gr, sc, t];
    results.push(expectAll('O4-2 every class keeps tier, radius, value, growth, count and looks; the landmarks keep their tiers, sizes and looks; the eat gate opens at T5 / T6', {
      tiers: is(inv.tiers, baseFacts.inv.tiers), stats: is(inv.stats, baseFacts.inv.stats),
      landmarkTiers: is(inv.landmarkTiers, baseFacts.inv.landmarkTiers), landmarkArt: is(inv.landmarkArt, baseFacts.inv.landmarkArt),
      radii: is(inv.radius + inv.byTier + inv.sizeTiers, baseFacts.inv.radius + baseFacts.inv.byTier + baseFacts.inv.sizeTiers),
      sharedSpire: is(JSON.parse(inv.landmarkArt).iglica_wejscie + '/' + JSON.parse(inv.landmarkArt).iglica, 'lm_iglica/lm_iglica'),
      entities: is(JSON.stringify([gate.ent.heavy, gate.ent.tower, gate.ent.iglica_wejscie, gate.ent.iglica, gate.ent.dzwig, gate.ent.serwer]), JSON.stringify([L(76, 24, 120, 5), L(100, 40, 200, 6), L(78, 48, 240, 5), L(104, 64, 320, 6), L(78, 48, 240, 5), L(104, 64, 320, 6)])),
      eatGate: is(JSON.stringify([gate.t4Heavy, gate.t5Heavy, gate.t5Tower, gate.t6Tower]), JSON.stringify([false, true, false, true]))
    }, 'T4 cannot eat a bus; T5 eats heavy vehicles, not towers; T6 eats towers'));

    /* ---- O4-3: the looks ---- */
    const looks = await page.evaluate(({ T56, LANDMARKS }) => {
      const va = window.__m.__qaVaArt, art = window.__m.__qaObjectArt, big = window.__m.__qaVaBig;
      const res = (type, glyph, landmarkId) => CampaignEntity.prototype.artKind.call({ type, glyph, landmarkId });
      return {
        inKit: T56.filter(k => typeof va[k] === 'function' && art[k] === va[k] && big.has(k)),
        resolved: [res('heavy'), ...TIERS.heavy.subtypes.map(g => res('heavy', g)), res('tower'), ...TIERS.tower.subtypes.map(g => res('tower', g)), ...LANDMARKS.map(id => res('landmark', null, id))],
        arena: TIERS.heavy.subtypes.concat(TIERS.tower.subtypes)
      };
    }, { T56, LANDMARKS });
    results.push(expectAll('O4-3 the sixteen T5/T6 looks are the shared kit\'s art (2x sprites) for every Arena subtype, campaign entity and boss of those tiers', {
      inKit: is(looks.inKit.join(), T56.join()),
      resolvedToKit: is(looks.resolved.filter(k => !T56.includes(k) && k !== 'lm_kino' && k !== 'lm_fontanna').join(), ''),
      arenaSubtypes: is(looks.arena.filter(k => !T56.includes(k)).join(), '')
    }, looks.resolved.join(' ')));

    /* ---- O4-4 / O4-5 / O4-6 / O4-7: sprites, silhouettes, icons ---- */
    const art = await page.evaluate(async ({ LOOKS, colors, LANDMARKS }) => {
      const m = window.__m, g = window.game;
      window.__qaSeedRandom(99);
      const rngBefore = g.rng ? g.rng.seed : null, saveBefore = localStorage.getItem('vectorHoleSave_v1');
      const paint = (kind, col, r, t) => {
        const half = Math.ceil(r * 1.7 + 16), cv = document.createElement('canvas');
        cv.width = cv.height = half * 2;
        const c = cv.getContext('2d'); c.translate(half, half);
        m.__qaDrawObjectArt(c, kind, col, r, t, 0, { live: false });
        return cv;
      };
      const body = (cv) => {
        const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        const on = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 215) { on[y * w + x] = 1; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        const N = 48, mask = new Uint8Array(N * N);
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) mask[j * N + i] = on[Math.min(h - 1, Math.round(y0 + (j + 0.5) / N * (y1 - y0))) * w + Math.min(w - 1, Math.round(x0 + (i + 0.5) / N * (x1 - x0)))];
        return { mask, box: [x0 - w / 2, y0 - h / 2, x1 - w / 2, y1 - h / 2], aspect: (x1 - x0) / (y1 - y0) };
      };
      const iou = (p, q) => { let i = 0, u = 0; for (let k = 0; k < p.length; k++) { if (p[k] && q[k]) i++; if (p[k] || q[k]) u++; } return u ? i / u : 0; };
      const rasterIcon = async (markup) => {
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('icon does not parse as SVG')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="240" height="240">${markup}</svg>`); });
        const cv = document.createElement('canvas'); cv.width = cv.height = 240; cv.getContext('2d').drawImage(img, 0, 0); return cv;
      };
      const corners = (mask) => [[0, 0], [41, 0], [0, 41], [41, 41]].map(([cx, cy]) => { let n = 0; for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) n += mask[(cy + j) * 48 + cx + i]; return +(n / 49).toFixed(2); });
      const out = { looks: {}, icons: {}, edges: [] };
      for (const [kind, , , radius, tier, step] of LOOKS) {
        const id = kind + ':' + tier, col = colors[tier];
        const small = body(paint(kind, col, radius * 2, 0)), big = body(paint(kind, col, 150, 0));
        const idle = [0, 0.4, 0.9, 1.7].map(t => body(paint(kind, col, 60, t)));
        const r = radius * 2, bx = small.box;
        out.looks[id] = {
          scaleIoU: +iou(small.mask, big.mask).toFixed(3), aspect: [+small.aspect.toFixed(2), +big.aspect.toFixed(2)],
          idleIoU: +Math.min(...idle.map(q => iou(q.mask, idle[0].mask))).toFixed(3),
          halfW: +(Math.max(-bx[0], bx[2]) / r).toFixed(2), halfH: +(Math.max(-bx[1], bx[3]) / r).toFixed(2),
          center: [+((bx[0] + bx[2]) / 2 / r).toFixed(2), +((bx[1] + bx[3]) / 2 / r).toFixed(2)], corners: corners(big.mask)
        };
        const def = g.objectiveIconDef(step, null);
        let icon = null, iconErr = '';
        try { icon = body(await rasterIcon(def.icon)); } catch (e) { iconErr = String(e.message || e); }
        out.icons[id] = { iou: icon ? +iou(icon.mask, big.mask).toFixed(3) : 0, iconErr, aspect: icon ? +icon.aspect.toFixed(2) : 0, bigAspect: +big.aspect.toFixed(2),
          paths: (def.icon.match(/<path /g) || []).length, currentColor: /currentColor/.test(def.icon), color: def.color, tier, markup: def.icon };
      }
      out.unique = new Set(Object.values(out.icons).map(i => i.markup)).size;
      out.bosses = LANDMARKS.map(id => g.objectiveIconDef({ landmark: id }, null).icon);
      out.monument = m.__qaGoalIcons.landmark;
      out.classes = ['heavy', 'tower'].map(k => { const d = g.objectiveIconDef({ eat: k, n: 1 }, null); return { k, paths: (d.icon.match(/<path /g) || []).length, color: d.color, own: Object.values(out.icons).every(i => i.markup !== d.icon) }; });
      for (const k of Object.keys(out.icons)) delete out.icons[k].markup;
      m.__qaSpriteCache.clear();
      const c0 = document.createElement('canvas').getContext('2d');
      for (const [kind, , , radius, tier] of LOOKS) m.__qaDrawObjectArt(c0, kind, colors[tier], radius, 0, 0, { live: false });
      for (const [key, s] of m.__qaSpriteCache) {
        const cv = s.canvas, w = cv.width, d = cv.getContext('2d').getImageData(0, 0, w, w).data;
        let edge = 0;
        for (let i = 0; i < w; i++) edge = Math.max(edge, d[i * 4 + 3], d[((w - 1) * w + i) * 4 + 3], d[(i * w) * 4 + 3], d[(i * w + w - 1) * 4 + 3]);
        out.edges.push([key, w, edge]);
      }
      out.randomCalls = window.__qaRandomCalls;
      out.rngSame = (g.rng ? g.rng.seed : null) === rngBefore;
      out.saveSame = localStorage.getItem('vectorHoleSave_v1') === saveBefore;
      window.__qaRestoreRandom();
      return out;
    }, { LOOKS: LOOKS4, colors: TIER_COLOR, LANDMARKS });
    const Lk = art.looks, kinds = Object.keys(Lk), I = art.icons, ik = Object.keys(I);
    const worst = (o, f) => Object.keys(o).map(k => [k, f(o[k])]).sort((a, b) => a[1] - b[1])[0];
    results.push(expectAll('O4-4 every sprite is whole (nothing on the canvas edge), its body sits on the hitbox and fills it without outgrowing it', {
      sprites: is(art.edges.length, LOOKS4.length),
      cut: is(art.edges.filter(e => e[2] > 2).map(e => e[0]).join(), ''),
      tooWide: is(kinds.filter(k => Lk[k].halfW > 1.12).join(), ''),
      tooTall: is(kinds.filter(k => Lk[k].halfH > 1.16).join(), ''),
      tooSmall: is(kinds.filter(k => Math.max(Lk[k].halfW, Lk[k].halfH) < 0.8).join(), ''),
      offCenter: is(kinds.filter(k => Math.abs(Lk[k].center[0]) > 0.16 || Math.abs(Lk[k].center[1]) > 0.22).join(), '')
    }, kinds.map(k => `${k} ${Lk[k].halfW}x${Lk[k].halfH}@${Lk[k].center.join(',')}`).join(' ')));
    const ws = worst(Lk, v => v.scaleIoU), wi = worst(I, v => v.iou);
    results.push(expectAll('O4-5 one geometry at every scale: the board sprite and the big preview are the same silhouette', {
      worstOverlap: holds(ws[1] >= 0.9, ws[1], '>= 0.9'), aspect: is(kinds.filter(k => Math.abs(Lk[k].aspect[0] - Lk[k].aspect[1]) > 0.06).join(), '')
    }, `worst ${ws[0]} ${ws[1]}`));
    results.push(expectAll('O4-5 the goal icon is the board art replayed as SVG: same silhouette, one per look and per named boss, in the tier color; class icons of their own', {
      parse: is(ik.filter(k => I[k].iconErr).join(), ''),
      worstOverlap: holds(wi[1] >= 0.86, wi[1], '>= 0.86 overlap with the big preview'),
      aspect: is(ik.filter(k => Math.abs(I[k].aspect - I[k].bigAspect) > 0.08).join(), ''),
      vector: is(ik.filter(k => I[k].paths < 6 || I[k].currentColor).join(), ''),
      unique: is(art.unique, ik.length),
      tierColor: is(ik.filter(k => I[k].color !== TIER_COLOR[I[k].tier]).join(), ''),
      bossesOwn: is(new Set(art.bosses).size === LANDMARKS.length && !art.bosses.includes(art.monument), true),
      classIcons: is(art.classes.filter(c => !c.own || c.paths < 12).map(c => c.k).join(), '')
    }, `worst ${wi[0]} ${wi[1]}`));
    const solids = ['ciezarowka:5', 'lm_serwer:6', 'lm_stacja:5'];
    results.push(expectAll('O4-6 one camera: a solid shows its top, front and RIGHT side (depth recedes up and to the right); nothing reshapes while idle', {
      ...Object.fromEntries(solids.map(k => { const [tl, tr, bl, br] = Lk[k].corners; return [k, holds(tl < 0.3 && tr + bl > tl + br + 0.5, Lk[k].corners.join('/'), 'TL empty, TR and BL fuller than TL and BR')]; })),
      reshaped: is(kinds.filter(k => Lk[k].idleIoU < 0.94).join(), '')
    }, solids.map(k => `${k} ${Lk[k].corners.join('/')}`).join(' ')));
    results.push(expectAll('O4-7 painting every sprite and icon draws no Math.random and leaves the round\'s RNG and the save alone', {
      randomCalls: is(art.randomCalls, 0), rng: is(art.rngSame, true), save: is(art.saveSame, true)
    }));

    /* ---- O4-7 / O4-8 / O4-9: in the round ---- */
    const round = await page.evaluate(async ({ T56, LOOKS }) => {
      const m = window.__m, g = window.game, cache = m.__qaSpriteCache;
      const real = performance.now.bind(performance);
      const keysOf = () => [...cache.keys()].filter(k => T56.includes(k.split('|')[0]));
      const layout = (list) => { let h = 0x811c9dc5; for (const o of list) for (const v of [Math.round(o.x * 100), Math.round(o.y * 100), Math.round(o.radius * 100)]) { h ^= v; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
      const frame = (t) => (g.mode === 'campaign' ? g.renderCampaign(t) : g.render(t));
      const still = (n) => { for (let k = 0; k < n; k++) frame(1000); };
      const start = (fn) => { fn(); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; };
      const byBoss = (id) => (CAMPAIGN_MISSIONS.find(d => d.goal.steps.some(st => st.landmark === id)) || {}).id;
      const mission = (id) => () => { g.missionBoosters = []; g.startCampaignMission(id); if (g.introPending) g.beginMissionPlay(); };
      const out = { modes: {} };
      start(() => g.startRound({ seed: 4242 })); const h1 = layout(g.objects), s1 = g.rng.seed;
      cache.clear(); g.zoom = 0.3; still(20);
      const afterFirst = cache.size, seedAfterPaint = g.rng.seed;
      still(40); out.stillAdds = cache.size - afterFirst;
      start(() => g.startRound({ seed: 4242 })); out.layoutSame = layout(g.objects) === h1 && g.rng.seed === s1;
      out.paintKeepsRng = seedAfterPaint === s1;
      const missions = ['M12', 'M16', 'M19', 'M20', 'M24', 'M54', 'M56', ...['stacja', 'bazar_brama', 'fabryka', 'latarnia', 'drzewo', 'serwer'].map(byBoss)];
      for (const [name, fn] of [['arena', () => g.startRound({ seed: 11 })], ['daily', () => g.startDailyChallenge()], ['challenge', () => g.startRound({ seed: 12, challenge: { score: 100, from: 'QA' } })], ...missions.map(id => [id, mission(id)])]) {
        cache.clear(); start(fn);
        if (g.mode !== 'campaign') g.zoom = 0.3;
        for (const t of [1000, 1000.37, 1001.9]) frame(t);
        const list = g.mode === 'campaign' ? g.campaignEntities : g.objects;
        const want = new Set(list.map(o => o.subtype || (o.artKind ? o.artKind() : null)).filter(k => T56.includes(k)));
        const c = g.ctx; c.save(); for (const o of list) { if (o.draw) o.draw(c, 0); } c.restore();
        out.modes[name] = { want: [...want].sort().join(), drawn: [...new Set(keysOf().map(k => k.split('|')[0]))].sort().join() };
      }
      g.applyGfx(0); cache.clear(); start(() => g.startRound({ seed: 11 })); g.zoom = 0.3; still(10);
      out.gfx0 = keysOf().length;
      g.applyGfx(2);
      const c = g.ctx;
      const set = () => { c.save(); for (const [k, , , r, tier] of LOOKS) m.__qaDrawObjectArt(c, k, { 5: '#CBD5E1', 6: '#46D99A' }[tier], r, 0, 0, { live: false }); c.restore(); };
      cache.clear(); set();
      let px = 0; for (const [, s] of cache) px += s.canvas.width * s.canvas.height;
      out.sprites = cache.size; out.pixels = px; out.keyParts = [...new Set([...cache.keys()].map(k => k.split('|').length))].join();
      out.sizes = [...cache].every(([k, s]) => s.canvas.width === Math.ceil(+k.split('|')[2] * 1.5 + 6) * 2 * 2);
      const t = [];
      for (let rep = 0; rep < 5; rep++) { cache.clear(); const t0 = real(); set(); t.push(real() - t0); }
      t.sort((a, b) => a - b); out.buildMs = +t[2].toFixed(1);
      return out;
    }, { T56, LOOKS: LOOKS4 });
    results.push(expectAll('O4-7 the same seed lays the same round whatever was painted in between; painting leaves game.rng alone', { layout: is(round.layoutSame, true), rng: is(round.paintKeepsRng, true) }));
    results.push(expectAll('O4-8 the cache: one 2x sprite per look and tier on a 2x phone, none added on a still frame, fewer pixels than the base revision\'s sprites, a quick build', {
      stillAdds: is(round.stillAdds, 0), sprites: is(round.sprites, LOOKS4.length),
      supersample: is(`${round.keyParts}:${round.sizes}`, '4:true'),
      pixels: holds(round.pixels < baseFacts.t56Pixels, `${round.pixels} vs ${baseFacts.t56Pixels}`, 'fewer sprite pixels than the base revision'),
      buildMs: holds(round.buildMs < 400, round.buildMs, '< 400 ms for all 17 big sprites')
    }, `${round.sprites} sprites, ${(round.pixels / 1e6).toFixed(2)} MP (base ${(baseFacts.t56Pixels / 1e6).toFixed(2)} MP), built in ${round.buildMs} ms`));
    results.push(expectAll('O4-9 Arena, Daily, a friend\'s challenge and the T5/T6 missions of both chapters draw their T5/T6 objects from the shared sprites', Object.fromEntries(
      Object.entries(round.modes).map(([k, v]) => [k, holds(v.want.length > 0 && v.drawn === v.want, v.drawn, v.want)])), Object.entries(round.modes).map(([k, v]) => `${k}: ${v.want}`).join(' · ')));
    results.push(expectAll('O4-9 quality 0 draws the same sprites', { sprites: holds(round.gfx0 >= 3, round.gfx0, '>= 3 T5/T6 sprites on the whole board') }));
    results.push(report('O4-9 no page or console errors (base page and candidate page)', g.errors.length === 0 && baseErrors === 0, g.errors.join(' | ').slice(0, 300)));
    await g.browser.close();
  } finally { server.close(); baseSrv.server.close(); }
  return results;
}

if (isMain(import.meta.url)) {
  const r = await runObjects4Checks();
  const bad = r.filter(x => !x.ok);
  console.log(`\n${r.length - bad.length}/${r.length} GG-OBJECTS-04 checks passed`);
  process.exit(bad.length ? 1 : 0);
}
