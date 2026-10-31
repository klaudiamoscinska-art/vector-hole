// DEVICE-QA-1: the fixes from the owner's playtest of 2026-10-30 stay fixed.
//  - Core City: the copy states the real gain (a plain round, podium, first
//    place, a record, the early-level multiplier); the result screen names
//    every part of this round's gain; leaving a round grants none; past
//    LVL6 the city says it is complete and what each further 100% pays.
//  - Ranking by points vs size: the live standings say "by points"; a
//    rival in the band where neither can eat the other gets its real edge
//    drawn and a bump says why it can't be eaten.
//  - Mission boosters: the coin balance is in the briefing; a short balance
//    is said plainly; GRAJ never spends what isn't there; Tarcza off reads.
//  - Reward / unlock cards: the buttons sit centred under the text on every
//    frame, nothing is clipped, the counter is spelled out, a chest whose
//    reward is already credited says so (no "PÓŹNIEJ").
//  - Warsztat: the purchase sheet sits in the middle of a landscape frame,
//    and a previewed item names itself on the preview.
//  - Campaign: the edge arrow never points at a finished step's objects;
//    small objects are drawn over big ones.
//  - Results: the secondary actions line up with the main one.
// Screenshots -> qa/out/deviceqa1/<tag>/<WxH>/<scene>.png
// Usage: node qa/deviceqa1.mjs [--shots] [--tag=after] [--root=DIR] [--only=checks|layout]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, expectAll, is, holds, matches, notMatches, isMain, ROOT, OUT } from './lib.mjs';

const READY = () => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state;

// [w, h, kind]: the owner's playtest frame (a laptop browser at 150 %:
// 1280×593 CSS px, the compact layout), the stage's required frames.
export const FRAMES = [
  [1280, 593, 'desk'], [1920, 1080, 'desk'], [1366, 768, 'desk'], [836, 470, 'desk'],
  [844, 390, 'phone'], [390, 844, 'phone'], [360, 640, 'phone'], [320, 568, 'phone']
];
const vpOpts = (w, h, kind) => ({ viewport: { width: w, height: h }, mobile: kind !== 'desk', deviceScaleFactor: kind === 'desk' ? 1 : 2 });

async function loadSave(page, s) {
  await page.evaluate((v) => { localStorage.setItem('vectorHoleSave_v1', JSON.stringify(v)); sessionStorage.setItem('__qaSeeded', '1'); }, s);
  await page.reload();
  await page.waitForFunction(READY);
}
/** A synthetic veteran save (never a real player's): both modes played,
 *  boosters open, every hub tab announced. `edit` runs on it in the page. */
async function veteran(page, o = {}, edit = null) {
  const s = await veteranSave(page, { missions: 30, coins: 900, runsPlayed: 6, ...o });
  const s2 = edit ? await page.evaluate(edit, s) : s;
  await loadSave(page, s2);
  await page.waitForTimeout(300);
}
const settle = (p, ms = 1700) => p.waitForTimeout(ms);

