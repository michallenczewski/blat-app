// Blat — płótno tablicy. Jeden plik, bez frameworka i bez budowania, jak Gapa.
// Model: board = { v, name, items:[...], view:{x,y,z} }; element: { id, type:'image'|'note'|'frame', x,y,w,h, … }.
// Nazwy typów są te same co w webowym Blacie (obraz, notatka, ramka), żeby kiedyś wymiana była prosta.
'use strict';
const $ = s => document.querySelector(s);
const isMac = api.platform === 'darwin';
const MOD = isMac ? '⌘' : 'Ctrl+';
const errors = [];
addEventListener('error', e => errors.push(String(e.message || e)));
addEventListener('unhandledrejection', e => errors.push(String(e.reason && e.reason.message || e.reason)));

/* ---------- ikony (cienka linia, jak w Gapie) ---------- */
const svg = (d, s = 15) => '<svg width="' + s + '" height="' + s + '" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
const IC = {
  side: svg('<rect x="2" y="2.5" width="12" height="11" rx="2"/><path d="M6 2.5v11"/>', 16),
  select: svg('<path d="M4 2.5 12 8l-3.6.9L10.5 13l-1.6.8-2.1-4.1L4 12.5z"/>'),
  note: svg('<path d="M3 3.5h10M8 3.5v9"/>'),
  frame: svg('<rect x="2.5" y="3.5" width="11" height="9" rx="2"/><path d="M5 6.5h3"/>'),
  arrange: svg('<rect x="2.5" y="2.5" width="5" height="5" rx="1"/><rect x="8.5" y="2.5" width="5" height="3.5" rx="1"/><rect x="2.5" y="8.5" width="5" height="5" rx="1"/><rect x="8.5" y="7" width="5" height="6.5" rx="1"/>'),
  pin: svg('<path d="M6 2.5h4M8 2.5v5M5 7.5h6l-1 3H6zM8 10.5v3"/>'),
  plus: svg('<path d="M8 3v10M3 8h10"/>', 13),
  moon: svg('<path d="M13.2 10.1A5.6 5.6 0 0 1 5.9 2.8a5.6 5.6 0 1 0 7.3 7.3z"/>'),
  ui: svg('<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6.2h12"/>'),
  fs: svg('<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>') + svg('<path d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5"/>'),
  keys: svg('<rect x="1.5" y="4" width="13" height="8" rx="1.5"/><path d="M4 6.5h.01M6.7 6.5h.01M9.3 6.5h.01M12 6.5h.01M5 9.5h6"/>'),
  sun: svg('<circle cx="8" cy="8" r="2.8"/><path d="M8 1.6v1.5M8 12.9v1.5M3.5 3.5l1 1M11.5 11.5l1 1M1.6 8h1.5M12.9 8h1.5M3.5 12.5l1-1M11.5 4.5l1-1"/>'),
};

/* ---------- stan ---------- */
let board = null;            // otwarta tablica
let sel = new Set();         // id zaznaczonych elementów
let tool = 'select';
const els = new Map();       // id -> element DOM
const undoStack = [], redoStack = [];
let saveT = 0, dirty = false;
const main = $('#main'), world = $('#world');
const DPR = () => window.devicePixelRatio || 1;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* ---------- drobiazgi ---------- */
let tipT = 0;
function tip(text) { const t = $('#tip'); t.textContent = text; t.classList.add('on'); clearTimeout(tipT); tipT = setTimeout(() => t.classList.remove('on'), 2200); }
const bbox = list => { let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity; for (const i of list) { x1 = Math.min(x1, i.x); y1 = Math.min(y1, i.y); x2 = Math.max(x2, i.x + i.w); y2 = Math.max(y2, i.y + i.h); } return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }; };
const byId = id => board.items.find(i => i.id === id);
const selItems = () => board.items.filter(i => sel.has(i.id));
const inside = (a, f) => { const cx = a.x + a.w / 2, cy = a.y + a.h / 2; return a !== f && cx > f.x && cx < f.x + f.w && cy > f.y && cy < f.y + f.h; };
// zaznaczenie razem z zawartością zaznaczonych ramek
function movingSet() { const m = new Set(sel); for (const id of sel) { const f = byId(id); if (f && f.type === 'frame') for (const o of board.items) if (o.type !== 'frame' && inside(o, f)) m.add(o.id); } return m; }
const toWorld = (cx, cy) => { const r = main.getBoundingClientRect(), v = board.view; return { x: (cx - r.left - v.x) / v.z, y: (cy - r.top - v.y) / v.z }; };
const centerWorld = () => { const r = main.getBoundingClientRect(); return toWorld(r.left + r.width / 2, r.top + r.height / 2); };

/* ---------- motyw ---------- */
function applyTheme() {
  let t = localStorage.getItem('blatTheme');
  if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  $('#themeBtn').innerHTML = t === 'dark' ? IC.sun : IC.moon;
  $('#themeBtn').title = _t(t === 'dark' ? 'Tryb jasny' : 'Tryb ciemny');
  const cs = getComputedStyle(document.documentElement);
  if (api.chromeColors) api.chromeColors(cs.getPropertyValue('--bg').trim(), cs.getPropertyValue('--text2').trim(), isBare() && !isFs() ? 36 : 52);
}

/* ---------- rysowanie elementów ---------- */
function imgSrc(it) {
  // na małym ekranowym rozmiarze wystarczy miniatura; pełny obraz dopiero po przybliżeniu
  const px = Math.max(it.w, it.h) * board.view.z * DPR();
  return api.imageUrl(board.name, px > 720 && it.img.full ? it.img.full : it.img.thumb || it.img.full);
}
function drawItem(it) {
  let el = els.get(it.id);
  if (!el) {
    el = document.createElement('div'); el.className = 'it ' + it.type; el.dataset.id = it.id;
    if (it.type === 'image') { const im = document.createElement('img'); im.decoding = 'async'; im.draggable = false; el.appendChild(im); }
    if (it.type === 'frame') el.innerHTML = '<div class="fl"><b></b><span></span></div>';
    if (it.type === 'note') el.dataset.ph = _t('Notatka');
    els.set(it.id, el);
    world.appendChild(el);
  }
  el.style.left = it.x + 'px'; el.style.top = it.y + 'px'; el.style.width = it.w + 'px';
  el.style.height = it.type === 'note' ? 'auto' : it.h + 'px';
  el.style.zIndex = (it.type === 'frame' ? 0 : 1000) + (it.z || 0);
  if (it.type === 'image') { const im = el.firstChild, s = imgSrc(it); if (im.getAttribute('src') !== s) im.src = s; }
  if (it.type === 'frame') {
    const nb = el.querySelector('.fl b'); if (nb) nb.textContent = it.name || _t('Ramka');   // podczas zmiany nazwy w miejscu <b> jest pole tekstowe
    const n = board.items.filter(o => o.type !== 'frame' && inside(o, it)).length;
    el.querySelector('span').textContent = n ? n + ' ' + plural(n, 'element', 'elementy', 'elementów') : '';
  }
  if (it.type === 'note' && el.contentEditable !== 'true' && el.textContent !== (it.text || '')) el.textContent = it.text || '';
  el.classList.toggle('sel', sel.has(it.id));
  let hd = el.querySelector('.hd');
  const showHd = sel.size === 1 && sel.has(it.id);
  if (showHd && !hd) { hd = document.createElement('span'); hd.className = 'hd br'; el.appendChild(hd); }
  if (!showHd && hd) hd.remove();
  if (hd) { const k = 1 / board.view.z; hd.style.transform = 'scale(' + k + ')'; hd.style.transformOrigin = '100% 100%'; }
  if (it.type === 'note' && el.isConnected) it.h = Math.max(20, el.offsetHeight);   // wysokość notatki wynika z tekstu
}
function plural(n, one, few, many) {
  if (_lang !== 'pl') return n === 1 ? _t(one) : _t(many);
  if (n === 1) return one;
  const d = n % 10, t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}
