# Polityka prywatności — projekt do zatwierdzenia (CRAZYGAMES-BASIC-1)

**To projekt, a nie porada prawna.** Pola `[OWNER INPUT REQUIRED]` uzupełnia właścicielka;
prywatne dane nie trafiają do repozytorium. Opis dotyczy paczki CrazyGames Basic i wynika
z kodu bazy `727b8bd` i tego etapu.

## Co gra faktycznie robi (ustalone w kodzie i testach)

| Obszar | Stan | Dowód |
|---|---|---|
| Serwer gry | Brak | w kodzie nie ma `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket` (`qa/crazygames-basic1.mjs`) |
| Zapis | Data Module CrazyGames SDK (CG-DATA-1): gość — w przeglądarce (przez SDK), zalogowany — na koncie CrazyGames; treść: postęp, ustawienia, losowy identyfikator gościa, opcjonalna nazwa gracza | `defaultSave()`, `saveStore()`, Profil → „Pobierz moje dane” |
| Statystyki | W paczce wyłączone; kolejka zdarzeń zostaje w pamięci strony i nigdzie nie wychodzi | `Analytics.consent` = fałsz przy `PORTAL_BASIC` |
| Reklamy, zakupy, logowanie | Brak w paczce | `qa/crazygames-basic1.mjs` |
| Pliki zewnętrzne | Tylko oficjalny skrypt CrazyGames SDK v3 (zapis); czcionki wbudowane | `qa/crazygames-basic1.mjs`, `qa/cg-data1.mjs` |
| Portal | CrazyGames ma własne zasady i własne dane o ruchu | dokumentacja: pomiar KPI jest automatyczny, bez SDK |

Wymóg CrazyGames: informacja o prywatności jest potrzebna, gdy gra zbiera dane osobowe poza
zdarzeniami SDK (`requirements/technical/`, „User Consent”). Paczka ich nie zbiera, więc
tekst dostępny w Profilu wystarcza na Basic. Warto jednak mieć publiczny adres polityki,
jeśli formularz o niego zapyta.

## Tekst polityki (angielski, do publikacji po uzupełnieniu)

```
Privacy Policy — GLITCH GULP

Publisher: [OWNER INPUT REQUIRED: publisher name]
Contact: [OWNER INPUT REQUIRED: contact address]
Last updated: [OWNER INPUT REQUIRED: date]

What the game stores
Your progress, settings, a random guest identifier and, if you enter one, a player name. The game saves this data through the CrazyGames save system (the CrazyGames SDK Data Module): as a guest it stays in your browser on your device; when you are logged in to CrazyGames it is stored in your CrazyGames account, so it is available on your other devices. CrazyGames handles that storage under its own privacy policy. The game has no accounts of its own and does not ask for your email.

What the game sends
The game has no server, collects no statistics and sends no data to the publisher. The only data that leaves your browser is the save described above, through CrazyGames when you are logged in.

Ads and purchases
This version of the game shows no ads and sells nothing for real money.

Fonts and files
All fonts and game files are part of the game. The game loads nothing from other websites.

The website you play on
If you play on a game portal, such as CrazyGames, that portal runs its own website and its own services under its own privacy policy.

Your choices
In the game's profile you can download your data ("Download my data") and delete it ("Reset profile" erases the game save together with its backup copies from the CrazyGames save system: as a guest on this device, when you are logged in also from your CrazyGames account). Clearing your browser's site data deletes a guest's data on that device. If you are in the EU, you may also complain to your national data protection authority.

Children
The game asks for no personal information. A player name is optional; please do not enter your real name.

Changes
If the game starts to process other data, for example through ads or accounts, this policy will be updated before that happens.
```

## Do decyzji właścicielki

1. Dane wydawcy i kontakt. W grze widnieje dziś neutralne „Wydawca gry GLITCH GULP”
   (`CONFIG.legal`) i pusty kontakt. Bez Twoich danych to pozostaje bez zmian.
2. Gdzie opublikować politykę, jeśli formularz poprosi o adres. Publiczny plik
   w repozytorium ujawni wpisane dane, więc wybierz adres kontaktowy, który może być publiczny.
3. Przed Full Launch (reklamy, zdarzenia SDK) polityka i tekst w grze wymagają aktualizacji. Zapis przez Data Module jest już opisany (CG-DATA-1).
4. Zapisy są osobne: iPhone (ekran główny), GitHub Pages i CrazyGames to różne magazyny.
   GitHub Pages i CrazyGames nie są synchronizowane; na CrazyGames konto synchronizuje tylko
   zapis paczki między urządzeniami.
