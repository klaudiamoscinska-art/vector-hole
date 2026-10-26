# CONTENT-1 — audyt 240 misji Kampanii (PRZED / PO)

Wygenerowane z `node qa/content.mjs` (PO: gałąź `content1-campaign-audit-fixes`) i `node qa/content.mjs --root <worktree origin/main 405994f> --label before` (PRZED), ta sama maszyna. Kod misji = numer na ekranie (pozycja w kampanii), id = wewnętrzny identyfikator zapisu.

Każda misja: kontrola statyczna (opisy, ikony, EN) + kontrola prawdziwej planszy (`startCampaignMission`: obiekty celu, obszar, przykrycie, wzrost, postęp +1/+0, odprawa = HUD) + rozgrywka botem-ekspertem w czasie wirtualnym (limit misji; przy porażce do 3 prób bez limitu) z pomiarem wiru w ramce telefonu 390×844. Bot to nie człowiek: PASS znaczy „dane i plansza spójne, misja do przejścia”, nie „przetestowana ręcznie”.

## Podsumowanie

| | PRZED | PO |
|---|---|---|
| Misje w audycie | 240 | 240 |
| PASS | 75 | 240 |
| ISSUE | 165 | 0 |
| NOT VERIFIED | 0 | 0 |
| misje z problemem: ikona | 157 | 0 |
| misje z problemem: obiekty | 0 | 0 |
| misje z problemem: skala | 66 | 0 |
| misje z problemem: tekst | 0 | 0 |
| misje z problemem: spójność | 0 | 0 |
| misje z problemem: postęp | 0 | 0 |
| misje z problemem: wykonalność | 0 | 0 |
| misje z problemem: EN | 0 | 0 |
| wspólne ikony różnych obiektów (grupy) | 8 | 0 |
| największy wir (krótszy bok telefonu) | 77% | 28% |
| misje z wirem > 30% | 66 | 0 |
| bot-ekspert w limicie misji | 220 | 220 |

Wspólne ikony PRZED: class:prop = drzewo = kiosk = latarnia = modul_dachowy = skrzynia ; mostek = wezel = zasilacz ; billboard = class:structure = magazyn = pawilon ; landmark = score ; emiter = klucz_sektora = krysztal = paleta = witryna = znacznik = znacznik_ogrodu ; lustro = pylon ; autobus = ciezarowka = class:heavy = tramwaj ; class:tower = kopula = maszt = wiezowiec

Przejście bota w limicie zmienia się między przebiegami (losowy układ planszy, `Math.random`) — porównanie trudności: `qa/difficulty.mjs` w `run-all`.

## Wszystkie misje (PO; w kolumnie PRZED problemy wykryte na bazie)

