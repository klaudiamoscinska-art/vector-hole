// CG-PREVIEW-QA-1 R5: the fifth round of CrazyGames Preview reports on the real package
// (tools/export-crazygames-basic.mjs) with qa/cg-sdk-mock.js, and the web build.
//   node qa/cg-preview-qa5.mjs [--root=DIR] [--only=step,...]
//   --root: the game to test (e.g. a base checkout).
// R5-01: a district tile's NEXT / NOW chip never touches its name (one or two lines), on every
//   district, PL and EN, PC, CrazyGames and phone frames; the district logic is unchanged.
// R5-03: the Arena's Magnes card: strength and reach as configured (160 / 90), what it does at
//   each hole size, and that the player can now see it (range ring, streaks, a ripple at the pick).
// R5-04: a language switch right after a save, for a signed-in player whose save reaches the
//   account late (the mock's cloudDebounceMs): the Daily Reward does not come back and is paid
//   once, a finished round's coins stay, a bad or older handed-over save is ignored.
// Mock results are not CrazyGames Preview results.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, serve, installQaBridge, report, OUT, ROOT, isMain, CG_SDK_URL, CG_SDK_MOCK, QA_RANDOM, veteranSave } from './lib.mjs';
import { exportPackage } from '../tools/export-crazygames-basic.mjs';

let WORK = path.join(OUT, 'cg-preview-qa5');
let browser = null;
const settle = (ms = 250) => new Promise(r => setTimeout(r, ms));
const SAVE_KEY = 'vectorHoleSave_v1', HANDOFF = 'vectorHoleLangSwitchSave';

export const TILE_FRAMES = [
  [1920, 1080, 'PC 1920x1080'], [1536, 864, 'PC 125%'], [1366, 768, 'PC 1366x768'], [1280, 720, 'PC 150%'], [2560, 1440, 'PC QHD'],
  [1060, 596, 'CrazyGames desktop'], [800, 450, 'CrazyGames mobile'], [640, 360, 'small landscape'],
  [375, 667, 'phone 375x667'], [390, 844, 'phone 390x844'], [844, 390, 'phone landscape'], [820, 1180, 'tablet']
];

async function context({ mock = { mode: 'sdk' }, viewport = { width: 1280, height: 720 }, locale = 'en-US' } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale });
  await installQaBridge(ctx);
  await ctx.addInitScript(`window.__cgMock = ${JSON.stringify(mock)};`);
  await ctx.addInitScript(QA_RANDOM);
  const errors = [];
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await ctx.route(CG_SDK_URL, (r) => r.fulfill({ contentType: 'text/javascript', body: CG_SDK_MOCK }));
  const ready = (p) => p.waitForFunction(() => window.game && window.game.state !== undefined && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 40000 });
  const open = async (url) => {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    await page.goto(url);
    await ready(page);
    await settle(400);
    return page;
  };
  return { ctx, open, ready, errors, close: () => ctx.close() };
}

