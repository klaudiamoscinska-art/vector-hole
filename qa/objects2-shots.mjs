// GG-OBJECTS-02 evidence, not a test: the T1/T2 object looks BEFORE / AFTER,
// drawn by the game's own renderer (drawObjectArt / the sprite cache), never
// by a mock-up:
//   sheet   -- every T1/T2 look big (one camera, one light) and at its real
//              board radius, on the production A2.1 floor; the goal icons;
//   shots   -- identical frames (seed, camera, positions, sizes) of an Arena
//              round, campaign missions in several districts and the Daily
//              Challenge on a phone (390x844), the CrazyGames frame (800x450)
//              and a desktop (1366x768), plus Arena at quality 0;
//   facts   -- layout hashes, Math.random draws, console errors, frame cost.
// BEFORE = another checkout (--root DIR, e.g. `git archive origin/main`),
// AFTER = this one. Written to qa/out/objects2/ (--publish copies the
// pictures to design/objects2/).
//   node qa/objects2-shots.mjs --root /path/to/base [--publish] [--only=sheet,shots]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, allDistrictsSave, frozenDateScript, QA_RANDOM, ROOT, OUT, isMain } from './lib.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); if (a) return a.slice(k.length + 3); const i = process.argv.indexOf(`--${k}`); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes(`--${k}`);

/** Every T1/T2 look: [OBJECT_ART kind, Polish name, class, board radius, tier]. */
export const LOOKS = [
  ['fragment', 'Fragment energii', 'fragment', 7, 1],
  ['kapsula', 'Kapsuła impulsu', 'capsule', 10, 1],
  ['latarnia', 'Latarnia', 'prop', 20, 2],
  ['drzewo', 'Drzewo', 'prop', 20, 2],
  ['lawka', 'Ławka', 'prop', 20, 2],
  ['kiosk', 'Kiosk', 'prop', 20, 2],
  ['skrzynia', 'Skrzynia', 'prop', 20, 2],
  ['modul_dachowy', 'Moduł dachowy', 'prop', 20, 2],
  ['znacznik', 'Znacznik', 'marker', 20, 2],
  ['krysztal', 'Kryształ', 'marker', 20, 2],
  ['paleta', 'Paleta', 'marker', 20, 2],
  ['witryna', 'Witryna', 'marker', 20, 2],
  ['klucz_sektora', 'Klucz sektora', 'marker', 20, 2],
  ['emiter', 'Emiter', 'marker', 20, 2],
  ['znacznik_ogrodu', 'Znacznik ogrodu', 'marker', 20, 2]
];
const TIER_COLOR = { 1: '#50F0FA', 2: '#FF54AD' };

export const FRAMES = [
  ['phone', { width: 390, height: 844 }, true, 2],
  ['cg', { width: 800, height: 450 }, false, 1],
  ['desktop', { width: 1366, height: 768 }, false, 1]
];
export const DAILY_DATE = '2026-11-11T10:00:00Z';
export const ARENA_SEED = 20261111;
const FROZEN_T = 600000; // ms: every frame of both variants is drawn at this clock

/** A served copy of a checkout whose game.js also exports the renderer (the
 *  base revision does not export drawObjectArt). Bytes above the added line
 *  are the checkout's own. */
function sheetRoot(root, name) {
  const dir = path.join(OUT, 'objects2', '.sheet-' + name);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['index.html', 'style.css']) fs.copyFileSync(path.join(root, f), path.join(dir, f));
  const src = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
  fs.writeFileSync(path.join(dir, 'game.js'), src + '\nexport { drawObjectArt as __qaDrawObjectArt, OBJECT_SPRITE_CACHE as __qaSpriteCache };\n');
  return dir;
}

/** One sheet, drawn in the page by the game's renderer.
 *  mode 'hero': every look big; 'scale': at the board radius, 1 unit = 1 CSS px. */
