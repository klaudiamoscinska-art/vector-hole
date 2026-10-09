# Vector Hole — historia wersji

Zwięzła historia. Aktualny opis gry: `docs/GAME_DESIGN.md`.
Starsze, szczegółowe plany wersji (v2–v12) zostały usunięte w v13 —
są w historii gita (`git log -- docs/`).

## v13.2 — dźwięk na iPhonie
Na iPhonie dźwięk w przeglądarce nie grał albo znikał (np. po samouczku):
iOS wycisza Web Audio przełącznikiem „cicho”, przełącza kontekst w stan
`interrupted` (powiadomienie, zmiana aplikacji, blokada), którego stary kod
nie wznawiał, a odblokowanie startowało na `pointerdown`, który w Safari nie
jest gestem. Teraz: sesja audio „playback”, wznawianie z każdego stanu przy
każdym tapnięciu, odbudowa „zablokowanego” kontekstu, ciche „pobudzenie”
wyjścia w geście, ponowna synchronizacja zegara muzyki. Nowe testy w
`qa/features.mjs` symulują stany iOS (stary kod oblewa 5 z nich).

## v13.1 — iPhone (dolna nawigacja i reset profilu)
Na iPhonie 16 Pro w Safari podpisy dolnych zakładek i przycisk „RESETUJ
PROFIL” chowały się pod paskiem przeglądarki: `#app` miał `100vh`, które
w iOS ignoruje paski Safari. Teraz `100dvh` (widoczna wysokość) oraz
margines na pasek domowy i wyspę na ekranie profilu. Testy układu na
402×874, 402×740 i 375×667 w `qa/design.mjs`.

## v13 — pas designu i rozgrywki
Diagnoza z audytu (2 niezależnych recenzentów + boty) i co zmieniono:

| Problem | Zmiana |
|---|---|
| Na starcie rundy ~4 obiekty na ekranie, pierwszy kęs po 1,1 s, 7 kęsów w 10 s | Ścieżki energii wzdłuż ulic + uczta wokół startu: 0,5 s i ~17 kęsów |
| Wynik Areny to nokaut w jedną stronę (wygrana o 20 000 albo 5. miejsce) | Rywal-pacer dopasowany do formy gracza, banery zmiany lidera i „BRAKUJE N PKT” |
| Dziura sama jechała do środka mapy przed pierwszym dotykiem i stawała pod trzymanym palcem | Palec przeliczany co klatkę, start w miejscu, puszczenie = stop |
| Samouczek: pusty ekran, limit 90 s (można przegrać i dostać ofertę reklamy), lista 4 zadań naraz, okna blokujące zła kolejność | Bez limitu, jedzenie wokół startu, jeden krok w karcie trenera, strzałka do celu |
| 5 ekranów między samouczkiem a 1. rundą | „ZAGRAJ TERAZ” startuje rundę; nowicjusz bez ekranu wsparcia i kalendarza |
| Za duży obiekt — cisza | „ZA DUŻE · URÓŚNIJ DO Tn” |
| Teksty: gracz jako kobieta, angielski żargon, „Rdzeń” w 5 znaczeniach, brak premisy | Forma neutralna, polskie nazwy (Wir/Smuga/Finisz, Wielki finisz, Godzina szczytu), premisa z NELA |
| Sklep pusty po 5–10 rundach | Ceny ×~3,3 |
| Godzina szczytu w 1. rundzie, ściana trudności jak klif | Brak modyfikatora przy t = 0, rampa do 24 rund, 2,5 s ochrony na starcie |

Plus: lżejsze rysowanie obiektów na najniższej jakości grafiki, przyklejony
pasek GRAJ 2:00 z tłem, nowy zestaw `qa/design.mjs`, porządek w dokumentacji.

## Wcześniej
- **v12 „Złoty Strzał VISUAL”** — Neonowe Miasto jako podłoga (dzielnice,
  ulice, cache kafli), widoczne wpadanie obiektów do wiru, korona lidera,
  oddalanie kamery i limit promienia, kompaktowy HUD, przyklejone akcje wyniku.
- **v11 „Złoty Strzał ULTRA”** — dźwięk syntezowany w WebAudio, adapter
  monetyzacji (portal/natywny, demo w przeglądarce), wyzwania znajomych i karta
  do udostępnienia, zgoda RODO, pieczęć i sanityzacja zapisu, adaptacyjna
  jakość, boty QA w repo.
- **v10** — klasy obiektów T4–T6, 61 misji zapisanych jako cele, kalibracja
  czasów automatycznym przejściem.
- **v9** — spójny wygląd, Wiry z bonusami, Złoty Rdzeń i SZAŁ, fonty.
- **v8** — poziom gracza (XP), kalendarz logowania, darmowa skrzynia, krzywa
  trudności kariery, zoom kamery, efekty (teksty, banery, konfetti).
- **v6** — unikalne obiekty misji, sylwetki landmarków, mechaniki Portalu,
  Mostku i Pasu przelotu.
- **v5** — zgodność UI z makietami w `design/screens/`, paleta z asset bible.
- **v4** — ekonomia Core City, pełna kampania, nawigacja dolna, Warsztat.
- **v3** — tryb Kampanii.
- **v2 „Golden Shot”** — joystick, ewolucje, Overdrive, hub, sklep, wyzwanie
  dnia, analityka.
