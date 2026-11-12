// GG-OBJECTS-04 evidence, not a test: the T5/T6 object looks BEFORE / AFTER,
// drawn by the game's own renderer (drawObjectArt / the sprite cache), never
// by a mock-up:
//   sheet   -- A: every T5/T6 look big; B: at its real board radius; C: the
//              whole library T1-T6 (one camera, one light), big and at board
//              scale; D: the goal icons at 66 / 22 / 13 px next to the same
//              object's board sprite;
//   shots   -- identical frames (seed, camera, positions, sizes) of an Arena
//              round (a late phase with a T5 vortex, and zoomed out with a T6
//              vortex), the Daily Challenge, a friend's challenge and campaign
//              missions with heavy vehicles, towers and the T5/T6 bosses
//              (both chapters) on a phone (390x844), the CrazyGames frame
//              (800x450) and a desktop (1366x768), plus quality 0;
//   facts   -- layout hashes, Math.random draws, console errors, frame cost,
//              and pixel hashes of the sprites this stage must not touch
//              (T1-T4, the golden core, the byte).
// BEFORE = another checkout (--root DIR, e.g. a worktree of origin/main),
// AFTER = this one. Written to qa/out/objects4/ (--publish copies the
// pictures to design/objects4/).
//   node qa/objects4-shots.mjs --root /path/to/base [--publish] [--only=sheet,shots] [--scenes=arena,m12-port]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, allDistrictsSave, frozenDateScript, QA_RANDOM, ROOT, OUT, isMain } from './lib.mjs';
import { LOOKS as LOOKS12, FRAMES, DAILY_DATE, ARENA_SEED } from './objects2-shots.mjs';
import { LOOKS3, TIER_COLOR } from './objects3-shots.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); if (a) return a.slice(k.length + 3); const i = process.argv.indexOf(`--${k}`); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes(`--${k}`);

/** Every T5/T6 look: [OBJECT_ART kind, Polish name, class, board radius, tier, goal step | null].
 *  The step is how a mission names it (objectiveIconDef()). lm_iglica is one
 *  look at two tiers: the spire's gate (T5, M19) and the spire (T6, M20). */
export const LOOKS4 = [
  ['autobus', 'Autobus', 'heavy', 76, 5, { eat: 'heavy', glyph: 'autobus', n: 1 }],
  ['tramwaj', 'Tramwaj', 'heavy', 76, 5, { eat: 'heavy', glyph: 'tramwaj', n: 1 }],
  ['ciezarowka', 'Ciężarówka', 'heavy', 76, 5, { eat: 'heavy', glyph: 'ciezarowka', n: 1 }],
  ['lm_dzwig', 'Dźwig (Port)', 'landmark', 78, 5, { landmark: 'dzwig' }],
  ['lm_galeria', 'Galeria', 'landmark', 78, 5, { landmark: 'galeria_glowna' }],
  ['lm_iglica', 'Brama iglicy', 'landmark', 78, 5, { landmark: 'iglica_wejscie' }],
  ['lm_stacja', 'Stacja Centralna', 'landmark', 78, 5, { landmark: 'stacja' }],
  ['lm_bazar', 'Brama Bazaru', 'landmark', 78, 5, { landmark: 'bazar_brama' }],
  ['wiezowiec', 'Wieżowiec', 'tower', 100, 6, { eat: 'tower', glyph: 'wiezowiec', n: 1 }],
  ['maszt', 'Maszt', 'tower', 100, 6, { eat: 'tower', glyph: 'maszt', n: 1 }],
  ['kopula', 'Kopuła', 'tower', 100, 6, { eat: 'tower', glyph: 'kopula', n: 1 }],
  ['lm_iglica', 'Iglica', 'landmark', 104, 6, { landmark: 'iglica' }],
  ['lm_rdzen', 'Rdzeń Miasta', 'landmark', 104, 6, { landmark: 'rdzen_miasta_glowny' }],
  ['lm_fabryka', 'Fabryka Pikseli', 'landmark', 104, 6, { landmark: 'fabryka' }],
  ['lm_latarnia', 'Latarnia Hologramów', 'landmark', 104, 6, { landmark: 'latarnia' }],
  ['lm_drzewo', 'Drzewo Światła', 'landmark', 104, 6, { landmark: 'drzewo' }],
  ['lm_serwer', 'Serwer Główny', 'landmark', 104, 6, { landmark: 'serwer' }]
];
const FROZEN_T = 600000; // ms: every frame of both variants is drawn at this clock

