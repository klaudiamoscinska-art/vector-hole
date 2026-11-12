// GG-OBJECTS-03 evidence, not a test: the T3/T4 object looks BEFORE / AFTER,
// drawn by the game's own renderer (drawObjectArt / the sprite cache), never
// by a mock-up:
//   sheet   -- A: every T3/T4 look big; B: at its real board radius; C: the
//              T1/T2 looks next to the T3/T4 ones (one camera, one light), big
//              and at board scale; D: the goal icons at 66 / 22 / 13 px;
//   shots   -- identical frames (seed, camera, positions, sizes) of an Arena
//              round (start, and zoomed out with a big vortex and the
//              Overdrive portals), the Daily Challenge and campaign missions in
//              five districts on a phone (390x844), the CrazyGames frame
//              (800x450) and a desktop (1366x768), plus Arena at quality 0;
//   facts   -- layout hashes, Math.random draws, console errors, frame cost,
//              and pixel hashes of the sprites this stage must not touch
//              (T1/T2, T5/T6, their landmarks, the byte).
// BEFORE = another checkout (--root DIR, e.g. a worktree of origin/main),
// AFTER = this one. Written to qa/out/objects3/ (--publish copies the
// pictures to design/objects3/).
//   node qa/objects3-shots.mjs --root /path/to/base [--publish] [--only=sheet,shots] [--scenes=arena,m04-plac]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, allDistrictsSave, frozenDateScript, QA_RANDOM, ROOT, OUT, isMain } from './lib.mjs';
import { LOOKS as LOOKS12, FRAMES, DAILY_DATE, ARENA_SEED } from './objects2-shots.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); if (a) return a.slice(k.length + 3); const i = process.argv.indexOf(`--${k}`); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes(`--${k}`);

/** Every T3/T4 look: [OBJECT_ART kind, Polish name, class, board radius, tier, goal step | null, variant].
 *  The step is how a mission names it (objectiveIconDef()); kino, fontanna, the Arena monument and
 *  the Overdrive portal have no goal icon of their own. */
export const LOOKS3 = [
  ['samochod', 'Samochód', 'vehicle', 34, 3, { eat: 'vehicle', n: 1 }],
  ['samochod', 'Pojazd konwoju', 'vehicle', 34, 3, { eat: 'vehicle', glyph: 'konwoj', n: 1 }, 'konwoj'],
  ['wezel', 'Węzeł energii', 'node', 32, 3, { activate: 'node', n: 1 }],
  ['pylon', 'Pylon', 'pylon', 32, 3, { activate: 'pylon', n: 1 }],
  ['zasilacz', 'Zasilacz', 'node', 32, 3, { activate: 'node', glyph: 'zasilacz', n: 1 }],
  ['lustro', 'Lustro', 'pylon', 32, 3, { activate: 'pylon', glyph: 'lustro', n: 1 }],
  ['mostek', 'Mostek', 'node', 32, 3, { activate: 'node', glyph: 'mostek', n: 1 }],
  ['pawilon', 'Pawilon', 'structure', 54, 4, { eat: 'structure', glyph: 'pawilon', n: 1 }],
  ['billboard', 'Billboard', 'structure', 54, 4, { eat: 'structure', glyph: 'billboard', n: 1 }],
  ['magazyn', 'Magazyn', 'structure', 54, 4, { eat: 'structure', glyph: 'magazyn', n: 1 }],
  ['landmark', 'Pomnik (Arena)', 'landmark', 52, 4, null],
  ['lm_kino', 'Kino', 'landmark', 52, 4, null],
  ['lm_fontanna', 'Fontanna', 'landmark', 52, 4, null],
  ['portal', 'Portal (finisz Areny)', 'portal', 18, 4, null]
];
export const TIER_COLOR = { 1: '#50F0FA', 2: '#FF54AD', 3: '#EFCB63', 4: '#9875FF', 5: '#CBD5E1', 6: '#46D99A' };
const FROZEN_T = 600000; // ms: every frame of both variants is drawn at this clock

