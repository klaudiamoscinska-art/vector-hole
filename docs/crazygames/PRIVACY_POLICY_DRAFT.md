# Polityka prywatności — projekt do zatwierdzenia (CRAZYGAMES-BASIC-1)

**To projekt, a nie porada prawna.** Pola `[OWNER INPUT REQUIRED]` uzupełnia właścicielka;
prywatne dane nie trafiają do repozytorium. Opis dotyczy paczki CrazyGames Basic i wynika
z kodu `727b8bd` + tego etapu.

## Co gra faktycznie robi (ustalone w kodzie i testach)

| Obszar | Stan | Dowód |
|---|---|---|
| Serwer gry | Brak | w kodzie nie ma `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket` (`qa/crazygames-basic1.mjs`) |
| Zapis | `localStorage` w przeglądarce: postęp, ustawienia, losowy identyfikator gościa, opcjonalna nazwa gracza | `defaultSave()`, Profil → „Pobierz moje dane” |
| Statystyki | W paczce wyłączone; kolejka zdarzeń zostaje w pamięci strony i nigdzie nie wychodzi | `Analytics.consent` = fałsz przy `PORTAL_BASIC` |
| Reklamy, zakupy, logowanie | Brak w paczce | `qa/crazygames-basic1.mjs` |
| Pliki zewnętrzne | 0 żądań poza paczką, czcionki wbudowane | test na udawanym hoście CrazyGames |
| Portal | CrazyGames ma własne zasady i własne dane o ruchu | dokumentacja: pomiar KPI jest automatyczny, bez SDK |

Wymóg CrazyGames: informacja o prywatności jest potrzebna, gdy gra zbiera dane osobowe poza
zdarzeniami SDK (`requirements/technical/`, „User Consent”). Paczka ich nie zbiera, więc
tekst dostępny w Profilu wystarcza na Basic. Warto jednak mieć publiczny adres polityki,
jeśli formularz o niego zapyta.

## Tekst polityki (angielski, do publikacji po uzupełnieniu)

```
Privacy Policy — Vector Hole

Publisher: [OWNER INPUT REQUIRED: publisher name]
Contact: [OWNER INPUT REQUIRED: contact address]
Last updated: [OWNER INPUT REQUIRED: date]

What the game stores
Your progress, settings, a random guest identifier and, if you enter one, a player name. This data stays in your browser's local storage on your device. The game has no accounts and does not ask for your email.

What the game sends
Nothing. The game has no server, collects no statistics and sends no data to the publisher or to third parties.

Ads and purchases
This version of the game shows no ads and sells nothing for real money.

Fonts and files
All fonts and game files are part of the game. The game loads nothing from other websites.

The website you play on
If you play on a game portal, such as CrazyGames, that portal runs its own website and its own services under its own privacy policy.

Your choices
In the game's profile you can download your data ("Download my data") and delete it ("Reset profile"). Clearing your browser's site data also deletes it. If you are in the EU, you may also complain to your national data protection authority.

Children
The game asks for no personal information. A player name is optional; please do not enter your real name.

Changes
If the game starts to process other data, for example through ads or accounts, this policy will be updated before that happens.
```

## Do decyzji właścicielki

1. Dane wydawcy i kontakt. W grze widnieje dziś neutralne „Wydawca gry Vector Hole”
   (`CONFIG.legal`) i pusty kontakt. Nie zmieniałam tego bez Twoich danych.
2. Gdzie opublikować politykę, jeśli formularz poprosi o adres. Publiczny plik
   w repozytorium ujawni wpisane dane, więc wybierz adres kontaktowy, który może być publiczny.
3. Przed Full Launch (SDK, reklamy, konto) polityka i tekst w grze wymagają aktualizacji.
4. Zapisy są osobne: iPhone (ekran główny), GitHub Pages i CrazyGames to różne magazyny
   przeglądarki. Etap ich nie synchronizuje, zgodnie z poleceniem.
