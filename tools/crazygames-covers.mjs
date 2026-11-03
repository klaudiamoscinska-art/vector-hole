// CRAZYGAMES-BASIC-1: the three submission covers + the 2:3 first video frame, drawn
// by the game's own art (its Hole.draw(), its world objects' drawObjectArt(), its fonts
// and palette) on one canvas: no screenshot, no third-party image, no text but the title.
//   node tools/crazygames-covers.mjs --game=DIR --out=DIR [--title="VECTOR HOLE"]
// Needs the Playwright install the QA suites use. Same sources = same pictures.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };

// sizes: docs.crazygames.com/requirements/game-covers/ (read 2026-11-03)
export const COVERS = [
  { file: 'landscape-1920x1080.png', w: 1920, h: 1080, hero: [0.715, 0.5], heroR: 0.325, spread: 0.72, title: { x: 0.262, y: 0.5, size: 0.17, align: 'center' } },
  { file: 'portrait-800x1200.png', w: 800, h: 1200, hero: [0.5, 0.635], heroR: 0.215, title: { x: 0.5, y: 0.215, size: 0.185, align: 'center' } },
  { file: 'square-800x800.png', w: 800, h: 800, hero: [0.5, 0.66], heroR: 0.235, title: { x: 0.5, y: 0.235, size: 0.2, align: 'center' } },
  // The portrait video's opening frame: the same picture as the portrait cover at the video's size.
  { file: 'video-first-frame-portrait-1080x1620.png', w: 1080, h: 1620, hero: [0.5, 0.635], heroR: 0.215, title: { x: 0.5, y: 0.215, size: 0.185, align: 'center' }, source: true }
];

