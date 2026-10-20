// PX02 D+ (owner decision 2026-10-17): "In the Arena what counts is how you
// play. Coins buy looks and mission boosters."
//  - ISO-A/B/C/D: Arena, Daily and friend challenges start with the same
//    parameters for every profile -- fresh or 10/30/240 missions, any coins,
//    XP or level, any equipped vortex (bought for real in Warsztat), any
//    campaign state (new / partial / finished / missing / broken); GRAJ,
//    replay and the friend rematch start straight away with nothing for
//    sale; Arena rounds change nothing in the campaign; shared coins reach
//    the campaign only through a deliberate booster purchase.
//  - BOOST-01..03: mission boosters (bought, used, reset) never change the
//    Arena; Magnes and Sprint still work in a mission; no Turbo for coins or
//    for an ad anywhere in the Arena.
//  - LEGACY-01..08: the one-time refund for vortices whose bonus went away
//    (6 paid vortices, 100+220+450+800+1300+2000 = 4870 coins at list price)
//    is paid at most once per save line, committed in the same write as its
//    marker (save.economy.looksOnly) through saveGame() only, never while
//    SAVE_GUARD holds a save, rolled back in memory when the write fails,
//    survives the previous release (5db3b02) reading and rewriting the save,
//    and its card shows only after a successful commit, once.
// The parameter signature (__px02Sig) isolates direct modifiers on a fixed
// seed: the seed fixes only the starting layout, so the micro-board (one
// object, rivals parked in a corner, a fixed final score) avoids comparing
// whole rounds that also use Math.random().
// Synthetic fixtures only. Usage: node qa/px02-isolation.mjs
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { serve, openGame, chromium, report, ARENA_BOT, CAMPAIGN_BOT, ROOT, OUT, installQaBridge, waitForQaBridge, revisionFile } from './lib.mjs';
import { devCodeToken } from './dev-code.mjs';

const KEY = 'vectorHoleSave_v1';
const BASE_REV = '5db3b02094592b541a18fc11ca52e248ff0c14a4';
const PAID = { cyan: 100, pink: 220, green: 450, purple: 800, gold: 1300, white: 2000 };
const FIXTURES = path.join(OUT, 'px02-fixtures');

/** In-page: a deterministic read of every Arena modifier a profile could
 *  carry -- start size and speed, run tools, bots and board, magnet pull,
 *  points/growth/combo window of one bite, coins/XP for a fixed result. */
const SIG = `
window.__px02Sig = function (round) {
  const g = window.game;
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  let vnow = realNow();
  performance.now = () => vnow;
  const tick = (n, each) => { for (let i = 0; i < n && g.state === GameState.PLAYING; i++) { if (g.evolutionPending) g.skipEvolutionOffer(); vnow += 1000 / 30; g.update(1 / 30); if (each) each(); } };
  const out = {};
  try {
    // Arena's own career (runs played, recent scores) sets its difficulty and
    // pacer -- held equal so only what a profile carries can differ.
    g.save.stats.runsPlayed = 10; g.save.stats.recentArenaScores = [500, 600, 700, 650, 640];
    const coins0 = g.save.coins, prisms0 = g.save.prisms;
    g.startRound(round || { seed: 4242 });
    if (g.rafId) cancelAnimationFrame(g.rafId);
    g.running = false;
    const p = g.player;
    out.state = g.state;
    out.chargedOnStart = (g.save.coins !== coins0) || (g.save.prisms !== prisms0);
    out.startRadius = +p.radius.toFixed(3);
    out.speed = +p.getSpeed().toFixed(4);
    out.shield = g.shieldCharges || 0;
    out.toolMagnet = (g.toolMagnetUntil || 0) > vnow ? 1 : 0;
    out.difficultyT = g.difficultyT; out.modifier = g.modifier; out.roundTime = g.timeRemaining;
    out.bots = g.bots.map(b => Math.round(b.radius)).join(',');
    out.board = g.objects.length + ':' + g.objects.slice(0, 40).map(o => o.type + Math.round(o.x)).join('|').length;
    // Micro-board: rivals parked in a corner, one bite-sized object.
    g.goldenTimer = 1e9;
    g.bots.forEach((b, i) => { b.x = 60 + i * 12; b.y = 60; });
    p.x = 1500; p.y = 1500; g.keyDir = { x: 0, y: 0 }; g.pointerScreen = null; g.pointerWorld = null;
    p.invulnerableUntil = Infinity;
    const pickable = g.objects.filter(o => !o.eating && g.holeCanEat(p, o)).sort((a, b) => a.radius - b.radius);
    const o = pickable[0];
    g.objects = [o];
    o.x = p.x + 110; o.y = p.y;
    tick(15);
    out.magnetPull = Math.round(110 - Math.hypot(o.x - p.x, o.y - p.y));
    o.x = p.x; o.y = p.y;
    const s0 = p.score, u0 = unitsForRadius(p.radius);
    let comboAt = null;
    tick(90, () => { if (comboAt === null && p.score > s0) comboAt = +g.comboTimer.toFixed(2); });
    out.bitePoints = p.score - s0;
    out.biteGrowth = +(unitsForRadius(p.radius) - u0).toFixed(3);
    out.comboWindow = comboAt;
    // A fixed result: 1st place with 600 points.
    g.bots.forEach(b => { b.score = 0; });
    p.score = 600;
    const xpBefore = g.save.player.xp + 0;
    g.finalizeRun();
    out.coinsEarned = g.adPendingCoins;
    out.xpGained = g.lastXpResult ? g.lastXpResult.gained : null;
    g.state = GameState.MENU;
  } catch (e) { out.error = String(e && e.message || e); }
  performance.now = realNow;
  return out;
};
`;

/** A profile built from the game's own defaultSave(); `legacy` drops the
 *  PX02 economy block, i.e. a save written before D+. */
const PROFILE = `
window.__px02Profile = function (o) {
  o = o || {};
  const s = defaultSave();
  if (o.legacy) delete s.economy;
  const today = new Date().toISOString().slice(0, 10);
  const ids = DISTRICTS.flatMap(d => d.missions).slice(0, o.missions || 0);
  ids.forEach(id => { s.campaign.completed[id] = true; s.campaign.stars[id] = 1; });
  DISTRICTS.forEach((d, i) => { if (i > 0 && s.campaign.completed[DISTRICTS[i - 1].missions[DISTRICTS[i - 1].missions.length - 1]] && !s.campaign.unlockedDistricts.includes(d.id)) s.campaign.unlockedDistricts.push(d.id); });
  s.stats.runsPlayed = o.runsPlayed != null ? o.runsPlayed : 10;
  s.stats.bestArenaScore = 900; s.stats.recentArenaScores = [500, 600, 700, 650, 640];
  s.coins = o.coins || 0; s.prisms = o.prisms || 0;
  s.player = { level: o.level || 1, xp: o.xp || 0 };
  if (o.owned) s.owned = o.owned.slice();
  if (o.selected) s.selected = o.selected;
  if (o.boosters) s.boosters = { ...s.boosters, ...o.boosters };
  if (o.hub) s.hub = o.hub;
  if (o.entitlements) s.entitlements = o.entitlements;
  if (o.auras) s.auras = o.auras;
  s.unlocks.announced = Array.from(new Set([...unlockedFeatureIds(s), 'warsztat', 'wyzwania', 'kampania', 'boosters']));
  s.coach = { moved: true, ate: true, rival: true, danger: true };
  s.login = { lastClaimDate: today, day: 2, totalClaims: 2 };
  s.freeChest = { nextAt: Date.now() + 3600e3, opened: 1 };
  s.privacy = { decided: true, analytics: false, ads: false, ts: 1 };
  if (o.schemaVersion) s.schemaVersion = o.schemaVersion;
  return s;
};
`;

const rawOf = (page, key = KEY) => page.evaluate((k) => localStorage.getItem(k), key);
const diskSave = async (page) => { const r = await rawOf(page); try { return JSON.parse(r); } catch (e) { return null; } };
const sheetTitle = (page) => page.evaluate(() => {
  const el = document.getElementById('infoSheet');
  return el && !el.classList.contains('hidden') ? document.getElementById('infoSheetTitle').textContent : null;
});
const REFUND_TITLE = /Wiry są teraz tylko wyglądem/;
const sansVolatile = (sig) => { const { coinsEarned, xpGained, ...rest } = sig; return rest; };

async function addHelpers(page) {
  await page.addScriptTag({ content: ARENA_BOT });
  await page.addScriptTag({ content: CAMPAIGN_BOT });
  await page.addScriptTag({ content: SIG });
  await page.addScriptTag({ content: PROFILE });
}

/** Opens the game with a profile (an object from __px02Profile options, or
 *  a raw storage string) seeded before the first load. */
