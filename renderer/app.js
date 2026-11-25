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
  gum: svg('<path d="M6.2 13.5h7.3M2.9 9.8l6.6-6.6a1.5 1.5 0 0 1 2.1 0l1.8 1.8a1.5 1.5 0 0 1 0 2.1L7.8 13.5H6.2L2.9 10.2a.3.3 0 0 1 0-.4z"/><path d="M5.6 7.1l4.3 4.3"/>'),
  pen: svg('<path d="M3 13l.9-3.2 7-7a1.6 1.6 0 0 1 2.3 2.3l-7 7z"/><path d="M9.6 4.1l2.3 2.3"/>'),
  // porządkowanie: dwa paski jeden pod drugim (w 15 px musi być bardzo proste)
  arrange: svg('<rect x="2.5" y="3.5" width="11" height="3.5" rx="1"/><rect x="2.5" y="9" width="11" height="3.5" rx="1"/>'),
  // przypinka: klasyczna pinezka przechylona o 45° (wybór Michała 25.11.2026); przypięta ma pełną główkę
  pin: svg('<g transform="rotate(45 8 8)"><path d="M5.5 2.5h5l-.8 4.5h-3.4z"/><path d="M6.3 7h3.4l1.8 2.5h-7zM8 9.5v4.5"/></g>'),
  pinOn: svg('<g transform="rotate(45 8 8)"><path d="M5.5 2.5h5l-.8 4.5h-3.4z" fill="currentColor"/><path d="M6.3 7h3.4l1.8 2.5h-7zM8 9.5v4.5"/></g>'),
  plus: svg('<path d="M8 3v10M3 8h10"/>', 13),
  moon: svg('<path d="M13.2 10.1A5.6 5.6 0 0 1 5.9 2.8a5.6 5.6 0 1 0 7.3 7.3z"/>'),
  ui: svg('<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6.2h12"/>'),
  fs: svg('<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>') + svg('<path d="M6 2.5V6H2.5M13.5 6H10V2.5M10 13.5V10h3.5M2.5 10H6v3.5"/>'),
  set: svg('<path d="M2.5 5.5h11M2.5 10.5h11"/><circle cx="6" cy="5.5" r="1.8" fill="var(--bg)"/><circle cx="10.5" cy="10.5" r="1.8" fill="var(--bg)"/>'),
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
function movingSet() {
  const m = new Set(sel); for (const id of sel) { const f = byId(id); if (f && f.type === 'frame') for (const o of board.items) if (o.type !== 'frame' && inside(o, f)) m.add(o.id); }
  for (const o of board.items) if (o.type === 'drawing' && o.parent && m.has(o.parent)) m.add(o.id);   // kreski mazaka jadą ze swoim obrazem
  return m;
}
/* ---------- mazak ---------- */
// Kreska to element „drawing”: punkty względem (x, y) w rozmiarze bazowym bw × bh, grubość sw, kolor c,
// parent = id obrazu, na którym ją narysowano (przesuwa się, skaluje i znika razem z nim).
const PEN = '#E5484D';
// kolory mazaka (ostatni to półprzezroczysty zakreślacz) i grubości w px na ekranie
const PENS = [['#E5484D', 'Czerwony'], ['#1a1a19', 'Czarny'], ['#2F5BEA', 'Niebieski'], ['#FFD21F', 'Zakreślacz', true]];
const SIZES = [[2, 'Cienki'], [4, 'Średni'], [8, 'Gruby']];
let penSt = { c: 0, w: 1 }, gum = false;
try { Object.assign(penSt, JSON.parse(localStorage.getItem('blatPen') || '{}')); } catch (e) {}
const penPx = (c, w) => SIZES[w][0] * (PENS[c][2] ? 2.2 : 1);
function penSel() { return board ? selItems().filter(i => i.type === 'drawing') : []; }
// zmiana koloru/grubości: na zaznaczonych kreskach albo jako ustawienie mazaka
function setPen(o) {
  const ds = penSel();
  if (ds.length && tool !== 'pen') {
    snapshot();
    for (const d of ds) {
      const ci = o.c != null ? o.c : Math.max(0, PENS.findIndex(p => p[0] === d.c)), cur = d.w / d.bw;
      const wi = o.w != null ? o.w : SIZES.reduce((b, s, i) => Math.abs(s[0] * (d.hl ? 2.2 : 1) - d.sw * cur * board.view.z) < Math.abs(SIZES[b][0] * (d.hl ? 2.2 : 1) - d.sw * cur * board.view.z) ? i : b, 0);
      d.c = PENS[ci][0]; d.hl = !!PENS[ci][2]; d.sw = penPx(ci, wi) / (board.view.z * cur);
    }
    drawAll(); changed(); return;
  }
  if (o.c != null) penSt.c = o.c; if (o.w != null) penSt.w = o.w;
  gum = false; try { localStorage.setItem('blatPen', JSON.stringify(penSt)); } catch (e) {}
  renderPenOpts();
}
function setGum(v) { if (v && tool !== 'pen') setTool('pen'); if (v && !gum) tip(_t('Gumka: przeciągnij po kreskach · M wraca do mazaka')); gum = !!v; renderPenOpts(); }
// gumka usuwa całe kreski, których dotknie (promień ~10 px na ekranie)
function eraseAt(x, y, noSnap) {
  const r = 10 / board.view.z, hit = [];
  for (const d of board.items) {
    if (d.type !== 'drawing') continue;
    const k = d.w / d.bw, half = d.sw * k / 2;
    if (x < d.x - r || x > d.x + d.w + r || y < d.y - r || y > d.y + d.h + r) continue;
    for (let i = 1; i < d.pts.length; i++) {
      const ax = d.x + d.pts[i - 1][0] * k, ay = d.y + d.pts[i - 1][1] * k, bx = d.x + d.pts[i][0] * k, by = d.y + d.pts[i][1] * k;
      const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L));
      if (Math.hypot(ax + t * dx - x, ay + t * dy - y) <= r + half) { hit.push(d.id); break; }
    }
  }
  if (!hit.length) return false;
  if (!noSnap) snapshot();
  const h = new Set(hit); board.items = board.items.filter(i => !h.has(i.id)); for (const id of h) sel.delete(id);
  drawAll(); changed(); return true;
}
let penOptsKey = '';
function renderPenOpts() {
  const box = $('#penopts'); if (!box) return;
  const ds = tool === 'pen' ? [] : penSel(), show = tool === 'pen' || ds.length > 0;
  const cur = ds.length ? { c: PENS.findIndex(p => p[0] === ds[0].c), w: -1 } : penSt;
  const key = [show, cur.c, cur.w, gum, ds.length > 0, _lang].join();
  main.classList.toggle('gum', tool === 'pen' && gum);
  if (key === penOptsKey) return; penOptsKey = key;
  box.classList.toggle('on', show);
  box.innerHTML = (ds.length ? '' : '<button class="ib gm' + (gum ? ' wybr' : '') + '" title="' + _t('Gumka') + ' (E)">' + IC.gum + '</button><span class="sp"></span>')
    + PENS.map(([c, n, hl], i) => '<button class="ib k' + (cur.c === i && !gum ? ' wybr' : '') + '" data-k="' + i + '" title="' + _t(n) + '"><span class="dot" style="background:' + c + (hl ? ';opacity:.75' : '') + '"></span></button>').join('')
    + '<span class="sp"></span>'
    + SIZES.map(([w, n], i) => '<button class="ib g' + (cur.w === i && !gum ? ' wybr' : '') + '" data-g="' + i + '" title="' + _t(n) + '"><svg width="16" height="16" aria-hidden="true"><line x1="3.5" y1="12.5" x2="12.5" y2="3.5" stroke="currentColor" stroke-linecap="round" stroke-width="' + [1.4, 2.6, 4.4][i] + '"/></svg></button>').join('');
  const g = box.querySelector('.gm'); if (g) g.onclick = () => setGum(!gum);
  box.querySelectorAll('.k').forEach(b => b.onclick = () => setPen({ c: +b.dataset.k }));
  box.querySelectorAll('.g').forEach(b => b.onclick = () => setPen({ w: +b.dataset.g }));
}
const kidsOf = id => board.items.filter(o => o.type === 'drawing' && o.parent === id);
function imageUnder(ptsAbs) {
  // od wierzchu: wyższe z, a przy równym z później dodany (tak samo jak na ekranie)
  const imgs = board.items.map((o, n) => [o, n]).filter(([o]) => o.type === 'image').sort((a, b) => ((b[0].z || 0) - (a[0].z || 0)) || (b[1] - a[1])).map(([o]) => o);
  for (const im of imgs) { const n = ptsAbs.filter(([x, y]) => x >= im.x && x <= im.x + im.w && y >= im.y && y <= im.y + im.h).length; if (n >= ptsAbs.length * 0.6) return im.id; }
  return null;
}
function penPath(pts) {
  if (pts.length < 2) return '';
  let d = 'M' + pts[0][0] + ' ' + pts[0][1];
  for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += 'Q' + pts[i][0] + ' ' + pts[i][1] + ' ' + mx.toFixed(1) + ' ' + my.toFixed(1); }
  const l = pts[pts.length - 1]; return d + 'L' + l[0] + ' ' + l[1];
}
function makeDrawing(ptsAbs, sw, c, hl) {
  if (ptsAbs.length < 2) return null;
  snapshot();
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const [x, y] of ptsAbs) { x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y); }
  const x = x1 - sw, y = y1 - sw, w = Math.max(1, x2 - x1 + 2 * sw), h = Math.max(1, y2 - y1 + 2 * sw);
  const pts = ptsAbs.map(([px, py]) => [Math.round((px - x) * 10) / 10, Math.round((py - y) * 10) / 10]);
  const top = Math.max(0, ...board.items.map(i => i.z || 0));
  const d = { id: uid(), type: 'drawing', x, y, w, h, bw: w, bh: h, pts, sw, c: c || PEN, parent: imageUnder(ptsAbs), z: top + 1 };
  if (hl) d.hl = true;
  board.items.push(d); drawAll(); changed(); return d.id;
}
// kreski przesunięte bez swojego obrazu szukają obrazu pod sobą
function reparent(ids) {
  for (const id of ids) { const o = byId(id); if (o && o.type === 'drawing' && !ids.has(o.parent)) { const k = o.w / o.bw; o.parent = imageUnder(o.pts.map(([px, py]) => [o.x + px * k, o.y + py * k])); } }
}
// obraz zmienił miejsce lub rozmiar: jego kreski idą za nim (o = stare położenie obrazu)
function followParent(im, o) {
  const k = o.w ? im.w / o.w : 1;
  for (const c of kidsOf(im.id)) { c.x = im.x + (c.x - o.x) * k; c.y = im.y + (c.y - o.y) * k; c.w *= k; c.h *= k; drawItem(c); }
}
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
  // Windows: w trybie bez nawigacji przyciski okna leżą na płótnie, więc dostają jego kolor i niższy pasek
  const bareWin = isBare() && !isFs();
  if (api.chromeColors) api.chromeColors(cs.getPropertyValue(bareWin ? '--paper' : '--bg').trim(), cs.getPropertyValue('--text2').trim(), bareWin ? 32 : 52);
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
    if (it.type === 'drawing') el.innerHTML = '<svg preserveAspectRatio="none" fill="none" stroke-linecap="round" stroke-linejoin="round"><path class="hit"/><path class="ln"/></svg>';
    els.set(it.id, el);
    world.appendChild(el);
  }
  el.style.left = it.x + 'px'; el.style.top = it.y + 'px'; el.style.width = it.w + 'px';
  el.style.height = it.type === 'note' ? 'auto' : it.h + 'px';
  // kolejność warstw: ramki na dole, potem obrazy i notatki wg (z, kolejność dodania); kreska tuż nad swoim obrazem
  const rk = rank.get(it.type === 'drawing' ? it.parent : it.id);
  el.style.zIndex = it.type === 'frame' ? (it.z || 0) : rk == null ? 1000 + 2 * rank.size + 2 + (it.z || 0) : 1000 + 2 * rk + (it.type === 'drawing' ? 1 : 0);
  if (it.type === 'drawing') {
    const s = el.firstChild, d = penPath(it.pts);
    if (s.dataset.d !== d) { s.dataset.d = d; s.setAttribute('viewBox', '0 0 ' + it.bw + ' ' + it.bh); s.querySelector('.ln').setAttribute('d', d); s.querySelector('.hit').setAttribute('d', d); }
    const ln = s.querySelector('.ln'); ln.setAttribute('stroke', it.c || PEN); ln.setAttribute('stroke-width', it.sw);
    ln.style.opacity = it.hl ? .45 : ''; ln.style.mixBlendMode = it.hl ? 'multiply' : '';   // zakreślacz: tekst pod nim zostaje czytelny
    s.querySelector('.hit').setAttribute('stroke-width', Math.max(it.sw * 1.5, 12 / board.view.z * (it.bw / it.w)));   // ok. 12 px na ekranie, nie mniej niż kreska
  }
  if (it.type === 'image') { const im = el.firstChild, s = imgSrc(it); if (im.getAttribute('src') !== s) im.src = s; }
  if (it.type === 'frame') {
    const nb = el.querySelector('.fl b'); if (nb) nb.textContent = it.name || _t('Ramka');   // podczas zmiany nazwy w miejscu <b> jest pole tekstowe
    const n = board.items.filter(o => o.type !== 'frame' && o.type !== 'drawing' && inside(o, it)).length;
    el.querySelector('span').textContent = n ? n + ' ' + plural(n, 'element', 'elementy', 'elementów') : '';
  }
  if (it.type === 'note' && el.contentEditable !== 'true' && el.textContent !== (it.text || '')) el.textContent = it.text || '';
  el.classList.toggle('sel', sel.has(it.id));
  let hd = el.querySelector('.hd');
  const showHd = sel.size === 1 && sel.has(it.id) && it.type !== 'drawing';
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
let rank = new Map();
function ranks() {
  rank = new Map(board.items.map((o, n) => [o, n]).filter(([o]) => o.type !== 'frame' && o.type !== 'drawing')
    .sort((a, b) => ((a[0].z || 0) - (b[0].z || 0)) || (a[1] - b[1])).map(([o], r) => [o.id, r]));
}
function drawAll() {
  ranks(); renderPenOpts();
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
  applyView.t = setTimeout(() => { for (const it of board.items) if (it.type === 'image' || it.type === 'drawing' || sel.has(it.id)) drawItem(it); }, 160);   // podmiana miniatura/pełny obraz po zakończeniu przybliżania
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
  const keep = []; for (const i of [...b.items, ...(clip && clip.board === b.name ? clip.items : [])]) if (i.img) { if (i.img.full) keep.push(i.img.full); if (i.img.thumb) keep.push(i.img.thumb); }   // wycięte obrazy czekają w schowku
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
      if (n) { if (clip && clip.board === board.name) clip.board = n; board.name = n; b.textContent = n; document.title = n + ' — Blat'; dirty = true; saveNow(); drawAll(); }
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
  let list = selItems().filter(i => i.type !== 'frame' && i.type !== 'drawing');
  let frame = null;
  if (!list.length) { const f = selItems().find(i => i.type === 'frame'); if (f) { frame = f; list = board.items.filter(o => o.type !== 'frame' && o.type !== 'drawing' && inside(o, f)); } }
  if (list.length < 2) { const b = $('#arrangeBtn'); b.classList.remove('nie'); void b.offsetWidth; b.classList.add('nie'); tip(_t('Zaznacz co najmniej dwa obrazy')); return; }
  snapshot();
  const kids = list.flatMap(i => kidsOf(i.id));
  const moved = [...list, ...kids, ...(frame ? [frame] : [])], before = new Map(moved.map(i => [i.id, { x: i.x, y: i.y, w: i.w, h: i.h }]));
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
  for (const i of list) if (i.type === 'image') followParent(i, before.get(i.id));
  if (frame) { const nb = bbox(list); frame.x = nb.x - 20; frame.y = nb.y - 46; frame.w = nb.w + 40; frame.h = nb.h + 66; }
  drawAll(); changed(); glide(moved, before);
  const ab = $('#arrangeBtn'); ab.classList.remove('tak', 'nie'); void ab.offsetWidth; ab.classList.add('tak');
}
// obrazy przejeżdżają ze starych miejsc na nowe (FLIP, sama transformacja — płynnie także przy setkach obrazów)
function glide(items, before) {
  if (items.length > 400) return;
  const done = e => { const el = e.currentTarget; el.style.transition = ''; el.style.transform = ''; el.style.transformOrigin = ''; el.removeEventListener('transitionend', done); };
  const els2 = [];
  for (const it of items) {
    const el = els.get(it.id), o = before.get(it.id); if (!el || !o) continue;
    const sx = it.w ? o.w / it.w : 1, sy = it.type === 'note' || !it.h ? 1 : o.h / it.h;
    if (Math.abs(o.x - it.x) < 1 && Math.abs(o.y - it.y) < 1 && Math.abs(sx - 1) < .01 && Math.abs(sy - 1) < .01) continue;
    el.style.transition = 'none'; el.style.transformOrigin = '0 0';
    el.style.transform = 'translate(' + (o.x - it.x) + 'px,' + (o.y - it.y) + 'px) scale(' + sx + ',' + sy + ')';
    els2.push(el);
  }
  if (!els2.length) return;
  void world.offsetWidth;
  els2.forEach((el, n) => { el.style.transition = 'transform .5s var(--spring) ' + Math.min(n * 12, 160) + 'ms'; el.style.transform = ''; el.addEventListener('transitionend', done); });
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
  else if (tool === 'pen' && gum) { drag = { kind: 'gum', snap: false }; if (eraseAt(w.x, w.y)) drag.snap = true; }
  else if (tool === 'pen') {
    const P = PENS[penSt.c], sw = penPx(penSt.c, penSt.w) / board.view.z;
    const live = document.createElement('div'); live.className = 'it drawing live';
    live.innerHTML = '<svg fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="' + P[0] + '" stroke-width="' + sw + '"' + (P[2] ? ' style="opacity:.45;mix-blend-mode:multiply"' : '') + '/></svg>';
    world.appendChild(live); sel.clear(); drawAll();
    drag = { kind: 'pen', pts: [[w.x, w.y]], sw, c: P[0], hl: !!P[2], live };
  }
  else if (tool === 'frame') { snapshot(); const f = { id: uid(), type: 'frame', x: w.x, y: w.y, w: 1, h: 1, name: _t('Ramka'), z: 0 }; board.items.push(f); sel = new Set([f.id]); drawAll(); drag = { kind: 'newframe', f, ox: w.x, oy: w.y }; }
  else if (e.target.classList.contains('hd') && item) {
    snapshot(); drag = { kind: 'resize', item, ox: w.x, oy: w.y, w0: item.w, h0: item.h, ratio: item.type === 'image' ? item.w / item.h : 0,
      kids: kidsOf(item.id).map(c => [c, c.x, c.y, c.w, c.h]) };
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
  else if (drag.kind === 'gum') { if (eraseAt(w.x, w.y, drag.snap)) drag.snap = true; }
  else if (drag.kind === 'pen') {
    const p = drag.pts, r2 = v => Math.round(v * 10) / 10;
    if (e.shiftKey) drag.pts = [p[0], [r2(w.x), r2(w.y)]];
    else for (const ev of (e.getCoalescedEvents ? e.getCoalescedEvents() : [e])) {
      const q = toWorld(ev.clientX, ev.clientY), l = p[p.length - 1];
      if (Math.hypot(q.x - l[0], q.y - l[1]) * board.view.z >= 1.5) p.push([r2(q.x), r2(q.y)]);
    }
    drag.live.querySelector('path').setAttribute('d', penPath(drag.pts));
  }
  else if (drag.kind === 'move') {
    const dx = w.x - drag.ox, dy = w.y - drag.oy;
    if (!drag.moved && Math.hypot(dx, dy) * board.view.z < 3) return;
    if (!drag.moved) { drag.moved = true; snapshot(); }
    for (const [o, x, y] of drag.start) { o.x = Math.round(x + dx); o.y = Math.round(y + dy); drawItem(o); }
  } else if (drag.kind === 'resize') {
    const it = drag.item; let nw = Math.max(24, drag.w0 + w.x - drag.ox), nh = Math.max(24, drag.h0 + w.y - drag.oy);
    if (drag.ratio) nh = nw / drag.ratio;
    it.w = Math.round(nw); if (it.type !== 'note') it.h = Math.round(nh); drawItem(it);
    const k = it.w / drag.w0; for (const [c, x, y, cw, ch] of drag.kids) { c.x = it.x + (x - it.x) * k; c.y = it.y + (y - it.y) * k; c.w = cw * k; c.h = ch * k; drawItem(c); }
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
  if (d.kind === 'pen') {
    d.live.remove();
    const len = d.pts.reduce((s, p, i) => i ? s + Math.hypot(p[0] - d.pts[i - 1][0], p[1] - d.pts[i - 1][1]) : 0, 0);
    if (len * board.view.z >= 3) makeDrawing(d.pts, d.sw, d.c, d.hl);
  }
  if (d.kind === 'move' && d.moved) {
    reparent(new Set(d.start.map(([o]) => o.id)));
    changed(); frameCounts();
  }
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
// kółko myszy: przybliżanie wokół kursora (albo przesuwanie — w ustawieniach); gładzik dwoma palcami: przesuwanie;
// Ctrl/⌘ + kółko albo szczypanie na gładziku: zawsze przybliżanie; Shift + kółko: przesuwanie w poziomie;
// wciśnięte kółko (środkowy przycisk), spacja albo Alt + przeciąganie: przesuwanie
// Mysz czy gładzik: ząbek kółka daje wheelDeltaY w wielokrotnościach 120 (także przy powiększeniu ekranu w Windows),
// a gładzik w Chromium ma wheelDeltaY = −3 × deltaY albo wartości ułamkowe i ruch w poziomie.
function wheelKind(e, pure) {
  let k;
  if (e.deltaMode === 1 || e.deltaMode === 2) k = 'mouse';
  else if (e.deltaX) k = 'pad';
  else { const w = e.wheelDeltaY; k = w && w % 120 === 0 && w !== -3 * e.deltaY ? 'mouse' : 'pad'; }
  if (pure) return k;
  // jeden gest = jedno rozpoznanie (bezwładność gładzika potrafi wyglądać jak kółko)
  const now = performance.now(); if (now - wheelKind.t < 220) k = wheelKind.k; wheelKind.t = now; wheelKind.k = k; return k;
}
wheelKind.t = 0; wheelKind.k = 'pad';
let wheelMode = 'zoom'; try { if (localStorage.getItem('blatWheel') === 'pan') wheelMode = 'pan'; } catch (e) {}
function setWheelMode(m) { wheelMode = m; try { localStorage.setItem('blatWheel', m); } catch (e) {} wheelTexts(); tip(m === 'zoom' ? _t('Kółko myszy przybliża') : _t('Kółko myszy przesuwa')); }
main.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.ctrlKey || e.metaKey) { const d = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY; zoomAt(Math.exp(-Math.max(-120, Math.min(120, d)) / (Math.abs(d) < 40 ? 120 : 400)), e.clientX, e.clientY); return; }
  if (!e.shiftKey && wheelMode === 'zoom' && wheelKind(e) === 'mouse') {
    // jeden ząbek ≈ 15%; kierunek zawsze z deltaY, liczba ząbków z wheelDeltaY (gdy to wielokrotność 120)
    const w = Math.abs(e.wheelDeltaY || 0), steps = w && w % 120 === 0 ? w / 120 : Math.max(1, Math.abs(e.deltaMode === 1 ? e.deltaY / 3 : e.deltaY / 100));
    const n = -Math.sign(e.deltaY) * steps;
    zoomAt(Math.pow(1.15, Math.max(-3, Math.min(3, n))), e.clientX, e.clientY); return;
  }
  board.view.x -= e.shiftKey ? (e.deltaY || e.deltaX) : e.deltaX; board.view.y -= e.shiftKey ? 0 : e.deltaY; applyView(); changedView();
}, { passive: false });
main.addEventListener('contextmenu', e => {
  e.preventDefault();
  const el = e.target.closest('.it'), it = el && byId(el.dataset.id);
  if (it && !sel.has(it.id)) { sel = new Set([it.id]); drawAll(); }
  const p = toWorld(e.clientX, e.clientY);
  showMenu(e.clientX, e.clientY, sel.size ? [
    [_t('Kopiuj'), () => { const t = copySel(); try { navigator.clipboard.writeText(t); } catch (e) {} }, MOD + 'C'],
    [_t('Wytnij'), () => { const t = cutSel(); try { navigator.clipboard.writeText(t); } catch (e) {} }, MOD + 'X'],
    [_t('Powiel'), duplicateSel, MOD + 'D'],
    '-',
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
  board.items = board.items.filter(i => !sel.has(i.id) && !(i.type === 'drawing' && sel.has(i.parent))); sel.clear(); drawAll(); changed();
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
  const p = pastePoint();
  const files = [...(e.clipboardData.files || [])];
  if (!files.length && isOurClip(e.clipboardData.getData('text/plain'))) { pasteClip(p); return; }
  if (files.length) { addImages(await filesToBlobs(files), p); return; }
  const text = e.clipboardData.getData('text/plain');
  if (text) addNote(p, text);
});
/* ---------- kopiowanie elementów ---------- */
// clip: kopia elementów (z ramką i jej zawartością, z kreskami obrazów), blat źródłowy i tekst zapisany w schowku systemowym,
// po którym przy wklejaniu poznajemy, że w schowku jest nasza kopia, a nie coś z innego programu
let clip = null, lastPaste = null;
const eol = t => (t || '').replace(/\r\n/g, '\n');
const isOurClip = t => !!clip && eol(t) === eol(clip.text);   // schowek Windows potrafi zamienić \n na \r\n
function copySel() {
  if (!sel.size) return null;
  const items = [...movingSet()].map(byId).filter(Boolean).map(o => JSON.parse(JSON.stringify(o)));
  const notes = items.filter(i => i.type === 'note' && i.text).map(i => i.text);
  const n = items.filter(i => i.type !== 'drawing').length;
  clip = { board: board.name, items, text: notes.length ? notes.join('\n\n') : 'Blat: ' + n + ' ' + plural(n, 'element', 'elementy', 'elementów') };
  return clip.text;
}
async function pasteClip(at, offset) {
  if (!clip || !clip.items.length) return false;
  const items = clip.items.map(o => JSON.parse(JSON.stringify(o)));
  // obrazy z innego blatu: kopiujemy ich pliki do bieżącego
  let missing = 0;
  if (clip.board !== board.name) for (const o of items) if (o.img) for (const f of [o.img.full, o.img.thumb]) if (f && !(await api.imageCopy(clip.board, board.name, f))) missing++;
  lastPaste = { missing };
  if (missing) tip(_t('Nie znalazłem plików części obrazów — blat źródłowy usunięto albo przeniesiono'));
  snapshot();
  const map = new Map(items.map(o => [o.id, uid()])), b = bbox(items.filter(o => o.type !== 'drawing').length ? items.filter(o => o.type !== 'drawing') : items);
  const dx = offset ? offset : at.x - (b.x + b.w / 2), dy = offset ? offset : at.y - (b.y + b.h / 2);
  let top = Math.max(0, ...board.items.map(i => i.z || 0));
  for (const o of items.sort((a, c) => (a.z || 0) - (c.z || 0))) {
    o.id = map.get(o.id); o.x = Math.round(o.x + dx); o.y = Math.round(o.y + dy); if (o.type !== 'frame') o.z = ++top;
    if (o.type === 'drawing') o.parent = map.get(o.parent) || null;
    board.items.push(o);
  }
  reparent(new Set(items.filter(o => o.type === 'drawing' && !o.parent).map(o => o.id)));
  sel = new Set(items.map(o => o.id)); drawAll(); changed(); return true;
}
const pastePoint = () => lastPointer && document.elementFromPoint(lastPointer.x, lastPointer.y)?.closest('main') ? toWorld(lastPointer.x, lastPointer.y) : centerWorld();
function cutSel() { const t = copySel(); if (t == null) return null; sel = movingSet(); removeSel(); return t; }   // ramka razem z zawartością
function duplicateSel() { if (!sel.size) return; const keep = clip; copySel(); pasteClip(null, Math.round(24 / board.view.z)); clip = keep || clip; }
document.addEventListener('copy', e => {
  if (e.target.closest && (e.target.closest('input') || e.target.isContentEditable) || !sel.size) return;
  e.preventDefault(); e.clipboardData.setData('text/plain', copySel());
});
document.addEventListener('cut', e => {
  if (e.target.closest && (e.target.closest('input') || e.target.isContentEditable) || !sel.size) return;
  e.preventDefault(); e.clipboardData.setData('text/plain', cutSel());
});
async function pasteFromClipboard(p) {
  try { if (isOurClip(await navigator.clipboard.readText())) { pasteClip(p); return; } } catch (e) {}
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
  if (t === 'pen' && tool !== 'pen') tip(_t('Mazak: rysuj po obrazach · Shift prosta kreska · Esc kończy'));
  tool = t; if (t !== 'pen') gum = false;
  for (const b of document.querySelectorAll('#tools .ib')) b.classList.toggle('on', b.dataset.tool === t);
  const on = $('#tools .ib.on'), ind = $('#tools .ind'); if (on && ind) ind.style.transform = 'translateX(' + on.offsetLeft + 'px)';
  main.className = main.className.replace(/\btool-\w+/g, '').trim(); if (t !== 'select') main.classList.add('tool-' + t);
  renderPenOpts();
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
  if (mod && k === 'd') { e.preventDefault(); duplicateSel(); return; }
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
  else if (k === 'm') { setTool('pen'); setGum(false); }
  else if (k === 'e') setGum(true);
  else if (k === 'a') arrange();
  else if (k === 'p') toggleTop();
  else if (k === '0') fit();
  else if (k === '1') zoomAt(1 / board.view.z);
  else if (k === 'z') sel.size ? fit(selItems()) : fit();
  else if (k === 'tab') { e.preventDefault(); toggleBare(); }
  else if (k.startsWith('arrow') && sel.size) {
    e.preventDefault(); snapshot();
    const s = e.shiftKey ? 50 : 5, dx = k === 'arrowleft' ? -s : k === 'arrowright' ? s : 0, dy = k === 'arrowup' ? -s : k === 'arrowdown' ? s : 0;
    const ms = movingSet(); for (const id of ms) { const o = byId(id); o.x += dx; o.y += dy; drawItem(o); } reparent(ms); changed();
  }
});
addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; main.classList.remove('space'); } });
addEventListener('blur', () => { spaceDown = false; main.classList.remove('space'); });

