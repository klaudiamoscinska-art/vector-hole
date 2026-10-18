// v23 dev / QA panel: access, test-mode isolation, every panel category,
// and -- above all -- that what the panel unlocks really works in the game
// (a district's mission launches, a skin is worn in a round, a booster
// acts in a mission, a size tier eats its objects), on phones (portrait +
// landscape) and a desktop.
//   node qa/dev-panel.mjs
// The real dev code is never in the repo; set VH_DEV_CODE to also check it
// against a simulated production host (otherwise that one check only
// verifies the gate rejects the local code there).
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, chromium, ROOT, OUT } from './lib.mjs';
import { devCodeHash, devCodeToken } from './dev-code.mjs';

const SHOTS = path.join(OUT, 'dev-panel');
fs.mkdirSync(SHOTS, { recursive: true });

/** In-page helpers: click a panel button through the real DOM (two taps
 *  for a confirm button) and read the toast. */
const HELPERS = `
window.__devOpen = function () {
  const p = document.getElementById('devPanel');
  if (!p || p.classList.contains('hidden')) window.game.devPanel.open();
};
window.__devClick = function (tab, act, arg, opts) {
  opts = opts || {};
  window.__devOpen();
  const t = document.querySelector('#devPanel [data-tab="' + tab + '"]');
  if (!t) throw new Error('no tab ' + tab);
  // A tab click re-renders (and would reset a field just filled in).
  if (!t.classList.contains('active')) t.click();
  if (opts.before) opts.before();
  const sel = '#devPanel [data-act="' + act + '"]' + (arg !== undefined ? '[data-arg="' + arg + '"]' : '');
  const b = document.querySelector(sel);
  if (!b) throw new Error('no button ' + sel);
  b.click();
  if (b.dataset.confirm && opts.confirm !== false) {
    const b2 = document.querySelector(sel + '.armed') || b;
    b2.click();
  }
  const toast = document.getElementById('devToast');
  return toast && !toast.classList.contains('hidden') ? toast.textContent : '';
};
window.__devSet = function (tab, id, value) {
  window.__devOpen();
  const t = document.querySelector('#devPanel [data-tab="' + tab + '"]');
  if (!t.classList.contains('active')) t.click();
  const el = document.getElementById(id);
  if (!el) throw new Error('no field ' + id);
  el.value = value;
};
window.__visible = (id) => { const el = document.getElementById(id); return !!el && !el.classList.contains('hidden'); };
`;

const LOCAL_TOKEN = devCodeToken('dev');

/** A game with dev access (local code) -- and, with `sandbox`, already in
 *  test mode on a copy of `realSave` (or a fresh test save). */
async function devGame(url, { realSave = null, sandbox = 'copy', viewport, mobile, query = '' } = {}) {
  const g = await openGame(url, { save: realSave, viewport, mobile, query });
  await g.page.evaluate((tok) => localStorage.setItem('vectorHoleDevAccess_v1', tok), LOCAL_TOKEN);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.game.devPanel);
  await g.page.addScriptTag({ content: HELPERS });
  if (sandbox) {
    await g.page.evaluate((kind) => window.__devClick('data', kind === 'fresh' ? 'sandbox-fresh' : 'sandbox-copy'), sandbox);
    await g.page.waitForFunction(() => window.game && window.game.devPanel && DEV.sandbox, null, { timeout: 15000 });
    await g.page.addScriptTag({ content: HELPERS });
  }
  return g;
}

async function realSaveFor(url, overrides) {
  const g = await openGame(url);
  const s = await veteranSave(g.page, overrides);
  await g.browser.close();
  return s;
}

const wait = (page, ms) => page.waitForTimeout(ms);

