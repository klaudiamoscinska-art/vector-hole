// v19 „Premiera”: what a portal / global launch needs.
//  - English: a non-Polish browser gets the whole game in English -- a bot
//    sweeps every screen, sheet, all 241 mission briefings, start cards,
//    results and live rounds (banners, float texts) with ?i18n=log and
//    asserts no Polish reaches the screen; Profil switches languages.
//  (v22: the energy limit -- once off on portals, on on the web -- is gone
//  everywhere; qa/v22.mjs checks that.)
//  - Safe progress: CrazyGames' data module (mocked here) restores the
//    save with more progress and mirrors every save; a backup code moves
//    progress between devices; a plain load never re-stamps savedAt.
// Usage: node qa/v19.mjs
import { serve, openGame, veteranSave, allDistrictsSave, report, ARENA_BOT, CAMPAIGN_BOT } from './lib.mjs';

/** A CrazyGames SDK stand-in: data module backed by an object, markers. */
const mockCrazy = (remote) => `
  window.__cgStore = ${JSON.stringify(remote || {})};
  window.__cgCalls = [];
  window.CrazyGames = { SDK: {
    init: async () => {},
    game: { gameplayStart() { __cgCalls.push('start'); }, gameplayStop() { __cgCalls.push('stop'); }, loadingStop() {}, happytime() {} },
    ad: { requestAd: (t, cb) => { cb && cb.adFinished && cb.adFinished(); } },
    data: { getItem: k => (k in __cgStore ? __cgStore[k] : null), setItem: (k, v) => { __cgStore[k] = v; __cgCalls.push('set'); }, removeItem: k => { delete __cgStore[k]; __cgCalls.push('remove'); } }
  } };`;

async function seededPage(url, opts, saveOpts, mutate) {
  const g = await openGame(url, opts);
  if (saveOpts) {
    const save = typeof saveOpts === 'function' ? await saveOpts(g.page) : await veteranSave(g.page, saveOpts);
    if (mutate) mutate(save);
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  }
  return g;
}