function drawAll() {
  const ids = new Set(board.items.map(i => i.id));
  for (const [id, el] of els) if (!ids.has(id)) { el.remove(); els.delete(id); }
  for (const it of board.items) drawItem(it);
  main.classList.toggle('isempty', board.items.length === 0);
  frameCounts();
}
function frameCounts() { for (const f of board.items) if (f.type === 'frame') drawItem(f); }
function applyView() {
  const v = board.view;
  world.style.transform = 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.z + ')';
  $('#zoomPct').textContent = Math.round(v.z * 100) + '%';
  clearTimeout(applyView.t);
  applyView.t = setTimeout(() => { for (const it of board.items) if (it.type === 'image' || sel.has(it.id)) drawItem(it); }, 160);   // podmiana miniatura/pełny obraz po zakończeniu przybliżania
}

/* ---------- zapis, cofanie ---------- */
function snapshot() { undoStack.push(JSON.stringify(board.items)); if (undoStack.length > 120) undoStack.shift(); redoStack.length = 0; }
function changed() {
  dirty = true; $('#saved').textContent = _t('zapisuję…');
  clearTimeout(saveT); saveT = setTimeout(saveNow, 700);
  main.classList.toggle('isempty', board.items.length === 0);
}
async function saveNow() {
  if (!board || !dirty) return;
  clearTimeout(saveT); dirty = false;
  try { await api.boardSave(board.name, board); $('#saved').textContent = _t('zapisane'); }
  catch (e) { dirty = true; $('#saved').textContent = _t('nie udało się zapisać'); errors.push(e.message); }
  refreshBoards();
}
function undo(redo) {
  const from = redo ? redoStack : undoStack, to = redo ? undoStack : redoStack;
  if (!from.length) return;
  to.push(JSON.stringify(board.items));
  board.items = JSON.parse(from.pop());
  sel = new Set([...sel].filter(id => byId(id)));
  drawAll(); changed();
}

/* ---------- tablice ---------- */
let boardsCache = [];
async function refreshBoards() {
  const r = await api.boardsList();
  boardsCache = r.boards;
  $('#where').textContent = _t('Blaty w') + ': ' + r.dir.replace(/^.*[\\/](Documents|Dokumenty)[\\/]/, (m, d) => d + '/');
  $('#where').title = r.dir;
  const ul = $('#boards'); ul.innerHTML = '';
  for (const b of r.boards) {
    const li = document.createElement('li'); li.className = board && b.name === board.name ? 'on' : '';
    const th = document.createElement('span'); th.className = 'th';
    for (const t of b.thumbs) { const i = document.createElement('i'); i.style.backgroundImage = 'url("' + api.imageUrl(b.name, t) + '")'; th.appendChild(i); }
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = b.name;
    const sm = document.createElement('small'); sm.textContent = b.count;
    li.append(th, nm, sm);
    li.onclick = () => openBoard(b.name);
    li.oncontextmenu = e => { e.preventDefault(); showMenu(e.clientX, e.clientY, [
      [_t('Zmień nazwę…'), () => { openBoard(b.name).then(renameStart); }],
      [_t(isMac ? 'Pokaż w Finderze' : 'Pokaż w Eksploratorze'), () => api.boardReveal(b.name)],
      '-',
      [_t('Przenieś do kosza'), () => trashBoard(b.name), 'warn']]); };
    ul.appendChild(li);
  }
  return r;
}
async function openBoard(name) {
  await saveNow();
  if (board) pruneImages(board);
  const b = await api.boardLoad(name);
  if (!b) { tip(_t('Nie udało się otworzyć blatu')); return; }
  setBoard(b);
}
function setBoard(b) {
  board = b; board.items = board.items || []; board.view = board.view || { x: 0, y: 0, z: 1 };
  for (const el of els.values()) el.remove(); els.clear();
  sel.clear(); undoStack.length = 0; redoStack.length = 0;
  $('#bname').textContent = board.name; document.title = board.name + ' — Blat';
  $('#saved').textContent = '';
  applyView(); drawAll(); refreshBoards();
  if (!board.items.length) { const r = main.getBoundingClientRect(); board.view = { x: r.width / 2, y: r.height / 2, z: 1 }; applyView(); }
}
async function newBoard() { await saveNow(); const b = await api.boardNew(_t('Nowy blat')); setBoard(b); renameStart(); }
async function trashBoard(name) {
  if (board && board.name === name) { dirty = false; clearTimeout(saveT); }
  await api.boardTrash(name);
  const r = await refreshBoards();
  if (!board || board.name === name) { if (r.boards[0]) openBoard(r.boards[0].name); else newBoard(); }
}
function pruneImages(b) {
  const keep = []; for (const i of b.items) if (i.img) { if (i.img.full) keep.push(i.img.full); if (i.img.thumb) keep.push(i.img.thumb); }
  api.imagesPrune(b.name, keep);
}
function renameStart() {
  const b = $('#bname'), inp = document.createElement('input'); inp.value = board.name; b.replaceWith(inp); inp.focus(); inp.select();
  const done = async ok => {
    if (!inp.isConnected) return;
    const v = inp.value.trim(); inp.replaceWith(b);
    if (ok && v && v !== board.name) {
      await saveNow();
      const n = await api.boardRename(board.name, v);
      if (n) { board.name = n; b.textContent = n; document.title = n + ' — Blat'; dirty = true; saveNow(); drawAll(); }
      else tip(_t('Blat o tej nazwie już istnieje'));
    }
  };
  inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); };
  inp.onblur = () => done(true);
}

