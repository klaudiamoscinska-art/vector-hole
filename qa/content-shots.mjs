// CONTENT-1 evidence, not a test: before/after screenshots of the campaign
// goal icons next to the objects they stand for, M32 (Witryny) in the
// briefing and the HUD, M59 (Rekord Rdzenia) late in the mission on phone /
// portal / tablet / laptop frames, the renamed missions and a result.
// Written to qa/out/content/shots/<label>/. Usage:
//   node qa/content-shots.mjs [--root DIR] [--label after]
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, allDistrictsSave, CAMPAIGN_BOT, OUT, isMain } from './lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };

export const FRAMES = [
  ['phone', { width: 390, height: 844 }],
  ['iphone13-land', { width: 775, height: 328 }],
  ['iphone16pro', { width: 402, height: 812 }],
  ['iphone16pro-land', { width: 874, height: 402 }],
  ['poki-640', { width: 640, height: 360 }],
  ['poki-836', { width: 836, height: 470 }],
  ['poki-1031', { width: 1031, height: 580 }],
  ['cg-800', { width: 800, height: 450 }],
  ['tablet', { width: 820, height: 1180 }],
  ['laptop', { width: 1536, height: 730 }]
];

/** Starts a mission by its on-screen code (M32) and grows the vortex to
 *  `radius` (world px), then lets the real loop run so the camera settles. */
async function missionAt(page, code, radius) {
  return page.evaluate(async ({ code, radius }) => {
    const g = window.game;
    const id = DISTRICTS.flatMap(d => d.missions).find(mid => missionCode(campaignMissionById(mid)) === code);
    g.missionBoosters = [];
    g.startCampaignMission(id);
    if (g.introPending) g.beginMissionPlay();
    await new Promise(r => setTimeout(r, 600));
    if (radius) {
      // A frozen frame at that size (the live loop would let a hole this
      // big swallow the board -- and end the mission -- before the shot):
      // the camera is set the way the game frames that radius.
      if (g.rafId) cancelAnimationFrame(g.rafId);
      g.running = false;
      g.mission.growthUnits = unitsForRadius(radius);
      g.syncCampaignRadius();
      g.mission.tierId = g.campaignPlayerTier().id;
      g.zoom = g.campaignTargetZoom ? g.campaignTargetZoom() : g.zoom;
      const cb = CONFIG.campaign.bounds;
      g.followCamera(cb.minX, cb.minY, cb.maxX, cb.maxY);
      g.updateCampaignHUD();
      g.renderCampaign(performance.now() / 1000);
    }
    await new Promise(r => setTimeout(r, 200));
    return { id, radius: g.player.radius, zoom: +g.zoom.toFixed(3), w: g.width, h: g.height };
  }, { code, radius });
}

