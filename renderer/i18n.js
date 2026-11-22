// Napisy: w kodzie po polsku, przez _t(); wersja angielska w lang/en.js (umiejętność `tlumaczenia`).
'use strict';
const _lang = (navigator.language || 'pl').toLowerCase().startsWith('pl') ? 'pl' : 'en';
function _t(s) { return _lang === 'en' && window.BLAT_EN && BLAT_EN[s] ? BLAT_EN[s] : s; }
document.documentElement.lang = _lang;
