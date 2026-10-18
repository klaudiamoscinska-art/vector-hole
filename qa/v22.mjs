// v22 „Dwa tryby”: what round 1 of the commercial pass changed.
//  - The energy limit is gone: no chip, no sheet, no cost, no timer; Arena
//    rounds, Daily rounds and mission attempts start back-to-back without
//    limit; nothing in the store or the ad placements sells energy.
//  - Arena and Dzielnice are independent modes: a fresh save opens on an
//    Arena round (no tutorial); campaign progress changes nothing in Arena
//    (object pool, difficulty, unlocks, perks) and Arena progress changes
//    nothing in the campaign (mission limits, start size, boosters);
//    progress in either order ends in the same unlocks; each mode pays for
//    what it sells (bots: campaign-only coins buy a booster, Arena-only
//    coins buy a Warsztat item).
//  - The first round coaches only a player who hesitates (steering, eating,
//    a smaller rival, being swallowed) and never repeats a learned skill.
//  - Saves: v12 -> v13 drops energy / discovered types / M00 and keeps all
//    progress; Wyzwania opened by the old M03 gate stays open; reloads keep
//    everything.
//  - Prisms: a mission booster for prisms when short on coins, prism-only
//    Efekt pochłaniania / Finisz looks.
// Usage: node qa/v22.mjs
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, expectAll, is, truthy, falsy, matches, notMatches, ARENA_BOT, CAMPAIGN_BOT, ROOT, readRuntimeSources } from './lib.mjs';

/** Opens the game on `save` (an object, or a function building one from defaultSave()). */
async function withSave(url, build, opts = {}) {
  const g = await openGame(url, opts);
  const save = typeof build === 'function' ? await g.page.evaluate(build) : build;
  if (save) {
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.game.state);
  }
  await g.page.addScriptTag({ content: ARENA_BOT });
  await g.page.addScriptTag({ content: CAMPAIGN_BOT });
  await g.page.waitForTimeout(250);
  return g;
}

/** A save with only campaign progress (no Arena round ever finished). */
const campaignOnly = () => {
  const s = defaultSave();
  DISTRICTS.slice(0, 3).flatMap(d => d.missions).forEach(id => { s.campaign.completed[id] = true; s.campaign.stars[id] = 1; });
  s.campaign.unlockedDistricts = ['plac', 'park', 'port', 'galeria'];
  s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
  s.login.lastClaimDate = new Date().toISOString().slice(0, 10);
  return s;
};
/** A save with only Arena progress (no mission ever cleared). */
const arenaOnly = () => {
  const s = defaultSave();
  s.stats.runsPlayed = 30; s.stats.recentArenaScores = [9000, 9500, 10000, 11000, 12000]; s.stats.bestArenaScore = 15000;
  s.hub.coreLevel = 5; s.hub.coreCharge = 40; s.coins = 3000; s.prisms = 30;
  s.coach = { moved: true, ate: true, rival: true, danger: true };
  s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
  s.login.lastClaimDate = new Date().toISOString().slice(0, 10);
  return s;
};

