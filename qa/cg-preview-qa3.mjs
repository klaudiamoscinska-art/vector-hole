// CG-PREVIEW-QA-1 R3: the third round of CrazyGames Preview reports (R3-01..04, 06..08) on the
// real package (tools/export-crazygames-basic.mjs) with qa/cg-sdk-mock.js, and the web build.
//   node qa/cg-preview-qa3.mjs [--root=DIR] [--legacy-root=DIR] [--only=step,...]
//   --root: the game to test (e.g. a base checkout); --legacy-root: a pre-R3 checkout whose package
//   writes a real old save for R3-07 (skipped without it).
// Mock results are not CrazyGames Preview results: the portal's own event ticks, a real
// account on a second device and a real phone stay NOT VERIFIED.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, serve, installQaBridge, report, ARENA_BOT, CAMPAIGN_BOT, OUT, ROOT, isMain, CG_SDK_URL, CG_SDK_MOCK } from './lib.mjs';
import { exportPackage } from '../tools/export-crazygames-basic.mjs';

let WORK = path.join(OUT, 'cg-preview-qa3'); // + a folder per tested checkout (--root)
const CLOUD = new Map(); // the mock's CrazyGames accounts: userId -> JSON
const settle = (ms = 250) => new Promise(r => setTimeout(r, ms));
const PC = { viewport: { width: 1216, height: 684 }, deviceScaleFactor: 1 };
const PHONE = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
let browser = null;

const HELPERS = `(() => {
  window.__vis = (id) => { const e = typeof id === 'string' ? document.getElementById(id) : id; return !!e && e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden'; };
  window.__arena = (opts) => {
    const w = document.getElementById('btnWelcomePlay');
    if (w && w.offsetParent !== null) w.click();
    return window.__qaPlayArena(Object.assign({ style: 'greedy' }, opts || {}));
  };
  window.__today = () => new Date().toISOString().slice(0, 10);
  // A finished Daily run with a chosen score (the round's own end, endRound()).
  window.__daily = (score) => {
    const g = window.game, charge0 = g.save.hub.coreCharge || 0, level0 = g.save.hub.coreLevel || 1;
    g.startRound({ seed: 4242, daily: true });
    if (g.rafId) cancelAnimationFrame(g.rafId);
    g.player.score = score;
    g.timeRemaining = 0;
    g.endRound();
    const lc = g.lastCoreGain;
    return { gain: lc.total, early: lc.early, parts: lc.parts.map(x => x[0]), claimed: !!lc.dailyClaimed,
      added: ((g.save.hub.coreLevel || 1) - level0) * 100 + (g.save.hub.coreCharge || 0) - charge0,
      level: g.save.hub.coreLevel, best: g.save.daily.lastSeedScore, daily: Object.assign({}, g.save.daily),
      line: document.getElementById('resultCoreParts').innerText };
  };
  window.__ev = () => (window.__cgMockGame || []).map(e => e[0]).filter(n => /^gameplay/.test(n));
})();`;

async function context({ locale = 'en-US', mock = { mode: 'sdk' }, device = PC, init = null } = {}) {
  const ctx = await browser.newContext({ ...device, locale });
  await installQaBridge(ctx);
  await ctx.exposeFunction('__cgCloud', (op, id, json) => { if (op === 'load') return CLOUD.has(id) ? CLOUD.get(id) : null; CLOUD.set(id, json); return null; });
  await ctx.addInitScript(`window.__cgMock = ${JSON.stringify(mock)};`);
  if (init) await ctx.addInitScript(init);
  const external = [], errors = [];
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { external.push(r.request().url()); r.abort(); });
  await ctx.route(CG_SDK_URL, (r) => r.fulfill({ contentType: 'text/javascript', body: CG_SDK_MOCK }));
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
async function reload(page) { await page.reload(); await ready(page); }

