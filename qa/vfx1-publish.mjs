// GG-VFX-01 evidence, not a test: turns what qa/vfx1-shots.mjs wrote to
// qa/out/vfx1/ into the review pack in design/vfx1/:
//   board-<swallow>.jpg   PRZED over PO, the same frames of the same swallow;
//   board-skins.jpg / board-skins-rival.jpg / board-q0.jpg   PO only;
//   shot-*.jpg            whole screens (copied);
//   preview.html          one self-contained page that plays every swallow
//                         PRZED next to PO, frame by frame (no game needed);
//   facts-*.json          what each staged swallow did (frames, score, draws).
// Usage: node qa/vfx1-shots.mjs --root DIR && node qa/vfx1-publish.mjs [--fragment FILE]
import fs from 'node:fs';
import path from 'node:path';
import { chromium, ROOT, OUT } from './lib.mjs';
import { SWALLOWS } from './vfx1-shots.mjs';

const SRC = path.join(OUT, 'vfx1'), PUB = path.join(ROOT, 'design', 'vfx1');
const SKINS = [['rainbow', 'Horyzont'], ['cyan', 'Cyjan'], ['pink', 'Gorący Róż'], ['green', 'Toksyczna Zieleń'], ['purple', 'Ultrafiolet'], ['gold', 'Neonowe Złoto'], ['white', 'Biała Plazma'], ['aurora', 'Aurora Finału'], ['krysztal', 'Kryształ'], ['pryzmat', 'Pryzmat']];
const uri = (f) => { const p = path.join(SRC, f); return fs.existsSync(p) ? `data:image/${f.endsWith('.jpg') ? 'jpeg' : 'png'};base64,${fs.readFileSync(p).toString('base64')}` : null; };
const fragArg = process.argv.indexOf('--fragment');

fs.mkdirSync(PUB, { recursive: true });
for (const f of fs.readdirSync(PUB)) if (/\.(png|jpg|json|html)$/.test(f)) fs.unlinkSync(path.join(PUB, f));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
/** rows: [label, image file]; one JPEG with the rows under each other. */
async function board(file, title, rows) {
  const html = rows.map(([label, f]) => { const u = uri(f); return u ? `<div class="r"><b>${label}</b><img src="${u}"></div>` : ''; }).join('');
  if (!html) return false;
  await page.setContent(`<style>body{margin:0;background:#0B1B2E;font:700 15px sans-serif;color:#F2F8FF}#b{display:inline-block;padding:14px}h1{font-size:17px;color:#50F0FA;margin:0 0 10px}.r{margin-bottom:10px}.r b{display:block;margin-bottom:4px}img{display:block;height:150px}</style><div id="b"><h1>${title}</h1>${html}</div>`);
  await page.waitForFunction(() => [...document.images].every(i => i.complete));
  await page.locator('#b').screenshot({ path: path.join(PUB, file), type: 'jpeg', quality: 88 });
  return true;
}
for (const [id, label] of SWALLOWS) await board(`board-${id}.jpg`, `GG-VFX-01 · ${label} · te same klatki tego samego pochłonięcia`, [['PRZED (baza)', `strip-${id}-before.png`], ['PO', `strip-${id}-after.png`]]);
await board('board-skins.jpg', 'GG-VFX-01 · PO · autobus (T5) pochłaniany przez każdą skórkę', SKINS.map(([id, name]) => [name, `skin-${id}-after.png`]));
await board('board-skins-rival.jpg', 'GG-VFX-01 · PO · rywal pochłaniany przez każdą skórkę', SKINS.map(([id, name]) => [name, `skin-rival-${id}-after.png`]));
await board('board-q0.jpg', 'GG-VFX-01 · PO · jakość 0', SWALLOWS.map(([id, label]) => [label, `strip-q0-${id}-after.png`]));
await browser.close();
for (const f of fs.readdirSync(SRC)) if (/^(shot-.*\.jpg|facts-.*\.json)$/.test(f)) fs.copyFileSync(path.join(SRC, f), path.join(PUB, f));

