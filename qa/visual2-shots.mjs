// GG-VISUAL-01 evidence, not a test: identical BEFORE / AFTER frames of the
// two "GLITCH GULP VISUAL 2.0" prototype directions (A, B) on three real
// scenes -- an Arena round on Plac Neonów, the campaign mission M05 in Park
// Impulsów and a Daily Challenge from a fixed date's seed -- on a phone and
// a desktop frame, a low-quality (gfx 0) frame, a 12-district floor sheet,
// and the numbers the report quotes (chunk paint cost, frame cost, floor
// luminance / busyness, the round's layout hash).
//
// The game's runtime files are NOT changed by the prototypes: this script
// serves game.js with design/visual2/gg-visual2-proto.js spliced in before
// its export list (QA only, in memory). `--style=base` serves the repo's
// own bytes.
//
//   node qa/visual2-shots.mjs                 # base + A + B -> qa/out/visual2/
//   node qa/visual2-shots.mjs --style=A --only=shots
//   node qa/visual2-shots.mjs --publish       # also JPEG copies -> design/visual2/shots/
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, allDistrictsSave, frozenDateScript, QA_RANDOM, ROOT, OUT, DISTRICT_IDS_ALL, isMain } from './lib.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const flag = (k) => process.argv.includes(`--${k}`);

export const PROTO_FILE = path.join(ROOT, 'design', 'visual2', 'gg-visual2-proto.js');
export const STYLES = ['base', 'A', 'B'];
export const FRAMES = [
  ['phone', { width: 390, height: 844 }, true, 2],
  ['desktop', { width: 1366, height: 768 }, false, 1]
];
export const DAILY_DATE = '2026-11-11T10:00:00Z';
export const ARENA_SEED = 20261111;
const FROZEN_T = 600000; // ms: every frame of every style is drawn at this clock

/** game.js with the prototype spliced in before its export list. */
export function gameSourceWith(style) {
  const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
  if (style === 'base') return src;
  const at = src.lastIndexOf('\nexport {');
  if (at < 0) throw new Error('game.js export list not found');
  return src.slice(0, at) + '\n' + fs.readFileSync(PROTO_FILE, 'utf8') + '\n' + src.slice(at);
}

async function boot(url, style, [, viewport, mobile, dsf]) {
  const g = await openGame(url, { viewport, mobile, deviceScaleFactor: dsf, initScript: `${frozenDateScript(DAILY_DATE)}\n${QA_RANDOM}\nwindow.__GG_VISUAL = ${JSON.stringify(style)};` });
  await g.context.route('**/game.js', (route) => route.fulfill({ contentType: 'text/javascript', body: gameSourceWith(style) }));
  const save = await allDistrictsSave(g.page);
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  return g;
}

/** Stages one scene and draws a single frozen frame of it. Returns facts
 *  about the frame (layout hash, object count, zoom, floor paints). */
