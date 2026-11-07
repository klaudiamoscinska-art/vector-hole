// CG-PREVIEW-QA-1: the CrazyGames Preview reports (R1: CG-QA-01..08, R2-01..03) on the real
// package (tools/export-crazygames-basic.mjs) with qa/cg-sdk-mock.js, and the web build.
//   node qa/cg-preview-qa1.mjs [--root=DIR]     (--root: the game to test, e.g. a base checkout)
// Mock results are not CrazyGames Preview results: what only the portal can show (its
// "SDK functionality" ticks, Load size / Load time, a signed-in account) stays NOT VERIFIED.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, serve, installQaBridge, report, ARENA_BOT, CAMPAIGN_BOT, OUT, ROOT, isMain, CG_SDK_URL, CG_SDK_MOCK } from './lib.mjs';
import { exportPackage } from '../tools/export-crazygames-basic.mjs';

const WORK = path.join(OUT, 'cg-preview-qa1');
const CLOUD = new Map(); // the mock's CrazyGames accounts: userId -> JSON
const settle = (ms = 250) => new Promise(r => setTimeout(r, ms));
let browser = null;

const HELPERS = `(() => {
  window.__vis = (id) => { const e = typeof id === 'string' ? document.getElementById(id) : id; return !!e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden'; };
  window.__arena = (opts) => {
    const w = document.getElementById('btnWelcomePlay');
    if (w && w.offsetParent !== null) w.click();
    return window.__qaPlayArena(Object.assign({ style: 'greedy' }, opts || {}));
  };
  window.__langState = () => ({ lang: I18N.lang, saved: window.game.save.settings.lang, hash: location.hash, guard: SAVE_GUARD.state,
    active: [...document.querySelectorAll('[data-lang].active')].map(b => b.dataset.lang),
    labels: [...document.querySelectorAll('[data-lang]')].map(b => b.textContent.trim()).join(' | ') });
})();`;

async function context({ locale = 'en-US', mock = { mode: 'sdk' }, sdk = CG_SDK_MOCK, device = null, init = null } = {}) {
  const ctx = await browser.newContext(device || { viewport: { width: 1216, height: 684 }, deviceScaleFactor: 1, locale });
  await installQaBridge(ctx);
  await ctx.exposeFunction('__cgCloud', (op, id, json) => { if (op === 'load') return CLOUD.has(id) ? CLOUD.get(id) : null; CLOUD.set(id, json); return null; });
  await ctx.addInitScript(`window.__cgMock = ${JSON.stringify(mock)};`);
  if (init) await ctx.addInitScript(init);
  const external = [], errors = [];
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { external.push(r.request().url()); r.abort(); });
  await ctx.route(CG_SDK_URL, (r) => (sdk ? r.fulfill({ contentType: 'text/javascript', body: sdk }) : r.abort()));
  const open = async (url) => {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    await page.goto(url);
    await ready(page);
    return page;
  };
  return { ctx, open, external, errors, close: () => ctx.close() };
}
async function ready(page) {
  await page.waitForFunction(() => window.game && window.game.state !== undefined && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 40000 });
  await page.addScriptTag({ content: ARENA_BOT });
  await page.addScriptTag({ content: CAMPAIGN_BOT });
  await page.addScriptTag({ content: HELPERS });
}
const gameLog = (p) => p.evaluate(() => (window.__cgMockGame || []).map(e => e[0]));