/* ---------- dodawanie obrazów ---------- */
const MAXFULL = 4096, THUMB = 768;
async function toBlob(bmp, max, type, q) {
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(r, type, q));
}
// obraz trafia do tablicy w dwóch wersjach: miniatura do oglądania z daleka i pełny (najwyżej 4K)
async function storeImage(blob, name) {
  const bmp = await createImageBitmap(blob);
  const id = uid(), keepOrig = Math.max(bmp.width, bmp.height) <= MAXFULL && /^image\/(jpeg|png|webp|gif)$/.test(blob.type);
  const ext = keepOrig ? ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[blob.type] : 'webp';
  const full = keepOrig ? blob : await toBlob(bmp, MAXFULL, 'image/webp', 0.9);
  const thumb = Math.max(bmp.width, bmp.height) > THUMB ? await toBlob(bmp, THUMB, 'image/webp', 0.85) : null;
  const img = { full: id + '.' + ext, thumb: thumb ? id + '-m.webp' : null, w: bmp.width, h: bmp.height, src: name || '' };
  bmp.close();
  await api.imagePut(board.name, img.full, await full.arrayBuffer());
  if (thumb) await api.imagePut(board.name, img.thumb, await thumb.arrayBuffer());
  return img;
}
// kilka obrazów naraz: układamy je w rząd od wskazanego punktu, o jednakowej wysokości
async function addImages(blobs, at) {
  if (!blobs.length) return [];
  const p = at || centerWorld();
  tip(blobs.length > 1 ? _t('Dodaję obrazy…') + ' ' + blobs.length : _t('Dodaję obraz…'));
  const H = Math.round(260 / board.view.z);   // nowe obrazy mają ok. 260 px wysokości na ekranie
  const made = [];
  for (const [blob, name] of blobs) {
    try { made.push(await storeImage(blob, name)); }
    catch (e) { tip(_t('Tego formatu Blat jeszcze nie czyta') + (name ? ': ' + name : '')); }
  }
  if (!made.length) return [];
  snapshot();
  const top = Math.max(0, ...board.items.map(i => i.z || 0)) + 1;
  let x = p.x, y = p.y - H / 2;
  const rowW = Math.max(900, Math.sqrt(made.length) * H * 1.6);
  const items = [];
  made.forEach((img, k) => {
    const w = Math.round(H * img.w / img.h);
    if (x - p.x > rowW) { x = p.x; y += H + 16; }
    const it = { id: uid(), type: 'image', x: Math.round(x), y: Math.round(y), w, h: Math.round(H), z: top + k, img };
    board.items.push(it); items.push(it); x += w + 16;
  });
  sel = new Set(items.map(i => i.id));
  drawAll(); changed();
  tip(items.length > 1 ? _t('Dodane obrazy') + ': ' + items.length : _t('Dodany obraz'));
  return items;
}
const isImgName = n => /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(n || '');
async function filesToBlobs(files) {
  const out = [];
  for (const f of files) {
    if (f.type && f.type.startsWith('image/')) out.push([f, f.name]);
    else if (isImgName(f.name)) out.push([new Blob([await f.arrayBuffer()], { type: 'image/' + f.name.split('.').pop().toLowerCase().replace('jpg', 'jpeg') }), f.name]);
    else tip(_t('Tego formatu Blat jeszcze nie czyta') + ': ' + f.name);
  }
  return out;
}

/* ---------- notatki i ramki ---------- */
function addNote(p, text) {
  snapshot();
  const it = { id: uid(), type: 'note', x: Math.round(p.x), y: Math.round(p.y), w: 320, h: 24, text: text || '', z: Math.max(0, ...board.items.map(i => i.z || 0)) + 1 };
  board.items.push(it); sel = new Set([it.id]); drawAll(); changed();
  if (!text) editNote(it);
  return it;
}
function editNote(it) {
  const el = els.get(it.id); if (!el) return;
  el.contentEditable = 'true'; el.focus();
  const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  const done = () => {
    el.contentEditable = 'false'; el.removeEventListener('blur', done);
    const t = el.innerText.replace(/\n+$/, '');
    if (!t.trim()) { board.items = board.items.filter(i => i !== it); sel.delete(it.id); drawAll(); changed(); return; }
    if (t !== it.text) { snapshot(); it.text = t; changed(); }
    drawItem(it);
  };
  el.addEventListener('blur', done);
  el.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); el.blur(); } };
}
function frameAround(list) {
  if (!list.length) return;
  snapshot();
  const b = bbox(list), pad = 20;
  const f = { id: uid(), type: 'frame', x: b.x - pad, y: b.y - pad - 26, w: b.w + 2 * pad, h: b.h + 2 * pad + 26, name: _t('Ramka'), z: 0 };
  board.items.push(f); sel = new Set([f.id]); drawAll(); changed();
  renameFrame(f);
}
function renameFrame(f) {
  const el = els.get(f.id); if (!el) return;
  const b = el.querySelector('b'), inp = document.createElement('input');
  inp.value = f.name || ''; inp.style.cssText = 'font:inherit;font-weight:500;color:var(--text);background:var(--card);border:0;outline:0;box-shadow:0 0 0 1.5px var(--text);border-radius:5px;padding:1px 5px;margin:-2px -6px;width:200px';
  b.replaceWith(inp); inp.focus(); inp.select();
  const done = ok => { if (!inp.isConnected) return; inp.replaceWith(b); if (ok && inp.value.trim() && inp.value.trim() !== f.name) { snapshot(); f.name = inp.value.trim(); changed(); } drawItem(f); };
  inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); };
  inp.onblur = () => done(true);
  inp.onpointerdown = e => e.stopPropagation();
}

/* ---------- układanie ---------- */
// zaznaczone obrazy (albo zawartość zaznaczonej ramki) w równych rzędach, od lewego górnego rogu zaznaczenia
function arrange() {
  let list = selItems().filter(i => i.type !== 'frame');
  let frame = null;
  if (!list.length) { const f = selItems().find(i => i.type === 'frame'); if (f) { frame = f; list = board.items.filter(o => o.type !== 'frame' && inside(o, f)); } }
  if (list.length < 2) { tip(_t('Zaznacz co najmniej dwa obrazy')); return; }
  snapshot();
  const b = bbox(list), gap = 16;
  const imgs = list.filter(i => i.type === 'image'), notes = list.filter(i => i.type !== 'image');
  const H = imgs.length ? imgs.map(i => i.h).sort((a, c) => a - c)[Math.floor(imgs.length / 2)] : 200;
  const area = imgs.reduce((s, i) => s + (i.w / i.h) * H * H, 0);
  const rowW = Math.max(H * 2, Math.sqrt(area) * 1.5);
  let x = b.x, y = b.y, row = [];
  const flush = () => { if (!row.length) return; x = b.x; y += H + gap; row = []; };
  for (const i of imgs) { const w = Math.round(H * i.w / i.h); if (x > b.x && x - b.x + w > rowW) flush(); i.x = Math.round(x); i.y = Math.round(y); i.w = w; i.h = Math.round(H); x += w + gap; row.push(i); }
  if (row.length) y += H + gap;
  for (const n of notes) { n.x = b.x; n.y = Math.round(y); y += (n.h || 24) + gap; }
  if (frame) { const nb = bbox(list); frame.x = nb.x - 20; frame.y = nb.y - 46; frame.w = nb.w + 40; frame.h = nb.h + 66; }
  drawAll(); changed();
}

