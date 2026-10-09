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
> - **Żywe neonowe miasto** — 6 dzielnic z ulicami, placami, portem i dachami;
>   wszystko, co zjesz, z wirem wpada w głąb dziury
> - **Rundy 2:00** — pierwszy kęs w pół sekundy, ścieżki energii wzdłuż
>   ulic, combo, wyścig z rywalem do ostatnich sekund i wielki finisz
> - **60 misji kampanii** w 6 dzielnicach z wielkimi budowlami do pochłonięcia
> - **Wyzwanie dnia** — ta sama mapa dla wszystkich, codziennie nowa
> - **Pojedynki ze znajomymi** — wyślij link, pobij wynik na tej samej mapie
> - **Wiry z bonusami**, smugi, efekty i odbudowa Core City
> - Dynamiczna muzyka synthwave i dźwięki, które rosną razem z combo

**Słowa kluczowe:** gra io, czarna dziura, gra w przeglądarce,
darmowa gra, gra mobilna, neon, cyberpunk, gra bez instalacji.

## Uruchomienie

Trzy pliki, zero zależności, bez kroku budowania:

```bash
python3 -m http.server 8000   # potem http://localhost:8000/index.html
```

Push na `main` publikuje grę na GitHub Pages (`.github/workflows/deploy-pages.yml`).

## Testy (boty QA)

```bash
node qa/run-all.mjs
```

Szczegóły: `qa/README.md`. Wymaga zainstalowanego Playwrighta. `node qa/screens.mjs`
zapisuje 16 zrzutów ekranu telefonu do `qa/out/screens/` (przegląd wizualny).

## Dokumentacja

- `docs/GAME_DESIGN.md` — jak działa gra dziś (zasady, liczby, ton tekstów)
- `docs/CHANGELOG.md` — historia wersji
- `CLAUDE.md` — architektura kodu
- `design/` — oryginalne makiety i paleta

## Lista kontrolna przed premierą

1. Uzupełnij `CONFIG.legal` (wydawca + kontakt) w `game.js` i zleć przegląd
   polityki prywatności.
2. Wybierz kanał przychodu:
   - **Portal (CrazyGames / Poki):** wgraj trzy pliki — SDK portalu ładuje
     się automatycznie, reklamy z nagrodą i między rundami działają od razu.
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
4. Dodaj grafikę `og:image` (1200×630) do udostępnień — wymaga czwartego
   pliku (decyzja wobec zasady trzech plików, patrz `docs/GAME_DESIGN.md` §7).
