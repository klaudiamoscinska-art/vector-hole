// v20 „Bramy impulsu”: gates are helpers, never goals. The owner found the
// gate missions pointless (M11 „Pierwszy impuls”: touch two blinking posts
// on an empty map, nothing to eat). Now
//  - no mission has a "go through the gate" step; the 16 former gate
//    missions have eating goals,
//  - an impulse pad on the road gives the vortex a speed burst, then
//    recharges (lit = ready, an arc refills while it charges),
//  - portals are a linked, two-way pair -- a shortcut to the far side,
//  - the briefing explains them with a chip + a line,
//  - on M11 a pad and food are on screen from the first frame.
// Usage: node qa/v20.mjs
import { serve, openGame, veteranSave, report } from './lib.mjs';

async function seeded(url, opts = {}) {
  const g = await openGame(url, { viewport: { width: 402, height: 874 }, ...opts });
  const save = await veteranSave(g.page, { missions: 200, coins: 500, runsPlayed: 6 });
  await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
  await g.page.reload();
  await g.page.waitForFunction(() => window.game && window.game.state);
  return g;
}

// Starts a mission frozen for stepping by hand (RAF detached).
const START = `window.__v20Start = (id) => {
  const g = window.game;
  g.startCampaignMission(id); g.beginMissionPlay();
  cancelAnimationFrame(g.rafId); g.running = false;
  g.bots.forEach(b => { b.x = 0; b.y = 0; });
  return g;
};
window.__v20Step = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) window.game.updateCampaign(dt); };`;

