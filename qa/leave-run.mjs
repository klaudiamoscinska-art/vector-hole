// Leaving an Arena round (pause -> OPUŚĆ RUNDĘ -> TAK) -- owner's iPhone bug
// 2026-10-24: entering Arena and going straight back to Miasto raised Core
// City (and paid coins, XP, prisms, counted a run toward the Warsztat /
// Wyzwania / campaign gates) for a round nobody played. leaveRun() ran the
// full finalizeRun() even at score 0; with 0 points every hole ties, so the
// player was "1st" and got the podium + win Core City bonus too.
// R1 (owner decision 2026-10-24, GDD 5): a round left early pays only the
// partial coins and XP its score earned; everything a finished round pays
// (Core City, base/place bonus, prism trickle, daily mission, Daily
// bonus/record/streak, PB, run count = the Warsztat/Wyzwania/campaign gates)
// needs the round to run out of time.
//  - LR-1/2: a round left at score 0 grants and counts nothing -- the save
//    is unchanged (also after a reload), entering/leaving can't farm.
//  - LR-3: a finished round pays exactly CONFIG's reward and Core City.
//  - LR-4a/4b: left after one bite / after a bigger score: exactly the
//    partial coins (coinsSqrtK x sqrt(score), newbie x) and XP (xpSqrtK x
//    sqrt(score)), no Core City, run count, recent score, PB, prisms (but a
//    level's own), daily mission -- and less than a finished round pays.
//  - LR-5: relaunches; a round run to the timeout without a point is still
//    a finished round (endRound() untouched).
//  - LR-6: an existing save loses nothing (score 0) and gains only coins/XP
//    (score > 0); LR-7: Arena <-> campaign stay independent; LR-8: rounds
//    left at score 0 or with a score open no gate and pay no Daily bonus /
//    streak / daily mission; finished rounds open Warsztat (2) and Wyzwania
//    (3) as before. schemaVersion stays 13.
// Usage: node qa/leave-run.mjs
import { serve, openGame, veteranSave, report, isMain } from './lib.mjs';