export async function shootContent({ root, label }) {
  const dir = path.join(OUT, 'content', 'shots', label);
  fs.mkdirSync(dir, { recursive: true });
  const { server, url } = await serve(root ? { root: path.resolve(root) } : {});
  const notes = [];
  const boot = async (vp, locale = 'pl-PL') => {
    const g = await openGame(url, { viewport: vp, locale });
    const save = await allDistrictsSave(g.page);
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
    return g;
  };
  const shot = (page, name) => page.screenshot({ path: path.join(dir, name + '.png') });

  // 1. Every goal icon next to the board object it stands for.
  {
    const g = await boot({ width: 900, height: 1400 });
    await g.page.evaluate(() => {
      const game = window.game;
      const seen = new Map();
      for (const id of DISTRICTS.flatMap(d => d.missions)) {
        const def = campaignMissionById(id);
        for (const st of def.goal.steps) {
          const type = st.eat || st.activate || (st.landmark ? 'landmark' : null);
          if (!type || type === 'runner') continue;
          const glyph = st.glyph || def.setup[type + 'Glyph'] || null;
          const key = type + ':' + (glyph || (st.landmark || '*'));
          if (seen.has(key)) continue;
          seen.set(key, { st, def, type, glyph, code: missionCode(def) });
        }
      }
      const sheet = document.createElement('div');
      sheet.id = 'qaIconSheet';
      sheet.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#04101D;color:#F2F8FF;font:13px sans-serif;padding:12px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;overflow:hidden';
      for (const { st, def, type, glyph, code } of seen.values()) {
        const ic = game.objectiveIconDef(st, def.setup);
        const cell = document.createElement('div');
        cell.style.cssText = 'display:flex;align-items:center;gap:8px;border:1px solid #1d3550;border-radius:8px;padding:6px';
        cell.innerHTML = `<span style="color:${ic.color};width:34px;height:34px;flex:none"><svg viewBox="0 0 24 24" width="34" height="34">${ic.icon}</svg></span>`;
        const cv = document.createElement('canvas');
        cv.width = 120; cv.height = 120; cv.style.cssText = 'width:60px;height:60px;flex:none';
        const ctx = cv.getContext('2d');
        ctx.scale(2, 2);
        const e = new CampaignEntity(type, 30, 30, type === 'landmark' ? { landmarkId: st.landmark, unlocked: true } : { glyph: glyph || undefined });
        const k = 24 / e.radius;
        ctx.translate(30, 30); ctx.scale(k, k); ctx.translate(-30, -30);
        e.draw(ctx, false);
        cell.appendChild(cv);
        const t = document.createElement('span');
        t.textContent = `${code} · ${st.label}`;
        cell.appendChild(t);
        sheet.appendChild(cell);
      }
      document.body.appendChild(sheet);
    });
    await g.page.waitForTimeout(300);
    await shot(g.page, '01-goal-icons-vs-board');
    await g.browser.close();
  }

  // 2. M32 "Witryny": briefing and HUD (portrait + landscape).
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['iphone13-land', { width: 775, height: 328 }]]) {
    const g = await boot(vp);
    await g.page.evaluate(() => {
      const id = DISTRICTS.flatMap(d => d.missions).find(mid => missionCode(campaignMissionById(mid)) === 'M32');
      window.game.openMissionBriefing(id);
    });
    await g.page.waitForTimeout(700);
    await shot(g.page, `02-M32-briefing-${name}`);
    await missionAt(g.page, 'M32', 0);
    await shot(g.page, `03-M32-hud-${name}`);
    await g.browser.close();
  }

  // 3. M59 "Rekord Rdzenia" late in the mission (the expert bot ends it at
  // r ~299) and the largest T6 radius, in every frame.
  for (const [name, vp] of FRAMES) {
    const g = await boot(vp);
    const r = await missionAt(g.page, 'M59', 299);
    notes.push({ shot: `04-M59-late-${name}`, ...r, holeOnScreen: Math.round(r.radius * r.zoom), shortSide: Math.min(r.w, r.h), frac: +(r.radius * r.zoom / Math.min(r.w, r.h)).toFixed(3) });
    await shot(g.page, `04-M59-late-${name}`);
    await g.browser.close();
  }

  // 4. Missions whose copy changed / big objects: briefing + HUD.
  for (const code of ['M58', 'M136', 'M145', 'M54', 'M55']) {
    for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['poki-640', { width: 640, height: 360 }]]) {
      const g = await boot(vp);
      await g.page.evaluate((c) => {
        const id = DISTRICTS.flatMap(d => d.missions).find(mid => missionCode(campaignMissionById(mid)) === c);
        window.game.openMissionBriefing(id);
      }, code);
      await g.page.waitForTimeout(700);
      await shot(g.page, `05-${code}-briefing-${name}`);
      const r = await missionAt(g.page, code, 118);
      notes.push({ shot: `06-${code}-hud-T6-${name}`, ...r, frac: +(r.radius * r.zoom / Math.min(r.w, r.h)).toFixed(3) });
      await shot(g.page, `06-${code}-hud-T6-${name}`);
      await g.browser.close();
    }
  }

  // 5. A result screen after a cleared mission (M32), portrait + landscape.
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['poki-836', { width: 836, height: 470 }]]) {
    const g = await boot(vp);
    await g.page.addScriptTag({ content: CAMPAIGN_BOT });
    await g.page.evaluate(() => {
      const id = DISTRICTS.flatMap(d => d.missions).find(mid => missionCode(campaignMissionById(mid)) === 'M32');
      return window.__qaPlayMission(id);
    });
    await g.page.waitForTimeout(1500);
    await shot(g.page, `07-M32-result-${name}`);
    await g.browser.close();
  }

  fs.writeFileSync(path.join(dir, 'notes.json'), JSON.stringify(notes, null, 2));
  server.close();
  return notes;
}

if (isMain(import.meta.url)) {
  const root = arg('--root', null);
  const notes = await shootContent({ root, label: arg('--label', root ? 'before' : 'after') });
  for (const n of notes) console.log(`  ${n.shot}: r ${Math.round(n.radius)} zoom ${n.zoom} -> ${Math.round(n.frac * 100)}% of the short side`);
}
