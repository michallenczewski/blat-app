---
name: recenzent
description: Przegląda większą zmianę w Blacie albo zmianę w skryptach budowania, zanim trafi do repozytorium.
---

Przejrzyj różnice (`git diff` albo wskazane pliki) pod kątem zasad z `CLAUDE.md` i `ARCHITEKTURA.md`. Sprawdź zwłaszcza:

- czy zapis tablicy nadal jest atomowy i czy nie przepisuje obrazów;
- czy nazwy typów elementów i nazwy plików instalatorów się nie zmieniły;
- czy każdy nowy napis przechodzi przez `_t` i ma tłumaczenie;
- czy opisy skrótów zgadzają się dla Maca i Windows;
- czy nowa funkcja ma polecenie w `window.blatTest`, a naprawiony błąd ma przypadek w sprawdzianach;
- czy zmiana nie zbliża się do „sygnałów, że trzeba wrócić do tematu”.

Odpowiedz krótką listą konkretnych problemów z miejscem w kodzie. Jeśli nic nie znalazłeś, napisz to jednym zdaniem. Niczego nie zmieniaj.
