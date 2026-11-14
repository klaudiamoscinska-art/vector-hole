// GG-UI-02 stage 1 (design only): builds the phone-readable PRZED / A / B
// gallery from the frames ui2-shots.mjs and vortex-compose.py wrote.
//   node design/ui2/tools/ui2-gallery.mjs
// Output: design/ui2/gallery.html (open it from the repo, images beside it)
// and design/ui2/gallery-artifact.html (the same page without the document
// shell, for publishing with the images as files).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES, VP } from './ui2-scenes.mjs';

const UI2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const facts = JSON.parse(fs.readFileSync(path.join(UI2, 'shots', 'facts.json'), 'utf8'));
const has = (n) => fs.existsSync(path.join(UI2, 'shots', n + '.jpg'));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GROUPS = [['miasto', 'Miasto'], ['dzielnice', 'Dzielnice'], ['warsztat', 'Warsztat'], ['nagrody', 'Nagrody'], ['inne', 'Powiązane']];
const V = [['before', 'Przed'], ['a', 'A'], ['b', 'B']];

/** What changes in each direction, per scene (the owner reads this under the frame). */
const NOTES = {
  'm0-welcome': ['Ekran powitalny: bez zmian kompozycji w obu kierunkach (poza zakresem — FTUE).', 'Tylko wspólne materiały.', 'Tylko wspólne materiały.'],
  'm1-early': ['', 'Karta miasta z krawędzią HUD, pasek postępu w barwach wiru, mocniejszy GRAJ.', 'Miasto jako tło ekranu, herb LVL, szyna sześciu poziomów, kapsuła następnej nagrody.'],
  'm2-mid': ['', 'Ten sam układ; kafle Kampanii i Wyzwania dnia z akcentem koloru, skrzynia w złotej ramie.', 'Szyna LVL 1–6 pokazuje realny postęp (LVL 3 · 46%). GRAJ z emblematem wiru, kafle trybów z nagłówkiem-pasem.'],
  'm3-max': ['', 'LVL 6: karta jak wyżej.', 'LVL 6: cała szyna świeci, pełna panorama miasta bez ramki.'],
  'm4-roadmap': ['', 'Arkusz nagród w materiale HUD.', 'Jak A (arkusz zostaje listą — to czytelne).'],
  'd1-list': ['', 'Pasek dzielnic zostaje przewijany; wyraźniejsze stany i karta misji z krawędzią w kolorze dzielnicy.', 'Wszystkie 12 dzielnic naraz (siatka 4×3, numery 01–12, znaczniki: ukończona / postęp / kłódka), licznik 2/12 i 29/240, cel bossa wyróżniony.'],
  'd2-current': ['', 'Bieżąca misja na liście w złotej ramie, złote gwiazdki.', 'Lista misji jako trasa: zielone węzły ukończonych, złoty węzeł bieżącej.'],
  'd3-states': ['', 'Ukończona dzielnica: zielony status na kaflu.', 'Ukończone, bieżąca, następna (przerywana ramka) i zablokowane — rozróżnialne bez czytania.'],
  'd4-briefing-boss': ['Ikony celów = obiekty z planszy (zasilacz, dźwig).', 'Odprawa w materiale HUD, większe ikony celów.', 'Nagłówek odprawy w kolorze dzielnicy, wiersz bossa z plakietką BOSS i większą ikoną dźwigu.'],
  'd5-locked': ['', 'Arkusz w materiale HUD.', 'Jak A.'],
  'w1-skins': ['', 'Zakładki i karty w materiale HUD, statusy jako pigułki (ZAŁÓŻ / ZAŁOŻONE / cena / nagroda).', 'Scena podglądu z siatką, plakietka statusu WYPOSAŻONE, zakładki jako przełącznik, karty kolekcjonerskie 3 w rzędzie ze znakiem źródła (start / monety / pryzmaty / nagroda).'],
  'w2-equipped': ['', 'Wyposażona skórka: krawędź HUD + wypełniona pigułka.', 'Wyposażona: krawędź HUD i znacznik; posiadane: obrys cyjan; do kupienia: złota cena.'],
  'w3-buy': ['', 'Skórka, na którą gracza stać: złota krawędź i złota cena.', 'Plakietka DO KUPIENIA przy podglądzie; cena i saldo bez zmian (700 z 1240).'],
  'w4-locked': ['', 'Nagroda Core City: zielona pigułka źródła.', 'Plakietka NAGRODA; karta przygaszona, ale czytelna.'],
  'w5-auras': ['', 'Smugi: ten sam system kart; ceny w pryzmatach.', 'Smugi: te same karty kolekcjonerskie; znak ◆ dla pryzmatów.'],
  'r1-first-arena': ['Pierwszy wynik: bez ×2 za reklamę, „Menu główne”, zapowiedź Warsztatu — zasady FTUE.', 'Te same elementy i kolejność; materiały HUD.', 'Te same elementy i kolejność; wynik na scenie, nagrody jako dwa kafle + karta Core City.'],
  'r2-later-arena': ['', 'Wynik z gradientem, karta nagród z krawędzią HUD.', 'Scena wyniku, pigułki rozmiaru i miejsca, kafle monet i XP, podium w rankingu (złoto / srebro / brąz).'],
  'r3-mission': ['', 'Złote gwiazdki z poświatą, kafle w szkle.', 'Gwiazdki na własnej płycie, czas jako pigułka.'],
  'r4-core-level': ['', 'Postęp Core City z plakietką LVL 4.', 'Karta Core City na pełną szerokość z krawędzią HUD.'],
  'r5-core-reward': ['', 'Karta nagrody w ramie koloru nagrody.', 'Karta-trofeum: wstążka ODBLOKOWANO, tytuł z gradientem, plakietka źródła.'],
  'r6-chest': ['', 'Jak karta nagrody (złota).', 'Wstążka SKRZYNIA OTWARTA, złota rama.'],
  'r7-login': ['', 'Kalendarz w materiale HUD.', 'Plakietka CODZIENNA NAGRODA, kafle dni w szkle.'],
  'r8-district-unlock': ['', 'Karta odblokowania dzielnicy.', 'Wstążka i rama w kolorze dzielnicy.'],
  'x1-wyzwania': ['Audyt: ekran poza zakresem etapu 2 (priorytet 2).', 'Dziedziczy wspólne materiały (nawigacja, portfel).', 'Dziedziczy wspólne materiały + pływająca nawigacja.'],
  'x2-profil': ['Audyt: ekran poza zakresem etapu 2 (priorytet 3).', 'Bez zmian.', 'Bez zmian.']
};