/* ---------- R5-01: the chip and the district name ---------- */
async function tileChecks(pkgUrl) {
  const r = [];
  fs.mkdirSync(path.join(WORK, 'shots'), { recursive: true });
  for (const lang of ['pl', 'en']) {
    const bad = [];
    let tiles = 0, frames = 0, statusLost = 0, sameLogic = true;
    const c = await context({});
    const page = await c.open(pkgUrl);
    await page.evaluate(async (lang) => {
      if (lang === 'pl') { window.game.save.settings.lang = 'pl'; }
      window.game.setLanguage(lang);
    }, lang).catch(() => {});
    await settle(600); await c.ready(page); await settle(300);
    for (const [w, h, label] of TILE_FRAMES) {
      await page.setViewportSize({ width: w, height: h });
      await settle(250);
      frames++;
      const res = await page.evaluate(async () => {
        const g = window.game, out = [];
        let names = 0;
        for (let k = 0; k < DISTRICTS.length; k++) {
          const s = sanitizeSave(JSON.parse(JSON.stringify(g.save)));
          s.campaign.completed = {};
          DISTRICTS.slice(0, k).forEach(d => d.missions.forEach(id => { s.campaign.completed[id] = true; }));
          s.campaign.unlockedDistricts = DISTRICTS.slice(0, k + 1).map(d => d.id);
          g.save = s;
          g.openCampaignScreen();
          await new Promise(x => setTimeout(x, 30));
          for (const t of document.querySelectorAll('#campaignScreen .district-tile')) {
            const chip = t.querySelector('.district-tile-chip');
            const name = t.querySelector('.district-node-name');
            const status = t.querySelector('.district-node-status');
            if (!chip) continue;
            // GG-UI-02: on a phone the tile carries no status line (so no chip) -- the frame, the number and the
            // state mark say it. There the same question is asked of those marks: nothing over the name, the text inside its tile.
            if (getComputedStyle(status).display === 'none') {
              const T = t.getBoundingClientRect(), info = t.querySelector('.district-tile-info').getBoundingClientRect(), rg = document.createRange(); rg.selectNodeContents(name);
              const b = rg.getBoundingClientRect(), marks = [...t.querySelectorAll('.u2-num, .u2-state')].map(m => m.getBoundingClientRect());
              const framed = t.classList.contains('next-up') ? getComputedStyle(t).borderTopStyle === 'dashed' : t.classList.contains('current');
              names++;
              out.push({ n: name.textContent, chip: chip.textContent + ' (marks)', hit: marks.some(a => a.left < b.right && b.left < a.right && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5), chipIn: marks.length === 2 && marks.every(a => a.width > 0 && a.left >= T.left - 0.5 && a.right <= T.right + 0.5 && a.top >= T.top - 0.5 && a.bottom <= T.bottom + 0.5), infoIn: info.top >= T.top - 0.5, statusFits: framed, wrong: t.classList.contains('next-up') !== chip.classList.contains('next') });
              continue;
            }
            const a = chip.getBoundingClientRect(), b = name.getBoundingClientRect(), T = t.getBoundingClientRect(), info = t.querySelector('.district-tile-info').getBoundingClientRect();
            const hit = a.left < b.right && b.left < a.right && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
            names++;
            out.push({ n: name.textContent, chip: chip.textContent, hit, chipIn: a.left >= T.left - 0.5 && a.right <= T.right + 0.5 && a.top >= T.top - 0.5 && a.bottom <= T.bottom + 0.5, infoIn: info.top >= T.top - 0.5, statusFits: a.right <= status.getBoundingClientRect().right + 0.5 && status.scrollWidth <= status.clientWidth + 0.5,
              wrong: t.classList.contains('next-up') !== chip.classList.contains('next') });
          }
        }
        return { out, names };
      });
      tiles += res.names;
      for (const o of res.out) {
        if (o.hit || !o.chipIn || !o.infoIn || !o.statusFits) bad.push(`${label}: ${o.n}/${o.chip}${o.hit ? ' overlaps the name' : ''}${o.chipIn ? '' : ' chip outside'}${o.infoIn ? '' : ' text cut'}${o.statusFits ? '' : ' status clipped'}`);
        if (o.wrong) sameLogic = false;
      }
      if (label === 'PC 1920x1080' || label === 'phone 375x667') {
        await page.evaluate(() => { const g = window.game; const s = sanitizeSave(JSON.parse(JSON.stringify(g.save))); s.campaign.completed = {}; s.campaign.unlockedDistricts = [DISTRICTS[0].id]; g.save = s; g.openCampaignScreen(); });
        await settle(200);
        await page.screenshot({ path: path.join(WORK, 'shots', `r5-01-${lang}-${w}x${h}.png`) });
      }
    }
    void statusLost;
    r.push(report(`[package ${lang.toUpperCase()}] R5-01 every NEXT/NOW chip clear of its name and inside its tile (${tiles} chips, ${frames} frames, every district current in turn)`, bad.length === 0 && tiles > 0 && !c.errors.length, [...new Set(bad)].slice(0, 12).join(' | ') + (c.errors.length ? ' errors: ' + c.errors.slice(0, 3).join(' ') : '')));
    r.push(report(`[package ${lang.toUpperCase()}] R5-01 the logic is the same: exactly the next locked district carries NEXT`, sameLogic));
    await c.close();
  }
  return r;
}

