# HANDOFF template (short, complete)

Written in Polish for the owner. Aim for one screen per HANDOFF: facts and
pointers, no narrative. Anything long (logs, diffs) goes into a file and
the HANDOFF names the file.

## HANDOFF_CLAUDE (for the next Claude session)

```
STAN: <gałąź> @ <pełne SHA>, origin/main = <SHA>, git status: <czysto / lista>
ZROBIONE: <1–5 punktów, każdy z commitem>
TESTY: <zestaw: N/M PASS | FAIL (nazwa) | NOT RUN (powód)> — log: <ścieżka>
OTWARTE: <ryzyka / decyzje właścicielki>
NASTĘPNY KROK: <jedno zadanie, warunki STOP>
NIE RUSZAĆ: <np. produkcyjny main, SAVE v13, workflow>
CZYTAJ NAJPIERW: <max 3 pliki/sekcje>
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
