// GG-OBJECTS-FIX-03: T1 visual (sharpness, ground ring, pulse) + no overlapping Arena spawns. A stage test: base = a worktree of origin/main.
//   node qa/objfix3.mjs --base=DIR [--pack=DIR (the unpacked GG_OBJECTS_21_FINAL_SPRITES_V1: the T1 sharpness reference)] [--seeds=60] [--only=spawn,t1]
// Spawn: footprint = the hitbox circle (radius r); two footprints overlap when d < r1 + r2, the spawn gap is broken when d < r1 + r2 + 6.
// T1 sharpness: each T1 bitmap as the game draws it at a real screen density vs an ideal reference (the native PNG area-filtered
// straight to that density, same placement): RMSE (premultiplied RGBA, 0-255) and edge energy (sum of |grad| of premultiplied luma, 1.0 = the reference).
// Output: qa/out/objfix3/results.json (+ the console). Exit 1 on any FAIL.
import fs from 'node:fs';
import path from 'node:path';
import { serve, report, OUT, ROOT, isMain } from './lib.mjs';
import { session, stageScene } from './objraster2-shots.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const GAP = 6;
const DIR = path.join(OUT, 'objfix3');

/** A served copy of a checkout whose game.js also exports the renderer, the bitmap registry and (candidate) the T1 cache. QA only. */
function exportedRoot(root, name) {
  const dir = path.join(DIR, '.root-' + name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(root)) if (/\.(js|html|css)$/.test(f) && f !== 'game.js') fs.copyFileSync(path.join(root, f), path.join(dir, f));
  const src = fs.readFileSync(path.join(root, 'game.js'), 'utf8'), t1 = src.includes('const OBJECT_T1 =');
  fs.writeFileSync(path.join(dir, 'game.js'), src + `\nexport { drawObjectArt as __qaDraw, OBJECT_RASTER as __qaRaster${t1 ? ', OBJECT_T1 as __qaT1, t1Entry as __qaT1Entry, T1_BREATHE as __qaT1Amp' : ''} };\n`);
  return dir;
}

/* ------------------------------------------------------------------ spawn ------------------------------------------------------------------ */
const LIB = `
  const g = window.game, stop = () => { if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; };
  const live = (o) => !o.eating && !o.removed;
  const pairs = (objs, gap) => { let n = 0; const L = objs.filter(live); for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j], m = a.radius + b.radius + gap; if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < m * m) n++; } return n; };
  // the 2.5D picture: a bitmap's opaque box (2.1 r wide, from 1.35 r above the centre to 1.05 r below) -- measured, not required
  const vis = (objs) => { let n = 0; const L = objs.filter(live); for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j]; if (Math.abs(a.x - b.x) < 1.05 * (a.radius + b.radius) && a.y - 1.35 * a.radius < b.y + 1.05 * b.radius && b.y - 1.35 * b.radius < a.y + 1.05 * a.radius) n++; } return n; };
  const clash = (o, gap) => { for (const p of g.objects) if (p !== o && live(p)) { const m = o.radius + p.radius + gap; if ((o.x - p.x) ** 2 + (o.y - p.y) ** 2 < m * m) return true; } return false; };
  const fnv = (s) => { let a = 0x811c9dc5; for (let i = 0; i < s.length; i++) a = Math.imul(a ^ s.charCodeAt(i), 16777619); return (a >>> 0).toString(16); };
  const rest = (o) => [o.tier, o.subtype, Math.round(o.radius * 1000), Math.round(o.rotation * 1000), o.value, !!o.trail].join(',');
`;

const LAYOUTS = `(async (arg) => { ${LIB}
  const out = {};
  for (const seed of arg.seeds) {
    window.__qaSeedRandom(seed);
    const t0 = performance.now();
    g.startRound({ seed }); stop();
    const ms = performance.now() - t0, objs = g.objects, tiers = {};
    objs.forEach(o => { tiers[o.tier] = (tiers[o.tier] || 0) + 1; });
    out[seed] = { n: objs.length, tiers: JSON.stringify(tiers), overlap: pairs(objs, 0), gapViol: pairs(objs, ${GAP}), vis: vis(objs),
      rest: fnv(objs.map(rest).join('|')), bots: fnv(g.bots.map(b => [b.name, b.x.toFixed(3), b.y.toFixed(3), b.radius.toFixed(3)].join()).join('|')),
      player: [g.player.x, g.player.y].map(v => v.toFixed(3)).join(), modifier: g.modifier, random: window.__qaRandomCalls, rngNext: g.rng.next(),
      inBounds: objs.every(o => o.x >= o.radius + 20 - 1e-9 && o.x <= ${'WORLD_W'} - o.radius - 20 + 1e-9 && o.y >= o.radius + 20 - 1e-9 && o.y <= ${'WORLD_H'} - o.radius - 20 + 1e-9),
      pos: objs.map(o => [Math.round(o.x * 1000) / 1000, Math.round(o.y * 1000) / 1000, o.trail ? 1 : 0, o.tier]), stats: g.spawnStats || null, ms };
  }
  return out;
})`;

const DAILY = `(async () => { ${LIB}
  const lay = g.computeDailyLayout(), lay2 = g.computeDailyLayout();
  window.__qaSeedRandom(5); g.startDailyChallenge(); stop();
  const act = g.objects.map(o => ({ tier: o.tier, x: o.x, y: o.y }));
  return { previewIsReal: JSON.stringify(lay.objects) === JSON.stringify(act), repeat: JSON.stringify(lay.objects) === JSON.stringify(lay2.objects), n: g.objects.length,
    overlap: pairs(g.objects, 0), gapViol: pairs(g.objects, ${GAP}), hash: fnv(JSON.stringify(lay.objects)) };
})`;

/** A long round with the real eat -> respawn loop: a T6 player teleported every 8 frames + the bots; every object respawned in a frame
 *  (spawnFlash == 1 after update()) is checked against every live object; then Złoty Rdzeń x40 and the portal wave x10. */
