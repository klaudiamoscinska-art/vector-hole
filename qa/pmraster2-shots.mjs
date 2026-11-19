// GG-PM-RASTER-02: real Arena frames R2 (this checkout) and R1 (--base=DIR, the -01 commit): PC 1280x720 and phone 390x844,
// view over the plac blocks with the player (T1) in it. Usage: node qa/pmraster2-shots.mjs --base=../vh-pmr-r1 -> qa/out/pm-raster2/
import { serve, openGame, veteranSave, QA_RANDOM, OUT } from './lib.mjs';
import fs from 'node:fs';
import path from 'node:path';
const DEST = path.join(OUT, 'pm-raster2');
fs.mkdirSync(DEST, { recursive: true });
const FRAMES = { pc: { w: 1280, h: 720, mobile: false, dsf: 1, zoom: 0.5 }, mobile: { w: 390, h: 844, mobile: true, dsf: 2, zoom: 0.4 } };
async function shoot(url, tag) {
  for (const [name, f] of Object.entries(FRAMES)) {
    const g = await openGame(url, { viewport: { width: f.w, height: f.h }, mobile: f.mobile, deviceScaleFactor: f.dsf, initScript: QA_RANDOM });
    const s = await veteranSave(g.page, { missions: 29, coins: 800, runsPlayed: 12 });
    await g.page.evaluate((v) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(v)), s);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready && window.game.state);
    await g.page.evaluate((zoom) => {
      const gm = window.game; gm.applyGfx(2); window.__qaSeedRandom(2024);
      gm.startRound({ seed: 2024 }); cancelAnimationFrame(gm.rafId); gm.running = false;
      gm.player.x = 1.5 * 375; gm.player.y = 1.5 * 375;
      for (let k = 0; k < 4; k++) gm.update(1 / 60);
      gm.zoom = zoom;
    }, f.zoom);
    await g.page.waitForTimeout(900);
    await g.page.evaluate(() => { for (let k = 0; k < 6; k++) window.game.render(k / 60); });
    const file = path.join(DEST, `${tag}-${name}.png`);
    await g.page.screenshot({ path: file });
    console.log(file, g.errors.length ? 'errors ' + g.errors.slice(0, 2) : 'no errors');
    await g.browser.close();
  }
}
const arg = process.argv.find(a => a.startsWith('--base='));
const cur = await serve();
await shoot(cur.url, 'R2');
if (arg) { const b = await serve({ root: path.resolve(arg.slice(7)) }); await shoot(b.url, 'R1'); b.server.close(); }
cur.server.close();