/* ---------- R3-01 / R3-03 / R3-08: the Profil screen (vibration, backup, guest ID, stats) ---------- */
async function profileChecks(pkgUrl, webUrl) {
  const r = [];
  const read = (p) => p.evaluate(async () => {
    const g = window.game;
    g.showScreen('mainMenu'); g.openProfileScreen();
    await new Promise(r => setTimeout(r, 300));
    const scr = document.getElementById('profileScreen');
    // Every visible control row / block of the screen, the pause controls panel included.
    document.getElementById('controlsPanel').classList.remove('hidden');
    const visibleText = [...scr.querySelectorAll('*'), ...document.querySelectorAll('#controlsPanel *')].filter(e => window.__vis(e) && e.children.length === 0).map(e => e.textContent.trim()).filter(Boolean).join(' | ');
    const ctrl = ['hapticsRow', 'inputModeRow'].map(id => window.__vis(id));
    document.getElementById('controlsPanel').classList.add('hidden');
    const blocks = [...scr.querySelectorAll('.settings-block')].filter(b => window.__vis(b));
    const tiles = [...document.querySelectorAll('#profileStats .profile-stat')].map(t => { const b = t.getBoundingClientRect(); return { v: t.querySelector('.profile-stat-value').textContent, l: t.querySelector('.profile-stat-label').textContent.trim(), left: b.left, right: b.right, top: Math.round(b.top), h: b.height }; });
    const ident = document.querySelector('.profile-identity');
    return {
      vibration: window.__vis('vibrationRow'), backup: window.__vis('backupBlock'), haptics: ctrl[0],
      vibText: /Wibracje|Haptyka|Vibration|Haptics/i.test(visibleText), backupText: /KOPIA ZAPASOWA|BACKUP|Kod postępu|Progress code|SKOPIUJ|WCZYTAJ|\bCOPY\b|\bLOAD\b/i.test(visibleText),
      guestId: g.save.guestId, idShown: visibleText.includes(g.save.guestId) || /guest_|ID gościa|Guest ID/i.test(visibleText),
      ident: ident ? ident.innerText.replace(/\s+/g, ' ').trim() : null, identVis: window.__vis(ident),
      tiles, vw: innerWidth, blocks: blocks.map(b => b.querySelector('.settings-title').textContent.trim()),
      // no empty gap: consecutive visible blocks keep the screen's normal spacing
      gaps: blocks.slice(1).map((b, i) => Math.round(b.getBoundingClientRect().top - blocks[i].getBoundingClientRect().bottom)),
      stats: { days: g.retention.activeDays, sessions: g.retention.sessions, runs: g.save.stats.runsPlayed || 0, missions: Object.keys(g.save.campaign.completed).length }
    };
  });
  for (const [build, url, device, locale] of [['mock', pkgUrl, PC, 'en-US'], ['mock', pkgUrl, PHONE, 'en-US'], ['web', webUrl, PC, 'pl-PL'], ['web', webUrl, PHONE, 'pl-PL']]) {
    const dev = device === PHONE ? 'phone 412×915 (touch)' : 'PC 1216×684';
    const d = await context({ locale, device });
    const p = await d.open(url);
    await p.evaluate(() => { window.__arena(); window.__qaPlayArena({ style: 'greedy' }); });
    const st = await read(p);
    if (build === 'mock') {
      r.push(report(`[mock] R3-01 package, ${dev}: no vibration switch anywhere (Settings "Vibration", controls "Haptics") and no vibration word on screen`, !st.vibration && !st.haptics && !st.vibText, JSON.stringify({ vibration: st.vibration, haptics: st.haptics, vibText: st.vibText })));
      r.push(report(`[mock] R3-03 package, ${dev}: no BACKUP block (no COPY / LOAD, no progress code text); the visible blocks follow each other with the usual spacing`, !st.backup && !st.backupText && st.blocks.join() === 'SETTINGS,PRIVACY' && st.gaps.every(g => g >= 0 && g <= 60), JSON.stringify({ backup: st.backup, blocks: st.blocks, gaps: st.gaps })));
    } else {
      r.push(report(`[web] R3-01/03 GitHub Pages, ${dev}: "Wibracje" and KOPIA ZAPASOWA unchanged (shown)`, st.vibration && st.backup && st.blocks.join() === 'USTAWIENIA,KOPIA ZAPASOWA,PRYWATNOŚĆ', JSON.stringify({ vibration: st.vibration, backup: st.backup, blocks: st.blocks })));
    }
    const want = locale === 'pl-PL' ? { who: 'Grasz jako: Gość', labels: 'Dni w grze,Sesje,Rundy,Misje' } : { who: 'Playing as: Guest', labels: 'Days played,Sessions,Rounds,Missions' };
    const tilesOk = st.tiles.length === 4 && st.tiles.map(t => t.l).join() === want.labels && st.tiles.every(t => t.left >= 0 && t.right <= st.vw + 0.5 && t.top === st.tiles[0].top)
      && st.tiles.map(t => Number(t.v.replace(/\D/g, ''))).join() === [st.stats.days, st.stats.sessions, st.stats.runs, st.stats.missions].join();
    r.push(report(`[${build}] R3-08 ${dev}: no technical guest ID on screen ("${want.who}"), the four stats as tiles in one row with ${locale === 'pl-PL' ? 'Polish' : 'English'} labels and the real numbers`, !st.idShown && st.identVis && st.ident === want.who && tilesOk, JSON.stringify({ ident: st.ident, idShown: st.idShown, tiles: st.tiles.map(t => `${t.l}=${t.v}`), stats: st.stats })));
    // The ID is kept: same in memory, in the save and after a reload; a set name is shown as typed.
    const id0 = st.guestId;
    await p.evaluate(() => { document.getElementById('displayNameInput').value = 'Miasto'; window.game.saveProfile(); });
    await reload(p);
    const st2 = await read(p);
    const named = locale === 'pl-PL' ? 'Grasz jako: Miasto' : 'Playing as: Miasto';
    r.push(report(`[${build}] R3-08 ${dev}: the guest ID is unchanged after a reload (${id0}), progress kept, a player name is shown untranslated ("${named}")`, st2.guestId === id0 && st2.stats.runs === st.stats.runs && st2.ident === named && !st2.idShown, JSON.stringify({ id0, id1: st2.guestId, runs: [st.stats.runs, st2.stats.runs], ident: st2.ident })));
    r.push(report(`[${build}] R3-01/03/08 ${dev}: no errors${build === 'mock' ? ', nothing external besides the SDK' : ''}`, d.errors.length === 0 && d.external.length === 0, d.errors.concat(d.external).slice(0, 3).join(' | ')));
    await d.close();
  }
  // R3-03: the package's broken-save sheet no longer sends the player to a backup code.
  const d = await context();
  const p = await d.open(pkgUrl);
  const sheet = await p.evaluate(async () => {
    window.game.showSaveGuardNotice('corrupt');
    await new Promise(r => setTimeout(r, 300));
    const t = document.getElementById('infoSheetBody').innerText;
    window.game.closeInfoSheet();
    return t;
  });
  r.push(report('[mock] R3-03 package: the broken-save sheet offers starting over, no "backup code (Profile → Backup)"', /start over/i.test(sheet) && !/backup|kopii/i.test(sheet), sheet.slice(0, 300)));
  // R3-03: saving still works in both environments without the panel -- guest and account.
  const saves = {};
  for (const [name, mock] of [['guest', { mode: 'sdk', user: null }], ['account', { mode: 'sdk', user: { id: 'r3-user', username: 'R3' } }]]) {
    const c = await context({ mock });
    const q = await c.open(pkgUrl);
    const before = await q.evaluate(() => { window.__arena(); window.__qaPlayArena({ style: 'greedy' }); return window.game.save.stats.runsPlayed; });
    await settle(300);
    await reload(q);
    saves[name] = { before, after: await q.evaluate(() => window.game.save.stats.runsPlayed), guard: await q.evaluate(() => SAVE_GUARD.state), errors: c.errors.length };
    await c.close();
  }
  r.push(report('[mock] R3-03 package: progress still saves and loads through the Data Module (guest and signed-in account) with the panel hidden', ['guest', 'account'].every(k => saves[k].before === 2 && saves[k].after === 2 && saves[k].guard === 'ok' && !saves[k].errors), JSON.stringify(saves)));
  await d.close();
  const w = await context({ locale: 'pl-PL' });
  const wp = await w.open(webUrl);
  const web = await wp.evaluate(async () => {
    window.__arena();
    const code = encodeSaveCode(window.game.save);
    return { code: /^VH1\./.test(code), round: decodeSaveCode(code).stats.runsPlayed === window.game.save.stats.runsPlayed };
  });
  r.push(report('[web] R3-03 GitHub Pages: the backup code still encodes and decodes the save', web.code && web.round, JSON.stringify(web)));
  await w.close();
  return r;
}

