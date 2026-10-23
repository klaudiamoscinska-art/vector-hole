#!/usr/bin/env node
// E3: assembles the GitHub Pages artifact. CI and local QA only -- this file
// lives in .github/ and is never published. Node >= 18, zero dependencies,
// no bundler; run it with --experimental-vm-modules (V8 itself parses the
// module graph, so multi-line, side-effect and re-export imports are read
// exactly as the browser reads them).
//
// The artifact (`release/`, the only folder the workflow uploads):
//   index.html        the release's own index.html; only its <script src> and
//                     stylesheet href are rewritten to v/<id>/...
//   game.js style.css FROZEN: the last classic pair (commit 63b50d0, SHA-256
//                     pinned below) for browsers still holding a pre-E3
//                     index.html. These bytes never change.
//   v/<id>/...        IMMUTABLE: the release's whole graph (scripts + CSS),
//                     id = the first 12 hex of the release commit, bytes =
//                     that commit's git blobs. Earlier releases are rebuilt
//                     the same way from git history and kept (retention).
// A URL never changes meaning: never edit or remove the root pair, never
// reuse a v/ id for other bytes, never move index.html.
//
// Commands (exit 0 ok · 1 release/content check failed -> STOP · 2 usage ·
// 3 infrastructure: git, network, HTTP 403/429/5xx -> STOP · 4 superseded:
// the commit is no longer main's tip, nothing to deploy):
//   ledger        --out FILE --api-url URL --repository OWNER/REPO
//                 --source git|fixture (git: [--repo .]; fixture: --fixture DIR)
//                 [--now ISO] [--per-page N] [--timeout-ms N] [--max-requests N]
//                 [--era-epoch ISO]   (tests only: earlier than the default)
//                 [--repository-id N] (default $GITHUB_REPOSITORY_ID, set by
//                 GitHub Actions: the id GitHub's Link headers name)
//                 token: $GITHUB_TOKEN (deployments: read; GET requests only)
//   assemble      --out DIR --source git|fixture|worktree
//                 (git: --rev SHA [--repo .]; fixture: --fixture DIR [--rev SHA];
//                  worktree: [--repo .] --id ID --frozen-dir DIR)
//                 --live-json FILE | --no-live-anchor
//                 git/fixture: --ledger FILE (from `ledger`) | --no-ledger
//                 (local previews and tests only; refused under GitHub Actions)
//                 [--repository OWNER/REPO] [--now ISO] [--manifest-out FILE]
//                 [--summary FILE] [--era-epoch ISO] [--allow-non-tip] (tests only)
//   precheck-live --url BASE --out-json FILE
//   verify-live   --url BASE --release DIR [--attempts 5] [--delay-ms 20000]
//   verify        --release DIR [--id ID] [--manifest FILE]
//   authorize-recovery --out FILE   (K2, the workflow's first check; env:
//                 VH_MODE standard|recovery, VH_EXPECT_SHA, VH_EXPECT_LIVE,
//                 VH_REASON + GitHub's run variables)
//   precheck-live and assemble also take --recovery FILE (from authorize-recovery).
// The same assembly code runs for every --source: only where the trees and
// the history come from differs (git in CI, snapshot folders in qa/release.mjs).
//
// K2 break-glass (docs/E3_ROLLBACK_PLAN.md §4): a recovery run is a
// workflow_dispatch on main by the repository owner, first attempt, naming
// the main sha and the live release it was decided on. It differs from a
// standard run in exactly two places, each logged in the manifest and the
// step summary: the live release may have files that are missing (404) or
// served with a wrong type -- they are rebuilt from git, and every file that
// is served must still match its rebuild byte for byte; and the ledger may
// disagree with the live site -- only if the ledger itself keeps the live
// release, so the standard runs that follow keep it too. Retention, pins,
// the root pair, immutability, every graph and artifact check and the live
// check after deploying are those of a standard run; anything else is a STOP.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/* ---------------------------------------------------------------- policy */
export const FROZEN = {
  rev: '63b50d0f470272aed8734c7854dda24b4f61e712',
  html: '6683fc52d0c2dc188f9b9496570f89653c0ccbbae7a04223b4d2a073fabd48be', // its index.html (classic)
  files: {
    'game.js': '5011c0e4047c20ff96b22ae1da84746229f0cf99a738287d1a79414134392664',
    'style.css': 'b5eb39fef65635eeb75c91de0c7b52c42dedd640e5b4b920bbbf95d4f3611b61'
  }
};
// Retention (see docs: E3 retention). Git does not record publications, so
// without a ledger the rule is deliberately generous; `max` never drops a
// release -- going over it is an error for a human to decide.
export const RETENTION = { days: 30, min: 5, max: 60, maxBytes: 400 * 1024 * 1024 };
// The workflow's `on.push.paths` (qa/release.mjs checks the two stay equal).
export const DEPLOY_PATHS = ['index.html', 'style.css', 'game.js', '**.js', '**.css', '.github/scripts/**', '.github/workflows/deploy-pages.yml'];
// A commit belongs to the versioned era when it carries this script.
export const ERA_MARKER = '.github/scripts/assemble-release.mjs';
export const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
// Path components that are never published (repo dev folders).
export const DEV_DIRS = new Set(['qa', '.claude', '.github', 'docs', 'design', 'node_modules', 'test', 'tests', 'evidence', 'logs', 'out']);
// Real QA mechanisms (the bridge, its installer, the bots' page hooks) --
// identifiers, not words: the E2 comment naming QA_BRIDGE_NAMES is harmless.
export const QA_MECHANISMS = [/__qa[A-Za-z_$]/, /\binstallQaBridge\b/, /\bqaBridgeInit\b/, /\bwaitForQaBridge\b/, /\baddInitScript\b/];
const ID_RE = /^[0-9a-f]{12}$/;
const TEST_ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/;
// K2: a recovery run never publishes a game whose saves would read as "from
// the future" for players already on this schema (PX01).
export const RECOVERY = { schema: 'vh-recovery/1', minSaveSchema: 13, reason: /^[\p{L}\p{N} .,;_()#/+'-]{10,200}$/u };

/* ---------------------------------------------------------------- errors */
export class ReleaseError extends Error {
  constructor(kind, message) { super(message); this.kind = kind; }
}
const EXIT = { release: 1, usage: 2, infra: 3, superseded: 4 };
const fail = (msg) => { throw new ReleaseError('release', msg); };
const infra = (msg) => { throw new ReleaseError('infra', msg); };
const usage = (msg) => { throw new ReleaseError('usage', msg); };

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const utf8 = (buf, what) => {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { return fail(`${what}: not valid UTF-8`); }
};

/* ---------------------------------------------------------------- trees
   A tree reader answers read(path) -> { data } | { symlink: true } | null. */
export function fsTree(root, label = root) {
  const base = path.resolve(root);
  return {
    label,
    read(rel) {
      const abs = path.join(base, ...rel.split('/'));
      if (!abs.startsWith(base + path.sep)) return null;
      let st;
      try { st = fs.lstatSync(abs); } catch (e) { return null; }
      // A symlink anywhere on the way counts (a linked folder too).
      let cur = path.dirname(abs);
      while (cur.startsWith(base + path.sep)) { if (fs.lstatSync(cur).isSymbolicLink()) return { symlink: true }; cur = path.dirname(cur); }
      if (st.isSymbolicLink()) return { symlink: true };
      if (!st.isFile()) return null;
      return { data: fs.readFileSync(abs) };
    }
  };
}

function git(repo, args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', ['-C', repo, ...args], { maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    if (allowFail) return null;
    return infra(`git ${args.join(' ')} failed: ${String(e.stderr || e.message).trim().split('\n')[0]}`);
  }
}
export function gitTree(repo, sha) {
  return {
    label: sha.slice(0, 12),
    read(rel) {
      const out = git(repo, ['ls-tree', '-z', sha, '--', rel]).toString('utf8').split('\0').filter(Boolean);
      if (!out.length) return null;
      const m = /^(\d+) (\w+) ([0-9a-f]+)\t(.*)$/s.exec(out[0]);
      if (!m || m[4] !== rel) return null;
      if (m[1] === '120000') return { symlink: true };
      if (m[2] !== 'blob') return null;
      return { data: git(repo, ['cat-file', 'blob', m[3]]) };
    }
  };
}

/* ---------------------------------------------------------------- history
   chain: main's first-parent commits from the tip, newest first, cut at the
   first commit without ERA_MARKER: [{ sha, time (s), changed: [paths] }]. */
export function gitHistory(repo) {
  if (git(repo, ['rev-parse', '--is-shallow-repository']).toString().trim() !== 'false') {
    fail('the checkout is shallow: retention needs the full history (actions/checkout fetch-depth: 0)');
  }
  const tip = git(repo, ['rev-parse', '--verify', 'refs/remotes/origin/main^{commit}']).toString().trim();
  const log = git(repo, ['log', '--first-parent', '--format=%H %ct %P', tip]).toString().trim().split('\n');
  const chain = [];
  for (const line of log) {
    const [sha, time, ...parents] = line.trim().split(' ');
    const hasMarker = git(repo, ['ls-tree', '--name-only', sha, '--', ERA_MARKER]).toString().trim() === ERA_MARKER;
    if (!hasMarker) break;
    const changedRaw = parents.length
      ? git(repo, ['diff-tree', '-r', '--no-commit-id', '--name-only', '-z', parents[0], sha])
      : git(repo, ['ls-tree', '-r', '--name-only', '-z', sha]);
    chain.push({ sha, time: Number(time), changed: changedRaw.toString('utf8').split('\0').filter(Boolean) });
  }
  const inChain = new Set(chain.map(c => c.sha));
  // L1: what a deployment record's sha is (classifyCommit()).
  const classify = (sha) => {
    if (inChain.has(sha)) return 'era';
    if (git(repo, ['cat-file', '-e', `${sha}^{commit}`], { allowFail: true }) === null) return 'missing';
    return git(repo, ['ls-tree', '--name-only', sha, '--', ERA_MARKER]).toString().trim() === ERA_MARKER ? 'foreign' : 'classic';
  };
  return { tip, chain, classify, tree: (sha) => gitTree(repo, sha), frozen: () => gitTree(repo, FROZEN.rev) };
}

/** Snapshot folders standing in for git (qa/release.mjs): DIR/history.json =
 *  { tip, commits: { sha: { time, parents: [sha], changed: [path], tree: 'rel/dir' } } }
 *  and DIR/frozen/ (the classic pair). Same contract as gitHistory().
 *  classify(sha) (L1, for deployment records): 'era' = on main's chain of the
 *  versioned era; 'classic' = a commit without the release script (published
 *  by the classic workflow, served by the frozen root); 'foreign' = carries
 *  the script but is off main's chain; 'missing' = not in this history. */
export function fixtureHistory(dir) {
  const h = JSON.parse(fs.readFileSync(path.join(dir, 'history.json'), 'utf8'));
  const trees = new Map(Object.entries(h.commits).map(([sha, c]) => [sha, path.join(dir, c.tree)]));
  if (h.shallow) fail('the checkout is shallow: retention needs the full history (actions/checkout fetch-depth: 0)');
  const chain = [];
  let sha = h.tip;
  while (sha) {
    const c = h.commits[sha];
    if (!c) fail(`history is incomplete: commit ${sha.slice(0, 12)} is missing (needed to walk main's first-parent chain)`);
    if (!fsTree(trees.get(sha)).read(ERA_MARKER)) break;
    chain.push({ sha, time: c.time, changed: c.changed == null ? null : c.changed });
    sha = (c.parents || [])[0];
  }
  const inChain = new Set(chain.map(c => c.sha));
  const classify = (s) => inChain.has(s) ? 'era' : !h.commits[s] ? 'missing' : fsTree(trees.get(s)).read(ERA_MARKER) ? 'foreign' : 'classic';
  return {
    tip: h.tip, chain, classify,
    tree: (s) => { if (!trees.has(s)) fail(`history is incomplete: no tree for ${s.slice(0, 12)}`); return fsTree(trees.get(s), s.slice(0, 12)); },
    frozen: () => fsTree(path.join(dir, 'frozen'), 'frozen')
  };
}

/* ---------------------------------------------------------------- paths */
function globRe(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') { re += '.*'; i++; } else if (ch === '*') re += '[^/]*'; else re += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}
export const matchesDeployPaths = (file, globs = DEPLOY_PATHS) => globs.some(g => globRe(g).test(file));

/** A local reference -> normalized release-relative path, or a failure. */
export function resolveLocal(ref, fromDir, what, ext, { module = false, allowV = false } = {}) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//')) fail(`${what}: "${ref}" is not a local file (external URLs are not allowed: zero third-party requests)`);
  if (ref.startsWith('/')) fail(`${what}: "${ref}" is absolute (it would escape /vector-hole/ on Pages); use a relative path`);
  if (/[?#\\]/.test(ref) || /\s/.test(ref)) fail(`${what}: "${ref}" has a query, fragment, backslash or space (one URL must mean one file)`);
  if (module && !/^\.\.?\//.test(ref)) fail(`${what}: "${ref}" is a bare specifier; imports must be relative ("./" or "../")`);
  const joined = path.posix.normalize(path.posix.join(fromDir || '.', ref));
  if (joined === '..' || joined.startsWith('../') || path.posix.isAbsolute(joined)) fail(`${what}: "${ref}" leaves the release directory`);
  const parts = joined.split('/');
  if (parts.some(p => p.startsWith('.'))) fail(`${what}: "${ref}" points into a hidden path`);
  if (parts.slice(0, -1).some(p => DEV_DIRS.has(p.toLowerCase()))) fail(`${what}: "${ref}" points into a dev folder (${parts.slice(0, -1).join('/')})`);
  if (!allowV && parts[0] === 'v') fail(`${what}: "${ref}" is under v/, which is reserved for assembled releases`);
  if (path.posix.extname(joined) !== ext) fail(`${what}: "${ref}" must be a ${ext} file`);
  return joined;
}

/* ---------------------------------------------------------------- HTML */
const URL_ATTRS = new Set(['src', 'href', 'srcset', 'poster', 'action', 'formaction', 'background', 'data', 'xlink:href', 'ping', 'manifest', 'cite', 'longdesc', 'usemap', 'icon', 'lowsrc', 'codebase', 'archive']);
function attrsOf(tagText, offset) {
  const out = [];
  const re = /\s([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(tagText))) {
    const name = m[1].toLowerCase();
    const quoted = m[2] !== undefined;
    const value = quoted ? m[2] : (m[3] !== undefined ? m[3] : m[4]);
    const vStart = quoted ? offset + m.index + m[0].length - 1 - m[2].length : -1;
    out.push({ name, value, quoted, start: vStart, end: quoted ? vStart + m[2].length : -1 });
  }
  return out;
}
/** The one local <script src> and the one stylesheet of an index.html, with
 *  their value spans for the rewrite; anything it doesn't understand fails. */
export function parseHtml(text, what = 'index.html') {
  if (/<base\b/i.test(text)) fail(`${what}: <base> changes how every path resolves -- not supported`);
  // Blank out inline <script>/<style> bodies (JSON-LD) so their text is not read as tags.
  const masked = text.replace(/(<(script|style)\b[^>]*>)([\s\S]*?)(<\/\2\s*>)/gi, (all, open, tag, body, close) => open + ' '.repeat(body.length) + close);
  const scripts = [], styles = [];
  const tagRe = /<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let m;
  while ((m = tagRe.exec(masked))) {
    const tag = m[1].toLowerCase();
    const attrs = attrsOf(m[2], m.index + 1 + m[1].length);
    const get = (n) => attrs.find(a => a.name === n);
    if (tag === 'script') {
      const src = get('src');
      const type = (get('type') || {}).value;
      if (!src) {
        const body = text.slice(m.index + m[0].length, text.indexOf('</', m.index + m[0].length)).trim();
        if (body && !/^application\/(ld\+)?json$/i.test(type || '')) fail(`${what}: inline <script> code is outside the release graph (only JSON data blocks are allowed)`);
        continue;
      }
      if (!src.quoted) fail(`${what}: <script src> must be double-quoted`);
      const unknown = attrs.filter(a => !['src', 'type', 'defer', 'async'].includes(a.name));
      if (unknown.length) fail(`${what}: <script> attribute(s) not supported by the release rules: ${unknown.map(a => a.name).join(', ')}`);
      if (type !== undefined && type !== 'module' && type !== 'text/javascript') fail(`${what}: <script type="${type}"> is not a module or classic script`);
      scripts.push({ ref: src.value, type: type === 'module' ? 'module' : 'classic', start: src.start, end: src.end });
      continue;
    }
    const rel = tag === 'link' ? ((get('rel') || {}).value || '').toLowerCase().split(/\s+/) : [];
    for (const a of attrs) {
      if (!URL_ATTRS.has(a.name)) continue;
      const v = (a.value || '').trim();
      if (tag === 'link' && a.name === 'href' && rel.includes('stylesheet')) {
        if (!a.quoted) fail(`${what}: stylesheet href must be double-quoted`);
        styles.push({ ref: a.value, start: a.start, end: a.end });
        continue;
      }
      if (/^data:/i.test(v) || v.startsWith('#')) continue;
      fail(`${what}: <${tag} ${a.name}="${v.slice(0, 60)}"> is a reference the release rules don't handle (only the one script, the one stylesheet, data: and #fragment URLs)`);
    }
  }
  if (scripts.length !== 1) fail(`${what}: expected exactly one <script src>, found ${scripts.length}`);
  if (styles.length !== 1) fail(`${what}: expected exactly one <link rel="stylesheet">, found ${styles.length}`);
  return { script: scripts[0], style: styles[0] };
}

/** index.html with its script src and stylesheet href replaced, nothing else. */
export function rewriteHtml(text, scriptRef, styleRef) {
  const p = parseHtml(text);
  const edits = [[p.script, scriptRef], [p.style, styleRef]].sort((a, b) => b[0].start - a[0].start);
  let out = text;
  for (const [span, value] of edits) out = out.slice(0, span.start) + value + out.slice(span.end);
  const q = parseHtml(out, 'rewritten index.html');
  if (q.script.ref !== scriptRef || q.style.ref !== styleRef) fail('rewrite check: the rewritten index.html does not reference the new paths');
  // Everything but the two values is byte-identical.
  const strip = (t, s) => { const sp = [s.script, s.style].sort((a, b) => b.start - a.start); for (const x of sp) t = t.slice(0, x.start) + t.slice(x.end); return t; };
  if (strip(out, q) !== strip(text, p)) fail('rewrite check: index.html changed outside the two rewritten attributes');
  return out;
}

/* ---------------------------------------------------------------- JS / CSS */
function moduleRequests(text, identifier) {
  if (typeof vm.SourceTextModule !== 'function') usage('run node with --experimental-vm-modules (the module graph is parsed by V8)');
  let mod;
  try { mod = new vm.SourceTextModule(text, { identifier }); } catch (e) { fail(`${identifier}: does not parse as an ES module: ${e.message}`); }
  if (Array.isArray(mod.moduleRequests)) return mod.moduleRequests.map(r => ({ specifier: r.specifier, attributes: Object.keys(r.attributes || {}) }));
  return mod.dependencySpecifiers.map(s => ({ specifier: s, attributes: [] }));
}
export function scanQaMechanisms(text, what) {
  for (const re of QA_MECHANISMS) { const m = re.exec(text); if (m) fail(`${what}: contains a QA mechanism (${m[0]}) -- test hooks must never be published`); }
}
function checkCss(text, what) {
  if (/@import\b/i.test(text)) fail(`${what}: @import is not supported (it would load a file outside the release graph)`);
  for (const m of text.matchAll(/url\(\s*(['"]?)([\s\S]*?)\1\s*\)/gi)) {
    const v = m[2].trim();
    if (/^data:/i.test(v) || v.startsWith('#')) continue;
    fail(`${what}: url(${v.slice(0, 60)}) references a file -- only data: URLs are supported (a relative asset would break under v/<id>/, an external one is a third-party request)`);
  }
}

/** Reads one release from a tree: the HTML, its whole script graph and CSS.
 *  mode 'current' = the release being published (every check); 'reproduce'
 *  = a retained earlier release (only what decides WHICH bytes go under its
 *  id: graph, paths, symlinks -- stable across later rule changes). */
export function readRelease(tree, mode = 'current') {
  const htmlEntry = tree.read('index.html');
  if (!htmlEntry || !htmlEntry.data) fail(`${tree.label}: index.html missing${htmlEntry && htmlEntry.symlink ? ' (symlink)' : ''}`);
  const html = utf8(htmlEntry.data, 'index.html');
  const { script, style } = parseHtml(html, `${tree.label}:index.html`);
  const files = new Map();
  const edges = [];
  const load = (p, why) => {
    const e = tree.read(p);
    if (!e) fail(`${tree.label}: ${why} -> ${p} is missing`);
    if (e.symlink) fail(`${tree.label}: ${p} is a symlink (not allowed in a release)`);
    return e.data;
  };
  const entry = resolveLocal(script.ref, '', `${tree.label}:index.html <script src>`, '.js');
  const queue = [[entry, 'index.html <script src>']];
  while (queue.length) {
    const [p, why] = queue.shift();
    if (files.has(p)) continue;
    const data = load(p, why);
    const text = utf8(data, p);
    files.set(p, { data, kind: 'js' });
    if (/\bimport\s*\(/.test(text)) fail(`${tree.label}: ${p} uses dynamic import() (or text that looks like it) -- not supported by the release rules`);
    if (/\bimport\s*\.\s*meta\b/.test(text)) fail(`${tree.label}: ${p} uses import.meta -- not supported by the release rules`);
    if (script.type === 'classic') {
      if (mode === 'current') { try { new vm.Script(text, { filename: p }); } catch (e) { fail(`${tree.label}: ${p} does not parse as a classic script: ${e.message}`); } }
      continue;
    }
    for (const r of moduleRequests(text, p)) {
      if (r.attributes.length) fail(`${tree.label}: ${p} imports "${r.specifier}" with attributes (${r.attributes.join(', ')}) -- not supported`);
      const target = resolveLocal(r.specifier, path.posix.dirname(p), `${tree.label}: ${p} import`, '.js', { module: true });
      edges.push([p, target]);
      queue.push([target, `${p} imports "${r.specifier}"`]);
    }
  }
  const cssPath = resolveLocal(style.ref, '', `${tree.label}:index.html stylesheet`, '.css');
  const css = load(cssPath, 'index.html stylesheet');
  checkCss(utf8(css, cssPath), `${tree.label}:${cssPath}`);
  files.set(cssPath, { data: css, kind: 'css' });
  if (mode === 'current') {
    const cycle = findCycle(edges);
    if (cycle) fail(`${tree.label}: import cycle ${cycle.join(' -> ')} (not allowed until E4 decides otherwise)`);
    for (const [p, f] of files) scanQaMechanisms(f.data.toString('utf8'), `${tree.label}:${p}`);
    scanQaMechanisms(html, `${tree.label}:index.html`);
  }
  return { html, script: { ...script, path: entry }, style: { ...style, path: cssPath }, files, edges };
}
function findCycle(edges) {
  const adj = new Map();
  for (const [a, b] of edges) { if (!adj.has(a)) adj.set(a, []); adj.get(a).push(b); }
  const state = new Map(), stack = [];
  const dfs = (n) => {
    state.set(n, 1); stack.push(n);
    for (const m of adj.get(n) || []) {
      if (state.get(m) === 1) return [...stack.slice(stack.indexOf(m)), m];
      if (!state.get(m)) { const c = dfs(m); if (c) return c; }
    }
    state.set(n, 2); stack.pop();
    return null;
  };
  for (const n of adj.keys()) if (!state.get(n)) { const c = dfs(n); if (c) return c; }
  return null;
}

/** The frozen classic pair, checked against its pins. */
export function readFrozen(tree) {
  const out = {};
  for (const [name, pin] of Object.entries(FROZEN.files)) {
    const e = tree.read(name);
    if (!e || !e.data) fail(`frozen classic ${name} is missing from ${tree.label}`);
    const got = sha256(e.data);
    if (got !== pin) fail(`frozen classic ${name}: SHA-256 ${got} != pinned ${pin} -- the root pair must never change`);
    out[name] = e.data;
  }
  try { new vm.Script(out['game.js'].toString('utf8'), { filename: 'frozen game.js' }); } catch (e) { fail(`frozen classic game.js does not parse as a classic script: ${e.message}`); }
  return out;
}

/* ---------------------------------------------------------------- retention */
/** Which releases the artifact keeps. chain: era commits newest first.
 *  Without a ledger (the wired mode) git cannot tell which commits were
 *  really published or when, so it keeps every commit that may have been:
 *  - the release being built and the live one (from the pre-check);
 *  - every era commit whose commit date is within `days` of now (any commit
 *    can be published by workflow_dispatch, so not only runtime changes);
 *  - the `min` newest commits that trigger the workflow by push
 *    (DEPLOY_PATHS: runtime, workflow, release script) -- covers a quiet
 *    month followed by quick deploys, whatever their commit dates.
 *  With the ledger (L1, the wired mode in CI: checkLedger() + planLedger()
 *  on GitHub's deployment records) it keeps the current and the live
 *  release plus whatever planLedger() requires -- and nothing that was
 *  provably never published. Without a ledger (--no-ledger: local previews
 *  and tests only) the generous git-only rule above applies.
 *  More than `max` -> error, never a silent drop. */
export function selectRetention({ chain, current, anchor = null, nowMs, ledger = null, classify = null, live = null, policy = RETENTION, eraEpoch = LEDGER.eraEpoch, planOut = null, recovery = false }) {
  const bySha = new Map(chain.map((c, i) => [c.sha, { ...c, order: i }]));
  if (!bySha.has(current)) fail(`release ${current.slice(0, 12)} is not on main's first-parent chain of the versioned era`);
  const keep = new Map();
  const add = (sha, why) => { if (!keep.has(sha)) keep.set(sha, new Set()); keep.get(sha).add(why); };
  add(current, 'current');
  if (anchor) {
    const hit = chain.filter(c => c.sha.startsWith(anchor));
    if (hit.length !== 1) fail(`the live release ${anchor} is ${hit.length ? 'ambiguous' : 'not on main\'s first-parent chain'} -- it cannot be rebuilt, so cached copies would 404`);
    add(hit[0].sha, 'live now');
  }
  const windowStart = nowMs - policy.days * 864e5;
  if (!ledger) {
    for (const c of chain) if (c.time * 1000 >= windowStart) add(c.sha, `commit within ${policy.days} days`);
    chain.filter(c => c.changed == null || c.changed.some(f => matchesDeployPaths(f))).slice(0, policy.min).forEach(c => add(c.sha, `one of the last ${policy.min} deploy-triggering commits`));
  } else {
    if (!classify) fail('ledger mode needs the history to classify deployment records');
    if (!live) usage('the ledger mode needs the live site (--live-json from precheck-live): the ledger is checked against it');
    const plan = planLedger({ deployments: ledger.deployments, fetched: ledger.fetched, classify, nowMs: ledger.nowMs, policy, live, eraEpoch, recovery });
    if (plan.needMore) fail(`ledger is incomplete: the statuses of ${plan.examined} of ${plan.relevant} versioned-era records do not settle the retention -- re-read the ledger; never guessed`);
    for (const [sha, why] of plan.keep) { if (!bySha.has(sha)) fail(`ledger: release ${sha.slice(0, 12)} must be kept but is not on main's first-parent chain`); why.forEach(w => add(sha, w)); }
    if (planOut) Object.assign(planOut, plan);
  }
  if (keep.size > policy.max) fail(`retention needs ${keep.size} releases, over the limit of ${policy.max}: refusing to drop any silently -- raise RETENTION.max or decide which may go (owner decision)`);
  return [...keep].map(([sha, why]) => ({ sha, id: sha.slice(0, 12), time: bySha.get(sha).time, order: bySha.get(sha).order, reasons: [...why] })).sort((a, b) => a.order - b.order);
}

/* ---------------------------------------------------------------- ledger (L1)
   The real publication history: GitHub's deployment records of the
   github-pages environment (REST: GET /repos/{o}/{r}/deployments?environment=
   and GET .../deployments/{id}/statuses). The workflow binds that environment
   only to the job that uploads and deploys, so one record = one publication
   attempt of its sha, and its `success` status = published at that time
   (real records: waiting -> queued -> in_progress -> success, `inactive`
   after a success only sometimes; since the era epoch every record must come
   from the github-actions app, L1-R1).
   GitHub keeps previous statuses for 90 days (the current one forever): an
   older record without a visible success is UNKNOWN -- maybe published --
   never "not published". Everything the ledger cannot prove keeps more, and
   whatever must be kept but cannot be rebuilt is a STOP. */
export const LEDGER = {
  schema: 'vh-ledger/1', environment: 'github-pages',
  statusRetentionDays: 90, // GitHub deletes previous deployment statuses after 90 days
  completeMarginDays: 2,   // a record younger than 90 - 2 days still has every status
  inFlightHours: 6,        // waiting/queued/pending/in_progress younger than this -> STOP (retry later)
  successSpanHours: 24,    // a success is posted by the job that created the record
  eraEpoch: '2026-10-18T00:00:00Z', // no versioned release can be deployed before E3 existed
  maxAgeMinutes: 15,       // the ledger is read right before assembling
  perPage: 100, maxPages: 50, maxRequests: 400, timeoutMs: 20000, skewMs: 5 * 60e3,
  deployApp: 'github-actions' // L1-R1 (H1): the only app that may create era records
};
// `waiting` (L1-R1): GitHub Actions posts it first on every record while the
// environment's protection rules are evaluated (real history: waiting ->
// queued -> in_progress -> success); it is not in the REST docs' list.
const STATES = new Set(['error', 'failure', 'inactive', 'in_progress', 'queued', 'pending', 'success', 'waiting']);
const IN_FLIGHT = new Set(['waiting', 'queued', 'pending', 'in_progress']);
const SHA_RE = /^[0-9a-f]{40}$/;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
function isoMs(v, what) {
  const t = typeof v === 'string' && ISO_RE.test(v) ? Date.parse(v) : NaN;
  if (!Number.isFinite(t)) fail(`ledger: ${what} is not a valid UTC timestamp (${JSON.stringify(v)})`);
  return t;
}
const byNewest = (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id;
const byOldest = (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id;

/** One deployment record (API or file) -> its normalized fields, or a STOP. */
function checkDeployment(d, { nowMs, repoUrl = null, eraEpoch = LEDGER.eraEpoch, fromFile = false }) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) fail('ledger: a deployment record is not an object');
  if (!Number.isSafeInteger(d.id) || d.id <= 0) fail(`ledger: deployment id ${JSON.stringify(d.id)} is not a positive integer`);
  if (typeof d.sha !== 'string' || !SHA_RE.test(d.sha)) fail(`ledger: deployment ${d.id}: sha ${JSON.stringify(d.sha)} is not a full 40-hex commit`);
  if (d.environment !== LEDGER.environment) fail(`ledger: deployment ${d.id} is for environment ${JSON.stringify(d.environment)}, not ${LEDGER.environment}`);
  const c = isoMs(d.created_at, `deployment ${d.id} created_at`), u = isoMs(d.updated_at, `deployment ${d.id} updated_at`);
  if (u < c) fail(`ledger: deployment ${d.id} was updated (${d.updated_at}) before it was created (${d.created_at})`);
  if (c > nowMs + LEDGER.skewMs) fail(`ledger: deployment ${d.id} is created in the future (${d.created_at})`);
  if (repoUrl !== null && String(d.repository_url || '').toLowerCase() !== repoUrl.toLowerCase()) fail(`ledger: deployment ${d.id} belongs to ${JSON.stringify(d.repository_url)}, not ${repoUrl}`);
  // L1-R1 (H1): the app that created the record. Since the era epoch only the
  // workflow's deploy job (github-actions) may; anything else -- the
  // branch-based "pages build and deployment" (github-pages), an unknown app,
  // or no app at all -- means the records may no longer be one publication
  // of the checked artifact each (Pages source changed?). Older classic
  // records are served by the frozen root and keep any app.
  const via = fromFile ? d.app : d.performed_via_github_app == null ? null : typeof d.performed_via_github_app === 'object' && !Array.isArray(d.performed_via_github_app) ? d.performed_via_github_app.slug : undefined;
  const app = typeof via === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(via) ? via : null;
  if (c >= Date.parse(eraEpoch) && app !== LEDGER.deployApp) fail(`ledger: deployment ${d.id} (${d.created_at}, after the era epoch ${eraEpoch}) was created by ${app ? `the app "${app}"` : `no identifiable app (${JSON.stringify(via === undefined ? d.performed_via_github_app : via)})`}, not ${LEDGER.deployApp} -- the Pages source may no longer be GitHub Actions; owner check (Settings -> Pages -> Source), STOP`);
  return { id: d.id, sha: d.sha, environment: d.environment, created_at: d.created_at, updated_at: d.updated_at, app };
}
function checkStatus(s, dep, nowMs) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) fail(`ledger: deployment ${dep.id}: a status is not an object`);
  if (!Number.isSafeInteger(s.id) || s.id <= 0) fail(`ledger: deployment ${dep.id}: status id ${JSON.stringify(s.id)} is not a positive integer`);
  if (!STATES.has(s.state)) fail(`ledger: deployment ${dep.id}: unknown status state ${JSON.stringify(s.state)}`);
  const t = isoMs(s.created_at, `deployment ${dep.id} status ${s.id} created_at`);
  if (t < Date.parse(dep.created_at) - 60e3) fail(`ledger: deployment ${dep.id}: status ${s.id} (${s.created_at}) is older than the deployment (${dep.created_at})`);
  if (t > nowMs + LEDGER.skewMs) fail(`ledger: deployment ${dep.id}: status ${s.id} is in the future (${s.created_at})`);
  if (s.environment != null && s.environment !== LEDGER.environment) fail(`ledger: deployment ${dep.id}: status ${s.id} is for environment ${JSON.stringify(s.environment)}`);
  if (s.deployment_url != null && !String(s.deployment_url).endsWith(`/deployments/${dep.id}`)) fail(`ledger: deployment ${dep.id}: status ${s.id} belongs to ${s.deployment_url}`);
  return { id: s.id, state: s.state, created_at: s.created_at };
}
/** Newest first, ids unique, ids and creation times in the same order. */
function checkOrder(list) {
  const seen = new Map();
  for (const d of list) {
    if (seen.has(d.id)) fail(`ledger: deployment ${d.id} is listed twice${seen.get(d.id) === d.sha ? '' : ` with two shas (${seen.get(d.id).slice(0, 12)}, ${d.sha.slice(0, 12)})`} -- the listing changed while it was read or the data is contradictory; retry`);
    seen.set(d.id, d.sha);
  }
  for (let i = 1; i < list.length; i++) {
    if (byNewest(list[i - 1], list[i]) > 0) fail('ledger: deployments are not in newest-first order');
    if (list[i].id > list[i - 1].id) fail(`ledger: deployment ${list[i].id} (${list[i].created_at}) is older than deployment ${list[i - 1].id} (${list[i - 1].created_at}) -- contradictory chronology`);
  }
}

/** A ledger file (from `ledger`) -> validated, normalized, or a STOP. */
export function checkLedger(l, { nowMs, repository = null, eraEpoch = LEDGER.eraEpoch }) {
  if (!l || l.schema !== LEDGER.schema) fail(`ledger: not a ${LEDGER.schema} file`);
  const src = l.source || {};
  if (src.environment !== LEDGER.environment) fail(`ledger: environment ${JSON.stringify(src.environment)}, expected ${LEDGER.environment}`);
  if (!REPO_RE.test(String(src.repository))) fail(`ledger: repository ${JSON.stringify(src.repository)} is not OWNER/REPO`);
  if (repository && src.repository.toLowerCase() !== repository.toLowerCase()) fail(`ledger: read from ${src.repository}, this run is ${repository}`);
  if (!l.listing || l.listing.complete !== true) fail('ledger: the deployment listing is not marked complete');
  const at = isoMs(l.fetchedAt, 'fetchedAt');
  if (nowMs < at - LEDGER.skewMs || nowMs > at + LEDGER.maxAgeMinutes * 60e3) fail(`ledger: read at ${l.fetchedAt}, assembling at ${new Date(nowMs).toISOString()} -- read the ledger right before assembling (max ${LEDGER.maxAgeMinutes} min)`);
  if (!Array.isArray(l.deployments)) fail('ledger: deployments is not a list');
  if (l.listing.count !== l.deployments.length) fail(`ledger: listing count ${l.listing.count} != ${l.deployments.length} records`);
  if (!Number.isSafeInteger(l.statusesFetched) || l.statusesFetched < 0 || l.statusesFetched > l.deployments.length) fail('ledger: statusesFetched is out of range');
  const out = l.deployments.map((d, i) => {
    const n = checkDeployment(d, { nowMs: at, eraEpoch, fromFile: true });
    if ((i < l.statusesFetched) !== Array.isArray(d.statuses)) fail(`ledger: deployment ${d.id}: statuses ${i < l.statusesFetched ? 'missing' : 'present for a record that was not examined'}`);
    if (Array.isArray(d.statuses)) {
      n.statuses = d.statuses.map(s => checkStatus(s, n, at));
      if (new Set(n.statuses.map(s => s.id)).size !== n.statuses.length) fail(`ledger: deployment ${d.id}: a status is listed twice`);
      n.statuses.sort(byOldest);
    } else n.statuses = null;
    return n;
  });
  checkOrder(out);
  return { source: { api: src.api || null, repository: src.repository, environment: src.environment }, fetchedAt: l.fetchedAt, nowMs: at, deployments: out, fetched: l.statusesFetched };
}

/** Which releases the ledger requires (the L1 retention rule):
 *  - every release live at any moment of the last `days` (a publication is
 *    live until the next proven one; nothing assumed to end earlier);
 *  - the releases of the last `min` distinct publications;
 *  - every UNKNOWN record (maybe published) inside either range.
 *  Records created before the oldest versioned-era record are classic
 *  (served by the frozen root: no v/ folder). A needed release that is not
 *  on main's era chain cannot be rebuilt -> STOP. `needMore` = the statuses
 *  read so far cannot settle the answer (the ledger reader reads on). */
export function planLedger({ deployments, fetched, classify, nowMs, policy = RETENTION, live = null, eraEpoch = LEDGER.eraEpoch, recovery = false }) {
  const epoch = Date.parse(eraEpoch);
  const ds = deployments.map((d) => { const t = Date.parse(d.created_at); return { ...d, t, kind: t < epoch ? 'pre-era' : classify(d.sha) }; });
  let relevant = 0;
  ds.forEach((d, i) => { if (['era', 'foreign', 'missing'].includes(d.kind)) relevant = i + 1; });
  const all = fetched >= relevant;
  // Records not read yet are older than ds[fetched-1]; their successes come within successSpanHours.
  const settled = all ? -Infinity : fetched ? ds[fetched - 1].t + LEDGER.successSpanHours * 36e5 : Infinity;
  const events = [], notPublished = [], unknown = [];
  for (const d of ds.slice(0, Math.min(fetched, relevant))) {
    const st = d.statuses;
    const base = { sha: d.sha, kind: d.kind, dep: d.id };
    const succ = st.filter(s => s.state === 'success');
    for (const s of succ) if (Date.parse(s.created_at) - d.t > LEDGER.successSpanHours * 36e5) fail(`ledger: deployment ${d.id} got a success status ${s.created_at}, long after its creation ${d.created_at} -- one record must be one publication job; the ledger model does not hold (STOP, owner review)`);
    if (succ.length) { succ.forEach(s => events.push({ ...base, t: Date.parse(s.created_at), at: s.created_at, proven: true })); continue; }
    const cur = st[st.length - 1];
    let why = null;
    if (d.t <= nowMs - (LEDGER.statusRetentionDays - LEDGER.completeMarginDays) * 864e5) why = `created ${d.created_at}, beyond GitHub's ${LEDGER.statusRetentionDays}-day status retention, no success visible (it may have been deleted)`;
    else if (!cur) why = 'no status at all';
    else if (IN_FLIGHT.has(cur.state)) {
      if (d.t > nowMs - LEDGER.inFlightHours * 36e5) infra(`ledger: deployment ${d.id} (${d.sha.slice(0, 12)}) is still ${cur.state} -- a publication may be in progress or not visible yet; retry later`);
      why = `stale ${cur.state} since ${cur.created_at}`;
    }
    if (why) { unknown.push({ ...base, why }); events.push({ ...base, t: d.t, at: d.created_at, proven: false, why }); } else notPublished.push({ ...base, state: cur.state });
  }
  events.sort((a, b) => b.t - a.t || b.dep - a.dep);
  const windowStart = nowMs - policy.days * 864e5;
  const keep = new Map(), classic = new Map();
  const need = (e, why) => {
    if (e.kind === 'classic' || e.kind === 'pre-era') { if (!classic.has(e.sha)) classic.set(e.sha, why); return; }
    if (e.kind !== 'era') fail(`ledger: ${e.proven ? 'published' : 'possibly published'} release ${e.sha.slice(0, 12)} (deployment ${e.dep}) must be kept (${why}) but it is ${e.kind === 'foreign' ? 'off main\'s first-parent chain' : 'not in the repository'} -- it cannot be rebuilt, so cached pages would 404 (STOP)`);
    if (!keep.has(e.sha)) keep.set(e.sha, new Set());
    keep.get(e.sha).add(why);
  };
  let windowDone = false, end = nowMs, latest = null;
  const distinct = [];
  const more = () => ({ needMore: true, examined: fetched, relevant });
  for (const e of events) {
    if (windowDone && distinct.length >= policy.min) break;
    if (e.t <= settled) return more();
    if (!latest && e.proven) latest = e;
    if (!windowDone) {
      if (end >= windowStart) need(e, e.proven ? `live within ${policy.days} days (ledger: published ${e.at})` : `maybe live within ${policy.days} days (ledger: ${e.why})`);
      if (e.proven) { end = e.t; if (e.t < windowStart) windowDone = true; }
    }
    if (distinct.length < policy.min) {
      if (e.proven) { if (!distinct.includes(e.sha)) distinct.push(e.sha); need(e, `one of the last ${policy.min} published (ledger)`); } else need(e, `maybe one of the last ${policy.min} published (ledger: ${e.why})`);
    }
  }
  if (!all && !(windowDone && distinct.length >= policy.min)) return more();
  // K2: a recovery run records a disagreement instead of stopping -- only
  // when the ledger itself keeps the live release (checked below).
  const disagreements = [];
  const disagree = (msg) => { if (!recovery) fail(msg); disagreements.push(msg); };
  if (live) {
    if (live.era === 'versioned') {
      if (!latest || latest.kind !== 'era') disagree(`ledger disagrees with the live site: live v/${live.anchorId}/, but the ledger shows no successful versioned publication -- the API may not show the newest deployment yet (retry later); never guessed`);
      else if (!latest.sha.startsWith(live.anchorId)) disagree(`ledger disagrees with the live site (live ${live.anchorId}, ledger's last successful publication ${latest.sha.slice(0, 12)}, deployment ${latest.dep} at ${latest.at}) -- a propagation delay or contradictory data; retry later, never guessed`);
      else {
        const cur = ds.find(d => d.id === latest.dep).statuses.slice(-1)[0];
        if (cur.state !== 'success') disagree(`ledger: the live release's deployment ${latest.dep} is now ${cur.state} with no newer publication -- contradictory (STOP, owner review)`);
      }
      if (disagreements.length && ![...keep.keys()].some(sha => sha.startsWith(live.anchorId))) fail(`recovery: the ledger does not keep the live release ${live.anchorId} (no proven publication of it in the retention range) -- the standard runs after a recovery could drop v/${live.anchorId}/ while pages may still load it: STOP, owner decision (${disagreements[0]})`);
    } else if (latest && latest.kind === 'era') disagree(`ledger disagrees with the live site: the live site is classic, the ledger's last successful publication is the versioned ${latest.sha.slice(0, 12)} (deployment ${latest.dep})`);
  }
  return {
    needMore: false, examined: fetched, relevant, keep, latest: latest && { sha: latest.sha, deployment: latest.dep, at: latest.at },
    classic: [...classic].map(([sha, why]) => ({ sha, why })), notPublished, unknown, disagreements
  };
}

/* ---- reading the ledger from the GitHub REST API (GET only) */
function apiBase(url) {
  let u;
  try { u = new URL(url); } catch (e) { usage(`--api-url ${url} is not a URL`); }
  const loop = ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && loop)) usage(`--api-url must be https (plain http only for a local test server): ${url}`);
  if (u.search || u.hash || u.username || u.password) usage('--api-url must be a bare base URL');
  return u.origin + u.pathname.replace(/\/+$/, '');
}
async function apiGet(url, ctx) {
  if (++ctx.requests > ctx.maxRequests) fail(`ledger: more than ${ctx.maxRequests} API requests needed -- refusing to go on (raise --max-requests deliberately, owner decision)`);
  let res, text;
  const where = new URL(url).pathname + new URL(url).search;
  try {
    res = await fetch(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(ctx.timeoutMs), headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'vector-hole-release', Authorization: `Bearer ${ctx.token}` } });
    text = await res.text();
  } catch (e) { infra(`ledger: GET ${where}: ${e.name === 'TimeoutError' || e.name === 'AbortError' ? `timeout after ${ctx.timeoutMs} ms` : (e.cause && e.cause.code) || e.message} -- nothing assumed`); }
  if (res.status !== 200) {
    const rl = res.headers.get('x-ratelimit-remaining');
    const why = (res.status === 403 || res.status === 429) && (rl === '0' || res.headers.get('retry-after')) ? `the API rate limit is exhausted${res.headers.get('x-ratelimit-reset') ? ` (resets ${new Date(Number(res.headers.get('x-ratelimit-reset')) * 1000).toISOString()})` : ''}`
      : res.status === 401 || res.status === 403 ? 'the token is missing or lacks deployments: read'
      : res.status === 404 ? 'the repository or the endpoint is not visible to this token (deployments: read?)' : 'the API refused or failed';
    infra(`ledger: GET ${where}: HTTP ${res.status} -- ${why}; nothing assumed`);
  }
  if (!/^application\/json\b/i.test(res.headers.get('content-type') || '')) infra(`ledger: GET ${where}: content-type ${res.headers.get('content-type')} is not JSON`);
  let data;
  try { data = JSON.parse(text); } catch (e) { infra(`ledger: GET ${where}: the response is not valid JSON`); }
  return { data, link: res.headers.get('link') };
}
/** The Link header -> the URL of the next page, or null on the last page.
 *  L1-R1: the header is only a checked signal, never a URL to follow -- the
 *  next page is built from our own URL (same origin, /repos/{o}/{r}/ path,
 *  query; page + 1), so the token never goes anywhere the run did not choose.
 *  GitHub names the repository by its numeric id in Link
 *  (/repositories/<id>/...); that form is accepted for the same endpoint,
 *  with one id per run ($GITHUB_REPOSITORY_ID when given, else the first
 *  link's). Another origin, endpoint or id, a changed or extra parameter, a
 *  page that is not the next one, two next links or an unreadable header = STOP. */
function nextLink(link, current, ctx) {
  if (!link) return null;
  const parts = link.split(',').map(p => /^\s*<([^>]+)>\s*;\s*rel="([^"]+)"\s*$/.exec(p));
  if (parts.some(m => !m)) fail(`ledger: unreadable Link header ${JSON.stringify(link.slice(0, 200))}`);
  const next = parts.filter(m => m[2].split(/\s+/).includes('next'));
  if (next.length > 1) fail('ledger: two rel="next" links');
  if (!next.length) return null;
  let n;
  try { n = new URL(next[0][1]); } catch (e) { fail(`ledger: the next page link ${JSON.stringify(next[0][1].slice(0, 200))} is not a URL`); }
  const c = new URL(current);
  if (!c.pathname.startsWith(ctx.repoPath + '/')) fail(`internal: ${c.pathname} is not under ${ctx.repoPath}/`);
  const endpoint = c.pathname.slice(ctx.repoPath.length);
  const byId = n.pathname.startsWith(ctx.basePath + '/repositories/') ? /^\/repositories\/([1-9][0-9]{0,19})(\/.*)$/.exec(n.pathname.slice(ctx.basePath.length)) : null;
  if (n.origin !== c.origin || n.username || n.password || n.hash || !(n.pathname === c.pathname || (byId && byId[2] === endpoint))) fail(`ledger: the next page points elsewhere (${n.origin}${n.pathname}) -- refused`);
  if (byId) {
    if (ctx.repoId === null) ctx.repoId = byId[1];
    if (byId[1] !== ctx.repoId) fail(`ledger: the next page names repository ${byId[1]}, this run reads repository ${ctx.repoId} -- refused`);
  }
  const page = n.searchParams.get('page'), cur = Number(c.searchParams.get('page') || 1);
  if (page !== String(cur + 1)) fail(`ledger: the next page is ${page} after page ${cur} -- incomplete or reordered pagination`);
  const own = new URL(current);
  own.searchParams.set('page', String(cur + 1));
  const query = (u) => [...u.searchParams].filter(([k]) => k !== 'page').map(([k, v]) => `${k}=${v}`).sort().join('&');
  const keys = [...n.searchParams.keys()];
  if (new Set(keys).size !== keys.length || query(n) !== query(own)) fail(`ledger: the next page changes the query (${n.search.slice(0, 200)}, expected ${own.search}) -- refused`);
  return own.href;
}
/** Every page of a list endpoint; a page that is not a full page before the end, or a missing next link after a full one, is a STOP. */
async function listAll(first, ctx, what) {
  const items = [];
  let url = first, pages = 0;
  for (;;) {
    if (++pages > LEDGER.maxPages) fail(`ledger: ${what}: more than ${LEDGER.maxPages} pages`);
    const { data, link } = await apiGet(url, ctx);
    if (!Array.isArray(data)) fail(`ledger: ${what}: page ${pages} is not a list`);
    items.push(...data);
    const next = nextLink(link, url, ctx);
    if (next && data.length !== ctx.perPage) fail(`ledger: ${what}: page ${pages} holds ${data.length} of ${ctx.perPage} items but is not the last -- incomplete pagination`);
    if (!next) {
      if (data.length > ctx.perPage) fail(`ledger: ${what}: page ${pages} holds ${data.length} items, more than ${ctx.perPage}`);
      if (data.length === ctx.perPage) {
        // A full last page: prove the end instead of trusting a missing Link.
        const probe = new URL(url); probe.searchParams.set('page', String(Number(probe.searchParams.get('page') || 1) + 1));
        const r = await apiGet(probe.href, ctx);
        if (!Array.isArray(r.data) || r.data.length) fail(`ledger: ${what}: a full page without a next link is followed by more items -- incomplete pagination`);
      }
      return { items, pages };
    }
    url = next;
  }
}
/** Reads the ledger: all deployment records of the environment, then their
 *  statuses newest first until planLedger() can settle the retention. */
export async function readLedger({ apiUrl, repository, token, history, nowMs, perPage = LEDGER.perPage, timeoutMs = LEDGER.timeoutMs, maxRequests = LEDGER.maxRequests, eraEpoch = LEDGER.eraEpoch, repositoryId = null }) {
  if (!token) infra('ledger: no token ($GITHUB_TOKEN is empty) -- the workflow must grant deployments: read; nothing assumed');
  if (!REPO_RE.test(String(repository))) usage(`--repository ${repository} is not OWNER/REPO`);
  if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > 100) usage('--per-page must be 1..100');
  if (repositoryId !== null && !/^[1-9][0-9]{0,19}$/.test(String(repositoryId))) usage(`--repository-id ${repositoryId} is not a numeric repository id`);
  const base = apiBase(apiUrl);
  const repoUrl = `${base}/repos/${repository}`;
  const basePath = new URL(base).pathname.replace(/\/+$/, '');
  const ctx = { token, timeoutMs, maxRequests, perPage, requests: 0, basePath, repoPath: new URL(repoUrl).pathname, repoId: repositoryId === null ? null : String(repositoryId) };
  const listUrl = `${repoUrl}/deployments?environment=${encodeURIComponent(LEDGER.environment)}&per_page=${perPage}`;
  const { items, pages } = await listAll(listUrl, ctx, 'deployments');
  const deployments = items.map(d => {
    const n = checkDeployment(d, { nowMs, repoUrl, eraEpoch });
    if (d.statuses_url != null && String(d.statuses_url).toLowerCase() !== `${repoUrl}/deployments/${d.id}/statuses`.toLowerCase()) fail(`ledger: deployment ${d.id}: statuses_url ${d.statuses_url} is not this repository's`);
    return n;
  });
  deployments.sort(byNewest);
  checkOrder(deployments);
  let fetched = 0, plan;
  for (;;) {
    plan = planLedger({ deployments, fetched, classify: history.classify, nowMs, eraEpoch });
    if (!plan.needMore) break;
    const d = deployments[fetched];
    const { items: st } = await listAll(`${repoUrl}/deployments/${d.id}/statuses?per_page=${perPage}`, ctx, `deployment ${d.id} statuses`);
    d.statuses = st.map(s => checkStatus(s, d, nowMs));
    if (new Set(d.statuses.map(s => s.id)).size !== d.statuses.length) fail(`ledger: deployment ${d.id}: a status is listed twice`);
    d.statuses.sort(byOldest);
    fetched++;
  }
  return {
    schema: LEDGER.schema, source: { api: base, repository, repositoryId: ctx.repoId, environment: LEDGER.environment },
    fetchedAt: new Date(nowMs).toISOString(), statusRetentionDays: LEDGER.statusRetentionDays, requests: ctx.requests,
    listing: { complete: true, pages, perPage, count: deployments.length },
    statusesFetched: fetched, relevant: plan.relevant,
    deployments
  };
}

/* ---------------------------------------------------------------- assemble */
export function assemble({ history, current, id, out, live = null, nowMs, ledger = null, policy = RETENTION, allowNonTip = false, worktree = null, eraEpoch = LEDGER.eraEpoch, recovery = null }) {
  const warnings = [];
  const plan = {};
  let retained;
  // K2: a damaged live site is accepted only by a recovery run, and a recovery run only with the ledger and its own pre-check.
  if (live && live.recovery && !recovery) fail('the live pre-check was made for a recovery run -- a standard run never accepts it');
  if (recovery) {
    if (worktree || !ledger || allowNonTip) usage('a recovery run assembles main from git with the deployment ledger (no --source worktree, --no-ledger or --allow-non-tip)');
    if (!live || live.recovery !== true || !Array.isArray(live.damaged)) usage('a recovery run needs its own live pre-check (precheck-live --recovery)');
    if (recovery.sha !== current) fail(`recovery: authorized for ${recovery.sha.slice(0, 12)}, assembling ${current.slice(0, 12)} (STOP)`);
    if (history.tip !== current) fail(`recovery: main has moved on (tip ${history.tip.slice(0, 12)}, authorized ${current.slice(0, 12)}) -- STOP, decide again on the current state`);
  }
  if (worktree) {
    retained = [{ sha: id, id, time: null, reasons: ['current (worktree, no history)'] }];
  } else {
    if (history.tip !== current && !allowNonTip) throw new ReleaseError('superseded', `main has moved on (tip ${history.tip.slice(0, 12)}, this run ${current.slice(0, 12)}): nothing to deploy -- the newer run publishes`);
    retained = selectRetention({ chain: history.chain, current, anchor: live && live.anchorId, nowMs, ledger, classify: history.classify, live, policy, eraEpoch, planOut: plan, recovery: !!recovery });
  }
  const ids = new Map();
  for (const r of retained) { if (ids.has(r.id) && ids.get(r.id) !== r.sha) fail(`id collision: ${r.id} is the prefix of two commits`); ids.set(r.id, r.sha); }

  const files = new Map(); // release path -> Buffer
  const put = (p, data) => { if (files.has(p) && !files.get(p).equals(data)) fail(`immutability: ${p} would hold two different contents`); files.set(p, data); };
  const frozen = readFrozen(history.frozen());
  for (const [n, d] of Object.entries(frozen)) put(n, d);

  const releases = [], excluded = [];
  let saveSchema = null;
  for (const r of retained) {
    const isCurrent = r.sha === current;
    const isLive = r.reasons.includes('live now');
    let rel;
    try {
      rel = readRelease(worktree || history.tree(r.sha), isCurrent ? 'current' : 'reproduce');
      // Nothing published may carry QA hooks, whichever rules built it.
      for (const [p, f] of rel.files) scanQaMechanisms(f.data.toString('utf8'), `v/${r.id}/${p}`);
    } catch (e) {
      if (!(e instanceof ReleaseError) || e.kind !== 'release' || isCurrent || isLive) throw e;
      // L1: the ledger keeps only releases that were (or may have been)
      // published -- one that cannot be rebuilt is a STOP, never "excluded".
      if (ledger) fail(`release ${r.id} must be kept (${r.reasons.join('; ')}) but cannot be rebuilt from its commit: ${e.message} -- a published release is never left out (STOP)`);
      // --no-ledger only (local previews/tests): content that fails the
      // reproduce rules today failed them at its own time too (they decide
      // only the graph), so the fail-closed workflow never published it.
      // Logged, not silent.
      excluded.push({ id: r.id, sha: r.sha, reason: e.message });
      warnings.push(`not retained ${r.id}: ${e.message} (never publishable, so no cached page can reference it)`);
      continue;
    }
    const list = [];
    for (const [p, f] of [...rel.files].sort((a, b) => a[0].localeCompare(b[0]))) {
      put(`v/${r.id}/${p}`, f.data);
      list.push({ path: p, sha256: sha256(f.data), bytes: f.data.length });
    }
    if (isCurrent) put('index.html', Buffer.from(rewriteHtml(rel.html, `v/${r.id}/${rel.script.path}`, `v/${r.id}/${rel.style.path}`), 'utf8'));
    if (isCurrent && recovery) saveSchema = saveSchemaOf(rel);
    if (isLive && live && live.anchorFiles) {
      const liveList = Object.keys(live.anchorFiles).sort().join(',');
      const ours = list.map(l => l.path).sort().join(',');
      if (recovery) {
        // K2: the damaged files are rebuilt; every file the live site serves must be one of the rebuild, with its bytes.
        const missing = [...Object.keys(live.anchorFiles), ...live.damaged.map(d => d.path)].filter(p => !list.some(l => l.path === p));
        if (missing.length) fail(`immutability: live v/${r.id}/ has [${missing.join(',')}], which the rebuild [${ours}] does not -- not the same release (STOP)`);
      } else if (liveList !== ours) fail(`immutability: live v/${r.id}/ holds [${liveList}], the rebuild gives [${ours}]`);
      for (const l of list) if ((!recovery || l.path in live.anchorFiles) && live.anchorFiles[l.path] !== l.sha256) fail(`immutability: live v/${r.id}/${l.path} is ${live.anchorFiles[l.path]}, the rebuild gives ${l.sha256} -- an id must never change bytes`);
    }
    releases.push({ id: r.id, sha: r.sha, commitTime: r.time, reasons: r.reasons, entry: rel.script.path, type: rel.script.type, style: rel.style.path, files: list });
  }
  if (!files.has('index.html')) fail('the current release produced no index.html');

  if (fs.existsSync(out) && fs.readdirSync(out).length) usage(`--out ${out} exists and is not empty`);
  fs.mkdirSync(out, { recursive: true });
  for (const [p, d] of [...files].sort((a, b) => a[0].localeCompare(b[0]))) {
    const abs = path.join(out, ...p.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, d);
  }
  const manifest = {
    schema: 'vh-release/1', current: id, currentSha: worktree ? null : current, now: new Date(nowMs).toISOString(),
    frozen: { rev: FROZEN.rev, files: FROZEN.files }, liveBefore: live, policy,
    retentionMode: worktree ? 'worktree' : ledger ? 'ledger' : 'git-only (--no-ledger)',
    ledger: ledger ? {
      source: ledger.source, fetchedAt: ledger.fetchedAt, records: ledger.deployments.length, statusesRead: ledger.fetched, versionedEraRecords: plan.relevant,
      latestPublication: plan.latest, classicServedByRoot: plan.classic, notPublished: plan.notPublished, unknown: plan.unknown
    } : null,
    releases, excluded, warnings,
    files: [...files].map(([p, d]) => ({ path: p, sha256: sha256(d), bytes: d.length })).sort((a, b) => a.path.localeCompare(b.path))
  };
  // K2: the decision trail of a recovery run (a standard manifest has no such key).
  if (recovery) manifest.recovery = { authorization: recovery, damaged: live.damaged, disagreements: plan.disagreements || [], saveSchema };
  if (ledger && excluded.length) fail('internal: the ledger mode never excludes a release');
  manifest.artifactSha256 = sha256(manifest.files.map(f => `${f.sha256}  ${f.path}\n`).join(''));
  verifyRelease(out, { id, manifest });
  return manifest;
}

/* ---------------------------------------------------------------- verify
   Re-reads the written folder from disk -- not the in-memory plan. */
export function verifyRelease(dir, { id = null, manifest = null } = {}) {
  const base = path.resolve(dir);
  const found = [];
  let bytes = 0;
  const walk = (abs, rel) => {
    for (const name of fs.readdirSync(abs).sort()) {
      const a = path.join(abs, name), r = rel ? rel + '/' + name : name;
      const st = fs.lstatSync(a);
      if (st.isSymbolicLink()) fail(`release: ${r} is a symlink`);
      if (st.isDirectory()) { walk(a, r); continue; }
      if (!st.isFile()) fail(`release: ${r} is not a regular file`);
      found.push(r); bytes += st.size;
    }
  };
  walk(base, '');
  const roots = [...new Set(found.map(f => f.split('/')[0]))].sort().join(',');
  if (roots !== 'game.js,index.html,style.css,v') fail(`release: the root must hold exactly index.html, game.js, style.css and v/ (found ${roots})`);
  for (const f of found) {
    const parts = f.split('/');
    if (!TYPES[path.posix.extname(f)]) fail(`release: ${f} is not an allowed file type (.html, .js, .css)`);
    if (parts.some(p => p.startsWith('.'))) fail(`release: ${f} is a hidden path`);
    if (parts.slice(0, -1).some(p => DEV_DIRS.has(p.toLowerCase()))) fail(`release: ${f} is inside a dev folder`);
    if (parts[0] === 'v' && !(parts.length >= 3 && (ID_RE.test(parts[1]) || TEST_ID_RE.test(parts[1])))) fail(`release: ${f} is not inside a v/<id>/ folder`);
    if (f.endsWith('.html') && f !== 'index.html') fail(`release: ${f} -- the only page is index.html`);
    scanQaMechanisms(fs.readFileSync(path.join(base, f), 'utf8'), `release/${f}`);
  }
  if (bytes > RETENTION.maxBytes) fail(`release: ${bytes} bytes, over the ${RETENTION.maxBytes} limit`);
  readFrozen(fsTree(base, 'release root'));
  const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
  const { script, style } = parseHtml(html, 'release/index.html');
  const sm = /^v\/([^/]+)\/(.+)$/.exec(script.ref), cm = /^v\/([^/]+)\/(.+)$/.exec(style.ref);
  if (!sm || !cm || sm[1] !== cm[1]) fail(`release/index.html must load its script and stylesheet from one v/<id>/ (got ${script.ref}, ${style.ref})`);
  if (id && sm[1] !== id) fail(`release/index.html points to v/${sm[1]}/, expected v/${id}/`);
  // The current release's graph, walked from the written files.
  const cur = readRelease(prefixTree(fsTree(base, 'release'), `v/${sm[1]}/`, html, script, style), 'current');
  const curFiles = [...cur.files.keys()].map(p => `v/${sm[1]}/${p}`);
  const vDirs = [...new Set(found.filter(f => f.startsWith('v/')).map(f => f.split('/')[1]))];
  for (const d of vDirs) checkVersionDir(base, d, found);
  if (manifest) {
    const want = manifest.files.map(f => `${f.sha256}  ${f.path}`).join('\n');
    const got = found.map(f => `${sha256(fs.readFileSync(path.join(base, f)))}  ${f}`).join('\n');
    if (want !== got) fail('release: the folder on disk differs from the manifest');
    for (const r of manifest.releases) for (const f of r.files) if (!found.includes(`v/${r.id}/${f.path}`)) fail(`release: v/${r.id}/${f.path} missing`);
    const accounted = new Set(['index.html', 'game.js', 'style.css', ...manifest.releases.flatMap(r => r.files.map(f => `v/${r.id}/${f.path}`))]);
    const extra = found.filter(f => !accounted.has(f));
    if (extra.length) fail(`release: files no release accounts for: ${extra.join(', ')}`);
  }
  for (const f of curFiles) if (!found.includes(f)) fail(`release: ${f} missing`);
  return { files: found.length, bytes, current: sm[1], versions: vDirs.sort() };
}
/** The current release seen as a source tree: v/<id>/x is read as x. */
function prefixTree(tree, prefix, html) {
  return {
    label: 'release ' + prefix.slice(0, -1),
    read(rel) {
      if (rel === 'index.html') return { data: Buffer.from(html.replace(/(<script\b[^>]*\bsrc=")v\/[^/"]+\//, '$1').replace(/(<link\b[^>]*\bhref=")v\/[^/"]+\//, '$1'), 'utf8') };
      return tree.read(prefix + rel);
    }
  };
}
/** Every .js under v/<id>/ resolves its static imports inside v/<id>/. */
function checkVersionDir(base, d, found) {
  const inDir = found.filter(f => f.startsWith(`v/${d}/`));
  if (!inDir.some(f => f.endsWith('.js'))) fail(`release: v/${d}/ holds no script`);
  for (const f of inDir.filter(x => x.endsWith('.js'))) {
    const rel = f.slice(`v/${d}/`.length);
    const text = fs.readFileSync(path.join(base, f), 'utf8');
    let reqs = [];
    try { reqs = moduleRequests(text, f); } catch (e) {
      try { new vm.Script(text, { filename: f }); continue; } catch (e2) { fail(`release: ${f} parses neither as a module nor as a classic script`); }
    }
    for (const r of reqs) {
      const t = resolveLocal(r.specifier, path.posix.dirname(rel), `release: ${f} import`, '.js', { module: true });
      if (!found.includes(`v/${d}/${t}`)) fail(`release: ${f} imports ${r.specifier}, missing as v/${d}/${t}`);
    }
  }
}

/* ---------------------------------------------------------------- live */
async function fetchBytes(url, { timeoutMs = 20000 } = {}) {
  let res;
  try { res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) }); } catch (e) { infra(`GET ${url}: ${e.cause && e.cause.code || e.message}`); }
  const data = Buffer.from(await res.arrayBuffer());
  if (res.status === 403 || res.status === 429 || res.status >= 500) infra(`GET ${url}: HTTP ${res.status} (the site or the network refused; not a game failure -- nothing verified)`);
  return { status: res.status, type: res.headers.get('content-type') || '', data };
}
const join = (base, p) => base.replace(/\/+$/, '') + '/' + p;
const bust = (u, n) => `${u}${u.includes('?') ? '&' : '?'}vh-check=${n}`;
function mimeOk(p, type) {
  const ext = path.posix.extname(p);
  if (ext === '.js') return /^(text|application)\/javascript\b/i.test(type);
  if (ext === '.css') return /^text\/css\b/i.test(type);
  return /^text\/html\b/i.test(type);
}
/** Before deploying: what the players' browsers can be holding right now.
 *  recovery (K2): the live state must be the one the owner named; a file of
 *  the live release that is missing (404) or served with a wrong type is
 *  recorded as damaged instead of a STOP (the assembly rebuilds it from git).
 *  Everything else stops exactly as in a standard run. */
export async function precheckLive(baseUrl, { nonce = Date.now(), recovery = null } = {}) {
  const idx = await fetchBytes(bust(join(baseUrl, 'index.html'), nonce));
  if (idx.status === 404) fail(`live ${join(baseUrl, 'index.html')} is 404 -- no live site to protect? Refusing to guess (owner decision)`);
  if (idx.status !== 200) infra(`live index.html: HTTP ${idx.status}`);
  const html = idx.data.toString('utf8');
  const { script, style } = parseHtml(html, 'live index.html');
  const root = {};
  for (const n of Object.keys(FROZEN.files)) {
    const r = await fetchBytes(bust(join(baseUrl, n), nonce));
    if (r.status !== 200) fail(`live /${n}: HTTP ${r.status} -- the frozen classic pair must stay published`);
    root[n] = sha256(r.data);
  }
  const vm1 = /^v\/([0-9a-f]{12})\/(.+)$/.exec(script.ref);
  if (recovery && (vm1 ? vm1[1] : 'classic') !== recovery.expectLive) fail(`recovery: the live site is ${vm1 ? 'v/' + vm1[1] + '/' : 'classic'}, the recovery was authorized for ${recovery.expectLive} -- the state changed since the decision (STOP)`);
  if (!vm1) {
    // Still the classic era: the frozen pair must be exactly what old pages load.
    const indexSha = sha256(idx.data);
    if (script.ref.replace(/^\.\//, '') !== 'game.js' || style.ref.replace(/^\.\//, '') !== 'style.css') fail(`live index.html loads ${script.ref} / ${style.ref}: neither the classic layout nor v/<id>/`);
    if (indexSha !== FROZEN.html) fail(`live classic index.html is ${indexSha}, expected ${FROZEN.html} -- the frozen pair may not match what players have cached; the pins need review`);
    for (const [n, pin] of Object.entries(FROZEN.files)) if (root[n] !== pin) fail(`live /${n} is ${root[n]}, expected the frozen ${pin}`);
    return { era: 'classic', anchorId: null, index: indexSha, root, anchorFiles: null, ...(recovery ? { recovery: true, damaged: [] } : {}) };
  }
  for (const [n, pin] of Object.entries(FROZEN.files)) if (root[n] !== pin) fail(`live /${n} is ${root[n]}, expected the frozen ${pin} -- the root pair was overwritten`);
  const anchorId = vm1[1];
  const cm = /^v\/([0-9a-f]{12})\/(.+)$/.exec(style.ref);
  if (!cm || cm[1] !== anchorId) fail(`live index.html: stylesheet ${style.ref} is not in v/${anchorId}/`);
  const anchorFiles = {};
  const damaged = [];
  // K2: only a missing file or a wrong type of the live release is repairable (rebuilt from git, same bytes).
  const damage = (p, msg, status) => {
    if (!recovery || (status !== 200 && status !== 404)) fail(msg);
    damaged.push({ path: p, problem: msg });
  };
  const queue = [vm1[2]];
  const seen = new Set();
  while (queue.length) {
    const p = queue.shift();
    if (seen.has(p)) continue;
    seen.add(p);
    const r = await fetchBytes(bust(join(baseUrl, `v/${anchorId}/${p}`), nonce));
    if (r.status !== 200) { damage(p, `live v/${anchorId}/${p}: HTTP ${r.status} -- the live release is incomplete`, r.status); continue; }
    if (!mimeOk(p, r.type)) damage(p, `live v/${anchorId}/${p}: content-type ${r.type}`, r.status);
    anchorFiles[p] = sha256(r.data);
    if (script.type === 'module') for (const q of moduleRequests(r.data.toString('utf8'), p)) queue.push(resolveLocal(q.specifier, path.posix.dirname(p), `live ${p} import`, '.js', { module: true }));
  }
  const css = await fetchBytes(bust(join(baseUrl, style.ref), nonce));
  if (css.status !== 200) damage(cm[2], `live ${style.ref}: HTTP ${css.status}`, css.status);
  else {
    if (!mimeOk(cm[2], css.type)) damage(cm[2], `live ${style.ref}: content-type ${css.type}`, css.status);
    anchorFiles[cm[2]] = sha256(css.data);
  }
  return { era: 'versioned', anchorId, index: sha256(idx.data), root, anchorFiles, ...(recovery ? { recovery: true, damaged } : {}) };
}
/** After deploying: every file of the artifact is served with its bytes. */
export async function verifyLive(baseUrl, dir, { attempts = 5, delayMs = 20000, log = console.log } = {}) {
  const base = path.resolve(dir);
  const files = [];
  const walk = (abs, rel) => { for (const n of fs.readdirSync(abs).sort()) { const a = path.join(abs, n), r = rel ? rel + '/' + n : n; if (fs.statSync(a).isDirectory()) walk(a, r); else files.push(r); } };
  walk(base, '');
  let last = '';
  for (let i = 1; i <= attempts; i++) {
    const nonce = `${Date.now()}-${i}`;
    const bad = [];
    for (const f of files) {
      const r = await fetchBytes(bust(join(baseUrl, f), nonce));
      const want = sha256(fs.readFileSync(path.join(base, f)));
      if (r.status !== 200) bad.push(`${f}: HTTP ${r.status}`);
      else if (sha256(r.data) !== want) bad.push(`${f}: live ${sha256(r.data).slice(0, 12)} != artifact ${want.slice(0, 12)}`);
      else if (!mimeOk(f, r.type)) bad.push(`${f}: content-type ${r.type}`);
    }
    if (!bad.length) { log(`live matches the artifact: ${files.length} files (attempt ${i})`); return { files: files.length, attempt: i }; }
    last = bad.slice(0, 5).join('; ');
    log(`attempt ${i}/${attempts}: ${bad.length} file(s) differ -- ${last}`);
    if (i < attempts) await new Promise(r => setTimeout(r, delayMs));
  }
  return fail(`live site does not match the artifact after ${attempts} attempts: ${last} -- treat as a failed release (docs/E3_ROLLBACK_PLAN.md §2.3)`);
}

/* ---------------------------------------------------------------- recovery (K2) */
const lc = (s) => String(s || '').toLowerCase();
/** The workflow's first check. A standard run (push, or a dispatch with mode
 *  standard) takes no recovery input at all; a recovery run must be exactly
 *  what the owner authorized for this run. */
export function authorizeRecovery(env) {
  const mode = env.VH_MODE || 'standard';
  const given = ['VH_EXPECT_SHA', 'VH_EXPECT_LIVE', 'VH_REASON'].filter(k => String(env[k] || '').trim());
  if (mode === 'standard') {
    if (given.length) usage(`recovery inputs (${given.join(', ')}) given to a standard run -- refusing: a standard run takes none, a recovery run needs mode "recovery"`);
    return { schema: RECOVERY.schema, mode: 'standard' };
  }
  if (mode !== 'recovery') usage(`mode ${JSON.stringify(mode)} is neither "standard" nor "recovery"`);
  return checkAuthorization({
    schema: RECOVERY.schema, mode: 'recovery',
    sha: String(env.VH_EXPECT_SHA || '').trim(), expectLive: String(env.VH_EXPECT_LIVE || '').trim(), reason: String(env.VH_REASON || '').trim(),
    actor: env.GITHUB_ACTOR || '', repository: env.GITHUB_REPOSITORY || '', runId: env.GITHUB_RUN_ID || '', authorizedAt: new Date().toISOString()
  }, env);
}
/** A recovery record, checked on its own and against the run that uses it
 *  (every step checks again: a file is never trusted for a different run). */
function checkAuthorization(rec, env) {
  if (!rec || typeof rec !== 'object' || rec.schema !== RECOVERY.schema || rec.mode !== 'recovery') fail('recovery: not a recovery authorization');
  if (env.GITHUB_ACTIONS !== 'true') usage('recovery: only a GitHub Actions run can be a recovery run');
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch') fail(`recovery: only a manual workflow_dispatch can recover (this run: ${env.GITHUB_EVENT_NAME || 'unknown'})`);
  if (env.GITHUB_REF !== 'refs/heads/main') fail(`recovery: only main can be recovered (this run: ${env.GITHUB_REF || 'unknown'})`);
  if (env.GITHUB_RUN_ATTEMPT !== '1') fail(`recovery: attempt ${env.GITHUB_RUN_ATTEMPT || 'unknown'} -- a recovery run is never re-run; dispatch a new one (a new decision on the current state)`);
  const owner = lc(env.GITHUB_REPOSITORY_OWNER);
  if (!owner || lc(env.GITHUB_ACTOR) !== owner || lc(env.GITHUB_TRIGGERING_ACTOR) !== owner) fail(`recovery: run by ${env.GITHUB_ACTOR || 'unknown'}, triggered by ${env.GITHUB_TRIGGERING_ACTOR || 'unknown'}, but only the repository owner (${env.GITHUB_REPOSITORY_OWNER || 'unknown'}) may`);
  if (typeof rec.sha !== 'string' || !SHA_RE.test(rec.sha)) usage(`recovery: expected_main_sha ${JSON.stringify(rec.sha)} is not a full 40-hex commit`);
  if (rec.sha !== env.GITHUB_SHA) fail(`recovery: authorized for ${rec.sha.slice(0, 12)}, but this run builds ${String(env.GITHUB_SHA || 'unknown').slice(0, 12)} (main moved?) -- STOP, decide again on the current state`);
  if (rec.expectLive !== 'classic' && !ID_RE.test(String(rec.expectLive))) usage(`recovery: expected_live ${JSON.stringify(rec.expectLive)} must be the live release id (12 hex) or "classic"`);
  if (typeof rec.reason !== 'string' || !RECOVERY.reason.test(rec.reason)) usage('recovery: reason must be 10-200 characters: letters, digits, spaces and . , ; _ ( ) # / + \' -');
  if (lc(rec.actor) !== lc(env.GITHUB_ACTOR) || String(rec.runId) !== String(env.GITHUB_RUN_ID || '') || lc(rec.repository) !== lc(env.GITHUB_REPOSITORY)) fail('recovery: the authorization belongs to another run');
  return rec;
}
function loadRecovery(file, env) {
  let rec;
  try { rec = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { fail(`recovery file ${file}: ${e.message}`); }
  return checkAuthorization(rec, env);
}
/** The save schema a recovery run would publish (N9: never lower than the players' saves). */
function saveSchemaOf(rel) {
  const found = [];
  for (const [p, f] of rel.files) if (p.endsWith('.js')) for (const m of f.data.toString('utf8').matchAll(/\bSAVE_SCHEMA_VERSION\s*=\s*(\d+)\b/g)) found.push({ p, v: Number(m[1]) });
  if (found.length !== 1) fail(`recovery: the release declares SAVE_SCHEMA_VERSION ${found.length} times, expected exactly once -- its save schema cannot be checked (STOP)`);
  if (found[0].v < RECOVERY.minSaveSchema) fail(`recovery: the release has SAVE_SCHEMA_VERSION ${found[0].v} (${found[0].p}), lower than ${RECOVERY.minSaveSchema} -- players' saves would read as from the future (STOP)`);
  return found[0].v;
}

/* ---------------------------------------------------------------- CLI */
function args(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const k = a.slice(2);
    if (['no-live-anchor', 'allow-non-tip', 'no-ledger'].includes(k)) { o[k] = true; continue; }
    if (i + 1 >= argv.length) usage(`--${k} needs a value`);
    o[k] = argv[++i];
  }
  return o;
}
/** --era-epoch (tests): only ever earlier than the default (earlier = more records classified, never fewer). */
function epochArg(o) {
  if (o['era-epoch'] === undefined) return LEDGER.eraEpoch;
  const t = Date.parse(o['era-epoch']);
  if (!Number.isFinite(t) || t > Date.parse(LEDGER.eraEpoch)) usage(`--era-epoch must be a date no later than ${LEDGER.eraEpoch}`);
  return new Date(t).toISOString();
}
function summaryMd(m) {
  const rows = m.releases.map(r => `| \`${r.id}\` | ${r.commitTime ? new Date(r.commitTime * 1000).toISOString().slice(0, 10) : '-'} | ${r.type} | ${r.reasons.join('; ')} |`);
  const rc = m.recovery;
  return [
    ...(rc ? ['## RECOVERY DEPLOYMENT (break-glass, docs/E3_ROLLBACK_PLAN.md §4)', '',
      `Authorized by \`${rc.authorization.actor}\` at ${rc.authorization.authorizedAt} for main \`${rc.authorization.sha}\`, live expected: \`${rc.authorization.expectLive}\`. Reason: ${rc.authorization.reason}`, '',
      `Save schema of this release: ${rc.saveSchema}. Retention, pins, root pair and every check are those of a standard run.`, '',
      `Damaged live files rebuilt from git: ${rc.damaged.length ? rc.damaged.map(d => d.problem).join('; ') : 'none'}`, '',
      `Ledger / live disagreements accepted: ${rc.disagreements.length ? rc.disagreements.join('; ') : 'none'}`, ''] : []),
    '### Release artifact', '', `Current release: \`v/${m.current}/\` · assembled ${m.now} · artifact SHA-256 \`${m.artifactSha256}\``, '',
    `Live before deploy: ${m.liveBefore ? `${m.liveBefore.era}${m.liveBefore.anchorId ? ' `' + m.liveBefore.anchorId + '`' : ''}` : 'not checked'}`, '',
    '| id | commit date | entry | kept because |', '|---|---|---|---|', ...rows, '',
    `Retention: ${m.retentionMode}${m.ledger ? ` · ledger ${m.ledger.source.repository} ${m.ledger.source.environment}, read ${m.ledger.fetchedAt}: ${m.ledger.records} records, statuses of ${m.ledger.statusesRead} read, last publication ${m.ledger.latestPublication ? '`' + m.ledger.latestPublication.sha.slice(0, 12) + '` ' + m.ledger.latestPublication.at : 'none (classic era)'}` : ''}`, '',
    m.ledger && m.ledger.unknown.length ? `Kept as maybe published (statuses beyond GitHub's retention or stale): ${m.ledger.unknown.map(x => '`' + x.sha.slice(0, 12) + '` (deployment ' + x.dep + ')').join(', ')}` : '', '',
    m.excluded.length ? `Not retained (never publishable): ${m.excluded.map(x => '`' + x.id + '` ' + x.reason).join('; ')}` : 'Not retained: none', '',
    '```', ...m.files.map(f => `${f.sha256}  ${f.path}`), '```', ''
  ].join('\n');
}
export async function main(argv = process.argv.slice(2)) {
  const o = args(argv);
  const cmd = o._[0];
  if (cmd === 'assemble') {
    if (!o.out) usage('--out DIR is required');
    if (!o['live-json'] && !o['no-live-anchor']) usage('--live-json FILE (from precheck-live) or --no-live-anchor is required');
    const live = o['live-json'] ? JSON.parse(fs.readFileSync(o['live-json'], 'utf8')) : null;
    const nowMs = o.now ? Date.parse(o.now) : Date.now();
    if (!Number.isFinite(nowMs)) usage('--now must be an ISO date');
    const eraEpoch = epochArg(o);
    const recovery = o.recovery ? loadRecovery(o.recovery, process.env) : null;
    let m;
    const source = o.source || 'git';
    // L1: git/fixture assemblies take the deployment ledger; going without it is explicit and never in CI.
    if (source !== 'worktree' && !!o.ledger === !!o['no-ledger']) usage('exactly one of --ledger FILE (from `ledger`) or --no-ledger is required');
    if (o['no-ledger'] && process.env.GITHUB_ACTIONS === 'true') usage('--no-ledger is refused under GitHub Actions: a publication always reads the deployment ledger (never the git-only rule)');
    let ledger = null;
    if (o.ledger) {
      let raw;
      try { raw = JSON.parse(fs.readFileSync(o.ledger, 'utf8')); } catch (e) { fail(`ledger file ${o.ledger}: ${e.message}`); }
      ledger = checkLedger(raw, { nowMs, repository: o.repository || null, eraEpoch });
    }
    if (source === 'worktree') {
      if (!o['frozen-dir'] || !o.id) usage('--source worktree needs --id and --frozen-dir');
      if (!ID_RE.test(o.id) && !TEST_ID_RE.test(o.id)) usage('--id: 12 hex or a short lowercase test id');
      if (live) usage('--source worktree has no history to rebuild a live release from: use --no-live-anchor');
      const frozenTree = fsTree(o['frozen-dir'], 'frozen-dir');
      m = assemble({ history: { frozen: () => frozenTree }, current: o.id, id: o.id, out: o.out, live, nowMs, worktree: fsTree(o.repo || '.', 'worktree'), recovery });
    } else {
      const history = source === 'git' ? gitHistory(path.resolve(o.repo || '.')) : source === 'fixture' ? fixtureHistory(o.fixture) : usage(`unknown --source ${source}`);
      const current = o.rev || (source === 'fixture' ? history.tip : usage('--rev SHA is required with --source git'));
      if (!/^[0-9a-f]{40}$/.test(current)) usage('--rev must be a full 40-hex commit');
      m = assemble({ history, current, id: current.slice(0, 12), out: o.out, live, nowMs, ledger, eraEpoch, allowNonTip: !!o['allow-non-tip'], recovery });
    }
    if (o['manifest-out']) fs.writeFileSync(o['manifest-out'], JSON.stringify(m, null, 2) + '\n');
    if (o.summary) fs.appendFileSync(o.summary, summaryMd(m));
    m.warnings.forEach(w => console.log(`${process.env.GITHUB_ACTIONS ? '::warning::' : 'WARNING '}${w}`));
    if (m.recovery) console.log(`${process.env.GITHUB_ACTIONS ? '::warning title=RECOVERY DEPLOYMENT::' : 'RECOVERY '}break-glass assembly for ${m.recovery.authorization.sha.slice(0, 12)}: ${m.recovery.damaged.length} damaged live file(s) rebuilt, ${m.recovery.disagreements.length} ledger/live disagreement(s) accepted -- see the step summary`);
    console.log(`assembled v/${m.current}/ + ${m.releases.length - 1} retained release(s), ${m.files.length} files, artifact ${m.artifactSha256}`);
    return 0;
  }
  if (cmd === 'ledger') {
    if (!o.out || !o['api-url'] || !o.repository) usage('ledger --out FILE --api-url URL --repository OWNER/REPO --source git|fixture');
    const source = o.source || 'git';
    const history = source === 'git' ? gitHistory(path.resolve(o.repo || '.')) : source === 'fixture' ? fixtureHistory(o.fixture) : usage(`unknown --source ${source}`);
    const nowMs = o.now ? Date.parse(o.now) : Date.now();
    if (!Number.isFinite(nowMs)) usage('--now must be an ISO date');
    const num = (k, d) => { if (o[k] === undefined) return d; const n = Number(o[k]); if (!Number.isSafeInteger(n) || n < 1) usage(`--${k} must be a positive integer`); return n; };
    const repositoryId = o['repository-id'] !== undefined ? o['repository-id'] : (process.env.GITHUB_REPOSITORY_ID || null);
    const l = await readLedger({ apiUrl: o['api-url'], repository: o.repository, repositoryId, token: process.env.GITHUB_TOKEN || '', history, nowMs, eraEpoch: epochArg(o), perPage: num('per-page', LEDGER.perPage), timeoutMs: num('timeout-ms', LEDGER.timeoutMs), maxRequests: num('max-requests', LEDGER.maxRequests) });
    fs.writeFileSync(o.out, JSON.stringify(l, null, 2) + '\n');
    console.log(`ledger: ${l.listing.count} ${LEDGER.environment} deployment records (${l.listing.pages} page(s)), statuses of ${l.statusesFetched} read, ${l.requests} GET requests`);
    return 0;
  }
  if (cmd === 'precheck-live') {
    if (!o.url || !o['out-json']) usage('precheck-live --url BASE --out-json FILE');
    const recovery = o.recovery ? loadRecovery(o.recovery, process.env) : null;
    const r = await precheckLive(o.url, { recovery });
    fs.writeFileSync(o['out-json'], JSON.stringify(r, null, 2) + '\n');
    console.log(`live site: ${r.era}${r.anchorId ? ' v/' + r.anchorId + '/' : ''}, root pair = frozen pins`);
    if (r.recovery) r.damaged.forEach(d => console.log(`${process.env.GITHUB_ACTIONS ? '::warning title=RECOVERY::' : 'RECOVERY '}damaged live file, to be rebuilt from git: ${d.problem}`));
    return 0;
  }
  if (cmd === 'authorize-recovery') {
    if (!o.out) usage('authorize-recovery --out FILE');
    const r = authorizeRecovery(process.env);
    fs.writeFileSync(o.out, JSON.stringify(r, null, 2) + '\n');
    if (r.mode === 'recovery') console.log(`${process.env.GITHUB_ACTIONS ? '::warning title=RECOVERY RUN::' : 'RECOVERY '}break-glass run authorized for ${r.actor}: main ${r.sha}, live ${r.expectLive} -- ${r.reason}`);
    else console.log('standard run (no recovery)');
    return 0;
  }
  if (cmd === 'verify-live') {
    if (!o.url || !o.release) usage('verify-live --url BASE --release DIR');
    await verifyLive(o.url, o.release, { attempts: Number(o.attempts || 5), delayMs: Number(o['delay-ms'] || 20000) });
    return 0;
  }
  if (cmd === 'verify') {
    if (!o.release) usage('verify --release DIR');
    const manifest = o.manifest ? JSON.parse(fs.readFileSync(o.manifest, 'utf8')) : null;
    const r = verifyRelease(o.release, { id: o.id || null, manifest });
    console.log(`release OK: ${r.files} files, ${r.bytes} bytes, current v/${r.current}/, versions ${r.versions.join(' ')}`);
    return 0;
  }
  usage('command: ledger | assemble | precheck-live | verify-live | verify | authorize-recovery');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (e) {
    const kind = e instanceof ReleaseError ? e.kind : 'release';
    const label = { release: 'RELEASE CHECK FAILED (STOP)', infra: 'INFRASTRUCTURE FAILURE (STOP, not a game failure)', usage: 'USAGE', superseded: 'SUPERSEDED (nothing to deploy)' }[kind];
    console.error(`${process.env.GITHUB_ACTIONS && kind !== 'superseded' ? '::error::' : ''}${label}: ${e.message}`);
    if (!(e instanceof ReleaseError)) console.error(e.stack);
    process.exitCode = EXIT[kind] || 1;
  }
}
