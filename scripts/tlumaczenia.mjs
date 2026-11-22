// Sprawdza, czy każdy napis z _t('…') ma tłumaczenie w renderer/lang/en.js i czy w słowniku nie ma zbędnych wpisów.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('..', import.meta.url).pathname;
const files = ['main.js', ...readdirSync(join(root, 'renderer')).filter(f => f.endsWith('.js') && f !== 'web-api.js').map(f => join('renderer', f))];
const used = new Set();
// wszystkie napisy w nawiasie _t(…), także w postaci _t(warunek ? 'a' : 'b'), oraz atrybuty data-t w HTML
const call = /_t\(([^()]*)\)/g, lit = /(['"])((?:\\.|(?!\1).)*)\1/g;
for (const f of files) for (const m of readFileSync(join(root, f), 'utf8').matchAll(call)) for (const l of m[1].matchAll(lit)) if (!/[=!]=\s*$/.test(m[1].slice(0, l.index))) used.add(l[2].replace(/\\(.)/g, '$1'));
for (const m of readFileSync(join(root, 'renderer/index.html'), 'utf8').matchAll(/data-t="([^"]+)"/g)) used.add(m[1]);
const window = {}; new Function('window', readFileSync(join(root, 'renderer/lang/en.js'), 'utf8'))(window);
const dict = window.BLAT_EN || {};
const missing = [...used].filter(k => !(k in dict)), unused = Object.keys(dict).filter(k => !used.has(k));
if (missing.length) console.log('Brak tłumaczenia:\n  ' + missing.join('\n  '));
// napisy podawane do _t przez zmienną (listy skrótów, odmiana liczebników) wyglądają tu na nieużywane; to tylko ostrzeżenie
if (unused.length) console.log('Tłumaczenia bez bezpośredniego _t (sprawdź, czy są używane pośrednio):\n  ' + unused.join('\n  '));
if (!missing.length && !unused.length) console.log(`W porządku: ${used.size} napisów.`);
process.exitCode = missing.length ? 1 : 0;
