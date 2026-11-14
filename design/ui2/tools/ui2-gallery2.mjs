// GG-UI-02 stage 2 (evidence, not a test): the phone-readable gallery of
// BAZA / ZATWIERDZONA MAKIETA / PRODUKCJA -- the stage 1 frames of the base
// (`-before`) and of the approved direction per screen (`-a` or `-b`, the
// hybrid the owner approved) next to the same scene and profile shot from the
// production build (`-prod`, `node design/ui2/tools/ui2-shots.mjs --as=prod`).
//   node design/ui2/tools/ui2-gallery2.mjs
// Output: design/ui2/gallery-prod.html (open it from the repo, images beside
// it) and design/ui2/gallery-prod-artifact.html (the same page without the
// document shell, for publishing with the images as files).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENES, VP } from './ui2-scenes.mjs';

const UI2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const facts = JSON.parse(fs.readFileSync(path.join(UI2, 'shots', 'facts.json'), 'utf8'));
const has = (n) => fs.existsSync(path.join(UI2, 'shots', n + '.jpg'));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GROUPS = [['miasto', 'Miasto'], ['dzielnice', 'Dzielnice'], ['warsztat', 'Warsztat'], ['nagrody', 'Nagrody'], ['inne', 'Powiązane']];
const V = [['before', 'Baza'], ['mock', 'Makieta'], ['prod', 'Produkcja']];
/** The approved direction per screen (the owner's decision after stage 1): which mock-up the production build answers to. */
function mockOf(scene, frame) {
  const wide = frame.width > frame.height;
  if (scene.group === 'miasto') return scene.id === 'm4-roadmap' || scene.id === 'm0-welcome' ? 'a' : 'b';
  if (scene.id === 'd1-list' || scene.id === 'd2-current' || scene.id === 'd3-states') return wide ? 'a' : 'b';
  if (scene.id === 'd4-briefing-boss') return 'b';
  if (scene.group === 'dzielnice') return 'a';
  if (scene.group === 'warsztat') return 'b';
  if (['r1-first-arena', 'r2-later-arena', 'r4-core-level', 'r7-login'].includes(scene.id)) return 'a';
  if (scene.group === 'nagrody') return 'b';
  return 'a';
}
const MOCK_LABEL = { a: 'A', b: 'B' };

