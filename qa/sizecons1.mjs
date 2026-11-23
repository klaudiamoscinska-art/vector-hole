// GG-SIZE-CONSISTENCY-01 pilot test (local, both prototypes switched in the page by applySizeProto(): BEFORE = null, 'A', 'B').
//   node qa/sizecons1.mjs --base=DIR [--only=geom,gate,start,spawn,source,pace,perf] [--seeds=12] [--reps=4]
// geom   : measured vortex disc (1.07 R) vs each pilot object's long half-extent L (qa/sizecons1-measure.mjs) at the last radius that
//          still cannot eat it and at the radius that unlocks it; the share of the tier below (in growth units = pickups) in which the
//          vortex's disc is already longer than the locked object ("looks eatable, is not"). Eat reach (0.85 R, T1 1.0 R) vs the disc.
// gate   : Game.holeCanEat() just below / at each threshold (unchanged rule); variant B's Arena curve (jump at U_m, same units per tier,
//          production slope past T6), its inverse, and Campaign's radiusForUnits() untouched.
// start  : a fresh round per variant: R 18, T1, the same objects, no page error, the first bite (casual player bot).
// spawn  : 20 seeded layouts per variant: no object waiting, no two pictures or footprints overlapping (the game's spawn rule).
// source : variant off = production: the same seeded layouts and growth curve as the base checkout (byte-identical numbers).
// pace   : full 2-minute Arena rounds, casual player bot (lib.mjs ARENA_BOT, virtual time), the same seeds and the same save before every
//          round: time to T2..T6, R at 15/30/60/120 s, score, place, deaths, rivals' score and size. Reported; gates only for runaway growth.
// perf   : render() frame time, phone 390x844 DPR 2 and PC 1280x720, natural + dense staged scenes, variants alternated in one page.
// Output: qa/out/sizecons1/results.json (+ console). Exit 1 on any FAIL.
import fs from 'node:fs';
import path from 'node:path';
import { serve, report, OUT, ROOT, isMain, ARENA_BOT } from './lib.mjs';
import { session, stageScene } from './objraster2-shots.mjs';
import { exportedRoot, measurePage, DIR } from './sizecons1-measure.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
export const PILOT = { skrzynia: 2, wezel: 3, billboard: 4, kopula: 6 };
export const VARIANTS = ['BEFORE', 'A', 'B'];
const vArg = (v) => (v === 'BEFORE' ? null : v);
const RADII = [18, 20, 22, 24, 26, 28, 30, 34, 38, 40, 42, 46, 50, 54, 57, 60, 64, 66, 72, 78, 84, 90, 96, 102, 108, 112, 118];

/** Body radius (units of R) at radius R, linear between measured radii. */
const bodyAt = (M, R) => {
  const xs = Object.keys(M.hole).map(Number).sort((a, b) => a - b);
  let i = xs.findIndex(x => x >= R); if (i < 0) i = xs.length - 1; if (i === 0) return M.hole[xs[0]].body * R;
  const a = xs[i - 1], b = xs[i], fa = M.hole[a].body, fb = M.hole[b].body;
  return (fa + (fb - fa) * (R - a) / (b - a)) * R;
};
/** Radius at units u from the sampled curve of that variant. */
const rAt = (M, u) => { const c = M.curve; const i = Math.min(c.length - 1, Math.max(0, Math.floor(u / 0.5))); return c[i][1]; };

