// CRAZYGAMES-BASIC-1: the real HTML5 package (tools/export-crazygames-basic.mjs), run
// from its own folder over HTTP, and the requirements of docs.crazygames.com/requirements
// (read 2026-11-03) that can be checked without the portal: structure and limits, only the
// CrazyGames SDK from outside (CG-DATA-1, its Data Module save; qa/cg-data1.mjs tests it),
// no ad or reward without an ad, normal rewards equal to the web build, the portal's iframe
// sizes, input in the iframe, English, SAVE v13, reload, links, metadata, refresh rates,
// the GitHub Pages build unchanged. A local fake host is not the CrazyGames Preview.
//   node qa/crazygames-basic1.mjs [--delivery=DIR] [--shots]
// --delivery checks the covers and videos in a delivery folder; without it those are NOT RUN.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { chromium, revisionFile, serve, openGame as openGameRaw, veteranSave, installQaBridge, report, ARENA_BOT, CAMPAIGN_BOT, QA_RANDOM, frozenDateScript, OUT, ROOT, isMain, CG_SDK_URL, CG_SDK_MOCK } from './lib.mjs';
import { exportPackage, LIMITS, CG_SDK_SRC } from '../tools/export-crazygames-basic.mjs';

// CG-DATA-1: the package loads the CrazyGames SDK. Here it gets the QA stand-in in
// 'passthrough' mode (its Data Module keeps each key as a plain localStorage key), so
// these suites still seed and read 'vectorHoleSave_v1'; only package URLs get it.
const PKG_SDK = `window.__cgMock = window.__cgMock || { mode: 'passthrough' };\n${CG_SDK_MOCK}`;
let PKG_BASE = null;
const openGame = (u, o = {}) => openGameRaw(u, PKG_BASE && u.startsWith(PKG_BASE) ? { cgSdk: PKG_SDK, ...o } : o);

const WORK = path.join(OUT, 'cg-basic1');
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const lf = (s) => s.replace(/\r\n/g, '\n');
// docs.crazygames.com/requirements/gameplay/ "most important iframe sizes".
const CG_FRAMES = [[907, 510], [1216, 684], [1077, 606], [821, 462], [1366, 768], [1920, 1080], [1536, 864], [1280, 720], [800, 450], [1080, 607]];
const AD_TEXT = /reklam|\bads?\b|watch an?\b|×2 monet|×2 za|×2 coins|obejrzyj/i;
const SITE_MEDIA_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

/** Which visible controls offer an ad, on the screen that is open now. */
const VISIBLE_AD_OFFERS = `window.__adOffers = () => [...document.querySelectorAll('button, a, [role="button"]')]
  .filter(b => b.offsetParent !== null && !b.closest('.dev-panel, #devPanel'))
  .map(b => (b.innerText || b.textContent || '').trim()).filter(t => ${AD_TEXT}.test(t));`;

function parseZip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const n = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out = new Map();
  for (let i = 0; i < n; i++) {
    const size = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), comment = buf.readUInt16LE(p + 32), at = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28);
    out.set(name, zlib.inflateRawSync(buf.subarray(start, start + size)));
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

