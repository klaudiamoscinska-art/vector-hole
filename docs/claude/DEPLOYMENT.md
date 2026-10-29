# Deployment (E3 / L1 / K2) — full reference

Moved verbatim from `CLAUDE.md` (OPT-2, 2026-10-24); `CLAUDE.md` keeps the hard
rules and points here. Read this before touching `.github/`, the release
script, `index.html` paths or anything about publishing/rollback; the
procedures themselves are in `docs/E3_ROLLBACK_PLAN.md`.

## Stage flow — from a branch to production (DOCS-1)

Every step is separate: finishing one never authorizes the next, and an
approval given for one PR or stage never carries over to another.

1. **Audit / implementation** — on a stage branch cut from the current
   `origin/main` (never `main`; never new commits on a branch whose PR is
   already merged). A read-only audit (P00, a review) changes no code.
2. **Commit** — logical commits; check the file list (`git status`, no blind
   `git add -A`). Without a git identity on the machine use a per-command one
   (`git -c user.name=… -c user.email=… commit`), never a global config change.
3. **Push** — the stage branch only (`git push -u origin <branch>`); never
   `main`, never force. A push of a branch publishes nothing.
4. **PR** — only when the owner's prompt asks: one PR to `main` with the
   changes, the gates as `PASS / FAIL / NOT RUN` against the base, what was not
   verified, a review pack for GPT and the HANDOFF. Opening a PR deploys nothing.
5. **GPT's independent review** — relayed by the owner. Fixes are new commits
   on the same branch (no force-push, no rewritten history) with the affected
   checks re-run.
6. **Merge** — after the review, on the owner's explicit approval for this PR.
   Default: the owner merges. Claude merges only when the current prompt
   explicitly authorizes it for this PR (`CLAUDE.md`), and only after the
   conditions it names; a standard merge commit unless the prompt says
   otherwise, never bypassing the `main` ruleset. No such sentence in the
   current prompt → stop at the PR (`PR GOTOWY DO ODBIORU`).
7. **Automatic deployment** — a merge that touches the deploy paths (above:
   `index.html`, `style.css`, `game.js`, `**.js`, `**.css`, `.github/scripts/**`,
   the workflow) starts "Deploy to GitHub Pages" (build → deploy →
   verify-live). Claude never starts `workflow_dispatch`, never re-runs a run,
   never uses `mode: recovery` (owner only). A merge outside those paths
   (docs, `.claude/`, `qa/*.mjs`, the PR template) deploys nothing — the live
   release stays the previous one.
8. **Production check** — after an authorized merge, depending on what it changed:
   - *A merge that starts a deployment* (it touches the deploy paths): the run
     "Deploy to GitHub Pages" for the merge commit's SHA has `build`, `deploy`
     and `verify-live` green; the live `index.html` loads the new release
     `v/<first 12 hex of the merge commit>/` (`docs/E3_ROLLBACK_PLAN.md`
     "Słownik"); a short live smoke test.
   - *A documentation-only merge* (nothing on the deploy paths): no new
     deployment is expected — confirm the merge commit is `main`'s tip and
     that the live `index.html` still loads the same release `v/<id>/` as
     before the merge (no new `github-pages` deployment record).
   A red run, an unexpected deployment or a broken game → stop and report;
   recovery only by the plan and the owner.