/** What changes in each direction, per scene (the owner reads this under the frame). */
const NOTES = {
  'm0-welcome': ['Ekran powitalny (FTUE).', 'Poza zakresem — tylko wspólne materiały.', 'Bez zmian kompozycji: logo, żywe demo i GRAJ.'],
  'm1-early': ['', 'B: miasto jako tło, herb LVL, szyna poziomów, kapsuła nagrody.', 'Wdrożone B. LVL 1 · realny procent po pierwszej rundzie; zakładki jeszcze zablokowane — jak w grze.'],
  'm2-mid': ['', 'B: szyna LVL 1–6, GRAJ z emblematem wiru, kafle z pasem nagłówka. Pływający dok — odrzucony.', 'Wdrożone B z nawigacją A (zwykły pasek). Na GRAJ kręci się wir gracza w założonym wyglądzie (ten sam Hole.draw() co w rundzie).'],
  'm3-max': ['', 'B: LVL 6, cała szyna świeci.', 'Wdrożone B. Zbudowane miasto zachowuje pasek powtarzalnej premii (72%) pod kapsułą.'],
  'm4-roadmap': ['', 'A: arkusz nagród w materiale HUD.', 'Wdrożone A: płyta z krawędzią, lista bez zmian.'],
  'd1-list': ['Zastany błąd na 320×568: GRAJ pod nawigacją, tytuł „DZIELNI…”.', 'Telefon: B (12 dzielnic naraz, liczniki, trasa, boss). Poziomo / desktop: A + znaczniki B.', 'Wdrożone. Telefon wysoki: siatka 4×3. Telefon niski: rząd całych kafli (po 3–4), GRAJ przypięty nad nawigacją, pełny tytuł. Poziomo / desktop: siatka gry z numerami i stanem.'],
  'd2-current': ['', 'B: lista misji jako trasa.', 'Wdrożone B: zielone węzły ukończonych, złoty węzeł misji do zagrania, znak BOSS na misji z bossem.'],
  'd3-states': ['', 'B: stany kafli rozróżnialne bez czytania.', 'Wdrożone B: ✓ odbudowana, „9/10” otwarta, kłódka, następna w przerywanej ramie.'],
  'd4-briefing-boss': ['Ikony celów = obiekty z planszy.', 'B: nagłówek w kolorze dzielnicy, wiersz bossa z plakietką BOSS.', 'Wdrożone B. Cel bossa na różowej płytce z większą ikoną; GRAJ przypięty, treść przewija się nad nim.'],
  'd5-locked': ['', 'A: arkusz w materiale HUD.', 'Wdrożone A.'],
  'w1-skins': ['', 'B: scena podglądu, plakietka stanu, przełącznik kategorii, karty kolekcjonerskie.', 'Wdrożone B z korektą: opis wyglądu („Kryształowe ściany”) zostaje przy podglądzie; 3 karty w rzędzie od 360 px, 2 na 320 px. Bez rzadkości — znak w rogu to źródło przedmiotu.'],
  'w2-equipped': ['', 'B: wyposażona / posiadane / do kupienia.', 'Wdrożone B. Podgląd przypięty nad listą jest nieprzezroczysty.'],
  'w3-buy': ['', 'B: plakietka DO KUPIENIA, cena i saldo bez zmian.', 'Wdrożone B: zakup tylko przyciskiem KUP I ZAŁÓŻ, cena 700 z 1240 — jak w grze.'],
  'w4-locked': ['', 'B: plakietka NAGRODA.', 'Wdrożone B: źródło nagrody (Core City LVL 6) bez ceny.'],
  'w5-auras': ['', 'B: te same karty dla smug.', 'Wdrożone B: ceny w monetach i pryzmatach z danych gry.'],
  'r1-first-arena': ['Pierwszy wynik: bez ×2 za reklamę, „Menu główne”, zapowiedź Warsztatu.', 'A: kompozycja i kafle rozmiaru / miejsca. Z B tylko kafle nagród.', 'Wdrożone A + kafle nagród B. Zasady FTUE bez zmian: brak ×2, „Menu główne”, plakietka bonusu nowicjusza.'],
  'r2-later-arena': ['', 'A + nagrody B: monety i XP jako dwa kafle, szeroka karta Core City.', 'Wdrożone. Rozmiar i miejsce zostają zwykłymi kaflami (bez pigułek B). Wynik bota różni się między przebiegami — to ta sama runda z seedem, nie zmiana reguł.'],
  'r3-mission': ['', 'B: gwiazdki na własnej płycie.', 'Wdrożone B; karta następnej misji z oznaczonym bossem.'],
  'r4-core-level': ['', 'A + szeroka karta Core City z B.', 'Wdrożone: karta Core City w złotej krawędzi, gdy runda dobiła poziom.'],
  'r5-core-reward': ['', 'B: karta-trofeum ze wstążką.', 'Wdrożone B: tytuł zdarzenia na wstążce, kolor = typ nagrody.'],
  'r6-chest': ['', 'B: złota karta skrzyni.', 'Wdrożone B.'],
  'r7-login': ['Zastane: ptaszki odebranych dni leżą na kwotach.', 'A: spokojny materiał.', 'Wdrożone A + poprawka kalendarza: znacznik odebranego dnia w rogu kafla, kwoty czytelne.'],
  'r8-district-unlock': ['', 'B: wstążka i rama w kolorze dzielnicy.', 'Wdrożone B.'],
  'x1-wyzwania': ['', 'Wspólne materiały A.', 'Wspólne materiały (portfel, nawigacja); bez przebudowy.'],
  'x2-profil': ['', 'Wspólne materiały A.', 'Bez przebudowy.']
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
/** The same controlled profile under the base frame and the production frame (the save before the scene's own action). */
function sameState(base, scene) {
  const a = facts[`${base}-before`], b = facts[`${base}-prod`];
  if (!a || !b) return null;
  const pick = (f) => { const s = f.facts.save; return JSON.stringify([s.owned, s.selected, s.auras, s.aura, s.completed, s.districts, s.level]); };
  return pick(a) === pick(b);
}
function card(scene, frame, suffix = '', extraTitle = '') {
  const base = `${scene.id}-${frame.id}${suffix}`;
  if (!has(`${base}-before`) || !has(`${base}-prod`)) return '';
  const mk = mockOf(scene, frame);
  const wide = frame.width > frame.height;
  const notes = NOTES[scene.id] || ['', '', ''];
  const ok = sameState(base, scene);
  return `<article class="card${wide ? ' wide' : ''}" data-group="${suffix ? 'en' : extraTitle ? 'responsive' : scene.group}" data-base="shots/${base}" data-mock="${mk}">
  <header><h3>${esc(scene.title)}${extraTitle ? ` <span class="frame">${esc(extraTitle)}</span>` : ''}</h3><p>${esc(scene.note)}</p></header>
  <div class="seg" role="tablist" aria-label="Wariant">${V.map(([v, l]) => `<button role="tab" data-v="${v}" aria-selected="${v === 'prod'}">${v === 'mock' ? 'Makieta ' + MOCK_LABEL[mk] : l}</button>`).join('')}<button class="side" data-side aria-pressed="false" title="Trzy kadry obok siebie">Obok siebie</button></div>
  <figure><button class="zoom" aria-label="Powiększ kadr"><img src="shots/${base}-prod.jpg" alt="${esc(scene.title)}" width="${Math.round(frame.width * frame.dsf)}" height="${Math.round(frame.height * frame.dsf)}" loading="lazy"></button></figure>
  <div class="trio" hidden>${V.map(([v, l]) => `<figure><figcaption>${l}</figcaption><img data-lazy="shots/${base}-${v === 'mock' ? mk : v}.jpg" alt="${esc(scene.title)} — ${l}" width="${Math.round(frame.width * frame.dsf)}" height="${Math.round(frame.height * frame.dsf)}"></figure>`).join('')}</div>
  <p class="note" data-notes="${esc(JSON.stringify(notes))}">${esc(notes[2])}</p>
  <p class="facts ${ok === false ? 'bad' : 'ok'}"><span>${ok === false ? 'RÓŻNICA PROFILU' : 'Ten sam profil testowy'}</span> ${factLine(base + '-prod')}</p>
</article>`;
}

const main = SCENES.map(s => card(s, VP.iphone)).join('\n');
const respScenes = SCENES.filter(s => s.responsive);
const resp = ['p320', 'p360', 'cg', 'land', 'desk', 'qhd'].map(f => respScenes.map(s => card(s, VP[f], '', VP[f].label)).join('\n')).join('\n');
const en = ['iphone', 'p320'].map(f => respScenes.map(s => card(s, VP[f], '-en', 'EN · ' + VP[f].label)).join('\n')).join('\n');

const page = `<title>GG-UI-02 Produkcja</title>
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
    <span class="eyebrow">GLITCH GULP · GG-UI-02 · etap 2 · wdrożenie produkcyjne</span>
    <h1>Baza / zatwierdzona makieta / produkcja</h1>
    <p>Trzy kadry tej samej sceny na tym samym profilu testowym: gra przed zmianą (commit 1395c18), makieta kierunku zatwierdzonego dla danego ekranu (A albo B) i prawdziwa gra po wdrożeniu. Kadry produkcyjne zdjęto tym samym narzędziem i z tych samych zapisów co etap 1; żaden nie jest wygenerowany przez AI.</p>
  </div>
  <div class="verdict">
    <div><b>Hybryda A + B</b><span>B: Miasto, Dzielnice na telefonie, odprawa, Warsztat, wynik misji, karty nagród. A: wynik Areny (z kaflami nagród B), nagroda dzienna, arkusze, nawigacja.</span></div>
    <div style="border-color: var(--pink)"><b>Cztery poprawki</b><span>Dzielnice na 320 px, GRAJ nie zasłania danych misji, karty Warsztatu 2 / 3 w rzędzie z opisem wyglądu, nawigacja bez pływającego doku.</span></div>
    <div style="border-color: var(--gold)"><b>Bez zmian reguł</b><span>Zapis v13, ceny, nagrody, FTUE, Core City i kolejność odblokowań są te same. Wynik rundy bota różni się między przebiegami (to nie zmiana gry).</span></div>
  </div>
  <div class="bar">
    <div class="chips" id="filters" role="toolbar" aria-label="Filtr ekranów">
      <button data-f="all" aria-pressed="true">Wszystko</button>${GROUPS.map(([k, l]) => `<button data-f="${k}" aria-pressed="false">${l}</button>`).join('')}<button data-f="responsive" aria-pressed="false">Rozdzielczości</button><button data-f="en" aria-pressed="false">EN</button>
    </div>
    <div class="global"><span>Wszystkie kadry:</span><div class="seg" id="globalSeg" role="tablist" aria-label="Wariant dla wszystkich kadrów">${V.map(([v, l]) => `<button role="tab" data-v="${v}" aria-selected="${v === 'prod'}">${l}</button>`).join('')}</div></div>
  </div>
  <section data-sec="screens"><h2>Ekrany · iPhone 390×844</h2><div class="grid">
${main}
  </div></section>
  <section data-sec="responsive"><h2>Rozdzielczości</h2><p>Cztery kluczowe sceny na każdym kadrze: 320×568, 360×800, CrazyGames 800×450, telefon poziomo 844×390, desktop 1366×768 i 2560×1440.</p><div class="grid">
${resp}
  </div></section>
  <section data-sec="en"><h2>Angielski</h2><p>Te same sceny z językiem EN (dłuższe napisy) na 390×844 i 320×568. Nowe napisy mają wpisy w I18N_EN.</p><div class="grid">
${en}
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
    card.querySelector('figure img').src = base + '-' + (v === 'mock' ? card.dataset.mock : v) + '.jpg';
    card.dataset.cur = v;
    const note = card.querySelector('.note');
    if (note) { const n = JSON.parse(note.dataset.notes); const t = n[['before', 'mock', 'prod'].indexOf(v)] || n[2]; note.textContent = t; note.hidden = !t; }
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
      box.base = card.dataset.base; box.mock = card.dataset.mock; box.cur = card.dataset.cur || card.querySelector('.seg [aria-selected="true"]').dataset.v; box.back = t;
      box.vs = $$('.seg [data-v]', card).map(b => [b.dataset.v, b.textContent]);
      boxEl.hidden = false; document.body.style.overflow = 'hidden'; pane.classList.add('fit'); drawBox();
    }
  });
  const boxEl = document.getElementById('box'), pane = document.getElementById('boxPane'), img = document.getElementById('boxImg'), hint = document.getElementById('boxHint'), box = {};
  function sizeBox() { img.style.width = pane.classList.contains('fit') ? '' : (img.naturalWidth > img.naturalHeight ? '260%' : '220%'); }
  function drawBox() {
    document.getElementById('boxSeg').innerHTML = box.vs.map(([v, l]) => '<button role="tab" data-v="' + v + '" aria-selected="' + (v === box.cur) + '">' + l + '</button>').join('');
    img.src = box.base + '-' + (box.cur === 'mock' ? box.mock : box.cur) + '.jpg';
  }
  img.addEventListener('load', sizeBox);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !boxEl.hidden) document.getElementById('boxClose').click(); });
  document.addEventListener('toggle', (e) => { if (e.target.open) $$('img[data-lazy]', e.target).forEach(i => { i.src = i.dataset.lazy; i.removeAttribute('data-lazy'); }); }, true);
})();
</script>
`;
fs.writeFileSync(path.join(UI2, 'gallery-prod-artifact.html'), page);
fs.writeFileSync(path.join(UI2, 'gallery-prod.html'), `<!doctype html>\n<html lang="pl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>html{color-scheme:dark}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n${page}</body>\n</html>\n`);
const cards = (page.match(/<article /g) || []).length;
console.log(`gallery: ${cards} cards`);
