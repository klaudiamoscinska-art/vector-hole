// GG-UI-02 stage 1: how long a menu layer (Dzielnice) takes to reach full opacity after it is opened, per frame size,
// in this headless Chromium -- the evidence behind known problem 2 (2560x1440 "layer not visible").
//   node design/ui2/tools/ui2-anim-timing.mjs
import { serve, openGame, veteranSave } from '../../../qa/lib.mjs';
const { server, url } = await serve();
for (const [w, h] of [[390, 844], [1366, 768], [2560, 1440]]) {
  const res = [];
  for (let i = 0; i < 4; i++) {
    const g = await openGame(url, { viewport: { width: w, height: h }, mobile: w < 500, deviceScaleFactor: 1 });
    const save = await veteranSave(g.page, { missions: 12, runsPlayed: 5 });
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
    const r = await g.page.evaluate(async () => {
      const t0 = performance.now(); window.game.openCampaignScreen();
      const el = document.getElementById('campaignScreen'), inner = el.querySelector('.screen-inner');
      const samples = []; let full = null, frames = 0;
      while (performance.now() - t0 < 3000) {
        await new Promise(r => requestAnimationFrame(r)); frames++;
        const o = Math.min(+getComputedStyle(el).opacity, +getComputedStyle(inner).opacity), t = Math.round(performance.now() - t0);
        if ([500, 600].some(m => samples.length < 2 && t >= m && !samples.find(s => s.m === m))) samples.push({ m: t >= 600 ? 600 : 500, t, o: +o.toFixed(2), hidden: el.classList.contains('hidden') });
        if (o >= 0.999 && full == null) { full = t; break; }
      }
      return { full, frames, at500: samples[0] || null };
    });
    res.push(r); await g.browser.close();
  }
  console.log(`${w}x${h}`, JSON.stringify(res));
}
server.close();