/* ---------------- CG-QA-07: gameplay markers through the SDK ---------------- */
async function sdkChecks(pkgUrl, webUrl) {
  const r = [];
  const d = await context();
  const p = await d.open(pkgUrl);
  const boot = await gameLog(p);
  r.push(report('[mock] 07 no SDK game event before the player plays (menu / welcome screen)', boot.length === 0, JSON.stringify(boot)));
  await p.evaluate(() => document.getElementById('btnWelcomePlay').click());
  await settle(300);
  const s1 = await gameLog(p);
  r.push(report('[mock] 07 GRAJ on the welcome screen -> exactly one gameplayStart (the round is running)', s1.join() === 'gameplayStart' && await p.evaluate(() => window.game.running), JSON.stringify(s1)));
  await p.evaluate(() => window.game.pauseGame());
  await p.evaluate(() => window.game.pauseGame()); // a second pause must not send a second stop
  await p.evaluate(() => window.game.resumeGame());
  await p.evaluate(() => window.game.resumeGame());
  const s2 = await gameLog(p);
  r.push(report('[mock] 07 pause -> gameplayStop, resume -> gameplayStart, repeated calls send nothing twice', s2.join() === 'gameplayStart,gameplayStop,gameplayStart', JSON.stringify(s2)));
  await p.evaluate(() => window.dispatchEvent(new Event('blur')));
  await settle(100);
  const s3 = await gameLog(p);
  r.push(report('[mock] 07 focus lost mid-round: the game really pauses (pause sheet), so gameplayStop follows the state', s3.slice(-1)[0] === 'gameplayStop' && await p.evaluate(() => window.game.paused), JSON.stringify(s3)));
  // Leave the round from the pause sheet: no second stop (already stopped by the pause).
  await p.evaluate(() => { document.getElementById('btnLeaveRun').click(); const y = document.getElementById('btnLeaveConfirmYes'); if (y && y.offsetParent !== null) y.click(); });
  await settle(300);
  const s4 = await gameLog(p);
  r.push(report('[mock] 07 leaving the paused round sends no extra event', s4.length === s3.length, JSON.stringify(s4)));
  // A finished round (bot, virtual time), PLAY AGAIN, a campaign mission.
  await p.evaluate(() => { window.__cgMockGame.length = 0; window.__qaPlayArena({ style: 'greedy' }); });
  const s5 = await gameLog(p);
  r.push(report('[mock] 07 a finished Arena round: one gameplayStart, one gameplayStop at its end, then the result screen', s5.join() === 'gameplayStart,gameplayStop' && await p.evaluate(() => window.__vis('gameOverScreen')), JSON.stringify(s5)));
  await p.evaluate(() => { window.__cgMockGame.length = 0; document.getElementById('btnPlayAgain').click(); });
  await settle(400);
  await p.evaluate(() => { window.game.pauseGame(); document.getElementById('btnLeaveRun').click(); const y = document.getElementById('btnLeaveConfirmYes'); if (y && y.offsetParent !== null) y.click(); });
  await settle(300);
  await p.evaluate(() => window.game.showScreen('mainMenu'));
  const s6 = await gameLog(p);
  r.push(report('[mock] 07 PLAY AGAIN -> gameplayStart; pause + leave -> one gameplayStop; back in Miasto nothing more', s6.join() === 'gameplayStart,gameplayStop', JSON.stringify(s6)));
  await p.evaluate(async () => {
    window.__cgMockGame.length = 0;
    const g = window.game; g.save.campaign.unlockedDistricts = g.save.campaign.unlockedDistricts || [];
    g.openCampaignScreen(); g.openMissionBriefing('M01');
    await new Promise(r => setTimeout(r, 150));
    document.querySelector('[data-mc-launch]').click();
    for (let i = 0; i < 50 && !(g.running && g.mode === 'campaign'); i++) await new Promise(r => setTimeout(r, 50));
    window.__qaPlayMission('M01', { style: 'expert', clock0: 9e6 });
    await new Promise(r => setTimeout(r, 200));
  });
  const s7 = await gameLog(p);
  r.push(report('[mock] 07 a Dzielnice mission: gameplayStart when it starts, gameplayStop when it ends', s7.filter(n => /gameplay/.test(n)).join() === 'gameplayStart,gameplayStop', JSON.stringify(s7)));
  const all = await p.evaluate(() => window.__cgMockGame.map(e => e[0]));
  const calls = await p.evaluate(() => (window.__cgMockLog || []).map(e => e[0]));
  r.push(report('[mock] 07 no loadingStart/loadingStop, no happytime, no ad call in the package; the Data Module still saves', !all.some(n => /loading|happytime/.test(n)) && calls.includes('setItem') && !calls.some(n => /ad/i.test(n)), JSON.stringify({ all, data: [...new Set(calls)] })));
  r.push(report('[mock] 07 no page errors, nothing external besides the SDK', d.errors.length === 0 && d.external.length === 0, d.errors.concat(d.external).slice(0, 3).join(' | ')));
  await d.close();

  // The whole sequence must alternate start/stop over a mixed session.
  const d2 = await context();
  const q = await d2.open(pkgUrl);
  await q.evaluate(() => {
    window.__arena();
    for (let i = 0; i < 2; i++) window.__qaPlayArena({ style: 'greedy' });
    const g = window.game; g.startRound({}); g.pauseGame(); g.resumeGame(); g.pauseGame(); g.resumeGame(); g.stopRun();
  });
  const seq = await gameLog(q);
  const alternates = seq.length > 0 && seq.every((n, i) => n === (i % 2 ? 'gameplayStop' : 'gameplayStart')) && seq.length % 2 === 0;
  r.push(report(`[mock] 07 a mixed session (3 rounds, pauses, resumes): ${seq.length} events, strictly start/stop/start/... with no duplicate and nothing open at the end`, alternates, JSON.stringify(seq)));
  await d2.close();

  // Dev panel test mode (sandbox) never reports; the web build has no CrazyGames SDK at all.
  const d3 = await context({ locale: 'pl-PL' });
  const w = await d3.open(webUrl);
  const web = await w.evaluate(() => { window.__qaPlayArena({ style: 'greedy' }); return { cg: !!window.CrazyGames, provider: window.game.monetization.provider }; });
  r.push(report('[web] 07 GitHub Pages: no CrazyGames SDK requested or present, provider unchanged (demo)', !web.cg && web.provider === 'demo' && d3.external.length === 0, JSON.stringify({ web, external: d3.external })));
  await d3.close();
  return r;
}

