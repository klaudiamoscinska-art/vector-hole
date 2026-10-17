# Techniczne wzorce wdrożenia — adaptuj po rozpoznaniu repo

**Uwaga:** Poniższe fragmenty są wzorcami, a nie gotowym kodem opartym na obecnych plikach Vertical Hole. Przed użyciem dostosuj API do aktualnego SDK i przetestuj na portalu.

## 1. Niezależne stany gry

```js
// Przykładowy podział odpowiedzialności, bez narzucania nazw klas/pliku.
const application = {
  mode: 'menu', // 'arena' | 'districts' | 'menu'
  settings: { soundEnabled: true },
  cosmetics: { selectedSkin: 'default' },
  arena: null,    // transient state; new each start
  districts: null // separate persisted progress
};

function startArena(seed) {
  application.arena = createArenaRun({ seed });
  application.mode = 'arena';
  // Never check district unlocks, energy, campaign upgrades or entry tickets here.
}
```

## 2. Lifecycle, SDK, pauza i reklamy — kontrakt BEZ automatycznego resume

**Nie kopiuj generycznego `finally { resumeSimulation(); gameplayStart(); }`.** Zakończenie reklamy albo `focus` NIE uprawniają samoistnie do wznowienia: gracz mógł ręcznie spauzować, wyjść do menu, zmienić rundę albo obrócić telefon.

Maszyna stanów (adaptuj do repo; to schemat, nie gotowy adapter):

```js
const lifecycle = {
  mode: 'menu',        // 'menu' | 'arena' | 'districts'
  userWantsPlay: false, // świadome kliknięcie Start/Kontynuuj
  manualPause: false,
  hidden: false,
  orientationBlocked: false,
  adInProgress: false,
  transitionToken: 0
};
function canPlay(s) {
  return ['arena', 'districts'].includes(s.mode) && s.userWantsPlay &&
    !s.manualPause && !s.hidden && !s.orientationBlocked && !s.adInProgress;
}
// Po każdej zmianie przyczyn pauzy przelicz stan; zmiany są idempotentne.
// Włącz symulację i input tylko po przejściu !canPlay → canPlay.
// Wysyłaj gameplayStart/Stop TYLKO przy właściwej zmianie stanu
// i tylko gdy kontrakt danego portalu tego wymaga (np. rozbieżna obsługa focus).
// Zmiana trybu / nowa runda unieważnia starsze async tokeny i callbacki reklam.
```

1. **Poki:** `commercialBreak()` wyłącznie przy naturalnym wyjściu ze stanu pauzy/przerwy, gdy gracz zmierza z powrotem do gameplayu; `gameplayStop` → `commercialBreak` → `gameplayStart` *po rzeczywistym wznowieniu*. `rewardedBreak` tylko po opt-in. Żadnych eventów SDK w trakcie reklamy. Nie każda opportunity kończy się emisją reklamy.
2. **CrazyGames:** obsłuż niezależną, platformową semantykę `requestAd('midgame'|'rewarded', callbacks)`, w tym `adStarted`, `adError`, `adFinished`, brak fill. Dla CrazyGames nie wywołuj nieuzasadnionych `gameplayStart/Stop` przy samej zmianie focusu — sprawdź aktualny kontrakt portalu.
3. Przy reklamie wycisz audio, zablokuj wejście i zatrzymaj zegar; przy `adError`/braku SDK zwolnij blokadę *reklamy*, ale nie kasuj innych przyczyn pauzy. Użytkownik może nadal wymagać kliknięcia Kontynuuj. Przyznaj rewarded tylko po pozytywnym wyniku właściwego SDK, jeden raz na identyfikator próby.
4. Zachowuj `transitionToken` i identyfikator rundy w callbackach; ignoruj stare callbacki po restarcie lub przejściu do innego trybu. Nie emituj podwójnych startów/stóp. Audio wznowić tylko przy `canPlay`, włączonym dźwięku i zgodnie z autoplay/gestem.
5. Testy obowiązkowe: reklama sukces/błąd/no-fill, ukrycie karty podczas reklamy, pauza ręczna, menu podczas reklamy, zmiana orientacji, zamknięcie iframe, adblock, callback po nowej rundzie; potwierdź brak automatycznego resume i utraty nagrody/duplikacji.

Oficjalne źródła do sprawdzenia przy implementacji:
https://developers.poki.com/guide/sdk-overview ; https://developers.poki.com/guide/requirements-quality ;
https://docs.crazygames.com/sdk/video-ads/ ; https://docs.crazygames.com/sdk/game/

