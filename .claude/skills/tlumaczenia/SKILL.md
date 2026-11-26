---
name: tlumaczenia
description: Jak dodać napis do interfejsu Blatu, żeby działał po polsku i po angielsku.
---

# Tłumaczenia

1. W kodzie napis zawsze przez `_t('Polski tekst')`. Polski tekst jest kluczem; nie twórz sztucznych identyfikatorów.
2. Dopisz tłumaczenie do `renderer/lang/en.js` (`window.BLAT_EN`), krótkie i naturalne, w tym samym tonie co reszta.
3. Skróty opisuj osobno dla Maca i Windows (⌘/Ctrl, ⌥/Alt, Finder/Eksplorator), używając `api.platform`.
4. Uruchom `node scripts/tlumaczenia.mjs`. Skrypt wypisuje klucze bez tłumaczenia i tłumaczenia, których nie ma nigdzie w kodzie (napisy podawane do `_t` przez zmienną, np. nazwy kolorów mazaka, liczą się jako używane, bo stoją w kodzie jako literały). Wynik ma brzmieć „W porządku”.
5. Większą partię nowych napisów daj do przejrzenia agentowi `tlumacz`.
