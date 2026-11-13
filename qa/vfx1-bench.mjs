// GG-VFX-01 measurement, not a test: the cost of a frame while the vortex
// swallows without a pause -- the worst case for the new effects. A base
// checkout and this one play the SAME staged feast (same seed, same clock,
// same objects fed to the rim every few frames: small ones in a stream, a
// medium, a large one and a rival in turn) and are measured alternately,
// repetition by repetition, in one browser session each (never in parallel).
// Per frame: update() ms and render() + raster ms (a 1 px getImageData flush).
// Headless Chromium rasterizes in software: the numbers are pessimistic and
// only comparable with each other, on this machine.
//   node qa/vfx1-bench.mjs --root /path/to/base [--reps=5] [--gfx=2|0] [--frame=iphone|desktop]
//   --off=drawSwallowRim,drawGulps,... (diagnosis: this checkout without those Game draw passes)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT } from './lib.mjs';
import { open, FRAMES } from './vfx1-shots.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); if (a) return a.slice(k.length + 3); const i = process.argv.indexOf(`--${k}`); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const REPS = Number(opt('reps', 5)), FRAMES_N = 600;

async function feast(page, gfx, mode) {
  return page.evaluate(({ gfx, mode, N }) => {
    const g = window.game, dt = 1 / 60;
    const real = window.__realNow || (window.__realNow = performance.now.bind(performance));
    let now = 800000; performance.now = () => now;
    window.__qaSeedRandom(21);
    g.applyGfx(gfx);
    g.startRound({ seed: 4242 });
    if (g.rafId) cancelAnimationFrame(g.rafId);
    g.running = false;
    g.checkEvolutionTriggers = () => {};
    const p = g.player;
    p.skin = 'pink';
    const R = mode === 'idle' ? 150 : 150;
    const hold = () => { p.x = WORLD_W / 2; p.y = WORLD_H / 2; p.radius = R; };
    g.keyDir = { x: 0, y: 0 };
    for (let k = 0; k < 120; k++) { hold(); now += dt * 1000; g.update(dt); g.render(now / 1000); }
    const upd = [], ren = [];
    let eats = 0, fed = 0;
    for (let f = 0; f < N; f++) {
      hold();
      if (mode === 'feast') {
        // The stream: two small things every 3rd frame, a medium every 20th, a large every 45th, a rival every 90th.
        const feed = (pred, n) => { let k = 0; for (const o of g.objects) { if (k >= n) break; if (o.eating || !pred(o) || !g.holeCanEat(p, o)) continue; const a = (fed++) * 2.399; o.x = p.x + Math.cos(a) * R * 0.8; o.y = p.y + Math.sin(a) * R * 0.8; k++; } };
        if (f % 3 === 0) feed(o => TIERS[o.tier].minSizeTier <= 1, 2);
        if (f % 20 === 0) feed(o => TIERS[o.tier].minSizeTier === 2 || TIERS[o.tier].minSizeTier === 3, 1);
        if (f % 45 === 0) feed(o => TIERS[o.tier].minSizeTier >= 4, 1);
        if (f % 90 === 30) { const b = g.bots[0]; b.radius = 50; b.invulnerableUntil = 0; b.x = p.x + R * 0.6; b.y = p.y; }
      }
      now += dt * 1000;
      const s0 = p.score;
      const t0 = real(); g.update(dt); const t1 = real();
      g.render(now / 1000); g.ctx.getImageData(0, 0, 1, 1); const t2 = real();
      if (p.score > s0) eats++;
      upd.push(t1 - t0); ren.push(t2 - t1);
    }
    performance.now = real;
    delete g.checkEvolutionTriggers;
    const st = (a) => { const s = a.slice().sort((x, y) => x - y), q = (k) => s[Math.min(s.length - 1, Math.round(k * (s.length - 1)))]; return { mean: a.reduce((x, y) => x + y, 0) / a.length, median: q(0.5), p95: q(0.95), p99: q(0.99), max: s[s.length - 1] }; };
    return { update: st(upd), render: st(ren), eats, score: p.score, randomCalls: window.__qaRandomCalls, particles: g.particles.length };
  }, { gfx, mode, N: FRAMES_N });
}

const base = opt('root', null);
if (!base) { console.error('usage: node qa/vfx1-bench.mjs --root /path/to/base'); process.exit(2); }
const frame = FRAMES[opt('frame', 'iphone')];
const gfxList = String(opt('gfx', '2,0')).split(',').map(Number);
const out = {};
const OFF = String(opt('off', '')).split(',').filter(Boolean);
const pages = { base: await open(path.resolve(base), { width: frame.width, height: frame.height }, frame.mobile), cand: await open(ROOT, { width: frame.width, height: frame.height }, frame.mobile) };
if (OFF.length) await pages.cand.page.evaluate((off) => { for (const fn of off) window.game[fn] = () => {}; }, OFF);
for (const gfx of gfxList) for (const mode of ['feast', 'idle']) {
  const acc = { base: [], cand: [] };
  for (let r = 0; r < REPS; r++) for (const name of (r % 2 ? ['cand', 'base'] : ['base', 'cand'])) acc[name].push(await feast(pages[name].page, gfx, mode));
  const med = (list, f) => { const s = list.map(f).sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const row = {};
  for (const name of ['base', 'cand']) row[name] = { renderMedian: med(acc[name], x => x.render.median), renderMean: med(acc[name], x => x.render.mean), renderP95: med(acc[name], x => x.render.p95), renderP99: med(acc[name], x => x.render.p99), renderMax: med(acc[name], x => x.render.max), updateMean: med(acc[name], x => x.update.mean), eats: acc[name][0].eats, score: acc[name][0].score, randomCalls: acc[name][0].randomCalls };
  out[`gfx${gfx}-${mode}`] = row;
  const b = row.base, c = row.cand, f = (v) => v.toFixed(2);
  console.log(`gfx ${gfx} ${mode.padEnd(5)} render ms  median ${f(b.renderMedian)} -> ${f(c.renderMedian)} · mean ${f(b.renderMean)} -> ${f(c.renderMean)} · p95 ${f(b.renderP95)} -> ${f(c.renderP95)} · p99 ${f(b.renderP99)} -> ${f(c.renderP99)} · max ${f(b.renderMax)} -> ${f(c.renderMax)} | update mean ${f(b.updateMean)} -> ${f(c.updateMean)} | eats ${b.eats} -> ${c.eats} · score ${b.score} -> ${c.score} · Math.random ${b.randomCalls} -> ${c.randomCalls}`);
}
const errors = [...pages.base.errors, ...pages.cand.errors];
await pages.base.close(); await pages.cand.close();
fs.mkdirSync(path.join(OUT, 'vfx1'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'vfx1', `bench-${opt('frame', 'iphone')}.json`), JSON.stringify({ reps: REPS, frames: FRAMES_N, viewport: frame, results: out }, null, 1));
console.log(errors.length ? 'console errors:\n  ' + errors.join('\n  ') : 'no console errors');
const same = Object.values(out).every(r => r.base.eats === r.cand.eats && r.base.score === r.cand.score && r.base.randomCalls === r.cand.randomCalls);
console.log(`${same ? 'PASS' : 'FAIL'} the feast played the same on both: eats, score and Math.random draws identical`);
process.exit(errors.length || !same ? 1 : 0);
