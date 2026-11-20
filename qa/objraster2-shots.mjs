// GG-OBJECTS-RASTER-02 evidence, not a test: real Arena frames (the game's own renderer, after the lazy decode) with the 21 object bitmaps.
//   node qa/objraster2-shots.mjs [--root=DIR for the BEFORE checkout (a worktree of origin/main)] [--only=pc,mobile] [--sectors=p,k,o,g,d,R] [--tag=-fix1 (output folder suffix)] [--scenes=natural,staged,zoom058,stagednormal,dense]
// Scenes (all described here because two of them are staged by QA, they are not a natural round):
//   natural-<sector>  an unmodified Arena round (seed 2024): the camera on the sector's centroid block, no object moved
//   staged-<sector>   the same round with one object of every one of the 21 kinds MOVED by QA next to each other (rows T1..T6) in that
//                     sector's centroid block, the vortex parked away from them; positions only, nothing else of the round changes
//   zoom058-<sector>  the staged scene at the game's smallest zoom (0.58)
// Output: qa/out/objraster2/<before|after>/<frame>-<scene>.png (+ facts.json)
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, QA_RANDOM, OUT, ROOT, isMain } from './lib.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
export const FRAMES = { pc: { w: 1280, h: 720, mobile: false, dsf: 1 }, mobile: { w: 390, h: 844, mobile: true, dsf: 2 } };
export const SECTORS = { p: 'Plac Neonów', d: 'Dachy Prądu', o: 'Port Syntez', k: 'Park Impulsów', g: 'Galeria Glitch', R: 'Rdzeń Miasta' };
const ORDER = ['fragment', 'kapsula', 'lawka', 'kiosk', 'skrzynia', 'latarnia', 'drzewo', 'znacznik', 'samochod', 'wezel', 'pylon', 'pawilon', 'billboard', 'magazyn', 'landmark', 'autobus', 'tramwaj', 'ciezarowka', 'wiezowiec', 'maszt', 'kopula'];
const TIER_OF = { fragment: 1, kapsula: 1, lawka: 2, kiosk: 2, skrzynia: 2, latarnia: 2, drzewo: 2, znacznik: 2, samochod: 3, wezel: 3, pylon: 3, pawilon: 4, billboard: 4, magazyn: 4, landmark: 4, autobus: 5, tramwaj: 5, ciezarowka: 5, wiezowiec: 6, maszt: 6, kopula: 6 };
const FROZEN_T = 600000;

/** One page session on a veteran save (every district open), then the frozen Arena round and its camera. Returns facts. */
export async function stageScene(page, { sector, staged, zoom, gfx = 2 }) {
  return page.evaluate(({ sector, staged, zoom, gfx, ORDER, TIER_OF, FROZEN_T }) => {
    const g = window.game;
    const real = window.__realNow || (window.__realNow = performance.now.bind(performance));
    window.__qaSeedRandom(2024);
    g.applyGfx(gfx);
    g.startRound({ seed: 2024 });
    if (g.rafId) cancelAnimationFrame(g.rafId);
    g.running = false;
    performance.now = () => FROZEN_T;
    const rows = ['pppkkkkk', 'ppppkkkk', 'ppppkkkd', 'oopRRkdd', 'oooRRddd', 'ooogggdd', 'oogggggd', 'oogggggg'];
    let sx = 0, sy = 0, n = 0;
    rows.forEach((row, j) => [...row].forEach((c, i) => { if (c === sector) { sx += i; sy += j; n++; } }));
    const cx = (sx / n + 0.5) * 375, cy = (sy / n + 0.5) * 375;
    const p = g.player;
    const facts = { sector, staged, centre: [Math.round(cx), Math.round(cy)], moved: 0 };
    if (staged) {
      const pick = {};
      for (const o of g.objects) if (!pick[o.subtype] && !o.eating) pick[o.subtype] = o;
      const hw = (innerWidth / zoom) / 2 - 24;
      // rows T1..T6; a row wraps when it is wider than the view
      const tiers = {};
      for (const k of ORDER) (tiers[TIER_OF[k]] = tiers[TIER_OF[k]] || []).push(pick[k]);
      const lines = [];
      for (const t of [1, 2, 3, 4, 5, 6]) {
        let line = [], w = 0;
        for (const o of tiers[t]) {
          const need = o.radius * 2 * 1.12 + 6;
          if (line.length && w + need > hw * 2) { lines.push(line); line = []; w = 0; }
          line.push(o); w += need;
        }
        if (line.length) lines.push(line);
      }
      const hs = lines.map(l => Math.max(...l.map(o => o.radius)) * 2 * 1.1 + 8);
      const total = hs.reduce((a, b) => a + b, 0);
      let y = cy - total / 2;
      lines.forEach((line, li) => {
        const wsum = line.reduce((a, o) => a + o.radius * 2 * 1.12 + 6, 0);
        let x = cx - wsum / 2;
        for (const o of line) { const w = o.radius * 2 * 1.12 + 6; o.x = x + w / 2; o.y = y + hs[li] / 2; x += w; facts.moved++; }
        y += hs[li];
      });
      facts.layoutHeight = Math.round(total);
      // the vortex stays out of the way: one T1-size vortex far from the staged block
      p.x = cx; p.y = cy + total / 2 + 700;
    } else {
      p.x = cx; p.y = cy;
    }
    for (let k = 0; k < 4; k++) g.update(1 / 60);
    g.zoom = zoom;
    g.camera.x = cx; g.camera.y = cy;
    // the staged objects must not have moved (update() steps eating / bots only): put them back if a step touched them
    g.banner = null; g.bannerQueue = [];
    g.particles = []; g.ripples = []; g.floatTexts = []; g.shake = 0; g.flashAlpha = 0;
    g.camera.x = cx; g.camera.y = cy;
    facts.zoom = g.zoom; facts.gfx = g.gfxLevel; facts.dpr = g.dpr;
    return facts;
  }, { sector, staged, zoom, gfx, ORDER, TIER_OF, FROZEN_T });
}

