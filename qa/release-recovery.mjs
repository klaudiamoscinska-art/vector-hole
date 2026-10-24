// K2: the break-glass recovery run of .github/scripts/assemble-release.mjs
// and .github/workflows/deploy-pages.yml (docs/E3_ROLLBACK_PLAN.md §4).
// Dev-only, no browser: runs the real script as a child process (the code CI
// runs) on snapshot histories in qa/out/, against a loopback fake GitHub API
// (deployment records, GET only) and a loopback fake Pages site, plus the
// workflow's own bash steps.
//   node qa/release-recovery.mjs
// Covers:
// - authorization: only a first-attempt workflow_dispatch on main by the
//   repository owner, for main's sha, with a valid live id and reason; a
//   standard run takes no recovery input; a record is never reused by
//   another run;
// - the standard run is unchanged: a damaged live release, a wrong type, a
//   ledger/live disagreement, an API outage still stop it; it never accepts
//   a recovery pre-check;
// - the live stylesheet's type is checked like the scripts' (K2F-1R): a
//   standard run stops on it, a recovery records it and checks its bytes;
// - recovery: a missing (404) or mistyped live file is rebuilt from git with
//   the same bytes; different bytes, other HTTP errors, a classic index or
//   root pair off its pins, an unexpected live state, an API outage, a moved
//   main, a release the ledger needs but git cannot rebuild, a disagreement
//   the ledger does not cover and a lower save schema all STOP; retention is
//   the standard run's; the standard run after a recovery passes.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { report, ROOT, OUT, revisionFile } from './lib.mjs';

const SCRIPT = path.join(ROOT, '.github/scripts/assemble-release.mjs');
const WORKFLOW = path.join(ROOT, '.github/workflows/deploy-pages.yml');
// The checks match the workflow line by line; a CRLF checkout (Windows,
// core.autocrlf) must not turn them into false FAILs.
const readWorkflow = () => fs.readFileSync(WORKFLOW, 'utf8').replace(/\r\n/g, '\n');
const REL = await import(pathToFileURL(SCRIPT).href); // a bare Windows path (C:\...) is not an ESM URL
const BASE = REL.FROZEN.rev;
const W = path.join(OUT, 'release-recovery');
const NOW = '2026-10-19T12:00:00Z';
const DAY = 86400;
const T0 = Date.parse(NOW) / 1000;
const EPOCH = '2025-01-01T00:00:00Z';
const REPO = 'vh-owner/vector-hole';
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const fakeSha = (name) => crypto.createHash('sha1').update('vh-k2:' + name).digest('hex');
const idOf = (name) => fakeSha(name).slice(0, 12);
const repoFile = (f) => fs.readFileSync(path.join(ROOT, f));
const GOOD = { 'index.html': repoFile('index.html'), 'game.js': repoFile('game.js'), 'style.css': repoFile('style.css') };
const OLD = { 'index.html': revisionFile(BASE, 'index.html'), 'game.js': revisionFile(BASE, 'game.js'), 'style.css': revisionFile(BASE, 'style.css') };
const MARKER = fs.readFileSync(SCRIPT);
const withJs = (tag, js = GOOD['game.js']) => ({ ...GOOD, 'game.js': Buffer.concat([js, Buffer.from(`\n// ${tag}\n`)]) });

/* ---------------------------------------------------------------- the real script */
function runAsync(args, env = {}, cwd = ROOT) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ['--experimental-vm-modules', '--no-warnings', SCRIPT, ...args], { cwd, env: { ...process.env, GITHUB_ACTIONS: '', GITHUB_REPOSITORY_ID: '', ...env } });
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
    p.on('close', code => resolve({ code, out, err, all: out + err }));
  });
}
const last = (s) => String(s || '').trim().split('\n').filter(Boolean).pop() || '';

/* ---------------------------------------------------------------- snapshot histories
   commits: [{ name, days, parent (name) | parentSha, files, marker }]; the first one's parent is the classic pre-e3 commit. */
function makeHistory(dir, commits, { tip } = {}) {
  fs.rmSync(dir, { recursive: true, force: true });
  const json = { tip: fakeSha(tip || commits[commits.length - 1].name), commits: {} };
  const write = (tree, files) => { for (const [p, d] of Object.entries(files)) { const abs = path.join(dir, tree, p); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, d); } };
  commits.forEach((c, i) => {
    const tree = path.join('trees', c.name);
    const files = { ...(c.files || GOOD) };
    if (c.marker !== false) files[REL.ERA_MARKER] = MARKER;
    write(tree, files);
    const parent = c.parentSha || (c.parent ? fakeSha(c.parent) : i ? fakeSha(commits[i - 1].name) : fakeSha('pre-e3'));
    json.commits[fakeSha(c.name)] = { time: T0 - Math.round((c.days || 0) * DAY), parents: [parent], changed: ['game.js'], tree };
  });
  write(path.join('trees', 'pre-e3'), OLD);
  json.commits[fakeSha('pre-e3')] = { time: T0 - 400 * DAY, parents: [], changed: [], tree: path.join('trees', 'pre-e3') };
  fs.mkdirSync(path.join(dir, 'frozen'), { recursive: true });
  for (const f of ['game.js', 'style.css']) fs.writeFileSync(path.join(dir, 'frozen', f), OLD[f]);
  fs.writeFileSync(path.join(dir, 'history.json'), JSON.stringify(json, null, 2));
  return dir;
}

