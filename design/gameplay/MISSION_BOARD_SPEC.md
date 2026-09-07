# Vector Hole — Specyfikacja: Obiekty Planszy Misji i Finał Landmarku

> **STATUS: częściowo zaimplementowane (Vector Hole v6).** 6 unikalnych
> landmarków (sekcja 2) gotowe. Sekwencja finału (sekcja 4) w wersji
> uproszczonej — zamiast 4 osobnych stanów jest dodatkowy wybuch cząstek
> przy pożarciu, zgodnie z tym, na co brief wprost pozwalał. Otwarte
> pytania z sekcji 7 (dokładny czas trwania, unikalna animacja per
> dzielnica, dźwięk) pozostają nierozstrzygnięte — nie były potrzebne przy
> uproszczonej wersji. Pełny opis: `docs/VECTRE_V6_PLAN.md` §3.2.

Dokument towarzyszący plikowi `vector_hole_mission_board_finale.svg`.
Źródło zasad: GDD 4.0, sekcje 6 (System Misji), 10 (Asset Bible), 11 (Gameplay UX).

Cel tego dokumentu: dać Claude Code jednoznaczną specyfikację logiki i danych,
której nie da się wyrazić samym plikiem SVG (timing, zasady generatora, hitboxy,
powiązania ze stanem gry).

---

## 1. Kontekst

Plansza misji to plac gry (playfield) jednej misji kampanii (60–120s). Gracz
steruje "dziurą" (core), która pochłania obiekty rosnąc w rozmiarze. Każda
dzielnica ma 4 misje; **misja nr 4 w każdej dzielnicy kończy się pożarciem
landmarku** (boss object) — patrz GDD 6.2 "Boss landmark".

Misje **nie zasilają Core City** — landmark collapse daje monety i unlocki,
nigdy progres Core City (to zastrzeżone wyłącznie dla GRAJ 2:00 i Wyzwania dnia).

---

## 2. Landmarki dzielnic — tabela referencyjna

| Landmark      | Misja | Dzielnica       | Tier | Odblokowuje         |
|---------------|-------|-----------------|------|----------------------|
| Kino          | M04   | Plac Neonów     | T5   | Dzielnica: Park Impulsów |
| Fontanna      | M08   | Park Impulsów   | T5   | Dzielnica: Port Syntez |
| Dźwig         | M12   | Port Syntez     | T5   | Dzielnica: Galeria Glitch |
| Galeria       | M16   | Galeria Glitch  | T5   | Dzielnica: Dachy Prądu |
| Iglica        | M20   | Dachy Prądu     | T5   | Dzielnica: Rdzeń Miasta |
| Rdzeń Miasta  | M24   | Rdzeń Miasta    | T5   | Finał kampanii + kosmetyk finałowy |

Każdy landmark jest wektorową sylwetką w stylu neon-cyan (patrz SVG, sekcja
"LANDMARKI DZIELNIC"). Rdzeń Miasta (M24) używa dodatkowo akcentu żółtego
(`#EFCB63`) jako wizualnego wyróżnika "to jest wielki finał", zgodnie z
zasadą palety: żółty zarezerwowany dla nagród/rzadkich momentów.

---

## 3. Generyczne obiekty planszy (nie-landmarki)

Zasady wspólne dla wszystkich obiektów T1–T4 (latarnia, ławka, samochód,
kiosk, drzewo, skrzynia, portal — patrz osobny plik `vector_hole_asset_bible.svg`
dla pełnego katalogu kształtów):

- **T1** — drobny fragment energii, najliczniejszy, niski hitbox, pochłaniany
  natychmiast niezależnie od rozmiaru rdzenia.
- **T2** — mały obiekt miejski (latarnia, ławka, drzewo, skrzynia).
- **T3** — średni obiekt (samochód, kiosk) — wymaga, by rdzeń osiągnął
  minimalny rozmiar przed pochłonięciem (opcjonalnie, do potwierdzenia
  w balansie).
- **T4** — duża struktura, zwykle cel poboczny lub element sekwencji.
- **T5** — wyłącznie landmarki bossów, patrz sekcja 2.

### Zasady generatora (GDD 6.2 — obowiązkowe, walidować automatycznie)

1. **Reachability** — musi istnieć pełna, przechodnia ścieżka od obiektów
   startowych (T1/T2) do obiektu celu. Generator nie może umieścić celu
   w obszarze odciętym.
2. **Goal density** — w obszarze celu musi być wystarczająco dużo obiektów
   pasujących do celu misji (brak pustych plansz — to był realny problem
   QA w Parku Impulsów, patrz GDD sekcja 11).
3. **Visual binding** — instrukcja celu (tekst + ikona w brief barze) musi
   używać tej samej ikony/koloru co obiekt na planszy. Przykład: jeśli cel
   to "Pochłoń 8 elementów ulicznych", ikona przy tekście = ikona obiektu.
4. **Boss landmark** — misja `.04` w każdej dzielnicy kończy się landmarkiem
   (patrz tabela w sekcji 2).
5. **Safe onboarding** — M01–M03 (pierwsza dzielnica) bez kar za błąd i bez
   chaotycznych, poruszających się przeszkód.

