// CG-PREVIEW-QA-1 R4: the fourth round of CrazyGames Preview reports on the real package
// (tools/export-crazygames-basic.mjs) with qa/cg-sdk-mock.js, and the web build.
//   node qa/cg-preview-qa4.mjs [--root=DIR] [--only=step,...]
//   --root: the game to test (e.g. a base checkout).
// R4-01: the first-run start screen (logo, live demo, PLAY, "Arena round · 2:00") fits every
//   PC frame -- fullscreen and windowed at 100-175 % Windows scaling, 16:9 / 16:10 / 5:4 /
//   ultra-wide --, the CrazyGames frames, phones and a tablet, in English and Polish: no
//   scrollbar anywhere, PLAY and the note on screen, the demo at its full 470 px wherever there
//   is room; the other screens still scroll where their content is taller than the frame.
// R4-02 (owner decision): a new player's first Arena round offers the evolution cards twice --
//   at 25-30 s and 60-65 s of play, each after its growth size (46 / 66) or at the window's end;
//   2:00 of play kept (the offer holds the round); round 2, the Daily, returning players unchanged.
// R4-03: the Daily Reward window after CLAIM -- a plain confirmation instead of a dead button,
//   a real NEXT / DALEJ button out (No, thanks only beside an ad offer), paid once (taps, close, reload).
// Mock results are not CrazyGames Preview results.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, serve, installQaBridge, report, OUT, ROOT, isMain, CG_SDK_URL, CG_SDK_MOCK, QA_RANDOM, veteranSave } from './lib.mjs';
import { exportPackage } from '../tools/export-crazygames-basic.mjs';

let WORK = path.join(OUT, 'cg-preview-qa4');
let browser = null;
const settle = (ms = 250) => new Promise(r => setTimeout(r, ms));

/** CSS-px frames: a 1920x1080 / 2560x1440 / 1366x768 screen at 100-175 % scaling, fullscreen
 *  (the whole screen) and windowed (minus the taskbar and the browser's bars), other PC shapes,
 *  the CrazyGames frames, phones and a tablet. */
export const START_FRAMES = [
  [1920, 1080, 'FHD 100% fullscreen'], [1920, 953, 'FHD 100% window'], [1536, 864, 'FHD 125% fullscreen'], [1536, 730, 'FHD 125% window'],
  [1280, 720, 'FHD 150% fullscreen'], [1280, 585, 'FHD 150% window'], [1097, 617, 'FHD 175% fullscreen'], [1097, 485, 'FHD 175% window'],
  [2560, 1440, 'QHD 100% fullscreen'], [2560, 1305, 'QHD 100% window'], [2048, 1152, 'QHD 125% fullscreen'], [1707, 960, 'QHD 150% fullscreen'],
  [1707, 825, 'QHD 150% window'], [1463, 823, 'QHD 175% fullscreen'], [1463, 700, 'QHD 175% window'],
  [1366, 768, '1366x768 fullscreen'], [1366, 633, '1366x768 window'], [1440, 900, '1440x900 fullscreen'], [1440, 765, '1440x900 window'],
  [1600, 900, '1600x900'], [1680, 1050, '1680x1050'], [1920, 1200, '16:10 FHD'], [2560, 1600, '16:10 QHD'], [1280, 1024, '5:4'],
  [3440, 1440, 'ultra-wide'], [3840, 2160, '4K 100%'], [1867, 1006, 'the R4-01 screenshot'],
  [1060, 596, 'CrazyGames desktop frame'], [800, 450, 'CrazyGames mobile frame'],
  [375, 667, 'phone 375x667'], [390, 844, 'phone 390x844'], [844, 390, 'phone landscape'], [820, 1180, 'tablet']
];

async function context({ locale = 'en-US', device }) {
  const ctx = await browser.newContext({ ...device, locale });
  await installQaBridge(ctx);
  await ctx.addInitScript(`window.__cgMock = ${JSON.stringify({ mode: 'sdk' })};`);
  await ctx.addInitScript(QA_RANDOM);
  const errors = [];
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await ctx.route(CG_SDK_URL, (r) => r.fulfill({ contentType: 'text/javascript', body: CG_SDK_MOCK }));
  const open = async (url) => {
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    await page.goto(url);
    await page.waitForFunction(() => window.game && window.game.state !== undefined && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 40000 });
    await settle(500);
    return page;
  };
  return { ctx, open, errors, close: () => ctx.close() };
}