/* ---------------- R3-02: the result screen's layout ---------------- */
const FRAMES = [
  // CrazyGames fullscreen on a PC / laptop (Windows display scaling 100-175 %), windowed, phones.
  ['fullscreen 1920×1080', 1920, 1080], ['fullscreen 2560×1440', 2560, 1440], ['fullscreen 2560×1080 (ultrawide)', 2560, 1080],
  ['fullscreen 1536×864 (1920×1080 @125%)', 1536, 864], ['fullscreen 1366×768', 1366, 768], ['fullscreen 1280×720 (1920×1080 @150%)', 1280, 720],
  ['fullscreen 1097×617 (1920×1080 @175%)', 1097, 617], ['fullscreen 1093×614 (1366×768 @125%)', 1093, 614], ['fullscreen 1280×1024', 1280, 1024],
  ['windowed 1216×684', 1216, 684], ['windowed 921×518', 921, 518], ['windowed 800×450', 800, 450],
  ['phone 390×844', 390, 844], ['phone 375×667', 375, 667], ['phone landscape 844×390', 844, 390], ['tablet 768×1024', 768, 1024]
];
async function resultLayoutChecks(pkgUrl, webUrl) {
  const r = [];
  fs.mkdirSync(path.join(WORK, 'shots'), { recursive: true });
  const geom = (p) => p.evaluate(async () => {
    await new Promise(r => setTimeout(r, 450));
    // An unlock card (Warsztat / Wyzwania) can open over the result: DALEJ until it is gone.
    for (let i = 0; i < 10 && window.__vis('unlockOverlay'); i++) { document.getElementById('btnUnlockLater').click(); await new Promise(r => setTimeout(r, 250)); }
    const box = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height }; };
    const vis = ['finalLeaderboard', 'dailyResultLine', 'missionResultLine', 'hubMilestoneLine', 'btnPlayAgain', 'btnMenu'].filter(id => window.__vis(id));
    const rects = Object.fromEntries(vis.map(id => [id, box(document.getElementById(id))]));
    const range = document.createRange(); range.selectNodeContents(document.getElementById('btnMenu'));
    const label = range.getBoundingClientRect();
    const again = rects.btnPlayAgain, card = rects.missionResultLine;
    const bar = document.querySelector('#gameOverScreen .result-actions').getBoundingClientRect();
    const overlaps = [];
    // On a phone the action bar sticks to the bottom and the column scrolls under it (by design).
    const sticky = getComputedStyle(document.querySelector('#gameOverScreen .result-actions')).position === 'sticky';
    const acts = ['btnPlayAgain', 'btnMenu'];
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
      if (sticky && (acts.includes(vis[i]) !== acts.includes(vis[j]))) continue;
      const a = rects[vis[i]], b = rects[vis[j]];
      const ix = Math.min(a.r, b.r) - Math.max(a.l, b.l), iy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
      if (ix > 1 && iy > 1) overlaps.push(vis[i] + '/' + vis[j]);
    }
    const cardEl = document.getElementById('missionResultLine');
    const inView = (x) => x && x.l >= -0.5 && x.r <= innerWidth + 0.5 && x.t >= -0.5 && x.b <= innerHeight + 0.5;
    return {
      layout: ['wide', 'compact', 'phone'].find(c => document.body.classList.contains(c)) || 'phone',
      menuText: document.getElementById('btnMenu').textContent.trim(), cardShown: !!card,
      // The web build's short phone bar is one row (PLAY AGAIN + ×2 / challenge): the link
      // under it is centred under the whole bar.
      menuOff: Math.abs((label.left + label.right) / 2 - ((bar.width > again.w + 2 ? bar.left + bar.right : again.l + again.r) / 2)),
      cardEdges: card ? Math.max(Math.abs(card.l - again.l), Math.abs(card.r - again.r)) : null,
      clipped: card ? cardEl.scrollWidth > cardEl.clientWidth + 1 : false,
      overlaps, actionsInView: inView(again) && inView(rects.btnMenu),
      cardGap: card && !sticky ? Math.round(again.t - card.b) : null, sticky
    };
  });
  for (const [lang, build, url] of [['en', 'mock', pkgUrl], ['pl', 'mock', pkgUrl + '#lang=pl'], ['pl', 'web', webUrl]]) {
    const d = await context({ locale: lang === 'pl' ? 'pl-PL' : 'en-US', device: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 } });
    const p = await d.open(url);
    // A finished round with the daily mission card and a Core City level line, for a
    // player who knows Miasto ("Back to City") -- the fullest result screen.
    await p.evaluate(() => {
      window.__arena();
      for (let i = 0; i < 2; i++) window.__qaPlayArena({ style: 'greedy' });
      const g = window.game; g.save.mission.completed = false; g.save.hub.coreCharge = 95;
      window.__qaPlayArena({ style: 'greedy', onFrame: (f, gg) => { if (gg.activeMission) gg.missionProgressPeak = 1e9; } });
    });
    await settle(2500); // let a delayed unlock card open (geom() closes it)
    const frames = build === 'web' ? FRAMES.filter(f => /1920×1080|1366|1280×720|1097|1093|921|375×667|390×844/.test(f[0])) : FRAMES; // web: R3-02 is a package report, these frames guard the shared CSS
    const bad = [], seen = [];
    for (const [name, w, h] of frames) {
      await p.setViewportSize({ width: w, height: h });
      const g = await geom(p);
      await p.screenshot({ path: path.join(WORK, 'shots', `${build}-${lang}-${w}x${h}.png`) });
      // The package's action bar is one column everywhere, so the card and PLAY AGAIN share
      // their edges; the web build's short phone layout puts the ×2 / share row beside it.
      const edgesOk = g.cardEdges === null || g.cardEdges <= 1.5 || (build === 'web' && h <= 700 && g.layout === 'phone');
      const ok = g.cardShown && g.menuOff <= 2 && edgesOk && !g.clipped && !g.overlaps.length && g.actionsInView && (g.cardGap === null || g.cardGap >= 4);
      seen.push(`${w}x${h}:${g.layout}`);
      if (!ok) bad.push(`${name} ${JSON.stringify(g)}`);
    }
    r.push(report(`[${build}] R3-02 ${lang.toUpperCase()} result screen at ${frames.length} frames (fullscreen PC/laptop incl. 125–175 % scaling, windowed, phones): "${lang === 'en' ? 'Back to City' : 'Wróć do Miasta'}" centred under PLAY AGAIN (≤ 2 px), the DAILY MISSION card on PLAY AGAIN's edges, nothing clipped or overlapping, the buttons in view`, !bad.length, bad.length ? bad.join(' || ').slice(0, 1600) : seen.join(' ')));
    // A long mission name wraps inside the card (no overflow, no overlap).
    await p.setViewportSize({ width: 1093, height: 614 });
    await p.evaluate(() => { document.getElementById('dailyMissionName').textContent = 'Swallow every single neon billboard in the whole downtown district twice'; });
    const long = await geom(p);
    r.push(report(`[${build}] R3-02 ${lang.toUpperCase()} a long mission name at 1093×614 wraps inside the card: no clipping or overlap, buttons in view`, !long.clipped && !long.overlaps.length && long.actionsInView, JSON.stringify(long)));
    if (lang === 'en') {
      // A new player's first result: "Main menu" is centred the same way.
      const n = await context({ device: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 } });
      const q = await n.open(url);
      await q.evaluate(() => window.__arena());
      const first = await geom(q);
      await q.screenshot({ path: path.join(WORK, 'shots', `${build}-first-1920x1080.png`) });
      r.push(report(`[${build}] R3-02 a new player's first result, fullscreen 1920×1080: "Main menu" centred under PLAY AGAIN`, first.menuText === 'Main menu' && first.menuOff <= 2 && first.actionsInView && !first.overlaps.length, JSON.stringify(first)));
      await n.close();
    }
    r.push(report(`[${build}] R3-02 ${lang.toUpperCase()}: no errors`, d.errors.length === 0, d.errors.slice(0, 2).join(' | ')));
    await d.close();
  }
  return r;
}