/* ---------- widok ---------- */
function zoomAt(f, cx, cy) {
  const v = board.view, r = main.getBoundingClientRect();
  if (cx == null) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
  const nz = Math.max(0.05, Math.min(8, v.z * f)), k = nz / v.z;
  v.x = cx - r.left - (cx - r.left - v.x) * k; v.y = cy - r.top - (cy - r.top - v.y) * k; v.z = nz;
  applyView(); changedView();
}
function fit(list) {
  list = list || board.items; if (!list.length) return;
  const b = bbox(list), r = main.getBoundingClientRect(), pad = 60;
  const z = Math.max(0.05, Math.min(2, Math.min((r.width - 2 * pad) / b.w, (r.height - 2 * pad) / b.h)));
  board.view = { z, x: r.width / 2 - (b.x + b.w / 2) * z, y: r.height / 2 - (b.y + b.h / 2) * z };
  applyView(); changedView();
}
let viewT = 0;
function changedView() { clearTimeout(viewT); viewT = setTimeout(() => { dirty = true; saveNow(); }, 1500); }   // widok zapisujemy po cichu

/* ---------- myszka ---------- */
let drag = null, spaceDown = false;
main.addEventListener('pointerdown', e => {
  if (e.target.closest('input')) return;
  const it = e.target.closest('.it'), item = it && byId(it.dataset.id);
  if (item && item.type === 'note' && els.get(item.id).contentEditable === 'true') return;
  main.focus({ preventScroll: true });
  hideMenu();
  const w = toWorld(e.clientX, e.clientY);
  if (e.button === 1 || spaceDown || (e.button === 0 && e.altKey && !item)) {
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: board.view.x, vy: board.view.y }; main.classList.add('panning');
  } else if (e.button !== 0) return;
  else if (tool === 'note') { addNote(w); setTool('select'); return; }
  else if (tool === 'frame') { snapshot(); const f = { id: uid(), type: 'frame', x: w.x, y: w.y, w: 1, h: 1, name: _t('Ramka'), z: 0 }; board.items.push(f); sel = new Set([f.id]); drawAll(); drag = { kind: 'newframe', f, ox: w.x, oy: w.y }; }
  else if (e.target.classList.contains('hd') && item) {
    snapshot(); drag = { kind: 'resize', item, ox: w.x, oy: w.y, w0: item.w, h0: item.h, ratio: item.type === 'image' ? item.w / item.h : 0 };
  } else if (item) {
    if (e.shiftKey || e.metaKey || e.ctrlKey) { sel.has(item.id) ? sel.delete(item.id) : sel.add(item.id); }
    else if (!sel.has(item.id)) sel = new Set([item.id]);
    // ramka przesuwa się razem z tym, co w niej leży
    const moving = movingSet();
    drag = { kind: 'move', ox: w.x, oy: w.y, start: [...moving].map(id => { const o = byId(id); return [o, o.x, o.y]; }), moved: false };
    drawAll();
  } else {
    if (!e.shiftKey) sel.clear();
    drag = { kind: 'marq', ox: w.x, oy: w.y, sx: e.clientX, sy: e.clientY, base: new Set(sel) };
    drawAll();
  }
  main.setPointerCapture(e.pointerId);
});
main.addEventListener('pointermove', e => {
  if (!drag) return;
  if (!(e.buttons & 7)) { endDrag(); return; }
  const w = toWorld(e.clientX, e.clientY);
  if (drag.kind === 'pan') { board.view.x = drag.vx + e.clientX - drag.sx; board.view.y = drag.vy + e.clientY - drag.sy; applyView(); }
  else if (drag.kind === 'move') {
    const dx = w.x - drag.ox, dy = w.y - drag.oy;
    if (!drag.moved && Math.hypot(dx, dy) * board.view.z < 3) return;
    if (!drag.moved) { drag.moved = true; snapshot(); }
    for (const [o, x, y] of drag.start) { o.x = Math.round(x + dx); o.y = Math.round(y + dy); drawItem(o); }
  } else if (drag.kind === 'resize') {
    const it = drag.item; let nw = Math.max(24, drag.w0 + w.x - drag.ox), nh = Math.max(24, drag.h0 + w.y - drag.oy);
    if (drag.ratio) nh = nw / drag.ratio;
    it.w = Math.round(nw); if (it.type !== 'note') it.h = Math.round(nh); drawItem(it);
  } else if (drag.kind === 'newframe') {
    const f = drag.f; f.x = Math.min(drag.ox, w.x); f.y = Math.min(drag.oy, w.y); f.w = Math.abs(w.x - drag.ox); f.h = Math.abs(w.y - drag.oy); drawItem(f);
  } else if (drag.kind === 'marq') {
    const m = $('#marq'), r = main.getBoundingClientRect();
    const x1 = Math.min(drag.sx, e.clientX) - r.left, y1 = Math.min(drag.sy, e.clientY) - r.top;
    Object.assign(m.style, { display: 'block', left: x1 + 'px', top: y1 + 'px', width: Math.abs(e.clientX - drag.sx) + 'px', height: Math.abs(e.clientY - drag.sy) + 'px' });
    const q = { x: Math.min(drag.ox, w.x), y: Math.min(drag.oy, w.y), w: Math.abs(w.x - drag.ox), h: Math.abs(w.y - drag.oy) };
    sel = new Set(drag.base);
    for (const o of board.items) if (o.x < q.x + q.w && o.x + o.w > q.x && o.y < q.y + q.h && o.y + o.h > q.y && (o.type !== 'frame' || (o.x >= q.x && o.y >= q.y && o.x + o.w <= q.x + q.w && o.y + o.h <= q.y + q.h))) sel.add(o.id);
    for (const o of board.items) els.get(o.id).classList.toggle('sel', sel.has(o.id));
  }
});
function endDrag() {
  if (!drag) return;
  const d = drag; drag = null;
  main.classList.remove('panning'); $('#marq').style.display = 'none';
  if (d.kind === 'pan') changedView();
  if (d.kind === 'move' && d.moved) { changed(); frameCounts(); }
  if (d.kind === 'resize') { changed(); drawItem(d.item); }
  if (d.kind === 'newframe') {
    if (d.f.w < 20 || d.f.h < 20) { board.items = board.items.filter(i => i !== d.f); sel.clear(); undoStack.pop(); }
    else { d.f.x = Math.round(d.f.x); d.f.y = Math.round(d.f.y); d.f.w = Math.round(d.f.w); d.f.h = Math.round(d.f.h); changed(); setTool('select'); renameFrame(d.f); }
  }
  drawAll();
}
main.addEventListener('pointerup', endDrag);
main.addEventListener('pointercancel', endDrag);
main.addEventListener('dblclick', e => {
  const el = e.target.closest('.it'), it = el && byId(el.dataset.id);
  if (!it) { addNote(toWorld(e.clientX, e.clientY)); return; }
  if (it.type === 'note') editNote(it);
  if (it.type === 'frame' && e.target.closest('.fl')) renameFrame(it);
  if (it.type === 'image') fit([it]);
});
// kółko: przesuwanie; Ctrl/⌘ + kółko albo szczypanie na gładziku: przybliżanie wokół kursora
main.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) { const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY; zoomAt(Math.exp(-Math.max(-120, Math.min(120, d)) / (Math.abs(d) < 40 ? 120 : 400)), e.clientX, e.clientY); }
  else { board.view.x -= e.shiftKey ? e.deltaY : e.deltaX; board.view.y -= e.shiftKey ? 0 : e.deltaY; applyView(); changedView(); }
}, { passive: false });
main.addEventListener('contextmenu', e => {
  e.preventDefault();
  const el = e.target.closest('.it'), it = el && byId(el.dataset.id);
  if (it && !sel.has(it.id)) { sel = new Set([it.id]); drawAll(); }
  const p = toWorld(e.clientX, e.clientY);
  showMenu(e.clientX, e.clientY, sel.size ? [
    [_t('Ułóż'), arrange, 'A'],
    [_t('Ramka wokół zaznaczonych'), () => frameAround(selItems()), MOD + 'G'],
    [_t('Na wierzch'), () => reorder(1)], [_t('Na spód'), () => reorder(-1)],
    [_t('Pokaż'), () => fit(selItems()), 'Z'],
    '-', [_t('Usuń'), removeSel, 'Del', 'warn']
  ] : [
    [_t('Notatka'), () => addNote(p), 'T'],
    [_t('Wklej'), () => pasteFromClipboard(p), MOD + 'V'],
    [_t('Pokaż wszystko'), () => fit(), '0'],
    '-', [_t(isBare() ? 'Pokaż interfejs' : 'Ukryj interfejs'), () => toggleBare(), 'Tab'],
    [_t('Skróty klawiszowe'), () => toggleKeys(true), '?']
  ]);
});
function reorder(d) {
  snapshot();
  const zs = board.items.map(i => i.z || 0);
  let top = Math.max(0, ...zs), bot = Math.min(0, ...zs);
  for (const it of selItems()) it.z = d > 0 ? ++top : --bot;
  drawAll(); changed();
}
function removeSel() {
  if (!sel.size) return;
  snapshot();
  board.items = board.items.filter(i => !sel.has(i.id)); sel.clear(); drawAll(); changed();
}