async function stage(page, scene, gfx) {
  return page.evaluate(async ({ scene, gfx, ARENA_SEED, FROZEN_T }) => {
    const g = window.game;
    const real = window.__realNow || (window.__realNow = performance.now.bind(performance));
    window.__qaSeedRandom(7);
    if (gfx != null) { g.gfxLevel = gfx; g.applyGfx && g.applyGfx(gfx); g.resize(); }
    if (scene === 'arena') g.startRound({ seed: ARENA_SEED });
    else if (scene === 'daily') g.startDailyChallenge();
    else { g.missionBoosters = []; g.startCampaignMission('M05'); if (g.introPending) g.beginMissionPlay(); }
    if (g.rafId) cancelAnimationFrame(g.rafId);
    g.running = false;
    performance.now = () => FROZEN_T;
    const p = g.player;
    if (scene === 'arena') { p.x = 600; p.y = 640; } // Plac Neonów (blocks 1,1)
    const dt = 1 / 60;
    if (scene === 'campaign') { for (let k = 0; k < 3; k++) g.updateCampaign(dt); }
    else for (let k = 0; k < 3; k++) g.update(dt);
    if (scene === 'arena') { p.x = 600; p.y = 640; p.vx = p.vy = 0; }
    g.banner = null; g.bannerQueue = [];
    g.particles = []; g.ripples = []; g.floatTexts = []; g.shake = 0; g.flashAlpha = 0;
    if (scene === 'campaign') { const b = CONFIG.campaign.bounds; g.followCamera(b.minX, b.minY, b.maxX, b.maxY); }
    else g.followCamera(0, 0, WORLD_W, WORLD_H);
    const draw = () => (scene === 'campaign' ? g.renderCampaign(FROZEN_T / 1000) : g.render(FROZEN_T / 1000));
    for (let k = 0; k < 40; k++) draw(); // the prefetch ring finishes painting
    const before = g.cityFloor.renders;
    const flush = () => g.ctx.getImageData(0, 0, 1, 1);
    // Frame cost: the frozen frame drawn 40 times with a forced flush.
    const times = [];
    for (let k = 0; k < 40; k++) { const t0 = real(); draw(); flush(); times.push(real() - t0); }
    times.sort((a, b) => a - b);
    const list = scene === 'campaign' ? g.campaignEntities : g.objects;
    let h = 0x811c9dc5;
    for (const o of list) { for (const v of [Math.round(o.x * 100), Math.round(o.y * 100), Math.round(o.radius * 100)]) { h ^= v; h = Math.imul(h, 0x01000193) >>> 0; } }
    for (const b of g.bots) { for (const v of [Math.round(b.x * 100), Math.round(b.y * 100), Math.round(b.radius * 100)]) { h ^= v; h = Math.imul(h, 0x01000193) >>> 0; } }
    await new Promise(r => setTimeout(r, 120));
    draw();
    return {
      layoutHash: h.toString(16), objects: list.length, bots: g.bots.length, seed: g.runSeed, zoom: +g.zoom.toFixed(3), gfx: g.gfxLevel,
      player: [Math.round(p.x), Math.round(p.y)], camera: [Math.round(g.camera.x), Math.round(g.camera.y)],
      stillRepaints: g.cityFloor.renders - before, frameMsMedian: +times[20].toFixed(2), frameMsP90: +times[36].toFixed(2), randomCalls: window.__qaRandomCalls
    };
  }, { scene, gfx, ARENA_SEED, FROZEN_T });
}

/** Floor-only numbers: paint cost of a chunk, luminance and busyness. */
async function floorMetrics(page) {
  return page.evaluate(async (ids) => {
    const real = window.__realNow || performance.now.bind(performance);
    const floor = SCREEN_FLOOR;
    const out = { paintMs: {}, luma: {} };
    const cells = [[1, 1, null, 'plac'], [5, 1, null, 'park'], [0, 5, null, 'port'], [4, 6, null, 'galeria'], [7, 3, null, 'dachy'], [3, 3, null, 'rdzen']];
    for (const scale of [1, 2]) {
      const t = [];
      for (let rep = 0; rep < 5; rep++) {
        for (const [i, j, theme] of cells) {
          const t0 = real();
          const e = floor.render(i, j, scale, theme, null);
          e.canvas.getContext('2d').getImageData(0, 0, 1, 1);
          t.push(real() - t0);
        }
      }
      t.sort((a, b) => a - b);
      out.paintMs['x' + scale] = { median: +t[t.length >> 1].toFixed(2), max: +t[t.length - 1].toFixed(2) };
    }
    const stat = (cv) => {
      const w = cv.width, d = cv.getContext('2d').getImageData(0, 0, w, w).data;
      const L = new Float32Array(w * w);
      for (let k = 0; k < w * w; k++) L[k] = (0.2126 * d[k * 4] + 0.7152 * d[k * 4 + 1] + 0.0722 * d[k * 4 + 2]) / 255;
      let sum = 0, edge = 0; const sorted = Array.from(L).sort((a, b) => a - b);
      for (let y = 0; y < w - 1; y++) for (let x = 0; x < w - 1; x++) { const k = y * w + x; sum += L[k]; edge += Math.abs(L[k] - L[k + 1]) + Math.abs(L[k] - L[k + w]); }
      const n = (w - 1) * (w - 1);
      return { mean: +(sum / n).toFixed(4), p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(4), p999: +sorted[Math.floor(sorted.length * 0.999)].toFixed(4), busy: +(edge / n).toFixed(5) };
    };
    for (const [i, j, theme, name] of cells) out.luma[name] = stat(floor.render(i, j, 1, theme, null).canvas);
    for (const id of ids.slice(6)) out.luma[id] = stat(floor.render(2, 2, 1, id, null).canvas);
    floor.clearChunks();
    return out;
  }, DISTRICT_IDS_ALL);
}