| Kod | Id | Dzielnica | Nazwa | Cele (ikona = obiekt) | Obiekty celu na planszy | Bot | Wir max | Wynik | PRZED: problemy |
|---|---|---|---|---|---|---|---|---|---|
| M01 | M01 | plac | Pierwszy apetyt | Pochłoń 3 kapsuły [kapsula] · Urośnij do rozmiaru T2 | 5/3 | ✓ 7.9/45 s | 9% | PASS |  (wir 9%) |
| M02 | M02 | plac | Dobra trasa | Pochłoń 6 elementów ulicznych [class:prop] · Urośnij do rozmiaru T3 | 12/6 | ✓ 16.5/65 s | 12% | PASS | P1 ikona (wir 12%) |
| M03 | M03 | plac | Łańcuch reakcji | Zbuduj combo ×10 · Pochłoń 4 elementy uliczne [class:prop] | 6/4 | ✓ 13.6/55 s | 12% | PASS | P1 ikona (wir 13%) |
| M04 | M25 | plac | Godzina szczytu | Pochłoń 4 samochody [samochod] | 6/4 | ✓ 36.1/95 s | 18% | PASS |  (wir 17%) |
| M05 | M26 | plac | Obce dziury | Pochłoń 2 rywali | — | ✓ 27/60 s | 15% | PASS |  (wir 14%) |
| M06 | M27 | plac | Wyłącznik | Wyłącz 3 węzły [wezel] | 3/3 | ✓ 25.5/100 s | 19% | PASS | P1 ikona (wir 18%) |
| M07 | M28 | plac | Neonowa seria | Zbuduj combo ×8 · Pochłoń 3 samochody [samochod] | 4/3 | ✓ 22.5/55 s | 15% | PASS |  (wir 16%) |
| M08 | M29 | plac | Pawilon na rogu | Pochłoń 2 pawilony [pawilon] | 3/2 | ✓ 25.1/80 s | 21% | PASS | P1 ikona (wir 22%) |
| M09 | M30 | plac | Rekord placu | Zdobądź 900 punktów | — | ✓ 50.1/90 s | 25% | PASS | P1 ikona (wir 25%) |
| M10 | M04 | plac | Pierwszy wielki kęs | Wyłącz 2 węzły [wezel] · Pochłoń neonowe kino [landmark] | 2/2, 1/1 | ✓ 37/80 s | 23% | PASS | P1 ikona (wir 22%) |
| M11 | M05 | park | Pierwszy impuls | Pochłoń 14 fragmentów energii [fragment] | 20/14 | ✓ 18.8/70 s | 10% | PASS |  (wir 10%) |
| M12 | M06 | park | Zielona fala | Pochłoń 12 kapsuł [kapsula] · Zbuduj combo ×6 | 27/12 | ✓ 22.7/50 s | 15% | PASS |  (wir 15%) |
| M13 | M07 | park | Dwie drogi | Pochłoń 3 znaczniki ogrodu [znacznik_ogrodu] | 5/3 | ✓ 22.2/60 s | 14% | PASS | P1 ikona (wir 14%) |
| M14 | M31 | park | Ogrodowe bramy | Pochłoń 8 elementów ulicznych [class:prop] | 11/8 | ✓ 28/60 s | 13% | PASS | P1 ikona (wir 13%) |
| M15 | M32 | park | Pawilony w parku | Pochłoń 3 pawilony [pawilon] | 4/3 | ✓ 33.2/80 s | 23% | PASS | P1 ikona (wir 23%) |
| M16 | M33 | park | Bieg wokół stawu | Zbuduj combo ×12 · Pochłoń 1 pawilon [pawilon] | 2/1 | ✓ 20.2/45 s | 20% | PASS | P1 ikona (wir 20%) |
| M17 | M34 | park | Strażnicy parku | Pochłoń 3 rywali | — | ✓ 42.7/80 s | 17% | PASS |  (wir 16%) |
| M18 | M35 | park | Reklamy w zieleni | Pochłoń 3 billboardy [billboard] | 4/3 | ✓ 33.5/85 s | 24% | PASS | P1 ikona (wir 25%) |
| M19 | M36 | park | Pylony ogrodu | Naładuj 3 pylony [pylon] · Zbuduj combo ×6 | 3/3 | ✓ 14.5/45 s | 17% | PASS | P1 ikona (wir 19%) |
| M20 | M08 | park | Serce ogrodu | Naładuj 3 pylony [pylon] · Pochłoń fontannę [landmark] | 3/3, 1/1 | ✓ 25.1/60 s | 22% | PASS | P1 ikona (wir 22%) |
| M21 | M09 | port | Dostawa energii | Pochłoń 6 skrzyń [skrzynia] · Urośnij do rozmiaru T3 | 12/6 | ✓ 23.3/50 s | 12% | PASS | P1 ikona (wir 12%) |
| M22 | M10 | port | Pełny załadunek | Pochłoń 3 oznaczone palety [paleta] | 4/3 | ✓ 22.2/50 s | 14% | PASS | P1 ikona (wir 14%) |
| M23 | M11 | port | Konwój | Pochłoń 6 pojazdów konwoju [samochod] | 8/6 | ✓ 61.5/80 s | 22% | PASS | P1 ikona (wir 19%) |
| M24 | M37 | port | Magazyny | Pochłoń 3 magazyny [magazyn] | 4/3 | ✓ 38.1/75 s | 24% | PASS | P1 ikona (wir 25%) |
| M25 | M38 | port | Ciężki towar | Pochłoń 1 ciężarówkę [ciezarowka] | 2/1 | ✓ 43.7/70 s | 25% | PASS | P1 ikona (wir 26%) |
| M26 | M39 | port | Nocna zmiana | Pochłoń 6 skrzyń [skrzynia] · Zbuduj combo ×10 | 8/6 | ✓ 17.6/45 s | 14% | PASS | P1 ikona (wir 14%) |
| M27 | M40 | port | Dokerzy | Pochłoń 3 rywali | — | ✓ 41.8/100 s | 20% | PASS |  (wir 22%) |
| M28 | M41 | port | Flota ciężarówek | Pochłoń 3 ciężarówki [ciezarowka] | 4/3 | ✓ 46.7/75 s | 26% | PASS | P1 skala, P1 ikona (wir 31%) |
| M29 | M42 | port | Zasilacze portu | Zbierz 4 zasilacze [zasilacz] · Pochłoń 2 magazyny [magazyn] | 4/4, 3/2 | ✓ 50.1/75 s | 25% | PASS | P1 ikona (wir 26%) |
| M30 | M12 | port | Upadek dźwigu | Zbierz 3 zasilacze [zasilacz] · Pochłoń dźwig [landmark] | 3/3, 1/1 | ✓ 37/65 s | 28% | PASS | P1 ikona (wir 28%) |
| M31 | M13 | galeria | Druga strona | Pochłoń 6 kryształów [krysztal] | 8/6 | ✓ 19.3/50 s | 19% | PASS | P1 ikona (wir 19%) |
| M32 | M14 | galeria | Witryny | Pochłoń 4 witryny [witryna] | 6/4 | ✓ 18.9/60 s | 16% | PASS | P1 ikona (wir 16%) |
| M33 | M15 | galeria | Przed zamknięciem | Pochłoń 4 klucze sektorów [klucz_sektora] | 5/4 | ✓ 34.8/55 s | 17% | PASS | P1 ikona (wir 17%) |
| M34 | M43 | galeria | Ekrany | Pochłoń 4 billboardy [billboard] | 5/4 | ✓ 47.8/75 s | 25% | PASS | P1 ikona (wir 26%) |
| M35 | M44 | galeria | Rój glitcha | Zbuduj combo ×14 · Pochłoń 1 tramwaj [tramwaj] | 2/1 | ✓ 37.7/45 s | 26% | PASS | P1 ikona (wir 27%) |
| M36 | M45 | galeria | Tramwaj sztuki | Pochłoń 2 tramwaje [tramwaj] | 3/2 | ✓ 48.5/75 s | 26% | PASS | P1 ikona (wir 29%) |
| M37 | M46 | galeria | Lustrzane odbicia | Aktywuj 4 lustra [lustro] | 4/4 | ✓ 22/55 s | 19% | PASS | P1 ikona (wir 19%) |
| M38 | M47 | galeria | Kuratorzy | Pochłoń 3 rywali | — | ✓ 60/110 s | 22% | PASS |  (wir 22%) |
| M39 | M48 | galeria | Wielka wystawa | Zdobądź 2500 punktów | — | ✓ 60.2/90 s | 26% | PASS | P1 skala, P1 ikona (wir 48%) |
| M40 | M16 | galeria | Kaskada luster | Aktywuj 3 lustra [lustro] · Pochłoń galerię [landmark] | 3/3, 1/1 | ✓ 43.5/60 s | 28% | PASS | P1 ikona (wir 29%) |
| M41 | M17 | dachy | Nad miastem | Pochłoń 6 modułów dachowych [modul_dachowy] · Urośnij do rozmiaru T3 | 12/6 | ✓ 25.3/55 s | 12% | PASS | P1 ikona (wir 12%) |
| M42 | M18 | dachy | Tor lotu | Pochłoń 14 kapsuł [kapsula] | 18/14 | ✓ 23.4/45 s | 15% | PASS |  (wir 15%) |
| M43 | M19 | dachy | Brama iglicy | Zasil 2 mostki [mostek] · Pochłoń bramę iglicy [landmark] | 2/2, 1/1 | ✓ 35.6/70 s | 28% | PASS | P1 ikona (wir 28%) |
| M44 | M49 | dachy | Parking na dachu | Pochłoń 3 autobusy [autobus] | 4/3 | ✓ 46.5/80 s | 26% | PASS | P1 skala, P1 ikona (wir 31%) |
| M45 | M50 | dachy | Burza | Zbuduj combo ×15 · Pochłoń 1 autobus [autobus] | 2/1 | ✓ 22.9/40 s | 26% | PASS | P1 ikona (wir 26%) |
| M46 | M51 | dachy | Wyścig po dachach | Pochłoń 6 samochodów [samochod] | 8/6 | ✓ 32.8/65 s | 19% | PASS |  (wir 21%) |
| M47 | M52 | dachy | Pierwszy maszt | Pochłoń 1 maszt [maszt] | 2/1 | ✓ 50.8/85 s | 26% | PASS | P1 skala, P1 ikona (wir 37%) |
| M48 | M53 | dachy | Strażnicy dachów | Pochłoń 4 rywali | — | ✓ 80.6/160 s | 26% | PASS | P1 skala (wir 41%) |
| M49 | M54 | dachy | Las anten | Pochłoń 2 autobusy [autobus] · Pochłoń 2 maszty [maszt] | 8/2, 3/2 | ✓ 55.5/65 s | 27% | PASS | P1 skala, P1 ikona (wir 38%) |
| M50 | M20 | dachy | Iglica | Pochłoń iglicę [landmark] | 1/1 | ✓ 45.5/65 s | 28% | PASS | P1 skala, P1 ikona (wir 36%) |
| M51 | M21 | rdzen | Powrót sygnału | Pochłoń 4 emitery [emiter] | 5/4 | ✓ 23.1/45 s | 16% | PASS | P1 ikona (wir 16%) |
| M52 | M22 | rdzen | Czytelny chaos | Zbuduj combo ×12 · Zdobądź 2000 punktów | — | ✓ 32/55 s | 26% | PASS | P1 skala, P1 ikona (wir 34%) |
| M53 | M23 | rdzen | Ostatni obwód | Wyłącz 4 węzły [wezel] · Urośnij do rozmiaru T5 | 4/4 | ✓ 41.3/70 s | 23% | PASS | P1 ikona (wir 28%) |
| M54 | M55 | rdzen | Wieżowce | Pochłoń 2 wieżowce [wiezowiec] | 3/2 | ✓ 47.6/85 s | 27% | PASS | P1 skala, P1 ikona (wir 39%) |
| M55 | M56 | rdzen | Kopuła | Pochłoń 3 ciężkie pojazdy [class:heavy] · Pochłoń 1 kopułę [kopula] | 10/3, 2/1 | ✓ 47.4/65 s | 26% | PASS | P1 skala, P1 ikona (wir 38%) |
| M56 | M57 | rdzen | Wszystkie rozmiary | Urośnij do rozmiaru T6 | — | ✓ 47.5/60 s | 26% | PASS | P1 skala (wir 32%) |
| M57 | M58 | rdzen | Ostatni strażnicy | Pochłoń 5 rywali | — | ✓ 188.5/260 s | 25% | PASS | P1 skala (wir 42%) |
| M58 | M59 | rdzen | Sygnał z wieży | Naładuj 3 pylony [pylon] · Pochłoń 2 maszty [maszt] | 3/3, 3/2 | ✓ 50.2/60 s | 27% | PASS | P1 skala, P1 ikona (wir 41%) |
| M59 | M60 | rdzen | Rekord Rdzenia | Zdobądź 5000 punktów | — | ✓ 48.2/75 s | 27% | PASS | P1 skala, P1 ikona (wir 77%) |
| M60 | M24 | rdzen | Miasto na nowo | Wyłącz 3 węzły [wezel] · Pochłoń rdzeń miasta [landmark] | 3/3, 1/1 | ✓ 50.6/80 s | 28% | PASS | P1 skala, P1 ikona (wir 38%) |
| M61 | M61 | metro | Ostatni kurs | Pochłoń 12 fragmentów energii [fragment] · Urośnij do rozmiaru T2 | 16/12 | ✓ 39.4/60 s | 9% | PASS |  (wir 9%) |
| M62 | M62 | metro | Złote bajty | Złap 3 złote bajty | 4/3 | ✓ 20.6/50 s | 9% | PASS |  (wir 9%) |
| M63 | M63 | metro | Peron w mroku | Pochłoń 8 elementów ulicznych [class:prop] · Urośnij do rozmiaru T3 | 11/8 | ✓ 32.3/70 s | 14% | PASS | P1 ikona (wir 15%) |
| M64 | M64 | metro | Rozkład jazdy | Pochłoń 5 samochodów [samochod] | 7/5 | ✓ 36.6/70 s | 19% | PASS |  (wir 18%) |
| M65 | M65 | metro | Pościg w tunelu | Złap 5 złotych bajtów | 7/5 | ✓ 45.5/75 s | 12% | PASS |  (wir 11%) |
| M66 | M66 | metro | Kontrola biletów | Pochłoń 2 rywali | — | ✓ 30.2/65 s | 15% | PASS |  (wir 16%) |
| M67 | M67 | metro | Iskry na torach | Zbuduj combo ×10 · Pochłoń 5 elementów ulicznych [class:prop] | 7/5 | ✓ 14.9/50 s | 13% | PASS | P1 ikona (wir 13%) |
| M68 | M68 | metro | Skład widmo | Pochłoń 1 tramwaj [tramwaj] | 2/1 | ✓ 60.6/100 s | 26% | PASS | P1 ikona (wir 26%) |
| M69 | M69 | metro | Szczur danych | Złap 6 złotych bajtów · Urośnij do rozmiaru T3 | 8/6 | limit ✗ · bez limitu ✓ | 13% | PASS |  (wir 12%) |
| M70 | M70 | metro | Zwrotnice | Zbierz 4 zasilacze [zasilacz] · Pochłoń 3 samochody [samochod] | 4/4, 4/3 | ✓ 45.1/80 s | 23% | PASS | P1 ikona (wir 23%) |
| M71 | M71 | metro | Tunel serwisowy | Pochłoń 3 magazyny [magazyn] | 4/3 | ✓ 69/90 s | 25% | PASS | P1 skala, P1 ikona (wir 32%) |
| M72 | M72 | metro | Nocny przejazd | Pochłoń 6 samochodów [samochod] | 8/6 | ✓ 23/55 s | 19% | PASS |  (wir 19%) |
| M73 | M73 | metro | Wagon z bajtami | Złap 4 złote bajty · Pochłoń 4 samochody [samochod] | 5/4, 5/4 | ✓ 66/80 s | 23% | PASS |  (wir 23%) |
| M74 | M74 | metro | Konduktorzy | Pochłoń 3 rywali | — | ✓ 77.1/90 s | 21% | PASS |  (wir 19%) |
| M75 | M75 | metro | Rozjazd | Zbuduj combo ×12 · Złap 3 złote bajty | 4/3 | ✓ 28.3/40 s | 14% | PASS |  (wir 15%) |
| M76 | M76 | metro | Głębokie perony | Pochłoń 2 tramwaje [tramwaj] | 3/2 | ✓ 79.1/90 s | 26% | PASS | P1 skala, P1 ikona (wir 38%) |
| M77 | M77 | metro | Iskrownik | Naładuj 4 pylony [pylon] | 4/4 | ✓ 29.6/60 s | 19% | PASS | P1 ikona (wir 21%) |
| M78 | M78 | metro | Ślepy tor | Pochłoń 2 budowle [class:structure] · Złap 4 złote bajty | 3/2, 5/4 | ✓ 55/85 s | 25% | PASS | P1 skala, P1 ikona (wir 31%) |
| M79 | M79 | metro | Godzina zero | Zdobądź 2200 punktów | — | ✓ 48.9/65 s | 26% | PASS | P1 skala, P1 ikona (wir 40%) |
| M80 | M80 | metro | Pociąg towarowy | Pochłoń 3 tramwaje [tramwaj] | 4/3 | ✓ 53.9/85 s | 26% | PASS | P1 skala, P1 ikona (wir 30%) |
| M81 | M81 | metro | Awaria sieci | Wyłącz 5 węzłów [wezel] | 5/5 | ✓ 79.9/110 s | 24% | PASS | P1 ikona (wir 25%) |
| M82 | M82 | metro | Ucieczka z zajezdni | Złap 7 złotych bajtów | 9/7 | ✓ 44/85 s | 12% | PASS |  (wir 12%) |
| M83 | M83 | metro | Ciemna linia | Urośnij do rozmiaru T5 · Pochłoń 1 tramwaj [tramwaj] | 2/1 | ✓ 92.7/105 s | 26% | PASS | P1 skala, P1 ikona (wir 30%) |
| M84 | M84 | metro | Bez świateł | Pochłoń 10 elementów ulicznych [class:prop] · Zbuduj combo ×8 | 12/10 | ✓ 36.4/55 s | 18% | PASS | P1 ikona (wir 16%) |
| M85 | M85 | metro | Kontrolerzy w mroku | Pochłoń 3 rywali | — | ✓ 91.8/115 s | 25% | PASS |  (wir 21%) |
| M86 | M86 | metro | Wieżowiec nad tunelem | Pochłoń 1 wieżowiec [wiezowiec] | 2/1 | ✓ 45.1/65 s | 27% | PASS | P1 skala, P1 ikona (wir 35%) |
| M87 | M87 | metro | Linia zero | Zbuduj combo ×16 · Pochłoń 1 ciężki pojazd [class:heavy] | 2/1 | ✓ 24.7/35 s | 26% | PASS | P1 ikona (wir 28%) |
| M88 | M88 | metro | Zasilanie trakcji | Zbierz 4 zasilacze [zasilacz] · Pochłoń 2 budowle [class:structure] | 4/4, 3/2 | ✓ 88.2/105 s | 25% | PASS | P1 skala, P1 ikona (wir 32%) |
| M89 | M89 | metro | Ekspres bajtów | Złap 8 złotych bajtów · Zdobądź 1500 punktów | 10/8 | ✓ 128.9/135 s | 25% | PASS | P1 ikona (wir 30%) |
| M90 | M90 | metro | Stacja Centralna | Zbierz 3 zasilacze [zasilacz] · Pochłoń Stację Centralną [landmark] | 3/3, 1/1 | ✓ 131.8/135 s | 27% | PASS | P1 skala, P1 ikona (wir 37%) |
| M91 | M91 | bazar | Pierwszy targ | Pochłoń 10 kapsuł [kapsula] | 20/10 | ✓ 20.5/45 s | 14% | PASS |  (wir 13%) |
| M92 | M92 | bazar | Kramy | Pochłoń 8 kiosków [kiosk] | 11/8 | ✓ 21.9/60 s | 13% | PASS | P1 ikona (wir 13%) |
| M93 | M93 | bazar | Złodziej kapsuł | Pochłoń 12 kapsuł [kapsula] | 24/12 | ✓ 22.4/45 s | 18% | PASS |  (wir 15%) |
| M94 | M94 | bazar | Tłum w alejce | Zbuduj combo ×12 · Pochłoń 6 kiosków [kiosk] | 8/6 | ✓ 21.9/45 s | 16% | PASS | P1 ikona (wir 14%) |
| M95 | M95 | bazar | Złoty interes | Złap 4 złote bajty | 8/4 | ✓ 20.4/50 s | 10% | PASS |  (wir 12%) |
| M96 | M96 | bazar | Lampiony | Pochłoń 8 latarni [latarnia] | 11/8 | ✓ 27.4/65 s | 13% | PASS | P1 ikona (wir 13%) |
| M97 | M97 | bazar | Targowanie | Zdobądź 1200 punktów | — | ✓ 44.3/85 s | 25% | PASS | P1 skala, P1 ikona (wir 32%) |
| M98 | M98 | bazar | Fala klientów | Pochłoń 16 kapsuł [kapsula] · Zbuduj combo ×8 | 33/16 | ✓ 17.9/45 s | 17% | PASS |  (wir 17%) |
| M99 | M99 | bazar | Kieszonkowiec | Pochłoń 10 elementów ulicznych [class:prop] | 20/10 | limit ✗ · bez limitu ✓ | 17% | PASS | P1 ikona (wir 16%) |
| M100 | M100 | bazar | Stragan z autami | Pochłoń 6 samochodów [samochod] | 8/6 | ✓ 35.5/65 s | 19% | PASS |  (wir 19%) |
| M101 | M101 | bazar | Nocne pawilony | Pochłoń 3 pawilony [pawilon] | 4/3 | ✓ 33.6/70 s | 24% | PASS | P1 ikona (wir 24%) |
| M102 | M102 | bazar | Wyścig o lampiony | Pochłoń 8 latarni [latarnia] | 16/8 | ✓ 25.2/40 s | 13% | PASS | P1 ikona (wir 13%) |
| M103 | M103 | bazar | Bazarowe combo | Zbuduj combo ×15 · Pochłoń 4 samochody [samochod] | 5/4 | ✓ 15.7/45 s | 19% | PASS |  (wir 17%) |
| M104 | M104 | bazar | Ochroniarze | Pochłoń 3 rywali | — | ✓ 62.5/95 s | 22% | PASS |  (wir 24%) |
| M105 | M105 | bazar | Hurtownia | Pochłoń 4 magazyny [magazyn] | 5/4 | ✓ 40.7/60 s | 25% | PASS | P1 ikona (wir 26%) |
| M106 | M106 | bazar | Gorący towar | Złap 6 złotych bajtów | 8/6 | ✓ 37.8/75 s | 12% | PASS |  (wir 12%) |
| M107 | M107 | bazar | Kontrabanda | Pochłoń 2 ciężarówki [ciezarowka] | 3/2 | ✓ 53/80 s | 26% | PASS | P1 ikona (wir 28%) |
| M108 | M108 | bazar | Złodziej aut | Pochłoń 6 samochodów [samochod] | 12/6 | limit ✗ · bez limitu ✓ | 20% | PASS |  (wir 18%) |
| M109 | M109 | bazar | Licytacja | Zdobądź 2500 punktów | — | limit ✗ · bez limitu ✓ | 26% | PASS | P1 skala, P1 ikona (wir 48%) |
| M110 | M110 | bazar | Labirynt kramów | Pochłoń 12 elementów ulicznych [class:prop] · Zbuduj combo ×10 | 15/12 | ✓ 31.2/55 s | 17% | PASS | P1 ikona (wir 17%) |
| M111 | M111 | bazar | Szybka sprzedaż | Pochłoń 14 kapsuł [kapsula] | 28/14 | ✓ 18.1/30 s | 16% | PASS |  (wir 17%) |
| M112 | M112 | bazar | Ciemna strona bazaru | Pochłoń 6 znaczników [znacznik] | 12/6 | ✓ 19.3/30 s | 19% | PASS | P1 ikona (wir 19%) |
| M113 | M113 | bazar | Złote godziny | Złap 6 złotych bajtów · Zdobądź 1500 punktów | 8/6 | ✓ 66.1/95 s | 25% | PASS | P1 skala, P1 ikona (wir 32%) |
| M114 | M114 | bazar | Mistrzowie handlu | Pochłoń 4 rywali | — | ✓ 42.4/115 s | 23% | PASS |  (wir 21%) |
| M115 | M115 | bazar | Magazyn nocny | Pochłoń 3 ciężkie pojazdy [class:heavy] | 4/3 | ✓ 57/85 s | 26% | PASS | P1 skala, P1 ikona (wir 34%) |
| M116 | M116 | bazar | Bez straty | Pochłoń 12 elementów ulicznych [class:prop] | 15/12 | ✓ 38.1/50 s | 16% | PASS | P1 ikona (wir 15%) |
| M117 | M117 | bazar | Wielka dostawa | Pochłoń 1 wieżowiec [wiezowiec] · Pochłoń 1 ciężki pojazd [class:heavy] | 2/1, 8/1 | ✓ 58.9/70 s | 26% | PASS | P1 skala, P1 ikona (wir 35%) |
| M118 | M118 | bazar | Złodziej bajtów | Złap 6 złotych bajtów | 12/6 | limit ✗ · bez limitu ✓ | 13% | PASS |  (wir 11%) |
| M119 | M119 | bazar | Bazar w ogniu | Zbuduj combo ×18 · Zdobądź 2000 punktów | — | ✓ 34.8/50 s | 25% | PASS | P1 skala, P1 ikona (wir 38%) |
| M120 | M120 | bazar | Brama Bazaru | Naładuj 4 pylony [pylon] · Pochłoń Bramę Bazaru [landmark] | 4/4, 1/1 | limit ✗ · bez limitu ✓ | 11% | PASS | P1 ikona (wir 28%) |
| M121 | M121 | fabryka | Brama fabryki | Pochłoń 8 elementów ulicznych [class:prop] · Urośnij do rozmiaru T3 | 13/8 | ✓ 31.2/55 s | 13% | PASS | P1 ikona (wir 13%) |
| M122 | M122 | fabryka | Taśmociąg | Zbuduj combo ×12 · Pochłoń 8 skrzyń [skrzynia] | 10/8 | ✓ 28.4/65 s | 17% | PASS | P1 ikona (wir 16%) |
| M123 | M123 | fabryka | Pikselowe skrzynie | Pochłoń 10 skrzyń [skrzynia] | 13/10 | ✓ 37.6/55 s | 14% | PASS | P1 ikona (wir 14%) |
| M124 | M124 | fabryka | Nadzorcy | Pochłoń 2 rywali | — | ✓ 40.6/70 s | 14% | PASS |  (wir 13%) |
| M125 | M125 | fabryka | Hala montażowa | Pochłoń 6 samochodów [samochod] | 8/6 | ✓ 37.3/80 s | 19% | PASS |  (wir 18%) |
| M126 | M126 | fabryka | Wadliwa partia | Pochłoń 6 znaczników [znacznik] | 8/6 | ✓ 43.6/45 s | 19% | PASS | P1 ikona (wir 19%) |
| M127 | M127 | fabryka | Wózki widłowe | Pochłoń 2 ciężarówki [ciezarowka] | 3/2 | ✓ 44.1/75 s | 26% | PASS | P1 ikona (wir 28%) |
| M128 | M128 | fabryka | Prasa | Zbierz 4 zasilacze [zasilacz] | 4/4 | ✓ 56.8/65 s | 20% | PASS | P1 ikona (wir 20%) |
| M129 | M129 | fabryka | Iskry spawalnicze | Zbuduj combo ×14 · Pochłoń 6 elementów ulicznych [class:prop] | 8/6 | limit ✗ · bez limitu ✓ | 18% | PASS | P1 ikona (wir 16%) |
| M130 | M130 | fabryka | Magazyn części | Pochłoń 4 magazyny [magazyn] | 5/4 | ✓ 43.1/70 s | 25% | PASS | P1 ikona (wir 22%) |
| M131 | M131 | fabryka | Kontrola jakości | Zdobądź 2500 punktów | — | ✓ 47.8/100 s | 26% | PASS | P1 skala, P1 ikona (wir 50%) |
| M132 | M132 | fabryka | Linia produkcyjna | Pochłoń 3 ciężkie pojazdy [class:heavy] | 4/3 | ✓ 65.5/75 s | 26% | PASS | P1 skala, P1 ikona (wir 32%) |
| M133 | M133 | fabryka | Przegrzanie | Naładuj 4 pylony [pylon] | 4/4 | ✓ 24.1/50 s | 19% | PASS | P1 ikona (wir 14%) |
| M134 | M134 | fabryka | Brygadziści | Pochłoń 3 rywali | — | ✓ 56.8/115 s | 22% | PASS |  (wir 23%) |
| M135 | M135 | fabryka | Złoty prototyp | Złap 5 złotych bajtów | 6/5 | limit ✗ · bez limitu ✓ | 10% | PASS |  (wir 10%) |
| M136 | M136 | fabryka | Maszt nad halą (było: Komin) | Pochłoń 1 maszt [maszt] | 2/1 | ✓ 48.5/75 s | 26% | PASS | P1 skala, P1 ikona (wir 34%) |
| M137 | M137 | fabryka | Bez awarii | Pochłoń 8 samochodów [samochod] | 10/8 | ✓ 31.7/60 s | 20% | PASS |  (wir 20%) |
| M138 | M138 | fabryka | Nocna zmiana w hali | Pochłoń 3 budowle [class:structure] | 4/3 | ✓ 64.1/90 s | 25% | PASS | P1 ikona (wir 28%) |
| M139 | M139 | fabryka | Reaktor pikseli | Urośnij do rozmiaru T6 | — | ✓ 47.9/65 s | 26% | PASS |  (wir 30%) |
| M140 | M140 | fabryka | Roboty | Pochłoń 4 rywali | — | limit ✗ · bez limitu ✓ | 7% | PASS |  (wir 24%) |
| M141 | M141 | fabryka | Rozdzielnia | Zbierz 5 zasilaczy [zasilacz] · Pochłoń 1 ciężki pojazd [class:heavy] | 5/5, 2/1 | ✓ 56.1/90 s | 26% | PASS | P1 skala, P1 ikona (wir 35%) |
| M142 | M142 | fabryka | Hala zero | Pochłoń 4 ciężkie pojazdy [class:heavy] | 5/4 | ✓ 56.6/70 s | 26% | PASS | P1 skala, P1 ikona (wir 35%) |
| M143 | M143 | fabryka | Złomowisko | Pochłoń 5 budowli [class:structure] | 6/5 | ✓ 77.2/100 s | 25% | PASS | P1 ikona (wir 27%) |
| M144 | M144 | fabryka | Precyzja | Zbuduj combo ×16 · Pochłoń 5 samochodów [samochod] | 6/5 | ✓ 23.1/45 s | 18% | PASS |  (wir 17%) |
| M145 | M145 | fabryka | Maszty fabryki (było: Wieże chłodnicze) | Pochłoń 2 maszty [maszt] | 3/2 | limit ✗ · bez limitu ✓ | 27% | PASS | P1 skala, P1 ikona (wir 44%) |
| M146 | M146 | fabryka | Awaria w hali | Zdobądź 3000 punktów | — | ✓ 61.7/95 s | 27% | PASS | P1 skala, P1 ikona (wir 57%) |
| M147 | M147 | fabryka | Wielki piec | Pochłoń 3 ciężkie pojazdy [class:heavy] · Pochłoń 1 wieżę [class:tower] | 9/3, 2/1 | ✓ 46.6/75 s | 26% | PASS | P1 skala, P1 ikona (wir 35%) |
| M148 | M148 | fabryka | Zmiana kierownika | Pochłoń 4 rywali | — | ✓ 126.1/145 s | 26% | PASS | P1 skala (wir 36%) |
| M149 | M149 | fabryka | Ostatnia partia | Pochłoń 3 wieże [class:tower] | 4/3 | ✓ 57.3/80 s | 27% | PASS | P1 skala, P1 ikona (wir 45%) |
| M150 | M150 | fabryka | Serce fabryki | Zbierz 4 zasilacze [zasilacz] · Pochłoń Fabrykę Pikseli [landmark] | 4/4, 1/1 | limit ✗ · bez limitu ✓ | 9% | PASS | P1 skala, P1 ikona (wir 41%) |
| M151 | M151 | zatoka | Hologramowe molo | Pochłoń 6 kryształów [krysztal] | 8/6 | ✓ 20.6/45 s | 19% | PASS | P1 ikona (wir 19%) |
| M152 | M152 | zatoka | Fale | Pochłoń 16 kapsuł [kapsula] | 24/16 | ✓ 20/45 s | 17% | PASS |  (wir 17%) |
| M153 | M153 | zatoka | Latarnie na wodzie | Pochłoń 8 latarni [latarnia] | 11/8 | ✓ 26.9/60 s | 13% | PASS | P1 ikona (wir 14%) |
| M154 | M154 | zatoka | Złote ryby | Złap 5 złotych bajtów | 7/5 | ✓ 32.4/55 s | 10% | PASS |  (wir 10%) |
| M155 | M155 | zatoka | Mgła | Pochłoń 10 elementów ulicznych [class:prop] · Urośnij do rozmiaru T3 | 13/10 | ✓ 38.8/75 s | 18% | PASS | P1 ikona (wir 17%) |
| M156 | M156 | zatoka | Port widm | Pochłoń 2 ciężarówki [ciezarowka] | 3/2 | ✓ 48.1/80 s | 26% | PASS | P1 ikona (wir 28%) |
| M157 | M157 | zatoka | Pasy przelotu | Pochłoń 14 kapsuł [kapsula] | 18/14 | ✓ 19/45 s | 15% | PASS |  (wir 16%) |
| M158 | M158 | zatoka | Rafa danych | Złap 5 złotych bajtów · Pochłoń 6 kryształów [krysztal] | 6/5, 8/6 | ✓ 76.9/105 s | 23% | PASS | P1 ikona (wir 23%) |
| M159 | M159 | zatoka | Przypływ | Zbuduj combo ×14 · Pochłoń 10 kapsuł [kapsula] | 51/10 | ✓ 5.4/45 s | 16% | PASS |  (wir 15%) |
| M160 | M160 | zatoka | Hologramowi strażnicy | Pochłoń 3 rywali | — | limit ✗ · bez limitu ✓ | 7% | PASS |  (wir 20%) |
| M161 | M161 | zatoka | Mgła nad zatoką | Złap 5 złotych bajtów | 6/5 | ✓ 46.5/60 s | 12% | PASS |  (wir 12%) |
| M162 | M162 | zatoka | Lustra na wodzie | Aktywuj 4 lustra [lustro] | 4/4 | ✓ 24.7/50 s | 19% | PASS | P1 ikona (wir 20%) |
| M163 | M163 | zatoka | Odbicia | Aktywuj 5 luster [lustro] · Pochłoń 2 budowle [class:structure] | 5/5, 3/2 | ✓ 57.4/70 s | 25% | PASS | P1 ikona (wir 26%) |
| M164 | M164 | zatoka | Rejs nocny | Pochłoń 10 elementów ulicznych [class:prop] | 13/10 | ✓ 29.6/50 s | 14% | PASS | P1 ikona (wir 15%) |
| M165 | M165 | zatoka | Skarb zatoki | Złap 6 złotych bajtów · Pochłoń 2 budowle [class:structure] | 8/6, 3/2 | ✓ 59.2/80 s | 21% | PASS | P1 ikona (wir 23%) |
| M166 | M166 | zatoka | Statek widmo | Pochłoń 3 ciężkie pojazdy [class:heavy] | 4/3 | ✓ 45.3/90 s | 26% | PASS | P1 skala, P1 ikona (wir 40%) |
| M167 | M167 | zatoka | Prądy | Zbuduj combo ×16 · Złap 4 złote bajty | 5/4 | ✓ 41.6/75 s | 16% | PASS |  (wir 14%) |
| M168 | M168 | zatoka | Latarnicy | Pochłoń 4 rywali | — | ✓ 93.6/145 s | 22% | PASS |  (wir 22%) |
| M169 | M169 | zatoka | Drugi brzeg | Pochłoń 8 kryształów [krysztal] | 10/8 | ✓ 35.5/45 s | 22% | PASS | P1 ikona (wir 22%) |
| M170 | M170 | zatoka | Morze bajtów | Złap 8 złotych bajtów | 10/8 | ✓ 39.8/65 s | 12% | PASS |  (wir 12%) |
| M171 | M171 | zatoka | Sztorm | Zdobądź 3000 punktów | — | ✓ 41.3/90 s | 26% | PASS | P1 skala, P1 ikona (wir 46%) |
| M172 | M172 | zatoka | Głębina | Pochłoń 2 wieże [class:tower] | 3/2 | ✓ 75/95 s | 27% | PASS | P1 skala, P1 ikona (wir 47%) |
| M173 | M173 | zatoka | Fale glitcha | Pochłoń 18 kapsuł [kapsula] | 27/18 | ✓ 23.5/30 s | 18% | PASS |  (wir 18%) |
| M174 | M174 | zatoka | Rejs bez kolizji | Pochłoń 14 kapsuł [kapsula] | 17/14 | ✓ 25.8/40 s | 16% | PASS |  (wir 16%) |
| M175 | M175 | zatoka | Piraci | Pochłoń 4 rywali | — | ✓ 128.8/150 s | 25% | PASS |  (wir 25%) |
| M176 | M176 | zatoka | Zatopiony magazyn | Pochłoń 5 magazynów [magazyn] | 6/5 | ✓ 42.8/85 s | 26% | PASS | P1 skala, P1 ikona (wir 31%) |
| M177 | M177 | zatoka | Hologramowy horyzont | Urośnij do rozmiaru T6 | — | ✓ 58.2/65 s | 26% | PASS | P1 skala (wir 31%) |
| M178 | M178 | zatoka | Wyścig łodzi | Pochłoń 8 kryształów [krysztal] | 16/8 | ✓ 33/35 s | 21% | PASS | P1 ikona (wir 22%) |
| M179 | M179 | zatoka | Ostatni sztorm | Pochłoń 2 wieże [class:tower] · Zdobądź 2500 punktów | 5/2 | ✓ 63.4/105 s | 27% | PASS | P1 skala, P1 ikona (wir 49%) |
| M180 | M180 | zatoka | Latarnia Hologramów | Aktywuj 4 lustra [lustro] · Pochłoń Latarnię Hologramów [landmark] | 4/4, 1/1 | limit ✗ · bez limitu ✓ | 25% | PASS | P1 skala, P1 ikona (wir 50%) |
| M181 | M181 | ogrody | Wejście do ogrodów | Pochłoń 10 drzew [drzewo] | 13/10 | ✓ 30.8/55 s | 15% | PASS | P1 ikona (wir 15%) |
| M182 | M182 | ogrody | Delikatne pąki | Pochłoń 12 kapsuł [kapsula] | 15/12 | ✓ 28.4/55 s | 14% | PASS |  (wir 14%) |
| M183 | M183 | ogrody | Furtki ogrodu | Pochłoń 12 kapsuł [kapsula] | 15/12 | ✓ 20.1/45 s | 14% | PASS |  (wir 15%) |
| M184 | M184 | ogrody | Rytm kwiatów | Zbuduj combo ×16 · Pochłoń 8 drzew [drzewo] | 10/8 | ✓ 21.3/45 s | 17% | PASS | P1 ikona (wir 16%) |
| M185 | M185 | ogrody | Ścieżka bez błędu | Pochłoń 10 elementów ulicznych [class:prop] | 12/10 | ✓ 32.3/45 s | 14% | PASS | P1 ikona (wir 14%) |
| M186 | M186 | ogrody | Zaczarowane latarnie | Pochłoń 8 latarni [latarnia] · Zbuduj combo ×10 | 10/8 | ✓ 22.3/50 s | 16% | PASS | P1 ikona (wir 15%) |
| M187 | M187 | ogrody | Złote nasiona | Złap 6 złotych bajtów | 8/6 | ✓ 30.7/60 s | 11% | PASS |  (wir 11%) |
| M188 | M188 | ogrody | Ogrodnicy | Pochłoń 3 rywali | — | ✓ 84.8/110 s | 21% | PASS |  (wir 21%) |
| M189 | M189 | ogrody | Altany | Pochłoń 4 pawilony [pawilon] | 5/4 | ✓ 29.2/60 s | 25% | PASS | P1 ikona (wir 25%) |
| M190 | M190 | ogrody | Kwietne pylony | Naładuj 5 pylonów [pylon] | 5/5 | ✓ 26.5/45 s | 20% | PASS | P1 ikona (wir 20%) |
| M191 | M191 | ogrody | Wiszące mosty | Zasil 3 mostki [mostek] · Pochłoń 2 budowle [class:structure] | 3/3, 3/2 | ✓ 33.3/60 s | 23% | PASS | P1 ikona (wir 25%) |
| M192 | M192 | ogrody | Szklarnia | Pochłoń 2 ciężkie pojazdy [class:heavy] | 3/2 | ✓ 44.6/70 s | 26% | PASS | P1 skala, P1 ikona (wir 31%) |
| M193 | M193 | ogrody | Pnącza | Zbuduj combo ×18 · Pochłoń 2 budowle [class:structure] | 3/2 | ✓ 14.9/35 s | 21% | PASS | P1 ikona (wir 21%) |
| M194 | M194 | ogrody | Ogród nocą | Pochłoń 12 latarni [latarnia] | 15/12 | ✓ 25.8/65 s | 15% | PASS | P1 ikona (wir 16%) |
| M195 | M195 | ogrody | Kolibry | Złap 8 złotych bajtów | 10/8 | ✓ 56.6/75 s | 12% | PASS |  (wir 12%) |
| M196 | M196 | ogrody | Taras | Urośnij do rozmiaru T5 | — | ✓ 38.8/55 s | 23% | PASS |  (wir 24%) |
| M197 | M197 | ogrody | Bramy wiatru | Pochłoń 10 drzew [drzewo] | 13/10 | ✓ 37.1/55 s | 15% | PASS | P1 ikona (wir 14%) |
| M198 | M198 | ogrody | Strażnicy ogrodów | Pochłoń 4 rywali | — | limit ✗ · bez limitu ✓ | 22% | PASS |  (wir 24%) |
| M199 | M199 | ogrody | Kaskady | Pochłoń 20 kapsuł [kapsula] · Zbuduj combo ×12 | 45/20 | ✓ 20.4/30 s | 19% | PASS |  (wir 19%) |
| M200 | M200 | ogrody | Kwitnące wieże | Pochłoń 1 wieżowiec [wiezowiec] | 2/1 | ✓ 43.2/60 s | 26% | PASS | P1 skala, P1 ikona (wir 36%) |
| M201 | M201 | ogrody | Pyłek glitcha | Pochłoń 4 budowle [class:structure] | 5/4 | ✓ 65.1/100 s | 25% | PASS | P1 ikona (wir 25%) |
| M202 | M202 | ogrody | Złoty ogród | Złap 7 złotych bajtów · Zdobądź 1800 punktów | 9/7 | ✓ 75.5/100 s | 25% | PASS | P1 skala, P1 ikona (wir 50%) |
| M203 | M203 | ogrody | Mgła w ogrodzie | Pochłoń 3 ciężkie pojazdy [class:heavy] | 4/3 | ✓ 72.9/105 s | 26% | PASS | P1 skala, P1 ikona (wir 32%) |
| M204 | M204 | ogrody | Ogrodowy rekord | Zdobądź 3500 punktów | — | ✓ 57.5/80 s | 27% | PASS | P1 skala, P1 ikona (wir 61%) |
| M205 | M205 | ogrody | Wiszące tarasy | Pochłoń 2 wieże [class:tower] | 3/2 | ✓ 45.4/75 s | 26% | PASS | P1 skala, P1 ikona (wir 42%) |
| M206 | M206 | ogrody | Bez jednego płatka | Zbuduj combo ×20 · Złap 5 złotych bajtów | 6/5 | ✓ 32.9/70 s | 19% | PASS |  (wir 17%) |
| M207 | M207 | ogrody | Ogrodnicy nocy | Pochłoń 3 rywali · Złap 4 złote bajty | 5/4 | ✓ 99.7/185 s | 24% | PASS |  (wir 27%) |
| M208 | M208 | ogrody | Lustrzana sadzawka | Aktywuj 5 luster [lustro] · Pochłoń 1 wieżę [class:tower] | 5/5, 2/1 | ✓ 31.7/50 s | 27% | PASS | P1 skala, P1 ikona (wir 36%) |
| M209 | M209 | ogrody | Ostatni rozkwit | Urośnij do rozmiaru T6 · Pochłoń 2 ciężkie pojazdy [class:heavy] | 10/2 | ✓ 40.5/60 s | 26% | PASS | P1 skala, P1 ikona (wir 32%) |
| M210 | M210 | ogrody | Drzewo Światła | Naładuj 4 pylony [pylon] · Pochłoń Drzewo Światła [landmark] | 4/4, 1/1 | limit ✗ · bez limitu ✓ | 5% | PASS | P1 ikona (wir 7%) |
| M211 | M211 | chmura | Logowanie | Pochłoń 14 kapsuł [kapsula] · Zbuduj combo ×10 | 28/14 | ✓ 21.9/35 s | 17% | PASS |  (wir 16%) |
| M212 | M212 | chmura | Pakiety | Złap 7 złotych bajtów | 9/7 | ✓ 50.4/80 s | 12% | PASS |  (wir 12%) |
| M213 | M213 | chmura | Zapora ogniowa | Pochłoń 16 kapsuł [kapsula] | 20/16 | ✓ 23.5/50 s | 17% | PASS |  (wir 17%) |
| M214 | M214 | chmura | Kopia zapasowa | Pochłoń 4 budowle [class:structure] | 5/4 | ✓ 73.6/75 s | 25% | PASS | P1 ikona (wir 27%) |
| M215 | M215 | chmura | Antywirusy | Pochłoń 3 rywali | — | ✓ 50.1/100 s | 23% | PASS |  (wir 25%) |
| M216 | M216 | chmura | Bufor | Zdobądź 3000 punktów | — | ✓ 48.3/75 s | 26% | PASS | P1 skala, P1 ikona (wir 47%) |
| M217 | M217 | chmura | Przeciążenie | Zbierz 5 zasilaczy [zasilacz] | 5/5 | limit ✗ · bez limitu ✓ | 24% | PASS | P1 ikona (wir 20%) |
| M218 | M218 | chmura | Wyciek danych | Pochłoń 6 znaczników [znacznik] | 12/6 | ✓ 20.8/30 s | 19% | PASS | P1 ikona (wir 19%) |
| M219 | M219 | chmura | Chmura burzowa | Pochłoń 3 ciężkie pojazdy [class:heavy] | 4/3 | ✓ 57.1/80 s | 26% | PASS | P1 ikona (wir 28%) |
| M220 | M220 | chmura | Szyfr | Zbuduj combo ×20 · Pochłoń 1 ciężki pojazd [class:heavy] | 2/1 | ✓ 20.4/40 s | 25% | PASS | P1 ikona (wir 26%) |
| M221 | M221 | chmura | Serwery lustrzane | Aktywuj 6 luster [lustro] | 6/6 | ✓ 38/50 s | 21% | PASS | P1 ikona (wir 22%) |
| M222 | M222 | chmura | Złote klucze | Złap 8 złotych bajtów | 10/8 | limit ✗ · bez limitu ✓ | 11% | PASS |  (wir 12%) |
| M223 | M223 | chmura | Zapora | Złap 5 złotych bajtów | 6/5 | ✓ 23.7/45 s | 10% | PASS |  (wir 10%) |
| M224 | M224 | chmura | Administratorzy | Pochłoń 4 rywali | — | ✓ 112.6/150 s | 24% | PASS |  (wir 26%) |
| M225 | M225 | chmura | Wielka migracja | Pochłoń 2 wieże [class:tower] | 3/2 | ✓ 66.6/90 s | 26% | PASS | P1 skala, P1 ikona (wir 43%) |
| M226 | M226 | chmura | Ciemny sektor | Pochłoń 5 budowli [class:structure] | 6/5 | limit ✗ · bez limitu ✓ | 21% | PASS | P1 ikona (wir 28%) |
| M227 | M227 | chmura | Pakiet zero | Pochłoń 18 kapsuł [kapsula] | 27/18 | ✓ 21.4/30 s | 18% | PASS |  (wir 18%) |
| M228 | M228 | chmura | Bezbłędny transfer | Pochłoń 10 samochodów [samochod] | 12/10 | ✓ 51.3/70 s | 21% | PASS |  (wir 23%) |
| M229 | M229 | chmura | Rekord chmury | Zdobądź 4000 punktów | — | ✓ 71.1/85 s | 27% | PASS | P1 skala, P1 ikona (wir 65%) |
| M230 | M230 | chmura | Rdzeń danych | Urośnij do rozmiaru T6 | — | ✓ 77.2/115 s | 26% | PASS | P1 skala (wir 31%) |
| M231 | M231 | chmura | Szybki bajt | Złap 8 złotych bajtów | 16/8 | ✓ 29.3/65 s | 12% | PASS |  (wir 12%) |
| M232 | M232 | chmura | Burza pakietów | Zbuduj combo ×20 · Pochłoń 2 ciężkie pojazdy [class:heavy] | 3/2 | ✓ 37.3/45 s | 26% | PASS | P1 ikona (wir 29%) |
| M233 | M233 | chmura | Główny router | Zbierz 5 zasilaczy [zasilacz] · Pochłoń 1 wieżę [class:tower] | 5/5, 2/1 | ✓ 59.2/75 s | 27% | PASS | P1 skala, P1 ikona (wir 53%) |
| M234 | M234 | chmura | Strażnicy chmury | Pochłoń 5 rywali | — | limit ✗ · bez limitu ✓ | 25% | PASS | P1 skala (wir 41%) |
| M235 | M235 | chmura | Ciemna chmura | Pochłoń 3 wieże [class:tower] | 4/3 | ✓ 89.4/105 s | 27% | PASS | P1 skala, P1 ikona (wir 66%) |
| M236 | M236 | chmura | Ostatni pakiet | Złap 8 złotych bajtów · Pochłoń 3 budowle [class:structure] | 10/8, 4/3 | ✓ 71/90 s | 25% | PASS | P1 ikona (wir 27%) |
| M237 | M237 | chmura | Pełna synchronizacja | Pochłoń 2 wieże [class:tower] · Zdobądź 3000 punktów | 6/2 | ✓ 42.4/85 s | 27% | PASS | P1 ikona (wir 17%) |
| M238 | M238 | chmura | Kaskada serwerów | Pochłoń 4 ciężkie pojazdy [class:heavy] · Pochłoń 2 wieże [class:tower] | 10/4, 3/2 | ✓ 56.5/70 s | 27% | PASS | P1 skala, P1 ikona (wir 42%) |
| M239 | M239 | chmura | Przed restartem | Zbuduj combo ×22 · Urośnij do rozmiaru T6 | — | ✓ 32.6/45 s | 26% | PASS | P1 skala (wir 32%) |
| M240 | M240 | chmura | Serwer Główny | Zbierz 4 zasilacze [zasilacz] · Pochłoń Serwer Główny [landmark] | 4/4, 1/1 | limit ✗ · bez limitu ✓ | 26% | PASS | P1 skala, P1 ikona (wir 48%) |