/** Every element that shows a vertical scrollbar right now (the page itself included). */
const SCROLLERS = `(() => {
  const out = [];
  for (const el of [document.documentElement, document.body, ...document.querySelectorAll('body *')]) {
    if (el.closest('.hidden')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const page = el === document.documentElement || el === document.body;
    if ((page ? cs.overflowY !== 'hidden' && cs.overflowY !== 'clip' : cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1) {
      out.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.classList.length ? '.' + [...el.classList].join('.') : '')) + ' ' + el.scrollHeight + '/' + el.clientHeight);
    }
  }
  return out;
})()`;

/* ---------- R4-01: the start screen fits, nothing scrolls ---------- */
async function startScreenChecks(pkgUrl, webUrl) {
  const r = [];
  fs.mkdirSync(path.join(WORK, 'shots'), { recursive: true });
  const read = (p) => p.evaluate((scrollers) => {
    const g = window.game, vis = (e) => !!e && e.offsetParent !== null;
    const box = (e) => { const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right }; };
    const cta = document.getElementById('btnWelcomePlay'), note = document.querySelector('#hubWelcome .welcome-note');
    const stage = document.querySelector('#hubWelcome .welcome-stage'), logo = document.querySelector('#hubWelcome .welcome-logo');
    const inView = (x) => x.t >= -0.5 && x.b <= innerHeight + 0.5 && x.l >= -0.5 && x.r <= innerWidth + 0.5;
    return {
      firstRun: g.isFirstRun(), welcome: vis(cta), layout: g.layout, ui: +g.uiScale.toFixed(3), scrollers: eval(scrollers),
      cta: cta.textContent.trim(), note: note.textContent.trim(), ctaIn: inView(box(cta)), noteIn: inView(box(note)),
      // logical px (inside the --ui-scale zoom)
      stageH: stage.offsetHeight, logoInStage: box(logo).t >= box(stage).t - 0.5 && box(logo).b <= box(stage).b + 0.5,
      room: Math.round(innerHeight / g.uiScale)
    };
  }, SCROLLERS);
  for (const [lang, build, url] of [['en', 'package', pkgUrl], ['pl', 'package', pkgUrl + '#lang=pl'], ['pl', 'web', webUrl], ['en', 'web', webUrl]]) {
    const fails = [];
    let shown = 0, full = 0, wideN = 0, sample = null;
    for (const [w, h, label] of START_FRAMES) {
      const touch = w < 900 && label !== 'CrazyGames mobile frame' || label === 'tablet';
      const d = await context({ locale: lang === 'pl' ? 'pl-PL' : 'en-US', device: { viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch } });
      try {
        const p = await d.open(url);
        await settle(400); // the English layer translates after a DOM change
        const st = await read(p);
        if ([1920 + 'x' + 953, '1867x1006', '1280x720', '375x667'].includes(`${w}x${h}`)) await p.screenshot({ path: path.join(WORK, 'shots', `start-${build}-${lang}-${w}x${h}.png`) });
        const wantCta = lang === 'pl' ? /^GRAJ/ : /^PLAY/, wantNote = lang === 'pl' ? /Runda na Arenie/ : /Arena round/;
        const ok = st.firstRun && st.welcome && !st.scrollers.length && st.ctaIn && st.noteIn && st.logoInStage && wantCta.test(st.cta) && wantNote.test(st.note) && !d.errors.length
          && (st.layout !== 'wide' || st.stageH >= 240);
        if (st.layout === 'wide') { wideN++; if (st.stageH >= 469) full++; }
        shown++;
        if (`${w}x${h}` === '1867x1006') sample = st;
        if (!ok) fails.push(`${w}x${h} ${label}: ${JSON.stringify({ layout: st.layout, ui: st.ui, scrollers: st.scrollers, ctaIn: st.ctaIn, noteIn: st.noteIn, stageH: st.stageH, logo: st.logoInStage, cta: st.cta, note: st.note, errors: d.errors.slice(0, 2) })}`);
      } finally { await d.close(); }
    }
    r.push(report(`[${build} ${lang.toUpperCase()}] R4-01 the first-run start screen in ${START_FRAMES.length} frames (PC fullscreen / windowed at 100-175 %, CrazyGames, phones, tablet): no scrollbar anywhere, ${lang === 'pl' ? 'GRAJ' : 'PLAY'} and the note on screen, the logo inside the demo`, shown === START_FRAMES.length && !fails.length, fails.length ? fails.join(' || ').slice(0, 1500) : `${shown} frames, owner's 1867x1006: ${JSON.stringify(sample)}`));
    // The demo keeps its full size wherever the frame has room for it (most large screens).
    r.push(report(`[${build} ${lang.toUpperCase()}] R4-01 the live demo keeps its full 470 px wherever there is room (wide frames taller than 620 logical px), shrinks only by what the screen lacks`, full >= wideN - 16 && full >= 8, `${full}/${wideN} wide frames at 470 px`));
  }
  // A resize while the start screen is open (window -> fullscreen -> window) never leaves a scrollbar.
  {
    const d = await context({ locale: 'en-US', device: { viewport: { width: 1920, height: 953 }, deviceScaleFactor: 1 } });
    const seen = [];
    try {
      const p = await d.open(pkgUrl);
      for (const [w, h] of [[1920, 1080], [1920, 953], [1536, 864], [1280, 720], [1097, 617], [1920, 953]]) {
        await p.setViewportSize({ width: w, height: h }); await settle(450);
        const st = await read(p);
        seen.push(`${w}x${h}:${st.layout}:${st.scrollers.length ? st.scrollers.join('+') : 'none'}:${st.ctaIn && st.noteIn ? 'in' : 'OUT'}`);
      }
    } finally { await d.close(); }
    r.push(report('[package EN] R4-01 window <-> fullscreen resizes on the start screen: never a scrollbar, PLAY and the note stay on screen', seen.every(s => /:none:in$/.test(s)), seen.join(' ')));
  }
  return r;
}

