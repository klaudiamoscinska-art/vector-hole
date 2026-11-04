// CRAZYGAMES-BASIC-1: the three submission covers + the 2:3 first video frame, drawn
// by the game's own art (its Hole.draw(), its world objects' drawObjectArt(), its fonts
// and palette) on one canvas: no screenshot, no third-party image, no text but the title.
//   node tools/crazygames-covers.mjs --game=DIR --out=DIR
// Needs the Playwright install the QA suites use. Same sources = same pictures.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };

// sizes: docs.crazygames.com/requirements/game-covers/ (read 2026-11-03)
const TALL = { hero: [0.5, 0.625], heroR: 0.27, spread: 1, title: { x: 0.5, y: 0.17, size: 0.205 } };
export const COVERS = [
  { file: 'landscape-1920x1080.png', w: 1920, h: 1080, hero: [0.705, 0.52], heroR: 0.335, spread: 0.92, title: { x: 0.25, y: 0.5, size: 0.175 } },
  { file: 'portrait-800x1200.png', w: 800, h: 1200, ...TALL },
  { file: 'square-800x800.png', w: 800, h: 800, hero: [0.5, 0.655], heroR: 0.25, spread: 0.92, title: { x: 0.5, y: 0.2, size: 0.2 } },
  // The portrait video's opening frame: the same picture as the portrait cover at the video's size.
  { file: 'video-first-frame-portrait-1080x1620.png', w: 1080, h: 1620, ...TALL, source: true }
];

