// FTUE-1 „Druga runda” (owner-approved variant D: Arena as the centre +
// a ladder of three rounds):
//  - 1A: the first Arena result shows no automatic card (the old
//    "DRUGI TRYB · KAMPANIA" came at 650 ms, over the count-up);
//    ZAGRAJ JESZCZE RAZ starts round 2 straight from the result.
//  - 1B: the campaign is presented by Miasto's campaign tile (NOWE, no
//    popup) from the third Arena round on, only to a player who hasn't met
//    it (save.unlocks.announced 'kampania', a mission started or cleared);
//    a Dzielnice visit marks it met. Dzielnice stays open from round 1.
//  - 1C: no "×2 MONET · REKLAMA" on the first Arena result in the save's
//    history (runsPlayed === 1) -- nor on the first *finished* one after a
//    round left early (pause -> OPUŚĆ RUNDĘ also counts in runsPlayed), in
//    one session or after a relaunch; the reward itself is unchanged; the
//    share button fills the row.
//  - 1D: a session that started on the welcome card shows no login
//    calendar on the first Miasto visit after the play -- on the second
//    visit, or at the next launch; one claim per day, as before.
//  - 1E: the Warsztat / Wyzwania cards on an Arena result wait for the
//    result's animation (CONFIG.ftue.resultCelebrationDelayMs) and never
//    show once the player left the result (no series of cards later).
//  - Existing saves (1, 2, 3+ rounds; campaign announced or not; mission
//    known; login claimed today or not): nothing repeated, nothing lost,
//    nothing granted twice; schemaVersion stays 13.
// Usage: node qa/ftue1.mjs
import { serve, openGame, report } from './lib.mjs';

/** In-page driver: plays the round that is running now (started by a real
 *  button) for `seconds` of virtual time with greedy steering, then lets
 *  the clock run out (endRound()) -- or, with finish = false, leaves the
 *  round running (frozen) so the pause sheet can still be opened. */
const FTUE_TICK = `
window.__ftuePlay = function (seconds, finish = true) {
  const g = window.game, p = g.player, dt = 1 / 30;
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  let v = realNow();
  performance.now = () => v;
  if (g.rafId) cancelAnimationFrame(g.rafId);
  g.running = false;
  let frames = 0;
  while (g.state === GameState.PLAYING && frames < seconds * 30) {
    if (g.evolutionPending) { g.skipEvolutionOffer(); continue; }
    let best = null, bs = -1;
    for (const o of g.objects) {
      if (o.consumed || o.removed || o.eating || !g.holeCanEat(p, o)) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y), s = (o.value + 2) / (d + 40);
      if (s > bs) { bs = s; best = o; }
    }
    if (best) { const m = Math.hypot(best.x - p.x, best.y - p.y) || 1; g.keyDir = { x: (best.x - p.x) / m, y: (best.y - p.y) / m }; }
    v += dt * 1000; g.update(dt); frames++;
  }
  if (!finish) { g.keyDir = { x: 0, y: 0 }; performance.now = realNow; g.running = g.state === GameState.PLAYING; return g.player.score; }
  if (g.state === GameState.PLAYING) { g.timeRemaining = 0.001; v += 16; g.update(0.016); }
  g.keyDir = { x: 0, y: 0 };
  performance.now = realNow;
  return g.player.score;
};
window.__ftueVis = (id) => { const el = document.getElementById(id); return !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none'; };
window.__ftueResult = () => ({
  result: __ftueVis('gameOverScreen'), overlay: __ftueVis('unlockOverlay'), title: __ftueVis('unlockOverlay') ? document.getElementById('unlockTitle').textContent : null,
  ad: __ftueVis('btnWatchAd'), share: __ftueVis('btnShare'), again: __ftueVis('btnPlayAgain'), score: document.getElementById('finalScore').textContent, login: __ftueVis('loginRewardScreen')
});
window.__ftueHub = () => ({
  hub: __ftueVis('mainMenu'), login: __ftueVis('loginRewardScreen'), overlay: __ftueVis('unlockOverlay'), info: __ftueVis('infoSheet'),
  intro: document.getElementById('hubCampaignTile').classList.contains('is-intro'), title: document.getElementById('hubCampaignTitle').textContent,
  dzNew: document.getElementById('btnNavDzielnice').classList.contains('is-new'), announced: window.game.save.unlocks.announced.join(','), claims: window.game.save.login.totalClaims
});
/** The reward of the round that just ended, from CONFIG.economy (formula untouched by FTUE-1). */
window.__ftueReward = (c0, runsBefore) => {
  const g = window.game, E = CONFIG.economy;
  const ranked = rankHoles([g.player, ...g.bots]), place = ranked.indexOf(g.player) + 1;
  let want = E.coinsBase + Math.round(E.coinsSqrtK * Math.sqrt(Math.max(0, g.player.score))) + (E.coinsPlaceBonus[place - 1] || 0);
  if (runsBefore < E.newbieRuns) want = Math.round(want * E.newbieCoinMult);
  const extra = (g.lastXpResult && g.lastXpResult.levelsUp || []).reduce((a, l) => a + (l.coins || 0), 0) + (g.hubMilestoneRewards || []).reduce((a, r) => a + (r.coins || 0), 0);
  return { ok: g.adPendingCoins === want && g.save.coins - c0 === want + extra, want, got: g.adPendingCoins, delta: g.save.coins - c0, extra };
};
`;