/* ---------- R5-03: Magnes ---------- */
async function magnetChecks(pkgUrl) {
  const r = [];
  const c = await context({});
  const page = await c.open(pkgUrl);
  const res = await page.evaluate(async () => {
    const g = window.game;
    const s = defaultSave(); s.stats.runsPlayed = 3; s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
    g.save = sanitizeSave(s); g.bootFirstRun = false;
    g.startRound({ seed: 4242 });
    g.evolutionPace = null;
    const out = { config: { R: CONFIG.evolution.magnetRadius, pull: CONFIG.evolution.magnetPull }, rows: [] };
    g.paused = true; // only the calls below move anything
    // Before the card: no pull
    const food = g.objects.find(o => g.holeCanEat(g.player, o));
    g.player.setRadius(30);
    food.x = g.player.x + 70; food.y = g.player.y;
    const x0 = food.x; g.updateMutationEffects(1 / 60); out.noCard = food.x - x0;
    // The real pick
    const ripples = g.ripples.length;
    g.evolutionPending = true;
    g.pickMutation('magnet_pulse');
    out.active = g.magnetUntil === Infinity;
    out.ripple = g.ripples.length === ripples + 1 ? { start: g.ripples.at(-1).startRadius, end: g.ripples.at(-1).endRadius } : null;
    for (const [radius, d] of [[30, 60], [46, 80], [66, 90], [90, 120], [118, 140], [150, 158], [170, 200]]) {
      g.player.setRadius(radius);
      const target = g.objects.find(o => !o.eating && g.holeCanEat(g.player, o));
      if (!target) { out.rows.push({ radius, none: true }); continue; }
      target.x = g.player.x + d; target.y = g.player.y;
      const dist = (a, b, c, e) => Math.hypot(a - c, b - e);
      const start = dist(g.player.x, g.player.y, target.x, target.y);
      g.magnetPulled.length = 0;
      for (let i = 0; i < 60; i++) g.updateMutationEffects(1 / 60);
      const moved = start - dist(g.player.x, g.player.y, target.x, target.y);
      // d' = -90 (1 - d / 160): the distance after 1 s; it can't pass the hole's centre.
      const expected = d < 160 ? Math.max(0, 160 - (160 - start) * Math.exp(90 / 160)) : start;
      out.rows.push({ radius, d, moved: +moved.toFixed(2), expectedMoved: +(start - expected).toFixed(2), pulled: g.magnetPulled.length });
    }
    // Drawing: what the player sees, and that it is cheap
    const spy = (radius) => {
      g.player.setRadius(radius);
      const target = g.objects.find(o => !o.eating && g.holeCanEat(g.player, o));
      target.x = g.player.x + radius + 30; target.y = g.player.y;
      g.updateMutationEffects(1 / 60);
      let arcs = [], lines = 0, blur = 0;
      const ctx = g.ctx, a = ctx.arc, l = ctx.lineTo;
      ctx.arc = function (x, y, rr) { arcs.push(rr); return a.apply(this, arguments); };
      ctx.lineTo = function () { lines++; return l.apply(this, arguments); };
      const sb = ctx.shadowBlur;
      g.drawMagnetField(ctx, 1);
      blur = ctx.shadowBlur !== sb ? 1 : 0;
      delete ctx.arc; delete ctx.lineTo;
      return { arcs, lines, blur };
    };
    out.drawMid = spy(66); out.drawHuge = spy(170);
    g.player.setRadius(66);
    g.objects.forEach(o => { if (!o.eating && g.holeCanEat(g.player, o)) { o.x = g.player.x + 100 * Math.cos(o.x); o.y = g.player.y + 100 * Math.sin(o.x); } });
    g.updateMutationEffects(1 / 60);
    const t0 = performance.now(); for (let i = 0; i < 200; i++) g.drawMagnetField(g.ctx, i); out.drawMs = +((performance.now() - t0) / 200).toFixed(3); out.drawCount = g.magnetPulled.length;
    g.paused = false;
    return out;
  });
  const row = (rad) => res.rows.find(x => x.radius === rad);
  r.push(report('[package] R5-03 strength and reach as approved: magnetRadius 160, magnetPull 90', res.config.R === 160 && res.config.pull === 90, JSON.stringify(res.config)));
  r.push(report('[package] R5-03 no card, no pull; the pick turns it on for the whole round', res.noCard === 0 && res.active === true, JSON.stringify({ noCard: res.noCard, active: res.active })));
  const inBand = res.rows.filter(x => x.radius < 160);
  r.push(report('[package] R5-03 it works at every size below 160: the measured pull matches the configured formula', inBand.length === 6 && inBand.every(x => x.moved > 0 && Math.abs(x.moved - x.expectedMoved) <= Math.max(1, x.expectedMoved * 0.04)), JSON.stringify(res.rows)));
  r.push(report('[package] R5-03 at radius >= 160 the field is inside the hole: no object is moved (reported, a range change needs the owner)', row(170) && row(170).moved === 0, JSON.stringify(row(170))));
  r.push(report('[package] R5-03 the pick shows a ripple from the hole out to the field edge', !!res.ripple && res.ripple.end === 160, JSON.stringify(res.ripple)));
  r.push(report('[package] R5-03 visible while active: the 160 range ring and a streak per pulled object, no canvas shadow; nothing once the hole is wider than the field', res.drawMid.arcs.length === 1 && res.drawMid.arcs[0] === 160 && res.drawMid.lines >= 1 && res.drawMid.blur === 0 && res.drawHuge.arcs.length === 0 && res.drawHuge.lines === 0, JSON.stringify({ mid: res.drawMid, huge: res.drawHuge })));
  r.push(report('[package] R5-03 cheap: one path of streaks per frame', res.drawMs < 1.5, `${res.drawMs} ms for ${res.drawCount} pulled objects (software canvas)`));
  fs.mkdirSync(path.join(WORK, 'shots'), { recursive: true });
  // The size jumps above open the remaining card offers: closed for the picture.
  await page.evaluate(async () => {
    const g = window.game;
    g.player.setRadius(66);
    for (let i = 0; i < 30; i++) { if (g.evolutionPending) g.skipEvolutionOffer(); await new Promise(x => setTimeout(x, 30)); }
  });
  await page.screenshot({ path: path.join(WORK, 'shots', 'r5-03-magnet.png') });
  r.push(report('[package] R5-03 no page errors', !c.errors.length, c.errors.slice(0, 3).join(' ')));
  await c.close();
  return r;
}

