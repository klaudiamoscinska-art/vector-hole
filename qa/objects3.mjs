// GG-OBJECTS-03 -- "Premium Vector Objects", the T3/T4 looks. What this suite proves:
//  - O3-1 nothing else changed: the fifteen T1/T2 looks, the palette and the
//    camera constants are the base revision's source, character for
//    character, and so are T5/T6, their landmarks and the byte; their sprites
//    (board size, big, the golden core) and their goal icons are the base
//    revision's pixels and markup;
//  - O3-2 only the picture changed: every class keeps its tier, radius,
//    value, growth, count and looks (Arena TIERS, campaign stats, landmark
//    tiers) and the eat gate still opens at T3 / T4;
//  - O3-3 the thirteen T3/T4 looks are painted by the shared kit (VA_ART) and
//    every campaign entity / Arena subtype of those classes resolves to one;
//  - O3-4 a sprite is whole and sits on its hitbox without outgrowing it;
//  - O3-5 one geometry at every scale: board sprite = big preview = goal icon
//    (the icon is the art replayed as SVG, one per look, in the tier color);
//  - O3-6 one camera and one orientation: a solid shows its top, front and
//    right side, nothing turns while idle; the convoy car is the same car;
//  - O3-7 the special states keep their logic (a used node, an unpowered
//    Mostek, a locked landmark, the convoy variant);
//  - O3-8 the art is outside the round: no Math.random, game.rng, layout or
//    save touched;
//  - O3-9 the cache: T3/T4 sprites stay 2x at every pixel ratio, none added
//    on a still frame, fewer pixels than the base's sprites, a quick build;
//  - O3-10 Arena (with the Overdrive portals), Daily, a friend's challenge and
//    campaign missions draw them, with their live overlays and at quality 0,
//    with no page or console error; the cinema's sign follows the language.
// The pages run served copies of game.js (this checkout's and the base
// revision's) with one added export line -- the renderer is not part of the
// QA bridge.
// Usage: node qa/objects3.mjs
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, allDistrictsSave, report, expectAll, is, holds, revisionFile, QA_RANDOM, ROOT, isMain } from './lib.mjs';
import { LOOKS as LOOKS12 } from './objects2-shots.mjs';
import { LOOKS3, FROZEN_SPRITES, TIER_COLOR, sheetRoot, spriteHashes } from './objects3-shots.mjs';

/** The production main this stage was cut from (PR #95, the T1/T2 looks). */
export const OBJECTS3_BASE_REV = 'b049d28a1a5d72297331440d839d28d9b412b2db';
const T12 = LOOKS12.map(l => l[0]);
const T34 = [...new Set(LOOKS3.map(l => l[0]))];
// GG-OBJECTS-04 redrew T5/T6 and their landmarks with the same kit (qa/objects4.mjs):
// only the byte is still the base revision's look outside T1-T4.
const T56 = ['autobus', 'tramwaj', 'ciezarowka', 'wiezowiec', 'maszt', 'kopula', 'lm_dzwig', 'lm_galeria', 'lm_iglica', 'lm_rdzen', 'lm_stacja', 'lm_bazar', 'lm_fabryka', 'lm_latarnia', 'lm_drzewo', 'lm_serwer'];
const OTHER = ['bajt'];
const FROZEN3 = FROZEN_SPRITES.filter(([k]) => !T56.includes(k));

/** The numbers of the T3/T4 classes (Arena TIERS) at the base revision. */
const FROZEN_TIERS = {
  vehicle: { color: '#EFCB63', minR: 34, maxR: 34, value: 30, growth: 6, subtypes: ['samochod'], count: 10, minSizeTier: 2 },
  node: { color: '#EFCB63', minR: 32, maxR: 32, value: 50, growth: 10, subtypes: ['wezel'], count: 4, minSizeTier: 2 },
  pylon: { color: '#EFCB63', minR: 32, maxR: 32, value: 50, growth: 10, subtypes: ['pylon'], count: 4, minSizeTier: 2 },
  landmark: { color: '#9875FF', minR: 52, maxR: 52, value: 160, growth: 32, subtypes: ['landmark'], count: 2, minSizeTier: 3 },
  structure: { color: '#9875FF', minR: 54, maxR: 54, value: 80, growth: 16, subtypes: ['pawilon', 'billboard', 'magazyn'], count: 9, minSizeTier: 3 },
  portal: { color: '#9875FF', minR: 14, maxR: 20, value: 15, growth: 6, subtypes: ['portal'], count: 0, minSizeTier: 3 }
};
const FROZEN_STATS = { vehicle: [6, 30, 3], node: [10, 50, 3], pylon: [10, 50, 3], landmark: [32, 160, 4], structure: [16, 80, 4] }; // growth, score, minTier
const FROZEN_LANDMARK_TIERS = { kino: 4, fontanna: 4, dzwig: 5, galeria_glowna: 5, iglica_wejscie: 5, iglica: 6, rdzen_miasta_glowny: 6, stacja: 5, bazar_brama: 5, fabryka: 6, latarnia: 6, drzewo: 6, serwer: 6 };