const dayKey = (off) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + off); return d.toISOString().slice(0, 10); };

/** Opens the game on a save built from defaultSave() by `build` (or fresh). */
async function withSave(url, build, opts = {}) {
  const g = await openGame(url, opts);
  if (build) {
    const save = await g.page.evaluate(build);
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  }
  await g.page.addScriptTag({ content: FTUE_TICK });
  return g;
}
const playedSave = (o) => `(() => {
  const s = defaultSave(), o = ${JSON.stringify(o)};
  s.stats.runsPlayed = o.runs; s.unlocks.announced = o.announced; s.unlocks.fresh = o.fresh || [];
  s.coach = { moved: true, ate: true, rival: true, danger: true };
  s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
  s.login = o.login; s.coins = 300;
  // A finished Arena round leaves its score in recentArenaScores (last 5);
  // a round left early (leaveRun()) only counts in runsPlayed.
  s.stats.recentArenaScores = o.recent || Array.from({ length: Math.min(o.runs, CONFIG.rival.history) }, () => 4000);
  (o.completed || []).forEach(id => { s.campaign.completed[id] = true; });
  return s;
})()`;

export async function runFtue1Checks(url) {
  const results = [];
  const vps = [{ width: 390, height: 844 }, { width: 375, height: 667 }, { width: 844, height: 390 }, { width: 1280, height: 720 }];

  // --- New player: Arena 1 -> result -> replay -> Arena 2 -> Warsztat -> Arena 3 -> Miasto -> optional campaign
  for (const vp of vps) {
    const tag = `${vp.width}x${vp.height}`;
    const g = await withSave(url, null, { viewport: vp, mobile: vp.width < 960 });
    const { page } = g;
    const a1 = await page.evaluate(async () => {
      const gm = window.game, out = { first: gm.isFirstRun() };
      const c0 = gm.save.coins;
      document.getElementById('btnWelcomePlay').click();
      out.arena = gm.mode === 'arena' && gm.state === GameState.PLAYING;
      out.len = gm.timeRemaining;
      window.__ftuePlay(20);
      out.reward = window.__ftueReward(c0, 0);
      out.t0 = window.__ftueResult();
      const row = document.getElementById('btnShare').parentElement.getBoundingClientRect().width;
      out.fill = Math.abs(document.getElementById('btnShare').getBoundingClientRect().width - row) <= 2;
      // Watch the first result for 4 s: no card, and the count-up ends.
      out.cards = 0;
      for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 100)); if (__ftueVis('unlockOverlay')) out.cards++; }
      out.score = Number(document.getElementById('finalScore').textContent.replace(/\D/g, '')) === gm.player.score;
      out.kampania = /kampania/.test(gm.save.unlocks.announced.join() + gm.save.unlocks.fresh.join());
      out.m01 = gm.isMissionPlayable('M01');
      return out;
    });
    results.push(report(`FTUE-1A ${tag}: first Arena result -- no automatic card for 4 s, count-up finished, ZAGRAJ JESZCZE RAZ on screen`, a1.first && a1.arena && a1.t0.result && a1.t0.again && a1.cards === 0 && !a1.t0.login && a1.score, JSON.stringify(a1)));
    results.push(report(`FTUE-1C ${tag}: first Arena result -- no ×2 ad button, share fills the row, reward = CONFIG.economy`, !a1.t0.ad && a1.t0.share && a1.fill && a1.reward.ok, JSON.stringify({ t0: a1.t0, fill: a1.fill, reward: a1.reward })));
    results.push(report(`FTUE-1B ${tag}: campaign not announced after round 1, still playable`, !a1.kampania && a1.m01, JSON.stringify(a1)));

    const a2 = await page.evaluate(async () => {
      const gm = window.game, out = {};
      const c0 = gm.save.coins;
      let len = null;
      const orig = gm.startRound;
      gm.startRound = function (o) { const r = orig.call(this, o); len = this.timeRemaining; return r; };
      document.getElementById('btnPlayAgain').click();
      await new Promise(r => setTimeout(r, 50));
      gm.startRound = orig;
      out.direct = gm.mode === 'arena' && gm.state === GameState.PLAYING && !__ftueVis('mainMenu') && !__ftueVis('campaignScreen');
      out.len = len;
      window.__ftuePlay(20);
      out.reward = window.__ftueReward(c0, 1);
      out.ad = __ftueVis('btnWatchAd');
      // The card waits for the animation: note when it first shows, and the score at that moment.
      const t0 = performance.now();
      out.at = null;
      for (let i = 0; i < 40 && out.at === null; i++) {
        await new Promise(r => setTimeout(r, 100));
        if (__ftueVis('unlockOverlay')) { out.at = Math.round(performance.now() - t0); out.scoreDone = Number(document.getElementById('finalScore').textContent.replace(/\D/g, '')) === gm.player.score; out.title = document.getElementById('unlockTitle').textContent; }
      }
      document.getElementById('btnUnlockLater').click();
      await new Promise(r => setTimeout(r, 100));
      out.back = __ftueVis('gameOverScreen') && !__ftueVis('unlockOverlay');
      return out;
    });
    results.push(report(`FTUE-1A ${tag}: ZAGRAJ JESZCZE RAZ starts round 2 at once, same 2:00 round`, a2.direct && a2.len === 120, JSON.stringify(a2)));
    results.push(report(`FTUE-1E ${tag}: Warsztat card after the result animation (>= delay, count-up done), PÓŹNIEJ back to the result; ad offer back on round 2`, a2.title === 'WARSZTAT' && a2.at >= 2000 && a2.scoreDone && a2.back && a2.ad && a2.reward.ok, JSON.stringify(a2)));

    const a3 = await page.evaluate(async () => {
      const gm = window.game, out = {};
      document.getElementById('btnPlayAgain').click();
      await new Promise(r => setTimeout(r, 50));
      window.__ftuePlay(15);
      await new Promise(r => setTimeout(r, CONFIG.ftue.resultCelebrationDelayMs + 400));
      out.title = __ftueVis('unlockOverlay') && document.getElementById('unlockTitle').textContent;
      document.getElementById('btnUnlockLater').click();
      await new Promise(r => setTimeout(r, 100));
      out.series = __ftueVis('unlockOverlay');
      document.getElementById('btnMenu').click();
      await new Promise(r => setTimeout(r, 1500));
      out.hub1 = window.__ftueHub();
      const nav = document.getElementById('bottomNav');
      const navTop = nav && !nav.classList.contains('hidden') && getComputedStyle(nav).position === 'fixed' && nav.getBoundingClientRect().top < innerHeight - 1 ? nav.getBoundingClientRect().top : innerHeight;
      const b = (id) => document.getElementById(id).getBoundingClientRect();
      out.fits = b('btnStart').bottom <= navTop + 1 && b('hubCampaignTile').bottom <= navTop + 1 && b('btnStart').top < b('hubCampaignTile').top;
      document.getElementById('btnNavWarsztat').click();
      await new Promise(r => setTimeout(r, 200));
      document.getElementById('btnNavMiasto').click();
      await new Promise(r => setTimeout(r, 1200));
      out.hub2 = window.__ftueHub();
      const c0 = gm.save.coins;
      document.getElementById('btnLoginClaim').click();
      gm.claimLoginReward();
      out.claim = { d: gm.save.coins - c0, want: CONFIG.loginRewards[0].coins, claims: gm.save.login.totalClaims };
      gm.showScreen('mainMenu');
      document.getElementById('hubCampaignTile').click();
      await new Promise(r => setTimeout(r, 200));
      out.campaign = __ftueVis('campaignScreen') && gm.save.unlocks.announced.includes('kampania');
      document.getElementById('btnNavMiasto').click();
      await new Promise(r => setTimeout(r, 1200));
      out.hub3 = window.__ftueHub();
      out.schema = JSON.parse(localStorage.getItem('vectorHoleSave_v1')).schemaVersion;
      return out;
    });
    results.push(report(`FTUE-1E ${tag}: Wyzwania card after round 3, no second card queued`, a3.title === 'WYZWANIA' && !a3.series, JSON.stringify(a3)));
    results.push(report(`FTUE-1B/1D ${tag}: first Miasto visit -- campaign tile presents the mode (NOWE, Dzielnice NOWE), no calendar, no popup; GRAJ above it, both on screen`, a3.hub1.intro && a3.hub1.dzNew && !a3.hub1.login && !a3.hub1.overlay && !a3.hub1.info && a3.fits, JSON.stringify({ hub1: a3.hub1, fits: a3.fits })));
    results.push(report(`FTUE-1D ${tag}: calendar on the second Miasto visit, day 1 paid once`, a3.hub2.login && a3.claim.d === a3.claim.want && a3.claim.claims === 1, JSON.stringify({ hub2: a3.hub2, claim: a3.claim })));
    results.push(report(`FTUE-1B ${tag}: the tile opens Dzielnice and is not shown again; schemaVersion 13`, a3.campaign && !a3.hub3.intro && !a3.hub3.dzNew && /^M01 · /.test(a3.hub3.title) && !a3.hub3.login && a3.schema === 13, JSON.stringify(a3.hub3)));
    results.push(report(`FTUE-1 ${tag}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 3).join(' | ')));
    await g.browser.close();
  }

  // --- New player who goes to Miasto right after the first result, then relaunches
  {
    const g = await withSave(url, null, { viewport: { width: 390, height: 844 } });
    const { page } = g;
    const r1 = await page.evaluate(async () => {
      const gm = window.game, out = {};
      document.getElementById('btnWelcomePlay').click();
      window.__ftuePlay(15);
      document.getElementById('btnMenu').click();
      await new Promise(r => setTimeout(r, 1500));
      out.hub1 = window.__ftueHub();
      return out;
    });
    await page.reload();
    await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
    await page.addScriptTag({ content: FTUE_TICK });
    await page.waitForTimeout(1500);
    const r2 = await page.evaluate(async () => {
      const gm = window.game, out = { hub: window.__ftueHub() };
      const c0 = gm.save.coins;
      if (__ftueVis('loginRewardScreen')) document.getElementById('btnLoginClaim').click();
      out.claim = { d: gm.save.coins - c0, want: CONFIG.loginRewards[0].coins, claims: gm.save.login.totalClaims };
      return out;
    });
    await page.reload();
    await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
    await page.addScriptTag({ content: FTUE_TICK });
    await page.waitForTimeout(1500);
    const r3 = await page.evaluate(() => window.__ftueHub());
    results.push(report('FTUE-1D: Miasto right after the first result -- no calendar, no campaign card or tile intro', r1.hub1.hub && !r1.hub1.login && !r1.hub1.overlay && !r1.hub1.intro && /^M01 · /.test(r1.hub1.title), JSON.stringify(r1)));
    results.push(report('FTUE-1D: relaunch -- calendar offered at once, day 1 paid once', r2.hub.login && r2.claim.d === r2.claim.want && r2.claim.claims === 1, JSON.stringify(r2)));
    results.push(report('FTUE-1D: second relaunch the same day -- no calendar, still one claim', !r3.login && r3.claims === 1, JSON.stringify(r3)));
    await g.browser.close();
  }

  // --- 1C regression: the first Arena round left early (pause -> OPUŚĆ RUNDĘ
  // -> TAK, OPUŚĆ) still counts in runsPlayed, so the first *finished* result
  // must hide the ad by itself -- in the same session and after a relaunch.
  const relaunchPage = async (page) => {
    await page.reload();
    await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
    await page.addScriptTag({ content: FTUE_TICK });
    await page.waitForTimeout(1200);
  };
  const finishFromHub = (page) => page.evaluate(() => {
    const gm = window.game, out = {};
    if (__ftueVis('loginRewardScreen')) document.getElementById('btnLoginClaim').click();
    const c0 = gm.save.coins, runs0 = gm.save.stats.runsPlayed;
    gm.showScreen('mainMenu');
    document.getElementById('btnStart').click();
    out.arena = gm.mode === 'arena' && gm.state === GameState.PLAYING && !gm.challenge;
    window.__ftuePlay(20);
    out.t = window.__ftueResult();
    out.reward = window.__ftueReward(c0, runs0);
    out.runs = gm.save.stats.runsPlayed;
    out.recent = gm.save.stats.recentArenaScores.length;
    return out;
  });
  for (const relaunch of [false, true]) {
    const tag = relaunch ? 'relaunch between rounds' : 'same session';
    const g = await withSave(url, null, { viewport: { width: 390, height: 844 } });
    const { page } = g;
    const left = await page.evaluate(async () => {
      const gm = window.game, out = { first: gm.isFirstRun() };
      const c0 = gm.save.coins;
      document.getElementById('btnWelcomePlay').click();
      window.__ftuePlay(8, false);
      document.getElementById('btnPause').click();
      document.getElementById('btnLeaveRun').click();
      document.getElementById('btnLeaveConfirmYes').click();
      await new Promise(r => setTimeout(r, 300));
      out.hub = __ftueVis('mainMenu') && gm.state === GameState.MENU;
      out.reward = window.__ftueReward(c0, 0);
      out.runs = gm.save.stats.runsPlayed;
      out.recent = gm.save.stats.recentArenaScores.length;
      return out;
    });
    if (relaunch) await relaunchPage(page);
    const f1 = await finishFromHub(page);
    let f2;
    if (relaunch) { await relaunchPage(page); f2 = await finishFromHub(page); }
    else {
      f2 = await page.evaluate(() => {
        const gm = window.game, c0 = gm.save.coins, runs0 = gm.save.stats.runsPlayed;
        document.getElementById('btnPlayAgain').click();
        window.__ftuePlay(20);
        return { t: window.__ftueResult(), reward: window.__ftueReward(c0, runs0), runs: gm.save.stats.runsPlayed };
      });
    }
    const schema = await page.evaluate(() => JSON.parse(localStorage.getItem('vectorHoleSave_v1')).schemaVersion);
    results.push(report(`FTUE-1C leave (${tag}): OPUŚĆ RUNDĘ on the first round -- back on Miasto, reward and runsPlayed as before (1), nothing finished`, left.first && left.hub && left.reward.ok && left.runs === 1 && left.recent === 0, JSON.stringify(left)));
    results.push(report(`FTUE-1C leave (${tag}): first FINISHED result -- no ×2 ad, share button shown, reward = CONFIG.economy`, f1.arena && f1.t.result && !f1.t.ad && f1.t.share && f1.reward.ok && f1.runs === 2 && f1.recent === 1, JSON.stringify(f1)));
    results.push(report(`FTUE-1C leave (${tag}): next finished result -- ad offered again, reward unchanged, schema 13`, f2.t.result && f2.t.ad && f2.reward.ok && f2.runs === 3 && schema === 13, JSON.stringify({ f2, schema })));
    results.push(report(`FTUE-1C leave (${tag}): no runtime errors`, g.errors.length === 0, g.errors.slice(0, 3).join(' | ')));
    await g.browser.close();
  }

  // --- 1C: a friend's challenge as the very first play -- its result hides the
  // ad (runsPlayed 1); the first regular round right after it in the same
  // session shows it (one ad-free result, not two).
  {
    const g = await withSave(url, `(() => { const s = defaultSave(); s.challenge = { seed: 424242, score: 999999, from: 'Ola', receivedAt: Date.now() }; return s; })()`, { viewport: { width: 390, height: 844 } });
    const r = await g.page.evaluate(async () => {
      const gm = window.game, out = {};
      document.getElementById('btnWelcomePlay').click();
      out.challenge = !!gm.challenge;
      window.__ftuePlay(15);
      out.t1 = window.__ftueResult();
      document.getElementById('btnMenu').click();
      await new Promise(r => setTimeout(r, 1500));
      if (__ftueVis('loginRewardScreen')) document.getElementById('btnLoginClaim').click();
      gm.showScreen('mainMenu');
      document.getElementById('btnStart').click();
      out.regular = gm.mode === 'arena' && !gm.challenge;
      window.__ftuePlay(15);
      out.t2 = window.__ftueResult();
      out.runs = gm.save.stats.runsPlayed;
      return out;
    });
    results.push(report('FTUE-1C challenge first: challenge result without the ad, then the first regular result in the same session with it', r.challenge && r.t1.result && !r.t1.ad && r.regular && r.t2.result && r.t2.ad && r.runs === 2, JSON.stringify(r)));
    results.push(report('FTUE-1C challenge first: no runtime errors', g.errors.length === 0, g.errors.slice(0, 3).join(' | ')));
    await g.browser.close();
  }

  // --- Existing saves ------------------------------------------------------------
  const today = dayKey(0), yesterday = dayKey(-1);
  const cases = [
    { id: 'after 1 round (old card seen)', o: { runs: 1, announced: ['kampania'], fresh: ['kampania'], login: { lastClaimDate: yesterday, day: 1, totalClaims: 1 } }, calendar: true, intro: false, card: 'WARSZTAT' },
    { id: 'after 2 rounds', o: { runs: 2, announced: ['kampania', 'warsztat'], login: { lastClaimDate: yesterday, day: 2, totalClaims: 2 } }, calendar: true, intro: false, card: 'WYZWANIA' },
    { id: '5 rounds, all announced, claimed today', o: { runs: 5, announced: ['kampania', 'warsztat', 'wyzwania'], login: { lastClaimDate: today, day: 3, totalClaims: 3 } }, calendar: false, intro: false, card: null },
    { id: '3 rounds, campaign never announced', o: { runs: 3, announced: ['warsztat', 'wyzwania'], login: { lastClaimDate: today, day: 1, totalClaims: 1 } }, calendar: false, intro: true, card: null },
    { id: '1 round, campaign never announced', o: { runs: 1, announced: [], login: { lastClaimDate: today, day: 1, totalClaims: 1 } }, calendar: false, intro: false, card: 'WARSZTAT' },
    { id: '4 rounds + M01 cleared, campaign never announced', o: { runs: 4, announced: ['warsztat', 'wyzwania'], completed: ['M01'], login: { lastClaimDate: today, day: 1, totalClaims: 1 } }, calendar: false, intro: false, card: null },
    // The first round was left early: the next result is the first finished one (no ad).
    { id: '1 round left early, none finished', o: { runs: 1, recent: [], announced: [], login: { lastClaimDate: today, day: 1, totalClaims: 1 } }, calendar: false, intro: false, card: 'WARSZTAT', ad: false },
    // An older save with many rounds but no finished-round history is no new player: the ad stays.
    { id: '10 rounds, no finished-round history (older save)', o: { runs: 10, recent: [], announced: ['kampania', 'warsztat', 'wyzwania'], login: { lastClaimDate: today, day: 1, totalClaims: 1 } }, calendar: false, intro: false, card: null }
  ];
  for (const c of cases) {
    const g = await withSave(url, playedSave(c.o), { viewport: { width: 390, height: 844 } });
    await g.page.waitForTimeout(1500);
    const r = await g.page.evaluate(async (want) => {
      const gm = window.game, out = { raw0: localStorage.getItem('vectorHoleSave_v1') };
      out.hub = window.__ftueHub();
      if (out.hub.login) {
        const c0 = gm.save.coins, p0 = gm.save.prisms || 0, day = gm.loginState().day, want = CONFIG.loginRewards[day];
        document.getElementById('btnLoginClaim').click();
        out.claim = gm.save.coins - c0 === (want.coins || 0) && (gm.save.prisms || 0) - p0 === (want.prisms || 0);
        gm.showScreen('mainMenu');
      }
      const c0 = gm.save.coins, runs0 = gm.save.stats.runsPlayed;
      document.getElementById('btnStart').click();
      window.__ftuePlay(12);
      out.ad = __ftueVis('btnWatchAd');
      out.reward = window.__ftueReward(c0, runs0);
      await new Promise(r => setTimeout(r, CONFIG.ftue.resultCelebrationDelayMs + 400));
      out.card = __ftueVis('unlockOverlay') ? document.getElementById('unlockTitle').textContent : null;
      if (out.card) document.getElementById('btnUnlockLater').click();
      document.getElementById('btnMenu').click();
      await new Promise(r => setTimeout(r, 1200));
      out.hub2 = window.__ftueHub();
      const before = JSON.parse(out.raw0).unlocks.announced;
      out.lost = before.filter(x => !gm.save.unlocks.announced.includes(x));
      out.dupes = gm.save.unlocks.announced.length - new Set(gm.save.unlocks.announced).size;
      out.schema = gm.save.schemaVersion;
      delete out.raw0;
      return out;
    }, c);
    results.push(report(`FTUE-1 existing save (${c.id}): calendar ${c.calendar ? 'offered once' : 'not offered'}, campaign intro ${c.intro ? 'on the tile' : 'absent'}, no popup on Miasto`, r.hub.login === c.calendar && (!c.calendar || r.claim) && r.hub.intro === c.intro && !r.hub.overlay, JSON.stringify(r.hub)));
    results.push(report(`FTUE-1 existing save (${c.id}): next result -- ad ${c.ad === false ? 'hidden' : 'shown'}, reward unchanged, card ${c.card || 'none'} (never KAMPANIA); nothing lost or doubled, schema 13`, r.ad === (c.ad !== false) && r.reward.ok && r.card === c.card && !r.hub2.login && r.hub2.intro === c.intro && r.lost.length === 0 && r.dupes === 0 && r.schema === 13, JSON.stringify(r)));
    results.push(report(`FTUE-1 existing save (${c.id}): no runtime errors`, g.errors.length === 0, g.errors.slice(0, 3).join(' | ')));
    await g.browser.close();
  }

  // --- English: the new tile copy is translated --------------------------------
  {
    const g = await withSave(url, playedSave({ runs: 3, announced: ['warsztat', 'wyzwania'], login: { lastClaimDate: today, day: 1, totalClaims: 1 } }), { viewport: { width: 390, height: 844 }, locale: 'en-US' });
    await g.page.waitForTimeout(1200);
    const r = await g.page.evaluate(() => ({
      lang: document.documentElement.lang, e: document.getElementById('hubCampaignEyebrow').textContent, t: document.getElementById('hubCampaignTitle').textContent,
      s: document.getElementById('hubCampaignSub').textContent, tag: getComputedStyle(document.getElementById('hubCampaignTile'), '::after').content
    }));
    results.push(report('FTUE-1 EN: campaign tile reads SECOND MODE / Campaign: 240 missions / 12 districts · play whenever you like / NEW', r.lang === 'en' && r.e === 'SECOND MODE' && r.t === 'Campaign: 240 missions' && r.s === '12 districts · play whenever you like' && r.tag === '"NEW"', JSON.stringify(r)));
    await g.browser.close();
  }
  return results;
}

if (process.argv[1] && process.argv[1].endsWith('ftue1.mjs')) {
  const { server, url } = await serve();
  const res = await runFtue1Checks(url);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} FTUE-1 checks passed`);
  process.exit(failed.length ? 1 : 0);
}