/* ---------- R5-04: Daily Reward and the language switch ---------- */
async function languageChecks(pkgUrl, webUrl) {
  const r = [];
  const seedSave = (p, opts = {}) => p.evaluate(({ key, user, coins, yesterday }) => {
    const g = window.game, s = defaultSave();
    s.stats.runsPlayed = 3; s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
    s.unlocks.announced = Array.from(new Set([...unlockedFeatureIds(s), 'warsztat', 'wyzwania', 'kampania']));
    s.coins = coins; s.prisms = 5; s.settings.lang = 'en'; s.meta.savedAt = Date.now() - 60000;
    const today = g.loginState().today;
    s.login = { lastClaimDate: yesterday ? new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10) : today, day: 1, totalClaims: 1 };
    const sealed = sealSave(s);
    if (user) localStorage.setItem('__cgMockCloud:' + user, JSON.stringify({ [key]: sealed }));
    else localStorage.setItem('SDK_DATA_qa-mock', JSON.stringify({ data: { [key]: sealed }, metadata: { date: new Date() } }));
  }, { key: SAVE_KEY, user: opts.user || null, coins: opts.coins == null ? 100 : opts.coins, yesterday: opts.yesterday !== false });
  const state = (p) => p.evaluate(() => {
    const g = window.game;
    return { open: !document.getElementById('loginRewardScreen').classList.contains('hidden'), coins: g.save.coins, claimed: g.loginState().claimedToday, total: g.save.login.totalClaims, lang: I18N.lang, guard: SAVE_GUARD.state, hash: location.hash, handoff: sessionStorage.getItem('vectorHoleLangSwitchSave') };
  });
  const toggle = async (p, c, lang) => {
    await p.evaluate((l) => window.game.setLanguage(l), lang).catch(() => {});
    await settle(500);
    await c.ready(p);
    await settle(1100); // past the 600 ms calendar timer
    return state(p);
  };
  const boot = async (p, c) => { await p.reload(); await c.ready(p); await settle(1100); return state(p); };
  const USER = { id: 'qa-user-1', username: 'qa' };
  const LATE = { mode: 'sdk', user: USER, cloudDebounceMs: 3000 };

  // The owner's report: a signed-in player claims, then flips PL/EN several times.
  {
    const c = await context({ mock: LATE });
    const p = await c.open(pkgUrl);
    await seedSave(p, { user: USER.id });
    await settle(50);
    const before = await boot(p, c);
    await p.evaluate(() => { document.getElementById('btnLoginClaim').click(); });
    await settle(200);
    const claimed = await state(p);
    await p.evaluate(() => { window.game.closeLoginReward(); });
    const flips = [];
    for (const l of ['pl', 'en', 'pl', 'en', 'pl']) flips.push(await toggle(p, c, l));
    await settle(3600);
    const cloud = await p.evaluate((k) => { const v = JSON.parse(localStorage.getItem('__cgMockCloud:qa-user-1') || 'null'); const s = v && v[k] && JSON.parse(v[k]); return s && { last: s.login.lastClaimDate, coins: s.coins, total: s.login.totalClaims, lang: s.settings.lang }; }, SAVE_KEY);
    const today = await p.evaluate(() => window.game.loginState().today);
    r.push(report('[package, signed-in, late cloud] R5-04 the calendar opens once and pays once before the switches', before.open && claimed.claimed && claimed.coins > before.coins && claimed.total === before.total + 1, JSON.stringify({ before, claimed })));
    r.push(report('[package, signed-in, late cloud] R5-04 five quick PL/EN switches right after the claim: the Daily Reward never comes back', flips.every(f => !f.open), JSON.stringify(flips.map(f => f.open))));
    r.push(report('[package, signed-in, late cloud] R5-04 the coins and the claim stay through every switch, paid exactly once', flips.every(f => f.coins === claimed.coins && f.claimed && f.total === claimed.total), JSON.stringify(flips.map(f => [f.coins, f.total, f.claimed]))));
    r.push(report('[package, signed-in, late cloud] R5-04 every switch lands in its language; the handover is gone after boot', flips.every((f, i) => f.lang === ['pl', 'en', 'pl', 'en', 'pl'][i] && f.hash === '' && f.handoff === null && f.guard === 'ok'), JSON.stringify(flips.map(f => [f.lang, f.hash, f.handoff, f.guard]))));
    r.push(report('[package, signed-in, late cloud] R5-04 the account ends up with the claim, the coins and the language', !!cloud && cloud.last === today && cloud.coins === claimed.coins && cloud.total === claimed.total && cloud.lang === 'pl', JSON.stringify({ cloud, today })));
    r.push(report('[package] R5-04 no page errors (signed-in run)', !c.errors.length, c.errors.slice(0, 3).join(' ')));
    await c.close();
  }

  // A finished round: progress saved seconds before the switch.
  {
    const c = await context({ mock: LATE });
    const p = await c.open(pkgUrl);
    await seedSave(p, { user: USER.id, yesterday: false });
    await settle(50);
    await boot(p, c);
    const coins = await p.evaluate(() => { const g = window.game; g.save.coins += 77; g.save.stats.runsPlayed++; saveGame(g.save); return g.save.coins; });
    const after = await toggle(p, c, 'pl');
    r.push(report('[package, signed-in, late cloud] R5-04 a round paid seconds before a language switch keeps its coins', after.coins === coins, JSON.stringify({ coins, after })));
    await c.close();
  }

  // Guest: the SDK's localStorage is synchronous.
  {
    const c = await context({});
    const p = await c.open(pkgUrl);
    await seedSave(p, {});
    await settle(50);
    const before = await boot(p, c);
    await p.evaluate(() => { document.getElementById('btnLoginClaim').click(); });
    await settle(200);
    const claimed = await state(p);
    await p.evaluate(() => { window.game.closeLoginReward(); });
    const flip = await toggle(p, c, 'pl');
    r.push(report('[package, guest] R5-04 claim + switch: no second calendar, paid once', before.open && !flip.open && flip.coins === claimed.coins && flip.total === claimed.total, JSON.stringify({ before: before.open, flip })));
    await c.close();
  }

  // The handover can't do harm.
  {
    const c = await context({});
    const p = await c.open(pkgUrl);
    await seedSave(p, { yesterday: false, coins: 500 });
    await settle(50);
    await boot(p, c);
    const set = (v, hash) => p.evaluate(({ v, hash, k }) => { sessionStorage.setItem(k, v); history.replaceState(history.state, '', location.pathname + (hash ? '#lang=pl' : '')); }, { v, hash, k: HANDOFF });
    await set('{"broken', true);
    const junk = await boot(p, c);
    r.push(report('[package] R5-04 an unreadable handover is ignored: the stored save stays, no guard trip', junk.coins === 500 && junk.guard === 'ok' && junk.handoff === null && junk.lang === 'pl', JSON.stringify(junk)));
    const older = await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.game.save)); s.coins = 9; s.meta.savedAt = 1000; return sealSave(sanitizeSave(s)); });
    await set(older, true);
    const old = await boot(p, c);
    r.push(report('[package] R5-04 an older handover (the account is ahead) is ignored', old.coins === 500, JSON.stringify(old)));
    const newer = await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.game.save)); s.coins = 900; s.meta.savedAt = Date.now() + 5000; return sealSave(sanitizeSave(s)); });
    await set(newer, false);
    const noHash = await boot(p, c);
    r.push(report('[package] R5-04 no #lang= on this load (e.g. the portal reloaded the game, an account change): the leftover is dropped, not applied', noHash.coins === 500 && noHash.handoff === null, JSON.stringify(noHash)));
    await c.close();
  }

  // The web build is untouched.
  {
    const c = await context({});
    const p = await c.open(webUrl);
    await p.evaluate(() => { window.game.save.coins = 321; window.game.setLanguage(I18N.lang === 'pl' ? 'en' : 'pl'); }).catch(() => {});
    await settle(500); await c.ready(p); await settle(300);
    const web = await state(p);
    const raw = await p.evaluate((k) => localStorage.getItem(k) !== null, SAVE_KEY);
    r.push(report('[web] R5-04 a language switch uses plain localStorage: no handover, no #lang=, the save kept', web.hash === '' && web.handoff === null && web.coins === 321 && raw, JSON.stringify(web)));
    await c.close();
  }
  return r;
}

