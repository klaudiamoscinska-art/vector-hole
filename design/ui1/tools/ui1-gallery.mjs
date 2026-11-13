// GG-UI-01 stage 1: builds design/ui1/gallery.html from facts.json and the
// shots (design/ui1/tools/ui1-shots.mjs). The page references shots/* by
// relative path: open design/ui1/gallery.html from the repo (a browser, or
// python3 -m http.server and /design/ui1/gallery.html), or publish
// gallery-artifact.html with the shots beside it.
//   node design/ui1/tools/ui1-gallery.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UI1 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const facts = JSON.parse(fs.readFileSync(path.join(UI1, 'facts.json'), 'utf8'));
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NOTES = {
  's1-arena-early': 'Wszystkie podstawowe elementy: pauza, czas, wynik, tier i pasek wzrostu, ranking, combo, minimapa.',
  's2-arena-late': 'Duży wir T6 w ostatnich sekundach. Panele nie wchodzą w wir; rywal za rankingiem pozostaje widoczny.',
  's3-campaign': 'Misja M24: dwa cele (węzły 2/3, boss dzielnicy — rdzeń miasta 0/1), komunikat NELA, minimapa dzielnicy.',
  's4-daily': 'Ten sam układ co Arena. W wariantach nagłówek rankingu nazywa tryb: WYZWANIE DNIA.',
  's5-crazygames': 'Kadr portalu 800×450 z komunikatem awansu. Pasek czasu i wyniku przestaje zajmować całą górę.',
  's5b-crazygames-campaign': 'Kampania w kadrze 800×450: cele misji po prawej, kapsuła czasu po lewej.',
  's6-desktop': 'Desktop 1366×768 z komunikatem wzrostu T6. Interfejs skaluje się jak dziś (×1,24).',
  's8-friend': 'Runda z wyzwaniem znajomego: cel 1500 pkt od „Maja” pod kapsułą czasu.'
};
const scenes = Object.entries(facts).map(([id, f]) => ({ id, ...f }));
const mm = ['s1-arena-early', 's2-arena-late', 's3-campaign', 's5-crazygames'].filter(id => facts[id]);

const sceneHtml = (s) => {
  const [w, h] = s.viewport.split('x').map(Number);
  const meta = [s.viewport, s.mission ? `misja ${s.mission}` : `seed ${s.seed}`, `czas ${s.time}`, `${s.score} pkt`, `${s.tier} · ${Math.round(parseFloat(s.tierPct))}%`, s.rank ? `miejsce ${s.rank}` : null].filter(Boolean).join(' · ');
  const b = s.boxes || {};
  const foot = b.before ? `Panele HUD zajmują: przed ${b.before.pct}% · A ${b.a.pct}% · B ${b.b.pct}% ekranu` : '';
  return `<section class="scene" id="${s.id}">
  <h2>${esc(s.title)}</h2>
  <p class="note">${esc(NOTES[s.id] || '')}</p>
  <button class="shot${w > h ? ' land' : ''}" type="button" data-scene="${s.id}" aria-label="Powiększ: ${esc(s.title)}"><img data-scene="${s.id}" src="shots/${s.id}-before.jpg" width="${w}" height="${h}" alt="${esc(s.title)}" loading="lazy"><span class="tag" data-tag></span></button>
  <p class="meta">${esc(meta)}</p>
  <p class="meta">${esc(foot)}</p>
  <p class="meta ${s.identical ? 'ok' : 'bad'}">${s.identical ? 'Ten sam kadr pod trzema wariantami: PASS' : 'Kontrola kadru: FAIL'} <code>${esc(String(Object.values(s.plates || {})[0] || '').slice(0, 12))}</code></p>
</section>`;
};
const mmHtml = (id) => {
  const s = facts[id], size = Math.round(s.minimap.size), box = size + 52;
  const cell = (l, name) => `<figure><img src="shots/${id}-minimap-${l}.png" alt="Minimapa ${name}, ${esc(s.title)}" loading="lazy"><figcaption>${name}</figcaption></figure>`;
  const real = (l, name) => `<figure><img src="shots/${id}-minimap-${l}.png" width="${box}" height="${box}" style="width:${box}px;height:${box}px" alt="" loading="lazy"><figcaption>${name}</figcaption></figure>`;
  return `<div class="mm"><h3>${esc(s.title)} <span>mapa ${size}×${size} px</span></h3>
  <div class="mm-big">${cell('before', 'PRZED')}${cell('a', 'A')}${cell('b', 'B')}</div>
  <p class="meta">Rzeczywista wielkość na ekranie (1:1):</p>
  <div class="mm-real">${real('before', 'PRZED')}${real('a', 'A')}${real('b', 'B')}</div></div>`;
};

