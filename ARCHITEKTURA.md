# Architektura Blatu

## Pliki

- `main.js` — proces główny Electrona: okno, menu, ustawienia (`ustawienia.json` w danych programu), zapis i odczyt blatów, protokół `blat://`, pobieranie obrazów przeciągniętych z przeglądarki, sprawdzanie aktualizacji.
- `preload.js` — most `window.api` między oknem a procesem głównym.
- `renderer/index.html` — układ i style (zmienne kolorów jak w Gapie, jasny i ciemny motyw).
- `renderer/app.js` — tablica: rysowanie, narzędzia, zaznaczanie, cofanie, przyjmowanie obrazów, skróty, `window.blatTest`.
- `renderer/i18n.js`, `renderer/lang/en.js` — napisy (polski jest kluczem, angielski w słowniku).
- `renderer/web-api.js` — zastępczy `api` w pamięci, działa tylko w przeglądarce (do testów).
- `scripts/serve.mjs` — serwer do testów w przeglądarce; `scripts/tlumaczenia.mjs` — sprawdzenie słownika.
- `build/` — ikony i podpisywanie ad hoc na Macu; `.github/workflows/build.yml` — budowanie instalatorów na żądanie (wydanie tworzy zadanie `check`, jeszcze nie jako „latest”; zadania dla Maca i Windows dokładają do niego pliki, a zadanie `latest` oznacza je jako najnowsze dopiero, gdy są w nim instalatory dla Windows i obu Maców — programy nie widzą wydania bez swojego instalatora); `.github/workflows/lockfile.yml` — odświeża `package-lock.json` i wypycha go od razu na `main` (w rozmowach z asystentem często nie ma sieci).

## Tryb bez nawigacji i pełny ekran

Jak w Gapie: Tab dodaje do `body` klasę `bare`, która chowa pasek i listę tablic. Na Macu płótno sięga samej góry okna: przyciski okna pokazują się nad nim tylko przy ruchu myszy (`setWindowButtonVisibility`), a okno przesuwa się za niewidoczny pas 28 px przy górnej krawędzi. Na Windows zostaje pasek 32 px na systemowe przyciski okna. Pełny ekran (⌃⌘F, Ctrl+spacja) włączony z programu od razu chowa interfejs, a po wyjściu przywraca poprzedni stan. Pastylka w prawym górnym rogu pojawia się przy ruchu myszy. Widok przesuwamy o różnicę położenia płótna, żeby obrazy nie przeskakiwały.

## Mazak (element „drawing”)

Kreska to element typu `drawing` (nazwa wspólna z Blatem w przeglądarce): `x, y, w, h` jak inne elementy, punkty `pts` względem `(x, y)` w rozmiarze bazowym `bw × bh` (SVG z `viewBox` i `preserveAspectRatio="none"`, więc skaluje się razem z `w × h`), grubość `sw`, kolor `c` i `parent` — id obrazu, na którym kreskę narysowano (≥ 60% punktów na obrazie, licząc od wierzchu). Kreski przesuwają się, skalują (zmiana rozmiaru, porządkowanie) i usuwają razem z obrazem; przesunięta osobno kreska szuka nowego obrazu. Obszar kreski ma `pointer-events:none`, klikalny jest tylko niewidoczny, szerszy ślad `.hit`, żeby kreska nie zasłaniała obrazu. Warstwy: elementy dostają `z-index` wg (z, kolejność dodania), kreska tuż nad swoim obrazem. Ślad `.hit` ma ok. 12 px na ekranie i odświeża się po przybliżeniu; kreska przesunięta bez swojego obrazu (myszą lub strzałkami) szuka nowego (`reparent`). Uwaga: Blat starszy niż 0.2.5 nie zna `drawing` — pokaże w miejscu kreski pusty, klikalny prostokąt, a porządkowanie potraktuje kreski jak notatki. Blaty z kreskami otwieramy więc tylko w 0.2.5 i nowszych (aktualizacja przychodzi sama).