async function boot(url, seed, opts = {}) {
  let raw = seed;
  if (seed && typeof seed === 'object') {
    const g0 = await openGame(url);
    await g0.page.addScriptTag({ content: PROFILE });
    raw = await g0.page.evaluate((o) => JSON.stringify(window.__px02Profile(o)), seed);
    await g0.browser.close();
  }
  const g = await openGame(url, { ...opts, save: raw == null ? null : raw });
  await addHelpers(g.page);
  await g.page.waitForTimeout(300);
  g.seedRaw = raw;
  return g;
}

/** A browser context whose storage is seeded once per origin (not per tab),
 *  for reload / second-tab / old-release scenarios. */
async function sharedContext(seedRaw, initScript) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, locale: 'pl-PL' });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await installQaBridge(context);
  if (seedRaw != null) {
    await context.addInitScript((s) => {
      if (!localStorage.getItem('__qaSeededOnce')) { localStorage.setItem('vectorHoleSave_v1', s); localStorage.setItem('__qaSeededOnce', '1'); }
    }, seedRaw);
  }
  if (initScript) await context.addInitScript(initScript);
  const errors = [];
  const open = async (url) => {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
    await page.goto(url);
    await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state !== undefined, null, { timeout: 15000 });
    await waitForQaBridge(page);
    await addHelpers(page);
    await page.waitForTimeout(300);
    return page;
  };
  return { browser, context, open, errors };
}

async function legacyRaw(url, o) {
  const g = await openGame(url);
  await g.page.addScriptTag({ content: PROFILE });
  const raw = await g.page.evaluate((opt) => {
    const s = window.__px02Profile({ ...opt, legacy: true });
    if (opt.mutate === 'v12') { s.schemaVersion = 12; delete s.coach; s.energy = { value: 2, lastTick: Date.now(), infiniteUntil: 0, freeDailyDate: null }; s.campaign.discoveredTypes = ['fragment']; }
    if (opt.mutate === 'badCoins') s.coins = opt.badCoins || '500';
    if (opt.mutate === 'future') { s.schemaVersion = 99; s.seasonPass = { tier: 2 }; }
    return opt.unsealed ? JSON.stringify(s) : sealSave(s);
  }, o);
  await g.browser.close();
  return raw;
}

/** Static server: / = this worktree, /base/ = the previous release. */
function serveWithBase(baseDir) {
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let u = decodeURIComponent(req.url.split('?')[0]);
      let root = ROOT;
      if (u.startsWith('/base/')) { root = baseDir; u = u.slice(5); }
      const file = path.join(root, u === '/' ? 'index.html' : u);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => { const p = server.address().port; resolve({ server, url: `http://127.0.0.1:${p}/index.html`, baseUrl: `http://127.0.0.1:${p}/base/index.html` }); });
  });
}