/* ---------------- CG-QA-05 / 03: the language switch ---------------- */
async function switchTo(p, lang) {
  await p.evaluate(() => window.game.openProfileScreen());
  await settle(250);
  const nav = p.waitForEvent('framenavigated', { timeout: 6000 }).catch(() => null);
  await p.click(`[data-lang="${lang}"]`);
  const went = !!(await nav);
  if (went) { await p.waitForLoadState('load'); await ready(p); }
  await p.evaluate(() => window.game.openProfileScreen());
  await settle(350); // English is written by the MutationObserver
  return { went, ...(await p.evaluate(() => window.__langState())) };
}
const LABELS = { en: 'Polish | English', pl: 'Polski | Angielski' };
async function langChecks(pkgUrl, webUrl) {
  const r = [];
  for (const [name, mock] of [
    ['guest', { mode: 'sdk' }],
    // Preview runs signed in: the save reaches the account through the portal later.
    ['signed in, account save debounced 3 s (MODEL of the portal)', { mode: 'sdk', user: { id: 'qa-lang', username: 'qa' }, cloudDebounceMs: 3000 }]
  ]) {
    CLOUD.clear();
    const d = await context({ locale: 'pl-PL', mock });
    const p = await d.open(pkgUrl);
    await p.evaluate(() => window.game.openProfileScreen());
    await settle(350);
    const s0 = await p.evaluate(() => window.__langState());
    const steps = [];
    for (const lang of ['pl', 'en', 'pl', 'en', 'pl', 'en']) steps.push({ want: lang, ...(await switchTo(p, lang)) });
    const ok = steps.every(s => s.went && s.lang === s.want && s.saved === s.want && s.active.join() === s.want && s.labels === LABELS[s.want] && s.hash === '');
    r.push(report(`[mock] 05 ${name}: EN -> PL -> EN -> PL -> EN -> PL -> EN in one session, each click switches the UI, marks its button, keeps it in the save and leaves no #lang in the URL`, s0.lang === 'en' && ok, JSON.stringify({ s0, steps: steps.map(s => `${s.want}:${s.lang}/${s.saved}/${s.active}/${s.hash || '-'}/${s.labels}`) })));
    // Reopen the settings, then a plain reload (no hand-over) after the save had time to arrive.
    await p.evaluate(() => { window.game.showScreen('mainMenu'); window.game.openProfileScreen(); });
    await settle(3500);
    await p.reload(); await ready(p);
    await p.evaluate(() => window.game.openProfileScreen()); await settle(350);
    const s9 = await p.evaluate(() => window.__langState());
    r.push(report(`[mock] 05 ${name}: after reopening the settings and a refresh it is still English, labels "${LABELS.en}"`, s9.lang === 'en' && s9.saved === 'en' && s9.active.join() === 'en' && s9.labels === LABELS.en, JSON.stringify(s9)));
    r.push(report(`[mock] 05 ${name}: no errors`, d.errors.length === 0, d.errors.slice(0, 2).join(' | ')));
    await d.close();
  }
  // A new player: English whatever the browser says; Polish labels in Polish.
  const d = await context({ locale: 'pl-PL' });
  const p = await d.open(pkgUrl);
  await p.evaluate(() => window.game.openProfileScreen()); await settle(350);
  const fresh = await p.evaluate(() => window.__langState());
  r.push(report('[mock] 05/03 a new player (Polish browser): English, "English" marked, labels "Polish | English"', fresh.lang === 'en' && fresh.saved === 'auto' && fresh.active.join() === 'en' && fresh.labels === LABELS.en, JSON.stringify(fresh)));
  const pl = await switchTo(p, 'pl');
  r.push(report('[mock] 03 in Polish the labels are "Polski | Angielski", "Polski" marked', pl.labels === LABELS.pl && pl.active.join() === 'pl', JSON.stringify(pl)));
  // A hand-over that isn't one of ours is ignored; a stray hash does not change the language.
  await p.goto(pkgUrl + '#lang=xx'); await ready(p);
  const stray = await p.evaluate(() => window.__langState());
  r.push(report('[mock] 05 a URL hash other than #lang=pl|en changes nothing (still Polish)', stray.lang === 'pl', JSON.stringify(stray)));
  await d.close();
  // GitHub Pages: unchanged rules -- the browser's language, a reload, no hash.
  const w = await context({ locale: 'pl-PL' });
  const wp = await w.open(webUrl);
  const w0 = await wp.evaluate(() => window.__langState());
  const w1 = await switchTo(wp, 'en');
  const w2 = await switchTo(wp, 'pl');
  r.push(report('[web] 05/03 GitHub Pages: Polish browser -> Polish; EN and back to PL work, no #lang hand-over, labels follow the UI', w0.lang === 'pl' && w1.lang === 'en' && w1.hash === '' && w1.labels === LABELS.en && w2.lang === 'pl' && w2.labels === LABELS.pl, JSON.stringify({ w0, w1, w2 })));
  await w.close();
  return r;
}

