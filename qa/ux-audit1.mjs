// GG-UX-AUDIT-1: diagnostics for the owner's six reports (audit only -- this
// script changes no game code, balance, save format or art). Dev-only.
//   node qa/ux-audit1.mjs                      # every part
//   node qa/ux-audit1.mjs --only=cards,ranking # some parts
// Parts: districts (1), controls (2), reward (3), cards (4), cosmetics (5),
// ranking (6). Raw output: qa/out/ux-audit1/*.json + *.png; the report
// (docs/GG_UX_AUDIT_1.md) quotes the numbers, design/ux-audit-1/ keeps a
// chosen subset of the images.
//
// Evidence kinds (the report keeps them apart):
//  - DOM: a real Playwright click / key press / mouse move on the page;
//  - FN: a call of the game's own function (e.g. pickMutation(id), the one
//    the card's click handler calls) -- not a full user path;
//  - SIM: a bot round in virtual time (lib.mjs ARENA_BOT style), seeded.
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, ARENA_BOT, QA_RANDOM, OUT, isMain } from './lib.mjs';

const DIR = path.join(OUT, 'ux-audit1');
fs.mkdirSync(DIR, { recursive: true });
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const want = (p) => !only.length || only.includes(p);
const write = (name, data) => fs.writeFileSync(path.join(DIR, name), JSON.stringify(data, null, 2));
const log = (...a) => console.log('[ux-audit1]', ...a);

// ---------------------------------------------------------------- in-page lib
const AUDIT_LIB = `
window.__audit = (function () {
  const A = {};
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  A.vnow = 0;
  window.__RT = CONFIG.round.duration;
  A.clockOn = function (t0) { A.vnow = t0 != null ? t0 : 1e6; performance.now = () => A.vnow; };
  A.clockOff = function () { performance.now = realNow; };
  /** Starts a detached Arena round on the virtual clock (no RAF). */
  A.start = function (opts) {
    opts = opts || {};
    const g = window.game;
    A.clockOn(opts.clock0);
    if (opts.noEvolution) g.checkEvolutionTriggers = () => {}; else delete g.checkEvolutionTriggers;
    g.startRound({ seed: opts.seed != null ? opts.seed : 4242 });
    if (g.rafId) cancelAnimationFrame(g.rafId);
    g.running = false;
    g.paused = false;
    // the start-of-round protection and the coach would blur the micro scenes
    if (opts.calm) { g.bannerQueue = []; g.banner = null; }
    return g;
  };
  A.step = function (n, dt) {
    const g = window.game; dt = dt || 1 / 30;
    for (let i = 0; i < n && g.state === GameState.PLAYING; i++) { A.vnow += dt * 1000; g.update(dt); }
  };
  /** Moves every rival far away and keeps it there (a quiet scene). */
  A.parkBots = function () {
    const g = window.game;
    g.bots.forEach((b, i) => { b.x = 150 + i * 60; b.y = 150; b.radius = 15; b.update = function () {}; });
  };
  /** Clears objects near (x, y) so a micro scene controls what is there. */
  A.clearAround = function (x, y, R) {
    const g = window.game;
    for (const o of g.objects) if (Math.hypot(o.x - x, o.y - y) < R && o.tier !== 'golden') { o.x = 2900; o.y = 2900 - Math.random() * 50; }
  };
  A.fragment = function (x, y) {
    const g = window.game;
    const o = g.objects.find(ob => ob.tier === 'fragment' && !ob.eating && !ob.__used && Math.hypot(ob.x - g.player.x, ob.y - g.player.y) > 700);
    o.__used = true; o.x = x; o.y = y; return o;
  };
  return A;
})();
`;

/** Casual-bot round with an observer (lib.mjs ARENA_BOT, style casual). */
const playRound = (page, o) => page.evaluate((o) => {
  window.__qaSeedRandom(o.rand);
  try { return window.__qaPlayArena(Object.assign({ style: 'casual', clock0: 1000000, noRender: true }, o.opts || {})); }
  finally { window.__qaRestoreRandom(); }
}, o);

async function freshPage(url, opts = {}) {
  const g = await openGame(url, opts);
  for (const content of [ARENA_BOT, QA_RANDOM, AUDIT_LIB]) await g.page.addScriptTag({ content });
  return g;
}
async function seedSave(g, save) {
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state !== undefined);
  for (const content of [ARENA_BOT, QA_RANDOM, AUDIT_LIB]) await g.page.addScriptTag({ content });
}

