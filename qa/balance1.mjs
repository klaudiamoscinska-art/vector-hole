// BALANCE-1: the economy, progression and difficulty audit as a suite.
//
//   node qa/balance1.mjs                 # the full suite: careers 10 h, boosters, saves, 240 missions x 3 expert seeds -- PASS/FAIL gates
//   node qa/balance1.mjs --quick         # the run-all part: careers over the first hour, boosters, saves
//   node qa/balance1.mjs --only=careers,boosters,missions,saves [--tag=T]   # report only, one or more parts
//   node qa/balance1.mjs --root=DIR --tag=before   # report only: the same runs against another checkout
//   (missions: --expert-seeds=N --casual=N --ids=M180,M226; careers: --minutes=N --profiles=weak,average)
//   --seed=N / VH_QA_SEED=N              # the base seed (default 20261026) -- every run is seeded
//
// Careers are SIMULATIONS, not observations of real people: four seeded
// bot players (weak / average / strong / quitter) play a schedule of Arena
// rounds, Daily rounds and campaign missions through the game's own reward
// code (finalizeRun(), payLeftRun(), endCampaignMission(), grantXp(), Core
// City, the login calendar, the free chest) with a wall-clock model of
// what a round costs a human (CAREER_OVERHEAD). Purchases follow a simple
// policy (cheapest affordable cosmetic first; a mission booster after a
// few defeats). Results -> qa/out/balance1/<tag>/.
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, ARENA_BOT, CAMPAIGN_BOT, QA_RANDOM, report, expectAll, is, truthy, falsy, holds, seedFor, OUT, isMain } from './lib.mjs';

export const BALANCE_DEFAULT_SEED = 20261026;
// What a round costs a human on top of the played seconds: the result
// screen and the next tap (Arena), the briefing + start card + result
// (a mission), the pause sheet (a round left early).
export const CAREER_OVERHEAD = { arena: 15, daily: 20, left: 8, mission: 20 };
// Day 1 is one 60-minute session (the new-player milestones), every later
// day a 30-minute session (2 / 5 / 10 hours of play = days 4 / 10 / 20).
export const CAREER_SESSIONS = { first: 60, later: 30 };
export const MILESTONES = [5, 15, 30, 60, 120, 300, 600];

export const PROFILES = {
  // Sees the screen, re-aims every ~0.8 s and wanders on a third of its
  // decisions; casual campaign bot; buys the suggested booster after 2 defeats.
  weak: { arena: 'casual', arenaOpts: { reactFrames: 24, distracted: 0.35 }, campaign: 'casual', arenaShare: 0.5, boosterAfterFails: 2, stockAfterFails: 1 },
  // The design yardstick (qa/README.md): casual Arena + casual campaign.
  average: { arena: 'casual', arenaOpts: {}, campaign: 'casual', arenaShare: 0.5, boosterAfterFails: 2, stockAfterFails: 1 },
  // Expert bots on both sides; never pays for a booster, uses the stock.
  strong: { arena: 'greedy', arenaOpts: {}, campaign: 'expert', arenaShare: 0.5, boosterAfterFails: 99, stockAfterFails: 2 },
  // Average skill, leaves a third of the Arena rounds and a quarter of the
  // mission attempts early (R1: partial reward / nothing at score 0).
  quitter: { arena: 'casual', arenaOpts: {}, campaign: 'casual', arenaShare: 0.6, boosterAfterFails: 3, stockAfterFails: 1, quitArena: 0.35, quitMission: 0.25 }
};

/** A controllable wall clock: Date.now()/new Date() run `__qaDateOffset`
 *  ms ahead of the real one (a simulated day = +24 h). */
const DATE_OFFSET_SCRIPT = `(function () { const D = Date; window.__qaDateOffset = 0;
  class QADate extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + window.__qaDateOffset); } static now() { return D.now() + window.__qaDateOffset; } }
  window.Date = QADate; })();`;

