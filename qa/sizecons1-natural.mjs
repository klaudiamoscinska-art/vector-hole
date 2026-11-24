// GG-SIZE-CONSISTENCY-01 final visual check, not a test: NATURAL (unstaged) Arena frames, BEFORE (production checkout) vs FINAL (this one).
//   node qa/sizecons1-natural.mjs --base=DIR [--frames=pc,mobile] [--seed=5021]
// A real Arena round (veteran save, gfx 2, the seed below) played by a casual-style steering bot through the game's own Game.update() in
// virtual time (30 fps): it re-aims every 0.4 s at the nearest thing it can eat on screen, runs from a bigger rival nearby, wanders
// otherwise. Nothing is placed by hand; camera, zoom and HUD are the game's own; Game.render() draws every frame that is captured.
// Phases: T1 (1 s into the round), T2 (+1 s after entering it), T3 / T4 (+2 s), T5 / T6 (+2 s / +3 s), plus the real crossing into T4:
// 0.6 s before to 1.0 s after, every 2nd frame (15 fps), stitched into a strip and played back into a .webm.
// Output: qa/out/sizecons1/natural/<BEFORE|FINAL>/<frame>-<phase>.png, side by side natural/<frame>-<phase>.png,
//         natural/<BEFORE|FINAL>-<frame>-unlock-T4/ frames + -strip.png + .webm, facts.json
import fs from 'node:fs';
import path from 'node:path';
import { serve, chromium, isMain, ROOT } from './lib.mjs';
import { session, paintAfterDecode, FRAMES } from './objraster2-shots.mjs';
import { exportedRoot, DIR } from './sizecons1-measure.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const OUTD = path.join(DIR, 'natural');
const PHASES = [['T1', 1, 1.0], ['T2', 2, 1.0], ['T3', 3, 2.0], ['T4', 4, 2.0], ['T5', 5, 2.0], ['T6', 6, 3.0]];

const STEER = `
window.__natStart = function (seed) {
  const g = window.game, real = window.__realNow || (window.__realNow = performance.now.bind(performance));
  window.__vnow = 1e6; performance.now = () => window.__vnow;
  window.__qaSeedRandom(seed); g.applyGfx(2); g.startRound({ seed }); if (g.rafId) cancelAnimationFrame(g.rafId); g.running = false;
  window.__nat = { f: 0, wander: 0.5 };
  return { R: g.player.radius };
};
window.__natStep = function (n) {
  const g = window.game, p = g.player, S = window.__nat, dt = 1 / 30;
  for (let i = 0; i < n && g.state === 'PLAYING'; i++) {
    if (g.evolutionPending) { g.skipEvolutionOffer(); continue; }
    if (S.f % 12 === 0) {
      const vw = g.width / g.zoom / 2, vh = g.height / g.zoom / 2, on = (x, y) => Math.abs(x - p.x) < vw && Math.abs(y - p.y) < vh;
      let dir = null;
      for (const b of g.bots) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (b.radius > p.radius * 1.15 && d < 150 + b.radius) { dir = { x: (p.x - b.x) / (d + 1), y: (p.y - b.y) / (d + 1) }; break; } }
      if (!dir) {
        let best = null, bd = Infinity;
        for (const b of g.bots) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (on(b.x, b.y) && p.radius > b.radius * 1.3 && !b.invulnerable && d < bd) { bd = d; best = b; } }
        if (!best) for (const o of g.objects) { if (o.eating || !g.holeCanEat(p, o) || !on(o.x, o.y)) continue; const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } }
        if (best) { const m = Math.hypot(best.x - p.x, best.y - p.y) || 1; dir = { x: (best.x - p.x) / m, y: (best.y - p.y) / m }; }
        else { S.wander += (Math.random() - 0.5) * 1.2; dir = { x: Math.cos(S.wander), y: Math.sin(S.wander) }; }
      }
      g.keyDir = dir;
    }
    window.__vnow += dt * 1000; g.update(dt); S.f++;
  }
  g.render(window.__vnow / 1000);
  let tier = 0; window.game.constructor; for (let k = 0; k < 6; k++) if (p.radius >= [0, 30, 46, 66, 90, 118][k]) tier = k + 1;
  return { t: +(S.f / 30).toFixed(2), R: +p.radius.toFixed(2), tier, last: g.lastSizeTierId, zoom: +g.zoom.toFixed(3), state: g.state, surging: p.surgeAt != null };
};`;

