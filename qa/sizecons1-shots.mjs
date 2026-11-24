// GG-SIZE-CONSISTENCY-01 (variant B, final) evidence, not a test: every tier crossing in the game's own renderer, BEFORE (the production
// checkout given by --base) vs FINAL (this checkout), each served from its own copy.
//   node qa/sizecons1-shots.mjs --base=DIR [--only=stills,video] [--frames=pc,mobile] [--cases=A,B,C,E,D]   (BEFORE = --base, FINAL = this checkout)
// Every scene is staged by QA: an Arena round (seed 2024, veteran save, gfx 2), Plac Neonów block, time frozen, rivals moved away.
// The player's vortex is set to the SAME growth progress in both (units = the tier threshold - 0.3 = "one fragment before unlock";
// its radius is what that variant's curve gives -- smaller in FINAL, which has not jumped yet) and to the threshold itself ("unlocked").
// One object of the next tier is MOVED next to it (its picture 14 screen px right of the vortex's disc), the other kinds of that tier
// in a row above. Camera zoom = the game's own formula for that radius. Positions only.
//   A: T1 + T2 (crate beside)  B: T2 + T3 (node)  C: T3 + T4 (billboard)  E: T4 + T5 (bus)  D: T5 + T6 (dome)
// diag-*.png: the same frame with diagnostic outlines (never in the game): vortex disc 1.07 R (cyan), black throat 0.65 R (dotted),
// eat reach 0.85 R (green dashed), T1 fragment reach 1.0 R (green dotted); each object's hitbox r (white dashed) and its picture's long
// half-extent L (pink), centre dot.
// video: the moment of unlock -- the vortex 0.6 unit before the threshold rolls over a fragment (crosses the tier) and on into the
// pilot object, in real time (the game's own loop); Playwright records it (.webm).
// Output (B FULL): qa/out/sizecons1/shots-full/{BEFORE,B}/<frame>-<case>-<moment>[-diag].png, side by side qa/out/sizecons1/shots-full/<frame>-<case>-<moment>[-diag].png,
//         qa/out/sizecons1/video-full/<variant>-<case>.webm, facts.json
import fs from 'node:fs';
import path from 'node:path';
import { serve, chromium, openGame, veteranSave, QA_RANDOM, ROOT, isMain } from './lib.mjs';
import { FRAMES, session, paintAfterDecode } from './objraster2-shots.mjs';
import { exportedRoot, DIR } from './sizecons1-measure.mjs';

// B FULL (this stage): BEFORE / B only, five tier crossings (case E = T4 -> T5 added), all kinds of the next tier in the row.
const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const SH = path.join(DIR, 'shots-final'), VID = path.join(DIR, 'video-final');
export const CASES = { A: { m: 1, pilot: 'skrzynia', label: 'T1 wir + obiekty T2 (skrzynia obok)' }, B: { m: 2, pilot: 'wezel', label: 'T2 wir + obiekty T3 (węzeł obok)' }, C: { m: 3, pilot: 'billboard', label: 'T3 wir + obiekty T4 (billboard obok)' }, E: { m: 4, pilot: 'autobus', label: 'T4 wir + obiekty T5 (autobus obok)' }, D: { m: 5, pilot: 'kopula', label: 'T5 wir + obiekty T6 (kopuła obok)' } };
const TIER_KINDS = { 2: ['lawka', 'kiosk', 'skrzynia', 'latarnia', 'drzewo', 'znacznik'], 3: ['samochod', 'wezel', 'pylon'], 4: ['pawilon', 'billboard', 'magazyn', 'landmark'], 5: ['autobus', 'tramwaj', 'ciezarowka'], 6: ['wiezowiec', 'maszt', 'kopula'] };
const VARIANTS = ['BEFORE', 'FINAL'];   // BEFORE = --base (production checkout), FINAL = this checkout
const FROZEN_T = 600000;

let BASE = null;
const shotRoot = (v) => exportedRoot(v === 'BEFORE' ? BASE : ROOT, 'shots-' + v);

