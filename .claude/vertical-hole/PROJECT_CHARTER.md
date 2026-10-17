# Vertical Hole — karta produktu i niezmienniki (2026-10-16)

## Cel i rzeczywistość
Celem jest maksymalizacja **oczekiwanej długoterminowej wartości finansowej** gry przy małym zespole (2 osoby + Claude), z uwzględnieniem praw gracza, zgodności z portalami i kosztu produkcji. „Globalny hit” to ambicja, nie obietnica. Zamiast optymalizować liczbę feature'ów, optymalizuj **czas do wartościowego testu rynkowego**, jakość rozgrywki, wskaźniki i marżę.

## Znana baza projektu — HIPOTEZY DO WERYFIKACJI W REPO
- Gra „Vertical Hole” (repo bywa nazywane `vector-hole`) jest webową grą HTML/CSS/JavaScript z Canvas 2D i wektorowymi SVG; bez zewnętrznego silnika.
- Ostatni audyt wskazywał 12 dzielnic / ok. 240 misji, osobne moduły miasta/warsztatu, integracje Poki i CrazyGames oraz funkcje zapisu i analityki. **Nie uznawaj tego za dowód aktualnego stanu**: sprawdź pliki przed modyfikacjami.
- Kierunek produktu: **Arena First**. Graj natychmiast; arena stanowi główny produkt, miasto jest lekką otoczką/warsztatem, kampania może być opcjonalna.
- Koncepcja areny do weryfikacji: rundy ok. 120 sekund, kolejne progi pochłaniania T1–T6, rywale, spektakularny finał/Złoty Rdzeń. To punkty wyjścia do testów, nie zakaz zmian.
- **Weryfikować brak AKTYWNEGO mechanizmu odnawialnej energii/życia i blokady gry za energię** ze wszystkich wariantów platformowych (historyczny czytnik save może nadal rozpoznawać stare pola wyłącznie do migracji); zachować „fragmenty energii” wyłącznie jako elementy *wzrostu rozmiaru dziury*, o ile istnieją w bieżącym projekcie. Nie myl tych znaczeń.
- **Zweryfikować istniejące rozdzielenie: arena i dzielnice nie mogą współdzielić postępu rund ani wymuszać wzajemnego odblokowywania.** Wspólne mogą być wyłącznie jawnie opisane kosmetyki i ustawienia, jeżeli nie psują niezależności. Żadna waluta, boost ani nagroda z dzielnic nie może zmieniać balansu areny bez odrębnej decyzji właścicielki projektu — obowiązuje `ARENA_DISTRICT_CONTRACT.md`.
- Rozgrywka: widoczna i wygodna na małym ekranie telefonu; desktop też pierwszorzędny.
- Oprawa: lekka, spójna, z możliwością generowania SVG i muzyki/SFX przez kod i Web Audio.

## Kolejność wartości dla gracza
1. Pierwszy grywalny kontakt bez menu, konta ani energii.
2. Czytelność: od razu jasne co dziura może pochłonąć, jakie obiekty są celem i dlaczego rośnie.
3. „Game feel”: ruch, ssanie, skala obiektów, poczucie wzrostu, reakcja dźwiękowa/efektowa.
4. Powód do następnej rundy: wyzwanie, odmiana, progres kosmetyczny, rywalizacja z wynikiem — bez przymusowego grindu.
5. Przewidywalne reklamy i pełna grywalność bez ich oglądania.

## Twarde reguły produktu
- Nie przywracaj energii jako limitu sesji, życia, ładowania ani waluty.
- Nie rozbudowuj fabuły i 240 misji, dopóki arena nie potwierdzi satysfakcjonującej pętli.
- Nie wprowadzaj zależności od sieci/SDK do samego trzonu rozgrywki ani opóźniania gry przez consent/telemetrię.
- Nie obiecuj wyników biznesowych; oddziel fakt, pomiar, hipotezę i decyzję.
- Nie używaj zwodniczych reklam, pułapek, dark patterns, manipulacji dziećmi ani sztucznego FOMO.
- Nie publikuj, nie wydawaj pieniędzy, nie podpisuj umów, nie kasuj zapisów użytkowników i nie zmieniaj infrastruktury produkcyjnej bez wyraźnej zgody właścicielki.
- Nie implementuj płatności webowych tylko dlatego, że model biznesowy je przewiduje; weryfikuj platformę i jej regulamin.

## Granice modułów — kontrakt docelowy (mapowanie zweryfikuj w kodzie)
`arena`: transient run, wynik, rywale, wzrost, pickupy, finał → API jawnego końca rundy.
`districts`: misje, kampania, stan dzielnic, cele → oddzielny zapis.
`profile/cosmetics`: wspólne opcjonalnie skiny, statystyki i ustawienia — z określonymi kluczami.
`ads`: dostawcy odizolowani adapterem portalu, asynchroniczni, fail-open.
`telemetry`: zdarzenia anonimowe/oparte o zgodę według wymogów; nigdy nie decydują o mechanice.
`debug`: tylko dev/test, nie trafia do publicznego buildu; nie może modyfikować produkcyjnego leaderboardu.

## Konwencja pracy
- Najpierw odkryj strukturę repo, skrypty i testy; nie zgaduj nazw plików ani API.
- Małe, odwracalne zmiany, testy regresji, zapis dowodów i metryk before/after.
- Kontrakt wygrywa z ogólnymi poradami, chyba że jawna decyzja właścicielki go zmieni.

## Pierwszy krok każdej serii prac
Przed rozwojem nowych feature’ów wykonaj `P00-CORE` i oceń osobno `P00-TOOLS` według `PREFLIGHT_GATES.md` i zachowaj rzeczywisty raport testów. Bramka CORE z wynikiem FAIL wymaga naprawy przed rozwojem niepowiązanych funkcji; brak panelu TOOLS nie blokuje samodzielnie napraw FTUE, ale uniemożliwia gotowość do wydania. P00 nie jest certyfikatem gry — po kolejnych zmianach ponawiaj dotknięte testy.

## R5 — dwa odrębne wskaźniki
**R5 od wejścia:** gracz nadal aktywny/obecny w grze po 300 sekundach czasu rzeczywistego od wejścia do strony (z jawną definicją widoczności i kwalifikacji). **300 s aktywnej rozgrywki:** suma czasu symulacji faktycznie w gameplayu, bez pauz/reklam/tła. Nigdy nie nazywaj drugiego wskaźnika pierwszym ani nie twierdź, że telemetria jest reprezentatywna bez zbadania wpływu zgód i utraty sesji.

## Zabezpieczenia wykonawcze v1.3
Cel nie uzasadnia masowego refaktoru bez checkpoints. P00 dziel na diagnostykę oraz pojedyncze patche (`CHANGE_SAFETY.md`). `GO_CORE` nie dziedziczy wcześniejszego PASS tylko dzięki identycznemu git HEAD (`EVIDENCE_FRESHNESS.md`); debug console musi zniknąć z produkcyjnego artefaktu (`RELEASE_DEBUG_GUARD.md`). Nie naruszaj zapisów graczy dla poprawienia energii ani wyników R5.

**Status zgłoszony przez właścicielkę:** usunięcie odnawialnej energii, pełna izolacja areny od dzielnic oraz panel testowy są już zrobione. Nie wykonuj tych zadań ponownie podczas P00; najpierw sprawdź rzeczywiste działanie. Brak dowodu w repo nie oznacza automatycznego FAIL funkcji ani PASS — raportuj NOT RUN, dopóki nie ma testu.
