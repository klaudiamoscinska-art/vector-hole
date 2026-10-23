// Shared helpers for the Vector Hole QA bots (dev-only, not shipped by the
// game; which files the game runs from is read from index.html by
// readRuntimeSources() -- today index.html/style.css/game.js).
// Uses the Playwright install already on the machine (no package.json):
//   node qa/run-all.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const PLAYWRIGHT_TRIES = ['playwright', '/opt/node22/lib/node_modules/playwright'];
function loadPlaywright() {
  for (const t of PLAYWRIGHT_TRIES) { try { return require(t); } catch (e) { /* next */ } }
  throw new Error('Playwright not found: install it globally (npm i -g playwright).');
}
export const { chromium } = loadPlaywright();

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(ROOT, 'qa', 'out');
fs.mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

/** Static server on a random port: the repo root by default (as before).
 *  E3 (qa/release.mjs): `root` serves another folder (an assembled release),
 *  `prefix` mounts it under a path like GitHub Pages' /vector-hole/,
 *  `cacheControl` adds that header (Pages sends max-age=600), and the
 *  returned setRoot() swaps the folder mid-test (a deploy); `log` lists
 *  every request path the server saw. */
export function serve({ root = ROOT, prefix = '', cacheControl = null } = {}) {
  let dir = root;
  const log = [];
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let url = decodeURIComponent(req.url.split('?')[0]);
      log.push(url);
      if (prefix) { if (!url.startsWith(prefix + '/')) { res.writeHead(404); res.end(); return; } url = url.slice(prefix.length); }
      const file = path.join(dir, url === '/' ? 'index.html' : url);
      if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      const headers = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' };
      if (cacheControl) headers['Cache-Control'] = cacheControl;
      res.writeHead(200, headers);
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}${prefix}/index.html`, setRoot: (d) => { dir = d; }, log }));
  });
}

/* ---------- E3: reading an earlier revision without (or with) git ----------
   Some suites compare against an earlier commit's runtime files (bridge:
   the classic base; px02 LEGACY-06: the previous release). By default they
   come from `git show REV:FILE` (read-only). With VH_QA_REVS=DIR set, QA
   runs no git at all: the files are read from DIR/<full sha>/<file> (a
   snapshot prepared and checked by the person running the suite), and
   environmentInfo() reports the offline mode instead of git HEAD. */
export const QA_REVS = process.env.VH_QA_REVS || null;
export function revisionFile(rev, file) {
  if (QA_REVS) {
    const p = path.join(QA_REVS, rev, file);
    if (!fs.existsSync(p)) throw new Error(`offline revision ${rev.slice(0, 12)}:${file} not in VH_QA_REVS (${QA_REVS})`);
    return fs.readFileSync(p);
  }
  return execSync(`git -C "${ROOT}" show ${rev}:${file}`, { maxBuffer: 64 << 20 });
}

/* ---------- E2: QA bridge (game.js is an ES module) ----------
   The suites read the game's top-level names bare inside the page
   (`CONFIG.ads...`, `defaultSave()`, `SAVE_GUARD.state`, `SAVE_MIRROR = fn`).
   A classic script made every top-level const/let/class/function visible to
   later scripts; a module keeps them in its own scope. game.js exports just
   the names below (and one setter), and this init script (QA only -- it is
   installed by openGame() and the suites' own contexts, never shipped) puts
   each on `window` as an accessor over the module's live binding:
   - get: reads `ns[name]` every time (live -- SAVE_SLOT after devBoot(),
     SAVE_MIRROR after attachCloudSave(), never a copy);
   - set: only for QA_BRIDGE_SETTERS (SAVE_MIRROR -> setSaveMirror()), and it
     re-reads the binding afterwards, so a setter that doesn't reach the game
     throws; any other name is read-only and an assignment throws.
   It imports the exact URL of the page's own <script type="module"> (the
   same module-map entry: no second evaluation, no second Game), from an
   inline module script added at DOMContentLoaded (after game.js has run)
   which holds the load event, so the bridge is ready before page.goto() /
   page.reload() return. A missing export, a failed import, a second copy of
   game.js or a bridge not ready at `load` sets __qaBridge.error and logs a
   console error (the suites' "no runtime errors" checks see it); openGame()
   throws on it. A page without a module script (the previous release in
   px02's LEGACY-06) keeps its real classic globals: mode 'classic'. */
export const QA_BRIDGE_NAMES = [
  'AD_PLACEMENTS', 'AURAS', 'CAMPAIGN_MISSIONS', 'CONFIG', 'CampaignEntity', 'DEV', 'DEV_CODE_HASH', 'DEV_SANDBOX_SAVE_KEY',
  'DISTRICTS', 'DISTRICT_COLORS', 'DISTRICT_STORY', 'DISTRICT_THEME', 'EAT_EFFECTS', 'FEATURE_GATES', 'GAMEPLAY_TRACK_IDS',
  'GameState', 'I18N', 'IAP_PRODUCTS', 'LANDMARK_SIGNS', 'MENU_TRACK_IDS', 'MISSION_BOOSTERS', 'MISSION_BOT_TIME',
  'MUSIC_TRACKS', 'MUSIC_TRACK_BY_ID', 'OVERDRIVE_SKINS', 'SAVE_GUARD', 'SAVE_MIRROR', 'SAVE_SLOT', 'SCREEN_FLOOR', 'SKINS',
  'SeededRNG', 'SoundEngine', 'TIERS', 'WORLD_H', 'WORLD_W', 'campaignMissionById', 'canEatWorldObjectTier', 'clamp',
  'compileSong', 'decodeChallenge', 'decodeSaveCode', 'defaultSave', 'devIsLoopback', 'districtLandmarkId',
  'encodeChallenge', 'encodeSaveCode', 'formatClock', 'getSizeTierIndex', 'loadSave', 'migrateSave', 'missionCode',
  'rankHoles', 'sanitizeSave', 'saveGame', 'sealSave', 'unitsForRadius', 'unlockedFeatureIds'
];
/** Bridged names a suite assigns to, and the game.js export that sets each. */
export const QA_BRIDGE_SETTERS = { SAVE_MIRROR: 'setSaveMirror' };
function qaBridgeInit(names, setters) {
  if (window.__qaBridge) return;
  const state = { ready: false, mode: null, error: null, src: null, names: names.length, installedBeforeLoad: null };
  Object.defineProperty(window, '__qaBridge', { value: state });
  const fail = (msg) => { if (!state.error) { state.error = msg; console.error('QA bridge: ' + msg); } };
  window.addEventListener('load', () => { if (!state.ready) fail('not ready at the load event'); });
  document.addEventListener('DOMContentLoaded', () => {
    const mods = document.querySelectorAll('script[type="module"][src]');
    if (!mods.length) { state.mode = 'classic'; state.ready = true; return; }
    if (mods.length !== 1) { fail(mods.length + ' module scripts in the page, expected 1'); return; }
    const src = state.src = window.__qaBridgeImportOverride || mods[0].src;
    const path = new URL(mods[0].src).pathname;
    Object.defineProperty(window, '__qaBridgeInstall', { configurable: true, value: (ns) => {
      try {
        const loads = performance.getEntriesByType('resource').filter(e => new URL(e.name).pathname === path && !/^(fetch|xmlhttprequest)$/.test(e.initiatorType)).length;
        if (loads !== 1) { fail(path + ' loaded ' + loads + ' times (a second module instance)'); return; }
        const missing = names.filter(n => !(n in ns));
        if (missing.length) { fail('game.js does not export: ' + missing.join(', ')); return; }
        const noSetter = Object.keys(setters).filter(n => typeof ns[setters[n]] !== 'function');
        if (noSetter.length) { fail('game.js has no setter export for: ' + noSetter.join(', ')); return; }
        for (const n of names) {
          Object.defineProperty(window, n, {
            configurable: true, enumerable: false,
            get() { return ns[n]; },
            set(v) {
              if (!setters[n]) throw new TypeError('QA bridge: ' + n + ' is read-only (game.js has no setter for it)');
              ns[setters[n]](v);
              if (ns[n] !== v) throw new Error('QA bridge: setting ' + n + ' did not reach the game');
            }
          });
        }
        state.mode = 'module';
        state.installedBeforeLoad = document.readyState !== 'complete';
        state.ready = true;
      } catch (e) { fail('install failed: ' + (e && e.message || e)); }
    } });
    const s = document.createElement('script');
    s.type = 'module';
    s.textContent = 'import * as ns from ' + JSON.stringify(src) + '; window.__qaBridgeInstall(ns);';
    s.addEventListener('error', () => fail('import of ' + src + ' failed'));
    document.head.appendChild(s);
  });
}
export const QA_BRIDGE = `(${qaBridgeInit})(${JSON.stringify(QA_BRIDGE_NAMES)}, ${JSON.stringify(QA_BRIDGE_SETTERS)});`;
/** Adds the bridge to a browser context (before its first page). */
export async function installQaBridge(context) { await context.addInitScript(QA_BRIDGE); }
/** Waits for the bridge on a page whose game is up; throws on its error. */
export async function waitForQaBridge(page, timeout = 15000) {
  await page.waitForFunction(() => window.__qaBridge && (window.__qaBridge.ready || window.__qaBridge.error), null, { timeout });
  const err = await page.evaluate(() => window.__qaBridge.error);
  if (err) throw new Error('QA bridge: ' + err);
}

/** Launch Chromium + a page that records console errors and page errors.
 *  External requests (Google Fonts etc.) are blocked so runs are offline
 *  and deterministic; `allowExternal` lets the network test opt back in. */
export async function openGame(baseUrl, { save = null, viewport = { width: 420, height: 860 }, mobile = true, query = '', allowExternal = false, initScript = null, deviceScaleFactor = 2, locale = 'pl-PL', trackRequests = false } = {}) {
  const browser = await chromium.launch();
  // v19: the game picks its language from the browser -- the suites assert
  // Polish copy, so they run as a Polish browser unless told otherwise.
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor, locale });
  await installQaBridge(context);
  const errors = [];
  const external = [];
  if (!allowExternal) {
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => { external.push(route.request().url()); route.abort(); });
  }
  if (save) {
    await context.addInitScript((s) => {
      if (!sessionStorage.getItem('__qaSeeded')) {
        localStorage.setItem('vectorHoleSave_v1', typeof s === 'string' ? s : JSON.stringify(s));
        sessionStorage.setItem('__qaSeeded', '1');
      }
    }, save);
  }
  if (initScript) await context.addInitScript(initScript);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  // E1 (qa/boot.mjs): every request the page made, with its HTTP status or
  // failure -- the "Failed to load resource" console lines filtered above.
  const requests = [];
  if (trackRequests) {
    page.on('requestfinished', async (r) => { const res = await r.response().catch(() => null); requests.push({ url: r.url(), status: res ? res.status() : 0 }); });
    page.on('requestfailed', (r) => requests.push({ url: r.url(), status: 0, failed: (r.failure() || {}).errorText || 'failed' }));
  }
  await page.goto(baseUrl + query);
  await page.waitForFunction(() => window.game && window.game.state !== undefined, null, { timeout: 15000 });
  await waitForQaBridge(page);
  return { browser, context, page, errors, external, requests };
}

/** A save that has played both modes (the first districts' worth of
 *  missions), so every hub feature (Warsztat, Wyzwania) is unlocked and the
 *  first-round coach hints are already learned. */
export async function veteranSave(page, overrides = {}) {
  return page.evaluate((o) => {
    const s = defaultSave();
    // v14: completed in district (play) order, with every district whose
    // predecessor's boss is cleared unlocked -- a real save, not the
    // CAMPAIGN_MISSIONS array order (which left Plac done but Park locked).
    const ids = DISTRICTS.flatMap(d => d.missions).slice(0, o.missions || 6);
    ids.forEach(id => { s.campaign.completed[id] = true; });
    DISTRICTS.forEach((d, i) => { if (i > 0 && s.campaign.completed[DISTRICTS[i - 1].missions[DISTRICTS[i - 1].missions.length - 1]] && !s.campaign.unlockedDistricts.includes(d.id)) s.campaign.unlockedDistricts.push(d.id); });
    s.stats.runsPlayed = o.runsPlayed || 0;
    // v22: Wyzwania opens after Arena rounds -- a veteran has it either way.
    s.unlocks.announced = Array.from(new Set([...unlockedFeatureIds(s), 'warsztat', 'wyzwania', 'kampania']));
    s.coach = { moved: true, ate: true, rival: true, danger: true };
    s.login.lastClaimDate = new Date().toISOString().slice(0, 10);
    s.coins = o.coins || 0;
    // QA saves are pre-consented so the consent sheet doesn't block flows.
    s.privacy = { decided: true, analytics: false, ads: false, ts: Date.now() };
    return s;
  }, overrides);
}

export function report(name, ok, details) {
  const line = `${ok ? 'PASS' : 'FAIL'}  ${name}${details ? '  — ' + details : ''}`;
  console.log(line);
  return { name, ok, details };
}

/* ---------- E1: per-field assertions (expectAll) ----------
   One report() line per check, exactly like report(), but every condition
   is named, and a FAIL lists each one that did not hold with what it got
   (and what it wanted), ahead of the usual JSON context:
     results.push(expectAll('save v12 -> v13 ...', {
       schemaVersion: is(r.v, 13),     // strict ===, like the old `r.v === 13`
       wyzwania: truthy(r.wyz),        // like the old `r.wyz &&`
       energy: falsy(r.energy),        // like the old `!r.energy`
       announced: matches(/kampania/, r.announced),
     }, JSON.stringify(r)));
   PASS is still "all of them hold" -- the conditions are the old && terms,
   one per field, so a converted check passes and fails exactly as before. */
const fmt = (v) => { if (typeof v === 'string') return JSON.stringify(v.length > 80 ? v.slice(0, 77) + '...' : v); try { const j = JSON.stringify(v); return j === undefined ? String(v) : (j.length > 80 ? j.slice(0, 77) + '...' : j); } catch (e) { return String(v); } };
export const is = (actual, expected) => ({ ok: actual === expected, actual, want: fmt(expected) });
export const truthy = (actual) => ({ ok: !!actual, actual, want: 'truthy' });
export const falsy = (actual) => ({ ok: !actual, actual, want: 'falsy' });
export const matches = (re, actual) => ({ ok: re.test(actual), actual, want: String(re) });
export const notMatches = (re, actual) => ({ ok: !re.test(actual), actual, want: 'not ' + String(re) });
export const holds = (ok, actual, want) => ({ ok: !!ok, actual, want: want || 'condition' });
export function expectAll(name, checks, context) {
  const entries = Object.entries(checks);
  const failures = entries.filter(([, c]) => !c.ok).map(([field, c]) => ({ field, actual: c.actual, want: c.want }));
  const ok = failures.length === 0;
  const why = failures.map(f => `${f.field}: got ${fmt(f.actual)}, want ${f.want}`).join('; ');
  const details = ok ? context : `${failures.length}/${entries.length} failed [${why}]${context ? ' | ' + context : ''}`;
  const r = report(name, ok, details);
  if (!ok) r.failures = failures;
  return r;
}

/* ---------- E1: reproducible randomness (opt-in, per scenario) ----------
   The game draws everything mid-round from Math.random() (and a mission's
   layout too); the bots add their own draws. QA_RANDOM installs, in the
   page, __qaSeedRandom(seed): Math.random becomes a mulberry32 stream from
   that seed (and counts its draws in __qaRandomCalls), __qaRestoreRandom()
   puts the browser's back. Nothing changes until a test calls it, and a
   test that wants a reproducible attempt reseeds right before it, inside
   the same page.evaluate (menu animations keep drawing between calls). */
export const QA_RANDOM = `
(function () {
  if (window.__qaSeedRandom) return;
  const native = Math.random;
  window.__qaSeedRandom = function (seed) {
    let a = seed >>> 0;
    window.__qaRandomSeed = a;
    window.__qaRandomCalls = 0;
    Math.random = function () {
      window.__qaRandomCalls++;
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  window.__qaRestoreRandom = function () { Math.random = native; window.__qaRandomSeed = null; };
})();
`;
/** A frozen wall clock for the page (Date.now() and new Date() without
 *  arguments always return `iso`); only for scenarios that need the save's
 *  dates, ids and timestamps to repeat (qa/trace.mjs). */
export function frozenDateScript(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) throw new Error('frozenDateScript: bad date ' + iso);
  return `(function () { const FIX = ${t}; const D = Date; class QADate extends D { constructor(...a) { if (a.length) super(...a); else super(FIX); } static now() { return FIX; } } window.Date = QADate; })();`;
}
/** Derives a 32-bit seed from a base seed and the scenario's parts
 *  (FNV-1a), so every attempt has its own reproducible stream. */
export function seedFor(base, ...parts) {
  let h = 0x811c9dc5;
  for (const ch of [base, ...parts].join('|')) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
/** The base seed of a seeded suite: `--seed=N` or VH_QA_SEED=N replays a
 *  run; otherwise a fresh random one (and the suite prints it), so a normal
 *  run still samples new layouts every time. */
export function baseSeed(argv = process.argv) {
  const arg = argv.find(a => /^--seed=\d+$/.test(a));
  const raw = arg ? arg.slice(7) : process.env.VH_QA_SEED;
  if (raw != null && raw !== '') return { seed: Number(raw) >>> 0, fixed: true };
  return { seed: crypto.randomInt(1, 2 ** 31), fixed: false };
}

/* ---------- E1: runtime sources and environment ----------
   readRuntimeSources(): the files the game really runs from, discovered
   from index.html (local <script src> / <link rel="stylesheet" href>) and,
   for JS, the relative static/dynamic imports they reach -- so a source
   scan keeps covering all of the game when game.js is split into ES
   modules, and never picks up qa/, docs/, design/ or .claude/ files (only
   what index.html loads). Absolute or external URLs are listed in
   `skipped`, not read; a referenced file that isn't on disk is listed in
   `missing` (qa/boot.mjs and the v22 scan fail on it) instead of throwing. */
export function readRuntimeSources(root = ROOT) {
  const htmlPath = path.join(root, 'index.html');
  const html = { path: 'index.html', kind: 'html', text: fs.readFileSync(htmlPath, 'utf8') };
  const files = [], skipped = [], missing = [], seen = new Set();
  const local = (ref) => !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref) && !ref.startsWith('/');
  const add = (rel, kind) => {
    const clean = rel.split(/[?#]/)[0];
    const norm = path.posix.normalize(clean).replace(/^\.\//, '');
    if (seen.has(norm)) return;
    seen.add(norm);
    const abs = path.join(root, norm);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) { missing.push(norm); return; }
    const text = fs.readFileSync(abs, 'utf8');
    files.push({ path: norm, kind, text });
    if (kind !== 'js') return;
    const re = /(?:\bimport\s*(?:[\w*{}\s,$]+\s*from\s*)?|\bexport\s*[\w*{}\s,$]+\s*from\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(text))) {
      if (!m[1].startsWith('.')) { skipped.push(m[1]); continue; }
      add(path.posix.join(path.posix.dirname(norm), m[1]), 'js');
    }
  };
  for (const m of html.text.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)) { if (local(m[1])) add(m[1], 'js'); else skipped.push(m[1]); }
  for (const m of html.text.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)) {
    const href = (/\bhref="([^"]+)"/.exec(m[0]) || [])[1];
    if (href && local(href)) add(href, 'css'); else if (href) skipped.push(href);
  }
  const js = files.filter(f => f.kind === 'js'), css = files.filter(f => f.kind === 'css');
  return { html, files, js, css, skipped, missing, jsText: js.map(f => f.text).join('\n'), cssText: css.map(f => f.text).join('\n') };
}
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
/** Where and on what a QA run happened: Node, Playwright, Chromium (needs
 *  a browser), git HEAD + whether the worktree has changes (not read in
 *  the VH_QA_REVS offline mode), and the SHA-256 of every runtime file
 *  (readRuntimeSources()). */
export async function environmentInfo(browser = null, root = ROOT) {
  const git = (cmd) => { if (QA_REVS) return null; try { return execSync(`git -C "${root}" ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { return null; } };
  let playwright = null;
  for (const t of PLAYWRIGHT_TRIES) { try { playwright = require(t + '/package.json').version; break; } catch (e) { /* next */ } }
  let chromiumVersion = null;
  if (browser) chromiumVersion = browser.version();
  else { const b = await chromium.launch(); chromiumVersion = b.version(); await b.close(); }
  const src = readRuntimeSources(root);
  const status = git('status --porcelain');
  return {
    node: process.version, playwright, chromium: chromiumVersion,
    head: QA_REVS ? 'NOT VERIFIED (VH_QA_REVS offline mode, no git)' : git('rev-parse HEAD'), worktreeChanges: status == null ? null : status.split('\n').filter(Boolean).length,
    runtime: Object.fromEntries([src.html, ...src.files].map(f => [f.path, sha256(fs.readFileSync(path.join(root, f.path)))])),
    missingRuntimeFiles: src.missing,
    platform: `${process.platform} ${process.arch}`, at: new Date().toISOString()
  };
}

