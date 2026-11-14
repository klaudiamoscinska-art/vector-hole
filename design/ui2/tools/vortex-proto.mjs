// GG-UI-02 stage 1, micro-audit "kierunek obrotu wiru" (design only).
// The game's files are NOT changed: the browser is handed a patched copy of
// game.js from memory (Playwright route), with three switches read at draw
// time (window.__vx). The same seeded Arena round is then recorded for every
// variant, frame by frame, around the player's vortex.
//   node design/ui2/tools/vortex-proto.mjs
// Output: design/ui2/vortex/frames/<skin>-<variant>-NN.png (git-ignored work
// files), then vortex-compose.py builds the film strips and the animations.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, openGame, QA_RANDOM, ROOT } from '../../../qa/lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', 'vortex', 'frames');
fs.mkdirSync(OUT, { recursive: true });

/** The in-memory patch. Every replacement must hit exactly `n` times or the run stops. */
function patchGame(src) {
  const rep = (from, to, n) => {
    const parts = src.split(from);
    if (parts.length - 1 !== n) throw new Error(`patch: expected ${n} x "${from.slice(0, 50)}", found ${parts.length - 1}`);
    src = parts.join(to);
  };
  // 1. Hole.draw(): both layer groups are drawn around (this.x, this.y); a mirror there turns every
  //    layer, the flow, the motes and the rim the other way AND flips the arms (they keep trailing).
  const a = src.indexOf('  draw(ctx, time, inner, over) {');
  const b = src.indexOf('    if (!this.name) return; // Warsztat previews draw a nameless hole', a);
  if (a < 0 || b < 0) throw new Error('patch: Hole.draw() not found');
  let body = src.slice(a, b);
  const hits = body.split('ctx.translate(this.x, this.y);').length - 1;
  if (hits !== 2) throw new Error('patch: expected 2 translates in Hole.draw(), found ' + hits);
  body = body.split('ctx.translate(this.x, this.y);').join('ctx.translate(this.x, this.y); if (window.__vx && (window.__vx.mirror === "all" || (window.__vx.mirror === "player" && this.isPlayer))) ctx.scale(-1, 1);');
  src = src.slice(0, a) + body + src.slice(b);
  // 2. Eaten matter (the "suck" particles): the tangential part of the pull.
  rep('this.vx = (this.vx + (dx / d) * pull - (dy / d) * pull * 0.6) * 0.9;', 'const __s = window.__vx && window.__vx.suck ? window.__vx.suck(this.target) : 1; this.vx = (this.vx + (dx / d) * pull - (dy / d) * pull * 0.6 * __s) * 0.9;', 1);
  rep('this.vy = (this.vy + (dy / d) * pull + (dx / d) * pull * 0.6) * 0.9;', 'this.vy = (this.vy + (dy / d) * pull + (dx / d) * pull * 0.6 * __s) * 0.9;', 1);
  // 3. A swallowed object's spiral: today its direction is drawn per object (half go each way).
  rep('obj.swSpin = (f < 0.5 ? -1 : 1) * (2.2 + f * 1.2);', 'obj.swSpin = (window.__vx && window.__vx.swallow ? window.__vx.swallow(hole) : (f < 0.5 ? -1 : 1)) * (2.2 + f * 1.2);', 1);
  return src;
}

export const VARIANTS = {
  v0: { label: 'W0 · obecny', vx: null },
  v1: { label: 'W1 · pełne odwrócenie', vx: `({ mirror: 'all', suck: () => -1, swallow: null })` },
  v2: { label: 'W2 · spójny lej', vx: `({ mirror: null, suck: () => -1, swallow: () => 1 })` },
  v3: { label: 'W3 · tylko wir gracza', vx: `({ mirror: 'player', suck: (t) => (t && t.isPlayer ? -1 : 1), swallow: (h) => (h && h.isPlayer ? -1 : 1) })` }
};
export const SKINS = ['rainbow', 'krysztal', 'pink', 'pryzmat'];
const FRAMES = 40, CROP = 300;

