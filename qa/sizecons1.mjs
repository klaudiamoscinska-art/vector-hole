// GG-SIZE-CONSISTENCY-01 -- B FULL ARENA PILOT test (local; the pilot is switched in the page by applySizeProto(): BEFORE = null, 'B').
//   node qa/sizecons1.mjs --base=DIR [--only=geom,gate,surge,start,spawn,daily,source,pace,perf] [--seeds=100] [--profiles=weteran,nowy]
//                        [--reps=6] [--tag=NAME]
// geom   : every T2-T6 kind (19) as drawn vs the measured vortex disc (1.07 R): its long half-extent L at the last radius that cannot eat
//          it (must be >= the disc: a locked object never looks shorter than the vortex) and at the radius that unlocks it (must fit:
//          <= 0.96 disc); tier order of radii and pictures; every kind still drawn from its approved bitmap.
// gate   : Game.holeCanEat() below / at each threshold for all 19 kinds; B's Arena curve (x1.15 jump onto production's anchors, same
//          growth units per tier, production past T6), its inverse; Campaign's radiusForUnits() untouched.
// surge  : the jump through the real Game.update() (virtual clock) at each of the 5 thresholds: ratio, duration, the physical radius
//          and the drawn one move together (drawn >= physical, reach inside the disc every frame), the tier and the unlock arrive only
//          when the radius really reaches the anchor; a rival's jump; a rival's passive growth; a jump cancelled by being eaten; the
//          equal-rival case (reported).
// start  : a fresh round: R 18, T1, same objects / rivals as BEFORE, the first bite (casual bot).
// spawn  : 50 seeded layouts: nothing waiting, no picture or footprint overlap, the seeded stream unchanged, calibrated radii laid.
// daily  : the Daily preview (computeDailyLayout) = the Daily round, twice the same, with B's radii.
// source : pilot off = production (the same seeded layouts and growth curve as the base checkout); the pilot off by default.
// pace   : full 2-minute Arena rounds, casual player bot (virtual time), the same seeds and save before every round, BEFORE vs B:
//          time to T2..T6, size, score, place, rivals eaten, times eaten, the best rival's score and size.
// perf   : render() frame time, phone 390x844 DPR 2 and PC 1280x720, natural + dense staged scenes, BEFORE / B alternated in one page.
// Output: qa/out/sizecons1/results[-TAG].json (+ the console). Exit 1 on any FAIL.
import fs from 'node:fs';
import path from 'node:path';
import { serve, report, ROOT, isMain, ARENA_BOT } from './lib.mjs';
import { session, stageScene } from './objraster2-shots.mjs';
import { exportedRoot, measurePage, DIR } from './sizecons1-measure.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
export const VARIANTS = ['BEFORE', 'B'];
const vArg = (v) => (v === 'BEFORE' ? null : v);
const RADII = [18, 20, 22, 24, 26, 28, 30, 34, 38, 40, 42, 46, 50, 54, 57, 60, 64, 66, 72, 78, 84, 90, 96, 102, 108, 112, 118];
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? +(s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2).toFixed(3) : null; };
const mean = (a) => +(a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(3);

const bodyAt = (M, R) => {
  const xs = Object.keys(M.hole).map(Number).sort((a, b) => a - b);
  let i = xs.findIndex(x => x >= R); if (i < 0) i = xs.length - 1; if (i === 0) return M.hole[xs[0]].body * R;
  const a = xs[i - 1], b = xs[i], fa = M.hole[a].body, fb = M.hole[b].body;
  return (fa + (fb - fa) * (R - a) / (b - a)) * R;
};
const rAt = (M, u) => { const c = M.curve; const i = Math.min(c.length - 1, Math.max(0, Math.floor(u / 0.5))); return c[i][1]; };

export function geomTable(all) {
  const rows = [];
  for (const v of Object.keys(all)) {
    const M = all[v], A = M.anchors, U = M.unitAnchors, J = M.proto.surge;
    for (const [k, o] of Object.entries(M.kinds)) {
      const m = o.minSizeTier, Am = A[m], pre = Am / J - (J === 1 ? 0.01 : 0), L = Math.max(o.halfW, o.halfH), S = Math.min(o.halfW, o.halfH);
      let n = 0, bad = 0, firstBad = null;
      for (let u = U[m - 1]; u < U[m]; u += 0.05) { n++; if (bodyAt(M, rAt(M, u)) > L) { bad++; if (firstBad == null) firstBad = +u.toFixed(2); } }
      rows.push({ variant: v, kind: k, tier: o.tier, r: o.r, bitmap: o.bitmap, L: +L.toFixed(1), S: +S.toFixed(1), maxR: o.maxR,
        lockEndR: +pre.toFixed(2), bodyLockEnd: +bodyAt(M, pre).toFixed(1), unlockR: Am, bodyUnlock: +bodyAt(M, Am).toFixed(1),
        L_over_body_lockEnd: +(L / bodyAt(M, pre)).toFixed(3), S_over_body_lockEnd: +(S / bodyAt(M, pre)).toFixed(3),
        L_over_body_unlock: +(L / bodyAt(M, Am)).toFixed(3), maxR_over_body_unlock: +(o.maxR / bodyAt(M, Am)).toFixed(3),
        looksEatableShare: +(bad / n).toFixed(3), looksEatableFromUnits: firstBad, tierUnits: [U[m - 1], U[m]] });
    }
  }
  return rows;
}

/* ---------------------------------------------------------------- gate ---------------------------------------------------------------- */
async function gates(page) {
  return page.evaluate(async ({ VARIANTS }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src), g = window.game, out = {};
    for (const v of VARIANTS) {
      const SP = m.__qaSize(v === 'BEFORE' ? null : v);
      window.__qaSeedRandom(2024); g.startRound({ seed: 2024 }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; g.frenzyEndsAt = null;
      const A = m.CONFIG.growth.radiusAnchors, U = m.CONFIG.growth.unitAnchors, p = g.player, res = { gate: [], curve: {} };
      const seen = new Set();
      for (const o of g.objects) {
        const mt = m.TIERS[o.tier].minSizeTier;
        if (mt < 1 || seen.has(o.subtype) || o.tier === 'portal' || o.tier === 'golden') continue;
        seen.add(o.subtype);
        p.radius = m.__qaArfu(U[mt] - 0.001); const before = g.holeCanEat(p, o);
        p.radius = A[mt]; const at = g.holeCanEat(p, o);
        res.gate.push({ k: o.subtype, tier: mt + 1, r: o.radius, canEatBefore: before, canEatAt: at });
      }
      const c = res.curve;
      c.pre = U.slice(1).map(u => +m.__qaArfu(u - 1e-6).toFixed(3));
      c.post = U.slice(1).map(u => +m.__qaArfu(u).toFixed(3));
      c.past = [200, 260, 400].map(u => +(m.__qaArfu(u) - m.__qaRfu(u)).toFixed(6));
      let mono = true, prev = 0, trip = 0;
      for (let u = 0; u <= 400; u += 0.25) { const r = m.__qaArfu(u); if (r < prev - 1e-9) mono = false; prev = r; if (!U.includes(u)) trip = Math.max(trip, Math.abs(m.__qaAufr(r) - u)); }
      c.monotonic = mono; c.roundTripMaxErr = +trip.toFixed(6); c.surge = SP.surge;
      c.campaign = [0, 3, 6, 14, 22, 37, 50, 80, 100, 150, 180, 230].map(u => +m.__qaRfu(u).toFixed(6));
      c.tierByUnits = [0, 5.99, 6, 21.99, 22, 49.99, 50, 99.99, 100, 179.99, 180].map(u => m.getSizeTierIndex(m.__qaArfu(u)) + 1);
      out[v] = res;
    }
    m.__qaSize(null);
    return out;
  }, { VARIANTS });
}

/* ---------------------------------------------------------------- surge --------------------------------------------------------------- */
async function surges(page) {
  return page.evaluate(async () => {
    const m = await import(document.querySelector('script[type="module"][src]').src), g = window.game;
    const real = window.__realNow || (window.__realNow = performance.now.bind(performance));
    let vnow = 5e6; performance.now = () => vnow;
    const U = m.CONFIG.growth.unitAnchors, A = m.CONFIG.growth.radiusAnchors, out = { tiers: [] };
    const fresh = (v) => {
      m.__qaSize(v); window.__qaSeedRandom(2024); g.startRound({ seed: 2024 }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
      g.frenzyEndsAt = null; g.checkEvolutionTriggers = () => {}; g.botTuning.passive = 0;
      for (const b of g.bots) { b.x = 2900; b.y = 2900; b.update = function () {}; }
      return g.player;
    };
    const step = (dt) => { vnow += dt * 1000; g.update(dt); };
    try {
      for (const v of [null, 'B']) for (let mi = 1; mi <= 5; mi++) {
        const p = fresh(v);
        p.radius = m.__qaArfu(U[mi] - 0.5); p.x = 1500; p.y = 1500; p.invulnerableUntil = 0;
        const next = g.objects.find(o => m.TIERS[o.tier].minSizeTier === mi && o.tier !== 'portal');
        next.x = 300; next.y = 300;   // far away: only its gate is read
        const f = g.objects.find(o => o.tier === 'fragment'); g.objects = [f, next]; f.x = p.x; f.y = p.y;
        const R0 = p.radius, frames = [];
        let t = 0;
        for (let i = 0; i < 90; i++) {
          step(1 / 60); t += 1 / 60;
          const popT = p.growPopAt ? (performance.now() - p.growPopAt) / 260 : 1, pop = popT < 1 ? Math.sin(popT * Math.PI) : 0;
          const drawn = p.radius * (1 + 0.14 * pop + (p.fxSquash || 0));
          frames.push({ t: +t.toFixed(4), R: +p.radius.toFixed(3), drawn: +drawn.toFixed(3), tier: m.getSizeTierIndex(p.radius) + 1, can: g.holeCanEat(p, next), last: g.lastSizeTierId });
        }
        const Rf = frames[frames.length - 1].R, grow = frames.findIndex(fr => fr.R > R0 + 0.001), at = frames.findIndex(fr => fr.R >= A[mi] - 1e-9), canAt = frames.findIndex(fr => fr.can), end = frames.findIndex(fr => fr.R >= Rf - 0.001);
        let mono = true; for (let i = 1; i < frames.length; i++) if (frames[i].R < frames[i - 1].R - 1e-9) mono = false;
        out.tiers.push({ variant: v || 'BEFORE', tier: mi + 1, R0: +R0.toFixed(3), Rend: frames[frames.length - 1].R, ratio: +(frames[frames.length - 1].R / R0).toFixed(4),
          growFrame: grow, reachAnchorFrame: at, endFrame: end, unlockFrame: canAt, durationS: grow >= 0 && end >= 0 ? +((end - grow + 1) / 60).toFixed(3) : null, toAnchorS: grow >= 0 && at >= 0 ? +((at - grow + 1) / 60).toFixed(3) : null,
          monotonic: mono, minDrawnOverPhys: +Math.min(...frames.map(fr => fr.drawn / fr.R)).toFixed(4),
          minDiscOverReach: +Math.min(...frames.map(fr => (1.07 * fr.drawn) / (0.85 * fr.R))).toFixed(4),
          canBeforeAnchor: frames.some(fr => fr.can && fr.R < A[mi] - 1e-9), tierBeforeAnchor: frames.some(fr => fr.tier > mi && fr.R < A[mi] - 1e-9),
          bannerFrame: frames.findIndex(fr => fr.last === m.CONFIG.sizeTiers[mi].id), frames: frames.slice(0, 30) });
      }
      // a rival crossing T3 by eating: it jumps by the same rule
      { const p = fresh('B'); const b = g.bots[0]; b.x = 1500; b.y = 1500; b.radius = m.__qaArfu(U[2] - 0.5); b.invulnerableUntil = 0; p.x = 300; p.y = 300;
        const f = g.objects.find(o => o.tier === 'fragment'); g.objects = [f]; f.x = b.x; f.y = b.y; const R0 = b.radius, rs = [];
        for (let i = 0; i < 60; i++) { step(1 / 60); rs.push(b.radius); }
        out.bot = { R0: +R0.toFixed(3), Rend: +b.radius.toFixed(3), surged: rs.some(r => r < A[2] - 0.01 && r > R0 + 0.5), frameAtAnchor: rs.findIndex(r => r >= A[2] - 1e-9) }; }
      // a jump cancelled: the player is eaten mid-jump (shrinkAndRespawn) -> it stays at the start size
      { const p = fresh('B'); p.radius = m.__qaArfu(U[1] - 0.5); p.x = 1500; p.y = 1500; const f = g.objects.find(o => o.tier === 'fragment'); g.objects = [f]; f.x = p.x; f.y = p.y;
        let k = 0; while (p.surgeAt == null && k++ < 60) step(1 / 60);
        step(1 / 60); p.shrinkAndRespawn(0); for (let i = 0; i < 40; i++) step(1 / 60);
        out.cancel = { startedJump: k < 60, R: +p.radius.toFixed(3), surging: p.surgeAt != null }; }
      // a rival's slow passive growth across T2 (botTuning.passive): one jump, no gulp pop every frame
      { fresh('B'); const b = g.bots[0]; b.radius = m.__qaArfu(U[1] - 0.02); g.botTuning.passive = 0.5; g.objects = []; const rs = [], pops = new Set();
        for (let i = 0; i < 90; i++) { step(1 / 60); rs.push(b.radius); pops.add(b.growPopAt); }
        out.passive = { R0: +m.__qaArfu(U[1] - 0.02).toFixed(3), Rend: +b.radius.toFixed(3), framesToAnchor: rs.findIndex(r => r >= A[1] - 1e-9), pops: pops.size }; }
      // equal rival: the player and a rival both 0.5 unit short of T3; the player crosses -> its size vs that rival (holeRatio 1.15)
      { const res = {};
        for (const v of [null, 'B']) { const p = fresh(v); const b = g.bots[0]; p.radius = b.radius = m.__qaArfu(U[2] - 0.5); p.x = 1500; p.y = 1500; b.x = 2000; b.y = 2000; b.invulnerableUntil = 1e15;
          const f = g.objects.find(o => o.tier === 'fragment'); g.objects = [f]; f.x = p.x; f.y = p.y; for (let i = 0; i < 40; i++) step(1 / 60);
          res[v || 'BEFORE'] = { ratio: +(p.radius / b.radius).toFixed(4), edible: p.radius > b.radius * m.CONFIG.eating.holeRatio }; }
        out.equalRival = res; }
    } finally { performance.now = real; m.__qaSize(null); }
    return out;
  });
}

/* ---------------------------------------------------------------- start / spawn / daily ------------------------------------------------- */
async function starts(page) {
  await page.addScriptTag({ content: ARENA_BOT });
  return page.evaluate(async ({ VARIANTS }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src), g = window.game, out = {}, s0 = JSON.stringify(g.save);
    const restore = () => { const o = JSON.parse(s0); for (const k of Object.keys(g.save)) delete g.save[k]; Object.assign(g.save, o); };
    for (const v of VARIANTS) {
      m.__qaSize(v === 'BEFORE' ? null : v);
      restore(); window.__qaSeedRandom(77); g.startRound({ seed: 77 }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
      const p = g.player, first = { R0: p.radius, tier: m.CONFIG.sizeTiers[m.getSizeTierIndex(p.radius)].shortId, objects: g.objects.length, bots: g.bots.length, botR: g.bots.map(b => b.radius), difficulty: g.difficultyT };
      const firsts = [];
      for (const seed of [11, 22, 33, 44, 55, 66, 77, 88]) { restore(); window.__qaSeedRandom(seed); const r = window.__qaPlayArena({ style: 'casual', clock0: 1000000, noRender: true, pickCards: false, round: { seed } }); firsts.push({ seed, firstEatSec: r.firstEatSec, eats10: r.eats10 }); }
      restore(); out[v] = { ...first, firsts };
    }
    // the rivals' start in B = the same growth units as in BEFORE, drawn on B's curve; none inside a jump (R_m / 1.15 .. R_m)
    m.__qaSize('B');
    const A = m.CONFIG.growth.radiusAnchors;
    out.botStart = { BEFORE: out.BEFORE.botR, B: out.B.botR, expectB: out.BEFORE.botR.map(r => (r > 18 ? m.__qaArfu(m.__qaUfr(r)) : r)),
      inJump: out.B.botR.filter(r => A.some((a, i) => i > 0 && r >= a / 1.15 && r < a)).length };
    m.__qaSize(null);
    return out;
  }, { VARIANTS });
}

async function layouts(page, variant, seeds) {
  return page.evaluate(async ({ variant, seeds }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src), g = window.game;
    if (m.__qaSize) m.__qaSize(variant);
    const fnv = (s) => { let a = 0x811c9dc5; for (let i = 0; i < s.length; i++) a = Math.imul(a ^ s.charCodeAt(i), 16777619); return (a >>> 0).toString(16); };
    const expect = variant && m.__qaSizeSets ? m.__qaSizeSets[variant].radius : null, out = [];
    for (const seed of seeds) {
      window.__qaSeedRandom(seed); g.startRound({ seed }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
      const objs = g.objects.filter(o => !o.eating), B = objs.map(o => m.__qaViewBox(o.subtype, o.radius, o.x, o.y, { l: 0, r: 0, t: 0, b: 0 }));
      let overlaps = 0, phys = 0, wrongR = 0;
      for (let i = 0; i < objs.length; i++) {
        if (expect && expect[objs[i].subtype] && objs[i].radius !== expect[objs[i].subtype]) wrongR++;
        for (let j = i + 1; j < objs.length; j++) {
          const a = B[i], b = B[j]; if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) overlaps++;
          const dx = objs[i].x - objs[j].x, dy = objs[i].y - objs[j].y, mm = objs[i].radius + objs[j].radius; if (dx * dx + dy * dy < mm * mm) phys++;
        }
      }
      out.push({ seed, n: objs.length, waiting: (g.waitingObjects || []).length, overlaps, phys, wrongR, pos: objs.map(o => [Math.round(o.x), Math.round(o.y)]),
        hash: fnv(objs.map(o => [o.tier, o.subtype, Math.round(o.radius * 1000), Math.round(o.x * 100), Math.round(o.y * 100)].join(',')).join(';')), rng: g.rng ? g.rng.seed : null });
    }
    if (m.__qaSize) m.__qaSize(null);
    return out;
  }, { variant, seeds });
}

async function dailies(page) {
  return page.evaluate(async ({ VARIANTS }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src), g = window.game, out = {};
    for (const v of VARIANTS) {
      m.__qaSize(v === 'BEFORE' ? null : v);
      const L1 = g.computeDailyLayout(), L2 = g.computeDailyLayout();
      g.startDailyChallenge(); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
      const real = g.objects.map(o => [o.tier, Math.round(o.x), Math.round(o.y)]), prev = L1.objects.map(o => [o.tier, Math.round(o.x), Math.round(o.y)]);
      const same = (a, b) => a.length === b.length && a.every((o, i) => o[0] === b[i][0] && o[1] === b[i][1] && o[2] === b[i][2]);
      out[v] = { previewIsRound: same(real, prev) && Math.round(L1.spawn.x) === Math.round(g.player.x) && Math.round(L1.spawn.y) === Math.round(g.player.y),
        replay: same(prev, L2.objects.map(o => [o.tier, Math.round(o.x), Math.round(o.y)])), n: real.length, waiting: (g.waitingObjects || []).length,
        crate: (g.objects.find(o => o.subtype === 'skrzynia') || {}).radius, mode: g.mode, dateKey: L1.dateKey };
    }
    m.__qaSize(null);
    return out;
  }, { VARIANTS });
}