export async function runV22Checks(url) {
  const results = [];
  const done = async (g, label) => {
    results.push(report(`v22: no runtime errors (${label})`, g.errors.length === 0, g.errors.slice(0, 3).join(' | ')));
    await g.browser.close();
  };

  // --- No energy anywhere: source, DOM, store, ads ---------------------------
  {
    // E1: every runtime file index.html loads (game.js today, ES modules
    // later -- readRuntimeSources()). Left out, in whichever file holds
    // them: migrateSave() .. loadSave() (may still name what it deletes
    // from old saves) and the I18N_EN dictionary (translates old copy).
    const src = readRuntimeSources();
    const cut = { migrate: 0, i18n: 0 };
    const code = src.js.map(f => {
      let t = f.text;
      const a = t.indexOf('function migrateSave('), b = t.indexOf('function loadSave(');
      if (a >= 0 && b > a) { t = t.slice(0, a) + t.slice(b); cut.migrate++; }
      const e = t.indexOf('const I18N_EN = {');
      if (e >= 0) { const end = t.indexOf('\n};', e); t = t.slice(0, e) + (end >= 0 ? t.slice(end + 3) : ''); cut.i18n++; }
      return t;
    }).join('\n');
    // A scan that lost its markers or part of the game would pass on
    // nothing: both cuts happen exactly once, and the scanned code still
    // holds both modes, the save, the audio, the ads and the dev panel.
    const missing = ['class SoundEngine', 'startRound(', 'startCampaignMission(', 'function loadSave(', 'class Monetization', 'class DevPanel'].filter(k => !code.includes(k));
    const scanOk = cut.migrate === 1 && cut.i18n === 1 && missing.length === 0 && src.missing.length === 0;
    const scanNote = scanOk ? [] : [`scan broken ${JSON.stringify({ files: src.js.map(f => f.path), notOnDisk: src.missing, cut, missing })}`];
    const html = src.html.text;
    const css = src.cssText;
    const leftovers = [
      ...(code.match(/requireEnergy|energySheet|energyNow|energyFreeFor|CONFIG\.energy|save\.energy|energy_ad|energy_hour|infiniteEnergy|sound\.energy|no-energy/g) || []),
      ...(html.match(/energy|BRAK ENERGII|1 energię/gi) || []),
      ...(css.match(/energy/gi) || [])
    ];
    results.push(report('energy: nothing left in game.js / index.html / style.css (logic, sheet, chip, costs, timer, IAP, ad)', leftovers.length === 0 && scanOk, [...scanNote, ...leftovers.slice(0, 6)].join(', ')));
    const tut = [...(code.match(/tutorialChecklist|dismissTutorialIntro|showTutorialIntro|updateTutorialGuidance|'M00'|discoveredTypes|discoveredHoleEating|isArenaUnlocked/g) || []), ...(html.match(/tutorialIntro|btnStartTutorial/g) || [])];
    results.push(report('tutorial: the M00 mission, its coach card and Arena\'s campaign discovery gate are gone', tut.length === 0 && scanOk, [...scanNote, ...tut.slice(0, 6)].join(', ')));
  }

  // --- Unlimited play, back to back -------------------------------------------
  {
    const g = await withSave(url, () => { const s = defaultSave(); s.stats.runsPlayed = 12; s.coins = 0; s.prisms = 0; s.campaign.completed = { M01: true, M02: true, M03: true }; s.privacy.decided = true; s.coach = { moved: true, ate: true, rival: true, danger: true }; s.login.lastClaimDate = new Date().toISOString().slice(0, 10); return s; });
    const r = await g.page.evaluate(async () => {
      const gm = window.game, out = { arena: 0, daily: 0, missions: 0, chips: document.querySelectorAll('.energy-chip, #energySheet').length };
      const finishRound = () => { cancelAnimationFrame(gm.rafId); gm.running = false; gm.timeRemaining = 0.001; gm.update(0.016); };
      for (let i = 0; i < 15; i++) {
        gm.showScreen('mainMenu');
        document.getElementById('btnStart').click();
        // PX02 D+: GRAJ starts the round itself (no run-tool screen to confirm).
        const setup = document.getElementById('runSetupScreen');
        if (setup && !setup.classList.contains('hidden')) document.getElementById('btnConfirmStart').click();
        if (gm.state === GameState.PLAYING && gm.mode === 'arena') out.arena++;
        finishRound();
      }
      for (let i = 0; i < 6; i++) {
        gm.startDailyChallenge();
        if (gm.state === GameState.PLAYING && gm.isDailyRun) out.daily++;
        finishRound();
      }
      for (let i = 0; i < 15; i++) {
        gm.openMissionBriefing('M25');
        document.querySelector('#briefingCard [data-mc-launch]').click();
        if (gm.mission && !gm.mission.ended && gm.mission.def.id === 'M25') out.missions++;
        gm.beginMissionPlay(); cancelAnimationFrame(gm.rafId); gm.running = false;
        gm.endCampaignMission(false);
        await new Promise(res => setTimeout(res, 5));
      }
      out.coins = gm.save.coins; out.prisms = gm.save.prisms;
      out.store = IAP_PRODUCTS.map(p => p.sku).filter(s => /energy|hour/.test(s));
      out.ads = Object.keys(AD_PLACEMENTS).filter(k => /energy/.test(k));
      out.saveKey = 'energy' in gm.save;
      return out;
    });
    results.push(report('unlimited: 15 Arena rounds in a row from GRAJ, no wait, with 0 coins / 0 prisms', r.arena === 15, JSON.stringify(r)));
    results.push(report('unlimited: 6 Daily rounds on the same day all start', r.daily === 6));
    results.push(report('unlimited: 15 lost mission attempts in a row all start from the briefing GRAJ', r.missions === 15));
    results.push(report('unlimited: no energy chip/sheet in the DOM, no energy in the save, store or ad placements', r.chips === 0 && !r.saveKey && r.store.length === 0 && r.ads.length === 0, JSON.stringify({ chips: r.chips, store: r.store, ads: r.ads, save: r.saveKey })));
    await done(g, 'unlimited');
  }

  // --- First launch: an Arena round, nothing locked behind the campaign ------
  {
    const g = await withSave(url, null, { viewport: { width: 375, height: 667 } });
    const r = await g.page.evaluate(async () => {
      const gm = window.game, out = {};
      out.first = gm.isFirstRun();
      out.welcome = !document.getElementById('hubWelcome').classList.contains('hidden');
      document.getElementById('btnWelcomePlay').click();
      out.mode = gm.mode; out.playing = gm.state === GameState.PLAYING; out.setup = !!document.getElementById('runSetupScreen') && !document.getElementById('runSetupScreen').classList.contains('hidden');
      out.types = [...new Set(gm.objects.map(o => o.tier))].sort();
      cancelAnimationFrame(gm.rafId); gm.running = false; gm.timeRemaining = 0.001; gm.update(0.016);
      await new Promise(res => setTimeout(res, 900));
      out.kampaniaIntro = !document.getElementById('unlockOverlay').classList.contains('hidden') && document.getElementById('unlockTitle').textContent;
      document.getElementById('btnUnlockGo').click();
      await new Promise(res => setTimeout(res, 100));
      out.onCampaign = !document.getElementById('campaignScreen').classList.contains('hidden');
      out.m01 = gm.isMissionPlayable('M01') && gm.nextCampaignMissionId() === 'M01';
      out.navShown = !document.getElementById('bottomNav').classList.contains('hidden');
      gm.showScreen('mainMenu');
      out.firstAfter = gm.isFirstRun();
      out.dzNew = document.getElementById('btnNavDzielnice').classList.contains('is-new');
      return out;
    });
    results.push(report('first launch: welcome card, GRAJ = an Arena round at once (no tutorial, no setup screen)', r.first && r.welcome && r.mode === 'arena' && r.playing && !r.setup, JSON.stringify(r)));
    results.push(report('first launch: the first Arena round already has the whole bestiary (T1-T6, nothing learned in missions needed)', ['fragment', 'capsule', 'prop', 'vehicle', 'landmark', 'structure', 'heavy', 'tower'].every(t => r.types.includes(t)), r.types.join(',')));
    results.push(report('first launch: after the round the campaign introduces itself once ("KAMPANIA" → Dzielnice), M01 playable', r.kampaniaIntro === 'KAMPANIA' && r.onCampaign && r.m01 && r.navShown && !r.firstAfter, JSON.stringify(r)));
    await done(g, 'first launch');
  }

  // --- Campaign progress never touches Arena ---------------------------------
  {
    const fresh = await withSave(url, () => { const s = defaultSave(); s.privacy.decided = true; return s; });
    const camp = await withSave(url, campaignOnly);
    const probe = async (g) => g.page.evaluate(() => {
      const gm = window.game;
      gm.startRound({ seed: 4242 });
      cancelAnimationFrame(gm.rafId); gm.running = false;
      const out = {
        objects: gm.objects.map(o => `${o.tier}:${Math.round(o.x)}:${Math.round(o.y)}`).join('|').length + ':' + gm.objects.length,
        tiers: [...new Set(gm.objects.map(o => o.tier))].length,
        t: gm.difficultyT, bots: gm.bots.map(b => Math.round(b.radius)).join(','), start: Math.round(gm.player.radius) + '/' + Math.round(gm.player.getSpeed()),
        core: gm.save.hub.coreLevel + ':' + gm.save.hub.coreCharge,
        vehicleAt18: canEatWorldObjectTier(18, { tier: 'vehicle' }), vehicleAt46: canEatWorldObjectTier(46, { tier: 'vehicle' }),
        wyz: gm.isWyzwaniaUnlocked()
      };
      gm.leaveRun();
      return out;
    });
    const a = await probe(fresh), b = await probe(camp);
    const coreAfter = await camp.page.evaluate(() => { const gm = window.game; const c0 = gm.save.hub.coreLevel + ':' + gm.save.hub.coreCharge; gm.startCampaignMission('M31'); gm.beginMissionPlay(); cancelAnimationFrame(gm.rafId); gm.running = false; gm.mission.elapsed = 5; gm.endCampaignMission(true); return { c0, c1: gm.save.hub.coreLevel + ':' + gm.save.hub.coreCharge }; });
    // PX02 D+: no vortex has a perk; the trophy starts like the starter vortex (size, speed).
    const aurora = await camp.page.evaluate(() => {
      const gm = window.game;
      const start = (id) => { gm.save.selected = id; gm.startRound({ seed: 1 }); cancelAnimationFrame(gm.rafId); gm.running = false; const r = gm.player.radius + '/' + gm.player.getSpeed(); gm.leaveRun(); return r; };
      gm.save.owned.push('aurora');
      const base = start('rainbow'), trophy = start('aurora');
      return base === trophy ? 0 : 1;
    });
    results.push(report('independence: 30 missions done change nothing in an Arena round (same map, rivals, difficulty)', a.objects === b.objects && a.bots === b.bots && a.t === b.t && a.tiers === b.tiers, JSON.stringify({ fresh: a, campaign: b })));
    results.push(report('independence: Arena size gates (Tx) come from the hole size only', a.vehicleAt18 === false && a.vehicleAt46 === true && b.vehicleAt18 === false && b.vehicleAt46 === true));
    results.push(report('independence: a mission win never charges Core City; Wyzwania wait for Arena rounds, not missions', coreAfter.c0 === coreAfter.c1 && !b.wyz, JSON.stringify(coreAfter)));
    results.push(report('independence: the campaign\'s trophy skin (Aurora) gives no Arena perk', aurora === 0, `${aurora} perks`));
    await done(fresh, 'arena probe fresh');
    await done(camp, 'arena probe campaign');
  }

  // --- Arena progress never touches the campaign ------------------------------
  {
    const fresh = await withSave(url, () => { const s = defaultSave(); s.privacy.decided = true; s.stats.runsPlayed = 1; return s; });
    const arena = await withSave(url, arenaOnly);
    const probe = async (g) => g.page.evaluate(() => {
      const gm = window.game;
      const out = { next: gm.nextCampaignMissionId(), playable: gm.isMissionPlayable('M01'), boosters: gm.boostersUnlocked(), districts: gm.save.campaign.unlockedDistricts.join(',') };
      gm.startCampaignMission('M01'); gm.beginMissionPlay(); cancelAnimationFrame(gm.rafId); gm.running = false;
      out.limit = gm.mission.def.timeLimit; out.radius = Math.round(gm.player.radius); out.tier = gm.campaignPlayerTier().id; out.entities = gm.campaignEntities.length; out.speedMult = gm.player.perkSpeedMult || 1;
      gm.leaveCampaignMission();
      return out;
    });
    const a = await probe(fresh), b = await probe(arena);
    results.push(report('independence: 30 Arena rounds + Core City LVL5 change nothing in a mission (limit, start size, tier, board, no perks)', JSON.stringify({ ...a }) === JSON.stringify({ ...b }), JSON.stringify({ fresh: a, arena: b })));
    results.push(report('independence: an Arena-only player starts the campaign at M01 with Plac open; boosters stay a campaign unlock', b.next === 'M01' && b.playable && !b.boosters && b.districts === 'plac', JSON.stringify(b)));
    await done(fresh, 'campaign probe fresh');
    await done(arena, 'campaign probe arena');
  }

  // --- Either order, same unlocks ----------------------------------------------
  {
    const g = await withSave(url, null);
    const r = await g.page.evaluate(() => {
      const gates = s => Object.fromEntries(Object.keys(FEATURE_GATES).map(k => [k, FEATURE_GATES[k](s)]));
      const steps = {
        arena: s => { s.stats.runsPlayed += 1; },
        mission: (s, id) => { s.campaign.completed[id] = true; }
      };
      const A = defaultSave(), B = defaultSave();
      const trace = { arenaFirst: [], campaignFirst: [] };
      for (let i = 0; i < 3; i++) { steps.arena(A); trace.arenaFirst.push(gates(A)); }
      ['M01', 'M02', 'M03', 'M25', 'M26', 'M27', 'M28', 'M29', 'M30', 'M04'].forEach(id => steps.mission(A, id));
      ['M01', 'M02', 'M03', 'M25', 'M26', 'M27', 'M28', 'M29', 'M30', 'M04'].forEach(id => { steps.mission(B, id); trace.campaignFirst.push(gates(B)); });
      for (let i = 0; i < 3; i++) steps.arena(B);
      return { a: gates(A), b: gates(B), afterArenaOnly: trace.arenaFirst[2], afterCampaignOnly: trace.campaignFirst[trace.campaignFirst.length - 1], warsztatAfterM02: trace.campaignFirst[1].warsztat, warsztatAfter2Runs: trace.arenaFirst[1].warsztat };
    });
    results.push(report('order: Arena first or campaign first ends in the same unlocks', JSON.stringify(r.a) === JSON.stringify(r.b) && r.a.warsztat && r.a.wyzwania && r.a.boosters, JSON.stringify(r)));
    results.push(report('order: Arena alone opens Warsztat + Wyzwania, never boosters; the campaign alone opens Warsztat + boosters, never Wyzwania', r.afterArenaOnly.warsztat && r.afterArenaOnly.wyzwania && !r.afterArenaOnly.boosters && r.afterCampaignOnly.warsztat && r.afterCampaignOnly.boosters && !r.afterCampaignOnly.wyzwania && r.warsztatAfterM02 && r.warsztatAfter2Runs, JSON.stringify(r)));
    const hub = await g.page.evaluate(() => {
      const gm = window.game; gm.save.stats.runsPlayed = 1; gm.showScreen('mainMenu'); gm.updateHubQuickTiles();
      const t1 = document.getElementById('hubDailySub').textContent;
      gm.save.stats.runsPlayed = 2; gm.updateHubQuickTiles();
      const t2 = document.getElementById('hubDailySub').textContent;
      gm.openLockedTabInfo('wyzwania');
      const sheet = document.getElementById('infoSheetBody').textContent, action = document.getElementById('btnInfoSheetAction').textContent;
      gm.closeInfoSheet();
      return { t1, t2, sheet, action };
    });
    results.push(report('order: a locked Wyzwania tile/tab counts down Arena rounds and offers a round (no mission named)', /2 rundy Areny/.test(hub.t1) && /1 rundę Areny/.test(hub.t2) && /1 rundę Areny/.test(hub.sheet) && !/M\d\d/.test(hub.sheet) && hub.action === 'ZAGRAJ RUNDĘ', JSON.stringify(hub)));
    await done(g, 'order');
  }

  // --- Each mode pays for what it sells (bots) ----------------------------------
  {
    const g = await withSave(url, () => { const s = defaultSave(); s.privacy.decided = true; s.stats.runsPlayed = 1; s.coach = { moved: true, ate: true, rival: true, danger: true }; return s; });
    const camp = await g.page.evaluate(() => {
      const gm = window.game, c0 = gm.save.coins, p0 = gm.save.prisms;
      const ids = DISTRICTS[0].missions.slice(0, 6);
      const res = ids.map(id => window.__qaPlayMission(id, { style: 'expert' }));
      return { won: res.filter(x => x.success).length, coins: gm.save.coins - c0, prisms: gm.save.prisms - p0, booster: Math.min(...MISSION_BOOSTERS.map(b => b.price)) };
    });
    results.push(report('economy: campaign-only coins (6 Plac missions, expert bot) buy a mission booster — no Arena needed', camp.coins >= camp.booster, JSON.stringify(camp)));
    await done(g, 'economy campaign');
    const h = await withSave(url, () => { const s = defaultSave(); s.privacy.decided = true; s.coach = { moved: true, ate: true, rival: true, danger: true }; return s; });
    const ar = await h.page.evaluate(() => {
      const gm = window.game, c0 = gm.save.coins;
      for (let i = 0; i < 3; i++) window.__qaPlayArena({ style: 'casual' });
      const cheapest = Math.min(...SKINS.filter(s => s.price > 0).map(s => s.price));
      return { coins: gm.save.coins - c0, cheapest, warsztat: gm.isWarsztatUnlocked() };
    });
    results.push(report('economy: Arena-only coins (3 casual rounds) buy the first Warsztat item, and Warsztat is open — no mission needed', ar.coins >= ar.cheapest && ar.warsztat, JSON.stringify(ar)));
    await done(h, 'economy arena');
  }

  // --- First-round coaching ---------------------------------------------------------
  {
    const freshCoach = () => { const s = defaultSave(); s.privacy.decided = true; return s; };
    const g = await withSave(url, freshCoach);
    const afk = await g.page.evaluate(() => {
      const gm = window.game, seen = [];
      const orig = gm.showCoachHint.bind(gm);
      gm.showCoachHint = (k, ...a) => { seen.push(k); return orig(k, ...a); };
      const realNow = performance.now.bind(performance); let v = realNow(); performance.now = () => v;
      gm.startArenaRound(); cancelAnimationFrame(gm.rafId); gm.running = false;
      let at = null;
      for (let f = 0; f < 30 * 6; f++) { v += 33.3; gm.keyDir = { x: 0, y: 0 }; gm.update(1 / 30); if (at == null && seen.includes('moved')) at = +(f / 30).toFixed(2); }
      const text = document.getElementById('mobile-hint').textContent, visible = !document.getElementById('mobile-hint').classList.contains('hidden');
      // Now steer: the hint goes, the skill is learned, and it never comes back.
      for (let f = 0; f < 30 * 3; f++) { v += 33.3; gm.keyDir = { x: 1, y: 0 }; gm.update(1 / 30); }
      const gone = document.getElementById('mobile-hint').classList.contains('hidden');
      performance.now = realNow;
      gm.showCoachHint = orig;
      gm.leaveRun();
      return { at, text, visible, gone, learned: gm.save.coach.moved, seen };
    });
    results.push(report('coach: a player who does not steer gets the steering hint after ~1.6 s, it stays until they steer', afk.at != null && afk.at >= 1.4 && afk.at <= 2.2 && afk.visible && /Przeciągnij palcem/.test(afk.text) && afk.gone && afk.learned, JSON.stringify(afk)));
    await g.page.reload(); await g.page.waitForFunction(() => window.game && window.game.state);
    const again = await g.page.evaluate(() => {
      const gm = window.game, seen = [];
      const orig = gm.showCoachHint.bind(gm); gm.showCoachHint = (k, ...a) => { seen.push(k); return orig(k, ...a); };
      gm.startArenaRound(); cancelAnimationFrame(gm.rafId); gm.running = false;
      for (let f = 0; f < 30 * 4; f++) gm.update(1 / 30);
      gm.leaveRun();
      return { seen, moved: gm.save.coach.moved };
    });
    results.push(report('coach: a learned skill survives a reload and its hint never comes back', again.moved && !again.seen.includes('moved'), JSON.stringify(again)));
    // Steering, but nothing to eat in reach -> what to eat.
    const eat = await g.page.evaluate(() => {
      const gm = window.game, seen = [];
      const orig = gm.showCoachHint.bind(gm); gm.showCoachHint = (k, ...a) => { seen.push(k); return orig(k, ...a); };
      gm.startArenaRound(); cancelAnimationFrame(gm.rafId); gm.running = false;
      gm.objects = gm.objects.filter(o => Math.hypot(o.x - gm.player.x, o.y - gm.player.y) > 2500);
      for (let f = 0; f < 30 * 6; f++) { gm.keyDir = { x: Math.cos(f / 25), y: Math.sin(f / 25) }; gm.update(1 / 30); }
      gm.leaveRun();
      return { seen };
    });
    results.push(report('coach: steering without a single bite for 4 s brings the "eat the glowing fragments" hint', eat.seen.includes('eat'), JSON.stringify(eat)));
    // Swallowed by a bigger rival -> the danger rule, once.
    const danger = await g.page.evaluate(() => {
      const gm = window.game, seen = [];
      const orig = gm.showCoachHint.bind(gm); gm.showCoachHint = (k, ...a) => { seen.push(k); return orig(k, ...a); };
      const realNow = performance.now.bind(performance); let v = realNow() + 10000; performance.now = () => v;
      gm.startArenaRound(); cancelAnimationFrame(gm.rafId); gm.running = false;
      const eatMe = () => { const b = gm.bots[1]; b.radius = 120; b.x = gm.player.x; b.y = gm.player.y; gm.player.invulnerableUntil = 0; gm.player.spawnShieldUntil = 0; v += 5000; gm.handleHoleCollisions(); };
      eatMe(); eatMe();
      performance.now = realNow;
      gm.leaveRun();
      return { seen: seen.filter(k => k === 'danger').length, learned: gm.save.coach.danger };
    });
    results.push(report('coach: being swallowed explains bigger rivals once, never twice', danger.seen === 1 && danger.learned, JSON.stringify(danger)));
    await done(g, 'coach');
    // A player who just plays gets no steering/eating lecture.
    const h = await withSave(url, freshCoach);
    const greedy = await h.page.evaluate(() => {
      const gm = window.game, seen = [];
      const orig = gm.showCoachHint.bind(gm); gm.showCoachHint = (k, ...a) => { seen.push(k); return orig(k, ...a); };
      const res = window.__qaPlayArena({ style: 'casual' });
      return { seen, coach: gm.save.coach, place: res.place };
    });
    results.push(report('coach: a player who steers and eats from the first second sees no steering/eating hint, and both skills are learned', !greedy.seen.includes('moved') && !greedy.seen.includes('eat') && greedy.coach.moved && greedy.coach.ate, JSON.stringify(greedy)));
    await done(h, 'coach (player who just plays)');
    // English.
    const en = await withSave(url, freshCoach, { locale: 'en-US', query: '?i18n=log' });
    const e = await en.page.evaluate(async () => {
      const gm = window.game;
      gm.startArenaRound(); cancelAnimationFrame(gm.rafId); gm.running = false;
      const texts = [];
      for (let f = 0; f < 30 * 3; f++) gm.update(1 / 30);
      await new Promise(r => setTimeout(r, 30)); texts.push(document.getElementById('mobile-hint').textContent);
      gm.coachOnPlayerEaten(); await new Promise(r => setTimeout(r, 30)); texts.push(document.getElementById('mobile-hint').textContent);
      gm.coachState.key = null; gm.save.coach.ate = false; gm.coachState.steerT = 0; gm.coachState.bites = 0; gm.coachState.t = 10; gm.updateArenaCoach(0); await new Promise(r => setTimeout(r, 30)); texts.push(document.getElementById('mobile-hint').textContent);
      gm.showCoachHint('rival', 'Ten rywal jest mniejszy od Ciebie — najedź na niego i go pochłoń!', 'target'); await new Promise(r => setTimeout(r, 30)); texts.push(document.getElementById('mobile-hint').textContent);
      gm.leaveRun();
      gm.save.stats.runsPlayed = 0; gm.save.campaign.completed = {}; gm.save.unlocks.announced = [];
      gm.openLockedTabInfo('warsztat'); await new Promise(r => setTimeout(r, 30)); texts.push(document.getElementById('infoSheetBody').textContent); gm.closeInfoSheet();
      return { texts, misses: [...I18N.misses] };
    });
    // ("15 PAŹDZIERNIKA" is the Daily date label -- a known v19 miss, not v22.)
    const misses = e.misses.filter(m => !/^\d+ [A-ZĄĆĘŁŃÓŚŹŻ]+$/.test(m));
    results.push(report('coach + locked tabs: English, nothing Polish on screen', misses.length === 0 && e.texts.every(t => t && !/[ąćęłńóśźż]/i.test(t)), JSON.stringify(e)));
    await done(en, 'english');
  }

  // --- Saves: v12 -> v13, reload, idempotent -----------------------------------------
  {
    const build = () => {
      const s = defaultSave();
      s.schemaVersion = 12;
      delete s.coach;
      s.energy = { value: 2, lastTick: Date.now() - 60000, infiniteUntil: 0, freeDailyDate: null };
      s.campaign.discoveredTypes = ['fragment', 'prop', 'vehicle'];
      s.campaign.discoveredHoleEating = true;
      ['M00', 'M01', 'M02', 'M03'].forEach(id => { s.campaign.completed[id] = true; s.campaign.stars[id] = 3; });
      s.campaign.attempts = { M00: 1, M01: 2 }; s.campaign.fails = { M00: 0 }; s.campaign.medals = { M00: true };
      s.unlocks.announced = ['arena', 'warsztat', 'wyzwania']; s.unlocks.fresh = ['arena'];
      s.coins = 777; s.prisms = 42; s.stats.runsPlayed = 0; s.hub.coreLevel = 3;
      s.privacy.decided = true;
      return s;
    };
    const g = await withSave(url, build);
    const r = await g.page.evaluate(() => {
      const gm = window.game, s = gm.save, c = s.campaign;
      const anyM00 = ['completed', 'stars', 'attempts', 'fails', 'medals', 'pity'].some(k => 'M00' in (c[k] || {}));
      return { v: s.schemaVersion, energy: 'energy' in s, disc: 'discoveredTypes' in c || 'discoveredHoleEating' in c, anyM00, done: Object.keys(c.completed).sort().join(','), stars: c.stars.M02,
        coins: s.coins, prisms: s.prisms, core: s.hub.coreLevel, announced: s.unlocks.announced.join(','), fresh: s.unlocks.fresh.join(','), coach: s.coach, next: gm.nextCampaignMissionId(),
        first: gm.isFirstRun(), wyz: gm.isWyzwaniaUnlocked(), warsztat: gm.isWarsztatUnlocked() };
    });
    // E1 pilot: expectAll() names each failed field (same terms as the old && chains).
    results.push(expectAll('save v12 -> v13: energy, discovered types and the M00 tutorial are gone; missions, stars, coins, prisms, Core City kept', {
      schemaVersion: is(r.v, 13), energy: falsy(r.energy), discoveredTypes: falsy(r.disc), M00: falsy(r.anyM00),
      completed: is(r.done, 'M01,M02,M03'), stars: is(r.stars, 3), coins: is(r.coins, 777), prisms: is(r.prisms, 42), coreLevel: is(r.core, 3)
    }, JSON.stringify(r)));
    results.push(expectAll('save v12 -> v13: Wyzwania opened by the old M03 gate stay open; no "arena" unlock left; known player gets no hints / no second-mode intro', {
      wyzwania: truthy(r.wyz), warsztat: truthy(r.warsztat), noArenaUnlock: notMatches(/\barena\b/, r.announced + r.fresh), kampaniaAnnounced: matches(/kampania/, r.announced),
      coachMoved: truthy(r.coach.moved), coachAte: truthy(r.coach.ate), nextMission: is(r.next, 'M25'), firstRun: falsy(r.first)
    }, JSON.stringify(r)));
    await g.page.reload(); await g.page.waitForFunction(() => window.game && window.game.state);
    const again = await g.page.evaluate(() => { const s = window.game.save; return { v: s.schemaVersion, done: Object.keys(s.campaign.completed).sort().join(','), coins: s.coins, energy: 'energy' in s, wyz: window.game.isWyzwaniaUnlocked() }; });
    results.push(expectAll('save: a reload after migrating keeps everything (idempotent)', {
      schemaVersion: is(again.v, 13), completed: is(again.done, 'M01,M02,M03'), coins: is(again.coins, 777), energy: falsy(again.energy), wyzwania: truthy(again.wyz)
    }, JSON.stringify(again)));
    await done(g, 'migration');
    // Only the old tutorial done: back to the welcome card (Arena first).
    const t = await withSave(url, () => { const s = defaultSave(); s.schemaVersion = 12; delete s.coach; s.energy = { value: 5, lastTick: 0, infiniteUntil: 0, freeDailyDate: null }; s.campaign.completed.M00 = true; s.unlocks.announced = ['arena']; s.privacy.decided = true; return s; });
    const tt = await t.page.evaluate(() => ({ first: window.game.isFirstRun(), welcome: !document.getElementById('hubWelcome').classList.contains('hidden'), coach: window.game.save.coach, next: window.game.nextCampaignMissionId() }));
    results.push(report('save: a v12 save with only the old tutorial done opens on the welcome card (first play = Arena), campaign at M01', tt.first && tt.welcome && !tt.coach.moved && tt.next === 'M01', JSON.stringify(tt)));
    await done(t, 'migration (tutorial only)');
  }

  // --- Prisms after energy -------------------------------------------------------------
  {
    const g = await withSave(url, () => { const s = defaultSave(); s.privacy.decided = true; ['M01', 'M02', 'M03', 'M25', 'M26', 'M27', 'M28', 'M29', 'M30', 'M04'].forEach(id => { s.campaign.completed[id] = true; }); s.campaign.unlockedDistricts = ['plac', 'park']; s.boosters.gift = true; s.boosters.sprintGift = true; s.coins = 10; s.prisms = 9; return s; });
    const r = await g.page.evaluate(() => {
      const gm = window.game, out = {};
      gm.openMissionBriefing('M05'); gm.toggleBriefingBooster('time');
      const btn = document.querySelector('[data-booster-prisms]');
      out.offer = btn && btn.textContent;
      const p0 = gm.save.prisms;
      btn.click();
      out.spent = p0 - gm.save.prisms; out.stock = gm.save.boosters.time;
      out.selected = !!document.querySelector('[data-booster="time"].selected');
      const c0 = gm.save.coins;
      document.querySelector('[data-mc-launch]').click();
      out.started = gm.mission && gm.mission.def.id === 'M05' && gm.mission.boosters.includes('time');
      out.coinsSpent = c0 - gm.save.coins; out.stockAfter = gm.save.boosters.time;
      gm.leaveCampaignMission();
      gm.save.prisms = 3;
      gm.openMissionBriefing('M05'); gm.toggleBriefingBooster('time');
      out.noOfferWhenPoor = !document.querySelector('[data-booster-prisms]');
      gm.closeMissionBriefing();
      // Prism looks in the two categories that had nothing to buy.
      out.looks = [...EAT_EFFECTS, ...OVERDRIVE_SKINS].filter(i => i.priceType === 'prisms').map(i => `${i.id}:${i.pricePrisms}`);
      gm.save.prisms = 30;
      gm.openWarsztatScreen();
      gm.onCosmeticPick('effect', EAT_EFFECTS.find(e => e.id === 'neon_rose'));
      out.buyLabel = document.getElementById('btnInfoSheetAction').textContent;
      document.getElementById('btnInfoSheetAction').click();
      out.bought = gm.save.effects.owned.includes('neon_rose') && gm.save.effects.selected === 'neon_rose' && gm.save.prisms === 10;
      gm.openCurrencyInfo(true);
      out.info = document.getElementById('infoSheetBody').textContent;
      gm.closeInfoSheet();
      return out;
    });
    results.push(report('prisms: short on coins, the briefing sells the picked booster for 4 ◆; it goes into stock and the mission starts without coins', /Zegar za 4 ◆/.test(r.offer || '') && r.spent === 4 && r.stock === 1 && r.selected && r.started && r.coinsSpent === 0 && r.stockAfter === 0, JSON.stringify(r)));
    results.push(report('prisms: no prism offer when there are not enough prisms', r.noOfferWhenPoor));
    results.push(report('prisms: Efekt pochłaniania and Finisz have prism looks; buying one asks first, then spends and wears it', r.looks.length >= 4 && /KUP I ZAŁÓŻ · 20 ◆/.test(r.buyLabel) && r.bought, JSON.stringify({ looks: r.looks, label: r.buyLabel, bought: r.bought })));
    results.push(report('prisms: the prism sheet lists both modes as sources and no energy as a use', /Arena/.test(r.info) && /Dzielnice/.test(r.info) && /wzmocnienie misji/.test(r.info) && !/energi/i.test(r.info), r.info));
    await done(g, 'prisms');
  }

  return results;
}

if (process.argv[1] && process.argv[1].endsWith('v22.mjs')) {
  const { server, url } = await serve();
  const results = await runV22Checks(url);
  server.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} v22 checks passed`);
  process.exit(failed.length ? 1 : 0);
}
