// GG-OBJECTS-02 -- "Premium Vector Objects": the T1/T2 looks. What this suite proves:
//  - O2-1 nothing but the picture changed: the T1/T2 classes keep their
//    tier, radius, value, growth, count and looks (Arena TIERS and the
//    campaign's entity stats), and every other look's art (T3-T6, landmarks,
//    portal, byte) is the base revision's source, character for character;
//  - O2-2 all fifteen T1/T2 looks are painted by the shared kit (VA_ART) and a
//    campaign entity of each type resolves to one of them;
//  - O2-3 a sprite is whole: nothing is cut at the canvas edge at 2x / 3x /
//    4x, the body sits on its hitbox and neither dwarfs nor outgrows it;
//  - O2-4 one geometry at every scale: the board sprite, a big preview and the
//    goal icon of a look are the same silhouette (overlap of the normalized
//    shapes), and the icon is the art replayed as SVG, one per look;
//  - O2-5 one orientation: an idle object never turns (the fragment used to
//    rock by +-20 degrees);
//  - O2-6 the art is outside the round: painting every sprite and icon draws
//    no Math.random and leaves game.rng, the layout and the save alone;
//  - O2-7 the cache: one sprite per look and supersample (2x / 3x / 4x by the
//    canvas' pixel ratio, T3+ stay 2x), no new sprite on a still frame, a
//    bounded pixel budget, a sprite set built in a few milliseconds;
//  - O2-8 Arena, Daily, a friend's challenge and campaign missions draw the
//    same sprites, also at quality 0, with no page or console error.
// The page runs a served copy of game.js with one added export line (the
// renderer is not part of the QA bridge: an older revision has no such
// export, and perf1 --equiv / ftue3 --root run this bridge against them).
// Usage: node qa/objects2.mjs
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, allDistrictsSave, report, expectAll, is, truthy, holds, revisionFile, QA_RANDOM, ROOT, OUT, isMain } from './lib.mjs';
import { LOOKS } from './objects2-shots.mjs';

/** The production main this stage was cut from (PR #94, the A2.1 floor). */
export const OBJECTS2_BASE_REV = '2f8ab87ae135dc0921bfe4b6f5c04edb7b1ee209';
const VA_KINDS = LOOKS.map(l => l[0]);

/** The base revision's numbers for the four T1/T2 classes (Arena TIERS). */
const FROZEN_TIERS = {
  fragment: { color: '#50F0FA', minR: 7, maxR: 7, value: 5, growth: 1, subtypes: ['fragment'], count: 170, minSizeTier: 0 },
  capsule: { color: '#50F0FA', minR: 10, maxR: 10, value: 15, growth: 3, subtypes: ['kapsula'], count: 40, minSizeTier: 0 },
  prop: { color: '#FF54AD', minR: 20, maxR: 20, value: 15, growth: 3, subtypes: ['latarnia', 'drzewo', 'lawka', 'kiosk', 'skrzynia'], count: 40, minSizeTier: 1 },
  marker: { color: '#FF54AD', minR: 20, maxR: 20, value: 50, growth: 10, subtypes: ['znacznik'], count: 10, minSizeTier: 1 }
};
const FROZEN_STATS = { fragment: [1, 5, 1], capsule: [3, 15, 1], prop: [3, 15, 2], marker: [10, 50, 2] }; // growth, score, minTier

function exportedCopy() {
  const dir = path.join(OUT, 'objects2', '.suite');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['index.html', 'style.css']) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'game.js'), fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8') +
    '\nexport { drawObjectArt as __qaDrawObjectArt, OBJECT_SPRITE_CACHE as __qaSpriteCache, OBJECT_ART as __qaObjectArt, VA_ART as __qaVaArt, GOAL_ART_ICONS as __qaGoalArtIcons, GOAL_ICONS as __qaGoalIcons };\n');
  return dir;
}

