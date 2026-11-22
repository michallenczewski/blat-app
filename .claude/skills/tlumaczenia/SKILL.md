---
name: tlumaczenia
description: Jak dodać napis do interfejsu Blatu, żeby działał po polsku i po angielsku.
---

# Tłumaczenia

1. W kodzie napis zawsze przez `_t('Polski tekst')`. Polski tekst jest kluczem; nie twórz sztucznych identyfikatorów.
2. Dopisz tłumaczenie do `renderer/lang/en.js` (`window.BLAT_EN`), krótkie i naturalne, w tym samym tonie co reszta.
3. Skróty opisuj osobno dla Maca i Windows (⌘/Ctrl, ⌥/Alt, Finder/Eksplorator), używając `api.platform`.
4. Uruchom `node scripts/tlumaczenia.mjs`. Skrypt wypisuje klucze bez tłumaczenia i tłumaczenia, których nikt już nie używa; oba wykazy mają być puste.
5. Większą partię nowych napisów daj do przejrzenia agentowi `tlumacz`.
