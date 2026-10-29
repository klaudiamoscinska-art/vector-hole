# HANDOFF template (short, complete)

Mandatory (CLAUDE.md): after every significant stage and whenever the work
passes to a new session -- not only when the owner asks. Written in Polish.
Aim for one screen per HANDOFF: facts and pointers, no narrative, but every
field filled (write "brak" rather than dropping a field). Anything long
(logs, diffs) goes into a file and the HANDOFF names the file.

## Where to keep it (so it survives a lost session)

- **Chat only is not enough** -- a session cut off by a limit or a dropped
  connection (Remote Control from the phone included) loses it.
- Mid-stage: commit the work so far on the stage branch (a WIP commit is fine;
  never `git stash` -- the stash is shared by every worktree) and push that
  branch, then write the HANDOFF to the stage report or the PR body. A local
  copy may go to `qa/out/<stage>/HANDOFF.md` (git-ignored, stays on that
  machine only).
- End of a stage: the HANDOFF goes into the PR body and the stage report.

## HANDOFF_CLAUDE (for the next Claude session)

```
STAN PRAC: <etap, co skończone / w toku>
REPO: <owner/repo>, gałąź <nazwa> @ <pełne SHA>, worktree: <ścieżka>, origin/main = <SHA>, push: <origin/<gałąź> = SHA / nie wypchnięto>, PR: <link/brak>, git status: <czysto / lista>
TESTY: <zestaw: N/M PASS | FAIL (nazwa) | NOT RUN (powód)> — log: <ścieżka>
ZMIANY: <1–5 punktów, każdy z commitem>
NIEDOKOŃCZONE: <lista zadań etapu, które zostały>
RYZYKA: <otwarte ryzyka / decyzje właścicielki>
NASTĘPNY KROK: <jedno zadanie, warunki STOP>
PUNKT WZNOWIENIA: <dokładnie: plik/sekcja/test, od którego zacząć; co już sprawdzone i czego nie powtarzać>
BEZPIECZNA KONTYNUACJA: <preflight do wykonania, czego nie ruszać (produkcyjny main, SAVE v13, workflow), co przeczytać najpierw (max 3 pliki/sekcje)>
PROMPT KONTYNUACYJNY: <gotowy tekst do wklejenia w nowej sesji, np. niżej>
```

Continuation prompt pattern (fill in, paste into a new session started in the
repo folder):

```
Kontynuuj etap <NAZWA> w klaudiamoscinska-art/vector-hole. Najpierw wznowienie
wg docs/claude/HANDOFF_TEMPLATE.md „Resuming”: gałąź <gałąź> @ <SHA>, worktree
<ścieżka>, PR <link/brak>. Ostatni HANDOFF: <gdzie>. Zrób tylko: <NASTĘPNY KROK>.
Nie powtarzaj: <co już zrobione>. STOP: <warunki>. Bez merge i deploymentu
<chyba że ten prompt wprost na to pozwala>. Raport i HANDOFF po polsku.
```

## HANDOFF_GPT (for the GPT coordinator / reviewer)

```
CEL ODBIORU: <co ma zostać sprawdzone>
PR / GAŁĄŹ: <link, SHA, baza>
ZMIANY: <pliki + 1 zdanie każda>; diff: <ścieżka>
DOWODY: <bramki z wynikami i ścieżkami logów>, porównanie z bazą: <różnice>
RYZYKA: <lista>
DECYZJE DO PODJĘCIA: <tak/nie dla właścicielki>
ZAKAZY: bez merge i deploymentu bez zgody właścicielki
```

## Resuming after a lost session (limit, crash, phone disconnect)

Find the work first, never restart the stage from zero and never "clean up"
someone else's changes:

1. `git fetch origin` and `git worktree list` -- sessions from VS Code and from
   Remote Control often run in `.claude/worktrees/<name>` on an auto-named
   branch (`worktree-…`); the stage may live there, not in the main folder.
2. Find the stage branch: `git branch -a --list "*<stage>*"`,
   `git ls-remote origin "refs/heads/*<stage>*"`; an open PR for it (GitHub).
3. For each candidate worktree: `git -C <path> status --short` and
   `git -C <path> log --oneline origin/main..HEAD`. Uncommitted changes there
   are the previous session's work -- leave them in place; continue in that
   worktree, or commit them there on the stage branch once their content is
   checked. Never `reset`, `checkout --`, `clean` or `stash` to get a "clean" tree.
4. Read the last HANDOFF (PR body, stage report, `qa/out/<stage>/HANDOFF.md`,
   the owner's paste) and continue from PUNKT WZNOWIENIA; repeat only the
   checks whose inputs changed since (evidence freshness).
5. Two worktrees with different unpushed work on the same stage, or a branch
   that disagrees with the HANDOFF → stop and report, do not merge them blind.