async function play(url, frame, seed, dir, tagName) {
  const g = await session(url, frame);
  const facts = { shots: {}, unlock: [] };
  try {
    await g.page.addScriptTag({ content: STEER });
    await g.page.evaluate((s) => window.__natStart(s), seed);
    await g.page.evaluate(() => window.__natStep(1));
    await paintAfterDecode(g.page, 1500);   // the bitmaps decode (the game's own lazy decode)
    const enteredAt = {}, buf = [], uDir = path.join(dir, `${frame}-unlock-T4`); fs.mkdirSync(uDir, { recursive: true });
    let st = await g.page.evaluate(() => window.__natStep(0)), crossed = null;
    for (let guard = 0; guard < 2000 && st.state === 'PLAYING' && Object.keys(facts.shots).length < PHASES.length; guard++) {
      const nearT4 = st.tier === 3 && crossed == null, after = crossed != null && buf.length < crossed + 16;
      st = await g.page.evaluate((n) => window.__natStep(n), nearT4 || after ? 2 : 3);
      for (let k = 1; k <= 6; k++) if (st.tier >= k && enteredAt[k] == null) enteredAt[k] = st.t;
      // the real crossing into T4: a rolling window of T3 frames (0.6 s), then the first T4 frame and 1 s after it
      if (st.tier === 3 && crossed == null || st.tier >= 4 && crossed == null && buf.length || after) {
        const png = await g.page.screenshot();
        buf.push({ png, st });
        if (crossed == null && st.tier >= 4) crossed = buf.length - 1;
        if (crossed == null && buf.length > 9) buf.shift();
      }
      for (const [name, k, after] of PHASES) {
        if (facts.shots[name] || enteredAt[k] == null || st.t < enteredAt[k] + after) continue;
        if (st.tier !== k) { facts.shots[name] = { skipped: true, reason: `already ${st.tier} at ${st.t} s` }; continue; }
        await g.page.screenshot({ path: path.join(dir, `${frame}-${name}.png`) });
        facts.shots[name] = { ...st, enteredAt: enteredAt[k] };
      }
    }
    if (crossed != null) buf.slice(0, crossed + 16).forEach((b, i) => { fs.writeFileSync(path.join(uDir, `${String(i).padStart(2, '0')}.png`), b.png); facts.unlock.push({ i, ...b.st }); });
    facts.enteredAt = enteredAt; facts.errors = g.errors;
  } finally { await g.browser.close(); }
  console.log(`  ${tagName} ${frame}: phases ${Object.keys(facts.shots).join(',')}, tiers at ${JSON.stringify(facts.enteredAt)}, unlock frames ${facts.unlock.length}`);
  return facts;
}

