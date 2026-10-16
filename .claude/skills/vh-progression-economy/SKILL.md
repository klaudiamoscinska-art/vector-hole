---
name: vh-progression-economy
description: "Balans progresji, trudności i uczciwej ekonomii Vertical Hole: tier T1–T6, nagrody, warsztat, kosmetyki, waluta oraz wskaźniki odpadania bez energii i sztucznego grindu."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-progression-economy

## Misja
Optymalizuj motywację do samodzielnego powtórzenia rundy, nie przymus płacenia ani oglądania reklamy. Projektuj matematycznie sprawiedliwe krzywe z jawnymi założeniami.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md` i `.claude/vertical-hole/WORKFLOW.md`. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Aktualne tabele progów, przedmiotów warsztatu, koszty/bonusy, spawn weights, czas zdobywania tierów, wyniki rzeczywistych rund.

## Procedura operacyjna
1. Zapisz model: szansa zdobycia zasobów na minutę, koszt ulepszeń, oczekiwana liczba rund, wpływ bonusów na wynik, wariancja spawnów. Użyj symulacji seeded, nie samych intuicyjnych progów.
2. Oddziel `arena.score/tier` od `districts.progress`. Ulepszenia warsztatu nie mogą odblokowywać przystępu do areny lub psuć wyrównania z botami, chyba że jest to jawna, przetestowana reguła.
3. Upraszczaj ekonomię do jednej głównej waluty, o ile jej w ogóle potrzeba. Wyeliminuj energię odnawialną, tokeny wejść i resetowanie rund przez timer.
4. Każdy purchasable/earned efekt musi realnie działać: np. magnes przez całą rundę, upgrade promienia, skórki; dodaj automatyczne testy czasu i zasięgu działania.
5. Nie używaj trudności manipulowanej w ukryciu dla wywołania reklamy. Jeśli przewidziano revive/rewarded, musi istnieć uczciwa alternatywa nie-reklamowa.
6. Wyprowadź hipotezy o poprawie restart rate i długości sesji; testuj na dwóch poziomach umiejętności, ogranicz zawyżanie nagród dla botów.

## Definition of Done / dowód ukończenia
Opublikowane w repo tabele balansu, symulacja rozkładów, test bonusów na pełną rundę i dowód braku energy-gating. Decyzje monetizacyjne uzgodnione z platformą.

## Zakazy i alarmy
Nie kopiuj mobile F2P z dwiema walutami na web Poki, nie wprowadzaj manipulacyjnych timerów i „braków energii”. Nie wnioskuj o D7 z symulacji botów.

## Współpraca
Gdy niezbędne, użyj także: `vh-arena-gameplay`, `vh-monetization`, `vh-analytics-experiments`, `vh-qa-automation`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.