/* ---------- R4-01: other screens still scroll (no global overflow: hidden) ---------- */
async function otherScreensChecks(pkgUrl, webUrl) {
  const r = [];
  for (const [build, url, vp] of [['web', webUrl, { width: 375, height: 667 }], ['package', pkgUrl, { width: 375, height: 667 }], ['package', pkgUrl, { width: 1280, height: 720 }]]) {
    const touch = vp.width < 900;
    const d = await context({ locale: 'en-US', device: { viewport: vp, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch } });
    try {
      const p = await d.open(url);
      const save = await veteranSave(p, { runsPlayed: 6, missions: 12 });
      const st = await p.evaluate(async (save) => {
        const g = window.game, res = {};
        g.save = save; // a player with progress (in memory: only the layout is read)
        const scrollable = (root) => {
          for (const el of [root, ...root.querySelectorAll('*')]) {
            const cs = getComputedStyle(el);
            if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 8) { el.scrollTop = 40; const moved = el.scrollTop > 0; el.scrollTop = 0; if (moved) return el.id || el.className; }
          }
          return null;
        };
        g.showScreen('mainMenu'); g.openProfileScreen(); await new Promise(x => setTimeout(x, 350));
        res.profile = scrollable(document.getElementById('profileScreen'));
        g.openCampaignScreen(); await new Promise(x => setTimeout(x, 350));
        res.campaign = scrollable(document.getElementById('campaignScreen'));
        g.showScreen('mainMenu'); await new Promise(x => setTimeout(x, 350));
        res.hubFirstRun = g.isFirstRun();
        res.html = getComputedStyle(document.documentElement).overflowY + '/' + getComputedStyle(document.body).overflowY;
        return res;
      }, save);
      r.push(report(`[${build} ${vp.width}x${vp.height}] R4-01 a player with progress: Profil and Dzielnice still scroll their long content (no global overflow: hidden), Miasto is not the first-run screen`, !!st.profile && !!st.campaign && !st.hubFirstRun && !d.errors.length, JSON.stringify({ ...st, errors: d.errors.slice(0, 2) })));
    } finally { await d.close(); }
  }
  return r;
}

