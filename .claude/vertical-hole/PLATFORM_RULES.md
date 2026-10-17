# Platformowe ograniczenia — stan odniesienia 2026-10-16

**To dokument pomocniczy, nie zamiennik aktualnej polityki.** Przed zgłoszeniem builda wejdź w oficjalne dokumenty i zapisz datę weryfikacji. Nie zakładaj, że umowa z Poki pozwala na równoległą publikację CrazyGames: istotne mogą być wyłączność webowa i prawa do dystrybucji.

## Poki
- Monetizacja: **reklamy z Poki SDK, bez IAP**. Zewnętrzne systemy reklam niedozwolone.
- SDK: `gameLoadingFinished` przy gotowości, `gameplayStart` na pierwszym input i wznowieniu, `gameplayStop` przy przerwie; bez sąsiadujących identycznych zdarzeń.
- `commercialBreak()` tylko przy **wychodzeniu z pauzy/przerwy i powrocie do gameplayu po intencji gracza**, a nie przy samym wyjściu z areny do wyboru poziomów; zwykle przed `gameplayStart()`. Żadnych eventów SDK podczas midroll/rewarded. Częstotliwość emisji ustala platforma. `rewardedBreak()` tylko po jasno zakomunikowanej dobrowolnej decyzji gracza; bez gate'owania podstawowej rozgrywki.
- Obsłuż adblock i awarię SDK: gra nadal grywalna, brak przyznania nagrody przy odrzuconej/niezaliczonej reklamie zgodnie ze zwróconym wynikiem.
- Weryfikuj i testuj inspektorem Poki, łącznie z event logiem i mobile.
- Źródła: https://developers.poki.com/guide/sdk-overview ; https://developers.poki.com/guide/requirements-quality ; https://developers.poki.com/guide/how-monetization-works ; https://developers.poki.com/guide/revenue-deal-types

## CrazyGames
- Basic Launch: reklamy nie zarabiają / wyłączone; build nie może się zawieszać, gdy ad SDK nie pokaże reklamy. Reklamy poza CrazyGames SDK niedozwolone.
- Full Launch: integracja SDK, gameplay start/stop i reklamy według wymogów. IAP: **invite only**, nie planuj jako funkcji dostępnej standardowo.
- Gameplay natychmiast lub najdalej po jednym kliknięciu (Full); język angielski obowiązkowy; mobilne UI czytelne i safe areas.
- Limity z dokumentacji przy sprawdzeniu: initial download ≤50 MB (≤20 MB dla mobile homepage), total size ≤250 MB, ≤1500 plików — przy publikacji zweryfikuj ponownie. To maksima platformowe, **nie cele wydajnościowe**; docelowo build powinien być dużo lżejszy.
- Dla CrazyGames midgame przy naturalnej przerwie (np. ekran zakończenia rundy) według wymagań CrazyGames, NIE na zasadach czasowania Poki. `requestAd` obsługuje `adStarted`/`adFinished`/`adError`; `adError` obejmuje no-fill. Sprawdź aktualny wymóg obsługi focusu SDK (portal może śledzić go sam).
- Orientację sprawdź w konfiguracji gry na CrazyGames: portal może pokazać własną informację o obrocie. Nie dubluj jej własnym overlayem bez wykrycia realnej potrzeby; jeżeli blokada jest konieczna, uwzględnij iframe, stan reklamy i pauzę.
- Bez oszukańczych reklam, przerywania aktywnej gry i opóźniania przycisku pominięcia. Adblock i brak reklam muszą być bezpieczne.
- Źródła: https://docs.crazygames.com/requirements/technical/ ; https://docs.crazygames.com/requirements/gameplay/ ; https://docs.crazygames.com/requirements/ads/ ; https://docs.crazygames.com/requirements/intro/ ; https://docs.crazygames.com/sdk/video-ads/ ; https://docs.crazygames.com/sdk/game/

## Strategia dystrybucji
Poki-first jest hipotezą testową, **nie bezwarunkowym harmonogramem**. Ustal prawa/umowę/wyłączność przed multi-portal release. Mierz jakość gry zanim obudujesz ją skomplikowanym sklepem. Bez dopisywania praw niepotwierdzonych i bez automatycznej publikacji.

## Rozdzielenie adapterów i dowody
- Logika gry decyduje **czy** wolno grać, adapter portalu decyduje **kiedy i jak** wysłać zdarzenia SDK. Nie używaj jednego generycznego wzorca reklam dla Poki i CrazyGames.
- `adFinished`, `adError`, no-fill i `focus` usuwają najwyżej odpowiednie blokady, ale nie kasują pauzy ręcznej/orientacji ani intencji przejścia do menu; nigdy `finally: gameplayStart` bez przeliczenia stanu.
- Przed wydaniem jawnie sprawdź oficjalną dokumentację z datą i obowiązującą wersję SDK, zaloguj potwierdzone przypadki testowe. Dokument niniejszy nie gwarantuje niezmienności polityk.

## Sprawdzone wytyczne orientacji (audyt v1.3)
Według oficjalnej [dokumentacji technicznej CrazyGames](https://docs.crazygames.com/requirements/technical/) portal może sam wymusić skonfigurowaną orientację, wyświetlając prośbę o obrót; **nie wymaga wtedy własnego orientation-lock overlay w grze**. P14A ma najpierw użyć konfiguracji submission i przetestować iframe; fallback lokalny tylko dla innych hostów lub wykazanej luki. Gra w pionie na mobile musi nadal działać w landscape na desktop z odpowiednim letterboxem. Weryfikuj aktualny stan przy wysyłaniu builda.