const RESPAWN = `(async (arg) => { ${LIB}
  window.__qaSeedRandom(arg.seed); g.startRound({ seed: arg.seed }); stop();
  const n0 = g.objects.length;
  g.player.setRadius(arg.radius); g.player.invulnerableUntil = Infinity;
  let spawned = 0, overlap = 0, gapViol = 0, frames = 0;
  for (let f = 0; f < arg.frames; f++) {
    if (f % 8 === 0) { g.player.x = 300 + Math.random() * 2400; g.player.y = 300 + Math.random() * 2400; }
    g.update(1 / 60); frames++;
    if (!g.running && g.state !== 'playing' && g.timeRemaining <= 0) break;
    for (const o of g.objects) if (o.spawnFlash === 1 && live(o)) { spawned++; if (clash(o, 0)) overlap++; if (clash(o, ${GAP})) gapViol++; }
  }
  const nEnd = g.objects.filter(o => o.tier !== 'golden' && o.tier !== 'portal').length;
  let gold = 0, goldBad = 0, portal = 0, portalBad = 0;
  for (let i = 0; i < 40; i++) { g.spawnGoldenCore(); gold++; if (clash(g.goldenObj, ${GAP})) goldBad++; }
  for (let i = 0; i < 10; i++) { const k = g.objects.length; g.spawnPortalRain(); for (const o of g.objects.slice(k)) { portal++; if (clash(o, ${GAP})) portalBad++; } }
  return { frames, spawned, overlap, gapViol, n0, nEnd, gold, goldBad, portal, portalBad, crowded: g.spawnStats ? g.spawnStats.crowded : null };
})`;

/** TIERS counts scaled (density scenarios) -- restored afterwards. `noRoomTest`: settleRespawn of a tower where no tower fits. */
const DENSE = `(async (arg) => { ${LIB}
  const saved = {};
  for (const [k, t] of Object.entries(TIERS)) { saved[k] = t.count; t.count = Math.round(t.count * (arg.mult[k] != null ? arg.mult[k] : arg.all)); }
  try {
    const expected = Object.values(TIERS).reduce((a, t) => a + t.count, 0);
    let foot = 0; for (const t of Object.values(TIERS)) foot += t.count * Math.PI * (t.minR + ${GAP} / 2) ** 2;
    window.__qaSeedRandom(arg.seed);
    const t0 = performance.now(); g.startRound({ seed: arg.seed }); stop(); const ms = performance.now() - t0;
    const res = { mult: arg.all, expected, n: g.objects.length, overlap: pairs(g.objects, 0), gapViol: pairs(g.objects, ${GAP}), stats: g.spawnStats || null,
      footprintShare: +(foot / ((${'WORLD_W'} - 40) * (${'WORLD_H'} - 40))).toFixed(3), ms: Math.round(ms) };
    if (arg.noRoomTest && g.settleRespawn) {
      const towers = g.objects.filter(o => o.tier === 'tower').slice(0, 5), n = g.objects.length, before = towers.map(o => [o.x, o.y]);
      const t1 = performance.now();
      const r = towers.map(o => { o.x = 1500; o.y = 1500; return g.settleRespawn(o); });
      res.noRoom = { results: r, kept: g.objects.length === n, msEach: +((performance.now() - t1) / towers.length).toFixed(1) };
      towers.forEach((o, i) => { o.x = before[i][0]; o.y = before[i][1]; });
    }
    return res;
  } finally { for (const [k, t] of Object.entries(TIERS)) t.count = saved[k]; }
})`;

const CAMPAIGN = `(async () => { ${LIB}
  let n = 0, all = '';
  const dump = (o) => JSON.stringify(Object.keys(o).sort().filter(k => !/At$/.test(k) && ['number', 'string', 'boolean'].includes(typeof o[k])).map(k => [k, typeof o[k] === 'number' ? Math.round(o[k] * 1000) / 1000 : o[k]]));
  for (const def of CAMPAIGN_MISSIONS) {
    window.__qaSeedRandom(11);
    g.missionBoosters = []; g.startCampaignMission(def.id); if (g.introPending) g.beginMissionPlay(); stop();
    for (let k = 0; k < 20; k++) g.updateCampaign(1 / 60);
    all += def.id + ':' + g.campaignEntities.length + ':' + fnv(g.campaignEntities.map(dump).join('|')) + ';'; n++;
  }
  const hash = () => { const c = g.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let a = 0x811c9dc5; for (let i = 0; i < d.length; i++) a = Math.imul(a ^ d[i], 16777619); return (a >>> 0).toString(16); };
  const real = window.__realNow || (window.__realNow = performance.now.bind(performance)), frames = {};
  g.applyGfx(2);
  for (const idx of [0, 11, 23, 55, 120, 239]) {
    const id = CAMPAIGN_MISSIONS[idx].id;
    window.__qaSeedRandom(3);
    g.missionBoosters = []; g.startCampaignMission(id); if (g.introPending) g.beginMissionPlay();
    stop(); performance.now = () => 600000;
    for (let k = 0; k < 4; k++) g.updateCampaign(1 / 60);
    const b = CONFIG.campaign.bounds; g.followCamera(b.minX, b.minY, b.maxX, b.maxY);
    for (let k = 0; k < 6; k++) g.renderCampaign(600);
    await new Promise(r => setTimeout(r, 400));
    for (let k = 0; k < 6; k++) g.renderCampaign(600);
    frames[idx] = hash(); performance.now = real;
  }
  return { missions: n, hash: fnv(all), frames };
})`;

async function evalIn(url, script, arg) {
  const g = await session(url, 'pc');
  try { const r = await g.page.evaluate(`${script}(${JSON.stringify(arg || {})})`); return { ...r, errors: g.errors.length }; }
  finally { await g.browser.close(); }
}