function factLine(name) {
  const f = facts[name]; if (!f) return '';
  const s = f.facts.save, sh = f.facts.shown;
  const bits = [`◇ ${s.coins}`, `◆ ${s.prisms}`, `Core City LVL ${s.coreLevel} · ${s.coreCharge}%`, `poziom ${s.level}`, `misje ${s.completed}/240`];
  if (sh.finalScore && f.facts.screens.includes('gameOverScreen')) bits.push(`wynik ${sh.finalScore}`, `+${sh.finalCoins} monet`);
  if (sh.unlockTitle) bits.push(sh.unlockTitle);
  return bits.map(esc).join(' · ');
}
const norm = (f) => JSON.stringify([f.facts.screens, f.facts.save, { ...f.facts.shown, prices: (f.facts.shown.prices || []).map(p => p.replace(/[◇◆★●\s]/g, '')) }]);
function sameState(base) {
  const names = V.map(([v]) => `${base}-${v}`).filter(n => facts[n]);
  return names.length === 3 && names.every(n => norm(facts[n]) === norm(facts[names[0]]));
}
function card(scene, frame, suffix = '', extraTitle = '') {
  const base = `${scene.id}-${frame.id}${suffix}`;
  if (!has(`${base}-before`)) return '';
  const wide = frame.width > frame.height;
  const notes = NOTES[scene.id] || ['', '', ''];
  const ok = sameState(base);
  return `<article class="card${wide ? ' wide' : ''}" data-group="${suffix ? 'en' : extraTitle ? 'responsive' : scene.group}" data-base="shots/${base}">
  <header><h3>${esc(scene.title)}${extraTitle ? ` <span class="frame">${esc(extraTitle)}</span>` : ''}</h3><p>${esc(scene.note)}</p></header>
  <div class="seg" role="tablist" aria-label="Wariant">${V.map(([v, l]) => `<button role="tab" data-v="${v}" aria-selected="${v === 'b'}">${l}</button>`).join('')}<button class="side" data-side aria-pressed="false" title="Trzy warianty obok siebie">Obok siebie</button></div>
  <figure><button class="zoom" aria-label="Powiększ kadr"><img src="shots/${base}-b.jpg" alt="${esc(scene.title)}" width="${Math.round(frame.width * frame.dsf)}" height="${Math.round(frame.height * frame.dsf)}" loading="lazy"></button></figure>
  <div class="trio" hidden>${V.map(([v, l]) => `<figure><figcaption>${l}</figcaption><img data-lazy="shots/${base}-${v}.jpg" alt="${esc(scene.title)} — ${l}" width="${Math.round(frame.width * frame.dsf)}" height="${Math.round(frame.height * frame.dsf)}"></figure>`).join('')}</div>
  <p class="note" data-notes="${esc(JSON.stringify(notes))}">${esc(notes[2])}</p>
  <p class="facts ${ok ? 'ok' : 'bad'}"><span>${ok ? 'Ten sam stan w trzech wariantach' : 'RÓŻNICA STANU'}</span> ${factLine(base + '-before')}</p>
</article>`;
}