/** The source of every OBJECT_ART entry and drawObjectLive case of a game.js text. */
function artSources(src) {
  const a = src.indexOf('\nconst OBJECT_ART = {'), b = src.indexOf('\n};', a);
  const body = src.slice(a, b);
  const out = {};
  const re = /\n {2}([a-z_0-9]+)\(c, r, col[^)]*\) \{\n/g;
  let m; const starts = [];
  while ((m = re.exec(body))) starts.push([m[1], m.index]);
  starts.forEach(([name, at], i) => { out[name] = body.slice(at, i + 1 < starts.length ? starts[i + 1][1] : body.length).replace(/\n\n {2}(\/\/|\/\*)[\s\S]*$/, '').trim(); });
  const l0 = src.indexOf('\nfunction drawObjectLive('), l1 = src.indexOf('\n}\n', l0);
  const live = src.slice(l0, l1);
  out['live:rest'] = live.slice(live.indexOf("    case 'wezel'"));
  return out;
}

async function open(url, dsf, viewport = { width: 420, height: 800 }) {
  const g = await openGame(url, { viewport, mobile: dsf > 1, deviceScaleFactor: dsf, initScript: QA_RANDOM });
  const save = await allDistrictsSave(g.page);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  await g.page.evaluate(async () => { window.__m = await import(document.querySelector('script[type="module"][src]').src); });
  return g;
}