// In-page helpers: every reward goes through the game's own code; only the
// purchase bookkeeping mirrors onCosmeticPick() / launchMission() (the same
// deduction, without the confirm sheet).
const BALANCE_SIM = `
window.__bal = (function () {
  const g = () => window.game;
  const lists = (s) => ({ skin: s.owned, aura: s.auras.owned, effect: s.effects.owned, overdriveSkin: s.overdriveSkins.owned });
  function catalog() {
    const items = [];
    SKINS.forEach(x => { if (x.price > 0) items.push({ cat: 'skin', id: x.id, name: x.name, cur: 'coins', price: x.price }); });
    [['aura', AURAS], ['effect', EAT_EFFECTS], ['overdriveSkin', OVERDRIVE_SKINS]].forEach(([cat, arr]) => arr.forEach(x => {
      if (x.priceType === 'coins' && x.priceCoins > 0) items.push({ cat, id: x.id, name: x.name, cur: 'coins', price: x.priceCoins });
      if (x.priceType === 'prisms' && x.pricePrisms > 0) items.push({ cat, id: x.id, name: x.name, cur: 'prisms', price: x.pricePrisms });
    }));
    return items;
  }
  function shop() {
    const s = g().save, bought = [];
    if (!FEATURE_GATES.warsztat(s)) return bought;
    for (;;) {
      const own = lists(s);
      const next = catalog().filter(i => !own[i.cat].includes(i.id) && (i.cur === 'coins' ? s.coins : (s.prisms || 0)) >= i.price).sort((a, b) => a.price - b.price)[0];
      if (!next) break;
      if (next.cur === 'coins') s.coins -= next.price; else s.prisms -= next.price;
      own[next.cat].push(next.id);
      bought.push(next);
    }
    if (bought.length) saveGame(s);
    return bought;
  }
  function snap() {
    const s = g().save, own = lists(s), cat = catalog();
    const left = (cur) => cat.filter(i => i.cur === cur && !own[i.cat].includes(i.id));
    const P = CONFIG.progression;
    let xpTotal = s.player.xp; for (let l = 1; l < s.player.level; l++) xpTotal += P.xpForLevel(l);
    return {
      coins: s.coins, prisms: s.prisms || 0, level: s.player.level, xpTotal, coreLevel: s.hub.coreLevel || 1, coreCharge: s.hub.coreCharge || 0,
      runsPlayed: s.stats.runsPlayed || 0, cleared: Object.keys(s.campaign.completed).length, stars: g().totalStars(), starChests: s.campaign.starChests || 0,
      districts: s.campaign.unlockedDistricts.length, boosters: Object.assign({}, s.boosters),
      coinItemsOwned: cat.filter(i => i.cur === 'coins').length - left('coins').length, coinItemsTotal: cat.filter(i => i.cur === 'coins').length,
      coinCatalogLeft: left('coins').reduce((a, i) => a + i.price, 0), nextCoinItem: (left('coins').sort((a, b) => a.price - b.price)[0] || {}).price || 0,
      prismItemsOwned: cat.filter(i => i.cur === 'prisms').length - left('prisms').length, prismItemsTotal: cat.filter(i => i.cur === 'prisms').length,
      prismCatalogLeft: left('prisms').reduce((a, i) => a + i.price, 0),
      rewardItems: own.skin.length + own.aura.length + own.effect.length + own.overdriveSkin.length,
      unlocks: { warsztat: FEATURE_GATES.warsztat(s), wyzwania: FEATURE_GATES.wyzwania(s), boosters: FEATURE_GATES.boosters(s) }
    };
  }
  // CORE_CITY_LEVEL_REWARDS[l].coins (not on the QA bridge; mirrored here).
  const CORE_COINS = { 2: 150, 3: 200, 4: 250, 5: 300, 6: 400 };
  function wallet() { const s = g().save; return { coins: s.coins, prisms: s.prisms || 0, level: s.player.level, core: s.hub.coreLevel || 1, chests: s.campaign.starChests || 0, dailyTask: !!s.mission.completed, dailyKey: s.mission.dateKey }; }
  // Where the coins of one action came from: level-ups, Core City levels,
  // the daily task, star chests -- the rest is the round / mission itself.
  function delta(a, b) {
    let levels = 0, core = 0;
    for (let l = a.level + 1; l <= b.level; l++) levels += CONFIG.progression.levelCoins(l);
    for (let l = a.core + 1; l <= b.core; l++) core += CORE_COINS[l] || CONFIG.hub.milestoneFallbackCoins;
    const task = b.dailyTask && !(a.dailyTask && a.dailyKey === b.dailyKey) && g().activeMission ? g().activeMission.rewardCoins : 0;
    const chests = (b.chests - a.chests) * CONFIG.stars.chest.coins;
    const coins = b.coins - a.coins;
    return { coins, prisms: b.prisms - a.prisms, levels: b.level - a.level, src: { levels, core, task, chests, own: coins - levels - core - task - chests } };
  }
  function newDay(ms) {
    window.__qaDateOffset += ms;
    const a = wallet();
    g().claimLoginReward();
    g().openFreeChest();
    const login = delta(a, wallet());
    return { login };
  }
  function arena(o) {
    const a = wallet();
    window.__qaSeedRandom(o.seed);
    let r, peakR = 0, peakCombo = 0;
    try {
      r = window.__qaPlayArena(Object.assign({ style: o.style, noRender: true, clock0: 1000000, round: o.daily ? { daily: true } : {} }, o.arenaOpts || {}, {
        onFrame: (f, game) => {
          peakR = Math.max(peakR, game.player.radius); peakCombo = Math.max(peakCombo, game.comboCount);
          if (o.quitFrame && f === o.quitFrame && game.state === GameState.PLAYING) game.leaveRun();
        }
      }));
    } finally { window.__qaRestoreRandom(); }
    // What the four daily tasks (MISSIONS) would have read from this round.
    const tasks = { rivals: g().rivalsEatenThisRun, radius: Math.round(peakR), combo: peakCombo, score: r.score };
    return { place: r.place, score: r.score, frames: r.frames, left: !!o.quitFrame && r.frames <= o.quitFrame, t: +g().difficultyT.toFixed(2), tasks, gain: delta(a, wallet()) };
  }
  function nextMission() {
    const s = g().save;
    return DISTRICTS.flatMap(d => d.missions).find(id => !s.campaign.completed[id] && g().isMissionPlayable(id)) || null;
  }
  function mission(o) {
    const s = g().save;
    const a0 = wallet();
    let spent = 0; const used = [];
    (o.boosters || []).forEach(b => {
      if (s.boosters[b] > 0) { s.boosters[b]--; used.push(b + ':stock'); }
      else { const p = MISSION_BOOSTERS.find(x => x.id === b).price; if (s.coins >= p) { s.coins -= p; spent += p; used.push(b + ':coins'); } }
    });
    const boosters = used.map(u => u.split(':')[0]);
    const a = wallet();
    window.__qaSeedRandom(o.seed);
    let r, frac = 0;
    try {
      r = window.__qaPlayMission(o.id, { style: o.style, boosters, clock0: 1000000,
        onFrame: o.quitAt ? (f, game) => { if (f >= o.quitAt * 30 && !game.mission.ended && !game.mission.finishing) game.leaveCampaignMission(); } : null });
      try { frac = g().campaignGoalFraction(); } catch (e) { frac = 0; }
    } finally { window.__qaRestoreRandom(); }
    return { id: o.id, success: r.success, elapsed: r.elapsed, limit: r.limit, diff: r.diff, fail: r.fail, stars: r.stars, frac: +frac.toFixed(2), used, spent, gain: delta(a, wallet()), left: !!o.quitAt && !r.success && r.elapsed <= o.quitAt + 0.1, suggest: (g().suggestedBooster(campaignMissionById(o.id), r.fail, frac) || {}).id || null };
  }
  return { catalog, shop, snap, newDay, arena, mission, nextMission };
})();
`;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

async function freshPage(url) {
  const opened = await openGame(url, { initScript: DATE_OFFSET_SCRIPT });
  const { page } = opened;
  await page.evaluate(() => {
    const s = defaultSave();
    s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
    s.settings.music = false; s.settings.sfx = false;
    localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s));
  });
  await page.reload();
  await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  for (const content of [ARENA_BOT, CAMPAIGN_BOT, QA_RANDOM, BALANCE_SIM]) await page.addScriptTag({ content });
  return opened;
}