function structureChecks(pkg) {
  const r = [];
  const list = fs.readdirSync(pkg.gameDir, { recursive: true, withFileTypes: true }).filter(d => d.isFile()).map(d => path.relative(pkg.gameDir, path.join(d.parentPath, d.name)).replace(/\\/g, '/')).sort();
  r.push(report('package: holds exactly the runtime (index.html, game.js, style.css): no git, qa, docs, logs or v/ history', list.join() === 'game.js,index.html,style.css', list.join()));
  r.push(report(`package: file count within the limit (${LIMITS.files})`, pkg.fileCount <= LIMITS.files, String(pkg.fileCount)));
  r.push(report('package: total size within 50 MB without the SDK and 20 MB for the mobile homepage', pkg.totalBytes <= LIMITS.bytes && pkg.withinMobileHomepageLimit, `${(pkg.totalBytes / 1048576).toFixed(2)} MB`));
  const page = fs.readFileSync(path.join(pkg.gameDir, 'index.html'), 'utf8');
  const refs = [...page.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)].map(m => m[1]).filter(u => !u.startsWith('data:'));
  const local = refs.filter(u => u !== CG_SDK_SRC);
  r.push(report('package: every script and stylesheet is referenced by a relative path, apart from the official CrazyGames SDK (once, in <head>, before game.js)', local.length === 2 && local.every(u => /^[\w.-]+$/.test(u)) && refs.length === 3 && CG_SDK_SRC === CG_SDK_URL && page.indexOf(CG_SDK_SRC) < page.indexOf('</head>') && page.indexOf(CG_SDK_SRC) < page.indexOf('src="game.js"'), refs.join(', ')));
  r.push(report('package: the page carries the distribution marker, the source and its GitHub Pages release do not', /<html[^>]*data-distribution="crazygames-basic"/.test(page) && !/data-distribution/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'))));
  r.push(report('metadata: English title and description, no link or structured data naming the GitHub Pages site', /<title>GLITCH GULP<\/title>/.test(page) && /name="description" content="Steer/.test(page) && !/github\.io|og:|ld\+json|twitter:/.test(page)));
  for (const f of ['game.js', 'style.css']) {
    r.push(report(`one source: ${f} in the package has the same bytes as the source file`, sha256(fs.readFileSync(path.join(pkg.gameDir, f))) === sha256(Buffer.from(lf(fs.readFileSync(path.join(ROOT, f), 'utf8')), 'utf8'))));
  }
  const zip = parseZip(fs.readFileSync(path.join(pkg.out, 'game.zip')));
  r.push(report('zip: index.html at the root, every file identical to game/', zip.has('index.html') && list.every(f => zip.get(f) && zip.get(f).equals(fs.readFileSync(path.join(pkg.gameDir, f)))), [...zip.keys()].join()));
  const js = fs.readFileSync(path.join(pkg.gameDir, 'game.js'), 'utf8'), css = fs.readFileSync(path.join(pkg.gameDir, 'style.css'), 'utf8');
  r.push(report('links: no link or window.open out of the game, no fetch, beacon or socket in the code', !/href="https?:/.test(page) && !/window\.open|target=.?_blank|\bfetch\(|sendBeacon|XMLHttpRequest|new WebSocket/.test(js)));
  r.push(report('fullscreen: no in-game fullscreen button or request (the portal provides it)', !/requestFullscreen/.test(js + page)));
  r.push(report('mobile: body has all the user-select: none forms the requirements list, text fields stay usable', ['-webkit-user-select: none', '-moz-user-select: none', '-ms-user-select: none', 'user-select: none'].every(x => css.includes(x)) && /input, textarea \{\s*-webkit-user-select: text/.test(css)));
  const again = exportPackage({ out: path.join(WORK, 'export-again') });
  r.push(report('export: repeatable (same sources give the same zip)', again.zip.sha256 === pkg.zip.sha256, `${again.zip.sha256.slice(0, 12)} vs ${pkg.zip.sha256.slice(0, 12)}`));
  r.push(report('export: writes nothing to the release or the repo root (no v/ or release/ folder appears)', !fs.existsSync(path.join(ROOT, 'v')) && !fs.existsSync(path.join(ROOT, 'release'))));
  return r;
}

/** A local stand-in for the portal: the page and the game's file host are fake https
 *  origins answered here, every other request is logged and refused (nothing leaves). */
async function portalHost(gameDir, { width, height, locale = 'en-US', hasTouch = false, frameW = width, frameH = height, cgSdk = PKG_SDK } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale, hasTouch });
  await installQaBridge(context);
  const external = [], errors = [], sdk = [];
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const u = new URL(route.request().url());
    // CG-DATA-1: the SDK's official URL answers with the stand-in (cgSdk null: refused).
    if (u.href === CG_SDK_URL && cgSdk) { sdk.push(u.href); return route.fulfill({ contentType: 'text/javascript', body: cgSdk }); }
    if (u.hostname === 'www.crazygames.com') {
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body style="margin:0;background:#111;height:2400px"><iframe id="frame" src="https://glitch-gulp.game-files.crazygames.com/index.html" style="border:0;width:${frameW}px;height:${frameH}px;display:block" allow="autoplay; fullscreen"></iframe></body></html>` });
    }
    if (u.hostname === 'glitch-gulp.game-files.crazygames.com') {
      const file = path.join(gameDir, u.pathname === '/' ? 'index.html' : u.pathname);
      if (fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({ contentType: SITE_MEDIA_TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
      external.push('MISSING ' + u.href);
      return route.fulfill({ status: 404, body: '' });
    }
    external.push(u.href);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto('https://www.crazygames.com/game/glitch-gulp');
  const frame = page.frames().find(f => f.url().includes('game-files')) || await new Promise((res) => page.on('frameattached', res));
  await frame.waitForFunction(() => window.game && window.game.state !== undefined && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 20000 });
  return { browser, context, page, frame, external, errors, sdk };
}

/** A real mouse click on an element inside the frame (no synthetic .click()). */
async function clickIn(page, frame, selector) {
  const box = await frame.locator(selector).first().boundingBox();
  if (!box) throw new Error('not visible: ' + selector);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function hostSdkChecks(gameDir, url) {
  const r = [];
  const g = await portalHost(gameDir, { width: 1216, height: 684 });
  const load = await g.frame.evaluate(() => { const t = performance.getEntriesByType('navigation')[0]; return t ? Math.round(t.domContentLoadedEventEnd) : null; });
  r.push(report('load: the page is ready within the 10 s benchmark (local server, not the portal CDN)', load != null && load < 10000, `${load} ms`));
  const st = await g.frame.evaluate(() => ({ provider: window.game.monetization.provider, ads: window.game.monetization.adsAvailable, host: location.hostname, cg: !!window.CrazyGames, poki: !!window.PokiSDK, lang: I18N.lang }));
  await g.page.waitForTimeout(500);
  r.push(report('SDK: on a crazygames.com host the package requests only the CrazyGames SDK (once, for the Data Module), no other external file, no ad provider, and boots', st.host.endsWith('crazygames.com') && st.cg && !st.poki && g.sdk.length === 1 && g.external.length === 0 && st.provider === 'none' && !st.ads, JSON.stringify({ ...st, sdk: g.sdk, external: g.external })));
  r.push(report('SDK: no console errors while booting in the portal iframe', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
  await g.browser.close();
  // A URL parameter (untrusted) cannot switch the SDK or the demo ad back on.
  const forced = await openGame(url, { query: '?portal=crazygames', viewport: { width: 1216, height: 684 }, mobile: false, deviceScaleFactor: 1 });
  await forced.page.waitForTimeout(300);
  const f = await forced.page.evaluate(() => ({ provider: window.game.monetization.provider, ads: window.game.monetization.adsAvailable }));
  r.push(report('trust: ?portal=crazygames changes nothing in the package (no SDK request, still no ads)', f.provider === 'none' && !f.ads && forced.external.length === 0, JSON.stringify({ ...f, external: forced.external })));
  await forced.browser.close();
  return r;
}

async function veteran(url, overrides, opts = {}) {
  const { fixed, ...open } = opts;
  const g = await openGame(url, { viewport: { width: 1216, height: 684 }, mobile: false, deviceScaleFactor: 1, ...open });
  const save = await veteranSave(g.page, overrides);
  // What qa/trace.mjs holds fixed for a run that must repeat.
  if (fixed) { save.guestId = 'guest_qa_trace'; save.displayName = 'QA'; save.settings.music = false; save.settings.sfx = false; }
  await g.page.evaluate((s) => { localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)); }, save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  await g.page.addScriptTag({ content: VISIBLE_AD_OFFERS });
  await g.page.addScriptTag({ content: ARENA_BOT });
  await g.page.addScriptTag({ content: CAMPAIGN_BOT });
  return g;
}

async function adChecks(url) {
  const r = [];
  const g = await veteran(url, { runsPlayed: 10 });
  const out = await g.page.evaluate(async () => {
    const gm = window.game, out = { offers: {} }, vis = (id) => { const e = document.getElementById(id); return !!e && e.offsetParent !== null; };
    const snap = () => ({ coins: gm.save.coins, prisms: gm.save.prisms || 0, boosters: JSON.stringify(gm.save.boosters) });
    // ×2 MONET on a finished round
    window.__qaPlayArena({ style: 'greedy' });
    gm.showScreen('gameOverScreen');
    out.result = { screen: vis('btnPlayAgain'), ad: vis('btnWatchAd'), share: vis('btnShare'), menu: vis('btnMenu') };
    out.offers.result = window.__adOffers();
    let s0 = snap();
    await gm.watchRewardedAd();
    out.double = JSON.stringify(s0) === JSON.stringify(snap());
    // Warsztat: free prisms and the paid store
    gm.openWarsztatScreen();
    out.store = { free: vis('btnFreePrisms'), paid: vis('storePaid'), card: !!document.querySelector('#shopScreen .store-card') && document.querySelector('#shopScreen .store-card').offsetParent !== null };
    out.offers.shop = window.__adOffers();
    s0 = snap();
    await gm.watchFreePrismsAd();
    out.freePrisms = JSON.stringify(s0) === JSON.stringify(snap());
    // Chest: no skip offer, the plain "come back" text
    gm.save.freeChest.nextAt = Date.now() + 3600e3;
    s0 = snap();
    gm.openFreeChest();
    out.chest = { action: vis('btnInfoSheetAction'), body: document.getElementById('infoSheetBody').innerText, same: JSON.stringify(s0) === JSON.stringify(snap()) };
    gm.closeInfoSheet();
    // Login: the reward itself is paid, no ×2 offer next to it
    gm.save.login.lastClaimDate = null;
    gm.bootFirstRun = false;
    gm.showScreen('mainMenu');
    document.getElementById('unlockOverlay').classList.add('hidden');
    document.getElementById('loginRewardScreen').classList.add('hidden');
    gm.maybeShowLoginReward();
    const lc0 = gm.save.coins + (gm.save.prisms || 0);
    const opened = vis('btnLoginClaim');
    document.getElementById('btnLoginClaim').click();
    await new Promise(res => setTimeout(res, 50));
    out.login = { opened, paid: gm.save.coins + (gm.save.prisms || 0) > lc0, double: vis('btnLoginDouble'), close: vis('btnLoginClose') };
    gm.closeLoginReward();
    // Briefing, short on coins: prisms may stay, the ad must not
    gm.save.coins = 0;
    gm.save.prisms = 0;
    gm.openCampaignScreen();
    gm.openMissionBriefing('M26', { preselect: ['time'] });
    out.booster = { ad: !!document.querySelector('[data-booster-ad]'), text: window.__adOffers() };
    s0 = snap();
    await gm.watchBoosterAd('time');
    out.boosterSame = JSON.stringify(s0) === JSON.stringify(snap());
    // Between rounds: no break, nothing to wait for
    gm.monetization.lastInterstitialAt = 0;
    const t0 = performance.now();
    await gm.monetization.interstitial('replay');
    out.interMs = performance.now() - t0;
    // Every placement, called directly: resolves at once with false, no overlay, nothing granted
    const t1 = performance.now();
    out.direct = [];
    for (const p of Object.keys(AD_PLACEMENTS)) out.direct.push([p, await gm.monetization.rewarded(p), gm.monetization.placementLeft(p)]);
    out.directMs = performance.now() - t1;
    out.overlay = vis('adOverlay');
    out.busy = gm.monetization.busy;
    return out;
  });
  r.push(report('×2 MONET: not offered on the result, the row is gone with it, the main actions remain', out.result.screen && out.result.menu && !out.result.ad && !out.result.share && !out.offers.result.length, JSON.stringify(out.result)));
  r.push(report('×2 MONET: called anyway it grants nothing', out.double));
  r.push(report('Warsztat: no free-prisms ad and no empty store card', !out.store.free && !out.store.paid && !out.store.card && !out.offers.shop.length, JSON.stringify(out.store)));
  r.push(report('Warsztat: the ad handler called anyway grants nothing', out.freePrisms));
  r.push(report('chest: no "open now" ad, the sheet explains the wait, nothing granted', !out.chest.action && !AD_TEXT.test(out.chest.body) && out.chest.same, out.chest.body));
  r.push(report('login: the normal reward is paid and no ×2 ad stands next to it', out.login.opened && out.login.paid && !out.login.double && out.login.close, JSON.stringify(out.login)));
  r.push(report('briefing: no booster-for-an-ad, called anyway it grants nothing', !out.booster.ad && !out.booster.text.length && out.boosterSame, JSON.stringify(out.booster)));
  r.push(report('between rounds: no ad break and no wait', out.interMs < 50, `${out.interMs.toFixed(1)} ms`));
  r.push(report('every placement: rewarded() resolves false at once, no demo overlay, nothing left busy', out.direct.every(d => d[1] === false && d[2] === 0) && out.directMs < 50 && !out.overlay && !out.busy, JSON.stringify(out.direct)));
  await g.browser.close();

  // +20 s: a near-miss with prisms keeps the prism option; without prisms there is no offer at all.
  const rv = await veteran(url, {});
  const rev = await rv.page.evaluate(async () => {
    const gm = window.game, out = {}, vis = (id) => document.getElementById(id).offsetParent !== null;
    const start = (prisms) => {
      gm.save.prisms = prisms;
      gm.startCampaignMission('M05');
      gm.introPending = false;
      gm.campaignGoalFraction = () => 0.9;
    };
    start(CONFIG.ads.revivePrisms);
    gm.onCampaignTimeout();
    out.withPrisms = { overlay: vis('reviveOverlay'), ad: vis('btnReviveAd'), prisms: vis('btnRevivePrisms') };
    gm.hideReviveOffer();
    gm.stopRun && gm.stopRun();
    delete gm.campaignGoalFraction;
    start(0);
    let ended = 0;
    const end = gm.endCampaignMission;
    gm.endCampaignMission = () => { ended++; };
    gm.onCampaignTimeout();
    out.noPrisms = { overlay: vis('reviveOverlay'), ended };
    gm.endCampaignMission = end;
    delete gm.campaignGoalFraction;
    return out;
  });
  r.push(report('+20 s: the prism option stays, the ad button does not', rev.withPrisms.overlay && rev.withPrisms.prisms && !rev.withPrisms.ad, JSON.stringify(rev.withPrisms)));
  r.push(report('+20 s: with no prisms there is no empty offer, the mission simply ends', !rev.noPrisms.overlay && rev.noPrisms.ended === 1, JSON.stringify(rev.noPrisms)));
  r.push(report('ads: no runtime errors', g.errors.length === 0 && rv.errors.length === 0, g.errors.concat(rv.errors).slice(0, 2).join(' | ')));
  await rv.browser.close();
  return r;
}

/** Same seed, clock and date on both builds: what a round, a mission, the chest and
 *  the login pay must be identical. Ads were extras; the normal economy did not move. */
async function rewardParity(url, webUrl) {
  const r = [];
  const init = QA_RANDOM + frozenDateScript('2026-11-03T12:00:00Z') + 'window.__qaSeedRandom(424242);';
  const play = async (u) => {
    const g = await veteran(u, { runsPlayed: 10 }, { initScript: init, fixed: true });
    const out = await g.page.evaluate(() => {
      const gm = window.game, take = () => ({ coins: gm.save.coins, prisms: gm.save.prisms || 0, xp: gm.save.xp, lvl: gm.save.coreCity && gm.save.coreCity.level });
      window.__qaSeedRandom(777);
      const s0 = take();
      const a = window.__qaPlayArena({ style: 'greedy', round: { seed: 4242 }, clock0: 5e6 });
      const s1 = take();
      window.__qaSeedRandom(778);
      const m = window.__qaPlayMission('M05', { style: 'expert', clock0: 9e6 });
      const s2 = take();
      window.__qaSeedRandom(779);
      gm.save.freeChest.nextAt = 0;
      gm.openFreeChest();
      const s3 = take();
      gm.closeInfoSheet && gm.closeInfoSheet();
      gm.save.login.lastClaimDate = null;
      gm.claimLoginReward();
      const s4 = take();
      return { arena: { score: a.score, place: a.place }, mission: { stars: m.stars, won: m.won }, s0, s1, s2, s3, s4, schema: gm.save.schemaVersion };
    });
    await g.browser.close();
    return out;
  };
  const [a, b] = [await play(url), await play(webUrl)];
  const same = (k) => JSON.stringify(a[k]) === JSON.stringify(b[k]);
  r.push(report('rewards: the same Arena round pays the same on the package and the web build', same('arena') && same('s1') && a.s1.coins > a.s0.coins, JSON.stringify({ pkg: [a.arena, a.s1], web: [b.arena, b.s1] })));
  r.push(report('rewards: the same mission pays the same', same('mission') && same('s2'), JSON.stringify({ pkg: [a.mission, a.s2], web: [b.mission, b.s2] })));
  r.push(report('rewards: the same free chest and login pay the same', same('s3') && same('s4') && a.s4.coins > a.s2.coins, JSON.stringify({ pkg: [a.s3, a.s4], web: [b.s3, b.s4] })));
  return r;
}

/** Every visible hub button on every screen does something; none is dead. */
async function deadButtonChecks(url) {
  const r = [];
  const g = await veteran(url, { runsPlayed: 10 });
  const screens = { mainMenu: () => window.game.showScreen('mainMenu'), campaignScreen: () => window.game.openCampaignScreen(), shopScreen: () => window.game.openWarsztatScreen(), challengesScreen: () => window.game.openChallengesScreen(), profile: () => window.game.openProfileScreen() };
  const dead = [], tried = [];
  for (const [name, open] of Object.entries(screens)) {
    await g.page.evaluate(open);
    await g.page.waitForTimeout(60);
    const tag = () => {
      const out = [];
      document.querySelectorAll('button').forEach((b, i) => { if (b.offsetParent !== null && !b.disabled && !b.matches('.toggle-btn.active') && !b.closest('.dev-panel, #devPanel') && !/dev|reset/i.test(b.id || '')) { b.dataset.qaProbe = String(i); out.push([String(i), b.id || (b.innerText || '').trim().slice(0, 30)]); } });
      return out;
    };
    const ids = await g.page.evaluate(tag);
    for (const [probe, label] of ids) {
      await g.page.evaluate(open);
      await g.page.evaluate(tag);
      let downloaded = false;
      const onDownload = () => { downloaded = true; };
      g.page.on('download', onDownload);
      await g.page.evaluate(() => { window.__qaAlive = 1; });
      const res = await g.page.evaluate(async (p) => {
        const b = document.querySelector(`[data-qa-probe="${p}"]`);
        if (!b || b.offsetParent === null) return { skipped: true };
        const shape = () => [...document.querySelectorAll('.screen, #infoSheet, #bottomNav')].filter(e => !e.classList.contains('hidden')).map(e => e.id).join() + '|' + (window.game.state) + '|' + document.body.className + '|' + document.body.innerText.length + '|' + document.querySelectorAll('.active, .selected, .looking, .open, .expanded').length;
        const before = shape();
        let mutated = 0;
        const mo = new MutationObserver((l) => { mutated += l.length; });
        mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
        b.click();
        await new Promise(res => setTimeout(res, 90));
        mo.disconnect();
        const changed = shape() !== before || mutated > 0;
        if (window.game.running) { window.game.stopRun(); }
        return { changed };
      }, probe).catch(async (e) => {
        // A button that reloads the page (language) has answered.
        if (!/context was destroyed|navigation/i.test(String(e))) throw e;
        await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state, null, { timeout: 15000 });
        return { changed: true };
      });
      g.page.off('download', onDownload);
      // A reload may start just after the click: wait for the new page before the next one.
      await g.page.waitForTimeout(120);
      await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state, null, { timeout: 15000 });
      if (!(await g.page.evaluate(() => window.__qaAlive))) res.changed = true;
      if (res.skipped) continue;
      tried.push(`${name}:${label}`);
      if (!res.changed && !downloaded) dead.push(`${name}:${label}`);
    }
  }
  r.push(report(`buttons: every visible button on the 5 hub screens responds (${tried.length} clicked)`, tried.length > 15 && dead.length === 0, dead.join(', ') || `${tried.length} ok`));
  r.push(report('buttons: clicking through them raised no error', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
  await g.browser.close();
  return r;
}

/** One full session inside the iframe at the portal's sizes, DPR 1. */
async function frameChecks(gameDir, shots) {
  const r = [];
  const bad = [];
  for (const [width, height] of CG_FRAMES) {
    const g = await portalHost(gameDir, { width, height });
    const tag = `${width}x${height}`;
    try {
      const menu = await g.frame.evaluate(() => {
        const rect = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
        const go = document.getElementById('btnWelcomePlay') || document.getElementById('btnStart');
        const vis = [...document.querySelectorAll('#btnWelcomePlay, #btnStart')].filter(e => e.offsetParent !== null).map(rect);
        return { go: !!go, vis, w: innerWidth, h: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, dpr: devicePixelRatio };
      });
      const inFrame = menu.vis.length > 0 && menu.vis.every(b => b.l >= 0 && b.t >= 0 && b.r <= menu.w + 1 && b.b <= menu.h + 1);
      if (!inFrame || menu.sw > menu.w + 1 || menu.sh > menu.h + 1 || menu.dpr !== 1) bad.push(`${tag} menu ${JSON.stringify(menu)}`);
      if (shots) await g.page.screenshot({ path: path.join(WORK, `${tag}-1-first-screen.png`) });
      // First launch: real click into the first round.
      await clickIn(g.page, g.frame, '#btnWelcomePlay');
      await g.frame.waitForFunction(() => window.game.running, null, { timeout: 8000 });
      await g.page.waitForTimeout(500);
      // The host page does not scroll under the game.
      await g.page.keyboard.press('ArrowDown');
      await g.page.keyboard.press('Space');
      await g.page.waitForTimeout(80);
      if (await g.frame.evaluate(() => window.game.paused)) await g.page.keyboard.press('KeyP');
      await g.page.mouse.move(width / 2, height / 2);
      await g.page.mouse.wheel(0, 500);
      await g.page.waitForTimeout(80);
      const scroll = await g.page.evaluate(() => scrollY);
      if (scroll !== 0) bad.push(`${tag} host scrolled ${scroll}`);
      // HUD inside the frame, canvas the size of the frame.
      const hud = await g.frame.evaluate(() => {
        const out = [];
        document.querySelectorAll('#hud *, #hud-rankBadge, #btnPause').forEach(e => { if (e.offsetParent === null) return; const b = e.getBoundingClientRect(); if (b.width && (b.right > innerWidth + 1 || b.bottom > innerHeight + 1 || b.left < -1 || b.top < -1)) out.push(e.id || e.className); });
        const c = document.querySelector('canvas'), cb = c.getBoundingClientRect();
        return { out: out.slice(0, 5), fits: Math.abs(cb.width - innerWidth) < 2 && Math.abs(cb.height - innerHeight) < 2 };
      });
      if (hud.out.length || !hud.fits) bad.push(`${tag} hud ${JSON.stringify(hud)}`);
      if (shots) await g.page.screenshot({ path: path.join(WORK, `${tag}-2-round.png`) });
      // Mouse steers; pause and resume by key.
      const p0 = await g.frame.evaluate(() => ({ x: window.game.player.x, y: window.game.player.y }));
      await g.page.mouse.move(width - 20, height / 2);
      await g.page.waitForTimeout(450);
      const p1 = await g.frame.evaluate(() => ({ x: window.game.player.x, y: window.game.player.y }));
      if (Math.hypot(p1.x - p0.x, p1.y - p0.y) < 5) bad.push(`${tag} mouse did not steer`);
      await g.page.keyboard.press('KeyP');
      await g.page.waitForTimeout(60);
      const paused = await g.frame.evaluate(() => window.game.paused);
      await g.page.keyboard.press('KeyP');
      await g.page.waitForTimeout(60);
      const resumed = await g.frame.evaluate(() => !window.game.paused);
      if (!paused || !resumed) bad.push(`${tag} pause ${paused}/${resumed}`);
      // Finish the round; the result has one obvious action, no dead row, and fits.
      await g.frame.addScriptTag({ content: ARENA_BOT });
      await g.frame.evaluate(() => { window.__qaPlayArena({ style: 'greedy' }); });
      await g.page.waitForTimeout(250);
      const res = await g.frame.evaluate(() => {
        const vis = (id) => { const e = document.getElementById(id); if (!e || e.offsetParent === null) return null; const b = e.getBoundingClientRect(); return { b: b.bottom, r: b.right, w: b.width, h: b.height }; };
        return { again: vis('btnPlayAgain'), ad: vis('btnWatchAd'), share: vis('btnShare'), h: innerHeight, w: innerWidth };
      });
      // The main action must be a real button, not only inside the frame: a row layout crushed it to 35 px wide once.
      if (!res.again || res.again.b > res.h + 1 || res.again.r > res.w + 1 || res.again.w < 160 || res.again.h < 36 || res.ad || res.share) bad.push(`${tag} result ${JSON.stringify(res)}`);
      if (shots) await g.page.screenshot({ path: path.join(WORK, `${tag}-3-result.png`) });
      if (g.errors.length) bad.push(`${tag} errors ${g.errors[0]}`);
      if (g.external.length) bad.push(`${tag} external ${g.external[0]}`);
    } catch (e) { bad.push(`${tag} ${e.message}`); }
    await g.browser.close();
  }
  r.push(report(`iframe: first launch, first round (real clicks), mouse, pause, result fit at all ${CG_FRAMES.length} portal sizes at DPR 1, the host page never scrolls`, bad.length === 0, bad.join(' ; ').slice(0, 900)));
  return r;
}

/** Keyboard in the iframe and a resize / turn of the frame while playing. */
async function inputChecks(gameDir) {
  const r = [];
  const g = await portalHost(gameDir, { width: 1216, height: 684 });
  await clickIn(g.page, g.frame, '#btnWelcomePlay');
  await g.frame.waitForFunction(() => window.game.running, null, { timeout: 8000 });
  await g.page.mouse.move(608, 342);
  await g.page.waitForTimeout(600);
  const x0 = await g.frame.evaluate(() => { window.game.pointerActive = false; return window.game.player.x; });
  await g.page.keyboard.down('KeyD');
  await g.page.waitForTimeout(500);
  await g.page.keyboard.up('KeyD');
  const key = await g.frame.evaluate(() => ({ x: window.game.player.x, dir: window.game.keyDir }));
  r.push(report('input: WASD reaches the game in the iframe (physical keys, so AZERTY ZQSD works too)', key.x !== x0, `${x0} -> ${key.x}`));
  await g.page.setViewportSize({ width: 800, height: 450 });
  await g.page.evaluate(() => { const f = document.getElementById('frame'); f.style.width = '450px'; f.style.height = '800px'; });
  await g.page.setViewportSize({ width: 450, height: 800 });
  await g.page.waitForTimeout(350);
  const turned = await g.frame.evaluate(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return { w: innerWidth, h: innerHeight, cw: c.width, ch: c.height, running: window.game.running, sw: document.documentElement.scrollWidth }; });
  r.push(report('iframe: a turn of the frame mid-round refits the canvas and keeps the round', turned.running && turned.w === 450 && Math.abs(turned.ch - turned.h) < 2 && turned.sw <= turned.w + 1, JSON.stringify(turned)));
  await g.page.evaluate(() => { document.getElementById('frame').style.width = '1216px'; document.getElementById('frame').style.height = '684px'; });
  await g.page.setViewportSize({ width: 1216, height: 684 });
  await g.page.waitForTimeout(350);
  const back = await g.frame.evaluate(() => ({ w: innerWidth, running: window.game.running, ch: document.querySelector('canvas').getBoundingClientRect().height }));
  r.push(report('iframe: resized back, still running and fitted', back.running && back.w === 1216 && Math.abs(back.ch - 684) < 2, JSON.stringify(back)));
  // Focus lost: no reset.
  const sv = await g.frame.evaluate(() => { window.dispatchEvent(new Event('blur')); return { state: String(window.game.state), coins: window.game.save.coins }; });
  await g.page.waitForTimeout(150);
  const after = await g.frame.evaluate(() => ({ state: String(window.game.state), coins: window.game.save.coins, running: window.game.running, paused: window.game.paused }));
  r.push(report('focus: losing focus pauses at most, the round and the save stay', after.running && after.coins === sv.coins, JSON.stringify(after)));
  await g.browser.close();
  return r;
}

async function saveChecks(gameDir, url) {
  const r = [];
  const g = await portalHost(gameDir, { width: 1216, height: 684, locale: 'pl-PL' });
  await clickIn(g.page, g.frame, '#btnWelcomePlay');
  await g.frame.waitForFunction(() => window.game.running, null, { timeout: 8000 });
  await g.frame.addScriptTag({ content: ARENA_BOT });
  const a = await g.frame.evaluate(() => {
    window.__qaPlayArena({ style: 'greedy' });
    const gm = window.game, raw = JSON.parse(localStorage.getItem('vectorHoleSave_v1'));
    return { schema: raw.schemaVersion, runs: gm.save.stats.runsPlayed, coins: gm.save.coins, stored: raw.coins, storedRuns: raw.stats.runsPlayed };
  });
  r.push(report('save: a new game writes SAVE v13 after the first round', a.schema === 13 && a.stored === a.coins && a.storedRuns === a.runs && a.runs >= 1, JSON.stringify(a)));
  // A purchase through the game's own path, then a reload of the iframe.
  const bought = await g.frame.evaluate(async () => {
    const gm = window.game;
    gm.save.coins += 50000;
    gm.openWarsztatScreen();
    const coins0 = gm.save.coins;
    const card = [...document.querySelectorAll('#shopScreen .skin-card')].find(c => { c.click(); const o = gm.warsztatFocus && gm.warsztatOffer(gm.warsztatFocus.item); return o && o.state !== 'short' && o.state !== 'reward' && o.state !== 'owned' && !document.getElementById('btnWarsztatBuy').classList.contains('hidden') && gm.warsztatFocus.item.price > 0; });
    const item = gm.warsztatFocus && gm.warsztatFocus.item;
    if (card) document.getElementById('btnWarsztatBuy').click();
    await new Promise(res => setTimeout(res, 120));
    return { coins: gm.save.coins, spent: coins0 - gm.save.coins, item: item && item.id, sel: JSON.stringify(gm.save.selected), runs: gm.save.stats.runsPlayed };
  });
  await g.frame.evaluate(() => location.reload());
  await g.page.waitForTimeout(400);
  const frame2 = g.page.frames().find(f => f.url().includes('game-files'));
  await frame2.waitForFunction(() => window.game && window.game.state !== undefined && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 15000 });
  const b = await frame2.evaluate(() => ({ coins: window.game.save.coins, runs: window.game.save.stats.runsPlayed, sel: JSON.stringify(window.game.save.selected), schema: window.game.save.schemaVersion, welcome: (document.getElementById('btnWelcomePlay') || {}).offsetParent != null }));
  r.push(report('save: an iframe reload restores coins, the purchase and the run count, no first-run screen', bought.spent > 0 && b.coins === bought.coins && b.runs === bought.runs && b.sel === bought.sel && b.schema === 13 && !b.welcome, JSON.stringify({ bought, b })));
  await g.page.reload();
  const frame3 = g.page.frames().find(f => f.url().includes('game-files'));
  await frame3.waitForFunction(() => window.game && window.game.state !== undefined && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 15000 });
  const c = await frame3.evaluate(() => ({ coins: window.game.save.coins, runs: window.game.save.stats.runsPlayed, cloud: !!window.game.monetization.cloudData }));
  r.push(report('save: a reload of the portal page keeps it too; no cloud copy is attached', c.coins === b.coins && c.runs === b.runs && !c.cloud, JSON.stringify(c)));
  r.push(report('save: no errors in the portal iframe', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
  await g.browser.close();

  const blocked = await openGame(url, { viewport: { width: 1216, height: 684 }, mobile: false, deviceScaleFactor: 1, initScript: `Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });` }).then(x => x, e => ({ failed: String(e) }));
  if (blocked.failed) r.push(report('save: with storage blocked (third-party iframe) the game still boots', false, blocked.failed));
  else {
    const go = await blocked.page.evaluate(() => { const b = document.getElementById('btnWelcomePlay'); return !!b && b.offsetParent !== null; });
    r.push(report('save: with storage blocked (third-party iframe) the game still boots', go && blocked.errors.length === 0, blocked.errors.slice(0, 1).join()));
    await blocked.browser.close();
  }
  return r;
}

/** Campaign in the portal iframe: a real click on the mission's launch button, the bot
 *  plays it, the result screen has its actions and no ad offer. */
async function campaignFrameChecks(gameDir) {
  const r = [];
  const g = await portalHost(gameDir, { width: 1216, height: 684 });
  await g.frame.addScriptTag({ content: VISIBLE_AD_OFFERS });
  await g.frame.addScriptTag({ content: CAMPAIGN_BOT });
  await g.frame.evaluate(() => { const gm = window.game; gm.openCampaignScreen(); gm.openMissionBriefing('M01'); });
  await g.page.waitForTimeout(200);
  await clickIn(g.page, g.frame, '[data-mc-launch]');
  await g.frame.waitForFunction(() => window.game.running && window.game.mode === 'campaign', null, { timeout: 8000 });
  const out = await g.frame.evaluate(async () => {
    const gm = window.game, res = window.__qaPlayMission('M01', { style: 'expert', clock0: 9e6 });
    await new Promise(r => setTimeout(r, 200));
    const screen = document.getElementById('missionResultScreen') || document.querySelector('.screen:not(.hidden)');
    const buttons = [...document.querySelectorAll('.screen:not(.hidden) button')].filter(b => b.offsetParent !== null).map(b => (b.innerText || '').trim()).filter(Boolean);
    return { stars: res.stars, completed: !!gm.save.campaign.completed.M01, screen: screen && screen.id, buttons, offers: window.__adOffers(), raw: JSON.parse(localStorage.getItem('vectorHoleSave_v1')).campaign.completed.M01 };
  });
  r.push(report('Campaign in the iframe: launched by a real click, played, result shown with its actions and no ad offer, saved', out.completed && !!out.raw && out.buttons.length > 0 && out.offers.length === 0 && g.errors.length === 0, JSON.stringify({ ...out, errors: g.errors.slice(0, 1) })));
  await g.browser.close();
  return r;
}

/** Real installed browsers, not the bundled Chromium: boot, first round, English, no errors. */
async function installedBrowserChecks(url) {
  const r = [];
  for (const [channel, name] of [['chrome', 'Chrome'], ['msedge', 'Edge']]) {
    let browser;
    try { browser = await chromium.launch({ channel }); } catch (e) { r.push({ name: `browser: ${name} NOT RUN (${String(e.message || e).split('\n')[0].slice(0, 90)})`, ok: true, notRun: true }); continue; }
    try {
      const context = await browser.newContext({ viewport: { width: 1216, height: 684 }, deviceScaleFactor: 1, locale: 'en-US' });
      const page = await context.newPage();
      const errors = [], external = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (rt) => { external.push(rt.request().url()); rt.abort(); });
      await context.route(CG_SDK_URL, (rt) => rt.fulfill({ contentType: 'text/javascript', body: PKG_SDK }));
      await page.goto(url);
      await page.waitForFunction(() => window.game && window.game.state);
      const box = await page.locator('#btnWelcomePlay').boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForFunction(() => window.game.running, null, { timeout: 8000 });
      await page.mouse.move(1100, 340);
      await page.waitForTimeout(800);
      const t0 = await page.evaluate(() => window.game.timeRemaining);
      await page.waitForTimeout(3000);
      const st = await page.evaluate(() => ({ ua: navigator.userAgent.match(/(Edg|Chrome)\/[\d.]+/g).join(' '), t: window.game.timeRemaining, frames: window.game.frameCount ?? null, x: window.game.player.x, provider: window.game.monetization.provider }));
      await page.keyboard.press('KeyP');
      await page.waitForTimeout(100);
      const paused = await page.evaluate(() => window.game.paused);
      r.push(report(`browser: ${name} runs the package: first round, the clock counts real seconds, pause, no errors, nothing external`, Math.abs(t0 - st.t - 3) < 0.6 && paused && st.provider === 'none' && !errors.length && !external.length, JSON.stringify({ ...st, ran: +(t0 - st.t).toFixed(2), errors: errors.slice(0, 2), external })));
    } catch (e) { r.push(report(`browser: ${name} runs the package`, false, String(e.message || e).slice(0, 300))); }
    await browser.close();
  }
  return r;
}

/** Real Pointer Lock of real Chromium in the portal iframe, driven by automated input. That
 *  is not a physical mouse: Esc pressed on a keyboard is handled by the browser itself and
 *  cannot be sent from here, so a lock ended from outside stands in for it. */
async function pointerLockChecks(gameDir, url, webUrl) {
  const r = [];
  const state = (f) => f.evaluate(() => {
    const gm = window.game, cur = document.getElementById('lockCursor'), hint = document.getElementById('lockHint');
    return { locked: !!document.pointerLockElement, flag: !!gm.pointerLocked, running: gm.running, paused: gm.paused, x: gm.player.x, y: gm.player.y, ps: gm.pointerScreen,
      cursor: !!cur && !cur.classList.contains('hidden'), hint: !!hint && !hint.classList.contains('hidden'), hintText: hint ? hint.textContent : '', w: gm.width, h: gm.height, vt: cur ? cur.style.transform : '' };
  });
  const g = await portalHost(gameDir, { width: 1216, height: 684 });
  const f = g.frame;
  await clickIn(g.page, f, '#btnWelcomePlay');
  await f.waitForFunction(() => window.game.running, null, { timeout: 8000 });
  await g.page.waitForTimeout(150);
  const start = await state(f);
  r.push(report('lock: no lock from the click that started the round', !start.locked && !start.flag, JSON.stringify(start)));
  await g.page.mouse.move(700, 340);
  await g.page.waitForTimeout(250);
  const before = await state(f);
  r.push(report('lock: before the opt-in the plain cursor steers, with the offer on screen', !before.locked && before.hint && /lock the cursor/i.test(before.hintText), JSON.stringify(before)));
  await g.page.mouse.down(); await g.page.mouse.up();
  await f.waitForFunction(() => !!document.pointerLockElement && window.game.pointerLocked, null, { timeout: 4000 });
  const locked = await state(f);
  r.push(report('lock: a click on the board locks the mouse, shows the pointer, hides the offer', locked.locked && locked.flag && locked.cursor && !locked.hint, JSON.stringify(locked)));

  // Steering in every direction from relative moves (mouse.move sends the deltas).
  const moves = { right: [300, 0], left: [-600, 0], down: [300, 250], up: [0, -500] };
  const dirs = {};
  let px = 700, py = 340;
  for (const [name, [dx, dy]] of Object.entries(moves)) {
    const a = await state(f);
    px += dx; py += dy;
    await g.page.mouse.move(px, py);
    await g.page.waitForTimeout(450);
    const b = await state(f);
    dirs[name] = [Math.round(b.x - a.x), Math.round(b.y - a.y), b.ps && Math.round(b.ps.x), b.ps && Math.round(b.ps.y)];
  }
  r.push(report('lock: the hole follows the locked pointer in all four directions', dirs.right[0] > 0 && dirs.left[0] < 0 && dirs.down[1] > 0 && dirs.up[1] < 0, JSON.stringify(dirs)));

  // Edges: far beyond the frame the pointer stays inside it.
  await g.page.mouse.move(px + 5000, py + 5000);
  await g.page.waitForTimeout(60);
  const edge1 = await state(f);
  await g.page.mouse.move(px - 9000, py - 9000);
  await g.page.waitForTimeout(60);
  const edge2 = await state(f);
  r.push(report('lock: the virtual pointer stops at the frame on every edge', edge1.ps.x === edge1.w && edge1.ps.y === edge1.h && edge2.ps.x === 0 && edge2.ps.y === 0, JSON.stringify({ a: edge1.ps, b: edge2.ps })));
  await g.page.mouse.move(px - 8500, py - 8700);
  await g.page.waitForTimeout(60);

  // The pause button under the virtual pointer answers a click.
  const pauseBox = await f.locator('#btnPause').boundingBox();
  const at = await state(f);
  await g.page.mouse.move(px - 8500 + (pauseBox.x + pauseBox.width / 2 - at.ps.x), py - 8700 + (pauseBox.y + pauseBox.height / 2 - at.ps.y));
  await g.page.waitForTimeout(60);
  await g.page.mouse.down(); await g.page.mouse.up();
  await g.page.waitForTimeout(350);
  const paused = await state(f);
  r.push(report('UI: the pause button is clickable with the locked pointer, and the menu frees the cursor', paused.paused && !paused.locked && !paused.cursor, JSON.stringify(paused)));

  // The menu takes real clicks; closing it locks again (no second opt-in).
  await clickIn(g.page, f, '#pauseSheet button');
  await f.waitForFunction(() => !window.game.paused, null, { timeout: 3000 }).catch(() => {});
  await g.page.waitForTimeout(500);
  const back = await state(f);
  r.push(report('recovery: leaving the pause menu locks the mouse again', !back.paused && back.locked && back.cursor, JSON.stringify(back)));

  // P pauses and frees the cursor, P resumes and locks again.
  await g.page.keyboard.press('KeyP');
  await g.page.waitForTimeout(250);
  const p1 = await state(f);
  await g.page.keyboard.press('KeyP');
  await g.page.waitForTimeout(500);
  const p2 = await state(f);
  r.push(report('keys: P pauses with the cursor free and resumes with the lock back', p1.paused && !p1.locked && !p2.paused && p2.locked, JSON.stringify({ p1: [p1.paused, p1.locked], p2: [p2.paused, p2.locked] })));

  // WASD while locked.
  const k0 = await state(f);
  await g.page.keyboard.down('KeyD');
  await g.page.waitForTimeout(350);
  await g.page.keyboard.up('KeyD');
  const k1 = await state(f);
  r.push(report('keys: WASD still works while the mouse is locked', k1.locked && k1.x !== k0.x, JSON.stringify([k0.x, k1.x])));

  // A lock ended from outside (what Esc or a lost focus does): pause, no driving on, no resume by a late Esc.
  await f.evaluate(() => document.exitPointerLock());
  await g.page.waitForTimeout(120);
  const esc = await state(f);
  await g.page.keyboard.press('Escape');
  await g.page.waitForTimeout(40);
  const esc2 = await state(f);
  r.push(report('Esc: a lock lost from outside pauses, frees the cursor, and an Esc delivered right after does not resume', esc.paused && !esc.locked && !esc.cursor && esc.ps === null && esc2.paused, JSON.stringify({ esc: [esc.paused, esc.locked, esc.ps], esc2: esc2.paused })));
  const still0 = await state(f);
  await g.page.waitForTimeout(400);
  const still1 = await state(f);
  r.push(report('leaving: paused and unlocked, the hole does not move by itself', still0.x === still1.x && still0.y === still1.y));
  // Resume right after Esc: the browser's refusal must not leave the player stuck.
  await clickIn(g.page, f, '#pauseSheet button');
  await g.page.waitForTimeout(1900);
  const relock = await state(f);
  r.push(report('recovery: after Esc and resume the game plays on, locked or offering the lock', !relock.paused && relock.running && (relock.locked || relock.hint), JSON.stringify(relock)));

  // The next round after a finished one locks without a new opt-in; the result screen is free.
  await f.addScriptTag({ content: ARENA_BOT });
  const res = await f.evaluate(() => { window.__qaPlayArena({ style: 'afk' }); return String(window.game.state); });
  await g.page.waitForTimeout(350);
  const after = await state(f);
  r.push(report('menu: the result screen has a free cursor', !after.locked && !after.cursor, JSON.stringify({ res, locked: after.locked })));
  r.push(report('lock: no errors in the iframe', g.errors.length === 0 && g.external.length === 0, g.errors.slice(0, 2).join(' | ')));
  await g.browser.close();

  // Focus lost while unlocked or locked: the existing rule still pauses.
  const b = await portalHost(gameDir, { width: 1216, height: 684 });
  await clickIn(b.page, b.frame, '#btnWelcomePlay');
  await b.frame.waitForFunction(() => window.game.running, null, { timeout: 8000 });
  await b.page.mouse.move(700, 340);
  await b.page.waitForTimeout(200);
  await b.page.mouse.down(); await b.page.mouse.up();
  await b.frame.waitForFunction(() => !!document.pointerLockElement && window.game.pointerLocked, null, { timeout: 4000 });
  await b.frame.evaluate(() => window.dispatchEvent(new Event('blur')));
  await b.page.waitForTimeout(300);
  const blur = await state(b.frame);
  r.push(report('focus: losing focus pauses and frees the cursor, the round stays', blur.paused && blur.running && !blur.locked && blur.ps === null, JSON.stringify([blur.paused, blur.locked, blur.ps])));
  await b.browser.close();

  // Unsupported API and a frame that refuses: the plain cursor keeps working, no offer forever.
  const none = await openGame(url, { viewport: { width: 1216, height: 684 }, mobile: false, deviceScaleFactor: 1, initScript: 'delete HTMLElement.prototype.requestPointerLock; delete Element.prototype.requestPointerLock;' });
  await none.page.evaluate(() => document.getElementById('btnWelcomePlay').click());
  await none.page.waitForFunction(() => window.game.running, null, { timeout: 8000 });
  await none.page.waitForTimeout(300);
  const n0 = await none.page.evaluate(() => ({ x: window.game.player.x, hint: !!document.getElementById('lockHint'), cursor: !!document.getElementById('lockCursor') }));
  await none.page.mouse.move(1100, 340);
  await none.page.waitForTimeout(450);
  const n1 = await none.page.evaluate(() => window.game.player.x);
  r.push(report('no API: the game runs, no offer, the plain cursor steers', !n0.hint && !n0.cursor && n1 !== n0.x && none.errors.length === 0, JSON.stringify({ n0, n1, errors: none.errors.slice(0, 1) })));
  await none.browser.close();

  const refuse = await openGame(url, { viewport: { width: 1216, height: 684 }, mobile: false, deviceScaleFactor: 1, initScript: "Element.prototype.requestPointerLock = function () { setTimeout(() => document.dispatchEvent(new Event('pointerlockerror')), 0); return Promise.reject(new DOMException('no', 'SecurityError')); };" });
  await refuse.page.evaluate(() => document.getElementById('btnWelcomePlay').click());
  await refuse.page.waitForFunction(() => window.game.running, null, { timeout: 8000 });
  await refuse.page.mouse.move(800, 340);
  await refuse.page.waitForTimeout(250);
  for (let i = 0; i < 4; i++) { await refuse.page.mouse.down(); await refuse.page.mouse.up(); await refuse.page.waitForTimeout(40); }
  await refuse.page.waitForTimeout(250);
  const x0 = await refuse.page.evaluate(() => window.game.player.x);
  await refuse.page.mouse.move(1150, 340);
  await refuse.page.waitForTimeout(450);
  const ref = await refuse.page.evaluate(() => ({ x: window.game.player.x, hint: !document.getElementById('lockHint').classList.contains('hidden'), running: window.game.running, paused: window.game.paused }));
  r.push(report('refused: a frame that refuses the lock leaves the plain cursor steering, and the offer goes away', ref.x !== x0 && !ref.hint && ref.running && !ref.paused && refuse.errors.length === 0, JSON.stringify({ x0, ref, errors: refuse.errors.slice(0, 1) })));
  await refuse.browser.close();

  // Touch: no lock, no offer.
  const t = await openGame(url, { viewport: { width: 800, height: 450 }, mobile: true, deviceScaleFactor: 2 });
  await t.page.evaluate(() => document.getElementById('btnWelcomePlay').click());
  await t.page.waitForFunction(() => window.game.running, null, { timeout: 8000 });
  await t.page.touchscreen.tap(600, 220);
  await t.page.waitForTimeout(250);
  const ts = await t.page.evaluate(() => ({ locked: !!document.pointerLockElement, hint: !document.getElementById('lockHint').classList.contains('hidden') }));
  r.push(report('touch: a tap never locks and never shows the offer', !ts.locked && !ts.hint, JSON.stringify(ts)));
  await t.browser.close();

  // Web build: nothing of this exists.
  const w = await openGame(webUrl, { viewport: { width: 1216, height: 684 }, mobile: false, deviceScaleFactor: 1 });
  await w.page.evaluate(() => document.getElementById('btnWelcomePlay').click());
  await w.page.waitForFunction(() => window.game.running, null, { timeout: 8000 });
  await w.page.mouse.move(800, 340);
  await w.page.mouse.down(); await w.page.mouse.up();
  await w.page.waitForTimeout(300);
  const ws = await w.page.evaluate(() => ({ locked: !!document.pointerLockElement, parts: !!document.getElementById('lockCursor') || !!document.getElementById('lockHint'), flag: window.game.pointerLocked }));
  r.push(report('GitHub Pages build: no Pointer Lock, no pointer, no offer', !ws.locked && !ws.parts && !ws.flag, JSON.stringify(ws)));
  await w.browser.close();
  return r;
}

/** What the general platform suites can only check with the plain cursor: before the opt-in
 *  the cursor can leave a frame smaller than the page; after it, modals still stop the hole. */
async function portalFlowChecks(gameDir, url) {
  const r = [];
  const pos = (f) => f.evaluate(() => ({ x: window.game.player.x, y: window.game.player.y, ptr: window.game.pointerScreen, paused: window.game.paused, kx: window.game.keyDir.x, locked: !!document.pointerLockElement && window.game.pointerLocked, pending: !!window.game.evolutionPending }));
  const a = await portalHost(gameDir, { width: 1216, height: 684, frameW: 900, frameH: 506 });
  await clickIn(a.page, a.frame, '#btnWelcomePlay');
  await a.frame.waitForFunction(() => window.game.running, null, { timeout: 8000 });
  await a.page.mouse.move(600, 380);
  await a.page.waitForTimeout(150);
  const inside = await pos(a.frame);
  await a.page.mouse.move(1050, 300);
  await a.page.waitForTimeout(150);
  const out1 = await pos(a.frame);
  await a.page.waitForTimeout(600);
  const out2 = await pos(a.frame);
  r.push(report('before the opt-in: the cursor leaving the frame stops the hole, it does not drive on', !!inside.ptr && !inside.locked && out1.ptr === null && Math.hypot(out2.x - out1.x, out2.y - out1.y) < 3, JSON.stringify({ inside: inside.ptr, after: out1.ptr, drift: Math.hypot(out2.x - out1.x, out2.y - out1.y) })));
  await a.page.mouse.move(600, 380);
  await a.page.keyboard.down('ArrowRight');
  await a.page.waitForTimeout(150);
  const held = await pos(a.frame);
  await a.page.mouse.click(1050, 300); // the portal page takes the focus
  await a.page.waitForTimeout(250);
  const blurred = await pos(a.frame);
  await a.page.keyboard.up('ArrowRight');
  r.push(report('before the opt-in: a click on the portal page releases the held key, stops steering and pauses, no lock', held.kx > 0 && blurred.kx === 0 && blurred.paused && blurred.ptr === null && !blurred.locked, JSON.stringify({ held: held.kx, blurred })));
  await a.browser.close();

  const b = await portalHost(gameDir, { width: 1216, height: 684 });
  await clickIn(b.page, b.frame, '#btnWelcomePlay');
  await b.frame.waitForFunction(() => window.game.running, null, { timeout: 8000 });
  await b.page.mouse.move(700, 340);
  await b.page.waitForTimeout(200);
  await b.page.mouse.down(); await b.page.mouse.up();
  await b.frame.waitForFunction(() => !!document.pointerLockElement && window.game.pointerLocked, null, { timeout: 4000 });
  await b.page.keyboard.press('KeyP');
  await b.page.waitForTimeout(200);
  const p0 = await pos(b.frame);
  await b.page.mouse.move(300, 200); await b.page.mouse.move(1000, 500);
  await b.page.waitForTimeout(350);
  const p1 = await pos(b.frame);
  r.push(report('modal: the pause sheet frees the cursor and the hole stays put while the mouse moves', p0.paused && !p0.locked && p1.x === p0.x && p1.y === p0.y, JSON.stringify([p0.x, p1.x, p0.locked])));
  await b.page.keyboard.press('KeyP');
  await b.page.waitForTimeout(500);
  await b.frame.evaluate(() => { const gm = window.game; gm.evolutionOffersTriggered = new Set(); gm.offerEvolution(); });
  await b.page.waitForTimeout(250);
  const e0 = await pos(b.frame);
  await b.page.mouse.move(400, 300); await b.page.mouse.move(800, 400);
  await b.page.waitForTimeout(300);
  const e1 = await pos(b.frame);
  r.push(report('modal: the evolution cards free the cursor and the hole stays put', e0.pending && !e0.locked && e1.x === e0.x && e1.y === e0.y, JSON.stringify([e0.pending, e0.locked, e0.x, e1.x])));
  await clickIn(b.page, b.frame, '#evolutionCards .evolution-card');
  await b.page.waitForTimeout(600);
  const e2 = await pos(b.frame);
  r.push(report('modal: a real click picks a card and the mouse locks again', !e2.pending && e2.locked, JSON.stringify([e2.pending, e2.locked])));
  r.push(report('modal: no errors', b.errors.length === 0, b.errors.slice(0, 2).join(' | ')));
  await b.browser.close();

  // +20 s for prisms, the one offer left on that screen, at every portal size.
  const g = await veteran(url, {});
  const bad = [];
  for (const [width, height] of CG_FRAMES) {
    await g.page.setViewportSize({ width, height });
    await g.page.waitForTimeout(120);
    const m = await g.page.evaluate(() => {
      const gm = window.game;
      gm.save.prisms = CONFIG.ads.revivePrisms;
      gm.startCampaignMission('M05');
      gm.introPending = false;
      gm.campaignGoalFraction = () => 0.9;
      gm.onCampaignTimeout();
      const fit = (id) => { const e = document.getElementById(id); if (!e || e.offsetParent === null) return false; const r = e.getBoundingClientRect(); return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 && r.height >= 30; };
      const out = { prisms: fit('btnRevivePrisms'), no: fit('btnReviveNo'), ad: document.getElementById('btnReviveAd').offsetParent !== null };
      gm.hideReviveOffer();
      delete gm.campaignGoalFraction;
      gm.stopRun();
      return out;
    });
    if (!m.prisms || !m.no || m.ad) bad.push(`${width}x${height} ${JSON.stringify(m)}`);
  }
  r.push(report(`+20 s: both remaining buttons fit at all ${CG_FRAMES.length} portal sizes, no ad button`, bad.length === 0, bad.join(' ; ')));
  await g.browser.close();
  return r;
}

/** The starter hole: a black hole with a cyan rim that turns; every other look byte-equal to the base. */
async function holeChecks(url, webUrl) {
  const r = [];
  const g = await openGame(webUrl, { viewport: { width: 800, height: 600 }, mobile: false, deviceScaleFactor: 1 });
  await g.page.evaluate(() => { const gm = window.game; gm.startRound({ seed: 4242 }); cancelAnimationFrame(gm.rafId); gm.running = false; });
  const pic = await g.page.evaluate(() => {
    const Hole = window.game.player.constructor;
    const paint = (skin, radius, t, bg) => { const c = document.createElement('canvas'); c.width = c.height = 400; const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 400, 400); x.translate(200, 200); const h = new Hole('', 0, 0, true); h.skin = skin; h.radius = radius; h.auraId = 'none'; h.draw(x, t); return x.getImageData(0, 0, 400, 400).data; };
    const stats = (d, r) => { let dark = 0, n = 0, sum = 0, sq = 0, cyan = 0, hot = 0; for (let y = 0; y < 400; y++) for (let x = 0; x < 400; x++) { const dd = Math.hypot(x - 200, y - 200); if (dd > r * 1.04) continue; const i = (y * 400 + x) * 4, R = d[i], G = d[i + 1], B = d[i + 2], l = (R + G + B) / 3; n++; sum += l; sq += l * l; if (dd < r * 0.3 && l < 40) dark++; if (G > 170 && B > 170 && R < 170) cyan++; if (Math.max(R, G, B) - Math.min(R, G, B) > 120 && !(B >= R && G >= R)) hot++; } return { core: dark / (Math.PI * (r * 0.3) ** 2), std: Math.sqrt(sq / n - (sum / n) ** 2), cyan: cyan / n, hot: hot / n }; };
    const a = paint('rainbow', 120, 1, '#0A1626'), b = paint('rainbow', 120, 1.4, '#0A1626'), prism = paint('pryzmat', 120, 1, '#0A1626'), small = paint('rainbow', 14, 1, '#0A1626');
    let diff = 0; for (let i = 0; i < a.length; i += 4) diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    return { hole: stats(a, 120), prism: stats(prism, 120), small: stats(small, 14), motion: diff / 160000 };
  });
  r.push(report('hole: deep black centre, not a flat disc (spread of brightness), a visible turn between frames', pic.hole.core > 0.85 && pic.hole.std > 15 && pic.motion > 1, JSON.stringify(pic)));
  r.push(report('hole: cyan accent present, no warm rainbow hues left in the starter look', pic.hole.cyan > 0.01 && pic.hole.hot < 0.002, JSON.stringify(pic.hole)));
  r.push(report('hole: at phone size (r = 14) the cyan rim still reads', pic.small.cyan > 0.02, JSON.stringify(pic.small)));
  r.push(report('hole: Pryzmat, the Core City reward, keeps its rainbow', pic.prism.hot > 0.02, JSON.stringify(pic.prism)));
  const names = await g.page.evaluate(() => SKINS.find(k => k.id === 'rainbow').name);
  r.push(report('hole: same save id and price, new name in the Warsztat', names === 'Horyzont', names));
  await g.browser.close();

  // Every other skin, bot style and aura: pixel-equal to the base commit at a fixed time.
  const BASE = '727b8bdbf93a4033aea0b213d6572f22260384cd';
  const dir = path.join(WORK, 'base-site');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['index.html', 'game.js', 'style.css']) fs.writeFileSync(path.join(dir, f), revisionFile(BASE, f));
  const base = await serve({ root: dir });
  const sample = async (u) => {
    const b = await openGame(u, { viewport: { width: 800, height: 600 }, mobile: false, deviceScaleFactor: 1 });
    const out = await b.page.evaluate(() => {
      const gm = window.game; gm.startRound({ seed: 4242 }); cancelAnimationFrame(gm.rafId); gm.running = false;
      const Hole = gm.player.constructor, hash = (d) => { let h = 2166136261; for (let i = 0; i < d.length; i += 3) { h ^= d[i]; h = Math.imul(h, 16777619); } return h >>> 0; };
      const res = {};
      const paint = (opt) => { const c = document.createElement('canvas'); c.width = c.height = 260; const x = c.getContext('2d'); x.translate(130, 130); const h = new Hole('', 0, 0, true); Object.assign(h, { radius: 70 }, opt); h.draw(x, 1.25); return hash(x.getImageData(0, 0, 260, 260).data); };
      for (const k of SKINS) if (k.id !== 'rainbow') res['skin:' + k.id] = paint({ skin: k.id, auraId: 'none' });
      for (const a of AURAS) res['aura:' + a.id] = paint({ skin: 'cyan', auraId: a.id });
      for (const st of ['tech', 'plasma', 'toxic', 'galaxy', 'crystal', 'sun']) res['bot:' + st] = paint({ skin: 'custom', edgeColor: '#FF54AD', styleOverride: st, isPlayer: false });
      return res;
    });
    await b.browser.close();
    return out;
  };
  const [was, now] = [await sample(base.url), await sample(webUrl)];
  base.server.close();
  const changed = Object.keys(was).filter(k => was[k] !== now[k]);
  r.push(report(`hole: all ${Object.keys(was).length} other skins, auras and bot styles draw the same pixels as the base`, Object.keys(was).length > 15 && changed.length === 0, changed.join(', ')));
  return r;
}

/** The coordinator's checks on what the marker isolates. */
async function isolationChecks(gameDir, url, webUrl) {
  const r = [];
  // The web build on a crazygames host (no marker): it asks for the SDK, which is the Full Launch path, and survives its failure.
  const site = path.join(WORK, 'no-marker');
  fs.rmSync(site, { recursive: true, force: true });
  fs.cpSync(gameDir, site, { recursive: true });
  fs.writeFileSync(path.join(site, 'index.html'), fs.readFileSync(path.join(site, 'index.html'), 'utf8').replace(' data-distribution="crazygames-basic"', ''));
  const un = await portalHost(site, { width: 1216, height: 684, cgSdk: null });
  await un.frame.waitForFunction(() => window.game.monetization.provider === 'none', null, { timeout: 12000 });
  const u = await un.frame.evaluate(() => { const vis = (id) => document.getElementById(id).offsetParent !== null; return { left: window.game.monetization.placementLeft('free_prisms'), sharePresent: !document.getElementById('btnShare').parentElement.classList.contains('hidden'), consentRow: !document.querySelector('[data-consent]').closest('.control-row').classList.contains('hidden'), lockParts: !!document.getElementById('lockHint'), vis: vis('adOverlay') }; });
  r.push(report('marker: without it (wrong upload) the SDK is requested, its failure hides the ad offers, and package-only changes stay off', un.external.some(x => /sdk.crazygames/.test(x)) && u.left === 0 && u.sharePresent && u.consentRow && !u.lockParts, JSON.stringify({ ...u, external: un.external })));
  await un.browser.close();
  // user-select: typing and selecting in fields, on both builds.
  for (const [name, addr] of [['package', url], ['web build', webUrl]]) {
    const g = await veteran(addr, { runsPlayed: 10 });
    const res = await g.page.evaluate(() => { window.game.openProfileScreen(); const i = document.getElementById('displayNameInput'); i.scrollIntoView(); return { body: getComputedStyle(document.body).userSelect, input: getComputedStyle(i).userSelect, vis: i.offsetParent !== null }; });
    await g.page.click('#displayNameInput');
    await g.page.keyboard.press('Control+A');
    await g.page.keyboard.type('QA Name');
    const typed = await g.page.evaluate(() => { const i = document.getElementById('displayNameInput'); i.select(); return { value: i.value, selected: i.value.substring(i.selectionStart, i.selectionEnd) }; });
    r.push(report(`user-select (${name}): the page does not select, the name field types and selects`, res.body === 'none' && res.input !== 'none' && typed.value === 'QA Name' && typed.selected === 'QA Name', JSON.stringify({ ...res, ...typed })));
    await g.browser.close();
  }
  // The release assembler has no idea of the marker or the tools.
  const asm = fs.readFileSync(path.join(ROOT, '.github/scripts/assemble-release.mjs'), 'utf8'), wf = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy-pages.yml'), 'utf8');
  r.push(report('release: the assembler and the workflow know nothing of the package or tools/', !/data-distribution|crazygames|tools[/]/i.test(asm + wf)));
  return r;
}

async function languageChecks(url) {
  const r = [];
  const g = await openGame(url, { locale: 'de-DE', viewport: { width: 1216, height: 684 }, mobile: false, deviceScaleFactor: 1, query: '?i18n=log' });
  const lang = await g.page.evaluate(() => I18N.lang);
  r.push(report('language: a browser in any other language gets English (the SDK's en-US decides, qa/cg-lang1.mjs has the matrix)', lang === 'en', lang));
  await g.browser.close();
  // The SDK's locale decides, not the browser (here en-US from the mock's default); Profil → Polski is remembered.
  const pl = await openGame(url, { locale: 'pl-PL', viewport: { width: 1216, height: 684 }, mobile: false, deviceScaleFactor: 1 });
  const plang = await pl.page.evaluate(() => ({ lang: I18N.lang, saved: JSON.parse(localStorage.getItem('vectorHoleSave_v1')).settings.lang }));
  r.push(report('language: a Polish browser with an English SDK locale gets English, and the save keeps "auto"', plang.lang === 'en' && plang.saved === 'auto', JSON.stringify(plang)));
  await pl.page.evaluate(() => { window.game.openProfileScreen(); });
  await Promise.all([pl.page.waitForEvent('load'), pl.page.click('[data-lang="pl"]')]);
  await pl.page.waitForFunction(() => window.game && window.game.state !== undefined);
  const chosen = await pl.page.evaluate(() => ({ lang: I18N.lang, saved: JSON.parse(localStorage.getItem('vectorHoleSave_v1')).settings.lang }));
  await pl.page.reload();
  await pl.page.waitForFunction(() => window.game && window.game.state !== undefined);
  const kept = await pl.page.evaluate(() => I18N.lang);
  r.push(report('language: Profil → Polski switches the package to Polish and survives a reload', chosen.lang === 'pl' && chosen.saved === 'pl' && kept === 'pl', JSON.stringify({ ...chosen, kept })));
  await pl.browser.close();
  const v = await veteran(url, { runsPlayed: 10 }, { locale: 'en-US', query: '?i18n=log' });
  const seen = await v.page.evaluate(async () => {
    const gm = window.game, wait = () => new Promise(res => setTimeout(res, 230)), out = {};
    gm.openCampaignScreen(); await wait();
    gm.openMissionBriefing('M05'); await wait();
    gm.openWarsztatScreen(); await wait();
    gm.openChallengesScreen(); await wait();
    gm.openProfileScreen(); await wait();
    gm.openPrivacyPolicy(); await wait();
    out.policy = document.getElementById('infoSheetBody').innerText;
    gm.closeInfoSheet(); gm.showScreen('mainMenu'); await wait();
    window.__qaPlayArena({ style: 'greedy' }); gm.showScreen('gameOverScreen'); await wait();
    out.misses = [...I18N.misses];
    out.consentRow = !!document.querySelector('[data-consent]') && document.querySelector('[data-consent]').offsetParent !== null;
    return out;
  });
  r.push(report('English: no untranslated Polish on the hub screens, briefing, policy, result', seen.misses.length === 0, seen.misses.slice(0, 6).join(' | ')));
  r.push(report('English: the Basic privacy text says no ads, no statistics, no server; no mention of consent to statistics', /shows no ads/.test(seen.policy) && /collects no statistics/.test(seen.policy) && !/withdraw consent/.test(seen.policy), seen.policy.slice(0, 500)));
  await v.browser.close();
  return r;
}

/** CRAZYGAMES-PREFLIGHT-2: the language decision's edges, and the strings ?i18n=log cannot see
 *  (no Polish hint word, or drawn only in a canvas frame the bots do not render). */
async function englishEdgeChecks(url, webUrl) {
  const r = [];
  const noInfo = await openGame(url, { locale: 'de-DE', viewport: { width: 1216, height: 684 }, mobile: false, deviceScaleFactor: 1, initScript: "Object.defineProperty(navigator, 'languages', { get: () => [] }); Object.defineProperty(navigator, 'language', { get: () => '' });" });
  r.push(report('language: a browser giving no language at all gets English', await noInfo.page.evaluate(() => I18N.lang) === 'en'));
  await noInfo.browser.close();
  const throws = await openGame(url, { locale: 'de-DE', viewport: { width: 1216, height: 684 }, mobile: false, deviceScaleFactor: 1, initScript: "Object.defineProperty(navigator, 'languages', { get() { throw new Error('blocked'); } });" });
  r.push(report('language: a browser refusing the language API gets English', await throws.page.evaluate(() => I18N.lang) === 'en'));
  await throws.browser.close();

  // The static page is Polish until game.js has run.
  const staticPage = async (base, locale) => {
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1216, height: 684 }, deviceScaleFactor: 1, locale });
    const page = await context.newPage();
    let release;
    const held = new Promise(res => { release = res; });
    await page.route('**/game.js*', async (route) => { await held; await route.continue(); });
    await page.goto(base, { waitUntil: 'commit' });
    await page.waitForSelector('#btnStart', { state: 'attached' });
    await page.waitForTimeout(500);
    const during = await page.evaluate(() => ({ shown: getComputedStyle(document.getElementById('btnStart')).visibility !== 'hidden', text: document.getElementById('btnStart').innerText, lang: document.documentElement.lang }));
    release();
    await page.waitForFunction(() => window.game && window.game.state !== undefined, null, { timeout: 15000 });
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => ({ shown: getComputedStyle(document.getElementById('app')).visibility !== 'hidden', lang: document.documentElement.lang }));
    await browser.close();
    return { during, after };
  };
  const en = await staticPage(url, 'en-US');
  r.push(report('English: no Polish menu is painted while game.js is still on its way, and the menu appears once it has run', !en.during.shown && en.after.shown && en.after.lang === 'en', JSON.stringify(en)));
  const pl = await staticPage(url, 'pl-PL');
  r.push(report('Polish browser, English SDK locale: the static page says lang="en", nothing is painted until game.js has run, then English', pl.during.lang === 'en' && !pl.during.shown && pl.after.shown && pl.after.lang === 'en', JSON.stringify(pl)));
  const web = await staticPage(webUrl, 'pl-PL');
  r.push(report('web build: the static page paints as before (no marker, nothing hidden) and a Polish browser still gets Polish', web.during.shown && web.after.shown && web.during.lang === 'pl' && web.after.lang === 'pl', JSON.stringify(web)));

  // Every entry through the real translation layer, with real values.
  const g = await veteran(url, { runsPlayed: 10, missions: 12 }, { locale: 'en-US' });
  const table = [
    ['NOWY ROZMIAR!', 'NEW SIZE!'], ['CEL ZALICZONY', 'GOAL COMPLETE'], ['Teraz: Zbierz 3 zasilacze', 'Next: Collect 3 power cells'],
    ['SKRZYNIA OTWARTA!', 'CHEST OPENED!'], ['Darmowa skrzynia', 'Free chest'], ['ZAGRAJ PONOWNIE', 'PLAY AGAIN'],
    ['PODIUM · 2. MIEJSCE', 'PODIUM · #2'], ['PODIUM · 3. MIEJSCE', 'PODIUM · #3'], ['RYWAL', 'RIVAL'], ['RYWAL ZJEDZONY! +250', 'RIVAL EATEN! +250'],
    ['Zbieraj gwiazdki: ★ 512', 'Collect stars: ★ 512'], ['Wydawca gry GLITCH GULP · kontakt: a@b.example.', 'GLITCH GULP publisher · contact: a@b.example.'],
    ['Silnik: wstrzymany · 48 kHz', 'Engine: paused · 48 kHz'], ['Silnik: przerwany przez system · 48 kHz', 'Engine: interrupted by the system · 48 kHz'],
    ['Silnik: działa · 48 kHz · tryb iOS: otoczenie', 'Engine: running · 48 kHz · iOS mode: ambient'], ['Silnik: działa · 48 kHz · tryb iOS: odtwarzanie', 'Engine: running · 48 kHz · iOS mode: playback'],
    ['JUTRO', 'TOMORROW'], ['POBITE ✓', 'BEATEN ✓'], ['Cel 1 200 pkt (Ola) przebity!', 'Target 1 200 pts (Ola) beaten!'], ['NAJLEPSZA OFERTA', 'BEST OFFER'], ['KUPIONO ✓', 'OWNED ✓'], ['ZAKUP UDANY', 'PURCHASE COMPLETE'],
    ['PODWOJONO ✓', 'DOUBLED ✓'], ['ODEBRANO ×2 ✓', 'CLAIMED ×2 ✓'], ['LINK SKOPIOWANY ✓', 'LINK COPIED ✓'], ['KARTA ZAPISANA ✓', 'CARD SAVED ✓'], ['PRZERWA REKLAMOWA · DEMO', 'AD BREAK · DEMO'], ['2. miejsce · T4 · Runda 2:00', '#2 · T4 · Round 2:00']
  ];
  const seen = await g.page.evaluate(async (rows) => {
    const box = document.createElement('div'); box.hidden = true; document.body.appendChild(box);
    const spans = rows.map(([pl]) => { const el = document.createElement('span'); el.textContent = pl; box.appendChild(el); return el; });
    await new Promise(res => setTimeout(res, 200));
    const out = spans.map(el => el.textContent); box.remove(); return out;
  }, table);
  const wrong = table.filter(([, want], i) => seen[i] !== want).map(([pl, want], i) => pl + ' -> ' + seen[table.findIndex(t => t[0] === pl)] + ' (want ' + want + ')');
  r.push(report('English: the strings the ?i18n=log net cannot see are translated', wrong.length === 0, wrong.slice(0, 6).join(' | ')));
  await g.browser.close();

  // The same strings where a player meets them.
  const live = await veteran(url, { runsPlayed: 10, missions: 12 }, { locale: 'en-US', initScript: "window.__drawn = new Set(); for (const fn of ['fillText']) { const C = CanvasRenderingContext2D.prototype, o = C[fn]; C[fn] = function (t, ...a) { if (typeof t === 'string') window.__drawn.add(t); return o.call(this, t, ...a); }; }" });
  await live.page.addScriptTag({ content: ARENA_BOT });
  const flows = await live.page.evaluate(async () => {
    const gm = window.game, wait = (ms) => new Promise(res => setTimeout(res, ms)), out = {};
    gm.showScreen('mainMenu');
    gm.save.freeChest.nextAt = Date.now() + 3600e3; gm.openFreeChest(); await wait(230);
    out.chestWait = document.getElementById('infoSheetTitle') && document.getElementById('infoSheetTitle').innerText;
    gm.closeInfoSheet();
    window.__qaPlayArena({ style: 'greedy' }); try { gm.endRound(); } catch (e) { /* the bot ended it */ } await wait(50);
    out.place = document.getElementById('finalPlace').textContent;
    gm.startCampaignMission('M33'); gm.beginMissionPlay(); await wait(120);
    gm.showBanner('X', 'NOWY ROZMIAR!', '#46D99A', 1.3, 9); await wait(350);
    out.drawn = [...window.__drawn].filter(t => /ROZMIAR|NEW SIZE/.test(t));
    gm.running = false; gm.showScreen('mainMenu');
    return out;
  });
  r.push(report('English: the place on the result reads #N, not the Polish ordinal', /^#\d$/.test(flows.place || ''), flows.place));
  r.push(report('English: the sheet of a chest that is not ready yet', flows.chestWait === 'Free chest', flows.chestWait));
  r.push(report('English: a mission tier-up banner reaches the canvas in English', flows.drawn.includes('NEW SIZE!') && !flows.drawn.some(t => /ROZMIAR/.test(t)), JSON.stringify(flows.drawn)));
  await live.browser.close();

  // The starting bonus is named in the chosen language (R3-06: the sheet states every value with
  // the bonus already in, so no "×1.6" / "×1,6" is left for the player to apply).
  // (In the package Polish comes only from a saved choice, whatever the browser.)
  for (const [lang, want] of [['en', /Starting bonus: \+60% city progress on LVL 1–2/], ['pl', /Premia startowa: \+60% postępu miasta na LVL 1–2/]]) {
    const c = await veteran(url, { runsPlayed: 0 }, { locale: 'pl-PL' });
    await c.page.evaluate((l) => { const s = JSON.parse(localStorage.getItem('vectorHoleSave_v1')); s.settings.lang = l; localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)); }, lang);
    await c.page.reload();
    await c.page.waitForFunction(() => window.game && window.game.state !== undefined);
    const text = await c.page.evaluate(async () => { window.game.openCoreCityRoadmap(); await new Promise(res => setTimeout(res, 230)); return document.getElementById('infoSheetBody').innerText; });
    r.push(report('language: the Core City starting bonus is named in the chosen language, no multiplier left to apply (R3-06), ' + lang, want.test(text) && !/×\d[.,]\d/.test(text), (text.match(/(Starting bonus|Premia startowa)[^.(]*|×\d[.,]\d/) || [''])[0]));
    await c.browser.close();
  }
  return r;
}

/** Physics by refresh rate: the same input, simulated seconds, at each frame time.
 *  Emulated frame times, not a physical monitor. */
async function refreshRateChecks(url) {
  const r = [];
  const g = await veteran(url, { runsPlayed: 10 }, { initScript: QA_RANDOM });
  const rates = await g.page.evaluate(() => {
    const gm = window.game, realNow = performance.now.bind(performance), out = {};
    for (const hz of [60, 120, 144, 165]) {
      let vnow = 1e7;
      performance.now = () => vnow;
      window.__qaSeedRandom(99);
      gm.startRound({ seed: 777 });
      cancelAnimationFrame(gm.rafId);
      gm.running = false;
      if (gm.evolutionPending) gm.skipEvolutionOffer();
      gm.checkEvolutionTriggers = () => {};
      const p = gm.player, dt = 1 / hz, x0 = p.x, y0 = p.y, r0 = p.radius;
      let t = 0, frames = 0, eaten0 = gm.objects.length;
      gm.keyDir = { x: 1, y: 0 };
      const clock0 = gm.timeRemaining !== undefined ? gm.timeRemaining : null;
      while (t < 2.5) { vnow += dt * 1000; gm.update(dt); t += dt; frames++; }
      gm.keyDir = { x: 0, y: 0 };
      out[hz] = { frames, dist: Math.hypot(p.x - x0, p.y - y0), radius: p.radius, grown: p.radius - r0, score: p.score, clock: clock0 == null ? null : clock0 - gm.timeRemaining, bot: gm.bots.map(b => +Math.hypot(b.vx || 0, b.vy || 0).toFixed(1)).slice(0, 1), left: eaten0 - gm.objects.length };
      delete gm.checkEvolutionTriggers;
      gm.stopRun();
    }
    performance.now = realNow;
    return out;
  });
  const base = rates[60];
  const spread = (k) => Math.max(...[120, 144, 165].map(hz => Math.abs(rates[hz][k] - base[k]) / Math.max(1, Math.abs(base[k]))));
  r.push(report('refresh rate: distance covered in 2.5 s within 3 % at 60/120/144/165 Hz (emulated frame times)', spread('dist') <= 0.03, JSON.stringify(Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, +v.dist.toFixed(1)])))));
  r.push(report('refresh rate: round clock runs at the same speed', base.clock == null || spread('clock') <= 0.01, JSON.stringify(Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, v.clock])))));
  r.push(report('refresh rate: growth from the same path within 10 %', spread('grown') <= 0.10, JSON.stringify(Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, +v.grown.toFixed(2)])))));
  fs.writeFileSync(path.join(WORK, 'refresh-rates.json'), JSON.stringify(rates, null, 2));
  await g.browser.close();
  return r;
}

/** The web build keeps every behaviour the package drops. */
async function webChecks(webUrl) {
  const r = [];
  const g = await veteran(webUrl, { runsPlayed: 10 }, { query: '' });
  await g.page.evaluate(() => { CONFIG.ads.demoSeconds = 0.2; });
  const out = await g.page.evaluate(async () => {
    const gm = window.game, vis = (id) => { const e = document.getElementById(id); return !!e && e.offsetParent !== null; }, out = { provider: gm.monetization.provider, ads: gm.monetization.adsAvailable };
    window.__qaPlayArena({ style: 'greedy' });
    gm.showScreen('gameOverScreen');
    out.ad = vis('btnWatchAd'); out.share = vis('btnShare');
    const before = gm.save.coins, pending = gm.adPendingCoins;
    await gm.watchRewardedAd();
    out.doubled = gm.save.coins - before === pending && pending > 0;
    gm.openWarsztatScreen();
    out.free = vis('btnFreePrisms');
    gm.openProfileScreen();
    out.consent = !!document.querySelector('[data-consent]') && document.querySelector('[data-consent]').offsetParent !== null;
    return out;
  });
  r.push(report('GitHub Pages build: demo provider, ×2 MONET pays, WYZWIJ ZNAJOMEGO, free prisms and consent all as before', out.provider === 'demo' && out.ads && out.ad && out.share && out.doubled && out.free && out.consent, JSON.stringify(out)));
  await g.browser.close();
  const none = await openGame(webUrl, { query: '?portal=crazygames', viewport: { width: 1216, height: 684 }, mobile: false, deviceScaleFactor: 1 });
  await none.page.waitForFunction(() => window.game.monetization.provider === 'none', null, { timeout: 10000 });
  const n = await none.page.evaluate(async () => ({ left: window.game.monetization.placementLeft('free_prisms'), ok: await window.game.monetization.rewarded('free_prisms') }));
  r.push(report('web build, a portal SDK that fails to load: the game runs, no offer, no reward, no wait', n.left === 0 && n.ok === false, JSON.stringify(n)));
  await none.browser.close();
  return r;
}

function pngSize(file) { const b = fs.readFileSync(file); return b.toString('ascii', 1, 4) === 'PNG' ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null; }

/** Covers and videos in a delivery folder: real files with the documented shape. */
function mediaChecks(delivery) {
  const r = [];
  if (!delivery) return [{ name: 'media: covers and videos NOT RUN (no --delivery folder given)', ok: true, notRun: true }];
  const sizes = { 'landscape-1920x1080.png': [1920, 1080], 'portrait-800x1200.png': [800, 1200], 'square-800x800.png': [800, 800] };
  for (const [f, [w, h]] of Object.entries(sizes)) {
    const p = path.join(delivery, 'covers', f), s = fs.existsSync(p) ? pngSize(p) : null;
    r.push(report(`media: cover ${f} exists with the documented size`, !!s && s.w === w && s.h === h, JSON.stringify(s)));
  }
  const ff = process.env.VH_FFMPEG;
  for (const [f, w, h] of [['preview-landscape-1920x1080.mp4', 1920, 1080], ['preview-portrait-1080x1620.mp4', 1080, 1620]]) {
    const p = path.join(delivery, 'videos', f), exists = fs.existsSync(p), size = exists ? fs.statSync(p).size : 0;
    r.push(report(`media: video ${f} exists and is under 50 MB`, exists && size > 1e5 && size <= 50 * 1048576, `${(size / 1048576).toFixed(1)} MB`));
    if (!ff) { r.push({ name: `media: video ${f} details NOT RUN (VH_FFMPEG not set)`, ok: true, notRun: true }); continue; }
    if (!exists) continue;
    let info = '';
    try { execFileSync(ff, ['-hide_banner', '-i', p], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { info = String(e.stderr || ''); }
    const dur = /Duration: (\d+):(\d+):([\d.]+)/.exec(info);
    const secs = dur ? +dur[1] * 3600 + +dur[2] * 60 + +dur[3] : 0;
    r.push(report(`media: video ${f}: ${w}x${h}, 15-20 s, no audio track`, info.includes(`${w}x${h}`) && secs >= 15 && secs <= 20 && !/Audio:/.test(info), `${secs} s, ${(/Video: [^\n]*/.exec(info) || [''])[0].slice(0, 110)}`));
    const raw = (input, at) => execFileSync(ff, ['-hide_banner', '-loglevel', 'error', ...(at != null ? ['-ss', String(at)] : []), '-i', input, '-frames:v', '1', '-vf', 'scale=64:64', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], { maxBuffer: 1 << 20 });
    const cover = w > h ? 'landscape-1920x1080.png' : 'video-first-frame-portrait-1080x1620.png';
    const coverFile = fs.existsSync(path.join(delivery, 'covers', cover)) ? path.join(delivery, 'covers', cover) : path.join(delivery, 'covers', 'portrait-800x1200.png');
    const first = raw(p, 0.05), ref = raw(coverFile);
    let d0 = 0; for (let i = 0; i < first.length; i++) d0 += Math.abs(first[i] - ref[i]);
    r.push(report(`media: video ${f}: the first frame is the static cover`, d0 / first.length < 6, `mean difference ${(d0 / first.length).toFixed(2)} of 255`));
    const bars = [];
    for (const at of [0.05, secs * 0.25, secs * 0.5, secs * 0.75, secs - 0.2]) {
      const fr = raw(p, at), row = (y) => { let m = 0; for (let x = 0; x < 64; x++) m = Math.max(m, fr[y * 64 + x]); return m; };
      if (row(0) < 12 || row(63) < 12) bars.push(at.toFixed(1));
      for (let x = 0; x < 2; x++) { let m = 0; for (let y = 0; y < 64; y++) m = Math.max(m, fr[y * 64 + (x ? 63 : 0)]); if (m < 12) bars.push('side ' + at.toFixed(1)); }
    }
    r.push(report(`media: video ${f}: no black bars on any sampled frame`, bars.length === 0, bars.join(', ')));
  }
  const m = path.join(delivery, 'manifest.sha256');
  if (fs.existsSync(m)) {
    const lines = fs.readFileSync(m, 'utf8').trim().split('\n');
    const wrong = lines.filter(l => { const [hash, ...rest] = l.trim().split(/\s+/), file = path.join(delivery, rest.join(' ').replace(/^\*/, '')); return !fs.existsSync(file) || sha256(fs.readFileSync(file)) !== hash; });
    r.push(report(`media: manifest.sha256 matches all ${lines.length} files`, wrong.length === 0 && lines.length > 5, wrong.slice(0, 3).join(' | ')));
  } else r.push(report('media: manifest.sha256 exists', false));
  return r;
}

export async function runCrazyGamesBasic1Checks({ delivery = null, shots = false } = {}) {
  fs.mkdirSync(WORK, { recursive: true });
  const pkg = exportPackage({ out: path.join(WORK, 'export') });
  const all = [...structureChecks(pkg)];
  const site = await serve({ root: pkg.gameDir });
  const web = await serve();
  PKG_BASE = new URL(site.url).origin + '/';
  try {
    for (const step of [
      () => hostSdkChecks(pkg.gameDir, site.url), () => adChecks(site.url), () => rewardParity(site.url, web.url), () => deadButtonChecks(site.url),
      () => frameChecks(pkg.gameDir, shots), () => inputChecks(pkg.gameDir), () => saveChecks(pkg.gameDir, site.url), () => campaignFrameChecks(pkg.gameDir), () => pointerLockChecks(pkg.gameDir, site.url, web.url), () => portalFlowChecks(pkg.gameDir, site.url), () => holeChecks(site.url, web.url), () => isolationChecks(pkg.gameDir, site.url, web.url), () => languageChecks(site.url), () => installedBrowserChecks(site.url),
      () => englishEdgeChecks(site.url, web.url), () => refreshRateChecks(site.url), () => webChecks(web.url)
    ]) {
      try { all.push(...await step()); } catch (e) { all.push(report(`crazygames-basic1: step crashed (${step.toString().slice(6, 40)})`, false, String(e && e.stack || e))); }
    }
    all.push(...mediaChecks(delivery));
  } finally { site.server.close(); web.server.close(); }
  return all;
}

if (isMain(import.meta.url)) {
  const a = process.argv.find(x => x.startsWith('--delivery='));
  const res = await runCrazyGamesBasic1Checks({ delivery: a ? path.resolve(a.slice(11)) : null, shots: process.argv.includes('--shots') });
  const failed = res.filter(r => !r.ok);
  res.filter(r => r.notRun).forEach(r => console.log('NOT RUN', r.name));
  console.log(`\n${res.filter(r => r.ok && !r.notRun).length}/${res.filter(r => !r.notRun).length} PASS, NOT RUN ${res.filter(r => r.notRun).length}`);
  failed.forEach(f => console.log('  FAIL', f.name, String(f.details || '').slice(0, 400)));
  process.exit(failed.length ? 1 : 0);
}