/* ---------- scenes (the same staging on the base and the candidate) ---------- */
export const SCENES = {
  hubL3: async (p) => { await veteran(p, {}, s => { s.hub.coreLevel = 3; s.hub.coreCharge = 82; return s; }); await p.evaluate(() => window.game.showScreen('mainMenu')); await settle(p, 900); },
  hubL6: async (p) => { await veteran(p, {}, s => { s.hub.coreLevel = 6; s.hub.coreCharge = 5; return s; }); await p.evaluate(() => window.game.showScreen('mainMenu')); await settle(p, 900); },
  results: async (p) => {
    await veteran(p, {}, s => { s.hub.coreLevel = 3; s.hub.coreCharge = 67; s.stats.bestArenaScore = 999999; return s; });
    await p.evaluate(() => { const gm = window.game; gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId); gm.player.score = 30272; gm.bots.forEach((b, i) => { b.score = 2000 - i * 300; }); gm.timeRemaining = 0; gm.endRound(); });
    await settle(p, 3200);
    await p.evaluate(() => { window.game.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); });
  },
  // The boosters card and a district card in one queue (008: "1/2").
  unlockPair: async (p) => {
    await veteran(p, {}, s => { s.unlocks.announced = s.unlocks.announced.filter(id => id !== 'boosters' && id !== 'district:port'); if (!s.campaign.unlockedDistricts.includes('port')) s.campaign.unlockedDistricts.push('port'); return s; });
    await p.evaluate(() => { const gm = window.game; gm.showScreen('mainMenu'); gm.queueUnlockCelebrations({ delay: 0 }); });
    await settle(p);
  },
  // A Core City reward card followed by a district (014: "Wir Kryształ 1/2").
  coreReward: async (p) => {
    await veteran(p, {}, s => { s.unlocks.announced = s.unlocks.announced.filter(id => id !== 'district:galeria'); if (!s.campaign.unlockedDistricts.includes('galeria')) s.campaign.unlockedDistricts.push('galeria'); return s; });
    await p.evaluate(() => { const gm = window.game; gm.showScreen('mainMenu'); gm.grantCoreCityLevelReward(3); gm.queueUnlockCelebrations({ delay: 0 }); });
    await settle(p);
  },
  starChest: async (p) => {
    await veteran(p, {}, s => { s.campaign.starChests = 0; return s; });
    await p.evaluate(() => { const gm = window.game; gm.showScreen('mainMenu'); const st = gm.save.campaign.stars; Object.keys(gm.save.campaign.completed).slice(0, 5).forEach(id => { st[id] = 7; }); gm.save.campaign.starChests = Math.floor(gm.totalStars() / 15) - 1; gm.checkStarChests(); gm.queueUnlockCelebrations({ delay: 0 }); });
    await settle(p);
  },
  freeChest: async (p) => {
    await veteran(p, {}, s => { if (s.freeChest) s.freeChest.nextAt = 0; return s; });
    await p.evaluate(() => { const gm = window.game; gm.showScreen('mainMenu'); gm.openFreeChest(); });
    await settle(p);
  },
  // 017: M25, 179 coins, Zegar in stock, three more picked -> 21 short.
  briefingShort: async (p) => {
    await veteran(p, { coins: 179 }, s => { Object.keys(s.boosters).forEach(k => { if (typeof s.boosters[k] === 'number') s.boosters[k] = 0; }); s.boosters.time = 1; s.boosters.gift = true; s.prisms = 5; return s; });
    await p.evaluate(() => { const gm = window.game; gm.openCampaignScreen(); gm.openMissionBriefing(CAMPAIGN_MISSIONS.find(d => missionCode(d) === 'M25').id, { preselect: ['time', 'start', 'magnet', 'shield'] }); });
    await settle(p, 700);
  },
  // 016: M22 has no hazard -- Tarcza is off.
  briefingShield: async (p) => {
    await veteran(p, { coins: 400 });
    await p.evaluate(() => { const gm = window.game; gm.openCampaignScreen(); gm.openMissionBriefing(CAMPAIGN_MISSIONS.find(d => missionCode(d) === 'M22').id); });
    await settle(p, 700);
  },
  // 004: buying a vortex.
  shopBuy: async (p) => {
    await veteran(p, { coins: 828 });
    await p.evaluate(() => { const gm = window.game; gm.openWarsztatScreen(); gm.onCosmeticPick('skin', SKINS.find(s => s.id === 'pink')); });
    await settle(p, 900);
  },
  // 005: a locked Finisz, previewed.
  shopFinisz: async (p) => {
    await veteran(p, { coins: 528 }, s => { s.prisms = 5; return s; });
    await p.evaluate(() => { const gm = window.game; gm.openWarsztatScreen(); document.getElementById('tabOverdrive').click(); gm.onCosmeticPick('overdriveSkin', OVERDRIVE_SKINS.find(o => o.id === 'zloty_szczyt')); });
    await settle(p, 900);
  },
  // 020: a rival in the band where neither can eat the other, right beside
  // the player (a gold "sun" rim reaching past its real edge).
  arenaNeutral: async (p) => {
    await veteran(p);
    await p.evaluate(() => {
      const gm = window.game; gm.checkEvolutionTriggers = () => {}; gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId); gm.running = false;
      const pl = gm.player; pl.radius = 60; const b = gm.bots[0]; b.radius = 66; b.styleOverride = 'sun'; b.x = pl.x + 70; b.y = pl.y + 10; b.invulnerableUntil = 0; pl.invulnerableUntil = 0;
      gm.bots.slice(1).forEach(o => { o.x = pl.x + 2000; o.y = pl.y + 2000; });
      gm.camera.x = pl.x; gm.camera.y = pl.y; gm.render(performance.now() / 1000);
    });
    await settle(p, 300);
  }
};
const SHOT_SCENES = Object.keys(SCENES);

/* ---------- --shots: before/after pictures (base vs candidate) ---------- */
async function shots(url, tag, only) {
  const dir = path.join(OUT, 'deviceqa1', tag);
  let n = 0;
  for (const [w, h, kind] of FRAMES) {
    const g = await openGame(url, vpOpts(w, h, kind));
    for (const sc of SHOT_SCENES.filter(s => !only || only.includes(s))) {
      try { await SCENES[sc](g.page); } catch (e) { console.log(`NOT RUN  shot ${w}x${h} ${sc}: ${e.message.split('\n')[0]}`); continue; }
      const f = path.join(dir, `${w}x${h}`, sc + '.png');
      fs.mkdirSync(path.dirname(f), { recursive: true });
      await g.page.screenshot({ path: f });
      n++;
    }
    await g.browser.close();
  }
  console.log(`${n} screenshots -> ${path.relative(ROOT, dir)}`);
}