export async function runV19Checks(url) {
  const results = [];

  // --- English: nothing Polish reaches the screen ---------------------------
  {
    const g = await seededPage(url, { locale: 'en-US', query: '?i18n=log' }, p => allDistrictsSave(p), s => { s.coins = 50000; s.prisms = 500; });
    await g.page.addScriptTag({ content: ARENA_BOT });
    await g.page.addScriptTag({ content: CAMPAIGN_BOT });
    const r = await g.page.evaluate(async () => {
      const wait = ms => new Promise(res => setTimeout(res, ms));
      const gm = window.game;
      const out = { lang: document.documentElement.lang, i18n: I18N.lang };
      gm.showScreen('mainMenu'); await wait(250);
      out.play = document.getElementById('btnStart').innerText.replace(/\s+/g, ' ');
      for (const fn of ['openCoreCityRoadmap', 'openPlayerLevelInfo', 'openFreeChest']) { try { gm[fn](); } catch (e) {} await wait(80); gm.closeInfoSheet(); }
      gm.openCurrencyInfo(true); gm.closeInfoSheet(); gm.openCurrencyInfo(false); gm.closeInfoSheet();
      // v22: the locked-tab sheets (each names its own mode's unlock).
      gm.openLockedTabInfo('warsztat'); await wait(40); gm.closeInfoSheet();
      gm.openLockedTabInfo('wyzwania'); await wait(40); gm.closeInfoSheet();
      gm.openCampaignScreen(); await wait(150);
      for (const d of DISTRICTS) { try { gm.selectCampaignDistrict(d.id); } catch (e) {} await wait(30); }
      for (const m of CAMPAIGN_MISSIONS) { gm.openMissionBriefing(m.id); }
      await wait(30); // the translation layer runs right after each DOM write
      out.briefing = document.getElementById('briefingCard').innerText.slice(0, 160).replace(/\s+/g, ' ');
      gm.closeMissionBriefing();
      gm.openWarsztatScreen(); await wait(150);
      for (const t of document.querySelectorAll('#shopScreen [data-category], #shopScreen .tab-btn')) { t.click(); await wait(60); }
      gm.openChallengesScreen(); await wait(200);
      gm.openProfileScreen(); await wait(100);
      gm.openJukebox(); await wait(50); gm.closeInfoSheet();
      gm.openPrivacyPolicy(); await wait(50); gm.closeInfoSheet();
      await gm.copyBackupCode(); gm.closeInfoSheet();
      // Live play: an Arena round and missions with twists, results.
      window.__qaPlayArena({ style: 'greedy' }); try { gm.endRound(); } catch (e) {} await wait(300);
      for (const id of ['M33', 'M38', 'M52', 'M95', 'M170']) { try { window.__qaPlayMission(id, { style: 'casual' }); } catch (e) {} await wait(120); }
      for (const reason of ['time', 'racer', 'hit']) { gm.startCampaignMission('M33'); gm.beginMissionPlay(); if (reason === 'time') { gm.mission.failReason = 'time'; gm.endCampaignMission(false); } else gm.failCampaignMission(reason); await wait(80); }
      out.fail = document.getElementById('btnMissionNext').innerText.replace(/\s+/g, ' ');
      await wait(200);
      out.misses = [...I18N.misses];
      // Anything with Polish letters still visible right now?
      out.visiblePl = [...document.querySelectorAll('body *')].filter(el => el.offsetParent !== null && el.children.length === 0 && /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(el.textContent) && !el.closest('[translate="no"]')).map(el => el.textContent.trim()).slice(0, 10);
      return out;
    });
    results.push(report('English: a non-Polish browser gets the game in English (PLAY, briefings, defeat button)', r.lang === 'en' && /PLAY/.test(r.play) && !/GRAJ/.test(r.play) && /TRY WITH|RETRY|TRY AGAIN/i.test(r.fail), JSON.stringify({ lang: r.lang, play: r.play, fail: r.fail, briefing: r.briefing })));
    results.push(report('English: no untranslated Polish reached the screen in a full sweep (all screens, 241 briefings, rounds, results)', r.misses.length === 0, `${r.misses.length} misses: ${r.misses.slice(0, 12).map(s => JSON.stringify(s)).join(' | ')}`));
    results.push(report('English: no Polish letters visible on the final screen', r.visiblePl.length === 0, r.visiblePl.join(' | ')));
    results.push(report('English: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Polish stays Polish; Profil switches and remembers -------------------
  {
    const g = await seededPage(url, {}, { missions: 12, runsPlayed: 6 });
    const pl = await g.page.evaluate(() => ({ lang: I18N.lang, play: document.getElementById('btnStart').innerText }));
    await g.page.evaluate(() => { window.game.openProfileScreen(); document.querySelector('[data-lang="en"]').click(); });
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state && I18N.lang === 'en', null, { timeout: 15000 });
    await g.page.waitForTimeout(300);
    const en = await g.page.evaluate(() => ({ lang: I18N.lang, play: document.getElementById('btnStart').innerText, saved: window.game.save.settings.lang }));
    results.push(report('language: a Polish browser plays in Polish; Profil → English switches and is remembered', pl.lang === 'pl' && /GRAJ/.test(pl.play) && en.lang === 'en' && /PLAY/.test(en.play) && en.saved === 'en', JSON.stringify({ pl, en })));
    results.push(report('language: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Cloud save (CrazyGames data module) ------------------------------------
  {
    // A device with one mission done meets an account save with Park done.
    const g0 = await openGame(url);
    const rich = await veteranSave(g0.page, { missions: 40, runsPlayed: 20 });
    const richSealed = await g0.page.evaluate((s) => sealSave(sanitizeSave(s)), rich);
    await g0.browser.close();
    const g = await seededPage(url, { query: '?portal=crazygames', initScript: mockCrazy({ vectorHoleSave_v1: richSealed }) }, { missions: 1 });
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.monetization.provider === 'crazygames', null, { timeout: 10000 });
    await g.page.waitForTimeout(500);
    const c = await g.page.evaluate((remoteDone) => {
      const gm = window.game;
      const done = Object.keys(gm.save.campaign.completed).length;
      const local = JSON.parse(localStorage.getItem('vectorHoleSave_v1'));
      const before = __cgCalls.filter(x => x === 'set').length;
      gm.save.coins += 1; saveGame(gm.save);
      return { done, remoteDone, localDone: Object.keys(local.campaign.completed).length, mirrored: __cgCalls.filter(x => x === 'set').length > before };
    }, Object.keys(rich.campaign.completed).length);
    results.push(report('cloud save: the account save with more progress is restored on a fresh device', c.done === c.remoteDone && c.done > 1 && c.localDone === c.done, JSON.stringify(c)));
    results.push(report('cloud save: every later save is mirrored to the portal', c.mirrored));
    await g.browser.close();
    // The other way round: the device has more -- the account copy is updated, not adopted.
    const g2 = await seededPage(url, { query: '?portal=crazygames', initScript: mockCrazy({}) }, { missions: 30 });
    await g2.page.waitForTimeout(800);
    const c2 = await g2.page.evaluate(() => { const r = __cgStore.vectorHoleSave_v1; return { remote: !!r && Object.keys(JSON.parse(r).campaign.completed).length, local: Object.keys(window.game.save.campaign.completed).length }; });
    results.push(report('cloud save: a device with more progress uploads it (never loses it)', c2.remote === c2.local && c2.local >= 30, JSON.stringify(c2)));
    await g2.browser.close();
    // Review fix: a restore that has to wait for the round to end must not
    // upload the poorer local save meanwhile, and lands on Miasto.
    const g3 = await seededPage(url, { query: '?portal=crazygames', initScript: mockCrazy({}) }, { missions: 1 });
    await g3.page.waitForTimeout(600);
    const c3 = await g3.page.evaluate((rs) => {
      const gm = window.game;
      SAVE_MIRROR = null;
      __cgStore.vectorHoleSave_v1 = rs;
      gm.running = true;
      gm.monetization.attachCloudSave();
      gm.save.coins += 5; saveGame(gm.save);
      const keptDuringRound = Object.keys(JSON.parse(__cgStore.vectorHoleSave_v1).campaign.completed).length;
      gm.running = false;
      gm.showScreen('gameOverScreen');
      const onMenu = !document.getElementById('mainMenu').classList.contains('hidden') && document.getElementById('gameOverScreen').classList.contains('hidden');
      const adopted = Object.keys(gm.save.campaign.completed).length;
      gm.monetization.clearCloudSave();
      return { keptDuringRound, adopted, onMenu, cleared: !('vectorHoleSave_v1' in __cgStore), mirrorOff: SAVE_MIRROR === null };
    }, richSealed);
    results.push(report('cloud save: a restore deferred by a running round never uploads the poorer save; it lands on Miasto', c3.keptDuringRound === c3.adopted && c3.adopted > 1 && c3.onMenu, JSON.stringify(c3)));
    results.push(report('cloud save: a profile reset clears the account copy too (it would come back otherwise)', c3.cleared && c3.mirrorOff, JSON.stringify(c3)));
    await g3.browser.close();
  }

  // --- Backup code -------------------------------------------------------------
  {
    const g = await seededPage(url, {}, { missions: 25, runsPlayed: 8, coins: 777 });
    const code = await g.page.evaluate(async () => { window.game.openProfileScreen(); document.getElementById('btnBackupCopy').click(); await new Promise(r => setTimeout(r, 300)); return document.querySelector('#infoSheetBody .backup-code').value; });
    await g.browser.close();
    const fresh = await openGame(url);
    const b = await fresh.page.evaluate(async (c) => {
      const gm = window.game;
      gm.openProfileScreen();
      document.getElementById('btnBackupLoad').click();
      document.getElementById('backupInput').value = 'to nie kod';
      document.getElementById('btnInfoSheetAction').click();
      const errShown = /prawidłowy/.test(document.getElementById('infoSheetBody').textContent);
      const coinsBefore = gm.save.coins;
      document.getElementById('backupInput').value = c;
      document.getElementById('btnInfoSheetAction').click();
      await new Promise(r => setTimeout(r, 200));
      return { errShown, coinsBefore, coins: gm.save.coins, done: Object.keys(gm.save.campaign.completed).length, stored: JSON.parse(localStorage.getItem('vectorHoleSave_v1')).coins };
    }, code);
    results.push(report('backup: a wrong code is refused with a clear message, the save untouched', b.errShown && b.coinsBefore === 0, JSON.stringify(b)));
    results.push(report('backup: the code restores the whole progress on another device', b.coins === 777 && b.done === 25 && b.stored === 777, JSON.stringify(b)));
    // Review fix: an older code over a richer device asks first; a code the
    // game did not make (unsealed) is refused.
    const poorCode = await fresh.page.evaluate(() => { const s = defaultSave(); s.coins = 3; return encodeSaveCode(s); });
    const b2 = await fresh.page.evaluate(async (pc) => {
      const gm = window.game;
      gm.openBackupLoad();
      document.getElementById('backupInput').value = pc;
      document.getElementById('btnInfoSheetAction').click();
      const asked = /mniej postępu/.test(document.getElementById('infoSheetTitle').textContent);
      const keptCoins = gm.save.coins;
      document.getElementById('btnInfoSheetAction').click();
      await new Promise(r => setTimeout(r, 150));
      const afterConfirm = gm.save.coins;
      gm.openBackupLoad();
      document.getElementById('backupInput').value = 'VH1.' + btoa('{"coins":99999,"campaign":{}}');
      document.getElementById('btnInfoSheetAction').click();
      return { asked, keptCoins, afterConfirm, unsealedRefused: /prawidłowy/.test(document.getElementById('infoSheetBody').textContent) && gm.save.coins === 3 };
    }, poorCode);
    results.push(report('backup: a code with less progress asks first (and only then replaces)', b2.asked && b2.keptCoins === 777 && b2.afterConfirm === 3, JSON.stringify(b2)));
    results.push(report('backup: a code the game did not make (unsealed) is refused', b2.unsealedRefused, JSON.stringify(b2)));
    results.push(report('backup: no runtime errors', fresh.errors.length === 0, fresh.errors.slice(0, 2).join(' | ')));
    await fresh.browser.close();
  }

  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const res = await runV19Checks(url);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} v19 checks passed`);
  process.exit(failed.length ? 1 : 0);
}
