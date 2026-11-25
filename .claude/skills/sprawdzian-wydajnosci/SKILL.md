---
name: sprawdzian-wydajnosci
description: Pomiar płynności Blatu przy 500 obrazach; uruchamiać po zmianach w rysowaniu, wczytywaniu obrazów albo zapisie.
---

# Sprawdzian wydajności

W przeglądarce (patrz `test-w-przegladarce`):

```js
await blatTest.newBoard('Wydajność');
let t = performance.now(); await blatTest.addTest(500, 1600, 1000); const add = performance.now() - t;
blatTest.fit(); const pan = await blatTest.fps(2000);
blatTest.zoom(3); const zoom = await blatTest.fps(2000);
```

`fps(ms)` przez podany czas przesuwa i przybliża widok w każdej klatce i zwraca liczbę klatek na sekundę.

## Wyniki bazowe

Chrome bez okna w kontenerze, renderowanie programowe; liczby służą do porównań, nie oddają szybkości na prawdziwym komputerze.

| data | dodanie 500 obrazów | przesuwanie (fps) | przybliżone ×3 (fps) |
|---|---|---|---|
| 2026-11-22 | 22,1 s (głównie tworzenie obrazów testowych) | 54 | 59 |
| 2026-11-25 | 25,8 s; po dodaniu animacji „sprężyna” (porządkowanie 300 obrazów: 24 ms, przejazd 47 fps) | 53 | 59 |
| 2026-11-25 | 22,0 s; po dodaniu mazaka i kolejności warstw (porządkowanie 300 obrazów: 19 ms, przejazd 52 fps) | 54 | 60 |

## Zasada

Wynik gorszy o więcej niż 30% od ostatniego wiersza albo przesuwanie poniżej 50 fps to sygnał z `ARCHITEKTURA.md`: powiedz o tym Michałowi, zanim pójdziesz dalej. Po świadomej zmianie dopisz nowy wiersz z datą.