/* ---------- 1. behaviour (one phone frame; the values, not the pixels) ---------- */
async function behaviourChecks(url) {
  const out = [];
  const g = await openGame(url);
  const p = g.page;

  // A. Core City: a finished Arena round at a known place / record, the
  // gain against the formula, the copy, leaving a round.
  const finished = async (level, charge, best, place) => {
    await veteran(p);
    return p.evaluate(([level, charge, best, place]) => {
      const gm = window.game;
      gm.save.hub.coreLevel = level; gm.save.hub.coreCharge = charge; gm.save.stats.bestArenaScore = best;
      gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId);
      gm.player.score = 5000;
      gm.bots.forEach((b, i) => { b.score = i < place - 1 ? 9000 - i : 100 + i; });
      gm.timeRemaining = 0;
      gm.endRound();
      return { charge: gm.save.hub.coreCharge, level: gm.save.hub.coreLevel, gain: document.getElementById('resultCoreGain').textContent,
        parts: (document.getElementById('resultCoreParts') || {}).textContent || '' };
    }, [level, charge, best, place]);
  };
  const r1 = await finished(3, 67, 999999, 1);
  out.push(expectAll('Core City 019: LVL3 67%, 1st place, no record -> 82% (+10 round +2 podium +3 first), the result names each part', {
    charge: is(r1.charge, 82), gain: is(r1.gain, '+15%'), parts: is(r1.parts, 'runda +10% · podium +2% · 1. miejsce +3%')
  }, JSON.stringify(r1)));
  const r2 = await finished(1, 0, 0, 1);
  out.push(expectAll('Core City 002: LVL1 0%, 1st place + record -> 27% ((10+2+3+2) x1.6), the early multiplier is named', {
    charge: is(r2.charge, 27), gain: is(r2.gain, '+27%'), parts: matches(/rekord \+2% · ×1,6 na LVL 1–2$/, r2.parts)
  }, JSON.stringify(r2)));
  const r3 = await finished(3, 40, 999999, 4);
  out.push(expectAll('Core City: 4th place -> the plain +10% only', { charge: is(r3.charge, 50), parts: is(r3.parts, 'runda +10%') }, JSON.stringify(r3)));
  // Leaving: a score > 0 pays the score part only (R1), 0 nothing -- Core City never.
  await veteran(p);
  const left = await p.evaluate(() => {
    const gm = window.game, o = {};
    gm.save.hub.coreLevel = 3; gm.save.hub.coreCharge = 67;
    const runs0 = gm.save.stats.runsPlayed;
    gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId); gm.player.score = 1234; gm.leaveRun();
    o.afterScore = gm.save.hub.coreCharge;
    gm.startRound({ seed: 778 }); cancelAnimationFrame(gm.rafId); gm.player.score = 0; gm.leaveRun();
    o.afterZero = gm.save.hub.coreCharge; o.level = gm.save.hub.coreLevel; o.runs = gm.save.stats.runsPlayed - runs0;
    return o;
  });
  out.push(expectAll('Core City: entering and leaving a round (score > 0 and 0) adds nothing to the city and no finished round', {
    afterScore: is(left.afterScore, 67), afterZero: is(left.afterZero, 67), level: is(left.level, 3), runs: is(left.runs, 0)
  }, JSON.stringify(left)));
  const hub = await p.evaluate(() => {
    const gm = window.game, rd = () => ({ title: (document.getElementById('hubCityPitchTitle') || document.querySelector('.hub-city-pitch strong')).textContent, sub: document.getElementById('hubCityPitchSub').textContent,
      play: document.getElementById('hubPlaySub').textContent, chip: document.getElementById('hubRewardChip1').textContent });
    gm.save.hub.coreLevel = 3; gm.save.hub.coreCharge = 82; gm.showScreen('mainMenu'); gm.updateCoinDisplays(); const l3 = rd();
    gm.save.hub.coreLevel = 1; gm.save.hub.coreCharge = 0; gm.updateCoinDisplays(); const l1 = rd();
    gm.save.hub.coreLevel = 6; gm.save.hub.coreCharge = 5; gm.updateCoinDisplays(); const l6 = rd();
    const c0 = gm.save.coins, p0 = gm.save.prisms || 0; gm.grantCoreCityLevelReward(7); gm.pendingRewardCelebrations = [];
    return { l3, l1, l6, fallback: { coins: gm.save.coins - c0, prisms: (gm.save.prisms || 0) - p0 } };
  });
  out.push(expectAll('Core City copy: the range a round adds (+10–17%, +16–27% at LVL1-2), the reward "at the latest" in N rounds, GRAJ says the same', {
    l3sub: is(hub.l3.sub, '+10–17% za rundę · nagroda najpóźniej za 2 rundy'), l3play: matches(/\+10–17% budowy miasta$/, hub.l3.play),
    l1sub: matches(/^\+16–27% za rundę/, hub.l1.sub), l3title: is(hub.l3.title, 'Każda runda Areny buduje Twoje miasto')
  }, JSON.stringify(hub)));
  out.push(expectAll('Core City 023: LVL6 says the city is built and what each further 100% pays (= what LVL7 grants)', {
    title: is(hub.l6.title, 'Miasto zbudowane w całości'), sub: matches(/co 100%: \+100 monet i \+10 pryzmatów/, hub.l6.sub),
    chip: is(hub.l6.chip, '+100 monet + 10 pryzmatów'), coins: is(hub.fallback.coins, 100), prisms: is(hub.fallback.prisms, 10)
  }, JSON.stringify(hub.l6)));

  // B. Ranking by points; a rival in the neutral band.
  await veteran(p);
  const rank = await p.evaluate(() => {
    const gm = window.game; gm.checkEvolutionTriggers = () => {};
    gm.startRound({ seed: 777 }); cancelAnimationFrame(gm.rafId); gm.running = false;
    const pl = gm.player; pl.radius = 20; pl.score = 2030;
    const big = gm.bots[0]; big.radius = 120; big.score = 1745; big.x = pl.x + 3000;
    const order = rankHoles([pl, ...gm.bots]).map(h => h.isPlayer ? 'P' : h.radius);
    // neutral: 60 vs 66 -- neither can eat (x1.15), touching
    gm.bots.forEach(o => { o.x = pl.x + 3000; o.y = pl.y + 3000; });
    pl.radius = 60; pl.invulnerableUntil = 0; // spawn protection is a getter on this timer
    const b = gm.bots[1]; b.radius = 66; b.x = pl.x + 10; b.y = pl.y; b.invulnerableUntil = 0;
    const n0 = gm.bots.length, s0 = pl.score;
    gm.floatTexts = []; gm.lockHintAt = null; b.lockHintAt = null;
    gm.handleHoleCollisions();
    const neutral = { bots: gm.bots.length - n0, score: pl.score - s0, r: [pl.radius, b.radius], tag: gm.floatTexts.map(f => f.text).join('|') };
    // the ring: draw once, count dashed [4,6] arcs around b
    const ctx = gm.ctx, dash = ctx.setLineDash.bind(ctx); let rings = 0;
    ctx.setLineDash = (d) => { if (d && d[0] === 4 && d[1] === 6) rings++; dash(d); };
    gm.camera.x = pl.x; gm.camera.y = pl.y; gm.render(performance.now() / 1000);
    ctx.setLineDash = dash;
    // prey: 80 vs 60 -- eaten
    pl.radius = 80; b.radius = 60; b.x = pl.x + 10; b.y = pl.y; const s1 = pl.score;
    gm.handleHoleCollisions();
    return { order, neutral, rings, preyScore: pl.score - s1, title: document.querySelector('#hud-rankBadge .leaderboard-title').textContent.trim(),
      note: (document.querySelector('.result-rank-note') || {}).textContent || '' };
  });
  out.push(expectAll('Ranking 022: by points -- a small vortex with more points is #1 over a much bigger one; the live standings are titled PUNKTY, the results say so too', {
    first: is(rank.order[0], 'P'), title: is(rank.title, 'PUNKTY'), note: matches(/według punktów, nie rozmiaru wiru/, rank.note)
  }, JSON.stringify({ order: rank.order, title: rank.title })));
  out.push(expectAll('Ranking 020: a rival within ×1.15 of the player is not eaten either way (no collision bug), a tag says why, a grey ring marks it; a clearly smaller one is eaten', {
    notEaten: is(rank.neutral.score, 0), radii: is(rank.neutral.r.join(','), '60,66'), tag: matches(/PODOBNY ROZMIAR/, rank.neutral.tag),
    ring: holds(rank.rings >= 1, rank.rings, '>= 1 grey dashed ring'), prey: holds(rank.preyScore > 0, rank.preyScore, '> 0 (eaten)')
  }, JSON.stringify(rank.neutral)));

  // C. Boosters (016/017): balance in view, short copy, no spend without
  // coins, prisms buy one, Tarcza off explained.
  await veteran(p, { coins: 179 }, s => { Object.keys(s.boosters).forEach(k => { if (typeof s.boosters[k] === 'number') s.boosters[k] = 0; }); s.boosters.time = 1; s.boosters.gift = true; s.prisms = 5; return s; });
  const bo = await p.evaluate(() => {
    const gm = window.game, card = document.getElementById('briefingCard');
    const id = CAMPAIGN_MISSIONS.find(d => missionCode(d) === 'M25').id;
    gm.openCampaignScreen(); gm.openMissionBriefing(id, { preselect: ['time', 'start', 'magnet', 'shield'] });
    const o = { wallet: (card.querySelector('.mc-boost-wallet') || {}).textContent || '', note: card.querySelector('.mc-boost-note').textContent,
      color: getComputedStyle(card.querySelector('.mc-boost-note')).color, play: card.querySelector('.mc-play[data-mc-launch]').textContent.replace(/\s+/g, ' ').trim(),
      ad: !!card.querySelector('[data-booster-ad]'), prismBtn: (card.querySelector('[data-booster-prisms]') || {}).textContent || '' };
    gm.launchMission(id);
    o.blocked = { coins: gm.save.coins, briefingOpen: !document.getElementById('missionBriefing').classList.contains('hidden'), mission: !!(gm.mission && gm.mission.def && gm.running) };
    const pb = card.querySelector('[data-booster-prisms]'); if (pb) gm.buyBoosterPrisms(pb.dataset.boosterPrisms);
    o.afterPrisms = { prisms: gm.save.prisms, start: gm.save.boosters.start, note: card.querySelector('.mc-boost-note').textContent };
    gm.launchMission(id); cancelAnimationFrame(gm.rafId);
    o.launched = { coins: gm.save.coins, time: gm.save.boosters.time, start: gm.save.boosters.start };
    return o;
  });
  out.push(expectAll('Boosters 017: the balance is in the briefing, the shortfall is right (200 − 179 = 21) and not pink, GRAJ shows the total and spends nothing when short', {
    wallet: is(bo.wallet, 'Masz 179 ◇'), note: matches(/Brakuje 21 monet na wybrane wzmocnienia/, bo.note), notPink: holds(!/255, 84, 173/.test(bo.color), bo.color, 'not the pink'),
    play: matches(/−200 ◇/, bo.play), coinsKept: is(bo.blocked.coins, 179), stillInBriefing: is(bo.blocked.briefingOpen, true)
  }, JSON.stringify(bo)));
  out.push(expectAll('Boosters 017: a booster for prisms covers the gap (5 − 4 ◆, Turbo start in stock), then GRAJ pays the rest in coins (179 − 130) and uses the stock', {
    prisms: is(bo.afterPrisms.prisms, 1), start1: is(bo.afterPrisms.start, 1), coins: is(bo.launched.coins, 49), time: is(bo.launched.time, 0), start: is(bo.launched.start, 0)
  }, JSON.stringify({ afterPrisms: bo.afterPrisms, launched: bo.launched, ad: bo.ad })));
  await veteran(p, { coins: 400 });
  const sh = await p.evaluate(() => {
    const gm = window.game, card = document.getElementById('briefingCard');
    const def = CAMPAIGN_MISSIONS.find(d => missionCode(d) === 'M22');
    gm.openCampaignScreen(); gm.openMissionBriefing(def.id);
    const tile = [...card.querySelectorAll('.mc-boost')].find(t => /Tarcza/.test(t.textContent));
    const short = tile.querySelector('.mc-boost-short');
    return { useful: gm.boosterUseful('shield', def), disabled: tile.disabled, short: short.textContent, fits: short.scrollWidth <= short.clientWidth + 1, note: card.querySelector('.mc-boost-note').textContent,
      hazards: JSON.stringify({ bots: def.setup.bots || 0, glitch: def.setup.glitch || 0, racer: def.setup.racer || 0 }) };
  });
  out.push(expectAll('Boosters 016: M22 has no hazard (no rival, glitch, thief), so Tarcza is off -- its tile text fits, the note says why', {
    useful: is(sh.useful, false), disabled: is(sh.disabled, true), short: is(sh.short, 'tu zbędna'), fits: is(sh.fits, true), note: matches(/Tarcza się tu nie przyda/, sh.note)
  }, JSON.stringify(sh)));

  // D. Chests and unlock cards.
  await veteran(p, {}, s => { s.campaign.starChests = 0; s.unlocks.announced = s.unlocks.announced.filter(id => id !== 'boosters' && id !== 'district:port'); if (!s.campaign.unlockedDistricts.includes('port')) s.campaign.unlockedDistricts.push('port'); return s; });
  const ch = await p.evaluate(async () => {
    const gm = window.game, o = {}, txt = id => document.getElementById(id).textContent, vis = id => !document.getElementById(id).classList.contains('hidden');
    gm.showScreen('mainMenu');
    const st = gm.save.campaign.stars; Object.keys(gm.save.campaign.completed).slice(0, 5).forEach(id => { st[id] = 7; });
    gm.save.campaign.starChests = Math.floor(gm.totalStars() / 15) - 1;
    const c0 = gm.save.coins; gm.checkStarChests(); o.credited = gm.save.coins - c0;
    gm.queueUnlockCelebrations({ delay: 0 });
    await new Promise(r => setTimeout(r, 60));
    const card = () => ({ kicker: document.querySelector('#unlockOverlay .unlock-kicker').textContent, title: txt('unlockTitle'), desc: txt('unlockDesc'), counter: vis('unlockCounter') ? txt('unlockCounter') : '', go: vis('btnUnlockGo') ? txt('btnUnlockGo') : null, later: txt('btnUnlockLater') });
    o.cards = [card()];
    for (let i = 0; i < 4 && !document.getElementById('unlockOverlay').classList.contains('hidden') && gm.unlockQueue.length; i++) { document.getElementById('btnUnlockLater').click(); await new Promise(r => setTimeout(r, 30)); o.cards.push(card()); }
    return o;
  });
  const chest = ch.cards.find(c => /Skrzynia gwiazd/.test(c.title)) || {};
  const boosters = ch.cards.find(c => c.title === 'WZMOCNIENIA') || {};
  const port = ch.cards.find(c => c.title === 'PORT SYNTEZ') || {};
  out.push(expectAll('Chests 006/012: a star chest opens by itself, its reward is credited before the card, the card says so and never "PÓŹNIEJ"', {
    credited: is(ch.credited, 120), kicker: is(chest.kicker, 'SKRZYNIA GWIAZD OTWARTA'), desc: matches(/^Już na Twoim koncie: \+120 monet · \+3 pryzmaty · wzmocnienie „.+”\. Skrzynia otwiera się sama co 15 gwiazdek — następna przy \d+\.$/, chest.desc || ''),
    noLater: holds(chest.later && chest.later !== 'PÓŹNIEJ', chest.later, 'not PÓŹNIEJ'), noGo: is(chest.go, null)
  }, JSON.stringify(ch.cards.map(c => [c.title, c.counter, c.go, c.later]))));
  out.push(expectAll('Unlocks 008/009/014: the counter is spelled out ("Nowość n z N"), Wzmocnienia has one button (its old ŚWIETNIE did what DALEJ did), a district keeps DO DZIELNICY (+ DALEJ, or PÓŹNIEJ when last), PÓŹNIEJ only beside a CTA', {
    counter: matches(/^Nowość 1 z \d$/, ch.cards[0].counter), boostersGo: is(boosters.go, null), boostersLater: matches(/^(DALEJ|ŚWIETNIE)$/, boosters.later || ''),
    portGo: is(port.go, 'DO DZIELNICY'), portNext: is(port.later, ch.cards[ch.cards.length - 1] === port ? 'PÓŹNIEJ' : 'DALEJ'), lastNoLater: holds(ch.cards[ch.cards.length - 1].go || ch.cards[ch.cards.length - 1].later !== 'PÓŹNIEJ', ch.cards[ch.cards.length - 1].later, 'PÓŹNIEJ only beside a CTA'), lastCounter: matches(/^Nowość (\d) z \1$/, ch.cards[ch.cards.length - 1].counter)
  }, JSON.stringify(ch.cards.map(c => [c.title, c.counter, c.go, c.later]))));
  await veteran(p, {}, s => { if (s.freeChest) s.freeChest.nextAt = 0; return s; });
  const fc = await p.evaluate(async () => { const gm = window.game; gm.showScreen('mainMenu'); const c0 = gm.save.coins; gm.openFreeChest(); await new Promise(r => setTimeout(r, 750)); return { credited: gm.save.coins - c0, desc: document.getElementById('unlockDesc').textContent, later: document.getElementById('btnUnlockLater').textContent }; });
  out.push(expectAll('Chests 007: the free chest card says the coins are already credited, no "PÓŹNIEJ"', {
    credited: holds(fc.credited > 0, fc.credited, '> 0'), desc: matches(/^Już na Twoim koncie\./, fc.desc), later: holds(fc.later !== 'PÓŹNIEJ', fc.later, 'not PÓŹNIEJ')
  }, JSON.stringify(fc)));

  // E. Warsztat 005: the previewed Finisz names itself; closing reverts.
  await veteran(p, { coins: 528 }, s => { s.prisms = 5; return s; });
  const ws = await p.evaluate(() => {
    const gm = window.game; gm.openWarsztatScreen(); const skinName = document.getElementById('warsztatPreviewName').textContent;
    gm.onCosmeticPick('overdriveSkin', OVERDRIVE_SKINS.find(o => o.id === 'zloty_szczyt'));
    const o = { skinName, name: document.getElementById('warsztatPreviewName').textContent, label: document.querySelector('#warsztatLook .warsztat-look-label').textContent };
    gm.closeInfoSheet();
    o.after = document.getElementById('warsztatPreviewName').textContent; o.owned = gm.save.overdriveSkins.owned.includes('zloty_szczyt'); o.selected = gm.save.overdriveSkins.selected;
    return o;
  });
  out.push(expectAll('Warsztat 005: a locked Finisz previewed names itself on the preview (not the equipped vortex); "NIE TERAZ" puts it back, nothing bought or equipped', {
    name: is(ws.name, 'Złoty Szczyt'), label: matches(/FINISZ/, ws.label), back: is(ws.after, ws.skinName), owned: is(ws.owned, false), selected: is(ws.selected, 'classic')
  }, JSON.stringify(ws)));

  // F. Campaign 024 + 021.
  await veteran(p, { missions: 120 });
  const cg = await p.evaluate(() => {
    const gm = window.game;
    const def = CAMPAIGN_MISSIONS.find(d => d.goal.type === 'objectives' && d.goal.steps.some(s => s.eat === 'runner') && d.goal.steps.some(s => s.eat && s.eat !== 'runner'));
    if (!def) return { missing: true };
    gm.startCampaignMission(def.id); if (gm.introPending) gm.beginMissionPlay(); cancelAnimationFrame(gm.rafId); gm.running = false;
    const m = gm.mission, step = def.goal.steps.find(s => s.eat === 'runner');
    if (step.glyph) m.eatenByGlyph[step.glyph] = step.n; else m.eatenByType.runner = step.n;
    const liveRunners = gm.campaignEntities.filter(e => e.type === 'runner' && !e.consumed && e.live !== false).length;
    const targets = gm.campaignGuideTargets().map(e => e.type);
    // draw order: record what draws, in order
    const P = CampaignEntity.prototype, orig = P.draw, drawn = [];
    P.draw = function (...a) { drawn.push(this.radius); return orig.apply(this, a); };
    gm.camera.x = gm.player.x; gm.camera.y = gm.player.y; gm.zoom = 0.35; gm.renderCampaign(1);
    P.draw = orig;
    let inversions = 0; for (let i = 1; i < drawn.length; i++) if (drawn[i] > drawn[i - 1] + 1e-6) inversions++;
    return { id: def.id, code: missionCode(def), steps: def.goal.steps.map(s => s.label), liveRunners, targets: [...new Set(targets)], runnerTargets: targets.filter(t => t === 'runner').length, drawn: drawn.length, inversions };
  });
  if (cg.missing) out.push({ name: 'Campaign 024: NOT RUN -- no mission with a byte step next to another eat step', ok: true, notRun: true });
  else {
    out.push(expectAll(`Campaign 024 (${cg.code}): once "Złap złote bajty" is done, the edge arrow never points at a byte (still on the board: ${cg.liveRunners})`, {
      runnerTargets: is(cg.runnerTargets, 0), others: holds(cg.targets.length > 0, cg.targets.join(','), 'another goal type')
    }, JSON.stringify(cg)));
    out.push(expectAll('Board 021: objects in view draw biggest first (a small one is never under a bigger one)', {
      drawn: holds(cg.drawn > 5, cg.drawn, '> 5 drawn'), inversions: is(cg.inversions, 0)
    }, JSON.stringify({ drawn: cg.drawn, inversions: cg.inversions })));
  }
  out.push(report('DEVICE-QA-1 behaviour: no runtime errors', g.errors.length === 0, g.errors.slice(0, 3).join(' | ')));
  await g.browser.close();
  return out;
}