const LR = `
window.__lrVis = (id) => { const el = document.getElementById(id); return !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none'; };
/** The save without meta (savedAt changes on every write), as JSON. */
window.__lrSave = (s) => { const c = JSON.parse(JSON.stringify(s || window.game.save)); delete c.meta; delete c._sig; return c; };
/** startRound() picks today's daily mission (save.mission.dateKey) -- round
 *  setup, not a reward; everything else must stay as it was. */
window.__lrSetup = (paths) => paths.filter(p => p !== 'mission.dateKey');
window.__lrStored = () => { const raw = localStorage.getItem('vectorHoleSave_v1'); return raw ? window.__lrSave(JSON.parse(raw)) : null; };
/** Paths (a.b.c) where two plain objects differ. */
window.__lrDiff = (a, b, p = '') => {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b)) return [p || '(root)'];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => window.__lrDiff(a[k], b[k], p ? p + '.' + k : k));
};
/** Leaves the running round through the real pause sheet buttons. */
window.__lrLeave = () => {
  const gm = window.game, score = gm.player.score;
  document.getElementById('btnPause').click();
  document.getElementById('btnLeaveRun').click();
  document.getElementById('btnLeaveConfirmYes').click();
  return { score, menu: gm.state === GameState.MENU && window.__lrVis('mainMenu') };
};
/** Plays the running round greedily for \`seconds\` of virtual time; with
 *  finish, lets the clock run out (endRound()); idle = no steering at all. */
window.__lrPlay = (seconds, { finish = false, idle = false } = {}) => {
  const g = window.game, p = g.player, dt = 1 / 30;
  const realNow = window.__lrRealNow || (window.__lrRealNow = performance.now.bind(performance));
  let v = realNow(); performance.now = () => v;
  if (g.rafId) cancelAnimationFrame(g.rafId);
  g.running = false;
  for (let f = 0; g.state === GameState.PLAYING && f < seconds * 30; f++) {
    if (g.evolutionPending) { g.skipEvolutionOffer(); continue; }
    let best = null, bs = -1;
    if (!idle) for (const o of g.objects) {
      if (o.consumed || o.removed || o.eating || !g.holeCanEat(p, o)) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y), s = (o.value + 2) / (d + 40);
      if (s > bs) { bs = s; best = o; }
    }
    if (best) { const m = Math.hypot(best.x - p.x, best.y - p.y) || 1; g.keyDir = { x: (best.x - p.x) / m, y: (best.y - p.y) / m }; } else g.keyDir = { x: 0, y: 0 };
    v += dt * 1000; g.update(dt);
  }
  if (finish && g.state === GameState.PLAYING) { g.timeRemaining = 0.001; v += 16; g.update(0.016); }
  g.keyDir = { x: 0, y: 0 };
  performance.now = realNow;
  g.running = g.state === GameState.PLAYING;
  return g.player.score;
};
/** What finalizeRun() owes for the round on screen now (CONFIG formulas,
 *  computed independently): coins before level/milestone extras, Core City. */
/** R1: what payLeftRun() owes for the score on screen now. */
window.__lrPartial = (runsBefore) => {
  const g = window.game, E = CONFIG.economy, score = Math.max(0, g.player.score);
  let coins = Math.round(E.coinsSqrtK * Math.sqrt(score));
  if (runsBefore < E.newbieRuns) coins = Math.round(coins * E.newbieCoinMult);
  return { coins, xp: Math.max(0, Math.round(CONFIG.progression.xpSqrtK * Math.sqrt(score))) };
};
/** Steers greedily (virtual time) until the first bite -- the score turns
 *  positive -- then freezes the round so the pause sheet can open. */
window.__lrFirstBite = () => {
  const g = window.game;
  for (let i = 0; i < 300 && g.player.score === 0 && g.state === GameState.PLAYING; i++) window.__lrPlay(1 / 30);
  return g.player.score;
};
/** Everything only a finished round may change. */
window.__lrDone = () => { const s = window.game.save; return { core: s.hub.coreLevel * 100 + s.hub.coreCharge, runs: s.stats.runsPlayed, recent: s.stats.recentArenaScores.length, best: s.stats.bestArenaScore, mission: !!s.mission.completed, daily: JSON.stringify(s.daily) }; };
/** Coins / prisms a level-up from the last XP grant paid. */
window.__lrLevel = () => { const l = (window.game.lastXpResult && window.game.lastXpResult.levelsUp) || []; return { coins: l.reduce((a, x) => a + (x.coins || 0), 0), prisms: l.reduce((a, x) => a + (x.prisms || 0), 0) }; };
/** One round left with a score: R1's whole contract in one object. */
window.__lrLeftCheck = (before, c0, p0, partial, left) => {
  const g = window.game, lv = window.__lrLevel(), done = window.__lrDone();
  const xp = g.lastXpResult ? g.lastXpResult.gained : null, delta = g.save.coins - c0, prisms = (g.save.prisms || 0) - p0;
  const doneSame = JSON.stringify(done) === JSON.stringify(before);
  return { score: left.score, menu: left.menu, partial, delta, xp, level: lv, prisms, doneSame, done,
    ok: left.score > 0 && left.menu && delta === partial.coins + lv.coins && xp === partial.xp && prisms === lv.prisms && doneSame };
};
window.__lrOwed = (runsBefore, coreLevelBefore, bestBefore) => {
  const g = window.game, E = CONFIG.economy, cc = CONFIG.hub.coreCity;
  const place = rankHoles([g.player, ...g.bots]).indexOf(g.player) + 1;
  let coins = E.coinsBase + Math.round(E.coinsSqrtK * Math.sqrt(Math.max(0, g.player.score))) + (E.coinsPlaceBonus[place - 1] || 0);
  if (runsBefore < E.newbieRuns) coins = Math.round(coins * E.newbieCoinMult);
  let core = cc.arenaCompleteGain + (place <= 3 ? cc.arenaTop3Gain : 0) + (place === 1 ? cc.arenaFirstGain : 0) + (g.player.score > bestBefore ? cc.arenaNewPbGain : 0);
  if (coreLevelBefore <= cc.earlyLevelMax) core = Math.round(core * cc.earlyLevelMult);
  return { place, coins, core };
};
`;

async function open(url, build, opts = {}) {
  const g = await openGame(url, opts);
  if (build) {
    const save = typeof build === 'function' ? await build(g.page) : await g.page.evaluate(build);
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await reload(g.page);
  }
  await g.page.addScriptTag({ content: LR });
  return g;
}
async function reload(page) {
  await page.reload();
  await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  await page.addScriptTag({ content: LR }).catch(() => {});
}
const fmt = (o) => JSON.stringify(o);