## Ikona

Źródło to `projekt/logo/blat.svg` (wypchnięta kratka na #FF6B1A, wspólna rodzina z Gapą i Modo). `build/icon.png` (1024 px, kwadrat 824 px według siatki Apple), `build/icon-win.png` (1024 px, bez marginesu, tak jak w Gapie — inaczej w menu Start ikona wychodzi mniejsza od ikon Gapy i Modo) i `renderer/favicon.png` (64 px) renderujemy z niego przez `rsvg-convert`.

## Format tablicy

Tablice leżą w `Dokumenty/Blat/`. Każda to folder `<Nazwa>.blat`:

```
board.json   { v:1, name, items:[…], view:{x,y,z}, modified }
board.json.bak   poprzednia wersja (gdy board.json jest uszkodzony, wczytujemy ją)
img/         <id>.<ext> (pełny obraz) i <id>-m.webp (miniatura, gdy obraz ma więcej niż 768 px)
```

Element ma `id, type, x, y, w, h, z` oraz zależnie od typu `img:{full, thumb, w, h, src}`, `text` albo `name`. Usunięte obrazy sprzątamy z `img/`, gdy okno przechodzi do innego blatu (`images-prune`), a nie przy każdym usunięciu, żeby cofnięcie w trakcie pracy wciąż miało pliki. Zostają też pliki obrazów w schowku (wycięte) i pliki właśnie zapisywane przez trwający import.

### Zapis

Autozapis wysyła sam JSON. Proces główny zapisuje go do pliku tymczasowego o niepowtarzalnej nazwie, robi `fsync`, odkłada poprzednią wersję jako `board.json.bak` i podmienia plik. Zapisy jednego blatu idą w kolejce, nigdy dwa naraz. Na Windows podmiana bywa chwilowo odrzucana (OneDrive, antywirus) — wtedy kilka prób, a nieudany zapis okno ponawia samo po 2 s. Zapis nie tworzy folderu blatu: blat przeniesiony do kosza nie wraca. Przy zamykaniu okna, przy ⌘Q, wylogowaniu i wyłączeniu komputera (`before-quit`) oraz przed instalacją aktualizacji proces główny prosi okno o zapis ostatnich zmian i widoku (najpierw kończy edycję notatki albo nazwy) i czeka na potwierdzenie, najwyżej 3 s. Gdy zapis się nie uda, okno zostaje otwarte z komunikatem, a drugie zamknięcie w ciągu 20 s zamyka bez zapisu (później okno znów jest pytane o zapis); aktualizacja się wtedy nie instaluje. Nazwa blatu to nazwa folderu: `board-load` nadpisuje nią pole `name` z `board.json`. Gdy folder blatu zniknie (kosz, odłączony dysk, OneDrive), zmiany czekają w oknie z trwałym napisem, a zapis próbuje co 10 s. Zmiana nazwy blatu dotyczy blatu otwartego w chwili jej rozpoczęcia; przełączenie blatu czeka, aż się skończy. Import kilku obrazów kończy się zawsze w blacie, na którym się zaczął, nawet jeśli w trakcie przełączono blat (wtedy dopisuje go proces główny przez `board-append`, w tej samej kolejce co zapisy i odczyty tego blatu).

Folder zamiast jednego pliku pozwala zapisywać po każdej zmianie sam lekki JSON. Wysłanie tablicy komuś to spakowanie folderu.

## Rysowanie

Każdy element to zwykły `div` w warstwie przesuwanej transformacją (`translate` i `scale`). Przesuwanie i przybliżanie zmienia jedną transformację, więc nie przerysowuje elementów. Po zatrzymaniu przybliżania albo przesuwania podmieniamy miniatury na pełne obrazy tam, gdzie obraz na ekranie przekracza 720 px **fizycznych** (na ekranie Retina to już 360 px CSS), ale tylko dla obrazów na ekranie albo w pasie pół ekranu wokół niego; obrazy dalej wracają do miniatury.

Cofanie trzyma migawki listy elementów (do 120 kroków). To proste i wystarcza, dopóki tablice mają setki, a nie dziesiątki tysięcy elementów.

## Kopiowanie do innych programów

⌘C / ⌘X (i „Kopiuj” / „Wytnij” w menu) zapisuje do schowka tekst-znacznik kopii Blatu, jak dotąd. Gdy w kopii jest obraz, Blat zapamiętuje go (`clipMark`) i zapisuje do schowka systemu **sam obraz, bez tekstu** (`clipFlush`) — sekundę po kopii albo wcześniej, gdy okno traci fokus (przejście do innego programu), a także przy zamykaniu okna (po zapisie blatu, najwyżej 1,5 s, żeby całość zmieściła się w 3 s procesu głównego). Word, Notatki czy pola tekstowe w Chrome nie wklejają więc znacznika zamiast obrazu. Każda kopia, która naprawdę coś zapisuje (także zwykły tekst w notatce, polu albo zaznaczony tekst), podbija `clipGen` i unieważnia starszy obraz; puste ⌘C nic nie unieważnia.

Schowek mieści jeden obraz: idzie pierwszy obraz kopii (z zaznaczenia albo z ramki), sam plik, bez kresek mazaka. JPEG i PNG proces główny czyta z pliku (`clip-write`, nazwa przez `imgName`, tylko z folderu blatu). Gdy się nie uda albo wymiary nie zgadzają się z Blatem (JPEG w CMYK, 16 bitów, obrót z EXIF), obraz dekoduje okno i przysyła PNG — tak samo dla WebP i GIF, których Windows nie odczyta. PNG z okna: do 150 MB i do 8192×8192 px, wymiary sprawdzane w nagłówku przed dekodowaniem. Obrót zdjęcia o 180° z EXIF (te same wymiary) nie jest wykrywany.

Po zapisie proces główny pamięta odcisk obrazu w schowku: wymiary i SHA-1 całej bitmapy (liczone tylko przy zgodnych wymiarach). Przy wklejaniu w Blacie, gdy w schowku nie ma tekstu, a jest obraz, `clip-ours` porównuje odciski — ale tylko gdy obraz zapisała bieżąca kopia (`clipWrittenGen`). Zgodny znaczy własną kopię (wraca kopia Blatu z notatkami i ramkami); niezgodny albo stary nasz obraz przywrócony z historii schowka — zwykły import.

## Przyciąganie, skalowanie wielu i wyrównywanie

Przyciąganie jest przeniesione 1:1 z Blatu w przeglądarce (`snapMove`, `spacingSnap`, `resizeBox`, próg 6 px na ekranie): przesuwany element (albo cała przesuwana grupa) przyciąga się krawędziami i środkiem do linii innych elementów widocznych na ekranie oraz do równych odstępów w rzędzie lub kolumnie; zmiana rozmiaru przyciąga prawy dolny róg. Linie pomocnicze rysujemy w warstwie `#guides` w świecie, o grubości 1 px na ekranie. Cele i odstępy liczymy raz na przeciąganie (`snapCache`), bo przy setkach obrazów na ekranie liczenie odstępów (n²) przy każdym ruchu myszy byłoby za wolne. ⌥ / Alt w trakcie przeciągania wyłącza przyciąganie.

Przy kilku zaznaczonych jest wspólna ramka `#gbox` z uchwytem: skaluje wszystko naraz (z zawartością ramek i kreskami mazaka) od lewego górnego rogu, z zachowaniem proporcji.

Wyrównywanie (`alignSel`) działa na jednostkach: ramka razem z zawartością albo pojedynczy obraz lub notatka; kreski jadą za swoim obrazem. Sposoby: do lewej, prawej, góry, dołu, do osi pionowej i poziomej, równe odstępy (skrajne elementy zostają, potrzebne co najmniej trzy), wspólna wysokość i szerokość (mediana zaznaczonych, proporcje obrazów zostają, elementy w rzędzie zachowują odstępy). Każde wyrównanie to jeden krok cofania i płynny przejazd (`glide`).

Płótno (`main`) nie może się przewijać: fokus pola tekstowego przy krawędzi przewijał je mimo `overflow:hidden` i współrzędne kursora rozjeżdżały się z elementami — nasłuch `scroll` zawsze wraca na zero.

## Przyjmowanie obrazów

- Przeciągnięcie plików z dysku, z Gapy albo z Findera i Eksploratora.
- Przeciągnięcie obrazu z przeglądarki (adres pobiera proces główny przez `net.fetch`, bo okno blokuje CORS; tylko obrazy, do 100 MB).
- Wklejanie ze schowka.
- Później: wysłanie widoku z Modo i z Gapy bez przeciągania.

Duże obrazy zmniejszamy do 4096 px i zapisujemy jako WebP; mniejsze JPG, PNG, WebP i GIF zostają w oryginale.

## Bezpieczeństwo okna

Okno działa w piaskownicy (`sandbox`, `contextIsolation`, bez `nodeIntegration`) i widzi tylko `window.api` z `preload.js`. Nie ma wywołania, które czytałoby dowolny plik: obrazy z dysku przychodzą przez przeciągnięcie (`File` w oknie), a nazwy blatów i plików obrazów są oczyszczane, więc nie wychodzą poza folder blatów. Zamiast domyślnego menu Electrona jest własne (na Macu role Electrona: program, File z ⌘W, Edit, View z samym pełnym ekranem ⌃⌘F, Window — wszystkie po angielsku, żeby nie mieszać języków; na Windows żadne, więc nie działa też F11, pełny ekran to Ctrl+spacja). Nie ma więc przeładowania okna ⌘R / Ctrl+R ani narzędzi deweloperskich. Aktualizacja uruchamia instalator dopiero po sprawdzeniu rozmiaru i sumy SHA-256 z wydania GitHuba (pole `digest`; gdy wydanie go nie ma, sprawdzamy sam rozmiar). Pobieranie przerywa się po 30 s bez danych. Błędy aktualizacji idą do okna jako kody i są tłumaczone tam.

## Licencje

Blat ma licencję MIT. Wszystkie zależności służą tylko do budowania i nie trafiają do programu. Trzy pośrednie zależności electron-buildera (`sanitize-filename`, `truncate-utf8-bytes`, `utf8-byte-length`) mają licencję WTFPL lub WTFPL/ISC — z MIT nie ma konfliktu.

## Wspólne z Gapą i Modo

Ten sam wygląd (zmienne kolorów, nagłówek, przyciski okna), ten sam sposób aktualizacji z wydań GitHuba, te same zasady testów w przeglądarce. Programy na razie rozmawiają przez zwykłe przeciąganie plików; wspólny kod przenosimy dopiero, gdy będzie go dużo.

## Sygnały, że trzeba wrócić do tematu

- **Pamięć:** tablica z kilkuset dużymi obrazami zajmuje więcej niż około 1,5 GB albo cofanie zauważalnie zwalnia. Wtedy wirtualizacja elementów poza ekranem albo cofanie oparte na różnicach.
- **Wydajność:** sprawdzian wydajności spada o więcej niż 30% względem tabeli w umiejętności `sprawdzian-wydajnosci`, albo przesuwanie przy 500 obrazach schodzi poniżej 50 klatek. Wtedy rozważamy canvas lub WebGL.
- **Wspólny kod z Gapą:** gdy kopiujemy z Gapy więcej niż dekodery i aktualizację, czas na wspólny pakiet.
- **Synchronizacja z Blatem w przeglądarce:** format jest zgodny w nazwach typów, ale synchronizacja to osobny projekt, nie łatka na wersję desktopową.