/* ---------------------------------------------------------------- pace ---------------------------------------------------------------- */
async function paceRounds(page, seeds, profile) {
  await page.addScriptTag({ content: ARENA_BOT });
  return page.evaluate(async ({ seeds, VARIANTS, profile }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src), g = window.game, A = m.CONFIG.growth.radiusAnchors;
    if (profile === 'nowy') { const s = m.defaultSave(); for (const k of Object.keys(g.save)) delete g.save[k]; Object.assign(g.save, s); }
    const s0 = JSON.stringify(g.save), out = {};
    for (const v of VARIANTS) {
      m.__qaSize(v === 'BEFORE' ? null : v);
      out[v] = [];
      for (const seed of seeds) {
        const o = JSON.parse(s0); for (const k of Object.keys(g.save)) delete g.save[k]; Object.assign(g.save, o);
        window.__qaSeedRandom(seed);
        const st = { R: {}, tierAt: {}, surges: 0 };
        let lastSurge = null;
        const res = window.__qaPlayArena({ style: 'casual', clock0: 1000000, noRender: true, pickCards: false, round: { seed }, onFrame: (f, gg) => {
          const sec = f / 30, p = gg.player;
          for (const t of [15, 30, 60, 90]) if (st.R[t] == null && sec >= t) st.R[t] = +p.radius.toFixed(1);
          for (let k = 1; k < 6; k++) if (st.tierAt['T' + (k + 1)] == null && p.radius >= A[k]) st.tierAt['T' + (k + 1)] = +sec.toFixed(1);
          if (p.surgeAt != null && p.surgeAt !== lastSurge) { st.surges++; lastSurge = p.surgeAt; }
        } });
        st.R[120] = res.radius;
        const bots = g.bots.map(b => b.radius);
        out[v].push({ seed, score: res.score, place: res.place, deaths: res.deaths, tier: res.tier, firstEatSec: res.firstEatSec, rivalsEaten: g.rivalsEatenThisRun || 0, ...st,
          topBotScore: Math.max(...g.bots.map(b => b.score)), botMeanR: +(bots.reduce((a, b) => a + b, 0) / bots.length).toFixed(1), botMaxR: +Math.max(...bots).toFixed(1) });
      }
    }
    m.__qaSize(null);
    const o = JSON.parse(s0); for (const k of Object.keys(g.save)) delete g.save[k]; Object.assign(g.save, o);
    return out;
  }, { seeds, VARIANTS, profile });
}