## Przegląd ręczny (uwagi heurystyczne tekstu)

Audyt zgłasza do przeglądu słowa obiektów i liczebniki w nazwach i zdaniach NELA, których nie ma w celach. Przejrzane ręcznie:

- M02 „Dobra trasa”: NELA mówi „dwóch”, a cele: 6, 3 → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
- M14 „Ogrodowe bramy”: NELA mówi „trzy”, a cele: 8 → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
- M17 „Strażnicy parku”: NELA mówi „czterech”, a cele: 3 → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
- M46 „Wyścig po dachach”: NELA mówi „cztery”, a cele: 6 → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
- M56 „Wszystkie rozmiary”: NELA wspomina „wieżow”, a na planszy brak wiezowiec → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
- M61 „Ostatni kurs”: NELA wspomina „tramwaj|skład|wagon|pociąg”, a na planszy brak tramwaj → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
- M64 „Rozkład jazdy”: NELA wspomina „tramwaj|skład|wagon|pociąg”, a na planszy brak tramwaj → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
- M69 „Szczur danych”: NELA wspomina „tramwaj|skład|wagon|pociąg”, a na planszy brak tramwaj → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
- M72 „Nocny przejazd”: NELA wspomina „tramwaj|skład|wagon|pociąg”, a na planszy brak tramwaj → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
- M73 „Wagon z bajtami”: nazwa wspomina „tramwaj|skład|wagon|pociąg”, a na planszy brak tramwaj → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
- M77 „Iskrownik”: NELA wspomina „tramwaj|skład|wagon|pociąg”, a na planszy brak tramwaj → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
- M85 „Kontrolerzy w mroku”: NELA wspomina „tramwaj|skład|wagon|pociąg”, a na planszy brak tramwaj → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
- M88 „Zasilanie trakcji”: NELA wspomina „tramwaj|skład|wagon|pociąg”, a na planszy brak tramwaj → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
- M91 „Pierwszy targ”: NELA wspomina „kiosk|kram”, a na planszy brak kiosk → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
- M128 „Prasa”: NELA mówi „trzy”, a cele: 4 → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
- M136 „Komin”: nazwa wspomina „komin|chłodni”, a na planszy brak __komin; NELA mówi „trzy”, a cele: 1 → **poprawione: „Maszt nad halą”**
- M144 „Precyzja”: NELA mówi „trzy”, a cele: 16, 5 → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
- M145 „Wieże chłodnicze”: nazwa wspomina „komin|chłodni”, a na planszy brak __komin → **poprawione: „Maszty fabryki”**
- M222 „Złote klucze”: nazwa wspomina „klucz”, a na planszy brak klucz_sektora → bez zmian (zgodne z misją: klimat dzielnicy, liczba bram / skupisk / rywali na planszy albo nazwa miejsca)