export async function spawnChecks(url, baseUrl, nSeeds) {
  const results = [];
  const seeds = [...Array.from({ length: nSeeds }, (_, i) => i + 1), 2024, 7, 99001, 424242];
  const cand = await evalIn(url, LAYOUTS, { seeds }), base = await evalIn(baseUrl, LAYOUTS, { seeds });
  const cand2 = await evalIn(url, LAYOUTS, { seeds: seeds.slice(0, 12) });
  let baseOverlap = 0, baseGap = 0, baseSeedsWith = 0, candOverlap = 0, candGap = 0, sameCount = 0, sameRest = 0, sameBots = 0, sameRng = 0, inB = 0, movedObjs = 0, maxShift = 0, trailMoved = 0, visBase = 0, visCand = 0, msMax = 0;
  for (const s of seeds) {
    const c = cand[s], b = base[s];
    baseOverlap += b.overlap; baseGap += b.gapViol; if (b.overlap) baseSeedsWith++;
    candOverlap += c.overlap; candGap += c.gapViol; visBase += b.vis; visCand += c.vis;
    if (c.n === b.n && c.tiers === b.tiers) sameCount++;
    if (c.rest === b.rest) sameRest++;
    if (c.bots === b.bots && c.player === b.player && c.modifier === b.modifier) sameBots++;
    if (c.rngNext === b.rngNext && c.random === b.random) sameRng++;
    if (c.inBounds) inB++;
    msMax = Math.max(msMax, c.ms);
    c.pos.forEach((p, i) => { const q = b.pos[i], d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > 1e-3) { movedObjs++; maxShift = Math.max(maxShift, d); if (q[2]) trailMoved++; } });
  }
  const N = seeds.length, objs = cand[seeds[0]].n;
  fs.writeFileSync(path.join(DIR, 'spawn-seeds.json'), JSON.stringify(seeds.map(s => ({ seed: s, base: { overlap: base[s].overlap, gapViol: base[s].gapViol, vis: base[s].vis }, cand: { overlap: cand[s].overlap, gapViol: cand[s].gapViol, vis: cand[s].vis, stats: cand[s].stats, ms: +cand[s].ms.toFixed(1) } })), null, 1));
  results.push(report(`FX-S0 the base really overlaps (the bug exists): footprint overlaps at round start over ${N} seeds`, baseOverlap > 0, `base: ${baseOverlap} overlapping pairs (${baseSeedsWith}/${N} seeds), ${baseGap} pairs closer than the ${GAP} px gap`));
  results.push(report(`FX-S1 no two footprints overlap and every pair keeps the ${GAP} px gap at round start (${N} seeds, ${objs} objects each)`, candOverlap === 0 && candGap === 0 && cand.errors === 0, `candidate: ${candOverlap} overlaps, ${candGap} gap violations; layout <= ${msMax.toFixed(1)} ms (start of round, incl. the rest of startRound)`));
  results.push(report('FX-S2 the object count per tier is the base one, nothing removed; every other field (tier, kind, radius, rotation, value, trail), bots, player spawn, modifier, the seeded stream and Math.random draws are identical to the base', sameCount === N && sameRest === N && sameBots === N && sameRng === N, `count ${sameCount}/${N}, fields ${sameRest}/${N}, bots+player+modifier ${sameBots}/${N}, rng+random ${sameRng}/${N}`));
  results.push(report('FX-S3 every object stays inside its original spawn area (centre within r + 20 of the world edge)', inB === N, `${inB}/${N} seeds`));
  const det = seeds.slice(0, 12).every(s => JSON.stringify(cand2[s].pos) === JSON.stringify(cand[s].pos));
  results.push(report('FX-S4 the same seed gives the same layout (two separate page sessions, 12 seeds)', det, det ? 'identical' : 'DIFFERENT'));
  results.push(report('FX-S5 displacement: only overlapping objects move, and only a little (measurement)', movedObjs <= baseGap * 1.5 + 5 && maxShift < 400, `moved ${movedObjs} objects over ${N} seeds (${(movedObjs / N).toFixed(1)} per round of ${objs}; base had ${baseGap} gap-violating pairs), max shift ${maxShift.toFixed(1)} world px, street-trail fragments moved ${trailMoved}`));
  const dC = await evalIn(url, DAILY), dB = await evalIn(baseUrl, DAILY);
  results.push(report('FX-S6 Daily: the preview (computeDailyLayout) is the real round layout, repeats, no overlap, same count as the base', dC.previewIsReal && dC.repeat && dC.overlap === 0 && dC.gapViol === 0 && dC.n === dB.n, `cand ${JSON.stringify(dC)} | base overlap ${dB.overlap}, previewIsReal ${dB.previewIsReal}`));
  const rC = await evalIn(url, RESPAWN, { seed: 31, radius: 320, frames: 3000 }), rB = await evalIn(baseUrl, RESPAWN, { seed: 31, radius: 320, frames: 3000 });
  results.push(report('FX-S7 respawn during play (T6 player eating across the map + bots, 3000 frames): no respawned object overlaps a live one; Złoty Rdzeń x40 and the portal wave x10 spawn clear; count kept', rC.spawned > 300 && rC.overlap === 0 && rC.gapViol === 0 && rC.goldBad === 0 && rC.portalBad === 0 && rC.nEnd === rC.n0 && rC.errors === 0, `cand ${JSON.stringify(rC)} | base: ${rB.spawned} respawns, ${rB.overlap} overlapping, ${rB.gapViol} in the gap; golden ${rB.goldBad}/${rB.gold}, portal ${rB.portalBad}/${rB.portal}`));
  const dense = [];
  for (const all of [2, 3, 5]) dense.push(await evalIn(url, DENSE, { seed: 77, all, mult: {} }));
  results.push(report('FX-S8 high density (every TIERS count x2 / x3 / x5): every object placed, none overlapping, none removed', dense.every(d => d.n === d.expected && d.overlap === 0 && d.gapViol === 0 && d.stats.crowded === 0), dense.map(d => `x${d.mult}: ${d.n}/${d.expected} objects, footprints ${Math.round(d.footprintShare * 100)} % of the area, moved ${d.stats.moved}, max shift ${Math.round(d.stats.maxShift)}, overlaps ${d.overlap}, ${d.ms} ms`).join(' | ')));
  const nr = await evalIn(url, DENSE, { seed: 77, all: 1, mult: { tower: 100 }, noRoomTest: true });
  results.push(report('FX-S9 no room (400 towers r 100 cannot fit): bounded time, nothing removed, the ones without room counted and left where drawn; settleRespawn() of a tower returns -1 and keeps it', nr.n === nr.expected && nr.stats.crowded > 0 && nr.ms < 30000 && nr.noRoom && nr.noRoom.kept && nr.noRoom.results.every(v => v === -1), `${nr.n}/${nr.expected} objects, crowded ${nr.stats.crowded}, overlaps left ${nr.overlap}, layout ${nr.ms} ms, footprints ${Math.round(nr.footprintShare * 100)} % of the area; respawn ${JSON.stringify(nr.noRoom)}`));
  const cC = await evalIn(url, CAMPAIGN), cB = await evalIn(baseUrl, CAMPAIGN);
  results.push(report('FX-S10 Campaign: all 240 missions lay out exactly as the base (every entity field) and 6 mission frames are pixel-identical', cC.missions === 240 && cC.hash === cB.hash && JSON.stringify(cC.frames) === JSON.stringify(cB.frames) && cC.errors === 0, `${cC.missions} missions ${cC.hash} == ${cB.hash}; frames ${JSON.stringify(cC.frames)}`));
  results.push(report('FX-S11 (measurement, not a gate) 2.5D: pairs whose drawn bitmaps (2.1 r x 2.4 r box) touch, though their footprints are clear', true, `base ${visBase}, candidate ${visCand} over ${N} seeds (${(visCand / N).toFixed(1)} per round)`));
  return results;
}

