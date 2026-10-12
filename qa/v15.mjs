// v15 "Wyzwanie" system checks: the tap-to-start card, mission boosters
// bought in the briefing, energy (spend, refund on a win, regen, empty
// prompt, refill), three stars, star chests, fail reasons, NELA's pity
// loan, the v11 -> v12 save migration, and the shape of all 240 missions.
// Usage: node qa/v15.mjs
import { serve, openGame, veteranSave, report, allDistrictsSave } from './lib.mjs';

async function seeded(url, mutate, opts = {}) {
  const g = await openGame(url, opts);
  const save = await veteranSave(g.page, { missions: 12, coins: 1000, runsPlayed: 6 });
  if (mutate) mutate(save);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.game.state);
  await g.page.waitForTimeout(300);
  return g;
}

export async function runV15Checks(url) {
  const results = [];
  const done = async (g, label) => {
    results.push(report(`v15: no runtime errors (${label})`, g.errors.length === 0, g.errors.slice(0, 3).join(' | ')));
    await g.browser.close();
  };

  // --- Content: 12 districts, 240 missions, every one complete ------------
  {
    const g = await openGame(url);
    const r = await g.page.evaluate(() => {
      const ms = CAMPAIGN_MISSIONS.filter(m => m.id !== 'M00');
      const ids = new Set(ms.map(m => m.id));
      const bad = ms.filter(m => !(m.diff >= 1 && m.diff <= 5) || !m.stars || m.stars.length !== 3 || !(m.timeLimit >= 30) || !m.nela.start || !m.nela.success || !m.name
        || m.stars[1].seconds >= m.timeLimit || (m.stars[2].type === 'timeUnder' && m.stars[2].seconds >= m.stars[1].seconds)).map(m => m.id);
      const named = DISTRICTS.every(d => d.name && DISTRICT_STORY[d.id] && DISTRICT_COLORS[d.id]);
      const bosses = DISTRICTS.map(d => districtLandmarkId(d));
      const signs = bosses.filter(b => b !== 'kino').every(b => LANDMARK_SIGNS[b]);
      const unlockChain = DISTRICTS.slice(1).every(d => CAMPAIGN_MISSIONS.some(m => m.reward.unlockDistrict === d.id));
      const calibrated = ms.filter(m => !MISSION_BOT_TIME[m.id]).map(m => m.id);
      const diffs = [1, 2, 3, 4, 5].map(d => ms.filter(m => m.diff === d).length);
      const twists = ['hunters', 'racer', 'dark', 'glitch', 'fragile', 'runner'].map(t => ms.filter(m => m.twists.includes(t)).length);
      const labels = ms.flatMap(m => m.goal.steps.map(s => s.label)).filter(l => !l || /undefined|NaN/.test(l));
      return { n: ms.length, unique: ids.size, districts: DISTRICTS.length, bad, named, signs, unlockChain, calibrated, diffs, twists, labels };
    });
    results.push(report('content: 12 districts, 240 missions (+ tutorial), unique ids', r.districts === 12 && r.n === 240 && r.unique === 240, `${r.districts} / ${r.n}`));
    results.push(report('content: every mission has difficulty, 3 star conditions in order, a time limit, NELA lines', r.bad.length === 0, r.bad.slice(0, 8).join(' ')));
    results.push(report('content: every step label is real Polish text', r.labels.length === 0, r.labels.slice(0, 3).join(' | ')));
    results.push(report('content: every district has a name, story and color; every boss a name plate (owner: district 2 had no name)', r.named && r.signs));
    results.push(report('content: each district is unlocked by the previous boss', r.unlockChain));
    results.push(report('content: every mission time is calibrated by the bot (MISSION_BOT_TIME)', r.calibrated.length === 0, r.calibrated.slice(0, 8).join(' ')));
    results.push(report('content: all five difficulty levels and all six twists are used', r.diffs.every(x => x > 0) && r.twists.every(x => x >= 8), `diff ${r.diffs.join('/')} · twists ${r.twists.join('/')}`));
    await done(g, 'content');
  }

  // --- Tap to start: the clock waits for the player ------------------------
  {
    const g = await seeded(url);
    await g.page.evaluate(() => { game.openMissionBriefing('M05'); document.querySelector('[data-mc-launch]').click(); });
    await g.page.waitForTimeout(900);
    const before = await g.page.evaluate(() => ({ pending: game.introPending, elapsed: game.mission.elapsed, card: !document.getElementById('missionStartOverlay').classList.contains('hidden'),
      text: document.getElementById('missionStartCard').innerText }));
    await g.page.mouse.click(200, 120);
    await g.page.waitForTimeout(700);
    const after = await g.page.evaluate(() => ({ pending: game.introPending, elapsed: game.mission.elapsed, card: !document.getElementById('missionStartOverlay').classList.contains('hidden') }));
    results.push(report('start: a mission opens frozen on the start card (clock at 0 until a tap)', before.pending && before.card && before.elapsed === 0 && /NELA/.test(before.text) && /START/.test(before.text), JSON.stringify({ ...before, text: undefined })));
    results.push(report('start: a tap anywhere starts the clock', !after.pending && !after.card && after.elapsed > 0.2, JSON.stringify(after)));
    await done(g, 'tap to start');
  }

  // --- Boosters: picked in the briefing, paid from stock or coins ---------
  {
    const g = await seeded(url, s => { s.boosters = { time: 1, start: 0, magnet: 0, shield: 0, sprint: 0, gift: true, sprintGift: true }; s.coins = 1000; });
    const r = await g.page.evaluate(() => {
      game.openMissionBriefing('M06');
      const offOnSafe = !!document.querySelector('#briefingCard .mc-boost.off') && document.querySelectorAll('#briefingCard .mc-boost').length === MISSION_BOOSTERS.length;
      game.openMissionBriefing('M26');
      const tiles = document.querySelectorAll('#briefingCard [data-booster]').length;
      game.toggleBriefingBooster('time'); game.toggleBriefingBooster('start'); game.toggleBriefingBooster('shield');
      const label = document.querySelector('[data-mc-launch]').innerText;
      const coins0 = game.save.coins;
      document.querySelector('[data-mc-launch]').click();
      const m = game.mission;
      return { tiles, offOnSafe, label, spent: coins0 - game.save.coins, stockTime: game.save.boosters.time, boosters: m.boosters, bonus: m.bonusTime, limit: m.def.timeLimit,
        remaining: Math.round(m.timeRemaining), tier: game.campaignPlayerTier().id, shields: m.shields };
    });
    const price = 70 + 70;
    results.push(report('boosters: five booster tiles in the briefing (v18 Sprint); Tarcza is off where nothing can hit you', r.tiles === 5 && r.offOnSafe, `${r.tiles} ${r.offOnSafe}`));
    results.push(report('boosters: GRAJ shows the coin cost before anything is spent', r.label.includes(`−${price}`), r.label.replace(/\s+/g, ' ')));
    results.push(report('boosters: stock is used first, the rest is paid in coins', r.stockTime === 0 && r.spent === price, JSON.stringify({ spent: r.spent, stock: r.stockTime })));
    results.push(report('boosters: Zegar +15 s, Turbo start at T2, Tarcza 2 hits', r.bonus === 15 && r.remaining === r.limit + 15 && r.tier === 'T2' && r.shields === 2, JSON.stringify(r)));
    const hit = await g.page.evaluate(() => {
      game.beginMissionPlay();
      const m = game.mission; const u0 = m.growthUnits;
      game.campaignHit('bot'); const afterShield = { units: m.growthUnits, shields: m.shields };
      game.player.invulnerableUntil = 0; game.campaignHit('bot'); game.player.invulnerableUntil = 0; game.campaignHit('bot');
      return { u0, afterShield, final: m.growthUnits, shields: m.shields };
    });
    results.push(report('boosters: Tarcza absorbs two hits, the third costs growth', hit.afterShield.units === hit.u0 && hit.afterShield.shields === 1 && hit.shields === 0 && hit.final < hit.u0, JSON.stringify(hit)));
    const poor = await g.page.evaluate(() => {
      game.leaveCampaignMission(); game.save.coins = 10; game.save.boosters.time = 0;
      game.openMissionBriefing('M06'); game.toggleBriefingBooster('start');
      const att0 = game.save.campaign.attempts.M06;
      document.querySelector('[data-mc-launch]').click();
      return { open: !document.getElementById('missionBriefing').classList.contains('hidden'), coins: game.save.coins, attempts: game.save.campaign.attempts.M06 === att0,
        note: document.querySelector('.mc-boost-note').textContent };
    });
    results.push(report('boosters: without the coins nothing starts and nothing is spent (the note says why)', poor.open && poor.coins === 10 && poor.attempts && /Brakuje/.test(poor.note), JSON.stringify(poor)));
    await done(g, 'boosters');
  }

  // --- Energy: spend, refund on a win, empty prompt, refill, regen --------
  {
    const g = await seeded(url, s => { s.energy = { value: 2, lastTick: Date.now(), infiniteUntil: 0, freeDailyDate: null }; s.prisms = 20; });
    const r = await g.page.evaluate(() => {
      const out = {};
      game.openMissionBriefing('M05'); document.querySelector('[data-mc-launch]').click();
      out.afterStart = game.save.energy.value;
      game.mission.elapsed = 5; game.endCampaignMission(true);
      out.afterWin = game.save.energy.value;
      game.openMissionBriefing('M06'); document.querySelector('[data-mc-launch]').click();
      game.endCampaignMission(false);
      out.afterLoss = game.save.energy.value;
      game.openMissionBriefing('M06'); document.querySelector('[data-mc-launch]').click(); game.endCampaignMission(false);
      out.empty = game.save.energy.value;
      game.openMissionBriefing('M06'); document.querySelector('[data-mc-launch]').click();
      out.sheet = !document.getElementById('energySheet').classList.contains('hidden');
      out.title = document.getElementById('energySheetTitle').textContent;
      out.noStart = game.mission.ended;
      const p0 = game.save.prisms;
      document.getElementById('btnEnergyRefill').click();
      out.prismsSpent = p0 - game.save.prisms;
      out.continued = !game.mission.ended && game.mission.def.id === 'M06';
      out.afterRefill = game.save.energy.value;
      game.leaveCampaignMission();
      // Regeneration: 1 point per 20 min, never above max; a clock moved back pays nothing.
      const E = CONFIG.energy;
      game.save.energy.value = 1; game.save.energy.lastTick = Date.now() - E.regenMinutes * 60000 * 2 - 1000;
      out.regen = game.energyNow();
      game.save.energy.value = 1; game.save.energy.lastTick = Date.now() + 3600000;
      out.rollback = game.energyNow();
      game.save.energy.value = 0; game.save.energy.lastTick = Date.now() - E.regenMinutes * 60000 * 50;
      out.capped = game.energyNow();
      return out;
    });
    results.push(report('energy: a mission attempt costs 1, a win gives it back', r.afterStart === 1 && r.afterWin === 2, JSON.stringify(r)));
    results.push(report('energy: a defeat keeps it spent', r.afterLoss === 1 && r.empty === 0));
    results.push(report('energy: at 0 GRAJ opens "BRAK ENERGII" instead of starting', r.sheet && r.title === 'BRAK ENERGII' && r.noStart));
    results.push(report('energy: a prism refill fills it and goes straight into the mission', r.prismsSpent === 12 && r.continued && r.afterRefill === 4, JSON.stringify({ spent: r.prismsSpent, cont: r.continued, e: r.afterRefill })));
    results.push(report('energy: regenerates 1 per 20 min up to the max; a clock set back pays nothing', r.regen === 3 && r.rollback === 1 && r.capped === 5, JSON.stringify({ regen: r.regen, rollback: r.rollback, capped: r.capped })));
    const free = await g.page.evaluate(() => {
      const out = {};
      game.save.energy.value = 0; game.save.energy.lastTick = Date.now();
      game.save.stats.runsPlayed = 0;
      out.newbieArena = game.energyFreeFor('arena');
      game.save.stats.runsPlayed = 9;
      out.vetArena = game.energyFreeFor('arena');
      out.daily = game.energyFreeFor('daily');
      game.requireEnergy('daily', () => {});
      out.dailyAgain = game.energyFreeFor('daily');
      out.tutorial = game.energyFreeFor('tutorial');
      game.closeEnergySheet();
      game.grantProduct(IAP_PRODUCTS.find(p => p.sku === 'energy_hour'));
      out.infinite = game.energyInfinite() && game.energyFreeFor('mission');
      return out;
    });
    results.push(report('energy: free plays -- tutorial, newbie rounds, the first Daily attempt of the day, the "no limit" hour', free.newbieArena && !free.vetArena && free.daily && !free.dailyAgain && free.tutorial && free.infinite, JSON.stringify(free)));
    await done(g, 'energy');
  }

  // --- Arena honors energy too ---------------------------------------------
  {
    const g = await seeded(url, s => { s.energy = { value: 1, lastTick: Date.now(), infiniteUntil: 0, freeDailyDate: null }; });
    const r = await g.page.evaluate(() => {
      game.startArenaRound(); document.getElementById('btnConfirmStart').click();
      const playing = game.state === GameState.PLAYING, e1 = game.save.energy.value;
      game.leaveRun(); game.startArenaRound();
      return { playing, e1, sheet: !document.getElementById('energySheet').classList.contains('hidden'), notPlaying: game.state !== GameState.PLAYING };
    });
    results.push(report('energy: an Arena round costs 1; with none left GRAJ opens the energy sheet', r.playing && r.e1 === 0 && r.sheet && r.notPlaying, JSON.stringify(r)));
    await done(g, 'arena energy');
  }

  // --- Stars, star chests, fail reasons, pity -----------------------------
  {
    const g = await seeded(url, s => { s.energy.infiniteUntil = 4e12; });
    const r = await g.page.evaluate(() => {
      const out = {};
      const def = campaignMissionById('M31');
      game.startCampaignMission('M31'); game.beginMissionPlay();
      game.mission.elapsed = def.timeLimit - 1; game.endCampaignMission(true);
      out.slow = game.save.campaign.stars.M31;
      out.slowShown = document.querySelectorAll('#missionResultStars .mr-star.on').length;
      game.startCampaignMission('M31'); game.beginMissionPlay();
      game.mission.elapsed = 1; game.endCampaignMission(true);
      out.fast = game.save.campaign.stars.M31;
      out.title = document.getElementById('missionResultTitle').textContent;
      out.newShown = document.querySelectorAll('#missionResultStars .mr-star.new').length;
      // star chest
      const c0 = game.save.coins, chests0 = game.save.campaign.starChests;
      for (let i = 0; i < 6; i++) game.save.campaign.stars['M' + (25 + i)] = 7;
      game.checkStarChests();
      out.chests = game.save.campaign.starChests - chests0;
      out.chestCoins = game.save.coins - c0;
      // fail reasons
      const racerMission = CAMPAIGN_MISSIONS.find(m => m.setup.racer);
      game.startCampaignMission(racerMission.id); game.beginMissionPlay();
      game.mission.racerCount = racerMission.setup.raceTarget - 1;
      const e = game.campaignEntities.find(x => game.isRaceTarget(x)); e.startEating(game.racer); e.consumed = true; e._resolved = true; game.resolveRacerEat(e);
      out.racerTitle = document.getElementById('missionResultTitle').textContent;
      const fragile = CAMPAIGN_MISSIONS.find(m => m.setup.fragile && !m.setup.hunters);
      game.startCampaignMission(fragile.id); game.beginMissionPlay(); game.campaignHit('glitch');
      out.fragileTitle = document.getElementById('missionResultTitle').textContent;
      out.fragileEnded = game.mission.ended;
      // pity: 3 defeats in a row -> one free Zegar
      const t0 = game.save.boosters.time;
      for (let i = 0; i < 3; i++) { game.startCampaignMission('M33'); game.beginMissionPlay(); game.endCampaignMission(false); }
      out.pity = game.save.boosters.time - t0;
      out.pityLine = document.getElementById('missionResultNela').textContent;
      game.startCampaignMission('M33'); game.beginMissionPlay(); game.endCampaignMission(false);
      out.pityOnce = game.save.boosters.time - t0;
      return out;
    });
    results.push(report('stars: a slow clear earns 1 star, a fast one all 3 (kept per mission)', r.slow === 1 && r.slowShown === 1 && r.fast === 7 && r.newShown === 2, JSON.stringify(r)));
    results.push(report('stars: three stars read "PERFEKCYJNIE!"', r.title === 'PERFEKCYJNIE!', r.title));
    results.push(report(`stars: every ${15} stars opens a star chest`, r.chests >= 1 && r.chestCoins >= 120, JSON.stringify({ chests: r.chests, coins: r.chestCoins })));
    results.push(report('fail: the thief winning ends the mission as "ZŁODZIEJ BYŁ SZYBSZY"', r.racerTitle === 'ZŁODZIEJ BYŁ SZYBSZY', r.racerTitle));
    results.push(report('fail: a hit on a fragile vortex ends it as "WIR ROZBITY"', r.fragileEnded && r.fragileTitle === 'WIR ROZBITY', r.fragileTitle));
    results.push(report('pity: after 3 defeats in a row NELA lends one Zegar, once per mission', r.pity === 1 && r.pityOnce === 1 && /Zegar/.test(r.pityLine), JSON.stringify({ pity: r.pity, once: r.pityOnce, line: r.pityLine })));
    await done(g, 'stars');
  }

  // --- Save migration v11 -> v12 ------------------------------------------
  {
    const g = await openGame(url);
    const r = await g.page.evaluate(() => {
      const v11 = defaultSave();
      v11.schemaVersion = 11;
      delete v11.energy; delete v11.boosters;
      delete v11.campaign.stars; delete v11.campaign.attempts; delete v11.campaign.fails; delete v11.campaign.pity; delete v11.campaign.starChests;
      DISTRICTS.slice(0, 6).flatMap(d => d.missions).forEach(id => { v11.campaign.completed[id] = true; });
      v11.campaign.unlockedDistricts = ['plac', 'park', 'port', 'galeria', 'dachy', 'rdzen'];
      v11.campaign.medals = { M01: true, M04: true };
      const s = sanitizeSave(migrateSave(JSON.parse(JSON.stringify(v11))));
      return { v: s.schemaVersion, m01: s.campaign.stars.M01, m04: s.campaign.stars.M04, m02: s.campaign.stars.M02, metro: s.campaign.unlockedDistricts.includes('metro'),
        energy: s.energy.value, chests: s.campaign.starChests, boosters: s.boosters };
    });
    results.push(report('save: v11 -> v12 keeps progress as stars (time medal -> 2nd star, special -> 3rd)', r.v === 12 && r.m01 === 3 && r.m04 === 5 && r.m02 === 1, JSON.stringify(r)));
    results.push(report('save: a save past the finale gets Rozdział II, full energy, no chest burst', r.metro && r.energy === 5 && r.chests > 0, JSON.stringify({ metro: r.metro, energy: r.energy, chests: r.chests })));
    await done(g, 'migration');
  }

  // --- Layout: briefing with boosters on a small phone ---------------------
  for (const vp of [{ width: 375, height: 667 }, { width: 402, height: 874 }]) {
    const g = await seeded(url, s => { s.boosters.gift = true; }, { viewport: vp });
    const r = await g.page.evaluate(() => {
      ['M06', 'M07', 'M31', 'M32', 'M33'].forEach(id => { game.save.campaign.completed[id] = true; });
      game.openMissionBriefing('M34');
      const sheet = document.querySelector('#missionBriefing .briefing-sheet');
      const btn = document.querySelector('[data-mc-launch]');
      btn.scrollIntoView({ block: 'nearest' });
      const b = btn.getBoundingClientRect();
      return { inView: b.bottom <= window.innerHeight && b.top >= 0, scrollable: sheet.scrollHeight > sheet.clientHeight, h: Math.round(b.bottom), H: window.innerHeight };
    });
    results.push(report(`layout ${vp.width}x${vp.height}: briefing GRAJ is reachable inside the sheet (boosters + hints)`, r.inView, JSON.stringify(r)));
    await done(g, `layout ${vp.width}`);
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const res = await runV15Checks(url);
  server.close();
  console.log(`\n${res.filter(r => r.ok).length}/${res.length} v15 checks passed`);
  process.exit(res.every(r => r.ok) ? 0 : 1);
}
