# HANDOFF template (short, complete)

Mandatory (CLAUDE.md): after every significant stage and whenever the work
passes to a new session -- not only when the owner asks. Written in Polish.
Aim for one screen per HANDOFF: facts and pointers, no narrative, but every
field filled (write "brak" rather than dropping a field). Anything long
(logs, diffs) goes into a file and the HANDOFF names the file.

## HANDOFF_CLAUDE (for the next Claude session)

```
STAN PRAC: <etap, co skończone / w toku>
REPO: <owner/repo>, gałąź <nazwa> @ <pełne SHA>, origin/main = <SHA>, PR: <link/brak>, git status: <czysto / lista>
TESTY: <zestaw: N/M PASS | FAIL (nazwa) | NOT RUN (powód)> — log: <ścieżka>
ZMIANY: <1–5 punktów, każdy z commitem>
RYZYKA: <otwarte ryzyka / decyzje właścicielki>
NASTĘPNY KROK: <jedno zadanie, warunki STOP>
BEZPIECZNA KONTYNUACJA: <preflight do wykonania, czego nie ruszać (produkcyjny main, SAVE v13, workflow), co przeczytać najpierw (max 3 pliki/sekcje)>
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
