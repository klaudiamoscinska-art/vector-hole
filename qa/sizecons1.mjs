// GG-SIZE-CONSISTENCY-01 (final, variant B): the Arena growth jump x1.15 and the per-kind object radii. BEFORE = a checkout of
// production (--base, the code before this stage), FINAL = this checkout; both served side by side, the same seeds and the same machine.
//   node qa/sizecons1.mjs --base=DIR [--only=contract,geom,gate,surge,start,spawn,daily,mission,pace,perf] [--seeds=100]
//                        [--profiles=weteran,nowy] [--reps=6] [--tag=NAME]
// contract: the source -- CONFIG.arena.growthJump 1.15 / growthJumpMs 300, ARENA_KIND_RADIUS = the approved 19 radii, no pilot switch
//          left (SIZE_PROTO / applySizeProto), growth units, anchors, TIERS, eat gates, V2g and the daily tasks = BEFORE.
// geom   : every T2-T6 kind (19) as drawn vs the measured vortex disc (1.07 R): its long half-extent L at the last radius that cannot eat
//          it (FINAL: >= the disc -- a locked object never looks shorter than the vortex) and at the radius that unlocks it (FINAL: <= 0.96
//          disc -- it fits); tier order of radii and pictures; every kind drawn from its approved bitmap.
// gate   : Game.holeCanEat() below / at each threshold for all 19 kinds; the Arena curve (x1.15 onto the anchors, same growth units per
//          tier, linear past T6) and its inverse; Campaign's radiusForUnits() = BEFORE.
// surge  : the jump through the real Game.update() (virtual clock) at each of the 5 thresholds: ratio, duration, the physical radius and
//          the drawn one move together, the tier / unlock / banner only when the radius reaches the anchor; a rival's jump; a rival's passive
//          growth; a jump cancelled by being eaten; the equal-rival case (reported).
// start  : a fresh round: R 18, T1, same objects / rivals as BEFORE, rivals start at BEFORE's growth units, the first bite (casual bot).
// spawn  : 50 seeded layouts: nothing waiting, no picture or footprint overlap, the seeded stream = BEFORE's, the calibrated radii laid,
//          the same seed twice = the same layout.
// daily  : the Daily preview (computeDailyLayout) = the Daily round, replayed the same, BEFORE and FINAL.
// mission: the daily task "Urośnij do rozmiaru T5" (id reach_size_60, target R 90): completed exactly when the round reached R 90,
//          completion rate vs BEFORE, the same seed twice = the same result.
// pace   : full 2-minute Arena rounds, casual player bot (virtual time), the same seeds and save before every round, BEFORE vs FINAL.
// perf   : render() frame time, phone emulation 390x844 DPR 2 and PC 1280x720 (Chromium; not a physical device), natural + dense staged
//          scenes, BEFORE and FINAL pages alternated.
// Output: qa/out/sizecons1/results[-TAG].json (+ the console). Exit 1 on any FAIL.
import fs from 'node:fs';
import path from 'node:path';
import { serve, report, ROOT, isMain, ARENA_BOT } from './lib.mjs';
import { session, stageScene } from './objraster2-shots.mjs';
import { exportedRoot, measurePage, DIR } from './sizecons1-measure.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
export const APPROVED = { growthJump: 1.15, growthJumpMs: 300, radius: { lawka: 25, kiosk: 27, skrzynia: 26, latarnia: 18, drzewo: 26, znacznik: 22, samochod: 35, wezel: 33, pylon: 32, pawilon: 54, billboard: 56, magazyn: 54, landmark: 52, autobus: 73, tramwaj: 68, ciezarowka: 72, wiezowiec: 94, maszt: 85, kopula: 98 } };
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