export async function runPx02Checks(url) {
  const results = [];
  const push = (name, ok, details) => results.push(report(name, ok, details));
  const noErr = (errors, label) => push(`px02: no runtime errors (${label})`, errors.length === 0, errors.slice(0, 3).join(' | '));
  fs.mkdirSync(FIXTURES, { recursive: true });
  const D = 'px02';

  // ===================== ISO-A: campaign progress, coins, XP ====================
  let neutral = null;
  {
    const profiles = [
      ['fresh', { missions: 0, coins: 0, level: 1 }],
      ['10 missions, 1010 coins, LVL 8', { missions: 10, coins: 1010, level: 8, xp: 50 }],
      ['30 missions, 5000 coins, 300 prisms, LVL 20', { missions: 30, coins: 5000, prisms: 300, level: 20 }],
      ['240 missions, 99999 coins, LVL 40', { missions: 240, coins: 99999, prisms: 999, level: 40, boosters: { time: 9, start: 9, magnet: 9, shield: 9, sprint: 9 } }]
    ];
    const sigs = {};
    for (const [label, o] of profiles) {
      const g = await boot(url, o);
      const page = g.page;
      // The real GRAJ button (4th+ round of a career: the old run-tool screen's turn).
      const entry = await page.evaluate(() => {
        const gm = window.game, c0 = gm.save.coins;
        gm.showScreen('mainMenu');
        document.getElementById('btnStart').click();
        const setup = document.getElementById('runSetupScreen');
        const r = { playing: gm.state === GameState.PLAYING, setupShown: !!setup && !setup.classList.contains('hidden'), tools: document.querySelectorAll('.run-tool-card').length, coinsSame: gm.save.coins === c0 };
        gm.running = false; if (gm.rafId) cancelAnimationFrame(gm.rafId); gm.state = GameState.MENU;
        return r;
      });
      push(`ISO-A ${label}: GRAJ starts the round at once (no run-tool screen, nothing for sale, no charge)`, entry.playing && !entry.setupShown && entry.tools === 0 && entry.coinsSame, JSON.stringify(entry));
      sigs[label] = await page.evaluate(() => window.__px02Sig({ seed: 4242 }));
      noErr(g.errors, `ISO-A ${label}`);
      await g.browser.close();
    }
    neutral = sigs.fresh;
    fs.writeFileSync(path.join(OUT, 'px02-sig-neutral.json'), JSON.stringify(neutral, null, 2));
    for (const [label] of profiles.slice(1)) {
      const same = JSON.stringify(sigs[label]) === JSON.stringify(neutral);
      push(`ISO-A ${label}: same Arena parameters on seed 4242 as a fresh profile (size, speed, magnet, shield, bots, board, points, growth, combo, coins/XP for a fixed result)`, same && !neutral.error, same ? JSON.stringify(neutral) : JSON.stringify({ fresh: neutral, profile: sigs[label] }));
    }
    // No Arena advantage can be bought: no run tools in the code or DOM.
    const g = await boot(url, { missions: 30, coins: 99999, prisms: 999 });
    const shop = await g.page.evaluate(() => ({ runTools: typeof RUN_TOOLS !== 'undefined', setupScreen: !!document.getElementById('runSetupScreen'), upsell: !!document.getElementById('resultUpsell'), turboAd: !!AD_PLACEMENTS.turbo_free, confirm: typeof window.game.confirmRunSetup === 'function', upsellFn: typeof window.game.onUpsellClick === 'function' }));
    push('ISO-A no way to buy an Arena advantage: no RUN_TOOLS, run-tool screen, result upsell, turbo_free ad, confirmRunSetup or onUpsellClick', !shop.runTools && !shop.setupScreen && !shop.upsell && !shop.turboAd && !shop.confirm && !shop.upsellFn, JSON.stringify(shop));
    await g.browser.close();
  }

  // ===================== ISO-B: every vortex, Arena / Daily / challenge =========
  {
    const g = await boot(url, { missions: 30, coins: 20000, prisms: 500, level: 10 });
    const page = g.page;
    const r = await page.evaluate(() => {
      const gm = window.game, out = { modes: {}, bought: [], noPerks: SKINS.every(s => !s.perks || !s.perks.length) };
      const modes = { arena: { seed: 4242 }, daily: { seed: 4242, daily: true }, challenge: { seed: 4242, challenge: { score: 500, from: 'QA' } } };
      // 1) the real Warsztat path for every vortex sold for coins.
      gm.openWarsztatScreen();
      for (const sk of SKINS.filter(s => s.price > 0)) {
        gm.onCosmeticPick('skin', sk);
        const btn = document.getElementById('btnInfoSheetAction');
        if (btn && !btn.classList.contains('hidden')) btn.click();
        gm.closeInfoSheet();
        out.bought.push(sk.id + ':' + (gm.save.owned.includes(sk.id) && gm.save.selected === sk.id));
        for (const [m, round] of Object.entries(modes)) (out.modes[m] = out.modes[m] || {})['bought:' + sk.id] = window.__px02Sig(round);
      }
      // 2) every vortex, rewards included, simply equipped.
      for (const sk of SKINS) {
        if (!gm.save.owned.includes(sk.id)) gm.save.owned.push(sk.id);
        gm.save.selected = sk.id;
        for (const [m, round] of Object.entries(modes)) (out.modes[m] = out.modes[m] || {})[sk.id] = window.__px02Sig(round);
      }
      return out;
    });
    push('ISO-B the real Warsztat purchase works for every coin vortex (bought and worn)', r.bought.length === 6 && r.bought.every(b => b.endsWith(':true')), r.bought.join(' '));
    push('ISO-B no vortex carries a perk list any more', r.noPerks, '');
    for (const [m, sigs] of Object.entries(r.modes)) {
      const ref = sigs.rainbow;
      const diff = Object.entries(sigs).filter(([, s]) => JSON.stringify(s) !== JSON.stringify(ref)).map(([id, s]) => id + ' ' + JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(ref[k])))));
      push(`ISO-B ${m}: all ${Object.keys(sigs).length} vortex states (10 vortices + 6 Warsztat purchases) give the neutral vortex's parameters`, diff.length === 0 && !ref.error, diff.length ? diff.join(' | ') : JSON.stringify(ref));
    }
    // Copy: Warsztat and its sheets describe looks only.
    const copy = await page.evaluate(() => {
      const gm = window.game;
      gm.openWarsztatScreen();
      const grid = document.getElementById('skinGrid') ? document.getElementById('skinGrid').innerText : '';
      const head = document.querySelector('.warsztat-preview-labels') ? document.querySelector('.warsztat-preview-labels').innerText : '';
      const sheets = [];
      gm.save.owned = ['rainbow']; gm.save.coins = 0;
      for (const sk of SKINS.filter(s => s.id !== 'rainbow')) { gm.onCosmeticPick('skin', sk); sheets.push(document.getElementById('infoSheetBody').innerText); gm.closeInfoSheet(); }
      return { grid, head, sheets: sheets.join(' || ') };
    });
    const bonusWords = /bonus|prędko|monet za rundę|XP|punktów|mini-magnes|wzrostu|Start od T2|combo/i;
    // "BEZ BONUSU" (the preview label saying there is none) is not a promise.
    const promise = (t) => bonusWords.test(t.replace(/bez bonusu/gi, ''));
    push('ISO-B Warsztat copy: no vortex promises a bonus (grid, preview label, every info sheet)', !promise(copy.grid) && !promise(copy.head) && !promise(copy.sheets), [copy.grid, copy.head, copy.sheets].join(' ## ').replace(/\s+/g, ' ').slice(0, 400));
    noErr(g.errors, 'ISO-B');
    await g.browser.close();
  }

  // ===================== ISO-C: campaign state new / partial / done / missing / broken
  {
    const cases = [['new', { missions: 0 }], ['partly completed', { missions: 37 }], ['finished (240)', { missions: 240 }]];
    for (const [label, o] of cases) {
      const g = await boot(url, o);
      const r = await g.page.evaluate(() => {
        const gm = window.game, out = {};
        gm.showScreen('mainMenu');
        document.getElementById('btnStart').click();
        out.start = gm.state === GameState.PLAYING;
        const res = window.__qaPlayArena({ style: 'greedy', round: undefined });
        out.ended = gm.state === GameState.RESULTS || res.state === GameState.RESULTS;
        gm.endRound && gm.state !== GameState.RESULTS && gm.endRound();
        return out;
      });
      // Replay ("ZAGRAJ JESZCZE RAZ") from the result screen.
      const replay = await g.page.evaluate(async () => {
        const gm = window.game;
        gm.playCount = 0;
        await gm.playAgainFlow();
        const ok = gm.state === GameState.PLAYING;
        gm.running = false; if (gm.rafId) cancelAnimationFrame(gm.rafId);
        return ok;
      });
      const sig = await g.page.evaluate(() => window.__px02Sig({ seed: 4242 }));
      const same = JSON.stringify(sansVolatile(sig)) === JSON.stringify(sansVolatile(neutral));
      push(`ISO-C campaign ${label}: GRAJ, a full round, replay and the round's parameters don't depend on campaign progress`, r.start && r.ended && replay && same, JSON.stringify({ ...r, replay, same }));
      noErr(g.errors, `ISO-C ${label}`);
      await g.browser.close();
    }
    // Missing campaign block (repaired from defaults) and a broken one (SAVE_GUARD 'invalid').
    for (const [label, mutate] of [['missing', 'missing'], ['broken (wrong type)', 'broken']]) {
      const g0 = await openGame(url);
      await g0.page.addScriptTag({ content: PROFILE });
      const raw = await g0.page.evaluate((m) => { const s = window.__px02Profile({ missions: 12 }); if (m === 'missing') delete s.campaign; else s.campaign = 'garbage'; return sealSave(s); }, mutate);
      await g0.browser.close();
      const g = await boot(url, raw);
      const r = await g.page.evaluate(() => {
        const gm = window.game;
        document.getElementById('btnStart').click();
        const start = gm.state === GameState.PLAYING;
        gm.running = false; if (gm.rafId) cancelAnimationFrame(gm.rafId); gm.state = GameState.MENU;
        const res = window.__qaPlayArena({ style: 'greedy' });
        return { start, ended: res.state === GameState.RESULTS, guard: SAVE_GUARD.state };
      });
      const sig = await g.page.evaluate(() => window.__px02Sig({ seed: 4242 }));
      const after = await rawOf(g.page);
      const same = JSON.stringify(sansVolatile(sig)) === JSON.stringify(sansVolatile(neutral));
      const guardOk = mutate === 'broken' ? (r.guard === 'invalid' && after === raw) : true;
      push(`ISO-C campaign ${label}: Arena starts and plays with the neutral parameters${mutate === 'broken' ? '; the held-back save stays byte-identical (no forced reset)' : ''}`, r.start && r.ended && same && guardOk, JSON.stringify({ ...r, same, bytesKept: after === raw }));
      noErr(g.errors, `ISO-C ${label}`);
      await g.browser.close();
    }
  }

  // ===================== ISO-D / BOOST-01..03 ====================================
  {
    const g = await boot(url, { missions: 12, coins: 2000, level: 5 });
    const page = g.page;
    const d = await page.evaluate(async () => {
      const gm = window.game, out = {};
      const camp0 = JSON.stringify(gm.save.campaign), boost0 = JSON.stringify(gm.save.boosters);
      for (let i = 0; i < 3; i++) window.__qaPlayArena({ style: 'greedy' });
      out.campaignSame = JSON.stringify(gm.save.campaign) === camp0;
      out.boostersSame = JSON.stringify(gm.save.boosters) === boost0;
      out.coins = gm.save.coins;
      // A deliberate purchase: the briefing's Magnes bought with Arena-earned coins.
      gm.save.boosters.magnet = 0;
      const c0 = gm.save.coins;
      gm.openMissionBriefing('M05');
      const chip = document.querySelector('#briefingCard [data-booster="magnet"]');
      if (chip) chip.click();
      out.chip = !!chip;
      gm.launchMission('M05');
      if (gm.introPending) gm.beginMissionPlay();
      if (gm.rafId) cancelAnimationFrame(gm.rafId);
      gm.running = false;
      out.paid = c0 - gm.save.coins;
      out.used = !!(gm.mission && gm.mission.boosters && gm.mission.boosters.includes('magnet'));
      gm.leaveCampaignMission();
      gm.state = GameState.MENU;
      return out;
    });
    push('ISO-D 3 Arena rounds change nothing in the campaign (missions, stars, unlocks, boosters)', d.campaignSame && d.boostersSame, JSON.stringify(d));
    push('ISO-D shared coins reach the campaign only through a deliberate purchase (Magnes picked in the briefing: -40 coins, used in the mission)', d.chip && d.paid === 40 && d.used, JSON.stringify(d));
    // BOOST-01: buy (stock), use in a mission, reset -- Arena is unchanged each time.
    const b = await page.evaluate(() => {
      const gm = window.game, out = {};
      out.ref = window.__px02Sig({ seed: 4242 });
      MISSION_BOOSTERS.forEach(x => { gm.save.boosters[x.id] = 5; });
      out.stocked = window.__px02Sig({ seed: 4242 });
      window.__qaPlayMission('M05', { boosters: MISSION_BOOSTERS.map(x => x.id) });
      gm.leaveCampaignMission && gm.mode === 'campaign' && gm.leaveCampaignMission();
      out.afterMission = window.__px02Sig({ seed: 4242 });
      MISSION_BOOSTERS.forEach(x => { gm.save.boosters[x.id] = 0; });
      out.reset = window.__px02Sig({ seed: 4242 });
      return out;
    });
    const sB = (x) => JSON.stringify(sansVolatile(x));
    push('BOOST-01 mission boosters bought, used in a mission (all five) and reset never change Arena parameters', sB(b.stocked) === sB(b.ref) && sB(b.afterMission) === sB(b.ref) && sB(b.reset) === sB(b.ref) && !b.ref.error, JSON.stringify({ ref: b.ref.speed + '/' + b.ref.startRadius, stocked: b.stocked.speed + '/' + b.stocked.startRadius, afterMission: b.afterMission.speed + '/' + b.afterMission.startRadius + '/' + b.afterMission.magnetPull, reset: b.reset.speed }));
    // BOOST-02: Magnes, Sprint, Turbo start, Zegar and Tarcza act in a mission
    // (each one started on its own against a start without boosters).
    const m = await page.evaluate(() => {
      const gm = window.game;
      const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
      let vnow = realNow(); performance.now = () => vnow;
      const step = () => { if (gm.evolutionPending) gm.skipEvolutionOffer(); vnow += 1000 / 30; gm.update(1 / 30); };
      const start = (boosters) => { gm.missionBoosters = boosters; gm.startCampaignMission('M05'); if (gm.introPending) gm.beginMissionPlay(); if (gm.rafId) cancelAnimationFrame(gm.rafId); gm.running = false; };
      // The magnet's own pass (eating would swallow anything in its narrow
      // band first): an eatable entity at 1.35 r, one second of pull.
      const pull = () => {
        const p = gm.player, tier = gm.campaignTierIndex(gm.campaignPlayerTier().id);
        const e = gm.campaignEntities.find(x => !x.consumed && !x.eating && x.live && x.type !== 'gate' && x.type !== 'landmark' && !((x.type === 'node' || x.type === 'pylon') && !x.active) && tier >= x.stats.minTier);
        if (!e) return null;
        const d0 = p.radius * 1.35; e.x = p.x + d0; e.y = p.y;
        for (let i = 0; i < 30; i++) gm.updateMutationEffectsCampaign(1 / 30);
        return +(d0 - Math.hypot(e.x - p.x, e.y - p.y)).toFixed(2);
      };
      const read = (b) => { start(b); const r = { speed: +gm.player.getSpeed().toFixed(3), mult: gm.player.perkSpeedMult || 1, time: gm.mission.timeRemaining, shields: gm.mission.shields || 0, radius: +gm.player.radius.toFixed(2), magnet: gm.activeMutations.has('magnes'), pull: pull() }; return r; };
      const out = { none: read([]) }; gm.leaveCampaignMission();
      for (const id of ['sprint', 'magnet', 'start', 'time', 'shield']) { out[id] = read([id]); if (id === 'sprint') { for (let i = 0; i < 60 * 30 && !gm.mission.ended; i++) step(); out.sprintAfter60s = gm.player.perkSpeedMult; } gm.leaveCampaignMission(); }
      gm.state = GameState.MENU;
      performance.now = realNow;
      out.sprintMult = CONFIG.boosters.sprintMult;
      return out;
    });
    const n0 = m.none;
    const ok2 = Math.abs(m.sprint.speed / n0.speed - m.sprintMult) < 0.01 && m.sprintAfter60s === m.sprintMult
      && m.magnet.magnet && !n0.magnet && m.magnet.pull > (n0.pull || 0) + 1
      && m.start.radius > n0.radius && m.time.time > n0.time && m.shield.shields > n0.shields;
    push('BOOST-02 in a mission: Sprint (+15% for the whole mission), Magnes (pull), Turbo start (T2), Zegar (+time), Tarcza (shields) each act', ok2, JSON.stringify(m));
    // BOOST-03: no Turbo for coins or for an ad after a lost round / in a rematch.
    const t = await page.evaluate(async () => {
      const gm = window.game, out = { rewarded: [], interstitial: 0 };
      const rw = gm.monetization.rewarded.bind(gm.monetization);
      gm.monetization.rewarded = async (pl) => { out.rewarded.push(pl); return rw(pl); };
      gm.save.stats.runsPlayed = 30; gm.save.coins = 5;
      for (const round of [{}, { seed: 4242, daily: true }, { seed: 4242, challenge: { score: 99999, from: 'QA' } }]) {
        const res = window.__qaPlayArena({ style: 'afk', round });
        const up = document.getElementById('resultUpsell');
        const shown = !!up && !up.classList.contains('hidden');
        const k = round.daily ? 'daily' : round.challenge ? 'challenge' : 'arena';
        out[k] = { place: res.place, state: gm.state, upsell: shown, turboText: /TURBO/i.test(document.getElementById('gameOverScreen').innerText) };
        // A player tapping the offer (old releases: Turbo for coins or for an ad).
        if (shown) { await gm.onUpsellClick(); out[k].afterTap = gm.state; gm.running = false; if (gm.rafId) cancelAnimationFrame(gm.rafId); if (gm.state === GameState.PLAYING) { gm.state = GameState.MENU; } }
      }
      const c0 = gm.save.coins;
      gm.playCount = 0;
      await gm.playAgainFlow(); // the friend rematch (lost challenge -> same map)
      out.rematch = { playing: gm.state === GameState.PLAYING, challenge: !!gm.challenge, radius: +gm.player.radius.toFixed(3), shield: gm.shieldCharges || 0, coinsSame: gm.save.coins === c0 };
      gm.running = false; if (gm.rafId) cancelAnimationFrame(gm.rafId);
      out.placements = Object.keys(AD_PLACEMENTS).join(',');
      return out;
    });
    const noTurbo = ['arena', 'daily', 'challenge'].every(k => t[k] && !t[k].upsell && !t[k].turboText) && t.rewarded.length === 0 && !/turbo/.test(t.placements);
    push('BOOST-03 Arena / Daily / friend challenge results: no Turbo offer (coins or ad), no rewarded ad fired; the rematch starts plain', noTurbo && t.rematch.playing && t.rematch.challenge && t.rematch.shield === 0 && t.rematch.coinsSame && t.rematch.radius === neutral.startRadius, JSON.stringify(t));
    push('BOOST-03 campaign Turbo start is still a mission booster', true && (await page.evaluate(() => MISSION_BOOSTERS.some(b => b.id === 'start'))), '');
    noErr(g.errors, 'ISO-D/BOOST');
    await g.browser.close();
  }

  // ===================== LEGACY-01: the full set, 37 coins, white worn ==========
  const L1 = { coins: 37, prisms: 55, level: 9, xp: 120, missions: 14, owned: ['rainbow', 'cyan', 'pink', 'green', 'purple', 'gold', 'white'], selected: 'white',
    boosters: { time: 2, start: 1, magnet: 3, shield: 1, sprint: 2, gift: true, sprintGift: true }, hub: { coreCharge: 40, coreLevel: 3 },
    entitlements: { noAds: true, purchased: ['starter_pack'] }, auras: { owned: ['none', 'starter_glow'], selected: 'starter_glow' } };
  const keep = (s) => s && JSON.stringify({ owned: s.owned, selected: s.selected, prisms: s.prisms, player: s.player, boosters: s.boosters, entitlements: s.entitlements, auras: s.auras, effects: s.effects, overdriveSkins: s.overdriveSkins, campaign: s.campaign, hub: s.hub, stats: s.stats, badges: s.badges, unlocks: s.unlocks, login: s.login, freeChest: s.freeChest, guestId: s.guestId });
  {
    const raw = await legacyRaw(url, L1);
    fs.writeFileSync(path.join(FIXTURES, 'legacy-01-full-set.txt'), raw);
    const orig = JSON.parse(raw);
    const ctx = await sharedContext(raw);
    const page = await ctx.open(url);
    const a = await page.evaluate(() => ({ coins: window.game.save.coins, eco: window.game.save.economy, guard: SAVE_GUARD.state, bak: localStorage.getItem('vectorHoleSave_v1.bak') }));
    const title = await sheetTitle(page);
    const body = await page.evaluate(() => document.getElementById('infoSheetBody').innerText);
    const disk = await diskSave(page);
    push('LEGACY-01 6 paid vortices + 37 coins -> 4907 coins in memory and on disk, marker committed in the same write', a.coins === 4907 && disk.coins === 4907 && disk.economy && disk.economy.looksOnly === 1 && disk.economy.refund === 4870 && a.guard === 'ok', JSON.stringify({ mem: a.coins, disk: disk.coins, eco: disk.economy, guard: a.guard }));
    push('LEGACY-01 everything else kept (vortices owned + white worn, prisms, XP, boosters, purchases, Smuga, missions, Core City, stats, unlocks)', keep(disk) === keep(orig), keep(disk) === keep(orig) ? '' : keep(disk).slice(0, 300));
    push('LEGACY-01 the original pre-D+ bytes are kept under .bak before the commit', a.bak === raw, a.bak ? 'bak ok' : 'no bak');
    push('LEGACY-01 one card explains the change with the amount', REFUND_TITLE.test(title || '') && /4870|4 870/.test(body), `${title} | ${body.replace(/\s+/g, ' ').slice(0, 200)}`);
    // LEGACY-02: two reloads, a second tab opened later.
    await page.evaluate(() => window.game.closeInfoSheet());
    await page.reload(); await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); await page.waitForTimeout(300);
    await page.reload(); await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); await page.waitForTimeout(300);
    const r2 = await page.evaluate(() => ({ coins: window.game.save.coins }));
    const t2 = await sheetTitle(page);
    const tab2 = await ctx.open(url);
    const r3 = await tab2.evaluate(() => ({ coins: window.game.save.coins }));
    const t3 = await sheetTitle(tab2);
    const disk2 = await diskSave(page);
    push('LEGACY-02 two reloads + a second tab: still 4907, the refund and its card come once', r2.coins === 4907 && r3.coins === 4907 && disk2.coins === 4907 && !REFUND_TITLE.test(t2 || '') && !REFUND_TITLE.test(t3 || ''), JSON.stringify({ reload: r2.coins, tab2: r3.coins, disk: disk2.coins, t2, t3 }));
    noErr(ctx.errors, 'LEGACY-01/02');
    await ctx.browser.close();
  }
  // LEGACY-02 race: two tabs both read the pre-D+ save; the second one's commit
  // finds newer bytes (stale writer) -> no second refund, no card there.
  {
    const raw = await legacyRaw(url, L1);
    const ctx = await sharedContext(raw);
    const a = await ctx.open(url);
    // Tab B's loadSave() read sees the old bytes (it read them before tab A
    // committed); every later read (saveGame()'s check) sees storage as it is.
    // (Only the tab's first load: sessionStorage survives the reload below.)
    const inject = `(() => { if (sessionStorage.getItem('__qaRaceOnce')) return; sessionStorage.setItem('__qaRaceOnce', '1'); const LEG = ${JSON.stringify(raw)}; const get = Storage.prototype.getItem; let first = true;
      Storage.prototype.getItem = function (k) { if (first && k === 'vectorHoleSave_v1' && window.name === 'B' && /loadSave/.test(new Error().stack)) { first = false; return LEG; } return get.call(this, k); }; })();`;
    const b = await ctx.context.newPage();
    await b.addInitScript(`window.name = 'B';` + inject);
    await b.goto(url); await b.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); await b.waitForTimeout(400);
    const rb = await b.evaluate(() => ({ coins: window.game.save.coins, guard: SAVE_GUARD.state, eco: window.game.save.economy }));
    const tb = await sheetTitle(b);
    const disk = await diskSave(a);
    push('LEGACY-02 stale writer: a tab that read the old save before another tab committed gets no refund in memory, writes nothing, shows no refund card', rb.coins === 37 && rb.guard === 'stale' && disk.coins === 4907 && !REFUND_TITLE.test(tb || ''), JSON.stringify({ tabB: rb, disk: disk.coins, tb }));
    await b.reload(); await b.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); await b.waitForTimeout(300);
    const rb2 = await b.evaluate(() => window.game.save.coins);
    push('LEGACY-02 that tab after a reload: 4907 (exactly one refund)', rb2 === 4907, String(rb2));
    noErr(ctx.errors, 'LEGACY-02 race');
    await ctx.browser.close();
  }

  // ===================== LEGACY-03: future / corrupt / invalid / unavailable ====
  {
    const fut = await legacyRaw(url, { ...L1, mutate: 'future' });
    const bad = await legacyRaw(url, { ...L1, mutate: 'badCoins' });
    const good = await legacyRaw(url, L1);
    const cut = good.slice(0, Math.floor(good.length * 0.6));
    for (const [label, raw, expect] of [['future (schema 99)', fut, 'future'], ['corrupt (truncated)', cut, 'corrupt'], ['invalid (coins "500")', bad, 'invalid']]) {
      const g = await boot(url, raw);
      const r = await g.page.evaluate(() => ({ coins: window.game.save.coins, guard: SAVE_GUARD.state, looksOnly: window.game.save.economy ? window.game.save.economy.looksOnly : null }));
      const ops = await g.page.evaluate(() => { const gm = window.game; window.__qaPlayArena({ style: 'greedy' }); gm.showScreen('mainMenu'); saveGame(gm.save); return gm.save.coins; });
      const after = await rawOf(g.page);
      const t = await sheetTitle(g.page);
      const refunded = expect === 'invalid' ? r.coins >= 4870 : (expect === 'future' ? r.coins !== 37 : false);
      push(`LEGACY-03 ${label}: bytes untouched after load + a round + autosaves, no refund, no refund card`, after === raw && r.guard === expect && !refunded && !REFUND_TITLE.test(t || ''), JSON.stringify({ ...r, same: after === raw, title: t }));
      if (expect === 'invalid') {
        // The player's explicit repair writes the save (no refund yet: it was not verified); the next load settles once.
        await g.page.evaluate(() => { const gm = window.game; gm.saveGuardShown = null; gm.showSaveGuardNotice('invalid'); document.getElementById('btnInfoSheetAction').click(); });
        const rep = await diskSave(g.page);
        await g.page.reload(); await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); await g.page.waitForTimeout(300);
        const after2 = await g.page.evaluate(() => ({ coins: window.game.save.coins, rescue: localStorage.getItem('vectorHoleSave_v1.rescue') }));
        const disk2 = await diskSave(g.page);
        push('LEGACY-03 invalid -> NAPRAW ZAPIS -> reload: original under .rescue, then exactly one refund on the repaired save', after2.rescue === raw && rep && rep.economy && rep.economy.looksOnly === 0 && disk2.coins === rep.coins + 4870 && after2.coins === disk2.coins, JSON.stringify({ repairedCoins: rep && rep.coins, repairedMarker: rep && rep.economy, final: disk2.coins }));
      }
      noErr(g.errors, `LEGACY-03 ${label}`);
      await g.browser.close();
    }
    const denied = () => { Storage.prototype.getItem = function () { throw new DOMException('denied', 'SecurityError'); }; };
    const g = await boot(url, good, { initScript: denied });
    const r = await g.page.evaluate(() => ({ coins: window.game.save.coins, guard: SAVE_GUARD.state }));
    await g.page.evaluate(() => { window.__qaPlayArena({ style: 'greedy' }); saveGame(window.game.save); });
    const t = await sheetTitle(g.page);
    push('LEGACY-03 unavailable storage: no refund, no write, no refund card', r.guard === 'unavailable' && r.coins < 4870 && !REFUND_TITLE.test(t || ''), JSON.stringify({ ...r, title: t }));
    await g.browser.close();
  }

  // ===================== LEGACY-04: quota during the refund commit =============
  {
    const raw = await legacyRaw(url, L1);
    for (const [label, rule] of [['every write fails', 'all'], ['.bak ok, the save write fails', 'main']]) {
      const quota = `(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) {
        if (localStorage.getItem('__qaQuota') === '1' && (${rule === 'all' ? `/^vectorHoleSave_v1/.test(k)` : `k === 'vectorHoleSave_v1'`})) throw new DOMException('full', 'QuotaExceededError');
        return set.call(this, k, v); }; })();`;
      const ctx = await sharedContext(raw, `if (!localStorage.getItem('__qaQuotaInit')) { localStorage.setItem('__qaQuotaInit', '1'); localStorage.setItem('__qaQuota', '1'); }` + quota);
      const page = await ctx.open(url);
      const r = await page.evaluate(() => ({ coins: window.game.save.coins, looksOnly: (window.game.save.economy || {}).looksOnly, guard: SAVE_GUARD.state }));
      const t = await sheetTitle(page);
      const disk = await rawOf(page);
      // Spending the refund is impossible (it isn't there); a purchase attempt fails for lack of coins.
      const spend = await page.evaluate(() => { const gm = window.game; gm.save.owned = gm.save.owned.filter(id => id !== 'purple'); gm.onCosmeticPick('skin', SKINS.find(s => s.id === 'purple')); const b = document.getElementById('btnInfoSheetAction'); const buyable = /KUP/.test(b.textContent) && !b.classList.contains('hidden'); gm.closeInfoSheet(); gm.save.owned.push('purple'); return buyable; });
      push(`LEGACY-04 quota (${label}): the refund is rolled back in memory (37 coins, marker 0), disk keeps the original bytes, no card, nothing to spend`, r.coins === 37 && r.looksOnly === 0 && disk === raw && !REFUND_TITLE.test(t || '') && !spend, JSON.stringify({ ...r, diskSame: disk === raw, title: t, spend }));
      // Storage frees up mid-session: an autosave writes the unsettled save; the next load refunds once.
      const mid = await page.evaluate(() => { localStorage.setItem('__qaQuota', '0'); const res = window.__qaPlayArena({ style: 'greedy' }); return { coins: window.game.save.coins, earned: res.coinsEarned }; });
      const diskMid = await diskSave(page);
      await page.reload(); await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); await page.waitForTimeout(300);
      const after = await page.evaluate(() => window.game.save.coins);
      const t2 = await sheetTitle(page);
      await page.reload(); await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); await page.waitForTimeout(300);
      const after2 = await page.evaluate(() => window.game.save.coins);
      push(`LEGACY-04 quota (${label}) lifted: the unsettled save is written (marker 0), the next load pays exactly one refund (+card), a further reload nothing`, diskMid && diskMid.economy && diskMid.economy.looksOnly === 0 && diskMid.coins === mid.coins && after === mid.coins + 4870 && after2 === after && REFUND_TITLE.test(t2 || ''), JSON.stringify({ mid, diskMarker: diskMid && diskMid.economy, after, after2, t2 }));
      noErr(ctx.errors, `LEGACY-04 ${label}`);
      await ctx.browser.close();
    }
  }

  // ===================== LEGACY-05: v1 / v5 / v12 -> migration -> refund =======
  {
    const v1 = JSON.stringify({ coins: 50, owned: ['rainbow', 'cyan'], selected: 'cyan' });
    const v5 = JSON.stringify({ schemaVersion: 5, coins: 120, prisms: 3, owned: ['rainbow', 'cyan', 'gold'], selected: 'gold', guestId: 'guest_old5',
      settings: { inputMode: 'thumbpad', sensitivity: 1, haptics: true, minimap: 'auto' }, stats: { runsPlayed: 4 },
      auras: { owned: ['none'], selected: 'none' }, displayName: null, hub: { coreCharge: 10 }, daily: { lastSeedDate: null, lastSeedScore: 0 }, mission: { dateKey: null, completed: false } });
    const v12 = await legacyRaw(url, { ...L1, mutate: 'v12' });
    fs.writeFileSync(path.join(FIXTURES, 'legacy-05-v5.txt'), v5);
    fs.writeFileSync(path.join(FIXTURES, 'legacy-05-v12.txt'), v12);
    for (const [label, raw, coins, check] of [['v1', v1, 150, s => s.selected === 'cyan'], ['v5', v5, 1520, s => s.hub.coreCharge === 10 && s.stats.runsPlayed === 4 && s.prisms === 3 && s.selected === 'gold'], ['v12 (energy era)', v12, 4907, s => !('energy' in s) && Object.keys(s.campaign.completed).length === 14 && s.boosters.magnet === 3 && s.entitlements.noAds]]) {
      const g = await boot(url, raw);
      const r = await g.page.evaluate(() => ({ coins: window.game.save.coins, bak: localStorage.getItem('vectorHoleSave_v1.bak'), guard: SAVE_GUARD.state }));
      const disk = await diskSave(g.page);
      push(`LEGACY-05 ${label} -> v13 -> refund: ${coins} coins, original under .bak, history kept`, r.guard === 'ok' && disk.schemaVersion === 13 && disk.coins === coins && r.coins === coins && r.bak === raw && disk.economy.looksOnly === 1 && check(disk), JSON.stringify({ coins: disk.coins, mem: r.coins, bak: r.bak === raw, eco: disk.economy }));
      noErr(g.errors, `LEGACY-05 ${label}`);
      await g.browser.close();
    }
  }

  // ===================== LEGACY-06: the previous release reads/rewrites =======
  {
    const baseDir = path.join(OUT, 'base-' + BASE_REV.slice(0, 7));
    let haveBase = false;
    try {
      fs.mkdirSync(baseDir, { recursive: true });
      for (const f of ['index.html', 'style.css', 'game.js']) fs.writeFileSync(path.join(baseDir, f), revisionFile(BASE_REV, f));
      haveBase = true;
    } catch (e) { console.log('NOT RUN  LEGACY-06 (previous release not available from git / VH_QA_REVS: ' + e.message.split('\n')[0] + ')'); }
    const sameCode = haveBase && fs.readFileSync(path.join(baseDir, 'game.js'), 'utf8') === fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
    if (haveBase && !sameCode) {
      const { server, url: newUrl, baseUrl } = await serveWithBase(baseDir);
      const raw = await legacyRaw(newUrl, { ...L1, coins: 100, owned: ['rainbow', 'cyan', 'pink', 'green'], selected: 'green' });
      const ctx = await sharedContext(raw);
      const p1 = await ctx.open(newUrl);
      const s1 = await diskSave(p1);
      await p1.close();
      // The old release: reads the settled save, buys Ultrafiolet (800, still with its perk there), plays a round, saves.
      const p2 = await ctx.open(baseUrl);
      const old = await p2.evaluate(() => {
        const gm = window.game;
        const r = { guard: typeof SAVE_GUARD === 'object' ? SAVE_GUARD.state : 'none', eco: gm.save.economy, coins: gm.save.coins };
        gm.onCosmeticPick('skin', SKINS.find(s => s.id === 'purple'));
        const b = document.getElementById('btnInfoSheetAction'); if (b && !b.classList.contains('hidden')) b.click();
        gm.closeInfoSheet();
        window.__qaPlayArena({ style: 'greedy' });
        saveGame(gm.save);
        r.after = gm.save.coins; r.owned = gm.save.owned.join(',');
        return r;
      });
      const s2 = await diskSave(p2);
      await p2.close();
      const p3 = await ctx.open(newUrl);
      const s3 = await p3.evaluate(() => ({ coins: window.game.save.coins, eco: window.game.save.economy }));
      const t3 = await sheetTitle(p3);
      push('LEGACY-06 the settled save (870 coins) is read by 5db3b02 without a guard block and the marker survives its rewrite', s1.coins === 870 && old.guard === 'ok' && old.eco && old.eco.looksOnly === 1 && s2.economy && s2.economy.looksOnly === 1 && s2.economy.refund === 770, JSON.stringify({ first: s1.coins, old, oldDisk: s2.economy }));
      push('LEGACY-06 back on the new code: no second refund (also none for the vortex bought on the old release), no card', s3.coins === s2.coins && s3.eco.looksOnly === 1 && s3.eco.refund === 770 && !REFUND_TITLE.test(t3 || '') && /purple/.test(old.owned), JSON.stringify({ oldDisk: s2.coins, now: s3.coins, t3 }));
      noErr(ctx.errors, 'LEGACY-06');
      await ctx.browser.close();
      server.close();
    } else if (sameCode) console.log('NOT RUN  LEGACY-06 (running on the previous release itself)');
  }

  // ===================== LEGACY-07: policy cases ===============================
  {
    // A brand-new profile is born settled: buying a vortex later is never refunded.
    const ctx = await sharedContext(null);
    const p = await ctx.open(url);
    const fresh = await p.evaluate(() => {
      const gm = window.game;
      const r = { eco: JSON.stringify(gm.save.economy) };
      gm.save.coins = 300; saveGame(gm.save);
      gm.onCosmeticPick('skin', SKINS.find(s => s.id === 'cyan'));
      const b = document.getElementById('btnInfoSheetAction'); b.click(); gm.closeInfoSheet();
      r.coins = gm.save.coins;
      return r;
    });
    await p.reload(); await p.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); await p.waitForTimeout(300);
    const fr = await p.evaluate(() => ({ coins: window.game.save.coins, owned: window.game.save.owned.join(',') }));
    push('LEGACY-07 new profile: born settled; a vortex bought after D+ (cyan, 100) is never refunded', /"looksOnly":1/.test(fresh.eco) && fresh.coins === 200 && fr.coins === 200 && /cyan/.test(fr.owned), JSON.stringify({ fresh, reload: fr }));
    await ctx.browser.close();
    for (const [label, o, coins] of [
      ['some paid vortices (cyan + green)', { coins: 10, owned: ['rainbow', 'cyan', 'green'], selected: 'cyan' }, 560],
      ['reward vortices only (Aurora, Kryształ, Pryzmat: kept, no money)', { coins: 10, owned: ['rainbow', 'aurora', 'krysztal', 'pryzmat'], selected: 'pryzmat' }, 10],
      ['an unknown / removed vortex id', { coins: 10, owned: ['rainbow', 'legacy_blue', 'cyan'], selected: 'cyan' }, 110]
    ]) {
      const raw = await legacyRaw(url, o);
      const g = await boot(url, raw);
      const r = await g.page.evaluate(() => ({ coins: window.game.save.coins, owned: window.game.save.owned.join(','), selected: window.game.save.selected }));
      const t = await sheetTitle(g.page);
      const disk = await diskSave(g.page);
      const card = coins > o.coins;
      push(`LEGACY-07 ${label}: ${coins} coins, vortices kept, card ${card ? 'once' : 'none'}`, r.coins === coins && disk.coins === coins && r.owned === o.owned.join(',') && r.selected === o.selected && REFUND_TITLE.test(t || '') === card && disk.economy.looksOnly === 1, JSON.stringify({ ...r, disk: disk.coins, title: t }));
      noErr(g.errors, `LEGACY-07 ${label}`);
      await g.browser.close();
    }
    // A vortex bought while the line is not settled yet (a held-back save played
    // from memory) is a purchase after D+: repaired + reloaded, only the
    // historical vortex is refunded.
    {
      const raw = await legacyRaw(url, { owned: ['rainbow', 'green'], selected: 'green', mutate: 'badCoins', badCoins: '900' });
      const g = await boot(url, raw);
      const r = await g.page.evaluate(() => {
        const gm = window.game, out = { guard: SAVE_GUARD.state, coins0: gm.save.coins };
        gm.closeInfoSheet();
        gm.openWarsztatScreen();
        gm.onCosmeticPick('skin', SKINS.find(s => s.id === 'cyan'));
        document.getElementById('btnInfoSheetAction').click();
        out.bought = gm.save.owned.includes('cyan'); out.after = (gm.save.economy.boughtAfter || []).join(',');
        gm.saveGuardShown = null; gm.showSaveGuardNotice('invalid'); document.getElementById('btnInfoSheetAction').click();
        return out;
      });
      const rep = await diskSave(g.page);
      await g.page.reload(); await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); await g.page.waitForTimeout(300);
      const fin = await diskSave(g.page);
      push('LEGACY-07 a paid vortex bought on a not-yet-settled line (held-back save, then NAPRAW ZAPIS) is never refunded; the historical one is (900 - 100 + 450)', r.guard === 'invalid' && r.coins0 === 900 && r.bought && r.after === 'cyan' && rep.economy.looksOnly === 0 && fin.coins === 1250 && fin.economy.refund === 450 && fin.owned.includes('cyan'), JSON.stringify({ ...r, repaired: rep.coins, final: fin.coins, eco: fin.economy }));
      noErr(g.errors, 'LEGACY-07 bought while unsettled');
      await g.browser.close();
    }
    // Dev test mode: a copy of a pre-D+ real save settles only in the sandbox slot.
    {
      const raw = await legacyRaw(url, { coins: 10, owned: ['rainbow', 'cyan'], selected: 'cyan' });
      const ctx2 = await sharedContext(raw, `localStorage.setItem('vectorHoleDevAccess_v1', ${JSON.stringify(devCodeToken('dev'))});`);
      const page = await ctx2.open(url);
      const realAfterBoot = await rawOf(page);
      await page.evaluate(() => { window.game.devPanel.open(); const t = document.querySelector('#devPanel [data-tab="data"]'); if (t) t.click(); const b = document.querySelector('#devPanel [data-act="sandbox-copy"]'); if (b) b.click(); });
      await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.devPanel && DEV.sandbox, null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(300);
      const sb = await page.evaluate(() => ({ sandbox: DEV.sandbox, coins: window.game.save.coins, sandboxDisk: localStorage.getItem(DEV_SANDBOX_SAVE_KEY) }));
      const realNow = await rawOf(page);
      const sbDisk = sb.sandboxDisk ? JSON.parse(sb.sandboxDisk) : null;
      push('LEGACY-07 dev test mode: the real save is settled once on the real slot; the sandbox copy carries that state (no second refund), the real bytes are untouched by test mode', sb.sandbox && JSON.parse(realAfterBoot).coins === 110 && realNow === realAfterBoot && sbDisk && sbDisk.coins === 110 && sb.coins === 110, JSON.stringify({ sandbox: sb.sandbox, realCoins: JSON.parse(realAfterBoot).coins, sbCoins: sbDisk && sbDisk.coins, mem: sb.coins, realSame: realNow === realAfterBoot }));
      noErr(ctx2.errors, 'LEGACY-07 dev');
      await ctx2.browser.close();
    }
  }

  // ===================== LEGACY-08: cloud copy / backup code / re-adoption =====
  {
    const mockCrazy = (store) => `
      window.__cgStore = ${JSON.stringify(store || {})};
      window.CrazyGames = { SDK: { init: async () => {},
        game: { gameplayStart() {}, gameplayStop() {}, loadingStop() {}, happytime() {} },
        ad: { requestAd: (t, cb) => { cb && cb.adFinished && cb.adFinished(); } },
        data: { getItem: k => (k in __cgStore ? __cgStore[k] : null), setItem: (k, v) => { __cgStore[k] = v; }, removeItem: k => { delete __cgStore[k]; } } } };`;
    const cloudBoot = async (local, remote) => {
      const g = await boot(url, local, { query: '?portal=crazygames', initScript: mockCrazy({ [KEY]: remote }) });
      await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.monetization.provider === 'crazygames', null, { timeout: 10000 }).catch(() => {});
      await g.page.waitForTimeout(600);
      return g;
    };
    const legacy = await legacyRaw(url, L1);
    // (a) delayed cloud: the account still has the same pre-D+ save.
    {
      const g = await cloudBoot(legacy, legacy);
      const r = await g.page.evaluate((k) => ({ coins: window.game.save.coins, cloud: JSON.parse(__cgStore[k]) }), KEY);
      push('LEGACY-08a delayed cloud copy (same pre-D+ save): one refund, the settled save is mirrored up', r.coins === 4907 && r.cloud.coins === 4907 && r.cloud.economy.looksOnly === 1, JSON.stringify({ coins: r.coins, cloud: r.cloud.coins }));
      await g.browser.close();
    }
    // (b) this device settled; the account holds a pre-D+ save with more progress (another device).
    {
      const settled = await (async () => { const g = await boot(url, legacy); const s = await rawOf(g.page); await g.browser.close(); return s; })();
      const ahead = await legacyRaw(url, { ...L1, coins: 500, missions: 40, level: 15 });
      const g = await cloudBoot(settled, ahead);
      const r = await g.page.evaluate((k) => ({ coins: window.game.save.coins, level: window.game.save.player.level, cloud: JSON.parse(__cgStore[k]) }), KEY);
      const disk = await diskSave(g.page);
      const t = await sheetTitle(g.page);
      push('LEGACY-08b account copy ahead and pre-D+: it replaces this line and gets its own single refund (500 + 4870), mirrored, with the card', r.level === 15 && r.coins === 5370 && disk.coins === 5370 && r.cloud.coins === 5370 && r.cloud.economy.looksOnly === 1 && REFUND_TITLE.test(t || ''), JSON.stringify({ coins: r.coins, disk: disk.coins, cloud: r.cloud.coins, t }));
      await g.browser.close();
    }
    // (c) this device pre-D+; the account holds a settled save with more progress.
    {
      const aheadSettled = await (async () => { const raw = await legacyRaw(url, { ...L1, coins: 500, missions: 40, level: 15 }); const g = await boot(url, raw); const s = await rawOf(g.page); await g.browser.close(); return s; })();
      const g = await cloudBoot(legacy, aheadSettled);
      const r = await g.page.evaluate(() => ({ coins: window.game.save.coins, level: window.game.save.player.level }));
      push('LEGACY-08c account copy ahead and already settled: adopted as is, no further refund', r.level === 15 && r.coins === 5370, JSON.stringify(r));
      await g.browser.close();
    }
    // (d) a backup code made before D+, loaded twice on a settled device.
    {
      const code = await (async () => { const g = await openGame(url); const c = await g.page.evaluate((raw) => 'VH1.' + btoa(unescape(encodeURIComponent(raw))), legacy); await g.browser.close(); return c; })();
      const settled = await (async () => { const raw = await legacyRaw(url, { coins: 9000, owned: ['rainbow'], missions: 3, level: 2 }); const g = await boot(url, raw); const s = await rawOf(g.page); await g.browser.close(); return s; })();
      const g = await boot(url, settled);
      const r = await g.page.evaluate((c) => {
        const gm = window.game, out = {};
        for (let i = 0; i < 2; i++) {
          gm.closeInfoSheet();
          gm.openBackupLoad(); document.getElementById('backupInput').value = c; document.getElementById('btnInfoSheetAction').click();
          const act = document.getElementById('btnInfoSheetAction'); if (/MIMO TO/.test(act.textContent) && !act.classList.contains('hidden')) act.click();
          out['coins' + i] = gm.save.coins; out['disk' + i] = JSON.parse(localStorage.getItem('vectorHoleSave_v1')).coins;
        }
        return out;
      }, code);
      push('LEGACY-08d a pre-D+ backup code: that state gets one refund (37 + 4870); loading the same code again gives the same state, not a second refund', r.coins0 === 4907 && r.disk0 === 4907 && r.coins1 === 4907 && r.disk1 === 4907, JSON.stringify(r));
      await g.browser.close();
    }
    // (e) re-adopting a save object that is already settled changes nothing.
    {
      const g = await boot(url, legacy);
      const r = await g.page.evaluate(() => { const gm = window.game; const copy = JSON.parse(JSON.stringify(gm.save)); gm.adoptSave(copy, 'backup'); gm.adoptSave(JSON.parse(JSON.stringify(gm.save)), 'backup'); return gm.save.coins; });
      push('LEGACY-08e re-adopting an already settled save twice: no further refund', r === 4907, String(r));
      await g.browser.close();
    }
  }

  results.push(...await runPx02ReviewChecks(url));
  return results;
}

