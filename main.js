// Blat — proces główny: okno, tablice na dysku, przyjmowanie plików, aktualizacje.
// Tablica to folder „Nazwa.blat” w Dokumenty/Blat: board.json (układ) + img/ (obrazy, raz zapisane).
// Zapis układu jest lekki (sam JSON), więc może być automatyczny i częsty. Szczegóły w ARCHITEKTURA.md.
const { app, BrowserWindow, ipcMain, shell, protocol, net, nativeTheme, Menu, screen, clipboard, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { spawn } = require('child_process');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

// blat://b/<tablica>/<plik> — obrazy tablic z dysku
protocol.registerSchemesAsPrivileged([{
  scheme: 'blat',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true }
}]);

/* ---------- ustawienia ---------- */
const settingsFile = () => path.join(app.getPath('userData'), 'ustawienia.json');
let settings = { dir: null, bounds: null, maximized: false, last: null, side: true, onTop: false };
function loadSettings() { try { Object.assign(settings, JSON.parse(fs.readFileSync(settingsFile(), 'utf8'))); } catch (e) {} }
// zapis ustawień odroczony (ruch okna wysyła dziesiątki zdarzeń na sekundę) i atomowy
let settingsT = 0;
function saveSettings(now) {
  clearTimeout(settingsT);
  if (!now) { settingsT = setTimeout(() => saveSettings(true), 400); return; }
  try { const f = settingsFile(); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', JSON.stringify(settings, null, 1)); fs.renameSync(f + '.tmp', f); } catch (e) {}
}
const boardsDir = () => settings.dir || path.join(app.getPath('documents'), 'Blat');
const boardPath = name => path.join(boardsDir(), safeName(name) + '.blat');
// nazwa tablicy = nazwa folderu: bez znaków, których system nie przyjmie
// (na Windows także bez nazw zastrzeżonych: CON, NUL, COM1…)
const safeName = n => {
  let s = String(n || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (isWin && /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) s += '_';   // kropka na końcu nie szkodzi: do nazwy i tak dochodzi „.blat”
  return s || 'Blat';
};

/* ---------- tablice ---------- */
// Zapis odporny na awarie: plik tymczasowy o niepowtarzalnej nazwie, fsync, potem podmiana.
// Na Windows (OneDrive, antywirus, indeksowanie) podmiana bywa chwilowo odrzucana — wtedy kilka prób.
let tmpN = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function writeAtomic(file, data, bak) {
  const tmp = file + '.' + process.pid + '.' + (++tmpN) + '.tmp';
  const fh = await fsp.open(tmp, 'w');
  try { await fh.writeFile(data); await fh.sync(); } finally { await fh.close(); }
  try {
    // poprzednia wersja zostaje jako kopia zapasowa (board.json.bak), na wypadek uszkodzonego pliku
    if (bak) await fsp.copyFile(file, file + '.bak').catch(() => {});
    for (const ms of [0, 50, 100, 200, 400, 800]) {
      if (ms) await sleep(ms);
      try { await fsp.rename(tmp, file); return; }
      catch (err) { if (!/^(EPERM|EBUSY|EACCES)$/.test(err.code) || ms === 800) throw err; }
    }
  } catch (err) { await fsp.unlink(tmp).catch(() => {}); throw err; }
}
async function renameRetry(from, to) {
  for (const ms of [0, 50, 100, 200, 400, 800]) {
    if (ms) await sleep(ms);
    try { return await fsp.rename(from, to); } catch (err) { if (!/^(EPERM|EBUSY|EACCES)$/.test(err.code) || ms === 800) throw err; }
  }
}
// zapisy jednego blatu idą po kolei, nigdy dwa naraz
const queues = new Map();
function queued(key, job) {
  const p = (queues.get(key) || Promise.resolve()).catch(() => {}).then(job);
  queues.set(key, p); p.finally(() => { if (queues.get(key) === p) queues.delete(key); }).catch(() => {});
  return p;
}
async function readBoard(dir) {
  try { return JSON.parse(await fsp.readFile(path.join(dir, 'board.json'), 'utf8')); }
  catch (err) { return JSON.parse(await fsp.readFile(path.join(dir, 'board.json.bak'), 'utf8')); }   // uszkodzony albo pusty plik → kopia
}
const listRow = (name, j) => { const imgs = (j.items || []).filter(i => i.type === 'image'); return { name, count: (j.items || []).filter(i => i.type !== 'drawing').length, thumbs: imgs.slice(0, 2).map(i => i.img && i.img.thumb).filter(Boolean), modified: j.modified || 0 }; };
ipcMain.handle('boards-list', async () => {
  const dir = boardsDir();
  await fsp.mkdir(dir, { recursive: true });
  const out = [];
  for (const d of await fsp.readdir(dir, { withFileTypes: true })) {
    if (!d.isDirectory() || !/\.blat$/i.test(d.name)) continue;
    const name = d.name.replace(/\.blat$/i, '');
    try { out.push(listRow(name, await readBoard(path.join(dir, d.name)))); }
    catch (e) { out.push({ name, count: 0, thumbs: [], modified: 0 }); }
  }
  out.sort((a, b) => b.modified - a.modified);
  return { dir, boards: out, last: settings.last };
});
ipcMain.handle('board-load', (e, name) => queued(boardPath(name), async () => {
  try {
    const j = await readBoard(boardPath(name));
    j.name = name;   // nazwa folderu jest prawdą (board.json mógł nie zdążyć dostać nowej nazwy po jej zmianie)
    settings.last = name; saveSettings();
    return j;
  } catch (err) { return null; }
}));
// dopisanie elementów do blatu, który nie jest otwarty (import skończony po przełączeniu blatu); w kolejce zapisów, bez zmiany „ostatniego blatu”
ipcMain.handle('board-append', (e, name, items) => queued(boardPath(name), async () => {
  const dir = boardPath(name);
  if (!fs.existsSync(dir)) throw new Error('blat nie istnieje: ' + name);
  const j = await readBoard(dir); j.items = (j.items || []).concat(items); j.modified = Date.now();
  await writeAtomic(path.join(dir, 'board.json'), JSON.stringify(j), true);
  return listRow(name, j);
}));
ipcMain.handle('board-new', async (e, base) => {
  await fsp.mkdir(boardsDir(), { recursive: true });
  let name = safeName(base || 'Nowy blat'), n = 2;
  while (fs.existsSync(boardPath(name))) name = safeName(base || 'Nowy blat') + ' ' + n++;
  await fsp.mkdir(path.join(boardPath(name), 'img'), { recursive: true });
  const board = { v: 1, name, items: [], view: { x: 0, y: 0, z: 1 }, modified: Date.now() };
  await writeAtomic(path.join(boardPath(name), 'board.json'), JSON.stringify(board));
  settings.last = name; saveSettings();
  return board;
});
// zapis nie tworzy folderu blatu: jeśli blat przeniesiono do kosza albo zmieniono mu nazwę, nie wraca jako pusty folder
ipcMain.handle('board-save', (e, name, board) => queued(boardPath(name), async () => {
  const dir = boardPath(name);
  if (!fs.existsSync(dir)) throw new Error('blat nie istnieje: ' + name);
  board.modified = Date.now();
  await writeAtomic(path.join(dir, 'board.json'), JSON.stringify(board), true);
  return { modified: board.modified, row: listRow(name, board) };
}));
// null = blat o tej nazwie już istnieje; wyjątek = inny błąd (np. folder zajęty)
ipcMain.handle('board-rename', (e, from, to) => queued(boardPath(from), async () => {
  const a = boardPath(from), b = boardPath(to);
  if (a === b) return safeName(to);
  const caseOnly = a.toLowerCase() === b.toLowerCase();   // sama wielkość liter: Mac i Windows widzą ten sam folder
  if (!caseOnly && fs.existsSync(b)) return null;
  if (caseOnly) {
    // przez nazwę pośrednią; jeśli druga podmiana się nie uda, wracamy do starej nazwy (folder nie znika z listy)
    const t = a + '.' + process.pid + '.ren'; await renameRetry(a, t);
    try { await renameRetry(t, b); } catch (err) { await renameRetry(t, a).catch(() => {}); throw err; }
  } else await renameRetry(a, b);
  if (settings.last === from) { settings.last = safeName(to); saveSettings(); }
  return safeName(to);
}));
ipcMain.handle('board-trash', (e, name) => queued(boardPath(name), async () => {
  try { await shell.trashItem(boardPath(name)); return true; } catch (err) { return false; }
}));
ipcMain.handle('board-reveal', (e, name) => shell.showItemInFolder(name ? boardPath(name) : boardsDir()));
// obraz zapisuje się raz, pod własnym identyfikatorem; tablica tylko na niego wskazuje
const imgName = f => String(f || '').replace(/[^a-z0-9._-]/gi, '').replace(/^\.+/, '');
ipcMain.handle('image-put', async (e, name, file, bytes) => {
  if (!fs.existsSync(boardPath(name))) throw new Error('blat nie istnieje: ' + name);
  const f = path.join(boardPath(name), 'img', imgName(file));
  await fsp.mkdir(path.dirname(f), { recursive: true });
  await fsp.writeFile(f, Buffer.from(bytes));
  return true;
});
// kopiowanie pliku obrazu między blatami (wklejanie elementów skopiowanych z innego blatu)
ipcMain.handle('image-copy', async (e, from, to, file) => {
  const f = imgName(file), src = path.join(boardPath(from), 'img', f), dst = path.join(boardPath(to), 'img', f);
  await fsp.mkdir(path.dirname(dst), { recursive: true });
  try { await fsp.copyFile(src, dst, fs.constants.COPYFILE_EXCL); } catch (err) { if (err.code !== 'EEXIST') return false; }   // brak pliku źródłowego → false
  return true;
});
// usuwanie nieużywanych obrazów (po usunięciu elementów) — gdy okno przechodzi do innego blatu
ipcMain.handle('images-prune', async (e, name, keep) => {
  const dir = path.join(boardPath(name), 'img'), k = new Set(keep);
  let n = 0;
  try { for (const f of await fsp.readdir(dir)) if (!k.has(f)) { await fsp.unlink(path.join(dir, f)).catch(() => {}); n++; } } catch (err) {}
  return n;
});
// Kopiowanie do innych programów (Photoshop, Chrome, Word): do schowka systemu trafia obraz w pełnej rozdzielczości
// i tekst-znacznik, po którym Blat rozpoznaje własną kopię. JPEG i PNG czytamy z pliku; inne formaty (WebP, GIF)
// okno dekoduje samo i przysyła jako PNG, bo Windows ich nie odczyta.
// Do schowka trafia sam obraz (bez tekstu, żeby Word czy Notatki nie wkleiły znacznika). Własną kopię Blat poznaje
// po odcisku: wymiary i próbka pikseli obrazu, który tu zapisaliśmy, porównane z obrazem w schowku przy wklejaniu.
// Odcisk: wymiary i skrót SHA-1 całej bitmapy; bitmapę czytamy tylko przy zgodnych wymiarach (obcy zrzut ekranu nic nie kosztuje).
let clipFp = null;
const imageHash = image => crypto.createHash('sha1').update(image.toBitmap()).digest('hex');
// wymiary z nagłówka PNG (IHDR), zanim cokolwiek zdekodujemy — mały plik o ogromnych wymiarach nie przejdzie
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}
const tooBig = s => !s || s.width * s.height > 8192 * 8192;
ipcMain.handle('clip-write', async (e, img) => {
  let image = null;
  if (img && img.png) {
    const ab = img.png instanceof ArrayBuffer ? img.png : ArrayBuffer.isView(img.png) ? img.png.buffer : null;
    if (!ab || ab.byteLength > 150 * 1048576) return false;
    const buf = Buffer.from(ab); if (tooBig(pngSize(buf))) return false;
    image = nativeImage.createFromBuffer(buf);
  } else if (img && img.board && img.file) {
    image = nativeImage.createFromPath(path.join(boardPath(img.board), 'img', imgName(img.file)));
    // inne wymiary niż w Blacie (np. zdjęcie z telefonu obrócone tagiem EXIF): niech dekoduje okno
    if (!image.isEmpty() && img.w && img.h) { const s = image.getSize(); if (s.width !== img.w || s.height !== img.h) return false; }
  }
  if (!image || image.isEmpty() || tooBig(image.getSize())) return false;
  clipboard.writeImage(image);
  clipFp = { size: image.getSize(), hash: null };
  setImmediate(() => { const now = clipboard.readImage(); if (clipFp && !now.isEmpty()) clipFp.hash = imageHash(now); });   // odcisk tego, co faktycznie jest w schowku
  return true;
});
ipcMain.handle('clip-ours', () => {
  if (!clipFp || !clipFp.hash) return false;
  const now = clipboard.readImage(); if (now.isEmpty()) return false;
  const s = now.getSize(); if (s.width !== clipFp.size.width || s.height !== clipFp.size.height) return false;
  return imageHash(now) === clipFp.hash;
});
// obraz przeciągnięty z przeglądarki internetowej: okno nie pobierze go samo (CORS), więc pobiera proces główny
ipcMain.handle('url-fetch', async (e, url) => {
  if (!/^https?:\/\//i.test(url)) throw new Error('zły adres');
  const r = await net.fetch(url, { headers: { 'User-Agent': 'Blat' } });
  const type = (r.headers.get('content-type') || '').split(';')[0].trim();
  if (!r.ok || !/^image\//.test(type)) throw new Error('to nie jest obraz');
  if (+r.headers.get('content-length') > 100 * 1048576) throw new Error('obraz jest za duży');
  const parts = []; let n = 0;   // czytamy po kawałku i przerywamy po 100 MB, także bez nagłówka długości
  for await (const c of r.body) { n += c.length; if (n > 100 * 1048576) throw new Error('obraz jest za duży'); parts.push(c); }
  const b = Buffer.concat(parts);
  return { type, bytes: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
});

/* ---------- okno ---------- */
ipcMain.on('on-top', (e, v) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.setAlwaysOnTop(!!v, 'floating'); settings.onTop = !!v; saveSettings(); });
ipcMain.on('side', (e, v) => { settings.side = !!v; saveSettings(); });
ipcMain.handle('ui-state', () => ({ side: settings.side !== false, onTop: !!settings.onTop }));
// h: wysokość paska z przyciskami okna na Windows (52 px zwykle, 32 px w trybie bez nawigacji)
ipcMain.on('chrome-colors', (e, bg, fg, h) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (isWin && w && !w.ownBtns) try { w.setTitleBarOverlay({ color: bg, symbolColor: fg, height: h || 52 }); } catch (err) {}
});
// tryb bez nawigacji: na Macu przyciski okna przesuwają się bliżej rogu, nad płótno
ipcMain.on('bare', (e, v) => { const w = BrowserWindow.fromWebContents(e.sender); if (isMac && w && w.setWindowButtonPosition) try { w.setWindowButtonPosition(v ? { x: 14, y: 13 } : { x: 18, y: 19 }); } catch (err) {} });
// na Macu w trybie bez nawigacji przyciski okna pokazują się tylko przy ruchu myszy, razem z pastylką
ipcMain.on('window-buttons', (e, v) => { const w = BrowserWindow.fromWebContents(e.sender); if (isMac && w && w.setWindowButtonVisibility) try { w.setWindowButtonVisibility(!!v); } catch (err) {} });
// aktywowanie okna po najechaniu kursorem (opcja w ustawieniach); na Macu trzeba aktywować cały program
ipcMain.on('focus-window', e => { const w = BrowserWindow.fromWebContents(e.sender); if (!w) return; if (isMac) app.focus({ steal: true }); w.focus(); });
// pełny ekran 100% (bez paska zadań i paska okna): Ctrl+spacja na Windows, ⌃⌘F na Macu — jak w Gapie
ipcMain.on('fullscreen-toggle', e => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.setFullScreen(!w.isFullScreen()); });

/* ---------- aktualizacje (jak w Gapie) ---------- */
const REPO = 'michallenczewski/blat-app';
let upd = { state: 'idle' };
const verNum = v => String(v || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
const newer = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
const tellAll = (ch, v) => { for (const w of BrowserWindow.getAllWindows()) w.webContents.send(ch, v); };
// W trakcie pobierania, instalacji albo po otwarciu obrazu dysku sprawdzanie niczego nie zmienia — inaczej automatyczne
// sprawdzenie (15 s po starcie, potem co 6 h) przywracało „Zainstaluj” i startowało drugie pobieranie (licznik ponad 100%).
const updBusy = () => upd && /^(downloading|ready|opened)$/.test(upd.state);
async function updCheck() {
  if (updBusy()) { tellAll('update-status', upd); return upd; }
  try {
    const r = await net.fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { 'User-Agent': 'Blat' } });
    if (!r.ok) throw new Error('GitHub ' + r.status);
    const j = await r.json(), v = String(j.tag_name || '').replace(/^v/, '');
    const want = isWin ? /-win-x64\.exe$/ : isMac ? new RegExp('-mac-' + process.arch + '\\.dmg$') : null;
    const a = want && (j.assets || []).find(x => want.test(x.name));
    if (updBusy()) return upd;   // pobieranie zaczęło się, zanim przyszła odpowiedź
    upd = a && newer(v, app.getVersion()) ? { state: 'available', version: v, url: a.browser_download_url, name: a.name.replace(/[^a-z0-9._-]/gi, ''), size: a.size, sha256: /^sha256:[0-9a-f]{64}$/i.test(a.digest || '') ? a.digest.slice(7).toLowerCase() : null } : { state: 'none', version: v };
  } catch (err) { if (updBusy()) return upd; upd = { state: 'error', error: 'network', detail: err.message }; }
  upd.current = app.getVersion(); tellAll('update-status', upd); return upd;
}
// błąd idzie do okna jako kod (network, incomplete, checksum, save, disk), a okno tłumaczy go przez _t
const codeErr = (code, detail) => Object.assign(new Error(detail || code), { blatCode: code });
async function updInstall() {
  if (upd.state === 'opened' && upd.file) { shell.openPath(upd.file); return true; }   // Mac: ponowne otwarcie pobranego obrazu dysku
  if (upd.state !== 'available') return false;   // jedno pobieranie naraz
  const u = upd;   // wszystko dalej na tym jednym obiekcie (licznik, stan, błąd)
  const file = path.join(isMac ? app.getPath('downloads') : app.getPath('temp'), u.name);
  u.state = 'downloading'; u.got = 0; delete u.error; tellAll('update-status', u);
  // pobieranie przerywamy, gdy przez 30 s nie przyszedł żaden bajt (zawieszone połączenie)
  const ac = new AbortController(); let lastByte = Date.now(), diskErr = false;
  const stall = setInterval(() => { if (Date.now() - lastByte > 30000) ac.abort(); }, 5000);
  try {
    let r; try { r = await net.fetch(u.url, { headers: { 'User-Agent': 'Blat' }, signal: ac.signal }); } catch (err) { throw codeErr('network', err.message); }
    if (!r.ok || !r.body) throw codeErr('network', 'HTTP ' + r.status);
    const hash = crypto.createHash('sha256'); let last = 0;
    const src = Readable.fromWeb(r.body);
    src.on('data', c => { lastByte = Date.now(); hash.update(c); u.got += c.length; if (Date.now() - last > 400) { last = Date.now(); tellAll('update-status', u); } });
    const out = fs.createWriteStream(file + '.part'); out.on('error', () => { diskErr = true; });   // błąd zapisu pliku = dysk, każdy inny = sieć
    try { await pipeline(src, out); } catch (err) { throw codeErr(diskErr ? 'disk' : 'network', err.message); }
    // instalator uruchamiamy tylko wtedy, gdy przyszedł cały i niezmieniony (gdy wydanie nie ma sumy SHA-256, sprawdzamy sam rozmiar)
    if (u.size && u.got !== u.size) throw codeErr('incomplete');
    if (u.sha256 && hash.digest('hex') !== u.sha256) throw codeErr('checksum');
    await fsp.rename(file + '.part', file);
  } catch (err) {
    fsp.unlink(file + '.part').catch(() => {}); u.state = 'available'; u.error = err.blatCode || 'disk'; u.detail = err.message; tellAll('update-status', u); return false;
  } finally { clearInterval(stall); }
  if (isWin) {
    u.state = 'ready'; tellAll('update-status', u);
    // przed wyjściem okna zapisują ostatnie zmiany; jeśli zapis się nie uda, nie instalujemy (zmiany zostają w oknie)
    if (!(await flushAll('update'))) { u.state = 'available'; u.error = 'save'; tellAll('update-status', u); return false; }
    spawn(file, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref(); quitNow();
  } else if (isMac) { u.state = 'opened'; u.file = file; tellAll('update-status', u); shell.openPath(file); }
  return true;
}
ipcMain.handle('update-get', () => ({ ...upd, current: app.getVersion() }));
ipcMain.handle('update-check', () => updCheck());
ipcMain.handle('update-install', () => updInstall());

/* ---------- zapis przy zamykaniu ---------- */
// Okno zamyka się dopiero, gdy potwierdzi zapis ostatnich zmian (bez odpowiedzi — najwyżej po 3 s).
// Gdy zapis się nie udał, okno zostaje otwarte i mówi o tym; drugie zamknięcie zamyka już bez zapisu.
// „Drugie zamknięcie bez zapisu” obowiązuje tylko chwilę po porażce (AGAIN ms); później okno znów jest pytane o zapis.
let quitting = false, quitPending = false, quitFailedAt = 0;
const AGAIN = 20000, recent = t => t && Date.now() - t < AGAIN;
function flushWin(w, reason) {
  if (w.isDestroyed()) return Promise.resolve(true);
  return new Promise(res => {
    const id = Math.random().toString(36).slice(2), t = setTimeout(() => done(true), 3000);
    function done(ok) { clearTimeout(t); ipcMain.removeListener('flushed', on); res(ok); }
    function on(e, got, ok) { if (got === id) done(ok !== false); }
    ipcMain.on('flushed', on); w.webContents.send('flush', id, reason || 'close');
  });
}
const flushAll = async reason => (await Promise.all(BrowserWindow.getAllWindows().map(w => flushWin(w, reason)))).every(Boolean);
// wyjście z programu bez ponownego pytania okien o zapis
function quitNow() { quitting = true; for (const w of BrowserWindow.getAllWindows()) w.allowClose = true; saveSettings(true); app.quit(); }

/* ---------- menu ---------- */
// bez domyślnego menu Electrona: nie ma przeładowania okna (⌘R / Ctrl+R kasowałoby historię cofania) ani narzędzi deweloperskich
function setMenu() {
  if (!isMac) { Menu.setApplicationMenu(null); return; }
  // View: tylko pełny ekran (⌃⌘F) — systemowy skrót, na który Blat chowa interfejs
  // nazwy menu jak w rolach Electrona (po angielsku), żeby nie mieszać języków; File daje ⌘W (zamknij okno)
  const t = [{ role: 'appMenu' }, { role: 'fileMenu' }, { role: 'editMenu' }, { label: 'View', submenu: [{ role: 'togglefullscreen' }] }, { role: 'windowMenu' }];
  if (!app.isPackaged) t.push({ label: 'Rozwój', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }] });
  Menu.setApplicationMenu(Menu.buildFromTemplate(t));
}
// zapamiętane położenie okna tylko wtedy, gdy wciąż leży na którymś ekranie (po odłączeniu monitora okno nie ucieka)
function boundsOnScreen(b) {
  if (!b || b.width == null) return {};
  const a = screen.getDisplayMatching(b).workArea;
  const ix = Math.min(b.x + b.width, a.x + a.width) - Math.max(b.x, a.x), iy = Math.min(b.y + b.height, a.y + a.height) - Math.max(b.y, a.y);
  if (ix < 100 || iy < 50) return { width: Math.min(b.width, a.width), height: Math.min(b.height, a.height) };
  return b;
}