/** Paint frames until the bitmaps (if any) are decoded, then once more for the shot. */
export async function paintAfterDecode(page, waitMs = 1800) {
  const draw = () => page.evaluate(() => { for (let k = 0; k < 6; k++) window.game.render(window.performance.now() / 1000); });
  await draw();                       // the first paint of each kind starts its lazy decode (vector fallback meanwhile)
  await page.waitForTimeout(waitMs);
  await draw();
}

export async function session(url, frame) {
  const f = FRAMES[frame];
  const g = await openGame(url, { viewport: { width: f.w, height: f.h }, mobile: f.mobile, deviceScaleFactor: f.dsf, initScript: QA_RANDOM });
  const s = await veteranSave(g.page, { missions: 29, coins: 800, runsPlayed: 12 });
  await g.page.evaluate((v) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(v)), s);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  return g;
}

/** A served copy of a checkout whose game.js also exports the renderer and the bitmap registry (QA-only; the game's own export list is untouched). */
export function exportedRoot(root, name) {
  const dir = path.join(OUT, 'objraster2', '.root-' + name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(root)) if (/\.(js|html|css)$/.test(f) && f !== 'game.js') fs.copyFileSync(path.join(root, f), path.join(dir, f));
  const hasRaster = fs.existsSync(path.join(root, 'objects-raster-3.js'));
  const gameSrc = fs.readFileSync(path.join(root, 'game.js'), 'utf8'), hasBase = gameSrc.includes('const OBJECT_RASTER_BASE');
  fs.writeFileSync(path.join(dir, 'game.js'), gameSrc +
    `\nexport { drawObjectArt as __qaDraw, OBJECT_SPRITE_CACHE as __qaSpriteCache, getObjectSprite as __qaSprite${hasRaster ? ', OBJECT_RASTER as __qaRaster, OBJECT_RASTER_META as __qaMeta' : ''}${hasBase ? ', OBJECT_RASTER_BASE as __qaBase, OBJECT_BASE_STAMPS as __qaStamps' : ''} };\n`);
  return dir;
}

