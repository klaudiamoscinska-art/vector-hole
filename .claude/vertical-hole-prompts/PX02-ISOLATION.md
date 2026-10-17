/vh-progression-economy W aktualnym repo Vertical Hole wykonaj WYŁĄCZNIE naprawę VH-02 — oddzielenie Areny od Dzielnic, tylko jeśli P00 potwierdził wpływ. Nie uruchamiaj innych promptów w tej sesji.

# PX02 — Pełna izolacja Areny i Dzielnic (VH-02, P1 CORE)
**Skille pomocnicze:** `vh-arena-gameplay`, `vh-save-security`, `vh-game-engineer`, `vh-qa-automation`.

1. Przeczytaj `VH_PREFLIGHT_REPORT.md`, `.claude/vertical-hole/{ARENA_DISTRICT_CONTRACT,SAVE_MIGRATION_CONTRACT,CHANGE_SAFETY,EVIDENCE_FRESHNESS}.md`, stan repo oraz wyniki PX01. Potwierdź w aktualnym kodzie cały łańcuch `nagroda misji dzielnic → save.coins / grantXp → RUN_TOOLS / SKINS.perks → parametry Areny`. **Nie zakładaj, że sam wspólny wyświetlany licznik jest błędem; potwierdź realny, niedozwolony wpływ stanu kampanii na zasady Areny.** Jeśli brak → PASS/NO CHANGE.
2. Zmapuj ownership: dla każdego zasobu, zakupu, odblokowania i efektu wskaż `arena`, `districts`, `cosmetic-neutral` oraz gdzie jest zapisany; oznacz niejednoznaczności do decyzji właścicielki. Niedozwolone są kanały kampanijnych bonusów, walut, XP, nagród i progresu wpływające na statystyki, start, wynik, długość czy dostępność rundy Areny. Nie usuwaj legalnych istniejących praw graczy ani kupionych benefitów bez zatwierdzonej migracji.
3. Jeżeli potrzeba nowego podziału zapisu lub ekwiwalentu historycznych zakupów, zaproponuj minimalny wariant i bezstratny plan migracji, z fixture'ami starych sald/inventory. **Przy konfliktach praw do już kupionych przedmiotów STOP i poproś o decyzję, bez destrukcyjnego patcha.** W pozostałych przypadkach wdrażaj tylko najmniejszą poprawkę i testy. Nie przywracaj energii.
4. Testuj tym samym seedem i wejściami: Arena przed i po misjach/zakupach/XP/skin perks/resetach Dzielnic ma identyczny start, parametry, fizykę, limity i scoring; replay oraz CTA „Następna arena” niezależne od stanu kampanii. Osobno potwierdź, że działania Areny nie zmieniają progresu kampanii. Sprawdź ochronę zakupów, zachowanie legacy save, SAVE-08/09, BOOST-01..03.
5. Udokumentuj dowody po ostatnim patchu (fingerprint, testy, diff, rollback); `CORE-ISOLATION=PASS` tylko przy rzeczywistym dowodzie braku transferów. Bez kontroli urządzenia: mobile `NOT RUN`.

**Kryterium zamknięcia:** niezależna Arena i Dzielnice + brak utraconych zapisów/uprawnień. **Nie publikuj, nie pushuj i nie naprawiaj FTUE ani warsztatu poza wymaganą granicą trybów.** Po zmianie ponów adekwatną część P00.

**Raport końcowy (obowiązkowy):** podaj dla każdego testu `PASS/FAIL/NOT RUN` z dowodem lub brakiem dowodu, zaktualizowane pliki, polecenia, ewentualny rollback oraz stan odpowiedniej bramki. Jeśli coś nadal jest `FAIL` albo `NOT RUN`, nie deklaruj ukończenia. **Nie publikuj ani nie pushuj bez zgody właścicielki.**