/** Sprites this stage must not change: [kind, color, radius]. */
export const FROZEN_SPRITES = [
  ...LOOKS12.map(([k, , , r, tier]) => [k, TIER_COLOR[tier], r]),
  ...LOOKS12.map(([k, , , , tier]) => [k, TIER_COLOR[tier], 78]),
  ['fragment', '#EFCB63', 13],
  ['autobus', '#CBD5E1', 76], ['tramwaj', '#CBD5E1', 76], ['ciezarowka', '#CBD5E1', 76],
  ['wiezowiec', '#46D99A', 100], ['maszt', '#46D99A', 100], ['kopula', '#46D99A', 100], ['bajt', '#EFCB63', 12],
  ...['dzwig', 'galeria', 'iglica', 'stacja', 'bazar'].map(k => ['lm_' + k, '#CBD5E1', 78]),
  ...['iglica', 'rdzen', 'fabryka', 'latarnia', 'drzewo', 'serwer'].map(k => ['lm_' + k, '#46D99A', 104])
];

/** A served copy of a checkout whose game.js also exports the renderer. */
export function sheetRoot(root, name, src = null) {
  const dir = path.join(OUT, 'objects3', '.sheet-' + name);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['index.html', 'style.css']) fs.copyFileSync(path.join(root, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'game.js'), (src || fs.readFileSync(path.join(root, 'game.js'), 'utf8')) + '\nexport { drawObjectArt as __qaDrawObjectArt, OBJECT_SPRITE_CACHE as __qaSpriteCache };\n');
  return dir;
}

/** FNV hashes of the cached sprites of `kinds`, keyed like the sprite cache. */
export async function spriteHashes(page, kinds) {
  return page.evaluate(async (kinds) => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
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
  }, kinds);
}

/** One sheet, drawn in the page by the game's renderer.
 *  mode 'hero': every T3/T4 look big; 'scale': at the board radius (1 unit =
 *  1 CSS px); 'family': T1-T4 together, big in one row height and at board scale. */
