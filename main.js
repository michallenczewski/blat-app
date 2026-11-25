// Blat — proces główny: okno, tablice na dysku, przyjmowanie plików, aktualizacje.
// Tablica to folder „Nazwa.blat” w Dokumenty/Blat: board.json (układ) + img/ (obrazy, raz zapisane).
// Zapis układu jest lekki (sam JSON), więc może być automatyczny i częsty. Szczegóły w ARCHITEKTURA.md.
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { spawn } = require('child_process');

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
function saveSettings() { try { fs.mkdirSync(path.dirname(settingsFile()), { recursive: true }); fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 1)); } catch (e) {} }
const boardsDir = () => settings.dir || path.join(app.getPath('documents'), 'Blat');
const boardPath = name => path.join(boardsDir(), safeName(name) + '.blat');
// nazwa tablicy = nazwa folderu: bez znaków, których system nie przyjmie
const safeName = n => String(n || '').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Blat';

/* ---------- tablice ---------- */
async function writeAtomic(file, data) {
  const tmp = file + '.tmp';
  await fsp.writeFile(tmp, data);
  await fsp.rename(tmp, file);
}
ipcMain.handle('boards-list', async () => {
  const dir = boardsDir();
  await fsp.mkdir(dir, { recursive: true });
  const out = [];
  for (const d of await fsp.readdir(dir, { withFileTypes: true })) {
    if (!d.isDirectory() || !/\.blat$/i.test(d.name)) continue;
    const name = d.name.replace(/\.blat$/i, '');
    try {
      const j = JSON.parse(await fsp.readFile(path.join(dir, d.name, 'board.json'), 'utf8'));
      const imgs = (j.items || []).filter(i => i.type === 'image');
      out.push({ name, count: (j.items || []).filter(i => i.type !== 'drawing').length, thumbs: imgs.slice(0, 2).map(i => i.img && i.img.thumb).filter(Boolean), modified: j.modified || 0 });
    } catch (e) { out.push({ name, count: 0, thumbs: [], modified: 0 }); }
  }
  out.sort((a, b) => b.modified - a.modified);
  return { dir, boards: out, last: settings.last };
});
ipcMain.handle('board-load', async (e, name) => {
  try {
    const j = JSON.parse(await fsp.readFile(path.join(boardPath(name), 'board.json'), 'utf8'));
    settings.last = name; saveSettings();
    return j;
  } catch (err) { return null; }
});
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
ipcMain.handle('board-save', async (e, name, board) => {
  const dir = boardPath(name);
  await fsp.mkdir(path.join(dir, 'img'), { recursive: true });
  board.modified = Date.now();
  await writeAtomic(path.join(dir, 'board.json'), JSON.stringify(board));
  return board.modified;
});
ipcMain.handle('board-rename', async (e, from, to) => {
  const a = boardPath(from), b = boardPath(to);
  if (a === b) return safeName(to);
  if (fs.existsSync(b)) return null;
  await fsp.rename(a, b);
  if (settings.last === from) { settings.last = safeName(to); saveSettings(); }
  return safeName(to);
});
ipcMain.handle('board-trash', async (e, name) => { await shell.trashItem(boardPath(name)); return true; });
ipcMain.handle('board-reveal', (e, name) => shell.showItemInFolder(name ? boardPath(name) : boardsDir()));
// obraz zapisuje się raz, pod własnym identyfikatorem; tablica tylko na niego wskazuje
ipcMain.handle('image-put', async (e, name, file, bytes) => {
  const f = path.join(boardPath(name), 'img', file.replace(/[^a-z0-9._-]/gi, ''));
  await fsp.mkdir(path.dirname(f), { recursive: true });
  await fsp.writeFile(f, Buffer.from(bytes));
  return true;
});
// kopiowanie pliku obrazu między blatami (wklejanie elementów skopiowanych z innego blatu)
ipcMain.handle('image-copy', async (e, from, to, file) => {
  const f = file.replace(/[^a-z0-9._-]/gi, ''), src = path.join(boardPath(from), 'img', f), dst = path.join(boardPath(to), 'img', f);
  await fsp.mkdir(path.dirname(dst), { recursive: true });
  try { await fsp.copyFile(src, dst, fs.constants.COPYFILE_EXCL); } catch (err) { if (err.code !== 'EEXIST') return false; }
  return true;
});
// usuwanie nieużywanych obrazów (po usunięciu elementów) — przy zamykaniu tablicy
ipcMain.handle('images-prune', async (e, name, keep) => {
  const dir = path.join(boardPath(name), 'img'), k = new Set(keep);
  let n = 0;
  try { for (const f of await fsp.readdir(dir)) if (!k.has(f)) { await fsp.unlink(path.join(dir, f)).catch(() => {}); n++; } } catch (err) {}
  return n;
});
// pliki przeciągnięte z Gapy, Eksploratora albo Findera
ipcMain.handle('file-read', async (e, p) => {
  const st = await fsp.stat(p);
  if (st.size > 512 * 1048576) throw new Error('plik jest za duży');
  const b = await fsp.readFile(p);
  return { name: path.basename(p), bytes: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
});

/* ---------- okno ---------- */
ipcMain.on('on-top', (e, v) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.setAlwaysOnTop(!!v, 'floating'); settings.onTop = !!v; saveSettings(); });
ipcMain.on('side', (e, v) => { settings.side = !!v; saveSettings(); });
ipcMain.handle('ui-state', () => ({ side: settings.side !== false, onTop: !!settings.onTop }));
// h: wysokość paska z przyciskami okna na Windows (52 px zwykle, 36 px w trybie bez nawigacji)
ipcMain.on('chrome-colors', (e, bg, fg, h) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (isWin && w) try { w.setTitleBarOverlay({ color: bg, symbolColor: fg, height: h || 52 }); } catch (err) {}
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
async function updCheck() {
  try {
    const r = await net.fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { 'User-Agent': 'Blat' } });
    if (!r.ok) throw new Error('GitHub ' + r.status);
    const j = await r.json(), v = String(j.tag_name || '').replace(/^v/, '');
    const want = isWin ? /-win-x64\.exe$/ : isMac ? new RegExp('-mac-' + process.arch + '\\.dmg$') : null;
    const a = want && (j.assets || []).find(x => want.test(x.name));
    upd = a && newer(v, app.getVersion()) ? { state: 'available', version: v, url: a.browser_download_url, name: a.name, size: a.size } : { state: 'none', version: v };
  } catch (err) { upd = { state: 'error', error: err.message }; }
  upd.current = app.getVersion(); tellAll('update-status', upd); return upd;
}
async function updInstall() {
  if (upd.state !== 'available') return false;
  const file = path.join(isMac ? app.getPath('downloads') : app.getPath('temp'), upd.name);
  upd.state = 'downloading'; upd.got = 0; tellAll('update-status', upd);
  try {
    const r = await net.fetch(upd.url, { headers: { 'User-Agent': 'Blat' } });
    if (!r.ok || !r.body) throw new Error('pobieranie nie powiodło się');
    const out = fs.createWriteStream(file + '.part'); let last = 0;
    for await (const c of r.body) { out.write(c); upd.got += c.length; if (Date.now() - last > 400) { last = Date.now(); tellAll('update-status', upd); } }
    await new Promise((res, rej) => out.end(err => (err ? rej(err) : res())));
    await fsp.rename(file + '.part', file);
  } catch (err) { upd.state = 'available'; upd.error = err.message; tellAll('update-status', upd); return false; }
  upd.state = 'ready'; tellAll('update-status', upd);
  if (isWin) { spawn(file, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref(); setTimeout(() => app.quit(), 400); }
  else if (isMac) shell.openPath(file);
  return true;
}
ipcMain.handle('update-get', () => ({ ...upd, current: app.getVersion() }));
ipcMain.handle('update-check', () => updCheck());
ipcMain.handle('update-install', () => updInstall());

function createWindow() {
  const b = settings.bounds || {};
  const win = new BrowserWindow({
    width: b.width || 1400, height: b.height || 900, x: b.x, y: b.y,
    minWidth: 320, minHeight: 220, // mały blat z referencjami w rogu ekranu (także „zawsze na wierzchu”)
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#161616' : '#f7f7f5',
    title: 'Blat', show: false,
    ...(isMac ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 18, y: 19 } }
      : { titleBarStyle: 'hidden', titleBarOverlay: { color: '#f7f7f5', symbolColor: '#4a4945', height: 52 } }),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  if (settings.maximized) win.maximize();
  if (settings.onTop) win.setAlwaysOnTop(true, 'floating');
  win.once('ready-to-show', () => win.show());
  const remember = () => { if (!win.isMaximized() && !win.isMinimized()) settings.bounds = win.getBounds(); settings.maximized = win.isMaximized(); saveSettings(); };
  win.on('resize', remember); win.on('move', remember);
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
    loadSettings();
    protocol.handle('blat', async req => {
      const u = new URL(req.url);
      if (u.host !== 'b') return new Response('', { status: 404 });
      const [board, file] = u.pathname.slice(1).split('/').map(decodeURIComponent);
      const f = path.join(boardPath(board), 'img', String(file || '').replace(/[^a-z0-9._-]/gi, ''));
      try { return new Response(await fsp.readFile(f), { headers: { 'Content-Type': /\.png$/i.test(f) ? 'image/png' : /\.jpe?g$/i.test(f) ? 'image/jpeg' : /\.gif$/i.test(f) ? 'image/gif' : 'image/webp', 'Cache-Control': 'max-age=31536000' } }); }
      catch (err) { return new Response('', { status: 404 }); }
    });
    createWindow();
    setTimeout(updCheck, 15000); setInterval(updCheck, 6 * 3600 * 1000);
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => { if (!isMac) app.quit(); });
}