/* ---------------- R3-04: CrazyGames SDK gameplay events, path by path ---------------- */
async function sdkChecks(pkgUrl) {
  const r = [];
  const d = await context();
  const p = await d.open(pkgUrl);
  const step = async (name, fn, want) => {
    const got = await p.evaluate(async (src) => { window.__cgMockGame.length = 0; await (0, eval)(src)(); await new Promise(r => setTimeout(r, 150)); return window.__ev(); }, `(async () => { ${fn} })`);
    r.push(report(`[mock] R3-04 ${name}: ${want.length ? want.join(' → ') : 'no gameplay event'}`, got.join() === want.join(), JSON.stringify(got)));
  };
  r.push(report('[mock] R3-04 boot: the SDK is initialised (environment local) and no gameplay event before the player plays', await p.evaluate(() => !!(window.CrazyGames && window.CrazyGames.SDK) && window.__ev().length === 0), JSON.stringify(await p.evaluate(() => window.__ev()))));
  await step('menus without play (Miasto, Warsztat, Dzielnice, Wyzwania, Profil + settings)', `const g = window.game; for (const s of ['mainMenu']) g.showScreen(s); g.openCampaignScreen(); g.showScreen('mainMenu'); g.openProfileScreen(); g.showScreen('mainMenu');`, []);
  await step('Arena from the welcome GRAJ, round to its end (bot)', `window.__arena();`, ['gameplayStart', 'gameplayStop']);
  await step('PLAY AGAIN, then pause / resume / pause, leave the paused round', `document.getElementById('btnPlayAgain').click(); await new Promise(r => setTimeout(r, 200)); const g = window.game; g.pauseGame(); g.resumeGame(); g.pauseGame(); document.getElementById('btnLeaveRun').click(); const y = document.getElementById('btnLeaveConfirmYes'); if (y && y.offsetParent !== null) y.click();`, ['gameplayStart', 'gameplayStop', 'gameplayStart', 'gameplayStop']);
  await step('Arena: restart from the pause sheet', `const g = window.game; g.startRound({}); g.pauseGame(); g.restartFromPause(); await new Promise(r => setTimeout(r, 100)); g.pauseGame(); g.leaveRun && g.leaveRun();`, ['gameplayStart', 'gameplayStop', 'gameplayStart', 'gameplayStop']);
  await step('focus lost mid-round (the game shows its pause sheet), focus back, then RESUME', `const g = window.game; g.startRound({}); window.dispatchEvent(new Event('blur')); await new Promise(r => setTimeout(r, 100)); window.dispatchEvent(new Event('focus')); await new Promise(r => setTimeout(r, 100)); const paused = g.paused; g.resumeGame(); g.stopRun(); if (!paused) throw new Error('not paused');`, ['gameplayStart', 'gameplayStop', 'gameplayStart', 'gameplayStop']);
  await step('tab hidden mid-round (minimise / other tab), visible again, then RESUME', `const g = window.game; g.startRound({}); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); const paused = g.paused; delete document.visibilityState; g.resumeGame(); g.stopRun(); if (!paused) throw new Error('not paused');`, ['gameplayStart', 'gameplayStop', 'gameplayStart', 'gameplayStop']);
  // Fullscreen / window resize mid-round sends nothing.
  await p.evaluate(() => { window.__cgMockGame.length = 0; window.game.startRound({}); });
  await p.setViewportSize({ width: 1920, height: 1080 });
  await settle(300);
  await p.setViewportSize({ width: 1216, height: 684 });
  await settle(300);
  const rs = await p.evaluate(() => { const ev = window.__ev(); window.game.stopRun(); return ev.concat(window.__ev().slice(ev.length)); });
  r.push(report('[mock] R3-04 fullscreen-sized resize mid-round (1216×684 → 1920×1080 → back): no event besides the round\'s own start and stop', rs.join() === 'gameplayStart,gameplayStop', JSON.stringify(rs)));
  await step('Daily Challenge run to its end and a replay', `window.__qaPlayArena({ style: 'greedy', round: { seed: 4242, daily: true } }); window.__qaPlayArena({ style: 'greedy', round: { seed: 4242, daily: true } });`, ['gameplayStart', 'gameplayStop', 'gameplayStart', 'gameplayStop']);
  await step('Dzielnice: mission start card (world frozen, "the clock starts on tap") sends nothing until START', `const g = window.game; g.startCampaignMission('M01'); if (!g.introPending) throw new Error('no start card');`, []);
  await step('… pause and resume on the start card send nothing; START → start; the mission played to its end → stop', `const g = window.game; g.pauseGame(); g.resumeGame(); g.beginMissionPlay(); window.__qaPlayMission('M01', { style: 'expert', clock0: 9e6, noStart: true });`, ['gameplayStart', 'gameplayStop']);
  await step('Dzielnice: back out of the start card (Change boosters / Back to map)', `const g = window.game; g.startCampaignMission('M01'); g.cancelMissionStart(); g.showScreen('mainMenu');`, []);
  await step('Dzielnice: START, pause, resume, leave the mission', `const g = window.game; g.startCampaignMission('M01'); g.beginMissionPlay(); g.pauseGame(); g.resumeGame(); g.leaveCampaignMission(); g.showScreen('mainMenu');`, ['gameplayStart', 'gameplayStop', 'gameplayStart', 'gameplayStop']);
  await step('Dzielnice: time up with a revive offer (a break) → stop; pause/resume on the offer send nothing; revive with prisms → start; then the mission ends → stop', `const g = window.game; g.startCampaignMission('M01'); g.beginMissionPlay(); g.save.prisms = 50; g.campaignGoalFraction = () => 0.9; g.onCampaignTimeout(); if (!g.revivePending) throw new Error('no offer'); g.pauseGame(); g.resumeGame(); g.acceptRevivePrisms(); delete g.campaignGoalFraction; g.endCampaignMission(false); g.showScreen('mainMenu');`, ['gameplayStart', 'gameplayStop', 'gameplayStart', 'gameplayStop']);
  await step('Dzielnice: revive offer declined → the mission ends with no second stop', `const g = window.game; g.startCampaignMission('M01'); g.beginMissionPlay(); g.save.prisms = 50; g.campaignGoalFraction = () => 0.9; g.onCampaignTimeout(); g.declineRevive(); delete g.campaignGoalFraction; g.showScreen('mainMenu');`, ['gameplayStart', 'gameplayStop']);
  // The whole page's log alternates start/stop with no duplicate; and a reload starts clean.
  const all = await p.evaluate(() => (window.__cgMockGame || []).map(e => e[0]));
  r.push(report('[mock] R3-04 no loadingStart/loadingStop/happytime and no ad call in the package (Basic Launch: ads disabled)', !all.some(n => /loading|happytime|ad/i.test(n)), JSON.stringify(all)));
  await p.evaluate(() => { window.__cgMockGame.length = 0; window.__arena(); window.game.startRound({}); window.game.pauseGame(); window.game.resumeGame(); window.game.stopRun(); });
  const seq = await p.evaluate(() => window.__ev());
  r.push(report(`[mock] R3-04 a mixed run of calls strictly alternates start/stop (${seq.length} events, none doubled, nothing left open)`, seq.length > 0 && seq.length % 2 === 0 && seq.every((n, i) => n === (i % 2 ? 'gameplayStop' : 'gameplayStart')), JSON.stringify(seq)));
  await reload(p);
  const fresh = await p.evaluate(() => window.__ev());
  await p.evaluate(() => window.__arena());
  const after = await p.evaluate(() => window.__ev());
  r.push(report('[mock] R3-04 after a reload: nothing until the player plays, then start → stop again', fresh.length === 0 && after.join() === 'gameplayStart,gameplayStop', JSON.stringify({ fresh, after })));
  r.push(report('[mock] R3-04 no errors, nothing external besides the SDK', d.errors.length === 0 && d.external.length === 0, d.errors.concat(d.external).slice(0, 3).join(' | ')));
  await d.close();
  return r;
}