export async function runV20Checks(url) {
  const results = [];

  // --- Content: no gate goals left, every helper mission eats ----------------
  {
    const g = await seeded(url);
    const r = await g.page.evaluate(() => {
      const ms = CAMPAIGN_MISSIONS;
      const gateSteps = ms.filter(m => m.goal.steps.some(st => st.gates)).map(m => m.id);
      // (boss buildings like „Brama Bazaru” are eaten -- that's fine)
      const gateWords = ms.filter(m => /Przejdź przez|Przeleć przez|portal/i.test(m.goal.label)).map(m => m.id + ': ' + m.goal.label);
      const helpers = ms.filter(m => m.setup.gates || m.setup.gateKind === 'portal');
      const noEat = helpers.filter(m => !m.goal.steps.some(st => st.eat)).map(m => m.id);
      const chips = helpers.filter(m => !m.twists.includes(m.setup.gateKind === 'portal' ? 'portal' : 'impulse')).map(m => m.id);
      const m11 = ms.find(m => missionCode(m) === 'M11');
      return { n: helpers.length, gateSteps, gateWords, noEat, chips, m11: m11.name + ' · ' + m11.goal.label };
    });
    results.push(report('content: no mission asks to go through a gate / portal any more', r.gateSteps.length === 0 && r.gateWords.length === 0, JSON.stringify({ steps: r.gateSteps, words: r.gateWords.slice(0, 3) })));
    results.push(report('content: the 16 helper missions all have an eating goal and a helper chip', r.n === 16 && r.noEat.length === 0 && r.chips.length === 0, JSON.stringify(r)));
    results.push(report('content: M11 „Pierwszy impuls” is about eating (owner: "bez sensu")', /Pochłoń/.test(r.m11), r.m11));
    await g.browser.close();
  }

  // --- M11 first frame: a pad and food on screen, briefing explains it -------
  {
    const g = await seeded(url);
    await g.page.addScriptTag({ content: START });
    const r = await g.page.evaluate(async () => {
      const id = CAMPAIGN_MISSIONS.find(m => missionCode(m) === 'M11').id;
      game.openMissionBriefing(id);
      const sheet = document.getElementById('missionBriefing');
      const chip = [...sheet.querySelectorAll('.mc-twist')].map(n => n.textContent.trim());
      const hint = [...sheet.querySelectorAll('.mc-twist-hints li')].map(n => n.textContent);
      sheet.classList.add('hidden');
      const gm = window.__v20Start(id);
      gm.render(performance.now() / 1000);
      const vw = gm.canvas.clientWidth / 2, vh = gm.canvas.clientHeight / 2;
      const onScreen = e => Math.abs(e.x - gm.camera.x) < vw - 10 && Math.abs(e.y - gm.camera.y) < vh - 10;
      const pads = gm.campaignEntities.filter(e => e.type === 'gate');
      const food = gm.campaignEntities.filter(e => e.type === 'fragment' && onScreen(e)).length;
      return { chip, hint: hint.join(' '), pads: pads.length, padInView: pads.some(onScreen), food };
    });
    results.push(report('M11 briefing: the "BRAMY IMPULSU" chip + a line saying what a pad does', r.chip.includes('BRAMY IMPULSU') && /impuls/.test(r.hint) && /przyspieszy/.test(r.hint), JSON.stringify(r)));
    results.push(report('M11 first frame: an impulse pad and food are on the phone screen', r.pads === 2 && r.padInView && r.food >= 3, JSON.stringify(r)));
    results.push(report('M11: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- Impulse pad: a burst, then it recharges ------------------------------
  {
    const g = await seeded(url);
    await g.page.addScriptTag({ content: START });
    const r = await g.page.evaluate(() => {
      const gm = window.__v20Start('M05'), p = gm.player, G = CONFIG.campaign.gate;
      const pad = gm.campaignEntities.find(e => e.type === 'gate');
      const base = p.getSpeed();
      gm.keyDir = { x: 0, y: 0 };
      p.x = pad.x; p.y = pad.y;
      window.__v20Step(1);
      const used = !pad.isGateOpen, ratio = +(p.getSpeed() / base).toFixed(2);
      const text = gm.floatTexts.some(f => f.text === 'IMPULS!');
      // Stay on the pad: it must not fire again while recharging.
      window.__v20Step(Math.round((G.impulseSeconds + 0.3) * 30));
      const after = +(p.getSpeed() / base).toFixed(2), impulses = gm.mission.impulses;
      window.__v20Step(Math.round((G.rechargeSeconds - G.impulseSeconds) * 30));
      const again = gm.mission.impulses;
      return { used, ratio, text, after, impulses, again };
    });
    results.push(report('impulse pad: touching a lit pad gives +50% speed ("IMPULS!")', r.used && r.ratio === 1.5 && r.text, JSON.stringify(r)));
    results.push(report('impulse pad: the burst ends after 2.5 s; the pad recharges, then works again', r.after === 1 && r.impulses === 1 && r.again === 2, JSON.stringify(r)));
    await g.browser.close();
  }

  // --- Portal pair: there and back, no bouncing ------------------------------
  {
    const g = await seeded(url);
    await g.page.addScriptTag({ content: START });
    const r = await g.page.evaluate(() => {
      const gm = window.__v20Start('M13'), p = gm.player, G = CONFIG.campaign.gate;
      const [a, b] = gm.campaignEntities.filter(e => e.type === 'gate' && e.glyph === 'portal').sort((u, v) => u.x - v.x);
      gm.keyDir = { x: 0, y: 0 };
      p.x = a.x; p.y = a.y;
      window.__v20Step(1);
      const there = Math.hypot(p.x - b.x, p.y - b.y) < b.radius + p.radius + 20 && p.x < b.x;
      window.__v20Step(10);
      const stayed = p.x > (a.x + b.x) / 2;
      window.__v20Step(Math.round(G.portalCooldown * 30) + 2);
      p.x = b.x; p.y = b.y;
      window.__v20Step(1);
      const back = Math.hypot(p.x - a.x, p.y - a.y) < a.radius + p.radius + 20 && p.x > a.x;
      const crystalsFar = gm.campaignEntities.filter(e => e.type === 'marker').every(e => e.x > (a.x + b.x) / 2);
      return { there, stayed, back, used: gm.mission.portalsUsed, crystalsFar };
    });
    results.push(report('portal: in at one end, out beside the other (inner side), no bounce back', r.there && r.stayed, JSON.stringify(r)));
    results.push(report('portal: it works both ways (a shortcut to the crystals and back)', r.back && r.used === 2 && r.crystalsFar, JSON.stringify(r)));
    results.push(report('portal: no runtime errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  // --- English: the new lines are translated --------------------------------
  {
    const g = await seeded(url, { locale: 'en-US' });
    const r = await g.page.evaluate(async () => {
      game.openMissionBriefing('M05');
      await new Promise(res => setTimeout(res, 100));
      const t = document.getElementById('briefingCard').innerText;
      game.openMissionBriefing('M13');
      await new Promise(res => setTimeout(res, 100));
      return t + ' || ' + document.getElementById('briefingCard').innerText;
    });
    results.push(report('English: the impulse / portal chips and lines are translated', /IMPULSE GATES/.test(r) && /PORTALS/.test(r) && !/Świecąca|Portale są|Zbierz fragmenty|drugiej stronie/.test(r), r.replace(/\n/g, ' ').slice(0, 300)));
    await g.browser.close();
  }

  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const res = await runV20Checks(url);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} v20 checks passed`);
  process.exit(failed.length ? 1 : 0);
}
