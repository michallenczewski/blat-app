# Architektura Blatu

## Pliki

- `main.js` — proces główny Electrona: okno, ustawienia (`ustawienia.json` w danych programu), zapis i odczyt tablic, protokół `blat://`, sprawdzanie aktualizacji.
- `preload.js` — most `window.api` między oknem a procesem głównym.
- `renderer/index.html` — układ i style (zmienne kolorów jak w Gapie, jasny i ciemny motyw).
- `renderer/app.js` — tablica: rysowanie, narzędzia, zaznaczanie, cofanie, przyjmowanie obrazów, skróty, `window.blatTest`.
- `renderer/i18n.js`, `renderer/lang/en.js` — napisy (polski jest kluczem, angielski w słowniku).
- `renderer/web-api.js` — zastępczy `api` w pamięci, działa tylko w przeglądarce (do testów).
- `scripts/serve.mjs` — serwer do testów w przeglądarce; `scripts/tlumaczenia.mjs` — sprawdzenie słownika.
- `build/` — ikony i podpisywanie ad hoc na Macu; `.github/workflows/build.yml` — budowanie instalatorów na żądanie.

## Tryb bez nawigacji i pełny ekran

Jak w Gapie: Tab dodaje do `body` klasę `bare`, która chowa pasek i listę tablic. Na Macu płótno sięga samej góry okna: przyciski okna pokazują się nad nim tylko przy ruchu myszy (`setWindowButtonVisibility`), a okno przesuwa się za niewidoczny pas 28 px przy górnej krawędzi. Na Windows zostaje pasek 36 px na systemowe przyciski okna. Pełny ekran (⌃⌘F, Ctrl+spacja) włączony z programu od razu chowa interfejs, a po wyjściu przywraca poprzedni stan. Pastylka w prawym górnym rogu pojawia się przy ruchu myszy. Widok przesuwamy o różnicę położenia płótna, żeby obrazy nie przeskakiwały.

## Ikona

Źródło to `projekt/logo/blat.svg` (wypchnięta kratka na #FF6B1A, wspólna rodzina z Gapą i Modo). `build/icon.png` (1024 px, kwadrat 824 px według siatki Apple), `build/icon-win.png` (1024 px, bez marginesu, tak jak w Gapie — inaczej w menu Start ikona wychodzi mniejsza od ikon Gapy i Modo) i `renderer/favicon.png` (64 px) renderujemy z niego przez `rsvg-convert`.

## Format tablicy

Tablice leżą w `Dokumenty/Blat/`. Każda to folder `<Nazwa>.blat`:

```
board.json   { v:1, name, items:[…], view:{x,y,z}, modified }
img/         <id>.<ext> (pełny obraz) i <id>.t.webp (miniatura)
```

Element ma `id, type, x, y, w, h, z` oraz zależnie od typu `img:{full, thumb, w, h, src}`, `text` albo `name`. Usunięte obrazy sprzątamy z `img/` przy otwieraniu tablicy (`images-prune`), żeby cofnięcie w trakcie pracy wciąż miało pliki.

Folder zamiast jednego pliku pozwala zapisywać po każdej zmianie sam lekki JSON. Wysłanie tablicy komuś to spakowanie folderu.

## Rysowanie

Każdy element to zwykły `div` w warstwie przesuwanej transformacją (`translate` i `scale`). Przesuwanie i przybliżanie zmienia jedną transformację, więc nie przerysowuje elementów. Po zatrzymaniu przybliżania podmieniamy miniatury na pełne obrazy tam, gdzie obraz na ekranie przekracza 720 px.

Cofanie trzyma migawki listy elementów (do 120 kroków). To proste i wystarcza, dopóki tablice mają setki, a nie dziesiątki tysięcy elementów.

## Przyjmowanie obrazów

- Przeciągnięcie plików z dysku, z Gapy albo z Findera i Eksploratora.
- Przeciągnięcie obrazu z przeglądarki (adres pobierany przez `fetch`).
- Wklejanie ze schowka.
- Później: wysłanie widoku z Modo i z Gapy bez przeciągania.

Duże obrazy zmniejszamy do 4096 px i zapisujemy jako WebP; mniejsze JPG, PNG, WebP i GIF zostają w oryginale.

## Wspólne z Gapą i Modo

Ten sam wygląd (zmienne kolorów, nagłówek, przyciski okna), ten sam sposób aktualizacji z wydań GitHuba, te same zasady testów w przeglądarce. Programy na razie rozmawiają przez zwykłe przeciąganie plików; wspólny kod przenosimy dopiero, gdy będzie go dużo.

## Sygnały, że trzeba wrócić do tematu

- **Pamięć:** tablica z kilkuset dużymi obrazami zajmuje więcej niż około 1,5 GB albo cofanie zauważalnie zwalnia. Wtedy wirtualizacja elementów poza ekranem albo cofanie oparte na różnicach.
- **Wydajność:** sprawdzian wydajności spada o więcej niż 30% względem tabeli w umiejętności `sprawdzian-wydajnosci`, albo przesuwanie przy 500 obrazach schodzi poniżej 50 klatek. Wtedy rozważamy canvas lub WebGL.
- **Wspólny kod z Gapą:** gdy kopiujemy z Gapy więcej niż dekodery i aktualizację, czas na wspólny pakiet.
- **Synchronizacja z Blatem w przeglądarce:** format jest zgodny w nazwach typów, ale synchronizacja to osobny projekt, nie łatka na wersję desktopową.