export function geomTable(all) {
  const rows = [];
  for (const v of VARIANTS) {
    const M = all[v], A = M.anchors, U = M.unitAnchors, J = M.proto.surge;
    for (const [k, o] of Object.entries(M.kinds)) {
      const m = o.minSizeTier, Am = A[m], pre = Am / J - (J === 1 ? 0.01 : 0), L = Math.max(o.halfW, o.halfH), S = Math.min(o.halfW, o.halfH);
      // share of the tier below (U[m-1]..U[m], growth units) in which the disc is longer than L
      let n = 0, bad = 0;
      for (let u = U[m - 1]; u < U[m]; u += 0.05) { n++; if (bodyAt(M, rAt(M, u)) > L) bad++; }
      let firstBad = null; for (let u = U[m - 1]; u < U[m]; u += 0.05) if (bodyAt(M, rAt(M, u)) > L) { firstBad = +u.toFixed(2); break; }
      rows.push({ variant: v, kind: k, tier: o.tier, pilot: !!PILOT[k], r: o.r, L: +L.toFixed(1), S: +S.toFixed(1), maxR: o.maxR,
        lockEndR: +pre.toFixed(2), bodyLockEnd: +bodyAt(M, pre).toFixed(1), unlockR: Am, bodyUnlock: +bodyAt(M, Am).toFixed(1),
        L_over_body_lockEnd: +(L / bodyAt(M, pre)).toFixed(3), S_over_body_lockEnd: +(S / bodyAt(M, pre)).toFixed(3),
        L_over_body_unlock: +(L / bodyAt(M, Am)).toFixed(3), maxR_over_body_unlock: +(o.maxR / bodyAt(M, Am)).toFixed(3),
        looksEatableShare: +(bad / n).toFixed(3), looksEatableFromUnits: firstBad, tierUnits: [U[m - 1], U[m]] });
    }
  }
  return rows;
}