/* ---------- R4-02: the evolution cards in a new player's first round (owner decision) ---------- */
// In-page player for the running Arena round (re-aims every 0.4 s at the nearest bite on screen,
// a golden core first). `idle` stands still (a slow start: never reaches the growth sizes).
// Each offer is recorded with the play time (frames; the offer pauses the round, so it adds
// none), the round clock and the radius, then answered by a tap on the first card.
const DRIVER = `
window.__r4Play = function (opts = {}) {
  const g = window.game, p = g.player, dt = 1 / 30;
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  let v = realNow(); performance.now = () => v;
  if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
  // clock0: round time already played in real time before this driver took over (a few frames).
  const out = { golden: [], frenzy: 0, offers: [], quiet: !!g.evolutionQuiet, intro: !!g.evolutionIntro, paced: !!g.evolutionPace, runs: g.save.stats.runsPlayed, finish: null, clock0: +(CONFIG.round.duration - g.timeRemaining).toFixed(2) };
  let frames = 0, wanderA = 1;
  const sg = g.spawnGoldenCore, sf = g.startFrenzy;
  g.spawnGoldenCore = function () { out.golden.push(Math.round(frames * dt)); return sg.call(g); };
  g.startFrenzy = function () { out.frenzy++; return sf.call(g); };
  while (g.state === GameState.PLAYING && frames < (opts.seconds || 200) * 30) {
    if (g.evolutionPending) {
      out.offers.push({ play: +(frames * dt).toFixed(1), clock: +(CONFIG.round.duration - g.timeRemaining).toFixed(1), r: Math.round(p.radius), kicker: (document.getElementById('evolutionKicker') || {}).textContent || '', shown: !document.getElementById('evolutionOverlay').classList.contains('hidden') });
      if (opts.hold) break;
      const card = document.querySelector('#evolutionCards .evolution-card'); if (card) card.click(); else g.skipEvolutionOffer();
      continue;
    }
    if (opts.idle) g.keyDir = { x: 0, y: 0 };
    else if (frames % 12 === 0) {
      const vw = g.width / g.zoom / 2, vh = g.height / g.zoom / 2;
      let best = g.goldenObj && Math.abs(g.goldenObj.x - p.x) < vw && Math.abs(g.goldenObj.y - p.y) < vh ? g.goldenObj : null, bd = Infinity;
      if (!best) for (const o of g.objects) { if (o.eating || !g.holeCanEat(p, o) || Math.abs(o.x - p.x) > vw || Math.abs(o.y - p.y) > vh) continue; const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } }
      if (best) { const m = Math.hypot(best.x - p.x, best.y - p.y) || 1; g.keyDir = { x: (best.x - p.x) / m, y: (best.y - p.y) / m }; }
      else { wanderA += 0.7; g.keyDir = { x: Math.cos(wanderA), y: Math.sin(wanderA) }; }
    }
    v += dt * 1000; g.update(dt); frames++;
    if (g.overdriveActive && !out.finish) out.finish = g.overdriveVariant;
  }
  out.powers = [...(g.activeMutations || [])];
  out.play = +(frames * dt).toFixed(1);
  if (!opts.hold && g.state === GameState.PLAYING) { g.timeRemaining = 0.001; v += 16; g.update(0.016); }
  delete g.spawnGoldenCore; delete g.startFrenzy;
  g.keyDir = { x: 0, y: 0 }; performance.now = realNow;
  return out;
};`;
const NEW_KICKER = /^(NOWOŚĆ · EWOLUCJA|NEW · EVOLUTION)$/;
async function evolutionChecks(pkgUrl, webUrl) {
  const r = [];
  const rounds = { 1: [], 2: [] };
  for (const [seed, build, url, lang] of [[1000, 'package', pkgUrl, 'en'], [8919, 'package', pkgUrl, 'en'], [16838, 'web', webUrl, 'pl'], [24757, 'web', webUrl, 'pl']]) {
    const d = await context({ locale: lang === 'pl' ? 'pl-PL' : 'en-US', device: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } });
    try {
      const p = await d.open(url);
      await p.addScriptTag({ content: DRIVER });
      await p.evaluate((sd) => { window.__qaSeedRandom(sd); document.getElementById('btnWelcomePlay').click(); }, seed);
      for (const n of [1, 2]) {
        await settle(150);
        rounds[n].push({ seed, build, ...await p.evaluate(() => window.__r4Play()) });
        await settle(400);
        await p.evaluate(async () => { for (let i = 0; i < 40; i++) { const u = document.getElementById('unlockOverlay'); if (u && !u.classList.contains('hidden')) { document.getElementById('btnUnlockLater').click(); break; } await new Promise(x => setTimeout(x, 100)); } });
        await settle(150);
        if (n === 1) await p.evaluate((sd) => { window.__qaSeedRandom(sd); document.getElementById('btnPlayAgain').click(); }, seed + 1);
      }
      if (d.errors.length) r.push(report(`[${build}] R4-02 seed ${seed}: no console errors`, false, d.errors.slice(0, 3).join(' | ')));
    } finally { await d.close(); }
  }
  const r1 = rounds[1], r2 = rounds[2];
  // Times on the round's own clock (2:00 minus the time left), which the offers' windows use.
  const brief = (a) => JSON.stringify(a.map(x => ({ seed: x.seed, b: x.build, offers: x.offers.map(o => `${o.clock}s r${o.r} ${o.kicker}`), powers: x.powers.length, play: +(x.clock0 + x.play).toFixed(2) })));
  r.push(report('[package EN + web PL] R4-02 round 1 of a new player (casual-like player, real PLAY button): two evolution choices -- the first at 25-30 s of play, the second at 60-65 s, both after the vortex reached the size the cards wait for (46 / 66), the first marked "NEW · EVOLUTION" / "NOWOŚĆ · EWOLUCJA"; both picked powers stay active to the end',
    r1.every(x => x.runs === 0 && x.paced && !x.quiet && x.offers.length === 2 && x.offers[0].clock >= 25 && x.offers[0].clock <= 30.1 && x.offers[1].clock >= 60 && x.offers[1].clock <= 65.1
      && x.offers[0].r >= 46 && x.offers[1].r >= 66 && NEW_KICKER.test(x.offers[0].kicker) && !NEW_KICKER.test(x.offers[1].kicker) && x.offers.every(o => o.shown) && x.powers.length === 2), brief(r1)));
  r.push(report('[package EN + web PL] R4-02 round 1 keeps 2:00 of play (the cards pause the round), the Złoty Rdzeń from 10 s and the finish as before',
    r1.every(x => Math.abs(x.clock0 + x.play - 120) <= 0.1 && x.golden.length >= 3 && x.golden[0] === 10 && x.finish), JSON.stringify(r1.map(x => ({ play: +(x.clock0 + x.play).toFixed(2), clock0: x.clock0, golden: x.golden, finish: x.finish })))));
  r.push(report('[package EN + web PL] R4-02 round 2 unchanged: the cards come at the growth sizes (not paced), two choices, neither marked new any more (the first round introduced them)',
    r2.every(x => x.runs === 1 && !x.paced && !x.quiet && x.offers.length === 2 && x.offers.every(o => !NEW_KICKER.test(o.kicker)) && x.offers[0].r >= 46 && x.powers.length === 2), brief(r2)));

  // A slow start (the vortex never reaches 46): both choices still come, at 30 and 65 s.
  // The offer holds the round: 1.5 s of real time with the game loop running moves no clock.
  {
    const d = await context({ locale: 'en-US', device: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } });
    try {
      const p = await d.open(pkgUrl);
      await p.addScriptTag({ content: DRIVER });
      await p.evaluate(() => { window.__qaSeedRandom(77); document.getElementById('btnWelcomePlay').click(); });
      await settle(150);
      const first = await p.evaluate(() => window.__r4Play({ idle: true, hold: true }));
      const hold = await p.evaluate(async () => {
        const g = window.game, t0 = g.timeRemaining, s0 = g.player.score;
        g.running = true; g.lastTime = performance.now(); g.rafId = requestAnimationFrame((t) => g.loop(t));
        await new Promise(x => setTimeout(x, 1500));
        const out = { t0: +t0.toFixed(2), t1: +g.timeRemaining.toFixed(2), pending: g.evolutionPending, score: g.player.score === s0 };
        document.querySelector('#evolutionCards .evolution-card').click();
        return out;
      });
      const rest = await p.evaluate(() => window.__r4Play({ idle: true }));
      const all = [...first.offers, ...rest.offers];
      r.push(report('[package EN, phone] R4-02 a slow first round (the vortex stays below the card size): both choices still come, at 30 s and 65 s of play',
        all.length === 2 && Math.abs(all[0].clock - 30) <= 0.1 && Math.abs(all[1].clock - 65) <= 0.1 && all[0].r < 46 && all[1].r < 66, JSON.stringify({ offers: all, firstPlay: first.play })));
      r.push(report('[package EN, phone] R4-02 while the cards are open the round is held: the clock and the score do not move in 1.5 s of real time with the game loop running',
        hold.pending && hold.t0 === hold.t1 && hold.score, JSON.stringify(hold)));
      if (d.errors.length) r.push(report('[package] R4-02 slow round: no console errors', false, d.errors.slice(0, 3).join(' | ')));
    } finally { await d.close(); }
  }

  // Who gets the paced first round: a new player's regular round only (also after a first round
  // left early -- R1: not a finished round); a returning player, the Daily and a friend's
  // challenge keep the size triggers; nothing new in the save.
  {
    const d = await context({ locale: 'pl-PL', device: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } });
    try {
      const p = await d.open(webUrl);
      const st = await p.evaluate(() => {
        const g = window.game, out = {};
        g.save.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
        const keys0 = Object.keys(defaultSave()).sort().join();
        g.startRound({}); out.fresh = { paced: !!g.evolutionPace, intro: g.evolutionIntro, quiet: g.evolutionQuiet };
        g.player.score = 120; g.pauseGame(); g.leaveRun(); out.leftRuns = g.save.stats.runsPlayed;
        g.startRound({}); out.afterLeave = { paced: !!g.evolutionPace, intro: g.evolutionIntro };
        g.player.setRadius(70); g.checkEvolutionTriggers(); out.afterLeave.offerAtOnce = g.evolutionPending; g.skipEvolutionOffer(); g.stopRun();
        g.startRound({ seed: 4242, daily: true }); out.daily = { paced: !!g.evolutionPace, intro: g.evolutionIntro }; g.player.setRadius(50); g.checkEvolutionTriggers(); out.daily.offer = g.evolutionPending; g.skipEvolutionOffer(); g.stopRun();
        g.save.stats.runsPlayed = 4;
        g.startRound({}); out.veteran = { paced: !!g.evolutionPace, intro: g.evolutionIntro }; g.player.setRadius(50); g.checkEvolutionTriggers(); out.veteran.offer = g.evolutionPending; g.skipEvolutionOffer(); g.stopRun();
        out.saveKeys = Object.keys(g.save).sort().join() === keys0; out.schema = g.save.schemaVersion;
        out.cfg = CONFIG.ftue.firstRoundEvolution; out.radii = CONFIG.evolution.triggerRadii;
        return out;
      });
      r.push(report('[web PL] R4-02 the paced first round only for a new player\'s regular round (also again after a first round left early); the Daily, a returning player: cards at the growth size at once, not marked new; no new save field, schema 13',
        st.fresh.paced && st.fresh.intro && !st.fresh.quiet && st.leftRuns === 0 && st.afterLeave.paced && !st.afterLeave.offerAtOnce
        && !st.daily.paced && !st.daily.intro && st.daily.offer && !st.veteran.paced && !st.veteran.intro && st.veteran.offer && st.saveKeys && st.schema === 13
        && JSON.stringify(st.radii) === '[46,66]', JSON.stringify(st)));
      if (d.errors.length) r.push(report('[web] R4-02 rules: no console errors', false, d.errors.slice(0, 3).join(' | ')));
    } finally { await d.close(); }
  }
  return r;
}

