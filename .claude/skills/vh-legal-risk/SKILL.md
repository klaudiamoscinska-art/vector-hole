---
name: vh-legal-risk
description: "Ryzyka prawne i prywatność Vertical Hole: GDPR/RODO, cookies, zgody reklamowe, dzieci i age rating, prawa do SVG/dźwięków/fontów, polityki Poki/CrazyGames, licencje, contract/exclusivity."
compatibility: "Claude Code; projekt Vertical Hole w HTML, CSS, JavaScript, Canvas 2D."
---

# vh-legal-risk

## Misja
Działaj jako audytor ryzyk, nie udawaj kancelarii prawnej. Zidentyfikuj decyzje, które wymagają zweryfikowanych aktualnych regulaminów lub prawnika, i od razu eliminuj niepotrzebne dane.

## Kontrola v1.3 — obowiązuje w każdej sesji
Przed zmianą kodu czytaj `.claude/vertical-hole/CHANGE_SAFETY.md`; przed zaakceptowaniem testów / użyciem wcześniejszego raportu P00 czytaj `.claude/vertical-hole/EVIDENCE_FRESHNESS.md`. Sam `git HEAD` nie dowodzi tożsamości roboczego kodu. Test PASS dotyczy wyłącznie bieżącego snapshotu; niekompletny lub starszy raport traktuj jako `NOT RUN`. Dla zadań dotykających panelu/builda czytaj także `.claude/vertical-hole/RELEASE_DEBUG_GUARD.md`.

## Kontrakt wejścia i kontekst
Na początku przejrzyj `.claude/vertical-hole/PROJECT_CHARTER.md`, `.claude/vertical-hole/PREFLIGHT_GATES.md`, `.claude/vertical-hole/ARENA_DISTRICT_CONTRACT.md` i `.claude/vertical-hole/WORKFLOW.md`. Przed nowymi funkcjami sprawdź `GO_CORE` (energia, izolacja, pętla, migracja zapisu): przy FAIL/NOT RUN niezwiązanym z zadaniem nie rozwijaj feature’u, tylko zgłoś blokadę i potrzebną naprawę. `GO_TOOLS` (panel) jest bramką niezależną: jego brak nie blokuje napraw FTUE/gameplay, ale ogranicza testy wymagające panelu i wydanie. Jeśli dotyczy wydania, danych albo reklam, również `PLATFORM_RULES.md` i `QUALITY_GATES.md`. Zanim podasz nazwy funkcji/ścieżek, **sprawdź je w aktualnym repo**. Jeśli nie masz dostępu do repo/urządzeń/danych, jawnie oznacz ograniczenie i wykonaj tylko to, co możliwe.

## Wejście
Kod telemetry/SDK/consent, zasady wybranej platformy, jurysdykcje wydania, lista assetów, zależności i praw licencyjnych; daty weryfikacji.

## Procedura operacyjna
1. Zrób inventory danych: co zbieramy, kto otrzymuje, po co, okres retencji, kategorie graczy, zgoda/podstawa, możliwość usunięcia. Jeśli nic nie zbieramy samodzielnie — odnotuj i skontroluj SDK.
2. Zweryfikuj oficjalne regulaminy, wymogi RODO/ePrivacy i wymagania dotyczące nieletnich oraz odpowiedni wiek/rating. Nie zakładaj, że zamieszczenie samego linku Privacy Policy spełnia wszystkie wymogi.
3. Zapewnij mechanizm, w którym brak zgody na opcjonalną analitykę nie blokuje gameplay; nie gromadź granularnego fingerprintingu, nie wysyłaj surowego IP w eventach.
4. Audytuj licencje SVG, kodu, bibliotek, nazw, logo i generatorów muzyki; w repo trzymaj rejestr pochodzenia assetów i atrybucji, jeśli obowiązuje.
5. Review reklam: opt-in/skip, jasny CTA, brak nagrody za niezaliczone rewarded zgodnie z SDK, brak szczególnych mechanizmów manipulacji nieletnimi.
6. Sprawdź warunki umowy z Poki przed innym portalem web; wyłączność może być trwała i dotyczyć open web. Nie zgaduj zapisów podpisanej indywidualnej umowy.
7. Podsumuj checklistę `PASS / ACTION / LEGAL REVIEW / UNKNOWN` i wskaż rzeczy blokujące release.

## Definition of Done / dowód ukończenia
Pochodzenie assetów, lista vendorów i pól danych, brak sekretów, matrix wymogów oraz jawne kwestie wymagające zatwierdzenia przez właścicielkę i ewentualnie prawnika.

## Zakazy i alarmy
Nie składaj gwarancji prawnych; nie proponuj obejścia polityki portalu. Nie generuj pseudoregulaminu i nie oznaczaj go „zgodny” bez danych o rzeczywistym przetwarzaniu.

## Współpraca
Gdy niezbędne, użyj także: `vh-portal-integrations`, `vh-monetization`, `vh-analytics-experiments`, `vh-release-manager`. Jeśli nie można wywołać innych skilli automatycznie, zastosuj odpowiednie checklisty ręcznie w tej samej sesji. Raport wykonania wg `.claude/vertical-hole/REPORT_TEMPLATE.md`; podaj `PASS / FAIL / NOT RUN`, a nie tylko deklarację sukcesu.