// =================================================================== (6) ranking
async function partRanking(url) {
  const g = await freshPage(url, { mobile: false, viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const out = { note: 'SIM: casual bot, virtual time, seeded; growth sources instrumented by wrapping growUnits/growFromArea', careers: [] };
  // runsPlayed -> difficultyT: 3 -> 0, 10 -> 0.33, 24 -> 1 (CONFIG.difficulty)
  for (const runs of [3, 10, 24]) {
    const save = await veteranSave(g.page, { runsPlayed: runs });
    // the pacer's par = median of recent finished rounds; a casual player's typical round
    save.stats.recentArenaScores = runs >= 3 ? [2400, 2600, 2800, 3000, 3200] : [];
    await seedSave(g, save);
    for (let s = 0; s < 8; s++) {
      const res = await g.page.evaluate(({ seed, rand }) => {
        const g = window.game;
        const orig = g.startRound;
        const holes = () => [g.player, ...g.bots];
        const samples = [], conflicts = [], comboMults = [];
        const origCombo = g.registerCombo.bind(g);
        g.registerCombo = function () { const m = origCombo(); comboMults.push(m); return m; };
        g.startRound = function (o) {
          orig.call(this, Object.assign({}, o, { seed }));
          holes().forEach(h => {
            h.__src = { objUnits: 0, objUnitsBase: 0, holeUnits: 0, passiveUnits: 0, deaths: 0, objPts: 0, holePts: 0, startR: h.radius };
            const gu = h.growUnits.bind(h), ga = h.growFromArea.bind(h);
            h.growUnits = function (u) { this.__src.objUnits += u; this.__src.objUnitsBase += u / (this.isPlayer ? 1 : Math.min(this.paceMult || 1, CONFIG.rival.maxGrowthBoost)); return gu(u); };
            h.growFromArea = function (a) { const u0 = unitsForRadius(this.radius); const r = ga(a); this.__src.holeUnits += unitsForRadius(this.radius) - u0; return r; };
            h.__lastR = h.radius; h.__lastScore = 0;
          });
        };
        window.__qaSeedRandom(rand);
        let res;
        try {
          res = window.__qaPlayArena({ style: 'casual', clock0: 1000000, noRender: true, onFrame: (f, gg) => {
            const dt = 1 / 30, t = +(f * dt).toFixed(2);
            for (const h of holes()) {
              if (!h.isPlayer && !h.waiting && gg.botTuning.passive > 0 && h.radius < CONFIG.hole.maxRadius) h.__src.passiveUnits += gg.botTuning.passive * dt;
              if (h.radius < h.__lastR - 4) h.__src.deaths++;
              h.__lastR = h.radius;
            }
            const ranked = rankHoles(holes());
            const p = gg.player;
            if (f % 30 === 0) {
              const leader = ranked[0] === p;
              const bigger = gg.bots.filter(b => !b.waiting && b.radius > p.radius);
              const threats = gg.bots.filter(b => !b.waiting && b.radius > p.radius * CONFIG.eating.holeRatio);
              if (leader && bigger.length) conflicts.push({ t, playerScore: p.score, playerR: +p.radius.toFixed(1),
                bigger: bigger.map(b => ({ name: b.name, score: b.score, place: ranked.indexOf(b) + 1, r: +b.radius.toFixed(1), canEatPlayer: b.radius > p.radius * CONFIG.eating.holeRatio, dist: Math.round(Math.hypot(b.x - p.x, b.y - p.y)), pacer: b === gg.pacer })),
                threats: threats.length });
            }
            if (f % 150 === 0) samples.push({ t, holes: ranked.map((h, i) => ({ name: h.isPlayer ? 'GRACZ' : h.name, pacer: h === gg.pacer, place: i + 1, score: h.score, r: +h.radius.toFixed(1), paceMult: h.paceMult ? +h.paceMult.toFixed(2) : null, deaths: h.__src.deaths })) });
          } });
        } finally { window.__qaRestoreRandom(); g.startRound = orig; g.registerCombo = origCombo; }
        const ranked = rankHoles(holes());
        const fin = ranked.map((h, i) => ({ name: h.isPlayer ? 'GRACZ' : h.name, pacer: h === g.pacer, place: i + 1, score: h.score, r: +h.radius.toFixed(1),
          src: { objUnits: +h.__src.objUnits.toFixed(1), objUnitsWithoutPaceBoost: +h.__src.objUnitsBase.toFixed(1), holeUnits: +h.__src.holeUnits.toFixed(1), passiveUnits: +h.__src.passiveUnits.toFixed(1), deaths: h.__src.deaths },
          ptsPerObjUnit: h.__src.objUnits ? +(h.score / (h.__src.objUnits + h.__src.holeUnits)).toFixed(2) : null }));
        const avgCombo = comboMults.length ? +(comboMults.reduce((a, b) => a + b, 0) / comboMults.length).toFixed(3) : null;
        return { place: res.place, deaths: res.deaths, difficulty: res.difficulty, botTuning: g.botTuning, par: g.parScore, avgPlayerCombo: avgCombo, final: fin, conflictSeconds: conflicts.length, conflicts, samples };
      }, { seed: 7000 + s, rand: 9000 + s * 17 + runs });
      out.careers.push({ runs, seed: 7000 + s, ...res });
      log(`ranking runs=${runs} seed=${7000 + s}: place ${res.place}, deaths ${res.deaths}, leader-but-smaller seconds ${res.conflictSeconds}`);
    }
  }
  // summary
  const summary = [];
  for (const runs of [3, 10, 24]) {
    const rs = out.careers.filter(c => c.runs === runs);
    const clean = rs.filter(c => c.deaths === 0 && c.place === 1);
    summary.push({ runs, difficulty: rs[0].difficulty, rounds: rs.length, wins: rs.filter(c => c.place === 1).length,
      winsNeverEaten: clean.length, winsNeverEatenWithBiggerBotSeconds: clean.filter(c => c.conflictSeconds > 0).length,
      avgConflictSeconds: +(rs.reduce((a, c) => a + c.conflictSeconds, 0) / rs.length).toFixed(1),
      avgThreatSecondsWhileLeading: +(rs.reduce((a, c) => a + c.conflicts.filter(x => x.threats > 0).length, 0) / rs.length).toFixed(1),
      avgPlayerCombo: +(rs.reduce((a, c) => a + (c.avgPlayerCombo || 1), 0) / rs.length).toFixed(3),
      playerPtsPerUnit: +(rs.reduce((a, c) => a + (c.final.find(h => h.name === 'GRACZ').ptsPerObjUnit || 0), 0) / rs.length).toFixed(2),
      botPtsPerUnit: +(rs.reduce((a, c) => a + c.final.filter(h => h.name !== 'GRACZ' && !h.pacer).reduce((x, h) => x + (h.ptsPerObjUnit || 0), 0) / 4, 0) / rs.length).toFixed(2),
      botPassiveShareOfUnits: +(rs.reduce((a, c) => { const bots = c.final.filter(h => h.name !== 'GRACZ'); const p = bots.reduce((x, h) => x + h.src.passiveUnits, 0), all = bots.reduce((x, h) => x + h.src.passiveUnits + h.src.objUnits + h.src.holeUnits, 0); return a + (all ? p / all : 0); }, 0) / rs.length).toFixed(3) });
  }
  out.summary = summary;
  write('ranking.json', out);
  log('ranking summary', JSON.stringify(summary));
  // danger cue vs swallow reach (FN, virtual clock): a bigger rival parked at distance d
  out.dangerVsReach = await g.page.evaluate(() => {
    const A = window.__audit, rows = [];
    for (const [pr, br] of [[60, 120], [200, 300], [200, 420], [300, 480]]) {
      for (const frac of [0.95, 0.7]) {
        const g = A.start({ seed: 31, noEvolution: true });
        A.parkBots();
        const p = g.player, b = g.bots[0];
        p.x = 1500; p.y = 1500; p.radius = pr; p.invulnerableUntil = 0; g.keyDir = { x: 0, y: 0 }; g.pointerScreen = null;
        const d = Math.round(br * 0.75 * frac);
        b.radius = br; b.x = 1500 + d; b.y = 1500; b.invulnerableUntil = 0;
        g.dangerWarned = new Set();
        g.updateDangerWarnings();
        const warned = g.dangerWarned.has(b);
        const haloDrawn = d <= CONFIG.juice.dangerHaloRange;
        g.handleHoleCollisions();
        rows.push({ playerR: pr, rivalR: br, centreDist: d, eatReach: Math.round(br * 0.75), haloRange: CONFIG.juice.dangerHaloRange, warnedBeforeContact: warned, haloDrawn, eatenThisFrame: p.radius < pr - 4 });
      }
    }
    A.clockOff();
    return rows;
  });
  // one example: a fresh round stopped at the first moment the player leads on points, was never
  // eaten, and a bigger rival that could eat it is on screen -- the screenshot is that exact frame
  for (let k = 0; k < 6 && !out.exampleShot; k++) {
    const save = await veteranSave(g.page, { runsPlayed: 6 });
    save.stats.recentArenaScores = [2400, 2600, 2800, 3000, 3200];
    await seedSave(g, save);
    const shot = await g.page.evaluate(({ seed, rand }) => {
      const g = window.game; const orig = g.startRound;
      g.startRound = function (o) { orig.call(this, Object.assign({}, o, { seed })); };
      window.__qaSeedRandom(rand);
      let hit = null, deaths = 0, lastR = null;
      try { window.__qaPlayArena({ style: 'casual', clock0: 1000000, noRender: true, onFrame: (f, gg) => {
        const p = gg.player; if (lastR != null && p.radius < lastR - 4) deaths++; lastR = p.radius;
        if (f < 30 * 40 || deaths || hit) return;
        const ranked = rankHoles([p, ...gg.bots]);
        const big = gg.bots.filter(b => !b.waiting && b.radius > p.radius * CONFIG.eating.holeRatio && gg.isInView(b.x, b.y, 0));
        if (ranked[0] === p && big.length) { hit = { t: +(f / 30).toFixed(1), standings: ranked.map((h, i) => (i + 1) + '. ' + (h.isPlayer ? 'GRACZ' : h.name) + ' ' + h.score + ' pkt, r=' + Math.round(h.radius)) }; gg.state = 'audit-stop'; }
      } }); } finally { window.__qaRestoreRandom(); g.startRound = orig; }
      if (!hit) return null;
      g.state = GameState.PLAYING; g.updateHUD(); g.render(hit.t);
      return hit;
    }, { seed: 7100 + k, rand: 9100 + k });
    if (shot) { await g.page.screenshot({ path: path.join(DIR, 'ranking-leader-smaller.png') }); out.exampleShot = { seed: 7100 + k, ...shot }; }
  }
  write('ranking.json', out);
  await g.browser.close();
}

// =================================================================== (4) cards
async function partCards(url) {
  const g = await freshPage(url, { mobile: false, viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const save = await veteranSave(g.page, { runsPlayed: 3 });
  await seedSave(g, save);
  const page = g.page;
  const out = { note: 'FN = pickMutation(id) (the card click handler) on the virtual clock; DOM = a real click on the card', micro: {}, rounds: {} };

  // --- DOM wiring: a real click on the offered card reaches the round state
  out.domPick = await page.evaluate(async () => {
    const g = window.game;
    window.__audit.start({ seed: 51, noEvolution: true });
    g.player.radius = 47;
    delete g.checkEvolutionTriggers;
    g.checkEvolutionTriggers();
    const cards = [...document.querySelectorAll('#evolutionCards .evolution-card, #evolutionCards button')];
    return { pending: g.evolutionPending, cards: cards.map(c => (c.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 60)) };
  });
  const cardEl = await page.$('#evolutionCards .evolution-card, #evolutionCards button');
  if (cardEl) { await cardEl.click(); }
  out.domPick.after = await page.evaluate(() => ({ pending: window.game.evolutionPending, active: [...window.game.activeMutations] }));
  await page.screenshot({ path: path.join(DIR, 'cards-offer-after-click.png') });
  // reset between rounds
  out.resetBetweenRounds = await page.evaluate(() => {
    const g = window.game; const before = [...g.activeMutations];
    ['magnet_pulse', 'combo_reactor', 'bounty_core', 'scanner'].forEach(id => { g.evolutionPending = true; g.pickMutation(id); });
    const mid = { active: [...g.activeMutations], comboWindowOverride: g.comboWindowOverride, magnetUntil: g.magnetUntil, bounty: !!g.bountyTarget };
    window.__audit.start({ seed: 52, noEvolution: true });
    return { before, mid, afterNewRound: { active: [...g.activeMutations], comboWindowOverride: g.comboWindowOverride, magnetUntil: g.magnetUntil, bounty: !!g.bountyTarget, speedBoostUntil: g.speedBoostUntil, scannerTarget: !!g.scannerTarget } };
  });

  // --- micro scenes (FN, virtual clock, same seed and layout with/without the card)
  const micro = (fnSrc, arg) => page.evaluate(({ fnSrc, arg }) => { const fn = new Function('A', 'g', 'card', 'arg', fnSrc); const res = {}; for (const card of [null, arg.card]) { const A = window.__audit; const g = A.start({ seed: arg.seed || 61, noEvolution: true }); A.step(80); A.parkBots(); g.player.invulnerableUntil = 0; if (card) { g.evolutionPending = true; g.pickMutation(card); } res[card ? 'with' : 'without'] = fn(A, g, card, arg); } window.__audit.clockOff(); return res; }, { fnSrc, arg });

  // Magnes: 10 fragments around a still player at d = 60..150, 3 s
  for (const R of [30, 90, 170]) {
    out.micro['magnet_r' + R] = await micro(`
      const p = g.player; p.x = 1500; p.y = 1500; p.radius = arg.R; g.keyDir = { x: 0, y: 0 }; g.pointerScreen = null;
      A.clearAround(1500, 1500, 400);
      const objs = []; for (let i = 0; i < 10; i++) { const a = i * 0.628, d = arg.R * 0.9 + 10 + i * 9; objs.push(A.fragment(1500 + Math.cos(a) * d, 1500 + Math.sin(a) * d)); }
      const d0 = objs.map(o => Math.hypot(o.x - p.x, o.y - p.y));
      A.step(90);
      const eaten = objs.filter(o => o.eating || o.consumed || Math.hypot(o.x - 1500, o.y - 1500) > 600).length;
      const moved = objs.map((o, i) => d0[i] - Math.hypot(o.x - p.x, o.y - p.y));
      return { startDist: d0.map(Math.round), eatenIn3s: eaten, meanApproachPx: +(moved.reduce((a, b) => a + b, 0) / moved.length).toFixed(1), ringDrawn: performance.now() < g.magnetUntil && p.radius < CONFIG.evolution.magnetRadius };
    `, { card: 'magnet_pulse', R });
  }
  // Turbo combo: a line of fragments, steer right, speed after the 3rd bite
  out.micro.slipstream = await micro(`
    const p = g.player; p.x = 1000; p.y = 1500; p.radius = 30; A.clearAround(1300, 1500, 500);
    for (let i = 0; i < 6; i++) A.fragment(1040 + i * 22, 1500);
    g.keyDir = { x: 1, y: 0 };
    const xs = []; let boosted = 0;
    for (let f = 0; f < 120; f++) { A.step(1); xs.push(p.x); if (p.tempSpeedMult > 1.05) boosted++; }
    const v = (a, b) => +((xs[b] - xs[a]) / ((b - a) / 30)).toFixed(1);
    return { combo: g.comboCount, speedPxPerSec_0to1s: v(0, 29), speedPxPerSec_1to2s: v(30, 59), speedPxPerSec_2to4s: v(60, 119), framesBoosted: boosted, boostSeconds: +(boosted / 30).toFixed(2) };
  `, { card: 'slipstream' });
  // Tarcza: a big rival lands on the player
  out.micro.phase_edge = await micro(`
    const p = g.player; p.x = 1500; p.y = 1500; p.radius = 30;
    const b = g.bots[1]; delete b.update; b.radius = 90; b.x = 1500; b.y = 1500; b.invulnerableUntil = 0;
    A.step(1);
    const prot = p.invulnerableUntil - performance.now();
    b.update = function () {};
    return { eaten: p.radius < 25, protectionMs: Math.round(prot) };
  `, { card: 'phase_edge' });
  // Długie combo: bite, wait 2.5 s, bite again
  out.micro.combo_reactor = await micro(`
    const p = g.player; p.x = 1500; p.y = 1500; p.radius = 30; g.keyDir = { x: 0, y: 0 }; A.clearAround(1500, 1500, 300);
    A.fragment(1500, 1500); A.step(10);
    const timerAfterBite = +g.comboTimer.toFixed(2);
    A.step(75);
    const comboAfter2_5s = g.comboCount;
    A.fragment(p.x, p.y); A.step(10);
    return { timerAfterBite, comboAfter2_5s, multiplierOnSecondBite: +g.comboMultiplier.toFixed(2), comboCount: g.comboCount };
  `, { card: 'combo_reactor' });
  // Fala: a tier-up next to 8 fragments, then 1 s of standing still
  out.micro.shockwave = await micro(`
    const p = g.player; p.x = 1500; p.y = 1500; g.keyDir = { x: 0, y: 0 }; A.clearAround(1500, 1500, 400);
    p.radius = 65; g.lastSizeTierId = CONFIG.sizeTiers.find(t => t.minRadius <= 46 && t.minRadius > 30).id;
    const objs = []; for (let i = 0; i < 8; i++) { const a = i * 0.785, d = 20 + i * 12; objs.push(A.fragment(1500 + Math.cos(a) * d, 1500 + Math.sin(a) * d)); }
    const d0 = objs.map(o => Math.round(Math.hypot(o.x - p.x, o.y - p.y)));
    p.radius = 67; g.checkSizeTier();
    const d1 = objs.map(o => Math.round(Math.hypot(o.x - p.x, o.y - p.y)));
    A.step(30);
    return { inReachBefore: d0.filter(d => d < p.radius * 0.85).length, inReachAfter: d1.filter(d => d < p.radius * 0.85).length, distBefore: d0, distRightAfterTierUp: d1, eatenIn1s: objs.filter(o => o.eating || o.consumed || Math.hypot(o.x - 1500, o.y - 1500) > 600).length, reach085: Math.round(p.radius * 0.85) };
  `, { card: 'shockwave' });
  // Łowca: who gets the reticle, and the bonus for eating it
  out.micro.bounty_core = await micro(`
    const p = g.player; p.x = 1500; p.y = 1500; p.radius = 60;
    const b = g.bountyTarget || g.bots[2]; delete b.update; b.radius = 20; b.x = 1530; b.y = 1500; b.invulnerableUntil = 0;
    g.comboCount = 0; g.comboMultiplier = 1; g.comboTimer = 0;
    const s0 = p.score; A.step(1);
    return { targetAssigned: !!card && b === (g.bountyTarget || b), pointsForEatingIt: p.score - s0, bountyAfter: g.bountyTarget ? g.bountyTarget.name : null };
  `, { card: 'bounty_core' });

  // --- full rounds (SIM, casual bot): the card picked at the first offer, second offer skipped
  const cards = [null, 'magnet_pulse', 'slipstream', 'phase_edge', 'combo_reactor', 'scanner', 'shockwave', 'bounty_core'];
  for (const card of cards) {
    const rows = [];
    for (let s = 0; s < 10; s++) {
      const r = await page.evaluate(({ card, seed, rand }) => {
        const g = window.game; const orig = g.startRound;
        const m = { picks: 0, pickAt: null, pickR: null, boostedFrames: 0, distance: 0, magnetFrames: 0, magnetPulledMax: 0,
          scannerPings: [], bounty: null, bountyEaten: 0, tierUpsAfterPick: 0, shoveObjects: 0, deaths: 0, protMs: [] };
        // the same career point for every condition (finished rounds raise the difficulty)
        delete g.checkEvolutionTriggers; delete g.checkOverdriveTrigger;
        g.save.stats.runsPlayed = 3; g.save.stats.recentArenaScores = [2400, 2600, 2800, 3000, 3200];
        g.startRound = function (o) { orig.call(this, Object.assign({}, o, { seed })); };
        const origOffer = g.offerEvolution.bind(g);
        g.offerEvolution = function () {
          this.evolutionPending = true;
          if (m.picks === 0 && card) { m.picks++; m.pickAt = +(window.__RT - this.timeRemaining).toFixed(1); m.pickR = Math.round(this.player.radius); this.pickMutation(card);
            if (card === 'bounty_core' && this.bountyTarget) m.bounty = { name: this.bountyTarget.name, r: Math.round(this.bountyTarget.radius), playerR: Math.round(this.player.radius), eatable: this.player.radius > this.bountyTarget.radius * CONFIG.eating.holeRatio, dist: Math.round(Math.hypot(this.bountyTarget.x - this.player.x, this.bountyTarget.y - this.player.y)) };
          } else { m.picks++; this.skipEvolutionOffer(); }
        };
        const origTier = g.checkSizeTier.bind(g);
        g.checkSizeTier = function () { const id = this.lastSizeTierId; origTier(); if (this.lastSizeTierId !== id && m.pickAt != null) m.tierUpsAfterPick++; };
        let lastX = null, lastY = null, lastR = null, lastPing = null;
        window.__qaSeedRandom(rand);
        let res;
        try {
          res = window.__qaPlayArena({ style: 'casual', clock0: 1000000, noRender: true, onFrame: (f, gg) => {
            const p = gg.player;
            if (lastX != null && p.radius >= lastR - 4) m.distance += Math.hypot(p.x - lastX, p.y - lastY);
            if (lastR != null && p.radius < lastR - 4) { m.deaths++; m.protMs.push(Math.round(p.invulnerableUntil - performance.now())); }
            lastX = p.x; lastY = p.y; lastR = p.radius;
            if (gg.player.tempSpeedMult >= CONFIG.evolution.slipstreamSpeedMult - 0.01 && !gg.frenzyActive) m.boostedFrames++;
            if (gg.magnetPulled.length) { m.magnetFrames++; m.magnetPulledMax = Math.max(m.magnetPulledMax, gg.magnetPulled.length); }
            if (gg.scannerTarget && gg.scannerTargetUntil !== lastPing) {
              lastPing = gg.scannerTargetUntil; const t = gg.scannerTarget;
              if (!t.__auditId) t.__auditId = Math.random().toString(36).slice(2, 8);
              m.scannerPings.push({ id: t.__auditId, tier: t.tier, value: t.value, eatable: gg.holeCanEat(p, t), inView: gg.isInView(t.x, t.y, t.radius), dist: Math.round(Math.hypot(t.x - p.x, t.y - p.y)) });
            }
            if (gg.__bountyWas && !gg.bountyTarget && m.bounty) m.bountyEaten++;
            gg.__bountyWas = !!gg.bountyTarget;
          } });
        } finally { window.__qaRestoreRandom(); g.startRound = orig; g.offerEvolution = origOffer; g.checkSizeTier = origTier; }
        return { score: res.score, place: res.place, radius: res.radius, deaths: res.deaths, ...m, scannerPings: m.scannerPings.length, scannerInView: m.scannerPings.filter(x => x.inView).length, scannerEatable: m.scannerPings.filter(x => x.eatable).length, scannerEatableInView: m.scannerPings.filter(x => x.eatable && x.inView).length, scannerMedianDist: m.scannerPings.length ? m.scannerPings.map(x => x.dist).sort((a, b) => a - b)[Math.floor(m.scannerPings.length / 2)] : null, scannerTiers: [...new Set(m.scannerPings.map(x => x.tier))], scannerDistinctTargets: new Set(m.scannerPings.map(x => x.id)).size };
      }, { card, seed: 8100 + s, rand: 5100 + s * 31 });
      rows.push(r);
    }
    const avg = (k) => +(rows.reduce((a, r) => a + (r[k] || 0), 0) / rows.length).toFixed(1);
    out.rounds[card || 'none'] = { avgScore: avg('score'), avgPlace: avg('place'), avgRadius: avg('radius'), avgDeaths: avg('deaths'), avgPickAt: avg('pickAt'), avgPickR: avg('pickR'),
      avgBoostSeconds: +(rows.reduce((a, r) => a + r.boostedFrames, 0) / rows.length / 30).toFixed(2), avgDistance: avg('distance'), avgMagnetSeconds: +(rows.reduce((a, r) => a + r.magnetFrames, 0) / rows.length / 30).toFixed(1),
      scanner: { pings: avg('scannerPings'), inView: avg('scannerInView'), eatable: avg('scannerEatable'), eatableInView: avg('scannerEatableInView'), medianDist: avg('scannerMedianDist'), distinctTargets: avg('scannerDistinctTargets'), tiers: [...new Set(rows.flatMap(r => r.scannerTiers))] },
      bounty: rows.map(r => r.bounty).filter(Boolean), bountyEatenRounds: rows.filter(r => r.bountyEaten > 0).length,
      tierUpsAfterPick: avg('tierUpsAfterPick'), protectionMsAfterDeath: rows.flatMap(r => r.protMs), rows };
    log('cards', card || 'none', JSON.stringify({ score: out.rounds[card || 'none'].avgScore, place: out.rounds[card || 'none'].avgPlace }));
  }
  write('cards.json', out);
  await g.browser.close();
}

// =================================================================== (3) reward -> "ZAŁÓŻ W WARSZTACIE"
async function partReward(url) {
  const out = { note: 'SIM round (bot) to earn the reward, then DOM: the real unlock card, a real click on its CTA, the Warsztat as it opens', cases: [] };
  const cats = { 2: 'aura', 3: 'skin', 4: 'effect', 5: 'overdriveSkin', 6: 'bundle' };
  const tabs = ['tabSkins', 'tabAuras', 'tabEffects', 'tabOverdrive'];
  for (const [lvl, cat] of Object.entries(cats)) {
    for (const lastTab of [null, 'tabEffects']) {
      const g = await freshPage(url, { viewport: { width: 375, height: 667 } });
      const save = await veteranSave(g.page, { runsPlayed: 8 });
      save.hub.coreLevel = Number(lvl) - 1; save.hub.coreCharge = 99;
      await seedSave(g, save);
      const page = g.page;
      if (lastTab) { // the player looked at another Warsztat tab earlier this session
        await page.click('#btnNavWarsztat'); await page.click('#' + lastTab); await page.click('#btnNavMiasto');
      }
      const before = await page.evaluate(() => ({ skin: game.save.selected, aura: game.save.auras.selected, effect: game.save.effects.selected, overdrive: game.save.overdriveSkins.selected }));
      await playRound(page, { rand: 777 + Number(lvl) });
      // the unlock card(s) appear after the result's animation
      let found = null;
      for (let k = 0; k < 6 && !found; k++) {
        await page.waitForFunction(() => !document.getElementById('unlockOverlay').classList.contains('hidden'), null, { timeout: 8000 }).catch(() => {});
        const card = await page.evaluate(() => ({ visible: !document.getElementById('unlockOverlay').classList.contains('hidden'), eyebrow: document.getElementById('unlockEyebrow').textContent, title: document.getElementById('unlockTitle').textContent, desc: document.getElementById('unlockDesc').textContent, cta: document.getElementById('btnUnlockGo').classList.contains('hidden') ? null : document.getElementById('btnUnlockGo').textContent, later: document.getElementById('btnUnlockLater').textContent }));
        if (!card.visible) break;
        if (/CORE CITY/.test(card.eyebrow)) { found = card; break; }
        await page.click('#btnUnlockLater'); await page.waitForTimeout(500);
      }
      if (!found) { out.cases.push({ lvl, cat, lastTab, error: 'no reward card' }); await g.browser.close(); continue; }
      await page.waitForTimeout(2600); // card animation (crack, icon, text, buttons)
      if (!lastTab) await page.screenshot({ path: path.join(DIR, `reward-card-lvl${lvl}.png`) });
      await page.click('#btnUnlockGo');
      await page.waitForTimeout(600);
      const after = await page.evaluate(({ tabs, cat }) => {
        const activeTab = tabs.find(t => document.getElementById(t).classList.contains('active'));
        const grid = { skin: 'skinGrid', aura: 'auraGrid', effect: 'effectGrid', overdriveSkin: 'overdriveSkinGrid' };
        const ids = { aura: game.save.auras.owned.slice(-1)[0], skin: game.save.owned.slice(-1)[0], effect: game.save.effects.owned.slice(-1)[0], overdriveSkin: game.save.overdriveSkins.owned.slice(-1)[0] };
        const target = cat === 'bundle' ? 'skin' : cat;
        const card = document.querySelector(`#${grid[target]} .skin-card[data-item="${ids[target]}"]`);
        const r = card && card.getBoundingClientRect();
        const gridVisible = card && !document.getElementById(grid[target]).classList.contains('hidden');
        return { screen: ['shopScreen', 'mainMenu', 'gameOverScreen'].find(s => !document.getElementById(s).classList.contains('hidden')), activeTab, rewardItem: ids[target], rewardGridVisible: !!gridVisible,
          rewardCardInViewport: !!(gridVisible && r && r.bottom > 0 && r.top < innerHeight && r.width > 0), rewardCardClasses: card ? card.className : null, focus: game.warsztatFocus ? game.warsztatFocus.item.id : null,
          equipped: { skin: game.save.selected, aura: game.save.auras.selected, effect: game.save.effects.selected, overdrive: game.save.overdriveSkins.selected } };
      }, { tabs, cat });
      await page.screenshot({ path: path.join(DIR, `reward-after-cta-lvl${lvl}${lastTab ? '-after-' + lastTab : ''}.png`) });
      out.cases.push({ lvl: Number(lvl), cat, lastTabBefore: lastTab, card: found, before, after });
      log('reward', lvl, cat, lastTab || '-', JSON.stringify({ tab: after.activeTab, visible: after.rewardCardInViewport, equipped: after.equipped }));
      await g.browser.close();
    }
  }
  write('reward.json', out);
}

// =================================================================== (1) districts
async function partDistricts(url) {
  const out = { note: 'SIM rounds (bot) + DOM screenshots of Miasto and the results, 375x667 phone and 1280x720 desktop', steps: [] };
  for (const vp of [{ name: 'phone', opts: { viewport: { width: 375, height: 667 } } }, { name: 'desk', opts: { viewport: { width: 1280, height: 720 }, mobile: false, deviceScaleFactor: 1 } }]) {
    const g = await freshPage(url, vp.opts);
    const page = g.page;
    // a brand-new profile, consent decided (the consent bar is a separate topic)
    await page.evaluate(() => { const s = defaultSave(); s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() }; s.login.lastClaimDate = new Date().toISOString().slice(0, 10); localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)); });
    await page.reload(); await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready);
    for (const content of [ARENA_BOT, QA_RANDOM, AUDIT_LIB]) await page.addScriptTag({ content });
    const hubState = (label) => page.evaluate((label) => {
      const vis = (id) => { const e = document.getElementById(id); if (!e || e.classList.contains('hidden')) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? { top: Math.round(r.top), bottom: Math.round(r.bottom), inViewport: r.top >= 0 && r.bottom <= innerHeight } : false; };
      const t = (id) => { const e = document.getElementById(id); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : null; };
      return { label, runs: game.save.stats.runsPlayed, screen: ['mainMenu', 'gameOverScreen', 'campaignScreen'].find(s => !document.getElementById(s).classList.contains('hidden')),
        nav: vis('bottomNav'), navDzielniceNew: document.getElementById('btnNavDzielnice').classList.contains('is-new'), navDzielniceLocked: document.getElementById('btnNavDzielnice').classList.contains('locked'),
        campaignTile: vis('hubCampaignTile'), tileIntro: document.getElementById('hubCampaignTile').classList.contains('is-intro'),
        tileText: [t('hubCampaignEyebrow'), t('hubCampaignTitle'), t('hubCampaignSub')].join(' | '),
        firstRunCard: game.isFirstRun ? game.isFirstRun() : null, announced: game.save.unlocks.announced.slice() };
    }, label);
    out.steps.push({ vp: vp.name, ...(await hubState('first launch (Miasto)')) });
    await page.screenshot({ path: path.join(DIR, `districts-${vp.name}-0-first-launch.png`) });
    for (let r = 1; r <= 4; r++) {
      await playRound(page, { rand: 300 + r });
      await page.waitForTimeout(3200);
      const res = await page.evaluate(() => ({ hook: document.getElementById('resultNextLine').classList.contains('hidden') ? null : document.getElementById('resultNextText').textContent,
        unlockCard: document.getElementById('unlockOverlay').classList.contains('hidden') ? null : document.getElementById('unlockTitle').textContent }));
      await page.screenshot({ path: path.join(DIR, `districts-${vp.name}-${r}-result.png`) });
      // leave the result the way a player would: close a card, then the Miasto tab / back button
      if (res.unlockCard) { await page.click('#btnUnlockLater').catch(() => {}); await page.waitForTimeout(300); }
      await page.evaluate(() => { game.state = GameState.MENU; game.showScreen('mainMenu'); });
      await page.waitForTimeout(300);
      out.steps.push({ vp: vp.name, ...(await hubState(`after round ${r} (Miasto)`)), result: res });
      await page.screenshot({ path: path.join(DIR, `districts-${vp.name}-${r}-miasto.png`) });
    }
    // a returning player who opened Dzielnice once
    await page.click('#btnNavDzielnice').catch(() => {});
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(DIR, `districts-${vp.name}-dzielnice.png`) });
    await page.evaluate(() => { game.showScreen('mainMenu'); });
    out.steps.push({ vp: vp.name, ...(await hubState('after visiting Dzielnice (Miasto)')) });
    await g.browser.close();
  }
  write('districts.json', out);
}