async function compose(facts, frames) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
    const b64 = (f) => fs.readFileSync(f).toString('base64');
    for (const frame of frames) for (const [name] of PHASES) {
      const fa = facts.BEFORE[frame].shots[name], fb = facts.FINAL[frame].shots[name];
      const fl = (v) => path.join(OUTD, v, `${frame}-${name}.png`);
      if (!fs.existsSync(fl('BEFORE')) || !fs.existsSync(fl('FINAL'))) continue;
      const w = frame === 'pc' ? 760 : 330, cap = (v, f) => `<b>${v === 'BEFORE' ? 'BEFORE (produkcja)' : 'FINAL (wariant B)'}</b> · ${f.t} s rundy · R ${f.R} · ${name} (wejście w ${f.enteredAt} s) · zoom ${f.zoom}`;
      await page.setContent(`<body style="margin:0;background:#05070f;color:#e8f2ff;font:500 13px system-ui"><div id=w style="display:inline-block;padding:8px"><div style="padding:2px 2px 8px;font-weight:700;font-size:15px">Naturalna runda (bez ustawiania obiektów, kamera/zoom/HUD gry) — faza ${name} — ${frame === 'pc' ? 'PC 1280×720' : 'emulacja telefonu 390×844'}</div><div style="display:flex;gap:10px">${[['BEFORE', fa], ['FINAL', fb]].map(([v, f]) => `<figure style="margin:0;width:${w}px"><figcaption style="padding:0 0 5px">${cap(v, f)}</figcaption><img style="width:${w}px" src="data:image/png;base64,${b64(fl(v))}"></figure>`).join('')}</div></div></body>`);
      await page.waitForFunction(() => [...document.images].every(i => i.complete));
      await page.locator('#w').screenshot({ path: path.join(OUTD, `${frame}-${name}.png`) });
    }
    // unlock strips + webm playback of the real frames
    for (const v of ['BEFORE', 'FINAL']) for (const frame of frames) {
      const U = facts[v][frame].unlock; if (!U.length) continue;
      const dir = path.join(OUTD, v, `${frame}-unlock-T4`), files = U.map(u => path.join(dir, `${String(u.i).padStart(2, '0')}.png`));
      const pick = U.filter((u, i) => i % 2 === 0).slice(0, 12), tw = frame === 'pc' ? 300 : 150;
      await page.setContent(`<body style="margin:0;background:#05070f;color:#e8f2ff;font:500 11px system-ui"><div id=w style="display:inline-block;padding:8px"><div style="padding:2px 2px 8px;font-weight:700;font-size:14px">${v === 'BEFORE' ? 'BEFORE (produkcja)' : 'FINAL (wariant B)'} — prawdziwe przejście T3 → T4 w naturalnej rundzie, ${frame === 'pc' ? 'PC' : 'telefon (emulacja)'}, co ~0,13 s</div><div style="display:grid;grid-template-columns:repeat(6,${tw}px);gap:6px">${pick.map(u => `<figure style="margin:0"><img style="width:${tw}px" src="data:image/png;base64,${b64(files[u.i])}"><figcaption>${u.t} s · R ${u.R} · T${u.tier}${u.surging ? ' · skok' : ''}</figcaption></figure>`).join('')}</div></div></body>`);
      await page.waitForFunction(() => [...document.images].every(i => i.complete));
      await page.locator('#w').screenshot({ path: path.join(OUTD, `${v}-${frame}-unlock-T4-strip.png`) });
      const f = FRAMES[frame], ctx = await browser.newContext({ viewport: { width: f.w, height: f.h }, recordVideo: { dir: path.join(OUTD, '.vid'), size: { width: f.w, height: f.h } } });
      const vp = await ctx.newPage();
      await vp.setContent(`<body style="margin:0;background:#000"><img id=i style="width:${f.w}px;height:${f.h}px;display:block"></body>`);
      for (let rep = 0; rep < 2; rep++) for (const file of files) { await vp.evaluate((s) => { document.getElementById('i').src = 'data:image/png;base64,' + s; }, b64(file)); await vp.waitForTimeout(133); }
      const p = await vp.video().path(); await ctx.close();
      fs.copyFileSync(p, path.join(OUTD, `${v}-${frame}-unlock-T4.webm`));
    }
  } finally { await browser.close(); fs.rmSync(path.join(OUTD, '.vid'), { recursive: true, force: true }); }
}

if (isMain(import.meta.url)) {
  const base = opt('base', null); if (!base) { console.error('--base=DIR required'); process.exit(2); }
  const frames = opt('frames', 'pc,mobile').split(','), seed = +opt('seed', 5021);
  (async () => {
    fs.mkdirSync(OUTD, { recursive: true });
    const roots = { BEFORE: exportedRoot(path.resolve(base), 'nat-base'), FINAL: exportedRoot(ROOT, 'nat-final') }, facts = {};
    for (const v of ['BEFORE', 'FINAL']) {
      const srv = await serve({ root: roots[v] }); facts[v] = {};
      const dir = path.join(OUTD, v); fs.mkdirSync(dir, { recursive: true });
      try { for (const frame of frames) facts[v][frame] = await play(srv.url, frame, seed, dir, v); } finally { srv.server.close(); }
    }
    await compose(facts, frames);
    fs.writeFileSync(path.join(OUTD, 'facts.json'), JSON.stringify({ seed, facts }, null, 1));
  })().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
}