/* ---------- R4-03: the Daily Reward window after the claim ---------- */
// A mouse click in the element's centre (page.click waits for the breathing btn-mega to stand still).
async function tap(p, sel) { const b = await p.locator(sel).boundingBox(); await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2); }
async function dailyRewardChecks(pkgUrl, webUrl) {
  const r = [];
  fs.mkdirSync(path.join(WORK, 'shots'), { recursive: true });
  const PHONE = { viewport: { width: 375, height: 667 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
  const PC = { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 };
  // A returning player (3 rounds) whose last claim was yesterday, on Miasto: the calendar opens.
  const open = (p, day, ads) => p.evaluate(async ({ day, ads }) => {
    const g = window.game, s = defaultSave();
    s.stats.runsPlayed = 3; s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
    s.unlocks.announced = Array.from(new Set([...unlockedFeatureIds(s), 'warsztat', 'wyzwania', 'kampania']));
    s.coins = 100; s.prisms = 5;
    const today = g.loginState().today; s.login = { lastClaimDate: new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10), day, totalClaims: day };
    g.save = sanitizeSave(s); g.bootFirstRun = false; g.hubVisits = 3;
    if (ads) g.monetization.provider = 'qa-ads';
    g.showScreen('mainMenu'); g.maybeShowLoginReward();
    await new Promise(x => setTimeout(x, 500));
    return !document.getElementById('loginRewardScreen').classList.contains('hidden');
  }, { day, ads });
  const state = (p) => p.evaluate(() => {
    const g = window.game, vis = (id) => { const e = document.getElementById(id); return !!e && !e.classList.contains('hidden') && e.offsetParent !== null; };
    const note = document.getElementById('loginClaimedNote'), close = document.getElementById('btnLoginClose');
    const cs = getComputedStyle(note), b = close.getBoundingClientRect();
    return {
      open: vis('loginRewardScreen'), claim: vis('btnLoginClaim'), note: vis('loginClaimedNote'), noteText: note.innerText.replace(/\s+/g, ' ').trim(),
      noteLooksStatic: note.tagName === 'P' && !note.closest('button') && cs.cursor !== 'pointer' && (cs.backgroundColor === 'rgba(0, 0, 0, 0)' || cs.backgroundColor === 'transparent') && cs.borderStyle === 'none',
      double: vis('btnLoginDouble'), close: vis('btnLoginClose'), closeText: close.textContent.trim(), closePrimary: close.classList.contains('btn-primary'),
      closeInView: b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth,
      coins: g.save.coins, prisms: g.save.prisms, claimedToday: g.loginState().claimedToday, day: g.save.login.day,
      title: document.getElementById('loginRewardTitle').textContent.trim()
    };
  });
  for (const [build, url, lang, device, dev] of [['package', pkgUrl, 'en', PC, 'PC 1280x720'], ['package', pkgUrl, 'en', PHONE, 'phone 375x667'], ['web', webUrl, 'pl', PC, 'PC 1280x720'], ['web', webUrl, 'pl', PHONE, 'phone 375x667'], ['package', pkgUrl + '#lang=pl', 'pl', PC, 'PC 1280x720']]) {
    const d = await context({ locale: lang === 'pl' ? 'pl-PL' : 'en-US', device });
    try {
      const p = await d.open(url);
      const shown = await open(p, 0, false);
      const before = await state(p);
      await tap(p, '#btnLoginClaim');
      await settle(500);
      const after = await state(p);
      await p.screenshot({ path: path.join(WORK, 'shots', `daily-${build}-${lang}-${device === PHONE ? 'phone' : 'pc'}.png`) });
      // Taps that must change nothing: the confirmation itself, the (hidden) claim button, claim() again.
      await tap(p, '#loginClaimedNote');
      await p.evaluate(() => { document.getElementById('btnLoginClaim').click(); window.game.claimLoginReward(); });
      await settle(200);
      const poked = await state(p);
      await tap(p, '#btnLoginClose');
      await settle(300);
      const closed = await state(p);
      const again = await p.evaluate(async () => { window.game.maybeShowLoginReward(); await new Promise(x => setTimeout(x, 200)); return !document.getElementById('loginRewardScreen').classList.contains('hidden'); });
      const en = lang === 'en';
      // The package has no ads: NEXT / DALEJ. GitHub Pages runs the demo ad provider: ×2 + "No, thanks".
      const ads = build === 'web';
      const want = { note: en ? /^Claimed \+60 coins$/ : /^Odebrano \+60 monet$/, close: ads ? (en ? 'No, thanks' : 'Nie, dziękuję') : (en ? 'NEXT' : 'DALEJ') };
      r.push(report(`[${build} ${lang.toUpperCase()}, ${dev}] R4-03 after CLAIM: the claim button is gone; "${en ? 'Claimed +60 coins' : 'Odebrano +60 monet'}" is a plain confirmation (no button look), the coins are in the save once; the way out on screen: ${ads ? `the "×2" ad offer + "${want.close}" (a link)` : `a real "${want.close}" button (no ad offer, so no "No, thanks")`}`,
        shown && before.claim && !before.note && !before.close && !after.claim && after.note && want.note.test(after.noteText) && after.noteLooksStatic
        && after.close && after.closeText === want.close && after.closePrimary === !ads && after.closeInView && after.double === ads
        && after.title === (en ? 'Day 1 of 7' : 'Dzień 1 z 7')
        && after.coins === before.coins + 60 && after.claimedToday && after.day === 1 && !d.errors.length,
        JSON.stringify({ shown, before: { claim: before.claim, coins: before.coins }, after, errors: d.errors.slice(0, 2) })));
      r.push(report(`[${build} ${lang.toUpperCase()}, ${dev}] R4-03 tapping the confirmation, the hidden claim button or claim() again grants nothing; "${want.close}" closes the window; it does not come back today`,
        poked.coins === after.coins && poked.prisms === after.prisms && poked.open && !closed.open && closed.coins === after.coins && !again, JSON.stringify({ poked: poked.coins, closed: closed.open, coins: closed.coins, again })));
    } finally { await d.close(); }
  }
  // GitHub Pages: a reload after the claim neither reopens the window nor pays again.
  {
    const d = await context({ locale: 'pl-PL', device: PC });
    try {
      const p = await d.open(webUrl);
      await open(p, 0, false);
      await tap(p, '#btnLoginClaim'); await settle(300);
      const c1 = await p.evaluate(() => ({ coins: window.game.save.coins, stored: JSON.parse(localStorage.getItem('vectorHoleSave_v1')).coins }));
      await p.reload();
      await p.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state !== undefined, null, { timeout: 40000 });
      await settle(1200);
      const c2 = await p.evaluate(async () => { const g = window.game; g.hubVisits = 3; g.bootFirstRun = false; g.showScreen('mainMenu'); g.maybeShowLoginReward(); await new Promise(x => setTimeout(x, 300));
        return { coins: g.save.coins, open: !document.getElementById('loginRewardScreen').classList.contains('hidden'), claimed: g.loginState().claimedToday, schema: g.save.schemaVersion }; });
      r.push(report('[web PL] R4-03 a reload after the claim: the window stays closed, the coins are not paid again, the save is still v13',
        c1.coins === 160 && c1.stored === 160 && c2.coins === 160 && !c2.open && c2.claimed && c2.schema === 13, JSON.stringify({ c1, c2 })));
    } finally { await d.close(); }
  }
  // An ad offer (a build with ads): "×2 FOR AN AD" + "No, thanks" as before; day 3 (prisms) and day 7.
  {
    const d = await context({ locale: 'pl-PL', device: PC });
    try {
      const p = await d.open(webUrl);
      await open(p, 0, true);
      await tap(p, '#btnLoginClaim'); await settle(300);
      const ad = await state(p);
      await p.evaluate(() => { window.game.monetization.provider = 'none'; window.game.closeLoginReward(); });
      await open(p, 2, false); await tap(p, '#btnLoginClaim'); await settle(300);
      const d3 = await state(p);
      await p.evaluate(() => window.game.closeLoginReward());
      await open(p, 6, false); await tap(p, '#btnLoginClaim'); await settle(300);
      const d7 = await state(p);
      await p.screenshot({ path: path.join(WORK, 'shots', 'daily-web-pl-day7.png') });
      r.push(report('[web PL] R4-03 with an ad offer the window keeps "×2 ZA REKLAMĘ" + "Nie, dziękuję" (a link); day 3 says "Odebrano +3 pryzmaty", day 7 "Odebrano +500 monet +15 pryzmatów", each paid once',
        ad.double && ad.closeText === 'Nie, dziękuję' && !ad.closePrimary && ad.note && ad.coins === 160
        && d3.noteText === 'Odebrano +3 pryzmaty' && d3.prisms === 8 && d3.closeText === 'DALEJ' && d7.noteText === 'Odebrano +500 monet +15 pryzmatów' && d7.coins === 600 && d7.prisms === 20 && !d.errors.length,
        JSON.stringify({ ad: { double: ad.double, close: ad.closeText }, d3: { note: d3.noteText, prisms: d3.prisms }, d7: { note: d7.noteText, coins: d7.coins, prisms: d7.prisms }, errors: d.errors.slice(0, 2) })));
    } finally { await d.close(); }
  }
  return r;
}

