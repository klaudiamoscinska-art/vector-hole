// GG-UX-03 paired frame-time bench (report only, not a gate): the base
// revision and this checkout measured alternately in every repetition on the
// same machine, same seed, virtual time. Per frame: update() and render() +
// a 1 px raster flush; inside render, the time in Hole.drawBody() (every
// vortex) and in the minimap. Headless Chromium rasterizes in software, so
// absolute numbers are pessimistic; only the base / candidate ratio matters.
// Usage: node design/ux3/tools/ux3-bench.mjs [--reps=3]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, revisionFile, QA_RANDOM, ROOT } from '../../../qa/lib.mjs';
import { UX3_BASE_REV } from '../../../qa/ux3.mjs';

const REPS = +((process.argv.find(a => a.startsWith('--reps=')) || '--reps=3').slice(7));
const tmp = path.join(ROOT, 'qa', 'out', 'ux3', 'bench-base');
fs.mkdirSync(tmp, { recursive: true });
for (const f of ['index.html', 'style.css', 'game.js']) fs.writeFileSync(path.join(tmp, f), revisionFile(UX3_BASE_REV, f));
const cand = await serve(), base = await serve({ root: tmp });

const SCEN = [
  { id: 'arena-iphone-390x844', vp: { width: 390, height: 844 }, dsf: 3, mobile: true, o: { seed: 4242, gfx: 2, ff: 30 } },
  { id: 'arena-320x568', vp: { width: 320, height: 568 }, dsf: 2, mobile: true, o: { seed: 4242, gfx: 2, ff: 30 } },
  { id: 'crazygames-800x450', vp: { width: 800, height: 450 }, dsf: 1, mobile: false, o: { seed: 4242, gfx: 2, ff: 30 } },
  { id: 'arena-late-T6-390', vp: { width: 390, height: 844 }, dsf: 3, mobile: true, o: { seed: 777, gfx: 2, ff: 20, bigR: 300, botR: 140 } },
  { id: 'swallow-heavy-390', vp: { width: 390, height: 844 }, dsf: 3, mobile: true, o: { seed: 777, gfx: 2, ff: 20, bigR: 440, botR: 160 } },
  { id: 'campaign-M05-390', vp: { width: 390, height: 844 }, dsf: 3, mobile: true, o: { campaign: 'M05', gfx: 2, ff: 10 } },
  { id: 'arena-gfx0-390', vp: { width: 390, height: 844 }, dsf: 3, mobile: true, o: { seed: 4242, gfx: 0, ff: 30 } },
  { id: 'arena-gfx1-390', vp: { width: 390, height: 844 }, dsf: 3, mobile: true, o: { seed: 4242, gfx: 1, ff: 30 } },
  { id: 'warsztat-390', vp: { width: 390, height: 844 }, dsf: 3, mobile: true, o: { warsztat: true } }
];

