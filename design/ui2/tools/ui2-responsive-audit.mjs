// GG-UI-02 stage 1: the two known responsive problems, measured on the real
// game (PRZED) and on both mock-up variants, on the same staged screen.
//   node design/ui2/tools/ui2-responsive-audit.mjs
// 1. Dzielnice at 320x568: is the next mission's GRAJ on screen and tappable?
// 2. 2560x1440: which layers are visible on Miasto / Dzielnice / briefing, how
//    much of the frame the interface fills, and is the result stable over reloads?
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, openGame, frozenDateScript, QA_RANDOM } from '../../../qa/lib.mjs';
import { FROZEN_ISO, buildProfile } from './ui2-scenes.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const UI2 = path.resolve(HERE, '..');
const read = (f) => fs.existsSync(path.join(UI2, 'variants', f)) ? fs.readFileSync(path.join(UI2, 'variants', f), 'utf8') : '';
const { server, url } = await serve();
const out = { cta: [], big: [] };
async function open(vp) {
  const g = await openGame(url, { viewport: { width: vp.w, height: vp.h }, mobile: vp.mobile, deviceScaleFactor: 1, initScript: frozenDateScript(FROZEN_ISO) + QA_RANDOM });
  const save = await g.page.evaluate(buildProfile, 'mid');
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
  return g;
}
const apply = (page, v) => page.evaluate(({ v, css, js }) => {
  if (window.__ui2Undo) window.__ui2Undo(); const old = document.getElementById('ui2-variant'); if (old) old.remove(); document.documentElement.removeAttribute('data-ui2');
  if (v === 'before') return;
  const st = document.createElement('style'); st.id = 'ui2-variant'; st.textContent = css; document.head.appendChild(st);
  document.documentElement.setAttribute('data-ui2', v);
  if (js && !window.__ui2Apply) (0, eval)(js);
  if (window.__ui2Apply) window.__ui2Apply(v);
}, { v, css: read('shared.css') + read(v + '.css'), js: read(v + '.js') });

for (const vp of [{ w: 320, h: 568, mobile: true }, { w: 360, h: 640, mobile: true }, { w: 375, h: 667, mobile: true }, { w: 390, h: 844, mobile: true }]) {
  const g = await open(vp);
  await g.page.evaluate(() => window.game.openCampaignScreen());
  await g.page.waitForTimeout(600);
  for (const v of ['before', 'a', 'b']) {
    await apply(g.page, v);
    await g.page.waitForTimeout(400);
    const m = await g.page.evaluate(() => {
      const b = document.querySelector('#missionNextCard .mc-play'), nav = document.getElementById('bottomNav');
      const r = b.getBoundingClientRect(), n = nav.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const hit = document.elementFromPoint(cx, Math.min(innerHeight - 1, Math.max(0, cy)));
      const sc = document.querySelector('#campaignScreen .screen-inner');
      return { cta: { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }, navTop: Math.round(n.top), viewport: innerHeight,
        visiblePx: Math.max(0, Math.round(Math.min(r.bottom, n.top) - Math.max(r.top, 0))), hit: hit ? (hit.id || hit.className || hit.tagName) : null, tappable: !!hit && (hit === b || b.contains(hit)),
        scrollTop: sc.scrollTop, scrollMax: sc.scrollHeight - sc.clientHeight, cardTop: Math.round(document.getElementById('missionNextCard').getBoundingClientRect().top) };
    });
    out.cta.push({ frame: `${vp.w}x${vp.h}`, variant: v, ...m });
    console.log('CTA', `${vp.w}x${vp.h}`, v, JSON.stringify(m));
  }
  await g.browser.close();
}
for (let run = 0; run < 3; run++) {
  const g = await open({ w: 2560, h: 1440, mobile: false });
  for (const scene of ['hub', 'campaign', 'briefing']) {
    await g.page.evaluate((scene) => { const gm = window.game; if (scene === 'campaign') gm.openCampaignScreen(); if (scene === 'briefing') gm.openMissionBriefing(gm.nextCampaignMissionId()); }, scene);
    await g.page.waitForTimeout(700);
    const m = await g.page.evaluate(() => {
      const vis = [...document.querySelectorAll('.screen:not(.hidden)')].map(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { id: el.id, z: cs.zIndex, op: cs.opacity, box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] }; });
      const inner = document.querySelector('.screen:not(.hidden):not(.overlay-screen) .screen-inner'); const ir = inner ? inner.getBoundingClientRect() : null;
      let l = 1e9, t = 1e9, r = 0, b = 0;
      if (inner) for (const c of inner.querySelectorAll('*')) { const q = c.getBoundingClientRect(); if (q.width && q.height && getComputedStyle(c).visibility !== 'hidden') { l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); } }
      const app = document.getElementById('app');
      return { body: document.body.className, uiScale: getComputedStyle(document.documentElement).getPropertyValue('--ui-scale').trim() || getComputedStyle(app).zoom || null, appZoom: getComputedStyle(app).zoom, visible: vis,
        content: inner ? [Math.round(l), Math.round(t), Math.round(r), Math.round(b)] : null, fillW: inner ? +((r - l) / innerWidth).toFixed(2) : null, fillH: inner ? +((b - t) / innerHeight).toFixed(2) : null };
    });
    out.big.push({ run, scene, ...m });
    console.log('BIG', run, scene, JSON.stringify(m));
  }
  await g.browser.close();
}
fs.writeFileSync(path.join(UI2, 'responsive-audit.json'), JSON.stringify(out, null, 1));
server.close();