/** In-page greedy bot for Arena: flees bigger rivals, hunts smaller ones,
 *  otherwise heads for the best-value eatable object. Drives game.update()
 *  in virtual time (the RAF loop is stopped) so a 2-minute round runs in
 *  well under a second of wall time. Returns the round summary. */
export const ARENA_BOT = `
window.__qaPlayArena = function (opts) {
  opts = opts || {};
  const g = window.game;
  const dt = opts.dt || 1 / 30;
  const style = opts.style || 'greedy';
  // Virtual clock: wall-time timers (invulnerability, run tools, hit-stop)
  // advance with the simulated frames, not with real time.
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  // E1: opts.clock0 pins where the virtual clock starts (reproducible runs,
  // qa/trace.mjs); without it the clock starts at the real time as before.
  let vnow = opts.clock0 != null ? opts.clock0 : realNow();
  performance.now = () => vnow;
  if (opts.gfx != null) g.applyGfx(opts.gfx);
  g.startRound(opts.round || {});
  if (g.rafId) cancelAnimationFrame(g.rafId);
  g.running = false; // detach the RAF loop; we tick manually
  const p = g.player;
  let frames = 0, maxUpdateMs = 0, totalUpdateMs = 0, renderMs = 0, renders = 0, deaths = 0, lastR = p.radius;
  // v13 first-seconds metrics: when the first pickup lands and how many
  // land in the first 10 s (score increments ~ eats).
  let firstEatSec = null, eats10 = 0, lastScore = 0;
  let wanderA = Math.random() * 6.28;
  const steer = () => {
    if (style === 'afk') { g.keyDir = { x: 0, y: 0 }; g.pointerWorld = { x: p.x, y: p.y }; return; }
    if (style === 'random') { wanderA += (Math.random() - 0.5) * 0.6; g.keyDir = { x: Math.cos(wanderA), y: Math.sin(wanderA) }; return; }
    if (style === 'casual') {
      // v13 "casual human": only sees what is on screen, re-aims every
      // ~0.4 s (reaction time), goes for the NEAREST thing it can eat (not
      // the best value), notices a bigger rival only when it's close.
      if (frames % 12 !== 0) return;
      const vw = g.width / g.zoom / 2, vh = g.height / g.zoom / 2;
      const onScreen = (x, y) => Math.abs(x - p.x) < vw && Math.abs(y - p.y) < vh
        && Math.hypot(x - clamp(x, p.radius, WORLD_W - p.radius), y - clamp(y, p.radius, WORLD_H - p.radius)) < p.radius * 0.8;
      for (const b of g.bots) {
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (b.radius > p.radius * 1.15 && d < 150 + b.radius && Math.random() < 0.7) { g.keyDir = { x: (p.x - b.x) / (d + 1), y: (p.y - b.y) / (d + 1) }; return; }
      }
      let best = null, bd = Infinity;
      for (const b of g.bots) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (onScreen(b.x, b.y) && p.radius > b.radius * 1.3 && !b.invulnerable && d < bd) { bd = d; best = b; } }
      if (!best) for (const o of g.objects) {
        if (o.eating || !g.holeCanEat(p, o) || !onScreen(o.x, o.y)) continue;
        const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; }
      }
      if (best) { const m = Math.hypot(best.x - p.x, best.y - p.y) || 1; g.keyDir = { x: (best.x - p.x) / m, y: (best.y - p.y) / m }; }
      else { wanderA += (Math.random() - 0.5) * 1.2; g.keyDir = { x: Math.cos(wanderA), y: Math.sin(wanderA) }; }
      return;
    }
    let fx = 0, fy = 0;
    for (const b of g.bots) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (b.radius > p.radius * 1.12 && d < 260 + b.radius) { fx -= (b.x - p.x) / (d + 1) * 3; fy -= (b.y - p.y) / (d + 1) * 3; }
    }
    if (fx || fy) { const m = Math.hypot(fx, fy); g.keyDir = { x: fx / m, y: fy / m }; return; }
    let best = null, bestScore = -1;
    // Like a human, skip targets the hole can't physically reach: its center
    // is clamped radius-from-the-wall, so a small rival (or a shockwave-
    // pushed object) tucked into a wall/corner may sit outside its eat reach.
    const reachable = (x, y, reach) => Math.hypot(x - clamp(x, p.radius, WORLD_W - p.radius), y - clamp(y, p.radius, WORLD_H - p.radius)) < reach;
    for (const b of g.bots) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (!reachable(b.x, b.y, p.radius * 0.7)) continue;
      if (p.radius > b.radius * 1.2 && !b.invulnerable && d < 500) { const s = 40 / (d + 30); if (s > bestScore) { bestScore = s; best = b; } }
    }
    for (const o of g.objects) {
      if (o.consumed || o.removed || o.eating || !g.holeCanEat(p, o)) continue;
      if (!reachable(o.x, o.y, p.radius * 0.8)) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      const s = (o.value + 2) / (d + 40);
      if (s > bestScore) { bestScore = s; best = o; }
    }
    if (best) { const m = Math.hypot(best.x - p.x, best.y - p.y) || 1; g.keyDir = { x: (best.x - p.x) / m, y: (best.y - p.y) / m }; }
    else { wanderA += 0.05; g.keyDir = { x: Math.cos(wanderA), y: Math.sin(wanderA) }; }
  };
  while (g.state === GameState.PLAYING && frames < 60 * 60 * 10) {
    if (g.evolutionPending) {
      const card = document.querySelector('#evolutionCards .evolution-card, #evolutionCards button');
      if (card && opts.pickCards !== false) card.click(); else g.skipEvolutionOffer();
      continue;
    }
    steer();
    vnow += dt * 1000;
    const t0 = realNow();
    g.update(dt);
    const t1 = realNow();
    totalUpdateMs += t1 - t0; maxUpdateMs = Math.max(maxUpdateMs, t1 - t0);
    if (p.radius < lastR - 4) deaths++;
    if (p.score > lastScore) { if (firstEatSec === null) firstEatSec = +(frames * dt).toFixed(2); if (frames * dt <= 10) eats10++; lastScore = p.score; }
    lastR = p.radius;
    if (frames % 15 === 0 && g.state === GameState.PLAYING) {
      const r0 = realNow(); g.render(frames * dt); renderMs += realNow() - r0; renders++;
    }
    frames++;
    if (opts.onFrame) opts.onFrame(frames, g); // E1: observer only (qa/trace.mjs)
  }
  g.keyDir = { x: 0, y: 0 };
  performance.now = realNow;
  if (opts.gfx != null) g.applyGfx(2);
  const ranked = rankHoles([g.player, ...g.bots]);
  return {
    place: ranked.indexOf(g.player) + 1, score: g.player.score, firstEatSec, eats10,
    gapToSecond: ranked[0] === g.player ? g.player.score - ranked[1].score : ranked[0].score - g.player.score, radius: Math.round(g.player.radius),
    tier: CONFIG.sizeTiers[getSizeTierIndex(g.player.radius)].shortId,
    coins: g.save.coins, prisms: g.save.prisms, coinsEarned: g.adPendingCoins, frames, deaths,
    avgUpdateMs: +(totalUpdateMs / frames).toFixed(3), maxUpdateMs: +maxUpdateMs.toFixed(2),
    avgRenderMs: +(renderMs / Math.max(1, renders)).toFixed(2),
    difficulty: +g.difficultyT.toFixed(2), runs: g.save.stats.runsPlayed, state: g.state,
    level: g.save.player.level, coreLevel: g.save.hub.coreLevel
  };
};
`;