async function sheet(page, file, mode) {
  await page.evaluate(async ({ looks, mode, colors }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
    const draw = m.__qaDrawObjectArt;
    const dpr = window.devicePixelRatio || 1;
    const hero = mode === 'hero';
    const cols = hero ? 5 : 15, cellW = hero ? 236 : 86, cellH = hero ? 250 : 96, rows = Math.ceil(looks.length / cols);
    const W = cols * cellW, H = rows * cellH;
    const cv = document.createElement('canvas');
    cv.id = 'qaSheet';
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.cssText = `position:fixed;left:0;top:0;z-index:99999;width:${W}px;height:${H}px`;
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    // the production floor under the objects: Arena blocks around Plac Neonów
    for (let j = 0; j * 375 < H; j++) for (let i = 0; i * 375 < W; i++) {
      const e = SCREEN_FLOOR.render(1 + (i % 3), 1 + (j % 2), 2, null, null);
      c.drawImage(e.canvas, i * 375, j * 375, 376, 376);
    }
    looks.forEach(([kind, name, , radius, tier], q) => {
      const x = (q % cols) * cellW + cellW / 2, y = Math.floor(q / cols) * cellH + (hero ? cellH / 2 - 8 : cellH / 2 - 6);
      const r = hero ? 78 : radius;
      c.save(); c.translate(x, y);
      draw(c, kind, colors[tier], r, 0, 0, { live: false });
      c.restore();
      c.fillStyle = 'rgba(4,16,29,0.82)';
      const tw = hero ? 170 : 78;
      c.fillRect(x - tw / 2, (Math.floor(q / cols) + 1) * cellH - (hero ? 30 : 20), tw, hero ? 22 : 14);
      c.fillStyle = '#f2f8ff'; c.font = `700 ${hero ? 13 : 9}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(hero ? `T${tier} · ${name}` : name, x, (Math.floor(q / cols) + 1) * cellH - (hero ? 19 : 13));
    });
    document.body.appendChild(cv);
    SCREEN_FLOOR.clearChunks();
  }, { looks: LOOKS, mode, colors: TIER_COLOR });
  await page.locator('#qaSheet').screenshot(/\.jpg$/.test(file) ? { path: file, type: 'jpeg', quality: 90 } : { path: file });
  await page.evaluate(() => document.getElementById('qaSheet').remove());
}

/** Pixel hashes of the sprites this stage must not touch (T3-T6, landmarks,
 *  portal, byte), keyed like the sprite cache: the same in both variants. */
async function otherSprites(page) {
  return page.evaluate(async () => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
    const kinds = [['samochod', '#EFCB63', 34], ['wezel', '#EFCB63', 32], ['pylon', '#EFCB63', 32], ['zasilacz', '#EFCB63', 32], ['lustro', '#EFCB63', 32], ['mostek', '#EFCB63', 32],
      ['landmark', '#9875FF', 52], ['pawilon', '#9875FF', 54], ['billboard', '#9875FF', 54], ['magazyn', '#9875FF', 54], ['autobus', '#CBD5E1', 76], ['tramwaj', '#CBD5E1', 76], ['ciezarowka', '#CBD5E1', 76],
      ['wiezowiec', '#46D99A', 100], ['maszt', '#46D99A', 100], ['kopula', '#46D99A', 100], ['portal', '#9875FF', 18], ['bajt', '#EFCB63', 12],
      ...['kino', 'fontanna', 'dzwig', 'galeria', 'iglica', 'rdzen', 'stacja', 'bazar', 'fabryka', 'latarnia', 'drzewo', 'serwer'].map(k => ['lm_' + k, '#9875FF', 60])];
    const c = document.createElement('canvas').getContext('2d');
    m.__qaSpriteCache.clear();
    for (const [k, col, r] of kinds) m.__qaDrawObjectArt(c, k, col, r, 0, 0, { live: false });
    const out = {};
    for (const [key, s] of m.__qaSpriteCache) {
      const d = s.canvas.getContext('2d').getImageData(0, 0, s.canvas.width, s.canvas.height).data;
      let a = 0x811c9dc5;
      for (let i = 0; i < d.length; i++) a = Math.imul(a ^ d[i], 16777619);
      out[key] = (a >>> 0).toString(16) + ':' + s.canvas.width;
    }
    m.__qaSpriteCache.clear();
    return out;
  });
}

/** The goal icons as the HUD and the briefing show them (the game's own
 *  markup from objectiveIconDef()), at 22 px and 3x. */
async function iconSheet(page, file) {
  await page.evaluate((looks) => {
    const g = window.game;
    const wrap = document.createElement('div');
    wrap.id = 'qaSheet';
    wrap.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;width:1290px;padding:12px 0 8px;background:#081C2B;display:grid;grid-template-columns:repeat(15,86px);font:700 9px sans-serif;color:#f2f8ff;text-align:center';
    wrap.style.gridTemplateColumns = 'repeat(16,86px)'; wrap.style.width = '1376px';
    // the last cell: the class icon of a goal that names no single street element
    looks.concat([[null, 'Element uliczny (klasa)', 'prop']]).forEach(([kind, name, type]) => {
      const def = g.objectiveIconDef({ eat: type, glyph: kind && (type === 'prop' || type === 'marker') ? kind : undefined, n: 1 }, null);
      const cell = document.createElement('div');
      cell.innerHTML = `<div style="height:74px;display:grid;place-items:center;color:${def.color}"><svg viewBox="0 0 24 24" style="width:66px;height:66px">${def.icon}</svg></div>` +
        `<div style="height:30px;display:grid;place-items:center"><span class="mc-goal-icon" style="color:${def.color};display:block"><svg viewBox="0 0 24 24">${def.icon}</svg></span></div>` +
        `<div style="height:22px;display:grid;place-items:center;color:${def.color}"><svg viewBox="0 0 24 24" style="width:13px;height:13px">${def.icon}</svg></div><div>${name}</div>`;
      wrap.appendChild(cell);
    });
    document.body.appendChild(wrap);
  }, LOOKS);
  await page.locator('#qaSheet').screenshot({ path: file });
  await page.evaluate(() => document.getElementById('qaSheet').remove());
}

async function boot(url, [, viewport, mobile, dsf]) {
  const g = await openGame(url, { viewport, mobile, deviceScaleFactor: dsf, initScript: `${frozenDateScript(DAILY_DATE)}\n${QA_RANDOM}` });
  const save = await allDistrictsSave(g.page);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  return g;
}

/** Scenes: [id, kind, mission id | null, camera spot | null]. A campaign
 *  scene looks at the first goal object of its mission. */
export const SCENES = [
  ['arena', 'arena', null],
  ['daily', 'daily', null],
  ['m02-plac', 'campaign', 'M02'],
  ['m07-park', 'campaign', 'M07'],
  ['m09-port', 'campaign', 'M09'],
  ['m10-port', 'campaign', 'M10'],
  ['m13-galeria', 'campaign', 'M13'],
  ['m14-galeria', 'campaign', 'M14'],
  ['m15-galeria', 'campaign', 'M15'],
  ['m17-dachy', 'campaign', 'M17'],
  ['m21-rdzen', 'campaign', 'M21']
];

/** Stages one scene and draws a single frozen frame of it. Returns facts
 *  about the frame (layout hash, object count, zoom, frame cost). */
async function stage(page, [, scene, mission], gfx) {
  return page.evaluate(async ({ scene, mission, gfx, ARENA_SEED, FROZEN_T }) => {
    const g = window.game;
    const real = window.__realNow || (window.__realNow = performance.now.bind(performance));
    window.__qaSeedRandom(7);
    if (gfx != null) { g.gfxLevel = gfx; g.applyGfx && g.applyGfx(gfx); g.resize(); }
    if (scene === 'arena') g.startRound({ seed: ARENA_SEED });
    else if (scene === 'daily') g.startDailyChallenge();
    else { g.missionBoosters = []; g.startCampaignMission(mission); if (g.introPending) g.beginMissionPlay(); }
    if (g.rafId) cancelAnimationFrame(g.rafId);
    g.running = false;
    performance.now = () => FROZEN_T;
    const p = g.player;
    const list = scene === 'campaign' ? g.campaignEntities : g.objects;
    // Where the camera looks: Arena on Plac Neonów, Daily on Port Syntez,
    // a mission at the densest cluster of its T2 objects.
    let spot = scene === 'arena' ? [600, 640] : scene === 'daily' ? [540, 1905] : null;
    if (scene === 'campaign') {
      const t2 = list.filter(e => (e.type === 'prop' || e.type === 'marker') && e.live !== false);
      let best = null, bestN = -1;
      for (const a of t2) { const n = t2.filter(b => Math.hypot(a.x - b.x, a.y - b.y) < 260).length; if (n > bestN) { bestN = n; best = a; } }
      if (best) spot = [Math.round(best.x) + 60, Math.round(best.y) + 70];
    }
    if (spot) { p.x = spot[0]; p.y = spot[1]; }
    const dt = 1 / 60;
    if (scene === 'campaign') { for (let k = 0; k < 3; k++) g.updateCampaign(dt); }
    else for (let k = 0; k < 3; k++) g.update(dt);
    if (spot) { p.x = spot[0]; p.y = spot[1]; p.vx = p.vy = 0; }
    g.banner = null; g.bannerQueue = [];
    g.particles = []; g.ripples = []; g.floatTexts = []; g.shake = 0; g.flashAlpha = 0;
    if (scene === 'campaign') { const b = CONFIG.campaign.bounds; g.followCamera(b.minX, b.minY, b.maxX, b.maxY); }
    else g.followCamera(0, 0, WORLD_W, WORLD_H);
    const draw = () => (scene === 'campaign' ? g.renderCampaign(FROZEN_T / 1000) : g.render(FROZEN_T / 1000));
    for (let k = 0; k < 40; k++) draw(); // the floor's prefetch ring finishes painting
    const flush = () => g.ctx.getImageData(0, 0, 1, 1);
    const times = [];
    for (let k = 0; k < 40; k++) { const t0 = real(); draw(); flush(); times.push(real() - t0); }
    times.sort((a, b) => a - b);
    let h = 0x811c9dc5;
    const kinds = {};
    for (const o of list) {
      for (const v of [Math.round(o.x * 100), Math.round(o.y * 100), Math.round(o.radius * 100)]) { h ^= v; h = Math.imul(h, 0x01000193) >>> 0; }
      const k = o.subtype || (o.artKind ? o.artKind() : o.type) || o.type; kinds[k] = (kinds[k] || 0) + 1;
    }
    for (const b of g.bots) { for (const v of [Math.round(b.x * 100), Math.round(b.y * 100), Math.round(b.radius * 100)]) { h ^= v; h = Math.imul(h, 0x01000193) >>> 0; } }
    await new Promise(r => setTimeout(r, 120));
    draw();
    return {
      layoutHash: h.toString(16), objects: list.length, kinds, bots: g.bots.length, seed: g.runSeed, zoom: +g.zoom.toFixed(3), gfx: g.gfxLevel,
      player: [Math.round(p.x), Math.round(p.y)], camera: [Math.round(g.camera.x), Math.round(g.camera.y)],
      frameMsMedian: +times[20].toFixed(2), frameMsP90: +times[36].toFixed(2), randomCalls: window.__qaRandomCalls
    };
  }, { scene, mission, gfx, ARENA_SEED, FROZEN_T });
}

export async function run({ base, only = null, publish = false, scenes = null } = {}) {
  const dir = path.join(OUT, 'objects2');
  fs.mkdirSync(dir, { recursive: true });
  const variants = [['before', base ? path.resolve(base) : null], ['after', ROOT]].filter(v => v[1]);
  const facts = {};
  const want = (part) => !only || only.includes(part);
  for (const [name, root] of variants) {
    facts[name] = { scenes: {}, errors: [] };
    if (want('sheet')) {
      const srv = await serve({ root: sheetRoot(root, name) });
      const g = await boot(srv.url, ['sheet', { width: 1300, height: 800 }, false, 2]);
      try {
        await sheet(g.page, path.join(dir, `sheet-hero-${name}.jpg`), 'hero');
        await sheet(g.page, path.join(dir, `sheet-scale-${name}.png`), 'scale');
        await iconSheet(g.page, path.join(dir, `sheet-icons-${name}.png`));
        facts[name].otherSprites = await otherSprites(g.page);
        facts[name].errors.push(...g.errors);
      } finally { await g.browser.close(); srv.server.close(); }
      console.log(`  ${name}: sheets`);
    }
    if (want('shots')) {
      const srv = await serve({ root });
      try {
        for (const frame of FRAMES) {
          const g = await boot(srv.url, frame);
          try {
            for (const sc of SCENES) {
              if (scenes && !scenes.includes(sc[0])) continue;
              if (frame[0] !== 'phone' && sc[1] === 'campaign' && !['m09-port', 'm14-galeria'].includes(sc[0])) continue;
              const f = await stage(g.page, sc, null);
              facts[name].scenes[`${sc[0]}-${frame[0]}`] = f;
              await g.page.screenshot({ path: path.join(dir, `${sc[0]}-${frame[0]}-${name}.jpg`), type: 'jpeg', quality: 84 });
            }
            if (frame[0] === 'phone' && (!scenes || scenes.includes('arena'))) {
              const f = await stage(g.page, SCENES[0], 0);
              facts[name].scenes['arena-gfx0-phone'] = f;
              await g.page.screenshot({ path: path.join(dir, `arena-gfx0-phone-${name}.jpg`), type: 'jpeg', quality: 84 });
            }
            facts[name].errors.push(...g.errors);
          } finally { await g.browser.close(); }
          console.log(`  ${name}: ${frame[0]}`);
        }
      } finally { srv.server.close(); }
    }
  }
  if (want('shots') && want('sheet')) fs.writeFileSync(path.join(dir, 'facts.json'), JSON.stringify(facts, null, 1));
  if (facts.before && facts.after && facts.before.otherSprites) {
    const a = facts.before.otherSprites, b = facts.after.otherSprites, keys = Object.keys(a);
    const diff = keys.filter(k => a[k] !== b[k]);
    console.log(`  T3-T6 / landmark / portal / byte sprites: ${keys.length} compared, ${diff.length} different${diff.length ? ' (' + diff.join(', ') + ')' : ''}`);
  }
  if (facts.before && facts.after) {
    for (const k of Object.keys(facts.after.scenes)) {
      const a = facts.before.scenes[k], b = facts.after.scenes[k];
      if (!a) continue;
      const same = a.layoutHash === b.layoutHash && a.randomCalls === b.randomCalls && a.objects === b.objects && JSON.stringify(a.camera) === JSON.stringify(b.camera);
      console.log(`  ${k.padEnd(22)} layout ${a.layoutHash} / ${b.layoutHash}  random ${a.randomCalls} / ${b.randomCalls}  frame ${a.frameMsMedian} / ${b.frameMsMedian} ms  ${same ? 'SAME' : 'DIFFERENT'}`);
    }
    console.log(`  errors: before ${facts.before.errors.length}, after ${facts.after.errors.length}`);
  }
  if (publish) {
    const pub = path.join(ROOT, 'design', 'objects2');
    fs.mkdirSync(pub, { recursive: true });
    for (const f of fs.readdirSync(pub)) if (/\.(png|jpg|json)$/.test(f)) fs.unlinkSync(path.join(pub, f));
    for (const f of fs.readdirSync(dir)) if (/\.(png|jpg|json)$/.test(f)) fs.copyFileSync(path.join(dir, f), path.join(pub, f));
    console.log('published -> design/objects2/');
  }
  return facts;
}

if (isMain(import.meta.url)) {
  const only = opt('only', null), scenes = opt('scenes', null);
  run({ base: opt('root', null), only: only ? only.split(',') : null, scenes: scenes ? scenes.split(',') : null, publish: flag('publish') })
    .then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
}