/** Goal steps whose icons this stage must not change (T1/T2, T5/T6, landmarks, twists). */
const FROZEN_ICON_STEPS = [
  { eat: 'fragment', n: 1 }, { eat: 'capsule', n: 1 }, { eat: 'prop', n: 1 }, { eat: 'marker', n: 1 },
  ...LOOKS12.filter(l => l[2] === 'prop' || l[2] === 'marker').map(l => ({ eat: l[2], glyph: l[0], n: 1 })),
  { eat: 'runner', n: 1 }, { tier: 4 }, { combo: 8 }, { score: 100 }
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
/** The live overlay's cases, keyed by their first label. */
function liveCases(src) {
  const body = between(src, '\nfunction drawObjectLive(', '\n}\n') || '';
  const out = {};
  body.split(/\n {4}(?=case ')/).slice(1).forEach((blk) => { out[blk.match(/^case '([a-z_]+)'/)[1]] = blk.trim(); });
  return out;
}

async function open(url, dsf, locale = 'pl-PL') {
  const g = await openGame(url, { viewport: { width: 420, height: 800 }, mobile: dsf > 1, deviceScaleFactor: dsf, initScript: QA_RANDOM, locale });
  const save = await allDistrictsSave(g.page);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  await g.page.evaluate(async () => { window.__m = await import(document.querySelector('script[type="module"][src]').src); });
  return g;
}
const EXPORTS = '\nexport { OBJECT_ART as __qaObjectArt, VA_ART as __qaVaArt, GOAL_ART_ICONS as __qaGoalArtIcons, GOAL_ICONS as __qaGoalIcons, CAMPAIGN_ENTITY_STATS as __qaEntityStats, LANDMARK_TIERS as __qaLandmarkTiers };\n';
/** The class numbers and the frozen icons of a page (the same code runs on the base and on the candidate). */
const inventory = (page, steps) => page.evaluate((steps) => ({
  tiers: JSON.stringify(TIERS), stats: JSON.stringify(window.__m.__qaEntityStats), landmarkTiers: JSON.stringify(window.__m.__qaLandmarkTiers),
  radius: JSON.stringify(CONFIG.campaign.entityRadius), byTier: JSON.stringify(CONFIG.campaign.landmarkByTier), sizeTiers: JSON.stringify(CONFIG.sizeTiers),
  icons: steps.map(st => { const d = window.game.objectiveIconDef(st, null); return d.color + d.icon; }),
  twists: ['gate', 'portal', 'impulse', 'rival', 'landmark', 'tier', 'runner', 'hunters', 'racer', 'dark', 'glitch', 'fragile'].map(k => window.__m.__qaGoalIcons[k])
}), steps);

export async function runObjects3Checks() {
  const results = [];
  const nowSrc = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
  let baseSrc = null, why = '';
  try { baseSrc = String(revisionFile(OBJECTS3_BASE_REV, 'game.js')); } catch (e) { why = String(e.message || e).slice(0, 160); }
  if (!baseSrc) {
    results.push(report('O3-1 the base revision is readable (the T1/T2 and T5/T6 comparison needs it)', false, why));
    return results;
  }

  /* ---- O3-1 (static): the source outside T3/T4 is the base revision's ---- */
  {
    const vaNow = entries(nowSrc, 'const VA_ART = {'), vaBase = entries(baseSrc, 'const VA_ART = {');
    const oaNow = entries(nowSrc, 'const OBJECT_ART = {'), oaBase = entries(baseSrc, 'const OBJECT_ART = {');
    const liveNow = liveCases(nowSrc), liveBase = liveCases(baseSrc);
    const fn = (name) => [between(baseSrc, `\nfunction ${name}(`, '\n}\n'), between(nowSrc, `\nfunction ${name}(`, '\n}\n')];
    const line = (re) => [(baseSrc.match(re) || [''])[0], (nowSrc.match(re) || ['-'])[0]];
    const same = ([a, b]) => !!a && a === b;
    results.push(expectAll('O3-1 the fifteen T1/T2 looks, the palette and the camera are the base revision\'s source; the byte too', {
      t12Compared: is(T12.filter(k => vaBase[k]).length, 15),
      t12Changed: is(T12.filter(k => vaBase[k] !== vaNow[k]).join(), ''),
      otherCompared: is(OTHER.filter(k => oaBase[k]).length, OTHER.length),
      otherChanged: is(OTHER.filter(k => oaBase[k] !== oaNow[k]).join(), ''),
      palette: is(same(fn('vaPalette')), true),
      camera: is(same(line(/const VA_DX = [^\n]+/)), true),
      materials: is(same(line(/const VA_INK = [\s\S]*?const VA_NIGHT = [^\n]+/)), true),
      iconReplay: is(same(fn('vaIconSvg')), true),
      liveKept: is(['fragment', 'landmark', 'maszt', 'lm_kino'].filter(k => !liveBase[k] || liveBase[k] !== liveNow[k]).join(), ''),
      oldT3T4Removed: is(T34.filter(k => oaNow[k]).join(), '')
    }, `${T12.length} + ${OTHER.length} looks compared with ${OBJECTS3_BASE_REV.slice(0, 7)}`));
  }

  const baseSrv = await serve({ root: sheetRoot(ROOT, 'suite-base', baseSrc + EXPORTS) });
  const { server, url } = await serve({ root: sheetRoot(ROOT, 'suite', nowSrc + EXPORTS) });
  try {
    /* ---- O3-1 / O3-2 (pixels and numbers): base page vs candidate page ---- */
    const b = await open(baseSrv.url, 2);
    const baseFacts = { sprites: await spriteHashes(b.page, FROZEN3), inv: await inventory(b.page, FROZEN_ICON_STEPS) };
    baseFacts.t34Pixels = await b.page.evaluate(async (looks) => {
      const c = document.createElement('canvas').getContext('2d'); window.__m.__qaSpriteCache.clear();
      for (const [k, , , r, tier, , variant] of looks) window.__m.__qaDrawObjectArt(c, k, { 3: '#EFCB63', 4: '#9875FF' }[tier], r, 0, 0, { live: false, variant });
      let px = 0; for (const [, s] of window.__m.__qaSpriteCache) px += s.canvas.width * s.canvas.height;
      return px;
    }, LOOKS3);
    const baseErrors = b.errors.length;
    await b.browser.close();

    const g = await open(url, 2);
    const page = g.page;
    const nowSprites = await spriteHashes(page, FROZEN3), inv = await inventory(page, FROZEN_ICON_STEPS);
    const keys = Object.keys(baseFacts.sprites);
    results.push(expectAll('O3-1 the T1/T2 sprites (board size, big, the golden core) and the byte are the base revision\'s pixels', {
      compared: holds(keys.length >= 32, keys.length, '>= 32 sprites'),
      sameKeys: is(Object.keys(nowSprites).join(), keys.join()),
      different: is(keys.filter(k => baseFacts.sprites[k] !== nowSprites[k]).join(), '')
    }, `${keys.length} sprites, 3x on this 2x page`));
    results.push(expectAll('O3-1 the goal icons of T1/T2 looks and classes and the twists are the base revision\'s markup', {
      icons: is(FROZEN_ICON_STEPS.filter((st, i) => baseFacts.inv.icons[i] !== inv.icons[i]).map(st => JSON.stringify(st)).join(), ''),
      twists: is(JSON.stringify(inv.twists), JSON.stringify(baseFacts.inv.twists))
    }, `${FROZEN_ICON_STEPS.length} goal rows + ${inv.twists.length} class / twist icons`));

    const gate = await page.evaluate(() => {
      const tierOf = (r) => getSizeTierIndex(r);
      const at = (t) => { let r = 18; while (tierOf(r) < t && r < 600) r += 0.5; return r; };
      const eats = (t, tier) => canEatWorldObjectTier(at(t), { tier });
      const ent = {};
      for (const [k, opts] of [['vehicle', {}], ['node', {}], ['pylon', {}], ['structure', {}], ['landmark', {}], ['landmark:kino', { landmarkId: 'kino' }], ['landmark:fontanna', { landmarkId: 'fontanna' }]]) {
        const e = new CampaignEntity(k.split(':')[0], 0, 0, opts); ent[k] = [e.radius, e.stats.growth, e.stats.score, e.stats.minTier];
      }
      return { ent, t2Vehicle: eats(1, 'vehicle'), t3Vehicle: eats(2, 'vehicle'), t3Node: eats(2, 'node'), t3Pylon: eats(2, 'pylon'), t3Structure: eats(2, 'structure'), t3Landmark: eats(2, 'landmark'), t3Portal: eats(2, 'portal'),
        t4Structure: eats(3, 'structure'), t4Landmark: eats(3, 'landmark'), t4Portal: eats(3, 'portal'), t4Heavy: eats(3, 'heavy') };
    });
    const tiersNow = JSON.parse(inv.tiers), statsNow = JSON.parse(inv.stats);
    results.push(expectAll('O3-2 every class keeps tier, radius, value, growth, count and looks (Arena), growth / score / tier (Campaign) and the landmark tiers; the eat gate opens at T3 / T4', {
      tiersAsBase: is(inv.tiers, baseFacts.inv.tiers),
      statsAsBase: is(inv.stats, baseFacts.inv.stats),
      landmarkTiersAsBase: is(inv.landmarkTiers, baseFacts.inv.landmarkTiers),
      radiiAsBase: is(inv.radius + inv.byTier + inv.sizeTiers, baseFacts.inv.radius + baseFacts.inv.byTier + baseFacts.inv.sizeTiers),
      t3t4Tiers: is(JSON.stringify(Object.fromEntries(Object.keys(FROZEN_TIERS).map(k => [k, tiersNow[k]]))), JSON.stringify(FROZEN_TIERS)),
      t3t4Stats: is(JSON.stringify(Object.fromEntries(Object.keys(FROZEN_STATS).map(k => [k, [statsNow[k].growth, statsNow[k].score, statsNow[k].minTier]]))), JSON.stringify(FROZEN_STATS)),
      landmarkTiers: is(inv.landmarkTiers, JSON.stringify(FROZEN_LANDMARK_TIERS)),
      entities: is(JSON.stringify(gate.ent), JSON.stringify({ vehicle: [34, 6, 30, 3], node: [32, 10, 50, 3], pylon: [32, 10, 50, 3], structure: [54, 16, 80, 4], landmark: [52, 32, 160, 4], 'landmark:kino': [52, 32, 160, 4], 'landmark:fontanna': [52, 32, 160, 4] })),
      eatGate: is(JSON.stringify([gate.t2Vehicle, gate.t3Vehicle, gate.t3Node, gate.t3Pylon, gate.t3Structure, gate.t3Landmark, gate.t3Portal, gate.t4Structure, gate.t4Landmark, gate.t4Portal, gate.t4Heavy]),
        JSON.stringify([false, true, true, true, false, false, false, true, true, true, false]))
    }, 'T2 cannot eat a car; T3 eats cars, nodes, pylons, not T4; T4 eats structures, landmarks, portals, not T5'));

    /* ---- O3-3: the thirteen looks ---- */
    const looks = await page.evaluate((T34) => {
      const va = window.__m.__qaVaArt, art = window.__m.__qaObjectArt;
      const res = (type, glyph, landmarkId) => CampaignEntity.prototype.artKind.call({ type, glyph, landmarkId });
      return {
        inKit: T34.filter(k => typeof va[k] === 'function' && art[k] === va[k]),
        resolved: [res('vehicle'), res('vehicle', 'konwoj'), res('node'), res('node', 'wezel'), res('node', 'zasilacz'), res('node', 'mostek'), res('pylon'), res('pylon', 'lustro'),
          res('structure'), res('structure', 'pawilon'), res('structure', 'billboard'), res('structure', 'magazyn'), res('landmark'), res('landmark', null, 'kino'), res('landmark', null, 'fontanna'), res('landmark', null, 'dzwig')],
        arena: [].concat(TIERS.vehicle.subtypes, TIERS.node.subtypes, TIERS.pylon.subtypes, TIERS.landmark.subtypes, TIERS.structure.subtypes, TIERS.portal.subtypes),
        vaCount: Object.keys(va).length
      };
    }, T34);
    results.push(expectAll('O3-3 the thirteen T3/T4 looks are the shared kit\'s art, for every Arena subtype and campaign entity of those classes', {
      inKit: is(looks.inKit.join(), T34.join()),
      kit: is(looks.vaCount, T12.length + T34.length + T56.length),
      campaignResolves: is(looks.resolved.join(), 'samochod,samochod,wezel,wezel,zasilacz,mostek,pylon,lustro,pawilon,pawilon,billboard,magazyn,landmark,lm_kino,lm_fontanna,lm_dzwig'),
      arenaSubtypes: is(looks.arena.filter(k => !T34.includes(k)).join(), '')
    }, `${looks.vaCount} looks in the kit`));

    /* ---- O3-4 / O3-5 / O3-6 / O3-8: sprites, silhouettes, icons ---- */
    const art = await page.evaluate(async ({ LOOKS, colors }) => {
      const m = window.__m, g = window.game;
      window.__qaSeedRandom(99);
      const rngBefore = g.rng ? g.rng.seed : null;
      const saveBefore = localStorage.getItem('vectorHoleSave_v1');
      const paint = (kind, col, r, t, variant) => {
        const half = Math.ceil(r * 1.7 + 16), cv = document.createElement('canvas');
        cv.width = cv.height = half * 2;
        const c = cv.getContext('2d');
        c.translate(half, half);
        m.__qaDrawObjectArt(c, kind, col, r, t, 0, { live: false, variant });
        return cv;
      };
      /** The solid silhouette of a picture (no ground shadow, pad or glow:
       *  they stay under ~0.75 alpha) as a 48 x 48 mask of its bounding box. */
      const body = (cv) => {
        const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
        let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0;
        const on = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (d[(y * w + x) * 4 + 3] > 215) { on[y * w + x] = 1; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        const N = 48, mask = new Uint8Array(N * N);
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) mask[j * N + i] = on[Math.min(h - 1, Math.round(y0 + (j + 0.5) / N * (y1 - y0))) * w + Math.min(w - 1, Math.round(x0 + (i + 0.5) / N * (x1 - x0)))];
        return { mask, n, box: [x0 - w / 2, y0 - h / 2, x1 - w / 2, y1 - h / 2], aspect: (x1 - x0) / (y1 - y0) };
      };
      const iou = (p, q) => { let i = 0, u = 0; for (let k = 0; k < p.length; k++) { if (p[k] && q[k]) i++; if (p[k] || q[k]) u++; } return u ? i / u : 0; };
      const rasterIcon = async (markup) => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="240" height="240">${markup}</svg>`;
        const img = new Image();
        await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('icon does not parse as SVG')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
        const cv = document.createElement('canvas'); cv.width = cv.height = 240;
        cv.getContext('2d').drawImage(img, 0, 0);
        return cv;
      };
      const corners = (mask) => [[0, 0], [41, 0], [0, 41], [41, 41]].map(([cx, cy]) => { let n = 0; for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) n += mask[(cy + j) * 48 + cx + i]; return +(n / 49).toFixed(2); });
      const out = { looks: {}, icons: {}, edges: [] };
      for (const [kind, , , radius, tier, step, variant] of LOOKS) {
        const id = kind + (variant ? ':' + variant : ''), col = colors[tier];
        const small = body(paint(kind, col, radius * 2, 0, variant));   // the board sprite on a 2x phone
        const big = body(paint(kind, col, 150, 0, variant));
        const idle = [0, 0.4, 0.9, 1.7].map(t => body(paint(kind, col, 60, t, variant)));
        const r = radius * 2, bx = small.box;
        out.looks[id] = {
          scaleIoU: +iou(small.mask, big.mask).toFixed(3), aspect: [+small.aspect.toFixed(2), +big.aspect.toFixed(2)],
          idleIoU: +Math.min(...idle.map(b => iou(b.mask, idle[0].mask))).toFixed(3),
          halfW: +(Math.max(-bx[0], bx[2]) / r).toFixed(2), halfH: +(Math.max(-bx[1], bx[3]) / r).toFixed(2),
          center: [+((bx[0] + bx[2]) / 2 / r).toFixed(2), +((bx[1] + bx[3]) / 2 / r).toFixed(2)], corners: corners(big.mask), mask: Array.from(big.mask).join('')
        };
        if (step) {
          const def = g.objectiveIconDef(step, null);
          let icon = null, iconErr = '';
          try { icon = body(await rasterIcon(def.icon)); } catch (e) { iconErr = String(e.message || e); }
          out.icons[id] = { iou: icon ? +iou(icon.mask, big.mask).toFixed(3) : 0, iconErr, aspect: icon ? +icon.aspect.toFixed(2) : 0, bigAspect: +big.aspect.toFixed(2), len: def.icon.length, paths: (def.icon.match(/<path /g) || []).length,
            currentColor: /currentColor/.test(def.icon), color: def.color, tier, fromArt: def.icon === m.__qaGoalArtIcons[kind], markup: def.icon };
        }
      }
      const cls = g.objectiveIconDef({ eat: 'structure', n: 1 }, null);
      out.classIcon = { own: Object.values(out.icons).every(i => i.markup !== cls.icon), paths: (cls.icon.match(/<path /g) || []).length, color: cls.color, isGetter: cls.icon === m.__qaGoalIcons.structure };
      out.typeIcons = { vehicle: m.__qaGoalIcons.vehicle === out.icons.samochod.markup, node: m.__qaGoalIcons.node === out.icons.wezel.markup, pylon: m.__qaGoalIcons.pylon === out.icons.pylon.markup };
      out.unique = new Set(Object.values(out.icons).map(i => i.markup)).size;
      for (const k of Object.keys(out.icons)) delete out.icons[k].markup;
      const mk = (id) => out.looks[id].mask;
      {
        // the convoy car: the same silhouette, other pixels (its beacon and bull bar lie inside the car's outline)
        const a = mk('samochod'), b = mk('samochod:konwoj'); let i = 0, u = 0;
        for (let k = 0; k < a.length; k++) { const p = a[k] === '1', q = b[k] === '1'; if (p && q) i++; if (p || q) u++; }
        const pa = paint('samochod', colors[3], 150, 0), pb = paint('samochod', colors[3], 150, 0, 'konwoj');
        const da = pa.getContext('2d').getImageData(0, 0, pa.width, pa.height).data, db = pb.getContext('2d').getImageData(0, 0, pb.width, pb.height).data;
        let diff = 0, solid = 0;
        for (let k = 0; k < da.length; k += 4) { if (da[k + 3] > 215) solid++; if (Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2]) > 90) diff++; }
        out.konwoj = { iou: +(i / u).toFixed(3), diff: +(diff / solid).toFixed(3) };
      }
      for (const k of Object.keys(out.looks)) delete out.looks[k].mask;
      // the cached board sprites themselves: nothing painted on the canvas edge
      m.__qaSpriteCache.clear();
      const c0 = document.createElement('canvas').getContext('2d');
      for (const [kind, , , radius, tier, , variant] of LOOKS) m.__qaDrawObjectArt(c0, kind, colors[tier], radius, 0, 0, { live: false, variant });
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
    }, { LOOKS: LOOKS3, colors: TIER_COLOR });
    const L = art.looks, kinds = Object.keys(L), I = art.icons, ik = Object.keys(I);
    const worst = (o, f) => Object.keys(o).map(k => [k, f(o[k])]).sort((a, b) => a[1] - b[1])[0];
    results.push(expectAll('O3-4 every sprite is whole (nothing painted on the canvas edge), its body sits on the hitbox and fills it without outgrowing it', {
      sprites: is(art.edges.length, LOOKS3.length),
      cut: is(art.edges.filter(e => e[2] > 2).map(e => e[0]).join(), ''),
      tooWide: is(kinds.filter(k => L[k].halfW > 1.12).join(), ''),
      tooTall: is(kinds.filter(k => L[k].halfH > 1.16).join(), ''),
      tooSmall: is(kinds.filter(k => Math.max(L[k].halfW, L[k].halfH) < 0.8).join(), ''),
      offCenter: is(kinds.filter(k => Math.abs(L[k].center[0]) > 0.16 || Math.abs(L[k].center[1]) > 0.22).join(), '')
    }, kinds.map(k => `${k} ${L[k].halfW}x${L[k].halfH}`).join(' ')));
    const ws = worst(L, v => v.scaleIoU), wi = worst(I, v => v.iou);
    results.push(expectAll('O3-5 one geometry at every scale: the board sprite and the big preview are the same silhouette', {
      worstOverlap: holds(ws[1] >= 0.9, ws[1], '>= 0.9 overlap of the normalized silhouettes'),
      aspect: is(kinds.filter(k => Math.abs(L[k].aspect[0] - L[k].aspect[1]) > 0.06).join(), '')
    }, `worst ${ws[0]} ${ws[1]}`));
    results.push(expectAll('O3-5 the goal icon is the board art replayed as SVG: same silhouette, one icon per look, in the tier color, no line-icon leftovers', {
      looksWithIcon: is(ik.length, LOOKS3.filter(l => l[5]).length),
      parse: is(ik.filter(k => I[k].iconErr).join(), ''),
      worstOverlap: holds(wi[1] >= 0.86, wi[1], '>= 0.86 overlap with the big preview'),
      aspect: is(ik.filter(k => Math.abs(I[k].aspect - I[k].bigAspect) > 0.08).join(), ''),
      fromArt: is(ik.filter(k => !I[k].fromArt).join(), ''),
      vector: is(ik.filter(k => I[k].paths < 6 || I[k].currentColor).join(), ''),
      unique: is(art.unique, ik.length - 1), // the convoy car shows the car's icon
      tierColor: is(ik.filter(k => I[k].color !== TIER_COLOR[I[k].tier]).join(), ''),
      typeIcons: is(JSON.stringify(art.typeIcons), JSON.stringify({ vehicle: true, node: true, pylon: true })),
      structureClassIcon: is(art.classIcon.own && art.classIcon.isGetter && art.classIcon.paths > 12 && art.classIcon.color === TIER_COLOR[4], true)
    }, `worst ${wi[0]} ${wi[1]}; icon sizes ${ik.map(k => I[k].len).join('/')} chars`));
    // A solid seen from the front and above, depth receding up-right: its box
    // is full at the top right and the bottom left, empty at the top left
    // and the bottom right (a mirrored camera would swap them).
    const solids = ['zasilacz', 'pawilon'];
    results.push(expectAll('O3-6 one camera: a solid shows its top, front and RIGHT side (depth recedes up and to the right)', Object.fromEntries(solids.map(k => {
      const [tl, tr, bl, br] = L[k].corners;
      return [k, holds(tl < 0.25 && br < 0.25 && tr > 0.6 && bl > 0.6, L[k].corners.join('/'), 'TL and BR empty (< 0.25), TR and BL full (> 0.6)')];
    })), solids.map(k => `${k} ${L[k].corners.join('/')}`).join(' ')));
    results.push(expectAll('O3-6 one orientation: no look turns or reshapes while idle; the convoy car is the same car with its beacon', {
      reshaped: is(kinds.filter(k => L[k].idleIoU < 0.94).join(), ''),
      konwojSameBody: holds(art.konwoj.iou >= 0.8, art.konwoj.iou, '>= 0.8 overlap with the plain car'),
      konwojMarked: holds(art.konwoj.diff >= 0.03 && art.konwoj.diff <= 0.5, art.konwoj.diff, 'pixels worth 3-50 % of the car\'s body differ (the beacon and its glow, the bull bar)')
    }, `worst idle overlap ${Math.min(...kinds.map(k => L[k].idleIoU))}, convoy ${JSON.stringify(art.konwoj)}`));
    results.push(expectAll('O3-8 painting every sprite and icon draws no Math.random and leaves the round\'s RNG and the save alone', {
      randomCalls: is(art.randomCalls, 0), rng: is(art.rngSame, true), save: is(art.saveSame, true)
    }));

    /* ---- O3-7: special states ---- */
    const states = await page.evaluate(() => {
      const m = window.__m;
      const probe = (type, opts, set, goal) => {
        const e = new CampaignEntity(type, 0, 0, opts); Object.assign(e, set || {});
        const cv = document.createElement('canvas'); cv.width = cv.height = 400;
        const c = cv.getContext('2d'); c.translate(200, 200);
        const alphas = [], real = c.drawImage.bind(c);
        c.drawImage = (...a) => { alphas.push(+c.globalAlpha.toFixed(2)); return real(...a); };
        let strokes = 0; const st = c.stroke.bind(c); c.stroke = (...a) => { strokes++; return st(...a); };
        m.__qaSpriteCache.clear();
        e.draw(c, !!goal);
        return { alphas, strokes, keys: [...m.__qaSpriteCache.keys()] };
      };
      return {
        node: probe('node', {}), nodeUsed: probe('node', {}, { active: false }),
        mostek: probe('node', { glyph: 'mostek' }), mostekOn: probe('node', { glyph: 'mostek' }, { mostekPowered: true }),
        lustroUsed: probe('pylon', { glyph: 'lustro' }, { active: false }),
        kinoLocked: probe('landmark', { landmarkId: 'kino' }), kinoOpen: probe('landmark', { landmarkId: 'kino' }, { unlocked: true }),
        konwoj: probe('vehicle', { glyph: 'konwoj' }), car: probe('vehicle', {})
      };
    });
    results.push(expectAll('O3-7 the special states keep their logic: a used node and mirror dim to 0.35, an unpowered Mostek to 0.55, a locked landmark to 0.45 under its lock; the convoy has its own sprite', {
      node: is(states.node.alphas.join(), '1'), nodeUsed: is(states.nodeUsed.alphas.join(), '0.35'),
      mostek: is(states.mostek.alphas.join(), '0.55'), mostekOn: is(states.mostekOn.alphas.join(), '1'),
      lustroUsed: is(states.lustroUsed.alphas.join(), '0.35'),
      kinoLocked: is(states.kinoLocked.alphas.join(), '0.45'), kinoOpen: is(states.kinoOpen.alphas.join(), '1'),
      lockDrawn: holds(states.kinoLocked.strokes > states.kinoOpen.strokes - 1 && states.kinoLocked.strokes >= 1, states.kinoLocked.strokes, 'the dashed ring and the lock over a locked landmark'),
      usedNodeHasNoLiveArcs: holds(states.nodeUsed.strokes < states.node.strokes, `${states.nodeUsed.strokes} < ${states.node.strokes}`, 'no live overlay on a used node'),
      sprites: is([states.node.keys[0], states.mostek.keys[0], states.kinoOpen.keys[0], states.konwoj.keys[0], states.car.keys[0]].join(' '), 'wezel|#EFCB63|32| mostek|#EFCB63|32| lm_kino|#9875FF|52| samochod|#EFCB63|34|konwoj samochod|#EFCB63|34|')
    }, JSON.stringify(Object.fromEntries(Object.entries(states).map(([k, v]) => [k, v.alphas.join()])))));

    /* ---- O3-8 / O3-9 / O3-10: in the round ---- */
    const round = await page.evaluate(async ({ T34, LOOKS }) => {
      const m = window.__m, g = window.game, cache = m.__qaSpriteCache;
      const real = performance.now.bind(performance);
      const keysOf = () => [...cache.keys()].filter(k => T34.includes(k.split('|')[0]));
      const layout = (list) => { let h = 0x811c9dc5; for (const o of list) for (const v of [Math.round(o.x * 100), Math.round(o.y * 100), Math.round(o.radius * 100)]) { h ^= v; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
      const frame = (t) => (g.mode === 'campaign' ? g.renderCampaign(t) : g.render(t));
      const still = (n) => { for (let k = 0; k < n; k++) frame(1000); };
      const start = (fn) => { fn(); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; };
      const mission = (id) => () => { g.missionBoosters = []; g.startCampaignMission(id); if (g.introPending) g.beginMissionPlay(); };
      const out = { modes: {} };
      // the same seed twice: the layout does not depend on what was painted
      start(() => g.startRound({ seed: 4242 })); const h1 = layout(g.objects), s1 = g.rng.seed;
      cache.clear(); g.zoom = 0.3; still(20);
      const afterFirst = cache.size, seedAfterPaint = g.rng.seed;
      still(40);
      out.stillAdds = cache.size - afterFirst;
      start(() => g.startRound({ seed: 4242 })); out.layoutSame = layout(g.objects) === h1 && g.rng.seed === s1;
      out.paintKeepsRng = seedAfterPaint === s1;
      for (const [name, fn] of [['arena', () => g.startRound({ seed: 11 })], ['daily', () => g.startDailyChallenge()], ['challenge', () => g.startRound({ seed: 12, challenge: { score: 100, from: 'QA' } })],
        ...['M04', 'M08', 'M11', 'M19', 'M35', 'M37', 'M42', 'M46'].map(id => [id, mission(id)])]) {
        cache.clear(); start(fn);
        if (name === 'arena') g.spawnPortalRain();
        // the whole board, so every look of the mode is on screen
        if (g.mode !== 'campaign') { g.zoom = 0.3; }
        // moving frames: the live overlays (node arcs, pylon pulse, billboard scan, portal swirl) run too
        for (const t of [1000, 1000.37, 1001.9, 1003.3]) frame(t);
        const list = g.mode === 'campaign' ? g.campaignEntities : g.objects;
        const want = new Set(list.map(o => o.subtype || (o.artKind ? o.artKind() : null)).filter(k => T34.includes(k)));
        const c = g.ctx; c.save(); for (const o of list) { if (o.draw) o.draw(c, 0); } c.restore();
        out.modes[name] = { want: [...want].sort().join(), drawn: [...new Set(keysOf().map(k => k.split('|')[0]))].sort().join() };
      }
      // quality 0: sprites only, no idle motion, nothing throws
      g.applyGfx(0); cache.clear(); start(() => g.startRound({ seed: 11 })); g.zoom = 0.3; still(10);
      out.gfx0 = { keys: keysOf().length };
      g.applyGfx(2);
      // the board set: supersample, pixels, cost of building it from nothing
      const c = g.ctx;
      const set = () => { c.save(); for (const [k, , , r, tier, , variant] of LOOKS) m.__qaDrawObjectArt(c, k, { 3: '#EFCB63', 4: '#9875FF' }[tier], r, 0, 0, { live: false, variant }); c.restore(); };
      cache.clear(); set();
      let px = 0; for (const [, s] of cache) px += s.canvas.width * s.canvas.height;
      out.dpr = g.dpr; out.sprites = cache.size; out.pixels = px; out.keyParts = [...new Set([...cache.keys()].map(k => k.split('|').length))].join();
      out.sizes = [...cache].every(([k, s]) => s.canvas.width === Math.ceil(+k.split('|')[2] * 1.5 + 6) * 4);
      const t = [];
      for (let rep = 0; rep < 5; rep++) { cache.clear(); const t0 = real(); set(); t.push(real() - t0); }
      t.sort((a, b) => a - b); out.buildMs = +t[2].toFixed(1);
      return out;
    }, { T34, LOOKS: LOOKS3 });
    results.push(expectAll('O3-8 the same seed lays the same round whatever was painted in between; painting leaves game.rng alone', {
      layout: is(round.layoutSame, true), rng: is(round.paintKeepsRng, true)
    }));
    results.push(expectAll('O3-9 the cache: one 2x sprite per look and variant on a 2x phone, none added on a still frame, fewer pixels than the base revision\'s sprites, a quick build', {
      stillAdds: is(round.stillAdds, 0),
      sprites: is(round.sprites, LOOKS3.length),
      supersample: is(`${round.dpr}:${round.keyParts}:${round.sizes}`, '2:4:true'),
      pixels: holds(round.pixels < baseFacts.t34Pixels, `${round.pixels} vs ${baseFacts.t34Pixels}`, 'fewer sprite pixels than the base revision for the same looks'),
      buildMs: holds(round.buildMs < 200, round.buildMs, '< 200 ms for the whole set')
    }, `${round.sprites} sprites, ${(round.pixels / 1e6).toFixed(2)} MP (base ${(baseFacts.t34Pixels / 1e6).toFixed(2)} MP), built in ${round.buildMs} ms`));
    results.push(expectAll('O3-10 Arena (with the Overdrive portals), Daily, a friend\'s challenge and campaign missions draw their T3/T4 objects from the shared sprites, live overlays running', Object.fromEntries(
      Object.entries(round.modes).map(([k, v]) => [k, holds(v.want.length > 0 && v.drawn === v.want, v.drawn, v.want)])), Object.entries(round.modes).map(([k, v]) => `${k}: ${v.want}`).join(' · ')));
    results.push(expectAll('O3-10 quality 0 draws the same sprites (no idle motion, no error)', { sprites: holds(round.gfx0.keys >= 4, round.gfx0.keys, '>= 4 T3/T4 sprites on the whole board') }, JSON.stringify(round.gfx0)));
    results.push(report('O3-10 no page or console errors (base page and candidate page)', g.errors.length === 0 && baseErrors === 0, g.errors.join(' | ').slice(0, 300)));
    await g.browser.close();

    /* ---- O3-9: 2x at every pixel ratio; O3-10: the cinema's sign in English ---- */
    const ss = {};
    for (const [dsf, locale] of [[1, 'pl-PL'], [3, 'en-US']]) {
      const h = await open(url, dsf, locale);
      ss[dsf] = await h.page.evaluate((T34) => {
        const m = window.__m, g = window.game;
        g.startRound({ seed: 11 }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
        m.__qaSpriteCache.clear(); g.zoom = 0.3;
        for (let k = 0; k < 6; k++) g.render(1000);
        const keys = [...m.__qaSpriteCache.keys()].filter(k => T34.includes(k.split('|')[0]));
        // the cinema: where its lettering (pure white) lies on the 2x sprite
        const c = document.createElement('canvas').getContext('2d');
        m.__qaDrawObjectArt(c, 'lm_kino', '#9875FF', 52, 0, 0, { live: false });
        const s = m.__qaSpriteCache.get('lm_kino|#9875FF|52|'), w = s.canvas.width, d = s.canvas.getContext('2d').getImageData(0, 0, w, w).data;
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, n = 0;
        for (let y = 0; y < w / 2; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4; if (d[k] > 248 && d[k + 1] > 248 && d[k + 2] > 248 && d[k + 3] > 250) { n++; const ux = (x / 2 - s.half) / 52, uy = (y / 2 - s.half) / 52; if (ux < x0) x0 = ux; if (ux > x1) x1 = ux; if (uy < y0) y0 = uy; if (uy > y1) y1 = uy; } }
        return { dpr: g.dpr, lang: document.documentElement.lang, n: keys.length, parts: [...new Set(keys.map(k => k.split('|').length))].join(), width: w, text: { n, box: [x0, y0, x1, y1].map(v => +v.toFixed(2)) } };
      }, T34);
      ss[dsf].errors = h.errors.length;
      await h.browser.close();
    }
    const inSign = (t) => t.n > 40 && t.box[0] >= -0.76 && t.box[2] <= 0.3 && t.box[1] >= -0.5 && t.box[3] <= -0.1;
    results.push(expectAll('O3-9 the T3/T4 sprites stay 2x at every pixel ratio (a desktop, a 3x phone)', {
      desktop: is(`${ss[1].parts}:${ss[1].width}`, '4:336'), phone3x: is(`${ss[3].parts}:${ss[3].width}`, '4:336'), seen: holds(ss[1].n >= 4 && ss[3].n >= 4, `${ss[1].n}/${ss[3].n}`, '>= 4 looks on the board'), errors: is(ss[1].errors + ss[3].errors, 0)
    }, JSON.stringify({ 1: ss[1].dpr, 3: ss[3].dpr })));
    results.push(expectAll('O3-10 the cinema\'s sign follows the language (KINO / CINEMA) and its lettering stays on the sign board', {
      polish: holds(ss[1].lang === 'pl' && inSign(ss[1].text), JSON.stringify(ss[1].text), 'white lettering inside the board'),
      english: holds(ss[3].lang === 'en' && inSign(ss[3].text), JSON.stringify(ss[3].text), 'white lettering inside the board'),
      differs: holds(ss[1].text.n !== ss[3].text.n, `${ss[1].text.n} / ${ss[3].text.n}`, 'another word in English')
    }, `pl ${JSON.stringify(ss[1].text.box)} en ${JSON.stringify(ss[3].text.box)}`));
  } finally { server.close(); baseSrv.server.close(); }
  return results;
}

if (isMain(import.meta.url)) {
  const r = await runObjects3Checks();
  const bad = r.filter(x => !x.ok);
  console.log(`\n${r.length - bad.length}/${r.length} GG-OBJECTS-03 checks passed`);
  process.exit(bad.length ? 1 : 0);
}
