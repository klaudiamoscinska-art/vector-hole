// CG-PREVIEW-QA-1 R4: the fourth round of CrazyGames Preview reports on the real package
// (tools/export-crazygames-basic.mjs) with qa/cg-sdk-mock.js, and the web build.
//   node qa/cg-preview-qa4.mjs [--root=DIR] [--only=step,...]
//   --root: the game to test (e.g. a base checkout).
// R4-01: the first-run start screen (logo, live demo, PLAY, "Arena round · 2:00") fits every
//   PC frame -- fullscreen and windowed at 100-175 % Windows scaling, 16:9 / 16:10 / 5:4 /
//   ultra-wide --, the CrazyGames frames, phones and a tablet, in English and Polish: no
//   scrollbar anywhere, PLAY and the note on screen, the demo at its full 470 px wherever there
//   is room; the other screens still scroll where their content is taller than the frame.
// R4-02: what a brand-new player meets in Arena rounds 1 and 2 (golden cores, SZAŁ, evolution
//   cards, the finish) -- the FTUE-3 rule (round 1 without cards), measured, not changed.
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

/* ---------- R4-02: in-round boosters for a brand-new player (measured, unchanged) ---------- */
const DRIVER = `
window.__r4Play = function () {
  const g = window.game, p = g.player, dt = 1 / 30;
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  let v = realNow(); performance.now = () => v;
  if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
  const out = { golden: [], frenzy: 0, offers: [], quiet: !!g.evolutionQuiet, intro: !!g.evolutionIntro, runs: g.save.stats.runsPlayed, finish: null };
  let frames = 0, wanderA = 1;
  const sg = g.spawnGoldenCore, sf = g.startFrenzy;
  g.spawnGoldenCore = function () { out.golden.push(Math.round(frames * dt)); return sg.call(g); };
  g.startFrenzy = function () { out.frenzy++; return sf.call(g); };
  while (g.state === GameState.PLAYING && frames < 200 * 30) {
    if (g.evolutionPending) {
      out.offers.push({ t: Math.round(frames * dt), kicker: (document.getElementById('evolutionKicker') || {}).textContent || '' });
      const card = document.querySelector('#evolutionCards .evolution-card'); if (card) card.click(); else g.skipEvolutionOffer();
      continue;
    }
    if (frames % 12 === 0) {
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
  if (g.state === GameState.PLAYING) { g.timeRemaining = 0.001; v += 16; g.update(0.016); }
  delete g.spawnGoldenCore; delete g.startFrenzy;
  g.keyDir = { x: 0, y: 0 }; performance.now = realNow;
  return out;
};`;
async function boosterChecks(pkgUrl) {
  const r = [];
  const rounds = { 1: [], 2: [] };
  for (const seed of [1000, 8919, 16838]) {
    const d = await context({ locale: 'en-US', device: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 } });
    try {
      const p = await d.open(pkgUrl);
      await p.addScriptTag({ content: DRIVER });
      await p.evaluate((sd) => { window.__qaSeedRandom(sd); document.getElementById('btnWelcomePlay').click(); }, seed);
      for (const n of [1, 2]) {
        await settle(150);
        rounds[n].push(await p.evaluate(() => window.__r4Play()));
        await settle(400);
        await p.evaluate(async () => { for (let i = 0; i < 40; i++) { const u = document.getElementById('unlockOverlay'); if (u && !u.classList.contains('hidden')) { document.getElementById('btnUnlockLater').click(); break; } await new Promise(x => setTimeout(x, 100)); } });
        await settle(150);
        if (n === 1) await p.evaluate((sd) => { window.__qaSeedRandom(sd); document.getElementById('btnPlayAgain').click(); }, seed + 1);
      }
      if (d.errors.length) r.push(report(`[package] R4-02 seed ${seed}: no console errors`, false, d.errors.slice(0, 3).join(' | ')));
    } finally { await d.close(); }
  }
  const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
  const r1 = rounds[1], r2 = rounds[2];
  r.push(report('[package] R4-02 round 1 of a new player: the Złoty Rdzeń still appears (first at 10 s, ~every 34 s after) and the finish (blackout / portal rain) still fires -- the booster on the board is there',
    r1.every(x => x.golden.length >= 3 && x.golden[0] === 10 && x.finish), JSON.stringify(r1.map(x => ({ golden: x.golden, frenzy: x.frenzy, finish: x.finish })))));
  r.push(report('[package] R4-02 round 1 of a new player: no evolution cards (FTUE-3, CONFIG.ftue.evolutionFromRuns = 1 -- the approved rule, not a regression)',
    r1.every(x => x.runs === 0 && x.quiet && !x.offers.length && !x.powers.length), JSON.stringify(r1.map(x => ({ runs: x.runs, quiet: x.quiet, offers: x.offers.length })))));
  r.push(report('[package] R4-02 round 2: two evolution offers (radius 46 and 66), the first marked as new, each picked card active for the round; golden cores as in round 1',
    r2.every(x => x.runs === 1 && !x.quiet && x.intro && x.offers.length === 2 && x.powers.length === 2 && x.golden.length >= 3), JSON.stringify(r2.map(x => ({ offers: x.offers, powers: x.powers, golden: x.golden.length })))));
  console.log(`  R4-02 inventory: round 1 golden ${sum(r1, x => x.golden.length)} / SZAŁ ${sum(r1, x => x.frenzy)} / cards ${sum(r1, x => x.offers.length)}; round 2 golden ${sum(r2, x => x.golden.length)} / SZAŁ ${sum(r2, x => x.frenzy)} / cards ${sum(r2, x => x.offers.length)} (${r1.length} new players)`);
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
    for (const step of [startScreenChecks, otherScreensChecks, boosterChecks]) {
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
