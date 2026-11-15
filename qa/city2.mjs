// CITY-2 "Drugi brzeg" -- Core City's second sector, LVL 7-12, on the one
// saved level (save.hub.coreLevel / coreCharge; no new save field):
//  1. Saves: existing saves at LVL 1, 5, 6 (and 9 / 15 from the old repeating
//     LVL 7+ premium) load with exactly their level, charge, wallet and gear,
//     open on the right sector, and looking / switching writes nothing.
//  2. Progress: real Arena rounds through endRound(): 5 -> 6 (the Pryzmat set
//     once), 6 -> 7 and 11 -> 12 (the same +100 coins + 10 prisms premium as
//     before, no cosmetic, nothing granted again), past 12 (the counter goes
//     on, the city shows LVL 12 complete); the progress survives a reload.
//  3. Independence: a campaign mission and a round left early add nothing to
//     Core City; the sector switch never changes progress; a chosen sector
//     stays in view across a level-up.
//  4. Sanitation: broken hub values load as a valid level and draw.
//  5. A new player starts on the Centrum at LVL 1, Drugi brzeg locked.
//  6. Look: the Centrum is pixel-identical to the base revision; Drugi brzeg
//     changes visibly at every level 6 -> 12 on a phone; nothing over the
//     headline; the switch never covers the headline or GRAJ (still the
//     biggest action); the roadmap lists LVL 2-12 with thumbnails.
//  7. PL / EN copy, no runtime errors.
// Usage: node qa/city2.mjs [--only=saves,progress,independence,sanitize,newplayer,look,lang]
import { serve, openGame, veteranSave, report, isMain, frozenDateScript, QA_RANDOM, revisionFile, OUT } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

/** The stage's base: origin/main before CITY-2 (PR #105's merge). */
const BASE_REV = process.env.VH_CITY2_BASE || '0e67e2fd0d2a609000a2bca93c2166619933f524';
const READY = () => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state;
const FROZEN = '2026-11-13T10:00:00Z';

async function open(url, { w = 390, h = 844, mobile = true, locale = 'pl-PL', hub = null, edit = null, fresh = false } = {}) {
  const g = await openGame(url, { viewport: { width: w, height: h }, mobile, deviceScaleFactor: 1, locale, initScript: frozenDateScript(FROZEN) + QA_RANDOM });
  if (!fresh) {
    const s = await veteranSave(g.page, { missions: 29, coins: 1240, runsPlayed: 23 });
    if (hub) s.hub = hub;
    const edited = edit ? await g.page.evaluate(({ s, src }) => { (0, eval)('(' + src + ')')(s); return s; }, { s, src: edit.toString() }) : s;
    await g.page.evaluate((v) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(v)), edited);
    await g.page.reload();
    await g.page.waitForFunction(READY);
  }
  return g;
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));
/** Miasto's Core City card as the player sees it. */
const CARD = () => {
  const $ = (id) => document.getElementById(id);
  const cv = $('hubCityCanvas');
  return {
    lvl: $('hubLevelLabel').textContent, pct: $('hubChargeValue').textContent, title: $('hubCityPitchTitle').textContent, sub: $('hubCityPitchSub').textContent,
    prefix: $('hubRewardPrefix').textContent.trim(), chip: $('hubRewardChip1').textContent,
    rail: [...document.querySelectorAll('#hubCoreRail .u2-rail-node')].map(n => n.textContent + (n.classList.contains('on') ? '+' : n.classList.contains('now') ? '*' : '')).join(' '),
    lead: (document.querySelector('#hubCoreRail .u2-rail-lead i') || {}).style ? document.querySelector('#hubCoreRail .u2-rail-lead i').style.width : null,
    sector: window.game.hubSectorView(), drawn: cv.__skyline ? (cv.__skyline.sector || 'center') : null, stage: cv.__skyline && cv.__skyline.stage,
    centerOn: $('btnSectorCenter').classList.contains('on'), shoreOn: $('btnSectorShore').classList.contains('on'),
    shoreLocked: $('btnSectorShore').classList.contains('locked'), switchLabel: $('hubSectorSwitch').getAttribute('aria-label')
  };
};
/** One finished Arena round (podium, a record) through the real endRound(). */
const ROUND = async (seed) => {
  const gm = window.game;
  gm.startRound({ seed }); cancelAnimationFrame(gm.rafId);
  gm.player.score = 99999; gm.bots.forEach((b, i) => { b.score = 1000 - i * 50; });
  gm.timeRemaining = 0; gm.endRound();
  gm.unlockQueue = []; clearTimeout(gm.unlockShowTimer); document.getElementById('unlockOverlay').classList.add('hidden');
  gm.pendingRewardCelebrations = [];
  return { rewards: (gm.hubMilestoneRewards || []).map(r => ({ level: r.level, label: r.label, coins: r.coins })), lvlTag: document.getElementById('resultCoreLvl').textContent, lvlTagShown: !document.getElementById('resultCoreLvl').classList.contains('hidden'), stage: document.getElementById('resultCoreStage').textContent };
};
const GEAR = () => { const s = window.game.save; return JSON.stringify([s.owned, s.auras.owned, s.effects.owned, s.overdriveSkins.owned, s.badges]); };

