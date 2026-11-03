// CRAZYGAMES-BASIC-1: builds the HTML5 package for the CrazyGames Developer Portal
// from the current sources (one game, one source: index.html + what it references).
// It writes only under --out and never touches the GitHub Pages release (E3/L1).
//   node tools/export-crazygames-basic.mjs [--out=DIR]   default qa/out/crazygames-basic
// Result: DIR/game/ (index.html, game.js, style.css), DIR/game.zip, DIR/BUILD_INFO.json.
// Same sources = same bytes: line endings are normalised to LF (git's form) and the
// ZIP has fixed timestamps and order. Exit code 1 if a check fails; no file is left
// half-written under game/ because the folder is rebuilt from scratch on every run.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DISTRIBUTION = 'crazygames-basic';
// docs.crazygames.com/requirements/technical/ (read 2026-11-03), Basic Implementation
// without the SDK: the total file size is the initial download.
export const LIMITS = { files: 1500, bytes: 50 * 1024 * 1024, mobileHomepageBytes: 20 * 1024 * 1024 };
const TITLE = 'GLITCH GULP';
const DESCRIPTION = 'Steer a vortex through a neon city and swallow everything smaller. 2-minute Arena rounds against bots and a 240-mission Campaign.';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const lf = (text) => text.replace(/\r\n/g, '\n');
const localRef = (ref) => !/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(ref);

/** The package's page: the source index.html minus what points at the GitHub Pages
 *  site (structured data, social cards, SEO tags), plus the distribution marker. */
export function packagePage(html) {
  let out = lf(html);
  const drop = [
    /<meta name="(?:keywords|robots|application-name|apple-mobile-web-app-title|apple-mobile-web-app-capable|mobile-web-app-capable|apple-mobile-web-app-status-bar-style|format-detection)"[^>]*>\n?/g,
    /<meta name="twitter:[^>]*>\n?/g,
    /<meta property="og:[^>]*>\n?/g,
    /<link rel="canonical"[^>]*>\n?/g,
    /<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g
  ];
  for (const re of drop) out = out.replace(re, '');
  const once = (re, to, what) => {
    if (!re.test(out)) throw new Error(`index.html: ${what} not found`);
    out = out.replace(re, to);
  };
  once(/<title>[^<]*<\/title>/, `<title>${TITLE}</title>`, '<title>');
  once(/<meta name="description"[^>]*>/, `<meta name="description" content="${DESCRIPTION}">`, 'meta description');
  once(/<html\b([^>]*)>/, `<html$1 data-distribution="${DISTRIBUTION}">`, '<html>');
  return out;
}

/** Every local file the page needs: <script src>, stylesheets, static relative
 *  imports of the modules and url() of the stylesheets (data: URIs need nothing). */
export function collectRuntime(root, html) {
  const files = new Map(), missing = [], external = [];
  const add = (rel, kind) => {
    const norm = path.posix.normalize(rel.split(/[?#]/)[0]).replace(/^\.\//, '');
    if (files.has(norm)) return;
    if (norm.startsWith('..')) { external.push(rel); return; }
    const abs = path.join(root, norm);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) { missing.push(norm); return; }
    const text = lf(fs.readFileSync(abs, 'utf8'));
    files.set(norm, text);
    const dir = path.posix.dirname(norm);
    if (kind === 'js') {
      const re = /(?:^|[\n;])\s*(?:import\s*(?:[\w*{}\s,$]+\s*from\s*)?|export\s*[\w*{}\s,$]+\s*from\s*)['"]([^'"]+)['"]/g;
      for (const m of text.matchAll(re)) (localRef(m[1]) ? add(path.posix.join(dir, m[1]), 'js') : external.push(m[1]));
    } else if (kind === 'css') {
      for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
        if (/^(?:data:|#)/.test(m[1])) continue;
        if (localRef(m[1])) add(path.posix.join(dir, m[1]), 'asset'); else external.push(m[1]);
      }
    }
  };
  for (const m of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)) (localRef(m[1]) ? add(m[1], 'js') : external.push(m[1]));
  for (const m of html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*>/g)) {
    const href = (/\bhref="([^"]+)"/.exec(m[0]) || [])[1];
    if (href) (localRef(href) ? add(href, 'css') : external.push(href));
  }
  return { files, missing, external };
}