const main = SCENES.map(s => card(s, VP.iphone)).join('\n');
const respScenes = SCENES.filter(s => s.responsive);
const resp = ['p320', 'p360', 'cg', 'land', 'desk', 'qhd'].map(f => respScenes.map(s => card(s, VP[f], '', VP[f].label)).join('\n')).join('\n');
const en = ['iphone', 'p320'].map(f => respScenes.map(s => card(s, VP[f], '-en', 'EN · ' + VP[f].label)).join('\n')).join('\n');

const VX = [['v0', 'W0 · obecny'], ['v1', 'W1 · odwrócony'], ['v2', 'W2 · spójny lej'], ['v3', 'W3 · tylko gracz']];
const VSK = [['rainbow', 'Horyzont (startowy)'], ['krysztal', 'Kryształ'], ['pink', 'Gorący Róż'], ['pryzmat', 'Pryzmat']];
const vortex = VSK.filter(([k]) => fs.existsSync(path.join(UI2, 'vortex', `anim-${k}.webp`))).map(([k, name]) => `<article class="card vx" data-group="wir" data-vx="vortex/anim-${k}">
  <header><h3>Wir „${esc(name)}”</h3><p>Ta sama runda (seed 4242, 26. sekunda, wynik 880, T4), 40 klatek po 1/30 s. Zmienia się wyłącznie rysowanie wiru.</p></header>
  <div class="seg" role="tablist" aria-label="Wariant wiru">${VX.map(([v, l], i) => `<button role="tab" data-vx="${v}" aria-selected="${i === 0}">${l}</button>`).join('')}</div>
  <figure><img class="anim" src="vortex/anim-${k}-v0.webp" alt="Animacja wiru ${esc(name)}" width="300" height="300" loading="lazy"></figure>
  <details><summary>Wszystkie cztery obok siebie (animacja)</summary><div class="scroll"><img data-lazy="vortex/anim-${k}.webp" alt="Cztery warianty obok siebie" width="1052" height="260"></div></details>
  <details><summary>Sekwencja 6 klatek co 0,1 s</summary><div class="scroll"><img data-lazy="vortex/strip-${k}.jpg" alt="Sekwencja klatek" width="1210" height="808"></div></details>
</article>`).join('\n');
const vortexFull = `<article class="card" data-group="wir" data-base="vortex/full">
  <header><h3>Pełny kadr gry z HUD</h3><p>Ta sama klatka rundy w czterech wariantach (wir „Horyzont”).</p></header>
  <div class="seg" role="tablist">${VX.map(([v, l], i) => `<button role="tab" data-v="${v}" aria-selected="${i === 0}">${l.split(' · ')[0]}</button>`).join('')}</div>
  <figure><button class="zoom" aria-label="Powiększ kadr"><img src="vortex/full-v0.jpg" alt="Pełny kadr" width="780" height="1688" loading="lazy"></button></figure>
</article>`;

