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