/** Partial-round driver for screenshots/visual checks (v12): advances the
 *  current Arena round `frames` frames in virtual time with a simple greedy
 *  steer, then renders one frame. __qaSwallowScene() stages a mid-swallow
 *  moment (objects + a smaller rival tipping into the player's vortex). */
export const QA_TICK = `
window.__qaTick = function (frames, renderEvery) {
  const g = window.game, p = g.player, dt = 1 / 30;
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  window.__vnow = Math.max(window.__vnow || 0, realNow());
  performance.now = () => window.__vnow;
  for (let f = 0; f < frames && g.state === GameState.PLAYING; f++) {
    if (g.evolutionPending) { g.skipEvolutionOffer(); continue; }
    let best = null, bs = -1;
    for (const o of g.objects) { if (o.eating || !g.holeCanEat(p, o)) continue; const d = Math.hypot(o.x - p.x, o.y - p.y); const s = (o.value + 2) / (d + 40); if (s > bs) { bs = s; best = o; } }
    if (best) { const m = Math.hypot(best.x - p.x, best.y - p.y) || 1; g.keyDir = { x: (best.x - p.x) / m, y: (best.y - p.y) / m }; }
    window.__vnow += dt * 1000;
    g.update(dt);
    // renderEvery: also draw every Nth frame, so render caches (city-floor
    // chunks, sprites) stay as warm as in real play.
    if (renderEvery && f % renderEvery === 0 && g.state === GameState.PLAYING) g.render(window.__vnow / 1000);
  }
  g.keyDir = { x: 0, y: 0 };
  g.render(window.__vnow / 1000);
  performance.now = realNow;
  return { radius: Math.round(p.radius), zoom: +g.zoom.toFixed(2), state: g.state };
};
window.__qaSwallowScene = function () {
  const g = window.game, dt = 1 / 60;
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  window.__vnow = Math.max(window.__vnow || 0, realNow());
  performance.now = () => window.__vnow;
  g.checkEvolutionTriggers = () => {};
  g.startRound({ seed: 99 }); cancelAnimationFrame(g.rafId); g.running = false;
  const p = g.player;
  g.banner = null; g.bannerQueue = [];
  p.radius = 70; g.zoom = 1;
  for (let k = 0; k < 4; k++) { window.__vnow += dt * 1000; g.update(dt); }
  g.banner = null; g.bannerQueue = [];
  g.objects.filter(o => !o.eating && g.holeCanEat(p, o)).slice(0, 5).forEach((o, i) => { const a = i * 1.25; o.x = p.x + Math.cos(a) * p.radius * 0.8; o.y = p.y + Math.sin(a) * p.radius * 0.8; });
  const b = g.bots[0]; b.radius = 30; b.invulnerableUntil = 0; b.x = p.x + 40; b.y = p.y - 10;
  for (let f = 0; f < 8; f++) { window.__vnow += dt * 1000; g.update(dt); }
  g.banner = null;
  g.render(window.__vnow / 1000);
  performance.now = realNow;
  delete g.checkEvolutionTriggers;
  return { eating: g.objects.filter(o => o.eating && o.eater === p).length, ghosts: g.swallowGhosts.length };
};
`;