/** A reproducible ZIP (no dependency, no tool): sorted names, fixed date, deflate. */
export function makeZip(entries) {
  const dosTime = 0, dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1; // 2026-01-01 00:00
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, data] of [...entries].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const nameBuf = Buffer.from(name, 'utf8');
    const body = zlib.deflateRawSync(data, { level: 9 });
    const crc = zlib.crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8);
    head.writeUInt16LE(dosTime, 10); head.writeUInt16LE(dosDate, 12); head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(body.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(nameBuf.length, 26);
    locals.push(head, nameBuf, body);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(dosTime, 12); cen.writeUInt16LE(dosDate, 14); cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(body.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    centrals.push(cen, nameBuf);
    offset += head.length + nameBuf.length + body.length;
  }
  const central = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.size, 8); end.writeUInt16LE(entries.size, 10);
  end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}

export function exportPackage({ root = ROOT, out = path.join(ROOT, 'qa', 'out', 'crazygames-basic') } = {}) {
  const page = packagePage(fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  const { files, missing, external } = collectRuntime(root, page);
  const problems = [];
  if (missing.length) problems.push('missing files: ' + missing.join(', '));
  if (external.length) problems.push('external or non-relative references: ' + external.join(', '));
  // Absolute paths fail on the portal; a root-relative src/href would also miss the check above.
  const rooted = [...page.matchAll(/\b(?:src|href)="(\/[^"]*|https?:[^"]*)"/g)].map(m => m[1]);
  if (rooted.length) problems.push('absolute paths in the page: ' + rooted.join(', '));
  if (/github\.io/.test(page)) problems.push('the page still names the GitHub Pages site');
  const entries = new Map([['index.html', Buffer.from(page, 'utf8')], ...[...files].map(([k, v]) => [k, Buffer.from(v, 'utf8')])]);
  const bytes = [...entries.values()].reduce((a, b) => a + b.length, 0);
  if (entries.size > LIMITS.files) problems.push(`${entries.size} files > ${LIMITS.files}`);
  if (bytes > LIMITS.bytes) problems.push(`${bytes} bytes > ${LIMITS.bytes}`);
  if (problems.length) throw new Error('export refused:\n  ' + problems.join('\n  '));

  const gameDir = path.join(out, 'game');
  fs.rmSync(gameDir, { recursive: true, force: true });
  for (const [name, data] of entries) {
    fs.mkdirSync(path.dirname(path.join(gameDir, name)), { recursive: true });
    fs.writeFileSync(path.join(gameDir, name), data);
  }
  const zip = makeZip(entries);
  fs.writeFileSync(path.join(out, 'game.zip'), zip);
  let head = 'unknown', dirty = null;
  try {
    head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0;
  } catch (e) { /* not a checkout */ }
  const info = {
    distribution: DISTRIBUTION, sourceHead: head, sourceDirty: dirty,
    files: Object.fromEntries([...entries].map(([k, v]) => [k, { bytes: v.length, sha256: sha256(v) }])),
    fileCount: entries.size, totalBytes: bytes, zip: { bytes: zip.length, sha256: sha256(zip) },
    limits: LIMITS, withinMobileHomepageLimit: bytes <= LIMITS.mobileHomepageBytes
  };
  fs.writeFileSync(path.join(out, 'BUILD_INFO.json'), JSON.stringify(info, null, 2) + '\n');
  return { out, gameDir, ...info };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (isMain) {
  const a = process.argv.find(x => x.startsWith('--out='));
  try {
    const r = exportPackage(a ? { out: path.resolve(a.slice(6)) } : {});
    fs.mkdirSync(r.out, { recursive: true });
    console.log(`package: ${r.gameDir}\nfiles: ${r.fileCount} (limit ${LIMITS.files}) · total ${(r.totalBytes / 1048576).toFixed(2)} MB (limit 50 MB, mobile homepage 20 MB) · zip ${(r.zip.bytes / 1048576).toFixed(2)} MB\nzip sha256: ${r.zip.sha256}\nsource: ${r.sourceHead}${r.sourceDirty ? ' + uncommitted changes' : ''}`);
  } catch (e) { console.error(e.message); process.exit(1); }
}
