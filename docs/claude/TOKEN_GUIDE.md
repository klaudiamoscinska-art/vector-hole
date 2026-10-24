# Token hygiene for Claude Code sessions (OPT-2, 2026-10-24)

Goal: spend tokens on the task, not on re-reading context. None of this
relaxes a rule in `CLAUDE.md` — every mandatory contract is still read when
its area is touched.

## What every session pays up front

| Loaded automatically | Size (2026-10-24) |
|---|---|
| `CLAUDE.md` (only when Claude Code starts **in the repo folder**) | ~16 KB (was 43.9 KB before OPT-2) |
| Skill descriptions of the 22 `vh-*` skills (frontmatter only) | ~6.7 KB |
| Owner's memory index | < 1 KB |

Everything else — `docs/claude/*`, `docs/GAME_DESIGN.md`, `.claude/vertical-hole/*`,
the full `SKILL.md` bodies (3.7–6.8 KB each) — costs tokens only when read.

## Rules of thumb

1. **Start in the repo folder** (`Desktop\Repo\vector-hole`). Started from the
   home folder, `CLAUDE.md` is not loaded and gets read by hand later (same
   cost, later, often twice).
2. **Read by section, not whole files.** `game.js` is ~985 KB: find the
   function with a search, then read ~100–200 lines around it. Never read
   `game.js`, `style.css` or `index.html` in full.
3. **One read per file per task.** Note what you learned in the working
   notes / HANDOFF instead of re-reading.
4. **Skills only when they fit.** Load at most the 1–3 skills a task needs
   (e.g. `vh-qa-automation` for QA, `vh-save-security` for saves,
   `vh-release-manager` for a PR). The pack's own rule: never run all 22.
5. **QA logs stay in files.** Run suites with output redirected to a log;
   read the summary (`N/M checks passed` + `FAIL` lines) — never paste a
   full run (a full `run-all` log is ~100–200 KB).
6. **Wide searches → a search subagent** (Explore) that returns only the
   conclusion, when a question needs many files.
7. **HANDOFFs replace history.** A new session starts from the last HANDOFF
   (`docs/claude/HANDOFF_TEMPLATE.md`), not from re-analysing old reports,
   CHANGELOG or evidence folders.
8. **Prompts can be short.** The standing rules (Polish, production `main`
   protection, preflight, evidence, HANDOFFs, GPT review before a merge)
   are in `CLAUDE.md` — a task prompt only needs the goal, scope, STOP
   conditions and anything that differs from the standing rules.

## Model choice (recommendation; the owner picks the model)

| Work | Model tier |
|---|---|
| Runtime game logic, save/migration, release/workflow, security, hard debugging, final review before a PR | most capable (Opus) |
| Running QA and reading results, small test fixes, docs/CHANGELOG updates, report drafting, packaging | mid tier (Sonnet) |
| Summarising long logs, mechanical edits, manifests/checksums, file inventories | fastest (Haiku) |

Switch with `/model` in Claude Code. A cheaper model still follows
`CLAUDE.md`; if it hits a save, release or economy question, hand the step
back to the most capable model rather than guessing.