/* ---------- menu ---------- */
function showMenu(x, y, rows) {
  const m = $('#menu'); m.innerHTML = '';
  for (const r of rows) {
    if (r === '-') { m.appendChild(document.createElement('hr')); continue; }
    const b = document.createElement('button'); if (r[3] === 'warn' || r[2] === 'warn') b.className = 'warn'; if (r[3] === 'info') { b.className = 'info'; b.disabled = true; }
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
    [MOD + 'V', _t('wklej obraz albo tekst')], [MOD + 'C  ' + MOD + 'X', _t('kopiuj / wytnij elementy')], [MOD + 'D', _t('powiel zaznaczone')], [MOD + 'G', _t('ramka wokół zaznaczonych')],
    [isMac ? '⌘Z  ⇧⌘Z' : 'Ctrl+Z  Ctrl+Y', _t('cofnij / ponów')], [MOD + 'N', _t('nowy blat')],
    [MOD + 'A', _t('zaznacz wszystko')], [wheelMode === 'zoom' ? _t('kółko') : MOD + _t('kółko'), _t('przybliżanie')],
    [_t('strzałki'), _t('przesuń zaznaczone') + ' (⇧ ×10)'], [isMac ? '⌫' : 'Delete', _t('usuń zaznaczone')],
    [_t('wciśnięte kółko') + ' / ' + (isMac ? '⌥' : 'Alt') + ' + ' + _t('przeciąganie'), _t('przesuwanie płótna')], [FSK, _t('pełny ekran')],
  ];
  $('#keys').innerHTML = '<div class="kc"><div class="kh"><b>' + _t('Skróty klawiszowe') + '</b><span>' + _t('? otwiera tę ściągę · Esc zamyka') + '</span></div>'
    + row(0, [K('1', _t('100%')), K('0', _t('całość'))])
    + row(20, [K('E', _t('gumka')), K('T', _t('notatka')), K('P', _t('zawsze na wierzchu'))])
    + row(34, [K('A', _t('ułóż zaznaczone')), K('F', _t('ramka'))])
    + row(54, [K('Z', _t('dopasuj zaznaczone')), K('V', _t('zaznaczanie') + '<em>Esc ' + _t('odznacz') + '</em>'), K('M', _t('mazak') + '<em>⇧ ' + _t('prosta kreska') + '</em>')])
    + row(0, [K('Tab', _t('ukryj interfejs'), 'w'), K(_t('spacja'), _t('przytrzymaj i przeciągnij: przesuwanie płótna'), 'sp')])
    + '<div class="km">' + L.map(([k, t]) => '<div><kbd>' + k + '</kbd>' + t + '</div>').join('') + '</div></div>';
}
function toggleKeys(v) { const o = $('#keys'); v = v == null ? !keysOpen() : v; if (v) renderKeys(); o.classList.toggle('on', v); if (v) try { localStorage.setItem('blatSeenKeys', '1'); } catch (e) {} }
function wheelTexts() { $('#zoomHint').textContent = wheelMode === 'zoom' ? _t('kółko') : MOD + _t('kółko'); if (keysOpen()) renderKeys(); }
// ustawienia: kółko myszy, aktywowanie po najechaniu (Mac), wersja i aktualizacje
// ustawienia: kółko myszy, aktywowanie po najechaniu, wersja i aktualizacje
let updState = null;
function showSettings() {
  const r = $('#setBtn').getBoundingClientRect(), u = updState || {};
  const rows = [
    [_t('Kółko myszy przybliża'), () => setWheelMode('zoom'), wheelMode === 'zoom' ? '✓' : ''],
    [_t('Kółko myszy przesuwa'), () => setWheelMode('pan'), wheelMode === 'pan' ? '✓' : ''],
    '-',
    ...(isMac || api.web ? [[_t('Aktywuj Blat po najechaniu kursorem'), () => setHoverFocus(!hoverFocus), hoverFocus ? '✓' : ''], '-'] : []),
    ['Blat ' + (u.current || ''), () => {}, '', 'info']
  ];
  if (u.state === 'available' || u.state === 'downloading') rows.push([_t('Zainstaluj wersję') + ' ' + u.version, () => api.updateInstall && api.updateInstall()]);
  else rows.push([_t('Sprawdź aktualizacje'), checkUpdates]);
  showMenu(r.left, r.top, rows);
  const m = $('#menu'); m.style.top = Math.max(8, r.top - m.offsetHeight - 6) + 'px';
}
async function checkUpdates() {
  if (!api.updateCheck) return;
  tip(_t('Sprawdzam aktualizacje…'));
  const s = await api.updateCheck(); updState = { ...(updState || {}), ...s };
  if (s.state === 'available') tip(_t('Dostępna wersja') + ' ' + s.version + ' — ' + _t('zainstalujesz ją w ustawieniach albo w bocznym pasku'));
  else if (s.state === 'none') tip(_t('Masz najnowszą wersję') + ' (' + (s.current || '') + ')');
  else tip(_t('Nie udało się sprawdzić aktualizacji'));
}
// aktywowanie po najechaniu: szczypanie gładzikiem na Macu dociera tylko do aktywnego programu
let hoverFocus = false; try { hoverFocus = localStorage.getItem('blatHoverFocus') === '1'; } catch (e) {}
function setHoverFocus(v) { hoverFocus = !!v; try { localStorage.setItem('blatHoverFocus', hoverFocus ? '1' : '0'); } catch (e) {} if (v) tip(_t('Blat stanie się aktywny, gdy najedziesz na niego kursorem')); }
let hoverT = 0;
document.addEventListener('mousemove', () => {
  if (!hoverFocus || !isMac || document.hasFocus() || !api.focusWindow || Date.now() - hoverT < 800) return;
  hoverT = Date.now(); api.focusWindow();
}, { passive: true });
/* ---------- podpowiedzi przy przyciskach ---------- */
// zamiast systemowego dymka: po ~0,5 s bez ruchu pod przyciskiem pojawia się nazwa i skrót; między sąsiednimi przyciskami od razu
let hintT = 0, hintEl = null, hintLast = 0;
function hintShow(el) {
  const h = $('#hint'), t = el.dataset.tip || ''; if (!t) return;
  const m = t.match(/^(.*?)\s*\(([^)]+)\)$/);
  h.innerHTML = ''; const n = document.createElement('span'); n.textContent = m ? m[1] : t; h.appendChild(n);
  if (m) { const k = document.createElement('kbd'); k.textContent = m[2]; h.appendChild(k); }
  h.classList.add('on'); const r = el.getBoundingClientRect(), w = h.offsetWidth, hh = h.offsetHeight;
  const below = r.bottom + 8 + hh < innerHeight;
  h.style.left = Math.max(6, Math.min(innerWidth - w - 6, r.left + r.width / 2 - w / 2)) + 'px';
  h.style.top = (below ? r.bottom + 6 : r.top - hh - 6) + 'px';
}
function hintHide() { clearTimeout(hintT); if (hintEl) hintLast = Date.now(); hintEl = null; $('#hint').classList.remove('on'); }
document.addEventListener('pointerover', e => {
  const el = e.target.closest && e.target.closest('.ib, #upd'); if (!el || el === hintEl) return;
  if (el.title) { el.dataset.tip = el.title; el.removeAttribute('title'); }   // systemowy dymek nie dubluje naszego
  hintHide(); hintEl = el;
  hintT = setTimeout(() => { if (hintEl === el) hintShow(el); }, Date.now() - hintLast < 400 ? 0 : 450);
});
document.addEventListener('pointerout', e => { const el = e.target.closest && e.target.closest('.ib, #upd'); if (el && el === hintEl && !el.contains(e.relatedTarget)) hintHide(); });
// opis zmieniony przez program (przypinka, motyw, pełny ekran…) też trafia do data-tip, bez systemowego dymka
new MutationObserver(ms => { for (const m of ms) { const el = m.target; if (!el.title) continue; el.dataset.tip = el.title; el.removeAttribute('title'); if (el === hintEl && $('#hint').classList.contains('on')) hintShow(el); } })
  .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['title'] });