/** v15 campaign bot (shared by campaign-bots, calibrate and difficulty).
 *  __qaPlayMission(id, opts): opts.style 'expert' (default; sees the whole
 *  board, re-aims every frame, flees bigger rivals early, steers around
 *  glitch zones) or 'casual' (sees only the screen -- or the light circle
 *  in a blackout --, re-aims every ~0.4 s, goes for the nearest goal-ish
 *  bite, follows the edge arrow when nothing is in view, notices a bigger
 *  rival / glitch zone only up close). opts.openLimit runs without a time
 *  limit (calibration); opts.boosters pre-picks mission boosters. */
export const CAMPAIGN_BOT = `
window.__qaPlayMission = function (id, opts) {
  opts = opts || {};
  const style = opts.style || 'expert';
  const g = window.game;
  const realNow = window.__realNow || (window.__realNow = performance.now.bind(performance));
  let vnow = opts.clock0 != null ? opts.clock0 : realNow(); // E1: see __qaPlayArena
  performance.now = () => vnow;
  const def = campaignMissionById(id);
  const limit0 = def.timeLimit;
  if (opts.openLimit) def.timeLimit = 900;
  g.missionBoosters = opts.boosters || [];
  g.startCampaignMission(id);
  if (g.introPending) g.beginMissionPlay();
  if (g.rafId) cancelAnimationFrame(g.rafId);
  g.running = false;
  const dt = 1 / 30;
  const m = g.mission;
  let frames = 0, wander = Math.random() * 6.28;
  window.__qaLastPos = null; window.__qaRoam = 0;
  const B = CONFIG.campaign.bounds;
  const vw = (opts.viewW || 390) / 2, vh = (opts.viewH || 844) / 2;
  while (!m.ended && !m.finishing && frames < 30 * (opts.openLimit ? 900 : 420)) {
    if (g.evolutionPending) { const c = document.querySelector('#evolutionCards .evolution-card'); if (c) c.click(); else g.skipEvolutionOffer(); continue; }
    if (g.introPending) g.beginMissionPlay();
    if (g.revivePending) { g.declineRevive(); break; }
    const p = g.player;
    const casual = style === 'casual';
    if (!casual || frames % 12 === 0) {
      const tier = g.campaignTierIndex(g.campaignPlayerTier().id);
      const goalTypes = g.campaignGoalEntityTypes();
      if (frames % 15 === 0) g.__qaComboPending = g.campaignGoalItems().some(it => /combo/i.test(it.label) && it.progress < it.target);
      const comboPending = g.__qaComboPending;
      const dark = m.def.setup.dark;
      const vis = dark ? g.darkVision() * 0.9 : 0;
      const sees = (x, y) => dark ? Math.hypot(x - p.x, y - p.y) < vis
        : (!casual || (Math.abs(x - g.camera.x) < vw && Math.abs(y - g.camera.y) < vh));
      let fx = 0, fy = 0;
      for (const b of g.bots) {
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        const danger = (casual ? 70 : 170) + b.radius + (m.def.setup.fragile ? 60 : 0);
        if (b.radius > p.radius * 1.1 && d < danger && (!casual || Math.random() < 0.75)) { fx -= (b.x - p.x) / (d + 1); fy -= (b.y - p.y) / (d + 1); }
      }
      for (const z of (g.glitchZones || [])) {
        const d = Math.hypot(z.x - p.x, z.y - p.y);
        const margin = casual ? 25 : 70 + (m.def.setup.fragile ? 40 : 0);
        if (d < z.r + p.radius + margin) { const k = 1.5; fx -= (z.x - p.x) / (d + 1) * k; fy -= (z.y - p.y) / (d + 1) * k; }
      }
      let target = null, best = -1;
      const reachable = (x, y, reach) => Math.hypot(x - clamp(x, B.minX + p.radius, B.maxX - p.radius), y - clamp(y, B.minY + p.radius, B.maxY - p.radius)) < reach;
      if (!(fx || fy)) {
        for (const e of g.campaignEntities) {
          if (e.consumed || e.eating || !e.live) continue;
          if (!sees(e.x, e.y)) continue;
          // v20: impulse pads / portals are helpers, never goals -- the bot
          // doesn't aim for them (mission times are measured without them).
          if (e.type === 'gate') continue;
          const touch = e.type === 'node' && e.glyph === 'mostek' && !e.mostekPowered && tier >= e.stats.minTier;
          if (e.type === 'node' && e.glyph === 'mostek' && !touch) continue;
          if (!touch) {
            if ((e.type === 'node' || e.type === 'pylon') && !e.active) continue;
            if (e.type === 'landmark' && !e.unlocked) continue;
            if (tier < e.stats.minTier) continue;
          }
          // Skip food sitting inside a glitch zone.
          if ((g.glitchZones || []).some(z => Math.hypot(z.x - e.x, z.y - e.y) < z.r + p.radius * 0.5)) continue;
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          const small = comboPending && (e.type === 'fragment' || e.type === 'capsule');
          const s = casual
            ? (small ? 3 : goalTypes.has(e.type) ? 2 : 1) / (d + 60)
            : (small ? 40 : (goalTypes.has(e.type) ? 4 : 1) * ((e.stats && e.stats.growth) || 2)) / (d + 60);
          if (s > best) { best = s; target = e; }
        }
        for (const b of g.bots) {
          const d = Math.hypot(b.x - p.x, b.y - p.y);
          if (!sees(b.x, b.y)) continue;
          if (!reachable(b.x, b.y, Math.max(p.radius, b.radius) * 0.7)) continue;
          if (p.radius > b.radius * 1.2 && d < 700) { const s = (b.racer ? 10 : 6) / (d + 60); if (s > best) { best = s; target = b; } }
        }
        // Nothing worth it in view: follow the edge arrow (what a human sees).
        if (!target || (casual && !(target instanceof CampaignEntity && goalTypes.has(target.type)) && Math.random() < 0.3)) {
          const guides = g.campaignGuideTargets();
          let gd = Infinity;
          for (const e of guides) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < gd && (!target || d > 0)) { gd = d; if (!target || casual) target = e; } }
        }
      }
      if (fx || fy) { const n = Math.hypot(fx, fy); g.keyDir = { x: fx / n, y: fy / n }; }
      else if (target) {
        // A finger is not a vector: the casual player's aim wobbles ±12°.
        let ang = Math.atan2(target.y - p.y, target.x - p.x);
        if (casual) ang += (Math.random() - 0.5) * 0.42;
        g.keyDir = { x: Math.cos(ang), y: Math.sin(ang) };
      }
      else { wander += casual ? (Math.random() - 0.5) * 1.2 : 0.04; g.keyDir = { x: Math.cos(wander), y: Math.sin(wander) }; }
    }
    // Unstick like a human would: no real progress for 3 s -> roam a bit.
    if (frames % 90 === 0) { if (window.__qaLastPos && Math.hypot(p.x - window.__qaLastPos.x, p.y - window.__qaLastPos.y) < 40) window.__qaRoam = 30; window.__qaLastPos = { x: p.x, y: p.y }; }
    if (window.__qaRoam > 0) { window.__qaRoam--; wander += 0.08; g.keyDir = { x: Math.cos(wander), y: Math.sin(wander) }; }
    vnow += dt * 1000;
    g.updateCampaign(dt);
    if (opts.render && frames % 30 === 0 && !m.ended) g.renderCampaign(frames * dt);
    frames++;
    if (opts.onFrame) opts.onFrame(frames, g); // E1: observer only (qa/trace.mjs)
  }
  // Success has a short celebration delay (beginMissionSuccess uses a
  // real setTimeout) -- commit it directly instead of waiting on it.
  const success = !!m.finishing && !m.ended && !m.failReason;
  if (success) g.endCampaignMission(true);
  else if (!m.ended) g.endCampaignMission(false);
  g.keyDir = { x: 0, y: 0 };
  performance.now = realNow;
  def.timeLimit = limit0;
  return { id, success: success && !!g.save.campaign.completed[id], elapsed: +m.elapsed.toFixed(1), limit: limit0, fail: success ? null : (m.failReason || 'time'), diff: def.diff, stars: success ? g.missionStarBits(m) : 0 };
};
`;

/** A save with every district open (campaign bots). */
export async function allDistrictsSave(page) {
  const save = await veteranSave(page, { missions: 0 });
  save.campaign.unlockedDistricts = DISTRICT_IDS_ALL;
  return save;
}
export const DISTRICT_IDS_ALL = ['plac', 'park', 'port', 'galeria', 'dachy', 'rdzen', 'metro', 'bazar', 'fabryka', 'zatoka', 'ogrody', 'chmura'];
