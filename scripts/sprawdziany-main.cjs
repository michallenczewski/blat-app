// Sprawdzian procesu głównego: aktualizacje (zgłoszenie Michała 27.11: licznik pobierania 107% i podwójne pobieranie,
// gdy automatyczne sprawdzenie 15 s po starcie trafiło w trwające pobieranie). Bez Electrona — moduł 'electron' jest podmieniony.
// Uruchom: node scripts/sprawdziany-main.cjs
Object.defineProperty(process, 'platform', { value: 'darwin' });
const Module = require('module'), path = require('path'), fs = require('fs'), os = require('os'), crypto = require('crypto');
const handlers = {}; const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'blatu-'));
const SIZE = 200000, data = crypto.randomBytes(SIZE), digest = 'sha256:' + crypto.createHash('sha256').update(data).digest('hex');
let downloads = 0, opened = 0;
const net = { fetch: async (url, opt) => {
  if (url.includes('api.github.com')) return new Response(JSON.stringify({ tag_name: 'v9.9.9', assets: [{ name: 'Blat-9.9.9-mac-' + process.arch + '.dmg', browser_download_url: 'https://x/dl', size: SIZE, digest }] }), { status: 200 });
  downloads++;
  let i = 0; const body = new ReadableStream({ async pull(c) { await new Promise(r => setTimeout(r, 20)); if (i >= SIZE) return c.close(); c.enqueue(new Uint8Array(data.subarray(i, i + 10000))); i += 10000; } });
  return new Response(body, { status: 200 });
} };
const fake = { app: { getPath: k => path.join(tmp, k), requestSingleInstanceLock: () => false, quit() {}, on() {}, whenReady: () => new Promise(() => {}), getVersion: () => '0.3.0', isPackaged: true, getLocale: () => 'pl' },
  BrowserWindow: { getAllWindows: () => [] }, ipcMain: { handle: (c, f) => handlers[c] = f, on() {}, removeListener() {} }, shell: { openPath: () => { opened++; } }, protocol: { registerSchemesAsPrivileged() {} }, net, nativeTheme: {}, Menu: {}, screen: {}, clipboard: {}, nativeImage: {} };
fs.mkdirSync(path.join(tmp, 'downloads'), { recursive: true });
const orig = Module._load; Module._load = function (r, ...a) { return r === 'electron' ? fake : orig.call(this, r, ...a); };
require(path.join(__dirname, '..', 'main.js'));
const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };
(async () => {
  const H = c => handlers[c]({});
  let u = await H('update-check'); ok(u.state === 'available', 'sprawdzenie widzi nową wersję');
  const inst = H('update-install'); await new Promise(r => setTimeout(r, 150));
  u = await H('update-check'); ok(u.state === 'downloading', 'sprawdzenie w trakcie pobierania nie przywraca „Zainstaluj”');
  ok(await H('update-install') === false, 'drugie „Zainstaluj” w trakcie pobierania nic nie robi');
  ok(await inst === true, 'pobieranie kończy się powodzeniem');
  u = await H('update-check'); ok(u.got === SIZE && !u.error && downloads === 1 && opened === 1 && u.state === 'opened', 'jedno pobieranie, licznik równy rozmiarowi, obraz dysku otwarty raz');
  console.log(fails.length ? 'NIE PRZESZŁO:\n  ' + fails.join('\n  ') : 'W porządku: aktualizacje (proces główny).'); process.exit(fails.length ? 1 : 0);
})();