/** One simulated player career, `minutes` of play long. */
export async function runCareer(url, profileId, minutes, base) {
  const P = PROFILES[profileId];
  const rand = rng(seedFor(base, 'career', profileId));
  const { browser, page, errors } = await freshPage(url);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  let t = 0, day = 1, sessionEnd = CAREER_SESSIONS.first * 60, dailyDay = 0, actions = 0;
  let arenaTime = 0, missionTime = 0, loginDone = false;
  const income = { arena: 0, arenaLeft: 0, daily: 0, mission: 0, login: 0, spentCosmetics: 0, spentBoosters: 0 };
  // The same coins by source (BALANCE-1 flow map): level-ups, Core City
  // levels, the daily task, star chests, and each mode's own pay.
  const sources = { arenaRound: 0, arenaLeft: 0, dailyRound: 0, missionClear: 0, levels: 0, core: 0, task: 0, starChests: 0, login: 0 };
  const addSrc = (key, g) => { sources[key] += g.src.own; sources.levels += g.src.levels; sources.core += g.src.core; sources.task += g.src.task; sources.starChests += g.src.chests; };
  const prismIncome = { arena: 0, daily: 0, mission: 0, login: 0, spent: 0 };
  const snaps = [], purchases = [], arenaLog = [], missionLog = [], firsts = {};
  let ms = 0, failStreak = {}, lastFail = {};
  const mark = (key) => { if (firsts[key] == null) firsts[key] = +(t / 60).toFixed(1); };
  const afterAction = async () => {
    const bought = await ev(() => window.__bal.shop());
    bought.forEach(b => { purchases.push({ min: +(t / 60).toFixed(1), ...b }); if (b.cur === 'coins') income.spentCosmetics += b.price; else prismIncome.spent += b.price; });
    if (bought.length) mark('firstPurchase');
    const s = await ev(() => window.__bal.snap());
    if (s.unlocks.warsztat) mark('warsztat');
    if (s.unlocks.wyzwania) mark('wyzwania');
    if (s.unlocks.boosters) mark('boosters');
    if (s.coreLevel >= 2) mark('core2');
    if (s.coreLevel >= 6) mark('core6');
    if (s.coinItemsOwned === s.coinItemsTotal) mark('allCoinItems');
    if (s.prismItemsOwned === s.prismItemsTotal) mark('allPrismItems');
    while (ms < MILESTONES.length && t >= MILESTONES[ms] * 60 && MILESTONES[ms] <= minutes) {
      snaps.push({ min: MILESTONES[ms], realMin: +(t / 60).toFixed(1), day, arenaRounds: arenaLog.filter(r => !r.left).length, arenaLeft: arenaLog.filter(r => r.left).length, missionAttempts: missionLog.length, purchases: purchases.length, income: { ...income }, sources: { ...sources }, prismIncome: { ...prismIncome }, ...s });
      ms++;
    }
    return s;
  };
  while (t < minutes * 60) {
    if (t >= sessionEnd) {
      day++; sessionEnd = t + CAREER_SESSIONS.later * 60;
      const d = await ev((m) => window.__bal.newDay(m), 24 * 3600 * 1000);
      income.login += d.login.coins; prismIncome.login += d.login.prisms; sources.login += d.login.coins;
    }
    const state = await ev(() => ({ s: window.__bal.snap(), next: window.__bal.nextMission() }));
    let kind;
    if (actions < 3) kind = 'arena';
    else if (state.s.unlocks.wyzwania && dailyDay !== day) kind = 'daily';
    else if (state.next && missionTime < (arenaTime + missionTime) * (1 - P.arenaShare)) kind = 'mission';
    else kind = 'arena';
    actions++;
    if (kind === 'arena' || kind === 'daily') {
      const quit = kind === 'arena' && P.quitArena && actions > 1 && rand() < P.quitArena;
      const quitFrame = quit ? Math.round((10 + rand() * 90) * 30) : 0;
      const r = await ev((o) => window.__bal.arena(o), { style: P.arena, arenaOpts: P.arenaOpts, daily: kind === 'daily', quitFrame, seed: seedFor(base, profileId, 'arena', actions) });
      const sec = r.left ? r.frames / 30 + CAREER_OVERHEAD.left : 120 + CAREER_OVERHEAD[kind === 'daily' ? 'daily' : 'arena'];
      t += sec; arenaTime += sec;
      if (kind === 'daily') { dailyDay = day; income.daily += r.gain.coins; prismIncome.daily += r.gain.prisms; }
      else if (r.left) income.arenaLeft += r.gain.coins;
      else { income.arena += r.gain.coins; prismIncome.arena += r.gain.prisms; }
      addSrc(kind === 'daily' ? 'dailyRound' : r.left ? 'arenaLeft' : 'arenaRound', r.gain);
      arenaLog.push({ min: +(t / 60).toFixed(1), kind, ...r });
    } else {
      const id = state.next;
      const fails = failStreak[id] || 0;
      const sug = lastFail[id] || 'time';
      const stock = (state.s.boosters[sug] || 0) > 0;
      const boosters = (state.s.unlocks.boosters && ((stock && fails >= P.stockAfterFails) || fails >= P.boosterAfterFails)) ? [sug] : [];
      const quitAt = P.quitMission && rand() < P.quitMission ? 5 + rand() * 25 : 0;
      const r = await ev((o) => window.__bal.mission(o), { id, style: P.campaign, boosters, quitAt, seed: seedFor(base, profileId, 'mission', actions) });
      const sec = r.elapsed + CAREER_OVERHEAD.mission;
      t += sec; missionTime += sec;
      income.mission += r.gain.coins + r.spent; prismIncome.mission += r.gain.prisms; income.spentBoosters += r.spent;
      failStreak[id] = r.success ? 0 : fails + 1;
      if (!r.success && r.suggest) lastFail[id] = r.suggest;
      r.gain.src.own += r.spent; addSrc('missionClear', r.gain);
      missionLog.push({ min: +(t / 60).toFixed(1), fails, ...r });
    }
    if (!loginDone && actions === 1) {
      // The calendar shows on the 2nd Miasto visit (FTUE-1): claimed after round 1.
      const d = await ev((m) => window.__bal.newDay(m), 0);
      income.login += d.login.coins; prismIncome.login += d.login.prisms; sources.login += d.login.coins; loginDone = true;
    }
    await afterAction();
  }
  await browser.close();
  const stuck = Object.entries(failStreak).filter(([, f]) => f >= 6).map(([id, f]) => `${id}×${f}`);
  return { profile: profileId, minutes, snaps, purchases, firsts, income, sources, prismIncome, stuck,
    arena: arenaLog.map(r => ({ min: r.min, kind: r.kind, place: r.place, score: r.score, left: r.left, t: r.t, coins: r.gain.coins, tasks: r.tasks })),
    missions: missionLog.map(r => ({ min: r.min, id: r.id, ok: r.success, el: r.elapsed, lim: r.limit, diff: r.diff, fail: r.success ? null : (r.left ? 'left' : r.fail), used: r.used.join(','), coins: r.gain.coins })),
    errors: errors.slice(0, 3) };
}

function pad(v, n) { return String(v).padEnd(n); }
export function careerTable(c) {
  const rows = c.snaps.map(s => `| ${s.min} | ${s.arenaRounds}+${s.arenaLeft} | ${s.missionAttempts} / ${s.cleared} | ${s.coins} | ${s.prisms} | ${s.level} | ${s.coreLevel} (${s.coreCharge}%) | ${s.coinItemsOwned}/${s.coinItemsTotal} | ${s.prismItemsOwned}/${s.prismItemsTotal} | ${s.stars} | ${s.income.arena + s.income.arenaLeft + s.income.daily} / ${s.income.mission} / ${s.income.login} | ${s.income.spentCosmetics} / ${s.income.spentBoosters} |`);
  return ['| min | Arena (ukończ.+przerw.) | próby misji / ukończone | monety | pryzmaty | poziom | Core City | wiry/smugi za monety | kosmetyki za ◆ | gwiazdki | zarobek Arena / misje / kalendarz+skrzynia | wydane kosmetyki / wzmocnienia |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|', ...rows].join('\n');
}