async function run(url, sc) {
  const g = await openGame(url, { viewport: sc.vp, mobile: sc.mobile, deviceScaleFactor: sc.dsf });
  const s = await veteranSave(g.page, { missions: 60, runsPlayed: 12 });
  s.settings.music = false; s.settings.sfx = false;
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), s);
  await g.page.reload();
  await g.page.waitForFunction(() => window.__qaBridge && window.__qaBridge.ready && window.game && window.game.state);
  await g.page.addScriptTag({ content: QA_RANDOM });
  const r = await g.page.evaluate((o) => {
    const gm = window.game, now = performance.now.bind(performance);
    let vnow = 1e6; performance.now = () => vnow;
    window.__qaSeedRandom(99);
    const H = gm.player ? gm.player.constructor : null;
    const pct = (a, p) => { const b = a.slice().sort((x, y) => x - y); return +b[Math.min(b.length - 1, Math.floor(p * b.length))].toFixed(3); };
    if (o.warsztat) {
      performance.now = now;
      gm.openWarsztatScreen();
      const t = []; const c = document.querySelector('#shopScreen canvas');
      for (let i = 0; i < 120; i++) { const t0 = now(); gm.renderWarsztatCanvases(10 + i / 30); window.__x = c && c.getContext('2d').getImageData(0, 0, 1, 1); t.push(now() - t0); }
      return { note: 'menu frame', p50: pct(t, 0.5), p95: pct(t, 0.95) };
    }
    gm.applyGfx(o.gfx); gm.checkEvolutionTriggers = () => {};
    if (o.campaign) { gm.startCampaignMission(o.campaign); gm.beginMissionPlay && gm.beginMissionPlay(); } else gm.startRound({ seed: o.seed });
    cancelAnimationFrame(gm.rafId); gm.running = false;
    const dt = 1 / 30;
    for (let f = 0; f < o.ff * 30 && gm.state === GameState.PLAYING; f++) { if (gm.evolutionPending) { gm.skipEvolutionOffer(); continue; } vnow += dt * 1000; gm.update(dt); }
    if (o.bigR) { gm.player.radius = o.bigR; gm.bots.forEach(b => { b.radius = o.botR; b.x = gm.player.x + (Math.random() - 0.5) * 900; b.y = gm.player.y + (Math.random() - 0.5) * 900; }); }
    // spies (wall-clock), installed after warm-up
    const Hole = gm.player.constructor; const db = Hole.prototype.drawBody; let holeMs = 0;
    Hole.prototype.drawBody = function (...a) { const t0 = now(); const r = db.apply(this, a); holeMs += now() - t0; return r; };
    const mmName = gm.mode === 'campaign' ? 'drawCampaignMinimap' : 'drawMinimap'; const mm = gm[mmName].bind(gm); let mapMs = 0;
    gm[mmName] = (...a) => { const t0 = now(); const r = mm(...a); mapMs += now() - t0; return r; };
    const upd = [], ren = [], hole = [], map = [];
    const draw = (t) => gm.mode === 'campaign' ? gm.renderCampaign(t) : gm.render(t);
    for (let i = 0; i < 20; i++) { vnow += dt * 1000; gm.update(dt); draw(vnow / 1000); }
    for (let f = 0; f < 300 && gm.state === GameState.PLAYING; f++) {
      if (gm.evolutionPending) { gm.skipEvolutionOffer(); continue; }
      vnow += dt * 1000;
      let t0 = now(); gm.update(dt); upd.push(now() - t0);
      holeMs = 0; mapMs = 0;
      t0 = now(); draw(vnow / 1000); gm.ctx.getImageData(0, 0, 1, 1); ren.push(now() - t0);
      hole.push(holeMs); map.push(mapMs);
    }
    Hole.prototype.drawBody = db; delete gm[mmName];
    performance.now = now;
    return { frames: ren.length, update: { p50: pct(upd, 0.5), p95: pct(upd, 0.95) }, render: { p50: pct(ren, 0.5), p95: pct(ren, 0.95), over16: ren.filter(x => x > 16.7).length, max: +Math.max(...ren).toFixed(2) },
      vortices: { p50: pct(hole, 0.5), p95: pct(hole, 0.95) }, minimap: { p50: pct(map, 0.5), p95: pct(map, 0.95) }, holes: 1 + gm.bots.length };
  }, sc.o);
  await g.browser.close();
  return r;
}

const out = { base: UX3_BASE_REV, reps: REPS, at: new Date().toISOString(), scenarios: {} };
for (const sc of SCEN) {
  out.scenarios[sc.id] = { base: [], cand: [] };
  for (let i = 0; i < REPS; i++) {
    const order = i % 2 ? [['cand', cand.url], ['base', base.url]] : [['base', base.url], ['cand', cand.url]];
    for (const [who, u] of order) out.scenarios[sc.id][who].push(await run(u, sc));
  }
  const med = (arr, f) => { const v = arr.map(f).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  const S = out.scenarios[sc.id];
  const row = (k, f) => `${k} ${med(S.base, f)} -> ${med(S.cand, f)}`;
  S.summary = S.base[0].frames != null
    ? [row('render p50', x => x.render.p50), row('render p95', x => x.render.p95), row('>16.7ms', x => x.render.over16), row('vortices p50', x => x.vortices.p50), row('vortices p95', x => x.vortices.p95), row('minimap p50', x => x.minimap.p50), row('minimap p95', x => x.minimap.p95), row('update p50', x => x.update.p50)].join(' | ')
    : [row('menu p50', x => x.p50), row('menu p95', x => x.p95)].join(' | ');
  console.log(sc.id.padEnd(22), S.summary);
}
fs.writeFileSync(path.join(ROOT, 'design', 'ux3', 'bench.json'), JSON.stringify(out, null, 2));
cand.server.close(); base.server.close();