/** Runs in the game's page: the picture is a pure function of the size and a fixed RNG. */
function drawCover(spec) {
  const { w: W, h: H, hero, heroR, title } = spec;
  const U = Math.min(W, H);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  let seed = 90210;
  const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hx = hero[0] * W, hy = hero[1] * H, hr = heroR * U, spread = spec.spread;

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

  // Suction: a cyan and violet glow under the vortex, and streaks spiralling into it.
  const glow = c.createRadialGradient(hx, hy, hr * 0.8, hx, hy, hr * 3);
  glow.addColorStop(0, 'rgba(80,240,250,0.42)'); glow.addColorStop(0.26, 'rgba(152,117,255,0.26)'); glow.addColorStop(0.6, 'rgba(255,84,173,0.09)'); glow.addColorStop(1, 'rgba(80,240,250,0)');
  c.fillStyle = glow; c.fillRect(0, 0, W, H);
  const NEON = ['#50F0FA', '#50F0FA', '#FF54AD', '#9875FF', '#68F5FC'];
  c.lineCap = 'round';
  for (let i = 0; i < 150; i++) {
    const a0 = rnd() * Math.PI * 2, rad0 = hr * (1.05 + rnd() * rnd() * 2.9), sweep = 0.35 + rnd() * 0.75, col = NEON[Math.floor(rnd() * NEON.length)];
    c.strokeStyle = col; c.globalAlpha = (0.14 + rnd() * 0.42) * Math.min(1, hr * 2.4 / rad0);
    c.lineWidth = U * (0.0014 + rnd() * 0.0036);
    c.beginPath();
    for (let k = 0; k <= 26; k++) { const f = k / 26, a = a0 + f * sweep * 1.6, rr = rad0 * (1 - f * 0.22); const px = hx + Math.cos(a) * rr, py = hy + Math.sin(a) * rr; if (k) c.lineTo(px, py); else c.moveTo(px, py); }
    c.stroke();
  }
  c.globalAlpha = 1;

  // The title's calm ground: nothing dragged across it.
  const landscape = W > H;
  const titleW = (landscape ? W * 0.44 : W * 0.86) / 2, titleH = title.size * U * 1.15;
  const clearOfTitle = (x, y, s) => !(Math.abs(x - title.x * W) < titleW + s * 0.7 && Math.abs(y - title.y * H) < titleH + s * 0.7);

  // One object of the city, as the game draws it, stretched along the pull.
  const art = (ctx, kind, color, x, y, r, rot, stretch, alpha) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(1 / stretch, stretch); ctx.globalAlpha = alpha;
    try { window.__coverArt(ctx, kind, color, r); } catch (e) { /* art kind missing */ }
    ctx.restore();
  };

  // Small debris far out, then the hole's own art, then the big objects going over its lip.
  const debris = [['fragment', '#50F0FA', 2.3, 0.3], ['kapsula', '#50F0FA', 1.95, 1.5], ['fragment', '#68F5FC', 2.6, 2.5], ['kapsula', '#FF54AD', 2.1, 3.3], ['fragment', '#9875FF', 1.8, 4.2], ['fragment', '#50F0FA', 2.5, 5.0], ['kapsula', '#EFCB63', 2.25, 5.8], ['fragment', '#FF54AD', 1.65, 0.95], ['latarnia', '#FF54AD', 2.45, 4.6], ['drzewo', '#FF54AD', 2.7, 1.1], ['kiosk', '#FF54AD', 2.55, 3.85]];
  for (const [kind, col, rr, ang] of debris) {
    const rad = rr * spread * hr, s = (kind === 'fragment' ? 0.1 : kind === 'kapsula' ? 0.13 : 0.2) * hr;
    const px = hx + Math.cos(ang) * rad, py = hy + Math.sin(ang) * rad;
    if (!clearOfTitle(px, py, s)) continue;
    for (let g = 3; g >= 1; g--) { const back = ang - g * 0.055; art(c, kind, col, hx + Math.cos(back) * rad * (1 + g * 0.02), hy + Math.sin(back) * rad * (1 + g * 0.02), s, back + 1.9, 1, 0.1 * (4 - g)); }
    art(c, kind, col, px, py, s, ang + 1.9, 1, 1);
  }

  const Hole = window.game.player.constructor;
  const hole = new Hole('', 0, 0, true);
  hole.skin = 'rainbow'; hole.radius = hr; hole.auraId = null;
  c.save(); c.translate(hx, hy); hole.draw(c, 1.3); c.restore();

  // The big ones: cars, a truck, a bus and a warehouse, one by one over the rim. Each sits on
  // its own layer so its inner part can fade out into the black, as the game's objects do.
  const bigs = landscape ? [
    ['ciezarowka', '#CBD5E1', 1.13, 3.05, 0.46, 1.2], ['samochod', '#EFCB63', 1.0, 2.15, 0.36, 1.28], ['magazyn', '#9875FF', 1.16, 4.75, 0.42, 1.15],
    ['samochod', '#50F0FA', 0.99, 0.35, 0.34, 1.3], ['autobus', '#CBD5E1', 1.16, 1.2, 0.42, 1.2]
  ] : [
    ['ciezarowka', '#CBD5E1', 1.2, 3.1, 0.47, 1.2], ['samochod', '#EFCB63', 1.03, 2.05, 0.36, 1.28], ['magazyn', '#9875FF', 1.2, 4.2, 0.44, 1.15],
    ['samochod', '#50F0FA', 1.02, 5.5, 0.35, 1.28], ['autobus', '#CBD5E1', 1.2, 0.75, 0.44, 1.2]
  ];
  const layer = document.createElement('canvas');
  layer.width = W; layer.height = H;
  const l = layer.getContext('2d');
  for (const [kind, col, rr, ang, size, stretch] of bigs) {
    const rad = rr * spread * hr, s = size * hr;
    const px = hx + Math.cos(ang) * rad, py = hy + Math.sin(ang) * rad;
    if (!clearOfTitle(px, py, s * 0.8)) continue;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.clearRect(0, 0, W, H);
    for (let g = 3; g >= 1; g--) { const back = ang - g * 0.05, gr = rad * (1 + g * 0.03); art(l, kind, col, hx + Math.cos(back) * gr, hy + Math.sin(back) * gr, s, back + 1.25, stretch, 0.11 * (4 - g)); }
    art(l, kind, col, px, py, s, ang + 1.25, stretch, 1);
    l.globalCompositeOperation = 'destination-out';
    const sink = l.createRadialGradient(hx, hy, hr * 0.42, hx, hy, hr * 0.98);
    sink.addColorStop(0, 'rgba(0,0,0,1)'); sink.addColorStop(0.55, 'rgba(0,0,0,0.82)'); sink.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = sink; l.fillRect(0, 0, W, H);
    l.globalCompositeOperation = 'source-over';
    c.drawImage(layer, 0, 0);
  }

  // Vignette, so the title stands on calm ground.
  const vig = c.createRadialGradient(W / 2, H / 2, U * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.62);
  vig.addColorStop(0, 'rgba(4,16,29,0)'); vig.addColorStop(1, 'rgba(4,16,29,0.82)');
  c.fillStyle = vig; c.fillRect(0, 0, W, H);

  // The logo: GLITCH stacked on GULP, as on the game's welcome card, with the glitch's
  // split colours and cut-out slices. The only text on the cover.
  const size = title.size * U * (landscape ? 1.75 : 1), tx = title.x * W, ty = title.y * H;
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  const shade = c.createRadialGradient(tx, ty, size * 0.3, tx, ty, size * 2.5);
  shade.addColorStop(0, 'rgba(4,16,29,0.74)'); shade.addColorStop(1, 'rgba(4,16,29,0)');
  c.fillStyle = shade; c.fillRect(0, 0, W, H);
  const fit = (word, px, maxW, sp) => { c.font = `${px}px 'Russo One'`; c.letterSpacing = (px * sp) + 'px'; const m = c.measureText(word).width; return m > maxW ? px * maxW / m : px; };
  const maxW = titleW * 2;
  const mainPx = fit('GULP', size, maxW, 0.03);
  const topPx = fit('GLITCH', mainPx * 0.62, maxW, 0.1);
  const mainY = ty + mainPx * 0.5, topY = mainY - mainPx * 0.92;
  const word = (text, px, sp, x, y, fill, blur, glow) => { c.font = `${px}px 'Russo One'`; c.letterSpacing = (px * sp) + 'px'; c.shadowColor = glow || 'transparent'; c.shadowBlur = blur || 0; c.fillStyle = fill; c.fillText(text, x, y); c.shadowBlur = 0; };
  const shift = topPx * 0.045;
  word('GLITCH', topPx, 0.1, tx - shift, topY, '#FF54AD');
  word('GLITCH', topPx, 0.1, tx + shift, topY + shift * 0.3, '#50F0FA', topPx * 0.32, '#50F0FA');
  word('GLITCH', topPx, 0.1, tx, topY, '#E6FEFF');
  // One slice of the top word knocked sideways, inside the word only.
  const sy = topY - topPx * 0.42, sh = topPx * 0.1;
  c.save(); c.beginPath(); c.rect(tx - maxW * 0.5, sy, maxW, sh); c.clip();
  word('GLITCH', topPx, 0.1, tx + topPx * 0.05, topY, '#50F0FA');
  c.restore();
  word('GULP', mainPx, 0.03, tx, mainY + mainPx * 0.05, '#7B5CE0');
  const grad = c.createLinearGradient(0, mainY - mainPx * 0.8, 0, mainY);
  grad.addColorStop(0, '#FFFFFF'); grad.addColorStop(0.5, '#68F5FC'); grad.addColorStop(1, '#9875FF');
  word('GULP', mainPx, 0.03, tx, mainY, grad, mainPx * 0.2, 'rgba(80,240,250,0.85)');
  word('GULP', mainPx, 0.03, tx, mainY, grad);
  return cv.toDataURL('image/png');
}

export async function renderCovers({ gameDir, out, only = null }) {
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
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.game && window.game.state);
  await page.evaluate(() => document.fonts.load("120px 'Russo One'", 'GLITCHUP').then(() => document.fonts.ready));
  // drawObjectArt is module-private: a world object's own draw() reaches it. The
  // hook stands the object at the origin with the wanted art kind.
  await page.evaluate(() => {
    window.game.startRound({ seed: 4242 });
    cancelAnimationFrame(window.game.rafId);
    window.game.running = false;
    const sample = window.game.objects[0], Obj = sample.constructor;
    window.__coverArt = (c, kind, color, r) => {
      const o = Object.create(Obj.prototype);
      Object.assign(o, sample, { subtype: kind, color, radius: r, x: 0, y: 0, eating: false, eatT: 0, spawnFlash: 0, tier: 'prop' });
      o.draw(c, false);
    };
  });
  const written = [];
  for (const spec of COVERS) {
    if (only && !only.includes(spec.file)) continue;
    const url = await page.evaluate(([fn, s]) => { const f = new Function('return ' + fn)(); return f(s); }, [drawCover.toString(), spec]);
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
  const written = await renderCovers({ gameDir, out });
  written.forEach(p => console.log(p));
}
