// GG-UI-01 stage 2 evidence (not a test): builds the phone-readable gallery
// from the frames qa/ui1-shots.mjs wrote -- PRZED (the base checkout) /
// WZORZEC (the approved stage-1 mock-ups, design/ui1/stage1/shots) /
// PRODUKCJA (this checkout), the four acceptance fixes, the small phones and
// the minimap 1:1.
//   node qa/ui1-gallery.mjs
// Output: design/ui1/gallery.html (open it from the repo) and
// design/ui1/gallery-artifact.html (the same page without the document
// shell, for publishing with the images beside it).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES, EXTRA } from './ui1-shots.mjs';

const UI1 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'design', 'ui1');
const read = (f) => JSON.parse(fs.readFileSync(path.join(UI1, 'prod', f), 'utf8'));
const before = read('facts-before.json'), prod = read('facts-prod.json'), extra = read('facts-extra.json');
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEYS = ['time', 'score', 'radius', 'tier', 'rank', 'camera', 'zoom', 'stateHash', 'randomCalls', 'plate'];

const NOTE = {
  's1-arena-early': 'Kapsuła czasu z drabinką T1–T6, ranking z paskami wyniku, combo w spokojnym materiale.',
  's2-arena-late': 'T6: cała drabinka świeci. Ostatnie sekundy: zegar różowy.',
  's3-campaign': 'Cel misji z segmentami i wierszem bossa. NELA pod zegarem, nie na wirze. Kod misji taki jak w odprawie (misja o id M24 to M60 w kolejności dzielnic).',
  's4-daily': 'Wyzwanie dnia ma własną linię nad nagłówkiem; plakietka miejsca zostaje w panelu.',
  's5-crazygames': '„AWANS NA 3. MIEJSCE” obok płytki combo, nie na niej.',
  's5b-crazygames-campaign': 'Układ poziomy: kapsuła o stałej szerokości, środek górnej krawędzi wolny.',
  's6-desktop': 'Skala interfejsu ×1,24: widżety canvas skalują się razem z panelami.',
  's8-friend': 'Cel wyzwania znajomego pod licznikiem combo, w tym samym spokojnym materiale.'
};

function compareCard(sc) {
  const a = before[sc.id], b = prod[sc.id];
  const same = KEYS.every(k => JSON.stringify(a[k]) === JSON.stringify(b[k]));
  const mock = sc.id === 's8-friend' ? 'a' : 'b';
  const wide = sc.vp.width > sc.vp.height;
  return `<article class="card${wide ? ' wide' : ''}" data-compare>
  <header><h3>${esc(sc.title)}</h3><p>${esc(NOTE[sc.id] || '')}</p></header>
  <div class="seg" role="tablist" aria-label="Wersja kadru">
    <button role="tab" aria-selected="false" data-src="prod/${sc.id}-before.jpg">Przed</button>
    <button role="tab" aria-selected="false" data-src="stage1/shots/${sc.id}-${mock}.jpg">Wzorzec ${mock.toUpperCase()}</button>
    <button role="tab" aria-selected="true" data-src="prod/${sc.id}-prod.jpg">Produkcja</button>
  </div>
  <figure><img src="prod/${sc.id}-prod.jpg" alt="${esc(sc.title)}" width="${sc.vp.width * 2}" height="${sc.vp.height * 2}" loading="lazy"></figure>
  <dl class="facts">
    <div><dt>Kadr</dt><dd>${sc.vp.width}×${sc.vp.height}</dd></div>
    <div><dt>Czas</dt><dd>${esc(b.time)}</dd></div>
    <div><dt>Wynik</dt><dd>${b.score}</dd></div>
    <div><dt>Tier</dt><dd>${esc(b.tier)}</dd></div>
    <div><dt>Miejsce</dt><dd>${esc(b.rank || '—')}</dd></div>
    <div><dt>Losowania</dt><dd>${b.randomCalls}</dd></div>
    <div class="${same ? 'ok' : 'bad'}"><dt>Świat i kadr bez HUD</dt><dd>${same ? 'identyczne z bazą' : 'RÓŻNICA'} · ${esc(b.plate.slice(0, 12))}</dd></div>
  </dl>
</article>`;
}

