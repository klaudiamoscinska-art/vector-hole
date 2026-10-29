# Vector Hole — pochłoń neonowe miasto

**Darmowa gra .io w przeglądarce.** Sterujesz czarną dziurą w neonowym
mieście: pochłaniasz wszystko, co mniejsze od Ciebie, rośniesz z każdym
kęsem, zjadasz mniejszych rywali i w 2 minuty walczysz o podium. Bez
instalacji — na telefonie i komputerze.

## Opis do sklepu / portalu

> Jedna dziura. Całe miasto. Zero litości.
>
> Glitch skaził Neonowe Miasto. Pochłaniaj latarnie, auta, tramwaje i
> wieżowce, rośnij przez 6 rozmiarów i zjadaj rywali, zanim oni zjedzą
> Ciebie. Złap Złoty Rdzeń, by wpaść w SZAŁ — podwójne punkty i obiekty
> o rozmiar większe!
>
> - **Żywe neonowe miasto** — ulice, place, port i dachy; wszystko, co
>   zjesz, z wirem wpada w głąb dziury
> - **Rundy 2:00** — pierwszy kęs w pół sekundy, ścieżki energii wzdłuż
>   ulic, combo, wyścig z rywalem do ostatnich sekund i wielki finisz
> - **240 misji kampanii** w 12 dzielnicach z wielkimi budowlami do pochłonięcia
> - **Wyzwanie dnia** — ta sama mapa dla wszystkich, codziennie nowa
> - **Pojedynki ze znajomymi** — wyślij link, pobij wynik na tej samej mapie
> - **Wiry do kolekcji** (sam wygląd — w Arenie liczy się gra), smugi, efekty i odbudowa Core City
> - Dynamiczna muzyka synthwave i dźwięki, które rosną razem z combo

**Słowa kluczowe:** gra io, czarna dziura, gra w przeglądarce,
darmowa gra, gra mobilna, neon, cyberpunk, gra bez instalacji.

## Uruchomienie

Zero zależności, bez kroku budowania (natywne moduły ES — potrzebny serwer HTTP, `file://` nie działa):

```bash
python3 -m http.server 8000   # potem http://localhost:8000/index.html
```

Push na `main` zmieniający pliki gry (`index.html`, `style.css`, `game.js`, inne `.js`/`.css`), skrypt wydania lub workflow publikuje grę na GitHub Pages (`.github/workflows/deploy-pages.yml`). Publikowany jest wyłącznie katalog `release/` składany w CI przez `.github/scripts/assemble-release.mjs`: pliki gry w niezmiennym katalogu `v/<commit>/` (plus wcześniejsze wydania zachowane według historii publikacji: ostatnie 30 dni i 5 ostatnich wydań) i zamrożona klasyczna wersja dla starych kopii strony w pamięci przeglądarki — nie całe repo. Adres gry i zapisy graczy się nie zmieniają. Zmiana samej dokumentacji (`docs/`, `.claude/`, `*.md`) niczego nie publikuje. Kolejne kroki od gałęzi do produkcji: `docs/claude/DEPLOYMENT.md`.

## Testy (boty QA)

```bash
node qa/run-all.mjs
```

Szczegóły: `qa/README.md`. Wymaga zainstalowanego Playwrighta. `node qa/screens.mjs`
zapisuje ok. 35 zrzutów ekranu telefonu (także iPhone SE) do `qa/out/screens/` (przegląd wizualny).

## Dokumentacja

- `docs/GAME_DESIGN.md` — jak działa gra dziś (zasady, liczby, ton tekstów)
- `docs/CHANGELOG.md` — historia wersji
- `CLAUDE.md` — zasady pracy dla Claude Code (ładowany w każdej sesji)
- `docs/claude/ARCHITECTURE.md` — architektura kodu; `docs/claude/DEPLOYMENT.md` — publikacja
- `qa/README.md` — boty QA i testy
- raporty etapów: `docs/CONTENT1_AUDIT.md`, `docs/BALANCE1_REPORT.md`, `docs/MOBILE_PERF1_REPORT.md`, `docs/DOCS1_AUDIT_REPORT.md`
- `design/` — oryginalne makiety i paleta

## Lista kontrolna przed premierą

1. Uzupełnij `CONFIG.legal` (wydawca + kontakt) w `game.js` i zleć przegląd
   polityki prywatności.
2. Wybierz kanał przychodu:
   - **Portal (CrazyGames / Poki):** wgraj zawartość złożonego katalogu
     `release/` (`node --experimental-vm-modules .github/scripts/assemble-release.mjs assemble …`, opis w `qa/README.md` E3). Gra nie zawiera SDK:
     adapter `Monetization` rozpoznaje portal po adresie i dopiero wtedy
     dociąga jego skrypt. Integracja nie była jeszcze sprawdzona w Poki
     Inspector ani w narzędziach CrazyGames (etap PORTAL-1) — do tego czasu
     nie zakładaj, że reklamy na portalu działają.
   - **Własna domena + AdSense H5 Games Ads:** dodaj tag AdSense
     (`adsbygoogle.js` + `adBreak/adConfig`) i certyfikowany przez Google CMP
     dla EOG.
   - **Aplikacja (Android/iOS):** opakuj w Capacitor/TWA i wstrzyknij
     `window.VectorHoleNative` (AdMob + Play Billing / StoreKit) — dopiero
     wtedy pojawia się sklep z pakietami i „Bez reklam”.
3. Podłącz analitykę (np. Google Tag Manager → `window.dataLayer`): zdarzenia
   płyną tylko po zgodzie gracza; śledź `retention_day` (D1/D7),
   `run_end`, `ad_reward_granted`, `iap_success`, `share_success`,
   `challenge_open`.
4. Dodaj grafikę `og:image` (1200×630) do udostępnień — wymaga dodatkowego
   pliku i dopisania go do skryptu wydania (decyzja właścicielki, patrz
   `docs/GAME_DESIGN.md` §7).
