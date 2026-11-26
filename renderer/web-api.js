// Wersja przeglądarkowa do testów (umiejętność `test-w-przegladarce`): ten sam zestaw co preload.js,
// ale tablice żyją w pamięci strony. W programie (Electron) window.api istnieje już wcześniej i ten plik nic nie robi.
'use strict';
if (!window.api) (() => {
  const boards = new Map(), files = new Map();   // nazwa -> board; "tablica/plik" -> blob URL
  let last = null;
  const clone = o => JSON.parse(JSON.stringify(o));
  window.api = {
    platform: /Mac/.test(navigator.platform) ? 'darwin' : 'win32', web: true,
    async boardsList() { return { dir: 'Dokumenty/Blat (przeglądarka)', last, boards: [...boards.values()].map(b => ({ name: b.name, count: b.items.filter(i => i.type !== 'drawing').length, thumbs: b.items.filter(i => i.img).slice(0, 2).map(i => i.img.thumb || i.img.full), modified: b.modified || 0 })).sort((a, b) => b.modified - a.modified) }; },
    async boardLoad(n) { last = n; return boards.has(n) ? clone(boards.get(n)) : null; },
    async boardNew(base) { let n = base || 'Nowy blat', k = 2; while (boards.has(n)) n = (base || 'Nowy blat') + ' ' + k++; const b = { v: 1, name: n, items: [], view: { x: 0, y: 0, z: 1 }, modified: Date.now() }; boards.set(n, b); last = n; return clone(b); },
    // _failSave: ile następnych zapisów ma się nie udać (sprawdziany), jak odrzucona podmiana pliku na Windows
    _failSave: 0,
    async boardSave(n, b) { if (!boards.has(n)) throw new Error('blat nie istnieje: ' + n); if (this._failSave > 0) { this._failSave--; throw new Error('EPERM'); }
      b.modified = Date.now(); boards.set(n, clone(b)); return { modified: b.modified, row: { name: n, count: b.items.filter(i => i.type !== 'drawing').length, thumbs: b.items.filter(i => i.img).slice(0, 2).map(i => i.img.thumb || i.img.full), modified: b.modified } }; },
    async boardRename(a, b) { if (boards.has(b)) return null; const x = boards.get(a); boards.delete(a); x.name = b; boards.set(b, x); for (const [k, v] of [...files]) if (k.startsWith(a + '/')) { files.set(b + k.slice(a.length), v); files.delete(k); } return b; },
    async boardTrash(n) { boards.delete(n); return true; },
    boardReveal() {},
    async imagePut(n, f, bytes) { if (!boards.has(n)) throw new Error('blat nie istnieje: ' + n); files.set(n + '/' + f, URL.createObjectURL(new Blob([bytes], { type: /\.png$/.test(f) ? 'image/png' : /\.jpe?g$/.test(f) ? 'image/jpeg' : 'image/webp' }))); return true; },
    async imagesPrune(n, keep) { const k = new Set(keep); let c = 0; for (const key of [...files.keys()]) if (key.startsWith(n + '/') && !k.has(key.slice(n.length + 1))) { files.delete(key); c++; } return c; },
    async updateGet() { return { state: 'none', current: '0.0.0-web' }; }, async updateCheck() { return { state: 'none', current: '0.0.0-web' }; }, async updateInstall() { return false; }, onUpdateStatus() {},
    async imageCopy(a, b, f) { const u = files.get(a + '/' + f) || files.get(b + '/' + f); if (u) files.set(b + '/' + f, u); return !!u; },
    imageUrl: (n, f) => files.get(n + '/' + f) || '',
    setOnTop() {}, setSide() {}, uiState: async () => ({ side: true, onTop: false }),
  };
})();