export function paceSummary(P) {
  const s = (v, f) => med(P[v].map(f)), sum = {};
  for (const v of Object.keys(P)) {
    sum[v] = { n: P[v].length };
    for (const t of ['T2', 'T3', 'T4', 'T5', 'T6']) sum[v][t] = s(v, x => x.tierAt[t] ?? 999);
    Object.assign(sum[v], { R15: s(v, x => x.R[15]), R30: s(v, x => x.R[30]), R60: s(v, x => x.R[60]), R120: s(v, x => x.R[120]), score: s(v, x => x.score), scoreMean: mean(P[v].map(x => x.score)),
      winPct: +(100 * P[v].filter(x => x.place === 1).length / P[v].length).toFixed(1), deathsMean: mean(P[v].map(x => x.deaths)), rivalsEatenMean: mean(P[v].map(x => x.rivalsEaten)),
      topBot: s(v, x => x.topBotScore), topBotMean: mean(P[v].map(x => x.topBotScore)), botMaxR: s(v, x => x.botMaxR), surgesMean: mean(P[v].map(x => x.surges || 0)) });
  }
  return sum;
}

/* ---------------------------------------------------------------- perf ---------------------------------------------------------------- */
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
        const key = `${frame}-${scn}`; out[key] = Object.fromEntries(VARIANTS.map(v => [v, []]));
        for (let rep = 0; rep < reps; rep++) for (const v of rep % 2 ? VARIANTS.slice().reverse() : VARIANTS) {
          await g.page.evaluate(async (v) => { const m = await import(document.querySelector('script[type="module"][src]').src); m.__qaSize(v); }, vArg(v));
          await stageScene(g.page, { sector: 'p', staged: scn === 'gesta', zoom: 0.58, gfx: 2 });
          await g.page.evaluate(() => { for (let k = 0; k < 6; k++) window.game.render(k / 60); });
          await g.page.waitForTimeout(600);
          out[key][v].push(await timeIt(g.page));
        }
        console.log('  perf', key, Object.fromEntries(Object.entries(out[key]).map(([v, a]) => [v, med(a.map(x => x.median))])));
      }
      await g.page.evaluate(async () => { const m = await import(document.querySelector('script[type="module"][src]').src); m.__qaSize(null); });
    } finally { await g.browser.close(); }
  }
  return out;
}