/* ---------- 2. layout on every frame ---------- */
const LAYOUT = function (kind) {
  const W = innerWidth, H = innerHeight, R = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, cx: r.left + r.width / 2 }; };
  const visible = (el) => el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
  const o = { kind };
  if (kind === 'unlock') {
    const desc = document.getElementById('unlockDesc'), title = document.getElementById('unlockTitle');
    const btns = ['btnUnlockGo', 'btnUnlockLater'].map(id => document.getElementById(id)).filter(visible);
    const d = R(desc), t = R(title);
    o.offsets = btns.map(b => Math.round(Math.abs(R(b).cx - d.cx)));
    o.titleOffset = Math.round(Math.abs(t.cx - d.cx));
    o.clipped = desc.scrollWidth > desc.clientWidth + 1;
    o.inView = [desc, title, ...btns].every(el => { const r = R(el); return r.l >= -1 && r.r <= W + 1; });
    o.widths = btns.map(b => Math.round(R(b).w));
  } else if (kind === 'results') {
    const pa = R(document.getElementById('btnPlayAgain')), row = R(document.querySelector('.result-actions-row'));
    o.stacked = row.t >= pa.b - 1;
    o.widthDiff = Math.round(Math.abs(pa.w - row.w));
    o.leftDiff = Math.round(Math.abs(pa.l - row.l));
  } else if (kind === 'sheet') {
    const sheet = R(document.querySelector('#infoSheet .info-sheet-panel')), prev = R(document.getElementById('warsztatPreviewCanvas'));
    o.layout = document.body.classList.contains('wide') ? 'wide' : document.body.classList.contains('compact') ? 'compact' : 'phone';
    o.centerOff = Math.round(Math.abs((sheet.t + sheet.b) / 2 - H / 2));
    o.coversPreview = Math.max(0, Math.min(sheet.r, prev.r) - Math.max(sheet.l, prev.l)) * Math.max(0, Math.min(sheet.b, prev.b) - Math.max(sheet.t, prev.t)) > 0.25 * prev.w * prev.h;
    o.inView = sheet.t >= -1 && sheet.b <= H + 1 && sheet.l >= -1 && sheet.r <= W + 1;
    o.buttons = [...document.querySelectorAll('#infoSheet button')].filter(visible).every(b => { const r = R(b); return r.t >= 0 && r.b <= H && r.l >= 0 && r.r <= W; });
  } else if (kind === 'briefing') {
    const w = document.querySelector('#briefingCard .mc-boost-wallet');
    o.wallet = w ? w.textContent : '';
    o.walletVisible = !!w && visible(w);
  }
  return o;
};

