# Token hygiene for Claude Code sessions (OPT-2, 2026-10-24; DOCS-1, 2026-10-29)

Goal: spend tokens on the task, not on re-reading context. None of this
relaxes a rule in `CLAUDE.md` — every mandatory contract is still read when
its area is touched.

## What every session pays up front

| Loaded automatically | Size (measured 2026-10-29, `wc -c`) |
|---|---|
| `CLAUDE.md` (only when Claude Code starts **in the repo folder**) | ~15 KB (43.9 KB before OPT-2; `qa/instructions.mjs` caps it at 20 KB) |
| Skill descriptions of the 22 `vh-*` skills (frontmatter only) | ~6.7 KB |
| Owner's memory index | < 1 KB |

Everything else costs tokens only when read. Typical on-demand sizes:
`docs/GAME_DESIGN.md` ~50 KB, `docs/claude/ARCHITECTURE.md` ~35 KB,
`qa/README.md` ~33 KB, a `SKILL.md` body 3.7–6.8 KB, a skill's entry contract
(six shared references in `.claude/vertical-hole/`) ~32 KB together.

## Rules of thumb

1. **Start in the repo folder** (`Desktop\Repo\vector-hole`). Started from the
   home folder, `CLAUDE.md` is not loaded and gets read by hand later (same
   cost, later, often twice).
2. **Read by section, not whole files.** `game.js` is ~1.07 MB: find the
   function with a search, then read ~100–200 lines around it. Never read
   `game.js`, `style.css` or `index.html` in full; for the big docs read the
   heading list first (`grep -n "^#"`), then the section.
3. **One read per file per task.** Note what you learned in the working
   notes / HANDOFF instead of re-reading.
4. **Skills only when they fit.** Load at most the 1–3 skills a task needs
   (table in `docs/claude/SKILLS_PACK.md` "Choosing skills"); their shared
   entry contract is read once per session and only for code/save work. The
   pack's own rule: never run all 22.
5. **QA logs stay in files.** Run suites with output redirected to a log;
   read the summary (`N/M checks passed` + `FAIL` lines) — never paste a
   full run (a full `run-all` log is ~100–200 KB).
6. **Match the checks to the change.** Docs/instructions only → the doc checks
   in `docs/claude/SKILLS_PACK.md` "P00 inside a stage", no game QA. Code →
   the affected suites first, `run-all` once on base and candidate; reuse the
   stage's own runs as the P00 gate table instead of a second full run.
7. **Wide searches → a search subagent** (Explore) that returns only the
   conclusion, when a question needs many files.
8. **HANDOFFs replace history.** A new session starts from the last HANDOFF
   (`docs/claude/HANDOFF_TEMPLATE.md`, "Resuming" first), not from
   re-analysing old reports, CHANGELOG or evidence folders.
9. **Prompts can be short.** The standing rules (Polish, production `main`
   protection, preflight, evidence, HANDOFFs, GPT review before a merge)
   are in `CLAUDE.md` — a task prompt only needs the goal, scope, STOP
   conditions and anything that differs from the standing rules (e.g. an
   explicit merge authorization).

## Model choice (recommendation; the owner picks the model)

| Work | Model tier |
|---|---|
| Runtime game logic, save/migration, release/workflow, security, hard debugging, final review before a PR | most capable (Opus) |
| Running QA and reading results, small test fixes, docs/CHANGELOG updates, report drafting, packaging | mid tier (Sonnet) |
| Summarising long logs, mechanical edits, manifests/checksums, file inventories | fastest (Haiku) |

Switch with `/model` in Claude Code. A cheaper model still follows
`CLAUDE.md`; if it hits a save, release or economy question, hand the step
back to the most capable model rather than guessing.
