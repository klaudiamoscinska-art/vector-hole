// GG-UI-01 report (not a test): what the new HUD costs to draw, base vs
// candidate, measured alternately inside every repetition on the same
// machine. Each stage-1 scene is staged (seeded, virtual clock -- the world
// is identical on both, see `ui1-shots.mjs --compare`), then the SAME frozen
// frame is rendered N times with the game's own render() / renderCampaign()
// and flushed (a 1 px getImageData; canvas work is otherwise deferred).
// Also, separately: the minimap alone -- painting its backdrop (cache cold),
// fetching it (cache warm) and drawing one frame of marks -- and the DOM HUD
// update (updateHUD() / updateCampaignHUD()) on a changing state.
//   node qa/ui1-bench.mjs --base=DIR [--reps=3] [--frames=240]
// Output: qa/out/ui1-bench.json and a table. Chromium headless rasterizes in
// software here: absolute numbers are pessimistic, only the pairs compare.
// Safari / iPhone are not measurable this way.
import fs from 'node:fs';
import path from 'node:path';
import { serve, OUT, ROOT } from './lib.mjs';
import { stage, openScene, SCENES } from './ui1-shots.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const BASE = opt('base', null), REPS = +opt('reps', 3), FRAMES = +opt('frames', 240);
if (!BASE) { console.error('usage: node qa/ui1-bench.mjs --base=<checkout of the base>'); process.exit(2); }
const PHONE = { width: 390, height: 844, mobile: true }, CG = { width: 800, height: 450, mobile: false };
const LIST = [
  ...SCENES.map(s => ({ id: s.id, vp: s.vp, spec: s.spec, gfx: 2 })),
  { id: 'arena-late-gfx0', vp: PHONE, spec: { mode: 'arena', seed: 4242, secs: 104, skill: 0.72 }, gfx: 0 },
  { id: 'crazygames-gfx0', vp: CG, spec: { mode: 'arena', seed: 4242, secs: 52, skill: 0.6 }, gfx: 0 },
  { id: 'daily-gfx0', vp: PHONE, spec: { mode: 'daily', secs: 46, skill: 0.5 }, gfx: 0 }
];

const MEASURE = async ({ frames, gfx }) => {
  const g = window.game, real = Performance.prototype.now.bind(performance), campaign = g.mode === 'campaign';
  const q = (a, f) => { const s = a.slice().sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.round(f * (s.length - 1)))].toFixed(4); };
  const st = (a) => ({ p50: q(a, 0.5), p95: q(a, 0.95), mean: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(4) });
  const flush = () => g.ctx.getImageData(0, 0, 1, 1);
  g.applyGfx(gfx);
  // a combo on screen: the widgets under the clock are part of the frame
  g.comboCount = Math.max(g.comboCount, 6); g.comboMultiplier = 1.6; g.comboTimer = 1; g.comboDisplayAlpha = 1;
  for (let i = 0; i < 30; i++) { window.__vnow += 16; window.__ui1Draw(); } flush();
  const frame = [];
  for (let i = 0; i < frames; i++) { window.__vnow += 16; const t = real(); window.__ui1Draw(); flush(); frame.push(real() - t); }
  // the minimap alone
  const map = campaign ? () => g.drawCampaignMinimap(g.ctx) : () => g.drawMinimap(g.ctx), marks = [];
  for (let i = 0; i < frames; i++) { const t = real(); map(); flush(); marks.push(real() - t); }
  const size = g.minimapSize(), bounds = campaign ? CONFIG.campaign.bounds : { minX: 0, minY: 0, maxX: WORLD_W, maxY: WORLD_H }, theme = campaign ? g.campaignTheme() : null;
  const back = g.cityFloor.hudMinimap ? () => g.cityFloor.hudMinimap(Math.round(size * g.dpr), theme, bounds, campaign ? null : 'plac', size) : () => g.cityFloor.minimap(Math.round(size * g.dpr), theme, bounds);
  const cold = [], warm = [];
  for (let i = 0; i < 25; i++) { g.cityFloor.minimaps.clear(); const t = real(); const cv = back(); cv.getContext('2d').getImageData(0, 0, 1, 1); cold.push(real() - t); }
  for (let i = 0; i < 400; i++) { const t = real(); back(); warm.push(real() - t); }
  // the DOM HUD on a changing state (the score and the growth move every frame)
  const hud = [], r0 = g.player.radius, s0 = g.player.score, gu = campaign ? g.mission.growthUnits : 0;
  for (let i = 0; i < frames; i++) {
    g.player.score = s0 + i * 7; if (campaign) g.mission.growthUnits = gu + (i % 40); else g.player.radius = r0 + (i % 40) * 0.2;
    const t = real(); if (campaign) g.updateCampaignHUD(); else g.updateHUD(); void document.getElementById('hud').offsetHeight; hud.push(real() - t);
  }
  g.player.radius = r0; g.player.score = s0; if (campaign) g.mission.growthUnits = gu;
  return { frame: st(frame), marks: st(marks), cold: st(cold), warm: st(warm), hud: st(hud), objects: campaign ? g.campaignEntities.length : g.objects.length, mapPx: Math.round(size) };
};

const servers = { base: await serve({ root: path.resolve(BASE) }), cand: await serve({ root: ROOT }) };
const out = {};
const ONLY = opt('only', '').split(',').filter(Boolean);
for (const sc of LIST) {
  if (ONLY.length && !ONLY.includes(sc.id)) continue;
  const acc = { base: [], cand: [] };
  for (let r = 0; r < REPS; r++) {
    for (const who of r % 2 ? ['cand', 'base'] : ['base', 'cand']) {
      const g = await openScene(servers[who].url, sc.vp);
      await stage(g.page, sc.spec);
      await g.page.evaluate(() => document.fonts.ready);
      acc[who].push(await g.page.evaluate(MEASURE, { frames: FRAMES, gfx: sc.gfx }));
      await g.browser.close();
    }
  }
  const med = (who, k, f) => { const a = acc[who].map(x => x[k][f]).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
  out[sc.id] = { viewport: `${sc.vp.width}x${sc.vp.height}`, gfx: sc.gfx, objects: acc.cand[0].objects, mapPx: acc.cand[0].mapPx };
  for (const k of ['frame', 'marks', 'cold', 'warm', 'hud']) out[sc.id][k] = { base: [med('base', k, 'p50'), med('base', k, 'p95')], cand: [med('cand', k, 'p50'), med('cand', k, 'p95')] };
  const o = out[sc.id], d = (k, i) => `${o[k].base[i].toFixed(2)} -> ${o[k].cand[i].toFixed(2)}`;
  console.log(`${sc.id.padEnd(24)} ${o.viewport.padEnd(9)} gfx${sc.gfx}  frame p50 ${d('frame', 0)}  p95 ${d('frame', 1)} ms | minimap marks p50 ${d('marks', 0)} p95 ${d('marks', 1)} | backdrop painted ${d('cold', 0)} cached ${o.warm.base[0].toFixed(4)} -> ${o.warm.cand[0].toFixed(4)} | DOM HUD p50 ${d('hud', 0)} p95 ${d('hud', 1)}`);
  fs.writeFileSync(path.join(OUT, 'ui1-bench.json'), JSON.stringify({ reps: REPS, frames: FRAMES, base: path.resolve(BASE), when: new Date().toISOString(), scenes: out }, null, 1));
}
servers.base.server.close(); servers.cand.server.close();
