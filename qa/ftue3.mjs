// FTUE-3 „Pierwsze 5 minut” (owner-approved stage, 2026-10-25). What a new
// player meets in the first three Arena rounds:
//  - 3A: the first Arena round (no finished round yet, not a Daily or a
//    friend's challenge) runs without the evolution cards -- they used to
//    pause it twice in its first 6-32 s; from the 2nd round they are back,
//    the first offer marked "NOWOŚĆ · EWOLUCJA" (CONFIG.ftue.evolutionFromRuns).
//    Daily, challenges and every later round are unchanged.
//  - 3B: the player's vortex pressed against the city's edge pulls in what
//    lies between it and the wall (Game.edgeReach(),
//    CONFIG.arena.edgeReachSlack) -- a smaller rival or a fragment in a
//    corner used to stay out of reach for good (a casual bot lost 35-47 s
//    of a first round chasing one). Bots are unchanged; the size and tier
//    rules still apply.
//  - 3C: an Arena result says what the next round brings (#resultNextLine,
//    Game.nextRoundHook()): the next Arena unlock (Warsztat, Wyzwania) or a
//    Core City reward at most CONFIG.ftue.coreHookRounds plain rounds away
//    -- and it comes true. Reads the save only.
//  - The first five minutes, measured: a fresh profile from the welcome
//    card to the third result with real buttons and a casual player (seeded
//    -- the same layouts and decisions on every run): taps, full-screen
//    pauses, first bite, bites in 10 s, the longest gap without a bite,
//    places; result layout in portrait, landscape and the Poki /
//    CrazyGames frames; existing saves, a reload, rounds left early; no
//    console errors.
// Usage: node qa/ftue3.mjs
//        node qa/ftue3.mjs --measure=12 [--root=DIR] [--tag=base]
//          (report only: the casual first-session measurement over 12 seeded
//           fresh profiles; --root serves another checkout, e.g. the
//           production base, with the same driver -> qa/out/ftue3-measure-<tag>.json)
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, report, isMain, OUT, QA_RANDOM, ROOT } from './lib.mjs';
import { MATRIX, SCENES, judge, auditScene, safeArea } from './responsive.mjs';

/** In-page casual player (the yardstick of qa/README: sees the screen,
 *  re-aims every 0.4 s at the nearest bite, a smaller rival first, flees a
 *  bigger one close by) for the round that is running now -- started by a
 *  real button. Picks the first evolution card like a player would (a tap).
 *  Stops after `seconds` of virtual time or at the round's end. */
const DRIVER = `
window.__f3Vis = (id) => { const el = document.getElementById(id); return !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none'; };
window.__f3Play = function (seconds = 200, finish = true) {
  const g = window.game, p = g.player, dt = 1 / 30;
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  let v = realNow(); performance.now = () => v;
  if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
  const out = { offers: [], taps: 0, firstEat: null, eats10: 0, eats: 0, maxGap: 0, maxGapAt: 0, maxR: p.radius, updateMs: 0 };
  let frames = 0, wanderA = Math.random() * 6.28, lastScore = p.score, lastEat = 0;
  while (g.state === GameState.PLAYING && frames < seconds * 30) {
    if (g.evolutionPending) {
      out.offers.push({ t: +(frames * dt).toFixed(1), kicker: document.getElementById('evolutionKicker') ? document.getElementById('evolutionKicker').textContent : 'EWOLUCJA', shown: __f3Vis('evolutionOverlay') });
      const card = document.querySelector('#evolutionCards .evolution-card'); out.taps++;
      if (card) card.click(); else g.skipEvolutionOffer();
      continue;
    }
    if (frames % 12 === 0) {
      const vw = g.width / g.zoom / 2, vh = g.height / g.zoom / 2;
      const on = (x, y) => Math.abs(x - p.x) < vw && Math.abs(y - p.y) < vh;
      let dir = null;
      for (const b of g.bots) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (b.radius > p.radius * 1.15 && d < 150 + b.radius && Math.random() < 0.7) { dir = { x: (p.x - b.x) / (d + 1), y: (p.y - b.y) / (d + 1) }; break; } }
      if (!dir) {
        let best = null, bd = Infinity;
        for (const b of g.bots) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (on(b.x, b.y) && p.radius > b.radius * 1.3 && !b.invulnerable && d < bd) { bd = d; best = b; } }
        if (!best) for (const o of g.objects) { if (o.eating || !g.holeCanEat(p, o) || !on(o.x, o.y)) continue; const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } }
        if (best) { const m = Math.hypot(best.x - p.x, best.y - p.y) || 1; dir = { x: (best.x - p.x) / m, y: (best.y - p.y) / m }; }
        else { wanderA += (Math.random() - 0.5) * 1.2; dir = { x: Math.cos(wanderA), y: Math.sin(wanderA) }; }
      }
      g.keyDir = dir;
    }
    v += dt * 1000;
    const t0 = realNow(); g.update(dt); out.updateMs += realNow() - t0;
    frames++;
    const t = frames * dt;
    out.maxR = Math.max(out.maxR, p.radius);
    if (p.score > lastScore) {
      out.eats++; if (out.firstEat === null) out.firstEat = +t.toFixed(2); if (t <= 10) out.eats10++;
      if (t - lastEat > out.maxGap) { out.maxGap = +(t - lastEat).toFixed(1); out.maxGapAt = +lastEat.toFixed(1); }
      lastEat = t; lastScore = p.score;
    }
  }
  if (g.state === GameState.PLAYING && finish) {
    if (frames * dt - lastEat > out.maxGap) { out.maxGap = +(frames * dt - lastEat).toFixed(1); out.maxGapAt = +lastEat.toFixed(1); }
    g.timeRemaining = 0.001; v += 16; g.update(0.016);
  }
  window.__f3EndedAt = Date.now();
  out.updateMs = +(out.updateMs / Math.max(1, frames)).toFixed(3);
  out.seconds = +(frames * dt).toFixed(1);
  const ranked = rankHoles([p, ...g.bots]);
  out.place = ranked.indexOf(p) + 1; out.score = p.score; out.maxR = Math.round(out.maxR);
  g.keyDir = { x: 0, y: 0 }; performance.now = realNow;
  if (!finish) g.running = g.state === GameState.PLAYING;
  return out;
};
window.__f3Result = () => ({
  result: __f3Vis('gameOverScreen'), card: __f3Vis('unlockOverlay') ? document.getElementById('unlockTitle').textContent : null,
  next: __f3Vis('resultNextLine') ? { kicker: document.getElementById('resultNextKicker').textContent, text: document.getElementById('resultNextText').textContent, hook: document.getElementById('resultNextLine').dataset.hook } : null,
  ad: __f3Vis('btnWatchAd'), again: __f3Vis('btnPlayAgain'), runs: window.game.save.stats.runsPlayed
});
/** Where the next-round line sits: on screen at the result's scroll top,
 *  clear of the sticky action bar, text not cut off. */
window.__f3NextBox = () => {
  const el = document.getElementById('resultNextLine'); if (!el || el.classList.contains('hidden')) return null;
  const r = el.getBoundingClientRect(), bar = document.querySelector('#gameOverScreen .result-actions').getBoundingClientRect();
  const txt = document.getElementById('resultNextText');
  const underBar = Math.min(r.right, bar.right) - Math.max(r.left, bar.left) > 1 && Math.min(r.bottom, bar.bottom) - Math.max(r.top, bar.top) > 1;
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), barTop: Math.round(bar.top), underBar, vw: innerWidth, vh: innerHeight,
    clipped: txt.scrollWidth > txt.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1, font: parseFloat(getComputedStyle(document.getElementById('resultNextKicker')).fontSize) * (window.game.uiScale || 1) };
};
`;

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const FRESH = { width: 390, height: 844 };