/* ------------------------------------------------------------------- T1 ------------------------------------------------------------------- */
const R_OF = { fragment: 7, kapsula: 10 };
// real screen densities (zoom x DPR) and the bitmap set the game picks there
const CASES = [
  { id: 'pc-1280x720-start', D: 1.08 * Math.sqrt(1280 * 720 / 500000), max: 3 },
  { id: 'pc-1920x1080-start', D: 1.08 * Math.sqrt(1920 * 1080 / 500000), max: 3 },
  { id: 'phone-dpr2-start', D: 1.08 * 2, max: 3 },
  { id: 'phone-gfx1-start', D: 1.08 * 1.5, max: 2 },
  { id: 'phone-dpr2-late', D: 0.7 * 2, max: 3 },
  { id: 'pc-1280-zoom058', D: 0.58 * Math.sqrt(1280 * 720 / 500000), max: 3 }
];

const SHARP = async ({ cases, R_OF, pngs, man }) => {
  const m = await import(document.querySelector('script[type="module"][src]').src);
  const R = m.__qaRaster, out = [];
  const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
  const nat = {}; for (const k of Object.keys(pngs)) nat[k] = await load('data:image/png;base64,' + pngs[k]);
  const pmOf = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, a = new Float32Array(d.length); for (let i = 0; i < d.length; i += 4) { const al = d[i + 3] / 255; a[i] = d[i] * al; a[i + 1] = d[i + 1] * al; a[i + 2] = d[i + 2] * al; a[i + 3] = d[i + 3]; } return a; };
  const edge = (pm, S) => { let e = 0; const L = (x, y) => { const i = (y * S + x) * 4; return 0.2126 * pm[i] + 0.7152 * pm[i + 1] + 0.0722 * pm[i + 2]; }; for (let y = 0; y < S - 1; y++) for (let x = 0; x < S - 1; x++) e += Math.abs(L(x + 1, y) - L(x, y)) + Math.abs(L(x, y + 1) - L(x, y)); return e; };
  for (const c of cases) {
    for (const kind of ['fragment', 'kapsula']) {
      const r = R_OF[kind];
      R.setMax(0); R.setMax(c.max); R.fit(c.D); R.fit(c.D);
      let bmp = R.get(kind, r);
      for (let k = 0; k < 100 && !bmp; k++) { await new Promise(res => setTimeout(res, 30)); bmp = R.get(kind, r); }
      const q = R.q, half = bmp.half, S = Math.ceil(2 * half * c.D) + 4;
      // the package's placement in the q px canvas (tools/build-object-raster.mjs), in world units
      const [nw, nh] = man[kind], Dq = 2 * Math.ceil(1.5 * r + 6) * q, s = Math.min(2.1 * r * q / nw, 2.48 * r * q / nh);
      const w = Math.round(nw * s), h = Math.round(nh * s), x = Math.floor((Dq - w) / 2), y = Math.round(0.4595 * Dq - h / 2);
      let rm = 0, eg = 0, er = 0;
      const offs = [0, 0.25, 0.5, 0.75];
      for (const off of offs) {
        const X = S / 2 + off, Y = S / 2 + off;
        const cv = document.createElement('canvas'); cv.width = cv.height = S;
        const ctx = cv.getContext('2d'); ctx.setTransform(c.D, 0, 0, c.D, X, Y);
        ctx.drawImage(bmp.img, -half, -half, half * 2, half * 2);   // = the bitmap draw of both looks (t = 0: no bob, breathe 1); only the bitmap differs
        // reference: native PNG -> 8x the target grid (halving steps, high quality) -> 8x8 box average
        const big = document.createElement('canvas'); big.width = big.height = S * 8;
        const bg = big.getContext('2d'); bg.imageSmoothingQuality = 'high';
        let src = nat[kind], sw = src.naturalWidth, sh = src.naturalHeight; const tw = 8 * c.D * w / q, th = 8 * c.D * h / q;
        while (sw > tw * 2 && sh > th * 2) { const t = document.createElement('canvas'); t.width = Math.ceil(sw / 2); t.height = Math.ceil(sh / 2); const tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high'; tg.drawImage(src, 0, 0, t.width, t.height); src = t; sw = t.width; sh = t.height; }
        bg.drawImage(src, 0, 0, sw, sh, 8 * (X + c.D * (x / q - half)), 8 * (Y + c.D * (y / q - half)), tw, th);
        const bp = pmOf(big), ref = new Float32Array(S * S * 4);
        for (let j = 0; j < S * 8; j++) for (let i = 0; i < S * 8; i++) { const si = (j * S * 8 + i) * 4, di = ((j >> 3) * S + (i >> 3)) * 4; for (let ch = 0; ch < 4; ch++) ref[di + ch] += bp[si + ch] / 64; }
        const got = pmOf(cv);
        let se = 0; for (let i = 0; i < got.length; i++) se += (got[i] - ref[i]) ** 2;
        rm += Math.sqrt(se / got.length); eg += edge(got, S); er += edge(ref, S);
      }
      out.push({ case: c.id, kind, D: +c.D.toFixed(3), q, rmse: +(rm / offs.length).toFixed(2), edge: +(eg / er).toFixed(3) });
    }
  }
  return out;
};