/** Runs in the game's page: the picture is a pure function of the size and a fixed RNG. */
function drawCover(spec, titleText) {
  const { w: W, h: H, hero, heroR, title } = spec;
  const U = Math.min(W, H);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  let seed = 90210;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hx = hero[0] * W, hy = hero[1] * H, hr = heroR * U, spread = spec.spread || 1;

  // Night city floor in the game's palette: a tilted street grid, its blocks and crossings.
  const bg = c.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#071a2c'); bg.addColorStop(0.55, '#04101D'); bg.addColorStop(1, '#120a2c');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  c.save();
  c.translate(hx, hy); c.rotate(-0.26); c.translate(-hx, -hy);
  const cell = U * 0.36, road = cell * 0.2, D = Math.hypot(W, H);
  for (let gx = -D; gx < D * 2; gx += cell) {
    for (let gy = -D; gy < D * 2; gy += cell) {
      c.fillStyle = (Math.abs(Math.round(gx / cell) + Math.round(gy / cell)) % 3 === 0) ? 'rgba(152,117,255,0.075)' : 'rgba(80,240,250,0.04)';
      c.beginPath(); c.roundRect(gx + road / 2, gy + road / 2, cell - road, cell - road, cell * 0.06); c.fill();
      c.strokeStyle = 'rgba(104,245,252,0.20)'; c.lineWidth = U * 0.0016; c.stroke();
    }
  }
  c.strokeStyle = 'rgba(230,250,255,0.13)'; c.lineWidth = U * 0.002; c.setLineDash([U * 0.022, U * 0.024]);
  for (let gx = -D; gx < D * 2; gx += cell) { c.beginPath(); c.moveTo(gx, -D); c.lineTo(gx, D * 2); c.stroke(); c.beginPath(); c.moveTo(-D, gx); c.lineTo(D * 2, gx); c.stroke(); }
  c.setLineDash([]);
  c.restore();

  // The city's own objects, standing on the floor further from the pull.
  const Obj = window.game.objects[0].constructor;
  const art = (kind, color, x, y, r, rot, alpha) => {
    const o = Object.create(Obj.prototype);
    Object.assign(o, window.game.objects[0], { subtype: kind, color, radius: r, x: 0, y: 0, eating: false, swSeed: 1 });
    c.save(); c.translate(x, y); c.rotate(rot); c.globalAlpha = alpha;
    try { window.__coverArt(c, kind, color, r); } catch (e) { /* art kind missing */ }
    c.restore();
  };

  // Suction: glow under the vortex and streaks spiralling into it.
  const glow = c.createRadialGradient(hx, hy, hr * 0.5, hx, hy, hr * 3.2);
  glow.addColorStop(0, 'rgba(152,117,255,0.60)'); glow.addColorStop(0.42, 'rgba(255,84,173,0.17)'); glow.addColorStop(0.72, 'rgba(80,240,250,0.07)'); glow.addColorStop(1, 'rgba(80,240,250,0)');
  c.fillStyle = glow; c.fillRect(0, 0, W, H);
  const NEON = ['#50F0FA', '#FF54AD', '#9875FF', '#EFCB63', '#68F5FC'];
  c.lineCap = 'round';
  for (let i = 0; i < 170; i++) {
    const a0 = rnd() * Math.PI * 2, rad0 = hr * (1.05 + rnd() * rnd() * 3.1), sweep = 0.35 + rnd() * 0.75, col = NEON[Math.floor(rnd() * NEON.length)];
    c.strokeStyle = col; c.globalAlpha = (0.10 + rnd() * 0.38) * Math.min(1, hr * 2.6 / rad0);
    c.lineWidth = U * (0.0012 + rnd() * 0.0034);
    c.beginPath();
    for (let k = 0; k <= 22; k++) { const f = k / 22, a = a0 + f * sweep * 1.6, rr = rad0 * (1 - f * 0.20); const px = hx + Math.cos(a) * rr, py = hy + Math.sin(a) * rr; if (k) c.lineTo(px, py); else c.moveTo(px, py); }
    c.stroke();
  }
  c.globalAlpha = 1;

  // City objects dragged along the spiral: outer ones large, inner ones small; ghosts behind each.
  const items = [
    ['autobus', '#50F0FA', 2.95, 3.55, 0.22], ['pawilon', '#9875FF', 2.65, 5.35, 0.25], ['samochod', '#EFCB63', 2.2, 0.55, 0.165], ['latarnia', '#FF54AD', 2.05, 2.35, 0.135],
    ['samochod', '#50F0FA', 2.15, 4.4, 0.155], ['kapsula', '#50F0FA', 1.72, 1.45, 0.115], ['pawilon', '#FF54AD', 2.8, 1.55, 0.2], ['latarnia', '#50F0FA', 1.72, 5.95, 0.105],
    ['kapsula', '#FF54AD', 1.5, 3.25, 0.095], ['fragment', '#50F0FA', 1.36, 4.85, 0.07], ['fragment', '#EFCB63', 1.32, 0.2, 0.07], ['fragment', '#FF54AD', 1.42, 2.25, 0.07],
    ['fragment', '#68F5FC', 1.85, 3.0, 0.075], ['fragment', '#9875FF', 2.25, 5.9, 0.08], ['fragment', '#50F0FA', 2.55, 2.6, 0.085], ['fragment', '#FF54AD', 2.5, 0.05, 0.08], ['kapsula', '#EFCB63', 2.55, 4.1, 0.13]
  ];
  // The title's calm ground: nothing dragged across it.
  const titleW = (W > H ? W * 0.47 : W * 0.86) / 2, titleH = title.size * U * 1.25;
  for (const [kind, col, rr, ang, size] of items) {
    const rad = Math.max(1.28, rr * spread) * hr, s = size * hr * 1.5;
    const px = hx + Math.cos(ang) * rad, py = hy + Math.sin(ang) * rad;
    if (Math.abs(px - title.x * W) < titleW + s && Math.abs(py - title.y * H) < titleH + s) continue;
    for (let g = 3; g >= 1; g--) {
      const back = ang - g * 0.05 * (hr * 2 / rad + 0.4), gr = rad * (1 + g * 0.012);
      art(kind, col, hx + Math.cos(back) * gr, hy + Math.sin(back) * gr, s, back + Math.PI / 2 + 0.3, 0.11 * (4 - g));
    }
    art(kind, col, px, py, s, ang + Math.PI / 2 + 0.3, 1);
  }

  // The hero: the game's own default vortex.
  const Hole = window.game.player.constructor;
  const hole = new Hole('', 0, 0, true);
  hole.skin = 'rainbow'; hole.radius = hr; hole.auraId = null;
  c.save(); c.translate(hx, hy); hole.draw(c, 1.3); c.restore();

  // Vignette, so the title stands on calm ground.
  const vig = c.createRadialGradient(W / 2, H / 2, U * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.62);
  vig.addColorStop(0, 'rgba(4,16,29,0)'); vig.addColorStop(1, 'rgba(4,16,29,0.82)');
  c.fillStyle = vig; c.fillRect(0, 0, W, H);

  // The title: two stacked words, as on the game's own logo.
  const parts = titleText.split(' ');
  const main = parts.pop(), top = parts.join(' ');
  const size = title.size * U * (W > H ? 1.6 : 1), tx = title.x * W, ty = title.y * H;
  c.textAlign = title.align; c.textBaseline = 'alphabetic';
  const shade = c.createRadialGradient(tx, ty, size * 0.3, tx, ty, size * 2.5);
  shade.addColorStop(0, 'rgba(4,16,29,0.70)'); shade.addColorStop(1, 'rgba(4,16,29,0)');
  c.fillStyle = shade; c.fillRect(0, 0, W, H);
  const fitWord = (word, px, maxW, spacing) => { c.font = `${px}px 'Russo One'`; c.letterSpacing = spacing + 'px'; const m = c.measureText(word).width; return m > maxW ? px * maxW / m : px; };
  const maxW = titleW * 2;
  const mainPx = fitWord(main, size, maxW, size * 0.03);
  const topPx = fitWord(top, mainPx * 0.5, maxW, mainPx * 0.5 * 0.2);
  const mainY = ty + mainPx * 0.42, topY = mainY - mainPx * 0.98;
  c.font = `${topPx}px 'Russo One'`; c.letterSpacing = (topPx * 0.2) + 'px';
  c.shadowColor = '#50F0FA'; c.shadowBlur = topPx * 0.55; c.fillStyle = '#68F5FC'; c.fillText(top, tx + topPx * 0.1, topY);
  c.shadowBlur = topPx * 0.2; c.fillText(top, tx + topPx * 0.1, topY);
  c.font = `${mainPx}px 'Russo One'`; c.letterSpacing = (mainPx * 0.03) + 'px';
  c.shadowColor = 'rgba(152,117,255,0.95)'; c.shadowBlur = 0; c.shadowOffsetY = mainPx * 0.05; c.fillStyle = '#9875FF'; c.fillText(main, tx, mainY);
  c.shadowOffsetY = 0; c.shadowColor = 'rgba(80,240,250,0.85)'; c.shadowBlur = mainPx * 0.22;
  const grad = c.createLinearGradient(0, mainY - mainPx * 0.8, 0, mainY);
  grad.addColorStop(0, '#FFFFFF'); grad.addColorStop(0.5, '#68F5FC'); grad.addColorStop(1, '#9875FF');
  c.fillStyle = grad; c.fillText(main, tx, mainY);
  c.shadowBlur = 0; c.fillText(main, tx, mainY);
  return cv.toDataURL('image/png');
}