// =================================================================== (2) controls
async function partControls(url) {
  const out = { note: 'DOM: real clicks, real key presses and real mouse moves on a desktop page (1280x720, fine pointer); positions read from game.player', places: {}, behaviour: {} };
  const g = await freshPage(url, { viewport: { width: 1280, height: 720 }, mobile: false, deviceScaleFactor: 1 });
  const page = g.page;
  const save = await veteranSave(page, { runsPlayed: 8, missions: 6 });
  await seedSave(g, save);
  const where = () => page.evaluate(() => {
    const row = (id) => { const e = document.getElementById(id); if (!e) return null; const r = e.getBoundingClientRect(); return { hidden: e.classList.contains('hidden') || r.height === 0, top: Math.round(r.top), inViewport: r.top >= 0 && r.bottom <= innerHeight, label: e.querySelector('.control-label') ? e.querySelector('.control-label').textContent : null }; };
    return { deskRow: row('deskControlsRow'), profileRow: row('profileDeskControlsRow'), controlsPanelHidden: document.getElementById('controlsPanel').classList.contains('hidden'), inputModeRow: row('inputModeRow') };
  });
  // gear -> Profil
  await page.click('#mainMenu .hub-gear-btn');
  await page.waitForTimeout(400);
  out.places.profile = await where();
  await page.screenshot({ path: path.join(DIR, 'controls-desk-profile.png') });
  out.places.profileScroll = await page.evaluate(() => { const e = document.getElementById('profileDeskControlsRow'); e.scrollIntoView({ block: 'center' }); const sc = document.querySelector('#profileScreen .screen-inner') || document.getElementById('profileScreen'); return { scrolledBy: sc.scrollTop }; });
  await page.screenshot({ path: path.join(DIR, 'controls-desk-profile-scrolled.png') });
  await page.click('#btnProfileBack');
  // Arena pause
  await page.click('#btnStart', { force: true });
  await page.waitForTimeout(3200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  out.places.arenaPause = await where();
  await page.screenshot({ path: path.join(DIR, 'controls-desk-arena-pause.png') });
  await page.click('#btnControls');
  await page.waitForTimeout(300);
  out.places.arenaPauseAfterSterowanie = await where();
  await page.screenshot({ path: path.join(DIR, 'controls-desk-arena-pause-sterowanie.png') });

  // behaviour, Mysz: cursor right of the hole, hold A for 1 s, release, watch it return toward the cursor
  const track = async (label, act) => {
    await page.evaluate(() => { game.player.invulnerableUntil = Infinity; game.checkEvolutionTriggers = () => {}; window.__trk = []; window.__trkOn = true; const tick = () => { if (!window.__trkOn) return; window.__trk.push({ t: performance.now(), x: Math.round(game.player.x), y: Math.round(game.player.y) }); requestAnimationFrame(tick); }; tick(); });
    await act();
    const trk = await page.evaluate(() => { window.__trkOn = false; return window.__trk; });
    const t0 = trk[0].t; const pick = (ms) => { const s = trk.find(p => p.t - t0 >= ms) || trk[trk.length - 1]; return { ms, x: s.x, y: s.y }; };
    out.behaviour[label] = [0, 400, 900, 1200, 1700, 2400].map(pick);
  };
  const resume = async () => { await page.click('#btnResume'); await page.waitForTimeout(300); };
  // set Mysz from the pause sheet (DOM)
  await page.click('#deskControlsRow [data-desk-controls="mouse"]');
  await resume();
  const c = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  await page.mouse.move(c.w * 0.8, c.h * 0.5);
  await track('mouse_holdA_then_release', async () => { await page.waitForTimeout(300); await page.keyboard.down('KeyA'); await page.waitForTimeout(900); await page.keyboard.up('KeyA'); await page.waitForTimeout(1300); });
  // Klawiatura
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  if (await page.evaluate(() => document.getElementById('controlsPanel').classList.contains('hidden'))) await page.click('#btnControls');
  await page.click('#deskControlsRow [data-desk-controls="keyboard"]');
  await resume();
  await page.mouse.move(c.w * 0.8, c.h * 0.3);
  await track('keyboard_moveMouse_holdA_release', async () => { await page.mouse.move(c.w * 0.9, c.h * 0.2, { steps: 5 }); await page.waitForTimeout(300); await page.keyboard.down('KeyA'); await page.waitForTimeout(900); await page.keyboard.up('KeyA'); await page.waitForTimeout(1300); });
  out.savedMode = await page.evaluate(() => game.save.settings.deskControls);
  // mission pause
  await page.evaluate(() => { game.save.settings.deskControls = 'mouse'; game.startCampaignMission('M01'); if (game.introPending) game.beginMissionPlay(); });
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  if (await page.evaluate(() => document.getElementById('controlsPanel').classList.contains('hidden'))) await page.click('#btnControls').catch(() => {});
  await page.waitForTimeout(300);
  out.places.missionPause = await where();
  await page.screenshot({ path: path.join(DIR, 'controls-desk-mission-pause-sterowanie.png') });
  await g.browser.close();
  // touch phone: the row is not offered
  const t = await freshPage(url, { viewport: { width: 390, height: 844 } });
  await seedSave(t, await veteranSave(t.page, { runsPlayed: 8 }));
  out.places.phoneProfile = await t.page.evaluate(() => ({ hasDeskPointer: game.hasDeskPointer, profileRowHidden: document.getElementById('profileDeskControlsRow').classList.contains('hidden') }));
  await t.browser.close();
  write('controls.json', out);
}

// =================================================================== (5) cosmetics
/** Frame strips from the running game: the same seeded scene, the same
 *  scripted movement, one row per variant, N frames per row (cropped around
 *  the player, composed in the page into one PNG). */
async function partCosmetics(url) {
  const out = { note: 'frames rendered by the game (Game.render) on the virtual clock; same seed, same moves, same zoom per row', strips: {} };
  const g = await freshPage(url, { viewport: { width: 390, height: 844 } });
  const save = await veteranSave(g.page, { runsPlayed: 8 });
  save.auras.owned = ['none', 'spark', 'ember', 'vortex', 'impuls', 'pryzmat'];
  save.effects.owned = ['classic', 'pixel_burst', 'neon_rose', 'violet_rift', 'pryzmat'];
  save.overdriveSkins.owned = ['classic', 'fala', 'zloty_szczyt', 'zielona_burza', 'pryzmat'];
  await seedSave(g, save);
  const page = g.page;
  const strip = (name, spec) => page.evaluate(async ({ name, spec }) => {
    const A = window.__audit, rows = [];
    const cell = spec.cell, frames = spec.frames;
    const comp = document.createElement('canvas');
    comp.width = cell * frames + 150; comp.height = cell * spec.variants.length;
    const cx = comp.getContext('2d'); cx.fillStyle = '#060912'; cx.fillRect(0, 0, comp.width, comp.height);
    for (let vi = 0; vi < spec.variants.length; vi++) {
      const v = spec.variants[vi];
      const g = window.game;
      if (spec.gfx != null) g.applyGfx(spec.gfx);
      g.save[spec.key.split('.')[0]][spec.key.split('.')[1] || 'selected'] = v;
      if (spec.key === 'selected') g.save.selected = v;
      A.start({ seed: 77, noEvolution: true, clock0: 2e6 });
      delete g.checkOverdriveTrigger;
      if (!spec.overdrive) g.checkOverdriveTrigger = () => {};
      g.lateRoundAnnounced = true;
      A.parkBots();
      const p = g.player; p.invulnerableUntil = 0; p.auraId = g.save.auras.selected; p.x = 1500; p.y = 1500; p.radius = spec.radius || 40;
      A.clearAround(1500, 1500, 500);
      g.zoom = spec.zoom || 1; g.bannerQueue = []; g.banner = null;
      if (spec.setup === 'eat') { for (let i = 0; i < 5; i++) { const o = A.fragment(1500 + 40 + i * 26, 1500); } }
      if (spec.setup === 'eatBig') {
        const big = g.objects.filter(ob => !ob.eating && ob.tier !== 'golden' && g.holeCanEat(p, ob) && ob.radius > CONFIG.juice.eatTiers.mediumMaxRadius && Math.hypot(ob.x - 1500, ob.y - 1500) > 700).sort((a, b) => a.radius - b.radius).slice(0, 3);
        big.forEach((ob, i) => { ob.x = 1500 + 30 + i * 70; ob.y = 1500 + 8; });
        spec.bigTiers = big.map(ob => ob.tier + ':' + Math.round(ob.radius));
      }
      if (spec.setup === 'finish') { g.timeRemaining = CONFIG.overdrive ? (CONFIG.overdrive.triggerSeconds || 12) + 0.2 : 12.2; }
      for (let f = 0; f < frames; f++) {
        for (let k = 0; k < spec.stepEvery; k++) { g.keyDir = spec.move ? { x: 1, y: 0.25 } : { x: 0, y: 0 }; A.step(1); }
        g.render(A.vnow / 1000);
        const src = g.canvas, dpr = src.width / g.width;
        const sx = (src.width / 2) - cell * dpr / 2 * (spec.crop || 1), sy = (spec.cropY != null ? spec.cropY * src.height : src.height / 2) - cell * dpr / 2 * (spec.crop || 1);
        cx.drawImage(src, sx, sy, cell * dpr * (spec.crop || 1), cell * dpr * (spec.crop || 1), 150 + f * cell, vi * cell, cell, cell);
      }
      cx.fillStyle = '#E6F0FF'; cx.font = 'bold 15px sans-serif'; cx.fillText(v, 8, vi * cell + cell / 2 + 5);
      rows.push(v);
    }
    window.__audit.clockOff();
    return { rows, bigTiers: spec.bigTiers || null, png: comp.toDataURL('image/jpeg', 0.82) };
  }, { name, spec });
  const save64 = (name, r) => { fs.writeFileSync(path.join(DIR, name + '.jpg'), Buffer.from(r.png.split(',')[1], 'base64')); out.strips[name] = { rows: r.rows, bigTiers: r.bigTiers }; };
  // the game draws the hole at the camera's centre, so the crop is the centre of the canvas
  save64('smuga-ruch-gfx2', await strip('smuga', { key: 'auras.selected', variants: ['none', 'spark', 'ember', 'vortex', 'impuls', 'pryzmat'], frames: 6, cell: 150, stepEvery: 5, move: true, radius: 40, gfx: 2 }));
  save64('smuga-ruch-gfx0', await strip('smuga0', { key: 'auras.selected', variants: ['none', 'spark', 'ember', 'impuls'], frames: 4, cell: 150, stepEvery: 5, move: true, radius: 40, gfx: 0 }));
  save64('smuga-ruch-r120', await strip('smugaBig', { key: 'auras.selected', variants: ['none', 'spark', 'impuls', 'pryzmat'], frames: 4, cell: 170, stepEvery: 6, move: true, radius: 120, gfx: 2, zoom: 0.5 }));
  save64('efekt-kes-gfx2', await strip('efekt', { key: 'effects.selected', variants: ['classic', 'pixel_burst', 'neon_rose', 'violet_rift', 'pryzmat'], frames: 7, cell: 150, stepEvery: 3, move: true, radius: 40, gfx: 2, setup: 'eat' }));
  save64('efekt-kes-duzy', await strip('efektBig', { key: 'effects.selected', variants: ['classic', 'pixel_burst', 'neon_rose', 'violet_rift', 'pryzmat'], frames: 7, cell: 190, stepEvery: 3, move: true, radius: 100, gfx: 2, setup: 'eatBig', zoom: 0.75 }));
  save64('finisz-baner', await strip('finisz', { key: 'overdriveSkins.selected', variants: ['classic', 'fala', 'zloty_szczyt', 'zielona_burza', 'pryzmat'], frames: 5, cell: 200, stepEvery: 6, move: false, radius: 40, gfx: 2, setup: 'finish', overdrive: true, cropY: 0.22, crop: 1.6 }));
  // Warsztat previews: each tab, the first owned non-default item focused, two moments of the live preview
  await page.evaluate(() => { game.state = GameState.MENU; game.openWarsztatScreen(); });
  for (const [tab, item] of [['tabAuras', 'impuls'], ['tabEffects', 'pixel_burst'], ['tabOverdrive', 'fala']]) {
    await page.click('#' + tab);
    await page.waitForTimeout(250);
    const grid = { tabAuras: 'auraGrid', tabEffects: 'effectGrid', tabOverdrive: 'overdriveSkinGrid' }[tab];
    await page.click(`#${grid} .skin-card[data-item="${item}"]`).catch(() => {});
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(DIR, `warsztat-${tab}-a.png`) });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(DIR, `warsztat-${tab}-b.png`) });
    out[tab] = await page.evaluate((grid) => ({ cards: [...document.querySelectorAll(`#${grid} .skin-card`)].map(c => c.textContent.replace(/\s+/g, ' ').trim()), actionText: (document.getElementById('warsztatPreviewWhat') || {}).textContent || null, previewCaption: [...document.querySelectorAll('#shopScreen .warsztat-preview *')].map(e => e.childElementCount ? '' : e.textContent.trim()).filter(Boolean).slice(0, 8) }), grid);
  }
  write('cosmetics.json', out);
  await g.browser.close();
}

if (isMain(import.meta.url)) {
  const { server, url } = await serve();
  const t0 = Date.now();
  try {
    if (want('ranking')) await partRanking(url);
    if (want('cards')) await partCards(url);
    if (want('reward')) await partReward(url);
    if (want('districts')) await partDistricts(url);
    if (want('controls')) await partControls(url);
    if (want('cosmetics')) await partCosmetics(url);
  } finally { server.close(); }
  log('done in', ((Date.now() - t0) / 1000).toFixed(0), 's; output', DIR);
}
