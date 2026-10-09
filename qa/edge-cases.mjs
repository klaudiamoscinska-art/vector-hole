// Edge-case / abuse bot-testers: broken saves, blocked storage, monkey
// clicking, pause/resize spam, clock tampering, HTML injection through the
// display name, and hostile challenge links. Usage: node qa/edge-cases.mjs
import fs from 'node:fs';
import path from 'node:path';
import { serve, openGame, veteranSave, report, ARENA_BOT, OUT } from './lib.mjs';

async function bootCase(url, name, opts) {
  const g = await openGame(url, opts);
  await g.page.waitForTimeout(400);
  const state = await g.page.evaluate(() => window.game.state);
  const r = report(name, g.errors.length === 0 && !!state, g.errors.slice(0, 2).join(' | ') || `state ${state}`);
  await g.browser.close();
  return r;
}

export async function runEdgeCases(url) {
  const results = [];

  // --- Boot robustness -------------------------------------------------
  const t0 = Date.now();
  {
    const g = await openGame(url);
    const ttiMs = await g.page.evaluate(() => performance.now());
    const welcome = await g.page.isVisible('#btnStartTutorial');
    results.push(report('boot: fresh save shows the one-tap start CTA', welcome, `ready in ${Math.round(ttiMs)} ms`));
    await g.page.screenshot({ path: path.join(OUT, 'first-screen.png') });
    // First-session funnel: a single tap must reach live gameplay.
    await g.page.click('#btnStartTutorial', { force: true });
    await g.page.waitForTimeout(300);
    const intro = await g.page.isVisible('#btnTutorialIntroStart');
    if (intro) await g.page.click('#btnTutorialIntroStart', { force: true });
    await g.page.waitForTimeout(300);
    const playing = await g.page.evaluate(() => window.game.state === GameState.PLAYING);
    results.push(report('ftue: ≤2 taps from first screen to gameplay', playing, intro ? '2 taps (intro card)' : '1 tap'));
    results.push(report('boot: no external network requests', g.external.length === 0, g.external.slice(0, 3).join(', ')));
    await g.browser.close();
  }
  results.push(await bootCase(url, 'save: corrupted JSON boots with a fresh profile', { save: '{not json' }));
  results.push(await bootCase(url, 'save: empty object {} boots', { save: '{}' }));
  results.push(await bootCase(url, 'save: legacy v1 save migrates', { save: { coins: 50, owned: ['rainbow'], selected: 'rainbow' } }));
  results.push(await bootCase(url, 'save: wrong types (strings/negatives) boot', { save: { schemaVersion: 10, coins: '9e99', prisms: -5, owned: 'x', settings: null } }));
  results.push(await bootCase(url, 'storage: localStorage throwing (private mode) boots', {
    initScript: () => {
      Storage.prototype.getItem = () => { throw new Error('denied'); };
      Storage.prototype.setItem = () => { throw new Error('denied'); };
    }
  }));

  // --- Veteran save: monkey test, pause/resize spam, injection ----------
  {
    const g = await openGame(url);
    const save = await veteranSave(g.page, { coins: 5000 });
    save.displayName = '<img src=x onerror="window.__xss=1">';
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.game.state);
    await g.page.addScriptTag({ content: ARENA_BOT });

    // Monkey: 400 random clicks on whatever is visible & enabled.
    await g.page.evaluate(async () => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      for (let i = 0; i < 400; i++) {
        const btns = [...document.querySelectorAll('button')].filter(b => !b.disabled && b.offsetParent !== null && !/Reset|reset/.test(b.id));
        if (!btns.length) { await sleep(20); continue; }
        btns[Math.floor(Math.random() * btns.length)].click();
        if (i % 10 === 0) await sleep(30);
      }
    });
    await g.page.waitForTimeout(500);
    results.push(report('monkey: 400 random taps across every screen, no errors', g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));

    // Pause/resume + resize spam mid-round.
    await g.page.evaluate(async () => {
      const gm = window.game;
      gm.hideAllOverlays();
      gm.startRound();
      for (let i = 0; i < 60; i++) {
        gm.togglePause();
        window.dispatchEvent(new Event('resize'));
        await new Promise(r => setTimeout(r, 10));
      }
      if (gm.paused) gm.resumeGame();
    });
    await g.page.setViewportSize({ width: 900, height: 420 });
    await g.page.waitForTimeout(300);
    await g.page.setViewportSize({ width: 420, height: 860 });
    const okPause = await g.page.evaluate(() => window.game.state === GameState.PLAYING && !window.game.paused);
    results.push(report('pause/resize spam: round still running cleanly', okPause && g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));

    // Play the round out and render the results (name goes into the DOM).
    await g.page.evaluate(() => { window.game.save.displayName = '<img src=x onerror="window.__xss=1">'; window.__qaPlayArena({ style: 'greedy' }); });
    await g.page.waitForTimeout(300);
    const xss = await g.page.evaluate(() => !!window.__xss);
    results.push(report('security: display name cannot inject HTML', !xss));
    await g.page.screenshot({ path: path.join(OUT, 'results.png') });

    // Clock tampering: claim the login reward, roll the clock forward a day,
    // claim, roll it back, and try to claim again.
    const clock = await g.page.evaluate(() => {
      const gm = window.game;
      const realNow = Date.now;
      const claims = [];
      const shift = (ms) => { const base = realNow(); Date.now = () => base + ms; const RD = Date; window.Date = class extends RD { constructor(...a) { super(...(a.length ? a : [Date.now()])); } static now() { return realNow() + ms; } }; };
      gm.save.login = { lastClaimDate: null, day: 0, totalClaims: 0 };
      const tryClaim = () => { const before = gm.save.login.totalClaims; gm.claimLoginReward(); claims.push(gm.save.login.totalClaims > before); };
      tryClaim();
      shift(26 * 3600e3); tryClaim();
      shift(52 * 3600e3); tryClaim();
      shift(0); tryClaim();
      shift(26 * 3600e3); tryClaim();
      return claims;
    });
    const exploitClaims = clock.slice(3).filter(Boolean).length;
    results.push(report('anti-cheat: clock rollback cannot re-farm login rewards', exploitClaims === 0, `claims: ${clock.join(',')}`));
    await g.browser.close();
  }

  // --- Hostile challenge link ------------------------------------------
  {
    const g = await openGame(url, { query: '?c=' + encodeURIComponent('<script>window.__xss2=1</script>.99999999.<b>x</b>') });
    await g.page.waitForTimeout(500);
    const bad = await g.page.evaluate(() => !!window.__xss2 || document.querySelector('b') !== null && document.querySelector('b').textContent === 'x');
    results.push(report('security: malformed challenge link is ignored safely', !bad && g.errors.length === 0, g.errors.slice(0, 2).join(' | ')));
    await g.browser.close();
  }

  console.log(`edge cases done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  fs.writeFileSync(path.join(OUT, 'edge-cases.json'), JSON.stringify(results, null, 2));
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const res = await runEdgeCases(url);
  server.close();
  process.exit(res.every(r => r.ok) ? 0 : 1);
}
