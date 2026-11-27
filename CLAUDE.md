# Blat — wskazówki dla asystenta

Blat to lekka tablica na referencje i szkice koncepcji, samodzielny program w języku wizualnym Gapy. Ten plik zawiera tylko zasady Blatu; zasady wspólne dla wszystkich programów Michała (współpraca, interfejs, ikony, wydania, technika) są w `../rodzina/claude/CLAUDE.md` — na Macu wczytują się same jako `~/.claude/CLAUDE.md`; jeśli ich nie widzisz, przeczytaj ten plik. Procedury są w `.claude/skills/`, stali pomocnicy w `.claude/agents/`, opis budowy w `ARCHITEKTURA.md`.

## Współpraca

- W interfejsie i w README mówimy „blat” (blaty, nowy blat), nigdy „tablica”. W kodzie zostają angielskie nazwy (`board`), a po angielsku „board”.
- Animacje, reakcje przycisków, podpowiedzi i okienka: umiejętność `rodzina-interfejs` (wytyczne i wzorzec przycisków leżą w `../rodzina/`). W opisach dla Maca i Windows: Finder / Eksplorator.
- Najważniejsze są szybkość i płynność, także przy setkach obrazów na jednej tablicy.

## Jak pracujemy

- Zmiana w interfejsie: sprawdź ją w przeglądarce (`test-w-przegladarce`) i uruchom `blatTest.sprawdziany()`.
- Zgłoszony błąd najpierw staje się przypadkiem w sprawdzianach, dopiero potem go naprawiamy (`sprawdziany`).
- Zmiana w rysowaniu, wczytywaniu obrazów albo zapisie: zmierz płynność (`sprawdzian-wydajnosci`).
- Nowy napis w interfejsie: `tlumaczenia`.
- Przed większą zmianą przeczytaj `ARCHITEKTURA.md`. Jeśli prośba zbliża się do któregoś z „sygnałów, że trzeba wrócić do tematu”, powiedz o tym Michałowi wprost, zanim zaczniesz.
- Większą zmianę albo zmianę w skryptach budowania daj do przejrzenia agentowi `recenzent`.

## Zasady kodu

- Tablica to folder `<Nazwa>.blat` z plikiem `board.json` i katalogiem `img/`. Autozapis zapisuje tylko JSON, atomowo (plik tymczasowy, potem zmiana nazwy). Obrazów nie przepisujemy przy zapisie.
- Nazwy typów elementów (`image`, `note`, `frame`, później `arrow`, `drawing`) są wspólne z Blatem w przeglądarce. Nie zmieniaj ich.
- Każdy napis w interfejsie przechodzi przez `_t('…')` z polskim kluczem i ma tłumaczenie w `renderer/lang/en.js`.
- Obraz trzymamy w dwóch stopniach: pełny (najwyżej 4096 px) i miniatura (768 px). Pełny wczytujemy dopiero wtedy, gdy obraz na ekranie jest większy niż 720 px fizycznych (na Retinie 360 px CSS) i leży na ekranie albo tuż obok.
- Program sam sprawdza nowe wersje w wydaniach GitHuba (`releases/latest`) i szuka pliku `Blat-<wersja>-win-x64.exe` albo `Blat-<wersja>-mac-<arm64|x64>.dmg`. Nie zmieniaj tych nazw ani nie oznaczaj wydań jako szkic czy wersja wstępna.
- Każda funkcja, którą da się sprawdzić bez myszy, ma polecenie w `window.blatTest`.

## Biblioteki i licencje

- Blat ma licencję MIT. Nowe zależności tylko na licencjach zgodnych z MIT, z krótką notką w `ARCHITEKTURA.md`.
- Dekodery (PSD, EXR i inne) możemy później przenieść z Gapy; wtedy w kodzie zostaje notka, skąd pochodzą.
- `package-lock.json` trzymamy w repozytorium.
