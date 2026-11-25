---
name: wydanie
description: Wydanie nowej wersji Blatu z instalatorami. Tylko na wyraźną prośbę Michała.
---

# Wydanie

Wydajemy **tylko wtedy, gdy Michał o to poprosi**. Zwykłe poprawki commitujemy i wypychamy bez wydania.

1. Upewnij się, że sprawdziany przechodzą, a `node scripts/tlumaczenia.mjs` nie zgłasza braków.
2. Podbij `version` w `package.json` (poprawki: ostatnia cyfra, nowe funkcje: środkowa) i ten sam numer w `package-lock.json` (dwa miejsca: na górze pliku i w `packages[""]`), np. `npm version <wersja> --no-git-tag-version`, a bez sieci ręcznie albo skryptem. Commit „Blat <wersja>”, push. Gdy zmieniają się zależności, odśwież plik blokady workflowem `package-lock.json` (`gh api repos/michallenczewski/blat-app/actions/workflows/lockfile.yml/dispatches -f ref=main`).
3. Uruchom budowanie:
   `gh api repos/michallenczewski/blat-app/actions/workflows/build.yml/dispatches -f ref=main -f 'inputs[os]=oba'`
   (`win` albo `mac`, jeśli Michał potrzebuje tylko jednego systemu).
4. Poczekaj na koniec (`gh run list -R michallenczewski/blat-app -L 1`). Workflow tworzy wydanie „Blat <wersja>” z plikami `Blat-<wersja>-win-x64.exe` i `Blat-<wersja>-mac-<arm64|x64>.dmg`, a dla Maca także `Blat-<wersja>-mac-<arm64|x64>.zip` (sam program, bez obrazu dysku). Nie zmieniaj tych nazw i nie oznaczaj wydania jako szkic ani wersja wstępna, bo program przestanie znajdować aktualizacje.
5. Jeśli Michał chce instalator od razu: pobierz plik z wydania przez `gh api -H "Accept: application/octet-stream" repos/michallenczewski/blat-app/releases/assets/<id>`, wyślij go w rozmowie, a na komputer z Windows zapisz do `Pobrane`.