/* --------------------------------------------------------------- in-page probes -------------------------------------------------------------- */
const gates = (page) => page.evaluate(async () => {
  const m = await import(document.querySelector('script[type="module"][src]').src), g = window.game, arfu = m.__qaArfu || m.__qaRfu, aufr = m.__qaAufr || m.__qaUfr;
  window.__qaSeedRandom(2024); g.startRound({ seed: 2024 }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; g.frenzyEndsAt = null;
  const A = m.CONFIG.growth.radiusAnchors, U = m.CONFIG.growth.unitAnchors, p = g.player, res = { gate: [], curve: {} }, seen = new Set();
  for (const o of g.objects) {
    const mt = m.TIERS[o.tier].minSizeTier;
    if (mt < 1 || seen.has(o.subtype) || o.tier === 'portal' || o.tier === 'golden') continue;
    seen.add(o.subtype);
    p.radius = arfu(U[mt] - 0.001); const before = g.holeCanEat(p, o);
    p.radius = A[mt]; const at = g.holeCanEat(p, o);
    res.gate.push({ k: o.subtype, tier: mt + 1, r: o.radius, canEatBefore: before, canEatAt: at });
  }
  const c = res.curve;
  c.pre = U.slice(1).map(u => +arfu(u - 1e-6).toFixed(3)); c.post = U.slice(1).map(u => +arfu(u).toFixed(3));
  c.past = [200, 260, 400].map(u => +(arfu(u) - m.__qaRfu(u)).toFixed(6));
  let mono = true, prev = 0, trip = 0;
  for (let u = 0; u <= 400; u += 0.25) { const r = arfu(u); if (r < prev - 1e-9) mono = false; prev = r; if (!U.includes(u)) trip = Math.max(trip, Math.abs(aufr(r) - u)); }
  c.monotonic = mono; c.roundTripMaxErr = +trip.toFixed(6);
  c.campaign = [0, 3, 6, 14, 22, 37, 50, 80, 100, 150, 180, 230].map(u => +m.__qaRfu(u).toFixed(6));
  c.tierByUnits = [0, 5.99, 6, 21.99, 22, 49.99, 50, 99.99, 100, 179.99, 180].map(u => m.getSizeTierIndex(arfu(u)) + 1);
  c.config = { unitAnchors: U.slice(), radiusAnchors: A.slice(), tiers: Object.fromEntries(Object.entries(m.TIERS).map(([k, t]) => [k, [t.minR, t.maxR, t.value, t.growth, t.minSizeTier, t.count, t.subtypes.join('/')]])), holeRatio: m.CONFIG.eating.holeRatio, fragmentReach: m.CONFIG.arena.fragmentReach, growthJump: m.CONFIG.arena.growthJump || null, growthJumpMs: m.CONFIG.arena.growthJumpMs || null, kindR: m.__qaKindR || null, missions: m.__qaMissions };
  return res;
});

const surges = (page) => page.evaluate(async () => {
  const m = await import(document.querySelector('script[type="module"][src]').src), g = window.game, arfu = m.__qaArfu || m.__qaRfu;
  const real = window.__realNow || (window.__realNow = performance.now.bind(performance));
  let vnow = 5e6; performance.now = () => vnow;
  const U = m.CONFIG.growth.unitAnchors, A = m.CONFIG.growth.radiusAnchors, out = { tiers: [] };
  const fresh = () => {
    window.__qaSeedRandom(2024); g.startRound({ seed: 2024 }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
    g.frenzyEndsAt = null; g.checkEvolutionTriggers = () => {}; g.botTuning.passive = 0;
    for (const b of g.bots) { b.x = 2900; b.y = 2900; b.update = function () {}; }
    return g.player;
  };
  const step = (dt) => { vnow += dt * 1000; g.update(dt); };
  try {
    for (let mi = 1; mi <= 5; mi++) {
      const p = fresh();
      p.radius = arfu(U[mi] - 0.5); p.x = 1500; p.y = 1500; p.invulnerableUntil = 0;
      const next = g.objects.find(o => m.TIERS[o.tier].minSizeTier === mi && o.tier !== 'portal'); next.x = 300; next.y = 300;
      const f = g.objects.find(o => o.tier === 'fragment'); g.objects = [f, next]; f.x = p.x; f.y = p.y;
      const R0 = p.radius, frames = [];
      for (let i = 0; i < 90; i++) {
        step(1 / 60);
        const popT = p.growPopAt ? (performance.now() - p.growPopAt) / 260 : 1, pop = popT < 1 ? Math.sin(popT * Math.PI) : 0;
        frames.push({ R: +p.radius.toFixed(3), drawn: +(p.radius * (1 + 0.14 * pop + (p.fxSquash || 0))).toFixed(3), tier: m.getSizeTierIndex(p.radius) + 1, can: g.holeCanEat(p, next), last: g.lastSizeTierId });
      }
      const Rf = frames[frames.length - 1].R, grow = frames.findIndex(fr => fr.R > R0 + 0.001), at = frames.findIndex(fr => fr.R >= A[mi] - 1e-9), canAt = frames.findIndex(fr => fr.can), end = frames.findIndex(fr => fr.R >= Rf - 0.001);
      let mono = true; for (let i = 1; i < frames.length; i++) if (frames[i].R < frames[i - 1].R - 1e-9) mono = false;
      out.tiers.push({ tier: mi + 1, R0: +R0.toFixed(3), Rend: Rf, ratio: +(Rf / R0).toFixed(4), growFrame: grow, reachAnchorFrame: at, endFrame: end, unlockFrame: canAt,
        durationS: grow >= 0 && end >= 0 ? +((end - grow + 1) / 60).toFixed(3) : null, monotonic: mono,
        minDrawnOverPhys: +Math.min(...frames.map(fr => fr.drawn / fr.R)).toFixed(4), minDiscOverReach: +Math.min(...frames.map(fr => (1.07 * fr.drawn) / (0.85 * fr.R))).toFixed(4),
        canBeforeAnchor: frames.some(fr => fr.can && fr.R < A[mi] - 1e-9), tierBeforeAnchor: frames.some(fr => fr.tier > mi && fr.R < A[mi] - 1e-9),
        bannerFrame: frames.findIndex(fr => fr.last === m.CONFIG.sizeTiers[mi].id), frames: frames.slice(0, 30) });
    }
    { const p = fresh(); const b = g.bots[0]; b.x = 1500; b.y = 1500; b.radius = arfu(U[2] - 0.5); b.invulnerableUntil = 0; p.x = 300; p.y = 300;
      const f = g.objects.find(o => o.tier === 'fragment'); g.objects = [f]; f.x = b.x; f.y = b.y; const R0 = b.radius, rs = [];
      for (let i = 0; i < 60; i++) { step(1 / 60); rs.push(b.radius); }
      out.bot = { R0: +R0.toFixed(3), Rend: +b.radius.toFixed(3), surged: rs.some(r => r < A[2] - 0.01 && r > R0 + 0.5), frameAtAnchor: rs.findIndex(r => r >= A[2] - 1e-9) }; }
    { const p = fresh(); p.radius = arfu(U[1] - 0.5); p.x = 1500; p.y = 1500; const f = g.objects.find(o => o.tier === 'fragment'); g.objects = [f]; f.x = p.x; f.y = p.y;
      let k = 0; while (p.surgeAt == null && k++ < 60) step(1 / 60);
      step(1 / 60); p.shrinkAndRespawn(0); for (let i = 0; i < 40; i++) step(1 / 60);
      out.cancel = { startedJump: k < 60, R: +p.radius.toFixed(3), surging: p.surgeAt != null }; }
    { fresh(); const b = g.bots[0]; b.radius = arfu(U[1] - 0.02); g.botTuning.passive = 0.5; g.objects = []; const rs = [], pops = new Set();
      for (let i = 0; i < 90; i++) { step(1 / 60); rs.push(b.radius); pops.add(b.growPopAt); }
      out.passive = { Rend: +b.radius.toFixed(3), framesToAnchor: rs.findIndex(r => r >= A[1] - 1e-9), pops: pops.size }; }
    { const p = fresh(); const b = g.bots[0]; p.radius = b.radius = arfu(U[2] - 0.5); p.x = 1500; p.y = 1500; b.x = 2000; b.y = 2000; b.invulnerableUntil = 1e15;
      const f = g.objects.find(o => o.tier === 'fragment'); g.objects = [f]; f.x = p.x; f.y = p.y; for (let i = 0; i < 40; i++) step(1 / 60);
      out.equalRival = { ratio: +(p.radius / b.radius).toFixed(4), edible: p.radius > b.radius * m.CONFIG.eating.holeRatio }; }
  } finally { performance.now = real; }
  return out;
});

async function starts(page) {
  await page.addScriptTag({ content: ARENA_BOT });
  return page.evaluate(async () => {
    const m = await import(document.querySelector('script[type="module"][src]').src), g = window.game, s0 = JSON.stringify(g.save);
    const restore = () => { const o = JSON.parse(s0); for (const k of Object.keys(g.save)) delete g.save[k]; Object.assign(g.save, o); };
    const out = { botR: {} };
    for (const runs of [0, 3, 8, 12, 30]) {   // careers from new to veteran: the rivals' start sizes follow the difficulty ramp
      restore(); g.save.stats.runsPlayed = runs; window.__qaSeedRandom(77); g.startRound({ seed: 77 }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
      out.botR[runs] = g.bots.map(b => b.radius);
      if (runs === 12) Object.assign(out, { R0: g.player.radius, tier: m.CONFIG.sizeTiers[m.getSizeTierIndex(g.player.radius)].shortId, objects: g.objects.length, bots: g.bots.length });
    }
    const firsts = [];
    for (const seed of [11, 22, 33, 44, 55, 66, 77, 88]) { restore(); window.__qaSeedRandom(seed); const r = window.__qaPlayArena({ style: 'casual', clock0: 1000000, noRender: true, pickCards: false, round: { seed } }); firsts.push({ seed, firstEatSec: r.firstEatSec, eats10: r.eats10 }); }
    restore();
    return { ...out, firsts };
  });
}

/** In the FINAL page: BEFORE's rival start radii read as growth units and drawn on the Arena curve; the jump intervals. */
const expectBotR = (page, botR) => page.evaluate(async (botR) => {
  const m = await import(document.querySelector('script[type="module"][src]').src), A = m.CONFIG.growth.radiusAnchors, J = m.CONFIG.arena.growthJump;
  return { exp: Object.fromEntries(Object.entries(botR).map(([k, rs]) => [k, rs.map(r => (r > 18 ? m.__qaArfu(m.__qaUfr(r)) : r))])), jumps: A.slice(1).map(a => [a / J, a]) };
}, botR);

const layouts = (page, seeds) => page.evaluate(async (seeds) => {
  const m = await import(document.querySelector('script[type="module"][src]').src), g = window.game;
  const fnv = (s) => { let a = 0x811c9dc5; for (let i = 0; i < s.length; i++) a = Math.imul(a ^ s.charCodeAt(i), 16777619); return (a >>> 0).toString(16); };
  const KR = m.__qaKindR || null, out = [];
  for (const seed of seeds) {
    window.__qaSeedRandom(seed); g.startRound({ seed }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
    const objs = g.objects.filter(o => !o.eating), B = objs.map(o => m.__qaViewBox(o.subtype, o.radius, o.x, o.y, { l: 0, r: 0, t: 0, b: 0 }));
    let overlaps = 0, phys = 0, wrongR = 0;
    for (let i = 0; i < objs.length; i++) {
      if (KR && KR[objs[i].subtype] && objs[i].radius !== KR[objs[i].subtype]) wrongR++;
      for (let j = i + 1; j < objs.length; j++) {
        const a = B[i], b = B[j]; if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) overlaps++;
        const dx = objs[i].x - objs[j].x, dy = objs[i].y - objs[j].y, mm = objs[i].radius + objs[j].radius; if (dx * dx + dy * dy < mm * mm) phys++;
      }
    }
    out.push({ seed, n: objs.length, waiting: (g.waitingObjects || []).length, overlaps, phys, wrongR, kinds: objs.map(o => o.tier + ':' + o.subtype).join(','), pos: objs.map(o => [Math.round(o.x), Math.round(o.y)]),
      hash: fnv(objs.map(o => [o.tier, o.subtype, Math.round(o.radius * 1000), Math.round(o.x * 100), Math.round(o.y * 100)].join(',')).join(';')), rng: g.rng ? g.rng.seed : null });
  }
  return out;
}, seeds);

const dailies = (page) => page.evaluate(() => {
  const g = window.game, L1 = g.computeDailyLayout(), L2 = g.computeDailyLayout();
  g.startDailyChallenge(); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
  const real = g.objects.map(o => [o.tier, Math.round(o.x), Math.round(o.y)]), prev = L1.objects.map(o => [o.tier, Math.round(o.x), Math.round(o.y)]);
  const same = (a, b) => a.length === b.length && a.every((o, i) => o[0] === b[i][0] && o[1] === b[i][1] && o[2] === b[i][2]);
  return { previewIsRound: same(real, prev) && Math.round(L1.spawn.x) === Math.round(g.player.x) && Math.round(L1.spawn.y) === Math.round(g.player.y),
    replay: same(prev, L2.objects.map(o => [o.tier, Math.round(o.x), Math.round(o.y)])), n: real.length, waiting: (g.waitingObjects || []).length,
    crate: (g.objects.find(o => o.subtype === 'skrzynia') || {}).radius, mode: g.mode, dateKey: L1.dateKey };
});

/** The daily task reach_size_60 (target R 90) forced as today's task in full casual rounds. */
async function missions(page, seeds) {
  await page.addScriptTag({ content: ARENA_BOT });
  return page.evaluate(async (seeds) => {
    const m = await import(document.querySelector('script[type="module"][src]').src), g = window.game, s0 = JSON.stringify(g.save);
    const task = m.__qaMissions.find(x => x.id === 'reach_size_60');
    const play = (seed) => {
      const o = JSON.parse(s0); for (const k of Object.keys(g.save)) delete g.save[k]; Object.assign(g.save, o);
      window.__qaSeedRandom(seed);
      let maxR = 0, forced = false;
      const r = window.__qaPlayArena({ style: 'casual', clock0: 1000000, noRender: true, pickCards: false, round: { seed }, onFrame: (f, gg) => {
        if (!forced) { forced = true; gg.activeMission = task; gg.save.mission = { dateKey: gg.save.mission.dateKey, completed: false }; }
        maxR = Math.max(maxR, gg.player.radius);
      } });
      return { seed, maxR: +maxR.toFixed(3), peak: +g.missionProgressPeak.toFixed(3), completed: !!g.save.mission.completed, justCompleted: !!g.missionJustCompleted, place: r.place };
    };
    play(seeds[seeds.length - 1]);   // warm-up: the first round in a fresh page differs from a later one with the same seed (BEFORE too)
    const rounds = seeds.map(play), again = seeds.slice(0, 5).map(play);
    const o = JSON.parse(s0); for (const k of Object.keys(g.save)) delete g.save[k]; Object.assign(g.save, o);
    return { task, rounds, again };
  }, seeds);
}

async function paceRounds(page, seeds, profile) {
  await page.addScriptTag({ content: ARENA_BOT });
  return page.evaluate(async ({ seeds, profile }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src), g = window.game, A = m.CONFIG.growth.radiusAnchors;
    if (profile === 'nowy') { const s = m.defaultSave(); for (const k of Object.keys(g.save)) delete g.save[k]; Object.assign(g.save, s); }
    const s0 = JSON.stringify(g.save), out = [];
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
      out.push({ seed, score: res.score, place: res.place, deaths: res.deaths, tier: res.tier, firstEatSec: res.firstEatSec, rivalsEaten: g.rivalsEatenThisRun || 0, ...st,
        topBotScore: Math.max(...g.bots.map(b => b.score)), botMeanR: +(bots.reduce((a, b) => a + b, 0) / bots.length).toFixed(1), botMaxR: +Math.max(...bots).toFixed(1) });
    }
    const o = JSON.parse(s0); for (const k of Object.keys(g.save)) delete g.save[k]; Object.assign(g.save, o);
    return out;
  }, { seeds, profile });
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

const timeIt = (page) => page.evaluate(() => {
  const gm = window.game, real = window.__realNow || performance.now.bind(performance), t = [], flush = () => gm.ctx.getImageData(0, 0, 1, 1);
  for (let k = 0; k < 15; k++) { gm.render(k / 60); flush(); }
  for (let k = 0; k < 90; k++) { const t0 = real(); gm.render(k / 60); flush(); t.push(real() - t0); }
  t.sort((a, b) => a - b);
  return { median: +t[45].toFixed(3), p95: +t[85].toFixed(3) };
});
async function perf(urls, reps) {
  const out = {};
  for (const frame of ['mobile', 'pc']) {
    const S = {}; for (const v of ['BEFORE', 'FINAL']) S[v] = await session(urls[v], frame);
    try {
      for (const v of ['BEFORE', 'FINAL']) await S[v].page.evaluate(() => { window.__realNow = window.__realNow || performance.now.bind(performance); });
      for (const scn of ['naturalna', 'gesta']) {
        const key = `${frame}-${scn}`; out[key] = { BEFORE: [], FINAL: [] };
        for (let rep = 0; rep < reps; rep++) for (const v of rep % 2 ? ['FINAL', 'BEFORE'] : ['BEFORE', 'FINAL']) {
          await stageScene(S[v].page, { sector: 'p', staged: scn === 'gesta', zoom: 0.58, gfx: 2 });
          await S[v].page.evaluate(() => { for (let k = 0; k < 6; k++) window.game.render(k / 60); });
          await S[v].page.waitForTimeout(600);
          out[key][v].push(await timeIt(S[v].page));
        }
        console.log('  perf', key, Object.fromEntries(Object.entries(out[key]).map(([v, a]) => [v, med(a.map(x => x.median))])));
      }
    } finally { for (const v of Object.keys(S)) await S[v].browser.close(); }
  }
  return out;
}

export async function run({ base, only, seeds, reps, profiles, tag }) {
  const results = { checks: [], data: {} };
  const check = (name, ok, details) => { results.checks.push({ name, ok: !!ok, details }); report(name, !!ok, ok ? undefined : JSON.stringify(details).slice(0, 900)); };
  const roots = { BEFORE: exportedRoot(path.resolve(base), 'base' + (tag ? '-' + tag : '')), FINAL: exportedRoot(ROOT, 'final' + (tag ? '-' + tag : '')) };
  const srv = { BEFORE: await serve({ root: roots.BEFORE }), FINAL: await serve({ root: roots.FINAL }) };
  const urls = { BEFORE: srv.BEFORE.url, FINAL: srv.FINAL.url };
  try {
    if (only.includes('contract')) {
      const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
      check('SC-CONTRACT-pilot-gone: no pilot switch left in the runtime (SIZE_PROTO, applySizeProto, variant sets)', !/SIZE_PROTO|applySizeProto/.test(src), {});
      check('SC-CONTRACT-config: CONFIG.arena.growthJump 1.15, growthJumpMs 300 in the source', /growthJump: 1\.15,/.test(src) && /growthJumpMs: 300,/.test(src), {});
      check('SC-CONTRACT-scope: the Arena curve is read only by Hole.growUnits() and the rivals\' passive growth; Campaign sets its radius from radiusForUnits()', (src.match(/arenaRadiusForUnits\(arenaUnitsForRadius\(/g) || []).length === 2 && /this\.player\.setRadius\(radiusForUnits\(this\.mission\.growthUnits\)\)/.test(src), {});
    }
    if (['contract', 'geom', 'gate', 'surge', 'start', 'spawn', 'daily'].some(s => only.includes(s))) {
      const S = {}; for (const v of ['BEFORE', 'FINAL']) S[v] = await session(urls[v], 'pc');
      try {
        if (only.includes('contract') || only.includes('gate')) {
          const G = { BEFORE: await gates(S.BEFORE.page), FINAL: await gates(S.FINAL.page) }; results.data.gate = G;
          const cb = G.BEFORE.curve.config, cf = G.FINAL.curve.config;
          if (only.includes('contract')) {
            check('SC-CONTRACT-radii: ARENA_KIND_RADIUS = the approved 19 radii, growthJump 1.15 / 300 ms at run time', JSON.stringify(cf.kindR) === JSON.stringify(APPROVED.radius) && cf.growthJump === 1.15 && cf.growthJumpMs === 300, { kindR: cf.kindR });
            check('SC-CONTRACT-unchanged: growth units, anchors, TIERS (radius draw, value, growth, tier gate, counts, kinds), holeRatio, V2g fragmentReach, daily tasks = BEFORE', JSON.stringify([cb.unitAnchors, cb.radiusAnchors, cb.tiers, cb.holeRatio, cb.fragmentReach, cb.missions]) === JSON.stringify([cf.unitAnchors, cf.radiusAnchors, cf.tiers, cf.holeRatio, cf.fragmentReach, cf.missions]), { BEFORE: cb, FINAL: cf });
          }
          if (only.includes('gate')) {
            check('SC-GATE-rule: BEFORE and FINAL, all 19 kinds: locked just below the tier, eatable at the threshold (tier gate unchanged)', ['BEFORE', 'FINAL'].every(v => G[v].gate.length === 19 && G[v].gate.every(x => !x.canEatBefore && x.canEatAt)), Object.fromEntries(['BEFORE', 'FINAL'].map(v => [v, G[v].gate.filter(x => x.canEatBefore || !x.canEatAt)])));
            check('SC-GATE-curve: FINAL: R jumps x1.15 at each threshold onto the anchors, monotonic, inverse exact, linear past T6', G.FINAL.curve.post.join() === '30,46,66,90,118' && G.FINAL.curve.pre.every((r, i) => Math.abs(r * 1.15 - G.FINAL.curve.post[i]) < 0.01) && G.FINAL.curve.monotonic && G.FINAL.curve.roundTripMaxErr < 1e-6 && G.FINAL.curve.past.every(x => x === 0), G.FINAL.curve);
            check('SC-GATE-units: the same pickups unlock each tier (tier by growth units FINAL = BEFORE)', G.FINAL.curve.tierByUnits.join() === G.BEFORE.curve.tierByUnits.join(), { FINAL: G.FINAL.curve.tierByUnits, BEFORE: G.BEFORE.curve.tierByUnits });
            check('SC-GATE-campaign: Campaign\'s radiusForUnits() FINAL = BEFORE', G.FINAL.curve.campaign.join() === G.BEFORE.curve.campaign.join(), {});
          }
        }
        if (only.includes('geom')) {
          const all = { BEFORE: await measurePage(S.BEFORE.page, RADII), FINAL: await measurePage(S.FINAL.page, RADII) };
          const T = geomTable(all); results.data.geom = T; results.data.measure = all;
          const bodies = Object.values(all.FINAL.hole).map(h => h.body);
          check('SC-GEOM-body: the vortex is drawn as an opaque disc 1.05-1.09 R at every radius, FINAL = BEFORE', bodies.every(b => b >= 1.05 && b <= 1.09) && JSON.stringify(Object.values(all.BEFORE.hole).map(h => h.body)) === JSON.stringify(bodies), { bodies });
          check('SC-GEOM-reach: no eat reach is past the drawn disc (objects 0.85 R, T1 fragment 1.0 R < disc)', 1.0 < Math.min(...bodies), { disc: Math.min(...bodies) });
          const Bf = T.filter(r => r.variant === 'BEFORE'), Fn = T.filter(r => r.variant === 'FINAL');
          check('SC-GEOM-before: BEFORE has the problem (>= 10 kinds whose disc is longer than them while locked)', Bf.filter(r => r.looksEatableShare > 0).length >= 10, Bf.map(r => [r.kind, r.looksEatableShare]));
          check('SC-GEOM-locked: FINAL, all 19 kinds: a locked object is never shorter than the vortex disc (L >= disc at the last locked radius, 0 % of the tier)', Fn.length === 19 && Fn.every(r => r.L_over_body_lockEnd >= 1.0 && r.looksEatableShare === 0), Fn.map(r => [r.kind, r.L_over_body_lockEnd, r.looksEatableShare]));
          check('SC-GEOM-unlock: FINAL, all 19 kinds: at unlock the object fits inside the disc (L <= 0.96 disc)', Fn.every(r => r.L_over_body_unlock <= 0.96), Fn.map(r => [r.kind, r.L_over_body_unlock]));
          const order = (rows, key) => [2, 3, 4, 5].every(t => Math.max(...rows.filter(r => r.tier === t).map(r => r[key])) < Math.min(...rows.filter(r => r.tier === t + 1).map(r => r[key])));
          check('SC-GEOM-order: FINAL keeps the tiers in order (every T(n) radius and picture smaller than every T(n+1))', order(Fn, 'r') && order(Fn, 'L'), [2, 3, 4, 5, 6].map(t => [t, Fn.filter(r => r.tier === t).map(r => r.r + '/' + r.L)]));
          check('SC-GEOM-bitmap: FINAL draws every kind from its approved bitmap at the new radius', Fn.every(r => r.bitmap), Fn.filter(r => !r.bitmap).map(r => r.kind));
        }
        if (only.includes('surge')) {
          const SU = { BEFORE: await surges(S.BEFORE.page), FINAL: await surges(S.FINAL.page) }; results.data.surge = SU;
          const B = SU.FINAL.tiers, BF = SU.BEFORE.tiers;
          check('SC-SURGE-ratio: FINAL, every threshold: one fragment 0.5 unit short of it takes the vortex x1.15-1.20 (BEFORE under x1.08)', B.every(x => x.ratio >= 1.15 && x.ratio <= 1.2) && BF.every(x => x.ratio < 1.08), { FINAL: B.map(x => [x.tier, x.ratio]), BEFORE: BF.map(x => [x.tier, x.ratio]) });
          check('SC-SURGE-time: FINAL: the jump takes 0.28-0.32 s, steadily (never shrinking)', B.every(x => x.durationS >= 0.28 && x.durationS <= 0.32 && x.monotonic), B.map(x => [x.tier, x.durationS, x.monotonic]));
          check('SC-SURGE-sync: FINAL: the drawn vortex is never smaller than the physical one, the eat reach always inside the drawn disc', B.every(x => x.minDrawnOverPhys >= 0.999 && x.minDiscOverReach > 1), B.map(x => [x.tier, x.minDrawnOverPhys, x.minDiscOverReach]));
          check('SC-SURGE-unlock: FINAL: the tier, its banner and the next tier\'s objects unlock only when the radius reaches the anchor', B.every(x => !x.canBeforeAnchor && !x.tierBeforeAnchor && x.unlockFrame === x.reachAnchorFrame && x.bannerFrame >= x.reachAnchorFrame), B.map(x => [x.tier, x.reachAnchorFrame, x.unlockFrame, x.bannerFrame]));
          check('SC-SURGE-rival: a rival crossing a tier jumps by the same rule', SU.FINAL.bot.surged && SU.FINAL.bot.frameAtAnchor > 0, SU.FINAL.bot);
          check('SC-SURGE-passive: a rival\'s passive growth across a tier jumps once (no gulp pop every frame)', SU.FINAL.passive.framesToAnchor > 0 && SU.FINAL.passive.pops <= 2, SU.FINAL.passive);
          check('SC-SURGE-cancel: eaten mid-jump, the vortex restarts at R 18 and the jump is dropped', SU.FINAL.cancel.startedJump && SU.FINAL.cancel.R === 18 && !SU.FINAL.cancel.surging, SU.FINAL.cancel);
          console.log('  equal rival 0.5 unit short of T3 when the player crosses it: BEFORE', JSON.stringify(SU.BEFORE.equalRival), 'FINAL', JSON.stringify(SU.FINAL.equalRival));
        }
        if (only.includes('start')) {
          const ST = { BEFORE: await starts(S.BEFORE.page), FINAL: await starts(S.FINAL.page) }; results.data.start = ST;
          check('SC-START: a fresh round: R 18, T1, same object and rival count as BEFORE', ST.FINAL.R0 === 18 && ST.FINAL.tier === 'T1' && ST.FINAL.objects === ST.BEFORE.objects && ST.FINAL.bots === ST.BEFORE.bots, { FINAL: [ST.FINAL.R0, ST.FINAL.tier, ST.FINAL.objects, ST.FINAL.bots], BEFORE: [ST.BEFORE.R0, ST.BEFORE.objects, ST.BEFORE.bots] });
          const E = await expectBotR(S.FINAL.page, ST.BEFORE.botR); results.data.botStart = { BEFORE: ST.BEFORE.botR, FINAL: ST.FINAL.botR, expect: E.exp };
          const inJump = Object.values(ST.FINAL.botR).flat().filter(r => E.jumps.some(([a, b]) => r >= a && r < b)).length;
          check('SC-START-rivals: careers 0-30 rounds: every rival starts at BEFORE\'s growth units (on the Arena curve), none inside a tier jump', Object.keys(E.exp).every(k => ST.FINAL.botR[k].every((r, i) => Math.abs(r - E.exp[k][i]) < 1e-6)) && inJump === 0, results.data.botStart);
          const fe = (v) => med(ST[v].firsts.map(x => x.firstEatSec ?? 99)), e10 = (v) => med(ST[v].firsts.map(x => x.eats10));
          check('SC-START-bite: the first bite as fast as BEFORE (median within +0.3 s) and as many bites in the first 10 s (median within -15 %)', fe('FINAL') <= fe('BEFORE') + 0.3 && e10('FINAL') >= e10('BEFORE') * 0.85, { first: [fe('BEFORE'), fe('FINAL')], eats10: [e10('BEFORE'), e10('FINAL')] });
        }
        if (only.includes('spawn')) {
          const sd = Array.from({ length: 50 }, (_, i) => 3000 + i * 7919);
          const L = { BEFORE: await layouts(S.BEFORE.page, sd), FINAL: await layouts(S.FINAL.page, sd) };
          results.data.spawn = Object.fromEntries(['BEFORE', 'FINAL'].map(v => [v, L[v].map(x => ({ seed: x.seed, n: x.n, waiting: x.waiting, overlaps: x.overlaps, phys: x.phys, wrongR: x.wrongR }))]));
          for (const v of ['BEFORE', 'FINAL']) check(`SC-SPAWN-${v}: 50 seeded layouts: nothing waiting, no two pictures or footprints overlapping`, L[v].every(x => x.waiting === 0 && x.overlaps === 0 && x.phys === 0), L[v].filter(x => x.waiting || x.overlaps || x.phys).map(x => [x.seed, x.waiting, x.overlaps, x.phys]));
          check('SC-SPAWN-rng: FINAL draws the same seeded stream and the same objects in the same order as BEFORE (tier and kind per slot)', L.FINAL.every((x, i) => x.rng === L.BEFORE[i].rng && x.kinds === L.BEFORE[i].kinds), {});
          check('SC-SPAWN-radii: FINAL lays every T2-T6 kind at its ARENA_KIND_RADIUS', L.FINAL.every(x => x.wrongR === 0), L.FINAL.filter(x => x.wrongR).map(x => [x.seed, x.wrongR]));
          const again = await layouts(S.FINAL.page, sd.slice(0, 10));
          check('SC-SPAWN-replay: FINAL, the same seed again = the same layout (10 seeds)', again.every((x, i) => x.hash === L.FINAL[i].hash), {});
          let moved = 0, tot = 0, far = 0; L.FINAL.forEach((x, i) => x.pos.forEach((p, j) => { const q = L.BEFORE[i].pos[j]; tot++; const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > 0) moved++; if (d > 60) far++; }));
          results.data.spawnShift = { moved, far, tot };
          console.log(`  spawn: ${moved} of ${tot} positions differ from BEFORE (${(100 * moved / tot).toFixed(1)} %), ${far} by more than 60 world units`);
        }
        if (only.includes('daily')) {
          const D = { BEFORE: await dailies(S.BEFORE.page), FINAL: await dailies(S.FINAL.page) }; results.data.daily = D;
          check('SC-DAILY: the Daily preview is exactly the Daily round and replays the same, BEFORE and FINAL (FINAL: kind radii, nothing waiting)', ['BEFORE', 'FINAL'].every(v => D[v].previewIsRound && D[v].replay && D[v].waiting === 0) && D.FINAL.crate === 26 && D.BEFORE.crate === 20 && D.FINAL.n === D.BEFORE.n && D.FINAL.dateKey === D.BEFORE.dateKey, D);
        }
        for (const v of ['BEFORE', 'FINAL']) if (S[v].errors.length) check(`SC-ERRORS-${v}: no page errors`, false, S[v].errors.slice(0, 5));
      } finally { for (const v of Object.keys(S)) await S[v].browser.close(); }
    }
    if (only.includes('mission')) {
      const sd = Array.from({ length: 40 }, (_, i) => 8000 + i * 13), MI = {};
      for (const v of ['BEFORE', 'FINAL']) { const g = await session(urls[v], 'mobile'); try { MI[v] = await missions(g.page, sd); } finally { await g.browser.close(); } }
      results.data.mission = MI;
      const ok = (r) => r.completed === (r.maxR >= MI.FINAL.task.target - 1e-9) && r.peak >= r.maxR - 1e-6;
      const rate = (v) => +(100 * MI[v].rounds.filter(r => r.completed).length / MI[v].rounds.length).toFixed(1);
      check('SC-MISSION-task: the daily task "Urośnij do rozmiaru T5" is reach_size_60, target R 90, reward 50, identical in BEFORE and FINAL', MI.FINAL.task.target === 90 && MI.FINAL.task.rewardCoins === 50 && JSON.stringify(MI.FINAL.task) === JSON.stringify(MI.BEFORE.task), { FINAL: MI.FINAL.task, BEFORE: MI.BEFORE.task });
      check('SC-MISSION-complete: FINAL, 40 rounds: the task is completed exactly when the round reached R 90 (peak = max radius)', MI.FINAL.rounds.every(ok), MI.FINAL.rounds.filter(r => !ok(r)));
      check('SC-MISSION-feasible: FINAL completes it in as many rounds as BEFORE (within 10 points)', Math.abs(rate('FINAL') - rate('BEFORE')) <= 10 && rate('FINAL') > 0, { BEFORE: rate('BEFORE'), FINAL: rate('FINAL') });
      check('SC-MISSION-replay: FINAL, the same seed twice = the same peak and the same result (5 seeds)', MI.FINAL.again.every((r, i) => r.peak === MI.FINAL.rounds[i].peak && r.completed === MI.FINAL.rounds[i].completed), { again: MI.FINAL.again, first: MI.FINAL.rounds.slice(0, 5) });
      console.log(`  mission reach_size_60 completion: BEFORE ${rate('BEFORE')} %, FINAL ${rate('FINAL')} %`);
    }
    if (only.includes('pace')) {
      const sd = Array.from({ length: seeds }, (_, i) => 5000 + i * 7);
      results.data.pace = {};
      for (const profile of profiles) {
        const P = {};
        for (const v of ['BEFORE', 'FINAL']) { const g = await session(urls[v], 'mobile'); try { P[v] = await paceRounds(g.page, sd, profile); } finally { await g.browser.close(); } }
        results.data.pace[profile] = P;
        const sum = paceSummary(P); results.data['paceSummary_' + profile] = sum;
        console.log('  pace', profile, JSON.stringify(sum));
        const b = sum.BEFORE, c = sum.FINAL;
        check(`SC-PACE-${profile}: FINAL reaches every tier T2-T6 within +-15 % of BEFORE (median, ${seeds} seeds)`, ['T2', 'T3', 'T4', 'T5', 'T6'].every(t => b[t] === 999 || (c[t] >= b[t] * 0.85 && c[t] <= b[t] * 1.15)), { FINAL: c, BEFORE: b });
        check(`SC-PACE-${profile}-size: FINAL ends as big as BEFORE (median R at 60 s and 120 s within +-10 %)`, Math.abs(c.R60 / b.R60 - 1) <= 0.1 && Math.abs(c.R120 / b.R120 - 1) <= 0.1, { R60: [b.R60, c.R60], R120: [b.R120, c.R120] });
        check(`SC-BOTS-${profile}: rivals gain no edge: the best rival's score median and mean within +10 % of BEFORE`, c.topBot <= b.topBot * 1.1 && c.topBotMean <= b.topBotMean * 1.1, { median: [b.topBot, c.topBot], mean: [b.topBotMean, c.topBotMean] });
        check(`SC-PLAYER-${profile}: the player keeps the same odds: win rate within 5 points, eaten as often (mean within +0.15), score median within +-10 %`, Math.abs(c.winPct - b.winPct) <= 5 && c.deathsMean <= b.deathsMean + 0.15 && Math.abs(c.score / b.score - 1) <= 0.1, { win: [b.winPct, c.winPct], deaths: [b.deathsMean, c.deathsMean], score: [b.score, c.score], rivalsEaten: [b.rivalsEatenMean, c.rivalsEatenMean] });
      }
    }
    if (only.includes('perf')) {
      const P = await perf(urls, reps); results.data.perf = P;
      for (const [key, d] of Object.entries(P)) {
        const b = med(d.BEFORE.map(x => x.median)), c = med(d.FINAL.map(x => x.median)), bp = med(d.BEFORE.map(x => x.p95)), cp = med(d.FINAL.map(x => x.p95));
        check(`SC-PERF-${key}: FINAL render median and p95 within +10 % of BEFORE (Chromium emulation, pages alternated)`, c <= b * 1.10 + 0.05 && cp <= bp * 1.10 + 0.1, { median: [b, c], p95: [bp, cp] });
      }
    }
  } finally { srv.BEFORE.server.close(); srv.FINAL.server.close(); }
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, `results${tag ? '-' + tag : ''}.json`), JSON.stringify(results, null, 1));
  return results;
}

if (isMain(import.meta.url)) {
  const base = opt('base', null);
  if (!base) { console.error('--base=DIR (a checkout of production, the code before this stage) is required'); process.exit(2); }
  const only = opt('only', 'contract,geom,gate,surge,start,spawn,daily,mission,pace,perf').split(',');
  run({ base, only, seeds: +opt('seeds', 100), reps: +opt('reps', 6), profiles: opt('profiles', 'weteran,nowy').split(','), tag: opt('tag', '') }).then((r) => {
    const f = r.checks.filter(c => !c.ok);
    console.log(`\n${r.checks.length - f.length} PASS, ${f.length} FAIL`);
    process.exit(f.length ? 1 : 0);
  }, (e) => { console.error(e); process.exit(1); });
}
