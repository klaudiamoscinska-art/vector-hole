# Prompty v1.3 — zmiany po audycie

- `P00`: audit read-only i odwracalne fazy CORE/TOOLS, zamiast jednoczesnej przebudowy; brak fikcyjnych PASS; testy SAVE i BOOST, fingerprint finalnego worktree.
- Wszystkie pozostałe P*: wymagany zgodny hash kodu i świeże testy; wspólny kontrakt bezpiecznych, małych zmian.
- `P14D` i `P04-05`: prawidłowa obsługa timerów zamrażanych w tle i braków obserwacji R5.
- `P14A`: CrazyGames submission orientation/portal overlay, samodzielny fallback tylko w razie potrzeby.
- `P11`, `P12`, `P14E`: stop destrukcji starych zapisów i testy końcowej wersji.
- `P14B`: oddzielne dowody runtime SDK, gdy dotykano reklam.

Pakiet jest instrukcją dla Claude Code. Nie zapewnia, że w repo gry testy/SDK/urządzenia są dostępne.
