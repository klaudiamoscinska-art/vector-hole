// CITY-2 review material: screenshots of the running game (Miasto, Core City)
// and one comparison board built from those screenshots (no drawn mock-ups).
//   design/city2/shots/<frame>/<scene>.png  -- phone 390x844 (2x), desktop 1280x720,
//                                              narrow phone 375x667 (2x), PL and EN
//   design/city2/CITY2_BOARD.png            -- the stages side by side, labelled
// The Centrum is also shot on the base revision (BASE_REV) for a before / after.
// Usage: node qa/city2-shots.mjs
import { serve, openGame, veteranSave, frozenDateScript, QA_RANDOM, revisionFile, OUT, ROOT, chromium } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE_REV = process.env.VH_CITY2_BASE || '0e67e2fd0d2a609000a2bca93c2166619933f524';
const DEST = path.join(ROOT, 'design', 'city2');
const READY = () => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state;

const FRAMES = {
  phone: { w: 390, h: 844, mobile: true, dsf: 2 },
  desktop: { w: 1280, h: 720, mobile: false, dsf: 1 },
  narrow: { w: 375, h: 667, mobile: true, dsf: 2 }
};
// [frame, file, level, charge, sector, lang, roadmap]
const SCENES = [
  ['phone', 'centrum-lvl3', 3, 46, 'center', 'pl'],
  ['phone', 'centrum-lvl6', 6, 40, 'center', 'pl'],
  ['phone', 'centrum-lvl7-ukonczone', 7, 30, 'center', 'pl'],
  ['phone', 'brzeg-zablokowany-lvl3', 3, 46, 'shore', 'pl'],
  ['phone', 'brzeg-plac-budowy-lvl6', 6, 40, 'shore', 'pl'],
  ['phone', 'brzeg-lvl7', 7, 30, 'shore', 'pl'],
  ['phone', 'brzeg-lvl8', 8, 30, 'shore', 'pl'],
  ['phone', 'brzeg-lvl9', 9, 30, 'shore', 'pl'],
  ['phone', 'brzeg-lvl10', 10, 30, 'shore', 'pl'],
  ['phone', 'brzeg-lvl11', 11, 30, 'shore', 'pl'],
  ['phone', 'brzeg-lvl12', 12, 0, 'shore', 'pl'],
  ['phone', 'mapa-nagrod-lvl9', 9, 30, 'shore', 'pl', true],
  ['phone', 'en-brzeg-lvl7', 7, 30, 'shore', 'en'],
  ['phone', 'en-brzeg-zablokowany-lvl3', 3, 46, 'shore', 'en'],
  ['desktop', 'centrum-lvl6', 6, 40, 'center', 'pl'],
  ['desktop', 'brzeg-plac-budowy-lvl6', 6, 40, 'shore', 'pl'],
  ['desktop', 'brzeg-lvl7', 7, 30, 'shore', 'pl'],
  ['desktop', 'brzeg-lvl9', 9, 30, 'shore', 'pl'],
  ['desktop', 'brzeg-lvl12', 12, 0, 'shore', 'pl'],
  ['desktop', 'en-brzeg-lvl9', 9, 30, 'shore', 'en'],
  ['narrow', 'brzeg-lvl9', 9, 30, 'shore', 'pl'],
  ['narrow', 'centrum-lvl6', 6, 40, 'center', 'pl'],
  ['narrow', 'en-brzeg-lvl12', 12, 0, 'shore', 'en'],
  ['narrow', 'en-centrum-lvl6', 6, 40, 'center', 'en']
];
const BASE_SCENES = [['phone', 'base-centrum-lvl6', 6, 40], ['desktop', 'base-centrum-lvl6', 6, 40], ['phone', 'base-centrum-lvl3', 3, 46]];

async function shoot(url, frame, file, L, c, sector, lang, roadmap) {
  const f = FRAMES[frame];
  const g = await openGame(url, { viewport: { width: f.w, height: f.h }, mobile: f.mobile, deviceScaleFactor: f.dsf, locale: lang === 'en' ? 'en-US' : 'pl-PL', initScript: frozenDateScript('2026-11-13T10:00:00Z') + QA_RANDOM });
  const s = await veteranSave(g.page, { missions: 29, coins: 1240, runsPlayed: 23 });
  s.hub = { coreLevel: L, coreCharge: c };
  await g.page.evaluate((v) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(v)), s);
  await g.page.reload();
  await g.page.waitForFunction(READY);
  if (sector) await g.page.evaluate((v) => window.game.setHubSector(v), sector);
  await g.page.waitForTimeout(1600);
  if (roadmap) { await g.page.evaluate(() => window.game.openCoreCityRoadmap()); await g.page.waitForTimeout(400); await g.page.evaluate(() => { const b = document.getElementById('infoSheetBody'); const rows = b.querySelectorAll('.info-roadmap'); if (rows[1]) rows[1].scrollIntoView({ block: 'center' }); }); await g.page.waitForTimeout(200); }
  const dir = path.join(DEST, 'shots', `${frame}-${f.w}x${f.h}`);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, file + '.png');
  await g.page.screenshot({ path: p });
  if (g.errors.length) console.log('  errors in', file, g.errors.slice(0, 2));
  await g.browser.close();
  return path.relative(DEST, p);
}