`.github/workflows/deploy-pages.yml` deploys GitHub Pages from `main` only (a push to `main` touching the deploy paths — `index.html`, `style.css`, `game.js`, any `**.js`/`**.css`, `.github/scripts/**`, the workflow — or `workflow_dispatch` on `main`; only main's tip is deployed, a re-run of a superseded commit deploys nothing). E3: it runs `.github/scripts/assemble-release.mjs` (Node, no dependencies, `--experimental-vm-modules`), which builds `release/` from the git checkout (`fetch-depth: 0`) and publishes only that folder — never the repo root, so `.claude/`, `docs/`, `qa/`, `design/` and other dev files are not served:
- `index.html` — the release's own, with only its `<script src>` and stylesheet `href` rewritten to `v/<id>/…`;
- `v/<id>/` — **immutable**: the release's whole module graph + CSS, id = first 12 hex of the commit, bytes = that commit's git blobs; earlier releases are rebuilt from git and retained (`RETENTION`, L1: by the **deployment ledger** — GitHub's deployment records of the `github-pages` environment, read with `deployments: read` (GET only) by the script's `ledger` command: every release live at any moment of the last 30 days, the last 5 published, the live one, the current one; a record whose statuses are past GitHub's 90-day status retention without a visible success counts as *maybe published*, never as not published; a release that must be kept but can't be rebuilt from its commit is a STOP, never "excluded"; over 60 = error, never a silent drop; the ledger must agree with the live site; the git-only rule survives only as `--no-ledger` for local previews/tests and is refused under GitHub Actions; L1-R1: GitHub's `Link` names the next page `/repositories/<id>/...` — it is only checked (same origin, endpoint, query, page + 1, id = `$GITHUB_REPOSITORY_ID`), the next URL is always built from the script's own `/repos/{o}/{r}/` URL; `waiting` (every record's first status) counts as in flight; since the era epoch a `github-pages` record from any app but `github-actions` is a STOP — the Pages source must stay "GitHub Actions");
- root `game.js` / `style.css` — **frozen**: the last classic pair (commit `63b50d0`, SHA-256 pinned in the script) for browsers still holding a pre-E3 `index.html`.

**A URL never changes meaning:** never edit or remove the root pair, never reuse a `v/` id for other bytes, never move or rename `index.html` (home-screen icons, one origin = one save). The repo's `index.html` keeps `src="game.js"` — only CI rewrites it, so local HTTP serving and QA work without any build. The workflow has three jobs: `build` (no environment: live pre-check, ledger, assembly, independent check), `deploy` (the **only** job bound to `github-pages` — it just receives the checked folder, re-checks that the live `index.html` is still the one the build saw (a re-run of an old run's deploy job can't publish over a newer release), uploads and deploys, so a deployment record means exactly one real publication and a superseded run creates none), `verify-live` (no environment, so a red post-check never rewrites the record). It checks the live site before deploying (pins, live release id, its bytes), verifies `release/` again with an independent bash step (types, no dev/QA paths or hooks, pins, one script/stylesheet in `v/<id>/`), and checks the live site after deploying; exit 3 = infrastructure (network, 403/5xx), exit 1 = release problem — both stop. A new module is picked up from the `index.html` import graph automatically (static, relative, `.js`, inside the release; no dynamic `import()`, `import.meta`, bare/absolute specifiers, symlinks, CSS `url()` to files). `qa/release.mjs` runs the same script on snapshot histories. Rollback = a forward commit restoring the last good runtime content; never revert PR #76 or the workflow alone, never re-run a classic run, never rewrite `main`, and never remove `v/` while pages may reference it — the procedures (build/deploy/verify-live failures, broken game, damaged `v/<id>/`, API outage, live ↔ ledger mismatch, blocked rollback, root pins, saves) are in `docs/E3_ROLLBACK_PLAN.md`. **Break-glass (K2):** a `workflow_dispatch` on `main` with `mode: recovery` (owner only — actor = triggering actor = repository owner, first attempt, `expected_main_sha` = the run's sha = main's tip, `expected_live` = the live id or `classic`, a `reason`; inputs reach the shell only via `env`) differs from a standard run in exactly two places, both logged (step summary, `manifest.recovery`, 90-day `recovery-record` artifact): a live `v/<id>/` file that is 404 or mistyped is rebuilt from git (served bytes must still match), and a live ↔ ledger disagreement is accepted only if the ledger itself keeps the live release; it also refuses a release with `SAVE_SCHEMA_VERSION` < 13. Everything else (retention, pins, root, immutability, graph/bash checks, deploy guard, verify-live, API outage) is unchanged; a push is always standard; `qa/release-recovery.mjs` checks it (§4 of the plan). Other branches never run the workflow; the `github-pages` environment also only accepts `main`. `.nojekyll` is a leftover from branch-based Pages and isn't published.
