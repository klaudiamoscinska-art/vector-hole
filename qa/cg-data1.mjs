// CG-DATA-1: the CrazyGames package saves through the CrazyGames SDK's Data Module.
// The real package (tools/export-crazygames-basic.mjs) runs over HTTP with the SDK's URL
// answered by qa/cg-sdk-mock.js in its 'sdk' mode (a guest blob SDK_DATA_<id>, accounts
// held here in Node as the "cloud", a login switching SDK.data, faults on demand).
//   node qa/cg-data1.mjs [--real-sdk=FILE]
// --real-sdk serves a copy of the real crazygames-sdk-v3.js instead (never committed):
// on 127.0.0.1 it runs in its 'local' mode (guest data in SDK_DATA_local), and on a fake
// crazygames.com host without the portal it turns itself off. Without it those are NOT RUN.
// Mock and local-mode results are not a CrazyGames Preview result; every check is
// labelled [mock], [real SDK local] or [web].
import fs from 'node:fs';
import path from 'node:path';
import { chromium, serve, installQaBridge, report, ARENA_BOT, CAMPAIGN_BOT, veteranSave, allDistrictsSave, OUT, isMain, CG_SDK_URL, CG_SDK_MOCK } from './lib.mjs';
import { exportPackage } from '../tools/export-crazygames-basic.mjs';

const WORK = path.join(OUT, 'cg-data1');
const SAVE = 'vectorHoleSave_v1';
const GUEST = 'SDK_DATA_qa-mock';
const CLOUD = new Map(); // userId -> JSON of that account's data, the mock's "CrazyGames accounts"

/** Every direct localStorage call on the game's own save keys, a raw reader for the
 *  checks, and whether #app was ever visible before the language was set. */
const SPY = `(() => {
  const ls = window.localStorage, get = Storage.prototype.getItem;
  window.__lsTouch = [];
  window.__lsRaw = (k) => get.call(ls, k);
  for (const m of ['getItem', 'setItem', 'removeItem']) {
    const orig = Storage.prototype[m];
    Storage.prototype[m] = function (k, ...rest) {
      if (this === ls && /^vectorHoleSave/.test(String(k))) window.__lsTouch.push(m + ':' + k);
      return orig.call(this, k, ...rest);
    };
  }
  window.__flash = { visibleBeforeReady: false, hiddenFrames: 0 };
  // CG-DATA-2: the package's loader -- what the first frame shows, frames with neither the
  // loader nor the game, when its "what we wait for" line shows and when the game starts.
  window.__boot = { first: null, emptyFrames: 0, waitShownAt: null, readyAt: null, loaderAfterReady: null };
  const tick = () => {
    const app = document.getElementById('app'), ready = document.documentElement.classList.contains('i18n-ready');
    const b = document.getElementById('cgBoot');
    const shown = !!b && getComputedStyle(b).display !== 'none';
    if (ready) { window.__boot.readyAt = performance.now(); window.__boot.loaderAfterReady = shown; return; }
    if (!window.__boot.first && document.body) window.__boot.first = { loader: shown, text: b ? b.innerText : '', progress: !!document.querySelector('progress, [role="progressbar"]') };
    if (!shown && document.body) window.__boot.emptyFrames++;
    const w = b && b.querySelector('.cg-boot-wait');
    if (w && window.__boot.waitShownAt === null && +getComputedStyle(w).opacity > 0.9) window.__boot.waitShownAt = performance.now();
    if (app) { if (getComputedStyle(app).visibility !== 'hidden') window.__flash.visibleBeforeReady = true; else window.__flash.hiddenFrames++; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();`;

/** Page-side helpers: the guest blob, the stored save inside it, a round, a mission. */
const HELPERS = `(() => {
  window.__blob = () => JSON.parse(window.__lsRaw('${GUEST}') || 'null');
  window.__stored = () => { const b = window.__blob(); const raw = b && b.data && b.data['${SAVE}']; return raw ? JSON.parse(raw) : null; };
  window.__arena = () => {
    const gm = window.game, w = document.getElementById('btnWelcomePlay');
    if (w && w.offsetParent !== null) w.click(); else gm.startRound({});
    window.__qaPlayArena({ style: 'greedy' });
    return { runs: gm.save.stats.runsPlayed, coins: gm.save.coins };
  };
  window.__mission = async () => {
    const gm = window.game;
    gm.openCampaignScreen(); gm.openMissionBriefing('M01');
    await new Promise(r => setTimeout(r, 150));
    document.querySelector('[data-mc-launch]').click();
    for (let i = 0; i < 50 && !(gm.running && gm.mode === 'campaign'); i++) await new Promise(r => setTimeout(r, 50));
    const res = window.__qaPlayMission('M01', { style: 'expert', clock0: 9e6 });
    await new Promise(r => setTimeout(r, 200));
    return { stars: res.stars, done: !!gm.save.campaign.completed.M01 };
  };
  window.__state = () => ({ guard: SAVE_GUARD.state, runs: window.game.save.stats.runsPlayed, coins: window.game.save.coins, m01: !!window.game.save.campaign.completed.M01, lang: I18N.lang, welcome: (document.getElementById('btnWelcomePlay') || {}).offsetParent != null });
})();`;

let browser = null;