const made = {};
const cand = await serve();
for (const [frame, file, L, c, sector, lang, roadmap] of SCENES) made[`${frame}/${file}`] = await shoot(cand.url, frame, file, L, c, sector, lang, roadmap);
cand.server.close();
const baseDir = path.join(OUT, 'city2-base');
fs.mkdirSync(baseDir, { recursive: true });
for (const f of ['index.html', 'game.js', 'style.css']) fs.writeFileSync(path.join(baseDir, f), revisionFile(BASE_REV, f));
const base = await serve({ root: baseDir });
for (const [frame, file, L, c] of BASE_SCENES) made[`${frame}/${file}`] = await shoot(base.url, frame, file, L, c, null, 'pl', false);
base.server.close();

// The board: real screenshots, labelled, in one picture.
const img = (k, label, wide) => `<figure class="${wide ? 'wide' : ''}"><img src="${made[k]}"><figcaption>${label}</figcaption></figure>`;
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:28px 32px;background:#04101D;color:#F2F8FF;font:15px/1.3 'Segoe UI',system-ui,sans-serif;width:2900px}
h1{font-size:30px;margin:0 0 4px;color:#50F0FA} h2{font-size:20px;margin:26px 0 10px;color:#EFCB63;border-bottom:1px solid rgba(80,240,250,.25);padding-bottom:6px}
p{margin:0 0 6px;color:rgba(242,248,255,.7)} .row{display:flex;gap:16px;align-items:flex-start;flex-wrap:nowrap}
figure{margin:0;width:300px} figure.wide{width:560px} img{width:100%;display:block;border-radius:10px;border:1px solid rgba(80,240,250,.3)}
figcaption{margin-top:6px;font-size:14px;font-weight:700} .note{font-size:13px;color:rgba(242,248,255,.6)}
</style>
<h1>CITY-2 „Drugi brzeg” — Core City LVL 7–12 (zrzuty z działającej gry)</h1>
<p>Każdy obraz to zrzut ekranu Miasta z gry uruchomionej w przeglądarce (zapis z danym poziomem Core City). Bez makiet i ilustracji.</p>
<h2>Centrum — bez zmian (przed: ${BASE_REV.slice(0, 7)} / po: ta gałąź)</h2>
<div class="row">${img('phone/base-centrum-lvl3', 'PRZED · Centrum LVL 3')}${img('phone/centrum-lvl3', 'PO · Centrum LVL 3')}${img('phone/base-centrum-lvl6', 'PRZED · Centrum LVL 6')}${img('phone/centrum-lvl6', 'PO · Centrum LVL 6 (ukończone)')}${img('phone/centrum-lvl7-ukonczone', 'PO · Centrum oglądane na LVL 7')}${img('desktop/base-centrum-lvl6', 'PRZED · komputer LVL 6', true)}${img('desktop/centrum-lvl6', 'PO · komputer LVL 6', true)}</div>
<p class="note">Rysunek Centrum jest identyczny piksel w piksel z bazą (qa/city2.mjs: 15 klatek × 3 rozdzielczości). Zmieniają się tylko teksty karty przy LVL 6+ i nowy przełącznik.</p>
<h2>Drugi brzeg — telefon 390×844: od zablokowanego do ukończonego</h2>
<div class="row">${img('phone/brzeg-zablokowany-lvl3', 'LVL 3 · zablokowany')}${img('phone/brzeg-plac-budowy-lvl6', 'LVL 6 · plac budowy')}${img('phone/brzeg-lvl7', 'LVL 7 · przyczółek')}${img('phone/brzeg-lvl8', 'LVL 8 · kwartał')}${img('phone/brzeg-lvl9', 'LVL 9 · plac')}${img('phone/brzeg-lvl10', 'LVL 10 · fontanna')}${img('phone/brzeg-lvl11', 'LVL 11 · dominanta')}${img('phone/brzeg-lvl12', 'LVL 12 · ukończony')}${img('phone/mapa-nagrod-lvl9', 'Mapa nagród · LVL 7–12')}</div>
<h2>Drugi brzeg — komputer 1280×720</h2>
<div class="row">${img('desktop/brzeg-plac-budowy-lvl6', 'LVL 6 · plac budowy', true)}${img('desktop/brzeg-lvl7', 'LVL 7', true)}${img('desktop/brzeg-lvl9', 'LVL 9', true)}${img('desktop/brzeg-lvl12', 'LVL 12', true)}${img('desktop/en-brzeg-lvl9', 'EN · LVL 9', true)}</div>
<h2>Wąski telefon 375×667 i wersja EN</h2>
<div class="row">${img('narrow/brzeg-lvl9', '375×667 · LVL 9')}${img('narrow/centrum-lvl6', '375×667 · Centrum LVL 6')}${img('narrow/en-brzeg-lvl12', '375×667 · EN LVL 12')}${img('narrow/en-centrum-lvl6', '375×667 · EN Centrum LVL 6')}${img('phone/en-brzeg-lvl7', '390×844 · EN LVL 7')}${img('phone/en-brzeg-zablokowany-lvl3', '390×844 · EN zablokowany')}</div>`;
const boardHtml = path.join(DEST, 'board.html');
fs.writeFileSync(boardHtml, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2964, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('file://' + boardHtml);
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(DEST, 'CITY2_BOARD.png'), fullPage: true });
await browser.close();
fs.unlinkSync(boardHtml);
console.log(`${Object.keys(made).length} screenshots + CITY2_BOARD.png in ${path.relative(ROOT, DEST)}`);
