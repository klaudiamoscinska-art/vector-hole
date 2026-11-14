// Builds the GG-UX-03 gallery from design/ux3/manifest.json (ux3-shots.mjs):
//   design/ux3/gallery.html           -- images by relative path (open from the repo)
//   design/ux3/gallery-artifact.html  -- the same page with every image inlined
// Usage: node design/ux3/tools/ux3-gallery.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTD = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const M = JSON.parse(fs.readFileSync(path.join(OUTD, 'manifest.json'), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const FR = 12;

function build(inline) {
  const src = (f) => {
    if (!inline) return 'shots/' + f;
    const ext = path.extname(f).slice(1), type = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${type};base64,` + fs.readFileSync(path.join(OUTD, 'shots', f)).toString('base64');
  };
  const groups = [];
  for (const s of M.shots) { let g = groups.find(x => x.name === s.group); if (!g) groups.push(g = { name: s.group, items: [] }); g.items.push(s); }
  const intro = {
    'Sterowanie': 'Dwa tryby dotyku: PRZECIĄGANIE (domyślne, bez zmian) i JOYSTICK, który pojawia się tam, gdzie palec dotknie planszy — u góry, na środku albo na dole.',
    'Minimapa': 'Domyślnie w lewym dolnym rogu, żeby prawy kciuk jej nie zasłaniał. Strona do zmiany w Profil → Ustawienia; wybór zostaje po ponownym uruchomieniu.',
    'Koniec rundy': 'Ta sama runda z tego samego ziarna (seed 303, wariant „blackout”) na bazie i po zmianie. Wynik, obiekty i moment końca są identyczne; znika tylko czarna warstwa i napis ZACIEMNIENIE.',
    'Rozgrywka': 'Zrzuty z prawdziwej gry po zmianie: Arena i Kampania na telefonie, ramka CrazyGames 800×450 i Warsztat.'
  };
  const card = (s) => `<figure class="shot"><img loading="lazy" src="${src(s.file)}" alt="${esc(s.title)}"><figcaption><b>${esc(s.title)}</b>${s.note ? `<span>${esc(s.note)}</span>` : ''}</figcaption></figure>`;
  const sections = groups.map(g => `<section class="grp" id="${g.name === 'Sterowanie' ? 'sterowanie' : g.name === 'Minimapa' ? 'minimapa' : g.name === 'Koniec rundy' ? 'finisz' : 'gra'}"><h2>${esc(g.name)}</h2><p class="lead">${esc(intro[g.name] || '')}</p><div class="shots">${g.items.map(card).join('')}</div></section>`);
  const vort = M.vortices.map(v => `<div class="vrow"><div class="vname">${esc(v.name)}</div>
    <div class="vcell"><div class="flip" style="background-image:url('${src(v.before)}')"></div><small>PRZED</small></div>
    <div class="vcell"><div class="flip" style="background-image:url('${src(v.after)}')"></div><small>PO — odbity</small></div>
    <div class="strip"><img loading="lazy" src="${src(v.after)}" alt="${esc(v.name)}: 12 klatek po zmianie"></div></div>`).join('');
  const body = `
<header class="top"><div class="wrap">
  <p class="eyebrow">GLITCH GULP · GG-UX-03 · dowody z prawdziwego renderera</p>
  <h1>Sterowanie, minimapa, finisz i lustrzane wiry</h1>
  <p class="lead">Każdy obraz to zrzut ekranu albo płótno narysowane przez samą grę: baza <code>${M.base.slice(0, 12)}</code> (PRZED) i kandydat GG-UX-03 (PO).</p>
  <nav><a href="#sterowanie">Sterowanie</a><a href="#minimapa">Minimapa</a><a href="#finisz">Koniec rundy</a><a href="#wiry">Wiry</a><a href="#gra">Rozgrywka</a></nav>
</div></header>
<main class="wrap">
${sections.slice(0, 3).join('\n')}
<section class="grp" id="wiry"><h2>Wiry — PRZED / PO</h2>
<p class="lead">Dziesięć skórek jako Twój wir i jako rywal. Animacje pokazują 0,8 s gry (12 klatek co 1/15 s): kierunek i tempo obrotu są takie same, odwrócona jest tylko skrętność ramion. Pod każdą parą pełny pasek klatek po zmianie.</p>
<p class="ctl"><button id="toggleAnim" type="button" aria-pressed="false">Zatrzymaj animacje</button></p>
<div class="vgrid">${vort}</div></section>
${sections.slice(3).join('\n')}
<footer><p>Wygenerowano: <code>node design/ux3/tools/ux3-shots.mjs</code>, potem <code>node design/ux3/tools/ux3-gallery.mjs</code>. Testy: <code>node qa/ux3.mjs</code>.</p></footer>
</main>
<script>
(function () {
  var b = document.getElementById('toggleAnim');
  b.addEventListener('click', function () {
    var on = document.body.classList.toggle('paused');
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.textContent = on ? 'Wznów animacje' : 'Zatrzymaj animacje';
  });
})();
</script>`;
  const head = `<title>GG-UX-03 Gallery</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700&family=Russo+One&display=swap">
<style>
/* Layout: one column of evidence groups on the game's own night-city ground; shots in a wrapping grid, vortex pairs side by side. Single dark theme on purpose (the game's look). */
:root {
  --bg: #04101D; --panel: #0B1A2A; --hair: rgba(232, 241, 255, 0.12); --fg: #E8F1FF; --mute: #9FB3C8;
  --cyan: #50F0FA; --pink: #FF54AD; --violet: #9875FF; --gold: #EFCB63;
  --display: 'Russo One', 'Exo 2', 'Segoe UI', sans-serif; --text: 'Exo 2', 'Segoe UI', system-ui, sans-serif;
  color-scheme: dark;
}
body { background: var(--bg); color: var(--fg); font: 15px/1.5 var(--text); margin: 0; }
.wrap { max-width: 1180px; margin: 0 auto; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.top { border-bottom: 1px solid var(--hair); background: linear-gradient(180deg, #0B1A2A, var(--bg)); }
.top .wrap { padding-block: 28px 18px; display: grid; gap: 10px; }
.eyebrow { margin: 0; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--cyan); }
h1 { margin: 0; font: 400 clamp(24px, 5vw, 38px)/1.1 var(--display); text-wrap: balance; }
h2 { margin: 0; font: 400 22px/1.2 var(--display); color: var(--fg); }
.lead { margin: 0; max-width: 68ch; color: var(--mute); }
code { font-family: ui-monospace, Menlo, monospace; font-size: 0.9em; color: var(--gold); }
nav { display: flex; flex-wrap: wrap; gap: 8px; }
nav a { color: var(--fg); text-decoration: none; border: 1px solid var(--hair); border-radius: 999px; padding: 6px 12px; font-weight: 600; font-size: 13px; }
nav a:hover, nav a:focus-visible { border-color: var(--cyan); outline: none; }
main { display: grid; gap: 36px; padding-block: 28px 40px; }
.grp { display: grid; gap: 12px; }
.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: 16px; align-items: start; }
.shot { margin: 0; display: grid; gap: 8px; min-width: 0; }
.shot img { width: 100%; height: auto; border-radius: 10px; border: 1px solid var(--hair); background: var(--panel); }
figcaption { display: grid; gap: 2px; font-size: 13px; }
figcaption span { color: var(--mute); }
.ctl { margin: 0; }
button { font: 600 14px var(--text); color: var(--bg); background: var(--cyan); border: 0; border-radius: 8px; padding: 9px 14px; min-height: 44px; cursor: pointer; }
button:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.vgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 18px; }
.vrow { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 10px; padding: 12px; border: 1px solid var(--hair); border-radius: 12px; background: var(--panel); min-width: 0; }
.vname { grid-column: 1 / -1; font: 400 15px var(--display); }
.vcell { display: grid; gap: 4px; justify-items: center; min-width: 0; }
.vcell small { font-size: 11px; letter-spacing: 0.1em; color: var(--mute); }
.vcell:nth-child(3) small { color: var(--cyan); }
.flip { width: 100%; max-width: 100%; aspect-ratio: 1; background-size: ${FR * 100}% 100%; background-repeat: no-repeat; border-radius: 8px; animation: turn 0.8s steps(${FR}, jump-none) infinite; }
.paused .flip { animation-play-state: paused; }
@keyframes turn { from { background-position: 0% 0; } to { background-position: 100% 0; } }
.strip { grid-column: 1 / -1; overflow-x: auto; }
.strip img { height: 70px; width: auto; max-width: none; display: block; border-radius: 6px; }
footer { color: var(--mute); font-size: 13px; border-top: 1px solid var(--hair); padding-top: 16px; }
@media (prefers-reduced-motion: reduce) { .flip { animation: none; } }
</style>`;
  return inline ? head + body : `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${head}</head><body>${body}</body></html>`;
}
fs.writeFileSync(path.join(OUTD, 'gallery.html'), build(false));
fs.writeFileSync(path.join(OUTD, 'gallery-artifact.html'), build(true));
console.log('gallery.html + gallery-artifact.html', (fs.statSync(path.join(OUTD, 'gallery-artifact.html')).size / 1e6).toFixed(1) + ' MB');
