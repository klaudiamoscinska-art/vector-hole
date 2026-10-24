// OPT-2: the Claude instructions stay complete after they were shortened.
// No browser. Checks that CLAUDE.md (loaded into every session) still states
// every non-negotiable rule or points to the file that does, that every file
// it and docs/claude/* reference exists, and that it stays within budget.
// Usage: node qa/instructions.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, report, isMain } from './lib.mjs';

const BUDGET = 20000; // bytes; CLAUDE.md was 43.9 KB before OPT-2

/** [name, regex that must match CLAUDE.md] -- one per non-negotiable rule. */
export const REQUIRED_RULES = [
  ['Polish for replies, reports and HANDOFFs', /\*\*Polish\*\* for every reply, report and HANDOFF/],
  ['production main protected: no push/commit, no merge, no deploy', /Never commit or push to production `main`, never merge a PR, never run a production deployment/],
  ['production merge only after GPT review + owner approval', /only after GPT's independent review and the owner's explicit approval/],
  ['staging push needs owner approval', /Staging .* needs the owner's approval/],
  ['preflight before work', /\*\*Preflight before work:\*\*/],
  ['no destructive git, no blind git add -A', /No destructive git .*no `git add -A` without checking/],
  ['no publishing/spending/destructive ops/global settings without consent', /Don't publish, sign agreements, spend money, perform destructive operations, or change global Claude settings/],
  ['evidence: NOT RUN never PASS, base comparison, no hidden regressions', /executed nothing is `NOT RUN`, never `PASS`.*base commit on the same machine.*never hide a new regression/],
  ['HANDOFFs + template', /HANDOFFs when asked — `docs\/claude\/HANDOFF_TEMPLATE\.md`/],
  ['SAVE key + schema 13 + migration contract', /`vectorHoleSave_v1` never changes; `SAVE_SCHEMA_VERSION` stays \*\*13\*\*.*SAVE_MIGRATION_CONTRACT\.md/],
  ['saveGame only write path, PX01 guard, PX02 refund', /`saveGame\(\)` is the only write path.*PX01 guard.*PX02 D\+ one-time refund/],
  ['save suites named', /qa\/save-safety\.mjs.*qa\/px02-isolation\.mjs/],
  ['Arena/campaign independence + own-mode gates', /\*\*Arena ↔ campaign independence:\*\*.*every unlock gate reads only its own mode/],
  ['Core City only from finalizeRun; R1: a round left early pays partial coins/XP only, at score 0 nothing', /Core City is filled only by `finalizeRun\(\)`.*left early pays only partial coins and XP.*`payLeftRun\(\)`.*score 0 nothing \(`abandonRun\(\)`\); Core City, bonuses, prisms and the run count .* come only from a finished round/],
  ['no Arena advantage for sale (PX02 D+)', /\*\*No Arena advantage for sale \(PX02 D\+\):\*\*/],
  ['no energy / no play limit', /never reintroduce energy, a timer or a cost/],
  ['economy changes only with the owner', /\*\*Economy:\*\* prices, rewards, booster balance and the growth curve change only with the owner/],
  ['mission calibration rule', /qa\/calibrate\.mjs 10 4.*MISSION_BOT_TIME.*qa\/difficulty\.mjs/],
  ['seeded RNG / ranking / escapeHtml', /SeededRNG.*rankHoles\(\).*escapeHtml\(\)/],
  ['i18n + gender-neutral copy', /I18N_EN.*gender-neutral/],
  ['dev code never committed', /\*\*never commit the dev code\*\*/],
  ['zero dependencies / staged ES-module refactor', /zero dependencies.*static relative imports only/],
  ['deploy from main only, release folder only', /deploys GitHub Pages \*\*from `main` only\*\*.*never the repo root/],
  ['URL never changes meaning (root pair, v/ ids, index.html)', /\*\*A URL never changes meaning:\*\* never edit or remove the root pair, never reuse a `v\/` id/],
  ['rollback = forward commit, never revert PR #76, E3 plan', /\*\*Rollback = a forward commit.*never revert PR #76.*docs\/E3_ROLLBACK_PLAN\.md/],
  ['break-glass recovery owner-only (K2)', /Break-glass \(K2\) `mode: recovery` is owner-only/],
  ['L1 retention by the deployment ledger', /retained by the deployment ledger \(L1\)/],
  ['P00 gate + GO_CORE/GO_TOOLS/GO_RELEASE', /\*\*Gate before development \(P00\):\*\*.*`GO_CORE`.*`GO_TOOLS`.*`GO_RELEASE`/],
  ['evidence freshness', /EVIDENCE_FRESHNESS\.md/],
  ['charter / workflow / quality gates / change safety', /PROJECT_CHARTER\.md.*WORKFLOW\.md.*QUALITY_GATES\.md.*CHANGE_SAFETY\.md/],
  ['preflight gates + Arena/district contract', /PREFLIGHT_GATES\.md.*ARENA_DISTRICT_CONTRACT\.md/],
  ['skills on demand, never all', /never all by routine/],
  ['packs updated only from official ZIPs', /Update the packs only from their official ZIPs/],
  ['precedence: CLAUDE.md wins + known conflicts', /\*\*Precedence:\*\*.*this file wins/],
  ['GAME_DESIGN.md read before gameplay changes', /`docs\/GAME_DESIGN\.md` — read it before changing gameplay/],
  ['on-demand references named', /docs\/claude\/ARCHITECTURE\.md.*docs\/claude\/DEPLOYMENT\.md.*docs\/claude\/SKILLS_PACK\.md.*docs\/claude\/TOKEN_GUIDE\.md/]
];

const PATH_RE = /`((?:\.claude|\.github|docs|qa|design)\/[^`\s*]+?|CLAUDE\.md|VH_PREFLIGHT_REPORT\.md|index\.html|style\.css|game\.js)`/g;
/** Repo paths named in backticks (wildcards/placeholders skipped). */
export function referencedPaths(text) {
  return [...new Set([...text.matchAll(PATH_RE)].map(m => m[1].replace(/[),.:;]+$/, '')).filter(p => !/[<>{}]|\.\.\.|…/.test(p)))];
}

export function runInstructionChecks() {
  const results = [];
  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
  const claude = read('CLAUDE.md');
  const flat = claude.replace(/\n(?!\n)/g, ' ');
  const missing = REQUIRED_RULES.filter(([, re]) => !re.test(flat)).map(([n]) => n);
  results.push(report(`instructions: CLAUDE.md states all ${REQUIRED_RULES.length} non-negotiable rules (or points to their contract)`, missing.length === 0, missing.length ? 'missing: ' + missing.join('; ') : ''));
  const size = Buffer.byteLength(fs.readFileSync(path.join(ROOT, 'CLAUDE.md')));
  results.push(report(`instructions: CLAUDE.md within the ${BUDGET}-byte budget`, size <= BUDGET, `${size} bytes`));
  const docs = ['CLAUDE.md', ...fs.readdirSync(path.join(ROOT, 'docs/claude')).map(f => 'docs/claude/' + f)];
  const dangling = [];
  let checked = 0;
  for (const d of docs) {
    for (const p of referencedPaths(read(d))) {
      checked++;
      const bare = p.replace(/^(PROJECT_CHARTER|WORKFLOW|QUALITY_GATES|CHANGE_SAFETY)\.md$/, '.claude/vertical-hole/$&');
      if (!fs.existsSync(path.join(ROOT, bare))) dangling.push(`${d}: ${p}`);
    }
  }
  results.push(report('instructions: every repo path CLAUDE.md and docs/claude/* name exists', dangling.length === 0 && checked > 20, dangling.length ? dangling.join(' | ') : `${checked} references`));
  return results;
}

if (isMain(import.meta.url)) {
  const res = runInstructionChecks();
  const failed = res.filter(r => !r.ok);
  console.log(`\n${res.length - failed.length}/${res.length} instruction checks passed`);
  process.exit(failed.length ? 1 : 0);
}