const page = `<title>GG-UI-02 Premium Experience</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Exo+2:wght@500;700;800&family=Russo+One&display=swap">
<style>
/* layout: a sticky filter bar over one grid of frame cards; portrait frames sit side by side on a wide screen, landscape frames span the row. One dark world (the game's own palette, design/reference/asset_bible.svg). */
:root { --bg: #04101D; --panel: #0A2032; --panel-2: #071725; --line: rgba(242, 248, 255, 0.12); --fg: #f2f8ff; --dim: rgba(242, 248, 255, 0.66); --cyan: #50F0FA; --gold: #EFCB63; --pink: #FF54AD; --green: #46D99A; --violet: #9875FF; --scrim: rgba(2, 8, 16, 0.96);
  --display: 'Russo One', 'Arial Black', 'Segoe UI', sans-serif; --text: 'Exo 2', 'Segoe UI', system-ui, sans-serif; color-scheme: dark; }
body { background: var(--bg); color: var(--fg); font: 500 15px/1.5 var(--text); padding-block: 20px 56px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
main { max-width: 1240px; margin: 0 auto; display: flex; flex-direction: column; gap: 22px; }
h1 { font: 400 26px/1.15 var(--display); letter-spacing: 0.03em; margin: 0; text-wrap: balance; }
h2 { font: 400 18px/1.2 var(--display); letter-spacing: 0.04em; margin: 0; color: var(--cyan); text-wrap: balance; }
h3 { font: 800 14px/1.3 var(--text); margin: 0; }
p { margin: 0; color: var(--dim); max-width: 70ch; }
.eyebrow { font: 800 11px/1 var(--text); letter-spacing: 0.16em; text-transform: uppercase; color: var(--gold); }
.lead { display: flex; flex-direction: column; gap: 8px; }
.verdict { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr)); gap: 10px; }
.verdict div { padding: 10px 12px; border-left: 3px solid var(--cyan); background: var(--panel-2); display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.verdict b { font: 400 13px/1.2 var(--display); letter-spacing: 0.05em; color: var(--fg); }
.verdict span { font-size: 13px; color: var(--dim); }
.bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; margin: 0 -4px; padding: 8px 4px; background: var(--bg); display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid var(--line); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg); }
.chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.chips::-webkit-scrollbar { display: none; }
.chips button, .seg button { flex: none; min-height: 40px; padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--panel-2); color: var(--dim); font: 800 12px/1.1 var(--text); letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; }
.chips button[aria-pressed="true"] { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.global { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--dim); }
.seg { display: flex; gap: 4px; padding: 3px; background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; }
.seg button { flex: 1; min-width: 0; border: 0; border-radius: 7px; background: none; padding: 6px 4px; }
.seg button[aria-selected="true"] { background: var(--cyan); color: var(--bg); }
.seg button.side { flex: 0 0 auto; padding: 6px 10px; color: var(--gold); }
.seg button.side[aria-pressed="true"] { background: var(--gold); color: var(--bg); }
.global .seg { flex: 1; max-width: 320px; }
button:focus-visible, summary:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 16px; align-items: start; }
.card { min-width: 0; display: flex; flex-direction: column; gap: 10px; padding: 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; }
.card.wide, .card.open { grid-column: 1 / -1; }
.card header { display: flex; flex-direction: column; gap: 3px; }
.card header p, .note { font-size: 13px; }
.frame { font: 800 10px/1 var(--text); letter-spacing: 0.08em; color: var(--bg); background: var(--gold); padding: 3px 6px; border-radius: 5px; white-space: nowrap; }
figure { margin: 0; min-width: 0; }
figure img { display: block; width: 100%; height: auto; border-radius: 8px; background: #000; }
.zoom { display: block; width: 100%; padding: 0; border: 0; background: none; cursor: zoom-in; }
.card:not(.wide):not(.open) > figure { max-width: 390px; width: 100%; margin: 0 auto; }
.trio { display: grid; grid-template-columns: repeat(3, minmax(240px, 1fr)); gap: 8px; overflow-x: auto; }
.card.wide .trio { grid-template-columns: repeat(3, minmax(420px, 1fr)); }
.trio figcaption { font: 800 11px/1 var(--text); letter-spacing: 0.1em; text-transform: uppercase; color: var(--gold); padding: 0 0 5px; }
.note { color: var(--fg); }
.facts { font-size: 12px; font-variant-numeric: tabular-nums; }
.facts span { font-weight: 800; color: var(--green); }
.facts.bad span { color: var(--pink); }
.vx .anim { max-width: 300px; margin: 0 auto; image-rendering: auto; }
details { font-size: 13px; }
summary { cursor: pointer; color: var(--cyan); font-weight: 700; min-height: 32px; display: flex; align-items: center; }
.scroll { overflow-x: auto; }
.scroll img { max-width: none; width: auto; height: auto; border-radius: 8px; }
section { display: flex; flex-direction: column; gap: 12px; }
table { border-collapse: collapse; font-size: 13px; width: 100%; min-width: 560px; }
th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--gold); font: 800 11px/1.2 var(--text); letter-spacing: 0.08em; text-transform: uppercase; }
.box { position: fixed; inset: 0; z-index: 20; background: var(--scrim); display: flex; flex-direction: column; padding: calc(8px + env(safe-area-inset-top, 0px)) max(8px, env(safe-area-inset-right, 0px)) calc(8px + env(safe-area-inset-bottom, 0px)) max(8px, env(safe-area-inset-left, 0px)); gap: 8px; }
.box .top { display: flex; gap: 8px; align-items: center; }
.box .seg { flex: 1; }
.box .x { flex: none; width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--line); background: var(--panel); color: var(--fg); font: 400 20px/1 var(--display); cursor: pointer; }
.box .pane { flex: 1; min-height: 0; overflow: auto; -webkit-overflow-scrolling: touch; text-align: center; }
.box .pane img { border-radius: 6px; max-width: none; height: auto; display: block; margin: 0 auto; }
.box .pane.fit { display: grid; place-items: center; overflow: hidden; }
.box .pane.fit img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; }
.box .hint { font-size: 12px; color: var(--dim); text-align: center; }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto; } }
</style>
<main>
  <div class="lead">
    <span class="eyebrow">GLITCH GULP · GG-UI-02 · etap 1 · projekt, bez wdrożenia</span>
    <h1>Miasto, Dzielnice, Warsztat i nagrody: PRZED / A / B</h1>
    <p>Każdy kadr pochodzi z prawdziwej gry (commit 1395c18) na odizolowanym profilu testowym. Warianty A i B to nakładki CSS i DOM dodane w pamięci przeglądarki po ustawieniu sceny, więc saldo, postęp, ceny i odblokowania są w trzech wersjach identyczne. Pliki gry nie zostały zmienione.</p>
  </div>
  <div class="verdict">
    <div><b>A · Premium Evolution</b><span>Te same układy, materiały i krawędzie z HUD GG-UI-01, czytelniejsze stany. Małe ryzyko.</span></div>
    <div style="border-color: var(--pink)"><b>B · Premium Experience</b><span>Nowa kompozycja: miasto jako tło, szyna LVL 1–6, 12 dzielnic naraz, karty kolekcjonerskie, scena wyniku.</span></div>
    <div style="border-color: var(--gold)"><b>Rekomendacja: hybryda</b><span>B dla Miasta, Dzielnic (telefon), Warsztatu i kart nagród; A dla wyniku Areny i arkuszy; układy poziome zostają przy siatce gry.</span></div>
  </div>
  <div class="bar">
    <div class="chips" id="filters" role="toolbar" aria-label="Filtr ekranów">
      <button data-f="all" aria-pressed="true">Wszystko</button>${GROUPS.map(([k, l]) => `<button data-f="${k}" aria-pressed="false">${l}</button>`).join('')}<button data-f="responsive" aria-pressed="false">Rozdzielczości</button><button data-f="en" aria-pressed="false">EN</button><button data-f="wir" aria-pressed="false">Wir</button>
    </div>
    <div class="global"><span>Wszystkie kadry:</span><div class="seg" id="globalSeg" role="tablist" aria-label="Wariant dla wszystkich kadrów">${V.map(([v, l]) => `<button role="tab" data-v="${v}" aria-selected="${v === 'b'}">${l}</button>`).join('')}</div></div>
  </div>
  <section data-sec="screens"><h2>Ekrany · iPhone 390×844</h2><div class="grid">
${main}
  </div></section>
  <section data-sec="responsive"><h2>Rozdzielczości</h2><p>Cztery kluczowe sceny na każdym kadrze: 320×568, 360×800, CrazyGames 800×450, telefon poziomo 844×390, desktop 1366×768 i 2560×1440.</p><div class="grid">
${resp}
  </div></section>
  <section data-sec="en"><h2>Angielski</h2><p>Te same sceny z językiem EN (dłuższe napisy) na 390×844 i 320×568.</p><div class="grid">
${en}
  </div></section>
  <section data-sec="wir"><h2>Kierunek obrotu wiru — audyt i podgląd</h2>
    <p>Prototyp tylko do oceny: przeglądarka dostała w pamięci zmodyfikowaną kopię game.js, plik w repozytorium jest bez zmian. Stan rundy jest identyczny we wszystkich wariantach (wynik 880, promień 92, 9153 losowania).</p>
    <div class="scroll"><table>
      <tr><th>Wariant</th><th>Co się zmienia</th><th>Ocena</th></tr>
      <tr><td><b>W0 · obecny</b></td><td>Warstwy wiru kręcą się w kierunkach zapisanych per skórka (część przeciwbieżnie), pyłki dysku zgodnie z zegarem, cząstki pochłaniania przeciwnie, a połykany obiekt losowo w lewo albo w prawo.</td><td>Wir wygląda dobrze, ale materia wpada „pod prąd” w połowie przypadków.</td></tr>
      <tr><td><b>W1 · pełne odwrócenie</b></td><td>Cały wir w lustrze (ramiona nadal ciągną się za obrotem), cząstki też.</td><td>Ani lepiej, ani gorzej — to ten sam wir w odbiciu. Zmiana bez zysku.</td></tr>
      <tr><td><b>W2 · spójny lej</b> (rekomendowany)</td><td>Wygląd wiru bez zmian; połykane obiekty i cząstki zawsze wirują zgodnie z ramionami wiru.</td><td>Najmocniejsze wrażenie zasysania: wszystko spływa jednym nurtem. Czytelność bez zmian.</td></tr>
      <tr><td><b>W3 · tylko wir gracza</b></td><td>Wir gracza w lustrze, rywale jak dziś.</td><td>Różnica prawie niezauważalna w ruchu; nie pomaga odróżnić gracza.</td></tr>
    </table></div>
    <div class="grid">
${vortex}
${vortexFull}
  </div></section>
</main>
<div class="box" id="box" hidden role="dialog" aria-modal="true" aria-label="Powiększony kadr">
  <div class="top"><div class="seg" id="boxSeg" role="tablist"></div><button class="x" id="boxFit" aria-label="Pełny kadr albo powiększenie" title="Pełny kadr / powiększenie">⤢</button><button class="x" id="boxClose" aria-label="Zamknij">×</button></div>
  <div class="pane fit" id="boxPane"><img id="boxImg" alt=""></div>
  <div class="hint" id="boxHint">Pełny kadr. Dotknij ⤢, żeby powiększyć i przesuwać.</div>
</div>
<script>
(function () {
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  function setCard(card, v) {
    const base = card.dataset.base; if (!base) return;
    const btn = card.querySelector('.seg [data-v="' + v + '"]'); if (!btn) return;
    $$('.seg [data-v]', card).forEach(b => b.setAttribute('aria-selected', String(b === btn)));
    card.querySelector('figure img').src = base + '-' + v + '.jpg';
    card.dataset.cur = v;
    const note = card.querySelector('.note');
    if (note) { const n = JSON.parse(note.dataset.notes); const t = n[['before', 'a', 'b'].indexOf(v)] || n[2]; note.textContent = t; note.hidden = !t; }
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    const card = t.closest('.card');
    if (t.dataset.f) {
      $$('#filters button').forEach(b => b.setAttribute('aria-pressed', String(b === t)));
      const f = t.dataset.f;
      $$('.card').forEach(c => { c.hidden = !(f === 'all' || c.dataset.group === f); });
      $$('section[data-sec]').forEach(s => { s.hidden = !$$('.card', s).some(c => !c.hidden); });
      window.scrollTo(0, 0);
    } else if (t.closest('#globalSeg')) {
      $$('#globalSeg button').forEach(b => b.setAttribute('aria-selected', String(b === t)));
      $$('.card[data-base]').forEach(c => { if (!c.dataset.base.startsWith('vortex/')) setCard(c, t.dataset.v); });
    } else if (t.closest('#boxSeg')) {
      box.cur = t.dataset.v; drawBox();
    } else if (t.id === 'boxClose') { boxEl.hidden = true; document.body.style.overflow = ''; if (box.back) box.back.focus(); }
    else if (t.id === 'boxFit') { pane.classList.toggle('fit'); hint.textContent = pane.classList.contains('fit') ? 'Pełny kadr. Dotknij ⤢, żeby powiększyć i przesuwać.' : 'Powiększenie — przesuwaj palcem; ⤢ wraca do pełnego kadru.'; sizeBox(); }
    else if (card && t.dataset.v) setCard(card, t.dataset.v);
    else if (card && t.dataset.vx) {
      $$('.seg [data-vx]', card).forEach(b => b.setAttribute('aria-selected', String(b === t)));
      card.querySelector('.anim').src = card.dataset.vx + '-' + t.dataset.vx + '.webp';
    } else if (card && t.hasAttribute('data-side')) {
      const on = t.getAttribute('aria-pressed') !== 'true';
      t.setAttribute('aria-pressed', String(on));
      const trio = card.querySelector('.trio');
      $$('img[data-lazy]', trio).forEach(i => { i.src = i.dataset.lazy; i.removeAttribute('data-lazy'); });
      trio.hidden = !on; card.querySelector(':scope > figure').hidden = on; card.classList.toggle('open', on);
    } else if (card && t.classList.contains('zoom')) {
      box.base = card.dataset.base; box.cur = card.dataset.cur || card.querySelector('.seg [aria-selected="true"]').dataset.v; box.back = t;
      box.vs = $$('.seg [data-v]', card).map(b => [b.dataset.v, b.textContent]);
      boxEl.hidden = false; document.body.style.overflow = 'hidden'; pane.classList.add('fit'); drawBox();
    }
  });
  const boxEl = document.getElementById('box'), pane = document.getElementById('boxPane'), img = document.getElementById('boxImg'), hint = document.getElementById('boxHint'), box = {};
  function sizeBox() { img.style.width = pane.classList.contains('fit') ? '' : (img.naturalWidth > img.naturalHeight ? '260%' : '220%'); }
  function drawBox() {
    document.getElementById('boxSeg').innerHTML = box.vs.map(([v, l]) => '<button role="tab" data-v="' + v + '" aria-selected="' + (v === box.cur) + '">' + l + '</button>').join('');
    img.src = box.base + '-' + box.cur + '.jpg';
  }
  img.addEventListener('load', sizeBox);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !boxEl.hidden) document.getElementById('boxClose').click(); });
  document.addEventListener('toggle', (e) => { if (e.target.open) $$('img[data-lazy]', e.target).forEach(i => { i.src = i.dataset.lazy; i.removeAttribute('data-lazy'); }); }, true);
})();
</script>
`;
fs.writeFileSync(path.join(UI2, 'gallery-artifact.html'), page);
fs.writeFileSync(path.join(UI2, 'gallery.html'), `<!doctype html>\n<html lang="pl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>html{color-scheme:dark}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n${page}</body>\n</html>\n`);
const cards = (page.match(/<article /g) || []).length;
console.log(`gallery: ${cards} cards`);