export async function renderCovers({ gameDir, out, title = 'VECTOR HOLE', only = null }) {
  fs.mkdirSync(out, { recursive: true });
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
  const server = http.createServer((req, res) => {
    const f = path.join(gameDir, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
  // drawObjectArt is module-private: a world object's own draw() reaches it. The
  // hook stands the object at the origin with the wanted art kind.
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.game && window.game.state);
  await page.evaluate(() => document.fonts.load("120px 'Russo One'", 'VECTORHLE').then(() => document.fonts.ready));
  await page.evaluate(() => {
    window.game.startRound({ seed: 4242 });
    cancelAnimationFrame(window.game.rafId);
    window.game.running = false;
    const sample = window.game.objects[0], Obj = sample.constructor;
    window.__coverArt = (c, kind, color, r) => {
      const o = Object.create(Obj.prototype);
      Object.assign(o, sample, { subtype: kind, color, radius: r, x: 0, y: 0, eating: false, eatT: 0, spawnT: 1 });
      o.draw(c, false);
    };
  });
  const written = [];
  for (const spec of COVERS) {
    if (only && !only.includes(spec.file)) continue;
    const url = await page.evaluate(([fn, s, t]) => { const f = new Function('return ' + fn)(); return f(s, t); }, [drawCover.toString(), spec, title]);
    const p = path.join(out, spec.file);
    fs.writeFileSync(p, Buffer.from(url.split(',')[1], 'base64'));
    written.push(p);
  }
  await browser.close();
  server.close();
  return written;
}

if (process.argv[1] && path.basename(process.argv[1]) === 'crazygames-covers.mjs') {
  const gameDir = path.resolve(arg('game', 'qa/out/crazygames-basic/game'));
  const out = path.resolve(arg('out', 'qa/out/crazygames-basic/covers'));
  const written = await renderCovers({ gameDir, out, title: arg('title', 'VECTOR HOLE') });
  written.forEach(p => console.log(p));
}
