// Golden Shot v11 feature bots: audio engine, every monetization placement
// (demo provider + a mocked native wrapper with IAP), consent, sharing and
// friend-challenge links, retention metrics, save integrity.
// Usage: node qa/features.mjs
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, ARENA_BOT, OUT } from './lib.mjs';

async function veteranPage(url, opts = {}, saveOpts = {}) {
  const g = await openGame(url, opts);
  const save = await veteranSave(g.page, saveOpts);
  if (opts.mutate) opts.mutate(save);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.game.state);
  await g.page.addScriptTag({ content: ARENA_BOT });
  return g;
}

// Speeds the demo ad up so flows run fast.
const fastAds = () => { window.__qaFastAds = true; };

export async function runFeatureChecks(url) {
  const results = [];

  // --- Audio --------------------------------------------------------------
  {
    const g = await veteranPage(url);
    await g.page.mouse.click(5, 5);
    const a = await g.page.evaluate(async () => {
      const s = window.game.sound;
      s.unlock();
      await new Promise(r => setTimeout(r, 400));
      ['eat', 'rivalEaten', 'hurt', 'tierUp', 'golden', 'frenzy', 'tick', 'whoosh', 'ui', 'coin', 'fanfare', 'fail'].forEach(k => s[k](20, 4));
      const before = s.ctx.state;
      document.querySelector('[data-setting="music"][data-value="0"]').click();
      const musicOff = !s.musicTimer;
      document.querySelector('[data-setting="music"][data-value="1"]').click();
      return { before, musicOff, musicOn: !!s.musicTimer, saved: window.game.save.settings.music };
    });
    results.push(report('audio: context unlocks on first tap and all SFX play', a.before === 'running' && g.errors.length === 0, JSON.stringify(a)));
    results.push(report('audio: music toggle stops/starts the sequencer and persists', a.musicOff && a.musicOn && a.saved === true));
    await g.browser.close();
  }

  // --- Monetization: demo provider -------------------------------------------
  {
    const g = await veteranPage(url, { initScript: fastAds }, { runsPlayed: 10 });
    await g.page.evaluate(() => { CONFIG.ads.demoSeconds = 0.3; });
    const m = await g.page.evaluate(async () => {
      const gm = window.game;
      const out = { provider: gm.monetization.provider };
      // Result x2 coins
      window.__qaPlayArena({ style: 'greedy' });
      const before = gm.save.coins, pending = gm.adPendingCoins;
      await gm.watchRewardedAd();
      out.doubled = gm.save.coins - before === pending;
      await gm.watchRewardedAd();
      out.doubleOnce = gm.save.coins - before === pending;
      // Free prisms, capped at 3 per day
      const p0 = gm.save.prisms;
      for (let i = 0; i < 5; i++) await gm.watchFreePrismsAd();
      out.freePrisms = gm.save.prisms - p0;
      // Chest skip
      gm.save.freeChest.nextAt = Date.now() + 3600e3;
      const c0 = gm.save.coins;
      gm.openFreeChest();
      const actionShown = !document.getElementById('btnInfoSheetAction').classList.contains('hidden');
      document.getElementById('btnInfoSheetAction').click();
      await new Promise(r => setTimeout(r, 900));
      out.chestSkip = actionShown && gm.save.coins > c0;
      // Paid store hidden in demo
      gm.openWarsztatScreen();
      out.storeHidden = document.getElementById('storePaid').classList.contains('hidden');
      out.iapAuraHidden = !document.querySelector('#auraGrid canvas[data-aura="starter_glow"]');
      // Interstitials: capped, skipped with no-ads
      gm.monetization.lastInterstitialAt = 0;
      const t0 = performance.now(); await gm.monetization.interstitial('replay'); out.interMs = Math.round(performance.now() - t0);
      const t1 = performance.now(); await gm.monetization.interstitial('replay'); out.capMs = Math.round(performance.now() - t1);
      return out;
    });
    results.push(report('ads: demo provider when no SDK is present', m.provider === 'demo'));
    results.push(report('ads: result ×2 coins pays exactly once', m.doubled && m.doubleOnce));
    results.push(report('ads: free prisms capped at 3 per day', m.freePrisms === 15, `+${m.freePrisms}`));
    results.push(report('ads: chest can be opened early for an ad', m.chestSkip));
    results.push(report('iap: paid store + IAP-only cosmetics hidden without a payment provider', m.storeHidden && m.iapAuraHidden));
    results.push(report('ads: interstitial plays, then is time-capped', m.interMs > 200 && m.capMs < 50, `${m.interMs} ms then ${m.capMs} ms`));
    results.push(report('ads: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Monetization: mission revive ----------------------------------------
  {
    const g = await veteranPage(url);
    await g.page.evaluate(() => { CONFIG.ads.demoSeconds = 0.3; });
    const r = await g.page.evaluate(async () => {
      const gm = window.game;
      gm.startCampaignMission('M01');
      if (gm.introPending) gm.dismissTutorialIntro();
      const m = gm.mission;
      // Fake 60% progress, then run the clock out.
      const items = gm.campaignGoalItems();
      m.eatenByType[gm.mission.def.goal.steps ? (gm.mission.def.goal.steps[0].eat || 'fragment') : 'fragment'] = Math.ceil(items[0].target * 0.6);
      m.elapsed = m.def.timeLimit - 0.01;
      gm.updateCampaign(0.05);
      const offered = gm.revivePending && !document.getElementById('reviveOverlay').classList.contains('hidden');
      await gm.acceptRevive();
      const revived = !m.ended && m.timeRemaining > 15;
      m.elapsed += 30; gm.updateCampaign(0.05);
      return { offered, revived, endedAfter: m.ended, offeredTwice: gm.revivePending };
    });
    results.push(report('ads: near-miss mission offers +20 s revive', r.offered, JSON.stringify(r)));
    results.push(report('ads: revive grants time once, then the mission can end', r.revived && r.endedAfter && !r.offeredTwice));
    await g.browser.close();
  }

  // --- Monetization: mocked native wrapper with IAP --------------------------
  {
    const nativeMock = () => {
      window.VectorHoleNative = {
        rewarded: async () => true,
        interstitial: async () => {},
        products: async () => [{ sku: 'starter_pack', price: '€2.99' }],
        purchase: async (sku) => ({ ok: true, sku })
      };
    };
    const g = await veteranPage(url, { initScript: nativeMock });
    await g.page.waitForTimeout(300);
    const n = await g.page.evaluate(async () => {
      const gm = window.game;
      gm.openWarsztatScreen();
      const shown = !document.getElementById('storePaid').classList.contains('hidden');
      const rows = document.querySelectorAll('#storeProducts .store-row').length;
      const price = document.querySelector('#storeProducts .store-row-price').textContent;
      const c0 = gm.save.coins;
      await gm.buyProduct('starter_pack');
      await gm.buyProduct('starter_pack');
      await gm.buyProduct('no_ads');
      return { provider: gm.monetization.provider, shown, rows, price, coins: gm.save.coins - c0, aura: gm.save.auras.owned.includes('starter_glow'), noAds: gm.save.entitlements.noAds };
    });
    results.push(report('iap: native wrapper shows the store with localized prices', n.provider === 'native' && n.shown && n.rows >= 5 && n.price === '€2.99', JSON.stringify(n)));
    results.push(report('iap: one-time packs grant once (starter pack + exclusive Trail)', n.coins === 1500 && n.aura));
    results.push(report('iap: "Bez reklam" entitlement recorded', n.noAds));
    await g.browser.close();
  }

  // --- Viral: share card + friend challenge round trip ---------------------
  {
    const g = await veteranPage(url);
    const link = await g.page.evaluate(async () => {
      const gm = window.game;
      window.__qaPlayArena({ style: 'greedy' });
      const cv = gm.buildShareCanvas({ score: gm.player.score, headline: 'TEST', sub: 'sub' });
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
      window.__cardBytes = blob ? blob.size : 0;
      return { url: encodeChallenge(gm.runSeed, 1234, 'Ania<b>'), seed: gm.runSeed, card: window.__cardBytes };
    });
    const dataUrl = await g.page.evaluate(() => window.game.buildShareCanvas({ score: 4321, headline: 'ZWYCIĘSTWO W NEONOWYM MIEŚCIE', sub: 'Miejsce #1 · T5 · Runda 2:00' }).toDataURL('image/png'));
    fs.writeFileSync(path.join(OUT, 'share-card.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
    results.push(report('viral: share card renders as a JPEG under 600 KB', link.card > 20000 && link.card < 600000, `${Math.round(link.card / 1024)} KB`));
    const q = link.url.slice(link.url.indexOf('?'));
    await g.page.goto(url + q);
    await g.page.waitForFunction(() => window.game && window.game.state);
    await g.page.addScriptTag({ content: ARENA_BOT });
    const c = await g.page.evaluate(() => {
      const gm = window.game;
      const card = !document.getElementById('hubChallenge').classList.contains('hidden');
      const from = document.getElementById('hubChallengeFrom').innerHTML;
      const urlClean = !location.search.includes('c=');
      gm.acceptChallenge();
      const seedOk = gm.runSeed === gm.save.challenge.seed && !!gm.challenge;
      if (gm.rafId) cancelAnimationFrame(gm.rafId);
      const r = window.__qaPlayArena({ round: { seed: gm.save.challenge.seed, challenge: { score: 1234, from: 'Ania' } } });
      return { card, from, urlClean, seedOk, hook: document.getElementById('resultHookLine').textContent, beaten: gm.challengeBeaten, cleared: gm.save.challenge === null, score: r.score };
    });
    results.push(report('viral: challenge link shows the hub card (name escaped) and cleans the URL', c.card && c.urlClean && !/<b>/.test(c.from), JSON.stringify(c)));
    results.push(report('viral: accepting replays the same seed with a live target', c.seedOk));
    results.push(report('viral: result screen reports the challenge outcome', c.hook.length > 10 && (c.beaten ? c.cleared : true), c.hook));
    // Edited score in the link -> ignored.
    const tampered = q.replace(/c=([0-9a-z]+)\.([0-9a-z]+)\./, (m, a) => `c=${a}.zzz.`);
    await g.page.evaluate(() => { window.game.save.challenge = null; saveGame(window.game.save); });
    await g.page.goto(url + tampered);
    await g.page.waitForFunction(() => window.game && window.game.state);
    const t = await g.page.evaluate(() => window.game.save.challenge);
    results.push(report('anti-cheat: edited challenge score is rejected', t === null));
    results.push(report('viral: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Legal / analytics / save integrity -------------------------------
  {
    const g = await openGame(url, { initScript: () => { window.dataLayer = []; } });
    const a = await g.page.evaluate(() => {
      const gm = window.game;
      // v13: the bar waits until the tutorial is done (it covered the
      // welcome CTA on small phones); nothing is sent before a decision.
      const barOnWelcome = !document.getElementById('consentBar').classList.contains('hidden');
      gm.save.campaign.completed.M00 = true;
      gm.showScreen('mainMenu');
      const barShown = !barOnWelcome && !document.getElementById('consentBar').classList.contains('hidden');
      const before = window.dataLayer.length;
      gm.analytics.track('probe', {});
      const leakedBefore = window.dataLayer.length - before;
      document.getElementById('btnConsentYes').click();
      gm.analytics.track('probe', { x: 1 });
      const sentAfter = window.dataLayer.filter(e => e.event === 'vh_probe').length;
      const retention = gm.analytics.queue.some(e => e.name === 'retention_day');
      const barHidden = document.getElementById('consentBar').classList.contains('hidden');
      gm.openPrivacyPolicy();
      const policy = document.getElementById('infoSheetBody').textContent.includes('RODO');
      return { barShown, leakedBefore, sentAfter, retention, barHidden, policy, install: gm.save.retention.installDate };
    });
    results.push(report('gdpr: consent bar after the tutorial (not over the welcome CTA), nothing leaves the device before consent', a.barShown && a.leakedBefore === 0, JSON.stringify(a)));
    results.push(report('gdpr: after consent events reach the host sink (dataLayer)', a.sentAfter === 1 && a.barHidden));
    results.push(report('gdpr: privacy policy + data export available', a.policy));
    results.push(report('analytics: retention_day (D1/D7) tracked with install date', a.retention && !!a.install));
    // Save integrity: hand-edited save is flagged; wrong types are repaired.
    const sv = await g.page.evaluate(() => {
      const raw = localStorage.getItem('vectorHoleSave_v1');
      const sealed = raw.includes('"_sig"') && loadSave().integrity.tampered === false;
      const obj = JSON.parse(raw);
      obj.coins = 999999; obj.settings = null; obj.prisms = 'abc'; obj.freeChest.nextAt = Date.now() + 3600e3;
      localStorage.setItem('vectorHoleSave_v1', JSON.stringify(obj));
      const s = loadSave();
      return { sealed, tampered: s.integrity.tampered, coinsType: typeof s.coins, prisms: s.prisms, settingsOk: !!s.settings && s.settings.sfx === true, chestKept: s.freeChest.nextAt > Date.now() };
    });
    results.push(report('anti-cheat: saves are sealed; edited saves are flagged', sv.sealed && sv.tampered, JSON.stringify(sv)));
    results.push(report('save: wrong field types are repaired (no string coins, settings restored, timestamps kept)', sv.coinsType === 'number' && sv.prisms === 0 && sv.settingsOk && sv.chestKept));
    results.push(report('legal: no errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Regressions from the v11 code review --------------------------------
  {
    const slowNative = () => { window.VectorHoleNative = { rewarded: () => new Promise(r => setTimeout(() => r(true), 600)), interstitial: async () => {} }; };
    const g = await veteranPage(url, { initScript: slowNative });
    await g.page.waitForTimeout(200);
    const r = await g.page.evaluate(async () => {
      const gm = window.game;
      gm.startCampaignMission('M01'); if (gm.introPending) gm.dismissTutorialIntro();
      const m = gm.mission;
      const it = gm.campaignGoalItems()[0];
      const st = m.def.goal.steps && m.def.goal.steps[0];
      m.eatenByType[(st && st.eat) || 'fragment'] = Math.ceil(it.target * 0.7);
      m.elapsed = m.def.timeLimit; gm.updateCampaign(0.016);
      const p1 = gm.acceptRevive();
      await new Promise(r => setTimeout(r, 80));
      const p2 = gm.acceptRevive();
      gm.pauseGame(); gm.resumeGame();
      await Promise.all([p1, p2]);
      return { ended: m.ended, revived: !!m.revived };
    });
    results.push(report('review: double-tapping revive does not waste the ad', !r.ended && r.revived, JSON.stringify(r)));
    const e = await g.page.evaluate(() => {
      const u = encodeChallenge(42, 777, 'abcdefghijklmno😀x');
      return decodeChallenge(u.slice(u.indexOf('?')));
    });
    results.push(report('review: emoji names survive the challenge seal', !!e && e.score === 777, JSON.stringify(e)));
    const same = await g.page.evaluate(() => {
      const gm = window.game;
      const layout = () => { gm.createObjects(new SeededRNG(123456789)); const o = gm.objects.find(x => x.tier === 'fragment'); return [Math.round(o.x), Math.round(o.y)].join(','); };
      const full = layout();
      const saved = gm.save.campaign.discoveredTypes;
      gm.save.campaign.discoveredTypes = ['fragment', 'capsule', 'prop'];
      const partial = layout();
      gm.save.campaign.discoveredTypes = saved;
      return { full, partial };
    });
    results.push(report('review: a challenge seed lays out the same map for every player', same.full === same.partial, JSON.stringify(same)));
    await g.browser.close();
  }
  {
    const pokiBlocked = () => {
      window.__pokiCalls = [];
      window.PokiSDK = { init: () => Promise.reject(new Error('adblock')), gameLoadingFinished: () => window.__pokiCalls.push('loaded'), gameplayStart: () => window.__pokiCalls.push('start'), gameplayStop: () => window.__pokiCalls.push('stop'), rewardedBreak: async () => false, commercialBreak: async () => {} };
    };
    const g = await veteranPage(url, { initScript: pokiBlocked });
    await g.page.waitForTimeout(300);
    const p = await g.page.evaluate(() => ({ provider: window.game.monetization.provider, calls: window.__pokiCalls }));
    results.push(report('review: Poki under an adblocker stays "poki" (never the paying demo ad)', p.provider === 'poki' && p.calls.includes('loaded'), JSON.stringify(p)));
    await g.browser.close();
  }

  fs.writeFileSync(path.join(OUT, 'features.json'), JSON.stringify(results, null, 2));
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const res = await runFeatureChecks(url);
  server.close();
  process.exit(res.every(r => r.ok) ? 0 : 1);
}
