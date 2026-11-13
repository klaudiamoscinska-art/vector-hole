// GG-UI-02 stage 1 (design only): shoots every scene of ui2-scenes.mjs from
// the REAL game as PRZED / A / B. The game's files are served untouched;
// a variant is a stylesheet (design/ui2/variants/<v>.css) plus an optional
// in-memory DOM pass (variants/<v>.js) added to the page AFTER the scene is
// staged -- so the three shots of a scene share one save and one state.
//   node design/ui2/tools/ui2-shots.mjs                 (all scenes, iPhone)
//   node design/ui2/tools/ui2-shots.mjs --only=m2-mid,w1-skins --variants=before,b
//   node design/ui2/tools/ui2-shots.mjs --responsive    (key scenes on every frame)
//   node design/ui2/tools/ui2-shots.mjs --en            (key scenes in English)
// Output: design/ui2/shots/<scene>-<frame>[-en]-<variant>.jpg + facts.json
// (the save and the on-screen values of every shot; console errors).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { serve, openGame, frozenDateScript, QA_RANDOM, ARENA_BOT } from '../../../qa/lib.mjs';
import { SCENES, VP, FROZEN_ISO, buildProfile } from './ui2-scenes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UI2 = path.resolve(HERE, '..');
const OUT = path.join(UI2, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const opt = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const flag = (k) => process.argv.includes(`--${k}`);
const ONLY = opt('only', '').split(',').filter(Boolean);
const VARIANTS = opt('variants', 'before,a,b').split(',');
const FRAMES = opt('frames', '').split(',').filter(Boolean);
const QUALITY = Number(opt('quality', 72));

const variantFiles = (v) => ({
  css: [path.join(UI2, 'variants', 'shared.css'), path.join(UI2, 'variants', v + '.css')].filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n'),
  js: [path.join(UI2, 'variants', 'shared.js'), path.join(UI2, 'variants', v + '.js')].filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n')
});

/** What the player reads on the frame (must be equal across the variants of a scene). */
const readFacts = () => {
  const g = window.game, s = g.save;
  const txt = (id) => { const el = document.getElementById(id); return el ? el.textContent.trim() : null; };
  const open = [...document.querySelectorAll('.screen:not(.hidden), .unlock-overlay:not(.hidden)')].map(el => el.id);
  return {
    screens: open,
    save: { coins: s.coins, prisms: s.prisms, coreLevel: s.hub.coreLevel, coreCharge: s.hub.coreCharge, level: s.player.level, xp: s.player.xp, runs: s.stats.runsPlayed,
      owned: s.owned.slice().sort(), selected: s.selected, auras: s.auras.owned.slice().sort(), aura: s.auras.selected,
      completed: Object.keys(s.campaign.completed).length, districts: s.campaign.unlockedDistricts.slice() },
    shown: { coinsMenu: txt('coinCountMenu'), prismsMenu: txt('prismCountMenu'), lvl: txt('hubLevelLabel'), charge: txt('hubChargeValue'), nextReward: txt('hubRewardChip1'),
      finalScore: txt('finalScore'), finalCoins: txt('finalCoins'), place: txt('finalPlace'), xpGain: txt('resultXpGain'), coreAfter: txt('resultCoreAfter'),
      missionScore: txt('missionResultScore'), missionReward: txt('missionResultReward'), unlockTitle: open.includes('unlockOverlay') ? txt('unlockTitle') : null,
      prices: [...document.querySelectorAll('.screen:not(.hidden) .skin-grid:not(.hidden) .skin-card')].map(c => c.textContent.replace(/\s+/g, ' ').trim()),
      missions: document.querySelectorAll('#campaignScreen:not(.hidden) #missionList .mission-row').length,
      districtTiles: document.querySelectorAll('#campaignScreen:not(.hidden) #districtMap > *').length }
  };
};

export async function shoot(baseUrl, scene, vp, variants, { locale = 'pl-PL' } = {}) {
  const g = await openGame(baseUrl, { viewport: { width: vp.width, height: vp.height }, mobile: vp.mobile, deviceScaleFactor: vp.dsf, locale,
    initScript: frozenDateScript(FROZEN_ISO) + QA_RANDOM });
  const { page } = g;
  const save = await page.evaluate(buildProfile, scene.profile);
  await page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await page.reload();
  await page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  await page.addScriptTag({ content: ARENA_BOT });
  await page.evaluate(() => { window.__qaSeedRandom(11); window.game.applyGfx(2); });
  await scene.stage(page);
  const out = [];
  // One page, one staged state: PRZED first, then each variant swapped in (and fully removed before the next).
  for (const variant of variants) {
    await page.evaluate(() => { if (window.__ui2Undo) window.__ui2Undo(); const st = document.getElementById('ui2-variant'); if (st) st.remove(); document.documentElement.removeAttribute('data-ui2'); });
    if (variant !== 'before') {
      const { css, js } = variantFiles(variant);
      await page.evaluate(({ css, js, variant }) => {
        const st = document.createElement('style'); st.id = 'ui2-variant'; st.textContent = css; document.head.appendChild(st);
        document.documentElement.setAttribute('data-ui2', variant);
        if (js && !window.__ui2Apply) { (0, eval)(js); }
        if (window.__ui2Apply) window.__ui2Apply(variant);
      }, { css, js, variant });
    }
    await page.waitForTimeout(650);
    const facts = await page.evaluate(readFacts);
    const layout = await page.evaluate(() => {
      // Text the layout cuts (an ellipsis or a hidden overflow) inside the layers on screen -- compared with PRZED by ui2-check.mjs.
      const clipped = [];
      for (const root of document.querySelectorAll('.screen:not(.hidden), .unlock-overlay:not(.hidden), #bottomNav:not(.hidden)')) {
        for (const el of root.querySelectorAll('*')) {
          if (el.childElementCount || !el.textContent.trim() || !el.clientWidth) continue;
          const cs = getComputedStyle(el);
          if (cs.overflowX === 'visible' || cs.visibility === 'hidden') continue;
          // the text's own box against the element's (scrollWidth also counts a button's animated shine)
          const range = document.createRange(); range.selectNodeContents(el);
          const tw = range.getBoundingClientRect().width, ew = el.getBoundingClientRect().width;
          if (tw > ew + 1 || (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1)) clipped.push(el.textContent.trim().slice(0, 40));
        }
      }
      return { docW: document.documentElement.scrollWidth, winW: innerWidth, docH: document.documentElement.scrollHeight, winH: innerHeight, clipped };
    });
    const name = `${scene.id}-${vp.id}${locale.startsWith('en') ? '-en' : ''}-${variant}`;
    const file = path.join(OUT, name + '.jpg');
    await page.screenshot({ path: file, type: 'jpeg', quality: QUALITY });
    out.push({ name, scene: scene.id, frame: vp.id, variant, locale, facts, layout, errors: g.errors.slice(), sha: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16) });
  }
  await g.browser.close();
  return out;
}