// The moving preview: every frame of each swallow, PRZED next to PO.
const facts = JSON.parse(fs.readFileSync(path.join(SRC, 'facts-after.json'), 'utf8'));
const clips = SWALLOWS.map(([id, label]) => ({ id, label, n: (facts['anim:' + id] || {}).frames, cell: (facts['anim:' + id] || {}).cell, before: uri(`anim-${id}-before.jpg`), after: uri(`anim-${id}-after.jpg`) })).filter(c => c.n && c.after);
const body = `<title>GG-VFX-01 Podgląd pochłaniania</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Russo+One&family=Exo+2:wght@400;600;800&display=swap">
<style>
/* layout: a control bar, then one row per swallow -- PRZED and PO side by side, played on one clock */
:root { --bg: #071320; --panel: #0B1B2E; --line: #1D3A52; --fg: #F2F8FF; --dim: #9DB4C8; --cyan: #50F0FA; --pink: #FF54AD; --gold: #EFCB63;
  --display: 'Russo One', 'Exo 2', 'Segoe UI', sans-serif; --ui: 'Exo 2', 'Segoe UI', system-ui, sans-serif; color-scheme: dark; }
body { background: var(--bg); color: var(--fg); font: 400 15px/1.5 var(--ui); padding-block: 20px 40px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
main { max-width: 920px; margin: 0 auto; display: flex; flex-direction: column; gap: 18px; }
h1 { font: 400 26px/1.15 var(--display); margin: 0; text-wrap: balance; }
h1 span { color: var(--cyan); }
p { margin: 0; color: var(--dim); max-width: 65ch; }
.bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; background: var(--bg); padding-block: 10px; border-bottom: 1px solid var(--line); }
.bar button { font: 800 13px var(--ui); letter-spacing: .04em; color: var(--fg); background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; cursor: pointer; }
.bar button[aria-pressed="true"] { border-color: var(--cyan); color: var(--cyan); }
.bar button:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.bar output { margin-left: auto; font: 600 13px var(--ui); color: var(--dim); font-variant-numeric: tabular-nums; }
section { display: flex; flex-direction: column; gap: 8px; }
h2 { font: 400 17px var(--display); margin: 0; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
figure { margin: 0; min-width: 0; }
figcaption { font: 800 11px var(--ui); letter-spacing: .12em; text-transform: uppercase; color: var(--dim); margin-bottom: 4px; }
figure.po figcaption { color: var(--cyan); }
canvas { display: block; width: 100%; max-width: 360px; aspect-ratio: 1; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; }
figure.po canvas { border-color: var(--cyan); }
</style>
<main>
  <h1>GLITCH GULP · <span>pochłanianie PRZED / PO</span></h1>
  <p>Każda klatka pochodzi z renderera gry: ta sama runda, to samo ziarno, ten sam obiekt, krok 1/60 s. Po lewej wersja z produkcji przed zmianą, po prawej GG-VFX-01. Czas pochłonięcia jest w obu identyczny.</p>
  <div class="bar" role="group" aria-label="Odtwarzanie">
    <button id="s1" data-s="1" aria-pressed="false">1×</button><button id="s2" data-s="0.5" aria-pressed="false">½×</button><button id="s4" data-s="0.25" aria-pressed="true">¼×</button><button id="s8" data-s="0.1" aria-pressed="false">⅒×</button>
    <button id="pause" aria-pressed="false">Pauza</button><button id="step">Klatka +1</button>
    <output id="clock">klatka 1</output>
  </div>
  <div id="rows"></div>
</main>
<script>
const CLIPS = ${JSON.stringify(clips)};
const rows = document.getElementById('rows'), clock = document.getElementById('clock');
rows.style.cssText = 'display:flex;flex-direction:column;gap:22px';
const views = [];
for (const c of CLIPS) {
  const s = document.createElement('section');
  s.innerHTML = '<h2></h2><div class="pair"><figure><figcaption>Przed</figcaption><canvas></canvas></figure><figure class="po"><figcaption>Po · GG-VFX-01</figcaption><canvas></canvas></figure></div>';
  s.querySelector('h2').textContent = c.label;
  rows.appendChild(s);
  const cv = s.querySelectorAll('canvas');
  [c.before, c.after].forEach((src, i) => {
    cv[i].width = cv[i].height = c.cell * 2;
    if (!src) return;
    const img = new Image(); img.src = src;
    views.push({ c, img, ctx: cv[i].getContext('2d') });
  });
}
let speed = 0.25, paused = false, pos = 0, last = performance.now();
const HOLD = 24;                      // frames of rest before a clip loops
function draw() {
  for (const v of views) {
    if (!v.img.complete) continue;
    const f = Math.min(v.c.n - 1, Math.floor(pos) % (v.c.n + HOLD));
    v.ctx.drawImage(v.img, f * v.c.cell, 0, v.c.cell, v.c.cell, 0, 0, v.c.cell * 2, v.c.cell * 2);
  }
  clock.textContent = 'klatka ' + (Math.floor(pos) + 1) + ' · ' + Math.round(Math.floor(pos) * 1000 / 60) + ' ms';
}
function tick(now) {
  if (!paused) pos += (now - last) / 1000 * 60 * speed;
  last = now; draw(); requestAnimationFrame(tick);
}
document.querySelectorAll('[data-s]').forEach(b => b.addEventListener('click', () => {
  speed = +b.dataset.s;
  document.querySelectorAll('[data-s]').forEach(x => x.setAttribute('aria-pressed', x === b));
}));
const pauseBtn = document.getElementById('pause');
pauseBtn.addEventListener('click', () => { paused = !paused; pauseBtn.setAttribute('aria-pressed', paused); pauseBtn.textContent = paused ? 'Odtwarzaj' : 'Pauza'; });
document.getElementById('step').addEventListener('click', () => { paused = true; pauseBtn.setAttribute('aria-pressed', true); pauseBtn.textContent = 'Odtwarzaj'; pos = Math.floor(pos) + 1; });
if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { paused = true; pauseBtn.setAttribute('aria-pressed', true); pauseBtn.textContent = 'Odtwarzaj'; }
requestAnimationFrame(tick);
</script>
`;
fs.writeFileSync(path.join(PUB, 'preview.html'), '<!doctype html>\n<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n' + body.replace('</style>\n<main>', '</style>\n</head><body>\n<main>') + '</body></html>\n');
if (fragArg > 0) fs.writeFileSync(process.argv[fragArg + 1], body);
const size = fs.readdirSync(PUB).reduce((n, f) => n + fs.statSync(path.join(PUB, f)).size, 0);
console.log(`published -> design/vfx1/ (${fs.readdirSync(PUB).length} files, ${(size / 1e6).toFixed(1)} MB, ${clips.length} clips)`);
