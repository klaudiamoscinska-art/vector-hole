// E1: the game boots -- the smoke test every modularization step runs first.
//  - the page loads, window.game is ready on the start screen (fresh
//    profile, Polish phone / English desktop) or the hub (a saved profile);
//  - no pageerror / console error;
//  - every file the page requests from the game's own server answers 200,
//    and those are exactly the runtime files readRuntimeSources() finds from
//    index.html (today index.html, style.css, game.js) -- nothing missing,
//    nothing extra (a new module that 404s or a stray dev file fails here);
//  - no request leaves the local server (zero third-party requests);
//  - the QA helpers this suite relies on (expectAll, seedFor) behave.
// Usage: node qa/boot.mjs
import { serve, openGame, veteranSave, report, expectAll, is, truthy, falsy, holds, seedFor, readRuntimeSources, environmentInfo } from './lib.mjs';

export async function runBootChecks(url) {
  const results = [];
  const runtime = readRuntimeSources();
  const expected = [runtime.html.path, ...runtime.files.map(f => f.path), ...runtime.missing].sort();
  const origin = new URL(url).origin;

  const boot = async (label, opts, prep) => {
    const g = await openGame(url, { ...opts, trackRequests: true });
    if (prep) await prep(g);
    // Let late loads (fonts are inline; canvases, timers) settle.
    await g.page.waitForTimeout(400);
    const st = await g.page.evaluate(() => ({
      ready: !!window.game && typeof window.game.update === 'function', state: window.game && window.game.state,
      screen: (document.querySelector('.screen:not(.hidden)') || {}).id || null, lang: document.documentElement.lang
    }));
    const own = g.requests.filter(r => r.url.startsWith(origin));
    const files = [...new Set(own.map(r => new URL(r.url).pathname.replace(/^\//, '') || 'index.html'))].sort();
    const bad = own.filter(r => r.status !== 200 && r.status !== 304);
    const other = g.requests.filter(r => !r.url.startsWith(origin) && !/^(data|blob):/.test(r.url));
    results.push(expectAll(`boot ${label}: the game starts (window.game ready, ${opts.expectState || 'MENU'}), no page errors`, {
      ready: truthy(st.ready), state: is(st.state, opts.expectState || 'MENU'), screen: holds(!!st.screen, st.screen, 'a visible screen'), errors: is(g.errors.length, 0)
    }, JSON.stringify({ ...st, errors: g.errors.slice(0, 2) })));
    results.push(expectAll(`boot ${label}: loads exactly the runtime files from index.html, all 200, nothing external`, {
      files: is(files.join(','), expected.join(',')), missingOnDisk: is(runtime.missing.join(','), ''), failed: is(bad.length, 0), external: is(g.external.length + other.length, 0)
    }, JSON.stringify({ files, missing: runtime.missing, bad: bad.slice(0, 3), external: [...g.external, ...other.map(r => r.url)].slice(0, 3) })));
    await g.browser.close();
  };

  await boot('fresh phone (pl-PL, 390×844)', { viewport: { width: 390, height: 844 } });
  await boot('fresh desktop (en-US, 1366×768)', { viewport: { width: 1366, height: 768 }, mobile: false, deviceScaleFactor: 1, locale: 'en-US' });
  await boot('saved profile, reload (pl-PL)', { viewport: { width: 390, height: 844 } }, async (g) => {
    const save = await veteranSave(g.page, { missions: 6, runsPlayed: 4, coins: 250 });
    await g.page.evaluate((s) => localStorage.setItem('vectorHoleSave_v1', JSON.stringify(s)), save);
    g.requests.length = 0;
    await g.page.reload();
    await g.page.waitForFunction(() => window.game && window.game.state);
    const kept = await g.page.evaluate(() => ({ coins: window.game.save.coins, done: Object.keys(window.game.save.campaign.completed).length, guard: SAVE_GUARD.state }));
    results.push(expectAll('boot saved profile: the save is read back as written (coins, missions, save guard ok)', {
      coins: is(kept.coins, 250), missions: is(kept.done, 6), guard: is(kept.guard, 'ok')
    }, JSON.stringify(kept)));
  });

  // The QA helpers themselves (node only): a FAIL must name each failed
  // field, a PASS must stay a plain report line; seeds must be stable.
  {
    const quiet = console.log; console.log = () => {};
    const pass = expectAll('x', { a: is(1, 1), b: truthy('y') }, 'ctx');
    const fail = expectAll('x', { a: is(1, 2), b: truthy(''), c: falsy(0) }, 'ctx');
    console.log = quiet;
    results.push(expectAll('qa helpers: expectAll keeps PASS as before and names every failed field on FAIL', {
      passOk: is(pass.ok, true), passDetails: is(pass.details, 'ctx'), failOk: is(fail.ok, false),
      failFields: is((fail.failures || []).map(f => f.field).join(','), 'a,b'), failDetails: holds(/^2\/3 failed \[a: got 1, want 2; b: got "", want truthy\] \| ctx$/.test(fail.details), fail.details, 'per-field details')
    }));
    results.push(report('qa helpers: seedFor is stable and separates scenarios', seedFor(7, 'M05', 'casual', 0) === seedFor(7, 'M05', 'casual', 0) && seedFor(7, 'M05', 'casual', 0) !== seedFor(7, 'M05', 'casual', 1) && seedFor(7, 'a') !== seedFor(8, 'a'), String(seedFor(7, 'M05', 'casual', 0))));
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server, url } = await serve();
  const env = await environmentInfo();
  console.log(`env: node ${env.node} · playwright ${env.playwright} · chromium ${env.chromium} · HEAD ${env.head} (${env.worktreeChanges} changed paths)`);
  const res = await runBootChecks(url);
  server.close();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} boot checks passed`);
  process.exit(failed.length ? 1 : 0);
}