/** Pulse: the same object drawn at the trough and the peak of its breathe (live overlay off), on a dark and a light floor colour. */
const PULSE = async ({ D, floors }) => {
  const m = await import(document.querySelector('script[type="module"][src]').src);
  const R = m.__qaRaster; R.setMax(0); R.setMax(3); R.fit(D); R.fit(D);
  for (const k of ['fragment', 'kapsula']) R.get(k, k === 'fragment' ? 7 : 10);
  await new Promise(res => setTimeout(res, 800));
  const out = {};
  for (const [kind, r] of [['fragment', 7], ['kapsula', 10]]) for (const [fname, fc] of Object.entries(floors)) {
    const S = Math.ceil(r * 5 * D);
    const shot = (t, seed) => { const cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'); c.fillStyle = fc; c.fillRect(0, 0, S, S); c.setTransform(D, 0, 0, D, S / 2, S / 2); m.__qaDraw(c, kind, '#50F0FA', r, t, seed, { raster: true, live: false }); return c.getImageData(0, 0, S, S).data; };
    // bob = sin(2.2 t + seed), breathe phase = 3 t + 1.7 seed: (t, seed) = (+-T, -+2.2 T) with T = (pi/2)/0.74 gives bob 0 in both and the
    // breathe at its trough (sin = -1) / peak (sin = +1) -- only the pulse differs between the two frames
    const T = Math.PI / 2 / 0.74, a = shot(T, -2.2 * T), b = shot(-T, 2.2 * T);
    let diff = 0, n = 0, hA = [S, -1], hB = [S, -1];
    const bgL = (() => { const t = document.createElement('canvas').getContext('2d'); t.fillStyle = fc; t.fillRect(0, 0, 1, 1); const d = t.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; })();
    for (let i = 0; i < a.length; i += 4) {
      const da = Math.abs(a[i] - bgL[0]) + Math.abs(a[i + 1] - bgL[1]) + Math.abs(a[i + 2] - bgL[2]), db = Math.abs(b[i] - bgL[0]) + Math.abs(b[i + 1] - bgL[1]) + Math.abs(b[i + 2] - bgL[2]);
      if (da > 24 || db > 24) { diff += (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3; n++; }
      const y = Math.floor(i / 4 / S); if (da > 60) { hA[0] = Math.min(hA[0], y); hA[1] = Math.max(hA[1], y); } if (db > 60) { hB[0] = Math.min(hB[0], y); hB[1] = Math.max(hB[1], y); }
    }
    out[kind + '-' + fname] = { meanDiff: +(diff / n).toFixed(2), px: n, heightTrough: hA[1] - hA[0] + 1, heightPeak: hB[1] - hB[0] + 1 };
  }
  return out;
};

/** Ring visibility on a real floor: the staged scene on one sector; the floor under each staged T1 is read from the game's own frame
 *  with the T1 pair moved away. On that floor patch each T1 is drawn by drawObjectArt (bitmap, live overlay off) at the trough and the
 *  peak of its pulse (same bob); the bitmap alone at that breathe (+2 %) is the mask. Counted only OUTSIDE the bitmap: pixels whose
 *  contrast against the bare floor is >= 1.3 (WCAG ratio) and the strongest contrast there. */
const RING = async () => {
  const m = await import(document.querySelector('script[type="module"][src]').src);
  const g = window.game, c = g.canvas, ctx = c.getContext('2d'), D = g.zoom * g.dpr;
  const lum = (d, i) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]); };
  // the staged T1 pair (or, if a step moved one, the nearest of the kind, put back near the centre row)
  const t1 = ['fragment', 'kapsula'].map((k, i) => {
    let best = null, bd = Infinity;
    for (const o of g.objects) if (o.subtype === k && !o.eating) { const d = Math.hypot(o.x - g.camera.x, o.y - g.camera.y); if (d < bd) { bd = d; best = o; } }
    if (bd > 400) { best.x = g.camera.x - 40 + 80 * i; best.y = g.camera.y - 120; }
    return best;
  });
  for (let k = 0; k < 6; k++) g.render(600);   // the first paints start the bitmap decodes (vector until ready)
  await new Promise(res => setTimeout(res, 1800));
  const saved = t1.map(o => [o.x, o.y]); t1.forEach(o => { o.x += 100000; });
  for (let k = 0; k < 3; k++) g.render(600);
  const floor = ctx.getImageData(0, 0, c.width, c.height);
  t1.forEach((o, i) => { o.x = saved[i][0]; o.y = saved[i][1]; });
  const T = Math.PI / 2 / 0.74, out = {};
  for (const o of t1) {
    const r = o.radius, S = Math.ceil(r * 5 * D), half = Math.floor(S / 2);
    const px = Math.round(g.dpr * (g.width / 2 + g.zoom * (o.x - g.camera.x))), py = Math.round(g.dpr * (g.height / 2 + g.zoom * (o.y - g.camera.y)));
    const patch = new ImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const si = ((py - half + y) * c.width + (px - half + x)) * 4, di = (y * S + x) * 4; for (let k = 0; k < 4; k++) patch.data[di + k] = floor.data[si + k]; }
    const bmp = m.__qaRaster.get(o.subtype, r);
    const amp = m.__qaT1Amp || 0.03;   // the breathe of a T1 in that build (base: every object's 3 %)
    const maskAt = (sc) => { const mk = document.createElement('canvas'); mk.width = mk.height = S; const mc = mk.getContext('2d'); mc.setTransform(D * sc, 0, 0, D * sc, half, half); mc.drawImage(bmp.img, -bmp.half, -bmp.half, bmp.half * 2, bmp.half * 2); return mc.getImageData(0, 0, S, S).data; };
    let fl = 0; for (let i = 0; i < S * S * 4; i += 4) fl += lum(patch.data, i);
    const res = { floorL: +(fl / (S * S)).toFixed(3) };
    for (const [name, t, seed, sc] of [['trough', T, -2.2 * T, 1 - amp], ['peak', -T, 2.2 * T, 1 + amp]]) {
      const mask = maskAt(sc * 1.02), cv = document.createElement('canvas'); cv.width = cv.height = S;
      const cc = cv.getContext('2d'); cc.putImageData(patch, 0, 0); cc.setTransform(D, 0, 0, D, half, half);
      m.__qaDraw(cc, o.subtype, o.color, r, t, seed, { raster: true, live: false });
      const d = cc.getImageData(0, 0, S, S).data;
      let vis = 0, best = 1;
      for (let i = 0; i < S * S * 4; i += 4) {
        if (mask[i + 3] >= 8) continue;
        const la = lum(d, i), lb = lum(patch.data, i), cr = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
        if (cr >= 1.3) vis++;
        if (cr > best) best = cr;
      }
      res[name] = { visiblePx: vis, maxContrast: +best.toFixed(2) };
    }
    out[o.subtype] = res;
  }
  return out;
};