export async function runCareers(url, { minutes = 600, base = BALANCE_DEFAULT_SEED, profiles = Object.keys(PROFILES), workers = 2 } = {}) {
  const out = [];
  const queue = profiles.slice();
  await Promise.all(Array.from({ length: Math.min(workers, queue.length) }, async () => {
    while (queue.length) { const p = queue.shift(); const t0 = Date.now(); const c = await runCareer(url, p, minutes, base); console.log(`  career ${p}: ${minutes} min simulated in ${Math.round((Date.now() - t0) / 1000)} s`); out.push(c); }
  }));
  return profiles.map(p => out.find(c => c.profile === p));
}

/** A bot profile with every district open (missions in any order). */
async function campaignPage(url) {
  const opened = await openGame(url);
  const { page } = opened;
  await page.evaluate(() => {
    const s = defaultSave();
    s.campaign.unlockedDistricts = DISTRICTS.map(d => d.id);
    s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
    s.settings.music = false; s.settings.sfx = false;
    s.coach = { moved: true, ate: true, rival: true, danger: true };
    localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s));
  });
  await page.reload();
  await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  for (const content of [CAMPAIGN_BOT, QA_RANDOM]) await page.addScriptTag({ content });
  return opened;
}

// --- Boosters: does each one do what its card says? ----------------------
// Functional: the mission starts with the effect (Zegar +15 s on the clock,
// Turbo start at T2, Sprint's speed, Tarcza's hits, Magnes pulling). Reach:
// a fragment the vortex may eat is laid at k x its radius from a still
// vortex -- is it pulled in within 4 s? Value: the casual bot on paired
// layouts (the same seed with and without) on mid and hard missions.
export const MAGNET_REACH_K = [1.2, 1.5, 2, 3, 4, 5];
export async function runBoosterAudit(url, { base = BALANCE_DEFAULT_SEED, runs = 2, missions = null } = {}) {
  const { browser, page, errors } = await campaignPage(url);
  const functional = await page.evaluate(() => {
    const g = window.game;
    const start = (id, boosters) => { g.missionBoosters = boosters; g.startCampaignMission(id); if (g.introPending) g.beginMissionPlay(); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; g.keyDir = { x: 0, y: 0 }; g.pointerScreen = null; return g.mission; };
    const out = {};
    let m = start('M05', []); const lim = m.timeRemaining; g.leaveCampaignMission();
    m = start('M05', ['time']); out.time = { base: lim, with: m.timeRemaining }; g.leaveCampaignMission();
    m = start('M05', ['start']); out.start = { tier: g.campaignPlayerTier().id, units: m.growthUnits, need: CONFIG.growth.unitAnchors[1] }; g.leaveCampaignMission();
    const speed = (boosters) => { start('M05', boosters); const p = g.player; const x0 = p.x; g.keyDir = { x: 1, y: 0 }; for (let i = 0; i < 15; i++) g.updateCampaign(1 / 30); const dx = p.x - x0; g.keyDir = { x: 0, y: 0 }; g.leaveCampaignMission(); return dx; };
    const v0 = speed([]), v1 = speed(['sprint']);
    out.sprint = { ratio: +(v1 / v0).toFixed(3) };
    m = start('M26', ['shield']);
    const r0 = g.player.radius; m.growthUnits = 30; g.syncCampaignRadius(); const r1 = g.player.radius;
    g.campaignHit('bot'); g.campaignHit('bot'); const afterTwo = g.player.radius; g.player.invulnerableUntil = 0; g.campaignHit('bot');
    out.shield = { shieldsLeft: m.shields, radiusKept: afterTwo === r1, thirdHits: g.player.radius < r1, r0 };
    g.leaveCampaignMission();
    m = start('M05', ['magnet']); out.magnet = { active: g.activeMutations.has('magnes') }; g.leaveCampaignMission();
    return out;
  });
  const reach = await page.evaluate((ks) => {
    const g = window.game;
    const rows = [];
    for (const tierUnitsAt of [0, 22, 50]) {
      for (const k of ks) {
        for (const magnet of [false, true]) {
          g.missionBoosters = magnet ? ['magnet'] : [];
          g.startCampaignMission('M05');
          if (g.introPending) g.beginMissionPlay();
          if (g.rafId) cancelAnimationFrame(g.rafId);
          g.running = false; g.keyDir = { x: 0, y: 0 }; g.pointerScreen = null;
          const m = g.mission, p = g.player;
          m.growthUnits = tierUnitsAt; g.syncCampaignRadius();
          p.x = 1500; p.y = 1500;
          // Everything else out of the way; one fragment at k x the radius.
          const frag = g.campaignEntities.find(e => e.type === 'fragment' && !e.consumed);
          g.campaignEntities.forEach(e => { if (e !== frag) { e.x = 900; e.y = 900; } });
          g.bots.forEach(b => { b.x = 2100; b.y = 2100; });
          frag.x = p.x + k * p.radius; frag.y = p.y;
          let eatenAt = null;
          for (let f = 0; f < 120; f++) { g.updateCampaign(1 / 30); if (frag.consumed || frag.eating) { eatenAt = +(f / 30).toFixed(2); break; } if (m.ended || m.finishing) break; }
          rows.push({ radius: Math.round(p.radius), k, gapPx: Math.round((k - 0.85) * p.radius - frag.radius * 0.3), magnet, eatenAt, moved: Math.round(p.x + k * p.radius - frag.x) });
          g.leaveCampaignMission();
        }
      }
    }
    return rows;
  }, MAGNET_REACH_K);
  // Value on paired layouts.
  const ids = missions || await page.evaluate(() => {
    const pick = (d, n) => CAMPAIGN_MISSIONS.filter(m => m.diff === d && !m.setup.fragile).filter((m, i) => i % 3 === 0).slice(0, n).map(m => m.id);
    return [...pick(2, 8), ...pick(3, 8), ...pick(4, 8), ...pick(5, 8)];
  });
  const configs = { none: [], time: ['time'], start: ['start'], sprint: ['sprint'], magnet: ['magnet'] };
  const value = {};
  const attempts = [];
  for (const [name, boosters] of Object.entries(configs)) {
    let wins = 0, n = 0, el = 0;
    for (const id of ids) for (let k = 0; k < runs; k++) {
      const seed = seedFor(base, 'balance1-booster', id, k);
      const r = await page.evaluate(([mid, b, sd]) => { window.__qaSeedRandom(sd); try { return window.__qaPlayMission(mid, { style: 'casual', boosters: b, clock0: 1000000 }); } finally { window.__qaRestoreRandom(); } }, [id, boosters, seed]);
      n++; if (r.success) { wins++; el += r.elapsed; }
      attempts.push({ name, id, k, ok: r.success, el: r.elapsed, diff: r.diff });
    }
    value[name] = { pass: Math.round(100 * wins / n), n, meanClear: +(el / Math.max(1, wins)).toFixed(1) };
  }
  // Paired time saved: missions both 'none' and the booster cleared.
  for (const name of Object.keys(configs)) {
    if (name === 'none') continue;
    const pairs = attempts.filter(a => a.name === name && a.ok).map(a => [a, attempts.find(b => b.name === 'none' && b.id === a.id && b.k === a.k)]).filter(([, b]) => b && b.ok);
    value[name].pairedSaved = pairs.length ? +(pairs.reduce((s, [a, b]) => s + (b.el - a.el), 0) / pairs.length).toFixed(1) : null;
    value[name].lift = value[name].pass - value.none.pass;
  }
  const prices = await page.evaluate(() => Object.fromEntries(MISSION_BOOSTERS.map(b => [b.id, b.price])));
  await browser.close();
  return { functional, reach, value, ids, prices, errors: errors.slice(0, 3) };
}

