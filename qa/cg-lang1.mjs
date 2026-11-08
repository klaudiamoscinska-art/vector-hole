// C1: the CrazyGames package picks its language from SDK.user.systemInfo.locale, on the real
// package (tools/export-crazygames-basic.mjs) with qa/cg-sdk-mock.js, and the web build.
//   node qa/cg-lang1.mjs [--root=DIR]
//   --root: the game to test (e.g. a base checkout).
// pl / pl-PL -> Polish; anything else, no locale, a failed or missing SDK -> English. The browser's
// own language no longer decides here (the matrix sets it to the opposite of the SDK's). A
// manual choice wins and survives a refresh; the automatic one is never saved. The loader has
// no words and the language is set once, before #app shows. Mock results are not Preview results.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, serve, installQaBridge, report, OUT, ROOT, isMain, CG_SDK_URL, CG_SDK_MOCK, QA_RANDOM } from './lib.mjs';
import { exportPackage } from '../tools/export-crazygames-basic.mjs';

let browser = null;
const settle = (ms = 250) => new Promise(r => setTimeout(r, ms));

// Per load: the first frames (loader text, #app shown too early) and every change of <html lang>.
const WATCH = `(() => {
  const w = window.__langWatch = { langs: [], loaderTexts: new Set(), appBeforeReady: false, readyAt: null };
  const seen = () => { const l = document.documentElement.lang; if (w.langs[w.langs.length - 1] !== l) w.langs.push(l); };
  const tick = () => {
    seen();
    const b = document.getElementById('cgBoot'), app = document.getElementById('app');
    const ready = document.documentElement.classList.contains('i18n-ready');
    if (b && !ready) w.loaderTexts.add(b.textContent.replace(/\\s+/g, ' ').trim());
    if (app && !ready && getComputedStyle(app).visibility !== 'hidden') w.appBeforeReady = true;
    if (ready) { if (w.readyAt === null) w.readyAt = performance.now(); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  new MutationObserver(seen).observe(document, { subtree: true, attributes: true, attributeFilter: ['lang'] });
})();`;

async function context({ mock = { mode: 'sdk' }, viewport = { width: 1280, height: 720 }, locale = 'en-US', blockSdk = false } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale });
  await installQaBridge(ctx);
  await ctx.addInitScript(`window.__cgMock = ${JSON.stringify(mock)};`);
  await ctx.addInitScript(QA_RANDOM);
  await ctx.addInitScript(WATCH);
  const errors = [];
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await ctx.route(CG_SDK_URL, (r) => blockSdk ? r.abort() : r.fulfill({ contentType: 'text/javascript', body: CG_SDK_MOCK }));
  const ready = (p) => p.waitForFunction(() => window.game && window.game.state !== undefined && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 40000 });
  const open = async (url) => {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.goto(url);
    await ready(page);
    await settle(400);
    return page;
  };
  return { ctx, open, ready, errors, close: () => ctx.close() };
}

const state = (p) => p.evaluate(() => {
  const g = window.game, w = window.__langWatch;
  return {
    lang: I18N.lang, html: document.documentElement.lang, saved: g.save.settings.lang,
    stored: (() => { try { const raw = window.CrazyGames.SDK.data.getItem('vectorHoleSave_v1'); return raw ? JSON.parse(raw).settings.lang : null; } catch (e) { return 'unreadable'; } })(),
    langs: w.langs, loaderTexts: [...w.loaderTexts], appBeforeReady: w.appBeforeReady, readyAt: Math.round(w.readyAt || 0)
  };
});

async function matrixChecks(pkgUrl) {
  const r = [];
  const AUTO = [
    ['pl', 'pl', 'en-US'], ['pl-PL', 'pl', 'en-US'], ['PL-pl', 'pl', 'en-US'],
    ['en-US', 'en', 'pl-PL'], ['en', 'en', 'pl-PL'], ['de-DE', 'en', 'pl-PL'], ['uk-UA', 'en', 'pl-PL'], ['plt-MG', 'en', 'pl-PL'],
    [null, 'en', 'pl-PL'], ['', 'en', 'pl-PL'],
  ];
  for (const [locale, want, browserLocale] of AUTO) {
    const c = await context({ mock: { mode: 'sdk', locale }, locale: browserLocale });
    const p = await c.open(pkgUrl);
    const s = await state(p);
    r.push(report(`[package] SDK locale ${JSON.stringify(locale)} (browser ${browserLocale}) -> ${want}, the save stays "auto"`, s.lang === want && s.html === want && s.saved === 'auto' && (s.stored === 'auto' || s.stored === null), JSON.stringify(s)));
    r.push(report(`[package] SDK locale ${JSON.stringify(locale)}: no page errors`, !c.errors.length, c.errors.slice(0, 3).join(' ')));
    await c.close();
  }
  const FAILS = [
    ['init fails', { mode: 'sdk', locale: 'pl-PL', initFails: true }, {}],
    ['environment disabled', { mode: 'sdk', locale: 'pl-PL', environment: 'disabled' }, {}],
    ['reading systemInfo throws', { mode: 'sdk', localeThrows: true }, {}],
    ['SDK script blocked', { mode: 'sdk' }, { blockSdk: true }],
  ];
  for (const [name, mock, opt] of FAILS) {
    const c = await context({ mock, locale: 'pl-PL', ...opt });
    const p = await c.open(pkgUrl);
    const s = await state(p);
    r.push(report(`[package] ${name} in a Polish browser -> English, and the game starts`, s.lang === 'en' && s.html === 'en', JSON.stringify(s)));
    await c.close();
  }
  {
    // The Data Module off does not take the locale away: the SDK itself is up.
    const c = await context({ mock: { mode: 'sdk', locale: 'pl-PL', dataDisabled: true } });
    const p = await c.open(pkgUrl);
    const s = await state(p);
    r.push(report('[package] Data Module off, SDK up with pl-PL -> Polish', s.lang === 'pl', JSON.stringify(s)));
    await c.close();
  }
  return r;
}

