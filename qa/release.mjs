// E3: the published artifact -- checks of .github/scripts/assemble-release.mjs
// and of the release layout it builds (frozen classic root + immutable
// v/<id>/ + retained releases). Dev-only. Runs the real script (a child
// node process, the same code CI runs) on snapshot histories in qa/out/
// (fixture source: the same assembly code, only the trees and the history
// come from folders instead of git), then loads the artifacts in Chromium
// from a local server -- at / and under /vector-hole/ like Pages, with
// Cache-Control: max-age=600 where a test needs Pages' caching.
//   node qa/release.mjs
// Separate from the worktree suites on purpose: a PASS here is about the
// assembled artifact, never about the repo folder, and never about the live
// site (that is the workflow's live checks + the owner's iPhone test).
// What it covers (E3 acceptance + the three GPT corrections):
// - static artifact: exact file list, pins, HTML differs by two attributes,
//   module bytes = repo game.js, graph = readRuntimeSources(), determinism;
// - QA leak (correction 1): the harmless QA_BRIDGE_NAMES comment passes, a
//   real QA mechanism or a qa/ file in the artifact fails;
// - graph rules: missing module, dynamic/absolute/bare/escaping imports,
//   symlink, wrong extension, cycle, CSS asset, unknown HTML reference fail;
//   a synthetic multi-module graph (static parse only) passes;
// - retention (correction 2): every scenario of the E3 prompt on snapshot
//   histories, the over-limit error, superseded runs, the documented gap;
// - live checks against a local fake site: classic/versioned, 403/503 =
//   infrastructure, wrong bytes = STOP; the workflow's own bash check;
// - browser: old HTML + frozen root, new HTML + v/<id>/ (/ and /vector-hole/),
//   negative "E2 alone" (must show the SyntaxError), mixed versions while
//   deploying, a long-open page reloading, the save shared by old and new
//   code, and the rollback path (correction 3).
// - L1 (the deployment ledger): a fake GitHub REST API (GET only, Link
//   pagination, 90-day status deletion) read by the script's `ledger`
//   command; every scenario of the L1 prompt, including the closed gap (a
//   published release that cannot be rebuilt is a STOP, never "excluded"),
//   and the three-job workflow (only the deploy job writes a record).
// - L1-R1: the fake API answers like the real one (K0): Link by repository
//   id, `waiting` first, the deploying app; bad next links, `waiting` in
//   every role, the deploying app since the era epoch.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync, spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { serve, openGame, chromium, report, ROOT, OUT, revisionFile, readRuntimeSources, installQaBridge, QA_BRIDGE, isMain } from './lib.mjs';

const SCRIPT = path.join(ROOT, '.github/scripts/assemble-release.mjs');
const WORKFLOW = path.join(ROOT, '.github/workflows/deploy-pages.yml');
// The checks match the workflow line by line; a CRLF checkout (Windows,
// core.autocrlf) must not turn them into false FAILs.
const readWorkflow = () => fs.readFileSync(WORKFLOW, 'utf8').replace(/\r\n/g, '\n');
// Windows creates symlinks only with Developer Mode or admin rights; there
// the two symlink negatives are logged as NOT RUN instead of crashing the suite.
const CAN_SYMLINK = (() => {
  const d = path.join(OUT, 'symlink-probe');
  try { fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true }); fs.symlinkSync('a', path.join(d, 'b')); return true; }
  catch (e) { return false; } finally { fs.rmSync(d, { recursive: true, force: true }); }
})();
// The pack's Pages checker runs under the first real Python 3 found:
// $VH_PYTHON, then python3, python, py -3. (On Windows `python3` is often the
// Microsoft Store alias: no spawn error, exit 9009/49 and no output -- it used
// to make the checker FAIL with an empty result instead of running.) None ->
// NOT RUN, never a PASS.
const PYTHON = (() => {
  const cands = [...(process.env.VH_PYTHON ? [[process.env.VH_PYTHON]] : []), ['python3'], ['python'], ['py', '-3']];
  for (const [cmd, ...pre] of cands) {
    const r = spawnSync(cmd, [...pre, '-I', '-c', 'import sys; print(sys.version_info[0])'], { encoding: 'utf8' });
    if (!r.error && r.status === 0 && String(r.stdout).trim() === '3') return { cmd, pre, label: [cmd, ...pre].join(' ') };
  }
  return null;
})();
const REL = await import(pathToFileURL(SCRIPT).href); // a bare Windows path (C:\...) is not an ESM URL
const BASE = REL.FROZEN.rev;
const W = path.join(OUT, 'release');
const NOW = '2026-10-19T12:00:00Z';
const DAY = 86400;
const T0 = Date.parse(NOW) / 1000;
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const fakeSha = (name) => crypto.createHash('sha1').update('vh-e3:' + name).digest('hex');

const repoFile = (f) => fs.readFileSync(path.join(ROOT, f));
const GOOD = { 'index.html': repoFile('index.html'), 'game.js': repoFile('game.js'), 'style.css': repoFile('style.css') };
const OLD = { 'index.html': revisionFile(BASE, 'index.html'), 'game.js': revisionFile(BASE, 'game.js'), 'style.css': revisionFile(BASE, 'style.css') };
const MARKER = fs.readFileSync(SCRIPT);

/** Runs the real script (with the flag CI uses); never throws. */
function run(args, opts = {}) {
  const r = spawnSync(process.execPath, ['--experimental-vm-modules', '--no-warnings', SCRIPT, ...args], { encoding: 'utf8', maxBuffer: 64 << 20, ...opts });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
}
/** Same, without blocking the event loop (the live checks talk to servers in this process). */
function runAsync(args, env = {}) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ['--experimental-vm-modules', '--no-warnings', SCRIPT, ...args], { env: { ...process.env, GITHUB_ACTIONS: '', ...env } });
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
    p.on('close', code => resolve({ code, out, err }));
  });
}

/** A snapshot history: commits = [{ name, days (age), parent | parentSha | parent: null,
 *  changed, files, marker, sha }], plus the commit before the versioned era. */
function makeHistory(dir, commits, { tip, shallow = false } = {}) {
  fs.rmSync(dir, { recursive: true, force: true });
  const shaOf = (name) => { const c = commits.find(x => x.name === name); return (c && c.sha) || fakeSha(name); };
  const json = { tip: shaOf(tip || commits[commits.length - 1].name), shallow, commits: {} };
  const write = (tree, files) => {
    for (const [p, d] of Object.entries(files)) {
      const abs = path.join(dir, tree, p);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      if (d && d.symlinkTo) fs.symlinkSync(d.symlinkTo, abs); else fs.writeFileSync(abs, d);
    }
  };
  for (const c of commits) {
    const tree = path.join('trees', c.name);
    const files = { ...(c.files || GOOD) };
    if (c.marker !== false) files[REL.ERA_MARKER] = c.marker || MARKER;
    write(tree, files);
    const parents = c.parent === null ? [] : [c.parent ? shaOf(c.parent) : (c.parentSha || fakeSha('pre-e3'))];
    json.commits[c.sha || fakeSha(c.name)] = { time: T0 - Math.round((c.days || 0) * DAY), parents, changed: c.changed === undefined ? ['game.js'] : c.changed, tree };
  }
  write(path.join('trees', 'pre-e3'), OLD);
  json.commits[fakeSha('pre-e3')] = { time: T0 - 400 * DAY, parents: [], changed: [], tree: path.join('trees', 'pre-e3') };
  fs.mkdirSync(path.join(dir, 'frozen'), { recursive: true });
  for (const f of ['game.js', 'style.css']) fs.writeFileSync(path.join(dir, 'frozen', f), OLD[f]);
  fs.writeFileSync(path.join(dir, 'history.json'), JSON.stringify(json, null, 2));
  return dir;
}
/** Assembles a snapshot history into DIR/<label>/release; returns the run + manifest. */
function assembleFx(hdir, label, { live = null, ledgerFile = null, rev = null, extra = [], now = NOW, env = {} } = {}) {
  const base = path.join(hdir, 'out-' + label);
  fs.rmSync(base, { recursive: true, force: true });
  fs.mkdirSync(base, { recursive: true });
  const out = path.join(base, 'release'), man = path.join(base, 'manifest.json');
  const args = ['assemble', '--source', 'fixture', '--fixture', hdir, '--out', out, '--now', now, '--manifest-out', man];
  if (live) { const lj = path.join(base, 'live.json'); fs.writeFileSync(lj, JSON.stringify(live)); args.push('--live-json', lj); } else args.push('--no-live-anchor');
  args.push(...(ledgerFile ? ['--ledger', ledgerFile] : ['--no-ledger']));
  if (rev) args.push('--rev', rev);
  const r = run([...args, ...extra], { env: { ...process.env, GITHUB_ACTIONS: '', ...env } });
  return { code: r.code, stdout: r.out, err: r.err, out, base, manifest: r.code === 0 ? JSON.parse(fs.readFileSync(man, 'utf8')) : null };
}
const idOf = (name) => fakeSha(name).slice(0, 12);
const kept = (m) => m ? m.releases.map(r => r.id) : [];
const walk = (dir) => { const out = []; const w = (a, r) => { for (const n of fs.readdirSync(a).sort()) { const p = path.join(a, n), q = r ? r + '/' + n : n; if (fs.lstatSync(p).isDirectory()) w(p, q); else out.push(q); } }; w(dir, ''); return out; };
const copyDir = (a, b) => { fs.rmSync(b, { recursive: true, force: true }); fs.cpSync(a, b, { recursive: true }); return b; };
const firstLine = (s) => String(s || '').trim().split('\n').filter(Boolean).pop() || '';

/** A workflow step's bash script (default: "Verify release/ independently"), run as written. */
function workflowCheckScript(step = 'Verify release/ independently') {
  const lines = readWorkflow().split('\n');
  const at = lines.findIndex(l => l.trim() === '- name: ' + step);
  const r = lines.findIndex((l, i) => i > at && /^\s+run: \|\s*$/.test(l));
  const ind = lines[r].match(/^\s*/)[0].length;
  const body = [];
  for (let i = r + 1; i < lines.length; i++) { const l = lines[i]; if (l.trim() && l.match(/^\s*/)[0].length <= ind) break; body.push(l.slice(ind + 2)); }
  return body.join('\n');
}
function runWorkflowCheck(releaseDir, sha) {
  const r = spawnSync('bash', ['-c', workflowCheckScript()], { cwd: path.dirname(releaseDir), env: { ...process.env, GITHUB_SHA: sha }, encoding: 'utf8' });
  if (path.basename(releaseDir) !== 'release') throw new Error('workflow check needs a folder named release');
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

/** A fake live site: a folder under /vector-hole/, or a fixed HTTP status. */
function fakeLive({ dir = null, status = null } = {}) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (status) { res.writeHead(status); res.end(); return; }
      const u = decodeURIComponent(req.url.split('?')[0]);
      if (!u.startsWith('/vector-hole/')) { res.writeHead(404); res.end(); return; }
      const f = path.join(dir, u.slice('/vector-hole/'.length) || 'index.html');
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }[path.extname(f)] || 'application/octet-stream' });
      res.end(fs.readFileSync(f));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}/vector-hole` }));
  });
}

/* ---------------------------------------------------------------- L1: a fake GitHub REST API
   GET-only, one repository's deployment records (all environments: the
   reader must filter and check). Statuses older than 90 days are deleted
   like GitHub does (the current one stays). Records every request, so the
   checks can prove GET only, the token header, and that nothing went elsewhere. */
const REPO = 'vh-owner/vector-hole';
const REPO_ID = '4242424242'; // its numeric id ($GITHUB_REPOSITORY_ID in CI; GitHub's Link headers name it)
const TOKEN = 'vh-test-token-' + crypto.randomBytes(9).toString('hex');
const EPOCH = '2025-01-01T00:00:00Z'; // fixture histories reach back 200 days (the real default is later)
const iso = (daysAgo) => new Date(Date.parse(NOW) - Math.round(daysAgo * DAY * 1000)).toISOString().replace(/\.000Z$/, 'Z');
/** A deployment record of commit `name`, created `days` ago. kind: 'success' | 'failure' | 'error' | 'inflight' | 'queued' | 'cancelled' (queued -> inactive) | 'waiting' | 'none';
 *  every kind starts with `waiting` like GitHub's real records (L1-R1: environment protection rules);
 *  inactive: days ago it turned inactive (after its outcome); sha / env / statuses override. */
const dep = (name, days, kind = 'success', o = {}) => {
  const st = { success: [['queued', 0], ['in_progress', 1], ['success', 3]], failure: [['queued', 0], ['in_progress', 1], ['failure', 2]], error: [['queued', 0], ['error', 1]], inflight: [['queued', 0], ['in_progress', 1]], queued: [['queued', 0]], cancelled: [['queued', 0], ['inactive', 5]], waiting: [], none: null }[kind];
  if (st) st.unshift(['waiting', 0]);
  const statuses = o.statuses || (st || []).map(([s, min]) => [s, days - min / 1440]);
  if (o.inactive !== undefined) statuses.push(['inactive', o.inactive]);
  return { sha: o.sha || fakeSha(name), env: o.env || 'github-pages', created: o.created || iso(days), days, statuses: statuses.map(([s, d]) => [s, typeof d === 'string' ? d : iso(d)]), id: o.id, extra: o.extra };
};
function fakeApi(deps, { fault = null, retention = true, base = null, linkForm = 'id' } = {}) {
  const sorted = [...deps].sort((a, b) => Date.parse(a.created) - Date.parse(b.created));
  let sid = 50000;
  sorted.forEach((d, i) => { d._id = d.id || 9000 + i; d._st = d.statuses.map(([state, at]) => ({ state, at })).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).map(s => ({ ...s, id: ++sid })); });
  const requests = [];
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      requests.push({ method: req.method, path: u.pathname, query: u.search, auth: req.headers.authorization || null, accept: req.headers.accept });
      const api = `http://127.0.0.1:${server.address().port}`;
      const send = (status, body, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers }); res.end(typeof body === 'string' ? body : JSON.stringify(body)); };
      const f = fault && fault({ path: u.pathname, page: Number(u.searchParams.get('page') || 1), query: u.searchParams, api });
      if (f === 'hang') { setTimeout(() => res.destroy(), 3000); return; } // answers too late (timeout)
      if (f === 'badjson') return send(200, '[{"id": 1, "sha": ');
      if (f === 'html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>oops</html>'); return; }
      if (f && f.status) return send(f.status, { message: 'fake' }, f.headers || {});
      if (req.method !== 'GET') return send(405, { message: 'GET only' });
      const per = Math.min(100, Number(u.searchParams.get('per_page') || 30)), page = Number(u.searchParams.get('page') || 1);
      const repoBase = `/repos/${REPO}`;
      const paged = (items) => {
        let slice = items.slice((page - 1) * per, page * per);
        if (f && f.mutate) slice = f.mutate(slice, items);
        const links = [];
        // Like GitHub (L1-R1, K0): Link names the repository by its numeric id; linkForm 'repos' = the /repos/{o}/{r} form.
        const mk = (p, form = linkForm) => { const n = new URL(api + (form === 'repos' ? u.pathname : `/repositories/${REPO_ID}${u.pathname.slice(repoBase.length)}`) + u.search); n.searchParams.set('page', String(p)); return n.href; };
        if (page * per < items.length) links.push(`<${mk(page + 1)}>; rel="next"`, `<${mk(Math.ceil(items.length / per))}>; rel="last"`);
        let link = links.join(', ');
        if (f && f.link !== undefined) link = typeof f.link === 'function' ? f.link(mk, page) : f.link;
        return send(200, slice, link ? { Link: link } : {});
      };
      const view = (d) => ({ url: `${api}${repoBase}/deployments/${d._id}`, id: d._id, sha: d.sha, ref: 'main', task: 'deploy', payload: {}, original_environment: d.env, environment: d.env, description: null, creator: { login: 'github-actions[bot]' }, created_at: d.created, updated_at: d._st.length ? d._st[d._st.length - 1].at : d.created, statuses_url: `${api}${repoBase}/deployments/${d._id}/statuses`, repository_url: `${api}${repoBase}`, transient_environment: false, production_environment: false, performed_via_github_app: { id: 15368, slug: 'github-actions', name: 'GitHub Actions' }, ...(d.extra || {}) });
      if (u.pathname === `${repoBase}/deployments`) {
        const env = u.searchParams.get('environment');
        return paged(sorted.filter(d => !env || d.env === env).slice().reverse().map(view));
      }
      const m = new RegExp(`^${repoBase}/deployments/(\\d+)/statuses$`).exec(u.pathname);
      if (m) {
        const d = sorted.find(x => String(x._id) === m[1]);
        if (!d) return send(404, { message: 'Not Found' });
        let st = d._st.slice().reverse(); // newest first
        if (retention) st = st.filter((s, i) => i === 0 || Date.parse(s.at) >= Date.parse(NOW) - 90 * DAY * 1000);
        return paged(st.map(s => ({ url: `${api}${repoBase}/deployments/${d._id}/statuses/${s.id}`, id: s.id, state: s.state, description: '', environment: d.env, target_url: '', log_url: '', environment_url: '', created_at: s.at, updated_at: s.at, deployment_url: `${api}${repoBase}/deployments/${d._id}`, repository_url: `${api}${repoBase}` })));
      }
      return send(404, { message: 'Not Found' });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, base: base || `http://127.0.0.1:${server.address().port}`, requests, ids: () => sorted.map(d => d._id) }));
  });
}
/** Reads the ledger through the real script from a fake API; returns the run + the file. */
async function ledgerFx(hdir, label, deps, { fault = null, retention = true, perPage = null, timeoutMs = null, token = TOKEN, epoch = EPOCH, now = NOW, apiOverride = null, linkForm = 'id', repoId = REPO_ID } = {}) {
  const api = await fakeApi(deps, { fault, retention, linkForm });
  const base = path.join(hdir, 'ledger-' + label);
  fs.rmSync(base, { recursive: true, force: true }); fs.mkdirSync(base, { recursive: true });
  const file = path.join(base, 'ledger.json');
  const args = ['ledger', '--source', 'fixture', '--fixture', hdir, '--api-url', apiOverride || api.base, '--repository', REPO, '--out', file, '--now', now];
  if (epoch) args.push('--era-epoch', epoch);
  if (perPage) args.push('--per-page', String(perPage));
  if (timeoutMs) args.push('--timeout-ms', String(timeoutMs));
  const r = await runAsync(args, { GITHUB_TOKEN: token, GITHUB_REPOSITORY_ID: repoId || '' });
  api.server.close();
  return { code: r.code, out: r.out, err: r.err, file, api, ledger: r.code === 0 ? JSON.parse(fs.readFileSync(file, 'utf8')) : null };
}
/** Ledger + assembly in one go (the workflow's two steps). */
async function l1(hdir, label, deps, { live, rev = null, extra = [], ...lo } = {}) {
  const lg = await ledgerFx(hdir, label, deps, lo);
  const as = lg.code === 0 ? assembleFx(hdir, label, { live, rev, ledgerFile: lg.file, extra: [...(lo.epoch === null ? [] : ['--era-epoch', lo.epoch || EPOCH]), '--repository', REPO, ...extra] }) : null;
  return { lg, as, code: as ? as.code : lg.code, err: as ? as.err : lg.err };
}
const versioned = (name) => ({ era: 'versioned', anchorId: idOf(name), anchorFiles: null });
const CLASSIC_LIVE = { era: 'classic', anchorId: null, anchorFiles: null };
const reasonsOf = (m, name) => { const r = m && m.releases.find(x => x.id === idOf(name)); return r ? r.reasons.join(' / ') : null; };
const vDirs = (out) => fs.existsSync(path.join(out, 'v')) ? fs.readdirSync(path.join(out, 'v')).sort() : [];

