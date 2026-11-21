// GG-OBJECTS-SCALE-FIX-01 evidence, not a test: BEFORE (base checkout) / AFTER (this checkout) frames of a real Arena round.
//   node qa/objscale1-shots.mjs --base=DIR [--only=pc,mobile] [--stages=start,lateT1,...]
// Every scene is staged by QA and described here: an Arena round (seed 2024, veteran save, gfx 2), the player's vortex set to the stage's radius
// in the middle of the Plac Neonów block, the camera at the zoom the game itself picks for that radius (Game.update()'s formula), time frozen.
// One object of every kind of the tier that vortex CANNOT eat yet is MOVED by QA into a row above it (and of the tier it can eat, below it);
// natural objects inside that area and every rival are moved out of the view. Positions only; same spacing BEFORE and AFTER.
// Output: qa/out/objscale1/shots/<before|after>/<frame>-<stage>.png and side-by-side qa/out/objscale1/shots/<frame>-<stage>.png
import fs from 'node:fs';
import path from 'node:path';
import { serve, chromium, OUT, ROOT, isMain } from './lib.mjs';
import { session, paintAfterDecode } from './objraster2-shots.mjs';

const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const DIR = path.join(OUT, 'objscale1', 'shots');
const TIER_KINDS = { 1: ['fragment', 'kapsula'], 2: ['lawka', 'kiosk', 'skrzynia', 'latarnia', 'drzewo', 'znacznik'], 3: ['samochod', 'wezel', 'pylon'], 4: ['pawilon', 'billboard', 'magazyn', 'landmark'], 5: ['autobus', 'tramwaj', 'ciezarowka'], 6: ['wiezowiec', 'maszt', 'kopula'] };
// [name, vortex radius, locked tier shown above, eatable tier shown below]
export const STAGES = [
  ['start', 18, 2, 1], ['lateT1', 28, 2, 1], ['unlockT2', 31, 3, 2], ['lateT2', 44, 3, 2], ['lateT3', 64, 4, 3], ['lateT4', 88, 5, 4], ['lateT5', 115, 6, 5]
];
const FROZEN_T = 600000;

async function stage(page, { R, locked, eat }) {
  return page.evaluate(async ({ R, locked, eat, TIER_KINDS, FROZEN_T }) => {
    const { CONFIG } = await import(document.querySelector('script[type="module"][src]').src);
    const g = window.game;
    window.__qaSeedRandom(2024);
    g.applyGfx(2);
    g.startRound({ seed: 2024 });
    if (g.rafId) cancelAnimationFrame(g.rafId);
    g.running = false;
    performance.now = () => FROZEN_T;
    const p = g.player, cx = 1.5 * 375, cy = 1.5 * 375;   // Plac Neonów block
    p.x = cx; p.y = cy; p.radius = R; p.invulnerableUntil = 0; p.growPopAt = 0;
    // the game's own camera zoom for this radius (Game.update())
    const Z = CONFIG.juice.zoom;
    const growT = Math.min(1, Math.max(0, (R - Z.startRadius) / (Z.endRadius - Z.startRadius)));
    let zoom = (Z.max + (Z.min - Z.max) * Math.sqrt(growT)) * g.viewScale;
    zoom = Math.min(zoom, Z.holeScreenFrac * Math.min(g.width, g.height) / R);
    zoom = Math.max(zoom, Z.floor, g.width / 3000, g.height / 3000);
    const hw = g.width / zoom / 2, hh = g.height / zoom / 2;
    const pick = (k) => g.objects.find(o => o.subtype === k && !o.eating && !o.__staged);
    const row = (kinds, y) => {
      const objs = kinds.map(pick).filter(Boolean), step = Math.min(objs.length ? Math.max(...objs.map(o => o.radius)) * 2 * 2.1 : 0, (hw * 2 - 20) / Math.max(1, objs.length));
      objs.forEach((o, i) => { o.x = cx + (i - (objs.length - 1) / 2) * step; o.y = y; o.__staged = true; });
      return objs;
    };
    const lockedR = TIER_KINDS[locked].map(pick).filter(Boolean)[0].radius;
    const top = row(TIER_KINDS[locked], cy - Math.min(hh * 0.55, R + lockedR * 2.4 + 8));
    const bottom = row(TIER_KINDS[eat], cy + Math.min(hh * 0.55, R + 2.2 * TIER_KINDS[eat].map(pick).filter(Boolean)[0].radius * 1.6 + 8));
    // natural objects in view that are not staged: kept, unless they would cover the staged rows or the vortex
    const staged = new Set([...top, ...bottom]);
    for (const o of g.objects) {
      if (staged.has(o)) continue;
      const near = [...staged, p].some(s => Math.abs(o.x - s.x) < (s.radius || R) * 2.4 + o.radius * 2.4 && Math.abs(o.y - s.y) < (s.radius || R) * 2.4 + o.radius * 2.4);
      if (near) { o.x = (o.x + 1500) % 3000; o.y = (o.y + 1500) % 3000; }
    }
    for (const b of g.bots) { b.x = (cx + 1500) % 3000; b.y = (cy + 1500) % 3000; }
    g.zoom = zoom; g.camera.x = cx; g.camera.y = cy;
    g.banner = null; g.bannerQueue = []; g.particles = []; g.ripples = []; g.floatTexts = []; g.shake = 0; g.flashAlpha = 0;
    return { R, zoom: +zoom.toFixed(3), locked: top.map(o => o.subtype), eatable: bottom.map(o => o.subtype) };
  }, { R, locked, eat, TIER_KINDS, FROZEN_T });
}