/** PX02 review fixes (GPT audit): a write that fails is never shown as done.
 *  LEGACY-09 -- the refund card's "seen" mark; LEGACY-10 -- a backup code or a
 *  cloud copy adopted while storage refuses the write; UX-01 -- the Warsztat
 *  title next to a big wallet on phones. */
export async function runPx02ReviewChecks(url) {
  const results = [];
  const push = (name, ok, details) => results.push(report(name, ok, details));
  const noErr = (errors, label) => push(`px02: no runtime errors (${label})`, errors.length === 0, errors.slice(0, 3).join(' | '));
  const L1 = { coins: 37, prisms: 55, level: 9, xp: 120, missions: 14, owned: ['rainbow', 'cyan', 'pink', 'green', 'purple', 'gold', 'white'], selected: 'white' };
  const events = (page) => page.evaluate(() => window.game.analytics.queue.map(e => e.name || e.event || e.type).filter(Boolean));

  // LEGACY-09: the refund is stored, then the write that marks its card as
  // seen fails -> no card, no "done" event; the next start shows it once and
  // pays nothing again.
  {
    const raw = await legacyRaw(url, L1);
    // Every write of the save key after the first one fails until lifted.
    const ackFails = `(() => { const set = Storage.prototype.setItem; let n = 0;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'vectorHoleSave_v1' && localStorage.getItem('__qaAckFail') === '1' && n++ >= 1) throw new DOMException('full', 'QuotaExceededError');
        return set.call(this, k, v); }; })();`;
    const ctx = await sharedContext(raw, `if (!localStorage.getItem('__qaAckInit')) { localStorage.setItem('__qaAckInit', '1'); localStorage.setItem('__qaAckFail', '1'); }` + ackFails);
    const page = await ctx.open(url);
    const a = await page.evaluate(() => ({ coins: window.game.save.coins, eco: window.game.save.economy }));
    const t1 = await sheetTitle(page);
    const ev1 = await events(page);
    const d1 = await diskSave(page);
    push('LEGACY-09 refund stored but its "seen" mark fails to save: no card, no refund event, the card stays pending (memory and disk)',
      d1.coins === 4907 && d1.economy.looksOnly === 1 && d1.economy.notice === true && a.eco.notice === true && !REFUND_TITLE.test(t1 || '') && !ev1.includes('looks_only_refund'),
      JSON.stringify({ mem: a, disk: d1.economy, title: t1, refundEvent: ev1.includes('looks_only_refund') }));
    await page.evaluate(() => localStorage.setItem('__qaAckFail', '0'));
    await page.reload(); await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); await page.waitForTimeout(300);
    const t2 = await sheetTitle(page);
    const ev2 = await events(page);
    const d2 = await diskSave(page);
    const c2 = await page.evaluate(() => window.game.save.coins);
    await page.reload(); await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state); await page.waitForTimeout(300);
    const t3 = await sheetTitle(page);
    const c3 = await page.evaluate(() => window.game.save.coins);
    push('LEGACY-09 after a reload with working storage: the card shows once (event logged, mark saved), no second refund; the next reload shows nothing',
      REFUND_TITLE.test(t2 || '') && ev2.includes('looks_only_refund') && d2.economy.notice === false && c2 === 4907 && d2.coins === 4907 && !REFUND_TITLE.test(t3 || '') && c3 === 4907,
      JSON.stringify({ t2, disk: d2.economy, c2, t3, c3 }));
    noErr(ctx.errors, 'LEGACY-09');
    await ctx.browser.close();
  }

  // LEGACY-10: a backup code adopted while the write fails (quota, another tab)
  // never says "Postęp wczytany"; once storage works the same code loads for real.
  {
    const code = await (async () => { const raw = await legacyRaw(url, L1); return 'VH1.' + Buffer.from(raw, 'utf8').toString('base64'); })();
    const local = await (async () => { const r = await legacyRaw(url, { coins: 9000, owned: ['rainbow'], missions: 3, level: 2 }); const g = await boot(url, r); const s = await rawOf(g.page); await g.browser.close(); return s; })();
    const load = (c) => {
      const gm = window.game;
      gm.closeInfoSheet();
      gm.openBackupLoad(); document.getElementById('backupInput').value = c; document.getElementById('btnInfoSheetAction').click();
      const act = document.getElementById('btnInfoSheetAction');
      if (/MIMO TO/.test(act.textContent) && !act.classList.contains('hidden')) act.click();
      const sheet = document.getElementById('infoSheet');
      return { title: sheet.classList.contains('hidden') ? null : document.getElementById('infoSheetTitle').textContent, coins: gm.save.coins, guard: SAVE_GUARD.state };
    };
    for (const [label, how] of [['quota', 'quota'], ['another tab wrote first (stale)', 'stale']]) {
      const quota = `(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/^vectorHoleSave_v1/.test(k) && window.__qaQuota) throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); }; })();`;
      const g = await boot(url, local, { initScript: quota });
      const before = await rawOf(g.page);
      if (how === 'quota') await g.page.evaluate(() => { window.__qaQuota = true; });
      else await g.page.evaluate(() => { const s = JSON.parse(localStorage.getItem('vectorHoleSave_v1')); s.coins = 9001; localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)); });
      const expectDisk = await rawOf(g.page);
      const r = await g.page.evaluate(load, code);
      const after = await rawOf(g.page);
      const ev = await events(g.page);
      push(`LEGACY-10 backup code while the write fails (${label}): no "Postęp wczytany", the player is told it is not saved; storage untouched; no refund card`,
        r.title !== 'Postęp wczytany' && /bez zapisu/i.test(r.title || '') && after === expectDisk && !REFUND_TITLE.test(r.title || ''),
        JSON.stringify({ ...r, diskUntouched: after === expectDisk, baseline: before === expectDisk ? 'same' : 'changed by the other tab' }));
      if (how === 'quota') {
        await g.page.evaluate(() => { window.__qaQuota = false; });
        const r2 = await g.page.evaluate(load, code);
        const d2 = await diskSave(g.page);
        push('LEGACY-10 storage works again: the same code loads for real ("Postęp wczytany"), stored with exactly one refund (37 + 4870)',
          r2.title === 'Postęp wczytany' && d2.coins === 4907 && d2.economy.looksOnly === 1 && r2.coins === 4907, JSON.stringify({ ...r2, disk: d2.coins }));
      }
      noErr(g.errors, `LEGACY-10 ${label}`);
      await g.browser.close();
    }
    // A cloud copy adopted at start while the write fails: nothing claims a restore or a refund.
    {
      const mockCrazy = (store) => `window.__cgStore = ${JSON.stringify(store)}; window.CrazyGames = { SDK: { init: async () => {}, game: { gameplayStart() {}, gameplayStop() {}, loadingStop() {}, happytime() {} }, ad: { requestAd: (t, cb) => { cb && cb.adFinished && cb.adFinished(); } }, data: { getItem: k => (k in __cgStore ? __cgStore[k] : null), setItem: (k, v) => { __cgStore[k] = v; }, removeItem: k => { delete __cgStore[k]; } } } };`;
      const ahead = await legacyRaw(url, { ...L1, coins: 500, missions: 40, level: 15 });
      // Writes start failing once the page has booted (before the cloud copy arrives).
      const failLater = `(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/^vectorHoleSave_v1/.test(k) && window.__qaQuota) throw new DOMException('full', 'QuotaExceededError'); return set.call(this, k, v); }; })();`;
      const g = await boot(url, local, { query: '?portal=crazygames', initScript: mockCrazy({ [KEY]: ahead }) + failLater + `document.addEventListener('DOMContentLoaded', () => { window.__qaQuota = true; });` });
      await g.page.waitForTimeout(800);
      const r = await g.page.evaluate((k) => ({ coins: window.game.save.coins, level: window.game.save.player.level, cloudSame: __cgStore[k], disk: localStorage.getItem(k) }), KEY);
      const t = await sheetTitle(g.page);
      push('LEGACY-10 cloud copy adopted while the local write fails: no refund kept in memory, no refund card, nothing mirrored, local bytes untouched',
        !REFUND_TITLE.test(t || '') && r.coins < 4870 && r.cloudSame === ahead && r.disk === local,
        JSON.stringify({ coins: r.coins, level: r.level, title: t, cloudUntouched: r.cloudSame === ahead, localUntouched: r.disk === local }));
      noErr(g.errors, 'LEGACY-10 cloud');
      await g.browser.close();
    }
  }

  // UX-01: the Warsztat title is not cut next to the wallet on phones.
  {
    const rows = [];
    for (const w of [375, 360, 320]) for (const coins of [2587, 4870, 10000]) {
      const g = await openGame(url, { viewport: { width: w, height: 667 } });
      await g.page.addScriptTag({ content: PROFILE });
      const r = await g.page.evaluate(({ coins }) => {
        const s = window.__px02Profile({ coins, prisms: 55, missions: 6 });
        localStorage.setItem('vectorHoleSave_v1', sealSave(s));
        return true;
      }, { coins });
      await g.page.reload(); await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
      const m = await g.page.evaluate(() => {
        const gm = window.game; gm.closeInfoSheet(); gm.openWarsztatScreen(); gm.updateCoinDisplays();
        const t = document.querySelector('#shopScreen .app-title'), gear = document.querySelector('#shopScreen .hub-gear-btn');
        const coinsEl = document.getElementById('coinCountShop');
        return { cut: t.scrollWidth > t.clientWidth + 1, gear: gear.getBoundingClientRect().right <= innerWidth, coins: coinsEl.textContent, page: document.documentElement.scrollWidth <= innerWidth };
      });
      rows.push({ w, coins, ...m });
      await g.browser.close();
    }
    const bad = rows.filter(r => r.cut || !r.gear || !r.page);
    push('UX-01 Warsztat at 375/360/320 px with 2587, 4870 and 10000 coins: title not cut, wallet and gear on screen, no sideways scroll', bad.length === 0, JSON.stringify(bad.length ? bad : rows.map(r => `${r.w}:${r.coins}`)));
  }
  return results;
}

if (process.argv[1] && process.argv[1].endsWith('px02-isolation.mjs')) {
  const { server, url } = await serve();
  const results = process.argv.includes('--review') ? await runPx02ReviewChecks(url) : await runPx02Checks(url);
  server.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} PX02 checks passed`);
  process.exit(failed.length ? 1 : 0);
}