export async function runLeaveRunChecks(url) {
  const results = [];

  // LR-1 / LR-2 / LR-5 (reload) / LR-3 / LR-4: one new player, real buttons.
  {
    const g = await open(url, null, { viewport: { width: 390, height: 844 } });
    const { page } = g;
    const r1 = await page.evaluate(async () => {
      const gm = window.game, before = window.__lrSave();
      document.getElementById('btnWelcomePlay').click();
      const playing = gm.mode === 'arena' && gm.state === GameState.PLAYING;
      await new Promise(r => setTimeout(r, 400)); // the round really runs (RAF), the player does nothing
      const left = window.__lrLeave();
      await new Promise(r => setTimeout(r, 200));
      return { playing, left, diff: window.__lrSetup(window.__lrDiff(before, window.__lrSave())), stored: window.__lrSetup(window.__lrDiff(before, window.__lrStored() || before)), welcome: window.__lrVis('hubWelcome') && gm.isFirstRun(), core: gm.save.hub.coreCharge, runs: gm.save.stats.runsPlayed };
    });
    results.push(report('LR-1 new player: Arena -> immediate OPUŚĆ RUNDĘ -> no Core City, coins, XP, prisms or run count; save unchanged in memory and storage; Miasto shows the welcome card again',
      r1.playing && r1.left.score === 0 && r1.left.menu && r1.diff.length === 0 && r1.stored.length === 0 && r1.welcome && r1.core === 0 && r1.runs === 0, fmt(r1)));

    const r2 = await page.evaluate(async () => {
      const gm = window.game, before = window.__lrSave(), scores = [];
      for (let i = 0; i < 5; i++) {
        document.getElementById('btnWelcomePlay').click();
        await new Promise(r => setTimeout(r, 150));
        scores.push(window.__lrLeave().score);
      }
      return { scores, diff: window.__lrSetup(window.__lrDiff(before, window.__lrSave())), warsztat: gm.isWarsztatUnlocked(), wyzwania: gm.isWyzwaniaUnlocked(), intro: document.getElementById('hubCampaignTile').classList.contains('is-intro') };
    });
    results.push(report('LR-2 five more enter/leave cycles at score 0: nothing farmed (save unchanged), Warsztat/Wyzwania/campaign intro stay locked',
      r2.scores.every(s => s === 0) && r2.diff.length === 0 && !r2.warsztat && !r2.wyzwania && !r2.intro, fmt(r2)));

    await reload(page);
    const r5 = await page.evaluate(() => ({ runs: window.game.save.stats.runsPlayed, core: window.game.save.hub.coreCharge, coins: window.game.save.coins, schema: window.game.save.schemaVersion, first: window.game.isFirstRun() }));
    results.push(report('LR-5a relaunch after the abandoned rounds: still a fresh profile (runs 0, Core City 0, 0 coins), schemaVersion 13',
      r5.runs === 0 && r5.core === 0 && r5.coins === 0 && r5.schema === 13 && r5.first, fmt(r5)));

    const r3 = await page.evaluate(() => {
      const gm = window.game, c0 = gm.save.coins, core0 = gm.save.hub.coreCharge, lvl0 = gm.save.hub.coreLevel, best0 = gm.save.stats.bestArenaScore;
      document.getElementById('btnWelcomePlay').click();
      window.__lrPlay(20, { finish: true });
      const owed = window.__lrOwed(0, lvl0, best0);
      const extra = (gm.lastXpResult && gm.lastXpResult.levelsUp || []).reduce((a, l) => a + (l.coins || 0), 0) + (gm.hubMilestoneRewards || []).reduce((a, r) => a + (r.coins || 0), 0) + (gm.missionJustCompleted && gm.activeMission ? gm.activeMission.rewardCoins : 0);
      return { owed, extra, paid: gm.adPendingCoins, delta: gm.save.coins - c0, core: gm.save.hub.coreCharge - core0 + (gm.save.hub.coreLevel - lvl0) * 100, runs: gm.save.stats.runsPlayed, recent: gm.save.stats.recentArenaScores.length, xp: gm.lastXpResult && gm.lastXpResult.gained, result: window.__lrVis('gameOverScreen') };
    });
    results.push(report('LR-3 a finished Arena round pays CONFIG coins + Core City in full, counts the run and enters recentArenaScores',
      r3.result && r3.paid === r3.owed.coins && r3.delta === r3.owed.coins + r3.extra && r3.core === r3.owed.core && r3.runs === 1 && r3.recent === 1, fmt(r3)));

    // R1: left right after the very first bite (real buttons: ZAGRAJ JESZCZE RAZ, pause, OPUŚĆ RUNDĘ, TAK).
    const r4a = await page.evaluate(() => {
      const gm = window.game, before = window.__lrDone(), c0 = gm.save.coins, p0 = gm.save.prisms || 0, runs0 = gm.save.stats.runsPlayed;
      document.getElementById('btnPlayAgain').click();
      window.__lrFirstBite();
      const partial = window.__lrPartial(runs0), owed = window.__lrOwed(runs0, gm.save.hub.coreLevel, gm.save.stats.bestArenaScore);
      const out = window.__lrLeftCheck(before, c0, p0, partial, window.__lrLeave());
      out.owedFinished = owed.coins;
      return out;
    });
    results.push(report('LR-4a R1: left right after the first bite -- exactly the partial coins (coinsSqrtK x sqrt(score), newbie x1.5) and XP (xpSqrtK x sqrt(score)); no Core City, run count, recent score, PB, prisms or daily mission',
      r4a.ok && r4a.partial.coins < r4a.owedFinished, fmt(r4a)));
    const r4b = await page.evaluate(() => {
      const gm = window.game, before = window.__lrDone(), c0 = gm.save.coins, p0 = gm.save.prisms || 0, runs0 = gm.save.stats.runsPlayed;
      gm.startArenaRound();
      window.__lrPlay(15);
      const partial = window.__lrPartial(runs0), owed = window.__lrOwed(runs0, gm.save.hub.coreLevel, gm.save.stats.bestArenaScore);
      const out = window.__lrLeftCheck(before, c0, p0, partial, window.__lrLeave());
      out.owedFinished = owed.coins; out.coreFinished = owed.core;
      return out;
    });
    results.push(report('LR-4b R1: left after a bigger score (15 s) -- partial coins and XP by the formulas, still no Core City or finished-round bonus, less than a finished round would pay',
      r4b.ok && r4b.score > r4a.score && r4b.partial.coins < r4b.owedFinished && r4b.coreFinished > 0, fmt(r4b)));

    const mem = await page.evaluate(() => ({ save: window.__lrSave(), disk: window.__lrDiff(window.__lrSave(), window.__lrStored()) }));
    await reload(page);
    // A launch counts a new session (retention.*) -- nothing else may differ.
    const r5b = await page.evaluate((m) => ({ disk: m.disk, diff: window.__lrDiff(m.save, window.__lrSave()).filter(p => !p.startsWith('retention.')), schema: window.game.save.schemaVersion }), mem);
    results.push(report('LR-5b after a finished round and two played-then-left rounds the save on disk is the one in memory, and a relaunch loads it unchanged (only the session count grows), schemaVersion 13',
      r5b.disk.length === 0 && r5b.diff.length === 0 && r5b.schema === 13, fmt(r5b)));
    results.push(report('LR new player: no page errors', g.errors.length === 0, g.errors.join(' | ')));
    await g.browser.close();
  }

  // LR-5c: a round run to the timeout without scoring is still a finished round.
  {
    const g = await open(url, null);
    const r = await g.page.evaluate(() => {
      const gm = window.game;
      gm.startArenaRound();
      const score = window.__lrPlay(1, { finish: true, idle: true });
      return { score, runs: gm.save.stats.runsPlayed, recent: gm.save.stats.recentArenaScores.length, result: window.__lrVis('gameOverScreen'), core: gm.save.hub.coreCharge };
    });
    results.push(report('LR-5c a round that runs out of time is a finished round even without a point (endRound() unchanged): run counted, result shown',
      r.result && r.runs === 1 && r.recent === 1 && r.core > 0, fmt(r)));
    await g.browser.close();
  }

  // LR-6 / LR-7: an existing save.
  {
    const build = (page) => veteranSave(page, { missions: 8, runsPlayed: 7, coins: 1234 }).then(s => {
      s.prisms = 17; s.hub.coreLevel = 3; s.hub.coreCharge = 41; s.player.level = 4; s.player.xp = 55;
      s.stats.bestArenaScore = 3000; s.stats.recentArenaScores = [2500, 2800, 3000];
      s.owned.push('cyan'); s.boosters = { ...s.boosters, time: 2 };
      return s;
    });
    const g = await open(url, build);
    const { page } = g;
    const r6 = await page.evaluate(async () => {
      const gm = window.game, before = window.__lrSave();
      gm.startArenaRound();
      await new Promise(r => setTimeout(r, 300));
      const left = window.__lrLeave();
      return { left, diff: window.__lrSetup(window.__lrDiff(before, window.__lrSave())), stored: window.__lrSetup(window.__lrDiff(before, window.__lrStored())) };
    });
    results.push(report('LR-6 existing save (8 missions, 7 rounds, LVL3 41%, coins, prisms, boosters, owned vortex): a round left at score 0 changes nothing, in memory or storage',
      r6.left.score === 0 && r6.diff.length === 0 && r6.stored.length === 0, fmt(r6)));
    await reload(page);
    const r6b = await page.evaluate(() => { const s = window.game.save; return { coins: s.coins, prisms: s.prisms, core: s.hub.coreLevel + ':' + s.hub.coreCharge, runs: s.stats.runsPlayed, missions: Object.keys(s.campaign.completed).length, owned: s.owned.includes('cyan'), schema: s.schemaVersion, guard: SAVE_GUARD.state }; });
    results.push(report('LR-6b the existing save after a relaunch: all progress and purchases there, schemaVersion 13, save guard ok',
      r6b.coins === 1234 && r6b.prisms === 17 && r6b.core === '3:41' && r6b.runs === 7 && r6b.missions === 8 && r6b.owned && r6b.schema === 13 && r6b.guard === 'ok', fmt(r6b)));
    const r7 = await page.evaluate(async () => {
      const gm = window.game;
      const camp0 = JSON.stringify(gm.save.campaign), core0 = gm.save.hub.coreLevel + ':' + gm.save.hub.coreCharge;
      gm.startArenaRound();
      await new Promise(r => setTimeout(r, 200));
      window.__lrLeave();
      const campAfterArena = JSON.stringify(gm.save.campaign) === camp0;
      gm.startCampaignMission('M09'); gm.beginMissionPlay();
      await new Promise(r => setTimeout(r, 200));
      const inMission = gm.mode === 'campaign';
      window.__lrLeave();
      return { campAfterArena, inMission, core: gm.save.hub.coreLevel + ':' + gm.save.hub.coreCharge, core0, runs: gm.save.stats.runsPlayed };
    });
    // R1 on an existing save: a round left with a score adds coins/XP (and a level's reward) only.
    const r6c = await page.evaluate(() => {
      const gm = window.game, before = window.__lrDone(), c0 = gm.save.coins, p0 = gm.save.prisms || 0, runs0 = gm.save.stats.runsPlayed, camp0 = JSON.stringify(gm.save.campaign), owned0 = JSON.stringify(gm.save.owned);
      gm.startArenaRound();
      window.__lrPlay(10);
      const out = window.__lrLeftCheck(before, c0, p0, window.__lrPartial(runs0), window.__lrLeave());
      out.campSame = JSON.stringify(gm.save.campaign) === camp0; out.ownedSame = JSON.stringify(gm.save.owned) === owned0;
      return out;
    });
    results.push(report('LR-6c R1 existing save: a round left with a score adds exactly the partial coins and XP; Core City 3:41, 7 rounds, PB, recent scores, campaign and purchases unchanged',
      r6c.ok && r6c.campSame && r6c.ownedSame && r6c.done.runs === 7 && r6c.done.core === 341, fmt(r6c)));
    results.push(report('LR-7 isolation: an abandoned Arena round leaves the campaign untouched; leaving a mission leaves Core City and the Arena run count untouched',
      r7.campAfterArena && r7.inMission && r7.core === r7.core0 && r7.runs === 7, fmt(r7)));
    results.push(report('LR existing save: no page errors', g.errors.length === 0, g.errors.join(' | ')));
    await g.browser.close();
  }

  // LR-8: gates, Daily, daily mission.
  for (const runs of [1, 2]) {
    const build = `(() => { const s = defaultSave(); s.stats.runsPlayed = ${runs}; s.stats.recentArenaScores = Array(${runs}).fill(1500); s.unlocks.announced = ${runs >= 2 ? "['warsztat']" : '[]'}; s.coach = { moved: true, ate: true, rival: true, danger: true }; s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() }; s.login.lastClaimDate = new Date().toISOString().slice(0, 10); return s; })()`;
    const g = await open(url, build);
    const r = await g.page.evaluate(async () => {
      const gm = window.game, before = window.__lrSave();
      const gates = () => ({ warsztat: gm.isWarsztatUnlocked(), wyzwania: gm.isWyzwaniaUnlocked(), intro: campaignTile() });
      const campaignTile = () => { gm.showScreen('mainMenu'); return document.getElementById('hubCampaignTile').classList.contains('is-intro'); };
      const gates0 = gates();
      for (let i = 0; i < 3; i++) { gm.startArenaRound(); await new Promise(r => setTimeout(r, 120)); window.__lrLeave(); }
      const gates1 = gates();
      // The Daily Seed Challenge left at score 0: no completion bonus, record, streak or Core City.
      gm.startDailyChallenge();
      const daily = gm.isDailyRun && gm.state === GameState.PLAYING;
      await new Promise(r => setTimeout(r, 150));
      const dl = window.__lrLeave();
      const diff0 = window.__lrSetup(window.__lrDiff(before, window.__lrSave()));
      // R1: three Arena rounds and a Daily left with a score -- partial coins/XP only.
      const done0 = window.__lrDone(), scored = [];
      for (let i = 0; i < 3; i++) {
        const c0 = gm.save.coins, p0 = gm.save.prisms || 0, runs0 = gm.save.stats.runsPlayed;
        gm.startArenaRound(); window.__lrPlay(4);
        scored.push(window.__lrLeftCheck(done0, c0, p0, window.__lrPartial(runs0), window.__lrLeave()).ok);
      }
      const gates2 = gates();
      const c1 = gm.save.coins, p1 = gm.save.prisms || 0, runs1 = gm.save.stats.runsPlayed;
      gm.startDailyChallenge(); window.__lrPlay(6);
      const dailyLeft = window.__lrLeftCheck(done0, c1, p1, window.__lrPartial(runs1), window.__lrLeave());
      // Finished rounds still open the gates exactly as before (Warsztat after 2, Wyzwania after 3).
      gm.startArenaRound(); window.__lrPlay(1, { finish: true });
      const gates3 = gates();
      return { gates0, gates1, gates2, gates3, daily, dailyScore: dl.score, diff0, scored, dailyLeft, runsAfter: gm.save.stats.runsPlayed, missionDone: gm.save.mission.completed };
    });
    results.push(report(`LR-8 ${runs} finished round(s): abandoned Arena rounds and an abandoned Daily open no gate (Warsztat/Wyzwania/campaign intro unchanged) and grant no Daily bonus, streak, daily mission or Core City`,
      fmt(r.gates0) === fmt(r.gates1) && r.daily && r.dailyScore === 0 && r.diff0.length === 0, fmt(r)));
    results.push(report(`LR-8 ${runs} R1: three Arena rounds and a Daily left with a score pay only partial coins/XP -- no gate, run count, Daily bonus/record/streak, daily mission or Core City`,
      r.scored.every(Boolean) && r.dailyLeft.ok && fmt(r.gates0) === fmt(r.gates2), fmt({ scored: r.scored, daily: r.dailyLeft, gates2: r.gates2 })));
    const want = runs === 1 ? { warsztat: true, wyzwania: false } : { warsztat: true, wyzwania: true };
    results.push(report(`LR-8 ${runs} R1: the next finished round counts (${runs} -> ${runs + 1}) and opens ${runs === 1 ? 'Warsztat' : 'Wyzwania + the campaign tile'} as before`,
      r.runsAfter === runs + 1 && r.gates3.warsztat === want.warsztat && r.gates3.wyzwania === want.wyzwania && (runs === 1 || r.gates3.intro), fmt({ runsAfter: r.runsAfter, gates3: r.gates3 })));
    results.push(report(`LR-8 ${runs}: no page errors`, g.errors.length === 0, g.errors.join(' | ')));
    await g.browser.close();
  }
  return results;
}

if (isMain(import.meta.url)) {
  const { server, url } = await serve();
  const res = await runLeaveRunChecks(url);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} leave-run checks passed`);
  process.exit(failed.length ? 1 : 0);
}
