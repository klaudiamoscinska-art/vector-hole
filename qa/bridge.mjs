// E2: game.js runs as an ES module -- checks of the QA bridge (lib.mjs
// QA_BRIDGE) and of the module start itself. Dev-only.
//   node qa/bridge.mjs
// - the module starts once: one <script type="module" src="game.js">,
//   game.js fetched once, one Game, served as JavaScript;
// - the same boot as the classic script it replaced: listeners added (by
//   target and type; plus ADDED_SINCE_BASE), storage writes and the first screen match the base
//   commit's classic build (read from git, never written -- or from the
//   VH_QA_REVS snapshot, no git at all);
// - the bridge works on the module's live bindings: reads follow the
//   game's own writes (devBoot() -> SAVE_SLOT, attachCloudSave() /
//   clearCloudSave() -> SAVE_MIRROR), a QA write reaches the game
//   (saveGame() calls the mirror QA set), read-only names refuse writes;
// - game.js exports exactly the bridged names + their setters, and the
//   page the release script publishes (E3) loads it once as a module from
//   v/<id>/;
// - negative: without the bridge the names are really out of reach, and a
//   missing export, a setter that doesn't reach the game, a failed import
//   or a second copy of game.js each make the bridge fail loudly.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { serve, openGame, chromium, report, ROOT, OUT, QA_BRIDGE, QA_BRIDGE_NAMES, QA_BRIDGE_SETTERS, installQaBridge, revisionFile, isMain } from './lib.mjs';
import { devCodeToken } from './dev-code.mjs';

const BASE_REV = process.env.VH_E2_BASE || '63b50d0f470272aed8734c7854dda24b4f61e712';
// Listeners a later stage added on purpose (by target and type -> count):
// the module must boot with exactly the base's listeners plus these, so a
// doubled or lost one still fails. Add a stage's new listeners here.
const ADDED_SINCE_BASE = {
  // FTUE-2 (portal iframe input): cursor leaves the frame, no context menu
  // on the canvas, no iOS pinch zoom, pause on P/Space, the last pointer
  // target for scroll keys, the host page never scrolls, focus lost.
  'el:mouseleave': 1, 'el:contextmenu': 1, 'document:gesturestart': 1,
  'window:keydown': 1, 'window:pointerdown': 1, 'window:wheel': 1, 'window:blur': 1,
  // FTUE-2 FIX (real devices): re-measure after a turn once the app box
  // settles (an iPhone home-screen app's resize came too early).
  'window:orientationchange': 1,
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

/** game.js's export list (the one `export { ... };` statement) and any other export. */
function moduleExports(src) {
  const blocks = [...src.matchAll(/^export\s*\{([^}]*)\};?\s*$/gm)];
  const other = (src.match(/^export\s+(?!\{)/gm) || []).length;
  const names = blocks.flatMap(b => b[1].split(',').map(x => x.trim()).filter(Boolean));
  return { blocks: blocks.length, other, names };
}

/** Page with the bridge and a game.js rewritten by `edit` (negative checks). */
async function patchedPage(url, edit, init = null) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: 'pl-PL' });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  if (init) await context.addInitScript(init);
  await installQaBridge(context);
  if (edit) {
    await context.route(/\/game\.js$/, async (r) => {
      const res = await r.fetch();
      await r.fulfill({ response: res, body: edit(await res.text()) });
    });
  }
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => window.__qaBridge && (window.__qaBridge.ready || window.__qaBridge.error), null, { timeout: 15000 }).catch(() => {});
  return { browser, page, errors };
}

/** What a fresh boot does: listeners per target/type, storage writes,
 *  Game constructions, the first screen (no bridge in this page). */
