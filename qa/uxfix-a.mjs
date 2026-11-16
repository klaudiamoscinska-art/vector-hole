// UX-FIX-A (GG_UX_AUDIT_1, stage A): the owner's reports 1, 2, 3 and 6 --
// targeted regression checks for the new behaviour, each one exercising the
// real path (a click, a key, the round's own update / draw code). Kinds:
//   DOM -- real Playwright clicks / keys / mouse on the game page;
//   FN  -- the game's own functions on a set scene (no full player path).
//  - D: Dzielnice reads as the second mode, open from the start: the tile's
//    "KAMPANIA · <district>" and its "Drugi tryb" line until the campaign is
//    tried, the intro after 3 rounds says "TRYB 2" (never NOWE / ODBLOKOWANO),
//    the result's line points to Dzielnice once (gone after a visit), a
//    returning player sees none of it, Dzielnice opens from round 1; EN.
//  - K: Sterowanie na Arenie: shown at once in Arena's pause and first in
//    Profil's Ustawienia (reached from the gear), a hint per mode; Mysz
//    ignores WASD / arrows while P / Esc / Enter keep working; a switch, a
//    pause, a resume or lost focus leave nothing steering; missions keep
//    keys + mouse and say the switch is Arena's; a phone has no switch; a
//    touch laptop has both rows and its finger steers in Klawiatura.
//  - R: reward cards: one look = ZAŁÓŻ puts exactly that look on (right tab,
//    marked, scrolled into view, confirmation), the set = POKAŻ W WARSZTACIE
//    (4 pieces marked, nothing put on), a track card has no CTA, Aurora
//    Finału from the real M24 win; nothing granted or paid twice, a second
//    press does nothing, other categories unchanged, SAVE v13.
//  - W: the danger warning starts before the rival's swallow reach for every
//    rival size (the audit's r=200 vs r=420 scene included), in world units
//    (same at 375x667 and 1280x720), no warning while protected or for a
//    waiting / smaller rival, one heartbeat for several rivals, no re-warning
//    lingering at the edge; the rival is marked in the standings and the
//    "points, not size" hint shows once.
// Usage: node qa/uxfix-a.mjs [--only=D,K,R,W]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, isMain, OUT } from './lib.mjs';

const DESK = { viewport: { width: 1280, height: 720 }, mobile: false, deviceScaleFactor: 1 };
const PHONE = { viewport: { width: 375, height: 667 }, mobile: true, deviceScaleFactor: 2 };
const PHONE2 = { viewport: { width: 390, height: 844 }, mobile: true, deviceScaleFactor: 2 };
const SHOTS = path.join(OUT, 'uxfix-a');

async function seeded(url, opts, build) {
  const g = await openGame(url, opts);
  const save = await veteranSave(g.page, { runsPlayed: 6 });
  const s = build ? await g.page.evaluate(build, save) : save;
  await g.page.evaluate((x) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(x)), s);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state === GameState.MENU);
  return g;
}
/** A player who never opened Dzielnice: `runs` finished Arena rounds, the Arena unlocks they earned announced. */
async function freshSave(url, opts, runs, extra = {}) {
  const g = await openGame(url, opts);
  const s = await g.page.evaluate(([runs, extra]) => {
    const s = defaultSave();
    s.stats.runsPlayed = runs;
    s.stats.recentArenaScores = Array.from({ length: Math.min(5, runs) }, () => 3000);
    s.unlocks.announced = [runs >= 2 ? 'warsztat' : null, runs >= 3 ? 'wyzwania' : null].filter(Boolean).concat(extra.announced || []);
    s.login.lastClaimDate = new Date().toISOString().slice(0, 10);
    s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
    s.coach = { moved: true, ate: true, rival: true, danger: true };
    (extra.completed || []).forEach(id => { s.campaign.completed[id] = true; });
    return s;
  }, [runs, extra]);
  await g.page.evaluate((x) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(x)), s);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state === GameState.MENU);
  await g.page.waitForTimeout(300);
  return g;
}
const tile = (p) => p.evaluate(async () => {
  const gm = window.game; gm.showScreen('mainMenu');
  await new Promise(r => setTimeout(r, 120)); // the EN layer translates on the next tick
  const el = document.getElementById('hubCampaignTile'), nav = document.getElementById('btnNavDzielnice');
  return {
    e: document.getElementById('hubCampaignEyebrow').textContent, t: document.getElementById('hubCampaignTitle').textContent, s: document.getElementById('hubCampaignSub').textContent,
    intro: el.classList.contains('is-intro'), tag: getComputedStyle(el, '::after').content,
    navLocked: nav.classList.contains('locked'), navMode: nav.classList.contains('is-mode'), navNew: nav.classList.contains('is-new'),
    navTag: getComputedStyle(nav.querySelector('.nav-tab-icon'), '::after').content, overlay: !document.getElementById('unlockOverlay').classList.contains('hidden')
  };
});
/** FN: an Arena round ended at once (endRound(): the real result screen and its next-round line). */
const endRoundNow = (p) => p.evaluate(async () => {
  const gm = window.game;
  gm.startRound({ seed: 4242 }); cancelAnimationFrame(gm.rafId); gm.running = false; gm.player.score = 900; gm.endRound();
  await new Promise(r => setTimeout(r, 300));
  const line = document.getElementById('resultNextLine');
  const overlayTitle = !document.getElementById('unlockOverlay').classList.contains('hidden') ? document.getElementById('unlockTitle').textContent : null;
  return { shown: !line.classList.contains('hidden'), hook: line.dataset.hook, kicker: document.getElementById('resultNextKicker').textContent, text: document.getElementById('resultNextText').textContent, overlayTitle };
});