/** Vector (left) and bitmap (right) of every kind at its real radius, scaled up, with the live overlay on, on a dark floor. */
export async function liveSheet(page, file, q, kinds = ORDER, maxS = 3.2, cell = 170) {
  await page.evaluate(async ({ q, ORDER, maxS, cell }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
    const COL = { 1: '#50F0FA', 2: '#FF54AD', 3: '#EFCB63', 4: '#9875FF', 5: '#CBD5E1', 6: '#46D99A' };
    const R = { fragment: 7, kapsula: 10, lawka: 20, kiosk: 20, skrzynia: 20, latarnia: 20, drzewo: 20, znacznik: 20, samochod: 34, wezel: 32, pylon: 32, pawilon: 54, billboard: 54, magazyn: 54, landmark: 52, autobus: 76, tramwaj: 76, ciezarowka: 76, wiezowiec: 100, maszt: 100, kopula: 100 };
    const TIER = { fragment: 1, kapsula: 1, lawka: 2, kiosk: 2, skrzynia: 2, latarnia: 2, drzewo: 2, znacznik: 2, samochod: 3, wezel: 3, pylon: 3, pawilon: 4, billboard: 4, magazyn: 4, landmark: 4, autobus: 5, tramwaj: 5, ciezarowka: 5, wiezowiec: 6, maszt: 6, kopula: 6 };
    m.__qaRaster.setMax(q); if (q === 3) m.__qaRaster.fit(9);   // 3 = the 3 px bitmaps (a dense screen), 2 = the 2 px ones
    for (const k of ORDER) m.__qaRaster.get(k, R[k]);           // start the decodes
    await new Promise(r => setTimeout(r, 1500));
    const ROW = 380, CW = 380;
    const cv = document.createElement('canvas');
    cv.width = 2 * CW; cv.height = Math.ceil(ORDER.length / 2) * ROW;
    const c = cv.getContext('2d');
    c.fillStyle = '#16152b'; c.fillRect(0, 0, cv.width, cv.height);
    c.font = '700 13px sans-serif'; c.textBaseline = 'middle';
    ORDER.forEach((k, i) => {
      const half = Math.ceil(R[k] * 1.5 + 6), s = Math.min(maxS, cell / half);
      const col = i % 2, row = Math.floor(i / 2), ox = col * CW, oy = row * ROW;
      c.fillStyle = (row + col) % 2 ? '#1b1a33' : '#201f3b'; c.fillRect(ox, oy, CW, ROW);
      for (const [n, raster] of [[0, false], [1, true]]) {
        c.save(); c.translate(ox + 95 + n * 190, oy + ROW / 2 - 10); c.scale(s, s);
        m.__qaDraw(c, k, COL[TIER[k]], R[k], 0.6, 0, { raster });
        c.restore();
      }
      c.fillStyle = '#f2f8ff'; c.fillText(`T${TIER[k]} ${k}  r=${R[k]}  x${s.toFixed(2)}  (wektor | bitmapa ${q}px)`, ox + 10, oy + ROW - 14);
    });
    cv.id = 'qaLive';
    cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#000';
    document.body.appendChild(cv);
  }, { q, ORDER: kinds, maxS, cell });
  await page.locator('#qaLive').screenshot({ path: file });
  await page.evaluate(() => document.getElementById('qaLive').remove());
}

export async function run({ base = null, only = ['pc', 'mobile'], sectors = Object.keys(SECTORS), tag = '', scenes = null } = {}) {
  const variants = [['before', base ? path.resolve(base) : null], ['after', ROOT]].filter(v => v[1]);
  const facts = {};
  for (const [name, root] of variants) {
    const dir = path.join(OUT, 'objraster2' + tag, name);
    fs.mkdirSync(dir, { recursive: true });
    const srv = await serve({ root });
    facts[name] = { errors: [], shots: {} };
    try {
      for (const frame of only) {
        const g = await session(srv.url, frame);
        try {
          for (const sector of sectors) {
            for (const [scene, staged, zoom] of [['natural', false, frame === 'pc' ? 0.9 : 0.8], ['staged', true, 0.62], ['zoom058', true, 0.58], ['stagednormal', true, frame === 'pc' ? 0.9 : 0.8], ...(frame === 'mobile' ? [['dense', true, 1.3]] : [])].filter(x => !scenes || scenes.includes(x[0]))) {   // dense = 2.6 device px per unit: the 3 px bitmaps
              const f = await stageScene(g.page, { sector, staged, zoom });
              await paintAfterDecode(g.page, scene === 'natural' && sector !== sectors[0] ? 200 : 1800);
              const file = path.join(dir, `${frame}-${scene}-${sector}.png`);
              await g.page.screenshot({ path: file });
              facts[name].shots[`${frame}-${scene}-${sector}`] = { ...f, file: path.relative(ROOT, file) };
            }
          }
          facts[name].errors.push(...g.errors);
        } finally { await g.browser.close(); }
      }
    } finally { srv.server.close(); }
    fs.writeFileSync(path.join(dir, 'facts.json'), JSON.stringify(facts[name], null, 1));
    console.log(`  ${name}: ${Object.keys(facts[name].shots).length} shots, ${facts[name].errors.length} errors -> qa/out/objraster2${tag}/${name}/`);
  }
  return facts;
}

if (isMain(import.meta.url)) {
  const sec = opt('sectors', null), only = opt('only', null);
  run({ base: opt('root', null), only: only ? only.split(',') : undefined, sectors: sec ? sec.split(',') : undefined, tag: opt('tag', ''), scenes: opt('scenes', null) ? opt('scenes', '').split(',') : null })
    .then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
}