/** One "device": its own browser storage; the SDK URL answered by `sdk` (null: refused). */
async function device(url, { mock = { mode: 'sdk' }, sdk = CG_SDK_MOCK, locale = 'en-US', seed = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 1216, height: 684 }, deviceScaleFactor: 1, locale });
  await installQaBridge(context);
  await context.exposeFunction('__cgCloud', (op, id, json) => { if (op === 'load') return CLOUD.has(id) ? CLOUD.get(id) : null; CLOUD.set(id, json); return null; });
  await context.addInitScript(`window.__cgMock = ${JSON.stringify(mock)};`);
  await context.addInitScript(SPY);
  const external = [], errors = [], warnings = [];
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { external.push(r.request().url()); r.abort(); });
  if (sdk) await context.route(CG_SDK_URL, (r) => r.fulfill({ contentType: 'text/javascript', body: sdk }));
  if (seed) {
    const p = await context.newPage();
    await p.goto(new URL(url).origin + '/qa-seed-blank');
    await p.evaluate((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }, seed);
    await p.close();
  }
  const open = async ({ wait = true } = {}) => {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text());
      if (m.type() === 'warning' && /CrazyGames/.test(m.text())) warnings.push(m.text());
    });
    await page.goto(url);
    if (wait) await ready(page);
    return page;
  };
  return { context, open, external, errors, warnings, close: () => context.close() };
}
async function ready(page, timeout = 40000) {
  await page.waitForFunction(() => window.game && window.game.state !== undefined && window.__qaBridge && window.__qaBridge.ready, null, { timeout });
  await page.addScriptTag({ content: ARENA_BOT });
  await page.addScriptTag({ content: CAMPAIGN_BOT });
  await page.addScriptTag({ content: HELPERS });
}
async function reload(page) { await page.reload(); await ready(page); }
const cloudSave = (id) => { const d = CLOUD.has(id) ? JSON.parse(CLOUD.get(id)) : null; return d && d[SAVE] ? JSON.parse(d[SAVE]) : null; };
const settle = (ms = 150) => new Promise(r => setTimeout(r, ms));

/* ------------------------------ A. a new player ------------------------------ */
async function newPlayerChecks(url) {
  const r = [];
  // A Polish browser and a slow SDK: the first visible frame must already be English.
  const d = await device(url, { locale: 'pl-PL', mock: { mode: 'sdk', initDelayMs: 1500 } });
  const p = await d.open();
  await settle(300);
  const s = await p.evaluate(() => {
    const def = defaultSave(), sv = window.game.save;
    return { ...window.__state(), flash: window.__flash, boot: window.__boot, htmlLang: document.documentElement.lang,
      fresh: sv.coins === def.coins && (sv.prisms || 0) === (def.prisms || 0) && Object.keys(sv.campaign.completed).length === 0 && JSON.stringify(sv.owned) === JSON.stringify(def.owned) && JSON.stringify(sv.campaign.unlockedDistricts) === JSON.stringify(def.campaign.unlockedDistricts),
      touch: window.__lsTouch.slice(), polish: /[ąćęłńóśźż]/i.test(document.getElementById('app').innerText) };
  });
  r.push(report('[mock] A new player: no save, the welcome screen, a guard that may save (ok)', s.welcome && s.guard === 'ok' && s.runs === 0, JSON.stringify(s)));
  r.push(report('[mock] A new player: English from the first visible frame (Polish browser, SDK 1.5 s late), #app hidden until then, no Polish on screen', s.lang === 'en' && s.htmlLang === 'en' && !s.flash.visibleBeforeReady && s.flash.hiddenFrames > 10 && !s.polish, JSON.stringify({ flash: s.flash, lang: s.lang, polish: s.polish })));
  const b = s.boot;
  r.push(report('[mock] A new player: the first frame is the English GLITCH GULP loader (no empty frame, no progress bar, no Polish), gone once the game starts; the "connecting" line waits past 1.5 s', b.first && b.first.loader && /GLITCH GULP/.test(b.first.text) && !/[ąćęłńóśźż%]/i.test(b.first.text) && !b.first.progress && b.emptyFrames === 0 && b.loaderAfterReady === false && b.waitShownAt === null, JSON.stringify(b)));
  r.push(report('[mock] A new player: nothing unlocked for testing (coins, prisms, looks, missions, districts = defaultSave())', s.fresh, JSON.stringify(s)));
  r.push(report('[mock] A new player: the game never reads or writes its own localStorage key in the package', s.touch.length === 0, s.touch.join()));
  r.push(report('[mock] A new player: no errors, nothing external besides the SDK', d.errors.length === 0 && d.external.length === 0, d.errors.concat(d.external).slice(0, 2).join(' | ')));
  await d.close();
  return r;
}

/* ------------------------------ B. a guest ------------------------------ */
async function guestChecks(url) {
  const r = [];
  const d = await device(url);
  const p = await d.open();
  const a = await p.evaluate(() => window.__arena());
  const afterArena = await p.evaluate(() => ({ stored: window.__stored(), touch: window.__lsTouch.slice(), keys: Object.keys((window.__blob() || {}).data || {}) }));
  r.push(report('[mock] B guest: a finished Arena round is in the Data Module (SDK guest blob), SAVE v13', afterArena.stored && afterArena.stored.schemaVersion === 13 && afterArena.stored.stats.runsPlayed === a.runs && afterArena.stored.coins === a.coins && a.runs >= 1, JSON.stringify({ a, keys: afterArena.keys })));
  const m = await p.evaluate(() => window.__mission());
  const afterMission = await p.evaluate(() => window.__stored());
  r.push(report('[mock] B guest: a finished mission (M01) is in the Data Module', m.done && !!afterMission.campaign.completed.M01, JSON.stringify(m)));
  const before = await p.evaluate(() => window.__state());
  await reload(p);
  const afterReload = await p.evaluate(() => window.__state());
  r.push(report('[mock] B guest: a reload restores the progress (runs, coins, M01), no welcome screen', afterReload.runs === before.runs && afterReload.coins === before.coins && afterReload.m01 && !afterReload.welcome && afterReload.guard === 'ok', JSON.stringify({ before, afterReload })));
  await p.close();
  const p2 = await d.open();
  const restart = await p2.evaluate(() => window.__state());
  r.push(report('[mock] B guest: a new start (new tab) restores it too', restart.runs === before.runs && restart.coins === before.coins && restart.m01, JSON.stringify(restart)));
  const touch = await p2.evaluate(() => ({ touch: window.__lsTouch, legacy: window.__lsRaw('vectorHoleSave_v1') }));
  r.push(report('[mock] B guest: the game\'s own localStorage key is never read or written in the package (only the SDK stores)', touch.touch.length === 0 && touch.legacy === null, JSON.stringify(touch)));
  r.push(report('[mock] B guest: no errors', d.errors.length === 0, d.errors.slice(0, 2).join(' | ')));
  await d.close();
  return r;
}