/* ---------- przeciąganie i schowek ---------- */
let dragDepth = 0;
main.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; main.classList.add('drag'); dropHint(e); });
main.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; main.classList.remove('drag'); emptyTexts(); } });
main.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
function dropHint(e) {
  const n = e.dataTransfer && e.dataTransfer.items ? [...e.dataTransfer.items].filter(i => i.kind === 'file').length : 0;
  $('#emptyBig').textContent = n > 1 ? _t('Upuść tutaj obrazy') + ' (' + n + ')' : _t('Upuść tutaj');
}
main.addEventListener('drop', async e => {
  e.preventDefault(); dragDepth = 0; main.classList.remove('drag'); emptyTexts();
  const p = toWorld(e.clientX, e.clientY);
  const files = [...e.dataTransfer.files];
  if (files.length) { addImages(await filesToBlobs(files), p); return; }
  // obraz przeciągnięty z przeglądarki internetowej bez pliku: pobieramy go z adresu
  const url = (e.dataTransfer.getData('text/uri-list') || '').split('\n').find(u => /^https?:/.test(u)) || ((e.dataTransfer.getData('text/html') || '').match(/<img[^>]+src="([^"]+)"/) || [])[1];
  if (url) { try { const r = await fetch(url); const b = await r.blob(); if (b.type.startsWith('image/')) { addImages([[b, url.split('/').pop().split('?')[0]]], p); return; } } catch (err) {} tip(_t('Nie udało się pobrać obrazu z przeglądarki')); return; }
  const text = e.dataTransfer.getData('text/plain');
  if (text) addNote(p, text);
});
document.addEventListener('paste', async e => {
  if (e.target.closest && (e.target.closest('input') || e.target.isContentEditable)) return;
  e.preventDefault();
  const p = lastPointer ? toWorld(lastPointer.x, lastPointer.y) : centerWorld();
  const files = [...(e.clipboardData.files || [])];
  if (files.length) { addImages(await filesToBlobs(files), p); return; }
  const text = e.clipboardData.getData('text/plain');
  if (text) addNote(p, text);
});
async function pasteFromClipboard(p) {
  try {
    for (const ci of await navigator.clipboard.read()) {
      const t = ci.types.find(x => x.startsWith('image/'));
      if (t) { addImages([[await ci.getType(t), 'schowek']], p); return; }
      if (ci.types.includes('text/plain')) { addNote(p, await (await ci.getType('text/plain')).text()); return; }
    }
  } catch (e) { tip(_t('Schowek jest pusty')); }
}
let lastPointer = null;
main.addEventListener('pointermove', e => { lastPointer = { x: e.clientX, y: e.clientY }; }, { passive: true });

