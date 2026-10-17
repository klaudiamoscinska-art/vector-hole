---
name: vh-progression-economy
description: "Balans progresji, trudności i uczciwej ekonomii Vertical Hole: tier T1–T6, nagrody, warsztat, kosmetyki, waluta oraz wskaźniki odpadania bez energii i sztucznego grindu."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-progression-economy

## Misja
Optymalizuj motywację do samodzielnego powtórzenia rundy, nie przymus płacenia ani oglądania reklamy. Projektuj matematycznie sprawiedliwe krzywe z jawnymi założeniami.

## Kontrola v1.3 — obowiązuje w każdej sesji
Przed zmianą kodu czytaj `.claude/vertical-hole/CHANGE_SAFETY.md`; przed zaakceptowaniem testów / użyciem wcześniejszego raportu P00 czytaj `.claude/vertical-hole/EVIDENCE_FRESHNESS.md`. Sam `git HEAD` nie dowodzi tożsamości roboczego kodu. Test PASS dotyczy wyłącznie bieżącego snapshotu; niekompletny lub starszy raport traktuj jako `NOT RUN`. Dla zadań dotykających panelu/builda czytaj także `.claude/vertical-hole/RELEASE_DEBUG_GUARD.md`.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md`, `.claude/vertical-hole/PREFLIGHT_GATES.md`, `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` i `.claude/vertical-hole/WORKFLOW.md`. Przed nowymi funkcjami sprawdź `GO_CORE` (energia, izolacja, pętla, migracja zapisu): przy FAIL/NOT RUN niezwiązanym z zadaniem nie rozwijaj feature’u, tylko zgłoś blokadę i potrzebną naprawę. `GO_TOOLS` (panel) jest bramką niezależną: jego brak nie blokuje napraw FTUE/gameplay, ale ogranicza testy wymagające panelu i wydanie. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Aktualne tabele progów, przedmiotów warsztatu, koszty/bonusy, spawn weights, czas zdobywania tierów, wyniki rzeczywistych rund.

## Procedura operacyjna
1. Zapisz model: szansa zdobycia zasobów na minutę, koszt ulepszeń, oczekiwana liczba rund, wpływ bonusów na wynik, wariancja spawnów. Użyj symulacji seeded, nie samych intuicyjnych progów.
2. Oddziel `arena.score/tier` od `districts.progress`. Ulepszenia warsztatu/kampanii nie mogą odblokowywać przystępu do areny ani modyfikować jej balansu — sama jawność/testowalność reguły nie jest wyjątkiem; ewentualna zmiana granicy wymaga odrębnej decyzji użytkowniczki.
3. Upraszczaj ekonomię do jednej głównej waluty, o ile jej w ogóle potrzeba. Wyeliminuj energię odnawialną, tokeny wejść i resetowanie rund przez timer.
4. Każdy purchasable/earned efekt musi realnie działać: np. magnes przez całą MISJĘ dzielnic (gdy owner=districts), jawnie niezależny produkt arenowy (gdy owner=arena), skórki bez przewagi; dodaj automatyczne testy czasu i zasięgu działania.
5. Nie używaj trudności manipulowanej w ukryciu dla wywołania reklamy. Jeśli przewidziano revive/rewarded, musi istnieć uczciwa alternatywa nie-reklamowa.
6. Wyprowadź hipotezy o poprawie restart rate i długości sesji; testuj na dwóch poziomach umiejętności, ogranicz zawyżanie nagród dla botów.

## Definition of Done / dowód ukończenia
Opublikowane w repo tabele balansu, symulacja rozkładów, test bonusów na pełną rundę i dowód braku energy-gating. Decyzje monetizacyjne uzgodnione z platformą.

## Zakazy i alarmy
Nie kopiuj mobile F2P z dwiema walutami na web Poki, nie wprowadzaj manipulacyjnych timerów i „braków energii”. Nie wnioskuj o D7 z symulacji botów.

## Współpraca
Gdy niezbędne, użyj także: `vh-arena-gameplay`, `vh-monetization`, `vh-analytics-experiments`, `vh-qa-automation`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.

## Właścicielstwo nagród i walut — twarda bramka
Zanim zmienisz nagrodę, boost, sklep, pryzmaty lub saldo, sporządź tabelę `źródło → właściciel (arena/dzielnice/wspólne neutralne) → wydatek → efekt`. Dzielnicowe upgrady, saldo i nagrody nie wpływają na tier, magnet, wynik, timing, wejście ani balans areny. Wyjątki wymagają **jawnej decyzji użytkowniczki przed kodowaniem** — „testowalna reguła” nie wystarcza. Wprowadź testy nieprzenikania zakupów/resetu/migracji z `ARENA_DISTRICT_CONTRACT.md`.

## Krytyczny test własności i wartości historycznej (v1.2)
Dla oferty ustal `product_id / owner / activation_scope / expiry_condition / save_key`. Oddziel test kampanijnego magnesu od testu areny wg `TECHNICAL_PATTERNS.md` §4 i BOOST-01..03. Przed usunięciem energii, pryzmatu lub oferty wykonaj SAVE-01..07 wg `SAVE_MIGRATION_CONTRACT.md`, w tym test historycznego salda, inventory i entitlement. Brak zastosowania waluty nie upoważnia do skasowania jej środków. Wydane uprawnienie nie znika bez uzgodnionej ścieżki odzyskania/kompensacji.

## Obowiązkowa regresja izolacji (2026-10-17)
Przy audycie ekonomii pokaż pełną trasę `endCampaignMission`/`checkStarChests` → wspólne `save.coins` i `grantXp` → `confirmRunSetup` → płatny `RUN_TOOLS` → modyfikatory areny; druga trasa to zakup/equip `SKINS.perks` (speed/magnet/startUnits/score). To nie jest neutralne współdzielenie kosmetyków. Jeżeli potwierdzone, `CORE-ISOLATION=FAIL` i projekt najmniejszej odwracalnej separacji z ochroną legacy sald; nie kasuj waluty.