// --- The 240 missions: completion under the real limit and the curve ------
// Every mission by the expert bot on several seeded layouts (three base
// seeds, one of them the seed that failed the casual EKSTREMALNA gate on
// the base before -- 1018968824) and by the casual bot; a mission the
// expert never clears in its limit is replayed without a limit to see why.
export const MISSION_SEEDS = [BALANCE_DEFAULT_SEED, 1018968824, 20261018];
export async function runMissionAudit(url, { expertSeeds = MISSION_SEEDS, casualRuns = 3, workers = 2, base = BALANCE_DEFAULT_SEED, only = null } = {}) {
  const { browser: b0, page: p0 } = await openGame(url);
  const meta = await p0.evaluate(() => DISTRICTS.flatMap(d => d.missions).map((id, i) => {
    const m = campaignMissionById(id);
    return { code: 'M' + String(i + 1).padStart(2, '0'), id, district: m.district, diff: m.diff, limit: m.timeLimit, botMed: (MISSION_BOT_TIME[id] || [])[0] || null, reward: m.reward.coins, boss: DISTRICTS.find(d => d.id === m.district).missions.slice(-1)[0] === id, twists: m.twists.join(',') };
  }));
  await b0.close();
  const list = only ? meta.filter(m => only.includes(m.id) || only.includes(m.code)) : meta;
  const runsAll = [];
  const chunks = Array.from({ length: workers }, (_, i) => list.filter((_, k) => k % workers === i));
  await Promise.all(chunks.map(async (chunk) => {
    const { browser, page } = await campaignPage(url);
    for (const m of chunk) {
      const plays = [...expertSeeds.map((s, k) => ['expert', seedFor(s, 'balance1-mission', m.id, 'expert', k)]), ...Array.from({ length: casualRuns }, (_, k) => ['casual', seedFor(base, 'balance1-mission', m.id, 'casual', k)])];
      for (const [style, seed] of plays) {
        const r = await page.evaluate(([id, st, sd]) => { window.__qaSeedRandom(sd); try { return window.__qaPlayMission(id, { style: st, clock0: 1000000 }); } finally { window.__qaRestoreRandom(); } }, [m.id, style, seed]);
        runsAll.push({ id: m.id, style, seed, ok: r.success, el: r.elapsed, fail: r.fail, stars: r.stars });
      }
      if (!runsAll.some(r => r.id === m.id && r.style === 'expert' && r.ok)) {
        const seed = seedFor(base, 'balance1-mission', m.id, 'open');
        const r = await page.evaluate(([id, sd]) => { window.__qaSeedRandom(sd); try { return window.__qaPlayMission(id, { style: 'expert', clock0: 1000000, openLimit: true }); } finally { window.__qaRestoreRandom(); } }, [m.id, seed]);
        runsAll.push({ id: m.id, style: 'open', seed, ok: r.success, el: r.elapsed, fail: r.fail });
      }
    }
    await browser.close();
  }));
  const rows = list.map(m => {
    const ex = runsAll.filter(r => r.id === m.id && r.style === 'expert'), ca = runsAll.filter(r => r.id === m.id && r.style === 'casual');
    const exOk = ex.filter(r => r.ok), open = runsAll.find(r => r.id === m.id && r.style === 'open');
    const med = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
    return { ...m, expert: `${exOk.length}/${ex.length}`, expertRate: exOk.length / ex.length, expertMed: med(exOk.map(r => r.el)), expertFails: ex.filter(r => !r.ok).map(r => r.fail),
      casualRate: ca.filter(r => r.ok).length / ca.length, casual: `${ca.filter(r => r.ok).length}/${ca.length}`, open: open ? { ok: open.ok, el: open.el, fail: open.fail } : null,
      slack: exOk.length ? +(m.limit / med(exOk.map(r => r.el))).toFixed(2) : null };
  });
  // Neighbour spikes inside a district (casual pass rate vs the mean of the
  // two missions on either side) and the reward per labelled difficulty.
  rows.forEach((r, i) => {
    const nb = rows.filter((x, j) => x.district === r.district && j !== i && Math.abs(j - i) <= 2);
    const mean = nb.length ? nb.reduce((a, x) => a + x.casualRate, 0) / nb.length : r.casualRate;
    r.neighbour = +mean.toFixed(2);
    r.spike = r.casualRate <= mean - 0.5 ? 'trudniejsza' : r.casualRate >= mean + 0.5 ? 'łatwiejsza' : '';
  });
  return { rows, runs: runsAll, seeds: { expert: expertSeeds, casual: base } };
}

export function missionSummary(rows) {
  const byDiff = [1, 2, 3, 4, 5].map(d => { const xs = rows.filter(r => r.diff === d); return { d, n: xs.length, expert: +(xs.reduce((a, r) => a + r.expertRate, 0) / Math.max(1, xs.length)).toFixed(2), casual: +(xs.reduce((a, r) => a + r.casualRate, 0) / Math.max(1, xs.length)).toFixed(2), reward: Math.round(xs.reduce((a, r) => a + r.reward, 0) / Math.max(1, xs.length)) }; });
  const never = rows.filter(r => r.expertRate === 0);
  return { byDiff, never: never.map(r => ({ code: r.code, id: r.id, diff: r.diff, limit: r.limit, botMed: r.botMed, fails: r.expertFails.join(','), open: r.open })), spikes: rows.filter(r => r.spike).map(r => `${r.code}(${r.id}) ${r.spike} ${r.casual} vs ${r.neighbour}`) };
}