export async function runCgPreviewQa4Checks({ root = ROOT } = {}) {
  WORK = path.join(OUT, 'cg-preview-qa4', root === ROOT ? 'this' : 'root-' + path.basename(root));
  fs.mkdirSync(WORK, { recursive: true });
  const pkg = exportPackage({ root, out: path.join(WORK, 'export') });
  const site = await serve({ root: pkg.gameDir });
  const web = await serve({ root });
  browser = await chromium.launch();
  const all = [];
  const only = (process.argv.find(x => x.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
  try {
    for (const step of [startScreenChecks, otherScreensChecks, evolutionChecks, dailyRewardChecks]) {
      if (only.length && !only.includes(step.name)) continue;
      try { all.push(...await step(site.url, web.url)); } catch (e) { all.push(report(`cg-preview-qa4: ${step.name} crashed`, false, String(e && e.stack || e).slice(0, 600))); }
    }
  } finally { await browser.close(); site.server.close(); web.server.close(); }
  return all;
}

if (isMain(import.meta.url)) {
  const a = process.argv.find(x => x.startsWith('--root='));
  const res = await runCgPreviewQa4Checks(a ? { root: path.resolve(a.slice(7)) } : {});
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} PASS`);
  failed.forEach(f => console.log('  FAIL', f.name, String(f.details || '').slice(0, 600)));
  process.exit(failed.length ? 1 : 0);
}