async function layoutChecks(url) {
  const out = [];
  for (const [w, h, kind] of FRAMES) {
    const g = await openGame(url, vpOpts(w, h, kind));
    const p = g.page, tag = `${w}×${h}`;
    const unlocks = [];
    for (const sc of ['unlockPair', 'coreReward', 'starChest', 'freeChest']) {
      await SCENES[sc](p);
      await p.waitForTimeout(500);
      unlocks.push({ sc, ...(await p.evaluate(LAYOUT, 'unlock')) });
      if (sc === 'unlockPair') { await p.evaluate(() => document.getElementById('btnUnlockLater').click()); await p.waitForTimeout(1900); unlocks.push({ sc: 'unlockPair#2', ...(await p.evaluate(LAYOUT, 'unlock')) }); }
    }
    const bad = unlocks.filter(u => u.offsets.some(x => x > 2) || u.titleOffset > 2 || u.clipped || !u.inView);
    out.push(report(`Cards ${tag}: buttons and title centred on the text (±2 px), nothing clipped or out of view -- unlock, 2nd card, Core City reward, star chest, free chest`, bad.length === 0, JSON.stringify(bad.length ? bad : unlocks.map(u => [u.sc, u.offsets, u.widths]))));
    await SCENES.results(p);
    const rs = await p.evaluate(LAYOUT, 'results');
    out.push(report(`Results ${tag}: the secondary actions line up with ZAGRAJ JESZCZE RAZ (same width and left edge when stacked)`, !rs.stacked || (rs.widthDiff <= 2 && rs.leftDiff <= 2), JSON.stringify(rs)));
    await SCENES.shopBuy(p);
    const sb = await p.evaluate(LAYOUT, 'sheet');
    const sheetOk = sb.inView && sb.buttons && (sb.layout === 'phone' || (sb.centerOff <= Math.max(24, h * 0.06) && !sb.coversPreview));
    out.push(report(`Warsztat ${tag}: the purchase sheet ${sb.layout === 'phone' ? 'in view (phone: bottom sheet)' : 'centred in height, beside the live preview'}, every button in view`, sheetOk, JSON.stringify(sb)));
    await SCENES.briefingShort(p);
    const bf = await p.evaluate(LAYOUT, 'briefing');
    out.push(report(`Briefing ${tag}: the coin balance is shown with the boosters`, bf.walletVisible && bf.wallet === 'Masz 179 ◇', JSON.stringify(bf)));
    if (g.errors.length) out.push(report(`DEVICE-QA-1 ${tag}: no runtime errors`, false, g.errors.slice(0, 3).join(' | ')));
    await g.browser.close();
  }
  return out;
}

export async function runDeviceQa1Checks(url, only = null) {
  const out = [];
  if (!only || only.includes('checks')) out.push(...await behaviourChecks(url));
  if (!only || only.includes('layout')) out.push(...await layoutChecks(url));
  return out;
}

async function main() {
  const arg = (k) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : null; };
  const root = arg('root') ? path.resolve(arg('root')) : ROOT;
  const { server, url } = await serve({ root });
  try {
    if (process.argv.includes('--shots')) {
      await shots(url, arg('tag') || 'after', arg('scenes') ? arg('scenes').split(',') : null);
      return;
    }
    const res = await runDeviceQa1Checks(url, arg('only') ? arg('only').split(',') : null);
    const failed = res.filter(r => !r.ok);
    console.log(`\n${res.length - failed.length}/${res.length} DEVICE-QA-1 checks passed`);
    process.exitCode = failed.length ? 1 : 0;
  } finally { server.close(); }
}

if (isMain(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