const BOOT_PROBE = `(() => {
  const P = window.__bootProbe = { listeners: {}, writes: [], games: 0, timers: 0 };
  const kind = (t) => t === window ? 'window' : t === document ? 'document' : (t && t.nodeType === 1 ? 'el' : (t && t.constructor && t.constructor.name) || '?');
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) { const k = kind(this) + ':' + type; P.listeners[k] = (P.listeners[k] || 0) + 1; return add.call(this, type, fn, opts); };
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { P.writes.push(k); return set.call(this, k, v); };
  const si = window.setInterval;
  window.setInterval = function (...a) { P.timers++; return si.apply(this, a); };
  let g;
  Object.defineProperty(window, 'game', { configurable: true, get() { return g; }, set(v) { P.games++; g = v; } });
})();`;
/** The frozen classic pair (the base commit's game.js/style.css) for a dry run. */
function frozenDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-e3-frozen-'));
  for (const f of ['game.js', 'style.css']) fs.writeFileSync(path.join(dir, f), revisionFile(BASE_REV, f));
  return dir;
}
async function bootProfile(url) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: 'pl-PL', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await context.addInitScript(BOOT_PROBE);
  const errors = [];
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.game && window.game.state !== undefined, null, { timeout: 15000 });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const P = window.__bootProbe, el = document.querySelector('.screen:not(.hidden)');
    return { listeners: P.listeners, writes: P.writes, games: P.games, intervals: P.timers, devPanel: !!window.game.devPanel, state: window.game.state, screen: el && el.id, lang: document.documentElement.lang };
  });
  await browser.close();
  return { ...r, errors };
}

/** The base commit's runtime files (git show, read-only -- or the
 *  VH_QA_REVS snapshot, lib.mjs revisionFile()) on their own server. */
function serveBase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vh-e2-base-'));
  for (const f of ['index.html', 'style.css', 'game.js']) fs.writeFileSync(path.join(dir, f), revisionFile(BASE_REV, f));
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(dir, u === '/' ? 'index.html' : u);
      if (!file.startsWith(dir) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, dir, url: `http://127.0.0.1:${server.address().port}/index.html` }));
  });
}