const html = `<title>GLITCH GULP HUD</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Russo+One&family=Exo+2:wght@400;600;800&display=swap">
<style>
/* layout: one column of real game frames; a sticky switch swaps the UI layer on every frame at once */
:root { --bg: #04101D; --panel: #0A2032; --line: #1D3A52; --fg: #F2F8FF; --dim: #9DB4C8; --cyan: #50F0FA; --gold: #EFCB63; --pink: #FF54AD; --green: #46D99A;
  --display: 'Russo One', 'Exo 2', 'Segoe UI', sans-serif; --ui: 'Exo 2', 'Segoe UI', system-ui, sans-serif; color-scheme: dark; }
body { background: var(--bg); color: var(--fg); font: 400 15px/1.5 var(--ui); padding-block: 20px 48px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg); }
main { max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; gap: 22px; }
h1 { font: 400 26px/1.15 var(--display); margin: 0; text-wrap: balance; }
h1 span { color: var(--cyan); }
h2 { font: 400 19px/1.2 var(--display); margin: 0; text-wrap: balance; }
h3 { font: 800 14px/1.3 var(--ui); margin: 0; letter-spacing: .04em; }
h3 span { color: var(--dim); font-weight: 600; letter-spacing: 0; }
p { margin: 0; color: var(--dim); max-width: 65ch; }
p strong, li strong { color: var(--fg); font-weight: 800; }
.bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; display: flex; gap: 6px; background: var(--bg); padding-block: 10px; border-bottom: 1px solid var(--line); }
.bar button { flex: 1; min-height: 44px; font: 800 13px var(--ui); letter-spacing: .06em; color: var(--dim); background: var(--panel); border: 1px solid var(--line); border-radius: 10px; cursor: pointer; }
.bar button[aria-pressed="true"] { color: var(--bg); background: var(--cyan); border-color: var(--cyan); }
button:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.scene, .block { display: flex; flex-direction: column; gap: 8px; }
.shot { position: relative; display: block; padding: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: #000; cursor: zoom-in; width: 100%; max-width: 390px; align-self: center; }
.shot.land { max-width: 100%; }
.shot img { display: block; width: 100%; height: auto; }
.tag { position: absolute; left: 8px; bottom: 8px; font: 800 11px var(--ui); letter-spacing: .08em; color: var(--bg); background: var(--gold); padding: 3px 7px; border-radius: 5px; }
.meta { font-size: 12.5px; font-variant-numeric: tabular-nums; }
.meta.ok { color: var(--green); } .meta.bad { color: var(--pink); }
code { font: 600 11.5px ui-monospace, Menlo, monospace; color: var(--dim); }
.mm { display: flex; flex-direction: column; gap: 8px; padding-block: 6px 14px; border-bottom: 1px solid var(--line); }
.mm-big { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
@media (min-width: 620px) { .mm-big { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.mm-real { display: flex; flex-wrap: wrap; gap: 8px; }
figure { margin: 0; display: flex; flex-direction: column; gap: 4px; }
.mm-big img { width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--line); }
.mm-real img { border-radius: 8px; border: 1px solid var(--line); max-width: none; }
figcaption { font: 800 11px var(--ui); letter-spacing: .08em; color: var(--dim); }
ul { margin: 0; padding-left: 18px; color: var(--dim); display: flex; flex-direction: column; gap: 4px; max-width: 65ch; }
.two { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
.two > div { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
[hidden] { display: none !important; }
.viewer { position: fixed; inset: 0; z-index: 20; background: #000; display: flex; flex-direction: column; }
.viewer-bar { display: flex; gap: 6px; padding: calc(8px + env(safe-area-inset-top, 0px)) max(10px, env(safe-area-inset-right, 0px)) 8px max(10px, env(safe-area-inset-left, 0px)); background: var(--bg); }
.viewer-bar button { flex: 1; min-height: 44px; font: 800 12px var(--ui); letter-spacing: .05em; color: var(--dim); background: var(--panel); border: 1px solid var(--line); border-radius: 10px; }
.viewer-bar button[aria-pressed="true"] { color: var(--bg); background: var(--cyan); border-color: var(--cyan); }
.viewer-bar .x { flex: none; width: 48px; color: var(--fg); }
.viewer-scroll { flex: 1; overflow: auto; -webkit-overflow-scrolling: touch; }
.viewer-scroll img { display: block; max-width: none; }
</style>
<main>
  <h1>GLITCH GULP <span>HUD</span> · PRZED / A / B</h1>
  <p>Każda scena to jeden zamrożony kadr prawdziwej gry (main <code>b337835</code>). Przełącznik zmienia wyłącznie warstwę interfejsu, na wszystkich scenach naraz. <strong>BEZ UI</strong> pokazuje sam kadr, który jest bajt w bajt taki sam pod każdym wariantem. Dotknij sceny, żeby ją powiększyć.</p>
  <div class="bar" role="group" aria-label="Warstwa interfejsu">
    <button type="button" id="l-before" data-layer="before" aria-pressed="true">PRZED</button>
    <button type="button" id="l-a" data-layer="a" aria-pressed="false">A</button>
    <button type="button" id="l-b" data-layer="b" aria-pressed="false">B</button>
    <button type="button" id="l-plate" data-layer="plate" aria-pressed="false">BEZ UI</button>
  </div>
  <div class="two">
    <div><h3>A · PREMIUM MINIMAL</h3><p>Jeden spokojny materiał: prawie czarne szkło z cienką linią, bez poświaty. Kolor tylko tam, gdzie coś znaczy: barwa tieru na pasku, złoto przy wyniku i liderze, cyjan przy „Ty”.</p></div>
    <div><h3>B · PREMIUM NEON</h3><p>Głębsza płyta z krawędzią w kolorach wiru (cyjan, fiolet, róż). Tier jako sześciostopniowa drabinka, ranking z paskami wyniku, cele liczone segmentami, minimapa z ramą i pasami ruchu.</p></div>
  </div>
  ${scenes.map(sceneHtml).join('\n')}
  <section class="block" id="minimapa">
    <h2>Minimapa w powiększeniu</h2>
    <p>Ten sam prostokąt, ta sama wielkość i te same dane co dziś: wszystkie obiekty, rywale (czerwony = większy od Ciebie, jasny pierścień = do zjedzenia), Ty, ramka kamery, nazwa dzielnicy. Nowe jest tylko rysowanie: prawdziwa siatka ulic, kwartały w barwach dzielnic, podświetlona dzielnica, w której jesteś, i hierarchia znaczników.</p>
    ${mm.map(mmHtml).join('\n')}
  </section>
  <section class="block" id="rekomendacja">
    <h2>Rekomendacja</h2>
    <p><strong>Hybryda na bazie B.</strong> Materiał, drabinka tieru, ranking i minimapa z B; z A spokojniejsze panele drugiego planu (combo, wyzwanie, „teraz gra”) i zasada jednej poświaty na panel.</p>
    <ul>
      <li>B jest wyraźnie bliżej oprawy Premium Neon Vector i czytelniej pokazuje progres T1–T6.</li>
      <li>Oba warianty zajmują tyle samo miejsca; na CrazyGames i desktopie mniej niż dziś.</li>
      <li>A jest najtańszy we wdrożeniu i najbezpieczniejszy, ale różnica względem obecnego HUD jest mniejsza.</li>
    </ul>
  </section>
</main>
<div class="viewer" id="viewer" hidden>
  <div class="viewer-bar" role="group" aria-label="Warstwa interfejsu">
    <button type="button" data-layer="before">PRZED</button><button type="button" data-layer="a">A</button><button type="button" data-layer="b">B</button><button type="button" data-layer="plate">BEZ UI</button>
    <button type="button" class="x" id="viewer-close" aria-label="Zamknij">✕</button>
  </div>
  <div class="viewer-scroll"><img id="viewer-img" alt=""></div>
</div>
<script>
(function () {
  var layer = 'before', open = null;
  var NAMES = { before: 'PRZED', a: 'A · MINIMAL', b: 'B · NEON', plate: 'BEZ UI' };
  var src = function (scene) { return 'shots/' + scene + '-' + layer + '.jpg'; };
  var viewer = document.getElementById('viewer'), vimg = document.getElementById('viewer-img');
  function paint() {
    document.querySelectorAll('img[data-scene]').forEach(function (i) { i.loading = 'eager'; i.src = src(i.dataset.scene); });
    document.querySelectorAll('[data-tag]').forEach(function (t) { t.textContent = NAMES[layer]; });
    document.querySelectorAll('button[data-layer]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.layer === layer)); });
    if (open) vimg.src = src(open);
  }
  document.querySelectorAll('button[data-layer]').forEach(function (b) { b.addEventListener('click', function () { layer = b.dataset.layer; paint(); }); });
  document.querySelectorAll('button.shot').forEach(function (b) {
    b.addEventListener('click', function () {
      open = b.dataset.scene;
      var im = b.querySelector('img');
      // Twice the on-screen size of the frame's own CSS pixels: details of the HUD, scroll to pan.
      vimg.style.width = Math.max(im.width * 2, window.innerWidth) + 'px';
      vimg.src = src(open);
      viewer.hidden = false;
    });
  });
  document.getElementById('viewer-close').addEventListener('click', function () { viewer.hidden = true; open = null; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { viewer.hidden = true; open = null; } });
  paint();
})();
</script>
`;
// gallery.html: a whole document (open it from the repo). gallery-artifact.html: the same page as a
// fragment, for publishing as a Claude artifact (its host adds the doctype, charset and viewport).
fs.writeFileSync(path.join(UI1, 'gallery-artifact.html'), html);
fs.writeFileSync(path.join(UI1, 'gallery.html'), `<!doctype html>\n<html lang="pl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>body{margin:0}img{max-width:100%}</style>\n${html.replace('<main>', '</head>\n<body>\n<main>')}</body>\n</html>\n`);
console.log('gallery.html · ' + scenes.length + ' scenes · ' + (html.length / 1024).toFixed(1) + ' kB');