function shotCard(sc) {
  const f = extra[sc.id] || {};
  const wide = sc.vp.width > sc.vp.height;
  return `<article class="card${wide ? ' wide' : ''}">
  <header><h3>${esc(sc.title)}</h3></header>
  <figure><img src="prod/${sc.id}-prod.jpg" alt="${esc(sc.title)}" width="${sc.vp.width * 2}" height="${sc.vp.height * 2}" loading="lazy"></figure>
  <dl class="facts"><div><dt>Kadr</dt><dd>${sc.vp.width}×${sc.vp.height}</dd></div><div><dt>Tryb</dt><dd>${esc(f.mode === 'campaign' ? 'Kampania ' + f.mission : f.daily ? 'Wyzwanie dnia' : f.challenge ? 'Wyzwanie znajomego' : 'Arena')}</dd></div></dl>
</article>`;
}

const mapRow = (id, title, labels) => `<article class="card maps"><header><h3>${esc(title)}</h3></header><div class="maprow">${labels.map(([src, cap]) => `<figure><img src="${src}" alt="${esc(cap)}" loading="lazy"><figcaption>${esc(cap)}</figcaption></figure>`).join('')}</div></article>`;

const fixes = EXTRA.filter(s => /^f\d/.test(s.id)), phones = EXTRA.filter(s => /^p\d/.test(s.id));
const group = (n, text) => `<h3 class="fix"><span>Poprawka ${n}</span>${esc(text)}</h3>`;
const body = `<title>GG-UI-01 HUD produkcyjny</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* layout: one column of frame cards; landscape frames span the full width, portrait frames sit two or three abreast on a wide screen */
:root { --bg: #04101D; --panel: #0A2032; --line: rgba(242, 248, 255, 0.12); --fg: #f2f8ff; --dim: rgba(242, 248, 255, 0.62); --cyan: #50F0FA; --gold: #EFCB63; --pink: #FF54AD; --green: #46D99A;
  --display: 'Russo One', 'Arial Black', 'Segoe UI', sans-serif; --text: 'Exo 2', 'Segoe UI', system-ui, sans-serif; color-scheme: dark; }
body { background: var(--bg); color: var(--fg); font: 15px/1.5 var(--text); padding-block: 20px 48px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
main { max-width: 1180px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; }
h1 { font: 400 26px/1.15 var(--display); letter-spacing: 0.03em; margin: 0; text-wrap: balance; }
h2 { font: 400 18px/1.2 var(--display); letter-spacing: 0.04em; margin: 0; color: var(--cyan); text-wrap: balance; }
h3 { font: 800 14px/1.3 var(--text); margin: 0; }
p { margin: 0; color: var(--dim); max-width: 68ch; }
.lead { display: flex; flex-direction: column; gap: 8px; }
.eyebrow { font: 800 11px/1 var(--text); letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold); }
section { display: flex; flex-direction: column; gap: 14px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 16px; align-items: start; }
.card { min-width: 0; display: flex; flex-direction: column; gap: 10px; padding: 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; }
.card.wide, .card.maps { grid-column: 1 / -1; }
.card header { display: flex; flex-direction: column; gap: 4px; }
.card header p { font-size: 13px; }
figure { margin: 0; }
figure img { display: block; width: 100%; height: auto; border-radius: 8px; background: #000; }
.card:not(.wide):not(.maps) figure img { max-width: 390px; margin: 0 auto; }
.seg { display: flex; gap: 4px; padding: 3px; background: rgba(4, 16, 29, 0.8); border: 1px solid var(--line); border-radius: 10px; }
.seg button { flex: 1; min-width: 0; min-height: 40px; padding: 6px 4px; border: 0; border-radius: 7px; background: none; color: var(--dim); font: 800 12px/1.1 var(--text); letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; }
.seg button[aria-selected="true"] { background: var(--cyan); color: var(--bg); }
.seg button:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.facts { margin: 0; display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12px; font-variant-numeric: tabular-nums; }
.facts div { display: flex; gap: 5px; }
.facts dt { color: var(--dim); }
.facts dd { margin: 0; font-weight: 700; }
.facts .ok dd { color: var(--green); }
.facts .bad dd { color: var(--pink); }
.fix { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; font-size: 15px; }
.fix span { font: 400 12px/1 var(--display); letter-spacing: 0.06em; color: var(--bg); background: var(--gold); padding: 4px 7px; border-radius: 5px; }
.maprow { display: flex; flex-wrap: wrap; gap: 12px; }
.maprow figure { flex: 0 1 auto; display: flex; flex-direction: column; gap: 5px; }
.maprow img { width: auto; max-width: 100%; image-rendering: auto; }
.maprow figcaption { font-size: 12px; color: var(--dim); }
</style>
<main>
  <div class="lead">
    <span class="eyebrow">GLITCH GULP · GG-UI-01 · etap 2</span>
    <h1>Premium Game HUD w grze</h1>
    <p>Hybryda Premium Neon (panele główne) i Premium Minimal (panele pomocnicze). Każdy obraz pochodzi z renderera gry: ta sama scena, ten sam seed, ten sam bot. Kadr „Przed” to baza <code>b337835</code>, „Wzorzec” to zatwierdzona makieta etapu 1, „Produkcja” to wdrożony kod.</p>
  </div>
  <section>
    <h2>Osiem kadrów referencyjnych</h2>
    <p>Przełącz wersję, żeby porównać ten sam kadr. Pod obrazem: stan gry i kontrola zgodności z bazą (świat, kamera, wynik, liczba losowań, obraz bez warstw HUD).</p>
    <div class="grid">${SCENES.map(compareCard).join('\n')}</div>
  </section>
  <section>
    <h2>Cztery poprawki z odbioru</h2>
    <div class="grid">
      ${group(1, 'Wyzwanie dnia i język angielski: pełny tytuł, plakietka miejsca w panelu')}
      ${fixes.filter(s => s.id.startsWith('f1')).map(shotCard).join('\n')}
      ${group(2, 'Baner awansu nie leży na combo: wolny pas albo przygaszone widżety')}
      ${fixes.filter(s => s.id.startsWith('f2')).map(shotCard).join('\n')}
      ${group(3, 'NELA nie zasłania wiru: dymek pod zegarem, także przy wirze T6')}
      ${fixes.filter(s => s.id.startsWith('f3')).map(shotCard).join('\n')}
      ${group(4, 'Minimapa w misji z ciemnością: plansza i wiry, żadnego obiektu')}
      ${mapRow('f4', 'Misja M15 (ciemność), mapka 1:1', [['prod/f4-dark-minimap-prod.png', 'W grze: ciemność, obiekty ukryte'], ['prod/f4-dark-lit-minimap-prod.png', 'Ta sama plansza przy świetle (tylko test): obiekty widoczne']])}
      ${fixes.filter(s => s.id === 'f4-dark').map(shotCard).join('\n')}
    </div>
  </section>
  <section>
    <h2>Minimapa 1:1</h2>
    <div class="grid">
      ${[['s1-arena-early', 'Arena, telefon, 104 px'], ['s2-arena-late', 'Arena późna, duże oddalenie'], ['s3-campaign', 'Kampania, boss'], ['s5-crazygames', 'CrazyGames, 92 px'], ['s6-desktop', 'Desktop, 161 px']].map(([id, t]) => mapRow(id, t, [[`prod/${id}-minimap-before.png`, 'Przed'], [`prod/${id}-minimap-prod.png`, 'Produkcja']])).join('\n')}
    </div>
  </section>
  <section>
    <h2>Małe telefony</h2>
    <div class="grid">${phones.map(shotCard).join('\n')}</div>
  </section>
</main>
<script>
document.querySelectorAll('[data-compare]').forEach(function (card) {
  var img = card.querySelector('figure img'), tabs = card.querySelectorAll('.seg button');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) { t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
      img.src = tab.dataset.src;
    });
  });
});
</script>
`;
fs.writeFileSync(path.join(UI1, 'gallery-artifact.html'), body);
fs.writeFileSync(path.join(UI1, 'gallery.html'), `<!doctype html>\n<html lang="pl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body style="margin:0">\n${body}</body>\n</html>\n`);
const imgs = [...body.matchAll(/(?:src|data-src)="([^"]+\.(?:jpg|png))"/g)].map(m => m[1]);
const missing = [...new Set(imgs)].filter(f => !fs.existsSync(path.join(UI1, f)));
console.log(`gallery: ${new Set(imgs).size} images, ${missing.length} missing${missing.length ? ': ' + missing.join(', ') : ''}`);
process.exit(missing.length ? 1 : 0);