async function open(url, opts = {}) {
  const g = await openGame(url, { initScript: QA_RANDOM, ...opts });
  await g.page.addScriptTag({ content: DRIVER });
  return g;
}
/** Builds a save from defaultSave() in the page, stores it and reloads. */
async function withSave(g, build) {
  const s = await g.page.evaluate(build);
  await g.page.evaluate((x) => { localStorage.setItem('vectorHoleSave_v1', JSON.stringify(x)); sessionStorage.setItem('__qaSeeded', '1'); }, s);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state !== undefined);
  await g.page.addScriptTag({ content: DRIVER });
}
const played = (o) => `(() => {
  const s = defaultSave(), o = ${JSON.stringify(o)};
  s.stats.runsPlayed = o.runs || 0;
  s.stats.recentArenaScores = Array.from({ length: Math.min(o.runs || 0, CONFIG.rival.history) }, () => 4000);
  s.unlocks.announced = o.announced || [];
  s.coach = { moved: true, ate: true, rival: true, danger: true };
  s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
  s.login.lastClaimDate = new Date().toISOString().slice(0, 10);
  s.coins = o.coins || 300;
  if (o.core) { s.hub.coreLevel = o.core[0]; s.hub.coreCharge = o.core[1]; }
  (o.completed || []).forEach(id => { s.campaign.completed[id] = true; });
  return s;
})()`;

/** The first session, as a new player plays it: welcome GRAJ -> 3 Arena
 *  rounds through the real buttons, the casual driver steering. */