// --- Saves and gear: nothing a player owns or saved changes -------------
// A v13 save that bought the whole old ladder (and wears the top look), a
// save from before PX02 D+ (the one-time refund stays 4 870, the old list
// price), a save with coins short of a new price, and a round left early
// (R1: score 0 = nothing, score > 0 = coinsSqrtK*sqrt(score), as before).
export async function runSaveChecks(url) {
  const results = [];
  const { browser, page, errors } = await openGame(url);
  const load = async (mutate) => {
    await page.evaluate((src) => {
      const s = defaultSave();
      s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
      s.settings.music = false; s.settings.sfx = false;
      s.coach = { moved: true, ate: true, rival: true, danger: true };
      // eslint-disable-next-line no-new-func
      new Function('s', src)(s);
      localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s));
    }, mutate);
    await page.reload();
    await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
    return page.evaluate(() => { const g = window.game, s = g.save, raw = JSON.parse(localStorage.getItem('vectorHoleSave_v1'));
      return { coins: s.coins, prisms: s.prisms, owned: s.owned.slice().sort(), selected: s.selected, auras: s.auras.owned.slice().sort(), aura: s.auras.selected,
        boosters: s.boosters, level: s.player.level, schema: raw.schemaVersion, eco: s.economy, version: SAVE_SLOT }; });
  };
  const vet = await load(`s.coins = 1234; s.prisms = 56; s.owned = ['rainbow','cyan','pink','green','purple','gold','white']; s.selected = 'white';
    s.auras.owned = ['none','spark']; s.auras.selected = 'spark'; s.boosters = Object.assign(s.boosters, { time: 2, magnet: 3 }); s.player = { level: 17, xp: 40 };`);
  results.push(expectAll('BALANCE-1 save: a v13 save that bought the whole old ladder keeps every look, what it wears, its coins, prisms, boosters and level', {
    owned: is(vet.owned.join(','), 'cyan,gold,green,pink,purple,rainbow,white'), selected: is(vet.selected, 'white'), spark: is(vet.auras.join(','), 'none,spark'), aura: is(vet.aura, 'spark'),
    coins: is(vet.coins, 1234), prisms: is(vet.prisms, 56), magnet: is(vet.boosters.magnet, 3), time: is(vet.boosters.time, 2), level: is(vet.level, 17), schema: is(vet.schema, 13)
  }, JSON.stringify(vet)));
  const legacy = await load(`s.coins = 10; s.owned = ['rainbow','cyan','pink','green','purple','gold','white']; s.economy = { looksOnly: 0, refund: 0, notice: false, boughtAfter: [] };`);
  results.push(expectAll('BALANCE-1 save: a save from before PX02 D+ still gets the one-time refund at the old list price (4 870), once', {
    coins: is(legacy.coins, 10 + 4870), refund: is(legacy.eco.refund, 4870), settled: is(legacy.eco.looksOnly, 1), owned: is(legacy.owned.length, 7)
  }, JSON.stringify(legacy.eco)));
  const short = await load(`s.coins = 2000; s.owned = ['rainbow','cyan']; s.stats.runsPlayed = 6; s.unlocks.announced = ['warsztat'];`);
  const buy = await page.evaluate(() => {
    const g = window.game, w = SKINS.find(x => x.id === 'white');
    g.openWarsztatScreen(); g.onCosmeticPick('skin', w);
    const btn = document.getElementById('btnInfoSheetAction'); const label = btn && !btn.classList.contains('hidden') ? btn.textContent : '';
    const body = (document.querySelector('#infoSheet') || document.body).textContent;
    g.closeInfoSheet();
    return { coins: g.save.coins, owned: g.save.owned.includes('white'), label, short: /brakuje jeszcze 1800/.test(body), price: w.price };
  });
  results.push(expectAll('BALANCE-1 save: coins short of a new price buy nothing and lose nothing (Biała Plazma 3 800, 2 000 saved: "brakuje jeszcze 1800")', {
    coins: is(buy.coins, 2000), notOwned: falsy(buy.owned), short: truthy(buy.short), price: is(buy.price, 3800), loaded: is(short.coins, 2000)
  }, JSON.stringify(buy)));
  await page.addScriptTag({ content: ARENA_BOT });
  const r1 = await page.evaluate(() => {
    const g = window.game, out = {};
    const leave = (frames) => {
      const c0 = g.save.coins, l0 = g.save.player.level, x0 = g.save.player.xp + g.save.player.level * 1e6, runs0 = g.save.stats.runsPlayed, core0 = g.save.hub.coreCharge || 0;
      let score = 0;
      window.__qaPlayArena({ style: 'greedy', noRender: true, onFrame: (f, game) => { if (f === frames) { score = game.player.score; game.leaveRun(); } } });
      const E = CONFIG.economy, newbie = runs0 < E.newbieRuns;
      // ...plus the usual level reward if that XP crossed a level (R1).
      let want = score > 0 ? Math.round(Math.round(E.coinsSqrtK * Math.sqrt(score)) * (newbie ? E.newbieCoinMult : 1)) : 0;
      for (let l = l0 + 1; l <= g.save.player.level; l++) want += CONFIG.progression.levelCoins(l);
      return { score, got: g.save.coins - c0, want, xpMoved: g.save.player.xp + g.save.player.level * 1e6 !== x0, runs: g.save.stats.runsPlayed - runs0, core: (g.save.hub.coreCharge || 0) - core0 };
    };
    out.zero = leave(1); out.played = leave(30 * 40);
    return out;
  });
  results.push(expectAll('BALANCE-1 R1: a round left at score 0 grants and counts nothing; left with a score it pays coinsSqrtK*sqrt(score) only (no run, no Core City)', {
    zeroScore: is(r1.zero.score, 0), zeroCoins: is(r1.zero.got, 0), zeroXp: falsy(r1.zero.xpMoved), zeroRun: is(r1.zero.runs, 0),
    played: holds(r1.played.score > 0, r1.played.score, '> 0'), partial: is(r1.played.got, r1.played.want), playedRun: is(r1.played.runs, 0), playedCore: is(r1.played.core, 0)
  }, JSON.stringify(r1)));
  results.push(expectAll('BALANCE-1 save: schema, key and slot unchanged', { schema: is(vet.schema, 13), slot: is(vet.version, 'vectorHoleSave_v1') }, ''));
  results.push(report('BALANCE-1 save: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | ')));
  await browser.close();
  return results;
}