/* ------------------------------ C. a logged-in player ------------------------------ */
async function accountChecks(url) {
  const r = [];
  CLOUD.delete('acc-A');
  const d1 = await device(url, { seed: { __cgMockUser: { id: 'acc-A', username: 'qa_A' } } });
  const p1 = await d1.open();
  const a = await p1.evaluate(() => window.__arena());
  await settle();
  const c = cloudSave('acc-A');
  r.push(report('[mock] C account: a round is saved to the account (cloud), not to the guest blob', c && c.stats.runsPlayed === a.runs && c.coins === a.coins && !(await p1.evaluate(() => window.__blob())), JSON.stringify({ a, cloud: c && c.stats.runsPlayed })));
  await reload(p1);
  const back = await p1.evaluate(() => window.__state());
  r.push(report('[mock] C account: a reload reads the account data back', back.runs === a.runs && back.coins === a.coins && back.guard === 'ok', JSON.stringify(back)));
  // Another device (its own browser storage), the same account.
  const d2 = await device(url, { seed: { __cgMockUser: { id: 'acc-A', username: 'qa_A' } } });
  const p2 = await d2.open();
  const other = await p2.evaluate(() => window.__state());
  r.push(report('[mock] C account: a second device restores the account progress (simulated sync; the real one is NOT RUN)', other.runs === a.runs && other.coins === a.coins && !other.welcome, JSON.stringify(other)));
  const more = await p2.evaluate(() => window.__mission());
  await settle();
  await reload(p1);
  const synced = await p1.evaluate(() => window.__state());
  r.push(report('[mock] C account: progress made on the second device is there on the first after a reload', more.done && synced.m01, JSON.stringify(synced)));
  // CG-DATA-2: two tabs of the same logged-in player on one device (the SDK keeps a copy of
  // the account data in SDK_DATA_CLOUD_CACHE_<id>): the older tab must not write over the newer.
  const t2 = await d1.open();
  const newer = await t2.evaluate(() => { window.__arena(); return { runs: window.game.save.stats.runsPlayed, coins: window.game.save.coins }; });
  await settle(300);
  const older = await p1.evaluate(() => ({ guard: SAVE_GUARD.state, ok: saveGame(window.game.save) }));
  await settle();
  const kept = cloudSave('acc-A');
  r.push(report('[mock] C account, two tabs: a round in the second tab stops the first from writing; the account keeps the newer progress', older.guard === 'stale' && older.ok === false && kept.stats.runsPlayed === newer.runs && kept.coins === newer.coins, JSON.stringify({ older, newer, cloud: { runs: kept.stats.runsPlayed, coins: kept.coins } })));
  await t2.close();
  r.push(report('[mock] C account: no errors, no direct localStorage save key', d1.errors.length + d2.errors.length === 0 && (await p1.evaluate(() => window.__lsTouch.length)) === 0, d1.errors.concat(d2.errors).slice(0, 2).join(' | ')));
  await d1.close(); await d2.close();
  return r;
}