/** All 12 districts' floors (2 x 2 blocks each, campaign theme) on one sheet. */
async function districtSheet(page, file) {
  await page.evaluate((ids) => {
    const P = 375, n = 2, cell = P * n, cols = 4, rows = 3, k = 0.5, pad = 26;
    const cv = document.createElement('canvas');
    cv.id = 'qaSheet';
    cv.width = cols * cell * k; cv.height = rows * (cell * k + pad);
    cv.style.cssText = `position:fixed;left:0;top:0;z-index:99999;width:${cv.width}px;height:${cv.height}px`;
    const c = cv.getContext('2d');
    c.fillStyle = '#04101D'; c.fillRect(0, 0, cv.width, cv.height);
    ids.forEach((id, q) => {
      const ox = (q % cols) * cell * k, oy = Math.floor(q / cols) * (cell * k + pad);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const e = SCREEN_FLOOR.render(3 + i, 2 + j, 1, id, null);
        c.drawImage(e.canvas, ox + i * P * k, oy + pad + j * P * k, P * k + 1, P * k + 1);
      }
      const d = DISTRICTS.find(x => x.id === id);
      c.fillStyle = DISTRICT_COLORS[id]; c.font = '700 15px sans-serif'; c.textBaseline = 'middle';
      c.fillText(`${q + 1}. ${d ? d.name : id}`, ox + 8, oy + pad / 2);
    });
    document.body.appendChild(cv);
    SCREEN_FLOOR.clearChunks();
  }, DISTRICT_IDS_ALL);
  await page.locator('#qaSheet').screenshot({ path: file });
  await page.evaluate(() => document.getElementById('qaSheet').remove());
}

export async function run({ styles = STYLES, only = null, publish = false } = {}) {
  const dir = path.join(OUT, 'visual2');
  fs.mkdirSync(dir, { recursive: true });
  const { server, url } = await serve();
  const facts = {};
  const want = (part) => !only || only.includes(part);
  try {
    for (const style of styles) {
      facts[style] = { scenes: {} };
      for (const frame of FRAMES) {
        const g = await boot(url, style, frame);
        for (const scene of ['arena', 'campaign', 'daily']) {
          if (!want('shots')) break;
          const f = await stage(g.page, scene, null);
          await g.page.screenshot({ path: path.join(dir, `${scene}-${frame[0]}-${style}.png`) });
          facts[style].scenes[`${scene}-${frame[0]}`] = f;
        }
        if (frame[0] === 'phone') {
          if (want('shots')) {
            const f = await stage(g.page, 'arena', 0);
            await g.page.screenshot({ path: path.join(dir, `arena-phone-gfx0-${style}.png`) });
            facts[style].scenes['arena-phone-gfx0'] = f;
          }
        } else {
          if (want('metrics')) facts[style].floor = await floorMetrics(g.page);
          if (want('sheet')) {
            await g.page.setViewportSize({ width: 1500, height: 1220 });
            await districtSheet(g.page, path.join(dir, `districts-${style}.png`));
          }
        }
        facts[style].errors = (facts[style].errors || []).concat(g.errors);
        await g.browser.close();
      }
    }
  } finally { server.close(); }
  fs.writeFileSync(path.join(dir, `facts${styles.length === 3 && !only ? '' : '-' + styles.join('')}.json`), JSON.stringify(facts, null, 1));
  if (publish) { await publishJpegs(dir); fs.writeFileSync(path.join(ROOT, 'design', 'visual2', 'facts.json'), JSON.stringify(facts, null, 1)); }
  return facts;
}

/** JPEG copies of the evidence for the repo (design/visual2/shots/). */
async function publishJpegs(dir) {
  const dest = path.join(ROOT, 'design', 'visual2', 'shots');
  fs.mkdirSync(dest, { recursive: true });
  const { chromium } = await import('./lib.mjs');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.png'))) {
    const b64 = fs.readFileSync(path.join(dir, f)).toString('base64');
    await page.setContent(`<body style="margin:0;background:#000"><img id="i" src="data:image/png;base64,${b64}" style="display:block"></body>`);
    const size = await page.evaluate(() => { const i = document.getElementById('i'); return { w: i.naturalWidth, h: i.naturalHeight }; });
    await page.setViewportSize({ width: size.w, height: size.h });
    await page.screenshot({ path: path.join(dest, f.replace(/\.png$/, '.jpg')), type: 'jpeg', quality: 82 });
  }
  await browser.close();
}

if (isMain(import.meta.url)) {
  const style = opt('style', null);
  const only = opt('only', null);
  const facts = await run({ styles: style ? style.split(',') : STYLES, only: only ? only.split(',') : null, publish: flag('publish') });
  for (const [s, f] of Object.entries(facts)) {
    console.log(`\n== ${s} ==`);
    for (const [k, v] of Object.entries(f.scenes)) console.log(k.padEnd(20), JSON.stringify(v));
    if (f.floor) console.log('floor', JSON.stringify(f.floor));
    if (f.errors && f.errors.length) console.log('ERRORS', f.errors);
  }
}