export async function runBridgeChecks(url) {
  const results = [];
  const push = (name, ok, details) => results.push(report(name, ok, details));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');

  // ------------------------------------------------ static: tag + exports
  {
    const tags = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(m => m[0]);
    const ok = tags.length === 1 && /type="module"/.test(tags[0]) && /src="(\.\/)?game\.js"/.test(tags[0]);
    push('module: index.html loads game.js once, as <script type="module"> with a relative src (resolves under /vector-hole/ on Pages)', ok, tags.join(' '));
    // E3: the published page is not this file but the release script's
    // rewrite of it -- check that result (the script itself, in a dry run
    // on this worktree) instead of the old workflow's grep guards.
    const out = path.join(OUT, 'bridge-release-dryrun');
    fs.rmSync(out, { recursive: true, force: true });
    let built = null, err = null;
    const frozen = frozenDir();
    try {
      execFileSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', path.join(ROOT, '.github/scripts/assemble-release.mjs'), 'assemble', '--source', 'worktree', '--repo', ROOT, '--id', 'bridgecheck', '--frozen-dir', frozen, '--no-live-anchor', '--out', out], { stdio: ['ignore', 'pipe', 'pipe'] });
      const rel = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
      built = [...rel.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(m => m[0]);
    } catch (e) { err = String(e.stderr || e.message).trim().split('\n')[0]; }
    fs.rmSync(frozen, { recursive: true, force: true });
    push('module: the release script turns index.html into exactly one <script type="module"> loading v/<id>/game.js (the published page, E3)', !!built && built.length === 1 && /type="module"/.test(built[0]) && /src="v\/bridgecheck\/game\.js"/.test(built[0]), JSON.stringify(built || err));
    const ex = moduleExports(src);
    const want = [...QA_BRIDGE_NAMES, ...Object.values(QA_BRIDGE_SETTERS)].sort();
    const got = [...ex.names].sort();
    const extra = got.filter(n => !want.includes(n)), missing = want.filter(n => !got.includes(n));
    push(`module: game.js exports exactly the bridged names + setters (${want.length}), in one export list, nothing else`, ex.blocks === 1 && ex.other === 0 && !extra.length && !missing.length, JSON.stringify({ count: got.length, extra, missing, otherExports: ex.other }));
  }

  // ------------------------------------------------ the module starts once
  {
    const g = await openGame(url, { trackRequests: true });
    await g.page.waitForTimeout(500);
    const r = await g.page.evaluate(() => ({
      bridge: { ...window.__qaBridge },
      modules: document.querySelectorAll('script[type="module"][src]').length,
      classic: document.querySelectorAll('script[src]:not([type="module"])').length,
      gameLoads: performance.getEntriesByType('resource').filter(e => new URL(e.name).pathname.endsWith('/game.js') && !/^(fetch|xmlhttprequest)$/.test(e.initiatorType)).length,
      state: window.game.state, devPanel: !!window.game.devPanel
    }));
    const gameReq = g.requests.filter(x => /\/game\.js(\?|$)/.test(x.url));
    push('module: one module script, game.js requested once (200), bridge in module mode, ready before the load event', r.modules === 1 && r.classic === 0 && r.gameLoads === 1 && gameReq.length === 1 && gameReq[0].status === 200 && r.bridge.mode === 'module' && r.bridge.ready && r.bridge.installedBeforeLoad === true && !r.bridge.error && r.bridge.names === QA_BRIDGE_NAMES.length, JSON.stringify({ ...r, gameReq }));
    const mime = await g.page.evaluate(async (u) => (await fetch(u, { method: 'HEAD' })).headers.get('content-type'), url.replace('index.html', 'game.js'));
    push('module: game.js is served as JavaScript (module scripts need a JS MIME type)', /^(text|application)\/javascript\b/.test(mime || ''), mime);

    // Every bridged name reads the module's own binding (same instance).
    const same = await g.page.evaluate(async (names) => {
      const ns = await import(window.__qaBridge.src);
      const differ = names.filter(n => window[n] !== ns[n]);
      const loads = performance.getEntriesByType('resource').filter(e => new URL(e.name).pathname.endsWith('/game.js') && !/^(fetch|xmlhttprequest)$/.test(e.initiatorType)).length;
      return { differ, loads };
    }, QA_BRIDGE_NAMES);
    push('bridge: every bridged name is the module\'s own binding, and importing the page\'s URL again evaluates nothing (still one load)', same.differ.length === 0 && same.loads === 1, JSON.stringify(same));

    // A QA write reaches the game; the game's own writes reach QA.
    const live = await g.page.evaluate(() => {
      const gm = window.game, out = {};
      const calls = [];
      const fn = (sealed) => calls.push(sealed);
      SAVE_MIRROR = fn;
      out.readBack = SAVE_MIRROR === fn;
      saveGame(gm.save);
      out.mirroredOnce = calls.length === 1 && calls[0] === localStorage.getItem('vectorHoleSave_v1');
      SAVE_MIRROR = null;
      saveGame(gm.save);
      out.offAfterNull = calls.length === 1 && SAVE_MIRROR === null;
      // The game's own writes (attachCloudSave / clearCloudSave) seen live.
      const cloud = [];
      gm.monetization.sdk = { data: { getItem: () => null, setItem: (k, v) => cloud.push(k), removeItem: () => {} } };
      gm.monetization.attachCloudSave();
      out.gameSet = typeof SAVE_MIRROR === 'function' && SAVE_MIRROR !== fn;
      saveGame(gm.save);
      out.cloudWrites = cloud.length;
      gm.monetization.clearCloudSave();
      out.gameCleared = SAVE_MIRROR === null;
      gm.monetization.sdk = null;
      // Read-only names refuse a write and stay the game's.
      const cfg = CONFIG;
      try { CONFIG = {}; out.readOnly = 'no throw'; } catch (e) { out.readOnly = e instanceof TypeError ? 'TypeError' : String(e); }
      out.configKept = CONFIG === cfg;
      // A mutation through a bridged object is the game's object.
      const d0 = CONFIG.ads.demoSeconds; CONFIG.ads.demoSeconds = 0.25; out.sharedObject = window.game && CONFIG.ads.demoSeconds === 0.25; CONFIG.ads.demoSeconds = d0;
      return out;
    });
    push('bridge: SAVE_MIRROR set by QA reaches saveGame(), null switches it off, the game\'s own attachCloudSave()/clearCloudSave() are seen live (no stale copy)', live.readBack && live.mirroredOnce && live.offAfterNull && live.gameSet && live.cloudWrites >= 2 && live.gameCleared, JSON.stringify(live));
    push('bridge: read-only names refuse assignment (TypeError) and keep the game\'s value', live.readOnly === 'TypeError' && live.configKept, JSON.stringify(live));
    push('module: no runtime errors', g.errors.length === 0, g.errors.slice(0, 3).join(' | '));
    await g.browser.close();
  }

  // SAVE_SLOT is a `let` the game reassigns in devBoot(): the bridge must
  // show the reassigned value (test mode -> the sandbox slot), not the first.
  {
    const tok = devCodeToken('dev');
    const init = `if (!sessionStorage.getItem('__e2dev')) { localStorage.setItem('vectorHoleDevAccess_v1', ${JSON.stringify(tok)}); localStorage.setItem('vectorHoleDevState_v1', JSON.stringify({ sandbox: true })); sessionStorage.setItem('__e2dev', '1'); }`;
    const g = await openGame(url, { initScript: init });
    const r = await g.page.evaluate(() => ({ slot: SAVE_SLOT, sandbox: DEV.sandbox, key: DEV_SANDBOX_SAVE_KEY }));
    push('bridge: SAVE_SLOT reads the value devBoot() assigned at run time (test mode -> sandbox slot)', r.sandbox === true && r.slot === r.key && r.slot === 'vectorHoleSave_devSandbox_v1', JSON.stringify(r));
    await g.browser.close();
  }

  // ------------------------------------------------ same boot as the classic base
  {
    const base = await serveBase();
    const a = await bootProfile(base.url);
    const b = await bootProfile(url);
    base.server.close();
    fs.rmSync(base.dir, { recursive: true, force: true });
    const keys = [...new Set([...Object.keys(a.listeners), ...Object.keys(b.listeners), ...Object.keys(ADDED_SINCE_BASE)])].sort();
    const want = (k) => (a.listeners[k] || 0) + (ADDED_SINCE_BASE[k] || 0);
    const diff = keys.filter(k => (b.listeners[k] || 0) !== want(k)).map(k => `${k}: base ${a.listeners[k] || 0} + added ${ADDED_SINCE_BASE[k] || 0}, module ${b.listeners[k] || 0}`);
    push(`boot: one Game, one dev panel, same first screen/state/language as the classic base (${BASE_REV.slice(0, 7)})`, a.games === 1 && b.games === 1 && b.devPanel && a.state === b.state && a.screen === b.screen && a.lang === b.lang, JSON.stringify({ base: { games: a.games, state: a.state, screen: a.screen, lang: a.lang }, module: { games: b.games, state: b.state, screen: b.screen, lang: b.lang } }));
    push('boot: the same event listeners (per target and type) as the classic base plus the ones declared since -- none doubled or lost', diff.length === 0, diff.length ? diff.join('; ') : `${keys.length} kinds, ${Object.values(b.listeners).reduce((s, n) => s + n, 0)} listeners`);
    push('boot: the same storage writes and intervals as the classic base', JSON.stringify(a.writes) === JSON.stringify(b.writes) && a.intervals === b.intervals, JSON.stringify({ base: a.writes, module: b.writes, intervals: [a.intervals, b.intervals] }));
    push('boot: no page errors (base and module)', !a.errors.length && !b.errors.length, [...a.errors, ...b.errors].slice(0, 3).join(' | '));
  }

  // ------------------------------------------------ negative checks
  {
    // Without the bridge the module scope is really closed: a suite that
    // lost its bridge crashes on a ReferenceError instead of passing.
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(url);
    await page.waitForFunction(() => window.game && window.game.state !== undefined, null, { timeout: 15000 });
    const r = await page.evaluate(() => {
      let err = null;
      try { CONFIG; } catch (e) { err = e.name; }
      return { err, t: typeof CONFIG, w: 'CONFIG' in window, s: typeof saveGame };
    });
    push('negative: without the bridge the game\'s names are out of reach (ReferenceError, nothing on window)', r.err === 'ReferenceError' && r.t === 'undefined' && !r.w && r.s === 'undefined', JSON.stringify(r));
    await browser.close();
  }
  {
    const n = await patchedPage(url, s => s.replace(/(^export\s*\{[^}]*?)\bCONFIG,\s*/m, '$1'));
    const r = await n.page.evaluate(() => { let err = null; try { CONFIG; } catch (e) { err = e.name; } return { error: window.__qaBridge.error, ready: window.__qaBridge.ready, err }; });
    push('negative: a missing export fails the bridge by name (not ready, console error, the name stays undefined)', !r.ready && /does not export: CONFIG\b/.test(r.error || '') && r.err === 'ReferenceError' && n.errors.some(e => /QA bridge/.test(e)), JSON.stringify(r));
    await n.browser.close();
  }
  {
    const n = await patchedPage(url, s => s.replace(/function setSaveMirror\(fn\) \{[^}]*\}/, 'function setSaveMirror(fn) { /* broken */ }'));
    const r = await n.page.evaluate(() => { let err = null; try { SAVE_MIRROR = () => {}; } catch (e) { err = e.message; } return { ready: window.__qaBridge.ready, err, after: SAVE_MIRROR }; });
    push('negative: a setter that does not reach the game throws on assignment', r.ready && /did not reach the game/.test(r.err || '') && r.after === null, JSON.stringify(r));
    await n.browser.close();
  }
  {
    const n = await patchedPage(url, null, `window.__qaBridgeImportOverride = location.origin + '/qa-missing-module.js';`);
    const r = await n.page.evaluate(() => ({ error: window.__qaBridge.error, ready: window.__qaBridge.ready, game: !!window.game }));
    push('negative: a failed import fails the bridge (error, not ready)', !r.ready && /import of .* failed|not ready at the load event/.test(r.error || ''), JSON.stringify(r));
    await n.browser.close();
  }
  {
    const n = await patchedPage(url, null, `window.__qaBridgeImportOverride = location.origin + '/game.js?second-instance';`);
    const r = await n.page.evaluate(() => ({ error: window.__qaBridge.error, ready: window.__qaBridge.ready }));
    push('negative: a second copy of game.js (another URL = another module instance) fails the bridge', !r.ready && /loaded 2 times/.test(r.error || ''), JSON.stringify(r));
    await n.browser.close();
  }
  {
    // A classic page (no module script) keeps its own globals: mode classic.
    const base = await serveBase();
    const n = await patchedPage(base.url, null);
    const r = await n.page.evaluate(() => ({ mode: window.__qaBridge.mode, ready: window.__qaBridge.ready, guard: typeof SAVE_GUARD, desc: !!Object.getOwnPropertyDescriptor(window, 'SAVE_GUARD') }));
    push('bridge: on a classic build (the base release) it installs nothing and the real globals answer', r.mode === 'classic' && r.ready && r.guard === 'object' && !r.desc, JSON.stringify(r));
    await n.browser.close();
    base.server.close();
    fs.rmSync(base.dir, { recursive: true, force: true });
  }
  return results;
}

if (isMain(import.meta.url)) {
  const { server, url } = await serve();
  const results = await runBridgeChecks(url);
  server.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} bridge checks passed`);
  process.exit(failed ? 1 : 0);
}