const { server, url } = await serve();
const factsFile = path.join(OUT, 'facts.json');
const all = fs.existsSync(factsFile) ? JSON.parse(fs.readFileSync(factsFile, 'utf8')) : {};
let jobs = [];
const want = SCENES.filter(s => !ONLY.length || ONLY.includes(s.id));
if (flag('responsive')) {
  for (const s of want.filter(s => s.responsive || ONLY.length)) for (const f of (FRAMES.length ? FRAMES : ['p320', 'p360', 'cg', 'land', 'desk', 'qhd'])) jobs.push([s, VP[f], VARIANTS, {}]);
} else if (flag('en')) {
  for (const s of want.filter(s => s.responsive || ONLY.length)) for (const f of (FRAMES.length ? FRAMES : ['iphone', 'p320'])) jobs.push([s, VP[f], VARIANTS, { locale: 'en-US' }]);
} else {
  for (const s of want) for (const f of (FRAMES.length ? FRAMES : ['iphone'])) jobs.push([s, VP[f], VARIANTS, {}]);
}
let bad = 0;
const POOL = Number(opt('pool', 4));
let idx = 0;
await Promise.all(Array.from({ length: POOL }, async () => {
  while (idx < jobs.length) {
    const [s, vp, v, o] = jobs[idx++];
    try {
      for (const r of await shoot(url, s, vp, v, o)) {
        all[r.name] = r;
        if (r.errors.length) { bad++; console.log('ERRORS', r.name, r.errors.slice(0, 3)); }
        console.log('shot', r.name);
      }
    } catch (e) { bad++; console.log('FAILED', s.id, vp.id, String(e).slice(0, 300)); }
  }
}));
fs.writeFileSync(factsFile, JSON.stringify(all, null, 1));
server.close();
console.log(bad ? `done with ${bad} problem(s)` : 'done, no console errors');
process.exit(bad ? 1 : 0);