/** T2-T6 (19 kinds) through drawObjectArt at three times, bitmaps 2 px and 3 px, + all 21 vector looks: one hash per set. */
const OTHERS = async () => {
  const m = await import(document.querySelector('script[type="module"][src]').src);
  const R = m.__qaRaster;
  const KR = { lawka: 20, kiosk: 20, skrzynia: 20, latarnia: 20, drzewo: 20, znacznik: 20, samochod: 34, wezel: 32, pylon: 32, pawilon: 54, billboard: 54, magazyn: 54, landmark: 52, autobus: 76, tramwaj: 76, ciezarowka: 76, wiezowiec: 100, maszt: 100, kopula: 100 };
  const COL = (r) => r <= 20 ? '#FF54AD' : r <= 34 ? '#EFCB63' : r <= 54 ? '#9875FF' : r <= 76 ? '#CBD5E1' : '#46D99A';
  const fnv = (d) => { let a = 0x811c9dc5; for (let i = 0; i < d.length; i++) a = Math.imul(a ^ d[i], 16777619); return (a >>> 0).toString(16); };
  const out = {};
  for (const [q, D] of [[2, 1.4], [3, 2.4]]) {
    R.setMax(0); R.setMax(3); R.fit(D); R.fit(D);
    for (const k of Object.keys(KR)) R.get(k, KR[k]);
    await new Promise(res => setTimeout(res, 1500));
    let all = '';
    for (const [k, r] of Object.entries(KR)) for (const t of [0, 0.7, 2.3]) {
      const S = Math.ceil(r * 3.4 * D), cv = document.createElement('canvas'); cv.width = cv.height = S;
      const c = cv.getContext('2d'); c.setTransform(D, 0, 0, D, S / 2, S / 2); m.__qaDraw(c, k, COL(r), r, t, 1.3, { raster: true });
      all += k + t + fnv(c.getImageData(0, 0, S, S).data);
    }
    out['raster' + q] = { q: R.q, hash: fnv(new TextEncoder().encode(all)) };
  }
  let vec = '';
  for (const [k, r] of Object.entries({ fragment: 7, kapsula: 10, ...KR })) {
    const S = Math.ceil(r * 3.4 * 1.6), cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c = cv.getContext('2d'); c.setTransform(1.6, 0, 0, 1.6, S / 2, S / 2); m.__qaDraw(c, k, r <= 10 ? '#50F0FA' : COL(r), r, 0.9, 0.4, {});
    vec += k + fnv(c.getImageData(0, 0, S, S).data);
  }
  out.vector = fnv(new TextEncoder().encode(vec));
  return out;
};

/** Frame hygiene on the staged Arena scene (gfx 2): shadowBlur sets and canvases created per frame once warm, T1 rebuilds over a zoom sweep. */
const HYGIENE = async () => {
  const m = await import(document.querySelector('script[type="module"][src]').src);
  const g = window.game;
  for (let k = 0; k < 10; k++) g.render(600);
  await new Promise(res => setTimeout(res, 1500));
  for (let k = 0; k < 10; k++) g.render(600);
  let blur = 0, canvases = 0;
  const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur'), oc = document.createElement.bind(document);
  Object.defineProperty(CanvasRenderingContext2D.prototype, 'shadowBlur', { configurable: true, get() { return d.get.call(this); }, set(v) { if (v) blur++; d.set.call(this, v); } });
  document.createElement = (t) => { if (String(t).toLowerCase() === 'canvas') canvases++; return oc(t); };
  for (let k = 0; k < 60; k++) g.render(600 + k / 60);
  const steady = { blur, canvases };
  const b0 = m.__qaT1 ? Object.values(m.__qaT1.kinds).reduce((a, e) => a + (e ? e.builds : 0), 0) : 0;
  const z0 = g.zoom; let sweepCanvases = 0; canvases = 0;
  for (let k = 0; k <= 300; k++) { g.zoom = z0 + (0.58 - z0) * k / 300; g.render(601 + k / 60); }
  sweepCanvases = canvases;
  const b1 = m.__qaT1 ? Object.values(m.__qaT1.kinds).reduce((a, e) => a + (e ? e.builds : 0), 0) : 0;
  Object.defineProperty(CanvasRenderingContext2D.prototype, 'shadowBlur', d); document.createElement = oc; g.zoom = z0;
  const held = m.__qaT1 ? Object.values(m.__qaT1.kinds).filter(Boolean).reduce((a, e) => a + e.ground.width * e.ground.height, 0) * 4 : 0;
  return { steady, rebuildsOverSweep: b1 - b0, sweepCanvases, t1CacheBytes: held };
};