async function gates(page) {
  return page.evaluate(async ({ PILOT, VARIANTS }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src), g = window.game;
    const out = {};
    for (const v of VARIANTS) {
      const SP = m.__qaSize(v === 'BEFORE' ? null : v);
      window.__qaSeedRandom(2024); g.startRound({ seed: 2024 }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; g.frenzyEndsAt = null;
      const A = m.CONFIG.growth.radiusAnchors, U = m.CONFIG.growth.unitAnchors, p = g.player, J = SP.surge;
      const res = { gate: [], curve: {} };
      for (const k of Object.keys(PILOT)) {
        const o = g.objects.find(x => x.subtype === k), mt = m.TIERS[o.tier].minSizeTier;
        const lockEnd = m.__qaArfu(U[mt] - 0.001);
        p.radius = lockEnd; const before = g.holeCanEat(p, o);
        p.radius = m.__qaArfu(U[mt]); const at = g.holeCanEat(p, o), atR = p.radius;
        res.gate.push({ k, tier: mt + 1, lockEnd: +lockEnd.toFixed(3), canEatBefore: before, unlockR: +atR.toFixed(3), canEatAt: at, r: o.radius });
      }
      // the curve: jump at each U_m, same anchors after the jump, production past the last anchor, inverse round trip
      const c = res.curve;
      c.pre = U.slice(1).map(u => +m.__qaArfu(u - 1e-6).toFixed(3));
      c.post = U.slice(1).map(u => +m.__qaArfu(u).toFixed(3));
      c.past = [200, 260, 400].map(u => +(m.__qaArfu(u) - m.__qaRfu(u)).toFixed(6));
      let mono = true, prev = 0, trip = 0;
      for (let u = 0; u <= 400; u += 0.25) { const r = m.__qaArfu(u); if (r < prev - 1e-9) mono = false; prev = r; if (!U.includes(u)) trip = Math.max(trip, Math.abs(m.__qaAufr(r) - u)); }
      c.monotonic = mono; c.roundTripMaxErr = +trip.toFixed(6); c.surge = J;
      c.campaign = [0, 3, 6, 14, 22, 37, 50, 80, 100, 150, 180, 230].map(u => +m.__qaRfu(u).toFixed(6));
      c.tierByUnits = [0, 5.99, 6, 21.99, 22, 49.99, 50, 99.99, 100, 179.99, 180].map(u => m.CONFIG.sizeTiers[m.getSizeTierIndex ? 0 : 0] && (() => { const r = m.__qaArfu(u); let i = 0; m.CONFIG.sizeTiers.forEach((t, j) => { if (r >= t.minRadius) i = j; }); return i + 1; })());
      // one real step: a vortex 0.001 unit short of T2 eats a fragment through Game.update() -> lands on R_2 exactly
      window.__qaSeedRandom(2024); g.startRound({ seed: 2024 }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
      const p2 = g.player; p2.radius = m.__qaArfu(U[1] - 0.5); const f = g.objects.find(o => o.tier === 'fragment');
      g.objects = [f]; f.x = p2.x; f.y = p2.y; for (const b of g.bots) { b.x = 2900; b.y = 2900; b.update = () => {}; }
      for (let i = 0; i < 40 && !f.consumed; i++) g.update(1 / 30);
      for (let i = 0; i < 4; i++) g.update(1 / 30);
      c.realStep = { expect: +m.__qaArfu(U[1] + 0.5).toFixed(3), from: +m.__qaArfu(U[1] - 0.5).toFixed(3), to: +p2.radius.toFixed(3), tier: g.lastSizeTierId, surgeFrom: p2.surgeFrom != null ? +p2.surgeFrom.toFixed(2) : null };
      out[v] = res;
    }
    m.__qaSize(null);
    return out;
  }, { PILOT, VARIANTS });
}

async function starts(page) {
  return page.addScriptTag({ content: ARENA_BOT }).then(() => page.evaluate(async ({ VARIANTS }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src), g = window.game, out = {};
    const s0 = JSON.stringify(g.save);
    for (const v of VARIANTS) {
      m.__qaSize(v === 'BEFORE' ? null : v);
      const restore = () => { const o = JSON.parse(s0); for (const k of Object.keys(g.save)) delete g.save[k]; Object.assign(g.save, o); };
      restore(); window.__qaSeedRandom(77); g.startRound({ seed: 77 }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
      const p = g.player, first = { R0: p.radius, tier: m.CONFIG.sizeTiers[m.getSizeTierIndex(p.radius)].shortId, objects: g.objects.length, bots: g.bots.length, botR: g.bots.map(b => +b.radius.toFixed(1)), crates: g.objects.filter(o => o.subtype === 'skrzynia').map(o => o.radius)[0] };
      const firsts = [];
      for (const seed of [11, 22, 33, 44, 55]) { restore(); window.__qaSeedRandom(seed); const r = window.__qaPlayArena({ style: 'casual', clock0: 1000000, noRender: true, pickCards: false, round: { seed } }); firsts.push({ seed, firstEatSec: r.firstEatSec, eats10: r.eats10 }); }
      restore();
      out[v] = { ...first, firsts };
    }
    m.__qaSize(null);
    return out;
  }, { VARIANTS }));
}

async function layouts(page, variant, seeds) {
  return page.evaluate(async ({ variant, seeds }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src), g = window.game;
    if (m.__qaSize) m.__qaSize(variant);
    const fnv = (s) => { let a = 0x811c9dc5; for (let i = 0; i < s.length; i++) a = Math.imul(a ^ s.charCodeAt(i), 16777619); return (a >>> 0).toString(16); };
    const out = [];
    for (const seed of seeds) {
      window.__qaSeedRandom(seed); g.startRound({ seed }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
      const objs = g.objects.filter(o => !o.eating);
      const box = (o) => m.__qaViewBox(o.subtype, o.radius, o.x, o.y, { l: 0, r: 0, t: 0, b: 0 });
      const B = objs.map(box); let overlaps = 0, phys = 0;
      for (let i = 0; i < objs.length; i++) for (let j = i + 1; j < objs.length; j++) {
        const a = B[i], b = B[j]; if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) overlaps++;
        const dx = objs[i].x - objs[j].x, dy = objs[i].y - objs[j].y, mm = objs[i].radius + objs[j].radius; if (dx * dx + dy * dy < mm * mm) phys++;
      }
      out.push({ seed, n: objs.length, waiting: (g.waitingObjects || []).length, overlaps, phys, hash: fnv(objs.map(o => [o.tier, o.subtype, Math.round(o.radius * 1000), Math.round(o.x * 100), Math.round(o.y * 100)].join(',')).join(';')), rng: g.rng ? g.rng.seed : null });
    }
    if (m.__qaSize) m.__qaSize(null);
    return out;
  }, { variant, seeds });
}