/* ---------------- R3-06: Core City values = what the round pays ---------------- */
async function coreValueChecks(pkgUrl, webUrl) {
  const r = [];
  const view = (p, level, charge = 40) => p.evaluate(async ([lv, ch]) => {
    const g = window.game; g.save.hub.coreLevel = lv; g.save.hub.coreCharge = ch;
    g.showScreen('mainMenu'); g.updateHubQuickTiles(); g.openChallengesScreen();
    await new Promise(r => setTimeout(r, 300));
    const t = (id) => document.getElementById(id).innerText.replace(/\s+/g, ' ').trim();
    return { play: t('hubPlaySub'), pitch: t('hubCityPitchSub'), first: t('dailyRewardFirst'), best: t('dailyRewardBest'), note: t('dailyRewardNote') };
  }, [level, charge]);
  const d = await context();
  const p = await d.open(pkgUrl);
  await p.evaluate(() => { window.__arena(); for (let i = 0; i < 6; i++) window.__qaPlayArena({ style: 'greedy' }); });
  const v1 = await view(p, 1), v2 = await view(p, 2), v3 = await view(p, 3);
  const early = (v) => /\+16–27% city build/.test(v.play) && /\+16–27% per round with the starting bonus/.test(v.pitch) && v.first === '+32% Core City' && v.best === '+16% Core City' && /Starting bonus: \+60% city progress on LVL 1–2 \(already included\)\. From LVL 3: \+20% and \+10%/.test(v.note);
  r.push(report('[mock] R3-06 English, LVL 1 and LVL 2: GRAJ +16–27%, Miasto "+16–27% per round with the starting bonus", Daily +32% / +16% Core City with "Starting bonus: +60% … From LVL 3: +20% and +10%"', early(v1) && early(v2), JSON.stringify({ v1, v2 })));
  r.push(report('[mock] R3-06 English, LVL 3: every value without the bonus (GRAJ +10–17%, Daily +20% / +10%), no starting-bonus wording left', /\+10–17% city build/.test(v3.play) && /\+10–17% per round ·/.test(v3.pitch) && !/bonus/i.test(v3.pitch) && v3.first === '+20% Core City' && v3.best === '+10% Core City' && !/Starting bonus/.test(v3.note), JSON.stringify(v3)));
  // Real Arena rounds at LVL 1 and LVL 3: the result's parts add up to the gain shown, no ×.
  const rounds = await p.evaluate(async () => {
    const g = window.game, out = [];
    for (const [lv, ch] of [[1, 0], [1, 0], [3, 0], [3, 0]]) {
      g.save.hub.coreLevel = lv; g.save.hub.coreCharge = ch;
      window.__qaPlayArena({ style: 'greedy' });
      await new Promise(r => setTimeout(r, 400)); // the English layer translates after a DOM change
      const line = document.getElementById('resultCoreParts').innerText, gain = document.getElementById('resultCoreGain').textContent;
      const nums = [...line.replace(/starting bonus \+\d+%/, '').matchAll(/\+(\d+)%/g)].map(m => +m[1]);
      out.push({ lv, line, gain, sum: nums.reduce((a, b) => a + b, 0), total: g.lastCoreGain.total });
    }
    return out;
  });
  r.push(report('[mock] R3-06 real Arena rounds (LVL 1 ×2, LVL 3 ×2): the result lists each part as it landed, the parts add up to the "+N%" shown, LVL 1 names "with the starting bonus +60%", no ×1.6 to apply', rounds.every(x => x.sum === x.total && x.gain === `+${x.total}%` && !/×/.test(x.line) && (x.lv <= 2 ? /with the starting bonus \+60%/.test(x.line) : !/bonus/.test(x.line))), JSON.stringify(rounds)));
  // LVL 2 -> 3 inside one round: that round keeps the bonus, the next screens drop it.
  const cross = await p.evaluate(async () => {
    const g = window.game; g.save.hub.coreLevel = 2; g.save.hub.coreCharge = 95;
    window.__qaPlayArena({ style: 'greedy' });
    const lc = g.lastCoreGain;
    const res = { early: lc.early, total: lc.total, sumBase: lc.parts.reduce((a, x) => a + x[1], 0), level: g.save.hub.coreLevel, charge: g.save.hub.coreCharge, line: document.getElementById('resultCoreParts').innerText };
    g.showScreen('mainMenu'); g.updateHubQuickTiles(); g.openChallengesScreen();
    await new Promise(r => setTimeout(r, 300));
    res.play = document.getElementById('hubPlaySub').innerText; res.first = document.getElementById('dailyRewardFirst').innerText;
    return res;
  });
  r.push(report('[mock] R3-06 LVL 2 → 3 in one round: that round still has the starting bonus (gain = round(parts × 1.6)), the city reaches LVL 3 and GRAJ / Daily then show +10–17% / +20%', cross.early && cross.total === Math.round(cross.sumBase * 1.6) && cross.level === 3 && cross.charge === 95 + cross.total - 100 && /\+10–17%/.test(cross.play) && cross.first === '+20% Core City', JSON.stringify(cross)));
  await d.close();
  // Polish (web build) and a phone width: the same values, the note fits.
  const w = await context({ locale: 'pl-PL', device: { viewport: { width: 375, height: 667 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } });
  const wp = await w.open(webUrl);
  await wp.evaluate(() => { window.__arena(); for (let i = 0; i < 6; i++) window.__qaPlayArena({ style: 'greedy' }); });
  const pl1 = await view(wp, 1), pl3 = await view(wp, 3);
  const fit = await wp.evaluate(async () => { const g = window.game; g.save.hub.coreLevel = 1; g.showScreen('mainMenu'); g.updateHubQuickTiles(); g.openChallengesScreen(); await new Promise(r => setTimeout(r, 300)); const n = document.getElementById('dailyRewardNote').getBoundingClientRect(), b = document.getElementById('btnPlayDaily').getBoundingClientRect(); return { noteR: n.right, vw: innerWidth, playBottom: b.bottom, vh: innerHeight }; });
  r.push(report('[web] R3-06 Polish, LVL 1 (375×667): "+16–27% za rundę z premią startową", Wyzwanie "+32% / +16% Core City", "Premia startowa: +60% postępu miasta na LVL 1–2 (już wliczona)"; LVL 3: +20% / +10% bez premii; the note inside the screen', /\+16–27% budowy miasta/.test(pl1.play) && /\+16–27% za rundę z premią startową/.test(pl1.pitch) && pl1.first === '+32% Core City' && pl1.best === '+16% Core City' && /Premia startowa: \+60% postępu miasta na LVL 1–2 \(już wliczona\)/.test(pl1.note) && pl3.first === '+20% Core City' && !/premi/i.test(pl3.note + pl3.pitch) && fit.noteR <= fit.vw + 0.5, JSON.stringify({ pl1, pl3, fit })));
  r.push(report('[mock/web] R3-06: no errors', d.errors.length === 0 && w.errors.length === 0, d.errors.concat(w.errors).slice(0, 2).join(' | ')));
  await w.close();
  return r;
}

/* ---------------- R3-07: Daily Core City once a day ---------------- */
async function dailyOnceChecks(pkgUrl, webUrl) {
  const r = [];
  const at1 = (x) => Math.round(x * 1.6);
  for (const [who, mock] of [['guest', { mode: 'sdk', user: null }], ['signed-in', { mode: 'sdk', user: { id: 'r3-daily', username: 'R3D' } }]]) {
    CLOUD.delete('r3-daily');
    const d = await context({ mock });
    const p = await d.open(pkgUrl);
    await p.evaluate(() => { window.__arena(); window.game.save.hub.coreLevel = 1; window.game.save.hub.coreCharge = 0; });
    // A: first finish with a record, then no improvement, then improvements -- LVL 1 (×1.6).
    const a = await p.evaluate(() => [1000, 500, 2000, 3000, 4000].map(s => window.__daily(s)));
    r.push(report(`[mock] R3-07 ${who}, LVL 1: first finish with a record +${at1(30)}% (= +20% +10% ×1.6), a second finish without a better score +0%, the 2nd/3rd/4th better scores +0% but the record still goes up (2000 → 3000 → 4000)`,
      a[0].gain === at1(30) && a[0].added === at1(30) && a.slice(1).every(x => x.gain === 0 && x.added === 0 && x.claimed) && a.map(x => x.best).join() === '1000,1000,2000,3000,4000' && /today’s Core City rewards already claimed|nagrody Core City odebrane dziś/.test(a[1].line),
      JSON.stringify(a.map(x => ({ gain: x.gain, best: x.best, claimed: x.claimed, line: x.line })))));
    // B: refresh and restart after the payout: still nothing more today.
    await settle(200);
    await reload(p);
    const b = await p.evaluate(() => window.__daily(5000));
    const page2 = await d.ctx.newPage();
    await page2.goto(pkgUrl); await ready(page2);
    await p.close();
    const c = await page2.evaluate(() => window.__daily(6000));
    r.push(report(`[mock] R3-07 ${who}: after a refresh and after reopening the game the same day, a better score pays +0% (record ${b.best} → ${c.best})`, b.gain === 0 && b.added === 0 && c.gain === 0 && c.best === 6000, JSON.stringify({ b: { gain: b.gain, best: b.best }, c: { gain: c.gain, best: c.best } })));
    // C: the next UTC day (markers dated yesterday): paid again, once.
    const e = await page2.evaluate(() => { const g = window.game; g.save.daily.lastPlayedDate = g.save.daily.lastSeedDate = '2000-01-01'; return [window.__daily(100), window.__daily(200)]; });
    r.push(report(`[mock] R3-07 ${who}: a new day pays again once (+${at1(30)}%), the day's next better score +0%`, e[0].gain === at1(30) && e[1].gain === 0 && e[1].best === 200, JSON.stringify(e.map(x => x.gain))));
    r.push(report(`[mock] R3-07 ${who}: no errors`, d.errors.length === 0, d.errors.slice(0, 2).join(' | ')));
    await d.close();
  }
  const d = await context();
  const p = await d.open(pkgUrl);
  await p.evaluate(() => window.__arena());
  // D: the first finish without a record (score 0), then the first record -- each part once.
  const f = await p.evaluate(() => { const g = window.game; g.save.hub.coreLevel = 3; g.save.hub.coreCharge = 0; return [window.__daily(0), window.__daily(700), window.__daily(900)]; });
  r.push(report('[mock] R3-07 LVL 3: first finish without a record +20% (base only), the first record later the same day +10% (bonus only), the next record +0%', f[0].gain === 20 && f[0].parts.join() === 'Wyzwanie dnia' && f[1].gain === 10 && f[1].parts.join() === 'rekord dnia' && f[2].gain === 0 && f[2].best === 900, JSON.stringify(f.map(x => ({ gain: x.gain, parts: x.parts, best: x.best })))));
  // E: leaving the Daily early pays nothing and marks nothing.
  const leave = await p.evaluate(() => {
    const g = window.game; g.save.daily.lastPlayedDate = g.save.daily.lastSeedDate = '2000-01-01';
    const before = JSON.stringify({ c: g.save.hub.coreCharge, l: g.save.hub.coreLevel, d: g.save.daily });
    const out = [];
    for (const score of [0, 800]) {
      g.startRound({ seed: 4242, daily: true }); if (g.rafId) cancelAnimationFrame(g.rafId);
      g.player.score = score; g.pauseGame(); g.leaveRun();
      out.push(JSON.stringify({ c: g.save.hub.coreCharge, l: g.save.hub.coreLevel, d: g.save.daily }) === before);
    }
    return { out, after: window.__daily(300).gain };
  });
  r.push(report('[mock] R3-07 leaving the Daily before its end (score 0 and score 800) pays no Core City and uses up nothing: the next finished run still pays +20% +10%', leave.out.every(Boolean) && leave.after === 30, JSON.stringify(leave)));
  // F: LVL 2 -> 3 on the day's first Daily: the bonus applies to that run; the next day +20/+10.
  const cross = await p.evaluate(() => {
    const g = window.game; g.save.hub.coreLevel = 2; g.save.hub.coreCharge = 80; g.save.daily.lastPlayedDate = g.save.daily.lastSeedDate = '2000-01-01';
    const x = window.__daily(1500);
    g.save.daily.lastPlayedDate = g.save.daily.lastSeedDate = '2000-01-01';
    const y = window.__daily(1600);
    return { x: { gain: x.gain, level: x.level, early: x.early }, y: { gain: y.gain, early: y.early } };
  });
  r.push(report(`[mock] R3-07 LVL 2 → 3 on the day's first Daily: +${at1(30)}% with the starting bonus, the city reaches LVL 3; the next day +30% without it`, cross.x.gain === at1(30) && cross.x.early && cross.x.level === 3 && cross.y.gain === 30 && !cross.y.early, JSON.stringify(cross)));
  // G: a save from before R3-07 that finished today's Daily (same fields, same shape): not paid twice.
  const legacyRes = [];
  for (const [name, score, want] of [['finished today with a record', 1200, 0], ['finished today, no record (score 0)', 400, 10], ['played yesterday only', 400, 30]]) {
    const c = await context();
    const q = await c.open(pkgUrl);
    await q.evaluate((nm) => {
      const today = window.__today();
      const daily = nm === 'finished today with a record' ? { lastSeedDate: today, lastSeedScore: 900, streak: 2, lastPlayedDate: today }
        : nm === 'finished today, no record (score 0)' ? { lastSeedDate: '2000-01-01', lastSeedScore: 50, streak: 2, lastPlayedDate: today }
        : { lastSeedDate: '2000-01-01', lastSeedScore: 50, streak: 2, lastPlayedDate: '2000-01-01' };
      // The pre-R3 save: written as the old game wrote it (same fields), then loaded fresh.
      const s = window.game.save; s.daily = daily; s.hub.coreLevel = 3; s.hub.coreCharge = 10;
      saveGame(s);
    }, name);
    await reload(q);
    const out = await q.evaluate((sc) => { const x = window.__daily(sc); return { gain: x.gain, guard: SAVE_GUARD.state, schema: window.game.save.schemaVersion }; }, score);
    legacyRes.push({ name, want, ...out, ok: out.gain === want && out.guard === 'ok' });
    await c.close();
  }
  r.push(report('[mock] R3-07 saves from before the change (no new field needed): finished today with a record → +0%; finished today without a record → only the record bonus +10%; played only yesterday → +20% +10%; the save loads clean (guard ok)', legacyRes.every(x => x.ok), JSON.stringify(legacyRes)));
  // H: a payout whose save never reached the account (Data Module debounce, reload too early):
  // the gain and its marker are lost together -- paid once in total, never twice.
  CLOUD.delete('r3-slow');
  const s = await context({ mock: { mode: 'sdk', user: { id: 'r3-slow', username: 'Slow' }, cloudDebounceMs: 60000 } });
  const sp = await s.open(pkgUrl);
  await sp.evaluate(() => window.__arena());
  await settle(200);
  await sp.evaluate(() => { window.__cgMock.cloudDebounceMs = 0; window.game.save.hub.coreLevel = 3; window.game.save.hub.coreCharge = 0; saveGame(window.game.save); window.__cgMock.cloudDebounceMs = 60000; });
  await settle(200);
  const lost = await sp.evaluate(() => window.__daily(1000));
  await reload(sp); // the debounced write never landed
  const again = await sp.evaluate(() => { const x = window.__daily(1100); return { gain: x.gain, charge: window.game.save.hub.coreCharge }; });
  r.push(report('[mock] R3-07 delayed save (signed-in, the write still debounced at a reload): the lost payout comes back once on the next finish (+30% in total, not +60%)', lost.gain === 30 && again.gain === 30 && again.charge === 30, JSON.stringify({ lost: lost.gain, again })));
  await s.close();
  // I: the Wyzwania screen says which rewards are left (English package, Polish web).
  const ui = await p.evaluate(async () => {
    const g = window.game, show = async () => { g.showScreen('mainMenu'); g.updateHubQuickTiles(); g.openChallengesScreen(); await new Promise(r => setTimeout(r, 300)); return ['dailyRewardFirst', 'dailyRewardBest', 'dailyRewardNote'].map(id => document.getElementById(id).innerText.trim()).concat([...document.querySelectorAll('.daily-reward-box.claimed')].length); };
    g.save.hub.coreLevel = 3; g.save.daily.lastPlayedDate = g.save.daily.lastSeedDate = '2000-01-01';
    const fresh = await show();
    window.__daily(0);
    const half = await show();
    window.__daily(10);
    const done = await show();
    return { fresh, half, done };
  });
  r.push(report('[mock] R3-07 English Wyzwania: "+20% / +10% Core City" before; after a finish without a record the first box says "Claimed today"; after the record both do, with "Today’s Core City rewards are claimed. Keep playing for the record"', ui.fresh.slice(0, 2).join() === '+20% Core City,+10% Core City' && ui.fresh[3] === 0 && ui.half[0] === 'Claimed today' && ui.half[1] === '+10% Core City' && ui.half[3] === 1 && ui.done[0] === 'Claimed today' && ui.done[1] === 'Claimed today' && ui.done[3] === 2 && /Today’s Core City rewards are claimed\. Keep playing for the record/.test(ui.done[2]), JSON.stringify(ui)));
  r.push(report('[mock] R3-07: no errors', d.errors.length === 0, d.errors.slice(0, 2).join(' | ')));
  await d.close();
  const w = await context({ locale: 'pl-PL' });
  const wp = await w.open(webUrl);
  const wr = await wp.evaluate(async () => {
    window.__arena(); const g = window.game; g.save.hub.coreLevel = 1; g.save.hub.coreCharge = 0;
    const runs = [window.__daily(1000), window.__daily(2000)].map(x => ({ gain: x.gain, line: x.line }));
    g.showScreen('mainMenu'); g.updateHubQuickTiles(); g.openChallengesScreen(); await new Promise(r => setTimeout(r, 300));
    return { runs, first: document.getElementById('dailyRewardFirst').innerText, note: document.getElementById('dailyRewardNote').innerText };
  });
  r.push(report('[web] R3-07 Polish (GitHub Pages, same rule): +48% then +0% with "Wyzwanie dnia: nagrody Core City odebrane dziś", the box "Odebrane dziś" and "Dzisiejsze nagrody Core City odebrane"', wr.runs[0].gain === 48 && /Wyzwanie dnia \+32%.*rekord dnia \+16%.*z premią startową \+60%/.test(wr.runs[0].line) && wr.runs[1].gain === 0 && /nagrody Core City odebrane dziś/.test(wr.runs[1].line) && wr.first === 'Odebrane dziś' && /Dzisiejsze nagrody Core City odebrane/.test(wr.note), JSON.stringify(wr)));
  await w.close();
  return r;
}

/* ---- R3-07 with a real pre-R3 save: the previous package plays today's Daily, this one loads it ---- */
async function legacyBuildChecks(pkgUrl, webUrl, legacyUrl) {
  const r = [];
  for (const [name, firstScore, nextScore, want] of [['a finish with a record', 1000, 2000, 0], ['a finish without a record (score 0)', 0, 500, 16]]) {
    const old = await context();
    const op = await old.open(legacyUrl);
    const before = await op.evaluate((sc) => { window.__arena(); window.game.save.hub.coreLevel = 1; return window.__daily(sc); }, firstScore);
    await settle(300);
    const storage = await op.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
    await old.close();
    const neu = await context({ init: `if (!sessionStorage.getItem('__r3seeded')) { sessionStorage.setItem('__r3seeded', '1'); const s = ${JSON.stringify(storage)}; for (const k in s) localStorage.setItem(k, s[k]); }` });
    const np = await neu.open(pkgUrl);
    const after = await np.evaluate((sc) => { const x = window.__daily(sc); return { gain: x.gain, best: x.best, guard: SAVE_GUARD.state, schema: window.game.save.schemaVersion, runs: window.game.save.stats.runsPlayed }; }, nextScore);
    r.push(report(`[mock] R3-07 a save from the previous package (pre-R3) after ${name} today (it paid +${before.gain}%): the new package pays +${want}% for a better score today, keeps the record, loads clean`, after.gain === want && after.best === nextScore && after.guard === 'ok' && after.schema === 13, JSON.stringify({ before: { gain: before.gain, daily: before.daily }, after })));
    r.push(report(`[mock] R3-07 legacy (${name}): no errors`, old.errors.length === 0 && neu.errors.length === 0, old.errors.concat(neu.errors).slice(0, 2).join(' | ')));
    await neu.close();
  }
  return r;
}

export async function runCgPreviewQa3Checks({ root = ROOT, legacyRoot = null } = {}) {
  // Its own folder per checkout, so a base run next to a candidate run never shares an export.
  WORK = path.join(OUT, 'cg-preview-qa3', root === ROOT ? 'this' : 'root-' + path.basename(root));
  fs.mkdirSync(WORK, { recursive: true });
  const pkg = exportPackage({ root, out: path.join(WORK, 'export') });
  const site = await serve({ root: pkg.gameDir });
  const web = await serve({ root });
  const legacy = legacyRoot ? await serve({ root: exportPackage({ root: legacyRoot, out: path.join(WORK, 'export-legacy') }).gameDir }) : null;
  browser = await chromium.launch();
  const all = [];
  const only = (process.argv.find(x => x.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  try {
    for (const step of [profileChecks, resultLayoutChecks, sdkChecks, coreValueChecks, dailyOnceChecks].concat(legacy ? [legacyBuildChecks] : [])) {
      if (only.length && !only.includes(step.name)) continue;
      try { all.push(...await step(site.url, web.url, legacy && legacy.url)); } catch (e) { all.push(report(`cg-preview-qa3: ${step.name} crashed`, false, String(e && e.stack || e).slice(0, 600))); }
    }
  } finally { await browser.close(); site.server.close(); web.server.close(); if (legacy) legacy.server.close(); }
  return all;
}

if (isMain(import.meta.url)) {
  const a = process.argv.find(x => x.startsWith('--root='));
  const l = process.argv.find(x => x.startsWith('--legacy-root='));
  const res = await runCgPreviewQa3Checks({ ...(a ? { root: path.resolve(a.slice(7)) } : {}), ...(l ? { legacyRoot: path.resolve(l.slice(14)) } : {}) });
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} PASS`);
  failed.forEach(f => console.log('  FAIL', f.name, String(f.details || '').slice(0, 600)));
  process.exit(failed.length ? 1 : 0);
}