/** Stage one case in the page. moment: 'locked' (U_m - 0.3) | 'unlocked' (U_m) | 'video' (U_m - 0.6, a fragment ahead, live loop). */
async function stage(page, { variant, caseId, moment }) {
  const c = CASES[caseId];
  return page.evaluate(async ({ variant, m, pilot, moment, kinds, FROZEN_T }) => {
    const mod = await import(document.querySelector('script[type="module"][src]').src);
    const g = window.game, CFG = mod.CONFIG, U = CFG.growth.unitAnchors;
    window.__qaSeedRandom(2024);
    g.applyGfx(2);
    g.startRound({ seed: 2024 });
    const live = moment === 'video';
    window.__realNow = window.__realNow || performance.now.bind(performance);
    if (!live) { if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false; performance.now = () => FROZEN_T; }
    g.frenzyEndsAt = null; g.checkEvolutionTriggers = () => {};
    const units = moment === 'unlocked' ? U[m] : moment === 'video' ? U[m] - 0.6 : U[m] - 0.3;
    const p = g.player, R = (mod.__qaArfu || mod.__qaRfu)(units), cx = 1.5 * 375, cy = 1.5 * 375;
    p.radius = R; p.invulnerableUntil = 0; p.growPopAt = 0; p.surgeAt = null; p.fxSquash = 0;
    const Z = CFG.juice.zoom, gt = Math.min(1, Math.max(0, (R - Z.startRadius) / (Z.endRadius - Z.startRadius)));
    let zoom = (Z.max + (Z.min - Z.max) * Math.sqrt(gt)) * g.viewScale;
    zoom = Math.min(zoom, Z.holeScreenFrac * Math.min(g.width, g.height) / R);
    zoom = Math.max(zoom, Z.floor, g.width / 3000, g.height / 3000);
    const disc = 1.07 * R, gap = 14 / zoom, box = (o) => mod.__qaViewBox(o.subtype, o.radius, 0, 0, { l: 0, r: 0, t: 0, b: 0 });
    const pick = (k) => g.objects.find(o => o.subtype === k && !o.eating && !o.__st);
    const P = pick(pilot); P.__st = true;
    p.surgeAt = null;
    const pb = box(P);
    const vx = live ? cx - 3.2 * R : cx;   // video: start left, roll right
    p.x = vx; p.y = cy;
    let frag = null;
    if (live) {
      frag = g.objects.find(o => o.tier === 'fragment' && !o.__st); frag.__st = true;
      frag.x = vx + 1.6 * R; frag.y = cy;
      P.x = vx + 3.4 * R + disc - pb.l; P.y = cy;
    } else { P.x = cx + disc + gap - pb.l; P.y = cy; }
    // the other kinds of that tier in a row above (pilot excluded)
    const others = kinds.filter(k => k !== pilot).map(pick).filter(Boolean);
    others.forEach(o => { o.__st = true; });
    const hw = g.width / zoom / 2, hh = g.height / zoom / 2;
    const rowH = Math.max(...others.map(o => { const b = box(o); return b.b - b.t; }), 1);
    const rowY = cy - Math.max(disc, -pb.t) - gap * 2 - rowH * 0.6;
    const widths = others.map(o => { const b = box(o); return b.r - b.l + gap; });
    const total = widths.reduce((a, b) => a + b, 0), fit = Math.min(1, (hw * 2 - 20 / zoom) / total);
    let x = (live ? cx : (cx + P.x) / 2) - total * fit / 2;
    others.forEach((o, i) => { const b = box(o); o.x = x - b.l; o.y = rowY; x += widths[i] * fit; });
    const camX = live ? cx : (p.x + P.x) / 2;
    // everything else out of the view
    const keep = new Set([P, ...others, ...(frag ? [frag] : [])]);
    for (const o of g.objects) if (!keep.has(o) && Math.abs(o.x - camX) < hw * 1.3 + 150 && Math.abs(o.y - cy) < hh * 1.3 + 150) { o.x = (o.x + 1500) % 3000; o.y = (o.y + 1500) % 3000; if (Math.abs(o.x - camX) < hw * 1.3 + 150 && Math.abs(o.y - cy) < hh * 1.3 + 150) o.y = (o.y + 900) % 3000; }
    for (const b of g.bots) { b.x = 2850; b.y = 2850; b.update = function () {}; }
    g.zoom = zoom; g.camera.x = camX; g.camera.y = cy;
    g.banner = null; g.bannerQueue = []; g.particles = []; g.ripples = []; g.floatTexts = []; g.shake = 0; g.flashAlpha = 0;
    g.lastSizeTierId = CFG.sizeTiers[mod.getSizeTierIndex(R)].id;
    try { g.updateHUD(); } catch (e) { /* HUD refresh is cosmetic for the frame */ }
    window.__st = { P, others, frag };
    // the close-up: a fixed box at the screen centre (the camera sits between the vortex and the pilot object), the same size in
    // every variant so the three are shown at one scale (PC 600x340, phone 390x440 CSS px)
    const cw = Math.min(g.width, g.width > 800 ? 600 : 390), ch = Math.min(g.height, g.width > 800 ? 340 : 440);
    window.__clip = { x: Math.round((g.width - cw) / 2), y: Math.round((g.height - ch) / 2), width: cw, height: ch };
    const can = g.holeCanEat(p, P);
    const pbAbs = box(P);
    return { variant, R: +R.toFixed(2), units, zoom: +zoom.toFixed(3), disc: +disc.toFixed(1), canEat: can, pilotR: P.radius, pilotL: +Math.max(-pbAbs.l, pbAbs.r, -pbAbs.t, pbAbs.b).toFixed(1), tier: CFG.sizeTiers[mod.getSizeTierIndex(R)].shortId, others: others.map(o => o.subtype) };
  }, { variant, m: c.m, pilot: c.pilot, moment, kinds: TIER_KINDS[c.m + 1], FROZEN_T });
}