addEventListener('pointerdown', hintHide, true); addEventListener('wheel', hintHide, { passive: true });
let onTop = false;
// przypięcie na wierzchu: pomarańczowy przycisk z pełną pinezką; w trybie bez nawigacji mała pinezka w rogu
function toggleTop(v) {
  onTop = v == null ? !onTop : v;
  const anim = onTop !== $('#topBtn').classList.contains('pinned');
  for (const b of [$('#topBtn'), $('#pillTop')]) { if (!b) continue; b.classList.toggle('pinned', onTop);
    if (anim) { b.classList.remove('pinIn', 'pinOut'); void b.offsetWidth; b.classList.add(onTop ? 'pinIn' : 'pinOut'); } b.innerHTML = onTop ? IC.pinOn : IC.pin; b.title = (onTop ? _t('Przypięty na wierzchu') : _t('Zawsze na wierzchu')) + ' (P)'; }
  document.body.classList.toggle('ontop', onTop);
  if (v == null) { api.setOnTop(onTop); tip(onTop ? _t('Blat zostaje na wierzchu') : _t('Blat zachowuje się jak zwykłe okno')); } }
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
  $('#topBtn').onclick = () => toggleTop(); $('#pillTop').onclick = e => { e.stopPropagation(); toggleTop(); }; $('#pinMark').innerHTML = IC.pinOn; toggleTop(onTop);
  $('#setBtn').innerHTML = IC.set; $('#setBtn').title = _t('Ustawienia'); $('#setBtn').onclick = e => { e.stopPropagation(); showSettings(); };
  $('#keysBtn').innerHTML = IC.keys; $('#keysBtn').title = _t('Skróty klawiszowe') + ' (?)'; $('#keysBtn').onclick = () => toggleKeys(true);
  $('#keys').addEventListener('click', e => { if (!e.target.closest('.kc')) toggleKeys(false); });
  $('#themeBtn').onclick = () => { localStorage.setItem('blatTheme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); applyTheme(); };
  $('#bname').ondblclick = renameStart; $('#bname').title = _t('Dwuklik zmienia nazwę');
  $('#where').onclick = () => api.boardReveal();
  wheelTexts();
  const tools = [['select', IC.select, 'Zaznaczanie', 'V'], ['note', IC.note, 'Notatka', 'T'], ['frame', IC.frame, 'Ramka', 'F'], ['pen', IC.pen, 'Mazak', 'M']];
  $('#tools').innerHTML = '<div class="ind"></div>' + tools.map(([t, ic, n, k]) => '<button class="ib" data-tool="' + t + '" title="' + _t(n) + ' (' + k + ')">' + ic + '</button>').join('');
  for (const b of document.querySelectorAll('#tools .ib')) b.onclick = () => setTool(b.dataset.tool);
  // pastylka w trybie bez nawigacji: pojawia się przy ruchu myszy, znika po dwóch sekundach
  $('#pillUi').innerHTML = IC.ui; $('#pillUi').onclick = e => { e.stopPropagation(); toggleBare(false); };
  $('#pillFs').innerHTML = IC.fs; $('#pillFs').onclick = e => { e.stopPropagation(); fullscreenToggle(); };
  let idleT = 0;
  main.addEventListener('pointermove', e => { const g = $('#gumCur'), r = main.getBoundingClientRect(); g.style.left = (e.clientX - r.left) + 'px'; g.style.top = (e.clientY - r.top) + 'px'; }, { passive: true });
  addEventListener('mousemove', () => { document.body.classList.add('moving'); syncButtons(); clearTimeout(idleT); idleT = setTimeout(() => { document.body.classList.remove('moving'); syncButtons(); }, 2000); }, { passive: true });
  if (api.onFullscreen) api.onFullscreen(onFullscreen); else document.addEventListener('fullscreenchange', () => onFullscreen(!!document.fullscreenElement));
  setTool('select'); emptyTexts(); applyTheme(); pillTips();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  addEventListener('beforeunload', () => { if (dirty) api.boardSave(board.name, board); });
  // aktualizacje: dyskretna informacja w panelu bocznym
  if (api.onUpdateStatus) {
    const show = s => { const b = $('#upd'); b.hidden = !(s && (s.state === 'available' || s.state === 'downloading' || s.state === 'ready'));
      if (!b.hidden) b.textContent = s.state === 'available' ? _t('Nowa wersja') + ' ' + s.version : s.state === 'downloading' ? _t('Pobieram') + ' ' + (s.size ? Math.round(s.got / s.size * 100) + '%' : '') : _t('Instaluję…'); };
    api.onUpdateStatus(s => { updState = s; show(s); }); api.updateGet().then(s => { updState = s; show(s); });
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
  stroke: (pts, sw) => makeDrawing(pts, sw || penPx(penSt.c, penSt.w) / board.view.z, PENS[penSt.c][0], !!PENS[penSt.c][2]),
  pen: o => { if (o) setPen(o); return { ...penSt }; },
  copy: () => copySel(), cut: () => cutSel(), paste: () => pasteClip(centerWorld()), duplicate: () => duplicateSel(),
  eraseAt: (x, y) => eraseAt(x, y),
  select: ids => { sel = new Set(ids); drawAll(); },
  selectAll: () => { sel = new Set(board.items.map(i => i.id)); drawAll(); },
  move: (dx, dy) => { snapshot(); const ms = movingSet(); for (const o of [...ms].map(byId)) { o.x += dx; o.y += dy; } reparent(ms); drawAll(); changed(); },
  frame: name => { frameAround(selItems()); const f = selItems()[0]; const inp = f && els.get(f.id).querySelector('input'); if (inp) { if (name) inp.value = name; inp.blur(); } return f && f.id; },
  bare: v => { toggleBare(v); return isBare(); },
  keys: v => { toggleKeys(v); return keysOpen(); },
  wheelMode: m => { if (m) setWheelMode(m); return wheelMode; },
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
    for (const fr of ['frame-mac', 'frame-win']) { const de = document.documentElement, was = [...de.classList].find(c => c.startsWith('frame-')); de.classList.replace(was, fr);
      ok(Math.abs(main.getBoundingClientRect().top) < 1, (fr === 'frame-mac' ? 'na Macu' : 'na Windows') + ' w trybie bez nawigacji płótno sięga górnej krawędzi');
      if (fr === 'frame-win') { toggleTop(true); const p = $('#pinMark').getBoundingClientRect(); ok(p.top < 30 && innerWidth - p.right >= 140, 'na Windows przypinka stoi u góry, obok przycisków okna'); toggleTop(false); }
      de.classList.replace(fr, was); }
    this.bare(false); ok(getComputedStyle($('header')).display !== 'none' && Math.abs(main.getBoundingClientRect().width - mw) < 2, 'powrót interfejsu');
    // okno da się przesuwać: niewidoczna warstwa z no-drag nie może leżeć nad paskiem (Electron liczy obszary przeciągania bez względu na przezroczystość)
    { const hr = $('header').getBoundingClientRect(), bad = [...document.querySelectorAll('body *')].filter(el => {
        const cs = getComputedStyle(el); if (cs.getPropertyValue('-webkit-app-region') !== 'no-drag' || el.closest('header')) return false;
        const hidden = cs.opacity === '0' || cs.pointerEvents === 'none' || cs.visibility === 'hidden'; if (!hidden || cs.display === 'none') return false;
        const r = el.getBoundingClientRect(); return r.width && r.height && r.left < hr.right && r.right > hr.left && r.top < hr.bottom && r.bottom > hr.top; });
      ok(!bad.length, 'pasek okna nie jest zasłonięty niewidoczną warstwą (' + bad.map(e => e.id || e.className).join(', ') + ')'); }
    // kółko myszy przybliża, gładzik przesuwa (zgłoszenie Michała 24.11.2026)
    { const K = (dy, wdy, dx = 0, mode = 0) => typeof wheelKind === 'function' ? wheelKind({ deltaY: dy, wheelDeltaY: wdy, deltaX: dx, deltaMode: mode }, true) : 'pad';
      ok(K(4, -120) === 'mouse', 'kółko myszy na Macu rozpoznane jako mysz');
      ok(K(100, -120) === 'mouse' && K(125, -120) === 'mouse' && K(-240, 240) === 'mouse', 'kółko myszy na Windows (także przy powiększeniu ekranu) rozpoznane jako mysz');
      ok(K(3, 0, 0, 1) === 'mouse', 'kółko w trybie linii rozpoznane jako mysz');
      ok(K(-2.5, 7.5) === 'pad' && K(40, -120) === 'pad' && K(10, -120, 3) === 'pad', 'gładzik rozpoznany jako gładzik');
      const z0 = board.view.z; main.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, deltaMode: 1, clientX: 300, clientY: 300, cancelable: true }));
      ok(board.view.z > z0, 'kółko myszy przybliża płótno'); }
    // przypięcie na wierzchu ma być wyraźnie widać (zgłoszenie Michała 24.11.2026)
    { const was = onTop, bg = () => { const c = getComputedStyle($('#topBtn'), '::before'); return c.content === 'none' ? getComputedStyle($('#topBtn')).backgroundColor : c.backgroundColor; };
      toggleTop(true); const on = bg(); toggleTop(false); const off = bg();
      ok(on === 'rgb(255, 107, 26)' && off !== on, 'przypięty przycisk pinezki jest pomarańczowy, odpięty nie');
      toggleBare(true); toggleTop(true); const pm = $('#pinMark'); ok(pm && getComputedStyle(pm).display !== 'none', 'w trybie bez nawigacji przypięcie widać w rogu');
      toggleTop(false); ok(!pm || getComputedStyle(pm).display === 'none', 'po odpięciu znak w rogu znika'); toggleBare(false); toggleTop(was); }
    // animacje „sprężyna” i reakcja porządkowania (prośba Michała 25.11.2026)
    { setTool('note'); const ind = $('#tools .ind'), on = $('#tools .ib[data-tool="note"]');
      ok(ind && Math.abs(ind.getBoundingClientRect().left - on.getBoundingClientRect().left) < 40 && ind.style.transform.includes('translate'), 'wskaźnik narzędzi przesuwa się pod wybrane narzędzie'); setTool('select');
      // wybrane narzędzie widać w obu motywach: wskaźnik wyraźnie jaśniejszy od tła grupy narzędzi
      const lum = c => { const m = c.match(/\d+/g).map(Number); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; }, th = document.documentElement.dataset.theme;
      for (const t of ['light', 'dark']) { document.documentElement.dataset.theme = t;
        const d = lum(getComputedStyle(ind).backgroundColor) - lum(getComputedStyle($('#tools')).backgroundColor);
        ok(d >= 12, 'wybrane narzędzie widać w motywie ' + (t === 'dark' ? 'ciemnym' : 'jasnym') + ' (różnica jasności ' + Math.round(d) + ')'); }
      document.documentElement.dataset.theme = th;
      sel.clear(); arrange(); ok($('#arrangeBtn').classList.contains('nie'), 'porządkowanie bez zaznaczenia potrząsa przyciskiem');
      const imgs = board.items.filter(i => i.type === 'image').slice(0, 3);
      if (imgs.length >= 2) { imgs[0].x += 500; drawAll(); sel = new Set(imgs.map(i => i.id)); arrange(); const el = els.get(imgs[0].id);
        ok(el.style.transition.includes('transform') || el.style.transform !== '', 'uporządkowane obrazy przejeżdżają na nowe miejsca');
        ok($('#arrangeBtn').classList.contains('tak'), 'przycisk porządkowania reaguje na udane porządkowanie'); undo(); sel.clear(); }
      else ok(false, 'za mało obrazów do sprawdzenia porządkowania'); }
    // mazak: wykreślanie uwag na obrazach (prośba Michała 25.11.2026)
    { const im = board.items.find(i => i.type === 'image');
      if (!im || typeof this.stroke !== 'function') ok(false, 'mazak: jest polecenie blatTest.stroke');
      else {
        im.z = Math.max(0, ...board.items.map(i => i.z || 0)) + 1; drawAll();
        const n0 = board.items.length, d = byId(this.stroke([[im.x + 20, im.y + 20], [im.x + im.w / 2, im.y + 30], [im.x + im.w - 20, im.y + 40]]));
        ok(d && d.type === 'drawing' && board.items.length === n0 + 1 && d.pts.length >= 2, 'mazak tworzy element „drawing” z punktami');
        ok(d && d.parent === im.id, 'kreska na obrazie przyczepia się do obrazu na wierzchu');
        const x0 = d.x; sel = new Set([im.id]); this.move(100, 0); ok(Math.abs(byId(d.id).x - (x0 + 100)) < 1, 'kreska przesuwa się razem z obrazem');
        const el = els.get(d.id); ok(getComputedStyle(el).pointerEvents === 'none', 'obszar kreski nie zasłania obrazu pod spodem');
        { const other = board.items.find(i => i.type === 'image' && i !== im); if (other) { other.z = im.z + 1; drawAll();
            ok(+els.get(d.id).style.zIndex > +els.get(im.id).style.zIndex && +els.get(d.id).style.zIndex < +els.get(other.id).style.zIndex, 'kreska leży tuż nad swoim obrazem, pod obrazami na wierzchu'); other.z = 0; drawAll(); } }
        sel = new Set([im.id]); this.remove(); ok(!byId(d.id), 'usunięcie obrazu usuwa jego kreski'); this.undo();
        ok(byId(d.id) && byId(im.id), 'cofnięcie przywraca obraz z kreską');
        const f = board.items.find(i => i.type === 'frame'); if (f) { drawItem(f); const n = board.items.filter(o => o.type !== 'frame' && o.type !== 'drawing' && inside(o, f)).length;
          ok(els.get(f.id).querySelector('span').textContent.startsWith(n ? String(n) : ''), 'ramka nie liczy kresek jako elementów'); }
        // ślad kreski (do klikania) ma stałą szerokość na ekranie także po przybliżeniu
        { const z0 = board.view.z, hw = () => +els.get(d.id).querySelector('.hit').getAttribute('stroke-width') * board.view.z * (d.w / d.bw);
          zoomAt(4); await new Promise(r => setTimeout(r, 250)); const h4 = hw(); zoomAt(z0 / board.view.z); await new Promise(r => setTimeout(r, 250));
          ok(h4 < 40, 'ślad kreski po przybliżeniu nie rośnie (' + Math.round(h4) + ' px)'); }
        // kreska zjechana strzałkami z obrazu odczepia się od niego
        { sel = new Set([d.id]); for (let i = 0; i < 60; i++) dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true }));
          ok(byId(d.id).parent !== im.id, 'kreska przesunięta strzałkami z obrazu odczepia się od niego'); this.undo(); sel.clear(); }
        ok(!els.get(d.id).querySelector('.hd') || (sel = new Set([d.id]), drawAll(), !els.get(d.id).querySelector('.hd')), 'sama kreska nie ma uchwytu zmiany rozmiaru'); sel.clear(); drawAll();
        sel = new Set([d.id]); this.remove(); sel.clear(); drawAll();
        // kolory, grubości i gumka
        if (typeof this.pen !== 'function') ok(false, 'mazak: jest polecenie blatTest.pen');
        else {
          const p0 = this.pen(); this.pen({ c: 3, w: 2 });
          const hl = byId(this.stroke([[im.x + 30, im.y + 60], [im.x + 160, im.y + 62]]));
          ok(hl && hl.hl === true && hl.c !== PEN && hl.sw > byId(this.stroke([[im.x + 30, im.y + 90], [im.x + 60, im.y + 92]])).sw * 0 + 0, 'zakreślacz zapisuje się jako półprzezroczysta kreska w swoim kolorze');
          this.pen({ c: 1, w: 0 }); const th = byId(this.stroke([[im.x + 30, im.y + 120], [im.x + 160, im.y + 122]]));
          ok(th && th.sw < hl.sw && th.c !== hl.c && !th.hl, 'cienka czarna kreska jest cieńsza od zakreślacza');
          sel = new Set([th.id]); this.pen({ c: 2 }); ok(byId(th.id).c === PENS[2][0], 'kolor zmienia się na zaznaczonej kresce');
          sel.clear(); const n1 = board.items.filter(i => i.type === 'drawing').length;
          this.eraseAt(im.x + 90, im.y + 121); ok(!byId(th.id) && board.items.filter(i => i.type === 'drawing').length === n1 - 1, 'gumka usuwa dotkniętą kreskę w całości');
          this.undo(); ok(byId(th.id), 'cofnięcie przywraca wymazaną kreskę');
          for (const o of board.items.filter(i => i.type === 'drawing')) sel.add(o.id); this.remove(); sel.clear(); this.pen(p0); drawAll();
        }
      } }
    // kopiowanie, wycinanie, wklejanie i powielanie (prośba Michała 25.11.2026)
    if (typeof this.copy !== 'function') ok(false, 'kopiowanie: są polecenia blatTest.copy / paste / duplicate');
    else {
      const im = board.items.find(i => i.type === 'image'), dr = byId(this.stroke([[im.x + 20, im.y + 20], [im.x + 120, im.y + 24]]));
      const n0 = board.items.length; sel = new Set([im.id]); this.copy(); await this.paste();
      const pIm = board.items.filter(i => i.type === 'image').slice(-1)[0], pDr = board.items.filter(i => i.type === 'drawing').find(d => d.parent === pIm.id);
      ok(board.items.length === n0 + 2 && pIm.id !== im.id && pIm.img.full === im.img.full && pDr, 'wklejony obraz ma nowe id, ten sam plik i swoją kopię kreski');
      ok([...sel].length === 2 && sel.has(pIm.id), 'wklejone elementy są zaznaczone');
      this.undo(); ok(board.items.length === n0, 'cofnięcie wklejenia');
      sel = new Set([im.id]); this.duplicate(); const dIm = board.items.filter(i => i.type === 'image').slice(-1)[0];
      ok(dIm.id !== im.id && Math.abs(dIm.x - im.x) > 0 && board.items.length === n0 + 2, 'powielanie robi kopię obok');
      this.undo();
      const cut = board.items.find(i => i.type === 'note') || byId(this.note(im.x, im.y - 80, 'do wycięcia')); const nb = board.items.length;
      sel = new Set([cut.id]); this.cut(); ok(!byId(cut.id) && board.items.length === nb - 1, 'wycinanie usuwa element');
      await this.paste(); ok(board.items.length === nb && board.items.some(i => i.type === 'note' && i.text === cut.text), 'wklejenie wyciętej notatki');
      // wycięcie ramki zabiera też jej zawartość (uwaga recenzenta)
      { const f = board.items.find(i => i.type === 'frame'); if (f) { const inside0 = board.items.filter(o => o.type !== 'frame' && inside(o, f)).map(o => o.id); const nb2 = board.items.length;
          sel = new Set([f.id]); this.cut(); ok(!byId(f.id) && inside0.every(id => !byId(id)) && board.items.length === nb2 - 1 - inside0.length - board.items.filter(() => false).length, 'wycięcie ramki zabiera jej zawartość');
          this.undo(); ok(byId(f.id) && inside0.every(id => byId(id)), 'cofnięcie wycięcia ramki'); } }
      // tekst ze schowka z końcami wierszy Windows nadal rozpoznany jako nasza kopia
      { sel = new Set([cut.id]); const t = this.copy(); ok(isOurClip(t.replace(/\n/g, '\r\n')), 'kopia rozpoznana także z końcami wierszy Windows'); }
      // na inny blat: pliki obrazów jadą razem z nim
      const src = board.name; sel = new Set([im.id]); this.copy(); await this.newBoard('Wklejanie ' + Date.now()); await this.paste();
      const ni = board.items.find(i => i.type === 'image'); ok(ni && lastPaste && lastPaste.missing === 0, 'obraz wklejony na inny blat ma swój plik w nowym blacie');
      const tmp = board.name; await this.open(src); await api.boardTrash(tmp); await refreshBoards();
      sel = new Set([dr.id]); this.remove(); sel.clear(); drawAll();
    }
    // ustawienia: wersja, aktualizacje, aktywowanie po najechaniu (prośba Michała 25.11.2026)
    { showSettings(); await new Promise(r => setTimeout(r, 50)); const t = $('#menu').innerText;
      ok(/Blat \S+/.test(t) && t.includes(_t('Sprawdź aktualizacje')), 'ustawienia pokazują wersję i „Sprawdź aktualizacje”');
      ok(t.includes(_t('Aktywuj Blat po najechaniu kursorem')), 'ustawienia mają aktywowanie po najechaniu'); hideMenu();
      const r0 = typeof hoverFocus !== 'undefined' && hoverFocus; if (typeof setHoverFocus === 'function') { setHoverFocus(true); ok(localStorage.getItem('blatHoverFocus') === '1', 'aktywowanie po najechaniu zapamiętane'); setHoverFocus(r0); } }
    // zmiana opisu przycisku (np. przypinka) nie przywraca systemowego dymka (uwaga recenzenta)
    { toggleTop(true); toggleTop(false); await new Promise(r => setTimeout(r, 30)); ok(!$('#topBtn').title && ($('#topBtn').dataset.tip || '').length > 0, 'przycisk po zmianie opisu nie ma systemowego dymka'); }
    // podpowiedź po zatrzymaniu kursora na narzędziu
    { const b = $('#tools .ib[data-tool="pen"]'); b.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); await new Promise(r => setTimeout(r, 700));
      const h = $('#hint'); ok(h && h.classList.contains('on') && h.textContent.includes(_t('Mazak')) && !b.title, 'po zatrzymaniu kursora na narzędziu pojawia się jego opis');
      b.dispatchEvent(new PointerEvent('pointerout', { bubbles: true })); await new Promise(r => setTimeout(r, 50)); ok(h && !h.classList.contains('on'), 'opis znika po zjechaniu z narzędzia'); }
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