/** Sprites this stage must not change: [kind, color, radius, variant]. */
export const FROZEN_SPRITES4 = [
  ...LOOKS12.map(([k, , , r, tier]) => [k, TIER_COLOR[tier], r]),
  ...LOOKS12.map(([k, , , , tier]) => [k, TIER_COLOR[tier], 78]),
  ...LOOKS3.map(([k, , , r, tier, , v]) => [k, TIER_COLOR[tier], r, v]),
  ...LOOKS3.map(([k, , , , tier, , v]) => [k, TIER_COLOR[tier], 78, v]),
  ['fragment', '#EFCB63', 13], ['bajt', '#EFCB63', 12]
];

/** A served copy of a checkout whose game.js also exports the renderer. */
export function sheetRoot(root, name, src = null) {
  const dir = path.join(OUT, 'objects4', '.sheet-' + name);
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
    for (const [k, col, r, variant] of kinds) m.__qaDrawObjectArt(c, k, col, r, 0, 0, { live: false, variant });
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
 *  mode 'hero': every T5/T6 look big; 'scale': at the board radius (1 unit =
 *  1 CSS px); 'family': T1-T6 together, big in one row height and at board scale. */
async function sheet(page, file, mode) {
  await page.evaluate(async ({ looks4, looks3, looks12, mode, colors }) => {
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
      const cols = 6, cw = 250, ch = 262;
      looks4.forEach(([kind, name, , , tier], q) => cells.push({ kind, col: colors[tier], r: 84, x: (q % cols) * cw + cw / 2, y: Math.floor(q / cols) * ch + ch / 2 - 10, name: `T${tier} · ${name}`, ly: (Math.floor(q / cols) + 1) * ch - 19, big: true }));
      W = cols * cw; H = Math.ceil(looks4.length / cols) * ch;
    } else if (mode === 'scale') {
      let x = 10, line = 0;
      const rowH = 250;
      looks4.forEach(([kind, name, , radius, tier]) => {
        const w = radius * 2 + 26;
        if (x + w > 1480) { x = 10; line++; }
        cells.push({ kind, col: colors[tier], r: radius, x: x + w / 2, y: line * rowH + 118, name, ly: line * rowH + 236, big: false }); x += w;
      });
      W = 1490; H = (line + 1) * rowH;
    } else {
      // T1-T6 together. Rows: one big size (the same camera and light on
      // every solid). Below: the board radii, 1 unit = 1 CSS px.
      const all = looks12.map(([kind, name, , radius, tier]) => ({ kind, name, radius, tier }))
        .concat(looks3.map(([kind, name, , radius, tier, , variant]) => ({ kind, name, radius, tier, variant })))
        .concat(looks4.map(([kind, name, , radius, tier]) => ({ kind, name, radius, tier })));
      const cols = 12, cw = 124, ch = 140;
      all.forEach((l, q) => cells.push({ kind: l.kind, variant: l.variant, col: colors[l.tier], r: 42, x: (q % cols) * cw + cw / 2, y: Math.floor(q / cols) * ch + ch / 2 - 8, name: `T${l.tier} · ${l.name}`, ly: (Math.floor(q / cols) + 1) * ch - 12, big: false }));
      const rows = Math.ceil(all.length / cols);
      W = cols * cw;
      const y0 = rows * ch + 30;
      let line = 0, lx = 14, lineTop = y0, lineH = 0;
      const board = [];
      for (const l of all) {
        if (lx + l.radius * 2 > W - 10) { line++; lx = 14; lineTop += lineH + 14; lineH = 0; }
        board.push({ l, x: lx + l.radius, line, top: lineTop });
        lineH = Math.max(lineH, l.radius * 2 + 20);
        lx += l.radius * 2 + 12;
      }
      // every board object of a line stands on the same ground
      const lineBottom = {};
      for (const b of board) lineBottom[b.line] = Math.max(lineBottom[b.line] || 0, b.top + b.l.radius * 2 + 14);
      for (const b of board) cells.push({ kind: b.l.kind, variant: b.l.variant, col: colors[b.l.tier], r: b.l.radius, x: b.x, y: lineBottom[b.line] - b.l.radius, name: null });
      H = Math.max(...Object.values(lineBottom)) + 24;
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
  }, { looks4: LOOKS4, looks3: LOOKS3, looks12: LOOKS12, mode, colors: TIER_COLOR });
  await page.locator('#qaSheet').screenshot(/\.jpg$/.test(file) ? { path: file, type: 'jpeg', quality: 90 } : { path: file });
  await page.evaluate(() => document.getElementById('qaSheet').remove());
}

/** The goal icons as the HUD and the briefing show them (the game's own
 *  markup from objectiveIconDef()), at 66, 22 (the briefing's size) and 13 px,
 *  under the same object's board sprite. */
async function iconSheet(page, file) {
  await page.evaluate(async ({ looks, colors }) => {
    const m = await import(document.querySelector('script[type="module"][src]').src);
    const g = window.game;
    const rows = looks.filter(l => l[5]).map(l => [l[1], l[5], l[0], l[3], l[4]]).concat([
      ['Ciężkie pojazdy (klasa)', { eat: 'heavy', n: 1 }, null], ['Wieże (klasa)', { eat: 'tower', n: 1 }, null],
      ['T4 · Kino', { landmark: 'kino' }, 'lm_kino', 52, 4], ['T4 · Fontanna', { landmark: 'fontanna' }, 'lm_fontanna', 52, 4],
      ['T3 · Samochód (wzorzec)', { eat: 'vehicle', n: 1 }, 'samochod', 34, 3]]);
    const wrap = document.createElement('div');
    wrap.id = 'qaSheet';
    const per = 11;
    wrap.style.cssText = `position:fixed;left:0;top:0;z-index:99999;width:${per * 112}px;padding:12px 0 8px;background:#081C2B;display:grid;grid-template-columns:repeat(${per},112px);row-gap:14px;font:700 9px sans-serif;color:#f2f8ff;text-align:center`;
    for (const [name, st, kind, r, tier] of rows) {
      const def = g.objectiveIconDef(st, null);
      const cell = document.createElement('div');
      let sprite = '<div style="height:96px"></div>';
      if (kind) {
        const cv = document.createElement('canvas'), k = 0.9, half = Math.ceil(r * 1.5 + 6);
        cv.width = cv.height = 96 * 2; const c = cv.getContext('2d'); c.scale(2 * 96 / (half * 2 * k), 2 * 96 / (half * 2 * k)); c.translate(half * k, half * k);
        m.__qaDrawObjectArt(c, kind, colors[tier], r, 0, 0, { live: false });
        sprite = `<img src="${cv.toDataURL()}" style="width:96px;height:96px;display:block;margin:auto">`;
      }
      cell.innerHTML = sprite + `<div style="height:74px;display:grid;place-items:center;color:${def.color}"><svg viewBox="0 0 24 24" style="width:66px;height:66px">${def.icon}</svg></div>` +
        `<div style="height:30px;display:grid;place-items:center"><span class="mc-goal-icon" style="color:${def.color};display:block"><svg viewBox="0 0 24 24">${def.icon}</svg></span></div>` +
        `<div style="height:22px;display:grid;place-items:center;color:${def.color}"><svg viewBox="0 0 24 24" style="width:13px;height:13px">${def.icon}</svg></div><div>${name}</div>`;
      wrap.appendChild(cell);
    }
    document.body.appendChild(wrap);
    await new Promise(r => setTimeout(r, 150));
  }, { looks: LOOKS4, colors: TIER_COLOR });
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

/** Scenes: [id, kind, mission id | null]. A campaign scene looks at its boss
 *  landmark, else at the densest cluster of its T5/T6 objects. 'arena-late'
 *  is the round with a T5 vortex near the heavy vehicles and towers;
 *  'arena-far' the same with a T6 vortex (the camera pulled back). */
export const SCENES = [
  ['arena-late', 'arena-late', null],
  ['arena-far', 'arena-far', null],
  ['daily', 'daily', null],
  ['challenge', 'challenge', null],
  ['m12-port', 'campaign', 'M12'],       // Rozdział I: Dźwig (T5)
  ['m16-galeria', 'campaign', 'M16'],    // Galeria (T5)
  ['m19-dachy', 'campaign', 'M19'],      // Brama iglicy (T5)
  ['m20-dachy', 'campaign', 'M20'],      // Iglica (T6)
  ['m24-rdzen', 'campaign', 'M24'],      // Rdzeń Miasta (T6)
  ['m54-dachy', 'campaign', 'M54'],      // autobusy + maszty
  ['m56-rdzen', 'campaign', 'M56'],      // ciężkie pojazdy + kopuła
  ['lm-stacja', 'campaign', 'L:stacja'], // Rozdział II bosses
  ['lm-bazar', 'campaign', 'L:bazar_brama'],
  ['lm-fabryka', 'campaign', 'L:fabryka'],
  ['lm-latarnia', 'campaign', 'L:latarnia'],
  ['lm-drzewo', 'campaign', 'L:drzewo'],
  ['lm-serwer', 'campaign', 'L:serwer'],
  ['h-tramwaj', 'campaign', 'G:tramwaj'], // a mission with trams
  ['h-ciezarowka', 'campaign', 'G:ciezarowka']
];
const WIDE_SCENES = ['arena-late', 'arena-far', 'daily', 'm12-port', 'm24-rdzen', 'lm-serwer'];

/** Stages one scene and draws a single frozen frame of it. Returns facts
 *  about the frame (layout hash, object count, zoom, frame cost). */
async function stage(page, [, scene, mission], gfx) {
  return page.evaluate(async ({ scene, mission, gfx, ARENA_SEED, FROZEN_T }) => {
    const g = window.game;
    const real = window.__realNow || (window.__realNow = performance.now.bind(performance));
    window.__qaSeedRandom(7);
    if (gfx != null) { g.gfxLevel = gfx; g.applyGfx && g.applyGfx(gfx); g.resize(); }
    const arena = scene === 'arena-late' || scene === 'arena-far';
    let missionId = mission;
    if (mission && /^[LG]:/.test(mission)) {
      // the first mission whose goal names this boss / this look
      const [kind, id] = mission.split(':');
      const def = CAMPAIGN_MISSIONS.find(d => d.goal.steps.some(st => kind === 'L' ? st.landmark === id : st.glyph === id));
      missionId = def ? def.id : null;
    }
    if (arena) g.startRound({ seed: ARENA_SEED });
    else if (scene === 'daily') g.startDailyChallenge();
    else if (scene === 'challenge') g.startRound({ seed: 12, challenge: { score: 100, from: 'QA' } });
    else { g.missionBoosters = []; g.startCampaignMission(missionId); if (g.introPending) g.beginMissionPlay(); }
    if (g.rafId) cancelAnimationFrame(g.rafId);
    g.running = false;
    performance.now = () => FROZEN_T;
    const p = g.player;
    const campaign = scene === 'campaign';
    const list = campaign ? g.campaignEntities : g.objects;
    const BIG = ['heavy', 'tower', 'landmark'];
    let spot = null;
    {
      const big = list.filter(e => BIG.includes(e.type || e.tier) && e.live !== false);
      let best = null, bestN = -1;
      for (const a of big) { const n = big.filter(b => Math.hypot(a.x - b.x, a.y - b.y) < (campaign ? 380 : 520)).length; if (n > bestN) { bestN = n; best = a; } }
      if (best) spot = [Math.round(best.x) + 40, Math.round(best.y) + (campaign ? 160 : 200)];
      const lm = campaign && list.find(e => e.type === 'landmark');
      if (lm) spot = [Math.round(lm.x) + 30, Math.round(lm.y) + 230];
    }
    if (scene === 'arena-late') { p.setRadius(84); if (spot) spot = [spot[0], spot[1] + 120]; }
    if (scene === 'arena-far') { p.setRadius(150); g.spawnPortalRain(); if (spot) spot = [spot[0], spot[1] + 420]; }
    if (spot) { p.x = spot[0]; p.y = spot[1]; }
    const dt = 1 / 60;
    const steps = arena ? 200 : 3;
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
      mission: missionId, layoutHash: h.toString(16), objects: list.length, kinds, bots: g.bots.length, seed: g.runSeed, zoom: +g.zoom.toFixed(3), gfx: g.gfxLevel,
      player: [Math.round(p.x), Math.round(p.y)], playerRadius: Math.round(p.radius), camera: [Math.round(g.camera.x), Math.round(g.camera.y)],
      frameMsMedian: +times[20].toFixed(2), frameMsP90: +times[36].toFixed(2), randomCalls: window.__qaRandomCalls
    };
  }, { scene, mission, gfx, ARENA_SEED, FROZEN_T });
}

export async function run({ base, only = null, publish = false, scenes = null } = {}) {
  const dir = path.join(OUT, 'objects4');
  fs.mkdirSync(dir, { recursive: true });
  const variants = [['before', base ? path.resolve(base) : null], ['after', ROOT]].filter(v => v[1]);
  const facts = {};
  const want = (part) => !only || only.includes(part);
  for (const [name, root] of variants) {
    facts[name] = { scenes: {}, errors: [] };
    if (want('sheet')) {
      const srv = await serve({ root: sheetRoot(root, name) });
      const g = await boot(srv.url, ['sheet', { width: 1500, height: 800 }, false, 2]);
      try {
        await sheet(g.page, path.join(dir, `sheet-hero-${name}.jpg`), 'hero');
        await sheet(g.page, path.join(dir, `sheet-scale-${name}.jpg`), 'scale');
        await sheet(g.page, path.join(dir, `sheet-family-${name}.jpg`), 'family');
        await iconSheet(g.page, path.join(dir, `sheet-icons-${name}.png`));
        facts[name].frozenSprites = await spriteHashes(g.page, FROZEN_SPRITES4);
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
            if (frame[0] === 'phone' && (!scenes || scenes.includes('arena-late'))) {
              for (const sc of [SCENES[0], SCENES[5]]) {
                const f = await stage(g.page, sc, 0);
                facts[name].scenes[`${sc[0]}-gfx0-phone`] = f;
                await g.page.screenshot({ path: path.join(dir, `${sc[0]}-gfx0-phone-${name}.jpg`), type: 'jpeg', quality: 84 });
              }
              await stage(g.page, SCENES[0], 2);
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
    console.log(`  T1-T4, golden core and byte sprites: ${keys.length} compared, ${diff.length} different${diff.length ? ' (' + diff.join(', ') + ')' : ''}`);
  }
  if (facts.before && facts.after) {
    for (const k of Object.keys(facts.after.scenes)) {
      const a = facts.before.scenes[k], b = facts.after.scenes[k];
      if (!a) continue;
      const same = a.layoutHash === b.layoutHash && a.randomCalls === b.randomCalls && a.objects === b.objects && JSON.stringify(a.camera) === JSON.stringify(b.camera) && a.zoom === b.zoom;
      console.log(`  ${k.padEnd(24)} ${String(b.mission || '').padEnd(5)} layout ${a.layoutHash} / ${b.layoutHash}  random ${a.randomCalls} / ${b.randomCalls}  zoom ${a.zoom} / ${b.zoom}  frame ${a.frameMsMedian} / ${b.frameMsMedian} ms  ${same ? 'SAME' : 'DIFFERENT'}`);
    }
    console.log(`  errors: before ${facts.before.errors.length}, after ${facts.after.errors.length}`);
  }
  if (publish) {
    const pub = path.join(ROOT, 'design', 'objects4');
    fs.mkdirSync(pub, { recursive: true });
    for (const f of fs.readdirSync(pub)) if (/\.(png|jpg|json)$/.test(f)) fs.unlinkSync(path.join(pub, f));
    for (const f of fs.readdirSync(dir)) if (/\.(png|jpg|json)$/.test(f)) fs.copyFileSync(path.join(dir, f), path.join(pub, f));
    console.log('published -> design/objects4/');
  }
  return facts;
}

if (isMain(import.meta.url)) {
  const only = opt('only', null), scenes = opt('scenes', null);
  run({ base: opt('root', null), only: only ? only.split(',') : null, scenes: scenes ? scenes.split(',') : null, publish: flag('publish') })
    .then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
}