/* ---------- klawiatura ---------- */
function setTool(t) {
  tool = t;
  for (const b of document.querySelectorAll('#tools .ib')) b.classList.toggle('on', b.dataset.tool === t);
  main.className = main.className.replace(/\btool-\w+/g, '').trim(); if (t !== 'select') main.classList.add('tool-' + t);
}
addEventListener('keydown', e => {
  if (e.target.closest && (e.target.closest('input') || e.target.isContentEditable)) return;
  const k = e.key.toLowerCase(), mod = e.metaKey || e.ctrlKey;
  if (keysOpen()) { if (k === 'escape' || k === '?') { e.preventDefault(); toggleKeys(false); } return; }
  if (k === '?') { e.preventDefault(); toggleKeys(true); return; }
  // pełny ekran: Ctrl+spacja na Windows (na Macu systemowe ⌃⌘F); Esc wychodzi, jeśli pełny ekran włączono stąd
  if (!isMac && e.ctrlKey && !e.shiftKey && !e.altKey && k === ' ' && !e.repeat && !spaceDown) { e.preventDefault(); fullscreenToggle(); return; }
  if (k === ' ' && !spaceDown) { spaceDown = true; main.classList.add('space'); e.preventDefault(); return; }
  if (mod && k === 'z') { e.preventDefault(); undo(e.shiftKey); return; }
  if (mod && k === 'y') { e.preventDefault(); undo(true); return; }
  if (mod && k === 'a') { e.preventDefault(); sel = new Set(board.items.map(i => i.id)); drawAll(); return; }
  if (mod && k === 'g') { e.preventDefault(); frameAround(selItems()); return; }
  if (mod && k === 'n') { e.preventDefault(); newBoard(); return; }
  if (mod && (k === '=' || k === '+')) { e.preventDefault(); zoomAt(1.25); return; }
  if (mod && k === '-') { e.preventDefault(); zoomAt(0.8); return; }
  if (mod && k === 's') { e.preventDefault(); dirty = true; saveNow(); return; }
  if (mod) return;
  if (k === 'delete' || k === 'backspace') { e.preventDefault(); removeSel(); }
  else if (k === 'escape') { if (isFs() && fsBare !== null && !sel.size && tool === 'select') fullscreenToggle(); sel.clear(); setTool('select'); drawAll(); hideMenu(); }
  else if (k === 'v') setTool('select');
  else if (k === 't') setTool('note');
  else if (k === 'f') setTool('frame');
  else if (k === 'a') arrange();
  else if (k === 'p') toggleTop();
  else if (k === '0') fit();
  else if (k === '1') zoomAt(1 / board.view.z);
  else if (k === 'z') sel.size ? fit(selItems()) : fit();
  else if (k === 'tab') { e.preventDefault(); toggleBare(); }
  else if (k.startsWith('arrow') && sel.size) {
    e.preventDefault(); snapshot();
    const s = e.shiftKey ? 50 : 5, dx = k === 'arrowleft' ? -s : k === 'arrowright' ? s : 0, dy = k === 'arrowup' ? -s : k === 'arrowdown' ? s : 0;
    for (const id of movingSet()) { const o = byId(id); o.x += dx; o.y += dy; drawItem(o); } changed();
  }
});
addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; main.classList.remove('space'); } });
addEventListener('blur', () => { spaceDown = false; main.classList.remove('space'); });

/* ---------- menu ---------- */
function showMenu(x, y, rows) {
  const m = $('#menu'); m.innerHTML = '';
  for (const r of rows) {
    if (r === '-') { m.appendChild(document.createElement('hr')); continue; }
    const b = document.createElement('button'); if (r[3] === 'warn' || r[2] === 'warn') b.className = 'warn';
    b.innerHTML = '<span></span>' + (r[2] && r[2] !== 'warn' ? '<kbd>' + r[2] + '</kbd>' : '');
    b.firstChild.textContent = r[0];
    b.onclick = () => { hideMenu(); r[1](); };
    m.appendChild(b);
  }
  m.style.display = 'block';
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.min(x, innerWidth - w - 8) + 'px'; m.style.top = Math.min(y, innerHeight - h - 8) + 'px';
}
function hideMenu() { $('#menu').style.display = 'none'; }
addEventListener('pointerdown', e => { if (!e.target.closest('#menu')) hideMenu(); }, true);