---

## 4. Sekwencja finału landmarku ("Big Eat" → Collapse)

Ta sekwencja odpowiada punktowi Core Game Flow z GDD: `OVERDRIVE → BIG EAT
→ RESULT`. Cztery stany wizualne (patrz SVG, sekcja "SEKWENCJA FINAŁU"):

### Stan 1 — CEL AKTYWNY
- Landmark widoczny na planszy z **ramką narożną + pulsującym obrysem**
  (kolor: różowy `#FF54AD`, zgodnie z systemem oznaczeń celu, GDD 10.4).
- Gracz może swobodnie grać dalej — landmark nie blokuje innych obiektów.

### Stan 2 — ŁADOWANIE / SUB-CEL (jeśli misja tego wymaga)
- Przykład z GDD (M08): "Naładuj 3 pylony i pochłoń fontannę".
- Wizualnie: małe węzły/pylony wokół landmarku zapalają się kolejno
  (kolor żółty `#EFCB63`) w miarę postępu, licznik `X / Y` nad obiektem.
- Dopiero po naładowaniu wszystkich pylonów landmark staje się "jadalny"
  (przechodzi do stanu 3 po dotknięciu przez rdzeń).

### Stan 3 — COLLAPSE
- Trigger: rdzeń gracza dotyka landmarku po spełnieniu warunku z sekcji 2.
- Landmark **rozpada się na fragmenty T1** (te same kształty co zwykłe
  fragmenty energii) rozlatujące się promieniście od centrum landmarku.
- Sugerowany timing: 400–600 ms trwania animacji rozpadu, zanim gra
  przejdzie do stanu 4.
- Efekt dźwiękowy/ekranowy: krótkie screen-shake + flash (do potwierdzenia
  z zespołem VFX — nieopisane w GDD, decyzja implementacyjna).

### Stan 4 — WCHŁONIĘTY
- Rdzeń gracza rośnie (animacja "grow" z Core Game Flow).
- Natychmiast po tej klatce: przejście do ekranu wyniku misji (jeśli to
  była misja `.04/.08/.12/.16/.20`) lub do ekranu finału kampanii (M24).
- Ekran wyniku pokazuje: wynik, monety, unlock nowej dzielnicy / kosmetyku
  finałowego (**nie** progres Core City — to reguła nadrzędna GDD).

---

## 5. Hitboxy i kolizje (do ustalenia z programistą gameplayu)

- Landmark (T5) powinien mieć hitbox **większy niż jego wizualna sylweta**
  o rozsądny margines (sugerowane +10–15%), żeby pochłonięcie było czytelne
  na urządzeniach mobilnych z touch inputem.
- Podczas stanu 2 (ładowanie) landmark **nie powinien być pochłanialny**
  — kolizja z rdzeniem powinna dawać feedback (np. lekkie odbicie / dźwięk
  "zablokowane"), a nie pochłaniać obiekt przedwcześnie.
- Fragmenty T1 powstałe z collapse'u (stan 3) powinny być pochłanialne
  normalnie, jak zwykłe obiekty T1, i liczyć się do wyniku rundy.

---

## 6. Powiązanie ze stanem gry (z GDD 13.1 minimalny model danych)

```
campaignProgress: {
  unlockedDistrictIndex,
  completedMissionIds[],   // np. "M04" po pożarciu Kina
  medalMissionIds[]
}
```

Reguły (GDD 13.2, obowiązkowe):
- `M04` odblokowuje dzielnicę `D02` (Park Impulsów)
- `M08` odblokowuje dzielnicę `D03` (Port Syntez)
- `M12` odblokowuje dzielnicę `D04` (Galeria Glitch)
- `M16` odblokowuje dzielnicę `D05` (Dachy Prądu)
- `M20` odblokowuje dzielnicę `D06` (Rdzeń Miasta)
- `M24` kończy kampanię — **nie** odblokowuje kolejnej dzielnicy (jej nie ma)
- Żadna z misji (w tym landmarki) **nie modyfikuje** `coreCity.progressPercent`

---

## 7. Czego ten dokument NIE rozstrzyga (decyzje do podjęcia)

- Dokładny czas trwania animacji collapse (podany 400–600 ms to sugestia,
  nie twarda specyfikacja z GDD).
- Czy landmark ma własną unikalną animację rozpadu per dzielnica, czy
  wspólny generyczny efekt "collapse" reużywany dla wszystkich sześciu.
- Czy sub-cel "ładowania" (stan 2) dotyczy wszystkich landmarków, czy
  tylko wybranych misji (w GDD explicite opisane tylko dla M08 fontanny
  i M23 "Ostatni obwód" / M19 "Zasil 2 mostki").
- Dźwięk i konkretne wartości screen-shake — nieopisane w GDD, wymaga
  ustalenia z osobą odpowiedzialną za VFX/audio.

Jeśli Claude Code natrafi na którąś z tych niejednoznaczności podczas
implementacji, powinien zapytać zamiast zgadywać — zwłaszcza w kwestii
dokładnego triggera przejścia stan 2 → stan 3.
