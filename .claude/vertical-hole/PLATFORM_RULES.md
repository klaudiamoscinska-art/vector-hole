# Platformowe ograniczenia — stan odniesienia 2026-10-16

**To dokument pomocniczy, nie zamiennik aktualnej polityki.** Przed zgłoszeniem builda wejdź w oficjalne dokumenty i zapisz datę weryfikacji. Nie zakładaj, że umowa z Poki pozwala na równoległą publikację CrazyGames: istotne mogą być wyłączność webowa i prawa do dystrybucji.

## Poki
- Monetizacja: **reklamy z Poki SDK, bez IAP**. Zewnętrzne systemy reklam niedozwolone.
- SDK: `gameLoadingFinished` przy gotowości, `gameplayStart` na pierwszym input i wznowieniu, `gameplayStop` przy przerwie; bez sąsiadujących identycznych zdarzeń.
- `commercialBreak` tylko przy naturalnej przerwie; częstotliwość reklam ustala platforma. `rewardedBreak` tylko po jasno zakomunikowanej dobrowolnej decyzji gracza. Bez gate'owania podstawowej rozgrywki.
- Obsłuż adblock i awarię SDK: gra nadal grywalna, brak przyznania nagrody przy odrzuconej/niezaliczonej reklamie zgodnie ze zwróconym wynikiem.
- Weryfikuj i testuj inspektorem Poki, łącznie z event logiem i mobile.
- Źródła: https://developers.poki.com/guide/sdk-overview ; https://developers.poki.com/guide/requirements-quality ; https://developers.poki.com/guide/how-monetization-works ; https://developers.poki.com/guide/revenue-deal-types

## CrazyGames
- Basic Launch: reklamy nie zarabiają / wyłączone; build nie może się zawieszać, gdy ad SDK nie pokaże reklamy. Reklamy poza CrazyGames SDK niedozwolone.
- Full Launch: integracja SDK, gameplay start/stop i reklamy według wymogów. IAP: **invite only**, nie planuj jako funkcji dostępnej standardowo.
- Gameplay natychmiast lub najdalej po jednym kliknięciu (Full); język angielski obowiązkowy; mobilne UI czytelne i safe areas.
- Limity z dokumentacji przy sprawdzeniu: initial download ≤50 MB (≤20 MB dla mobile homepage), total size ≤250 MB, ≤1500 plików — przy publikacji zweryfikuj ponownie. To maksima platformowe, **nie cele wydajnościowe**; docelowo build powinien być dużo lżejszy.
- Bez oszukańczych reklam, przerywania aktywnej gry i opóźniania przycisku pominięcia. Adblock i brak reklam muszą być bezpieczne.
- Źródła: https://docs.crazygames.com/requirements/technical/ ; https://docs.crazygames.com/requirements/gameplay/ ; https://docs.crazygames.com/requirements/ads/ ; https://docs.crazygames.com/requirements/intro/

## Strategia dystrybucji
Poki-first jest hipotezą testową, **nie bezwarunkowym harmonogramem**. Ustal prawa/umowę/wyłączność przed multi-portal release. Mierz jakość gry zanim obudujesz ją skomplikowanym sklepem. Bez dopisywania praw niepotwierdzonych i bez automatycznej publikacji.