export async function runObjects2Checks() {
  const results = [];

  /* ---- O2-1 (static): the other looks' art is the base revision's ---- */
  {
    const now = artSources(fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8'));
    let base = null, why = '';
    try { base = artSources(String(revisionFile(OBJECTS2_BASE_REV, 'game.js'))); } catch (e) { why = String(e.message || e).slice(0, 160); }
    if (!base) results.push(report('O2-1 T3-T6 art source equals the base revision', false, 'base revision not readable: ' + why));
    else {
      const others = Object.keys(base).filter(k => !VA_KINDS.includes(k));
      const changed = others.filter(k => base[k] !== now[k]);
      const gone = VA_KINDS.filter(k => now[k]);
      results.push(expectAll('O2-1 every other look (T3-T6, landmarks, portal, byte) and its live overlay is the base revision\'s source, unchanged', {
        others: holds(others.length >= 28, others.length, '>= 28 looks compared'),
        changed: is(changed.join(','), ''),
        oldT1T2Removed: is(gone.join(','), '')
      }, `${others.length} looks compared with ${OBJECTS2_BASE_REV.slice(0, 7)}`));
    }
  }

  const { server, url } = await serve({ root: exportedCopy() });
  try {
    const g = await open(url, 2);
    const page = g.page;

    /* ---- O2-1: classes, tiers, radii ---- */
    const inv = await page.evaluate((frozen) => {
      const out = { tiers: {}, stats: {}, radius: {}, eat: {} };
      for (const k of Object.keys(frozen)) {
        out.tiers[k] = JSON.parse(JSON.stringify(TIERS[k]));
        const e = new CampaignEntity(k, 0, 0, {});
        out.stats[k] = [e.stats.growth, e.stats.score, e.stats.minTier];
        out.radius[k] = e.radius;
      }
      // the eat gate itself: a T1 hole eats T1, not T2; a T2 hole eats both
      const r1 = CONFIG.sizeTiers ? 18 : 18;
      const tierOf = (r) => getSizeTierIndex(r);
      let rT2 = r1; while (tierOf(rT2) < 1 && rT2 < 400) rT2 += 0.5;
      out.eat = { t1EatsFragment: canEatWorldObjectTier(r1, { tier: 'fragment' }), t1EatsProp: canEatWorldObjectTier(r1, { tier: 'prop' }), t1EatsMarker: canEatWorldObjectTier(r1, { tier: 'marker' }),
        t2EatsProp: canEatWorldObjectTier(rT2, { tier: 'prop' }), t2EatsMarker: canEatWorldObjectTier(rT2, { tier: 'marker' }), t2EatsVehicle: canEatWorldObjectTier(rT2, { tier: 'vehicle' }), startTier: tierOf(r1) };
      return out;
    }, FROZEN_TIERS);
    results.push(expectAll('O2-1 the T1/T2 classes keep tier, radius, value, growth, count and looks (Arena) and growth / score / tier (Campaign)', {
      tiers: is(JSON.stringify(inv.tiers), JSON.stringify(FROZEN_TIERS)),
      stats: is(JSON.stringify(inv.stats), JSON.stringify(FROZEN_STATS)),
      campaignRadius: is(JSON.stringify(inv.radius), JSON.stringify({ fragment: 7, capsule: 10, prop: 20, marker: 20 })),
      eatGate: is(JSON.stringify(inv.eat), JSON.stringify({ t1EatsFragment: true, t1EatsProp: false, t1EatsMarker: false, t2EatsProp: true, t2EatsMarker: true, t2EatsVehicle: false, startTier: 0 }))
    }, JSON.stringify(inv.eat)));

    /* ---- O2-2: the fifteen looks ---- */
    const looks = await page.evaluate((LOOKS) => {
      const va = Object.keys(window.__m.__qaVaArt);
      const art = window.__m.__qaObjectArt;
      const resolved = LOOKS.map(([kind, , type]) => CampaignEntity.prototype.artKind.call({ type, glyph: type === 'prop' || type === 'marker' ? kind : undefined }));
      const arena = [].concat(TIERS.fragment.subtypes, TIERS.capsule.subtypes, TIERS.prop.subtypes, TIERS.marker.subtypes);
      return { va, same: LOOKS.every(([k]) => art[k] === window.__m.__qaVaArt[k]), resolved, arenaAll: arena.every(k => va.includes(k)), golden: !art.zloty };
    }, LOOKS);
    results.push(expectAll('O2-2 the fifteen T1/T2 looks are the shared kit\'s art, in Arena and for every campaign entity of those types', {
      kinds: is(looks.va.slice().sort().join(), VA_KINDS.slice().sort().join()),
      objectArtUsesThem: is(looks.same, true),
      campaignResolves: is(looks.resolved.join(), VA_KINDS.join()),
      arenaSubtypes: is(looks.arenaAll, true)
    }, looks.va.length + ' looks'));

    /* ---- O2-3 / O2-4 / O2-5 / O2-6: sprites, silhouettes, icons ---- */
    const art = await page.evaluate(async ({ LOOKS, colors }) => {
      const m = window.__m, g = window.game;
      window.__qaSeedRandom(99);
      const rngBefore = g.rng ? g.rng.seed : null;
      const saveBefore = localStorage.getItem('vectorHoleSave_v1');
      const paint = (kind, col, r, t, live) => {
        const half = Math.ceil(r * 1.7 + 16), cv = document.createElement('canvas');
        cv.width = cv.height = half * 2;
        const c = cv.getContext('2d');
        c.translate(half, half);
        m.__qaDrawObjectArt(c, kind, col, r, t, 0, { live: !!live });
        return { cv, half };
      };
      /** The solid silhouette of a picture (outline included; no ground
       *  shadow, pad or glow: they stay under ~0.75 alpha), as a 48 x 48
       *  mask normalized to its own bounding box. */
      const body = (cv) => {
        const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data;
        let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0, sx = 0, sy = 0;
        const on = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const k = (y * w + x) * 4;
          if (d[k + 3] > 215) { on[y * w + x] = 1; n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        const N = 48, mask = new Uint8Array(N * N);
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) mask[j * N + i] = on[Math.min(h - 1, Math.round(y0 + (j + 0.5) / N * (y1 - y0))) * w + Math.min(w - 1, Math.round(x0 + (i + 0.5) / N * (x1 - x0)))];
        // principal axis of the body (degrees)
        const cx = sx / n, cy = sy / n; let a = 0, b = 0, cc = 0;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (on[y * w + x]) { a += (x - cx) * (x - cx); b += (x - cx) * (y - cy); cc += (y - cy) * (y - cy); }
        return { mask, n, box: [x0 - w / 2, y0 - h / 2, x1 - w / 2, y1 - h / 2], aspect: (x1 - x0) / (y1 - y0), axis: 0.5 * Math.atan2(2 * b, a - cc) * 180 / Math.PI };
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
      const out = { looks: {}, icons: {}, edges: [] };
      for (const [kind, , type, radius, tier] of LOOKS) {
        const col = colors[tier];
        const small = body(paint(kind, col, radius * 2, 0, false).cv);   // the board sprite on a 2x phone
        const big = body(paint(kind, col, 90, 0, false).cv);
        const def = g.objectiveIconDef({ eat: type, glyph: type === 'prop' || type === 'marker' ? kind : undefined, n: 1 }, null);
        let icon = null, iconErr = '';
        try { icon = body(await rasterIcon(def.icon)); } catch (e) { iconErr = String(e.message || e); }
        // idle: the same look at four moments of its bob / breathe
        const idle = [0, 0.4, 0.9, 1.7].map(t => body(paint(kind, col, 60, t, false).cv));
        const axes = idle.map(b => b.axis);
        const r = radius * 2, bx = small.box;
        out.looks[kind] = {
          scaleIoU: +iou(small.mask, big.mask).toFixed(3), iconIoU: icon ? +iou(icon.mask, big.mask).toFixed(3) : 0, iconErr,
          aspect: [+small.aspect.toFixed(2), +big.aspect.toFixed(2), icon ? +icon.aspect.toFixed(2) : 0],
          axisSpread: +(Math.max(...axes) - Math.min(...axes)).toFixed(2), idleIoU: +Math.min(...idle.map(b => iou(b.mask, idle[0].mask))).toFixed(3),
          halfW: +(Math.max(-bx[0], bx[2]) / r).toFixed(2), halfH: +(Math.max(-bx[1], bx[3]) / r).toFixed(2),
          center: [+((bx[0] + bx[2]) / 2 / r).toFixed(2), +((bx[1] + bx[3]) / 2 / r).toFixed(2)]
        };
        out.icons[kind] = { len: def.icon.length, paths: (def.icon.match(/<path /g) || []).length, currentColor: /currentColor/.test(def.icon), color: def.color, fromArt: def.icon === (type === 'fragment' ? m.__qaGoalIcons.fragment : type === 'capsule' ? m.__qaGoalIcons.capsule : m.__qaGoalArtIcons[kind]), markup: def.icon };
      }
      // class icons: any street element / any marker
      const propClass = g.objectiveIconDef({ eat: 'prop', n: 1 }, null).icon, markerClass = g.campaignGoalIcon('marker').icon;
      out.classIcons = { propIsOwn: Object.values(out.icons).every(i => i.markup !== propClass), propPaths: (propClass.match(/<path /g) || []).length, markerIsZnacznik: markerClass === out.icons.znacznik.markup };
      out.unique = new Set(Object.values(out.icons).map(i => i.markup)).size;
      for (const k of Object.keys(out.icons)) delete out.icons[k].markup;
      // the cached sprites themselves: nothing painted on the canvas edge
      for (const [key, s] of m.__qaSpriteCache) {
        const cv = s.canvas, w = cv.width, d = cv.getContext('2d').getImageData(0, 0, w, w).data;
        let edge = 0;
        for (let i = 0; i < w; i++) edge = Math.max(edge, d[i * 4 + 3], d[((w - 1) * w + i) * 4 + 3], d[(i * w) * 4 + 3], d[(i * w + w - 1) * 4 + 3]);
        if (key.split('|').length === 5) out.edges.push([key, w, edge]);
      }
      out.randomCalls = window.__qaRandomCalls;
      out.rngSame = (g.rng ? g.rng.seed : null) === rngBefore;
      out.saveSame = localStorage.getItem('vectorHoleSave_v1') === saveBefore;
      window.__qaRestoreRandom();
      return out;
    }, { LOOKS, colors: { 1: '#50F0FA', 2: '#FF54AD' } });
    const L = art.looks, kinds = Object.keys(L);
    const worst = (f) => kinds.map(k => [k, f(L[k])]).sort((a, b) => a[1] - b[1])[0];
    results.push(expectAll('O2-3 every sprite is whole (nothing painted on the canvas edge), its body sits on the hitbox and fills it without outgrowing it', {
      sprites: holds(art.edges.length >= 15, art.edges.length, '>= 15 cached T1/T2 sprites'),
      cut: is(art.edges.filter(e => e[2] > 2).map(e => e[0]).join(), ''),
      tooWide: is(kinds.filter(k => L[k].halfW > 1.12).join(), ''),
      tooTall: is(kinds.filter(k => L[k].halfH > 1.16).join(), ''),
      tooSmall: is(kinds.filter(k => Math.max(L[k].halfW, L[k].halfH) < 0.8).join(), ''),
      offCenter: is(kinds.filter(k => Math.abs(L[k].center[0]) > 0.16 || Math.abs(L[k].center[1]) > 0.22).join(), '')
    }, kinds.map(k => `${k} ${L[k].halfW}x${L[k].halfH}`).join(' ')));
    const ws = worst(v => v.scaleIoU), wi = worst(v => v.iconIoU);
    results.push(expectAll('O2-4 one geometry at every scale: the board sprite and the big preview are the same silhouette', {
      worstOverlap: holds(ws[1] >= 0.9, ws[1], '>= 0.9 overlap of the normalized silhouettes'),
      aspect: is(kinds.filter(k => Math.abs(L[k].aspect[0] - L[k].aspect[1]) > 0.06).join(), '')
    }, `worst ${ws[0]} ${ws[1]}`));
    results.push(expectAll('O2-4 the goal icon is the board art replayed as SVG: same silhouette, one icon per look, no line-icon leftovers', {
      parse: is(kinds.filter(k => L[k].iconErr).join(), ''),
      worstOverlap: holds(wi[1] >= 0.86, wi[1], '>= 0.86 overlap with the big preview'),
      aspect: is(kinds.filter(k => Math.abs(L[k].aspect[2] - L[k].aspect[1]) > 0.08).join(), ''),
      fromArt: is(kinds.filter(k => !art.icons[k].fromArt).join(), ''),
      vector: is(kinds.filter(k => art.icons[k].paths < 4 || art.icons[k].currentColor).join(), ''),
      unique: is(art.unique, 15),
      tierColor: is(kinds.filter(k => art.icons[k].color !== (k === 'fragment' || k === 'kapsula' ? '#50F0FA' : '#FF54AD')).join(), ''),
      propClassIcon: is(art.classIcons.propIsOwn && art.classIcons.propPaths > 8, true),
      markerClassIcon: is(art.classIcons.markerIsZnacznik, true)
    }, `worst ${wi[0]} ${wi[1]}; icon sizes ${kinds.map(k => art.icons[k].len).join('/')} chars`));
    results.push(expectAll('O2-5 one orientation: no look turns while idle', {
      reshaped: is(kinds.filter(k => L[k].idleIoU < 0.94).join(), ''),
      fragmentAxis: holds(L.fragment.axisSpread < 1, L.fragment.axisSpread, 'the fragment\'s long axis within 1 degree'),
      capsuleAxis: holds(L.kapsula.axisSpread < 1, L.kapsula.axisSpread, 'the capsule\'s long axis within 1 degree')
    }, `fragment axis spread ${L.fragment.axisSpread} deg, worst idle overlap ${Math.min(...kinds.map(k => L[k].idleIoU))}`));
    results.push(expectAll('O2-6 painting every sprite and icon draws no Math.random and leaves the round\'s RNG and the save alone', {
      randomCalls: is(art.randomCalls, 0), rng: is(art.rngSame, true), save: is(art.saveSame, true)
    }));

    /* ---- O2-6 / O2-7 / O2-8: in the round ---- */
    const round = await page.evaluate(async (VA) => {
      const m = window.__m, g = window.game, cache = m.__qaSpriteCache;
      const real = performance.now.bind(performance);
      const vaKeys = () => [...cache.keys()].filter(k => VA.includes(k.split('|')[0]));
      const layout = (list) => { let h = 0x811c9dc5; for (const o of list) for (const v of [Math.round(o.x * 100), Math.round(o.y * 100), Math.round(o.radius * 100)]) { h ^= v; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
      const still = (n) => { for (let k = 0; k < n; k++) (g.mode === 'campaign' ? g.renderCampaign(1000) : g.render(1000)); };
      const start = (fn) => { fn(); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; };
      const out = { modes: {} };
      // the same seed twice: the layout does not depend on what was painted
      start(() => g.startRound({ seed: 4242 })); const h1 = layout(g.objects), s1 = g.rng.seed;
      cache.clear(); still(20);
      const afterFirst = vaKeys().length, seedAfterPaint = g.rng.seed;
      still(40);
      out.stillAdds = vaKeys().length - afterFirst;
      start(() => g.startRound({ seed: 4242 })); out.layoutSame = layout(g.objects) === h1 && g.rng.seed === s1;
      out.paintKeepsRng = seedAfterPaint === s1;
      for (const [name, fn] of [['arena', () => g.startRound({ seed: 11 })], ['daily', () => g.startDailyChallenge()], ['challenge', () => g.startRound({ seed: 12, challenge: { score: 100, from: 'QA' } })],
        ['M02', () => { g.missionBoosters = []; g.startCampaignMission('M02'); if (g.introPending) g.beginMissionPlay(); }],
        ['M09', () => { g.missionBoosters = []; g.startCampaignMission('M09'); if (g.introPending) g.beginMissionPlay(); }],
        ['M14', () => { g.missionBoosters = []; g.startCampaignMission('M14'); if (g.introPending) g.beginMissionPlay(); }],
        ['M21', () => { g.missionBoosters = []; g.startCampaignMission('M21'); if (g.introPending) g.beginMissionPlay(); }]]) {
        cache.clear(); start(fn);
        // the whole board, so every look of the mode is on screen
        if (g.mode !== 'campaign') { g.zoom = 0.3; } still(8);
        const list = g.mode === 'campaign' ? g.campaignEntities : g.objects;
        const want = new Set(list.map(o => o.subtype || (o.artKind ? o.artKind() : null)).filter(k => VA.includes(k)));
        // every object of the mode once, as the board draws it
        const c = g.ctx; c.save(); for (const o of list) { if (o.draw) o.draw(c, 0); } c.restore();
        out.modes[name] = { want: [...want].sort().join(), drawn: [...new Set(vaKeys().map(k => k.split('|')[0]))].sort().join() };
      }
      // quality 0: sprites only, no idle motion, nothing throws
      g.applyGfx(0); cache.clear(); start(() => g.startRound({ seed: 11 })); still(10);
      out.gfx0 = { keys: vaKeys().length, dpr: g.dpr, ss: [...new Set(vaKeys().map(k => k.split('|')[4]))].join() };
      g.applyGfx(2);
      // supersample and the pixel budget on this page's pixel ratio
      cache.clear(); start(() => g.startRound({ seed: 11 })); still(10);
      const c = g.ctx; c.save(); for (const k of VA) m.__qaDrawObjectArt(c, k, k === 'fragment' || k === 'kapsula' ? '#50F0FA' : '#FF54AD', k === 'fragment' ? 7 : k === 'kapsula' ? 10 : 20, 0, 0, { live: false }); c.restore();
      let px = 0; for (const [k, s] of cache) if (VA.includes(k.split('|')[0])) px += s.canvas.width * s.canvas.height;
      out.dpr = g.dpr; out.ss = [...new Set(vaKeys().map(k => k.split('|')[4]))].join(); out.vaSprites = vaKeys().length; out.vaPixels = px;
      out.otherSs = [...cache.keys()].filter(k => !VA.includes(k.split('|')[0])).every(k => k.split('|').length === 4);
      // cost of building the fifteen sprites from nothing
      const t = [];
      for (let rep = 0; rep < 5; rep++) { cache.clear(); const t0 = real(); for (const k of VA) m.__qaDrawObjectArt(c, k, k === 'fragment' || k === 'kapsula' ? '#50F0FA' : '#FF54AD', k === 'fragment' ? 7 : k === 'kapsula' ? 10 : 20, 0, 0, { live: false }); t.push(real() - t0); }
      t.sort((a, b) => a - b); out.buildMs = +t[2].toFixed(1);
      return out;
    }, VA_KINDS);
    results.push(expectAll('O2-6 the same seed lays the same round whatever was painted in between; painting leaves game.rng alone', {
      layout: is(round.layoutSame, true), rng: is(round.paintKeepsRng, true)
    }));
    results.push(expectAll('O2-7 the cache: one sprite per look, none added on a still frame, 3x on a 2x phone (T3+ stay 2x), a small pixel budget, a quick build', {
      stillAdds: is(round.stillAdds, 0),
      supersample: is(`${round.dpr}:${round.ss}`, '2:3'),
      othersStay2x: is(round.otherSs, true),
      sprites: is(round.vaSprites, 15),
      pixels: holds(round.vaPixels < 1.2e6, round.vaPixels, '< 1.2 MP for the fifteen sprites at 3x'),
      buildMs: holds(round.buildMs < 120, round.buildMs, '< 120 ms for the whole set')
    }, `${round.vaSprites} sprites, ${(round.vaPixels / 1e6).toFixed(2)} MP, built in ${round.buildMs} ms`));
    results.push(expectAll('O2-8 Arena, Daily, a friend\'s challenge and campaign missions draw their T1/T2 objects from the shared sprites', Object.fromEntries(
      Object.entries(round.modes).map(([k, v]) => [k, is(v.drawn, v.want)])), Object.entries(round.modes).map(([k, v]) => `${k}: ${v.want.split(',').length}`).join(' ')));
    results.push(expectAll('O2-8 quality 0 draws the same sprites (no idle motion, no error)', { sprites: holds(round.gfx0.keys >= 3, round.gfx0.keys, '>= 3 T1/T2 sprites on the first frames') }, JSON.stringify(round.gfx0)));
    results.push(report('O2-8 no page or console errors', g.errors.length === 0, g.errors.join(' | ').slice(0, 300)));
    await g.browser.close();

    /* ---- O2-7: supersample by pixel ratio ---- */
    const ss = {};
    for (const dsf of [1, 3]) {
      const h = await open(url, dsf);
      ss[dsf] = await h.page.evaluate((VA) => {
        const m = window.__m, g = window.game;
        g.startRound({ seed: 11 }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
        m.__qaSpriteCache.clear();
        for (let k = 0; k < 6; k++) g.render(1000);
        const keys = [...m.__qaSpriteCache.keys()].filter(k => VA.includes(k.split('|')[0]));
        return { dpr: g.dpr, ss: [...new Set(keys.map(k => k.split('|')[4]))].join(), n: keys.length };
      }, VA_KINDS);
      ss[dsf].errors = h.errors.length;
      await h.browser.close();
    }
    results.push(expectAll('O2-7 the sprites follow the canvas\' pixel ratio: 2x on a desktop, 4x on a 3x phone (within the quality level\'s cap)', {
      desktop: is(`${ss[1].dpr}:${ss[1].ss}`, '1:2'),
      phone3x: holds(['3:4', '2:3'].includes(`${ss[3].dpr}:${ss[3].ss}`), `${ss[3].dpr}:${ss[3].ss}`, '3:4 (or 2:3 when the quality level caps the ratio at 2)'),
      errors: is(ss[1].errors + ss[3].errors, 0)
    }, JSON.stringify(ss)));
  } finally { server.close(); }
  return results;
}

if (isMain(import.meta.url)) {
  const r = await runObjects2Checks();
  const bad = r.filter(x => !x.ok);
  console.log(`\n${r.length - bad.length}/${r.length} GG-OBJECTS-02 checks passed`);
  process.exit(bad.length ? 1 : 0);
}