/* ============================== 1. SAVES ============================== */
async function savesChecks(url) {
  const out = [];
  for (const [L, c, view] of [[1, 0, 'center'], [5, 73, 'center'], [6, 40, 'center'], [9, 12, 'shore'], [15, 55, 'shore']]) {
    const g = await open(url, { hub: { coreLevel: L, coreCharge: c }, edit: (s) => { s.prisms = 37; s.owned.push('krysztal'); s.auras.owned.push('impuls'); } });
    await wait(900);
    const r = await g.page.evaluate(async (CARDsrc) => {
      const card = (0, eval)('(' + CARDsrc + ')');
      const gm = window.game, stored = localStorage.getItem('vectorHoleSave_v1'), s0 = JSON.parse(stored);
      const a = card();
      gm.setHubSector('shore'); await new Promise(r => setTimeout(r, 300)); const shore = card();
      gm.setHubSector('center'); await new Promise(r => setTimeout(r, 300)); const center = card();
      return { a, shore, center, hub: gm.save.hub, coins: gm.save.coins === s0.coins, prisms: gm.save.prisms === 37, gear: JSON.stringify(gm.save.owned) === JSON.stringify(s0.owned) && JSON.stringify(gm.save.auras.owned) === JSON.stringify(s0.auras.owned),
        guard: SAVE_GUARD.state, untouched: localStorage.getItem('vectorHoleSave_v1') === stored, schema: JSON.parse(localStorage.getItem('vectorHoleSave_v1')).schemaVersion, hubKeys: Object.keys(gm.save.hub).sort().join(',') };
    }, CARD.toString());
    const shown = Math.min(L, 12);
    out.push(report(`Save LVL ${L} (${c}%): loads with exactly its level, charge, wallet and gear; SAVE v13, no new hub field; nothing written by looking or switching`,
      r.hub.coreLevel === L && r.hub.coreCharge === c && r.coins && r.prisms && r.gear && r.guard === 'ok' && r.untouched && r.schema === 13 && r.hubKeys === 'coreCharge,coreLevel', JSON.stringify({ hub: r.hub, guard: r.guard, untouched: r.untouched, keys: r.hubKeys })));
    const centerRail = L >= 7 ? '1+ 2+ 3+ 4+ 5+ 6+' : [1, 2, 3, 4, 5, 6].map(n => n + (n < L ? '+' : n === L ? '*' : '')).join(' ');
    const shoreRail = [7, 8, 9, 10, 11, 12].map(n => n + (n < L ? '+' : n === L ? '*' : '')).join(' ');
    out.push(report(`Save LVL ${L}: opens on ${view === 'shore' ? 'Drugi brzeg' : 'the Centrum'} (the sector being built), LVL ${shown} on the badge, the ${c}% charge, the rails 1-6 / 7-12`,
      r.a.sector === view && r.a.drawn === view && r.a.lvl === 'LVL ' + shown && r.a.pct === c + '%' && r.center.rail === centerRail && r.shore.rail === shoreRail
      && r.shore.lead === (L > 6 ? '100%' : L === 6 ? c + '%' : '0%') && r.center.drawn === 'center' && r.shore.drawn === 'shore', JSON.stringify({ a: r.a, center: r.center.rail, shore: r.shore.rail, lead: r.shore.lead })));
    if (L === 6) out.push(report('Save LVL 6: the Centrum shows as complete, the next line names Drugi brzeg LVL 7 (its stage + the same premium as before), Drugi brzeg is open (not locked) and marked new',
      r.center.title === 'Centrum ukończone' && /Drugi brzeg/.test(r.center.sub) && r.center.prefix === 'Następny etap · Drugi brzeg:' && r.center.chip === 'LVL 7 „Przyczółek” + 100 monet + 10 pryzmatów' && !r.a.shoreLocked
      && r.shore.title === 'Każda runda Areny buduje Drugi brzeg' && r.shore.stage === 6, JSON.stringify({ center: r.center, shore: r.shore })));
    if (L < 6) out.push(report(`Save LVL ${L}: Drugi brzeg is visible but locked ("odblokuj na poziomie 6"), its view says so; the Centrum's reward line is unchanged`,
      r.a.shoreLocked && r.a.switchLabel === 'Pokaż Drugi brzeg — odblokuj na poziomie 6' && r.shore.title === 'Drugi brzeg: odblokuj na poziomie 6' && r.center.prefix === 'Następna nagroda:' && r.center.title === 'Każda runda Areny buduje Twoje miasto', JSON.stringify({ a: r.a, shore: r.shore })));
    if (L >= 12) out.push(report(`Save LVL ${L}: the whole city shows as complete at LVL 12 (no LVL 13 anywhere on the card), the repeating premium as before`,
      r.shore.title === 'Drugi brzeg ukończony' && r.center.title === 'Centrum ukończone' && /co 100%: \+100 monet i \+10 pryzmatów/.test(r.shore.sub) && r.a.lvl === 'LVL 12' && !/13|14|15/.test(r.shore.rail) && r.shore.stage === 12, JSON.stringify(r.shore)));
    out.push(report(`Save LVL ${L}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  return out;
}

/* ============================ 2. PROGRESS ============================ */
async function progressChecks(url) {
  const out = [];
  const g = await open(url, { hub: { coreLevel: 5, coreCharge: 95 }, edit: (s) => { s.stats.bestArenaScore = 100; } });
  const step = async (L, c) => g.page.evaluate(async ({ L, c, ROUNDsrc, GEARsrc }) => {
    const round = (0, eval)('(' + ROUNDsrc + ')'), gear = (0, eval)('(' + GEARsrc + ')'), gm = window.game;
    gm.save.hub.coreLevel = L; gm.save.hub.coreCharge = c;
    const before = { coins: gm.save.coins, prisms: gm.save.prisms || 0, gear: gear() };
    const r = await round(4242 + L);
    return { ...r, hub: { ...gm.save.hub }, coins: gm.save.coins - before.coins, prisms: (gm.save.prisms || 0) - before.prisms, gearSame: gear() === before.gear, gear: gear(), stored: JSON.parse(localStorage.getItem('vectorHoleSave_v1')).hub };
  }, { L, c, ROUNDsrc: ROUND.toString(), GEARsrc: GEAR.toString() });
  const s56 = await step(5, 95);
  out.push(report('5 -> 6: a finished round crosses 100% -- LVL 6, the unchanged Pryzmat set + 400 coins once, saved',
    s56.hub.coreLevel === 6 && s56.rewards.length === 1 && s56.rewards[0].level === 6 && s56.rewards[0].coins === 400 && /pryzmat/.test(s56.gear) && s56.stored.coreLevel === 6 && s56.lvlTag === 'LVL 6' && s56.lvlTagShown, JSON.stringify(s56)));
  const s67 = await step(6, 95);
  out.push(report('6 -> 7: the next 100% builds Drugi brzeg LVL 7 -- the same +100 coins + 10 prisms premium as before CITY-2, no cosmetic, no earlier reward again; the result names the new stage',
    s67.hub.coreLevel === 7 && s67.rewards.length === 1 && s67.rewards[0].level === 7 && s67.rewards[0].coins === 100 && s67.rewards[0].label === '+100 monet + 10 pryzmatów' && s67.gearSame && s67.prisms >= 10 && s67.coins >= 100
    && s67.lvlTag === 'LVL 7' && s67.lvlTagShown && /Przyczółek mostu/.test(s67.stage) && s67.stored.coreLevel === 7, JSON.stringify(s67)));
  const s1112 = await step(11, 95);
  out.push(report('11 -> 12: LVL 12 (the Shore Tower stage), the same premium, nothing else granted',
    s1112.hub.coreLevel === 12 && s1112.rewards.length === 1 && s1112.rewards[0].coins === 100 && s1112.gearSame && s1112.lvlTag === 'LVL 12' && /Wieża Brzegu/.test(s1112.stage), JSON.stringify(s1112)));
  const s12 = await step(12, 95);
  out.push(report('Past 12: a further 100% pays the premium as before (the stored counter goes on, never lower), the result shows no LVL 13 and no new stage',
    s12.hub.coreLevel === 13 && s12.rewards.length === 1 && s12.rewards[0].coins === 100 && s12.gearSame && !s12.lvlTagShown && s12.stage === '', JSON.stringify(s12)));
  const card12 = await g.page.evaluate(async (CARDsrc) => { const gm = window.game; gm.showScreen('mainMenu'); gm.updateCoinDisplays(); await new Promise(r => setTimeout(r, 2500)); return (0, eval)('(' + CARDsrc + ')')(); }, CARD.toString());
  out.push(report('Past 12: Miasto shows LVL 12, Drugi brzeg complete, no LVL 13', card12.lvl === 'LVL 12' && card12.title === 'Drugi brzeg ukończony' && card12.stage === 12, JSON.stringify(card12)));
  // a reload keeps it
  await g.page.evaluate(() => { const gm = window.game; gm.save.hub.coreLevel = 7; gm.save.hub.coreCharge = 31; saveGame(gm.save); });
  await g.page.reload(); await g.page.waitForFunction(READY); await wait(800);
  const re = await g.page.evaluate((CARDsrc) => ({ hub: window.game.save.hub, card: (0, eval)('(' + CARDsrc + ')')() }), CARD.toString());
  out.push(report('A reload keeps the progress exactly (LVL 7, 31%) and opens on Drugi brzeg', re.hub.coreLevel === 7 && re.hub.coreCharge === 31 && re.card.sector === 'shore' && re.card.lvl === 'LVL 7' && re.card.pct === '31%', JSON.stringify(re)));
  out.push(report('Progress: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
  await g.browser.close();
  return out;
}

/* ========================== 3. INDEPENDENCE ========================== */
async function independenceChecks(url) {
  const out = [];
  const g = await open(url, { hub: { coreLevel: 6, coreCharge: 40 } });
  const r = await g.page.evaluate(async () => {
    const gm = window.game, hub = () => JSON.stringify(gm.save.hub);
    const h0 = hub();
    // a campaign mission won
    gm.startCampaignMission('M01'); if (gm.introPending) gm.beginMissionPlay(); if (gm.rafId) cancelAnimationFrame(gm.rafId); gm.running = false;
    gm.mission.elapsed = 30; gm.endCampaignMission(true);
    const afterMission = hub(), done = !!gm.save.campaign.completed.M01;
    // an Arena round left early with points (partial coins only)
    gm.startRound({ seed: 91 }); cancelAnimationFrame(gm.rafId); gm.player.score = 800; gm.leaveRun();
    const afterLeft = hub();
    // switching sectors back and forth
    gm.showScreen('mainMenu');
    const stored = localStorage.getItem('vectorHoleSave_v1');
    for (const v of ['shore', 'center', 'shore', 'center']) { document.getElementById(v === 'shore' ? 'btnSectorShore' : 'btnSectorCenter').click(); await new Promise(r => setTimeout(r, 120)); }
    const afterSwitch = hub(), storedSame = localStorage.getItem('vectorHoleSave_v1') === stored, roadmapOpened = !document.getElementById('infoSheet').classList.contains('hidden');
    return { h0, afterMission, done, afterLeft, afterSwitch, storedSame, roadmapOpened };
  });
  out.push(report('A won campaign mission adds nothing to Core City (LVL 6, 40% stays)', r.done && r.afterMission === r.h0, JSON.stringify(r)));
  out.push(report('A round left early with points adds nothing to Core City', r.afterLeft === r.h0, JSON.stringify(r)));
  out.push(report('Tapping the sector switch changes the view only: progress and the stored save unchanged, the city card\'s roadmap not opened by it', r.afterSwitch === r.h0 && r.storedSame && !r.roadmapOpened, JSON.stringify(r)));
  // a chosen sector stays across a level-up; with no choice, the sector being built opens
  const stay = await g.page.evaluate(async (ROUNDsrc) => {
    const gm = window.game, round = (0, eval)('(' + ROUNDsrc + ')');
    gm.hubSector = null; gm.save.hub.coreLevel = 6; gm.save.hub.coreCharge = 95; gm.showScreen('mainMenu'); gm.updateCoinDisplays();
    const auto0 = gm.hubSectorView();
    await round(501); gm.showScreen('mainMenu'); gm.updateCoinDisplays();
    const auto1 = gm.hubSectorView();
    document.getElementById('btnSectorCenter').click();
    gm.save.hub.coreCharge = 95; await round(502); gm.showScreen('mainMenu'); gm.updateCoinDisplays();
    return { auto0, auto1, chosen: gm.hubSectorView(), level: gm.save.hub.coreLevel };
  }, ROUND.toString());
  out.push(report('No choice made: LVL 6 opens on the Centrum, LVL 7 on Drugi brzeg; a sector the player chose stays in view after the next level-up (no automatic switch)',
    stay.auto0 === 'center' && stay.auto1 === 'shore' && stay.chosen === 'center' && stay.level === 8, JSON.stringify(stay)));
  // keyboard: Enter on a focused switch button is that button's (not GRAJ, not the roadmap)
  const keys = await g.page.evaluate(async () => {
    const gm = window.game; gm.showScreen('mainMenu'); gm.hubSector = 'center'; gm.updateCoinDisplays();
    document.getElementById('hubSectorSwitch').focus(); return gm.state;
  });
  await g.page.keyboard.press('Enter'); await wait(300);
  const k2 = await g.page.evaluate(() => ({ view: window.game.hubSectorView(), state: window.game.state, sheet: !document.getElementById('infoSheet').classList.contains('hidden'), running: !!window.game.running }));
  out.push(report('Enter on the focused sector switch toggles the sector -- it starts no round and opens no roadmap', k2.view === 'shore' && !k2.sheet && !k2.running && k2.state === keys, JSON.stringify(k2)));
  out.push(report('Independence: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
  await g.browser.close();
  return out;
}

/* ============================ 4. SANITIZE ============================ */
async function sanitizeChecks(url) {
  const out = [];
  for (const hub of [{ coreLevel: -3, coreCharge: -5 }, { coreLevel: 'abc', coreCharge: 'x' }, { coreLevel: 7.8, coreCharge: 12.5 }, { coreLevel: null, coreCharge: null }, { coreLevel: 1e9, coreCharge: 50 }, { coreLevel: 12, coreCharge: 250 }]) {
    const g = await open(url, { hub });
    await wait(700);
    const r = await g.page.evaluate((CARDsrc) => ({ hub: window.game.save.hub, card: (0, eval)('(' + CARDsrc + ')')() }), CARD.toString());
    const L = r.hub.coreLevel, lvlN = +r.card.lvl.replace('LVL ', '');
    out.push(report(`Broken hub ${JSON.stringify(hub)}: loads as a whole level >= 1 and a finite charge; the card shows LVL 1-12 and a drawn city; no errors`,
      Number.isInteger(L) && L >= 1 && Number.isFinite(r.hub.coreCharge) && r.hub.coreCharge >= 0 && lvlN >= 1 && lvlN <= 12 && r.card.stage >= 1 && r.card.stage <= 12 && g.errors.length === 0,
      JSON.stringify({ hub: r.hub, lvl: r.card.lvl, stage: r.card.stage, errors: g.errors.slice(0, 2) })));
    await g.browser.close();
  }
  return out;
}

/* =========================== 5. NEW PLAYER =========================== */
async function newPlayerChecks(url) {
  const out = [];
  const g = await open(url, { fresh: true });
  const r = await g.page.evaluate(async (CARDsrc) => {
    const d = defaultSave(), gm = window.game;
    const first = { hub: d.hub, firstRun: document.getElementById('mainMenu').classList.contains('first-run') };
    gm.save.stats.runsPlayed = 1; gm.showScreen('mainMenu'); gm.updateCoinDisplays(); await new Promise(r => setTimeout(r, 600));
    return { first, card: (0, eval)('(' + CARDsrc + ')')() };
  }, CARD.toString());
  out.push(report('A new player starts on the current Centrum at LVL 1 (default save LVL 1 / 0%); Drugi brzeg is locked',
    r.first.hub.coreLevel === 1 && r.first.hub.coreCharge === 0 && r.first.firstRun && r.card.sector === 'center' && r.card.drawn === 'center' && r.card.lvl === 'LVL 1' && r.card.shoreLocked && r.card.stage === 1, JSON.stringify(r)));
  out.push(report('New player: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
  await g.browser.close();
  return out;
}

/* =============================== 6. LOOK =============================== */
function baseRoot() {
  const dir = path.join(OUT, 'city2-base');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['index.html', 'game.js', 'style.css']) fs.writeFileSync(path.join(dir, f), revisionFile(BASE_REV, f));
  return dir;
}
/** Hub canvas frames of the Centrum at fixed times (no easing), plus the roadmap's Centrum thumbnails. */
async function centerFrames(url, w, h) {
  const g = await open(url, { w, h, mobile: w < 600, hub: { coreLevel: 1, coreCharge: 0 } });
  await wait(500);
  const frames = [];
  for (const [L, c] of [[1, 0], [1, 40], [2, 63], [3, 46], [4, 99], [5, 8], [6, 0], [6, 72], [7, 10], [9, 50]]) {
    frames.push(await g.page.evaluate(({ L, c }) => {
      const gm = window.game;
      cancelAnimationFrame(gm.screenAnimRaf); gm.screenAnimRaf = -1;
      gm.save.hub.coreLevel = L; gm.save.hub.coreCharge = c; gm.hubSector = 'center'; gm.updateCoinDisplays();
      const cv = document.getElementById('hubCityCanvas');
      gm.hubCityShown = null; gm.hubCityLastT = 0; gm.hubCityReserveAt = 0; gm.hubCityReveal = null;
      gm.renderHubCity(12.34); gm.hubCityLastT = 12.34; gm.renderHubCity(12.34);
      return `L${L}/${c}: ` + cv.toDataURL();
    }, { L, c }));
  }
  const thumbs = await g.page.evaluate(async () => {
    window.game.openCoreCityRoadmap(); await new Promise(r => setTimeout(r, 100));
    return [...document.querySelectorAll('#infoSheet canvas.info-roadmap-city')].filter(cv => +cv.dataset.cityLevel <= 6).map(cv => 'T' + cv.dataset.cityLevel + ': ' + cv.toDataURL());
  });
  const errors = g.errors.slice();
  await g.browser.close();
  return { frames: frames.concat(thumbs), errors };
}

async function lookChecks(url) {
  const out = [];
  // the Centrum, pixel for pixel, against the base revision
  const base = await serve({ root: baseRoot() });
  for (const [w, h] of [[390, 844], [1280, 720], [375, 667]]) {
    const a = await centerFrames(base.url, w, h), b = await centerFrames(url, w, h);
    const diff = a.frames.map((f, i) => (f === b.frames[i] ? null : f.split(':')[0])).filter(Boolean);
    out.push(report(`Centrum ${w}x${h}: every frame (LVL 1-6 and a finished Centrum seen from LVL 7 / 9) and the LVL 2-6 roadmap thumbnails are pixel-identical to the base revision`, a.frames.length === 15 && b.frames.length === 15 && !diff.length && !b.errors.length, diff.join(', ') || `${b.frames.length} frames`));
  }
  base.server.close();
  // Drugi brzeg: every level a visible change, nothing over the headline, the switch placed well
  for (const [w, h, mobile] of [[390, 844, true], [375, 667, true], [1280, 720, false]]) {
    const g = await open(url, { w, h, mobile, hub: { coreLevel: 6, coreCharge: 0 } });
    await wait(500);
    const r = await g.page.evaluate(async () => {
      const gm = window.game, cv = document.getElementById('hubCityCanvas');
      cancelAnimationFrame(gm.screenAnimRaf); gm.screenAnimRaf = -1;
      const pitch = document.querySelector('#hubHeroStage .hub-city-pitch');
      const levels = [];
      let prev = null;
      for (const L of [6, 7, 8, 9, 10, 11, 12]) {
        gm.save.hub.coreLevel = L; gm.save.hub.coreCharge = 0; gm.hubSector = 'shore'; gm.updateCoinDisplays();
        gm.hubCityShown = null; gm.hubCityLastT = 0; gm.hubCityReserveAt = 0; gm.hubCityReveal = null;
        gm.renderHubCity(7.5); gm.hubCityLastT = 7.5; gm.renderHubCity(7.5);
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let lit = 0; for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 300) lit++;
        // the share of pixels that changed visibly since the level before (same time, same frame)
        let changed = 0; if (prev) for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]) + Math.abs(d[i + 2] - prev[i + 2]) > 90) changed++;
        prev = d;
        levels.push({ L, stage: cv.__skyline.stage, sector: cv.__skyline.sector, lit: lit / (d.length / 16), changed: changed / (d.length / 4), url: cv.toDataURL().length + ':' + cv.toDataURL().slice(200, 260), skyline: cv.__skyline.top, textBottom: pitch.offsetTop + pitch.offsetHeight - cv.offsetTop });
      }
      const R = (el) => el.getBoundingClientRect(), sw = R(document.getElementById('hubSectorSwitch')), p = R(pitch), play = R(document.getElementById('btnStart'));
      const cross = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
      const hit = (el) => { const r = R(el); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!t && (t === el || el.contains(t)); };
      return { levels: levels.map(({ url, ...x }) => x), distinct: new Set(levels.map(l => l.url)).size, switchVsPitch: cross(sw, p), switchVsPlay: cross(sw, play), switchArea: sw.width * sw.height, playArea: play.width * play.height,
        btnsHit: hit(document.getElementById('btnSectorCenter')) && hit(document.getElementById('btnSectorShore')), inView: sw.top >= 0 && sw.bottom <= innerHeight && sw.left >= 0 && sw.right <= innerWidth, sideways: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    const L = r.levels;
    out.push(report(`Drugi brzeg ${w}x${h}: LVL 6 (the empty site) to 12 draw seven different pictures, the stage = the level, the lit share grows at every level, every level changes at least 1% of the picture visibly`,
      r.distinct === 7 && L.every(x => x.sector === 'shore' && x.stage === x.L) && L.every((x, i) => !i || (x.lit > L[i - 1].lit && x.changed >= 0.01)), JSON.stringify(L.map(x => [x.L, x.stage, x.lit.toFixed(4), x.changed.toFixed(4)]))));
    out.push(report(`Drugi brzeg ${w}x${h}: nothing rises over the headline at any level`, L.every(x => x.skyline >= x.textBottom - 2), JSON.stringify(L.map(x => [x.L, Math.round(x.skyline), x.textBottom]))));
    out.push(report(`Switch ${w}x${h}: in view, both buttons tappable, clear of the headline and GRAJ, far smaller than GRAJ; no sideways scroll`,
      r.inView && r.btnsHit && !r.switchVsPitch && !r.switchVsPlay && r.switchArea * 4 < r.playArea && !r.sideways, JSON.stringify({ ...r, levels: undefined })));
    out.push(report(`Look ${w}x${h}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  // the roadmap: LVL 2-12 with a thumbnail each
  const g = await open(url, { hub: { coreLevel: 8, coreCharge: 20 } });
  const road = await g.page.evaluate(async () => {
    window.game.openCoreCityRoadmap(); await new Promise(r => setTimeout(r, 150));
    const rows = [...document.querySelectorAll('#infoSheet .info-roadmap-row')].map(r => { const cv = r.querySelector('canvas'); return { level: r.querySelector('.info-roadmap-level').textContent, cls: r.className, stage: cv && cv.__skyline && cv.__skyline.stage, sector: cv && cv.__skyline && cv.__skyline.sector }; });
    return { rows, body: document.getElementById('infoSheetBody').textContent };
  });
  out.push(report('Roadmap: LVL 2-6 (Centrum) then LVL 7-12 (Drugi brzeg), each with its own city thumbnail; LVL 7-8 done, 9 next with the charge; LVL 8 now',
    road.rows.length === 11 && road.rows.every((x, i) => x.stage === i + 2 && (i + 2 > 6 ? x.sector === 'shore' : !x.sector)) && /done/.test(road.rows[6].cls) && /next/.test(road.rows[7].cls) && /LVL 8 · 20%/.test(road.body) && /Drugi brzeg \(od LVL 6\)/.test(road.body),
    JSON.stringify(road.rows.map(x => [x.level.slice(0, 7), x.stage, x.sector || 'center', x.cls.replace('info-roadmap-row', '').trim()]))));
  out.push(report('Roadmap: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
  await g.browser.close();
  return out;
}

/* ============================== 7. LANG ============================== */
async function langChecks(url) {
  const out = [];
  for (const [hub, view] of [[{ coreLevel: 3, coreCharge: 20 }, 'shore'], [{ coreLevel: 6, coreCharge: 40 }, 'center'], [{ coreLevel: 9, coreCharge: 50 }, 'shore'], [{ coreLevel: 12, coreCharge: 10 }, 'shore']]) {
    const g = await openGame(url, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'en-US', query: '?i18n=log', initScript: frozenDateScript(FROZEN) + QA_RANDOM });
    const s = await veteranSave(g.page, { missions: 29, coins: 1240, runsPlayed: 23 });
    s.hub = hub;
    await g.page.evaluate((v) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(v)), s);
    await g.page.reload(); await g.page.waitForFunction(READY);
    const r = await g.page.evaluate(async (view) => {
      const gm = window.game; gm.setHubSector(view); await new Promise(r => setTimeout(r, 400));
      gm.openCoreCityRoadmap(); await new Promise(r => setTimeout(r, 150));
      const sheet = document.getElementById('infoSheetBody').textContent; gm.closeInfoSheet();
      const card = document.getElementById('hubHeroStage').textContent.replace(/\s+/g, ' ');
      return { lang: I18N.lang, card, sheet, polish: [card, sheet].map(t => (t.match(/[ąćęłńóśźż]|\b(rund\w*|monet\w*|pryzmat\w*|Drugi brzeg|Centrum|odblokuj|ukończon\w*|etap)\b/gi) || [])).flat(), misses: [...I18N.misses].filter(m => /brzeg|Centrum|etap|Przycz|Kwarta|Plac|Fontann|Dominant|Wieża Brzegu|odblokuj/i.test(m)) };
    }, view);
    out.push(report(`English, LVL ${hub.coreLevel} (${view}): the city card and the roadmap are fully English, no untranslated CITY-2 string`, r.lang === 'en' && !r.polish.length && !r.misses.length && /Far Shore|Downtown/.test(r.card),
      JSON.stringify({ polish: r.polish, misses: r.misses, card: r.card.slice(0, 220) })));
    out.push(report(`English, LVL ${hub.coreLevel}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  return out;
}

const SECTIONS = { saves: savesChecks, progress: progressChecks, independence: independenceChecks, sanitize: sanitizeChecks, newplayer: newPlayerChecks, look: lookChecks, lang: langChecks };
export async function runCity2Checks(url, only = null) {
  const out = [];
  for (const [k, fn] of Object.entries(SECTIONS)) if (!only || only.includes(k)) out.push(...await fn(url));
  return out;
}

if (isMain(import.meta.url)) {
  const arg = process.argv.find(a => a.startsWith('--only='));
  const only = arg ? arg.slice(7).split(',') : null;
  const { server, url } = await serve();
  const res = await runCity2Checks(url, only);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} CITY-2 checks passed`);
  process.exit(failed.length ? 1 : 0);
}