export async function runDevPanelChecks(url) {
  const results = [];
  const push = (name, ok, details) => results.push(report(name, ok, details));
  const veteran = await realSaveFor(url, { missions: 6, runsPlayed: 4, coins: 123 });

  // ---------------------------------------------------------------- access
  {
    const g = await openGame(url, { save: veteran });
    const none = await g.page.evaluate(() => ({
      access: DEV.access, fab: !!document.getElementById('devFab'), panel: !!document.getElementById('devPanel'),
      code: !!document.getElementById('devCodeBox'), panelObj: !!window.game.devPanel
    }));
    push('access: a player has no dev button, panel or code box in the DOM', !none.access && !none.fab && !none.panel && !none.code && none.panelObj, JSON.stringify(none));
    // Hidden gesture: 7 quick taps on the guest ID line in Profil.
    await g.page.evaluate(() => window.game.openProfileScreen());
    const row = g.page.locator('#guestIdLabel');
    for (let i = 0; i < 6; i++) await row.click();
    const after6 = await g.page.evaluate(() => !!document.getElementById('devCodeBox'));
    await row.click();
    await g.page.waitForSelector('#devCodeBox:not(.hidden)');
    push('access: 7 quick taps on the guest ID in Profil ask for the dev code (6 do not)', !after6, `after 6 taps: ${after6}`);
    await g.page.fill('#devCodeInput', 'zly-kod');
    await g.page.click('#devCodeBox button[type="submit"]');
    await wait(g.page, 400);
    const wrong = await g.page.evaluate(() => ({ msg: document.getElementById('devCodeMsg').textContent, access: DEV.access, panel: !!document.getElementById('devPanel'), stored: localStorage.getItem('vectorHoleDevAccess_v1') }));
    push('access: a wrong code is rejected (no access, nothing stored)', !wrong.access && !wrong.panel && !wrong.stored && /Nieprawidłowy/.test(wrong.msg), JSON.stringify(wrong));
    // Five wrong codes lock the box for a while.
    for (let i = 0; i < 5; i++) { await g.page.fill('#devCodeInput', 'x' + i); await g.page.click('#devCodeBox button[type="submit"]'); await wait(g.page, 250); }
    await g.page.fill('#devCodeInput', 'dev');
    await g.page.click('#devCodeBox button[type="submit"]');
    await wait(g.page, 400);
    const locked = await g.page.evaluate(() => ({ msg: document.getElementById('devCodeMsg').textContent, access: DEV.access }));
    push('access: repeated wrong codes lock the code box (even the right code waits)', !locked.access && /Za dużo/.test(locked.msg), JSON.stringify(locked));
    await g.page.evaluate(() => { window.game.devPanel.lockedUntil = 0; });
    await g.page.fill('#devCodeInput', 'dev');
    await g.page.click('#devCodeBox button[type="submit"]');
    await g.page.waitForSelector('#devPanel:not(.hidden)');
    const ok = await g.page.evaluate(() => ({ access: DEV.access, fab: document.getElementById('devFab').textContent, sandbox: DEV.sandbox, gate: !!document.querySelector('#devPanel [data-act="sandbox-copy"]') }));
    push('access: the local code on localhost opens the panel; it starts on the real save and offers test mode first', ok.access && ok.fab === 'DEV' && !ok.sandbox && ok.gate, JSON.stringify(ok));
    // Outside test mode no other tab can change anything.
    await g.page.addScriptTag({ content: HELPERS });
    const gated = await g.page.evaluate(() => {
      document.querySelector('#devPanel [data-tab="economy"]').click();
      const hasCoins = !!document.getElementById('devCoins');
      const coins = window.game.save.coins;
      const fake = document.createElement('button'); fake.dataset.act = 'add-coins'; fake.dataset.arg = '1000'; window.game.devPanel.onAction(fake);
      return { hasCoins, same: window.game.save.coins === coins, gate: !!document.querySelector('#devPanel [data-act="sandbox-fresh"]') };
    });
    push('access: outside test mode every other tab shows only "włącz tryb testowy" and actions are refused', !gated.hasCoins && gated.same && gated.gate, JSON.stringify(gated));
    // ?dev on the URL also asks for the code (no access stored yet).
    await g.browser.close();
    const g2 = await openGame(url, { query: '?dev' });
    await wait(g2.page, 700);
    const viaUrl = await g2.page.evaluate(() => ({ box: !!document.getElementById('devCodeBox') && !document.getElementById('devCodeBox').classList.contains('hidden'), panel: !!document.getElementById('devPanel') }));
    push('access: ?dev in the URL asks for the code, never opens the panel by itself', viaUrl.box && !viaUrl.panel, JSON.stringify(viaUrl));
    const g3 = await openGame(url, { initScript: `localStorage.setItem('vectorHoleDevAccess_v1', ${JSON.stringify(LOCAL_TOKEN)}); window.VectorHoleNative = { track() {} };` });
    await g3.page.evaluate(() => 0);
    const native = await g3.page.evaluate(() => ({ access: DEV.access, loop: devIsLoopback() }));
    push('access: a native wrapper served from localhost does not count as a dev server', !native.access && !native.loop, JSON.stringify(native));
    await g3.browser.close();
    push('access: no runtime errors', g.errors.length + g2.errors.length === 0, [...g.errors, ...g2.errors].slice(0, 2).join(' | '));
    await g2.browser.close();
  }

  // ----------------------------------------- production host (simulated)
  {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'pl-PL' });
    const PROD = 'https://klaudiamoscinska-art.github.io/vector-hole/';
    await context.route(/^https?:\/\/(?!klaudiamoscinska-art\.github\.io)/, r => r.abort());
    await context.route(PROD + '**', (r) => {
      const rel = new URL(r.request().url()).pathname.replace('/vector-hole/', '') || 'index.html';
      const file = path.join(ROOT, rel || 'index.html');
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return r.fulfill({ status: 404, body: '' });
      const type = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(file)] || 'application/octet-stream';
      return r.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'content-type': type } });
    });
    const errors = [];
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(PROD + 'index.html?dev');
    await page.waitForFunction(() => window.game && window.game.devPanel);
    await wait(page, 600);
    await page.fill('#devCodeInput', 'dev');
    await page.click('#devCodeBox button[type="submit"]');
    await wait(page, 600);
    const local = await page.evaluate(() => ({ access: DEV.access, panel: !!document.getElementById('devPanel'), loop: devIsLoopback() }));
    push('production host: the local QA code does not work on the deployed game', !local.access && !local.panel && !local.loop, JSON.stringify(local));
    // A forged token (the local code's hash) in storage is ignored there too.
    await page.evaluate((tok) => localStorage.setItem('vectorHoleDevAccess_v1', tok), LOCAL_TOKEN);
    await page.goto(PROD + 'index.html');
    await page.waitForFunction(() => window.game && window.game.devPanel);
    const forged = await page.evaluate(() => ({ access: DEV.access, fab: !!document.getElementById('devFab') }));
    push('production host: a planted local-code token gives no access', !forged.access && !forged.fab, JSON.stringify(forged));
    // The hash in the source is not a token either.
    await page.evaluate(() => localStorage.setItem('vectorHoleDevAccess_v1', DEV_CODE_HASH));
    await page.goto(PROD + 'index.html');
    await page.waitForFunction(() => window.game && window.game.devPanel);
    const planted = await page.evaluate(() => ({ access: DEV.access, fab: !!document.getElementById('devFab') }));
    push('production host: planting DEV_CODE_HASH from the source gives no access', !planted.access && !planted.fab, JSON.stringify(planted));
    const real = process.env.VH_DEV_CODE;
    if (real) {
      const hashMatches = await page.evaluate(() => DEV_CODE_HASH) === devCodeHash(real);
      await page.goto(PROD + 'index.html?dev');
      await page.waitForFunction(() => window.game && window.game.devPanel);
      await wait(page, 600);
      await page.fill('#devCodeInput', '  ' + real.toUpperCase() + ' ');
      await page.click('#devCodeBox button[type="submit"]');
      await page.waitForSelector('#devPanel:not(.hidden)', { timeout: 8000 }).catch(() => {});
      const ok = await page.evaluate(() => ({ access: DEV.access, panel: !!document.getElementById('devPanel') }));
      push('production host: the real dev code (VH_DEV_CODE) opens the panel (case/space-insensitive)', hashMatches && ok.access && ok.panel, JSON.stringify({ hashMatches, ...ok }));
    } else {
      push('production host: real dev code check skipped (set VH_DEV_CODE to run it)', true, 'skipped');
    }
    push('production host: no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await browser.close();
  }

  // ------------------------------------------------ isolation + data tab
  {
    const g = await devGame(url, { realSave: veteran });
    const { page } = g;
    const realBefore = await page.evaluate(() => localStorage.getItem('vectorHoleSave_v1'));
    const start = await page.evaluate(() => ({ coins: window.game.save.coins, slot: SAVE_SLOT, fab: document.getElementById('devFab').textContent, chip: document.getElementById('devModeChip') && document.getElementById('devModeChip').textContent }));
    push('test mode: starts on a copy of the real save, in its own slot, marked TEST', start.coins === 123 && start.slot === 'vectorHoleSave_devSandbox_v1' && start.fab === 'TEST', JSON.stringify(start));

    // Analytics, cloud mirror, ads and payments are cut off in test mode.
    const iso = await page.evaluate(async () => {
      const gm = window.game;
      gm.save.privacy.analytics = true;
      window.dataLayer = [];
      let mirrored = 0;
      SAVE_MIRROR = () => { mirrored++; };
      gm.analytics.track('qa_probe', {});
      saveGame(gm.save);
      // A native wrapper with real ads/IAP: nothing may reach it.
      let nativeAd = 0, nativeBuy = 0;
      gm.monetization.provider = 'native';
      gm.monetization.sdk = { rewarded: async () => { nativeAd++; return true; }, purchase: async () => { nativeBuy++; return { ok: true }; }, interstitial: async () => { nativeAd++; } };
      const bought = await gm.monetization.purchase('prisms_s');
      CONFIG.ads.demoSeconds = 0.2;
      const adOk = await gm.monetization.rewarded('free_prisms');
      await gm.monetization.interstitial('qa');
      gm.monetization.provider = 'demo'; gm.monetization.sdk = null;
      SAVE_MIRROR = null;
      const sandboxed = gm.analytics.queue.slice(-1)[0];
      return { sink: window.dataLayer.length, mirrored, nativeAd, nativeBuy, bought, adOk, tagged: !!(sandboxed && sandboxed.sandbox) };
    });
    push('test mode: no analytics sink, no cloud mirror, no real ads or payments (demo ad only)', iso.sink === 0 && iso.mirrored === 0 && iso.nativeAd === 0 && iso.nativeBuy === 0 && !iso.bought && iso.adOk, JSON.stringify(iso));

    // Lots of changes in test mode...
    await page.evaluate(() => {
      window.__devClick('economy', 'add-coins', '10000');
      window.__devClick('progress', 'district-unlock-all');
      window.__devClick('gear', 'cos-give-all', '*');
    });
    // ... snapshots: save, change, restore, delete.
    const snap = await page.evaluate(() => {
      window.__devSet('data', 'devSnapName', 'QA <b>stan</b>');
      window.__devClick('data', 'snap-save');
      const coinsAtSnap = window.game.save.coins;
      window.__devSet('economy', 'devCoins', '7');
      window.__devClick('economy', 'set-coins');
      const changed = window.game.save.coins;
      const list = window.game.devPanel.snapshots();
      const idx = list.findIndex(x => x.name.startsWith('QA'));
      const escaped = document.querySelector('#devPanel [data-tab="data"]').click() || !document.querySelector('#devPanel .dev-list b');
      // A confirm button needs two taps: the first one only arms it.
      document.querySelector('#devPanel [data-tab="data"]').click();
      const btn = document.querySelector(`#devPanel [data-act="snap-load"][data-arg="${idx}"]`);
      btn.click();
      const armedOnly = window.game.save.coins === 7;
      btn.click();
      const restored = window.game.save.coins;
      window.__devClick('data', 'snap-del', String(idx));
      return { coinsAtSnap, changed, restored, armedOnly, escaped, left: window.game.devPanel.snapshots().filter(x => x.name.startsWith('QA')).length };
    });
    push('data: a test state is saved and restored (two-tap confirm, names escaped), and deleted', snap.changed === 7 && snap.restored === snap.coinsAtSnap && snap.armedOnly && snap.escaped && snap.left === 0, JSON.stringify(snap));

    // Test state survives a reload, still in test mode.
    await page.reload();
    await page.waitForFunction(() => window.game && window.game.devPanel);
    await page.addScriptTag({ content: HELPERS });
    const kept = await page.evaluate(() => ({ sandbox: DEV.sandbox, coins: window.game.save.coins, districts: window.game.save.campaign.unlockedDistricts.length }));
    push('data: test mode and the test save survive a reload', kept.sandbox && kept.coins === snap.coinsAtSnap && kept.districts === 12, JSON.stringify(kept));

    // Reset of the whole test progress: one tap arms, the second wipes.
    const wipe = await page.evaluate(() => {
      window.__devClick('data', 'sandbox-wipe', undefined, { confirm: false });
      const afterOne = window.game.save.coins;
      window.__devClick('data', 'sandbox-wipe');
      return { afterOne, after: window.game.save.coins, campaign: Object.keys(window.game.save.campaign.completed).length, slot: SAVE_SLOT, realUntouched: localStorage.getItem('vectorHoleSave_v1') };
    });
    push('data: "reset całego postępu testowego" asks twice and wipes only the test save', wipe.afterOne > 0 && wipe.after === 0 && wipe.campaign === 0 && wipe.realUntouched === realBefore, JSON.stringify({ ...wipe, realUntouched: wipe.realUntouched === realBefore }));

    // Export: a backup code of the test save that the game itself reads back.
    const exp = await page.evaluate(() => { window.__devClick('economy', 'add-coins', '1000'); const code = encodeSaveCode(window.game.save); return decodeSaveCode(code).coins; });
    push('data: the test save exports as a backup code the game reads back', exp === 1000, String(exp));

    // Play both modes in test mode, then leave: the real save is byte-identical.
    await page.evaluate(async () => {
      window.__devClick('play', 'arena-start');
      await new Promise(r => setTimeout(r, 300));
      window.__devClick('play', 'a-end', 'win');
      await new Promise(r => setTimeout(r, 600));
      window.game.devPanel.missionId = 'M05';
      window.__devClick('play', 'mission-start-go');
      await new Promise(r => setTimeout(r, 200));
      window.__devClick('play', 'm-success');
      await new Promise(r => setTimeout(r, 1300));
    });
    const realMid = await page.evaluate(() => localStorage.getItem('vectorHoleSave_v1'));
    const testCode = await page.evaluate(() => encodeSaveCode(window.game.save));
    await page.evaluate(() => window.__devClick('data', 'sandbox-exit'));
    await page.waitForFunction(() => window.game && window.game.devPanel && !DEV.sandbox, null, { timeout: 15000 });
    // Opening the game on the real save counts a session (retention) and
    // stamps nothing else: everything but that bookkeeping must match.
    const back = await page.evaluate(() => ({ raw: localStorage.getItem('vectorHoleSave_v1'), coins: window.game.save.coins, slot: SAVE_SLOT, fab: document.getElementById('devFab').textContent, runs: window.game.save.stats.runsPlayed, m05: !!window.game.save.campaign.completed.M05 }));
    const strip = (raw) => { const o = JSON.parse(raw); delete o._sig; delete o.retention; delete o.meta; return JSON.stringify(o); };
    back.same = strip(back.raw) === strip(realBefore);
    push('isolation: after an Arena round, a mission and resets in test mode the real save is byte-identical during the tests and comes back unchanged', realMid === realBefore && back.same && back.coins === 123 && back.slot === 'vectorHoleSave_v1' && back.fab === 'DEV' && back.runs === 4 && !back.m05, JSON.stringify({ duringTests: realMid === realBefore, same: back.same, coins: back.coins, runs: back.runs, m05: back.m05 }));
    // A test save's backup code can't be loaded into the real save.
    const imp = await page.evaluate((code) => {
      const gm = window.game;
      gm.openBackupLoad();
      document.getElementById('backupInput').value = code;
      gm.importBackup();
      return { coins: gm.save.coins, msg: document.getElementById('infoSheet').textContent.includes('zapisu testowego'), raw: localStorage.getItem('vectorHoleSave_v1') };
    }, testCode);
    push('isolation: a test save backup code is refused on the real save', imp.coins === 123 && imp.msg && imp.raw === back.raw, JSON.stringify({ coins: imp.coins, msg: imp.msg }));
    await page.evaluate(() => window.game.closeInfoSheet());
    // And with consent outside test mode the sink does get events (control).
    const control = await page.evaluate(() => { window.game.save.privacy.analytics = true; window.dataLayer = []; window.game.analytics.track('qa_probe', {}); return window.dataLayer.length; });
    push('isolation (control): outside test mode a consented sink still receives events', control === 1, String(control));
    push('isolation + data: no runtime errors', g.errors.length === 0, g.errors.slice(0, 3).join(' | '));
    await g.browser.close();
  }

  // ------------------------------------------------------------- progress
  {
    const g = await devGame(url, { sandbox: 'fresh' });
    const { page } = g;
    // One district: its first mission opens through the real Dzielnice UI.
    const port = await page.evaluate(() => {
      const gm = window.game;
      const before = gm.isMissionPlayable('M09');
      window.__devClick('progress', 'district-unlock', 'port');
      window.game.devPanel.close();
      gm.selectedDistrictId = 'port';
      gm.openCampaignScreen();
      gm.openMissionBriefing('M09');
      document.querySelector('[data-mc-launch]').click();
      return { before, after: gm.isMissionPlayable('M09'), running: gm.running, id: gm.mission && gm.mission.def.id, announced: gm.save.unlocks.announced.includes('district:port') };
    });
    push('progress: unlocking one district (Port Syntez) lets its first mission launch from the real briefing', !port.before && port.after && port.running && port.id === 'M09' && port.announced, JSON.stringify(port));
    const all = await page.evaluate(() => {
      window.__devClick('progress', 'district-unlock-all');
      const gm = window.game;
      return { n: gm.save.campaign.unlockedDistricts.length, firsts: DISTRICTS.every(d => gm.isMissionPlayable(d.missions[0])), deep: gm.isMissionPlayable('M59') };
    });
    push('progress: "odblokuj wszystkie dzielnice" opens all 12 (each first mission playable, later ones still need the previous)', all.n === 12 && all.firsts && !all.deep, JSON.stringify(all));
    // All missions playable + jump by ID (typed "m59"), launched via the real GRAJ.
    const jump = await page.evaluate(() => {
      const gm = window.game;
      window.__devOpen();
      document.querySelector('#devPanel [data-tab="progress"]').click();
      document.querySelector('#devPanel [data-act="open-missions"]').click();
      window.__devSet('progress', 'devMissionCode', 'm59');
      const t = window.__devClick('progress', 'mission-pick');
      window.__devClick('progress', 'mission-brief');
      const brief = window.__visible('missionBriefing');
      document.querySelector('[data-mc-launch]').click();
      return { t, brief, openFlag: DEV.openMissions, running: gm.running, id: gm.mission && gm.mission.def.id };
    });
    push('progress: "wszystkie misje grywalne" + jump to M59 by typed ID -> its briefing GRAJ starts M59', jump.openFlag && jump.brief && jump.running && jump.id === 'M59', JSON.stringify(jump));
    // Start any mission directly (skipping progression), then success / failure.
    const ends = await page.evaluate(async () => {
      const gm = window.game;
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      window.game.devPanel.missionId = 'M32';
      window.__devClick('play', 'mission-start');
      const card = window.__visible('missionStartOverlay') && gm.mission.def.id === 'M32';
      window.__devClick('play', 'm-success');
      await sleep(1300);
      const win = { screen: window.__visible('missionResultScreen'), done: !!gm.save.campaign.completed.M32, stars: gm.save.campaign.stars.M32 };
      window.game.devPanel.missionId = 'M33';
      window.__devClick('play', 'mission-start-go');
      window.__devClick('play', 'm-success3');
      await sleep(1300);
      const win3 = gm.save.campaign.stars.M33;
      window.game.devPanel.missionId = 'M34';
      window.__devClick('play', 'mission-start-go');
      window.__devClick('play', 'm-fail', 'hit');
      await sleep(200);
      const fail = { screen: window.__visible('missionResultScreen'), reason: gm.mission.failReason, done: !!gm.save.campaign.completed.M34, fails: gm.save.campaign.fails.M34 };
      window.__devClick('play', 'mission-start-go');
      window.__devClick('play', 'm-fail', 'time');
      await sleep(400);
      const timeFail = { screen: window.__visible('missionResultScreen'), reason: gm.mission.failReason };
      return { card, win, win3, fail, timeFail };
    });
    push('progress: start any mission (M32) without its requirements; "sukces" ends it through the real result screen', ends.card && ends.win.screen && ends.win.done && (ends.win.stars & 1) === 1, JSON.stringify(ends.win));
    push('progress: "sukces ★★★" earns all three stars; "porażka" (hit / time) shows the real defeat with its reason', ends.win3 === 7 && ends.fail.screen && ends.fail.reason === 'hit' && !ends.fail.done && ends.fail.fails === 1 && ends.timeFail.screen && ends.timeFail.reason === 'time', JSON.stringify({ win3: ends.win3, fail: ends.fail, timeFail: ends.timeFail }));
    // Progress up to Port's boss: districts open the game's way, boosters unlock.
    const prog = await page.evaluate(() => {
      const gm = window.game;
      window.__devOpen();
      document.querySelector('#devPanel [data-tab="progress"]').click();
      if (DEV.openMissions) document.querySelector('#devPanel [data-act="open-missions"]').click();
      gm.devPanel.missionId = 'M12';
      window.__devClick('progress', 'progress-to', '7');
      const c = gm.save.campaign;
      return {
        done: Object.keys(c.completed).length, d: c.unlockedDistricts.slice(), next: gm.nextCampaignMissionId(),
        boosters: gm.boostersUnlocked(), gift: gm.save.boosters.gift, stock: gm.save.boosters.magnet, stars: gm.totalStars(), m33: !!c.completed.M33
      };
    });
    push('progress: "postęp do M12 ★★★" clears 30 missions in play order, opens Park/Port/Galeria, next = M13, boosters + gift unlocked', prog.done === 30 && prog.d.join() === 'plac,park,port,galeria' && prog.next === 'M13' && prog.boosters && prog.gift && prog.stock === 1 && prog.stars === 90 && prog.m33, JSON.stringify(prog));
    // Player level, XP, Core City (rewards!), Arena runs.
    const lvl = await page.evaluate(() => {
      const gm = window.game;
      window.__devSet('progress', 'devLevel', '7'); window.__devClick('progress', 'set-level');
      const hubLevel = document.getElementById('hubPlayerLevelValue').textContent;
      window.__devSet('progress', 'devXp', '2000'); window.__devClick('progress', 'add-xp');
      const afterXp = gm.save.player.level;
      window.__devSet('progress', 'devCore', '6'); window.__devClick('progress', 'set-core');
      window.__devSet('progress', 'devRuns', '3'); window.__devClick('progress', 'set-runs');
      return { hubLevel, afterXp, core: gm.save.hub.coreLevel, krysztal: gm.save.owned.includes('krysztal'), pryzmat: gm.save.owned.includes('pryzmat'), badge: gm.save.badges.includes('pryzmat'), wyzwania: gm.isWyzwaniaUnlocked(), warsztat: gm.isWarsztatUnlocked(), lvlLabel: document.getElementById('hubLevelLabel').textContent };
    });
    push('progress: player level/XP (official level-ups), Core City LVL 6 grants its real rewards, Arena runs open Wyzwania/Warsztat', lvl.hubLevel === '7' && lvl.afterXp > 7 && lvl.core === 6 && lvl.krysztal && lvl.pryzmat && lvl.badge && lvl.wyzwania && lvl.warsztat && lvl.lvlLabel === 'LVL 6', JSON.stringify(lvl));
    // Clear one mission's progress; clear the campaign.
    const clr = await page.evaluate(() => {
      const gm = window.game;
      gm.devPanel.missionId = 'M12';
      window.__devClick('progress', 'mission-clear');
      const m12 = !!gm.save.campaign.completed.M12;
      window.__devClick('progress', 'progress-clear');
      return { m12, total: Object.keys(gm.save.campaign.completed).length, d: gm.save.campaign.unlockedDistricts.join() };
    });
    push('progress: clearing one mission / the whole campaign', !clr.m12 && clr.total === 0 && clr.d === 'plac', JSON.stringify(clr));
    // Features with the game's own celebration.
    const feat = await page.evaluate(async () => {
      const gm = window.game;
      window.__devClick('data', 'sandbox-wipe');
      window.__devOpen();
      document.querySelector('#devPanel [data-tab="progress"]').click();
      document.getElementById('devCelebrate').click();
      window.__devClick('progress', 'feature-unlock', 'boosters');
      await new Promise(r => setTimeout(r, 900));
      const overlay = window.__visible('unlockOverlay') && document.getElementById('unlockTitle').textContent;
      gm.showNextUnlock();
      gm.openMissionBriefing('M01');
      const tiles = document.querySelectorAll('#briefingCard .mc-boost').length;
      return { overlay, unlocked: gm.boostersUnlocked(), gift: gm.save.boosters.time, tiles };
    });
    push('progress: unlocking a feature (Wzmocnienia) plays the real "ODBLOKOWANO!" card and the briefing offers boosters (+ gift)', feat.overlay === 'WZMOCNIENIA' && feat.unlocked && feat.gift === 1 && feat.tiles === 5, JSON.stringify(feat));
    push('progress: no runtime errors', g.errors.length === 0, g.errors.slice(0, 3).join(' | '));
    await g.browser.close();
  }

  // ------------------------------------------------- Warsztat + economy
  {
    const g = await devGame(url, { realSave: veteran });
    const { page } = g;
    // One skin unlocked in the panel -> worn from the real Warsztat grid -> it shows in a round (PX02 D+: a look only).
    const skin = await page.evaluate(async () => {
      const gm = window.game;
      window.__devClick('gear', 'cos-give', 'skin|gold');
      window.__devClick('gear', 'cos-show', 'skin');
      const shop = window.__visible('shopScreen');
      const cards = Array.from(document.querySelectorAll('#skinGrid .skin-card'));
      const card = cards.find(c => /Neonowe Złoto/.test(c.textContent));
      const ownedCard = !!card && !card.classList.contains('locked');
      card.click();
      const worn = gm.save.selected;
      gm.startRound();
      await new Promise(r => setTimeout(r, 200));
      const res = { shop, ownedCard, worn, inRound: gm.player.skin, perkFn: typeof gm.perk };
      window.__devClick('play', 'a-end', 'now');
      await new Promise(r => setTimeout(r, 500));
      return res;
    });
    // PX02 D+: vortices are looks only -- the worn one shows in the round, with no perk code at all.
    push('warsztat: a skin unlocked in the panel shows as owned in the real Warsztat, is worn by a tap and shows in a round (a look, no perk)', skin.shop && skin.ownedCard && skin.worn === 'gold' && skin.inRound === 'gold' && skin.perkFn === 'undefined', JSON.stringify(skin));
    const allCos = await page.evaluate(async () => {
      const gm = window.game, s = gm.save;
      window.__devClick('gear', 'cos-give-all', '*');
      const counts = [s.owned.length, s.auras.owned.length, s.effects.owned.length, s.overdriveSkins.owned.length];
      window.__devClick('gear', 'cos-wear', 'aura|vortex');
      window.__devClick('gear', 'cos-wear', 'overdriveSkin|zielona_burza');
      gm.startRound();
      await new Promise(r => setTimeout(r, 150));
      const aura = gm.player.auraId;
      window.__devClick('play', 'a-event', 'overdrive');
      await new Promise(r => setTimeout(r, 400));
      const od = gm.overdriveActive;
      window.__devClick('play', 'a-end', 'now');
      await new Promise(r => setTimeout(r, 400));
      window.__devClick('gear', 'cos-take', 'aura|vortex');
      return { counts, expected: [SKINS.length, AURAS.length, EAT_EFFECTS.length, OVERDRIVE_SKINS.length], aura, od, auraAfterTake: s.auras.selected, ownedAfterTake: s.auras.owned.includes('vortex') };
    });
    push('warsztat: unlock all cosmetics; a worn Smuga is on the vortex in a round, Finisz in its overdrive; taking a worn item puts the default back', allCos.counts.join() === allCos.expected.join() && allCos.aura === 'vortex' && allCos.od && allCos.auraAfterTake === 'none' && !allCos.ownedAfterTake, JSON.stringify(allCos));
    // Booster stock ("poziom" of a tool) -> the real briefing -> the magnet pulls in a mission.
    const boost = await page.evaluate(async () => {
      const gm = window.game;
      window.__devClick('gear', 'feature-unlock', 'boosters');
      window.__devSet('gear', 'devBoost-magnet', '3'); window.__devClick('gear', 'booster-set', 'magnet');
      gm.devPanel.close();
      gm.openMissionBriefing('M01');
      const badge = document.querySelector('#briefingCard [data-booster="magnet"] .mc-boost-badge').textContent;
      gm.toggleBriefingBooster('magnet');
      document.querySelector('[data-mc-launch]').click();
      gm.beginMissionPlay();
      const stock = gm.save.boosters.magnet;
      const has = gm.activeMutations.has('magnes');
      // A fragment just inside the pull range drifts toward the vortex.
      const p = gm.player;
      const e = gm.campaignEntities.find(x => x.type === 'fragment' && !x.consumed);
      e.x = p.x + p.radius * 1.2; e.y = p.y;
      const d0 = Math.hypot(e.x - p.x, e.y - p.y);
      gm.updateMutationEffectsCampaign(0.25);
      const d1 = Math.hypot(e.x - p.x, e.y - p.y);
      gm.leaveCampaignMission();
      return { badge, stock, has, d0: Math.round(d0), d1: Math.round(d1) };
    });
    push('warsztat: booster stock set in the panel shows in the briefing, is used on launch, and the Magnes really pulls objects', boost.badge === '×3' && boost.stock === 2 && boost.has && boost.d1 < boost.d0, JSON.stringify(boost));
    // Economy: set coins -> buy a coin cosmetic and a prism cosmetic through the real Warsztat flow.
    const econ = await page.evaluate(async () => {
      const gm = window.game, s = gm.save;
      window.__devSet('economy', 'devCoins', '5000'); window.__devClick('economy', 'set-coins');
      const shown = document.getElementById('coinCountMenu').textContent;
      window.__devSet('economy', 'devPrisms', '100'); window.__devClick('economy', 'set-prisms');
      // Hand back two items so they can be bought for real.
      window.__devClick('gear', 'cos-take', 'skin|white');
      window.__devClick('gear', 'cos-take', 'aura|ember');
      gm.devPanel.close();
      gm.openWarsztatScreen();
      gm.onCosmeticPick('skin', SKINS.find(x => x.id === 'white'));
      const sheet1 = document.getElementById('btnInfoSheetAction').textContent;
      document.getElementById('btnInfoSheetAction').click();
      gm.onCosmeticPick('aura', AURAS.find(x => x.id === 'ember'));
      document.getElementById('btnInfoSheetAction').click();
      return { shown, sheet1, coins: s.coins, prisms: s.prisms, white: s.owned.includes('white') && s.selected === 'white', ember: s.auras.owned.includes('ember') && s.auras.selected === 'ember' };
    });
    push('economy: coins set in the panel show in the hub and buy a Wir via the real "KUP I ZAŁÓŻ" (coins and ◆ spent, item worn)', econ.shown === '5000' && /KUP/.test(econ.sheet1) && econ.coins === 3000 && econ.prisms === 85 && econ.white && econ.ember, JSON.stringify(econ));
    // Simulated purchases: exactly the real grant, one-time packs once, undo.
    const iap = await page.evaluate(async () => {
      const gm = window.game, s = gm.save;
      const c0 = s.coins, p0 = s.prisms, b0 = s.boosters.time;
      window.__devClick('economy', 'iap-sim', 'starter_pack');
      await new Promise(r => setTimeout(r, 800));
      const thanks = window.__visible('unlockOverlay') && /DZIĘKUJEMY|Pakiet/.test(document.getElementById('unlockOverlay').textContent);
      document.getElementById('unlockOverlay').classList.add('hidden'); gm.unlockQueue = [];
      const after = { coins: s.coins - c0, prisms: s.prisms - p0, boosters: s.boosters.time - b0, aura: s.auras.owned.includes('starter_glow') };
      gm.grantProduct(IAP_PRODUCTS.find(p => p.sku === 'starter_pack'));
      const twice = s.coins - c0;
      gm.openWarsztatScreen();
      document.getElementById('tabAuras').click();
      const inGrid = Array.from(document.querySelectorAll('#auraGrid .skin-card')).some(c => /Zorza Startu/.test(c.textContent) && !c.classList.contains('locked'));
      window.__devClick('economy', 'iap-undo', 'starter_pack');
      const undone = !s.entitlements.purchased.includes('starter_pack');
      window.__devClick('economy', 'iap-sim', 'no_ads');
      const noAds = s.entitlements.noAds;
      return { thanks, after, twice, inGrid, undone, noAds };
    });
    push('economy: a simulated purchase grants exactly the pack (1500 ◇, 60 ◆, 3× boosters, Zorza Startu in the Warsztat grid), once', iap.thanks && iap.after.coins === 1500 && iap.after.prisms === 60 && iap.after.boosters === 3 && iap.after.aura && iap.twice === 1500 && iap.inGrid && iap.undone && iap.noAds, JSON.stringify(iap));
    // Rewards land where the game shows them.
    const rew = await page.evaluate(async () => {
      const gm = window.game, s = gm.save;
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      gm.devPanel.clearCelebrations();
      window.__devClick('gear', 'cos-take', 'aura|impuls');
      window.__devClick('economy', 'reward-core', '2');
      await sleep(800);
      const coreCard = window.__visible('unlockOverlay') && document.getElementById('unlockTitle').textContent;
      const go = !document.getElementById('btnUnlockGo').classList.contains('hidden');
      document.getElementById('btnUnlockGo').click();
      await sleep(200);
      const inShop = window.__visible('shopScreen');
      gm.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden');
      const c0 = s.coins;
      window.__devClick('economy', 'reward-chest');
      await sleep(800);
      const chest = s.coins > c0 && s.freeChest.nextAt > Date.now();
      gm.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden');
      window.__devClick('economy', 'chest-ready');
      const ready = s.freeChest.nextAt === 0;
      window.__devClick('economy', 'reward-login');
      const login = window.__visible('loginRewardScreen');
      document.getElementById('btnLoginClaim').click();
      window.__devClick('economy', 'reset-ads');
      return { coreCard, go, inShop, aura: s.auras.owned.includes('impuls'), chest, ready, login, ads: Object.keys(s.ads.used).length };
    });
    push('economy: rewards (Core City LVL 2 Smuga + "ZAŁÓŻ W WARSZTACIE", free chest, login calendar) appear where the game shows them', rew.coreCard === 'Smuga „Impuls”' && rew.go && rew.inShop && rew.aura && rew.chest && rew.ready && rew.login && rew.ads === 0, JSON.stringify(rew));
    push('warsztat + economy: no runtime errors', g.errors.length === 0, g.errors.slice(0, 3).join(' | '));
    await g.browser.close();
  }

  // ------------------------------------------------------------ gameplay
  {
    const g = await devGame(url, { realSave: veteran });
    const { page } = g;
    const arena = await page.evaluate(async () => {
      const gm = window.game;
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      window.__devClick('play', 'arena-start');
      await sleep(150);
      const vehicle = gm.objects.find(o => TIERS[o.tier].minSizeTier === 2);
      const before = { tier: getSizeTierIndex(gm.player.radius), canEat: gm.holeCanEat(gm.player, vehicle) };
      window.__devClick('play', 'set-tier', '3');
      const after = { tier: getSizeTierIndex(gm.player.radius), canEat: gm.holeCanEat(gm.player, vehicle) };
      // ... and it really swallows one on the board.
      vehicle.x = gm.player.x; vehicle.y = gm.player.y;
      gm.devPanel.close();
      await sleep(900);
      const eaten = !gm.objects.includes(vehicle) || vehicle.eating || vehicle.consumed;
      window.__devClick('play', 'set-tier', '1');
      const down = getSizeTierIndex(gm.player.radius);
      window.__devSet('play', 'devRadius', '70'); window.__devClick('play', 'set-radius');
      const r70 = Math.round(gm.player.radius);
      window.__devClick('play', 'mutation', 'magnet_pulse');
      window.__devClick('play', 'a-event', 'golden');
      const golden = !!gm.goldenObj;
      window.__devClick('play', 'a-event', 'frenzy');
      await sleep(100);
      const frenzy = gm.frenzyActive;
      const mag = gm.magnetUntil === Infinity;
      window.__devClick('play', 'cards');
      const cards = window.__visible('evolutionOverlay') && gm.evolutionPending;
      gm.skipEvolutionOffer();
      window.__devClick('play', 'a-end', 'win');
      await sleep(700);
      const win = { screen: window.__visible('gameOverScreen'), eyebrow: document.getElementById('resultEyebrow').textContent, place: document.getElementById('finalPlace').textContent };
      window.__devClick('play', 'arena-start');
      await sleep(150);
      window.__devClick('play', 'a-end', 'lose');
      await sleep(700);
      const lose = { screen: window.__visible('gameOverScreen'), place: document.getElementById('finalPlace').textContent };
      return { before, after, eaten, down, r70, golden, frenzy, mag, cards, win, lose };
    });
    push('gameplay (Arena): size tier T3 unlocks T3 objects (and swallows one), back to T1, exact radius', !arena.before.canEat && arena.after.tier === 2 && arena.after.canEat && arena.eaten && arena.down === 0 && Math.abs(arena.r70 - 70) <= 1, JSON.stringify({ before: arena.before, after: arena.after, eaten: arena.eaten, down: arena.down, r70: arena.r70 }));
    // PX02 D+: the Arena run tools are gone, so the panel has none to give.
    push('gameplay (Arena): mutation, Złoty Rdzeń, SZAŁ and evolution cards on demand', arena.mag && arena.golden && arena.frenzy && arena.cards, JSON.stringify(arena));
    push('gameplay (Arena): forced win shows ZWYCIĘSTWO 1., forced loss the last place — the real result screen', arena.win.screen && arena.win.eyebrow === 'ZWYCIĘSTWO!' && arena.win.place === '1.' && arena.lose.screen && arena.lose.place === '6.', JSON.stringify({ win: arena.win, lose: arena.lose }));
    const mission = await page.evaluate(async () => {
      const gm = window.game;
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      gm.devPanel.missionId = 'M16';
      document.querySelector('#devPanel') && null;
      window.__devOpen();
      document.querySelector('#devPanel [data-tab="play"]').click();
      document.querySelector('.dev-start-boost[value="shield"]').checked = true;
      window.__devClick('play', 'mission-start-go');
      const startBoost = gm.mission.shields;
      const ent = gm.campaignEntities.find(e => e.stats.minTier === 4 && !e.consumed && e.live && e.type !== 'landmark' && e.type !== 'gate' && !(e.type === 'node' || e.type === 'pylon'));
      window.__devClick('play', 'set-tier', '4');
      const tier = gm.campaignPlayerTier().id;
      let eaten = null;
      if (ent) {
        ent.x = gm.player.x; ent.y = gm.player.y;
        gm.handleCampaignEating();
        eaten = ent.eating || ent.consumed;
      }
      ['time', 'magnet', 'sprint'].forEach(id => window.__devClick('play', 'live-booster', id));
      const t0 = gm.mission.timeRemaining;
      window.__devClick('play', 'm-time', '30');
      const live = { magnet: gm.activeMutations.has('magnes'), sprint: gm.player.perkSpeedMult, plus30: Math.round(gm.mission.timeRemaining - t0) };
      window.__devClick('play', 'power', 'skaner');
      const power = gm.activeMutations.has('skaner');
      window.__devClick('data', 'mission-reset');
      const reset = { id: gm.mission.def.id, elapsed: gm.mission.elapsed, intro: gm.introPending, shields: gm.mission.shields };
      return { startBoost, tier, entType: ent && ent.type, eaten, live, power, reset };
    });
    push('gameplay (mission): start with a free booster, size T4 eats a T4 object, live boosters (Zegar/Magnes/Sprint), +30 s, a power', mission.startBoost === 2 && mission.tier === 'T4' && mission.eaten === true && mission.live.magnet && Math.abs(mission.live.sprint - 1.15) < 1e-9 && mission.live.plus30 === 30 && mission.power, JSON.stringify(mission));
    push('data: "restart bieżącej misji" starts the same mission from scratch (same boosters)', mission.reset.id === 'M16' && mission.reset.elapsed === 0 && mission.reset.intro && mission.reset.shields === 2, JSON.stringify(mission.reset));
    // Opening the panel mid-round pauses without the pause sheet; closing resumes.
    const pause = await page.evaluate(async () => {
      const gm = window.game;
      gm.devPanel.close();
      gm.beginMissionPlay();
      document.getElementById('devFab').click();
      const open = { paused: gm.paused, sheet: window.__visible('pauseSheet'), panel: window.__visible('devPanel') };
      const t = gm.mission.elapsed;
      await new Promise(r => setTimeout(r, 300));
      const frozen = gm.mission.elapsed === t;
      document.querySelector('#devPanel .dev-close').click();
      await new Promise(r => setTimeout(r, 300));
      return { open, frozen, resumed: !gm.paused && gm.mission.elapsed > t };
    });
    // Review fixes: mid-round the panel opens on Rozgrywka with the round's
    // controls first; starting something new asks twice; the demo ad hands
    // the round back; a toast never outlives the panel.
    const ux = await page.evaluate(async () => {
      const gm = window.game;
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      gm.devPanel.tab = 'data';
      gm.devPanel.close();
      document.getElementById('devFab').click();
      const tab = document.querySelector('#devPanel .dev-tab.active').dataset.tab;
      const firstSec = document.querySelectorAll('#devBody .dev-h')[1].textContent; // after the 'Teraz' status line
      const start = document.querySelector('#devPanel [data-act="arena-start"]');
      start.click();
      const armed = start.classList.contains('armed') && gm.mode === 'campaign' && gm.running;
      gm.devPanel.close();
      await sleep(100);
      CONFIG.ads.demoSeconds = 0.3;
      window.__devClick('screens', 'scr-ad');
      await sleep(800);
      const t = gm.mission.elapsed;
      await sleep(250);
      const afterAd = { paused: gm.paused, ticking: gm.mission.elapsed > t };
      window.__devOpen();
      const toast = !document.getElementById('devToast').classList.contains('hidden');
      gm.devPanel.close();
      return { tab, firstSec, armed, afterAd, toast };
    });
    push('ux: mid-mission the panel opens on Rozgrywka with the live mission first; NOWA RUNDA asks twice; the demo ad hands the mission back; no stale toast', ux.tab === 'play' && /^Trwa misja/.test(ux.firstSec) && ux.armed && !ux.afterAd.paused && ux.afterAd.ticking && !ux.toast, JSON.stringify(ux));
    push('gameplay: the DEV button mid-mission pauses the clock (no pause sheet), closing resumes', pause.open.paused && !pause.open.sheet && pause.open.panel && pause.frozen && pause.resumed, JSON.stringify(pause));
    push('gameplay: no runtime errors', g.errors.length === 0, g.errors.slice(0, 3).join(' | '));
    await g.browser.close();
  }

  // ------------------------------------------------------------- screens
  {
    const g = await devGame(url, { realSave: veteran });
    const { page } = g;
    const scr = await page.evaluate(async () => {
      const gm = window.game;
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const out = {};
      const hideUnlocks = () => { gm.unlockQueue = []; document.getElementById('unlockOverlay').classList.add('hidden'); };
      gm.devPanel.missionId = 'M02';
      window.__devClick('screens', 'scr-mission', 'win'); await sleep(1300);
      out.missionWin = window.__visible('missionResultScreen') && !document.getElementById('missionResultScreen').classList.contains('fail');
      hideUnlocks();
      window.__devClick('screens', 'scr-mission', 'racer'); await sleep(300);
      out.missionRacer = window.__visible('missionResultScreen') && gm.mission.failReason === 'racer';
      window.__devClick('screens', 'scr-arena', 'lose'); await sleep(700);
      out.arenaLose = window.__visible('gameOverScreen');
      hideUnlocks();
      window.__devClick('screens', 'scr-levelup'); await sleep(900);
      out.levelUp = document.getElementById('resultXpCard').classList.contains('leveled');
      hideUnlocks();
      window.__devClick('screens', 'scr-brief'); out.brief = window.__visible('missionBriefing');
      window.__devClick('screens', 'scr-start-card'); out.startCard = window.__visible('missionStartOverlay');
      window.__devClick('screens', 'scr-revive'); out.revive = window.__visible('reviveOverlay');
      window.__devClick('screens', 'scr-pause'); out.pause = window.__visible('pauseSheet');
      window.__devClick('screens', 'scr-unlock'); await sleep(800); out.unlock = window.__visible('unlockOverlay');
      hideUnlocks();
      CONFIG.ads.demoSeconds = 0.3;
      window.__devClick('screens', 'scr-ad'); out.ad = window.__visible('adOverlay');
      await sleep(600);
      window.__devClick('screens', 'scr-cards'); out.cards = window.__visible('evolutionOverlay');
      gm.skipEvolutionOffer();
      window.__devClick('screens', 'scr-consent'); out.consent = window.__visible('consentBar');
      window.__devClick('screens', 'scr-welcome', undefined, { confirm: false });
      out.welcomeAsks = !gm.isFirstRun();
      window.__devClick('screens', 'scr-welcome'); out.welcome = window.__visible('hubWelcome') && gm.isFirstRun();
      return out;
    });
    const missing = Object.entries(scr).filter(([, v]) => !v).map(([k]) => k);
    push('screens: mission win/defeat, Arena defeat, level-up, briefing, start card, +20 s offer, pause, unlock card, ad, evolution cards, consent, welcome', missing.length === 0, missing.length ? 'missing: ' + missing.join(', ') : JSON.stringify(scr));
    push('screens: no runtime errors', g.errors.length === 0, g.errors.slice(0, 3).join(' | '));
    await g.browser.close();
  }

  // --------------------------------------------- phones + desktop layout
  for (const [label, viewport, mobile] of [['iPhone SE 375x667', { width: 375, height: 667 }, true], ['iPhone 16 Pro 402x874', { width: 402, height: 874 }, true],
    ['phone landscape 844x390', { width: 844, height: 390 }, true], ['phone landscape 667x375', { width: 667, height: 375 }, true], ['desktop 1440x900', { width: 1440, height: 900 }, false]]) {
    const g = await devGame(url, { realSave: veteran, viewport, mobile });
    const { page } = g;
    const lay = await page.evaluate(async () => {
      const W = document.getElementById('app').getBoundingClientRect();
      const fab = document.getElementById('devFab').getBoundingClientRect();
      window.__devOpen();
      const checks = [];
      for (const t of ['data', 'progress', 'gear', 'economy', 'play', 'screens']) {
        document.querySelector(`#devPanel [data-tab="${t}"]`).click();
        const body = document.getElementById('devBody');
        const sheet = document.querySelector('#devPanel .dev-sheet').getBoundingClientRect();
        const close = document.querySelector('#devPanel .dev-close').getBoundingClientRect();
        const btns = Array.from(body.querySelectorAll('.dev-btn'));
        const tooWide = btns.filter(b => b.getBoundingClientRect().right > sheet.right + 1).length;
        checks.push({ t, overflowX: body.scrollWidth - body.clientWidth, inView: sheet.left >= W.left - 1 && sheet.right <= W.right + 1 && sheet.top >= W.top - 1 && sheet.bottom <= W.bottom + 1, closeOk: close.width >= 36 && close.top >= W.top && close.right <= W.right + 1, tooWide, scrolls: body.scrollHeight > body.clientHeight ? 1 : 0, minBtn: Math.min(...btns.map(b => b.getBoundingClientRect().height)) });
      }
      const tabs = document.querySelector('#devPanel .dev-tabs');
      return { checks, fabIn: fab.width > 0 && fab.left >= W.left && fab.bottom <= W.bottom, tabsScroll: tabs.scrollWidth > tabs.clientWidth };
    });
    await page.evaluate(() => document.querySelector('#devPanel [data-tab="progress"]').click());
    await page.screenshot({ path: path.join(SHOTS, `${label.replace(/[^a-z0-9]+/gi, '_')}.png`) });
    const bad = lay.checks.filter(c => c.overflowX > 1 || !c.inView || !c.closeOk || c.tooWide || c.minBtn < 30 * (viewport.width >= 960 ? 0.75 : 1));
    push(`phone/desktop layout ${label}: panel fits, no sideways scroll, close button reachable, buttons ≥ 30 px`, bad.length === 0 && lay.fabIn, bad.length ? JSON.stringify(bad) : `fab ok, tabs scroll: ${lay.tabsScroll}`);
    // In a round on this screen too: the DEV button is there and the panel opens over the HUD.
    const inRound = await page.evaluate(async () => {
      window.__devClick('play', 'arena-start');
      await new Promise(r => setTimeout(r, 200));
      const fab = document.getElementById('devFab').getBoundingClientRect();
      const hit = document.elementFromPoint(fab.left + fab.width / 2, fab.top + fab.height / 2);
      return { fabOnTop: hit && hit.id === 'devFab' };
    });
    await page.screenshot({ path: path.join(SHOTS, `${label.replace(/[^a-z0-9]+/gi, '_')}_round.png`) });
    push(`phone/desktop layout ${label}: the DEV button stays tappable over the round HUD`, inRound.fabOnTop, JSON.stringify(inRound));
    push(`phone/desktop layout ${label}: no runtime errors`, g.errors.length === 0, g.errors.slice(0, 2).join(' | '));
    await g.browser.close();
  }

  return results;
}

if (process.argv[1] && process.argv[1].endsWith('dev-panel.mjs')) {
  const { server, url } = await serve();
  const res = await runDevPanelChecks(url);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} dev panel checks passed`);
  process.exit(failed.length ? 1 : 0);
}