/* ---------------------------------------------------------------- fake GitHub API (GET only) */
const iso = (daysAgo) => new Date(Date.parse(NOW) - Math.round(daysAgo * DAY * 1000)).toISOString().replace(/\.000Z$/, 'Z');
/** A github-pages record of commit `name`, created `days` ago; kind success | failure. */
const dep = (name, days, kind = 'success') => ({ sha: fakeSha(name), days, kind });
function fakeApi(deps, { fault = null } = {}) {
  const sorted = [...deps].sort((a, b) => b.days - a.days); // oldest first
  sorted.forEach((d, i) => {
    d._id = 9000 + i;
    const steps = [['waiting', 0], ['queued', 0], ['in_progress', 1], [d.kind, 3]];
    d._st = steps.map(([state, min], k) => ({ id: d._id * 10 + k, state, at: iso(d.days - min / 1440) }));
  });
  const requests = [];
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      requests.push(req.method + ' ' + u.pathname);
      const api = `http://127.0.0.1:${server.address().port}`;
      const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); };
      if (fault) return send(fault, { message: 'fake outage' });
      if (req.method !== 'GET') return send(405, { message: 'GET only' });
      const repoBase = `/repos/${REPO}`;
      if (u.pathname === `${repoBase}/deployments`) {
        return send(200, sorted.slice().reverse().map(d => ({ url: `${api}${repoBase}/deployments/${d._id}`, id: d._id, sha: d.sha, ref: 'main', task: 'deploy', environment: 'github-pages', original_environment: 'github-pages', created_at: iso(d.days), updated_at: d._st[d._st.length - 1].at, statuses_url: `${api}${repoBase}/deployments/${d._id}/statuses`, repository_url: `${api}${repoBase}`, performed_via_github_app: { id: 15368, slug: 'github-actions', name: 'GitHub Actions' } })));
      }
      const m = new RegExp(`^${repoBase}/deployments/(\\d+)/statuses$`).exec(u.pathname);
      if (m) {
        const d = sorted.find(x => String(x._id) === m[1]);
        if (!d) return send(404, { message: 'Not Found' });
        return send(200, d._st.slice().reverse().map(s => ({ id: s.id, state: s.state, environment: 'github-pages', created_at: s.at, deployment_url: `${api}${repoBase}/deployments/${d._id}` })));
      }
      return send(404, { message: 'Not Found' });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}`, requests }));
  });
}

/* ---------------------------------------------------------------- fake Pages site */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
/** Serves DIR under /vector-hole/; faults: { status: { path: code }, mime: { path: type }, body: { path: Buffer } }. */
function fakeLive(dir, faults = {}) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      if (!u.startsWith('/vector-hole/')) { res.writeHead(404); res.end(); return; }
      const rel = u.slice('/vector-hole/'.length) || 'index.html';
      if (faults.status && faults.status[rel]) { res.writeHead(faults.status[rel], { 'Content-Type': 'text/html' }); res.end('fault'); return; }
      const f = path.join(dir, rel);
      if (!f.startsWith(dir + path.sep) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': (faults.mime && faults.mime[rel]) || MIME[path.extname(f)] || 'application/octet-stream' });
      res.end((faults.body && faults.body[rel]) || fs.readFileSync(f));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}/vector-hole` }));
  });
}