async function paceRounds(page, seeds, profile) {
  await page.addScriptTag({ content: ARENA_BOT });
  return page.evaluate(async ({ seeds, VARIANTS, profile }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src), g = window.game, A = m.CONFIG.growth.radiusAnchors;
    if (profile === 'nowy') { const s = m.defaultSave ? m.defaultSave() : null; if (s) { for (const k of Object.keys(g.save)) delete g.save[k]; Object.assign(g.save, s); } }
    const s0 = JSON.stringify(g.save), out = {};
    for (const v of VARIANTS) {
      m.__qaSize(v === 'BEFORE' ? null : v);
      out[v] = [];
      for (const seed of seeds) {
        const o = JSON.parse(s0); for (const k of Object.keys(g.save)) delete g.save[k]; Object.assign(g.save, o);
        window.__qaSeedRandom(seed);
        const st = { R: {}, tierAt: {}, surgesSeen: 0 };
        const res = window.__qaPlayArena({ style: 'casual', clock0: 1000000, noRender: true, pickCards: false, round: { seed }, onFrame: (f, gg) => {
          const sec = f / 30, p = gg.player;
          for (const t of [15, 30, 60, 90]) if (st.R[t] == null && sec >= t) st.R[t] = +p.radius.toFixed(1);
          for (let k = 1; k < 6; k++) if (st.tierAt['T' + (k + 1)] == null && p.radius >= A[k]) st.tierAt['T' + (k + 1)] = +sec.toFixed(1);
        } });
        st.R[120] = res.radius;
        const bots = g.bots.map(b => b.radius);
        out[v].push({ seed, score: res.score, place: res.place, deaths: res.deaths, tier: res.tier, firstEatSec: res.firstEatSec, ...st,
          topBotScore: Math.max(...g.bots.map(b => b.score)), botMeanR: +(bots.reduce((a, b) => a + b, 0) / bots.length).toFixed(1), botMaxR: +Math.max(...bots).toFixed(1), runs: res.runs });
      }
    }
    m.__qaSize(null);
    const o = JSON.parse(s0); for (const k of Object.keys(g.save)) delete g.save[k]; Object.assign(g.save, o);
    return out;
  }, { seeds, VARIANTS, profile });
}

const timeIt = (page) => page.evaluate(() => {
  const gm = window.game, real = window.__realNow || performance.now.bind(performance), t = [], flush = () => gm.ctx.getImageData(0, 0, 1, 1);
  for (let k = 0; k < 15; k++) { gm.render(k / 60); flush(); }
  for (let k = 0; k < 90; k++) { const t0 = real(); gm.render(k / 60); flush(); t.push(real() - t0); }
  t.sort((a, b) => a - b);
  return { median: +t[45].toFixed(3), p95: +t[85].toFixed(3) };
});

async function perf(url, reps) {
  const out = {};
  for (const frame of ['mobile', 'pc']) {
    const g = await session(url, frame);
    try {
      await g.page.evaluate(() => { window.__realNow = window.__realNow || performance.now.bind(performance); });
      for (const scn of ['naturalna', 'gesta']) {
        const key = `${frame}-${scn}`; out[key] = { BEFORE: [], A: [], B: [] };
        for (let rep = 0; rep < reps; rep++) {
          const order = rep % 2 ? ['B', 'A', 'BEFORE'] : ['BEFORE', 'A', 'B'];
          for (const v of order) {
            await g.page.evaluate(async (v) => { const m = await import(document.querySelector('script[type="module"][src]').src); m.__qaSize(v); }, vArg(v));
            await stageScene(g.page, { sector: 'p', staged: scn === 'gesta', zoom: 0.58, gfx: 2 });
            await g.page.evaluate(() => { for (let k = 0; k < 6; k++) window.game.render(k / 60); });
            await g.page.waitForTimeout(600);
            out[key][v].push(await timeIt(g.page));
          }
        }
        console.log('  perf', key, Object.fromEntries(Object.entries(out[key]).map(([v, a]) => [v, med(a.map(x => x.median))])));
      }
      await g.page.evaluate(async () => { const m = await import(document.querySelector('script[type="module"][src]').src); m.__qaSize(null); });
    } finally { await g.browser.close(); }
  }
  return out;
}
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return +(s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2).toFixed(3); };

/** QA root of a checkout: game.js + the exports this test reads (the base has no pilot: only the shared ones). */
function qaRoot(root, name) {
  const dir = exportedRoot(root, name), f = path.join(dir, 'game.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('const SIZE_PROTO')) s = s.replace(/, arenaRadiusForUnits as __qaArfu[^}]*\};\n$/, ' };\n');
  s += `\nexport { spawnViewBox as __qaViewBox };\n`;
  fs.writeFileSync(f, s);
  return dir;
}