Patrz także: `ARENA_DISTRICT_CONTRACT.md`, `PREFLIGHT_GATES.md`.

## 3. Izolowany debug build

- Produkcja nie może zawierać *implementacji* panelu, a nie tylko przycisku do niego.
- Dev build może mieć `const DEBUG_BUILD = true` zastępowane w czasie budowania lub osobny `index.dev.html`. Przy statycznej stronie bez bundlera preferuj osobny dev entrypoint i listę assetów; zapewnij, że produkcyjny `index.html` nie ładuje debug JS.
- Oddziel klucze: `vh:dev:v2:*` od `vh:prod:v2:*`. Nie dopuszczaj do odczytu/zapisu prod danych z dev, chyba że jawna migracja i potwierdzenie.
- Udostępnienie dev buildu pod adresem sieciowym nie jest równoznaczne z autoryzacją dostępu; służy do prywatnego testu w zaufanym środowisku. Nie hostuj test panelu publicznie bez dodatkowej autoryzacji.

## 4. Efekty i pełny czas — WYŁĄCZNIE we właściwym trybie

**Zakaz wstrzykiwania kampanijnego magnesu do `createArenaRun`.** Oferta „magnes na całą misję” należy do dzielnic, jeżeli katalog produktu tak ją klasyfikuje; czas kampanijnej misji nie jest domyślnie długością areny. Nazwy niżej są pseudokodem — najpierw zmapuj prawdziwe API.

```js
// Schemat testu DZIELNIC (nie kopiuj do produkcji bez mapowania repo).
const mission = createDistrictMission({ seed: 123, districtUpgrades: ['magnet_full_mission'] });
const maxSteps = getExpectedMissionTimeLimitSteps(mission); // z prawdziwego test-fixture; NIE czas areny
for (let step = 0; step < maxSteps && mission.active; step++) {
  assert(mission.hasEffect('magnet'));       // przed końcem właściwej misji
  mission.update(100);                       // również sprawdź pauzę/reload
}
assert(!mission.active);                      // inaczej FAIL, nie pętla bez końca

// Schemat testu IZOLACJI (ten sam seed, wejście i stan świata).
const arenaBefore = createArenaRun({ seed: 123 });
applyDistrictPurchase('magnet_full_mission');
const arenaAfter = createArenaRun({ seed: 123 });
assertEqual(getArenaGameplayParameters(arenaAfter), getArenaGameplayParameters(arenaBefore));
// Porównuj także state transitions + wynik deterministycznego replayu, jeśli istnieje.
```

Jeśli repo ma *osobny* produkt `owner=arena`, testuj go oddzielnie, z arena-only konfiguracją i bez odczytywania kampanijnego zapisu. Każdy przedmiot ma jawny `owner`, `activation_scope`, `expiry_condition`, `storage_key` oraz dowód regresji `ARENA_DISTRICT_CONTRACT.md`. Jeżeli właściciel jest niejasny, nie zgaduj: wymagane mapowanie/uzgodnienie.

## 5. Osobne pomiary rendrowania
- FPS średni może ukrywać zacięcia: mierz frame-time p50/p95/p99, a minimum klatek na rzeczywistym telefonie.
- `window.devicePixelRatio` nie oznacza CSS px: oblicz koordynaty świata z rect canvasa i rzeczywistego rozmiaru bufora.
- Sprawdź czy warstwa efektów i HUD nie zmienia skali collision bounding boxes.

## 6. Zasady eventów
- Emituj `run_end` jednokrotnie (`idempotency key = run_id`).
- `ad_opportunity` jest stanem możliwości, nie `ad_impression`; w przychodzie preferuj raport SDK zamiast zgadywania.
- Zdarzenie w lokalnym dev buildzie taguj `environment=dev` i filtruj z raportu produkcyjnego.

## 7. Guard produkcyjnego panelu
Moduł panelu ma zawierać rozpoznawalny napis `VH_DEV_CONSOLE_ONLY` i być importowany wyłącznie do osobnego entrypointu dev. Przykładowy `if (query.debug)` i CSS ukrywający przycisk NIE wystarczą. Dla dwóch osobno zbudowanych artefaktów uruchom `scripts/verify_release_artifact.py --dev-build ... --release-build ...`, następnie przeprowadź manual QA w prawdziwej wersji publicznej, w tym dynamiczne importy i local/cloud storage. Zasady `RELEASE_DEBUG_GUARD.md`.