// Własne przyciski okna na Windows (opcja „Przyciski okna w stylu Blatu”): okno bez systemowej nakładki, przyciski rysuje Blat.
// Ustawienie działa od utworzenia okna, więc jego zmiana uruchamia Blat ponownie.
const ownBtns = () => isWin && !!settings.ownButtons;
ipcMain.on('own-buttons', e => { const w = BrowserWindow.fromWebContents(e.sender); e.returnValue = !!(w && w.ownBtns); });
ipcMain.handle('own-buttons-set', async (e, v) => {
  settings.ownButtons = !!v; saveSettings(true);
  if (!(await flushAll('relaunch'))) return false;
  app.relaunch(); quitNow(); return true;
});
ipcMain.on('win-ctl', (e, cmd) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w) return;
  if (cmd === 'min') w.minimize();
  else if (cmd === 'max') w.isMaximized() ? w.unmaximize() : w.maximize();
  else if (cmd === 'close') w.close();
});

function createWindow() {
  const b = boundsOnScreen(settings.bounds), own = ownBtns();
  const win = new BrowserWindow({
    width: b.width || 1400, height: b.height || 900, x: b.x, y: b.y,
    minWidth: 320, minHeight: 220, // mały blat z referencjami w rogu ekranu (także „zawsze na wierzchu”)
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#161616' : '#f7f7f5',
    title: 'Blat', show: false,
    ...(isMac ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 19 } }
      : own ? { titleBarStyle: 'hidden' }
      : { titleBarStyle: 'hidden', titleBarOverlay: { color: '#f7f7f5', symbolColor: '#4a4945', height: 52 } }),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.ownBtns = own;
  const maxState = () => { if (!win.isDestroyed()) win.webContents.send('win-max', win.isMaximized()); };
  win.on('maximize', maxState); win.on('unmaximize', maxState);
  if (settings.maximized) win.maximize();
  if (settings.onTop) win.setAlwaysOnTop(true, 'floating');
  win.once('ready-to-show', () => win.show());
  const remember = () => { if (!win.isMaximized() && !win.isMinimized()) settings.bounds = win.getBounds(); settings.maximized = win.isMaximized(); saveSettings(); };
  win.on('resize', remember); win.on('move', remember);
  win.on('close', e => {
    if (win.allowClose || recent(win.failedAt)) return;   // zapis już potwierdzony albo drugie zamknięcie zaraz po porażce
    e.preventDefault();
    if (win.flushing) return; win.flushing = true;
    flushWin(win).then(ok => {
      win.flushing = false; saveSettings(true);
      if (ok) { win.allowClose = true; if (!win.isDestroyed()) win.close(); } else win.failedAt = Date.now();
    });
  });
  win.on('enter-full-screen', () => win.webContents.send('fullscreen', true));
  win.on('leave-full-screen', () => win.webContents.send('fullscreen', false));
  // linki otwierają się w przeglądarce, nie w oknie Blatu
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  return win;
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(() => {
    loadSettings(); setMenu();
    protocol.handle('blat', async req => {
      const u = new URL(req.url);
      if (u.host !== 'b') return new Response('', { status: 404 });
      const [board, file] = u.pathname.slice(1).split('/').map(decodeURIComponent);
      const f = path.join(boardPath(board), 'img', imgName(file));
      try { return new Response(await fsp.readFile(f), { headers: { 'Content-Type': /\.png$/i.test(f) ? 'image/png' : /\.jpe?g$/i.test(f) ? 'image/jpeg' : /\.gif$/i.test(f) ? 'image/gif' : 'image/webp', 'Cache-Control': 'max-age=31536000' } }); }
      catch (err) { return new Response('', { status: 404 }); }
    });
    createWindow();
    setTimeout(updCheck, 15000); setInterval(updCheck, 6 * 3600 * 1000);
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => { if (!isMac || quitting) app.quit(); });
  // ⌘Q, wylogowanie, wyłączenie komputera: najpierw zapis we wszystkich oknach, potem wyjście.
  // (Zatrzymanie zamykania w samym „close” Electron traktuje jak odmowę wyjścia — dlatego tutaj.)
  app.on('before-quit', e => {
    if (quitting) return;
    if (recent(quitFailedAt)) { quitNow(); return; }   // drugie ⌘Q zaraz po nieudanym zapisie: wychodzimy mimo to
    e.preventDefault();
    if (quitPending) return; quitPending = true;
    flushAll('quit').then(ok => { quitPending = false; if (ok) quitNow(); else quitFailedAt = Date.now(); });
  });
}