export async function run({ base, only, seeds, reps }) {
  const results = { checks: [], data: {} };
  const check = (name, ok, details) => { results.checks.push({ name, ok: !!ok, details }); report(name, !!ok, ok ? undefined : JSON.stringify(details).slice(0, 900)); };
  const CAND = qaRoot(ROOT, 'cand');
  const srv = await serve({ root: CAND });
  try {
    if (only.includes('geom') || only.includes('gate') || only.includes('start') || only.includes('spawn')) {
      const g = await session(srv.url, 'pc');
      try {
        if (only.includes('geom')) {
          const all = {}; for (const v of VARIANTS) all[v] = await measurePage(g.page, RADII, vArg(v));
          const T = geomTable(all); results.data.geom = T; results.data.measure = all;
          const bodies = Object.values(all.BEFORE.hole).map(h => h.body);
          check('SC-GEOM-body: the vortex is drawn as an opaque disc 1.05-1.09 R at every radius (BEFORE = A = B)', bodies.every(b => b >= 1.05 && b <= 1.09) && VARIANTS.every(v => JSON.stringify(Object.values(all[v].hole).map(h => h.body)) === JSON.stringify(bodies)), { bodies });
          check('SC-GEOM-reach: no eat reach is past the drawn disc (objects 0.85 R, T1 fragment 1.0 R < disc)', 1.0 < Math.min(...bodies), { reach: [0.85, 1.0], disc: Math.min(...bodies) });
          const P = (v) => T.filter(r => r.variant === v && r.pilot);
          check('SC-GEOM-before: BEFORE reproduces the four cases -- the vortex disc is longer than each locked pilot object before unlock', P('BEFORE').every(r => r.L_over_body_lockEnd < 0.98 && r.looksEatableShare > 0), P('BEFORE').map(r => [r.kind, r.L_over_body_lockEnd, r.looksEatableShare]));
          for (const v of ['A', 'B']) {
            check(`SC-GEOM-${v}-locked: ${v}: a locked pilot object is never shorter than the vortex disc (L >= 0.98 disc at the last locked radius)`, P(v).every(r => r.L_over_body_lockEnd >= 0.98), P(v).map(r => [r.kind, r.L_over_body_lockEnd, r.looksEatableShare]));
          }
          check('SC-GEOM-A-unlock: A: at unlock the pilot object is as long as the disc (L 0.98-1.02 disc: fits, no margin)', P('A').every(r => r.L_over_body_unlock >= 0.98 && r.L_over_body_unlock <= 1.02), P('A').map(r => [r.kind, r.L_over_body_unlock]));
          check('SC-GEOM-B-unlock: B: at unlock the pilot object fits inside the disc (L <= 0.92 disc; the flat dome <= 0.98)', P('B').every(r => r.L_over_body_unlock <= (r.kind === 'kopula' ? 0.98 : 0.92)), P('B').map(r => [r.kind, r.L_over_body_unlock]));
        }
        if (only.includes('gate')) {
          const G = await gates(g.page); results.data.gate = G;
          check('SC-GATE-rule: every variant: a pilot object is locked at the last radius below its tier and eatable at the threshold (tier gate unchanged)', VARIANTS.every(v => G[v].gate.every(x => !x.canEatBefore && x.canEatAt)), Object.fromEntries(VARIANTS.map(v => [v, G[v].gate])));
          check('SC-GATE-B-curve: B: R jumps x1.15 at each threshold onto the production anchor, monotonic, inverse exact, production past T6', G.B.curve.post.join() === '30,46,66,90,118' && G.B.curve.pre.every((r, i) => Math.abs(r * 1.15 - G.B.curve.post[i]) < 0.01) && G.B.curve.monotonic && G.B.curve.roundTripMaxErr < 1e-6 && G.B.curve.past.every(x => x === 0), G.B.curve);
          check('SC-GATE-units: the same pickups unlock each tier (tier by growth units identical in BEFORE, A, B)', VARIANTS.every(v => G[v].curve.tierByUnits.join() === G.BEFORE.curve.tierByUnits.join()), Object.fromEntries(VARIANTS.map(v => [v, G[v].curve.tierByUnits])));
          check('SC-GATE-campaign: Campaign\'s radiusForUnits() is identical under every variant', VARIANTS.every(v => G[v].curve.campaign.join() === G.BEFORE.curve.campaign.join()), G.BEFORE.curve.campaign);
          check('SC-GATE-step: B: a fragment eaten 0.5 unit short of T2 lands the vortex on the curve past R 30 through Game.update() (tier T2, swell started)', Math.abs(G.B.curve.realStep.to - G.B.curve.realStep.expect) < 0.01 && G.B.curve.realStep.to >= 30 && G.B.curve.realStep.tier === 'pulse' && G.B.curve.realStep.surgeFrom != null && Math.abs(G.BEFORE.curve.realStep.to - G.BEFORE.curve.realStep.expect) < 0.01, { B: G.B.curve.realStep, BEFORE: G.BEFORE.curve.realStep });
        }
        if (only.includes('start')) {
          const S = await starts(g.page); results.data.start = S;
          check('SC-START: a fresh round in every variant: R 18, T1, same object and rival count as BEFORE', VARIANTS.every(v => S[v].R0 === 18 && S[v].tier === 'T1' && S[v].objects === S.BEFORE.objects && S[v].bots === S.BEFORE.bots), S);
          const fe = (v) => med(S[v].firsts.map(x => x.firstEatSec ?? 99));
          check('SC-START-bite: the first bite comes as fast as BEFORE (median within +0.3 s, casual bot, 5 seeds)', ['A', 'B'].every(v => fe(v) <= fe('BEFORE') + 0.3), { BEFORE: fe('BEFORE'), A: fe('A'), B: fe('B') });
        }
        if (only.includes('spawn')) {
          const sd = Array.from({ length: 20 }, (_, i) => 3000 + i * 7919);
          const L = {}; for (const v of VARIANTS) L[v] = await layouts(g.page, vArg(v), sd);
          results.data.spawn = Object.fromEntries(VARIANTS.map(v => [v, L[v].map(x => ({ seed: x.seed, n: x.n, waiting: x.waiting, overlaps: x.overlaps, phys: x.phys }))]));
          for (const v of VARIANTS) check(`SC-SPAWN-${v}: 20 seeded layouts: nothing waiting, no two pictures or footprints overlapping`, L[v].every(x => x.waiting === 0 && x.overlaps === 0 && x.phys === 0), L[v].filter(x => x.waiting || x.overlaps || x.phys));
          check('SC-SPAWN-rng: the seeded stream ends in the same state in every variant (no extra draw)', VARIANTS.every(v => L[v].every((x, i) => x.rng === L.BEFORE[i].rng)), {});
          results.data.layoutBefore = L.BEFORE;
        }
        if (g.errors.length) check('SC-ERRORS: no page errors', false, g.errors.slice(0, 5));
      } finally { await g.browser.close(); }
    }
    if (only.includes('source')) {
      const bsrv = await serve({ root: qaRoot(path.resolve(base), 'base') });
      try {
        const sd = Array.from({ length: 20 }, (_, i) => 3000 + i * 7919);
        const gb = await session(bsrv.url, 'pc'); let LB, rb;
        try { LB = await layouts(gb.page, null, sd); rb = await gb.page.evaluate(async () => { const m = await import(document.querySelector('script[type="module"][src]').src); const a = []; for (let u = 0; u <= 260; u += 0.5) a.push(+m.__qaRfu(u).toFixed(9)); return a; }); } finally { await gb.browser.close(); }
        const gc = await session(srv.url, 'pc'); let LC, rc;
        try { LC = await layouts(gc.page, null, sd); rc = await gc.page.evaluate(async () => { const m = await import(document.querySelector('script[type="module"][src]').src); const a = []; for (let u = 0; u <= 260; u += 0.5) a.push(+m.__qaArfu(u).toFixed(9)); return a; }); } finally { await gc.browser.close(); }
        check('SC-SOURCE-off: variant off = production: the same 20 seeded Arena layouts as the base checkout (positions, radii, kinds)', LB.every((x, i) => x.hash === LC[i].hash && x.rng === LC[i].rng), LB.map((x, i) => [x.seed, x.hash, LC[i].hash]).filter(x => x[1] !== x[2]));
        check('SC-SOURCE-curve: variant off: Arena growth curve = the base checkout\'s radiusForUnits() (0-260 units)', rb.join() === rc.join(), {});
      } finally { bsrv.server.close(); }
      const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
      const uses = (src.match(/arenaRadiusForUnits\(arenaUnitsForRadius\(/g) || []).length;
      check('SC-SOURCE-scope: the pilot curve is used only by Hole.growUnits() and the rivals\' passive growth (Arena), Campaign keeps radiusForUnits()', uses === 2 && /this\.player\.setRadius\(radiusForUnits\(this\.mission\.growthUnits\)\)/.test(src), { uses });
      check('SC-SOURCE-default: the pilot is off by default (SIZE_PROTO.variant null, surge 1, no view/radius changes)', /const SIZE_PROTO = \{ variant: null, surge: 1, surgeMs: 0, view: \{\}, radius: \{\} \};/.test(src), {});
    }
    if (only.includes('pace')) {
      const sd = Array.from({ length: seeds }, (_, i) => 5000 + i * 7);
      results.data.pace = {};
      for (const profile of ['weteran', 'nowy']) {
        const g = await session(srv.url, 'mobile');
        try { results.data.pace[profile] = await paceRounds(g.page, sd, profile); } finally { await g.browser.close(); }
        const P = results.data.pace[profile], s = (v, f) => med(P[v].map(f));
        const sum = Object.fromEntries(VARIANTS.map(v => [v, { T2: s(v, x => x.tierAt.T2 ?? 999), T3: s(v, x => x.tierAt.T3 ?? 999), T4: s(v, x => x.tierAt.T4 ?? 999), T5: s(v, x => x.tierAt.T5 ?? 999), R60: s(v, x => x.R[60]), R120: s(v, x => x.R[120]), score: s(v, x => x.score), place: s(v, x => x.place), deaths: s(v, x => x.deaths), topBot: s(v, x => x.topBotScore), botMaxR: s(v, x => x.botMaxR) }]));
        results.data['paceSummary_' + profile] = sum;
        console.log('  pace', profile, JSON.stringify(sum));
        for (const v of ['A', 'B']) {
          check(`SC-PACE-${profile}-${v}: no runaway growth: median time to T2/T3/T4 not more than 15 % shorter than BEFORE`, ['T2', 'T3', 'T4'].every(t => sum[v][t] >= sum.BEFORE[t] * 0.85 || sum.BEFORE[t] === 999), { v: sum[v], BEFORE: sum.BEFORE });
          check(`SC-BOTS-${profile}-${v}: rivals gain no outsized edge: top rival score median within +15 % of BEFORE`, sum[v].topBot <= sum.BEFORE.topBot * 1.15, { v: sum[v].topBot, BEFORE: sum.BEFORE.topBot });
        }
      }
    }
    if (only.includes('perf')) {
      const P = await perf(srv.url, reps); results.data.perf = P;
      for (const [key, d] of Object.entries(P)) for (const v of ['A', 'B']) {
        const b = med(d.BEFORE.map(x => x.median)), c = med(d[v].map(x => x.median));
        check(`SC-PERF-${key}-${v}: render median within +10 % of BEFORE (same page, alternated)`, c <= b * 1.10 + 0.05, { BEFORE: b, [v]: c });
      }
    }
  } finally { srv.server.close(); }
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, 'results.json'), JSON.stringify(results, null, 1));
  return results;
}

if (isMain(import.meta.url)) {
  const base = opt('base', null);
  const only = opt('only', 'geom,gate,start,spawn,source,pace,perf').split(',');
  if (!base && only.includes('source')) { console.error('--base=DIR is required for source'); process.exit(2); }
  run({ base, only, seeds: +opt('seeds', 12), reps: +opt('reps', 4) }).then((r) => {
    const f = r.checks.filter(c => !c.ok);
    console.log(`\n${r.checks.length - f.length} PASS, ${f.length} FAIL`);
    process.exit(f.length ? 1 : 0);
  }, (e) => { console.error(e); process.exit(1); });
}