/* ============================ D: Dzielnice ============================ */
async function districtChecks(url) {
  const out = [];
  for (const [vp, opts] of [['375x667', PHONE], ['1280x720', DESK]]) {
    const g = await freshSave(url, opts, 1);
    const t1 = await tile(g.page);
    out.push(report(`D1 DOM ${vp}: after round 1 the tile says KAMPANIA · PLAC NEONÓW, M01 and "Drugi tryb: misje z celami · otwarty"; Dzielnice tab open (no lock, no NOWE)`,
      t1.e === 'KAMPANIA · PLAC NEONÓW' && /^M01 · /.test(t1.t) && t1.s === 'Drugi tryb: misje z celami · otwarty' && !t1.intro && !t1.navLocked && !t1.navNew, JSON.stringify(t1)));
    await g.page.click('#btnNavDzielnice');
    await g.page.waitForTimeout(250);
    const open1 = await g.page.evaluate(() => ({ screen: !document.getElementById('campaignScreen').classList.contains('hidden'), plac: window.game.save.campaign.unlockedDistricts.includes('plac'), runs: window.game.save.stats.runsPlayed }));
    out.push(report(`D1 DOM ${vp}: Dzielnice opens from round 1 (a real tap), Plac Neonów playable, Arena rounds unchanged`, open1.screen && open1.plac && open1.runs === 1, JSON.stringify(open1)));
    if (vp === '375x667') await g.page.evaluate(() => window.game.showScreen('mainMenu')).then(() => g.page.waitForTimeout(150)).then(() => g.page.screenshot({ path: path.join(SHOTS, 'd-miasto-po-1-rundzie-po-wizycie.png') }));
    out.push(report(`D1 ${vp}: no page errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  // After round 1 on a fresh player who did NOT visit -- screenshot for the report.
  {
    const g = await freshSave(url, PHONE, 1);
    await tile(g.page); await g.page.waitForTimeout(200);
    await g.page.screenshot({ path: path.join(SHOTS, 'd-miasto-po-1-rundzie.png') });
    await g.browser.close();
  }
  // Round 3: the intro -- second mode, TRYB 2, never NOWE/ODBLOKOWANO; the result line points there once.
  {
    const g = await freshSave(url, PHONE, 3);
    const t3 = await tile(g.page);
    // The Dzielnice line takes an otherwise empty slot: no Core City reward within 2 rounds.
    await g.page.evaluate(() => { const s = window.game.save; s.hub.coreLevel = 3; s.hub.coreCharge = 0; saveGame(s); });
    await g.page.waitForTimeout(200);
    await g.page.screenshot({ path: path.join(SHOTS, 'd-miasto-po-3-rundzie.png') });
    out.push(report('D2 DOM: after round 3 the tile presents DRUGI TRYB · OTWARTY / Kampania: 240 misji / "12 dzielnic · otwarte od początku", tag TRYB 2 (not NOWE); the tab says TRYB 2; no popup',
      t3.intro && t3.e === 'DRUGI TRYB · OTWARTY' && t3.t === 'Kampania: 240 misji' && t3.s === '12 dzielnic · otwarte od początku' && t3.tag === '"TRYB 2"' && t3.navMode && t3.navTag === '"TRYB 2"' && !t3.overlay, JSON.stringify(t3)));
    const r4 = await endRoundNow(g.page);
    out.push(report('D3 FN+DOM: the next Arena result (round 4, never visited, no near Core City reward) says DRUGI TRYB · OTWARTY · "Dzielnice: 240 misji z celami · wejdź z Miasta"; no ODBLOKOWANO card for the campaign',
      r4.shown && r4.hook === 'kampania' && r4.kicker === 'DRUGI TRYB · OTWARTY' && r4.text === 'Dzielnice: 240 misji z celami · wejdź z Miasta' && r4.overlayTitle !== 'KAMPANIA', JSON.stringify(r4)));
    await g.page.evaluate(() => { const gm = window.game; gm.unlockQueue = []; clearTimeout(gm.unlockShowTimer); document.getElementById('unlockOverlay').classList.add('hidden'); gm.state = GameState.MENU; gm.showScreen('mainMenu'); });
    await g.page.click('#btnNavDzielnice');
    await g.page.waitForTimeout(250);
    const t5 = await tile(g.page);
    const r5 = await endRoundNow(g.page);
    out.push(report('D4 DOM+FN: one visit to Dzielnice ends it for good -- the tile shows the mission goal (no "Drugi tryb" line, no TRYB 2), the result line no longer points to Dzielnice',
      !t5.intro && !t5.navMode && t5.e === 'KAMPANIA · PLAC NEONÓW' && t5.s !== 'Drugi tryb: misje z celami · otwarty' && !(r5.shown && r5.hook === 'kampania'), JSON.stringify({ t5, r5 })));
    const sv = await g.page.evaluate(() => ({ schema: JSON.parse(localStorage.getItem('vectorHoleSave_v1')).schemaVersion, announced: window.game.save.unlocks.announced }));
    out.push(report('D4 the visit is the existing "kampania" mark (no new save field); SAVE v13', sv.schema === 13 && sv.announced.includes('kampania'), JSON.stringify(sv)));
    out.push(report('D2-D4 no page errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  // Returning players: campaign known (a cleared mission / an old announce) -> none of it.
  {
    const g = await freshSave(url, PHONE, 5, { announced: ['kampania'], completed: ['M01'] });
    const t = await tile(g.page);
    const r = await endRoundNow(g.page);
    out.push(report('D5 DOM+FN: a returning player (campaign known) sees KAMPANIA · district + the mission goal, no intro, no TRYB 2, no Dzielnice line',
      t.e === 'KAMPANIA · PLAC NEONÓW' && /^M02 · /.test(t.t) && !t.intro && !t.navMode && t.s !== 'Drugi tryb: misje z celami · otwarty' && !(r.shown && r.hook === 'kampania'), JSON.stringify({ t, r })));
    await g.browser.close();
  }
  // English.
  {
    const g = await freshSave(url, { ...PHONE2, locale: 'en-US' }, 3);
    const t = await tile(g.page);
    const r = await endRoundNow(g.page);
    const g1 = await freshSave(url, { ...PHONE2, locale: 'en-US' }, 1);
    const t1 = await tile(g1.page);
    out.push(report('D6 EN: CAMPAIGN · NEON SQUARE / "Second mode: missions with goals · open"; SECOND MODE · OPEN, MODE 2; result "Districts: 240 missions with goals · enter from the City"',
      t1.e === 'CAMPAIGN · NEON SQUARE' && t1.s === 'Second mode: missions with goals · open' && t.e === 'SECOND MODE · OPEN' && t.s === '12 districts · open from the start' && t.tag === '"MODE 2"' && t.navTag === '"MODE 2"' && r.kicker === 'SECOND MODE · OPEN' && r.text === 'Districts: 240 missions with goals · enter from the City',
      JSON.stringify({ t1: [t1.e, t1.s], t: [t.e, t.s, t.tag, t.navTag], r: [r.kicker, r.text] })));
    await g.browser.close(); await g1.browser.close();
  }
  return out;
}

/* ============================ K: controls ============================ */
const st = (page) => page.evaluate(() => {
  const gm = window.game, pl = gm.player || { x: 0, y: 0 };
  return { x: +pl.x.toFixed(2), y: +pl.y.toFixed(2), kx: gm.keyDir.x, ky: gm.keyDir.y, ptr: gm.pointerScreen, running: gm.running, paused: gm.paused, mode: gm.save.settings.deskControls };
});
const moved = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const calm = (page) => page.evaluate(() => { const gm = window.game; gm.player.invulnerableUntil = Infinity; gm.checkEvolutionTriggers = () => {}; gm.checkOverdriveTrigger = () => {}; });
const vis = (page, id) => page.evaluate((id) => { const el = document.getElementById(id); return !!el && !el.classList.contains('hidden') && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none'; }, id);

async function controlChecks(url) {
  const out = [];
  {
    const g = await seeded(url, DESK);
    const p = g.page;
    // Profil from the gear: the switch is the first row of Ustawienia, a hint under it.
    await p.click('#btnProfile');
    await p.waitForTimeout(250);
    const prof = await p.evaluate(() => {
      const row = document.getElementById('profileDeskControlsRow'), block = row.closest('.settings-block');
      const rows = [...block.querySelectorAll('.control-row')].filter(r => r.getClientRects().length);
      const r = row.getBoundingClientRect();
      return { first: rows[0] === row, label: row.querySelector('.control-label').textContent, hint: document.getElementById('profileDeskControlsHint').textContent, top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, scroller: (() => { const sc = row.closest('.screen-inner') || row.closest('.screen'); return sc ? sc.scrollTop : 0; })() };
    });
    await p.screenshot({ path: path.join(SHOTS, 'k-profil-1280x720.png') });
    out.push(report('K1 DOM: gear -> Profil: "Sterowanie na Arenie" is the first row of Ustawienia, with the Mysz hint', prof.first && prof.label === 'Sterowanie na Arenie' && prof.hint === 'Mysz: wir jedzie za kursorem. Klawisze ruchu nie sterują.', JSON.stringify(prof)));
    out.push(report('K1 DOM 1280x720: the switch is on screen without scrolling (was ~480 px below the fold)', prof.bottom <= prof.vh && prof.top >= 0, JSON.stringify(prof)));
    await p.click('#profileDeskControlsRow [data-desk-controls="keyboard"]');
    const kh = await p.evaluate(() => document.getElementById('profileDeskControlsHint').textContent);
    await p.click('#profileDeskControlsRow [data-desk-controls="mouse"]');
    out.push(report('K1 DOM: the hint follows the mode (Klawiatura -> WASD / strzałki, mysz nie porusza)', kh === 'Klawiatura: steruj WASD albo strzałkami. Mysz nie porusza wirem.', kh));
    await p.click('#btnProfileBack').catch(() => {});
    await p.evaluate(() => window.game.showScreen('mainMenu'));
    // Mysz: Enter starts, WASD / arrows steer nothing, P pauses, the switch is shown at once.
    await p.mouse.move(640, 700);
    await p.keyboard.press('Enter');
    await p.waitForFunction(() => window.game.running, null, { timeout: 5000 });
    await calm(p);
    await p.evaluate(() => { window.game.pointerScreen = null; });
    await p.waitForTimeout(150);
    const k0 = await st(p);
    for (const key of ['KeyD', 'ArrowRight', 'KeyS', 'ArrowUp']) { await p.keyboard.down(key); await p.waitForTimeout(220); await p.keyboard.up(key); }
    const k1 = await st(p);
    out.push(report('K2 DOM Mysz: Enter started the round; WASD and arrows held 0.9 s in all move the vortex by 0 (no key direction taken)', k0.running && moved(k0, k1) < 0.5 && k1.kx === 0 && k1.ky === 0, JSON.stringify({ k0, k1 })));
    await p.mouse.move(1150, 360, { steps: 5 });
    await p.waitForTimeout(400);
    const k2 = await st(p);
    out.push(report('K2 DOM Mysz: the cursor steers', k2.x - k1.x > 15, JSON.stringify({ k1, k2 })));
    await p.keyboard.press('KeyP');
    await p.waitForTimeout(150);
    const pz = await p.evaluate(() => ({ paused: window.game.paused, row: (() => { const r = document.getElementById('deskControlsRow'); return !r.classList.contains('hidden') && r.getClientRects().length > 0; })(),
      panelHidden: document.getElementById('controlsPanel').classList.contains('hidden'), label: document.querySelector('#deskControlsRow .control-label').textContent, hint: document.getElementById('deskControlsHint').textContent,
      fits: (() => { const r = document.getElementById('deskControlsRow').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; })() }));
    await p.screenshot({ path: path.join(SHOTS, 'k-pauza-areny-1280x720.png') });
    out.push(report('K3 DOM: P pauses (Mysz); the pause shows "Sterowanie na Arenie" at once (STEROWANIE not opened) with the Mysz hint, on screen', pz.paused && pz.row && pz.panelHidden && pz.label === 'Sterowanie na Arenie' && pz.hint === 'Mysz: wir jedzie za kursorem. Klawisze ruchu nie sterują.' && pz.fits, JSON.stringify(pz)));
    // A key held across a switch to Klawiatura, then resume: nothing drives.
    await p.keyboard.down('KeyA');
    await p.click('#deskControlsRow [data-desk-controls="keyboard"]');
    const sw = await st(p);
    await p.keyboard.up('KeyA');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(150);
    const a0 = await st(p);
    await p.mouse.move(100, 100, { steps: 4 });
    await p.waitForTimeout(400);
    const a1 = await st(p);
    out.push(report('K4 DOM: switch to Klawiatura with A held, Esc resumes: no drift (cursor ignored, no stale key); the hint follows', sw.mode === 'keyboard' && sw.kx === 0 && !a0.paused && moved(a0, a1) < 0.5, JSON.stringify({ sw, a0, a1 })));
    await p.keyboard.down('KeyD'); await p.waitForTimeout(300); await p.keyboard.up('KeyD');
    const a2 = await st(p);
    out.push(report('K4 DOM Klawiatura: D steers right, a release stops', a2.x - a1.x > 10 && a2.kx === 0, JSON.stringify({ a1, a2 })));
    // Blur with a key held -> pause, nothing held.
    await p.keyboard.down('ArrowUp');
    await p.evaluate(() => window.dispatchEvent(new Event('blur')));
    const b1 = await st(p);
    await p.keyboard.up('ArrowUp');
    out.push(report('K4 DOM: lost focus with a key held pauses and releases it', b1.paused && b1.ky === 0 && b1.ptr === null, JSON.stringify(b1)));
    await p.click('#deskControlsRow [data-desk-controls="mouse"]');
    await p.click('#btnResume');
    await p.waitForTimeout(150);
    const r0 = await st(p);
    await p.waitForTimeout(400);
    const r1 = await st(p);
    out.push(report('K4 DOM: back to Mysz and resume -- nothing steers until the mouse moves', !r0.paused && r0.mode === 'mouse' && moved(r0, r1) < 0.5, JSON.stringify({ r0, r1 })));
    // UI keys still work in Mysz: Space pauses, Esc resumes; Tab moves focus between pause buttons.
    await p.keyboard.press('Space');
    await p.waitForTimeout(100);
    const sp = await p.evaluate(() => window.game.paused);
    await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
    const foc = await p.evaluate(() => { const a = document.activeElement; return a && a.closest && !!a.closest('#pauseSheet'); });
    await p.keyboard.press('Escape');
    await p.waitForTimeout(100);
    const es = await p.evaluate(() => window.game.paused);
    out.push(report('K5 DOM Mysz: UI keys still work -- Space pauses, Tab moves focus inside the pause sheet, Esc resumes', sp && foc && !es, JSON.stringify({ sp, foc, es })));
    // Missions: keys steer (unchanged), the pause says the switch is Arena's.
    await p.evaluate(() => { const gm = window.game; gm.stopRun && gm.stopRun(); gm.running = false; gm.startCampaignMission('M01'); if (gm.introPending) gm.beginMissionPlay(); gm.player.invulnerableUntil = Infinity; gm.pointerScreen = null; });
    await p.waitForTimeout(200);
    const m0 = await st(p);
    await p.keyboard.down('ArrowRight'); await p.waitForTimeout(350); await p.keyboard.up('ArrowRight');
    const m1 = await st(p);
    await p.keyboard.press('KeyP');
    await p.waitForTimeout(120);
    const mp = await p.evaluate(() => ({ row: !document.getElementById('deskControlsRow').classList.contains('hidden'), noteHidden: document.getElementById('missionControlsNote').classList.contains('hidden') }));
    await p.click('#btnControls');
    const mp2 = await p.evaluate(() => ({ note: (() => { const n = document.getElementById('missionControlsNote'); return !n.classList.contains('hidden') && n.getClientRects().length > 0 ? n.textContent : null; })() }));
    await p.screenshot({ path: path.join(SHOTS, 'k-pauza-misji-1280x720.png') });
    out.push(report('K6 DOM mission (saved Mysz): the arrow keys still steer (missions keep keys + mouse); the pause has no Arena switch and its STEROWANIE says the choice is Arena\'s',
      m1.x - m0.x > 10 && !mp.row && mp2.note === 'W misjach sterujesz myszą albo klawiszami. Wybór Mysz / Klawiatura dotyczy Areny.', JSON.stringify({ m0, m1, mp, mp2 })));
    out.push(report('K no page errors (desktop)', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  // Phone: no desktop choice anywhere.
  {
    const g = await seeded(url, PHONE);
    const p = g.page;
    await p.evaluate(() => { const gm = window.game; gm.startRound({ seed: 5 }); gm.pauseGame(); });
    const r = await p.evaluate(() => ({ row: !document.getElementById('deskControlsRow').classList.contains('hidden'), hint: !document.getElementById('deskControlsHint').classList.contains('hidden') }));
    await p.evaluate(() => { const gm = window.game; gm.resumeGame(); gm.stopRun && gm.stopRun(); gm.running = false; gm.openProfileScreen(); });
    const pr = await p.evaluate(() => ({ row: !document.getElementById('profileDeskControlsRow').classList.contains('hidden'), hint: !document.getElementById('profileDeskControlsHint').classList.contains('hidden') }));
    out.push(report('K7 DOM 375x667 phone: no Mysz / Klawiatura in the pause or in Profil', !r.row && !r.hint && !pr.row && !pr.hint, JSON.stringify({ r, pr })));
    await g.browser.close();
  }
  // Touch laptop (mouse + touch screen): both rows; a finger steers even in Klawiatura.
  {
    const g = await seeded(url, { viewport: { width: 1280, height: 720 }, mobile: false, deviceScaleFactor: 1 }, (s) => { s.settings.deskControls = 'keyboard'; return s; });
    const p = g.page;
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    // Chromium's touch emulation also reports a coarse pointer; a touch laptop
    // has its trackpad too, so the media query answers as on such a device.
    await p.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/any-pointer: fine/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q)); });
    await p.reload();
    await p.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state === GameState.MENU);
    await p.evaluate(() => { const gm = window.game; gm.startRound({ seed: 9 }); gm.player.invulnerableUntil = Infinity; gm.checkEvolutionTriggers = () => {}; gm.pauseGame(); });
    const rows = await p.evaluate(() => ({ desk: !document.getElementById('deskControlsRow').classList.contains('hidden'), touch: !document.getElementById('inputModeRow').classList.contains('hidden'), hasDesk: window.game.hasDeskPointer, touchDev: window.game.isTouchDevice }));
    await p.evaluate(() => window.game.resumeGame());
    const t0 = await st(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 640, y: 360 }] });
    for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 640 + i * 80, y: 360 }] }); await p.waitForTimeout(60); }
    await p.waitForTimeout(300);
    const t1 = await st(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    out.push(report('K8 DOM touch laptop: the pause shows both the touch mode and Mysz / Klawiatura; in Klawiatura a finger still steers', rows.desk && rows.touch && rows.touchDev && t1.x - t0.x > 10, JSON.stringify({ rows, t0, t1 })));
    await g.browser.close();
  }
  return out;
}

/* ============================ R: reward cards ============================ */
async function rewardChecks(url) {
  const out = [];
  const CASES = [
    { lvl: 2, cat: 'aura', id: 'impuls', tab: 'tabAuras', grid: 'auraGrid' },
    { lvl: 3, cat: 'skin', id: 'krysztal', tab: 'tabSkins', grid: 'skinGrid' },
    { lvl: 4, cat: 'effect', id: 'pixel_burst', tab: 'tabEffects', grid: 'effectGrid' },
    { lvl: 5, cat: 'overdriveSkin', id: 'fala', tab: 'tabOverdrive', grid: 'overdriveSkinGrid' }
  ];
  for (const [vp, opts] of [['375x667', PHONE], ['1280x720', DESK]]) {
    const g = await seeded(url, opts);
    const p = g.page;
    for (const c of CASES) {
      // A different tab was used before (the audit's EFEKT case) -- the reward still opens on its own.
      const r = await p.evaluate(async (c) => {
        const gm = window.game, s = gm.save;
        gm.openWarsztatScreen(); document.getElementById(c.tab === 'tabEffects' ? 'tabOverdrive' : 'tabEffects').click(); gm.showScreen('mainMenu');
        const before = { selected: s.selected, aura: s.auras.selected, effect: s.effects.selected, od: s.overdriveSkins.selected };
        gm.grantCoreCityLevelReward(c.lvl); saveGame(s);
        const coins = s.coins, owned = JSON.stringify([s.owned, s.auras.owned, s.effects.owned, s.overdriveSkins.owned]);
        gm.queueUnlockCelebrations({ delay: 0 });
        await new Promise(r => setTimeout(r, 200));
        return { before, coins, owned, cta: document.getElementById('btnUnlockGo').textContent, ctaShown: !document.getElementById('btnUnlockGo').classList.contains('hidden') };
      }, c);
      await p.click('#btnUnlockGo');
      await p.waitForTimeout(500);
      const a = await p.evaluate((c) => {
        const gm = window.game, s = gm.save;
        const card = document.querySelector(`#${c.grid} .skin-card[data-item="${c.id}"]`);
        const rc = card ? card.getBoundingClientRect() : null;
        const worn = { skin: s.selected, aura: s.auras.selected, effect: s.effects.selected, overdriveSkin: s.overdriveSkins.selected };
        return { screen: !document.getElementById('shopScreen').classList.contains('hidden'), tab: document.getElementById(c.tab).classList.contains('active'), gridShown: !document.getElementById(c.grid).classList.contains('hidden'),
          marked: !!card && card.classList.contains('is-reward-new'), inView: !!rc && rc.top >= 0 && rc.bottom <= innerHeight, worn, coins: s.coins, owned: JSON.stringify([s.owned, s.auras.owned, s.effects.owned, s.overdriveSkins.owned]),
          note: document.getElementById('warsztatHint').textContent, pageScroll: window.scrollY + document.documentElement.scrollTop + document.body.scrollTop + document.getElementById('app').scrollTop, stored: JSON.parse(localStorage.getItem('vectorHoleSave_v1')), schema: JSON.parse(localStorage.getItem('vectorHoleSave_v1')).schemaVersion };
      }, c);
      if (c.lvl === 2) await p.screenshot({ path: path.join(SHOTS, `r-zaloz-smuga-${vp}.png`) });
      const r0 = r.before;
      const others = { skin: r0.selected, aura: r0.aura, effect: r0.effect, overdriveSkin: r0.od };
      const othersSame = Object.keys(others).every(k => k === c.cat || a.worn[k] === others[k]);
      const storedWorn = { skin: a.stored.selected, aura: a.stored.auras.selected, effect: a.stored.effects.selected, overdriveSkin: a.stored.overdriveSkins.selected }[c.cat];
      out.push(report(`R1 DOM ${vp} LVL ${c.lvl} (${c.cat} ${c.id}): ZAŁÓŻ opens its tab (not the last one used), marks and shows its card, puts exactly it on and says so; other categories unchanged`,
        r.ctaShown && r.cta === 'ZAŁÓŻ' && a.screen && a.tab && a.gridShown && a.marked && a.inView && a.worn[c.cat] === c.id && storedWorn === c.id && othersSame && /^Założono: /.test(a.note) && a.pageScroll === 0,
        JSON.stringify({ cta: r.cta, tab: a.tab, marked: a.marked, inView: a.inView, worn: a.worn, others, note: a.note, pageScroll: a.pageScroll })));
      out.push(report(`R1 ${vp} LVL ${c.lvl}: nothing granted or paid twice by the CTA (coins, owned lists), SAVE v13`, a.coins === r.coins && a.owned === r.owned && a.schema === 13, JSON.stringify({ c0: r.coins, c1: a.coins })));
      // A second press (stale) does nothing.
      const again = await p.evaluate(() => { const gm = window.game, s = JSON.stringify(gm.save); gm.onUnlockGo(); return JSON.stringify(gm.save) === s; });
      out.push(report(`R1 ${vp} LVL ${c.lvl}: a second press does nothing`, again, String(again)));
    }
    // LVL 6 set: POKAŻ W WARSZTACIE, four pieces marked, nothing put on.
    const b = await p.evaluate(async () => {
      const gm = window.game, s = gm.save; gm.showScreen('mainMenu');
      const worn0 = JSON.stringify([s.selected, s.auras.selected, s.effects.selected, s.overdriveSkins.selected]);
      gm.grantCoreCityLevelReward(6); saveGame(s);
      const coins = s.coins;
      gm.queueUnlockCelebrations({ delay: 0 });
      await new Promise(r => setTimeout(r, 200));
      return { worn0, coins, cta: document.getElementById('btnUnlockGo').textContent };
    });
    await p.click('#btnUnlockGo');
    await p.waitForTimeout(500);
    const b1 = await p.evaluate(() => {
      const gm = window.game, s = gm.save;
      const marked = [...document.querySelectorAll('#shopScreen .skin-card.is-reward-new')].map(c => c.closest('.skin-grid').id + ':' + c.dataset.item);
      const dots = ['tabSkins', 'tabAuras', 'tabEffects', 'tabOverdrive'].filter(t => document.getElementById(t).classList.contains('has-reward'));
      const card = document.querySelector('#skinGrid .skin-card[data-item="pryzmat"]'), rc = card && card.getBoundingClientRect();
      return { marked, dots, worn: JSON.stringify([s.selected, s.auras.selected, s.effects.selected, s.overdriveSkins.selected]), coins: s.coins, inView: !!rc && rc.top >= 0 && rc.bottom <= innerHeight, tab: document.getElementById('tabSkins').classList.contains('active'), note: document.getElementById('warsztatHint').textContent };
    });
    await p.screenshot({ path: path.join(SHOTS, `r-zestaw-pryzmat-${vp}.png`) });
    out.push(report(`R2 DOM ${vp} LVL 6 set: POKAŻ W WARSZTACIE shows its 4 pieces marked (4 tabs dotted, the vortex in view), puts nothing on, pays nothing`,
      b.cta === 'POKAŻ W WARSZTACIE' && b1.marked.length === 4 && ['skinGrid:pryzmat', 'auraGrid:pryzmat', 'effectGrid:pryzmat', 'overdriveSkinGrid:pryzmat'].every(m => b1.marked.includes(m)) && b1.dots.length === 4 && b1.worn === b.worn0 && b1.coins === b.coins && b1.inView && b1.tab,
      JSON.stringify({ cta: b.cta, b1 })));
    // A tapped set piece goes on through the normal path (only its category).
    await p.click('#auraGrid .skin-card[data-item="pryzmat"]').catch(async () => { await p.click('#tabAuras'); await p.click('#auraGrid .skin-card[data-item="pryzmat"]'); });
    const b2 = await p.evaluate(() => ({ aura: window.game.save.auras.selected, skin: window.game.save.selected }));
    out.push(report(`R2 DOM ${vp}: a tap on a marked set piece puts on that piece only`, b2.aura === 'pryzmat' && b2.skin !== 'pryzmat', JSON.stringify(b2)));
    // Opening Warsztat normally clears the marks.
    const clr = await p.evaluate(() => { const gm = window.game; gm.showScreen('mainMenu'); gm.openWarsztatScreen(); return document.querySelectorAll('#shopScreen .skin-card.is-reward-new').length + document.querySelectorAll('#shopScreen .has-reward').length; });
    out.push(report(`R2 ${vp}: Warsztat opened from the nav has no reward marks`, clr === 0, String(clr)));
    out.push(report(`R ${vp}: no page errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  // Aurora Finału from the real M24 win; a track card has no CTA.
  {
    const g = await seeded(url, PHONE, (s) => { DISTRICTS[0].missions.concat(DISTRICTS[1].missions).forEach(id => { s.campaign.completed[id] = true; }); ['park', 'port'].forEach(d => { if (!s.campaign.unlockedDistricts.includes(d)) s.campaign.unlockedDistricts.push(d); }); delete s.campaign.completed.M24; return s; });
    const p = g.page;
    const r = await p.evaluate(async () => {
      const gm = window.game, s = gm.save;
      const worn0 = [s.auras.selected, s.effects.selected, s.overdriveSkins.selected].join();
      gm.startCampaignMission('M24'); if (gm.introPending) gm.beginMissionPlay(); if (gm.rafId) cancelAnimationFrame(gm.rafId); gm.running = false;
      gm.mission.elapsed = 30; gm.endCampaignMission(true);
      clearTimeout(gm.unlockShowTimer);
      const seen = [];
      gm.showNextUnlock();
      for (let i = 0; i < 8 && gm.currentUnlock; i++) {
        const it = gm.currentUnlock;
        seen.push({ title: it.title, cta: document.getElementById('btnUnlockGo').classList.contains('hidden') ? null : document.getElementById('btnUnlockGo').textContent });
        if (/Aurora/.test(it.title)) break;
        gm.currentUnlock = null; gm.showNextUnlock();
      }
      const coins = s.coins, owned = s.owned.filter(x => x === 'aurora').length;
      return { seen, coins, owned, worn0 };
    });
    const aur = r.seen.find(x => /Aurora/.test(x.title));
    const track = r.seen.find(x => /^„/.test(x.title));
    await p.click('#btnUnlockGo');
    await p.waitForTimeout(500);
    const a = await p.evaluate(() => { const gm = window.game, s = gm.save; const card = document.querySelector('#skinGrid .skin-card[data-item="aurora"]'); const rc = card && card.getBoundingClientRect();
      return { skin: s.selected, coins: s.coins, owned: s.owned.filter(x => x === 'aurora').length, tab: document.getElementById('tabSkins').classList.contains('active'), marked: !!card && card.classList.contains('is-reward-new'), inView: !!rc && rc.top >= 0 && rc.bottom <= innerHeight, worn: [s.auras.selected, s.effects.selected, s.overdriveSkins.selected].join() }; });
    out.push(report('R3 DOM+FN: the real M24 win queues "Aurora Finału" with ZAŁÓŻ; the press puts the aurora vortex on (Wir tab, marked, in view), owned once, coins unchanged, other categories unchanged',
      !!aur && aur.cta === 'ZAŁÓŻ' && a.skin === 'aurora' && a.owned === 1 && r.owned === 1 && a.coins === r.coins && a.tab && a.marked && a.inView && a.worn === r.worn0, JSON.stringify({ seen: r.seen, a })));
    out.push(report('R3 a reward without a look (the district\'s new track) has no CTA (it said ZAŁÓŻ W WARSZTACIE)', !track || track.cta === null, JSON.stringify(track || 'no track card in this run')));
    out.push(report('R3 no page errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  // EN copy.
  {
    const g = await seeded(url, { ...PHONE2, locale: 'en-US' });
    const r = await g.page.evaluate(async () => {
      const gm = window.game;
      gm.grantCoreCityLevelReward(2); gm.queueUnlockCelebrations({ delay: 0 }); await new Promise(r => setTimeout(r, 200));
      const one = document.getElementById('btnUnlockGo').textContent; document.getElementById('btnUnlockGo').click(); await new Promise(r => setTimeout(r, 300));
      const note1 = document.getElementById('warsztatHint').textContent; gm.showScreen('mainMenu');
      gm.grantCoreCityLevelReward(6); gm.queueUnlockCelebrations({ delay: 0 }); await new Promise(r => setTimeout(r, 200));
      const set = document.getElementById('btnUnlockGo').textContent; document.getElementById('btnUnlockGo').click(); await new Promise(r => setTimeout(r, 300));
      const card = document.querySelector('#skinGrid .skin-card.is-reward-new');
      return { one, note1, set, note2: document.getElementById('warsztatHint').textContent, ribbon: card ? getComputedStyle(card, '::after').content : null };
    });
    out.push(report('R4 EN: EQUIP / "Equipped: Trail “Pulse”…" / SHOW IN WORKSHOP / REWARD ribbon', r.one === 'EQUIP' && /^Equipped: /.test(r.note1) && !/Założono/.test(r.note1) && r.set === 'SHOW IN WORKSHOP' && /REWARD mark/.test(r.note2) && r.ribbon === '"REWARD"', JSON.stringify(r)));
    await g.browser.close();
  }
  return out;
}

/* ============================ W: danger warning ============================ */
async function warningChecks(url) {
  const out = [];
  for (const [vp, opts] of [['1280x720', DESK], ['375x667', PHONE]]) {
    const g = await seeded(url, opts);
    const r = await g.page.evaluate(() => {
      const gm = window.game;
      gm.startRound({ seed: 61 }); cancelAnimationFrame(gm.rafId); gm.running = false;
      let beats = 0; gm.sound.danger = () => { beats++; }; gm.vibrate = () => {};
      const P = gm.player, [bot, ...rest] = gm.bots;
      rest.forEach(b => { b.x = 100; b.y = 100; b.setRadius(15); });
      P.invulnerableUntil = 0; P.invulnerable = false;
      Object.defineProperty(P, 'invulnerable', { get() { return performance.now() < (this.invulnerableUntil || 0); }, configurable: true });
      const approach = (pr, br) => {
        P.setRadius(pr); bot.setRadius(br); P.x = 1500; P.y = 1500; bot.waiting = false;
        gm.dangerWarned.clear(); gm.dangerSoundAt = -1e9; beats = 0;
        let warnAt = null, eatAt = null;
        for (let d = 1400; d >= 0; d -= 4) {
          bot.x = 1500 + d; bot.y = 1500;
          gm.updateDangerWarnings();
          if (warnAt === null && bot.dangerNear) warnAt = d;
          if (eatAt === null && d < bot.radius * 0.75 && bot.radius > P.radius * CONFIG.eating.holeRatio) eatAt = d;
        }
        return { pr, br: Math.round(bot.radius), warnAt, eatAt, lead: warnAt - eatAt, beats };
      };
      const scenes = [[30, 40], [60, 90], [100, 140], [150, 175], [200, 300], [200, 420], [300, 480]].map(([a, b]) => approach(a, b));
      // The audit's own frame: r=200 vs r=420 at 299 -> already inside its reach (315): the warning is on.
      P.setRadius(200); bot.setRadius(420); bot.x = 1500 + 299; gm.dangerWarned.clear(); gm.updateDangerWarnings();
      const audit = { near: bot.dangerNear, reach: Math.round(bot.radius * 0.75) };
      // Old rule for comparison: 260 from centre to centre.
      const oldWarnAt = 260;
      // Smaller / equal rivals and a waiting one: nothing.
      P.setRadius(100); bot.setRadius(110); bot.x = 1560; gm.updateDangerWarnings(); const small = bot.threat;
      bot.setRadius(200); bot.waiting = true; gm.updateDangerWarnings(); const waiting = bot.threat; bot.waiting = false;
      // Protected player: no heartbeat while shielded, one when the shield ends with the rival still close.
      gm.dangerWarned.clear(); gm.dangerSoundAt = -1e9; beats = 0; P.invulnerableUntil = performance.now() + 60000;
      bot.x = 1500 + 200; gm.updateDangerWarnings(); const shielded = beats;
      P.invulnerableUntil = 0; gm.updateDangerWarnings(); const after = beats;
      // Three rivals entering at once: one heartbeat.
      gm.dangerWarned.clear(); gm.dangerSoundAt = -1e9; beats = 0; P.setRadius(80);
      gm.bots.slice(0, 3).forEach((b, i) => { b.setRadius(160); b.waiting = false; b.x = 1500 + 400; b.y = 1500 + (i - 1) * 30; });
      gm.updateDangerWarnings();
      gm.bots.slice(0, 3).forEach(b => { b.x = 1500 + 150; });
      gm.updateDangerWarnings(); const many = beats;
      // Lingering on the edge (in and out by a few units for 10 s): no new heartbeat after the first; leaving rearms.
      gm.bots.slice(1, 3).forEach(b => { b.x = 100; b.y = 100; b.setRadius(15); });
      gm.dangerWarned.clear(); gm.dangerSoundAt = -1e9; beats = 0;
      const t = gm.rivalThreat(bot) || {}; const edge = 1500 + bot.radius * 0.75 + (CONFIG.juice.danger.base + CONFIG.juice.danger.perRadius * bot.radius);
      const realNow = performance.now.bind(performance); let fake = realNow(); performance.now = () => fake;
      for (let i = 0; i < 600; i++) { bot.x = edge + (i % 2 ? 6 : -6); fake += 16.7; gm.updateDangerWarnings(); }
      const linger = beats;
      bot.x = edge + 2000; gm.updateDangerWarnings(); const far = { threat: bot.threat, near: bot.dangerNear };
      fake += 5000; bot.x = edge - 20; gm.updateDangerWarnings(); const rearm = beats;
      performance.now = realNow;
      return { scenes, audit, oldWarnAt, small, waiting, shielded, after, many, linger, far, rearm };
    });
    const allLead = r.scenes.every(s => s.warnAt !== null && s.eatAt !== null && s.lead > 0);
    out.push(report(`W1 FN ${vp}: approaching rivals of r 40-480, the warning starts before their swallow reach every time (lead > 0) -- r 420 / 480 included (the old fixed 260 came after it)`,
      allLead && r.scenes.find(s => s.br === 420).warnAt > 315 && r.scenes.find(s => s.br === 480).warnAt > 360, JSON.stringify(r.scenes.map(s => `${s.pr}v${s.br}: warn@${s.warnAt} eat@${s.eatAt} lead ${s.lead}`))));
    out.push(report(`W1 FN ${vp}: the audit scene (r 200 vs r 420 at 299, already in reach 315) is warned`, r.audit.near, JSON.stringify(r.audit)));
    out.push(report(`W2 FN ${vp}: a rival not bigger than x1.15 and a waiting one are no threat`, !r.small && !r.waiting, JSON.stringify({ small: r.small, waiting: r.waiting })));
    out.push(report(`W3 FN ${vp}: no heartbeat while the respawn shield holds; one once it ends with the rival close`, r.shielded === 0 && r.after === 1, JSON.stringify({ shielded: r.shielded, after: r.after })));
    out.push(report(`W4 FN ${vp}: three rivals closing in together = one heartbeat`, r.many === 1, String(r.many)));
    out.push(report(`W5 FN ${vp}: 10 s on the warning edge = one heartbeat (no blinking re-warn); after leaving (and the sound gap) it warns again`, r.linger === 1 && r.far.threat && !r.far.near && r.rearm === 2, JSON.stringify({ linger: r.linger, far: r.far, rearm: r.rearm })));
    out.push(report(`W ${vp}: no page errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  // DOM: the standings mark the rival that can eat you; the hint shows once.
  {
    const g = await seeded(url, DESK);
    const p = g.page;
    const r = await p.evaluate(async () => {
      const gm = window.game;
      gm.startRound({ seed: 7100 }); gm.checkEvolutionTriggers = () => {}; gm.checkOverdriveTrigger = () => {};
      const P = gm.player; P.invulnerableUntil = Infinity;
      gm.bots.forEach((b, i) => { b.x = 200 + i * 60; b.y = 200; b.setRadius(20); b.score = 50 * i; });
      const big = gm.bots[0]; big.setRadius(200); big.score = 2000; big.x = P.x + 420; big.y = P.y;
      P.setRadius(140); P.score = 3500;
      gm.coachState.t = 99;
      await new Promise(r => setTimeout(r, 600));
      const rows = [...document.querySelectorAll('#leaderboardList li')].map(li => ({ name: li.querySelector('.lb-name').textContent, threat: !!li.querySelector('.lb-threat') }));
      const hint = document.getElementById('mobile-hint').textContent;
      const flag = big.threat;
      return { rows, hint, flag, name: big.name, shown: gm.sizeRuleHintShown };
    });
    await p.screenshot({ path: path.join(SHOTS, 'w-ranking-zagrozenie-1280x720.png') });
    const bigRow = r.rows.find(x => x.name === r.name);
    out.push(report('W6 DOM: the standings mark exactly the rival that can swallow you (not your row, not smaller ones); its name tag is flagged red on the board',
      !!bigRow && bigRow.threat && r.rows.filter(x => x.threat).length === 1 && r.flag, JSON.stringify(r.rows)));
    out.push(report('W7 DOM: leading on points next to that rival shows once "Miejsce zależy od punktów, nie rozmiaru…"', /^Miejsce zależy od punktów, nie rozmiaru\./.test(r.hint) && r.shown, r.hint));
    out.push(report('W no page errors (DOM)', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }
  return out;
}

export async function runUxFixAChecks(url, only = null) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const parts = { D: districtChecks, K: controlChecks, R: rewardChecks, W: warningChecks };
  const out = [];
  for (const [k, fn] of Object.entries(parts)) if (!only || only.includes(k)) out.push(...await fn(url));
  return out;
}

if (isMain(import.meta.url)) {
  const arg = process.argv.find(a => a.startsWith('--only='));
  const only = arg ? arg.slice(7).split(',') : null;
  const { server, url } = await serve();
  const res = await runUxFixAChecks(url, only);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} UX-FIX-A checks passed`);
  process.exit(failed.length ? 1 : 0);
}