async function manualChecks(pkgUrl) {
  const r = [];
  const pick = async (p, c, lang) => {
    await p.evaluate((l) => window.game.setLanguage(l), lang).catch(() => {});
    await settle(500);
    await c.ready(p);
    await settle(400);
    return state(p);
  };
  for (const [locale, auto, manual] of [['pl-PL', 'pl', 'en'], ['en-US', 'en', 'pl']]) {
    const c = await context({ mock: { mode: 'sdk', locale }, locale: 'de-DE' });
    const p = await c.open(pkgUrl);
    const first = await state(p);
    const after = await pick(p, c, manual);
    await p.reload(); await c.ready(p); await settle(400);
    const reload1 = await state(p);
    await p.reload(); await c.ready(p); await settle(400);
    const reload2 = await state(p);
    r.push(report(`[package] SDK ${locale}: starts ${auto}, a manual ${manual} is applied, saved, and survives two refreshes`, first.lang === auto && first.saved === 'auto' && after.lang === manual && after.stored === manual && reload1.lang === manual && reload2.lang === manual && reload2.stored === manual, JSON.stringify({ first: first.lang, after: after.lang, stored: after.stored, reload1: reload1.lang, reload2: reload2.lang })));
    r.push(report(`[package] SDK ${locale}: no page errors`, !c.errors.length, c.errors.slice(0, 3).join(' ')));
    await c.close();
  }
  return r;
}

async function dailyChecks(pkgUrl) {
  const r = [];
  // The automatic language (save 'auto'), then the player's PL <-> EN: R5-04 still holds.
  const c = await context({ mock: { mode: 'sdk', locale: 'pl-PL' } });
  const p = await c.open(pkgUrl);
  await p.evaluate(() => {
    const g = window.game, s = defaultSave();
    s.stats.runsPlayed = 3; s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
    s.unlocks.announced = Array.from(new Set([...unlockedFeatureIds(s), 'warsztat', 'wyzwania', 'kampania']));
    s.coins = 100; s.prisms = 5; s.meta.savedAt = Date.now() - 60000;
    s.login = { lastClaimDate: new Date(Date.parse(g.loginState().today) - 86400000).toISOString().slice(0, 10), day: 1, totalClaims: 1 };
    localStorage.setItem('SDK_DATA_qa-mock', JSON.stringify({ data: { vectorHoleSave_v1: sealSave(s) }, metadata: { date: new Date() } }));
  });
  await settle(50);
  const look = () => p.evaluate(() => ({ open: !document.getElementById('loginRewardScreen').classList.contains('hidden'), coins: window.game.save.coins, claimed: window.game.loginState().claimedToday, total: window.game.save.login.totalClaims, lang: I18N.lang }));
  await p.reload(); await c.ready(p); await settle(1100);
  const before = await look();
  await p.evaluate(() => { document.getElementById('btnLoginClaim').click(); });
  await settle(200);
  const claimed = await look();
  await p.evaluate(() => { window.game.closeLoginReward(); });
  const flips = [];
  for (const l of ['en', 'pl', 'en']) {
    await p.evaluate((x) => window.game.setLanguage(x), l).catch(() => {});
    await settle(500); await c.ready(p); await settle(1100);
    flips.push(await look());
  }
  r.push(report('[package, SDK pl-PL] the Daily Reward opens in Polish and pays once', before.open && before.lang === 'pl' && claimed.claimed && claimed.total === 2, JSON.stringify({ before, claimed })));
  r.push(report('[package, SDK pl-PL] after a claim, PL <-> EN: the calendar never comes back, the coins stay, each switch lands in its language', flips.every((f, i) => !f.open && f.coins === claimed.coins && f.total === 2 && f.lang === ['en', 'pl', 'en'][i]), JSON.stringify(flips)));
  r.push(report('[package, SDK pl-PL] Daily Reward run: no page errors', !c.errors.length, c.errors.slice(0, 3).join(' ')));
  await c.close();
  return r;
}

