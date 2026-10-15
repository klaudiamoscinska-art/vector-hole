// v23 dev panel: prints the hash to paste into game.js's DEV_CODE_HASH for a
// new dev code (the code itself never goes into the repo).
//   node qa/dev-code.mjs "my-new-code"
// Same algorithm as devCodeHash() in game.js: DEV_CODE_ROUNDS rounds of
// SHA-256 over DEV_CODE_SALT + the previous value, starting from the
// trimmed, lower-cased code.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'game.js'), 'utf8');
const SALT = /const DEV_CODE_SALT = '([^']*)'/.exec(src)[1];
const ROUNDS = Number(/const DEV_CODE_ROUNDS = (\d+)/.exec(src)[1]);

export function devCodeHash(code) {
  let h = SALT + String(code || '').trim().toLowerCase();
  for (let i = 0; i < ROUNDS; i++) h = crypto.createHash('sha256').update(SALT + h, 'utf8').digest('hex');
  return h;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const code = process.argv[2];
  if (!code) { console.error('usage: node qa/dev-code.mjs "<code>"'); process.exit(1); }
  console.log(devCodeHash(code));
}