/* ---------- pasek, panel boczny ---------- */
function toggleSide(v) { const on = v == null ? document.body.classList.contains('noside') : v; document.body.classList.toggle('noside', !on); if (v == null) api.setSide(on); }
// tryb bez nawigacji (jak w Gapie): Tab chowa pasek i listę tablic, zostaje samo płótno
const isBare = () => document.body.classList.contains('bare');
const isFs = () => document.documentElement.classList.contains('fs');
function toggleBare(v) {
  const r0 = main.getBoundingClientRect();
  document.body.classList.toggle('bare', v == null ? !isBare() : !!v);
  // płótno zostaje w tym samym miejscu na ekranie, choć zmienia rozmiar
  const r1 = main.getBoundingClientRect();
  if (board) { board.view.x += r0.left - r1.left; board.view.y += r0.top - r1.top; applyView(); }
  if (api.setBare) api.setBare(isBare());
  syncButtons(); applyTheme(); pillTips();
  if (v == null) tip(isBare() ? _t('Tab pokazuje interfejs') : _t('Interfejs widoczny'));
}
let fsBare = null;
function fullscreenToggle() {
  if (api.fullscreenToggle) api.fullscreenToggle();
  else if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {});
}
// pełny ekran (skrót, pastylka, ⌃⌘F albo zielony przycisk na Macu) od razu chowa interfejs; po wyjściu wraca poprzedni stan
function onFullscreen(v) {
  document.documentElement.classList.toggle('fs', v);
  if (v && fsBare === null) { fsBare = isBare(); if (!fsBare) toggleBare(true); }
  else if (!v && fsBare !== null) { if (!fsBare) toggleBare(false); fsBare = null; }
  syncButtons(); applyTheme(); pillTips();
}
// przyciski okna na Macu: ukryte w trybie bez nawigacji (poza pełnym ekranem), dopóki mysz stoi
let btnShown = true;
function syncButtons() {
  const v = !isMac || !isBare() || isFs() || document.body.classList.contains('moving');
  if (v !== btnShown && api.windowButtons) { btnShown = v; api.windowButtons(v); }
}
const FSK = isMac ? '⌃⌘F' : 'Ctrl+' + _t('spacja');
function pillTips() {
  $('#pillUi').title = _t('Pokaż interfejs') + ' (Tab)';
  $('#pillFs').title = isFs() ? _t('Wyjdź z pełnego ekranu') + ' (' + FSK + ' / Esc)' : _t('Pełny ekran') + ' (' + FSK + ')';
}
// ściąga skrótów (?), jak w Gapie; opisy zależą od systemu (Mac / Windows)
const keysOpen = () => $('#keys').classList.contains('on');
function renderKeys() {
  const K = (k, t, c) => '<div class="k' + (c ? ' ' + c : '') + '"><i>' + k + '</i><small>' + t + '</small></div>';
  const row = (m, ks) => '<div class="kr" style="margin-left:' + m + 'px">' + ks.join('') + '</div>';
  const L = [
    [MOD + 'V', _t('wklej obraz albo tekst')], [MOD + 'G', _t('ramka wokół zaznaczonych')],
    [isMac ? '⌘Z  ⇧⌘Z' : 'Ctrl+Z  Ctrl+Y', _t('cofnij / ponów')], [MOD + 'N', _t('nowy blat')],
    [MOD + 'A', _t('zaznacz wszystko')], [isMac ? '⌘ + ' + _t('kółko') : 'Ctrl + ' + _t('kółko'), _t('przybliżanie')],
    [_t('strzałki'), _t('przesuń zaznaczone') + ' (⇧ ×10)'], [isMac ? '⌫' : 'Delete', _t('usuń zaznaczone')],
    [(isMac ? '⌥' : 'Alt') + ' + ' + _t('przeciąganie'), _t('przesuwanie płótna')], [FSK, _t('pełny ekran')],
  ];
  $('#keys').innerHTML = '<div class="kc"><div class="kh"><b>' + _t('Skróty klawiszowe') + '</b><span>' + _t('? otwiera tę ściągę · Esc zamyka') + '</span></div>'
    + row(0, [K('1', _t('100%')), K('0', _t('całość'))])
    + row(20, [K('T', _t('notatka')), K('P', _t('zawsze na wierzchu'))])
    + row(34, [K('A', _t('ułóż zaznaczone')), K('F', _t('ramka'))])
    + row(54, [K('Z', _t('dopasuj zaznaczone')), K('V', _t('zaznaczanie') + '<em>Esc ' + _t('odznacz') + '</em>')])
    + row(0, [K('Tab', _t('ukryj interfejs'), 'w'), K(_t('spacja'), _t('przytrzymaj i przeciągnij: przesuwanie płótna'), 'sp')])
    + '<div class="km">' + L.map(([k, t]) => '<div><kbd>' + k + '</kbd>' + t + '</div>').join('') + '</div></div>';
}
function toggleKeys(v) { const o = $('#keys'); v = v == null ? !keysOpen() : v; if (v) renderKeys(); o.classList.toggle('on', v); if (v) try { localStorage.setItem('blatSeenKeys', '1'); } catch (e) {} }
let onTop = false;
function toggleTop(v) { onTop = v == null ? !onTop : v; $('#topBtn').classList.toggle('on', onTop); if (v == null) { api.setOnTop(onTop); tip(onTop ? _t('Blat zostaje na wierzchu') : _t('Blat zachowuje się jak zwykłe okno')); } }
function emptyTexts() {
  $('#emptyBig').textContent = _t('Puste płótno');
  $('#emptySub').textContent = _t('Przeciągnij obrazy z Gapy, Eksploratora albo przeglądarki, albo wklej je ze schowka.').replace('Eksploratora', isMac ? 'Findera' : 'Eksploratora').replace('Explorer', isMac ? 'Finder' : 'Explorer');
  $('#emptyKeys').innerHTML = [[MOD + 'V', 'wklej'], ['T', 'notatka'], ['F', 'ramka'], [_t('Spacja'), 'przesuwanie płótna']].map(([k, t]) => '<span><kbd>' + k + '</kbd>' + _t(t) + '</span>').join('');
}
function initUi() {
  document.documentElement.classList.add(api.web ? 'frame-web' : isMac ? 'frame-mac' : 'frame-win');
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = _t(el.dataset.t);
  $('#sideBtn').innerHTML = IC.side; $('#sideBtn').title = _t('Panel boczny'); $('#sideBtn').onclick = () => toggleSide();
  $('#newBtn').innerHTML = IC.plus; $('#newBtn').title = _t('Nowy blat') + ' (' + MOD + 'N)'; $('#newBtn').onclick = newBoard;
  $('#arrangeBtn').innerHTML = IC.arrange; $('#arrangeBtn').title = _t('Ułóż zaznaczone') + ' (A)'; $('#arrangeBtn').onclick = arrange;
  $('#topBtn').innerHTML = IC.pin; $('#topBtn').title = _t('Zawsze na wierzchu') + ' (P)'; $('#topBtn').onclick = () => toggleTop();
  $('#keysBtn').innerHTML = IC.keys; $('#keysBtn').title = _t('Skróty klawiszowe') + ' (?)'; $('#keysBtn').onclick = () => toggleKeys(true);
  $('#keys').addEventListener('click', e => { if (!e.target.closest('.kc')) toggleKeys(false); });
  $('#themeBtn').onclick = () => { localStorage.setItem('blatTheme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); applyTheme(); };
  $('#bname').ondblclick = renameStart; $('#bname').title = _t('Dwuklik zmienia nazwę');
  $('#where').onclick = () => api.boardReveal();
  $('#zoomHint').textContent = MOD + _t('kółko');
  const tools = [['select', IC.select, 'Zaznaczanie', 'V'], ['note', IC.note, 'Notatka', 'T'], ['frame', IC.frame, 'Ramka', 'F']];
  $('#tools').innerHTML = tools.map(([t, ic, n, k]) => '<button class="ib" data-tool="' + t + '" title="' + _t(n) + ' (' + k + ')">' + ic + '</button>').join('');
  for (const b of document.querySelectorAll('#tools .ib')) b.onclick = () => setTool(b.dataset.tool);
  // pastylka w trybie bez nawigacji: pojawia się przy ruchu myszy, znika po dwóch sekundach
  $('#pillUi').innerHTML = IC.ui; $('#pillUi').onclick = e => { e.stopPropagation(); toggleBare(false); };
  $('#pillFs').innerHTML = IC.fs; $('#pillFs').onclick = e => { e.stopPropagation(); fullscreenToggle(); };
  let idleT = 0;
  addEventListener('mousemove', () => { document.body.classList.add('moving'); syncButtons(); clearTimeout(idleT); idleT = setTimeout(() => { document.body.classList.remove('moving'); syncButtons(); }, 2000); }, { passive: true });
  if (api.onFullscreen) api.onFullscreen(onFullscreen); else document.addEventListener('fullscreenchange', () => onFullscreen(!!document.fullscreenElement));
  setTool('select'); emptyTexts(); applyTheme(); pillTips();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  addEventListener('beforeunload', () => { if (dirty) api.boardSave(board.name, board); });
  // aktualizacje: dyskretna informacja w panelu bocznym
  if (api.onUpdateStatus) {
    const show = s => { const b = $('#upd'); b.hidden = !(s && (s.state === 'available' || s.state === 'downloading' || s.state === 'ready'));
      if (!b.hidden) b.textContent = s.state === 'available' ? _t('Nowa wersja') + ' ' + s.version : s.state === 'downloading' ? _t('Pobieram') + ' ' + (s.size ? Math.round(s.got / s.size * 100) + '%' : '') : _t('Instaluję…'); };
    api.onUpdateStatus(show); api.updateGet().then(show);
    $('#upd').onclick = () => api.updateInstall();
  }
}

/* ---------- polecenia testowe (umiejętność test-w-przegladarce) ---------- */
window.blatTest = {
  state: () => ({ board: board && board.name, items: board ? board.items.length : 0, sel: [...sel], view: board && { ...board.view }, tool, dirty, errors: errors.slice() }),
  items: () => JSON.parse(JSON.stringify(board.items)),
  // n sztucznych obrazów w kolorach — do testów i do sprawdzianu wydajności
  async addTest(n = 4, w = 1600, h = 1000) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      g.fillStyle = 'hsl(' + (i * 47 % 360) + ',25%,' + (45 + i % 3 * 10) + '%)'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.6)'; g.font = Math.round(h / 4) + 'px sans-serif'; g.fillText(String(i + 1), w / 10, h / 2);
      out.push([await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8)), 'test-' + (i + 1) + '.jpg']);
    }
    return (await addImages(out)).map(i => i.id);
  },
  note: (x, y, text) => addNote({ x, y }, text).id,
  select: ids => { sel = new Set(ids); drawAll(); },
  selectAll: () => { sel = new Set(board.items.map(i => i.id)); drawAll(); },
  move: (dx, dy) => { snapshot(); for (const o of [...movingSet()].map(byId)) { o.x += dx; o.y += dy; } drawAll(); changed(); },
  frame: name => { frameAround(selItems()); const f = selItems()[0]; const inp = f && els.get(f.id).querySelector('input'); if (inp) { if (name) inp.value = name; inp.blur(); } return f && f.id; },
  bare: v => { toggleBare(v); return isBare(); },
  keys: v => { toggleKeys(v); return keysOpen(); },
  arrange, fit: () => fit(), zoom: f => zoomAt(f), undo: () => undo(false), redo: () => undo(true), remove: removeSel,
  save: () => { dirty = true; return saveNow(); }, open: openBoard, newBoard: async name => { await saveNow(); setBoard(await api.boardNew(name || 'Test')); return board.name; },
  // sprawdziany (umiejętność `sprawdziany`): każdy zgłoszony błąd dopisujemy tu jako przypadek; zwraca listę porażek
  async sprawdziany() {
    const fail = [], ok = (c, m) => { if (!c) fail.push(m); };
    const name = await this.newBoard('Sprawdzian ' + Date.now());
    const ids = await this.addTest(3, 800, 600);
    ok(board.items.length === 3, 'dodanie 3 obrazów');
    ok(board.items.every(i => i.img && i.img.full), 'obraz ma zapisany plik');
    ok(Math.abs(board.items[0].w / board.items[0].h - 800 / 600) < 0.02, 'proporcje obrazu');
    this.select(ids.slice(0, 2)); const f = this.frame('Ramka testowa');
    ok(byId(f) && byId(f).type === 'frame' && byId(f).name === 'Ramka testowa', 'ramka wokół zaznaczonych z nazwą');
    const a0 = byId(ids[0]).x; this.select([f]); this.move(100, 0);
    ok(byId(ids[0]).x === a0 + 100, 'ramka przesuwa swoją zawartość');
    this.undo(); ok(byId(ids[0]).x === a0, 'cofnięcie przesunięcia');
    this.redo(); ok(byId(ids[0]).x === a0 + 100, 'ponowienie');
    const n = this.note(0, -300, 'notatka testowa'); ok(byId(n) && byId(n).text === 'notatka testowa', 'notatka z tekstem');
    this.select(ids); arrange(); const ys = new Set(ids.map(i => byId(i).h)); ok(ys.size === 1, 'ułożone obrazy mają równą wysokość');
    await this.save(); const back = await api.boardLoad(name);
    ok(back && back.items.length === board.items.length, 'zapis i ponowne wczytanie');
    this.select([n]); this.remove(); ok(!byId(n), 'usunięcie'); this.undo(); ok(!!byId(n), 'cofnięcie usunięcia');
    const mw = main.getBoundingClientRect().width; this.bare(true);
    ok(getComputedStyle($('header')).display === 'none' && getComputedStyle($('aside')).display === 'none', 'tryb bez nawigacji chowa pasek i listę blatów');
    ok(main.getBoundingClientRect().width > mw && Math.abs(main.getBoundingClientRect().width - innerWidth) < 2, 'płótno w trybie bez nawigacji zajmuje całą szerokość');
    { const de = document.documentElement, was = [...de.classList].find(c => c.startsWith('frame-')); de.classList.replace(was, 'frame-mac');
      ok(Math.abs(main.getBoundingClientRect().top) < 1, 'na Macu w trybie bez nawigacji płótno sięga górnej krawędzi'); de.classList.replace('frame-mac', was); }
    this.bare(false); ok(getComputedStyle($('header')).display !== 'none' && Math.abs(main.getBoundingClientRect().width - mw) < 2, 'powrót interfejsu');
    // okno da się przesuwać: niewidoczna warstwa z no-drag nie może leżeć nad paskiem (Electron liczy obszary przeciągania bez względu na przezroczystość)
    { const hr = $('header').getBoundingClientRect(), bad = [...document.querySelectorAll('body *')].filter(el => {
        const cs = getComputedStyle(el); if (cs.getPropertyValue('-webkit-app-region') !== 'no-drag' || el.closest('header')) return false;
        const hidden = cs.opacity === '0' || cs.pointerEvents === 'none' || cs.visibility === 'hidden'; if (!hidden || cs.display === 'none') return false;
        const r = el.getBoundingClientRect(); return r.width && r.height && r.left < hr.right && r.right > hr.left && r.top < hr.bottom && r.bottom > hr.top; });
      ok(!bad.length, 'pasek okna nie jest zasłonięty niewidoczną warstwą (' + bad.map(e => e.id || e.className).join(', ') + ')'); }
    this.keys(true); ok(keysOpen() && $('#keys .kc') && $('#keys .kc').getBoundingClientRect().width < innerWidth, 'ściąga skrótów otwiera się i mieści w oknie');
    this.keys(false); ok(!keysOpen(), 'ściąga skrótów się zamyka');
    await api.boardTrash(name); await refreshBoards();
    return fail;
  },
  // płynność: ile klatek na sekundę przy przesuwaniu i przybliżaniu płótna przez ok. sekundę
  async fps(ms = 1000) {
    let frames = 0; const t0 = performance.now(), v0 = { ...board.view };
    await new Promise(res => { const step = t => { frames++; const k = (t - t0) / ms; board.view.x = v0.x + Math.sin(k * 6) * 300; board.view.z = v0.z * (1 + 0.3 * Math.sin(k * 3)); applyView(); if (t - t0 < ms) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
    board.view = v0; applyView();
    return Math.round(frames / ((performance.now() - t0) / 1000));
  },
};

/* ---------- start ---------- */
(async () => {
  initUi();
  try { const u = await api.uiState(); toggleSide(u.side); toggleTop(u.onTop); } catch (e) {}
  const r = await refreshBoards();
  const name = r.last && r.boards.some(b => b.name === r.last) ? r.last : r.boards[0] && r.boards[0].name;
  try { if (!api.web && !localStorage.getItem('blatSeenKeys')) setTimeout(() => toggleKeys(true), 1400); } catch (e) {}
  if (name) await openBoard(name); else setBoard(await api.boardNew(_t('Pierwszy blat')));
})();