export async function runCgPreviewQa5Checks({ root = ROOT } = {}) {
  WORK = path.join(OUT, 'cg-preview-qa5', root === ROOT ? 'this' : 'root-' + path.basename(root));
  fs.mkdirSync(WORK, { recursive: true });
  const pkg = exportPackage({ root, out: path.join(WORK, 'export') });
  const site = await serve({ root: pkg.gameDir });
  const web = await serve({ root });
  browser = await chromium.launch();
  const all = [];
  const only = (process.argv.find(x => x.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  try {
    for (const step of [tileChecks, magnetChecks, languageChecks]) {
      if (only.length && !only.includes(step.name)) continue;
      try { all.push(...await step(site.url, web.url)); } catch (e) { all.push(report(`cg-preview-qa5: ${step.name} crashed`, false, String(e && e.stack || e).slice(0, 600))); }
    }
  } finally { await browser.close(); site.server.close(); web.server.close(); }
  return all;
}

if (isMain(import.meta.url)) {
  const a = process.argv.find(x => x.startsWith('--root='));
  const res = await runCgPreviewQa5Checks(a ? { root: path.resolve(a.slice(7)) } : {});
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} PASS`);
  failed.forEach(f => console.log('  FAIL', f.name, String(f.details || '').slice(0, 700)));
  process.exit(failed.length ? 1 : 0);
}