async function firstSession(url, seed, vp = FRESH, { shots = null, mobile = vp.width < 960 } = {}) {
  const g = await open(url, { viewport: vp, mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const { page } = g;
  const s = { seed, rounds: [], taps: 0, errors: null };
  s.welcome = await page.evaluate(() => __f3Vis('btnWelcomePlay') && window.game.isFirstRun());
  // Seeded in the same evaluate as the tap (menu animations draw between calls).
  await page.evaluate((sd) => { window.__qaSeedRandom(sd); document.getElementById('btnWelcomePlay').click(); }, seed); s.taps++;
  for (let r = 1; r <= 3; r++) {
    const start = await page.evaluate(() => ({ arena: window.game.mode === 'arena', playing: window.game.state === GameState.PLAYING, len: Math.round(window.game.timeRemaining), runs: window.game.save.stats.runsPlayed, quiet: !!window.game.evolutionQuiet, daily: window.game.isDailyRun, challenge: !!window.game.challenge }));
    const play = await page.evaluate(() => window.__f3Play(200));
    s.taps += play.taps;
    // FTUE-1: a card (Warsztat after 2, Wyzwania after 3) waits for the
    // count-up -- timed in the page from the round's end.
    const { at, card, cardAt } = await page.evaluate(async (delay) => {
      await new Promise(x => setTimeout(x, 300));
      const at = { ...window.__f3Result(), box: window.__f3NextBox() };
      let card = null, cardAt = null;
      while (Date.now() - window.__f3EndedAt < delay + 900) {
        await new Promise(x => setTimeout(x, 40));
        if (__f3Vis('unlockOverlay')) { card = document.getElementById('unlockTitle').textContent; cardAt = Date.now() - window.__f3EndedAt; break; }
      }
      return { at, card, cardAt, delayOk: CONFIG.ftue.resultCelebrationDelayMs === delay };
    }, CONFIG_DELAY);
    if (shots) await page.screenshot({ path: path.join(shots, `r${r}-result${card ? '-card' : ''}.png`) });
    if (card) { await page.evaluate(() => document.getElementById('btnUnlockLater').click()); s.taps++; await wait(150); }
    s.rounds.push({ start, play, result: at, card, cardAt });
    if (r < 3) { await page.evaluate((sd) => { window.__qaSeedRandom(sd); document.getElementById('btnPlayAgain').click(); }, seed + r); s.taps++; await wait(80); }
  }
  s.after = await page.evaluate(() => ({ runs: window.game.save.stats.runsPlayed, schema: window.game.save.schemaVersion, warsztat: FEATURE_GATES.warsztat(window.game.save), wyzwania: FEATURE_GATES.wyzwania(window.game.save), core: [window.game.save.hub.coreLevel, window.game.save.hub.coreCharge] }));
  s.errors = g.errors.slice();
  await g.browser.close();
  return s;
}
const CONFIG_DELAY = 2400; // CONFIG.ftue.resultCelebrationDelayMs (checked in-page below)

/** A model of the wall-clock first five minutes from the measured session:
 *  rounds take their real length; a person reads and taps -- 2 s for the
 *  welcome GRAJ, 3 s per evolution choice, 3 s on a result, +2 s when a card
 *  needs closing. An estimate for the report, not a measurement of people. */
function timeline(s) {
  let t = 2; const marks = [{ at: 0, what: 'welcome' }, { at: t, what: 'round 1' }];
  s.rounds.forEach((r, i) => {
    t += r.play.seconds + r.play.offers.length * 3;
    marks.push({ at: Math.round(t), what: `result ${i + 1}` });
    t += 3 + (r.card ? 2 : 0);
    if (i < 2) marks.push({ at: Math.round(t), what: `round ${i + 2}` });
  });
  return { marks, round3At: marks.find(m => m.what === 'round 3').at, end: Math.round(t) };
}

function summarize(sessions) {
  const rounds = sessions.flatMap(s => s.rounds.map((r, i) => ({ ...r.play, n: i + 1 })));
  const by = (n) => rounds.filter(r => r.n === n);
  const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
  return {
    sessions: sessions.length,
    firstPlace: `${rounds.filter(r => r.place === 1).length}/${rounds.length}`,
    podium: `${rounds.filter(r => r.place <= 3).length}/${rounds.length}`,
    r1Pauses: by(1).reduce((a, r) => a + r.offers.length, 0),
    pausesPerSession: +(rounds.reduce((a, r) => a + r.offers.length, 0) / sessions.length).toFixed(1),
    gapsOver20s: rounds.filter(r => r.maxGap >= 20).length,
    longestGap: Math.max(...rounds.map(r => r.maxGap)),
    medianLongestGap: median(rounds.map(r => r.maxGap)),
    medianFirstEat: median(rounds.map(r => r.firstEat)),
    medianEats10: median(by(1).map(r => r.eats10)),
    medianScore: [1, 2, 3].map(n => median(by(n).map(r => r.score))),
    tapsToRound3: median(sessions.map(s => s.taps - (s.rounds[2].card ? 1 : 0) - s.rounds[2].play.taps)),
    round3At: median(sessions.map(s => timeline(s).round3At)),
    avgUpdateMs: +(rounds.reduce((a, r) => a + r.updateMs, 0) / rounds.length).toFixed(3),
    errors: sessions.reduce((a, s) => a + s.errors.length, 0)
  };
}

export async function runFtue3Checks(url) {
  const results = [];
  const outDir = path.join(OUT, 'ftue3'); fs.mkdirSync(outDir, { recursive: true });

  // --- The first session, portrait phone, 4 fixed seeds (same layouts and decisions every run).
  const seeds = [11, 22, 33, 44];
  const sessions = [];
  for (const sd of seeds) sessions.push(await firstSession(url, sd, FRESH, { shots: sd === 11 ? outDir : null }));
  const sum = summarize(sessions);
  fs.writeFileSync(path.join(outDir, 'first-session.json'), JSON.stringify({ summary: sum, timelines: sessions.map(timeline), sessions }, null, 1));
  const s0 = sessions[0];
  results.push(report('FTUE3 first session: welcome card -> GRAJ -> an Arena round of 2:00 at once, the same 2:00 for rounds 2 and 3 (seeded casual player, real buttons)',
    sessions.every(s => s.welcome && s.rounds.every(r => r.start.arena && r.start.playing && r.start.len === 120 && !r.start.daily && !r.start.challenge)),
    JSON.stringify(sessions.map(s => s.rounds.map(r => r.start)))));
  results.push(report('FTUE3-3A round 1 runs without evolution cards (no full-screen pause) although the vortex grew past both evolution sizes; round 2 offers them, the first one "NOWOŚĆ · EWOLUCJA", later ones "EWOLUCJA"',
    sessions.every(s => s.rounds[0].start.quiet && s.rounds[0].play.offers.length === 0 && s.rounds[0].play.maxR >= 66
      && !s.rounds[1].start.quiet && s.rounds[1].play.offers.length >= 1 && s.rounds[1].play.offers[0].kicker === 'NOWOŚĆ · EWOLUCJA' && s.rounds[1].play.offers[0].shown
      && s.rounds[1].play.offers.slice(1).every(o => o.kicker === 'EWOLUCJA') && s.rounds[2].play.offers.every(o => o.kicker === 'EWOLUCJA')),
    JSON.stringify(sessions.map(s => s.rounds.map(r => ({ quiet: r.start.quiet, maxR: r.play.maxR, offers: r.play.offers.map(o => o.t + ' ' + o.kicker) }))))));
  results.push(report('FTUE3-3C result 1 -> "NASTĘPNA RUNDA · Odblokujesz Warsztat", result 2 -> Wyzwania (and the Warsztat card), result 3 -> the Core City reward when <= 2 rounds away; each promise comes true',
    sessions.every(s => { const [a, b, c] = s.rounds.map(r => r.result.next);
      return a && a.hook === 'warsztat' && a.kicker === 'NASTĘPNA RUNDA' && /Warsztat/.test(a.text) && !s.rounds[0].card
        && b && b.hook === 'wyzwania' && b.kicker === 'NASTĘPNA RUNDA' && s.rounds[1].card === 'WARSZTAT'
        && s.rounds[2].card === 'WYZWANIA' && (!c || c.hook === 'core') && s.after.warsztat && s.after.wyzwania && s.after.runs === 3 && s.after.schema === 13; }),
    JSON.stringify(sessions.map(s => ({ next: s.rounds.map(r => r.result.next), cards: s.rounds.map(r => r.card), after: s.after })))));
  results.push(report('FTUE-1 kept: no card and no ×2 ad on the first result; cards wait for the count-up (>= 2 s); ZAGRAJ JESZCZE RAZ on every result',
    sessions.every(s => !s.rounds[0].card && !s.rounds[0].result.ad && s.rounds[1].result.ad && s.rounds.every(r => r.result.again) && s.rounds.slice(1).every(r => r.cardAt >= 2000)),
    JSON.stringify(sessions.map(s => s.rounds.map(r => ({ card: r.card, at: r.cardAt, ad: r.result.ad }))))));
  results.push(report('FTUE3 portrait phone 390x844: the next-round line is on screen at the top of the result, above the sticky ZAGRAJ bar, text not cut off, >= 9 px',
    sessions.every(s => s.rounds.slice(0, 2).every(r => { const b = r.result.box; return b && b.top >= 0 && b.bottom <= b.barTop && !b.underBar && b.right <= b.vw && !b.clipped && b.font >= 9; })),
    JSON.stringify(sessions.map(s => s.rounds.map(r => r.result.box)))));
  results.push(report('FTUE3 first five minutes (casual player, 4 seeds): first bite < 1 s, >= 10 bites in 10 s, no gap without a bite >= 30 s in any round (the corner chase), round 3 starts before 5:00 (timeline model)',
    sum.medianFirstEat < 1 && sum.medianEats10 >= 10 && sessions.every(s => s.rounds.every(r => r.play.maxGap < 30)) && sum.round3At < 300,
    JSON.stringify(sum) + ' timeline ' + JSON.stringify(timeline(s0).marks)));
  results.push(report('FTUE3 no page or console errors through the first session', sum.errors === 0, JSON.stringify(sessions.map(s => s.errors))));

  // --- 3B edge reach: deterministic scenes on a frozen round.
  {
    const g = await open(url, { viewport: FRESH });
    await withSave(g, played({ runs: 6, announced: ['warsztat', 'wyzwania', 'kampania'] }));
    const e = await g.page.evaluate(() => {
      const gm = window.game;
      gm.startRound({ seed: 4242 }); cancelAnimationFrame(gm.rafId); gm.running = false;
      const p = gm.player, far = (h, i) => { h.x = 1500 + i * 60; h.y = 1500; };
      const reset = () => { gm.bots.forEach(far); p.invulnerableUntil = 0; gm.bots.forEach(b => { b.invulnerableUntil = 0; }); gm.objects.forEach(o => { o.x = 2600; o.y = 2600; o.eating = false; }); };
      const frag = () => gm.objects.find(o => o.tier === 'fragment');
      const out = {};
      // B1: a smaller rival tucked in a corner, the player pressed into it.
      reset(); p.setRadius(180); p.x = 180; p.y = 180; let b = gm.bots[1]; b.radius = 40; b.x = 40; b.y = 40;
      let s0 = p.score; out.b1raw = Math.round(Math.hypot(p.x - b.x, p.y - b.y)) >= Math.round(p.radius * 0.75);
      gm.handleHoleCollisions(); out.b1 = p.score > s0 && !(b.x === 40 && b.y === 40);
      // B2: a fragment in the very corner.
      reset(); p.setRadius(180); p.x = 180; p.y = 180; let o = frag(); o.x = 27; o.y = 27; gm.handleObjectEating(p); out.b2 = o.eating;
      // B3: a fragment in the strip along a wall, just past the usual reach.
      reset(); p.setRadius(180); p.x = 180; p.y = 1540; o = frag(); o.x = 25; o.y = 1500;
      out.b3raw = Math.hypot(p.x - o.x, p.y - o.y) > p.radius * 0.85; gm.handleObjectEating(p); out.b3 = o.eating;
      // B4: not pressed against the wall -> nothing changes.
      reset(); p.setRadius(180); p.x = 260; p.y = 260; b = gm.bots[1]; b.radius = 40; b.x = 40; b.y = 40; s0 = p.score;
      gm.handleHoleCollisions(); o = frag(); o.x = 27; o.y = 27; gm.handleObjectEating(p); out.b4 = p.score === s0 && b.x === 40 && !o.eating;
      // B5: bots are unchanged -- a big bot in the corner does not reach a small player there.
      reset(); p.setRadius(40); p.x = 40; p.y = 40; b = gm.bots[1]; b.radius = 180; b.x = 180; b.y = 180;
      gm.handleHoleCollisions(); out.b5 = p.x === 40 && p.y === 40 && Math.round(p.radius) === 40;
      o = frag(); o.x = 27; o.y = 27; gm.handleObjectEating(b); out.b5obj = !o.eating;
      // B6: the open field keeps the usual reach (0.85 r).
      reset(); p.setRadius(180); p.x = 1500; p.y = 1500; o = frag(); o.x = 1500 + 180 * 0.85 + 4; o.y = 1500; gm.handleObjectEating(p); out.b6out = !o.eating;
      o.eating = false; o.x = 1500 + 180 * 0.85 - 4; gm.handleObjectEating(p); out.b6in = o.eating;
      // B7: the size rules still hold: a rival within 1.15x and a too-big tower in the corner stay.
      reset(); p.setRadius(44); p.x = 44; p.y = 44; b = gm.bots[1]; b.radius = 40; b.x = 40; b.y = 40; s0 = p.score;
      gm.handleHoleCollisions(); out.b7rival = p.score === s0 && b.x === 40;
      reset(); p.setRadius(100); p.x = 100; p.y = 100; o = gm.objects.find(x => x.tier === 'tower'); o.x = 110; o.y = 110;
      gm.handleObjectEating(p); out.b7tower = !o.eating;
      // B8: the cost of the check (all objects, the player pressed into a corner vs in the middle).
      reset(); p.setRadius(300); gm.objects.forEach((x, i) => { x.x = 400 + (i % 20) * 110; x.y = 400 + Math.floor(i / 20) * 110; x.eating = false; });
      const bench = (x, y) => { p.x = x; p.y = y; const t = performance.now(); for (let k = 0; k < 400; k++) { gm.objects.forEach(q => { q.eating = false; }); gm.handleObjectEating(p); } return (performance.now() - t) / 400; };
      out.msMiddle = +bench(1500, 1500).toFixed(4); out.msCorner = +bench(300, 300).toFixed(4);
      return out;
    });
    results.push(report('FTUE3-3B a smaller rival in a corner is swallowed by the player pressed into it (outside the usual 0.75 r reach); a fragment in the corner and in the strip along a wall too',
      e.b1raw && e.b1 && e.b2 && e.b3raw && e.b3, JSON.stringify(e)));
    results.push(report('FTUE3-3B unchanged elsewhere: not pressed against the wall -> nothing; bots never use it (a small player in a corner stays safe from a big bot); the open field keeps 0.85 r; rivals within 1.15x and too-big objects stay',
      e.b4 && e.b5 && e.b5obj && e.b6out && e.b6in && e.b7rival && e.b7tower, JSON.stringify(e)));
    results.push(report('FTUE3-3B cheap: handleObjectEating with the vortex in a corner costs < 0.5 ms per frame (report: middle vs corner)', e.msCorner < 0.5, `middle ${e.msMiddle} ms · corner ${e.msCorner} ms`));
    results.push(report('FTUE3-3B no errors', g.errors.length === 0, g.errors.join(' | ')));
    await g.browser.close();
  }

  // --- 3A: who gets the evolution cards (Daily, challenges, veterans, a round left early, campaign powers).
  {
    const g = await open(url, { viewport: FRESH });
    const ev = await g.page.evaluate(() => {
      const gm = window.game, out = {};
      const offer = (opts) => { gm.startRound(opts); cancelAnimationFrame(gm.rafId); gm.running = false; gm.player.setRadius(70); gm.checkEvolutionTriggers();
        const r = { pending: gm.evolutionPending, kicker: document.getElementById('evolutionKicker').textContent };
        if (gm.evolutionPending) gm.skipEvolutionOffer(); gm.checkEvolutionTriggers(); r.second = gm.evolutionPending; r.kicker2 = document.getElementById('evolutionKicker').textContent; if (gm.evolutionPending) gm.skipEvolutionOffer(); return r; };
      out.first = offer({});
      out.daily = offer({ daily: true });
      out.challenge = offer({ seed: 99, challenge: { score: 3000, from: 'Ola' } });
      gm.save.stats.runsPlayed = 1; out.second = offer({});
      gm.save.stats.runsPlayed = 7; out.veteran = offer({});
      // Campaign powers share the overlay -- their kicker stays EWOLUCJA.
      gm.save.stats.runsPlayed = 1; gm.startRound({}); cancelAnimationFrame(gm.rafId); gm.running = false; gm.player.setRadius(70); gm.checkEvolutionTriggers(); gm.skipEvolutionOffer();
      gm.showPowerCards(gm.pickMutationCards().slice(0, 2), () => {}, 'test'); out.powerKicker = document.getElementById('evolutionKicker').textContent; gm.skipEvolutionOffer();
      document.getElementById('evolutionOverlay').classList.add('hidden');
      gm.stopRun();
      return out;
    });
    results.push(report('FTUE3-3A cards only from the 2nd round: none in the first regular round; Daily and a friend\'s challenge as a first play keep them (same round for everyone); round 2 "NOWOŚĆ · EWOLUCJA" then "EWOLUCJA"; a veteran "EWOLUCJA"; campaign powers "EWOLUCJA"',
      !ev.first.pending && !ev.first.second && ev.daily.pending && ev.daily.kicker === 'EWOLUCJA' && ev.challenge.pending && ev.challenge.kicker === 'EWOLUCJA'
      && ev.second.pending && ev.second.kicker === 'NOWOŚĆ · EWOLUCJA' && ev.second.second && ev.second.kicker2 === 'EWOLUCJA'
      && ev.veteran.pending && ev.veteran.kicker === 'EWOLUCJA' && ev.veteran.second && ev.powerKicker === 'EWOLUCJA', JSON.stringify(ev)));
    // A first round left early (R1) is not a finished round: the retry is still the quiet first round.
    const left = await g.page.evaluate(async () => {
      const gm = window.game; localStorage.removeItem('vectorHoleSave_v1');
      gm.save = defaultSave(); gm.save.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
      gm.startRound({}); const out = { quiet1: gm.evolutionQuiet };
      window.__f3Play(15, false); out.score = gm.player.score;
      gm.pauseGame(); gm.leaveRun(); out.runs = gm.save.stats.runsPlayed;
      gm.startRound({}); out.quiet2 = gm.evolutionQuiet; gm.player.setRadius(70); gm.checkEvolutionTriggers(); out.pending = gm.evolutionPending; gm.stopRun();
      return out;
    });
    results.push(report('FTUE3-3A a first round left early (R1: partial pay, not counted) -> the next round is still the first, without cards', left.quiet1 && left.score > 0 && left.runs === 0 && left.quiet2 && !left.pending, JSON.stringify(left)));
    results.push(report('FTUE3-3A no errors', g.errors.length === 0, g.errors.join(' | ')));
    await g.browser.close();
  }

  // --- 3C the next-round line: gates from either mode, Core City, English, read-only, honest.
  {
    const g = await open(url, { viewport: FRESH });
    const finish = async (build, score = 4200) => {
      await withSave(g, build);
      return g.page.evaluate(async (sc) => {
        const gm = window.game, before = JSON.stringify(gm.save), stored = localStorage.getItem('vectorHoleSave_v1');
        const chip = document.getElementById('hubRewardChip1').textContent; // Miasto's "next reward" at the start level
        const hook0 = gm.nextRoundHook(); gm.nextRoundHook(); const pure = JSON.stringify(gm.save) === before && localStorage.getItem('vectorHoleSave_v1') === stored;
        gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId); gm.running = false; gm.player.score = sc; gm.endRound();
        await new Promise(r => setTimeout(r, 200));
        return { hook0, pure, chip, ...window.__f3Result(), core: [gm.save.hub.coreLevel, gm.save.hub.coreCharge], gain: gm.coreGainPerRound() };
      }, score);
    };
    const m02 = await finish(played({ runs: 0, completed: ['M01', 'M02'] }));
    results.push(report('FTUE3-3C Warsztat opened by the campaign (M02) -> after round 1 the line points to Wyzwania: "ZA 2 RUNDY"',
      m02.next && m02.next.hook === 'wyzwania' && m02.next.kicker === 'ZA 2 RUNDY' && /Wyzwania/.test(m02.next.text), JSON.stringify(m02)));
    // A plain round at LVL 3+ adds 10-17 % (+podium, win, record): 70 % -> 80-87 % -> the reward 2 rounds away.
    const near = await finish(played({ runs: 6, announced: ['warsztat', 'wyzwania', 'kampania'], core: [3, 70] }));
    const far = await finish(played({ runs: 6, announced: ['warsztat', 'wyzwania', 'kampania'], core: [3, 0] }));
    const top = await finish(played({ runs: 20, announced: ['warsztat', 'wyzwania', 'kampania'], core: [7, 70] }));
    const label4 = near.next ? near.next.text.replace(/^Nagroda Core City: /, '') : '?';
    results.push(report('FTUE3-3C Core City: a reward within 2 plain rounds is named (computed after the round\'s own gain), a far one shows nothing, past LVL 6 the coin + prism bonus',
      near.core[0] === 3 && near.next && near.next.hook === 'core' && near.chip.startsWith(label4 + ' + ') && label4.length > 3 && near.next.kicker === 'ZA 2 RUNDY' && !far.next && top.core[0] === 7 && top.next && top.next.text === 'Nagroda Core City: +100 monet + 10 pryzmatów',
      JSON.stringify({ near: near.next, nearCore: near.core, far: far.next, farCore: far.core, top: top.next })));
    results.push(report('FTUE3-3C reads the save only (nextRoundHook() changes nothing)', m02.pure && near.pure && far.pure && top.pure, JSON.stringify([m02.pure, near.pure, far.pure, top.pure])));
    // Honest: "ZA 2 RUNDY" for Core City -> 2 finished plain rounds reach the reward.
    const honest = await g.page.evaluate(async () => {
      const gm = window.game; const s = gm.save; s.stats.runsPlayed = 8; s.unlocks.announced = ['warsztat', 'wyzwania', 'kampania']; s.hub.coreLevel = 3; s.hub.coreCharge = 100 - 2 * gm.coreGainPerRound() + 1; saveGame(s);
      const h = gm.nextRoundHook(), lvl0 = s.hub.coreLevel;
      for (let i = 0; i < h.rounds; i++) { gm.startRound({ seed: 500 + i }); cancelAnimationFrame(gm.rafId); gm.running = false; gm.player.score = 10; gm.bots.forEach(b => { b.score = 99999; }); gm.endRound(); }
      return { hook: h, lvl0, lvl1: gm.save.hub.coreLevel };
    });
    results.push(report('FTUE3-3C the promise comes true: a Core City reward announced "ZA 2 RUNDY" is reached by 2 finished rounds even in last place', honest.hook && honest.hook.rounds === 2 && honest.lvl1 === honest.lvl0 + 1, JSON.stringify(honest)));
    results.push(report('FTUE3-3C no errors', g.errors.length === 0, g.errors.join(' | ')));
    await g.browser.close();

    // English: the same line, translated (?i18n=log: nothing Polish reaches the screen).
    const en = await open(url, { viewport: FRESH, locale: 'en-US', query: '?i18n=log' });
    const eo = await en.page.evaluate(async () => {
      const gm = window.game; gm.save.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
      document.getElementById('btnWelcomePlay').click(); window.__f3Play(200);
      await new Promise(r => setTimeout(r, 400));
      const a = { kicker: document.getElementById('resultNextKicker').textContent, text: document.getElementById('resultNextText').textContent };
      gm.save.stats.runsPlayed = 1; gm.startRound({}); cancelAnimationFrame(gm.rafId); gm.running = false; gm.player.setRadius(70); gm.checkEvolutionTriggers();
      await new Promise(r => setTimeout(r, 200));
      a.evo = document.getElementById('evolutionKicker').textContent; gm.skipEvolutionOffer();
      gm.save.stats.runsPlayed = 0; gm.save.unlocks.announced = []; gm.save.campaign.completed.M02 = true; gm.startRound({ seed: 3 }); cancelAnimationFrame(gm.rafId); gm.running = false; gm.player.score = 900; gm.endRound();
      await new Promise(r => setTimeout(r, 300));
      a.kicker2 = document.getElementById('resultNextKicker').textContent; a.text2 = document.getElementById('resultNextText').textContent;
      a.misses = [...I18N.misses].filter(m => /NASTĘPNA|Odblokujesz|Nagroda Core|NOWOŚĆ|ZA \d/.test(m));
      return a;
    });
    results.push(report('FTUE3 English: "NEXT ROUND · Unlocks the Workshop…", "IN 2 ROUNDS · Unlocks Challenges…", "NEW · EVOLUTION"; no Polish from FTUE-3 reaches the screen',
      eo.kicker === 'NEXT ROUND' && /^Unlocks the Workshop/.test(eo.text) && eo.evo === 'NEW · EVOLUTION' && eo.kicker2 === 'IN 2 ROUNDS' && /^Unlocks Challenges/.test(eo.text2) && eo.misses.length === 0, JSON.stringify(eo)));
    await en.browser.close();
  }

  // --- Existing players: a veteran's round, save shape, a reload after the first round.
  {
    const g = await open(url, { viewport: FRESH });
    await withSave(g, played({ runs: 12, coins: 900, announced: ['warsztat', 'wyzwania', 'kampania'], core: [2, 10] }));
    const v = await g.page.evaluate(async () => {
      const gm = window.game, keys0 = Object.keys(JSON.parse(localStorage.getItem('vectorHoleSave_v1'))).sort().join(), c0 = gm.save.coins;
      document.getElementById('btnStart').click(); await new Promise(r => setTimeout(r, 60));
      const quiet = gm.evolutionQuiet, playing = gm.state === GameState.PLAYING;
      const play = window.__f3Play(200);
      await new Promise(r => setTimeout(r, 200));
      const E = CONFIG.economy, place = play.place;
      const want = E.coinsBase + Math.round(E.coinsSqrtK * Math.sqrt(play.score)) + (E.coinsPlaceBonus[place - 1] || 0);
      const extra = (gm.lastXpResult && gm.lastXpResult.levelsUp || []).reduce((a, l) => a + (l.coins || 0), 0) + (gm.hubMilestoneRewards || []).reduce((a, r) => a + (r.coins || 0), 0) + (gm.missionJustCompleted && gm.activeMission ? gm.activeMission.rewardCoins : 0);
      const stored = JSON.parse(localStorage.getItem('vectorHoleSave_v1'));
      return { quiet, playing, offers: play.offers.length, maxR: play.maxR, reward: gm.adPendingCoins === want && gm.save.coins - c0 === want + extra, want, got: gm.adPendingCoins, runs: gm.save.stats.runsPlayed, schema: stored.schemaVersion, keys: Object.keys(stored).sort().join() === keys0, ad: __f3Vis('btnWatchAd'), next: window.__f3Result().next };
    });
    results.push(report('FTUE3 existing player (12 rounds): GRAJ starts a round with the evolution cards as before, the full reward by the unchanged formula, ×2 ad offered, schema 13, no new save fields',
      v.playing && !v.quiet && (v.maxR < 46 || v.offers >= 1) && v.reward && v.runs === 13 && v.schema === 13 && v.keys && v.ad, JSON.stringify(v)));
    results.push(report('FTUE3 existing player: no errors', g.errors.length === 0, g.errors.join(' | ')));
    await g.browser.close();

    // Reload after the first round: Miasto, and the next GRAJ is round 2 (cards, the Wyzwania line next).
    const r = await open(url, { viewport: FRESH });
    await r.page.evaluate(() => window.__qaSeedRandom(5));
    await r.page.evaluate(() => { const gm = window.game; gm.save.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() }; document.getElementById('btnWelcomePlay').click(); window.__f3Play(200); });
    await wait(300);
    await r.page.reload(); await r.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state !== undefined);
    await r.page.addScriptTag({ content: DRIVER });
    await wait(600);
    const rl = await r.page.evaluate(async () => {
      const gm = window.game, out = { welcome: gm.isFirstRun(), runs: gm.save.stats.runsPlayed };
      out.login = __f3Vis('loginRewardScreen');
      if (out.login) { document.getElementById('btnLoginClaim').click(); await new Promise(x => setTimeout(x, 300)); if (__f3Vis('loginRewardScreen')) { document.getElementById('btnLoginClose').click(); await new Promise(x => setTimeout(x, 200)); } }
      document.getElementById('btnStart').click(); await new Promise(x => setTimeout(x, 60));
      out.quiet = gm.evolutionQuiet; out.intro = gm.evolutionIntro;
      const play = window.__f3Play(200); out.offers = play.offers.map(o => o.kicker);
      await new Promise(x => setTimeout(x, 300));
      out.next = window.__f3Result().next;
      return out;
    });
    results.push(report('FTUE3 reload after the first round: Miasto (not the welcome card), GRAJ -> round 2 with "NOWOŚĆ · EWOLUCJA", its result points to Wyzwania',
      !rl.welcome && rl.runs === 1 && !rl.quiet && rl.offers[0] === 'NOWOŚĆ · EWOLUCJA' && rl.next && rl.next.hook === 'wyzwania', JSON.stringify(rl)));
    results.push(report('FTUE3 reload: no errors', r.errors.length === 0, r.errors.join(' | ')));
    await r.browser.close();
  }

  // --- Layout: the result with the next-round line in every platform frame (FTUE-2 audit) + the first session in landscape.
  {
    SCENES.resultsNext = {
      stage: async (p) => {
        await p.evaluate(() => { const s = defaultSave(); s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() }; s.coach = { moved: true, ate: true, rival: true, danger: true }; s.login.lastClaimDate = new Date().toISOString().slice(0, 10); s.stats.runsPlayed = 1; s.stats.recentArenaScores = [4000]; localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)); sessionStorage.setItem('__qaSeeded', '1'); });
        await p.reload(); await p.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state !== undefined);
        await p.evaluate(() => { const gm = window.game; gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId); gm.player.score = 4200; gm.endRound(); });
        await p.waitForTimeout(3200);
        await p.evaluate(() => { window.game.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); });
      },
      audit: { root: '#gameOverScreen', primary: '#btnPlayAgain', mustSee: ['#finalScore', '#btnMenu'], ctaScrollsClear: true }
    };
    const frames = MATRIX.filter(([w, h]) => ['390x844', '375x667', '320x568', '402x812', '390x664', '844x390', '667x375', '775x328', '874x402', '640x360', '800x450', '836x470', '1031x580', '821x462', '1280x720', '1920x1080', '768x1024'].includes(`${w}x${h}`));
    const bad = [], seen = [];
    for (const [w, h, kind, , insets] of frames) {
      const g = await openGame(url, { viewport: { width: w, height: h }, mobile: kind !== 'desk', deviceScaleFactor: kind === 'desk' ? 1 : 2 });
      if (insets) await safeArea(g.page, insets);
      await g.page.addScriptTag({ content: DRIVER });
      const a = await auditScene(g.page, 'resultsNext');
      const [ok, probs] = judge('resultsNext', a, [w, h]);
      await g.page.addScriptTag({ content: DRIVER });
      // The line itself: on screen once scrolled to (portrait: without scrolling), never under the bar, not cut off.
      const box = await g.page.evaluate(() => {
        const el = document.getElementById('resultNextLine'); const b0 = window.__f3NextBox();
        el.scrollIntoView({ block: 'nearest' }); const b1 = window.__f3NextBox();
        return { b0, b1, text: document.getElementById('resultNextText').textContent };
      });
      const portrait = h > w;
      const lineOk = box.b0 && box.b1 && box.b1.top >= 0 && box.b1.bottom <= box.b1.vh && !box.b1.underBar && !box.b1.clipped && box.b1.font >= 9
        && (!portrait || (box.b0.top >= 0 && box.b0.bottom <= box.b0.barTop));
      seen.push(`${w}x${h}${lineOk && ok ? '' : ' ✗'}`);
      if (!ok || !lineOk) bad.push({ frame: `${w}x${h}`, probs, box });
      await g.page.screenshot({ path: path.join(outDir, `result-next-${w}x${h}.png`) });
      if (g.errors.length) bad.push({ frame: `${w}x${h}`, errors: g.errors });
      await g.browser.close();
    }
    results.push(report(`FTUE3 result with the next-round line in ${frames.length} frames (phones portrait/landscape with safe areas, Poki, CrazyGames, desktop, tablet): FTUE-2 audit clean (nothing cut off, covered, overlapping, CTA in view), the line on screen (portrait: at once), clear of the action bar, not cut off`,
      bad.length === 0, bad.length ? JSON.stringify(bad).slice(0, 1500) : seen.join(' ')));

    const land = [];
    for (const [vp, mobile] of [[{ width: 844, height: 390 }, true], [{ width: 640, height: 360 }, false], [{ width: 1280, height: 720 }, false]]) land.push(await firstSession(url, 11, vp, { mobile }));
    results.push(report('FTUE3 first session in landscape / Poki 640x360 / desktop 1280x720: round 1 without cards, round 2 "NOWOŚĆ · EWOLUCJA", results 1-2 point to Warsztat / Wyzwania, no errors',
      land.every(s => s.rounds[0].play.offers.length === 0 && s.rounds[1].play.offers[0] && s.rounds[1].play.offers[0].kicker === 'NOWOŚĆ · EWOLUCJA' && s.rounds[0].result.next && s.rounds[0].result.next.hook === 'warsztat' && s.rounds[1].result.next && s.rounds[1].result.next.hook === 'wyzwania' && s.errors.length === 0),
      JSON.stringify(land.map(s => ({ offers: s.rounds.map(r => r.play.offers.length), next: s.rounds.map(r => r.result.next && r.result.next.hook), errors: s.errors })))));
  }
  return results;
}