async function sheet(page, file, mode) {
  await page.evaluate(async ({ looks3, looks12, mode, colors }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
    const draw = m.__qaDrawObjectArt;
    const dpr = window.devicePixelRatio || 1;
    const cells = [];
    let W = 0, H = 0;
    const label = (c, x, y, text, big) => {
      c.font = `700 ${big ? 13 : 9}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const tw = c.measureText(text).width + 14;
      c.fillStyle = 'rgba(4,16,29,0.82)'; c.fillRect(x - tw / 2, y - (big ? 11 : 7), tw, big ? 22 : 14);
      c.fillStyle = '#f2f8ff'; c.fillText(text, x, y);
    };
    if (mode === 'hero') {
      const cols = 5, cw = 250, ch = 262;
      looks3.forEach(([kind, name, , , tier, , variant], q) => cells.push({ kind, variant, col: colors[tier], r: 78, x: (q % cols) * cw + cw / 2, y: Math.floor(q / cols) * ch + ch / 2 - 10, name: `T${tier} · ${name}`, ly: (Math.floor(q / cols) + 1) * ch - 19, big: true }));
      W = cols * cw; H = Math.ceil(looks3.length / cols) * ch;
    } else if (mode === 'scale') {
      let x = 10;
      looks3.forEach(([kind, name, , radius, tier, , variant]) => { const w = Math.max(radius * 2 + 30, 92); cells.push({ kind, variant, col: colors[tier], r: radius, x: x + w / 2, y: 78, name, ly: 160, big: false }); x += w; });
      W = x + 10; H = 172;
    } else {
      // T1-T4 together. Row 1-2: one big size (the same camera and light on
      // every solid). Row 3: the board radii, 1 unit = 1 CSS px.
      const all = looks12.map(([kind, name, , radius, tier]) => ({ kind, name, radius, tier })).concat(looks3.map(([kind, name, , radius, tier, , variant]) => ({ kind, name, radius, tier, variant })));
      const cols = 10, cw = 138, ch = 150;
      all.forEach((l, q) => cells.push({ kind: l.kind, variant: l.variant, col: colors[l.tier], r: 44, x: (q % cols) * cw + cw / 2, y: Math.floor(q / cols) * ch + ch / 2 - 8, name: `T${l.tier} · ${l.name}`, ly: (Math.floor(q / cols) + 1) * ch - 12, big: false }));
      const rows = Math.ceil(all.length / cols);
      W = cols * cw;
      let x = 14; const y0 = rows * ch + 70;
      all.forEach((l) => { cells.push({ kind: l.kind, variant: l.variant, col: colors[l.tier], r: l.radius, x: x + l.radius, y: y0 + 58 - l.radius, name: null }); x += l.radius * 2 + 9; });
      // a second line when the row is wider than the sheet
      let line = 0, lx = 14;
      for (const cell of cells.filter(c => c.name === null)) {
        if (lx + cell.r * 2 > W - 10) { line++; lx = 14; }
        cell.x = lx + cell.r; cell.y = y0 + line * 124 + 58 - cell.r; lx += cell.r * 2 + 9;
      }
      H = y0 + (line + 1) * 124 + 10;
    }
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
    for (const cell of cells) {
      c.save(); c.translate(cell.x, cell.y);
      draw(c, cell.kind, cell.col, cell.r, 0, 0, { live: false, variant: cell.variant });
      c.restore();
      if (cell.name) label(c, cell.x, cell.ly, cell.name, cell.big);
    }
    document.body.appendChild(cv);
    SCREEN_FLOOR.clearChunks();
  }, { looks3: LOOKS3, looks12: LOOKS12, mode, colors: TIER_COLOR });
  await page.locator('#qaSheet').screenshot(/\.jpg$/.test(file) ? { path: file, type: 'jpeg', quality: 90 } : { path: file });
  await page.evaluate(() => document.getElementById('qaSheet').remove());
}

/** The goal icons as the HUD and the briefing show them (the game's own
 *  markup from objectiveIconDef()), at 66, 22 (the briefing's size) and 13 px. */
async function iconSheet(page, file) {
  await page.evaluate((looks) => {
    const g = window.game;
    const rows = looks.filter(l => l[5]).map(l => [l[1], l[5]]).concat([['Budowle (klasa)', { eat: 'structure', n: 1 }], ['T2 · Latarnia (wzorzec)', { eat: 'prop', glyph: 'latarnia', n: 1 }], ['T2 · Skrzynia (wzorzec)', { eat: 'prop', glyph: 'skrzynia', n: 1 }]]);
    const wrap = document.createElement('div');
    wrap.id = 'qaSheet';
    wrap.style.cssText = `position:fixed;left:0;top:0;z-index:99999;width:${rows.length * 96}px;padding:12px 0 8px;background:#081C2B;display:grid;grid-template-columns:repeat(${rows.length},96px);font:700 9px sans-serif;color:#f2f8ff;text-align:center`;
    rows.forEach(([name, st]) => {
      const def = g.objectiveIconDef(st, null);
      const cell = document.createElement('div');
      cell.innerHTML = `<div style="height:74px;display:grid;place-items:center;color:${def.color}"><svg viewBox="0 0 24 24" style="width:66px;height:66px">${def.icon}</svg></div>` +
        `<div style="height:30px;display:grid;place-items:center"><span class="mc-goal-icon" style="color:${def.color};display:block"><svg viewBox="0 0 24 24">${def.icon}</svg></span></div>` +
        `<div style="height:22px;display:grid;place-items:center;color:${def.color}"><svg viewBox="0 0 24 24" style="width:13px;height:13px">${def.icon}</svg></div><div>${name}</div>`;
      wrap.appendChild(cell);
    });
    document.body.appendChild(wrap);
  }, LOOKS3);
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

/** Scenes: [id, kind, mission id | null]. A campaign scene looks at the
 *  densest cluster of its T3/T4 objects. 'arena-far' is the same round with
 *  a big vortex (the camera pulled back) during the Overdrive portal rain. */
export const SCENES = [
  ['arena', 'arena', null],
  ['arena-far', 'arena-far', null],
  ['daily', 'daily', null],
  ['m04-plac', 'campaign', 'M04'],
  ['m25-plac', 'campaign', 'M25'],
  ['m29-plac', 'campaign', 'M29'],
  ['m08-park', 'campaign', 'M08'],
  ['m35-park', 'campaign', 'M35'],
  ['m11-port', 'campaign', 'M11'],
  ['m42-port', 'campaign', 'M42'],
  ['m46-galeria', 'campaign', 'M46'],
  ['m19-dachy', 'campaign', 'M19']
];
const WIDE_SCENES = ['arena', 'arena-far', 'daily', 'm04-plac', 'm42-port'];

/** Stages one scene and draws a single frozen frame of it. Returns facts
 *  about the frame (layout hash, object count, zoom, frame cost). */
async function stage(page, [, scene, mission], gfx) {
  return page.evaluate(async ({ scene, mission, gfx, ARENA_SEED, FROZEN_T }) => {
    const g = window.game;
    const real = window.__realNow || (window.__realNow = performance.now.bind(performance));
    window.__qaSeedRandom(7);
    if (gfx != null) { g.gfxLevel = gfx; g.applyGfx && g.applyGfx(gfx); g.resize(); }
    const arena = scene === 'arena' || scene === 'arena-far';
    if (arena) g.startRound({ seed: ARENA_SEED });
    else if (scene === 'daily') g.startDailyChallenge();
    else { g.missionBoosters = []; g.startCampaignMission(mission); if (g.introPending) g.beginMissionPlay(); }
    if (g.rafId) cancelAnimationFrame(g.rafId);
    g.running = false;
    performance.now = () => FROZEN_T;
    const p = g.player;
    const campaign = scene === 'campaign';
    const list = campaign ? g.campaignEntities : g.objects;
    const BIG = ['vehicle', 'node', 'pylon', 'structure', 'landmark'];
    // Where the camera looks: the densest cluster of T3/T4 objects (Arena:
    // around Plac Neonów and its neighbours; Daily: anywhere on its map).
    let spot = null;
    {
      const t34 = list.filter(e => BIG.includes(e.type || e.tier) && e.live !== false && (!arena || (e.x < 1500 && e.y < 1500)));
      let best = null, bestN = -1;
      for (const a of t34) { const n = t34.filter(b => Math.hypot(a.x - b.x, a.y - b.y) < (campaign ? 300 : 420)).length; if (n > bestN) { bestN = n; best = a; } }
      if (best) spot = [Math.round(best.x) + (campaign ? 40 : 70), Math.round(best.y) + (campaign ? 110 : 120)];
      // a boss landmark is the picture of its mission
      const lm = campaign && list.find(e => e.type === 'landmark');
      if (lm) spot = [Math.round(lm.x) + 30, Math.round(lm.y) + 190];
    }
    // the big vortex stands below the cluster, so it does not swallow the picture
    if (scene === 'arena-far') { p.setRadius(150); g.spawnPortalRain(); if (spot) spot = [spot[0], spot[1] + 420]; }
    if (spot) { p.x = spot[0]; p.y = spot[1]; }
    const dt = 1 / 60;
    const steps = scene === 'arena-far' ? 200 : 3;
    for (let k = 0; k < steps; k++) {
      if (campaign) g.updateCampaign(dt); else g.update(dt);
      if (spot) { p.x = spot[0]; p.y = spot[1]; p.vx = p.vy = 0; }
    }
    g.banner = null; g.bannerQueue = [];
    g.particles = []; g.ripples = []; g.floatTexts = []; g.shake = 0; g.flashAlpha = 0;
    if (campaign) { const b = CONFIG.campaign.bounds; g.followCamera(b.minX, b.minY, b.maxX, b.maxY); }
    else g.followCamera(0, 0, WORLD_W, WORLD_H);
    const draw = () => (campaign ? g.renderCampaign(FROZEN_T / 1000) : g.render(FROZEN_T / 1000));
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
      player: [Math.round(p.x), Math.round(p.y)], playerRadius: Math.round(p.radius), camera: [Math.round(g.camera.x), Math.round(g.camera.y)],
      frameMsMedian: +times[20].toFixed(2), frameMsP90: +times[36].toFixed(2), randomCalls: window.__qaRandomCalls
    };
  }, { scene, mission, gfx, ARENA_SEED, FROZEN_T });
}

export async function run({ base, only = null, publish = false, scenes = null } = {}) {
  const dir = path.join(OUT, 'objects3');
  fs.mkdirSync(dir, { recursive: true });
  const variants = [['before', base ? path.resolve(base) : null], ['after', ROOT]].filter(v => v[1]);
  const facts = {};
  const want = (part) => !only || only.includes(part);
  for (const [name, root] of variants) {
    facts[name] = { scenes: {}, errors: [] };
    if (want('sheet')) {
      const srv = await serve({ root: sheetRoot(root, name) });
      const g = await boot(srv.url, ['sheet', { width: 1420, height: 800 }, false, 2]);
      try {
        await sheet(g.page, path.join(dir, `sheet-hero-${name}.jpg`), 'hero');
        await sheet(g.page, path.join(dir, `sheet-scale-${name}.png`), 'scale');
        await sheet(g.page, path.join(dir, `sheet-family-${name}.jpg`), 'family');
        await iconSheet(g.page, path.join(dir, `sheet-icons-${name}.png`));
        facts[name].frozenSprites = await spriteHashes(g.page, FROZEN_SPRITES);
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
              if (frame[0] !== 'phone' && !WIDE_SCENES.includes(sc[0])) continue;
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
  if (want('shots') && want('sheet') && !scenes) fs.writeFileSync(path.join(dir, 'facts.json'), JSON.stringify(facts, null, 1));
  if (facts.before && facts.after && facts.before.frozenSprites) {
    const a = facts.before.frozenSprites, b = facts.after.frozenSprites, keys = Object.keys(a);
    const diff = keys.filter(k => a[k] !== b[k]);
    console.log(`  T1/T2, T5/T6, landmark and byte sprites: ${keys.length} compared, ${diff.length} different${diff.length ? ' (' + diff.join(', ') + ')' : ''}`);
  }
  if (facts.before && facts.after) {
    for (const k of Object.keys(facts.after.scenes)) {
      const a = facts.before.scenes[k], b = facts.after.scenes[k];
      if (!a) continue;
      const same = a.layoutHash === b.layoutHash && a.randomCalls === b.randomCalls && a.objects === b.objects && JSON.stringify(a.camera) === JSON.stringify(b.camera) && a.zoom === b.zoom;
      console.log(`  ${k.padEnd(22)} layout ${a.layoutHash} / ${b.layoutHash}  random ${a.randomCalls} / ${b.randomCalls}  zoom ${a.zoom} / ${b.zoom}  frame ${a.frameMsMedian} / ${b.frameMsMedian} ms  ${same ? 'SAME' : 'DIFFERENT'}`);
    }
    console.log(`  errors: before ${facts.before.errors.length}, after ${facts.after.errors.length}`);
  }
  if (publish) {
    const pub = path.join(ROOT, 'design', 'objects3');
    fs.mkdirSync(pub, { recursive: true });
    for (const f of fs.readdirSync(pub)) if (/\.(png|jpg|json)$/.test(f)) fs.unlinkSync(path.join(pub, f));
    for (const f of fs.readdirSync(dir)) if (/\.(png|jpg|json)$/.test(f)) fs.copyFileSync(path.join(dir, f), path.join(pub, f));
    console.log('published -> design/objects3/');
  }
  return facts;
}

if (isMain(import.meta.url)) {
  const only = opt('only', null), scenes = opt('scenes', null);
  run({ base: opt('root', null), only: only ? only.split(',') : null, scenes: scenes ? scenes.split(',') : null, publish: flag('publish') })
    .then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
}