// --- Daily tasks, deterministic: each of the four rotates in (one per UTC
// day), and through the game's own checkMissionProgress() + finalizeRun()
// a round one short of the target does not complete it, a round at the
// target does -- with its reward, once.
export async function runDailyTaskChecks(url) {
  const { browser, page, errors } = await openGame(url, { initScript: DATE_OFFSET_SCRIPT });
  const rows = await page.evaluate(() => {
    const g = window.game, seen = {}, out = [];
    for (let d = 0; d < 40 && Object.keys(seen).length < 4; d++) {
      window.__qaDateOffset = d * 86400000;
      g.startRound({}); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
      const m = g.activeMission; g.stopRun();
      if (seen[m.id]) continue;
      seen[m.id] = d;
      const play = (value) => {
        g.startRound({}); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
        g.save.mission = { dateKey: g.save.mission.dateKey, completed: false };
        const set = { eat_5_rivals: () => { g.rivalsEatenThisRun = value; }, reach_size_60: () => { g.player.radius = value; }, combo_x3: () => { g.comboCount = value; }, score_150: () => { g.player.score = value; } }[m.id];
        set(); g.checkMissionProgress(); g.timeRemaining = 0;
        const c0 = g.save.coins; g.finalizeRun();
        const again = g.save.mission.completed && (() => { g.startRound({}); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; set(); g.checkMissionProgress(); g.timeRemaining = 0; g.finalizeRun(); return g.missionJustCompleted; })();
        return { done: g.save.mission.completed, paidTask: c0 !== g.save.coins, again: !!again };
      };
      out.push({ id: m.id, name: m.name, target: m.target, reward: m.rewardCoins, below: play(m.target - 1), at: play(m.target) });
    }
    window.__qaDateOffset = 0;
    return out;
  });
  const results = [];
  results.push(expectAll('BALANCE-1 daily tasks: all four rotate in, and each completes exactly at its target (one short: not done; at it: done, its reward once)', {
    four: is(rows.length, 4),
    exact: holds(rows.every(r => !r.below.done && r.at.done && !r.at.again), rows.map(r => `${r.id}:${r.target}→${r.below.done ? 'x' : '-'}/${r.at.done ? 'ok' : 'x'}${r.at.again ? '+again' : ''}`).join(' '), 'below not done, at target done once'),
    targets: is(rows.map(r => r.target).sort((a, b) => a - b).join(','), '3,30,90,4000')
  }, JSON.stringify(rows.map(r => ({ id: r.id, name: r.name, target: r.target, reward: r.reward })))));
  results.push(report('BALANCE-1 daily tasks: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | ')));
  await browser.close();
  return results;
}

// --- Gates ----------------------------------------------------------------
const snapAt = (c, min) => c.snaps.find(s => s.min === min);
export function careerGates(careers, minutes) {
  const out = [];
  const by = Object.fromEntries(careers.map(c => [c.profile, c]));
  const first = careers.map(c => `${c.profile} ${c.firsts.firstPurchase}`).join(' · ');
  out.push(report('BALANCE-1 careers: every simulated player buys a first look the moment Warsztat opens (<= 7 min)', careers.every(c => c.firsts.firstPurchase != null && c.firsts.firstPurchase <= 7), first));
  const all = careers.map(c => `${c.profile} ${c.firsts.allCoinItems == null ? '>' + minutes : c.firsts.allCoinItems} min`).join(' · ');
  out.push(report('BALANCE-1 careers: the coin ladder is not given away -- the weak, average and quitting players need over an hour for all of it', ['weak', 'average', 'quitter'].every(p => !by[p] || by[p].firsts.allCoinItems == null || by[p].firsts.allCoinItems > 60), all));
  if (minutes >= 240) out.push(report('BALANCE-1 careers: ...and it is no grind -- every player owns all of it within 4 hours of play', careers.every(c => c.firsts.allCoinItems != null && c.firsts.allCoinItems <= 240), all));
  const ladder = careers.map(c => { const s = snapAt(c, 60); return `${c.profile} ${s ? s.coinItemsOwned : '?'}/7`; }).join(' · ');
  out.push(report('BALANCE-1 careers: a steady ladder -- by 60 min every player owns at least 4 of the 7 coin looks', careers.every(c => { const s = snapAt(c, 60); return s && s.coinItemsOwned >= 4; }), ladder));
  const tasks = (c) => { const ar = c.arena.filter(r => !r.left && r.kind === 'arena'); const f = (fn) => ar.filter(fn).length / Math.max(1, ar.length);
    return { score: f(r => r.tasks.score >= 4000), combo: f(r => r.tasks.combo >= 30), size: f(r => r.tasks.radius >= 90), rivals: f(r => r.tasks.rivals >= 3) }; };
  // The first hour is only ~13 finished rounds per player, so a rate gate
  // must leave room for sampling: points / combo / rivals fail only when
  // the weak player meets them in >= 12 of 13 rounds (the old 150 points
  // and combo x3 were 13/13; measured now 1-8/13). T5 is the deliberately
  // easy day (docs/BALANCE1_REPORT.md) and is not rate-gated. Reachable =
  // met in at least one round of the other players (~40 rounds pooled;
  // the rarest, 3 rivals, in 4-9 of 13 of the average player's alone).
  // That each task completes exactly at its target: runDailyTaskChecks().
  const tw = by.weak ? tasks(by.weak) : null;
  const pooled = careers.filter(c => c.profile !== 'weak').flatMap(c => c.arena.filter(r => !r.left && r.kind === 'arena'));
  const reach = { score: pooled.filter(r => r.tasks.score >= 4000).length, combo: pooled.filter(r => r.tasks.combo >= 30).length, size: pooled.filter(r => r.tasks.radius >= 90).length, rivals: pooled.filter(r => r.tasks.rivals >= 3).length };
  if (tw) out.push(report('BALANCE-1 daily tasks: points, combo and rivals are real challenges -- the weak player meets none of them in >= 12 of 13 rounds (T5 is the deliberately easy day)', ['score', 'combo', 'rivals'].every(k => tw[k] < 0.9), JSON.stringify({ weak: tw })));
  if (pooled.length) out.push(report('BALANCE-1 daily tasks: every task is reachable -- met in at least one round of the average / strong / quitting players', Object.values(reach).every(n => n >= 1), `${JSON.stringify(reach)} of ${pooled.length} rounds`));
  out.push(report('BALANCE-1 careers: coins and prisms stay finite and non-negative, no runtime errors', careers.every(c => c.snaps.every(s => Number.isFinite(s.coins) && s.coins >= 0 && s.prisms >= 0) && !c.errors.length), careers.map(c => c.errors.join(' ')).join('') || 'ok'));
  return out;
}

export function boosterGates(b) {
  const out = [], f = b.functional;
  out.push(expectAll('BALANCE-1 boosters: each does what its card says (Zegar +15 s, Turbo start at T2, Sprint x1.15, Tarcza 2 hits, Magnes on)', {
    time: is(f.time.with - f.time.base, 15), start: is(f.start.tier, 'T2'), sprint: holds(Math.abs(f.sprint.ratio - 1.15) < 0.01, f.sprint.ratio, '1.15'),
    shield: holds(f.shield.shieldsLeft === 0 && f.shield.radiusKept && f.shield.thirdHits, JSON.stringify(f.shield), 'two hits absorbed, the third costs growth'), magnet: truthy(f.magnet.active)
  }, JSON.stringify(f)));
  const pulled = b.reach.filter(r => r.magnet && r.k === 2), none = b.reach.filter(r => !r.magnet && r.eatenAt != null), far = b.reach.filter(r => r.magnet && r.gapPx > 120 && r.eatenAt != null);
  out.push(report('BALANCE-1 Magnes: pulls what the vortex may eat from twice its radius at T1, T3 and T4 (it reached ~1.2x before), nothing moves without it, nothing from beyond its reach',
    pulled.length === 3 && pulled.every(r => r.eatenAt != null && r.eatenAt <= 4) && none.length === 0 && far.length === 0, b.reach.filter(r => r.magnet).map(r => `r${r.radius}·${r.k}x:${r.eatenAt == null ? '-' : r.eatenAt + 's'}`).join(' ')));
  const v = b.value, lifts = ['time', 'start', 'sprint', 'magnet'].map(k => `${k} ${v[k].lift >= 0 ? '+' : ''}${v[k].lift}`).join(' · ');
  out.push(report('BALANCE-1 Magnes: lifts the casual pass rate (>= +5 points on paired layouts) without beating Zegar by more than 8', v.magnet.lift >= 5 && v.magnet.lift <= v.time.lift + 8, `${lifts} (none ${v.none.pass}%, n=${v.none.n})`));
  out.push(report('BALANCE-1 boosters: price follows value -- Magnes costs what Zegar costs now that it helps about as much', b.prices.magnet === b.prices.time, JSON.stringify(b.prices)));
  out.push(report('BALANCE-1 boosters: no runtime errors', !b.errors.length, b.errors.join(' | ')));
  return out;
}