/** --measure: report only, any checkout (--root), same seeded driver. */
async function measure(n, root, tag) {
  const srv = await serve(root ? { root: path.resolve(root) } : {});
  const sessions = [];
  for (let i = 0; i < n; i++) sessions.push(await firstSession(srv.url, 1000 + i * 37));
  srv.server.close();
  const sum = summarize(sessions);
  const file = path.join(OUT, `ftue3-measure-${tag}.json`);
  fs.writeFileSync(file, JSON.stringify({ root: root || ROOT, summary: sum, timelines: sessions.map(timeline), rounds: sessions.map(s => s.rounds.map(r => ({ place: r.play.place, score: r.play.score, maxGap: r.play.maxGap, offers: r.play.offers.length, eats: r.play.eats, next: r.result.next && r.result.next.hook, card: r.card }))) }, null, 1));
  console.log(JSON.stringify(sum, null, 1));
  console.log('->', file);
}

if (isMain(import.meta.url)) {
  const m = process.argv.find(a => a.startsWith('--measure='));
  if (m) {
    const root = (process.argv.find(a => a.startsWith('--root=')) || '').slice(7) || null;
    const tag = (process.argv.find(a => a.startsWith('--tag=')) || '').slice(6) || (root ? 'other' : 'head');
    await measure(+m.slice(10) || 12, root, tag);
  } else {
    const { server, url } = await serve();
    const results = await runFtue3Checks(url);
    server.close();
    const failed = results.filter(r => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    process.exit(failed.length ? 1 : 0);
  }
}
