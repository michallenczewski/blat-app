---
name: sprawdziany
description: Lista przypadków, które Blat musi spełniać; jak ją uruchomić i jak dopisać nowy przypadek po zgłoszonym błędzie.
---

# Sprawdziany

Przypadki są w `renderer/app.js`, w metodzie `blatTest.sprawdziany()`. Metoda tworzy osobną tablicę, wykonuje kroki, zwraca listę nazw przypadków, które nie przeszły, i na koniec przenosi tablicę do kosza.

Uruchomienie (w przeglądarce, patrz `test-w-przegladarce`): `await blatTest.sprawdziany()`; pusta lista oznacza, że wszystko działa.

## Zasada

Zgłoszony błąd najpierw staje się przypadkiem: dopisz krok i `ok(warunek, 'krótki opis po polsku')`, sprawdź, że przypadek **nie przechodzi**, dopiero potem napraw kod i sprawdź, że przechodzi. Przypadków nie usuwamy; jeśli zachowanie celowo się zmienia, zmieniamy przypadek i piszemy o tym w opisie commita.

## Obecne przypadki

dodanie obrazów i zapis plików, proporcje obrazu, ramka z nazwą, ramka przesuwa zawartość (także strzałkami), cofanie i ponawianie przesunięcia, notatka z tekstem, układanie do równej wysokości, zapis i ponowne wczytanie, usunięcie i cofnięcie usunięcia, tryb bez nawigacji (chowa pasek i listę, płótno na całą szerokość i do górnej krawędzi na Macu, powrót), ściąga skrótów (otwiera się, mieści w oknie, zamyka się).