export function missionGates(a) {
  const out = [], r = a.rows, sum = missionSummary(r);
  const exAll = r.reduce((s, x) => s + x.expertRate, 0) / r.length;
  out.push(report(`BALANCE-1 missions: the expert clears >= 88% of its attempts under the real limits (${a.seeds.expert.length} seeds per mission)`, exAll >= 0.88, `${Math.round(exAll * 100)}% · never in limit: ${sum.never.map(n => n.code).join(' ') || 'none'}`));
  out.push(report('BALANCE-1 missions: no difficulty level leaves the expert under 70% in limit', sum.byDiff.every(d => !d.n || d.expert >= 0.7), sum.byDiff.map(d => `d${d.d} ${Math.round(d.expert * 100)}%`).join(' ')));
  out.push(report('BALANCE-1 missions: the reward rises with the labelled difficulty', sum.byDiff.every((d, i) => i === 0 || !d.n || d.reward >= sum.byDiff[i - 1].reward), sum.byDiff.map(d => `d${d.d} ${d.reward}`).join(' ')));
  return out;
}

/** run-all: careers over the first hour (4 profiles), the boosters, the
 *  saves; `full` adds 10-hour careers and the 240-mission audit. */
export async function runBalance1Checks(url, { full = false, base = BALANCE_DEFAULT_SEED } = {}) {
  const results = [];
  const dir = path.join(OUT, 'balance1', full ? 'full' : 'quick');
  fs.mkdirSync(dir, { recursive: true });
  console.log(`  balance1 seed ${base} -- replay: node qa/balance1.mjs ${full ? '' : '--quick '}--seed=${base}`);
  const minutes = full ? 600 : 60;
  const careers = await runCareers(url, { minutes, base });
  fs.writeFileSync(path.join(dir, 'careers.json'), JSON.stringify(careers, null, 1));
  careers.forEach(c => { console.log(`\n  ${c.profile}: ${JSON.stringify(c.firsts)}`); console.log(careerTable(c)); });
  results.push(...careerGates(careers, minutes));
  const b = await runBoosterAudit(url, { base, runs: 2 });
  fs.writeFileSync(path.join(dir, 'boosters.json'), JSON.stringify(b, null, 1));
  results.push(...boosterGates(b));
  results.push(...await runSaveChecks(url));
  results.push(...await runDailyTaskChecks(url));
  if (full) {
    const a = await runMissionAudit(url, { base });
    fs.writeFileSync(path.join(dir, 'missions.json'), JSON.stringify(a, null, 1));
    console.log(JSON.stringify(missionSummary(a.rows)));
    results.push(...missionGates(a));
  }
  return results;
}

if (isMain(import.meta.url)) {
  const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  const root = arg('root', null);
  const seedArg = arg('seed', process.env.VH_QA_SEED || BALANCE_DEFAULT_SEED);
  const base = Number(seedArg) >>> 0;
  const only = arg('only', null);
  const { server, url } = await serve(root ? { root: path.resolve(root) } : {});
  if (!only && !root) {
    // The suite: PASS/FAIL gates.
    const res = await runBalance1Checks(url, { full: !process.argv.includes('--quick'), base });
    server.close();
    const failed = res.filter(r => !r.ok);
    console.log(`\n${res.length - failed.length}/${res.length} checks passed`);
    process.exit(failed.length ? 1 : 0);
  }
  // Report only (another checkout, or one part): no gates, data to qa/out/balance1/<tag>/.
  const tag = arg('tag', root ? 'other' : 'current');
  const parts = only || 'careers,boosters,missions';
  const minutes = Number(arg('minutes', process.argv.includes('--quick') ? 60 : 600));
  const dir = path.join(OUT, 'balance1', tag);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`BALANCE-1 seed ${base} -- tag ${tag}${root ? ' root ' + root : ''} (report only)`);
  if (parts.includes('careers')) {
    const careers = await runCareers(url, { minutes, base, profiles: arg('profiles', Object.keys(PROFILES).join(',')).split(',') });
    fs.writeFileSync(path.join(dir, 'careers.json'), JSON.stringify(careers, null, 1));
    careers.forEach(c => { console.log(`\n### ${c.profile}  firsts ${JSON.stringify(c.firsts)} stuck ${c.stuck.join(' ') || '-'}`); console.log(careerTable(c)); });
  }
  if (parts.includes('boosters')) {
    const b = await runBoosterAudit(url, { base, runs: Number(arg('runs', 2)) });
    fs.writeFileSync(path.join(dir, 'boosters.json'), JSON.stringify(b, null, 1));
    console.log('\nfunctional', JSON.stringify(b.functional));
    console.log('reach', b.reach.map(r => `r${r.radius} k${r.k} gap${r.gapPx} ${r.magnet ? 'M' : '-'}:${r.eatenAt == null ? 'x' : r.eatenAt}`).join(' | '));
    console.log('value', JSON.stringify(b.value));
  }
  if (parts.includes('missions')) {
    const nSeeds = Number(arg('expert-seeds', MISSION_SEEDS.length));
    const expertSeeds = Array.from({ length: nSeeds }, (_, k) => MISSION_SEEDS[k] != null ? MISSION_SEEDS[k] : seedFor(base, 'expert-seed', k));
    const a = await runMissionAudit(url, { base, expertSeeds, casualRuns: Number(arg('casual', 3)), only: arg('ids', null) ? arg('ids', '').split(',') : null });
    fs.writeFileSync(path.join(dir, 'missions.json'), JSON.stringify(a, null, 1));
    console.log('\nmissions', JSON.stringify(missionSummary(a.rows), null, 1));
  }
  if (parts.includes('saves')) (await runSaveChecks(url)).forEach(() => {});
  server.close();
}
