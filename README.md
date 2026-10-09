# Vector Hole — pochłoń neonowe miasto

**Darmowa gra .io w przeglądarce.** Sterujesz czarną dziurą w neonowym
mieście: pochłaniasz wszystko, co mniejsze od Ciebie, rośniesz z każdym
kęsem, zjadasz mniejszych rywali i w 2 minuty walczysz o podium. Bez
instalacji — na telefonie i komputerze.

## Opis do sklepu / portalu

> Jedna dziura. Całe miasto. Zero litości.
>
> Pochłaniaj latarnie, auta, tramwaje i wieżowce, rośnij przez 6 poziomów
> wielkości i zjadaj rywali, zanim oni zjedzą Ciebie. Złap Złoty Rdzeń, by
> wpaść w SZAŁ — podwójne punkty i obiekty o poziom większe!
>
> - **Rundy 2:00** — szybka akcja, combo, finałowy Overdrive
> - **61 misji kampanii** w 6 dzielnicach z bossami-landmarkami
> - **Wyzwanie dnia** — ta sama mapa dla wszystkich, codziennie nowa
> - **Pojedynki ze znajomymi** — wyślij link, pobij wynik na tej samej mapie
> - **Rdzenie z bonusami**, trail’e, efekty i odbudowa Core City
> - Dynamiczna muzyka synthwave i dźwięki, które rosną razem z combo

**Słowa kluczowe:** gra io, hole io, czarna dziura, gra w przeglądarce,
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

Szczegóły: `qa/README.md`. Wymaga zainstalowanego Playwrighta.

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
   pliku, patrz `docs/VECTRE_V11_PLAN.md`.

Pełny changelog i znane luki: `docs/VECTRE_V11_PLAN.md`.