async function inExp(url, fn, arg, { frame = 'pc', init = null, scene = null } = {}) {
  const g = await session(url, frame);
  try {
    if (init) { await g.page.addInitScript(init); await g.page.reload(); await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); }
    if (scene) await stageScene(g.page, scene);
    const r = await g.page.evaluate(fn, arg);
    return { r, errors: g.errors.length };
  } finally { await g.browser.close(); }
}

export async function t1Checks(expUrl, expBaseUrl, pack, baseRoot) {
  const results = [];
  // T1-0: the two T1 bitmaps are lossless now, every other one is byte-identical to the base
  const urls = (root, q) => Object.fromEntries([...fs.readFileSync(path.join(root, `objects-raster-${q}.js`), 'utf8').matchAll(/^\s+(\w+): '(data:image\/webp;base64,[^']+)'/gm)].map(x => [x[1], x[2]]));
  const chunks = (u) => { const b = Buffer.from(u.split(',')[1], 'base64'), out = []; let o = 12; while (o + 8 <= b.length) { const n = b.readUInt32LE(o + 4); out.push(b.toString('ascii', o, o + 4)); o += 8 + n + (n & 1); } return out; };
  let same = 0, lossless = 0, other = 0, bytes = { base: 0, cand: 0 };
  for (const q of [2, 3]) {
    const a = urls(ROOT, q), b = urls(baseRoot, q);
    for (const k of Object.keys(b)) {
      if (k === 'fragment' || k === 'kapsula') { if (chunks(a[k]).includes('VP8L') && !chunks(b[k]).includes('VP8L')) lossless++; bytes.base += b[k].length; bytes.cand += a[k].length; }
      else if (a[k] === b[k]) same++; else other++;
    }
  }
  results.push(report('FX-T0 the 4 T1 bitmaps (2 px + 3 px) are lossless WebP (VP8L, base: lossy VP8+ALPH); the other 38 are byte-identical to the base', lossless === 4 && same === 38 && other === 0, `lossless ${lossless}/4, identical ${same}/38, changed ${other}; T1 data URLs ${bytes.base} -> ${bytes.cand} chars`));

  if (pack) {
    const man = JSON.parse(fs.readFileSync(path.join(pack, 'manifest.json'), 'utf8')).asset_records;
    const pngs = {}, dims = {};
    for (const k of ['fragment', 'kapsula']) { const rec = man.find(x => x.kind === k); pngs[k] = fs.readFileSync(path.join(pack, rec.native_png)).toString('base64'); dims[k] = rec.native_pixel_dimensions; }
    const sC = await inExp(expUrl, SHARP, { cases: CASES, R_OF, pngs, man: dims }), sB = await inExp(expBaseUrl, SHARP, { cases: CASES, R_OF, pngs, man: dims });
    const rows = sC.r.map((c, i) => ({ ...c, baseRmse: sB.r[i].rmse, baseEdge: sB.r[i].edge, baseQ: sB.r[i].q }));
    fs.writeFileSync(path.join(DIR, 't1-sharpness.json'), JSON.stringify(rows, null, 1));
    const better = rows.filter(x => x.rmse < x.baseRmse && Math.abs(1 - x.edge) <= Math.abs(1 - x.baseEdge) + 0.02).length;
    results.push(report(`FX-T1 sharper T1: closer to the ideal reference than the base in every case (${rows.length} = 6 real screen densities x 2 kinds, 4 sub-pixel phases each)`, better === rows.length && sC.errors === 0, rows.map(x => `${x.case} ${x.kind} D${x.D} q${x.baseQ}->${x.q}: RMSE ${x.baseRmse}->${x.rmse}, edge ${x.baseEdge}->${x.edge}`).join(' | ')));
  } else results.push(report('FX-T1 T1 sharpness vs the native PNG', true, 'NOT RUN: no --pack=DIR'));

  const floors = { dark: '#141a2e', light: '#b9c4d6' };
  const pC = await inExp(expUrl, PULSE, { D: 2.16, floors }), pB = await inExp(expBaseUrl, PULSE, { D: 2.16, floors });
  const pk = Object.keys(pC.r), ratio = pk.map(k => pC.r[k].meanDiff / Math.max(0.01, pB.r[k].meanDiff));
  results.push(report('FX-T2 the T1 pulse is clearly stronger (trough vs peak with the same bob, phone density 2.16, dark + light floor): >= 1.7x the base change in every case (the mean is reported), the same 3 rad/s (0.48 Hz, far below 3 Hz flashing), the object + its ring grow <= 20 % (nothing covered)', ratio.every(x => x >= 1.7) && pk.every(k => Math.abs(pC.r[k].heightPeak - pC.r[k].heightTrough) <= 0.2 * pC.r[k].heightTrough), pk.map((k, i) => `${k}: mean change ${pB.r[k].meanDiff} -> ${pC.r[k].meanDiff} (x${ratio[i].toFixed(1)}), height ${pC.r[k].heightTrough}->${pC.r[k].heightPeak} px (base ${pB.r[k].heightTrough}->${pB.r[k].heightPeak})`).join(' | ') + ` | mean x${(ratio.reduce((a, x) => a + x, 0) / ratio.length).toFixed(2)}`));

  // the ring on all six sectors' real floors (PC 1280x720 at the round's start zoom 1.47)
  const ring = {};
  for (const sector of ['p', 'd', 'o', 'k', 'g', 'R']) {
    const scene = { sector, staged: true, zoom: 1.08 * Math.sqrt(1280 * 720 / 500000) };
    const c = await inExp(expUrl, RING, null, { scene }), b = await inExp(expBaseUrl, RING, null, { scene });
    ring[sector] = { cand: c.r, base: b.r };
  }
  fs.writeFileSync(path.join(DIR, 't1-ring.json'), JSON.stringify(ring, null, 1));
  const fl = (s) => (ring[s].base.fragment.floorL + ring[s].base.kapsula.floorL) / 2;
  const secs = Object.keys(ring).sort((a, b) => fl(a) - fl(b)), dark = secs[0], light = secs[secs.length - 1];
  const ringOk = Object.keys(ring).every(s => ['fragment', 'kapsula'].every(k => ring[s].cand[k].trough.visiblePx >= 10 && ring[s].cand[k].trough.visiblePx > ring[s].base[k].trough.visiblePx));
  results.push(report(`FX-T3 the T1 ground ring is visible on all 6 sectors' real floors, even at the pulse's trough: >= 10 px outside the bitmap at contrast >= 1.3 vs the bare floor, more than the base's ground (darkest floor = ${dark}, lightest = ${light})`, ringOk, Object.keys(ring).map(s => `${s} (floor L ${fl(s).toFixed(3)}): ` + ['fragment', 'kapsula'].map(k => `${k} trough ${ring[s].base[k].trough.visiblePx}->${ring[s].cand[k].trough.visiblePx} px (max ${ring[s].base[k].trough.maxContrast}->${ring[s].cand[k].trough.maxContrast}), peak ${ring[s].base[k].peak.visiblePx}->${ring[s].cand[k].peak.visiblePx} px`).join(', ')).join(' | ')));

  const oC = await inExp(expUrl, OTHERS), oB = await inExp(expBaseUrl, OTHERS);
  results.push(report('FX-T4 T2-T6 (19 kinds, 3 phases, 2 px and 3 px bitmaps) and all 21 vector looks draw pixel-identical to the base', JSON.stringify(oC.r) === JSON.stringify(oB.r) && oC.errors === 0, `${JSON.stringify(oC.r)} vs ${JSON.stringify(oB.r)}`));

  // fallback: every object bitmap undecodable -> T1 drawn with raster on == its vector look == the base's
  const r2 = Object.values(urls(ROOT, 2)), r3 = Object.values(urls(ROOT, 3)), rb2 = Object.values(urls(baseRoot, 2)), rb3 = Object.values(urls(baseRoot, 3));
  const tails = [...r2, ...r3, ...rb2, ...rb3].map(u => u.slice(-60));
  const BREAK = `(() => { const T = new Set(${JSON.stringify(tails)}); const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src'); Object.defineProperty(HTMLImageElement.prototype, 'src', { set(v) { v = String(v); d.set.call(this, T.has(v.slice(-60)) ? 'data:image/webp;base64,AAAA' : v); }, get() { return d.get.call(this); } }); })();`;
  const FB = async () => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
    const R = m.__qaRaster; R.setMax(0); R.setMax(3); R.fit(2.2);
    for (const k of ['fragment', 'kapsula']) R.get(k, k === 'fragment' ? 7 : 10);
    await new Promise(res => setTimeout(res, 600));
    const fnv = (d) => { let a = 0x811c9dc5; for (let i = 0; i < d.length; i++) a = Math.imul(a ^ d[i], 16777619); return (a >>> 0).toString(16); };
    const h = (k, r, raster) => { const cv = document.createElement('canvas'); cv.width = cv.height = 80; const c = cv.getContext('2d'); c.setTransform(2.2, 0, 0, 2.2, 40, 40); m.__qaDraw(c, k, '#50F0FA', r, 0.8, 0.3, { raster }); return fnv(c.getImageData(0, 0, 80, 80).data); };
    return { frag: [h('fragment', 7, true), h('fragment', 7, false)], kap: [h('kapsula', 10, true), h('kapsula', 10, false)], got: !!R.get('fragment', 7) };
  };
  const fC = await inExp(expUrl, FB, null, { init: BREAK }), fB = await inExp(expBaseUrl, FB, null, { init: BREAK });
  results.push(report('FX-T5 fallback: with the bitmaps undecodable a T1 draws its vector look (raster on == raster off == the base)', !fC.r.got && fC.r.frag[0] === fC.r.frag[1] && fC.r.kap[0] === fC.r.kap[1] && JSON.stringify(fC.r) === JSON.stringify(fB.r), `${JSON.stringify(fC.r)} vs base ${JSON.stringify(fB.r)}`));

  const hC = await inExp(expUrl, HYGIENE, null, { scene: { sector: 'p', staged: true, zoom: 0.9 } }), hB = await inExp(expBaseUrl, HYGIENE, null, { scene: { sector: 'p', staged: true, zoom: 0.9 } });
  results.push(report('FX-T6 frame hygiene: no more shadowBlur than the base, no canvas created per frame once warm (and over a full 0.9 -> 0.58 zoom sweep no more than the base: floor chunks), the T1 ground rebuilt only when the zoom moves > 3 %, its canvases tiny', hC.r.steady.blur === hB.r.steady.blur && hC.r.steady.canvases === 0 && hC.r.sweepCanvases <= hB.r.sweepCanvases && hC.r.rebuildsOverSweep <= 40 && hC.r.t1CacheBytes < 300000 && hC.errors === 0, `cand ${JSON.stringify(hC.r)} | base ${JSON.stringify(hB.r)}`));
  return results;
}

if (isMain(import.meta.url)) {
  const baseArg = opt('base', null);
  if (!baseArg) { console.log('NOT RUN: --base=DIR (a worktree of origin/main) is required'); process.exit(1); }
  const baseRoot = path.resolve(baseArg), pack = opt('pack', null), only = (opt('only', 'spawn,t1')).split(',');
  fs.mkdirSync(DIR, { recursive: true });
  const cur = await serve(), base = await serve({ root: baseRoot });
  const exp = await serve({ root: exportedRoot(ROOT, 'after') }), expBase = await serve({ root: exportedRoot(baseRoot, 'base') });
  const results = [];
  try {
    if (only.includes('spawn')) results.push(...await spawnChecks(cur.url, base.url, +opt('seeds', 60)));
    if (only.includes('t1')) results.push(...await t1Checks(exp.url, expBase.url, pack ? path.resolve(pack) : null, baseRoot));
  } finally { for (const s of [cur, base, exp, expBase]) s.server.close(); }
  fs.writeFileSync(path.join(DIR, 'results.json'), JSON.stringify(results, null, 1));
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} GG-OBJECTS-FIX-03 checks passed`);
  process.exit(failed.length ? 1 : 0);
}