/** Opens a page without assuming the game starts (negative checks). */
async function rawPage(url, { context = null, html = null, wait = true } = {}) {
  const browser = context ? null : await chromium.launch();
  const ctx = context || await browser.newContext({ locale: 'pl-PL' });
  if (!context) { await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort()); await installQaBridge(ctx); }
  const page = await ctx.newPage();
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfinished', async (rq) => { const res = await rq.response().catch(() => null); requests.push({ url: rq.url(), status: res ? res.status() : 0 }); });
  page.on('requestfailed', (rq) => requests.push({ url: rq.url(), status: 0 }));
  if (html) await page.route(/\/index\.html(\?.*)?$/, r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto(url);
  const ready = wait && await page.waitForFunction(() => window.game && window.game.state !== undefined && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 12000 }).then(() => true, () => false);
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => ({ game: !!window.game, state: window.game && window.game.state, bridge: window.__qaBridge ? { ...window.__qaBridge } : null })).catch(() => ({}));
  return { browser, ctx, page, errors, requests, ready, st, close: async () => { if (browser) await browser.close(); else await page.close(); } };
}
const paths = (reqs, origin) => [...new Set(reqs.filter(r => r.url.startsWith(origin)).map(r => new URL(r.url).pathname))].sort();

export async function runReleaseChecks() {
  const results = [];
  const push = (name, ok, details) => results.push(report(name, ok, details));
  const notRun = (name, why) => console.log(`NOT RUN  ${name} -- ${why}`);
  fs.rmSync(W, { recursive: true, force: true });
  fs.mkdirSync(W, { recursive: true });

  // ===================================================== static artifact
  const mainH = makeHistory(path.join(W, 'h-main'), [{ name: 'e3', days: 0 }]);
  const MAIN_SHA = fakeSha('e3'), MAIN_ID = idOf('e3');
  const a1 = assembleFx(mainH, 'a'), a2 = assembleFx(mainH, 'b');
  const rel = a1.out;
  {
    push('static: the script assembles the worktree release (exit 0), twice to the same artifact (deterministic manifest)', a1.code === 0 && a2.code === 0 && a1.manifest.artifactSha256 === a2.manifest.artifactSha256, JSON.stringify({ codes: [a1.code, a2.code], sha: a1.manifest && a1.manifest.artifactSha256, err: firstLine(a1.err) }));
    const files = walk(rel);
    const want = ['game.js', 'index.html', 'style.css', `v/${MAIN_ID}/game.js`, `v/${MAIN_ID}/style.css`];
    push('static: the artifact is exactly index.html, the frozen root pair and v/<id>/{game.js,style.css}', files.join(',') === want.join(','), files.join(', '));
    const html = fs.readFileSync(path.join(rel, 'index.html'), 'utf8');
    const tags = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(m => m[0]);
    const sheets = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)].map(m => m[0]);
    const expectHtml = GOOD['index.html'].toString('utf8').replace('src="game.js"', `src="v/${MAIN_ID}/game.js"`).replace('href="style.css"', `href="v/${MAIN_ID}/style.css"`);
    push('static: index.html = the repo file with exactly two attributes rewritten (one module script and one stylesheet, both v/<id>/; no root game.js/style.css)', html === expectHtml && tags.length === 1 && /type="module"/.test(tags[0]) && sheets.length === 1 && !/src="game\.js"|href="style\.css"/.test(html), JSON.stringify({ tags, sheets }));
    const root = { js: sha256(fs.readFileSync(path.join(rel, 'game.js'))), css: sha256(fs.readFileSync(path.join(rel, 'style.css'))) };
    let classicParse = 'ok'; try { new (await import('node:vm')).Script(fs.readFileSync(path.join(rel, 'game.js'), 'utf8')); } catch (e) { classicParse = e.message; }
    push(`static: root game.js/style.css = the frozen pins = ${BASE.slice(0, 7)}'s files (git show / VH_QA_REVS), root game.js parses as a classic script`, root.js === REL.FROZEN.files['game.js'] && root.css === REL.FROZEN.files['style.css'] && root.js === sha256(OLD['game.js']) && root.css === sha256(OLD['style.css']) && classicParse === 'ok', JSON.stringify({ ...root, classicParse }));
    push('static: v/<id>/game.js and style.css are byte-identical to the repo files (the module that QA tests)', fs.readFileSync(path.join(rel, `v/${MAIN_ID}/game.js`)).equals(GOOD['game.js']) && fs.readFileSync(path.join(rel, `v/${MAIN_ID}/style.css`)).equals(GOOD['style.css']), MAIN_ID);
    const rs = readRuntimeSources(rel);
    const graph = [rs.html.path, ...rs.files.map(f => f.path)].sort().join(',');
    push('static: the script\'s graph = readRuntimeSources() on the artifact (two independent implementations), nothing skipped or missing', graph === ['index.html', `v/${MAIN_ID}/game.js`, `v/${MAIN_ID}/style.css`].sort().join(',') && !rs.missing.length && !rs.skipped.length, JSON.stringify({ graph, missing: rs.missing, skipped: rs.skipped }));
    const v = run(['verify', '--release', rel, '--id', MAIN_ID, '--manifest', path.join(a1.base, 'manifest.json')]);
    const wf = runWorkflowCheck(rel, MAIN_SHA);
    push('static: the script\'s own re-check (verify) and the workflow\'s independent bash check both pass the artifact', v.code === 0 && wf.code === 0, JSON.stringify({ verify: firstLine(v.out || v.err), workflow: firstLine(wf.out) }));
  }

  // ===================================================== correction 1: QA leak
  {
    const comment = /QA_BRIDGE_NAMES/.test(GOOD['game.js'].toString('utf8'));
    push('qa-leak: the E2 game.js really carries the harmless QA_BRIDGE_NAMES comment, and the release assembles anyway (no false positive)', comment && a1.code === 0, `comment present: ${comment}`);
    const leak1 = makeHistory(path.join(W, 'h-leak1'), [{ name: 'leak1', files: { ...GOOD, 'game.js': Buffer.concat([GOOD['game.js'], Buffer.from('\nwindow.__qaBridge = { ready: true };\n')]) } }]);
    const r1 = assembleFx(leak1, 'x');
    const leak2 = makeHistory(path.join(W, 'h-leak2'), [{ name: 'leak2', files: { ...GOOD, 'game.js': Buffer.concat([GOOD['game.js'], Buffer.from('\n' + QA_BRIDGE + '\n')]) } }]);
    const r2 = assembleFx(leak2, 'x');
    push('qa-leak: a real QA mechanism in the runtime (a window.__qa hook, or the QA bridge itself) stops the assembly (exit 1, named)', r1.code === 1 && /QA mechanism/.test(r1.err) && r2.code === 1 && /QA mechanism/.test(r2.err), JSON.stringify([firstLine(r1.err), firstLine(r2.err)]));
    const leak3 = makeHistory(path.join(W, 'h-leak3'), [{ name: 'leak3', files: { ...GOOD, 'game.js': Buffer.concat([Buffer.from("import './qa/helper.js';\n"), GOOD['game.js']]), 'qa/helper.js': 'export const x = 1;\n' } }]);
    const r3 = assembleFx(leak3, 'x');
    push('qa-leak: a module importing a file from qa/ stops the assembly (dev folder)', r3.code === 1 && /dev folder/.test(r3.err), firstLine(r3.err));
    // Files slipped into an assembled artifact afterwards.
    const tamper = (label, fn) => { const d = copyDir(rel, path.join(W, 'tamper-' + label, 'release')); fn(d); return { v: run(['verify', '--release', d, '--id', MAIN_ID]), wf: runWorkflowCheck(d, MAIN_SHA) }; };
    const t1 = tamper('qa-dir', d => { fs.mkdirSync(path.join(d, 'qa'), { recursive: true }); fs.writeFileSync(path.join(d, 'qa/lib.mjs'), 'export {};\n'); });
    const t2 = tamper('qa-in-v', d => { fs.mkdirSync(path.join(d, `v/${MAIN_ID}/qa`), { recursive: true }); fs.writeFileSync(path.join(d, `v/${MAIN_ID}/qa/x.js`), 'export {};\n'); });
    const t3 = tamper('qa-hook', d => { fs.appendFileSync(path.join(d, `v/${MAIN_ID}/game.js`), '\nwindow.__qaPlayArena = () => {};\n'); });
    const t4 = tamper('md', d => { fs.writeFileSync(path.join(d, 'REPORT.md'), '# x\n'); });
    push('qa-leak: a qa/ folder, a qa/ file inside v/<id>/, a QA hook or a .md file in the artifact each fail both the script\'s verify and the workflow\'s bash check', [t1, t2, t3, t4].every(t => t.v.code === 1 && t.wf.code === 1), JSON.stringify([t1, t2, t3, t4].map(t => [t.v.code, t.wf.code, firstLine(t.wf.out)])));
  }

  // ===================================================== graph rules (negative)
  {
    let cases = [
      ['missing module (./missing.js) -- named in the message', { 'game.js': Buffer.concat([Buffer.from("import { x } from './missing.js';\n"), GOOD['game.js']]) }, /missing\.js is missing/],
      ['dynamic import()', { 'game.js': Buffer.concat([GOOD['game.js'], Buffer.from("\nconst lazy = () => import('./later.js');\n")]) }, /dynamic import/],
      ['absolute import (/x.js breaks under /vector-hole/)', { 'game.js': Buffer.concat([Buffer.from("import '/x.js';\n"), GOOD['game.js']]), 'x.js': '' }, /absolute/],
      ['bare specifier', { 'game.js': Buffer.concat([Buffer.from("import 'lodash';\n"), GOOD['game.js']]) }, /bare specifier/],
      ['import leaving the release directory', { 'game.js': Buffer.concat([Buffer.from("import '../outside.js';\n"), GOOD['game.js']]) }, /leaves the release directory/],
      ['import with a query string', { 'game.js': Buffer.concat([Buffer.from("import './a.js?v=2';\n"), GOOD['game.js']]), 'a.js': '' }, /query/],
      ['non-.js import (JSON module)', { 'game.js': Buffer.concat([Buffer.from("import data from './data.json' with { type: 'json' };\n"), GOOD['game.js']]), 'data.json': '{}' }, /with attributes|must be a \.js/],
      ['import.meta', { 'game.js': Buffer.concat([GOOD['game.js'], Buffer.from('\nconst here = import.meta.url;\n')]) }, /import\.meta/],
      ['import cycle', { 'game.js': Buffer.concat([Buffer.from("import './a.js';\n"), GOOD['game.js']]), 'a.js': "import './b.js';\n", 'b.js': "import './a.js';\n" }, /import cycle/],
      ['symlinked module', { 'game.js': Buffer.concat([Buffer.from("import './link.js';\n"), GOOD['game.js']]), 'real.js': '', 'link.js': { symlinkTo: 'real.js' } }, /symlink/],
      ['CSS url() to a relative asset (would break under v/<id>/)', { 'style.css': Buffer.concat([GOOD['style.css'], Buffer.from('\n.x{background:url(img/a.png)}\n')]) }, /references a file/],
      ['CSS @import', { 'style.css': Buffer.concat([Buffer.from("@import 'more.css';\n"), GOOD['style.css']]) }, /@import/],
      ['an unknown local reference in index.html (<img src>)', { 'index.html': Buffer.from(GOOD['index.html'].toString('utf8').replace('<body', '<img src="logo.png"><body')) }, /don't handle/],
      ['a second <script src> in index.html', { 'index.html': Buffer.from(GOOD['index.html'].toString('utf8').replace('</body>', '<script src="extra.js"></script></body>')), 'extra.js': '' }, /exactly one <script src>/],
      ['inline script code in index.html', { 'index.html': Buffer.from(GOOD['index.html'].toString('utf8').replace('</body>', '<script>window.x = 1;</script></body>')) }, /inline <script> code/],
      ['a syntax error in the module', { 'game.js': Buffer.concat([GOOD['game.js'], Buffer.from('\nconst = ;\n')]) }, /does not parse/],
      ['an external stylesheet (third-party request)', { 'index.html': Buffer.from(GOOD['index.html'].toString('utf8').replace('href="style.css"', 'href="https://fonts.example/x.css"')) }, /not a local file/]
    ];
    const bad = [];
    const usesSymlink = ([, files]) => Object.values(files).some(d => d && d.symlinkTo);
    if (!CAN_SYMLINK) {
      cases.filter(usesSymlink).forEach(([label]) => notRun(`graph: ${label}`, 'this OS refuses symlinks (Windows without Developer Mode)'));
      cases = cases.filter(c => !usesSymlink(c));
    }
    for (const [label, files, re] of cases) {
      const h = makeHistory(path.join(W, 'h-neg-' + crypto.createHash('md5').update(label).digest('hex').slice(0, 6)), [{ name: 'neg', files: { ...GOOD, ...files } }]);
      const r = assembleFx(h, 'x');
      if (!(r.code === 1 && re.test(r.err) && !fs.existsSync(path.join(r.out, 'index.html')))) bad.push(`${label}: exit ${r.code}, ${firstLine(r.err)}`);
    }
    push(`graph: each of ${cases.length} broken inputs stops the assembly before anything is written (exit 1, a message naming the cause)`, bad.length === 0, bad.length ? bad.join(' | ') : cases.map(c => c[0]).join('; '));
    // A synthetic multi-module graph: multi-line, side-effect, re-export, ../ -- static parse only.
    const multi = {
      ...GOOD,
      'game.js': Buffer.concat([Buffer.from("import {\n  alpha,\n  beta\n} from './src/a.js';\nimport './src/side.js';\nexport * from './src/re.js';\n"), GOOD['game.js']]),
      'src/a.js': "export { alpha, beta } from './inner/b.js';\n",
      'src/inner/b.js': "import { shared } from '../shared.js';\nexport const alpha = shared, beta = 2;\n",
      'src/shared.js': 'export const shared = 1;\n', 'src/side.js': 'globalThis.vhSide = 1;\n', 'src/re.js': 'export const reexported = 3;\n'
    };
    const hm = makeHistory(path.join(W, 'h-multi'), [{ name: 'multi', files: multi }]);
    const rm = assembleFx(hm, 'x');
    const got = rm.code === 0 ? walk(rm.out).filter(f => f.startsWith('v/')).map(f => f.split('/').slice(2).join('/')).sort() : [];
    const wantM = ['game.js', 'src/a.js', 'src/inner/b.js', 'src/re.js', 'src/shared.js', 'src/side.js', 'style.css'];
    push('graph: a synthetic multi-module graph (multi-line, side-effect, re-export, ../) is collected whole into v/<id>/ and passes both checks (static parse only, not run in a browser)', rm.code === 0 && got.join(',') === wantM.join(',') && runWorkflowCheck(rm.out, fakeSha('multi')).code === 0, JSON.stringify({ code: rm.code, got, err: firstLine(rm.err) }));
    const dropped = copyDir(rm.out || rel, path.join(W, 'tamper-multi', 'release'));
    if (rm.code === 0) fs.rmSync(path.join(dropped, `v/${idOf('multi')}/src/inner/b.js`));
    const vd = run(['verify', '--release', dropped, '--id', idOf('multi')]);
    push('graph: a module missing from an assembled artifact fails the script\'s re-check', rm.code === 0 && vd.code === 1 && /b\.js/.test(vd.err), firstLine(vd.err));
  }

  // ===================================================== immutability
  {
    const X1 = 'abcdefabcdef' + '1'.repeat(28), X2 = 'abcdefabcdef' + '2'.repeat(28);
    const h = makeHistory(path.join(W, 'h-collide'), [{ name: 'c1', sha: X1, days: 2 }, { name: 'c2', sha: X2, days: 1, parent: 'c1' }], { tip: 'c2' });
    const r = assembleFx(h, 'x');
    push('immutability: two commits sharing a 12-hex id stop the assembly (one id, one content)', r.code === 1 && /id collision/.test(r.err), firstLine(r.err));
  }

  // ===================================================== live pre-check / post-check (local fake site)
  const BAD = Buffer.concat([Buffer.from("throw new Error('VH-E3-BAD-RELEASE');\n"), GOOD['game.js']]);
  {
    const classicDir = path.join(W, 'live-classic');
    fs.mkdirSync(classicDir, { recursive: true });
    for (const [f, d] of Object.entries(OLD)) fs.writeFileSync(path.join(classicDir, f), d);
    let s = await fakeLive({ dir: classicDir });
    const lj = path.join(W, 'live-classic.json');
    const p1 = await runAsync(['precheck-live', '--url', s.base, '--out-json', lj]);
    const j1 = p1.code === 0 ? JSON.parse(fs.readFileSync(lj, 'utf8')) : {};
    push('live pre-check: today\'s classic site (63b50d0 bytes) passes and names no live release (first versioned deploy)', p1.code === 0 && j1.era === 'classic' && j1.anchorId === null, JSON.stringify({ code: p1.code, era: j1.era, err: firstLine(p1.err) }));
    fs.writeFileSync(path.join(classicDir, 'index.html'), Buffer.concat([OLD['index.html'], Buffer.from('<!-- changed -->\n')]));
    const p2 = await runAsync(['precheck-live', '--url', s.base, '--out-json', lj]);
    fs.writeFileSync(path.join(classicDir, 'index.html'), OLD['index.html']);
    fs.writeFileSync(path.join(classicDir, 'game.js'), GOOD['game.js']);
    const p3 = await runAsync(['precheck-live', '--url', s.base, '--out-json', lj]);
    s.server.close();
    push('live pre-check: a classic site whose bytes differ from the pins (index.html or game.js) is a STOP (exit 1), not a guess', p2.code === 1 && /pins need review/.test(p2.err) && p3.code === 1 && /frozen/.test(p3.err), JSON.stringify([firstLine(p2.err), firstLine(p3.err)]));
    const codes = [];
    for (const st of [403, 503, 429]) { const f = await fakeLive({ status: st }); codes.push((await runAsync(['precheck-live', '--url', f.base, '--out-json', lj])).code); f.server.close(); }
    const closed = await fakeLive({ dir: classicDir }); const deadBase = closed.base; closed.server.close();
    const pDead = await runAsync(['precheck-live', '--url', deadBase, '--out-json', lj]);
    const f404 = await fakeLive({ status: 404 }); const p404 = await runAsync(['precheck-live', '--url', f404.base, '--out-json', lj]); f404.server.close();
    push('live pre-check: 403 / 503 / 429 / connection refused = infrastructure STOP (exit 3, nothing assumed); a missing live index.html = STOP (exit 1)', codes.join(',') === '3,3,3' && pDead.code === 3 && p404.code === 1, JSON.stringify({ codes, refused: pDead.code, notFound: p404.code }));
    // Versioned live site: the anchor and the immutability of its bytes.
    s = await fakeLive({ dir: rel });
    const p5 = await runAsync(['precheck-live', '--url', s.base, '--out-json', lj]);
    const j5 = p5.code === 0 ? JSON.parse(fs.readFileSync(lj, 'utf8')) : {};
    push('live pre-check: a versioned site gives the live release id and the SHA-256 of its v/<id>/ files', p5.code === 0 && j5.era === 'versioned' && j5.anchorId === MAIN_ID && j5.anchorFiles && j5.anchorFiles['game.js'] === sha256(GOOD['game.js']), JSON.stringify({ code: p5.code, anchor: j5.anchorId, err: firstLine(p5.err) }));
    const v1 = await runAsync(['verify-live', '--url', s.base, '--release', rel, '--attempts', '1', '--delay-ms', '10']);
    s.server.close();
    const wrong = copyDir(rel, path.join(W, 'live-wrong'));
    fs.appendFileSync(path.join(wrong, `v/${MAIN_ID}/game.js`), '\n// other bytes\n');
    s = await fakeLive({ dir: wrong });
    const v2 = await runAsync(['verify-live', '--url', s.base, '--release', rel, '--attempts', '2', '--delay-ms', '50']);
    const p6 = await runAsync(['precheck-live', '--url', s.base, '--out-json', lj]);
    const later = makeHistory(path.join(W, 'h-immut'), [{ name: 'e3', days: 1 }, { name: 'next', days: 0, parent: 'e3' }], { tip: 'next' });
    const rImm = assembleFx(later, 'x', { live: JSON.parse(fs.readFileSync(lj, 'utf8')) });
    s.server.close();
    const s503 = await fakeLive({ status: 503 });
    const v3 = await runAsync(['verify-live', '--url', s503.base, '--release', rel, '--attempts', '1', '--delay-ms', '10']);
    s503.server.close();
    push('live post-check: a site serving the artifact passes; one changed file = STOP after the retries (exit 1); 503 = infrastructure (exit 3)', v1.code === 0 && v2.code === 1 && /does not match/.test(v2.err) && v3.code === 3, JSON.stringify({ ok: v1.code, wrong: [v2.code, firstLine(v2.err)], down: v3.code }));
    push('immutability: when the live v/<id>/ holds other bytes than git rebuilds for that id, the next assembly stops (an id never changes bytes)', p6.code === 0 && rImm.code === 1 && /immutability/.test(rImm.err), firstLine(rImm.err));
  }

  // ===================================================== correction 2: retention
  {
    const R = (label, commits, opts = {}) => { const h = makeHistory(path.join(W, 'h-ret-' + label), commits, opts); return h; };
    const live = (name) => ({ era: 'versioned', anchorId: idOf(name), anchorFiles: null });
    const chainOf = (names, ages, changed = () => ['game.js']) => names.map((n, i) => ({ name: n, days: ages[i], parent: i ? names[i - 1] : undefined, changed: changed(n, i) }));
    // 1. several releases in one day
    {
      const h = R('sameday', chainOf(['d1', 'd2', 'd3', 'd4'], [0.4, 0.3, 0.2, 0.1]));
      const r = assembleFx(h, 'x', { live: live('d3') });
      push('retention: several releases on one day are all kept', r.code === 0 && ['d4', 'd3', 'd2', 'd1'].every(n => kept(r.manifest).includes(idOf(n))), JSON.stringify(kept(r.manifest)));
    }
    // 2. more than 20 in 30 days; over the hard limit
    {
      const names = Array.from({ length: 25 }, (_, i) => 'm' + i);
      const r = assembleFx(R('many', chainOf(names, names.map((_, i) => 25 - i))), 'x', { live: live('m23') });
      const names2 = Array.from({ length: 65 }, (_, i) => 'n' + i);
      const r2 = assembleFx(R('toomany', chainOf(names2, names2.map((_, i) => (65 - i) * 0.4))), 'x', { live: live('n63') });
      push('retention: 25 releases within 30 days are all kept (no cap at 20); over the hard limit (60) the assembly stops instead of dropping any', r.code === 0 && kept(r.manifest).length === 25 && r2.code === 1 && /refusing to drop/.test(r2.err), JSON.stringify({ kept: kept(r.manifest).length, over: firstLine(r2.err) }));
    }
    // 3./4. workflow-only and release-script-only commits (older than 30 days)
    {
      const names = ['t0', 't1', 't2', 't3', 't4', 'wf', 'sc', 'd1', 'd2', 'tip'];
      const kinds = { wf: ['.github/workflows/deploy-pages.yml'], sc: ['.github/scripts/assemble-release.mjs'], d1: ['docs/GAME_DESIGN.md'], d2: ['qa/README.md'] };
      const r = assembleFx(R('wfsc', chainOf(names, [200, 190, 180, 170, 160, 150, 140, 130, 120, 100], (n) => kinds[n] || ['game.js'])), 'x', { live: live('tip') });
      const ks = kept(r.manifest);
      push('retention: a workflow-only and a release-script-only commit count as deploy-triggering (kept among the last 5 although older than 30 days), while docs/qa-only commits outside the window do not', r.code === 0 && ks.includes(idOf('wf')) && ks.includes(idOf('sc')) && !ks.includes(idOf('d1')) && !ks.includes(idOf('d2')) && !ks.includes(idOf('t2')) && ks.length === 5, JSON.stringify(r.manifest && r.manifest.releases.map(x => [x.id, x.reasons.join('/')])));
    }
    // 5. a manual (workflow_dispatch) release of a docs-only commit, old by commit date, live now
    // 6. no runtime change (docs-only) within 30 days
    {
      const c = [...chainOf(['r1', 'r2', 'r3', 'r4', 'r5', 'r6'], [200, 190, 180, 170, 160, 150]), { name: 'docs', days: 100, parent: 'r6', changed: ['docs/CHANGELOG.md'] }, { name: 'docs2', days: 3, parent: 'docs', changed: ['README.md'] }, { name: 'cur', days: 0, parent: 'docs2', changed: ['game.js'] }];
      const r = assembleFx(R('dispatch', c), 'x', { live: live('docs') });
      const ks = kept(r.manifest);
      const same = r.code === 0 && fs.readFileSync(path.join(r.out, `v/${idOf('docs2')}/game.js`)).equals(fs.readFileSync(path.join(r.out, `v/${idOf('cur')}/game.js`)));
      push('retention: a docs-only commit deployed by hand (workflow_dispatch) and live now is kept although its commit is 100 days old', r.code === 0 && ks.includes(idOf('docs')), JSON.stringify(r.manifest && r.manifest.releases.map(x => [x.id, x.reasons.join('/')])));
      push('retention: a commit without runtime changes inside the window is kept too (any main commit can be dispatched; its v/ holds the same bytes)', r.code === 0 && ks.includes(idOf('docs2')) && same, JSON.stringify({ kept: ks.length, sameBytes: same }));
    }
    // 7. redeploy of the same commit (re-run of the tip run)
    {
      const h = R('redeploy', chainOf(['p1', 'p2'], [5, 1]));
      const first = assembleFx(h, 'first', { live: live('p1') });
      const site = await fakeLive({ dir: first.out });
      const lj = path.join(W, 'live-redeploy.json');
      const pc = await runAsync(['precheck-live', '--url', site.base, '--out-json', lj]);
      site.server.close();
      const again = assembleFx(h, 'again', { live: JSON.parse(fs.readFileSync(lj, 'utf8')) });
      push('retention: re-deploying the same commit (live = this release) gives one v/<id>/ with identical bytes (checked against the live files)', pc.code === 0 && again.code === 0 && again.manifest.artifactSha256 === first.manifest.artifactSha256 && again.manifest.releases.find(x => x.id === idOf('p2')).reasons.includes('live now'), JSON.stringify({ pc: pc.code, again: again.code, same: again.manifest && again.manifest.artifactSha256 === first.manifest.artifactSha256 }));
    }
    // 8. commit without deployment: git cannot know -> kept; with the ledger -> not kept
    {
      const h = R('nodeploy', chainOf(['q1', 'q2', 'q3'], [10, 5, 0]));
      const r = assembleFx(h, 'git', { live: live('q1') });
      const lr = await l1(h, 'ledger', [dep('q1', 10)], { live: live('q1') });
      push('retention: a commit that was never deployed is kept by the git-only rule (--no-ledger: git cannot tell -- over-retention is the safe side) and dropped with the ledger of real publications (L1)', r.code === 0 && kept(r.manifest).includes(idOf('q2')) && lr.code === 0 && !kept(lr.as.manifest).includes(idOf('q2')) && kept(lr.as.manifest).includes(idOf('q1')), JSON.stringify({ git: kept(r.manifest), ledger: lr.as && kept(lr.as.manifest), err: firstLine(lr.err) }));
    }
    // 9. history shorter than five releases
    {
      const r = assembleFx(R('short', chainOf(['s1', 's2', 's3'], [120, 90, 60])), 'x', { live: live('s2') });
      push('retention: a history shorter than five releases keeps every one it has', r.code === 0 && kept(r.manifest).length === 3, JSON.stringify(kept(r.manifest)));
    }
    // 10. incomplete history (shallow clone, missing commit)
    {
      const r1 = assembleFx(R('shallow', chainOf(['h1', 'h2'], [2, 1]), { shallow: true }), 'x', { live: live('h1') });
      const c = chainOf(['g1', 'g2'], [2, 1]);
      c[0].parentSha = fakeSha('not-fetched');
      const r2 = assembleFx(R('gap', c), 'x', { live: live('g1') });
      push('retention: an incomplete history (shallow clone, a commit that is not there) stops the assembly instead of retaining less', r1.code === 1 && /shallow/.test(r1.err) && r2.code === 1 && /incomplete/.test(r2.err), JSON.stringify([firstLine(r1.err), firstLine(r2.err)]));
    }
    // 11. a historical module missing
    {
      const broken = { ...GOOD, 'game.js': Buffer.concat([Buffer.from("import './gone.js';\n"), GOOD['game.js']]) };
      const c = [{ name: 'k1', days: 3 }, { name: 'kb', days: 2, parent: 'k1', files: broken }, { name: 'k3', days: 1, parent: 'kb' }];
      const r = assembleFx(R('histmiss', c), 'x', { live: live('k1') });
      const r2 = assembleFx(R('histmiss-live', c), 'x', { live: live('kb') });
      push('retention: an old commit whose module is missing (never publishable) is left out with a logged warning; if it is the live release the assembly stops', r.code === 0 && !kept(r.manifest).includes(idOf('kb')) && r.manifest.excluded.some(x => x.id === idOf('kb')) && /not retained/.test(r.stdout) && r2.code === 1 && /gone\.js/.test(r2.err), JSON.stringify({ excluded: r.manifest && r.manifest.excluded.map(x => x.id), live: firstLine(r2.err) }));
    }
    // 13. the assembly script changes between releases; the old release's bytes stay
    {
      const cyc = { ...GOOD, 'game.js': Buffer.concat([Buffer.from("import './a.js';\n"), GOOD['game.js']]), 'a.js': "import './b.js';\n", 'b.js': '' };
      const c1 = [{ name: 'o1', days: 6, files: cyc, marker: Buffer.concat([MARKER, Buffer.from('\n// an older version of this script\n')]) }];
      const h1 = R('scriptchange-1', c1);
      const at1 = assembleFx(h1, 'then', { live: null });
      const h2 = R('scriptchange-2', [...c1, { name: 'o2', days: 0, parent: 'o1' }], { tip: 'o2' });
      const at2 = assembleFx(h2, 'now', { live: live('o1') });
      const sameBytes = at1.code === 0 && at2.code === 0 && walk(path.join(at1.out, 'v', idOf('o1'))).every(f => fs.readFileSync(path.join(at1.out, 'v', idOf('o1'), f)).equals(fs.readFileSync(path.join(at2.out, 'v', idOf('o1'), f))));
      push('retention: a release built when it was current is rebuilt byte-identically later, by a newer script, from its commit (the id is the commit, the bytes are its blobs)', sameBytes, JSON.stringify({ then: at1.code, now: at2.code, err: firstLine(at1.err || at2.err) }));
      const cyc2 = { ...cyc, 'b.js': "import './a.js';\n" };
      const h3 = R('scriptchange-3', [{ name: 'y1', days: 6, files: cyc2 }, { name: 'y2', days: 0, parent: 'y1' }], { tip: 'y2' });
      const at3 = assembleFx(h3, 'x', { live: null });
      push('retention: rules that apply only to the release being published (here: no import cycles) do not change which bytes an older id gets', at3.code === 0 && kept(at3.manifest).includes(idOf('y1')), JSON.stringify({ code: at3.code, kept: kept(at3.manifest), err: firstLine(at3.err) }));
    }
    // superseded: a run of an older commit deploys nothing
    {
      const r = assembleFx(R('superseded', chainOf(['u1', 'u2'], [1, 0])), 'x', { rev: fakeSha('u1'), live: live('u1') });
      push('retention: a run whose commit is no longer main\'s tip (a re-run of an older run) deploys nothing (exit 4; the workflow skips upload)', r.code === 4 && /nothing to deploy/.test(r.err) && !fs.existsSync(path.join(r.out, 'index.html')), firstLine(r.err));
    }
    // live release not on main
    {
      const r = assembleFx(R('foreign', chainOf(['f1', 'f2'], [1, 0])), 'x', { live: { era: 'versioned', anchorId: 'ffffffffffff', anchorFiles: null } });
      push('retention: a live release that is not on main\'s history (cannot be rebuilt) stops the assembly', r.code === 1 && /not on main/.test(r.err), firstLine(r.err));
    }
    // window boundary + the last 5 deploy-triggering
    {
      const names = ['b0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6'];
      const r = assembleFx(R('window', chainOf(names, [100, 90, 80, 70, 60, 50, 40])), 'x', { live: live('b6') });
      const ks = kept(r.manifest);
      push('retention: older than 30 days -> only the last 5 deploy-triggering commits stay (the 6th and 7th oldest go)', r.code === 0 && ks.length === 5 && !ks.includes(idOf('b0')) && !ks.includes(idOf('b1')), JSON.stringify(r.manifest && r.manifest.releases.map(x => x.id)));
    }
    // commit date != publication date (L1: the ledger of GitHub's deployment records)
    {
      const c = chainOf(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8'], [200, 190, 180, 170, 160, 150, 140, 0]);
      const at = (d) => (Date.parse(NOW) - Date.parse(d)) / (DAY * 1000);
      const deps = [['L1', '2026-04-01T00:00:00Z'], ['L2', '2026-04-11T00:00:00Z'], ['L3', '2026-04-21T00:00:00Z'], ['L4', '2026-05-01T00:00:00Z'], ['L5', '2026-05-11T00:00:00Z'], ['L6', '2026-05-21T00:00:00Z'],
        ['L2', '2026-10-09T00:00:00Z'], // a re-deploy (rollback) 10 days ago of a 190-day-old commit
        ['L7', '2026-10-19T11:55:00Z']].map(([n, d]) => dep(n, at(d)));
      const h = R('ledger', c);
      const r = await l1(h, 'x', deps, { live: live('L7') });
      const ks = kept(r.as && r.as.manifest);
      const bad = await l1(h, 'bad', deps, { live: live('L6') });
      push('retention (L1 ledger): kept = live within 30 days by publication date (L2 re-deployed 10 days ago although its commit is 190 days old, L6 live until then) + the last 5 published; a ledger that disagrees with the live site stops', r.code === 0 && ['L2', 'L4', 'L5', 'L6', 'L7', 'L8'].every(n => ks.includes(idOf(n))) && !ks.includes(idOf('L1')) && !ks.includes(idOf('L3')) && bad.code === 1 && /disagrees/.test(bad.err), JSON.stringify({ kept: r.as && r.as.manifest && r.as.manifest.releases.map(x => [x.id, x.reasons.join('/')]), err: firstLine(r.err), bad: firstLine(bad.err) }));
    }
    // The documented limit of the wired git mode, reproduced on purpose.
    {
      // P deployed long ago; six later pushes whose deploys failed (STOP);
      // then L deployed, then N a few minutes later: P was live minutes ago.
      const c = [{ name: 'P', days: 120 }, ...['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((n, i) => ({ name: n, days: 110 - i, parent: i ? 'f' + i : 'P' })), { name: 'L', days: 0.01, parent: 'f6' }, { name: 'N', days: 0, parent: 'L' }];
      const h = R('gap', c);
      const g = assembleFx(h, 'git', { live: live('L') });
      // GitHub's view: P published 120 days ago and inactive since L succeeded minutes ago (its success status is deleted: > 90 days), six failed deploys, L live.
      const deps = [dep('P', 120, 'success', { inactive: 10 / 1440 }), ...['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((n, i) => dep(n, 110 - i, 'failure')), dep('L', 12 / 1440)];
      const lg = await l1(h, 'ledger', deps, { live: live('L') });
      const gap = g.code === 0 && !kept(g.manifest).includes(idOf('P'));
      push('retention gap CLOSED by L1: the git-only rule (--no-ledger) still drops P, live minutes ago after failed deploys; the ledger keeps it (its success is past GitHub\'s 90-day status retention, so it counts as maybe published, never as not published)', gap && lg.code === 0 && kept(lg.as.manifest).includes(idOf('P')) && /maybe live within 30 days/.test(reasonsOf(lg.as.manifest, 'P')), JSON.stringify({ gitKeepsP: !gap, ledgerKeepsP: lg.as && kept(lg.as.manifest).includes(idOf('P')), why: lg.as && reasonsOf(lg.as.manifest, 'P'), err: firstLine(lg.err) }));
    }
  }

  // ===================================================== L1: the deployment ledger (GitHub REST, fake API)
  {
    const L = (label, commits, opts) => makeHistory(path.join(W, 'h-l1-' + label), commits, opts);
    const chainOf = (names, ages, files = {}) => names.map((n, i) => ({ name: n, days: ages[i], parent: i ? names[i - 1] : undefined, ...(files[n] ? { files: files[n] } : {}) }));
    const broken = { ...GOOD, 'game.js': Buffer.concat([Buffer.from("import './gone.js';\n"), GOOD['game.js']]) };
    const outputs = [];
    const track = (x) => { if (x) { outputs.push(x.out || '', x.err || ''); if (x.lg) outputs.push(x.lg.out, x.lg.err); if (x.as) outputs.push(x.as.stdout, x.as.err); } return x; };
    const ok = (x) => x.code === 0 && x.as && x.as.manifest && x.as.manifest.retentionMode === 'ledger' && x.as.manifest.excluded.length === 0;
    const allRequests = [];
    const lf = async (...a) => { const r = await ledgerFx(...a); allRequests.push(...r.api.requests); return track(r); };
    const run1 = async (...a) => { const r = await l1(...a); allRequests.push(...r.lg.api.requests); return track(r); };

    // 1. the first versioned (E3) deploy: GitHub holds only classic records (the real era epoch, no override)
    {
      const h = L('first', [{ name: 'e3', days: 0 }]);
      const classic = [dep('pre-e3', 60, 'success', { sha: fakeSha('pre-e3'), inactive: 40 }), dep('old-branch', 50, 'success', { sha: fakeSha('deleted claude/** branch'), inactive: 40 }), dep('pre-e3', 40, 'success', { sha: fakeSha('pre-e3'), inactive: 2 }), dep('pre-e3', 20, 'failure', { sha: fakeSha('pre-e3') }), dep('pre-e3', 2, 'success', { sha: fakeSha('pre-e3') })];
      const r = await run1(h, 'x', classic, { live: CLASSIC_LIVE, epoch: null });
      const files = r.as && r.as.manifest ? walk(r.as.out) : [];
      push('L1 first E3 deploy: only classic records -> no status read, only v/<current>/ is built (no invented earlier v/ folders), the root is still the frozen classic pair, the ledger says "classic era"', ok(r) && r.lg.ledger.statusesFetched === 0 && r.lg.ledger.relevant === 0 && kept(r.as.manifest).join() === idOf('e3') && files.join(',') === ['game.js', 'index.html', 'style.css', `v/${idOf('e3')}/game.js`, `v/${idOf('e3')}/style.css`].join(',') && sha256(fs.readFileSync(path.join(r.as.out, 'game.js'))) === REL.FROZEN.files['game.js'] && r.as.manifest.ledger.latestPublication === null && runWorkflowCheck(r.as.out, fakeSha('e3')).code === 0, JSON.stringify({ code: r.code, err: firstLine(r.err), files, statuses: r.lg.ledger && r.lg.ledger.statusesFetched }));
      const r2 = await run1(h, 'versioned-live', classic, { live: versioned('e3'), epoch: null });
      push('L1 first E3 deploy: a versioned live site while GitHub shows no versioned publication is a STOP (never guessed)', r2.code === 1 && /no successful versioned publication/.test(r2.err), firstLine(r2.err));
    }
    // 2. after the first deploy: the API shows it (or not yet: delay -> STOP; another sha -> STOP)
    {
      const h = L('second', chainOf(['x', 'n'], [0.05, 0]));
      const base = [dep('pre-e3', 30, 'success', { sha: fakeSha('pre-e3'), inactive: 0.02 })];
      const r = await run1(h, 'x', [...base, dep('x', 0.03)], { live: versioned('x'), epoch: null });
      const delay = await run1(h, 'delay', [...base, dep('x', 0.03, 'inflight')], { live: versioned('x'), epoch: null });
      const notYet = await run1(h, 'notyet', base, { live: versioned('x'), epoch: null });
      const other = await run1(h, 'other', [...base, dep('x', 0.03, 'success', { sha: fakeSha('n') })], { live: versioned('x'), epoch: null });
      push('L1 after the first E3 deploy: live v/<x>/ = the ledger\'s successful record of x -> kept as live + published; a record still in progress (exit 3), no record yet (API delay) or a record of another sha -> STOP', ok(r) && /live now/.test(reasonsOf(r.as.manifest, 'x')) && /ledger/.test(reasonsOf(r.as.manifest, 'x')) && r.as.manifest.ledger.latestPublication.sha === fakeSha('x') && delay.code === 3 && /still in_progress/.test(delay.err) && notYet.code === 1 && /retry later/.test(notYet.err) && other.code === 1 && /disagrees/.test(other.err), JSON.stringify({ ok: r.code, why: r.as && reasonsOf(r.as.manifest, 'x'), delay: firstLine(delay.err), notYet: firstLine(notYet.err), other: firstLine(other.err) }));
    }
    // 3. several valid deploys; 4. success later inactive; 11. live a few days, replaced inside the window
    {
      const h = L('several', chainOf(['a', 'b', 'c', 'd', 'n'], [26, 16, 6, 2, 0]));
      const r = await run1(h, 'x', [dep('a', 25, 'success', { inactive: 15 }), dep('b', 15, 'success', { inactive: 5 }), dep('c', 5, 'success', { inactive: 1 }), dep('d', 1)], { live: versioned('d') });
      push('L1 several deploys, each success later turned inactive by the next one: every one stays proven published (success visible < 90 days); all kept (live within 30 days, last 5)', ok(r) && ['a', 'b', 'c', 'd', 'n'].every(n => kept(r.as.manifest).includes(idOf(n))) && /live within 30 days \(ledger: published/.test(reasonsOf(r.as.manifest, 'b')), JSON.stringify({ kept: r.as && r.as.manifest.releases.map(x => [x.id, x.reasons.join('/')]), err: firstLine(r.err) }));
    }
    // 5. failure; 7. a failed deploy between two successful ones
    {
      const names = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'hh', 'n'];
      const h = L('failmid', chainOf(names, [61, 41, 26, 6, 5, 4, 3, 2, 0]));
      const r = await run1(h, 'x', [dep('a', 60), dep('b', 40, 'failure'), dep('c', 25), dep('d', 5), dep('e', 4), dep('f', 3), dep('g', 2), dep('hh', 1)], { live: versioned('hh') });
      const ks = kept(r.as && r.as.manifest);
      push('L1 a failed deploy (b) between two successful ones: b is not a publication -- not kept, listed as not published; a stays live until c (not until b), so it is kept by the 30-day window although it is not among the last 5', ok(r) && !ks.includes(idOf('b')) && ks.includes(idOf('a')) && /live within 30 days/.test(reasonsOf(r.as.manifest, 'a')) && !/last 5/.test(reasonsOf(r.as.manifest, 'a')) && r.as.manifest.ledger.notPublished.some(x => x.sha === fakeSha('b') && x.state === 'failure'), JSON.stringify({ kept: ks.length, a: r.as && reasonsOf(r.as.manifest, 'a'), err: firstLine(r.err) }));
    }
    // 6. pending / in_progress: recent = STOP (retry), stale = maybe published (kept)
    {
      const h = L('inflight', chainOf(['a', 's', 'n'], [10, 3, 0]));
      const recent = await run1(h, 'recent', [dep('a', 9), dep('s', 0.05, 'queued')], { live: versioned('a') });
      const recent2 = await run1(h, 'recent2', [dep('a', 9), dep('s', 0.05, 'inflight')], { live: versioned('a') });
      const stale = await run1(h, 'stale', [dep('a', 9), dep('s', 2.5, 'inflight')], { live: versioned('a') });
      push('L1 a deploy still queued / in_progress (younger than 6 h) stops the release (exit 3, retry later); a stale one (days old) counts as maybe published and is kept, never as not published', recent.code === 3 && /still queued/.test(recent.err) && recent2.code === 3 && /still in_progress/.test(recent2.err) && ok(stale) && /maybe/.test(reasonsOf(stale.as.manifest, 's')), JSON.stringify({ recent: firstLine(recent.err), recent2: firstLine(recent2.err), stale: stale.as && reasonsOf(stale.as.manifest, 's'), err: firstLine(stale.err) }));
    }
    // 8. the same sha published twice; 10. an older sha published again
    {
      const h = L('twice', chainOf(['x', 'y', 'n'], [21, 16, 0]));
      const r = await run1(h, 'x', [dep('x', 20, 'success', { inactive: 15 }), dep('y', 15, 'success', { inactive: 2 }), dep('x', 2)], { live: versioned('x') });
      const xs = r.as && r.as.manifest.releases.filter(x => x.id === idOf('x'));
      push('L1 the same sha published twice (and an older sha published again): one v/<id>/ folder, its reasons merged; y, live between the two, is kept by the window', ok(r) && xs.length === 1 && vDirs(r.as.out).filter(d => d === idOf('x')).length === 1 && kept(r.as.manifest).includes(idOf('y')) && /live within 30 days/.test(reasonsOf(r.as.manifest, 'y')) && /live now/.test(reasonsOf(r.as.manifest, 'x')), JSON.stringify({ v: vDirs(r.as ? r.as.out : W), err: firstLine(r.err) }));
    }
    // 9. rollback forward: A good, B bad (published), R1 = A's content as a new commit (published), tip N
    {
      const h = L('rollback', [{ name: 'A', days: 11 }, { name: 'B', days: 6, parent: 'A', files: { ...GOOD, 'game.js': BAD } }, { name: 'R1', days: 2, parent: 'B' }, { name: 'N', days: 0, parent: 'R1' }]);
      const r = await run1(h, 'x', [dep('A', 10, 'success', { inactive: 5 }), dep('B', 5, 'success', { inactive: 1 }), dep('R1', 1)], { live: versioned('R1') });
      const bBytes = r.as && fs.existsSync(path.join(r.as.out, 'v', idOf('B'), 'game.js')) && fs.readFileSync(path.join(r.as.out, 'v', idOf('B'), 'game.js')).equals(BAD);
      push('L1 forward rollback (A good -> B bad -> R1 = A\'s content as a new commit): A, B (its own bytes, never rewritten) and R1 stay; nothing is removed from v/', ok(r) && ['A', 'B', 'R1', 'N'].every(n => kept(r.as.manifest).includes(idOf(n))) && bBytes, JSON.stringify({ kept: r.as && kept(r.as.manifest).length, bBytes, err: firstLine(r.err) }));
    }
    // 12. older than 30 days but among the last 5; 13. more than 20 in 30 days; 14. over 60 = STOP
    {
      const names = ['a', 'b', 'c', 'd', 'e', 'f', 'n'];
      const h = L('last5', chainOf(names, [86, 81, 76, 71, 66, 61, 0]));
      const r = await run1(h, 'x', [dep('a', 85, 'success', { inactive: 80 }), dep('b', 80, 'success', { inactive: 75 }), dep('c', 75, 'success', { inactive: 70 }), dep('d', 70, 'success', { inactive: 65 }), dep('e', 65, 'success', { inactive: 60 }), dep('f', 60)], { live: versioned('f') });
      const ks = kept(r.as && r.as.manifest);
      push('L1 releases older than 30 days: the last 5 published stay (b..f), the 6th oldest (a) goes -- it was provably published, but outside both rules', ok(r) && ['b', 'c', 'd', 'e', 'f', 'n'].every(n => ks.includes(idOf(n))) && !ks.includes(idOf('a')) && ks.length === 6, JSON.stringify({ kept: r.as && r.as.manifest.releases.map(x => [x.id, x.reasons.join('/')]), err: firstLine(r.err) }));
      const m = Array.from({ length: 25 }, (_, i) => 'm' + i);
      const h2 = L('many', chainOf([...m, 'n'], [...m.map((_, i) => 26 - i), 0]));
      const r2 = await run1(h2, 'x', m.map((n, i) => dep(n, 25 - i, 'success', i < 24 ? { inactive: 24 - i } : {})), { live: versioned('m24'), perPage: 10 });
      const o = Array.from({ length: 65 }, (_, i) => 'o' + i);
      const h3 = L('toomany', chainOf([...o, 'n'], [...o.map((_, i) => (66 - i) * 0.4), 0]));
      const r3 = await run1(h3, 'x', o.map((n, i) => dep(n, (65 - i) * 0.4, 'success', i < 64 ? { inactive: (64 - i) * 0.4 } : {})), { live: versioned('o64'), perPage: 20 });
      push('L1 25 publications in 30 days are all kept (read over 3 pages); 65 within 30 days -> STOP "refusing to drop" (the 60 limit is never a silent cut)', ok(r2) && kept(r2.as.manifest).length === 26 && r2.lg.ledger.listing.pages === 3 && r3.code === 1 && /refusing to drop/.test(r3.err) && r3.lg.ledger.listing.pages === 4, JSON.stringify({ kept: r2.as && kept(r2.as.manifest).length, pages: r2.lg.ledger && r2.lg.ledger.listing.pages, over: firstLine(r3.err) }));
    }
    // 15. never published + broken -> may be left out; 16. published + broken -> STOP (the gap GPT found); 17. live + broken -> STOP; 30. never "excluded"
    {
      const h = L('broken', [{ name: 'a', days: 12 }, { name: 'k', days: 8, parent: 'a', files: broken }, { name: 'b', days: 4, parent: 'k' }, { name: 'n', days: 0, parent: 'b' }]);
      const never = await run1(h, 'never', [dep('a', 11, 'success', { inactive: 3 }), dep('b', 3)], { live: versioned('b') });
      const failed = await run1(h, 'failed', [dep('a', 11, 'success', { inactive: 3 }), dep('k', 7, 'failure'), dep('b', 3)], { live: versioned('b') });
      push('L1 an unrebuildable commit that was never published (no record, or a failed record) is left out, and the assembly passes', ok(never) && !kept(never.as.manifest).includes(idOf('k')) && ok(failed) && !kept(failed.as.manifest).includes(idOf('k')), JSON.stringify({ never: firstLine(never.err), failed: firstLine(failed.err) }));
      const pub = await run1(h, 'published', [dep('a', 11, 'success', { inactive: 7 }), dep('k', 7, 'success', { inactive: 3 }), dep('b', 3)], { live: versioned('b') });
      const gitOnly = assembleFx(h, 'gitonly', { live: versioned('b') });
      push('L1 GAP CLOSED: an unrebuildable release the ledger confirms as published (in retention) STOPs the assembly -- nothing written, not moved to "excluded", not a warning; the git-only rule (--no-ledger) still excludes it (the old behaviour, never used by the workflow)', pub.code === 1 && /must be kept/.test(pub.err) && /never left out/.test(pub.err) && /gone\.js/.test(pub.err) && !fs.existsSync(path.join(pub.as.out, 'index.html')) && !pub.as.manifest && gitOnly.code === 0 && gitOnly.manifest.excluded.some(x => x.id === idOf('k')), JSON.stringify({ ledger: [pub.code, firstLine(pub.err)], gitOnly: gitOnly.manifest && gitOnly.manifest.excluded.map(x => x.id) }));
      const maybe = await run1(h, 'maybe', [dep('a', 11, 'success', { inactive: 7 }), dep('k', 7, 'inflight'), dep('b', 3)], { live: versioned('b') });
      const liveK = await run1(h, 'live', [dep('a', 11, 'success', { inactive: 7 }), dep('k', 7)], { live: versioned('k') });
      push('L1 an unrebuildable release that is only MAYBE published (a stale record) is a STOP too; the unrebuildable live release is a STOP', maybe.code === 1 && /must be kept/.test(maybe.err) && liveK.code === 1 && /gone\.js/.test(liveK.err), JSON.stringify({ maybe: firstLine(maybe.err), live: firstLine(liveK.err) }));
    }
    // 18. ledger vs live
    {
      const h = L('mismatch', chainOf(['x', 'y', 'n'], [6, 3, 0]));
      const deps = [dep('x', 5, 'success', { inactive: 2 }), dep('y', 2)];
      const a = await run1(h, 'a', deps, { live: versioned('x') });
      const b = await run1(h, 'b', deps, { live: CLASSIC_LIVE });
      const c = await run1(h, 'c', [dep('x', 5, 'success', { inactive: 2 }), dep('y', 2, 'success', { inactive: 1 })], { live: versioned('y') });
      push('L1 a ledger that contradicts the live site is a STOP: live x but y published last; live classic but a versioned publication exists; the live release\'s record turned inactive with nothing newer', a.code === 1 && /disagrees/.test(a.err) && b.code === 1 && /live site is classic/.test(b.err) && c.code === 1 && /contradictory/.test(c.err), JSON.stringify([firstLine(a.err), firstLine(b.err), firstLine(c.err)]));
    }
    // 19.-21. invalid / duplicate / contradictory data
    {
      const h = L('data', chainOf(['x', 'y', 'n'], [6, 3, 0]));
      const good = () => [dep('x', 5, 'success', { inactive: 2 }), dep('y', 2)];
      const cases = {
        shortSha: [dep('x', 5), dep('y', 2, 'success', { sha: fakeSha('y').slice(0, 12) })],
        upperSha: [dep('x', 5), dep('y', 2, 'success', { sha: fakeSha('y').toUpperCase() })],
        otherRepo: [dep('x', 5), dep('y', 2, 'success', { extra: { repository_url: 'https://api.github.com/repos/someone/else' } })],
        otherEnv: [dep('x', 5), dep('y', 2, 'success', { extra: { environment: 'staging' } })],
        badTime: [dep('x', 5), dep('y', 2, 'success', { statuses: [['queued', 2], ['success', 'yesterday']], extra: { updated_at: iso(2) } })],
        statusBefore: [dep('x', 5), dep('y', 2, 'success', { statuses: [['success', 3]], extra: { updated_at: iso(2) } })],
        future: [dep('x', 5), dep('y', 2, 'success', { statuses: [['queued', 2], ['success', -1]] })],
        lateSuccess: [dep('x', 5), dep('y', 2, 'success', { statuses: [['queued', 2], ['success', 0.5]] })],
        chronology: [dep('x', 5, 'success', { id: 9100 }), dep('y', 2, 'success', { id: 9050 })]
      };
      const res = {};
      for (const [k, deps] of Object.entries(cases)) { const r = await lf(h, k, deps, { retention: false }); res[k] = [r.code, firstLine(r.err)]; }
      const dup = await lf(h, 'dup', [...good(), dep('x', 4), dep('x', 3.5)], { perPage: 2, fault: ({ path: p, page }) => p.endsWith('/deployments') && page === 2 ? { mutate: (slice, items) => [items[0], slice[1]] } : null });
      res.dup = [dup.code, firstLine(dup.err)];
      const want = { shortSha: /40-hex/, upperSha: /40-hex/, otherRepo: /belongs to/, otherEnv: /environment "staging"/, badTime: /status \d+ created_at is not a valid UTC timestamp/, statusBefore: /older than the deployment/, future: /in the future/, lateSuccess: /long after its creation/, chronology: /contradictory chronology/, dup: /listed twice/ };
      push('L1 bad records STOP the ledger (exit 1): a short or uppercase sha, another repository, another environment, an invalid / earlier-than-the-record / future status time, a success a day after its record, ids against creation times, a record listed twice across pages', Object.entries(want).every(([k, re]) => res[k][0] === 1 && re.test(res[k][1])), JSON.stringify(res));
    }
    // 22. incomplete pagination; 23. a missing statuses page; 25.-26. HTTP / timeout / JSON; 28. token
    {
      const h = L('http', chainOf(['x', 'y', 'n'], [6, 3, 0]));
      const deps = () => [dep('x', 5, 'success', { inactive: 2 }), dep('y', 2), dep('pre-e3', 1.5, 'failure', { sha: fakeSha('pre-e3') })];
      const isList = (p) => p.endsWith('/deployments');
      const pag = {
        noNext: await lf(h, 'nonext', deps(), { perPage: 2, fault: ({ path: p }) => isList(p) ? { link: '' } : null }),
        shortPage: await lf(h, 'short', deps(), { perPage: 2, fault: ({ path: p, page }) => isList(p) && page === 1 ? { mutate: (slice) => slice.slice(0, 1) } : null }),
        skip: await lf(h, 'skip', deps(), { perPage: 2, fault: ({ path: p }) => isList(p) ? { link: (mk) => `<${mk(3)}>; rel="next"` } : null })
      };
      const evil = await fakeApi([]);
      pag.elsewhere = await lf(h, 'elsewhere', deps(), { perPage: 2, fault: ({ path: p }) => isList(p) ? { link: `<${evil.base}/repos/${REPO}/deployments?page=2>; rel="next"` } : null });
      evil.server.close();
      push('L1 incomplete pagination STOPs: a full page without a next link that is followed by more, a short page that is not the last, a skipped page, a next link to another server (refused -- the token never leaves; that server got 0 requests)', pag.noNext.code === 1 && /incomplete pagination/.test(pag.noNext.err) && pag.shortPage.code === 1 && /incomplete pagination/.test(pag.shortPage.err) && pag.skip.code === 1 && /incomplete or reordered/.test(pag.skip.err) && pag.elsewhere.code === 1 && /refused/.test(pag.elsewhere.err) && evil.requests.length === 0, JSON.stringify({ ...Object.fromEntries(Object.entries(pag).map(([k, v]) => [k, [v.code, firstLine(v.err)]])), evilRequests: evil.requests.length }));
      const st = await lf(h, 'nostatuses', deps(), { fault: ({ path: p }) => /\/statuses$/.test(p) ? { status: 404 } : null });
      push('L1 a missing statuses page (HTTP 404) STOPs (exit 3) -- a record without its statuses is never read as published or not', st.code === 3 && /\/statuses\?\S*: HTTP 404/.test(st.err), firstLine(st.err));
      const http = {};
      for (const code of [401, 403, 404, 429, 500, 502]) { const r = await lf(h, 'h' + code, deps(), { fault: ({ path: p }) => isList(p) ? { status: code } : null }); http[code] = [r.code, firstLine(r.err)]; }
      const rate = await lf(h, 'rate', deps(), { fault: ({ path: p }) => isList(p) ? { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1792411200' } } : null });
      const hang = await lf(h, 'hang', deps(), { timeoutMs: 400, fault: ({ path: p }) => isList(p) ? 'hang' : null });
      const badjson = await lf(h, 'badjson', deps(), { fault: ({ path: p }) => /\/statuses$/.test(p) ? 'badjson' : null });
      const html = await lf(h, 'html', deps(), { fault: ({ path: p }) => isList(p) ? 'html' : null });
      push('L1 HTTP 401 / 403 / 404 / 429 / 500 / 502, an exhausted rate limit, a timeout, broken JSON and a non-JSON answer all STOP as infrastructure (exit 3), nothing assumed', Object.values(http).every(([c]) => c === 3) && /lacks deployments: read/.test(http[403][1]) && rate.code === 3 && /rate limit is exhausted/.test(rate.err) && hang.code === 3 && /timeout/.test(hang.err) && badjson.code === 3 && /not valid JSON/.test(badjson.err) && html.code === 3 && /not JSON/.test(html.err), JSON.stringify({ http, rate: firstLine(rate.err), hang: firstLine(hang.err), badjson: firstLine(badjson.err), html: firstLine(html.err) }));
      const noTok = await lf(h, 'notoken', deps(), { token: '' });
      push('L1 no token: STOP before any request (exit 3); a token without deployments: read (401/403) -> STOP', noTok.code === 3 && /no token/.test(noTok.err) && noTok.api.requests.length === 0 && http[401][0] === 3, JSON.stringify({ noToken: [noTok.code, firstLine(noTok.err), noTok.api.requests.length] }));
    }
    // 24. inactive without visible success; 27. status history cut by GitHub's 90-day retention
    {
      const h = L('inactive', [{ name: 'p', days: 125 }, { name: 'c', days: 30, parent: 'p' }, { name: 'q', days: 21, parent: 'c' }, { name: 'n', days: 0, parent: 'q' }]);
      const r = await run1(h, 'x', [dep('p', 120, 'success', { inactive: 20 }), dep('c', 29, 'cancelled'), dep('q', 20)], { live: versioned('q') });
      push('L1 an inactive record without a visible success: younger than 90 days (complete history) = not published (c, not kept); older (p: its success 120 days ago was deleted by GitHub, inactive since 20 days ago) = MAYBE published, kept -- p really was live 20 days ago', ok(r) && !kept(r.as.manifest).includes(idOf('c')) && r.as.manifest.ledger.notPublished.some(x => x.sha === fakeSha('c') && x.state === 'inactive') && kept(r.as.manifest).includes(idOf('p')) && /retention/.test(reasonsOf(r.as.manifest, 'p')), JSON.stringify({ kept: r.as && r.as.manifest.releases.map(x => [x.id, x.reasons.join('/')]), err: firstLine(r.err) }));
      const hb = L('inactive-broken', [{ name: 'p', days: 125, files: broken }, { name: 'q', days: 21, parent: 'p' }, { name: 'n', days: 0, parent: 'q' }]);
      const rb = await run1(hb, 'x', [dep('p', 120, 'success', { inactive: 20 }), dep('q', 20)], { live: versioned('q') });
      push('L1 truncated status history (90-day retention) + a release that cannot be rebuilt -> STOP: "maybe published" is never treated as "never published"', rb.code === 1 && /must be kept/.test(rb.err) && /maybe live/.test(rb.err), firstLine(rb.err));
    }
    // 29. a re-run of an old workflow when main is newer
    {
      const h = L('rerun', chainOf(['u1', 'u2'], [1.2, 0]));
      const r = await run1(h, 'x', [dep('u1', 1)], { live: versioned('u1'), rev: fakeSha('u1') });
      push('L1 a re-run of an older run (main has moved on): the ledger reads fine, the assembly is superseded (exit 4) and writes nothing -- the workflow then skips the deploy job, so no deployment record is created', r.lg.code === 0 && r.code === 4 && !fs.existsSync(path.join(r.as.out, 'index.html')), firstLine(r.err));
    }
    // the ledger file itself: stale, tampered, incomplete; no --no-ledger in CI; laziness
    {
      const h = L('file', chainOf(['x', 'y', 'n'], [6, 3, 0]));
      const lg = await lf(h, 'base', [dep('x', 5, 'success', { inactive: 2 }), dep('y', 2)]);
      const variant = (name, fn) => { const l = JSON.parse(fs.readFileSync(lg.file, 'utf8')); fn(l); const f = path.join(h, `ledger-${name}.json`); fs.writeFileSync(f, JSON.stringify(l)); return assembleFx(h, 'f-' + name, { live: versioned('y'), ledgerFile: f, extra: ['--era-epoch', EPOCH] }); };
      const stale = assembleFx(h, 'f-stale', { live: versioned('y'), ledgerFile: lg.file, now: '2026-10-19T13:00:00Z', extra: ['--era-epoch', EPOCH] });
      const res = {
        stale: [stale.code, firstLine(stale.err)],
        cut: (x => [x.code, firstLine(x.err)])(variant('cut', l => { l.statusesFetched = 1; delete l.deployments[1].statuses; })),
        dropped: (x => [x.code, firstLine(x.err)])(variant('dropped', l => { l.deployments.splice(1, 1); })),
        incomplete: (x => [x.code, firstLine(x.err)])(variant('incomplete', l => { l.listing.complete = false; })),
        repo: (x => [x.code, firstLine(x.err)])(assembleFx(h, 'f-repo', { live: versioned('y'), ledgerFile: lg.file, extra: ['--era-epoch', EPOCH, '--repository', 'someone/else'] }))
      };
      push('L1 the ledger file is re-checked by the assembly: read more than 15 min earlier, statuses cut short, a record dropped, not marked complete, or read from another repository -> STOP', Object.values(res).every(([c]) => c === 1) && /right before assembling/.test(res.stale[1]) && /incomplete/.test(res.cut[1]) && /count/.test(res.dropped[1]) && /complete/.test(res.incomplete[1]) && /this run is/.test(res.repo[1]), JSON.stringify(res));
      const ci = assembleFx(h, 'f-ci', { live: versioned('y'), env: { GITHUB_ACTIONS: 'true' } });
      const neither = run(['assemble', '--source', 'fixture', '--fixture', h, '--out', path.join(h, 'out-neither'), '--no-live-anchor', '--now', NOW]);
      const noLive = assembleFx(h, 'f-nolive', { ledgerFile: lg.file, extra: ['--era-epoch', EPOCH] });
      const lateEpoch = assembleFx(h, 'f-epoch', { live: versioned('y'), ledgerFile: lg.file, extra: ['--era-epoch', '2027-01-01T00:00:00Z'] });
      push('L1 no silent fallback to the git-only rule: --no-ledger is refused under GitHub Actions, an assembly without --ledger/--no-ledger is refused, the ledger needs the live site, --era-epoch can only move earlier (exit 2 each)', ci.code === 2 && /refused under GitHub Actions/.test(ci.err) && neither.code === 2 && /exactly one of --ledger/.test(neither.err) && noLive.code === 2 && /needs the live site/.test(noLive.err) && lateEpoch.code === 2, JSON.stringify([firstLine(ci.err), firstLine(neither.err), firstLine(noLive.err), firstLine(lateEpoch.err)]));
      const names = Array.from({ length: 40 }, (_, i) => 'z' + i);
      const hz = L('lazy', chainOf([...names, 'n'], [...names.map((_, i) => 81 - i), 0]));
      const rz = await run1(hz, 'x', names.map((n, i) => dep(n, 80 - i, 'success', i < 39 ? { inactive: 79 - i } : {})), { live: versioned('z39') });
      const statusReads = rz.lg.api.requests.filter(q => /\/statuses$/.test(q.path)).length;
      push('L1 statuses are read newest first only until the retention is settled (40 records -> the newest few), and the assembly agrees the ledger is enough', ok(rz) && statusReads === rz.lg.ledger.statusesFetched && statusReads < 15 && kept(rz.as.manifest).length === 6, JSON.stringify({ statusReads, kept: rz.as && kept(rz.as.manifest).length, err: firstLine(rz.err) }));
    }
    // ===== L1-R1 (K0 on the real GitHub API): GitHub's Link form, the `waiting` state, the deploying app
    const GH_PAGES_APP = { extra: { performed_via_github_app: { id: 1, slug: 'github-pages' } } };
    const onlyOwn = (reqs) => reqs.every(q => q.path.startsWith(`/repos/${REPO}/`));
    // B1: 264 records on 3 pages (like the real history), Link in the /repositories/<id>/ form (the fake API's default) and in the /repos/ form
    {
      const h = L('r1-pages', [{ name: 'e3', days: 0 }]);
      const many = Array.from({ length: 264 }, (_, i) => dep('pre-e3', 3 + i * 0.15, i % 5 ? 'success' : 'failure', { sha: fakeSha('pre-e3'), ...(i % 3 ? {} : GH_PAGES_APP) }));
      const idForm = await run1(h, 'idform', many, { live: CLASSIC_LIVE, epoch: null });
      const reposForm = await lf(h, 'reposform', many, { epoch: null, linkForm: 'repos' });
      const pinned = await lf(h, 'pinned', many, { epoch: null, repoId: null });
      const two = await lf(h, 'twohundred', many.slice(0, 200), { epoch: null });
      const listed = (api) => api.requests.map(q => q.query);
      const three = ['?environment=github-pages&per_page=100', '?environment=github-pages&per_page=100&page=2', '?environment=github-pages&per_page=100&page=3'];
      push('L1-R1 B1: GitHub\'s real Link form (/repositories/<id>/deployments?...&page=N) is accepted -- 264 records over 3 pages, exactly 3 GET requests, all to the run\'s own /repos/{o}/{r}/ URLs (never to the link\'s address); the /repos/ form and a run without $GITHUB_REPOSITORY_ID (id pinned by the first link) read the same; a full last page is proven by one own-URL probe; only v/<current>/ is built', ok(idForm) && idForm.lg.ledger.listing.pages === 3 && idForm.lg.ledger.listing.count === 264 && idForm.lg.ledger.requests === 3 && listed(idForm.lg.api).join() === three.join() && onlyOwn(idForm.lg.api.requests) && idForm.lg.ledger.source.repositoryId === REPO_ID && idForm.lg.ledger.statusesFetched === 0 && kept(idForm.as.manifest).join() === idOf('e3') && vDirs(idForm.as.out).join() === idOf('e3')
        && reposForm.code === 0 && reposForm.ledger.listing.count === 264 && listed(reposForm.api).join() === three.join() && pinned.code === 0 && pinned.ledger.listing.count === 264 && pinned.ledger.source.repositoryId === REPO_ID && onlyOwn(pinned.api.requests)
        && two.code === 0 && two.ledger.listing.count === 200 && two.ledger.requests === 3 && listed(two.api)[2] === three[2], JSON.stringify({ id: [idForm.code, idForm.lg.ledger && idForm.lg.ledger.listing, listed(idForm.lg.api)], repos: [reposForm.code, firstLine(reposForm.err)], pinned: [pinned.code, pinned.ledger && pinned.ledger.source.repositoryId], two: [two.code, listed(two.api)], err: firstLine(idForm.err) }));
    }
    // B1 negative: every bad next link = STOP before a second request; nothing sent to the link's address
    {
      const h = L('r1-badlink', chainOf(['x', 'y', 'n'], [6, 3, 0]));
      const deps = () => [dep('x', 5, 'success', { inactive: 2 }), dep('y', 2), dep('pre-e3', 1.5, 'failure', { sha: fakeSha('pre-e3') })];
      const isList = (p) => p.endsWith('/deployments');
      const evil = await fakeApi([]);
      const at1 = (fn) => ({ path: p, page }) => isList(p) && page === 1 ? { link: fn } : null;
      const cases = {
        host: [at1(() => `<${evil.base}/repositories/${REPO_ID}/deployments?environment=github-pages&per_page=2&page=2>; rel="next"`), /points elsewhere/],
        userinfo: [at1((mk) => `<${mk(2).replace('http://', 'http://evil@')}>; rel="next"`), /points elsewhere/],
        otherRepo: [at1((mk) => `<${mk(2, 'repos').replace(`/repos/${REPO}/`, '/repos/someone/else/')}>; rel="next"`), /points elsewhere/],
        otherRepoId: [at1((mk) => `<${mk(2).replace(REPO_ID, '1111111111')}>; rel="next"`), /names repository 1111111111/],
        endpoint: [at1((mk) => `<${mk(2).replace('/deployments?', '/releases?')}>; rel="next"`), /points elsewhere/],
        deeper: [at1((mk) => `<${mk(2).replace('/deployments?', '/deployments/1/statuses?')}>; rel="next"`), /points elsewhere/],
        escape: [at1((mk) => `<${mk(2).replace('/deployments?', '/deployments/../../../user/repos?')}>; rel="next"`), /points elsewhere/],
        environment: [at1((mk) => `<${mk(2).replace('environment=github-pages', 'environment=staging')}>; rel="next"`), /changes the query/],
        perPage: [at1((mk) => `<${mk(2).replace('per_page=2', 'per_page=1')}>; rel="next"`), /changes the query/],
        extraParam: [at1((mk) => `<${mk(2)}&ref=main>; rel="next"`), /changes the query/],
        dupParam: [at1((mk) => `<${mk(2)}&per_page=2>; rel="next"`), /changes the query/],
        noPage: [at1((mk) => `<${mk(2).replace('&page=2', '')}>; rel="next"`), /incomplete or reordered/],
        samePage: [at1((mk) => `<${mk(1)}>; rel="next"`), /incomplete or reordered/],
        skipPage: [at1((mk) => `<${mk(3)}>; rel="next"`), /incomplete or reordered/],
        oddPage: [at1((mk) => `<${mk(2).replace(/&page=2$/, '&page=02')}>; rel="next"`), /incomplete or reordered/],
        twoNext: [at1((mk) => `<${mk(2)}>; rel="next", <${mk(2, 'repos')}>; rel="next"`), /two rel="next"/],
        unreadable: [at1((mk) => `${mk(2)}; rel=next`), /unreadable Link/]
      };
      const res = {}, bad = [];
      for (const [k, [fault, re]] of Object.entries(cases)) {
        const r = await lf(h, 'link-' + k, deps(), { perPage: 2, fault });
        res[k] = [r.code, r.api.requests.length, firstLine(r.err)];
        if (!(r.code === 1 && re.test(r.err) && r.api.requests.length === 1 && onlyOwn(r.api.requests))) bad.push(k);
      }
      const envId = await lf(h, 'link-envid', deps(), { perPage: 2, repoId: '999' });
      const switched = await lf(h, 'link-switch', [...deps(), dep('pre-e3', 1.4, 'failure', { sha: fakeSha('pre-e3') })], { perPage: 1, repoId: null, fault: ({ path: p, page }) => isList(p) && page === 2 ? { link: (mk) => `<${mk(3).replace(REPO_ID, '1111111111')}>; rel="next"` } : null });
      res.envId = [envId.code, envId.api.requests.length, firstLine(envId.err)];
      res.switched = [switched.code, switched.api.requests.length, firstLine(switched.err)];
      if (!(envId.code === 1 && /this run reads repository 999/.test(envId.err) && envId.api.requests.length === 1)) bad.push('envId');
      if (!(switched.code === 1 && /names repository 1111111111/.test(switched.err) && switched.api.requests.length === 2)) bad.push('switched');
      evil.server.close();
      push(`L1-R1 B1 negative: ${Object.keys(res).length} bad next links each STOP (exit 1) before the next request -- another host, user info, another repository (by name or id, also against $GITHUB_REPOSITORY_ID or an id that changes between pages), another or a deeper endpoint, a ../ escape, a changed environment / per_page, an extra or repeated parameter, a missing / repeated / skipped / malformed page number, two next links, an unreadable header; only page 1 of the run's own URL was requested, the other server got 0 requests`, !bad.length && evil.requests.length === 0, JSON.stringify({ bad, evil: evil.requests.length, res }));
    }
    // B2: `waiting` (GitHub's first status on every real record)
    {
      const h = L('r1-waiting', chainOf(['a', 'c', 's', 'n'], [10, 6, 3, 0]));
      const real = await run1(h, 'real', [dep('a', 9, 'success', { inactive: 2 }), dep('s', 2)], { live: versioned('s') });
      const seq = real.lg.ledger && real.lg.ledger.deployments.map(d => (d.statuses || []).map(s => s.state).join('>'));
      const wfail = await run1(h, 'wfail', [dep('a', 9), dep('s', 2, 'failure', { statuses: [['waiting', 2], ['failure', 2 - 1 / 1440]] })], { live: versioned('a') });
      const fresh = await run1(h, 'fresh', [dep('a', 9), dep('s', 0.1, 'waiting')], { live: versioned('a') });
      const stale = await run1(h, 'stale', [dep('a', 9), dep('s', 0.26, 'waiting')], { live: versioned('a') });
      const inact = await run1(h, 'inactive', [dep('a', 9, 'success', { inactive: 5 }), dep('c', 5, 'success', { statuses: [['waiting', 5], ['inactive', 5 - 1 / 1440]] }), dep('s', 2)], { live: versioned('s') });
      const bogus = await run1(h, 'bogus', [dep('a', 9), dep('s', 2, 'success', { statuses: [['waiting', 2], ['bogus', 2 - 1 / 1440], ['success', 2 - 2 / 1440]] })], { live: versioned('s') });
      push('L1-R1 B2: the real chain waiting -> queued -> in_progress -> success (also followed by inactive) is a proven publication and kept; waiting -> failure and waiting -> inactive (no success, complete history) are not published; a fresh waiting (< 6 h) stops with retry later (exit 3); a waiting of 6 h or more is maybe published (kept, never "published", never "not published"); an unknown state (bogus) still STOPs', ok(real) && seq.join('|') === 'waiting>queued>in_progress>success|waiting>queued>in_progress>success>inactive' && /live now/.test(reasonsOf(real.as.manifest, 's')) && /published/.test(reasonsOf(real.as.manifest, 'a'))
        && ok(wfail) && !kept(wfail.as.manifest).includes(idOf('s')) && wfail.as.manifest.ledger.notPublished.some(x => x.sha === fakeSha('s') && x.state === 'failure')
        && fresh.code === 3 && /still waiting/.test(fresh.err) && ok(stale) && /maybe/.test(reasonsOf(stale.as.manifest, 's')) && /stale waiting/.test(reasonsOf(stale.as.manifest, 's')) && stale.as.manifest.ledger.unknown.some(x => x.sha === fakeSha('s')) && stale.as.manifest.ledger.latestPublication.sha === fakeSha('a')
        && ok(inact) && !kept(inact.as.manifest).includes(idOf('c')) && inact.as.manifest.ledger.notPublished.some(x => x.sha === fakeSha('c') && x.state === 'inactive') && /published/.test(reasonsOf(inact.as.manifest, 'a'))
        && bogus.code === 1 && /unknown status state "bogus"/.test(bogus.err), JSON.stringify({ seq, wfail: firstLine(wfail.err), fresh: firstLine(fresh.err), stale: stale.as && reasonsOf(stale.as.manifest, 's'), inact: firstLine(inact.err), bogus: firstLine(bogus.err) }));
    }
    // B2 + H1: the first and the second E3 deploy on records shaped like the real history (real era epoch)
    {
      const classic = [dep('pre-e3', 40, 'success', { sha: fakeSha('pre-e3'), ...GH_PAGES_APP }), dep('pre-e3', 20, 'success', { sha: fakeSha('pre-e3') }), dep('pre-e3', 5, 'success', { sha: fakeSha('pre-e3'), ...GH_PAGES_APP })];
      const r185 = dep('pre-e3', 1.2, 'success', { sha: fakeSha('pre-e3') }); // like #185: a classic release deployed after the epoch, by the workflow
      const h1 = L('r1-first', [{ name: 'e3', days: 0 }]);
      const first = await run1(h1, 'x', [...classic, r185], { live: CLASSIC_LIVE, epoch: null });
      const h2 = L('r1-second', chainOf(['e3', 'n'], [0.05, 0]));
      const second = await run1(h2, 'x', [...classic, r185, dep('e3', 0.03)], { live: versioned('e3'), epoch: null });
      const seq2 = second.lg.ledger && second.lg.ledger.deployments[0].statuses.map(s => s.state).join('>');
      push('L1-R1 first and second E3 deploy on real-shaped records (waiting first, github-pages app before the epoch, a classic release deployed by the workflow after the epoch like #185): first -> no status read, only v/<current>/, root = frozen pair; second -> the first E3 record (waiting -> ... -> success) is read and kept as live + published, the classic records get no v/ folder', ok(first) && first.lg.ledger.statusesFetched === 0 && kept(first.as.manifest).join() === idOf('e3') && vDirs(first.as.out).join() === idOf('e3') && sha256(fs.readFileSync(path.join(first.as.out, 'game.js'))) === REL.FROZEN.files['game.js']
        && ok(second) && second.lg.ledger.statusesFetched === 1 && seq2 === 'waiting>queued>in_progress>success' && /live now/.test(reasonsOf(second.as.manifest, 'e3')) && /published/.test(reasonsOf(second.as.manifest, 'e3')) && vDirs(second.as.out).join() === [idOf('e3'), idOf('n')].sort().join() && !vDirs(second.as.out).includes(idOf('pre-e3')), JSON.stringify({ first: [first.code, firstLine(first.err)], second: [second.code, seq2, second.as && second.as.manifest && second.as.manifest.releases.map(x => [x.id, x.reasons.join('/')]), firstLine(second.err)] }));
    }
    // H1: since the era epoch only the github-actions app may create github-pages records
    {
      const h = L('r1-app', chainOf(['x', 'n'], [0.05, 0]));
      const old = dep('pre-e3', 10, 'success', { sha: fakeSha('pre-e3'), ...GH_PAGES_APP });
      const app = (v) => ({ extra: { performed_via_github_app: v } });
      const good = await run1(h, 'good', [old, dep('x', 0.03)], { live: versioned('x'), epoch: null });
      const cases = {
        pagesApp: [dep('x', 0.03, 'success', app({ id: 1, slug: 'github-pages' })), /the app "github-pages"/],
        unknownApp: [dep('x', 0.03, 'success', app({ id: 7, slug: 'some-ci-app' })), /the app "some-ci-app"/],
        noApp: [dep('x', 0.03, 'success', app(null)), /no identifiable app \(null\)/],
        noSlug: [dep('x', 0.03, 'success', app({ id: 15368 })), /no identifiable app/],
        badSlug: [dep('x', 0.03, 'success', app({ id: 15368, slug: 42 })), /no identifiable app/],
        classicPagesApp: [dep('pre-e3', 1.2, 'success', { sha: fakeSha('pre-e3'), ...app({ id: 1, slug: 'github-pages' }) }), /the app "github-pages"/]
      };
      const res = {}, bad = [];
      for (const [k, [d, re]] of Object.entries(cases)) {
        const r = await run1(h, 'app-' + k, [old, ...(k === 'classicPagesApp' ? [d, dep('x', 0.03)] : [d])], { live: versioned('x'), epoch: null });
        res[k] = [r.code, firstLine(r.err)];
        if (!(r.code === 1 && re.test(r.err) && /Pages source/.test(r.err) && !r.as && !r.lg.ledger)) bad.push(k);
      }
      // the ledger file is re-checked by the assembly
      const variant = (name, fn) => { const l = JSON.parse(fs.readFileSync(good.lg.file, 'utf8')); fn(l); const f = path.join(h, `ledger-app-${name}.json`); fs.writeFileSync(f, JSON.stringify(l)); return assembleFx(h, 'app-file-' + name, { live: versioned('x'), ledgerFile: f, extra: ['--repository', REPO] }); };
      const fPages = variant('pages', l => { l.deployments[0].app = 'github-pages'; });
      const fMissing = variant('missing', l => { delete l.deployments[0].app; });
      const fOld = variant('old', l => { l.deployments[1].app = null; });
      res.file = [fPages.code, fMissing.code, fOld.code];
      push('L1-R1 H1: a record created since the era epoch by another app than github-actions STOPs with an owner check of Settings -> Pages -> Source -- github-pages (branch publishing), an unknown app, no app, no or an invalid slug, also for a classic sha (decided by date + app, not by the release kind); a classic github-pages record from before the epoch is accepted; the assembly re-checks the ledger file the same way (era record app changed or missing -> STOP; a pre-epoch record without an app -> fine)', ok(good) && good.lg.ledger.deployments[0].app === 'github-actions' && good.lg.ledger.deployments[1].app === 'github-pages' && !bad.length
        && fPages.code === 1 && /the app "github-pages"/.test(fPages.err) && fMissing.code === 1 && /no identifiable app/.test(fMissing.err) && fOld.code === 0, JSON.stringify({ good: [good.code, firstLine(good.err)], bad, res }));
    }

    // security: GET only, the token header, nothing leaked
    {
      const files = [];
      const scan = (d) => { if (!fs.existsSync(d)) return; for (const n of fs.readdirSync(d)) { const p = path.join(d, n); const st = fs.lstatSync(p); if (st.isDirectory()) scan(p); else if (/\.(json|html|md|txt)$/.test(n)) files.push(p); } };
      for (const d of fs.readdirSync(W).filter(n => n.startsWith('h-l1-') || n.startsWith('h-ret-'))) scan(path.join(W, d));
      const leakFiles = files.filter(f => fs.readFileSync(f, 'utf8').includes(TOKEN));
      const leakOut = outputs.filter(o => String(o).includes(TOKEN)).length;
      const methods = [...new Set(allRequests.map(q => q.method))];
      const authed = allRequests.every(q => q.auth === `Bearer ${TOKEN}`);
      const endpoints = [...new Set(allRequests.map(q => q.path.replace(/\/\d+\/statuses$/, '/{id}/statuses')))];
      push('L1 security: the reader only sends GET to the two documented endpoints of this repository, always with the token header; the token appears in no ledger, manifest, artifact, stdout or stderr', allRequests.length > 50 && methods.join() === 'GET' && authed && endpoints.sort().join() === [`/repos/${REPO}/deployments`, `/repos/${REPO}/deployments/{id}/statuses`].join() && !leakFiles.length && !leakOut && files.length > 20, JSON.stringify({ requests: allRequests.length, methods, authed, endpoints, scanned: files.length, leakFiles: leakFiles.length, leakOut }));
    }
  }

  // ===================================================== workflow
  {
    const wf = readWorkflow();
    const pathsBlock = /\n {4}paths:\n((?: {6}- .*\n)+)/.exec(wf);
    const wfPaths = pathsBlock ? pathsBlock[1].trim().split('\n').map(l => l.replace(/^\s*-\s*/, '').replace(/^'(.*)'$/, '$1')) : [];
    push('workflow: on.push.paths = the script\'s DEPLOY_PATHS (runtime, any .js/.css module, the release script, the workflow)', JSON.stringify(wfPaths) === JSON.stringify(REL.DEPLOY_PATHS), JSON.stringify(wfPaths));
    const order = ['Check the live site before deploying', 'Read the deployment ledger', 'Assemble release/', 'Verify release/ independently', 'Upload site', 'Deploy to GitHub Pages', 'Verify the live site'].map(n => wf.indexOf('- name: ' + n));
    const keepsPx04 = /\non:\n {2}push:\n {4}branches:\n {6}- main\n/.test(wf) && /\n {2}workflow_dispatch:\n/.test(wf) && !/pull_request|branches-ignore|tags:/.test(wf)
      && /\npermissions:\n {2}contents: read\n {2}pages: write\n {2}id-token: write\n {2}deployments: read\n\n/.test(wf) && (wf.match(/^\s*permissions:/gm) || []).length === 1 && /group: "pages"\n {2}cancel-in-progress: false/.test(wf)
      && (wf.match(/if: github\.ref == 'refs\/heads\/main'/g) || []).length === 3 && /upload-pages-artifact@v3\n\s+with:\n\s+path: release\n/.test(wf) && (wf.match(/persist-credentials: false/g) || []).length === 2 && /fetch-depth: 0/.test(wf);
    // Jobs: build (no environment) -> deploy (the only github-pages job: receive, check, upload, deploy) -> verify-live (no environment).
    const jobsText = wf.slice(wf.indexOf('\njobs:\n'));
    const heads = [...jobsText.matchAll(/\n {2}([\w-]+):\n/g)];
    const jobNames = heads.map(m => m[1]);
    const jobBody = (name) => { const i = heads.findIndex(m => m[1] === name); return i < 0 ? '' : jobsText.slice(heads[i].index, i + 1 < heads.length ? heads[i + 1].index : jobsText.length); };
    const build = jobBody('build'), deploy = jobBody('deploy'), verifyJob = jobBody('verify-live');
    const stepNames = (b) => [...b.matchAll(/- name: (.+)/g)].map(m => m[1].trim());
    const jobs = jobNames.join() === 'build,deploy,verify-live' && (wf.match(/\n {4}environment:/g) || []).length === 1 && /\n {4}environment:\n {6}name: github-pages\n/.test(deploy)
      && stepNames(deploy).join('|') === 'Receive release/|Check release/ is the verified folder|Check the live site is still what the build saw|Upload site|Deploy to GitHub Pages' && !/assemble-release\.mjs/.test(deploy)
      && /needs: build\n {4}if: github\.ref == 'refs\/heads\/main' && needs\.build\.outputs\.deploy == 'true'\n/.test(deploy) && /needs: \[build, deploy\]\n {4}if: github\.ref == 'refs\/heads\/main' && needs\.build\.outputs\.deploy == 'true'\n/.test(verifyJob)
      && /assemble-release\.mjs verify-live/.test(verifyJob) && !/upload-pages-artifact|deploy-pages/.test(build + verifyJob);
    const gated = ['Verify release/ independently', 'Fingerprint release/', 'Hand release/ to the deploy job'].every(n => new RegExp(`- name: ${n.replace(/[/.]/g, '\\$&')}\\n\\s+if: steps\\.assemble\\.outputs\\.deploy == 'true'`).test(build));
    const ledgerStep = /- name: Read the deployment ledger[\s\S]*?env:\n {10}GITHUB_TOKEN: \$\{\{ github\.token \}\}\n {10}API_URL: \$\{\{ github\.api_url \}\}\n {10}REPOSITORY: \$\{\{ github\.repository \}\}\n[\s\S]*?assemble-release\.mjs ledger \\\n\s+--source git --repo \. --api-url "\$API_URL" --repository "\$REPOSITORY"/.test(build)
      && /--ledger "\$RUNNER_TEMP\/ledger\.json" --repository "\$GITHUB_REPOSITORY"/.test(build) && !/--no-ledger|--era-epoch|--allow-non-tip|--max-requests/.test(wf) && (wf.match(/github\.token|secrets\./g) || []).length === 1;
    push('workflow: PX04 kept (push to main + dispatch only, github-pages, concurrency, path: release, persist-credentials: false), permissions = the three before + deployments: read only, fetch-depth 0, steps in order live check -> ledger -> assemble -> independent check -> upload -> deploy -> live check', keepsPx04 && order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), JSON.stringify({ keepsPx04, order }));
    push('workflow (L1): three jobs -- build (no environment), deploy (the ONLY github-pages job: receive the checked folder, upload, deploy; so a deployment record means exactly one real publication), verify-live (no environment: a red post-check never rewrites the record); deploy/verify run only when the build has something to deploy (a superseded run creates no record)', jobs && gated, JSON.stringify({ jobNames, jobs, gated, deploySteps: stepNames(deploy) }));
    // A re-run of the deploy job alone (an older run) must not publish over a newer release.
    {
      const script = workflowCheckScript('Check the live site is still what the build saw');
      const dir = path.join(W, 'wf-stale-live');
      fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'index.html'), 'live index A\n');
      const s = await fakeLive({ dir });
      const runStep = (env) => new Promise((resolve) => { const p = spawn('bash', ['-c', script], { env: { ...process.env, ...env } }); let out = ''; p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; }); p.on('close', code => resolve({ code, out })); });
      const same = await runStep({ BASE_URL: s.base + '/', LIVE_INDEX: sha256(Buffer.from('live index A\n')) });
      fs.writeFileSync(path.join(dir, 'index.html'), 'live index B (a newer release)\n');
      const changed = await runStep({ BASE_URL: s.base, LIVE_INDEX: sha256(Buffer.from('live index A\n')) });
      const empty = await runStep({ BASE_URL: s.base, LIVE_INDEX: '' });
      s.server.close();
      const down = await fakeLive({ status: 503 });
      const unreachable = await runStep({ BASE_URL: down.base, LIVE_INDEX: sha256(Buffer.from('live index A\n')) });
      down.server.close();
      push('workflow (L1): the deploy job re-checks the live index.html against the build\'s pre-check -- unchanged passes; changed (a newer release went live: a re-run of an older run\'s deploy job), unknown or unreachable (503) stops before the upload', same.code === 0 && changed.code === 1 && /changed since the build/.test(changed.out) && empty.code === 1 && unreachable.code !== 0, JSON.stringify({ same: same.code, changed: changed.code, empty: empty.code, unreachable: unreachable.code }));
    }
    push('workflow (L1): the ledger step reads with github.token only in its own env (the only token in the file), the assembly always gets --ledger (never --no-ledger or a test flag)', ledgerStep, String(ledgerStep));
    const checker = path.join(ROOT, '.claude/vertical-hole/tools/check_pages_workflow.py');
    const py = PYTHON && spawnSync(PYTHON.cmd, [...PYTHON.pre, '-I', checker, '--repo', ROOT], { encoding: 'utf8' });
    if (!PYTHON) notRun('workflow: check_pages_workflow.py', 'no Python 3 interpreter (VH_PYTHON, python3, python, py -3)');
    else {
      const neg = path.join(W, 'wf-neg');
      fs.mkdirSync(path.join(neg, '.github/workflows'), { recursive: true });
      const negWf = wf.replace(/(upload-pages-artifact@v3\n\s+with:\n\s+path: )release\n/, '$1.\n');
      fs.writeFileSync(path.join(neg, '.github/workflows/deploy-pages.yml'), negWf);
      const pyNeg = spawnSync(PYTHON.cmd, [...PYTHON.pre, '-I', checker, '--repo', neg], { encoding: 'utf8' });
      push('workflow: the pack\'s static Pages checker passes the new workflow (and still fails it with path: . in the Pages upload)', py.status === 0 && /PASS/.test(py.stdout) && negWf !== wf && pyNeg.status === 1, JSON.stringify({ python: PYTHON.label, pass: firstLine(py.stdout), neg: firstLine(pyNeg.stdout) }));
    }
    // The bash check catches what the script could get wrong.
    const tamper = (label, fn) => { const d = copyDir(rel, path.join(W, 'wft-' + label, 'release')); fn(d); return runWorkflowCheck(d, MAIN_SHA).code; };
    const res = {
      pin: tamper('pin', d => fs.appendFileSync(path.join(d, 'game.js'), '\n')),
      rootExtra: tamper('root', d => fs.writeFileSync(path.join(d, 'extra.js'), '')),
      srcRoot: tamper('src', d => { const f = path.join(d, 'index.html'); fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(`v/${MAIN_ID}/game.js`, 'game.js')); }),
      badId: tamper('id', d => fs.cpSync(path.join(d, 'v', MAIN_ID), path.join(d, 'v', 'latest'), { recursive: true })),
      ...(CAN_SYMLINK ? { symlink: tamper('link', d => fs.symlinkSync('game.js', path.join(d, 'v', MAIN_ID, 'alias.js'))) } : {}),
      missing: tamper('miss', d => fs.rmSync(path.join(d, 'v', MAIN_ID, 'style.css')))
    };
    if (!CAN_SYMLINK) notRun('workflow: its bash check fails a symlink', 'this OS refuses symlinks (Windows without Developer Mode)');
    push('workflow: its bash check fails a changed frozen pin, an extra root file, a script loaded from the root, a v/ folder that is not an id, a symlink and a missing stylesheet', Object.values(res).every(c => c === 1), JSON.stringify(res));
  }
  notRun('git source (gitHistory/gitTree) and the real CI run', 'no git commands in this session: the git-reading code path is reviewed, not executed; first executed by CI');
  notRun('live GitHub Pages (pre/post-check against the real site, headers)', 'no deployment; klaudiamoscinska-art.github.io is blocked by this container\'s proxy (403)');

  // ===================================================== browser: the artifact
  const origin = (u) => new URL(u).origin;
  {
    for (const prefix of ['', '/vector-hole']) {
      const s = await serve({ root: rel, prefix });
      const g = await openGame(s.url, { trackRequests: true });
      await g.page.waitForTimeout(400);
      const st = await g.page.evaluate(() => ({ bridge: { ...window.__qaBridge }, state: window.game.state, guard: SAVE_GUARD.state }));
      const own = paths(g.requests, origin(s.url));
      const want = [`${prefix}/index.html`, `${prefix}/v/${MAIN_ID}/game.js`, `${prefix}/v/${MAIN_ID}/style.css`].sort();
      const ok200 = g.requests.filter(r => r.url.startsWith(origin(s.url))).every(r => r.status === 200);
      push(`browser: new HTML at ${prefix || '/'} starts the game from v/<id>/ only (requests = index.html + v/<id>/game.js + v/<id>/style.css, all 200; bridge on the v/<id>/ module; no errors)`, own.join(',') === want.join(',') && ok200 && st.bridge.mode === 'module' && st.bridge.src.includes(`/v/${MAIN_ID}/game.js`) && st.state === 'MENU' && st.guard === 'ok' && g.errors.length === 0 && g.external.length === 0, JSON.stringify({ own, src: st.bridge.src, errors: g.errors.slice(0, 2) }));
      await g.browser.close();
      // The old (classic) HTML a browser may hold, against the same artifact.
      const old = await rawPage(s.url, { html: OLD['index.html'].toString('utf8') });
      const oown = paths(old.requests, origin(s.url));
      const owant = [`${prefix}/index.html`, `${prefix}/game.js`, `${prefix}/style.css`].sort();
      push(`browser: old HTML (63b50d0, from a cache) at ${prefix || '/'} starts the frozen classic game from the root (game.js/style.css), classic globals, no errors`, old.ready && old.st.bridge.mode === 'classic' && oown.join(',') === owant.join(',') && old.errors.length === 0, JSON.stringify({ oown, mode: old.st.bridge && old.st.bridge.mode, errors: old.errors.slice(0, 2) }));
      await old.close();
      s.server.close();
    }
    // MIME of the module as the QA server and python's http.server send it.
    const s = await serve({ root: rel });
    const g = await openGame(s.url);
    const mime = await g.page.evaluate(async (u) => (await fetch(u, { method: 'HEAD' })).headers.get('content-type'), s.url.replace('index.html', `v/${MAIN_ID}/game.js`));
    await g.browser.close(); s.server.close();
    push('browser: v/<id>/game.js is served as JavaScript (module scripts need it)', /^(text|application)\/javascript\b/.test(mime || ''), mime);
  }
  // Negative: "E2 alone" -- the old HTML loading the new module from the root.
  {
    const e2alone = copyDir(rel, path.join(W, 'e2-alone'));
    fs.writeFileSync(path.join(e2alone, 'game.js'), GOOD['game.js']);
    fs.writeFileSync(path.join(e2alone, 'index.html'), OLD['index.html']);
    const s = await serve({ root: e2alone, prefix: '/vector-hole' });
    const p = await rawPage(s.url);
    const syntax = p.errors.some(e => /Unexpected token 'export'|export/.test(e) && /SyntaxError|Unexpected/.test(e));
    push('negative: "E2 alone" (old cached HTML + the module under the old game.js address) really breaks: SyntaxError on export, no game -- the hazard E3 removes is reproduced', syntax && !p.st.game, JSON.stringify({ errors: p.errors.slice(0, 2), game: p.st.game }));
    await p.close(); s.server.close();
  }

  // ===================================================== browser: deploying while players play
  // Release A (the worktree), release B (same code + a comment: other bytes, other id).
  const hAB = makeHistory(path.join(W, 'h-ab'), [{ name: 'A', days: 1 }, { name: 'B', days: 0, parent: 'A', files: { ...GOOD, 'game.js': Buffer.concat([GOOD['game.js'], Buffer.from('\n// release B\n')]) } }], { tip: 'B' });
  const hA = makeHistory(path.join(W, 'h-a-only'), [{ name: 'A', days: 1 }], { tip: 'A' });
  const artA = assembleFx(hA, 'x');
  const artB = assembleFx(hAB, 'x', { live: { era: 'versioned', anchorId: idOf('A'), anchorFiles: null } });
  {
    const s = await serve({ root: artA.out, prefix: '/vector-hole', cacheControl: 'public, max-age=600' });
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ locale: 'pl-PL' });
    // No context.route() here: Playwright switches the HTTP cache off when
    // requests are intercepted, and these checks are about that cache.
    await installQaBridge(ctx);
    const home = s.url.replace('index.html', '');
    // (a) a player had A open: HTML and files in the HTTP cache (max-age=600); B deploys;
    // the player comes back by a link inside the site (a renderer navigation, which may
    // use the fresh cache -- Chromium does here).
    const a = await rawPage(home, { context: ctx });
    s.setRoot(artB.out);
    s.log.length = 0;
    await a.page.goto(s.url.replace('index.html', `v/${idOf('A')}/style.css`));
    await Promise.all([a.page.waitForNavigation(), a.page.evaluate((u) => { location.href = u; }, home)]);
    await a.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 12000 });
    const sa = await a.page.evaluate(() => window.__qaBridge.src);
    const htmlFromCache = !s.log.some(u => u === '/vector-hole/' || u.endsWith('/index.html'));
    push('mixed (real HTTP cache): A open, B deployed, back by a link within max-age=600 -- HTML A comes from the browser cache and runs its own v/<A>/, one instance, no errors', htmlFromCache && sa.includes(`/v/${idOf('A')}/`) && a.errors.length === 0, JSON.stringify({ serverSaw: s.log, src: sa }));
    await a.close();
    // (b) only HTML A is in the cache (its script was never fetched / was evicted):
    // the files come from the B deployment, which still holds v/<A>/.
    const b2 = await (await chromium.launch()).newContext({ locale: 'pl-PL' });
    await installQaBridge(b2);
    s.setRoot(artA.out);
    const warm = await b2.newPage();
    await warm.goto(s.url.replace('index.html', `v/${idOf('A')}/style.css`));
    await warm.evaluate((u) => fetch(u).then(r => r.text()), home);
    await warm.close();
    s.setRoot(artB.out);
    s.log.length = 0;
    const pb = await rawPage(s.url.replace('index.html', `v/${idOf('B')}/style.css`), { context: b2, wait: false });
    await Promise.all([pb.page.waitForNavigation(), pb.page.evaluate((u) => { location.href = u; }, home)]);
    const okB = await pb.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 12000 }).then(() => true, () => false);
    const sb = okB ? await pb.page.evaluate(() => window.__qaBridge.src) : null;
    const fromB = s.log.includes(`/vector-hole/v/${idOf('A')}/game.js`) && !s.log.some(u => u === '/vector-hole/' || u.endsWith('/index.html'));
    push('mixed (real HTTP cache): only HTML A cached, B deployed -- HTML A from the cache, its v/<A>/ files fetched from the B deployment (retained), the game starts, no 404', okB && fromB && sb.includes(`/v/${idOf('A')}/`) && pb.errors.length === 0 && pb.requests.every(r => r.status === 200), JSON.stringify({ serverSaw: s.log, src: sb }));
    await pb.close();
    // Negative control: the same steps against a B deployment WITHOUT v/<A>/ (no retention) must break.
    const noRet = copyDir(artB.out, path.join(W, 'b-without-a'));
    fs.rmSync(path.join(noRet, 'v', idOf('A')), { recursive: true });
    s.setRoot(artA.out);
    const b3 = await b2.browser().newContext({ locale: 'pl-PL' });
    await installQaBridge(b3);
    const warm3 = await b3.newPage();
    await warm3.goto(s.url.replace('index.html', `v/${idOf('A')}/style.css`));
    await warm3.evaluate((u) => fetch(u).then(r => r.text()), home);
    await warm3.close();
    s.setRoot(noRet);
    s.log.length = 0;
    const pn = await rawPage(s.url.replace('index.html', `v/${idOf('B')}/style.css`), { context: b3, wait: false });
    await Promise.all([pn.page.waitForNavigation(), pn.page.evaluate((u) => { location.href = u; }, home)]);
    const okN = await pn.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 6000 }).then(() => true, () => false);
    const htmlCached = !s.log.some(u => u === '/vector-hole/' || u.endsWith('/index.html'));
    push('mixed negative control: the same cached HTML A against a deployment WITHOUT v/<A>/ really fails (its script 404s, no game) -- the check above can see the failure it guards against', !okN && htmlCached && s.log.includes(`/vector-hole/v/${idOf('A')}/game.js`) && !fs.existsSync(path.join(noRet, 'v', idOf('A'))), JSON.stringify({ started: okN, serverSaw: s.log }));
    await pn.close();
    await b2.browser().close();
    s.setRoot(artB.out);
    const forced = await rawPage(s.url, { context: ctx, html: fs.readFileSync(path.join(artA.out, 'index.html'), 'utf8') });
    push('mixed: HTML A (forced, like a CDN/browser copy) + the B deployment: A\'s own v/<A>/ is still there (retained), the game starts, no 404', forced.ready && forced.st.bridge.src.includes(`/v/${idOf('A')}/`) && forced.errors.length === 0 && forced.requests.every(r => r.status === 200), JSON.stringify({ src: forced.st.bridge && forced.st.bridge.src, bad: forced.requests.filter(r => r.status !== 200) }));
    await forced.close();
    // A page opened on A, kept open across the deploy, then the game reloads itself (language switch).
    s.setRoot(artA.out);
    const longOpen = await rawPage(s.url, { context: ctx });
    await longOpen.page.evaluate(() => { const s0 = window.game.save; s0.coins = 777; saveGame(s0); });
    s.setRoot(artB.out);
    await Promise.all([longOpen.page.waitForNavigation(), longOpen.page.evaluate(() => window.game.setLanguage('en'))]);
    await longOpen.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready, null, { timeout: 12000 });
    const after = await longOpen.page.evaluate(() => ({ src: window.__qaBridge.src, coins: window.game.save.coins, lang: document.documentElement.lang, guard: SAVE_GUARD.state }));
    push('mixed: a page left open on A while B deploys, then reloaded by the game (language switch), comes back on B with the save kept', after.src.includes(`/v/${idOf('B')}/`) && after.coins === 777 && after.lang === 'en' && after.guard === 'ok' && longOpen.errors.length === 0, JSON.stringify(after));
    await longOpen.close();
    await browser.close(); s.server.close();
  }
  // The save: one origin, old and new code, both ways.
  {
    const both = copyDir(artB.out, path.join(W, 'save-both'));
    fs.writeFileSync(path.join(both, 'old.html'), OLD['index.html']);
    const s = await serve({ root: both, prefix: '/vector-hole' });
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ locale: 'pl-PL' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    await installQaBridge(ctx);
    const n1 = await rawPage(s.url, { context: ctx });
    const w1 = await n1.page.evaluate(() => { const s0 = window.game.save; s0.coins = 4321; s0.prisms = 17; saveGame(s0); return { eco: s0.economy, slot: SAVE_SLOT }; });
    const o = await rawPage(s.url.replace('index.html', 'old.html'), { context: ctx });
    const r = await o.page.evaluate(() => { const g = window.game; const out = { coins: g.save.coins, prisms: g.save.prisms, eco: g.save.economy, guard: SAVE_GUARD.state, schema: g.save.schemaVersion }; g.save.coins = 4322; saveGame(g.save); return out; });
    await n1.page.reload();
    await n1.page.waitForFunction(() => window.game && window.__qaBridge && window.__qaBridge.ready);
    const back = await n1.page.evaluate(() => ({ coins: window.game.save.coins, eco: window.game.save.economy, guard: SAVE_GUARD.state, rescue: localStorage.getItem('vectorHoleSave_v1.rescue') }));
    push('save: one origin -- the new code (v/<id>/) and the old classic code (root) read and write the same v13 save (vectorHoleSave_v1), guard ok both ways, the D+ marker kept, no second refund, no rescue copy', w1.slot === 'vectorHoleSave_v1' && r.coins === 4321 && r.prisms === 17 && r.guard === 'ok' && r.schema === 13 && r.eco && r.eco.looksOnly === 1 && back.coins === 4322 && back.guard === 'ok' && back.eco.looksOnly === 1 && JSON.stringify(back.eco) === JSON.stringify(w1.eco) && back.rescue === null && !n1.errors.length && !o.errors.length, JSON.stringify({ old: r, back }));
    await browser.close(); s.server.close();
  }

  // ===================================================== correction 3: rollback
  {
    // main: A (good) -> B (bad: throws at start) -> R1 (content of A restored, a new commit)
    //       -> R2 (emergency: the classic 63b50d0 runtime restored; release script kept).
    const commits = [
      { name: 'A', days: 3 }, { name: 'B', days: 2, parent: 'A', files: { ...GOOD, 'game.js': BAD } },
      { name: 'R1', days: 1, parent: 'B' }, { name: 'R2', days: 0, parent: 'R1', files: { ...OLD } }
    ];
    const hB = makeHistory(path.join(W, 'h-rb-B'), commits.slice(0, 2), { tip: 'B' });
    const hR1 = makeHistory(path.join(W, 'h-rb-R1'), commits.slice(0, 3), { tip: 'R1' });
    const hR2 = makeHistory(path.join(W, 'h-rb-R2'), commits, { tip: 'R2' });
    const live = (n) => ({ era: 'versioned', anchorId: idOf(n), anchorFiles: null });
    const xB = assembleFx(hB, 'x', { live: live('A') }), xR1 = assembleFx(hR1, 'x', { live: live('B') }), xR2 = assembleFx(hR2, 'x', { live: live('R1') });
    const s = await serve({ root: xB.out, prefix: '/vector-hole', cacheControl: 'public, max-age=600' });
    const bad = await rawPage(s.url);
    push('rollback 1: the bad release B is detected in the browser (its own start error, no game) -- what the live check and the owner would see', !bad.st.game && bad.errors.some(e => /VH-E3-BAD-RELEASE/.test(e)), JSON.stringify(bad.errors.slice(0, 1)));
    await bad.close();
    s.setRoot(xR1.out);
    const htmlOf = (out) => fs.readFileSync(path.join(out, 'index.html'), 'utf8');
    const p2 = await rawPage(s.url);
    const p3a = await rawPage(s.url, { html: htmlOf(artA.out) });
    const p3b = await rawPage(s.url, { html: htmlOf(xB.out) });
    const p3c = await rawPage(s.url, { html: OLD['index.html'].toString('utf8') });
    push('rollback 2: the forward rollback R1 (A\'s content as a new commit) starts the good game from v/<R1>/', p2.ready && p2.st.bridge.src.includes(`/v/${idOf('R1')}/`) && !p2.errors.length, JSON.stringify({ src: p2.st.bridge && p2.st.bridge.src }));
    push('rollback 3: after R1, cached HTML still loads its own release: A -> v/<A>/ works, B -> v/<B>/ (no 404: the same broken build, nothing new), the classic HTML -> the frozen root', p3a.ready && p3a.st.bridge.src.includes(`/v/${idOf('A')}/`) && p3b.requests.every(r => r.status === 200) && p3b.errors.some(e => /VH-E3-BAD-RELEASE/.test(e)) && p3c.ready && p3c.st.bridge.mode === 'classic', JSON.stringify({ a: p3a.st.bridge && p3a.st.bridge.src, b404: p3b.requests.filter(r => r.status !== 200).length, classic: p3c.st.bridge && p3c.st.bridge.mode }));
    for (const p of [p2, p3a, p3b, p3c]) await p.close();
    const wfOk = [[xB, 'B'], [xR1, 'R1'], [xR2, 'R2']].every(([x, n]) => x.code === 0 && runWorkflowCheck(x.out, fakeSha(n)).code === 0 && run(['verify', '--release', x.out, '--id', idOf(n)]).code === 0);
    const keptAll = xR1.code === 0 && ['A', 'B', 'R1'].every(n => kept(xR1.manifest).includes(idOf(n))) && xR2.code === 0 && ['A', 'B', 'R1', 'R2'].every(n => kept(xR2.manifest).includes(idOf(n)));
    push('rollback 4: every artifact on the way (B, R1, R2) is complete (script verify + workflow bash) and keeps the earlier v/ folders; the root pair never changes', wfOk && keptAll && [xB, xR1, xR2].every(x => sha256(fs.readFileSync(path.join(x.out, 'game.js'))) === REL.FROZEN.files['game.js']), JSON.stringify({ wfOk, keptAll, r2: kept(xR2.manifest) }));
    // R2: an emergency return to the classic runtime keeps working for every cached HTML.
    s.setRoot(xR2.out);
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ locale: 'pl-PL' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    await installQaBridge(ctx);
    const r1page = await rawPage(s.url, { context: ctx, html: htmlOf(xR1.out) });
    await r1page.page.evaluate(() => { const s0 = window.game.save; s0.coins = 2468; saveGame(s0); });
    const r2page = await rawPage(s.url, { context: ctx });
    const r2st = await r2page.page.evaluate(() => ({ coins: window.game.save.coins, guard: SAVE_GUARD.state, schema: window.game.save.schemaVersion, eco: window.game.save.economy, tag: document.querySelector('script[src]').outerHTML }));
    push('rollback 5: the emergency classic restore R2 is published as v/<R2>/ with a classic <script src>, starts in classic mode, reads the save written by the module release (v13, guard ok, D+ marker kept)', r2page.ready && r2page.st.bridge.mode === 'classic' && /src="v\/[0-9a-f]{12}\/game\.js"/.test(r2st.tag) && !/type="module"/.test(r2st.tag) && r2st.coins === 2468 && r2st.guard === 'ok' && r2st.schema === 13 && r2st.eco.looksOnly === 1 && !r2page.errors.length && !r1page.errors.length, JSON.stringify(r2st));
    await browser.close(); s.server.close();
  }
  return results;
}

if (isMain(import.meta.url)) {
  const results = await runReleaseChecks();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} release checks passed`);
  process.exit(failed ? 1 : 0);
}