async function bootChecks(pkgUrl) {
  const r = [];
  for (const [locale, want] of [['pl-PL', 'pl'], ['en-US', 'en']]) {
    const c = await context({ mock: { mode: 'sdk', locale, initDelayMs: 4000 }, locale: want === 'pl' ? 'en-US' : 'pl-PL' });
    const p = await c.open(pkgUrl);
    const s = await state(p);
    const texts = s.loaderTexts;
    r.push(report(`[package] ${locale}, slow SDK (4 s): #app never shows before the language is set`, !s.appBeforeReady, JSON.stringify(s)));
    r.push(report(`[package] ${locale}, slow SDK: the loader has no words of either language`, texts.length > 0 && texts.every(t => /^GLITCH GULP\s*(CrazyGames…)?$/.test(t)), JSON.stringify(texts)));
    r.push(report(`[package] ${locale}, slow SDK: <html lang> goes from the static value straight to ${want}, once`, s.langs.length <= 2 && s.langs[s.langs.length - 1] === want, JSON.stringify(s.langs)));
    r.push(report(`[package] ${locale}, slow SDK: the game is ready right after the SDK (no second wait)`, s.readyAt >= 4000 && s.readyAt < 6000, 'readyAt ' + s.readyAt));
    await c.close();
  }
  return r;
}

async function frameChecks(pkgUrl) {
  const r = [];
  for (const [w, h, name] of [[1060, 596, 'CrazyGames desktop'], [800, 450, 'CrazyGames mobile'], [640, 360, 'small landscape'], [1920, 1080, 'PC']]) {
    for (const [locale, want] of [['pl-PL', 'pl'], ['en-US', 'en']]) {
      const c = await context({ mock: { mode: 'sdk', locale }, viewport: { width: w, height: h } });
      const p = await c.open(pkgUrl);
      const s = await p.evaluate(() => {
        const b = document.getElementById('btnStart').getBoundingClientRect();
        const se = document.scrollingElement;
        return { lang: I18N.lang, label: document.getElementById('btnStart').innerText.trim(), inFrame: b.top >= 0 && b.left >= 0 && b.bottom <= innerHeight && b.right <= innerWidth, sw: se.scrollWidth, cw: se.clientWidth, sh: se.scrollHeight, ch: se.clientHeight };
      });
      const label = want === 'pl' ? /GRAJ/ : /PLAY/;
      r.push(report(`[package] ${name} ${w}x${h} ${want}: PLAY in frame with its text in ${want}, the page does not scroll`, s.lang === want && label.test(s.label) && s.inFrame && s.sw <= s.cw && s.sh <= s.ch, JSON.stringify(s)));
      await c.close();
    }
  }
  return r;
}

async function webChecks(pkgUrl, webUrl) {
  const r = [];
  for (const [locale, want] of [['pl-PL', 'pl'], ['de-DE', 'en']]) {
    const c = await context({ mock: { mode: 'sdk', locale: want === 'pl' ? 'en-US' : 'pl-PL' }, locale });
    const p = await c.open(webUrl);
    const s = await p.evaluate(() => I18N.lang);
    r.push(report(`[web] ${locale} browser -> ${want} (the browser decides, no SDK)`, s === want, s));
    await c.close();
  }
  return r;
}

export async function runCgLang1Checks({ root = ROOT } = {}) {
  const WORK = path.join(OUT, 'cg-lang1', root === ROOT ? 'this' : 'root-' + path.basename(root));
  fs.mkdirSync(WORK, { recursive: true });
  const pkg = exportPackage({ root, out: path.join(WORK, 'export') });
  const site = await serve({ root: pkg.gameDir });
  const web = await serve({ root });
  browser = await chromium.launch();
  const all = [];
  try {
    for (const step of [matrixChecks, manualChecks, dailyChecks, bootChecks, frameChecks, webChecks]) {
      try { all.push(...await step(site.url, web.url)); } catch (e) { all.push(report(`cg-lang1: ${step.name} crashed`, false, String(e && e.stack || e).slice(0, 600))); }
    }
  } finally { await browser.close(); site.server.close(); web.server.close(); }
  return all;
}

if (isMain(import.meta.url)) {
  const a = process.argv.find(x => x.startsWith('--root='));
  const res = await runCgLang1Checks(a ? { root: path.resolve(a.slice(7)) } : {});
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} PASS`);
  failed.forEach(f => console.log('  FAIL', f.name, String(f.details || '').slice(0, 700)));
  process.exit(failed.length ? 1 : 0);
}
