---
name: test-w-przegladarce
description: Jak sprawdzić zmianę w interfejsie Blatu w przeglądarce, bez budowania programu.
---

# Test w przeglądarce

1. Uruchom serwer: `node scripts/serve.mjs` (port 8770, zmienna `PORT` zmienia port). Serwer wyłącza pamięć podręczną, więc odświeżenie zawsze pokazuje świeży kod.
2. Otwórz `http://localhost:8770/` w Chrome przez Playwright z oknem 1400 × 860 i `locale='pl-PL'` (bez tego napisy będą po angielsku).
3. W przeglądarce `renderer/web-api.js` zastępuje `window.api`: tablice i obrazy żyją w pamięci karty. Prawdziwy zapis na dysk (fsync, kopia `.bak`, kolejka), kosz, menu i aktualizacje sprawdzamy tylko w programie.
4. Steruj tablicą przez `window.blatTest` zamiast klikania, gdy to możliwe: `addTest(n, w, h)`, `note(x, y, tekst)`, `select(ids)`, `frame(nazwa)`, `move(dx, dy)`, `arrange()`, `fit()`, `zoom(f)`, `undo()`, `redo()`, `remove()`, `save()`, `newBoard(nazwa)`, `open(nazwa)`, `state()`, `items()`, `selectAll()`, `stroke(punkty, grubość)`, `pen({c, w})`, `eraseAt(x, y)`, `copy()`, `cut()`, `paste()`, `duplicate()`, `bare(v)`, `keys(v)`, `wheelMode(m)`, `tool(t)`, `top(v)`, `theme(m)`, `reorder(±1)`, `resize(id, szerokość)`, `rename(nazwa)`, `trash(nazwa)`, `testBlobs(n, w, h)` (obrazy testowe bez dodawania), `fps(ms)`. Zastępczy `api` ma też `_failSave = n` — tyle następnych zapisów się nie uda (jak odrzucona podmiana pliku na Windows).
5. Na koniec zawsze: `await blatTest.sprawdziany()` ma zwrócić pustą listę, `blatTest.state().errors` też, a w konsoli nie może być błędów strony.
6. Zrzut ekranu sprawdź w jasnym i ciemnym motywie (`page.emulate_media(color_scheme='dark')`), jeśli zmiana dotyczy wyglądu.
