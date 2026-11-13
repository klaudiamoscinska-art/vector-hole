// GG-UI-02 stage 1: the design stage's minimal QA (no game regression run --
// the game is not changed). Prints PASS / FAIL / NOT RUN per check and writes
// design/ui2/qa-stage1.json. Exit 1 on a FAIL.
//   node design/ui2/tools/ui2-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, serve, ROOT } from '../../../qa/lib.mjs';
const UI2 = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '1395c18814f4b775850d39b45859908e4c552704';
const results = [];
const rec = (id, name, status, detail) => { results.push({ id, name, status, detail }); console.log(`${status.padEnd(7)} ${id} ${name} — ${detail}`); };
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// Q1: the game's runtime files are byte-identical to the base commit; nothing outside design/ui2 changed.
{
  const files = ['game.js', 'style.css', 'index.html'];
  const same = files.map(f => [f, sha(path.join(ROOT, f)) === crypto.createHash('sha256').update(execSync(`git -C "${ROOT}" show ${BASE}:${f}`, { maxBuffer: 64 << 20 })).digest('hex')]);
  const outside = execSync(`git -C "${ROOT}" status --porcelain`).toString().split('\n').filter(Boolean).map(l => l.slice(3)).filter(p => !p.startsWith('design/ui2'));
  const diff = execSync(`git -C "${ROOT}" diff --name-only ${BASE} HEAD`).toString().split('\n').filter(Boolean).filter(p => !p.startsWith('design/ui2'));
  rec('Q1', 'pliki gry bez zmian', same.every(x => x[1]) && !outside.length && !diff.length ? 'PASS' : 'FAIL', `${same.map(x => `${x[0]} ${x[1] ? '=' : '≠'} ${BASE.slice(0, 7)}`).join(', ')}; zmiany poza design/ui2: ${outside.concat(diff).join(', ') || 'brak'}`);
}
const facts = JSON.parse(fs.readFileSync(path.join(UI2, 'shots', 'facts.json'), 'utf8'));
const names = Object.keys(facts);
const bases = [...new Set(names.map(n => n.replace(/-(before|a|b)$/, '')))];
const norm = (f) => JSON.stringify([f.facts.screens, f.facts.save, { ...f.facts.shown, prices: (f.facts.shown.prices || []).map(p => p.replace(/[◇◆★●\s]/g, '')) }]);
// Q2: every scene has the same save and the same on-screen values in PRZED / A / B.
{
  const bad = bases.filter(b => !['before', 'a', 'b'].every(v => facts[`${b}-${v}`] && norm(facts[`${b}-${v}`]) === norm(facts[`${b}-before`])));
  rec('Q2', 'zgodność danych PRZED/A/B', bad.length ? 'FAIL' : 'PASS', `${bases.length - bad.length}/${bases.length} scen × kadr z identycznym zapisem i wartościami na ekranie${bad.length ? '; różnice: ' + bad.join(', ') : ''}`);
}
// Q3: the values shown match the save (wallet, Core City level and charge).
{
  const bad = [];
  for (const n of names) {
    const f = facts[n].facts; if (!f.screens.includes('mainMenu') || f.screens.length !== 1) continue;
    const coins = Number(String(f.shown.coinsMenu).replace(/\D/g, '')), prisms = Number(String(f.shown.prismsMenu).replace(/\D/g, ''));
    if (coins !== f.save.coins || prisms !== f.save.prisms || f.shown.lvl !== `LVL ${f.save.coreLevel}` || f.shown.charge !== `${Math.round(f.save.coreCharge)}%`) bad.push(n);
  }
  const hub = names.filter(n => facts[n].facts.screens.join() === 'mainMenu').length;
  rec('Q3', 'wartości profilu na ekranie = zapis', bad.length ? 'FAIL' : 'PASS', `${hub - bad.length}/${hub} kadrów Miasta: monety, pryzmaty, LVL i % zgodne z zapisem${bad.length ? '; ' + bad.join(', ') : ''}`);
}
// Q4: no console / page errors while staging and applying the variants.
{
  const bad = names.filter(n => facts[n].errors.length);
  rec('Q4', 'brak błędów konsoli (gra + nakładki)', bad.length ? 'FAIL' : 'PASS', `${names.length - bad.length}/${names.length} kadrów bez błędów${bad.length ? '; ' + bad.slice(0, 5).join(', ') : ''}`);
}
// Q5: the game page never scrolls sideways under a variant.
{
  const bad = names.filter(n => facts[n].layout.docW > facts[n].layout.winW + 1);
  rec('Q5', 'makiety: brak poziomego przewijania strony gry', bad.length ? 'FAIL' : 'PASS', `${names.length - bad.length}/${names.length}${bad.length ? '; ' + bad.slice(0, 6).join(', ') : ''}`);
}
// Q6: text cut by the layout -- a variant must not cut more than PRZED does (PL), and separately EN.
for (const [id, label, pick] of [['Q6', 'ucięte napisy PL (A/B względem PRZED)', (n) => !/-en$/.test(n)], ['Q7', 'dłuższe napisy EN (A/B względem PRZED)', (n) => /-en$/.test(n)]]) {
  const worse = []; let n0 = 0, have = true;
  for (const b of bases.filter(pick)) {
    const base = facts[`${b}-before`]; if (!base || !base.layout.clipped) { have = false; continue; }
    n0++;
    for (const v of ['a', 'b']) {
      const f = facts[`${b}-${v}`]; if (!f) continue;
      const extra = f.layout.clipped.filter(t => !base.layout.clipped.includes(t));
      if (extra.length) worse.push(`${b}-${v}: ${extra.slice(0, 3).join(' | ')}`);
    }
  }
  if (!n0) rec(id, label, 'NOT RUN', have ? 'brak kadrów' : 'kadry bez pomiaru uciętych napisów');
  else rec(id, label, worse.length ? 'FAIL' : 'PASS', `${n0} scen × kadr; nowe ucięcia: ${worse.length ? worse.slice(0, 8).join(' ; ') : 'brak'}`);
}
// Q8: the two known responsive problems (ui2-responsive-audit.mjs).
{
  const f = path.join(UI2, 'responsive-audit.json');
  if (!fs.existsSync(f)) rec('Q8', 'analiza dwóch problemów responsive', 'NOT RUN', 'brak responsive-audit.json');
  else {
    const a = JSON.parse(fs.readFileSync(f, 'utf8'));
    const at = (v) => a.cta.find(x => x.frame === '320x568' && x.variant === v);
    const stable = new Set(a.big.map(x => x.scene + ':' + x.visible.map(v => v.id).join('+'))).size === new Set(a.big.map(x => x.scene)).size;
    rec('Q8a', 'Dzielnice 320×568: GRAJ dostępny', at('a').tappable && at('b').tappable ? 'PASS' : 'FAIL', `PRZED: ${at('before').tappable ? 'dostępny' : `zakryty (GRAJ od ${at('before').cta.top} px, nawigacja od ${at('before').navTop} px)`}; A: ${at('a').tappable ? 'dostępny' : 'zakryty'}; B: ${at('b').tappable ? 'dostępny' : 'zakryty'}`);
    rec('Q8b', '2560×1440: warstwy menu / odprawy stabilne', stable ? 'PASS' : 'FAIL', `3 uruchomienia × Miasto, Dzielnice, odprawa: ${stable ? 'za każdym razem te same widoczne warstwy' : 'różne zestawy warstw'}; skala interfejsu ${a.big[0].uiScale}`);
  }
}
// Q9: the gallery on a phone -- no sideways scroll, every image loads, switches and the zoom work, no errors.
{
  const { server, url } = await serve();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const missing = [];
  page.on('response', r => { if (r.status() >= 400) missing.push(r.url().split('/').slice(-2).join('/')); });
  await page.goto(url.replace('index.html', 'design/ui2/gallery.html'));
  await page.waitForTimeout(800);
  const r = await page.evaluate(async () => {
    const out = { cards: document.querySelectorAll('.card').length };
    out.scrollX = document.documentElement.scrollWidth - innerWidth;
    document.querySelector('#globalSeg [data-v="a"]').click();
    out.globalA = [...document.querySelectorAll('.card[data-base^="shots/"] > figure img')].every(i => /-a\.jpg$/.test(i.getAttribute('src')));
    document.querySelector('#filters [data-f="warsztat"]').click();
    out.filter = [...document.querySelectorAll('.card:not([hidden])')].every(c => c.dataset.group === 'warsztat') && document.querySelectorAll('.card:not([hidden])').length;
    const card = document.querySelector('.card:not([hidden])');
    card.querySelector('[data-side]').click();
    out.side = !card.querySelector('.trio').hidden && card.querySelectorAll('.trio img[src]').length === 3;
    out.sideScrollX = document.documentElement.scrollWidth - innerWidth;
    card.querySelector('[data-side]').click();
    card.querySelector('.zoom').click();
    out.zoom = !document.getElementById('box').hidden;
    document.getElementById('boxFit').click();
    await new Promise(r => setTimeout(r, 300));
    out.zoomed = document.getElementById('boxImg').getBoundingClientRect().width > innerWidth * 1.5;
    document.getElementById('boxClose').click();
    document.querySelector('#filters [data-f="all"]').click();
    return out;
  });
  // every image the gallery can show exists on disk
  const html = fs.readFileSync(path.join(UI2, 'gallery.html'), 'utf8');
  const refs = new Set([...html.matchAll(/(?:src|data-lazy)="((?:shots|vortex)\/[^"]+)"/g)].map(m => m[1]));
  for (const m of html.matchAll(/data-base="((?:shots|vortex)\/[^"]+)"[\s\S]*?<\/article>/g)) for (const v of m[0].matchAll(/data-v="([a-z0-9]+)"/g)) refs.add(`${m[1]}-${v[1]}.jpg`);
  for (const m of html.matchAll(/data-vx="(vortex\/[^"]+)"/g)) for (const v of ['v0', 'v1', 'v2', 'v3']) refs.add(`${m[1]}-${v}.webp`);
  const gone = [...refs].filter(f => !fs.existsSync(path.join(UI2, f)));
  await browser.close(); server.close();
  const ok = r.scrollX <= 0 && r.sideScrollX <= 0 && r.globalA && r.filter > 0 && r.side && r.zoom && r.zoomed && !errors.length && !gone.length && !missing.length;
  rec('Q9', 'galeria na iPhonie 390×844', ok ? 'PASS' : 'FAIL', `${r.cards} kart, ${refs.size} obrazów (brakujących: ${gone.length + missing.length}); przewijanie poziome strony: ${Math.max(0, r.scrollX)} px (obok siebie: ${Math.max(0, r.sideScrollX)} px); przełącznik globalny ${r.globalA ? 'ok' : 'BŁĄD'}, filtr ${r.filter ? 'ok' : 'BŁĄD'}, obok siebie ${r.side ? 'ok' : 'BŁĄD'}, powiększenie ${r.zoom && r.zoomed ? 'ok' : 'BŁĄD'}; błędy konsoli: ${errors.length}${errors.length ? ' ' + errors[0] : ''}`);
}
// Q10: the vortex prototype -- one simulation state under all four variants.
{
  const f = path.join(UI2, 'vortex', 'facts.json');
  if (!fs.existsSync(f)) rec('Q10', 'wir: identyczny stan rundy w wariantach', 'NOT RUN', 'brak vortex/facts.json');
  else {
    const v = JSON.parse(fs.readFileSync(f, 'utf8'));
    const key = (x) => [x.score, x.r, x.x, x.y, x.draws].join('/');
    const set = new Set(Object.values(v).map(key));
    rec('Q10', 'wir: identyczny stan rundy w wariantach', set.size === 1 ? 'PASS' : 'FAIL', `${Object.keys(v).length} nagrań (4 skórki × 4 warianty): wynik/promień/pozycja/losowania = ${[...set].join(' ; ')}`);
  }
}
rec('Q11', 'czytelność na fizycznym telefonie', 'NOT VERIFIED', 'sprawdzone tylko w emulacji Chromium (390×844, 320×568, 360×800); brak testu na urządzeniu');
rec('Q12', 'pełna regresja produkcyjna (qa/run-all.mjs)', 'NOT RUN', 'celowo — gra nie jest zmieniana; uruchomiony tylko qa/responsive.mjs na bazie dla dwóch znanych problemów');
fs.writeFileSync(path.join(UI2, 'qa-stage1.json'), JSON.stringify({ base: BASE, results }, null, 1));
process.exit(results.some(r => r.status === 'FAIL') ? 1 : 0);