/** Diagnostic outlines over the current frame (never part of the game). */
async function diag(page, L) {
  await page.evaluate(({ L }) => {
    const g = window.game, c = g.ctx, d = g.dpr, z = g.zoom, p = g.player, { P, others } = window.__st;
    c.save(); c.setTransform(d, 0, 0, d, 0, 0); c.translate(g.width / 2, g.height / 2); c.scale(z, z); c.translate(-g.camera.x, -g.camera.y);
    const ring = (x, y, r, col, w, dash) => { c.strokeStyle = col; c.lineWidth = w / z; c.setLineDash(dash.map(v => v / z)); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); };
    ring(p.x, p.y, p.radius * 1.07, '#50F0FA', 2.2, []);
    ring(p.x, p.y, p.radius * 0.65, '#50F0FA', 1.4, [2, 3]);
    ring(p.x, p.y, p.radius * 0.85, '#46D99A', 1.8, [6, 4]);
    ring(p.x, p.y, p.radius * 1.0, '#46D99A', 1.2, [2, 4]);
    for (const o of [P, ...others]) {
      ring(o.x, o.y, o.radius, '#ffffff', 1.5, [5, 4]);
      ring(o.x, o.y, L[o.subtype] * o.radius, '#FF54AD', 1.8, []);
      c.setLineDash([]); c.fillStyle = '#fff'; c.beginPath(); c.arc(o.x, o.y, 2.5 / z, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#50F0FA'; c.beginPath(); c.arc(p.x, p.y, 2.5 / z, 0, Math.PI * 2); c.fill();
    c.restore();
  }, { L });
}

async function stills({ frames, cases, L }) {
  const facts = {};
  for (const v of VARIANTS) {
  const srv = await serve({ root: shotRoot(v) });
  try {
    for (const frame of frames) {
      const g = await session(srv.url, frame);
      try {
        for (const caseId of cases) for (const moment of ['locked', 'unlocked']) {
          const f = await stage(g.page, { variant: v, caseId, moment });
          await paintAfterDecode(g.page, 900);
          const dir = path.join(SH, v); fs.mkdirSync(dir, { recursive: true });
          const key = `${frame}-${caseId}-${moment}`;
          const clip = await g.page.evaluate(() => window.__clip);
          await g.page.screenshot({ path: path.join(dir, key + '.png') });
          await g.page.screenshot({ path: path.join(dir, key + '-zoom.png'), clip });
          await g.page.evaluate(() => window.game.render(window.performance.now() / 1000));
          await diag(g.page, L[v]);
          await g.page.screenshot({ path: path.join(dir, key + '-diag.png') });
          await g.page.screenshot({ path: path.join(dir, key + '-diag-zoom.png'), clip });
          (facts[key] = facts[key] || {})[v] = f;
        }
        if (g.errors.length) facts['errors-' + v + '-' + frame] = g.errors;
      } finally { await g.browser.close(); }
    }
  } finally { srv.server.close(); }
  }
  // side by side
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
    for (const key of Object.keys(facts).filter(k => !k.startsWith('errors'))) for (const suf of ['', '-diag', '-zoom', '-diag-zoom']) {
      const [frame, caseId, moment] = key.split('-');
      const imgs = VARIANTS.map(v => fs.readFileSync(path.join(SH, v, key + suf + '.png')).toString('base64'));
      const cap = (v) => { const f = facts[key][v]; return `<b>${v === 'BEFORE' ? 'BEFORE (produkcja)' : 'FINAL (wariant B)'}</b><br>R ${f.R} (${f.tier}, ${f.units} j.) · korpus ${f.disc} · ${CASES[caseId].pilot}: L ${f.pilotL}, r ${f.pilotR} · <span style="color:${f.canEat ? '#46D99A' : '#FF54AD'}">${f.canEat ? 'JADALNY' : 'ZABLOKOWANY'}</span>`; };
      const title = `${caseId}: ${CASES[caseId].label} — ${moment === 'locked' ? 'tuż PRZED odblokowaniem (0,3 j. przed progiem: ten sam postęp w każdym wariancie)' : 'w momencie ODBLOKOWANIA (próg)'}${suf.includes('diag') ? ' — NAKŁADKA DIAGNOSTYCZNA' : ''}${suf.includes('zoom') ? ' — zbliżenie' : ''}`;
      const w = suf.includes('zoom') ? (frame === 'pc' ? 600 : 390) : frame === 'pc' ? 640 : 300;
      await page.setContent(`<body style="margin:0;background:#05070f;color:#e8f2ff;font:500 13px system-ui"><div id=w style="display:inline-block;padding:8px"><div style="padding:4px 2px 8px;font-weight:700;font-size:15px">${title}</div><div style="display:flex;gap:10px">${VARIANTS.map((v, i) => `<figure style="margin:0;width:${w}px"><figcaption style="padding:0 0 5px;line-height:1.35">${cap(v)}</figcaption><img style="width:${w}px" src="data:image/png;base64,${imgs[i]}"></figure>`).join('')}</div>${suf.includes('diag') ? '<div style="padding:8px 2px 0;font-size:12px;opacity:.85">cyjan ciągły = korpus wiru 1,07 R · cyjan kropkowany = czarna gardziel 0,65 R · zielony przerywany = zasięg pochłaniania 0,85 R · zielony kropkowany = zasięg fragmentu T1 1,0 R · biały przerywany = hitbox obiektu r · różowy = dłuższa półoś obrazu L</div>' : ''}</div></body>`);
      await page.waitForFunction(() => [...document.images].every(i => i.complete));
      await page.locator('#w').screenshot({ path: path.join(SH, key + suf + '.png') });
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(SH, 'facts.json'), JSON.stringify(facts, null, 1));
  return facts;
}

async function videos({ cases }) {
  fs.mkdirSync(VID, { recursive: true });
  const out = {}, stripJobs = [];
  for (const v of VARIANTS) {
  const srv = await serve({ root: shotRoot(v) });
  try {
    for (const caseId of cases) {
      const f = FRAMES.mobile;
      const browser = await chromium.launch();
      try {
        const tmp = path.join(VID, '.tmp'); fs.rmSync(tmp, { recursive: true, force: true });
        // a first page writes the veteran save, a second (recorded) one plays
        const ctx0 = await browser.newContext({ viewport: { width: f.w, height: f.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'pl-PL' });
        const { QA_BRIDGE } = await import('./lib.mjs');
        await ctx0.addInitScript(QA_BRIDGE); await ctx0.addInitScript(QA_RANDOM);
        await ctx0.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
        const p0 = await ctx0.newPage(); await p0.goto(srv.url);
        await p0.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
        const save = await veteranSave(p0, { missions: 29, coins: 800, runsPlayed: 12 });
        await ctx0.close();
        const ctx = await browser.newContext({ viewport: { width: f.w, height: f.h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, locale: 'pl-PL', recordVideo: { dir: tmp, size: { width: f.w, height: f.h } } });
        await ctx.addInitScript(QA_BRIDGE); await ctx.addInitScript(QA_RANDOM);
        await ctx.addInitScript((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
        await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
        const page = await ctx.newPage(); await page.goto(srv.url);
        await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
        const facts = await stage(page, { variant: v, caseId, moment: 'video' });
        await page.evaluate(() => { const g = window.game; g.keyDir = { x: 0, y: 0 }; });
        await page.waitForTimeout(1300);   // bitmaps decode, the scene is still
        const t0 = Date.now(), log = [];
        await page.evaluate(() => { window.game.keyDir = { x: 1, y: 0 }; });
        const frames = [];
        for (let i = 0; i < (caseId === 'D' ? 48 : 28); i++) {
          await page.waitForTimeout(150);
          log.push(await page.evaluate(() => { const g = window.game, p = g.player, { P } = window.__st; return { t: 0, R: +p.radius.toFixed(1), drawnR: p.surgeAt != null ? 'swell' : '', tier: g.lastSizeTierId, pilotEating: !!P.eating, pilotGone: !g.objects.includes(P) || P.consumed }; }));
          log[log.length - 1].t = Date.now() - t0;
          if (i % 2 === 1) frames.push({ i: log.length - 1, png: (await page.screenshot({ clip: { x: 0, y: Math.round(f.h * 0.22), width: f.w, height: Math.round(f.h * 0.56) } })).toString('base64') });
        }
        await page.evaluate(() => { window.game.keyDir = { x: 0, y: 0 }; });
        await page.waitForTimeout(600);
        const vp = await page.video().path();
        await ctx.close();
        fs.copyFileSync(vp, path.join(VID, `${v}-${caseId}.webm`));
        fs.rmSync(tmp, { recursive: true, force: true });
        out[`${v}-${caseId}`] = { ...facts, log };
        // a strip of 8 frames around the tier crossing (every 0.3 s) -- a preview without a webm player
        const cross = Math.max(0, log.findIndex(x => x.tier !== log[0].tier));
        const k0 = Math.max(0, frames.findIndex(fr => fr.i >= cross) - 2), pick = frames.slice(k0, k0 + 8);
        stripJobs.push({ file: path.join(VID, `${v}-${caseId}-klatki.png`), title: `${v === 'BEFORE' ? 'BEFORE (produkcja)' : 'FINAL (wariant B)'} — przypadek ${caseId} (${CASES[caseId].label}): moment odblokowania, klatki co ~0,3 s`, frames: pick.map(fr => ({ png: fr.png, cap: `t ${(log[fr.i].t / 1000).toFixed(1)} s · R ${log[fr.i].R} · ${log[fr.i].tier}${log[fr.i].pilotEating ? ' · POŁYKA' : ''}` })) });
        console.log('  video', v, caseId, 'tier path', [...new Set(log.map(x => x.tier))].join('>'), 'pilot eaten', log.some(x => x.pilotEating));
      } finally { await browser.close(); }
    }
  } finally { srv.server.close(); }
  }
  fs.writeFileSync(path.join(VID, 'facts.json'), JSON.stringify(out, null, 1));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
    for (const j of stripJobs) {
      await page.setContent(`<body style="margin:0;background:#05070f;color:#e8f2ff;font:500 12px system-ui"><div id=w style="display:inline-block;padding:8px"><div style="padding:2px 2px 8px;font-weight:700;font-size:14px">${j.title}</div><div style="display:grid;grid-template-columns:repeat(4,240px);gap:8px">${j.frames.map(fr => `<figure style="margin:0"><img style="width:240px" src="data:image/png;base64,${fr.png}"><figcaption>${fr.cap}</figcaption></figure>`).join('')}</div></div></body>`);
      await page.waitForFunction(() => [...document.images].every(i => i.complete));
      await page.locator('#w').screenshot({ path: j.file });
    }
  } finally { await browser.close(); }
  return out;
}

if (isMain(import.meta.url)) {
  const only = opt('only', 'stills,video').split(','), frames = opt('frames', 'pc,mobile').split(','), cases = opt('cases', 'A,B,C,E,D').split(',');
  // L in units of r per kind, from the measurement (qa/sizecons1-measure.mjs): long half-extent of the picture as drawn / r, per variant
  BASE = path.resolve(opt('base', '../vh-base-1ca38df'));
  const M = JSON.parse(fs.readFileSync(path.join(DIR, 'results-final-fast.json'), 'utf8')).data.measure;
  (async () => {
    if (only.includes('stills')) {
      // the overlay's L (long half-extent / r) per variant and kind, as measured (qa/sizecons1-measure.mjs --tag=pilot)
      const Ls = {}; for (const v of VARIANTS) { Ls[v] = {}; for (const [k, o] of Object.entries(M[v].kinds)) Ls[v][k] = Math.max(o.halfW, o.halfH) / o.r; }
      const facts = await stills({ frames, cases, L: Ls });
      console.log('stills', Object.keys(facts).length);
    }
    if (only.includes('video')) await videos({ cases: cases.filter(c => c === 'A' || c === 'C' || c === 'D') });
  })().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
}