/* ------------------------------ D. accounts and conflicts ------------------------------ */
async function conflictChecks(url) {
  const r = [];
  // D1: a guest logs in to an account with no data -> the SDK moves the guest progress there.
  CLOUD.delete('acc-new');
  let d = await device(url);
  let p = await d.open();
  const g1 = await p.evaluate(() => window.__arena());
  await p.evaluate(() => window.__cgMockLogin({ id: 'acc-new', username: 'qa_new' }));
  await settle(400);
  const st1 = await p.evaluate(() => ({ guard: SAVE_GUARD.state, write: saveGame(window.game.save), sheet: document.getElementById('infoSheet').classList.contains('hidden') ? '' : document.getElementById('infoSheet').innerText }));
  const moved = cloudSave('acc-new');
  r.push(report('[mock] D1 guest -> new account: the page stops writing at the login, the SDK carries the guest progress to the account', st1.guard === 'stale' && st1.write === false && moved && moved.stats.runsPlayed === g1.runs, JSON.stringify({ guard: st1.guard, write: st1.write, moved: moved && moved.stats.runsPlayed })));
  r.push(report('[mock] D1 the player sees why (English): signed in, reload to play with the account', /Signed in to CrazyGames/.test(st1.sheet) && /account's progress/.test(st1.sheet) && !/[ąćęłńóśźż]/i.test(st1.sheet), st1.sheet.slice(0, 200)));
  // CG-DATA-2: the SDK switched SDK.data in place (no reload): the notice must not let the
  // player play on unsaved, and no save path may touch the account's data any more.
  const accBytes1 = CLOUD.get('acc-new');
  const lock = await p.evaluate(() => {
    const sheet = document.getElementById('infoSheet'), g = window.game;
    sheet.dispatchEvent(new MouseEvent('click', { bubbles: true })); // a tap on the backdrop
    g.closeInfoSheet(); g.openInfoSheet({ title: 'another sheet', body: [] }); g.showScreen('profileScreen');
    const res = { closeHidden: document.getElementById('btnInfoSheetClose').classList.contains('hidden'), write: saveGame(g.save) };
    // A backup code is the player's explicit choice -- it lifts a guard, but not this one.
    res.adopt = g.adoptSave(defaultSave(), 'code');
    g.resetProfile(); // "Reset profile" after the login: must not delete the account's save
    // No Data Module call at all after the login (the mock logs every one).
    const log = window.__cgMockLog, at = log.findIndex(x => x[0] === 'login');
    res.dataCallsAfterLogin = log.slice(at + 1).filter(x => /Item|clear/.test(x[0])).length;
    res.storeOpen = res.dataCallsAfterLogin > 0;
    return res;
  });
  await settle(300);
  const lockSheet = await p.evaluate(() => { const s = document.getElementById('infoSheet'); return s.classList.contains('hidden') ? '' : s.innerText; });
  r.push(report('[mock] D1 after the login the notice stays (no close button, the backdrop, other sheets and screens leave it), only RELOAD; repair, save and reset touch nothing', lock.closeHidden && /Signed in to CrazyGames/.test(lockSheet) && /RELOAD/i.test(lockSheet) && lock.adopt === null && lock.write === false && lock.storeOpen === false && CLOUD.get('acc-new') === accBytes1, JSON.stringify({ lock, sheet: lockSheet.slice(0, 120), accountUnchanged: CLOUD.get('acc-new') === accBytes1 })));
  await Promise.all([p.waitForNavigation(), p.click('#btnInfoSheetAction')]);
  await ready(p);
  const after1 = await p.evaluate(() => window.__state());
  r.push(report('[mock] D1 RELOAD: the account plays on with the carried progress', after1.runs === g1.runs && after1.guard === 'ok', JSON.stringify(after1)));
  const errD1 = d.errors.slice();
  await d.close();

  // D5: a login during an Arena round (to an account with data): the round plays on, its
  // result is not written anywhere, the reload notice comes when the round ends.
  const accR = await accountWithProgress(url, 'acc-round', 2);
  const bytesR = CLOUD.get('acc-round');
  d = await device(url);
  p = await d.open();
  await p.evaluate(() => window.__arena());
  const guestBlobR = await p.evaluate(() => window.__lsRaw('SDK_DATA_qa-mock'));
  await p.evaluate(() => window.game.startRound({}));
  await settle(500);
  await p.evaluate(() => window.__cgMockLogin({ id: 'acc-round', username: 'qa_round' }));
  await settle(500);
  const mid = await p.evaluate(() => ({ running: window.game.running, sheet: !document.getElementById('infoSheet').classList.contains('hidden') }));
  await p.evaluate(() => { window.game.timeRemaining = 0.05; });
  await p.waitForFunction(() => !window.game.running, null, { timeout: 10000 });
  await settle(500);
  const endR = await p.evaluate(() => { const s = document.getElementById('infoSheet'); return { sheet: s.classList.contains('hidden') ? '' : s.innerText, closeHidden: document.getElementById('btnInfoSheetClose').classList.contains('hidden'), guestBlob: window.__lsRaw('SDK_DATA_qa-mock') }; });
  r.push(report('[mock] D5 login during a round: no notice over the running round; at its end the reload notice; the round written neither to the account nor to the guest data', mid.running && !mid.sheet && /Signed in to CrazyGames/.test(endR.sheet) && endR.closeHidden && CLOUD.get('acc-round') === bytesR && endR.guestBlob === guestBlobR, JSON.stringify({ mid, sheet: endR.sheet.slice(0, 80), account: CLOUD.get('acc-round') === bytesR, guest: endR.guestBlob === guestBlobR })));
  await Promise.all([p.waitForNavigation(), p.click('#btnInfoSheetAction')]);
  await ready(p);
  const afterR = await p.evaluate(() => window.__state());
  r.push(report('[mock] D5 after RELOAD the account\'s own progress shows', afterR.runs === accR.runs && afterR.coins === accR.coins && afterR.guard === 'ok', JSON.stringify({ afterR, accR })));
  r.push(report('[mock] D1/D5 no errors', errD1.length + d.errors.length === 0, errD1.concat(d.errors).slice(0, 2).join(' | ')));
  await d.close();

  // D2: a guest with its own progress logs in to an account that already has data.
  const acc = await accountWithProgress(url, 'acc-old', 3);
  const accBytes = CLOUD.get('acc-old');
  d = await device(url);
  p = await d.open();
  await p.evaluate(() => { window.__arena(); window.game.save.coins += 777; saveGame(window.game.save); });
  // The progress, not the bytes: every session legitimately writes a little at boot.
  const progress = (s) => s && { runs: s.stats.runsPlayed, coins: s.coins };
  const guest = await p.evaluate(() => ({ runs: window.game.save.stats.runsPlayed, coins: window.game.save.coins }));
  const accOf = (id) => JSON.stringify(progress(cloudSave(id)));
  for (const order of ['listener-first', 'switch-only']) {
    if (order === 'switch-only') { await p.evaluate(() => localStorage.removeItem('__cgMockUser')); await reload(p); }
    await p.evaluate((o) => window.__cgMockLogin({ id: 'acc-old', username: 'qa_old' }, { order: o }), order);
    await settle();
    // The game tries to save its (guest) state after the switch: a round and an explicit write.
    const st = await p.evaluate(() => { const ok = saveGame(window.game.save); return { ok, guard: SAVE_GUARD.state }; });
    await settle();
    r.push(report(`[mock] D2 guest -> account with data (${order === 'listener-first' ? 'auth listener' : 'SDK switches data, no listener call'}): the guest state is not written over the account`, st.ok === false && st.guard === 'stale' && CLOUD.get('acc-old') === accBytes, JSON.stringify(st)));
  }
  const guestNow = await p.evaluate(() => { const b = window.__blob(); const s = b && JSON.parse(b.data.vectorHoleSave_v1); return s && { runs: s.stats.runsPlayed, coins: s.coins }; });
  r.push(report('[mock] D2 the guest progress stays on the device as it was (not merged, not deleted)', JSON.stringify(guestNow) === JSON.stringify(guest), JSON.stringify({ guestNow, guest })));
  await reload(p);
  const after2 = await p.evaluate(() => window.__state());
  r.push(report('[mock] D2 after the reload the account\'s own progress shows (not the guest\'s)', after2.runs === acc.runs && after2.coins === acc.coins, JSON.stringify({ after2, acc })));
  // D3: logout -> the page reloads as a guest: the guest data, never the account's.
  await p.evaluate(() => window.__cgMockLogout());
  await reload(p);
  const guestAgain = await p.evaluate(() => window.__state());
  r.push(report('[mock] D3 logout: the guest progress of this device comes back, the account keeps its own', guestAgain.runs === guest.runs && guestAgain.coins === guest.coins && accOf('acc-old') === JSON.stringify(acc), JSON.stringify({ guestAgain, guest, account: accOf('acc-old') })));
  // D4: another account on the same device: its own data, the first account untouched.
  const accC = await accountWithProgress(url, 'acc-C', 1);
  await p.evaluate(() => localStorage.setItem('__cgMockUser', JSON.stringify({ id: 'acc-C', username: 'qa_C' })));
  await reload(p);
  const asC = await p.evaluate(() => window.__state());
  const played = await p.evaluate(() => window.__arena());
  await settle(300);
  r.push(report('[mock] D4 a second account on the same device: its own progress, saved only to itself, the first account untouched', asC.runs === accC.runs && asC.coins === accC.coins && accOf('acc-old') === JSON.stringify(acc) && accOf('acc-C') === JSON.stringify(played), JSON.stringify({ asC, accC, played, C: accOf('acc-C'), old: accOf('acc-old') })));
  r.push(report('[mock] D no errors', d.errors.length === 0, d.errors.slice(0, 2).join(' | ')));
  await d.close();
  return r;
}
/** An account that played `rounds` Arena rounds on some other device. */
async function accountWithProgress(url, id, rounds) {
  CLOUD.delete(id);
  const d = await device(url, { seed: { __cgMockUser: { id, username: 'qa_' + id } } });
  const p = await d.open();
  const out = await p.evaluate((n) => { let x; for (let i = 0; i < n; i++) x = window.__arena(); window.game.save.coins += 1000 * n; saveGame(window.game.save); return { runs: window.game.save.stats.runsPlayed, coins: window.game.save.coins }; }, rounds);
  await settle();
  await d.close();
  return out;
}

/* ------------------------------ E. robustness ------------------------------ */
/** A guest blob holding a played profile, made by the game itself. */
async function playedGuestBlob(url) {
  const d = await device(url);
  const p = await d.open();
  await p.evaluate(() => { window.__arena(); window.game.save.coins += 4321; saveGame(window.game.save); });
  const blob = await p.evaluate(() => window.__lsRaw('SDK_DATA_qa-mock'));
  const st = await p.evaluate(() => window.__state());
  await d.close();
  return { blob, st };
}
async function robustnessChecks(url) {
  const r = [];
  const base = await playedGuestBlob(url);
  const legacy = JSON.stringify({ schemaVersion: 13, coins: 99999, note: 'an old test package save' });

  // E1: a slow SDK -- nothing is read or written before it is ready, the save loads in full.
  let d = await device(url, { mock: { mode: 'sdk', initDelayMs: 4000 }, seed: { [GUEST]: base.blob } });
  let p = await d.open();
  let s = await p.evaluate(() => ({ ...window.__state(), flash: window.__flash, boot: window.__boot, log: window.__cgMockLog.map(x => x[0]) }));
  // (The mock refuses any data call before init() resolved; the log starts at init.)
  r.push(report('[mock] E1 slow SDK (4 s): the game waits, #app stays hidden, no data call before init, then the full save loads', s.guard === 'ok' && s.coins === base.st.coins && s.runs === base.st.runs && !s.flash.visibleBeforeReady && s.flash.hiddenFrames > 30 && s.log[0] === 'init' && s.log[1] === 'getItem', JSON.stringify(s)));
  r.push(report('[mock] E1 slow SDK (4 s): the loader the whole time, its "Connecting to CrazyGames saving" line after ~3 s, the game then starts', s.boot.first && s.boot.first.loader && s.boot.emptyFrames === 0 && s.boot.waitShownAt !== null && s.boot.waitShownAt > 2500 && s.boot.waitShownAt < s.boot.readyAt && s.boot.loaderAfterReady === false, JSON.stringify(s.boot)));
  await d.close();

  // E2-E5: SDK missing / init fails / init never answers / Data Module disabled.
  const cases = [
    ['E2 SDK script blocked', { sdk: null }],
    ['E3 SDK init fails', { mock: { mode: 'sdk', initFails: true } }],
    ['E4 SDK init never answers (20 s timeout)', { mock: { mode: 'sdk', initHangs: true } }],
    ['E5 Data Module disabled (Progress Save not selected)', { mock: { mode: 'sdk', dataDisabled: true } }],
    ['E6 the SDK cannot read', { mock: { mode: 'sdk', failGet: true } }],
    ['E7 SDK outside CrazyGames (environment disabled)', { mock: { mode: 'sdk', environment: 'disabled' } }]
  ];
  for (const [name, opt] of cases) {
    d = await device(url, { ...opt, seed: { [GUEST]: base.blob, [SAVE]: legacy } });
    const t0 = Date.now();
    p = await d.open();
    const boot = Date.now() - t0;
    await settle(400);
    // The notice opens at boot; read it before a round closes the sheet.
    const sheet = await p.evaluate(() => { const s = document.getElementById('infoSheet'); return s && !s.classList.contains('hidden') ? s.innerText : ''; });
    const st = await p.evaluate(() => ({ ...window.__state(), boot: window.__boot, written: saveGame(window.game.save), arena: window.__arena() }));
    // (A fast failure can start the game before the first frame: then no loader is ever seen.)
    r.push(report(`[mock] ${name}: no empty frame while waiting (the loader until the game starts and explains), start after ${Math.round(st.boot.readyAt || -1)} ms`, (!st.boot.first || st.boot.first.loader) && st.boot.emptyFrames === 0 && st.boot.loaderAfterReady === false, JSON.stringify(st.boot)));
    await settle(400);
    const after = await p.evaluate(() => ({ blob: window.__lsRaw('SDK_DATA_qa-mock'), legacy: window.__lsRaw('vectorHoleSave_v1'), sdkKeys: Object.keys(localStorage).filter(k => /^SDK_DATA/.test(k)) }));
    const notice = /Couldn't connect to CrazyGames saving/.test(sheet) && !/[ąćęłńóśźż]/i.test(sheet);
    r.push(report(`[mock] ${name}: plays from memory, saves nothing ('unavailable'), the device's data and the old key stay byte-equal, an English notice`, st.guard === 'unavailable' && st.written === false && st.arena.runs >= 1 && after.blob === base.blob && after.legacy === legacy && notice && st.lang === 'en', JSON.stringify({ guard: st.guard, written: st.written, notice, boot, warn: d.warnings.slice(0, 1) })));
    await d.close();
  }
  // E6b: the read error was not "no save": once the SDK reads again, the progress is all there.
  d = await device(url, { seed: { [GUEST]: base.blob } });
  p = await d.open();
  s = await p.evaluate(() => window.__state());
  r.push(report('[mock] E6b after a failed read the next session gets the whole save back (nothing was reset)', s.coins === base.st.coins && s.runs === base.st.runs && s.guard === 'ok', JSON.stringify(s)));

  // E8: a write that fails, then works again.
  await p.evaluate(() => { window.__cgMock.failSet = true; });
  const before8 = await p.evaluate(() => window.__lsRaw('SDK_DATA_qa-mock'));
  const w1 = await p.evaluate(() => { window.game.save.coins += 5; return { ok: saveGame(window.game.save), guard: SAVE_GUARD.state, blob: window.__lsRaw('SDK_DATA_qa-mock') }; });
  w1.blob = w1.blob === before8 ? base.blob : 'changed';
  await p.evaluate(() => { window.__cgMock.failSet = false; });
  const w2 = await p.evaluate(() => ({ ok: saveGame(window.game.save), guard: SAVE_GUARD.state, coins: window.__stored().coins, game: window.game.save.coins }));
  r.push(report('[mock] E8 a write error: false, the stored save unchanged, the guard still ok; the next write stores the current progress', w1.ok === false && w1.guard === 'ok' && w1.blob === base.blob && w2.ok && w2.guard === 'ok' && w2.coins === w2.game, JSON.stringify({ w1: { ok: w1.ok, guard: w1.guard }, w2 })));

  // E9: over the size limit (the SDK throws after taking the value into memory).
  const before9 = await p.evaluate(() => window.__lsRaw('SDK_DATA_qa-mock'));
  const w3 = await p.evaluate(() => {
    window.__cgMock.limitBytes = 300; // below any save, so the write must fail
    window.game.save.coins += 9;
    const ok = saveGame(window.game.save);
    const inSdk = window.CrazyGames.SDK.data.getItem('vectorHoleSave_v1');
    window.__cgMock.limitBytes = 0;
    return { ok, guard: SAVE_GUARD.state, sdkMemoryMatchesSeen: inSdk === SAVE_GUARD.seen, blob: window.__lsRaw('SDK_DATA_qa-mock') };
  });
  const unchanged9 = w3.blob === before9; delete w3.blob;
  const w4 = await p.evaluate(() => ({ ok: saveGame(window.game.save), coins: window.__stored().coins, game: window.game.save.coins }));
  r.push(report('[mock] E9 over the 1 MB limit: not saved, stored bytes unchanged, the SDK memory put back (no false "other tab"), the next write works', w3.ok === false && w3.guard === 'ok' && w3.sdkMemoryMatchesSeen && unchanged9 && w4.ok && w4.coins === w4.game, JSON.stringify({ w3, w4, unchanged9 })));

  // E10: many writes in a row.
  const burst = await p.evaluate(() => { let ok = 0; for (let i = 0; i < 300; i++) { window.game.save.coins += 1; if (saveGame(window.game.save)) ok++; } return { ok, coins: window.game.save.coins, stored: window.__stored().coins, guard: SAVE_GUARD.state }; });
  r.push(report('[mock] E10 300 writes in a row: all stored, the last one wins, guard ok', burst.ok === 300 && burst.stored === burst.coins && burst.guard === 'ok', JSON.stringify(burst)));

  // E11: a reload right after an important change (end of a round).
  const end = await p.evaluate(() => window.__arena());
  await p.reload(); await ready(p);
  const re = await p.evaluate(() => window.__state());
  r.push(report('[mock] E11 a reload right after a round: the round is kept (guest storage is synchronous)', re.runs === end.runs && re.coins === end.coins, JSON.stringify({ end, re })));

  // E12: a second tab of the package writes: the first stops writing (PX01 'stale').
  const p2 = await d.open();
  await p2.evaluate(() => { window.game.save.coins += 100; saveGame(window.game.save); });
  await settle(300);
  const tabs = await p.evaluate(() => ({ guard: SAVE_GUARD.state, ok: saveGame(window.game.save) }));
  const kept = await p2.evaluate(() => ({ stored: window.__stored().coins, game: window.game.save.coins }));
  r.push(report('[mock] E12 two tabs: the tab with older progress stops writing, the newer progress stays stored', tabs.guard === 'stale' && tabs.ok === false && kept.stored === kept.game, JSON.stringify({ tabs, kept })));
  await d.close();

  // E13/E14: a broken save and a newer game's save in the Data Module are never written over.
  for (const [name, raw, want] of [['E13 corrupt save', '{"schemaVersion":13,"coins":', 'corrupt'], ['E14 save from a newer version', JSON.stringify({ schemaVersion: 99, coins: 5, futureField: true }), 'future']]) {
    const blob = JSON.stringify({ data: { [SAVE]: raw } });
    d = await device(url, { seed: { [GUEST]: blob } });
    p = await d.open();
    const st = await p.evaluate(() => ({ guard: SAVE_GUARD.state, ok: saveGame(window.game.save), arena: window.__arena() }));
    await settle(200);
    r.push(report(`[mock] ${name}: guard '${want}', nothing written over it`, st.guard === want && st.ok === false && (await p.evaluate(() => window.__lsRaw('SDK_DATA_qa-mock'))) === blob, JSON.stringify({ guard: st.guard, ok: st.ok })));
    await d.close();
  }

  // E15: a save from an older schema migrates inside the Data Module, its original kept as .bak there.
  d = await device(url);
  p = await d.open();
  const older = await p.evaluate(() => { const s = defaultSave(); s.coins = 1234; s.schemaVersion = 12; s.energy = 5; return JSON.stringify(s); });
  await d.close();
  const oblob = JSON.stringify({ data: { [SAVE]: older } });
  d = await device(url, { seed: { [GUEST]: oblob } });
  p = await d.open();
  const mig = await p.evaluate(() => { const b = window.__blob().data; return { guard: SAVE_GUARD.state, coins: window.game.save.coins, v: JSON.parse(b['vectorHoleSave_v1']).schemaVersion, bak: b['vectorHoleSave_v1.bak'] || null, touch: window.__lsTouch }; });
  r.push(report('[mock] E15 an older-schema save migrates in the Data Module, the original bytes kept as .bak in the same store', mig.guard === 'ok' && mig.coins === 1234 && mig.v === 13 && mig.bak === older && mig.touch.length === 0, JSON.stringify({ ...mig, bak: !!mig.bak })));
  await d.close();

  // E16: size headroom -- a full profile with its .bak and .rescue copies against 1 MB.
  d = await device(url);
  p = await d.open();
  const save = await allDistrictsSave(p);
  const size = await p.evaluate((s) => {
    s.owned = SKINS.map(k => k.id); s.auras.owned = AURAS.map(a => a.id); s.effects.owned = EAT_EFFECTS.map(e => e.id);
    CAMPAIGN_MISSIONS.forEach(m => { s.campaign.completed[m.id] = true; s.campaign.stars[m.id] = 7; });
    const one = sealSave(sanitizeSave(s)).length;
    return { one, three: JSON.stringify({ a: 'x'.repeat(one), b: 'x'.repeat(one), c: 'x'.repeat(one) }).length };
  }, save);
  r.push(report('[mock] E16 a full profile (240 missions, all looks) with .bak and .rescue fits the 1 MB Data Module limit', size.three < 1048576 * 0.5, JSON.stringify(size)));
  await d.close();
  return r;
}

/* ------------------------------ F. the web build ------------------------------ */
async function webChecks(webUrl) {
  const r = [];
  const legacySave = await (async () => {
    const d = await device(webUrl, { sdk: null });
    const p = await d.open();
    const s = await veteranSave(p, { missions: 6 });
    await d.close();
    return s;
  })();
  const d = await device(webUrl, { sdk: null, seed: { [SAVE]: legacySave } });
  const p = await d.open();
  const st = await p.evaluate(() => ({ ...window.__state(), cg: !!window.CrazyGames, sdkKeys: Object.keys(localStorage).filter(k => /^SDK_DATA/.test(k)) }));
  await p.evaluate(() => window.__arena());
  const after = await p.evaluate(() => ({ stored: JSON.parse(window.__lsRaw('vectorHoleSave_v1')), runs: window.game.save.stats.runsPlayed }));
  r.push(report('[web] GitHub Pages build: no SDK requested, an existing SAVE v13 loads from localStorage and keeps saving there', !st.cg && d.external.length === 0 && st.guard === 'ok' && st.runs === legacySave.stats.runsPlayed && after.stored.stats.runsPlayed === after.runs && after.runs === legacySave.stats.runsPlayed + 1 && st.sdkKeys.length === 0, JSON.stringify({ st, external: d.external })));
  await d.close();
  return r;
}

/* ------------------------------ the real SDK (optional) ------------------------------ */
async function realSdkChecks(url, gameDir, file) {
  const r = [];
  if (!file) { r.push({ name: '[real SDK local] NOT RUN (no --real-sdk=FILE)', ok: true, notRun: true }); return r; }
  const real = fs.readFileSync(file, 'utf8');
  const version = (real.match(/HTML SDK initialized",\{version:"(\d+\.\d+\.\d+)"/) || [])[1] || '?';
  const d = await device(url, { sdk: real, mock: {}, locale: 'pl-PL' });
  const p = await d.open();
  const s0 = await p.evaluate(() => ({ ...window.__state(), env: window.CrazyGames.SDK.environment, boot: window.__boot }));
  r.push(report(`[real SDK local] SDK ${version}: the loader from the first frame, no empty frame, the game starts after ${Math.round(s0.boot.readyAt || -1)} ms (normal start, SDK on this machine)`, s0.boot.first && s0.boot.first.loader && s0.boot.emptyFrames === 0 && s0.boot.loaderAfterReady === false && s0.boot.readyAt < 10000, JSON.stringify(s0.boot)));
  const a = await p.evaluate(() => window.__arena());
  const blob = await p.evaluate(() => { const b = JSON.parse(window.__lsRaw('SDK_DATA_local') || 'null'); return b && b.data && b.data.vectorHoleSave_v1 ? JSON.parse(b.data.vectorHoleSave_v1) : null; });
  await reload(p);
  const s1 = await p.evaluate(() => ({ ...window.__state(), touch: window.__lsTouch }));
  r.push(report(`[real SDK local] SDK ${version} in its local mode: a new player in English, a round saved in SDK_DATA_local, restored after a reload, the game's own key untouched`, s0.env === 'local' && s0.welcome && s0.lang === 'en' && s0.guard === 'ok' && blob && blob.stats.runsPlayed === a.runs && s1.runs === a.runs && s1.coins === a.coins && s1.touch.length === 0, JSON.stringify({ s0, s1: { runs: s1.runs, guard: s1.guard }, a })));
  r.push(report('[real SDK local] no errors', d.errors.length === 0, d.errors.slice(0, 2).join(' | ')));
  await d.close();
  // The real SDK on a crazygames.com-like host with no portal around it: disabled after its 7 s check.
  const ctx = await browser.newContext({ viewport: { width: 1216, height: 684 }, locale: 'en-US' });
  await installQaBridge(ctx);
  await ctx.addInitScript(SPY);
  await ctx.route(/^https?:\/\//, (route) => {
    const u = new URL(route.request().url());
    if (u.href === CG_SDK_URL) return route.fulfill({ contentType: 'text/javascript', body: real });
    if (u.hostname === 'glitch-gulp.game-files.crazygames.com') {
      const f = path.join(gameDir, u.pathname === '/' ? 'index.html' : u.pathname);
      if (fs.existsSync(f)) return route.fulfill({ contentType: { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
    }
    return route.abort();
  });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto('https://glitch-gulp.game-files.crazygames.com/index.html');
  await ready(page, 30000);
  const off = await page.evaluate(() => ({ guard: SAVE_GUARD.state, env: window.CrazyGames.SDK.environment, keys: Object.keys(localStorage).filter(k => /^SDK_DATA|^vectorHoleSave/.test(k)), touch: window.__lsTouch, boot: window.__boot }));
  r.push(report('[real SDK local] outside CrazyGames the real SDK turns itself off: the game starts after its check, saves nothing (unavailable)', off.env === 'disabled' && off.guard === 'unavailable' && off.keys.length === 0, JSON.stringify({ ...off, bootMs: Date.now() - t0 })));
  r.push(report(`[real SDK local] its ~7 s check: the loader and its "connecting" line the whole time (start after ${Math.round(off.boot.readyAt || -1)} ms)`, off.boot.first && off.boot.first.loader && off.boot.emptyFrames === 0 && off.boot.waitShownAt !== null && off.boot.loaderAfterReady === false, JSON.stringify(off.boot)));
  await ctx.close();
  return r;
}

export async function runCgData1Checks({ realSdk = null } = {}) {
  fs.mkdirSync(WORK, { recursive: true });
  const pkg = exportPackage({ out: path.join(WORK, 'export') });
  const site = await serve({ root: pkg.gameDir });
  const web = await serve();
  browser = await chromium.launch();
  const all = [];
  try {
    for (const step of [() => newPlayerChecks(site.url), () => guestChecks(site.url), () => accountChecks(site.url), () => conflictChecks(site.url), () => robustnessChecks(site.url), () => webChecks(web.url), () => realSdkChecks(site.url, pkg.gameDir, realSdk)]) {
      try { all.push(...await step()); } catch (e) { all.push(report(`cg-data1: step crashed (${step.toString().slice(6, 40)})`, false, String(e && e.stack || e))); }
    }
  } finally { await browser.close(); site.server.close(); web.server.close(); }
  return all;
}

if (isMain(import.meta.url)) {
  const a = process.argv.find(x => x.startsWith('--real-sdk='));
  const res = await runCgData1Checks({ realSdk: a ? path.resolve(a.slice(11)) : null });
  const failed = res.filter(r => !r.ok);
  res.filter(r => r.notRun).forEach(r => console.log('NOT RUN', r.name));
  console.log(`\n${res.filter(r => r.ok && !r.notRun).length}/${res.filter(r => !r.notRun).length} PASS, NOT RUN ${res.filter(r => r.notRun).length}`);
  failed.forEach(f => console.log('  FAIL', f.name, String(f.details || '').slice(0, 500)));
  process.exit(failed.length ? 1 : 0);
}