/* ---------------- CG-QA-04: no "Reset profile" in the package ---------------- */
async function resetChecks(pkgUrl, webUrl) {
  const r = [];
  for (const lang of ['en', 'pl']) {
    const d = await context();
    const p = await d.open(pkgUrl);
    if (lang === 'pl') { await switchTo(p, 'pl'); }
    await p.evaluate(() => window.game.openProfileScreen()); await settle(300);
    const st = await p.evaluate(async () => {
      document.getElementById('btnPrivacyPolicy').click();
      await new Promise(r => setTimeout(r, 300)); // English is written by the MutationObserver
      const priv = document.getElementById('infoSheetBody').innerText;
      return { button: window.__vis('btnResetProfile'), zone: window.__vis(document.querySelector('.profile-danger-zone')), priv };
    });
    const promises = lang === 'en' ? /Reset profile/i.test(st.priv) : /Resetuj profil/i.test(st.priv);
    const rights = lang === 'en' ? /deletion — clear this site’s data/.test(st.priv) && /contact CrazyGames/.test(st.priv) : /usunięcie — dane gościa usuniesz/.test(st.priv) && /skontaktuj się z CrazyGames/.test(st.priv);
    r.push(report(`[mock] 04 package (${lang.toUpperCase()}): no "Reset profile" button; the privacy text no longer promises it and still names the right to deletion and how`, !st.button && !st.zone && !promises && rights, JSON.stringify({ ...st, priv: st.priv.slice(-420) })));
    const saved = await p.evaluate(() => { const s = JSON.parse(window.CrazyGames.SDK.data.getItem('vectorHoleSave_v1') || 'null'); return !!s; });
    r.push(report(`[mock] 04 package (${lang.toUpperCase()}): the save is untouched (still in the Data Module)`, saved, String(saved)));
    await d.close();
  }
  const w = await context({ locale: 'pl-PL' });
  const wp = await w.open(webUrl);
  await wp.evaluate(() => window.game.openProfileScreen()); await settle(300);
  const ws = await wp.evaluate(() => { document.getElementById('btnPrivacyPolicy').click(); return { button: window.__vis('btnResetProfile'), priv: document.getElementById('infoSheetBody').innerText }; });
  r.push(report('[web] 04 GitHub Pages keeps "RESETUJ PROFIL" and its privacy line', ws.button && /„Resetuj profil” \(kasuje wszystko z tego urządzenia\)/.test(ws.priv), JSON.stringify({ button: ws.button })));
  await w.close();
  return r;
}

/* ---------- CG-QA-06 + R2-02/03: vibration and the control mode only where they work ---------- */
const PHONE = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'en-US', userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' };
// Playwright's hasTouch emulates a touch-only device (coarse + no hover); a touch laptop has
// touch events and touch points, but its main pointer (touchpad/mouse) is fine and hovers.
const TOUCH_LAPTOP = "Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { get: () => 10 }); window.ontouchstart = null;";
// Counts navigator.vibrate() calls (the browser's own result aside: a call is not a buzz).
const VIBRATE_SPY = '(() => { window.__vibrations = 0; const o = Navigator.prototype.vibrate; if (o) Navigator.prototype.vibrate = function (...a) { window.__vibrations++; return o.apply(this, a); }; })();';
const controlsState = () => {
  document.getElementById('pauseSheet').classList.remove('hidden');
  document.getElementById('controlsPanel').classList.remove('hidden');
  return { haptics: window.__vis('hapticsRow'), mode: window.__vis('inputModeRow'), sens: window.__vis(document.querySelector('[data-sensitivity="1"]')), api: typeof navigator.vibrate,
    coarse: matchMedia('(pointer: coarse)').matches, hoverNone: matchMedia('(hover: none)').matches, touchPoints: navigator.maxTouchPoints, can: window.game.canVibrate, inputMode: window.game.save.settings.inputMode, hapticsSaved: window.game.save.settings.haptics };
};
const tagOf = (build) => (build.startsWith('web') ? 'web' : 'mock');
async function controlsChecks(pkgUrl, webUrl) {
  const r = [];
  //            name, device, init, haptics row on [package, web], control mode row
  const cases = [
    ['PC (mouse, navigator.vibrate exists)', null, null, [false, false], false],
    ['touch laptop (touch events, maxTouchPoints 10, mouse/touchpad as the main pointer)', null, TOUCH_LAPTOP, [false, false], true],
    ['Android phone (touch, navigator.vibrate)', PHONE, null, [false, true], true],
    ['phone without the Vibration API (like iPhone Safari)', PHONE, 'delete Navigator.prototype.vibrate;', [false, false], true]
  ];
  for (const [url, build, bi] of [[pkgUrl, 'package', 0], [webUrl, 'web', 1]]) {
    for (const [name, device, init, haptics, mode] of cases) {
      const d = await context({ device, init: (init || '') + VIBRATE_SPY });
      const p = await d.open(url);
      const st = await p.evaluate(controlsState);
      r.push(report(`[${tagOf(build)}] 06/R2 ${build}: ${name} -> Haptics ${haptics[bi] ? 'shown' : 'hidden'}, control mode ${mode ? 'shown' : 'hidden'}, Sensitivity always`, st.haptics === haptics[bi] && st.mode === mode && st.sens, JSON.stringify(st)));
      if (name.startsWith('Android')) {
        // A round with haptics on: calls only where the row is offered (a call is still not a buzz).
        const v = await p.evaluate(() => { const g = window.game; g.save.settings.haptics = true; window.__vibrations = 0; window.__arena(); return { calls: window.__vibrations, saved: g.save.settings.haptics }; });
        r.push(report(`[${tagOf(build)}] R2-03 ${build} on an Android phone, a round with haptics on: navigator.vibrate ${haptics[bi] ? 'called' : 'never called'} (${v.calls}); the saved setting is untouched; a real buzz NOT VERIFIED`, (haptics[bi] ? v.calls > 0 : v.calls === 0) && v.saved === true, JSON.stringify(v)));
      }
      await d.close();
    }
  }
  // The web build inside another site's frame (Chrome blocks vibrate there).
  const d = await context({ device: PHONE });
  const page = await d.ctx.newPage();
  await page.setContent(`<iframe src="${webUrl}" style="width:400px;height:800px;border:0"></iframe>`);
  let fr = null;
  for (let i = 0; i < 100 && !fr; i++) { fr = page.frames().find(f => f !== page.mainFrame() && /index\.html/.test(f.url())) || null; if (!fr) await settle(100); }
  await fr.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 40000 });
  await fr.addScriptTag({ content: HELPERS });
  const framed = await fr.evaluate(controlsState);
  r.push(report('[web] R2-03 web build on an Android phone inside another site\'s frame: Haptics hidden (Chrome blocks vibrate() there), control mode shown', framed.haptics === false && framed.can === false && framed.mode === true, JSON.stringify(framed)));
  await d.close();
  // Saved preferences stay when the rows are hidden.
  const pc = await context();
  const pp = await pc.open(pkgUrl);
  await pp.evaluate(() => { const g = window.game; g.save.settings.inputMode = 'thumbpad'; g.save.settings.haptics = false; g.save.settings.sensitivity = 1.3; saveGame(g.save); });
  await pp.reload(); await ready(pp);
  const kept = await pp.evaluate(controlsState);
  const sens = await pp.evaluate(() => window.game.save.settings.sensitivity);
  r.push(report('[mock] R2-02/03 saved preferences survive on a PC where both rows are hidden (thumbpad, haptics off, sensitivity 1.3 kept after a reload)', kept.inputMode === 'thumbpad' && kept.hapticsSaved === false && sens === 1.3 && !kept.mode && !kept.haptics, JSON.stringify({ ...kept, sens })));
  await pc.close();
  return r;
}

