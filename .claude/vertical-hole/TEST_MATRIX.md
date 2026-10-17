# Minimalna macierz walidacji — wypełniać faktycznymi wynikami

## Sprzęt i formaty
| Środowisko | Tryb | Weryfikacja | Wynik |
|---|---|---|---|
| iPhone / Safari (realne urządzenie) | portrait + landscape | input, safe-area, audio gesture, resize, pierwsza runda | NOT RUN |
| Android / Chrome (realne urządzenie) | portrait + landscape | input, web audio, tier growth, ad no-fill | NOT RUN |
| Chrome/Edge desktop | 16:9 iframe + fullscreen | mysz/klawisze, scroll suppression, restart | NOT RUN |
| Desktop Safari | desktop | Canvas/font/rendering/storage | NOT RUN |
| Wolny mobilny profil | throttled network/CPU | ready→first pickup, p95 frame-time, memory | NOT RUN |
| Bez łączności/SDK/adblock | każdy | rozgrywka, ad fail-open, brak blocker | NOT RUN |

## Regresja pętli
- Uruchomienie areny bez odblokowania którejkolwiek dzielnicy; runda nie zmienia district progression.
- Odświeżenie gry w 5 stanach (menu, runda, pauza, wynik, reklama) bez uszkodzenia zapisu.
- Nie istnieją stare liczniki energii, timery regeneracji i wydawanie energii w żadnym kanale.
- Rozmiar dziury a collision bounds w T1–T6; obiekty dostępne zgodnie z tierem i opisem.
- M32 witryna, M59 telefon-duża dziura; słownictwo maszt/wieżowiec, ikony celu, licznik wyniku/czasu.
- Magnes i inne boosty przez pełny deklarowany czas.
- Offline/adblock/SDK denied/skip/reward success/repeated callback — brak softlock i podwójnej nagrody.
- Build testowy: debug dostępny; build produkcyjny: zero kodu debug i zero dev endpointów.
- SDK: pierwsze gameplayStart na interakcji; start/stop bez duplikatów; pauza i reklama wyciszają audio/input.

## Definicja wyniku
`PASS`: wykonano i potwierdzono; `FAIL`: wykonano i zawiodło; `NOT RUN`: brak wykonania lub dowodu; `N/A`: nie dotyczy w danym kanale, uzasadnij.
Każdy FAIL zapisuj jako `bug id / severity / seed / viewport / step-by-step / expected / actual / file / evidence`.

## Minimalny zestaw dodatkowy P00
- [ ] Arena startuje i restartuje przy `new/locked`, `partial`, `complete` i `corrupted/missing` stanie dzielnic, ze stałym seedem i ustawieniami; brak odczytu boostów kampanii.
- [ ] Kupno/użycie kampanijnego przedmiotu, reset/migracja samej kampanii oraz przeładowanie strony nie zmieniają progresu i balansu areny.
- [ ] Rozgrywka bez energii i odczekiwania na ponowne wejście na każdym wspieranym kanale.
- [ ] Portrait→landscape→portrait podczas ręcznej pauzy/reklamy, a także no-fill/`adError` i callback ze starej rundy: brak bezwarunkowego resume.
- [ ] Dev panel działa w buildzie testowym, a jego implementacji nie ma w plikach publicznego builda; zapis dev i prod są oddzielne.
- [ ] Instrumentacja 300 s od wejścia jest odrębna od 300 s aktywnego gameplay; odmowa zgody nie blokuje gry, a wyniki QA nie trafiają do danych produkcyjnych.

## Scenariusze w1.2 — P00/legacy/boost/evidence
- [ ] CORE-SAVE: SAVE-01..07 wg `SAVE_MIGRATION_CONTRACT.md` (legacy energia tylko odczyt, saldo, inventory, nagrody, idempotencja, uszkodzenie i reload).
- [ ] BOOST-01..03: magnes „na całą misję” sprawdzaj w **dzielnicach**, nie przez fake arena upgrade; identyczna arena przed/po zakupie/migracji kampanii.
- [ ] `GO_CORE`: wszystkie cztery grupy z prawdziwym dowodem; `GO_TOOLS`: oddzielny wynik; brak narzędzia ≠ niegrywalny core.
- [ ] EVAL-01..08 zgodnie z `SKILL_EVALUATION.md`, w tym negatywna próba paczka-bez-gry = NOT RUN runtime.
- [ ] R5: legalny mianownik i brakujący/nieobserwowani; brak pomiaru całej kohorty ≠ sukces/fail produktu. Test QA nie wysyła telemetrii.

## Regresje v1.3
- [ ] `EVAL-09`: po zmianie roboczego źródła bez nowego commitu stary raport musi stać się STALE (hash bieżącego worktree).
- [ ] `EVAL-10`: produkcyjny bundle zawierający `VH_DEV_CONSOLE_ONLY` odrzucany przez guard. Brak markera to tylko część dowodu — sprawdź również globalne API, feature flagi i izolację zapisów.
- [ ] `EVAL-11`: instalacja przy istniejących plikach bez `--force` nie zapisuje nic; instalacja z `--force` tworzy unikalny backup i umie cofnąć przerwane kopiowanie.
- [ ] `EVAL-12`: migracja nieznanego legacy save nie niszczy wartości; test dwóch kart i przerwanego zapisu. Osobno potwierdź rollback starszego klienta.
- [ ] Portal CrazyGames: orientacja ustawiona w panelu portalu; nie dokładaj bezwarunkowo lokalnego overlayu (patrz `PLATFORM_RULES.md`).

## Obowiązkowe nowe przypadki dla tej bazy (2026-10-17)
- [ ] ISOLATION-ECON: zarobki/nagrody z dzielnic → `save.coins`, `grantXp`, zakup arenowych RUN_TOOLS, efekty SKINS.perks; identyczny seed i dwa stany historii.
- [ ] SAVE-08/09: nieznany przyszły schemaVersion i uszkodzony save -> brak cichego nadpisania.
- [ ] RELEASE-DEBUG: w release nie występuje `class DevPanel`, `DEV_ACCESS_KEY`, `window.game.devPanel`; dwa osobne artefakty + `verify_release_artifact.py` i live URL.
- [ ] DEPLOY-PAGES: `check_pages_workflow.py --repo .`, nie publikuj branchy `claude/**`, nie uploaduj `path: "."`; osobny PR/zgoda na poprawkę infrastruktury.