/** QA root of a checkout: game.js + the exports this test reads (the base has no pilot: only the shared ones). */
function qaRoot(root, name) {
  const dir = exportedRoot(root, name), f = path.join(dir, 'game.js');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes('const SIZE_PROTO')) s = s.replace(/, arenaRadiusForUnits as __qaArfu[^}]*\};\n$/, ' };\n');
  s += `\nexport { spawnViewBox as __qaViewBox };\n`;
  fs.writeFileSync(f, s);
  return dir;
}

export async function run({ base, only, seeds, reps, profiles, tag }) {
  const results = { checks: [], data: {} };
  const check = (name, ok, details) => { results.checks.push({ name, ok: !!ok, details }); report(name, !!ok, ok ? undefined : JSON.stringify(details).slice(0, 900)); };
  const srv = await serve({ root: qaRoot(ROOT, 'cand' + (tag ? '-' + tag : '')) });
  try {
    if (['geom', 'gate', 'surge', 'start', 'spawn', 'daily'].some(s => only.includes(s))) {
      const g = await session(srv.url, 'pc');
      try {
        if (only.includes('geom')) {
          const all = {}; for (const v of VARIANTS) all[v] = await measurePage(g.page, RADII, vArg(v));
          const T = geomTable(all); results.data.geom = T; results.data.measure = all;
          const bodies = Object.values(all.BEFORE.hole).map(h => h.body);
          check('SC-GEOM-body: the vortex is drawn as an opaque disc 1.05-1.09 R at every radius (BEFORE = B)', bodies.every(b => b >= 1.05 && b <= 1.09) && VARIANTS.every(v => JSON.stringify(Object.values(all[v].hole).map(h => h.body)) === JSON.stringify(bodies)), { bodies });
          check('SC-GEOM-reach: no eat reach is past the drawn disc (objects 0.85 R, T1 fragment 1.0 R < disc)', 1.0 < Math.min(...bodies), { disc: Math.min(...bodies) });
          const Bf = T.filter(r => r.variant === 'BEFORE'), Bb = T.filter(r => r.variant === 'B');
          check('SC-GEOM-before: BEFORE reproduces the problem (>= 10 kinds whose disc is longer than them while locked)', Bf.filter(r => r.looksEatableShare > 0).length >= 10, Bf.map(r => [r.kind, r.looksEatableShare]));
          check('SC-GEOM-B-locked: B, all 19 kinds: a locked object is never shorter than the vortex disc (L >= disc at the last locked radius, 0 % of the tier)', Bb.length === 19 && Bb.every(r => r.L_over_body_lockEnd >= 1.0 && r.looksEatableShare === 0), Bb.map(r => [r.kind, r.L_over_body_lockEnd, r.looksEatableShare]));
          check('SC-GEOM-B-unlock: B, all 19 kinds: at unlock the object fits inside the disc (L <= 0.96 disc)', Bb.every(r => r.L_over_body_unlock <= 0.96), Bb.map(r => [r.kind, r.L_over_body_unlock]));
          const order = (rows, key) => [2, 3, 4, 5].every(t => Math.max(...rows.filter(r => r.tier === t).map(r => r[key])) < Math.min(...rows.filter(r => r.tier === t + 1).map(r => r[key])));
          check('SC-GEOM-B-order: B keeps the tiers in order (every T(n) radius and picture smaller than every T(n+1))', order(Bb, 'r') && order(Bb, 'L'), [2, 3, 4, 5, 6].map(t => [t, Bb.filter(r => r.tier === t).map(r => r.r + '/' + r.L)]));
          check('SC-GEOM-B-bitmap: every kind is still drawn from its approved bitmap at the new radius', Bb.every(r => r.bitmap), Bb.filter(r => !r.bitmap).map(r => r.kind));
        }
        if (only.includes('gate')) {
          const G = await gates(g.page); results.data.gate = G;
          check('SC-GATE-rule: BEFORE and B, all 19 kinds: locked just below the tier, eatable at the threshold (tier gate unchanged)', VARIANTS.every(v => G[v].gate.length === 19 && G[v].gate.every(x => !x.canEatBefore && x.canEatAt)), Object.fromEntries(VARIANTS.map(v => [v, G[v].gate.length + ' / ' + JSON.stringify(G[v].gate.filter(x => x.canEatBefore || !x.canEatAt))])));
          check('SC-GATE-B-curve: B: R jumps x1.15 at each threshold onto the production anchor, monotonic, inverse exact, production past T6', G.B.curve.post.join() === '30,46,66,90,118' && G.B.curve.pre.every((r, i) => Math.abs(r * 1.15 - G.B.curve.post[i]) < 0.01) && G.B.curve.monotonic && G.B.curve.roundTripMaxErr < 1e-6 && G.B.curve.past.every(x => x === 0), G.B.curve);
          check('SC-GATE-units: the same pickups unlock each tier (tier by growth units identical in BEFORE and B)', G.B.curve.tierByUnits.join() === G.BEFORE.curve.tierByUnits.join(), { B: G.B.curve.tierByUnits, BEFORE: G.BEFORE.curve.tierByUnits });
          check('SC-GATE-campaign: Campaign\'s radiusForUnits() is identical under B', G.B.curve.campaign.join() === G.BEFORE.curve.campaign.join(), {});
        }
        if (only.includes('surge')) {
          const S = await surges(g.page); results.data.surge = S;
          const B = S.tiers.filter(x => x.variant === 'B'), BF = S.tiers.filter(x => x.variant === 'BEFORE');
          check('SC-SURGE-ratio: B, every threshold: one fragment 0.5 unit short of it takes the vortex x1.15-1.20 (BEFORE under x1.08)', B.every(x => x.ratio >= 1.15 && x.ratio <= 1.2) && BF.every(x => x.ratio < 1.08), S.tiers.map(x => [x.variant, x.tier, x.ratio]));
          check('SC-SURGE-time: B: the jump takes 0.28-0.32 s from the first frame of growth to its final radius, steadily (never shrinking)', B.every(x => x.durationS >= 0.28 && x.durationS <= 0.32 && x.monotonic), B.map(x => [x.tier, x.durationS, x.toAnchorS, x.monotonic]));
          check('SC-SURGE-sync: B: the drawn vortex is never smaller than the physical one, the eat reach always inside the drawn disc', B.every(x => x.minDrawnOverPhys >= 0.999 && x.minDiscOverReach > 1), B.map(x => [x.tier, x.minDrawnOverPhys, x.minDiscOverReach]));
          check('SC-SURGE-unlock: B: the tier, its banner and the next tier\'s objects unlock only when the radius reaches the anchor (not before)', B.every(x => !x.canBeforeAnchor && !x.tierBeforeAnchor && x.unlockFrame === x.reachAnchorFrame && x.bannerFrame >= x.reachAnchorFrame), B.map(x => [x.tier, x.reachAnchorFrame, x.unlockFrame, x.bannerFrame]));
          check('SC-SURGE-rival: a rival crossing a tier jumps by the same rule', S.bot.surged && S.bot.frameAtAnchor > 0, S.bot);
          check('SC-SURGE-passive: a rival\'s passive growth across a tier jumps once (no gulp pop every frame)', S.passive.framesToAnchor > 0 && S.passive.pops <= 2, S.passive);
          check('SC-SURGE-cancel: eaten mid-jump, the vortex restarts at R 18 and the jump is dropped', S.cancel.startedJump && S.cancel.R === 18 && !S.cancel.surging, S.cancel);
          console.log('  equal rival 0.5 unit short of T3 when the player crosses it:', JSON.stringify(S.equalRival));
        }
        if (only.includes('start')) {
          const S = await starts(g.page); results.data.start = S;
          check('SC-START: a fresh round: R 18, T1, same object and rival count as BEFORE', VARIANTS.every(v => S[v].R0 === 18 && S[v].tier === 'T1' && S[v].objects === S.BEFORE.objects && S[v].bots === S.BEFORE.bots), S);
          check('SC-START-rivals: B: every rival starts at the same growth progress as in BEFORE (units), none inside a tier jump', S.botStart.B.every((r, i) => Math.abs(r - S.botStart.expectB[i]) < 1e-6) && S.botStart.inJump === 0, S.botStart);
          const fe = (v) => med(S[v].firsts.map(x => x.firstEatSec ?? 99)), e10 = (v) => med(S[v].firsts.map(x => x.eats10));
          check('SC-START-bite: the first bite as fast as BEFORE (median within +0.3 s) and as many bites in the first 10 s (median within -15 %)', fe('B') <= fe('BEFORE') + 0.3 && e10('B') >= e10('BEFORE') * 0.85, { first: [fe('BEFORE'), fe('B')], eats10: [e10('BEFORE'), e10('B')] });
        }
        if (only.includes('spawn')) {
          const sd = Array.from({ length: 50 }, (_, i) => 3000 + i * 7919);
          const L = {}; for (const v of VARIANTS) L[v] = await layouts(g.page, vArg(v), sd);
          results.data.spawn = Object.fromEntries(VARIANTS.map(v => [v, L[v].map(x => ({ seed: x.seed, n: x.n, waiting: x.waiting, overlaps: x.overlaps, phys: x.phys, wrongR: x.wrongR }))]));
          for (const v of VARIANTS) check(`SC-SPAWN-${v}: 50 seeded layouts: nothing waiting, no two pictures or footprints overlapping`, L[v].every(x => x.waiting === 0 && x.overlaps === 0 && x.phys === 0), L[v].filter(x => x.waiting || x.overlaps || x.phys).map(x => [x.seed, x.waiting, x.overlaps, x.phys]));
          check('SC-SPAWN-rng: the seeded stream ends in the same state in B (no extra draw)', L.B.every((x, i) => x.rng === L.BEFORE[i].rng), {});
          check('SC-SPAWN-radii: B lays every T2-T6 kind at its calibrated radius', L.B.every(x => x.wrongR === 0), L.B.filter(x => x.wrongR).map(x => [x.seed, x.wrongR]));
          let moved = 0, tot = 0, far = 0; L.B.forEach((x, i) => x.pos.forEach((p, j) => { const q = L.BEFORE[i].pos[j]; tot++; const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > 0) moved++; if (d > 60) far++; }));
          results.data.spawnShift = { moved, far, tot };
          console.log(`  spawn: ${moved} of ${tot} positions differ from BEFORE (${(100 * moved / tot).toFixed(1)} %), ${far} by more than 60 world units`);
        }
        if (only.includes('daily')) {
          const D = await dailies(g.page); results.data.daily = D;
          check('SC-DAILY: the Daily preview is exactly the Daily round and replays the same, BEFORE and B (B: calibrated radii, nothing waiting)', VARIANTS.every(v => D[v].previewIsRound && D[v].replay && D[v].waiting === 0) && D.B.crate === 26 && D.BEFORE.crate === 20 && D.B.n === D.BEFORE.n, D);
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
        check('SC-SOURCE-off: pilot off = production: the same 20 seeded Arena layouts as the base checkout', LB.every((x, i) => x.hash === LC[i].hash && x.rng === LC[i].rng), LB.map((x, i) => [x.seed, x.hash, LC[i].hash]).filter(x => x[1] !== x[2]));
        check('SC-SOURCE-curve: pilot off: Arena growth curve = the base checkout\'s radiusForUnits() (0-260 units)', rb.join() === rc.join(), {});
      } finally { bsrv.server.close(); }
      const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
      check('SC-SOURCE-scope: the pilot curve is read only by Arena growth (growUnits, rivals\' passive growth); Campaign keeps radiusForUnits()', (src.match(/arenaRadiusForUnits\(arenaUnitsForRadius\(/g) || []).length === 2 && /this\.player\.setRadius\(radiusForUnits\(this\.mission\.growthUnits\)\)/.test(src), {});
      check('SC-SOURCE-default: the pilot is off by default (SIZE_PROTO.variant null, surge 1, no view/radius changes)', /const SIZE_PROTO = \{ variant: null, surge: 1, surgeMs: 0, view: \{\}, radius: \{\} \};/.test(src), {});
    }
    if (only.includes('pace')) {
      const sd = Array.from({ length: seeds }, (_, i) => 5000 + i * 7);
      results.data.pace = {};
      for (const profile of profiles) {
        const g = await session(srv.url, 'mobile');
        try { results.data.pace[profile] = await paceRounds(g.page, sd, profile); } finally { await g.browser.close(); }
        const sum = paceSummary(results.data.pace[profile]); results.data['paceSummary_' + profile] = sum;
        console.log('  pace', profile, JSON.stringify(sum));
        const b = sum.BEFORE, c = sum.B;
        check(`SC-PACE-${profile}: B reaches every tier T2-T6 within +-15 % of BEFORE (median, ${seeds} seeds)`, ['T2', 'T3', 'T4', 'T5', 'T6'].every(t => b[t] === 999 || (c[t] >= b[t] * 0.85 && c[t] <= b[t] * 1.15)), { B: c, BEFORE: b });
        check(`SC-PACE-${profile}-size: B ends as big as BEFORE (median R at 60 s and 120 s within +-10 %)`, Math.abs(c.R60 / b.R60 - 1) <= 0.1 && Math.abs(c.R120 / b.R120 - 1) <= 0.1, { R60: [b.R60, c.R60], R120: [b.R120, c.R120] });
        check(`SC-BOTS-${profile}: rivals gain no edge in B: the best rival's score median and mean within +10 % of BEFORE`, c.topBot <= b.topBot * 1.1 && c.topBotMean <= b.topBotMean * 1.1, { median: [b.topBot, c.topBot], mean: [b.topBotMean, c.topBotMean] });
        check(`SC-PLAYER-${profile}: the player keeps the same odds in B: win rate within 5 points, eaten as often (mean within +0.15), score median within +-10 %`, Math.abs(c.winPct - b.winPct) <= 5 && c.deathsMean <= b.deathsMean + 0.15 && Math.abs(c.score / b.score - 1) <= 0.1, { win: [b.winPct, c.winPct], deaths: [b.deathsMean, c.deathsMean], score: [b.score, c.score], rivalsEaten: [b.rivalsEatenMean, c.rivalsEatenMean] });
      }
    }
    if (only.includes('perf')) {
      const P = await perf(srv.url, reps); results.data.perf = P;
      for (const [key, d] of Object.entries(P)) {
        const b = med(d.BEFORE.map(x => x.median)), c = med(d.B.map(x => x.median)), bp = med(d.BEFORE.map(x => x.p95)), cp = med(d.B.map(x => x.p95));
        check(`SC-PERF-${key}: B render median and p95 within +10 % of BEFORE (same page, alternated)`, c <= b * 1.10 + 0.05 && cp <= bp * 1.10 + 0.1, { median: [b, c], p95: [bp, cp] });
      }
    }
  } finally { srv.server.close(); }
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, `results${tag ? '-' + tag : ''}.json`), JSON.stringify(results, null, 1));
  return results;
}

if (isMain(import.meta.url)) {
  const base = opt('base', null);
  const only = opt('only', 'geom,gate,surge,start,spawn,daily,source,pace,perf').split(',');
  if (!base && only.includes('source')) { console.error('--base=DIR is required for source'); process.exit(2); }
  run({ base, only, seeds: +opt('seeds', 100), reps: +opt('reps', 6), profiles: opt('profiles', 'weteran,nowy').split(','), tag: opt('tag', '') }).then((r) => {
    const f = r.checks.filter(c => !c.ok);
    console.log(`\n${r.checks.length - f.length} PASS, ${f.length} FAIL`);
    process.exit(f.length ? 1 : 0);
  }, (e) => { console.error(e); process.exit(1); });
}