export async function run({ base, only = ['pc', 'mobile'], stages = STAGES.map(s => s[0]) }) {
  const facts = {};
  for (const [name, root] of [['before', base], ['after', ROOT]]) {
    const dir = path.join(DIR, name);
    fs.mkdirSync(dir, { recursive: true });
    const srv = await serve({ root });
    facts[name] = { errors: [], shots: {} };
    try {
      for (const frame of only) {
        const g = await session(srv.url, frame);
        try {
          for (const [st, R, locked, eat] of STAGES.filter(s => stages.includes(s[0]))) {
            const f = await stage(g.page, { R, locked, eat });
            await paintAfterDecode(g.page, 1500);
            const file = path.join(dir, `${frame}-${st}.png`);
            await g.page.screenshot({ path: file });
            facts[name].shots[`${frame}-${st}`] = f;
          }
          facts[name].errors.push(...g.errors);
        } finally { await g.browser.close(); }
      }
    } finally { srv.server.close(); }
    console.log(`  ${name}: ${Object.keys(facts[name].shots).length} shots, ${facts[name].errors.length} errors`);
  }
  // side by side
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
    for (const key of Object.keys(facts.after.shots)) {
      const a = fs.readFileSync(path.join(DIR, 'before', key + '.png')).toString('base64'), b = fs.readFileSync(path.join(DIR, 'after', key + '.png')).toString('base64');
      const f = facts.after.shots[key];
      const title = `${key}: vortex r ${f.R} (zoom ${f.zoom}) -- row above: ${f.locked.join(', ')} (LOCKED) -- row below: ${f.eatable.join(', ')} (eatable)`;
      await page.setContent(`<body style="margin:0;background:#05070f;color:#e8f2ff;font:600 15px system-ui"><div id=w style="display:inline-block;padding:8px"><div style="padding:4px 2px 8px">${title}</div><div style="display:flex;gap:10px"><figure style="margin:0"><figcaption style="padding:0 0 4px">BEFORE (origin/main 4592a5c)</figcaption><img id=a src="data:image/png;base64,${a}"></figure><figure style="margin:0"><figcaption style="padding:0 0 4px">AFTER (GG-OBJECTS-SCALE-FIX-01)</figcaption><img id=b src="data:image/png;base64,${b}"></figure></div></div></body>`);
      await page.waitForFunction(() => [...document.images].every(i => i.complete));
      await page.evaluate(() => { for (const i of document.images) if (i.naturalWidth > 900) i.style.width = (i.naturalWidth / (i.naturalWidth > 1500 ? 2 : 1)) + 'px'; else if (i.naturalWidth > 600) i.style.width = (i.naturalWidth / 2) + 'px'; });
      await page.locator('#w').screenshot({ path: path.join(DIR, key + '.png') });
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(DIR, 'facts.json'), JSON.stringify(facts, null, 1));
  return facts;
}

if (isMain(import.meta.url)) {
  const base = opt('base', null);
  if (!base) { console.error('--base=DIR is required'); process.exit(2); }
  const only = opt('only', null), stages = opt('stages', null);
  run({ base: path.resolve(base), only: only ? only.split(',') : undefined, stages: stages ? stages.split(',') : undefined }).then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
}