/* ---------------- R2-01: no ZMIEŃ WYGLĄD in the pause sheet ---------------- */
async function pauseChecks(pkgUrl, webUrl) {
  const r = [];
  const builds = [
    [pkgUrl, 'package 1216x684', null],
    [webUrl, 'web phone 375x667', { viewport: { width: 375, height: 667 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'pl-PL' }],
    [webUrl, 'web PC 1280x720', { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: 'pl-PL' }]
  ];
  for (const [url, build, device] of builds) {
    const d = await context({ device });
    const p = await d.open(url);
    const st = await p.evaluate(async () => {
      const g = window.game;
      const wait = (ms) => new Promise(res => setTimeout(res, ms));
      // A player with looks of their own, one selected.
      g.save.auras.owned = [...new Set([...g.save.auras.owned, ...AURAS.slice(0, 3).map(a => a.id)])];
      g.save.auras.selected = AURAS[1].id;
      saveGame(g.save);
      const looks = () => JSON.stringify([g.save.auras, g.save.effects, g.save.overdriveSkins, g.save.skins]);
      const before = looks();
      const w = document.getElementById('btnWelcomePlay'); if (w && w.offsetParent !== null) w.click(); else g.startRound({});
      await wait(300);
      g.pauseGame();
      await wait(300);
      const sheet = document.getElementById('pauseSheet');
      const btns = [...sheet.querySelectorAll('button')].filter(b => window.__vis(b));
      const all = btns.map(b => { const rc = b.getBoundingClientRect(); const hit = document.elementFromPoint(rc.left + rc.width / 2, rc.top + rc.height / 2); return { id: b.id || b.className, inView: rc.top >= 0 && rc.bottom <= innerHeight + 0.5 && rc.left >= 0 && rc.right <= innerWidth + 0.5, tappable: !!hit && (hit === b || b.contains(hit)) }; });
      const text = sheet.innerText;
      document.getElementById('btnControls').click();
      await wait(200);
      const controls = window.__vis('controlsPanel');
      document.getElementById('btnControls').click();
      document.getElementById('btnResume').click();
      await wait(200);
      const resumed = g.running && !g.paused && !window.__vis('pauseSheet');
      g.pauseGame(); document.getElementById('btnLeaveRun').click(); document.getElementById('btnLeaveConfirmYes').click();
      await wait(300);
      g.showScreen('shopScreen');
      await wait(300);
      const raw = window.CrazyGames && window.CrazyGames.SDK ? window.CrazyGames.SDK.data.getItem('vectorHoleSave_v1') : localStorage.getItem('vectorHoleSave_v1');
      return { quick: !!document.getElementById('btnQuickEquip'), looksText: /ZMIEŃ WYGLĄD|CHANGE LOOK/i.test(text), all, controls, resumed, kept: before === looks(), shop: window.__vis('shopScreen'), stored: JSON.parse(raw).auras.selected === AURAS[1].id };
    });
    r.push(report(`[${tagOf(build)}] R2-01 ${build}: the pause sheet has no ZMIEŃ WYGLĄD / CHANGE LOOK; every other button in view and tappable`, !st.quick && !st.looksText && st.all.length >= 4 && st.all.every(b => b.inView && b.tappable), JSON.stringify(st.all)));
    r.push(report(`[${tagOf(build)}] R2-01 ${build}: STEROWANIE opens, resume and leave work, looks unchanged in memory and in the save, Warsztat opens`, st.controls && st.resumed && st.kept && st.stored && st.shop, JSON.stringify({ ...st, all: undefined })));
    r.push(report(`[${tagOf(build)}] R2-01 ${build}: no errors`, d.errors.length === 0, d.errors.slice(0, 2).join(' | ')));
    await d.close();
  }
  return r;
}

/* ---------------- CG-QA-01: the result's way to Miasto ---------------- */
async function cityLabelChecks(pkgUrl, webUrl) {
  const r = [];
  const d = await context();
  const p = await d.open(pkgUrl);
  await p.evaluate(() => window.__arena());
  await settle(350);
  const a1 = await p.evaluate(() => ({ label: document.getElementById('btnMenu').textContent, again: window.__vis('btnPlayAgain'), runs: window.game.save.stats.runsPlayed }));
  r.push(report('[mock] 01 first round result (new player): "Main menu", PLAY AGAIN still the main button', a1.label === 'Main menu' && a1.again && a1.runs === 1, JSON.stringify(a1)));
  await p.evaluate(() => { document.getElementById('btnPlayAgain').click(); window.game.stopRun(); window.__qaPlayArena({ style: 'greedy' }); });
  await settle(350);
  const a2 = await p.evaluate(() => ({ label: document.getElementById('btnMenu').textContent, runs: window.game.save.stats.runsPlayed, shop: window.game.isWarsztatUnlocked() }));
  r.push(report('[mock] 01 second round straight from PLAY AGAIN (Miasto never seen): still "Main menu", Warsztat unlocks as before', a2.label === 'Main menu' && a2.runs === 2 && a2.shop, JSON.stringify(a2)));
  await p.evaluate(() => { window.game.closeInfoSheet && window.game.closeInfoSheet(); document.getElementById('unlockOverlay').classList.add('hidden'); document.getElementById('btnMenu').click(); });
  await settle(300);
  const hub = await p.evaluate(() => ({ menu: window.__vis('mainMenu'), nav: window.__vis('bottomNav'), miasto: (document.querySelector('#btnNavMiasto .nav-tab-label') || {}).textContent }));
  r.push(report('[mock] 01 the button opens Miasto (the City screen, its nav tab "City")', hub.menu && hub.nav && /City/.test(hub.miasto || ''), JSON.stringify(hub)));
  await p.evaluate(() => window.__qaPlayArena({ style: 'greedy' }));
  await settle(350);
  const a3 = await p.evaluate(() => document.getElementById('btnMenu').textContent);
  r.push(report('[mock] 01 after the player has seen Miasto: "Back to City"', a3 === 'Back to City', a3));
  await d.close();
  // Polish web build: a returning player (3+ rounds) sees "Wróć do Miasta" from the first result.
  const w = await context({ locale: 'pl-PL' });
  const wp = await w.open(webUrl);
  const pl1 = await wp.evaluate(() => { window.__arena(); return document.getElementById('btnMenu').textContent; });
  const pl3 = await wp.evaluate(() => { const g = window.game; g.save.stats.runsPlayed = 2; window.__qaPlayArena({ style: 'greedy' }); return { label: document.getElementById('btnMenu').textContent, runs: g.save.stats.runsPlayed }; });
  r.push(report('[web] 01 Polish: "Menu główne" after the first round; "Wróć do Miasta" from the 3rd finished round', pl1 === 'Menu główne' && pl3.label === 'Wróć do Miasta' && pl3.runs === 3, JSON.stringify({ pl1, pl3 })));
  await w.close();
  return r;
}

/* ---------------- CG-QA-02: the daily mission's reward ---------------- */
async function dailyMissionChecks(pkgUrl, webUrl) {
  const r = [];
  for (const [url, build, locale, vp] of [[pkgUrl, 'mock', 'en-US', { width: 1216, height: 684 }], [webUrl, 'web', 'pl-PL', { width: 375, height: 667 }]]) {
    const d = await context({ locale, device: { viewport: vp, deviceScaleFactor: 1, locale } });
    const p = await d.open(url);
    const res = await p.evaluate(async () => {
      const g = window.game;
      window.__arena({ onFrame: (f, gg) => { if (gg.activeMission) gg.missionProgressPeak = 1e9; } });
      await new Promise(r => setTimeout(r, 400));
      const box = document.getElementById('missionResultLine');
      const rect = box.getBoundingClientRect();
      const first = { shown: window.__vis(box), text: box.innerText.replace(/\s+/g, ' ').trim(), reward: g.activeMission.rewardCoins, name: g.activeMission.name, completed: g.save.mission.completed, just: g.missionJustCompleted, inView: rect.left >= 0 && rect.right <= innerWidth + 0.5, raw: /MISJA DNIA UKOŃCZONA:|DAILY MISSION COMPLETE:/.test(document.getElementById('gameOverScreen').innerText) };
      const coins0 = g.save.coins;
      let paid = 0;
      window.__qaPlayArena({ style: 'greedy', onFrame: (f, gg) => { if (gg.activeMission) gg.missionProgressPeak = 1e9; } });
      await new Promise(r => setTimeout(r, 300));
      paid = g.missionJustCompleted ? 1 : 0;
      return { first, second: { shown: window.__vis('missionResultLine'), paid, completed: g.save.mission.completed, coinsUp: g.save.coins - coins0 } };
    });
    const f = res.first;
    const wantText = build === 'web' ? new RegExp(`MISJA DNIA UKOŃCZONA ${f.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\+${f.reward} monet`) : new RegExp(`DAILY MISSION COMPLETE .+ \\+${f.reward} coins`);
    r.push(report(`[${build}] 02 ${build === 'web' ? 'Polish, 375×667' : 'English'}: the completed daily mission is a card (kicker, mission name, "+${f.reward} ${build === 'web' ? 'monet' : 'coins'}"), no raw "…COMPLETE: “…” →" line, inside the screen`, f.shown && f.just && f.completed && wantText.test(f.text) && !f.raw && f.inView, JSON.stringify(f)));
    r.push(report(`[${build}] 02 the reward is paid once: a second round the same day shows no card and pays no mission reward`, !res.second.shown && res.second.paid === 0 && res.second.completed, JSON.stringify(res.second)));
    r.push(report(`[${build}] 02 no errors`, d.errors.length === 0, d.errors.slice(0, 2).join(' | ')));
    await d.close();
  }
  return r;
}

/* ---------------- CG-QA-08: Core City copy = the real gains ---------------- */
async function coreCityChecks(pkgUrl, webUrl) {
  const r = [];
  const d = await context();
  const p = await d.open(pkgUrl);
  const levels = await p.evaluate(() => {
    const g = window.game, cc = CONFIG.hub.coreCity, out = [];
    for (const level of [1, 2, 3, 4, 5, 6, 7]) {
      g.save.hub.coreLevel = level;
      const mult = level <= cc.earlyLevelMax ? cc.earlyLevelMult : 1;
      // Every finished Arena round that can happen: place 1 / 2-3 / 4+, a record or not.
      const arena = [];
      for (const place of [1, 2, 4]) for (const pb of [false, true]) {
        const sum = cc.arenaCompleteGain + (place <= 3 ? cc.arenaTop3Gain : 0) + (place === 1 ? cc.arenaFirstGain : 0) + (pb ? cc.arenaNewPbGain : 0);
        arena.push(mult === 1 ? sum : Math.round(sum * mult));
      }
      const daily = [false, true].map(best => { const sum = cc.dailyFirstClearGain + (best ? cc.dailyNewBestGain : 0); return mult === 1 ? sum : Math.round(sum * mult); });
      const ra = g.coreGainRange('arena'), rd = g.coreGainRange('daily');
      g.updateHubQuickTiles();
      out.push({ level, arena: [Math.min(...arena), Math.max(...arena)], all: [...new Set(arena)].sort((a, b) => a - b), daily, got: [ra.min, ra.max, rd.min, rd.max], per: [g.coreGainPerRound(), g.coreGainMaxPerRound()], text: g.coreGainRangeText() });
    }
    g.save.hub.coreLevel = 1;
    return out;
  });
  const okLevels = levels.every(l => l.got[0] === l.arena[0] && l.got[1] === l.arena[1] && l.got[2] === Math.min(...l.daily) && l.got[3] === Math.max(...l.daily) && l.per.join() === l.arena.join() && l.text === `+${l.arena[0]}–${l.arena[1]}%`);
  r.push(report('[mock] 08 LVL 1-7: the stated ranges = the least/most of every possible round (place 1 / 2-3 / 4+, record or not; Daily with/without a daily record), LVL 1-2 +16–27% (Daily +32–48%), LVL 3+ +10–17% (Daily +20–30%)', okLevels && levels[0].text === '+16–27%' && levels[2].text === '+10–17%' && levels[0].got.join() === '16,27,32,48' && levels[2].got.join() === '10,17,20,30', JSON.stringify(levels.map(l => `L${l.level} ${l.text} all=${l.all} daily=${l.daily}`))));
  // Real rounds: what finalizeRun() adds stays inside the stated range and equals its parts.
  const rounds = await p.evaluate(() => {
    const g = window.game, out = [], cc = CONFIG.hub.coreCity;
    const one = (opts) => {
      const level = g.save.hub.coreLevel || 1, before = g.save.hub.coreCharge || 0, lvlBefore = level;
      const range = g.coreGainRange(opts && opts.round && opts.round.daily ? 'daily' : 'arena');
      window.__qaPlayArena(Object.assign({ style: 'greedy' }, opts || {}));
      const lc = g.lastCoreGain, sum = lc.parts.reduce((a, [, v]) => a + v, 0);
      const added = (g.save.hub.coreLevel - lvlBefore) * 100 + (g.save.hub.coreCharge - before);
      return { level, total: lc.total, sum, early: lc.early, added, range: [range.min, range.max], parts: lc.parts.map(x => x.join(' ')).join(', '),
        ok: lc.total === (lc.early ? Math.round(sum * cc.earlyLevelMult) : sum) && lc.total >= range.min && lc.total <= range.max && added === lc.total };
    };
    window.__arena();
    for (let i = 0; i < 3; i++) out.push(one());
    out.push(one({ round: { daily: true, seed: 12345 } }));
    g.save.hub.coreLevel = 3; g.save.hub.coreCharge = 0;
    for (let i = 0; i < 2; i++) out.push(one());
    out.push(one({ round: { daily: true, seed: 12346 } }));
    return out;
  });
  r.push(report(`[mock] 08 ${rounds.length} real rounds (LVL 1 Arena ×3 + Daily, LVL 3 Arena ×2 + Daily): the gain = its parts (×1,6 rounded on LVL 1-2), inside the stated range, and the bar moves by exactly that`, rounds.every(x => x.ok), JSON.stringify(rounds.map(x => `L${x.level} +${x.total} [${x.range}] ${x.parts}${x.ok ? '' : ' FAIL added=' + x.added}`))));
  // The copy: the rewards sheet and GRAJ say the same, in English (package) and Polish (web).
  const sheet = async (page, level) => page.evaluate(async (lv) => {
    const g = window.game; g.save.hub.coreLevel = lv; g.save.hub.coreCharge = 40;
    g.showScreen('mainMenu'); g.updateHubQuickTiles();
    await new Promise(r => setTimeout(r, 300));
    g.openCoreCityRoadmap();
    await new Promise(r => setTimeout(r, 350));
    const body = document.getElementById('infoSheetBody').innerText;
    g.closeInfoSheet();
    return { body: body.slice(body.indexOf('\n', body.search(/How to fill|Jak ładować/))).trim(), play: document.getElementById('hubPlaySub').textContent };
  }, level);
  const en1 = await sheet(p, 1), en3 = await sheet(p, 3);
  r.push(report('[mock] 08 English, LVL 1: the sheet says how the parts add up, "Now (LVL 1) every gain ×1.6: Arena round +16–27%", and GRAJ says +16–27%', /\+10% for finishing; podium \(1st–3rd place\) \+2%, a win another \+3%, a new record \+2% — \+10–17% per round in total/.test(en1.body) && /Now \(LVL 1\) every gain ×1\.6: Arena round \+16–27%, Daily Challenge \+32–48%/.test(en1.body) && /\+20% for every finish, \+10% for a new daily record — \+20–30% in total/.test(en1.body) && /\+16–27% city build/.test(en1.play) && !/[ąćęłńóśźż]/i.test(en1.body + en1.play), JSON.stringify(en1)));
  r.push(report('[mock] 08 English, LVL 3: "On LVL 1–2 every gain is ×1.6", GRAJ says +10–17%', /On LVL 1–2 every gain is ×1\.6/.test(en3.body) && /\+10–17% city build/.test(en3.play), JSON.stringify(en3)));
  await d.close();
  const w = await context({ locale: 'pl-PL' });
  const wp = await w.open(webUrl);
  const pl1 = await sheet(wp, 1);
  r.push(report('[web] 08 Polish, LVL 1: "+10% za ukończenie … razem +10–17% za rundę", "Teraz (LVL 1) cały przyrost ×1,6: runda Areny +16–27%", Daily "za każde ukończenie", GRAJ +16–27%', /\+10% za ukończenie; podium \(1\.–3\. miejsce\) \+2%, zwycięstwo jeszcze \+3%, nowy rekord \+2% — razem \+10–17% za rundę/.test(pl1.body) && /Teraz \(LVL 1\) cały przyrost ×1,6: runda Areny \+16–27%, Wyzwanie dnia \+32–48%/.test(pl1.body) && /\+20% za każde ukończenie/.test(pl1.body) && !/pierwsze dziś/.test(pl1.body) && /\+16–27% budowy miasta/.test(pl1.play), JSON.stringify(pl1)));
  await w.close();
  return r;
}

export async function runCgPreviewQa1Checks({ root = ROOT } = {}) {
  fs.mkdirSync(WORK, { recursive: true });
  const pkg = exportPackage({ root, out: path.join(WORK, 'export') });
  const site = await serve({ root: pkg.gameDir });
  const web = await serve({ root });
  browser = await chromium.launch();
  const all = [];
  try {
    for (const step of [sdkChecks, langChecks, resetChecks, controlsChecks, pauseChecks, cityLabelChecks, dailyMissionChecks, coreCityChecks]) {
      try { all.push(...await step(site.url, web.url)); } catch (e) { all.push(report(`cg-preview-qa1: ${step.name} crashed`, false, String(e && e.stack || e).slice(0, 600))); }
    }
  } finally { await browser.close(); site.server.close(); web.server.close(); }
  return all;
}

if (isMain(import.meta.url)) {
  const a = process.argv.find(x => x.startsWith('--root='));
  const res = await runCgPreviewQa1Checks(a ? { root: path.resolve(a.slice(7)) } : {});
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} PASS`);
  failed.forEach(f => console.log('  FAIL', f.name, String(f.details || '').slice(0, 400)));
  process.exit(failed.length ? 1 : 0);
}
