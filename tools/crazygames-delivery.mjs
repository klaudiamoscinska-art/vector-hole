// CRAZYGAMES-BASIC-1: fills the owner's delivery folder (outside the repo) around the
// covers and videos already in it: the package, the texts, the report, control frames,
// a preview page and manifest.sha256. Covers come from tools/crazygames-covers.mjs and
// videos from tools/crazygames-video.mjs.
//   node tools/crazygames-delivery.mjs --out=DIR --ffmpeg=EXE [--logs=DIR]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ROOT, exportPackage } from './export-crazygames-basic.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const out = path.resolve(arg('out', ''));
const ffmpeg = arg('ffmpeg', null);
const logs = arg('logs', null);
if (!arg('out', null)) { console.error('--out=DIR is required'); process.exit(1); }

const COVERS = ['landscape-1920x1080.png', 'portrait-800x1200.png', 'square-800x800.png'];
const VIDEOS = ['preview-landscape-1920x1080.mp4', 'preview-portrait-1080x1620.mp4'];
const lacking = [...COVERS.map(f => `covers/${f}`), ...VIDEOS.map(f => `videos/${f}`)].filter(f => !fs.existsSync(path.join(out, f)));
if (lacking.length) { console.error('missing: ' + lacking.join(', ')); process.exit(1); }

const pkg = exportPackage({ out });
const copy = (from, to) => { fs.mkdirSync(path.dirname(path.join(out, to)), { recursive: true }); fs.copyFileSync(from, path.join(out, to)); };
copy(path.join(ROOT, 'docs/crazygames/CRAZYGAMES_SUBMISSION_TEXTS.md'), 'submission/CRAZYGAMES_SUBMISSION_TEXTS.md');
copy(path.join(ROOT, 'docs/crazygames/PRIVACY_POLICY_DRAFT.md'), 'submission/PRIVACY_POLICY_DRAFT.md');
copy(path.join(ROOT, 'docs/CRAZYGAMES_BASIC1_REPORT.md'), 'reports/CRAZYGAMES_BASIC1_REPORT.md');
if (logs && fs.existsSync(logs)) for (const f of fs.readdirSync(logs)) if (/\.(log|json)$/.test(f)) copy(path.join(logs, f), `reports/logs/${f}`);

// Control frames: the cover at the start, then one from each section of the round.
const frames = [];
if (ffmpeg) {
  fs.mkdirSync(path.join(out, 'previews'), { recursive: true });
  for (const v of VIDEOS) for (const t of [0.2, 5, 10, 14, 18.5]) {
    const name = `${v.replace('.mp4', '')}-${t}s.jpg`;
    execFileSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-ss', String(t), '-i', path.join(out, 'videos', v), '-frames:v', '1', '-q:v', '3', path.join(out, 'previews', name)]);
    frames.push(`previews/${name}`);
  }
}
const coverTags = COVERS.map(f => `<figure><img src="../covers/${f}" alt="${f}"><figcaption>${f}</figcaption></figure>`).join('');
const altTags = COVERS.filter(f => fs.existsSync(path.join(out, 'covers/alt-title-vertical-hole', f))).map(f => `<figure><img src="../covers/alt-title-vertical-hole/${f}" alt="${f}"><figcaption>${f}</figcaption></figure>`).join('');
const videoTags = VIDEOS.map(f => `<figure><video src="../videos/${f}" controls muted loop playsinline></video><figcaption>${f}</figcaption></figure>`).join('');
const frameTags = frames.map(f => `<figure><img src="../${f}" alt="" loading="lazy"><figcaption>${path.basename(f)}</figcaption></figure>`).join('');
fs.mkdirSync(path.join(out, 'previews'), { recursive: true });
fs.writeFileSync(path.join(out, 'previews/index.html'), `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vector Hole: materiały CrazyGames</title>
<style>body{margin:0;padding:24px;background:#04101D;color:#e6faff;font:16px/1.5 system-ui,sans-serif}h1,h2{font-weight:600}section{margin:0 0 40px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}figure{margin:0}img,video{width:100%;display:block;border-radius:8px;background:#000}figcaption{font-size:13px;opacity:.75;margin-top:6px;overflow-wrap:anywhere}a{color:#68F5FC}</style></head><body>
<h1>Vector Hole: materiały do zatwierdzenia</h1>
<section><h2>Okładki</h2><div class="g">${coverTags}</div></section>
${altTags ? `<section><h2>Okładki z tytułem „Vertical Hole” (wariant na wypadek innej decyzji o nazwie)</h2><div class="g">${altTags}</div></section>` : ''}
<section><h2>Filmy</h2><div class="g">${videoTags}</div></section>
<section><h2>Klatki kontrolne</h2><div class="g">${frameTags}</div></section>
<p><a href="../game/index.html">Paczka gry</a> wymaga serwera HTTP (moduły ES nie działają z file://); instrukcja w README.md.</p>
</body></html>
`);

fs.writeFileSync(path.join(out, 'README.md'), `# CrazyGames Basic: paczka dostawcza Vector Hole

Źródło: \`${pkg.sourceHead}\`${pkg.sourceDirty ? ' + niezatwierdzone zmiany' : ''}.
Pliki: ${pkg.fileCount}, ${(pkg.totalBytes / 1048576).toFixed(2)} MB; ZIP ${(pkg.zip.bytes / 1048576).toFixed(2)} MB.

| Co | Gdzie |
|---|---|
| Podgląd okładek i filmów | \`previews/index.html\` (dwuklik, otwiera się w przeglądarce) |
| Paczka do wgrania | \`game.zip\` albo folder \`game/\` |
| Okładki | \`covers/\` (wariant nazwy: \`covers/alt-title-vertical-hole/\`) |
| Filmy | \`videos/\` |
| Teksty formularza i polityka prywatności | \`submission/\` |
| Raport i logi | \`reports/\` |
| Sumy kontrolne | \`manifest.sha256\` |

## Uruchomienie paczki w Windows

W PowerShell, w tym folderze:

\`\`\`powershell
python -m http.server 8000 --directory game
\`\`\`

Następnie otwórz http://localhost:8000/ w Chrome lub Edge. Dwuklik \`game/index.html\` nie zadziała,
bo przeglądarka nie ładuje modułów ES z \`file://\`.

## Następny krok

Instrukcja formularza: \`submission/CRAZYGAMES_SUBMISSION_TEXTS.md\`. Nic nie zostało wysłane do CrazyGames.
`);

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
const files = walk(out).filter(f => path.basename(f) !== 'manifest.sha256').map(f => path.relative(out, f).replace(/\\/g, '/')).sort();
fs.writeFileSync(path.join(out, 'manifest.sha256'), files.map(f => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(out, f))).digest('hex')}  ${f}`).join('\n') + '\n');
console.log(`delivery: ${out}\n${files.length} files in manifest.sha256\ngame.zip sha256 ${pkg.zip.sha256}\nsource ${pkg.sourceHead}${pkg.sourceDirty ? ' + uncommitted changes' : ''}`);
