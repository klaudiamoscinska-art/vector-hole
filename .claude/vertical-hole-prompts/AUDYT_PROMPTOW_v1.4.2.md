# v1.4.2 — dopisanie kolejki napraw z audytu z 2026-10-17

W v1.4.1 P00 wykrywał/raportował 5 ryzyk, lecz żaden gotowy pojedynczy prompt nie prowadził przez ich naprawienie w wyznaczonej kolejności. W v1.4.2 dodano **PX01–PX05** i twarde przekazanie z P00 do tej kolejki.

| ID audytu | Prompt wykonawczy | Zakres |
|---|---|---|
| VH-03 | PX01-SAVE.md | Ochrona zapisów / SAVE-08/09 / bezstratna migracja |
| VH-02 | PX02-ISOLATION.md | Arena↔Dzielnice, monety XP i skiny z premiami |
| VH-01 | PX03-DEV-PANEL.md | Oddzielenie DEV/RELEASE i telefoniczny panel testowy |
| VH-04 | PX04-PAGES.md | Workflow GitHub Pages, bez publikacji z claude/** ani katalogu . |
| VH-05 | PX05-LIVE-PRODUCTION.md | Test faktycznego publicznego URL bez routingu lokalnych plików |

- P00 pozostaje **read-only** i tworzy mapę FAIL → odpowiedni PX, a potem jest uruchamiany ponownie weryfikacyjnie.
- PX01–PX05 uruchamia się **osobno**, warunkowo po potwierdzeniu bieżącego stanu; nie wykonuje się bezmyślnych patchy, gdy problem jest już naprawiony.
- PX04 nie oznacza zgody na publikację, a PX05 nie może być zaliczony dla nieopublikowanego release.
- Oryginalne 15 promptów zachowano (P00 dostał tylko mapowanie do PX). Paczka skilli v1.4.1 pozostaje aktualna.
- Check_prompts.py sprawdza istnienie i minimalne wymagania 21 plików i spójność agregatu. Test statyczny nie potwierdza działania gry.