const { server, url } = await serve();
const original = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
const patched = patchGame(original);
let bad = 0;
const factsPath = path.join(OUT, '..', 'facts.json');
const facts = fs.existsSync(factsPath) ? JSON.parse(fs.readFileSync(factsPath, 'utf8')) : {};
const skinArg = (process.argv.find(a => a.startsWith('--skins=')) || '').slice(8).split(',').filter(Boolean);
for (const skin of (skinArg.length ? skinArg : SKINS)) {
  for (const [vid, v] of Object.entries(VARIANTS)) {
    const g = await openGame(url, { viewport: { width: 390, height: 844 }, mobile: true, deviceScaleFactor: 2, initScript: QA_RANDOM });
    await g.context.route('**/game.js', (route) => route.fulfill({ contentType: 'text/javascript', body: vid === 'v0' ? original : patched }));
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
    const info = await g.page.evaluate(({ skin, vx }) => {
      const s = defaultSave();
      s.privacy = { decided: true, analytics: false, ads: false, ts: 1 };
      s.coach = { moved: true, ate: true, rival: true, danger: true };
      s.stats.runsPlayed = 9; s.owned = SKINS.map(x => x.id); s.selected = skin;
      s.unlocks.announced = ['warsztat', 'wyzwania', 'kampania', 'boosters'];
      const g = window.game; g.save = s;
      window.__vx = vx ? (0, eval)(vx) : null;
      window.__vnow = 700000; performance.now = () => window.__vnow;
      window.__qaSeedRandom(11);
      g.applyGfx(2);
      g.checkEvolutionTriggers = () => {};
      g.startRound({ seed: 4242 });
      cancelAnimationFrame(g.rafId); g.running = false;
      const p = g.player, dt = 1 / 30;
      window.__step = () => {
        let tx = 0, ty = 0, bs = -1;
        for (const o of g.objects) { if (o.eating || !g.holeCanEat(p, o)) continue; const d = Math.hypot(o.x - p.x, o.y - p.y); const sc = (o.value + 2) / (d + 40); if (sc > bs) { bs = sc; tx = o.x - p.x; ty = o.y - p.y; } }
        for (const b of g.bots) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (b.radius > p.radius * 1.08 && d < b.radius + 190) { tx = p.x - b.x; ty = p.y - b.y; break; } }
        const n = Math.hypot(tx, ty) || 1; g.keyDir = { x: tx / n, y: ty / n };
        window.__vnow += dt * 1000; g.update(dt);
      };
      for (let f = 0; f < 30 * 26; f++) window.__step();
      g.shake = 0; g.flashAlpha = 0;
      g.render(window.__vnow / 1000);
      document.getElementById('hud').style.visibility = 'hidden';
      return { score: Math.round(p.score), r: Math.round(p.radius), x: Math.round(p.x), y: Math.round(p.y), draws: window.__qaRandomCalls, skin: g.save.selected };
    }, { skin, vx: v.vx });
    facts[`${skin}-${vid}`] = info;
    for (let f = 0; f < FRAMES; f++) {
      const c = await g.page.evaluate(() => { const g = window.game; window.__step(); g.shake = 0; g.flashAlpha = 0; g.render(window.__vnow / 1000); const p = g.player; const z = g.zoom || 1; return { sx: g.width / 2 + (p.x - g.camera.x) * z, sy: g.height / 2 + (p.y - g.camera.y) * z, w: g.width, h: g.height }; });
      const cx = Number.isFinite(c.sx) && c.sx > 0 && c.sx < c.w ? c.sx : c.w / 2, cy = Number.isFinite(c.sy) && c.sy > 0 && c.sy < c.h ? c.sy : c.h / 2;
      await g.page.screenshot({ path: path.join(OUT, `${skin}-${vid}-${String(f).padStart(2, '0')}.png`), clip: { x: Math.max(0, Math.min(c.w - CROP, cx - CROP / 2)), y: Math.max(0, Math.min(c.h - CROP, cy - CROP / 2)), width: CROP, height: CROP } });
      if (f === 20 && skin === SKINS[0]) { await g.page.evaluate(() => { document.getElementById('hud').style.visibility = ''; }); await g.page.screenshot({ path: path.join(OUT, '..', `full-${vid}.jpg`), type: 'jpeg', quality: 78 }); await g.page.evaluate(() => { document.getElementById('hud').style.visibility = 'hidden'; }); }
    }
    if (g.errors.length) { bad++; console.log('ERRORS', skin, vid, g.errors.slice(0, 3)); }
    console.log('recorded', skin, vid, JSON.stringify(info));
    await g.browser.close();
  }
}
fs.writeFileSync(factsPath, JSON.stringify(facts, null, 1));
server.close();
process.exit(bad ? 1 : 0);