/* ---------------------------------------------------------------- the workflow's bash steps */
function stepScript(name) {
  const lines = readWorkflow().split('\n');
  const at = lines.findIndex(l => l.trim() === '- name: ' + name);
  if (at < 0) throw new Error(`workflow step "${name}" not found`);
  const r = lines.findIndex((l, i) => i > at && /^\s+run: \|\s*$/.test(l));
  const ind = lines[r].match(/^\s*/)[0].length;
  const body = [];
  for (let i = r + 1; i < lines.length; i++) { const l = lines[i]; if (l.trim() && l.match(/^\s*/)[0].length <= ind) break; body.push(l.slice(ind + 2)); }
  return body.join('\n');
}
function bash(script, env, cwd = ROOT) {
  const r = spawnSync('bash', ['-c', script], { cwd, env: { ...process.env, GITHUB_ACTIONS: '', ...env }, encoding: 'utf8' });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

/* ---------------------------------------------------------------- one run, as the workflow runs it */
const OWNER = 'vh-owner';
/** GitHub's variables of a recovery dispatch (overrides: what is wrong in a test). */
const dispatchEnv = (sha, o = {}) => ({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: sha, GITHUB_RUN_ID: '4711', GITHUB_RUN_ATTEMPT: '1', GITHUB_ACTOR: OWNER, GITHUB_TRIGGERING_ACTOR: OWNER, GITHUB_REPOSITORY_OWNER: OWNER, GITHUB_REPOSITORY: REPO, ...o });
const recoveryInputs = (sha, live, o = {}) => ({ VH_MODE: 'recovery', VH_EXPECT_SHA: sha, VH_EXPECT_LIVE: live, VH_REASON: 'K2 test - the live release is damaged', ...o });
let runNo = 0;
/** precheck -> ledger -> assemble -> the workflow's bash check; recovery: authorize first.
 *  o.recovery: { live: expected live id | 'classic', env: overrides, inputs: overrides, assembleEnv: overrides } */
async function e3Run(hdir, { liveBase, deps, apiFault = null, rev, recovery = null }) {
  const dir = path.join(hdir, `run${++runNo}`);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const steps = {};
  const env = recovery ? dispatchEnv(rev, recovery.env) : { GITHUB_ACTIONS: '' };
  const recFile = path.join(dir, 'recovery.json');
  const rec = recovery ? ['--recovery', recFile] : [];
  const stop = (k, r) => { steps[k] = r; return { steps, code: r.code, stage: k, msg: last(r.all) }; };
  if (recovery) {
    const a = await runAsync(['authorize-recovery', '--out', recFile], { ...env, ...recoveryInputs(rev, recovery.live, recovery.inputs) });
    if (a.code !== 0) return stop('authorize', a);
    steps.authorize = a;
  }
  const liveJson = path.join(dir, 'live-before.json');
  const p = await runAsync(['precheck-live', '--url', liveBase, '--out-json', liveJson, ...rec], env);
  if (p.code !== 0) return stop('precheck', p);
  steps.precheck = p;
  const api = await fakeApi(deps, { fault: apiFault });
  const ledger = path.join(dir, 'ledger.json');
  const l = await runAsync(['ledger', '--source', 'fixture', '--fixture', hdir, '--api-url', api.base, '--repository', REPO, '--out', ledger, '--now', NOW, '--era-epoch', EPOCH], { ...env, GITHUB_TOKEN: 'vh-k2-test-token' });
  api.server.close();
  if (l.code !== 0) return stop('ledger', l);
  steps.ledger = l;
  const out = path.join(dir, 'release'), man = path.join(dir, 'manifest.json'), sum = path.join(dir, 'summary.md');
  const as = await runAsync(['assemble', '--source', 'fixture', '--fixture', hdir, '--rev', rev, '--out', out, '--now', NOW, '--era-epoch', EPOCH, '--live-json', liveJson, '--ledger', ledger, '--repository', REPO, '--manifest-out', man, '--summary', sum, ...rec], { ...env, ...(recovery && recovery.assembleEnv || {}) });
  if (as.code !== 0) return stop('assemble', as);
  steps.assemble = as;
  const b = bash(stepScript('Verify release/ independently'), { GITHUB_SHA: rev }, dir);
  if (b.code !== 0) return stop('bash', { ...b, all: b.out });
  steps.bash = b;
  return { steps, code: 0, stage: 'done', out, live: JSON.parse(fs.readFileSync(liveJson, 'utf8')), manifest: JSON.parse(fs.readFileSync(man, 'utf8')), summary: fs.readFileSync(sum, 'utf8') };
}
/** An artifact of `name` to serve as the live site (standard assembly, no ledger: a site fixture only). */
async function siteOf(hdir, name, label) {
  const out = path.join(hdir, 'site-' + label);
  fs.rmSync(out, { recursive: true, force: true });
  const r = await runAsync(['assemble', '--source', 'fixture', '--fixture', hdir, '--rev', fakeSha(name), '--allow-non-tip', '--no-ledger', '--no-live-anchor', '--out', out, '--now', NOW]);
  if (r.code !== 0) throw new Error(`site ${name}: ${r.all}`);
  return out;
}
const ids = (m) => m ? m.releases.map(r => r.id).sort().join(',') : null;

/* ================================================================ checks */
export async function runRecoveryChecks() {
  const results = [];
  const check = (name, ok, details) => results.push(report(name, !!ok, details));
  fs.rmSync(W, { recursive: true, force: true }); fs.mkdirSync(W, { recursive: true });

  // H: M (published 3 days ago) <- B (published 2 days ago, live) <- C (main's tip: a forward rollback, M's runtime).
  const H = makeHistory(path.join(W, 'h'), [
    { name: 'M', days: 3, files: withJs('M') }, { name: 'B', days: 2, files: withJs('B') }, { name: 'C', days: 1, files: withJs('M') }
  ]);
  const M = fakeSha('M'), B = fakeSha('B'), C = fakeSha('C');
  const DEPS = () => [dep('M', 3), dep('B', 2)];
  const siteB = await siteOf(H, 'B', 'B'), siteM = await siteOf(H, 'M', 'M');
  const bJs = `v/${idOf('B')}/game.js`, bCss = `v/${idOf('B')}/style.css`;
  const bBytes = fs.readFileSync(path.join(siteB, bJs));

  /* ---------- authorization (authorize-recovery, the workflow's first check) ---------- */
  const auth = async (env) => { const f = path.join(W, `auth-${++runNo}.json`); const r = await runAsync(['authorize-recovery', '--out', f], env); return { ...r, rec: r.code === 0 ? JSON.parse(fs.readFileSync(f, 'utf8')) : null }; };
  const okEnv = { ...dispatchEnv(C), ...recoveryInputs(C, idOf('B')) };
  {
    const r = await auth({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: C, VH_MODE: '', VH_EXPECT_SHA: '', VH_EXPECT_LIVE: '', VH_REASON: '' });
    check('AUTH-01 a push (empty inputs) is a standard run', r.code === 0 && r.rec.mode === 'standard', last(r.all));
    const s = await auth({ ...dispatchEnv(C), VH_MODE: 'standard' });
    check('AUTH-02 a dispatch with mode standard and no recovery input is a standard run', s.code === 0 && s.rec.mode === 'standard', last(s.all));
    const sx = await auth({ ...dispatchEnv(C), VH_MODE: 'standard', VH_EXPECT_SHA: C });
    check('AUTH-03 a standard run given a recovery input refuses (exit 2): no half-set break-glass', sx.code === 2, last(sx.all));
    const bad = await auth({ ...dispatchEnv(C), VH_MODE: 'yolo' });
    check('AUTH-04 an unknown mode refuses (exit 2)', bad.code === 2, last(bad.all));
    const ok = await auth(okEnv);
    check('AUTH-05 the owner\'s first-attempt dispatch on main for main\'s sha is authorized and recorded', ok.code === 0 && ok.rec.mode === 'recovery' && ok.rec.sha === C && ok.rec.expectLive === idOf('B') && ok.rec.actor === OWNER && ok.rec.runId === '4711', JSON.stringify(ok.rec));
    const cases = [
      ['AUTH-06 outside GitHub Actions', { GITHUB_ACTIONS: '' }, 2],
      ['AUTH-07 a push event', { GITHUB_EVENT_NAME: 'push' }, 1],
      ['AUTH-08 a schedule / other event', { GITHUB_EVENT_NAME: 'repository_dispatch' }, 1],
      ['AUTH-09 another branch', { GITHUB_REF: 'refs/heads/feature' }, 1],
      ['AUTH-10 an actor who is not the owner', { GITHUB_ACTOR: 'someone', GITHUB_TRIGGERING_ACTOR: 'someone' }, 1],
      ['AUTH-11 a re-run triggered by someone else', { GITHUB_TRIGGERING_ACTOR: 'someone' }, 1],
      ['AUTH-12 a re-run (attempt 2)', { GITHUB_RUN_ATTEMPT: '2' }, 1],
      ['AUTH-13 an org-owned repo (no actor equals the owner): fail closed', { GITHUB_REPOSITORY_OWNER: 'some-org' }, 1],
      ['AUTH-14 main moved: expected sha != the run\'s sha', { GITHUB_SHA: B }, 1],
      ['AUTH-15 a short sha', { VH_EXPECT_SHA: C.slice(0, 12) }, 2],
      ['AUTH-16 a live id that is not 12 hex / classic', { VH_EXPECT_LIVE: 'latest' }, 2],
      ['AUTH-17 a missing reason', { VH_REASON: '' }, 2],
      ['AUTH-18 a reason with a newline + workflow command', { VH_REASON: 'fix it now\n::error::injected' }, 2],
      ['AUTH-19 a reason with ":" or "%"', { VH_REASON: 'MIME broken: 100%' }, 2],
      ['AUTH-20 a missing triggering actor', { GITHUB_TRIGGERING_ACTOR: '' }, 1]
    ];
    for (const [name, o, code] of cases) { const r = await auth({ ...okEnv, ...o }); check(`${name} -> refused (exit ${code})`, r.code === code && !r.rec, last(r.all)); }
    // A record is never reused by another run.
    const f = path.join(W, 'auth-reuse.json'); fs.writeFileSync(f, JSON.stringify(ok.rec));
    const live = await fakeLive(siteB);
    const reuse = await runAsync(['precheck-live', '--url', live.base, '--out-json', path.join(W, 'reuse-live.json'), '--recovery', f], dispatchEnv(C, { GITHUB_RUN_ID: '4712' }));
    const forged = path.join(W, 'auth-forged.json'); fs.writeFileSync(forged, JSON.stringify({ ...ok.rec, mode: 'standard' }));
    const fg = await runAsync(['precheck-live', '--url', live.base, '--out-json', path.join(W, 'forged-live.json'), '--recovery', forged], dispatchEnv(C));
    live.server.close();
    check('AUTH-21 an authorization file of another run is refused by the next step (exit 1)', reuse.code === 1 && /another run/.test(reuse.all), last(reuse.all));
    check('AUTH-22 a forged / non-recovery file is refused (exit 1)', fg.code === 1, last(fg.all));
  }

  /* ---------- the standard run is unchanged ---------- */
  {
    const live = await fakeLive(siteB);
    const r = await e3Run(H, { liveBase: live.base, deps: DEPS(), rev: C });
    live.server.close();
    check('STD-01 a healthy live site: the standard forward rollback passes (precheck, ledger, assemble, bash)', r.code === 0 && ids(r.manifest) === [idOf('M'), idOf('B'), C.slice(0, 12)].sort().join(',') && !('recovery' in r.manifest) && !('recovery' in r.live) && !/RECOVERY/.test(r.summary), `${r.stage} ${r.msg} ${ids(r.manifest)}`);
    const l404 = await fakeLive(siteB, { status: { [bJs]: 404 } });
    const s1 = await e3Run(H, { liveBase: l404.base, deps: DEPS(), rev: C }); l404.server.close();
    check('STD-02 live v/<id>/game.js 404 -> the standard precheck still STOPs (exit 1)', s1.stage === 'precheck' && s1.code === 1 && /incomplete/.test(s1.msg), s1.msg);
    const lmime = await fakeLive(siteB, { mime: { [bJs]: 'text/plain' } });
    const s2 = await e3Run(H, { liveBase: lmime.base, deps: DEPS(), rev: C }); lmime.server.close();
    check('STD-03 live JS served as text/plain -> the standard precheck still STOPs (exit 1)', s2.stage === 'precheck' && s2.code === 1 && /content-type/.test(s2.msg), s2.msg);
    const lM = await fakeLive(siteM);
    const s3 = await e3Run(H, { liveBase: lM.base, deps: DEPS(), rev: C }); lM.server.close();
    check('STD-04 live M while the ledger says B -> the standard assembly still STOPs ("ledger disagrees", exit 1)', s3.stage === 'assemble' && s3.code === 1 && /ledger disagrees/.test(s3.msg), s3.msg);
    const lb = await fakeLive(siteB);
    const s4 = await e3Run(H, { liveBase: lb.base, deps: DEPS(), apiFault: 503, rev: C }); lb.server.close();
    check('STD-05 GitHub API 503 -> the standard ledger still STOPs (exit 3)', s4.stage === 'ledger' && s4.code === 3, s4.msg);
    const lt = await fakeLive(siteB, { body: { [bJs]: Buffer.from('tampered') } });
    const s5 = await e3Run(H, { liveBase: lt.base, deps: DEPS(), rev: C }); lt.server.close();
    check('STD-06 live v/<id>/ bytes changed -> the standard assembly still STOPs (immutability, exit 1)', s5.stage === 'assemble' && s5.code === 1 && /immutability/.test(s5.msg), s5.msg);
    const lm = await fakeLive(siteB);
    const s6 = await e3Run(H, { liveBase: lm.base, deps: DEPS(), rev: B }); lm.server.close();
    check('STD-07 a superseded standard run (rev != main\'s tip) still deploys nothing (exit 4, green in the workflow)', s6.stage === 'assemble' && s6.code === 4, s6.msg);
    // A recovery pre-check is never accepted by a standard assembly.
    const lr = await fakeLive(siteB, { status: { [bJs]: 404 } });
    const rec = await e3Run(H, { liveBase: lr.base, deps: DEPS(), rev: C, recovery: { live: idOf('B') } }); lr.server.close();
    const dir = path.join(W, 'std-recovery-live'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const lj = path.join(H, `run${runNo}`, 'live-before.json'), lg = path.join(H, `run${runNo}`, 'ledger.json');
    const s7 = await runAsync(['assemble', '--source', 'fixture', '--fixture', H, '--rev', C, '--out', path.join(dir, 'release'), '--now', NOW, '--era-epoch', EPOCH, '--live-json', lj, '--ledger', lg, '--repository', REPO]);
    check('STD-08 a standard assembly given a recovery pre-check refuses (exit 1)', rec.code === 0 && s7.code === 1 && /recovery run/.test(s7.all), last(s7.all));
  }

  /* ---------- recovery: what it repairs ---------- */
  {
    const healthy = await fakeLive(siteB);
    const std = await e3Run(H, { liveBase: healthy.base, deps: DEPS(), rev: C }); healthy.server.close();
    const l404 = await fakeLive(siteB, { status: { [bJs]: 404 } });
    const r1 = await e3Run(H, { liveBase: l404.base, deps: DEPS(), rev: C, recovery: { live: idOf('B') } }); l404.server.close();
    const rebuilt = r1.out ? fs.readFileSync(path.join(r1.out, bJs)) : null;
    check('REC-01 live v/<B>/game.js 404: recovery passes authorize, precheck, ledger, assemble and the workflow bash check', r1.code === 0, `${r1.stage} ${r1.msg}`);
    check('REC-02 the missing file is rebuilt from git with exactly the published bytes', rebuilt && rebuilt.equals(bBytes), rebuilt ? sha256(rebuilt).slice(0, 12) + ' vs ' + sha256(bBytes).slice(0, 12) : 'none');
    check('REC-03 recovery keeps exactly what the standard run keeps (live B, published M, current C) and the root pair at its pins', r1.manifest && ids(r1.manifest) === ids(std.manifest) && sha256(fs.readFileSync(path.join(r1.out, 'game.js'))) === REL.FROZEN.files['game.js'] && sha256(fs.readFileSync(path.join(r1.out, 'style.css'))) === REL.FROZEN.files['style.css'], `${ids(r1.manifest)} vs standard ${ids(std.manifest)}`);
    check('REC-04 the decision trail: manifest.recovery (authorization, damaged file, save schema 13), step summary banner, warnings in the log', r1.manifest && r1.manifest.recovery && r1.manifest.recovery.authorization.sha === C && r1.manifest.recovery.damaged.length === 1 && r1.manifest.recovery.damaged[0].path === 'game.js' && r1.manifest.recovery.saveSchema === 13 && /RECOVERY DEPLOYMENT/.test(r1.summary) && /RECOVERY/.test(r1.steps.precheck.all) && /RECOVERY/.test(r1.steps.assemble.all), JSON.stringify(r1.manifest && r1.manifest.recovery && { damaged: r1.manifest.recovery.damaged, schema: r1.manifest.recovery.saveSchema }));
    check('REC-05 the recovery artifact = the standard artifact of the same state (same files and bytes)', r1.manifest && std.manifest && r1.manifest.artifactSha256 === std.manifest.artifactSha256, `${r1.manifest && r1.manifest.artifactSha256} vs ${std.manifest && std.manifest.artifactSha256}`);
    const lmime = await fakeLive(siteB, { mime: { [bJs]: 'text/plain' } });
    const r2 = await e3Run(H, { liveBase: lmime.base, deps: DEPS(), rev: C, recovery: { live: idOf('B') } }); lmime.server.close();
    check('REC-06 live JS served as text/plain: recovery republishes it (bytes checked, damage recorded)', r2.code === 0 && r2.manifest.recovery.damaged.length === 1 && /content-type text\/plain/.test(r2.manifest.recovery.damaged[0].problem) && r2.manifest.artifactSha256 === std.manifest.artifactSha256, `${r2.stage} ${r2.msg}`);
    const lcss = await fakeLive(siteB, { status: { [bCss]: 404 } });
    const r3 = await e3Run(H, { liveBase: lcss.base, deps: DEPS(), rev: C, recovery: { live: idOf('B') } }); lcss.server.close();
    check('REC-07 live stylesheet 404: recovery rebuilds it', r3.code === 0 && r3.manifest.recovery.damaged.length === 1 && r3.manifest.recovery.damaged[0].path === 'style.css', `${r3.stage} ${r3.msg}`);
    const lM = await fakeLive(siteM);
    const r4 = await e3Run(H, { liveBase: lM.base, deps: DEPS(), rev: C, recovery: { live: idOf('M') } }); lM.server.close();
    check('REC-08 live M while the ledger says B, and the ledger keeps M: recovery accepts the logged disagreement; retention = the standard rule (M, B, C)', r4.code === 0 && r4.manifest.recovery.disagreements.length === 1 && /ledger disagrees/.test(r4.manifest.recovery.disagreements[0]) && ids(r4.manifest) === [idOf('M'), idOf('B'), C.slice(0, 12)].sort().join(','), `${r4.stage} ${r4.msg}`);
    const ok = await fakeLive(siteB);
    const r5 = await e3Run(H, { liveBase: ok.base, deps: DEPS(), rev: C, recovery: { live: idOf('B') } }); ok.server.close();
    check('REC-09 a recovery run on a consistent site behaves like a standard run (same artifact, nothing damaged, no disagreement)', r5.code === 0 && r5.manifest.recovery.damaged.length === 0 && r5.manifest.recovery.disagreements.length === 0 && r5.manifest.artifactSha256 === std.manifest.artifactSha256, `${r5.stage} ${r5.msg}`);

    // Back to the standard path: the recovery artifact goes live and gets its record; the next standard run passes.
    const site = path.join(W, 'site-after-recovery'); fs.rmSync(site, { recursive: true, force: true }); fs.cpSync(r1.out, site, { recursive: true });
    const after = await fakeLive(site);
    const H2 = makeHistory(path.join(W, 'h-after'), [
      { name: 'M', days: 3, files: withJs('M') }, { name: 'B', days: 2, files: withJs('B') }, { name: 'C', days: 1, files: withJs('M') }, { name: 'D', days: 0.01, files: withJs('D') }
    ]);
    const n1 = await e3Run(H2, { liveBase: after.base, deps: [dep('M', 3), dep('B', 2), dep('C', 0.02)], rev: fakeSha('D') });
    after.server.close();
    check('REC-10 after the recovery deploy the next STANDARD run passes and keeps B (the repaired release), M, C; no recovery trace', n1.code === 0 && ids(n1.manifest) === [idOf('M'), idOf('B'), idOf('C'), idOf('D')].sort().join(',') && !('recovery' in n1.manifest) && n1.live.era === 'versioned' && n1.live.anchorId === idOf('C'), `${n1.stage} ${n1.msg} ${ids(n1.manifest)}`);
  }

  /* ---------- recovery: what still STOPs ---------- */
  {
    const run = async (label, faults, o) => { const live = await fakeLive(o.site || siteB, faults); const r = await e3Run(o.hist || H, { liveBase: live.base, deps: o.deps || DEPS(), apiFault: o.apiFault || null, rev: o.rev || C, recovery: { live: idOf('B'), ...o.recovery } }); live.server.close(); return r; };
    const t = await run('tampered', { body: { [bJs]: Buffer.from('tampered') } }, {});
    check('STOP-01 live v/<B>/game.js served with different bytes -> recovery STOPs (immutability, exit 1)', t.stage === 'assemble' && t.code === 1 && /immutability/.test(t.msg), t.msg);
    const tm = await run('tampered+mime', { body: { [bJs]: Buffer.from('tampered') }, mime: { [bJs]: 'text/plain' } }, {});
    check('STOP-02 different bytes AND a wrong type -> recovery STOPs (a type problem never hides a byte change)', tm.stage === 'assemble' && tm.code === 1 && /immutability/.test(tm.msg), tm.msg);
    const s500 = await run('500', { status: { [bJs]: 500 } }, {});
    check('STOP-03 live v/<B>/game.js HTTP 500 -> STOP (exit 3, infrastructure, not repaired)', s500.stage === 'precheck' && s500.code === 3, s500.msg);
    const s410 = await run('410', { status: { [bJs]: 410 } }, {});
    check('STOP-04 live v/<B>/game.js HTTP 410 (not a plain 404) -> STOP (exit 1)', s410.stage === 'precheck' && s410.code === 1, s410.msg);
    const i503 = await run('index503', { status: { 'index.html': 503 } }, {});
    check('STOP-05 live index.html 503 -> STOP (exit 3)', i503.stage === 'precheck' && i503.code === 3, i503.msg);
    const i404 = await run('index404', { status: { 'index.html': 404 } }, {});
    check('STOP-06 live index.html 404 (Pages off?) -> STOP (exit 1, owner decision)', i404.stage === 'precheck' && i404.code === 1 && /404/.test(i404.msg), i404.msg);
    const root = await run('root', { body: { 'game.js': Buffer.from('// not the frozen file\n') } }, {});
    check('STOP-07 live root game.js off its pin -> STOP (exit 1; the root is never rewritten by a recovery)', root.stage === 'precheck' && root.code === 1 && /root pair was overwritten/.test(root.msg), root.msg);
    const classicDir = path.join(W, 'site-classic-bad'); fs.rmSync(classicDir, { recursive: true, force: true }); fs.mkdirSync(classicDir, { recursive: true });
    fs.writeFileSync(path.join(classicDir, 'index.html'), Buffer.concat([OLD['index.html'], Buffer.from('<!-- changed -->')])); fs.writeFileSync(path.join(classicDir, 'game.js'), OLD['game.js']); fs.writeFileSync(path.join(classicDir, 'style.css'), OLD['style.css']);
    const cls = await run('classic-pin', {}, { site: classicDir, recovery: { live: 'classic' } });
    check('STOP-08 live classic index.html off its pin -> STOP (exit 1, "pins need review"; never changed by a recovery)', cls.stage === 'precheck' && cls.code === 1 && /pins need review/.test(cls.msg), cls.msg);
    const exp = await run('expect', {}, { recovery: { live: idOf('M') } });
    check('STOP-09 the live release is not the one the owner named -> STOP (exit 1, state changed since the decision)', exp.stage === 'precheck' && exp.code === 1 && /authorized for/.test(exp.msg), exp.msg);
    const api = await run('api', { status: { [bJs]: 404 } }, { apiFault: 503 });
    check('STOP-10 GitHub API 503 during a recovery -> STOP (exit 3, nothing assembled, no fallback)', api.stage === 'ledger' && api.code === 3, api.msg);
    const api403 = await run('api403', { status: { [bJs]: 404 } }, { apiFault: 403 });
    check('STOP-11 GitHub API 403 during a recovery -> STOP (exit 3)', api403.stage === 'ledger' && api403.code === 3, api403.msg);
    const moved = await run('moved', {}, { rev: B });
    check('STOP-12 main moved past the authorized commit -> recovery STOPs red (exit 1), never a silent green "superseded"', moved.stage === 'assemble' && moved.code === 1 && /moved on/.test(moved.msg), moved.msg);
    const fail = await run('failrec', {}, { deps: [dep('M', 3), dep('B', 2, 'failure')] });
    check('STOP-13 live B whose only record says failure (the ledger does not keep B) -> STOP (exit 1): the standard runs after it could drop v/<B>/', fail.stage === 'assemble' && fail.code === 1 && /does not keep the live release/.test(fail.msg), fail.msg);
    const none = await run('nopub', {}, { deps: [] });
    check('STOP-14 live versioned, the ledger shows no versioned publication -> STOP (exit 1)', none.stage === 'assemble' && none.code === 1 && /does not keep the live release/.test(none.msg), none.msg);
    // A release the ledger needs that git cannot rebuild (published X is off main's chain).
    const HX = makeHistory(path.join(W, 'h-offchain'), [
      { name: 'X', days: 4, files: withJs('X') }, { name: 'M', days: 3, files: withJs('M'), parentSha: fakeSha('pre-e3') }, { name: 'B', days: 2, files: withJs('B') }, { name: 'C', days: 1, files: withJs('M') }
    ]);
    const siteBX = await siteOf(HX, 'B', 'BX');
    const off = await run('offchain', { status: { [bJs]: 404 } }, { hist: HX, site: siteBX, deps: [dep('X', 4), dep('M', 3), dep('B', 2)] });
    check('STOP-15 a published release off main\'s chain must be kept -> recovery STOPs (exit 1), never drops it', off.code === 1 && /off main's first-parent chain/.test(off.msg), `${off.stage} ${off.msg}`);
    // Save schema guard (N9).
    const js12 = Buffer.from(GOOD['game.js'].toString('utf8').replace('const SAVE_SCHEMA_VERSION = 13;', 'const SAVE_SCHEMA_VERSION = 12;'));
    const H12 = makeHistory(path.join(W, 'h-schema12'), [{ name: 'M', days: 3, files: withJs('M') }, { name: 'B', days: 2, files: withJs('B') }, { name: 'C', days: 1, files: withJs('M12', js12) }]);
    const live12 = await fakeLive(siteB);
    const std12 = await e3Run(H12, { liveBase: live12.base, deps: DEPS(), rev: C });
    const rec12 = await e3Run(H12, { liveBase: live12.base, deps: DEPS(), rev: C, recovery: { live: idOf('B') } });
    live12.server.close();
    check('STOP-16 recovery to a release with SAVE_SCHEMA_VERSION 12 -> STOP (exit 1); the standard run is unaffected by this guard', rec12.stage === 'assemble' && rec12.code === 1 && /SAVE_SCHEMA_VERSION 12/.test(rec12.msg) && std12.code === 0, `${rec12.msg} | standard ${std12.stage} ${std12.code}`);
    const js0 = Buffer.from(GOOD['game.js'].toString('utf8').replace('const SAVE_SCHEMA_VERSION = 13;', 'const SAVE_SCHEMA = 13;'));
    const H0 = makeHistory(path.join(W, 'h-schema0'), [{ name: 'M', days: 3, files: withJs('M') }, { name: 'B', days: 2, files: withJs('B') }, { name: 'C', days: 1, files: withJs('M0', js0) }]);
    const live0 = await fakeLive(siteB);
    const rec0 = await e3Run(H0, { liveBase: live0.base, deps: DEPS(), rev: C, recovery: { live: idOf('B') } });
    live0.server.close();
    check('STOP-17 recovery to a release whose save schema cannot be read -> STOP (exit 1)', rec0.stage === 'assemble' && rec0.code === 1 && /0 times/.test(rec0.msg), rec0.msg);
    const other = await run('otherrun', { status: { [bJs]: 404 } }, { recovery: { assembleEnv: { GITHUB_RUN_ID: '9999' } } });
    check('STOP-18 the assembly runs in another run than the authorization -> STOP (exit 1)', other.stage === 'assemble' && other.code === 1 && /another run/.test(other.msg), other.msg);
    // Usage: recovery never goes without the ledger, never from a worktree, never with --allow-non-tip.
    const lr = await fakeLive(siteB, { status: { [bJs]: 404 } });
    const base = await e3Run(H, { liveBase: lr.base, deps: DEPS(), rev: C, recovery: { live: idOf('B') } }); lr.server.close();
    const rd = path.join(H, `run${runNo}`);
    const noLedger = await runAsync(['assemble', '--source', 'fixture', '--fixture', H, '--rev', C, '--out', path.join(W, 'u1'), '--now', NOW, '--live-json', path.join(rd, 'live-before.json'), '--no-ledger', '--recovery', path.join(rd, 'recovery.json')], dispatchEnv(C));
    const nonTip = await runAsync(['assemble', '--source', 'fixture', '--fixture', H, '--rev', C, '--out', path.join(W, 'u2'), '--now', NOW, '--era-epoch', EPOCH, '--live-json', path.join(rd, 'live-before.json'), '--ledger', path.join(rd, 'ledger.json'), '--repository', REPO, '--allow-non-tip', '--recovery', path.join(rd, 'recovery.json')], dispatchEnv(C));
    const wt = await runAsync(['assemble', '--source', 'worktree', '--repo', ROOT, '--id', 'k2test', '--frozen-dir', path.join(H, 'frozen'), '--out', path.join(W, 'u3'), '--no-live-anchor', '--recovery', path.join(rd, 'recovery.json')], dispatchEnv(C));
    check('STOP-19 recovery with --no-ledger / --allow-non-tip / --source worktree -> refused (exit 2)', base.code === 0 && noLedger.code === 2 && nonTip.code === 2 && wt.code === 2, [noLedger, nonTip, wt].map(r => r.code + ' ' + last(r.all)).join(' | '));
  }

  /* ---------- the live stylesheet's type (K2F-1R): checked like the scripts' ---------- */
  {
    const go = async (faults, o = {}) => { const live = await fakeLive(siteB, faults); const r = await e3Run(H, { liveBase: live.base, deps: DEPS(), rev: C, ...(o.recovery ? { recovery: { live: idOf('B') } } : {}) }); live.server.close(); return r; };
    const cssBytes = fs.readFileSync(path.join(siteB, bCss));
    const plain = { mime: { [bCss]: 'text/plain' } };
    const std = await go({});
    check('CSS-01 live stylesheet served as text/css: the standard run passes and the pre-check records its bytes', std.code === 0 && std.live.anchorFiles['style.css'] === sha256(cssBytes) && !('recovery' in std.manifest), `${std.stage} ${std.msg}`);
    const s1 = await go(plain);
    check('CSS-02 live stylesheet served as text/plain (HTTP 200) -> the standard precheck STOPs (exit 1, content-type)', s1.stage === 'precheck' && s1.code === 1 && /style\.css: content-type text\/plain/.test(s1.msg), s1.msg);
    const r1 = await go(plain, { recovery: true });
    const d1 = r1.manifest && r1.manifest.recovery.damaged;
    const rebuilt = r1.out ? fs.readFileSync(path.join(r1.out, bCss)) : null;
    check('CSS-03 live stylesheet text/plain: recovery records the damage, checks its bytes and rebuilds the same artifact as a standard run', r1.code === 0 && d1.length === 1 && d1[0].path === 'style.css' && /content-type text\/plain/.test(d1[0].problem) && r1.live.anchorFiles['style.css'] === sha256(cssBytes) && rebuilt && rebuilt.equals(cssBytes) && r1.manifest.artifactSha256 === std.manifest.artifactSha256, `${r1.stage} ${r1.msg} ${JSON.stringify(d1)}`);
    check('CSS-04 the stylesheet\'s wrong type reaches the decision trail: live-before.json, manifest.recovery, the step summary and the RECOVERY log lines', r1.code === 0 && r1.live.damaged.length === 1 && /style\.css: content-type text\/plain/.test(r1.summary) && /RECOVERY(::| )damaged live file, to be rebuilt from git: .*style\.css: content-type text\/plain/.test(r1.steps.precheck.all) && /RECOVERY/.test(r1.steps.assemble.all), `${r1.stage} ${r1.msg}`);
    const r404 = await go({ status: { [bCss]: 404 } }, { recovery: true });
    check('CSS-05 live stylesheet 404: recovery unchanged (damage recorded as HTTP 404, same artifact as a standard run)', r404.code === 0 && r404.manifest.recovery.damaged.length === 1 && /HTTP 404/.test(r404.manifest.recovery.damaged[0].problem) && !('style.css' in r404.live.anchorFiles) && r404.manifest.artifactSha256 === std.manifest.artifactSha256, `${r404.stage} ${r404.msg}`);
    const tampered = Buffer.from('/* tampered */');
    const tm = await go({ body: { [bCss]: tampered }, mime: { [bCss]: 'text/plain' } }, { recovery: true });
    const tc = await go({ body: { [bCss]: tampered } }, { recovery: true });
    const ts = await go({ body: { [bCss]: tampered }, mime: { [bCss]: 'text/plain' } });
    check('CSS-06 live stylesheet with other bytes -> STOP (immutability, exit 1): recovery with text/plain or text/css, never accepted; the standard run stops at its precheck', tm.stage === 'assemble' && tm.code === 1 && /immutability: live v\/[0-9a-f]{12}\/style\.css/.test(tm.msg) && tc.stage === 'assemble' && tc.code === 1 && /immutability/.test(tc.msg) && ts.stage === 'precheck' && ts.code === 1, [tm, tc, ts].map(r => `${r.stage} ${r.code} ${r.msg}`).join(' | '));
    const infra = [];
    for (const code of [403, 429, 500, 503]) for (const recovery of [false, true]) { const r = await go({ status: { [bCss]: code } }, { recovery }); infra.push({ code, recovery, stage: r.stage, exit: r.code }); }
    const g410 = await go({ status: { [bCss]: 410 } }, { recovery: true });
    check('CSS-07 live stylesheet HTTP 403 / 429 / 500 / 503 -> STOP (exit 3, infrastructure) in a standard and a recovery run; 410 -> STOP (exit 1)', infra.every(x => x.stage === 'precheck' && x.exit === 3) && g410.stage === 'precheck' && g410.code === 1, JSON.stringify(infra) + ` 410: ${g410.stage} ${g410.code}`);
    const js = await go({ mime: { [bJs]: 'text/javascript; charset=utf-8' } });
    check('CSS-08 live JS as text/javascript: the standard run still passes (the JS type check is unchanged)', js.code === 0 && js.manifest.artifactSha256 === std.manifest.artifactSha256, `${js.stage} ${js.msg}`);
    const both = await go({ mime: { [bJs]: 'text/plain', [bCss]: 'text/plain' } }, { recovery: true });
    const rd = path.join(H, `run${runNo}`); // the recovery run just above: its record and pre-check
    check('CSS-09 live JS and stylesheet both text/plain: recovery records both (JS path unchanged) and rebuilds the standard artifact', both.code === 0 && both.manifest.recovery.damaged.map(d => d.path).sort().join(',') === 'game.js,style.css' && both.manifest.artifactSha256 === std.manifest.artifactSha256, `${both.stage} ${both.msg}`);
    // A push never turns on the stylesheet exception: its pre-check takes no recovery record, its assembly no recovery pre-check.
    const live = await fakeLive(siteB, plain);
    const lj = path.join(W, 'css-push-live.json');
    const pushPre = await runAsync(['precheck-live', '--url', live.base, '--out-json', lj, '--recovery', path.join(rd, 'recovery.json')], { ...dispatchEnv(C), GITHUB_EVENT_NAME: 'push' });
    live.server.close();
    const dir = path.join(W, 'css-std-recovery-live'); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const pushAsm = await runAsync(['assemble', '--source', 'fixture', '--fixture', H, '--rev', C, '--out', path.join(dir, 'release'), '--now', NOW, '--era-epoch', EPOCH, '--live-json', path.join(rd, 'live-before.json'), '--ledger', path.join(rd, 'ledger.json'), '--repository', REPO]);
    check('CSS-10 a push cannot use the stylesheet exception: a push pre-check given a recovery record STOPs (exit 1); a standard assembly given the recovery pre-check refuses (exit 1)', both.code === 0 && pushPre.code === 1 && !fs.existsSync(lj) && pushAsm.code === 1 && /recovery run/.test(pushAsm.all), `${pushPre.code} ${last(pushPre.all)} | ${pushAsm.code} ${last(pushAsm.all)}`);
    const relB = (m) => m.releases.find(x => x.id === idOf('B'));
    check('CSS-11 retention and SHA checks unchanged: the stylesheet recovery keeps the standard releases, the root pair at its pins, and v/<B>/style.css at its published SHA-256', r1.code === 0 && ids(r1.manifest) === ids(std.manifest) && JSON.stringify(relB(r1.manifest).files) === JSON.stringify(relB(std.manifest).files) && relB(r1.manifest).files.find(f => f.path === 'style.css').sha256 === sha256(cssBytes) && sha256(fs.readFileSync(path.join(r1.out, 'game.js'))) === REL.FROZEN.files['game.js'] && sha256(fs.readFileSync(path.join(r1.out, 'style.css'))) === REL.FROZEN.files['style.css'], `${ids(r1.manifest)} vs ${ids(std.manifest)}`);
  }

  /* ---------- the workflow ---------- */
  {
    const wf = readWorkflow();
    const runs = [...wf.matchAll(/run: \|\n((?:[ ]{10,}.*\n|\s*\n)*)/g)].map(m => m[1]).join('\n');
    check('WF-01 no workflow input is expanded inside a run script (inputs reach the shell only via env)', !/\$\{\{\s*(inputs|github\.event\.inputs)\./.test(runs) && /VH_REASON: \$\{\{ inputs\.reason \}\}/.test(wf), '');
    check('WF-02 push stays a main-only, input-free trigger; every job keeps `github.ref == refs/heads/main`', /push:\n\s+branches:\n\s+- main\n/.test(wf) && (wf.match(/if: github\.ref == 'refs\/heads\/main'/g) || []).length === 3, '');
    const order = ['Standard or recovery run', 'Check the live site before deploying', 'Read the deployment ledger', 'Assemble release/', 'Verify release/ independently'].map(n => wf.indexOf('- name: ' + n));
    check('WF-03 the authorization step runs before the live pre-check; the pre-check, ledger, assembly and bash check are all still there', order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1])), JSON.stringify(order));
    check('WF-04 the deploy job keeps github-pages, the fingerprint check and the live-index guard; verify-live still runs', /environment:\n\s+name: github-pages/.test(wf) && wf.includes('- name: Check release/ is the verified folder') && wf.includes('- name: Check the live site is still what the build saw') && /assemble-release\.mjs verify-live/.test(wf), '');
    const tmp = path.join(W, 'wf'); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
    const mode = (env) => { const o = path.join(tmp, `out-${++runNo}`); fs.writeFileSync(o, ''); const r = bash(stepScript('Standard or recovery run'), { RUNNER_TEMP: tmp, GITHUB_OUTPUT: o, ...env }); return { ...r, output: fs.readFileSync(o, 'utf8').trim() }; };
    const push = mode({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: C, VH_MODE: '', VH_EXPECT_SHA: '', VH_EXPECT_LIVE: '', VH_REASON: '' });
    check('WF-05 the workflow\'s "Standard or recovery run" step: a push -> recovery=false', push.code === 0 && push.output === 'recovery=false', push.out.trim() + ' / ' + push.output);
    const rec = mode({ ...dispatchEnv(C), ...recoveryInputs(C, idOf('B')) });
    check('WF-06 the same step: the owner\'s recovery dispatch -> recovery=true', rec.code === 0 && rec.output === 'recovery=true', last(rec.out) + ' / ' + rec.output);
    const half = mode({ ...dispatchEnv(C), VH_MODE: 'standard', VH_EXPECT_LIVE: idOf('B') });
    check('WF-07 the same step: a standard dispatch with a recovery field filled in -> the run fails (exit 2), nothing set', half.code === 2 && half.output === '', last(half.out));
    const other = mode({ ...dispatchEnv(C, { GITHUB_ACTOR: 'someone', GITHUB_TRIGGERING_ACTOR: 'someone' }), ...recoveryInputs(C, idOf('B')) });
    check('WF-08 the same step: a recovery dispatch by someone else -> the run fails, nothing set', other.code === 1 && other.output === '', last(other.out));
    // The deploy job's guard (its step list stays the five of qa/release.mjs): a recovery run's deploy job is never re-run.
    const guard = stepScript('Check the live site is still what the build saw');
    const live = await fakeLive(siteB);
    const idx = sha256(fs.readFileSync(path.join(siteB, 'index.html')));
    const genv = (o) => ({ BASE_URL: live.base + '/', LIVE_INDEX: idx, NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1', HTTPS_PROXY: '', https_proxy: '', HTTP_PROXY: '', http_proxy: '', GITHUB_RUN_ID: '4711', ...o });
    const g = await Promise.all([{ RECOVERY: 'true', GITHUB_RUN_ATTEMPT: '1' }, { RECOVERY: 'true', GITHUB_RUN_ATTEMPT: '2' }, { RECOVERY: 'false', GITHUB_RUN_ATTEMPT: '2' }, { RECOVERY: '', GITHUB_RUN_ATTEMPT: '1' }, { GITHUB_RUN_ATTEMPT: '3' }].map(o => new Promise((resolve) => {
      const env = { ...process.env, ...genv(o) }; if (!('RECOVERY' in o)) delete env.RECOVERY;
      const c = spawn('bash', ['-c', guard], { cwd: ROOT, env }); let out = '';
      c.stdout.on('data', d => { out += d; }); c.stderr.on('data', d => { out += d; }); c.on('close', code => resolve({ code, out }));
    })));
    live.server.close();
    check('WF-09 the deploy job\'s live-index guard: a recovery run passes on attempt 1 (RECOVERY annotation) and fails on a re-run; a standard run (re-run or not, empty or missing output -- set -u safe) is unchanged', g[0].code === 0 && /RECOVERY DEPLOYMENT/.test(g[0].out) && g[1].code === 1 && /never re-run/.test(g[1].out) && g[2].code === 0 && g[3].code === 0 && g[4].code === 0 && !/RECOVERY/.test(g[2].out + g[3].out + g[4].out), g.map(x => x.code + ' ' + last(x.out)).join(' | '));
    check('WF-10 the decision trail is uploaded only in a recovery run (also when it stopped), 90 days; the deploy job keeps its five steps', /- name: Keep the recovery decision trail\n(?:\s+#.*\n)*\s+if: always\(\) && steps\.mode\.outputs\.recovery == 'true'/.test(wf) && /name: recovery-record[\s\S]*?retention-days: 90/.test(wf) && [...wf.slice(wf.indexOf('\n  deploy:\n'), wf.indexOf('\n  verify-live:\n')).matchAll(/- name: (.+)/g)].length === 5, '');
    check('WF-11 the pre-check and the assembly pass --recovery only when the authorization step said recovery=true', (wf.match(/if \[ "\$\{RECOVERY:-\}" = true \]; then rec=\(--recovery "\$RUNNER_TEMP\/recovery\.json"\); fi/g) || []).length === 2 && (wf.match(/RECOVERY: \$\{\{ steps\.mode\.outputs\.recovery \}\}/g) || []).length === 2, '');
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t = Date.now();
  const results = await runRecoveryChecks();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} recovery checks passed (${Math.round((Date.now() - t) / 1000)} s)`);
  process.exit(failed.length ? 1 : 0);
}
