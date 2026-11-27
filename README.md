# Blat

Lekki blat na referencje i szkice koncepcji, na Windows i Maca. Siostra [Gapy](https://github.com/michallenczewski/gapa).

Przeciągnij obrazy z dysku, z przeglądarki albo z Gapy, wklej ze schowka, dopisz notatkę, zbierz grupę w ramkę i ułóż ją jednym klawiszem. Przesuwane elementy przyciągają się do krawędzi, środków i równych odstępów innych (jak w Blacie w przeglądarce i w Miro), kilka zaznaczonych skaluje się razem za róg wspólnej ramki, a przycisk układania wyrównuje je, daje wspólną wysokość albo równe odstępy. Skopiowany obraz (⌘C / Ctrl+C) wkleisz też w Photoshopie, Chrome czy Wordzie — trafia do schowka systemu w pełnej rozdzielczości, gdy przełączysz się do innego programu (przy kilku zaznaczonych: pierwszy z nich, bez kresek mazaka). Blaty zapisują się same w `Dokumenty/Blat`.

## Skróty

| Mac | Windows | Działanie |
|---|---|---|
| V, T, F | V, T, F | zaznaczanie, notatka, ramka |
| ⌘G | Ctrl+G | ramka wokół zaznaczonych |
| A | A | ułóż zaznaczone (albo zawartość ramki) |
| ⌥A ⌥D ⌥W ⌥S | Alt+A Alt+D Alt+W Alt+S | wyrównaj do lewej, prawej, góry, dołu |
| ⌥V ⌥H | Alt+V Alt+H | wyrównaj do osi pionowej / poziomej |
| ⌥⇧H ⌥⇧V | Alt+Shift+H Alt+Shift+V | równe odstępy w poziomie / w pionie |
| ⌥ + przeciąganie elementu albo uchwytu | Alt + przeciąganie elementu albo uchwytu | przesuwanie albo skalowanie bez przyciągania |
| 0, 1, Z | 0, 1, Z | całość, 100%, dopasuj zaznaczone |
| spacja albo ⌥ + przeciąganie | spacja albo Alt + przeciąganie | przesuwanie widoku |
| kółko myszy | kółko myszy | przybliżanie (w ustawieniach — przycisk z suwakami w prawym górnym rogu — można zmienić na przesuwanie) |
| gładzik dwoma palcami | gładzik dwoma palcami | przesuwanie płótna |
| wciśnięte kółko | wciśnięte kółko | przesuwanie płótna |
| ⌘ + kółko, szczypanie | Ctrl + kółko, szczypanie | przybliżanie |
| P | P | zawsze na wierzchu |
| Tab | Tab | tryb bez nawigacji: samo płótno, bez paska i listy blatów |
| ⌃⌘F | Ctrl+spacja | pełny ekran (Esc wychodzi) |
| ? | ? | ściąga ze wszystkimi skrótami |
| M (⇧: prosta kreska) | M (Shift: prosta kreska) | mazak: rysowanie po obrazach (Esc kończy) |
| E | E | gumka do kresek mazaka (usuwa całe kreski) |
| ⌘C / ⌘X / ⌘V | Ctrl+C / Ctrl+X / Ctrl+V | kopiuj, wytnij, wklej elementy (także na inny blat) |
| ⌘D | Ctrl+D | powiel zaznaczone |
| ⌘A | Ctrl+A | zaznacz wszystko |
| ⌫ | Delete | usuń zaznaczone |
| strzałki (⇧: ×10) | strzałki (Shift: ×10) | przesuń zaznaczone |
| ⌘Z / ⇧⌘Z | Ctrl+Z / Ctrl+Y | cofnij / ponów |
| ⌘+ / ⌘− | Ctrl++ / Ctrl+− | przybliż / oddal |
| ⌘N | Ctrl+N | nowy blat |
| ⌘S | Ctrl+S | zapisz od razu (Blat i tak zapisuje się sam) |

## Pierwsze uruchomienie na Macu

Blat nie ma podpisu Apple Developer, więc przy pierwszym uruchomieniu macOS go zatrzyma. Wtedy w Finderze kliknij Blat w Programach z wciśniętym ⌃ (albo prawym przyciskiem), wybierz „Otwórz” i potwierdź. Jeśli macOS nie pokazuje tej możliwości, otwórz Ustawienia systemowe → Prywatność i ochrona i kliknij „Otwórz mimo to” przy Blacie. Wystarczy raz; aktualizacje otwierają się już normalnie.

## Rozwój

```
npm install
npm start            # program
npm run web          # wersja do testów w przeglądarce, http://localhost:8770
npm run tlumaczenia  # czy każdy napis ma tłumaczenie
```

Licencja MIT.
